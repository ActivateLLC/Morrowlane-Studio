# External systems

| System | Role | Integration |
| --- | --- | --- |
| Supabase | auth, Postgres, storage | hosted; `packages/database/migrations`, `createSupabaseStore` |
| LangGraph | orchestration at scale | `packages/agents/graph.ts` covers today's pipelines; branching/HIL graphs move to a LangGraph service |
| Crawl4AI | JS-rendered crawling | `services/crawler` + `createServiceFetcher` fallback chain |
| browser-use | automation where no API exists | reserved for research flows; never for normal publishing |
| ComfyUI | image generation | `services/creative`, isolated; workflow templates with placeholders |
| Remotion | programmatic video | `services/video`; license review required before commercial deployment |
| PostHog | product analytics | integrate hosted PostHog; forward funnel webhooks to `POST /v1/events` |
| n8n | internal integrations | `services/automation`; Sustainable Use License — not resold to customers |
