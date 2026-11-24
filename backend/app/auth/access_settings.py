import os
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class AccessSettings:
    issuer: str
    audience: str
    admin_email: str


def _required_env(name: str) -> str:
    """
    필수 환경 변수를 읽고, 비어 있으면 설정 오류 알림
    """
    value = os.getenv(name, "").strip()

    if not value:
        raise RuntimeError(f"환경 변수 {name}이(가) 설정되지 않았습니다.")

    return value


def load_access_settings() -> AccessSettings:
    """
    환경 변수에서 Cloudflare Access 설정을 읽어 반환
    """
    team_domain = _required_env("CF_ACCESS_TEAM_DOMAIN").lower()

    # 검증에 사용할 발급자는 서버에 등록한 Cloudflare 팀 도메인으로 설정
    if not re.fullmatch(
        r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com",
        team_domain,
    ):
        raise RuntimeError(
            "CF_ACCESS_TEAM_DOMAIN은 팀이름.cloudflareaccess.com 형식이어야 합니다."
        )

    return AccessSettings(
        issuer=f"https://{team_domain}",
        audience=_required_env("CF_ACCESS_AUDIENCE"),
        admin_email=_required_env("CF_ACCESS_ADMIN_EMAIL").casefold(),
    )
