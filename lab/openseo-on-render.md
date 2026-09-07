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

Create a Git-ignored `.env` from the example. Copy DataForSEO's Base64 API credential into `DATAFORSEO_API_KEY`. This represents the API login and API password, not the website account password.

For a loopback-only local experiment, use upstream's `AUTH_MODE=local_noauth` and follow its Docker or local-development guide. Confirm the account connection with the free `GET /v3/appendix/user_data` endpoint before making a small keyword request. Record the query, returned market, and actual request cost.

**Checkpoint:** A real keyword query succeeds. You can distinguish missing data, an authentication error, and insufficient credit.

## 3. Add private team login

In Cloudflare Zero Trust, create a self-hosted Access application for your dashboard hostname, for example `seo.example.com`. Add an allow policy containing your email and your teammate's email, and enable your chosen identity provider.

Record the Access team origin as `TEAM_DOMAIN` and application audience as `POLICY_AUD`. Set `AUTH_MODE=cloudflare_access` for the hosted version. A JWT must have a valid signature, issuer, audience, expiry, subject, and email before OpenSEO accepts it.

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

## References

- [OpenSEO source and MIT license](https://github.com/every-app/open-seo)
- [DataForSEO account endpoint](https://docs.dataforseo.com/v3/appendix-user-data/)
- [Render Docker deployment](https://render.com/docs/docker)
- [Render persistent disks](https://render.com/docs/disks)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
