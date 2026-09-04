/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hàm đọc số tiền bằng chữ tiếng Việt (hỗ trợ hiển thị minh bạch cho các ô nhập tiền).
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(n: number, showZeroHundred: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (h === 0 && t === 0 && u === 0) return '';
  const parts: string[] = [];
  if (h > 0 || showZeroHundred) {
    parts.push(DIGITS[h] + ' trăm');
  }
  if (t === 0) {
    if (u > 0 && (h > 0 || showZeroHundred)) parts.push('lẻ');
  } else if (t === 1) {
    parts.push('mười');
  } else {
    parts.push(DIGITS[t] + ' mươi');
  }

  if (t > 0 && u === 1) {
    parts.push(t === 1 ? 'một' : 'mốt');
  } else if (t > 0 && u === 5) {
    parts.push('lăm');
  } else if (u > 0) {
    parts.push(DIGITS[u]);
  }
  return parts.join(' ');
}

export function readVnMoney(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return '';
  const n = Math.round(amount);
  if (n === 0) return 'Không đồng';

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const groups: number[] = [];
  let temp = n;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const showZero = i < groups.length - 1;
      const text = readThreeDigits(g, showZero);
      if (text) {
        parts.push((text + ' ' + units[i]).trim());
      }
    }
  }

  if (parts.length === 0) return '';
  const res = parts.join(' ').trim() + ' đồng';
  return res.charAt(0).toUpperCase() + res.slice(1);
}
