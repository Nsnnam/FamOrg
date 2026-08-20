# Tích hợp nguồn giá tự động với Needle worker

## Kết quả khảo sát worker hiện tại

Needle worker đang chạy ở chế độ **enrichment metadata sách**, không phải price provider. Các endpoint hiện có là:

| Phương thức | Endpoint | Request JSON | Response chính |
|---|---|---|---|
| `GET` | `/health` | Không có | `{ ok, service, mode, cache_entries, active_jobs, needle_loaded }` |
| `POST` | `/enrich` | `{ title: string, author?: string, refine?: boolean }` | Metadata sách; thiếu `title` trả `400` |
| `POST` | `/enqueue` | Cùng payload `/enrich` | `202`: `{ ok, job_id, status: "queued", write_back: false }` |
| `POST` | `/batch/enqueue` | `{ books: Array<{ title, author?, file_path?, refine? }> }` | `202`: `{ ok, queued, skipped, job_ids, write_back: false }` |
| `GET` | `/jobs/{job_id}` | Không có | `{ ok, job_id, status, created, updated, result?, error? }` |
| `GET` | `/cache/stats` | Không có | `{ ok, entries, oldest, newest, ttl_seconds }` |

`needle_loaded` hiện báo `false`. Vì vậy FamOrg **không được gọi `/enrich` để giả lập cập nhật giá** và không được lưu metadata sách vào `assetPriceLogs`.

## Mô hình dữ liệu FamOrg

Nhật ký giá đã có trường `sourceType` với ba giá trị:

```ts
export type AssetPriceSource = "manual" | "image" | "needle";
```

Các trường nguồn liên quan:

```ts
interface AssetPriceLog {
  id: string;
  assetId: string;
  price: number;
  currency: "VND" | "USD";
  unitPrice?: number;
  quantity?: number;
  unit?: string;
  note?: string;
  recordedAt: string;
  recordedBy: string;
  purchaseValueAtRecord?: number;
  profitLoss?: number;
  profitLossPct?: number;
  sourceType?: "manual" | "image" | "needle";
  sourceName?: string;
  sourceImageUrl?: string;
  importId?: string;
  observedAt?: string;
}
```

`sourceType: "image"` được dùng cho bảng giá cửa hàng nhập từ ảnh. `sourceType: "manual"` dành cho giá bạn nhập trực tiếp. `sourceType: "needle"` được dành sẵn cho provider tự động trong tương lai; bản ghi chỉ được tạo sau khi provider trả đúng schema giá.

## Adapter mẫu cho provider giá trong tương lai

Không nên dùng trực tiếp các endpoint metadata hiện tại. Khi Needle được bổ sung endpoint giá, chẳng hạn `POST /price/quote`, backend FamOrg có thể dùng adapter sau:

```ts
import type { AssetPriceLog, FamilyAsset } from "../src/types.js";

type NeedlePriceQuote = {
  ok: true;
  provider: string;
  symbol: string;
  price: number;
  currency: "VND" | "USD";
  unit?: string;
  observedAt: string;
  sourceUrl?: string;
} | { ok: false; error: string };

const needleBaseUrl = process.env.NEEDLE_BASE_URL || "http://127.0.0.1:5050";

export async function fetchNeedlePrice(asset: FamilyAsset): Promise<NeedlePriceQuote> {
  if (!asset.symbol) throw new Error("Tài sản chưa có symbol để lấy giá tự động.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${needleBaseUrl}/price/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.NEEDLE_TOKEN ? { authorization: `Bearer ${process.env.NEEDLE_TOKEN}` } : {})
      },
      body: JSON.stringify({
        symbol: asset.symbol,
        asset_type: asset.type,
        currency: asset.currency
      }),
      signal: controller.signal
    });
    const body = await response.json() as NeedlePriceQuote;
    if (!response.ok || body.ok !== true || !Number.isFinite(body.price) || body.price <= 0) {
      throw new Error(body.ok === false ? body.error : "Needle trả schema giá không hợp lệ.");
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveNeedleQuote(
  asset: FamilyAsset,
  userId: string,
  username: string,
  saveAssetPriceLog: (data: Partial<AssetPriceLog>, assetId: string, userId: string, username: string) => AssetPriceLog
): Promise<AssetPriceLog> {
  const quote = await fetchNeedlePrice(asset);
  return saveAssetPriceLog({
    price: quote.price * Math.max(1, asset.quantity),
    unitPrice: quote.price,
    quantity: asset.quantity,
    unit: quote.unit || asset.unit,
    currency: quote.currency,
    sourceType: "needle",
    sourceName: quote.provider,
    note: `Tự động cập nhật từ Needle: ${asset.symbol}`,
    observedAt: quote.observedAt
  }, asset.id, userId, username);
}
```

Adapter này có **timeout**, kiểm tra schema, token tùy chọn và không dùng `/enrich` hiện tại. Khi worker có endpoint thực tế, chỉ cần điều chỉnh URL, request và kiểu `NeedlePriceQuote`; không cần thay đổi mô hình lịch sử giá.

## An toàn vận hành

FamOrg nên gọi Needle qua loopback hoặc mạng LAN được giới hạn bằng firewall, không mở cổng worker trực tiếp ra Internet. Job tự động nên có timeout, giới hạn tần suất, ghi nhận `observedAt`, `sourceName` và thất bại theo kiểu non-destructive: nếu Needle lỗi thì giữ nguyên giá trị tài sản và chỉ ghi log lỗi, không ghi giá bằng không hoặc dữ liệu cũ không rõ nguồn.

Giá từ Needle, giá OCR và giá thủ công chỉ là dữ liệu theo dõi. Chúng không phải khuyến nghị mua bán hoặc dự báo đầu tư.
