# Gộp 5 PR Đồng giảng + Lịch kéo thả + Quản trị — 07/11/2026

Thọ: "triển khai nhé" (theo thứ tự đã chốt ở báo cáo của phiên khác). Năm PR do tài khoản `aodtsix-cmd` mở ngày 07/11, gộp **một lần** qua một PR tích hợp (gộp bằng commit gộp, không squash):

| Thứ tự | PR | Nội dung | Đáy khi mở |
|---|---|---|---|
| 1 | #142 | Quản trị xoá (ẩn danh hoá) tài khoản học sinh/gia sư, nâng học sinh lên gia sư | `main` |
| 2 | #143 | Đồng giảng: chủ nhiệm (GVCN) và giáo viên bộ môn — bảng `CourseTeacher` | `main` |
| 3 | #144 | Lịch lớp kéo thả; lịch bắt buộc khi tạo lớp | `main` |
| 4 | #145 | Quản trị theo sau #143/#144: chặn ghi danh tài khoản gia sư, tab Lịch học admin dùng `LichKhung`, mã chặn xoá `co_teaching_active` | `main` |
| 5 | #146 | Cộng đồng lớp có đồng giảng (giấu tên với học viên) + route học sinh chặn gia sư | `claude/gia-su-dong-giang` (đáy của #143) |

Điểm cần biết khi gộp:
- **#145 và #146 được dựng trên bản CŨ của #143/#144** (#143 có thêm 7 commit, #144 thêm 2 commit sau đó). Gộp bằng git vẫn ra kết quả đúng, nhưng phải giải 3 chỗ xung đột (xem dưới) và phải chạy lại mọi bài trên bản tích hợp.
- **Schema chỉ thêm:** bảng `course_teachers` + 3 cột `teacherId` / `taughtBy` (đều `String?`, không FK). Không đổi cột cũ, không thêm phụ thuộc, không đổi `vercel.json`, không biến môi trường mới. Bản production chạy `scripts/db-push-on-production.mjs` (có chốt chỉ-thêm) nên tự đẩy schema ở lần build.
- Không đổi phần tiền (học phí, phiếu thu); không bật cờ nào.

## Xung đột đã giải
1. `docs/kin/tien-do-dang-do.md`, `docs/kin/phong-ban/SO-VIEC.md` — các mục ghi sổ độc lập của từng PR: giữ cả hai; riêng mục #143 lấy bản "lượt 2" (mới hơn).
2. `src/components/tutor/LopChiTiet.tsx` — #144 thêm khối nhắc "Lớp chưa có lịch học" và `lichHref`; #143 giới hạn nhiều khối theo vai (`mgr`). Giữ cả hai và **đặt khối nhắc lịch sau `mgr &&`** (đồng giảng không sửa được lịch nên không hiện nút "Đặt lịch").

