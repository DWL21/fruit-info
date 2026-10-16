import type { AnalysisItem } from '@fruit/shared';

/**
 * 가격표에 과일 이름이 없고 외형으로만 판단했는데 확신이 낮으면 공개하지 않고 운영자 확인을 기다린다.
 * 과일이 틀리면 가격이 다른 과일 페이지에 올라가기 때문이다.
 */
export const REVIEW_CONFIDENCE = 0.7;
export const needsReview = (it: Pick<AnalysisItem, 'name_source' | 'confidence'>) => it.name_source === 'product' && it.confidence < REVIEW_CONFIDENCE;

/** 같은 과일 현재 시세 중앙값과 이 배수 이상 차이 나면 자릿수 오독으로 보고 확인을 기다린다. */
export const OUTLIER_RATIO = 5;

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function isOutlier(price: number, others: number[]): boolean {
  const m = median(others);
  if (!m) return false;
  return price / m >= OUTLIER_RATIO || m / price >= OUTLIER_RATIO;
}
