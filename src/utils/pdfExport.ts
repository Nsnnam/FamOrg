/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Xuất PDF phía client bằng pdfmake (lazy-load ~1MB chỉ khi bấm nút xuất).
// Font Roboto đi kèm pdfmake có đủ glyph tiếng Việt.
// Trên iPhone PWA: ưu tiên share sheet (Lưu vào Tệp / In / AirDrop);
// desktop fallback tải file như bình thường.

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { normalizeSearchText } from "./searchText.js";

// Bảng màu in ấn (PDF nền trắng — không theo theme app)
const INK = "#0f172a";      // chữ chính (slate-900)
const MUTED = "#64748b";    // chữ phụ (slate-500)
const LINE = "#e2e8f0";     // kẻ bảng (slate-200)
const INDIGO = "#4f46e5";   // nhấn thương hiệu
const EMERALD = "#059669";  // tiền vào
const ROSE = "#e11d48";     // tiền ra / cảnh báo y tế

async function createPdfBlob(docDefinition: TDocumentDefinitions): Promise<Blob> {
  const [pdfMakeMod, vfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);
  // pdfmake là bundle UMD/CJS — tuỳ interop mà API nằm ở namespace hay .default
  const pdfMake: typeof import("pdfmake/build/pdfmake") = (pdfMakeMod as any).default ?? pdfMakeMod;
  const vfs = (vfsMod as any).default ?? vfsMod;
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake.createPdf(docDefinition).getBlob();
}

