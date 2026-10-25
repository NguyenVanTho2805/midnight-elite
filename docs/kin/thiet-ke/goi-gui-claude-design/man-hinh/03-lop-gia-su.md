# Danh sách lớp, chi tiết lớp và tạo lớp của gia sư

Route: `/lop-cua-toi/lop` (danh sách), `/lop-cua-toi/[courseId]` (chi tiết), `/admin/khoa-hoc?tao=1` (tạo lớp, ngăn kéo bên phải), `/admin/khoa-hoc/[id]/diem-danh`, `/admin/khoa-hoc/[id]/hoc-vien` (màn con) · Tệp chính: `src/app/lop-cua-toi/(tutor)/lop/page.tsx`, `src/app/lop-cua-toi/(tutor)/TutorClassList.tsx`, `src/app/lop-cua-toi/[courseId]/page.tsx`, `src/app/lop-cua-toi/[courseId]/OutlookShell.tsx`, `src/components/tutor/ClassInvites.tsx`, `src/components/tutor/BulkInvite.tsx`, `src/app/(admin)/admin/khoa-hoc/page.tsx` (hàm `CreateCourseDrawer`), `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx` (tab Lịch học, Học viên đăng ký, Cài đặt), `.../[id]/diem-danh/page.tsx`, `.../[id]/hoc-vien/page.tsx` · Vai: gia sư đã duyệt (`session.role === "admin"` và `adminRole === "teacher"`), chủ lớp.

> Cách đọc: mọi chuỗi chữ trong dấu `"..."` lấy nguyên văn từ mã hoặc từ bài test. Chữ ghi **(đề xuất mới)** là chữ KHÔNG có trong mã, do bản này đề xuất. Điều chưa chắc nằm ở mục 12. Trạng thái mã nguồn dùng để viết: cây làm việc ngày 22/10/2026, trong đó `TutorClassList.tsx` và `TutorDashboard.tsx` đang sửa dở (chưa commit) theo hướng "danh sách mảnh, không khung thẻ"; ảnh `anh-hien-trang/3-lop-truoc-khi-sua.jpg` là bản CŨ hơn (thẻ có viền, hai cột). Bản này đã được một người kiểm độc lập đối chiếu lại từng khẳng định với mã, schema và các bài test trong `tools/local-e2e/` ngày 22/10/2026 và đã sửa các chỗ sai; nếu mã đổi sau ngày đó, đối chiếu lại mục 3 và mục 7 trước khi tin.

---

## 1. Mục đích và người dùng

**Người dùng:** cô Lan và các gia sư tự do 1 đến 20 học viên (CLAUDE-cho-kho-trien-khai.md mục 1). Dùng nhiều nhất trên điện thoại, thường đứng trước cửa lớp hoặc ngay sau buổi dạy.

**Mục đích của cụm màn này:** (a) biết mình đang dạy mấy lớp, lớp nào còn chỗ, lớp nào đã đóng; (b) từ một lớp đi tới ba việc hằng ngày: điểm danh, xem danh sách học sinh, mời học sinh vào bằng mã; (c) lần đầu có lớp trong dưới 2 phút (NC2-021, NC2-029): **chỉ bắt buộc gõ Tên lớp**, giá, ngày khai giảng, số bài học để mặc định.

**Không phải mục đích:** bán khoá công khai, quản chương bài, thu tiền. Các việc đó nằm ở màn khác (Quản khoá, Học phí). KiN không giữ học phí.

**Hai điều kiện vào màn:** gia sư mới ở "chế độ gọn" (thanh bên chỉ có Lịch và Học phí, module "Lớp" tắt, `userPreferences.ts`) vẫn vào được `/lop-cua-toi/lop`; lối vào đầu tiên của gia sư mới là nút "Xem các lớp của tôi" ở Lịch rỗng (`ui-journey-new-tutor.ts`). Người không phải gia sư bị chuyển về `/lop-cua-toi`; chưa đăng nhập bị chuyển tới `/dang-nhap?redirect=/lop-cua-toi/lop`.

---

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)

1. **Điểm danh buổi vừa dạy** (lặp lại nhiều lần mỗi tuần): từ dòng lớp bấm "Điểm danh", chấm từng em Có mặt / Muộn / Có phép / Vắng, bấm "Lưu điểm danh".
2. **Mở một lớp** để xem việc của lớp đó ("Mở lớp").
3. **Mời học viên vào lớp**: tab "Mã mời" của lớp: tạo một mã (tuỳ chọn số lượt, số ngày), sao chép link hoặc mã gửi Zalo; hoặc "Mời cả lớp một lần": dán danh sách "tên em, số Zalo phụ huynh" để KiN soạn sẵn tin riêng cho từng phụ huynh.
4. **Xem danh sách học sinh** của lớp ("Danh sách HS"): tìm tên, gọi điện.
5. **Tạo lớp đầu tiên** (gia sư mới): "Tạo lớp đầu tiên" mở ngăn kéo, gõ Tên, bấm "Tạo khoá học"; KiN tự chuyển sang trang quản khoá, tab "Lịch học" đã mở sẵn để đặt khung giờ; từ đó bấm "Mở lớp" để tới mã mời.
6. **Đặt khung giờ học hằng tuần** (tab "Lịch học" của trang quản khoá).
7. Việc phụ: đổi sức chứa / trạng thái nhận học viên (Quản khoá, tab "Cài đặt"), xuất bảng điểm danh tháng (Tải CSV, Tải Excel, In / Lưu PDF), nhắn Zalo phụ huynh, xem Báo cáo tháng.

---

## 3. Dữ liệu hiển thị

Mọi bảng dưới chỉ gồm trường có thật. Phần 3.7 liệt kê riêng thứ CHƯA nằm trong trang nhưng đã có sẵn nguồn ở nơi khác.

### 3.1 Danh sách lớp (`/lop-cua-toi/lop`)

Nguồn chung: `loadTutorDashboard(session.userId)` trong `src/lib/tutorDashboard.ts` → `classes[]` (mỗi phần tử: `Course.{id,name,category,status,classStatus,capacity}` + `students`), sắp theo `Course.createdAt` giảm dần. Lưu ý: cột này là CHUỖI chứ không phải ngày; lớp tạo qua web ghi dạng `d/M/yyyy 08:00:00` (`POST /api/courses`) nên thứ tự là theo chữ, KHÔNG luôn là "mới nhất đứng trên" (vd "5/10/2026" đứng trên "22/10/2026"). Dữ liệu thử của bài test dùng ISO nên ảnh hiện trạng trông đúng thứ tự. Thiết kế không được hứa "mới nhất trước". Danh sách này gồm CẢ lớp đã đóng và lớp tạm ngừng, không lọc.

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề trang | `lop/page.tsx` | chữ cố định | "Lớp" |
| Dòng phụ đầu trang | `lop/page.tsx`: `d.classes.length`, `d.totalStudents` | `{n} lớp bạn đang dạy · {m} học viên`; `totalStudents` đếm học viên đang học KHÔNG trùng giữa các lớp | "7 lớp bạn đang dạy · 8 học viên" |
| Tiêu đề khối | `TutorClassList.tsx` | "Các lớp đang dạy" (chữ nhỏ, xám) | |
| Màu nhận diện lớp | `classAccent(c.id)` trong `src/lib/classColor.ts`: băm id lớp ra một trong 5 token `--kin-th-xanh-troi`, `--kin-th-bac-ha`, `--kin-th-vang-nang`, `--kin-th-xanh-link`, `--kin-ph-hub` | chấm tròn 8px, `aria-hidden` | chấm xanh trời |
| Tên lớp | `Course.name` | liên kết, tự xuống dòng (`break-words`), không cắt | "Toán 9" |
| Sĩ số | `students` (học viên `Enrollment.status = "active"` của lớp), `Course.capacity` (null = không giới hạn) | `{students}` hoặc `{students}/{capacity}`, số dùng `tabular-nums`, rồi chữ " học viên" | "2/10 học viên" |
| Đã đầy | `capacity != null && students >= capacity` | thêm " · đã đầy" (chữ thường) | "2/2 học viên · đã đầy" |
| Môn / danh mục | `Course.category` (chuỗi tự do) | nguyên văn | "Toán" |
| Trạng thái nhận học viên | `Course.classStatus` qua `CLASS_STATUS_LABEL` (`src/lib/tutorTodo.ts`): `open` → "Đang nhận học viên", `closed` → "Đã đóng", `paused` → "Tạm ngừng" | chữ, không có màu | "Đang nhận học viên" |
| Đang ẩn | `Course.status === false` (công tắc "Hiển thị trên website") | thêm " · đang ẩn" | "· đang ẩn" |
| Ba liên kết | id lớp | "Mở lớp", "Điểm danh", "Danh sách HS" | |
| Nút đầu trang | `lop/page.tsx` | "Báo cáo tháng" → `/lop-cua-toi/bao-cao-thang` | |

Dòng phụ của một lớp hiện là MỘT câu nối bằng " · ": `{sĩ số} học viên[ · đã đầy] · {danh mục} · {trạng thái}[ · đang ẩn]`.

### 3.2 Chi tiết lớp (`/lop-cua-toi/[courseId]`)

Nguồn: `[courseId]/page.tsx` chỉ lấy `Course.{id,name,category,ownerId}` và tên gia sư (`User.name`, chỉ để tin mời phụ huynh tự giới thiệu). Quyền: chủ lớp hoặc quản trị cấp cao → vai "tutor"; học sinh có `Enrollment` active → vai "student" (không thuộc phạm vi bản này); còn lại `notFound()`.

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Liên kết quay lại | `OutlookShell.tsx` | "← Lớp của tôi" → `/lop-cua-toi` (KHÔNG phải danh sách lớp) | |
| Tên lớp (h1) | `Course.name` | nguyên văn | "Toán 9" |
| Dòng phụ | `Course.category`, vai | `{category} · Bạn đang dạy lớp này` | "Toán · Bạn đang dạy lớp này" |
| Bảy mục việc (gia sư) | `tutorItems()` | nhãn: "Tổng quan", "Điểm danh", "Danh sách HS", "Quản khoá", "Mã mời", "Cộng đồng lớp", "Học phí", mỗi nhãn kèm một emoji | |
| Nội dung "Tổng quan" | `OverviewBlock` | "Chào mừng đến hộp việc của {tên lớp}." + "Danh sách việc bên trái. Chọn 1 mục để xem nội dung ở panel phải." | |
| Khối "Mở trang →" | `OpenPageBlock` (Điểm danh, Danh sách HS, Quản khoá, Cộng đồng lớp, Học phí) | tiêu đề + 1 câu ghi chú + liên kết "Mở trang →" | "Điểm danh" / "Bấm các em có mặt / muộn / có phép / vắng (AS-191)." |
| Đích các khối | `OutlookShell.tsx` | `/admin/khoa-hoc/{id}/diem-danh`, `/admin/khoa-hoc/{id}/hoc-vien`, `/admin/khoa-hoc/{id}`, `/lop-cua-toi/kiem-duyet`, `/lop-cua-toi/hoc-phi` | |
| Mã mời (nội dung thật, tải tại chỗ) | `ClassInvitesPanel` → `GET /api/courses/{id}/invites` → `items[]` | xem 3.4 | |

### 3.3 Tạo lớp (ngăn kéo "Tạo khoá học mới", `CreateCourseDrawer`)

