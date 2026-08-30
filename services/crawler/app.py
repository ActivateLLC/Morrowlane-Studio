"""
Morrowlane crawler service: Crawl4AI behind the one endpoint the Node side needs.

The crawl engine's plain HTTP fetcher covers most marketing sites. This service is the
escalation path for JavaScript-rendered sites: it implements the same fetch contract
(`POST /fetch` returns url/finalUrl/status/contentType/body) so the Node side can swap
it in via `createServiceFetcher` without any other change.

Run:  uvicorn app:app --port 8020
Then: CRAWLER_SERVICE_URL=http://localhost:8020 in the worker's environment.
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

app = FastAPI(title="Morrowlane crawler", version="0.1.0")

_browser_config = BrowserConfig(headless=True, verbose=False)
_run_config = CrawlerRunConfig(
    cache_mode=CacheMode.BYPASS,
    word_count_threshold=0,
    page_timeout=20000,
)


class FetchRequest(BaseModel):
    url: HttpUrl


class FetchResponse(BaseModel):
    url: str
    finalUrl: str
    status: int
    contentType: str
    body: str


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/fetch", response_model=FetchResponse)
async def fetch(request: FetchRequest) -> FetchResponse:
    async with AsyncWebCrawler(config=_browser_config) as crawler:
        result = await crawler.arun(url=str(request.url), config=_run_config)

    # The Node extractor parses HTML itself; hand back the rendered document.
    body = result.html or ""
    return FetchResponse(
        url=str(request.url),
        finalUrl=result.url or str(request.url),
        status=result.status_code or (200 if result.success else 502),
        contentType="text/html",
        body=body[:2_000_000],
    )
