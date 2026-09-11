import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAIChatModel,
  getChatModelConfigSync,
  getChatModelConfig,
} from "./ai-model";
import { logChatUsage } from "./chatAgent";

vi.mock("cloudflare:workers", () => ({ env: {} }));
afterEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllEnvs());

function requestBody(request: RequestInit | undefined): unknown {
  if (typeof request?.body !== "string")
    throw new Error("Expected JSON request body");
  return JSON.parse(request.body);
}

const prompt = [
  {
    role: "user" as const,
    content: [{ type: "text" as const, text: "hello" }],
  },
];

describe("AI model adapters", () => {
  it("routes OpenAI directly through Responses and disables response storage", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_test",
          created_at: 1,
          model: "test-model",
          status: "completed",
          output: [],
          usage: { input_tokens: 2, output_tokens: 0, total_tokens: 2 },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await buildAIChatModel({
      provider: "openai",
      apiKey: "openai-secret",
      model: "test-model",
    }).doGenerate({ prompt });
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(request?.headers).get("authorization")).toBe(
      "Bearer openai-secret",
    );
    expect(requestBody(request)).toMatchObject({
      model: "test-model",
      store: false,
    });
  });
  it("routes Anthropic directly with its own authentication", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "test-model",
          content: [{ type: "text", text: "hello" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 2, output_tokens: 1 },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await buildAIChatModel({
      provider: "anthropic",
      apiKey: "anthropic-secret",
      model: "test-model",
    }).doGenerate({ prompt, maxOutputTokens: 32 });
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(request?.headers).get("x-api-key")).toBe(
      "anthropic-secret",
    );
    expect(requestBody(request)).toMatchObject({
      model: "test-model",
    });
  });
  it("keeps arbitrary OpenRouter models usable without forcing OpenAI reasoning settings", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chat_test",
          created: 1,
          model: "deepseek/test-model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "hello" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await buildAIChatModel({
      provider: "openrouter",
      apiKey: "router-secret",
      model: "deepseek/test-model",
    }).doGenerate({ prompt });
    const [url, request] = fetch.mock.calls[0];
    expect(url).toContain("openrouter.ai/api/v1/chat/completions");
    expect(new Headers(request?.headers).get("authorization")).toBe(
      "Bearer router-secret",
    );
    expect(requestBody(request)).toMatchObject({
      model: "deepseek/test-model",
      usage: { include: true },
    });
    expect(requestBody(request)).not.toHaveProperty("reasoning");
  });
  it("resolves the same settings for Durable Objects and server functions", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "runtime-key");
    vi.stubEnv("OPENAI_MODEL", "runtime-model");
    expect(getChatModelConfigSync({ OPENAI_API_KEY: "stale-binding" })).toEqual(
      await getChatModelConfig(),
    );
  });
  it("logs direct token usage with unknown cost and no secret or response content", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    logChatUsage(
      { provider: "openai", model: "test" },
      { inputTokens: 4, outputTokens: 2, totalTokens: 6, secret: "never-log" },
      { openrouter: { usage: { cost: 99 } } },
    );
    expect(JSON.parse(String(log.mock.calls[0][1]))).toEqual({
      provider: "openai",
      model: "test",
      inputTokens: 4,
      outputTokens: 2,
      totalTokens: 6,
      costUsd: null,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("never-log");
  });
});
