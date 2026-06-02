import uuid
import logging
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.redis import get_dataframe, set_dataframe, get_analysis_cache, set_analysis_cache
from app.services.db import get_db
from app.services.models import User, Project
from app.services.ml_pipeline import df_to_payload, analyze_dataframe
from app.schemas.dataset import UploadResponse, AnalyzeResponse
from app.utils.json_sanitize import sanitize_for_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dataset", tags=["dataset"])

MAX_FILE_SIZE = 100 * 1024 * 1024


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Parses a CSV upload, stores the DataFrame in Redis, and updates project metadata."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 100MB limit")
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        df = pd.read_csv(BytesIO(content))
    except pd.errors.ParserError:
        raise HTTPException(status_code=400, detail="Invalid CSV format")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file contains no data")

    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await set_dataframe(project_id, df)

    columns = list(df.columns)
    shape = [len(df), len(columns)]
    dtypes = {col: str(df[col].dtype) for col in columns}

    project.filename = file.filename
    project.columns = columns
    project.shape = shape
    project.dtypes = dtypes
    project.current_step = "analyze"
    await db.commit()

    logger.info(f"Uploaded {file.filename} for project {project_id} ({shape[0]}x{shape[1]})")
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
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_dataframe(project_id)
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
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found in cache. Please re-upload.")

    payload = sanitize_for_json(df_to_payload(df, project_id))
    return payload
