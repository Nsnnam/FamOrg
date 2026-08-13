# 🏡 FamOrg — Family Hub

Hệ thống quản lý gia đình tất-cả-trong-một (**mặc định tên: FamOrg**, tagline **Family Hub** — có thể đổi trong Thiết lập) — tài chính, lịch trình, nhiệm vụ, sức khỏe, giấy tờ, mua sắm, thưởng điểm cho trẻ và trợ lý AI — thiết kế để chạy ổn định 24/7 trên **Synology NAS / Xpenology**, Raspberry Pi hoặc Linux server.

---

## ✨ Tính Năng

### 📊 Tổng Quan (Dashboard)

- Tóm tắt ngày: nhiệm vụ chờ xử lý, số dư quỹ gia đình, ghi chú ghim, sự kiện sắp tới
- Widget thời tiết theo 63 tỉnh/thành (nguồn Open-Meteo, không cần API key)
- Giá thị trường: BTC, ETH, Vàng SJC, USD/VND (+ tùy chọn EUR/CNY/JPY)
- **Tin tức RSS** từ báo chính thống VN (VnExpress, Tuổi Trẻ, Chính phủ, VTV…)
- **Tùy biến** bật/tắt từng khối dashboard, chọn thẻ tỷ giá và nguồn tin (Admin → Thiết lập)
- Nhắc sinh nhật, nhắc thuốc, danh sách mua sắm, **Nhắc người nhà**

### 📋 Nhiệm Vụ (Tasks)

- Tạo và phân công nhiệm vụ với 3 mức ưu tiên: Khẩn cấp / Bình thường / Thấp
- Bình luận thảo luận trực tiếp trong từng nhiệm vụ
- Trẻ em hoàn thành task → cộng điểm thưởng tự động

### 📅 Lập Lịch (Plans)

- Sự kiện đơn ngày và nhiều ngày, hiển thị dạng lưới theo thời gian
- Xuất file `.ics` tương thích iOS / Android / Google Calendar
- Private calendar feed (`/api/calendar.ics?token=...`) — đồng bộ 2 chiều với ứng dụng lịch bên ngoài
- Deep-link từ thông báo đẩy mở thẳng vào sự kiện cụ thể

### 📝 Ghi Chú (Notes)

- Markdown đầy đủ + **thanh công cụ** (H1/H2, đậm, list, bảng, code…)
- **Chèn/dán ảnh** vào ghi chú (Ctrl+V hoặc nút Ảnh)
- Soạn / Xem trước; ghim; quyền Công khai / Cá nhân; AI viết nháp (Gemini)

### 💰 Chi Tiêu (Finance)

- Ghi thu/chi; **nhóm danh mục** và danh mục tùy chỉnh (chung thu+chi)
- Sắp xếp danh mục theo **tần suất sử dụng** rồi thứ tự thủ công
- Nhập tiền thông minh: biểu thức `50.000+20.000`, gợi ý **mệnh giá / thêm 3–6 số 0**
- Đính kèm ảnh hóa đơn; biểu đồ, lọc kỳ, xuất PDF
- **Tài Sản**, **Ngân Sách**, **Hóa đơn tái diễn**, **Tiết kiệm**, **Nợ**

### 🛒 Đi Chợ (Shopping)

- Danh sách mua sắm chung, đồng bộ thời gian thực cho cả nhà
- Đánh dấu đã mua từng món; xóa hàng loạt khi về chợ xong
- AI gợi ý thực đơn tuần (mẫu offline + Gemini) → tự tạo danh sách nguyên liệu gộp
- Thêm/xóa bằng **giọng nói** qua trợ lý AI (lệnh tự nhiên tiếng Việt)

### 💊 Sức Khỏe Gia Đình (Health)

- **Tăng Trưởng**: Ghi chiều cao / cân nặng theo thời gian, biểu đồ phát triển
- **Tiêm Chủng**: Lịch sử các mũi đã tiêm, ghi nhắc mũi sắp tới
- **Lịch Thuốc**: Đặt múc giờ uống nhiều lần/ngày, nhắc trên dashboard và thông báo đẩy, ghi nhận đã uống / bỏ lỡ

### 📄 Giấy Tờ (Documents)

