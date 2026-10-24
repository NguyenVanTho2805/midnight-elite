# Trang chủ gia sư (Tổng quan) và Hộp việc

**Route:** `/lop-cua-toi` (Hộp việc, màn đầu mặc định khi gia sư đã bật module "Hộp việc") và `/lop-cua-toi/tong-quan` (Tổng quan, hiện chỉ vào được qua Khác → Dạy học → Tổng quan). **Tệp mã chính:** `src/app/lop-cua-toi/(tutor)/page.tsx` (cổng chọn màn), `src/components/tutor/HopViec.tsx` (Hộp việc), `src/app/lop-cua-toi/(tutor)/tong-quan/page.tsx` + `TutorDashboard.tsx` + `TutorClassList.tsx` (Tổng quan), `src/lib/tutorTodo.ts` + `src/lib/tutorDashboard.ts` (bộ đếm việc, số liệu), `src/lib/tutorInbox.ts` + `src/lib/tutorInboxServer.ts` + `src/app/api/tutor/hop-viec/route.ts` (dữ liệu Hộp việc), vỏ `src/components/tutor/TutorShell.tsx`, `src/components/shell/LopCuaToiFrame.tsx`, `src/components/kin/shell/*`. **Vai người dùng:** gia sư (`role = "admin"` và `adminRole = "teacher"`); học sinh và quản trị không thấy màn này (ở `/lop-cua-toi` họ chỉ thấy danh sách lớp của họ; `/lop-cua-toi/tong-quan` chuyển họ về `/lop-cua-toi`).

> **Lưu ý về mốc mã.** Mọi mô tả dưới đây lấy từ **cây làm việc hiện tại, chưa commit** (22/10/2026): `TutorDashboard.tsx` và `TutorClassList.tsx` đang ở bản "phẳng" (không thẻ viền, không chip, 3 con số). Ảnh `6-tong-quan-ban-vua-sua-anh-thay-la-day.jpg` là bản **đã commit** `5d583f7` (4 thẻ số có viền màu, chip trạng thái) nên khác mã một vài chỗ; chỗ nào khác nhau đều ghi rõ ở mục 9. Bản đặc tả này đã được đối chiếu lại từng khẳng định với mã, các bài test trong `tools/local-e2e/` và các ảnh được nêu (22/10/2026); những chỗ sai đã sửa tại chỗ.

---

## 1. Mục đích và người dùng

**Người dùng:** sinh viên gia sư, giáo viên tự do, dạy 1–20 học viên (Cô Lan: 7 lớp, 8 học viên). Dùng nhiều nhất trên điện thoại, một tay, mở vài lần mỗi ngày, mỗi lần dưới một phút.

**Màn này trả lời đúng ba câu hỏi theo thứ tự:**
1. Có gì cần tôi ra tay ngay không (báo nghỉ sát giờ, tiền vào chưa ghép, phụ huynh chưa xác nhận)?
2. Hôm nay tôi dạy lớp nào, mấy giờ; sắp tới còn gì?
3. Tháng này đã thu bao nhiêu, đang dạy mấy lớp, mấy học viên?

**Hiện nay câu trả lời bị chia làm hai màn:**
- **Hộp việc** (`/lop-cua-toi`): bố cục Outlook (danh sách 330px + khung đọc). Mỗi LOẠI việc một dòng, bấm thì khung đọc liệt kê từng việc cụ thể (tên em, lớp, số tiền, giờ) và có nút tới trang xử lý. Chỉ là hàng đợi do KiN tự sinh, "không phải email".
- **Tổng quan** (`/lop-cua-toi/tong-quan`): một cột: lời chào, 3 con số, Hôm nay, Sắp tới, Việc cần làm (tối đa 5 dòng), Các lớp đang dạy, Lối tắt.

**Việc của thiết kế này:** dựng MỘT trang chủ cho gia sư gom cả hai (mục 4), thoáng, ít dòng, ít khung, ít màu, không đổi vỏ Outlook (thanh module trái 79px / thanh dưới 60px, dải trên 48px).

**Điều kiện đặc biệt cần biết:** gia sư mới ở "chế độ gọn" (chỉ có Lịch + Học phí). Khi module Hộp việc chưa bật, `/lop-cua-toi` chuyển thẳng sang `/lop-cua-toi/lich` (mã: `page.tsx`, hàm `isTutorModuleVisible(..., "hop-viec")`). Nghĩa là gia sư mới **không thấy Hộp việc trên thanh module** trừ khi tự bật (Cài đặt → Module hiển thị). Tổng quan thì luôn mở được qua Khác → Dạy học → Tổng quan (bảng "Khác" dựng cố định, không phụ thuộc module đã bật; bài `ui-tutor-shell` kiểm "Tổng quan vẫn mở được khi Hộp việc tắt"), nhưng không phải màn đầu. Xem mục 12.

---

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)

1. **Thấy ngay có việc gấp hay không** (đếm + chữ trạng thái), rồi bấm vào để xử lý ở đúng trang (Lịch, Học phí → Đối soát, danh sách học viên của lớp, trang điểm danh của lớp).
2. **Đọc chi tiết một loại việc** (Hộp việc): ai, lớp nào, bao nhiêu tiền, giờ nào; bấm vào từng việc hoặc nút lệnh để sang trang xử lý.
3. **Xem buổi dạy hôm nay** (giờ, lớp, trạng thái), kế đến 3 buổi sắp tới.
4. **Xem số đã thu tháng này**, bấm sang Doanh thu.
5. **Vào lớp / điểm danh / xem danh sách học sinh** từ thẻ lớp.
6. Đi tắt sang Học phí, Báo cáo tháng, Kế hoạch buổi, Bài đăng tìm HS, Doanh thu, Hồ sơ gia sư.
7. Gia sư chưa có lớp: bấm "Tạo lớp đầu tiên".

**Màn này KHÔNG ghi dữ liệu.** Mọi nút/dòng đều là điều hướng (liên kết) hoặc đổi dòng đang xem. Không có nút "Đã xử lý" tại chỗ.

---

## 3. Dữ liệu hiển thị

### 3.A Tổng quan (`TutorDashboard.tsx`; số liệu từ `loadTutorDashboard` và `loadTutorSchedule`)

| Tên hiển thị | Nguồn trong mã (tệp + trường/hàm) | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề trang | `TutorDashboard.tsx`, h1 cố định | chữ tĩnh | Lớp của tôi |
| Lời chào | `src/lib/classColor.ts` `greetingForHour(hour)`, hour = giờ Việt Nam. Ranh giới: dưới 11 sáng; dưới 14 trưa; dưới 18 chiều; còn lại tối | "Chào buổi sáng / trưa / chiều / tối" | Chào buổi chiều |
| Tên gia sư | `tong-quan/page.tsx`: `prisma.user.findUnique(...).name`, thiếu thì "bạn" | nguyên tên trong DB (đã gồm "Cô") | Cô Lan |
| Thứ, ngày hôm nay | `TutorDashboard.tsx`: `WEEKDAY[dayOfWeekOfKey(todayKey)]` + `dd/mm/yyyy` từ `vnDateKeyOf(now)` | "Thứ Hai … Thứ Bảy, Chủ nhật" + ngày | Thứ Năm 22/10/2026 |
| Học viên đang học | `tutorDashboard.ts` `totalStudents`: số `userId` KHÁC NHAU của `Enrollment` có `status = "active"` thuộc lớp mình (không đếm `pending_consent`, không đếm trùng em học hai lớp) | số nguyên | 8 |
| Lớp đang dạy | `openClasses` / `classes.length`: số `Course.classStatus = "open"` trên TỔNG số lớp của gia sư (kể cả lớp đã đóng, tạm ngừng, ẩn) | `n/tổng` | 6/7 |
| Đã thu tháng này | `collectedThisMonth`: tổng `BankTransaction.appliedAmount` có `status` ∈ {matched, resolved} và `occurredAt` từ đầu tháng giờ Việt Nam (`vnMonthKey`) | `vnd()`: số nguyên, nhóm nghìn kiểu vi-VN, đuôi "đ"; là con số duy nhất tô xanh lá và bấm được | 480.000đ |
| Danh sách buổi hôm nay | `loadTutorSchedule(tutorId, hôm nay, +6 ngày).occurrences`, bỏ `status = "cancelled"`, giữ `dateKey = hôm nay` | một dòng một buổi | (xem dưới) |
| Giờ buổi | `ScheduleOccurrence.startAt`, `endAt` (ISO) → `vnHm()` = `hmOf(vnMinutesOfDay())`, 24 giờ. Mã đang chỉ vẽ giờ bắt đầu; `endAt` có sẵn | `HH:mm` (có thể `HH:mm–HH:mm`) | 19:00 (19:00–20:30) |
| Tên lớp của buổi | `ScheduleOccurrence.courseName` | chữ tự do | Toán 9 |
| Số học viên của buổi | `ScheduleOccurrence.students.length` (có sẵn, mã hiện không vẽ) | "n học viên" | 2 học viên |
| Màu nhận diện lớp | `classColor.ts` `classAccent(courseId)`: băm id ra 1 trong 5 token `--kin-th-xanh-troi`, `--kin-th-bac-ha`, `--kin-th-vang-nang`, `--kin-th-xanh-link`, `--kin-ph-hub`; cùng lớp luôn cùng màu | chấm 8px (mã đang dùng) hoặc vạch trái | chấm xanh trời |
| Trạng thái buổi | `statusText()`: nếu `endAt` < bây giờ → "Đã kết thúc"; ngược lại nếu `started` (= `startAt` ≤ bây giờ) → "Đang diễn ra"; còn lại "Sắp tới". ("Đã huỷ" có trong hàm nhưng buổi huỷ đã bị lọc, không bao giờ hiện) | chữ | Sắp tới |
| Buổi sắp tới | cùng nguồn, `dateKey` > hôm nay, hoặc hôm nay mà `startAt` > bây giờ; lấy tối đa 3 (`slice(0, 3)`). Khác ngày hôm nay thì thêm tiền tố "Thứ + dd/mm · " | tối đa 3 dòng | Thứ Sáu 23/10 · 19:00 · Toán 9 |
| Việc cần làm: nhãn | `tutorTodo.ts` `buildTodoItems(d.todo)`: 10 loại, chỉ hiện loại có `count > 0`; sắp xếp: khẩn trước, cùng nhóm thì nhiều trước, bằng nhau giữ thứ tự khai báo của tệp này: absence, bank, check, consent, reports, ungraded, reminders, makeup, unmarked, draft (khác thứ tự khai báo của Hộp việc, xem mục 9 điểm 1) | xem bảng 3.C | Khoản tiền vào cần đối soát |
| Việc cần làm: số | `TodoItem.count` | số nguyên, đứng SAU nhãn | 1 |
| Việc cần làm: khẩn? | `TodoItem.urgent`: việc khẩn có chấm và số cùng màu `--kin-tt-chu-loi`; việc không khẩn có số màu `--kin-tt-chu-cho` và chấm màu `--kin-tt-cham-cho` (chấm không cùng mã với số). Không có chữ nào đi kèm | màu | đỏ |
| Hiển thị tối đa | `MAX_TODO = 5`; nếu có hơn 5 loại thì hiện "Xem tất cả" | | |
| Các lớp: tên | `TutorClassList.tsx` `Course.name` | chữ, cho xuống dòng (`break-words`) | Toán 9 |
| Các lớp: sĩ số | `students` (số `Enrollment` active của lớp) và `Course.capacity` (có thể rỗng = không giới hạn) | `n` hoặc `n/cap`, đuôi " học viên"; nếu `capacity != null` và `students >= capacity` thêm " · đã đầy" | 2/2 học viên · đã đầy |
| Các lớp: thứ tự | `loadTutorDashboard`: `orderBy createdAt desc` (lớp tạo gần nhất trước). `TutorClassList.tsx` là component DÙNG CHUNG với trang `/lop-cua-toi/lop` (module "Lớp"): bất kỳ giới hạn số lớp nào của Trang chủ phải là tham số của component, không được làm trang `/lop-cua-toi/lop` mất lớp | | |
| Các lớp: nhóm | `Course.category` (chuỗi). Biểu mẫu tạo lớp (`/admin/khoa-hoc`) cho chọn trong `ADMIN_CATEGORIES` của `src/lib/courseData.ts`: "ĐGNL HSA" (mặc định), "ĐGNL HCM", "Tốt nghiệp THPT", "TSA Bách Khoa", "BCA", cộng mọi giá trị đã có trong DB. Đây là nhóm đề thi, KHÔNG phải tên môn | chữ, có thể dài | ĐGNL HSA |
| Các lớp: trạng thái | `tutorTodo.ts` `CLASS_STATUS_LABEL` theo `Course.classStatus`: open → "Đang nhận học viên", closed → "Đã đóng", paused → "Tạm ngừng"; thêm " · đang ẩn" khi `Course.status = false` | chữ | Đang nhận học viên |
| Lối tắt | `TutorDashboard.tsx`, 6 liên kết cố định | xem mục 5 | Học phí |

