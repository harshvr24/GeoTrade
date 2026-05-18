from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timezone
from typing import Optional, List

from .services.cache import cache_client
from .services.stream import stream_client
from .processors.ai_pipeline import AIPipeline
from .processors.cii import CIICalculator
from .processors.anomaly import WelfordDetector
from .processors.signal_aggregator import SignalAggregator
from .ingestion.sources import load_sources_registry
from .models.v2 import EventV2, LayerResponse, CIIResponse, AlertItem, Layer
from .ml.pipeline import LocalMLPipeline
from .providers.market import MarketProvider
from .providers.llm import LLMProvider
from .services.correlation import correlation_signals

router = APIRouter()


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _get_pipeline() -> LocalMLPipeline:
    return LocalMLPipeline()


def _get_cii() -> CIICalculator:
    return CIICalculator()


def _get_anomaly() -> WelfordDetector:
    return WelfordDetector()


def _get_aggregator() -> SignalAggregator:
    return SignalAggregator()


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

@router.get("/events", response_model=list[EventV2])
def get_events(limit: int = Query(50, le=200), country: Optional[str] = None) -> list[EventV2]:
    """Return normalized/enriched events; falls back to existing pipeline."""
    pipeline = _get_pipeline()
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
    """Layer descriptors for map toggles."""
    layers: List[Layer] = [
        Layer(id="conflicts", label="Conflicts", type="point", enabled=True),
        Layer(id="bases", label="Military Bases", type="point", enabled=False),
        Layer(id="pipelines", label="Pipelines", type="line", enabled=False),
        Layer(id="disasters", label="Disasters", type="point", enabled=True),
        Layer(id="aircraft", label="Aircraft (ADS-B)", type="point", enabled=False),
        Layer(id="ships", label="Ships (AIS)", type="point", enabled=False),
        Layer(id="convergence", label="Convergence Zones", type="polygon", enabled=False),
        Layer(id="cii", label="CII Choropleth", type="choropleth", enabled=True),
    ]
    return LayerResponse(layers=layers, updated_at=datetime.now(timezone.utc).isoformat())


@router.get("/cii", response_model=CIIResponse)
def country_intel_index() -> dict:
    """CII scores computed from live events + baseline risk."""
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    calculator = _get_cii()
    results = calculator.score_all(events)
    ranked = sorted(
        [
            {
                "code": code,
                "score": result.score,
                "sentiment": 0.0,
            }
            for code, result in results.items()
        ],
        key=lambda x: x["score"],
        reverse=True,
    )[:10]
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "top": ranked,
        "gti": data.get("gti", 0),
    }


@router.get("/cii/all")
def country_intel_index_all() -> dict:
    """Full CII breakdown for all monitored countries."""
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    calculator = _get_cii()
    results = calculator.score_all(events)
    items = []
    for code, result in results.items():
        items.append({
            "code": code,
            "score": result.score,
            "risk_level": result.risk_level,
            "trend": result.trend,
            "components": {
                "baseline": result.components.baseline,
                "unrest": result.components.unrest,
                "security": result.components.security,
                "velocity": result.components.velocity,
                "hotspot_boost": result.components.hotspot_boost,
                "focal_boost": result.components.focal_boost,
            },
            "floor_applied": result.components.floor_applied,
        })
    items.sort(key=lambda x: x["score"], reverse=True)
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "countries": items,
        "gti": data.get("gti", 0),
    }


@router.get("/alerts", response_model=list[AlertItem])
def alerts() -> list[AlertItem]:
    """Return recent alerts from anomaly detection and correlation engine."""
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    anomaly_detector = _get_anomaly()
    anomaly_alerts = anomaly_detector.run_all_checks(events)
    items = []
    for a in anomaly_alerts:
        items.append(AlertItem(
            id=f"anomaly-{a.z_score}",
            type="anomaly",
            message=a.message,
            severity=a.severity,
            timestamp=a.timestamp,
            data={
                "region": a.region,
                "event_type": a.event_type,
                "z_score": a.z_score,
                "observed": a.observed,
                "baseline_mean": a.baseline_mean,
                "multiplier": a.multiplier,
            },
        ))
    return items


@router.get("/sources")
def sources() -> dict:
    """List configured ingest sources (static registry)."""
    registry = load_sources_registry()
    return {"count": len(registry), "sources": registry}


