/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VietnamHolidayTone = "official" | "family" | "seasonal";

export interface VietnamHoliday {
  date: string; // YYYY-MM-DD
  title: string;
  shortTitle: string;
  tone: VietnamHolidayTone;
  meaning: string;
  lunarDate?: string;
}

export interface VietnamLunarDate {
  day: number;
  month: number;
  year: number;
  isLeapMonth: boolean;
}

interface SolarHolidayRule {
  month: number; // 1-indexed
  day: number;
  title: string;
  shortTitle: string;
  tone: VietnamHolidayTone;
  meaning: string;
}

interface LunarHolidayRule {
  month: number;
  day: number;
  title: string;
  shortTitle: string;
  tone: VietnamHolidayTone;
  meaning: string;
}

const VIETNAM_TIME_ZONE = 7;

const SOLAR_HOLIDAYS: SolarHolidayRule[] = [
  { month: 1, day: 1, title: "Tết Dương lịch", shortTitle: "Tết DL", tone: "official", meaning: "Ngày mở đầu năm mới theo dương lịch, thường là dịp nghỉ ngắn để gia đình chúc nhau một năm thuận lợi." },
  { month: 3, day: 8, title: "Ngày Quốc tế Phụ nữ", shortTitle: "Quốc tế Phụ nữ", tone: "family", meaning: "Dịp tôn vinh phụ nữ; nhiều gia đình, trường học và cơ quan gửi lời chúc, hoa hoặc món quà nhỏ cho bà, mẹ, vợ, chị em." },
  { month: 4, day: 30, title: "Ngày Giải phóng miền Nam", shortTitle: "Giải phóng", tone: "official", meaning: "Mốc kết thúc chiến tranh và thống nhất đất nước năm 1975, thường được tưởng nhớ như ngày đoàn tụ và hòa bình." },
  { month: 5, day: 1, title: "Ngày Quốc tế Lao động", shortTitle: "Lao động", tone: "official", meaning: "Ngày tôn vinh người lao động và quyền lợi lao động; ở Việt Nam thường nằm trong kỳ nghỉ dài cùng 30/4." },
  { month: 6, day: 1, title: "Ngày Quốc tế Thiếu nhi", shortTitle: "Thiếu nhi", tone: "family", meaning: "Dịp dành cho trẻ em, gia đình thường tặng quà, đưa trẻ đi chơi hoặc tổ chức hoạt động vui vẻ cho con." },
  { month: 6, day: 28, title: "Ngày Gia đình Việt Nam", shortTitle: "Gia đình VN", tone: "family", meaning: "Ngày nhắc về giá trị gắn bó, chăm sóc và chia sẻ trong gia đình Việt Nam." },
  { month: 9, day: 2, title: "Ngày Quốc khánh Việt Nam", shortTitle: "Quốc khánh", tone: "official", meaning: "Kỷ niệm ngày Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập năm 1945, là một trong những ngày lễ lớn của đất nước." },
  { month: 10, day: 20, title: "Ngày Phụ nữ Việt Nam", shortTitle: "Phụ nữ VN", tone: "family", meaning: "Ngày tôn vinh phụ nữ Việt Nam, thường là dịp bày tỏ sự trân trọng với bà, mẹ, vợ, cô giáo và đồng nghiệp nữ." },
  { month: 11, day: 20, title: "Ngày Nhà giáo Việt Nam", shortTitle: "Nhà giáo VN", tone: "family", meaning: "Dịp tri ân thầy cô và những người làm giáo dục; học sinh, phụ huynh thường gửi lời chúc hoặc thăm hỏi thầy cô." }
];

