# Product spec → implementation map

| Spec section | Where it lives |
| --- | --- |
| Authentication, orgs, invites | `apps/web/src/server/session.ts`, settings screen, memberships schema |
| Add Brand ("What's your website?") | home page onboarding → `crawl_site` job |
| Website Intelligence Engine | `packages/crawl-engine` (discovery, extraction, classification) |
| Brand Brain | `packages/brand-engine`; reviewed/edited at `/brands/:id/brain` |
| Morrowlane Studio | `/brands/:id/studio`; `parseStudioIntent` reads the box |
| Generate Everything | format registry (21 formats); text unlimited, media behind cost tiers |
| URL Remix | `remixUrl` + default recipe; `/brands/:id/remix` shows distribution trees |
| Campaign Engine | `planCampaign` (5-phase arc), per-phase generation, phase-ranged scheduling |
| Social Connections | `SocialProvider` + 10 adapters; `/brands/:id/connections` |
| Calendar / Fill My Month | `scheduleContent`, `planMonth` (balanced mix), `/brands/:id/calendar` |
| Content Library | `queryContent` (search, filters, lineage); `/brands/:id/library` |
| Competitor Intelligence | crawl diffing + `buildOpportunities` — recommendation + one-click action |
| Trend Radar | `scoreTrendRelevance` against the Brand Brain; below-floor trends never surface |
| Analytics | attribution stages, funnel, conversion rates; no vanity wall |
| Learning Loop | lineage → performance → `computeInsights` → Apply Insight → generation prefs |

## Milestones

All ten V1 milestones are implemented and covered by `packages/agents/src/pipeline.test.ts`
(engine level) plus the Playwright smoke checks (browser level). Media rendering
(`render_media`) reports honestly that it needs `services/creative` wired in.
