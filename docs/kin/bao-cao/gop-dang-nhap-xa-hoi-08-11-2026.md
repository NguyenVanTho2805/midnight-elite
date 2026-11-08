# Gộp 3 PR: Lớp miễn phí + Đăng nhập Google/Facebook + Thu hồi phiên cũ — 08/11/2026

Thọ: "triển khai luôn nhé" (sau báo cáo của phiên khác về #148–#150). Ba PR do tài khoản `aodtsix-cmd` mở ngày 08/11, gộp **một lần** qua một PR tích hợp (commit gộp, không squash):

| Thứ tự | PR | Nội dung | Đáy khi mở |
|---|---|---|---|
| 1 | #149 | Lớp miễn phí: có sẵn mã lớp + lối tìm lớp cho học sinh | `main` |
| 2 | #148 | Học sinh: "Tiếp tục với Google" và "Tiếp tục với Facebook" | `main` |
| 3 | #150 | Học sinh: gỡ nốt lối vào cũ sau khi chiếm lại tài khoản (push, phiên JWT, đặt lại mật khẩu) | `claude/hoc-sinh-dang-nhap-google` (đáy của #148) |

Ba nhánh gộp **sạch, không xung đột**. #150 đúng là xếp chồng trên đầu hiện tại của #148 (không có commit lạc).

## Schema (chỉ thêm)
Ba cột `User`, đều nullable: `googleSub String? @unique`, `facebookId String? @unique`, `sessionsValidAfter DateTime?`. Hai ràng buộc duy nhất là **ngoại lệ chủ đã được báo** (Thọ "triển khai luôn" sau báo cáo nêu rõ). Bản production tự đẩy schema ở bước build (`scripts/db-push-on-production.mjs`); ngoại lệ hẹp `@unique` trên cột mới có sẵn từ PR #54 (`db-push-guard.mjs`, `t-db-push-guard` 28/0). Không phụ thuộc mới, không đổi `vercel.json`, không đổi tiền.

## Mặc định khi gộp: tính năng xã hội TẮT
Nút "Tiếp tục với Google/Facebook" chỉ hiện khi có **cả hai** biến của từng nhà cung cấp (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`; `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET`). Chưa đặt biến ⇒ nút ẩn, `/api/auth/*/start` đưa về `/dang-nhap`, không lỗi (đã xác nhận: `t-google-auth`/`t-facebook-auth` chạy trên máy chủ KHÔNG có khoá cho kết quả đúng như thiết kế; `ui-social-buttons` kiểm cả hai trạng thái). Nên gộp lên không đổi gì với người dùng cho tới khi chủ đặt khoá.

## Kiểm (bản tích hợp; Postgres 16 + Next dev + Chromium)
- `tsc --noEmit` 0 lỗi (chạy riêng). Schema nạp được vào DB trống: 127 bảng, đủ 3 cột và 2 chỉ mục duy nhất `users_googleSub_key`, `users_facebookId_key`.
- Bài thuần + API (tuần tự), **0 đỏ**: `t-facebook-lib` 32 · `t-google-lib` 54 · `t-session-verify-lib` 26 · `t-session-policy-lib` 20 · `t-login-throttle-lib` 37 · `t-login-code-lib` 43 · `t-password-reset-lib` 31 · `t-db-push-guard` 28 · `t-no-hex` 16 · `t-auth-input-attrs` 15 · `t-session-revoke` 33 · `t-session-verify` 25 · `t-session-role-sync` 37 · `t-session` 35 · `t-password-reset` 59 · `t-invites` 17 · `t-login-password` 41 · `t-login-phone` 56 · `t-login-code` 61 · `t-register-atomic` 32 · `t-resend-verification` 4 · `t-signup-code` 75 · `t-free-class-fee` 33 · `t-join-request` 120 · `t-enrollments-pending-api` 20 · `t-community-api` 512 · `t-course-teachers` 233 · `t-exam-attack` 53 · `t-student-todo` 36.
- Với máy chủ có khoá GIẢ (Google ở cổng 3199, Facebook ở 3198): `t-google-auth` 79 · `t-facebook-auth` 56 · `ui-social-buttons` 34 — 0 đỏ.
- Trình duyệt (máy chủ không khoá, đúng cấu hình production lúc mới gộp), 0 đỏ: `ui-lop-mien-phi` 24 · `ui-shell-everywhere` 18 · `ui-login-password` 47 · `ui-login-code` 60 · `ui-password-reset` 38 · `ui-signup-code` 43 · `ui-auth-input-attrs` 26 · **`ui-links-everywhere` 7/0** · **`ui-role-everything` 38/0**.

## Sửa bài kiểm (chỉ `tools/local-e2e`, không đổi mã sản phẩm)
`t-signup-code` ca "đã xác thực rồi → 400": sau #150, xác minh email đặt mốc thu hồi phiên ở **giây nguyên kế tiếp** (`sessionsValidAfter`); cookie do bài tự ký ngay sau đó (cùng giây) có `iat` nhỏ hơn mốc nên bị coi là phiên cũ và trả **401**, không phải 400 (đã đo: 401 trước mốc, 400 sau mốc). Người thật không gặp vì chính bước xác minh cấp cho họ phiên mới có `iat` = mốc. Bài giờ kiểm cả hai: cùng giây → 401, chờ 2,1 giây → 400. 75/0.

## Còn đỏ — đã so với `main` sạch (`d46b966`): không bài nào xấu đi
| Bài | Bản tích hợp | `main` sạch |
|---|---|---|
| `ui-student-shell` | 73/2 (nhãn vai "HỌC SINH"; `aria-current`) | 72/2 y hệt (có sẵn; thêm 1 ca xanh) |
| `ui-sidebar-rong` | 26/1 (ca 900px) | 26/1 y hệt |
| `ui-session-role-sync` | 6/1 (gia sư chưa duyệt vẫn thấy thanh module) | 6/1 y hệt |

## Cần chủ biết (đã ghi trong PR; sau gộp vẫn mở)
1. **Đặt khoá thì tính năng mới bật.** Tạo OAuth client Google và app Facebook, rồi đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (và tuỳ chọn `*_REDIRECT_URI`) trên Vercel production. Redirect: `/api/auth/google/callback`, `/api/auth/facebook/callback`. App Facebook phải ở chế độ **Live** và có quyền `email`. **Bước đổi mã Facebook chưa từng thử với Graph thật** (chỉ Facebook giả): thử một lần trước khi quảng bá.
2. **Hai việc chờ chủ quyết** (hành vi của #148/#150, chưa đổi):
   - Tài khoản tạo bằng Facebook: khi người thật xác minh email, liên kết Facebook bị gỡ và các thiết bị khác bị đá ra.
   - Kẻ đăng ký trước mà biết mật khẩu: xác minh email **không đổi mật khẩu**, nên sau đó họ vẫn đăng nhập lại được.
3. **Hai việc nhỏ trong ghi chú PR:** liên kết phụ huynh do tài khoản của kẻ chiếm trước dựng lên chưa được xử lý (dữ liệu trẻ em); gỡ `portalToken` có thể làm chết liên kết xem sổ mà gia sư đã phát cho phụ huynh thật.
4. **Chi phí hiệu năng của #150:** mọi yêu cầu **đọc** của người đã đăng nhập (trang server, API GET) giờ thêm tối đa **một truy vấn theo khoá chính** để kiểm `sessionsValidAfter` (nhớ theo yêu cầu, nên không quá một lần mỗi lượt). Nếu DB lỗi, phiên được coi như chưa đăng nhập (không ném 500, không xoá cookie). Theo dõi độ trễ trang sau khi lên; nếu thấy chậm, báo tôi.
- Việc dọn ~119 nhánh cũ vẫn cần chạy `tools/xoa-nhanh-rac.sh --apply` bằng tài khoản có quyền.
