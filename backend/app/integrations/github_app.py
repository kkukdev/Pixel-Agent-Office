import os
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from time import time
from urllib.parse import quote

import httpx
import jwt
from pydantic import BaseModel, TypeAdapter

from app.paths import PROJECT_ROOT
from app.projects.repository_settings import AllowedRepository, load_allowed_repositories


PRIVATE_KEY_PATH = PROJECT_ROOT / "secrets" / "github-app.pem"


def create_app_jwt() -> str:
    """
    GitHub에 앱 자체로 인증할 때 사용할 짧은 수명의 JWT를 발급
    """
    app_id = os.getenv("GITHUB_APP_ID", "").strip()

    if not app_id.isascii() or not app_id.isdecimal() or int(app_id) <= 0:
        raise RuntimeError("GITHUB_APP_ID에 숫자 App ID를 설정해 주세요.")

    now = int(time())
    claims = {
        # 서버와 GitHub의 시계 차이를 고려해 발급 시각을 60초 이전으로 설정
        "iat": now - 60,
        "exp": now + 8 * 60,
        "iss": app_id,
    }

    return jwt.encode(claims, PRIVATE_KEY_PATH.read_bytes(), algorithm="RS256")


def _get_repository_access(
    client: httpx.Client,
    repository: AllowedRepository,
    *,
    read_contents: bool = False,
) -> tuple[str, dict[str, str]]:
    """
    저장소 한 곳으로 제한한 토큰을 발급하고 실제 접근 범위를 확인
    """
    permissions = {"pull_requests": "read"}

    # 원본 diff를 조회할 때만 저장소 내용 읽기 권한을 요청
    if read_contents:
        permissions["contents"] = "read"

    response = client.post(
        f"/app/installations/{repository.installation_id}/access_tokens",
        headers={"Authorization": f"Bearer {create_app_jwt()}"},
        json={
            "repository_ids": [repository.repo_id],
            "permissions": permissions,
        },
    )
    response.raise_for_status()

    auth_headers = {"Authorization": f"Bearer {response.json()['token']}"}

    scope_response = client.get("/installation/repositories", headers=auth_headers)
    scope_response.raise_for_status()

    scope = scope_response.json()
    repositories = scope["repositories"]

    if (
        scope["total_count"] != 1
        or len(repositories) != 1
        or repositories[0]["id"] != repository.repo_id
    ):
        raise RuntimeError("설치 토큰의 저장소 범위가 설정과 일치하지 않습니다.")

    # GitHub가 반환한 현재 소유자와 저장소 이름으로 PR API 경로 생성
    owner = quote(repositories[0]["owner"]["login"], safe="")
    name = quote(repositories[0]["name"], safe="")

    return f"/repos/{owner}/{name}", auth_headers


class PullRequestSummary(BaseModel):
    number: int
    title: str


_pull_request_list = TypeAdapter(list[PullRequestSummary])


def _github_client() -> httpx.Client:
    """
    GitHub REST API에 공통 설정으로 연결할 클라이언트를 생성
    """
    return httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
        },
        timeout=10,
    )


@contextmanager
def _open_project(
    project_id: str,
    *,
    read_contents: bool = False,
    expected_repo_id: int | None = None,
) -> Generator[tuple[httpx.Client, str, dict[str, str]]]:
    """
    허용된 저장소의 API 경로와 읽기 전용 인증 헤더를 제공
    """
    repository = load_allowed_repositories().get(project_id)
    if repository is None:
        raise ValueError("허용 목록에 등록되지 않은 프로젝트입니다.")

    if expected_repo_id is not None and repository.repo_id != expected_repo_id:
        raise ValueError("작업에 저장된 저장소 ID가 현재 프로젝트 설정과 일치하지 않습니다.")

    with _github_client() as client:
        repository_path, auth_headers = _get_repository_access(
            client, 
            repository,
            read_contents=read_contents,
        )
        yield client, repository_path, auth_headers


def list_open_pull_requests(project_id: str) -> list[PullRequestSummary]:
    """
    허용된 프로젝트의 열린 PR 번호와 제목을 조회
    """
    with _open_project(project_id) as (client, repository_path, auth_headers):
        response = client.get(
            f"{repository_path}/pulls",
            headers=auth_headers,
            params={
                "state": "open",
                "per_page": 20,
            },
        )
        response.raise_for_status()

        return _pull_request_list.validate_python(response.json())


def pull_request_exists(
    repository: AllowedRepository,
    pull_number: int,
) -> bool:
    """
    허용된 저장소에서 지정한 PR을 읽을 수 있는지 확인
    """
    with _github_client() as client:
        repository_path, auth_headers = _get_repository_access(client, repository)
        response = client.get(
            f"{repository_path}/pulls/{pull_number}",
            headers=auth_headers,
        )

        if response.status_code == 404:
            return False

        response.raise_for_status()

        return True


@dataclass(frozen=True)
class PullRequestDiff:
    base_sha: str
    head_sha: str
    diff: str


def _get_pull_request_shas(
        client: httpx.Client,
        pull_path: str,
        auth_headers: dict[str, str],
) -> tuple[str, str]:
    """
    PR 상세 JSON에서 대상과 변경 브랜치의 커밋 SHA를 읽기
    """
    response = client.get(pull_path, headers=auth_headers)
    response.raise_for_status()

    pull_request = response.json()

    return pull_request["base"]["sha"], pull_request["head"]["sha"]


def read_pull_request_diff(
    project_id: str,
    pull_number: int,
    *,
    expected_repo_id: int | None = None,
) -> PullRequestDiff:
    """
    현재 PR의 diff와 조회 전후에 확인한 커밋 SHA를 반환
    """
    if pull_number < 1:
        raise ValueError("PR 번호는 1 이상이어야 합니다.")

    with _open_project(
        project_id,
        read_contents=True,
        expected_repo_id=expected_repo_id,
    ) as (client, repository_path, auth_headers):
        pull_path = f"{repository_path}/pulls/{pull_number}"
        before = _get_pull_request_shas(client, pull_path, auth_headers)

        response = client.get(
            pull_path,
            headers={**auth_headers, "Accept": "application/vnd.github.diff"}
        )
        response.raise_for_status()

        after = _get_pull_request_shas(client, pull_path, auth_headers)
        if before != after:
            raise RuntimeError("diff 조회 중 PR의 커밋이 변경됐습니다. 다시 조회해 주세요.")

        base_sha, head_sha = before

        return PullRequestDiff(
            base_sha=base_sha,
            head_sha=head_sha,
            diff=response.text
        )
