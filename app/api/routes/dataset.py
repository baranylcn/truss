from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
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


router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(
  file: UploadFile = File(...),
  db: AsyncSession = Depends(get_db),
):
  if not file.filename:
    raise HTTPException(status_code=400, detail="File name is required")
    
  if not file.filename.endswith(".csv"):
    raise HTTPException(status_code=400, detail="Only CSV files are supported")

  try:
    content = await file.read()
    if not content:
      raise HTTPException(status_code=400, detail="File is empty")
    df = pd.read_csv(BytesIO(content))
  except pd.errors.ParserError as e:
    raise HTTPException(status_code=400, detail=f"Failed to parse CSV: Invalid format")
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

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

  existing = await db.execute(
      select(MLSessions).where(MLSessions.session_id == state.session_id)
  )
  row = existing.scalar_one_or_none()

  if row is None:
      row = MLSessions(
          session_id=state.session_id,
          filename=file.filename,
          columns=columns,
          shape=shape,
          dtypes=dtypes,
          missing_values=missing_values,
          current_data=current_data,
      )
      db.add(row)
  else:
      row.filename = file.filename
      row.columns = columns
      row.shape = shape
      row.dtypes = dtypes
      row.missing_values = missing_values
      row.current_data = current_data

  await db.commit()

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
