export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** 한국 시간 기준 같은 날인지 */
export function isTodayKst(iso: string, now = Date.now()): boolean {
  const day = (t: number) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
  return day(new Date(iso).getTime()) === day(now);
}
