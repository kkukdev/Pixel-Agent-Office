import os
import logging
from base64 import urlsafe_b64encode
from hashlib import sha256
from secrets import compare_digest, token_urlsafe
from urllib.parse import urlencode
from dataclasses import dataclass, field
from time import monotonic

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app.auth.access_auth import require_admin


github_auth_router = APIRouter(prefix="/api/auth/github")

CALLBACK_PATH = "/api/auth/github/callback"
SESSION_COOKIE = "office_github_session"
SESSION_MAX_AGE = 3600


@dataclass(frozen=True)
class GitHubSession:
    session_id: str = field(repr=False)
    access_token: str = field(repr=False)
    login: str
    expires_at: float


def _is_local_auth(request: Request) -> bool:
    """
    배포에서는 GitHub 인증 경로에도 Cloudflare 관리자 검증을 적용
    """
    local_dev = os.getenv("GITHUB_AUTH_LOCAL_DEV") == "1"
    if not local_dev:
        require_admin(request)
    return local_dev


def _load_oauth_config(local_dev: bool) -> tuple[str, str]:
    """
    로그인 시작과 코드 교환에서 사용할 Client ID와 콜백 주소를 반환
    """
    client_id = os.getenv("GITHUB_APP_CLIENT_ID", "").strip()
    redirect_uri = os.getenv("GITHUB_AUTH_REDIRECT_URI", "").strip()

    if not client_id or not redirect_uri:
        raise HTTPException(status_code=503, detail="GitHub 로그인 설정을 확인해 주세요.")

    if local_dev:
        if redirect_uri != f"http://localhost:5173{CALLBACK_PATH}":
            raise HTTPException(status_code=503, detail="로컬 GitHub 콜백 주소를 확인해 주세요.")
    elif not redirect_uri.startswith("https://"):
        raise HTTPException(status_code=503, detail="배포 GitHub 콜백에는 HTTPS가 필요합니다.")

    return client_id, redirect_uri


@github_auth_router.get("/login", summary="GitHub 로그인 시작")
def start_github_login(request: Request) -> RedirectResponse:
    """
    콜백 검증에 필요한 값을 저장하고 GitHub 인증 화면으로 이동
    """
    local_dev = _is_local_auth(request)
    client_id, redirect_uri = _load_oauth_config(local_dev)

    state = token_urlsafe(32)
    verifier = token_urlsafe(32)
    challenge = urlsafe_b64encode(sha256(verifier.encode("ascii")).digest())

    query = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": challenge.decode("ascii").rstrip("="),
        "code_challenge_method": "S256",
    })

    response = RedirectResponse(
        f"https://github.com/login/oauth/authorize?{query}",
        status_code=302,
        headers={"Cache-Control": "no-store"},
    )

    for name, value in (
        ("github_oauth_state", state),
        ("github_oauth_verifier", verifier),
    ):
        response.set_cookie(
            name,
            value,
            max_age=600,
            path=CALLBACK_PATH,
            httponly=True,
            secure=not local_dev,
            samesite="lax",
        )

    return response