### 3.B Hộp việc (`HopViec.tsx`; API `GET /api/tutor/hop-viec` → `{ items: InboxItem[], total: number }`)

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Tên cột | `ListHead` trong `HopViec.tsx` | tiêu đề + dòng phụ cố định | Hộp việc / "Việc KiN sinh ra, không phải email" |
| Thứ tự dòng | `buildInboxItems` (`tutorInbox.ts`): khẩn trước (kể cả khi số ít hơn), cùng nhóm thì nhiều việc trước, bằng nhau giữ thứ tự khai báo `META` (absence, check, bank, consent, reminders, makeup, reports, ungraded, unmarked, draft). Mỗi LOẠI một dòng, loại có `count = 0` không hiện | | |
| Tiêu đề dòng | `InboxItem.title` = `META[kind].title(count)` (`tutorInbox.ts`) | "{n} + cụm cố định", một dòng, cắt "…" nếu dài | 2 học sinh chờ phụ huynh xác nhận |
| Giờ góc dòng | `InboxItem.when` = `inboxWhen(at, now)`: `at` là mốc của việc CŨ NHẤT trong loại đó; hôm nay → `HH:mm`, ngày khác → `dd/mm` (giờ VN) | chữ monospace | 16:38 / 23/10 |
| Dòng phụ | `InboxItem.subtitle` = "{title việc đầu} · {sub việc đầu}"; không có dòng chi tiết thì dùng câu giải thích (`hint`) | một dòng, cắt "…" | Chờ Phụ Huynh · Toán 9 · chờ phụ huynh xác nhận |
| Trạng thái | `InboxItem.status` {label, tone}: chấm + CHỮ (`KinStatus`), tone xong/cho/loi/mo | chữ + chấm 7px | Cần xử lý (đỏ) |
| In đậm | `InboxItem.urgent` → tiêu đề `font-semibold` | | |
| Tiêu đề khung đọc | `detail.heading` (= `title`) | h1 | 1 khoản tiền vào cần đối soát |
| Giải thích | `detail.meta` (= `hint` của loại việc) | một đoạn 13,3px | "Khoản tiền vào tài khoản của bạn chưa ghép được với phiếu nào. KiN không tự ghép khi chưa chắc." |
| Nút lệnh | `detail.commands` (tối đa 3 vẽ ra), `kind` primary/secondary | nút `KinButton` | Đối soát |
| Từng việc cụ thể | `detail.rows[]` {title, sub, href?}, tối đa `INBOX_DETAIL_LIMIT = 10` | tiêu đề (liên kết nếu có `href`) + dòng phụ | 250.000đ / 22/10 16:38 · khong ma |
| Phần dư | `detail.more` | "và {n} việc nữa — mở trang xử lý để xem đủ." | và 4 việc nữa — … |
| Tổng số việc | `total` của API = `inboxTotal(raw)` = `loadTutorTodoTotal` (cùng nguồn với số đỏ trên thanh module) | số | 14 |

### 3.C Mười loại việc (một nguồn cho Tổng quan lẫn Hộp việc: `loadTutorTodoCounts` trong `tutorDashboard.ts`)

Mọi truy vấn khoá theo gia sư (`ownerId`/`tutorId`). Thứ tự khai báo của Hộp việc (`META` trong `tutorInbox.ts`): absence, check, bank, consent, reminders, makeup, reports, ungraded, unmarked, draft (bảng dưới xếp theo thứ tự này). Hai hằng số của loại "unmarked" (`UNMARKED_GRACE_MIN = 60`, `UNMARKED_WINDOW_DAYS = 14` trong `classSessions.ts`) đang được mã ghi chú là "đề xuất", chưa phải giá trị đã chốt.

| Mã | Khẩn | Nhãn ở Tổng quan (`tutorTodo.ts`) | Tiêu đề ở Hộp việc | Chữ trạng thái (tone) | Điều kiện đếm (bảng, trường) | Dòng chi tiết (title / sub) | Nút lệnh |
|---|---|---|---|---|---|---|---|
| absence | có | Báo nghỉ sát giờ — bấm một nút để xử lý | {n} báo nghỉ sát giờ | Cần xử lý (loi) | `ClassAbsence.status = "pending"` | tên em / "{lớp} · buổi dd/mm hh:mm · báo trước {n} phút · "lý do"" | Xử lý ở Lịch (chính) → `/lop-cua-toi/lich` |
| check | có | Phụ huynh báo đã chuyển hơn 24 giờ, chưa thấy tiền — kiểm sao kê | {n} phiếu phụ huynh báo đã chuyển nhưng chưa thấy tiền | Cần xử lý (loi) | `TuitionInvoice.status = "parent_reported"` và `parentReportedAt` quá 24 giờ | tên em / "Phiếu {mã} · tháng M/YYYY · còn {tiền} · báo đã chuyển dd/mm hh:mm" | Mở Học phí (chính), Đối soát (phụ) |
| bank | có | Khoản tiền vào cần đối soát | {n} khoản tiền vào cần đối soát | Chờ đối soát (loi) | `BankTransaction.status = "pending"` | số tiền / "dd/mm hh:mm · nội dung chuyển khoản (cắt 80 ký tự)" | Đối soát (chính) → `/lop-cua-toi/hoc-phi?tab=doi-soat` |
| consent | có | Yêu cầu xác nhận của phụ huynh đang chờ | {n} học sinh chờ phụ huynh xác nhận | Chờ phụ huynh (cho) | `Enrollment.status = "pending_consent"` | tên em / "{lớp} · chờ phụ huynh xác nhận" | không có nút lệnh; mỗi dòng → `/admin/khoa-hoc/{id}/hoc-vien` |
| reminders | không | Tin nhắc lịch đã tới hạn, chờ bạn mở Zalo | {n} tin nhắc lịch đã tới hạn | Cần nhắc (cho) | tin nhắc của các buổi trong 3 ngày tới đã tới hạn mà chưa mở Zalo | "{tên em} — nhắc phụ huynh/học sinh" / "{lớp} · buổi dd/mm hh:mm · báo trước 24 giờ/1 giờ" | Gửi ở Lịch (chính) |
| makeup | không | Buổi bù sắp hết hạn (trong 3 ngày) | {n} buổi bù sắp hết hạn | Sắp hết hạn (cho) | `MakeupCredit.status = "active"` và hết hạn trong `MAKEUP_WARN_DAYS = 3` ngày | tên em / "{lớp} · buổi bù hết hạn dd/mm" | Mở Lịch (chính) |
| reports | không | Báo cáo cộng đồng trong lớp của bạn | {n} báo cáo trong cộng đồng lớp | Chờ xử lý (cho) | `ThreadReport.status = "pending"` của lớp mình | nội dung bài (cắt 80) / "Lý do: … · {lớp}" | Mở Kiểm duyệt (chính) |
| ungraded | không | Bài tự luận / bài nộp chưa chấm | {n} bài chưa chấm | Chờ chấm (cho) | `AssignmentSubmission.score` rỗng + `AssignmentAnswer` ESSAY chưa có điểm | tên em / "{tên bài} · nộp dd/mm hh:mm" hoặc "· câu tự luận" | không có nút lệnh; dòng → `/admin/khoa-hoc/{id}` |
| unmarked | không | Buổi đã qua giờ, chưa điểm danh xong | {n} buổi đã qua giờ, chưa điểm danh xong | Chưa điểm danh (cho) | `loadUnmarkedSessions`: nhìn lại 14 ngày (`UNMARKED_WINDOW_DAYS`), chờ 60 phút sau giờ kết thúc (`UNMARKED_GRACE_MIN`), còn em chưa có bản ghi | tên lớp / "buổi dd/mm hh:mm · thiếu m/t em: tên, tên…" | không có nút lệnh; dòng → `/admin/khoa-hoc/{id}/diem-danh?date=yyyy-mm-dd` |
| draft | không | Phiếu học phí nháp chưa gửi | {n} phiếu học phí nháp chưa gửi | Chưa gửi (mo) | `TuitionInvoice.status = "draft"` | tên em / "Phiếu nháp tháng M/YYYY · {tiền}" | Mở Học phí (chính) |

Đường dẫn khi bấm một việc ở TỔNG QUAN (`buildTodoItems`): absence, reminders, makeup → `/lop-cua-toi/lich`; bank → `/lop-cua-toi/hoc-phi?tab=doi-soat`; check, draft → `/lop-cua-toi/hoc-phi`; consent, ungraded, unmarked → `/lop-cua-toi/lop`; reports → `/lop-cua-toi/kiem-duyet`.

### 3.D Vỏ quanh màn (có trên cả hai màn)

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Nhãn vai trên thanh module | `TutorShell.tsx` `roleLabel` | chữ hoa | GIA SƯ |
| Mục thanh module | `userPreferences.ts` `TUTOR_MODULES` + "Khác" | Hộp việc, Lịch, Lớp, Bài KT, Thư viện, Học phí, Khác (chỉ hiện module đã bật; Lịch và Học phí luôn bật) | |
| Số đỏ trên "Hộp việc" | `LopCuaToiFrame.tsx`: `loadTutorTodoTotal` khi Hộp việc bật; nếu tắt thì số đỏ chuyển sang "Lịch" = báo nghỉ chờ + tin nhắc tới hạn | số, quá 99 hiện "99+"; `aria-label="{n} việc cần xử lý"` | 14 |
| Chấm đỏ ở nút "Mở thanh bên" (khi thanh bên đã thu) | `RailOpenButton.tsx`: tổng các badge | chấm + `aria-label="Mở thanh bên, có {n} việc cần xử lý"` | |
| Tên + chữ cái đầu + email | `AuthContext` (`user.name`, `user.avatar` = chữ cái đầu viết hoa, `user.email`) | | Cô Lan / C / giasu@kin.local |

---

## 4. Bố cục đề xuất

### 4.0 Nguyên tắc và cách gộp hai màn

**Một trang chủ, một nguồn dữ liệu, hai độ sâu.** Việc cần làm của Hộp việc và của Tổng quan hôm nay là CÙNG dữ liệu (cùng `loadTutorTodoCounts`) nhưng khác chữ, khác thứ tự khi bằng nhau và khác đích bấm (xem mục 9). Đề xuất:

