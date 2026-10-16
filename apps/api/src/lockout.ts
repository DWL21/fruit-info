// 촬영 키 대입 공격을 막는다: 같은 접속지에서 잘못된 키가 MAX_FAILS번 넘으면 LOCK_MS 동안 거부한다.
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60_000;

const fails = new Map<string, { count: number; first: number; lockedUntil: number }>();

export function isLocked(ip: string, now = Date.now()) {
  const f = fails.get(ip);
  return !!f && f.lockedUntil > now;
}

export function recordFail(ip: string, now = Date.now()) {
  const f = fails.get(ip);
  if (!f || now - f.first > LOCK_MS) {
    fails.set(ip, { count: 1, first: now, lockedUntil: 0 });
    return;
  }
  f.count++;
  if (f.count >= MAX_FAILS) f.lockedUntil = now + LOCK_MS;
}

export function recordSuccess(ip: string) {
  fails.delete(ip);
}

export const resetLockout = () => fails.clear();
