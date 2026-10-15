import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { won } from '@fruit/shared';
import { api } from '../lib/api.ts';
import { WalkGuide, type GuideMark } from '../components/WalkGuide.tsx';
import { PriceCard } from '../components/PriceCard.tsx';
import { Empty, ErrorBox, Loading, SectionTitle } from '../components/States.tsx';
import { Link } from '../components/Link.tsx';

export function ItemPage({ slug }: { slug: string }) {
  const detail = useQuery({ queryKey: ['item', slug], queryFn: () => api.item(slug) });
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });

  // 가게 번호: 가격 오름차순으로 처음 나온 순서. 안내도 칸과 가격 카드에 같은 번호를 쓴다.
  const marks = useMemo(() => {
    const m = new Map<number, GuideMark>();
    for (const o of detail.data?.observations ?? [])
      if (!m.has(o.storeId)) m.set(o.storeId, { label: String(m.size + 1), best: m.size === 0, price: o.price, unit: o.unit, target: `price-${o.storeId}` });
    return m;
  }, [detail.data]);

  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorBox error={detail.error} retry={() => detail.refetch()} />;
  const { item, observations, history } = detail.data;
  const prices = observations.map((o) => o.price);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm font-bold text-carbon">‹ 과일 시세</Link>
        <h1 className="display-outline mt-1 text-[28px]">
          {item.emoji} {item.name} 시세
        </h1>
        {observations.length > 0 && (
          <p className="plate-white mt-2 px-3 py-2 text-sm">
            가게 {marks.size}곳 · <span className="num font-semibold">{won(Math.min(...prices))}</span> ~ <span className="num font-semibold">{won(Math.max(...prices))}</span>
          </p>
        )}
      </div>

      {!observations.length ? (
        <Empty title="시세 없음" />
      ) : (
        <>
          {stores.data && (
            <section aria-labelledby="map-title">
              <SectionTitle id="map-title">위치</SectionTitle>
              <WalkGuide stores={stores.data} marks={marks} />
            </section>
          )}
          <section aria-labelledby="list-title">
            <SectionTitle id="list-title">가게별 가격</SectionTitle>
            <ul className="mt-2 space-y-3">
              {observations.map((o, i) => (
                <li key={o.id} id={observations.findIndex((x) => x.storeId === o.storeId) === i ? `price-${o.storeId}` : undefined} className="scroll-mt-[calc(var(--header-h)+8px)]">
                  <PriceCard o={o} rank={Number(marks.get(o.storeId)?.label ?? i + 1)} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {history.length > 1 && (
        <section aria-labelledby="hist-title">
          <SectionTitle id="hist-title">날짜별 최저가</SectionTitle>
          <table className="plate-platinum w-full overflow-hidden rounded-t-none text-sm">
            <tbody>
              {history.map((h) => (
                <tr key={h.day} className="border-b border-hairline/40 last:border-0">
                  <td className="px-3 py-2 font-bold text-chrome num">{h.day}</td>
                  <td className="px-3 py-2 text-right font-semibold num">{won(h.min_price)}</td>
                  <td className="px-3 py-2 text-right text-chrome">{h.stores}곳</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
