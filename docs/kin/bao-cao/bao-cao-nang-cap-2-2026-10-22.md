# Báo cáo cuối — Nâng cấp lần 2 (22/10/2026)

Làm bởi Claude Code trên máy Mac của Thanh (Postgres 17 + pgvector, Next dev, Chrome). Mọi con số "xanh" là số **thật đã chạy tuần tự trên bản đã gộp** (một bài một lúc, DB `kin_test`); ghi "chưa chạy" khi chưa chạy. Chi tiết từng việc: `docs/kin/tien-do-dang-do.md` mục "Nâng cấp lần 2". Rà gói so với GitHub/sheet/research: `ra-soat-goi-nang-cap-2-2026-10-22.md`.

**Nền → sau:** `tsc` 0 lỗi → 0 lỗi · eslint `src` 85 lỗi / 42 cảnh báo → 85 / 42 (không tăng).

## (a) Việc · trạng thái · commit · test
| Việc | Trạng thái | Commit | Test (đạt / đỏ) |
|---|---|---|---|
| NC2-001 môi trường | XONG | c58e820 | `t-no-hex` 17/0, `t-no-fabricated` 37/0, `t-links` 10/0 |
| NC2-002 rebase | XONG (0 tụt; đặt lên đỉnh PR8) | — | `t-db-push-guard` 28/0, `t-push` 76/0 (60 ở nền), `t-tutor-inbox` 34/0 |
| NC2-003 tách PR | XONG, 8 PR, chưa merge | — | `git diff` PR8 ↔ nhánh gốc rỗng; `tsc` 0 lỗi từng PR |
| NC2-004 4 bài chập chờn | XONG | fbc9a65 | `ui-recruit` 27/0, `ui-schedule` 59/0, `ui-tutor-shell` 81/0, `ui-tutor-dash` 52/0 (mỗi bài 2 lần) |
| NC2-005 research vào docs | XONG | d244fbb | — |
| NC2-006 câu hỏi luật sư | XONG BẢN NHÁP | 20dc72e | — |
| NC2-010 báo "Tôi đã chuyển" | XONG | c01c813 | `t-push-lib` 129/0, `t-push` 76/0, `t-notify-links` 15/0, `t-tt200` 116/0, `ui-push-settings` 30/0 |
| NC2-011 tin 07:00 | XONG | c01c813, 388b6cb | `t-unmarked-daily-lib` 23/0, `t-unmarked-daily` 23/0 |
| NC2-012 đối chiếu dòng dở | XONG BẢN NHÁP | 20dc72e | — |
| NC2-013 phần giao diện còn thiếu | **CHƯA LÀM** — chờ xác nhận khung Figma 186:77 | — | — |
| NC2-020 chỉ số kích hoạt | XONG | 3f583e9 | `t-health-metrics-lib` 62/0, `t-health-metrics` 25/0, `ui-health-metrics` 23/0 |
| NC2-021 đo onboarding | XONG (đo + đề xuất, không đổi luồng) | d09a0df, 388b6cb | `ui-journey-new-tutor` 42/0 (2 lần) |
| NC2-022 ẩn hồ sơ | XONG | 564f487 | `t-tutor-visibility-lib` 40/0, `t-tutor-area` 55/0, `ui-profile-preview` 38/0, `t-funnel` 52/0, `ui-funnel` 35/0 |
| NC2-023 cờ chạy thử (TIỀN: chỉ ẩn lối vào) | XONG | a4b1275 | `t-trial-mode-lib` 23/0; `t-trial-mode` 13/0 tắt, 15/0 bật; `ui-trial-mode` 13/0 tắt, 16/0 bật |
| NC2-024 lịch tuần qua Zalo | XONG | 6890bcb, 388b6cb | `t-schedule-zalo-lib` 22/0, `ui-schedule` 59/0 |
| NC2-025 dự thảo chính sách | XONG BẢN NHÁP (không sửa trang) | 20dc72e | — |
| NC2-026 rà trang phụ huynh (mới) | XONG BẢN NHÁP | 20dc72e | — |
| NC2-026a sửa F1 (mới) | XONG | 9bf459c | `t-attendance-window-lib` 14/0, `t-portal-attendance-future` 11/0, `t-monthly` 48/0, `t-absence` 43/0, `ui-portal-absence` 18/0, `ui-monthly` 29/0, `ui-parent-shell` 20/0 |
| NC2-026b F2, F3 (mới) | **CHƯA LÀM — chủ động dừng** (tiền / ghi danh trẻ em) | — | — |
| NC2-027 Google OAuth, NC2-028 hạn mức admin, NC2-029 rút gọn tạo lớp (mới) | **CHƯA LÀM** — chờ Thọ | — | — |
| NC2-030 ĐX-08, NC2-031 ĐX-09 | KHÔNG LÀM theo quyết định (Q6, Q7) | — | — |
| NC2-090 ghi sổ | XONG | 3ea7bac + commit cuối | — |

