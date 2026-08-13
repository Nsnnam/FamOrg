import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_PREFS, mergeDashboardPrefs } from "./dashboardPrefs";

describe("mergeDashboardPrefs", () => {
  it("giữ nguyên widget false thay vì khôi phục true từ mặc định", () => {
    const prefs = mergeDashboardPrefs({
      widgets: { ...DEFAULT_DASHBOARD_PREFS.widgets, news: false, weather: false }
    });
    expect(prefs.widgets.news).toBe(false);
    expect(prefs.widgets.weather).toBe(false);
  });

  it("giữ mảng RSS rỗng khi người dùng bỏ chọn toàn bộ nguồn", () => {
    const prefs = mergeDashboardPrefs({ newsFeeds: [] });
    expect(prefs.newsFeeds).toEqual([]);
  });

  it("giữ các tùy chọn bố cục compact đã lưu", () => {
    const prefs = mergeDashboardPrefs({ newsColumns: 4, newsShowSummary: true, newsLimit: 30 });
    expect(prefs.newsColumns).toBe(4);
    expect(prefs.newsShowSummary).toBe(true);
    expect(prefs.newsLimit).toBe(30);
  });

  it("vẫn cung cấp defaults đầy đủ cho bản cài đặt cũ", () => {
    const prefs = mergeDashboardPrefs(null);
    expect(prefs.widgets).toEqual(DEFAULT_DASHBOARD_PREFS.widgets);
    expect(prefs.newsColumns).toBe("auto");
    expect(prefs.newsShowSummary).toBe(false);
  });
});
