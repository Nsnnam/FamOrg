export interface OptimizedImage {
  dataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
}

interface OptimizeImageOptions {
  maxSourceBytes?: number;
  targetBytes?: number;
  maxSizes?: number[];
  qualities?: number[];
  preferTypes?: string[];
  backgroundColor?: string;
}

const DEFAULT_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const DEFAULT_TARGET_BYTES = 850 * 1024;
const DEFAULT_SIZES = [1024, 768, 512];
const DEFAULT_QUALITIES = [0.86, 0.76, 0.66, 0.56];

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không đọc được dữ liệu ảnh sau khi tối ưu."));
    };
    reader.onerror = () => reject(new Error("Không đọc được dữ liệu ảnh sau khi tối ưu."));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromFile(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được tệp ảnh này. Ảnh iPhone (HEIC) thường không mở được trên máy tính — hãy chọn ảnh JPG/PNG hoặc đổi Máy ảnh sang "Tương thích nhất".'));
    };
    image.src = url;
  });
}

/** True for Apple HEIC/HEIF photos, detected by MIME type or file extension (some browsers leave the type empty). */
function looksLikeHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Browsers (especially on desktop) can't decode HEIC/HEIF via <img>/canvas. Convert those
 * to JPEG with heic2any first; everything else is returned untouched. The library is loaded
 * lazily so it stays out of the main bundle until someone actually uploads an iPhone photo.
 */
async function ensureBrowserReadable(file: File): Promise<Blob> {
  if (!looksLikeHeic(file)) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch {
    throw new Error('Không chuyển đổi được ảnh iPhone (HEIC). Hãy đổi Máy ảnh sang "Tương thích nhất" rồi chụp lại, hoặc chọn ảnh JPG/PNG.');
  }
}

export async function optimizeImageFile(file: File, options: OptimizeImageOptions = {}): Promise<OptimizedImage> {
  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const maxSizes = options.maxSizes ?? DEFAULT_SIZES;
  const qualities = options.qualities ?? DEFAULT_QUALITIES;
  const preferTypes = options.preferTypes ?? ["image/webp", "image/jpeg"];

  if (!file.type.startsWith("image/") && !looksLikeHeic(file)) {
    throw new Error("Vui lòng chọn đúng tệp hình ảnh.");
  }
  if (file.size > maxSourceBytes) {
    throw new Error(`Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới ${Math.round(maxSourceBytes / 1024 / 1024)}MB.`);
  }

  const readable = await ensureBrowserReadable(file);
  const image = await loadImageFromFile(readable);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("Không xác định được kích thước ảnh.");
  }

  let best: Blob | null = null;
  let bestWidth = 0;
  let bestHeight = 0;

  for (const maxSize of maxSizes) {
    const ratio = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (const type of preferTypes) {
      ctx.clearRect(0, 0, width, height);
      if (type === "image/jpeg") {
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, type, quality);
        if (!blob) continue;
        if (blob.type && blob.type !== type) continue;

        if (!best || blob.size < best.size) {
          best = blob;
          bestWidth = width;
          bestHeight = height;
        }
        if (blob.size <= targetBytes) {
          return {
            dataUrl: await blobToDataUrl(blob),
            width,
            height,
            sizeKb: Math.max(1, Math.round(blob.size / 1024))
          };
        }
      }
    }
  }

  if (!best) throw new Error("Không tối ưu được ảnh này.");
  return {
    dataUrl: await blobToDataUrl(best),
    width: bestWidth,
    height: bestHeight,
    sizeKb: Math.max(1, Math.round(best.size / 1024))
  };
}
