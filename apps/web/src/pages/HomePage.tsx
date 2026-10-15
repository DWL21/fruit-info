import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CATALOG, timeAgo, won } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { Link } from '../components/Link.tsx';
import { Empty, ErrorBox, Loading } from '../components/States.tsx';

export function HomePage() {
  const items = useQuery({ queryKey: ['items'], queryFn: api.items });
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.replace(/\s/g, '');
    if (!term) return items.data ?? [];
    const slugs = new Set(CATALOG.filter((c) => [c.name, ...c.aliases].some((n) => n.includes(term))).map((c) => c.slug));
    return (items.data ?? []).filter((i) => slugs.has(i.slug));
  }, [items.data, q]);

  return (
    <div>
      <section className="plate relative overflow-hidden bg-lavender p-4">
        <h1 className="display-outline text-[28px] leading-[1.15]">오늘의 과일 시세</h1>
        <span className="pointer-events-none absolute -right-3 -bottom-4 text-[88px] opacity-90" aria-hidden>🍊</span>
      </section>
      <label className="mt-4 block">
        <span className="sr-only">과일 검색</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="과일 검색"
          className="field min-h-12 w-full px-3 text-base"
        />
      </label>

      <div className="mt-4">
        {items.isPending ? (
          <Loading />
        ) : items.isError ? (
          <ErrorBox error={items.error} retry={() => items.refetch()} />
        ) : !filtered.length ? (
          <Empty title={q ? `'${q}' 시세 없음` : '시세 없음'} />
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {filtered.map((i) => (
              <li key={i.slug}>
                <Link href={`/item/${i.slug}`} className="plate block overflow-hidden p-1 active:translate-y-px">
                  <div className="relative aspect-square overflow-hidden rounded-[3px] border border-chrome bg-carbon">
                    {i.cropUrl ? <img src={i.cropUrl} alt="" loading="lazy" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-5xl">{i.emoji}</span>}
                    <span className="carbon absolute left-1.5 top-1.5 rounded-[2px] px-2 py-0.5 text-sm font-bold">
                      {i.emoji} {i.name}
                    </span>
                  </div>
                  <div className="px-1.5 pt-2 pb-1">
                    <p className="truncate text-[11px] font-bold text-carbon"><span className="chip-amber mr-1 px-1">최저가</span>{i.minStoreName}</p>
                    <p className="num mt-1 font-display text-xl font-black tracking-tight">
                      {won(i.minPrice)}
                      {i.minUnit && <span className="ml-1 font-sans text-xs font-bold text-chrome">/{i.minUnit}</span>}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-chrome">
                      가게 {i.storeCount}곳 · {timeAgo(i.lastObservedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
