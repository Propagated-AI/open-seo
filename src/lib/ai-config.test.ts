import { describe, expect, it } from "vitest";
import { resolveChatModelConfig } from "./ai-config";
import { runSelfhostChecks } from "./selfhost-preflight";

describe("AI provider selection", () => {
  it("preserves existing OpenRouter installations", () => {
    expect(
      resolveChatModelConfig({ OPENROUTER_API_KEY: "router-key" }),
    ).toEqual({
      provider: "openrouter",
      apiKey: "router-key",
      model: "openai/gpt-5.6-luna",
    });
  });
  it.each(["openai", "anthropic", "openrouter"])(
    "uses only the explicitly selected %s key and model",
    (provider) => {
      const config = resolveChatModelConfig({
        AI_PROVIDER: provider,
        OPENAI_API_KEY: "openai-key",
        OPENAI_MODEL: "openai-model",
        ANTHROPIC_API_KEY: "anthropic-key",
        ANTHROPIC_MODEL: "anthropic-model",
        OPENROUTER_API_KEY: "openrouter-key",
        OPENROUTER_MODEL: "openrouter-model",
      });
      expect(config).toEqual({
        provider,
        apiKey: `${provider}-key`,
        model: `${provider}-model`,
      });
    },
  );
  it("does not fall back to another account when the selected key is missing", () => {
    expect(() =>
      resolveChatModelConfig({
        AI_PROVIDER: "anthropic",
        OPENAI_API_KEY: "other-secret",
      }),
    ).toThrow("ANTHROPIC_API_KEY");
  });
  it("requires an explicit model for a direct provider", () => {
    expect(() =>
      resolveChatModelConfig({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "secret",
      }),
    ).toThrow("OPENAI_MODEL");
  });
  it("rejects invalid provider values without reflecting them", () => {
    expect(() =>
      resolveChatModelConfig({ AI_PROVIDER: "accidental-secret" }),
    ).toThrow("Set AI_PROVIDER to openai, anthropic, or openrouter.");
  });
  it("keeps hosted credit billing from recording direct-provider usage as free", () => {
    expect(() =>
      resolveChatModelConfig({
        AUTH_MODE: "hosted",
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "secret",
        OPENAI_MODEL: "model",
      }),
    ).toThrow("Hosted credit billing uses OpenRouter");
  });
  it("reports direct providers as configured in health checks without exposing keys", () => {
    const checks = runSelfhostChecks({
      AUTH_MODE: "local_noauth",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "secret-value",
      OPENAI_MODEL: "test-model",
    });
    expect(checks.find((item) => item.key === "ai")).toMatchObject({
      level: "ok",
      message: "openai / test-model configured",
    });
    expect(JSON.stringify(checks)).not.toContain("secret-value");
  });
});
