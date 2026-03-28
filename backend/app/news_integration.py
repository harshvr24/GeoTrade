"""News integration module for GeoTrade - Real-time geopolitical event aggregation."""

from datetime import datetime, timedelta, timezone
from typing import Any
import json
from pathlib import Path

try:  # Optional dependency in offline mode
    import feedparser
except ImportError:  # pragma: no cover - fallback when package not installed
    feedparser = None


class NewsIntegrator:
    """Integrates news from multiple sources and enriches events with market impact."""

    # Major news sources for geopolitical events
    RSS_FEEDS = {
        "reuters": "https://feeds.reuters.com/reuters/businessNews",
        "bbc": "http://feeds.bbc.co.uk/news/world/rss.xml",
        "aljazeera": "https://www.aljazeera.com/xml/feeds/headlines.xml",
        "bloomberg": "https://feeds.bloomberg.com/markets/news.rss",
        "cnbc": "https://feeds.cnbc.com/cnbc/world/",
        "ft": "https://feeds.ft.com/a/global",
    }

    # Keywords triggering market-relevant events
    MARKET_KEYWORDS = {
        "sanctions": {"impact": 2.5, "assets": ["WTI", "USD", "RUB", "EUR"]},
        "tariff": {"impact": 1.8, "assets": ["SPX", "NQ", "DAX"]},
        "inflation": {"impact": 1.5, "assets": ["GLD", "BND", "EURUSD"]},
        "interest rate": {"impact": 2.0, "assets": ["SPX", "BND", "USD"]},
        "geopolitical risk": {"impact": 2.8, "assets": ["WTI", "GLD", "VIX"]},
        "military": {"impact": 2.3, "assets": ["WTI", "GLD", "DXY"]},
        "trade war": {"impact": 2.2, "assets": ["SPX", "DAX", "HSI"]},
        "supply chain": {"impact": 1.6, "assets": ["SPX", "NQ", "EURUSD"]},
    }

    COUNTRY_KEYWORDS = {
        "ukraine": ("UKR", "Ukraine", "Europe"),
        "russia": ("RUS", "Russia", "Europe"),
        "israel": ("ISR", "Israel", "Middle East"),
        "gaza": ("ISR", "Israel", "Middle East"),
        "iran": ("IRN", "Iran", "Middle East"),
        "saudi": ("SAU", "Saudi Arabia", "Middle East"),
        "china": ("CHN", "China", "Asia"),
        "taiwan": ("TWN", "Taiwan", "Asia"),
        "japan": ("JPN", "Japan", "Asia"),
        "european union": ("DEU", "Germany", "Europe"),
        "germany": ("DEU", "Germany", "Europe"),
        "france": ("FRA", "France", "Europe"),
        "india": ("IND", "India", "Asia"),
        "united states": ("USA", "United States", "North America"),
        "u.s.": ("USA", "United States", "North America"),
        "us ": ("USA", "United States", "North America"),
        "usa": ("USA", "United States", "North America"),
        "britain": ("GBR", "United Kingdom", "Europe"),
        "united kingdom": ("GBR", "United Kingdom", "Europe"),
        "england": ("GBR", "United Kingdom", "Europe"),
        "gulf": ("SAU", "Saudi Arabia", "Middle East"),
    }

    # Country-to-market exposure mapping
    COUNTRY_EXPOSURE = {
        "USA": {"markets": ["SPX", "NQ"], "region": "North America"},
        "CHN": {"markets": ["HSI", "CSI300"], "region": "Asia"},
        "IRN": {"markets": ["WTI", "GLD"], "region": "Middle East"},
        "RUS": {"markets": ["MOEX", "RUB"], "region": "Europe"},
        "UKR": {"markets": ["PFTS", "UAH"], "region": "Europe"},
        "DEU": {"markets": ["DAX", "EuroStoxx"], "region": "Europe"},
        "GBR": {"markets": ["FTSE", "GBP"], "region": "Europe"},
        "IND": {"markets": ["Sensex", "INR"], "region": "Asia"},
        "JPN": {"markets": ["Nikkei", "Yen"], "region": "Asia"},
        "TWN": {"markets": ["TAIEX"], "region": "Asia"},
        "SAU": {"markets": ["Tadawul"], "region": "Middle East"},
        "AE": {"markets": ["ADX"], "region": "Middle East"},
    }

    @staticmethod
    def calculate_market_impact(headline: str, severity: str, country_code: str) -> float:
        """
        Calculate market impact score based on headline keywords and event severity.

        Args:
            headline: News headline text
            severity: Event severity (critical, high, medium, low)
            country_code: ISO country code

        Returns:
            Market impact score 0-5
        """
        base_impact = {
            "critical": 2.5,
            "high": 1.8,
            "medium": 1.0,
            "low": 0.2,
        }.get(severity, 1.0)

        headline_lower = headline.lower()

        # Keyword multiplier
        keyword_multiplier = 1.0
        for keyword, data in NewsIntegrator.MARKET_KEYWORDS.items():
            if keyword in headline_lower:
                keyword_multiplier = max(keyword_multiplier, data["impact"] / 2)

        # Geographic multiplier (some regions more market-sensitive)
        geo_multiplier = 1.0
        if country_code in ["USA", "CHN", "EUR", "GBR", "JPN"]:
            geo_multiplier = 1.3

        impact = base_impact * keyword_multiplier * geo_multiplier
        return round(min(impact, 5.0), 2)

    @staticmethod
    def get_affected_assets(headline: str, country_code: str) -> list[str]:
        """Get list of affected financial assets for an event."""
        affected = set()

        headline_lower = headline.lower()

        # Add assets from keyword matches
        for keyword, data in NewsIntegrator.MARKET_KEYWORDS.items():
            if keyword in headline_lower:
                affected.update(data["assets"])

        # Add assets from country exposure
        if country_code in NewsIntegrator.COUNTRY_EXPOSURE:
            affected.update(NewsIntegrator.COUNTRY_EXPOSURE[country_code]["markets"])

        return sorted(list(affected))

    @staticmethod
    def classify_event_type(headline: str) -> str:
        """Classify event type by analyzing headline."""
        headline_lower = headline.lower()

        if any(word in headline_lower for word in ["sanction", "embargo", "restriction"]):
            return "Sanctions"
        if any(word in headline_lower for word in ["military", "defense", "naval", "drill"]):
            return "Military"
        if any(word in headline_lower for word in ["trade", "tariff", "export", "commerce"]):
            return "Trade"
        if any(word in headline_lower for word in ["election", "diplomatic", "talks", "agreement"]):
            return "Diplomatic"
        if any(word in headline_lower for word in ["market", "economy", "inflation", "gdp"]):
            return "Economic"

        return "Other"

    @classmethod
    def infer_geo(cls, headline: str) -> tuple[str, str, str]:
        """Best-effort country/region inference from headline text."""
        lower = headline.lower()
        for kw, val in cls.COUNTRY_KEYWORDS.items():
            if kw in lower:
                return val
        return ("USA", "United States", "North America")

    @staticmethod
    def infer_severity(headline: str) -> str:
        lower = headline.lower()
        critical_tokens = ["strike", "attack", "missile", "sanction", "seizure"]
        high_tokens = ["tension", "escalat", "drill", "warning", "emergency"]
        if any(t in lower for t in critical_tokens):
            return "critical"
        if any(t in lower for t in high_tokens):
            return "high"
        if any(t in lower for t in ["talks", "negotiation", "agreement"]):
            return "medium"
        return "low"

    @classmethod
    def fetch_rss_events(cls, limit_per_feed: int = 8) -> list[dict[str, Any]]:
        """Fetch and enrich RSS headlines into event payloads."""
        events: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        if feedparser is None:
            return cls.sample_events(now)

        for source, url in cls.RSS_FEEDS.items():
            feed = feedparser.parse(url)
            if getattr(feed, "bozo", False):
                continue

            for entry in feed.entries[:limit_per_feed]:
                headline = entry.get("title", "").strip()
                if not headline:
                    continue

                ts_struct = entry.get("published_parsed") or entry.get("updated_parsed")
                ts = datetime(*ts_struct[:6], tzinfo=timezone.utc).isoformat() if ts_struct else now.isoformat()

                code, country_name, region = cls.infer_geo(headline)
                severity = cls.infer_severity(headline)
                event = {
                    "id": entry.get("id") or f"{source}-{len(events)+1}",
                    "headline": headline,
                    "source": source.capitalize(),
                    "country_code": code,
                    "country_name": country_name,
                    "region": region,
                    "severity": severity,
                    "timestamp": ts,
                    "event_type": cls.classify_event_type(headline),
                }
                events.append(cls.enrich_event(event))

        if not events:
            events = cls.sample_events(now)

        return events

    @staticmethod
    def sample_events(now: datetime) -> list[dict[str, Any]]:
        """Offline-friendly fallback when feeds are unreachable."""
        samples = [
            ("ISR", "Israel", "Middle East", "regional tensions flare along northern border"),
            ("IRN", "Iran", "Middle East", "new sanctions on energy exports raise shipping risks"),
            ("TWN", "Taiwan", "Asia", "strait overflight incidents elevate military posture"),
            ("DEU", "Germany", "Europe", "emergency rate guidance unsettles euro assets"),
        ]
        events = []
        for idx, (code, name, region, headline) in enumerate(samples, start=1):
            severity = "high" if idx < 3 else "medium"
            events.append(
                NewsIntegrator.enrich_event(
                    {
                        "id": f"sample-{idx}",
                        "headline": headline.title(),
                        "source": "GeoTrade",
                        "country_code": code,
                        "country_name": name,
                        "region": region,
                        "severity": severity,
                        "timestamp": (now - timedelta(minutes=idx * 7)).isoformat(),
                        "event_type": NewsIntegrator.classify_event_type(headline),
                    }
                )
            )
        return events

    @staticmethod
    def enrich_event(raw_event: dict[str, Any]) -> dict[str, Any]:
        """Enrich raw event data with calculated market impact and affected assets."""
        enriched = dict(raw_event)

        # Calculate market impact
        enriched["market_impact"] = NewsIntegrator.calculate_market_impact(
            enriched.get("headline", ""),
            enriched.get("severity", "low"),
            enriched.get("country_code", ""),
        )

        # Get affected assets
        enriched["affected_assets"] = NewsIntegrator.get_affected_assets(
            enriched.get("headline", ""), enriched.get("country_code", "")
        )

        # Classify if not already classified
        if "event_type" not in enriched:
            enriched["event_type"] = NewsIntegrator.classify_event_type(enriched.get("headline", ""))

        return enriched

    @staticmethod
    def generate_trading_signal(event: dict[str, Any]) -> dict[str, Any] | None:
        """Generate trading signal based on event."""
        if event.get("market_impact", 0) < 1.5:
            return None  # Insufficient market impact

        assets = event.get("affected_assets", [])
        if not assets:
            return None

        primary_asset = assets[0]
        severity = event.get("severity", "medium")

        # Determine action based on keywords
        headline_lower = event.get("headline", "").lower()
        if any(word in headline_lower for word in ["risk", "escalat", "tension", "sanction"]):
            action = "SELL"
            confidence = 0.65 if severity == "medium" else 0.75
        else:
            action = "BUY"
            confidence = 0.62 if severity == "medium" else 0.72

        return {
            "asset": primary_asset,
            "action": action,
            "confidence": confidence,
            "event_id": event.get("id"),
            "triggered_by": event.get("headline", ""),
            "market_impact": event.get("market_impact", 0),
        }