Chỉ phần gia sư (`user.adminRole === "teacher"`). Mọi ô và giá trị mặc định:

| Ô | Nguồn trong mã (`CreateForm`) | Bắt buộc với gia sư | Mặc định / ghi chú |
|---|---|---|---|
| Tên khoá học | `form.name`, placeholder "VD: ĐGNL HSA — Trọn gói lộ trình" | CÓ (duy nhất) | lỗi "Tên khoá học không được để trống" |
| Slug (URL) | `form.slug`, tự sinh từ tên bằng `toSlug`; tiền tố "/khoa-hoc/" | không | "Tự tạo từ tên. Chỉnh nếu cần URL riêng." Mã lớp là toàn hệ thống: trùng → lỗi 409 `Slug "{id}" đã tồn tại. Hãy đặt tên khác để tạo slug duy nhất.`; trùng tên trang cố định (vd "lich") → 400 `Mã "{id}" trùng tên một trang của KiN. Hãy đặt tên lớp khác để tạo mã khác.` |
| Ảnh nền thẻ khoá học | `bgImage` (tải Cloudinary lúc lưu, hoặc dán URL) | không | thiếu cấu hình → dòng "⚠ Chưa cấu hình Cloudinary" |
| Danh mục | `category` | không | mặc định "ĐGNL HSA" (danh mục tĩnh `ADMIN_CATEGORIES` gộp với `GET /api/categories`) |
| Gia sư | `instructor`, placeholder "Thầy Nguyễn Minh" | không | mặc định "KiN" |
| Ngày khai giảng | `openDate` (`<input type="date">`) | không | nhãn "(tuỳ chọn · mặc định hôm nay)"; bỏ trống = hôm nay giờ VN (`vnDateKeyOf`), lưu dạng `dd/mm/yyyy` |
| Giá bán (đ) | `price` | không | "(tuỳ chọn · mặc định 0)"; kiểm "Giá bán phải là số không âm"; trần 50.000.000đ (`validateTutorCourseFields`) |
| Giá gốc (đ) | `originalPrice` | không | hiện "Giảm {n}%" khi có cả hai giá |
| Số bài học | `lessons` | không | "(tuỳ chọn · mặc định 0)"; "Số bài học phải là số không âm"; trần 1.000 |
| Số giờ học | `hours` | không | trần 5.000 |
| Nội dung nhãn / Màu nhãn | `tag`, `tagColor` (bốn màu HOT / SALE / MỚI / FREE, được LƯU vào DB nên được miễn quét hex) | không | |
| Hiển thị trên website | `status` (công tắc) | không | mặc định bật; "Tắt để lưu nháp, không hiện với học viên" |
| Preview | dựng từ ô đã gõ | không | "Preview — học viên sẽ thấy:" |

Sau khi tạo (gia sư): `router.push('/admin/khoa-hoc/{slug}?tab=lich-hoc&moi=1')`; trang đó báo "Đã tạo khoá học mới" đúng một lần rồi xoá `?moi=1` khỏi URL (NC2-035).

### 3.4 Mã mời (trong chi tiết lớp)

Nguồn: `Invite` trong `ClassInvites.tsx`, bảng `ClassInvite` (`prisma/schema.prisma`).

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Mã | `code` (8 ký tự, bảng chữ `23456789ABCDEFGHJKLMNPQRSTVWXYZ`, không có 0/1/I/O/U; chú thích trong `src/lib/classInvite.ts` nói loại cả F nhưng bảng chữ thật VẪN có F) | chữ mono đậm, giãn chữ | "7KQ4M2XD" |
| Trạng thái | `inviteState()`: thu hồi / hết hạn / hết lượt / còn dùng được | `Badge`: "Đã thu hồi" (trung tính), "Đã hết hạn", "Đã hết lượt" (đỏ), "Đang dùng được" (xanh) | |
| Lượt dùng | `usedCount`, `maxUses` (null = không giới hạn) | `Đã dùng {n}/{max} lượt` hoặc `Đã dùng {n} lượt` | "Đã dùng 1/3 lượt" |
| Hạn | `expiresAt` | ` · hết hạn {d/M/yyyy}` hoặc ` · không hết hạn` (định dạng `toLocaleDateString("vi-VN")`) | "· hết hạn 5/11/2026" |
| Ngày tạo | `createdAt` | ` · tạo {d/M/yyyy}` | |
| Link mời | tạo ở trình duyệt | `{origin}/student/nhap-ma-lop?code={code}` | |

"Mời cả lớp một lần" (`BulkInvite.tsx`, `src/lib/bulkInvite.ts`): ô dán nhiều dòng, tối đa 50 em (`BULK_MAX_ROWS`), mã hiệu lực 14 ngày (`BULK_INVITE_DAYS`), số lượt = số em. Chỉ `maxUses` và `expiresAt` lên máy chủ; tên em và số phụ huynh ở lại trong bộ nhớ trình duyệt, mất khi tải lại.

### 3.5 Điểm danh (`/admin/khoa-hoc/[id]/diem-danh`)

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Ngày | `date` (`<input type="date">`, mặc định hôm nay giờ MÁY, hoặc `?date=YYYY-MM-DD` từ Hộp việc) | | |
| Từng học viên | `GET /api/attendance-sessions/{id}` → `roster[]`: `userId, name, studentId, avatar, status, note, makeupAvailable, makeupUsedId, parentName, parentPhone, zaloOpenedAt` | hàng: avatar chữ cái đầu, tên, "Mã HS {studentId}" | "Trần Gia Bảo", "Mã HS 1042" |
| Trạng thái | `ATTENDANCE_LABEL` (`src/lib/attendance.ts`) | "Có mặt", "Muộn", "Có phép", "Vắng"; từ `sm` trở lên kèm " · ×{hệ số}" (1 / 0,9 / 0,8 / 0,5) | "Có mặt · ×1" |
| Năm ô đếm | `counts` | "Có mặt", "Muộn", "Có phép", "Vắng", "Chưa điểm danh" | |
| Buổi bù | `makeupAvailable`, `makeupUsedId` | ô tick "Dùng 1 buổi bù cho buổi này" + "(đang giữ {n}, gần nhất hết hạn {d/M/yyyy})" | |
| Đã mở Zalo | `zaloOpenedAt` | "Đã mở Zalo lúc {HH:mm} ngày {dd}/{mm}" (giờ VN) | |
| Thanh xuất | `exportMonth` | "Bảng tháng {mm/yyyy}:" + "Tải CSV", "Tải Excel", "In / Lưu PDF" | |

### 3.6 Danh sách học sinh (`/admin/khoa-hoc/[id]/hoc-vien`)

Nguồn: `GET /api/courses/{id}/students` → `students[]`: `userId, status, name, email, phone, school, enrolledAt, completed, totalLessons, progress` và `total`. API trả CẢ ba trạng thái ghi danh (`active`, `pending_consent`, `suspended`) nhưng trang này KHÔNG hiện `status`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Số em | `total` | `{total} em trong lớp` hoặc "Chưa có em nào ghi danh." | "9 em trong lớp" |
| Cột "Học sinh" | `name` | avatar chữ cái đầu + tên | |
| "Email", "SĐT", "Trường" | `email`, `phone` (liên kết `tel:` trên điện thoại), `school` | "—" khi trống | |
| "Tiến độ" | `completed`, `totalLessons`, `progress` | thanh + `{completed}/{totalLessons} ({progress}%)`; ≥80% xanh, 40 đến 79% cam, dưới 40% đỏ | "0/0 (0%)" |
| "Ghi danh" | `enrolledAt` | `d/M/yyyy` | "5/10/2026" |

### 3.7 Dữ liệu CHƯA nằm trong các trang trên (đề xuất, mỗi mục cần việc mới)

| Thứ có thể hiện | Nguồn thật đã có | Hiện thiếu |
|---|---|---|
| Buổi dạy kế tiếp của lớp | `loadTutorSchedule(tutorId, from, to, now)` trong `src/lib/reminderServer.ts` → `occurrences[]` (`courseId, dateKey, startAt, endAt, status, started`). Cẩn thận: hàm này còn kéo theo `students[]` kèm SĐT em và SĐT phụ huynh và tin nhắc; nếu dùng thì chỉ cắt lấy các trường giờ, KHÔNG chuyển `students` xuống trang. Cách nhẹ hơn: đọc `ClassSchedule` của lớp rồi `expandOccurrences` (`classSessions.ts`) | trang lớp không gọi |
| Khung giờ cố định | `ClassSchedule.{dayOfWeek,startTime,endTime,note,joinUrl,active}`; `GET /api/courses/{id}/class-schedules` | chỉ hiện trong trang quản khoá |
| Sĩ số và sức chứa ở trang chi tiết | `Enrollment` + `Course.capacity` | trang chi tiết chỉ lấy id/tên/danh mục |
| Số buổi chưa điểm danh của lớp | `loadUnmarkedSessions(tutorId)` (`src/lib/unmarkedServer.ts`) → mỗi phần tử có `courseId` | danh sách "Việc cần làm" ở Tổng quan (`/lop-cua-toi/tong-quan`, `buildTodoItems` trong `tutorTodo.ts`) trỏ "Buổi đã qua giờ, chưa điểm danh xong" về `/lop-cua-toi/lop` nhưng trang này không nói gì. (Hộp việc `/lop-cua-toi` thì khác: nó đã dẫn thẳng tới `/admin/khoa-hoc/{id}/diem-danh?date=…`, xem `tutorInbox*.ts`.) |
| Số em chờ phụ huynh xác nhận của lớp | `Enrollment.status = "pending_consent"` | cũng ở danh sách "Việc cần làm" của Tổng quan: "Yêu cầu xác nhận của phụ huynh đang chờ" trỏ về `/lop-cua-toi/lop`, trang không có chỗ nào nói. (Hộp việc đã dẫn thẳng `/admin/khoa-hoc/{id}/hoc-vien`.) |
| SĐT phụ huynh | `User.parentName`, `User.parentPhone` (đã có trong `roster` của trang điểm danh) | `/api/courses/{id}/students` không trả. Dữ liệu của trẻ: KHÔNG làm nếu chưa có trả lời ở mục 12 câu 10 |

---

## 4. Bố cục đề xuất

Nguyên tắc chung (BRIEF.md): THOÁNG, một cột, đường kẻ mảnh thay khung thẻ, mỗi khối một con số lớn + một dòng nhãn nhỏ, một hành động chính mỗi màn, trạng thái luôn có chữ, nút chạm ≥ 44px, không chữ bị cắt bằng "…". Giữ vỏ Outlook và thanh bên trái nguyên (thanh dưới 60px trên điện thoại, `ui-tutor-shell.ts`); chỉ thiết kế phần nội dung.

### 4.1 Danh sách lớp, điện thoại 390px (từ trên xuống)

