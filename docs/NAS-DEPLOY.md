# Triển khai FamOrg trên Synology NAS

Cấu hình mặc định cho setup này:

| Mục | Giá trị |
|-----|---------|
| IP LAN | `192.0.2.10` |
| SSH | port **22** |
| Docker path | **`/path/to/your/famorg`** |
| Local port | **3000** |
| Public port (host Docker) | **8443** |
| Domain public (HTTPS) | **https://your-domain.example:8443** |
| Container port | `3000` |

App trong Docker listen HTTP nội bộ trên container `3000`, map host **8443** (public) và **3000** (LAN).  
Nếu muốn HTTPS đúng nghĩa trên `:8443`, cần cert reverse proxy hoặc TLS terminator trỏ vào port đó; mặc định container vẫn HTTP trên 8443 trừ khi bạn bọc SSL.

## 1. Chuẩn bị trên DSM

1. **Container Manager** (Docker) đã cài — volume làm việc: **data-volume**.
2. SSH: Control Panel → Terminal & SNMP → Enable SSH, port **22**.
3. Shared folder Docker trên data-volume, ví dụ: `/path/to/your/docker`.

## 2. Clone & chạy container

### Cách A — SSH (nhanh)

```bash
ssh -p 22 USER@192.0.2.10

cd /path/to/your/docker
git clone https://github.com/your-github-user/FamOrg.git
cd FamOrg
cp .env.example .env
# APP_URL=https://your-domain.example:8443
docker compose up -d --build
```

Hoặc:

```bash
APP_DIR=/path/to/your/famorg bash scripts/synology-deploy.sh
```

### Cách B — Container Manager (giao diện)

1. File Station: tạo `/path/to/your/famorg` (upload hoặc clone).
2. Có file `.env` (copy từ `.env.example`).
3. Container Manager → **Project** → path = `FamOrg` trên data-volume.
4. Build / Start.

### Kiểm tra

```text
LAN:    http://192.0.2.10:3000
Public: https://your-domain.example:8443   (cần DDNS + port-forward 8443 + cert nếu dùng HTTPS)
```

Tài khoản app mặc định: `admin` / `admin123` → **đổi ngay**.

## 3. Public HTTPS trên port 8443

Mục tiêu: **https://your-domain.example:8443/**

### Router / firewall

- Forward WAN **8443** → NAS `192.0.2.10:8443`
- Firewall DSM: cho phép TCP **8443**

### Certificate (khuyến nghị)

**Cách 1 — Reverse Proxy DSM (source port 8443)**

Control Panel → Login Portal → Advanced → Reverse Proxy → Create:

| Field | Value |
|-------|--------|
| Description | FamOrg |
| Source protocol | **HTTPS** |
| Source hostname | `your-domain.example` |
| Source port | **8443** |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` |
| Destination port | **3000** (hoặc 8443 nếu map thẳng container) |

Gán certificate Let's Encrypt cho hostname `your-domain.example`.

> Lưu ý: nếu Reverse Proxy listen 8443, **không** để Docker cũng bind 8443 (trùng port). Khi đó chỉ map Docker local `3000`, public do proxy.

**Cách 2 — Docker public 8443 + HTTP (đơn giản)**

- Giữ `ports: "8443:3000"` trong compose.
- Truy cập `http://your-domain.example:8443` (browser có thể cảnh báo nếu gõ https mà app chưa TLS).
- `APP_URL` vẫn đặt `https://...` chỉ khi bạn thực sự terminate TLS trước app.

### DDNS

Control Panel → External Access → DDNS: `your-domain.example` trỏ IP WAN.

## 4. File `.env` khuyến nghị

```env
LOCAL_PORT=3000
PUBLIC_PORT=8443
APP_URL=https://your-domain.example:8443
WATCHTOWER_HTTP_API_TOKEN=<random-secret>
GITHUB_REPO=your-github-user/FamOrg
```

Áp dụng:

```bash
cd /path/to/your/famorg
docker compose up -d
```

## 5. Cập nhật

```bash
cd /path/to/your/famorg
git pull
docker compose up -d --build
```

## 6. Dữ liệu

```text
/path/to/your/famorg/data/
├── family.db
├── app_settings.json
├── backups/
└── uploads/
```

