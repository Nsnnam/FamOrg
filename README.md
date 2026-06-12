# 🏡 Family Organizer & Home Hub (Vibrant Palette Edition)

Chào mừng bạn đến với **Family Organizer**, hệ thống cộng tác thời gian thực hằng ngày, quản trị lối sống và tài chính dành cho các thành viên trong tổ ấm thân yêu. 

Ứng dụng được thiết kế tối ưu hóa nhẹ nhàng, ổn định, tiết kiệm RAM để vận hành mượt mà trên môi trường máy chủ gia đình (như **Raspberry Pi 5** hoặc các container Cloud Run). Phiên bản này đã được cập nhật giao diện **Vibrant Palette** hoàn toán mới — mang phong vị hiện đại, tương phản cao, dịu mắt với các phối sắc Indigo, Ngọc lục bảo (Emerald) và Slate sáng.

---

## ✨ Các Tính Năng Cực Kỳ Nổi Bật

### 1. 📊 Bảng Điều Khiển Tổng Quan (Dashboard)
- Hiển thị tóm tắt tình trạng ngày, số lượng nhiệm vụ cần thực hiện, số dư quỹ gia đình và ghi chú ghim.
- **Pi Monitor**: Tích hợp block giám sát cấu hình phần cứng ảo (nhiệt độ CPU, mức sử dụng RAM) lấy cảm hứng từ việc chạy thực tế trên Raspberry Pi.

### 2. 📋 Quản Lý Nhiệm Vụ (Group Tasks)
- Tạo, phân công công việc cho từng thành viên với phân hạng mức ưu tiên (Khẩn cấp, Bình thường, Thấp).
- Đính kèm bình luận thảo luận trực tiếp (Comments) trong từng đầu việc để gia đình tương tác.
- Lọc tiến độ dễ dàng của cả gia đình, của cá nhân hoặc các nhiệm vụ đã hoàn tất.

### 3. 📅 Lịch Trình Sinh Hoạt (Schedules & Plans)
- Tạo các sự kiện quan trọng như họp phụ huynh, tiệc sinh nhật, du lịch gia đình, khám sức khỏe...
- Chế độ xem linh hoạt giữa danh sách (List View) và lịch biểu bàn cờ (Grid Calendar View).

