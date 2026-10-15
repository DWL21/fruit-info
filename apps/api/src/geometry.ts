import type { Box } from '@fruit/shared';

/** 가격표와 진열 상품이 함께 보이도록 자른 이미지를 만든다. */
export function cropBox(priceBox: Box | null, productBox: Box | null): Box | null {
  if (!priceBox && !productBox) return null;
  const boxes = [priceBox, productBox].filter((b): b is Box => !!b);
  let x1 = Math.min(...boxes.map((b) => b.x));
  let y1 = Math.min(...boxes.map((b) => b.y));
  let x2 = Math.max(...boxes.map((b) => b.x + b.w));
  let y2 = Math.max(...boxes.map((b) => b.y + b.h));
  if (!productBox && priceBox) {
    // 상품 위치를 모르면 가격표 위쪽 매대를 넉넉히 포함한다.
    y1 -= priceBox.h * 2.5;
    x1 -= priceBox.w * 0.8;
    x2 += priceBox.w * 0.8;
  }
  const padX = Math.max(25, (x2 - x1) * 0.12);
  const padY = Math.max(25, (y2 - y1) * 0.12);
  x1 = Math.max(0, x1 - padX);
  y1 = Math.max(0, y1 - padY);
  x2 = Math.min(1000, x2 + padX);
  y2 = Math.min(1000, y2 + padY);
  return { x: Math.round(x1), y: Math.round(y1), w: Math.max(1, Math.round(x2 - x1)), h: Math.max(1, Math.round(y2 - y1)) };
}
