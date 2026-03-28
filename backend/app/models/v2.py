from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict


class EventV2(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    headline: str
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    region: Optional[str] = None
    severity: Optional[str] = None
    timestamp: Optional[str] = None
    event_type: Optional[str] = None
    market_impact: Optional[float] = None
    summary: Optional[str] = None
    entities: Optional[list] = None
    topics: Optional[list] = None
    threat_score: Optional[float] = None
    sentiment: Optional[float] = None
    risk_score: Optional[float] = None
    affected_assets: Optional[list] = None


class Layer(BaseModel):
    id: str
    label: str
    type: str
    enabled: bool = True


class LayerResponse(BaseModel):
    layers: List[Layer]
    updated_at: str


class CIIItem(BaseModel):
    code: str
    score: float
    sentiment: float


class CIIResponse(BaseModel):
    updated_at: Optional[str]
    gti: float
    top: List[CIIItem]


class AlertItem(BaseModel):
    id: Optional[str] = None
    type: Optional[str] = None
    message: Optional[str] = None
    severity: Optional[str] = None
    timestamp: Optional[str] = None
    data: Optional[Any] = None