1. **Đầu trang** (khoảng trắng trên 24px, lề ngang 20px): "Lớp" cỡ h3 đậm; ngay dưới, một dòng xám nhỏ "7 lớp bạn đang dạy · 8 học viên". Bên phải tiêu đề: liên kết chữ "Báo cáo tháng" (không viền, 44px cao), KHÔNG tô nền để nhường nút chính.
2. **Nút chính của màn: "Tạo lớp mới" (đề xuất mới)**, hàng riêng rộng hết khung, 44px, nền `--kin-nhan-nen`. Chỉ hiện khi gia sư đã có lớp; khi chưa có lớp nút chính là "Tạo lớp đầu tiên" nằm trong trạng thái rỗng (mục 6). Lý do: hôm nay gia sư có từ 1 lớp trở lên KHÔNG có lối "tạo lớp" nào ở màn Lớp (chỉ trạng thái rỗng có nút). Lưu ý: đặt ở đầu trang trái với ghi chú "Tránh" của Sổ Gia Sư ở mục 10 (nút chính nằm trên cùng, xa tay cái); vị trí cuối cùng do mục 12 câu 1 chốt. Nút này là liên kết, không đổi luồng tạo lớp.
3. **Khối "Các lớp đang dạy"**: nhãn nhỏ xám. Dưới đó danh sách phẳng, MỖI LỚP BA DÒNG, ngăn bằng đường kẻ `--kin-vien-nhat` 1px, khoảng cách dọc 12px, không có khung thẻ, không nền:
   - Dòng 1: chấm màu lớp 8px, tên lớp cỡ body đậm (cho phép xuống tối đa 2 dòng, không "…").
   - Dòng 2: chữ xám nhỏ một câu: `2/10 học viên · Toán · Đang nhận học viên`. Lớp đầy: `2/2 học viên · đã đầy · …`. Lớp đã đóng / tạm ngừng: đổi chữ trạng thái thành thẻ `KinStatus` tông trung tính "Đã đóng" hoặc "Tạm ngừng" (chấm + chữ, không chỉ màu). Lớp ẩn thêm "· đang ẩn".
   - Dòng 3: ba liên kết chữ cùng hàng, mỗi cái cao 44px: "Mở lớp" (màu `--kin-nhan-link`, đậm hơn), "Điểm danh", "Danh sách HS" (xám phụ). Chạm vào tên lớp cũng mở lớp.
4. Khi có từ 8 lớp trở lên (đề xuất mới, mục 12 câu 2): thêm một hàng pill lọc phía trên danh sách. Bảy lớp trở xuống KHÔNG có bộ lọc.
5. Không có thanh sĩ số, không có thẻ số liệu, không biểu đồ.

### 4.2 Danh sách lớp, máy tính 1280px

Cột nội dung `max-w-5xl` hiện tại (1024px) co về khoảng 720px căn trái so với thanh bên để dòng không kéo dài. Đầu trang một hàng: "Lớp" + dòng phụ bên trái; "Báo cáo tháng" (chữ) và "Tạo lớp mới" (đề xuất mới, nút chính) bên phải. Danh sách vẫn MỘT cột như điện thoại, nhưng dòng 2 và dòng 3 gộp thành một hàng: câu mô tả bên trái, ba liên kết căn phải. Không chia hai cột thẻ (ảnh `3-lop-truoc-khi-sua.jpg` cho thấy lưới hai cột làm tên bị cắt và nút chiếm nhiều chỗ hơn chữ).

### 4.3 Chi tiết lớp, điện thoại 390px

Hôm nay: tên lớp rồi bảy mục, trong đó ba mục chỉ là khối "Mở trang →". Đề xuất đảo thành "trang một lớp" cuộn dọc, một cột:

1. **Quay lại**: "← Lớp" → `/lop-cua-toi/lop` (đề xuất đổi đích, mục 12 câu 6). Dưới: chấm màu lớp + tên lớp (h1, tự xuống dòng) + một dòng xám `Toán · Đang nhận học viên`.
2. **Hai con số lớn cạnh nhau**, mỗi số một dòng nhãn nhỏ: "Học viên" (`2/10`) và "Buổi tới" (`T6 19:00`); dữ liệu thêm ở 3.7. Không thêm thẻ thứ ba (thoáng).
3. **Nút chính duy nhất: "Điểm danh"**, rộng hết khung, 44px → `/admin/khoa-hoc/{id}/diem-danh`.
4. **Danh sách "Việc của lớp"** dạng hàng phẳng 56px có mũi tên, đường kẻ mảnh: "Danh sách HS", "Mã mời", "Quản khoá", "Học phí", "Cộng đồng lớp". Hàng "Mã mời" mở rộng ngay trong trang (không chuyển trang) và hiện: mã đang dùng lớn, "Sao chép link", "Sao chép mã", rồi ô "Mời cả lớp một lần". Các nhãn giữ NGUYÊN chữ hiện có (mục 7). Khi mở rộng, hàng "Mã mời" vẫn phải chứa đủ: biểu mẫu "Tạo mã mời mới" (hai ô "Số lượt dùng tối đa", "Hiệu lực" và nút "Tạo mã mời"), danh sách mã kèm trạng thái và nút "Thu hồi", và khối "Mời cả lớp một lần" (các bài test ở 7.2 và 7.3 đi qua từng phần tử này); chỉ có thể gấp bớt, không được bỏ.
5. Mục "Tổng quan" hiện chỉ là câu chào ("Chào mừng đến hộp việc…") nên đề xuất bỏ nội dung đó, phần 2 và 3 phía trên đã đóng vai tổng quan; vẫn giữ nhãn "Tổng quan" nếu cần giữ bộ chuyển mục (mục 12 câu 8). Không test nào kiểm nhãn "Tổng quan" hay câu chào của trang một lớp (đã tìm trong `tools/local-e2e/`; "Tổng quan" ở `ui-tutor-shell.ts` là mục của bảng "Khác", trang khác).

### 4.4 Chi tiết lớp, máy tính 1280px

Giữ hai vùng như hôm nay (danh sách việc rộng 224px bên trái, nội dung bên phải, tối đa `max-w-6xl`) vì đó là cơ chế Outlook, nhưng nội dung bên phải mặc định là mục "Tổng quan" có thật, chỉ ba thứ để vẫn thoáng: hai con số + nút "Điểm danh" + một dòng khung giờ. KHÔNG vẽ khối "5 học viên đầu tiên" (bản trước có): nó đưa tên học viên, có thể dưới 16 tuổi, lên một trang chưa từng hiện họ và cần truy vấn mới; chỉ làm nếu chủ dự án đồng ý ở mục 12 câu 3. Danh sách việc bên trái: chữ + icon nét mảnh thay emoji (đề xuất; liên quan test mục 7), mục đang chọn tô `--kin-nen-nhan` + vạch trái `--kin-nhan-diem` như hiện tại.

### 4.5 Tạo lớp (ngăn kéo)

Ngăn kéo phải, rộng `min(540px, 100vw)` (điện thoại: phủ kín). Giữ NGUYÊN cơ chế mở/đóng: Esc, bấm nền mờ, nút "×".

**Chế độ gia sư, thứ tự từ trên xuống:**
1. Đầu ngăn kéo cố định: "×", tiêu đề "Tạo khoá học mới", hai nút "Huỷ" và "Tạo khoá học" (nút chính, 44px; hôm nay chỉ cao khoảng 32px).
2. Một ô lớn duy nhất: nhãn "Tên khoá học" + dấu `*` đỏ, ô gõ 48px, placeholder "VD: ĐGNL HSA — Trọn gói lộ trình" (giữ vì test), dòng gợi ý xám nhỏ bên dưới. Con trỏ nằm sẵn trong ô.
3. Ba ô còn lại mà gia sư thật sự đổi: Ngày khai giảng, Giá bán (đ), Số bài học, xếp dưới một tiêu đề nhỏ "Tuỳ chọn". KHÔNG gấp (luôn thấy ngay khi mở ngăn kéo), mỗi ô giữ nguyên nhãn "(tuỳ chọn · mặc định …)". Ba nhãn này PHẢI nằm trong chữ nhìn thấy khi mở (test mục 7.1 đếm đúng 3).
4. Một dòng gấp "Hiển thị công khai" (đề xuất mới) chứa phần chỉ dành cho khoá bán công khai: Slug, Ảnh nền, Danh mục, Gia sư, Giá gốc, Số giờ học, Nhãn, công tắc "Hiển thị trên website", Preview. Đóng sẵn. (Gia sư mới không cần ảnh nền hay nhãn HOT/SALE để có lớp đầu tiên.) Khối này không được chứa chuỗi "tuỳ chọn · mặc định" (mọi nhãn trong đó hiện chỉ ghi "(tuỳ chọn)" hoặc không ghi gì), và chỉ áp cho gia sư: quản trị trung tâm giữ nguyên 4 dấu `*` và không có khối gấp.
5. Không thêm bước, không thêm màn: NC2-029 đã chốt "KHÔNG làm màn 'Tạo lớp' mới".

**Chế độ quản trị trung tâm:** giữ nguyên toàn bộ như hôm nay (4 dấu `*`).

### 4.6 Trang quản khoá của lớp vừa tạo

Gia sư rơi vào đây ngay sau khi tạo, tab "Lịch học" mở sẵn. Giữ khung hiện tại: đường dẫn "Bảng điều khiển / Danh sách khoá học / {tên}", nút "Mở lớp" 44px bên phải đầu trang, bốn tab "Cài đặt", "Danh sách chương bài", "Lịch học", "Học viên đăng ký". Đề xuất cho gia sư: nút "Mở lớp" là hành động chính (đang là nút duy nhất tô đặc, giữ); tab "Danh sách chương bài" là thứ gia sư dạy kèm hầu như không dùng, đặt cuối. Khung giờ hiện dạng hàng phẳng: chip thứ + "19:00 – 20:30" + liên kết "Link vào lớp" + "Tắt/Bật" + "Xoá"; trạng thái rỗng giữ câu "Chưa có khung giờ học nào — học viên sẽ không thấy buổi học nào trong lịch cho tới khi thêm." kèm nút "+ Thêm khung giờ".

### 4.7 Điểm danh

Điện thoại: một cột. (1) "Điểm danh" + ô "Ngày" cùng hàng. (2) Dòng thu gọn "Bảng tháng 10/2026:" với ba liên kết xuất, đưa xuống cuối trang (việc hiếm). Nhóm này phải luôn hiện, kể cả khi ngày đang chọn chưa có buổi hoặc đang tải (hôm nay nó nằm ngoài khối điều kiện của buổi; bài `ui-attendance-export.ts` mở `?date=2026-07-05`, ngày không có buổi, và vẫn chờ thấy nhóm này), và giữ `role="group"` tên "Xuất bảng điểm danh tháng {mm/yyyy}". (3) Dải năm số đếm rút xuống một dòng chữ: "Có mặt 1 · Muộn 1 · Có phép 0 · Vắng 0 · Chưa điểm danh 0" (hôm nay là lưới 2 cột × 5 ô). (4) Mỗi học viên MỘT hàng hai tầng: tên + "Mã HS"; dưới là bốn nút trạng thái 44px chia đều (không có hệ số × trên điện thoại; hệ số chỉ hiện ≥ `sm`, như hôm nay). Ràng buộc test (7.5): tên em và bốn nút phải nằm CÙNG trong một `div.flex.items-center.gap-3` (bài chọn hàng bằng `div.flex.items-center.gap-3` + `hasText` rồi `.last()`); đừng lồng thêm một `div` cùng ba lớp CSS đó chỉ chứa tên, vì `.last()` sẽ chọn nhầm nó và các nút nằm ngoài. Nhãn truy cập của nút giữ dạng bắt đầu bằng "Có mặt" / "Muộn" / "Có phép" / "Vắng". Nút đang chọn tô đặc kèm chữ (màu: xanh = Có mặt, vàng = Muộn, xám = Có phép, đỏ = Vắng; chữ luôn hiện). (5) Thanh dính đáy: "{n} thay đổi chưa lưu" / "Đã lưu tất cả" bên trái, "Lưu điểm danh" (nút chính) bên phải. (6) "Nhắn phụ huynh" của từng em chỉ hiện sau khi lưu trạng thái của em đó (quy tắc hiện tại), đặt dưới tên em, chữ liên kết. "Nhắn nhóm Zalo lớp" hôm nay LUÔN hiện nhưng khoá cho tới khi mọi em đã điểm danh và đã lưu, kèm một dòng giải thích; thiết kế được phép gom nó xuống chân trang, không đổi điều kiện bật.
Máy tính: giới hạn rộng 720px, bốn nút trạng thái cùng hàng với tên (như hôm nay).

