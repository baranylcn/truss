from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
from io import BytesIO

from ...services.session_store import session_store
from ...services.ml_pipeline import df_to_session_payload, analyze_dataframe
from ...schemas.dataset import UploadResponse, AnalyzeResponse

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
  if not file.filename.endswith(".csv"):
    raise HTTPException(status_code=400, detail="Only CSV files are supported")

  try:
    content = await file.read()
    df = pd.read_csv(BytesIO(content))
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

  state = session_store.create_session(df)
  return df_to_session_payload(state)


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
