/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Đánh giá BMI:
// - Người lớn (≥18 tuổi): ngưỡng dành cho người châu Á / Việt Nam (IDI & WPRO, được Bộ Y tế VN dùng).
//   Khác với ngưỡng quốc tế (thừa cân từ 25) — người châu Á thừa cân từ 23.
// - Trẻ 5–<18 tuổi: WHO BMI-for-age z-score (2007 WHO Reference), khác nhau theo tuổi & giới tính.
//   Phân loại: < -2SD thiếu cân · -2SD..+1SD bình thường · +1SD..+2SD thừa cân · > +2SD béo phì.

export type BmiCategory = "thi_can" | "binh_thuong" | "thua_can" | "beo_phi_1" | "beo_phi_2";

export interface BmiAssessment {
  bmi: number;
  category?: BmiCategory;        // không có khi chưa đủ dữ liệu để phân loại
  label: string;                 // nhãn tiếng Việt hiển thị
  color: "emerald" | "amber" | "rose" | "slate";
  basis: "adult" | "child" | "under2" | "need-gender";
  note?: string;                 // ghi chú thêm (vd: cần giới tính, dưới 5 tuổi)
}

// WHO BMI-for-age — cutoff [-2SD, +1SD, +2SD] theo từng tuổi tròn (5..19). Nguồn: 2007 WHO Reference.
const WHO_BOYS: Record<number, [number, number, number]> = {
  5: [13.0, 16.6, 18.3], 6: [13.0, 16.8, 18.5], 7: [13.1, 17.0, 19.0], 8: [13.3, 17.4, 19.7],
  9: [13.5, 17.9, 20.5], 10: [13.7, 18.5, 21.4], 11: [14.1, 19.2, 22.5], 12: [14.5, 19.9, 23.6],
  13: [14.9, 20.8, 24.8], 14: [15.5, 21.8, 25.9], 15: [16.0, 22.7, 27.0], 16: [16.5, 23.5, 27.9],
  17: [16.9, 24.3, 28.6], 18: [17.3, 24.9, 29.2], 19: [17.6, 25.4, 29.7]
};
const WHO_GIRLS: Record<number, [number, number, number]> = {
  5: [12.7, 16.9, 18.9], 6: [12.7, 17.0, 19.2], 7: [12.7, 17.3, 19.8], 8: [12.9, 17.7, 20.6],
  9: [13.1, 18.3, 21.5], 10: [13.5, 19.0, 22.6], 11: [13.9, 19.9, 23.7], 12: [14.4, 20.8, 25.0],
  13: [14.9, 21.8, 26.2], 14: [15.4, 22.7, 27.3], 15: [15.9, 23.5, 28.2], 16: [16.2, 24.1, 28.9],
  17: [16.4, 24.5, 29.3], 18: [16.4, 24.8, 29.5], 19: [16.5, 25.0, 29.7]
};

// WHO Child Growth Standards (0–5) BMI-for-age — cutoff [-2SD, +1SD, +2SD, +3SD] theo tuổi tròn (2..5).
// Lưu ý: dưới 5 tuổi phân loại KHÁC 5–19: thừa cân từ +2SD, béo phì từ +3SD; +1SD..+2SD là "nguy cơ thừa cân".
const WHO_U5_BOYS: Record<number, [number, number, number, number]> = {
  2: [13.8, 17.3, 18.9, 20.6], 3: [13.4, 16.9, 18.4, 20.0], 4: [13.1, 16.7, 18.2, 19.9], 5: [12.9, 16.6, 18.3, 20.3]
};
const WHO_U5_GIRLS: Record<number, [number, number, number, number]> = {
  2: [13.3, 17.1, 18.7, 20.6], 3: [13.1, 16.8, 18.4, 20.3], 4: [12.8, 16.8, 18.5, 20.6], 5: [12.7, 16.9, 18.8, 21.1]
};

const CATEGORY_LABEL: Record<BmiCategory, string> = {
  thi_can: "Thiếu cân",
  binh_thuong: "Bình thường",
  thua_can: "Thừa cân",
  beo_phi_1: "Béo phì độ I",
  beo_phi_2: "Béo phì độ II"
} as Record<BmiCategory, string>;

const CATEGORY_COLOR: Record<BmiCategory, BmiAssessment["color"]> = {
  thi_can: "amber",
  binh_thuong: "emerald",
  thua_can: "amber",
  beo_phi_1: "rose",
  beo_phi_2: "rose"
} as Record<BmiCategory, BmiAssessment["color"]>;

export function computeBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  if (!m || m <= 0) return 0;
  return weightKg / (m * m);
}

