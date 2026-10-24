# Kế hoạch Nâng cấp lần 2 — đối chiếu sheet · repo · báo cáo research, rồi làm một lượt

Soạn 22/10/2026 từ ba nguồn đọc cùng ngày:
1. **Sheet** `Todo list - Kin class` (3 tab: *Trang tính1* 236 dòng, *Bảng điều khiển*, *Nâng cấp lần 1* 71 dòng; ghi chú mới nhất 22/10).
2. **Repo** `NguyenVanTho2805/midnight-elite`: `main` ở `de1fb2e` (16/10); nhánh `claude/keen-allen-wiz3em` đi trước main 20 commit / 107 tệp (ĐX-00…07 + test chạy thật 22/10), **chưa có PR**. 3 PR đang mở: #63 (vá bảo mật, aodtsix-cmd), #60 (IELTS), #39 (cron nhắc Meet).
3. **Báo cáo research** "Sổ Gia Sư + 14 nền tảng" bản 2.1 (19/10) — bản chữ kèm ở `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md`.

Quy tắc kho vẫn nguyên: `CLAUDE.md`, `AGENTS.md`, `docs/kin/CLAUDE-cho-kho-trien-khai.md` (mục 9: **tiền** hoặc **trẻ dưới 16 tuổi → dừng và hỏi người**), `tools/local-e2e/README.md` (không chạy hai bài test cùng lúc; không sửa `src/` khi bài đang chạy), `ke-hoach-phat-trien-tu-research.md` mục 5 (schema chỉ THÊM, không `@unique` trên bảng cũ; mỗi ĐX một PR).

## 1. Trạng thái Nâng cấp lần 1 (từ cột H/I tab *Nâng cấp lần 1*)

| ĐX | Việc | Mã | Test | Còn gì |
|---|---|---|---|---|
| 00 | Đếm "buổi đã dạy" | xong, `2bc3df0` | xanh 22/10 | Q1 Thọ chưa xác nhận (đang theo mặc định) |
| 01 | Hộp việc "chưa điểm danh xong" | xong, `53ff7d2` | xanh | — |
| 02 | PWA + Web Push | xong phần mã, `b79040d` | `t-push` 60/60 | **Thọ:** VAPID + env Production + logo PNG (NC1-034), kiểm tay 2 máy (NC1-033); NC1-030 (tin 07:00) và NC1-031 (notify khi "Tôi đã chuyển") chưa làm |
| 03 | Xuất điểm danh tháng | xong, `12de8e4` | xanh | NC1-046 hoãn có chủ đích |
| 04 | Số đo sức khoẻ `/admin/so-do` | xong, `b72d9bf` | xanh | — |
| 05 | Chỉ số tự động hồ sơ | xong, `c56e17a` | xanh | — |
| 06 | Khu vực + hình thức | xong, `ae9ed21` | xanh | — |
| 07 | Mời cả lớp một lần | xong, `3e134a3` | xanh | NC1-080 ghi khảo sát (một phần) |
| 08 | Ảnh chuyển khoản | **không làm** | — | chặn Q6 (tiền) |
| 09 | Form tìm gia sư | **không làm** | — | chặn Q7 (trẻ em, PH-225) |
| — | Quy trình NC1-110/111/112 | chưa | — | tách PR, kiểm trước khi đẩy, ghi sổ |
| — | Q8 đưa báo cáo vào docs | chưa | — | làm ở lượt này |

Lỗi có sẵn ở bản nền (đã chứng minh 22/10, chưa sửa): `ui-recruit` 2 ca, `ui-schedule` 1 ca, `ui-tutor-shell` 1 ca, `ui-tutor-dash` sập — đều là bài đọc URL ngay sau `goto` mà không chờ chuyển hướng.

## 2. Trang tính1 — dòng Thọ chưa tick, phân loại

