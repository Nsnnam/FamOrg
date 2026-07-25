/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { optimizeImageFile, OptimizedImage } from "./image.js";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("family_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload an already-optimized base64 data URL; returns the stored "/uploads/..." URL. */
export async function uploadDataUrl(
  dataUrl: string,
  category: string,
  subfolder?: string,
  fileName?: string
): Promise<string> {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ dataUrl, category, subfolder, fileName })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Tải tệp lên thất bại.");
  }
  const data = await res.json();
  return data.url as string;
}

/** Upload arbitrary File (Office/zip/pdf/image) as data URL — max ~25MB client-side. */
export async function uploadBinaryFile(file: File, category: string, subfolder?: string): Promise<{ url: string; sizeKb: number; fileName: string }> {
  if (file.size > 25 * 1024 * 1024) throw new Error(`Tệp "${file.name}" quá lớn (tối đa 25MB).`);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Không đọc được tệp."));
    r.readAsDataURL(file);
  });
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ dataUrl, category, subfolder, fileName: file.name })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Tải tệp lên thất bại.");
  }
  const data = await res.json();
  return { url: data.url, sizeKb: data.sizeKb || Math.max(1, Math.round(file.size / 1024)), fileName: file.name };
}

export interface UploadedImage extends OptimizedImage {
  url: string;
}

/** Optimize a file in the browser, then upload it as a stored file. */
export async function optimizeAndUpload(
  file: File,
  category: string,
  options?: Parameters<typeof optimizeImageFile>[1],
  subfolder?: string
): Promise<UploadedImage> {
  const optimized = await optimizeImageFile(file, options);
  const url = await uploadDataUrl(optimized.dataUrl, category, subfolder);
  return { ...optimized, url };
}