- **Độ nông (nhìn lướt):** "Trang chủ" gồm lời chào, 3 con số, Việc cần làm (vài dòng), Hôm nay và Sắp tới, Các lớp, Lối tắt.
- **Độ sâu (xử lý):** bấm một dòng việc thì mở chi tiết (khung đọc của Hộp việc, giữ nguyên nội dung và nút lệnh ở mục 3.B, 3.C).
- Dòng việc ở Trang chủ **dùng đúng chữ của Hộp việc** ("2 học sinh chờ phụ huynh xác nhận" + chữ trạng thái), không dùng nhãn riêng của Tổng quan nữa. **Cảnh báo test:** nếu `/lop-cua-toi/tong-quan` cũng hiện chữ này thì 7 kiểm tra "việc: …" của `ui-tutor-dash` đỏ (chúng đòi "nhãn rồi số" như "Khoản tiền vào cần đối soát 1", còn chữ Hộp việc để số đứng trước và kèm chữ trạng thái), ngoài hai hành vi của `ui-tutor-shell` nêu ở Phương án A. Cần chủ dự án quyết kèm sửa test (câu 1, mục 12).
- Mọi lúc: **một nút chính**, hành động phụ là liên kết chữ, đường kẻ mảnh `--kin-vien-nhat` thay cho khung thẻ, chỉ ba mức màu: chữ (`--kin-chu-*`), xanh lá cho tiền đã thu, đỏ/cam cho việc.
- Không thêm màu ngoài token `--kin-*`. Không thêm thư viện.

**Phương án A (đề xuất, mục 4.1 và 4.2): Trang chủ gộp tại `/lop-cua-toi`.** Điện thoại: một cột cuộn, "Việc cần làm" nằm ngay sau 3 con số; bấm dòng việc → màn chi tiết đẩy sang (có nút "← Quay lại", đúng như Hộp việc hôm nay). Máy tính: giữ khung Outlook (thanh module 79px, danh sách 330px, khung đọc), nhưng danh sách bên trái vẫn là Hộp việc nguyên vẹn, còn khung đọc bên phải **mặc định hiện Trang chủ** (chưa chọn dòng nào); chọn một dòng thì khung đọc đổi sang chi tiết việc kèm nút "← Trang chủ" (nhìn thấy cả trên máy tính), phím Esc quay về. `/lop-cua-toi/tong-quan` giữ lại làm đường tắt vào cùng nội dung Trang chủ (vì đường này đang có trong bảng "Khác", trong bài test và trong danh sách đường đã giữ chỗ). **Phương án A đổi một hành vi đang được bài test khoá** (mặc định chọn sẵn dòng đầu ở máy tính): xem mục 7 và câu hỏi 1 ở mục 12.

**Phương án B (nhẹ, nếu chủ dự án không đổi màn mặc định): hai route như hôm nay, nhưng cùng một ngôn ngữ hình thức.** Mục 4.3.

### 4.1 Điện thoại 390px (Phương án A)

Khung: dải trên 48px (logo KiN + menu tài khoản), thanh module dưới 60px (cố định, không thiết kế lại), nội dung giữa cuộn dọc. Lề trái và phải 20px. Khoảng cách giữa hai vùng 32px. Chữ nhỏ nhất 11,1px chỉ cho nhãn; chữ thân 13,3px; mọi vùng chạm cao ít nhất 44px (dòng việc, dòng buổi 50px).

Thứ tự vùng từ trên xuống (theo độ gấp: việc cần ra tay, buổi hôm nay, con số, lớp, lối tắt):

| # | Vùng | Nội dung chính xác | Giới hạn |
|---|---|---|---|
| 1 | **Lời chào** | h1 "Lớp của tôi" nhỏ (nhãn 13,3px, màu `--kin-chu-mo`) rồi dòng chào 19,2px đậm "Chào buổi chiều, Cô Lan", dòng ngày 13,3px "Thứ Năm 22/10/2026" | tối đa 3 dòng; không ảnh, không biểu tượng |
| 2 | **Ba con số** | một hàng ba cột bằng nhau: "Học viên đang học" 8, "Lớp đang dạy" 6/7, "Đã thu tháng này" 480.000đ. Số 19,2px đậm, tabular; nhãn 11,1px phía dưới | không khung; số tiền màu `--kin-tt-chu-xong`; chỉ số tiền bấm được (cao 44px). **Rủi ro tràn ngang:** ở 390px mỗi cột chỉ rộng khoảng 106px, mà tiền thu tháng của gia sư có thể tới hàng chục triệu ("10.000.000đ" 11 ký tự, tính thô cỡ 19,2px rộng khoảng 107–115px). Không cắt "…", không thu nhỏ chữ: cho cột tiền rộng hơn hai cột kia (ví dụ tỉ lệ 1 : 1 : 1,4) hoặc đặt số tiền xuống hàng riêng khi quá dài. Test hiện chỉ dùng 480.000đ nên không bắt được lỗi này |
| 3 | **Việc cần làm** | h2 "Việc cần làm" (13,3px, màu mờ) + số tổng bên phải; tối đa **3 dòng** việc, mỗi dòng: tiêu đề của Hộp việc (cho phép xuống 2 dòng, KHÔNG cắt "…") + dòng chữ trạng thái (chấm + chữ như "Chờ phụ huynh", "Cần xử lý"); dòng khẩn chữ đậm. Dưới cùng liên kết "Xem tất cả" kèm số ("Xem tất cả 14 việc") khi còn hơn 3 | không thẻ; chỉ đường kẻ mảnh; bấm dòng mở chi tiết (màn đẩy) |
| 4 | **Hôm nay** | h2 "Hôm nay" + liên kết "Xem cả tuần" bên phải. Mỗi buổi một dòng 50px: chấm màu lớp, giờ "19:00–20:30" đậm tabular, tên lớp + "2 học viên", chữ trạng thái bên phải. Dưới, nhãn nhỏ "Sắp tới" + tối đa 3 buổi (có tiền tố "Thứ Sáu 23/10 · "), **không lặp** buổi đã nằm trong "Hôm nay" | không có buổi hôm nay: một câu "Hôm nay không có buổi dạy nào." (và nếu 7 ngày tới cũng trống: câu thứ hai nói thẳng) |
| 5 | **Các lớp đang dạy** | h2 "Các lớp đang dạy". Mỗi lớp 2 dòng: dòng 1 chấm màu + tên lớp (đậm vừa); dòng 2 "2/2 học viên · đã đầy · ĐGNL HSA · Đang nhận học viên" (11,1px–13,3px, màu mờ). Dưới tên một dòng liên kết "Mở lớp  Điểm danh  Danh sách HS" (cao 44px mỗi liên kết, khoảng cách 20px) | hiện tối đa 4 lớp đầu (theo thứ tự mã: tạo gần nhất trước; có thể ưu tiên lớp có buổi hôm nay, xem câu 8); có hơn 4 thì liên kết "Xem tất cả 7 lớp" → `/lop-cua-toi/lop`. Giới hạn 4 chỉ áp cho Trang chủ (tham số của `TutorClassList`, component dùng chung với trang `/lop-cua-toi/lop` phải hiện đủ lớp). Dòng 2 có nhóm lớp ("ĐGNL HSA", "TSA Bách Khoa"…) nên dài hơn ví dụ: mặc định ẩn nhóm lớp ở điện thoại (câu 14); nếu giữ thì cho xuống dòng, không cắt "…". Lớp rỗng: khối "Bạn chưa mở lớp nào" + một nút chính "Tạo lớp đầu tiên" (thẻ liên kết `<a>`, không phải `<button>`: test tìm theo role link) |
| 6 | **Lối tắt** | một hàng chữ nhỏ 13,3px màu mờ, xuống dòng khi hết chỗ: Học phí, Báo cáo tháng, Bài đăng tìm HS, Kế hoạch buổi, Doanh thu, Hồ sơ gia sư | đáy trang, trên thanh module (chừa đủ 60px + lề) |

Ước tính chiều cao (tính thô của người kiểm chứng, nhà thiết kế phải đo lại): vùng nhìn thấy trên màn 844px là 844 − 48 (dải trên) − 60 (thanh dưới) = 736px. Vùng 1–3 kết thúc quanh y = 460–520px (dòng việc xuống 2 dòng thì gần 520); vùng 4 "Hôm nay" bắt đầu trong màn đầu, còn ba dòng "Sắp tới" kết thúc quanh y = 720–780px, tức có thể chạm nếp cuộn. Bản nháp trước ghi 590px và khẳng định cả hai vùng nằm trọn trong màn đầu; con số đó không có căn cứ. Nếu "Sắp tới" không vừa thì giảm còn 2 dòng, không thu nhỏ vùng chạm.

**Màn chi tiết đẩy sang (bấm một dòng ở vùng 3, hoặc "Xem tất cả"):** hai bước. (a) "Xem tất cả": danh sách đủ các loại việc, mỗi dòng một loại, đúng như danh sách Hộp việc hôm nay (tiêu đề, giờ góc dòng, dòng phụ, chữ trạng thái). (b) Bấm một dòng: khung đọc: nút "← Quay lại" (cao 44px) trên cùng, h1 là tiêu đề loại việc, dòng giải thích, tối đa 3 nút lệnh, rồi danh sách từng việc (mỗi việc: tiêu đề + dòng phụ, tiêu đề là liên kết nếu có đích), cuối là "và {n} việc nữa — mở trang xử lý để xem đủ." Khi thiết kế: nút lệnh chính một nút đặc màu `--kin-nhan-nen`; nút phụ viền.

### 4.2 Máy tính 1280px (Phương án A)

Khung Outlook không đổi: thanh module 79px (thu được về 0px, hoặc mở rộng 220px), dải trên 48px, danh sách 330px, khung đọc phần còn lại (871px khi thanh mở). **Hai khung tự cuộn, cả trang không cuộn.**

- **Cột trái, 330px: Hộp việc nguyên vẹn** (đầu cột "Hộp việc" + "Việc KiN sinh ra, không phải email"; mỗi dòng một loại việc 3 tầng: tiêu đề + giờ, dòng phụ, chữ trạng thái; dòng đang chọn có nền `--kin-nen-dang-chon` và vạch trái 3px `--kin-nhan-diem`). Mặc định **chưa chọn dòng nào**.
- **Cột phải: Trang chủ**, một cột chữ rộng tối đa 640px, lề 32px, căn trái (không căng hết 871px). Từ trên xuống: lời chào (như điện thoại) → ba con số cùng một hàng, số 27,6px (`--kin-co-h2`), nhãn 11,1px, ngăn nhau bằng đường kẻ đứng mảnh → "Hôm nay" (và "Sắp tới", cùng quy tắc không lặp) → "Các lớp đang dạy" (hiện đủ, mỗi lớp một dòng: chấm + tên, sĩ số và trạng thái cùng dòng phía phải, ba liên kết "Mở lớp", "Điểm danh", "Danh sách HS" hiện rõ ở cuối dòng) → Lối tắt. **Không có "Việc cần làm" ở cột phải**: nó đã nằm ở cột trái, tránh hiện hai lần.
- **Chọn một dòng ở cột trái:** cột phải đổi sang chi tiết việc (đầu: "← Trang chủ", h1, giải thích, tối đa 3 nút lệnh, danh sách từng việc). Phím ↑ ↓ Home End di chuyển giữa dòng; Esc hoặc "← Trang chủ" quay về Trang chủ. Hiệu ứng: mờ dần vào 120ms (đã có trong `bo-cuc-outlook.md` mục 9), tôn trọng `prefers-reduced-motion`.
- Khi thanh module thu về 0px, khung phải rộng thêm nhưng chữ vẫn giữ tối đa 640px (không kéo giãn).
- **Điểm gãy (mã dùng breakpoint `md` = 768px của Tailwind, không phải container query):** từ 768px bố cục hai khung đã bật. Ở 768px khung phải chỉ rộng 768 − 79 − 330 = 359px (hoặc 438px khi thu thanh), không đủ cho ba số 27,6px thành ba cột ("480.000đ" cỡ này rộng khoảng 115px). Quy tắc: khung phải hẹp dưới khoảng 520px thì ba số dùng cỡ 19,2px như điện thoại, và cột tiền rộng hơn (hoặc xếp hai hàng); chỉ khi đủ rộng mới dùng 27,6px. Nhà thiết kế cần ra khung ở 768px và 1024px, không chỉ 390px và 1280px.
- Giữ `aria-label="Chi tiết"` cho khung phải kể cả khi nó đang hiện Trang chủ (bài kiểm vị trí x = 79 + 330 tìm `section[aria-label="Chi tiết"]`), và chỉ có MỘT `h1` trên trang (bài shell đọc `getByRole("heading", {level:1})` như một phần tử duy nhất; hai `h1` làm bài lỗi vì trùng nhiều phần tử).

