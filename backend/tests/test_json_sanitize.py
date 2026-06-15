import math
from app.utils.json_sanitize import sanitize_for_json


def test_nan_becomes_none():
    assert sanitize_for_json(float("nan")) is None


def test_inf_becomes_none():
    assert sanitize_for_json(float("inf")) is None
    assert sanitize_for_json(float("-inf")) is None


def test_normal_float_unchanged():
    assert sanitize_for_json(3.14) == 3.14


def test_none_unchanged():
    assert sanitize_for_json(None) is None


def test_string_unchanged():
    assert sanitize_for_json("hello") == "hello"


def test_int_unchanged():
    assert sanitize_for_json(42) == 42


def test_nested_dict():
    result = sanitize_for_json({"a": float("nan"), "b": 1.0})
    assert result == {"a": None, "b": 1.0}


def test_nested_list():
    result = sanitize_for_json([float("inf"), 2, "x"])
    assert result == [None, 2, "x"]


def test_deeply_nested():
    result = sanitize_for_json({"rows": [{"v": float("nan")}, {"v": 5.0}]})
    assert result == {"rows": [{"v": None}, {"v": 5.0}]}