### 4.8 Danh sách học sinh

Điện thoại: bỏ "thẻ có viền" mỗi em (hôm nay mỗi em một thẻ có viền, gồm avatar, tên, email, SĐT, trường, thanh tiến độ, ngày ghi danh). Đề xuất hàng phẳng hai dòng: dòng 1 tên (đậm) + chip trạng thái bằng chữ nếu không phải "Đang học"; dòng 2 SĐT liên kết `tel:` (44px, SĐT này là thứ trang đã hiện từ hôm nay, không thêm trường mới) và ngày ghi danh. Email, trường: thu vào khi bấm hàng. Việc có nên giấu luôn SĐT em ở dòng 2 hay không thuộc mục 12 câu 10. Bỏ cột/thanh "Tiến độ" khi `totalLessons = 0` (mục 9). Máy tính: bảng 5 cột (Học sinh, SĐT, Trường, Trạng thái, Ghi danh), email thu vào hàng mở rộng.

---

## 5. Hành động

| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| "Báo cáo tháng" | mở báo cáo tháng | liên kết → `/lop-cua-toi/bao-cao-thang` | chỉ gia sư |
| "Tạo lớp đầu tiên" | mở ngăn kéo tạo lớp | liên kết → `/admin/khoa-hoc?tao=1` | chỉ hiện khi `classes.length === 0`; test mục 7 |
| "Tạo lớp mới" **(đề xuất mới)** | như trên, cho gia sư đã có lớp | liên kết → `/admin/khoa-hoc?tao=1` | chữ chưa có trong mã |
| (tên lớp) / "Mở lớp" | mở chi tiết lớp | `/lop-cua-toi/{id}` | 404 nếu không phải chủ lớp (không lộ lớp tồn tại) |
| "Điểm danh" | mở trang điểm danh | `/admin/khoa-hoc/{id}/diem-danh` | nằm trong vỏ gia sư, thanh bên "Lớp" sáng |
| "Danh sách HS" | mở danh sách học sinh | `/admin/khoa-hoc/{id}/hoc-vien` | API `/api/courses/{id}/students` cần `MANAGE_COURSES` và `ownsResource` (403 "Bạn không có quyền với khóa học này") |
| "×" (không có chữ) | đóng ngăn kéo | không gọi API | Esc và bấm nền mờ cũng đóng; chưa lưu thì mất |
| "Huỷ" (ngăn kéo) | đóng ngăn kéo | không gọi API | |
| "Tạo khoá học" | tạo lớp | `POST /api/courses` (`api.courses.create`) rồi `router.push('/admin/khoa-hoc/{slug}?tab=lich-hoc&moi=1')` | nút đổi chữ "Đang lưu..." khi đang gửi; lỗi hiện toast `Lỗi tạo khoá học: {lỗi máy chủ}` (có ảnh: `Upload ảnh hoặc tạo khoá học thất bại: {lỗi}`); máy chủ kiểm giá/bài/giờ cho vai gia sư (NC2-035); slug trùng 409 |
| "Chọn hoặc kéo-thả ảnh (JPG, PNG, WebP)" | chọn ảnh nền | chỉ giữ file, tải Cloudinary lúc bấm "Tạo khoá học" | |
| "+ Thêm khung giờ" | mở form khung giờ | `POST /api/courses/{id}/class-schedules` khi "Lưu khung giờ" | form mặc định Thứ 2 (`dayOfWeek: 1`), 19:00 đến 21:00 |
| "Lưu khung giờ" / "Huỷ" | lưu / bỏ | `api.classSchedules.create` | lỗi hiện đỏ tại chỗ: "Thêm khung giờ thất bại" |
| "Tắt" / "Bật" (khung giờ) | đổi `active` | `PUT /api/class-schedules/{id}` | lỗi "Cập nhật thất bại" |
| "Xoá" (khung giờ) | hỏi "Xoá khung giờ học này?" / "Việc này không hoàn tác được." rồi xoá | `DELETE /api/class-schedules/{id}` | lỗi "Xoá thất bại" |
| "Mở lớp" (trang quản khoá) | sang trang lớp | `/lop-cua-toi/{id}` | chỉ hiện với gia sư chủ lớp |
| "Mở lớp (mã mời, học viên)" | như trên, trong menu "···" của danh sách khoá | `/lop-cua-toi/{id}` | chỉ gia sư |
| (mục) "Tổng quan" / "Điểm danh" / "Danh sách HS" / "Quản khoá" / "Mã mời" / "Cộng đồng lớp" / "Học phí" | đổi nội dung panel phải (điện thoại: chọn trong `<select>`) | trạng thái cục bộ `useState`, không đổi URL | |
| "Mở trang →" | mở trang đích của mục | `/admin/khoa-hoc/{id}/diem-danh`, `/admin/khoa-hoc/{id}/hoc-vien`, `/admin/khoa-hoc/{id}`, `/lop-cua-toi/kiem-duyet`, `/lop-cua-toi/hoc-phi` | "Cộng đồng lớp" và "Học phí" mở trang CỦA CẢ TÀI KHOẢN, không riêng lớp |
| "Tạo mã mời" | tạo mã | `POST /api/courses/{id}/invites` `{maxUses?, expiresAt?}` | "Số lượt dùng phải là số nguyên dương"; "Số ngày hiệu lực từ 1 đến 365"; thành công "Đã tạo mã {code}."; 201; ghi nhật ký `class_invite.create` |
| "Sao chép link" | chép `{origin}/student/nhap-ma-lop?code={code}` | clipboard | "Đã sao chép link mời." / "Không sao chép được." |
| "Sao chép mã" | chép mã | clipboard | "Đã sao chép mã." |
| "Thu hồi" | mở hộp xác nhận "Thu hồi mã {code}?" | `DELETE /api/invites/{id}` khi bấm "Thu hồi" trong hộp | message "Mã này sẽ không dùng được nữa. Học viên đã vào lớp bằng mã vẫn ở trong lớp."; nút "Đóng"; thành công "Đã thu hồi mã {code}." |
| "Tạo mã mời và soạn tin" | tạo MỘT mã cho cả danh sách đã dán | `POST /api/courses/{id}/invites` `{maxUses: số em, expiresAt: +14 ngày}` | nút khoá khi còn dòng lỗi; số điện thoại phụ huynh KHÔNG gửi lên máy chủ |
| "Mở Zalo" / "Mở lại" | mở chat Zalo của phụ huynh với tin soạn sẵn | `openZalo` (ngoài KiN), đánh dấu cục bộ "Đã mở Zalo lúc {HH:mm}" | KiN chỉ biết đã MỞ Zalo, không biết tin đã gửi |
| "Chép tin" | chép tin của đúng em đó | clipboard | không đánh dấu "đã mở Zalo" |
| "Sao chép link chung" | chép link mời chung | clipboard | |
| "Làm đợt mới" | xoá danh sách vừa dán | không API | còn phụ huynh chưa mở Zalo thì hỏi "Làm đợt mới?" với nút "Ở lại" / "Làm đợt mới" |
| "Tạo buổi điểm danh" | tạo buổi cho ngày đang chọn | `POST /api/courses/{id}/attendance-sessions` `{date}` | 409 "Buổi điểm danh cho ngày này đã tồn tại"; toast "Đã tạo buổi điểm danh" |
| "Có mặt" / "Muộn" / "Có phép" / "Vắng" | chọn trạng thái từng em (cục bộ, chưa lưu) | không API | |
| "Lưu điểm danh" | lưu các em đã sửa | `PUT /api/attendance-sessions/{id}` `{records}` (tối đa 500) | "Đã lưu {n} học viên"; "Chưa có thay đổi để lưu"; vắng/có phép tự trả buổi bù; KHÔNG ảnh hưởng tiền ("Vắng không trừ tiền") |
| "Nhắn phụ huynh" | mở hộp "Nhắn phụ huynh — {tên em}" soạn sẵn | khi "Mở Zalo": `POST /api/attendance-sessions/{id}/zalo` `{userId}` | chỉ hiện sau khi ĐÃ LƯU trạng thái của em đó; tin có tên em (chat riêng); "KiN không gửi giúp: bạn tự bấm gửi trong Zalo." |
| "Nhắn nhóm Zalo lớp" | hộp tin chung vào nhóm | `openZalo` | chỉ bật khi mọi em đã điểm danh và đã lưu; tin chung KHÔNG nêu tên em nào |
| "Tải CSV" / "Tải Excel" / "In / Lưu PDF" | xuất bảng điểm danh cả tháng | `GET /api/courses/{id}/attendance-export?month=YYYY-MM&format=csv|xlsx`; `/admin/khoa-hoc/{id}/diem-danh/in?month=...` | CSV có BOM UTF-8 |
| (ô) "Tìm tên, email, SĐT…" | lọc danh sách học sinh | lọc phía trình duyệt | |
| "← Về trang lớp" (roster) | quay lại | `/admin/khoa-hoc/{id}` (trang quản khoá, KHÔNG phải trang lớp) | nhãn và đích lệch nhau, mục 9 |

---

## 6. Trạng thái

### 6.1 Danh sách lớp

| Trạng thái | Hiện gì (chữ chính xác) |
|---|---|
| Đang tải | `src/app/lop-cua-toi/(tutor)/loading.tsx`: `aria-busy="true"`, `aria-label="Đang tải"`, khung xương `.kin-skel` (3 ô số, 2 hàng, 2 thẻ). Đây là khung xương của TRANG CHỦ gia sư, không khớp hình dáng danh sách mới: nên thay bằng 3 hàng ba dòng đúng chiều cao thật (bo-cuc-outlook.md mục 5: "không dùng vòng xoay") |
| Rỗng (chưa có lớp) | "Bạn chưa mở lớp nào" (đậm) + "Tạo lớp đầu tiên, rồi gửi mã mời cho học viên để vào lớp." + nút "Tạo lớp đầu tiên" |
| Lỗi tải | không có màn riêng: `src/app/error.tsx` hiện "Có lỗi xảy ra", "Trang gặp sự cố không mong muốn. Thử tải lại hoặc quay về trang chủ.", nút "Thử lại" |
| Bình thường | danh sách như 3.1 |
| Đặc biệt | lớp đã đầy: "· đã đầy"; lớp đóng / tạm ngừng: "Đã đóng" / "Tạm ngừng"; lớp ẩn: "· đang ẩn"; lớp chưa có học viên: "0 học viên"; quyền: học sinh bị đẩy về `/lop-cua-toi`, khách về `/dang-nhap?redirect=/lop-cua-toi/lop` |

### 6.2 Chi tiết lớp

