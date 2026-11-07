# Gộp 9 PR Điều hướng + email — 07/11/2026

Thọ: "Triển khai gộp nhé" (theo thứ tự đã chốt ở báo cáo của phiên khác). Chín PR do tài khoản `aodtsix-cmd` mở ngày 06–07/11, xếp thành **4 chuỗi chồng**; gộp **một lần** qua nhánh tích hợp (như #111, #130) để thử cả chín cùng nhau trước khi vào `main`.

| Thứ tự | PR | Nội dung | Chuỗi |
|---|---|---|---|
| 1 | #132 | Ô chọn (Môn học, Lớp/cấp, Lớp của tôi) thành nút chọn; báo lỗi gửi lại email xác thực | email |
| 2 | #133 | Xác thực email lúc đăng ký bằng **mã 6 số** (Gmail SMTP, dùng bảng `LoginCode`) | email (chồng #132) |
| 3 | #134 | Điều hướng A — Quản trị: đổi nhãn, bỏ link thừa, gỡ báo cáo hồ sơ khỏi Phễu | quản trị |
| 4 | #136 | Điều hướng B — Quản trị: Hôm nay một lối vào, gộp việc duyệt, báo cáo theo gia sư | quản trị (chồng #134) |
| 5 | #140 | Nhãn tab "Chương bài" | quản trị (chồng #136) |
| 6 | #135 | Điều hướng A — Học sinh (A2, A6, A9) | học sinh |
| 7 | #138 | Điều hướng B — Học sinh: gộp Bài tập vào Việc của tôi, ô Khác trên thanh dưới | học sinh (chồng #135) |
| 8 | #137 | Điều hướng A — Gia sư: chọn lớp ở Bài tập, một nút Tạo đề, thu gọn đường trùng | gia sư |
| 9 | #139 | Điều hướng B — Gia sư: Hộp việc là trang chủ duy nhất, ô Khác trên điện thoại | gia sư (chồng #137) |

Không đổi schema, không thêm phụ thuộc, không đổi `vercel.json`, không biến môi trường mới. Bốn chuỗi gộp **sạch** (kể cả commit `ModuleRail` có ở cả #138 và #139, nội dung giống nhau).

## Kiểm (bản tích hợp; Postgres 16 + Next dev + Chromium)
- `tsc --noEmit` 0 lỗi.
- **`ui-links-everywhere` 7/0.** **`ui-role-everything` 38/0** sau khi sửa hai chỗ của chính bài kiểm (xem dưới).
- Bài của từng PR: `t-admin-nav-lib` 30, `t-admin-ops-lib` 70, `t-admin-queue-lib` 91, `t-signup-code` 74, `ui-signup-code` 43, `t-resend-verification` 4, `t-tutor-routes-lib` 88, `ui-admin-courses` 35, `ui-admin-hom-nay` 17, `ui-admin-home-content` 32, `ui-admin-ops` 37, `ui-admin-tai-lieu` 13, `ui-bai-tap-hs` 17, `ui-cong-dong` 90, `ui-course-catalog` 39, `ui-lop-nhieu-lop` 70, `ui-plan` 38, `ui-quiz-tutor` 63, `ui-recruit` 27, `ui-register-tutor` 36, `ui-shell-everywhere` 18, `ui-student-pages` 42, `ui-student-schedule-link` 22, `ui-tao-lop-per-session` 20, `ui-tim-gia-su` 115, `ui-tutor-admin` 50, `ui-tutor-dash` 62, `ui-tutor-nav-b` 21, `ui-tutor-pending` 38, `ui-tutor-shell` 92, `ui-widgets` 18, `ui-journey-new-tutor` **51/0**. Hồi quy: `t-rail-lib` 91, `t-no-hex` 16, `t-no-fabricated` 45, `ui-exam-room` 82, `ui-home-signed-in` 52, `ui-account-menu` 30, `t-login-code` 61, `ui-login-code` 60, `t-session-verify` 25, `t-register-atomic` 32, `ui-journey-new-student` 17, `ui-auth-input-attrs` 26, `t-leaderboard-lib` 34, `ui-bang-xep-hang` 22, `t-enrollments-pending-api` 20.

## Còn đỏ — đã so với `main` sạch: không bài nào xấu đi
| Bài | Bản tích hợp | `main` sạch |
|---|---|---|
| `ui-funnel` | 33/2 | 33/2 (có sẵn) |
| `ui-host-flows` | 24/4 | 24/4 (có sẵn) |
| `ui-lop` | sập ở bước thêm khung giờ | sập y hệt (có sẵn) |
| `ui-sidebar` | dừng ở phần quản trị (tên miền admin) | y hệt |
| `ui-bai-tap-thu-vien` | 3 đỏ | 3 đỏ y hệt |
| `t-links` | 11/1 (4 liên kết báo giả) | y hệt |
| `ui-sidebar-rong` | 26/1 (ca 900px) | sập, 5 dòng đỏ — **tốt hơn** |
| `ui-student-shell` | 72/2 | sập (strict mode "HỌC SINH") — **tốt hơn** |
| `ui-tutor-everything` | 4 dòng đỏ (404 `/lop-cua-toi/x`, trang `/` trần…) | 5 dòng đỏ — **tốt hơn** |
| `ui-journey-new-tutor` | 51/0 sau sửa A4b | sập ở bước "bảng lớp" cũ — **tốt hơn** |

## Sửa thêm của tôi (chỉ bài kiểm, không đổi `src/`)
1. `ui-role-everything` — học sinh bấm liên kết gia sư `/lop-cua-toi/lop` bị đưa về `/lop-cua-toi` là **có chủ đích** (sau #137/#139 "Quản khoá" ở `/ban-do` trỏ `/lop-cua-toi/lop`): thêm `lop` vào bảng bí danh đã duyệt.
2. `ui-role-everything` — #135 (A6d) cho `ResultView` trỏ thẳng `/thi-thu`, bài còn tìm `/student/thi-thu`: nhận cả hai.
3. `ui-journey-new-tutor` bước A4b — lớp mới tạo chưa có học sinh nên dòng lớp hiện "Mời học sinh →" chứ không phải "Mở lớp →" (đúng thiết kế `LopHoc.tsx`); kiểm theo liên kết tên lớp tới `/lop-cua-toi/<lớp>`. Phía #139 cũng đã ghi bước này đỏ ở bản nền.

## Cần chủ biết (các PR đã ghi, vẫn mở sau khi gộp)
- **#139 — hai nguồn "đã thu":** Hộp việc của gia sư có thẻ "Đã thu tháng này" (từ `appliedAmount`) và thẻ "Đã thu" (từ API Hộp việc) có thể **lệch số**. Đây là hiển thị tiền, PR chỉ dời nguyên; chủ/COO quyết gộp sau.
- **#133 — xác thực email bằng mã 6 số:** mới kiểm bằng hộp thư giả (`EMAIL_SINK_DIR`), **chưa gửi được thư Gmail thật** nên chưa biết thư có vào hộp chính hay Spam. Đăng ký trùng email vẫn trả 409 "Email này đã được đăng ký" (lộ email đã có — cần quyết định sản phẩm). Chưa rõ vì sao thư đăng ký cũ không tới (xem hộp Thư đã gửi của tài khoản `GMAIL_USER` / log Vercel).
- **#136:** badge của vỏ Quản trị đếm đúng các loại trong Hàng chờ; Gói Pro và Hỗ trợ gia sư giữ dòng riêng nhưng vẫn tính vào tổng "việc đang chờ" của Hôm nay.
- Việc dọn ~119 nhánh cũ: xem `nhanh-da-xoa-06-11-2026.md` (cần chạy `tools/xoa-nhanh-rac.sh --apply` bằng tài khoản có quyền).
