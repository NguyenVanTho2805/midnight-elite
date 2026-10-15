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
- Cả hai tên miền (`midnightelite-edu.com`, `admin.midnightelite-edu.com`) cần về 127.0.0.1: trong Chromium đã có `--host-resolver-rules` ở `ui.ts`; ngoài ra thêm vào `/etc/hosts` (`127.0.0.1 midnightelite-edu.com admin.midnightelite-edu.com`) vì trang `/mentor/[id]` tự gọi lại API của chính nó theo `${x-forwarded-proto ?? "https"}://${host}` ở phía máy chủ (Vercel luôn đặt `x-forwarded-proto`; ở `next dev` chạy http bài rà gửi sẵn `x-forwarded-proto: http`). `allowedDevOrigins` trong `next.config.ts` đã liệt kê cả hai tên miền.
- DB thử cần extension `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`) cho `check-duplicate` và `/api/question-categories/:id/duplicates`. Còn tầng "giống nghĩa" của API sau dùng toán tử `<=>` của **pgvector** — DB thử không có (cột `embedding` là `text`) nên đường đó báo 500 ở máy thử; `ui-tutor-everything` chủ động bỏ qua đúng lỗi này khi thiếu extension `vector`.

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
  `ui-monthly`, `ui-invoice-zalo`, `ui-attendance-zalo`, `ui-funnel`, `ui-recruit`, `ui-connections`, `ui-plan`, `ui-admin-community`, `ui-categories`, `ui-profile-preview`, `ui-score`, `ui-parent-shell`, `ui-session-change`, `ui-kin-site`, `t-login-code-lib`, `t-login-code`, `ui-login-code`, `t-student-todo-lib`, `t-student-todo`, `ui-student-shell`, `t-admin-queue-lib`, `t-admin-queue`, `ui-admin-shell`, `t-no-hex`, `ui-exam-room`, `t-invite-preview-lib`, `t-invite-preview`, `t-kin-components`, `ui-kin-components`, `t-tutor-inbox-lib`, `t-tutor-inbox`, `ui-tutor-shell`, `t-exam-room-lib`, `ui-confirm-sites`, `t-session-policy-lib`, `t-session`, `t-phone-lib`, `t-login-phone`, `ui-login-phone`, `t-no-fabricated`, `t-links`, `t-landing-lib`, `t-course-ids`, `t-login-throttle-lib`, `t-login-password` (≈2 phút), `ui-login-password`, `t-rail-lib`, `ui-sidebar`, `t-thu-vien`, `t-host-routing-lib`, `ui-tutor-admin`, `ui-account-menu`, `t-library-lib`, `t-db-push-guard`, `ui-library-links`, `ui-shell-everywhere`, `ui-kin-loader`, `ui-motion-light`, `ui-motion-login`, `ui-motion-app`, `ui-theme`, `t-password-reset-lib`, `t-password-reset`, `ui-password-reset`, `ui-register-tutor`, `ui-host-flows`.
