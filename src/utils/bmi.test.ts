/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { computeBmi, assessBmi } from "./bmi.js";

// dob cách hiện tại n năm (chọn ngày 15 để tránh lệch tháng) → tuổi ~ n.x
function dobYearsAgo(n: number): string {
  const d = new Date();
  return `${d.getFullYear() - n}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
}

// Tạo cân nặng để đạt BMI mong muốn với chiều cao cho trước.
const weightFor = (bmi: number, heightCm: number) => bmi * (heightCm / 100) ** 2;

describe("computeBmi", () => {
  it("tính đúng BMI", () => {
    expect(computeBmi(170, 68)).toBeCloseTo(23.53, 1);
    expect(computeBmi(0, 50)).toBe(0);
  });
});

describe("assessBmi - người lớn (không có ngày sinh → chuẩn châu Á/VN)", () => {
  const H = 170;
  it("thiếu cân < 18.5", () => expect(assessBmi(H, weightFor(17, H))?.category).toBe("thi_can"));
  it("bình thường 18.5–22.9", () => expect(assessBmi(H, weightFor(21, H))?.category).toBe("binh_thuong"));
  it("thừa cân 23–24.9 (ngưỡng châu Á)", () => expect(assessBmi(H, weightFor(24, H))?.category).toBe("thua_can"));
  it("béo phì độ I 25–29.9", () => expect(assessBmi(H, weightFor(26, H))?.category).toBe("beo_phi_1"));
  it("béo phì độ II ≥30", () => expect(assessBmi(H, weightFor(31, H))?.category).toBe("beo_phi_2"));
});

describe("assessBmi - trẻ em (WHO theo tuổi/giới)", () => {
  const H = 140;
  const boy10 = dobYearsAgo(10);
  it("bé trai 10 tuổi, BMI ~16.5 → bình thường", () =>
    expect(assessBmi(H, weightFor(16.5, H), boy10, "male")?.category).toBe("binh_thuong"));
  it("bé trai 10 tuổi, BMI ~12 → thiếu cân", () =>
    expect(assessBmi(H, weightFor(12, H), boy10, "male")?.category).toBe("thi_can"));
  it("bé trai 10 tuổi, BMI ~25 → béo phì", () =>
    expect(assessBmi(H, weightFor(25, H), boy10, "male")?.category).toBe("beo_phi_1"));
  it("thiếu giới tính → không phân loại, yêu cầu bổ sung", () => {
    const r = assessBmi(H, weightFor(16.5, H), boy10);
    expect(r?.basis).toBe("need-gender");
    expect(r?.category).toBeUndefined();
  });
  it("dưới 2 tuổi → không phân loại theo BMI (theo dõi cân nặng/chiều dài)", () => {
    const r = assessBmi(80, weightFor(16, 80), dobYearsAgo(1), "female");
    expect(r?.basis).toBe("under2");
  });
});

describe("assessBmi - trẻ 2–<5 tuổi (WHO Child Growth Standards)", () => {
  const H = 95; // ~3 tuổi
  const boy3 = dobYearsAgo(3);
  it("bình thường", () =>
    expect(assessBmi(H, weightFor(15, H), boy3, "male")?.category).toBe("binh_thuong"));
  it("thiếu cân", () =>
    expect(assessBmi(H, weightFor(12, H), boy3, "male")?.category).toBe("thi_can"));
  it("nguy cơ thừa cân (+1SD..+2SD)", () => {
    const r = assessBmi(H, weightFor(17.5, H), boy3, "male");
    expect(r?.category).toBe("thua_can");
    expect(r?.label).toBe("Nguy cơ thừa cân");
  });
  it("thừa cân (+2SD..+3SD)", () =>
    expect(assessBmi(H, weightFor(19, H), boy3, "male")?.label).toBe("Thừa cân"));
  it("béo phì (>+3SD)", () =>
    expect(assessBmi(H, weightFor(21, H), boy3, "male")?.label).toBe("Béo phì"));
  it("2–5 tuổi thiếu giới tính → cần bổ sung", () =>
    expect(assessBmi(H, weightFor(15, H), boy3)?.basis).toBe("need-gender"));
});
