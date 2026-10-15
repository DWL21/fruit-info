import { describe, expect, it } from 'vitest';
import { cropBox } from './geometry.ts';

describe('cropBox', () => {
  it('가격표와 상품을 모두 감싸고 여백을 둔다', () => {
    const b = cropBox({ x: 450, y: 880, w: 90, h: 100 }, { x: 456, y: 744, w: 135, h: 139 })!;
    expect(b.x).toBeLessThan(450);
    expect(b.y).toBeLessThan(744);
    expect(b.x + b.w).toBeGreaterThan(591);
    expect(b.y + b.h).toBeGreaterThan(980);
  });

  it('상품 위치가 없으면 가격표 위쪽 매대를 포함한다', () => {
    const b = cropBox({ x: 580, y: 880, w: 90, h: 100 }, null)!;
    expect(b.y).toBeLessThan(880 - 200);
  });

  it('이미지 밖으로 나가지 않는다', () => {
    const b = cropBox({ x: 950, y: 950, w: 50, h: 50 }, null)!;
    expect(b.x + b.w).toBeLessThanOrEqual(1000);
    expect(b.y + b.h).toBeLessThanOrEqual(1000);
  });

  it('박스가 없으면 null', () => {
    expect(cropBox(null, null)).toBeNull();
  });
});
