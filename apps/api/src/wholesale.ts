import { CATALOG, wholesaleSlug, type WholesaleDay, type WholesaleHistory } from '@fruit/shared';
import { config } from './config.ts';
import { db, now } from './db.ts';
import { capture } from './monitor.ts';

/** 도매 일일 시세: KAMIS 서울 도매, 과일류(400)와 과채류가 있는 채소류(200) */
const CATEGORIES = ['400', '200'];
const BACKFILL_DAYS = 60;

interface KamisItem {
  item_name: string; item_code: string; kind_name: string; kind_code: string; rank: string; rank_code: string; unit: string; dpr1: string;
}

const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);
const toPrice = (s: string) => {
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

async function fetchCategory(day: string, category: string): Promise<KamisItem[]> {
  const q = new URLSearchParams({
    action: 'dailyPriceByCategoryList', p_product_cls_code: '02', p_country_code: '1101', p_regday: day, p_convert_kg_yn: 'N',
    p_item_category_code: category, p_cert_key: config.kamisKey, p_cert_id: config.kamisId, p_returntype: 'json',
  });
  const res = await fetch(`https://www.kamis.or.kr/service/price/xml.do?${q}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (fruit-info)', accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`KAMIS ${res.status}`);
  const body = (await res.json()) as { data?: { error_code?: string; item?: KamisItem[] } | string[] };
  // 거래가 없는 날(주말·휴일)은 data: ["001"]
  if (!body.data || Array.isArray(body.data)) return [];
  return body.data.item ?? [];
}

/** 하루치 시세를 받아 저장한다. 저장한 줄 수를 돌려준다. */
export async function syncDay(day: string): Promise<number> {
  const rows: { item_code: string; kind_code: string; rank_code: string; slug: string; kind: string; rank: string; unit: string; price: number }[] = [];
  for (const cat of CATEGORIES) {
    for (const it of await fetchCategory(day, cat)) {
      const slug = wholesaleSlug(it.item_name, it.kind_name);
      const price = toPrice(it.dpr1);
      if (!slug || price === null) continue;
      rows.push({ item_code: it.item_code, kind_code: it.kind_code, rank_code: it.rank_code, slug, kind: it.kind_name, rank: it.rank, unit: it.unit, price });
    }
  }
  const insert = db.prepare(
    `INSERT OR REPLACE INTO wholesale (day, item_code, kind_code, rank_code, slug, kind, rank, unit, price) VALUES (@day, @item_code, @kind_code, @rank_code, @slug, @kind, @rank, @unit, @price)`,
  );
  db.transaction(() => {
    for (const r of rows) insert.run({ day, ...r });
    db.prepare('INSERT OR REPLACE INTO wholesale_days (day, rows, fetched_at) VALUES (?, ?, ?)').run(day, rows.length, now());
  })();
  return rows.length;
}

/** 최근 이틀은 늘 다시 받고(당일 시세가 오후에 올라옴), 그 전은 받은 적 없는 날만. */
export async function syncRecent() {
  const fetched = new Set(db.prepare('SELECT day FROM wholesale_days').pluck().all() as string[]);
  for (let i = 0; i < BACKFILL_DAYS; i++) {
    const day = kstDay(i);
    if (i > 1 && fetched.has(day)) continue;
    try {
      await syncDay(day);
    } catch (error) {
      console.error(`[wholesale] ${day} 실패:`, error instanceof Error ? error.message : error);
      capture(error, { wholesaleDay: day });
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

export function startWholesale() {
  const run = () => void syncRecent().catch((e) => console.error('[wholesale]', e));
  run();
  setInterval(run, 3 * 3600_000).unref();
}

/** 순서: 상품·L과·특 먼저 */
const RANK_ORDER = ['상품', '특', 'L과', '중품', 'M과', '하품', 'S과'];
const rankIdx = (r: string) => (RANK_ORDER.indexOf(r) + 1 || 99);

export function wholesaleDay(day?: string): WholesaleDay {
  const days = db.prepare('SELECT day FROM wholesale_days WHERE rows > 0 ORDER BY day DESC LIMIT 90').pluck().all() as string[];
  const target = day && days.includes(day) ? day : (days.find((d) => !day || d <= day) ?? null);
  if (!target) return { day: null, prevDay: null, days, items: [] };
  const prevDay = days.find((d) => d < target) ?? null;
  const rows = db
    .prepare(
      `SELECT w.slug, w.kind, w.rank, w.unit, w.price, p.price AS prev
       FROM wholesale w LEFT JOIN wholesale p ON p.day = @prev AND p.item_code = w.item_code AND p.kind_code = w.kind_code AND p.rank_code = w.rank_code
       WHERE w.day = @day`,
    )
    .all({ day: target, prev: prevDay }) as { slug: string; kind: string; rank: string; unit: string; price: number; prev: number | null }[];
  const items = CATALOG.filter((c) => rows.some((r) => r.slug === c.slug)).map((c) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
    prices: rows
      .filter((r) => r.slug === c.slug)
      .sort((a, b) => a.kind.localeCompare(b.kind, 'ko') || rankIdx(a.rank) - rankIdx(b.rank))
      .map((r) => ({ ...r })),
  }));
  return { day: target, prevDay, days, items };
}

export function wholesaleHistory(slug: string, limit = 60): WholesaleHistory {
  const rows = db
    .prepare(`SELECT day, kind, rank, unit, price FROM wholesale WHERE slug = ? AND day >= ? ORDER BY day`)
    .all(slug, kstDay(limit)) as { day: string; kind: string; rank: string; unit: string; price: number }[];
  const map = new Map<string, WholesaleHistory['series'][number]>();
  for (const r of rows) {
    const k = `${r.kind}|${r.rank}`;
    if (!map.has(k)) map.set(k, { kind: r.kind, rank: r.rank, unit: r.unit, points: [] });
    map.get(k)!.points.push({ day: r.day, price: r.price });
  }
  return { series: [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind, 'ko') || rankIdx(a.rank) - rankIdx(b.rank)) };
}
