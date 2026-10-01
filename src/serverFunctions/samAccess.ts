import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getChatModelConfig } from "@/server/lib/ai-model";
import { requireProjectContext } from "@/serverFunctions/middleware";

const projectScopedSchema = z.object({ projectId: z.string().min(1) });

type SamAccessStatus = {
  enabled: boolean;
  errorMessage: string | null;
};

// Validate the same provider configuration used by the chat runtime.
export const getSamAccessSetupStatus = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async (): Promise<SamAccessStatus> => {
    try {
      await getChatModelConfig();
      return { enabled: true, errorMessage: null };
    } catch (error) {
      return {
        enabled: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "AI provider configuration is incomplete.",
      };
    }
  });
