# Gộp quản lý lớp (Kin Class / BCA) vào KiN — kế hoạch và hệ phòng ban

> Lập 27/11/2026 (phiên laptop, chủ: Thanh). Đọc tệp này trước khi làm bất kỳ việc nào thuộc nhánh `claude/kin-lop-hoc`.
> Nguồn luật nghiệp vụ của lớp: `docs/bca/QUYET-DINH.md` và `docs/bca/nghiep-vu/*.md` (ở nhánh `claude/optimistic-clarke-cbddza`).

## 1. Quyết định của chủ (27/11/2026)

1. Gộp hẳn quản lý lớp vào web KiN; không giữ web riêng lâu dài.
2. Vẽ Figma trước, rồi mới làm mã. Phiên Claude tự duyệt bản vẽ; chủ xem sau.
3. Lớp BCA vẫn chạy trên `https://bca-midnight.vercel.app` cho tới khi bản trong KiN đạt và chủ đồng ý chuyển.
4. Chủ giao phiên Claude tự quyết việc kỹ thuật. Ngoại lệ phải hỏi chủ: mục 6.

## 2. Phương án kỹ thuật (đã chọn: A)

Chép mã lớp sang KiN thành nhóm route mới, bảng riêng tiền tố `bca_` trong DB KiN (chỉ thêm, không sửa bảng cũ), đăng nhập bằng phiên KiN, giao diện theo token `--kin-*`. Học sinh nối danh tính vào `User` của KiN (`bca_hoc_sinh.userId`). Mọi thứ nằm sau cờ `NEXT_PUBLIC_KIN_MO_LOP_ON`.

Lý do không chọn B (ánh xạ vào `Enrollment` / `AttendanceSession`): mất lịch sử đoạn ghi danh thử/chính thức mà học phí cần, và phải nới `@@unique` trên bảng cũ (trái luật chỉ-thêm).

Thứ tự đưa lên từng phần (mỗi bước một PR, sau cờ):

