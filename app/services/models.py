from sqlalchemy import Column, String, Integer, JSON, ARRAY, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.services.db import Base


class MLSessions(Base):
    __tablename__ = "ml_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(String, unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    filename = Column(String, nullable=True)
    columns = Column(JSON, nullable=False)
    shape = Column(ARRAY(Integer), nullable=False)
    dtypes = Column(JSON, nullable=False)
    missing_values = Column(JSON, nullable=False)
    current_data = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    snapshots = relationship("MLSessionSnapshots", back_populates="session", cascade="all, delete-orphan")
    models = relationship("MLTrainedModels", back_populates="session", cascade="all, delete-orphan")


class MLSessionSnapshots(Base):
    __tablename__ = "ml_session_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("ml_sessions.id", ondelete="CASCADE"), nullable=False)
    step_id = Column(Integer, nullable=False)
    step_name = Column(String, nullable=False)
    data_snapshot = Column(JSON, nullable=False)
    meta = Column("metadata", JSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    session = relationship("MLSessions", back_populates="snapshots")


class MLTrainedModels(Base):
    __tablename__ = "ml_trained_models"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("ml_sessions.id", ondelete="CASCADE"), nullable=False)
    model_type = Column(String, nullable=False)
    target_column = Column(String, nullable=False)
    metrics = Column(JSON, nullable=False)
    parameters = Column(JSON, nullable=False)
    model_path = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)

    session = relationship("MLSessions", back_populates="models")
