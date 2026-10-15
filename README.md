<p align="center">
  <img src="apps/web/public/icon.svg" width="96" alt="청량리 과일 시세">
</p>
<p align="center">
  <b>청량리 과일 시세</b> — 어느 가게에서, 어떤 과일을, 얼마에.
</p>
<p align="center">
  <a href="https://github.com/DWL21/fruit-info/actions/workflows/ci.yml"><img src="https://github.com/DWL21/fruit-info/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/DWL21/fruit-info/actions/workflows/deploy.yml"><img src="https://github.com/DWL21/fruit-info/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6" alt="TypeScript">
  <img src="https://img.shields.io/badge/node-22-339933" alt="Node 22">
</p>

---

**서비스**: <a href="https://fruit.simplyimg.com">https://fruit.simplyimg.com</a>

**API**: <a href="https://fruit-api.simplyimg.com/api/health">https://fruit-api.simplyimg.com</a>

**문서**: [`docs/PLAN.md`](docs/PLAN.md) · [`AGENTS.md`](AGENTS.md) · [`DESIGN.md`](DESIGN.md)

---

서울 동대문구 청량리 청과물시장의 가게별 과일 가격을 **진열 사진과 가격표 사진**으로 보여주는 모바일 웹입니다.

운영자가 시장 통로를 따라 가게마다 셔터를 누르면, 서버가 사진에서 과일·가격·단위·가격표 위치를 읽어 자동으로 게시합니다.

주요 특징:

* **과일별 시세**: 과일을 고르면 가게별 가격이 싼 순으로, 각 항목마다 진열 상품과 가격표가 함께 보이는 사진으로.
* **시장 지도**: 제기동역 ↔ 청량리역 방향의 본통로와 세로 통로 2개, 양쪽 가판대를 그대로 옮긴 고정 지도에 가격 표시.
* **원본 근거**: 원본 사진 위에 가격표·진열 위치를 표시. 얼굴은 흐림 처리.
* **촬영 모드**: 가게가 동선 순서대로 자동 선택되고, 셔터만 누르면 백그라운드로 업로드·분석.
* **실시간**: 새 시세가 게시되면 SSE로 열려 있는 화면에 바로 반영.

## Requirements

* Node.js 22+
* pnpm 10+
* (운영 분석) 서버에 로그인된 [Codex CLI](https://developers.openai.com/codex)

## Installation

```console
$ git clone https://github.com/DWL21/fruit-info.git
$ cd fruit-info
$ pnpm install
```

## Example

### 실행

```console
$ cp apps/api/.env.example apps/api/.env
$ pnpm dev
```

* 웹: http://localhost:5173
* API: http://localhost:8787/api/health

`ANALYZER=mock`이면 고정된 분석 결과로 전체 흐름을 확인할 수 있습니다.

### 가게 등록과 사진 업로드

```console
$ curl -X POST localhost:8787/api/admin/stores \
    -H "x-upload-key: $UPLOAD_KEY" -H "content-type: application/json" \
    -d '{"name":"한농상회","aisle":"main","position":3,"side":"A"}'

$ curl -X POST localhost:8787/api/admin/photos \
    -H "x-upload-key: $UPLOAD_KEY" \
    -F photo=@stall.jpg -F storeId=1
```

### 시세 조회

```console
$ curl localhost:8787/api/items/mandarin
```

```json
{
  "data": {
    "item": { "slug": "mandarin", "name": "귤", "emoji": "🍊" },
    "observations": [
      { "storeName": "한농상회", "storeAisle": "main", "storePosition": 3, "storeSide": "A",
        "price": 3000, "unit": "1줄", "cropUrl": "https://fruit-api.simplyimg.com/media/crops/12.jpg" }
    ]
  }
}
```

## API

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/items` | 과일별 최저가 요약 |
| `GET` | `/api/items/{slug}` | 과일의 가게별 가격, 날짜별 최저가 |
| `GET` | `/api/stores` | 가게 목록 (동선 순) |
| `GET` | `/api/stores/{id}` | 가게의 과일 가격과 매대 사진 |
| `GET` | `/api/photos/{id}` | 매대 사진과 가격표·진열 위치 |
| `GET` | `/api/stream` | 시세 갱신 이벤트 (SSE) |
| `POST` | `/api/admin/photos` | 사진 업로드 (`x-upload-key`) |
| `POST` | `/api/admin/stores` | 가게 추가 (`x-upload-key`) |

## Stack

| | |
|---|---|
| Web | React 19 · Vite · Tailwind CSS v4 · TanStack Query → Cloudflare Pages |
| API | Hono · Node 22 · SQLite (better-sqlite3) · sharp → Docker on self-hosted server, Cloudflare Tunnel |
| 분석 | Codex CLI `gpt-6.1-sol` (도구 비활성화, 구조화 출력) |

## Development

이슈 → `feat/<번호>` 브랜치 → PR → main 머지 → 자동 배포. 자세한 규칙은 [`AGENTS.md`](AGENTS.md).

```console
$ pnpm check   # typecheck + test + build
```

## License

MIT
