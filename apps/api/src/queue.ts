import { matchCatalog, walkKey, type Aisle, type Side } from '@fruit/shared';
import { analyze } from './analyzer.ts';
import { db } from './db.ts';
import { live } from './live.ts';
import { cropBox, makeCrop, originalPath, publishPhoto } from './media.ts';
import { currentObservations, getPhoto, isSample } from './repo.ts';
import { config } from './config.ts';
import { capture } from './monitor.ts';
import { isOutlier, needsReview } from './publish.ts';

let running = 0;

const normName = (s: string) => s.replace(/[\s()·.]/g, '').toLowerCase();

interface StoreRef { id: number; name: string; aisle: Aisle; position: number; side: Side }

/** 읽은 간판 이름으로 가게를 찾는다. 동명 가게는 선택 가게와 동선상 가까운 곳, 없으면 선택 가게. */
export function resolveStore(readName: string | null, selectedId: number): number {
  if (!readName) return selectedId;
  const stores = db.prepare('SELECT id, name, aisle, position, side FROM stores WHERE active = 1').all() as StoreRef[];
  const target = normName(readName);
  const matches = stores.filter((s) => normName(s.name) === target);
  if (!matches.length) return selectedId;
  if (matches.some((s) => s.id === selectedId)) return selectedId;
  const selected = stores.find((s) => s.id === selectedId);
  if (!selected) return matches[0]!.id;
  const k = walkKey(selected);
  return matches.sort((a, b) => Math.abs(walkKey(a) - k) - Math.abs(walkKey(b) - k))[0]!.id;
}

function emitPhoto(id: string) {
  const photo = getPhoto(id);
  if (photo) live.publish({ type: 'photo', photo });
  if (!isSample(id)) live.publish({ type: 'feed', photoId: id });
}

/** 큐에서 사진 하나를 꺼내 분석·게시한다. */
async function processOne(): Promise<boolean> {
  const next = db
    .prepare(
      `UPDATE photos SET status = 'analyzing', attempts = attempts + 1
       WHERE id = (SELECT id FROM photos WHERE status = 'queued' ORDER BY taken_at LIMIT 1)
       RETURNING id, store_id, taken_at, auto_store`,
    )
    .get() as { id: string; store_id: number; taken_at: string; auto_store: number } | undefined;
  if (!next) return false;
  emitPhoto(next.id);
  const store = db.prepare('SELECT name FROM stores WHERE id = ?').get(next.store_id) as { name: string };

  try {
    const result = await analyze(originalPath(next.id), next.auto_store ? null : store.name);
    const { analysis } = result;
    if (next.auto_store) {
      const resolved = resolveStore(analysis.store_name, next.store_id);
      if (resolved !== next.store_id) {
        db.prepare('UPDATE photos SET store_id = ? WHERE id = ?').run(resolved, next.id);
        next.store_id = resolved;
      }
    }
    await publishPhoto(next.id, analysis.faces);

    const insert = db.prepare(
      `INSERT INTO observations (photo_id, store_id, item_slug, raw_name, variety, price, unit, confidence, price_box, product_box, observed_at, hidden, review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    );
    const created: { id: number; slug: string; box: ReturnType<typeof cropBox> }[] = [];
    // 같은 과일의 현재 공개 시세 (이상치 판단용)
    const currentPrices = new Map<string, { storeId: number; price: number }[]>();
    for (const o of currentObservations()) currentPrices.set(o.itemSlug, [...(currentPrices.get(o.itemSlug) ?? []), { storeId: o.storeId, price: o.price }]);
    db.transaction(() => {
      db.prepare('DELETE FROM observations WHERE photo_id = ?').run(next.id);
      for (const it of analysis.items) {
        const item = matchCatalog(it.name, it.variety);
        if (!item || it.price === null || it.price < 100) continue;
        const others = (currentPrices.get(item.slug) ?? []).filter((x) => x.storeId !== next.store_id).map((x) => x.price);
        const hold = needsReview(it) || isOutlier(it.price, others) ? 1 : 0;
        const row = insert.get(
          next.id, next.store_id, item.slug, it.name, it.variety, it.price, it.unit, it.confidence,
          it.price_box ? JSON.stringify(it.price_box) : null, it.product_box ? JSON.stringify(it.product_box) : null,
          next.taken_at, hold, hold,
        ) as { id: number };
        created.push({ id: row.id, slug: item.slug, box: cropBox(it.price_box, it.product_box) });
      }
      db.prepare(
        `UPDATE photos SET status = 'done', read_store_name = ?, model = ?, duration_ms = ?, raw = ?, error = NULL WHERE id = ?`,
      ).run(analysis.store_name, result.model, result.durationMs, result.raw, next.id);
    })();

    for (const c of created) {
      if (!c.box) continue;
      await makeCrop(next.id, c.id, c.box);
      db.prepare('UPDATE observations SET crop = 1 WHERE id = ?').run(c.id);
    }
    if (!isSample(next.id)) live.publish({ type: 'prices', storeId: next.store_id, itemSlugs: [...new Set(created.map((c) => c.slug))] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = (db.prepare('SELECT attempts FROM photos WHERE id = ?').get(next.id) as { attempts: number }).attempts;
    // 두 번까지 다시 시도한다.
    db.prepare(`UPDATE photos SET status = ?, error = ? WHERE id = ?`).run(attempts < 3 ? 'queued' : 'failed', message.slice(0, 300), next.id);
    console.error(`[analyze] ${next.id} 실패 (${attempts}회):`, message);
    if (attempts >= 3) capture(error, { photoId: next.id });
  }
  emitPhoto(next.id);
  return true;
}

export function kickQueue() {
  while (running < config.concurrency) {
    running++;
    void (async () => {
      try {
        while (await processOne()) {}
      } finally {
        running--;
      }
    })();
  }
}

export function startQueue() {
  // 서버가 분석 중에 꺼졌으면 다시 큐에 넣는다.
  db.prepare(`UPDATE photos SET status = 'queued' WHERE status = 'analyzing'`).run();
  kickQueue();
  setInterval(kickQueue, 30_000).unref();
}


