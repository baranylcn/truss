from typing import List, Optional
from pydantic import BaseModel
from .dataset import DatasetInfo


class MissingValuesRequest(BaseModel):
  method: str  # "drop" | "mean" | "median" | "mode"
  columns: Optional[List[str]] = None


class OutliersRequest(BaseModel):
  method: str  # "iqr" | "zscore"
  columns: Optional[List[str]] = None


class EncodingRequest(BaseModel):
  method: str  # "label" | "onehot" | "ordinal"
  columns: List[str]


class ScalingRequest(BaseModel):
  method: str  # "standard" | "minmax" | "robust"
  columns: Optional[List[str]] = None


class PreprocessingResponse(DatasetInfo):
  pass


class CorrelationResponse(BaseModel):
  correlation_matrix: dict[str, dict[str, float]]
  columns: list[str]
