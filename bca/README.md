# BCA Midnight — app quản lý lớp (Đợt 1, phần máy chủ)

App Next.js 16 độc lập trong `bca/` (không dùng chung gì với app KiN ở gốc kho).
Quy tắc nghiệp vụ: `docs/bca/nghiep-vu/*.md`. Quyết định của chủ: `docs/bca/QUYET-DINH.md`.

## Biến môi trường (chỉ qua env, không ghi vào mã)
| Biến | Dùng cho |
|---|---|
| `BCA_DATABASE_URL` | Chuỗi kết nối Postgres (KHÔNG dùng `DATABASE_URL` — tên đó của app KiN) |
| `BCA_SESSION_SECRET` | Khoá ký cookie phiên (≥ 16 ký tự). Bắt buộc ở mọi nơi trừ máy cục bộ (`VERCEL_ENV` chưa đặt và không `NODE_ENV=production`); thiếu thì ký/đọc phiên ném lỗi rõ, không dùng khoá mặc định |
| `BCA_DEV_LOGIN=1` | Bật đăng nhập thử theo vai (T40) — ở **mọi nơi, kể cả máy cục bộ**, còn phải có dấu `cai_dat.DU_LIEU_GIA` trong DB (do `seed-gia.ts` ghi; `chuyen-tu-sheet.ts` không bao giờ ghi và xoá nó khi `--apply`). `VERCEL_ENV=production`: luôn 404. Preview còn phải bật Deployment Protection của Vercel |

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
- `tests/vong-2.test.ts` — vòng 2: việc xong (T33), `nghi_luc` (T34), hoàn tác chuyển chính thức, tạo/ẩn hồ sơ, đổi lịch môn (T8), xoá buổi.
- `tests/chuyen.test.ts` — chuyen-tu-sheet trên DB rỗng với bảng tính giả: T34, đối soát số dòng + phân bố tình trạng (lệch ⇒ rollback), chặn `--apply` khi web đã vận hành, dòng nhật ký `chuyen_that`, xoá dấu `DU_LIEU_GIA`.
- `tests/vong-4.test.ts` — vòng làm gọn cuối Đợt 1 (BCA-D1-MC5): T42 xoá buổi tương lai + hoàn tác + sinh buổi còn thiếu, T43 xử lý đơn + hoàn tác, homNay tách 4 khối, `soNguyen` chặt, giới hạn nhật ký "từ chối", PATCH buổi rỗng, gia hạn số ngày sai, lọc `het_ngay`.
- `tests/hom-nay-ho-so-ban.test.ts` — một hồ sơ làm hỏng phép tính việc (giả lập bằng `vi.mock`) không làm sập màn Hôm nay.
- `tests/vong-3.test.ts` — vòng 3 (theo rà soát BCA-D1-RS-MC): đăng nhập thử theo môi trường, khoá ký bắt buộc, quyền các route còn thiếu, hạn hoàn tác 10 giây, gia hạn bỏ môn đã nghỉ, đầu vào sai ⇒ 400/404/409, thao tác đồng thời; các hàm bổ sung cho phòng Giao diện.

## Chuyển dữ liệu từ sheet
```bash
# xem trước (mặc định, rollback, chỉ in số đếm và số dòng sheet — không in nội dung ô)
npx tsx scripts/chuyen-tu-sheet.ts /đường/dẫn/ban-xuat.xlsx --ngay-chot=2026-11-26
# ghi thật (chỉ khi chủ quyết, T21)
npx tsx scripts/chuyen-tu-sheet.ts /đường/dẫn/ban-xuat.xlsx --ngay-chot=2026-11-26 --apply
```
- DB không phải `localhost` (kể cả xem trước) cần `BCA_CHO_PHEP_CHUYEN_THAT=1`.
- Lệch **bất kỳ** số đối soát nào ⇒ rollback: số dòng `lua/mon/hoc_sinh/ghi_danh/buoi_hoc/diem_danh/don_dang_ky` trong CSDL so với số đọc từ sheet (`doi_soat_so_dong`), phân bố tình trạng so với cột Tình trạng (`tinh_trang_sheet`), ô môn, sĩ số tháng ma trận.
- `--apply` ghi một dòng `nhat_ky` `hanh_dong = "chuyen_that"` (người dùng null, vai `he_thong`) và xoá `cai_dat.DU_LIEU_GIA`.
- Web đã vận hành (có nhật ký do người dùng, ghi danh có `tao_boi`, hoặc điểm danh `nguon = web`) ⇒ `--apply` bị từ chối (báo kèm lần `chuyen_that` trước). Chỉ khi chủ quyết ghi đè: thêm `--ghi-de-du-lieu-web`.
Không commit tệp `.xlsx` hay bất kỳ dữ liệu thật nào.

