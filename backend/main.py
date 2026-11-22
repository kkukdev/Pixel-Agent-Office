from typing import Annotated
from uuid import UUID

from fastapi import FastAPI, HTTPException, APIRouter, Query, Depends
from pydantic import BaseModel

from access_auth import require_admin
from task_repository import get_task, list_tasks


app = FastAPI(title="Pixel Agent Office API")

tasks_router = APIRouter(
    prefix="/api/tasks",
    dependencies=[Depends(require_admin)],
    responses={
        401: {"description": "Access 토큰이 없거나 유효하지 않음"},
        403: {"description": "관리자 권한이 없음"},
        503: {"description": "Access 인증을 처리할 수 없음"},
    },
)


class TaskSummary(BaseModel):
    task_id: UUID
    target_repo_id: int
    status: str


class TaskDetail(TaskSummary):
    result_markdown: str | None


@app.get("/api/health", summary="API 서버 상태 확인")
def health_check() -> dict[str, str]:
    """
    API 서버가 HTTP 요청에 응답하는지 확인
    """
    return {"status": "ok"}


@tasks_router.get("", summary="작업 목록 조회")
def read_tasks(
    limit: Annotated[int, Query(ge=1, le=100, description="최대 반환 작업 수")] = 20,
    offset: Annotated[int, Query(ge=0, le=2**63 - 1, description="목록 앞에서 건너뛸 작업 수")] = 0,
) -> list[TaskSummary]:
    """
    등록 시간이 최근인 작업부터 요약 정보를 반환

    - 지정된 범위에 작업이 없으면 빈 배열을 반환
    - 결과 마크다운은 작업 상세 조회에서 확인 가능
    """
    return [
        TaskSummary.model_validate(task)
        for task in list_tasks(limit=limit, offset=offset)
    ]


@tasks_router.get(
        "/{task_id}",
        summary="작업 상세 조회",
        responses={404: {"description": "해당 ID의 작업을 찾을 수 없음"}},
    )
def read_task(task_id: UUID) -> TaskDetail:
    """
    작업 ID로 현재 상태와 결과를 조회

    - 작업 결과가 아직 저장되지 않았다면 `result_markdown`은 `null`
    """
    task = get_task(str(task_id))

    if task is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return TaskDetail.model_validate(task)


app.include_router(tasks_router)