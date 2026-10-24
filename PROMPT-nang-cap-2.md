# PROMPT — Nâng cấp lần 2 cho KiN (dán nguyên khối này vào Claude Code tại gốc kho midnight-elite)

Bạn là Claude Code làm việc trong kho `midnight-elite` (sản phẩm KiN). Tôi là Thọ. Hôm nay bạn chạy **một lượt trọn vẹn** "Nâng cấp lần 2": đưa nhánh `claude/keen-allen-wiz3em` lên ngang `main` và mở PR, hoàn tất phần còn dở của Nâng cấp lần 1, rồi lấp các khoảng trống so với báo cáo research — đúng theo `docs/kin/ke-hoach-nang-cap-2.md`. Làm xong việc nào ghi sổ việc đó. Khi gặp tiền hoặc trẻ dưới 16 tuổi thì dừng việc đó, ghi lý do, và làm tiếp việc khác — **không hỏi tôi giữa chừng**, vì mọi quyết định cần thiết đã có mặc định ở mục QUYẾT ĐỊNH dưới đây.

## 0. QUYẾT ĐỊNH ĐÃ CHỐT (Thọ sửa dòng nào thì làm theo dòng đó; không sửa = mặc định)

- Q1: "buổi đã dạy" theo ĐX-00; **không chặn** tạo phiên điểm danh ở ngày tương lai. → tick NC1-Q1.
- Q9 (tiền): **Có** làm cờ `KIN_TRIAL_MODE` ẩn lối mua VIP / nạp Coin của gia sư; không xoá code, không đụng ví; **env chưa bật**, tôi tự bật.
- Q10: **Tách** nhánh thành PR theo ĐX (8 PR xếp chồng); ĐX nào cherry-pick xung đột > 3 tệp thì gộp vào PR kế và ghi lý do.
- Q11: trường/bằng cấp trên hồ sơ công khai là **tuỳ chọn** (giữ chốt 21/10).
- Q12: NC1-030 (tin 07:00) **viết mã ngay**, công tắc mặc định TẮT.
- Q13: FE-130 / FE-134 / FE-136 **không làm** ở lượt này.
- Q6 (ĐX-08 ảnh chuyển khoản) và Q7 (ĐX-09 form tìm gia sư): **chưa chốt → không viết mã**; chỉ làm NC2-006 (gom câu hỏi luật sư).

## 1. Đọc trước, theo thứ tự, không bỏ

1. `CLAUDE.md`, `AGENTS.md`, `docs/kin/CLAUDE-cho-kho-trien-khai.md` (mục 5, 8, 9).
2. `docs/kin/ke-hoach-nang-cap-2.md` — đây là danh sách việc; mục 4 có "Xong khi" và test cho từng NC2.
3. `docs/kin/ke-hoach-phat-trien-tu-research.md` mục 2 và 6 (đã có / không làm) và `docs/kin/tien-do-dang-do.md` (các mục ĐX-00…07 và "Chạy thật 22/10").
4. `docs/kin/backlog/nang-cap-lan-2.csv` (tab sheet "Nâng cấp lần 2") — cột H/I là nơi ghi tiến độ; **không chạm cột J/K**.
5. `tools/local-e2e/README.md` — cách dựng Postgres cục bộ + Next dev + Chromium; **một bài test một lúc**, **không sửa `src/` khi bài đang chạy**.
6. `node_modules/next/dist/docs/` trước khi viết bất kỳ mã Next nào (AGENTS.md).

## 2. Agent (đã có trong `.claude/agents/`) và cách dùng

- `kin-doc-so` — lấy **phiếu việc** cho mỗi mã NC2 trước khi làm (bắt buộc).
- `kin-backend`, `kin-frontend` — viết mã + viết test.
- `kin-kiem-thu` — dựng môi trường một lần, chạy test tuần tự, trả số thật.
- `kin-ra-soat` — rà diff trước khi commit/PR; P1 phải sửa.
- `kin-ghi-so` — tien-do-dang-do.md, CSV sheet (H/I), mô tả PR, báo cáo cuối.
- `kin-dieu-phoi` — chạy trọn một NC2 độc lập; dùng để chạy **song song** các việc không đụng nhau (ví dụ NC2-005 + NC2-006 + NC2-025 là tài liệu, chạy cùng lúc với NC2-004), nhưng **chỉ một `kin-kiem-thu` tại một thời điểm**.

Bạn (phiên chính) là người điều phối: tạo task list theo mục 3, giao từng việc, giữ nhật ký ở `docs/kin/bao-cao/bao-cao-nang-cap-2-<ngày>.md`.

