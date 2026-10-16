import { describe, expect, it } from 'vitest';
import { parseUnit, unitPrice } from './unit.ts';

describe('unit', () => {
  it.each([
    ['3개', { qty: 3, per: '개' }],
    ['10 개', { qty: 10, per: '개' }],
    ['5kg', { qty: 5, per: 'kg' }],
    ['2키로', { qty: 2, per: 'kg' }],
    ['500g', { qty: 0.5, per: 'kg' }],
    ['1박스', null],
    ['1줄', null],
    [null, null],
  ])('%s', (u, expected) => expect(parseUnit(u)).toEqual(expected));

  it('개당 가격은 10원 단위로 반올림', () => expect(unitPrice(2000, '3개')).toEqual({ value: 670, per: '개' }));
  it('kg당 가격', () => expect(unitPrice(15000, '3kg')).toEqual({ value: 5000, per: 'kg' }));
  it('1개·박스는 환산하지 않음', () => {
    expect(unitPrice(5000, '1개')).toBeNull();
    expect(unitPrice(30000, '1박스')).toBeNull();
  });
});
