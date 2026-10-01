# Enable SAM with your own AI account

The private Render deployment supports direct OpenAI, direct Anthropic, and OpenRouter. One explicitly selected provider serves SAM and onboarding chat. API keys stay on the server.

## 1. Choose a provider and model

| Provider | AI_PROVIDER | API key secret | Model setting |
| --- | --- | --- | --- |
| OpenAI | `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |

Use an exact model ID available to your API account, with streaming and tool-calling support. Direct IDs do not have the OpenRouter `provider/` prefix. Models and provider availability can change; copy IDs from the provider dashboard.

The deployed starting configuration is `AI_PROVIDER=openai` and `OPENAI_MODEL=gpt-5.6-luna`, verified against the operator's model list. This is a deployment choice, not a fixed default for every student.

## 2. Configure Render

1. Open the Render dashboard and select your OpenSEO web service.
2. Open **Environment**.
3. Add `AI_PROVIDER` with the value from the table.
4. Add the corresponding API key as an environment secret and the corresponding model setting.
5. Save and redeploy. Wait until the deployment reports **Live**.
6. Open your project, switch to **Chat**, and click **Confirm API Key** if the setup gate remains visible.
7. Start a new chat. Ask SAM to read the current project context and summarize it. A reply and successful tool call confirm that the provider can run the agent.

For local development, use `.env.local`; for Docker, pass runtime environment variables. Cloudflare deployments use **Settings → Variables & Secrets**. Never commit real credentials to these examples or include them in student screenshots.

## 3. Compare providers later

Keep all three keys saved if desired. Change `AI_PROVIDER` and the chosen provider's model setting, then restart/redeploy. Start a new chat and repeat the same prompt to compare results without mixing conversation history. Selecting OpenRouter preserves access to its model catalog, including tool-capable Chinese models. Do not copy a direct-provider key into `OPENROUTER_API_KEY`.

Existing installations that omit `AI_PROVIDER` retain OpenRouter and its previous default model. Direct providers require an explicit model. Missing credentials fail with a setup message; the app never silently bills a different provider.

## Usage and verification

Your selected provider bills usage directly. `[chat-usage]` entries in Render logs record provider, model, and token counts without prompts, responses, or keys. OpenRouter's reported cost is retained; direct-provider dollar cost is `null` (unknown), not zero. Check provider dashboards for actual charges. Subscription-based hosted mode retains OpenRouter because its credit billing needs per-response costs; this limitation does not affect the private Render deployment.

The operator can run `pnpm exec tsx scripts/check-ai-provider.ts` with the selected provider's runtime environment loaded. It makes a small billable model request and tests a synthetic tool plus streaming response. It does not call DataForSEO or read project data.

Troubleshooting:

- **Setup gate remains:** confirm the selected provider's key and model exist on Render, not only in your local `.env`, and that the new deployment is live.
- **401/403:** check key validity, account permissions, and model access.
- **429:** check provider credits and rate limits.
- **Model/tool error:** use a chat model that supports streaming and tool calls; verify the exact provider-specific ID.
- **Newly added key changes nothing:** this is intentional. `AI_PROVIDER` controls selection.

Render gateway note: the Caddy `forward_auth` subrequest must strip `Upgrade` and `Connection`. The actual application proxy retains these headers for chat WebSockets. Without this separation, normal pages can work while chat messages never reach SAM. The gateway regression test covers both unauthorized rejection and an authorized WebSocket handshake/data frame.
