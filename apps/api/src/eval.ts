// 실제 시장 사진으로 분석 정확도를 잰다. 서버 컨테이너에서 실행: node --import tsx src/eval.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { matchCatalog } from '@fruit/shared';
import { analyze } from './analyzer.ts';
import { needsReview } from './publish.ts';

interface Sample {
  id: string;
  store: string;
  url: string;
  source: string;
  expect: { storeName: string | null; prices: { item: string; price: number }[] };
}

const norm = (s: string | null) => (s ?? '').replace(/\s/g, '');

async function fetchImage(url: string, dir: string, id: string) {
  const path = join(dir, `${id}.jpg`);
  if (!existsSync(path)) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://blog.naver.com/' } });
    if (!res.ok) throw new Error(`이미지 받기 실패 ${res.status}`);
    await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(path);
  }
  return path;
}

const { samples } = JSON.parse(await readFile(new URL('../eval/dataset.json', import.meta.url), 'utf8')) as { samples: Sample[] };
const cache = join(process.env.EVAL_CACHE ?? tmpdir(), 'fruit-eval');
await mkdir(cache, { recursive: true });

let tp = 0, fn = 0, fp = 0, storeOk = 0, storeTotal = 0, negFp = 0, negTotal = 0, held = 0;
const durations: number[] = [];
const lines: string[] = [];
for (const s of samples) {
  try {
    const path = await fetchImage(s.url, cache, s.id);
    const r = await analyze(path, s.store);
    durations.push(r.durationMs);
    // 공개되는 항목만 채점한다. 확인 대기 항목은 따로 센다.
    held += r.analysis.items.filter((it) => needsReview(it)).length;
    const got = r.analysis.items
      .filter((it) => !needsReview(it))
      .map((it) => ({ item: matchCatalog(it.name, it.variety)?.slug ?? null, price: it.price, raw: `${it.name}${it.variety ? `(${it.variety})` : ''} ${it.price ?? '?'}` }))
      .filter((g) => g.item && g.price);
    const left = [...got];
    let hit = 0;
    for (const e of s.expect.prices) {
      const i = left.findIndex((g) => g.item === e.item && g.price === e.price);
      if (i >= 0) {
        hit++;
        left.splice(i, 1);
      }
    }
    tp += hit;
    fn += s.expect.prices.length - hit;
    if (s.expect.prices.length) fp += left.length;
    else {
      negTotal++;
      if (got.length) negFp++;
    }
    if (s.expect.storeName) {
      storeTotal++;
      if (norm(r.analysis.store_name) === norm(s.expect.storeName)) storeOk++;
    }
    lines.push(`| ${s.id} | ${hit}/${s.expect.prices.length} | ${left.length} | ${r.analysis.store_name ?? '—'} | ${Math.round(r.durationMs / 1000)}s | ${got.map((g) => g.raw).join(', ') || '—'} |`);
  } catch (e) {
    lines.push(`| ${s.id} | 오류 | | | | ${e instanceof Error ? e.message : e} |`);
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const report = `# 분석 정확도 평가 ${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}

- 모델: ${process.env.CODEX_MODEL ?? 'mock'} · 샘플 ${samples.length}장
- 가격표 재현율(정답 중 맞춘 비율): **${pct(tp, tp + fn)}** (${tp}/${tp + fn})
- 정밀도(뽑은 것 중 정답): **${pct(tp, tp + fp)}** — 정답에 없는 추가 검출 ${fp}건(배경 가격표 포함)
- 간판 인식: **${pct(storeOk, storeTotal)}** (${storeOk}/${storeTotal})
- 가격표 없는 사진 오탐: ${negFp}/${negTotal}
- 운영자 확인 대기(공개 안 함): ${held}건
- 평균 분석 시간: ${durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : '—'}초

| 샘플 | 맞춤 | 추가 | 읽은 간판 | 시간 | 읽은 시세 |
|---|---|---|---|---|---|
${lines.join('\n')}
`;
const out = process.env.EVAL_OUT;
if (out) await writeFile(out, report);
console.log(report);
