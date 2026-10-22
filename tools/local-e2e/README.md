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
  `ui-monthly`, `ui-invoice-zalo`, `ui-attendance-zalo`, `ui-funnel`, `ui-recruit`, `ui-connections`, `ui-plan`, `ui-admin-community`, `ui-categories`, `ui-profile-preview`, `ui-score`, `ui-parent-shell`, `ui-session-change`, `ui-kin-site`, `t-login-code-lib`, `t-login-code`, `ui-login-code`, `t-student-todo-lib`, `t-student-todo`, `ui-student-shell`, `t-admin-queue-lib`, `t-admin-queue`, `ui-admin-shell`, `t-no-hex`, `ui-exam-room`, `t-invite-preview-lib`, `t-invite-preview`, `t-kin-components`, `ui-kin-components`, `t-tutor-inbox-lib`, `t-tutor-inbox`, `ui-tutor-shell`, `t-exam-room-lib`, `ui-confirm-sites`, `t-session-policy-lib`, `t-session`, `t-phone-lib`, `t-login-phone`, `ui-login-phone`, `t-no-fabricated`, `t-links`, `t-landing-lib`, `t-course-ids`, `t-login-throttle-lib`, `t-login-password` (≈2 phút), `ui-login-password`, `t-rail-lib`, `ui-sidebar`, `t-thu-vien`, `t-host-routing-lib`, `ui-tutor-admin`, `ui-account-menu`, `t-library-lib`, `t-db-push-guard`, `ui-library-links`, `ui-shell-everywhere`, `ui-kin-loader`, `ui-motion-light`, `ui-motion-login`, `ui-motion-app`, `ui-theme`, `t-password-reset-lib`, `t-password-reset`, `ui-password-reset`, `ui-register-tutor`, `ui-host-flows`, `t-notify-links`.
