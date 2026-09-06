"""
api/tests/test_cache_service.py
───────────────────────────────
Unit tests for CacheService implementations and fallback behavior.
"""

import time
import pytest
from api.services.cache_service import InMemoryCacheService, get_cache_service


def test_in_memory_cache_set_and_get():
    cache = InMemoryCacheService()
    assert cache.get("nonexistent") is None

    cache.set("key1", {"price": 2500.5}, ttl_seconds=10)
    val = cache.get("key1")
    assert val == {"price": 2500.5}
    assert cache.exists("key1") is True


def test_in_memory_cache_ttl_expiration():
    cache = InMemoryCacheService()
    cache.set("short_lived", "expires_soon", ttl_seconds=1)
    assert cache.get("short_lived") == "expires_soon"
    time.sleep(1.1)
    assert cache.get("short_lived") is None
    assert cache.exists("short_lived") is False


def test_in_memory_cache_delete():
    cache = InMemoryCacheService()
    cache.set("to_delete", 42, ttl_seconds=60)
    assert cache.delete("to_delete") is True
    assert cache.get("to_delete") is None
    assert cache.delete("to_delete") is False


def test_in_memory_cache_incr():
    cache = InMemoryCacheService()
    val1 = cache.incr("rate:user_1", ttl_seconds=60)
    assert val1 == 1
    val2 = cache.incr("rate:user_1", ttl_seconds=60)
    assert val2 == 2


def test_global_cache_service_fallback():
    # Calling get_cache_service in an environment without Redis should return a working CacheService (fallback)
    cache = get_cache_service()
    assert cache is not None
    cache.set("test_key", "test_val", ttl_seconds=5)
    assert cache.get("test_key") == "test_val"
