# Architecture

Morrowlane is a pnpm monorepo. The interface is deliberately thin; the sophistication
lives in the engine packages, which are pure TypeScript with no framework dependency
and are covered by the test suite that runs the whole product offline.

## The flow

```
paste URL
   │
   ▼
crawl-engine ── discovers robots/sitemaps/feeds, prioritises crawl budget,
   │            extracts pages (FAQs, testimonials, prices, CTAs, colours,
   │            structured data), classifies page types with confidence
   ▼
brand-engine ── deterministic signals + model interpretation → Brand Brain
   │            (versioned; compliance presets; human edits locked)
   ▼
content-engine ─ one generation path for every asset: brief → gateway →
   │             rule check → lineage attached
   ▼
campaign-engine ─ goal → phased narrative → per-phase generation → schedule
   ▼
social ────────── SocialProvider adapters; publish pipeline with typed retry
   ▼
analytics ─────── attribution events → funnel → insights → applied back
                  into generation (the learning loop)
```

## Packages

| Package | Responsibility |
| --- | --- |
| `shared` | ids, Result, URL/text/time helpers, channel + format registries, domain model |
| `crawl-engine` | discovery, robots, sitemaps, extraction, classification, crawl budget |
| `brand-engine` | Brand Brain synthesis, compliance presets, locked-field preservation |
| `content-engine` | AI gateway (Anthropic/OpenAI/local), generation, rules, intent parsing, remix |
| `campaign-engine` | campaign planning, phase layout, scheduling, Fill My Month |
| `social` | provider abstraction, OAuth plumbing, per-channel rendering, publish pipeline |
| `analytics` | attribution graph, insight engine, opportunities, trends, competitor diffing |
| `database` | DataStore port; in-memory and Supabase implementations; token encryption |
| `agents` | graph runner, onboarding pipeline, job handlers, worker loop, runtime, demo seed |
| `ui` | the design system (small on purpose) |

## Apps and services

- `apps/web` — Next.js 15. Server actions are the only write surface; each confirms
  organization membership and brand ownership.
- `apps/api` — attribution ingestion (`POST /v1/events`) for pixels, PostHog webhooks
  and CRM integrations.
- `apps/worker` — claims jobs and promotes due scheduled posts into publish jobs.
- `services/crawler` — Crawl4AI, the browser-rendering escalation path for the fetcher.
- `services/creative` — ComfyUI, isolated media generation.
- `services/video` — Remotion rendering (license review required before commercial use).
- `services/automation` — n8n, internal integrations only.

## Two principles that shaped the code

**Everything runs with nothing configured.** The AI gateway falls back to a
deterministic local composer grounded in crawl facts; the store falls back to memory;
social providers fall back to mocks; the crawler falls back from the browser service to
plain HTTP. `pnpm dev` on a clean checkout is the entire product, and the test suite
exercises the real pipelines rather than mocks of them.

**Provenance over generation.** Content carries lineage (source, instruction, applied
insights); the Brand Brain records which pages taught it what; rules block publishing,
not just warn; insights state sample sizes and refuse to speak below a floor. The
product's promise — it understands the business — is only credible if every claim can
be traced.