- Rà liên kết / nút theo tên miền × vai (15/10/2026, mở **thật** từng đích bằng trình duyệt; mỗi bài tự `wipe()` rồi dựng dữ liệu của nó):
  - `t-host-routing-lib` (60, thuần): từng quy tắc `decideRoute` (kể cả học viên có phiên cũ ở tên miền admin), `hostAcceptsLogin`, `mainLoginUrl`.
  - `t-notify-links` (11, API): đích của thông báo cho gia sư (duyệt hồ sơ → `/lop-cua-toi`; phụ huynh phản hồi → tab Học viên đăng ký của đúng lớp; báo nghỉ / đã gạch phiếu / đối soát giữ nguyên).
  - `ui-host-flows` (27, ≈2 phút): H1–H7, hành trình có thao tác qua hai tên miền — trang đăng nhập admin không còn khung khách; "Quên mật khẩu?"; `/admin/kiem-duyet` cũ ở tên miền chính; nút công khai gõ nhầm ở tên miền admin; học viên / gia sư đăng nhập nhầm cửa admin; quản trị đăng nhập đúng cửa; H7 (16/10): chưa đăng nhập mở `/admin/khoa-hoc` rồi đăng nhập gia sư và mở lại đúng địa chỉ đó — chuyển hướng không được bị trình duyệt nhớ (308 → 307 + `Cache-Control: no-store`).
  - `ui-links-everywhere` (≈15 phút): 7 kịch bản vai × tên miền (khách@chính, khách@admin, học viên@chính, gia sư@chính, quản trị cấp 1@admin, quản trị nội dung@admin, quản trị cấp 1@chính), mở từng đích của mọi `<a>` và so điểm đến cuối với liên kết. `ONLY=tên1,tên2` chọn kịch bản, `LINK_REPORT=` đổi tệp báo cáo, `MAX_TARGETS=` đổi trần đích.
  - `ui-tutor-everything` (≈15 phút, dùng dữ liệu của `tutor-world.ts`): vai GIA SƯ — A. mở thật mọi liên kết trong vỏ gia sư, kiểm vỏ ("Module của gia sư") và quyền (trang chỉ của quản trị → `/lop-cua-toi`), B. bấm từng nút / tab / mục menu trên **trang nạp lại sạch** (ghi: đổi trang, tab mới, hộp thoại, không điều hướng, không bấm được — kèm cái gì đang đè lên nút), C. gom lỗi JS, `console.error`, HTTP ≥ 400. Tùy chọn: `VIEWPORT=390x844` (bản điện thoại), `TUTOR_MODULES=compact` (cấu hình MẶC ĐỊNH — Lịch + Học phí, cửa vào là Lịch; mặc định của bài là bật đủ 4 module), `TUTOR_WORLD=empty` (gia sư mới tinh chưa có lớp), `TUTOR_REPORT=` (tệp báo cáo), `MAX_BTN=` (nút tối đa mỗi trang), `MAX_PAGES=`. Nên chạy ít nhất: mặc định, `compact`, `empty`, và `VIEWPORT=390x844`. Báo cáo ghi mọi "nhãn → đích", nút không có tên truy cập được và địa chỉ ngoài mà nút mở ra — **đọc bằng mắt**: đích có thể đúng đường dẫn nhưng sai ý nghĩa nhãn.
  - `ui-role-everything` (16/10/2026; khách ≈6 phút, học sinh ≈25 phút, dùng dữ liệu của `student-world.ts`): vai **HỌC SINH** và vai **KHÁCH**, cùng cách làm với `ui-tutor-everything`. `ROLE=student|guest` (mặc định student), `WORLD=empty` (học sinh MỚI TINH chưa vào lớp nào), `VIEWPORT=390x844`, `ROLE_REPORT=` (tệp báo cáo, mặc định `scratchpad/role-report-<vai>.txt`), `MAX_BTN=`, `MAX_PAGES=`. Các phần: **A.** mở thật đích của mọi `<a>` (đổi đích có chủ đích được liệt kê ở cuối phần A — không nuốt im lặng; khách: trang cần đăng nhập phải sang `/dang-nhap` KÈM `?redirect=` đúng trang); **Vỏ** (học sinh luôn trong khung "Module của học sinh" — kiểm CẢ HAI chiều: khung sai và KHÔNG có khung nào; khách không bao giờ thấy thanh module); **Quyền** (trang gia sư / quản trị mở bằng vai này); **Cô lập** (dữ liệu RIÊNG của lớp / gia sư khác — bài trong lớp khác, tệp + video của bài trả phí của lớp khác — không lọt vào; vào thi đề của lớp khác bị 403; chỉ dùng dấu hiệu RIÊNG, không dùng dữ liệu công khai làm dấu: bản đầu báo giả vì dùng tên học sinh khác / bài miễn phí); **Chuông thông báo** (bấm từng thông báo → đúng trang, chấp nhận bí danh `/student/hoi-dap/<id>` → `/cong-dong/hoi-dap/<id>`); **Địa chỉ sai / đã xoá** (lớp, gia sư, bài viết, câu hỏi, phiếu, sổ phụ huynh, mã xác thực, đề thi… không có → phải có lời giải thích VÀ có liên kết đi tiếp, không sập, không trắng, không ngõ cụt; 4xx của API ở đây là kỳ vọng, lỗi JS thì không); **B.** bấm từng nút trên trang nạp lại sạch; **C.** gom lỗi JS / `console.error` / HTTP ≥ 400 (danh sách 4xx kỳ vọng ghi rõ trong mã và in ra, không loại im lặng). Báo cáo ghi mọi cặp "nhãn → đích" để đọc bằng mắt (nhãn nói một đằng, đích một nẻo vẫn phải xem tay). Nên chạy: học sinh đầy đủ, học sinh `WORLD=empty`, học sinh + khách ở `VIEWPORT=390x844`, khách.
  - `ui-journey-new-student` (16/10/2026, ≈2 phút): hành trình học sinh MỚI có thao tác đổi dữ liệu — trang chủ → "Đăng ký" → form 2 bước → "Kiểm tra hộp thư" → thư xác thực (đọc từ `EMAIL_SINK_DIR`) → tự đăng nhập và vào thẳng "Việc của tôi" → mã mời → "Vào lớp này" → trang lớp → đăng xuất → mở trang học sinh bị đưa sang đăng nhập giữ `?redirect=` → đăng nhập lại về đúng trang. `ui-role-everything` bỏ qua nút gửi / đăng ký / đăng xuất để khỏi làm bẩn dữ liệu nên những bước này kiểm ở đây.
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
- 16/10: chuyển hướng phụ thuộc phiên TUYỆT ĐỐI không dùng 308 / 301: trình duyệt nhớ vĩnh viễn (dựng lại bằng CDP `Network.requestWillBeSent` → `redirectResponse.fromDiskCache`). Dùng 307 + `Cache-Control: no-store`.
- 16/10: mã giả của bài thử "địa chỉ sai" phải KHÁC mọi mã có thật trong thế giới thử (`c3 d4 a1 b2 e5 f6` ở `student-world.ts`) — lần đầu đụng đúng hai phiếu thật.
- 16/10: `form input[type="checkbox"]` chứ không phải `input[type="checkbox"]` trần — thanh công cụ dev (`agentation`) cũng có ô tích, bộ chọn trần khớp 6 phần tử (strict mode).
- 16/10: `next dev` in cảnh báo React "Encountered a script tag while rendering React component" khi một trang trong nhóm `(parent)` (`/phieu/<mã sai>`, `/so-cua-con/<mã sai>`) trả 404 thật bằng `notFound()`; 404 gốc thì không. Là cảnh báo của React bản phát triển, giao diện vẫn đủ; bài rà ghi riêng, không tính lỗi, và chưa kiểm được ở bản dựng production.
- Layout của `(guest)` có `loading.tsx` nên `notFound()` trả HTTP 200 kèm thân trang 404 (kiểm theo chuỗi `NEXT_HTTP_ERROR_FALLBACK;404`).
- `getByLabel` trên `<label>` bọc `<select>` bị tính cả chữ các option vào tên → dùng `aria-label` hoặc `locator("label").locator("select")`.

