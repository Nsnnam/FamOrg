/**
 * Multi-provider free/cheap AI helpers.
 * Supports: Google Gemini, Groq, OpenRouter, OpenAI-compatible endpoints.
 */

import { getAppSettings, setAppSetting } from "./db.js";

export type AiProviderId = "gemini" | "groq" | "openrouter" | "openai";

export interface AiConfig {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string; // openai-compatible only
  source: "app" | "env" | "none";
}

export const AI_PROVIDERS: {
  id: AiProviderId;
  label: string;
  freeNote: string;
  keyUrl: string;
  defaultModel: string;
  models: { id: string; label: string }[];
  baseUrl?: string;
}[] = [
  {
    id: "gemini",
    label: "Google Gemini (AI Studio)",
    freeNote: "Key miễn phí tại Google AI Studio — model Flash mới (3.5/3.6).",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.5-flash",
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (khuyến nghị)" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (mới nhất)" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (nhanh)" },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
      { id: "gemini-flash-latest", label: "gemini-flash-latest (alias)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (cũ — có thể lỗi user mới)" }
    ]
  },
  {
    id: "groq",
    label: "Groq (miễn phí)",
    freeNote: "API nhanh, free tier — key tại console.groq.com",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { id: "gemma2-9b-it", label: "Gemma 2 9B" },
      { id: "qwen/qwen3-32b", label: "Qwen3 32B" }
    ]
  },
  {
    id: "openrouter",
    label: "OpenRouter (free models)",
    freeNote: "Nhiều model free — openrouter.ai/keys (chọn model :free)",
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "google/gemini-2.0-flash-exp:free",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (free)" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B free" },
      { id: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B free" },
      { id: "qwen/qwen-2.5-7b-instruct:free", label: "Qwen 2.5 7B free" },
      { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B free" }
    ]
  },
  {
    id: "openai",
    label: "OpenAI-compatible / tự host",
    freeNote: "Ollama, LM Studio, Together, Fireworks, SpaceXAI… — dán base URL + key.",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini" },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { id: "gpt-4o", label: "gpt-4o" }
    ]
  }
];

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function getAiConfig(): AiConfig {
  const s = getAppSettings();
  // Backward compat: old installs only had geminiApiKey
  let provider = (s.aiProvider || "").trim() as AiProviderId;
  if (!provider || !AI_PROVIDERS.some(p => p.id === provider)) {
    provider = "gemini";
  }
  const fromApp = (s.aiApiKey || s.geminiApiKey || "").trim();
  const fromEnv =
    (process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.AI_API_KEY || "").trim();
  const apiKey = fromApp || fromEnv;
  const source: AiConfig["source"] = fromApp ? "app" : fromEnv ? "env" : "none";
  const meta = AI_PROVIDERS.find(p => p.id === provider)!;
  const model = (s.aiModel || "").trim() || meta.defaultModel;
  const baseUrl = (s.aiBaseUrl || meta.baseUrl || "").trim() || undefined;
  return { provider, apiKey, model, baseUrl, source };
}

export function aiStatusPublic() {
  const cfg = getAiConfig();
  const meta = AI_PROVIDERS.find(p => p.id === cfg.provider);
  return {
    configured: Boolean(cfg.apiKey),
    source: cfg.source,
    masked: maskKey(cfg.apiKey),
    provider: cfg.provider,
    providerLabel: meta?.label || cfg.provider,
    model: cfg.model,
    baseUrl: cfg.provider === "openai" ? cfg.baseUrl || "" : undefined,
    providers: AI_PROVIDERS.map(p => ({
      id: p.id,
      label: p.label,
      freeNote: p.freeNote,
      keyUrl: p.keyUrl,
      defaultModel: p.defaultModel,
      models: p.models,
      needsBaseUrl: p.id === "openai"
    }))
  };
}

export function saveAiConfig(input: {
  provider?: string;
  apiKey?: string | null;
  model?: string;
  baseUrl?: string | null;
  clear?: boolean;
}) {
  if (input.clear || input.apiKey === "") {
    setAppSetting("aiApiKey", null);
    setAppSetting("geminiApiKey", null);
    return getAiConfig();
  }
  if (input.provider) {
    const p = AI_PROVIDERS.find(x => x.id === input.provider);
    setAppSetting("aiProvider", p ? p.id : "gemini");
  }
  if (input.apiKey != null && String(input.apiKey).trim()) {
    const key = String(input.apiKey).trim();
    setAppSetting("aiApiKey", key);
    // Keep legacy key field in sync when provider is gemini
    const prov = (getAppSettings().aiProvider || "gemini") as string;
    if (prov === "gemini") setAppSetting("geminiApiKey", key);
  }
  if (input.model != null && String(input.model).trim()) {
    setAppSetting("aiModel", String(input.model).trim().slice(0, 120));
  }
  if (input.baseUrl !== undefined) {
    setAppSetting("aiBaseUrl", input.baseUrl ? String(input.baseUrl).trim().slice(0, 300) : null);
  }
  return getAiConfig();
}