- Kho giấy tờ (CMND, hộ chiếu, bảo hiểm, sổ đỏ…)
- Đính kèm **ảnh, PDF, Office (doc/xls/ppt), zip/rar/7z** (tối đa 25MB/tệp)
- Theo dõi hết hạn, phân chủ sở hữu

### 🎁 Thưởng Điểm (Rewards)

- Trẻ em tích điểm khi hoàn thành nhiệm vụ được giao
- Cửa hàng đổi thưởng: người lớn tạo danh sách quà có giá điểm cụ thể
- **Mystery Item**: rút thưởng bí ẩn ngẫu nhiên (gacha)
- Admin quản lý mẫu quà, duyệt yêu cầu đổi thưởng

### 🖥️ Quản Lý Server (Server Monitor — chỉ Admin)

- CPU, RAM, nhiệt độ, ổ đĩa + lịch sử 24h/7 ngày
- **Thông tin Synology**: model, DSM version/build, serial, unique, volume, kernel, dung lượng từng volume
- Shortcut homelab; cập nhật app qua Watchtower

### 🎨 Thương hiệu & giao diện

- Đổi **tên app**, tagline, tiêu đề tab, logo (emoji/URL/ảnh), favicon
- Mặc định: **FamOrg** / **Family Hub**
- Nền: nhiều preset màu + **import ảnh nền** tùy chỉnh

### 🤖 Trợ Lý AI (Gemini)

- Tích hợp **Google Gemini API** — Admin nhập key trong Settings (lưu trong `app_settings.json`, không vào backup)
- Viết nháp ghi chú, gợi ý thực đơn, xử lý lệnh mua sắm bằng giọng nói
- **Bản tin tuần** (Weekly Digest): sáng thứ Hai 7h–10h gửi Telegram — tóm tắt chi tiêu, task trễ/sắp hạn, lịch sự kiện, sinh nhật, giấy tờ sắp hết hạn; AI viết thân thiện nếu có Gemini key

### 📲 Telegram Integration

- **Backup offsite**: gửi file ZIP (DB + uploads) qua Telegram bot mỗi đêm — lưu trữ ngoài server miễn phí
- **Bản tin tuần**: sáng thứ Hai 7h–10h gửi tóm tắt gia đình (bật/tắt riêng)
- Nút **Test** kiểm tra kết nối bot ngay trong Settings

### 🔔 Thông Báo & Đồng Bộ

- **Server-Sent Events (SSE)**: đồng bộ thời gian thực — không cần tải lại trang khi có thay đổi từ thành viên khác
- **Web Push (VAPID)**: thông báo đẩy native trên iOS/Android kể cả khi đóng app, kèm badge số và deep-link
- Thông báo nội bộ trong app (popup + badge)

### 🔍 Tìm Kiếm Toàn Cục

- Phím tắt `⌘K` / `Ctrl+K` — tìm đồng thời tasks, lịch, ghi chú, tài chính, giấy tờ

### 🌙 Giao Diện

- Light / Dark mode với hiệu ứng ripple transition (View Transitions API)
- PWA-first: safe-area, bottom nav, touch-friendly — tối ưu cho iPhone
- Tôn trọng `prefers-reduced-motion` của hệ thống

---

## 🔒 Phân Quyền (RBAC)

| Vai trò | Quyền hạn |
| :--- | :--- |
| **Admin (Gia trưởng)** | Toàn quyền: quản lý thành viên, đổi vai trò, backup/restore, log hệ thống, cập nhật app, cấu hình AI & Telegram |
| **Member (Thành viên)** | Tạo/sửa/xóa dữ liệu của mình; truy cập tài chính; không quản lý tài khoản người khác |
| **Child (Trẻ em)** | Xem lịch và ghi chú công khai; cập nhật task của mình; kiếm và đổi điểm thưởng; không truy cập tài chính |
| **Guest (Khách)** | Chỉ xem lịch và ghi chú công khai |

---

## 🚀 Triển Khai Production (NAS / Docker)

Ứng dụng chạy Docker Compose; CI build image multi-arch (`amd64` + `arm64`) lên **GHCR**. Watchtower có thể tự cập nhật khi có image mới.

**Hướng dẫn chi tiết cho NAS:** [docs/NAS-DEPLOY.md](docs/NAS-DEPLOY.md)