## Route và hàm thêm ở vòng 2 (BCA-D1-MC2)
Mọi route kiểm quyền ở máy chủ; "chỉ chủ" = GV/học sinh nhận 403 và có dòng nhật ký `tu_choi`.

| Route | Hàm (`server/`) | Ai | Việc |
|---|---|---|---|
| `POST /api/hom-nay/xong` `{loai, khoa}` | `hom-nay.danhDauXong` | chủ | T33: đánh dấu xong; ẩn 3 ngày (`het_thu`, `thu_sap_het`) hoặc hết hôm nay (việc khác). Mỗi việc trong `GET /api/hom-nay` có `khoa`; thẻ số không trừ việc đã ẩn; `so_viec_da_an` |
| `DELETE /api/hom-nay/xong?loai=&khoa=` | `hom-nay.boDanhDauXong` | chủ | T33: bỏ đánh dấu (Hoàn tác) |
| `POST /api/hoc-sinh/[maHs]/nghi-mon` `{mon: "anh" \| ["toan","anh"], denNgay?}` | `ghi-danh.nghiMon` | chủ | T34: cắt theo luật 22:00 và ghi `ghi_danh.nghi_luc` + `nghi_boi`. Em hết thử (không còn dòng mở) → chỉ ghi `nghi_luc` lên dòng cuối, giữ ngày → hết việc "Hết thử – hỏi em". Ghi chú không còn được đọc |

| `POST /api/hoc-sinh/[maHs]/chuyen-chinh-thuc` | `ghi-danh.chuyenChinhThuc` | chủ | Nay trả thêm `nhatKyId` để hoàn tác |
| `POST /api/hoc-sinh/[maHs]/chuyen-chinh-thuc/hoan-tac` `{nhatKyId}` | `ghi-danh.hoanTacChuyenChinhThuc` | chủ | Hoàn tác một lần, trong `HAN_HOAN_TAC_MS` = 10 giây (thanh 5 giây + 5 giây mạng); tất cả hoặc không: dòng đã bị sửa sau đó → 409 `da_sua`; quá hạn → 409 `het_gio`; lần hai → 409 `da_hoan_tac` |
| `POST /api/hoc-sinh` `{hoTen, ngayTao?, sdtHs?, sdtPh?, gmail?, hoTenPh?, truong?, khoi?, mucTieu?, nguon?, usernameAzota?, ghiChu?, ghiChuRieng?, dongYVinhDanh?}` | `hoc-sinh.taoHocSinh` | chủ | Tạo hồ sơ tay: mã từ `bo_dem` (không cấp lại), lứa theo ngày tạo, chuẩn hoá SĐT/Gmail; trả `goi_y_gmail`, `trung_sdt` (chỉ cảnh báo); trùng Gmail/Azota → 409 |
| `POST /api/hoc-sinh/[maHs]/an` `{denNgay?}` | `ghi-danh.anHocSinh` | chủ | T7: ẩn (không xoá cứng — không có `DELETE`); dừng mọi ghi danh còn mở theo luật 22:00, ghi `nghi_luc` |
| `POST /api/hoc-sinh/[maHs]/bo-an` | `ghi-danh.boAnHocSinh` | chủ | Bỏ ẩn; khôi phục ngày cũ chỉ khi bỏ ẩn **trong cùng ngày** (tick nhầm), chưa ghi danh lại và dòng chưa bị sửa (`khoi_phuc_ghi_danh`) |
| `PATCH /api/mon/[ma]` `{thu?, gio?, soPhut?, tuNgay?}` | `buoi-hoc.doiLichMon` | chủ | T8: buổi theo lịch từ `tuNgay` (≥ hôm nay, chưa bắt đầu) chưa có dữ liệu → xoá và sinh lại theo lịch mới trong các tháng đã sinh; buổi có dữ liệu giữ nguyên, trả ở `giu` (không sinh buổi thứ hai cùng ngày); `canh_bao` trùng giờ môn khác + số em học cả hai |
| `DELETE /api/buoi-hoc/[id]` | `buoi-hoc.xoaBuoi` | chủ | Xoá buổi chưa có dữ liệu; có điểm danh / nội dung / record / ghi chú / đã huỷ / có buổi bù → 409 `co_du_lieu` (chỉ huỷ được) |

