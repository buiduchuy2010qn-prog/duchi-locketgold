# Báo Cáo Cập Nhật Bảo Mật — Huy Locket

## Mục Tiêu Đạt Được

1. **Giới Hạn Tải Trọng (Payload Validation & Limit)**
   - Giới hạn kích thước payload `express.json()` cho tất cả API thông thường đã được giảm xuống mức an toàn **2 MB** (trước đây là 20 MB).
   - **Mạch Upload không bị ảnh hưởng**: Các luồng tải lên Media và Draft thông qua `express.raw()` đã được giữ nguyên (giới hạn 25MB cho media và 95MB cho draft).
   - Đã thêm middleware **kiểm tra Magic Bytes & MIME** (`validateUploadBuffer`) để phát hiện và chặn các tệp ngụy trang (giả mạo extension, sai lệch so với Content-Type).
   - Tự động cắt (truncate) các chuỗi dài trong body JSON (tối đa 10,000 ký tự) để chống Payload Bomb.

2. **Chống Brute Force & Rate Limit Thông Minh (Redis Backed + Fallback)**
   - **Auth (Đăng nhập, OTP, Đặt lại mật khẩu)**: 5 lần thất bại / 15 phút, kết hợp **IP + Username/Email/Phone**. Kẻ tấn công không thể khóa tài khoản của người dùng khác hoặc brute-force nhiều tài khoản từ một IP. Lỗi trả về luôn chung chung, không tiết lộ tài khoản tồn tại hay không.
   - **Refresh Token**: Mở rộng 30 req / 15 phút, đủ rộng cho cơ chế tự động làm mới của ứng dụng.
   - **Upload**: Tối đa 30 req / 15 phút mỗi người dùng đã xác thực.
   - **Tìm Nhạc**: 60 req / phút mỗi IP, đảm bảo luồng tìm kiếm trực tiếp qua từng phím gõ (debounce) không bị gián đoạn.
   - **Quản Trị (Admin)**: 60 req / phút (nghiêm ngặt hơn).
   - **API Chung**: 200 req / 15 phút.
   - Tự động tận dụng cấu hình kết nối Redis (pubClient) có sẵn trong dự án. Nếu Redis không khả dụng (môi trường không set biến `REDIS_URL`), Rate Limiter tự động fallback về bộ nhớ cục bộ mà **không gây crash server**.

3. **Gia Cố CSP (Content-Security-Policy) và Security Headers**
   - Đã cấu hình CSP ở chế độ **Report-Only**, cho phép phát hiện sớm vi phạm (nhúng thẻ script lạ, vv.) mà không làm gãy (break) các thành phần phức tạp như Camera, Blob stream, Firebase Firebase và API của Railway.
   - Áp dụng triệt để OWASP headers: HSTS (Strict-Transport-Security), Chống Clickjacking (`X-Frame-Options: SAMEORIGIN`), Ngăn MIME sniffing (`X-Content-Type-Options: nosniff`), tắt tính năng theo dõi phần cứng trong iframe (`Permissions-Policy`).

4. **Bảo Toàn Trải Nghiệm & Tính Năng Gốc**
   - Đã kiểm duyệt toàn bộ endpoint để bảo vệ API Contract.
   - Tuyệt đối không can thiệp vào logic giao diện Frontend, đặc biệt là module **Camera** và **Tìm kiếm Nhạc**.
   - Các API `GET` công khai (của Web UI) và `POST` nhạy cảm đã được bọc đúng lớp middleware mà không sửa đổi Controller.

## Các Hướng Mở Rộng Sau Này
- Nếu chuyển CSP từ `Report-Only` sang `Block`, cần đánh giá thêm log CSP tại server để đưa các script Firebase và WebRTC/blob url vào whitelist cụ thể.
- Hiện nay các route cũ (`/spotify`) đã được giới hạn đúng hạn mức `generalApiLimit`, song nếu Frontend hoàn toàn chuyển sang sử dụng API V3, có thể dần loại bỏ endpoints legacy.
