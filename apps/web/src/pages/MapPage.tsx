import { useQuery } from '@tanstack/react-query';
import { AISLES, placeName, timeAgo } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { AisleMap } from '../components/AisleMap.tsx';
import { Link } from '../components/Link.tsx';
import { Empty, ErrorBox, Loading, SectionTitle } from '../components/States.tsx';

export function MapPage() {
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });
  if (stores.isPending) return <Loading />;
  if (stores.isError) return <ErrorBox error={stores.error} retry={() => stores.refetch()} />;
  if (!stores.data.length) return <Empty title="가게 없음" />;
  return (
    <div className="space-y-4">
      <h1 className="display-outline text-[28px]">시장 지도</h1>
      <AisleMap stores={stores.data} />
      {AISLES.map((a) => {
        const list = stores.data.filter((s) => s.aisle === a.id);
        if (!list.length) return null;
        return (
          <section key={a.id}>
            <SectionTitle>{a.name}</SectionTitle>
            <ul className="plate-platinum divide-y divide-hairline/40 rounded-t-none">
              {list.map((s) => (
                <li key={s.id}>
                  <Link href={`/store/${s.id}`} className="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{s.name}</span>
                      <span className="block text-xs font-bold text-chrome">{placeName(s)}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs font-bold text-chrome">
                      {s.itemCount ? `과일 ${s.itemCount}` : '—'}
                      {s.lastPhotoAt && <span className="block font-normal">{timeAgo(s.lastPhotoAt)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