| Trạng thái | Hiện gì |
|---|---|
| Đang tải | trang là server component và KHÔNG có `loading.tsx` riêng (nằm ngoài nhóm `(tutor)`); giữa các lần chuyển trang không có khung chờ |
| Lớp không tồn tại hoặc không thuộc mình | `notFound()` → `src/app/not-found.tsx` |
| Mã mời đang tải | khối xương cao 80px (`aria-busy`), đang nháy nhẹ |
| Mã mời rỗng | "Chưa có mã mời nào. Tạo mã rồi gửi cho học viên." |
| Mã mời lỗi | "Không tải được danh sách mã mời." + nút gạch chân "Thử lại" (`role="alert"`) |
| Mời cả lớp: ô trống | nút "Tạo mã mời và soạn tin" khoá, không có dòng "em hợp lệ" |
| Mời cả lớp: có dòng lỗi | "{n} em hợp lệ[ · bỏ {k} dòng trùng]" + từng lỗi `Dòng {n}: {lý do} (“{dòng}”)`, tối đa 8 dòng rồi "… và {n} dòng lỗi khác" |
| Mời cả lớp: đã tạo | "Đã tạo mã cho {n} em" + mã, "Chưa mở Zalo" → "Đã mở Zalo lúc {HH:mm}", ghi chú `role="note"`: "Số điện thoại phụ huynh chỉ nằm trên trình duyệt này. KiN không lưu. …" |

### 6.3 Tạo lớp

| Trạng thái | Hiện gì |
|---|---|
| Mặc định | ngăn kéo hiện; chưa gõ → bấm "Tạo khoá học" hiện lỗi đỏ "Tên khoá học không được để trống" và cuộn tới ô đó |
| Đang lưu | nút chuyển "Đang lưu..." và khoá |
| Lỗi | toast `Lỗi tạo khoá học: …` (slug trùng, mã trùng trang cố định, giá/bài/giờ quá trần) |
| Thành công | đóng ngăn kéo, chuyển sang `/admin/khoa-hoc/{slug}?tab=lich-hoc&moi=1`, toast "Đã tạo khoá học mới" |
| Trang quản khoá: đang tải | vòng quay xanh + "Đang tải khoá học..." (hôm nay là vòng xoay; bo-cuc-outlook.md đề nghị khung xương) |
| Trang quản khoá: lỗi / không phải của mình | "Không tìm thấy khoá học" hoặc "Bạn không có quyền với khoá học này" + liên kết "← Quay lại danh sách" |
| Khung giờ rỗng | "Chưa có khung giờ học nào — học viên sẽ không thấy buổi học nào trong lịch cho tới khi thêm." |

### 6.4 Điểm danh và danh sách học sinh

| Trạng thái | Hiện gì |
|---|---|
| Điểm danh đang tải | "Đang tải..." |
| Chưa có buổi cho ngày đó | "Chưa có buổi điểm danh cho ngày này." + "Tạo buổi điểm danh" (đang tạo: "Đang tạo...") |
| Lớp chưa có học viên | "Lớp chưa có học viên active." (chữ "active" là tiếng Anh, mục 9) |
| Có thay đổi chưa lưu | "{n} thay đổi chưa lưu"; "Đã lưu tất cả" khi không có |
| Lỗi | toast "Không tải được danh sách buổi", "Không tạo được buổi", "Lưu thất bại", "Không mở được Zalo. Hãy chép tin và gửi tay." |
| Học sinh đang tải | "Đang tải danh sách…" |
| Học sinh rỗng | "Chưa có em nào ghi danh." |
| Học sinh tìm không ra | "Không tìm thấy em nào khớp." |

---

## 7. Chữ bắt buộc giữ nguyên

Các bài test giao diện kiểm bằng `getByRole`/`getByText`/`getByLabel`, bộ chọn CSS hoặc đếm. Đổi chữ hoặc đổi vai (role) là làm đỏ bài. Nếu thiết kế muốn đổi, phải ghi vào mục 12 và sửa test cùng lúc.

### 7.1 `tools/local-e2e/ui-journey-new-tutor.ts` (NC2-021/029, đo "lớp đầu tiên")
- Lịch rỗng: "Tuần này chưa có buổi học nào"; chữ "trang quản khoá" CÓ và "trong trang lớp" KHÔNG; liên kết "Xem các lớp của tôi".
- `/lop-cua-toi/lop` rỗng: URL `/lop-cua-toi/lop`; chữ "Bạn chưa mở lớp nào"; liên kết "Tạo lớp đầu tiên".
- Ngăn kéo: URL thành `/admin/khoa-hoc`; `getByRole("heading", { name: "Tạo khoá học mới" })`; **vùng chứa chọn bằng `div.fixed.right-0`** (hai lớp CSS `fixed` và `right-0` trên phần tử gốc ngăn kéo; phải khớp ĐÚNG MỘT phần tử trên trang, vì bài gọi `innerText()` trên locator đó và thêm một `div.fixed.right-0` khác sẽ báo lỗi strict mode); placeholder "VD: ĐGNL HSA — Trọn gói lộ trình"; nút "Tạo khoá học".
- Chữ "tuỳ chọn · mặc định" xuất hiện ĐÚNG 3 LẦN trong chữ nhìn thấy (innerText) của ngăn kéo gia sư (Ngày khai giảng, Giá bán, Số bài học). Ô nằm trong khối gấp ẩn (display:none) KHÔNG được tính.
- Sau tạo: URL `/admin/khoa-hoc/{id}` với `tab=lich-hoc`; chữ "Đã tạo khoá học mới"; lớp lưu `price 0`, `lessons 0`, `openDate` = hôm nay `dd/mm/yyyy`, `ownerId` = gia sư.
- Trang quản khoá: nút "+ Thêm khung giờ"; vùng `div.rounded-xl` chứa chữ "Giờ bắt đầu" và "Link vào lớp"; `select` đầu tiên là Thứ; hai `input[type="time"]`; nút "Lưu khung giờ"; chữ "19:00" hiện sau khi lưu.
- Nút "Mở lớp" (`getByRole("link", { name: "Mở lớp", exact: true })`) có ĐÚNG 1 phần tử, `href = /lop-cua-toi/{id}`.
- Trang lớp: `getByRole("button", { name: "Mã mời", exact: true })`; `getByLabel("Danh sách em và số phụ huynh")`; vùng tóm tắt `[id$='-sum']` chứa "3 em hợp lệ"; nút "Tạo mã mời và soạn tin"; `getByTestId("bulk-code")`; `getByRole("list", { name: "Phụ huynh cần nhắn" })` có 3 mục.
- Quản trị: ở `/admin/khoa-hoc`, hàng có nút "···", menu có liên kết `/^Mở lớp/` (đúng 1, `href = /lop-cua-toi/{id}`); ngăn kéo của quản trị có đúng 4 `label span.text-red-500` (dấu `*`), không có "tuỳ chọn · mặc định", bấm trống báo đủ "không được để trống", "Chọn ngày khai giảng", "Giá bán phải là số dương", "Số bài học phải là số".
- Ngưỡng MỀM (chỉ in, không làm đỏ): "lớp đầu tiên" ≤ 3 màn, ≤ 120 giây máy, màn tạo lớp ≤ 3 ô bắt buộc.
- Bài này chạy ở khung 1280×900 (mặc định của `ctxFor`), nên `getByRole("button", { name: "Mã mời", exact: true })` tìm nút ở danh sách việc bên trái của trang lớp; tên truy cập phải đúng "Mã mời" (emoji trang trí phải `aria-hidden`).

### 7.1b `tools/local-e2e/ui-course-moi.ts` (NC2-035)
- Mở `/admin/khoa-hoc/{id}?tab=lich-hoc&moi=1`: chữ "Đã tạo khoá học mới" hiện; `moi=1` bị xoá khỏi URL, vẫn giữ `tab=lich-hoc`; tải lại thì KHÔNG hiện lại. Đổi chữ "khoá học" thành "lớp" cho gia sư (mục 12 câu 5) phải sửa cả bài này.

### 7.2 `tools/local-e2e/ui-tutor-dash.ts` (danh sách lớp trên Tổng quan, dùng chung `TutorClassList`, và Mã mời)
- Các kiểm tra danh sách lớp chạy ở `/lop-cua-toi/tong-quan` (Tổng quan, dùng chung `TutorClassList`), KHÔNG phải ở `/lop-cua-toi/lop`; sửa `TutorClassList` là đổi cả hai trang. Với lớp Toán 9 sức chứa 2 (2 em đang học và 1 em `pending_consent`, em chờ không tính vào sĩ số) và lớp Lý 9 đã đóng: `getByText("2/2").first()` thấy; **`getByText(/đã đầy/)` (chữ thường, phân biệt hoa thường, KHÔNG có `.first()` nên phải khớp ĐÚNG 1 phần tử)**; `getByText(/Lý 9/).first()`; `getByText(/Đã đóng/).first()` (chữ Đ hoa).
- `getByRole("link", { name: "Điểm danh" })` đếm ĐÚNG 2 với 2 lớp. Playwright so tên theo chuỗi con, không phân biệt hoa thường, nên không được có thêm liên kết nào khác mà tên chứa "điểm danh" trên trang đó (kể cả `aria-label`).
- Rỗng: "Bạn chưa mở lớp nào"; liên kết "Tạo lớp đầu tiên"; bấm vào thì tới `/admin/khoa-hoc` và thấy heading "Tạo khoá học mới".
- Tab mã mời trong `/lop-cua-toi/{id}`: `getByRole("button", { name: /Mã mời/ }).first()`; chữ "Tạo mã mời mới"; "Chưa có mã mời nào."; nhãn `/Số lượt dùng tối đa/` và `/Hiệu lực/`; nút "Tạo mã mời" (**exact**, vì có nút "Tạo mã mời và soạn tin"); "Đã tạo mã"; "Đang dùng được"; `/Đã dùng 0\/2 lượt/`; nút "Sao chép link" → "Đã sao chép link mời."; link bằng `/student/nhap-ma-lop?code={mã}`; nút "Thu hồi" rồi nút "Thu hồi" trong `role=dialog`; "Đã thu hồi mã"; trạng thái "Đã thu hồi" (exact); mục `getByRole("button", { name: /Cộng đồng lớp/ })`.
- Điện thoại 390px: các đường `/lop-cua-toi`, `/lop-cua-toi/tong-quan`, `/lop-cua-toi/{id}` không tràn ngang.

### 7.3 `tools/local-e2e/ui-bulk-invite.ts` và `t-bulk-invite-lib.ts`
- `getByRole("button", { name: "Mã mời", exact: true })`, `getByLabel("Danh sách em và số phụ huynh")`, `[id$='-sum']` với "1 em hợp lệ", "Dòng 2:", "đang có 7", "Dòng 4:", "3 em hợp lệ", "bỏ 1 dòng trùng"; nút "Tạo mã mời và soạn tin"; `getByTestId("bulk-code")`; danh sách "Phụ huynh cần nhắn"; "Chưa mở Zalo" ×3; `getByRole("note")` chứa "chỉ nằm trên trình duyệt này", "KiN không lưu", "không biết tin đã được gửi"; nút `/^Mở Zalo cho phụ huynh Bảo Châu/` → `/^Mở lại Zalo cho phụ huynh Bảo Châu/`; `/^Chép tin cho phụ huynh/`; "Đã mở Zalo lúc HH:mm"; "Làm đợt mới" → `role=dialog` chứa "Còn 2 phụ huynh chưa mở Zalo", nút "Ở lại"; sau tải lại "Đã dùng 0/3 lượt".
- Tin chép phải chứa "đây là Cô Lan", tên em, tên lớp, link `…/student/nhap-ma-lop?code={mã}`, mã; KHÔNG chứa số điện thoại. Trang KHÔNG được chứa tên em hay số phụ huynh sau khi tải lại (kể cả `localStorage`/`sessionStorage`).
- Điện thoại: `mp.locator("select").first().selectOption({ label: "🔗 Mã mời" })`, tức `<select>` đầu tiên của trang có tuỳ chọn tên chính xác "🔗 Mã mời" (emoji + dấu cách + nhãn); nút `/^Mở Zalo cho phụ huynh/` cao ≥ 44px; không tràn ngang.

