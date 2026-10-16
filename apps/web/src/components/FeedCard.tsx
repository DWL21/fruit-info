import { placeName, timeAgo } from '@fruit/shared';
import type { FeedEntry } from '../lib/api.ts';
import { Link } from './Link.tsx';
import { StallPhoto } from './StallPhoto.tsx';

/** 피드 한 장: 가게 머리글 + 매대 전체 사진(가격표 번호) + 가격 목록. 분석 중이면 흐린 미리보기. */
export function FeedCard({ entry }: { entry: FeedEntry }) {
  const { photo, store, observations } = entry;
  const done = photo.status === 'done';
  return (
    <article className="space-y-1.5">
      <header className="flex items-center gap-2 px-0.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-signal bg-white text-sm font-black text-carbon" aria-hidden>
          {photo.storeName.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/store/${photo.storeId}`} className="block truncate font-bold leading-tight">
            {photo.storeName}
            {store?.stallNo && <span className="chip-amber ml-1.5 px-1 text-[11px]">{store.stallNo}</span>}
          </Link>
          <span className="block truncate text-[11px] font-bold text-chrome">{store ? placeName(store) : ''}</span>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-chrome">{timeAgo(photo.takenAt)}</span>
      </header>
      {done && observations.length ? (
        <StallPhoto photo={photo} observations={observations} />
      ) : (
        <div className="plate overflow-hidden p-1.5">
          <div className="relative overflow-hidden rounded-[3px] border border-chrome bg-carbon" style={{ aspectRatio: `${photo.width}/${photo.height}` }}>
            <img src={photo.url} alt={`${photo.storeName} 매대`} loading="lazy" className="absolute inset-0 size-full object-cover" />
            {!done && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="carbon flex items-center gap-2 rounded-[2px] px-3 py-1.5 text-sm font-bold">
                  <span className="size-2 animate-pulse rounded-full bg-signal" />
                  분석 중
                </span>
              </span>
            )}
          </div>
          {done && <p className="px-1 pt-1.5 text-xs font-bold text-chrome">시세 없음</p>}
        </div>
      )}
    </article>
  );
}
