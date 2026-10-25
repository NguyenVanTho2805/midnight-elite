# Rà soát gói "Nâng cấp lần 2" so với GitHub, sheet và báo cáo research

Ngày 22/10/2026. Người rà: Claude Code (phiên của Thanh). Đối chiếu: gói `nang-cap-2` (6 tệp), kho `NguyenVanTho2805/midnight-elite` (`main` = `de1fb2e`, nhánh `claude/keen-allen-wiz3em` = `3b06e8e`), sheet `Todo list - Kin class` (3 tab), bản chữ báo cáo research 2.1.

## 1. Kết luận một dòng
Gói **đúng về hiện trạng mã** (mọi khẳng định kiểm lại đều khớp) nhưng **chưa đủ** ở 3 chỗ: thiếu việc rà trang phụ huynh (NC2-026), vài chỗ prompt không chạy đúng như viết (đã sửa lúc làm, ghi ở mục 3), và hai khoảng trống so với báo cáo research chưa có việc nào (mục 4).

## 2. Đã kiểm và khớp
| Khẳng định của gói | Kiểm bằng | Kết quả |
|---|---|---|
| `main` ở `de1fb2e`, nhánh đi trước 20 commit / 107 tệp, chưa có PR | `git rev-list`, `gh pr list` | Đúng (0 sau, 20 trước; trước lượt này chưa có PR của nhánh) |
| 19 mã commit ĐX và test chung | `git log origin/main..origin/claude/keen-allen-wiz3em` | Đủ, đúng thứ tự (trừ `f5d33c0`, xem mục 3) |
| NC2-010: ba route `reported` chưa gọi `notify()` | `grep notify` ở `api/phieu`, `api/parent-portal`, `api/users/me/invoices` | Đúng, không route nào gọi |
| NC2-011: có `loadUnmarkedSessions` (ĐX-01) | `src/lib/unmarkedServer.ts:21` | Đúng |
| NC2-020: số đo chưa có chỉ số kích hoạt gia sư | `grep` ở `healthMetrics*.ts` | Đúng, chưa có |
| NC2-022: chưa có công tắc ẩn hồ sơ | `grep hidden\|profileVisible\|isPublic` | Đúng, chưa có |
| NC2-023: `isActiveTutorVIP` chưa khoá tính năng nào | `grep` | Đúng: định nghĩa ở `tutorSubscription.ts:38`, không nơi nào gọi |
| NC2-024: chưa có "gửi lịch tuần qua Zalo" | `LichClient.tsx` | Đúng: chỉ có nhắc từng buổi và báo đổi lịch (dùng `openZalo`), không có lịch tuần của lớp |
| Sheet tab "Nâng cấp lần 1" khớp CSV lần 2 (Q1…Q13, NC1-030/031/033/034/046/080/100) | đọc 71 dòng | Khớp |
| Cột H/I/J/K đọc được và Thanh có ghi chú | đọc sheet | Đúng; không chạm J/K |

## 3. Chỗ gói/prompt không chạy đúng như viết (đã xử lý lúc làm)
1. **"6 agent"** (`00-DOC-TRUOC.md`) — thực tế 7 (`kin-dieu-phoi` là agent thứ bảy). Không ảnh hưởng.
2. **PR1 bỏ sót `f5d33c0`** (tài liệu "Kế hoạch phát triển thêm", commit đầu tiên của nhánh) — danh sách commit PR1–PR8 trong prompt không có nó. Đã đưa vào PR1.
3. **"Test chung vào PR1" không làm được.** Prompt xếp 10 commit hạ tầng test vào PR1 nhưng phần lớn sửa tệp do ĐX sau tạo ra; cherry-pick vào PR1 xung đột thật (`24e0fcd`, `53c9052`, `807259e`, `3b06e8e`) hoặc tham chiếu tệp chưa có (`99a11af`, `e6b3548`, `8d2089e`, `32b9978`). Cách làm: mỗi commit đi vào PR đầu tiên mà mọi tệp nó chạm đã tồn tại. Hệ quả ghi trong mô tả PR: mục "Chạy thật 22/10" của `tien-do-dang-do.md` chỉ có từ PR8; lỗi ngày "22-10" ở `/admin/so-do` chỉ được sửa ở PR8. Phép kiểm bất biến: `git diff origin/claude/keen-allen-wiz3em claude/nc2-pr8-dx02` rỗng (đã chạy lại độc lập).
4. **NC2-011 "cuối cron `remind-class`" sai vị trí.** Cron thoát sớm (`return`, `route.ts:61`) khi ngày mai không có buổi nào, nên tin "hôm qua chưa điểm danh" đặt cuối cron sẽ không bao giờ chạy đúng những ngày gia sư nghỉ. Ghi chú NC1-030 đã cảnh báo; phiếu việc NC2-011 không nhắc. Đã giao việc với yêu cầu tách phần này ra TRƯỚC lệnh return.
5. **Q12 đảo một chốt cũ.** Ghi chú NC1-030 (21/10): "Thọ chốt để sau, làm khi kiểm tay xong". Prompt Q12 (22/10): "viết mã ngay, công tắc TẮT". Đã làm theo prompt vì mới hơn và an toàn (không gửi gì khi chưa bật); cần Thọ xác nhận.
6. **Hướng dẫn kiểm thử là của Linux.** `kin-kiem-thu` và README mô tả `pg_ctlcluster`, `gen-schema-sql.mjs`, `neon-ws-proxy.mjs`, `/opt/pw-browsers/...`. Trên Mac: Postgres + pgvector bằng Homebrew, bỏ cách WASM, cầu nối WebSocket riêng, `ui.ts` ghi cứng đường dẫn Chromium. Đã thêm `CHROMIUM_PATH`, cổng theo `BASE`, mục "Dựng môi trường thử trên Mac" ở `tools/local-e2e/README.md`.
7. **`dev-start.sh` nguy hiểm khi có máy chủ khác đang chạy:** nó dừng mọi tiến trình `next`. Đã ghi vào README; lượt này dùng bản sao riêng và cổng riêng.
8. **Tab "Nâng cấp lần 2" chưa có trên sheet** (bước 2 của `00-DOC-TRUOC.md` để người dùng dán tay). Sẽ tạo khi ghi sổ (NC2-090).

