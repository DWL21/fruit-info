/**
 * 청량리 청과물시장 과일 거리 배치 (카카오맵 좌표 기반, docs/research/stores.md).
 * 본통로: 왼쪽 끝 경동시장로 7(제기동역 쪽) → 오른쪽 끝 왕산로35길 13(청량리역 쪽), 약 230m.
 *   main 가게의 position = 왼쪽 끝에서의 거리(m), side A = 북쪽, B = 남쪽(왕산로 쪽).
 * 세로줄 2개: 본통로 남쪽에서 왕산로(지하철 대로)까지 이어진 골목.
 *   position = 본통로 쪽부터 순번, side A = 서쪽(제기동역 쪽), B = 동쪽(청량리역 쪽).
 */
export type AisleId = 'main' | 'v1' | 'v2';
export type SideId = 'A' | 'B';

export interface VerticalAisle {
  id: Exclude<AisleId, 'main'>;
  name: string;
  /** 본통로에서 갈라지는 구간(m) */
  from: number;
  to: number;
}

export const MARKET = {
  west: '제기동역',
  east: '청량리역',
  south: '왕산로',
  length: 230,
  verticals: [
    { id: 'v1', name: '경동시장로 4 골목', from: 40, to: 80 },
    { id: 'v2', name: '왕산로33길 5 골목', from: 86, to: 116 },
  ] as VerticalAisle[],
};

export const AISLES: { id: AisleId; name: string }[] = [
  { id: 'main', name: '본통로' },
  ...MARKET.verticals.map((v) => ({ id: v.id, name: v.name })),
];

export const aisleName = (id: AisleId) => AISLES.find((a) => a.id === id)?.name ?? id;

export const sideName = (aisle: AisleId, side: SideId) => (aisle === 'main' ? (side === 'A' ? '북쪽' : '남쪽') : side === 'A' ? '서쪽' : '동쪽');

export function placeName(s: { aisle: AisleId; position: number; side: SideId }) {
  return s.aisle === 'main' ? `본통로 ${sideName('main', s.side)}` : `${aisleName(s.aisle)} ${sideName(s.aisle, s.side)}`;
}

/** 촬영 동선: 본통로를 제기동역→청량리역으로 걷다가 세로줄을 만나면 들어갔다 나온다. */
export function walkKey(s: { aisle: AisleId; position: number; side: SideId }): number {
  if (s.aisle === 'main') return s.position * 10 + (s.side === 'A' ? 0 : 5);
  const v = MARKET.verticals.find((x) => x.id === s.aisle);
  return (v?.from ?? 0) * 10 + 1 + s.position / 100 + (s.side === 'A' ? 0 : 0.005);
}
