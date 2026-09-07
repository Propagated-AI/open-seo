---
title: Build and Deploy Your Own SEO Dashboard
slug: openseo-on-render
brand: Propagated.ai
level: Belt 4
status: draft-pending-live-verification
source_repository: https://github.com/every-app/open-seo
source_commit: 3632f408528cd588fec98c3a174af8ea0ad205e8
license: MIT
last_verified: pending
---

# Build and Deploy Your Own SEO Dashboard

Turn OpenSEO into a private SEO dashboard that you and a teammate can use from a browser. You will connect real DataForSEO data, deploy on Render, add Cloudflare login, and learn how to preserve and back up your work.

This lab starts from an existing open-source application. You will learn to understand, configure, adapt, test, and operate it. Its keyword research, audits, backlinks, and rank tracking overlap with workflows in commercial SEO suites; their datasets and coverage are not identical.

## What you will build

A private dashboard with one shared team workspace, real keyword research, persistent project history, and scheduled rank checks. You will also produce a repeatable deployment configuration and a tested backup.

Render runs the application and database files. Cloudflare Access decides who may sign in. Caddy checks authentication before forwarding a request to OpenSEO. DataForSEO supplies external SEO data through server-side credentials.

## Before you start

You need basic Git and terminal skills, Node.js 22, pnpm 10.30.1, Python 3 for the deployment script, and accounts on GitHub, Render, Cloudflare, and DataForSEO. You need a domain managed in Cloudflare, a paid Render service with persistent disk storage, and DataForSEO credit for live queries. Check current provider prices before starting. The AI assistant and Google Search Console are optional extensions.

Use your own API credentials throughout. The instructor's dashboard and credentials are not part of the lab materials.

## 1. Inspect the application

Start from the lab's supplied repository or fork the referenced OpenSEO version and apply the Render adapter. Keep the upstream license and credit.

Locate `src/server.ts`, `wrangler.jsonc`, `Dockerfile.render`, and `deploy/render/`. Explain which parts run in the browser, which run on the server, and where persistent data lives. Notice that the default upstream Docker configuration has no login and does not run scheduled rank checks.

**Checkpoint:** You can explain why publishing the default Docker container directly is insufficient for a private team dashboard.

## 2. Connect the data provider locally

Copy `deploy/render/operator.env.example` to a Git-ignored `.env` on your own computer. Copy DataForSEO's Base64 API credential into `DATAFORSEO_API_KEY`. This represents the API login and API password, not the website account password. Keep a separate environment file for the local experiment so its authentication setting cannot accidentally be reused for hosting.

For a loopback-only local experiment, use upstream's `AUTH_MODE=local_noauth` and follow its Docker or local-development guide. Confirm the account connection with the free `GET /v3/appendix/user_data` endpoint before making a small keyword request. Record the query, returned market, and actual request cost.

**Checkpoint:** A real keyword query succeeds. You can distinguish missing data, an authentication error, and insufficient credit.

## 3. Add private team login

In Cloudflare Zero Trust, create a self-hosted Access application for your dashboard hostname, for example `seo.example.com`. Add an allow policy containing your email and your teammate's email, and enable your chosen identity provider.

Record the Access team origin as `TEAM_DOMAIN` and application audience as `POLICY_AUD`. Set `AUTH_MODE=cloudflare_access` for the hosted version. A JWT must have a valid signature, issuer, audience, expiry, subject, and email before OpenSEO accepts it.

To configure Access through the supplied API helper, create a scoped Cloudflare token. In the account-token form verified on 7 September 2026, add two separate permission policies. For the account, choose Cloudflare One / Zero Trust → Access → Edit and Access: Organizations, Identity Providers, and Groups → Edit. For the selected domain, choose DNS → Edit and Zone → Read. Keep both policies in the final summary; changing the first policy's resource to a domain can remove its account permissions. Store the token as `CLOUDFLARE_API_TOKEN` and its account ID as `CLOUDFLARE_ACCOUNT_ID` in the operator environment file. The helper verifies account-owned tokens at the account-specific endpoint and checks the domain belongs to that account.

If Zero Trust has not been enabled, complete Cloudflare's onboarding first. The Free plan supports this two-person exercise. The activation screen may require billing information, agreement to terms, and authorization for usage beyond free limits; the account owner must review and complete this step. A token can verify as active while still lacking the permissions or enabled products needed for Access setup.

First inspect the existing configuration:

```bash
python3 deploy/render/cloudflare_setup.py \
  --env-file /absolute/path/to/your/.env \
  --state /absolute/path/to/cloudflare-state.json \
  --zone example.com --domain seo.example.com inspect
```

Then replace the example addresses with your two approved users and provision the application:

```bash
python3 deploy/render/cloudflare_setup.py \
  --env-file /absolute/path/to/your/.env \
  --state /absolute/path/to/cloudflare-state.json \
  --zone example.com --domain seo.example.com \
  --team-name your-unique-team-name \
  provision --emails you@example.com teammate@example.com
```

The helper reuses the account's existing Zero Trust team, enables email PIN if needed, and saves `TEAM_DOMAIN` and `POLICY_AUD` into the operator file. It stops when an existing hostname or policy conflicts instead of replacing unrelated configuration. An account that has not completed Zero Trust onboarding may require that setup in the Cloudflare dashboard first.