## 4. Khoảng trống so với báo cáo research mà gói chưa có việc
Đối chiếu mục 8.2–8.6 của báo cáo (`research-so-gia-su-2026-10-19.md`):
| Báo cáo đề xuất | KiN hiện có | Đề xuất |
|---|---|---|
| 8.6 #8 + 3.5: trang phụ huynh báo "chưa có buổi" vì lọc theo ngày thay vì trạng thái | Chưa ai kiểm | **NC2-026 (mới, đã làm xong phần rà):** KiN không có đúng lỗi này, nhưng có lỗi ngược (buổi nghỉ tương lai bị đếm) và 2 lỗi nữa — xem `nc2-026-ra-soat-trang-phu-huynh.md`. Sửa F1 ở NC2-026a; F2, F3 dừng vì dính hiển thị học phí/ghi danh trẻ em |
| 8.4A: đăng ký bằng Google hoặc số điện thoại | Email + mã 6 số + mật khẩu; SMS đã mã nhưng tắt chờ nhà cung cấp; **Google chưa có** | **NC2-027 (mới, việc của Thọ):** cần client OAuth của Google; chưa viết mã |
| 8.1 #4, 8.2.1: "mọi hạn mức Free/Pro phải cấu hình được từ admin" | Không có hạn mức nào (KiN chưa khoá gì); `TUTOR_VIP_PLANS` viết cứng | **NC2-028 (mới, chưa làm):** chỉ khi bật Pro (dính tiền, Q9); NC2-023 chỉ thêm cờ ẩn lối mua |
| 8.6 #6: nhiều giáo viên / trợ giảng, "đo nhu cầu bằng câu hỏi trong app" | Không có | Ghi nhận, giai đoạn 3 của báo cáo; chưa làm |
| 8.6 #2, #10: đổi hình thức phí, gói N buổi | KiN tính theo tháng (quyết định 27/09) | Không làm (đã ghi ở `ke-hoach-phat-trien-tu-research.md` mục 6) |
| 8.6 #7: PIN cho link phụ huynh | Token 128-bit, thu hồi, "đã xem lúc" | Không làm PIN; nhưng dự thảo chính sách (NC2-025) nêu link phụ huynh là điểm rủi ro cao nhất → hỏi luật sư (Q-LS) |
| 8.4A "vào thẳng màn Tạo lớp đầu tiên, không màn tổng quan trống" | Chưa đo | NC2-021 đo bằng bài trình duyệt |

## 5. Việc của Thanh/Thọ phát sinh từ rà soát
- Xác nhận Q12 (mục 3.5) và đồng ý đưa `docs/kin/bao-cao/*.md` (4 tệp mới do agent soạn) vào kho — chúng là **bản nháp**, chưa ai duyệt.
- Nội dung `cau-hoi-luat-su.md` Q-LS-01: hai tài liệu trong kho viện hai văn bản khác nhau cho dữ liệu cá nhân (Nghị định 13/2023 ở `CLAUDE-cho-kho-trien-khai.md`; Luật 91/2025 + NĐ 356/2025 trong mục 7 của Thanh ngày 01/10). Cần luật sư chốt trước khi dùng làm căn cứ.
- NC2-012 đề nghị Thọ tick TK-170 (Figma 32:54 đã dựng 13/10; test `t-invite-preview` 14, `ui-invite-input` 26).