| Loại | Dòng | Xử lý ở lượt này |
|---|---|---|
| Làm được, không cần quyết định | TK-170 (còn 1/3 màn — nhưng `tien-do-dang-do.md` mục "Vào lớp bằng mã mời (Figma 32:54) — XONG 13/10" nói đã xong) | NC2-012 đối chiếu và ghi I |
| Làm một phần, cần đọc kỹ note | TK-173 (phiếu học phí theo tháng + VietQR), PH-207/210/212/213/214/215 (phễu, Zalo) | NC2-012: liệt kê phần còn thiếu; phần nào chỉ là giao diện và không đụng cách tính tiền thì làm (NC2-013) |
| Chờ Thọ (máy thật / khoá / luật sư) | NC1-033, NC1-034, PH-225, NV-190 | ghi "Việc của Thọ" |
| Chặn vì tiền | FE-159 SubscriptionPicker, NV-184 học bổng, TT-204 định giá, ĐX-08 | không làm; NC2-023 chỉ thêm *cờ* chạy thử (Q9) |
| Chặn vì trẻ em | PH-208, PH-211, PH-217–222, PH-226, ĐX-09 | không làm; NC2-006 gom câu hỏi luật sư |
| Cần quyết định cấu trúc | FE-136 (tách /admin/khoa-hoc), FE-134 (redesign admin chưa có Figma), FE-130 (bài giảng 1.281 dòng), PH-224 (ngưỡng bậc) | không làm (Q13); ghi lý do vào I |
| Đã huỷ | AS-227…236 (bảng tính Apps Script) | ghi I "huỷ theo Thanh 02/10" cho khớp |
| Không áp dụng theo D01 | BE-057/058, FE-150 | đã ghi, giữ FALSE |

## 3. Đối chiếu báo cáo research 2.1 ↔ KiN (những gì sheet CHƯA có)

| Báo cáo đề xuất (mục) | KiN đã có? | Khoảng trống → việc |
|---|---|---|
| 8.4B/8.6#1 nhắc "quá hạn chưa chốt" | ĐX-01 | — |
| 8.6#9 PWA + Web Push | ĐX-02 | NC1-030/031 còn thiếu → NC2-010, NC2-011 |
| 8.6#12 xuất PDF điểm danh | ĐX-03 | — |
| 8.8 chỉ số giai đoạn 1 (≥70% gia sư tạo lớp trong ngày đầu; ≥60% buổi chốt trong 24h; ≥50% phiếu bấm Gửi Zalo) | ĐX-04 có 6 chỉ số nhưng **thiếu kích hoạt gia sư** (đăng ký → lớp đầu → buổi đầu) | **NC2-020** |
| 8.4A "lớp đầu tiên trong 2 phút" | Chưa đo; `/admin/khoa-hoc/tao-moi` + Lịch + ĐX-07 là 3 màn | **NC2-021** (đo bằng bài trình duyệt, chỉ sửa chặn nhỏ) |
| 8.3 gia sư chọn Hiện/Ẩn hồ sơ; nhóm bắt buộc hiện | ĐX-06 (tuỳ chọn, Thọ chốt 21/10 "không nhóm nào bắt buộc"); **chưa thấy công tắc ẩn cả hồ sơ** | **NC2-022** (kiểm trước), Q11 |
| 8.5 + quyết định 19/10 "trước mắt miễn phí toàn bộ, Pro sau" | Code có `TUTOR_VIP_PLANS` (300k/1,5tr/2,5tr Coin), `POST /api/subscriptions`, nạp Coin (FE-128); `isActiveTutorVIP` **chưa được dùng để khoá tính năng nào** | **NC2-023** cờ `KIN_TRIAL_MODE` ẩn lối mua, không xoá code — **Q9** (tiền) |
| 8.4B "Gửi lịch tuần qua Zalo" một chạm | TT-199 có bảng chia sẻ cho phiếu/báo cáo; nhắc buổi có cron; **chưa thấy gửi lịch tuần** | **NC2-024** (kiểm trước) |
| 8.7 điều khoản: không giữ học phí, không hoa hồng, dữ liệu trẻ em, link phụ huynh | `/chinh-sach` có trang; nội dung chưa đối chiếu | **NC2-025** dự thảo, không sửa trang (pháp lý) |
| 8.3 PIN + "đã xem" cho link phụ huynh | token 128-bit, thu hồi, `parentViewedAt` | không cần PIN |
| 8.6#2 đổi hình thức phí; #10 gói N buổi | KiN tính theo tháng, bậc thang môn | không làm (ke-hoach mục 6) |
| 8.4C ảnh chuyển khoản, OCR | SePay + "Tôi đã chuyển"; ảnh = ĐX-08 | chặn Q6 |
| 8.4D form tìm gia sư, "Nhận lớp" | ĐX-09 | chặn Q7 |
| 8.9 chống spam reCAPTCHA + 3/ngày/số | nằm trong ĐX-09 | chặn Q7 |

