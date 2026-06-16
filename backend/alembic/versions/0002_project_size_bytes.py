"""add projects.size_bytes

Revision ID: 0002_project_size_bytes
Revises: 0001_initial
Create Date: 2026-06-16

Records the byte size of each project's uploaded CSV so per-user storage usage
can be summed. Nullable: pre-existing rows stay NULL until their next upload.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_project_size_bytes"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("size_bytes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "size_bytes")
