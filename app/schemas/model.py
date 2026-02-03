from typing import Dict, Any, Optional, List
from pydantic import BaseModel


class TrainRequest(BaseModel):
  model_type: str
  target_column: str
  test_size: float = 0.2


class TrainResponse(BaseModel):
  success: bool
  model_type: str
  target_column: str
  task_type: str
  metrics: Dict[str, float]


class EvaluateResponse(BaseModel):
  accuracy: float
  precision: float
  recall: float
  f1_score: float
  problem_type: Optional[str] = None
  best_model: Optional[str] = None
  trained_models: Optional[List[str]] = None
  results: Optional[List[Dict[str, Any]]] = None


class OptimizeRequest(BaseModel):
  params: Dict[str, Any] = {}


class OptimizeResponse(BaseModel):
  success: bool
  best_params: Dict[str, Any]
  best_score: Optional[float] = None


class PredictRequest(BaseModel):
  data: List[List[Any]]
