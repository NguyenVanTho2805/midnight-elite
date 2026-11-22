# Bàn giao: gộp và triển khai "Sửa chữa lớn" (SCL) — KiN

Ngày soạn: 22/11/2026. Kho: `NguyenVanTho2805/midnight-elite`. Nền tảng chạy: Vercel (production), DB Neon (Postgres).

Tệp này viết cho **một phiên Claude có quyền GitHub + Vercel** (hoặc cho người làm tay). Làm đúng thứ tự, dừng và hỏi chủ khi gặp mục **DỪNG**.

---

## 1. Tóm tắt là gì

Bản "Sửa chữa lớn" làm KiN gọn để chạy thật cho một chủ (vừa quản trị vừa dạy) và vài gia sư:
- Một tài khoản: admin = GVCN đứng lớp trong vỏ gia sư; gia sư = GV bộ môn.
- Học sinh chỉ còn: xem bản ghi (YouTube không công khai), lấy tài liệu, làm bài, xem điểm.
- Gia sư: kéo-thả tài liệu, gắn link YouTube, sổ điểm.
- Xoá hẳn Tiếng Anh, Điểm chuẩn, Tin tức, Xếp hạng; ẩn Học phí, Cộng đồng (mã giữ, cờ tắt).
- Giao diện mới theo bản Figma chủ đã duyệt (`docs/kin/thiet-ke/scl/ban-chot.html`).

Kế hoạch và các quyết định Q1–Q15: `docs/kin/rd/SUA-CHUA-LON-KE-HOACH.md`.

## 2. Bốn PR, xếp chồng — gộp ĐÚNG thứ tự