## Lỗi chỉ lộ ra khi ghép — đã sửa trong PR tích hợp
- **`PUT /api/class-schedules/<id có byte NUL>` trả 500** (bài `t-schedule-drag-api` đỏ 1 ca; trên nhánh #144 riêng là 120/0). Nguyên nhân: #143 chuyển việc tra khung giờ ra *ngoài* khối `try` của route (`requireScheduleAccess`), nên lỗi Postgres `22021` (byte NUL) không còn bị bắt như ở #144 (khi đó trả 400). Sửa ở `src/lib/courseAccessServer.ts`: id không dùng được (NUL, rỗng, quá 200 ký tự) ⇒ 404 ngay, không chạm DB, ở `loadCourseAccess`, `requireScheduleAccess`, `requireAttendanceSessionAccess`; `requireCourseAccessBy` bắt riêng lỗi `22021` (lỗi DB khác vẫn ném tiếp, không giấu thành 404). Thăm dò 6 route khác với id NUL: không còn 500.

## Sửa bài kiểm (chỉ `tools/local-e2e`, không đổi mã sản phẩm)
1. `t-adm-enroll-tutor` (của #145, chưa từng chạy): 3 ca giả định `admin_content` ghi danh được, nhưng `admin_content` **không có** quyền `MANAGE_STUDENTS` (ma trận quyền có từ trước) nên route trả 403 là đúng. Đổi ca 3 và 4c thành "403 ở tầng quyền", ca 4b gọi bằng `admin_super`. 13/0.
2. `ui-admin-lich-khung` (của #145, chưa từng chạy): `getByText("Toán 9 khung").first()` bấm trúng nhãn bộ lọc `?q=` nên bảng bên không mở; đổi sang nút "Sửa nhanh: Toán 9 khung". 12/0.

## Kiểm (bản tích hợp; Postgres 16 + Next dev + Chromium)
- `tsc --noEmit` 0 lỗi (chạy riêng, không song song với máy chủ).
- Schema: sinh DDL từ DMMF và nạp vào DB trống, 127 bảng, có `course_teachers`.
- Bài thuần + API, tuần tự: `t-schedule-drag-lib` 85 · `t-schedule-drag-api` 120 · `t-schedule-api` 26 · `t-tutor-inbox` 37 · `t-tutor-inbox-lib` 49 · `t-course-validate` 34 · `t-free-class-fee` 33 · `t-hocphi-dashboard` 41 · `t-course-access-lib` 303 · `t-course-teachers` 233 · `t-giao-trinh-lib` 221 · `t-giao-trinh` 78 · `t-join-request-lib` 71 · `t-join-request` 120 · `t-db-push-guard` 28 · `t-no-hex` 16 · `t-hs-dong-giang` 102 · `t-community-api` 512 · `t-attempt-suspended-api` 102 · `t-student-todo` 36 · `t-enrollments-pending-api` 20 · `t-exam-attack` 53 · `t-lesson-visibility` 82 · `t-suspended-content-api` 61 · `t-tut-003` 28 · `t-exam-practice` 28 · `t-exam-variants-hs` 35 · `t-stu-001` 48 · `t-quiz-hs` 63 · `t-assign-contract` 29 · `t-adm-xoa-tk-lib` 62 · `t-adm-xoa-tk` 129 · `t-adm-enroll-tutor` 13 — **tất cả 0 đỏ**.
- Trình duyệt: `ui-prefs-makeup` 17 · `ui-course-teachers` 65 · `ui-course-teachers-2` 52 · `ui-tutor-shell` 92 · `ui-schedule-drag` 69 · `ui-schedule` 59 · `ui-schedule-fit` 19 · `ui-lich-rieng` 28 · `ui-tao-lop-wizard` 40 · `ui-tao-lop-per-session` 20 · `ui-adm-xoa-tk` 35 · `ui-admin-lich-khung` 12 · **`ui-links-everywhere` 7/0** · **`ui-role-everything` 38/0** — 0 đỏ.
- Lần đầu có 3 bài trình duyệt đỏ do máy chủ thử khởi động lạnh (`ui-course-teachers`, `ui-tao-lop-per-session`, `ui-schedule`); chạy lại riêng đều xanh. Một lần `ui-role-everything` đỏ 30 ca vì Turbopack không tải được font Google Inter lúc khởi động (mọi trang 500, kể cả `/`) — lỗi môi trường, khởi động lại là hết.

## Còn đỏ — đã so với `main` sạch (`20c5341`): không bài nào xấu đi
| Bài | Bản tích hợp | `main` sạch |
|---|---|---|
| `t-attendance-export-lib` | 46/1 | 46/1 (có sẵn) |
| `t-unmarked-daily-lib` | 21/2 | 21/2 (có sẵn) |
| `t-unmarked-lib` | 30/1 | 30/1 (có sẵn) |
| `t-adm-001-lib` | 31/1 | 31/1 (có sẵn) |
| `t-quiz-cham` | 55/1 | 55/1 (có sẵn) |
| `t-links` | 11/1 (4 liên kết báo giả) | y hệt |
| `ui-ht02-forms` | sập ở ô "Theo giờ" của bước tạo lớp | sập y hệt (có sẵn) |
| `ui-tutor-everything` | 18/4: 404 `/lop-cua-toi/x`, trang `/` trần (có sẵn) + 2 lần 403 `POST /api/followed-courses` (mới, do #146 — xem dưới) | 18/4: 404 `/lop-cua-toi/x`, trang `/` trần |

## Cần chủ biết
- **Gia sư bấm "Theo dõi" ở `/khoa-hoc` nhận 403** (`POST /api/followed-courses/<id>`): #146 (H4) chặn route học sinh với tài khoản gia sư nhưng nút vẫn hiện. Không lộ dữ liệu; chỉ là nút bấm không có tác dụng. Nợ P3 cho phòng Học sinh.
- **Còn nợ của từng PR** (đã ghi trong sổ): lời mời `invited` treo vào tài khoản đã ẩn danh (#142/#145); ô "Người dạy" trong khung lịch nằm ở nhánh phụ `claude/dong-giang-lich-nguoi-day` (chưa có PR; cần #143 và #144 vào `main` trước — nay đã đủ điều kiện); đồng giảng chưa có lối vào lưới lịch.
- **Câu hỏi TIỀN còn chờ chủ** (mặc định đã duyệt: Q1 giữ phí · Q2 đồng giảng chỉ đề nghị chốt): thời hạn lưu hồ sơ pháp lý khi ẩn danh hoá (#142).
- Việc dọn ~119 nhánh cũ vẫn cần chạy `tools/xoa-nhanh-rac.sh --apply` bằng tài khoản có quyền.
