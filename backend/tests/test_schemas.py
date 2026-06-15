import pytest
from pydantic import ValidationError
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.model import TrainRequest


class TestProjectCreate:
    def test_valid_name(self):
        p = ProjectCreate(name="My Project")
        assert p.name == "My Project"

    def test_name_is_stripped(self):
        p = ProjectCreate(name="  hello  ")
        assert p.name == "hello"

    def test_empty_name_raises(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="   ")

    def test_name_at_max_length(self):
        p = ProjectCreate(name="a" * 200)
        assert len(p.name) == 200

    def test_name_exceeds_max_length_raises(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="a" * 201)


class TestProjectUpdate:
    def test_valid_status(self):
        p = ProjectUpdate(status="active")
        assert p.status == "active"

    def test_invalid_status_raises(self):
        with pytest.raises(ValidationError):
            ProjectUpdate(status="deleted")

    def test_valid_view_mode(self):
        p = ProjectUpdate(view_mode="freestyle")
        assert p.view_mode == "freestyle"

    def test_invalid_view_mode_raises(self):
        with pytest.raises(ValidationError):
            ProjectUpdate(view_mode="advanced")

    def test_valid_current_step(self):
        p = ProjectUpdate(current_step="training")
        assert p.current_step == "training"

    def test_invalid_current_step_raises(self):
        with pytest.raises(ValidationError):
            ProjectUpdate(current_step="nonexistent-step")

    def test_all_fields_optional(self):
        p = ProjectUpdate()
        assert p.status is None
        assert p.current_step is None
        assert p.view_mode is None


class TestTrainRequest:
    def test_valid_model_type(self):
        r = TrainRequest(model_type="random_forest", target_column="label")
        assert r.model_type == "random_forest"

    def test_invalid_model_type_raises(self):
        with pytest.raises(ValidationError):
            TrainRequest(model_type="neural_network", target_column="label")

    def test_valid_task_type(self):
        r = TrainRequest(model_type="xgboost", target_column="y", task_type="classification")
        assert r.task_type == "classification"

    def test_invalid_task_type_raises(self):
        with pytest.raises(ValidationError):
            TrainRequest(model_type="xgboost", target_column="y", task_type="clustering")
