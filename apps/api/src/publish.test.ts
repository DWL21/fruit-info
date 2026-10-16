import { describe, expect, it } from 'vitest';
import { needsReview } from './publish.ts';

describe('needsReview', () => {
  it('가격표에 이름이 있으면 바로 게시', () => expect(needsReview({ name_source: 'tag', confidence: 0.3 })).toBe(false));
  it('외형 판단이라도 확신이 높으면 게시', () => expect(needsReview({ name_source: 'product', confidence: 0.85 })).toBe(false));
  it('외형 판단이고 확신이 낮으면 확인 대기', () => expect(needsReview({ name_source: 'product', confidence: 0.5 })).toBe(true));
});

import { isOutlier, median } from './publish.ts';

describe('isOutlier', () => {
  it('중앙값', () => expect(median([3000, 5000, 4000])).toBe(4000));
  it('비교 시세가 없으면 게시', () => expect(isOutlier(40000, [])).toBe(false));
  it('자릿수 하나 더 붙은 가격은 확인 대기', () => expect(isOutlier(40000, [4000, 5000, 3500])).toBe(true));
  it('자릿수가 빠진 가격도 확인 대기', () => expect(isOutlier(500, [5000, 6000])).toBe(true));
  it('박스·낱개 차이 정도는 게시', () => expect(isOutlier(15000, [4000, 6000])).toBe(false));
});
