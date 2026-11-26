# BCA Midnight — app quản lý lớp (Đợt 1 + đăng nhập Google của Đợt 2)

App Next.js 16 độc lập trong `bca/` (không dùng chung gì với app KiN ở gốc kho).
Quy tắc nghiệp vụ: `docs/bca/nghiep-vu/*.md`. Quyết định của chủ: `docs/bca/QUYET-DINH.md`.

## Biến môi trường (chỉ qua env, không ghi vào mã)
| Biến | Dùng cho |
|---|---|
| `BCA_DATABASE_URL` | Chuỗi kết nối Postgres (KHÔNG dùng `DATABASE_URL` — tên đó của app KiN) |
| `BCA_SESSION_SECRET` | Khoá ký cookie phiên (≥ 16 ký tự). Bắt buộc ở mọi nơi trừ máy cục bộ (`VERCEL_ENV` chưa đặt và không `NODE_ENV=production`); thiếu thì ký/đọc phiên ném lỗi rõ, không dùng khoá mặc định |
| `BCA_GOOGLE_CLIENT_ID` | Client ID của OAuth Client (loại Web application) trong Google Cloud. Thiếu (hoặc thiếu SECRET) ⇒ trang `/dang-nhap` ẩn nút Google và báo rõ, route trả về `/dang-nhap?loi=chua_cau_hinh`, không sập |
| `BCA_GOOGLE_CLIENT_SECRET` | Client secret của OAuth Client đó. Chỉ đặt ở Vercel / máy mình, không ghi vào mã hay tệp |
| `BCA_APP_URL` | Tuỳ chọn, **khuyên đặt cho Production** (vd. `https://<địa chỉ web>`): gốc dùng để dựng `redirect_uri` = `<BCA_APP_URL>/api/dang-nhap/google/callback`. Không đặt ⇒ dùng gốc của request. Không đặt cho Preview (sẽ chuyển người dùng sang địa chỉ production và báo "hết hạn") |
| `BCA_GMAIL_CHU` | Gmail của chủ lớp (một địa chỉ, so dạng gốc T48). **Chỉ khi DB chưa có tài khoản chủ nào còn hoạt động**: Gmail này đăng nhập Google lần đầu ⇒ tạo tài khoản chủ (T54). Đã có chủ còn hoạt động ⇒ biến bị bỏ qua hoàn toàn |
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

## Đăng nhập Google (Đợt 2, BCA-D2-DN)
OpenID Connect, luồng authorization code + PKCE (S256) + state + nonce; chỉ dùng `jose` + `fetch` (không thêm thư viện).
1. `GET /api/dang-nhap/google` (nút "Đăng nhập bằng Google") — sinh `state`, `nonce`, `code_verifier` (32 byte ngẫu nhiên), cất trong cookie ký `bca_google` (HttpOnly, SameSite=Lax, 10 phút, `Path=/api/dang-nhap/google`), chuyển sang Google với `scope=openid email`, `prompt=select_account`.
2. `GET /api/dang-nhap/google/callback` — state phải khớp cookie (sai/thiếu/hết hạn ⇒ `het_han`, không gọi Google); đổi `code` + `code_verifier` ở `oauth2.googleapis.com/token`; kiểm `id_token` bằng JWKS của Google (RS256, `iss`, `aud` = client id, hạn, `nonce`), bắt buộc `email_verified`.
3. Đối chiếu Gmail (dạng gốc — T48: `@gmail.com`/`@googlemail.com` bỏ dấu chấm và `+…`, không phân biệt hoa thường) lần lượt với `nguoi_dung.gmail` (chủ/GV, T49 ưu tiên) rồi `hoc_sinh.gmail`. **Không tự tạo tài khoản** (T17). Cấp cookie phiên `bca_phien` như cũ (`server/token.ts`, 30 ngày tự gia hạn) rồi về `/`.
4. Từ chối ⇒ về `/dang-nhap?loi=<mã>`, trang hiện câu tiếng Việt: `khong_co_tai_khoan`, `tai_khoan_khoa`, `ho_so_an` (T41), `trung_gmail` (hai hồ sơ cùng một hộp Gmail), `chua_xac_minh`, `huy` (bấm Huỷ ở Google), `het_han`, `google_loi`, `chua_cau_hinh`. Không có Gmail trong địa chỉ hay nhật ký; không ghi nhật ký khi đăng nhập (chuyen-tu-sheet coi nhật ký có người dùng là "web đã vận hành").
5. Đăng nhập thử theo vai giữ nguyên điều kiện T40, hiện dưới nút Google, không bao giờ ở production.

