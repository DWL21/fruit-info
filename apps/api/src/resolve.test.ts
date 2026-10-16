import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'fruit-resolve-'));
const { db } = await import('./db.ts');
const { resolveStore } = await import('./queue.ts');

let ids: Record<string, number> = {};
beforeAll(() => {
  const add = (name: string, aisle: string, position: number, side: string) =>
    (db.prepare('INSERT INTO stores (name, aisle, position, side) VALUES (?, ?, ?, ?) RETURNING id').get(name, aisle, position, side) as { id: number }).id;
  ids = {
    hannong: add('한농상회', 'v2', 1, 'B'),
    hwaseungV1: add('화승청과', 'v1', 1, 'B'),
    hwaseungV2: add('화승청과', 'v2', 6, 'A'),
    sinil: add('신일청과', 'main', 40, 'A'),
  };
});

describe('resolveStore', () => {
  it('간판과 같은 이름의 가게로 바꾼다', () => {
    expect(resolveStore('한농 상회', ids.sinil!)).toBe(ids.hannong);
  });
  it('간판이 없거나 모르는 이름이면 선택 가게 유지', () => {
    expect(resolveStore(null, ids.sinil!)).toBe(ids.sinil);
    expect(resolveStore('없는상회', ids.sinil!)).toBe(ids.sinil);
  });
  it('동명 가게는 선택 가게와 가까운 곳', () => {
    expect(resolveStore('화승청과', ids.hannong!)).toBe(ids.hwaseungV2);
  });
  it('선택 가게가 이미 같은 이름이면 그대로', () => {
    expect(resolveStore('화승청과', ids.hwaseungV1!)).toBe(ids.hwaseungV1);
  });
});