@router.get("/markets")
def markets(symbols: str = "SPX,NQ,WTI,XAU,BTCUSD") -> dict:
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    provider = MarketProvider()
    # MarketProvider.batch_quotes is sync; run in sync context for FastAPI
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        # already in async context
        data = asyncio.run(provider.batch_quotes(sym_list))
    except RuntimeError:
        # no running loop — create one
        data = asyncio.run(provider.batch_quotes(sym_list))
    return {"quotes": data, "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/markets/live")
def markets_live(symbols: str = "SPX,NQ,WTI,XAU,BTCUSD,BRENT,NG,EURUSD,DXY,VIX") -> dict:
    """Live market quotes with freshness indicators; reads UPSTASH cache first."""
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    provider = MarketProvider()
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        data = asyncio.run(provider.batch_quotes(sym_list))
    except RuntimeError:
        data = asyncio.run(provider.batch_quotes(sym_list))
    enriched = {}
    for sym, quote in data.items():
        enriched[sym] = {
            **quote,
            "freshness": cache_client.get_freshness(f"quote:{sym}"),
        }
    return {"quotes": enriched, "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/osint/air")
def osint_air() -> dict:
    """Air track data — placeholder returning empty tracks.

    Real integration would pull from ADS-B aggregation service
    (e.g., PlaneFinder, FlightRadar24, OpenSky Network).
    """
    return {
        "tracks": [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "ADS-B integration pending — configure ADSB_API_KEY env var",
    }


@router.get("/osint/sea")
def osint_sea() -> dict:
    """Sea track data — placeholder returning empty tracks.

    Real integration would pull from AIS aggregation service
    (e.g., MarineTraffic, VesselFinder, MyShipTracking).
    """
    return {
        "tracks": [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "AIS integration pending — configure AIS_API_KEY env var",
    }


@router.get("/correlation", response_model=list[AlertItem])
def correlation() -> list[AlertItem]:
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    quotes = {}
    try:
        import asyncio
        mp = MarketProvider()
        quotes = asyncio.run(mp.batch_quotes(["WTI", "XAU"]))
    except Exception:
        pass
    alerts = correlation_signals(events, quotes)
    return alerts


# ---------------------------------------------------------------------------
# NEW World Monitor intelligence endpoints
# ---------------------------------------------------------------------------

@router.get("/brief")
async def world_brief() -> dict:
    """AI-synthesized world brief generated from top-10 severity events.

    Uses Groq/OpenRouter if GROQ_API_KEY or OPENROUTER_API_KEY is set;
    falls back to heuristic summary with zero API calls.
    Cached for 30 minutes server-side.
    """
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])

    llm = LLMProvider()
    brief = await llm.synthesize_brief(events)

    return {
        "brief": brief["brief"],
        "sections": brief["sections"],
        "generated_at": brief["generated_at"],
        "source": brief["source"],
        "model": brief.get("model", "heuristic"),
        "cached": brief.get("cached", False),
        "event_count": len(events),
    }


