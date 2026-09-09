# Lộ trình triển khai — 12 giai đoạn, 61 đầu việc

> Bản checklist gốc (có lưu tiến độ, sao chép trạng thái) nằm ở artifact "Lộ Trình Triển Khai Tsix".
> File này là bản tĩnh để theo dõi trực tiếp trên GitHub — tick `[x]` khi hoàn thành và commit lại.
>
> Thứ tự giai đoạn theo đúng phụ thuộc kỹ thuật: **Migration đa-gia-sư phải xong trước** khi làm bất
> kỳ tính năng nào khác; **Coin/thanh toán chỉ làm sau khi lớp học và tài liệu đã chạy được**.
> `P0` = bắt buộc để ra mắt · `P1` = làm ngay sau khi có người dùng đầu tiên · `QA` = kiểm thử/pháp lý.

## 00. Chuẩn bị & pháp lý `QA`

Không code — chốt các quyết định nền trước khi đụng vào schema.

- [ ] Khoanh vùng `files/*.md` cũ thành "legacy", ghi rõ không dùng cho định hướng hiện tại
- [ ] Soạn Điều khoản dịch vụ mới: chỉ thu phí gia sư, không giữ hộ học phí gia sư–học viên
- [ ] Soạn mẫu "Yêu cầu xác nhận của phụ huynh" theo Nghị định 13/2023, áp dụng học viên dưới 16 tuổi
- [ ] Đăng ký tài khoản merchant với 1 cổng thanh toán VN (PayOS/VNPay/Momo) để nhận nạp Coin
- [ ] Chốt bảng quy đổi Coin ↔ VNĐ và danh sách Plan (tối thiểu: Free giới hạn + 1 gói trả phí dưới 20k/tháng)
- [ ] Chốt hạn mức lưu trữ (`storageQuotaMb`) theo từng Plan

## 01. Migration đa-gia-sư `P0`

Nền tảng kỹ thuật — mọi tính năng khác đều phụ thuộc vào giai đoạn này.

- [ ] Backup database Neon hiện tại trước khi đổi schema
- [ ] Thêm giá trị `"tutor"` và `"parent"` vào `User.role`
- [ ] Đổi `Course.adminId` (unique) → `Course.tutorId` (bỏ `@unique`), viết migration chuyển dữ liệu cũ
- [ ] Thêm `Course.inviteCode` (unique) và hàm `generateInviteCode()`
- [ ] Cập nhật `permissions.ts`: mọi truy vấn Course/Exam/Assignment lọc theo `tutorId` đang đăng nhập
- [ ] Cập nhật `proxy.ts`: thêm điều kiện route riêng cho vai trò `tutor` và `parent`
- [ ] Regression test: toàn bộ luồng admin cũ vẫn chạy đúng sau migration

## 02. Model dữ liệu mới (Prisma) `P0`

5 bảng mới từ ERD, cộng phần tổng quát hoá tài liệu.

- [ ] Thêm model `ParentLink` (parentUserId, studentUserId, relation)
- [ ] Thêm model `ParentConsent` (enrollmentId, parentUserId, status, decidedAt)
- [ ] Thêm model `Plan` (name, coinCostPerMonth, storageQuotaMb, maxStudents)
- [ ] Thêm model `Subscription` (tutorId, planId, status, startDate, endDate)
- [ ] Thêm model `PaymentTransaction` (userId, amountVnd, gateway, status, paidAt)
- [ ] Thêm `CoinTransaction.refId` để liên kết PaymentTransaction/Subscription
- [ ] Tổng quát hoá `ExamFileFolder/ExamFile` → `DocumentFolder/Document` dùng chung mọi loại tài liệu
- [ ] Chạy `prisma migrate dev`, generate client, cập nhật `seed.ts`/`seed-users.ts` cho dữ liệu test

## 03. Gia sư tự đăng ký & mở lớp `P0`

Vòng lặp lõi đầu tiên — không cần các phần sau vẫn demo được.

- [ ] Trang đăng ký gia sư tự phục vụ (self-serve, không cần Admin duyệt hồ sơ)
- [ ] Form tạo lớp học (tên, môn, mô tả, lịch dạy ban đầu)
- [ ] Sinh mã mời/link mời lớp, trang "sao chép link mời"
- [ ] Trang "Lớp của tôi" — danh sách lớp gia sư đang quản lý

## 04. Mời học viên & Consent phụ huynh `P0`

Nhánh pháp lý quan trọng nhất trong toàn bộ hệ thống — không được bỏ qua bước nào.

- [ ] Trang học viên nhập mã mời / click link mời
- [ ] Form khai ngày sinh khi học viên tạo tài khoản hoặc tham gia lớp
- [ ] Logic kiểm tra tuổi: dưới 16 → bắt buộc consent, từ 16 trở lên → vào thẳng
- [ ] Luồng gửi yêu cầu xác nhận tới phụ huynh (email chứa link xác nhận)
- [ ] Trang phụ huynh xác nhận đồng ý / từ chối (không bắt buộc có tài khoản đầy đủ)
- [ ] Kích hoạt Enrollment sau khi đủ điều kiện, gửi thông báo cho gia sư

