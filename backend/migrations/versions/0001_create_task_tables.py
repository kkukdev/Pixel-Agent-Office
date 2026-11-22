"""create task tables

Revision ID: 0001
Revises: 
Create Date: 2026-11-22 20:05:23.111693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision: 마이그레이션의 ID
# down_revision: 이전 마이그레이션의 ID (첫 마이그레이션이므로 None)
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    작업과 상태 변경 이력을 저장할 테이블을 생성
    1. tasks: 현재 상태를 저장
    2. task_status_history: 상태 변경 이력을 저장
    """
    op.create_table(
        "tasks",
        sa.Column(
            "task_id",
            sa.String(36),
            primary_key=True,
        ),
        sa.Column(
            "parent_task_id",
            sa.String(36),
            sa.ForeignKey("tasks.task_id"),
            nullable=True,
        ),
        sa.Column(
            "target_repo_id",
            sa.BigInteger(),
            nullable=False,
        ),
        sa.Column(
            "permission_mode",
            sa.String(1),
            nullable=False,
            server_default="B",
        ),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="queued",
        ),
        sa.Column(
            "priority",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "result_markdown",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.CheckConstraint(
            "permission_mode IN ('A', 'B', 'C')",
            name="ck_tasks_permission_mode",
        ),
    )

    # 저장 코드에서는 현재 상태 갱신과 이력 추가를 같은 트랜잭션에서 처리
    op.create_table(
        "task_status_history",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "task_id",
            sa.String(36),
            sa.ForeignKey("tasks.task_id"),
            nullable=False,
        ),
        # 처음 등록된 작업은 이전 상태가 없음
        # 최초 등록은 이전 상태가 없으므로 previous_status=NULL, status="queued"로 기록
        sa.Column(
            "previous_status",
            sa.String(32),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
        ),
        sa.Column(
            "changed_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )

    op.create_index(
        "ix_task_status_history_task_id",
        "task_status_history",
        ["task_id"],
    )


def downgrade() -> None:
    """
    작업을 참조하는 이력 테이블부터 제거
    - 이력 테이블이 tasks를 참조하므로 이력 테이블과 인덱스를 먼저 제거
    """
    op.drop_index("ix_task_status_history_task_id", table_name="task_status_history")
    op.drop_table("task_status_history")
    op.drop_table("tasks")
