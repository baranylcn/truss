import math
import numpy as np
import pandas as pd
import pytest
from app.services.ml_pipeline import (
    handle_missing_values,
    handle_outliers,
    analyze_dataframe,
)


@pytest.fixture
def simple_df():
    return pd.DataFrame({
        "age": [25.0, None, 30.0, None, 35.0],
        "city": ["A", None, "B", "A", None],
        "score": [10.0, 20.0, None, 40.0, 50.0],
    })


class TestHandleMissingValues:
    def test_mean_imputation(self, simple_df):
        result = handle_missing_values(simple_df, "mean", "mode", None, None)
        assert result["age"].isna().sum() == 0
        assert math.isclose(result["age"].iloc[1], 30.0)

    def test_median_imputation(self, simple_df):
        result = handle_missing_values(simple_df, "median", "mode", None, None)
        assert result["age"].isna().sum() == 0

    def test_mode_imputation_categorical(self, simple_df):
        result = handle_missing_values(simple_df, "mean", "mode", None, None)
        assert result["city"].isna().sum() == 0
        assert result["city"].iloc[1] == "A"

    def test_drop_rows_with_missing(self, simple_df):
        result = handle_missing_values(simple_df, "drop", "drop", None, None)
        assert result.isna().sum().sum() == 0
        assert len(result) < len(simple_df)

    def test_none_method_leaves_nulls(self, simple_df):
        original_nulls = simple_df["age"].isna().sum()
        result = handle_missing_values(simple_df, "none", "none", None, None)
        assert result["age"].isna().sum() == original_nulls

    def test_column_subset_only_affects_target(self, simple_df):
        result = handle_missing_values(simple_df, "mean", "mode", ["age"], None)
        assert result["age"].isna().sum() == 0
        assert result["city"].isna().sum() == simple_df["city"].isna().sum()

    def test_per_column_method_override(self, simple_df):
        result = handle_missing_values(
            simple_df, "mean", "mode", None, {"age": "median", "city": "mode"}
        )
        assert result["age"].isna().sum() == 0
        assert result["city"].isna().sum() == 0

    def test_no_nulls_returns_unchanged(self):
        df = pd.DataFrame({"x": [1.0, 2.0, 3.0]})
        result = handle_missing_values(df, "mean", "mode", None, None)
        pd.testing.assert_frame_equal(result, df)


class TestHandleOutliers:
    @pytest.fixture
    def outlier_df(self):
        base = list(range(1, 21))
        return pd.DataFrame({"val": base + [1000, -1000]})

    def test_iqr_clip_reduces_range(self, outlier_df):
        result = handle_outliers(outlier_df, "iqr", None, action="clip")
        assert result["val"].max() < 1000
        assert result["val"].min() > -1000

    def test_iqr_drop_removes_rows(self, outlier_df):
        result = handle_outliers(outlier_df, "iqr", None, action="drop")
        assert len(result) < len(outlier_df)
        assert 1000 not in result["val"].values

    def test_zscore_clip_reduces_range(self, outlier_df):
        result = handle_outliers(outlier_df, "zscore", None, action="clip", factor=3.0)
        assert result["val"].max() < 1000

    def test_zscore_drop_removes_outliers(self, outlier_df):
        result = handle_outliers(outlier_df, "zscore", None, action="drop", factor=3.0)
        assert 1000 not in result["val"].values

    def test_action_none_returns_unchanged(self, outlier_df):
        result = handle_outliers(outlier_df, "iqr", None, action="none")
        pd.testing.assert_frame_equal(result, outlier_df)

    def test_column_subset(self, outlier_df):
        df = outlier_df.copy()
        df["other"] = [999] * len(df)
        result = handle_outliers(df, "iqr", ["val"], action="clip")
        assert result["other"].max() == 999

    def test_constant_std_column_is_skipped(self):
        df = pd.DataFrame({"flat": [5.0] * 10, "normal": list(range(10))})
        result = handle_outliers(df, "zscore", None, action="clip")
        pd.testing.assert_series_equal(result["flat"], df["flat"])


class TestAnalyzeDataframe:
    def test_numeric_column_fields(self):
        df = pd.DataFrame({"x": [1.0, 2.0, 3.0, 4.0, 5.0]})
        result = analyze_dataframe(df)
        assert len(result) == 1
        col = result[0]
        assert col["type"] == "numeric"
        assert col["count"] == 5
        assert "mean" in col
        assert "quartiles" in col

    def test_categorical_column_fields(self):
        df = pd.DataFrame({"cat": ["a", "b", "a", "c", "a"]})
        result = analyze_dataframe(df)
        col = result[0]
        assert col["type"] == "categorical"
        assert col["most_frequent"] == "a"
        assert col["unique_values"] == 3

    def test_all_null_column(self):
        df = pd.DataFrame({"empty": [None, None, None]})
        result = analyze_dataframe(df)
        assert result[0]["warning"] == "all_null"

    def test_multiple_columns(self):
        df = pd.DataFrame({"n": [1.0, 2.0], "s": ["x", "y"]})
        result = analyze_dataframe(df)
        assert len(result) == 2
        types = {r["column"]: r["type"] for r in result}
        assert types["n"] == "numeric"
        assert types["s"] == "categorical"
