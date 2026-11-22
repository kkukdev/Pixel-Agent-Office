from pathlib import Path
from ruamel.yaml import YAML

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


REPOSITORIES_PATH = Path(__file__).resolve().parents[1] / "config" / "repos.yaml"

class AllowedRepository(BaseModel):
    """
    오피스 프로젝트와 GitHub 저장소 및 App 설치의 연결 정보
    """
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    project_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    repo_id: int = Field(gt=0, le=2**63 - 1)
    installation_id: int = Field(gt=0)


_repository_list = TypeAdapter(list[AllowedRepository])


def load_allowed_repositories(path: Path = REPOSITORIES_PATH) -> dict[str, AllowedRepository]:
    """
    저장소 설정을 검증하고 프로젝트 ID로 조회할 수 있게 반환
    """
    with path.open(encoding="utf-8") as config_file:
        data = YAML(typ="safe", pure=True).load(config_file)

    repositories = _repository_list.validate_python(data)
    by_project_id = {repo.project_id: repo for repo in repositories}

    if len(by_project_id) != len(repositories):
        raise ValueError("저장소 설정에 중복된 project_id가 있습니다.")

    if len({repo.repo_id for repo in repositories}) != len(repositories):
        raise ValueError("저장소 설정에 중복된 repo_id가 있습니다.")

    return by_project_id