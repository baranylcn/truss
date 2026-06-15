import io
import asyncio
import logging
from functools import partial
from typing import List

import joblib
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from sklearn.model_selection import train_test_split
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.storage import get_or_restore_dataframe
from app.core.redis import acquire_training_lock, release_training_lock
from app.services.db import get_db
from app.services.models import User, Project, TrainedModel
from app.services.ml_pipeline import train_model, optimize_hyperparams, cross_validate_model
from app.schemas.model import TrainRequest, TrainResponse, EvaluateResponse, OptimizeRequest, OptimizeResponse, CrossValidateRequest, CrossValidateResponse
from app.utils.json_sanitize import sanitize_for_json
from app.utils.uuid_helpers import parse_project_id

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
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found. Please re-upload.")

    if not await acquire_training_lock(project_id):
        raise HTTPException(status_code=409, detail="Training already in progress for this project.")

    try:
        loop = asyncio.get_running_loop()
        _pipeline, task_type, metrics = await loop.run_in_executor(
            None,
            partial(
                train_model,
                df=df,
                model_type=body.model_type,
                target_column=body.target_column,
                test_size=body.test_size,
                hyperparameters=body.hyperparameters,
                task_type_override=body.task_type,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception(f"Training failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}")
    finally:
        await release_training_lock(project_id)

    sanitized_metrics = sanitize_for_json(metrics)

    best_q = await db.execute(
        select(TrainedModel).where(
            TrainedModel.project_id == parse_project_id(project_id),
            TrainedModel.is_best == True,  # noqa: E712
        )
    )
    existing_bests = list(best_q.scalars().all())

    if existing_bests:
        if task_type == "classification":
            best_existing = max((m.metrics or {}).get("accuracy", 0.0) for m in existing_bests)
            is_best = sanitized_metrics.get("accuracy", 0.0) >= best_existing
        else:
            best_existing = max((m.metrics or {}).get("r2", float("-inf")) for m in existing_bests)
            is_best = sanitized_metrics.get("r2", float("-inf")) >= best_existing
        if is_best:
            for m in existing_bests:
                m.is_best = False
    else:
        is_best = True

    model_row = TrainedModel(
        project_id=parse_project_id(project_id),
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
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    models_result = await db.execute(
        select(TrainedModel)
        .where(TrainedModel.project_id == parse_project_id(project_id))
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
    """Runs hyperparameter search on the best trained model for the project."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    best_result = await db.execute(
        select(TrainedModel)
        .where(TrainedModel.project_id == parse_project_id(project_id), TrainedModel.is_best == True)  # noqa: E712
        .order_by(TrainedModel.created_at.desc())
    )
    best_model = best_result.scalar_one_or_none()
    if best_model is None:
        raise HTTPException(status_code=404, detail="No trained model found. Complete the Training step first.")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found. Please re-upload.")

    if not await acquire_training_lock(project_id):
        raise HTTPException(status_code=409, detail="Training or optimization already in progress for this project.")

    model_type = best_model.model_type
    target_column = best_model.target_column
    task_type = best_model.task_type
    baseline_score = float((best_model.metrics or {}).get("accuracy") or (best_model.metrics or {}).get("r2") or 0.0)

    # Bayesian falls back to random search (no external dependency required)
    strategy = body.strategy if body.strategy in ("random", "grid") else "random"

    try:
        loop = asyncio.get_running_loop()
        opt_result = await loop.run_in_executor(
            None,
            partial(
                optimize_hyperparams,
                df=df,
                model_type=model_type,
                target_column=target_column,
                test_size=body.test_size,
                strategy=strategy,
                n_trials=body.n_trials,
                param_ranges=body.param_ranges or None,
                param_choices=body.param_choices or None,
                task_type_override=task_type,
            ),
        )
    except Exception as exc:
        logger.exception(f"Optimization failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}")
    finally:
        await release_training_lock(project_id)

    best_score = opt_result["best_score"]
    improvement = best_score - baseline_score

    logger.info(
        f"Optimization complete for project {project_id}: {model_type} | "
        f"baseline={baseline_score:.4f} best={best_score:.4f} trials={opt_result['trials_run']}"
    )

    return {
        "success": True,
        "best_params": opt_result["best_params"],
        "best_score": best_score,
        "baseline_score": baseline_score,
        "improvement": improvement,
        "trials_run": opt_result["trials_run"],
        "model_type": model_type,
        "strategy": body.strategy,
    }


async def _get_best_model_and_df(project_id: str, current_user: User, db: AsyncSession):
    result = await db.execute(
        select(Project).where(Project.id == parse_project_id(project_id), Project.user_id == current_user.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    best_result = await db.execute(
        select(TrainedModel)
        .where(TrainedModel.project_id == parse_project_id(project_id), TrainedModel.is_best == True)  # noqa: E712
        .order_by(TrainedModel.created_at.desc())
    )
    best_model = best_result.scalar_one_or_none()
    if best_model is None:
        raise HTTPException(status_code=404, detail="No trained model found. Complete the Training step first.")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found. Please re-upload.")

    return best_model, df


@router.get("/class-balance/{project_id}")
async def class_balance(
    project_id: str,
    target_column: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns class frequency distribution and imbalance ratio for a target column."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found. Please re-upload.")
    if target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{target_column}' not found")

    counts = df[target_column].dropna().value_counts()
    total = int(counts.sum())
    classes = [
        {"label": str(k), "count": int(v), "pct": round(float(v) / total * 100, 1)}
        for k, v in counts.items()
    ]
    imbalance_ratio = round(float(counts.max() / counts.min()), 2) if len(counts) > 1 and counts.min() > 0 else 1.0
    return {
        "classes": classes,
        "imbalance_ratio": imbalance_ratio,
        "is_imbalanced": imbalance_ratio > 3.0,
        "n_classes": len(counts),
    }


@router.post("/cross-validate/{project_id}", response_model=CrossValidateResponse)
async def cross_validate(
    project_id: str,
    body: CrossValidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Runs k-fold cross-validation and returns per-fold scores with mean ± std."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_or_restore_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found. Please re-upload.")

    if body.n_splits < 2 or body.n_splits > 20:
        raise HTTPException(status_code=400, detail="n_splits must be between 2 and 20")

    if not await acquire_training_lock(project_id):
        raise HTTPException(status_code=409, detail="Training or optimization already in progress for this project.")

    try:
        loop = asyncio.get_running_loop()
        cv_result = await loop.run_in_executor(
            None,
            partial(
                cross_validate_model,
                df=df,
                model_type=body.model_type,
                target_column=body.target_column,
                n_splits=body.n_splits,
                task_type_override=body.task_type,
                hyperparameters=body.hyperparameters,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception(f"Cross-validation failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Cross-validation failed: {exc}")
    finally:
        await release_training_lock(project_id)

    return cv_result


_BATCH_MAX_FILE_SIZE = 100 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {
    "text/csv", "text/plain", "application/csv", "application/octet-stream",
}


@router.post("/batch-predict/{project_id}")
async def batch_predict(
    request: Request,
    project_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Accepts a CSV upload, runs best-model predictions on it, and returns a CSV with predictions appended."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > _BATCH_MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File exceeds 100MB limit")
        except ValueError:
            pass

    best_model, df_train = await _get_best_model_and_df(project_id, current_user, db)

    try:
        contents = await asyncio.wait_for(file.read(), timeout=30)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="File upload timed out")

    if len(contents) > _BATCH_MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 100MB limit")

    try:
        df_new = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    def _run_predictions():
        pipe, _, _ = train_model(
            df=df_train,
            model_type=best_model.model_type,
            target_column=best_model.target_column,
            test_size=0.2,
            hyperparameters=best_model.parameters or {},
            task_type_override=best_model.task_type,
        )
        import numpy as np
        X_new = df_new.copy()
        if best_model.target_column in X_new.columns:
            X_new = X_new.drop(columns=[best_model.target_column])
        bool_cols = [c for c in X_new.columns if X_new[c].dtype == bool]
        if bool_cols:
            X_new = X_new.copy()
            X_new[bool_cols] = X_new[bool_cols].astype(np.int8)
        predictions = pipe.predict(X_new)
        out = df_new.copy()
        out["predicted"] = predictions
        buf = io.StringIO()
        out.to_csv(buf, index=False)
        return buf.getvalue()

    loop = asyncio.get_running_loop()
    try:
        csv_content = await loop.run_in_executor(None, _run_predictions)
    except Exception as exc:
        logger.exception(f"Batch prediction failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    filename = f"batch_predictions_{project_id[:8]}.csv"
    return StreamingResponse(
        io.BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/predictions/{project_id}")
async def export_predictions(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Re-trains best model, runs inference on test split, returns CSV with actual vs predicted."""
    best_model, df = await _get_best_model_and_df(project_id, current_user, db)

    def _build_csv():
        pipe, _, _ = train_model(
            df=df,
            model_type=best_model.model_type,
            target_column=best_model.target_column,
            test_size=0.2,
            hyperparameters=best_model.parameters or {},
            task_type_override=best_model.task_type,
        )
        import numpy as np
        import pandas as pd
        df_clean = df.dropna(subset=[best_model.target_column])
        X = df_clean.drop(columns=[best_model.target_column]).dropna()
        y = df_clean[best_model.target_column].loc[X.index]
        bool_cols = [c for c in X.columns if X[c].dtype == bool]
        if bool_cols:
            X = X.copy()
            X[bool_cols] = X[bool_cols].astype(np.int8)
        _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        y_pred = pipe.predict(X_test)
        out = X_test.copy()
        out["actual"] = y_test.values
        out["predicted"] = y_pred
        buf = io.StringIO()
        out.to_csv(buf, index=False)
        return buf.getvalue()

    loop = asyncio.get_running_loop()
    try:
        csv_content = await loop.run_in_executor(None, _build_csv)
    except Exception as exc:
        logger.exception(f"Prediction export failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")

    filename = f"predictions_{project_id[:8]}.csv"
    return StreamingResponse(
        io.BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/model/{project_id}")
async def export_model_file(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Re-trains best model with stored params and returns a joblib-serialized .pkl file."""
    best_model, df = await _get_best_model_and_df(project_id, current_user, db)

    def _build_pkl():
        pipe, _, _ = train_model(
            df=df,
            model_type=best_model.model_type,
            target_column=best_model.target_column,
            test_size=0.2,
            hyperparameters=best_model.parameters or {},
            task_type_override=best_model.task_type,
        )
        buf = io.BytesIO()
        joblib.dump(pipe, buf)
        buf.seek(0)
        return buf.read()

    loop = asyncio.get_running_loop()
    try:
        model_bytes = await loop.run_in_executor(None, _build_pkl)
    except Exception as exc:
        logger.exception(f"Model export failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")

    filename = f"{best_model.model_type}_{project_id[:8]}.pkl"
    return StreamingResponse(
        io.BytesIO(model_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
