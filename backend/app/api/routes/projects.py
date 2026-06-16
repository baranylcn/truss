import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, delete

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.redis import delete_dataframe
from app.core.storage import delete_dataset, delete_model
from app.services.db import get_db
from app.services.models import User, Project, TrainedModel
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.utils.uuid_helpers import parse_project_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


def _assert_owner(project: Project, user: User) -> None:
    if project.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Project]:
    result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    limit = settings.MAX_PROJECTS_PER_USER
    count_result = await db.execute(
        select(func.count(Project.id)).where(Project.user_id == current_user.id)
    )
    if (count_result.scalar() or 0) >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit ({limit}) reached.",
        )

    project = Project(
        user_id=current_user.id,
        name=body.name,
        status="active",
        current_step="upload",
    )
    db.add(project)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Project could not be created.") from exc
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    result = await db.execute(select(Project).where(Project.id == parse_project_id(project_id)))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, current_user)
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Updates name, status, and/or current_step of a project."""
    result = await db.execute(select(Project).where(Project.id == parse_project_id(project_id)))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, current_user)

    if body.name is not None:
        project.name = body.name
    if body.status is not None:
        project.status = body.status
    if body.current_step is not None:
        project.current_step = body.current_step
    if body.view_mode is not None:
        project.view_mode = body.view_mode

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deletes the project, clears its Redis cache, and purges its storage files."""
    result = await db.execute(select(Project).where(Project.id == parse_project_id(project_id)))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, current_user)

    # Collect model file paths before the cascade delete removes their rows.
    model_paths = (
        await db.execute(
            select(TrainedModel.model_path).where(TrainedModel.project_id == project.id)
        )
    ).scalars().all()

    await delete_dataframe(project_id)
    # Storage cleanup is best-effort: a failure here must not block the DB delete,
    # otherwise the project becomes undeletable. Orphaned files are logged.
    try:
        await delete_dataset(project_id)
    except Exception as exc:
        logger.error(f"Dataset storage cleanup failed for project {project_id}: {exc}")
    for path in model_paths:
        if not path:
            continue
        try:
            await delete_model(path)
        except Exception as exc:
            logger.error(f"Model storage cleanup failed for {path}: {exc}")

    await db.execute(delete(Project).where(Project.id == parse_project_id(project_id)))
    await db.commit()
