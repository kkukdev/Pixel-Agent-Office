from uuid import UUID

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from task_repository import get_task


app = FastAPI(title="Pixel Agent Office API")


class TaskDetail(BaseModel):
    task_id: UUID
    target_repo_id: int
    status: str
    result_markdown: str | None


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks/{task_id}")
def read_task(task_id: UUID) -> TaskDetail:
    task = get_task(str(task_id))

    if task is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return TaskDetail.model_validate(task)