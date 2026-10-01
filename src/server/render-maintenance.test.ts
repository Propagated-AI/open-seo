import { describe, expect, it, vi } from "vitest";
import { handleRenderMaintenance } from "./render-maintenance";

describe("Render maintenance authorization", () => {
  const secret = "s".repeat(48);
  it.each([undefined, "", "wrong", "x".repeat(48)])(
    "rejects unauthorized ticks without invoking paid work: %s",
    async (key) => {
      const run = vi.fn();
      const response = await handleRenderMaintenance(
        new Request("http://localhost/_internal/render-tick", {
          method: "POST",
          headers: key ? { "x-render-maintenance-key": key } : {},
        }),
        secret,
        run,
      );
      expect(response.status).toBe(404);
      expect(run).not.toHaveBeenCalled();
    },
  );
  it("rejects GET and an unconfigured deployment", async () => {
    const run = vi.fn();
    for (const [method, configured] of [
      ["GET", secret],
      ["POST", undefined],
    ] as const) {
      const response = await handleRenderMaintenance(
        new Request("http://localhost", {
          method,
          headers: { "x-render-maintenance-key": secret },
        }),
        configured,
        run,
      );
      expect(response.status).toBe(404);
    }
    expect(run).not.toHaveBeenCalled();
  });
  it("runs the maintenance callback only after authentication", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const response = await handleRenderMaintenance(
      new Request("http://localhost", {
        method: "POST",
        headers: { "x-render-maintenance-key": secret },
      }),
      secret,
      run,
    );
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
  });
});
