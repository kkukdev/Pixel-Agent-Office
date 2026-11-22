from uuid import uuid4

from sqlalchemy import text

from database import engine


def create_task(target_repo_id: int) -> str:
    """
    작업과 최초 상태 이력을 저장하고 새 작업 ID를 반환
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