### 4.3 Phương án B (nhẹ): hai route, một hình thức

Dùng khi chủ dự án giữ Hộp việc làm màn mặc định đúng như hôm nay (và test không đổi).
- `/lop-cua-toi` (Hộp việc): bố cục Outlook không đổi; thêm vào đầu cột trái một liên kết "Tổng quan" (đi `/lop-cua-toi/tong-quan`) và, trên điện thoại, một dòng 3 con số trên đầu danh sách (Học viên đang học, Lớp đang dạy, Đã thu tháng này). Ba số này đã có ở `loadTutorDashboard`; chỉ cần đưa chúng vào dữ liệu của trang (API `/api/tutor/hop-viec` hiện chỉ trả `items` và `total`), không tính lại và không đổi cách tính. Dòng số này không được làm đáy danh sách vượt 740px ở màn 800 (bài shell kiểm).
- `/lop-cua-toi/tong-quan` (Tổng quan): đúng 6 vùng ở mục 4.1, nhưng vùng 3 "Việc cần làm" tối đa **5 dòng** dùng chữ và chữ trạng thái của Hộp việc, mỗi dòng bấm sang Hộp việc đúng loại đó, và liên kết "Xem tất cả" tới `/lop-cua-toi` (chỉ hiện khi Hộp việc đã bật).
- Cả hai màn: cùng bộ chữ trạng thái, cùng thứ tự khi bằng nhau (sửa lệch ở mục 9).

### 4.4 Token màu và cỡ chữ cho màn này

- Nền trang `--kin-nen-trang`; thanh module `--kin-nen-bang`; dải trên 48px `--kin-nen-trang` với viền dưới `--kin-vien-thuong` (đúng như `TutorShell.tsx` hiện làm; vỏ không thiết kế lại); đường kẻ `--kin-vien-nhat` (trong danh sách) và `--kin-vien-thuong` (viền khung).
- Chữ: `--kin-chu-chinh` (tiêu đề, số), `--kin-chu-phu` (tên lớp phụ), `--kin-chu-mo` (nhãn, lối tắt).
- Tiền đã thu: chữ `--kin-tt-chu-xong`. Việc khẩn: chữ và chấm `--kin-tt-chu-loi`. Việc chờ: chữ `--kin-tt-chu-cho`, chấm `--kin-tt-cham-cho`. Trung tính: chấm `--kin-tt-cham-trung-tinh`, chữ `--kin-chu-mo`. (Hai bộ mã: chữ cần 4,5:1, chấm chỉ cần 3:1; không dùng chung một mã.)
- Liên kết: `--kin-nhan-link`. Nút chính: nền `--kin-nhan-nen`, chữ `--kin-nhan-chu-tren-nen`. Vòng focus: `--kin-nhan-link`, dày 2px.
- Màu lớp: 5 token `--kin-th-xanh-troi`, `--kin-th-bac-ha`, `--kin-th-vang-nang`, `--kin-th-xanh-link`, `--kin-ph-hub` (chỉ trang trí; tên lớp luôn có chữ).
- Cỡ chữ: `--kin-co-caption` 11,1px, `--kin-co-small` 13,3px, `--kin-co-body` 16px, `--kin-co-h4` 19,2px, `--kin-co-h2` 27,6px. Tiêu đề dùng Be Vietnam Pro (lớp `kin-chu-tieu-de`), chữ thân Inter. Số luôn `tabular-nums`.
- Bo góc: `--kin-bo-sm` 8px, `--kin-bo-the` 14px (khung nổi); vùng chạm tối thiểu `--kin-cham-toi-thieu` 44px, dòng danh sách `--kin-cham-dong` 50px.

---

## 5. Hành động

Màn không ghi dữ liệu; "Gọi API" bên dưới chỉ có một chỗ (đọc Hộp việc). Mọi nút là điều hướng. **Về từ "nút":** "Tạo lớp đầu tiên" và các nút lệnh của khung đọc (Xử lý ở Lịch, Mở Học phí, Đối soát, Gửi ở Lịch, Mở Lịch, Mở Kiểm duyệt) trong mã là thẻ liên kết `<a>`/`<Link>` dáng nút (`kinButtonClass`), role là link; bài test tìm chúng bằng `getByRole("link", …)`. Chỉ "Thử lại", "← Quay lại", "Khác" và "Mở/Thu gọn thanh bên" là `<button>` thật. Đừng đổi kiểu phần tử khi dựng.

| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| Xem cả tuần | liên kết ở đầu "Hôm nay" | `/lop-cua-toi/lich` | chỉ gia sư |
| (cả dòng buổi học) | liên kết toàn dòng | `/lop-cua-toi/lich` (chưa nhảy tới đúng buổi/ngày) | |
| (số "Đã thu tháng này") | liên kết toàn ô | `/lop-cua-toi/doanh-thu` | số tiền: chỉ hiện cho chính gia sư |
| (cả dòng việc ở Tổng quan) | liên kết theo từng loại việc | xem cuối bảng 3.C | |
| Xem tất cả | liên kết, chỉ hiện khi có hơn 5 loại việc (Tổng quan hôm nay) | `/lop-cua-toi` | Khi Hộp việc chưa bật, `/lop-cua-toi` lại chuyển sang Lịch (xem mục 9) |
| Mở lớp (cũng là tên lớp) | liên kết | `/lop-cua-toi/{courseId}` | |
| Điểm danh | liên kết | `/admin/khoa-hoc/{courseId}/diem-danh` | trang quản lớp dùng chung, chạy trong vỏ gia sư |
| Danh sách HS | liên kết | `/admin/khoa-hoc/{courseId}/hoc-vien` | |
| Tạo lớp đầu tiên | nút chính khi chưa có lớp | `/admin/khoa-hoc?tao=1` (mở sẵn form "Tạo khoá học mới") | |
| Học phí (lối tắt) | liên kết | `/lop-cua-toi/hoc-phi` | |
| Báo cáo tháng (lối tắt) | liên kết | `/lop-cua-toi/bao-cao-thang` | |
| Bài đăng tìm HS (lối tắt) | liên kết | `/lop-cua-toi/bai-dang` | |
| Kế hoạch buổi (lối tắt) | liên kết | `/lop-cua-toi/ke-hoach-buoi` | |
| Doanh thu (lối tắt) | liên kết | `/lop-cua-toi/doanh-thu` | |
| Hồ sơ gia sư (lối tắt) | liên kết | `/lop-cua-toi/ho-so` | |
| (một dòng loại việc ở Hộp việc) | chọn dòng: đổi khung đọc, trên điện thoại hiện khung đọc | không rời trang; bàn phím: Enter hoặc Space chọn; ↑ ↓ Home End di chuyển | `role="option"`, `aria-selected` |
| ← Quay lại | chỉ điện thoại: về danh sách | không rời trang | vùng chạm 44px |
| Xử lý ở Lịch | nút chính của loại "báo nghỉ sát giờ" | `/lop-cua-toi/lich` | việc khẩn |
| Mở Học phí | nút chính của "check" và "draft" | `/lop-cua-toi/hoc-phi` | tiền: chỉ xem, không sửa ở đây |
| Đối soát | nút phụ của "check", nút chính của "bank" | `/lop-cua-toi/hoc-phi?tab=doi-soat` | KiN không tự ghép khi chưa chắc; gia sư tự gạch ở Học phí |
| Gửi ở Lịch | nút chính của "reminders" | `/lop-cua-toi/lich` | KiN không gửi thay; gia sư tự mở Zalo |
| Mở Lịch | nút chính của "makeup" | `/lop-cua-toi/lich` | |
| Mở Kiểm duyệt | nút chính của "reports" | `/lop-cua-toi/kiem-duyet` | |
| (tiêu đề từng việc trong khung đọc) | liên kết nếu có `href` | `/lop-cua-toi/lich`, `/lop-cua-toi/hoc-phi`, `/lop-cua-toi/hoc-phi?tab=doi-soat`, `/lop-cua-toi/kiem-duyet`, `/admin/khoa-hoc/{id}`, `/admin/khoa-hoc/{id}/hoc-vien`, `/admin/khoa-hoc/{id}/diem-danh?date=yyyy-mm-dd` | mọi đích đều là đường dẫn trong ứng dụng (bài test kiểm) |
| Thử lại | trong dải báo lỗi của Hộp việc: tải lại | `GET /api/tutor/hop-viec` (`cache: "no-store"`, `credentials: "same-origin"`) | cần phiên gia sư: chưa đăng nhập 401, không phải gia sư 403. Hộp việc còn tự tải lại mỗi khi cửa sổ lấy lại tiêu điểm (`focus`) |
| Mở thanh bên / Thu gọn thanh bên | thu hoặc mở thanh module (phím `[`) | không rời trang | nhớ theo tài khoản; thanh thu thì chấm đỏ chuyển lên nút "Mở thanh bên" |
| Khác | mở bảng "Các mục khác" | Dạy học: Tổng quan, Kế hoạch buổi, Báo cáo tháng, Kiểm duyệt cộng đồng; Tiền: Doanh thu; Giới thiệu: Hồ sơ gia sư, Bài đăng tìm học sinh; Tài khoản: Cài đặt (và "Thêm module" khi còn module tắt); Đăng xuất | đóng bằng Esc, bấm ra ngoài, chọn một mục, hoặc bấm "Khác" lần nữa |
| Logo KiN (`aria-label="KiN — Hộp việc của gia sư"`) | liên kết | `/lop-cua-toi` | |
| Menu tài khoản (`aria-label="Tài khoản của {tên}"`) | mở menu: Cài đặt, Hồ sơ gia sư, Đăng xuất | `/lop-cua-toi/cai-dat`, `/lop-cua-toi/ho-so`, đăng xuất | |

---

## 6. Trạng thái

### Hộp việc (`HopViec.tsx`)

