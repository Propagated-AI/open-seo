import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeMemoryEnv } from "./runtime-memory-env.mjs";

test("sets separate Node and workerd GC budgets without copying secrets", () => {
  assert.deepEqual(runtimeMemoryEnv({ OPENAI_API_KEY: "do-not-copy" }), {
    NODE_OPTIONS: "--max-old-space-size=512",
    MINIFLARE_WORKERD_V8_FLAGS: "--max-old-space-size=256 --gc-global",
  });
});
test("preserves other Node options and puts the runtime budget last", () => {
  assert.equal(
    runtimeMemoryEnv({
      NODE_OPTIONS: "--enable-source-maps --max-old-space-size=8192",
      RENDER_NODE_HEAP_MB: "384",
    }).NODE_OPTIONS,
    "--enable-source-maps --max-old-space-size=8192 --max-old-space-size=384",
  );
});
test("rejects malformed or impractical budgets before spawning children", () => {
  for (const value of [
    "0",
    "127",
    "1025",
    "256 --expose-gc",
    "NaN",
    "1.5",
    "",
  ]) {
    assert.throws(() => runtimeMemoryEnv({ RENDER_WORKER_HEAP_MB: value }));
  }
});
