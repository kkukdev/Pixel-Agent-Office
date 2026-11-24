from functools import lru_cache

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient
from jwt.exceptions import (
    InvalidTokenError,
    PyJWKClientConnectionError,
    PyJWKClientError,
    PyJWKSetError,
)

from app.auth.access_settings import load_access_settings


@lru_cache(maxsize=1)
def _jwks_client(issuer: str) -> PyJWKClient:
    """
    신뢰하는 팀의 공개키를 조회하는 클라이언트를 재사용
    """
    return PyJWKClient(
        f"{issuer}/cdn-cgi/access/certs",
        lifespan=300,
        timeout=5,
    )


def require_admin(request: Request) -> None:
    """
    Cloudflare Access 토큰을 검증하고 등록된 관리자에게만 접근을 허용
    """
    tokens = request.headers.getlist("Cf-Access-Jwt-Assertion")
    if len(tokens) != 1 or not tokens[0].strip():
        raise HTTPException(status_code=401, detail="Access 토큰이 필요합니다.")

    try:
        settings = load_access_settings()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Access 인증 설정을 확인해 주세요.") from None

    token = tokens[0].strip()
    try:
        # 헤더의 kid는 공개키를 고르는 데만 사용
        # 공개키 주소는 서버 설정에서 읽음
        header = jwt.get_unverified_header(token)
        key_id = header.get("kid")

        if header.get("alg") != "RS256" or not isinstance(key_id, str) or not key_id:
            raise InvalidTokenError("토큰의 서명 알고리즘 또는 키 ID가 올바르지 않습니다.")

        signing_key = _jwks_client(settings.issuer).get_signing_key(key_id)
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=settings.issuer,
            audience=settings.audience,
            options={"require": ["iss", "aud", "exp", "iat", "nbf", "type", "email"]},
        )

        email = claims["email"]
        if claims["type"] != "app" or not isinstance(email, str) or not email:
            raise InvalidTokenError("토큰에 유효한 사용자 정보가 없습니다.")
    except (PyJWKClientConnectionError, PyJWKSetError):
        raise HTTPException(status_code=503, detail="Access 공개키를 확인할 수 없습니다.") from None
    except (PyJWKClientError, InvalidTokenError):
        raise HTTPException(status_code=401, detail="유효하지 않은 Access 토큰입니다.") from None

    # 서명과 토큰 조건을 모두 검증한 뒤 관리자 이메일을 대조
    if email.casefold() != settings.admin_email:
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")
