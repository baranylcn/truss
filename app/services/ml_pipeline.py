from __future__ import annotations

import random
from itertools import product
from typing import Dict, List, Any, Tuple
import numpy as np
import pandas as pd
import logging
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
  accuracy_score,
  precision_score,
  recall_score,
  f1_score,
  r2_score,
  root_mean_squared_error,
  mean_absolute_error,
  confusion_matrix,
)
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from xgboost import XGBClassifier, XGBRegressor
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)


def df_to_payload(df: pd.DataFrame, project_id: str) -> Dict[str, Any]:
  """Builds the standard API response payload from a DataFrame."""
  columns = list(df.columns)
  data = df.values.tolist()
  shape = (len(df), len(columns))
  missing_values = {col: int(df[col].isna().sum()) for col in columns}
  categorical_columns = [col for col in columns if not pd.api.types.is_numeric_dtype(df[col])]

  return {
    "project_id": project_id,
    "data": data,
    "columns": columns,
    "shape": shape,
    "missing_values": missing_values,
    "categorical_columns": categorical_columns,
  }


def analyze_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
  analysis: List[Dict[str, Any]] = []
  for col in df.columns:
    series = df[col]
    non_null = series.dropna()
    if non_null.empty:
      analysis.append({
        "column": col,
        "type": "unknown",
        "count": 0,
        "warning": "all_null",
      })
      continue

    if pd.api.types.is_numeric_dtype(non_null):
      sorted_vals = np.sort(non_null.values.astype(float))
      mean = float(sorted_vals.mean())
      std = float(sorted_vals.std())
      min_v = float(sorted_vals[0])
      max_v = float(sorted_vals[-1])
      q1 = float(np.quantile(sorted_vals, 0.25))
      q2 = float(np.quantile(sorted_vals, 0.5))
      q3 = float(np.quantile(sorted_vals, 0.75))
      analysis.append(
        {
          "column": col,
          "type": "numeric",
          "count": int(len(sorted_vals)),
          "mean": mean,
          "std": std,
          "min": min_v,
          "max": max_v,
          "quartiles": [q1, q2, q3],
        }
      )
    else:
      counts = non_null.value_counts()
      most_freq = counts.index[0]
      freq = int(counts.iloc[0])
      analysis.append(
        {
          "column": col,
          "type": "categorical",
          "count": int(len(non_null)),
          "unique_values": int(counts.shape[0]),
          "most_frequent": most_freq,
          "frequency": freq,
        }
      )
  return analysis


def handle_missing_values(
  df: pd.DataFrame,
  numerical_method: str,
  categorical_method: str,
  columns: List[str] | None,
  column_methods: Dict[str, str] | None = None,
) -> pd.DataFrame:
  if columns is None:
    target_cols = [col for col in df.columns if df[col].isna().any()]
  else:
    target_cols = columns if columns else []

  if not target_cols:
    return df

  df_new = df.copy()
  drop_subset: List[str] = []

  for col in target_cols:
    if column_methods and col in column_methods:
      method = column_methods[col]
    elif pd.api.types.is_numeric_dtype(df_new[col]):
      method = numerical_method
    else:
      method = categorical_method

    if method == "none":
      continue
    elif method == "drop":
      drop_subset.append(col)
    elif method == "mean":
      if pd.api.types.is_numeric_dtype(df_new[col]):
        df_new[col] = df_new[col].fillna(df_new[col].mean())
    elif method == "median":
      if pd.api.types.is_numeric_dtype(df_new[col]):
        df_new[col] = df_new[col].fillna(df_new[col].median())
    elif method == "mode":
      mode_series = df_new[col].mode()
      if not mode_series.empty:
        df_new[col] = df_new[col].fillna(mode_series.iloc[0])
    elif method == "ffill":
      df_new[col] = df_new[col].ffill()
    elif method == "bfill":
      df_new[col] = df_new[col].bfill()
    elif method.startswith("constant:"):
      constant_val = method.split(":", 1)[1]
      if pd.api.types.is_numeric_dtype(df_new[col]):
        try:
          df_new[col] = df_new[col].fillna(float(constant_val))
        except ValueError:
          df_new[col] = df_new[col].fillna(constant_val)
      else:
        df_new[col] = df_new[col].fillna(constant_val)

  if drop_subset:
    df_new = df_new.dropna(subset=drop_subset)

  return df_new


