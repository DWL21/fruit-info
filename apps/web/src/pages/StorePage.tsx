import { useQuery } from '@tanstack/react-query';
import { placeName, segmentIndex, timeAgo, type Observation } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { MiniMap } from '../components/MiniMap.tsx';
import { navigate } from '../lib/router.ts';
import { StallPhoto } from '../components/StallPhoto.tsx';
import { Empty, ErrorBox, Loading, SectionTitle } from '../components/States.tsx';
import { Link } from '../components/Link.tsx';

export function StorePage({ id }: { id: number }) {
  const detail = useQuery({ queryKey: ['store', id], queryFn: () => api.store(id) });
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });
  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorBox error={detail.error} retry={() => detail.refetch()} />;
  const { store, observations, photos } = detail.data;
  // 현재 시세를 사진별로 묶어 매대 전체 사진과 함께 보여준다.
  const byPhoto = new Map<string, Observation[]>();
  for (const o of observations) byPhoto.set(o.photoId, [...(byPhoto.get(o.photoId) ?? []), o]);
  const shown = photos.filter((p) => byPhoto.has(p.id));
  const others = photos.filter((p) => !byPhoto.has(p.id));

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/map?seg=${segmentIndex(store) + 1}`} className="text-sm font-bold text-carbon">‹ 시장 지도</Link>
        <h1 className="display-outline mt-1 text-[28px]">{store.name}</h1>
        <p className="mt-1 text-sm font-bold text-carbon">
          {[store.stallNo, `구간 ${segmentIndex(store) + 1}`, placeName(store), store.address].filter(Boolean).join(' · ')}
          {store.note && ` · ${store.note}`}
        </p>
        {store.lastPhotoAt && <p className="text-xs font-bold text-chrome">마지막 촬영 {timeAgo(store.lastPhotoAt)}</p>}
      </div>
      {stores.data && <MiniMap stores={stores.data} highlight={store.id} active={segmentIndex(store)} onPick={(i) => navigate(`/map?seg=${i + 1}`)} />}
      <section>
        <SectionTitle>시세</SectionTitle>
        {shown.length ? (
          <ul className="mt-2 space-y-3">
            {shown.map((p) => (
              <li key={p.id}>
                <StallPhoto photo={p} observations={byPhoto.get(p.id)!} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="시세 없음" />
        )}
      </section>
      {others.length > 0 && (
        <section>
          <SectionTitle>이전 사진</SectionTitle>
          <ul className="plate mt-0 grid grid-cols-3 gap-1.5 rounded-t-none p-1.5">
            {others.map((p) => (
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
