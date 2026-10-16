import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { Link } from '../components/Link.tsx';
import { Empty, ErrorBox, Loading } from '../components/States.tsx';
import { dayLabel, WholesaleRow } from '../components/Wholesale.tsx';

export function WholesalePage() {
  const [day, setDay] = useState<string | undefined>(undefined);
  const q = useQuery({ queryKey: ['wholesale', day ?? 'latest'], queryFn: () => api.wholesale(day), placeholderData: keepPreviousData });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const { days, items } = q.data;
  const cur = q.data.day;
  if (!cur) return <Empty title="도매 시세 없음" />;
  const i = days.indexOf(cur);
  const older = days[i + 1];
  const newer = i > 0 ? days[i - 1] : undefined;

  return (
    <div className="space-y-3">
      <h1 className="sr-only">도매 시세</h1>
      <div className="carbon sticky z-10 flex items-center gap-1 rounded-[4px] p-1" style={{ top: 'calc(var(--header-h) + 4px)' }}>
        <button onClick={() => setDay(older)} disabled={!older} aria-label="이전 거래일" className="min-h-11 min-w-11 rounded-[3px] text-xl font-black text-nav-gold disabled:opacity-30">
          ‹
        </button>
        <label className="relative flex-1 text-center">
          <span className="font-display text-base font-black text-white">{dayLabel(cur)}</span>
          <select value={cur} onChange={(e) => setDay(e.target.value)} aria-label="거래일" className="absolute inset-0 opacity-0">
            {days.map((d) => (
              <option key={d} value={d}>{dayLabel(d)}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setDay(newer)} disabled={!newer} aria-label="다음 거래일" className="min-h-11 min-w-11 rounded-[3px] text-xl font-black text-nav-gold disabled:opacity-30">
          ›
        </button>
      </div>
      <p className="text-right text-[11px] font-bold text-carbon">KAMIS 서울 도매 · 전 거래일 대비</p>
      <ul className={`space-y-2 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
        {items.map((it) => (
          <li key={it.slug}>
            <Link href={`/item/${it.slug}`} className="plate-white block p-2.5">
              <p className="mb-1 font-bold">
                {it.emoji} {it.name}
              </p>
              <div className="space-y-1">
                {it.prices.map((p, k) => (
                  <WholesaleRow key={`${p.kind}${p.rank}`} p={p} big={k === 0} />
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
