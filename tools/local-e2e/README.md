# Bộ test chạy với Postgres + Next dev + Chromium thật

Đây là bản lưu của bộ test dùng trong lúc dựng các việc TT-200..203, FE-141..164, BE-074..076 (11/10/2026).
Trước đây nằm ở `scratchpad/` (bị gitignore nên mất theo container) — giữ ở đây để phiên sau chạy lại được.

**Không chạy trên DB thật.** `h.ts` có hàm `wipe()` TRUNCATE mọi bảng.

## Cần có
- Postgres 16 cục bộ (không cần pgvector: đổi `vector(768)` thành `text` khi dựng schema thử), cổng bất kỳ.
- `DATABASE_URL` trỏ vào DB thử, `SESSION_SECRET` giả — xem `env.example.sh`.
- Schema đã đẩy vào DB thử (`prisma db push`, hoặc cách WASM nếu máy chặn binaries.prisma.sh).
- Next dev ở cổng 3100 (`dev-start.sh`), trình duyệt Chromium (`ui.ts` trỏ đường dẫn Playwright — sửa cho khớp máy).
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
