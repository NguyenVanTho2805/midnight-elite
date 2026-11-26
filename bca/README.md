# BCA Midnight — app quản lý lớp (Đợt 1, phần máy chủ)

App Next.js 16 độc lập trong `bca/` (không dùng chung gì với app KiN ở gốc kho).
Quy tắc nghiệp vụ: `docs/bca/nghiep-vu/*.md`. Quyết định của chủ: `docs/bca/QUYET-DINH.md`.

## Biến môi trường (chỉ qua env, không ghi vào mã)
| Biến | Dùng cho |
|---|---|
| `BCA_DATABASE_URL` | Chuỗi kết nối Postgres (KHÔNG dùng `DATABASE_URL` — tên đó của app KiN) |
| `BCA_SESSION_SECRET` | Khoá ký cookie phiên (≥ 16 ký tự). Bắt buộc ngoài máy dev |
| `BCA_DEV_LOGIN=1` | Bật đăng nhập thử theo vai. Bị bỏ qua khi `VERCEL_ENV=production` |

## Cài và chạy dev
```bash
cd bca
npm install
export BCA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bca
npx prisma migrate deploy        # tạo bảng + ràng buộc (btree_gist, EXCLUDE chống chồng ngày)
npx prisma generate
npx tsx scripts/seed-gia.ts      # dữ liệu GIẢ (xoá sạch DB trước — chỉ DB cục bộ)
BCA_DEV_LOGIN=1 BCA_DATABASE_URL=$BCA_DATABASE_URL npm run dev -- -p 3100
```
Mở http://localhost:3100/dang-nhap → chọn vai (chủ lớp, GV Toán, GV Anh, HS chính thức, HS thử còn hạn, HS hết hạn).
Trang `/quan-ly` và `/hoc` chỉ là trang chẩn đoán; màn thật do phòng Giao diện dựng.

## Test
Test xoá sạch và seed lại DB, nên phải dùng DB riêng tên `*_test`:
```bash
createdb -h localhost -U postgres bca_test   # một lần
BCA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bca_test npx prisma migrate deploy
BCA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bca_test BCA_SESSION_SECRET=bi-mat-chi-de-test-0123456789 npm test
npx tsc --noEmit
```
- `tests/quy-tac.test.ts` — thuần: ngày thử, mặc định, tiền (đồng), quyền.
- `tests/api-quyen.test.ts` — gọi route handler thật theo vai (chủ / GV / học sinh), 401/403/404.
- `tests/nghiep-vu-db.test.ts` — nghiệp vụ trên DB với giờ cố định (26/11/2026).

## Chuyển dữ liệu từ sheet
```bash
# xem trước (mặc định, rollback, chỉ in số đếm và số dòng sheet)
npx tsx scripts/chuyen-tu-sheet.ts /đường/dẫn/ban-xuat.xlsx --ngay-chot=2026-11-26
# ghi thật (DB cục bộ; DB khác cần BCA_CHO_PHEP_CHUYEN_THAT=1 — chỉ khi chủ quyết, T21)
npx tsx scripts/chuyen-tu-sheet.ts /đường/dẫn/ban-xuat.xlsx --ngay-chot=2026-11-26 --apply
```
Không commit tệp `.xlsx` hay bất kỳ dữ liệu thật nào.

## Cấu trúc
```
app/(quan-ly)/quan-ly/   trang chẩn đoán khu quản lý
app/(hoc-sinh)/hoc/      trang chẩn đoán khu học sinh
app/dang-nhap/           đăng nhập thử (BCA_DEV_LOGIN=1)
app/api/**/route.ts      route handlers (mỏng: đọc request → gọi server/*)
lib/                     hàm thuần: ngày giờ VN, quy tắc nghiệp vụ, quyền, chuẩn hoá
server/                  truy vấn + kiểm quyền + nhật ký (mọi hàm nhận người dùng hiện tại)
proxy.ts                 tự gia hạn cookie phiên 30 ngày (không kiểm quyền)
prisma/                  schema + migrations
scripts/                 seed-gia.ts, chuyen-tu-sheet.ts
tests/                   vitest
```
