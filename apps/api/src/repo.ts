import { CATALOG, VISIBLE_DAYS, walkKey, type Aisle, type Box, type ItemSummary, type Observation, type Photo, type Store } from '@fruit/shared';
import { db } from './db.ts';
import { cropUrl, photoUrl } from './media.ts';

const parseBox = (s: string | null): Box | null => (s ? (JSON.parse(s) as Box) : null);
const since = () => new Date(Date.now() - VISIBLE_DAYS * 86400_000).toISOString();

interface ObsRow {
  id: number; item_slug: string; store_id: number; store_name: string; aisle: Aisle; position: number; side: 'A' | 'B'; address: string | null;
  raw_name: string; variety: string | null; price: number; unit: string | null; confidence: number;
  photo_id: string; crop: number; price_box: string | null; product_box: string | null; observed_at: string; review?: number;
}

const toObservation = (r: ObsRow): Observation => ({
  id: r.id,
  itemSlug: r.item_slug,
  storeId: r.store_id,
  storeName: r.store_name,
  storeAisle: r.aisle,
  storePosition: r.position,
  storeSide: r.side,
  storeAddress: r.address,
  rawName: r.raw_name,
  variety: r.variety,
  price: r.price,
  unit: r.unit,
  confidence: r.confidence,
  ...(r.review ? { review: true } : {}),
  photoId: r.photo_id,
  photoUrl: photoUrl(r.photo_id),
  cropUrl: r.crop ? cropUrl(r.id) : null,
  priceBox: parseBox(r.price_box),
  productBox: parseBox(r.product_box),
  observedAt: r.observed_at,
});

/**
 * 현재 시세: 가게×과일마다 가장 최근 촬영 시점(2시간 이내 묶음)의 관측만 쓴다.
 * 같은 묶음 안에서 같은 품종·가격·단위는 한 번만 보여준다.
 */
const CURRENT_SQL = `
  WITH visible AS (
    SELECT o.* FROM observations o
    WHERE o.hidden = 0 AND o.observed_at >= @since
      AND o.photo_id IN (SELECT id FROM photos WHERE sample = 0)
  ),
  latest AS (
    SELECT store_id, item_slug, MAX(observed_at) AS last_at FROM visible GROUP BY store_id, item_slug
  ),
  current AS (
    SELECT v.* FROM visible v JOIN latest l ON l.store_id = v.store_id AND l.item_slug = v.item_slug
    WHERE v.observed_at >= strftime('%Y-%m-%dT%H:%M:%fZ', l.last_at, '-2 hours')
  ),
  dedup AS (
    SELECT c.*, ROW_NUMBER() OVER (
      PARTITION BY c.store_id, c.item_slug, IFNULL(c.variety,''), c.price, IFNULL(c.unit,'') ORDER BY c.observed_at DESC, c.id DESC
    ) AS rn FROM current c
  )
  SELECT d.id, d.item_slug, d.store_id, s.name AS store_name, s.aisle, s.position, s.side, s.address, d.raw_name, d.variety, d.price, d.unit,
         d.confidence, d.photo_id, d.crop, d.price_box, d.product_box, d.observed_at
  FROM dedup d JOIN stores s ON s.id = d.store_id
  WHERE d.rn = 1 AND s.active = 1`;

export function currentObservations(filter: { itemSlug?: string; storeId?: number } = {}): Observation[] {
  const where: string[] = [];
  if (filter.itemSlug) where.push('item_slug = @itemSlug');
  if (filter.storeId) where.push('store_id = @storeId');
  const sql = `SELECT * FROM (${CURRENT_SQL}) ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY price ASC, observed_at DESC`;
  return (db.prepare(sql).all({ since: since(), ...filter }) as ObsRow[]).map(toObservation);
}