// Tuổi (năm, có phần lẻ) từ ngày sinh YYYY-MM-DD; null nếu thiếu/không hợp lệ.
export function ageFromDob(dob?: string): number | null {
  if (!dob) return null;
  const p = String(dob).split("-");
  if (p.length < 3) return null;
  const y = Number(p[0]), mo = Number(p[1]), d = Number(p[2]);
  if (!y || !mo || !d) return null;
  const birth = new Date(y, mo - 1, d);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  // phần lẻ theo ngày để nội suy mượt
  const last = new Date(birth.getFullYear() + age, birth.getMonth(), birth.getDate());
  const next = new Date(birth.getFullYear() + age + 1, birth.getMonth(), birth.getDate());
  const frac = (now.getTime() - last.getTime()) / (next.getTime() - last.getTime());
  return age + Math.max(0, Math.min(1, frac));
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Nội suy cutoff WHO theo tuổi (năm lẻ) cho giới tính.
function childCutoffs(ageYears: number, gender: "male" | "female"): [number, number, number] {
  const table = gender === "male" ? WHO_BOYS : WHO_GIRLS;
  const lo = Math.max(5, Math.min(19, Math.floor(ageYears)));
  const hi = Math.min(19, lo + 1);
  const t = Math.max(0, Math.min(1, ageYears - lo));
  const a = table[lo], b = table[hi];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Nội suy cutoff WHO 0–5 (2..5 tuổi): [-2SD, +1SD, +2SD, +3SD].
function childCutoffsU5(ageYears: number, gender: "male" | "female"): [number, number, number, number] {
  const table = gender === "male" ? WHO_U5_BOYS : WHO_U5_GIRLS;
  const lo = Math.max(2, Math.min(5, Math.floor(ageYears)));
  const hi = Math.min(5, lo + 1);
  const t = Math.max(0, Math.min(1, ageYears - lo));
  const a = table[lo], b = table[hi];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}

function adultAssess(bmi: number): BmiAssessment {
  let category: BmiCategory;
  if (bmi < 18.5) category = "thi_can";
  else if (bmi < 23) category = "binh_thuong";
  else if (bmi < 25) category = "thua_can";
  else if (bmi < 30) category = "beo_phi_1";
  else category = "beo_phi_2";
  return {
    bmi,
    category,
    label: CATEGORY_LABEL[category],
    color: CATEGORY_COLOR[category],
    basis: "adult"
  };
}

/**
 * Đánh giá BMI cho một cá nhân.
 * @param heightCm chiều cao (cm)
 * @param weightKg cân nặng (kg)
 * @param dob ngày sinh (để tính tuổi); nếu thiếu → coi như người lớn
 * @param gender giới tính (bắt buộc để đánh giá trẻ 5–<18)
 */
export function assessBmi(
  heightCm: number,
  weightKg: number,
  dob?: string,
  gender?: "male" | "female"
): BmiAssessment | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const bmi = computeBmi(heightCm, weightKg);
  const age = ageFromDob(dob);

  // Không rõ tuổi hoặc đã ≥18 → dùng ngưỡng người lớn (Á-Đông/VN)
  if (age == null || age >= 18) return adultAssess(bmi);

  // Dưới 2 tuổi: BMI dựa trên chiều DÀI nằm + cần điều chỉnh; nên theo dõi cân nặng/chiều dài theo tuổi.
  if (age < 2) {
    return { bmi, label: "Bé dưới 2 tuổi", color: "slate", basis: "under2", note: "Dưới 2 tuổi nên theo dõi cân nặng/chiều dài theo tuổi (đo nằm). Tham khảo bác sĩ để đánh giá chính xác." };
  }

  // 2–<18: cần giới tính để tra bảng WHO theo tuổi/giới
  if (gender !== "male" && gender !== "female") {
    return { bmi, label: "Cần chọn giới tính", color: "slate", basis: "need-gender", note: "Bổ sung giới tính của thành viên (trong Thiết lập) để đánh giá BMI theo chuẩn WHO theo tuổi." };
  }

  // 2–<5: WHO Child Growth Standards (thừa cân từ +2SD, béo phì từ +3SD)
  if (age < 5) {
    const [m2, p1, p2, p3] = childCutoffsU5(age, gender);
    let category: BmiCategory;
    let label: string;
    if (bmi < m2) { category = "thi_can"; label = "Thiếu cân"; }
    else if (bmi <= p1) { category = "binh_thuong"; label = "Bình thường"; }
    else if (bmi <= p2) { category = "thua_can"; label = "Nguy cơ thừa cân"; }
    else if (bmi <= p3) { category = "beo_phi_1"; label = "Thừa cân"; }
    else { category = "beo_phi_2"; label = "Béo phì"; }
    return { bmi, category, label, color: CATEGORY_COLOR[category], basis: "child" };
  }

  // 5–<18: WHO 2007 reference (thừa cân từ +1SD, béo phì từ +2SD)
  const [m2, p1, p2] = childCutoffs(age, gender);
  let category: BmiCategory;
  if (bmi < m2) category = "thi_can";
  else if (bmi <= p1) category = "binh_thuong";
  else if (bmi <= p2) category = "thua_can";
  else category = "beo_phi_1";
  return {
    bmi,
    category,
    label: CATEGORY_LABEL[category],
    color: CATEGORY_COLOR[category],
    basis: "child"
  };
}
