/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// File-based media storage. Images/docs are written to data/uploads/<category>/
// and referenced from the DB by a short "/uploads/..." URL.

import fs from "fs";
import path from "path";
import crypto from "crypto";

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
export const UPLOADS_URL_PREFIX = "/uploads/";

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_CATEGORIES = new Set(["avatars", "assets", "receipts", "documents", "debts", "notes", "branding", "backgrounds"]);

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_DOC_BYTES = 25 * 1024 * 1024; // zip/office/archives

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  // Office
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  // Archives
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/x-rar-compressed": "rar",
  "application/vnd.rar": "rar",
  "application/x-7z-compressed": "7z",
  "application/gzip": "gz",
  "application/x-tar": "tar",
  // Text
  "text/plain": "txt",
  "text/csv": "csv",
  "application/rtf": "rtf",
  "application/octet-stream": "bin"
};

// data:mime;base64,... — also allow office/archives
const DATA_URL_RE = /^data:([a-z0-9.+\/-]+);base64,(.+)$/i;

function sanitizeSegment(value: unknown): string {
  return String(value || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
}

export interface SavedMedia {
  url: string;
  sizeKb: number;
  fileName?: string;
}

export function isManagedUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(UPLOADS_URL_PREFIX);
}

function maxBytesForExt(ext: string): number {
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return MAX_IMAGE_BYTES;
  if (ext === "pdf") return MAX_PDF_BYTES;
  return MAX_DOC_BYTES;
}

function extFromMimeAndName(mime: string, originalName?: string): string {
  const fromMime = MIME_EXT[mime.toLowerCase()];
  if (fromMime && fromMime !== "bin") return fromMime;
  if (originalName) {
    const m = originalName.match(/\.([a-z0-9]{1,8})$/i);
    if (m) {
      const e = m[1].toLowerCase();
      const allowed = new Set([
        "png", "jpg", "jpeg", "webp", "gif", "svg", "pdf",
        "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods",
        "zip", "rar", "7z", "gz", "tar", "txt", "csv", "rtf"
      ]);
      if (allowed.has(e)) return e === "jpeg" ? "jpg" : e;
    }
  }
  if (fromMime) return fromMime;
  throw new Error("Định dạng tệp không được hỗ trợ.");
}

/**
 * Decode a base64 data URL and persist under data/uploads/<category>/...
 */
export function saveDataUrlToFile(
  dataUrl: unknown,
  category: string,
  subfolder?: string,
  originalName?: string
): SavedMedia {
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error("Loại thư mục lưu tệp không hợp lệ.");
  }
  if (typeof dataUrl !== "string") {
    throw new Error("Dữ liệu tệp không hợp lệ.");
  }
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("Tệp phải là data URL base64 hợp lệ (ảnh, PDF, Office, zip/rar/7z...).");
  }
  const mime = match[1].toLowerCase();
  const ext = extFromMimeAndName(mime, originalName);

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) throw new Error("Tệp rỗng hoặc hỏng.");
  const maxBytes = maxBytesForExt(ext);
  if (buffer.length > maxBytes) {
    throw new Error(`Tệp quá lớn (tối đa ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }

  const sub = sanitizeSegment(subfolder);
  const dir = sub ? path.join(UPLOADS_DIR, category, sub) : path.join(UPLOADS_DIR, category);
  fs.mkdirSync(dir, { recursive: true });

  const safeBase = originalName
    ? originalName.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60).replace(/\.[^.]+$/, "")
    : "file";
  const fileName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}_${safeBase || "file"}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);

  const url = sub
    ? `${UPLOADS_URL_PREFIX}${category}/${sub}/${fileName}`
    : `${UPLOADS_URL_PREFIX}${category}/${fileName}`;
  return {
    url,
    sizeKb: Math.max(1, Math.round(buffer.length / 1024)),
    fileName: originalName || fileName
  };
}

export function deleteMediaByUrl(url: unknown): void {
  if (!isManagedUrl(url)) return;
  try {
    const rel = decodeURIComponent(url.slice(UPLOADS_URL_PREFIX.length));
    if (rel.includes("..")) return;
    const abs = path.join(UPLOADS_DIR, rel);
    if (abs.startsWith(UPLOADS_DIR) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}