### 7.4 `tools/local-e2e/ui-tutor-shell.ts`, `ui-tutor-admin.ts`
- Thanh module có đúng sáu mục theo thứ tự "Hộp việc", "Lịch", "Lớp", "Bài KT", "Thư viện", "Học phí" (+ "Khác"); điện thoại 7 nút, mỗi nút cao và rộng ≥ 44px.
- `/admin/khoa-hoc/{id}/hoc-vien` và `/admin/khoa-hoc/{id}/diem-danh` PHẢI ở trong vỏ gia sư với "Lớp" `aria-current="page"` (`TutorShell.tsx`, `isUnder(pathname, "/admin/khoa-hoc")`). Đừng đổi các đường dẫn này.
- Hộp việc: dòng "Em Chờ" (chờ phụ huynh) trỏ tới `/admin/khoa-hoc/{id}/hoc-vien`.

### 7.5 `tools/local-e2e/ui-attendance-zalo.ts`, `ui-attendance-export.ts`
- Zalo: heading "Điểm danh"; nút "Tạo buổi điểm danh"; **hàng học viên chọn bằng `div.flex.items-center.gap-3` + `hasText` rồi `.last()`, và các nút trạng thái / "Nhắn phụ huynh" phải là con cháu của đúng phần tử đó**; nút `/^Vắng/`, `/^Có mặt/`, `/^Có phép/`; "Lưu điểm danh"; `/Đã lưu 1 học viên/`; "1 thay đổi chưa lưu"; nút `/Nhắn phụ huynh của Em An/` (có `aria-label` "Nhắn phụ huynh của {tên} qua Zalo"); `role=dialog`, nhãn "Tin nhắn (sửa được trước khi gửi)"; tin mẫu `Buổi Toán 9 {dd}/{mm} của con Em An: Vắng.`; "Sẽ mở Zalo của 0901234567 (Hoa)"; "KiN không gửi giúp"; "Chưa có số điện thoại phụ huynh"; nút "Mở Zalo", "Đóng"; "Đã mở Zalo lúc HH:MM ngày dd/mm"; không có chữ "đã gửi". Nút "Nhắn phụ huynh" cao ≥ 44px ở 390px.
- Xuất: nhóm `role=group` tên "Xuất bảng điểm danh tháng 09/2026" (phải hiện cả ở ngày chưa có buổi, bài mở `?date=2026-07-05` rồi chờ nhóm "… tháng 07/2026"); liên kết "Tải CSV", "Tải Excel", "In / Lưu PDF" (bài đo chiều cao ≥ 44px ở 390px chỉ với "Tải CSV"; href đúng `attendance-export?month=…&format=csv|xlsx`); trang in: heading level 1 "Bảng điểm danh tháng"; nút "In / Lưu thành PDF".

### 7.6 Quét chung
- `t-no-hex.ts`: không mã hex viết cứng trong `src/**/*.tsx|ts|css`, trừ `kin-tokens.css`, `kin-site.css` và bộ chọn màu nhãn khoá học (`admin/khoa-hoc/page.tsx`). Mọi màu đi qua `--kin-*`.
- `ui-theme.ts` (mục "Gia sư, chế độ Tối"): `/lop-cua-toi/lop` không được có chữ khó đọc (tương phản thấp) hay mảng nền trắng ở chế độ tối.
- `ui-tutor-everything.ts`, `ui-links-everywhere.ts`: quét liên kết; `/admin/khoa-hoc/{id}?tab=chuong-bai|lich-hoc|hoc-vien` phải mở được; gia sư vào lớp của người khác phải thấy "không có quyền" và KHÔNG thấy "Lưu thay đổi" / "Học viên đăng ký".
- `t-todo-lib.ts`: việc "unmarked" của `buildTodoItems` (danh sách "Việc cần làm" ở Tổng quan) trỏ `href === "/lop-cua-toi/lop"`. Hộp việc dùng `buildInboxItems` và có bài riêng (`t-tutor-inbox.ts`, `t-tutor-inbox-lib.ts`): dòng "chờ phụ huynh" trỏ `/admin/khoa-hoc/{id}/hoc-vien`.
- `ui-tutor-everything.ts` còn kiểm cô lập: các trang `/lop-cua-toi`, `/lop-cua-toi/lop`… của gia sư này không được chứa tên lớp, kế hoạch, đề thi của gia sư khác.
- `t-invites.ts` (API): tạo mã trả 201 và `code` dài 8; không đăng nhập 401; gia sư khác lớp 403; thu hồi trả `{ ok: true }`.
- `ui-invite-input.ts` (phía học viên, chỉ để biết đích của link mời): trang `/student/nhap-ma-lop` có ô "Mã mời lớp", nút "Vào lớp này", nút "Không phải lớp của tôi".

---

## 8. Quy tắc cứng phải giữ

1. **Tiền:** màn này không hiện và không tính tiền. Điểm danh không đổi tiền ("Vắng không trừ tiền. Hệ số dùng cho chuyên cần.", `diem-danh/page.tsx`, `unmarkedSessions.ts`). Tiền chốt vào sự kiện, không đọc lại từ cha (CLAUDE-cho-kho-trien-khai.md mục 5). KiN không giữ học phí (mục 1). Nếu thiết kế thêm số tiền, dùng đúng `480.000đ`, và phải dừng hỏi người (mục 9 câu 3).
2. **Trẻ em dưới 16 tuổi** (CLAUDE-cho-kho-trien-khai.md mục 8, 9): học viên có thể dưới 16. Không thêm ô thu thập dữ liệu cá nhân của em; không THÊM trường nào của em hay phụ huynh lên danh sách (danh sách học sinh hôm nay đã hiện email, SĐT, trường của em, và thiết kế chỉ được giữ nguyên hoặc bớt đi, xem mục 12 câu 10; SĐT phụ huynh chỉ là thứ gia sư tự dán, nằm trong bộ nhớ trình duyệt và không lưu). Ghi danh `pending_consent` gọi là "Chờ phụ huynh xác nhận" và không được tính vào sĩ số (chỉ `active` mới tính). Tin Zalo vào nhóm KHÔNG nêu em nào vắng.
3. **Token `--kin-*`:** không mã hex, không thêm màu ngoài bộ (`kin-tokens.css`; BRIEF.md). Chữ cần 4,5:1, chấm và viền cần 3:1: dùng hai bộ mã `--kin-tt-chu-*` cho chữ và `--kin-tt-cham-*` cho chấm (`tuong-phan.md`, `Status.tsx`). Màu không bao giờ nói một mình: mọi trạng thái có chữ.
4. **Nút chạm ≥ 44px:** `--kin-cham-toi-thieu`. Kiểm bằng test ở 390px (mục 7).
5. **Thông báo không tên, không số tiền**: `src/lib/pushRules.ts` đặt luật này cho thông báo ĐẨY (màn hình khoá không được hiện tên em hay số tiền). Các toast của cụm này hôm nay cũng chỉ nêu số lượng ("Đã lưu {n} học viên") hoặc mã lớp ("Đã tạo mã {code}."), không nêu tên em; thiết kế mới giữ đúng tinh thần đó (đây là thói quen hiện có, không phải luật của `pushRules.ts`).
6. **Ngày giờ giờ Việt Nam, định dạng 24 giờ, `dd/mm`:** dùng `vnDateKeyOf`, `hmOf`, `vnMinutesOfDay` (`src/lib/classSessions.ts`). Ngày điểm danh mặc định hôm nay hiện lấy giờ MÁY (mục 9).
7. **Không dựng màn Coin / mua gói cho học sinh** (BRIEF.md; quyết định 26/09 bỏ Coin khỏi phạm vi, CLAUDE-cho-kho-trien-khai.md mục 0).
8. **Không dựng màn "Tạo lớp" mới:** NC2-029 chốt giữ ngăn kéo hiện có (`tien-do-dang-do.md`, dòng "NC2-029"): chỉ Tên bắt buộc, tạo xong tự mở trang quản khoá tab "Lịch học".
9. **Tên sản phẩm là KiN** ở mọi chữ người dùng thấy (CLAUDE.md). Hôm nay menu "···" của danh sách khoá còn liên kết "Xem portal học viên" tới `midnightelite-edu.com`; đừng chép tên miền đó vào thiết kế.
10. **Mỗi vai một giọng:** gia sư đọc "lớp", "học viên", "Danh sách HS"; không dùng chữ dành cho phụ huynh. Học sinh không thấy mã mời, danh sách lớp của gia sư, hay trang điểm danh.
11. **Thao tác ghi dữ liệu không được kẹt ở "Đang lưu…"** (CLAUDE-cho-kho-trien-khai.md mục 5): mọi nút gửi phải có `finally` trả nút về bình thường và báo lỗi bằng chữ.
12. **Quyền:** gia sư chỉ thấy và sửa lớp của mình (`ownsResource`); lớp của người khác phải trả 404 hoặc 403, không lộ nội dung.

---

## 9. Điều đáng chưa tốt ở bản hiện tại

Dựa trên mã và ảnh trong `anh-hien-trang/` (ảnh 3 là bản cũ trước khi sửa; ảnh 6 là Tổng quan sau khi sửa).

