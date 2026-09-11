import type { LanguageModelV3 } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel, defaultSettingsMiddleware } from "ai";
import {
  AI_CHAT_ENV_KEYS,
  resolveChatModelConfig,
  type ChatModelConfig,
} from "@/lib/ai-config";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import { getOptionalEnvValue, getEnvValueSync } from "@/server/lib/runtime-env";

export function getChatModelConfigSync(env: object): ChatModelConfig {
  return resolveChatModelConfig(
    Object.fromEntries(
      [...AI_CHAT_ENV_KEYS, "AUTH_MODE"].map((name) => [
        name,
        getEnvValueSync(env, name),
      ]),
    ),
  );
}

export async function getChatModelConfig(): Promise<ChatModelConfig> {
  return resolveChatModelConfig(
    Object.fromEntries(
      await Promise.all(
        [...AI_CHAT_ENV_KEYS, "AUTH_MODE"].map(
          async (name) => [name, await getOptionalEnvValue(name)] as const,
        ),
      ),
    ),
  );
}

// Think's getModel hook is synchronous. Defer the provider import to the first
// model operation, keeping both SDKs out of the worker's eager startup graph.
export function buildAIChatModel(
  config: ChatModelConfig,
  reasoningEffort: "max" | "low" = "max",
): LanguageModelV3 {
  if (config.provider === "openrouter") {
    return buildChatAgentModel(config.apiKey, config.model, reasoningEffort);
  }
  let loaded: Promise<LanguageModelV3> | undefined;
  const load = async (): Promise<LanguageModelV3> => {
    if (config.provider === "openai") {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return wrapLanguageModel({
        model: createOpenAI({ apiKey: config.apiKey }).responses(config.model),
        middleware: defaultSettingsMiddleware({
          settings: { providerOptions: { openai: { store: false } } },
        }),
      });
    }
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    return createAnthropic({ apiKey: config.apiKey })(config.model);
  };
  const get = () => (loaded ??= load());
  return {
    specificationVersion: "v3",
    provider:
      config.provider === "openai" ? "openai.responses" : "anthropic.messages",
    modelId: config.model,
    get supportedUrls() {
      return get().then((model) => model.supportedUrls);
    },
    doGenerate: async (options) => (await get()).doGenerate(options),
    doStream: async (options) => (await get()).doStream(options),
  };
}
