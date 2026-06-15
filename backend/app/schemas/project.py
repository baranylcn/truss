from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, field_validator
from datetime import datetime

PipelineStep = Literal[
    "upload", "analyze", "missing-values", "outliers", "encoding",
    "correlation", "scaling", "training", "evaluation", "optimization",
    "export", "filter-rows", "feature-engineering", "feature-selection",
    "cross-validate", "pipeline-history",
]


class ProjectCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Project name cannot be empty")
        if len(v) > 200:
            raise ValueError("Project name cannot exceed 200 characters")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[Literal["active", "archived", "completed", "failed"]] = None
    current_step: Optional[PipelineStep] = None
    view_mode: Optional[Literal["guided", "freestyle"]] = None


class ProjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    filename: Optional[str] = None
    status: str
    current_step: str
    view_mode: str = "guided"
    columns: Optional[List[str]] = None
    shape: Optional[List[int]] = None
    dtypes: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
