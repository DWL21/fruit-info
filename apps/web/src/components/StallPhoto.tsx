import { useState } from 'react';
import { CATALOG, isTodayKst, timeAgo, won, type Observation, type Photo } from '@fruit/shared';
import { Link } from './Link.tsx';

/**
 * 가게 매대 전체 사진에 가격표 위치를 번호로 표시하고, 아래 가격 목록과 같은 번호로 잇는다.
 */
export function StallPhoto({ photo, observations }: { photo: Photo; observations: Observation[] }) {
  const [active, setActive] = useState<number | null>(null);
  const list = [...observations].sort((a, b) => (a.priceBox?.x ?? 0) - (b.priceBox?.x ?? 0) || (a.priceBox?.y ?? 0) - (b.priceBox?.y ?? 0));
  const today = isTodayKst(photo.takenAt);

  return (
    <article className="plate overflow-hidden p-1.5">
      <div className="relative overflow-hidden rounded-[3px] border border-chrome bg-carbon" style={{ aspectRatio: `${photo.width}/${photo.height}` }}>
        <img src={photo.url} alt={`${photo.storeName} 매대 전체`} loading="lazy" className="absolute inset-0 size-full object-cover" />
        {list.map((o, i) =>
          o.priceBox ? (
            <button
              key={o.id}
              onClick={() => setActive(active === o.id ? null : o.id)}
              aria-label={`${i + 1}번 가격표`}
              className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-black shadow ${
                active === o.id ? 'z-10 scale-125 border-[#8a4700] bg-signal text-white' : 'border-carbon bg-white text-carbon'
              }`}
              style={{ left: `${(o.priceBox.x + o.priceBox.w / 2) / 10}%`, top: `${(o.priceBox.y + o.priceBox.h / 2) / 10}%` }}
            >
              {i + 1}
            </button>
          ) : null,
        )}
        {active !== null &&
          (() => {
            const o = list.find((x) => x.id === active);
            const b = o?.priceBox;
            return b ? (
              <span
                className="pointer-events-none absolute border-2 border-signal bg-signal/15"
                style={{ left: `${b.x / 10}%`, top: `${b.y / 10}%`, width: `${b.w / 10}%`, height: `${b.h / 10}%` }}
                aria-hidden
              />
            ) : null;
          })()}
        <span className={`absolute left-2 top-2 rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold ${today ? 'chip-amber' : 'bg-muted-indigo text-white'}`}>
          {today ? '오늘' : '이전'} · {timeAgo(photo.takenAt)} 촬영
        </span>
        <Link href={`/photo/${photo.id}`} className="carbon absolute right-2 top-2 rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold">
          크게 보기 ›
        </Link>
      </div>
      <ol className="mt-1.5 divide-y divide-hairline/40 overflow-hidden rounded-[3px] bg-platinum">
        {list.map((o, i) => {
          const c = CATALOG.find((x) => x.slug === o.itemSlug);
          return (
            <li key={o.id}>
              <button
                onClick={() => setActive(active === o.id ? null : o.id)}
                aria-pressed={active === o.id}
                className={`flex min-h-12 w-full items-center gap-2 px-2.5 py-2 text-left ${active === o.id ? 'bg-white shadow-[inset_4px_0_0_var(--color-signal)]' : ''}`}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-carbon bg-white text-xs font-black">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {c?.emoji} <b>{c?.name ?? o.rawName}</b>
                  {o.variety && <span className="ml-1 text-sm text-chrome">{o.variety}</span>}
                </span>
                <span className="num shrink-0 font-display font-black">
                  {won(o.price)}
                  {o.unit && <span className="ml-1 font-sans text-xs font-bold text-chrome">/{o.unit}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