## 4. Việc của Nâng cấp lần 2 (mã NC2-xxx)

Cỡ: S ≤ 1 ngày · M 2–3 ngày. Mọi việc: có test trong `tools/local-e2e/`, `tsc --noEmit` 0 lỗi, eslint không tăng so với nền, chạy lại `t-links`, `t-no-hex`, `t-no-fabricated`, `ui-tutor-shell`, `t-db-push-guard` nếu đụng schema.

### Đợt 0 — nền và quy trình (không cần quyết định)

- **NC2-001 · Kiểm môi trường (Quy trình, S).** `npm ci`; Postgres cục bộ theo README mục "Dựng DB thử khi máy chặn tải engine Prisma"; `source tools/local-e2e/env.sh`; `bash tools/local-e2e/dev-start.sh`; `tsc --noEmit`; đếm eslint nền (ghi số); chạy `t-links`, `t-no-hex`, `t-no-fabricated`. *Xong khi:* 3 bài xanh trên nhánh hiện tại, số nền ghi vào `tien-do-dang-do.md`.
- **NC2-002 · Đưa nhánh lên ngang main (Quy trình, M).** `git fetch origin main`; rebase `claude/keen-allen-wiz3em` lên `origin/main` (nếu xung đột ở hơn 5 tệp thì merge thay vì rebase, ghi lý do). Không merge PR #63/#60/#39 của người khác; chỉ đọc #63 để biết đụng `CRON_SECRET`/cron ở đâu và tránh phá. Sau đó: tsc, eslint, 3 bài canh, `t-db-push-guard`, `t-push`, `t-tutor-inbox`. *Xong khi:* nhánh dựa trên main mới nhất, các bài trên xanh.
- **NC2-003 · Tách và mở PR (Quy trình, M, Q10).** Theo NC1-110: mỗi ĐX một PR, xếp chồng theo phụ thuộc: PR1 = hạ tầng test (`32b9978 a343021 …`) + ĐX-00; PR2 ĐX-01; PR3 ĐX-03; PR4 ĐX-04; PR5 ĐX-05 (dựa PR1); PR6 ĐX-06; PR7 ĐX-07; PR8 ĐX-02. Mỗi PR: tiêu đề `ĐX-0x: …`, mô tả = "Xong khi" + test đã chạy (số đạt/đỏ) + việc Thọ cần làm + "không đụng tiền/trẻ em/schema chỉ thêm". **Không tự merge.** Nếu cherry-pick một ĐX xung đột ở > 3 tệp thì gộp ĐX đó vào PR kế tiếp và ghi lý do.
- **NC2-004 · Sửa 4 bài trình duyệt chập chờn có sẵn (Kiểm thử, M).** `ui-recruit` (2 ca), `ui-schedule` (1), `ui-tutor-shell` (1), `ui-tutor-dash` (sập): thay "đọc `page.url()` ngay sau `goto`" bằng `page.waitForURL(...)`/`eventually`; đọc từng dòng trước khi sửa. **Không sửa `src/` để chiều test.** *Xong khi:* mỗi bài chạy 2 lần liên tiếp xanh cả hai, trên nhánh đã rebase.
- **NC2-005 · Q8 — đưa bản chữ báo cáo vào docs (Tài liệu, S).** Tệp đã kèm: `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md`. Thêm 1 dòng vào `CLAUDE.md` (mục tài liệu) và vào đầu `ke-hoach-phat-trien-tu-research.md` ("Nguồn: … nay ở `docs/kin/bao-cao/…`").
- **NC2-006 · Gom câu hỏi cho luật sư (Tài liệu, S).** `docs/kin/nghiep-vu/pheu-gia-su.md` không có trong repo này, nên tạo `docs/kin/bao-cao/cau-hoi-luat-su.md`: 9 câu của Thanh (PH-225, cột K) + Q7 (form rút gọn không tên con) + ĐX-08 (biên lai = dữ liệu cá nhân) + Thông tư 29/2024 (hồ sơ công khai có cần hiện lịch dạy, học phí). Ghi rõ "căn cứ để hỏi, không phải ý kiến pháp lý". Không viết code.

