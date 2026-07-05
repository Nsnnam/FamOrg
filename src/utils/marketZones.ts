/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Phân loại món cần mua theo KHU QUẦY trong chợ/siêu thị Việt Nam, để người đi
// chợ đi tới khu nào là mua đủ đồ khu đó — không phải chạy qua chạy lại.
// Thuật toán: so khớp từ khóa tiếng Việt (ưu tiên cụm dài trước — "tôm khô" thắng
// "tôm", "bắp bò" thắng "bắp"); từ khóa ngắn (≤3 ký tự) chỉ khớp nguyên từ để
// tránh dính nhầm bên trong chữ khác. Không khớp được thì rơi về nhóm chất của
// thực đơn (Đạm/Rau củ/…) nếu có, cuối cùng là "Khác".

import type { FoodCategory } from "../types.js";

export type MarketZone = "thit" | "rau" | "traicay" | "mat" | "kho" | "giavi" | "dodung" | "khac";

// Thứ tự hiển thị = lộ trình đi chợ hợp lý: đồ tươi trước, đồ khô sau.
export const MARKET_ZONE_ORDER: MarketZone[] = ["thit", "rau", "traicay", "mat", "kho", "giavi", "dodung", "khac"];

export const MARKET_ZONE_META: Record<MarketZone, { label: string; emoji: string; accent: string }> = {
  thit:    { label: "Thịt & hải sản tươi",        emoji: "🥩", accent: "text-rose-400" },
  rau:     { label: "Rau củ & rau gia vị",         emoji: "🥬", accent: "text-emerald-400" },
  traicay: { label: "Trái cây",                    emoji: "🍎", accent: "text-amber-400" },
  mat:     { label: "Trứng, sữa & đồ mát",         emoji: "🥚", accent: "text-sky-400" },
  kho:     { label: "Tinh bột, bún mì & đồ khô",   emoji: "🍚", accent: "text-violet-400" },
  giavi:   { label: "Gia vị & đồ nêm",             emoji: "🧂", accent: "text-teal-400" },
  dodung:  { label: "Đồ dùng & hoá phẩm",          emoji: "🧴", accent: "text-indigo-400" },
  khac:    { label: "Khác",                        emoji: "🛒", accent: "text-slate-400" }
};