T41 — khoá phiên học sinh: cột mới `hoc_sinh.phien_huy_luc` (migration `20261126180000_hoc_sinh_phien_huy`, chỉ thêm cột). Phiên học sinh hết hiệu lực ngay khi hồ sơ bị ẩn hoặc chủ bấm "Đăng xuất em khỏi mọi máy…" ở hồ sơ (`POST /api/hoc-sinh/[maHs]/thu-hoi-phien`, chỉ chủ, có nhật ký). Em vẫn đăng nhập lại bằng Google được.

### Tài khoản chủ / giáo viên
- **Chủ đầu tiên (T54):** đặt `BCA_GMAIL_CHU` ở Vercel. Khi DB chưa có chủ nào còn hoạt động (vai `chu`, chưa khoá), Gmail đó đăng nhập Google lần đầu thì máy chủ tạo tài khoản chủ (tên "Chủ lớp", sửa được ở màn Tài khoản). Hai lần đăng nhập cùng lúc chạy lần lượt (khoá tư vấn Postgres) ⇒ chỉ một chủ. Ghi một dòng nhật ký `tao_chu_dau_tien` vai `he_thong`, `nguoi_dung_id` null — không tính là "web đã vận hành" nên không chặn `chuyen-tu-sheet --apply` (T52). Đã có chủ còn hoạt động ⇒ biến bị bỏ qua (Gmail đó đăng nhập như mọi người). Gmail đã có tài khoản bị khoá ⇒ vẫn bị từ chối "đã khoá".
- **Giáo viên:** chủ thêm ở màn **Tài khoản** (`/quan-ly/tai-khoan`, T55; thanh bên "Tài khoản", điện thoại: Thêm → "Tài khoản giáo viên"). Chỉ chủ thấy; mọi route kiểm quyền ở máy chủ trước khi đọc tham số (GV/học sinh ⇒ 403):

| Route | Hàm (`server/nguoi-dung.ts`) | Việc |
|---|---|---|
| `POST /api/nguoi-dung` `{gmail, ten, mon?}` | `themGiaoVien` | Thêm GV. Gmail chuẩn hoá; trùng hộp Gmail (T48) với tài khoản có sẵn ⇒ 409 `trung`; gõ nhầm đuôi ⇒ 400 kèm gợi ý; Gmail đang ghi trên hồ sơ học sinh ⇒ vẫn thêm, trả `trung_ho_so_hs` (T49). Nhật ký `them_giao_vien` |
| `PATCH /api/nguoi-dung/[id]` `{ten?, mon?}` | `suaNguoiDung` | Sửa tên (mọi tài khoản); đặt lại môn của GV (chủ ⇒ 400) — bỏ môn có hiệu lực ngay. Nhật ký `phan_cong` / `sua_nguoi_dung` có trước/sau |
| `POST /api/nguoi-dung/[id]/khoa` `{khoa: boolean}` | `datKhoaTaiKhoan` | Khoá (kèm thu hồi mọi phiên) / mở khoá (phiên cũ vẫn hết). Chủ còn hoạt động cuối cùng ⇒ 409 `chu_cuoi` (kể cả tự khoá mình, kể cả hai chủ khoá nhau cùng lúc — khoá tư vấn Postgres) |
| `POST /api/nguoi-dung/[id]/thu-hoi-phien` `{khoaTaiKhoan?}` | `thuHoiPhien` | Đăng xuất mọi máy; `khoaTaiKhoan` cùng luật chủ cuối |

Việc tài khoản và nhật ký "từ chối" không tính là "web đã vận hành" (`HANH_DONG_KHONG_TINH` trong `chuyen-tu-sheet.ts`) ⇒ chủ thêm GV trước khi chuyển dữ liệu thật vẫn chạy được `--apply`.
- **Dự phòng** (khi không vào được web): script lặp lại an toàn, không xoá gì, không mở khoá tài khoản đã khoá, nhật ký vai `he_thong`:
```bash
BCA_DATABASE_URL=<chuỗi Neon> npx tsx scripts/them-nguoi-dung.ts --gmail <gmail chủ> --ten "Tên hiển thị" --vai chu
BCA_DATABASE_URL=<chuỗi Neon> npx tsx scripts/them-nguoi-dung.ts --gmail <gmail GV> --ten "Chị Hoa" --vai giao_vien --mon toan
```
`--mon` là mã môn (`toan`, `su`, `dia`, `anh`), cách nhau dấu phẩy; bảng môn có sau khi chạy `chuyen-tu-sheet.ts --apply`. Kết quả in `canh_bao` nếu cùng hộp Gmail đã có ở tài khoản khác hoặc trên hồ sơ học sinh.

