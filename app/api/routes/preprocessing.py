from fastapi import APIRouter, HTTPException

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

router = APIRouter(prefix="/preprocessing", tags=["preprocessing"])


@router.post("/missing-values", response_model=PreprocessingResponse)
async def missing_values(body: MissingValuesRequest):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  df_new = handle_missing_values(state.df, body.method, body.columns)
  state = session_store.update_df(state.session_id, df_new)
  return df_to_session_payload(state)


@router.post("/outliers", response_model=PreprocessingResponse)
async def outliers(body: OutliersRequest):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  df_new = handle_outliers(state.df, body.method, body.columns)
  state = session_store.update_df(state.session_id, df_new)
  return df_to_session_payload(state)


@router.post("/encoding", response_model=PreprocessingResponse)
async def encoding(body: EncodingRequest):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  df_new = encode_columns(state.df, body.method, body.columns)
  state = session_store.update_df(state.session_id, df_new)
  return df_to_session_payload(state)


@router.post("/scaling", response_model=PreprocessingResponse)
async def scaling(body: ScalingRequest):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  df_new = scale_columns(state.df, body.method, body.columns)
  state = session_store.update_df(state.session_id, df_new)
  return df_to_session_payload(state)


@router.get("/correlation", response_model=CorrelationResponse)
async def correlation():
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  matrix, cols = compute_correlation(state.df)
  return {"correlation_matrix": matrix, "columns": cols}