| # | Việc | Ghi |
|---|---|---|
| 1 | Schema `bca_*` + SQL ràng buộc (CHECK, EXCLUDE gist) | ✅ 27/11 mã xong (13 model, 7 enum, `prisma/sql/bca-rang-buoc.sql`, cờ `LOP_ON` tắt). Đã thử trên Postgres 17 cục bộ (DB trống + `vector`): `db push` tạo đủ 13 bảng + 7 enum; tệp ràng buộc chạy được và chạy lại an toàn (14 CHECK + 1 EXCLUDE); `db push` lần hai KHÔNG xoá ràng buộc. Chưa thử trên Neon. Sau khi vào `main`, phải chạy tay tệp SQL một lần trên DB production (chưa có bước tự động). |
| 2 | Lớp quyền + phiên (ánh xạ `getSession` của KiN sang vai chủ / GV / học sinh) | ✅ 27/11 mã xong: `src/lib/lop/` (`ngay`, `quy-tac`, `chuan-hoa`, `quyen` chép nguyên byte từ bca; `phien.ts` có `nguoiLop()`), bài `t-lop-quy-tac-lib` 35/35, `t-lop-phien-lib` 22/22. Chưa có route nào gọi. Còn mở: `Nguoi.id` là `User.id` (cuid) trong khi `tao_boi` / `nghi_boi` là cột uuid — xử ở bước 5; `admin_content` chưa được vào lớp; `tienKy` 65/55 mới chỉ chép, chưa nối (mục 6.4). |
| 3 | Script chuyển dữ liệu từ DB Neon "Kin Class" | ✅ 27/11 script xong, CHƯA chạy trên Neon: `scripts/lop-chuyen-du-lieu.ts`. Chạy: `LOP_NGUON_URL=… LOP_DICH_URL=… npx tsx scripts/lop-chuyen-du-lieu.ts` (xem trước, rollback) → hỏi chủ → thêm `--apply` (đích đã có dòng `bca_*` thì thêm `--ghi-de`); đích không phải localhost cần `LOP_CHO_PHEP_DICH_THAT=1`. Chỉ in số đếm; đối soát số dòng + mã băm nội dung từng bảng, lệch thì rollback. Thử trên Postgres cục bộ với dữ liệu giả (13 bảng, 508 dòng): xem trước KHỚP và đích vẫn trống; `--apply` KHỚP; chạy lại không cờ bị từ chối; `--apply --ghi-de` KHỚP; nguồn thừa một cột ⇒ LỆCH, đích giữ nguyên. Sau apply vẫn đủ 14 CHECK + 1 EXCLUDE, sequence đã đặt lại. Kho không có `pg` nên dùng `postgres` (gói `prisma` kéo theo). Còn mở: JSON `null` trong cột jsonb sang đích thành SQL NULL. |
| 4 | Hôm nay + Học sinh (chỉ đọc) | ✅ 27/11 mã xong, chỉ chủ lớp (admin_super), sau cờ: `/admin/lop-on` (Hôm nay), `/admin/lop-on/hoc-sinh` (lọc trên URL, 50 em/trang), `/admin/lop-on/hoc-sinh/[maHs]` (hồ sơ). Truy vấn chép vào `src/lib/lop/server/` (`hom-nay`, `hoc-sinh`, `diem-danh` phần tiến độ, `du-lieu`; cửa vào `cua.ts`), lọc thuần `src/lib/lop/loc-hoc-sinh.ts`, bài `t-lop-hoc-sinh-lib` 31/31 (chạy cả cờ tắt và bật). Menu "Lớp ôn" là module thứ năm nằm NGOÀI `ADMIN_MODULES` (`ADMIN_LOP_ON` trong `adminNav.ts`), chỉ hiện khi cờ bật. Token mới `--kin-lop-*` (màu môn, phép, nền đêm) đặt ở cuối `src/app/kin-site.css` vì `t-no-hex` chỉ cho mã hex ở hai tệp token. Đã chạy thử trên DB cục bộ với dữ liệu giả, chụp 1440 / 390, sáng / tối. Mọi nút ghi (Điểm danh, Gia hạn, Lên chính thức, Xử lý đơn, ghi chú) đang ẨN chờ bước 5–6; không hiện đơn giá (mục 6.4). Lệch Figma có chủ ý: dùng vỏ quản trị KiN thay thanh bên riêng; chưa có ô tìm lệnh ⌘K và ô chọn nhiều em. Còn mở: cờ tắt / mã không có thì trang hiện "404" nhưng mã HTTP là 200 (layout quản trị bọc `Suspense`; muốn 404 thật phải chặn ở proxy); nhánh giáo viên của `chiTietHocSinh` chưa chạy được (id cuid so với cột uuid). |
| 5 | Buổi học + Điểm danh (ghi) | ✅ 27/11 mã xong, sau cờ, CHƯA push. **Người ghi:** `nguoiLopBca()` (`src/lib/lop/phien.ts`) đổi id sang `bca_nguoi_dung.id` theo Gmail gốc = email KiN đã xác minh; chủ chưa có dòng thì tạo một dòng vai chủ ở request GHI đầu tiên; giáo viên chưa có dòng / bị khoá ⇒ không vào. **Máy chủ:** `src/lib/lop/server/{diem-danh,buoi-hoc,nhat-ky,api}.ts` chép luật, khoá dòng, nhật ký; route `/api/lop/buoi-hoc/*`, `/api/lop/diem-danh/*` (cờ tắt ⇒ 404; quyền trước tham số; từ chối có nhật ký; thân lỗi `{ error, ma }`). **Chủ lớp:** `/admin/lop-on/buoi-hoc` (tuần, lọc môn, sửa nội dung / record, huỷ / bỏ huỷ, xoá + hoàn tác 10 giây, học bù, sinh buổi còn thiếu), `/admin/lop-on/diem-danh/[buoiId]`, `/admin/lop-on/diem-danh/thang` (bấm ô để sửa); Hôm nay bật nút Điểm danh + liên kết Ma trận; menu thêm Điểm danh, Buổi học. **Giáo viên:** `/lop-cua-toi/lop-on` + `/lop-cua-toi/lop-on/[buoiId]` trong vỏ gia sư (giữ luật mục 6.1), buổi môn khác ⇒ không tìm thấy; hàng đợi IndexedDB khi mất mạng. **Test:** `t-lop-diem-danh` 58/58 (hàm máy chủ, giờ cố định), `t-lop-buoi-api` 27/27 cờ bật + 1/1 cờ tắt; hai bài tự nạp lại `bca_*` từ DB `bca_gia`, không `wipe()`. Đã chạy thử thật cả hai vai, 390 / 1440, sáng / tối. **Chưa chép:** sinh buổi cả tháng, đổi lịch môn, ghi chú từng em trên giao diện (API có), ô tìm tên, phím tắt, tự làm mới 15 giây, đánh dấu việc xong ở Hôm nay. **Còn mở:** (a) `t-lop-hoc-sinh-lib` chạy với cờ BẬT đỏ 1 ca vì bài cũ khẳng định menu Lớp ôn có đúng 2 mục (nay 4) — chưa sửa bài, chờ chủ cho phép; (b) vỏ gia sư CHƯA có mục menu dẫn tới `/lop-cua-toi/lop-on` (phải gõ địa chỉ); (c) Figma chưa có màn Buổi học; (d) giới hạn tần suất cho `/api/lop/*` chưa có; (e) chưa thử trên Neon. |
| 6 | Ghi danh + hồ sơ, Đơn, Phân công GV (ghi) | ✅ 27/11 mã xong, chỉ chủ lớp, sau cờ, CHƯA push. **Máy chủ:** `src/lib/lop/server/{ghi-danh,don,giao-vien}.ts` + phần ghi của `hoc-sinh.ts`, `hom-nay.ts` (chép luật T1–T58, khoá dòng, nhật ký, Hoàn tác 10 giây); route `/api/lop/{hoc-sinh,gia-han,hom-nay/xong,don,giao-vien}/**` (19 route, quyền trước tham số). **Giao diện:** hồ sơ một em có Lên chính thức / Gia hạn thử / Thêm môn (học lại) / Cho nghỉ / Ẩn – Bỏ ẩn / Sửa thông tin / Sửa ghi chú; Hôm nay › Học thử nhóm theo ngày hết, có Gia hạn cả nhóm, Lên chính thức, Gia hạn, Cho nghỉ, Ẩn 3 ngày; Học sinh có ô chọn nhiều em + thanh Gia hạn thử (Figma 9:1044) + Thêm học sinh; trang mới `/admin/lop-on/don` (Chờ xử lý / Tất cả, Tạo hồ sơ từ đơn có xem trước + chọn gắn / tạo mới + hỏi cấp thử, Bỏ qua có lý do) và `/admin/lop-on/giao-vien`; menu thêm Đơn, Giáo viên; thanh báo + Hoàn tác dùng chung ở `lop-on/layout.tsx`. **Giáo viên trong KiN:** trang KHÔNG tạo người dùng, không đụng bảng `users`; chỉ tạo / sửa dòng `bca_nguoi_dung` theo Gmail đã xác minh của một giáo viên KiN có sẵn, gán môn, khoá / mở khoá dòng lớp; hiện rõ "email chưa xác minh", "tài khoản KiN bị khoá", "chưa có tài khoản giáo viên KiN với Gmail này" kèm việc cần làm. **Mới so với web lớp:** `suaHoSoHocSinh` (sửa thông tin hồ sơ — web lớp chưa có). **Sửa kèm:** `nguoiLopBca` không còn 500 khi hai request ghi ĐẦU TIÊN của chủ tới cùng lúc (trùng khoá Gmail). **Test:** `t-lop-ghi-danh` 74/74 (hàm máy chủ, giờ cố định), `t-lop-ghi-api` 48/48 cờ bật + 1/1 cờ tắt; ca menu Lớp ôn trong `t-lop-hoc-sinh-lib` sửa 4 → 6 mục. Đã chạy thử thật vai chủ, 1440 / 390, sáng / tối. **Không chép:** đơn giá dự kiến khi lên chính thức (mục 6.4), thu hồi phiên, luật "chủ cuối cùng" (vai chủ do `admin_super` của KiN quyết định), thêm GV bằng cách gõ Gmail, sửa tên GV, đổi lịch môn. **Còn mở:** (a) đổi Gmail hồ sơ chưa gỡ `userId` đã nối (bước 7 mới ghi `userId`); (b) tạo hồ sơ MỚI từ đơn trùng Gmail luôn bị 409 (Gmail duy nhất — luật gốc), giao diện chỉ dẫn gắn / bỏ qua; (c) `:target` không dùng được nên đơn mở từ Hôm nay tô nền bằng `?don=`; (d) với cờ BẬT, hai bài cũ `t-admin-nav-lib` (2 ca) và `t-features-lib` (1 ca) đỏ vì chúng khẳng định menu quản trị không có Lớp ôn — có từ bước 4, chưa sửa; (e) giới hạn tần suất `/api/lop/*` chưa có; (f) chưa thử trên Neon. |
| 7 | Khu học sinh | ✅ 27/11 mã xong, sau cờ, chưa push. **Trang:** `/student/lop-on` trong vỏ học sinh của KiN (Figma 9:146 / 9:283 / 9:365 / 9:511): thẻ "Tối nay" nền đêm với MỘT nút vàng 56px đổi theo giờ (`src/components/lop/NutToiNay.tsx`: Vào lớp Meet + "Còn N phút" → Vào lớp ngay từ 15 phút trước → Xem record; thiếu Meet ⇒ Mở nhóm Zalo môn; thiếu cả hai ⇒ câu hướng dẫn), thẻ học thử (ngày N/14, thanh tiến độ, còn ≤ 3 ngày ⇒ khung cảnh báo + "Nhắn chủ lớp để học tiếp"), màn khoá (hết thử / đã nghỉ: "Liên hệ gia hạn", ẩn tuần và chuỗi), tuần này 7 ô có chấm màu môn, chuỗi dạng chấm (chuỗi 0 ⇒ lời mời), môn của em, buổi sắp tới / buổi gần đây (3 dòng + "Xem tất cả"); từ 1024px hai cột. **Máy chủ:** `src/lib/lop/server/hs.ts` (`cuaToi`, `buoiCuaToi`, `chuoiDiHoc` chép từ `bca/server/hs.ts`; chỉ chọn mã + họ tên của hồ sơ, không SĐT / phụ huynh / ghi chú; môn hết hạn ⇒ không trả link Meet / Zalo / record), route `/api/lop/hs/toi`, `/api/lop/hs/buoi/[id]` qua `routeHs` (không nhận id học sinh từ request). **Nối danh tính:** `noiHoSoLop` — học sinh KiN có email đã xác minh, Gmail dạng gốc khớp ĐÚNG MỘT hồ sơ chưa nối và chưa ẩn ⇒ ghi `bca_hoc_sinh.userId` + nhật ký `noi_tai_khoan_kin`; khớp nhiều ⇒ không nối, trang hiện "Gmail này khớp nhiều hồ sơ, nhắn chủ lớp". Chạy khi em mở vỏ học sinh hoặc trang (không chạy ở API). `phien.ts` bỏ shortcut so Gmail mỗi request: học sinh chỉ được nhận qua `userId`. Chủ đổi Gmail hồ sơ (`suaHoSoHocSinh`) ⇒ gỡ `userId`, có nhật ký. Không ghi bảng `users`. **Menu:** vỏ học sinh thêm "Lớp ôn" khi cờ bật và em có hồ sơ (máy chủ quyết ở `(student)/layout.tsx`); vỏ gia sư thêm "Lớp ôn" ở nhóm "Dạy học" khi cờ bật và giáo viên có dòng `bca_nguoi_dung` chưa khoá (`LopCuaToiFrame`). **Việc tồn của bước 6:** (a) xong như trên; (b) đơn trùng Gmail không còn lựa chọn "tạo hồ sơ mới" (chỉ gắn / bỏ qua); bài cũ `t-lop-gon` 181 pass / 24 fail trên `origin/main` (9652ee2d) và trên nhánh, cùng đúng 24 ca ⇒ đỏ từ trước (cờ DIEM_DANH tắt + thứ tự tab đã đổi). **Test:** `t-lop-hoc-sinh-khu` 37/37 (hàm máy chủ, giờ cố định; đủ 6 ca `cuaToi` của `bca/tests/khu-hoc-sinh.test.ts` + nối / gỡ nối), `t-lop-hoc-sinh-khu-api` 28/28 cờ bật + 4/4 cờ tắt (ca route gốc + A không đọc được B, học sinh gọi route chủ ⇒ 403, HTML không lộ SĐT phụ huynh / ghi chú / mã máy); `t-lop-phien-lib` 22 → 21 ca (bỏ ca khớp Gmail). Đã chạy thử thật 3 em (chính thức, thử còn 1 ngày, hết thử) ở 390 / 1280, sáng / tối. **Còn mở:** (a) vỏ học sinh ở các trang `/lop-cua-toi/*` (StudentFrame) và vỏ gia sư ở trang khách chưa có mục "Lớp ôn"; (b) `t-kin-components` đỏ 1 ca vì `<select>` gốc ở ba tệp của bước 4–6 (`admin/lop-on/hoc-sinh/page.tsx`, `BuoiHoc.tsx`, `ThaoTacHs.tsx`); (c) với cờ BẬT `t-admin-nav-lib` (2 ca) và `t-features-lib` (1 ca) vẫn đỏ như bước 6; (d) `ui-student-shell` dừng ở bước đầu (chờ tiêu đề "Cần làm") cả khi trả ba tệp vỏ về `origin/main` ⇒ có từ trước; (e) hạn thử 14 ngày vẫn theo luật lớp (mục 6.3 chờ chủ); (f) chưa thử trên Neon. |
| 8 | Chuyển thật, khoá ghi trên web cũ | cần chủ đồng ý |

