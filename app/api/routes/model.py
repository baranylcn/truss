import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.redis import get_dataframe
from app.services.db import get_db
from app.services.models import User, Project, TrainedModel
from app.services.ml_pipeline import train_model
from app.schemas.model import TrainRequest, TrainResponse, EvaluateResponse, OptimizeRequest, OptimizeResponse
from app.utils.json_sanitize import sanitize_for_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/model", tags=["model"])


@router.post("/train/{project_id}", response_model=TrainResponse)
async def start_training(
    project_id: str,
    body: TrainRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Trains the model synchronously and persists results to the database."""
    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found in cache. Please re-upload.")

    try:
        _pipeline, task_type, metrics = train_model(
            df=df,
            model_type=body.model_type,
            target_column=body.target_column,
            test_size=body.test_size,
            hyperparameters=body.hyperparameters,
            task_type_override=body.task_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception(f"Training failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}")

    sanitized_metrics = sanitize_for_json(metrics)

    result_q = await db.execute(
        select(TrainedModel).where(
            TrainedModel.project_id == uuid.UUID(project_id),
            TrainedModel.is_best == True,  # noqa: E712
        )
    )
    existing_best = result_q.scalar_one_or_none()

    if existing_best is not None and task_type == "classification":
        existing_acc = (existing_best.metrics or {}).get("accuracy", 0.0)
        if sanitized_metrics.get("accuracy", 0.0) > existing_acc:
            existing_best.is_best = False
            is_best = True
        else:
            is_best = False
    else:
        is_best = True

    model_row = TrainedModel(
        project_id=uuid.UUID(project_id),
        model_type=body.model_type,
        target_column=body.target_column,
        task_type=task_type,
        metrics=sanitized_metrics,
        parameters=body.hyperparameters,
        is_best=is_best,
    )
    db.add(model_row)

    project.current_step = "evaluation"
    await db.commit()

    logger.info(f"Training complete for project {project_id}: {body.model_type} ({task_type}) acc={sanitized_metrics.get('accuracy')}")

    return {
        "success": True,
        "model_type": body.model_type,
        "target_column": body.target_column,
        "task_type": task_type,
        "metrics": sanitized_metrics,
    }


@router.get("/evaluate/{project_id}", response_model=EvaluateResponse)
async def evaluate_model(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns metrics for all trained models, with the best model highlighted."""
    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    models_result = await db.execute(
        select(TrainedModel)
        .where(TrainedModel.project_id == uuid.UUID(project_id))
        .order_by(TrainedModel.created_at.desc())
    )
    models: List[TrainedModel] = list(models_result.scalars().all())

    if not models:
        raise HTTPException(status_code=404, detail="No trained models found")

    best = next((m for m in models if m.is_best), models[0])
    best_metrics = best.metrics or {}

    results = [
        {"model": m.model_type, "metrics": m.metrics or {}, "task_type": m.task_type}
        for m in models
    ]

    is_regression = best.task_type == "regression"
    return {
        "accuracy": float(best_metrics.get("accuracy", 0.0)),
        "precision": None if is_regression else float(best_metrics.get("precision", 0.0)),
        "recall": None if is_regression else float(best_metrics.get("recall", 0.0)),
        "f1_score": None if is_regression else float(best_metrics.get("f1_score", 0.0)),
        "problem_type": best.task_type,
        "best_model": best.model_type,
        "target_column": best.target_column,
        "trained_models": [m.model_type for m in models],
        "results": results,
        "confusion_matrix": best_metrics.get("confusion_matrix"),
        "class_names": best_metrics.get("class_names"),
        "feature_importance": best_metrics.get("feature_importance"),
    }


@router.post("/optimize/{project_id}", response_model=OptimizeResponse)
async def optimize_model(
    project_id: str,
    body: OptimizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Hyperparameter optimization stub — will dispatch a Celery task when integrated."""
    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "success": True,
        "best_params": body.params,
        "best_score": 0.0,
    }
