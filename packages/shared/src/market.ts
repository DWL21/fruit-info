/**
 * 청량리 청과물시장 고정 배치.
 * 가로 본통로가 왼쪽(제기동역)에서 오른쪽(청량리역)으로 이어지고, 중간에 세로 통로 2개가 있다.
 * 순번은 본통로는 제기동역 쪽부터, 세로 통로는 본통로에서 멀어지는 방향으로 1부터 센다.
 */
export type AisleId = 'main' | 'v1' | 'v2';
export type SideId = 'A' | 'B';

export interface VerticalAisle {
  id: Exclude<AisleId, 'main'>;
  name: string;
  /** 본통로 몇 번째 가판대 다음에서 갈라지는지 */
  after: number;
  direction: 'up' | 'down';
  length: number;
}

export const MARKET = {
  west: '제기동역',
  east: '청량리역',
  mainLength: 16,
  verticals: [
    { id: 'v1', name: '세로 통로 1', after: 5, direction: 'down', length: 6 },
    { id: 'v2', name: '세로 통로 2', after: 11, direction: 'down', length: 6 },
  ] as VerticalAisle[],
};

export const AISLES: { id: AisleId; name: string }[] = [
  { id: 'main', name: '본통로' },
  ...MARKET.verticals.map((v) => ({ id: v.id, name: v.name })),
];

export const aisleName = (id: AisleId) => AISLES.find((a) => a.id === id)?.name ?? id;

/** 본통로: A=위쪽, B=아래쪽 / 세로 통로: A=왼쪽(제기동역 쪽), B=오른쪽(청량리역 쪽) */
export const sideName = (aisle: AisleId, side: SideId) => (aisle === 'main' ? (side === 'A' ? '위쪽' : '아래쪽') : side === 'A' ? '왼쪽' : '오른쪽');

export const placeName = (s: { aisle: AisleId; position: number; side: SideId }) =>
  `${aisleName(s.aisle)} ${s.position}번째 ${sideName(s.aisle, s.side)}`;

/** 촬영 동선: 본통로를 제기동역→청량리역으로 걷다가 세로 통로를 만나면 들어갔다 나온다. */
export function walkKey(s: { aisle: AisleId; position: number; side: SideId }): number {
  const sideOrder = s.side === 'A' ? 0 : 0.5;
  if (s.aisle === 'main') return s.position * 1000 + sideOrder;
  const v = MARKET.verticals.find((x) => x.id === s.aisle);
  return (v?.after ?? 0) * 1000 + 500 + s.position + sideOrder / 10;
}
