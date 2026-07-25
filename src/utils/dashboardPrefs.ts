/**
 * Dashboard layout / widget preferences (per family, stored server-side).
 */

export type DashboardWidgetId =
  | "hero"
  | "holidays"
  | "weather"
  | "markets"
  | "news"
  | "tasks"
  | "urgent"
  | "balance"
  | "calendar"
  | "birthdays"
  | "meds"
  | "shopping"
  | "nudge"
  | "notes";

export type MarketCardId = "btc" | "eth" | "gold" | "usdVnd" | "eurVnd" | "cnyVnd" | "jpyVnd";

export interface DashboardPrefs {
  widgets: Record<DashboardWidgetId, boolean>;
  markets: Record<MarketCardId, boolean>;
  newsFeeds: string[]; // feed ids
  newsLimit: number;
}

export const DEFAULT_NEWS_FEEDS = [
  { id: "vnexpress", label: "VnExpress", url: "https://vnexpress.net/rss/tin-moi-nhat.rss" },
  { id: "tuoitre", label: "Tuổi Trẻ", url: "https://tuoitre.vn/rss/tin-moi-nhat.rss" },
  { id: "thanhnien", label: "Thanh Niên", url: "https://thanhnien.vn/rss/home.rss" },
  { id: "vietnamnet", label: "VietNamNet", url: "https://vietnamnet.vn/rss/tin-noi-bat.rss" },
  { id: "baochinhphu", label: "Báo Chính phủ", url: "https://baochinhphu.vn/rss/home.rss" },
  { id: "vtv", label: "VTV News", url: "https://vtv.vn/rss/tin-moi-nhat.rss" }
];

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  widgets: {
    hero: true,
    holidays: true,
    weather: true,
    markets: true,
    news: true,
    tasks: true,
    urgent: true,
    balance: true,
    calendar: true,
    birthdays: true,
    meds: true,
    shopping: true,
    nudge: true,
    notes: true
  },
  markets: {
    btc: true,
    eth: true,
    gold: true,
    usdVnd: true,
    eurVnd: false,
    cnyVnd: false,
    jpyVnd: false
  },
  newsFeeds: ["vnexpress", "tuoitre", "baochinhphu"],
  newsLimit: 8
};

export function mergeDashboardPrefs(raw?: Partial<DashboardPrefs> | null): DashboardPrefs {
  const base = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_PREFS)) as DashboardPrefs;
  if (!raw) return base;
  if (raw.widgets) base.widgets = { ...base.widgets, ...raw.widgets };
  if (raw.markets) base.markets = { ...base.markets, ...raw.markets };
  if (Array.isArray(raw.newsFeeds) && raw.newsFeeds.length) base.newsFeeds = raw.newsFeeds;
  if (typeof raw.newsLimit === "number") base.newsLimit = Math.min(20, Math.max(3, raw.newsLimit));
  return base;
}

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  hero: "Banner chào mừng",
  holidays: "Ngày lễ sắp tới",
  weather: "Thời tiết & động đất",
  markets: "Giá thị trường / tỷ giá",
  news: "Tin tức (RSS)",
  tasks: "Task của tôi",
  urgent: "Nhiệm vụ khẩn cấp",
  balance: "Số dư tháng này",
  calendar: "Lịch 20 ngày tới",
  birthdays: "Sinh nhật",
  meds: "Nhắc thuốc",
  shopping: "Đi chợ",
  nudge: "Nhắc người nhà",
  notes: "Ghi chú ghim"
};

export const MARKET_LABELS: Record<MarketCardId, string> = {
  btc: "Bitcoin",
  eth: "Ethereum",
  gold: "Vàng",
  usdVnd: "USD/VND",
  eurVnd: "EUR/VND",
  cnyVnd: "CNY/VND",
  jpyVnd: "JPY/VND"
};