**Đỏ có sẵn, không do Nâng cấp lần 2:** `ui-attendance-zalo` 27 đạt / 1 đỏ ("Vắng → Có phép: mốc 'đã mở Zalo' bị xoá") — đỏ giống hệt trên bản gốc `3b06e8e` (chạy lại độc lập). `t-push-lib` đỏ 1 ca nếu chạy ở bản sao không có `.git`; ở kho thật 129/0.
**Chưa chạy / chưa kiểm:** gửi tin đẩy tới thiết bị thật; Preview Vercel; cron `remind-class` với nhiều gia sư (chưa đo); in giấy thật bản PDF điểm danh (NC1-045).
**Chạy thêm ngoài danh sách chính (đều xanh, trong lần chạy tổng):** `t-recruit` 20, `t-invite-preview` 14, `t-attendance-export` 23, `t-tutor-activity` 17, `t-analytics` 32, `ui-recruit` 27.

## (b) PR (không merge cái nào)
Thứ tự merge: **#63 → #64 → … → #71 → #72**. Các PR xếp chồng; GitHub tự đổi base khi PR trước được merge và xoá nhánh.
| PR | Tiêu đề | Phụ thuộc |
|---|---|---|
| [#63](https://github.com/NguyenVanTho2805/midnight-elite/pull/63) | Vá bảo mật: chặn điểm tự khai, cron bắt buộc CRON_SECRET (có từ trước) | `main` |
| [#64](https://github.com/NguyenVanTho2805/midnight-elite/pull/64) | Nền test + ĐX-00: sửa cách đếm "số buổi đã dạy" | `main` |
| [#65](https://github.com/NguyenVanTho2805/midnight-elite/pull/65) | ĐX-01: Hộp việc "chưa điểm danh xong" | #64 |
| [#66](https://github.com/NguyenVanTho2805/midnight-elite/pull/66) | ĐX-03: xuất điểm danh tháng | #65 |
| [#67](https://github.com/NguyenVanTho2805/midnight-elite/pull/67) | ĐX-04: Số đo sản phẩm | #66 |
| [#68](https://github.com/NguyenVanTho2805/midnight-elite/pull/68) | ĐX-05: số tự động trên hồ sơ công khai | #67 |
| [#69](https://github.com/NguyenVanTho2805/midnight-elite/pull/69) | ĐX-06: khu vực và hình thức dạy | #68 |
| [#70](https://github.com/NguyenVanTho2805/midnight-elite/pull/70) | ĐX-07: mời cả lớp một lần | #69 |
| [#71](https://github.com/NguyenVanTho2805/midnight-elite/pull/71) | ĐX-02: PWA + thông báo đẩy | #70 |
| [#72](https://github.com/NguyenVanTho2805/midnight-elite/pull/72) | NC2: Nâng cấp lần 2 (Đợt 0–2) | #71 |

PR #63 gộp sau #71/#72 chỉ xung đột ở `tools/local-e2e/env.example.sh` (hai bên cùng thêm dòng cuối tệp; giữ cả hai); với #64 không xung đột; route cron tự gộp sạch (kiểm bằng `git merge-tree`).

## (c) Việc của Thọ
1. **Khoá VAPID** (`npx web-push generate-vapid-keys`), đặt `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_ENABLED=1` ở Vercel **Production** (không Preview); đưa logo PNG 192/512 vào `public/icons/`; **kiểm tay** Android Chrome + iPhone (NC1-033/034).
2. Bật `KIN_TRIAL_MODE=1` ở Vercel Production khi muốn ẩn lối mua VIP/nạp Coin (Q9). Quyết có chặn `POST /api/wallet/topups` khi bật cờ không (hiện chỉ ẩn form).
3. Xác nhận **Q1** (tick NC1-Q1), **Q12** (đảo ghi chú NC1-030 "để sau"); TK-170: đề nghị tick.
4. Quyết **F2, F3** ở trang phụ huynh (NC2-026b) và **đề xuất rút gọn luồng tạo lớp** (NC2-029; đo: 9 route / 7 ô bắt buộc / 22 lần bấm, vượt ngưỡng ≤ 3 màn).
5. Đọc/duyệt các tài liệu **nháp** do agent soạn trước khi dùng: `cau-hoi-luat-su.md` (Q-LS-01: kho có hai văn bản luật dữ liệu cá nhân mâu thuẫn), `du-thao-chinh-sach.md`, `nc2-012-…`, `nc2-026-…`.
6. Dán tab "Nâng cấp lần 2" vào sheet (đã tạo cùng lượt này nếu còn thiếu thì dùng `nang-cap-lan-2.csv`).
7. Merge PR theo thứ tự ở mục (b). **Đặt `CRON_SECRET` (≥ 16 ký tự) ở Vercel Production TRƯỚC khi merge #63** — sau #63 cron bắt buộc khoá; thiếu thì 3 cron (nhắc lớp, nhắc thi, hết hạn gói VIP) trả 503 và dừng.

## Đã dừng và vì sao
- **F2** (em ghi danh `suspended`/`pending_consent` bị báo "chưa ghi danh", ẩn phiếu học phí) — dính hiển thị học phí và tình trạng ghi danh trẻ em.
- **F3** (`currentYearMonth()` theo UTC) — dính tiền (phiếu tháng nào hiện).
- **NC2-013** — chờ xác nhận khung Figma 186:77; **NC2-027/028/029** — cần quyết định hoặc khoá của Thọ; **ĐX-08/ĐX-09** — Q6/Q7 chưa chốt.
- Hoàn tác tự điền tên gia sư ở ô "Gia sư" (NC2-021): ghi tên thật vào thẻ lớp công khai, mâu thuẫn công tắc Ẩn hồ sơ — chuyển thành đề xuất.

## Giới hạn và điều cần biết
- Chỉ số 7 và 9 của NC2-020 sai số cỡ một ngày (`Course.createdAt` là chuỗi, hai dạng chỉ có ngày); đã ghi trên màn.
- `/mentor/[id]` khi hồ sơ ẩn trả HTTP 200 kèm "Không tìm thấy gia sư" (như hồ sơ chưa duyệt); chỉ API trả 404.
- "Đã mở Zalo" của lịch tuần chỉ nằm trong phiên (mất khi tải lại).
- Rà soát độc lập (agent `kin-ra-soat`, chỉ đọc): "ĐƯỢC MỞ PR", không P1. Nợ P3 ở `tien-do-dang-do.md`.
- Các agent nghiên cứu/rà soát có thể sai: số liệu và điều luật trong tài liệu nháp chưa ai kiểm; chỉ coi là căn cứ để hỏi.