## 3. Hệ phòng ban cho việc này

Dùng lại phòng ban sẵn có của KiN (`docs/kin/phong-ban/README.md`) và đội `bca-*`. Việc này liên phòng nên COO điều phối.

| Phòng | Agent | Việc trong đợt gộp |
|---|---|---|
| Điều hành | `kin-coo` (phiên chính đóng vai này) | chia việc, giữ thứ tự mục 2, gom câu hỏi cho chủ |
| Nghiệp vụ | `bca-nghiep-vu` | nguồn luật T1–T58; đối chiếu với D1–D14 của KiN |
| Thiết kế | `bca-thiet-ke` + Figma | bản vẽ theo token KiN; `bca-giam-khao` chấm, dưới 8/10 thì vẽ lại |
| Admin | `pb-admin` → `adm-rnd/-code/-dev/-test` | Hôm nay, Học sinh, Đơn, Tài khoản |
| Gia sư | `pb-gia-su` → `tut-*` | Buổi học, Điểm danh, ma trận tháng |
| Học sinh | `pb-hoc-sinh` → `stu-*` | khu học sinh, đăng nhập |
| Nền | `kin-backend`, `kin-frontend` | schema, quyền, linh kiện dùng chung |
| Chất lượng | `kin-kiem-thu`, `kin-ra-soat`, `bca-vai-chu-lop/-giao-vien/-hoc-sinh` | test, rà diff, đóng vai người dùng |