def handle_outliers(
  df: pd.DataFrame,
  method: str,
  columns: List[str] | None,
  action: str = "clip",
  factor: float = 1.5,
) -> pd.DataFrame:
  if action == "none":
    return df

  if columns is None:
    target_cols = [
      c for c in df.columns
      if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])
    ]
  else:
    target_cols = columns if columns else []

  df_new = df.copy()

  if not target_cols:
    return df_new

  if method == "iqr":
    drop_mask = pd.Series(False, index=df_new.index)
    for col in target_cols:
      if not pd.api.types.is_numeric_dtype(df_new[col]) or pd.api.types.is_bool_dtype(df_new[col]):
        continue
      q1 = df_new[col].quantile(0.25)
      q3 = df_new[col].quantile(0.75)
      iqr = q3 - q1
      lower = q1 - factor * iqr
      upper = q3 + factor * iqr
      if action == "clip":
        df_new[col] = df_new[col].clip(lower, upper)
      elif action == "drop":
        col_mask = (df_new[col] < lower) | (df_new[col] > upper)
        drop_mask = drop_mask | col_mask.fillna(False)
    if action == "drop":
      df_new = df_new[~drop_mask]

  elif method == "zscore":
    drop_mask = pd.Series(False, index=df_new.index)
    for col in target_cols:
      if not pd.api.types.is_numeric_dtype(df_new[col]) or pd.api.types.is_bool_dtype(df_new[col]):
        continue
      mean_val = df_new[col].mean()
      std_val = df_new[col].std()
      if std_val == 0:
        continue
      z = (df_new[col] - mean_val) / std_val
      if action == "clip":
        df_new[col] = df_new[col].clip(mean_val - factor * std_val, mean_val + factor * std_val)
      elif action == "drop":
        drop_mask = drop_mask | (z.abs() > factor).fillna(False)
    if action == "drop":
      df_new = df_new[~drop_mask]

  return df_new


def encode_columns(
  df: pd.DataFrame,
  method: str,
  columns: List[str] | None,
  column_methods: Dict[str, str] | None = None,
) -> pd.DataFrame:
  df_new = df.copy()

  if columns is None:
    target_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
  else:
    target_cols = [
      c for c in columns
      if c in df.columns and not pd.api.types.is_numeric_dtype(df[c])
    ]

  if not target_cols:
    return df_new

  onehot_cols: List[str] = []
  label_cols: List[str] = []
  ordinal_cols: List[str] = []

  for col in target_cols:
    col_method = (column_methods or {}).get(col, method)
    if col_method == "onehot":
      onehot_cols.append(col)
    elif col_method == "ordinal":
      ordinal_cols.append(col)
    else:
      label_cols.append(col)

  for col in label_cols:
    df_new[col] = df_new[col].astype("category").cat.codes

  for col in ordinal_cols:
    # Ordinal: sort unique values alphabetically to establish a consistent order,
    # then assign integer codes 0..N-1. Users can rely on lexicographic ordering;
    # for a meaningful order they should pre-sort the categories before this step.
    categories = sorted(df_new[col].dropna().unique().tolist(), key=str)
    cat_dtype = pd.CategoricalDtype(categories=categories, ordered=True)
    df_new[col] = df_new[col].astype(cat_dtype).cat.codes

  if onehot_cols:
    df_new = pd.get_dummies(df_new, columns=onehot_cols, drop_first=False)
    # pd.get_dummies creates bool dtype in pandas 2.x; cast to int8 for sklearn compatibility
    bool_cols = [c for c in df_new.columns if df_new[c].dtype == bool]
    if bool_cols:
      df_new[bool_cols] = df_new[bool_cols].astype(np.int8)

  return df_new


