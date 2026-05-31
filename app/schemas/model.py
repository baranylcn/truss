from typing import Dict, Any, Optional, List
from pydantic import BaseModel


class TrainRequest(BaseModel):
  model_type: str
  target_column: str
  test_size: float = 0.2
  hyperparameters: dict = {}
  task_type: Optional[str] = None  # "classification" | "regression" | None (auto-detect)


class TrainResponse(BaseModel):
  success: bool
  model_type: str
  target_column: str
  task_type: str
  metrics: Dict[str, Any]


class ModelResult(BaseModel):
  model: str
  metrics: Dict[str, Any]
  task_type: str


class EvaluateResponse(BaseModel):
  accuracy: float
  precision: Optional[float] = None
  recall: Optional[float] = None
  f1_score: Optional[float] = None
  problem_type: Optional[str] = None
  best_model: Optional[str] = None
  target_column: Optional[str] = None
  trained_models: Optional[List[str]] = None
  results: Optional[List[ModelResult]] = None
  confusion_matrix: Optional[List[List[int]]] = None
  class_names: Optional[List[str]] = None
  feature_importance: Optional[Dict[str, float]] = None


class OptimizeRequest(BaseModel):
  params: Dict[str, Any] = {}


class OptimizeResponse(BaseModel):
  success: bool
  best_params: Dict[str, Any]
  best_score: Optional[float] = None


class PredictRequest(BaseModel):
  data: List[List[Any]]
