import redis.asyncio as aioredis
import pandas as pd
from io import StringIO

from app.core.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Returns the singleton Redis connection, creating it on first call."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def get_dataframe(project_id: str) -> pd.DataFrame | None:
    """Fetches the project DataFrame from Redis. Returns None if not cached."""
    r = get_redis()
    data = await r.get(f"df:{project_id}")
    if data is None:
        return None
    return pd.read_json(StringIO(data), orient="split")


async def set_dataframe(project_id: str, df: pd.DataFrame, ttl: int = 86400) -> None:
    """Writes a DataFrame to Redis with a TTL (default 24 h)."""
    r = get_redis()
    await r.setex(f"df:{project_id}", ttl, df.to_json(orient="split"))


async def delete_dataframe(project_id: str) -> None:
    """Removes the project DataFrame and metadata keys from Redis."""
    r = get_redis()
    await r.delete(f"df:{project_id}", f"meta:{project_id}")
