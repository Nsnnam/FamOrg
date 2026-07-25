/**
 * App branding — tên, tagline, logo, favicon.
 * Defaults match FamOrg / Family Hub.
 */

export interface BrandingSettings {
  appName: string;       // "FamOrg"
  tagline: string;       // "Family Hub" — dòng phụ dưới tên
  siteTitle: string;     // document.title
  description: string;
  logoType: "emoji" | "url" | "image";
  logoEmoji: string;
  logoUrl: string;
  logoImage: string;     // data URL or /uploads/...
  authSubtitle: string;
  syncFavicon: boolean;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "FamOrg",
  tagline: "Family Hub",
  siteTitle: "FamOrg — Family Hub",
  description: "Hệ thống quản lý gia đình tất-cả-trong-một",
  logoType: "emoji",
  logoEmoji: "🏡",
  logoUrl: "/pwa-icon.svg",
  logoImage: "",
  authSubtitle: "Hệ thống cộng tác hằng ngày của gia đình thân thương",
  syncFavicon: true
};

export function mergeBranding(partial?: Partial<BrandingSettings> | null): BrandingSettings {
  return { ...DEFAULT_BRANDING, ...(partial || {}) };
}

export function applyBrandingToDocument(b: BrandingSettings) {
  if (typeof document === "undefined") return;
  document.title = b.siteTitle || `${b.appName} — ${b.tagline}`;
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = b.description || DEFAULT_BRANDING.description;

  const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (apple) apple.setAttribute("content", b.appName);

  if (b.syncFavicon) {
    const href =
      b.logoType === "image" && b.logoImage
        ? b.logoImage
        : b.logoType === "url" && b.logoUrl
          ? b.logoUrl
          : b.logoType === "emoji"
            ? emojiToFaviconDataUrl(b.logoEmoji || "🏡")
            : "/pwa-icon.svg";
    setFaviconHref(href);
  }
}

function setFaviconHref(href: string) {
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
  const apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (apple) apple.href = href;
}

/** Tiny SVG favicon from emoji (data URL). */
export function emojiToFaviconDataUrl(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="50" x="32" text-anchor="middle" font-size="48">${escapeXml(emoji)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function getLogoDisplay(b: BrandingSettings): { kind: "emoji" | "img"; value: string } {
  if (b.logoType === "image" && b.logoImage) return { kind: "img", value: b.logoImage };
  if (b.logoType === "url" && b.logoUrl) return { kind: "img", value: b.logoUrl };
  return { kind: "emoji", value: b.logoEmoji || "🏡" };
}
