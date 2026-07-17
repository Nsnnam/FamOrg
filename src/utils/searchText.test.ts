/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { normalizeSearchText, matchesQuery, excerptAround } from "./searchText.js";

describe("normalizeSearchText — bỏ dấu tiếng Việt", () => {
  it("thường hóa + bỏ dấu + đ→d", () => {
    expect(normalizeSearchText("Giấy Tờ")).toBe("giay to");
    expect(normalizeSearchText("Đăng kiểm Ô TÔ")).toBe("dang kiem o to");
    expect(normalizeSearchText("  Ăn uống  ")).toBe("an uong");
  });
  it("null/undefined/số không crash", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
    expect(normalizeSearchText(500000)).toBe("500000");
  });
});

describe("matchesQuery — so khớp đa trường", () => {
  it("khớp không dấu trên bất kỳ trường nào", () => {
    expect(matchesQuery("giay to", "Hồ sơ", "Giấy tờ xe máy")).toBe(true);
    expect(matchesQuery("hoc phi", "Đóng học phí kỳ 1")).toBe(true);
  });
  it("khớp trong mảng tags", () => {
    expect(matchesQuery("viec nha", "Tiêu đề khác", ["Việc nhà", "gấp"])).toBe(true);
  });
  it("không khớp → false; query rỗng → false", () => {
    expect(matchesQuery("khong co", "Tiền điện tháng 7")).toBe(false);
    expect(matchesQuery("", "Bất kỳ")).toBe(false);
  });
  it("bỏ qua field null/undefined", () => {
    expect(matchesQuery("abc", null, undefined, "xyz abc")).toBe(true);
  });
});

describe("excerptAround — snippet quanh vị trí khớp", () => {
  const long =
    "Đầu năm học mới cần chuẩn bị rất nhiều thứ cho các con, trong đó quan trọng nhất là " +
    "đóng học phí kỳ một cho bé lớn trước ngày khai giảng để tránh bị nhắc nhở từ nhà trường.";

  it("cắt quanh từ khớp, giữ NGUYÊN dấu tiếng Việt, có dấu …", () => {
    const snip = excerptAround(long, "hoc phi", 20);
    expect(snip).toContain("học phí");
    expect(snip.length).toBeLessThan(long.length);
    expect(snip.startsWith("…")).toBe(true);
    expect(snip.endsWith("…")).toBe(true);
  });
  it("khớp ngay đầu chuỗi → không có … mở đầu", () => {
    expect(excerptAround("Học phí kỳ 1", "hoc phi", 30)).toBe("Học phí kỳ 1");
  });
  it("không tìm thấy → trả đoạn đầu văn bản", () => {
    const snip = excerptAround(long, "khong ton tai", 20);
    expect(snip.startsWith("Đầu năm học")).toBe(true);
  });
  it("gộp khoảng trắng thừa/xuống dòng", () => {
    expect(excerptAround("mua   sữa\ncho bé", "sua", 30)).toBe("mua sữa cho bé");
  });
});
