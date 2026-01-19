from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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

  df_new = handle_missing_values(state.df, body.method, body.columns)
  state = session_store.update_df(state.session_id, df_new)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.post("/outliers", response_model=PreprocessingResponse)
async def outliers(
  body: OutliersRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  df_new = handle_outliers(state.df, body.method, body.columns)
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

  df_new = encode_columns(state.df, body.method, body.columns)
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

  df_new = scale_columns(state.df, body.method, body.columns)
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