1. **Màn Lớp không có lối "tạo lớp" khi đã có từ 1 lớp.** `TutorClassList.tsx` chỉ đặt nút "Tạo lớp đầu tiên" trong trạng thái rỗng; `lop/page.tsx` chỉ có "Báo cáo tháng". Gia sư có lớp rồi muốn thêm lớp phải đi vòng qua `/admin/khoa-hoc` (trang quản trị, bảng 8 cột `min-w-[800px]`, tiêu đề "Danh sách khoá học", "Quản lý toàn bộ khoá học trong hệ thống").
2. **Đường tới Lớp quá sâu với gia sư mới.** Chế độ gọn ẩn module "Lớp"; chỉ còn nút "Xem các lớp của tôi" ở Lịch rỗng. NC2-029 đo vẫn 8 route cho G2 đến G4 (vượt ngưỡng 3).
3. **Chi tiết lớp là một trung tâm liên kết, không phải chi tiết.** Bảy mục, trong đó năm mục chỉ là khối tiêu đề + 1 câu + "Mở trang →"; mục "Tổng quan" chỉ có câu "Chào mừng đến hộp việc của {tên}. Danh sách việc bên trái…" (chữ lấy từ thiết kế Hộp việc, sai ngữ cảnh khi đã ở trong một lớp). Không có sĩ số, không có buổi tới, không có trạng thái.
4. **"Cộng đồng lớp" và "Học phí" trong trang của MỘT lớp mở trang của CẢ tài khoản** (`/lop-cua-toi/kiem-duyet`, `/lop-cua-toi/hoc-phi`), dễ khiến gia sư tưởng đang xem dữ liệu riêng lớp.
5. **Liên kết quay lại sai đích:** "← Lớp của tôi" trong trang chi tiết đi `/lop-cua-toi` (Hộp việc, hoặc Lịch khi Hộp việc tắt), không về danh sách lớp. Trang học sinh "← Về trang lớp" đi `/admin/khoa-hoc/{id}` (trang quản khoá, vẫn không phải trang lớp).
6. **Emoji làm icon** ("📋", "✅", "👥", "⚙️", "🔗", "🛡️", "💰") trong `OutlookShell.tsx`, lệch với bộ icon còn lại của KiN và hiển thị khác nhau giữa máy.
7. **Chạm nhỏ hơn 44px** (tính theo lớp CSS, chưa đo): `<select>` chọn mục trên điện thoại (`py-2 text-sm`, khoảng 38px), liên kết "Mở trang →" (`py-2 text-sm`, khoảng 36px), nút "Huỷ" và "Tạo khoá học" trong ngăn kéo (`py-1.5`, khoảng 32px), nút "×" đóng ngăn kéo (`w-8 h-8` = 32px), nút "Tắt"/"Bật"/"Xoá" khung giờ (`py-1`).
8. **Ngăn kéo tạo lớp của gia sư vẫn dài** dù chỉ bắt buộc 1 ô: ngoài Tên còn 13 ô/khối (Slug, Ảnh nền, Danh mục, Gia sư, Ngày khai giảng, Giá bán, Giá gốc, Số bài học, Số giờ học, Nhãn, Màu nhãn, công tắc "Hiển thị trên website", Preview). Giá trị mặc định không dành cho gia sư dạy kèm: Danh mục "ĐGNL HSA", Gia sư "KiN". Có dòng "⚠ Chưa cấu hình Cloudinary" (thông báo cho lập trình viên) hiện với gia sư. Ngăn kéo mở trên một trang quản trị có bảng phía sau.
9. **Chữ "khoá học" lẫn "lớp".** Gia sư thấy "Tạo khoá học mới", "Tạo khoá học", "Danh sách khoá học", "Đã tạo khoá học mới", ở mọi nơi khác là "lớp". Mã lớp (slug) là toàn hệ thống: hai gia sư cùng đặt "Toán 9" sẽ đụng lỗi 409, và thông báo nói chuyện "slug".
10. **Danh sách học sinh:** (a) hiện cả em `pending_consent` và `suspended` mà không có chữ trạng thái, nên "{n} em trong lớp" khác với sĩ số "{m} học viên" ở danh sách lớp; (b) cột/thanh "Tiến độ" luôn là "0/0 (0%)" với lớp dạy kèm không có bài học: thanh rộng 0% và chữ "0/0 (0%)" không mang thông tin nào (mã vẫn tô đỏ phần thanh vì dưới 40% là "chậm", nhưng độ rộng 0% nên gần như không thấy đỏ; vấn đề thật là cột vô nghĩa chứ không phải màu); (c) hiện email, SĐT, trường của học viên (có thể dưới 16 tuổi) ngay trên danh sách; (d) mã nguồn chú thích "mở Zalo PH" nhưng trang không có nút Zalo; (e) mỗi em là một thẻ có viền trên điện thoại.
11. **Điểm danh:** lưới 5 ô đếm (hai cột trên điện thoại) và hộp Zalo nhóm + thanh xuất 3 nút chiếm nhiều chỗ phía trên danh sách em; ngày mặc định lấy giờ máy (`todayISO()` dùng `new Date()` cục bộ) chứ không phải giờ VN; chữ "Lớp chưa có học viên active." còn tiếng Anh.
12. **Màu lớp chỉ có 5 token, chọn bằng băm id** (`classColor.ts`): với 7 lớp chắc chắn có lớp trùng màu, và gia sư không tự chọn được màu (Sổ Gia Sư cho chọn 25 màu).
13. **Khung chờ lệch:** `(tutor)/loading.tsx` có hình dạng của Trang chủ gia sư (3 ô số, 2 thẻ lớn) nhưng được dùng cả cho `/lop-cua-toi/lop`.
14. **Định dạng ngày không thống nhất:** `toLocaleDateString("vi-VN")` cho "5/11/2026" (không có số 0 đầu) ở mã mời và danh sách học sinh, trong khi điểm danh dùng "dd/mm".
15. **Danh sách "Việc cần làm" ở Tổng quan dẫn về Lớp nhưng Lớp không nói gì:** "Yêu cầu xác nhận của phụ huynh đang chờ", "Bài tự luận / bài nộp chưa chấm" và "Buổi đã qua giờ, chưa điểm danh xong" đều có `href: "/lop-cua-toi/lop"` (`buildTodoItems` trong `tutorTodo.ts`, chỉ `TutorDashboard.tsx` dùng) mà trang không có dấu hiệu nào của ba việc đó. Hộp việc (`/lop-cua-toi`) KHÔNG mắc lỗi này: nó dùng `tutorInbox.ts` và dẫn thẳng tới `/admin/khoa-hoc/{id}/hoc-vien`, `/admin/khoa-hoc/{id}` hoặc `/admin/khoa-hoc/{id}/diem-danh?date=…`.

---

## 10. Mẫu học từ đối thủ

Không chép bố cục desktop cứng (sidebar cắt, hai cột chật). Mỗi dòng: mẫu - sản phẩm - ảnh. Ảnh Sổ Gia Sư nằm ở `anh-tham-khao-so-gia-su/`; ảnh khác ở `/tmp/rs/x/word/media/` (thư mục TẠM của máy này, đã kiểm còn đủ 14 tệp hôm 22/10/2026 nhưng có thể mất khi khởi động lại; muốn giữ lâu thì chép vào `anh-tham-khao-so-gia-su/`).

- Đầu lớp tóm tắt bằng chip ngắn (hình thức, số buổi, số học sinh) thay cho đoạn văn - Sổ Gia Sư - `03-chi-tiet-lop.jpg` (= `486587a87c9cf408f22b3a976fe6c4637aca565b.jpg`).
- Buổi học nhóm theo "Tuần này / Tuần sau / 2 tuần sau", mỗi dòng ngày chữ đầy đủ + chip trạng thái + giờ - Sổ Gia Sư - `03-chi-tiet-lop.jpg`.
- Học sinh là một khối riêng, mỗi em có chip "Đang học", ngày vào lớp và nút nhỏ - Sổ Gia Sư - `03-chi-tiet-lop.jpg`. (Tránh: cột phải hẹp làm tên bị cắt "Học sinh TE…", nhiều nút nhỏ sát nhau.)
- Hành động phá huỷ (Kết thúc, Xoá) gom vào "Vùng nguy hiểm" nền hồng cuối trang, tách khỏi nút thường - Sổ Gia Sư - `03-chi-tiet-lop.jpg`.
- Tạo lớp: Tên lớp bắt buộc có dấu `*`, thanh tiến trình 1-2-3, nút "Tiếp tục" đặc ở góc phải dưới, "Quay lại" viền bên trái - Sổ Gia Sư - `06-tao-lop-buoc-1.jpg`. Chỉ lấy ý "ít ô, một nút chính"; KiN KHÔNG làm wizard (NC2-029).
- Trường không sửa được hiển thị thành chip chỉ đọc trong hộp thoại sửa lớp - Sổ Gia Sư - `6b52ce727cedff44871209528dcc4e37ca0ff7aa.jpg`. (Tránh: hộp thoại hẹp, nên dùng ngăn kéo hoặc bottom sheet trên điện thoại.)
- Chọn thứ học bằng chip T2 đến CN bật/tắt, nút cuối ghi rõ kết quả "Tạo lớp + 8 buổi" - Sổ Gia Sư - `cdbd1f37e6dfeba21fafa2b8f1e2de818f4e4c13.jpg`. (Tránh: bước 3 quá nhiều khối; ý dùng cho tab "Lịch học" của KiN.)
- Danh sách lớp: ô tìm theo tên + lọc trạng thái cùng một hàng, nút chính góc phải - Sổ Gia Sư - `d69ebba7dac189589b71c8e9030a3656118a943a.jpg`. (Tránh: ảnh trắng trơn khi chưa có lớp, không có trạng thái rỗng; nút chính nằm trên cùng, xa tay cái trên điện thoại.)
- Lọc nhanh bằng ba pill "Lớp của bạn / Lớp đang chờ / Lớp đã ẩn", pill đang chọn tô đậm - Shub Classroom - `b03b9eb482a1574f2f36a5bcfd692df399b7768a.jpg`. (Tránh: bảng nhiều cột đếm số, trạng thái rỗng chiếm gần hết màn.)
- Nhập mã bằng 5 ô gạch chân trên một thẻ giữa, một nút xanh rộng hết khung, liên kết "Quay lại" ngay dưới - Shub - `ef4f8038b465603058d2a661fcdee6a6d3aaf7c0.jpg` (phía học viên, dùng làm tham chiếu cho trang đích của link mời).
- Danh sách học sinh: avatar chữ cái + chip "Hoạt động" cạnh tên, một dòng đếm "1 Hoạt động" trên bảng - TutorBird - `32187a31c8ca32001e251a1452862e21e1762f9c.jpg`. (Tránh: bảng 8+ cột cuộn ngang trên điện thoại.)
- Hồ sơ học sinh: tiêu đề thẻ + tab ngang chia nhóm; cảnh báo vàng đặt ngay chỗ thiếu thông tin thay cho lỗi chung - TutorBird - `1cd39a2be6add5be756928d8b3f1bcb2c0cacc67.jpg`. (Tránh: sáu tab tràn màn hình nhỏ.)
- Nút "Điểm danh" đặc, rộng hết đáy thẻ buổi học, hành động chính duy nhất - TutorBird - `190a8682fab03bdafb01deeecedca00f8884048a.jpg`. (Tránh: icon thao tác không nhãn.)
- Điểm danh bằng ba nút một chạm Có mặt / Vắng / Có phép, "Có mặt" đậm nhất; hàng tóm tắt ba số có màu; banner "đã chốt" kèm nút "Mở lại" - Sổ Gia Sư - `07-chi-tiet-buoi-hoc.jpg` (= `ecaca8dc6ca9739a7b7b6681fd11e2af3f25bc8a.jpg`). (Tránh: hộp hướng dẫn ba gạch đầu dòng chiếm chỗ trên cùng, nhiều ô ghi chú lặp, nút Lưu xám nhỏ ở cuối.)
- Chi tiết học sinh: số tiền cam lớn nhất thẻ, nút "Đã thu tiền" xanh lá ngay chân thẻ - Sổ Gia Sư - `b1ba0bf850d734ce50f09f14db3330bb2df741b6.jpg`. Chỉ dùng ý "một con số lớn"; việc tiền ở màn Học phí.
- Danh sách học sinh: tìm theo tên, SĐT hoặc phụ huynh trong MỘT ô, lọc "Đang học" mặc định - Sổ Gia Sư - `08-hoc-sinh.jpg` (= `1c5d46fe36336ebccb292b7f4c8fd34d9d0e74ae.jpg`). (Tránh: vùng trống không có trạng thái rỗng/đang tải.)
- Form học sinh nhóm trường theo khối có đầu tiêu đề nền nhạt ("Thông tin gia đình" / "Thông tin sinh viên") - Teachworks - `017e218f119d77fbcf67cd91420e88be33ecf976.jpg` và `ef8b370b47b7c76656c1215758d9a4b77ce2616c.jpg`. (Tránh: rất nhiều ô cùng lúc, "điện thoại nhà" ít dùng ở Việt Nam; KiN chỉ cần tên, lớp, số Zalo.)