- Rà liên kết / nút theo tên miền × vai (15/10/2026, mở **thật** từng đích bằng trình duyệt; mỗi bài tự `wipe()` rồi dựng dữ liệu của nó):
  - `t-host-routing-lib` (56, thuần): từng quy tắc `decideRoute`, `hostAcceptsLogin`, `mainLoginUrl`.
  - `ui-host-flows` (21, ≈2 phút): H1–H6, hành trình có thao tác qua hai tên miền — trang đăng nhập admin không còn khung khách; "Quên mật khẩu?"; `/admin/kiem-duyet` cũ ở tên miền chính; nút công khai gõ nhầm ở tên miền admin; học viên / gia sư đăng nhập nhầm cửa admin; quản trị đăng nhập đúng cửa.
  - `ui-links-everywhere` (≈15 phút): 7 kịch bản vai × tên miền (khách@chính, khách@admin, học viên@chính, gia sư@chính, quản trị cấp 1@admin, quản trị nội dung@admin, quản trị cấp 1@chính), mở từng đích của mọi `<a>` và so điểm đến cuối với liên kết. `ONLY=tên1,tên2` chọn kịch bản, `LINK_REPORT=` đổi tệp báo cáo, `MAX_TARGETS=` đổi trần đích.
  - `ui-tutor-everything` (≈15 phút, dùng dữ liệu của `tutor-world.ts`): vai GIA SƯ — A. mở thật mọi liên kết trong vỏ gia sư, kiểm vỏ ("Module của gia sư") và quyền (trang chỉ của quản trị → `/lop-cua-toi`), B. bấm từng nút / tab / mục menu trên **trang nạp lại sạch** (ghi: đổi trang, tab mới, hộp thoại, không điều hướng, không bấm được — kèm cái gì đang đè lên nút), C. gom lỗi JS, `console.error`, HTTP ≥ 400. Tùy chọn: `VIEWPORT=390x844` (bản điện thoại), `TUTOR_REPORT=` (tệp báo cáo), `MAX_BTN=` (nút tối đa mỗi trang), `MAX_PAGES=`. Báo cáo ghi mọi "nhãn → đích", nút không có tên truy cập được và địa chỉ ngoài mà nút mở ra — **đọc bằng mắt**: đích có thể đúng đường dẫn nhưng sai ý nghĩa nhãn.
  - Chạy tuần tự, **không chạy hai bài cùng lúc** (cả hai `wipe()` cùng một DB) và **không sửa `src/` lúc đang chạy** (máy chủ dev biên dịch lại giữa chừng làm kết quả sai).
- `shoot-tutor-pages.ts`: chụp `/giang-vien` và `/mentor/[id]` (`before`/`after`) để so từng điểm ảnh khi tách component (cần Pillow để so).

## Lưu ý thêm (đã gặp ở 12/10)
- 13/10: sửa `globals.css` mà trình duyệt vẫn nhận CSS cũ (máy chủ dev giữ bộ nhớ đệm) → dừng dev, `rm -rf .next/dev`, chạy lại `scratchpad/dev-start.sh`. Đo style tính ra (`getComputedStyle`) trước khi tin là đã sửa.
- 13/10: trang mẫu component `/kin-mau` (chỉ có ở dev, bản production trả 404) là nơi `ui-kin-components` đo Nút / Thẻ trạng thái / Tab / Toast / Hộp xác nhận.
- Tạo Prisma client mà không tải được engine: `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npx prisma generate`.
- Test có giới hạn tốc độ theo IP (`/visit`, `/report`) dùng header `x-forwarded-for` ngẫu nhiên mỗi lần chạy.
- Origin admin chạy http thường nên `navigator.clipboard` không có; `zaloShare` dùng `execCommand("copy")` dự phòng, test bắt lại ở `document.execCommand`.
- 15/10: trình soạn kế hoạch buổi (`/lop-cua-toi/ke-hoach-buoi/[id]`) đặt hộp "rời trang?" (`beforeunload`) khi đang sửa dở. Trình duyệt thử mà **bỏ** hộp này (`dialog.dismiss()`) thì mọi `goto` sau đó bị huỷ và cả bài rà cứ ở lại trang soạn — phải `accept()` riêng loại `beforeunload`.
- 15/10: thẻ `data-audit-i` gắn sẵn lên nút bị cũ ngay khi React dựng lại DOM (đổi tuần, mở ngăn kéo…); đừng bấm theo danh sách cũ — nạp lại trang hoặc gắn lại thẻ trước mỗi lần bấm.
- 15/10: bộ chọn Playwright (`locator("button")`) xuyên cả shadow DOM của thanh công cụ dev (`agentation`); chỉ số trong danh sách bị lệch. Bài rà tự loại phần tử trong `[data-feedback-toolbar]` / `[data-annotation-popup]` / `[data-annotation-marker]`.
- Layout của `(guest)` có `loading.tsx` nên `notFound()` trả HTTP 200 kèm thân trang 404 (kiểm theo chuỗi `NEXT_HTTP_ERROR_FALLBACK;404`).
- `getByLabel` trên `<label>` bọc `<select>` bị tính cả chữ các option vào tên → dùng `aria-label` hoặc `locator("label").locator("select")`.