### Port & URL (đã cấu hình sẵn)

| Vai trò | Giá trị | Mục đích |
| :--- | :--- | :--- |
| **Local (LAN)** | `192.0.2.10:3000` | Truy cập trong nhà |
| **Public host port** | `8443` | Port public trên NAS |
| **Public HTTPS** | **https://your-domain.example:8443** | Domain + port 8443 |
| **Docker data** | `/srv/famorg` | Volume5 trên Synology |
| **SSH** | port `22` | Terminal DSM |

`APP_URL` mặc định: **https://your-domain.example:8443**. Container HTTP nội bộ; TLS qua reverse proxy hoặc port-forward + cert.

### Yêu cầu hệ thống

- Synology NAS (Container Manager / Docker) hoặc Linux + Docker Compose v2
- ~512 MB RAM trống

### Cài lần đầu (Synology)

```bash
ssh -p 22 USER@192.0.2.10
cd /path/to/your/docker
git clone https://github.com/your-github-user/FamOrg.git
cd FamOrg
cp .env.example .env
# APP_URL=https://your-domain.example:8443
# IMAGE=ghcr.io/your-github-user/famorg:latest
docker compose pull
docker compose up -d
# Lần đầu nếu chưa có image trên GHCR: docker compose up -d --build
```

Hoặc một lệnh cài: `bash scripts/nas_install.sh` (chạy root trên NAS).

Stack NAS dùng **`network_mode: host`** (Docker bridge trên nhiều Synology không ra Internet → widget/AI/Telegram lỗi).  
Chi tiết: [docs/NAS-DEPLOY.md](docs/NAS-DEPLOY.md)

Ứng dụng khả dụng tại:

- **https://your-domain.example:8443** — public
- `http://192.0.2.10:3000` — LAN

Dữ liệu lưu bền vững tại `./data/` trên máy host.

### Cập nhật

**Qua giao diện (khuyến nghị):** Settings → Phiên bản & Cập nhật → **Cập nhật ngay**

**Thủ công (image GHCR — khuyến nghị trên NAS):**

```bash
cd /srv/famorg
git pull
# Đảm bảo .env có: IMAGE=ghcr.io/your-github-user/famorg:latest
docker compose pull && docker compose up -d
```

**Build local (khi dev / chưa có image):**

```bash
cd /path/to/FamOrg && git pull && docker compose up -d --build
```

---

## 💻 Môi Trường Dev (Local)

### Yêu cầu phần mềm

- Node.js 22+

### Chạy dev server

```bash
npm install
cp .env.example .env
npm run dev
```

Ứng dụng khởi động tại `http://localhost:3000`.

> Để test AI trong dev: nhập Gemini key trực tiếp trong **Settings → Thiết lập AI** (hoặc đặt `GEMINI_API_KEY` trong `.env` làm fallback).

### Build production

```bash
npm run build && npm start
```

### Tests

```bash
npm test            # chạy một lần
npm run test:watch  # theo dõi khi sửa code
```

---

## 🔑 Tài Khoản Mặc Định

Khi khởi động lần đầu hoặc sau khi xóa `data/family.db`, hệ thống tự tạo:

| Vai trò | Username | Mật khẩu |
| :--- | :--- | :--- |
| Admin | `admin` | `admin123` |

> **Đổi mật khẩu ngay** sau khi deploy. Vào **Settings → Thành viên & Phân quyền** để thêm tài khoản cho từng thành viên.

---

## 🔧 Biến Môi Trường

Các biến đặt trong file `.env` ở thư mục gốc (được `docker-compose.yml` đọc tự động).

| Biến | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `LOCAL_PORT` | Không | Port LAN trên NAS (mặc định **3000**) |
| `PUBLIC_PORT` | Không | Port public trên NAS (mặc định **8443**) |
| `WATCHTOWER_HTTP_API_TOKEN` | Có* | Token xác thực Watchtower — cần cho nút "Cập nhật ngay". Tạo bằng `openssl rand -hex 24` |
| `GEMINI_API_KEY` | Không | Fallback Gemini key khi chưa cấu hình qua Settings UI |
| `VAPID_PUBLIC_KEY` | Không | VAPID public key — bật thông báo đẩy PWA |
| `VAPID_PRIVATE_KEY` | Không | VAPID private key |
| `VAPID_SUBJECT` | Không | Email liên hệ cho VAPID (dạng `mailto:you@example.com`) |
| `APP_URL` | Không | URL ngoài của app — dùng cho deep-link trong thông báo đẩy |
| `GITHUB_REPO` | Không | Repo GitHub để kiểm tra commit mới nhất (mặc định: `your-github-user/FamOrg`) |

