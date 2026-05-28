from typing import Dict, List, Tuple, Any, Optional
from pydantic import BaseModel


class DatasetInfo(BaseModel):
  project_id: str
  data: List[List[Any]]
  columns: List[str]
  shape: Tuple[int, int]
  missing_values: Dict[str, int]
  categorical_columns: Optional[List[str]] = None


class UploadResponse(DatasetInfo):
  pass


class AnalyzeResponse(BaseModel):
  analysis: List[dict]
  dataset_info: DatasetInfo
