from __future__ import annotations

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
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder
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
        mask = (df_new[col] < lower) | (df_new[col] > upper)
        df_new = df_new[~mask | df_new[col].isna()]

  elif method == "zscore":
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
        df_new = df_new[(z.abs() <= factor) | z.isna()]

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

  for col in target_cols:
    col_method = (column_methods or {}).get(col, method)
    if col_method == "onehot":
      onehot_cols.append(col)
    else:
      label_cols.append(col)

  for col in label_cols:
    df_new[col] = df_new[col].astype("category").cat.codes

  if onehot_cols:
    df_new = pd.get_dummies(df_new, columns=onehot_cols, drop_first=False)

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

  groups: Dict[str, List[str]] = {"standard": [], "minmax": [], "robust": []}
  for col in target_cols:
    col_method = (column_methods or {}).get(col, method)
    if col_method in groups:
      groups[col_method].append(col)

  for scaler_type, cols in groups.items():
    if cols:
      df_new[cols] = scaler_map[scaler_type]().fit_transform(df_new[cols])

  return df_new


def compute_correlation(df: pd.DataFrame) -> Tuple[Dict[str, Dict[str, float]], List[str]]:
  numeric_df = df.select_dtypes(include=[np.number])
  if numeric_df.empty:
    return {}, []
  corr = numeric_df.corr()
  matrix: Dict[str, Dict[str, float]] = {}
  for col1 in corr.columns:
    matrix[col1] = {}
    for col2 in corr.columns:
      val = corr.loc[col1, col2]
      matrix[col1][col2] = float(val) if not pd.isna(val) else 0.0
  return matrix, list(corr.columns)


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

  df_clean = df.dropna(subset=[target_column])
  X = df_clean.drop(columns=[target_column])
  y = df_clean[target_column]

  cat_cols = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]
  num_cols = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]

  preprocessor = ColumnTransformer(
    transformers=[
      ("num", "passthrough", num_cols),
      ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ],
    remainder="drop",
  )

  if task_type_override in ("classification", "regression"):
    task_type = task_type_override
  else:
    task_type = "regression" if pd.api.types.is_numeric_dtype(y) else "classification"
  hp = hyperparameters or {}

  if model_type == "linear_regression" and task_type == "regression":
    base_model = LinearRegression()

  elif model_type == "logistic_regression":
    penalty = _get_hp(hp, "penalty", "l2")
    l1_ratio = float(_get_hp(hp, "l1_ratio", 0.5)) if penalty == "elasticnet" else None
    base_model = LogisticRegression(
      C=float(_get_hp(hp, "C", 1.0)),
      penalty=penalty,
      solver=_get_hp(hp, "solver", "lbfgs"),
      max_iter=int(_get_hp(hp, "max_iter", 1000)),
      class_weight=_get_hp(hp, "class_weight", None) or None,
      fit_intercept=bool(_get_hp(hp, "fit_intercept", True)),
      tol=float(_get_hp(hp, "tol", 1e-4)),
      l1_ratio=l1_ratio,
    )

  elif model_type == "random_forest":
    base_model = (RandomForestClassifier if task_type == "classification" else RandomForestRegressor)(
      n_estimators=int(_get_hp(hp, "n_estimators", 100)),
      max_depth=int(_get_hp(hp, "max_depth", 10)) if _get_hp(hp, "max_depth", None) else None,
      max_features=_get_hp(hp, "max_features", "sqrt"),
      min_samples_split=int(_get_hp(hp, "min_samples_split", 2)),
      min_samples_leaf=int(_get_hp(hp, "min_samples_leaf", 1)),
      bootstrap=bool(_get_hp(hp, "bootstrap", True)),
      criterion=_get_hp(hp, "criterion", "gini" if task_type == "classification" else "squared_error"),
      oob_score=bool(_get_hp(hp, "oob_score", False)),
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
  X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=test_size, random_state=42, stratify=stratify
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
    metrics["class_names"] = [str(c) for c in sorted(y.unique())]
  else:
    metrics["r2"] = float(r2_score(y_test, y_pred))
    metrics["rmse"] = float(root_mean_squared_error(y_test, y_pred))
    metrics["mae"] = float(mean_absolute_error(y_test, y_pred))
    metrics["accuracy"] = metrics["r2"]
    metrics["f1_score"] = 0.0

  # Feature importance (tree-based models)
  try:
    model_step = pipe.named_steps["model"]
    preprocessor = pipe.named_steps["preprocess"]
    if hasattr(model_step, "feature_importances_"):
      try:
        feat_names = list(preprocessor.get_feature_names_out())
        feat_names = [n.split("__", 1)[-1] for n in feat_names]
      except Exception:
        feat_names = [f"feature_{i}" for i in range(len(model_step.feature_importances_))]
      items = sorted(
        zip(feat_names, model_step.feature_importances_),
        key=lambda x: x[1],
        reverse=True,
      )
      metrics["feature_importance"] = {k: float(v) for k, v in items[:15]}
  except Exception:
    pass

  return pipe, task_type, metrics