## 05. Tài liệu & AI chuẩn hoá `P0`

Lợi thế cạnh tranh chính đã chốt — khác Azota (không cần đúng mẫu) và Shub (gắn liền buổi học).

- [ ] Trang upload tài liệu tổng quát cho gia sư (không giới hạn ở đề thi)
- [ ] Mở rộng `aiExamImport.ts` nhận thêm định dạng: ảnh chụp tay, docx (mammoth), pdf (pdfjs-dist)
- [ ] Lưu file gốc lên Cloudinary, lưu bản đã chuẩn hoá vào Document/DocumentFolder
- [ ] Trang xem tài liệu cho học viên, sắp xếp theo buổi học (ClassSchedule)
- [ ] Cơ chế bảo vệ tài liệu (watermark / giới hạn tải / chỉ xem online) theo lựa chọn của gia sư

## 06. Lịch dạy, điểm danh, bài tập `P0`

Tái dùng phần lớn model đã có (`Assignment`, `AssignmentSubmission`, `examGrading.ts`).

- [ ] Form tạo/sửa `ClassSchedule` gắn theo Course của từng gia sư
- [ ] Mở rộng cron `remind-class`/`remind-exam` sang đa-gia-sư (theo từng lớp, không chỉ 1 admin)
- [ ] Chức năng điểm danh buổi học
- [ ] Giao bài tập, học viên nộp bài, gia sư chấm điểm

## 07. Coin: nạp – dùng – thưởng `P0`

Thay thế hoàn toàn mô hình thuê bao trừ tiền tự động bằng nạp trước – trừ dần.

- [ ] Trang "Nạp Coin" — chọn mệnh giá, gọi cổng thanh toán tạo mã QR
- [ ] Webhook xác nhận thanh toán → PaymentTransaction SUCCESS → CoinTransaction (+amount, reason=topup)
- [ ] Job tự động trừ Coin khi tới kỳ gia hạn lớp (theo Plan.coinCostPerMonth)
- [ ] Cảnh báo gia sư khi Coin sắp hết trước ngày gia hạn
- [ ] Xử lý khi không đủ Coin: cho thời gian ân hạn rồi mới tạm khoá tính năng lớp
- [ ] Trang lịch sử giao dịch Coin, tách rõ theo reason (topup / class_renewal / activity_reward)
- [ ] Cơ chế kiếm Coin thưởng qua hoạt động (điểm danh đều, được đánh giá tốt...)

## 08. Thông báo & theo dõi phụ huynh `P0`

Phần "giữ liên lạc với phụ huynh" trong câu định vị sản phẩm.

- [ ] Trang phụ huynh xem tiến độ con (điểm, điểm danh, bài tập)
- [ ] Email tự động khi có sự kiện quan trọng (điểm mới, deadline, lớp mới tham gia)
- [ ] (P1) Tích hợp Zalo OA API làm kênh thông báo thay/thêm cho email

## 09. Hồ sơ, đánh giá, cộng đồng `P1`

Làm sau khi có traction — bù cho hàng rào xác minh gia sư thấp.

- [ ] Trang hồ sơ công khai gia sư (đánh giá, số học viên, môn dạy)
- [ ] `CourseReview`: học viên đánh giá sau khi tham gia lớp
- [ ] Mở rộng phạm vi hiển thị Thread/ThreadReply cho tương tác liên lớp

## 10. QA, bảo mật, pháp lý trước ra mắt `QA`

Không bỏ qua — đặc biệt hai luồng consent và Coin vì đụng tới trẻ vị thành niên và tiền thật.

- [ ] Kiểm thử đầy đủ luồng consent (case: dưới 16 từ chối / đồng ý, từ 16 bỏ qua)
- [ ] Kiểm thử luồng Coin (webhook lỗi, số dư không đủ, trừ trùng do race condition)
- [ ] Chạy security-review cho luồng thanh toán và consent mới
- [ ] Rà điều khoản dịch vụ / chính sách bảo mật lần cuối trước khi công bố
- [ ] Archive chính thức `files/*.md` cũ, ghi rõ "legacy"

## 11. Go-to-market MVP `P1`

Chỉ bắt đầu sau khi Phase QA xong — ưu tiên hiện tại là có người dùng, không phải tính năng mới.

- [ ] Landing page định vị mới ("giá chưa bằng một ly cà phê đen")
- [ ] Kênh tuyển gia sư đầu tiên: cộng đồng sinh viên / nhóm hợp tác
- [ ] Thiết lập theo dõi KPI: số gia sư đăng ký, số lớp mở, tỷ lệ nạp Coin, retention