export function itemSummaries(): ItemSummary[] {
  const byItem = new Map<string, Observation[]>();
  for (const o of currentObservations()) byItem.set(o.itemSlug, [...(byItem.get(o.itemSlug) ?? []), o]);
  const out: ItemSummary[] = [];
  for (const item of CATALOG) {
    const list = byItem.get(item.slug);
    if (!list?.length) continue;
    const min = list[0]!; // price ASC
    out.push({
      slug: item.slug,
      name: item.name,
      emoji: item.emoji,
      minPrice: min.price,
      minUnit: min.unit,
      minStoreName: min.storeName,
      storeCount: new Set(list.map((o) => o.storeId)).size,
      cropUrl: min.cropUrl,
      lastObservedAt: list.map((o) => o.observedAt).sort().at(-1)!,
    });
  }
  return out.sort((a, b) => b.storeCount - a.storeCount || b.lastObservedAt.localeCompare(a.lastObservedAt));
}

interface StoreRow { id: number; name: string; aisle: Aisle; position: number; side: 'A' | 'B'; address: string | null; stall_no: string | null; note: string | null; last_photo_at: string | null }

export function listStores(): Store[] {
  const counts = new Map<number, number>();
  for (const o of currentObservations()) counts.set(o.storeId, (counts.get(o.storeId) ?? 0) + 1);
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.aisle, s.position, s.side, s.address, s.stall_no, s.note,
              (SELECT MAX(taken_at) FROM photos p WHERE p.store_id = s.id AND p.status = 'done' AND p.sample = 0) AS last_photo_at
       FROM stores s WHERE s.active = 1`,
    )
    .all() as StoreRow[];
  return rows
    .map((r) => ({
      id: r.id, name: r.name, aisle: r.aisle, position: r.position, side: r.side, address: r.address, stallNo: r.stall_no, note: r.note,
      itemCount: counts.get(r.id) ?? 0, lastPhotoAt: r.last_photo_at,
    }))
    .sort((a, b) => walkKey(a) - walkKey(b));
}

export const getStore = (id: number) => listStores().find((s) => s.id === id) ?? null;

interface PhotoRow {
  id: string; store_id: number; store_name: string; width: number; height: number; status: Photo['status'];
  read_store_name: string | null; item_count: number; review_count: number; error: string | null; duration_ms: number | null; taken_at: string; held: number; likes: number;
}

const PHOTO_SQL = `SELECT p.id, p.store_id, s.name AS store_name, p.width, p.height, p.status, p.read_store_name, p.error,
  p.duration_ms, p.taken_at, p.held, (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id) AS likes, (SELECT COUNT(*) FROM observations o WHERE o.photo_id = p.id AND o.hidden = 0) AS item_count,
  (SELECT COUNT(*) FROM observations o WHERE o.photo_id = p.id AND o.review = 1) AS review_count
  FROM photos p JOIN stores s ON s.id = p.store_id`;

const toPhoto = (r: PhotoRow): Photo => ({
  id: r.id, storeId: r.store_id, storeName: r.store_name, url: photoUrl(r.id), width: r.width, height: r.height,
  status: r.status, readStoreName: r.read_store_name, itemCount: r.item_count, reviewCount: r.review_count, error: r.error,
  durationMs: r.duration_ms, takenAt: r.taken_at, held: !!r.held, likes: r.likes,
});

export function isSample(id: string): boolean {
  return !!(db.prepare('SELECT sample FROM photos WHERE id = ?').pluck().get(id) as number | undefined);
}

export function getPhoto(id: string): Photo | null {
  const row = db.prepare(`${PHOTO_SQL} WHERE p.id = ?`).get(id) as PhotoRow | undefined;
  return row ? toPhoto(row) : null;
}

/** publicOnly: 평가용(sample) 사진을 뺀다 */
export function listPhotos(opts: { storeId?: number; status?: 'done'; limit?: number; publicOnly?: boolean; sample?: boolean; hideHeld?: boolean } = {}): Photo[] {
  const where: string[] = [];
  if (opts.publicOnly) where.push('p.sample = 0');
  if (opts.hideHeld) where.push('p.held = 0');
  if (opts.sample) where.push('p.sample = 1');
  if (opts.storeId) where.push('p.store_id = @storeId');
  if (opts.status) where.push('p.status = @status');
  const sql = `${PHOTO_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.taken_at DESC LIMIT @limit`;
  return (db.prepare(sql).all({ storeId: opts.storeId, status: opts.status, limit: opts.limit ?? 30 }) as PhotoRow[]).map(toPhoto);
}

/** includeReview: 운영자 화면에서 확인 대기 항목도 함께 본다. */
export function photoObservations(photoId: string, includeReview = false): Observation[] {
  const rows = db
    .prepare(
      `SELECT o.id, o.item_slug, o.store_id, s.name AS store_name, s.aisle, s.position, s.side, s.address, o.raw_name, o.variety, o.price, o.unit,
              o.confidence, o.photo_id, o.crop, o.price_box, o.product_box, o.observed_at, o.review
       FROM observations o JOIN stores s ON s.id = o.store_id
       WHERE o.photo_id = ? AND (o.hidden = 0 OR (? AND o.review = 1)) ORDER BY o.review DESC, o.id`,
    )
    .all(photoId, includeReview ? 1 : 0) as ObsRow[];
  return rows.map(toObservation);
}

/** 과일별 가격 이력 (가게·일 단위 최저가) */
export function itemHistory(itemSlug: string) {
  return db
    .prepare(
      `SELECT substr(datetime(observed_at, '+9 hours'), 1, 10) AS day, MIN(price) AS min_price, COUNT(DISTINCT store_id) AS stores
       FROM observations WHERE item_slug = ? AND hidden = 0 AND photo_id IN (SELECT id FROM photos WHERE sample = 0) GROUP BY day ORDER BY day DESC LIMIT 30`,
    )
    .all(itemSlug) as { day: string; min_price: number; stores: number }[];
}

/** 게시된(분석 완료·보류 아님·평가용 아님) 사진인지 */
export function isPublished(id: string): boolean {
  return !!db.prepare(`SELECT 1 FROM photos WHERE id = ? AND status = 'done' AND sample = 0 AND held = 0`).get(id);
}

export type FeedSort = 'latest' | 'popular';

/**
 * 피드: 분석이 끝나 게시된 사진과 그 시세 (대기·분석 중은 숨김).
 * latest: 최신순(before 커서), popular: 최근 VISIBLE_DAYS일 안에서 좋아요순(offset).
 */
export function feed(limit: number, opts: { before?: string; offset?: number; sort?: FeedSort; clientId?: string } = {}) {
  const popular = opts.sort === 'popular';
  const where = [`p.status = 'done'`, 'p.sample = 0', 'p.held = 0', 's.active = 1'];
  if (popular) where.push(`p.taken_at >= @since`);
  else if (opts.before) where.push('p.taken_at < @before');
  const rows = db
    .prepare(
      `${PHOTO_SQL} WHERE ${where.join(' AND ')} ORDER BY ${popular ? 'likes DESC, p.taken_at DESC' : 'p.taken_at DESC'} LIMIT @limit OFFSET @offset`,
    )
    .all({
      limit,
      before: opts.before,
      offset: popular ? Math.max(0, opts.offset ?? 0) : 0,
      since: new Date(Date.now() - VISIBLE_DAYS * 86400_000).toISOString(),
    }) as PhotoRow[];
  const liked = new Set(
    opts.clientId && rows.length
      ? (db.prepare(`SELECT photo_id FROM likes WHERE client_id = ? AND photo_id IN (${rows.map(() => '?').join(',')})`).pluck().all(opts.clientId, ...rows.map((r) => r.id)) as string[])
      : [],
  );
  return rows.map((r) => {
    const photo = toPhoto(r);
    const store = getStore(r.store_id);
    return {
      photo,
      store,
      liked: liked.has(r.id),
      observations: photoObservations(photo.id),
    };
  });
}
