# Morrowlane Studio

**Turn any business website into an always-on content and growth engine.**

Paste a website. Morrowlane reads the whole site — products, services, pricing, voice,
FAQs, testimonials, imagery, colours — and builds a persistent **Brand Brain**. From
that knowledge it generates campaigns and content that are grounded in the business,
schedules and publishes them across ten networks, measures what each post produced all
the way to revenue, and feeds what it learns back into the next generation.

## Try it in two minutes

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

With nothing configured, Morrowlane runs complete and offline: a demo workspace with a
brand already analysed from a fixture website, a month of content on the calendar,
mock social connections you can publish through, and enough performance history that
the insight engine has something true to say ("Instagram carousels generate 2.2× more
qualified traffic than quote graphics" — with the Apply button that changes future
generations).

```bash
pnpm test         # 194 tests: the whole product, engine by engine, offline
pnpm build        # packages + web app
pnpm dev:worker   # background worker (optional locally; jobs also run inline)
pnpm dev:api      # attribution ingestion API on :4000
```

## Going to production

Copy `.env.example` to `.env` and fill in what you use. Each dependency is independent —
configure any subset and the rest keep their local defaults.

1. **Database & auth** — create a Supabase project, run
   `packages/database/migrations/0001_init.sql`, set the `SUPABASE_*` /
   `NEXT_PUBLIC_SUPABASE_*` keys and `MORROWLANE_ENCRYPTION_KEY`.
2. **AI** — set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`; `AI_PROVIDER` picks the
   preferred one). The gateway retries, falls back down the chain, and never hard-fails
   generation.
3. **Social** — create developer apps and set `<CHANNEL>_CLIENT_ID` / `_CLIENT_SECRET`
   per network. Unconfigured networks simply don't offer Connect.
4. **Services** — `services/crawler` (JS-rendered sites), `services/creative` (ComfyUI),
   `services/video` (Remotion — review its license first), `services/automation` (n8n,
   internal only). Each is optional and isolated.

## Cross-platform

The web app installs everywhere: a full PWA (manifest, maskable icons, offline
fallback, standalone display) covers iPhone/Android home screens and Chrome/Edge
desktop installs, and `apps/mobile` holds a Capacitor scaffold for App Store /
Play Store distribution. See [`docs/architecture/cross-platform.md`](docs/architecture/cross-platform.md).

## How it's built

```
apps/       web (Next.js) · api (ingestion) · worker (jobs)
packages/   shared · crawl-engine · brand-engine · content-engine · campaign-engine
            social · analytics · database · agents · ui · integrations · creative-engine
services/   crawler (Crawl4AI) · creative (ComfyUI) · video (Remotion) · automation (n8n)
docs/       architecture · product · integrations
```

Start with [`docs/architecture/overview.md`](docs/architecture/overview.md). The short
version: the interface is thin on purpose; the engines are pure TypeScript, run
entirely offline in tests, and everything a model asserts is grounded in something the
crawler can point at.