Vòng lặp mỗi bước: nghiệp vụ → thiết kế (Figma) → mã → kiểm thử → rà soát → đóng vai. Đỏ hoặc điểm dưới 8 ở bất kỳ vai nào thì quay lại đúng phòng, tối đa 3 vòng.

Skill đã cài phải dùng: `agent-skills:*` (spec, test, review, a11y, performance, security), `design:*` (critique, accessibility-review, ux-copy), `gsap-skills`, `lenis`, `react-bits`, `playwright-cli`, `graphify`, `ponytail` (giữ mã ngắn), kết nối `shadcn`, `21st`, Figma.

## 4. Giới hạn tài nguyên máy (laptop 16 GB RAM)

- Tối đa **2 agent** chạy cùng lúc; không chạy hai `next dev` / `next build` song song.
- Trước mỗi đợt dựng: `df -h ~`. Ổ còn dưới 15 GB thì xoá `.next/dev` của các thư mục không có `next-server` chạy.
- Không cài Chromium mới; dùng Chromium của `playwright-cli` đã có.
- Agent chỉ đọc không được chạy lệnh dựng, cài, test nặng.

## 5. Figma

Tệp: https://www.figma.com/design/FyUkgGJHrhXo0u4gnREyfk — trang `00 Nền móng`, `01 Chủ lớp`, `02 Giáo viên`, `03 Học sinh`, `04 Đăng nhập & trạng thái lỗi`.

