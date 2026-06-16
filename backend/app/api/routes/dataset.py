import asyncio
import logging
from io import BytesIO
from functools import partial

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.core.redis import set_dataframe, get_analysis_cache, set_analysis_cache, set_column_tags
from app.core.storage import upload_dataset as storage_upload, get_or_restore_dataframe
from app.services.db import get_db
from app.services.models import User, Project
from app.services.ml_pipeline import df_to_payload, analyze_dataframe
from app.schemas.dataset import UploadResponse, AnalyzeResponse
from app.utils.json_sanitize import sanitize_for_json
from app.utils.uuid_helpers import parse_project_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dataset", tags=["dataset"])

_ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "text/plain",
    "application/csv",
    "application/octet-stream",
}


def _validate_csv_upload(request: Request, file: UploadFile, max_bytes: int) -> None:
    """Raises HTTPException early if the upload is clearly not a CSV or too large."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")
        except ValueError:
            pass


@router.post("/upload", response_model=UploadResponse)
@limiter.limit("30/hour")
async def upload_dataset(
    request: Request,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Parses a CSV upload, stores the DataFrame in Redis, and updates project metadata."""
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    _validate_csv_upload(request, file, max_bytes)

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        loop = asyncio.get_running_loop()
        df = await asyncio.wait_for(
            loop.run_in_executor(None, partial(pd.read_csv, BytesIO(content))),
            timeout=30,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="CSV parsing timed out. The file may be malformed or too complex.")
    except pd.errors.ParserError:
        raise HTTPException(status_code=400, detail="Invalid CSV format")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file contains no data")

    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await set_dataframe(project_id, df, sync_storage=False)
    await set_column_tags(project_id, {})
    try:
        await storage_upload(project_id, content)
    except Exception as storage_exc:
        logger.error(f"Storage persist failed for project {project_id}: {storage_exc}. Data is in Redis only.")

    columns = list(df.columns)
    shape = [len(df), len(columns)]
    dtypes = {col: str(df[col].dtype) for col in columns}

    project.filename = file.filename
    project.columns = columns
    project.shape = shape
    project.dtypes = dtypes
    project.current_step = "analyze"
    await db.commit()

    logger.info(f"CSV uploaded for project {project_id} ({shape[0]}x{shape[1]})")
    payload = sanitize_for_json(df_to_payload(df, project_id))
    return payload


@router.get("/analyze/{project_id}", response_model=AnalyzeResponse)
async def analyze_dataset(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns per-column statistics for the cached DataFrame."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found in cache. Please re-upload.")

    analysis = await get_analysis_cache(project_id)
    if analysis is None:
        analysis = analyze_dataframe(df)
        await set_analysis_cache(project_id, analysis)

    dataset_info = sanitize_for_json(df_to_payload(df, project_id))
    return {"analysis": analysis, "dataset_info": dataset_info}


@router.get("/info/{project_id}", response_model=UploadResponse)
async def dataset_info(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns the current DataFrame snapshot (columns, shape, missing values)."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found in cache. Please re-upload.")

    payload = sanitize_for_json(df_to_payload(df, project_id))
    return payload
