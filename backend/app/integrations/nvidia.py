import os
from typing import Literal, TypedDict

import httpx


CHAT_COMPLETIONS_URL = "https://integrate.api.nvidia.com/v1/chat/completions"


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMProviderError(RuntimeError):
    """
    호출한 쪽에서 원인을 구분할 수 있도록 오류 코드를 제공
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def complete_nvidia_text(
    model: str,
    messages: list[ChatMessage],
    *,
    max_tokens: int = 512,
    enable_thinking: bool | None = None,
) -> str:
    """
    NVIDIA Build에 대화를 보내고 모델의 최종 응답 텍스트를 반환
    """
    API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
    if not API_KEY:
        raise LLMProviderError("configuration", "NVIDIA_API_KEY를 설정해 주세요.")

    payload: dict[str, object] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": False,
    }

    # 추론 모드를 지원하는 모델에서 호출자가 지정한 경우에만 전달
    if enable_thinking is not None:
        payload["chat_template_kwargs"] = {"enable_thinking": enable_thinking}

    try:
        response = httpx.post(
            CHAT_COMPLETIONS_URL,
            headers={"Authorization": f"Bearer {API_KEY}"},
            json=payload,
            timeout=30.0,
        )
    except httpx.TimeoutException:
        raise LLMProviderError("timeout", "NVIDIA API 응답 시간이 초과됐습니다.") from None
    except httpx.RequestError:
        raise LLMProviderError("connection", "NVIDIA API에 연결할 수 없습니다.") from None

    if response.status_code in (401, 403):
        raise LLMProviderError("authentication", "NVIDIA API 키 또는 접근 권한을 확인해 주세요.")

    if response.status_code == 429:
        raise LLMProviderError("rate_limit", "NVIDIA API 요청 한도에 도달했습니다.")

    if response.status_code != 200:
        raise LLMProviderError(
            "upstream",
            f"NVIDIA API가 HTTP {response.status_code}를 반환했습니다.",
        )

    try:
        choice = response.json()["choices"][0]
        content = choice["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise LLMProviderError("invalid_response", "NVIDIA 응답 형식을 확인할 수 없습니다.") from None

    # 토큰 한도로 잘린 답변은 완료된 결과로 저장하지 않음
    if choice.get("finish_reason") == "length":
        raise LLMProviderError("incomplete_response", "모델 응답이 토큰 한도에서 잘렸습니다.")

    if not isinstance(content, str) or not content.strip():
        raise LLMProviderError("invalid_response", "NVIDIA 응답에 최종 텍스트가 없습니다.")

    return content.strip()