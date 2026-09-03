/**
 * Multi-provider free/cheap AI helpers.
 * Supports: Google Gemini, Groq, OpenRouter, OpenAI-compatible endpoints.
 */

import { getAppSettings, setAppSetting } from "./db.js";

export type AiProviderId = "gemini" | "groq" | "openrouter" | "openai" | "custom";

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
    freeNote: "AI Studio có free tier theo project/model; quota thực tế xem trong AI Studio.",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.5-flash",
    models: [
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (stable)" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (khuyến nghị)" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (nhanh)" },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }
    ]
  },
  {
    id: "groq",
    label: "Groq (developer/free quota)",
    freeNote: "API nhanh; hạn mức phụ thuộc tài khoản và model tại Groq Console.",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "openai/gpt-oss-20b",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      { id: "openai/gpt-oss-20b", label: "OpenAI GPT-OSS 20B" },
      { id: "openai/gpt-oss-120b", label: "OpenAI GPT-OSS 120B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
      { id: "groq/compound-mini", label: "Groq Compound Mini" }
    ]
  },
  {
    id: "openrouter",
    label: "OpenRouter (free models)",
    freeNote: "Router free động; danh sách và hạn mức thay đổi, xem openrouter.ai/models.",
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "openrouter/free",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "openrouter/free", label: "OpenRouter Free Router (khuyến nghị)" },
      { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "NVIDIA Nemotron 3 Super free" },
      { id: "google/gemma-4-26b-a4b-it:free", label: "Google Gemma 4 26B free" },
      { id: "openai/gpt-oss-20b:free", label: "OpenAI GPT-OSS 20B free" },
      { id: "nvidia/nemotron-3-nano-30b-a3b:free", label: "NVIDIA Nemotron 3 Nano free" }
    ]
  },
  {
    id: "openai",
    label: "OpenAI-compatible / OpenAI",

    freeNote: "Ollama/LM Studio tự host hoặc bất kỳ endpoint OpenAI-compatible; model có thể tự nhập.",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini" },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { id: "gpt-4o", label: "gpt-4o" }
    ]
  },
  {
    id: "custom",
    label: "Endpoint tùy chỉnh (Ollama / LM Studio)",
    freeNote: "Tự host trên NAS hoặc máy trong LAN; nhập Base URL và model tùy ý.",
    keyUrl: "https://ollama.com/download",
    defaultModel: "llama3.2",
    baseUrl: "http://host.docker.internal:11434/v1",
    models: [
      { id: "llama3.2", label: "llama3.2 (Ollama)" },
      { id: "qwen2.5", label: "qwen2.5 (Ollama)" },
      { id: "mistral", label: "mistral (Ollama)" }
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
    baseUrl: ["openai", "custom"].includes(cfg.provider) ? cfg.baseUrl || "" : undefined,
    providers: AI_PROVIDERS.map(p => ({
      id: p.id,
      label: p.label,
      freeNote: p.freeNote,
      keyUrl: p.keyUrl,
      defaultModel: p.defaultModel,
      models: p.models,
      needsBaseUrl: ["openai", "custom"].includes(p.id)
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

export interface AiFileAttachment {
  mimeType: string;
  dataBase64: string; // raw base64 string
}

export interface AiGenerateOptions {
  prompt: string;
  system?: string;
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  files?: AiFileAttachment[];
}

/** Unified text generation used by all AI features. */
export async function aiGenerateText(opts: AiGenerateOptions): Promise<string> {
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
  opts: AiGenerateOptions
): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  // Try primary model, then fallbacks if 404
  const candidates = uniqueModels([
    cfg.model,
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
  ]);

  const parts: any[] = [];
  if (opts.files && opts.files.length > 0) {
    for (const f of opts.files) {
      parts.push({
        inlineData: {
          mimeType: f.mimeType,
          data: f.dataBase64
        }
      });
    }
  }
  parts.push({ text: opts.prompt });

  let lastErr: any;
  for (const model of candidates) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: parts.length === 1 && !opts.files?.length ? opts.prompt : parts,
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
  opts: AiGenerateOptions
): Promise<string> {
  const meta = AI_PROVIDERS.find(p => p.id === cfg.provider);
  const base = (cfg.baseUrl || meta?.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const messages: { role: string; content: any }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });

  let userContent: any = opts.prompt;
  if (opts.files && opts.files.length > 0) {
    const parts: any[] = [];
    for (const f of opts.files) {
      if (f.mimeType.startsWith("image/")) {
        parts.push({
          type: "image_url",
          image_url: { url: `data:${f.mimeType};base64,${f.dataBase64}` }
        });
      }
    }
    parts.push({ type: "text", text: opts.prompt });
    userContent = parts;
  }
  messages.push({ role: "user", content: userContent });

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
    headers["HTTP-Referer"] = process.env.APP_URL || "https://github.com/Nsnnam/FamOrg";
    headers["X-Title"] = "Namdumimo Family";
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50_000)
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

export interface ParsedDocumentData {
  type?: string;
  title?: string;
  documentNumber?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  ownerName?: string;
  notes?: string;
}

/** Nhận diện loại giấy tờ, số, nơi cấp, ngày cấp, hạn dùng bằng AI Vision */
export async function aiParseDocument(input: {
  dataUrl?: string;
  fileBase64?: string;
  mimeType?: string;
  textContent?: string;
}): Promise<ParsedDocumentData> {
  let file: AiFileAttachment | undefined;
  if (input.dataUrl) {
    const m = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
    if (m) {
      file = { mimeType: m[1], dataBase64: m[2] };
    }
  } else if (input.fileBase64 && input.mimeType) {
    file = { mimeType: input.mimeType, dataBase64: input.fileBase64 };
  }

  const prompt = [
    "Bạn là chuyên gia phân tích và bóc tách thông tin từ các loại giấy tờ tùy thân, tài liệu pháp lý và hồ sơ gia đình Việt Nam.",
    "Nhiệm vụ của bạn là nhận diện chính xác các thông tin trên tài liệu đính kèm (hoặc văn bản) và trích xuất thành DUY NHẤT một JSON object hợp lệ theo schema sau:",
    "{",
    '  "type": "cccd" | "passport" | "driver_license" | "vehicle_registration" | "vehicle_inspection" | "insurance" | "health_insurance" | "warranty" | "contract" | "certificate" | "other",',
    '  "title": "Tên ngắn gọn, rõ ràng của giấy tờ (vd: \'CCCD Nguyễn Văn A\', \'Bằng lái xe B2 - Trần Văn B\', \'Đăng kiểm xe 51K-123.45\', \'BHYT bé Nguyễn Văn C\')",',
    '  "documentNumber": "Số giấy tờ (Số CCCD 12 số, số CMND 9 số, số GPLX, số hộ chiếu, mã số thẻ BHYT, biển kiểm soát/số đăng ký xe, số hợp đồng bảo hiểm...)",',
    '  "issuer": "Nơi cấp / Đơn vị cấp (vd: \'Cục Cảnh sát QLHC về TTXH\', \'Công an TP. Hà Nội\', \'Sở GTVT TP.HCM\', \'Bảo hiểm Xã hội Việt Nam\', \'Công ty Bảo hiểm Bảo Việt\'...)",',
    '  "issueDate": "Ngày cấp theo định dạng YYYY-MM-DD nếu tìm thấy (vd \'2022-08-15\'), nếu không có hãy để chuỗi rỗng",',
    '  "expiryDate": "Ngày hết hạn / có giá trị đến ngày theo định dạng YYYY-MM-DD nếu có (vd \'2032-08-15\', cực kỳ quan trọng đối với CCCD, GPLX, Đăng kiểm, Bảo hiểm để nhắc hạn). Với CCCD không thời hạn thì để chuỗi rỗng",',
    '  "ownerName": "Họ và tên của chủ sở hữu / người được cấp ghi trên giấy tờ (vd \'Nguyễn Văn A\')",',
    '  "notes": "Các chi tiết hữu ích khác bóc tách được (vd: ngày sinh, địa chỉ thường trú, quê quán, hạng lái xe, biển số, loại xe, nhãn hiệu, số khung, số máy, cơ sở KCB ban đầu...)"',
    "}",
    "Yêu cầu:",
    "- Nhận diện đúng loại giấy tờ thuộc danh sách type ở trên.",
    "- Với CCCD/CMND: trích xuất số CCCD (12 chữ số), họ tên, ngày cấp, ngày hết hạn.",
    "- Với Bằng lái xe (GPLX): trích xuất số GPLX, hạng lái xe, ngày trúng tuyển/ngày cấp, ngày hết hạn.",
    "- Với Đăng ký xe (Cà vẹt) / Đăng kiểm: trích xuất biển kiểm soát, số đăng ký, ngày hết hạn kiểm định.",
    "- Với Bảo hiểm / BHYT: trích xuất mã thẻ, đơn vị cấp, giá trị sử dụng đến ngày.",
    "- Bắt buộc trả về đúng định dạng JSON, không bọc ```json, không thêm bất kỳ văn bản nào ngoài JSON.",
    input.textContent ? `Nội dung văn bản giấy tờ: \n${input.textContent}` : ""
  ].filter(Boolean).join("\n\n");

  const rawJson = await aiGenerateText({
    prompt,
    json: true,
    maxTokens: 2048,
    timeoutMs: 60_000,
    files: file ? [file] : undefined
  });

  try {
    const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      type: parsed.type,
      title: parsed.title,
      documentNumber: parsed.documentNumber,
      issuer: parsed.issuer,
      issueDate: parsed.issueDate,
      expiryDate: parsed.expiryDate,
      ownerName: parsed.ownerName,
      notes: parsed.notes
    };
  } catch (err) {
    console.error("aiParseDocument JSON parse error:", rawJson, err);
    throw new Error("AI không thể bóc tách thông tin giấy tờ thành JSON hợp lệ.");
  }
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