### 4. 📝 Ghi Chú Gia Đình (Markdown Notes)
- Trình soạn thảo văn bản hỗ trợ cú pháp **Markdown cơ bản** (đầu mục `#`, `-` danh sách, `- [ ]` việc phát sinh, \`code inline\`).
- Khả năng **Ghim vị trí hàng đầu (Pin)** để ghim các nội dung cực kỳ quan trọng (ví dụ: mật khẩu Wi-Fi, lưu ý bảo hiểm).
- Thiết lập quyền riêng tư: **Công khai** (mọi thành viên đều xem được) hoặc **Cá nhân** (chỉ người tạo và Gia Trưởng được xem).

### 5. 💳 Ghi Chép Tài Chính (Family Finance)
- *Chỉ khả dụng cho tài khoản từ cấp Member trở lên.*
- Theo dõi toàn bộ dòng tiền Thu nhập (+) và Chi tiêu (-) của gia đình.
- Phân loại trực quan theo các hạng mục (Ăn uống, Học tập, Điện nước, Mua sắm, Y tế, Đi lại).
- **Hóa đơn điện tử**: Đính kèm ảnh và tài liệu hóa đơn thanh toán trực tiếp từ đĩa hoặc điện thoại để lưu trữ thông tin đối chiếu lâu dài.
- Tự động hiển thị biểu đồ phân bổ dòng tiền (Donut Chart) và biểu đồ lượng lượng tiêu thụ trực quan.

### 6. 🔒 Phân Quyền Thành Viên (RBAC - Role Based Access Control)
Hệ thống được cấu trúc chặt chẽ với 3 vai trò thành viên:
1. **Gia Trưởng (Admin)**: Toàn quyền truy cập. Có quyền đăng ký thành viên mới, tạo điểm sao lưu (Backup) thủ công, khôi phục dữ liệu từ tệp backup, và xem lịch sử truy vết hệ thống (Logs).
2. **Thành Viên (Member)**: Được toàn quyền tạo mới, chỉnh sửa, xóa các tác vụ, lịch trình, ghi chú và tài chính của mình. Không thể quản lý người dùng khác hoặc thao tác trong mục cấu hình máy chủ.
3. **Khách / Trẻ em (Guest)**: Chỉ được phép xem các kế hoạch chung, tích điểm hoàn thành nhiệm vụ của riêng mình, đọc ghi chú được chia sẻ rộng rãi. Không được truy cập phân hệ Tài chính và không được sửa đổi dữ liệu cốt lõi của người khác.

### 7. 🌀 Đồng Bộ Thời Gian Thực (Active Realtime SSE Sync)
- Sử dụng kết nối luồng sự kiện **Server-Sent Events (SSE)** siêu nhẹ giúp đồng bộ dữ liệu ngay lập tức giữa mọi thiết bị di động và máy tính của các thành viên khi có bất cứ sự thay đổi nào từ thành viên khác mà không cần tải lại trang.

### 8. 🛡️ Sao Lưu & Phục Hồi An Toàn (Server Backups)
- Hệ thống hỗ trợ lưu trữ tự động mọi biến động dữ liệu vào mục `/data` bền vững.
- Admin có thể nhấn nút tạo các bản sao lưu thủ công (Manual Backups) và kích hoạt khôi phục (Restore Only) tức thì khi có sự cố.

---

## 🛠️ Yêu Cầu Hệ Thống & Cài Đặt

Ứng dụng được viết hoàn toàn bằng **React (TypeScript) + Vite** cho Client-side và **Express + Node.js** cho backend server.

### Cách 1: Thiết lập và Chạy Trên Máy Cục Bộ (Local Machine / Raspberry Pi)

1. **Cài đặt các gói phụ thuộc (Dependencies)**:
   ```bash
   npm install
   ```

2. **Cấu hình môi trường (`.env`)**:
   Tạo tệp `.env` hoặc dựa vào `.env.example` sẵn có tại cây thư mục gốc:
   ```env
   # .env.example
   PORT=3000
   ```

3. **Chạy ở chế độ phát triển (Development)**:
   ```bash
   npm run dev
   ```
   Hệ thống sẽ khởi tạo máy chủ Vite đồng hành cùng Express tại cổng `http://localhost:3000`.

4. **Biên dịch và Chạy Production**:
   ```bash
   npm run build
   ```
   Sau khi hoàn tất tiến trình build, tệp bundle của Client sẽ nằm tại thư mục `/dist` và server backend được đóng gói thành `dist/server.cjs` để hoạt động độc lập:
   ```bash
   npm start
   ```

---

### Cách 2: Chạy Bằng Docker & Docker Compose (Khuyên dùng cho Máy chủ Gia đình)

Nếu bạn muốn chạy ứng dụng của mình bền bỉ dạng background 24/7 trên các hệ điều hành Linux/Raspberry Pi hệ Home Assistant, hãy sử dụng Docker:

```bash
# Khởi chạy Docker Container dạng background daemon
docker-compose up -d --build
```

Máy chủ của bạn sẽ được kích hoạt tại cổng `3000` trên hệ thống. Dữ liệu gia đình sẽ được ánh xạ liên kết vật lý (Volume Mount) ổn định vào thư mục `./data` trên máy chủ của bạn để tránh mất mát khi khởi động lại.

---

## 🔑 Tài Khoản Thử Nghiệm Nhanh (Demo Profiles)

Tại cổng đăng nhập màn hình khóa, bạn có thể nhập trực tiếp tài khoản bên dưới hoặc bấm trực tiếp vào các ô **"Demo"** ở chân trang để trải nghiệm tức thì:

| Chức vụ trong gia đình | Tên Đăng Nhập | Mật Khẩu | Quyền hạn tiêu biểu |
| :--- | :--- | :--- | :--- |
| **Gia Trưởng (Admin)** | `admin` | `admin123` | Quản trị viên, tạo tài khoản mới, Backup & Restore tệp |
| **Bố Hùng (Member)** | `bohung` | `bohung123` | Sửa chữa tác vụ, viết Markdown, tạo giao dịch dòng tiền |
| **Mẹ Lan (Member)** | `melan` | `melan123` | Tương tác toàn bộ các dịch vụ công cộng và sinh hoạt |
| **Bé Vy (Guest/Kid)** | `bevy` | `bevy123` | Tài khoản khách, cập nhật tiến trình học của con, đọc lịch |

---

## 🛠️ Hướng Dẫn Quản Trị Hệ Thống (Admin Guide)

### 1. 🔑 Cơ Chế Tạo Thêm Tài Khoản Quản Lý (Admin) Hoặc Thành Viên Mới
Hệ thống hỗ trợ phân quyền vai trò (RBAC) mạnh mẽ ngay từ tầng cơ sở dữ liệu. Để khởi tạo thêm tài khoản quản trị (Admin) đồng hành hoặc tài khoản thành viên mới:
- **Bước 1**: Đăng nhập vào hệ thống sử dụng tài khoản có quyền **Gia Trưởng (Admin)** (ví dụ: tài khoản `admin/admin123` mặc định).
- **Bước 2**: Truy cập tab **Sê-ri Cấu hình (Settings)** trên thanh điều hướng bên trái.
- **Bước 3**: Tại tiểu mục **"Thành viên và Phân quyền"**, điền đầy đủ thông tin:
  - *Tên đăng nhập*: Viết liền, không dấu, không hoa (Ví dụ: `conca`, `ongnoi`).
  - *Tên xưng hô đầy đủ*: Chọn biệt danh hiển thị thích hợp.
  - *Phân quyền*: Bạn có thể chọn phong cấp trực tiếp làm **Quản lý (Admin)** (quyền ngang hàng Gia Trưởng) hoặc **Thành viên (Member)** / **Khách (Guest)**.
  - *Mật khẩu*: Nhập mật khẩu khởi tạo ban đầu cho thành viên đó.
  - *Màu sắc thương hiệu*: Chọn màu đại diện bóng mượt cho thẻ Avatar của họ.
- **Bước 4**: Nhấn nút **"Kích hoạt tài khoản"**. 
- **Dưới góc độ kỹ thuật**: Client sẽ mã hóa gửi yêu cầu tới API endpoint `POST /api/users`. API này được bảo vệ nghiêm ngặt bởi middleware kiểm tra token phiên bản quyền Admin (`requireRole([UserRole.ADMIN])`), mã hóa mật khẩu bằng thuật toán băm an toàn **PBKDF2** (với salt tùy chỉnh) và lưu vĩnh viễn vào `data/db.json`.

---

### 2. 🧹 Cơ Chế Đặt Lại / Xóa Sạch Toàn Bộ Cơ Sở Dữ Liệu (Database Reset/Wipe)
Trong trường hợp bạn muốn dọn sạch toàn bộ dữ liệu giao dịch tài chính, nhiệm vụ thử nghiệm để bắt đầu lại từ đầu một năm mới, bạn có hai phương thức xử lý cực kỳ trực quan:

#### 👉 Phương án A: Khôi Phục Về Snapshot Bản Sao Lưu Cũ (Revert without data loss)
- Vào tab **Sê-ri Cấu hình (Settings)** $\rightarrow$ **Lưu trữ & Sao lưu tệp**.
- Danh sách các điểm khôi phục cũ (do hệ thống tự động backup mỗi 24 giờ hoặc do Admin bấm lưu thủ công) sẽ xuất hiện tại đây.
- Tìm điểm snapshot mong muốn $\rightarrow$ Bấm **Khôi phục (Restore)**. Hệ thống sẽ thay thế toàn bộ dữ liệu đang phát sinh bằng dữ liệu sạch tại điểm lưu đó lịch sử, ghi nhật ký hoạt động dịch vụ và tải lại trang tự động sau 1.5 giây để tránh lệch bộ nhớ đệm cache.

#### 👉 Phương án B: Reset Cứng / Xóa Sạch Toàn Bộ Về Trạng Thái Gốc (Hard Reset to Seed)
Bản chất hệ thống lưu trữ dạng file-based mỏng phẳng tĩnh cực kỳ tối ưu cho Raspberry Pi. Khi bạn muốn dọn dẹp triệt để:
1. **Dừng dịch vụ Node.js hoặc container Docker**:
   ```bash
   docker-compose down     # Nếu đang chạy bằng Docker
   # Hoặc dừng tiến trình npm start đang vận hành
   ```
2. **Xóa tệp cơ sở dữ liệu `db.json`**:
   Di chuyển vào thư mục cài đặt dự án và xóa tệp tin cơ sở dữ liệu:
   ```bash
   rm data/db.json
   ```
3. **Mở lại dịch vụ / Khởi chạy lại**:
   ```bash
   npm start               # Hoặc docker-compose up -d
   ```
- **Cơ chế tự phục hồi (Self-Healing System)**: Khi khởi động, Backend Server sẽ quét thư mục `/data`. Nếu không phát hiện tệp `db.json`, hệ thống sẽ chủ động kích hoạt trình gieo hạt giống dữ liệu mặc định (`initialDBState()`). Tiến trình này sẽ:
  - Khởi tạo lại một cơ sở dữ liệu trống tinh khiết.
  - Gieo hạt (seed) 4 tài khoản mẫu cốt lõi (`admin`, `bohung`, `melan`, `bevy`) kèm các cấu phác việc làm và ghi chú Wifi chung mẫu ban đầu.
  - *Lưu ý an toàn*: Nếu tệp dữ liệu bị hỏng trong quá trình mất điện đột ngột trên Raspberry Pi, hệ thống sẽ tự động sao chép tệp hỏng thành `data/db_corrupted_[timestamp].json` trước khi tự khôi phục tài liệu mẫu sạch để bảo toàn dữ liệu lỗi cho Admin phân tích sau này nếu cần.

---

## 🎨 Thông Tin Giao Diện: Vibrant Palette (Light & Dark Mode Dual Mode)

Chủ đề giao diện **Vibrant Palette** mang lại một trải nghiệm dùng cực kỳ trực quan, tràn đầy năng lượng và hỗ trợ chuyển đổi giao diện **Light/Dark** linh động, đồng nhất thông qua nút bấm biểu tượng Mặt trời/Mặt trăng ở đầu thanh công cụ:

### ☀️ Chế độ Giao diện Sáng (Vibrant Light)
- **Canvas Sáng Thanh Thoát**: Tone nền màu `#f8fafc` nhẹ nhàng kết hợp các thẻ hộp trắng muốt tinh khiết giúp tăng cường tối đa độ tương phản của chữ.
- **Phối Sắc Indigo**: Sắc tím Indigo đậm đà lý tưởng làm điểm nhấn chính giúp điều phối thị giác dễ dàng.

### 🌙 Chế độ Giao diện Tối (Vibrant Dark - Cosmic Midnight)
- **Bàn Cờ Vũ Trụ Cao Cấp**: Thừa hưởng gam màu Navy trầm ngả phiến đá (`#0d121f` cho nền và `#131b2e` cho các thẻ hộp) hoàn toàn mềm mại, bảo vệ đôi mắt của mọi thành viên khi sử dụng thiết bị gia đình vào ban đêm.
- **Độ sáng dịu tương phản tốt**: Các chỉ số văn bản được ánh xạ hoàn hảo sang màu bạc xám tương phản tốt, không nhờ nhạt, kết hợp với các hiệu ứng hạt ánh sáng ẩn dụ lấp lánh (Glowing particles blend) chạy ngầm dưới giao diện.

### ⚙️ Điểm Nhấn Công Nghệ Đồng Nhất
- **CSS Custom Properties**: Hệ thống thiết lập giao diện hoàn toàn không làm suy giảm hiệu năng render do không dùng thêm tệp style phức tạp. Toàn bộ các thẻ UI nguyên bản (`bg-slate-950`, `text-slate-100`, `border-slate-850`) được giữ nguyên và tự động chuyển đổi màu sắc vật lý một cách nhịp nhàng thông qua biến thẻ nền của CSS v4.
- **Lưu trữ trạng thái (Persistence)**: Trạng thái theme ưa thích của từng thành viên trong gia đình sẽ được tự động ghi nhớ bền vững tại `localStorage`, giúp đồng nhất chế độ hiển thị mỗi khi truy cập lại từ bất kỳ trình duyệt nào.
- **Phông Chữ Chuyên Nghiệp**: Tích hợp phông chữ hiển thị hiện đại **Inter** cho các đề mục mượt mà cùng các chỉ số mono của **JetBrains Mono** giúp trực quan hóa tiền tệ và nhật ký máy chủ thêm phần tinh tế.

*Chúc gia đình bạn có những giây phút cộng tác và sinh hoạt thật thuận tiện, hạnh phúc cùng hệ thống **Family Organizer!** 🏡❤️*