| Trạng thái | Hiện gì (chữ chính xác) |
|---|---|
| Đang tải lần đầu | khung xương 4 dòng đúng chiều cao dòng thật (`ListSkeleton`: `aria-busy="true"`, `aria-label="Đang tải"`, không vòng xoay); khung đọc hiện tiêu đề "Đang tải…" |
| Bình thường | đầu cột "Hộp việc" / "Việc KiN sinh ra, không phải email"; các dòng; trên máy tính dòng đầu đang chọn sẵn (hôm nay) |
| Rỗng | cột trái: "Không có việc nào đang chờ bạn."; khung đọc: tiêu đề "Hộp việc trống" + "Báo nghỉ sát giờ, tiền cần đối soát, bài chưa chấm và các việc cần bạn ra tay sẽ hiện ở đây."; không có số đỏ |
| Lỗi khi tải lại (đã có danh sách) | dải `role="alert"` trên đầu cột: chấm đỏ + "Không tải được Hộp việc." + nút "Thử lại"; **giữ nguyên danh sách cũ** bên dưới. "Thử lại" thành công thì dải biến mất |
| Lỗi ngay lần tải đầu tiên (chưa có dữ liệu) | mã hiện dải lỗi như trên, nhưng cột trái trống và khung đọc vẫn ghi "Đang tải…" (xem mục 9). Thiết kế cần định nghĩa trạng thái này rõ ràng |
| Điện thoại | luôn là danh sách trước; chọn dòng thì hiện khung đọc và ẩn danh sách; "← Quay lại" |
| Hộp việc chưa bật (chế độ gọn) | không hiện màn này; `/lop-cua-toi` chuyển sang `/lop-cua-toi/lich`; việc hiện thành số đỏ trên "Lịch" |
| Chưa đăng nhập / không phải gia sư | API 401 / 403; trang: học sinh và quản trị xem danh sách lớp của họ, chưa đăng nhập về `/dang-nhap?redirect=/lop-cua-toi` |

### Tổng quan (`TutorDashboard.tsx`)

| Trạng thái | Hiện gì (chữ chính xác) |
|---|---|
| Đang tải | `loading.tsx` (cả nhóm `(tutor)`): khung xương `aria-busy="true"`, `aria-label="Đang tải"`: một thanh tiêu đề, 3 ô số, một tiêu đề nhỏ, 2 dòng, 2 thẻ lớn (dạng thẻ, không khớp bố cục phẳng: xem mục 9). Máy chủ dựng sẵn, không có vòng xoay |
| Bình thường | lời chào, 3 số, Hôm nay (+ Sắp tới), Việc cần làm, Các lớp, Lối tắt |
| Hôm nay không có buổi | "Hôm nay không có buổi dạy nào." (mã bản phẳng; bản đã commit còn câu thứ hai "7 ngày tới cũng chưa có buổi nào. Thêm khung giờ học ở trang quản khoá của lớp." khi 7 ngày tới cũng trống) |
| Không có việc | "Hiện không có việc nào cần xử lý." |
| Chưa có lớp nào | "Bạn chưa mở lớp nào" + "Tạo lớp đầu tiên, rồi gửi mã mời cho học viên để vào lớp." + nút "Tạo lớp đầu tiên"; ba số: 0, 0/0, 0đ |
| Lỗi | không có trạng thái lỗi riêng; lỗi máy chủ rơi vào trang lỗi chung `src/app/error.tsx` ("Có lỗi xảy ra", "Trang gặp sự cố không mong muốn. Thử tải lại hoặc quay về trang chủ.", nút "Thử lại", liên kết "Về trang chủ"). Trang này không có vỏ gia sư (theo cách Next.js hoạt động, chưa kiểm bằng ảnh) |
| Lớp đầy / đã đóng / tạm ngừng / ẩn | thêm chữ: " · đã đầy", "Đã đóng", "Tạm ngừng", " · đang ẩn" |
| Buổi đã kết thúc / đang diễn ra | chữ "Đã kết thúc" / "Đang diễn ra" (buổi huỷ không hiện; buổi dời hiện như buổi thường) |
| Quyền | chưa đăng nhập → `/dang-nhap?redirect=/lop-cua-toi/tong-quan`; học sinh hoặc quản trị → `/lop-cua-toi` |

**Trạng thái mới cần thiết kế nếu theo Phương án A:** Trang chủ ở trạng thái "gia sư mới" (chưa có lớp, chưa có việc): chỉ lời chào, ba số 0, và khối "Bạn chưa mở lớp nào" kèm nút "Tạo lớp đầu tiên"; không hiện vùng Việc cần làm trống rỗng (dùng một câu, không khung).

---

## 7. Chữ bắt buộc giữ nguyên

Những chuỗi dưới đây đang được bài test giao diện kiểm bằng cách tìm chữ hoặc vai (role). Đổi chữ là test đỏ.

**`ui-tutor-dash.ts`** (trang `/lop-cua-toi/tong-quan`, 1280px và 390px)
- Heading có chữ "Lớp của tôi".
- Cấu trúc danh sách định nghĩa: phần tử `dt` chứa đúng các nhãn "Học viên đang học", "Lớp đang dạy", "Đã thu tháng này" (tìm theo chữ chứa nhãn), và `dd` là anh em liền kề ngay sau mỗi `dt` trong cùng phần tử cha (bài dùng `following-sibling::dd[1]`). Giá trị mong đợi: "3", "1/2", số tiền có chuỗi `toLocaleString("vi-VN")` (ví dụ "480.000"). `dd` đầu tiên của trang (`locator("dd").first()`) của gia sư không có lớp phải là "0" (nghĩa là ô đầu tiên vẫn là "Học viên đang học", và không phần tử `dd` nào khác được đứng trước nó).
- Phần tử `#h-viec` (id `h-viec`) và **cha trực tiếp của nó phải chứa cả tiêu đề lẫn danh sách việc**: test đọc toàn bộ chữ của cha `#h-viec`. Trong cây làm việc hiện tại `Heading` bọc `<h2>` trong một `<div>` riêng (cùng liên kết "Xem tất cả") nên cha chỉ chứa tiêu đề; các kiểm tra dưới đây sẽ đỏ cho tới khi sửa (mục 9, điểm 6). Bản đã commit `5d583f7` (`<section>` chứa `<h2 id="h-viec">` và danh sách) thì qua.
- Trong vùng đó, mỗi việc là "nhãn rồi số" liền kề: "Khoản tiền vào cần đối soát 1", "Yêu cầu xác nhận của phụ huynh đang chờ 1", "Báo cáo cộng đồng trong lớp của bạn 2", "…chưa chấm 2" (nhãn "Bài tự luận / bài nộp chưa chấm"), "Phiếu học phí nháp chưa gửi 1"; việc khẩn ("Khoản tiền vào cần đối soát") đứng trước "Báo cáo cộng đồng". Đưa số lên trước nhãn hoặc đổi sang chữ khác sẽ hỏng regex.
- Các chữ: "2/2", "đã đầy", "Lý 9", "Đã đóng"; hai liên kết "Điểm danh" (một mỗi lớp, tổng 2 với 2 lớp; đừng đổi tên, đừng gộp vào menu). Bài đếm `getByRole("link", {name: "Điểm danh"})` mà không có `exact`, tức khớp chuỗi con không phân biệt hoa thường: một liên kết khác có chữ "điểm danh" trong tên (ví dụ dòng việc "4 buổi đã qua giờ, chưa điểm danh xong" nếu nằm cùng trang) làm số đếm lệch khỏi 2. Dữ liệu bài không sinh việc "unmarked" nên chưa lộ, nhưng đừng đặt chữ đó vào liên kết của Trang chủ nếu trang cùng chứa các liên kết lớp.
- Điều hướng (`aria-label="Lối tắt"`) chứa liên kết "Học phí" (đúng chữ, `exact`) đi tới `/lop-cua-toi/hoc-phi`.
- Trạng thái rỗng: "Bạn chưa mở lớp nào", liên kết (role link) "Tạo lớp đầu tiên" (đi `/admin/khoa-hoc`, mã dùng `?tao=1`; bài chỉ kiểm đường dẫn là `/admin/khoa-hoc` và thấy heading "Tạo khoá học mới"), "Hiện không có việc nào cần xử lý.".
- 390px: `/lop-cua-toi` và `/lop-cua-toi/tong-quan` không tràn ngang. Ngưỡng khác nhau theo bài: `ui-tutor-dash` cho phép `scrollWidth ≤ innerWidth + 1`, còn `ui-tutor-shell` (ở `/lop-cua-toi`) đòi `scrollWidth ≤ innerWidth` không dung sai. Thiết kế theo ngưỡng chặt.
- Không lỗi console / pageerror.

**`ui-tutor-shell.ts`** (vỏ, Hộp việc)
- Thanh `nav` tên "Module của gia sư"; chữ "GIA SƯ"; mục theo thứ tự "Hộp việc", "Lịch", "Lớp", "Bài KT", "Thư viện", "Học phí" (liên kết) và "Khác" (nút, `aria-haspopup="dialog"`, `aria-expanded`); mục đang ở có `aria-current="page"`, chỉ một mục; nhãn không bị cắt, cỡ chữ nhãn ≥ 11,1px; thanh rộng 79px.
- Số đỏ: lớp `.kin-badge-dem`, bằng `total` của API, `aria-label` đúng "{n} việc cần xử lý"; chỉ "Hộp việc" có số.
- Dải trên: liên kết tên "KiN — Hộp việc của gia sư" (`href="/lop-cua-toi"`) và tên "Cô Lan".
- "Bài KT" → `/admin/thi-thu`, "Thư viện" → `/thu-vien`.
- Hộp việc: `listbox` tên "Hộp việc"; mỗi dòng `role="option"` có `aria-selected`; một dòng `tabindex="0"` (roving); dòng đầu đang chọn sẵn; heading cấp 1 hiện ở khung đọc ("2 khoản tiền vào cần đối soát", "học sinh chờ phụ huynh xác nhận"); chữ trạng thái nằm trong phần tử `[data-kin-status]` ("Chờ đối soát", "Chờ phụ huynh", "Chờ xử lý"); danh sách `list` tên "Các việc cụ thể"; khung đọc có "500.000đ" và nội dung chuyển khoản "khong ma"; liên kết (role link, lấy `.first()`) tên đúng "Đối soát" có `href` `/lop-cua-toi/hoc-phi?tab=doi-soat`; liên kết tên em ("Em Chờ") → `/admin/khoa-hoc/{id}/hoc-vien`; liên kết "Mở Kiểm duyệt" → `/lop-cua-toi/kiem-duyet`; phím ↓ và Home di chuyển chọn dòng và tiêu điểm. Dòng đầu là "2 khoản tiền vào cần đối soát" nghĩa là dữ liệu bài có 3 loại việc (đối soát 2, chờ phụ huynh 1, báo cáo 1), số đỏ = 4.
- `getByRole("heading", {level: 1})` được dùng như MỘT phần tử duy nhất để đọc chữ; ở `/lop-cua-toi` chỉ được có một `h1` mỗi lúc (khung đọc). Điện thoại: lúc chưa chọn dòng không có `h1` nào.
- Bố cục: hai vùng có tên `aria-label` "Danh sách" và "Chi tiết"; danh sách rộng đúng 330px, khung đọc bắt đầu ở x = 79 + 330; **trang không cuộn dọc** (hai khung tự cuộn).
- Bảng "Khác": `dialog` tên "Các mục khác"; liên kết (đúng chữ): "Tổng quan" → `/lop-cua-toi/tong-quan`, "Kế hoạch buổi", "Báo cáo tháng", "Kiểm duyệt cộng đồng", "Doanh thu", "Hồ sơ gia sư", "Bài đăng tìm học sinh", "Cài đặt", "Thêm module" (→ `/lop-cua-toi/cai-dat#module`, chỉ khi còn module tắt), nút "Đăng xuất", tên người dùng; Esc / bấm ra ngoài / bấm lại "Khác" đều đóng.
- Sau khi chọn "Tổng quan": h1 "Lớp của tôi", "Khác" sáng, "Hộp việc" hết sáng; heading "Việc cần làm" còn.
- Trạng thái: khung xương `[aria-busy=true]` khi tải, không `.animate-spin`; dải `role="alert"` có "Không tải được Hộp việc." và nút "Thử lại"; danh sách cũ (3 dòng) vẫn còn dưới dải; rỗng: "Không có việc nào đang chờ bạn." và "Hộp việc trống"; không có số đỏ khi không việc.
- Chế độ gọn: `/lop-cua-toi` → `/lop-cua-toi/lich`; thanh chỉ 2 liên kết + Khác.
- Điện thoại 390px: thanh dưới cao 60px dính đáy; đúng MỘT thanh module nhìn thấy; chưa chọn dòng thì **không có heading cấp 1** (`getByRole("heading", {level:1}).count() === 0`); 7 nút (6 module + Khác) mỗi nút cao và rộng ≥ 44px; không tràn ngang; đáy danh sách ≤ 740px (màn 800); chọn dòng → h1 hiện, danh sách ẩn; nút tên "← Quay lại" (khớp `/Quay lại/`) trở về; bảng "Khác" nằm trọn trong màn, mọi mục cao ≥ 44px.
- Quyền: học sinh vào `/lop-cua-toi/tong-quan` → về `/lop-cua-toi`; chưa đăng nhập → `/dang-nhap?redirect=…` đúng trang đang vào.

