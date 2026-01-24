from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import pandas as pd
from io import BytesIO

from ...services.session_store import session_store
from ...services.ml_pipeline import df_to_session_payload, analyze_dataframe
from ...schemas.dataset import UploadResponse, AnalyzeResponse
from ...services.db import get_db
from ...services.models import MLSessions
from app.utils.json_sanitize import sanitize_for_json
from app.core.logging import logger


router = APIRouter(prefix="/dataset", tags=["dataset"])


async def _save_session_to_database(
    session_id: str,
    filename: str,
    columns: list,
    shape: tuple,
    dtypes: dict,
    missing_values: dict,
    current_data: dict,
    db: AsyncSession
):
    """Background task to save session data to database without blocking response."""
    try:
        existing = await db.execute(
            select(MLSessions).where(MLSessions.session_id == session_id)
        )
        row = existing.scalar_one_or_none()

        if row is None:
            row = MLSessions(
                session_id=session_id,
                filename=filename,
                columns=columns,
                shape=shape,
                dtypes=dtypes,
                missing_values=missing_values,
                current_data=current_data,
            )
            db.add(row)
        else:
            row.filename = filename
            row.columns = columns
            row.shape = shape
            row.dtypes = dtypes
            row.missing_values = missing_values
            row.current_data = current_data

        await db.commit()
        logger.info(f"Background: Session {session_id} saved to database successfully")
    except Exception as e:
        await db.rollback()
        logger.error(f"Background: Failed to save session {session_id} to database: {str(e)}")


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload CSV dataset and create session.
    
    File is parsed immediately and session data returned in response.
    Database persistence happens asynchronously in the background.
    
    Constraints:
    - File size: Maximum 100MB
    - Format: CSV only
    - Data: Full dataset preserved (no row/column limits)
    """
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")
    
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        
        MAX_FILE_SIZE = 100 * 1024 * 1024
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"File size exceeds 100MB limit. Uploaded: {len(content) / 1024 / 1024:.1f}MB"
            )
        
        if not content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        df = pd.read_csv(BytesIO(content))
    except pd.errors.ParserError:
        raise HTTPException(status_code=400, detail="Failed to parse CSV: Invalid format")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file contains no data")

    state = session_store.create_session(df)
    payload = df_to_session_payload(state)

    columns = payload["columns"]
    shape = payload["shape"]
    missing_values = payload["missing_values"]
    dtypes = {col: str(df[col].dtype) for col in columns}

    current_data = {
        "data": payload["data"],
        "columns": payload["columns"],
        "shape": payload["shape"],
    }

    current_data = sanitize_for_json(current_data)

    background_tasks.add_task(
        _save_session_to_database,
        session_id=state.session_id,
        filename=file.filename,
        columns=columns,
        shape=shape,
        dtypes=dtypes,
        missing_values=missing_values,
        current_data=current_data,
        db=db,
    )

    logger.info(f"Session {state.session_id} created from {file.filename} ({shape[0]} rows, {shape[1]} cols)")
    
    return payload

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_dataset():
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  analysis = analyze_dataframe(state.df)
  dataset_payload = df_to_session_payload(state)
  return {"analysis": analysis, "dataset_info": dataset_payload}


@router.get("/info", response_model=UploadResponse)
async def dataset_info():
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")
  return df_to_session_payload(state)
