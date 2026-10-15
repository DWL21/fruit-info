import { MARKET, SEGMENT_STARTS, segmentEnd, type Store } from '@fruit/shared';

export type StallTone = 'on' | 'best';

// SVG 좌표계 (화면 폭에 맞춰 늘어난다)
const W = 340;
const PAD = 10;
const SCALE = (W - PAD * 2) / MARKET.length;
const LABEL_Y = 8;
const NORTH_Y = 17; // 북쪽 가판대 줄 중심
const ROAD_Y = 22; // 본통로
const ROAD_H = 11;
const SOUTH_Y = ROAD_Y + ROAD_H + 5; // 남쪽 가판대 줄 중심
const STALL_H = 7;
const V_TOP = ROAD_Y + ROAD_H + 1;
const V_ROW = 6.5;

const xOf = (m: number) => PAD + Math.min(MARKET.length, Math.max(0, m)) * SCALE;

/** 지도 위 가게 좌표 */
function place(s: Store) {
  if (s.aisle === 'main') return { x: xOf(s.position), y: s.side === 'A' ? NORTH_Y : SOUTH_Y };
  const v = MARKET.verticals.find((a) => a.id === s.aisle)!;
  const mid = (xOf(v.from) + xOf(v.to)) / 2;
  const half = (xOf(v.to) - xOf(v.from)) / 2;
  return { x: s.side === 'A' ? mid - half * 0.55 : mid + half * 0.55, y: V_TOP + STALL_H / 2 + 2 + (s.position - 1) * V_ROW };
}

/**
 * 시장 전체 미니맵. 실제 거리 비율로 화면 폭에 맞춰 그리고(드래그 없음), 안내도 구간을 띠로 나눈다.
 * tones: 강조할 가판대(과일 상세의 파는 가게). highlight: 가게 하나에 핀.
 */
export function MiniMap({
  stores,
  active,
  onPick,
  tones,
  highlight,
  segments,
}: {
  stores: Store[];
  active?: number;
  onPick?: (segment: number) => void;
  tones?: Map<number, StallTone>;
  highlight?: number;
  /** 보여줄 구간 번호(없으면 전부) */
  segments?: Set<number>;
}) {
  const vDepth = Math.max(4, ...stores.filter((s) => s.aisle !== 'main').map((s) => s.position));
  const southRoadY = V_TOP + 4 + vDepth * V_ROW + 3;
  const H = southRoadY + 10;
  const pin = highlight !== undefined ? stores.find((s) => s.id === highlight) : undefined;
  const dimmed = (s: Store) => (tones ? !tones.has(s.id) : pin ? pin.id !== s.id : false);

  return (
    <div className="plate p-1" role="group" aria-label="시장 미니맵">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none">
        <text x={PAD} y={LABEL_Y} fontSize="8" fontWeight="700" fill="var(--color-carbon)">◀ {MARKET.west}</text>
        <text x={W - PAD} y={LABEL_Y} fontSize="8" fontWeight="700" textAnchor="end" fill="var(--color-carbon)">{MARKET.east} ▶</text>

        {/* 세로줄 */}
        {MARKET.verticals.map((v) => {
          const x1 = xOf(v.from);
          const x2 = xOf(v.to);
          const mid = (x1 + x2) / 2;
          return (
            <g key={v.id}>
              <rect x={x1} y={V_TOP} width={x2 - x1} height={southRoadY - V_TOP} fill="rgb(255 255 255 / 0.18)" rx="1.5" />
              <rect x={mid - 2} y={V_TOP} width={4} height={southRoadY - V_TOP} fill="var(--color-carbon)" />
            </g>
          );
        })}

        {/* 본통로 */}
        <rect x={PAD - 4} y={ROAD_Y} width={W - PAD * 2 + 8} height={ROAD_H} rx="2" fill="var(--color-carbon)" />

        {/* 왕산로 */}
        <rect x={0} y={southRoadY} width={W} height={10} fill="#f3d46a" />
        <text x={W / 2} y={southRoadY + 7.5} fontSize="7" fontWeight="700" textAnchor="middle" fill="var(--color-carbon)">{MARKET.south} · 1호선</text>

        {/* 가판대 */}
        {stores.map((s) => {
          const p = place(s);
          const tone = tones?.get(s.id);
          const w = s.aisle === 'main' ? 3 : 7;
          const h = s.aisle === 'main' ? STALL_H : 5;
          const fill = tone === 'best' ? 'var(--color-signal)' : tone === 'on' ? 'var(--color-amber)' : dimmed(s) ? 'rgb(255 255 255 / 0.4)' : '#fff';
          return <rect key={s.id} x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx="0.8" fill={fill} stroke={tone ? 'var(--color-carbon)' : 'var(--color-chrome)'} strokeWidth="0.5" />;
        })}

        {/* 구간 띠: 번호는 본통로 위에 */}
        {SEGMENT_STARTS.map((start, i) => {
          const x1 = i === 0 ? PAD - 4 : xOf(start);
          const x2 = i === SEGMENT_STARTS.length - 1 ? W - PAD + 4 : xOf(segmentEnd(i));
          const on = active === i;
          const shown = !segments || segments.has(i);
          return (
            <g key={i} opacity={shown ? 1 : 0.35}>
              {i > 0 && <line x1={x1} y1={LABEL_Y + 3} x2={x1} y2={southRoadY} stroke="var(--color-carbon)" strokeWidth="0.6" strokeDasharray="1.5 1.5" />}
              <rect x={x1 + 0.5} y={ROAD_Y + 1.5} width={x2 - x1 - 1} height={ROAD_H - 3} rx="1.5" fill={on ? 'var(--color-signal)' : 'transparent'} />
              <text x={(x1 + x2) / 2} y={ROAD_Y + 8} fontSize="7.5" fontWeight="900" textAnchor="middle" fill={on ? '#fff' : 'var(--color-nav-gold)'}>
                {i + 1}
              </text>
              {on && <rect x={x1 + 0.5} y={LABEL_Y + 3} width={x2 - x1 - 1} height={southRoadY - LABEL_Y - 3} rx="2" fill="none" stroke="var(--color-signal)" strokeWidth="1.4" />}
              {onPick && shown && (
                <rect
                  x={x1}
                  y={0}
                  width={x2 - x1}
                  height={H}
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  aria-label={`구간 ${i + 1}`}
                  aria-current={on ? 'true' : undefined}
                  className="cursor-pointer outline-none"
                  onClick={() => onPick(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPick(i);
                    }
                  }}
                />
              )}
            </g>
          );
        })}

        {/* 가게 핀 */}
        {pin &&
          (() => {
            const p = place(pin);
            const h = pin.aisle === 'main' ? STALL_H : 5;
            return (
              <g pointerEvents="none">
                <circle cx={p.x} cy={p.y} r="6.5" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" />
                <rect x={p.x - 2.5} y={p.y - h / 2} width={5} height={h} rx="1" fill="var(--color-primary)" />
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
