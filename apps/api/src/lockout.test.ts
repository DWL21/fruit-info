import { beforeEach, describe, expect, it } from 'vitest';
import { LOCK_MS, MAX_FAILS, isLocked, recordFail, recordSuccess, resetLockout } from './lockout.ts';

describe('lockout', () => {
  beforeEach(resetLockout);
  it('실패가 적으면 잠그지 않는다', () => {
    for (let i = 0; i < MAX_FAILS - 1; i++) recordFail('1.1.1.1', 1000);
    expect(isLocked('1.1.1.1', 1000)).toBe(false);
  });
  it('연속 실패하면 잠그고, 시간이 지나면 푼다', () => {
    for (let i = 0; i < MAX_FAILS; i++) recordFail('1.1.1.1', 1000);
    expect(isLocked('1.1.1.1', 2000)).toBe(true);
    expect(isLocked('2.2.2.2', 2000)).toBe(false);
    expect(isLocked('1.1.1.1', 1000 + LOCK_MS + 1)).toBe(false);
  });
  it('성공하면 실패 기록을 지운다', () => {
    for (let i = 0; i < MAX_FAILS - 1; i++) recordFail('1.1.1.1', 1000);
    recordSuccess('1.1.1.1');
    recordFail('1.1.1.1', 1000);
    expect(isLocked('1.1.1.1', 1000)).toBe(false);
  });
});
