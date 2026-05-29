from typing import List, Optional, Dict
from pydantic import BaseModel
from .dataset import DatasetInfo


class MissingValuesRequest(BaseModel):
    numerical_method: Optional[str] = "mean"  # "mean" | "median" | "mode" | "drop" | "none"
    categorical_method: str = "mode"           # "mode" | "drop" | "none"
    column_methods: Optional[Dict[str, str]] = None  # per-column overrides
    columns: Optional[List[str]] = None


class OutliersRequest(BaseModel):
    method: str                       # "iqr" | "zscore"
    action: str = "clip"              # "clip" | "drop" | "none"
    columns: Optional[List[str]] = None
    factor: Optional[float] = None   # IQR multiplier (default 1.5) or z-score threshold (default 3)


class EncodingRequest(BaseModel):
    method: str                       # "label" | "onehot" | "ordinal"
    column_methods: Optional[Dict[str, str]] = None  # per-column overrides
    columns: Optional[List[str]] = None


class ScalingRequest(BaseModel):
    method: str                       # "standard" | "minmax" | "robust"
    column_methods: Optional[Dict[str, str]] = None  # per-column overrides
    columns: Optional[List[str]] = None


class PreprocessingResponse(DatasetInfo):
    pass


class CorrelationResponse(BaseModel):
    correlation_matrix: dict[str, dict[str, float]]
    columns: list[str]
