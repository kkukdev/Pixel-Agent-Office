from collections.abc import Sequence
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection, RowMapping
from dataclasses import dataclass

from app.database import engine


def _insert_queued_task(connection: Connection, target_repo_id: int) -> str:
    """
    열려 있는 트랜잭션에 작업과 최초 상태 이력을 추가
    """
    task_id = str(uuid4())

    # DB가 설정한 초기 상태를 가져와 이력에도 같은 값을 기록
    initial_status = connection.execute(
        text("""
            INSERT INTO tasks (
                task_id,
                target_repo_id
            )
            VALUES (
                :task_id,
                :target_repo_id
            )
            RETURNING status
        """),
        {
            "task_id": task_id,
            "target_repo_id": target_repo_id,
        },
    ).scalar_one()

    connection.execute(
        text("""
            INSERT INTO task_status_history (
                task_id,
                previous_status,
                status
            )
            VALUES (
                :task_id,
                NULL,
                :status
            )
        """),
        {
            "task_id": task_id,
            "status": initial_status,
        },
    )

    return task_id


def create_task(target_repo_id: int) -> str:
    """
    작업과 최초 상태 이력을 저장하고 새 작업 ID를 반환

    - 작업과 최초 상태 이력을 같은 트랜잭션에 저장
    - 이력 저장이 실패하면 작업 삽입도 롤백
    - 두 행을 저장한 뒤 새 작업 ID를 반환
    """
    with engine.begin() as connection:
        task_id = _insert_queued_task(connection, target_repo_id)

    return task_id


def create_review_task(target_repo_id: int, pull_number: int) -> str:
    """
    작업, 최초 상태 이력, 리뷰 대상 PR을 한 트랜잭션에 저장
    """
    with engine.begin() as connection:
        task_id = _insert_queued_task(connection, target_repo_id)

        connection.execute(
            text("""
                INSERT INTO github_review_runs (
                    task_id,
                    pull_number
                )
                VALUES (
                    :task_id,
                    :pull_number
                )
            """),
            {
                "task_id": task_id,
                "pull_number": pull_number,
            },
        )

    return task_id


@dataclass(frozen=True)
class ClaimedReviewTask:
    task_id: str
    target_repo_id: int
    pull_number: int


def claim_review_task(
    connection: Connection,
    task_id: str,
) -> ClaimedReviewTask | None:
    """
    대기 중인 PR 리뷰를 실행 중으로 바꾸고 대상 저장소와 PR 번호를 반환
    """
    task = connection.execute(
        text("""
            UPDATE tasks
            SET status = 'running'
            WHERE task_id = :task_id
                AND status = 'queued'
                AND EXISTS (
                    SELECT 1
                    FROM github_review_runs AS r
                    WHERE r.task_id = tasks.task_id
                )
            RETURNING target_repo_id
        """),
        {
            "task_id": task_id,
        },
    ).mappings().one_or_none()

    if task is None:
        return None

    pull_number = connection.execute(
        text("""
            SELECT pull_number
            FROM github_review_runs
            WHERE task_id = :task_id
        """),
        {"task_id": task_id},
    ).scalar_one()

    connection.execute(
        text("""
            INSERT INTO task_status_history (
                task_id,
                previous_status,
                status
            )
            VALUES (
                :task_id,
                'queued',
                'running'
            )
        """),
        {
            "task_id": task_id,
        },
    )

    return ClaimedReviewTask(
        task_id=task_id,
        target_repo_id=task["target_repo_id"],
        pull_number=pull_number,
    )


def finish_review_task(
    connection: Connection,
    task_id: str,
    *,
    result_markdown: str | None = None,
    error_code: str | None = None,
) -> bool:
    """
    실행 중인 PR 리뷰의 최종 상태와 이력을 저장
    """
    if (result_markdown is None) == (error_code is None):
        raise ValueError("리뷰 결과와 오류 코드 중 하나만 지정해야 합니다.")

    status = "completed" if error_code is None else "failed"

    updated_task_id = connection.execute(
        text("""
            UPDATE tasks
            SET status = :status,
                result_markdown = :result_markdown,
                error_code = :error_code
            WHERE task_id = :task_id
                AND status = 'running'
                AND EXISTS (
                    SELECT 1
                    FROM github_review_runs AS r
                    WHERE r.task_id = tasks.task_id
                )
            RETURNING task_id
        """),
        {
            "task_id": task_id,
            "status": status,
            "result_markdown": result_markdown,
            "error_code": error_code,
        },
    ).scalar_one_or_none()

    if updated_task_id is None:
        return False

    connection.execute(
        text("""
            INSERT INTO task_status_history (
                task_id,
                previous_status,
                status
            )
            VALUES (
                :task_id,
                'running',
                :status
            )
        """),
        {
            "task_id": task_id,
            "status": status,
        },
    )

    return True


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
