#!/usr/bin/env node
// 실제 업로드 경로로 평가한다: 사진을 평가용(sample)으로 올리고 → 간판 자동 배정·분석·확인 대기까지 거친 결과를 채점한다.
// 평가용 사진은 공개 화면(피드·시세·지도)에 나오지 않는다.
//
//   API=http://127.0.0.1:8081 UPLOAD_KEY=... node scripts/eval-e2e.mjs apps/api/eval/e2e.json [보고서.md]
//
// 매니페스트: [{ id, url, store: "정답 가게 이름", stallNo?, prices?: [{ item, price }] }]
import { readFile, writeFile } from 'node:fs/promises';

const API = process.env.API ?? 'http://127.0.0.1:8081';
const KEY = process.env.UPLOAD_KEY;
if (!KEY) throw new Error('UPLOAD_KEY가 필요합니다');
const [manifestPath, outPath] = process.argv.slice(2);
const samples = JSON.parse(await readFile(manifestPath, 'utf8'));
const H = { 'x-upload-key': KEY };
const norm = (s) => (s ?? '').replace(/\s/g, '');

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${body?.error?.message ?? ''}`);
  return body.data;
}

const stores = await api('/api/stores');
// 일부러 정답과 다른 가게를 고른 채 올려, 간판 인식으로 맞게 옮겨지는지 본다.
const decoy = stores[0];

const results = [];
const CONCURRENT_UPLOADS = 4;
for (let i = 0; i < samples.length; i += CONCURRENT_UPLOADS) {
  await Promise.all(
    samples.slice(i, i + CONCURRENT_UPLOADS).map(async (s) => {
      try {
        const img = await fetch(s.url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://blog.naver.com/' } });
        if (!img.ok) throw new Error(`이미지 ${img.status}`);
        const form = new FormData();
        form.set('photo', new File([await img.arrayBuffer()], 'p.jpg', { type: img.headers.get('content-type')?.startsWith('image/') ? img.headers.get('content-type') : 'image/jpeg' }));
        form.set('storeId', String(decoy.id));
        form.set('autoStore', '1');
        form.set('sample', '1');
        const photo = await api('/api/admin/photos', { method: 'POST', body: form });
        results.push({ s, photoId: photo.id });
      } catch (e) {
        results.push({ s, error: e.message });
      }
    }),
  );
}
console.error(`업로드 ${results.filter((r) => r.photoId).length}/${samples.length}, 분석 대기…`);

// 분석이 끝날 때까지 기다린다 (사진당 최대 5분)
const deadline = Date.now() + Math.max(10, samples.length) * 60_000;
for (const r of results.filter((x) => x.photoId)) {
  while (Date.now() < deadline) {
    const { photo, observations } = await api(`/api/admin/photos/${r.photoId}`);
    if (photo.status === 'done' || photo.status === 'failed') {
      r.photo = photo;
      r.obs = observations;
      break;
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
}

let assignedOk = 0, signRead = 0, signReadOk = 0, failed = 0, done = 0, items = 0, review = 0, durations = [];
let tp = 0, fn = 0, labeled = 0;
const rows = [];
for (const r of results) {
  if (!r.photo) {
    rows.push(`| ${r.s.id} | ${r.s.store} | 오류 | | | ${r.error ?? '시간 초과'} |`);
    failed++;
    continue;
  }
  const p = r.photo;
  if (p.status === 'failed') failed++;
  else done++;
  if (p.durationMs) durations.push(p.durationMs);
  const ok = norm(p.storeName) === norm(r.s.store);
  if (ok) assignedOk++;
  if (p.readStoreName) {
    signRead++;
    if (norm(p.readStoreName) === norm(r.s.store)) signReadOk++;
  }
  items += p.itemCount;
  review += p.reviewCount;
  let hit = '';
  if (r.s.prices?.length) {
    labeled++;
    const got = [...(r.obs ?? [])];
    let h = 0;
    for (const e of r.s.prices) {
      const i = got.findIndex((o) => o.itemSlug === e.item && o.price === e.price);
      if (i >= 0) {
        h++;
        got.splice(i, 1);
      }
    }
    tp += h;
    fn += r.s.prices.length - h;
    hit = `${h}/${r.s.prices.length}`;
  }
  rows.push(`| ${r.s.id} | ${r.s.store} | ${p.storeName}${ok ? '' : ' ✗'} | ${p.readStoreName ?? '—'} | ${p.itemCount}+${p.reviewCount} | ${hit} |`);
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : 0;
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const report = `# 실제 업로드 평가 ${today}

운영 업로드 경로(간판 자동 배정 켬, 일부러 다른 가게 '${decoy.name}'를 고른 채 업로드, 평가용 표시로 공개 화면 제외). 사진 ${samples.length}장.

| 지표 | 값 |
|---|---|
| 분석 완료 | ${done}/${samples.length} (실패 ${failed}) |
| 정답 가게로 배정 | **${pct(assignedOk, samples.length)}** (${assignedOk}/${samples.length}) |
| 간판을 읽은 사진 | ${pct(signRead, samples.length)} (${signRead}) |
| 읽은 간판이 정답 가게 | ${pct(signReadOk, signRead)} (${signReadOk}/${signRead}) |
| 공개 시세 / 확인 대기 | ${items} / ${review} |
| 가격 재현율 (라벨 ${labeled}장) | ${pct(tp, tp + fn)} (${tp}/${tp + fn}) |
| 평균 분석 시간 | ${avg}초 |

| 샘플 | 정답 가게 | 배정 | 읽은 간판 | 시세+대기 | 가격 |
|---|---|---|---|---|---|
${rows.join('\n')}
`;
if (outPath) await writeFile(outPath, report);
console.log(report);
