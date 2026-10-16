import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MARKET, SEGMENT_STARTS, compactAddresses, segmentIndex, timeAgo, won, type Store, type VerticalAisle } from '@fruit/shared';
import { Link } from './Link.tsx';
import { MiniMap, type StallTone } from './MiniMap.tsx';

/** 과일 상세에서 가게 칸에 붙는 번호·가격 */
export interface GuideMark {
  label: string;
  best?: boolean;
  price: number;
  unit?: string | null;
  /** 누르면 스크롤할 요소 id */
  target: string;
}

interface Segment {
  i: number;
  north: Store[];
  south: Store[];
  junctions: { v: VerticalAisle; west: Store[]; east: Store[] }[];
}

const byPos = (a: Store, b: Store) => a.position - b.position || a.name.localeCompare(b.name, 'ko');

function buildSegments(stores: Store[]): Segment[] {
  const segs: Segment[] = SEGMENT_STARTS.map((_, i) => ({ i, north: [], south: [], junctions: [] }));
  for (const v of MARKET.verticals) {
    const west = stores.filter((s) => s.aisle === v.id && s.side === 'A').sort(byPos);
    const east = stores.filter((s) => s.aisle === v.id && s.side === 'B').sort(byPos);
    if (west.length || east.length) segs[segmentIndex({ aisle: v.id, position: 0 })]!.junctions.push({ v, west, east });
  }
  for (const s of stores) {
    if (s.aisle !== 'main') continue;
    segs[segmentIndex(s)]![s.side === 'A' ? 'north' : 'south'].push(s);
  }
  for (const g of segs) {
    g.north.sort(byPos);
    g.south.sort(byPos);
  }
  return segs.filter((g) => g.north.length || g.south.length || g.junctions.length);
}

/**
 * 걷는 순서 안내도. 본통로를 세로로 돌려 위=제기동역 쪽, 아래=청량리역 쪽.
 * 왼쪽 열 북쪽 가게, 오른쪽 열 남쪽 가게(왕산로 쪽)와 세로줄 갈림길.
 * marks가 있으면 그 가게만 번호·가격과 함께 보인다.
 */
