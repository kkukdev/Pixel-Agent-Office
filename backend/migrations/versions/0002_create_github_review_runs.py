"""create github review runs

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-24 23:30:43.184518

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    리뷰 작업이 어느 PR을 대상으로 하는지 저장할 테이블을 생성
    """
    op.create_table(
        "github_review_runs",
        # 작업 한 건에 리뷰 대상 하나를 연결
        sa.Column(
            "task_id",
            sa.String(36),
            sa.ForeignKey("tasks.task_id"),
            primary_key=True,
        ),
        sa.Column("pull_number", sa.BigInteger(), nullable=False),
        sa.CheckConstraint(
            "pull_number > 0",
            name="ck_github_review_runs_pull_number_positive",
        ),
    )


def downgrade() -> None:
    """이 마이그레이션에서 추가한 리뷰 대상 테이블을 제거"""
    op.drop_table("github_review_runs")
