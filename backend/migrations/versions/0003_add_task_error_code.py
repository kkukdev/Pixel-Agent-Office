"""add task error code

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-25 22:17:45.651073

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    작업 실패 원인을 분류할 오류 코드 열을 추가
    """
    op.add_column("tasks", sa.Column("error_code", sa.String(64), nullable=True))


def downgrade() -> None:
    """
    작업 오류 코드 열을 제거
    """
    op.drop_column("tasks", "error_code")