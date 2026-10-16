import { won, type WholesalePrice } from '@fruit/shared';

/** '홍로(10kg)' → '홍로' (단위는 따로 보여준다) */
export const kindLabel = (kind: string) => kind.replace(/\s*\([^)]*\)\s*$/, '') || kind;

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export function dayLabel(day: string) {
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${WEEK[new Date(`${day}T12:00:00Z`).getUTCDay()]})`;
}

/** 직전 거래일 대비 (오르면 빨강, 내리면 파랑) */
export function Change({ price, prev }: { price: number; prev: number | null }) {
  if (prev === null) return null;
  const diff = price - prev;
  if (diff === 0) return <span className="text-[11px] font-bold text-chrome">-</span>;
  return (
    <span className={`num text-[11px] font-bold ${diff > 0 ? 'text-primary' : 'text-[#1f5fbf]'}`}>
      {diff > 0 ? '▲' : '▼'} {won(Math.abs(diff))}
    </span>
  );
}

export function WholesaleRow({ p, big = false }: { p: WholesalePrice; big?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-0 flex-1 truncate text-sm">
        <b>{kindLabel(p.kind)}</b> <span className="text-xs text-chrome">{p.rank} · {p.unit}</span>
      </span>
      <span className={`num shrink-0 text-right font-display font-black ${big ? 'text-xl' : 'text-base'}`}>{won(p.price)}</span>
      <span className="w-16 shrink-0 text-right">
        <Change price={p.price} prev={p.prev} />
      </span>
    </div>
  );
}

/** 기간 가격 흐름 (작은 선 그래프) */
export function Sparkline({ points }: { points: { day: string; price: number }[] }) {
  if (points.length < 2) return null;
  const W = 300;
  const H = 64;
  const ps = points.map((p) => p.price);
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  const x = (i: number) => (i / (points.length - 1)) * (W - 8) + 4;
  const y = (v: number) => (hi === lo ? H / 2 : H - 6 - ((v - lo) / (hi - lo)) * (H - 12));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-16 w-full" role="img" aria-label={`${points[0]!.day}부터 ${last.day}까지 ${won(lo)}~${won(hi)}`}>
        <path d={d} fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.price)} r="3" fill="var(--color-primary)" />
      </svg>
      <figcaption className="num flex justify-between text-[11px] font-bold text-chrome">
        <span>{points[0]!.day.slice(5).replace('-', '/')}</span>
        <span>
          {won(lo)} ~ {won(hi)}
        </span>
        <span>{last.day.slice(5).replace('-', '/')}</span>
      </figcaption>
    </figure>
  );
}
