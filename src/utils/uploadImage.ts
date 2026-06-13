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
export async function uploadDataUrl(dataUrl: string, category: string, subfolder?: string): Promise<string> {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ dataUrl, category, subfolder })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Tải ảnh lên thất bại.");
  }
  const data = await res.json();
  return data.url as string;
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
