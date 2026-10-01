import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { helpLinkClassName } from "@/client/features/help/SecretHelpPage";

// Preserve existing bookmarks to the former OpenRouter-only guide.
export const Route = createFileRoute("/_app/help/openrouter-api-key")({
  component: AIProviderHelpPage,
});

const PROVIDERS = [
  {
    name: "OpenAI",
    keysUrl: "https://platform.openai.com/api-keys",
    value: "openai",
    secret: "OPENAI_API_KEY",
    model: "OPENAI_MODEL",
  },
  {
    name: "Anthropic",
    keysUrl: "https://console.anthropic.com/settings/keys",
    value: "anthropic",
    secret: "ANTHROPIC_API_KEY",
    model: "ANTHROPIC_MODEL",
  },
  {
    name: "OpenRouter",
    keysUrl: "https://openrouter.ai/settings/keys",
    value: "openrouter",
    secret: "OPENROUTER_API_KEY",
    model: "OPENROUTER_MODEL",
  },
] as const;

function AIProviderHelpPage() {
  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Set up your AI provider"
          description={
            <>
              SAM, the in-app SEO agent, can use your OpenAI, Anthropic, or
              OpenRouter account. Choose one provider for this deployment; you
              can keep the other keys saved for later comparisons. Everything
              else in OpenSEO works without it.
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>1. Choose a provider</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>AI_PROVIDER</TableHead>
                  <TableHead>Secret</TableHead>
                  <TableHead>Model setting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PROVIDERS.map((provider) => (
                  <TableRow key={provider.value}>
                    <TableCell>
                      <a
                        className={helpLinkClassName}
                        href={provider.keysUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {provider.name}
                      </a>
                    </TableCell>
                    <TableCell>
                      <code>{provider.value}</code>
                    </TableCell>
                    <TableCell>
                      <code>{provider.secret}</code>
                    </TableCell>
                    <TableCell>
                      <code>{provider.model}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-muted-foreground">
              Use the exact model ID from your provider. Direct OpenAI and
              Anthropic IDs do not use OpenRouter prefixes. OpenRouter IDs use
              the provider/model format for models in its catalog. Choose a
              model that supports streaming and tool calls for SAM.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>2. Save the settings and restart</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Add <code>AI_PROVIDER</code>, the selected provider’s API key,
                and its model setting from the table to your environment:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Local development: <code>.env.local</code>
                  </li>
                  <li>
                    Docker self-hosting: <code>.env</code>
                  </li>
                  <li>
                    Render: the service’s <strong>Environment</strong> page
                  </li>
                  <li>
                    Cloudflare Workers:{" "}
                    <strong>Settings → Variables &amp; Secrets</strong>, marking
                    API keys as secrets
                  </li>
                </ul>
              </li>
              <li>Restart or redeploy OpenSEO and wait until it is live.</li>
              <li>
                Return to the chat page and click{" "}
                <strong>Confirm API Key</strong> if the setup screen is still
                open.
              </li>
              <li>
                Start a new chat for each model comparison. Ask SAM to read the
                project context to check that tool calls work.
              </li>
            </ol>
            <p className="text-muted-foreground">
              Changing providers requires a restart. A missing or invalid key
              does not trigger a switch to another account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Usage and troubleshooting</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              Your selected provider bills model usage. Server logs record the
              provider, model, and token counts under <code>[chat-usage]</code>.
              Direct-provider dollar costs are left unknown; check the
              provider’s usage dashboard for charges.
            </p>
            <p>
              OpenRouter remains the default when <code>AI_PROVIDER</code> is
              omitted, preserving existing installations. Direct providers
              require an explicit model setting. The subscription-based hosted
              edition still uses OpenRouter for credit billing.
            </p>
            <p>
              If a request fails, check that the selected model supports
              streaming and tools, your API account has credit, and the key has
              model access. Confirming a key checks configuration; the first
              chat verifies the provider connection.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
