from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...services.session_store import session_store
from ...services.ml_pipeline import train_model_for_current_session
from ...schemas.model import (
  TrainRequest,
  TrainResponse,
  EvaluateResponse,
  OptimizeRequest,
  OptimizeResponse,
  PredictRequest,
)
from ...services.db import get_db
from ...services.models import MLSessions, MLTrainedModels
from ...utils.json_sanitize import sanitize_for_json

router = APIRouter(prefix="/model", tags=["model"])


@router.post("/train", response_model=TrainResponse)
async def train_model(
  body: TrainRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    state, metrics = train_model_for_current_session(
      model_type=body.model_type,
      target_column=body.target_column,
      test_size=body.test_size,
    )
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Training failed: {e}")

  result = await db.execute(
    select(MLSessions).where(MLSessions.session_id == state.session_id)
  )
  session_row = result.scalar_one_or_none()

  if session_row is not None:
    sanitized_metrics = sanitize_for_json(metrics)
    model_row = MLTrainedModels(
      session_id=session_row.id,
      model_type=body.model_type,
      target_column=body.target_column,
      metrics=sanitized_metrics,
      parameters={},
      model_path=None,
    )
    db.add(model_row)
    await db.commit()

  return {
    "success": True,
    "model_type": body.model_type,
    "target_column": body.target_column,
    "task_type": state.task_type or "classification",
    "metrics": metrics,
  }


@router.get("/evaluate", response_model=EvaluateResponse)
async def evaluate_model():
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  if not state.metrics:
    raise HTTPException(status_code=400, detail="Model not trained yet")

  metrics = {
    "accuracy": float(state.metrics.get("accuracy", 0.0)),
    "precision": float(state.metrics.get("precision", 0.0)),
    "recall": float(state.metrics.get("recall", 0.0)),
    "f1_score": float(state.metrics.get("f1_score", 0.0)),
  }
  return metrics


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_model(body: OptimizeRequest):
  return {
    "success": True,
    "best_params": body.params or {},
    "best_score": 0.0,
  }


@router.post("/predict")
async def predict(body: PredictRequest):
  try:
    state = session_store.get_current()
  except KeyError:
    raise HTTPException(status_code=404, detail="No active session")

  if not state.model:
    raise HTTPException(status_code=400, detail="Model not trained yet")

  try:
    preds = state.model.predict(body.data)
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Prediction failed: {e}")

  return {"predictions": [p.item() if hasattr(p, "item") else p for p in preds]}
