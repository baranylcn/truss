import gzip
import base64
import json
import redis.asyncio as aioredis
import pandas as pd
from io import StringIO
from typing import Any

from app.core.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Returns the singleton Redis connection, creating it on first call."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _compress(s: str) -> str:
    """gzip-compress a string and return base64-encoded result (stays string-safe for Redis)."""
    return base64.b64encode(gzip.compress(s.encode(), compresslevel=6)).decode()


def _decompress(s: str) -> str:
    """Reverse of _compress. Falls back to raw string for legacy uncompressed values."""
    try:
        return gzip.decompress(base64.b64decode(s.encode())).decode()
    except Exception:
        return s


async def get_dataframe(project_id: str) -> pd.DataFrame | None:
    """Fetches the project DataFrame from Redis. Returns None if not cached."""
    r = get_redis()
    data = await r.get(f"df:{project_id}")
    if data is None:
        return None
    return pd.read_json(StringIO(_decompress(data)), orient="split")


async def set_dataframe(project_id: str, df: pd.DataFrame, ttl: int = 86400) -> None:
    """Writes a gzip-compressed DataFrame to Redis and invalidates derived caches."""
    payload = _compress(df.to_json(orient="split"))
    r = get_redis()
    pipe = r.pipeline()
    pipe.setex(f"df:{project_id}", ttl, payload)
    pipe.delete(f"analysis:{project_id}", f"correlation:{project_id}")
    await pipe.execute()


async def delete_dataframe(project_id: str) -> None:
    """Removes the project DataFrame and all derived cache keys from Redis."""
    r = get_redis()
    await r.delete(f"df:{project_id}", f"meta:{project_id}", f"analysis:{project_id}", f"correlation:{project_id}", f"tags:{project_id}")


async def get_analysis_cache(project_id: str) -> list[Any] | None:
    """Returns cached analyze_dataframe result or None if not cached."""
    r = get_redis()
    data = await r.get(f"analysis:{project_id}")
    if data is None:
        return None
    return json.loads(data)


async def set_analysis_cache(project_id: str, analysis: list[Any], ttl: int = 86400) -> None:
    """Caches analyze_dataframe result for the given project."""
    r = get_redis()
    await r.setex(f"analysis:{project_id}", ttl, json.dumps(analysis))


async def get_correlation_cache(project_id: str) -> dict | None:
    """Returns cached correlation matrix or None if not cached."""
    r = get_redis()
    data = await r.get(f"correlation:{project_id}")
    if data is None:
        return None
    return json.loads(data)


async def set_correlation_cache(project_id: str, payload: dict, ttl: int = 86400) -> None:
    """Caches correlation matrix for the given project."""
    r = get_redis()
    await r.setex(f"correlation:{project_id}", ttl, json.dumps(payload))


async def get_column_tags(project_id: str) -> dict[str, list[str]]:
    """Returns the column transformation tags for the project, or {} if not set."""
    r = get_redis()
    data = await r.get(f"tags:{project_id}")
    if data is None:
        return {}
    return json.loads(data)


async def set_column_tags(project_id: str, tags: dict[str, list[str]], ttl: int = 86400) -> None:
    """Persists column transformation tags to Redis."""
    r = get_redis()
    await r.setex(f"tags:{project_id}", ttl, json.dumps(tags))
