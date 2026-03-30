"""
Multi-Source Signal Aggregator.

Fuses heterogeneous intelligence signals (news events, military tracks, naval
vessels, protest data, satellite fires, internet outages) into a unified
geospatial intelligence picture.

Key outputs:
  - per_country_profiles: aggregated signals per country
  - convergence_alerts: geographic cells with 3+ distinct signal types
  - surge_alerts: countries/regions with event counts >2x rolling baseline
  - focal_points: entities appearing across multiple signal type categories
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ConvergenceAlert:
    cell_key: str
    lat: float
    lng: float
    signal_types: list[str]
    event_count: int
    score: float
    severity: str
    name: str
    timestamp: str


@dataclass
class FocalPoint:
    entity: str
    urgency_score: float
    signal_types: list[str]
    events: list[dict[str, Any]]


@dataclass
class CountryProfile:
    country_code: str
    country_name: str
    region: str
    signal_count: int
    signal_types: list[str]
    severity_distribution: dict[str, int]
    top_headline: str
    risk_score: float


KNOWN_AREAS = [
    {"name": "Strait of Hormuz", "lat": 26.6, "lng": 56.2, "radius": 3.0},
    {"name": "South China Sea", "lat": 12.0, "lng": 114.0, "radius": 8.0},
    {"name": "Eastern Mediterranean", "lat": 34.5, "lng": 33.0, "radius": 5.0},
    {"name": "Black Sea", "lat": 43.0, "lng": 34.0, "radius": 4.0},
    {"name": "Taiwan Strait", "lat": 24.5, "lng": 120.0, "radius": 3.0},
    {"name": "Gulf of Aden", "lat": 12.5, "lng": 47.0, "radius": 4.0},
    {"name": "Suez Canal", "lat": 30.5, "lng": 32.4, "radius": 2.0},
    {"name": "Bab el-Mandeb", "lat": 12.6, "lng": 43.3, "radius": 2.0},
    {"name": "Donbas Region", "lat": 48.0, "lng": 37.5, "radius": 3.0},
    {"name": "Gaza Strip", "lat": 31.4, "lng": 34.4, "radius": 1.5},
    {"name": "Korean Peninsula", "lat": 37.5, "lng": 127.5, "radius": 5.0},
    {"name": "Persian Gulf", "lat": 26.0, "lng": 51.0, "radius": 5.0},
    {"name": "Baltic Sea", "lat": 57.0, "lng": 19.0, "radius": 5.0},
    {"name": "Horn of Africa", "lat": 10.0, "lng": 45.0, "radius": 6.0},
    {"name": "Sahel Region", "lat": 14.0, "lng": 10.0, "radius": 8.0},
]


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2)


def _reverse_geocode(lat: float, lng: float) -> str:
    best_name = f"Grid ({lat:.1f}°, {lng:.1f}°)"
    best_dist = float("inf")
    for area in KNOWN_AREAS:
        dist = _haversine(lat, lng, area["lat"], area["lng"])
        if dist < area["radius"] and dist < best_dist:
            best_dist = dist
            best_name = area["name"]
    return best_name


class SignalAggregator:
    COUNTRY_COORDS: dict[str, tuple[float, float]] = {
        "IRN": (32.4, 53.7), "ISR": (31.0, 34.8), "RUS": (61.5, 105.3),
        "PRK": (40.3, 127.5), "DEU": (51.2, 10.5), "TWN": (23.7, 121.0),
        "CHN": (35.9, 104.2), "UKR": (48.4, 31.2), "USA": (37.1, -95.7),
        "IND": (20.6, 78.9), "GBR": (55.4, -3.4), "FRA": (46.2, 2.2),
        "SAU": (23.9, 45.1), "PAK": (30.4, 69.3), "SYR": (34.8, 38.9),
        "LBN": (33.9, 35.9), "TUR": (38.9, 35.2), "JPN": (36.2, 138.3),
        "NGA": (9.1, 8.7), "ZAF": (-30.6, 22.9), "AUS": (-25.3, 133.8),
        "BRA": (-14.2, -51.9), "EGY": (26.8, 30.8), "ETH": (9.1, 40.5),
        "YEM": (15.6, 48.5), "SOM": (5.2, 46.2), "SDN": (12.9, 30.2),
        "IRQ": (33.2, 43.7), "AFG": (33.9, 67.7), "MMR": (19.2, 96.7),
        "VEN": (6.4, -66.6), "MEX": (23.6, -102.6), "KOR": (35.9, 127.8),
    }

    def aggregate(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]] | None = None,
        naval_tracks: list[dict[str, Any]] | None = None,
        protest_data: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        military_tracks = military_tracks or []
        naval_tracks = naval_tracks or []
        protest_data = protest_data or []

        country_profiles = self._build_country_profiles(events, military_tracks, naval_tracks)
        grid_cells = self._bin_to_grid(events, military_tracks, naval_tracks, protest_data)
        convergence_alerts = self._detect_convergence(grid_cells)
        surge_alerts = self._detect_surges(country_profiles, events)
        focal_points = self._detect_focal_points(events, military_tracks)

        return {
            "country_profiles": {k: self._profile_to_dict(v) for k, v in country_profiles.items()},
            "convergence_alerts": [self._convergence_to_dict(c) for c in convergence_alerts],
            "surge_alerts": surge_alerts,
            "focal_points": [self._focal_to_dict(f) for f in focal_points],
            "signal_count": len(events) + len(military_tracks) + len(naval_tracks),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _build_country_profiles(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]],
        naval_tracks: list[dict[str, Any]],
    ) -> dict[str, CountryProfile]:
        profiles: dict[str, CountryProfile] = {}

        for ev in events:
            code = ev.get("country_code", "")
            if not code:
                continue
            if code not in profiles:
                profiles[code] = CountryProfile(
                    country_code=code,
                    country_name=ev.get("country_name", code),
                    region=ev.get("region", "Unknown"),
                    signal_count=0,
                    signal_types=[],
                    severity_distribution=defaultdict(int),
                    top_headline="",
                    risk_score=0.0,
                )
            p = profiles[code]
            p.signal_count += 1
            stype = ev.get("event_type", "News")
            if stype not in p.signal_types:
                p.signal_types.append(stype)
            sev = ev.get("severity", "low")
            p.severity_distribution[sev] = p.severity_distribution.get(sev, 0) + 1
            if not p.top_headline and ev.get("severity") in ("critical", "high"):
                p.top_headline = ev.get("headline", "")
            p.risk_score = max(p.risk_score, float(ev.get("risk_score", 0)))

        return profiles

    def _bin_to_grid(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]],
        naval_tracks: list[dict[str, Any]],
        protest_data: list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        grid: dict[str, dict[str, Any]] = {}

        def add_to_grid(lat: float, lng: float, signal_type: str) -> None:
            cell = f"{int(lat)}:{int(lng)}"
            if cell not in grid:
                grid[cell] = {
                    "lat": float(int(lat)) + 0.5,
                    "lng": float(int(lng)) + 0.5,
                    "types": set(),
                    "count": 0,
                }
            grid[cell]["types"].add(signal_type)
            grid[cell]["count"] += 1

        for ev in events:
            code = ev.get("country_code", "")
            coords = self.COUNTRY_COORDS.get(code)
            if coords:
                add_to_grid(coords[0], coords[1], ev.get("event_type", "News"))

        for t in military_tracks:
            lat, lng = t.get("lat", 0), t.get("lng", 0)
            if lat and lng:
                add_to_grid(lat, lng, "military_flight")

        for v in naval_tracks:
            lat, lng = v.get("lat", 0), v.get("lng", 0)
            if lat and lng:
                add_to_grid(lat, lng, "naval_vessel")

        for p in protest_data:
            lat, lng = p.get("lat", 0), p.get("lng", 0)
            if lat and lng:
                add_to_grid(lat, lng, "protest")

        return grid

    def _detect_convergence(self, grid: dict[str, dict[str, Any]]) -> list[ConvergenceAlert]:
        alerts = []
        now = datetime.now(timezone.utc).isoformat()

        for cell_key, data in grid.items():
            types = list(data["types"])
            if len(types) < 3:
                continue

            score = len(types) * 25.0 + data["count"] * 2.0
            severity = (
                "critical" if score >= 120
                else "high" if score >= 80
                else "medium"
            )
            lat, lng = data["lat"], data["lng"]
            name = _reverse_geocode(lat, lng)

            alerts.append(ConvergenceAlert(
                cell_key=cell_key,
                lat=lat,
                lng=lng,
                signal_types=types,
                event_count=data["count"],
                score=round(score, 1),
                severity=severity,
                name=name,
                timestamp=now,
            ))

        alerts.sort(key=lambda a: a.score, reverse=True)
        return alerts[:10]

    def _detect_surges(
        self, profiles: dict[str, CountryProfile], events: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        surges = []
        if not profiles:
            return surges
        avg = sum(p.signal_count for p in profiles.values()) / len(profiles)
        for code, profile in profiles.items():
            if profile.signal_count > avg * 2.0 and profile.signal_count >= 3:
                surges.append({
                    "country_code": code,
                    "country_name": profile.country_name,
                    "current_count": profile.signal_count,
                    "baseline_avg": round(avg, 1),
                    "multiplier": round(profile.signal_count / max(avg, 1), 1),
                    "severity": "high" if profile.signal_count > avg * 3.5 else "medium",
                })
        return sorted(surges, key=lambda s: s["multiplier"], reverse=True)[:5]

    def _detect_focal_points(
        self,
        events: list[dict[str, Any]],
        military_tracks: list[dict[str, Any]],
    ) -> list[FocalPoint]:
        entity_signals: dict[str, set[str]] = defaultdict(set)
        entity_events: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for ev in events:
            code = ev.get("country_code", "")
            if not code:
                continue
            entity_signals[code].add(ev.get("event_type", "News"))
            entity_events[code].append(ev)

        for t in military_tracks:
            code = t.get("country", "")
            if code:
                entity_signals[code].add("military_flight")

        focal_points = []
        for entity, signal_set in entity_signals.items():
            if len(signal_set) >= 3:
                evs = entity_events[entity]
                severity_weight = {"critical": 4, "high": 3, "medium": 2, "low": 1}
                urgency = sum(severity_weight.get(e.get("severity", "low"), 1) for e in evs)
                urgency_score = min(100.0, urgency * 5.0 + len(signal_set) * 10.0)
                focal_points.append(FocalPoint(
                    entity=entity,
                    urgency_score=round(urgency_score, 1),
                    signal_types=list(signal_set),
                    events=evs[:3],
                ))

        focal_points.sort(key=lambda f: f.urgency_score, reverse=True)
        return focal_points[:5]

    def _profile_to_dict(self, p: CountryProfile) -> dict[str, Any]:
        return {
            "country_code": p.country_code,
            "country_name": p.country_name,
            "region": p.region,
            "signal_count": p.signal_count,
            "signal_types": p.signal_types,
            "severity_distribution": dict(p.severity_distribution),
            "top_headline": p.top_headline,
            "risk_score": p.risk_score,
        }

    def _convergence_to_dict(self, c: ConvergenceAlert) -> dict[str, Any]:
        return {
            "cell_key": c.cell_key, "lat": c.lat, "lng": c.lng,
            "signal_types": c.signal_types, "event_count": c.event_count,
            "score": c.score, "severity": c.severity, "name": c.name,
            "timestamp": c.timestamp,
        }

    def _focal_to_dict(self, f: FocalPoint) -> dict[str, Any]:
        return {
            "entity": f.entity,
            "urgency_score": f.urgency_score,
            "signal_types": f.signal_types,
            "events": [{"headline": e.get("headline"), "severity": e.get("severity")} for e in f.events],
        }