### Đợt 1 — hoàn tất ĐX-02 và sổ sách

- **NC2-010 · Thông báo khi phụ huynh bấm "Tôi đã chuyển" (Backend, S; NC1-031).** Ba route `reported` (`api/phieu/[token]/reported`, `api/parent-portal/[token]/invoices/[code]/reported`, `api/users/me/invoices/[code]/reported`) gọi `notify()` loại `parent_reported`, đích `/lop-cua-toi/hoc-phi`. Chữ push dựng từ loại ("Có phụ huynh báo đã chuyển khoản, cần đối chiếu"), **không tên, không số tiền**; vào `PUSH_TYPES` với công tắc mặc định TẮT. Giới hạn: một phiếu chỉ một thông báo mỗi 24 giờ (chống bấm lặp). Test: `t-notify-links`, `t-push` mở rộng, `t-tt200` không đỏ.
- **NC2-011 · Tin đẩy 07:00 "Hôm qua có N buổi chưa điểm danh" (Backend, S; NC1-030, Q12).** Cuối cron `remind-class` (đã chạy 0 0 * * * UTC), dùng bộ đếm ĐX-01 (`loadUnmarkedSessions`), loại `unmarked_daily`, **công tắc mặc định TẮT** cho tới khi NC1-033 xong; chữ dựng từ loại, có đưa số N (không tên); không thêm cron mới. Test với bộ gửi giả + ca giờ yên lặng.
- **NC2-012 · Đối chiếu dòng dở ở Trang tính1 (Tài liệu, S).** Với TK-170, TK-173, PH-207/210/212/213/214/215: đọc cột I/K, mở mã, liệt kê "còn thiếu gì" từng dòng vào `tien-do-dang-do.md` mục "Nâng cấp lần 2 — đối chiếu". TK-170: nếu Figma 32:54 đã dựng (tien-do 13/10) thì ghi I "đã xong 13/10, đề nghị tick".
- **NC2-013 · Làm phần còn thiếu chỉ-giao-diện của NC2-012 (Frontend, S–M).** Chỉ các phần: không đổi cách tính tiền, không đụng dữ liệu trẻ em, có khung Figma (Thanh ghi mã khung ở cột K). Phần đụng tiền (ví dụ cách tính "còn lại" trên phiếu) → dừng, ghi lý do vào I.

### Đợt 2 — lấp khoảng trống so với báo cáo research

