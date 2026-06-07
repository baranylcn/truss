import uuid
import logging

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.redis import (
    get_dataframe, set_dataframe,
    get_correlation_cache, set_correlation_cache,
    get_column_tags, set_column_tags,
)
from app.services.db import get_db
from app.services.models import User, Project, PipelineState
from app.services.ml_pipeline import (
    df_to_payload,
    handle_missing_values,
    handle_outliers,
    encode_columns,
    scale_columns,
    compute_correlation,
)
from app.schemas.preprocessing import (
    MissingValuesRequest,
    OutliersRequest,
    EncodingRequest,
    ScalingRequest,
    PreprocessingResponse,
    CorrelationResponse,
    ColumnTagsResponse,
)
from app.utils.json_sanitize import sanitize_for_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/preprocessing", tags=["preprocessing"])


async def _load_df_or_404(project_id: str, user: User, db: AsyncSession) -> pd.DataFrame:
    """Fetches the project DataFrame from Redis, verifying ownership. Raises 404 if not found."""
    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_dataframe(project_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Project data not found in cache. Please re-upload.")
    return df


async def _save_pipeline_state(
    project_id: str,
    step_name: str,
    config: dict,
    df: pd.DataFrame,
    db: AsyncSession,
) -> None:
    """Persists the step config and a data snapshot to pipeline_states."""
    snapshot = sanitize_for_json({"data": df.values.tolist(), "columns": list(df.columns)})
    state = PipelineState(
        project_id=uuid.UUID(project_id),
        step_name=step_name,
        config=config,
        data_snapshot=snapshot,
    )
    db.add(state)
    await db.commit()


async def _update_column_tags(
    project_id: str,
    step_name: str,
    config: dict,
    df_before: pd.DataFrame,
    df_after: pd.DataFrame,
) -> None:
    """Computes and persists per-column transformation tags after a preprocessing step."""
    tags = await get_column_tags(project_id)

    if step_name == "scaling":
        method = config.get("method", "standard")
        column_methods = config.get("column_methods") or {}
        requested_cols = config.get("columns")
        if requested_cols:
            affected = [c for c in requested_cols if c in df_before.columns]
        else:
            affected = [c for c in df_before.columns if pd.api.types.is_numeric_dtype(df_before[c])]
        for col in affected:
            m = column_methods.get(col, method)
            col_tags = [t for t in tags.get(col, []) if not t.startswith("scaled:")]
            col_tags.append(f"scaled:{m}")
            tags[col] = col_tags

    elif step_name == "encoding":
        method = config.get("method", "label")
        column_methods = config.get("column_methods") or {}
        requested_cols = config.get("columns")
        if requested_cols:
            original_cols = [c for c in requested_cols if c in df_before.columns and not pd.api.types.is_numeric_dtype(df_before[c])]
        else:
            original_cols = [c for c in df_before.columns if not pd.api.types.is_numeric_dtype(df_before[c])]
        before_col_set = set(df_before.columns)
        after_col_set = set(df_after.columns)
        new_cols = after_col_set - before_col_set
        for col in original_cols:
            m = column_methods.get(col, method)
            if m == "onehot":
                tags.pop(col, None)
                for new_col in new_cols:
                    if new_col.startswith(col + "_"):
                        tags[new_col] = [f"encoded:{m}"]
            else:
                col_tags = [t for t in tags.get(col, []) if not t.startswith("encoded:")]
                col_tags.append(f"encoded:{m}")
                tags[col] = col_tags

    elif step_name == "outliers":
        action = config.get("action", "clip")
        if action != "none":
            requested_cols = config.get("columns")
            if requested_cols:
                affected = [c for c in requested_cols if c in df_before.columns]
            else:
                affected = [
                    c for c in df_before.columns
                    if pd.api.types.is_numeric_dtype(df_before[c]) and not pd.api.types.is_bool_dtype(df_before[c])
                ]
            for col in affected:
                col_tags = [t for t in tags.get(col, []) if not t.startswith("outliers:")]
                col_tags.append(f"outliers:{action}")
                tags[col] = col_tags

    elif step_name == "missing_values":
        numerical_method = config.get("numerical_method") or "mean"
        categorical_method = config.get("categorical_method") or "mode"
        column_methods = config.get("column_methods") or {}
        requested_cols = config.get("columns")
        if requested_cols:
            affected = [c for c in requested_cols if c in df_before.columns]
        else:
            affected = [c for c in df_before.columns if df_before[c].isna().any()]
        for col in affected:
            default_m = numerical_method if pd.api.types.is_numeric_dtype(df_before[col]) else categorical_method
            m = column_methods.get(col, default_m)
            if m == "none":
                continue
            col_tags = [t for t in tags.get(col, []) if not t.startswith("missing:")]
            col_tags.append(f"missing:{m}")
            tags[col] = col_tags

    elif step_name == "drop_columns":
        for col in config.get("dropped_columns", []):
            tags.pop(col, None)

    # Remove stale entries for columns that no longer exist
    current_cols = set(df_after.columns)
    tags = {c: t for c, t in tags.items() if c in current_cols}

    await set_column_tags(project_id, tags)


@router.post("/missing-values/{project_id}", response_model=PreprocessingResponse)
async def missing_values(
    project_id: str,
    body: MissingValuesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fills or drops missing values using the specified strategy."""
    df = await _load_df_or_404(project_id, current_user, db)

    if body.columns is not None and len(body.columns) == 0:
        raise HTTPException(status_code=400, detail="Columns array cannot be empty")

    numerical_method = body.numerical_method or body.method or "mean"
    categorical_method = body.categorical_method or "mode"

    try:
        df_new = handle_missing_values(df, numerical_method, categorical_method, body.columns, body.column_methods)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await set_dataframe(project_id, df_new)
    await _update_column_tags(project_id, "missing_values", body.model_dump(), df, df_new)
    await _save_pipeline_state(project_id, "missing_values", body.model_dump(), df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.post("/detect-outliers/{project_id}")
async def detect_outliers(
    project_id: str,
    body: OutliersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Detects outliers and returns counts per column without modifying the data."""
    df = await _load_df_or_404(project_id, current_user, db)

    if body.columns is not None and len(body.columns) == 0:
        raise HTTPException(status_code=400, detail="Columns array cannot be empty")

    factor = body.factor if body.factor is not None else (1.5 if body.method == "iqr" else 3.0)

    if body.columns:
        invalid = [c for c in body.columns if c not in df.columns]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid columns: {', '.join(invalid)}")
        target_cols = [c for c in body.columns if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]
    else:
        target_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]

    outlier_results: dict = {}
    for col in target_cols:
        df_col = df[col].dropna()
        if df_col.empty:
            outlier_results[col] = {"count": 0, "values": [], "method": body.method}
            continue

        if body.method == "iqr":
            q1, q3 = df_col.quantile(0.25), df_col.quantile(0.75)
            iqr = q3 - q1
            mask = (df[col] < q1 - factor * iqr) | (df[col] > q3 + factor * iqr)
        elif body.method == "zscore":
            mean_val, std_val = df_col.mean(), df_col.std()
            mask = (((df[col] - mean_val) / std_val).abs() > factor) if std_val > 0 else pd.Series([False] * len(df))
        else:
            continue

        outlier_results[col] = {
            "count": int(mask.sum()),
            "values": df.loc[mask, col].dropna().astype(float).tolist()[:100],
            "method": body.method,
        }

    return {"outlier_results": outlier_results}


@router.post("/outliers/{project_id}", response_model=PreprocessingResponse)
async def outliers(
    project_id: str,
    body: OutliersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Clips or removes outliers and updates the cached DataFrame."""
    df = await _load_df_or_404(project_id, current_user, db)

    if body.columns is not None and len(body.columns) == 0:
        raise HTTPException(status_code=400, detail="Columns array cannot be empty")

    try:
        factor = body.factor if body.factor is not None else (1.5 if body.method == "iqr" else 3.0)
        df_new = handle_outliers(df, body.method, body.columns, body.action, factor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await set_dataframe(project_id, df_new)
    await _update_column_tags(project_id, "outliers", body.model_dump(), df, df_new)
    await _save_pipeline_state(project_id, "outliers", body.model_dump(), df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.post("/encoding/{project_id}", response_model=PreprocessingResponse)
async def encoding(
    project_id: str,
    body: EncodingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Encodes categorical columns using the specified method."""
    df = await _load_df_or_404(project_id, current_user, db)

    if body.columns is not None and len(body.columns) == 0:
        raise HTTPException(status_code=400, detail="Columns array cannot be empty")

    try:
        df_new = encode_columns(df, body.method, body.columns, body.column_methods)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await set_dataframe(project_id, df_new)
    await _update_column_tags(project_id, "encoding", body.model_dump(), df, df_new)
    await _save_pipeline_state(project_id, "encoding", body.model_dump(), df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.post("/scaling/{project_id}", response_model=PreprocessingResponse)
async def scaling(
    project_id: str,
    body: ScalingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Scales numeric columns using the specified scaler."""
    df = await _load_df_or_404(project_id, current_user, db)

    if body.columns is not None and len(body.columns) == 0:
        raise HTTPException(status_code=400, detail="Columns array cannot be empty")

    try:
        df_new = scale_columns(df, body.method, body.columns, body.column_methods)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await set_dataframe(project_id, df_new)
    await _update_column_tags(project_id, "scaling", body.model_dump(), df, df_new)
    await _save_pipeline_state(project_id, "scaling", body.model_dump(), df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.post("/drop-columns/{project_id}", response_model=PreprocessingResponse)
async def drop_columns(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Drops the specified columns from the cached DataFrame."""
    columns: list[str] = body.get("columns", [])
    if not columns:
        raise HTTPException(status_code=400, detail="No columns specified")

    df = await _load_df_or_404(project_id, current_user, db)

    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Columns not found: {', '.join(missing)}")

    df_new = df.drop(columns=columns)
    await set_dataframe(project_id, df_new)
    await _update_column_tags(project_id, "drop_columns", {"dropped_columns": columns}, df, df_new)
    await _save_pipeline_state(project_id, "correlation", {"dropped_columns": columns}, df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.get("/correlation/{project_id}", response_model=CorrelationResponse)
async def correlation(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Computes the Pearson correlation matrix for all numeric columns."""
    df = await _load_df_or_404(project_id, current_user, db)

    cached = await get_correlation_cache(project_id)
    if cached is not None:
        return cached

    matrix, cols = compute_correlation(df)
    payload = {"correlation_matrix": matrix, "columns": cols}
    await set_correlation_cache(project_id, payload)
    return payload


@router.get("/column-tags/{project_id}", response_model=ColumnTagsResponse)
async def column_tags(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns the transformation tags applied to each column in the current pipeline state."""
    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    tags = await get_column_tags(project_id)
    return {"tags": tags}
