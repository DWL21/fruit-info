import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'fruit-resolve-'));
const { db } = await import('./db.ts');
const { resolveStore, isInvalid, limitResetAt } = await import('./queue.ts');

let ids: Record<string, number> = {};
beforeAll(() => {
  const add = (name: string, aisle: string, position: number, side: string) =>
    (db.prepare('INSERT INTO stores (name, aisle, position, side) VALUES (?, ?, ?, ?) RETURNING id').get(name, aisle, position, side) as { id: number }).id;
  ids = {
    hannong: add('한농상회', 'v2', 1, 'B'),
    hwaseungV1: add('화승청과', 'v1', 1, 'B'),
    hwaseungV2: add('화승청과', 'v2', 6, 'A'),
    sinil: add('신일청과', 'main', 40, 'A'),
    deoksin: add('덕신상회', 'main', 10, 'A'),
    daehyung: add('대형농산유통', 'main', 12, 'B'),
    youngpung: add('영풍상회', 'main', 20, 'A'),
    seobu: add('서부상회3', 'main', 0, 'A'),
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

describe('resolveStore 표기 차이', () => {
  it('업종 이름만 다르면 같은 가게', () => {
    expect(resolveStore('덕신청과', ids.sinil!)).toBe(ids.deoksin);
    expect(resolveStore('대형농산', ids.sinil!)).toBe(ids.daehyung);
  });
  it('앞이 잘린 간판은 하나로 좁혀질 때만', () => {
    expect(resolveStore('…풍상회', ids.sinil!)).toBe(ids.youngpung);
    expect(resolveStore('…상회', ids.sinil!)).toBe(ids.sinil);
  });
  it('시장 이름 간판은 옮기지 않는다', () => {
    expect(resolveStore('청량리청과물시장', ids.sinil!)).toBe(ids.sinil);
  });
});

describe('isInvalid', () => {
  it('매대 사진이 아니고 시세도 없으면 보류', () => {
    expect(isInvalid({ stall_photo: false }, 0)).toBe(true);
    expect(isInvalid({ stall_photo: false }, 2)).toBe(false);
    expect(isInvalid({ stall_photo: true }, 0)).toBe(false);
  });
});

describe('limitResetAt', () => {
  const now = new Date(2026, 9, 16, 11, 41).getTime();
  it('사용량 한도 메시지의 시각까지', () => {
    const t = limitResetAt("You've hit your usage limit. … try again at 1:24 PM.", now)!;
    expect(new Date(t).getHours()).toBe(13);
    expect(new Date(t).getMinutes()).toBe(25);
  });
  it('이미 지난 시각이면 다음 날', () => {
    const t = limitResetAt('usage limit … try again at 9:00 AM', now)!;
    expect(t - now).toBeGreaterThan(20 * 3600_000);
  });
  it('시각이 없으면 30분 뒤, 한도 오류가 아니면 null', () => {
    expect(limitResetAt('usage limit reached', now)).toBe(now + 30 * 60_000);
    expect(limitResetAt('분석기 응답 없음 (exit 1) timeout', now)).toBeNull();
  });
});
