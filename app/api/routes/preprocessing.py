from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import pandas as pd

from ...services.session_store import session_store
from ...services.ml_pipeline import (
  df_to_session_payload,
  handle_missing_values,
  handle_outliers,
  encode_columns,
  scale_columns,
  compute_correlation,
)
from ...schemas.preprocessing import (
  MissingValuesRequest,
  OutliersRequest,
  EncodingRequest,
  ScalingRequest,
  PreprocessingResponse,
  CorrelationResponse,
)
from ...services.db import get_db
from ...services.models import MLSessions
from ...utils.json_sanitize import sanitize_for_json

router = APIRouter(prefix="/preprocessing", tags=["preprocessing"])


async def _sync_session_to_db(state, db: AsyncSession) -> None:
  payload = df_to_session_payload(state)
  df = state.df
  columns = payload["columns"]
  shape = list(payload["shape"])
  dtypes = {col: str(df[col].dtype) for col in columns}
  missing_values = payload["missing_values"]
  current_data = {
    "data": payload["data"],
    "columns": columns,
    "shape": shape,
  }

  current_data = sanitize_for_json(current_data)

  result = await db.execute(
    select(MLSessions).where(MLSessions.session_id == state.session_id)
  )
  row = result.scalar_one_or_none()

  if row is None:
    row = MLSessions(
      session_id=state.session_id,
      user_id=None,
      filename=None,
      columns=columns,
      shape=shape,
      dtypes=dtypes,
      missing_values=missing_values,
      current_data=current_data,
    )
    db.add(row)
  else:
    row.columns = columns
    row.shape = shape
    row.dtypes = dtypes
    row.missing_values = missing_values
    row.current_data = current_data

  await db.commit()


@router.post("/missing-values", response_model=PreprocessingResponse)
async def missing_values(
  body: MissingValuesRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  try:
    df_new = handle_missing_values(state.df, body.method, body.columns)
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Missing values handling failed: {str(e)}")
  
  state = session_store.update_df(state.session_id, df_new)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.post("/detect-outliers")
async def detect_outliers(
  body: OutliersRequest,
):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  try:
    target_cols = body.columns or [c for c in state.df.columns if pd.api.types.is_numeric_dtype(state.df[c])]
  except Exception:
    target_cols = [c for c in state.df.columns if pd.api.types.is_numeric_dtype(state.df[c])]

  outlier_results = {}
  
  for col in target_cols:
    if not pd.api.types.is_numeric_dtype(state.df[col]):
      continue
      
    df_col = state.df[col].dropna()
    if df_col.empty:
      outlier_results[col] = {"count": 0, "values": [], "method": body.method}
      continue
    
    outliers_mask = None
    
    if body.method == "iqr":
      q1 = df_col.quantile(0.25)
      q3 = df_col.quantile(0.75)
      iqr = q3 - q1
      lower = q1 - 1.5 * iqr
      upper = q3 + 1.5 * iqr
      outliers_mask = (state.df[col] < lower) | (state.df[col] > upper)
    elif body.method == "zscore":
      mean = df_col.mean()
      std = df_col.std()
      if std > 0:
        z = (state.df[col] - mean) / std
        outliers_mask = z.abs() > 3
    
    if outliers_mask is not None:
      outlier_count = int(outliers_mask.sum())
      outlier_values = state.df.loc[outliers_mask, col].dropna().astype(float).tolist()
      outlier_results[col] = {
        "count": outlier_count,
        "values": outlier_values[:100],
        "method": body.method
      }
    else:
      outlier_results[col] = {"count": 0, "values": [], "method": body.method}
  
  return {"data": {"outlier_results": outlier_results}}


@router.post("/outliers", response_model=PreprocessingResponse)
async def outliers(
  body: OutliersRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  try:
    df_new = handle_outliers(state.df, body.method, body.columns)
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Outliers handling failed: {str(e)}")
  
  state = session_store.update_df(state.session_id, df_new)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.post("/encoding", response_model=PreprocessingResponse)
async def encoding(
  body: EncodingRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  if not body.columns or len(body.columns) == 0:
    raise HTTPException(status_code=400, detail="At least one column must be specified for encoding")

  try:
    df_new = encode_columns(state.df, body.method, body.columns)
  except KeyError as e:
    raise HTTPException(status_code=400, detail=f"Column not found: {str(e)}")
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Encoding failed: {str(e)}")
  
  state = session_store.update_df(state.session_id, df_new)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.post("/scaling", response_model=PreprocessingResponse)
async def scaling(
  body: ScalingRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  try:
    df_new = scale_columns(state.df, body.method, body.columns)
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Scaling failed: {str(e)}")
  
  state = session_store.update_df(state.session_id, df_new)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.get("/correlation", response_model=CorrelationResponse)
async def correlation():
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  matrix, cols = compute_correlation(state.df)
  return {"correlation_matrix": matrix, "columns": cols}