**`ui-journey-new-tutor.ts`** (hành trình gia sư mới, giai đoạn G5)
- Sau đăng nhập gia sư rơi vào `/lop-cua-toi/lich` (chế độ gọn); thanh "Module của gia sư" có mặt.
- Qua nút "Khác" → bảng "Các mục khác" → liên kết "Cài đặt" (đúng chữ) → bật công tắc `#m-hop-viec` → thấy liên kết "Hộp việc" trên thanh → bấm tới đúng `/lop-cua-toi`.
- Trang `/lop-cua-toi` không chứa "Application error", "Lỗi" hay "Không tìm thấy" trong 600 ký tự đầu (regex không phân biệt hoa thường, nên cả chữ "lỗi" thường cũng làm bài đỏ: tránh dùng chữ này trong phần đầu trang, kể cả dải báo lỗi tải), và có nội dung chữ trên 200 ký tự sau khi bỏ hết khoảng trắng (không được trắng).
- Chặng đệm `/lop-cua-toi` → `/lop-cua-toi/lich` khi Hộp việc tắt được coi là chuyển hướng có chủ đích.

**Các bài khác bám vào màn này**
- `t-tutor-inbox-lib.ts`: tiêu đề "{n} báo nghỉ sát giờ", "{n} khoản tiền vào cần đối soát", "{n} buổi đã qua giờ, chưa điểm danh xong"; nhãn trạng thái "Cần xử lý", "Chờ đối soát", "Chưa điểm danh" (tone cho); `meta` của unmarked chứa "Học phí không đổi"; thứ tự khẩn trước (absence 4 đứng trước bank 1 dù hai đều khẩn: nhiều trước), cùng nhóm thường thì nhiều trước (draft 9, ungraded 5, reports 3); `INBOX_KINDS` đúng 10; hàm `inboxWhen`, `inboxDateTime` (`14/10 10:30`), `inboxVnd`; khung đọc có cùng tiêu đề với dòng (`detail.heading === title`); mọi `href` của nút lệnh bắt đầu `/lop-cua-toi/`; loại nào có việc cũng phải có lối xử lý (có nút lệnh hoặc có dòng chi tiết mang `href`); `detail.more = count − số dòng` và tối đa 10 dòng (`INBOX_DETAIL_LIMIT`).
- `t-tutor-inbox.ts`: tiêu đề "2 khoản tiền vào cần đối soát", "1 phiếu học phí nháp chưa gửi", "1 học sinh chờ phụ huynh xác nhận", "1 báo cáo trong cộng đồng lớp", "1 bài chưa chấm", "2 buổi đã qua giờ, chưa điểm danh xong"; `Cache-Control: no-store`; 401 / 403; đích `/admin/khoa-hoc/{id}/hoc-vien` và `/admin/khoa-hoc/{id}/diem-danh?date=…`; mọi `href` bắt đầu bằng "/".
- `t-todo-lib.ts` (khoá `absence, bank, check, consent, reports, ungraded, reminders, makeup, unmarked, draft`; bài không liệt kê đủ 10 khoá mà kiểm từng ca): khẩn trước dù số nhỏ hơn (`check` 2 đứng trước `bank` 1), cùng nhóm thường thì nhiều trước; `absence` → `/lop-cua-toi/lich`, `unmarked` → `/lop-cua-toi/lop`; mọi `href` bắt đầu `/lop-cua-toi`. Các ca này chỉ có số khác nhau nên việc đồng bộ thứ tự khi bằng nhau giữa `tutorTodo.ts` và `tutorInbox.ts` (mục 9 điểm 1) không làm bài đỏ.
- `ui-plan.ts` ("Lối tắt" có "Kế hoạch buổi"), `ui-recruit.ts` ("Lối tắt" có "Bài đăng tìm HS"): hai liên kết này phải còn trong nav "Lối tắt" của Tổng quan.
- `ui-tutor-everything.ts`, `ui-links-everywhere.ts`: mọi `<a href>` và nút trên `/lop-cua-toi`, `/lop-cua-toi/tong-quan` phải mở được thật (không 404, không bị đẩy về đăng nhập). Thêm liên kết mới phải trỏ vào route đang có.
- `ui-trial-mode.ts`: trên các trang này không có lối "Nạp Coin" / "Mua VIP".
- `t-course-ids.ts`: "tong-quan" là đoạn đường dẫn dành riêng (`src/lib/courseIds.ts`); nếu bỏ route Tổng quan thì vẫn giữ nó trong danh sách dành riêng (bài còn kiểm ngược: mã dành riêng thừa không ứng với thư mục nào cũng đỏ, nên bỏ route thì phải bỏ cả mục trong danh sách). Thêm một đoạn đường dẫn cố định mới dưới `/lop-cua-toi` thì phải thêm vào danh sách này; dùng tham số truy vấn (ví dụ `?viec=bank`, câu 7) thì không cần.
- `t-no-hex.ts`, `t-no-fabricated.ts`: không mã màu hex; không số liệu bịa.
- `t-rail-lib.ts`, `ui-sidebar.ts`, `ui-account-menu.ts`: nút "Thu gọn thanh bên" / "Mở thanh bên", phím `[`, menu tài khoản (đừng đổi).

---

## 8. Quy tắc cũng phải giữ

| Quy tắc | Áp vào màn này thế nào | Nguồn |
|---|---|---|
| **Tiền** là số nguyên VND, hiển thị `480.000đ` (nhóm nghìn bằng dấu chấm, đuôi "đ") | "Đã thu tháng này" lấy từ khoản tiền đã gạch (`appliedAmount`), không tính lại bằng "số buổi × giá lớp hiện tại"; tiền chốt vào sự kiện | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 5 điều 1; `src/lib/tutorInbox.ts` `inboxVnd`, `TutorDashboard.tsx` `vnd` |
| KiN không giữ học phí; phụ huynh chuyển thẳng cho gia sư | không vẽ số dư ví, nút "nhận tiền", "rút tiền" | `CLAUDE-cho-kho-trien-khai.md` mục 1 |
| Không có màn mua hoặc nạp Coin cho học sinh; gia sư cũng không có lối "Nạp Coin / Mua VIP" ở các màn này | không thêm | `BRIEF.md` mục Ràng buộc; `ui-trial-mode.ts` |
| Học sinh có thể dưới 16 tuổi (mã nói đồng ý của phụ huynh cho học sinh dưới 18) | tên em chỉ hiện cho gia sư chủ lớp; không thêm thu thập dữ liệu cá nhân; chữ "Chờ phụ huynh xác nhận" giữ đúng, không tự viết số tuổi vào giao diện | `BRIEF.md`; `CLAUDE-cho-kho-trien-khai.md` mục 8, 9; `src/lib/enrollment.ts` dòng 31; `tutorInbox.ts` `consent.hint` |
| **Thông báo không tên, không tiền** | chữ hiện trên màn hình khoá / thông báo đẩy chỉ dựng từ loại việc; số duy nhất được phép là N của "Hôm qua có N buổi chưa điểm danh". Số đỏ trên thanh module chỉ là số, có nhãn "N việc cần xử lý" | `src/lib/pushRules.ts` (đầu tệp), `ModuleRail.tsx` `Badge` |
| Số đỏ chỉ đếm việc cần người đó ra tay; một việc = một hàng dữ liệu thật, không đếm suy ra, không cache riêng, không dòng "đã xong" giả | không thêm loại việc không có nguồn | `docs/kin/thiet-ke/bo-cuc-outlook.md` mục 3 và 10; đầu `src/lib/tutorInbox.ts` |
| Token màu `--kin-*`, không mã hex, không thêm màu ngoài bộ | dùng đúng token ở mục 4.4; hai bộ mã chữ/chấm; tối và sáng đều phải đạt | `src/app/kin-tokens.css`; `docs/kin/thiet-ke/tuong-phan.md`; `t-no-hex.ts` |
| **Màu không bao giờ nói một mình** | mọi trạng thái có chữ đi kèm (chấm chỉ trang trí, `aria-hidden`) | `CLAUDE-cho-kho-trien-khai.md` mục 6; `src/components/kin/Status.tsx` |
| Vùng chạm ≥ 44px | dòng việc, dòng buổi, liên kết "Mở lớp / Điểm danh / Danh sách HS", "Xem cả tuần", "Quay lại", nút trên thanh module | `tuong-phan.md` mục Vùng chạm; `--kin-cham-toi-thieu` |
| Giờ Việt Nam, 24 giờ, `dd/mm`, tuần bắt đầu từ Thứ Hai, tháng theo giờ VN (`+07:00`) | lời chào theo giờ VN; "Đã thu tháng này" tính từ đầu tháng VN; mọi giờ buổi hiển thị `HH:mm` | `src/lib/classSessions.ts` (`vnDateKeyOf`, `vnMinutesOfDay`, `hmOf`), `src/lib/revenue.ts` `vnMonthKey` |
| Mọi việc khoá theo gia sư; không bao giờ thấy việc của người khác | mọi truy vấn có `ownerId`/`tutorId`; API `requireTutor` | `src/lib/tutorInboxServer.ts`; `src/app/api/tutor/hop-viec/route.ts` |
| Thao tác ghi dữ liệu dùng POST thường + chuyển hướng 303, không server action | màn này không ghi; nếu thiết kế thêm nút ghi tại chỗ (ví dụ "Đã xử lý") thì phải theo quy tắc này và báo ở mục 12 | `CLAUDE-cho-kho-trien-khai.md` mục 5 điều 5 |
| Bố cục Outlook: danh sách `role="listbox"` / `role="option"`, nút module dùng `aria-current` không dùng `aria-selected`, khung xương thay vòng xoay, lỗi tải giữ nguyên nội dung cũ + nút thử lại, tôn trọng `prefers-reduced-motion` | giữ trong cả phương án A lẫn B | `docs/kin/thiet-ke/bo-cuc-outlook.md` mục 5, 6, 8, 9 |
| Giọng sản phẩm: tiếng Việt, tên "KiN", không "Midnight Elite"; mỗi vai một giọng | nhãn việc dùng giọng gia sư ("2 học sinh chờ phụ huynh xác nhận"), không dùng giọng phụ huynh | `CLAUDE-cho-kho-trien-khai.md` mục 7 |
| Next.js trong kho này có thay đổi so với kiến thức cũ | người dựng mã đọc `node_modules/next/dist/docs/` trước khi viết (không ảnh hưởng thiết kế) | `AGENTS.md` |

