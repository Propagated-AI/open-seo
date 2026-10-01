# Propagated AI edition of OpenSEO

This repository is a fork of [every-app/open-seo](https://github.com/every-app/open-seo). The MIT licence and copyright notice stay in `LICENSE`. `main` follows upstream unchanged; the `lab-edition` branch adds what Propagated AI uses for its OpenSEO lab and team dashboard.

Base: upstream **v0.1.10** (`95c4d10c`, 30 September 2026).

## What lab-edition adds

- **Render hosting** (optional): `Dockerfile.render`, `render.yaml` and `deploy/render/` — a process supervisor, a Caddy gateway, a persistent disk at `/app/.wrangler`, a five-minute maintenance tick in place of Cloudflare cron, and `manage.py` for the Render API.
- **Memory limits for long runs on Render**: Node heap 512 MiB and workerd heap 256 MiB with full garbage collection (`--gc-global`), both adjustable with `RENDER_NODE_HEAP_MB` and `RENDER_WORKER_HEAP_MB`. A Miniflare patch (`patches/`, a backport of workers-sdk PR #14702) passes the V8 flags to workerd. The unused development registry is off, and the supervisor logs memory once a minute. See `deploy/render/README.md`.
- **Cloudflare Access** in front of the Render service (optional): `deploy/render/cloudflare_setup.py`.
- **Google sign-in behind a proxy**: Google callbacks keep the public HTTPS hostname.
- **Direct OpenAI and Anthropic keys** for Sam, as well as OpenRouter. Choose with `AI_PROVIDER`; OpenRouter stays the default. See `/help/openrouter-api-key` in the app.
- **TanStack devtools pinned to 0.10.8.** Upstream v0.1.10 ships 0.10.12, whose `@tanstack/devtools-ui` 0.7.1 imports `use` from the server build of `solid-js`, so `pnpm dev` stops during dependency optimisation on a fresh install.
- **Instructor notes** in `lab/`.

## Running it

On your own computer, follow upstream's `docs/LOCAL_DEVELOPMENT.md`; nothing here is needed for that. Render and Cloudflare are the hosts we use in our walkthrough. Upstream also documents Docker and Cloudflare Workers, and the Docker route runs on any host that runs containers.

## Updating from upstream

```sh
git fetch upstream --tags
git rebase --onto <new-tag> <old-base> lab-edition
pnpm install && pnpm test && pnpm lint
node --test deploy/render/*.test.mjs
(cd deploy/render && python3 -m unittest test_manage test_caddy)
```

Then start `pnpm dev` once with `AUTH_MODE=local_noauth`; upstream CI does not.
