import type { AnalysisItem } from '@fruit/shared';

/**
 * 가격표에 과일 이름이 없고 외형으로만 판단했는데 확신이 낮으면 공개하지 않고 운영자 확인을 기다린다.
 * 과일이 틀리면 가격이 다른 과일 페이지에 올라가기 때문이다.
 */
export const REVIEW_CONFIDENCE = 0.7;
export const needsReview = (it: Pick<AnalysisItem, 'name_source' | 'confidence'>) => it.name_source === 'product' && it.confidence < REVIEW_CONFIDENCE;
