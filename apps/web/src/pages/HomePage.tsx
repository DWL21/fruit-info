import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CATALOG, timeAgo, won } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { Link } from '../components/Link.tsx';
import { Empty, ErrorBox, Loading, SectionTitle } from '../components/States.tsx';
import { FeedCard } from '../components/FeedCard.tsx';

export function HomePage() {
  const items = useQuery({ queryKey: ['items'], queryFn: api.items });
  const feed = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => api.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === 12 ? last.at(-1)!.photo.takenAt : undefined),
  });
  const entries = feed.data?.pages.flat() ?? [];
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.replace(/\s/g, '');
    if (!term) return items.data ?? [];
    const slugs = new Set(CATALOG.filter((c) => [c.name, ...c.aliases].some((n) => n.includes(term))).map((c) => c.slug));
    return (items.data ?? []).filter((i) => slugs.has(i.slug));
  }, [items.data, q]);

  return (
    <div>
      <h1 className="sr-only">오늘의 과일 시세</h1>
      {/* 과일별 최저가: 스토리처럼 가로로 넘긴다 */}
      {!!items.data?.length && (
        <ul className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2" aria-label="과일별 최저가">
          {items.data.map((i) => (
            <li key={i.slug} className="shrink-0">
              <Link href={`/item/${i.slug}`} className="flex w-16 flex-col items-center gap-1">
                <span className="size-16 overflow-hidden rounded-full border-[3px] border-signal bg-white p-0.5 shadow-[0_2px_0_var(--color-chrome)]">
                  {i.cropUrl ? <img src={i.cropUrl} alt="" className="size-full rounded-full object-cover" /> : <span className="flex size-full items-center justify-center text-2xl">{i.emoji}</span>}
                </span>
                <span className="w-full truncate text-center text-[11px] font-bold leading-tight">{i.emoji} {i.name}</span>
                <span className="num w-full truncate text-center text-[11px] font-black leading-none">{won(i.minPrice)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-3 space-y-5" aria-label="최신 매대 사진">
        {feed.isPending ? (
          <Loading />
        ) : feed.isError ? (
          <ErrorBox error={feed.error} retry={() => feed.refetch()} />
        ) : entries.length ? (
          entries.map((e) => <FeedCard key={e.photo.id} entry={e} />)
        ) : (
          <Empty title="사진 없음" />
        )}
        {feed.hasNextPage && (
          <button onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage} className="btn-carbon min-h-11 w-full">
            {feed.isFetchingNextPage ? '불러오는 중' : '더 보기'}
          </button>
        )}
      </section>

      <div className="mt-8">
        <SectionTitle>과일별 최저가</SectionTitle>
      </div>
      <label className="mt-2 block">
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
