// 판매 단위를 해석해 개당·kg당 가격을 구한다. 박스·봉처럼 수량을 알 수 없는 단위는 환산하지 않는다.
export interface UnitInfo {
  qty: number;
  per: '개' | 'kg';
}

export function parseUnit(unit: string | null | undefined): UnitInfo | null {
  if (!unit) return null;
  const u = unit.replace(/\s/g, '');
  const kg = u.match(/^(\d+(?:\.\d+)?)(kg|키로|킬로)$/i);
  if (kg) return { qty: Number(kg[1]), per: 'kg' };
  const g = u.match(/^(\d+)g$/i);
  if (g) return { qty: Number(g[1]) / 1000, per: 'kg' };
  const n = u.match(/^(\d+)(개|입|과|알|송이)$/);
  if (n) return { qty: Number(n[1]), per: '개' };
  return null;
}

/** 환산 단가. 1개·1kg 이면 그대로라 표시할 필요가 없어 null. */
export function unitPrice(price: number, unit: string | null | undefined): { value: number; per: UnitInfo['per'] } | null {
  const info = parseUnit(unit);
  if (!info || info.qty <= 0 || info.qty === 1) return null;
  return { value: Math.round(price / info.qty / 10) * 10, per: info.per };
}
