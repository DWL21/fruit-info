import type { ReactNode } from 'react';
import { MARKET, type AisleId, type SideId, type Store } from '@fruit/shared';
import { Link } from './Link.tsx';

export interface StallMark {
  /** 칸 안에 보일 짧은 글자 (순위 번호 등) */
  label: string;
  best?: boolean;
}

type Col = { kind: 'stall'; pos: number } | { kind: 'vaisle'; id: string };

/**
 * 청량리 청과물시장 축소 지도. 화면 폭에 맞춰 한 번에 보인다(가로 스크롤 없음).
 * 가로 본통로(왼쪽 제기동역 → 오른쪽 청량리역) 위·아래로 가판대,
 * 세로 통로 2개가 본통로를 가로지르며 양쪽에 가판대가 있다.
 */
export function AisleMap({ stores, marks, highlight }: { stores: Store[]; marks?: Map<number, StallMark>; highlight?: number }) {
  const mainLength = Math.max(MARKET.mainLength, ...stores.filter((s) => s.aisle === 'main').map((s) => s.position));
  const verticals = MARKET.verticals.map((v) => {
    const max = Math.max(0, ...stores.filter((s) => s.aisle === v.id).map((s) => s.position));
    return { ...v, down: Math.max(v.down, max - v.up) };
  });
  const up = Math.max(0, ...verticals.map((v) => v.up));
  const down = Math.max(0, ...verticals.map((v) => v.down));

  const cols: Col[] = [];
  for (let p = 1; p <= mainLength; p++) {
    cols.push({ kind: 'stall', pos: p });
    for (const v of verticals) if (v.after === p) cols.push({ kind: 'vaisle', id: v.id });
  }
  const colOf = (pos: number) => cols.findIndex((c) => c.kind === 'stall' && c.pos === pos) + 1;
  const vColOf = (id: string) => cols.findIndex((c) => c.kind === 'vaisle' && c.id === id) + 1;

  // 행: [세로 통로 위쪽] [본통로 위 가판대] [본통로] [본통로 아래 가판대] [세로 통로 아래쪽]
  const topRow = up + 1;
  const aisleRow = up + 2;
  const bottomRow = up + 3;
  const rowCount = up + 3 + down;

  const find = (aisle: AisleId, pos: number, side: SideId) => stores.find((s) => s.aisle === aisle && s.position === pos && s.side === side);
  const cells: ReactNode[] = [];
  const at = (key: string, row: number | string, col: number | string, node: ReactNode) =>
    cells.push(
      <div key={key} style={{ gridRow: row, gridColumn: col }} className="min-h-0 min-w-0">
        {node}
      </div>,
    );

  const stall = (s: Store | undefined) => {
    if (!s) return <div className="size-full rounded-[1px] border border-dashed border-white/30" aria-hidden />;
    const mark = marks?.get(s.id);
    const strong = mark?.best || highlight === s.id;
    const tone = strong
      ? 'bg-signal text-white border-[#8a4700] shadow-[0_1px_0_#8a4700]'
      : mark
        ? 'bg-white text-carbon border-chrome shadow-[0_1px_0_var(--color-chrome)]'
        : marks || highlight
          ? 'bg-white/40 border-transparent'
          : 'bg-white border-chrome';
    return (
      <Link href={`/store/${s.id}`} aria-label={s.name} title={s.name} className={`flex size-full items-center justify-center rounded-[2px] border text-[10px] leading-none font-black ${tone}`}>
        {mark?.label}
      </Link>
    );
  };

  for (let p = 1; p <= mainLength; p++) {
    at(`m-a-${p}`, topRow, colOf(p), stall(find('main', p, 'A')));
    at(`m-b-${p}`, bottomRow, colOf(p), stall(find('main', p, 'B')));
  }
  at('main', aisleRow, `1 / span ${cols.length}`, <div className="carbon size-full rounded-[1px]" />);

  for (const v of verticals) {
    const vc = vColOf(v.id);
    at(`${v.id}-aisle`, `${topRow - v.up} / ${bottomRow + v.down + 1}`, vc, <div className="carbon size-full rounded-[1px]" />);
    // 세로 통로 순번: 북쪽 끝부터 1
    for (let i = 1; i <= v.up + v.down; i++) {
      const row = i <= v.up ? topRow - (v.up - i + 1) : bottomRow + (i - v.up);
      at(`${v.id}-a-${i}`, row, vc - 1, stall(find(v.id, i, 'A')));
      at(`${v.id}-b-${i}`, row, vc + 1, stall(find(v.id, i, 'B')));
    }
  }

  const template = cols.map((c) => (c.kind === 'stall' ? 'minmax(0,1fr)' : 'minmax(0,0.5fr)')).join(' ');
  const rows = Array.from({ length: rowCount }, (_, i) => (i + 1 === aisleRow ? '8px' : '22px')).join(' ');
  return (
    <div className="plate p-2" role="group" aria-label="청량리 청과물시장 지도">
      <div className="mb-1.5 flex justify-between text-[11px] font-bold text-carbon">
        <span>◀ {MARKET.west}</span>
        <span>{MARKET.east} ▶</span>
      </div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: template, gridTemplateRows: rows }}>
        {cells}
      </div>
      <div className="mt-1.5 text-center text-[11px] font-bold text-carbon">▼ 왕산로</div>
    </div>
  );
}
