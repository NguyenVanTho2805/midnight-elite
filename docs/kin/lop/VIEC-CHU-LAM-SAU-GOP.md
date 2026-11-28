# Lớp ôn trong KiN: việc chủ cần làm sau khi gộp PR #170

Viết 28/11/2026, sau khi PR [#170](https://github.com/NguyenVanTho2805/midnight-elite/pull/170) đã gộp vào `main` (commit `f493c4d1`) và bản production đã chạy.
Đọc hết một lượt trước khi làm. Làm đúng thứ tự A → B → C → D → E. Mỗi bước có ô ☐ để đánh dấu.

---

## Tóm tắt một màn hình

| Bước | Việc | Ai làm | Mất bao lâu | Trạng thái |
|---|---|---|---|---|
| — | Gộp PR #170, triển khai, kiểm web không đổi | Claude | — | ✅ Xong 28/11 |
| A | Tạo điểm khôi phục DB KiN | Anh, trên Neon | 2 phút | ☐ |
| B | Chạy tệp ràng buộc SQL trên DB KiN | Anh, trên Neon | 3 phút | ☐ |
| C | Tạo tài khoản KiN cho giáo viên | Anh + từng giáo viên | 10–20 phút | ☐ (anh đã đồng ý cách làm 28/11) |
| D | Chuyển dữ liệu từ web cũ sang KiN | Anh, trên máy Mac | 20–30 phút | ☐ |
| E | Bật cờ Lớp ôn, thử 6 việc trên điện thoại | Claude bật được khi anh nhắn; anh thử | 10 phút | ☐ |
| F | Dọn dẹp, theo dõi 1–2 tuần, đóng web cũ | Anh / Claude | rải rác | ☐ |

**Tại sao Claude không làm được B, D:** máy chứa của Claude không kết nối được tới Neon, và Claude không được cầm chuỗi kết nối cơ sở dữ liệu (bộ phân quyền chặn, đúng luật an toàn). Mọi bước đụng DB thật phải chạy trên máy anh hoặc trong trang Neon.

**Luật cứng cho cả quá trình:**
- Không dán chuỗi kết nối DB vào chat, vào tệp trong kho, hay vào ảnh chụp gửi đi.
- Không đặt `PRISMA_ACCEPT_DATA_LOSS`, `PREVIEW_OWN_DB`.
- Không bật cờ trước khi chuyển dữ liệu xong.
- Có gì lạ (chữ đỏ, `LỆCH`, `LỖI`) thì **dừng**, chụp phần kết quả (không chụp chuỗi kết nối) gửi Claude.

---

## Trạng thái hiện tại (Claude đã kiểm 28/11)

- `main` = `f493c4d1`, bản production đã nhận `midnightelite-edu.com` và `admin.midnightelite-edu.com`.
- Bước `prisma db push` khi dựng báo `Your database is now in sync with your Prisma schema`, không cảnh báo mất dữ liệu. 13 bảng `bca_*` đã có trong DB KiN, đang trống.
- Cờ `NEXT_PUBLIC_KIN_MO_LOP_ON` **chưa đặt** (tắt):
  - `/admin/lop-on`, `/student/lop-on`, `/lop-cua-toi/lop-on` hiện trang "không tìm thấy".
  - `/api/lop/*` trả 404; cron `/api/cron/lop-don-nhat-ky` trả 401 khi không có khoá.
  - Trang chủ, đăng nhập của KiN chạy như cũ.
- Bản dựng production cũ (PR #169) vẫn còn trên Vercel, quay lui được nếu cần.

---

## A. Tạo điểm khôi phục cho DB KiN

Làm trước mọi bước đụng DB. Nếu có gì hỏng, anh quay DB về đúng thời điểm này.

1. Vào **vercel.com** → project **`midnight-elite`** → tab **Storage** → bấm vào cơ sở dữ liệu Neon đang nối → **Open in Neon** (hoặc vào thẳng **console.neon.tech**, chọn project của KiN).
2. Menu trái → **Branches** → **Create branch**.
3. Đặt tên `truoc-lop-on-2811`, chọn **parent: main** (hoặc `production`), thời điểm **Now** → **Create**.
4. ☐ Thấy nhánh mới trong danh sách là xong. Nhánh này chỉ để giữ bản sao, không nối vào web nào.

> Cách quay về nếu hỏng: Neon → Branches → nhánh chính → **Restore** → chọn nhánh `truoc-lop-on-2811` (hoặc chọn thời điểm trước khi làm). Gọi Claude trước khi bấm Restore.

---

## B. Chạy tệp ràng buộc SQL trên DB KiN

**Vì sao cần:** `prisma db push` không tạo được các luật kiểm dữ liệu kiểu CHECK / EXCLUDE. Ví dụ: "một em không có hai đoạn ghi danh chồng ngày cùng một môn", "mã học sinh phải dạng HS0001". Tệp `prisma/sql/bca-rang-buoc.sql` tạo các luật đó: 14 CHECK, 1 EXCLUDE, và extension `btree_gist`.

**An toàn:** tệp chỉ đụng bảng `bca_*` (đang trống), chạy lại nhiều lần được (đã có thì bỏ qua). Nhưng tệp **chưa chạy trên Neon lần nào**, mới thử trên Postgres trên máy, nên mới cần bước A trước.

### Cách 1 (dễ nhất, không cần cài gì): trình soạn SQL của Neon

1. Mở tệp trên GitHub: `https://github.com/NguyenVanTho2805/midnight-elite/blob/main/prisma/sql/bca-rang-buoc.sql` → nút **Raw** → chọn hết, sao chép.
2. Neon (project KiN, **nhánh chính**, không phải nhánh `truoc-lop-on-2811`) → menu trái **SQL Editor**.
3. Kiểm ô chọn ở trên: **Branch = nhánh chính**, **Database = `neondb`**.
4. Dán toàn bộ nội dung → **Run**.
5. ☐ Kết quả mong đợi: không có dòng chữ đỏ `ERROR`. Có thể thấy `NOTICE ... already exists, skipping`; như vậy là bình thường.
6. ☐ Kiểm lại: dán câu sau → Run. Phải ra **15** dòng (14 CHECK + 1 EXCLUDE). Ra ít hơn thì chụp gửi Claude.

```sql
select conrelid::regclass as bang, conname
from pg_constraint
where conname like 'bca\_%' escape '\' and contype in ('c', 'x')
order by 1, 2;
```

### Cách 2: dòng lệnh trên Mac (khi đã có `psql`)

Trong thư mục kho KiN đã `git pull` nhánh `main`:

```bash
read -s DATABASE_URL && export DATABASE_URL
```

(dán chuỗi kết nối DB KiN rồi Enter; chữ không hiện ra là đúng)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/bca-rang-buoc.sql
```

### Nếu báo lỗi

| Thấy | Nghĩa | Làm gì |
|---|---|---|
| `permission denied to create extension "btree_gist"` | Tài khoản DB không đủ quyền | Chụp gửi Claude. Không tự sửa. |
| `relation "bca_..." does not exist` | Bảng chưa được tạo | Kiểm bản dựng production có chạy `db push` chưa. Gửi Claude. |
| `could not create exclusion constraint` | Có dữ liệu chồng ngày | Không nên xảy ra vì bảng đang trống. Dừng, gửi Claude. |

**Sau lần triển khai KiN kế tiếp** (bất kỳ PR nào gộp vào `main` sau này): chạy lại câu kiểm "15 dòng" ở trên một lần. Thiếu dòng thì chạy lại tệp SQL. Trên máy cục bộ, `db push` lần hai không xoá ràng buộc, nhưng trên Neon chưa kiểm.

---

## C. Tài khoản KiN cho chủ lớp và giáo viên

**Anh đã đồng ý cách làm (28/11):** chủ và giáo viên đăng nhập bằng **mật khẩu KiN** (không mở Google cho vai này). Giáo viên đứng lớp ở khu gia sư `/lop-cua-toi`, không vào tên miền quản trị.

### C1. Web nhận ra ai là ai thế nào

| Vai trong Lớp ôn | Điều kiện trên KiN | Ghi chú |
|---|---|---|
| **Chủ lớp** | Tài khoản quản trị cấp 1 (`admin_super`), email **đã xác minh** | Thấy mọi môn. Lần GHI đầu tiên mà Gmail chưa có trong danh sách người dùng lớp thì web tự thêm một dòng vai chủ. |
| **Giáo viên** | Tài khoản gia sư (`role = admin`, `adminRole = teacher`), email **đã xác minh**, email **trùng Gmail** của giáo viên đó trong dữ liệu lớp | Gmail so "theo hộp thư": không phân biệt hoa thường; với `@gmail.com` bỏ dấu chấm và phần `+nhãn`. |
| **Học sinh** | Đăng nhập KiN bằng Gmail đã khai với lớp, email đã xác minh | Không phải làm gì. Lần đầu mở vỏ học sinh, web tự nối hồ sơ. Trùng nhiều hồ sơ thì không nối, bảo em nhắn chủ lớp. |

Giáo viên có tài khoản nhưng chưa có dòng ở màn **Giáo viên** của lớp, bị khoá, hoặc chưa được giao môn thì vào sẽ thấy "Chưa được phân công môn nào". Không lộ dữ liệu, chỉ là chưa dùng được.

### C2. Chủ lớp (anh Thanh)

1. ☐ Đăng nhập `admin.midnightelite-edu.com` bằng tài khoản quản trị cấp 1 đang dùng.
2. ☐ Kiểm email của tài khoản này **đã xác minh** (trong hồ sơ, hoặc hỏi Claude kiểm hộ).
3. Nên dùng đúng Gmail chủ đã dùng ở web lớp cũ (Gmail đặt trong biến `BCA_GMAIL_CHU`), để các dòng "người ghi" cũ khớp với anh. Dùng email khác cũng chạy được: web tạo thêm một dòng chủ mới ở lần ghi đầu.

### C3. Mỗi giáo viên (chị Hoa – Toán; chị Thu Hương, anh Quang Minh – Anh; và ai khác)

Trước hết lấy danh sách Gmail giáo viên **đúng như đang lưu ở web lớp cũ**: `bca-midnight.vercel.app` → màn **Tài khoản**. Tài khoản KiN của giáo viên phải dùng đúng các Gmail này.

Có hai đường; chọn một cho mỗi người:

**Đường 1 (khuyên dùng): giáo viên tự đăng ký gia sư, anh duyệt**
1. Giáo viên vào `midnightelite-edu.com/dang-ky` → chọn đăng ký **gia sư** → dùng **đúng Gmail** ở danh sách trên → đặt mật khẩu.
2. Giáo viên mở hộp thư, bấm link **xác thực email**.
3. Anh vào `admin.midnightelite-edu.com` → **Hàng chờ** (`/admin/kiem-duyet?loai=gia-su`) hoặc **Gia sư** (`/admin/gia-su`) → đơn của giáo viên → **Duyệt**.
4. ☐ Xong khi đơn chuyển sang "Đã duyệt".

**Đường 2: giáo viên đã có tài khoản học sinh KiN bằng đúng Gmail đó**
1. Tài khoản phải **đã xác thực email**, không bị khoá, không bị ẩn.
2. Anh vào khu quản trị → **Học sinh** → mở tài khoản đó → panel bên phải → **Chuyển thành gia sư** → nhập môn dạy (Toán / Tiếng Anh…) → nếu tài khoản chưa khai ngày sinh thì tick xác nhận **đủ 18 tuổi** → gửi.
3. ☐ Tài khoản thành gia sư; lớp đang học của tài khoản (nếu có) giữ nguyên.

**Lưu ý chung:**
- Email ở KiN khác Gmail ở web cũ thì giáo viên không thấy môn nào. Với `@gmail.com`, khác dấu chấm hay chữ hoa vẫn tính là cùng; với tên miền khác thì phải trùng từng ký tự. Sửa bằng cách cho giáo viên đổi email KiN, hoặc sau khi bật cờ thì sửa Gmail ở màn **Lớp ôn → Giáo viên**.
- Phân công môn và khoá / mở khoá giáo viên **trong lớp** làm ở màn **Lớp ôn → Giáo viên** (`/admin/lop-on/giao-vien`). Màn này chỉ mở sau khi bật cờ (bước E). Dữ liệu phân công cũ chuyển sang ở bước D.
- ⚠ Cần kiểm sau bước E: gia sư đã duyệt có thể hiện ở danh sách giảng viên công khai của KiN (`/giang-vien`). Nếu anh không muốn giáo viên lớp ôn hiện công khai, báo Claude để xem cách ẩn.

### C4. Đánh dấu xong

| Người | Gmail khớp web cũ | Đã xác thực email | Đã là gia sư / quản trị cấp 1 |
|---|---|---|---|
| Chủ lớp | ☐ | ☐ | ☐ |
| GV Toán | ☐ | ☐ | ☐ |
| GV Anh 1 | ☐ | ☐ | ☐ |
| GV Anh 2 | ☐ | ☐ | ☐ |

---

## D. Chuyển dữ liệu từ web cũ sang KiN

### D0. Hiểu trước khi chạy

- **Nguồn:** DB Neon **"Kin Class"** của web cũ `bca-midnight.vercel.app` (biến `BCA_DATABASE_URL` của project Vercel `bca-midnight`). Script chỉ **đọc** nguồn.
- **Đích:** DB production của KiN (biến `DATABASE_URL` của project Vercel `midnight-elite`), vào 13 bảng `bca_*`.
- **Script:** `scripts/lop-chuyen-du-lieu.ts` (trên `main`). Chép 13 bảng theo thứ tự: `lua, mon, cai_dat, nguoi_dung, phan_cong, hoc_sinh, ghi_danh, buoi_hoc, diem_danh, don_dang_ky, bo_dem, viec_xong, nhat_ky`.
- **Mặc định là XEM TRƯỚC:**
  - Script chép hết vào đích **trong một giao dịch**, đối soát số dòng và mã băm từng bảng, rồi **huỷ giao dịch**. Không ghi gì.
  - Chỉ khi thêm `--apply` **và** mọi bảng KHỚP thì mới ghi thật. Lệch là huỷ, kể cả khi có `--apply`.
- **Không lộ dữ liệu:** script không in chuỗi kết nối, tên, SĐT, Gmail; chỉ in số đếm và tên bảng / ràng buộc.
- **Giữ nguyên mã** học sinh, id buổi, id ghi danh như web cũ.

### D1. Chuẩn bị trên máy Mac (một lần)

1. ☐ Có Node.js 20 trở lên: gõ `node -v`.
2. ☐ Có kho KiN đã cập nhật:

```bash
cd ~/midnight-elite
```

```bash
git checkout main && git pull
```

```bash
npm ci
```

(Chưa có kho thì `git clone https://github.com/NguyenVanTho2805/midnight-elite.git` rồi `cd midnight-elite` và `npm ci`.)

3. ☐ Lấy hai chuỗi kết nối (**không dán vào chat**):
   - **Nguồn (Kin Class):** vercel.com → project `bca-midnight` → **Storage** → DB → **Open in Neon** → nút **Connect** → tắt **Connection pooling** → sao chép chuỗi.
   - **Đích (KiN):** vercel.com → project `midnight-elite` → **Storage** → DB → **Open in Neon** → **Connect** → tắt **Connection pooling** → sao chép chuỗi. Chọn đúng **nhánh chính**, không phải `truoc-lop-on-2811`.
   - Dùng chuỗi **không qua pooler** (trong địa chỉ không có chữ `-pooler`) cho cả hai: script chạy một giao dịch dài, đi thẳng ổn định hơn.

### D2. Ngừng nhập ở web cũ

Từ lúc ghi xong ở D5, mọi thứ nhập thêm ở web cũ sẽ **không** sang KiN (hai nơi không đồng bộ).

1. ☐ Chọn giờ không có lớp (ví dụ buổi sáng, trước 21:45).
2. ☐ Nhắn giáo viên: "Từ … giờ, tạm không điểm danh / sửa gì trên web lớp cũ."
3. ☐ Anh cũng không xử lý đơn hay gia hạn trên web cũ trong lúc chuyển.

### D3. Nạp hai chuỗi vào terminal (không lưu vào tệp, không hiện ra màn hình)

Mở Terminal, `cd` vào kho KiN, chạy từng lệnh, mỗi lệnh dán chuỗi tương ứng rồi Enter:

```bash
read -s LOP_NGUON_URL && export LOP_NGUON_URL
```

```bash
read -s LOP_DICH_URL && export LOP_DICH_URL
```

Bật cho phép ghi vào DB không phải máy cục bộ. **Lệnh gộp cũ quên ghi biến này**: thiếu thì script báo `TỪ CHỐI — Đích không phải localhost`.

```bash
export LOP_CHO_PHEP_DICH_THAT=1
```

### D4. Xem trước (không ghi gì)

```bash
npx tsx scripts/lop-chuyen-du-lieu.ts
```

Script in một khối JSON. Đọc dòng **`ket_qua`**:

| `ket_qua` | Nghĩa | Làm gì |
|---|---|---|
| `KHỚP` | 13 bảng trùng số dòng và mã băm | ☐ Ghi lại bảng `dem` (số dòng từng bảng). Sang D5. |
| `LỆCH` | Có bảng không khớp, hoặc nguồn có cột mà đích không có (xem `lech`, `cot_chi_o_nguon`) | Dừng. Gửi Claude phần `dem`, `lech`, `cot_chi_o_nguon`, `cot_chi_o_dich`. |
| `LỖI` có `rang_buoc` đuôi `_fkey` | Dữ liệu cũ có "người ghi" không còn trong bảng người dùng lớp (khoá ngoại mới thêm 28/11) | Dừng. Gửi Claude tên ràng buộc. Chưa có gì được ghi. |
| `LỖI` có `rang_buoc` bắt đầu `bca_` (không phải `_fkey`) | Dữ liệu cũ phạm luật ở bước B (ví dụ chồng ngày) | Dừng. Gửi Claude tên ràng buộc. |
| `LỖI` có `ma` = `42P01` hoặc `TỪ CHỐI` "Đích thiếu bảng" | Bảng `bca_*` chưa có | Kiểm bước B và bản dựng production. |
| `TỪ CHỐI` "Đích đã có dữ liệu" | Đã chuyển một lần rồi | **Không** tự thêm `--ghi-de`. Hỏi Claude trước. |
| `TỪ CHỐI` "Đích không phải localhost" | Thiếu `LOP_CHO_PHEP_DICH_THAT=1` | Chạy lại lệnh `export` ở D3. |
| `Thiếu LOP_NGUON_URL hoặc LOP_DICH_URL` | Chưa nạp chuỗi | Làm lại D3 (cùng cửa sổ Terminal). |

**Đối chiếu số đếm với web cũ** (nên làm): số dòng `bca_hoc_sinh` trong `dem` phải bằng tổng số hồ sơ ở web cũ, kể cả hồ sơ đã ẩn. Số `bca_buoi_hoc` khớp số buổi đã sinh.

### D5. Ghi thật (chỉ khi D4 = `KHỚP`)

```bash
npx tsx scripts/lop-chuyen-du-lieu.ts --apply
```

- ☐ Mã thoát / kết quả: `ket_qua: "KHỚP"` và `da_ghi: true` là xong.
- Cả lượt chạy là **một giao dịch**: lỗi giữa chừng thì đích còn nguyên như trước.
- Mã thoát: `0` khớp và đã ghi · `1` thiếu biến hoặc sai cờ · `2` bị từ chối · `3` lệch hoặc lỗi.

Xong thì xoá chuỗi khỏi terminal:

```bash
unset LOP_NGUON_URL LOP_DICH_URL LOP_CHO_PHEP_DICH_THAT
```

### D6. Về `--ghi-de` (đọc kỹ)

- `--ghi-de` **xoá sạch 13 bảng `bca_*`** ở đích rồi chép lại từ đầu.
- Chỉ dùng khi đã chuyển một lần **và chưa bật cờ**, ví dụ muốn chuyển lại bản mới hơn của web cũ.
- **Không bao giờ dùng sau khi đã bật cờ:** nó xoá các lần nối tài khoản của học sinh và mọi thứ nhập trong KiN. Script tự từ chối khi đích đã có hồ sơ nối tài khoản (trừ khi đặt `LOP_GHI_DE_DA_NOI=1`; **đừng đặt**).

### D7. Đánh dấu xong

- ☐ A: có nhánh khôi phục
- ☐ B: 15 ràng buộc
- ☐ D4: `KHỚP`, đã ghi lại bảng số đếm
- ☐ D5: `da_ghi: true`
- ☐ Đã báo giáo viên: từ giờ dùng KiN, không dùng web cũ

---

## E. Bật cờ Lớp ôn

Chỉ làm khi A, B, C, D đều xong.

### E1. Bật

**Cách nhanh:** nhắn Claude "bật cờ Lớp ôn". Claude đặt biến qua Vercel và triển khai lại.

**Tự làm:**
1. vercel.com → project **`midnight-elite`** → **Settings** → **Environment Variables**.
2. Thêm: Key `NEXT_PUBLIC_KIN_MO_LOP_ON`, Value `1`, Environment **chỉ Production**.
3. Sang tab **Deployments** → bản production mới nhất → **⋯** → **Redeploy**. Biến `NEXT_PUBLIC_` chỉ có tác dụng sau khi dựng lại.
4. ☐ Chờ bản mới chuyển **Ready** (khoảng 4 phút).

### E2. Thử ngay trên điện thoại

| # | Ai | Làm | Đúng khi | Xong |
|---|---|---|---|---|
| 1 | Chủ lớp | Đăng nhập `admin.midnightelite-edu.com` | Menu có **Lớp ôn**; **Hôm nay** đúng số em học thử, đúng buổi tối nay | ☐ |
| 2 | Chủ lớp | Lớp ôn → **Học sinh** | Số em khớp web cũ; mở một hồ sơ: môn, hạn thử, SĐT đúng | ☐ |
| 3 | Giáo viên | Đăng nhập `midnightelite-edu.com` | Thanh dưới có ô **Lớp ôn**; mở buổi tối nay; điểm danh thử một em → **Đã lưu** | ☐ |
| 4 | Giáo viên | Buổi → **Nội dung và link record** → dán một link YouTube → Lưu | Báo đã lưu | ☐ |
| 5 | Học sinh | Đăng nhập bằng Gmail đã đăng ký với lớp | Vỏ học sinh có **Lớp ôn**: buổi tối nay, hạn thử, nút xem lại record | ☐ |
| 6 | Chủ lớp | Một em → **Cho nghỉ** → bấm **Hoàn tác** ngay | Ghi danh trở lại như cũ | ☐ |

Thêm (nên thử trong tuần đầu):
- ☐ Giáo viên điểm danh **thật** 40–50 em trên điện thoại. Máy mới thử với 8 em; báo Claude nếu chậm hay khó bấm.
- ☐ Chủ lớp mở màn **Lớp ôn → Giáo viên**: đủ giáo viên, đúng môn.
- ☐ Kiểm gia sư lớp ôn có hiện ở `/giang-vien` công khai không (xem C3).

### E3. Tắt gấp

Xoá biến `NEXT_PUBLIC_KIN_MO_LOP_ON` rồi **Redeploy**. Dữ liệu `bca_*` giữ nguyên; bật lại là thấy như cũ.

---

## F. Dọn dẹp và những thứ cần xử lý (ghi đủ)

### F1. Việc dọn nhỏ (Claude làm được, anh chỉ cần nhắn)

| # | Việc | Vì sao | Ai |
|---|---|---|---|
| 1 | Xoá biến `BCA_SEED_GIA=1` (Preview) ở project Vercel `bca-midnight` | Claude thêm 27/11 khi bản xem thử còn dùng DB giả. Giờ DB "Kin Class" chứa dữ liệu thật nên biến này vô dụng. Đang an toàn vì script tự dừng khi DB có học sinh mà không có dấu dữ liệu giả, nhưng nên xoá cho gọn. | Nhắn "xoá BCA_SEED_GIA" |
| 2 | Dấu ĐỎ "Vercel – bca-midnight" trên mọi PR và trên `main` | Project `bca-midnight` dựng mọi nhánh của kho, mà nhánh KiN không có thư mục `bca` nên báo lỗi. Không làm hỏng web cũ (bản lỗi không thay bản đang chạy), chỉ gây nhiễu. Cách bỏ: trong project `bca-midnight` → Settings → Git, đặt Production Branch là nhánh `claude/optimistic-clarke-cbddza` và tắt dựng preview cho nhánh khác; hoặc ngắt Git khi đóng web cũ (F3). | Nhắn để Claude làm, hoặc để đến F3 |
| 3 | DB tạm `neon.new` Claude tạo đêm 26/11 | Không có dữ liệu, không nối vào đâu, tự xoá 29/11. | Không cần làm gì |

### F2. Điểm biết trước, không chặn vận hành (đã ghi trong lệnh gộp, chép lại để anh nắm)

**Chủ đã quyết, giữ mặc định:**
- Học phí lớp ôn **chưa** vào KiN: KiN chỉ có ghi danh, buổi học, điểm danh. Tiền vẫn tính như hiện nay.
- Hạn thử 14 ngày tính **từ ngày đăng ký** (luật lớp), không theo luật D5 của KiN.
- Học sinh Khối 11 và dữ liệu phụ huynh: giữ rào tuổi của KiN, không thu thêm trường nào.

**Cố ý không sửa:**
- Giáo viên gọi API buổi của môn khác nhận 403 (không phải 404) để giữ dòng nhật ký "từ chối"; trang thì hiện chung câu "Không mở được buổi này".
- Học sinh gõ địa chỉ quản trị: `hostRouting.ts` (tệp khoá) đã đưa em về trang của em.

**Giới hạn đã biết:**
- Giới hạn 600 yêu cầu/phút mỗi người đếm trong bộ nhớ từng máy chủ; trên Vercel chỉ chặn được vòng lặp thô.
- Giáo viên chưa có ô ghi chú riêng từng em ở màn điểm danh (đã có link record và nội dung buổi).
- Nút "Thu gọn" cuối danh sách buổi của học sinh dùng kiểu CSS mới; trình duyệt cũ thấy nút ở giữa danh sách.
- 3 cảnh báo eslint `react-hooks/purity` ở `DiemDanhBuoi.tsx` và trang học sinh; không ảnh hưởng chạy.
- Hạn lưu nhật ký: dòng "từ chối" 90 ngày thì xoá; dòng sửa hồ sơ 365 ngày thì giữ dòng nhưng xoá SĐT / Gmail cũ. Đổi được ở `src/lib/lop/server/nhat-ky.ts`. Cron `/api/cron/lop-don-nhat-ky` chạy 01:40 giờ VN mỗi ngày.

**Claude thấy thêm khi kiểm 28/11 (nhỏ, sửa sau cũng được):**
- Khi cờ tắt, ba trang `/admin/lop-on`, `/student/lop-on`, `/lop-cua-toi/lop-on` hiện "không tìm thấy" nhưng mã HTTP là **200**, không phải 404 như lệnh gộp ghi. Lý do: trang có màn "Đang tải" chạy trước. Không lộ dữ liệu.
- Tab trình duyệt ở `/admin/lop-on` vẫn hiện tiêu đề **"Lớp ôn · Hôm nay"** khi cờ tắt. Không lộ dữ liệu, chỉ lộ tên mục.

### F3. Chưa kiểm được trước khi gộp (sẽ biết khi làm A–E)

- Tệp ràng buộc SQL trên Neon (bước B).
- Dữ liệu thật có qua được khoá ngoại "người ghi" không (bước D4 cho biết; không qua thì không ghi gì).
- Cookie đăng nhập có dùng chung giữa `admin.midnightelite-edu.com` và tên miền chính không. Chủ lớp dùng tên miền quản trị, giáo viên và học sinh dùng tên miền chính, nên không vai nào cần cả hai.
- Giáo viên thật điểm danh 40–50 em bằng tay trên điện thoại.

### F4. Sau 1–2 tuần lớp chạy ổn trên KiN

- ☐ Đóng web cũ `bca-midnight.vercel.app`: Vercel → `bca-midnight` → Settings → bật bảo vệ toàn bộ hoặc xoá project. **Trước đó** xuất một bản sao DB "Kin Class" (Neon → Branches → tạo nhánh lưu trữ).
- ☐ Xoá hoặc lưu trữ DB Neon "Kin Class".
- ☐ Xoá nhánh `claude/kin-lop-hoc` (lệnh gộp dặn giữ đến khi bật cờ xong).
- ☐ Báo học sinh: link mới là `midnightelite-edu.com`, đăng nhập bằng Gmail đã đăng ký.

---

## Gửi gì cho Claude khi cần hỗ trợ

- Ảnh chụp hoặc chữ của khối JSON script in ra (`ket_qua`, `dem`, `lech`, `loi`). Khối này không chứa dữ liệu cá nhân.
- Chữ báo lỗi của Neon SQL Editor.
- **Không** gửi: chuỗi kết nối, ảnh chụp trang Connect của Neon, tệp `.env`.
