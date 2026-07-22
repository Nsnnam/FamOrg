# Triển khai FamOrg trên Synology NAS

Cấu hình mặc định cho setup này:

| Mục | Giá trị |
|-----|---------|
| IP LAN | `192.168.1.89` |
| SSH | port **2232** |
| Docker path | **`/volume5/docker/FamOrg`** |
| Local port | **3576** |
| Public port (host Docker) | **8561** |
| Domain public (HTTPS) | **https://namns.i234.me:8561** |
| Container port | `3000` |

App trong Docker listen HTTP nội bộ trên container `3000`, map host **8561** (public) và **3576** (LAN).  
Nếu muốn HTTPS đúng nghĩa trên `:8561`, cần cert reverse proxy hoặc TLS terminator trỏ vào port đó; mặc định container vẫn HTTP trên 8561 trừ khi bạn bọc SSL.

## 1. Chuẩn bị trên DSM

1. **Container Manager** (Docker) đã cài — volume làm việc: **volume5**.
2. SSH: Control Panel → Terminal & SNMP → Enable SSH, port **2232**.
3. Shared folder Docker trên volume5, ví dụ: `/volume5/docker`.

## 2. Clone & chạy container

### Cách A — SSH (nhanh)

```bash
ssh -p 2232 USER@192.168.1.89

cd /volume5/docker
git clone https://github.com/Nsnnam/FamOrg.git
cd FamOrg
cp .env.example .env
# APP_URL=https://namns.i234.me:8561
docker compose up -d --build
```

Hoặc:

```bash
APP_DIR=/volume5/docker/FamOrg bash scripts/synology-deploy.sh
```

### Cách B — Container Manager (giao diện)

1. File Station: tạo `/volume5/docker/FamOrg` (upload hoặc clone).
2. Có file `.env` (copy từ `.env.example`).
3. Container Manager → **Project** → path = `FamOrg` trên volume5.
4. Build / Start.

### Kiểm tra

```text
LAN:    http://192.168.1.89:3576
Public: https://namns.i234.me:8561   (cần DDNS + port-forward 8561 + cert nếu dùng HTTPS)
```

Tài khoản app mặc định: `admin` / `admin123` → **đổi ngay**.

## 3. Public HTTPS trên port 8561

Mục tiêu: **https://namns.i234.me:8561/**

### Router / firewall

- Forward WAN **8561** → NAS `192.168.1.89:8561`
- Firewall DSM: cho phép TCP **8561**

### Certificate (khuyến nghị)

**Cách 1 — Reverse Proxy DSM (source port 8561)**

Control Panel → Login Portal → Advanced → Reverse Proxy → Create:

| Field | Value |
|-------|--------|
| Description | FamOrg |
| Source protocol | **HTTPS** |
| Source hostname | `namns.i234.me` |
| Source port | **8561** |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` |
| Destination port | **3576** (hoặc 8561 nếu map thẳng container) |

Gán certificate Let's Encrypt cho hostname `namns.i234.me`.

> Lưu ý: nếu Reverse Proxy listen 8561, **không** để Docker cũng bind 8561 (trùng port). Khi đó chỉ map Docker local `3576`, public do proxy.

**Cách 2 — Docker public 8561 + HTTP (đơn giản)**

- Giữ `ports: "8561:3000"` trong compose.
- Truy cập `http://namns.i234.me:8561` (browser có thể cảnh báo nếu gõ https mà app chưa TLS).
- `APP_URL` vẫn đặt `https://...` chỉ khi bạn thực sự terminate TLS trước app.

### DDNS

Control Panel → External Access → DDNS: `namns.i234.me` trỏ IP WAN.

## 4. File `.env` khuyến nghị

```env
LOCAL_PORT=3576
PUBLIC_PORT=8561
APP_URL=https://namns.i234.me:8561
WATCHTOWER_HTTP_API_TOKEN=<random-secret>
GITHUB_REPO=Nsnnam/FamOrg
```

Áp dụng:

```bash
cd /volume5/docker/FamOrg
docker compose up -d
```

## 5. Cập nhật

```bash
cd /volume5/docker/FamOrg
git pull
docker compose up -d --build
```

## 6. Dữ liệu

```text
/volume5/docker/FamOrg/data/
├── family.db
├── app_settings.json
├── backups/
└── uploads/
```

## 7. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|-------------|------------|
| SSH timeout | Port SSH **2232**, firewall cho phép |
| HTTPS lỗi trên :8561 | Cert + reverse proxy source 8561, hoặc trùng port Docker/proxy |
| 502 Bad Gateway | Container chưa chạy / sai destination port |
| Port conflict | Đổi `LOCAL_PORT` / `PUBLIC_PORT` hoặc bỏ bind 8561 nếu proxy giữ 8561 |

## Lưu ý bảo mật

- Không commit mật khẩu DSM/SSH vào GitHub.
- Đổi mật khẩu app `admin` ngay sau lần đăng nhập đầu.
- Port 8561 public nên có HTTPS thật + hạn chế brute-force.
