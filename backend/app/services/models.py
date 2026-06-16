from sqlalchemy import Column, String, Integer, JSON, ARRAY, TIMESTAMP, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.services.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String, unique=True, nullable=False)
    plan = Column(String, default="free", nullable=False)
    api_key_hash = Column(String, nullable=True)
    # Only populated in local auth mode; always NULL when using Supabase auth.
    password_hash = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)
    current_step = Column(String, default="upload", nullable=False)
    view_mode = Column(String, default="guided", nullable=False)
    columns = Column(JSON, nullable=True)
    shape = Column(ARRAY(Integer), nullable=True)
    dtypes = Column(JSON, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    user = relationship("User", back_populates="projects")
    pipeline_states = relationship("PipelineState", back_populates="project", cascade="all, delete-orphan")
    trained_models = relationship("TrainedModel", back_populates="project", cascade="all, delete-orphan")
    ml_jobs = relationship("MLJob", back_populates="project", cascade="all, delete-orphan")


class PipelineState(Base):
    __tablename__ = "pipeline_states"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    step_name = Column(String, nullable=False)
    config = Column(JSON, nullable=True)
    data_snapshot = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    project = relationship("Project", back_populates="pipeline_states")


class TrainedModel(Base):
    __tablename__ = "trained_models"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    model_type = Column(String, nullable=False)
    target_column = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    metrics = Column(JSON, nullable=True)
    parameters = Column(JSON, nullable=True)
    model_path = Column(String, nullable=True)
    is_best = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    project = relationship("Project", back_populates="trained_models")


class MLJob(Base):
    __tablename__ = "ml_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    job_type = Column(String, nullable=False)
    celery_task_id = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    result = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    project = relationship("Project", back_populates="ml_jobs")