const LUNAR_HOLIDAYS: LunarHolidayRule[] = [
  { month: 12, day: 23, title: "Tết Ông Công Ông Táo", shortTitle: "Ông Công Ông Táo", tone: "seasonal", meaning: "Ngày tiễn Táo quân về trời, nhiều gia đình dọn dẹp bếp núc, cúng cơm và chuẩn bị bước vào không khí Tết." },
  { month: 1, day: 1, title: "Tết Nguyên Đán", shortTitle: "Mùng 1 Tết", tone: "official", meaning: "Ngày đầu năm âm lịch, quan trọng nhất trong văn hóa Việt; gia đình sum họp, chúc Tết, mừng tuổi và cầu mong năm mới bình an." },
  { month: 1, day: 2, title: "Tết Nguyên Đán", shortTitle: "Mùng 2 Tết", tone: "official", meaning: "Những ngày đầu năm âm lịch thường dành để thăm họ hàng, chúc Tết và giữ không khí đoàn viên." },
  { month: 1, day: 3, title: "Tết Nguyên Đán", shortTitle: "Mùng 3 Tết", tone: "official", meaning: "Tiếp nối kỳ Tết cổ truyền, nhiều gia đình thăm thầy cô, bạn bè hoặc chuẩn bị trở lại sinh hoạt thường ngày." },
  { month: 3, day: 10, title: "Giỗ Tổ Hùng Vương", shortTitle: "Giỗ Tổ", tone: "official", meaning: "Ngày tưởng nhớ các Vua Hùng, nhắc người Việt về cội nguồn dân tộc và truyền thống uống nước nhớ nguồn." },
  { month: 5, day: 5, title: "Tết Đoan Ngọ", shortTitle: "Đoan Ngọ", tone: "seasonal", meaning: "Lễ giữa năm âm lịch, dân gian gọi là ngày diệt sâu bọ; nhiều nhà ăn cơm rượu, trái cây và món truyền thống." },
  { month: 7, day: 15, title: "Lễ Vu Lan", shortTitle: "Vu Lan", tone: "seasonal", meaning: "Dịp báo hiếu cha mẹ, tưởng nhớ tổ tiên và người đã khuất; thường gắn với lễ chùa và bữa cơm gia đình." },
  { month: 8, day: 15, title: "Tết Trung thu", shortTitle: "Trung thu", tone: "family", meaning: "Tết của trẻ em và đoàn viên dưới trăng rằm; gia đình thường ăn bánh Trung thu, rước đèn và sum họp." }
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const int = Math.floor;

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function jdFromDate(day: number, month: number, year: number): number {
  const a = int((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  let jd = day + int((153 * m + 2) / 5) + 365 * y + int(y / 4) - int(y / 100) + int(y / 400) - 32045;
  if (jd < 2299161) {
    jd = day + int((153 * m + 2) / 5) + 365 * y + int(y / 4) - 32083;
  }
  return jd;
}

function jdToDate(jd: number): [number, number, number] {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = int((4 * a + 3) / 146097);
    c = a - int((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = int((4 * c + 3) / 1461);
  const e = c - int((1461 * d) / 4);
  const m = int((5 * e + 2) / 153);
  const day = e - int((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * int(m / 10);
  const year = b * 100 + d - 4800 + int(m / 10);
  return [day, month, year];
}

function newMoon(k: number): number {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  const dr = Math.PI / 180;
  let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);

  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  const mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;

  let c1 = (0.1734 - 0.000393 * t) * Math.sin(m * dr) + 0.0021 * Math.sin(2 * dr * m);
  c1 -= 0.4068 * Math.sin(mpr * dr) + 0.0161 * Math.sin(2 * dr * mpr);
  c1 -= 0.0004 * Math.sin(3 * dr * mpr);
  c1 += 0.0104 * Math.sin(2 * dr * f) - 0.0051 * Math.sin((m + mpr) * dr);
  c1 -= 0.0074 * Math.sin((m - mpr) * dr) + 0.0004 * Math.sin((2 * f + m) * dr);
  c1 -= 0.0004 * Math.sin((2 * f - m) * dr) - 0.0006 * Math.sin((2 * f + mpr) * dr);
  c1 += 0.0010 * Math.sin((2 * f - mpr) * dr) + 0.0005 * Math.sin((2 * mpr + m) * dr);

  const deltaT = t < -11
    ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
    : -0.000278 + 0.000265 * t + 0.000262 * t2;

  return jd + c1 - deltaT;
}

function getNewMoonDay(k: number, timeZone: number): number {
  return int(newMoon(k) + 0.5 + timeZone / 24);
}

function getSunLongitude(dayNumber: number, timeZone: number): number {
  const t = (dayNumber - 2451545.5 - timeZone / 24) / 36525;
  const t2 = t * t;
  const dr = Math.PI / 180;
  const m = 357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t * t2;
  const l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  let dl = (1.914600 - 0.004817 * t - 0.000014 * t2) * Math.sin(dr * m);
  dl += (0.019993 - 0.000101 * t) * Math.sin(2 * dr * m) + 0.000290 * Math.sin(3 * dr * m);
  let l = (l0 + dl) * dr;
  l -= Math.PI * 2 * int(l / (Math.PI * 2));
  return int((l / Math.PI) * 6);
}

function getLunarMonth11(year: number, timeZone: number): number {
  const off = jdFromDate(31, 12, year) - 2415021;
  const k = int(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = int((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i += 1;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function convertLunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap: boolean,
  timeZone: number
): [number, number, number] | null {
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }

  const k = int((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;

  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (lunarLeap && lunarMonth !== leapMonth) return null;
    if (lunarLeap || off >= leapOff) off += 1;
  }

  const monthStart = getNewMoonDay(k + off, timeZone);
  return jdToDate(monthStart + lunarDay - 1);
}

function convertSolarToLunar(day: number, month: number, year: number, timeZone: number): VietnamLunarDate {
  const dayNumber = jdFromDate(day, month, year);
  const k = int((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }

  let a11 = getLunarMonth11(year, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = getLunarMonth11(year - 1, timeZone);
  } else {
    lunarYear = year + 1;
    b11 = getLunarMonth11(year + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = int((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }

  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }

  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeapMonth: lunarLeap
  };
}

export function lunarToSolarIsoDate(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  lunarLeap = false
): string | null {
  const converted = convertLunarToSolar(lunarDay, lunarMonth, lunarYear, lunarLeap, VIETNAM_TIME_ZONE);
  if (!converted) return null;
  const [day, month, year] = converted;
  return isoDate(year, month, day);
}

export function getVietnamLunarDateForSolarDate(year: number, month: number, day: number): VietnamLunarDate {
  return convertSolarToLunar(day, month, year, VIETNAM_TIME_ZONE);
}

export function getVietnamHolidaysForMonth(year: number, monthIndex: number): VietnamHoliday[] {
  const month = monthIndex + 1;
  const holidays: VietnamHoliday[] = [];

  SOLAR_HOLIDAYS.forEach(rule => {
    if (rule.month !== month) return;
      holidays.push({
        date: isoDate(year, rule.month, rule.day),
        title: rule.title,
        shortTitle: rule.shortTitle,
        tone: rule.tone,
        meaning: rule.meaning
      });
  });

  for (let lunarYear = year - 1; lunarYear <= year + 1; lunarYear += 1) {
    LUNAR_HOLIDAYS.forEach(rule => {
      const date = lunarToSolarIsoDate(lunarYear, rule.month, rule.day);
      if (!date) return;
      const [solarYear, solarMonth] = date.split("-").map(Number);
      if (solarYear !== year || solarMonth !== month) return;
      holidays.push({
        date,
        title: rule.title,
        shortTitle: rule.shortTitle,
        tone: rule.tone,
        meaning: rule.meaning,
        lunarDate: `${rule.day}/${rule.month} âm lịch`
      });
    });
  }

  const deduped = new Map<string, VietnamHoliday>();
  holidays.forEach(holiday => deduped.set(`${holiday.date}-${holiday.shortTitle}`, holiday));

  return Array.from(deduped.values()).sort((a, b) =>
    a.date === b.date ? a.shortTitle.localeCompare(b.shortTitle, "vi") : a.date.localeCompare(b.date)
  );
}
