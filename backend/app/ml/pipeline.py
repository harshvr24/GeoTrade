from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import HistGradientBoostingRegressor

SEVERITY_WEIGHT = {"critical": 95, "high": 72, "medium": 45, "low": 20}


@dataclass
class ProcessedEvent:
    payload: dict[str, Any]
    event_type: str
    sentiment: float
    narrative_cluster: int
    risk_score: float


class LocalMLPipeline:
    """Lightweight local ML pipeline that is Vercel-compatible (no heavyweight model downloads)."""

    def __init__(self) -> None:
        self.base_path = Path(__file__).resolve().parents[1]
        self.events_file = self.base_path / "data" / "events.json"
        self.vectorizer = TfidfVectorizer(max_features=300, ngram_range=(1, 2))
        self.cluster_model = MiniBatchKMeans(n_clusters=3, random_state=42, n_init="auto")
        self.market_model = self._train_market_model()

    def _train_market_model(self):
        x = np.array(
            [
                [20, -0.3, 0],
                [35, -0.1, 1],
                [50, 0.1, 1],
                [68, -0.5, 2],
                [82, -0.8, 2],
                [90, -0.9, 2],
                [44, 0.2, 0],
                [63, -0.4, 1],
                [76, -0.6, 2],
            ],
            dtype=float,
        )
        y = np.array([0.25, 0.35, 0.42, 0.58, 0.78, 0.86, 0.31, 0.51, 0.7], dtype=float)
        model = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.08, max_iter=120, random_state=42)
        model.fit(x, y)
        return model

    def load_events(self) -> list[dict[str, Any]]:
        with self.events_file.open("r", encoding="utf-8") as f:
            return json.load(f)

    def classify_event(self, text: str) -> str:
        lower = text.lower()
        if any(token in lower for token in ["drill", "defense", "maritime", "security"]):
            return "military"
        if any(token in lower for token in ["trade", "restriction", "tariff", "sanction"]):
            return "trade"
        if any(token in lower for token in ["pipeline", "oil", "shipping", "energy"]):
            return "energy"
        if "cyber" in lower:
            return "cyber"
        return "diplomatic"

    def sentiment_score(self, text: str) -> float:
        negative_tokens = ["disruption", "stall", "escalation", "alert", "risk", "conflict", "pressure"]
        positive_tokens = ["deal", "progress", "easing", "stability"]
        pos = sum(tok in text.lower() for tok in positive_tokens) * 0.17
        neg = sum(tok in text.lower() for tok in negative_tokens) * 0.2
        return float(np.clip(pos - neg, -1.0, 1.0))

    def cluster_narratives(self, headlines: list[str]) -> list[int]:
        vec = self.vectorizer.fit_transform(headlines)
        clusters = self.cluster_model.fit_predict(vec)
        return clusters.tolist()

    def score_event(self, event: dict[str, Any], sentiment: float) -> float:
        base = SEVERITY_WEIGHT.get(event["severity"], 40)
        stress_bonus = abs(min(0.0, sentiment)) * 20
        return float(np.clip(base + stress_bonus, 0, 100))

    def process(self) -> dict[str, Any]:
        raw = self.load_events()
        clusters = self.cluster_narratives([e["headline"] for e in raw])
        processed: list[ProcessedEvent] = []
        for i, event in enumerate(raw):
            event_type = self.classify_event(event["headline"])
            sentiment = self.sentiment_score(event["headline"])
            risk_score = self.score_event(event, sentiment)
            processed.append(
                ProcessedEvent(
                    payload=event,
                    event_type=event_type,
                    sentiment=sentiment,
                    narrative_cluster=clusters[i],
                    risk_score=risk_score,
                )
            )

        gti = float(np.mean([p.risk_score for p in processed]))
        cluster_stress = float(np.mean([abs(min(0.0, p.sentiment)) for p in processed]))
        regime = max(p.narrative_cluster for p in processed)
        vol_spike_prob = float(self.market_model.predict(np.array([[gti, -cluster_stress, regime]], dtype=float))[0])
        vol_spike_prob = float(np.clip(vol_spike_prob, 0.0, 1.0))

        signals = self._signals(gti, vol_spike_prob)
        countries = self._countries(processed)

        return {
            "gti": round(gti, 2),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "countries": countries,
            "events": [self._event_payload(p) for p in processed],
            "signals": signals,
        }

    def _event_payload(self, item: ProcessedEvent) -> dict[str, Any]:
        payload = dict(item.payload)
        payload["risk_score"] = round(item.risk_score, 2)
        payload["sentiment"] = round(item.sentiment, 3)
        payload["event_type"] = item.event_type
        payload["narrative_cluster"] = item.narrative_cluster
        return payload

    def _countries(self, events: list[ProcessedEvent]) -> list[dict[str, Any]]:
        score_by_code: dict[str, tuple[str, list[float]]] = {}
        for e in events:
            code = e.payload["country_code"]
            name = e.payload["country_name"]
            score_by_code.setdefault(code, (name, []))[1].append(e.risk_score)

        out = []
        for code, (name, scores) in score_by_code.items():
            out.append(
                {
                    "country_code": code,
                    "country_name": name,
                    "risk_score": round(float(np.mean(scores)), 2),
                }
            )
        return sorted(out, key=lambda x: x["risk_score"], reverse=True)

    def _signals(self, gti: float, vol_spike_prob: float) -> list[dict[str, Any]]:
        risk_on = gti < 45
        return [
            {
                "asset": "XAU/USD",
                "bias": "Bullish" if not risk_on else "Neutral",
                "confidence": round(min(0.95, 0.5 + vol_spike_prob * 0.5), 2),
                "rationale": "Safe-haven demand rises with geopolitical stress.",
            },
            {
                "asset": "SPX",
                "bias": "Bearish" if gti > 60 else "Neutral",
                "confidence": round(min(0.9, 0.45 + gti / 200), 2),
                "rationale": "Elevated tension historically compresses risk appetite.",
            },
            {
                "asset": "EUR/USD",
                "bias": "Bearish" if gti > 58 else "Range",
                "confidence": round(min(0.85, 0.4 + vol_spike_prob * 0.35), 2),
                "rationale": "Regional stress and energy uncertainty pressure EUR sentiment.",
            },
            {
                "asset": "BTC/USD",
                "bias": "Volatile Upside" if vol_spike_prob > 0.6 else "Two-way",
                "confidence": round(min(0.88, 0.42 + vol_spike_prob * 0.4), 2),
                "rationale": "Macro regime shifts increase cross-asset volatility transfer.",
            },
        ]