export function WalkGuide({ stores, marks, sticky = false, initialSegment }: { stores: Store[]; marks?: Map<number, GuideMark>; sticky?: boolean; initialSegment?: number }) {
  const shown = useMemo(() => (marks ? stores.filter((s) => marks.has(s.id)) : stores), [stores, marks]);
  const segments = useMemo(() => buildSegments(shown), [shown]);
  const tones = useMemo(() => {
    if (!marks) return undefined;
    const t = new Map<number, StallTone>();
    for (const [id, m] of marks) t.set(id, m.best ? 'best' : 'on');
    return t;
  }, [marks]);

  const [active, setActive] = useState(segments[0]?.i ?? 0);
  const refs = useRef(new Map<number, HTMLElement>());
  const head = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(0);

  useLayoutEffect(() => {
    if (!sticky || !head.current) return;
    const el = head.current;
    setHeadH(el.offsetHeight);
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sticky]);

  /** 고정 영역 아래 기준선(화면 y) */
  const line = useCallback(() => {
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
    return sticky ? hh + headH + 12 : hh + 12;
  }, [sticky, headH]);

  /** 미니맵을 눌러 이동하는 동안은 스크롤 위치로 구간을 바꾸지 않는다(중간 구간이 차례로 깜빡이지 않게) */
  const jumping = useRef<number | null>(null);

  useEffect(() => {
    if (!sticky) return;
    let raf = 0;
    const onScroll = () => {
      if (jumping.current !== null) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = line();
        let cur = segments[0]?.i ?? 0;
        for (const g of segments) {
          const el = refs.current.get(g.i);
          if (el && el.getBoundingClientRect().top <= y) cur = g.i;
        }
        setActive(cur);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sticky, segments, line]);

  const jump = useCallback(
    (i: number, smooth = true) => {
      // 보이지 않는 구간을 누르면 가장 가까운 보이는 구간으로
      const near = [...segments].sort((a, b) => Math.abs(a.i - i) - Math.abs(b.i - i))[0];
      const el = refs.current.get(i) ?? (near ? refs.current.get(near.i) : undefined);
      if (!el) return;
      const target = refs.current.has(i) ? i : (near?.i ?? i);
      setActive(target);
      if (jumping.current !== null) window.clearTimeout(jumping.current);
      const release = () => {
        if (jumping.current !== null) window.clearTimeout(jumping.current);
        jumping.current = null;
        window.removeEventListener('scrollend', release);
      };
      jumping.current = window.setTimeout(release, 1200);
      window.addEventListener('scrollend', release, { once: true });
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - line() + 4, behavior: smooth ? 'smooth' : 'auto' });
      if (!smooth) release();
    },
    [segments, line],
  );

  /** 펼친 갈림길이 고정 영역 위로 밀려 있으면 맨 위가 보이게 */
  const reveal = useCallback(
    (el: HTMLElement) => {
      const top = el.getBoundingClientRect().top - line() + 6;
      if (top < 0) window.scrollBy({ top });
    },
    [line],
  );

  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || initialSegment === undefined || (sticky && !headH)) return;
    jumped.current = true;
    jump(initialSegment, false);
    // 첫 로드면 브라우저가 load 시점에 스크롤을 되돌리므로 한 번 더
    if (document.readyState === 'complete') return;
    const again = () => jump(initialSegment, false);
    window.addEventListener('load', again, { once: true });
    return () => window.removeEventListener('load', again);
  }, [initialSegment, jump, sticky, headH]);

  const visible = useMemo(() => new Set(segments.map((g) => g.i)), [segments]);

  return (
    <div>
      <div ref={head} className={sticky ? 'sticky z-10 -mx-3 bg-canvas/95 px-3 pt-1 pb-1.5 backdrop-blur-sm' : ''} style={sticky ? { top: 'var(--header-h)' } : undefined}>
        <MiniMap stores={stores} active={active} onPick={jump} tones={tones} segments={marks ? visible : undefined} />
        <div className="mt-1.5 grid grid-cols-[1fr_14px_1fr] gap-x-1.5 text-center text-[11px] font-bold tracking-[0.5px]">
          <span className="carbon rounded-[2px] py-1 text-nav-gold">북쪽</span>
          <span />
          <span className="carbon rounded-[2px] py-1 text-nav-gold">남쪽 · {MARKET.south}</span>
        </div>
      </div>

      <p className="carbon mt-2 rounded-t-[4px] py-1.5 text-center text-[12px] font-bold tracking-[0.5px] text-nav-gold">▲ {MARKET.west}</p>
      <div className="space-y-2 py-2">
        {segments.map((g) => (
          <section
            key={g.i}
            ref={(el) => {
              if (el) refs.current.set(g.i, el);
              else refs.current.delete(g.i);
            }}
            aria-label={`구간 ${g.i + 1}`}
          >
            <SegmentHead g={g} />
            <div className="plate grid grid-cols-[1fr_14px_1fr] gap-x-1.5 rounded-t-none p-1.5">
              <ul className="space-y-1.5">
                {g.north.map((s) => (
                  <li key={s.id}>
                    <Cell s={s} m={marks?.get(s.id)} />
                  </li>
                ))}
              </ul>
              <div aria-hidden className="rounded-[2px] bg-carbon bg-[linear-gradient(var(--color-nav-gold)_50%,transparent_50%)] bg-[length:2px_10px] bg-center bg-repeat-y" />
              <ul className="flex flex-col gap-1.5">
                {mergeSouth(g).map((x) =>
                  'v' in x ? (
                    <li key={x.v.id} className="flex-1">
                      <Junction j={x} marks={marks} stickTop={sticky ? `calc(var(--header-h) + ${headH + 6}px)` : undefined} reveal={reveal} />
                    </li>
                  ) : (
                    <li key={x.id}>
                      <Cell s={x} m={marks?.get(x.id)} />
                    </li>
                  ),
                )}
              </ul>
            </div>
          </section>
        ))}
      </div>
      <p className="carbon rounded-b-[4px] py-1.5 text-center text-[12px] font-bold tracking-[0.5px] text-nav-gold">▼ {MARKET.east}</p>
    </div>
  );
}