---

## 9. Điều đang chưa tốt ở bản hiện tại

Căn cứ mã (cây làm việc 22/10/2026) và ảnh trong `anh-hien-trang/`.

1. **Hai màn làm cùng một việc nhưng không khớp nhau.** Cùng bộ đếm, khác chữ ("Khoản tiền vào cần đối soát" và "1 khoản tiền vào cần đối soát"), khác chữ trạng thái (Tổng quan chỉ có chấm màu + số), khác đích bấm ("consent", "ungraded", "unmarked" ở Tổng quan đều rơi về `/lop-cua-toi/lop`, còn Hộp việc đưa tới đúng lớp, đúng ngày điểm danh), và **khác thứ tự khi bằng nhau**: Tổng quan xếp bank trước check và reports trước reminders, Hộp việc xếp check trước bank và reminders trước reports (`tutorTodo.ts` so với `META` trong `tutorInbox.ts`). Ảnh `5-tong-quan-truoc-khi-sua.jpg` cho thấy đúng thứ tự của Tổng quan ("báo cáo cộng đồng" trước "tin nhắc lịch"), ảnh `1-hop-viec-hien-tai.jpg` cho thấy thứ tự ngược lại.
2. **Tổng quan bị giấu.** Chỉ vào được qua Khác → Dạy học → Tổng quan; màn đầu là Hộp việc, hoặc Lịch với gia sư mới. Con số "Đã thu tháng này", "Lớp đang dạy" không bao giờ nằm ở nơi gia sư nhìn thấy đầu tiên (ảnh `1-hop-viec-hien-tai.jpg`: toàn danh sách chữ, không có ô thống kê nào; số tiền duy nhất là "12.345đ" nằm trong dòng phụ của một khoản chờ đối soát).
3. **Buổi muộn hôm nay hiện hai lần.** `upcoming` gồm cả buổi hôm nay chưa bắt đầu, trong khi `today` đã gồm mọi buổi hôm nay (`TutorDashboard.tsx`). Ví dụ 19:00 hôm nay vừa nằm ở "Hôm nay" vừa ở "Sắp tới".
4. **Dòng buổi học bản phẳng mất thông tin.** Chỉ còn giờ bắt đầu + tên lớp + chữ trạng thái; bản đã commit có giờ kết thúc và "n học viên" (có sẵn trong dữ liệu). Cả dòng đều trỏ về `/lop-cua-toi/lich`, không nhảy tới buổi hay ngày đó.
5. **Màu nói một mình ở "Việc cần làm" của Tổng quan.** Phân biệt khẩn và không khẩn chỉ bằng màu chấm và màu số, không có chữ ("Cần xử lý"); trái quy tắc "màu không nói một mình". Ảnh `5-tong-quan-truoc-khi-sua.jpg`: hai màu đỏ và vàng đứng cạnh số, không có chữ giải thích.
6. **Cây làm việc chưa commit làm hỏng bài test `ui-tutor-dash`.** `Heading` bọc `<h2 id="h-viec">` trong `<div>`; test đọc chữ của phần tử CHA của `#h-viec` nên chỉ thấy "Việc cần làm", mọi kiểm tra "việc: …" sẽ đỏ.
7. **Bản đã commit (ảnh 6) bị chê "dày":** 4 thẻ có viền màu trên cùng, mỗi việc là một thẻ có viền trái, nhãn nhỏ nhắn xô vào nhau; bản phẳng gỡ bớt nhưng mất con số "Việc cần làm" (ảnh 6: 14, đỏ) và câu "7 ngày tới cũng chưa có buổi nào…".
8. **Hộp việc cắt chữ "…" ở cả tiêu đề lẫn dòng phụ** (ảnh `1-hop-viec-hien-tai.jpg`: "Chờ Phụ Huynh · Toán 9 (rà liên kết) · chờ p…"). Dòng phụ chính là chỗ có tên em và số tiền nên cắt mất thông tin quan trọng nhất; trái `BRIEF.md` ("không chữ bị cắt …"), nhưng đúng `bo-cuc-outlook.md` mục 4 (cắt để hàng đều nhau).
9. **Khung đọc của Hộp việc nghèo nút.** Ba loại việc (consent, ungraded, unmarked) không có nút lệnh nào (`commands: []`); gia sư phải bấm vào tên nhỏ trong danh sách. Ảnh 1: nửa phải màn gần như trống với chữ 13,3px màu mờ khi loại việc chỉ có 2 dòng.
10. **Lỗi tải lần đầu để lại một màn "Đang tải…" mãi.** Khi `/api/tutor/hop-viec` lỗi ngay lần đầu, `HopViec.tsx` hiện dải lỗi nhưng không dựng khung xương, cột trái trống và khung đọc vẫn ghi "Đang tải…".
11. **Khung xương không khớp.** `loading.tsx` của nhóm `(tutor)` là bố cục thẻ cũ (3 ô số, 2 thẻ lớn) và áp cả lên `/lop-cua-toi`, trong khi Hộp việc lại có khung xương danh sách riêng; người dùng có thể thấy hai khung xương khác nhau nối tiếp (theo cách Next.js dùng `loading.tsx`, chưa kiểm bằng ảnh).
12. **"Xem tất cả" (Tổng quan) đi `/lop-cua-toi`.** Khi Hộp việc chưa bật, đường này chuyển sang Lịch nên liên kết đưa gia sư tới nơi không liên quan. Liên kết chỉ hiện khi có hơn 5 loại việc.
13. **Danh sách lớp dài và đều tăm tắp.** 7 lớp × (tên + dòng phụ + 3 liên kết 44px) chiếm gần hết màn điện thoại; không ưu tiên lớp có buổi hôm nay; không giới hạn số lớp. Mục 4.1 xử lý phần "giới hạn số lớp" (4 lớp + "Xem tất cả"); phần "ưu tiên lớp có buổi hôm nay" chưa được áp mà để ở câu 8 (mặc định vẫn là tạo gần nhất trước).
14. **Không có chỉ số "còn bao nhiêu chưa thu" ở trang chủ.** Sổ Gia Sư có "Học phí chưa thu" cạnh "Đã thu"; ở đây trang chủ không có con số này. Đây là điểm so sánh, không phải lỗi phải sửa: thêm nó cần một phép cộng mới trên các trường phiếu đã có và là quyết định của chủ dự án (câu 5, mặc định KHÔNG làm); thiết kế này không đổi cách tính tiền nào.
15. **Thiếu phần mà đặc tả đã hứa:** chip lọc "Tất cả · Cần trả lời · Đã xử lý" (`bo-cuc-outlook.md` mục 4) và phím Esc về danh sách trên điện thoại (mục 8) chưa có trong `HopViec.tsx`.
16. **Nhãn "Học viên" lẫn "học sinh"** trên cùng màn ("Học viên đang học", "2 học sinh chờ phụ huynh xác nhận").

---

## 10. Mẫu học từ đối thủ

Mỗi mẫu: tên mẫu - sản phẩm - ảnh. (Ảnh Sổ Gia Sư ở `anh-tham-khao-so-gia-su/`; ảnh còn lại ở `/tmp/rs/x/word/media/` — thư mục tạm, KHÔNG nằm trong gói gửi Claude Design và có thể mất khi khởi động lại máy; trước khi gửi gói phải chép các ảnh được nêu vào `anh-tham-khao-so-gia-su/` hoặc bỏ tham chiếu. Đã mở xem từng ảnh được nêu và đối chiếu mô tả. Chỉ lấy ý, không chép bố cục cứng của máy tính.)

- Mỗi khối một con số lớn + một dòng nhãn nhỏ - Sổ Gia Sư - `01-trang-chu.jpg`
- Lời chào theo giờ kèm ngày đầy đủ ở đầu trang - Sổ Gia Sư - `01-trang-chu.jpg`
- Thẻ tiền đã thu và tiền chưa thu đặt cùng một hàng, phân biệt bằng biểu tượng xanh lá và cam (con số vẫn đen; màu chỉ nằm ở biểu tượng, nên khi dùng phải có chữ đi kèm) - Sổ Gia Sư - `01-trang-chu.jpg`
- Biểu tượng con mắt để ẩn/hiện số tiền khi mở app trước mặt người khác - Sổ Gia Sư - `01-trang-chu.jpg`
- Ba số nhỏ trong một khối dùng ba màu nghĩa (lên lịch, hoàn thành, nghỉ) - Sổ Gia Sư - `01-trang-chu.jpg`
- Việc phải làm ngay (buổi chưa chốt) đứng đầu, trạng thái rỗng có một câu - Sổ Gia Sư - `01-trang-chu.jpg` (tránh: thẻ rỗng rộng cả hàng)
- Hàng KPI nhỏ: biểu tượng tròn + số đậm + nhãn tối đa 2 dòng - TutorBird - `2b42778202338e054738963f94987070146fba2c.jpg`
- Danh sách "hôm nay" ngay dưới KPI, có nút Hôm nay và mũi tên trước/sau - TutorBird - `2b42778202338e054738963f94987070146fba2c.jpg`
- Thẻ buổi có vạch màu bên trái, giờ đậm là thứ to nhất - TutorBird - `2b42778202338e054738963f94987070146fba2c.jpg`
- Lưới 3×2 số lớn, nhãn nhỏ bên dưới, đọc trong một cái nhìn - Teachworks - `b8b4e041c72f27aec8f5bfec53a348232a79202e.jpg`
- Dải bước thiết lập 1 đến 7 rồi "Thiết lập hoàn tất!" ở đầu trang gia sư mới (ảnh chỉ cho thấy dải; chưa kiểm được việc nó biến mất khi xong, nên chỉ lấy ý "chỉ hiện khi chưa xong") - Teachworks - `b8b4e041c72f27aec8f5bfec53a348232a79202e.jpg`
- Khối riêng cho việc quá hạn, rỗng có câu tích cực "Bạn không có hoá đơn nào quá hạn" - Teachworks - `99ed171bdb9c77a583c7528d8e46a03654ca3b0e.jpg`
- Xếp khối theo câu hỏi "hôm nay có gì", mỗi khối một tiêu đề, rỗng có một câu thân thiện - Shub - `11a4cd13870ab67784094443ad71645be24a7000.jpg`
- Bảng tổng kết cuối trang 3 cột ngắn - Shub - `0b5e59f8d5548f0ec3426c719d25bae05e840b05.jpg`
- Banner vàng nhỏ nhắc việc cần làm, đóng được; khối rỗng có một câu hướng dẫn + một nút - Wyzant (màn học sinh) - `2e32d1cb11fc824425fdeedcb0af0e20d33cf23d.jpg`

**Tránh (đối thủ cho thấy hỏng):** lịch hôm nay đặt cuối phải cuộn mới thấy (Sổ Gia Sư); minh hoạ lớn chiếm chỗ khi trống (Shub); biểu đồ rỗng toàn số 0 (Teachworks); banner hướng dẫn chiếm chiều cao đầu trang (TutorBird, Teachworks); nhãn KPI dài tràn khỏi thẻ (TutorBird).

---

## 11. Dữ liệu mẫu để điền vào thiết kế