## 3. Trình tự chạy (đúng thứ tự; việc sau chỉ bắt đầu khi "Xong khi" của việc trước đạt)

**Đợt 0 — nền**
1. `NC2-001` kiểm môi trường: `npm ci`; Postgres theo README; `tsc --noEmit`; đếm eslint nền và ghi số; `t-links`, `t-no-hex`, `t-no-fabricated` phải xanh trên nhánh `claude/keen-allen-wiz3em`.
2. `NC2-002` `git fetch origin main` → rebase nhánh lên `origin/main` (xung đột > 5 tệp thì merge, ghi lý do). Đọc PR #63 để biết nó đụng cron/`CRON_SECRET` ở đâu và **không phá**; không merge PR nào của người khác. Chạy lại: tsc, eslint, 3 bài canh, `t-db-push-guard`, `t-push`, `t-tutor-inbox`. Tạo nhánh làm việc mới `claude/nang-cap-2` từ đây.
3. Song song: `NC2-004` (sửa 4 bài trình duyệt chập chờn: `ui-recruit`, `ui-schedule`, `ui-tutor-shell`, `ui-tutor-dash` — `waitForURL`, không sửa `src/`; mỗi bài chạy 2 lần liên tiếp phải xanh cả hai) với `NC2-005` (commit `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md` + 1 dòng dẫn ở `CLAUDE.md` và đầu `ke-hoach-phat-trien-tu-research.md`) và `NC2-006` (`docs/kin/bao-cao/cau-hoi-luat-su.md`).
4. `NC2-003` tách và mở PR: PR1 = hạ tầng test (`32b9978`, `a343021`, `e6b3548`, `24e0fcd`, `4fbbd27`, `99a11af`, `53c9052`, `8d2089e`, `3b06e8e`, `807259e` — phần chung) + ĐX-00 (`2bc3df0`); PR2 ĐX-01 (`53ff7d2`); PR3 ĐX-03 (`12de8e4`, `7ddf3ed`); PR4 ĐX-04 (`b72d9bf`); PR5 ĐX-05 (`c56e17a`, dựa PR1); PR6 ĐX-06 (`ae9ed21`); PR7 ĐX-07 (`3e134a3`); PR8 ĐX-02 (`b79040d`). Dùng `gh pr create` với mô tả do `kin-ghi-so` soạn (Vì sao · Thay đổi · Xong khi · Test đã chạy · Việc của Thọ · Không đụng tiền/trẻ em · Quyết định áp dụng). **Không merge.** Nếu `gh` không đăng nhập được: đẩy nhánh và ghi lệnh `gh pr create` đầy đủ vào báo cáo để tôi chạy.

**Đợt 1 — hoàn tất ĐX-02 và sổ sách** (trên `claude/nang-cap-2`)
5. `NC2-010` notify + push khi phụ huynh bấm "Tôi đã chuyển" (3 route `reported`; chữ từ loại, không tên/số tiền; công tắc push mặc định TẮT; 1 thông báo / phiếu / 24h).
6. `NC2-011` tin 07:00 "Hôm qua có N buổi chưa điểm danh" cuối cron `remind-class` (dùng `loadUnmarkedSessions`; công tắc TẮT; không cron mới).
7. `NC2-012` đối chiếu TK-170, TK-173, PH-207/210/212/213/214/215: ghi "còn thiếu gì" vào tien-do; TK-170 đề nghị tick nếu Figma 32:54 đã dựng (tien-do 13/10).
8. `NC2-013` làm phần còn thiếu **chỉ giao diện** của bước 7 (có mã khung Figma ở cột K, không đổi cách tính tiền). Đụng tiền → dừng, ghi I.

**Đợt 2 — lấp khoảng trống so với báo cáo research**
9. `NC2-020` ba chỉ số kích hoạt gia sư ở `/admin/so-do` (đăng ký → lớp đầu trong 24h; → buổi điểm danh đầu trong 7 ngày; trung vị giờ). Không đổi schema; < 10 mẫu → "chưa đủ dữ liệu".
10. `NC2-021` bài `ui-journey-new-tutor.ts` đo onboarding gia sư mới (số màn / ô bắt buộc / lần bấm / thời gian); ghi vào tien-do; chỉ sửa chặn nhỏ; > 2 phút hoặc > 3 màn → viết đề xuất, không đổi luồng.
11. `NC2-022` công tắc Hiện/Ẩn hồ sơ công khai (kiểm trước đã có chưa; `User.preferences.profile.hidden`; ẩn → 404 / bỏ khỏi danh sách / không og; mặc định HIỆN).
12. `NC2-023` cờ `KIN_TRIAL_MODE` (`src/lib/trialMode.ts`): bật → `POST /api/subscriptions` 403, ẩn nút Mua VIP / Nạp Coin của gia sư, banner "KiN miễn phí trong giai đoạn chạy thử", `GET /api/users/me/subscription` trả `trial: true`. Không xoá `TUTOR_VIP_PLANS`, không đụng ví/Coin, env chưa bật.
13. `NC2-024` "Gửi lịch tuần qua Zalo" trên trang Lịch gia sư (kiểm trước; tin không tên học sinh; dùng bảng chia sẻ TT-199; chỉ ghi "Đã mở Zalo lúc").
14. `NC2-025` dự thảo rà `/chinh-sach` → `docs/kin/bao-cao/du-thao-chinh-sach.md`; **không sửa trang**.

