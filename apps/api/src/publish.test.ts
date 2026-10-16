import { describe, expect, it } from 'vitest';
import { needsReview } from './publish.ts';

describe('needsReview', () => {
  it('가격표에 이름이 있으면 바로 게시', () => expect(needsReview({ name_source: 'tag', confidence: 0.3 })).toBe(false));
  it('외형 판단이라도 확신이 높으면 게시', () => expect(needsReview({ name_source: 'product', confidence: 0.85 })).toBe(false));
  it('외형 판단이고 확신이 낮으면 확인 대기', () => expect(needsReview({ name_source: 'product', confidence: 0.5 })).toBe(true));
});
