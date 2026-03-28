from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class TradingSignal(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: Optional[str] = None
    asset: str
    market: str
    action: str
    move: str
    entry: str
    confidence: float
    rationale: str
    horizon: str
    risk_flags: List[str]
    volatility: Optional[str] = None
    bull_strength: Optional[int] = None
    bear_strength: Optional[int] = None
    timeframes: Optional[List[str]] = None
    trigger: Optional[str] = None
    trigger_sub: Optional[str] = None
    market_impact: Optional[float] = None
    rr: Optional[str] = None
    win_rate: Optional[str] = None
    risk_mod: Optional[str] = None
    risk_amount: Optional[float] = None
    reward_amount: Optional[float] = None


class EventItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    country_code: str
    country_name: str
    region: str
    headline: str
    source: str
    severity: str
    market_impact: float
    sentiment: float
    risk_score: float
    timestamp: str
    event_type: str
    narrative_cluster: int
    affected_assets: Optional[List[str]] = None
    time: Optional[str] = None
    related_country_code: Optional[str] = None
    related_country_name: Optional[str] = None


class CountryRisk(BaseModel):
    country_code: str
    country_name: str
    region: str
    risk_score: float
    risk_level: str
    lat: float
    lng: float
    event_count: int
    summary: str


class DashboardResponse(BaseModel):
    gti: float
    gti_delta: float
    last_updated: str
    countries: List[CountryRisk]
    events: List[EventItem]
    signals: List[TradingSignal]
    focus_signal: TradingSignal
    signal_summary: Optional[dict] = None
    arc_categories: List[str]
    waitlist_enabled: bool


class WaitlistRequest(BaseModel):
    email: str
    name: Optional[str] = None


class WaitlistResponse(BaseModel):
    success: bool
    message: str


class Position(BaseModel):
    id: str
    asset: str
    size: float
    entry_price: float
    current_price: float
    pnl: float
    pnl_pct: float
    risk_ratio: float
    time_open: str
    signal: str
    status: str


class PortfolioMetrics(BaseModel):
    win_rate: float
    sharpe_ratio: float
    max_drawdown: float
    avg_win: float
    avg_loss: float


class Portfolio(BaseModel):
    total_value: float
    total_pnl: float
    total_pnl_pct: float
    positions: List[Position]
    metrics: PortfolioMetrics


class PortfolioResponse(BaseModel):
    portfolio: Portfolio
    last_updated: str


class FeedEvent(BaseModel):
    id: str
    time: str
    timestamp: str
    headline: str
    region: str
    severity: str
    source: str
    impact: str
    countries: List[str]
    sentiment: float


class FeedsResponse(BaseModel):
    feeds: List[FeedEvent]
    total_count: int
    last_updated: str


class MarketItem(BaseModel):
    symbol: str
    name: str
    price: float
    change_pct: float
    volume: Optional[float] = None
    sector: Optional[str] = None


class NewsItem(BaseModel):
    id: str
    headline: str
    source: str
    timestamp: str
    severity: str
    impact: str
    sentiment: float


class CountryDetail(BaseModel):
    country: CountryRisk
    events: List[EventItem]
    markets: List[MarketItem]
    news: List[NewsItem]
    signals: List[TradingSignal]
