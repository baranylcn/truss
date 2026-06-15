import uuid
import pytest
from fastapi import HTTPException
from app.utils.uuid_helpers import parse_project_id


def test_valid_uuid():
    uid = uuid.uuid4()
    assert parse_project_id(str(uid)) == uid


def test_invalid_string_raises_400():
    with pytest.raises(HTTPException) as exc_info:
        parse_project_id("not-a-uuid")
    assert exc_info.value.status_code == 400


def test_empty_string_raises_400():
    with pytest.raises(HTTPException) as exc_info:
        parse_project_id("")
    assert exc_info.value.status_code == 400


def test_none_raises_400():
    with pytest.raises(HTTPException) as exc_info:
        parse_project_id(None)
    assert exc_info.value.status_code == 400