### Việc của chủ ngoài mã (một lần)
1. **Google Cloud Console** (miễn phí) → chọn/tạo project → *Google Auth Platform* (OAuth consent screen): User type **External**, tên app "BCA Midnight", email hỗ trợ; *Data access*: chỉ `openid` và `.../auth/userinfo.email` (không nhạy cảm ⇒ không cần Google duyệt); *Audience*: bấm **Publish app** (để "Testing" thì chỉ Gmail trong danh sách test user vào được).
2. *Clients* → **Create client** → Application type **Web application** → *Authorized redirect URIs*: `https://<địa chỉ production của bca-midnight>/api/dang-nhap/google/callback` (thêm `http://localhost:3100/api/dang-nhap/google/callback` nếu muốn thử trên máy). Không cần *Authorized JavaScript origins*. Lưu Client ID + Client secret.
3. **Vercel → project `bca-midnight` → Environment Variables**, môi trường **Production**: `BCA_GOOGLE_CLIENT_ID`, `BCA_GOOGLE_CLIENT_SECRET`, `BCA_APP_URL=https://<địa chỉ production>`, `BCA_GMAIL_CHU=<Gmail của chủ>` và `BCA_DATABASE_URL` (Neon). `BCA_SESSION_SECRET` đã có. **Không** đặt `BCA_DEV_LOGIN` cho Production. Preview không cần biến Google (địa chỉ preview đổi mỗi lần đẩy, Google không nhận) — preview dùng đăng nhập thử trên DB giả. Đặt xong thì Redeploy.
4. Mở web, bấm "Đăng nhập bằng Google" bằng đúng Gmail đã đặt ở `BCA_GMAIL_CHU` ⇒ vào vai chủ (không chạy lệnh nào). Vào **Tài khoản** để thêm giáo viên (Gmail, tên, môn). Môn chỉ chọn được khi DB đã có bảng môn — tức là sau khi chuyển dữ liệu thật từ sheet (T21, `chuyen-tu-sheet.ts --apply`, cần bản xuất `.xlsx`); trước đó vẫn thêm được GV chưa có môn rồi gán sau.
5. Làm bước 4 khi Vercel Authentication vẫn bật (chủ qua được vì là thành viên Vercel). Ổn thì **tắt Vercel Authentication cho Production** (giữ cho Preview) — nếu không, giáo viên và học sinh bị Vercel chặn trước khi tới trang đăng nhập.

