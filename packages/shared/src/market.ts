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

/**
 * 걷는 순서 안내도의 구간(본통로 시작 지점 m). 같은 건물 주소끼리 묶이도록 나눴다.
 * 세로줄은 본통로에서 갈라지는 지점(from)이 속한 구간에 들어간다.
 */
export const SEGMENT_STARTS = [0, 20, 86, 125, 170, 210];

export function segmentIndex(s: { aisle: AisleId; position: number }): number {
  const at = s.aisle === 'main' ? s.position : (MARKET.verticals.find((v) => v.id === s.aisle)?.from ?? 0);
  let i = 0;
  while (i + 1 < SEGMENT_STARTS.length && at >= SEGMENT_STARTS[i + 1]!) i++;
  return i;
}

/** 구간 끝(m) */
export const segmentEnd = (i: number) => SEGMENT_STARTS[i + 1] ?? MARKET.length;

/** '왕산로33길 17', '왕산로33길 13' → '왕산로33길 13·17'. 길은 처음 나온 순서, 번지는 숫자 순서. */
export function compactAddresses(addresses: (string | null | undefined)[]): string {
  const roads = new Map<string, string[]>();
  for (const a of addresses) {
    if (!a) continue;
    const cut = a.lastIndexOf(' ');
    const road = cut > 0 ? a.slice(0, cut) : a;
    const no = cut > 0 ? a.slice(cut + 1) : '';
    const list = roads.get(road) ?? [];
    if (no && !list.includes(no)) list.push(no);
    roads.set(road, list);
  }
  return [...roads].map(([road, nos]) => [road, nos.sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })).join('·')].filter(Boolean).join(' ')).join(', ');
}
