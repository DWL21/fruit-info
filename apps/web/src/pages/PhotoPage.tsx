import { useQuery } from '@tanstack/react-query';
import { CATALOG, timeAgo, won, type Box } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { ErrorBox, Loading } from '../components/States.tsx';
import { Link } from '../components/Link.tsx';
import { navigate } from '../lib/router.ts';

function BoxRect({ b, stroke, fill }: { b: Box; stroke: string; fill: string }) {
  return <rect x={b.x / 10} y={b.y / 10} width={b.w / 10} height={b.h / 10} fill={fill} stroke={stroke} strokeWidth={3} vectorEffect="non-scaling-stroke" />;
}

export function PhotoPage({ id, focus }: { id: string; focus: number | null }) {
  const q = useQuery({ queryKey: ['photo', id], queryFn: () => api.photo(id) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const { photo, observations } = q.data;
  const shown = focus ? observations.filter((o) => o.id === focus) : observations;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/store/${photo.storeId}`} className="text-sm font-bold text-carbon">‹ {photo.storeName}</Link>
        <h1 className="display-outline mt-1 text-2xl">{photo.storeName}</h1>
        <p className="text-xs font-bold text-carbon">{new Date(photo.takenAt).toLocaleString('ko-KR')} 촬영 ({timeAgo(photo.takenAt)})</p>
      </div>
      <figure className="plate relative overflow-hidden bg-carbon p-1">
        <img src={photo.url} alt={`${photo.storeName} 매대 전체 사진`} className="w-full" style={{ aspectRatio: `${photo.width}/${photo.height}` }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {shown.map((o) => (
            <g key={o.id}>
              {o.productBox && <BoxRect b={o.productBox} stroke="#4ade80" fill="none" />}
              {o.priceBox && <BoxRect b={o.priceBox} stroke="#f97316" fill="rgba(249,115,22,0.15)" />}
            </g>
          ))}
        </svg>
        <figcaption className="carbon flex gap-3 px-2 py-2 text-[11px] font-bold text-sky">
          <span><span className="mr-1 inline-block size-2 bg-orange-500" />가격표</span>
          <span><span className="mr-1 inline-block size-2 bg-green-400" />진열 상품</span>
          
        </figcaption>
      </figure>
      <ul className="plate-platinum divide-y divide-hairline/40 overflow-hidden">
        {observations.map((o) => {
          const c = CATALOG.find((x) => x.slug === o.itemSlug);
          const active = focus === o.id;
          return (
            <li key={o.id}>
              <button
                onClick={() => navigate(`/photo/${id}${active ? '' : `?obs=${o.id}`}`, true)}
                aria-pressed={active}
                className={`flex min-h-12 w-full items-center justify-between px-3 py-2 text-left ${active ? 'bg-white shadow-[inset_4px_0_0_var(--color-signal)]' : ''}`}
              >
                <span>
                  {c?.emoji} <span className="font-semibold">{c?.name}</span> <span className="text-sm text-chrome">{[o.variety, o.rawName !== c?.name ? o.rawName : null].filter(Boolean).join(' ')}</span>
                </span>
                <span className="num font-bold">
                  {won(o.price)}
                  {o.unit && <span className="ml-1 text-xs font-bold text-chrome">/{o.unit}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {focus && (
        <button onClick={() => navigate(`/photo/${id}`, true)} className="btn-carbon min-h-11 w-full">
          전체 보기
        </button>
      )}
    </div>
  );
}
