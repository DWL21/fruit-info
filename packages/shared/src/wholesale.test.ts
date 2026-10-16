import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog.ts';
import { wholesaleSlug } from './wholesale.ts';

describe('wholesaleSlug', () => {
  it('KAMIS 품목을 품목 사전으로', () => {
    expect(wholesaleSlug('사과', '홍로(10kg)')).toBe('apple');
    expect(wholesaleSlug('감귤', '노지(5kg)')).toBe('mandarin');
    expect(wholesaleSlug('참다래', '골드')).toBe('kiwi');
  });
  it('샤인머스켓은 포도와 따로', () => {
    expect(wholesaleSlug('포도', '샤인머스켓(2kg)')).toBe('shine-muscat');
    expect(wholesaleSlug('포도', '거봉(2kg)')).toBe('grape');
  });
  it('과일이 아니면 없음', () => {
    expect(wholesaleSlug('배추', '봄(10kg)')).toBeNull();
  });
  it('모든 대상이 품목 사전에 있다', () => {
    for (const [n, k] of [['사과', ''], ['수박', ''], ['방울토마토', ''], ['자두', '']] as const) {
      expect(CATALOG.some((c) => c.slug === wholesaleSlug(n, k))).toBe(true);
    }
  });
});
