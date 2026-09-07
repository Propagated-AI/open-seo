import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  chmod,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

for (const name of [
  "DATAFORSEO_API_KEY",
  "TEAM_DOMAIN",
  "POLICY_AUD",
  "RENDER_MAINTENANCE_KEY",
]) {
  if (!process.env[name]) {
    throw new Error(`Missing or invalid ${name}`);
  }
}
if (process.env.RENDER_MAINTENANCE_KEY.length < 32)
  throw new Error("Maintenance key is too short");
if (process.env.AUTH_MODE !== "cloudflare_access")
  throw new Error("Render gateway requires Cloudflare Access authentication");

const childEnv = {
  ...process.env,
  PORT: "3101",
  CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
};
// Vite preview reads build-generated .dev.vars ahead of process.env. Replace
// those files with only the approved runtime bindings, never the whole Render
// environment. This also lets an API credential rotate without rebuilding.
const bindingNames = [
  "AUTH_MODE",
  "TEAM_DOMAIN",
  "POLICY_AUD",
  "DATAFORSEO_API_KEY",
  "RENDER_MAINTENANCE_KEY",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENSEO_TELEMETRY_DISABLED",
  "DO_NOT_TRACK",
];
const bindings =
  bindingNames
    .filter((name) => process.env[name] !== undefined)
    .map((name) => `${name}=${JSON.stringify(process.env[name])}`)
    .join("\n") + "\n";
for (const file of ["dist/server/.dev.vars", "dist/open_seo_audit/.dev.vars"]) {
  await writeFile(file, bindings, { mode: 0o600 });
  await chmod(file, 0o600);
}
const caddyEnv = {
  PATH: process.env.PATH,
  PORT: process.env.PORT || "10000",
  XDG_CONFIG_HOME: "/tmp/openseo-caddy/config",
  XDG_DATA_HOME: "/tmp/openseo-caddy/data",
};
let app,
  gateway,
  stopping = false,
  maintenance = false,
  ticking = false;
let operations = {
  successfulTicks: 0,
  lastTick: null,
  lastTickError: null,
  lastBackup: null,
};
const stateFile = ".wrangler/render-operations.json";
await mkdir(".wrangler", { recursive: true });
// The persistent mount hides the build's .wrangler directory. Restore the
// current image's Worker manifest on every boot, including after upgrades.
await mkdir(".wrangler/deploy", { recursive: true });
await writeFile(
  ".wrangler/deploy/config.json",
  await readFile("dist/render-deploy-config.json"),
);
try {
  operations = {
    ...operations,
    ...JSON.parse(await readFile(stateFile, "utf8")),
  };
} catch {}
const persist = () => writeFile(stateFile, JSON.stringify(operations, null, 2));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function launch(command, args, env) {
  return spawn(command, args, { env, stdio: "inherit", detached: true });
}
async function command(command, args) {
  const child = launch(command, args, childEnv);
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${command} exited with ${code}`);
}
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  const timer = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }, 15000);
  await exited;
  clearTimeout(timer);
}
async function healthy() {
  if (maintenance) return false;
  try {
    const response = await fetch("http://127.0.0.1:3101/api/health", {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok && (await response.json()).status === "ok";
  } catch {
    return false;
  }
}
async function waitHealthy() {
  for (let i = 0; i < 120; i++) {
    if (await healthy()) return;
    if (stopping) throw new Error("Stopping");
    await delay(1000);
  }
  throw new Error("App did not become healthy");
}
function startApp() {
  app = launch(
    "pnpm",
    ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "3101"],
    childEnv,
  );
  app.on("exit", () => {
    if (!stopping && !maintenance) void shutdown(1);
  });
}
async function tick() {
  if (maintenance || ticking || stopping || !(await healthy())) return;
  ticking = true;
  try {
    const response = await fetch(
      "http://127.0.0.1:3101/_internal/render-tick",
      {
        method: "POST",
        headers: {
          "x-render-maintenance-key": process.env.RENDER_MAINTENANCE_KEY,
        },
        signal: AbortSignal.timeout(240000),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    operations.successfulTicks++;
    operations.lastTick = (await response.json()).completedAt;
    operations.lastTickError = null;
    console.log("[render] Scheduled maintenance completed");
  } catch (error) {
    operations.lastTickError = `${new Date().toISOString()} ${error.message}`;
    console.error("[render] Scheduled maintenance failed:", error.message);
  } finally {
    await persist();
    ticking = false;
  }
}

async function backup(response) {
  if (maintenance || ticking) {
    response.writeHead(409);
    response.end("Maintenance is already running; retry shortly");
    return;
  }
  maintenance = true;
  const folder = await mkdtemp(join(tmpdir(), "openseo-backup-"));
  const archive = join(folder, "state.tar.gz");
  try {
    // Stop the entire workerd process group before copying any state. This
    // captures mutually consistent D1, Durable Object, KV, and R2 files.
    await stopChild(app);
    operations.lastBackup = new Date().toISOString();
    await persist();
    await command("tar", ["-czf", archive, ".wrangler"]);
    startApp();
    maintenance = false;
    await waitHealthy();
    response.writeHead(200, {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="openseo-state.tar.gz"',
    });
    const stream = createReadStream(archive);
    stream.pipe(response);
    await once(response, "close");
  } finally {
    if (maintenance && !stopping) {
      startApp();
      maintenance = false;
    }
    await rm(folder, { recursive: true, force: true });
  }
}
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  try {
    if (request.url === "/healthz" && request.method === "GET") {
      const ok = await healthy();
      response.writeHead(ok ? 200 : 503, {
        "Content-Type": "application/json",
      });
      response.end(JSON.stringify({ status: ok ? "ok" : "starting" }));
      return;
    }
    if (request.url === "/_ops/status" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ...operations, maintenance, ticking }));
      return;
    }
    if (request.url === "/_ops/backup" && request.method === "POST") {
      const origin = request.headers.origin;
      if (
        request.headers["sec-fetch-site"] === "cross-site" ||
        (origin && new URL(origin).host !== request.headers.host)
      ) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      await backup(response);
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  } catch (error) {
    console.error("[render] Operation failed:", error.message);
    if (!response.headersSent) response.writeHead(500);
    response.end("Operation failed");
  }
});
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  server.close();
  await Promise.all([stopChild(app), stopChild(gateway)]);
  process.exit(code);
}
let interval;
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
try {
  await command("pnpm", ["exec", "tsx", "scripts/selfhost-preflight.ts"]);
  await command("pnpm", ["run", "db:migrate:local"]);
  startApp();
  server.listen(3102, "127.0.0.1");
  gateway = launch(
    process.env.CADDY_BINARY || "caddy",
    ["run", "--config", "deploy/render/Caddyfile", "--adapter", "caddyfile"],
    caddyEnv,
  );
  gateway.on("exit", () => {
    if (!stopping) void shutdown(1);
  });
  gateway.on("error", () => void shutdown(1));
  await waitHealthy();
  console.log("[render] Authenticated gateway and database are ready");
  await tick();
  interval = setInterval(() => void tick(), 5 * 60 * 1000);
} catch (error) {
  console.error("[render] Startup failed:", error.message);
  await shutdown(1);
}
