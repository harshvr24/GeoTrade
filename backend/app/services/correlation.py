from typing import List, Dict, Any
from statistics import mean


def correlation_signals(events: List[Dict[str, Any]], quotes: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    alerts = []
    if not events:
        return alerts
    avg_sent = mean([e.get("sentiment", 0) for e in events if isinstance(e.get("sentiment", 0), (int, float))]) if events else 0
    high_risk = [e for e in events if e.get("severity") in ("critical", "high")]
    if len(high_risk) >= 3:
        alerts.append({
            "id": f"corr-{len(high_risk)}",
            "type": "geo-risk",
            "severity": "high",
            "message": f"{len(high_risk)} high-severity events; avg sentiment {avg_sent:.2f}",
        })
    if quotes:
        oil = quotes.get("WTI", {})
        gold = quotes.get("XAU", {})
        if oil.get("change_pct", 0) > 2 and gold.get("change_pct", 0) > 1:
            alerts.append({
                "id": "corr-energy-gold",
                "type": "market",
                "severity": "medium",
                "message": "Oil and gold both spiking; potential flight to safety.",
            })
    return alerts
