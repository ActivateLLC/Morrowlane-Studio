# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                 # pnpm monorepo (workspace:* deps)
pnpm dev                     # web app on :3000
pnpm dev:api                 # attribution ingestion API on :4000
pnpm dev:worker              # background job worker (optional locally — jobs also run inline)
pnpm test                    # ALL unit tests — vitest MUST run from the repo root
npx vitest run packages/agents/src/pipeline.test.ts   # single test file (still from root)
pnpm build                   # packages first, then the web app
pnpm typecheck               # per-package tsc (there is no root tsconfig — `tsc -b` at root fails)
```

- Vitest only works from the repo root; the root `vitest` resolves workspace TS source directly.
- E2E: Playwright specs live in `apps/web/e2e/`; the runner is at
  `/opt/node22/lib/node_modules/playwright/index.mjs` in the remote container. Start the web app on a
  spare port (e.g. 3100) and check the log for "Ready in" — `EADDRINUSE` can be hidden by a stale
  server on the port. Kill dev servers by PID via `pgrep -f "next[-]server"` (the bracket prevents the
  pattern matching your own command; a broad `pkill -f` will kill your own shell).

## Architecture

Everything runs with **zero configuration**: memory data store, deterministic local AI composer,
mock social connections, data-URL media storage, demo cookie auth, seeded demo workspace. Every
external dependency is a port with a local default; production implementations activate purely on
env vars (`.env.example` documents them all).

### Monorepo wiring (why imports look the way they do)

Packages export **TypeScript source** (`exports` → `src/index.ts`), not built JS. The web app
consumes them via `transpilePackages` plus a webpack `extensionAlias` that maps `.js` specifiers to
`.ts`. So internal imports use `./foo.js` suffixes even though the files are `.ts` — keep that
convention or Next and vitest disagree about resolution.

### Data layer (`packages/database`)

`DataStore` is the single persistence port with two implementations — `memory.ts` and
`supabase.ts` — verified by **one shared contract test suite** (`store.test.ts` runs against both).
Any new store method needs: the interface, both implementations, and a contract test.

- Supabase RLS uses security-definer helper functions (`is_org_member`, `can_read_brand`, …) in
  `migrations/0002_security_hardening.sql`.
- Job claiming is `claim_job()` with `FOR UPDATE SKIP LOCKED`. **PostgREST gotcha:** a plpgsql
  `return null` arrives as a composite row whose fields are all null, not as null — `claimJob`
  guards on `row['id']` being a non-empty string. Don't remove that guard.
- Social tokens are encrypted at rest (AES-256-GCM, `MORROWLANE_ENCRYPTION_KEY`) in `crypto.ts`.

### AI gateway (`packages/content-engine/src/gateway`)

Provider chain: Anthropic → OpenAI → Hugging Face (router.huggingface.co, OpenAI-compatible) →
deterministic local composer. Each provider is raw `fetch`, no SDKs — deliberate, to keep the
worker image small. `AI_PROVIDER` promotes a preferred provider; unavailable/failing providers fall
through the chain, so generation never hard-fails. All generation is grounded by a `brief` object
built from the Brand Brain; `completeObject` validates model output with zod and retries.

### Jobs (`packages/agents`)

All writes go through server actions (`apps/web/src/server/actions.ts`). Long work is enqueued as a
`Job`; `enqueueAndMaybeRun` executes it **inline** unless `MORROWLANE_WORKER=external`, in which
case the Railway worker polls and claims. Handlers for every job kind live in `handlers.ts`;
`runtime.ts` assembles dependencies (store, gateway, image renderer, media storage) from env. The
worker loop never crashes on poll failure — exponential backoff (5s→60s cap).

### Product invariants

- Brand rules **block publishing**: prohibited claims raise errors, they don't warn.
- Content carries lineage (`sourceType`, `parentContentId`, `appliedInsightIds`); attribution events
  roll up into insights (sample-size floors, Welch-t confidence) which feed back into generation via
  `applyInsights`. Don't create content paths that skip lineage.
- Analytics shows the Content→Engagement→Visit→Lead→Customer→Revenue funnel, never vanity metrics;
  charts follow the dataviz rules in `apps/web/src/components/charts.tsx` (single-hue ordinal ramp
  `FUNNEL_RAMP`, one axis, ink-token labels).
- The home screen opens with creation, not charts.
- Human edits to the Brand Brain are versioned and locked via `lockedFields` — regeneration must not
  overwrite locked fields.

### UI

Mobile-first: bottom tab bar + drawer on small screens, `lg:` sidebar on desktop. The `Card`
primitive carries `min-w-0` — grid children default to `min-width:auto`, and removing it re-breaks
mobile page width. Inputs are ≥16px to avoid iOS zoom. All motion keyframes live inside
`@media (prefers-reduced-motion: no-preference)` in `globals.css`. PWA: `public/sw.js` is
deliberately conservative (cache-first hashed assets, network-first navigations, `offline.html`).

## Deployment

Vercel (web, auto-deploys on push) + Railway (worker + api, Dockerfiles at repo root as
`Dockerfile.worker` / `Dockerfile.api`) + Supabase. **Railway gotcha:** config changes trigger
rebuilds from the repo's default branch — if that branch lacks the Dockerfiles, re-pin the service
source to the feature branch. Details in `docs/architecture/deployment.md`.
