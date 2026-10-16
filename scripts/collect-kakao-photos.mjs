#!/usr/bin/env node
// 등록된 가게(apps/api/seed/stores.tsv)의 카카오맵 장소 사진 URL을 모아 실제 업로드 평가 매니페스트를 만든다.
// 사진 자체는 저장하지 않는다(저작권). URL·등록일·정답 가게만 남긴다.
//   node scripts/collect-kakao-photos.mjs > apps/api/eval/e2e.json
import { readFile } from 'node:fs/promises';

const tsv = await readFile(new URL('../apps/api/seed/stores.tsv', import.meta.url), 'utf8');
const [, ...lines] = tsv.trim().split('\n');
const stores = lines.map((l) => {
  const [kakaoId, name, address, , , , , , stallNo] = l.split('\t');
  return { kakaoId, name, address, stallNo: stallNo || null };
});

const out = [];
for (const s of stores) {
  const res = await fetch(`https://place.map.kakao.com/places/panel3/${s.kakaoId}`, {
    headers: { pf: 'PW', Accept: 'application/json', Referer: 'https://place.map.kakao.com/', 'User-Agent': 'Mozilla/5.0' },
  }).catch(() => null);
  const j = res?.ok ? await res.json().catch(() => null) : null;
  for (const p of j?.photos?.photos ?? []) {
    if (!p.url) continue;
    out.push({
      id: `kakao-${s.kakaoId}-${out.filter((o) => o.store === s.name).length + 1}`,
      store: s.name,
      kakaoId: s.kakaoId,
      url: p.url,
      registeredAt: p.registered_at,
      source: p.type,
    });
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log(JSON.stringify(out, null, 2));
console.error(`가게 ${new Set(out.map((o) => o.store)).size}곳, 사진 ${out.length}장`);
