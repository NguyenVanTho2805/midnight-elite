# Lệnh gộp và đưa Lớp ôn vào vận hành — 28/11/2026

Gửi người gộp PR (Thanh / Thọ, chủ kho `NguyenVanTho2805/midnight-elite`). Đọc hết một lượt trước khi bấm gì.

**Mục tiêu:** đưa phần quản lý lớp ôn (ghi danh, học thử, buổi học, điểm danh, đơn đăng ký, giáo viên) từ web riêng `bca-midnight.vercel.app` vào KiN.

**Trả lời ngắn cho câu "đã vận hành được chưa":**
- **Mã: xong, gộp được ngay.** Mọi thứ nằm sau cờ `NEXT_PUBLIC_KIN_MO_LOP_ON`, mặc định TẮT, nên gộp xong web đang chạy không đổi gì.
- **Vận hành: chưa.** Còn 4 việc chỉ làm được SAU khi gộp (mục 3–6), vì chúng đụng cơ sở dữ liệu thật và biến môi trường production. Làm xong 4 việc đó là lớp chạy trên KiN.

---

## 0. Trạng thái lúc viết (đã kiểm 28/11)

| PR | Nhánh → đích | Nội dung | Trạng thái |
|---|---|---|---|
| [#170](https://github.com/NguyenVanTho2805/midnight-elite/pull/170) | `claude/kin-lop-hoc` → `main` | Lớp ôn trong KiN, sau cờ `LOP_ON` | Mở, gộp được, không xung đột |

- Một PR duy nhất, không chồng lên PR nào khác.
- Kiểm tra trên PR:
  - **`Vercel – midnight-elite`: xanh.** Đây là lần `next build` đầy đủ của KiN.
  - **`Vercel – bca-midnight`: ĐỎ, bỏ qua được.** Đó là dự án Vercel của web cũ, nó thử dựng mọi nhánh của kho và báo "Root Directory `bca` does not exist" vì nhánh KiN không có thư mục `bca`. Bản dựng hỏng không thay bản web cũ đang chạy. Sau khi gộp, `main` cũng sẽ có một dấu đỏ y như vậy.
- Test cục bộ: 16 bài, 834 ca đạt, 0 đỏ. `tsc` sạch.
- Rà bảo mật và đóng vai ba người dùng (chủ lớp, giáo viên, học sinh): 0 lỗi P1; mọi lỗi P2 đã sửa trừ một lỗi cố ý giữ (xem mục 8).

**Tệp vỏ KiN có sửa** (đều chỉ có tác dụng khi cờ bật, trừ dòng cron):
- `src/lib/features.ts`: thêm cờ `LOP_ON`.
- `src/lib/adminNav.ts`: module "Lớp ôn" cho quản trị cấp 1.
- `src/components/tutor/TutorShell.tsx`: mục "Lớp ôn" cho giáo viên lớp ôn.
- `src/lib/adminOps.ts` + `vercel.json`: thêm cron `lop-don-nhat-ky`.
- `prisma/schema.prisma`: 13 bảng `bca_*` mới, thêm trường quan hệ ngược ở `User`. Chỉ thêm.

**Không đụng:** 5 tệp tiền (`tuition.ts`, `invoiceServer.ts`, `feeChargeServer.ts`, `sessionBookServer.ts`, `notify.ts`), `hostRouting.ts`, `socialAuth.ts`, `session.ts`, `permissions.ts`, `package.json`.

---

## 1. Gộp

Một PR, không chồng, nên kiểu gộp nào cũng được. Khuyên dùng "Create a merge commit" như các lần trước.

```bash
gh pr merge 170 --repo NguyenVanTho2805/midnight-elite --merge
```

- Nếu GitHub báo xung đột (không nên có), DỪNG và báo lại. Không tự sửa trên web.
- Chưa xoá nhánh `claude/kin-lop-hoc` cho tới khi mục 6 xong (còn dùng để sửa nhanh nếu cần).

---

## 2. Triển khai (Vercel tự chạy khi `main` đổi)

- Bản build production tự `prisma db push`. Lần này **chỉ thêm** 13 bảng `bca_*` và các khoá ngoại giữa chúng; không cột, không bảng nào của KiN bị đổi. `t-db-push-guard` 28/28 xanh.
- Build mà đỏ ở bước `db push` thì dừng, chụp log gửi lại. **Không** đặt `PRISMA_ACCEPT_DATA_LOSS`.
- **Chưa đặt** `NEXT_PUBLIC_KIN_MO_LOP_ON` ở bước này. Cờ bật ở mục 6, sau khi có dữ liệu.
- Cron mới `/api/cron/lop-don-nhat-ky` (mỗi ngày 01:40 giờ VN) dùng `CRON_SECRET` sẵn có. Cờ tắt thì nó chỉ ghi mốc đã chạy, không đụng dữ liệu.
- **Sau khi deploy xong, kiểm nhanh:** web KiN mở bình thường; menu quản trị và vỏ gia sư KHÔNG có "Lớp ôn"; `/admin/lop-on` trả 404. Đúng như vậy là cờ đang tắt.

---

## 3. Chạy tệp ràng buộc trên cơ sở dữ liệu thật

`db push` không tạo được các ràng buộc CHECK / EXCLUDE (ví dụ "một em không có hai đoạn ghi danh chồng ngày cùng môn"). Chúng nằm trong `prisma/sql/bca-rang-buoc.sql`.

> ⚠️ Tệp này **chưa chạy trên Neon lần nào**, mới chạy trên Postgres cục bộ. Nó chỉ đụng bảng `bca_*` (đang trống) và chạy lại an toàn, nhưng hãy tạo một nhánh / điểm khôi phục Neon trước.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/bca-rang-buoc.sql
```

Chưa rõ: lần `db push` sau có gỡ các ràng buộc tay này không. Sau lần deploy kế tiếp, chạy lại lệnh trên một lần cho chắc (đã có thì nó bỏ qua).

---

## 4. Tài khoản KiN cho chủ lớp và giáo viên

Theo quyết định của chủ (28/11): đăng nhập bằng **mật khẩu KiN**, giáo viên đứng lớp ở **khu gia sư** `/lop-cua-toi`.

- **Chủ lớp:** là tài khoản quản trị cấp 1 (`admin_super`) của KiN. Email phải đã xác minh.
- **Mỗi giáo viên:** một tài khoản KiN vai giáo viên (`admin` + `teacher`), email **đã xác minh** và **trùng Gmail** đã khai ở màn Giáo viên của lớp (so theo Gmail gốc: không phân biệt hoa thường, dấu chấm, `+nhãn`).
- Giáo viên chưa có dòng ở màn Giáo viên, bị khoá, hoặc chưa được giao môn thì vào thấy "Chưa được phân công môn nào".
- **Học sinh:** không phải làm gì. Em đăng nhập KiN bằng Gmail đã đăng ký với lớp (đã xác minh) thì lần đầu mở vỏ học sinh, web tự nối hồ sơ. Trùng nhiều hồ sơ thì web không nối và bảo em nhắn chủ lớp.

---

## 5. Chuyển dữ liệu thật từ web cũ

Nguồn: cơ sở dữ liệu Neon "Kin Class" của `bca-midnight.vercel.app`. Đích: cơ sở dữ liệu production của KiN (13 bảng `bca_*`).

> Luật đã chốt: **luôn xem trước → chỉ khi KHỚP và chủ đồng ý mới `--apply`.** Script không in tên, SĐT, Gmail; chỉ in số đếm và mã băm đối soát. Chuỗi kết nối chỉ đặt qua biến môi trường trong terminal, không dán vào chat hay tệp.

**5.1 Sao lưu đích** (hoặc tạo điểm khôi phục Neon).

```bash
pg_dump "$LOP_DICH_URL" -Fc -f kin-truoc-chuyen-lop-$(date +%Y%m%d-%H%M).dump
```

**5.2 Xem trước.** Không ghi gì.

```bash
LOP_NGUON_URL="<chuỗi Kin Class>" LOP_DICH_URL="<chuỗi KiN production>" npx tsx scripts/lop-chuyen-du-lieu.ts
```

Đọc dòng `ket_qua`:
- `KHỚP`: số dòng và mã băm 13 bảng trùng nhau. Sang 5.3.
- `LỆCH`: dừng, gửi lại bảng in ra.
- `LỖI` kèm `rang_buoc` có đuôi `_fkey`: dữ liệu cũ có "người ghi" không tồn tại trong bảng tài khoản lớp (khoá ngoại mới thêm 28/11). Dừng, gửi lại tên ràng buộc; chưa có gì được ghi.
- `TỪ CHỐI`: đọc `ly_do` (ví dụ đích đã có dữ liệu).

**5.3 Ghi thật.**

```bash
LOP_NGUON_URL="<chuỗi Kin Class>" LOP_DICH_URL="<chuỗi KiN production>" npx tsx scripts/lop-chuyen-du-lieu.ts --apply
```

- Mã thoát: `0` khớp và đã ghi; `2` bị từ chối; `3` lệch hoặc lỗi. Cả lượt chạy trong một giao dịch: lỗi giữa chừng thì đích còn nguyên.
- `--ghi-de` xoá sạch 13 bảng `bca_*` rồi chép lại. **Không dùng sau khi đã bật cờ**: nó xoá các lần nối tài khoản của học sinh và mọi thứ nhập trong KiN. Script tự từ chối khi đích đã có hồ sơ nối tài khoản.
- **Từ lúc ghi xong, ngừng nhập ở web cũ.** Hai nơi không đồng bộ với nhau; nhập tiếp ở web cũ là mất khi chuyển.

---

## 6. Bật cờ

Trên Vercel, dự án `midnight-elite`, môi trường **Production**:

```
NEXT_PUBLIC_KIN_MO_LOP_ON=1
```

Đây là biến `NEXT_PUBLIC_`, nên đặt xong phải **Redeploy** mới có tác dụng.

**Thử ngay sau khi bật, trên điện thoại:**
1. Chủ lớp đăng nhập → menu quản trị có **Lớp ôn** → Hôm nay hiện đúng số em học thử, buổi tối nay.
2. Học sinh → số em khớp web cũ. Mở một hồ sơ: môn, hạn thử, SĐT đúng.
3. Giáo viên đăng nhập → thanh dưới có ô **Lớp ôn** → mở buổi tối nay → điểm danh thử một em → "Đã lưu".
4. Giáo viên mở "Nội dung và link record", dán một link YouTube → Lưu.
5. Một học sinh đăng nhập bằng Gmail đã đăng ký → vỏ học sinh có **Lớp ôn** → thấy buổi tối nay, hạn thử, nút xem lại record.
6. Chủ lớp bấm "Cho nghỉ" một em rồi **Hoàn tác** ngay → ghi danh trở lại như cũ.

**Muốn tắt gấp:** xoá biến `NEXT_PUBLIC_KIN_MO_LOP_ON` rồi Redeploy. Dữ liệu `bca_*` giữ nguyên.

---

## 7. Những điều KHÔNG làm

- Không đặt `PRISMA_ACCEPT_DATA_LOSS`, `PREVIEW_OWN_DB`.
- Không chạy `--apply` khi chưa xem trước, hoặc khi chưa chắc `LOP_DICH_URL` là cơ sở dữ liệu nào.
- Không dùng `--ghi-de` sau khi đã bật cờ.
- Không bật cờ trước khi chuyển dữ liệu (giáo viên và học sinh sẽ thấy lớp trống).
- Không đóng `bca-midnight.vercel.app` và không xoá Neon "Kin Class" cho tới khi lớp chạy ổn trên KiN một đến hai tuần.
- Không sửa `hostRouting.ts`, `socialAuth.ts` để mở Google hay tên miền quản trị cho giáo viên: chủ đã quyết giữ luật hiện tại.

---

## 8. Còn biết trước (không chặn việc gộp)

**Chủ đã quyết, giữ mặc định:**
- Học phí của lớp ôn **chưa** vào KiN: chỉ có ghi danh, buổi học, điểm danh. Tiền vẫn tính như hiện nay.
- Hạn thử 14 ngày tính từ ngày đăng ký (luật lớp), không theo luật D5 của KiN.
- Khối 11 và dữ liệu phụ huynh: giữ rào tuổi của KiN, không thu thêm trường nào.

**Cố ý không sửa:**
- Giáo viên gọi API của buổi môn khác nhận 403 (không phải 404), để giữ dòng nhật ký "từ chối". Trang thì hiện chung một câu "Không mở được buổi này".
- Học sinh gõ địa chỉ quản trị: `hostRouting.ts` đã đưa em về trang của em; không sửa tệp khoá.

**Giới hạn đã biết:**
- Giới hạn tần suất (600 yêu cầu/phút mỗi người) đếm trong bộ nhớ từng máy chủ, trên Vercel chỉ chặn được vòng lặp thô.
- Giáo viên chưa có ô ghi chú riêng từng em ở màn điểm danh (đã có link record và nội dung buổi).
- Nút "Thu gọn" ở cuối danh sách buổi của học sinh dùng kiểu CSS mới, mới thử trên Chrome; trình duyệt cũ thấy nút ở giữa danh sách.
- Còn 3 cảnh báo eslint `react-hooks/purity` (`Date.now()` trong hàm xử lý bấm) ở `DiemDanhBuoi.tsx` và trang học sinh. Không ảnh hưởng chạy.
- Hạn lưu nhật ký do tôi đặt, chủ đổi được ở `src/lib/lop/server/nhat-ky.ts`: dòng "từ chối" 90 ngày thì xoá; dòng sửa hồ sơ 365 ngày thì giữ dòng nhưng xoá SĐT / Gmail cũ.

**Chưa kiểm được trước khi gộp:**
- Tệp ràng buộc SQL trên Neon (mục 3).
- Dữ liệu thật có qua được khoá ngoại "người ghi" không (mục 5.2 sẽ cho biết, không ghi gì nếu không qua).
- Cookie đăng nhập có dùng chung giữa `admin.midnightelite-edu.com` và tên miền chính trên production không. Chủ lớp dùng tên miền quản trị, giáo viên và học sinh dùng tên miền chính, nên không vai nào cần cả hai.
- Giáo viên thật điểm danh 40–50 em bằng tay trên điện thoại (mới thử bằng máy với 8 em).

Chi tiết test, quyết định và các đợt rà soát: `docs/kin/lop/README.md`.