/** 남쪽 열: 가게와 갈림길을 본통로 위치 순서로 */
function mergeSouth(g: Segment): (Store | Segment['junctions'][number])[] {
  const items: { at: number; x: Store | Segment['junctions'][number] }[] = [
    ...g.south.map((s) => ({ at: s.position, x: s })),
    ...g.junctions.map((j) => ({ at: j.v.from, x: j })),
  ];
  return items.sort((a, b) => a.at - b.at).map((i) => i.x);
}

function SegmentHead({ g }: { g: Segment }) {
  const north = compactAddresses(g.north.map((s) => s.address));
  const south = compactAddresses(g.south.map((s) => s.address));
  return (
    <h2 className="carbon grid grid-cols-[1fr_auto_1fr] items-center gap-x-1.5 rounded-t-[4px] border border-chrome px-2 py-1.5 text-[12px] font-bold leading-tight">
      <span className="text-nav-gold">{north || '—'}</span>
      <span className="chip-amber flex size-6 items-center justify-center rounded-full text-[12px] font-black">{g.i + 1}</span>
      <span className="text-right text-nav-gold">{south || (g.junctions.length ? '갈림길' : '—')}</span>
    </h2>
  );
}

function Cell({ s, m }: { s: Store; m?: GuideMark }) {
  if (m)
    return (
      <a
        href={`#${m.target}`}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(m.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        className={`flex min-h-12 items-center gap-1.5 px-1.5 py-1 ${m.best ? 'btn-signal' : 'plate-white'}`}
      >
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-black ${m.best ? 'border-white bg-white text-signal' : 'border-carbon bg-carbon text-white'}`}>{m.label}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-tight">{s.name}</span>
          <span className="block truncate leading-tight">
            <span className="num font-display text-[15px] font-black tracking-tight">{won(m.price)}</span>
            {m.unit && <span className="ml-1 text-[11px] font-bold">{m.unit}</span>}
          </span>
        </span>
      </a>
    );
  return (
    <Link href={`/store/${s.id}`} className="plate-white flex min-h-11 flex-col justify-center px-2 py-1">
      <span className="block truncate text-[14px] font-bold leading-tight">{s.name}</span>
      {s.itemCount > 0 && (
        <span className="mt-0.5 block truncate text-[11px] font-bold text-chrome">
          과일 {s.itemCount}
          {s.lastPhotoAt && ` · ${timeAgo(s.lastPhotoAt)}`}
        </span>
      )}
    </Link>
  );
}

/** 세로줄 갈림길. 접혀 있으면 구간을 지나는 동안 열 위쪽에 붙어 있는다. */
function Junction({ j, marks, stickTop, reveal }: { j: Segment['junctions'][number]; marks?: Map<number, GuideMark>; stickTop?: string; reveal: (el: HTMLElement) => void }) {
  const count = j.west.length + j.east.length;
  const [open, setOpen] = useState(!!marks);
  const stick = stickTop && !open;
  return (
    <details
      open={open}
      onToggle={(e) => {
        const el = e.currentTarget;
        setOpen(el.open);
        if (el.open) requestAnimationFrame(() => reveal(el));
      }}
      className={`group plate overflow-hidden bg-sky ${stick ? 'sticky z-[5]' : ''}`}
      style={stick ? { top: stickTop } : undefined}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 [&::-webkit-details-marker]:hidden">
        <span className="chip-amber shrink-0 px-1 py-0.5 text-[10px]">갈림길</span>
        <span className="min-w-0 flex-1 text-[12px] font-bold leading-tight">{j.v.name}</span>
        <span className="shrink-0 text-[11px] font-bold text-chrome">
          {count}
          <span className="ml-0.5 inline-block transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="space-y-1.5 border-t border-chrome/50 p-1.5">
        <Side title="서쪽" list={j.west} marks={marks} />
        <Side title="동쪽" list={j.east} marks={marks} />
        <p className="rounded-[2px] bg-[#f3d46a] py-0.5 text-center text-[11px] font-bold">{MARKET.south}</p>
      </div>
    </details>
  );
}

function Side({ title, list, marks }: { title: string; list: Store[]; marks?: Map<number, GuideMark> }): ReactNode {
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold tracking-[0.5px] text-chrome">{title}</p>
      <ul className="space-y-1.5">
        {list.map((s) => (
          <li key={s.id}>
            <Cell s={s} m={marks?.get(s.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