**Kết**
15. `NC2-090` ghi sổ: tien-do-dang-do.md mục "Nâng cấp lần 2"; CSV sheet cột H/I; nối ghi chú vào dòng Trang tính1 / Nâng cấp lần 1 liên quan; tick NC1-Q1; mở PR9 `NC2: Nâng cấp lần 2 (Đợt 1–2)` dựa trên PR8; báo cáo cuối `docs/kin/bao-cao/bao-cao-nang-cap-2-<ngày>.md` gồm bảng việc · trạng thái · commit · test (số đạt/đỏ) · giới hạn · **Việc của Thọ** (VAPID + env Production + logo PNG + `PUSH_ENABLED=1`; kiểm tay Android/iPhone; bật `KIN_TRIAL_MODE`; dán tab "Nâng cấp lần 2" vào sheet; thứ tự merge PR1→PR9).

## 4. Quy tắc cứng cho cả lượt (vi phạm = làm sai)

1. **Tiền hoặc trẻ dưới 16 tuổi → dừng việc đó**, ghi `CHƯA LÀM — chủ động dừng (lý do)` vào cột I, làm việc khác. Không bao giờ viết mã chuyển tiền, gạch nợ, đổi cách tính phiếu, thu thêm dữ liệu học sinh/phụ huynh.
2. **Schema chỉ THÊM**; không `@unique` trên bảng đã có dữ liệu; đụng schema → `t-db-push-guard`.
3. **Mỗi việc có test** (bài thuần có ca phá cố ý + bài API/ui) và **số đạt/đỏ là số thật đã chạy**; chưa chạy thì ghi "chưa chạy". Trước khi đẩy: `tsc --noEmit` 0 lỗi; eslint không tăng; `t-links`, `t-no-hex`, `t-no-fabricated`, `ui-tutor-shell` xanh.
4. **Một bài test một lúc; không sửa `src/` khi bài đang chạy.** Chỉ một `kin-kiem-thu` chạy tại một thời điểm.
5. Thao tác ghi = POST + 303; chuyển hướng theo phiên = 307 + `no-store`; màu chỉ qua token `--kin-*`; `KinConfirm` thay `window.confirm`; trang admin mới phải vào `adminNav.ts`.
6. Thông báo đẩy: chữ dựng từ `type` (không tên, không số tiền); giờ yên lặng 22:00–07:00 giờ VN; chỉ gửi khi `PUSH_ENABLED=1` và không phải Preview.
7. Chữ công khai: "ghi trên KiN", không "đã xác minh"; tiếng Việt, giọng KiN, không "Midnight Elite", không số liệu bịa.
8. Mỗi NC2 một commit (hoặc nhóm cùng tiền tố `NC2-0xx:`); `kin-ra-soat` phải trả "ĐƯỢC MỞ PR" trước khi mở PR; **không tự merge PR**.
9. Sheet: chỉ sửa cột `Thọ` / `Thọ Note` (H/I); **không chạm `Thanh` / `Thanh Note`**; chỉ nối thêm, không xoá ghi chú cũ. Không có công cụ Google Sheets thì ghi vào CSV và nói rõ.
10. Tài liệu Next: đọc `node_modules/next/dist/docs/` trước khi dùng API Next; đây không phải Next bạn nhớ.

## 5. Khi kết thúc

Trả lời tôi bằng đúng ba phần, ngắn: (a) bảng NC2 · trạng thái · commit · test; (b) danh sách PR (số, tiêu đề, phụ thuộc, thứ tự merge); (c) "Việc của Thọ" và "Đã dừng vì sao". Không kể lại quá trình.

Bắt đầu: tạo task list đủ 15 bước ở mục 3, rồi chạy `kin-doc-so` cho `NC2-001`.
