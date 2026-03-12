from pydantic import BaseModel
from typing import List


class TradingSignal(BaseModel):
    asset: str
    bias: str
    confidence: float
    rationale: str


class EventItem(BaseModel):
    id: str
    country_code: str
    country_name: str
    headline: str
    source: str
    severity: str
    market_impact: str
    sentiment: float
    risk_score: float
    timestamp: str


class CountryRisk(BaseModel):
    country_code: str
    country_name: str
    risk_score: float


class DashboardResponse(BaseModel):
    gti: float
    last_updated: str
    countries: List[CountryRisk]
    events: List[EventItem]
    signals: List[TradingSignal]