1. Gia sư **Cô Lan** (`giasu@kin.local`, chữ cái đầu "C"); thời điểm xem: chiều Thứ Năm 22/10/2026 → "Chào buổi chiều, Cô Lan" và "Thứ Năm 22/10/2026".
2. Ba số: **Học viên đang học 8** · **Lớp đang dạy 6/7** (6 lớp đang nhận, 1 lớp đã đóng) · **Đã thu tháng này 480.000đ** (Trần Gia Bảo đã đóng 480.000đ).
3. **Hôm nay:** không có buổi dạy nào. **Sắp tới:** Thứ Sáu 23/10 · 19:00–20:30 · Toán 9 · 2 học viên · Sắp tới; Thứ Bảy 24/10 · 16:00–17:30 · Văn 8 · 1 học viên · Sắp tới.
4. **14 việc cần làm** (2+1+1+4+2+2+1+1), đúng thứ tự mà `buildInboxItems` của Hộp việc sắp (Tổng quan hiện hành xếp (6) trước (5) vì thứ tự khai báo khác, xem mục 9 điểm 1): (1) 2 học sinh chờ phụ huynh xác nhận · Chờ phụ huynh; (2) 1 báo nghỉ sát giờ · Cần xử lý; (3) 1 khoản tiền vào cần đối soát · Chờ đối soát; (4) 4 buổi đã qua giờ, chưa điểm danh xong · Chưa điểm danh; (5) 2 tin nhắc lịch đã tới hạn · Cần nhắc; (6) 2 báo cáo trong cộng đồng lớp · Chờ xử lý; (7) 1 bài chưa chấm · Chờ chấm; (8) 1 phiếu học phí nháp chưa gửi · Chưa gửi.
5. Dòng phụ mẫu (Hộp việc): "Lê Minh · Toán 9 · chờ phụ huynh xác nhận" (em chờ xác nhận chưa vào học nên chưa thể có phiếu hay báo nghỉ: không dùng tên Đỗ Hà ở đây, vì Đỗ Hà đã có phiếu nháp và báo nghỉ ở các dòng dưới); khoản tiền vào "250.000đ · 22/10 16:38 · khong ma"; phiếu nháp "Đỗ Hà · Phiếu nháp tháng 10/2026 · 560.000đ".
6. Giờ góc dòng mẫu: hôm nay "16:38"; ngày khác "14/10".
7. **7 lớp:** Toán 9 (2/2 học viên · đã đầy · Đang nhận học viên), Toán 7 (1), Văn 8 (1), Sinh 8 (2), Hoá 8 (1), Lý 9 (1), và một lớp thứ bảy đã đóng "Văn 9" (0 học viên · Đã đóng). Tên của lớp thứ bảy là tuỳ chọn. Nhóm lớp mẫu dùng giá trị thật của `ADMIN_CATEGORIES` ("ĐGNL HSA" cho phần lớn lớp, "Tốt nghiệp THPT" cho một hai lớp), không dùng tên môn như "Toán" vì `Course.category` không chứa tên môn (mục 3.A). Dòng lớp mẫu: "2/2 học viên · đã đầy · ĐGNL HSA · Đang nhận học viên".
8. Báo nghỉ sát giờ mẫu: "Toán 9 · buổi 23/10 19:00 · báo trước 45 phút" (học sinh Đỗ Hà).
9. Khi thấy 7 lớp ở điện thoại: hiện 4 lớp đầu (mới tạo trước) + "Xem tất cả 7 lớp".
10. Gia sư mới chưa có lớp (Cô Mới): ba số "0", "0/0", "0đ"; "Bạn chưa mở lớp nào"; "Hiện không có việc nào cần xử lý."
11. Trạng thái lỗi Hộp việc: "Không tải được Hộp việc." + "Thử lại" trên danh sách 8 dòng vẫn còn.

---

## 12. Câu hỏi còn mở

Mỗi câu gắn nhãn: **[CHỦ QUYẾT]** = quyết định sản phẩm, quy tắc nghiệp vụ hoặc đổi test đã khoá, nhà thiết kế và người dựng không tự quyết được; **[MẶC ĐỊNH]** = nhà thiết kế cứ theo đề xuất, chủ dự án chỉ cần lên tiếng nếu muốn khác, không chặn việc vẽ. Không câu nào đòi đổi cách tính tiền hoặc thu thêm dữ liệu về học sinh.

1. **[CHỦ QUYẾT] Gộp theo Phương án A hay giữ hai route (Phương án B)?** A đổi hành vi test khoá: "máy tính mặc định chọn sẵn dòng đầu" (đặc tả `bo-cuc-outlook.md` mục 5, bài `ui-tutor-shell.ts` kiểm ngay heading "2 khoản tiền vào cần đối soát" sau khi tải), "điện thoại: danh sách trước, chưa có h1" (cũng ở `ui-tutor-shell.ts`, kèm kiểm `listbox` và đáy danh sách ≤ 740px), và, nếu `/lop-cua-toi/tong-quan` dùng chữ của Hộp việc, 7 kiểm tra "việc: …" của `ui-tutor-dash` (mục 4.0). Cần chủ dự án quyết, rồi sửa đúng các bài đó. Đề xuất: A. Nếu chủ muốn không đụng test thì chọn B.
2. **[CHỦ QUYẾT] Trang chủ có thành màn mặc định cho mọi gia sư không?** Hiện gia sư mới ở chế độ gọn vào thẳng Lịch và không thấy Hộp việc trên thanh module trừ khi tự bật; Tổng quan vẫn mở được ở Khác → Dạy học → Tổng quan nhưng không phải màn đầu. Nếu Trang chủ gộp, có đổi mặc định (bỏ chế độ gọn, hoặc đưa Trang chủ vào chế độ gọn) không? Liên quan `src/lib/landing.ts`, `ui-journey-new-tutor.ts` G5 (đang kiểm gia sư mới rơi vào `/lop-cua-toi/lich`), `ui-schedule.ts`.
3. **[CHỦ QUYẾT] Nhãn trên thanh module vẫn "Hộp việc" hay đổi thành "Trang chủ"?** Nếu gộp, mục đầu tiên chứa cả Tổng quan; nhưng chữ "Hộp việc" nằm trong nhiều bài test và liên kết (`aria-label` logo "KiN — Hộp việc của gia sư", `ui-tutor-shell`, `ui-journey-new-tutor`) và là tên đã chốt trong `bo-cuc-outlook.md`.
4. **[MẶC ĐỊNH] Thứ tự trên điện thoại: Việc cần làm trước Hôm nay (đề xuất) hay ngược lại?** Mã hiện để Hôm nay trước; tài liệu 102 ảnh nói việc đang cần làm lên trước. Đề xuất: Việc cần làm trước, nhưng chỉ 3 dòng. Lưu ý ở mục 4.1: với thứ tự này, "Sắp tới" có thể rơi dưới nếp cuộn.
5. **[CHỦ QUYẾT] Có hiện "Còn lại / chưa thu" cạnh "Đã thu tháng này" không?** Cần một phép cộng mới trên các trường phiếu đã có (`amountDue − paidAmount` của phiếu chưa đóng); `loadTutorDashboard` chưa có. Không đổi cách tính phiếu hay tiền đã thu. Số mẫu "còn lại 560.000đ" trong `BRIEF.md` là dữ liệu của màn Học phí. Có thêm biểu tượng con mắt để ẩn số tiền (Sổ Gia Sư có) không? Mã hiện chưa có; đây là trạng thái giao diện, không phải dữ liệu mới. Mặc định: KHÔNG làm cả hai.
6. **[CHỦ QUYẾT] Chữ trong Hộp việc: cắt "…" (giữ hàng đều) hay cho xuống dòng (không mất tên em)?** `BRIEF.md` và `bo-cuc-outlook.md` nói ngược nhau. Đề xuất: danh sách ở máy tính cắt một dòng như hiện nay; ở điện thoại cho xuống tối đa 2 dòng. Cần chủ quyết vì phải sửa một câu trong đặc tả đã giao (`bo-cuc-outlook.md` mục 4).
7. **[MẶC ĐỊNH, cần người dựng xác nhận khả thi] Dòng việc ở Trang chủ bấm vào mở thẳng đúng loại việc ở Hộp việc không?** Hiện không có tham số nào chọn sẵn loại (cần thêm, ví dụ `?viec=bank`; tham số truy vấn thì không đụng danh sách đường dẫn dành riêng). Nếu không làm, dòng việc ở Trang chủ chỉ đi tới trang xử lý như Tổng quan hôm nay.
8. **[MẶC ĐỊNH] Giới hạn 4 lớp trên Trang chủ điện thoại + "Xem tất cả 7 lớp" (→ `/lop-cua-toi/lop`).** Module "Lớp" có thể đang tắt ở chế độ gọn; trang `/lop-cua-toi/lop` vẫn mở được nhưng không có trên thanh module. Có ưu tiên lớp có buổi hôm nay lên trước không (mục 9 điểm 13)? Mặc định: giữ thứ tự mã (tạo gần nhất trước).
9. **[MẶC ĐỊNH] Một dòng buổi học bấm vào đâu?** Hiện luôn `/lop-cua-toi/lich` (tuần hiện tại). Lịch chưa có tham số ngày (đã kiểm: cả `lich/page.tsx` lẫn `LichClient.tsx` không đọc tham số URL), nên mặc định vẫn là cả dòng về Lịch.
10. **[MẶC ĐỊNH] Buổi đã dời (`status = "moved"`) hiển thị thế nào?** Mã hiện không đánh dấu và hiển thị ở ngày hiệu lực mới; mặc định không thêm chữ "Đã dời".
11. **[MẶC ĐỊNH, quyết định kỹ thuật] Khung xương và trạng thái lỗi lần đầu tải** cần thiết kế lại cho khớp bố cục mới (mục 6, mục 9 điểm 10, 11); mặc định tách khung xương riêng cho Trang chủ, không sửa `loading.tsx` dùng chung của cả nhóm `(tutor)`.
12. **[MẶC ĐỊNH] Bản nào là chuẩn để so sánh:** commit `5d583f7` (4 thẻ số, có thẻ viền) hay cây làm việc phẳng chưa commit (3 số, bỏ chữ giải thích)? Đề xuất bản phẳng, nhưng phải giữ cấu trúc `#h-viec` (mục 7); bản phẳng hiện làm `ui-tutor-dash` đỏ, cần sửa trước khi commit.
13. **[CHỦ QUYẾT, không chặn thiết kế] Tuổi cần phụ huynh xác nhận:** chữ giải thích trong mã nói "dưới 18 tuổi" (`enrollment.ts` ghi ngưỡng 18 là "D04 tạm chốt"), quy tắc dự án nhắc trẻ dưới 16 và `CLAUDE-cho-kho-trien-khai.md` mục 8 cấm tự quyết điều này. Thiết kế không ghi số tuổi lên giao diện và giữ nguyên câu giải thích hiện có của khung đọc; chủ dự án xác nhận cách làm này.
14. **[MẶC ĐỊNH — đã tự giải được một nửa] Nhóm lớp (`Course.category`):** đã kiểm trong mã, các giá trị là "ĐGNL HSA" (mặc định), "ĐGNL HCM", "Tốt nghiệp THPT", "TSA Bách Khoa", "BCA" cộng giá trị đã có trong DB; đó là nhóm đề thi, không phải tên môn, nên ví dụ "Toán" trước đây là sai và đã sửa ở mục 4.1 và 11. Còn lại một lựa chọn trình bày: giữ nhóm lớp trên dòng lớp ở điện thoại hay ẩn cho thoáng. Mặc định: giữ ở máy tính, ẩn ở điện thoại để dòng 2 không dài thêm; nhà thiết kế chọn.
