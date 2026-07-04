/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { getVietnamHolidaysForMonth, getVietnamLunarDateForSolarDate, lunarToSolarIsoDate } from "./vietnamHolidays.js";

describe("lunarToSolarIsoDate", () => {
  it("maps core Vietnamese lunar holidays to Gregorian dates", () => {
    expect(lunarToSolarIsoDate(2024, 1, 1)).toBe("2024-02-10");
    expect(lunarToSolarIsoDate(2025, 3, 10)).toBe("2025-04-07");
    expect(lunarToSolarIsoDate(2026, 8, 15)).toBe("2026-09-25");
  });
});

describe("getVietnamLunarDateForSolarDate", () => {
  it("maps Gregorian dates back to Vietnamese lunar dates", () => {
    expect(getVietnamLunarDateForSolarDate(2026, 2, 17)).toMatchObject({
      day: 1,
      month: 1,
      year: 2026,
      isLeapMonth: false
    });
    expect(getVietnamLunarDateForSolarDate(2026, 9, 25)).toMatchObject({
      day: 15,
      month: 8,
      year: 2026,
      isLeapMonth: false
    });
  });
});

describe("getVietnamHolidaysForMonth", () => {
  it("includes fixed solar holidays", () => {
    const september = getVietnamHolidaysForMonth(2026, 8);
    expect(september).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-09-02",
          shortTitle: "Quốc khánh",
          tone: "official"
        })
      ])
    );
  });

  it("includes lunar holidays from the previous lunar year when they fall in this Gregorian year", () => {
    const february = getVietnamHolidaysForMonth(2026, 1);
    expect(february).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-02-10", shortTitle: "Ông Công Ông Táo" }),
        expect.objectContaining({ date: "2026-02-17", shortTitle: "Mùng 1 Tết" }),
        expect.objectContaining({ date: "2026-02-18", shortTitle: "Mùng 2 Tết" }),
        expect.objectContaining({ date: "2026-02-19", shortTitle: "Mùng 3 Tết" })
      ])
    );
  });
});
