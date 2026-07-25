/**
 * Browser-side fallback for dashboard market/weather widgets when the Docker
 * container cannot reach the public Internet (common on some Synology setups).
 * Only uses CORS-enabled public APIs.
 */

export type WidgetFallbackResult = {
  weather: any | null;
  crypto: any | null;
  fx: any | null;
  gold: any | null;
  source: "browser";
};

async function fetchJson(url: string, timeoutMs = 12_000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchWidgetsFromBrowser(opts: {
  lat: number;
  lon: number;
  city: string;
}): Promise<WidgetFallbackResult> {
  const { lat, lon, city } = opts;

  const weatherP = fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max,wind_gusts_10m_max` +
      `&timezone=Asia%2FHo_Chi_Minh&forecast_days=3`
  ).then((j) => ({
    city,
    current: j.current,
    daily: j.daily,
    stormRisk: { level: "none", label: "Không có cảnh báo giông bão", detail: "", gust: 0 }
  })).catch(() => null);

  const cryptoP = fetchJson(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd,vnd&include_24hr_change=true"
  ).catch(() => null);

  const fxP = fetchJson("https://open.er-api.com/v6/latest/USD")
    .then((j) => ({ usdVnd: j.rates?.VND ?? null, updated: j.time_last_update_utc ?? null }))
    .catch(async () => {
      try {
        const j = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=VND");
        return { usdVnd: j.rates?.VND ?? null, updated: j.date ?? null };
      } catch {
        return null;
      }
    });

  const [weather, cryptoRaw, fx] = await Promise.all([weatherP, cryptoP, fxP]);

  let crypto: any = null;
  let gold: any = null;
  if (cryptoRaw) {
    crypto = {
      bitcoin: cryptoRaw.bitcoin || null,
      ethereum: cryptoRaw.ethereum || null
    };
    const paxg = cryptoRaw["pax-gold"];
    if (paxg?.usd) {
      const usdPerOz = paxg.usd;
      const rate = fx?.usdVnd || 25000;
      gold = {
        source: "Vàng thế giới (PAXG, trình duyệt)",
        usdPerOz,
        changePct: paxg.usd_24h_change ?? null,
        vndPerTael: Math.round((usdPerOz / 31.1035) * 37.5 * rate),
        updated: new Date().toISOString()
      };
    }
  }

  return { weather, crypto, fx, gold, source: "browser" };
}

/** Merge server partial data with browser fallback (prefer server values). */
export function mergeWidgetData(server: any, browser: WidgetFallbackResult | null): any {
  if (!server && !browser) return null;
  const s = server || {};
  const b = browser || ({} as WidgetFallbackResult);
  const crypto = s.crypto?.bitcoin ? s.crypto : (b.crypto || s.crypto || null);
  const fx = s.fx?.usdVnd ? s.fx : (b.fx || s.fx || null);
  const gold =
    s.gold && (s.gold.sell || s.gold.vndPerTael || s.gold.usdPerOz)
      ? s.gold
      : (b.gold || s.gold || null);
  const weather = s.weather?.current ? s.weather : (b.weather || s.weather || null);
  return {
    ...s,
    weather,
    crypto,
    fx,
    gold,
    quakes: s.quakes ?? null,
    fallback: Boolean(browser) && (!s.weather?.current || !s.crypto?.bitcoin || !s.fx?.usdVnd || !s.gold),
    fallbackSource: browser ? "browser" : undefined
  };
}

/** Human-readable error for network TypeError("Failed to fetch"). */
export function friendlyFetchError(err: unknown, action = "thao tác"): string {
  const msg = err instanceof Error ? err.message : String(err || "");
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg) || err instanceof TypeError) {
    return `Không kết nối được server khi ${action} (Failed to fetch). Thử F5, kiểm tra URL HTTPS, hoặc container đang restart. Nếu lưu AI/Telegram: container có thể không ra Internet — xem Thiết lập → Kiểm tra kết nối mạng.`;
  }
  return msg || `Lỗi khi ${action}.`;
}
