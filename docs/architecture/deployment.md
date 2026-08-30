# Deployment

The production shape: **Vercel** serves the web app, **Railway** runs the always-on
processes, **Supabase** is the database and auth (the RLS policies and session layer
are Supabase-specific — do not substitute a bare Postgres).

```
Vercel (apps/web) ──► Supabase (Postgres + Auth)
                          ▲            ▲
Railway: worker ──────────┘            │
Railway: api  ─────────────────────────┘   ◄── pixels / PostHog / CRM webhooks
Railway: crawler (Crawl4AI, optional)
```

## Vercel — web app

Project: **morrowlane-studio** (`prj_47cqEpS1vd7mF6eDQVwMmDeW4FAK`) on the
aaronmarcels-projects team, linked to this repo with root directory `apps/web`.
Production deploys from `main`; branch pushes create preview deployments.

- Import the GitHub repo; **Root Directory: `apps/web`**. Vercel detects the pnpm
  workspace and Next.js automatically; no custom build command needed.
- Environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `MORROWLANE_ENCRYPTION_KEY` (32+ random bytes; same value on Railway)
  - `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`)
  - `MORROWLANE_WORKER=external` — **required in production.** Without it, server
    actions run crawl/generation jobs inline and will hit function time limits.
- With no env configured at all, a deployment runs in demo mode (memory store, demo
  session). On serverless that state is per-instance and ephemeral — fine for a
  preview link, not for real use.

## Railway — worker and API

Two services from the same repo, using the root Dockerfiles:

| Service | Variable | Value |
| --- | --- | --- |
| worker | `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.worker` |
| api | `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.api` |

Shared env on both: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`MORROWLANE_ENCRYPTION_KEY`, AI key(s). Worker only: `WORKER_KINDS` (optional
filter). API only: `MORROWLANE_INGEST_KEY`; give the service a public domain and set
its healthcheck path to `/healthz`.

The optional crawler service deploys from `services/crawler` (Python; Railway
auto-detects it) with `CRAWLER_SERVICE_URL` then set on the worker.

## Supabase

Create a project, run `packages/database/migrations/0001_init.sql` in the SQL editor
(or `supabase db push`), and copy the URL + anon + service-role keys into the env
above. Enable email auth in Authentication settings.

## Order of operations

1. Supabase project + migration.
2. Railway worker + api with env.
3. Vercel with env (including `MORROWLANE_WORKER=external`).
4. Add each network's OAuth credentials as you register developer apps; unconfigured
   networks are simply hidden from the Connect screen.
