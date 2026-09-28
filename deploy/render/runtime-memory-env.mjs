// These budgets apply to runtime children, not the Docker build. workerd has
// multiple isolates and native allocations: its heap setting is NOT an RSS cap.
// Full collections also sweep request-scoped C++ objects that minor GCs miss.
export function runtimeMemoryEnv(env) {
  const budget = (name, fallback) => {
    const value = env[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < 128 || Number(value) > 1024) {
      throw new Error(`${name} must be an integer from 128 to 1024 MiB`);
    }
    return Number(value);
  };
  const node = budget("RENDER_NODE_HEAP_MB", 512);
  const worker = budget("RENDER_WORKER_HEAP_MB", 256);
  return {
    NODE_OPTIONS:
      `${env.NODE_OPTIONS || ""} --max-old-space-size=${node}`.trim(),
    MINIFLARE_WORKERD_V8_FLAGS: `--max-old-space-size=${worker} --gc-global`,
  };
}
