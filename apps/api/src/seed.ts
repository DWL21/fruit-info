import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.ts';

const SEED = fileURLToPath(new URL('../seed/stores.tsv', import.meta.url));

/**
 * 조사한 가게 목록(seed/stores.tsv)을 반영한다.
 * 카카오 ID로 이미 있는 가게는 건드리지 않아 운영자가 고친 위치를 덮어쓰지 않는다.
 * 카카오 ID 없이 손으로 만든 같은 이름의 가게가 있으면 그 가게에 정보를 붙인다.
 */
export function seedStores() {
  if (!existsSync(SEED)) return 0;
  const [, ...lines] = readFileSync(SEED, 'utf8').trim().split('\n');
  const byKakao = db.prepare('SELECT id FROM stores WHERE kakao_id = ?').pluck();
  const byName = db.prepare('SELECT id FROM stores WHERE kakao_id IS NULL AND name = ? AND active = 1').pluck();
  const attach = db.prepare('UPDATE stores SET kakao_id = ?, address = ?, aisle = ?, position = ?, side = ?, lat = ?, lon = ? WHERE id = ?');
  const insert = db.prepare('INSERT INTO stores (kakao_id, name, address, aisle, position, side, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  let added = 0;
  db.transaction(() => {
    for (const line of lines) {
      const [kakaoId, name, address, aisle, position, side, lat, lon] = line.split('\t');
      if (!kakaoId || !name || byKakao.get(kakaoId)) continue;
      const existing = byName.get(name) as number | undefined;
      if (existing) attach.run(kakaoId, address, aisle, Number(position), side, Number(lat), Number(lon), existing);
      else insert.run(kakaoId, name, address, aisle, Number(position), side, Number(lat), Number(lon));
      added++;
    }
  })();
  return added;
}
