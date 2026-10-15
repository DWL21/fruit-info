# AGENTS.md — fruit-info 작업 규칙

사람과 AI 에이전트(Claude Code, Codex 등)가 이 저장소에서 작업할 때 지키는 규칙입니다. `CLAUDE.md`는 이 파일을 가리킵니다.

## 저장소 구조

| 경로 | 내용 | 실행 환경 |
|---|---|---|
| `apps/api` | Hono REST·SSE API, SQLite(better-sqlite3), 사진 저장 | Node 22 (Docker, pahidc 서버) |
| `apps/web` | React 19 + Vite + Tailwind v4 모바일 웹 | Cloudflare Pages (`fruit.simplyimg.com`) |
| `packages/shared` | API 계약(Zod 스키마·타입)과 도메인 상수 | api·web 공용 |
| `eval` | 실제 시장 사진 기반 분석 정확도 평가 | 로컬·CI |
| `deploy`, `scripts`, `compose.production.yaml` | 운영 배포 | pahidc |
| `docs` | 계획(`PLAN.md`), 결정 기록, 리서치 | — |

## 작업 흐름 (필수)

1. **이슈 먼저** — 모든 변경은 GitHub 이슈에서 시작한다. 본문은 `## 배경` / `## 범위` / `## 완료 기준`.
2. **브랜치** — `feat/<이슈번호>`, `fix/<이슈번호>`, `docs/<이슈번호>`, `chore/<이슈번호>`.
3. **커밋** — `feat:`·`fix:`·`chore:`·`docs:`·`refactor:`·`test:` + 한국어 요약. 한 커밋은 한 가지 의도.
4. **PR** — 제목은 커밋 규칙과 같다. 본문은 `## 변경 사항` / `## 검증` / `Closes #n`. 검증에는 실제로 실행한 명령과 결과만 적는다.
5. **머지** — CI(`check`, `secret-scan`)가 통과하면 squash 머지. main 머지 = 운영 배포.
6. **배포 확인** — 머지 후 `Production deployment` 워크플로와 공개 주소 헬스 체크를 확인한다. 실패하면 즉시 `fix/` 이슈를 만든다.

## 비밀 정보 (절대 규칙)

- API 키·토큰·비밀번호·쿠키·`.env` 내용을 **커밋·PR 본문·이슈·로그·출력에 남기지 않는다.**
- 운영 비밀은 서버의 `/etc/fruit-info/api.env`(권한 600)에만 둔다. Codex 로그인 정보(`~/.codex`)는 서버 밖으로 꺼내지 않는다. 값은 서버에서 직접 생성하고 화면에 출력하지 않는다.
- 저장소는 **퍼블릭**이다. self-hosted runner 워크플로는 `push: main`과 `workflow_dispatch`에서만 실행하고, `pull_request` 트리거로 self-hosted runner를 쓰지 않는다.
- 새 환경 변수는 `apps/api/.env.example`에 **이름과 설명만** 추가한다.
- 저작권이 있는 외부 사진은 커밋하지 않는다. 평가 데이터는 출처 URL과 라벨만 `eval/dataset.json`에 저장한다.

## 코드 규칙

- TypeScript strict. `any` 금지(불가피하면 이유 주석).
- API 계약 변경 시 `packages/shared`의 스키마를 먼저 고치고 api·web을 함께 맞춘다.
- 응답 형식: 성공 `{ data }`, 실패 `{ error: { code, message } }` + 적절한 4xx/5xx.
- 사용자에게 보이는 문구는 한국어, 짧고 구체적으로.
- 모바일 우선(375px 기준). 터치 타깃 44px 이상, 색만으로 상태를 구분하지 않는다.
- AI 결과는 **후보**다. 사용자가 확인한 값만 시세로 저장한다. 모델 출력은 Zod로 검증한다.
- 개인정보: 업로드 사진은 클라이언트에서 리사이즈해 EXIF(GPS)를 제거한다. 얼굴·전화번호는 추출하지 않는다.

## 검증 명령

```bash
pnpm install
pnpm check        # 타입 검사 + 테스트 + 빌드
pnpm dev          # api :8787, web :5173
pnpm eval         # 실제 시장 사진으로 분석 정확도 평가 (codex 로그인 필요)
```

## 제품 의사결정 원칙

- 가장 위험한 가설부터 가장 싸게 검증한다 (`docs/PLAN.md` §3).
- 기능은 North Star(최근 4시간 내 사진 근거가 있는 점포×품목 시세 수)나 H1~H4 지표 중 하나를 움직여야 한다.
- 결정과 근거는 `docs/decisions/NNNN-제목.md`에 짧게 남긴다.
