from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.auth.access_auth import require_admin
from app.integrations.github_app import pull_request_exists
from app.projects.repository_settings import load_allowed_repositories
from app.tasks.task_repository import create_review_task, get_task, list_tasks


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

projects_router = APIRouter(
    prefix="/api/projects",
    dependencies=[Depends(require_admin)],
)


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pull_number: int = Field(
        strict=True,
        gt=0,
        le=2**63 - 1,
        description="리뷰할 GitHub PR 번호",
    )


class ReviewAccepted(BaseModel):
    task_id: UUID


class TaskSummary(BaseModel):
    task_id: UUID
    target_repo_id: int
    status: str


class TaskDetail(TaskSummary):
    result_markdown: str | None
    error_code: str | None = Field(
        description="실패 원인 코드. 저장된 오류 코드가 없으면 null.",
    )


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


@projects_router.post(
    "/{project_id}/reviews",
    status_code=202,
    summary="PR 리뷰 요청 등록",
    responses={
        401: {"description": "Access 토큰이 없거나 유효하지 않음"},
        403: {"description": "관리자 권한이 없음"},
        404: {"description": "프로젝트 또는 PR을 찾을 수 없음"},
        502: {"description": "GitHub에서 PR을 확인할 수 없음"},
        503: {"description": "Access 인증을 처리할 수 없음"},
    },
)
def register_review(project_id: str, request: ReviewRequest) -> ReviewAccepted:
    """
    허용된 프로젝트의 PR을 확인하고 대기 작업으로 등록
    """
    repository = load_allowed_repositories().get(project_id)
    if repository is None:
        raise HTTPException(status_code=404, detail="등록된 프로젝트를 찾을 수 없습니다.")

    try:
        exists = pull_request_exists(repository, request.pull_number)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="GitHub에서 PR을 확인할 수 없습니다.",
        ) from None

    if not exists:
        raise HTTPException(status_code=404, detail="해당 PR을 찾을 수 없습니다.")

    task_id = create_review_task(repository.repo_id, request.pull_number)

    return ReviewAccepted(task_id=UUID(task_id))


app.include_router(tasks_router)
app.include_router(projects_router)