## 7. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|-------------|------------|
| SSH timeout | Port SSH **22**, firewall cho phép |
| HTTPS lỗi trên :8443 | Cert + reverse proxy source 8443, hoặc trùng port Docker/proxy |
| 502 Bad Gateway | Container chưa chạy / sai destination port |
| Port conflict | Đổi `LOCAL_PORT` / `PUBLIC_PORT` hoặc bỏ bind 8443 nếu proxy giữ 8443 |
| **Widget thời tiết / BTC / vàng / USD trống (skeleton)** | Xem mục **8** bên dưới |
| **Lưu Gemini / Telegram báo Failed to fetch** | Xem mục **8** — container không ra Internet hoặc request treo |
| AI/Telegram test timeout | Settings → **Kiểm tra kết nối mạng (container)** |

## 8. Widget & AI không tải (outbound Internet)

Triệu chứng điển hình trên dashboard:

- Ô **Thời tiết**, **Bitcoin**, **Ethereum**, **Vàng**, **USD/VND** mãi skeleton xám
- Settings → lưu Gemini key / test Telegram: **Failed to fetch** hoặc timeout

Nguyên nhân phổ biến trên **Synology Docker**: container **không ra được Internet** (DNS NAS hỏng, IPv6 treo, hoặc firewall).

### 8.1. Chẩn đoán trong app (nhanh)

1. Đăng nhập **Admin** → **Thiết lập**
2. Cuộn tới **Kiểm tra kết nối mạng (container)** → **Kiểm tra ngay**
3. Xem từng mục: Open-Meteo, CoinGecko, open.er-api, vang.today, Telegram, Gemini

- Tất cả **OK** → mạng container ổn; nếu UI vẫn trống, hard-refresh (Ctrl+F5)
- **FAIL** DNS/timeout → làm bước 8.2

### 8.2. Sửa Docker network (khuyến nghị)

`docker-compose.yml` đã cấu hình:

```yaml
dns:
  - 8.8.8.8
  - 1.1.1.1
  - 8.8.4.4
environment:
  - NODE_OPTIONS=--dns-result-order=ipv4first
```

Image mặc định: **`ghcr.io/your-github-user/famorg:latest`** (CI build khi push `main`).

Áp dụng lại image mới:

```bash
cd /path/to/your/famorg
git pull
# Cập nhật IMAGE trong .env nếu còn trỏ image cũ:
#   IMAGE=ghcr.io/your-github-user/famorg:latest
docker compose pull
docker compose up -d
# Nếu package GHCR private:
#   echo $GITHUB_PAT | docker login ghcr.io -u your-github-user --password-stdin
```

Kiểm tra từ **bên trong** container:

```bash
docker exec -it famorg_app sh -c \
  'wget -qO- --timeout=8 https://api.open-meteo.com/v1/forecast?latitude=10.78\&longitude=106.7\&current=temperature_2m | head -c 200'
```

Nếu lệnh trên fail: vào DSM → **Container Manager** → network/firewall, cho phép container outbound HTTPS (443).

### 8.3. Fallback trình duyệt

Từ bản sửa này, nếu server không lấy được giá, **trình duyệt** sẽ tự gọi Open-Meteo / CoinGecko / FX (CORS) để hiển thị widget.  
Vàng SJC (vang.today) vẫn cần server; fallback hiển thị **PAXG / vàng thế giới**.

### 8.4. Gemini & Telegram khi mạng lỗi

- **Gemini**: nếu “Lưu & kiểm tra” fail vì mạng, bấm **Vẫn lưu key (bỏ qua kiểm tra mạng)** — key được ghi vào `data/app_settings.json`.
- **Telegram**: dùng **Gửi tin nhắn thử (nhanh)** trước khi gửi full backup (nhẹ hơn, dễ debug).

### 8.5. `network_mode: host` (bắt buộc trên NAS này)

Trên nhiều Synology (kể cả setup `your-nas`), **Docker bridge không ra được Internet** (ping 8.8.8.8 fail, DNS timeout) dù host NAS ra net bình thường.  
Vì vậy stack FamOrg dùng **`network_mode: host`**:

| Cổng host | Dịch vụ |
|-----------|---------|
| **3000** (`LOCAL_PORT`) | App HTTP (LAN) |
| **8443** (`PUBLIC_PORT`) | nginx HTTPS |
| **127.0.0.1:8080** | Watchtower API (chỉ localhost) |

`deploy/nginx.conf` là template: nginx image thay `${LOCAL_PORT}` / `${PUBLIC_PORT}` lúc start.

Nếu sau này bridge NAT được sửa (MASQUERADE/firewall), có thể chuyển lại bridge — hiện tại host network là cách ổn định để widget/AI/Telegram hoạt động.

## Lưu ý bảo mật

- Không commit mật khẩu DSM/SSH vào GitHub.
- Đổi mật khẩu app `admin` ngay sau lần đăng nhập đầu.
- Port 8443 public nên có HTTPS thật + hạn chế brute-force.
