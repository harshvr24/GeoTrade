"""
Market data provider with Alpha Vantage / TwelveData fallback and static backup.
"""

from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict

import httpx

STATIC_QUOTES: Dict[str, Dict[str, Any]] = {
    "SPX": {"price": 5320.4, "change": -8.5, "change_pct": -0.16},
    "NQ": {"price": 18210.6, "change": -62.1, "change_pct": -0.34},
    "WTI": {"price": 82.45, "change": 0.74, "change_pct": 0.91},
    "BRENT": {"price": 86.12, "change": 0.68, "change_pct": 0.80},
    "NG": {"price": 2.31, "change": 0.04, "change_pct": 1.76},
    "XAU": {"price": 2310.2, "change": 12.6, "change_pct": 0.55},
    "BTCUSD": {"price": 68750.0, "change": 420.0, "change_pct": 0.61},
    "EURUSD": {"price": 1.0831, "change": -0.0018, "change_pct": -0.17},
    "DXY": {"price": 104.9, "change": 0.12, "change_pct": 0.11},
    "VIX": {"price": 16.8, "change": -0.3, "change_pct": -1.75},
}


class MarketProvider:
    def __init__(self) -> None:
        self.alpha_key = os.environ.get("ALPHA_VANTAGE_KEY")
        self.twelve_key = os.environ.get("TWELVE_DATA_API_KEY")
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_expiry: Dict[str, float] = {}

    def _is_fresh(self, symbol: str) -> bool:
        return self._cache_expiry.get(symbol, 0) > time.time()

    async def _fetch_alpha(self, symbol: str) -> Dict[str, Any] | None:
        if not self.alpha_key:
            return None
        url = "https://www.alphavantage.co/query"
        params = {"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": self.alpha_key}
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json().get("Global Quote", {})
                if not data:
                    return None
                return {
                    "symbol": symbol,
                    "price": float(data.get("05. price", 0)),
                    "change": float(data.get("09. change", 0)),
                    "change_pct": float(str(data.get("10. change percent", "0")).rstrip("%")),
                    "updated": data.get("07. latest trading day", ""),
                    "static": False,
                }
        except Exception:
            return None

    async def _fetch_twelve(self, symbol: str) -> Dict[str, Any] | None:
        if not self.twelve_key:
            return None
        url = "https://api.twelvedata.com/quote"
        params = {"symbol": symbol, "apikey": self.twelve_key}
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                if "price" not in data:
                    return None
                return {
                    "symbol": symbol,
                    "price": float(data.get("price", 0)),
                    "change": float(data.get("change", 0)),
                    "change_pct": float(data.get("percent_change", 0)),
                    "updated": data.get("datetime", ""),
                    "static": False,
                }
        except Exception:
            return None

    async def quote(self, symbol: str) -> Dict[str, Any]:
        symbol = symbol.upper()
        if self._is_fresh(symbol):
            return self._cache[symbol]

        result = await self._fetch_alpha(symbol)
        if result is None:
            result = await self._fetch_twelve(symbol)
        if result is None:
            static = STATIC_QUOTES.get(symbol, {"price": 0.0, "change": 0.0, "change_pct": 0.0})
            result = {
                "symbol": symbol,
                **static,
                "updated": datetime.now().isoformat(),
                "static": True,
            }
        self._cache[symbol] = result
        self._cache_expiry[symbol] = time.time() + 60
        return result

    async def batch_quotes(self, symbols: list[str]) -> Dict[str, Dict[str, Any]]:
        quotes: Dict[str, Dict[str, Any]] = {}
        for sym in symbols:
            quotes[sym] = await self.quote(sym)
        return quotes


async def get_market_provider() -> MarketProvider:
    return MarketProvider()
