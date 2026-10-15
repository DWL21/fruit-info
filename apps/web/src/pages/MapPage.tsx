import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { AisleMap } from '../components/AisleMap.tsx';
import { Empty, ErrorBox, Loading } from '../components/States.tsx';

export function MapPage() {
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });
  if (stores.isPending) return <Loading />;
  if (stores.isError) return <ErrorBox error={stores.error} retry={() => stores.refetch()} />;
  return (
    <div className="space-y-3">
      <h1 className="display-outline text-[28px]">시장 지도</h1>
      {stores.data.length ? <AisleMap stores={stores.data} /> : <Empty title="가게 없음" />}
    </div>
  );
}
