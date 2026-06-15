from typing import Dict, Any, Optional, List, Literal
from pydantic import BaseModel

ModelType = Literal["linear_regression", "logistic_regression", "random_forest", "xgboost"]
TaskType = Literal["classification", "regression"]


class TrainRequest(BaseModel):
  model_type: ModelType
  target_column: str
  test_size: float = 0.2
  hyperparameters: dict = {}
  task_type: Optional[TaskType] = None


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
  strategy: str = "random"   # "random" | "grid" | "bayesian"
  n_trials: int = 20
  test_size: float = 0.2
  param_ranges: Dict[str, List[float]] = {}   # {param: [min, max]}
  param_choices: Dict[str, List[str]] = {}    # {param: [opt1, opt2, ...]}


class OptimizeResponse(BaseModel):
  success: bool
  best_params: Dict[str, Any]
  best_score: float
  baseline_score: float
  improvement: float
  trials_run: int
  model_type: str
  strategy: str


class CrossValidateRequest(BaseModel):
  model_type: ModelType
  target_column: str
  n_splits: int = 5
  task_type: Optional[TaskType] = None
  hyperparameters: dict = {}


class CrossValidateResponse(BaseModel):
  fold_scores: List[float]
  mean_score: float
  std_score: float
  n_splits: int
  task_type: str
  scoring: str
  model_type: str


class PredictRequest(BaseModel):
  data: List[List[Any]]
