from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import numpy as np
from collections import Counter

from ..news_integration import NewsIntegrator, NewsDataManager
from ..processors.cii import CIICalculator
from ..processors.anomaly import WelfordDetector
from ..processors.signal_aggregator import SignalAggregator
from ..providers.llm import LLMProvider

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


@dataclass
class ProcessedEvent:
    payload: dict[str, Any]
    event_type: str
    sentiment: float
    narrative_cluster: int
    risk_score: float


class LocalMLPipeline:
    """Local NLP/ML-inspired pipeline for the GeoTrade dashboard. No sklearn dependencies."""

    def __init__(self) -> None:
        self.base_path = Path(__file__).resolve().parents[1]
        self.events_file = self.base_path / "data" / "events.json"
        self.data_manager = NewsDataManager(self.base_path / "data")
        self._cached_events: list[dict[str, Any]] | None = None
        self._cache_ts: datetime | None = None
        self.cache_ttl = timedelta(minutes=5)
        # World Monitor processors — initialized once, reused across calls
        self._cii = CIICalculator()
        self._anomaly = WelfordDetector()
        self._aggregator = SignalAggregator()
        self._llm: LLMProvider | None = None

    def _get_llm(self) -> LLMProvider:
        if self._llm is None:
            self._llm = LLMProvider()
        return self._llm

    def load_events(self) -> list[dict[str, Any]]:
        """Load events from remote RSS feeds with fallback to curated data."""
        now = datetime.now(timezone.utc)
        if self._cached_events and self._cache_ts and now - self._cache_ts < self.cache_ttl:
            return self._cached_events

        events: list[dict[str, Any]] = []
        try:
            events = NewsIntegrator.fetch_rss_events(limit_per_feed=6)
        except Exception:
            events = []

        # If no live feed available, use curated seed data
        if not events:
            with self.events_file.open("r", encoding="utf-8") as handle:
                events = json.load(handle)
        else:
            # Blend a few curated examples to keep dataset rich
            curated = self.data_manager.load_events()
            if curated:
                events.extend(curated[:5])

        # Inject source tier metadata from sources.yaml
        events = self._enrich_with_source_tier(events)

        self._cached_events = events
        self._cache_ts = now
        return events

    def _enrich_with_source_tier(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Attach source_tier and state_affiliated from the sources registry."""
        try:
            from ..ingestion.sources import load_sources_registry
            registry = load_sources_registry()
            source_map: dict[str, dict[str, Any]] = {
                s["id"]: s for s in registry if hasattr(s, "get")
            }
            for ev in events:
                src_id = ev.get("source", "").lower().replace(" ", "-")
                src_entry = source_map.get(src_id)
                if not src_entry:
                    # Try partial match
                    for key, val in source_map.items():
                        if key in src_id or src_id in key:
                            src_entry = val
                            break
                if src_entry:
                    ev["source_tier"] = src_entry.get("tier")
                    ev["state_affiliated"] = src_entry.get("state_affiliated", False)
                else:
                    ev["source_tier"] = None
                    ev["state_affiliated"] = False
        except Exception:
            for ev in events:
                ev["source_tier"] = None
                ev["state_affiliated"] = False
        return events

    def classify_event(self, text: str) -> str:
        """Classify event type based on keywords."""
        lower = text.lower()
        mapping = {
            "Military": ["drill", "naval", "readiness", "border", "incursion", "intercepts", "military", "defense"],
            "Sanctions": ["restriction", "sanction", "export", "embargo", "compliance", "sanctions"],
            "Trade": ["supply", "trade", "macro", "equities", "transit", "commerce"],
            "Diplomatic": ["statement", "briefing", "dialogue", "emergency", "talks"],
        }
        for label, tokens in mapping.items():
            if any(token in lower for token in tokens):
                return label
        return "Diplomatic"

    def sentiment_score(self, text: str) -> float:
        """Calculate sentiment score from -1 to 1."""
        negative_tokens = ["stress", "risk", "escalate", "escalation", "anxiety", "friction", "weakens", "higher", "danger", "threat"]
        positive_tokens = ["strength", "improves", "support", "stabilize", "growth", "positive"]
        positive = sum(text.lower().count(token) for token in positive_tokens) * 0.12
        negative = sum(text.lower().count(token) for token in negative_tokens) * 0.16
        return float(np.clip(positive - negative, -1.0, 1.0))

    def simple_cluster(self, headlines: list[str], n_clusters: int = 4) -> list[int]:
        """Simple clustering based on keyword frequency."""
        if not headlines:
            return []

        clusters = []
        keywords_by_headline = []

        for headline in headlines:
            words = set(headline.lower().split())
            keywords_by_headline.append(words)

        cluster_keywords = [
            {"military", "defense", "naval", "border"},
            {"sanction", "embargo", "trade"},
            {"market", "economy", "equities", "price"},
            {"diplomatic", "talks", "agreement"},
        ]

        for keywords in keywords_by_headline:
            best_cluster = 0
            best_match = 0
            for idx, cluster_kw in enumerate(cluster_keywords):
                matches = len(keywords & cluster_kw)
                if matches > best_match:
                    best_cluster = idx
                    best_match = matches
            clusters.append(best_cluster)

        return clusters

    def score_event(self, event: dict[str, Any], sentiment: float) -> float:
        """Calculate risk score for an event."""
        base = SEVERITY_WEIGHT.get(event["severity"], 40)
        stress = abs(min(0.0, sentiment)) * 18
        regional_bonus = 5 if event.get("region") in {"Middle East", "Europe", "East Asia"} else 2
        return float(np.clip(base + stress + regional_bonus, 0, 100))

    def risk_level(self, score: float) -> str:
        """Convert risk score to risk level."""
        if score >= 80:
            return "Critical"
        if score >= 60:
            return "High"
        if score >= 35:
            return "Medium"
        return "Low"

    def market_signal(self, gti: float, vol_score: float) -> float:
        """Generate market signal score."""
        return 0.35 + 0.004 * gti + 0.5 * abs(vol_score) + 0.02 * gti / 100

    async def _generate_brief(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        """Generate AI world brief. Falls back to heuristic if no LLM key."""
        llm = self._get_llm()
        try:
            return await llm.synthesize_brief(events)
        except Exception:
            # Heuristic fallback
            top = sorted(events, key=lambda e: e.get("severity", "low"), reverse=True)[:5]
            critical = "; ".join([f"{e.get('country_code','GLOBAL')}: {e.get('headline','')}" for e in top])
            return {
                "brief": f"{critical}\n\nEnergy prices remain sensitive; FX mixed; risk assets cautious.\n\nMonitor escalation triggers, supply disruptions, and policy surprises in next 48h.",
                "sections": {
                    "critical": critical,
                    "markets": "Energy prices remain sensitive; FX mixed; risk assets cautious.",
                    "watchpoints": "Monitor escalation triggers, supply disruptions, and policy surprises in next 48h.",
                },
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source": "heuristic",
                "cached": False,
                "model": "heuristic",
            }

    def process(self) -> dict[str, Any]:
        """Process events and return dashboard data with World Monitor intelligence."""
        raw = self.load_events()
        if not raw:
            return self._empty_response()

        headlines = [event["headline"] for event in raw]
        clusters = self.simple_cluster(headlines)
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
        regime = float(max((event.narrative_cluster for event in processed), default=0))
        vol_score = self.market_signal(gti, cluster_stress)

        signals = self._signals(gti, vol_score, processed)
        countries = self._countries(processed)
        events_out = [self._event_payload(event) for event in processed]
        focus_signal = next((s for s in signals if s["asset"] == "XAU/USD"), signals[0] if signals else {})

        # World Monitor intelligence processors
        events_for_intel = events_out
        cii_results = self._cii.score_all(events_for_intel)
        anomaly_alerts = self._anomaly.run_all_checks(events_for_intel)
        agg_result = self._aggregator.aggregate(
            events_for_intel,
            military_tracks=[],
            naval_tracks=[],
        )

        # Build CII country list
        cii_countries = []
        for code, result in cii_results.items():
            cii_countries.append({
                "code": code,
                "score": result.score,
                "risk_level": result.risk_level,
                "trend": result.trend,
            })
        cii_countries.sort(key=lambda x: x["score"], reverse=True)

        # Build focal points
        focal_points = agg_result.get("focal_points", [])

        # Build convergence alerts
        convergence_alerts = agg_result.get("convergence_alerts", [])

        # Build anomaly list
        anomaly_list = [
            {
                "region": a.region,
                "event_type": a.event_type,
                "z_score": a.z_score,
                "severity": a.severity,
                "observed": a.observed,
                "baseline_mean": a.baseline_mean,
                "multiplier": a.multiplier,
                "message": a.message,
                "timestamp": a.timestamp,
            }
            for a in anomaly_alerts
        ]

        return {
            "gti": gti,
            "gti_delta": 1.8,
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "countries": countries,
            "events": events_out,
            "signals": signals,
            "signal_summary": self._signal_summary(signals),
            "focus_signal": focus_signal,
            "arc_categories": ARC_TYPES,
            "waitlist_enabled": True,
            # World Monitor intelligence fields
            "cii_scores": cii_countries,
            "anomalies": anomaly_list,
            "focal_points": focal_points,
            "convergence_alerts": convergence_alerts,
            "intelligence_gaps": [],  # computed in api_v2 /gaps endpoint
            "world_brief": None,  # populated asynchronously via /brief endpoint
            "source_tier_summary": self._source_tier_summary(events_out),
        }

    def _source_tier_summary(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        """Summarize event count by source tier."""
        tiers = {1: 0, 2: 0, 3: 0, 4: 0, None: 0}
        state_affil = 0
        for ev in events:
            tier = ev.get("source_tier")
            if tier in tiers:
                tiers[tier] += 1
            else:
                tiers[None] = tiers.get(None, 0) + 1
            if ev.get("state_affiliated"):
                state_affil += 1
        return {
            "by_tier": tiers,
            "state_affiliated_count": state_affil,
            "total": len(events),
        }

    def _empty_response(self) -> dict[str, Any]:
        """Return empty response when no events available."""
        return {
            "gti": 35.0,
            "gti_delta": 0.0,
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "countries": [],
            "events": [],
            "signals": [],
            "signal_summary": {"total": 0, "buy": 0, "sell": 0, "avg_confidence": 0.0},
            "focus_signal": {},
            "arc_categories": ARC_TYPES,
            "waitlist_enabled": True,
            "cii_scores": [],
            "anomalies": [],
            "focal_points": [],
            "convergence_alerts": [],
            "intelligence_gaps": [],
            "world_brief": None,
            "source_tier_summary": {"by_tier": {1: 0, 2: 0, 3: 0, 4: 0, None: 0}, "state_affiliated_count": 0, "total": 0},
        }

    def _event_payload(self, event: ProcessedEvent) -> dict[str, Any]:
        """Prepare event payload for response."""
        payload = dict(event.payload)
        payload["risk_score"] = round(event.risk_score, 1)
        payload["sentiment"] = round(event.sentiment, 3)
        payload["event_type"] = event.event_type
        payload["narrative_cluster"] = event.narrative_cluster
        payload["time"] = payload.get("time") or payload.get("timestamp", "")
        return payload

    def _countries(self, events: list[ProcessedEvent]) -> list[dict[str, Any]]:
        """Aggregate events by country."""
        grouped: dict[str, dict[str, Any]] = {}
        for event in events:
            code = event.payload.get("country_code", "UNKNOWN")
            grouped.setdefault(
                code,
                {
                    "country_name": event.payload.get("country_name", code),
                    "region": event.payload.get("region", "Unknown"),
                    "scores": [],
                    "events": [],
                },
            )
            grouped[code]["scores"].append(event.risk_score)
            grouped[code]["events"].append(event.payload.get("headline", ""))

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
                    "summary": item["events"][0] if item["events"] else "No summary",
                }
            )
        return sorted(countries, key=lambda country: country["risk_score"], reverse=True)

    def _signals(self, gti: float, vol_score: float, events: list[ProcessedEvent]) -> list[dict[str, Any]]:
        """Generate trading signals from enriched events; fall back to template signals."""
        signals: list[dict[str, Any]] = []

        for idx, event in enumerate(events):
            sig = NewsIntegrator.generate_trading_signal(event.payload)
            if not sig:
                continue

            asset_meta = self._asset_meta(sig["asset"])
            entry_price = asset_meta["price"]
            action = sig["action"]
            confidence = round(min(0.95, sig["confidence"] + abs(event.sentiment) * 0.2), 2)
            move_pct = sig.get("market_impact", 0) * (1 if action == "BUY" else -1)
            bull_strength = min(100, max(25, int(confidence * 100 * (0.8 if action == "BUY" else 0.6))))
            bear_strength = min(100, 100 - bull_strength)
            volatility = self._volatility_label(event.payload.get("severity", "medium"))

            signals.append(
                {
                    "id": sig.get("event_id") or f"s{idx+1}",
                    "asset": sig["asset"],
                    "market": asset_meta["market"],
                    "action": action,
                    "move": f"{move_pct:+.1f}%",
                    "entry": f"{entry_price:.2f}" if isinstance(entry_price, (int, float)) else str(entry_price),
                    "confidence": confidence,
                    "rationale": sig.get("triggered_by", event.payload.get("headline", "")),
                    "horizon": event.payload.get("horizon", "24-72h"),
                    "risk_flags": ["Ceasefire headlines", "Macro surprise risk"],
                    "volatility": volatility,
                    "bull_strength": bull_strength,
                    "bear_strength": bear_strength,
                    "timeframes": ["Short-Term", "Weekly"],
                    "trigger": sig.get("triggered_by", ""),
                    "trigger_sub": f"{event.payload.get('region', 'Global')} · {event.payload.get('severity', 'medium').title()} impact",
                    "market_impact": sig.get("market_impact", 0),
                    "rr": "1.8x",
                    "win_rate": f"{round(confidence * 100, 1)}%",
                    "risk_mod": f"{round(sig.get('market_impact', 0) * 1.3, 2)}%",
                    "risk_amount": round(0.02 * entry_price, 2) if isinstance(entry_price, (int, float)) else 0.0,
                    "reward_amount": round(0.04 * entry_price, 2) if isinstance(entry_price, (int, float)) else 0.0,
                    # Source tier metadata
                    "source_tier": event.payload.get("source_tier"),
                    "state_affiliated": event.payload.get("state_affiliated", False),
                }
            )

        if not signals:
            signals = self._fallback_signals(gti, vol_score)

        return signals[:12]

    def _asset_meta(self, asset: str) -> dict[str, Any]:
        price_map = {
            "XAU/USD": {"market": "Commodities", "price": 2314.58},
            "WTI": {"market": "Commodities", "price": 82.45},
            "WTI/USD": {"market": "Commodities", "price": 82.45},
            "SPX": {"market": "Equities", "price": 5280.30},
            "DAX": {"market": "Equities", "price": 17890.2},
            "EURUSD": {"market": "Forex", "price": 1.0821},
            "USD": {"market": "Forex", "price": 104.2},
            "BTCUSD": {"market": "Crypto", "price": 67240.0},
        }
        default = {"market": "Global", "price": 100.0}
        for key, meta in price_map.items():
            if asset.upper().startswith(key.replace("/", "")) or asset.upper() == key:
                return meta
        return default

    def _volatility_label(self, severity: str) -> str:
        sev = severity.lower()
        if sev == "critical":
            return "HIGH"
        if sev == "high":
            return "MEDIUM"
        return "LOW"

    def _fallback_signals(self, gti: float, vol_score: float) -> list[dict[str, Any]]:
        """Use legacy deterministic signals when no event-derived signals exist."""
        template = [
            ("XAU/USD", "BUY", 0.58 + vol_score * 0.35, "Safe-haven flows accelerating as stress persists."),
            ("WTI", "BUY", 0.62 + gti / 200, "Risk premium supports crude prices amid Strait tensions."),
            ("SPX", "SELL", 0.52 + gti / 180, "Elevated GTI dampens risk appetite."),
        ]
        signals = []
        for idx, (asset, action, conf, rationale) in enumerate(template, start=1):
            asset_meta = self._asset_meta(asset)
            confidence = round(min(0.95, conf), 2)
            move_pct = (0.8 + idx * 0.4) * (1 if action == "BUY" else -1)
            signals.append(
                {
                    "id": f"seed-{idx}",
                    "asset": asset,
                    "market": asset_meta["market"],
                    "action": action,
                    "move": f"{move_pct:+.1f}%",
                    "entry": f"{asset_meta['price']:.2f}",
                    "confidence": confidence,
                    "rationale": rationale,
                    "horizon": "24-72h",
                    "risk_flags": ["Sudden de-escalation", "Macro surprise"],
                    "volatility": self._volatility_label("high" if idx == 1 else "medium"),
                    "bull_strength": int(confidence * 100 * (0.85 if action == "BUY" else 0.45)),
                    "bear_strength": int(100 - confidence * 100 * (0.55 if action == "BUY" else 0.35)),
                    "timeframes": ["Short-Term", "Weekly"],
                    "trigger": rationale,
                    "trigger_sub": "Modelled fallback signal",
                    "market_impact": abs(move_pct) / 2,
                    "rr": "1.8x",
                    "win_rate": f"{round(confidence * 100, 1)}%",
                    "risk_mod": f"{round(abs(move_pct) * 0.6, 2)}%",
                    "risk_amount": round(0.02 * asset_meta["price"], 2),
                    "reward_amount": round(0.04 * asset_meta["price"], 2),
                    "source_tier": None,
                    "state_affiliated": False,
                }
            )
        return signals

    def _signal_summary(self, signals: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(signals)
        buys = sum(1 for s in signals if s.get("action") == "BUY")
        sells = sum(1 for s in signals if s.get("action") == "SELL")
        avg_conf = round(sum(s.get("confidence", 0) for s in signals) / total, 2) if total else 0.0
        return {"total": total, "buy": buys, "sell": sells, "avg_confidence": avg_conf}
