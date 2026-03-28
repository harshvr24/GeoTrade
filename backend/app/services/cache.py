import os
from typing import Any, Optional

class InMemoryCache:
    def __init__(self):
        self.store = {}
    async def get(self, key: str) -> Any:
        return self.store.get(key)
    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> None:
        self.store[key] = value


def _build_client():
    # Placeholder for Redis connection; fallback to in-memory.
    if os.environ.get("REDIS_URL"):
        try:
            import redis.asyncio as redis  # type: ignore
            return redis.from_url(os.environ["REDIS_URL"])
        except Exception:
            pass
    return InMemoryCache()


cache_client = _build_client()
