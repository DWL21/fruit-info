import { isTodayKst, placeName, timeAgo, won, type Observation } from '@fruit/shared';
import { Link } from './Link.tsx';

export function FreshBadge({ at }: { at: string }) {
  const today = isTodayKst(at);
  return (
    <span className={`inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold ${today ? 'chip-amber' : 'bg-muted-indigo text-white'}`}>
      {today ? '오늘' : '이전'} · {timeAgo(at)} 촬영
    </span>
  );
}

export const placeLabel = (o: Pick<Observation, 'storeAisle' | 'storePosition' | 'storeSide' | 'storeAddress'>) =>
  [placeName({ aisle: o.storeAisle, position: o.storePosition, side: o.storeSide }), o.storeAddress].filter(Boolean).join(' · ');

/** 시세 한 건: 진열 상품과 가격표가 함께 보이는 크롭 사진이 핵심이다. */
export function PriceCard({ o, rank, showStore = true, title }: { o: Observation; rank?: number; showStore?: boolean; title?: string }) {
  return (
    <article className="plate overflow-hidden p-1.5">
      <Link href={`/photo/${o.photoId}?obs=${o.id}`} className="relative block overflow-hidden rounded-[3px] border border-chrome bg-carbon" aria-label={`${o.storeName} ${o.rawName} 사진 크게 보기`}>
        {o.cropUrl ? (
          <img src={o.cropUrl} alt={`${o.storeName}의 ${o.rawName} 진열과 가격표`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm text-sky">사진 위치 정보 없음 · 원본 보기</div>
        )}
        {rank !== undefined && (
          <span className={`absolute left-2 top-2 flex items-center gap-1 px-2 py-1 text-xs font-black ${rank === 1 ? 'btn-signal' : 'rounded-[2px] border border-chrome bg-white text-carbon'}`}>
            {rank}
            {rank === 1 && <span className="font-bold">최저가</span>}
          </span>
        )}
        <span className="carbon absolute bottom-2 right-2 rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold">원본 보기 ›</span>
      </Link>
      <div className="flex items-start justify-between gap-3 px-1.5 pt-2 pb-1">
        <div className="min-w-0">
          {showStore ? (
            <Link href={`/store/${o.storeId}`} className="block truncate text-base font-bold underline-offset-2 hover:underline">
              {o.storeName}
            </Link>
          ) : (
            <p className="truncate text-base font-bold">{title ?? o.rawName}</p>
          )}
          <p className="mt-0.5 truncate text-xs font-bold text-chrome">{showStore ? placeLabel(o) : o.variety ?? ' '}</p>
          {showStore && <p className="mt-0.5 truncate text-sm">{[o.variety, o.rawName].filter(Boolean).join(' ')}</p>}
          <div className="mt-1.5">
            <FreshBadge at={o.observedAt} />
          </div>
        </div>
        <div className="plate-white shrink-0 px-2.5 py-1.5 text-right">
          <p className="num font-display text-2xl font-black tracking-tight">{won(o.price)}</p>
          <p className="text-xs font-bold text-chrome">{o.unit ?? '단위 미표기'}</p>
        </div>
      </div>
    </article>
  );
}
