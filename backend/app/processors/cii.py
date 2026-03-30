"""
Country Instability Index (CII) Calculator.

Computes a real-time composite instability score (0-100) for each monitored country
using a weighted blend of four components:
  - Baseline structural risk (40%)
  - Unrest events / protest activity (20%)
  - Security / military activity (20%)
  - Information velocity / news mention frequency (20%)

Additional boosts are applied for hotspot proximity, focal point appearances,
and hard minimum floors are enforced for active conflict zones.

Methodology adapted from World Monitor (https://github.com/koala73/worldmonitor).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# -- Hard floors for active conflict zones -------------------------------------
CONFLICT_FLOORS: dict[str, float] = {
    "UKR": 55.0, "SYR": 50.0, "AFG": 65.0, "YEM": 62.0,
    "SDN": 58.0, "MMR": 50.0, "LBY": 48.0, "MLI": 45.0,
    "NER": 44.0, "BFA": 43.0, "SOM": 60.0, "HTI": 52.0,
    "ETH": 40.0, "IRQ": 45.0, "LBN": 48.0,
}

# -- Country governance type for protest scoring ------------------------------
# True = democracy (protests are routine, use log scale)
# False = authoritarian (every protest is significant, use linear scale)
IS_DEMOCRACY: dict[str, bool] = {
    "USA": True, "GBR": True, "FRA": True, "DEU": True, "AUS": True,
    "CAN": True, "JPN": True, "KOR": True, "IND": True, "BRA": True,
    "ARG": True, "ZAF": True, "IDN": True, "MEX": True, "TUR": True,
    "ISR": True, "TWN": True, "SGP": True, "POL": True, "CZE": True,
    "RUS": False, "CHN": False, "IRN": False, "SAU": False, "PRK": False,
    "BLR": False, "AZE": False, "UZB": False, "TJK": False, "TKM": False,
    "VEN": False, "CUB": False, "NIC": False, "ZWE": False, "ERI": False,
}

# -- Severity weights for news velocity scoring --------------------------------
SEVERITY_VELOCITY_WEIGHT: dict[str, float] = {
    "critical": 3.0, "high": 2.0, "medium": 1.0, "low": 0.3,
}


@dataclass
class CIIComponents:
    baseline: float = 0.0
    unrest: float = 0.0
    security: float = 0.0
    velocity: float = 0.0
    hotspot_boost: float = 0.0
    focal_boost: float = 0.0
    floor_applied: bool = False
    final_score: float = 0.0


@dataclass
class CIIResult:
    country_code: str
    score: float
    risk_level: str
    components: CIIComponents
    trend: str = "stable"  # "rising" | "falling" | "stable"


class CIICalculator:
    """Calculates Country Instability Index scores for all monitored countries."""

    def __init__(self) -> None:
        data_dir = Path(__file__).resolve().parents[1] / "data"
        baseline_file = data_dir / "baseline_risk.json"
        if baseline_file.exists():
            with baseline_file.open() as f:
                self._baseline: dict[str, float] = json.load(f)
        else:
            self._baseline = {}
        self._history: dict[str, list[float]] = {}

    def _baseline_score(self, country_code: str) -> float:
        return float(self._baseline.get(country_code, 20.0))

    def _unrest_score(self, country_code: str, events: list[dict[str, Any]]) -> float:
        """
        Score protest/unrest events.
        - Democracies: log scale (protests are normal background noise)
        - Authoritarian: linear scale (any protest is significant)
        - Bonus: +15 for events with fatalities, +10 for internet outage events
        """
        protest_events = [
            e for e in events
            if e.get("event_type") in ("Protest", "Unrest", "Riot")
            and e.get("country_code") == country_code
        ]
        count = len(protest_events)
        if count == 0:
            return 0.0

        is_demo = IS_DEMOCRACY.get(country_code, True)
        raw = math.log1p(count) * 8.0 if is_demo else count * 12.0

        severity_sum = sum(
            {"critical": 3.0, "high": 2.0, "medium": 1.0, "low": 0.3}.get(
                e.get("severity", "low"), 0.3
            )
            for e in protest_events
        )
        raw = raw * (1.0 + severity_sum * 0.1)
        return min(raw, 40.0)

    def _security_score(
        self,
        country_code: str,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]],
        naval_tracks: list[dict[str, Any]],
    ) -> float:
        """
        Score based on military/security activity near or by the country.
        - Own military flights near hotspots: +3 pts each (up to 10 flights)
        - Own naval vessels: +5 pts each (up to 5 vessels)
        - Foreign military presence: double weight
        """
        score = 0.0
        own_flights = [t for t in military_tracks if t.get("country") == country_code]
        foreign_flights = [t for t in military_tracks if t.get("country") != country_code and t.get("near_country") == country_code]
        own_vessels = [v for v in naval_tracks if v.get("flag") == country_code]
        foreign_vessels = [v for v in naval_tracks if v.get("flag") != country_code and v.get("near_country") == country_code]

        score += min(len(own_flights), 10) * 3.0
        score += min(len(own_vessels), 5) * 5.0
        score += min(len(foreign_flights), 5) * 6.0
        score += min(len(foreign_vessels), 3) * 10.0

        mil_events = [
            e for e in events
            if e.get("event_type") == "Military"
            and e.get("country_code") == country_code
        ]
        score += len(mil_events) * 4.0

        return min(score, 40.0)

    def _velocity_score(self, country_code: str, events: list[dict[str, Any]]) -> float:
        country_events = [e for e in events if e.get("country_code") == country_code]
        if not country_events:
            return 0.0
        weighted_count = sum(
            SEVERITY_VELOCITY_WEIGHT.get(e.get("severity", "low"), 0.3)
            for e in country_events
        )
        raw = math.log1p(weighted_count) * 10.0
        return min(raw, 40.0)

    def score_country(
        self,
        country_code: str,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]] | None = None,
        naval_tracks: list[dict[str, Any]] | None = None,
        focal_points: list[str] | None = None,
        hotspot_codes: list[str] | None = None,
    ) -> CIIResult:
        military_tracks = military_tracks or []
        naval_tracks = naval_tracks or []
        focal_points = focal_points or []
        hotspot_codes = hotspot_codes or []

        baseline = self._baseline_score(country_code) * 0.4
        unrest = self._unrest_score(country_code, events) * 0.2
        security = self._security_score(country_code, events, military_tracks, naval_tracks) * 0.2
        velocity = self._velocity_score(country_code, events) * 0.2

        raw = baseline + unrest + security + velocity

        hotspot_boost = 5.0 if country_code in hotspot_codes else 0.0
        focal_boost = 10.0 if country_code in focal_points else 0.0
        raw += hotspot_boost + focal_boost

        floor = CONFLICT_FLOORS.get(country_code, 0.0)
        floor_applied = raw < floor
        final = max(raw, floor)
        final = round(min(final, 100.0), 1)

        hist = self._history.get(country_code, [])
        trend = "stable"
        if len(hist) >= 2:
            delta = final - hist[-1]
            if delta > 3:
                trend = "rising"
            elif delta < -3:
                trend = "falling"
        hist.append(final)
        self._history[country_code] = hist[-48:]

        risk_level = (
            "Critical" if final >= 75
            else "High" if final >= 55
            else "Medium" if final >= 35
            else "Low"
        )

        components = CIIComponents(
            baseline=round(baseline, 1),
            unrest=round(unrest, 1),
            security=round(security, 1),
            velocity=round(velocity, 1),
            hotspot_boost=hotspot_boost,
            focal_boost=focal_boost,
            floor_applied=floor_applied,
            final_score=final,
        )

        return CIIResult(
            country_code=country_code,
            score=final,
            risk_level=risk_level,
            components=components,
            trend=trend,
        )

    def score_all(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]] | None = None,
        naval_tracks: list[dict[str, Any]] | None = None,
        focal_points: list[str] | None = None,
    ) -> dict[str, CIIResult]:
        codes = set(self._baseline.keys())
        codes.update(e.get("country_code", "") for e in events if e.get("country_code"))

        hotspot_codes = [
            code for code in codes
            if self._baseline_score(code) >= 50
            or any(e.get("severity") == "critical" and e.get("country_code") == code for e in events)
        ]

        return {
            code: self.score_country(
                code, events, military_tracks, naval_tracks,
                focal_points, hotspot_codes
            )
            for code in codes if code
        }
