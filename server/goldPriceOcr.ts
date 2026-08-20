/**
 * OCR bảng giá vàng: nhận diện best-effort, luôn yêu cầu người dùng xem lại trước khi lưu.
 * ponytail: chỉ trích các token số có dạng giá tiền; parser đầy đủ theo từng nhà cung cấp
 * được bổ sung khi có mẫu ảnh thực tế đa dạng hơn.
 */
import { createWorker, type Worker } from "tesseract.js";
import { GoldPriceImportRow } from "../src/types.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").then(async worker => {
      await worker.setParameters({
        tessedit_pageseg_mode: "6" as any,
        preserve_interword_spaces: "1"
      });
      return worker;
    }).catch(err => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function parseMoneyToken(token: string): number | undefined {
  const digits = token.replace(/[Oo]/g, "0").replace(/[^0-9]/g, "");
  if (digits.length < 5) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) && value >= 100_000 ? value : undefined;
}

function inferPurity(line: string): string | undefined {
  const match = line.match(/(?:9999|99[.,]?99|24k?|18k?|14k?|10k?)/i);
  return match?.[0]?.replace(",", ".").toUpperCase();
}

function inferUnit(line: string): GoldPriceImportRow["unit"] {
  if (/gram|grams|\bg\b/i.test(line)) return "gram";
  if (/chỉ|chi|\bchi\b/i.test(line)) return "chỉ";
  return "lượng";
}

export function parseGoldPriceRows(ocrText: string, importId: string): GoldPriceImportRow[] {
  const rows: GoldPriceImportRow[] = [];
  const lines = ocrText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const normalizedLine = line.replace(/\b(?:9999|99[.,]?99|24k?|18k?|14k?|10k?)\b/gi, " ");
    const tokens = normalizedLine.match(/[0-9Oo]{1,3}(?:[.,][0-9Oo]{3})+|[0-9Oo]{6,}/g) || [];
    const prices = tokens.map(parseMoneyToken).filter((value): value is number => value !== undefined);
    if (!prices.length) return;

    const firstToken = tokens[0];
    const tokenIndex = firstToken ? normalizedLine.indexOf(firstToken) : -1;
    const rawLabel = tokenIndex >= 0 ? normalizedLine.slice(0, tokenIndex) : normalizedLine.replace(tokens.join(" "), "");
    const cleanLabel = rawLabel.replace(/[|:_-]+/g, " ").replace(/\s+/g, " ").trim();
    const purity = inferPurity(line);
    const label = [cleanLabel, purity].filter(Boolean).join(" ") || `Dòng ${index + 1}`;
    const rowId = `${importId}_row_${rows.length + 1}`;
    rows.push({
      id: rowId,
      importId,
      label,
      purity,
      buyPrice: prices.length > 1 ? prices[0] : undefined,
      sellPrice: prices.length > 1 ? prices[1] : prices[0],
      unit: inferUnit(line),
      confidence: Math.min(0.98, 0.55 + (prices.length > 1 ? 0.25 : 0) + (label !== `Dòng ${index + 1}` ? 0.12 : 0.0)),
      rawText: line
    });
  });

  return rows.slice(0, 100);
}

export async function recognizeGoldPriceImage(dataUrl: string): Promise<{ text: string; rows: GoldPriceImportRow[] }> {
  const worker = await getWorker();
  const result = await worker.recognize(dataUrl);
  const text = result.data.text || "";
  const importId = `gold_import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return { text, rows: parseGoldPriceRows(text, importId) };
}
