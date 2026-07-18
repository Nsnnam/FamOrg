/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ICS subscribe feed: Apple/Google Calendar đăng ký URL webcal:// là lịch gia đình
// (sự kiện + sinh nhật) TỰ đồng bộ về máy — không cần export file thủ công nữa.
//
// Bảo mật: calendar app không gửi được header Authorization nên xác thực bằng
// token trong query string. Token = HMAC(session secret) — cố định cho cả nhà,
// không lưu thêm gì; đổi session secret là token cũ vô hiệu.

import crypto from "crypto";
import { FamilyDB, getSessionSecret } from "./db.js";
import type { FamilyPlan } from "../src/types.js";

export function icsFeedToken(): string {
  return crypto.createHmac("sha256", getSessionSecret()).update("ics-feed-v1").digest("hex").slice(0, 32);
}

export function isValidIcsToken(token: unknown): boolean {
  if (typeof token !== "string" || !token) return false;
  const expect = Buffer.from(icsFeedToken());
  const got = Buffer.from(token);
  return got.length === expect.length && crypto.timingSafeEqual(got, expect);
}

// Escape text theo RFC 5545 (backslash, chấm phẩy, phẩy, xuống dòng).
const esc = (s: string) =>
  String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// "YYYY-MM-DD HH:mm" → "YYYYMMDDTHHmm00" (floating local time — cả nhà cùng múi giờ).
const toIcsDateTime = (s: string): string | null => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00`;
};

const WEEKDAY_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]; // index khớp recurrenceWeekdays (0=CN)

function planRrule(p: FamilyPlan): string | null {
  if (!p.isRecurring || p.recurrenceType === "none") return null;
  if (p.recurrenceType === "daily") return "FREQ=DAILY";
  if (p.recurrenceType === "monthly") return "FREQ=MONTHLY";
  if (p.recurrenceType === "weekly") {
    const days = (p.recurrenceWeekdays || []).map(d => WEEKDAY_ICS[d]).filter(Boolean);
    return days.length > 0 ? `FREQ=WEEKLY;BYDAY=${days.join(",")}` : "FREQ=WEEKLY";
  }
  return null;
}

/** Dựng toàn bộ nội dung file .ics: mọi sự kiện lịch + sinh nhật thành viên (lặp hằng năm). */
export function buildIcsFeed(): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Organizer//Family Calendar//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Lịch gia đình",
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh"
  ];
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  for (const p of FamilyDB.getPlans()) {
    const start = toIcsDateTime(p.startDate);
    if (!start) continue;
    const end = toIcsDateTime(p.endDate) || start;
    const rrule = planRrule(p);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@family-organizer`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${esc(p.title)}`,
      ...(p.description ? [`DESCRIPTION:${esc(p.description)}`] : []),
      ...(rrule ? [`RRULE:${rrule}`] : []),
      "END:VEVENT"
    );
  }

  // Sinh nhật: sự kiện cả ngày lặp hằng năm theo ngày/tháng sinh.
  for (const u of FamilyDB.getUsers()) {
    const m = String(u.dateOfBirth || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) continue;
    const thisYear = new Date().getFullYear();
    lines.push(
      "BEGIN:VEVENT",
      `UID:bday-${u.id}@family-organizer`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${thisYear}${m[2]}${m[3]}`,
      `SUMMARY:${esc(`🎂 Sinh nhật ${u.fullName}`)}`,
      "RRULE:FREQ=YEARLY",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  // RFC yêu cầu CRLF giữa các dòng.
  return lines.join("\r\n") + "\r\n";
}
