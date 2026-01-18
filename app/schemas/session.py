from pydantic import BaseModel
from .dataset import DatasetInfo


class SnapshotRequest(BaseModel):
  step_id: int


class UndoRequest(BaseModel):
  step_id: int


class SnapshotResponse(BaseModel):
  success: bool


class SessionCreateRequest(BaseModel):
  data: list[list[object]]
  columns: list[str]


class SessionUpdateRequest(BaseModel):
  data: list[list[object]]
  columns: list[str]


class SessionResponse(DatasetInfo):
  pass
