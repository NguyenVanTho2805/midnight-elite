# Lệnh gộp và làm sạch dữ liệu KiN — 18/11/2026

Gửi người gộp PR (chủ kho `NguyenVanTho2805/midnight-elite`). Đọc hết một lượt trước khi bấm gì.

**Mục tiêu:** đưa bản "web gọn để tạo lớp lại từ đầu" lên production. Bản này gồm:
- học phí tắt hẳn;
- Lịch của gia sư luôn hiện;
- có "Thông báo lớp";
- có script xoá sạch dữ liệu dạy học cũ.

---

## 0. Trạng thái lúc viết (đã kiểm 18/11)

| PR | Nhánh → đích | Nội dung | Trạng thái |
|---|---|---|---|
| [#158](https://github.com/NguyenVanTho2805/midnight-elite/pull/158) | `claude/loi-lop-gia-su` → `main` | LOI-02: lớp và bài học của gia sư | Mở, gộp được |
| [#159](https://github.com/NguyenVanTho2805/midnight-elite/pull/159) | `claude/loi-lop-hoc-sinh` → `main` | LOI-03: lớp của học sinh | Mở, gộp được |
| [#161](https://github.com/NguyenVanTho2805/midnight-elite/pull/161) | `claude/loi-gop-4` → `main` | GOP4: nhắc học, tìm gia sư, ô chọn | Mở, gộp được |
| [#162](https://github.com/NguyenVanTho2805/midnight-elite/pull/162) | `claude/don-gian-hoa` → `claude/loi-gop-4` | DG + HP-BO + TB-LOP + script làm sạch | Mở, gộp được |
| [#163](https://github.com/NguyenVanTho2805/midnight-elite/pull/163) | `claude/hocphi-d1` → `main` | Sửa học phí D1 (lớp đã chuyển cách tính) | Mở, gộp được |

**Bốn PR #158 → #159 → #161 → #162 là MỘT CHỒNG:**
- Mỗi nhánh chứa trọn nhánh trước nó.
- `claude/don-gian-hoa` (#162) đã chứa đủ #158, #159, #161.
- `claude/don-gian-hoa` đã cập nhật với `main`, nên không thiếu commit nào của main.

**#163 độc lập:**
- Đã thử gộp trước với #162: không xung đột, kể cả hai tệp cả hai cùng sửa (`BuoiChiTiet.tsx`, `tien-do-dang-do.md`).
- #163 có sửa hai tệp tiền khoá (`feeChargeServer.ts`, `invoiceServer.ts`). Chủ đã duyệt việc này ngày 16/11.

---

## 1. Gộp (chọn MỘT trong hai cách)

> ⚠️ **Bắt buộc chọn "Create a merge commit".** KHÔNG chọn "Squash and merge", KHÔNG chọn "Rebase and merge".
> Lý do: các nhánh chồng lên nhau. Nếu squash PR đầu, các PR sau sẽ thấy lại toàn bộ commit cũ và báo xung đột hàng loạt.

### Cách A — gọn nhất (khuyên dùng): gộp một lần

1. Mở #162, bấm **Edit** cạnh tiêu đề, đổi nhánh đích từ `claude/loi-gop-4` sang **`main`**.
2. Đợi kiểm tra (CI / Vercel Preview) chạy xong và xanh.
3. Bấm **Create a merge commit** để gộp #162 vào `main`.
4. GitHub thường tự đánh dấu #158, #159, #161 là "Merged", vì commit của chúng đã nằm trong `main`.
   - Nếu PR nào vẫn ở "Open": kiểm lại rằng mục "Files changed" của nó đã trống, rồi đóng tay kèm ghi chú "đã vào main qua #162".
5. Gộp **#163** (Create a merge commit).

```bash
gh pr edit 162 --repo NguyenVanTho2805/midnight-elite --base main
```

```bash
gh pr merge 162 --repo NguyenVanTho2805/midnight-elite --merge
```

```bash
gh pr merge 163 --repo NguyenVanTho2805/midnight-elite --merge
```

### Cách B — gộp lần lượt từng PR

Đúng thứ tự: **#158 → #159 → #161 → #162**, rồi mới tới **#163**.
- Mỗi PR đều dùng "Create a merge commit".
- Đợi PR trước gộp xong mới gộp PR sau.
- Trước khi gộp #162, đổi đích của nó sang `main` như bước A.1. Nếu nhánh `claude/loi-gop-4` bị xoá tay trước lúc đó, GitHub có thể đóng #162.

```bash
for n in 158 159 161; do gh pr merge $n --repo NguyenVanTho2805/midnight-elite --merge || break; done
```

```bash
gh pr edit 162 --repo NguyenVanTho2805/midnight-elite --base main
```

```bash
gh pr merge 162 --repo NguyenVanTho2805/midnight-elite --merge
```

```bash
gh pr merge 163 --repo NguyenVanTho2805/midnight-elite --merge
```

### Lưu ý khi gộp

- **Chưa xoá nhánh** `claude/loi-gop-4` và các nhánh trong chồng cho tới khi #162 đã vào `main`. Kho hiện TẮT "Tự xoá nhánh sau khi gộp" (đã kiểm 18/11), nên nhánh chỉ mất khi có người xoá tay.
- Không bấm "Update branch" kiểu rebase trên các PR này.
- Nếu GitHub báo xung đột (không nên có), DỪNG và báo lại. Không tự sửa trên web.

---

## 2. Triển khai (Vercel tự chạy khi `main` đổi)

- Bản build production sẽ tự `prisma db push`. Thay đổi lần này **chỉ thêm** bảng và cột (ví dụ bảng mới `class_announcements`), không xoá gì.
- Lưới chặn `db-push-guard` tự từ chối mọi thay đổi làm mất dữ liệu. Build mà đỏ ở bước `db push` thì dừng, chụp log gửi lại. **Không** đặt `PRISMA_ACCEPT_DATA_LOSS`.
- **Biến môi trường production — kiểm trước khi build:**
  - **KHÔNG đặt** biến `NEXT_PUBLIC_KIN_MO_*` nào, trừ khi muốn mở lại phần đó.
    - Riêng `NEXT_PUBLIC_KIN_MO_HOC_PHI` phải để trống: thiếu biến này thì học phí tắt hẳn.
    - Đây là biến `NEXT_PUBLIC_`, nên đổi giá trị xong phải **build lại** mới có tác dụng.
  - **KHÔNG đặt** `KIN_PLAN_ENFORCE=1`, vì trang nâng gói đang ẩn.
  - `CRON_SECRET` phải có, dùng ở bước 5.
- **Sau khi deploy xong, mở thử trên điện thoại:**
  - Đăng nhập gia sư → Lớp → Tạo lớp: không còn mục học phí.
  - Mục **Lịch** có trên thanh bên.
  - Mở một lớp: dải tab có **Thông báo**.

---

## 3. Làm sạch dữ liệu — CHỈ làm sau khi bước 2 xanh

> Không hoàn tác được nếu không có bản sao lưu. Làm vào giờ vắng người dùng.
> `DATABASE_URL` phải trỏ đúng DB **production**. Bản Preview của Vercel dùng chung DB này, nên sau khi xoá thì Preview cũng trống.

Chạy trên máy có mã `main` mới nhất (`git pull`, `npm ci`), với `DATABASE_URL` của production:

**3.1 Sao lưu.**
- Cần `pg_dump` cùng phiên bản lớn với Postgres của Neon, hoặc mới hơn.
- Giữ tệp `.dump` ở nơi an toàn, KHÔNG đưa lên git.
- Nên tạo thêm một nhánh hoặc điểm khôi phục trên Neon cho chắc.

```bash
pg_dump "$DATABASE_URL" -Fc -f kin-truoc-lam-sach-$(date +%Y%m%d-%H%M).dump
```

**3.2 Xem trước.** Bước này chỉ đọc, không xoá gì. Đọc kỹ bảng in ra: số dòng sẽ xoá, sẽ giữ, và **tên database**.

Nếu giữ lại tài khoản gia sư và học sinh (họ đăng nhập lại được, chỉ mất lớp và dữ liệu học):

```bash
npx tsx scripts/lam-sach-du-lieu.ts
```

Nếu xoá luôn tài khoản gia sư và học sinh (chỉ giữ quản trị cấp 1 và quản trị nội dung):

```bash
npx tsx scripts/lam-sach-du-lieu.ts --xoa-tai-khoan
```

**3.3 Xoá thật.** Dùng đúng lệnh mà bước 3.2 in ở cuối; tên database lấy từ bước xem trước.

```bash
npx tsx scripts/lam-sach-du-lieu.ts --apply --da-sao-luu --xac-nhan <tên-database>
```

Nếu chọn xoá cả tài khoản, thêm `--xoa-tai-khoan` vào cuối lệnh trên.

**Ý nghĩa mã thoát của script:**
- `0`: xong.
- `1`: thiếu hoặc sai tham số, chưa xoá gì.
- `2`: bị chặn vì an toàn, chưa xoá gì.
- `3`: lỗi khi ghi. Cả lượt xoá chạy trong một giao dịch, nên lỗi giữa chừng thì dữ liệu còn nguyên.

**Khôi phục nếu cần:**

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" kin-truoc-lam-sach-<ngày-giờ>.dump
```

**Script giữ lại và xoá những gì:**
- **Giữ:** tài khoản, cài đặt từng người, nội dung hệ thống (bài viết, điểm chuẩn, video thư viện, nội dung Tiếng Anh, cấu hình gói).
- **Xoá:** lớp, lịch, buổi học, điểm danh, mã mời, bài tập, đề thi, bài làm, thông báo, hỏi đáp, học phí, thông báo lớp.

---

## 4. Thử nhanh sau khi làm sạch

1. Gia sư tạo một lớp → đặt lịch → lấy mã mời.
2. Học sinh nhập mã → gia sư duyệt ở tab Học sinh.
3. Gia sư đăng một tin ở tab **Thông báo** → học sinh thấy thông báo trên chuông, bấm vào thì mở đúng tab Thông báo.
4. Gia sư mở **Lịch** → vào buổi học → điểm danh → bấm **Đã dạy xong**. Không có khoản học phí nào sinh ra.

---

## 5. Việc cấu hình còn lại (một lần)

- **cron-job.org — thư nhắc trước giờ học:**
  - Gọi `https://midnightelite-edu.com/api/cron/nhac-buoi-hoc` mỗi **15 phút**.
  - Header: `Authorization: Bearer <CRON_SECRET>` (dùng đúng giá trị đặt trên Vercel).
  - Thử trước bằng `?dryRun=1`: không gửi thư, chỉ đếm số thư sẽ gửi.
- Không có bước này thì app vẫn chạy, chỉ không có thư nhắc.

---

## 6. Những điều KHÔNG làm

- Không squash hay rebase khi gộp các PR trong chồng.
- Không xoá nhánh trước khi #162 vào `main`.
- Không chạy script làm sạch trước khi sao lưu, hoặc khi chưa chắc `DATABASE_URL` là DB nào.
- Không đặt `PRISMA_ACCEPT_DATA_LOSS`, `PREVIEW_OWN_DB`, `KIN_PLAN_ENFORCE`, hay bất kỳ `NEXT_PUBLIC_KIN_MO_*` nào nếu không có chủ ý.

## 7. Còn biết trước (không chặn việc gộp)

- Quản trị chưa có màn để gỡ một "Thông báo lớp" xấu. Lúc này phải gỡ trong DB.
- Gỡ một tin không thu hồi thông báo đã gửi: học sinh bấm vào sẽ thấy tab trống.
- Đồng giảng chưa có lối xem Thông báo lớp.
- Chi tiết test và rà soát nằm trong mô tả từng PR và trong `docs/kin/tien-do-dang-do.md`.
