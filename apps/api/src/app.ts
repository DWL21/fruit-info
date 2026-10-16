import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { CATALOG, ObservationPatch, StoreInput, type LiveEvent } from '@fruit/shared';
import { config } from './config.ts';
import { db, now } from './db.ts';
import { live } from './live.ts';
import { cropPath, makePreview, photoPath, previewPath, saveOriginal } from './media.ts';
import { kickQueue } from './queue.ts';
import * as repo from './repo.ts';
import { capture } from './monitor.ts';
import { isLocked, recordFail, recordSuccess } from './lockout.ts';

const fail = (c: Context, status: 400 | 401 | 404 | 413 | 415 | 429 | 503, code: string, message: string) =>
  c.json({ error: { code, message } }, status);

function isOperator(key: string | undefined) {
  if (!config.uploadKey || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(config.uploadKey);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const app = new Hono();

app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
app.use('/api/*', cors({ origin: config.corsOrigins, allowHeaders: ['content-type', 'x-upload-key'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
app.onError((err, c) => {
  console.error(err);
  capture(err, { path: c.req.path });
  return c.json({ error: { code: 'internal', message: '요청을 처리하지 못했습니다.' } }, 500);
});

app.get('/api/health', (c) => {
  const queue = db.prepare(`SELECT status, COUNT(*) AS n FROM photos GROUP BY status`).all() as { status: string; n: number }[];
  return c.json({ data: { ok: true, analyzer: config.analyzer, queue: Object.fromEntries(queue.map((q) => [q.status, q.n])), listeners: live.size } });
});

// ---------- 공개 조회 ----------
app.get('/api/catalog', (c) => c.json({ data: CATALOG.map(({ slug, name, emoji }) => ({ slug, name, emoji })) }));
app.get('/api/items', (c) => c.json({ data: repo.itemSummaries() }));
app.get('/api/items/:slug', (c) => {
  const item = CATALOG.find((i) => i.slug === c.req.param('slug'));
  if (!item) return fail(c, 404, 'not_found', '없는 과일입니다.');
  return c.json({
    data: {
      item: { slug: item.slug, name: item.name, emoji: item.emoji },
      observations: repo.currentObservations({ itemSlug: item.slug }),
      history: repo.itemHistory(item.slug),
    },
  });
});
// North Star: 최근 4시간 안에 사진 근거가 있는 가게×과일 시세 수
app.get('/api/metrics', (c) => {
  const since4h = new Date(Date.now() - 4 * 3600_000).toISOString();
  const kstToday = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const todayStart = new Date(`${kstToday}T00:00:00+09:00`).toISOString();
  const one = (sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) as Record<string, number | null>;
  const pub = `photo_id IN (SELECT id FROM photos WHERE sample = 0)`;
  const fresh = one(`SELECT COUNT(DISTINCT store_id || ':' || item_slug) AS n FROM observations WHERE hidden = 0 AND ${pub} AND observed_at >= ?`, since4h);
  const today = one(`SELECT COUNT(DISTINCT store_id || ':' || item_slug) AS pairs, COUNT(DISTINCT store_id) AS stores, COUNT(DISTINCT item_slug) AS items FROM observations WHERE hidden = 0 AND ${pub} AND observed_at >= ?`, todayStart);
  const photos = one(
    `SELECT COUNT(*) AS total, SUM(status = 'done') AS done, SUM(status = 'failed') AS failed, AVG(CASE WHEN status = 'done' THEN duration_ms END) AS avg_ms FROM photos WHERE sample = 0 AND taken_at >= ?`,
    todayStart,
  );
  const storesTotal = one(`SELECT COUNT(*) AS n FROM stores WHERE active = 1`);
  return c.json({
    data: {
      northStar: fresh.n ?? 0,
      today: { pairs: today.pairs ?? 0, stores: today.stores ?? 0, items: today.items ?? 0, storesTotal: storesTotal.n ?? 0 },
      photosToday: { total: photos.total ?? 0, done: photos.done ?? 0, failed: photos.failed ?? 0, avgSeconds: photos.avg_ms ? Math.round(photos.avg_ms / 1000) : null },
    },
  });
});
app.get('/api/stores', (c) => c.json({ data: repo.listStores() }));
app.get('/api/stores/:id', (c) => {
  const store = repo.getStore(Number(c.req.param('id')));
  if (!store) return fail(c, 404, 'not_found', '없는 가게입니다.');
  return c.json({
    data: {
      store,
      observations: repo.currentObservations({ storeId: store.id }),
      photos: repo.listPhotos({ storeId: store.id, status: 'done', limit: 12, publicOnly: true }),
    },
  });
});
// 홈 피드: 최신 매대 사진. 분석 전 사진은 흐린 미리보기로 바로 보인다.
app.get('/api/feed', (c) => {
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit') ?? 12)));
  const before = c.req.query('before');
  return c.json({ data: repo.feed(limit, before) });
});
app.get('/api/photos/:id', (c) => {
  const photo = repo.getPhoto(c.req.param('id'));
  if (!photo || photo.status !== 'done' || repo.isSample(photo.id)) return fail(c, 404, 'not_found', '없는 사진입니다.');
  return c.json({ data: { photo, observations: repo.photoObservations(photo.id) } });
});

app.get('/api/stream', (c) =>
  streamSSE(c, async (stream) => {
    const queue: LiveEvent[] = [];
    let wake: (() => void) | null = null;
    const off = live.subscribe((e) => {
      queue.push(e);
      wake?.();
    });
    stream.onAbort(() => {
      off();
      wake?.();
    });
    await stream.writeSSE({ event: 'ready', data: '{}' });
    while (!stream.aborted) {
      const e = queue.shift();
      if (e) {
        // 공개 스트림에는 게시 완료된 정보만 보낸다.
        if (e.type === 'prices') await stream.writeSSE({ event: 'prices', data: JSON.stringify(e) });
        if (e.type === 'feed') await stream.writeSSE({ event: 'feed', data: JSON.stringify(e) });
        continue;
      }
      await Promise.race([new Promise<void>((r) => (wake = r)), stream.sleep(25_000)]);
      wake = null;
      if (!queue.length && !stream.aborted) await stream.writeSSE({ event: 'ping', data: '' });
    }
  }),
);

// ---------- 사진 파일 ----------
function sendJpeg(c: Context, path: string) {
  if (!existsSync(path)) return fail(c, 404, 'not_found', '없는 파일입니다.');
  const { size } = statSync(path);
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
    headers: {
      'content-type': 'image/jpeg',
      'content-length': String(size),
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*',
    },
  });
}
const safeId = (s: string) => s.replace(/\.jpg$/, '').replace(/[^a-zA-Z0-9-]/g, '');
app.get('/media/photos/:file', (c) => sendJpeg(c, photoPath(safeId(c.req.param('file')))));
app.get('/media/previews/:file', (c) => sendJpeg(c, previewPath(safeId(c.req.param('file')))));
app.get('/media/crops/:file', (c) => sendJpeg(c, cropPath(Number(safeId(c.req.param('file'))))));

// ---------- 운영자 ----------
const admin = new Hono();
// 터널·nginx 뒤라 실제 접속지는 Cloudflare 헤더로 판단한다.
const clientIp = (c: Context) => c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

admin.use('*', async (c, next) => {
  const ip = clientIp(c);
  if (isLocked(ip)) return fail(c, 429, 'locked', '잠시 후 다시 시도하세요.');
  if (!isOperator(c.req.header('x-upload-key'))) {
    recordFail(ip);
    return fail(c, 401, 'unauthorized', '촬영 키가 올바르지 않습니다.');
  }
  recordSuccess(ip);
  await next();
});

admin.post('/verify', (c) => c.json({ data: { ok: true } }));

admin.post('/stores', async (c) => {
  const parsed = StoreInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 400, 'invalid', parsed.error.issues[0]?.message ?? '입력을 확인하세요.');
  const { name, aisle, position, side, address, stallNo, note } = parsed.data;
  const row = db.prepare('INSERT INTO stores (name, aisle, position, side, address, stall_no, note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id').get(name, aisle, position, side, address ?? null, stallNo || null, note ?? null) as { id: number };
  return c.json({ data: repo.getStore(row.id) }, 201);
});

admin.patch('/stores/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const parsed = StoreInput.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 400, 'invalid', parsed.error.issues[0]?.message ?? '입력을 확인하세요.');
  const cur = db.prepare('SELECT * FROM stores WHERE id = ?').get(id) as { name: string; aisle: string; position: number; side: string; address: string | null; stall_no: string | null; note: string | null } | undefined;
  if (!cur) return fail(c, 404, 'not_found', '없는 가게입니다.');
  const v = { ...cur, ...Object.fromEntries(Object.entries(parsed.data).filter(([, x]) => x !== undefined)) };
  const stallNo = parsed.data.stallNo !== undefined ? parsed.data.stallNo || null : cur.stall_no;
  db.prepare('UPDATE stores SET name = ?, aisle = ?, position = ?, side = ?, address = ?, stall_no = ?, note = ? WHERE id = ?').run(v.name, v.aisle, v.position, v.side, v.address ?? null, stallNo, v.note ?? null, id);
  return c.json({ data: repo.getStore(id) });
});

admin.delete('/stores/:id', (c) => {
  db.prepare('UPDATE stores SET active = 0 WHERE id = ?').run(Number(c.req.param('id')));
  return c.json({ data: { ok: true } });
});

admin.post('/photos', async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('photo');
  const storeId = Number(form?.get('storeId'));
  const takenAtRaw = String(form?.get('takenAt') ?? '');
  const autoStore = form?.get('autoStore') === '1' ? 1 : 0;
  // 평가용 업로드: 같은 파이프라인을 타지만 공개 화면에는 나오지 않는다.
  const sample = form?.get('sample') === '1' ? 1 : 0;
  if (!(file instanceof File)) return fail(c, 400, 'invalid', '사진이 없습니다.');
  if (file.size > 15_000_000) return fail(c, 413, 'too_large', '사진이 너무 큽니다 (15MB 이하).');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return fail(c, 415, 'unsupported', '지원하지 않는 사진 형식입니다.');
  if (!repo.getStore(storeId)) return fail(c, 400, 'invalid', '가게를 선택하세요.');
  const takenAt = !Number.isNaN(Date.parse(takenAtRaw)) && Math.abs(Date.parse(takenAtRaw) - Date.now()) < 7 * 86400_000 ? new Date(takenAtRaw).toISOString() : now();

  const id = randomUUID();
  const { width, height } = await saveOriginal(id, Buffer.from(await file.arrayBuffer())).catch(() => ({ width: 0, height: 0 }));
  if (!width) return fail(c, 415, 'unsupported', '사진을 읽을 수 없습니다.');
  await makePreview(id).catch(() => undefined);
  db.prepare('INSERT INTO photos (id, store_id, width, height, taken_at, auto_store, sample) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, storeId, width, height, takenAt, autoStore, sample);
  if (!sample) live.publish({ type: 'feed', photoId: id });
  kickQueue();
  return c.json({ data: repo.getPhoto(id) }, 202);
});

admin.get('/photos', (c) => c.json({ data: repo.listPhotos({ limit: Number(c.req.query('limit') ?? 40), publicOnly: c.req.query('sample') !== '1', sample: c.req.query('sample') === '1' }) }));
admin.get('/photos/:id', (c) => {
  const photo = repo.getPhoto(c.req.param('id'));
  if (!photo) return fail(c, 404, 'not_found', '없는 사진입니다.');
  return c.json({ data: { photo, observations: repo.photoObservations(photo.id, true) } });
});
// 사진을 다른 가게로 옮긴다(간판 인식이 틀렸거나 수동으로 고칠 때).
admin.patch('/photos/:id', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { storeId?: number } | null;
  const storeId = Number(body?.storeId);
  if (!repo.getStore(storeId)) return fail(c, 400, 'invalid', '가게를 선택하세요.');
  const id = c.req.param('id');
  const before = db.prepare('SELECT store_id FROM photos WHERE id = ?').get(id) as { store_id: number } | undefined;
  if (!before) return fail(c, 404, 'not_found', '없는 사진입니다.');
  db.transaction(() => {
    db.prepare('UPDATE photos SET store_id = ? WHERE id = ?').run(storeId, id);
    db.prepare('UPDATE observations SET store_id = ? WHERE photo_id = ?').run(storeId, id);
  })();
  const slugs = (db.prepare('SELECT DISTINCT item_slug FROM observations WHERE photo_id = ?').pluck().all(id) as string[]);
  for (const sid of new Set([before.store_id, storeId])) live.publish({ type: 'prices', storeId: sid, itemSlugs: slugs });
  return c.json({ data: repo.getPhoto(id) });
});
admin.post('/photos/:id/reanalyze', (c) => {
  const r = db.prepare(`UPDATE photos SET status = 'queued', attempts = 0, error = NULL WHERE id = ? AND status IN ('done','failed')`).run(c.req.param('id'));
  if (!r.changes) return fail(c, 404, 'not_found', '다시 분석할 수 없는 사진입니다.');
  kickQueue();
  return c.json({ data: repo.getPhoto(c.req.param('id')) });
});

admin.patch('/observations/:id', async (c) => {
  const parsed = ObservationPatch.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 400, 'invalid', parsed.error.issues[0]?.message ?? '입력을 확인하세요.');
  const id = Number(c.req.param('id'));
  const { hidden, review, itemSlug, price, unit } = parsed.data;
  if (itemSlug && !CATALOG.some((i) => i.slug === itemSlug)) return fail(c, 400, 'invalid', '없는 과일입니다.');
  const row = db.prepare('SELECT store_id, item_slug FROM observations WHERE id = ?').get(id) as { store_id: number; item_slug: string } | undefined;
  if (!row) return fail(c, 404, 'not_found', '없는 시세입니다.');
  db.prepare(
    `UPDATE observations SET hidden = COALESCE(?, hidden), review = COALESCE(?, review), item_slug = COALESCE(?, item_slug), price = COALESCE(?, price),
     unit = CASE WHEN ? THEN ? ELSE unit END WHERE id = ?`,
  ).run(hidden === undefined ? null : Number(hidden), review === undefined ? null : Number(review), itemSlug ?? null, price ?? null, unit !== undefined ? 1 : 0, unit ?? null, id);
  live.publish({ type: 'prices', storeId: row.store_id, itemSlugs: [...new Set([row.item_slug, itemSlug].filter((s): s is string => !!s))] });
  return c.json({ data: { ok: true } });
});

app.route('/api/admin', admin);
app.notFound((c) => fail(c, 404, 'not_found', '없는 주소입니다.'));
