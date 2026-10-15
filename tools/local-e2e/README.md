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
  `ui-monthly`, `ui-invoice-zalo`, `ui-attendance-zalo`, `ui-funnel`, `ui-recruit`, `ui-connections`, `ui-plan`, `ui-admin-community`, `ui-categories`, `ui-profile-preview`, `ui-score`, `ui-parent-shell`, `ui-session-change`, `ui-kin-site`, `t-login-code-lib`, `t-login-code`, `ui-login-code`, `t-student-todo-lib`, `t-student-todo`, `ui-student-shell`, `t-admin-queue-lib`, `t-admin-queue`, `ui-admin-shell`, `t-no-hex`, `ui-exam-room`, `t-invite-preview-lib`, `t-invite-preview`, `t-kin-components`, `ui-kin-components`, `t-tutor-inbox-lib`, `t-tutor-inbox`, `ui-tutor-shell`, `t-exam-room-lib`, `ui-confirm-sites`, `t-session-policy-lib`, `t-session`, `t-phone-lib`, `t-login-phone`, `ui-login-phone`, `t-no-fabricated`, `t-links`, `t-landing-lib`, `t-course-ids`, `t-login-throttle-lib`, `t-login-password` (≈2 phút), `ui-login-password`, `t-rail-lib`, `ui-sidebar`, `t-thu-vien`, `t-host-routing-lib`, `ui-tutor-admin`, `ui-account-menu`, `t-library-lib`, `t-db-push-guard`, `ui-library-links`, `ui-shell-everywhere`, `ui-kin-loader`, `ui-motion-light`, `ui-motion-login`, `ui-motion-app`.
- `shoot-tutor-pages.ts`: chụp `/giang-vien` và `/mentor/[id]` (`before`/`after`) để so từng điểm ảnh khi tách component (cần Pillow để so).

## Lưu ý thêm (đã gặp ở 12/10)
- 13/10: sửa `globals.css` mà trình duyệt vẫn nhận CSS cũ (máy chủ dev giữ bộ nhớ đệm) → dừng dev, `rm -rf .next/dev`, chạy lại `scratchpad/dev-start.sh`. Đo style tính ra (`getComputedStyle`) trước khi tin là đã sửa.
- 13/10: trang mẫu component `/kin-mau` (chỉ có ở dev, bản production trả 404) là nơi `ui-kin-components` đo Nút / Thẻ trạng thái / Tab / Toast / Hộp xác nhận.
- Tạo Prisma client mà không tải được engine: `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npx prisma generate`.
- Test có giới hạn tốc độ theo IP (`/visit`, `/report`) dùng header `x-forwarded-for` ngẫu nhiên mỗi lần chạy.
- Origin admin chạy http thường nên `navigator.clipboard` không có; `zaloShare` dùng `execCommand("copy")` dự phòng, test bắt lại ở `document.execCommand`.
- Layout của `(guest)` có `loading.tsx` nên `notFound()` trả HTTP 200 kèm thân trang 404 (kiểm theo chuỗi `NEXT_HTTP_ERROR_FALLBACK;404`).
- `getByLabel` trên `<label>` bọc `<select>` bị tính cả chữ các option vào tên → dùng `aria-label` hoặc `locator("label").locator("select")`.

## Dựng DB thử không cần engine (15/10/2026)
Máy cloud chặn `binaries.prisma.sh` (403), nên `prisma db push` không chạy được. Cách đã dùng:
```
# 1. Postgres 16 cục bộ + DB thử; loopback nhận mật khẩu dạng password (driver Neon gửi mật khẩu ngay, không đợi SCRAM)
pg_ctlcluster 16 main start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'kintest';\"" && su postgres -c "psql -c 'CREATE DATABASE kin_test;'"
sed -i 's/^host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host all all 127.0.0.1\/32 password/' "$(su postgres -c "psql -tAc 'show hba_file'")"
su postgres -c "psql -c 'select pg_reload_conf();'"
# 2. Schema: sinh DDL từ DMMF (cột vector → domain "vector" trên text, vì máy test không có pgvector)
npm i --prefix /tmp/prisma-internals @prisma/internals@7.8.0
node tools/local-e2e/db/ddl.mjs prisma/schema.prisma /tmp/prisma-internals/node_modules > /tmp/schema.sql
PGPASSWORD=kintest psql -h localhost -U postgres -d kin_test -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql
# 3. Client Prisma: PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npx prisma generate
# 4. Proxy WebSocket cho adapter Neon (wss://localhost/v2 → 127.0.0.1:5432), chứng chỉ tự ký để ngoài repo
mkdir -p /tmp/kin-cert && openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/kin-cert/key.pem -out /tmp/kin-cert/cert.pem -days 7 -subj "/CN=localhost"
nohup node tools/local-e2e/db/wsproxy.mjs "$PWD/node_modules" /tmp/kin-cert > /tmp/wsproxy.log 2>&1 &
# 5. env.sh: DATABASE_URL="postgresql://postgres:kintest@localhost/kin_test", NODE_TLS_REJECT_UNAUTHORIZED=0, ENGLISH_AI_FAKE=1
bash tools/local-e2e/dev-start.sh
```
Phần Tiếng Anh (`docs/tieng-anh/DAC-TA.md`): `t-english-lib` (140, thuần), `t-english` (89, API), `ui-english` (39, trình duyệt).
Máy chủ nhớ cờ "đã nạp kho từ" trong bộ nhớ, nên hai test API/UI tự nạp lại `eng_words` sau `wipe()`.