## Vòng 3 (BCA-D1-MC3, sửa theo rà soát BCA-D1-RS-MC)
- **Hoàn tác** gia hạn / chuyển chính thức / "đánh tất cả": hạn `HAN_HOAN_TAC_MS` = 10 giây (`lib/quy-tac.ts`) tính từ lúc thao tác gốc (lưu trong nhật ký máy chủ, không tin giờ máy khách) ⇒ quá hạn 409 `het_gio`; lần hai 409 `da_hoan_tac`; hai lần cùng lúc ⇒ khoá dòng (`FOR UPDATE`) ⇒ một lần chạy, lần kia 409. Hoàn tác gia hạn mà đoạn thử sắp bị cắt/xoá đã có điểm danh ⇒ 409 `co_diem_danh`.
- `POST /api/diem-danh/[buoiId]/hoan-tac` nay chỉ cần `{ luc }` (trường `ids` cũ được bỏ qua — máy chủ lấy danh sách em từ nhật ký của chính người đó; `luc` không khớp ⇒ 404).
- Gia hạn chỉ áp môn đang thử **chưa bị chủ cho nghỉ** (T4 + T34); ngày hết mới phải sau ngày hết hiện tại (409).
- `chuyenChinhThuc` trả thêm `donGiaLaUocTinh: true` (tiền thật theo số môn có buổi trong kỳ — T5, Đợt 3).
- Đầu vào sai ⇒ 400 (tháng/ngày không có thật, id NaN/vượt int32, trạng thái đơn lạ), cookie `%` hỏng ⇒ 401, id người dùng không phải uuid ⇒ 404; trùng khoá duy nhất khi thao tác cùng lúc (vd. hai lần tạo cùng Gmail) ⇒ 409 `trung`, dòng vừa bị xoá ⇒ 409 `da_doi`.
- Điểm danh, huỷ/bỏ huỷ/xoá buổi khoá dòng `buoi_hoc` đầu transaction; mọi thay đổi buổi, người dùng, việc xong ghi cùng nhật ký trong một transaction.
- Đổi lịch môn: ngày trước `tuNgay` thuộc tháng chưa sinh buổi ⇒ 400 `thang_chua_sinh` (sinh buổi theo lịch cũ trước rồi mới đổi).

| Route / hàm mới cho phòng Giao diện | Ai | Việc |
|---|---|---|
| `PATCH /api/buoi-hoc/[id]` thêm `ghiChu` | chủ + GV môn | Ghi chú nội bộ buổi ≤ 500 ký tự; học sinh không bao giờ nhận |
| `PATCH /api/hoc-sinh/[maHs]` `{ghiChu?, ghiChuRieng?}` → `hoc-sinh.suaGhiChuHocSinh` | chủ | Sửa ghi chú hồ sơ (≤ 2.000 ký tự, rỗng = xoá), có nhật ký |
| `GET /api/buoi-hoc/sinh?thang=YYYY-MM&xem=1` → `buoi-hoc.xemTruocSinhBuoi` | chủ | Xem trước sinh buổi: theo môn `theo_lich / da_co / se_tao`, không ghi |
| `homNay`, `danhSachBuoi` | chủ + GV (môn mình) | Mỗi `mon` có thêm `ten_day_du`, `link_meet`, `giao_vien` (tên hiển thị GV phụ trách, không Gmail) |
| `hoc-sinh.demHocSinhDangHien(u)` | chủ + GV | Đếm nhẹ hồ sơ đang hiện (cùng lọc với danh sách theo vai) cho thanh bên |
| `chiTietHocSinh` thêm `caiDat: {GIA_1_MON, GIA_TU_2_MON}` | chỉ chủ | Đơn giá thật (đồng) từ `cai_dat` |
| `next.config.ts` `experimental.authInterrupts` | — | Trang gọi được `forbidden()` / `unauthorized()` để trả 403/401 thật |

