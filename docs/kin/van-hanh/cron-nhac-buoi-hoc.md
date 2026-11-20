# Đăng ký cron "Email nhắc trước giờ học" trên cron-job.org

Tính năng: gia sư vào lớp → Cài đặt → **Học online**, dán link Google Meet và chọn "Gửi email nhắc học sinh trước buổi học" (Tắt / 15 phút / 1 giờ / 1 ngày).
Máy chủ có sẵn đường dẫn `/api/cron/nhac-buoi-hoc`; cần một dịch vụ bên ngoài **gọi nó mỗi 15 phút**.

Vì sao không dùng Vercel Cron: gói Vercel thường (Hobby) chỉ cho cron chạy **mỗi ngày một lần**; lịch `*/15 * * * *` trong `vercel.json` sẽ bị từ chối khi triển khai.
Vì vậy đường dẫn này **không** có trong `vercel.json`. Nếu sau này lên gói Pro thì có thể chuyển vào `vercel.json` (xoá tác vụ bên cron-job.org để khỏi gọi hai nơi; gọi hai nơi cũng không gửi trùng thư, chỉ tốn lượt).

## Trước khi bắt đầu
- Biến môi trường `CRON_SECRET` trên Vercel (Production) phải có sẵn và dài **từ 16 ký tự trở lên** (các cron khác cũng dùng biến này). Thiếu biến ⇒ đường dẫn trả 503; sai khoá ⇒ 401.
- Gmail gửi thư: `GMAIL_USER`, `GMAIL_APP_PASSWORD` như các thư nhắc khác.
- Biết địa chỉ trang thật, ví dụ `https://<tên-miền-chính>`.

## Các bước trên cron-job.org
1. Vào https://cron-job.org, tạo tài khoản miễn phí, đăng nhập → **Create cronjob**.
2. **Title**: `KiN nhắc trước giờ học`.
3. **URL**: `https://<tên-miền-chính>/api/cron/nhac-buoi-hoc`
   (KHÔNG thêm `?dryRun=1` — đó là chế độ thử, không gửi thư.)
4. **Execution schedule**: chọn *Every 15 minutes* (hoặc tuỳ chỉnh: phút `0,15,30,45`, mọi giờ, mọi ngày).
5. Mở **Advanced**:
   - **Request method**: `GET` (POST cũng được, máy chủ nhận cả hai).
   - **Headers** → *Add header*: Key `Authorization`, Value `Bearer <giá trị CRON_SECRET>` (chữ `Bearer`, một dấu cách, rồi khoá; không có dấu ngoặc).
   - **Timeout**: 30 giây (hoặc tối đa gói miễn phí cho phép).
   - **Time zone**: `Asia/Ho_Chi_Minh` (không bắt buộc — máy chủ tự tính theo giờ Việt Nam).
   - Bật **Notify me on failure** để nhận email khi máy chủ trả lỗi.
6. **Save**. Bấm **Test run**: kết quả phải là `200` và thân trả về dạng `{"dryRun":false,"due":0,"sent":0,...}`.

## Kiểm tra sau khi đăng ký
- Thử khô (không gửi thư, không ghi gì) từ máy mình:
  ```
  curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<tên-miền-chính>/api/cron/nhac-buoi-hoc?dryRun=1"
  ```
  `due` = số buổi đang tới hạn nhắc, `sent` = số thư sẽ gửi. Phản hồi không có tên hay email học sinh.
- Trang quản trị **Triển khai** có dòng "Email nhắc học sinh trước giờ học · Mỗi 15 phút (cron-job.org)". Quá **1 giờ** không thấy gọi ⇒ hiện "Chậm so với lịch": xem lại tác vụ bên cron-job.org (bị tắt sau nhiều lần lỗi, khoá đổi…).

## Máy chủ làm gì mỗi lần được gọi
- Tìm các buổi học sắp tới (khung giờ tuần đã tính dời / huỷ, cộng buổi lẻ / dạy bù / phát sinh) của các lớp đã bật nhắc và không tạm ngừng.
- Buổi "tới hạn" khi *giờ bắt đầu − thời gian nhắc* rơi vào 20 phút vừa qua và buổi chưa bắt đầu. Cửa sổ 20 phút > nhịp 15 phút nên một lần gọi trễ vài phút không làm sót buổi.
- Gửi email tới học sinh **đang học** của lớp (không gửi em chờ phụ huynh xác nhận, em tạm dừng, em đã báo nghỉ buổi đó, tài khoản bị khoá / đã xoá). Thư có tên lớp, ngày giờ, link vào học (riêng buổi > khung giờ > chung lớp; buổi học trực tiếp thì không có link). **Không có số tiền.**
- Mỗi học sinh nhận **tối đa một thư cho mỗi buổi** (bảng `class_lesson_reminder_logs`, ghi trước khi gửi). Gửi lỗi thì xoá dòng để lần gọi sau thử lại nếu còn trong cửa sổ.
- Tối đa 200 thư mỗi lần gọi; phần còn lại đi ở lần gọi sau (nếu buổi vẫn trong cửa sổ).

## Lưu ý
- Thư nhắc 07:00 hằng ngày (`/api/cron/remind-class`, Vercel Cron) vẫn chạy như cũ và nay có thêm dòng link học online. Lớp chọn "1 ngày" thì thư 07:00 BỎ QUA lớp đó (học sinh chỉ nhận thư trước 24 giờ), nên nếu cron-job.org ngừng gọi thì lớp "1 ngày" không còn thư nhắc nào — theo dõi dòng "Email nhắc học sinh trước giờ học" ở trang Triển khai.
- Đổi `CRON_SECRET` trên Vercel thì phải sửa header ở cron-job.org ngay, nếu không mọi lần gọi trả 401.
