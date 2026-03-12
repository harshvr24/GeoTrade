from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ml.pipeline import LocalMLPipeline
from .schemas import DashboardResponse

app = FastAPI(title="GeoTrade API", version="1.0.0")
pipeline = LocalMLPipeline()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    country_events = [e for e in data["events"] if e["country_code"] == code]
    if not country_events:
        raise HTTPException(status_code=404, detail="Country not found")
    return {
        "country": code,
        "risk_score": round(sum(e["risk_score"] for e in country_events) / len(country_events), 2),
        "events": country_events,
        "signals": data["signals"],
    }