T34 trong `lib/quy-tac.ts`: `hetThu` = lần ghi danh cuối toàn Thử, đã hết, **còn ít nhất một môn chưa bị chủ cho nghỉ**. `scripts/chuyen-tu-sheet.ts`: em có Tình trạng sheet "Đã nghỉ" mà theo ghi danh là "Hết thử – hỏi em" ⇒ đánh `nghi_luc` (báo ở `t34_chu_da_cho_nghi`).

## Vòng làm gọn cuối Đợt 1 (BCA-D1-MC5)
Không đổi schema, không có migration mới. Mọi route dưới đây kiểm quyền ở máy chủ; "chủ" = GV/học sinh nhận 403.

| Route | Hàm (`server/`) | Ai | Việc |
|---|---|---|---|
| `DELETE /api/buoi-hoc/[id]` | `buoi-hoc.xoaBuoi` | chủ | T42: chỉ buổi **chưa bắt đầu** và chưa có dữ liệu. Có dữ liệu → 409 `co_du_lieu`; đã qua / đang diễn ra → 409 `da_qua` (gợi ý Huỷ). Trả thêm `nhatKyId`; nhật ký `xoa_buoi` giữ bản chụp cả dòng |
| `POST /api/buoi-hoc/[id]/hoan-tac-xoa` `{nhatKyId}` | `buoi-hoc.hoanTacXoaBuoi` | chủ | Dựng lại đúng dòng cũ (cùng id) trong 10 giây; quá hạn 409 `het_gio`; lần hai 409 `da_hoan_tac`; đã có buổi khác cùng môn + giờ 409 `trung` |
| `GET /api/buoi-hoc/con-thieu?thang=YYYY-MM` | `buoi-hoc.xemTruocBuoiConThieu` | chủ | Xem trước "Sinh buổi còn thiếu": `se_tao`, `buoi: [{mon, ngay, gio}]`, `bo_qua_da_qua` (ngày thiếu đã qua — không sinh). Không ghi |
| `POST /api/buoi-hoc/con-thieu` `{thang}` | `buoi-hoc.sinhBuoiConThieu` | chủ | Chỉ thêm buổi theo lịch cho ngày mà môn chưa có buổi theo lịch nào (buổi đã huỷ hoặc đã dời giờ vẫn tính là có), chỉ buổi chưa bắt đầu; không đụng buổi có sẵn; lặp lại an toàn |
| `GET /api/don/[id]/tao-ho-so` | `don.xemTruocDon` | chủ | Hồ sơ điền sẵn từ đơn (`ho_so`), `mon`, `ngay_dang_ky`, `thu_du_kien {tu, den}`, `muon_chinh_thuc`, `trung: [{ma_hs, ho_ten, khop: ["gmail"/"sdt"/"don_da_gan"], ten_giong, an}]`, `da_xu_ly` |
| `POST /api/don/[id]/tao-ho-so` `{maHs?, taoMoi?, capThuMoi?, hoSo?}` | `don.taoHoSoTuDon` | chủ | T43 + T1–T3, xem `ket_qua` bên dưới. Đơn → `da_nhan`, gắn `hoc_sinh_id`. Đơn đã xử lý → 409 `da_xu_ly`; hồ sơ `maHs` đang ẩn → 409 `ho_so_an` |
| `POST /api/don/[id]/bo-qua` `{lyDo}` | `don.boQuaDon` | chủ | Đơn → `bo_qua`, lý do (bắt buộc, ≤ 500) vào `ghi_chu_xu_ly`; trả `nhatKyId` |
| `POST /api/don/[id]/hoan-tac` `{nhatKyId}` | `don.hoanTacXuLyDon` | chủ | Hoàn tác tạo hồ sơ hoặc bỏ qua trong 10 giây, tất cả hoặc không: xoá ghi danh vừa tạo, trả các ô vừa điền về trống, hồ sơ mới thì xoá (mã không cấp lại), đơn về trạng thái cũ. Em đã có điểm danh → 409 `co_diem_danh`; đã bị sửa → 409 `da_sua`; `het_gio`, `da_hoan_tac` như các hoàn tác khác |
| `GET /api/hoc-sinh?het_ngay=YYYY-MM-DD` | `hoc-sinh.danhSachHocSinh(u, {hetNgay})` | chủ + GV | Chỉ em có ngày hết thử đúng ngày đó, cùng cách nhóm của Hôm nay (`hoc-sinh.ngayHetThu`: đang thử ⇒ hạn thử chung; đã hết ⇒ ngày hết). Ngày sai → 400 |
| `POST /api/gia-han` | `ghi-danh.giaHanThu` | chủ | Số ngày ngoài 1–60 / không phải số nguyên / thiếu cả `soNgay` lẫn `denNgay` → **400** (trước là 409) |
| `PATCH /api/buoi-hoc/[id]` | `buoi-hoc.suaNoiDungBuoi` | chủ + GV môn | Không có trường nào trong `noiDung`, `linkRecord`, `ghiChu` → 400, không ghi nhật ký |

