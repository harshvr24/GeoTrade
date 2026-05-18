"""
Pluggable AI enrichment pipeline.
Defaults to lightweight heuristics to remain offline-safe.
"""

from typing import Dict, Any


class AIPipeline:
    def __init__(self):
        # Future: wire providers (OpenAI/Ollama/HF) via env flags
        pass

    def enrich_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        enriched = dict(event)
        enriched.setdefault("summary", self._summary(event))
        enriched.setdefault("entities", [])
        enriched.setdefault("topics", [])
        enriched.setdefault("threat_score", self._threat(event))
        return enriched

    def _summary(self, event: Dict[str, Any]) -> str:
        headline = event.get("headline", "")
        region = event.get("region", "Global")
        severity = event.get("severity", "medium")
        return f"{headline} · {region} · severity {severity}"

    def _threat(self, event: Dict[str, Any]) -> float:
        sev = event.get("severity", "medium")
        base = {"critical": 0.9, "high": 0.7, "medium": 0.45, "low": 0.2}.get(sev, 0.3)
        impact = float(event.get("market_impact", 0)) / 5.0
        return round(min(1.0, base + impact * 0.2), 3)