// [từ khóa, khu]. Không cần liệt kê hết mọi thứ trên đời — chỉ cần phủ nguyên
// liệu món Việt phổ biến; phần còn lại đã có fallback theo nhóm chất.
const KEYWORDS: [string, MarketZone][] = [
  // ── Thịt & hải sản tươi ──
  ["thịt", "thit"], ["bò", "thit"], ["heo", "thit"], ["gà", "thit"], ["vịt", "thit"],
  ["cá", "thit"], ["tôm", "thit"], ["tép", "thit"], ["mực", "thit"], ["cua", "thit"],
  ["ghẹ", "thit"], ["ốc", "thit"], ["nghêu", "thit"], ["sò", "thit"], ["hến", "thit"],
  ["sườn", "thit"], ["sườn heo", "thit"], ["sườn non", "thit"], ["xương", "thit"],
  ["lòng", "thit"], ["gan", "thit"], ["ba chỉ", "thit"], ["nạc", "thit"], ["đùi", "thit"],
  ["cánh gà", "thit"], ["chả cá", "thit"], ["hải sản", "thit"], ["lươn", "thit"],
  ["ếch", "thit"], ["bắp bò", "thit"], ["trâu", "thit"], ["dê", "thit"], ["giò heo", "thit"],
  ["bê", "thit"], ["cút", "thit"],

  // ── Rau củ & rau gia vị tươi ──
  ["rau", "rau"], ["cải", "rau"], ["muống", "rau"], ["ngót", "rau"], ["mồng tơi", "rau"],
  ["bí", "rau"], ["bí đỏ", "rau"], ["bí xanh", "rau"], ["bầu", "rau"], ["mướp", "rau"],
  ["mướp đắng", "rau"], ["cà chua", "rau"], ["cà tím", "rau"], ["cà rốt", "rau"],
  ["cà pháo", "rau"], ["su su", "rau"], ["su hào", "rau"], ["súp lơ", "rau"],
  ["bông cải", "rau"], ["nấm", "rau"], ["giá", "rau"], ["hành", "rau"], ["tỏi", "rau"],
  ["gừng", "rau"], ["ớt", "rau"], ["ớt chuông", "rau"], ["sả", "rau"], ["chanh", "rau"],
  ["khổ qua", "rau"], ["đậu bắp", "rau"], ["bắp cải", "rau"], ["bắp chuối", "rau"],
  ["dưa leo", "rau"], ["dưa chuột", "rau"], ["xà lách", "rau"], ["ngò", "rau"],
  ["cần tây", "rau"], ["lá lốt", "rau"], ["khế", "rau"], ["măng", "rau"], ["khoai", "rau"],
  ["củ", "rau"], ["hẹ", "rau"], ["diếp", "rau"], ["bạc hà", "rau"], ["đồ chua", "rau"],
  ["dền", "rau"], ["thì là", "rau"], ["kinh giới", "rau"], ["tía tô", "rau"],
  ["húng", "rau"], ["bắp", "rau"], ["đậu cô ve", "rau"], ["đậu que", "rau"],

  // ── Trái cây ──
  ["chuối", "traicay"], ["cam", "traicay"], ["táo", "traicay"], ["ổi", "traicay"],
  ["dưa hấu", "traicay"], ["xoài", "traicay"], ["thanh long", "traicay"], ["đu đủ", "traicay"],
  ["quýt", "traicay"], ["nho", "traicay"], ["lê", "traicay"], ["bưởi", "traicay"],
  ["mít", "traicay"], ["sầu riêng", "traicay"], ["măng cụt", "traicay"], ["chôm chôm", "traicay"],
  ["dứa", "traicay"], ["vú sữa", "traicay"], ["quả bơ", "traicay"], ["trái bơ", "traicay"],
  ["mãng cầu", "traicay"], ["nhãn", "traicay"], ["vải", "traicay"], ["chanh dây", "traicay"],
  ["dâu", "traicay"],

  // ── Trứng, sữa & đồ mát (đồ nguội, đông lạnh nhẹ) ──
  ["trứng", "mat"], ["sữa", "mat"], ["sữa chua", "mat"], ["váng sữa", "mat"],
  ["đậu phụ", "mat"], ["đậu hũ", "mat"], ["tàu hũ", "mat"], ["chả lụa", "mat"],
  ["giò lụa", "mat"], ["xúc xích", "mat"], ["phô mai", "mat"], ["phomai", "mat"],
  ["kem", "mat"], ["yaourt", "mat"], ["bơ", "mat"],

  // ── Tinh bột, bún mì & đồ khô/tạp hoá ──
  ["gạo", "kho"], ["nếp", "kho"], ["bún", "kho"], ["phở", "kho"], ["bánh phở", "kho"],
  ["bánh canh", "kho"], ["bánh mì", "kho"], ["bánh cuốn", "kho"], ["bánh tráng", "kho"],
  ["hủ tiếu", "kho"], ["mì", "kho"], ["mì trứng", "kho"], ["miến", "kho"], ["nui", "kho"], ["yến mạch", "kho"],
  ["bột", "kho"], ["đậu xanh", "kho"], ["đậu đen", "kho"], ["đậu đỏ", "kho"],
  ["đậu phộng", "kho"], ["lạc", "kho"], ["mè", "kho"], ["vừng", "kho"], ["ngũ cốc", "kho"],
  ["cà phê", "kho"], ["trà", "kho"], ["bia", "kho"], ["nước ngọt", "kho"], ["nước suối", "kho"],

  // ── Gia vị & đồ nêm ──
  ["nước mắm", "giavi"], ["mắm", "giavi"], ["muối", "giavi"], ["đường", "giavi"],
  ["tiêu", "giavi"], ["dầu ăn", "giavi"], ["dầu hào", "giavi"], ["dầu mè", "giavi"],
  ["hạt nêm", "giavi"], ["bột ngọt", "giavi"], ["mì chính", "giavi"], ["tương", "giavi"],
  ["sa tế", "giavi"], ["me", "giavi"], ["giấm", "giavi"], ["ớt bột", "giavi"],
  ["gia vị", "giavi"], ["tôm khô", "giavi"],

  // ── Đồ dùng & hoá phẩm (đồ thêm tay không phải thực phẩm) ──
  ["giấy", "dodung"], ["xà phòng", "dodung"], ["xà bông", "dodung"], ["nước rửa", "dodung"],
  ["bột giặt", "dodung"], ["nước giặt", "dodung"], ["kem đánh răng", "dodung"],
  ["bàn chải", "dodung"], ["khăn", "dodung"], ["túi", "dodung"], ["nước lau", "dodung"],
  ["dầu gội", "dodung"], ["sữa tắm", "dodung"], ["dầu xả", "dodung"],
  ["băng vệ sinh", "dodung"], ["tăm", "dodung"], ["khẩu trang", "dodung"], ["pin", "dodung"],
  ["bóng đèn", "dodung"], ["nước tẩy", "dodung"]
];

// Cụm dài xét trước để "tôm khô" thắng "tôm", "bắp chuối" thắng "chuối"…
const SORTED = KEYWORDS.slice().sort((a, b) => b[0].length - a[0].length);

const normalize = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

function matchZone(text: string): MarketZone | null {
  const n = normalize(text);
  if (!n) return null;
  const tokens = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const [kw, zone] of SORTED) {
    if (kw.length <= 3) {
      if (tokens.includes(kw)) return zone; // từ ngắn: phải là nguyên từ
    } else if (n.includes(kw)) {
      return zone;
    }
  }
  return null;
}

export function classifyMarketZone(name: string, cat?: FoodCategory | string): MarketZone {
  // Dòng gộp nhiều thứ ("Rau sống & bánh tráng mè") → món ĐẦU TIÊN là chủ đạo;
  // không nhận ra mới xét cả chuỗi ("Cơm gà (gạo tẻ)" → gạo).
  const firstSegment = (name || "").split(/[&,+]|\bvà\b/)[0];
  const zone = matchZone(firstSegment) ?? matchZone(name);
  if (zone) return zone;
  switch (cat) {
    case "Đạm": return "thit";
    case "Rau củ": return "rau";
    case "Trái cây": return "traicay";
    case "Tinh bột": return "kho";
    case "Gia vị": return "giavi";
  }
  return "khac";
}