@router.get("/focal-points")
def focal_points() -> dict:
    """Entities (countries/regions) appearing across 3+ distinct signal categories.

    Focal points indicate multi-domain convergence: military + diplomatic + economic
    activity pointing at the same entity simultaneously.
    """
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    aggregator = _get_aggregator()

    # No military track data available in this context
    result = aggregator.aggregate(events, military_tracks=[], naval_tracks=[])
    focal = result.get("focal_points", [])

    return {
        "focal_points": focal,
        "total": len(focal),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/anomalies")
def anomalies() -> dict:
    """Welford-based statistical anomaly alerts for event velocity patterns.

    Detects statistically significant deviations in event counts per region,
    adjusted for day-of-week and seasonal baselines.
    """
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    detector = _get_anomaly()
    alerts = detector.run_all_checks(events)

    return {
        "anomalies": [
            {
                "region": a.region,
                "event_type": a.event_type,
                "z_score": a.z_score,
                "severity": a.severity,
                "observed": a.observed,
                "baseline_mean": a.baseline_mean,
                "baseline_std": a.baseline_std,
                "multiplier": a.multiplier,
                "message": a.message,
                "timestamp": a.timestamp,
            }
            for a in alerts
        ],
        "total": len(alerts),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/convergence")
def convergence() -> dict:
    """Geographic grid cells with 3+ distinct signal types converging.

    Convergence zones indicate geospatial overlap of multiple intelligence
    streams (e.g., military flights + naval vessels + news events in same grid cell).
    """
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    aggregator = _get_aggregator()
    result = aggregator.aggregate(events, military_tracks=[], naval_tracks=[])
    convergence_alerts = result.get("convergence_alerts", [])

    return {
        "convergence_alerts": convergence_alerts,
        "total": len(convergence_alerts),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/gaps")
def intelligence_gaps() -> dict:
    """Identify regions/countries with high baseline risk but low news coverage.

    Intelligence gaps flag areas that may be under-reported relative to their
    structural risk — useful for identifying blind spots in the feed coverage.
    """
    pipeline = _get_pipeline()
    data = pipeline.process()
    events = data.get("events", [])
    calculator = _get_cii()
    results = calculator.score_all(events)

    # Count events per country from live feed
    event_count_by_country: dict[str, int] = {}
    for ev in events:
        code = ev.get("country_code", "")
        if code:
            event_count_by_country[code] = event_count_by_country.get(code, 0) + 1

    gaps = []
    for code, result in results.items():
        if result.score >= 40:  # structural risk threshold
            coverage = event_count_by_country.get(code, 0)
            # High risk + low coverage = intelligence gap
            if coverage <= 1:
                gaps.append({
                    "country_code": code,
                    "cii_score": result.score,
                    "risk_level": result.risk_level,
                    "event_count": coverage,
                    "gap_severity": "critical" if result.score >= 65 else ("high" if result.score >= 50 else "medium"),
                    "reason": "Low news coverage despite elevated structural instability",
                })

    gaps.sort(key=lambda g: (g["cii_score"], g["event_count"]), reverse=True)

    return {
        "gaps": gaps,
        "total": len(gaps),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "methodology": "Countries with CII >= 40 and <= 1 event in current feed window",
    }


@router.get("/intelligence/air")
def intelligence_air() -> dict:
    """Air track intelligence — military flights near geopolitical hotspots.

    In production this would integrate with ADS-B aggregation services.
    Returns empty tracks with a note for now.
    """
    return {
        "tracks": [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Air track integration requires ADSB_API_KEY configuration",
    }


@router.get("/intelligence/sea")
def intelligence_sea() -> dict:
    """Maritime intelligence — naval vessel positions near strategic chokepoints.

    In production this would integrate with AIS aggregation services.
    Returns empty tracks with a note for now.
    """
    return {
        "tracks": [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Maritime track integration requires AIS_API_KEY configuration",
    }


@router.get("/signals/enriched")
def enriched_signals() -> dict:
    """Trading signals enriched with intelligence metadata: CII score, anomaly flags, focal point status."""
    pipeline = _get_pipeline()
    data = pipeline.process()
    signals = data.get("signals", [])
    events = data.get("events", [])

    calculator = _get_cii()
    anomaly_detector = _get_anomaly()
    aggregator = _get_aggregator()

    cii_results = calculator.score_all(events)
    anomaly_alerts = anomaly_detector.run_all_checks(events)
    agg_result = aggregator.aggregate(events, military_tracks=[], naval_tracks=[])
    focal_entities = {fp["entity"] for fp in agg_result.get("focal_points", [])}
    anomaly_regions = {a.region for a in anomaly_alerts}

    enriched = []
    for sig in signals:
        e = dict(sig)
        # Attach CII of the primary country
        country_code = None
        for ev in events:
            if ev.get("headline", "") in sig.get("rationale", ""):
                country_code = ev.get("country_code")
                break
        if not country_code:
            country_code = sig.get("country_code")

        cii_result = cii_results.get(country_code) if country_code else None
        e["cii_score"] = cii_result.score if cii_result else None
        e["cii_level"] = cii_result.risk_level if cii_result else None

        # Attach anomaly flag if this signal's region is anomalous
        sig_region = next((ev.get("region") for ev in events if ev.get("headline", "") in sig.get("rationale", "")), None)
        e["anomaly_flag"] = sig_region in anomaly_regions if sig_region else False

        # Attach focal point badge
        e["focal_point"] = country_code in focal_entities if country_code else False

        # Attach source tier info
        e["source_tier"] = sig.get("source_tier", None)
        e["state_affiliated"] = sig.get("state_affiliated", False)

        enriched.append(e)

    return {
        "signals": enriched,
        "total": len(enriched),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