- **NC2-020 · Số đo kích hoạt gia sư (Backend + Frontend, M).** Thêm vào `src/lib/healthMetrics.ts` / `healthMetricsServer.ts` / `/admin/so-do` ba chỉ số kèm mẫu số: (7) gia sư đăng ký trong N ngày → tạo lớp đầu tiên trong 24 giờ; (8) → có buổi điểm danh đầu tiên (định nghĩa ĐX-00) trong 7 ngày; (9) trung vị giờ từ đăng ký → lớp đầu tiên. Nguồn: `users.createdAt` (role gia sư), `courses.createdAt`/`ownerId`, phiên điểm danh. Không đổi schema; mẫu số < 10 → "chưa đủ dữ liệu"; không trả tên. Test: `t-health-metrics-lib`, `t-health-metrics`, `ui-health-metrics` mở rộng.
- **NC2-021 · Đo onboarding "lớp đầu tiên trong 2 phút" (Kiểm thử, M).** Bài mới `ui-journey-new-tutor.ts` (theo mẫu `ui-journey-new-student`): đăng ký gia sư → xác thực (đọc `EMAIL_SINK_DIR`) → `/admin/khoa-hoc/tao-moi` → đặt khung giờ ở Lịch → "Mời cả lớp một lần" → Hộp việc. Ghi: số màn, số ô bắt buộc, số lần bấm, thời gian máy. Ghi kết quả vào `tien-do-dang-do.md` mục "Onboarding gia sư". **Chỉ sửa chặn nhỏ** (nhãn sai, bước thừa, lỗi JS); không đổi luồng, không đổi schema. Nếu > 2 phút hoặc > 3 màn: viết đề xuất (không làm) để Thọ quyết.
- **NC2-022 · Công tắc Hiện/Ẩn hồ sơ công khai (Backend + Frontend, S; Q11).** Kiểm trước: grep `hidden|isPublic|profileVisible` ở `src/app/api/tutors`, `src/lib/tutor*`. Nếu đã có → chỉ ghi sổ. Nếu chưa: `User.preferences.profile.hidden` (không đổi schema); khi ẩn: `/mentor/[id]` trả 404 theo cách sẵn có, `/giang-vien` và `/api/tutors` bỏ qua, thẻ og không trả, link bài đăng tìm học sinh báo "hồ sơ đang ẩn". Công tắc ở trang Hồ sơ gia sư với chữ giải thích; **mặc định HIỆN** (giữ hành vi hiện tại). Q11 = "bắt buộc" thì thêm điều kiện: chỉ bật Hiện khi đã nhập trường/bằng cấp. Test: `t-tutor-area`, `ui-profile-preview`, `shoot-tutor-pages`.
- **NC2-023 · Cờ chạy thử miễn phí (Frontend + Backend, S; Q9 — tiền).** Một chỗ đọc cờ: `src/lib/trialMode.ts` (`KIN_TRIAL_MODE=1`). Khi bật: `POST /api/subscriptions` trả 403 kèm thông điệp; mọi nút/lối vào "Mua VIP", "Nạp Coin" của gia sư ẩn; banner "KiN miễn phí trong giai đoạn chạy thử" ở trang gói; `GET /api/users/me/subscription` trả `trial: true`. **Không xoá** `TUTOR_VIP_PLANS`, không đụng ví/Coin/giao dịch đã có, không đổi schema. **Env chưa bật** — Thọ bật ở Vercel Production. Test: `t-plan`/`ui-plan` mở rộng + quét tĩnh "không còn lối vào mua khi cờ bật".
- **NC2-024 · "Gửi lịch tuần qua Zalo" (Frontend, S).** Kiểm trước: grep `zaloShare` trong `src/app/lop-cua-toi/(tutor)/lich`. Nếu đã có → ghi sổ. Nếu chưa: nút trên trang Lịch, tin soạn sẵn lịch tuần của MỘT lớp (ngày, giờ, môn; **không tên học sinh**), dùng đúng bảng chia sẻ của TT-199 (chat riêng / nhóm Zalo lớp / sao chép), chỉ ghi "Đã mở Zalo lúc". Test: `ui-schedule` mở rộng, `t-no-fabricated`.
- **NC2-025 · Dự thảo rà điều khoản (Tài liệu, S).** So `/chinh-sach` hiện tại với báo cáo 8.7: KiN không giữ học phí, không hoa hồng; dữ liệu học sinh và link phụ huynh (token, thu hồi, 30 ngày); gia sư tự khai bằng cấp; báo cáo hồ sơ. Viết `docs/kin/bao-cao/du-thao-chinh-sach.md` dạng "hiện có / đề xuất thêm / vì sao". **Không sửa trang** (pháp lý → Thọ/luật sư).

