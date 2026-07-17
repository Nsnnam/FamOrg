/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Chuẩn hóa chuỗi cho tìm kiếm tiếng Việt: thường hóa, bỏ dấu (NFD), đ→d.
// Dùng chung cho cả server (/api/search) lẫn client để "giay to" khớp "Giấy tờ".

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeSearchText(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d") // đ → d
    .trim();
}

/** True nếu MỘT trong các field chứa query (query đã được normalize sẵn). */
export function matchesQuery(normalizedQuery: string, ...fields: unknown[]): boolean {
  if (!normalizedQuery) return false;
  return fields.some(f => {
    if (f === null || f === undefined) return false;
    if (Array.isArray(f)) return f.some(x => normalizeSearchText(x).includes(normalizedQuery));
    return normalizeSearchText(f).includes(normalizedQuery);
  });
}

/**
 * Cắt đoạn văn quanh vị trí khớp đầu tiên (để hiện snippet kết quả).
 * So khớp trên bản normalize từng-ký-tự nhưng cắt trên chuỗi GỐC nên dấu
 * tiếng Việt trong snippet giữ nguyên; đ→d không đổi độ dài nên map 1-1 ổn.
 */
export function excerptAround(text: string, normalizedQuery: string, radius = 45): string {
  const plain = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  // Map từng ký tự gốc → dạng normalize để tìm index khớp trên chuỗi gốc.
  let normed = "";
  const starts: number[] = []; // starts[i] = vị trí bắt đầu của ký tự gốc i trong normed
  for (let i = 0; i < plain.length; i++) {
    starts.push(normed.length);
    normed += normalizeSearchText(plain[i]) || plain[i].toLowerCase();
  }
  const at = normed.indexOf(normalizedQuery);
  if (at < 0) return plain.slice(0, radius * 2) + (plain.length > radius * 2 ? "…" : "");
  // Tìm ký tự gốc chứa vị trí khớp
  let origIdx = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= at) origIdx = i; else break;
  }
  const from = Math.max(0, origIdx - radius);
  const to = Math.min(plain.length, origIdx + normalizedQuery.length + radius);
  return (from > 0 ? "…" : "") + plain.slice(from, to) + (to < plain.length ? "…" : "");
}
