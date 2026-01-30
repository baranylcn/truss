from __future__ import annotations

from typing import Dict, List, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
  accuracy_score,
  precision_score,
  recall_score,
  f1_score,
  r2_score,
  mean_squared_error,
  mean_absolute_error,
)
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

from .session_store import session_store, SessionState


def df_to_session_payload(state: SessionState) -> Dict[str, Any]:
  df = state.df
  columns = list(df.columns)
  data = df.values.tolist()
  shape = (len(df), len(columns))
  missing_values = {col: int(df[col].isna().sum()) for col in columns}
  return {
    "session_id": state.session_id,
    "data": data,
    "columns": columns,
    "shape": shape,
    "missing_values": missing_values,
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


def handle_missing_values(df: pd.DataFrame, numerical_method: str, categorical_method: str, columns: List[str] | None) -> pd.DataFrame:
  # If columns is None, process only columns with missing values (for efficiency)
  # If columns is provided, process those specific columns
  if columns is None:
    target_cols = [col for col in df.columns if df[col].isna().any()]
  else:
    target_cols = columns if columns else []
  
  # If no columns to process, return original dataframe
  if not target_cols:
    return df
    
  if numerical_method == "drop":
    return df.dropna(subset=target_cols)

  df_new = df.copy()
  
  if numerical_method in {"mean", "median"}:
    for col in target_cols:
      if pd.api.types.is_numeric_dtype(df_new[col]):
        if numerical_method == "mean":
          fill_val = df_new[col].mean()
        else:
          fill_val = df_new[col].median()
        df_new[col] = df_new[col].fillna(fill_val)
      else:
        if categorical_method == "mode":
          mode_series = df_new[col].mode()
          if not mode_series.empty:
            df_new[col] = df_new[col].fillna(mode_series.iloc[0])
        elif categorical_method == "drop":
          df_new = df_new.dropna(subset=[col])
    return df_new

  if numerical_method == "mode":
    for col in target_cols:
      mode_series = df_new[col].mode()
      if not mode_series.empty:
        df_new[col] = df_new[col].fillna(mode_series.iloc[0])
    return df_new

  return df_new


def handle_outliers(df: pd.DataFrame, method: str, columns: List[str] | None) -> pd.DataFrame:
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
      lower = q1 - 1.5 * iqr
      upper = q3 + 1.5 * iqr
      df_new[col] = df_new[col].clip(lower, upper)

  elif method == "zscore":
    for col in target_cols:
      if not pd.api.types.is_numeric_dtype(df_new[col]) or pd.api.types.is_bool_dtype(df_new[col]):
        continue
      mean = df_new[col].mean()
      std = df_new[col].std()
      if std == 0:
        continue
      z = (df_new[col] - mean) / std
      df_new = df_new[(z.abs() <= 3) | z.isna()]

  return df_new


def encode_columns(df: pd.DataFrame, method: str, columns: List[str] | None) -> pd.DataFrame:
  df_new = df.copy()
  
  if columns is None:
    target_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
  else:
    target_cols = columns if columns else []
  
  if not target_cols:
    return df_new
  
  if method in {"label", "ordinal"}:
    for col in target_cols:
      df_new[col] = df_new[col].astype("category").cat.codes
    return df_new
  if method == "onehot":
    return pd.get_dummies(df_new, columns=target_cols, drop_first=False)
  return df_new


def scale_columns(df: pd.DataFrame, method: str, columns: List[str] | None) -> pd.DataFrame:
  df_new = df.copy()
  if columns is None:
    target_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
  else:
    target_cols = columns if columns else []
  
  if not target_cols:
    return df_new

  if method == "standard":
    scaler = StandardScaler()
  elif method == "minmax":
    scaler = MinMaxScaler()
  elif method == "robust":
    scaler = RobustScaler()
  else:
    return df_new

  df_new[target_cols] = scaler.fit_transform(df_new[target_cols])
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


def train_model_for_current_session(
  model_type: str,
  target_column: str,
  test_size: float,
) -> Tuple[SessionState, Dict[str, float]]:
  state = session_store.get_current()
  
  if target_column not in state.df.columns:
    raise ValueError(f"Target column '{target_column}' not found in DataFrame")
  
  df = state.df.dropna(subset=[target_column])
  X = df.drop(columns=[target_column])
  y = df[target_column]

  cat_cols = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]
  num_cols = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]

  preprocessor = ColumnTransformer(
    transformers=[
      ("num", "passthrough", num_cols),
      ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ],
    remainder="drop",
  )

  if pd.api.types.is_numeric_dtype(y):
    task_type = "regression"
  else:
    task_type = "classification"

  if model_type == "linear_regression" and task_type == "regression":
    model = LinearRegression()
  elif model_type == "logistic_regression" and task_type == "classification":
    model = LogisticRegression(max_iter=1000)
  elif model_type == "random_forest":
    model = RandomForestClassifier() if task_type == "classification" else RandomForestRegressor()
  else:
    model = RandomForestClassifier() if task_type == "classification" else RandomForestRegressor()

  pipe = Pipeline(steps=[("preprocess", preprocessor), ("model", model)])

  stratify = y if task_type == "classification" else None
  X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=test_size, random_state=42, stratify=stratify
  )

  pipe.fit(X_train, y_train)
  y_pred = pipe.predict(X_test)

  metrics: Dict[str, float] = {}
  if task_type == "classification":
    metrics["accuracy"] = float(accuracy_score(y_test, y_pred))
    metrics["precision"] = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    metrics["recall"] = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
    metrics["f1_score"] = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
  else:
    metrics["accuracy"] = float(r2_score(y_test, y_pred))
    metrics["precision"] = float(mean_squared_error(y_test, y_pred, squared=False))
    metrics["recall"] = float(mean_absolute_error(y_test, y_pred))
    metrics["f1_score"] = 0.0

  state.model = pipe
  state.task_type = task_type
  state.metrics = metrics

  return state, metrics
