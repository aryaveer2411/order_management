import json
import logging
import os
from typing import Optional

import redis as redis_lib

logger = logging.getLogger(__name__)

_client: Optional[redis_lib.Redis] = None


def get_redis() -> redis_lib.Redis:
    global _client
    if _client is None:
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            raise RuntimeError("REDIS_URL environment variable is not set")
        _client = redis_lib.from_url(redis_url, decode_responses=True)
    return _client


def cache_get(key: str) -> Optional[dict]:
    try:
        data = get_redis().get(key)
        return json.loads(data) if data else None
    except Exception:
        logger.warning("cache_get failed for key %r", key, exc_info=True)
        return None


def cache_set(key: str, value: dict, ttl: int) -> None:
    try:
        get_redis().setex(key, ttl, json.dumps(value))
    except Exception:
        logger.warning("cache_set failed for key %r", key, exc_info=True)


def cache_delete(*keys: str) -> None:
    try:
        get_redis().delete(*keys)
    except Exception:
        logger.warning("cache_delete failed for keys %r", keys, exc_info=True)


def cache_delete_pattern(pattern: str) -> None:
    try:
        client = get_redis()
        cursor = 0
        while True:
            cursor, keys = client.scan(cursor, match=pattern, count=100)
            if keys:
                client.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        logger.warning("cache_delete_pattern failed for pattern %r", pattern, exc_info=True)
