import uuid
from fastapi import HTTPException


def parse_project_id(project_id: str) -> uuid.UUID:
    """Parses project_id as UUID, raising 400 on invalid format instead of letting it 500."""
    try:
        return uuid.UUID(project_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid project ID format")
