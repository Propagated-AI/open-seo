/** Operator smoke check. Uses a synthetic tool; does not call SEO APIs or read project data. */
import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import {
  buildAIChatModel,
  getChatModelConfig,
} from "../src/server/lib/ai-model";

const config = await getChatModelConfig();
try {
  const result = streamText({
    model: buildAIChatModel(config),
    prompt: "Call check_connection once, then reply with only CONNECTION_OK.",
    maxOutputTokens: 1024,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(60_000),
    stopWhen: stepCountIs(2),
    prepareStep: ({ stepNumber }) => ({
      toolChoice: stepNumber === 0 ? "required" : "none",
    }),
    tools: {
      check_connection: tool({
        description:
          "Return a synthetic connection check. This does not read or change business data.",
        inputSchema: z.object({}),
        execute: async () => ({ status: "CONNECTION_OK" }),
      }),
    },
  });
  let textChunks = 0;
  for await (const part of result.fullStream) {
    if (part.type === "error") throw part.error;
    if (part.type === "text-delta") textChunks++;
  }
  const steps = await result.steps;
  const calls = steps.flatMap((step) => step.toolResults).length;
  const text = await result.text;
  if (!calls || !textChunks || !text.includes("CONNECTION_OK"))
    throw new Error("Streaming tool round-trip was incomplete");
  console.log(
    JSON.stringify({
      provider: config.provider,
      model: config.model,
      passed: true,
      toolResults: calls,
      textChunks,
      usage: await result.totalUsage,
    }),
  );
} catch (error) {
  // SDK errors can contain request/response bodies. Never print the whole object.
  console.error(
    JSON.stringify({
      provider: config.provider,
      model: config.model,
      passed: false,
      error: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  process.exitCode = 1;
}
