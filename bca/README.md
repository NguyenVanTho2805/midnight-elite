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
- `tests/vong-2.test.ts` — vòng 2: việc xong (T33), `nghi_luc` (T34, cả chuyen-tu-sheet với bảng tính giả), hoàn tác chuyển chính thức, tạo/ẩn hồ sơ, đổi lịch môn (T8), xoá buổi.

## Chuyển dữ liệu từ sheet
```bash
# xem trước (mặc định, rollback, chỉ in số đếm và số dòng sheet)
npx tsx scripts/chuyen-tu-sheet.ts /đường/dẫn/ban-xuat.xlsx --ngay-chot=2026-11-26
# ghi thật (DB cục bộ; DB khác cần BCA_CHO_PHEP_CHUYEN_THAT=1 — chỉ khi chủ quyết, T21)
npx tsx scripts/chuyen-tu-sheet.ts /đường/dẫn/ban-xuat.xlsx --ngay-chot=2026-11-26 --apply
```
Không commit tệp `.xlsx` hay bất kỳ dữ liệu thật nào.

## Route và hàm thêm ở vòng 2 (BCA-D1-MC2)
Mọi route kiểm quyền ở máy chủ; "chỉ chủ" = GV/học sinh nhận 403 và có dòng nhật ký `tu_choi`.

| Route | Hàm (`server/`) | Ai | Việc |
|---|---|---|---|
| `POST /api/hom-nay/xong` `{loai, khoa}` | `hom-nay.danhDauXong` | chủ | T33: đánh dấu xong; ẩn 3 ngày (`het_thu`, `thu_sap_het`) hoặc hết hôm nay (việc khác). Mỗi việc trong `GET /api/hom-nay` có `khoa`; thẻ số không trừ việc đã ẩn; `so_viec_da_an` |
| `DELETE /api/hom-nay/xong?loai=&khoa=` | `hom-nay.boDanhDauXong` | chủ | T33: bỏ đánh dấu (Hoàn tác) |
| `POST /api/hoc-sinh/[maHs]/nghi-mon` `{mon: "anh" \| ["toan","anh"], denNgay?}` | `ghi-danh.nghiMon` | chủ | T34: cắt theo luật 22:00 và ghi `ghi_danh.nghi_luc` + `nghi_boi`. Em hết thử (không còn dòng mở) → chỉ ghi `nghi_luc` lên dòng cuối, giữ ngày → hết việc "Hết thử – hỏi em". Ghi chú không còn được đọc |

| `POST /api/hoc-sinh/[maHs]/chuyen-chinh-thuc` | `ghi-danh.chuyenChinhThuc` | chủ | Nay trả thêm `nhatKyId` để hoàn tác |
| `POST /api/hoc-sinh/[maHs]/chuyen-chinh-thuc/hoan-tac` `{nhatKyId}` | `ghi-danh.hoanTacChuyenChinhThuc` | chủ | Hoàn tác một lần, trong `HAN_HOAN_TAC_CT_MS` = 10 giây (thanh 5 giây + 5 giây mạng); tất cả hoặc không: dòng đã bị sửa sau đó → 409 `da_sua`; quá hạn → 409 `het_gio`; lần hai → 409 `da_hoan_tac` |
| `POST /api/hoc-sinh` `{hoTen, ngayTao?, sdtHs?, sdtPh?, gmail?, hoTenPh?, truong?, khoi?, mucTieu?, nguon?, usernameAzota?, ghiChu?, ghiChuRieng?, dongYVinhDanh?}` | `hoc-sinh.taoHocSinh` | chủ | Tạo hồ sơ tay: mã từ `bo_dem` (không cấp lại), lứa theo ngày tạo, chuẩn hoá SĐT/Gmail; trả `goi_y_gmail`, `trung_sdt` (chỉ cảnh báo); trùng Gmail/Azota → 409 |
| `POST /api/hoc-sinh/[maHs]/an` `{denNgay?}` | `ghi-danh.anHocSinh` | chủ | T7: ẩn (không xoá cứng — không có `DELETE`); dừng mọi ghi danh còn mở theo luật 22:00, ghi `nghi_luc` |
| `POST /api/hoc-sinh/[maHs]/bo-an` | `ghi-danh.boAnHocSinh` | chủ | Bỏ ẩn; khôi phục ngày cũ chỉ khi bỏ ẩn **trong cùng ngày** (tick nhầm), chưa ghi danh lại và dòng chưa bị sửa (`khoi_phuc_ghi_danh`) |
| `PATCH /api/mon/[ma]` `{thu?, gio?, soPhut?, tuNgay?}` | `buoi-hoc.doiLichMon` | chủ | T8: buổi theo lịch từ `tuNgay` (≥ hôm nay, chưa bắt đầu) chưa có dữ liệu → xoá và sinh lại theo lịch mới trong các tháng đã sinh; buổi có dữ liệu giữ nguyên, trả ở `giu` (không sinh buổi thứ hai cùng ngày); `canh_bao` trùng giờ môn khác + số em học cả hai |
| `DELETE /api/buoi-hoc/[id]` | `buoi-hoc.xoaBuoi` | chủ | Xoá buổi chưa có dữ liệu; có điểm danh / nội dung / record / ghi chú / đã huỷ / có buổi bù → 409 `co_du_lieu` (chỉ huỷ được) |

T34 trong `lib/quy-tac.ts`: `hetThu` = lần ghi danh cuối toàn Thử, đã hết, **còn ít nhất một môn chưa bị chủ cho nghỉ**. `scripts/chuyen-tu-sheet.ts`: em có Tình trạng sheet "Đã nghỉ" mà theo ghi danh là "Hết thử – hỏi em" ⇒ đánh `nghi_luc` (báo ở `t34_chu_da_cho_nghi`).

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
