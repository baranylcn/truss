import asyncio
import logging
from io import BytesIO

import pandas as pd
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 30


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }


def _object_url(project_id: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}/{project_id}.csv"


def _delete_url() -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}"


async def upload_dataset(project_id: str, content: bytes) -> None:
    """Uploads raw CSV bytes to Supabase Storage, overwriting any existing file."""
    def _run() -> None:
        r = requests.post(
            _object_url(project_id),
            data=content,
            headers={**_headers(), "Content-Type": "text/csv", "x-upsert": "true"},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()

    await asyncio.to_thread(_run)
    logger.info(f"Uploaded dataset to storage for project {project_id}")


async def download_dataset(project_id: str) -> bytes | None:
    """Downloads raw CSV bytes from Supabase Storage. Returns None if not found."""
    def _run() -> bytes | None:
        r = requests.get(_object_url(project_id), headers=_headers(), timeout=_TIMEOUT)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.content

    content = await asyncio.to_thread(_run)
    if content is not None:
        logger.info(f"Restored dataset from storage for project {project_id}")
    return content


async def delete_dataset(project_id: str) -> None:
    """Removes the CSV file from Supabase Storage."""
    def _run() -> None:
        r = requests.delete(
            _delete_url(),
            json={"prefixes": [f"{project_id}.csv"]},
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        if r.status_code not in (200, 404):
            r.raise_for_status()

    await asyncio.to_thread(_run)


async def get_or_restore_dataframe(project_id: str) -> pd.DataFrame | None:
    """Returns the project DataFrame from Redis, restoring from Storage on a cache miss."""
    from app.core.redis import get_dataframe, set_dataframe

    df = await get_dataframe(project_id)
    if df is not None:
        return df

    content = await download_dataset(project_id)
    if content is None:
        return None

    df = pd.read_csv(BytesIO(content))
    await set_dataframe(project_id, df)
    return df
