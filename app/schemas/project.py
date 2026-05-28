from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    current_step: Optional[str] = None


class ProjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    filename: Optional[str] = None
    status: str
    current_step: str
    columns: Optional[List[str]] = None
    shape: Optional[List[int]] = None
    dtypes: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
