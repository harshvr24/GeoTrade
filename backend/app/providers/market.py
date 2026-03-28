import time
from typing import Dict, Any

# Lightweight market adapter placeholder

STATIC_QUOTES = {
    "SPX": {"price": 5299.6, "change_pct": -0.18},
    "NQ": {"price": 18244.3, "change_pct": -0.32},
    "WTI": {"price": 82.16, "change_pct": 0.95},
    "XAU": {"price": 2314.6, "change_pct": 1.2},
    "BTCUSD": {"price": 67240, "change_pct": 0.58},
}


class MarketProvider:
    def __init__(self):
        pass  # Future: load API keys

    def quote(self, symbol: str) -> Dict[str, Any]:
        q = STATIC_QUOTES.get(symbol.upper(), {"price": 0, "change_pct": 0})
        return {**q, "symbol": symbol.upper(), "updated": int(time.time())}

    def batch_quotes(self, symbols: list[str]) -> Dict[str, Dict[str, Any]]:
        return {s: self.quote(s) for s in symbols}
