import { useQuery } from '@tanstack/react-query';
import { CATALOG, placeName, segmentIndex, timeAgo } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { MiniMap } from '../components/MiniMap.tsx';
import { navigate } from '../lib/router.ts';
import { PriceCard } from '../components/PriceCard.tsx';
import { Empty, ErrorBox, Loading, SectionTitle } from '../components/States.tsx';
import { Link } from '../components/Link.tsx';

export function StorePage({ id }: { id: number }) {
  const detail = useQuery({ queryKey: ['store', id], queryFn: () => api.store(id) });
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });
  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorBox error={detail.error} retry={() => detail.refetch()} />;
  const { store, observations, photos } = detail.data;
  const name = (slug: string) => CATALOG.find((c) => c.slug === slug);
  const sorted = [...observations].sort((a, b) => a.itemSlug.localeCompare(b.itemSlug) || a.price - b.price);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/map?seg=${segmentIndex(store) + 1}`} className="text-sm font-bold text-carbon">‹ 시장 지도</Link>
        <h1 className="display-outline mt-1 text-[28px]">{store.name}</h1>
        <p className="mt-1 text-sm font-bold text-carbon">
          {[`구간 ${segmentIndex(store) + 1}`, placeName(store), store.address].filter(Boolean).join(' · ')}
          {store.note && ` · ${store.note}`}
        </p>
        {store.lastPhotoAt && <p className="text-xs font-bold text-chrome">마지막 촬영 {timeAgo(store.lastPhotoAt)}</p>}
      </div>
      {stores.data && <MiniMap stores={stores.data} highlight={store.id} active={segmentIndex(store)} onPick={(i) => navigate(`/map?seg=${i + 1}`)} />}
      <section>
        <SectionTitle>과일</SectionTitle>
        {sorted.length ? (
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {sorted.map((o) => {
              const c = name(o.itemSlug);
              return (
                <li key={o.id}>
                  <PriceCard o={o} showStore={false} title={`${c?.emoji ?? ''} ${c?.name ?? o.rawName}`} />
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="시세 없음" />
        )}
      </section>
      {photos.length > 0 && (
        <section>
          <SectionTitle>매대 사진</SectionTitle>
          <ul className="plate mt-0 grid grid-cols-3 gap-1.5 rounded-t-none p-1.5">
            {photos.map((p) => (
              <li key={p.id}>
                <Link href={`/photo/${p.id}`} className="block">
                  <img src={p.url} alt={`${timeAgo(p.takenAt)} 촬영한 매대`} loading="lazy" className="aspect-square w-full rounded-[2px] border border-chrome object-cover" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
