import { describe, expect, it } from 'vitest';
import { evalMoneyExpression, formatMoneyExpr } from './MoneyInput.js';

describe('MoneyInput helpers', () => {
  it('tính đúng biểu thức số tiền', () => {
    expect(evalMoneyExpression('50000')).toBe(50000);
    expect(evalMoneyExpression('50.000')).toBe(50000);
    expect(evalMoneyExpression('50000+20000')).toBe(70000);
    expect(evalMoneyExpression('50.000+20.000')).toBe(70000);
    expect(evalMoneyExpression('15*1000')).toBe(15000);
    expect(evalMoneyExpression('100000-30000')).toBe(70000);
  });

  it('nhóm hàng nghìn cho biểu thức', () => {
    expect(formatMoneyExpr('50000')).toBe('50.000');
    expect(formatMoneyExpr('50000+20000')).toBe('50.000+20.000');
  });
});
