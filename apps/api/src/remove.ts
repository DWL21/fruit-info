import { rmSync } from 'node:fs';
import { db } from './db.ts';
import { live } from './live.ts';
import { cropPath, originalPath, photoPath, previewPath } from './media.ts';

const unlink = (path: string) => rmSync(path, { force: true });

/** 시세(관측) 여러 개를 지운다. 지운 개수를 돌려준다. */
export function deleteObservations(ids: number[]): number {
  const rows = ids
    .map((id) => db.prepare('SELECT id, store_id, item_slug, photo_id FROM observations WHERE id = ?').get(id) as { id: number; store_id: number; item_slug: string; photo_id: string } | undefined)
    .filter((r) => !!r);
  db.transaction(() => {
    for (const r of rows) db.prepare('DELETE FROM observations WHERE id = ?').run(r.id);
  })();
  for (const r of rows) unlink(cropPath(r.id));
  publishPrices(rows.map((r) => ({ storeId: r.store_id, slug: r.item_slug, sample: isSamplePhoto(r.photo_id) })));
  return rows.length;
}

/**
 * 사진과 그 시세를 모두 지운다. 분석 중인 사진은 건너뛴다(끝난 뒤 다시 지우면 된다).
 */
export function deletePhotos(ids: string[]): { deleted: string[]; skipped: string[] } {
  const deleted: string[] = [];
  const skipped: string[] = [];
  const changed: { storeId: number; slug: string; sample: boolean }[] = [];
  const crops: number[] = [];
  db.transaction(() => {
    for (const id of ids) {
      const p = db.prepare('SELECT store_id, sample, status FROM photos WHERE id = ?').get(id) as { store_id: number; sample: number; status: string } | undefined;
      if (!p) continue;
      if (p.status === 'analyzing') {
        skipped.push(id);
        continue;
      }
      const obs = db.prepare('SELECT id, item_slug FROM observations WHERE photo_id = ?').all(id) as { id: number; item_slug: string }[];
      for (const o of obs) {
        crops.push(o.id);
        changed.push({ storeId: p.store_id, slug: o.item_slug, sample: !!p.sample });
      }
      db.prepare('DELETE FROM photos WHERE id = ?').run(id);
      deleted.push(id);
    }
  })();
  for (const id of deleted) [originalPath(id), photoPath(id), previewPath(id)].forEach(unlink);
  crops.forEach((id) => unlink(cropPath(id)));
  publishPrices(changed);
  for (const id of deleted) live.publish({ type: 'feed', photoId: id });
  return { deleted, skipped };
}

function isSamplePhoto(id: string) {
  return !!(db.prepare('SELECT sample FROM photos WHERE id = ?').pluck().get(id) as number | undefined);
}

function publishPrices(rows: { storeId: number; slug: string; sample: boolean }[]) {
  const byStore = new Map<number, Set<string>>();
  for (const r of rows.filter((x) => !x.sample)) byStore.set(r.storeId, (byStore.get(r.storeId) ?? new Set()).add(r.slug));
  for (const [storeId, slugs] of byStore) live.publish({ type: 'prices', storeId, itemSlugs: [...slugs] });
}