def scale_columns(
  df: pd.DataFrame,
  method: str,
  columns: List[str] | None,
  column_methods: Dict[str, str] | None = None,
) -> pd.DataFrame:
  df_new = df.copy()

  if columns is None:
    target_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
  else:
    target_cols = columns if columns else []

  if not target_cols:
    return df_new

  scaler_map = {
    "standard": StandardScaler,
    "minmax": MinMaxScaler,
    "robust": RobustScaler,
  }

  valid_methods = set(scaler_map.keys())
  groups: Dict[str, List[str]] = {"standard": [], "minmax": [], "robust": []}
  for col in target_cols:
    col_method = (column_methods or {}).get(col, method)
    if col_method not in valid_methods:
      col_method = method if method in valid_methods else "standard"
    groups[col_method].append(col)

  for scaler_type, cols in groups.items():
    if cols:
      df_new[cols] = scaler_map[scaler_type]().fit_transform(df_new[cols])

  return df_new


def compute_correlation(
  df: pd.DataFrame,
  method: str = "pearson",
) -> Tuple[Dict[str, Dict[str, float]], List[str]]:
  numeric_df = df.select_dtypes(include=[np.number])
  if numeric_df.empty:
    return {}, []
  valid_methods = {"pearson", "spearman", "kendall"}
  corr = numeric_df.corr(method=method if method in valid_methods else "pearson")
  matrix: Dict[str, Dict[str, float]] = {}
  for col1 in corr.columns:
    matrix[col1] = {}
    for col2 in corr.columns:
      val = corr.loc[col1, col2]
      matrix[col1][col2] = float(val) if not pd.isna(val) else 0.0
  return matrix, list(corr.columns)


def _default_param_ranges(model_type: str) -> Dict[str, List[float]]:
  """Default [min, max] search ranges for numeric params per model type."""
  if model_type == "xgboost":
    return {
      "max_depth": [3, 10],
      "learning_rate": [0.01, 0.3],
      "n_estimators": [50, 500],
      "subsample": [0.6, 1.0],
      "colsample_bytree": [0.6, 1.0],
    }
  if model_type == "random_forest":
    return {
      "n_estimators": [50, 300],
      "max_depth": [5, 25],
      "min_samples_split": [2, 10],
      "min_samples_leaf": [1, 4],
    }
  if model_type == "logistic_regression":
    return {"C": [0.01, 10.0], "max_iter": [100, 2000]}
  return {}


def _default_param_choices(model_type: str) -> Dict[str, List[str]]:
  """Default categorical option lists per model type."""
  if model_type == "random_forest":
    return {"max_features": ["sqrt", "log2"]}
  if model_type == "logistic_regression":
    return {
      "penalty": ["l1", "l2"],
      "solver": ["lbfgs", "liblinear", "saga"],
    }
  return {}


_PARAM_TYPES: Dict[str, Dict[str, str]] = {
  "xgboost": {
    "max_depth": "int", "learning_rate": "float",
    "n_estimators": "int", "subsample": "float", "colsample_bytree": "float",
  },
  "random_forest": {
    "n_estimators": "int", "max_depth": "int",
    "min_samples_split": "int", "min_samples_leaf": "int",
    "max_features": "categorical",
  },
  "logistic_regression": {
    "C": "float", "max_iter": "int",
    "penalty": "categorical", "solver": "categorical",
  },
}


def _primary_metric(metrics: Dict[str, Any]) -> float:
  return float(metrics.get("accuracy") or metrics.get("r2") or 0.0)


