import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { MARKET, won, type AisleId, type SideId, type Store, type VerticalAisle } from '@fruit/shared';
import { Link } from './Link.tsx';

export interface StallMark {
  price: number;
  unit: string | null;
  cheapest?: boolean;
}

type Col = { kind: 'stall'; pos: number } | { kind: 'vaisle'; v: VerticalAisle };

/**
 * 청량리 청과물시장 고정 지도.
 * 가로 본통로(왼쪽 제기동역 → 오른쪽 청량리역) 위·아래로 가판대, 중간의 세로 통로 양쪽에도 가판대가 있다.
 */
export function AisleMap({ stores, marks, highlight }: { stores: Store[]; marks?: Map<number, StallMark>; highlight?: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLAnchorElement>(null);
  const focusId = highlight ?? [...(marks ?? [])].find(([, m]) => m.cheapest)?.[0];

  useEffect(() => {
    const el = focusRef.current;
    const box = scroller.current;
    if (el && box) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, [focusId, stores.length]);

  const mainLength = Math.max(MARKET.mainLength, ...stores.filter((s) => s.aisle === 'main').map((s) => s.position));
  const verticals = MARKET.verticals.map((v) => ({
    ...v,
    length: Math.max(v.length, ...stores.filter((s) => s.aisle === v.id).map((s) => s.position)),
  }));

  // 열: 본통로 가판대 열 사이사이에 세로 통로 열을 끼운다.
  const cols: Col[] = [];
  for (let p = 1; p <= mainLength; p++) {
    cols.push({ kind: 'stall', pos: p });
    for (const v of verticals) if (v.after === p) cols.push({ kind: 'vaisle', v });
  }
  const colOf = (pos: number) => cols.findIndex((c) => c.kind === 'stall' && c.pos === pos) + 1;
  const vColOf = (id: string) => cols.findIndex((c) => c.kind === 'vaisle' && c.v.id === id) + 1;

  const up = Math.max(0, ...verticals.filter((v) => v.direction === 'up').map((v) => v.length));
  const down = Math.max(0, ...verticals.filter((v) => v.direction === 'down').map((v) => v.length));
  const topRow = up + 1;
  const aisleRow = up + 2;
  const bottomRow = up + 3;

  const find = (aisle: AisleId, pos: number, side: SideId) => stores.find((s) => s.aisle === aisle && s.position === pos && s.side === side);

  const cells: ReactNode[] = [];
  const place = (key: string, row: number, col: number, node: ReactNode, span = 1) =>
    cells.push(
      <div key={key} style={{ gridRow: row, gridColumn: `${col} / span ${span}` } as CSSProperties} className="min-w-0">
        {node}
      </div>,
    );

  const stall = (s: Store | undefined) => {
    if (!s) return <div className="h-full min-h-12 rounded-[2px] border border-dashed border-hairline/30" aria-hidden />;
    const mark = marks?.get(s.id);
    const dim = marks && !mark;
    const active = highlight === s.id || mark?.cheapest;
    return (
      <Link
        ref={s.id === focusId ? focusRef : undefined}
        href={`/store/${s.id}`}
        aria-label={`${s.name}${mark ? ` ${won(mark.price)}` : ''}`}
        className={`flex h-full min-h-12 flex-col justify-center rounded-[2px] border px-1.5 py-1 leading-tight ${
          active
            ? 'border-[#b85f00] bg-[#fff1df] shadow-[0_0_0_2px_var(--color-signal)]'
            : dim
              ? 'border-hairline/50 bg-platinum/60 text-stone-500'
              : 'border-chrome bg-white shadow-[0_2px_0_var(--color-chrome)]'
        }`}
      >
        <span className="truncate text-[12px] font-bold">{s.name}</span>
        {mark && (
          <span className={`num truncate text-[12px] font-black ${mark.cheapest ? 'text-[#c25f00]' : ''}`}>
            {won(mark.price)}
          </span>
        )}
        {!marks && s.itemCount > 0 && <span className="text-[10px] font-bold text-chrome">{s.itemCount}개</span>}
      </Link>
    );
  };

  // 본통로
  for (let p = 1; p <= mainLength; p++) {
    place(`m-a-${p}`, topRow, colOf(p), stall(find('main', p, 'A')));
    place(`m-b-${p}`, bottomRow, colOf(p), stall(find('main', p, 'B')));
  }
  place(
    'main-aisle',
    aisleRow,
    1,
    <div className="carbon flex h-8 items-center justify-between rounded-[2px] px-2 text-[11px] font-bold text-nav-gold">
      <span>◀ {MARKET.west}</span>
      <span>{MARKET.east} ▶</span>
    </div>,
    cols.length,
  );

  // 세로 통로
  for (const v of verticals) {
    const vc = vColOf(v.id);
    const rows = Array.from({ length: v.length }, (_, i) => i + 1);
    const rowOf = (pos: number) => (v.direction === 'down' ? bottomRow + pos : topRow - pos);
    const span = v.direction === 'down' ? [bottomRow, bottomRow + v.length] : [topRow - v.length, topRow];
    cells.push(
      <div key={`${v.id}-aisle`} style={{ gridRow: `${span[0]} / span ${span[1]! - span[0]! + 1}`, gridColumn: vc }}>
        <div className="carbon flex h-full items-center justify-center rounded-[2px] text-[10px] font-bold text-nav-gold [writing-mode:vertical-rl]">{v.name}</div>
      </div>,
    );
    for (const pos of rows) {
      place(`${v.id}-a-${pos}`, rowOf(pos), vc - 1, stall(find(v.id, pos, 'A')));
      place(`${v.id}-b-${pos}`, rowOf(pos), vc + 1, stall(find(v.id, pos, 'B')));
    }
  }

  const template = cols.map((c) => (c.kind === 'stall' ? '76px' : '22px')).join(' ');
  return (
    <div className="plate p-1.5" role="group" aria-label="청량리 청과물시장 지도">
      <div ref={scroller} className="overflow-x-auto overscroll-x-contain pb-1">
        <div className="grid gap-1" style={{ gridTemplateColumns: template, gridTemplateRows: Array.from({ length: up + 3 + down }, (_, i) => (i + 1 === aisleRow ? '32px' : 'minmax(48px, auto)')).join(' ') }}>
          {cells}
        </div>
      </div>
    </div>
  );
}