function isOverloaded(err: any): boolean {
  const msg = String(err?.message || err || "");
  return /\b(503|429)\b|overloaded|unavailable|rate.?limit|quota|try again/i.test(msg);
}

export function aiErrorMessage(err: any): string {
  const msg = String(err?.message || err || "");
  if (/no longer available|NOT_FOUND|not found|404/i.test(msg)) {
    return "Model AI không còn dùng được (404). Vào Thiết lập → chọn model mới hơn (vd. Gemini 3.5 Flash) rồi lưu lại.";
  }
  if (isOverloaded(err)) {
    return "AI đang quá tải / rate limit. Chờ một lát hoặc đổi provider/model rồi thử lại.";
  }
  return msg || "AI đang gặp lỗi, vui lòng thử lại.";
}

/** Unified text generation used by all AI features. */
export async function aiGenerateText(opts: {
  prompt: string;
  system?: string;
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const cfg = getAiConfig();
  if (!cfg.apiKey) throw new Error("Chưa cấu hình API key AI. Vào Thiết lập → Trí tuệ AI.");

  const timeoutMs = opts.timeoutMs ?? 45_000;
  const work = (async () => {
    if (cfg.provider === "gemini") {
      return generateGemini(cfg, opts);
    }
    return generateOpenAiCompat(cfg, opts);
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<string>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Timeout khi gọi AI (mạng chậm hoặc model quá tải)")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateGemini(
  cfg: AiConfig,
  opts: { prompt: string; system?: string; json?: boolean; maxTokens?: number }
): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  // Try primary model, then fallbacks if 404
  const candidates = uniqueModels([
    cfg.model,
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest"
  ]);
  let lastErr: any;
  for (const model of candidates) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          ...(opts.system ? { systemInstruction: opts.system } : {}),
          ...(opts.json ? { responseMimeType: "application/json" } : { responseMimeType: "text/plain" }),
          ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {})
        }
      } as any);
      const text = String((res as any)?.text || (res as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "").trim();
      if (!text) throw new Error("Model trả về rỗng.");
      // Persist working model if different
      if (model !== cfg.model) setAppSetting("aiModel", model);
      return text;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err || "");
      if (/no longer available|NOT_FOUND|not found|404|is not found/i.test(msg)) continue;
      if (isOverloaded(err)) {
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("Không gọi được Gemini.");
}

async function generateOpenAiCompat(
  cfg: AiConfig,
  opts: { prompt: string; system?: string; json?: boolean; maxTokens?: number }
): Promise<string> {
  const meta = AI_PROVIDERS.find(p => p.id === cfg.provider);
  const base = (cfg.baseUrl || meta?.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const body: any = {
    model: cfg.model,
    messages,
    temperature: 0.4
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.APP_URL || "https://github.com/your-github-user/FamOrg";
    headers["X-Title"] = "FamOrg";
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000)
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || JSON.stringify(data).slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new Error("Model trả về rỗng.");
  return String(text).trim();
}

function uniqueModels(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of list) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/** Validate key with a tiny prompt. */
export async function testAiConfig(partial?: {
  provider?: AiProviderId;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): Promise<{ ok: true; model: string; provider: string } | never> {
  const current = getAiConfig();
  const cfg: AiConfig = {
    provider: (partial?.provider || current.provider) as AiProviderId,
    apiKey: (partial?.apiKey || current.apiKey).trim(),
    model: (partial?.model || current.model).trim(),
    baseUrl: partial?.baseUrl !== undefined ? partial.baseUrl : current.baseUrl,
    source: "app"
  };
  if (!cfg.apiKey) throw new Error("Chưa nhập API key.");
  // Temporarily use this config without saving by monkey-patching generate with explicit cfg
  const text = await (async () => {
    if (cfg.provider === "gemini") {
      return generateGemini(cfg, { prompt: "Reply with exactly: ok", maxTokens: 16 });
    }
    return generateOpenAiCompat(cfg, { prompt: "Reply with exactly: ok", maxTokens: 16 });
  })();
  if (!text) throw new Error("Không nhận được phản hồi từ AI.");
  return { ok: true, model: cfg.model, provider: cfg.provider };
}

/** Used by weekly digest and other modules that still pass a raw key. */
export function resolveGeminiKeyFallback(): string {
  return getAiConfig().apiKey;
}
