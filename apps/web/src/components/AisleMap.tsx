import type { MouseEvent } from 'react';
import { MARKET, type Store } from '@fruit/shared';
import { navigate } from '../lib/router.ts';

export interface StallMark {
  /** 배지에 보일 짧은 글자 (가게 번호) */
  label: string;
  best?: boolean;
}

// SVG 좌표계 (화면 폭에 맞춰 늘어난다)
const W = 340;
const PAD = 10;
const SCALE = (W - PAD * 2) / MARKET.length;
const NORTH_Y = 34; // 북쪽 가판대 줄
const ROAD_Y = 44; // 본통로
const ROAD_H = 12;
const SOUTH_Y = ROAD_Y + ROAD_H + 2; // 남쪽 가판대 줄
const STALL_H = 10;
const V_TOP = SOUTH_Y;
const V_ROW = 13;

const xOf = (m: number) => PAD + Math.min(MARKET.length, Math.max(0, m)) * SCALE;

/** 지도 위 가게 좌표 */
function place(s: Store) {
  if (s.aisle === 'main') return { x: xOf(s.position), y: s.side === 'A' ? NORTH_Y - STALL_H / 2 : SOUTH_Y + STALL_H / 2, dir: s.side === 'A' ? -1 : 1 };
  const v = MARKET.verticals.find((a) => a.id === s.aisle)!;
  const mid = (xOf(v.from) + xOf(v.to)) / 2;
  const half = (xOf(v.to) - xOf(v.from)) / 2;
  return { x: s.side === 'A' ? mid - half * 0.55 : mid + half * 0.55, y: V_TOP + STALL_H + (s.position - 0.5) * V_ROW, dir: 0 };
}

/**
 * 청량리 청과물시장 과일 거리 지도. 실제 거리 비율로 화면 폭에 맞춰 그린다(드래그 없음).
 * 본통로(제기동역 ↔ 청량리역) 북·남쪽 가판대와, 남쪽으로 왕산로까지 이어진 세로줄 2개.
 */
export function AisleMap({ stores, marks, highlight }: { stores: Store[]; marks?: Map<number, StallMark>; highlight?: number }) {
  const vRows = new Map(MARKET.verticals.map((v) => [v.id, Math.max(4, ...stores.filter((s) => s.aisle === v.id).map((s) => s.position))]));
  const vDepth = Math.max(...vRows.values());
  const southRoadY = V_TOP + STALL_H + vDepth * V_ROW + 8;
  const H = southRoadY + 22;

  const go = (e: MouseEvent, id: number) => {
    e.preventDefault();
    navigate(`/store/${id}`);
  };

  // 표시할 배지: 번호가 있는 가게 또는 강조 가게. 같은 쪽에서 겹치면 바깥으로 쌓는다.
  const badges = stores
    .filter((s) => marks?.has(s.id) || highlight === s.id)
    .map((s) => ({ s, p: place(s), m: marks?.get(s.id) }))
    .sort((a, b) => a.p.x - b.p.x);
  const lanes = new Map<string, number[]>();
  const placed = badges.map((b) => {
    const key = b.s.aisle === 'main' ? b.s.side : `${b.s.aisle}${b.s.side}`;
    const used = lanes.get(key) ?? [];
    let level = 0;
    while (used[level] !== undefined && b.p.x - used[level]! < 17) level++;
    used[level] = b.p.x;
    lanes.set(key, used);
    const offset = b.s.aisle === 'main' ? b.p.dir * (12 + level * 17) : 0;
    const dx = b.s.aisle === 'main' ? 0 : level * 17 * (b.s.side === 'A' ? -1 : 1);
    return { ...b, bx: b.p.x + dx, by: b.p.y + offset };
  });
  const topExtra = Math.max(0, ...placed.filter((b) => b.s.aisle === 'main' && b.s.side === 'A').map((b) => NORTH_Y - b.by - 6));

  return (
    <div className="plate p-1.5" role="group" aria-label="청량리 청과물시장 지도">
      <svg viewBox={`0 ${-topExtra} ${W} ${H + topExtra}`} className="block w-full" style={{ maxHeight: 320 }}>
        <text x={PAD} y={12} fontSize="10" fontWeight="700" fill="var(--color-carbon)">◀ {MARKET.west}</text>
        <text x={W - PAD} y={12} fontSize="10" fontWeight="700" textAnchor="end" fill="var(--color-carbon)">{MARKET.east} ▶</text>

        {/* 세로줄 */}
        {MARKET.verticals.map((v) => {
          const x1 = xOf(v.from);
          const x2 = xOf(v.to);
          const mid = (x1 + x2) / 2;
          return (
            <g key={v.id}>
              <rect x={x1} y={V_TOP} width={x2 - x1} height={southRoadY - V_TOP} fill="rgb(255 255 255 / 0.18)" rx="2" />
              <rect x={mid - 3} y={V_TOP} width={6} height={southRoadY - V_TOP} fill="var(--color-carbon)" />
            </g>
          );
        })}

        {/* 본통로 */}
        <rect x={PAD - 4} y={ROAD_Y} width={W - PAD * 2 + 8} height={ROAD_H} rx="2" fill="var(--color-carbon)" />
        <text x={W / 2} y={ROAD_Y + 8.5} fontSize="7.5" fontWeight="700" textAnchor="middle" fill="var(--color-nav-gold)" letterSpacing="1">과일 거리</text>

        {/* 왕산로 */}
        <rect x={0} y={southRoadY} width={W} height={12} fill="#f3d46a" />
        <text x={W / 2} y={southRoadY + 9} fontSize="8" fontWeight="700" textAnchor="middle" fill="var(--color-carbon)">{MARKET.south} · 1호선</text>

        {/* 가판대 */}
        {stores.map((s) => {
          const p = place(s);
          const dim = (marks || highlight) && !marks?.has(s.id) && highlight !== s.id;
          const w = s.aisle === 'main' ? 4 : 9;
          const h = s.aisle === 'main' ? STALL_H : 8;
          return (
            <a key={s.id} href={`/store/${s.id}`} onClick={(e) => go(e, s.id)} aria-label={s.name}>
              <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx="1" fill={dim ? 'rgb(255 255 255 / 0.45)' : '#fff'} stroke="var(--color-chrome)" strokeWidth="0.6" />
            </a>
          );
        })}

        {/* 번호 배지 */}
        {placed.map(({ s, p, m, bx, by }) => {
          const best = m?.best || highlight === s.id;
          return (
            <a key={`b${s.id}`} href={`/store/${s.id}`} onClick={(e) => go(e, s.id)} aria-label={`${m?.label ?? ''} ${s.name}`}>
              {(bx !== p.x || by !== p.y) && <line x1={p.x} y1={p.y} x2={bx} y2={by} stroke="var(--color-carbon)" strokeWidth="0.8" />}
              <circle cx={bx} cy={by} r="8" fill={best ? 'var(--color-signal)' : '#fff'} stroke={best ? '#8a4700' : 'var(--color-carbon)'} strokeWidth="1.2" />
              <text x={bx} y={by + 3.2} fontSize="9" fontWeight="900" textAnchor="middle" fill={best ? '#fff' : 'var(--color-carbon)'}>
                {m?.label ?? '●'}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
