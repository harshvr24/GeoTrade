"""
Circuit breaker cache with Upstash/Redis fallback and in-memory backup.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None  # type: ignore


class CircuitBreakerCache:
    def __init__(self) -> None:
        self.upstash_url = os.environ.get("UPSTASH_REDIS_REST_URL")
        self.upstash_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        self.redis_url = os.environ.get("REDIS_URL")
        self._redis_client = self._init_redis()
        self._memory: dict[str, Any] = {}
        self._timestamps: dict[str, float] = {}
        self._failures: dict[str, dict[str, Any]] = {}

    def _init_redis(self) -> Any:
        if self.redis_url and redis is not None:
            try:
                return redis.from_url(self.redis_url)
            except Exception:
                return None
        return None

    # -- Circuit breaker helpers ------------------------------------------
    def mark_failure(self, key: str) -> None:
        entry = self._failures.setdefault(key, {"count": 0, "cooldown_until": 0.0})
        entry["count"] += 1
        entry["last_failure"] = time.time()
        if entry["count"] >= 3:
            entry["cooldown_until"] = time.time() + 300

    def reset_failure(self, key: str) -> None:
        if key in self._failures:
            self._failures[key] = {"count": 0, "cooldown_until": 0.0}

    def is_in_cooldown(self, key: str) -> bool:
        entry = self._failures.get(key)
        if not entry:
            return False
        return time.time() < entry.get("cooldown_until", 0.0)

    # -- Freshness helper -------------------------------------------------
    def get_freshness(self, key: str) -> str:
        ts = self._timestamps.get(key)
        if ts is None:
            return "no_data"
        age = time.time() - ts
        if age < 900:
            return "fresh"
        if age < 3600:
            return "stale"
        if age < 21600:
            return "very_stale"
        return "no_data"

    # -- Public API -------------------------------------------------------
    async def get(self, key: str, stale_ok: bool = False) -> Optional[Any]:
        if self.is_in_cooldown(key):
            if stale_ok and key in self._memory:
                return self._memory.get(key)
            return None

        # Try Upstash REST
        if self.upstash_url and self.upstash_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.upstash_url}/get/{key}", headers={"Authorization": f"Bearer {self.upstash_token}"})
                    if resp.status_code == 200:
                        data = resp.json().get("result") if resp.headers.get("content-type"," ").startswith("application/json") else resp.text
                        self.reset_failure(key)
                        value = json.loads(data) if isinstance(data, str) else data
                        if value is not None:
                            self._timestamps[key] = time.time()
                        return value
            except Exception:
                self.mark_failure(key)

        # Try direct Redis
        if self._redis_client is not None:
            loop = asyncio.get_event_loop()
            try:
                raw = await loop.run_in_executor(None, self._redis_client.get, key)
                if raw is not None:
                    self.reset_failure(key)
                    val = json.loads(raw)
                    self._timestamps[key] = time.time()
                    return val
            except Exception:
                self.mark_failure(key)

        # Memory fallback
        return self._memory.get(key)

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        serialized = json.dumps(value)
        now = time.time()
        self._memory[key] = value
        self._timestamps[key] = now

        # Upstash
        if self.upstash_url and self.upstash_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self.upstash_url}/set/{key}/{serialized}",
                        headers={"Authorization": f"Bearer {self.upstash_token}"},
                        params={"ex": ttl},
                    )
                    self.reset_failure(key)
                    return
            except Exception:
                self.mark_failure(key)

        # Redis
        if self._redis_client is not None:
            loop = asyncio.get_event_loop()
            try:
                await loop.run_in_executor(None, self._redis_client.setex, key, ttl, serialized)
                self.reset_failure(key)
                return
            except Exception:
                self.mark_failure(key)


cache_client = CircuitBreakerCache()