class NewsDataManager:
    """Manages news data storage and retrieval."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.events_file = data_dir / "events.json"
        self.signals_file = data_dir / "signals.json"

    def load_events(self) -> list[dict[str, Any]]:
        """Load events from storage."""
        if not self.events_file.exists():
            return []
        with open(self.events_file, "r") as f:
            return json.load(f)

    def save_events(self, events: list[dict[str, Any]]) -> None:
        """Save events to storage."""
        with open(self.events_file, "w") as f:
            json.dump(events, f, indent=2)

    def load_signals(self) -> list[dict[str, Any]]:
        """Load trading signals from storage."""
        if not self.signals_file.exists():
            return []
        with open(self.signals_file, "r") as f:
            return json.load(f)

    def save_signals(self, signals: list[dict[str, Any]]) -> None:
        """Save trading signals to storage."""
        with open(self.signals_file, "w") as f:
            json.dump(signals, f, indent=2)

    def add_event(self, event: dict[str, Any]) -> None:
        """Add a new event to storage."""
        events = self.load_events()
        event["id"] = f"e{len(events) + 1}"
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        enriched = NewsIntegrator.enrich_event(event)
        events.append(enriched)
        self.save_events(events)

    def get_recent_signals(self, minutes: int = 60) -> list[dict[str, Any]]:
        """Get signals generated in the last N minutes."""
        signals = self.load_signals()
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)

        recent = []
        for signal in signals:
            sig_time = datetime.fromisoformat(signal.get("timestamp", ""))
            if sig_time > cutoff:
                recent.append(signal)

        return sorted(recent, key=lambda s: s.get("timestamp", ""), reverse=True)
