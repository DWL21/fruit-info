import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useLocation } from '../lib/router.ts';
import { WalkGuide } from '../components/WalkGuide.tsx';
import { Empty, ErrorBox, Loading } from '../components/States.tsx';

export function MapPage() {
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });
  const seg = new URLSearchParams(useLocation().split('?')[1]).get('seg');
  if (stores.isPending) return <Loading />;
  if (stores.isError) return <ErrorBox error={stores.error} retry={() => stores.refetch()} />;
  if (!stores.data.length) return <Empty title="가게 없음" />;
  return (
    <div className="space-y-3">
      <h1 className="display-outline text-[28px]">시장 지도</h1>
      <WalkGuide stores={stores.data} sticky initialSegment={seg ? Number(seg) - 1 : undefined} />
    </div>
  );
}