## Dựng DB thử khi máy chặn tải engine Prisma (22/10/2026, đã chạy thật)
Máy làm việc của Claude có sẵn Postgres 16 (`/usr/lib/postgresql/16`, cụm `main` đang tắt) nhưng `binaries.prisma.sh` bị chặn (403) nên `prisma db push` không chạy được. Cách đã dùng, chạy được đầu-cuối:
1. `pg_ctlcluster 16 main start`; đặt mật khẩu, `createdb kin_test`, `CREATE EXTENSION pg_trgm`. **pgvector không có** → cột `embedding` đổi `vector(768)` thành `text` (chỉ tầng "giống nghĩa" cần).
2. DDL: `tools/local-e2e/gen-schema-sql.mjs` (engine schema WASM, xem đầu tệp) → `sed 's/vector(768)/text/g' | psql`. `prisma generate` cần `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`.
3. `src/lib/prisma.ts` nối bằng driver Neon (WebSocket) nên cần `node tools/local-e2e/neon-ws-proxy.mjs &` (cổng 443, chứng chỉ tự ký → `NODE_TLS_REJECT_UNAUTHORIZED=0`) VÀ `host all all 127.0.0.1/32 trust` trong `pg_hba.conf` (driver Neon gửi mật khẩu "chạy trước"; proxy bỏ thông điệp đó). Chỉ dùng ở máy test.
4. `source tools/local-e2e/env.sh` (có mẫu thêm `PUSH_ENABLED=1` + `VAPID_*` cho `t-push` / `ui-push-settings`), `bash tools/local-e2e/dev-start.sh`, thêm `127.0.0.1 midnightelite-edu.com admin.midnightelite-edu.com` vào `/etc/hosts`.
5. Đừng chạy `pkill -f <tên tệp>` trong cùng lệnh bash có chứa tên tệp đó — nó giết luôn shell (mã thoát 144); dùng `pgrep -f "^node tools/..."` neo đầu dòng.
