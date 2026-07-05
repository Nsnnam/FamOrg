/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Danh sách tỉnh/thành Việt Nam kèm toạ độ trung tâm (thường là tỉnh lỵ) để
// dùng cho widget thời tiết + cảnh báo động đất ở Tổng quan. Toạ độ ở mức thành
// phố là đủ chính xác cho dự báo thời tiết và bán kính động đất.
export interface VnLocation {
  code: string;   // slug không dấu, ổn định (lưu trong localStorage)
  name: string;   // tên hiển thị tiếng Việt
  lat: number;
  lon: number;
}

// 5 thành phố trực thuộc trung ương đứng đầu cho dễ chọn, sau đó là các tỉnh
// xếp theo bảng chữ cái.
export const VN_LOCATIONS: VnLocation[] = [
  { code: "hcm", name: "TP. Hồ Chí Minh", lat: 10.7769, lon: 106.7009 },
  { code: "hanoi", name: "Hà Nội", lat: 21.0278, lon: 105.8542 },
  { code: "danang", name: "Đà Nẵng", lat: 16.0471, lon: 108.2062 },
  { code: "haiphong", name: "Hải Phòng", lat: 20.8449, lon: 106.6881 },
  { code: "cantho", name: "Cần Thơ", lat: 10.0452, lon: 105.7469 },

  { code: "angiang", name: "An Giang", lat: 10.3860, lon: 105.4360 },
  { code: "bariavungtau", name: "Bà Rịa - Vũng Tàu", lat: 10.3460, lon: 107.0843 },
  { code: "bacgiang", name: "Bắc Giang", lat: 21.2810, lon: 106.1970 },
  { code: "backan", name: "Bắc Kạn", lat: 22.1470, lon: 105.8340 },
  { code: "baclieu", name: "Bạc Liêu", lat: 9.2940, lon: 105.7240 },
  { code: "bacninh", name: "Bắc Ninh", lat: 21.1860, lon: 106.0760 },
  { code: "bentre", name: "Bến Tre", lat: 10.2430, lon: 106.3750 },
  { code: "binhdinh", name: "Bình Định (Quy Nhơn)", lat: 13.7820, lon: 109.2190 },
  { code: "binhduong", name: "Bình Dương", lat: 10.9800, lon: 106.6520 },
  { code: "binhphuoc", name: "Bình Phước", lat: 11.5350, lon: 106.8940 },
  { code: "binhthuan", name: "Bình Thuận (Phan Thiết)", lat: 10.9280, lon: 108.1020 },
  { code: "camau", name: "Cà Mau", lat: 9.1770, lon: 105.1500 },
  { code: "caobang", name: "Cao Bằng", lat: 22.6660, lon: 106.2570 },
  { code: "daklak", name: "Đắk Lắk (Buôn Ma Thuột)", lat: 12.6880, lon: 108.0500 },
  { code: "daknong", name: "Đắk Nông (Gia Nghĩa)", lat: 12.0040, lon: 107.6900 },
  { code: "dienbien", name: "Điện Biên (Điện Biên Phủ)", lat: 21.3860, lon: 103.0170 },
  { code: "dongnai", name: "Đồng Nai (Biên Hòa)", lat: 10.9450, lon: 106.8240 },
  { code: "dongthap", name: "Đồng Tháp (Cao Lãnh)", lat: 10.4590, lon: 105.6330 },
  { code: "gialai", name: "Gia Lai (Pleiku)", lat: 13.9830, lon: 108.0000 },
  { code: "hagiang", name: "Hà Giang", lat: 22.8230, lon: 104.9840 },
  { code: "hanam", name: "Hà Nam (Phủ Lý)", lat: 20.5410, lon: 105.9130 },
  { code: "hatinh", name: "Hà Tĩnh", lat: 18.3430, lon: 105.9060 },
  { code: "haiduong", name: "Hải Dương", lat: 20.9400, lon: 106.3330 },
  { code: "haugiang", name: "Hậu Giang (Vị Thanh)", lat: 9.7840, lon: 105.4700 },
  { code: "hoabinh", name: "Hòa Bình", lat: 20.8130, lon: 105.3380 },
  { code: "hungyen", name: "Hưng Yên", lat: 20.6460, lon: 106.0510 },
  { code: "khanhhoa", name: "Khánh Hòa (Nha Trang)", lat: 12.2390, lon: 109.1960 },
  { code: "kiengiang", name: "Kiên Giang (Rạch Giá)", lat: 10.0120, lon: 105.0810 },
  { code: "kontum", name: "Kon Tum", lat: 14.3500, lon: 108.0000 },
  { code: "laichau", name: "Lai Châu", lat: 22.3860, lon: 103.4700 },
  { code: "lamdong", name: "Lâm Đồng (Đà Lạt)", lat: 11.9400, lon: 108.4580 },
  { code: "langson", name: "Lạng Sơn", lat: 21.8530, lon: 106.7610 },
  { code: "laocai", name: "Lào Cai", lat: 22.4850, lon: 103.9710 },
  { code: "longan", name: "Long An (Tân An)", lat: 10.5350, lon: 106.4130 },
  { code: "namdinh", name: "Nam Định", lat: 20.4200, lon: 106.1680 },
  { code: "nghean", name: "Nghệ An (Vinh)", lat: 18.6790, lon: 105.6810 },
  { code: "ninhbinh", name: "Ninh Bình", lat: 20.2510, lon: 105.9740 },
  { code: "ninhthuan", name: "Ninh Thuận (Phan Rang)", lat: 11.5640, lon: 108.9880 },
  { code: "phutho", name: "Phú Thọ (Việt Trì)", lat: 21.3020, lon: 105.4020 },
  { code: "phuyen", name: "Phú Yên (Tuy Hòa)", lat: 13.0960, lon: 109.3010 },
  { code: "quangbinh", name: "Quảng Bình (Đồng Hới)", lat: 17.4680, lon: 106.6220 },
  { code: "quangnam", name: "Quảng Nam (Tam Kỳ)", lat: 15.5730, lon: 108.4740 },
  { code: "quangngai", name: "Quảng Ngãi", lat: 15.1200, lon: 108.7990 },
  { code: "quangninh", name: "Quảng Ninh (Hạ Long)", lat: 20.9590, lon: 107.0430 },
  { code: "quangtri", name: "Quảng Trị (Đông Hà)", lat: 16.8120, lon: 107.1000 },
  { code: "soctrang", name: "Sóc Trăng", lat: 9.6030, lon: 105.9740 },
  { code: "sonla", name: "Sơn La", lat: 21.3270, lon: 103.9140 },
  { code: "tayninh", name: "Tây Ninh", lat: 11.3100, lon: 106.0980 },
  { code: "thaibinh", name: "Thái Bình", lat: 20.4500, lon: 106.3400 },
  { code: "thainguyen", name: "Thái Nguyên", lat: 21.5940, lon: 105.8480 },
  { code: "thanhhoa", name: "Thanh Hóa", lat: 19.8070, lon: 105.7760 },
  { code: "hue", name: "Thừa Thiên Huế", lat: 16.4630, lon: 107.5850 },
  { code: "tiengiang", name: "Tiền Giang (Mỹ Tho)", lat: 10.3600, lon: 106.3650 },
  { code: "travinh", name: "Trà Vinh", lat: 9.9340, lon: 106.3450 },
  { code: "tuyenquang", name: "Tuyên Quang", lat: 21.8230, lon: 105.2140 },
  { code: "vinhlong", name: "Vĩnh Long", lat: 10.2530, lon: 105.9720 },
  { code: "vinhphuc", name: "Vĩnh Phúc (Vĩnh Yên)", lat: 21.3090, lon: 105.6040 },
  { code: "yenbai", name: "Yên Bái", lat: 21.7050, lon: 104.8700 },
];

export const DEFAULT_VN_LOCATION = VN_LOCATIONS[0]; // TP. Hồ Chí Minh

export const findVnLocation = (code: string | null | undefined): VnLocation =>
  VN_LOCATIONS.find(l => l.code === code) || DEFAULT_VN_LOCATION;
