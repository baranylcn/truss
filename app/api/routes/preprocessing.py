import asyncio
import logging
import uuid
from functools import partial

import numpy as np
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
from app.core.storage import get_or_restore_dataframe
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
from app.utils.uuid_helpers import parse_project_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/preprocessing", tags=["preprocessing"])


async def _load_df_or_404(project_id: str, user: User, db: AsyncSession) -> pd.DataFrame:
    """Fetches the project DataFrame from Redis, verifying ownership. Raises 404 if not found."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    df = await get_or_restore_dataframe(project_id)
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
        project_id=parse_project_id(project_id),
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


@router.post("/rename-column/{project_id}", response_model=PreprocessingResponse)
async def rename_column(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Renames a single column in the cached DataFrame."""
    old_name: str = body.get("old_name", "")
    new_name: str = body.get("new_name", "").strip()
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="old_name and new_name are required")
    if old_name == new_name:
        raise HTTPException(status_code=400, detail="New name is the same as the old name")

    df = await _load_df_or_404(project_id, current_user, db)

    if old_name not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{old_name}' not found")
    if new_name in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{new_name}' already exists")

    df_new = df.rename(columns={old_name: new_name})
    await set_dataframe(project_id, df_new)

    tags = await get_column_tags(project_id)
    if old_name in tags:
        tags[new_name] = tags.pop(old_name)
        await set_column_tags(project_id, tags)

    await _save_pipeline_state(project_id, "rename_column", {"old_name": old_name, "new_name": new_name}, df_new, db)
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
    await _save_pipeline_state(project_id, "drop_columns", {"dropped_columns": columns}, df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.post("/feature-engineering/{project_id}", response_model=PreprocessingResponse)
async def feature_engineering(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Creates a new column via arithmetic, mathematical transform, or binning."""
    operation: str = body.get("operation", "")
    new_col: str = (body.get("new_col") or "").strip()

    if not new_col:
        raise HTTPException(status_code=400, detail="new_col name is required")

    df = await _load_df_or_404(project_id, current_user, db)

    if new_col in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{new_col}' already exists")

    try:
        if operation == "arithmetic":
            col_a: str = body.get("col_a", "")
            col_b: str = body.get("col_b", "")
            operator: str = body.get("operator", "+")
            if col_a not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{col_a}' not found")
            if col_b not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{col_b}' not found")
            a, b = df[col_a], df[col_b]
            if operator == "+":
                df[new_col] = a + b
            elif operator == "-":
                df[new_col] = a - b
            elif operator == "*":
                df[new_col] = a * b
            elif operator == "/":
                df[new_col] = a / b.replace(0, np.nan)
            else:
                raise HTTPException(status_code=400, detail=f"Unknown operator '{operator}'")

        elif operation == "transform":
            col: str = body.get("col", "")
            func: str = body.get("func", "")
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{col}' not found")
            s = df[col]
            if func == "log":
                df[new_col] = np.log1p(s.clip(lower=0))
            elif func == "sqrt":
                df[new_col] = np.sqrt(s.clip(lower=0))
            elif func == "square":
                df[new_col] = s ** 2
            elif func == "abs":
                df[new_col] = s.abs()
            elif func == "normalize":
                mn, mx = s.min(), s.max()
                df[new_col] = (s - mn) / (mx - mn) if mx != mn else s * 0
            else:
                raise HTTPException(status_code=400, detail=f"Unknown function '{func}'")

        elif operation == "binning":
            col = body.get("col", "")
            n_bins: int = int(body.get("n_bins", 5))
            labels_flag: bool = bool(body.get("labels", True))
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{col}' not found")
            if n_bins < 2 or n_bins > 50:
                raise HTTPException(status_code=400, detail="n_bins must be between 2 and 50")
            bin_labels = [f"bin_{i+1}" for i in range(n_bins)] if labels_flag else None
            df[new_col] = pd.cut(df[col], bins=n_bins, labels=bin_labels).astype(str)

        else:
            raise HTTPException(status_code=400, detail="operation must be 'arithmetic', 'transform', or 'binning'")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Feature engineering failed: {exc}")

    await set_dataframe(project_id, df)
    await _save_pipeline_state(project_id, "feature_engineering", body, df, db)
    return sanitize_for_json(df_to_payload(df, project_id))


@router.post("/filter-rows/{project_id}", response_model=PreprocessingResponse)
async def filter_rows(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Filters or deduplicates rows in the cached DataFrame."""
    operation: str = body.get("operation", "")
    df = await _load_df_or_404(project_id, current_user, db)

    if operation == "drop_duplicates":
        df_new = df.drop_duplicates()
    elif operation == "filter":
        column: str = body.get("column", "")
        operator: str = body.get("operator", "")
        value: str = body.get("value", "")
        if not column or not operator or value == "":
            raise HTTPException(status_code=400, detail="column, operator, and value are required for filter operation")
        if column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{column}' not found")
        try:
            col_series = df[column]
            is_numeric = pd.api.types.is_numeric_dtype(col_series)
            parsed_val: float | str = float(value) if is_numeric else value
            ops = {
                ">": col_series > parsed_val,
                ">=": col_series >= parsed_val,
                "<": col_series < parsed_val,
                "<=": col_series <= parsed_val,
                "==": col_series == parsed_val,
                "!=": col_series != parsed_val,
                "contains": col_series.astype(str).str.contains(str(value), na=False),
                "not_contains": ~col_series.astype(str).str.contains(str(value), na=False),
            }
            if operator not in ops:
                raise HTTPException(status_code=400, detail=f"Unknown operator '{operator}'")
            mask = ops[operator]
            df_new = df[mask]
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail=f"Filter error: {exc}")
    else:
        raise HTTPException(status_code=400, detail="operation must be 'filter' or 'drop_duplicates'")

    rows_removed = len(df) - len(df_new)
    if len(df_new) == 0:
        raise HTTPException(status_code=400, detail="Filter would remove all rows. Adjust your condition.")

    df_new = df_new.reset_index(drop=True)
    await set_dataframe(project_id, df_new)
    await _save_pipeline_state(project_id, "filter_rows", {**body, "rows_removed": rows_removed}, df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.get("/feature-selection/{project_id}")
async def feature_selection(
    project_id: str,
    variance_threshold: float = 0.0,
    correlation_threshold: float = 0.95,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Suggests columns to drop based on variance threshold and pairwise correlation."""
    df = await _load_df_or_404(project_id, current_user, db)
    numeric_df = df.select_dtypes(include=[np.number])

    low_variance: list[str] = []
    if variance_threshold > 0 and not numeric_df.empty:
        variances = numeric_df.var()
        low_variance = list(variances[variances <= variance_threshold].index)

    high_corr_pairs: list[dict] = []
    drop_corr: list[str] = []
    if not numeric_df.empty and len(numeric_df.columns) > 1:
        corr_matrix = numeric_df.corr().abs()
        upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
        for col in upper.columns:
            for idx in upper.index:
                val = upper.loc[idx, col]
                if pd.notna(val) and val >= correlation_threshold:
                    high_corr_pairs.append({"col_a": idx, "col_b": col, "correlation": round(float(val), 4)})
                    if col not in drop_corr:
                        drop_corr.append(col)

    return {
        "low_variance_cols": low_variance,
        "high_correlation_pairs": high_corr_pairs,
        "suggested_drop": list(set(low_variance) | set(drop_corr)),
        "variance_threshold": variance_threshold,
        "correlation_threshold": correlation_threshold,
    }


@router.get("/correlation/{project_id}", response_model=CorrelationResponse)
async def correlation(
    project_id: str,
    method: str = "pearson",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Computes the correlation matrix for all numeric columns using the specified method."""
    if method not in ("pearson", "spearman", "kendall"):
        raise HTTPException(status_code=400, detail="method must be pearson, spearman, or kendall")

    df = await _load_df_or_404(project_id, current_user, db)

    cache_key_method = method
    cached = await get_correlation_cache(project_id, cache_key_method)
    if cached is not None:
        return cached

    loop = asyncio.get_running_loop()
    matrix, cols = await loop.run_in_executor(None, partial(compute_correlation, df, method))
    payload = {"correlation_matrix": matrix, "columns": cols, "method": method}
    await set_correlation_cache(project_id, payload, cache_key_method)
    return payload


@router.post("/cast-column/{project_id}", response_model=PreprocessingResponse)
async def cast_column(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Casts a column to a different data type (numeric, string, datetime, category)."""
    column: str = body.get("column", "")
    dtype: str = body.get("dtype", "")
    if not column or not dtype:
        raise HTTPException(status_code=400, detail="column and dtype are required")

    df = await _load_df_or_404(project_id, current_user, db)

    if column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{column}' not found")

    df_new = df.copy()
    try:
        if dtype == "numeric":
            df_new[column] = pd.to_numeric(df_new[column], errors="coerce")
        elif dtype == "string":
            df_new[column] = df_new[column].astype(str)
        elif dtype == "category":
            df_new[column] = df_new[column].astype("category")
        elif dtype == "datetime":
            df_new[column] = pd.to_datetime(df_new[column], errors="coerce")
        else:
            raise HTTPException(status_code=400, detail="dtype must be 'numeric', 'string', 'category', or 'datetime'")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cast failed: {exc}")

    await set_dataframe(project_id, df_new)
    await _save_pipeline_state(project_id, "cast_column", {"column": column, "dtype": dtype}, df_new, db)
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.post("/replace-values/{project_id}", response_model=PreprocessingResponse)
async def replace_values(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Replaces all occurrences of old_value with new_value in a column (use null to replace with NaN)."""
    column: str = body.get("column", "")
    old_value = body.get("old_value")
    new_value = body.get("new_value")  # None → NaN

    if not column:
        raise HTTPException(status_code=400, detail="column is required")
    if "old_value" not in body:
        raise HTTPException(status_code=400, detail="old_value is required")

    df = await _load_df_or_404(project_id, current_user, db)
    if column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{column}' not found")

    df_new = df.copy()
    replace_with = new_value if new_value is not None else np.nan
    if pd.api.types.is_numeric_dtype(df_new[column]) and old_value is not None:
        try:
            old_value = float(old_value)
        except (ValueError, TypeError):
            pass
    df_new[column] = df_new[column].replace(old_value, replace_with)

    await set_dataframe(project_id, df_new)
    await _save_pipeline_state(
        project_id, "replace_values",
        {"column": column, "old_value": str(old_value), "new_value": str(new_value)},
        df_new, db,
    )
    return sanitize_for_json(df_to_payload(df_new, project_id))


@router.get("/pipeline-history/{project_id}")
async def pipeline_history(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns the last 50 pipeline steps applied to the project (newest first)."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    states_result = await db.execute(
        select(PipelineState)
        .where(PipelineState.project_id == parse_project_id(project_id))
        .order_by(PipelineState.created_at.desc())
        .limit(50)
    )
    states = list(states_result.scalars().all())

    return {
        "history": [
            {
                "id": str(s.id),
                "step_name": s.step_name,
                "config": s.config,
                "created_at": s.created_at.isoformat(),
            }
            for s in states
        ]
    }


@router.post("/restore/{project_id}", response_model=PreprocessingResponse)
async def restore_snapshot(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Restores the DataFrame to the state saved at a specific pipeline step."""
    state_id_str: str = body.get("state_id", "")
    if not state_id_str:
        raise HTTPException(status_code=400, detail="state_id is required")

    try:
        state_uuid = uuid.UUID(state_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid state_id format")

    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    state_result = await db.execute(
        select(PipelineState).where(
            PipelineState.id == state_uuid,
            PipelineState.project_id == parse_project_id(project_id),
        )
    )
    state = state_result.scalar_one_or_none()
    if state is None:
        raise HTTPException(status_code=404, detail="Pipeline state not found")

    snapshot = state.data_snapshot or {}
    if not snapshot.get("columns") or snapshot.get("data") is None:
        raise HTTPException(status_code=400, detail="Snapshot data is incomplete")

    df = pd.DataFrame(snapshot["data"], columns=snapshot["columns"])
    await set_dataframe(project_id, df)
    return sanitize_for_json(df_to_payload(df, project_id))


@router.get("/column-tags/{project_id}", response_model=ColumnTagsResponse)
async def column_tags(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns the transformation tags applied to each column in the current pipeline state."""
    result = await db.execute(
        select(Project).where(
            Project.id == parse_project_id(project_id),
            Project.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    tags = await get_column_tags(project_id)
    return {"tags": tags}
