from typing import Dict, List, Tuple, Any
from pydantic import BaseModel


class DatasetInfo(BaseModel):
  session_id: str
  data: List[List[Any]]
  columns: List[str]
  shape: Tuple[int, int]
  missing_values: Dict[str, int]


class UploadResponse(DatasetInfo):
  pass


class AnalyzeResponse(BaseModel):
  analysis: List[dict]
  dataset_info: DatasetInfo
