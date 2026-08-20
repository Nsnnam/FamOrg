import { describe, expect, it } from "vitest";
import { parseGoldPriceRows } from "./goldPriceOcr.js";

describe("parseGoldPriceRows", () => {
  it("nhận diện dòng vàng có giá mua và bán", () => {
    const rows = parseGoldPriceRows(
      "Vàng nhẫn 9999 13.200.000 13.450.000/chỉ\nVàng miếng SJC 132.000.000 134.000.000/lượng",
      "import_test"
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "import_test_row_1",
      importId: "import_test",
      label: "Vàng nhẫn 9999",
      buyPrice: 13200000,
      sellPrice: 13450000,
      unit: "chỉ"
    });
    expect(rows[1]).toMatchObject({
      label: "Vàng miếng SJC",
      buyPrice: 132000000,
      sellPrice: 134000000,
      unit: "lượng"
    });
  });

  it("giữ dòng chỉ có một giá để người dùng xem lại", () => {
    const rows = parseGoldPriceRows("Vàng trang sức 18K 8.500.000/gram", "import_single");
    expect(rows).toHaveLength(1);
    expect(rows[0].sellPrice).toBe(8500000);
    expect(rows[0].buyPrice).toBeUndefined();
    expect(rows[0].unit).toBe("gram");
  });

  it("bỏ qua dòng không chứa giá tiền hợp lệ", () => {
    const rows = parseGoldPriceRows("Bảng giá vàng hôm nay\nLiên hệ cửa hàng", "import_empty");
    expect(rows).toEqual([]);
  });
});