The adapter protects application pages, API calls, MCP, and backup operations through the same gateway. `/healthz` returns only readiness; it grants no dashboard access.

**Checkpoint:** Write down the expected response for an approved user, an unapproved user, and an unauthenticated request to the direct Render hostname.

## 4. Deploy through the Render API

Create a repository under your own account. Review `render.yaml` and the deployment script. Configure only the required app secrets listed in `deploy/render/README.md`; keep the Render API token on your local machine.

Run the deployment script with your own paths and repository:

```bash
python3 deploy/render/manage.py \
  --env-file /absolute/path/to/your/.env \
  --state /absolute/path/to/render-state.json \
  --repo https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY \
  --name your-openseo \
  create
```

Use `status` and `logs` to inspect the deployment. Attach your domain, create the proxied Cloudflare CNAME to Render, and complete HTTPS verification. Keep the disk mounted at `/app/.wrangler`.

Use `manage.py` with `--domain seo.example.com add-domain` to attach the hostname. Then run `cloudflare_setup.py` with your same environment, state, zone, and domain arguments plus `--render-host YOUR-SERVICE.onrender.com --dns-only dns`. Use `manage.py --domain seo.example.com verify-domain` with the same operator file and Render state file to request verification. Once verified and HTTPS works, rerun the Cloudflare helper without `--dns-only` so the hostname uses the Access proxy. Use the exact service hostname returned by Render. Both scripts keep management tokens on your computer; OpenSEO still enforces JWT authentication during DNS verification.

**Checkpoint:** The service is healthy, your custom hostname opens the login flow, and the direct Render address does not bypass it.

## 5. Make the dashboard useful

Create a project for a website you control. Choose an explicit country and language so the keyword data has a clear meaning. Research a small topic, inspect one competitor, examine backlinks, and run a bounded site audit. Add a few keywords to rank tracking.

Make a simple decision from the results: choose one content page to create or improve. Explain which query it targets, what the searcher wants, and what the page should help them accomplish. Do not infer that a low search-volume result means a new tool has no educational value.

**Checkpoint:** You have saved research, a useful next action, and a record of API spending.

## 6. Verify scheduling and persistence

Configure a small rank-tracking schedule. Inspect `/_ops/status`, then confirm that a due check produces a saved rank result. Restart the service and verify your project and results remain. Repeat after a deployment.

The supervisor invokes the upstream scheduling service every five minutes. An invocation with no due keywords is successful maintenance, but is not proof that a paid ranking check completed.

**Checkpoint:** You can show a completed scheduled result and explain why the persistent disk is necessary.

## 7. Back up and restore

Use the authenticated `POST /_ops/backup` operation to download the full state archive. The app pauses briefly so the archive contains a consistent set of files. Store the archive privately outside the Render disk.

Follow the runbook to restore into a separate stopped test instance. Check SQLite integrity and confirm that saved projects and research appear. Keep runtime credentials separate from the archive; encrypted Google tokens require the same encryption secret.

**Checkpoint:** You have demonstrated restoration, not merely downloaded an archive.

The instructor's local verification restored 16 SQLite databases with successful integrity checks, then opened the restored dashboard and read the saved rank result and completed 10-page audit. This establishes the local restore path. Live Render restoration and team authentication remain separate publication checks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Direct Render URL returns 401 | Expected: sign in through the Access-protected hostname. |
| Login succeeds but dashboard rejects access | Verify the exact Access team origin and application audience. |
| Data disappears after deployment | Confirm the persistent disk mount and unchanged upstream storage identifiers. |
| API credential changed but old configuration remains | Check the supervisor's runtime `.dev.vars` installation and restart the service. |
| Maintenance runs but no rankings appear | Verify the keywords, next due time, workflow result, and DataForSEO balance. |
| Backup returns 409 | A maintenance tick or backup is running; retry after it completes. |
| AI assistant or Search Console is unavailable | Add the optional provider-specific configuration; core research uses DataForSEO. |

## What to build next

Use the dashboard to evaluate a new AI lab topic. Compare searches for the repository name with searches for the problem it solves. Propose a public lab overview and explain the evidence behind it.

An optional next exercise is connecting an AI agent through OpenSEO's MCP server. Use the AI Engineer Agentic Track as the relevant course follow-on when adding the final approved Propagated.ai course link.

## Cleanup and maintenance

Stop paid tracking schedules before leaving an installation unused. Download a backup before deleting a Render service or disk. Remove only the DNS records and Access application created for this lab, and revoke temporary deployment tokens when they are no longer needed. Review the lab against a pinned upstream version before publishing updates.

For the initial verification, use one keyword, one market, one device, and a 10-page audit with Lighthouse off. Return rank tracking to manual after the scheduling exercise. The instructor observed a $0.140656 DataForSEO account balance decrease during the local verification window; this is not a fixed lab price or an isolated request-cost measurement. Record your own usage and consult current provider pricing before expanding the workload.

Before publication, replace the pending last-verified date with the date of the full live check and record the exact adapter commit. Recheck monthly and after upstream, provider API, or hosting changes; mark the lab as needing an update if a checkpoint fails.

## References

- [OpenSEO source and MIT license](https://github.com/every-app/open-seo)
- [DataForSEO account endpoint](https://docs.dataforseo.com/v3/appendix-user-data/)
- [Render Docker deployment](https://render.com/docs/docker)
- [Render persistent disks](https://render.com/docs/disks)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