> **Gemini key và cấu hình Telegram** được quản lý qua **Settings → Thiết lập AI / Telegram** trong giao diện — lưu vào `app_settings.json`, không vào backup. Biến môi trường `GEMINI_API_KEY` chỉ là fallback nếu chưa nhập qua UI.
> **VAPID keys** tạo bằng: `npx web-push generate-vapid-keys`

---

## 📁 Cấu Trúc Dữ Liệu

```text
./data/
├── family.db          # Database chính (SQLite)
├── app_settings.json  # API keys & cấu hình Telegram (không vào backup)
├── backups/           # Backup tự động 24h và thủ công
└── uploads/           # Ảnh hóa đơn, avatar, tài sản, giấy tờ (file, không base64)
```

---

## 🛠️ Hướng Dẫn Admin

### Quản lý thành viên

Settings → Thành viên & Phân quyền → Tạo mới hoặc chỉnh sửa vai trò / mật khẩu.

### Cấu hình AI (Gemini)

1. Lấy key miễn phí: [Google AI Studio](https://aistudio.google.com/apikey)
2. Settings → **Trí tuệ AI (Gemini API Key)** → dán key → **Lưu & kiểm tra**
3. Nếu báo lỗi mạng/timeout: bấm **Vẫn lưu key (bỏ qua kiểm tra mạng)**, rồi Settings → **Kiểm tra kết nối mạng (container)**

### Cấu hình Telegram

1. Tạo bot qua [@BotFather](https://t.me/BotFather), lấy token
2. Lấy Chat ID (ví dụ [@userinfobot](https://t.me/userinfobot))
3. Settings → **Backup tự động qua Telegram** → dán token + chat ID → **Lưu & bật**
4. Thử **Gửi tin nhắn thử (nhanh)** trước; khi ổn mới **Gửi backup ngay để thử**
5. Bật **Bản tin tuần** nếu muốn tóm tắt sáng thứ Hai

### Widget thời tiết / tỷ giá trống?

Dashboard lấy dữ liệu qua server (Open-Meteo, CoinGecko, vang.today…).  
Nếu ô vẫn skeleton xám:

1. Settings → **Kiểm tra kết nối mạng (container)**
2. Xem [docs/NAS-DEPLOY.md §8](docs/NAS-DEPLOY.md) — DNS Docker `8.8.8.8` + `NODE_OPTIONS=--dns-result-order=ipv4first`
3. App có **fallback trình duyệt** (Open-Meteo/CoinGecko/FX) khi server không ra Internet

### Backup & Restore

- **Tự động**: mỗi 24h vào `./data/backups/`
- **Thủ công**: Settings → Lưu trữ & Sao lưu → Tạo backup
- **Khôi phục**: Chọn điểm backup → Khôi phục → Server tự reload
- **Telegram offsite**: bật trong Settings → Telegram để gửi ZIP backup ra ngoài mỗi đêm

### Reset toàn bộ

```bash
docker compose down
rm data/family.db
docker compose up -d
```

---

## 🏗️ Tech Stack

| Layer | Thư viện / Công cụ |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4 |
| **Animation** | Motion 12 (Framer Motion successor) |
| **Markdown** | react-markdown 10 + remark-gfm |
| **Backend** | Express 4, Better-SQLite3 11, Node.js 22 |
| **AI** | Google GenAI SDK 2 (Gemini 2.5 Flash) |
| **Notifications** | Web Push / VAPID, SSE |
| **Export** | pdfmake 0.3 (báo cáo tài chính), archiver 8 (ZIP backup) |
| **Container** | Docker multi-stage (Alpine), Watchtower, GHCR |
| **Testing** | Vitest 4 |

---

Chúc gia đình bạn sử dụng vui vẻ! 🏡
