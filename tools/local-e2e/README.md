# Bộ test chạy với Postgres + Next dev + Chromium thật

Đây là bản lưu của bộ test dùng trong lúc dựng các việc TT-199..203, NV-188/189, PH-207..216/223, FE-139/140/141..164/157/158, BE-074..076 (11–12/10/2026).
Trước đây nằm ở `scratchpad/` (bị gitignore nên mất theo container) — giữ ở đây để phiên sau chạy lại được.

**Không chạy trên DB thật.** `h.ts` có hàm `wipe()` TRUNCATE mọi bảng.

## Cần có
- Postgres 16 cục bộ (không cần pgvector: đổi `vector(768)` thành `text` khi dựng schema thử), cổng bất kỳ.
- `DATABASE_URL` trỏ vào DB thử, `SESSION_SECRET` giả — xem `env.example.sh`.
- Schema đã đẩy vào DB thử (`prisma db push`, hoặc cách WASM nếu máy chặn binaries.prisma.sh).
- Next dev ở cổng 3100 (`dev-start.sh`), trình duyệt Chromium (`ui.ts` trỏ đường dẫn Playwright — sửa cho khớp máy).
- Test đăng nhập bằng mã email (`t-login-code`, `ui-login-code`) cần `EMAIL_SINK_DIR` (có trong `env.example.sh`): server dev phải khởi động SAU khi đã `source` env để thư được ghi thành tệp JSON thay vì gửi đi.
- Trang admin cần ánh xạ tên miền `admin.midnightelite-edu.com` về 127.0.0.1 (đã làm trong tham số Chromium ở `ui.ts`) và `allowedDevOrigins` trong `next.config.ts`.

## Chạy
```
cp tools/local-e2e/env.example.sh tools/local-e2e/env.sh   # rồi sửa mật khẩu
source tools/local-e2e/env.sh
npx tsx tools/local-e2e/t-absence.ts        # API: báo nghỉ / buổi bù
npx tsx tools/local-e2e/ui-schedule.ts      # trình duyệt: Lịch, nhắc, module
```
Tên file: `t-*.ts` = logic thuần + API; `ui-*.ts` = trình duyệt. Mỗi file in `N pass / M fail`.

## Lưu ý đã gặp
- Sau khi đổi schema phải `prisma generate` rồi KHỞI ĐỘNG LẠI Next dev (nó giữ Prisma client cũ → 500).
- Bộ giới hạn tốc độ nhớ theo token trong bộ nhớ server: test cổng phụ huynh dùng token ngẫu nhiên mỗi lần chạy.
- `ctx.on("page")` phải đăng ký SAU khi tạo trang chính, nếu không trang chính bị coi là cửa sổ bật lên.
- `getByRole("alert")` dính cả bộ thông báo tuyến của Next; dùng locator theo chữ.

## Danh sách test (số kiểm tra, 12/10/2026)
- Lib thuần (`t-*-lib.ts`, `t-todo-lib`, `t-class-sessions`...): `t-correction-lib`, `t-monthly-lib`, `t-invoice-zalo-lib`, `t-funnel-lib`, `t-plan-lib`, `t-invoice-lib`, `t-revenue-lib`, `t-score-lib`, `t-session-change-lib`.
- API (`t-*.ts`): `t-absence`, `t-analytics`, `t-core-regression`, `t-correction`, `t-course-ops`, `t-invites`, `t-makeup`, `t-monthly`, `t-prefs`, `t-reminders`, `t-schedule-api`,
  `t-tt200`, `t-tutor-apps`, `t-tutor-revenue`, `t-invoice-zalo`, `t-funnel`, `t-recruit`, `t-connections`, `t-plan`, `t-categories`, `t-score`, `t-session-change`.
- Trình duyệt (`ui-*.ts`): `ui-correction`, `ui-course-ops`, `ui-invite-input`, `ui-portal-absence`, `ui-prefs-makeup`, `ui-revenue`, `ui-schedule`, `ui-tt200`, `ui-tutor-apps`, `ui-tutor-dash`, `ui-widgets`,
  `ui-monthly`, `ui-invoice-zalo`, `ui-attendance-zalo`, `ui-funnel`, `ui-recruit`, `ui-connections`, `ui-plan`, `ui-admin-community`, `ui-categories`, `ui-profile-preview`, `ui-score`, `ui-parent-shell`, `ui-session-change`, `ui-kin-site`, `t-login-code-lib`, `t-login-code`, `ui-login-code`, `t-student-todo-lib`, `t-student-todo`, `ui-student-shell`, `t-admin-queue-lib`, `t-admin-queue`, `ui-admin-shell`, `t-no-hex`, `ui-exam-room`, `t-invite-preview-lib`, `t-invite-preview`, `t-kin-components`, `ui-kin-components`, `t-tutor-inbox-lib`, `t-tutor-inbox`, `ui-tutor-shell`, `t-exam-room-lib`, `ui-confirm-sites`, `t-session-policy-lib`, `t-session`, `t-phone-lib`, `t-login-phone`, `ui-login-phone`, `t-no-fabricated`, `t-links`, `t-landing-lib`, `t-course-ids`, `t-login-throttle-lib`, `t-login-password` (≈2 phút), `ui-login-password`, `t-rail-lib`, `ui-sidebar`, `t-thu-vien`, `t-host-routing-lib`, `ui-tutor-admin`, `ui-account-menu`, `t-library-lib`.
- `shoot-tutor-pages.ts`: chụp `/giang-vien` và `/mentor/[id]` (`before`/`after`) để so từng điểm ảnh khi tách component (cần Pillow để so).

## Lưu ý thêm (đã gặp ở 12/10)
- 13/10: sửa `globals.css` mà trình duyệt vẫn nhận CSS cũ (máy chủ dev giữ bộ nhớ đệm) → dừng dev, `rm -rf .next/dev`, chạy lại `scratchpad/dev-start.sh`. Đo style tính ra (`getComputedStyle`) trước khi tin là đã sửa.
- 13/10: trang mẫu component `/kin-mau` (chỉ có ở dev, bản production trả 404) là nơi `ui-kin-components` đo Nút / Thẻ trạng thái / Tab / Toast / Hộp xác nhận.
- Tạo Prisma client mà không tải được engine: `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npx prisma generate`.
- Test có giới hạn tốc độ theo IP (`/visit`, `/report`) dùng header `x-forwarded-for` ngẫu nhiên mỗi lần chạy.
- Origin admin chạy http thường nên `navigator.clipboard` không có; `zaloShare` dùng `execCommand("copy")` dự phòng, test bắt lại ở `document.execCommand`.
- Layout của `(guest)` có `loading.tsx` nên `notFound()` trả HTTP 200 kèm thân trang 404 (kiểm theo chuỗi `NEXT_HTTP_ERROR_FALLBACK;404`).
- `getByLabel` trên `<label>` bọc `<select>` bị tính cả chữ các option vào tên → dùng `aria-label` hoặc `locator("label").locator("select")`.
