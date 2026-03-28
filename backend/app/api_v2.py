from fastapi import APIRouter, Query
from datetime import datetime, timezone
from typing import Optional, List

from .services.cache import cache_client
from .services.stream import stream_client
from .processors.ai_pipeline import AIPipeline
from .ingestion.sources import load_sources_registry
from .models.v2 import EventV2, LayerResponse, CIIResponse, AlertItem, Layer
from .ml.pipeline import LocalMLPipeline
from .providers.market import MarketProvider
from .services.correlation import correlation_signals

router = APIRouter()


@router.get("/events", response_model=list[EventV2])
def get_events(limit: int = Query(50, le=200), country: Optional[str] = None) -> list[EventV2]:
    """Return normalized/enriched events; falls back to existing pipeline."""
    pipeline = LocalMLPipeline()
    data = pipeline.process()
    events = data.get("events", [])
    if country:
        events = [e for e in events if (e.get("country_code") or "").lower() == country.lower()]
    ai = AIPipeline()
    enriched = []
    for ev in events[:limit]:
        enriched.append(ai.enrich_event(ev))
    return enriched


@router.get("/map/layers", response_model=LayerResponse)
def map_layers() -> dict:
    """Layer descriptors for map toggles (placeholder static)."""
    layers: List[Layer] = [
        Layer(id="conflicts", label="Conflicts", type="point", enabled=True),
        Layer(id="bases", label="Military Bases", type="point", enabled=False),
        Layer(id="pipelines", label="Pipelines", type="line", enabled=False),
        Layer(id="disasters", label="Disasters", type="point", enabled=True),
        Layer(id="aircraft", label="Aircraft (ADS-B)", type="point", enabled=False),
        Layer(id="ships", label="Ships (AIS)", type="point", enabled=False),
    ]
    return LayerResponse(layers=layers, updated_at=datetime.now(timezone.utc).isoformat())


@router.get("/cii", response_model=CIIResponse)
def country_intel_index() -> dict:
    """Lightweight placeholder CII using current GTI/country risk."""
    pipeline = LocalMLPipeline()
    data = pipeline.process()
    countries = data.get("countries", [])
    ranked = sorted(
        [
            {
                "code": c["country_code"],
                "score": float(c.get("risk_score", 0)),
                "sentiment": 0.0,
            }
            for c in countries
        ],
        key=lambda x: x["score"],
        reverse=True,
    )[:10]
    return {
        "updated_at": data.get("last_updated"),
        "top": ranked,
        "gti": data.get("gti", 0),
    }


@router.get("/alerts", response_model=list[AlertItem])
def alerts() -> list[AlertItem]:
    """Return recent alerts (empty placeholder)."""
    # In future, pull from cache/stream
    cached = []
    return cached


@router.get("/sources")
def sources() -> dict:
    """List configured ingest sources (static registry)."""
    registry = load_sources_registry()
    return {"count": len(registry), "sources": registry}


@router.get("/markets")
def markets(symbols: str = "SPX,NQ,WTI,XAU,BTCUSD") -> dict:
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    provider = MarketProvider()
    data = provider.batch_quotes(sym_list)
    return {"quotes": data, "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/osint/air")
def osint_air() -> dict:
    # Placeholder empty; ready for ADS-B integration
    return {"tracks": [], "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/osint/sea")
def osint_sea() -> dict:
    # Placeholder empty; ready for AIS integration
    return {"tracks": [], "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/correlation", response_model=list[AlertItem])
def correlation() -> list[AlertItem]:
    pipeline = LocalMLPipeline()
    data = pipeline.process()
    events = data.get("events", [])
    quotes = MarketProvider().batch_quotes(["WTI", "XAU"])
    alerts = correlation_signals(events, quotes)
    return alerts
