# Triển khai FamOrg trên Synology NAS

Cấu hình mặc định cho setup này:

| Mục | Giá trị |
|-----|---------|
| IP LAN | `192.0.2.10` |
| Local port | **3000** |
| Public port (host Docker) | **8443** |
| Domain public (HTTPS) | **https://your-domain.example** |
| Container port | `3000` |

App trong Docker vẫn listen HTTP nội bộ; **HTTPS** do **Reverse Proxy + certificate** của Synology đảm nhiệm.

## 1. Chuẩn bị trên DSM

1. **Container Manager** (Docker) đã cài.
2. Bật **SSH** tạm (tuỳ chọn, dễ deploy):  
   Control Panel → Terminal & SNMP → Enable SSH service.
3. Shared Folder cho Docker, ví dụ: `/volume1/docker`.

## 2. Clone & chạy container

### Cách A — SSH (nhanh)

```bash
cd /volume1/docker
git clone https://github.com/your-github-user/FamOrg.git
cd FamOrg
cp .env.example .env
# APP_URL đã là https://your-domain.example — chỉ cần đổi WATCHTOWER token nếu muốn
docker compose up -d --build
```

### Cách B — Container Manager (giao diện)

1. File Station: tạo `/docker/FamOrg`, upload source (hoặc clone qua SSH một lần).
2. Đảm bảo có file `.env` (copy từ `.env.example`).
3. Container Manager → **Project** → Create → path = thư mục `FamOrg`.
4. Build / Start.

### Kiểm tra LAN

```text
http://192.0.2.10:3000
```

Tài khoản app mặc định: `admin` / `admin123` → **đổi ngay**.

## 3. Reverse Proxy HTTPS (bắt buộc cho domain)

Để `https://your-domain.example` trỏ vào FamOrg:

1. **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**

| Field | Value |
|-------|--------|
| Description | FamOrg |
| Source protocol | **HTTPS** |
| Source hostname | `your-domain.example` |
| Source port | `443` |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` (hoặc `192.0.2.10`) |
| Destination port | **3000** |

2. **Certificate (Let's Encrypt)**  
   Control Panel → Security → Certificate  
   - Add → Get from Let's Encrypt  
   - Domain: `your-domain.example`  
   - Gán cert cho reverse proxy / domain này.

3. **DDNS**  
   Control Panel → External Access → DDNS: `your-domain.example` trỏ về IP WAN hiện tại.

4. **Router**  
   Forward WAN **443** → NAS `192.0.2.10:443` (DSM/reverse proxy).  
   Không bắt buộc mở 8443 ra Internet nếu đã dùng reverse proxy 443.

5. **Firewall DSM**  
   Cho phép 443 (HTTPS), 3000 chỉ LAN nếu muốn.

Sau khi xong, mở:

```text
https://your-domain.example
```

## 4. File `.env` khuyến nghị

```env
LOCAL_PORT=3000
PUBLIC_PORT=8443
APP_URL=https://your-domain.example
WATCHTOWER_HTTP_API_TOKEN=<random-secret>
GITHUB_REPO=your-github-user/FamOrg
```

`APP_URL` **phải HTTPS** để deep-link / Web Push hoạt động đúng trên domain public.

Áp dụng lại:

```bash
cd /volume1/docker/FamOrg
docker compose up -d
```

## 5. Cập nhật

```bash
cd /volume1/docker/FamOrg
git pull
docker compose up -d --build
```

Hoặc trong app: Settings → Phiên bản & Cập nhật → Cập nhật ngay.

## 6. Dữ liệu

```text
/volume1/docker/FamOrg/data/
├── family.db
├── app_settings.json
├── backups/
└── uploads/
```

Backup thư mục `data/` bằng Hyper Backup / Snapshot.

## 7. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|-------------|------------|
| LAN OK, HTTPS lỗi | Kiểm tra Reverse Proxy + certificate + DDNS |
| 502 Bad Gateway | Container chưa chạy / sai destination port (phải 3000) |
| Port conflict | Đổi `LOCAL_PORT` / `PUBLIC_PORT` trong `.env` |
| Build chậm trên NAS | Bình thường lần đầu; lần sau cache Docker |
| SSH timeout | Bật SSH trên DSM hoặc dùng Container Manager UI |

## Lưu ý bảo mật

- Không commit mật khẩu DSM/SSH vào GitHub.
- Đổi mật khẩu app `admin` ngay sau lần đăng nhập đầu.
- Ưu tiên chỉ public **443** (HTTPS), hạn chế mở 8443/3000 ra Internet.
