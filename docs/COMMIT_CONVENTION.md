# 커밋 메시지 규칙

이 저장소의 커밋 메시지는 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)을 따릅니다.

```text
<type>[!]: <description>

[optional body]

[optional footer(s)]
```

- `type`과 `description`은 필수입니다. 콜론 뒤에 공백 한 칸을 두고, 무엇이 바뀌었는지 한 줄로 요약합니다.
- 변경 이유나 세부 사항이 필요하면 한 줄을 비워 본문을 작성합니다. 이슈 참조 등의 푸터도 앞부분과 빈 줄로 구분합니다.
- 기존 사용 방식과 호환되지 않는 변경에는 콜론 바로 앞에 `!`를 붙이거나 `BREAKING CHANGE: <변경 내용>` 푸터를 작성합니다. 둘을 함께 사용할 수 있습니다.

### 자주 사용하는 타입

| 타입       | 사용 기준                            |
| ---------- | ------------------------------------ |
| `feat`     | 새 기능 추가                         |
| `fix`      | 버그 수정                            |
| `docs`     | 문서 변경                            |
| `style`    | 공백이나 들여쓰기 등 코드 서식 변경  |
| `refactor` | 동작을 유지하면서 코드 구조 개선     |
| `perf`     | 성능 개선                            |
| `test`     | 테스트 추가 또는 수정                |
| `build`    | 빌드 설정이나 의존성 변경            |
| `ci`       | CI 워크플로 또는 설정 변경           |
| `chore`    | `.gitignore` 정리 등 저장소 유지보수 |
| `revert`   | 이전 커밋 되돌리기                   |

### 예시

```text
feat: 모바일 핀치 줌 추가
fix: 중복 웹훅으로 PR 리뷰가 재실행되는 문제 수정
docs: README에 커밋 메시지 규칙 추가
```

```text
feat!: 작업 조회 API 응답 필드명 변경

BREAKING CHANGE: 작업 식별자 필드가 id에서 task_id로 변경됩니다.
```
