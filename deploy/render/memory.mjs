import { readFile, readdir } from "node:fs/promises";

export function parseStatus(text) {
  const field = (name) =>
    text.match(new RegExp(`^${name}:\\s+(.+)$`, "m"))?.[1];
  return {
    pid: Number(field("Pid")),
    parentPid: Number(field("PPid")),
    name: field("Name"),
    rssBytes: Number(field("VmRSS")?.split(/\s+/)[0] || 0) * 1024,
  };
}

export function descendants(processes, rootPid) {
  const included = new Set([rootPid]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const item of processes) {
      if (included.has(item.parentPid) && !included.has(item.pid)) {
        included.add(item.pid);
        changed = true;
      }
    }
  }
  return processes.filter((item) => included.has(item.pid));
}

export async function memorySample(rootPid = process.pid) {
  if (process.platform !== "linux") return null;
  const readNumber = async (path) => {
    try {
      const value = Number((await readFile(path, "utf8")).trim());
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  };
  const names = await readdir("/proc");
  const processes = await Promise.all(
    names
      .filter((name) => /^\d+$/.test(name))
      .map(async (name) => {
        try {
          return parseStatus(await readFile(`/proc/${name}/status`, "utf8"));
        } catch {
          return null;
        } // A child can exit during sampling.
      }),
  );
  return {
    time: new Date().toISOString(),
    containerBytes: await readNumber("/sys/fs/cgroup/memory.current"),
    containerLimitBytes: await readNumber("/sys/fs/cgroup/memory.max"),
    processes: descendants(processes.filter(Boolean), rootPid),
  };
}

export async function logMemory() {
  try {
    const sample = await memorySample();
    if (sample) console.log("[render-memory]", JSON.stringify(sample));
  } catch {
    console.warn("[render-memory] Sample unavailable");
  }
}
