"""
api/services/cache_service.py
─────────────────────────────
Caching abstraction for Xeroww platform.
Provides a unified interface with Redis implementation and resilient InMemory fallback.

Architectural Rule:
  Cache is used ONLY where strictly justified:
    - Short-lived quote cache (15s)
    - Short-lived OHLC candle cache (300s)
    - Short-lived market breadth (60s)
    - Application rate limiting buckets
  Never blindly cache entire database query sets.
"""

import json
import time
import logging
import threading
from abc import ABC, abstractmethod
from typing import Any

from api.core.config import settings
from api.core.metrics import CACHE_OPERATIONS_TOTAL

logger = logging.getLogger(__name__)


class CacheService(ABC):
    @abstractmethod
    def get(self, key: str) -> Any | None:
        """Retrieve a cached value by key. Returns None if missing or expired."""
        ...

    @abstractmethod
    def set(self, key: str, value: Any, ttl_seconds: int) -> bool:
        """Store a value with a time-to-live in seconds."""
        ...

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        ...

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check whether a key exists in cache."""
        ...

    @abstractmethod
    def incr(self, key: str, ttl_seconds: int = 60) -> int:
        """Atomically increment an integer counter. Initializes with TTL if not exists."""
        ...

    @abstractmethod
    def flush(self) -> None:
        """Clear all entries in the cache (used in testing and maintenance)."""
        ...

    @abstractmethod
    def stats(self) -> dict[str, Any]:
        """Return cache health metrics, backend type, and key statistics."""
        ...


class InMemoryCacheService(CacheService):
    """
    Thread-safe in-memory cache with explicit TTL expiry.
    Used for local development without Docker or as an automatic fallback when Redis is unreachable.
    """

    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Any | None:
        with self._lock:
            item = self._store.get(key)
            if item is None:
                self._misses += 1
                try:
                    CACHE_OPERATIONS_TOTAL.labels(cache_name="memory", status="miss").inc()
                except Exception:
                    pass
                return None
            val, expiry = item
            if time.time() > expiry:
                del self._store[key]
                self._misses += 1
                try:
                    CACHE_OPERATIONS_TOTAL.labels(cache_name="memory", status="miss").inc()
                except Exception:
                    pass
                return None
            self._hits += 1
            try:
                CACHE_OPERATIONS_TOTAL.labels(cache_name="memory", status="hit").inc()
            except Exception:
                pass
            return val

    def set(self, key: str, value: Any, ttl_seconds: int) -> bool:
        with self._lock:
            expiry = time.time() + ttl_seconds
            self._store[key] = (value, expiry)
            return True

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def exists(self, key: str) -> bool:
        return self.get(key) is not None

    def incr(self, key: str, ttl_seconds: int = 60) -> int:
        with self._lock:
            now = time.time()
            item = self._store.get(key)
            if item is None or now > item[1]:
                val = 1
                expiry = now + ttl_seconds
            else:
                val = int(item[0]) + 1
                expiry = item[1]
            self._store[key] = (val, expiry)
            return val

    def flush(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> dict[str, Any]:
        with self._lock:
            now = time.time()
            active_keys = sum(1 for _, exp in self._store.values() if exp > now)
            total_ops = self._hits + self._misses
            hit_rate = (self._hits / total_ops * 100.0) if total_ops > 0 else 0.0
            return {
                "backend": "memory",
                "connected": True,
                "total_keys": active_keys,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_pct": round(hit_rate, 1),
                "status": "operational",
            }


class RedisCacheService(CacheService):
    """
    Redis-backed cache service using connection pooling.
    Falls back gracefully to no-op or in-memory if Redis connection drops.
    """

    def __init__(self, redis_url: str):
        import redis
        self._redis = redis.Redis.from_url(redis_url, decode_responses=True, socket_timeout=1.0)
        self._fallback = InMemoryCacheService()
        self._hits = 0
        self._misses = 0
        # Verify connection
        self._redis.ping()

    def get(self, key: str) -> Any | None:
        try:
            val = self._redis.get(key)
            if val is None:
                self._misses += 1
                try:
                    CACHE_OPERATIONS_TOTAL.labels(cache_name="redis", status="miss").inc()
                except Exception:
                    pass
                return None
            self._hits += 1
            try:
                CACHE_OPERATIONS_TOTAL.labels(cache_name="redis", status="hit").inc()
            except Exception:
                pass
            return json.loads(val)
        except Exception as exc:
            logger.warning(f"Redis get failed for key {key}: {exc}. Using fallback.")
            return self._fallback.get(key)

    def set(self, key: str, value: Any, ttl_seconds: int) -> bool:
        try:
            serialized = json.dumps(value, default=str)
            self._redis.set(key, serialized, ex=ttl_seconds)
            return True
        except Exception as exc:
            logger.warning(f"Redis set failed for key {key}: {exc}. Using fallback.")
            return self._fallback.set(key, value, ttl_seconds)

    def delete(self, key: str) -> bool:
        try:
            self._redis.delete(key)
            self._fallback.delete(key)
            return True
        except Exception as exc:
            logger.warning(f"Redis delete failed for key {key}: {exc}.")
            return self._fallback.delete(key)

    def exists(self, key: str) -> bool:
        try:
            return bool(self._redis.exists(key))
        except Exception as exc:
            logger.warning(f"Redis exists failed for key {key}: {exc}.")
            return self._fallback.exists(key)

    def incr(self, key: str, ttl_seconds: int = 60) -> int:
        try:
            pipeline = self._redis.pipeline()
            pipeline.incr(key)
            pipeline.expire(key, ttl_seconds)
            results = pipeline.execute()
            return int(results[0])
        except Exception as exc:
            logger.warning(f"Redis incr failed for key {key}: {exc}. Using fallback.")
            return self._fallback.incr(key, ttl_seconds)

    def flush(self) -> None:
        try:
            self._redis.flushdb()
        except Exception as exc:
            logger.warning(f"Redis flushdb failed: {exc}.")
            self._fallback.flush()

    def stats(self) -> dict[str, Any]:
        try:
            dbsize = self._redis.dbsize()
            total_ops = self._hits + self._misses
            hit_rate = (self._hits / total_ops * 100.0) if total_ops > 0 else 0.0
            return {
                "backend": "redis",
                "connected": True,
                "total_keys": dbsize,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_pct": round(hit_rate, 1),
                "status": "operational",
            }
        except Exception as exc:
            fb = self._fallback.stats()
            fb["backend"] = "redis (degraded -> memory)"
            fb["connected"] = False
            fb["status"] = "degraded"
            fb["error"] = str(exc)
            return fb


# ---------------------------------------------------------------------------
# Global Cache Provider & Factory
# ---------------------------------------------------------------------------
_cache_instance: CacheService | None = None


def get_cache_service() -> CacheService:
    global _cache_instance
    if _cache_instance is None:
        try:
            _cache_instance = RedisCacheService(settings.REDIS_URL)
            logger.info("Connected to Redis cache at %s", settings.REDIS_URL)
        except Exception as exc:
            logger.warning("Redis unavailable (%s). Falling back to InMemoryCacheService.", exc)
            _cache_instance = InMemoryCacheService()
    return _cache_instance
