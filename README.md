# 🏡 Family Organizer

Hệ thống quản lý gia đình thời gian thực — lịch trình, nhiệm vụ, tài chính, ghi chú, thuốc men, mua sắm và trợ lý AI — được thiết kế để chạy ổn định 24/7 trên **Raspberry Pi 5** hoặc bất kỳ máy chủ Linux nào.

> Bài giới thiệu đầy đủ, ảnh bìa sản phẩm, hướng dẫn sử dụng và cấu hình phần cứng nằm tại [`docs/gioi-thieu-va-huong-dan.md`](docs/gioi-thieu-va-huong-dan.md).

---

## ✨ Tính Năng

### 📊 Bảng Điều Khiển (Dashboard)

- Tóm tắt ngày: nhiệm vụ chờ, số dư quỹ gia đình, ghi chú ghim, sự kiện sắp tới (trong vòng 20 ngày).
- Hiển thị lịch sinh nhật thành viên, nhắc nhở uống thuốc và danh sách mua sắm.

### 📋 Nhiệm Vụ (Tasks)

- Tạo và phân công nhiệm vụ cho từng thành viên với mức ưu tiên (Khẩn cấp / Bình thường / Thấp).
- Hiển thị người tạo, cho phép chỉnh sửa và phân công lại.
- Bình luận thảo luận trực tiếp trong từng nhiệm vụ.

### 📅 Lịch Trình (Schedules)

- Tạo sự kiện đơn ngày và nhiều ngày; hiển thị đúng khoảng thời gian trên lịch dạng lưới.
- Nhấn vào sự kiện để xem chi tiết.
- **Xuất lịch sang điện thoại**: nút "Thêm vào lịch" tạo file `.ics` tương thích iOS/Android.

### 📝 Ghi Chú (Notes)

- Soạn thảo Markdown (đầu mục, danh sách, việc cần làm, code inline).
- Ghim ghi chú quan trọng lên đầu; phân quyền Công khai / Cá nhân.

### 💰 Tài Chính (Finance)

- Theo dõi thu nhập và chi tiêu theo danh mục.
- Đính kèm ảnh hóa đơn lưu trực tiếp vào đĩa (không dùng base64).
- Biểu đồ tròn phân bổ dòng tiền tự động.

### 🏠 Tài Sản Gia Đình (Assets)

- Quản lý đa dạng: **Crypto, Vàng** (miếng/nhẫn/trang sức), **Sổ đất/BĐS, Xe cộ, Cổ phiếu** và tài sản khác.
- **Giá thị trường trực tiếp**: widget BTC, ETH, Vàng SJC, tỷ giá USD/VND cập nhật tự động.
- **Định giá tự động**: crypto theo giá coin live; vàng theo trọng lượng × giá 9999 × **hệ số tuổi vàng** (9999/24K → 10K), kèm bảng quy ước tham khảo.
- **Lời/lỗ**: nhập giá mua ban đầu để tự tính % và số tiền lời/lỗ so với giá trị hiện tại.
- Đính kèm ảnh tài sản, phân theo chủ sở hữu, tổng hợp giá trị theo từng loại (tách riêng VND/USD).

### 🛒 Mua Sắm & Trợ Lý AI

- Danh sách mua sắm chung cho cả gia đình.
- Trợ lý giọng nói hỗ trợ thêm/xóa món đồ bằng lệnh tự nhiên.

### 💊 Nhắc Nhở Thuốc Men

- Đặt lịch uống thuốc với bộ chọn giờ 24h; nhắc nhở hiển thị trên dashboard.

### 🔒 Phân Quyền (RBAC)

| Vai trò | Quyền hạn |
| :--- | :--- |
| **Admin (Gia Trưởng)** | Toàn quyền: quản lý thành viên, chỉnh sửa vai trò, backup/restore, xem log hệ thống, cập nhật ứng dụng |
| **Member (Thành viên)** | Tạo/sửa/xóa dữ liệu của mình; truy cập tài chính; không quản lý được tài khoản khác |
| **Guest (Khách/Trẻ em)** | Chỉ đọc lịch trình, ghi chú công khai; cập nhật tiến trình nhiệm vụ của bản thân; không truy cập tài chính |

### 🌀 Đồng Bộ Thời Gian Thực

- Server-Sent Events (SSE) — không cần tải lại trang khi có thay đổi từ thành viên khác.

### 🛡️ Sao Lưu & Phục Hồi

- Tự động backup mỗi 24 giờ vào thư mục `./data/backups/`.
- Admin tạo backup thủ công và khôi phục từ bất kỳ điểm nào trong Settings.

### 📱 PWA (Progressive Web App)

- Cài đặt như app native trên iOS và Android.
- Hỗ trợ đọc offline.

---

## 🚀 Triển Khai Trên Raspberry Pi (Production)

Đây là môi trường **chính thức**. Ứng dụng chạy từ image được CI build và publish lên GitHub Container Registry (GHCR) mỗi khi có commit mới vào `main`.

### Yêu cầu

- Raspberry Pi 5 (hoặc bất kỳ máy Linux nào)
- Docker Engine **19.03+** (khuyến nghị **29+**) và Docker Compose v2
- Git