`ket_qua` của `POST /api/don/[id]/tao-ho-so`:
- `"da_tao"` / `"da_gan"` — kèm `nhatKyId`, `ma_hs`, `thu {tu, den}` (null nếu không tạo ghi danh), `mon` (môn đã ghi danh thử), `bo_qua: [{mon, ly_do: "dang_thu" | "dang_chinh_thuc"}]`, `muon_chinh_thuc`, `dien` (ô hồ sơ cũ vừa được điền); hồ sơ mới thêm `lua`, `goi_y_gmail`, `trung_sdt`.
- `"trung_ho_so"` — có hồ sơ trùng Gmail hoặc SĐT HS/PH (ghi-danh.md 1.4): **chưa ghi gì**, trả `goi_y`. Gửi lại kèm `maHs` (gắn vào hồ sơ cũ, chỉ điền ô đang trống) hoặc `taoMoi: true`.
- `"can_chu_quyet"` — **chưa ghi gì**, `ly_do`: `"het_thu_dang_ky_lai"` (T2: em đã hết thử đăng ký lại) hoặc `"don_qua_han"` (nhận đơn khi 14 ngày tính từ ngày đăng ký đã hết). Chủ gửi lại `capThuMoi: true` ⇒ thử 14 ngày từ hôm nay (như gia hạn sau khi hết thử, 5.4); hoặc Bỏ qua.
- Khoảng thử: hết ngày đăng ký + 13 (T1); bắt đầu từ ngày đăng ký, hoặc từ hôm nay nếu nhận đơn muộn (không phủ ngược để khỏi sinh buổi "chưa điểm danh" giả, 5.4). Em đang thử ⇒ môn mới hết cùng hạn chung (5.2). Đơn "Chính thức" ⇒ vẫn ghi danh **thử**, `muon_chinh_thuc: true` (T3); chủ bấm chuyển chính thức như cũ.
- Đơn đã xử lý tự hết khỏi việc "Đơn chờ duyệt" ở Hôm nay (chỉ đơn `moi` / `cho_duyet` được tính).

Hàm mới (không có route riêng — trang gọi thẳng):
- `hom-nay.lopToiNay(u, luc)` · `viecCanLam(u, luc)` → `{viec, so_viec_da_an}` · `theSo(u, luc)` · `lich7Ngay(u, luc)`; `homNay` gọi cả 4 song song và trả đúng dạng cũ (`GET /api/hom-nay` không đổi). Mỗi khối chỉ nạp khoảng ngày nó cần (tối nay: hôm qua + hôm nay). Tính việc từng em bọc try/catch: hồ sơ làm lỗi chỉ thành việc `sua_du_lieu` với `loi: ["loi_tinh"]`. Việc `het_thu` / `thu_sap_het` có thêm `lua` (mã lứa) và `sdt_hs` (chỉ chủ nhận các việc này).
- `hoc-sinh.taoHoSoTx(tx, u, v, luc)` — phần ghi của `taoHocSinh`, dùng chung với tạo hồ sơ từ đơn.
- `lib/chuan-hoa.tenGiong(a, b)` — so tên theo ghi-danh.md 1.4.
- `server/api.soNguyen`: chuỗi phải khớp `^-?\d+$` (`"0x2"`, `"1e3"`, `" 2"`, `true` → 400).
- `server/nhat-ky.ghiTuChoi`: nhật ký `tu_choi` tối đa 1 dòng / người / (phương thức + đường dẫn) / phút; `doi_tuong_id` = `"POST /api/…"`.

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
