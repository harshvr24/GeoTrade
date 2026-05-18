"""
Welford's Online Algorithm for Streaming Anomaly Detection.

Maintains numerically stable rolling mean and variance for event counts
per (region, event_type, weekday, month) combination. Detects statistically
significant deviations from learned baselines.

Algorithm: Welford (1962) -- single-pass, numerically stable.
Reference: https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm

Thresholds:
  z >= 1.5: LOW anomaly
  z >= 2.0: MEDIUM anomaly
  z >= 3.0: HIGH / CRITICAL anomaly
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any

THRESHOLDS = [
    (3.0, "critical"),
    (2.0, "medium"),
    (1.5, "low"),
]

MIN_SAMPLES = 10


@dataclass
class WelfordState:
    count: int = 0
    mean: float = 0.0
    m2: float = 0.0

    def variance(self) -> float:
        return self.m2 / self.count if self.count > 1 else 0.0

    def std_dev(self) -> float:
        return math.sqrt(self.variance())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "WelfordState":
        return cls(**d)


@dataclass
class AnomalyAlert:
    region: str
    event_type: str
    z_score: float
    severity: str
    observed: float
    baseline_mean: float
    baseline_std: float
    multiplier: float
    message: str
    timestamp: str


class WelfordDetector:
    TRACKED_TYPES = [
        "military_flights", "naval_vessels", "protests",
        "news_velocity", "ais_gaps", "satellite_fires", "internet_outages",
    ]

    REGIONS = [
        "middle_east", "eastern_europe", "western_europe", "east_asia",
        "south_asia", "north_america", "sub_saharan_africa",
        "north_africa", "central_asia", "latin_america", "oceania",
    ]

    def __init__(self, redis_client: Any = None) -> None:
        self._redis = redis_client
        self._memory: dict[str, WelfordState] = {}

    def _make_key(self, region: str, event_type: str, weekday: int, month: int) -> str:
        return f"welford:{region}:{event_type}:wd{weekday}:m{month}"

    def _load_state(self, key: str) -> WelfordState:
        if self._redis is not None:
            try:
                raw = self._redis.get(key)
                if raw:
                    return WelfordState.from_dict(json.loads(raw))
            except Exception:
                pass
        return self._memory.get(key, WelfordState())

    def _save_state(self, key: str, state: WelfordState) -> None:
        if self._redis is not None:
            try:
                self._redis.set(key, json.dumps(state.to_dict()), ex=60 * 60 * 24 * 90)
                return
            except Exception:
                pass
        self._memory[key] = state

    def _welford_update(self, state: WelfordState, value: float) -> WelfordState:
        state.count += 1
        delta = value - state.mean
        state.mean += delta / state.count
        delta2 = value - state.mean
        state.m2 += delta * delta2
        return state

    def update(self, region: str, event_type: str, value: float, dt: datetime | None = None) -> WelfordState:
        dt = dt or datetime.now(timezone.utc)
        key = self._make_key(region, event_type, dt.weekday(), dt.month)
        state = self._load_state(key)
        state = self._welford_update(state, value)
        self._save_state(key, state)
        return state

    def z_score(self, region: str, event_type: str, value: float, dt: datetime | None = None) -> float | None:
        dt = dt or datetime.now(timezone.utc)
        key = self._make_key(region, event_type, dt.weekday(), dt.month)
        state = self._load_state(key)
        if state.count < MIN_SAMPLES:
            return None
        std = state.std_dev()
        if std < 0.01:
            return None
        return (value - state.mean) / std

    def check_anomaly(
        self,
        region: str,
        event_type: str,
        count: float,
        dt: datetime | None = None,
    ) -> AnomalyAlert | None:
        dt = dt or datetime.now(timezone.utc)
        z = self.z_score(region, event_type, count, dt)
        if z is None:
            return None

        severity = None
        for threshold, label in THRESHOLDS:
            if z >= threshold:
                severity = label
                break
        if severity is None:
            return None

        key = self._make_key(region, event_type, dt.weekday(), dt.month)
        state = self._load_state(key)

        weekday_name = dt.strftime("%A")
        month_name = dt.strftime("%B")
        multiplier = round(count / max(state.mean, 0.01), 1)

        type_labels = {
            "military_flights": "Military flights",
            "naval_vessels": "Naval vessels",
            "protests": "Protest events",
            "news_velocity": "News mentions",
            "ais_gaps": "AIS signal gaps",
            "satellite_fires": "Satellite-detected fires",
            "internet_outages": "Internet outages",
        }
        label = type_labels.get(event_type, event_type.replace("_", " ").title())
        region_display = region.replace("_", " ").title()

        message = (
            f"{label} {multiplier}x normal for {weekday_name} ({month_name}) "
            f"in {region_display} [z={z:.1f}]"
        )

        return AnomalyAlert(
            region=region,
            event_type=event_type,
            z_score=round(z, 2),
            severity=severity,
            observed=count,
            baseline_mean=round(state.mean, 2),
            baseline_std=round(state.std_dev(), 2),
            multiplier=multiplier,
            message=message,
            timestamp=dt.isoformat(),
        )

    def run_all_checks(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]] | None = None,
        naval_tracks: list[dict[str, Any]] | None = None,
        dt: datetime | None = None,
    ) -> list[AnomalyAlert]:
        dt = dt or datetime.now(timezone.utc)
        military_tracks = military_tracks or []
        naval_tracks = naval_tracks or []

        alerts: list[AnomalyAlert] = []
        region_map = self._events_to_region_counts(events, military_tracks, naval_tracks)

        for region, type_counts in region_map.items():
            for event_type, count in type_counts.items():
                self.update(region, event_type, float(count), dt)
                alert = self.check_anomaly(region, event_type, float(count), dt)
                if alert:
                    alerts.append(alert)

        alerts.sort(key=lambda a: a.z_score, reverse=True)
        return alerts

    def _events_to_region_counts(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]],
        naval_tracks: list[dict[str, Any]],
    ) -> dict[str, dict[str, float]]:
        region_norm: dict[str, str] = {
            "Middle East": "middle_east",
            "Europe": "western_europe",
            "E. Europe": "eastern_europe",
            "Eastern Europe": "eastern_europe",
            "Asia": "east_asia",
            "E. Asia": "east_asia",
            "East Asia": "east_asia",
            "SE. Asia": "east_asia",
            "South Asia": "south_asia",
            "S. Asia": "south_asia",
            "North America": "north_america",
            "N. America": "north_america",
            "Africa": "sub_saharan_africa",
            "Latin America": "latin_america",
            "S. America": "latin_america",
            "Oceania": "oceania",
            "Central Asia": "central_asia",
        }

        counts: dict[str, dict[str, float]] = {r: {t: 0.0 for t in self.TRACKED_TYPES} for r in self.REGIONS}

        for ev in events:
            raw_region = ev.get("region", "")
            region = region_norm.get(raw_region)
            if not region:
                continue
            ev_type = ev.get("event_type", "")
            if ev_type in ("Military", "Sanctions"):
                counts[region]["military_flights"] += 1.0
            if ev_type in ("Protest", "Unrest"):
                counts[region]["protests"] += 1.0
            counts[region]["news_velocity"] += 1.0

        for track in military_tracks:
            region = region_norm.get(track.get("region", ""), "middle_east")
            counts.get(region, {})["military_flights"] = counts.get(region, {}).get("military_flights", 0) + 1.0

        for vessel in naval_tracks:
            region = region_norm.get(vessel.get("region", ""), "middle_east")
            counts.get(region, {})["naval_vessels"] = counts.get(region, {}).get("naval_vessels", 0) + 1.0

        return counts
