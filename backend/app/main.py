import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .ml.pipeline import LocalMLPipeline
from .api_v2 import router as api_v2_router
from .schemas import (
    DashboardResponse,
    WaitlistRequest,
    WaitlistResponse,
    PortfolioResponse,
    FeedsResponse,
    Position,
    Portfolio,
    PortfolioMetrics,
    FeedEvent,
    CountryDetail,
    MarketItem,
    NewsItem,
)

app = FastAPI(title="GeoTrade API", version="2.0.0")
pipeline = LocalMLPipeline()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount additive v2 APIs (non-breaking)
app.include_router(api_v2_router, prefix="/api/v2", tags=["v2"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard() -> dict:
    return pipeline.process()


COUNTRY_MARKETS: dict[str, list[dict[str, object]]] = {
    "USA": [
        {"symbol": "SPX", "name": "S&P 500", "price": 5299.6, "change_pct": -0.18, "sector": "Equities"},
        {"symbol": "NQ", "name": "Nasdaq 100", "price": 18244.3, "change_pct": -0.32, "sector": "Equities"},
        {"symbol": "WTI", "name": "WTI Crude", "price": 82.16, "change_pct": 0.95, "sector": "Commodities"},
    ],
    "IRN": [
        {"symbol": "WTI", "name": "WTI Crude", "price": 82.16, "change_pct": 0.95, "sector": "Commodities"},
        {"symbol": "XAU", "name": "Gold", "price": 2314.6, "change_pct": 1.2, "sector": "Commodities"},
    ],
    "DEU": [
        {"symbol": "DAX", "name": "DAX 40", "price": 17890.2, "change_pct": -0.42, "sector": "Equities"},
        {"symbol": "EURUSD", "name": "EUR/USD", "price": 1.0821, "change_pct": -0.14, "sector": "FX"},
    ],
    "CHN": [
        {"symbol": "HSI", "name": "Hang Seng", "price": 16980.4, "change_pct": -0.28, "sector": "Equities"},
        {"symbol": "CSI300", "name": "CSI 300", "price": 3510.2, "change_pct": -0.35, "sector": "Equities"},
    ],
    "ISR": [
        {"symbol": "TA35", "name": "TA-35", "price": 1765.1, "change_pct": -0.51, "sector": "Equities"},
        {"symbol": "USDILS", "name": "USD/ILS", "price": 3.72, "change_pct": 0.22, "sector": "FX"},
    ],
    "TWN": [
        {"symbol": "TAIEX", "name": "TAIEX", "price": 20412.7, "change_pct": -0.18, "sector": "Equities"},
        {"symbol": "SOX", "name": "PHLX Semi", "price": 5075.4, "change_pct": -0.62, "sector": "Equities"},
    ],
}


@app.get("/api/country/{country_code}", response_model=CountryDetail)
def country(country_code: str) -> dict:
    data = pipeline.process()
    code = country_code.upper()
    country_data = next((c for c in data["countries"] if c["country_code"] == code), None)
    country_events = [e for e in data["events"] if e["country_code"] == code]
    if not country_data or not country_events:
        raise HTTPException(status_code=404, detail="Country not found")

    markets = [
        MarketItem(**m).model_dump()
        for m in COUNTRY_MARKETS.get(code, [{"symbol": code, "name": country_data["country_name"], "price": 0.0, "change_pct": 0.0}])
    ]
    news = [
        NewsItem(
            id=ev["id"],
            headline=ev["headline"],
            source=ev["source"],
            timestamp=ev["timestamp"],
            severity=ev["severity"],
            impact=ev["market_impact"],
            sentiment=ev.get("sentiment", 0.0),
        ).model_dump()
        for ev in country_events
    ]

    return {
        "country": country_data,
        "events": country_events,
        "markets": markets,
        "news": news,
        "signals": data["signals"],
    }


@app.post("/api/waitlist", response_model=WaitlistResponse)
def waitlist(payload: WaitlistRequest) -> dict[str, str | bool]:
    return {
        "success": True,
        "message": f"Thanks {payload.name or 'trader'}, {payload.email} has been added to the GeoTrade waitlist.",
    }


@app.get("/api/portfolio", response_model=PortfolioResponse)
def get_portfolio() -> dict:
    """Get current portfolio positions and metrics."""
    portfolio_data = {
        "total_value": 145_280.50,
        "total_pnl": 3_241.20,
        "total_pnl_pct": 2.23,
        "positions": [
            {
                "id": "p1",
                "asset": "XAU/USD",
                "size": 5.0,
                "entry_price": 2304.50,
                "current_price": 2314.58,
                "pnl": 50.40,
                "pnl_pct": 0.44,
                "risk_ratio": 2.0,
                "time_open": "14h 32m",
                "signal": "BUY",
                "status": "active",
            },
            {
                "id": "p2",
                "asset": "SPX",
                "size": 2.5,
                "entry_price": 5320.00,
                "current_price": 5299.57,
                "pnl": -51.08,
                "pnl_pct": -0.38,
                "risk_ratio": 1.87,
                "time_open": "22h 14m",
                "signal": "SELL",
                "status": "active",
            },
        ],
        "metrics": {
            "win_rate": 68.5,
            "sharpe_ratio": 1.84,
            "max_drawdown": -8.2,
            "avg_win": 287.50,
            "avg_loss": -142.30,
        },
    }

    return {
        "portfolio": portfolio_data,
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }


@app.get("/api/feeds", response_model=FeedsResponse)
def get_feeds() -> dict:
    """Get live geopolitical event feeds."""
    data = pipeline.process()
    events = data.get("events", [])

    feeds_data = []
    for ev in sorted(events, key=lambda e: e.get("timestamp", ""), reverse=True)[:40]:
        ts_raw = ev.get("timestamp") or ev.get("time") or ""
        try:
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            time_str = ts.strftime("%H:%M")
        except Exception:
            time_str = ""
        feeds_data.append(
            {
                "id": ev.get("id"),
                "time": time_str,
                "timestamp": ts_raw or datetime.now(timezone.utc).isoformat(),
                "headline": ev.get("headline"),
                "region": ev.get("region", "Global"),
                "severity": ev.get("severity", "medium"),
                "source": ev.get("source", "GeoTrade"),
                "impact": f"{ev.get('market_impact', 0):+.1f}% impact",
                "countries": [ev.get("country_code")] + ([ev.get("related_country_code")] if ev.get("related_country_code") else []),
                "sentiment": ev.get("sentiment", 0.0),
            }
        )

    return {
        "feeds": feeds_data,
        "total_count": len(feeds_data),
        "last_updated": data.get("last_updated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")),
    }


@app.get("/api/signals/trading")
def get_trading_signals() -> dict:
    """Get comprehensive trading signals based on geopolitical events."""
    data = pipeline.process()
    signals = data.get("signals", [])

    enriched_signals = []
    for signal in signals:
        enriched_signal = dict(signal)
        enriched_signal["risk_level"] = "HIGH" if enriched_signal.get("confidence", 0) > 0.7 else "MEDIUM"
        enriched_signal["timeframe"] = enriched_signal.get("horizon", "24-72h")
        enriched_signals.append(enriched_signal)

    raw_summary = data.get("signal_summary") or {}
    summary = {
        "total_signals": raw_summary.get("total", len(enriched_signals)),
        "buy_signals": raw_summary.get("buy", sum(1 for s in enriched_signals if s.get("action") == "BUY")),
        "sell_signals": raw_summary.get("sell", sum(1 for s in enriched_signals if s.get("action") == "SELL")),
        "average_confidence": raw_summary.get(
            "avg_confidence",
            round(sum(s.get("confidence", 0) for s in enriched_signals) / len(enriched_signals), 2)
            if enriched_signals
            else 0,
        ),
    }

    return {
        "signals": enriched_signals,
        "summary": summary,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }


@app.get("/api/geopolitical-index")
def get_geopolitical_index() -> dict:
    """Get Geopolitical Tension Index (GTI) and related metrics."""
    data = pipeline.process()
    countries = data.get("countries", [])
    events = data.get("events", [])
    
    # Calculate metrics
    critical_events = sum(1 for e in events if e.get("severity") == "critical")
    high_events = sum(1 for e in events if e.get("severity") == "high")
    high_risk_countries = sum(1 for c in countries if float(c.get("risk_score", 0)) >= 70)
    
    # Regional distribution
    regions = {}
    for country in countries:
        region = country.get("region", "Unknown")
        if region not in regions:
            regions[region] = {"countries": 0, "avg_risk": 0}
        regions[region]["countries"] += 1
        regions[region]["avg_risk"] += float(country.get("risk_score", 0))
    
    for region in regions:
        if regions[region]["countries"] > 0:
            regions[region]["avg_risk"] = round(regions[region]["avg_risk"] / regions[region]["countries"], 1)
    
    return {
        "gti": data.get("gti", 0),
        "gti_delta": data.get("gti_delta", 0),
        "risk_summary": {
            "critical_events": critical_events,
            "high_events": high_events,
            "high_risk_countries": high_risk_countries,
            "total_countries_monitored": len(countries),
        },
        "regional_breakdown": regions,
        "top_risk_countries": sorted(countries, key=lambda c: float(c.get("risk_score", 0)), reverse=True)[:5],
        "last_updated": data.get("last_updated"),
    }


@app.get("/api/market-impact-analysis")
def get_market_impact() -> dict:
    """Get market impact analysis of current geopolitical events."""
    data = pipeline.process()
    events = data.get("events", [])
    
    # Aggregate affected assets
    asset_impact = {}
    for event in events:
        affected = event.get("affected_assets", [])
        impact = event.get("market_impact", 0)
        severity = event.get("severity", "low")
        
        for asset in affected:
            if asset not in asset_impact:
                asset_impact[asset] = {"total_impact": 0, "events": 0, "severity_count": {}}
            asset_impact[asset]["total_impact"] += impact
            asset_impact[asset]["events"] += 1
            asset_impact[asset]["severity_count"][severity] = asset_impact[asset]["severity_count"].get(severity, 0) + 1
    
    # Calculate composite impact score per asset
    assets_by_impact = []
    for asset, data_dict in asset_impact.items():
        composite_impact = round(data_dict["total_impact"] / max(data_dict["events"], 1), 2)
        highest_severity = max(data_dict["severity_count"].keys(), key=lambda k: data_dict["severity_count"][k], default="low")
        assets_by_impact.append({
            "asset": asset,
            "composite_impact": composite_impact,
            "events_affecting": data_dict["events"],
            "highest_severity": highest_severity,
        })
    
    # Sort by impact
    assets_by_impact.sort(key=lambda x: x["composite_impact"], reverse=True)
    
    return {
        "top_affected_assets": assets_by_impact[:10],
        "total_affected_assets": len(assets_by_impact),
        "summary": {
            "energy_assets_affected": sum(1 for a in assets_by_impact if a["asset"] in ["WTI", "Brent", "NG"]),
            "equities_affected": sum(1 for a in assets_by_impact if a["asset"] in ["SPX", "DAX", "HSI", "Nikkei", "FTSE"]),
            "forex_affected": sum(1 for a in assets_by_impact if a["asset"] in ["USD", "EUR", "GBP", "JPY", "CNY"]),
            "precious_metals_affected": sum(1 for a in assets_by_impact if a["asset"] in ["GLD", "SLV"]),
        },
    }


@app.get("/api/risk-heatmap")
def get_risk_heatmap() -> dict:
    """Get global risk heatmap by country and region."""
    data = pipeline.process()
    countries = data.get("countries", [])
    
    # Group by region and calculate risk metrics
    regional_heatmap = {}
    for country in countries:
        region = country.get("region", "Unknown")
        if region not in regional_heatmap:
            regional_heatmap[region] = {
                "countries": [],
                "average_risk": 0,
                "max_risk": 0,
                "critical_count": 0,
            }
        
        risk_score = float(country.get("risk_score", 0))
        regional_heatmap[region]["countries"].append({
            "code": country.get("country_code"),
            "name": country.get("country_name"),
            "risk_score": risk_score,
            "risk_level": country.get("risk_level"),
            "lat": country.get("lat"),
            "lng": country.get("lng"),
        })
        regional_heatmap[region]["average_risk"] += risk_score
        regional_heatmap[region]["max_risk"] = max(regional_heatmap[region]["max_risk"], risk_score)
        if risk_score >= 80:
            regional_heatmap[region]["critical_count"] += 1
    
    # Calculate averages
    for region in regional_heatmap:
        if regional_heatmap[region]["countries"]:
            regional_heatmap[region]["average_risk"] = round(regional_heatmap[region]["average_risk"] / len(regional_heatmap[region]["countries"]), 1)
    
    return {
        "heatmap": regional_heatmap,
        "hottest_regions": sorted([(r, regional_heatmap[r]["average_risk"]) for r in regional_heatmap], key=lambda x: x[1], reverse=True)[:5],
        "global_average_risk": round(sum(c.get("risk_score", 0) for c in countries) / max(len(countries), 1), 1) if countries else 0,
    }


@app.get("/api/events/recent")
def get_recent_events(limit: int = 20) -> dict:
    """Get recent events with full details."""
    data = pipeline.process()
    events = data.get("events", [])
    
    # Sort by timestamp (newest first)
    sorted_events = sorted(events, key=lambda e: e.get("timestamp", ""), reverse=True)[:limit]
    
    return {
        "events": sorted_events,
        "total_available": len(events),
        "returned_count": len(sorted_events),
    }


@app.post("/api/signal-preferences")
def set_signal_preferences(preferences: dict) -> dict:
    """Store user preferences for trading signals."""
    return {
        "success": True,
        "message": "Signal preferences updated successfully",
        "preferences": preferences,
    }


@app.websocket("/ws/stream")
async def stream_updates(websocket: WebSocket) -> None:
    """Lightweight websocket stream for live dashboard updates."""
    await websocket.accept()
    try:
        while True:
            snapshot = pipeline.process()
            await websocket.send_json({"type": "snapshot", "data": snapshot})
            await asyncio.sleep(12)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()


@app.websocket("/ws/stream/v2")
async def stream_updates_v2(websocket: WebSocket) -> None:
    """Enriched websocket stream; additive to keep v1 intact."""
    await websocket.accept()
    ai = LocalMLPipeline()
    try:
        while True:
            data = ai.process()
            await websocket.send_json({
                "type": "snapshot_v2",
                "data": {
                    "events": data.get("events", []),
                    "signals": data.get("signals", []),
                    "countries": data.get("countries", []),
                    "gti": data.get("gti", 0),
                    "gti_delta": data.get("gti_delta", 0),
                    "last_updated": data.get("last_updated"),
                    # World Monitor intelligence payload
                    "cii_scores": data.get("cii_scores", []),
                    "anomalies": data.get("anomalies", []),
                    "focal_points": data.get("focal_points", []),
                    "convergence_alerts": data.get("convergence_alerts", []),
                    "source_tier_summary": data.get("source_tier_summary", {}),
                },
            })
            await asyncio.sleep(12)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()
