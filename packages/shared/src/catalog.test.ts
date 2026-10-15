import { describe, expect, it } from 'vitest';
import { matchCatalog } from './catalog.ts';

describe('matchCatalog', () => {
  it.each([
    ['하우스 귤', null, 'mandarin'],
    ['하우스 감귤', null, 'mandarin'],
    ['감귤', '하우스', 'mandarin'],
    ['경봉', null, 'mandarin'],
    ['샤인머스켓', null, 'shine-muscat'],
    ['하우스 포도', null, 'grape'],
    ['단감', null, 'persimmon'],
    ['감', null, 'persimmon'],
    ['대추방울토마토', null, 'cherry-tomato'],
    ['토마토', null, 'tomato'],
    ['천혜향', null, 'hallabong'],
  ])('%s(%s) → %s', (raw, variety, slug) => {
    expect(matchCatalog(raw, variety)?.slug).toBe(slug);
  });

  it('모르는 품목은 null', () => {
    expect(matchCatalog('콜')).toBeNull();
  });
});