Thử trên máy với Google thật: tạo thêm redirect URI localhost như bước 2, rồi `BCA_GOOGLE_CLIENT_ID=… BCA_GOOGLE_CLIENT_SECRET=… npm run dev -- -p 3100`.

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
- `tests/dang-nhap-google.test.ts` — Đợt 2: đăng nhập Google với Google **giả lập** (thay `fetch`, khoá RSA tự sinh làm JWKS; không gọi mạng thật): thiếu biến, URL Google + PKCE (vector RFC 7636), cookie tạm, đăng nhập 3 vai, Gmail dạng gốc (T48/T49), từ chối (không có tài khoản, chưa xác minh, nonce/aud/iss/hạn/khoá lạ/HS256 giả, token lỗi, state sai, huỷ, khoá, ẩn, trùng), T41, script tạo tài khoản.
- `tests-ui/dang-nhap.mjs` (Playwright, `npm run test:ui dang-nhap`; máy chủ chạy với `BCA_GOOGLE_CLIENT_ID/SECRET` giả + `BCA_DEV_LOGIN=1`) — nút Google 390/1280, 302 + cookie tạm (không theo chuyển hướng sang Google), state giả, câu báo lỗi, đã đăng nhập, T41 từ hồ sơ.
- `tests/tai-khoan.test.ts` — màn Tài khoản (T55): quyền 403 trước tham số, thêm GV (chuẩn hoá, trùng hộp Gmail, gợi ý đuôi, T49), sửa tên/môn có hiệu lực ngay, khoá/mở khoá, chủ cuối (tự khoá, hai chủ khoá nhau cùng lúc), đăng xuất mọi máy.
- `tests-ui/tai-khoan.mjs` (Playwright) — thêm GV 390/1280, báo gõ nhầm/trùng, sửa môn + khoá/mở khoá, chủ duy nhất, mục Thêm trên điện thoại, GV bị chặn.
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
| `GET /api/don/[id]/tao-ho-so` | `don.xemTruocDon` | chủ | Hồ sơ điền sẵn từ đơn (`ho_so`), `mon`, `ngay_dang_ky`, `thu_du_kien {tu, den, ly_do}` (nếu tạo hồ sơ mới), `muon_chinh_thuc`, `trung: [{ma_hs, ho_ten, khop: ["gmail"/"sdt"/"don_da_gan"], ten_giong, an, thu_du_kien {tu, den, ly_do}}]` (khoảng thử nếu gắn vào hồ sơ đó — em đang thử ⇒ hạn chung), `da_xu_ly`. Cùng hàm `khoangThuDon` với lúc tạo thật; `ly_do` khác null ⇒ lúc tạo sẽ trả `can_chu_quyet`, `den` là ngày chủ nhận khi bấm Cấp thử |
| `POST /api/don/[id]/tao-ho-so` `{maHs?, taoMoi?, capThuMoi?, hoSo?}` | `don.taoHoSoTuDon` | chủ | T43 + T1–T3, xem `ket_qua` bên dưới. Đơn → `da_nhan`, gắn `hoc_sinh_id`. Đơn đã xử lý → 409 `da_xu_ly`; hồ sơ `maHs` đang ẩn → 409 `ho_so_an` |
| `POST /api/don/[id]/bo-qua` `{lyDo}` | `don.boQuaDon` | chủ | Đơn → `bo_qua`, lý do (bắt buộc, ≤ 500) vào `ghi_chu_xu_ly`; trả `nhatKyId` |
| `POST /api/don/[id]/hoan-tac` `{nhatKyId}` | `don.hoanTacXuLyDon` | chủ | Hoàn tác tạo hồ sơ hoặc bỏ qua trong 10 giây (giao diện hiện 5 giây, T45), tất cả hoặc không: xoá ghi danh vừa tạo, trả các ô vừa điền về trống (chỉ khi ô còn đúng giá trị đã điền — nhật ký lưu giá trị; ô đã bị sửa ⇒ 409 `da_sua`, không ghi đè), hồ sơ mới thì xoá (mã không cấp lại), đơn về trạng thái cũ. Em đã có điểm danh → 409 `co_diem_danh`; đã bị sửa → 409 `da_sua`; `het_gio`, `da_hoan_tac` như các hoàn tác khác |
| `GET /api/hoc-sinh?het_ngay=YYYY-MM-DD` | `hoc-sinh.danhSachHocSinh(u, {hetNgay})` | chủ + GV | Chỉ em có ngày hết thử đúng ngày đó, cùng cách nhóm của Hôm nay (`hoc-sinh.ngayHetThu`: đang thử ⇒ hạn thử chung; đã hết ⇒ ngày hết). Ngày sai → 400 |
| `POST /api/gia-han` | `ghi-danh.giaHanThu` | chủ | Số ngày ngoài 1–60 / không phải số nguyên / thiếu cả `soNgay` lẫn `denNgay` → **400** (trước là 409) |
| `PATCH /api/buoi-hoc/[id]` | `buoi-hoc.suaNoiDungBuoi` | chủ + GV môn | Không có trường nào trong `noiDung`, `linkRecord`, `ghiChu` → 400, không ghi nhật ký |

`ket_qua` của `POST /api/don/[id]/tao-ho-so`:
- `"da_tao"` / `"da_gan"` — kèm `nhatKyId`, `ma_hs`, `thu {tu, den}` (null nếu không tạo ghi danh), `mon` (môn đã ghi danh thử), `bo_qua: [{mon, ly_do: "dang_thu" | "dang_chinh_thuc"}]`, `muon_chinh_thuc`, `dien` (ô hồ sơ cũ vừa được điền); gắn hồ sơ cũ mà Gmail của đơn đã thuộc hồ sơ khác ⇒ không điền ô gmail, thêm `trung_gmail: "HSxxxx"` (mã hồ sơ đang giữ Gmail đó); hồ sơ mới thêm `lua`, `goi_y_gmail`, `trung_sdt`.
- `"trung_ho_so"` — có hồ sơ trùng Gmail hoặc SĐT HS/PH (ghi-danh.md 1.4): **chưa ghi gì**, trả `goi_y`. Gửi lại kèm `maHs` (gắn vào hồ sơ cũ, chỉ điền ô đang trống) hoặc `taoMoi: true`.
- `"can_chu_quyet"` — **chưa ghi gì**, `ly_do`:
  - `"het_thu_dang_ky_lai"` / `"da_nghi_dang_ky_lai"` (T2, T46): em đã từng có ghi danh (chỉ thử / có chính thức) và hôm nay **không còn môn nào mở**. Em còn môn mở (đang học hoặc đang thử) đăng ký môn mới thì **không** vào đây — ghi danh thử môn mới bình thường; môn em đang học bỏ qua, báo trong `bo_qua`.
  - `"don_qua_han"`: nhận đơn khi 14 ngày tính từ ngày đăng ký đã hết.
  - Chủ gửi lại `capThuMoi: true` (Cấp thử): đơn còn trong 14 ngày ⇒ thử từ hôm nay đến ngày đăng ký + 13 (T44); đơn đã quá 14 ngày ⇒ thử 14 ngày từ hôm nay (như gia hạn sau khi hết thử, 5.4). Hoặc Bỏ qua.
