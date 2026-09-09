# Private team deployment on Render

This adaptation keeps the upstream OpenSEO application and shared-workspace model. Render runs the container and stores its data; Cloudflare Access authenticates the approved team members. The upstream MIT license and attribution are retained.

## Components

- `Dockerfile.render`: builds the app before deployment, includes Caddy 2.11.4 with its unneeded low-port file capability removed for Render compatibility, and starts the supervisor.
- `Caddyfile`: exposes only port 10000; authenticates every application and operations request through OpenSEO's Cloudflare JWT verifier. `/healthz` exposes only readiness. Internal scheduling and Cloudflare development endpoints are blocked publicly.
- `supervisor.mjs`: installs the runtime bindings into the two built Workers, migrates the persistent database, supervises Caddy and OpenSEO, invokes scheduled work every five minutes, and produces consistent backups.
- `manage.py`: creates and inspects the service through the Render API without printing credentials.
- `render.yaml`: reusable Blueprint equivalent to the API deployment.

Render terminates public HTTPS before forwarding HTTP to Caddy. The protected proxy handlers explicitly set `X-Forwarded-Proto: https` so Google callbacks, MCP origins, and operations checks use the public scheme. This Render configuration assumes HTTPS at the external edge. Validate it with `CADDY_BINARY=/path/to/caddy python3 -m unittest discover -s deploy/render -p test_caddy.py`; the test uses temporary loopback backends on ports 3101 and 3102.

The app and operations listener bind to loopback ports 3101 and 3102. Caddy is the sole public listener. Both the custom hostname and direct Render address therefore require a valid Cloudflare Access token. A healthy container alone does not prove that user login or paid SEO endpoints work; verify them separately.

## Required configuration

Set these as Render runtime environment variables:

| Variable | Value |
| --- | --- |
| `DATAFORSEO_API_KEY` | Base64-encoded DataForSEO API login and API password |
| `AUTH_MODE` | `cloudflare_access` |
| `TEAM_DOMAIN` | Your `https://TEAM.cloudflareaccess.com` origin |
| `POLICY_AUD` | Audience of the Access application covering the dashboard |
| `RENDER_MAINTENANCE_KEY` | Random secret, at least 32 characters |
| `BETTER_AUTH_SECRET` | Random secret for future encrypted Google OAuth tokens |
| `CLOUDFLARE_INCLUDE_PROCESS_ENV` | `true` |
| `OPENSEO_TELEMETRY_DISABLED` | `1` |
| `VITE_SHOW_DEVTOOLS` | `false` |
| `PORT` | `10000` |

Optional: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Search Console; `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` for SAM. Configure only the integrations you intend to use. Do not forward unrelated keys from your general-purpose `.env` to Render.

The Cloudflare provisioning token and Render management token belong on the operator's machine, not in the application's Render environment. The startup script rewrites build-generated `.dev.vars` from an explicit allowlist so runtime credential changes take effect without rebuilding. It also restores the current image's Worker deployment manifest into `.wrangler/deploy/config.json`, because the persistent disk hides files built at that path.

## Deployment

1. Create a private repository containing this source. Choose a tested commit and keep automatic deployment disabled.
2. Create a Cloudflare Access self-hosted application for the chosen hostname. Allow exactly the intended team emails. Enable an appropriate identity provider, such as one-time PIN. Record its audience and team origin.
3. Put the management and app configuration in a local, Git-ignored environment file.
4. Run `python3 deploy/render/manage.py --env-file /absolute/path/to/.env --state /absolute/path/to/render-state.json create`. Override `--repo`, `--name`, `--region`, and `--plan` for your installation. The script requires an unambiguous Render workspace and reuses a same-name service only if its repository matches.
5. Inspect with the same arguments and `status` or `logs` in place of `create`.
6. Attach the custom hostname using `add-domain`. Run the Cloudflare helper's `dns` action with `--render-host YOUR-SERVICE.onrender.com --dns-only` for initial certificate issuance, then use `manage.py --domain YOUR-HOSTNAME verify-domain`. Once verification succeeds and Render serves valid HTTPS, rerun the Cloudflare `dns` action without `--dns-only` to enable Access proxying. The application's own JWT gate remains enforced throughout. Use strict HTTPS between Cloudflare and Render once the certificate is ready.
7. Confirm both approved users can sign in, an unapproved user is denied, and the direct Render URL rejects unauthenticated requests.

Use a paid instance and a 1 GB disk at `/app/.wrangler`. The initial API plan is `1c-2g`; measure memory and use current Render pricing when selecting or changing it. Build time and runtime requirements differ. A persistent disk permits one service instance and causes brief downtime during deployment.

## Operations

Visit `/_ops/status` on the authenticated dashboard hostname to see the last scheduled maintenance result. The supervisor checks due rank schedules and reconciles stale audits every five minutes. Only due keyword configurations generate rank API work; no tracking list is enabled automatically by this adapter. Check the Rank Tracking page to confirm results, not just the maintenance timestamp.

For a consistent backup, send an authenticated `POST /_ops/backup`. It briefly stops the app, archives the complete `.wrangler` state, restarts, waits for database readiness, and returns `openseo-state.tar.gz`. Backups contain private data and potentially encrypted integration tokens: keep them private and store a copy outside the Render disk. No API credentials are added to the archive by this adapter. The original `BETTER_AUTH_SECRET` is still needed to decrypt stored OAuth tokens after restoration.

Restore to a separate instance first: stop its app, extract the archive into `/app` so `.wrangler` lands at the configured disk mount, restore the corresponding runtime credentials, then start the same tested code revision. Verify database integrity, saved projects, and results before replacing a production instance. Do not extract archives over a running database. On macOS, ignore AppleDouble `._*` archive metadata when checking SQLite files.

Before an update, download a backup, record the running commit, inspect upstream changes, build and test locally, and deploy the selected revision with `manage.py --commit SHA deploy`. A database migration may require restoring the matching backup when rolling back; reverting application code alone is not always sufficient.

## Validation checklist

- Production build, type checking, relevant unit tests, and changed-file lint pass.
- Both approved identities see the same project and saved research.
- Unauthenticated and forged-token requests cannot read app data, trigger API work, or download backups.
- Core keyword/domain/backlink/audit/rank workflows return real data or a documented account prerequisite.
- Restart and redeploy preserve saved data.
- A due scheduled rank check persists its result.
- A backup restores successfully to isolated state.
- Credentials stay out of source, client bundles, screenshots, and reports.

See the verification report for what was actually tested on the deployed instance.