### Cài đặt lần đầu

**Bước 1 — Cài Docker (nếu chưa có):**

```bash
curl -fsSL https://get.docker.com | sudo sh
```

**Bước 2 — Clone repo và tạo file `.env`:**

```bash
git clone https://github.com/happysmartlight/Family-Organizer.git
cd Family-Organizer
cp .env.example .env
nano .env
```

Điền vào `.env`:

```env
# Khóa API Gemini — bắt buộc nếu dùng tính năng AI assistant
GEMINI_API_KEY=your_gemini_api_key_here

# Địa chỉ truy cập ứng dụng từ bên ngoài (dùng cho liên kết tự tham chiếu)
APP_URL=https://your-domain-or-tailscale-url

# Token xác thực cho Watchtower HTTP API — tự đặt chuỗi ngẫu nhiên bất kỳ
# Dùng lệnh: openssl rand -hex 24
WATCHTOWER_HTTP_API_TOKEN=your_secret_token_here
```

**Bước 3 — Khởi chạy:**

```bash
docker compose up -d
```

Lần đầu chạy sẽ tự động pull image từ GHCR. Ứng dụng khả dụng tại:

- `http://localhost:3001` (từ chính máy Pi)
- `http://<ip-pi>:3001` (từ mạng LAN)

Dữ liệu được lưu bền vững tại `./data/` trên máy Pi.

---

### Cập nhật ứng dụng

Khi có phiên bản mới, bạn có **hai cách cập nhật**:

**Cách 1 — Tự động qua giao diện (khuyến nghị):**

Vào **Settings → Phiên bản & Cập nhật** → Kiểm tra cập nhật → Nhấn **"Cập nhật ngay"**. Watchtower sẽ pull image mới và restart container tự động trong vài phút.

**Cách 2 — Thủ công trên Pi:**

```bash
cd ~/Family-Organizer
git pull
docker compose pull
docker compose up -d
```

> Nếu có thay đổi trong `docker-compose.yml`, cần `git pull` trước để lấy file mới nhất, rồi mới chạy `docker compose up -d`.

---

## 💻 Thiết Lập Môi Trường Dev (Local)

Dành cho phát triển và thử nghiệm tính năng mới — **không phải để chạy production**.

### Yêu cầu

- Node.js 20+

### Chạy

```bash
npm install
cp .env.example .env
# Điền GEMINI_API_KEY vào .env nếu cần test AI
npm run dev
```

Ứng dụng khởi động tại `http://localhost:3000`.

### Build production local (tùy chọn)

```bash
npm run build
npm start
```

### Kiểm thử (Tests)

Logic định giá tài sản (tuổi vàng, lời/lỗ, giá live) có unit test bằng **Vitest**:

```bash
npm test          # chạy một lần
npm run test:watch # theo dõi liên tục khi sửa code
```

---

## 🔑 Tài Khoản Mặc Định

Khi khởi động lần đầu (hoặc sau khi xóa `data/family.db`), hệ thống tự tạo một tài khoản Admin mặc định:

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Toàn quyền |

> Đổi mật khẩu tài khoản này ngay sau khi deploy production, sau đó vào **Settings → Thành viên & Phân quyền** để tạo tài khoản thật cho từng thành viên.

---

## 🛠️ Hướng Dẫn Admin

### Quản lý thành viên

1. Đăng nhập với tài khoản Admin.
2. Vào **Settings → Thành viên & Phân quyền**.
3. Tạo tài khoản mới hoặc nhấn biểu tượng chỉnh sửa để sửa thông tin, đổi vai trò, đổi mật khẩu cho thành viên.

### Backup & Restore

- **Tự động**: Hệ thống backup database mỗi 24 giờ vào `./data/backups/`.
- **Thủ công**: Settings → Lưu trữ & Sao lưu → **Tạo backup**.
- **Khôi phục**: Chọn điểm backup → **Khôi phục**. Trang tự reload sau 1.5 giây.

### Reset toàn bộ dữ liệu (Hard Reset)

```bash
# Trên Pi
docker compose down
rm data/family.db
docker compose up -d
```

Hệ thống tự khởi tạo lại database với dữ liệu seed mặc định.

> Nếu database bị hỏng (mất điện đột ngột), hệ thống tự sao chép file hỏng thành bản backup trước khi tự phục hồi.

---

## 📁 Cấu Trúc Dữ Liệu

```text
./data/
├── family.db       # Database chính (SQLite)
├── backups/        # Backup tự động và thủ công
└── uploads/        # Ảnh hóa đơn, avatar, tài sản, giấy tờ (lưu file, không base64)
```

---

## 🔧 Biến Môi Trường

| Biến | Bắt buộc | Mô tả |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Không | Khóa Gemini API cho tính năng AI assistant |
| `APP_URL` | Không | URL ngoài của ứng dụng (dùng cho liên kết tự tham chiếu) |
| `WATCHTOWER_HTTP_API_TOKEN` | Có (nếu dùng self-update) | Token xác thực Watchtower HTTP API |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Không | Bật thông báo đẩy cho PWA |

---

*Chúc gia đình bạn sử dụng vui vẻ! 🏡*
