# Triển khai FamOrg trên NAS

Hướng dẫn chạy [FamOrg](https://github.com/Nsnnam/FamOrg) (Family Organizer) trên NAS bằng Docker.

## Port đã cấu hình

| Vai trò | Port host (NAS) | Port trong container | Mục đích |
|--------|-----------------|----------------------|----------|
| **Local** | **3576** | 3000 | Truy cập LAN / trong nhà |
| **Public** | **8561** | 3000 | Mở ra Internet / router forward |

- LAN: `http://<IP-NAS>:3576`
- Public (nếu mở firewall/router): `http://<IP-công-cộng>:8561`

Cả hai port đều trỏ vào cùng một app.

## Yêu cầu

- NAS hỗ trợ Docker / Container Manager (Synology, QNAP, TrueNAS SCALE, Unraid, …)
- Docker Compose v2
- ~512 MB RAM trống, vài GB ổ đĩa cho `data/`

## Cài lần đầu (SSH trên NAS)

```bash
# 1. Clone repo
cd /volume1/docker   # hoặc thư mục Docker bạn dùng
git clone https://github.com/Nsnnam/FamOrg.git
cd FamOrg

# 2. Tạo .env
cp .env.example .env
nano .env   # sửa APP_URL, WATCHTOWER_HTTP_API_TOKEN
```

Trong `.env` tối thiểu:

```env
LOCAL_PORT=3576
PUBLIC_PORT=8561
APP_URL=http://192.168.x.x:3576
WATCHTOWER_HTTP_API_TOKEN=<chuỗi-bí-mật-ngẫu-nhiên>
GITHUB_REPO=Nsnnam/FamOrg
```

Tạo token nhanh:

```bash
openssl rand -hex 24
```

```bash
# 3. Build + chạy (khuyến nghị lần đầu)
docker compose up -d --build

# Hoặc chỉ pull image GHCR (sau khi CI đã build thành công trên GitHub):
# docker compose pull && docker compose up -d
```

## Kiểm tra

```bash
docker compose ps
docker compose logs -f family-organizer
```

Mở trình duyệt:

- `http://<IP-NAS>:3576`
- Tài khoản mặc định: `admin` / `admin123` — **đổi mật khẩu ngay**

## Mở port public 8561

1. **Firewall NAS**: cho phép TCP 8561 (và 3576 nếu cần LAN từ VLAN khác).
2. **Router**: Port Forward `8561` → `<IP-NAS>:8561` (hoặc → `3576` nếu chỉ map một port).
3. Cập nhật `APP_URL` trong `.env` nếu dùng domain/HTTPS, rồi:

```bash
docker compose up -d
```

Khuyến nghị: reverse proxy (Nginx Proxy Manager, Caddy, Traefik, Synology Application Portal) + HTTPS thay vì HTTP trần ra Internet.

## Cập nhật

```bash
cd /path/to/FamOrg
git pull
docker compose pull   # nếu dùng image GHCR
# hoặc
docker compose up -d --build
```

Hoặc trong app: **Settings → Phiên bản & Cập nhật → Cập nhật ngay** (cần Watchtower + token đúng).

## Dữ liệu & backup

```
./data/
├── family.db          # SQLite chính
├── app_settings.json  # Gemini / Telegram (không vào backup ZIP)
├── backups/           # backup tự động
└── uploads/           # ảnh hóa đơn, giấy tờ, avatar
```

Backup thư mục `data/` định kỳ (Hyper Backup, rsync, Snapshot NAS).

## Synology Container Manager (không SSH)

1. Git clone repo vào Shared Folder (File Station hoặc SSH một lần).
2. Container Manager → **Project** → Create → chọn thư mục `FamOrg` (có `docker-compose.yml`).
3. Đảm bảo đã có file `.env` trong thư mục đó.
4. Build / Start project.
5. Control Panel → External Access / Firewall: mở 3576 (local) và 8561 (public) nếu cần.

## Tắt Watchtower (tuỳ chọn)

Nếu không muốn auto-update, comment service `watchtower` trong `docker-compose.yml` và bỏ các biến `WATCHTOWER_*` của service app.

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Port đã dùng | Đổi `LOCAL_PORT` / `PUBLIC_PORT` trong `.env` |
| Build fail trên NAS ARM | Dùng image GHCR multi-arch hoặc build trên máy cùng arch |
| Không vào được từ ngoài | Kiểm tra firewall NAS + port forward router → 8561 |
| Mất data sau recreate | Không xóa volume `./data`; chỉ `docker compose down` (không `-v`) |
| Permission `data/` | `mkdir -p data && chmod 777 data` (hoặc chown user chạy container) |
