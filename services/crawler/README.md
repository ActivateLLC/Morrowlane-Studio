# Crawler service (Crawl4AI)

The escalation path for JavaScript-rendered websites. The Node crawl engine's plain
HTTP fetcher handles most marketing sites; when a site needs a real browser, point the
worker at this service and every crawl goes through it with no other change.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
crawl4ai-setup          # installs the browser Crawl4AI drives
uvicorn app:app --port 8020
```

Wire it in with `CRAWLER_SERVICE_URL=http://localhost:8020`. The Node side's
`createServiceFetcher` (packages/crawl-engine) implements the shared `Fetcher`
interface against `POST /fetch`.
