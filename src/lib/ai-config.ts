import { z } from "zod";

export const AI_CHAT_ENV_KEYS = [
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
] as const;

const providerSchema = z.enum(["openai", "anthropic", "openrouter"]);
export type AIProvider = z.infer<typeof providerSchema>;

export type ChatModelConfig = {
  provider: AIProvider;
  apiKey: string;
  model: string;
};

// Keep existing installations on OpenRouter unless the operator chooses otherwise.
// Direct providers require an explicit model, so model changes are deliberate.
export function resolveChatModelConfig(
  env: Record<string, string | undefined>,
): ChatModelConfig {
  const parsed = providerSchema.safeParse(
    env.AI_PROVIDER?.trim() || "openrouter",
  );
  if (!parsed.success) {
    throw new Error("Set AI_PROVIDER to openai, anthropic, or openrouter.");
  }
  const provider = parsed.data;
  // Hosted credit billing relies on OpenRouter's actual per-response USD cost.
  // Direct-provider keys are supported by self-hosted deployments, billed by the provider.
  if (env.AUTH_MODE === "hosted" && provider !== "openrouter") {
    throw new Error(
      "Direct AI providers require self-hosted mode. Hosted credit billing uses OpenRouter.",
    );
  }
  const prefix = provider.toUpperCase();
  const apiKey = env[`${prefix}_API_KEY`]?.trim();
  if (!apiKey) {
    throw new Error(
      `Set ${prefix}_API_KEY for the selected AI provider, then restart OpenSEO.`,
    );
  }
  const model =
    env[`${prefix}_MODEL`]?.trim() ||
    (provider === "openrouter" ? "openai/gpt-5.6-luna" : undefined);
  if (!model) {
    throw new Error(
      `Set ${prefix}_MODEL to a model available in your provider account, then restart OpenSEO.`,
    );
  }
  return { provider, apiKey, model };
}
