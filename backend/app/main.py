from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ml.pipeline import LocalMLPipeline
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard() -> dict:
    return pipeline.process()


@app.get("/api/country/{country_code}")
def country(country_code: str) -> dict:
    data = pipeline.process()
    code = country_code.upper()
    country_data = next((c for c in data["countries"] if c["country_code"] == code), None)
    country_events = [e for e in data["events"] if e["country_code"] == code]
    if not country_data or not country_events:
        raise HTTPException(status_code=404, detail="Country not found")

    return {
        "country": country_data,
        "events": country_events,
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
    feeds_data = [
        {
            "id": "f1",
            "time": "08:30",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "headline": "Strait of Hormuz Naval Drills Escalate Tensions",
            "region": "Middle East",
            "severity": "critical",
            "source": "Reuters",
            "impact": "+2.1% oil bid",
            "countries": ["IRN", "SAU"],
            "sentiment": -0.85,
        },
        {
            "id": "f2",
            "time": "07:50",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "headline": "ECB Emergency Statement Raises Rate Path Uncertainty",
            "region": "Europe",
            "severity": "high",
            "source": "Bloomberg",
            "impact": "+1.2% EUR volatility",
            "countries": ["DEU", "FRA"],
            "sentiment": -0.62,
        },
    ]

    return {
        "feeds": feeds_data,
        "total_count": len(feeds_data),
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }
