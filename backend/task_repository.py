from uuid import uuid4
from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.engine import RowMapping

from database import engine


def create_task(target_repo_id: int) -> str:
    """
    작업과 최초 상태 이력을 저장하고 새 작업 ID를 반환

    - 작업과 최초 상태 이력을 같은 트랜잭션에 저장
    - 이력 저장이 실패하면 작업 삽입도 롤백
    - 두 행을 저장한 뒤 새 작업 ID를 반환
    """
    task_id = str(uuid4())

    with engine.begin() as connection:
        # 작업에 실제로 저장된 초기 상태를 이력에도 기록
        initial_status = connection.execute(
            text("""
                INSERT INTO tasks (task_id, target_repo_id)
                VALUES (:task_id, :target_repo_id)
                RETURNING status
            """),
            {
                "task_id": task_id,
                "target_repo_id": target_repo_id,
            },
        ).scalar_one()

        connection.execute(
            text("""
                INSERT INTO task_status_history (task_id, previous_status, status)
                VALUES (:task_id, NULL, :status)
            """),
            {
                "task_id": task_id,
                "status": initial_status,
            },
        )

    return task_id


def get_task(task_id: str) -> RowMapping | None:
    """
    작업 ID로 현재 상태와 결과를 조회

    - 해당 ID의 작업이 없으면 None을 반환
    """
    with engine.connect() as connection:
        return connection.execute(
            text("""
                SELECT task_id, target_repo_id, status, result_markdown
                FROM tasks
                WHERE task_id = :task_id
            """),
            {
                "task_id": task_id,
            },
        ).mappings().one_or_none()


def list_tasks(limit: int, offset: int) -> Sequence[RowMapping]:
    """
    등록 시간이 최근인 작업부터 지정된 범위만 조회

    - 등록 시간이 같으면 작업 ID를 기준으로 순서 결정
    - offset만큼 건너뛴 뒤 최대 limit개를 반환
    """
    with engine.connect() as connection:
        return connection.execute(
            text("""
                SELECT task_id, target_repo_id, status
                FROM tasks
                ORDER BY created_at DESC, task_id DESC
                LIMIT :limit OFFSET :offset
            """),
            {
                "limit": limit,
                "offset": offset,
            },
        ).mappings().all()