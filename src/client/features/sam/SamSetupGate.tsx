import { Link } from "@tanstack/react-router";
import { ShieldAlert, Wrench } from "lucide-react";
import { GateCard } from "@/client/components/GateCard";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";

export function SamSetupGate({
  errorMessage,
  isRefetching,
  onRetry,
}: {
  errorMessage: string | null;
  isRefetching: boolean;
  onRetry: () => void;
}) {
  return (
    <GateCard
      icon={Wrench}
      tone="warning"
      title="Enable AI Features"
      description={
        <>
          <p>
            SAM, OpenSEO&apos;s in-app AI agent, can use OpenAI, Anthropic, or
            OpenRouter. Choose your provider with <code>AI_PROVIDER</code>, add
            its API key and model to the deployment environment, restart
            OpenSEO, then confirm here.
          </p>
          <p className="text-xs">
            Step-by-step instructions for every deployment are in the{" "}
            <Link
              className="underline underline-offset-2 hover:text-foreground"
              to="/help/openrouter-api-key"
            >
              AI provider setup guide
            </Link>
            .
          </p>
        </>
      }
      actions={
        <>
          <Button size="lg" pending={isRefetching} onClick={onRetry}>
            Confirm API Key
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link to="/help/openrouter-api-key" />}
          >
            Set up an AI provider
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Alert variant="warning">
          <ShieldAlert />
          <AlertDescription className="text-foreground">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </GateCard>
  );
}
