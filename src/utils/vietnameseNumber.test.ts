import { describe, expect, it } from 'vitest';
import { readVnMoney } from './vietnameseNumber.js';

describe('readVnMoney', () => {
  it('đọc đúng các số tiền tròn', () => {
    expect(readVnMoney(0)).toBe('');
    expect(readVnMoney(1000)).toBe('Một nghìn đồng');
    expect(readVnMoney(50000)).toBe('Năm mươi nghìn đồng');
    expect(readVnMoney(500000)).toBe('Năm trăm nghìn đồng');
    expect(readVnMoney(1000000)).toBe('Một triệu đồng');
    expect(readVnMoney(15000000)).toBe('Mười lăm triệu đồng');
  });

  it('đọc đúng các số tiền lẻ phổ biến khi mua vàng', () => {
    expect(readVnMoney(13850000)).toBe('Mười ba triệu tám trăm năm mươi nghìn đồng');
    expect(readVnMoney(14950000)).toBe('Mười bốn triệu chín trăm năm mươi nghìn đồng');
    expect(readVnMoney(163350000)).toBe('Một trăm sáu mươi ba triệu ba trăm năm mươi nghìn đồng');
  });
});