@github_auth_router.get("/callback", summary="GitHub 로그인 콜백")
def github_callback(
    request: Request,
    code: str = "",
    state: str = "",
) -> RedirectResponse:
    """
    GitHub 계정을 검증하고 등록된 관리자에게 세션을 발급
    """
    local_dev = _is_local_auth(request)
    client_id, redirect_uri = _load_oauth_config(local_dev)

    expected_state = request.cookies.get("github_oauth_state", "")
    verifier = request.cookies.get("github_oauth_verifier", "")
    if not code or not verifier or not state or not expected_state:
        raise HTTPException(status_code=400, detail="GitHub 로그인을 다시 시작해 주세요.")

    if not compare_digest(state.encode(), expected_state.encode()):
        raise HTTPException(status_code=400, detail="GitHub 로그인 요청을 확인할 수 없습니다.")

    client_secret = os.getenv("GITHUB_APP_CLIENT_SECRET", "").strip()
    admin_id = os.getenv("GITHUB_AUTH_ADMIN_USER_ID", "").strip()
    if not client_secret or not admin_id.isascii() or not admin_id.isdecimal():
        raise HTTPException(status_code=503, detail="GitHub 관리자 인증 설정을 확인해 주세요.")

    stage = "token_exchange"

    try:
        with httpx.Client(timeout=10) as client:
            token_response = client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "code_verifier": verifier,
                },
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            access_token = (
                token_data.get("access_token") if isinstance(token_data, dict) else None
            )
            if not isinstance(access_token, str) or not access_token:
                raise HTTPException(status_code=400, detail="GitHub 로그인을 다시 시작해 주세요.")

            stage = "user_lookup"

            user_response = client.get(
                "https://api.github.com/user",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {access_token}",
                    "X-GitHub-Api-Version": "2026-03-10",
                },
            )
            user_response.raise_for_status()
            user = user_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None

        logging.getLogger("uvicorn.error").warning(
            "GitHub 인증 실패 stage=%s error=%s status=%s",
            stage,
            type(exc).__name__,
            status,
        )

        raise HTTPException(
            status_code=502,
            detail="GitHub 인증 응답을 확인할 수 없습니다.",
        ) from None

    if not isinstance(user, dict) or type(user.get("id")) is not int:
        raise HTTPException(status_code=502, detail="GitHub 사용자 ID를 확인할 수 없습니다.")

    if str(user["id"]) != admin_id:
        raise HTTPException(status_code=403, detail="등록된 GitHub 관리자 계정으로 로그인해 주세요.")

    login = user.get("login")
    if not isinstance(login, str) or not login:
        raise HTTPException(status_code=502, detail="GitHub 사용자명을 확인할 수 없습니다.")

    session = GitHubSession(
        session_id=token_urlsafe(32),
        access_token=access_token,
        login=login,
        expires_at=monotonic() + SESSION_MAX_AGE,
    )
    request.app.state.github_session = session

    response = RedirectResponse(
        "/",
        status_code=303,
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )
    response.set_cookie(
        SESSION_COOKIE,
        session.session_id,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=not local_dev,
        samesite="lax",
    )
    for name in ("github_oauth_state", "github_oauth_verifier"):
        response.delete_cookie(name, path=CALLBACK_PATH)

    return response


def _find_github_session(request: Request) -> GitHubSession | None:
    """
    브라우저의 쿠키가 만료되지 않은 서버 세션과 일치하는지 확인
    """
    session = getattr(request.app.state, "github_session", None)
    session_id = request.cookies.get(SESSION_COOKIE, "")

    if (
        session is None
        or session.expires_at <= monotonic()
        or not compare_digest(session_id.encode(), session.session_id.encode())
    ):
        return None

    return session


@github_auth_router.get("/session", summary="연결된 GitHub 계정 조회")
def read_github_session(request: Request) -> JSONResponse:
    """
    세션 쿠키를 확인하고 연결된 GitHub 사용자명을 반환
    """
    _is_local_auth(request)
    session = _find_github_session(request)

    if session is None:
        raise HTTPException(status_code=401, detail="GitHub 로그인이 필요합니다.")

    return JSONResponse({"login": session.login}, headers={"Cache-Control": "no-store"})


@github_auth_router.post("/logout", status_code=204, summary="GitHub 로그아웃")
def logout_github(request: Request) -> Response:
    """
    현재 오피스 세션을 지우고 브라우저의 세션 쿠키를 만료
    """
    local_dev = _is_local_auth(request)

    # 외부 사이트의 단순 폼 제출로 로그아웃이 실행되지 않도록 검증
    if request.headers.get("X-Office-Action") != "github-logout":
        raise HTTPException(status_code=403, detail="로그아웃 요청을 확인할 수 없습니다.")

    if _find_github_session(request) is not None:
        request.app.state.github_session = None

    response = Response(status_code=204, headers={"Cache-Control": "no-store"})
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=not local_dev,
        samesite="lax",
    )

    return response