from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.feature_extraction.text import TfidfVectorizer

SEVERITY_WEIGHT = {"critical": 83, "high": 70, "medium": 53, "low": 24}
COUNTRY_COORDS = {
    "IRN": (32.4279, 53.6880),
    "SAU": (23.8859, 45.0792),
    "DEU": (51.1657, 10.4515),
    "FRA": (46.2276, 2.2137),
    "IND": (20.5937, 78.9629),
    "USA": (37.0902, -95.7129),
    "CHN": (35.8617, 104.1954),
    "RUS": (61.5240, 105.3188),
    "UKR": (48.3794, 31.1656),
    "ISR": (31.0461, 34.8516),
    "LBN": (33.8547, 35.8623),
    "TWN": (23.6978, 120.9605),
    "JPN": (36.2048, 138.2529),
}
ARC_TYPES = ["Military", "Sanctions", "Trade", "Diplomatic"]

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")


@dataclass
class ProcessedEvent:
    payload: dict[str, Any]
    event_type: str
    sentiment: float
    narrative_cluster: int
    risk_score: float


class LocalMLPipeline:
    """Local NLP/ML-inspired pipeline for the GeoTrade dashboard."""

    def __init__(self) -> None:
        self.base_path = Path(__file__).resolve().parents[1]
        self.events_file = self.base_path / "data" / "events.json"
        self.vectorizer = TfidfVectorizer(max_features=400, ngram_range=(1, 2))
        self.cluster_model = MiniBatchKMeans(n_clusters=4, random_state=42, n_init="auto")
        self.market_model = self._train_market_model()

    def _train_market_model(self):
        """Lightweight heuristic model: no training, avoids multiprocessing."""

        def predict(batch: np.ndarray) -> np.ndarray:
            batch = np.asarray(batch, dtype=float)
            gti, stress, regime, hotspots = batch.T
            score = 0.35 + 0.004 * gti + 0.5 * np.abs(stress) + 0.02 * regime + 0.015 * hotspots
            return np.clip(score, 0.0, 1.0)

        return predict

    def load_events(self) -> list[dict[str, Any]]:
        with self.events_file.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def classify_event(self, text: str) -> str:
        lower = text.lower()
        mapping = {
            "Military": ["drill", "naval", "readiness", "border", "incursion", "intercepts"],
            "Sanctions": ["restriction", "sanction", "export", "compliance"],
            "Trade": ["supply", "trade", "macro", "equities", "transit"],
            "Diplomatic": ["statement", "briefing", "dialogue", "emergency"],
        }
        for label, tokens in mapping.items():
            if any(token in lower for token in tokens):
                return label
        return "Diplomatic"

    def sentiment_score(self, text: str) -> float:
        negative_tokens = ["stress", "risk", "escalate", "escalation", "anxiety", "friction", "weakens", "higher"]
        positive_tokens = ["strength", "improves", "support", "stabilize"]
        positive = sum(token in text.lower() for token in positive_tokens) * 0.12
        negative = sum(token in text.lower() for token in negative_tokens) * 0.16
        return float(np.clip(positive - negative, -1.0, 1.0))

    def cluster_narratives(self, headlines: list[str]) -> list[int]:
        vectors = self.vectorizer.fit_transform(headlines)
        return self.cluster_model.fit_predict(vectors).tolist()

    def score_event(self, event: dict[str, Any], sentiment: float) -> float:
        base = SEVERITY_WEIGHT.get(event["severity"], 40)
        stress = abs(min(0.0, sentiment)) * 18
        regional_bonus = 5 if event["region"] in {"Middle East", "Europe", "East Asia"} else 2
        return float(np.clip(base + stress + regional_bonus, 0, 100))

    def risk_level(self, score: float) -> str:
        if score >= 80:
            return "Critical"
        if score >= 60:
            return "High"
        if score >= 35:
            return "Medium"
        return "Low"

    def process(self) -> dict[str, Any]:
        raw = self.load_events()
        clusters = self.cluster_narratives([event["headline"] for event in raw])
        processed: list[ProcessedEvent] = []

        for index, event in enumerate(raw):
            event_type = self.classify_event(event["headline"])
            sentiment = self.sentiment_score(event["headline"])
            risk_score = self.score_event(event, sentiment)
            processed.append(
                ProcessedEvent(
                    payload=event,
                    event_type=event_type,
                    sentiment=sentiment,
                    narrative_cluster=clusters[index],
                    risk_score=risk_score,
                )
            )

        raw_gti = float(np.mean([event.risk_score for event in processed]))
        gti = round(raw_gti * 0.92, 1)
        cluster_stress = float(np.mean([abs(min(0.0, event.sentiment)) for event in processed]))
        active_hotspots = float(sum(event.risk_score >= 70 for event in processed))
        regime = float(max(event.narrative_cluster for event in processed))
        vol_score = float(self.market_model(np.array([[gti, cluster_stress, regime, active_hotspots]], dtype=float))[0])

        signals = self._signals(gti, vol_score)
        countries = self._countries(processed)
        events = [self._event_payload(event) for event in processed]
        focus_signal = next(signal for signal in signals if signal["asset"] == "XAU/USD")

        return {
            "gti": gti,
            "gti_delta": 1.8,
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "countries": countries,
            "events": events,
            "signals": signals,
            "focus_signal": focus_signal,
            "arc_categories": ARC_TYPES,
            "waitlist_enabled": True,
        }

    def _event_payload(self, event: ProcessedEvent) -> dict[str, Any]:
        payload = dict(event.payload)
        payload["risk_score"] = round(event.risk_score, 1)
        payload["sentiment"] = round(event.sentiment, 3)
        payload["event_type"] = event.event_type
        payload["narrative_cluster"] = event.narrative_cluster
        return payload

    def _countries(self, events: list[ProcessedEvent]) -> list[dict[str, Any]]:
        grouped: dict[str, dict[str, Any]] = {}
        for event in events:
            code = event.payload["country_code"]
            grouped.setdefault(
                code,
                {
                    "country_name": event.payload["country_name"],
                    "region": event.payload["region"],
                    "scores": [],
                    "events": [],
                },
            )
            grouped[code]["scores"].append(event.risk_score)
            grouped[code]["events"].append(event.payload["headline"])

        countries = []
        for code, item in grouped.items():
            lat, lng = COUNTRY_COORDS.get(code, (0.0, 0.0))
            risk_score = float(np.mean(item["scores"]))
            countries.append(
                {
                    "country_code": code,
                    "country_name": item["country_name"],
                    "region": item["region"],
                    "risk_score": round(risk_score, 1),
                    "risk_level": self.risk_level(risk_score),
                    "lat": lat,
                    "lng": lng,
                    "event_count": len(item["events"]),
                    "summary": item["events"][0],
                }
            )
        return sorted(countries, key=lambda country: country["risk_score"], reverse=True)

    def _signals(self, gti: float, vol_score: float) -> list[dict[str, Any]]:
        return [
            {
                "asset": "XAU/USD",
                "market": "Commodities",
                "action": "BUY",
                "move": "+1.4%",
                "entry": "3348.20",
                "confidence": round(min(0.95, 0.58 + vol_score * 0.35), 2),
                "rationale": "Safe-haven flows are accelerating as geopolitical stress stays elevated across the Middle East and Europe.",
                "horizon": "24-72h",
                "risk_flags": ["Sudden de-escalation", "Strong INR data"],
            },
            {
                "asset": "INR/USD",
                "market": "Commodities",
                "action": "BUY",
                "move": "+1.2%",
                "entry": "0.0120",
                "confidence": 0.74,
                "rationale": "Strong domestic macro signals create tactical divergence against the broader risk backdrop.",
                "horizon": "24h",
                "risk_flags": ["USD squeeze", "Oil rebound"],
            },
            {
                "asset": "SPX",
                "market": "Equities",
                "action": "SELL",
                "move": "+1.5%",
                "entry": "5120.30",
                "confidence": round(min(0.9, 0.5 + gti / 180), 2),
                "rationale": "Elevated GTI is reducing broad equity risk appetite and increasing macro hedge demand.",
                "horizon": "1-3 sessions",
                "risk_flags": ["Soft CPI surprise", "Policy reassurance"],
            },
        ]