### Đợt 3 — không làm ở lượt này (ghi lý do vào sheet)

ĐX-08 (Q6, tiền) · ĐX-09 + NC1-101/102/103 (Q7, trẻ em) · NC1-033/034 (Thọ, máy thật + khoá) · FE-130/134/136 (Q13, việc lớn cần Figma/quyết định cấu trúc) · PH-208/211/217–222/226 (PH-225) · NV-184, TT-204, FE-159 (tiền) · NC1-046 (hoãn có chủ đích).

### Ghi sổ

- **NC2-090 · Ghi sổ (Tài liệu, S).** `docs/kin/tien-do-dang-do.md` thêm mục "Nâng cấp lần 2 (ngày)" theo đúng mẫu các mục ĐX; sheet: tab **"Nâng cấp lần 2"** (CSV kèm ở `docs/kin/backlog/nang-cap-lan-2.csv`, Thọ dán vào sheet) — ghi cột H/I từng dòng; dòng Trang tính1 liên quan chỉ nối thêm vào cột I. Báo cáo cuối cho Thọ: bảng việc · trạng thái · commit · test (đạt/đỏ) · giới hạn · "Việc của Thọ".

## 5. Quyết định — mặc định nếu Thọ không đổi

| # | Câu hỏi | Mặc định | Vì sao |
|---|---|---|---|
| Q9 (tiền) | Giai đoạn chạy thử miễn phí: ẩn lối mua VIP/nạp Coin bằng cờ? | **Có, làm cờ `KIN_TRIAL_MODE`, env chưa bật** | Thọ 19/10: "trước mắt cứ free"; cờ không chuyển tiền, không xoá gì; Thọ bật/tắt bằng env |
| Q10 | Tách 20 commit thành 8 PR hay 1 PR? | **Tách theo ĐX** (NC1-110); xung đột > 3 tệp ở một ĐX thì gộp vào PR kế | commit đã theo từng ĐX |
| Q11 | Trường/bằng cấp bắt buộc hiện khi hồ sơ công khai? | **Tuỳ chọn** (giữ Q4 21/10) | 21/10 là quyết định mới nhất; ghi chú: 19/10 Thọ nói với Claude ngược lại (báo cáo 2.1 mục 8.3) |
| Q12 | NC1-030 tin 07:00: viết ngay hay chờ kiểm tay? | **Viết mã, công tắc TẮT** | không gửi gì khi chưa bật; tiết kiệm một vòng |
| Q13 | FE-130/134/136 làm ở lượt này? | **Không** | việc lớn, chưa có Figma, FE-136 cần Thọ chốt cấu trúc |
| Q1 | (Nâng cấp lần 1) chặn tạo phiên điểm danh tương lai? | **Không chặn** (như đã làm) | Thọ xác nhận rồi tick NC1-Q1 |

## 6. Thứ tự chạy một lượt

NC2-001 → 002 → 004 (song song với 005, 006) → 003 → 010 → 011 → 012 → 013 → 020 → 021 → 022 → 023 → 024 → 025 → 090.
Chỉ một bài test chạy tại một thời điểm. Mỗi NC2 một commit (hoặc nhóm commit cùng tiền tố), đẩy lên **một nhánh mới** `claude/nang-cap-2` dựa trên nhánh đã rebase; PR của Đợt 1–2 mở sau PR8 của Đợt 0.