/** Chia sẻ (iOS share sheet) hoặc tải xuống file PDF. */
async function deliverPdf(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  // iOS/Android PWA: share sheet cho phép Lưu vào Tệp / In / gửi Zalo...
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") return; // người dùng đóng share sheet — không fallback
      // NotAllowedError... → rơi xuống tải file
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;
const fmtDateVN = (raw: string) => {
  const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(raw || "");
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) BÁO CÁO THU CHI THEO KỲ (tháng / quý / năm)
// ─────────────────────────────────────────────────────────────────────────────

export interface FinanceReportPdfData {
  periodLabel: string; // "Tháng 07/2026", "Quý 3/2026"...
  totals: { totalIncome: number; totalExpense: number; balance: number };
  /** Chi theo hạng mục trong kỳ, đã sort giảm dần */
  byCategory: { label: string; amount: number }[];
  /** Số dư từng ví (tính trên TOÀN BỘ giao dịch, không chỉ kỳ này) */
  accountBalances: { label: string; amount: number }[];
  /** Giao dịch trong kỳ (đã dịch nhãn), sort mới → cũ */
  transactions: {
    date: string; type: "income" | "expense";
    category: string; account: string;
    amount: number; description: string; creator: string;
  }[];
  generatedBy: string;
}

export async function exportFinanceReportPdf(data: FinanceReportPdfData): Promise<void> {
  const { totals } = data;

  const summaryCell = (label: string, value: string, color: string): Content => ({
    stack: [
      { text: label, fontSize: 8, color: MUTED, margin: [0, 0, 0, 2] },
      { text: value, fontSize: 13, bold: true, color }
    ],
    margin: [8, 6, 8, 6]
  });

  const catRows = data.byCategory.map(c => ([
    { text: c.label, fontSize: 9, color: INK },
    { text: fmtMoney(c.amount), fontSize: 9, color: INK, alignment: "right" as const },
    {
      text: totals.totalExpense > 0 ? `${Math.round((c.amount / totals.totalExpense) * 100)}%` : "—",
      fontSize: 9, color: MUTED, alignment: "right" as const
    }
  ]));

  const txRows = data.transactions.map(tx => ([
    { text: fmtDateVN(tx.date), fontSize: 8, color: MUTED },
    { text: tx.description || "—", fontSize: 8, color: INK },
    { text: tx.category, fontSize: 8, color: MUTED },
    { text: tx.account, fontSize: 8, color: MUTED },
    { text: tx.creator, fontSize: 8, color: MUTED },
    {
      text: `${tx.type === "income" ? "+" : "−"}${fmtMoney(tx.amount)}`,
      fontSize: 8, bold: true, alignment: "right" as const,
      color: tx.type === "income" ? EMERALD : ROSE
    }
  ]));

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [36, 40, 36, 44],
    info: { title: `Báo cáo thu chi — ${data.periodLabel}` },
    footer: (page, total) => ({
      columns: [
        { text: `Family Organizer • xuất bởi ${data.generatedBy} • ${new Date().toLocaleDateString("vi-VN")}`, fontSize: 7, color: MUTED },
        { text: `Trang ${page}/${total}`, fontSize: 7, color: MUTED, alignment: "right" }
      ],
      margin: [36, 14, 36, 0]
    }),
    content: [
      { text: "BÁO CÁO THU CHI GIA ĐÌNH", fontSize: 16, bold: true, color: INDIGO },
      { text: data.periodLabel, fontSize: 11, color: MUTED, margin: [0, 2, 0, 14] },

      // Tổng quan Thu / Chi / Cân đối
      {
        table: {
          widths: ["*", "*", "*"],
          body: [[
            summaryCell("TỔNG THU", `+${fmtMoney(totals.totalIncome)}`, EMERALD),
            summaryCell("TỔNG CHI", `−${fmtMoney(totals.totalExpense)}`, ROSE),
            summaryCell("CÂN ĐỐI", `${totals.balance >= 0 ? "+" : ""}${fmtMoney(totals.balance)}`, totals.balance >= 0 ? EMERALD : ROSE)
          ]]
        },
        layout: { hLineColor: () => LINE, vLineColor: () => LINE },
        margin: [0, 0, 0, 14]
      },

      // Số dư ví hiện tại
      { text: "Số dư ví hiện tại (toàn bộ lịch sử)", fontSize: 10, bold: true, color: INK, margin: [0, 0, 0, 6] },
      {
        columns: data.accountBalances.map(a => ({
          text: [
            { text: `${a.label}\n`, fontSize: 8, color: MUTED },
            { text: fmtMoney(a.amount), fontSize: 10, bold: true, color: a.amount >= 0 ? INK : ROSE }
          ]
        })),
        margin: [0, 0, 0, 14]
      },

      // Chi theo hạng mục
      ...(catRows.length > 0 ? [
        { text: "Chi tiêu theo hạng mục", fontSize: 10, bold: true, color: INK, margin: [0, 0, 0, 6] } as Content,
        {
          table: {
            headerRows: 1,
            widths: ["*", 90, 40],
            body: [
              [
                { text: "Hạng mục", fontSize: 8, bold: true, color: MUTED },
                { text: "Số tiền", fontSize: 8, bold: true, color: MUTED, alignment: "right" as const },
                { text: "Tỷ lệ", fontSize: 8, bold: true, color: MUTED, alignment: "right" as const }
              ],
              ...catRows
            ]
          },
          layout: {
            hLineWidth: (i: number) => (i <= 1 ? 0.7 : 0.4),
            vLineWidth: () => 0,
            hLineColor: () => LINE,
            paddingTop: () => 4, paddingBottom: () => 4
          },
          margin: [0, 0, 0, 14]
        } as Content
      ] : []),

      // Danh sách giao dịch
      { text: `Danh sách giao dịch (${data.transactions.length})`, fontSize: 10, bold: true, color: INK, margin: [0, 0, 0, 6] },
      txRows.length === 0
        ? { text: "Không có giao dịch nào trong kỳ.", fontSize: 9, color: MUTED, italics: true }
        : {
            table: {
              headerRows: 1,
              widths: [48, "*", 62, 46, 56, 72],
              body: [
                ["Ngày", "Nội dung", "Hạng mục", "Ví", "Người tạo", "Số tiền"].map((h, i) => ({
                  text: h, fontSize: 8, bold: true, color: MUTED,
                  alignment: i === 5 ? ("right" as const) : ("left" as const)
                })),
                ...txRows
              ]
            },
            layout: {
              hLineWidth: (i: number) => (i <= 1 ? 0.7 : 0.4),
              vLineWidth: () => 0,
              hLineColor: () => LINE,
              paddingTop: () => 3, paddingBottom: () => 3
            }
          }
    ]
  };

  const blob = await createPdfBlob(doc);
  const stamp = new Date().toISOString().slice(0, 10);
  await deliverPdf(blob, `bao-cao-thu-chi_${stamp}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) THẺ KHẨN CẤP (in bỏ ví — khổ A6 ngang)
// ─────────────────────────────────────────────────────────────────────────────

export interface EmergencyCardPdfData {
  fullName: string;
  relationLabel?: string;   // "Bố", "Mẹ", "Con gái"...
  dateOfBirth?: string;     // YYYY-MM-DD
  bloodType?: string;
  heightCm?: number;
  weightKg?: number;
  allergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  healthInsuranceNumber?: string;
  notes?: string;
  contacts: { name: string; phone: string; relation?: string }[];
}

export async function exportEmergencyCardPdf(p: EmergencyCardPdfData): Promise<void> {
  const row = (label: string, value?: string, valueColor = INK): Content[] => value ? [{
    columns: [
      { text: label, fontSize: 7.5, color: MUTED, width: 62 },
      { text: value, fontSize: 8.5, bold: true, color: valueColor, width: "*" }
    ],
    margin: [0, 1.5, 0, 0]
  }] : [];

  const body = [
    p.dateOfBirth ? `Sinh ${fmtDateVN(p.dateOfBirth)}` : "",
    p.heightCm ? `${p.heightCm} cm` : "",
    p.weightKg ? `${p.weightKg} kg` : ""
  ].filter(Boolean).join(" • ");

  const doc: TDocumentDefinitions = {
    // A6 ngang: 148 × 105 mm ≈ 420 × 298 pt — in ra gập bỏ ví được
    pageSize: { width: 420, height: 298 },
    pageMargins: [18, 16, 18, 14],
    info: { title: `Thẻ khẩn cấp — ${p.fullName}` },
    content: [
      // Dải tiêu đề
      {
        columns: [
          {
            stack: [
              { text: "THẺ KHẨN CẤP Y TẾ", fontSize: 8, bold: true, color: ROSE, characterSpacing: 1 },
              { text: p.fullName + (p.relationLabel ? `  (${p.relationLabel})` : ""), fontSize: 14, bold: true, color: INK, margin: [0, 2, 0, 0] },
              ...(body ? [{ text: body, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] } as Content] : [])
            ],
            width: "*"
          },
          ...(p.bloodType ? [{
            table: { body: [[{ text: `Nhóm máu\n${p.bloodType}`, fontSize: 11, bold: true, color: "#ffffff", alignment: "center" as const, margin: [6, 4, 6, 4] }]] },
            layout: { fillColor: () => ROSE, hLineWidth: () => 0, vLineWidth: () => 0 },
            width: "auto"
          } as Content] : [])
        ],
        margin: [0, 0, 0, 8]
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 384, y2: 0, lineWidth: 0.8, lineColor: LINE }], margin: [0, 0, 0, 6] },

      ...row("Dị ứng", p.allergies, ROSE),
      ...row("Bệnh nền", p.chronicConditions),
      ...row("Thuốc đang dùng", p.currentMedications),
      ...row("Số BHYT", p.healthInsuranceNumber),
      ...row("Ghi chú", p.notes),

      ...(p.contacts.length > 0 ? [
        { text: "LIÊN HỆ KHẨN CẤP", fontSize: 7.5, bold: true, color: INDIGO, characterSpacing: 1, margin: [0, 8, 0, 2] } as Content,
        ...p.contacts.map(c => ({
          columns: [
            { text: `${c.name}${c.relation ? ` (${c.relation})` : ""}`, fontSize: 8.5, color: INK, width: "*" },
            { text: c.phone, fontSize: 9, bold: true, color: INDIGO, width: "auto" }
          ],
          margin: [0, 1.5, 0, 0]
        } as Content))
      ] : [])
    ],
    footer: {
      text: "Family Organizer — mang thẻ này theo người / để trong ví",
      fontSize: 6.5, color: MUTED, alignment: "center"
    }
  };

  const blob = await createPdfBlob(doc);
  const slug = normalizeSearchText(p.fullName).replace(/\s+/g, "-");
  await deliverPdf(blob, `the-khan-cap_${slug}.pdf`);
}
