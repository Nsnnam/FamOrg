/**
 * Appearance / background customization (light+dark presets + custom image).
 */

export type BgPresetId =
  | "default"
  | "ocean"
  | "sunset"
  | "forest"
  | "lavender"
  | "midnight"
  | "rose"
  | "slate"
  | "custom";

export interface AppearanceSettings {
  bgPreset: BgPresetId;
  /** data URL or /uploads/... for custom wallpaper */
  customBgUrl: string;
  customBgOpacity: number; // 0.05 – 0.45
  accent: "sky" | "emerald" | "violet" | "amber" | "rose" | "cyan";
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  bgPreset: "default",
  customBgUrl: "",
  customBgOpacity: 0.18,
  accent: "sky"
};

export const BG_PRESETS: {
  id: BgPresetId;
  label: string;
  light: string;
  dark: string;
}[] = [
  { id: "default", label: "Mặc định", light: "bg-slate-50", dark: "bg-slate-950" },
  { id: "ocean", label: "Đại dương", light: "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100", dark: "bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-950" },
  { id: "sunset", label: "Hoàng hôn", light: "bg-gradient-to-br from-orange-50 via-rose-50 to-amber-100", dark: "bg-gradient-to-br from-slate-950 via-rose-950 to-orange-950" },
  { id: "forest", label: "Rừng xanh", light: "bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100", dark: "bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950" },
  { id: "lavender", label: "Oải hương", light: "bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-100", dark: "bg-gradient-to-br from-slate-950 via-violet-950 to-purple-950" },
  { id: "midnight", label: "Nửa đêm", light: "bg-gradient-to-br from-indigo-100 via-slate-100 to-blue-50", dark: "bg-gradient-to-br from-black via-indigo-950 to-slate-950" },
  { id: "rose", label: "Hồng nhạt", light: "bg-gradient-to-br from-rose-50 via-pink-50 to-red-50", dark: "bg-gradient-to-br from-slate-950 via-rose-950 to-pink-950" },
  { id: "slate", label: "Xám than", light: "bg-gradient-to-br from-slate-100 via-zinc-50 to-slate-200", dark: "bg-gradient-to-br from-zinc-950 via-slate-900 to-neutral-950" },
  { id: "custom", label: "Ảnh tùy chỉnh", light: "bg-slate-50", dark: "bg-slate-950" }
];

export function mergeAppearance(raw?: Partial<AppearanceSettings> | null): AppearanceSettings {
  return { ...DEFAULT_APPEARANCE, ...(raw || {}) };
}

export function appearanceBodyClass(a: AppearanceSettings, theme: "light" | "dark"): string {
  const p = BG_PRESETS.find(x => x.id === a.bgPreset) || BG_PRESETS[0];
  return theme === "dark" ? p.dark : p.light;
}
