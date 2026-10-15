import { describe, expect, it } from 'vitest';
import { compactAddresses, segmentIndex } from './market.ts';

describe('segmentIndex', () => {
  it.each([
    [{ aisle: 'main' as const, position: 0 }, 0],
    [{ aisle: 'main' as const, position: 37 }, 1],
    [{ aisle: 'main' as const, position: 86 }, 2],
    [{ aisle: 'main' as const, position: 230 }, 5],
    [{ aisle: 'v1' as const, position: 6 }, 1],
    [{ aisle: 'v2' as const, position: 1 }, 2],
  ])('%o → %i', (s, i) => {
    expect(segmentIndex(s)).toBe(i);
  });
});

describe('compactAddresses', () => {
  it('같은 길 번지를 묶는다', () => {
    expect(compactAddresses(['왕산로33길 17', '왕산로33길 13', '왕산로33길 17', null])).toBe('왕산로33길 13·17');
    expect(compactAddresses(['왕산로33길 16', '경동시장로2길 23', '경동시장로2길 25'])).toBe('왕산로33길 16, 경동시장로2길 23·25');
    expect(compactAddresses(['경동시장로 7-1', '경동시장로 7'])).toBe('경동시장로 7·7-1');
    expect(compactAddresses([])).toBe('');
  });
});