| Thứ tự | PR | Nhánh | Base hiện tại |
|---|---|---|---|
| 1 | [#164](https://github.com/NguyenVanTho2805/midnight-elite/pull/164) SCL đợt 1: bảo mật điểm/lớp, Chủ nhiệm đứng lớp, vào lớp nhanh | `claude/sua-chua-lon` | `main` |
| 2 | [#165](https://github.com/NguyenVanTho2805/midnight-elite/pull/165) SCL đợt 2: sổ điểm, tài liệu + YouTube + nộp ảnh thành PDF, hiệu năng | `claude/sua-chua-lon-2` | `claude/sua-chua-lon` |
| 3 | [#166](https://github.com/NguyenVanTho2805/midnight-elite/pull/166) SCL đợt 3F: xoá 4 phần thừa, bịt lối vào phần tắt, một cửa tạo lớp | `claude/sua-chua-lon-3` | `claude/sua-chua-lon-2` |
| 4 | [#167](https://github.com/NguyenVanTho2805/midnight-elite/pull/167) SCL đợt 4: giao diện theo bản chốt | `claude/sua-chua-lon-4` | `claude/sua-chua-lon-3` |
| 5 | [#168](https://github.com/NguyenVanTho2805/midnight-elite/pull/168) SCL đợt 5: học thử có hạn + nhận phiếu form BCA + trang chào | `claude/sua-chua-lon-5` | `claude/sua-chua-lon-4` |

Mỗi PR chứa trọn PR trước nó. Commit cuối của #167: `b3593777`.

### Cách gộp (làm lần lượt 1 → 4)
1. Mở PR. Nếu base chưa phải `main` thì **Edit → đổi base sang `main`** (PR trước đã gộp nên diff chỉ còn phần của PR này).
2. Chờ kiểm tra CI / bản preview Vercel xanh. Đỏ ⇒ **DỪNG**, chép lỗi gửi chủ.
3. Gộp bằng **"Create a merge commit"** (KHÔNG squash, KHÔNG rebase — các PR sau dựa trên lịch sử commit).
4. **Không xoá nhánh** sau khi gộp (để còn đối chiếu).
5. Sang PR kế.

Lệnh tương đương bằng `gh` (chạy từng dòng, kiểm kết quả mỗi bước):
```bash
gh pr merge 164 --merge
gh pr edit 165 --base main && gh pr merge 165 --merge
gh pr edit 166 --base main && gh pr merge 166 --merge
gh pr edit 167 --base main && gh pr merge 167 --merge
gh pr edit 168 --base main && gh pr merge 168 --merge
```
Xung đột khi đổi base ⇒ **DỪNG**, không tự giải xung đột trên `main`.

## 3. Triển khai

- Gộp vào `main` ⇒ Vercel tự build production. Lệnh build: `prisma generate && node scripts/db-push-on-production.mjs && next build`.
- **Schema chỉ THÊM** (không mất dữ liệu): cột `ExamResult.pendingReview` (mặc định false) và bảng mới `login_failures`. `db push` chạy tự động lúc build production. Nếu build báo `db push` đòi chấp nhận mất dữ liệu ⇒ **DỪNG**, không thêm `--accept-data-loss`.
- Các bảng của phần đã xoá (Tiếng Anh, Tin tức…) **vẫn giữ trong DB**, chỉ thêm chú thích; không có lệnh xoá bảng.
- **PR 1–4 không cần biến môi trường mới.** Không bật cờ `NEXT_PUBLIC_KIN_MO_*` nào — để nguyên như hiện tại (tắt).
- **PR 5 (đợt 5)** thêm schema chỉ-thêm: 3 cột trên `enrollments` (`trialDays`, `trialStartedAt`, `trialConvertRequestedAt`), bảng `intake_welcomes`; cron mới `het-han-hoc-thu` (mỗi ngày). Biến môi trường Vercel (Production) — **chủ đặt, KHÔNG dán giá trị vào PR hay chat**:
  - `KIN_INTAKE_KEY`: chuỗi ngẫu nhiên ≥ 24 ký tự (vd `openssl rand -base64 32`); đặt CÙNG giá trị vào Script Property `KIN_INTAKE_KEY` của Apps Script.
  - `KIN_INTAKE_COURSES`: JSON môn → mã lớp KiN, vd `{"Toán":"<mã lớp>","Sử":"<mã lớp>","Địa":"<mã lớp>","Anh":"<mã lớp>"}` (tạo 4 lớp trên KiN trước; môn chưa có lớp thì bỏ khỏi JSON).
  - `KIN_ZALO_HOC_THU` (tuỳ chọn): link nhóm Zalo học thử; mặc định `https://zalo.me/g/ruroagad4wqf3xianfoc`.
  - Kiểm `NEXT_PUBLIC_APP_URL` = `https://midnightelite-edu.com` (link trang chào dựng từ biến này).
  - Thiếu `KIN_INTAKE_KEY` thì `/api/intake/bca` trả 503 và form chạy như cũ — an toàn để gộp trước, bật sau.
- **Phía form (làm SAU khi PR 5 lên production và đã đặt env):** bản vá Apps Script + trang GitHub nằm ở máy chủ của chủ (`midnight-elite/.local-dev/bca-ban-va/`, KHÔNG có trong kho vì Code.gs chứa số tài khoản). Làm theo `HUONG-DAN-DAN.md` trong thư mục đó: dán Code.gs, đặt 2 Script Properties, **Manage deployments ▸ Edit ▸ Phiên bản mới** (không "New deployment"), đẩy index.html lên kho `aodtsix-cmd/bca-midnight-class`.
- Cron (`vercel.json`): bỏ `english-voa`, `article-publish` (phần đã xoá) và `pro-renewal-reminders` (phần Kinh doanh đang ẩn; route vẫn giữ). **Kiểm:** nếu production còn người đang dùng gói Pro trả tiền thì báo chủ trước khi gộp #166, vì họ sẽ không còn nhận email nhắc gia hạn.

### Việc sau khi lên production (chủ làm hoặc duyệt)
1. **Sao lưu DB trước** (Neon: tạo branch/backup, hoặc `pg_dump "$DATABASE_URL" -Fc -f kin-truoc-scl-$(date +%Y%m%d-%H%M).dump`).
2. Ẩn các lớp gia sư lỡ để công khai và đổi lớp cũ sang "chờ duyệt" — script mặc định chỉ xem trước:
   ```bash
   npx tsx scripts/scl-an-lop-cong-khai.ts
   ```
   Đọc danh sách in ra, chủ đồng ý thì mới chạy ghi thật:
   ```bash
   npx tsx scripts/scl-an-lop-cong-khai.ts --apply --xac-nhan <tên database>
   ```
   Script chỉ đụng lớp của gia sư (không đụng lớp trung tâm, học phí, ghi danh, mã mời), làm trong một giao dịch.

## 4. Kiểm nhanh sau triển khai (5 phút, trên production)

Dùng tài khoản thật của chủ, **không** tạo dữ liệu giả trên production.
- [ ] Trang chủ, `/dang-nhap` mở được, không trắng trang.
- [ ] Tài khoản quản trị (GVCN) đăng nhập ở tên miền chính ⇒ vào vỏ gia sư, thấy "Hộp việc", "Lớp của bạn", nhóm Quản lý.
- [ ] Mở một lớp ⇒ trang lớp hai cột, ngăn "Sửa bài" mở được; sổ điểm mở được.
- [ ] Tạo lớp (bước 3) có 3 lựa chọn cách vào lớp, gồm "Vào ngay". *(Chỉ xem, không bấm Tạo nếu không định tạo thật.)*
- [ ] Học sinh: trang lớp có "Cần làm", "Buổi gần đây", "Tất cả bài học"; trang "Điểm" mở được.
- [ ] `admin.<tên miền>`: chỉ còn quản người + nhật ký; không 500.
- [ ] Vercel → Logs: không có lỗi 500 lặp lại trong 10 phút đầu.

Có lỗi nghiêm trọng ⇒ Vercel → Deployments → **Promote** bản trước đó (hoàn tác tức thì, schema thêm không ảnh hưởng bản cũ). Báo chủ.

## 5. Hành vi mới cần biết (để không tưởng là lỗi)
- (PR 5) Học sinh Khối 11/12 gửi phiếu ⇒ KiN tự tạo tài khoản + ghi danh học thử 14 ngày (tính từ lần đầu em mở lớp, chung mọi môn) và chuyển tới `/chao/<mã>`. Hết hạn ⇒ khoá hẳn tài liệu/bài. Tab Học sinh của lớp có khối Học thử: "Xác nhận chính thức", "Gia hạn 7 ngày".
- Ngăn "Sửa bài" của gia sư **tự lưu** sau 1,5 giây ngừng gõ; đóng ngăn hay đổi bài là lưu ngay.
- Dải tab lớp gia sư: Video / Thông báo / Cài đặt / Điểm danh nằm sau nút **"Khác"**.
- Trang lớp học sinh bỏ cây chương; cây vẫn ở thanh bên trang bài học.
- Điểm tự khai (đề Azota) mới phải chờ gia sư duyệt mới vào báo cáo; điểm cũ giữ nguyên.
- Lớp GVCN tạo mang **tên thật** người tạo; có thể chọn **"Vào ngay"** (lớp hiện ở trang công khai, ai có tài khoản học sinh cũng vào được).
- Đăng ký học sinh: 3 ô, vào thẳng, không màn OTP.

## 6. Đã kiểm gì (máy cục bộ, Postgres 17 + Next dev)
`tsc` 0 lỗi; eslint không thêm lỗi so với `main`. Hơn 40 bộ test đều xanh ở lượt chạy cuối, gồm: t-no-hex, t-links, t-no-fabricated, t-kin-components 110/0, t-join-request 126/0, t-join-request-lib 78/0, t-pro-webhook-lib 54/0, ui-scl-g-0/hs/sd/gs, ui-don-gian 99/0, ui-student-shell 50/0, ui-chu-nhiem 26/0, ui-tao-lop-wizard 40/0, ui-kin-components 122/0, ui-gs-lop-gon-tha 38/0, ui-tutor-shell (bật 5 cờ) 97/0. Chi tiết số từng đợt nằm trong mô tả mỗi PR.

## 7. Chưa làm / còn để ngỏ
- Chưa chụp kiểm chế độ tối ở màn mới; chưa đo tương phản bằng công cụ (dùng token màu sẵn có).
- Xem trước YouTube chưa có tên và thời lượng thật của video.
- Màn "Điểm" học sinh chưa ghi ngày nộp/chấm từng dòng; chuông thông báo chưa gộp vào nút tài khoản.
- Màn "Hộp việc" trên điện thoại của gia sư là bản phác — chủ nên xem trên điện thoại thật.
- Gộp `/admin/thi-thu` vào trình soạn đề của gia sư: **chưa làm**, chờ chủ (gần vùng tiền bị khoá).
- Vài bài test chỉ kiểm nhánh "cờ tắt" (Cộng đồng, thi thử công khai, Học phí, Vận hành phụ); muốn kiểm đủ thì chạy lại với cờ bật.

## 8. Luật không được phá khi làm tiếp
- Không bật cờ production, không sửa 5 tệp tiền bị khoá (`tuition.ts`, `invoiceServer.ts`, `feeChargeServer.ts`, `sessionBookServer.ts`, `notify.ts`).
- Không xoá dữ liệu thật, không xoá nhánh GitHub, không squash các PR này.
- Việc chạm tiền hoặc trẻ dưới 16 tuổi ⇒ hỏi chủ trước.
