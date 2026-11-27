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
| 1 | Schema `bca_*` + SQL ràng buộc (CHECK, EXCLUDE gist) | thử trên nhánh Neon: `db push` có xoá ràng buộc tay không |
| 2 | Lớp quyền + phiên (ánh xạ `getSession` của KiN sang vai chủ / GV / học sinh) | |
| 3 | Script chuyển dữ liệu từ DB Neon "Kin Class" | xem trước → hỏi chủ → ghi |
| 4 | Hôm nay + Học sinh (chỉ đọc) | |
| 5 | Buổi học + Điểm danh (ghi) | |
| 6 | Đơn + Tài khoản GV | |
| 7 | Khu học sinh | |
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
