import asyncio
import logging
from io import BytesIO
from pathlib import Path

import pandas as pd
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 30


# Supabase Storage

def _supabase_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }


def _supabase_object_url(project_id: str) -> str:
    return (
        f"{settings.SUPABASE_URL}/storage/v1/object"
        f"/{settings.SUPABASE_STORAGE_BUCKET}/{project_id}.csv"
    )


def _supabase_delete_url() -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}"


async def _supabase_upload(project_id: str, content: bytes) -> None:
    def _run() -> None:
        r = requests.post(
            _supabase_object_url(project_id),
            data=content,
            headers={**_supabase_headers(), "Content-Type": "text/csv", "x-upsert": "true"},
            timeout=_TIMEOUT,
        )
        if not r.ok:
            logger.error(f"Supabase upload failed {r.status_code}: {r.text}")
            r.raise_for_status()

    await asyncio.to_thread(_run)
    logger.info(f"Uploaded dataset to Supabase Storage for project {project_id}")


async def _supabase_download(project_id: str) -> bytes | None:
    def _run() -> bytes | None:
        r = requests.get(
            _supabase_object_url(project_id),
            headers=_supabase_headers(),
            timeout=_TIMEOUT,
        )
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.content

    content = await asyncio.to_thread(_run)
    if content is not None:
        logger.info(f"Restored dataset from Supabase Storage for project {project_id}")
    return content


async def _supabase_delete(project_id: str) -> None:
    def _run() -> None:
        r = requests.delete(
            _supabase_delete_url(),
            json={"prefixes": [f"{project_id}.csv"]},
            headers=_supabase_headers(),
            timeout=_TIMEOUT,
        )
        if r.status_code not in (200, 404):
            r.raise_for_status()

    await asyncio.to_thread(_run)


# Local filesystem Storage

def _local_path(project_id: str) -> Path:
    base = Path(settings.LOCAL_STORAGE_PATH)
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{project_id}.csv"


async def _local_upload(project_id: str, content: bytes) -> None:
    def _run() -> None:
        _local_path(project_id).write_bytes(content)

    await asyncio.to_thread(_run)
    logger.info(f"Saved dataset to local storage for project {project_id}")


async def _local_download(project_id: str) -> bytes | None:
    def _run() -> bytes | None:
        p = _local_path(project_id)
        return p.read_bytes() if p.exists() else None

    content = await asyncio.to_thread(_run)
    if content is not None:
        logger.info(f"Restored dataset from local storage for project {project_id}")
    return content


async def _local_delete(project_id: str) -> None:
    def _run() -> None:
        p = _local_path(project_id)
        if p.exists():
            p.unlink()

    await asyncio.to_thread(_run)


# Local filesystem — model pkl files

def _local_model_path(model_id: str) -> Path:
    base = Path(settings.LOCAL_STORAGE_PATH) / "models"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{model_id}.pkl"


async def _local_upload_model(model_id: str, content: bytes) -> None:
    def _run() -> None:
        _local_model_path(model_id).write_bytes(content)

    await asyncio.to_thread(_run)
    logger.info(f"Saved model to local storage: {model_id}")


async def _local_download_model(model_id: str) -> bytes | None:
    def _run() -> bytes | None:
        p = _local_model_path(model_id)
        return p.read_bytes() if p.exists() else None

    return await asyncio.to_thread(_run)


async def _local_delete_model(model_id: str) -> None:
    def _run() -> None:
        p = _local_model_path(model_id)
        if p.exists():
            p.unlink()

    await asyncio.to_thread(_run)


# Supabase Storage — model pkl files

def _supabase_model_url(model_id: str) -> str:
    return (
        f"{settings.SUPABASE_URL}/storage/v1/object"
        f"/{settings.SUPABASE_STORAGE_BUCKET}/models/{model_id}.pkl"
    )


async def _supabase_upload_model(model_id: str, content: bytes) -> None:
    def _run() -> None:
        r = requests.post(
            _supabase_model_url(model_id),
            data=content,
            headers={**_supabase_headers(), "Content-Type": "application/octet-stream", "x-upsert": "true"},
            timeout=_TIMEOUT,
        )
        if not r.ok:
            logger.error(f"Supabase model upload failed {r.status_code}: {r.text}")
            r.raise_for_status()

    await asyncio.to_thread(_run)
    logger.info(f"Saved model to Supabase Storage: {model_id}")


async def _supabase_download_model(model_id: str) -> bytes | None:
    def _run() -> bytes | None:
        r = requests.get(_supabase_model_url(model_id), headers=_supabase_headers(), timeout=_TIMEOUT)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.content

    return await asyncio.to_thread(_run)


async def _supabase_delete_model(model_id: str) -> None:
    def _run() -> None:
        r = requests.delete(
            f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}",
            json={"prefixes": [f"models/{model_id}.pkl"]},
            headers=_supabase_headers(),
            timeout=_TIMEOUT,
        )
        if r.status_code not in (200, 404):
            r.raise_for_status()

    await asyncio.to_thread(_run)


# Public API - dispatches based on STORAGE_PROVIDER

async def upload_dataset(project_id: str, content: bytes) -> None:
    if settings.STORAGE_PROVIDER == "local":
        await _local_upload(project_id, content)
    else:
        await _supabase_upload(project_id, content)


async def download_dataset(project_id: str) -> bytes | None:
    if settings.STORAGE_PROVIDER == "local":
        return await _local_download(project_id)
    return await _supabase_download(project_id)


async def delete_dataset(project_id: str) -> None:
    if settings.STORAGE_PROVIDER == "local":
        await _local_delete(project_id)
    else:
        await _supabase_delete(project_id)


async def upload_model(model_id: str, content: bytes) -> None:
    if settings.STORAGE_PROVIDER == "local":
        await _local_upload_model(model_id, content)
    else:
        await _supabase_upload_model(model_id, content)


async def download_model(model_id: str) -> bytes | None:
    if settings.STORAGE_PROVIDER == "local":
        return await _local_download_model(model_id)
    return await _supabase_download_model(model_id)


async def delete_model(model_id: str) -> None:
    if settings.STORAGE_PROVIDER == "local":
        await _local_delete_model(model_id)
    else:
        await _supabase_delete_model(model_id)


async def get_or_restore_dataframe(project_id: str) -> pd.DataFrame | None:
    """Returns the project DataFrame from Redis, restoring from storage on a cache miss."""
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
