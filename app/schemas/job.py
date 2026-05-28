from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class JobResponse(BaseModel):
    id: UUID
    project_id: UUID
    job_type: str
    celery_task_id: Optional[str] = None
    status: str
    result: Optional[Any] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
