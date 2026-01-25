from typing import List, Optional
from pydantic import BaseModel
from .dataset import DatasetInfo


class MissingValuesRequest(BaseModel):
  numerical_method: str  # For numeric columns: "drop" | "mean" | "median"
  categorical_method: str = "mode"  # For categorical columns: "drop" | "mode" (defaults to "mode")
  columns: Optional[List[str]] = None


class OutliersRequest(BaseModel):
  method: str  # "iqr" | "zscore"
  columns: Optional[List[str]] = None


class EncodingRequest(BaseModel):
  method: str  # "label" | "onehot" | "ordinal"
  columns: Optional[List[str]] = None


class ScalingRequest(BaseModel):
  method: str  # "standard" | "minmax" | "robust"
  columns: Optional[List[str]] = None


class PreprocessingResponse(DatasetInfo):
  pass


class CorrelationResponse(BaseModel):
  correlation_matrix: dict[str, dict[str, float]]
  columns: list[str]
