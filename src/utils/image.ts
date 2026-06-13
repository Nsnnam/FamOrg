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
      else reject(new Error("Khong doc duoc du lieu anh da toi uu."));
    };
    reader.onerror = () => reject(new Error("Khong doc duoc du lieu anh da toi uu."));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Khong doc duoc tep anh nay."));
    };
    image.src = url;
  });
}

export async function optimizeImageFile(file: File, options: OptimizeImageOptions = {}): Promise<OptimizedImage> {
  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const maxSizes = options.maxSizes ?? DEFAULT_SIZES;
  const qualities = options.qualities ?? DEFAULT_QUALITIES;
  const preferTypes = options.preferTypes ?? ["image/webp", "image/jpeg"];

  if (!file.type.startsWith("image/")) {
    throw new Error("Vui long chon dung tep hinh anh.");
  }
  if (file.size > maxSourceBytes) {
    throw new Error(`Anh goc qua lon. Vui long chon anh duoi ${Math.round(maxSourceBytes / 1024 / 1024)}MB.`);
  }

  const image = await loadImageFromFile(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("Khong xac dinh duoc kich thuoc anh.");
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
    if (!ctx) throw new Error("Trinh duyet khong ho tro xu ly anh.");

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

  if (!best) throw new Error("Khong the toi uu anh nay.");
  return {
    dataUrl: await blobToDataUrl(best),
    width: bestWidth,
    height: bestHeight,
    sizeKb: Math.max(1, Math.round(best.size / 1024))
  };
}
