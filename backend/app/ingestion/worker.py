"""
Lightweight ingestion worker stub.
Loads sources registry, fetches RSS (if available), normalizes, dedups, and stores to cache.
Designed to be optional; can be run manually or scheduled.
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import List, Dict, Any

from ..ingestion.sources import load_sources_registry
from ..services.cache import cache_client
from ..services.dedupe import is_duplicate, normalize_url
from ..news_integration import NewsIntegrator


async def fetch_rss(url: str) -> List[Dict[str, Any]]:
    try:
        import feedparser  # type: ignore
    except Exception:
        return []
    feed = feedparser.parse(url)
    items = []
    for entry in feed.entries[:20]:
        items.append({
            "id": entry.get("id") or entry.get("link") or f"{hash(entry.get('title',''))}",
            "headline": entry.get("title", ""),
            "source": entry.get("source", {}).get("title") if entry.get("source") else feed.feed.get("title", ""),
            "url": entry.get("link", ""),
            "timestamp": entry.get("published") or entry.get("updated"),
        })
    return items


async def run_once():
    sources = load_sources_registry()
    seen = set()
    events: List[Dict[str, Any]] = []
    for src in sources:
        if src.get("type") != "rss":
            continue
        for item in await fetch_rss(src.get("url", "")):
            if is_duplicate(seen, item.get("headline", ""), item.get("url", "")):
                continue
            enriched = NewsIntegrator.enrich_event({
                "id": item["id"],
                "headline": item["headline"],
                "source": item.get("source", src.get("id")),
                "country_code": NewsIntegrator.infer_geo(item["headline"])[0],
                "country_name": NewsIntegrator.infer_geo(item["headline"])[1],
                "region": NewsIntegrator.infer_geo(item["headline"])[2],
                "severity": NewsIntegrator.infer_severity(item["headline"]),
                "timestamp": item.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                "event_type": NewsIntegrator.classify_event_type(item["headline"]),
            })
            events.append(enriched)
    # Store in cache (in-memory by default)
    await cache_client.set("events:v2:latest", events)
    return events


async def run_forever(interval_sec: int = 300):
    while True:
        await run_once()
        await asyncio.sleep(interval_sec)


if __name__ == "__main__":
    asyncio.run(run_once())