---

## 11. Dữ liệu mẫu để điền vào thiết kế

Tên học viên là tên mẫu để vẽ, không phải người thật. Gia sư: Cô Lan (`giasu@kin.local`), 7 lớp, 8 học viên đang học, đã thu tháng 10: 480.000đ. Các số tiền trong mục này (480.000đ, 560.000đ) chỉ để đối chiếu chéo với màn Học phí: KHÔNG vẽ chúng trên màn Lớp, danh sách học sinh hay điểm danh (mục 8.1). Trạng thái "Tạm ngừng", "đã đầy", sức chứa của từng lớp và danh mục viết hoa ở dưới là MINH HOẠ để vẽ đủ trạng thái: ảnh hiện trạng (dữ liệu giả của máy dev) cho Toán 8 là "Đang nhận học viên", danh mục viết thường ("toán"), tên lớp có đuôi như "(dữ liệu giả)".

1. Lời chào / ngày: "Chào buổi chiều, Cô Lan · Thứ Năm 22/10/2026". Đầu màn Lớp: "Lớp", "7 lớp bạn đang dạy · 8 học viên".
2. Lớp, theo thứ tự mới nhất trước: **Toán 8** · 0 học viên · Toán · Tạm ngừng.
3. **Toán 7** · 1 học viên · Toán · Đang nhận học viên.
4. **Văn 8** · 0 học viên · Văn · Đang nhận học viên.
5. **Sinh 8** · 2/2 học viên · đã đầy · Sinh · Đang nhận học viên.
6. **Hoá 8** · 2/8 học viên · Hoá · Đang nhận học viên.
7. **Lý 9** · 2 học viên · Lý · Đã đóng.
8. **Toán 9** · 2/10 học viên · Toán · Đang nhận học viên. Học viên: Trần Gia Bảo (đã đóng 480.000đ) và Đỗ Hà (phiếu nháp 560.000đ). Trần Gia Bảo cũng học Lý 9, nên 9 lượt ghi danh nhưng 8 học viên khác nhau. Sáu em còn lại: Lê Minh, Phạm Khánh An, Nguyễn Bảo Ngọc, Vũ Minh Khôi, Hoàng Thu Trang, Bùi Quang Huy.
9. Buổi sắp tới của Toán 9: Thứ Sáu 23/10 19:00 – 20:30 (2 học viên). Buổi của Văn 8: Thứ Bảy 24/10 16:00 – 17:30.
10. Mã mời của Toán 9: "7KQ4M2XD", "Đang dùng được", "Đã dùng 1/3 lượt · hết hạn 5/11/2026 · tạo 22/10/2026". Link: `/student/nhap-ma-lop?code=7KQ4M2XD`. Dán mời cả lớp (đúng chữ gợi ý trong ô): "Minh Anh, 0912 345 678" và "Quốc Huy, 0987 654 321".
11. Điểm danh Toán 9, ngày 23/10: Trần Gia Bảo "Có mặt", Đỗ Hà "Muộn", thanh dưới "1 thay đổi chưa lưu"; sau khi lưu "Đã lưu 2 học viên".
12. Tạo lớp đầu tiên (gia sư mới, một lớp khác để minh hoạ): Tên "Lý 8"; để trống ngày khai giảng, giá, số bài học; sau khi tạo: "Đã tạo khoá học mới", tab "Lịch học", khung giờ "Thứ 4 19:00 – 20:30". Trạng thái rỗng: "Bạn chưa mở lớp nào" / "Tạo lớp đầu tiên, rồi gửi mã mời cho học viên để vào lớp."

---

## 12. Câu hỏi còn mở

Phân loại sau khi đối chiếu với mã và test (22/10/2026). CẦN chủ dự án quyết (đổi chữ có test, đổi phạm vi backend, dữ liệu của trẻ, thêm màu, đổi hành vi): câu 1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13. Có thể làm theo mặc định đã ghi mà không chờ (giữ lại để biết, chủ dự án đổi ý thì đổi): câu 2 (không bật bộ lọc khi dưới 8 lớp), 6 (đích "← Lớp" về `/lop-cua-toi/lop`, không test nào kiểm), 14 (thêm `(tutor)/lop/loading.tsx`, không test nào cản).

1. **Có thêm nút "Tạo lớp mới" ở màn Lớp khi đã có lớp không?** Hôm nay không có, và đây là chữ mới (không có trong mã hay test). Nếu CÓ, đặt ở đầu trang hay cuối danh sách? Chỉ cần liên kết tới `/admin/khoa-hoc?tao=1`.
2. **Có thêm ô tìm và lọc trạng thái khi nhiều lớp không?** Gia sư mục tiêu 1 đến 20 học viên có thể có 7 lớp nên chưa cần; ngưỡng bật (8 lớp?) do chủ dự án quyết.
3. **Chi tiết lớp có được phép lấy thêm dữ liệu không?** Hai con số (học viên/sức chứa, buổi tới) và số việc cần làm của lớp cần thêm truy vấn ở `[courseId]/page.tsx` (nguồn ở 3.7). Đó là việc backend nhỏ, nhưng NC2-021 ghi "Chỉ sửa chặn nhỏ; > 2 phút hoặc > 3 màn → viết đề xuất, không làm" (`nang-cap-lan-2.csv`). Chủ dự án có chấp nhận không? Kèm hai điều cần quyết riêng: (b) dùng `loadTutorSchedule` thì phải cắt bỏ `students` (có SĐT em và phụ huynh), xem 3.7; (c) khối "5 học viên đầu tiên" từng nằm trong 4.4 đã bị bỏ khỏi thiết kế, vì nó đưa TÊN học viên (có thể dưới 16 tuổi) lên một trang chưa từng hiện họ; CLAUDE-cho-kho-trien-khai.md mục 9 câu 3 yêu cầu dừng và hỏi người, nên chỉ thêm lại khi chủ dự án nói có.
4. **Ngăn kéo tạo lớp của gia sư có được gấp phần "công khai" lại không?** Bài `ui-journey-new-tutor.ts` đếm đúng 3 chuỗi "tuỳ chọn · mặc định" trong `innerText` của ngăn kéo. Gấp cả ba ô bằng `<details>` hoặc `display:none` sẽ đỏ bài (chữ ẩn không vào `innerText`). Riêng `KinFold` (`src/components/kin/Fold.tsx`, dùng lưới 0fr + `opacity:0`, không `display:none`) thì chữ trong khối đóng VẪN được đếm, bài không đỏ nhưng khi đó bài đếm chữ người dùng không thấy; đừng chọn `KinFold` chỉ để qua bài. Thiết kế ở 4.5 để ba ô ngoài khối gấp, chỉ gấp phần còn lại. Chủ dự án muốn gấp luôn cả ba (và sửa test) không?
5. **Đổi chữ "khoá học" thành "lớp" cho gia sư?** Cần đổi "Tạo khoá học mới", "Tạo khoá học", "Đã tạo khoá học mới", "Danh sách khoá học" và sửa `ui-journey-new-tutor.ts`, `ui-tutor-dash.ts`, `ui-course-moi.ts`. Ngăn kéo và trang quản khoá dùng chung với quản trị trung tâm, nên chữ mới chỉ áp cho gia sư (`adminRole === "teacher"`); đoạn bài `ui-journey-new-tutor.ts` kiểm vai quản trị vẫn tìm "Tạo khoá học mới" / "Tạo khoá học". Có làm trong đợt thiết kế này không?
6. **Đích của "← Lớp của tôi" trong trang chi tiết** nên là `/lop-cua-toi/lop` (danh sách lớp) hay giữ `/lop-cua-toi`? Không test nào kiểm; cần chủ dự án chốt.
7. **Giữ `<select>` chọn mục trên điện thoại hay đổi sang danh sách hàng?** `ui-bulk-invite.ts` chọn tuỳ chọn tên chính xác "🔗 Mã mời". Đổi icon emoji sang SVG cũng làm đỏ test này; cần sửa test và chốt cách thể hiện.
8. **Giữ bảy mục của chi tiết lớp hay rút còn ít hơn?** Hai nhãn bị test chạm trực tiếp (ở 1280px): "Mã mời" (role button, `exact`) và "Cộng đồng lớp" (`getByRole("button", { name: /Cộng đồng lớp/ })` ở `ui-tutor-dash.ts`); nhãn "Tổng quan" và câu chào không có test nào. Tách "Cộng đồng lớp" ra khỏi trang một lớp sẽ làm đỏ `ui-tutor-dash.ts`, phải sửa cùng lúc. "Cộng đồng lớp" và "Học phí" là trang của cả tài khoản; có nên tách ra khỏi trang một lớp không?
9. **Mặc định "Danh mục" = "ĐGNL HSA" và "Gia sư" = "KiN" cho lớp do gia sư tạo** (NC2-029f còn là đề xuất chưa làm): tự điền tên gia sư thật hay bỏ trống? Tên thật sẽ hiện trên thẻ lớp công khai và mâu thuẫn công tắc "Ẩn hồ sơ".
10. **Danh sách học sinh:** (a) có hiện chip trạng thái "Chờ phụ huynh xác nhận" / "Tạm dừng" không (nhãn đã có ở trang quản khoá, `ENROLLMENT_STATUS_LABEL`); (b) có bỏ cột "Tiến độ" khi lớp không có bài học không; (c) có thêm SĐT phụ huynh và nút Zalo không (dữ liệu có ở `User.parentPhone` nhưng API `/students` không trả; chạm dữ liệu cá nhân của trẻ, CLAUDE-cho-kho-trien-khai.md mục 9 yêu cầu dừng và hỏi người; chưa có trả lời thì KHÔNG làm); (d) giữ hay giấu SĐT, email, trường của em ở danh sách (hôm nay hiện cả ba; 4.8 chỉ thu email và trường vào hàng mở rộng, vẫn để SĐT ở dòng 2).
11. **Màu lớp:** 5 token cho 7 lớp luôn trùng màu. Mở rộng bằng token sẵn có (`--kin-th-navy`, `--kin-th-vang-doanh-nghiep`, `--kin-ph-lms`…) hay cho gia sư chọn màu như Sổ Gia Sư? Mỗi lựa chọn cần quyết định riêng vì không được thêm màu ngoài bộ.
12. **Danh sách "Việc cần làm" ở Tổng quan trỏ về `/lop-cua-toi/lop`** cho ba việc (chờ phụ huynh xác nhận, bài chưa chấm, buổi chưa điểm danh); Hộp việc thì đã dẫn đúng trang nên không thuộc câu này. Muốn màn Lớp hiện chấm "n việc" trên từng lớp (dữ liệu ở 3.7, cần truy vấn mới), hay đổi `href` của ba việc đó ở `buildTodoItems` tới trang đúng? Đổi `href` phải sửa `t-todo-lib.ts`.
13. **Ngày điểm danh mặc định:** đổi từ giờ máy sang giờ VN (quy tắc dự án) có thể làm đổi hành vi cho người đang ở múi giờ khác; chủ dự án xác nhận.
14. **Khung chờ (`loading.tsx`) riêng cho `/lop-cua-toi/lop`** thay vì dùng chung khung của Trang chủ: cần thêm tệp mới trong `(tutor)/lop/`; không test nào cản nhưng là thay đổi cấu trúc tệp.