def _make_candidates(
  param_ranges: Dict[str, List[float]],
  param_choices: Dict[str, List[str]],
  param_types: Dict[str, str],
  strategy: str,
  n: int,
) -> List[Dict[str, Any]]:
  """Generates n candidate hyperparameter dicts from numeric ranges and categorical choices."""
  if strategy == "grid":
    n_dims = len(param_ranges) + len(param_choices)
    pts = max(2, int(round(n ** (1 / n_dims)))) if n_dims else 2
    grid: Dict[str, List[Any]] = {}
    for key, (mn, mx) in param_ranges.items():
      if param_types.get(key) == "int":
        step = max(1, (int(mx) - int(mn)) // (pts - 1))
        grid[key] = list(range(int(mn), int(mx) + 1, step))
      else:
        grid[key] = [round(mn + i * (mx - mn) / (pts - 1), 6) for i in range(pts)]
    for key, choices in param_choices.items():
      grid[key] = choices
    combos = list(product(*grid.values()))
    random.shuffle(combos)
    return [dict(zip(grid.keys(), c)) for c in combos[:n]]
  else:
    # Random / Bayesian: uniform sampling within ranges + random choice for categoricals
    candidates = []
    for _ in range(n):
      params: Dict[str, Any] = {}
      for key, (mn, mx) in param_ranges.items():
        if param_types.get(key) == "int":
          params[key] = random.randint(int(mn), int(mx))
        else:
          params[key] = round(random.uniform(mn, mx), 6)
      for key, choices in param_choices.items():
        params[key] = random.choice(choices)
      candidates.append(params)
    return candidates


def optimize_hyperparams(
  df: pd.DataFrame,
  model_type: str,
  target_column: str,
  test_size: float,
  strategy: str,
  n_trials: int,
  param_ranges: Dict[str, List[float]] | None = None,
  param_choices: Dict[str, List[str]] | None = None,
  task_type_override: str | None = None,
) -> Dict[str, Any]:
  """Searches for optimal hyperparameters; returns best_params, best_score, trials_run."""
  effective_ranges = {**_default_param_ranges(model_type), **(param_ranges or {})}
  effective_choices = {
    **_default_param_choices(model_type),
    **{k: v for k, v in (param_choices or {}).items() if v},
  }

  if not effective_ranges and not effective_choices:
    _, _, metrics = train_model(df, model_type, target_column, test_size, {}, task_type_override)
    return {"best_params": {}, "best_score": _primary_metric(metrics), "trials_run": 1}

  param_types = _PARAM_TYPES.get(model_type, {})
  candidates = _make_candidates(effective_ranges, effective_choices, param_types, strategy, n_trials)

  best_score = -float("inf")
  best_params: Dict[str, Any] = candidates[0]
  trials_run = 0

  for params in candidates:
    try:
      _, _, metrics = train_model(df, model_type, target_column, test_size, params, task_type_override)
      score = _primary_metric(metrics)
      trials_run += 1
      if score > best_score:
        best_score = score
        best_params = params
    except Exception as trial_exc:
      logger.debug(f"Trial skipped for {model_type} with params {params}: {trial_exc}")
      continue

  return {"best_params": best_params, "best_score": best_score, "trials_run": trials_run}


def _get_hp(hp: dict, key: str, default: Any) -> Any:
  val = hp.get(key, default)
  if val == "" or val is None:
    return default
  return val


def train_model(
  df: pd.DataFrame,
  model_type: str,
  target_column: str,
  test_size: float,
  hyperparameters: dict | None = None,
  task_type_override: str | None = None,
) -> Tuple[Any, str, Dict[str, Any]]:
  """Trains a model and returns (pipeline, task_type, metrics)."""
  if target_column not in df.columns:
    raise ValueError(f"Target column '{target_column}' not found in DataFrame")

  logger.info(f"Training {model_type} | target='{target_column}' | columns={list(df.columns)}")

  # Drop rows where target or any feature is NaN
  df_clean = df.dropna(subset=[target_column])
  X = df_clean.drop(columns=[target_column])
  # Drop feature rows with NaN; warn but don't crash
  rows_before = len(X)
  X = X.dropna()
  y = df_clean[target_column].loc[X.index]
  if len(X) < rows_before:
    logger.warning(f"Dropped {rows_before - len(X)} rows with NaN in features before training")

  if len(X) < 10:
    raise ValueError(f"Not enough clean rows to train ({len(X)} rows after NaN removal)")

  # Ensure bool columns (from one-hot encoding) are int to avoid sklearn dtype issues
  bool_cols = [c for c in X.columns if X[c].dtype == bool]
  if bool_cols:
    X = X.copy()
    X[bool_cols] = X[bool_cols].astype(np.int8)

  cat_cols = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]
  num_cols = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]

  preprocessor = ColumnTransformer(
    transformers=[
      ("num", "passthrough", num_cols),
      ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ],
    remainder="drop",
  )

  # Certain models force a specific task type regardless of user override
  if model_type == "logistic_regression":
    task_type = "classification"
  elif model_type == "linear_regression":
    task_type = "regression"
  elif task_type_override in ("classification", "regression"):
    task_type = task_type_override
  else:
    task_type = "regression" if pd.api.types.is_numeric_dtype(y) else "classification"

  # If classification, re-encode target to clean integer class labels 0, 1, 2, ...
  # This handles scaled targets (e.g. 0/1 → -0.74/1.35 after StandardScaler).
  # We keep the original class labels for display purposes.
  label_encoder: LabelEncoder | None = None
  if task_type == "classification":
    label_encoder = LabelEncoder()
    original_classes = [str(c) for c in sorted(y.unique())]
    y = pd.Series(label_encoder.fit_transform(y), index=y.index, name=y.name)
  else:
    original_classes = []

  hp = hyperparameters or {}

  if model_type == "linear_regression" and task_type == "regression":
    base_model = LinearRegression()

  elif model_type == "logistic_regression":
    penalty = _get_hp(hp, "penalty", "l2")
    solver = _get_hp(hp, "solver", "lbfgs")
    # Enforce penalty/solver compatibility
    if penalty == "l1" and solver not in ("liblinear", "saga"):
      solver = "liblinear"
    elif penalty == "elasticnet" and solver != "saga":
      solver = "saga"
    elif penalty == "none" and solver == "liblinear":
      solver = "lbfgs"
    l1_ratio = float(_get_hp(hp, "l1_ratio", 0.5)) if penalty == "elasticnet" else None
    raw_cw = _get_hp(hp, "class_weight", None)
    class_weight = raw_cw if raw_cw in ("balanced", None) else None
    base_model = LogisticRegression(
      C=float(_get_hp(hp, "C", 1.0)),
      penalty=penalty,
      solver=solver,
      max_iter=int(_get_hp(hp, "max_iter", 1000)),
      class_weight=class_weight,
      fit_intercept=bool(_get_hp(hp, "fit_intercept", True)),
      tol=float(_get_hp(hp, "tol", 1e-4)),
      l1_ratio=l1_ratio,
    )

  elif model_type == "random_forest":
    rf_bootstrap = bool(_get_hp(hp, "bootstrap", True))
    rf_oob = bool(_get_hp(hp, "oob_score", False)) and rf_bootstrap  # oob_score requires bootstrap=True
    base_model = (RandomForestClassifier if task_type == "classification" else RandomForestRegressor)(
      n_estimators=int(_get_hp(hp, "n_estimators", 100)),
      max_depth=int(_get_hp(hp, "max_depth", 10)) if _get_hp(hp, "max_depth", None) else None,
      max_features=_get_hp(hp, "max_features", "sqrt"),
      min_samples_split=int(_get_hp(hp, "min_samples_split", 2)),
      min_samples_leaf=int(_get_hp(hp, "min_samples_leaf", 1)),
      bootstrap=rf_bootstrap,
      criterion=_get_hp(hp, "criterion", "gini" if task_type == "classification" else "squared_error"),
      oob_score=rf_oob,
      random_state=42,
    )

  elif model_type == "xgboost":
    base_model = (XGBClassifier if task_type == "classification" else XGBRegressor)(
      n_estimators=int(_get_hp(hp, "n_estimators", 100)),
      max_depth=int(_get_hp(hp, "max_depth", 6)),
      learning_rate=float(_get_hp(hp, "learning_rate", 0.1)),
      subsample=float(_get_hp(hp, "subsample", 0.8)),
      colsample_bytree=float(_get_hp(hp, "colsample_bytree", 1.0)),
      min_child_weight=float(_get_hp(hp, "min_child_weight", 1)),
      gamma=float(_get_hp(hp, "gamma", 0.0)),
      reg_alpha=float(_get_hp(hp, "reg_alpha", 0.0)),
      reg_lambda=float(_get_hp(hp, "reg_lambda", 1.0)),
      scale_pos_weight=float(_get_hp(hp, "scale_pos_weight", 1.0)),
      eval_metric="logloss" if task_type == "classification" else "rmse",
      random_state=42,
      verbosity=0,
    )

  else:
    base_model = RandomForestClassifier(random_state=42) if task_type == "classification" else RandomForestRegressor(random_state=42)

  pipe = Pipeline(steps=[("preprocess", preprocessor), ("model", base_model)])

  stratify = y if task_type == "classification" else None
  try:
    X_train, X_test, y_train, y_test = train_test_split(
      X, y, test_size=test_size, random_state=42, stratify=stratify
    )
  except ValueError:
    # Fallback: skip stratification when minority class is too small
    X_train, X_test, y_train, y_test = train_test_split(
      X, y, test_size=test_size, random_state=42
    )

  pipe.fit(X_train, y_train)
  y_pred = pipe.predict(X_test)

  metrics: Dict[str, Any] = {}
  if task_type == "classification":
    metrics["accuracy"] = float(accuracy_score(y_test, y_pred))
    metrics["precision"] = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    metrics["recall"] = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
    metrics["f1_score"] = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    cm = confusion_matrix(y_test, y_pred)
    metrics["confusion_matrix"] = cm.tolist()
    metrics["class_names"] = original_classes  # original labels before LabelEncoder
  else:
    metrics["r2"] = float(r2_score(y_test, y_pred))
    metrics["rmse"] = float(root_mean_squared_error(y_test, y_pred))
    metrics["mae"] = float(mean_absolute_error(y_test, y_pred))
    metrics["accuracy"] = metrics["r2"]
    metrics["f1_score"] = 0.0

  # Feature importance (tree-based and linear models)
  try:
    model_step = pipe.named_steps["model"]
    inner_preprocessor = pipe.named_steps["preprocess"]
    try:
      feat_names = list(inner_preprocessor.get_feature_names_out())
      feat_names = [n.split("__", 1)[-1] for n in feat_names]
    except Exception as name_exc:
      logger.warning(f"get_feature_names_out failed, falling back to indices: {name_exc}")
      feat_names = None

    importances: np.ndarray | None = None
    if hasattr(model_step, "feature_importances_"):
      importances = model_step.feature_importances_
    elif hasattr(model_step, "coef_"):
      # Linear models: use absolute coefficient values as importance proxy
      coef = np.array(model_step.coef_)
      importances = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    if importances is not None:
      n_features = len(importances)
      if feat_names is None or len(feat_names) != n_features:
        feat_names = [f"feature_{i}" for i in range(n_features)]
      total = importances.sum()
      normalized = (importances / total) if total > 0 else importances
      items = sorted(zip(feat_names, normalized), key=lambda x: x[1], reverse=True)
      metrics["feature_importance"] = {k: float(v) for k, v in items[:15]}
  except Exception as fi_exc:
    logger.warning(f"Feature importance extraction failed: {fi_exc}")

  return pipe, task_type, metrics