- Khoảng thử: hết ngày đăng ký + 13 (T1); bắt đầu từ ngày đăng ký, hoặc từ hôm nay nếu nhận đơn muộn (không phủ ngược để khỏi sinh buổi "chưa điểm danh" giả, 5.4). Em đang thử ⇒ môn mới hết cùng hạn chung (5.2). Đơn "Chính thức" ⇒ vẫn ghi danh **thử**, `muon_chinh_thuc: true` (T3); chủ bấm chuyển chính thức như cũ.
- Đơn đã xử lý tự hết khỏi việc "Đơn chờ duyệt" ở Hôm nay (chỉ đơn `moi` / `cho_duyet` được tính).

Hàm mới (không có route riêng — trang gọi thẳng):
- `hom-nay.lopToiNay(u, luc)` · `viecCanLam(u, luc)` → `{viec, so_viec_da_an}` · `theSo(u, luc)` · `lich7Ngay(u, luc)`; `homNay` gọi cả 4 song song và trả đúng dạng cũ (`GET /api/hom-nay` không đổi). Mỗi khối chỉ nạp khoảng ngày nó cần (tối nay: hôm qua + hôm nay). Tính việc từng em bọc try/catch: hồ sơ làm lỗi chỉ thành việc `sua_du_lieu` với `loi: ["loi_tinh"]`. Việc `het_thu` / `thu_sap_het` có thêm `lua` (mã lứa) và `sdt_hs` (chỉ chủ nhận các việc này).
- `hoc-sinh.taoHoSoTx(tx, u, v, luc)` — phần ghi của `taoHocSinh`, dùng chung với tạo hồ sơ từ đơn.
- `lib/chuan-hoa.tenGiong(a, b)` — so tên theo ghi-danh.md 1.4.
- `server/api.soNguyen`: chuỗi phải khớp `^-?\d+$` (`"0x2"`, `"1e3"`, `" 2"`, `true` → 400).
- `server/nhat-ky.ghiTuChoi`: nhật ký `tu_choi` tối đa 1 dòng / người / (phương thức + đường dẫn) / phút; lần lặp trong phút đó tăng `sau.so_lan` (một câu UPDATE, không mất lượt khi gọi cùng lúc); `doi_tuong_id` = `"POST /api/…"`.
- Route chỉ chủ / chỉ quản lý kiểm quyền **trước** khi đọc tham số (`DELETE /api/buoi-hoc/[id]`, `POST …/hoan-tac-xoa`, `POST /api/don/[id]/bo-qua`, `POST /api/don/[id]/hoan-tac`, `GET /api/hoc-sinh`): GV/học sinh gửi tham số sai vẫn nhận 403 + dòng `tu_choi`, không 400.
- Đơn có `loai` trống ⇒ không coi là muốn chính thức (`muon_chinh_thuc: false`).

## Cấu trúc
```
app/(quan-ly)/quan-ly/   trang chẩn đoán khu quản lý
app/(hoc-sinh)/hoc/      trang chẩn đoán khu học sinh
app/dang-nhap/           trang đăng nhập: nút Google + đăng nhập thử (T40)
app/api/dang-nhap/google/  bắt đầu + callback Google (server/google.ts)
app/api/**/route.ts      route handlers (mỏng: đọc request → gọi server/*)
lib/                     hàm thuần: ngày giờ VN, quy tắc nghiệp vụ, quyền, chuẩn hoá
server/                  truy vấn + kiểm quyền + nhật ký (mọi hàm nhận người dùng hiện tại)
proxy.ts                 tự gia hạn cookie phiên 30 ngày (không kiểm quyền)
prisma/                  schema + migrations
scripts/                 seed-gia.ts, chuyen-tu-sheet.ts, them-nguoi-dung.ts
tests/                   vitest
```