- Biến màu `KiN · màu` (chế độ Sáng / Tối) lấy từ `src/app/kin-tokens.css`: `nen/*`, `vien/*`, `chu/*`, `nhan/*`, `tt/*`.
- **Mới so với KiN** (cần thêm token khi làm mã): `mon/toan|su|dia|anh` (màu môn), `tt/chu-phep` + `tt/nen-phep` (vắng có phép), `dem/*` (thẻ "Tối nay" nền đêm).
- Chữ: tiêu đề Be Vietnam Pro, thân Inter (như `kin-site.css`).
- Yêu cầu của chủ cho mọi màn: dễ, trực quan; chữ và khung cân đối, không tràn; trạng thái lỗi phải hiện rõ.

## 6. Phải hỏi chủ trước khi làm (không tự quyết)

1. Giáo viên có vào `admin.midnightelite-edu.com` không (hiện bị chặn ở `src/lib/hostRouting.ts`), hay đứng lớp ở `/lop-cua-toi` như quyết định SCL.
2. Chủ / giáo viên đăng nhập bằng Google hay mật khẩu KiN (hiện Google bị chặn cho vai này ở `src/lib/socialAuth.ts`).
3. Hạn thử 14 ngày tính từ lúc đăng ký (luật lớp) hay từ lần đầu mở lớp (KiN D5).
4. Học phí: luật 65/55 nghìn của lớp hay bậc giá KiN. Không đụng 5 tệp tiền bị khoá.
5. Học sinh Khối 11 (có thể dưới 17 tuổi) và dữ liệu phụ huynh: giữ rào tuổi của KiN thế nào.
6. Thời điểm đóng web `bca-midnight.vercel.app` và DB Neon riêng.
7. Gộp PR vào `main` của KiN (web có tiền và người dùng thật): chỉ Thanh / Thọ bấm.

