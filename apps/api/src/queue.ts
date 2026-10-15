import { matchCatalog } from '@fruit/shared';
import { analyze } from './analyzer.ts';
import { db } from './db.ts';
import { live } from './live.ts';
import { cropBox, makeCrop, originalPath, publishPhoto } from './media.ts';
import { getPhoto } from './repo.ts';
import { config } from './config.ts';
import { capture } from './monitor.ts';

let running = 0;

function emitPhoto(id: string) {
  const photo = getPhoto(id);
  if (photo) live.publish({ type: 'photo', photo });
}

/** 큐에서 사진 하나를 꺼내 분석·게시한다. */
async function processOne(): Promise<boolean> {
  const next = db
    .prepare(
      `UPDATE photos SET status = 'analyzing', attempts = attempts + 1
       WHERE id = (SELECT id FROM photos WHERE status = 'queued' ORDER BY taken_at LIMIT 1)
       RETURNING id, store_id, taken_at`,
    )
    .get() as { id: string; store_id: number; taken_at: string } | undefined;
  if (!next) return false;
  emitPhoto(next.id);
  const store = db.prepare('SELECT name FROM stores WHERE id = ?').get(next.store_id) as { name: string };

  try {
    const result = await analyze(originalPath(next.id), store.name);
    const { analysis } = result;
    await publishPhoto(next.id, analysis.faces);

    const insert = db.prepare(
      `INSERT INTO observations (photo_id, store_id, item_slug, raw_name, variety, price, unit, confidence, price_box, product_box, observed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    );
    const created: { id: number; slug: string; box: ReturnType<typeof cropBox> }[] = [];
    db.transaction(() => {
      db.prepare('DELETE FROM observations WHERE photo_id = ?').run(next.id);
      for (const it of analysis.items) {
        const item = matchCatalog(it.name, it.variety);
        if (!item || it.price === null || it.price < 100) continue;
        const row = insert.get(
          next.id, next.store_id, item.slug, it.name, it.variety, it.price, it.unit, it.confidence,
          it.price_box ? JSON.stringify(it.price_box) : null, it.product_box ? JSON.stringify(it.product_box) : null,
          next.taken_at,
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
    live.publish({ type: 'prices', storeId: next.store_id, itemSlugs: [...new Set(created.map((c) => c.slug))] });
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