Mặc định cho tới khi chủ trả lời: không đổi luật đăng nhập và tên miền của KiN; không làm phần học phí; chuyển dữ liệu nguyên trạng, không thu thêm trường mới.

## 9. Đợt kiểm thử 28/11/2026 (hai agent: rà bảo mật + đóng vai ba người dùng)

Rà bảo mật: 0 P1, 4 P2, 8 P3. Đóng vai: 0 P1, 5 P2, 14 P3; không màn nào tràn ngang ở 390 / 1440, không lọt quyền ca nào.

Đã sửa (kèm ca test): giới hạn 600 yêu cầu/phút mỗi người ở `/api/lop/*` (đếm trong bộ nhớ từng instance); nhật ký "từ chối" gộp theo mẫu route (`:id`);
`--ghi-de` từ chối khi đích có hồ sơ đã nối tài khoản (trừ `LOP_GHI_DE_DA_NOI=1`); log lỗi chỉ in tên + mã; trang hồ sơ hiện "Tài khoản KiN" đang nối;
SĐT gõ sai báo 400 thay vì lặng lẽ xoá số cũ; bỏ khung đôi ở 3 ô KinSelect; "Lớp ôn" lên đầu nhóm "Dạy học" của giáo viên; dòng "Thiếu record" bấm được, mở đúng tuần + môn;
sửa câu ở thẻ khoá của học sinh hết hạn.

Cố ý KHÔNG sửa: giáo viên mở buổi môn khác vẫn 403 (không đổi 404) để giữ nhật ký "từ chối" theo phan-quyen.md 4.1.

Còn lại (chưa làm): giáo viên trên điện thoại vẫn phải vào "Tôi" mới thấy "Lớp ôn" (thanh dưới và trang chủ là vỏ KiN — cần chủ quyết); kiểm `Origin` cho request ghi; `userId` chưa `@unique`;
giới hạn độ dài ở vài route chỉ chủ; hàng đợi ngoại tuyến không gắn người dùng; 14 lỗi P3 giao diện trong phiếu đóng vai; 3 lỗi eslint có sẵn ở `DiemDanhBuoi.tsx`, `NutToiNay.tsx`.
Ba chỗ KinSelect sau khi bỏ khung đôi CHƯA được chụp lại.
