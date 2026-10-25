# KiN đã có gì, và nên đặt KiN ở đâu để giống một trung tâm dạy học

Soạn 23/10/2026. Chỉ đọc và viết tài liệu, không sửa `src/`. Đây là **bản nháp để Thọ chọn lọc**, không phải quyết định đã chốt.

**Câu hỏi của chủ dự án:** đọc toàn bộ tính năng đã có (nhất là phần dán link YouTube, tải tài liệu cho học sinh tải và xem thử, dán link bài làm Azota), chắt lọc cái hợp lý, để sản phẩm giống một trung tâm dạy học trọn vẹn: giáo viên, học sinh, phụ huynh, quản trị.

**Cách đọc dấu trong bảng**
- `[K]` = đã mở mã và kiểm lại ở lượt này.
- `[Đ]` = theo bản đọc mã của 6 mạng việc và tài liệu `docs/kin/`, chưa kiểm lại từng dòng.
- Phán định: **GIỮ** · **GIỮ+** (giữ và nâng cấp) · **GỘP** (hai chỗ làm một việc, nhập làm một) · **ẨN** (còn mã, bỏ khỏi giao diện chính) · **BỎ** · **?** (cần chủ dự án quyết).
- "Lớp" trong tài liệu này là `Course` trong schema. Lớp 1–20 học sinh của một gia sư là đơn vị thật của sản phẩm.

**Hai điều cần nói thẳng trước khi đọc tiếp**
1. Tài liệu bàn giao định nghĩa KiN là *"hạ tầng cho người dạy tự do 1–20 học viên"*, và *"KiN không giữ học phí"*. Chủ dự án giờ muốn *"giống một trung tâm dạy học luôn"*. Hai câu này **chưa mâu thuẫn** nếu hiểu "trung tâm" là một không gian làm việc của một gia sư hoặc một nhóm nhỏ. Nhưng trong schema (71 model) **không có thực thể Trung tâm/Tổ chức nào**; "trung tâm" hiện chỉ là nhóm `admin_super`/`admin_content` của nền tảng. Mục 2 đề xuất cách đi mà chưa phải dựng thực thể mới.
2. Khi dự án đụng **tiền** hoặc **trẻ dưới 16 tuổi**, quy tắc kho (`CLAUDE-cho-kho-trien-khai.md` mục 9) là dừng và hỏi người. Mục 6 gom lại những chỗ đó.

---

## 1. KiN đã có gì, theo vai

### 1.1 Gia sư / giáo viên (vỏ `/lop-cua-toi`, soạn nội dung ở `/admin/khoa-hoc`)

| Năng lực | Route / tệp | Phán định |
|---|---|---|
| Hộp việc (việc cần xử lý hôm nay, buổi chưa điểm danh) `[Đ]` | `/lop-cua-toi`, `components/tutor/HopViec.tsx` | **GIỮ**: đúng nhịp ngày của gia sư |
| Tổng quan, Lịch tuần, dời/huỷ buổi, gửi lịch tuần qua Zalo `[Đ]` | `/lop-cua-toi/tong-quan`, `/lich` | **GIỮ** |
| Lớp, mời vào lớp bằng mã, "mời cả lớp một lần" `[Đ]` | `/lop-cua-toi/lop`, `ClassInvites.tsx`, `BulkInvite.tsx` | **GIỮ**: cửa vào lớp duy nhất |
| Điểm danh + phụ huynh xác nhận + xuất tháng `[Đ]` | `/admin/khoa-hoc/[id]/diem-danh`, `attendanceExport.ts` | **GIỮ**: lõi nghiệp vụ, đã trả giá để có |
| Phiếu học phí theo tháng, VietQR, SePay tự gạch, gửi Zalo `[Đ]` | `/lop-cua-toi/hoc-phi`, `invoiceServer.ts`, webhook SePay | **GIỮ**: học phí đi thẳng gia sư, KiN không giữ tiền |
| Báo cáo tháng cho phụ huynh (Nỗ lực/Năng lực riêng, "Điều chưa đạt") `[Đ]` | `/lop-cua-toi/bao-cao-thang` | **GIỮ+**: thêm tiến độ học liệu (xem video, nộp bài) |
| Kế hoạch buổi (in phiếu học sinh không đáp án) `[Đ]` | `/lop-cua-toi/ke-hoach-buoi` | **GIỮ** |
| Hồ sơ công khai, bài đăng tìm học sinh, công tắc Hiện/Ẩn `[Đ]` | `/lop-cua-toi/ho-so`, `/bai-dang`, `/mentor/[id]` | **GIỮ**, nhưng là phần "tuyển sinh", đặt thứ yếu |
| Doanh thu của gia sư, Kiểm duyệt cộng đồng trong lớp `[Đ]` | `/lop-cua-toi/doanh-thu`, `/kiem-duyet` | **GIỮ** |
| **Giáo trình** Khoá > Phần > Chương > Bài `[K]` | `prisma Course/Section/Chapter/Lesson`; `/admin/khoa-hoc/[id]` (file ~2.380 dòng) | **GIỮ+**: xương sống học liệu, cần nhập hàng loạt, đồng bộ số bài |
| **Dán link YouTube làm video bài giảng** `[K]` | `Lesson.videoUrl`; phát bằng Plyr ở `student/bai-giang/[lessonId]` | **GIỮ+**: cách rẻ nhất, đúng ý chủ dự án; thiếu kiểm link khi lưu |
| **Tài liệu tải lên hoặc dán link Drive** `[K]` | `Lesson.documents` (JSON), `DocumentsEditor`, `lib/cloudinary.ts` | **GIỮ+**: thiếu giới hạn dung lượng/loại, thiếu quyền xem (mục 6) |
| **Link Azota + hạn nộp** `[K]` | `Lesson.azotaUrl`, `azotaDeadline` | **GIỮ+**: đúng thói quen thật, nhưng là ngõ cụt (KiN không biết em đã làm chưa) |
| Link Zoom/Live trong bài `[Đ]` | `Lesson.zoomUrl`; `ClassSchedule.joinUrl` | **GỘP**: lấy lịch lặp làm gốc, bài live chỉ trỏ tới |
| Bài tập tự nộp (file) + chấm điểm + nhận xét `[Đ]` | `Assignment`, `AssignmentSubmission`, `GradeSubmissionsModal` | **GIỮ**: đối trọng với Azota; thêm nộp bằng link |
| Bài tập làm trên web (trắc nghiệm/tự luận, lưu từng câu, AI trích từ tệp) `[Đ]` | `Assignment.mode="interactive"` | **GỘP** với đề thi về một kho câu hỏi (xem 3.2) |
| Đề thi thử, phòng thi có giám sát, chấm tự động, chữa bài `[Đ]` | `/admin/thi-thu`, `/student/thi-thu/[examId]`, `examGrading.ts` | **GIỮ**: tách khỏi "Nội dung" thành mục "Kiểm tra" |
| Ngân hàng câu hỏi (cây đầu mục, chống trùng 3 tầng) `[Đ]` | `/admin/thi-thu/ngan-hang-cau-hoi` | **GIỮ+**: mặc định "kho riêng của tôi"; chia sẻ/duyệt chỉ bật khi có nhóm |
| Ngân hàng đề (tệp PDF/Word gốc) + "Tách câu hỏi" bằng AI `[Đ]` | `/admin/thi-thu/ngan-hang-de-thi`, `ExamFile` | **GỘP** vào Thư viện của giáo viên |
| Ghi chú của giáo viên cho cả lớp trên mỗi bài `[K]` | `Lesson.adminNote` (học sinh thấy được) | **GIỮ**, đổi tên hiển thị thành "Lời nhắn của giáo viên" |
| Mời học sinh qua email/ nhắc hàng loạt `[Đ]` | `/api/admin/remind`, `remind-all` | **GIỮ+**: phải chọn theo lớp, không gửi toàn nền tảng |

### 1.2 Học sinh (vỏ `/student`)

| Năng lực | Route / tệp | Phán định |
|---|---|---|
| Việc của tôi (bài tập có hạn, buổi học 3 ngày tới, badge đỏ) `[K]` | `/student/viec-cua-toi`, `lib/studentTodo*.ts` | **GIỮ**: làm trang chủ học sinh |
| Lịch học (Thi thử, Deadline, Buổi học) `[K]` | `/student/lich-hoc`, `lib/studentSchedule.ts` | **GIỮ**; sửa lỗi hạn Azota không vào lịch (mục 7, điểm 6) |
| Lớp: cây Phần > Chương > Bài, % tiến độ, bài tiếp theo `[Đ]` | `/student/hoc-tap` | **GIỮ+**: cần màn danh sách lớp thật khi có nhiều lớp |
| Trang bài giảng: video Plyr, 3 tab Tài liệu/Bài tập/Ghi chú `[K]` | `student/bai-giang/[lessonId]/page.tsx` (~1.280 dòng) | **GIỮ+**: tách tệp, làm rõ từng tab |
| Xem trước tài liệu rồi mới tải (PDF, Office, Google Docs) `[K]` | `/xem-tai-lieu` | **GIỮ+**: siết kiểm đường dẫn, thêm xem ảnh/txt |
| Làm bài Azota (nút mở tab mới) `[K]` | `QuizContent`, `TabBaiTap` | **GIỮ+**: thêm "đánh dấu đã làm" và dán link/ảnh bài làm |
| Nộp bài tập file, làm bài tập web, xem điểm và nhận xét `[Đ]` | `AssignmentCard`, `InteractiveAssignmentCard` | **GIỮ** |
| Ghi chú cá nhân từng bài (đồng bộ thiết bị) `[K]` | `LessonNote`, `TabGhiChu` | **GIỮ**; thêm kiểm quyền vào bài |
| Tiến độ + tự hoàn thành khi xem ≥ 80% `[K]` | `LessonProgress`, `/api/progress` | **GIỮ+**: sửa lẫn "đang xem" và "đã xong", thêm xem tiếp |
| Vào lớp bằng mã mời (xem trước gia sư, lịch, học phí) `[Đ]` | `/student/nhap-ma-lop` | **GIỮ** |
| Thi thử + phòng thi + chữa bài + xem lại `[Đ]` | `/thi-thu`, `/student/thi-thu/[examId]` | **GIỮ** |
| Thư viện "Bản ghi và tài liệu" gom theo bài `[K]` | `/thu-vien`, `lib/libraryServer.ts` | **GỘP** vào tab trong trang Lớp (xem 3.1) |
| Hỏi đáp có thưởng Coin + Cộng đồng (bảng tin theo lớp) `[Đ]` | `/cong-dong`, `/api/questions` | **GỘP** hai hệ Thread và Question/Answer thành một khu "Hỏi đáp của lớp" |
| Bảng xếp hạng công khai + Bảng vinh danh + huy hiệu `[Đ]` | `/bang-xep-hang`, `honorData.ts` | **GIỮ+** nhưng đổi phạm vi: theo lớp, tên rút gọn, tuỳ chọn tham gia |
| Ví Coin: thưởng đăng ký, bài học, làm bài, đăng bài `[K]` | `/student/vi`, `quizReward.ts`, `LESSON_REWARD=3` | **?** Coin đã bị loại khỏi phạm vi (26/09) nhưng mã thưởng vẫn chạy; **ẨN** phần thưởng "bấm xong" |
| Đăng ký, đăng nhập (mật khẩu + mã 6 số), hồ sơ `[Đ]` | `/dang-ky`, `/dang-nhap`, `/student/ho-so` | **GIỮ**; thêm màn trống "Nhập mã lớp" cho học sinh mới |
| Khoá học đã lưu, giỏ hàng, đánh giá khoá `[Đ]` | `CartItem`, `/khoa-hoc-da-luu`, `CourseReview` | **ẨN**: dấu vết của mô hình bán khoá, không hợp mô hình lớp |
| Tin tức, Tra cứu, Điểm chuẩn trong vỏ học sinh `[Đ]` | `/student/tin-tuc`, `/student/tra-cuu` (chuyển sang khung khách) | **ẨN** khỏi menu "Khác"; thuộc truyền thông, không phải việc học |

### 1.3 Phụ huynh (không cần tài khoản, vào bằng link token)

| Năng lực | Route / tệp | Phán định |
|---|---|---|
| Sổ của con: chuyên cần, học phí, buổi sắp tới, báo cáo tháng đã duyệt `[K]` | `/so-cua-con/[token]`, `lib/parentPortal.ts` | **GIỮ+**: thêm "bài tập con đã nộp, điểm, bài Azota con chưa làm" |
| Phiếu học phí + QR + nút "Tôi đã chuyển" `[Đ]` | `/phieu/[token]` (hết hạn 30 ngày) | **GIỮ**; không đụng cách tính tiền |
| Báo nghỉ buổi, xác nhận điểm danh `[Đ]` | `absenceServer.ts` | **GIỮ** |
| Đồng ý của phụ huynh (`ParentConsent`, `ParentLink`) `[Đ]` | schema có, `pending_consent` chưa bật | **?** chờ luật sư (PH-225) |

### 1.4 Quản trị trung tâm (vỏ `/admin`, 4 module)

| Năng lực | Route / tệp | Phán định |
|---|---|---|
| Hàng chờ kiểm duyệt gộp (hồ sơ gia sư, báo cáo bài, câu trả lời) `[K]` | `/admin/kiem-duyet` | **GIỮ**: làm cửa chính duy nhất của việc duyệt |
| Duyệt gia sư: 3 lối vào (hàng chờ, trang riêng, tab trong Quản trị viên) `[Đ]` | `/admin/ho-so-gia-su` | **GỘP** về hàng chờ; trang riêng chỉ tra lịch sử |
| Quản trị viên / đổi vai / 3 vai (`admin_super`, `admin_content`, `teacher`) `[K]` | `lib/permissions.ts` | **GIỮ+**: đổi tên vai theo trung tâm; thêm trợ giảng/lễ tân khi cần |
| Hồ sơ học sinh, kích hoạt khoá, khoá/mở khoá, nhắc `[Đ]` | `/admin/hoc-sinh` | **GIỮ+**: chia theo lớp; xoá cứng nên thành ẩn/lưu trữ |
| Duyệt nạp Coin `[K]` | `/admin/topups` | **GIỮ+**: hiện **không có trong menu** (`adminNav.ts`), phải thêm lối vào hoặc vào hàng chờ |
| Doanh thu nền tảng (VIP gia sư), phễu gia sư, số đo sức khoẻ `[Đ]` | `/admin/doanh-thu`, `/pheu`, `/so-do` | **GIỮ**; số đo thêm đo học liệu |
| Cộng đồng, báo cáo bài, đánh giá khoá `[Đ]` | `/admin/cong-dong`, `/danh-gia` | **GỘP** vào hàng chờ; đánh giá khoá chưa có badge |
| Nhật ký thao tác (`AuditLog`) `[K]` | ghi ở nhiều route, **không có trang đọc** | **GIỮ+**: làm một trang đọc tối thiểu |
| Cron nhắc lịch học/thi, hết hạn VIP, push `[Đ]` | `vercel.json`, `/api/cron/*` | **GIỮ**; thêm trang "lần chạy gần nhất" |
| Tin tức & Blog, Điểm chuẩn, Bảng vinh danh `[Đ]` | `/admin/tin-tuc`, `/diem-chuan`, `/vinh-danh` | **GỘP** nhóm "Truyền thông"; Điểm chuẩn **ẨN** nếu không luyện thi |
| Trang mẫu `/admin/_template` `[K]` | `src/app/(admin)/admin/_template/page.tsx` | **BỎ** khỏi route (chuyển vào docs) |

### 1.5 Khách (chưa đăng nhập)

| Năng lực | Route / tệp | Phán định |
|---|---|---|
| Trang chủ, danh sách khoá, giới thiệu khoá có video giới thiệu `[Đ]` | `/`, `/khoa-hoc/[slug]` (`introVideo` nhúng YouTube) | **GIỮ**; có bài `isFree` xem thử |
| Danh sách gia sư + hồ sơ công khai `[Đ]` | `/giang-vien`, `/mentor/[id]` | **GIỮ** |
| Thi thử cho khách (xem danh sách, buộc đăng ký mới thi) `[Đ]` | `/thi-thu` | **GIỮ+**: gọn thành "link mời thi thử có hạn" |
| Thư viện công khai (chỉ tài liệu bài miễn phí) `[Đ]` | `/thu-vien` | **GỘP**: thành mục "Tài liệu miễn phí" ở trang giới thiệu khoá |
| Chính sách, điều khoản `[Đ]` | `/chinh-sach` | **GIỮ**; bản dự thảo rà điều khoản đã có, chưa ai duyệt |

---

## 2. Mô hình trung tâm dạy học: ai làm gì, chạy thế nào

### 2.1 Bốn vai và một đơn vị

| Vai | Làm gì trong "trung tâm" | Vào bằng |
|---|---|---|
| **Quản trị trung tâm** | Duyệt giáo viên, xem số đo, kiểm duyệt, doanh thu nền tảng | `admin.midnightelite-edu.com` |
| **Giáo viên / gia sư** | Mở lớp, soạn bài (video, tài liệu, bài tập), giao bài, điểm danh, chấm, thu học phí, báo cáo | `/lop-cua-toi` (vỏ gia sư) |
| **Học sinh** | Vào lớp bằng mã, học, làm bài, thi, hỏi đáp | `/student` |
| **Phụ huynh** | Xem sổ của con, đóng học phí, báo nghỉ | link token (không tài khoản) |

Đơn vị cốt lõi là **Lớp**. Mọi thứ khác (bài, bài tập, đề thi, lịch, phiếu học phí, thảo luận) treo vào Lớp.

### 2.2 Luồng từ đăng ký đến học phí (bằng chữ)

```
 [Khách]
   │ xem hồ sơ gia sư / trang lớp / bài miễn phí / thi thử
   ▼
 [Đăng ký học sinh]  ── (email + SĐT Zalo + số phụ huynh tuỳ chọn) ──► xác thực email
   │                                                           (chưa có: màn "nhập mã lớp")
   ▼
 [Nhập mã mời lớp]  ── xem trước lớp, lịch, học phí/buổi ──► Enrollment active
   │                      ▲ gia sư tạo mã / "mời cả lớp một lần"
   ▼
 [Trang Lớp của học sinh]
   ├─ Bài học ─► VIDEO (link YouTube)  +  TÀI LIỆU (xem trước, tải)  ─► tiến độ xem
   ├─ Bài tập ─► (a) Link AZOTA + hạn  hoặc  (b) bài tập tự nộp trên KiN (file / làm trên web)
   │                (a) hiện KiN không biết em đã làm  ◄── KHOẢNG TRỐNG LỚN NHẤT
   ├─ Kiểm tra ─► đề thi thử / phòng thi / chấm tự động / chữa bài
   └─ Hỏi đáp của lớp
   │
   ▼
 [Việc của tôi + Lịch]  gom: bài có hạn, buổi học sắp tới, đề thi        ◄ nhắc 07:00
   │
   ▼
 [Giáo viên]  điểm danh (phụ huynh xác nhận) + chấm bài + sổ điểm
   │
   ▼
 [Báo cáo tháng]  gia sư duyệt ─► phụ huynh đọc ở "Sổ của con"
   │
   ▼
 [Phiếu học phí]  tính từ số buổi đã chốt ─► VietQR ─► SePay tự gạch / "Tôi đã chuyển"
                  (tiền đi thẳng gia sư, KiN không giữ)
```

### 2.3 Cách đi cho chữ "trung tâm" mà chưa dựng thực thể mới
- Giữ nguyên: **một gia sư sở hữu nhiều lớp** (`Course.ownerId`). Trung tâm nhỏ = vài gia sư cùng một quản trị viên.
- Tên gọi trên giao diện: đổi `Khoá học` thành **`Lớp`** (người dạy thêm nói "lớp", không nói "khoá"). `Course.lessons/hours` là số quảng cáo tự đặt, nên ẩn đi hoặc tính từ bài thật.
- **Chưa dựng** bảng `Center/Organization`. Làm khi có yêu cầu thật (hai giáo viên cùng dạy một lớp = quyết định D02 đã hoãn; thu học phí cấp trung tâm = dính tiền). Cái giá của việc dựng sớm là phải gỡ dữ liệu nếu bỏ.
- Quản trị trung tâm hiện thấy cả nền tảng (số học sinh, nhắc hàng loạt toàn hệ thống). Cần giới hạn theo lớp trước khi nói "mỗi trung tâm một không gian riêng".

---

## 3. Chắt lọc

### 3.1 GIỮ (và nâng cấp), theo thứ tự đáng làm
1. **Giáo trình Khoá > Phần > Chương > Bài** + nhân bản lớp. Thêm nhập hàng loạt bài (dán danh sách tên và link). Tự tính số bài và thời lượng.
2. **Video bằng link YouTube.** Thêm kiểm link ngay khi gia sư dán (nhận ra watch/youtu.be/shorts/embed, cảnh báo nếu là Drive/Vimeo/Facebook), xem tiếp từ giây đã lưu (`watchedSeconds` đang ghi mà không đọc lại), gom MỘT hàm đọc YouTube dùng chung (hiện lặp ở hai trang).
3. **Tài liệu tải xuống và xem thử.** Giữ luồng "bấm tên, xem trước ở tab mới, rồi tải". Thêm giới hạn dung lượng/loại báo trước khi bấm Lưu, xem trước ảnh và `.txt`.
4. **Azota như một "loại bài giao hợp lệ"** (link + hạn nộp + học sinh bấm "Em đã làm xong, đây là link/ảnh bài làm"). Không làm thành cột phụ của đề thi.
5. **Việc của tôi, Lịch, Hộp việc, Điểm danh, Báo cáo tháng, Phiếu học phí, Sổ của con**: đây là phần KiN đã mạnh hơn mọi bên khác; không động vào cách tính.
6. **Phòng thi + chấm tự động + chữa bài.**

### 3.2 GỘP (hai chỗ cùng một việc → một chỗ)

| Hai chỗ đang tồn tại | Nhập thành | Vì sao |
|---|---|---|
| Link video + link Azota + link Zoom + tài liệu trong **một Drawer**, loại bài tự suy ra từ ô nào có link | Danh sách **mục nội dung** của bài: Video / Tài liệu / Bài tập (Azota hoặc tự nộp) / Buổi live, mỗi mục có kiểu rõ ràng | Hiện cột `azotaUrl` có thể là chuỗi hay JSON mảng; trang học sinh đưa nguyên vào `href` nên bài có 2 link bị hỏng `[K]` |
| **Thư viện** `/thu-vien` + **trang Lớp** `/student/hoc-tap` + **tab Tài liệu** trong bài + **Ngân hàng đề** (của giáo viên) | Một khu: tab **"Tài liệu & bản ghi"** trong trang Lớp của học sinh; **"Thư viện của tôi"** trong vỏ giáo viên | Bốn nơi cùng tên "thư viện/tài liệu", học sinh không biết tìm ở đâu |
| Link vào buổi live: `Lesson.zoomUrl` **và** `ClassSchedule.joinUrl` | Lấy **lịch lặp** làm gốc; bài live chỉ trỏ tới; sau buổi cho gắn link YouTube bản ghi vào đúng buổi | Hai nguồn link có thể khác nhau; thẻ "link hiện trước 15 phút" nhưng nút hiện ngay |
| Bài tập tự nộp (`Assignment` + `AssignmentQuestion`) **và** đề thi (`ExamQuestion`), hai kho câu hỏi song song | Một khung **"Bài giao"** (bài về nhà, kiểm tra 15 phút, thi thử) dùng chung kho câu hỏi; khác nhau ở hạn nộp và chế độ | Hiện bài tập web chỉ 2 loại câu, không chữa bài, không sửa câu sau khi tạo |
| Hỏi đáp có thưởng (`Question/Answer`) **và** Thread (category hỏi-đáp) | Một khu **"Hỏi đáp của lớp"**, gia sư trả lời được và đánh dấu đáp án đúng | Học sinh không biết hỏi ở đâu; hiện chỉ chủ câu hỏi chấp nhận đáp án |
| Duyệt gia sư ở 3 nơi; báo cáo bài viết ở 2 nơi | Chỉ **Hàng chờ kiểm duyệt**; trang riêng chỉ để tra lịch sử | Người mới không biết dùng cái nào |
| Hạn nộp: Azota (chuỗi) **và** Assignment (DateTime) | Một mô hình hạn duy nhất vào "Việc của tôi" + lịch | Hạn Azota hiện không vào lịch (mục 7) |
| Ghi nhận "đã làm Azota" (hiện không có) **và** bài nộp trên KiN | Cho phép `AssignmentSubmission` nhận **link** thay vì chỉ tệp (tận dụng chấm điểm và nhận xét có sẵn) | Không cần bảng mới; giáo viên khỏi theo dõi qua Zalo |

### 3.3 ẨN BỚT / BỎ (để giao diện thoáng)

| Đối tượng | Việc làm |
|---|---|
| `Lesson.isLocked` | **ẨN** ở giao diện soạn: API bỏ qua cờ này (đã ghi nhận), công tắc không làm gì; giữ `isFree` |
| `Lesson.statsViews/statsVideos/statsMaterials` | **BỎ** khỏi giao diện: không nơi nào cập nhật, luôn là 0 |
| Dòng chữ cứng "Đang theo dõi phiên học, Thiết bị 1/2", nhãn "Quiz — Xử lý số liệu" | **BỎ**: là chữ giả, vi phạm quy tắc không bịa số liệu |
| Giỏ hàng, khoá đã lưu, đánh giá khoá | **ẨN**: dấu vết mô hình bán khoá |
| Thưởng 3 xu khi bấm "Đánh dấu xong" | **ẨN**: thưởng cho bấm, không cần xem; Coin đã ra khỏi phạm vi (26/09). Giữ Knowledge Bounty của Hỏi đáp (đang chạy thật) |
| Tin tức/Tra cứu/Điểm chuẩn trong menu "Khác" của học sinh | **ẨN** khỏi vỏ học sinh |
| Phần thưởng huy hiệu hứa "hoàn học phí 10%", "mentor 1-1", "EXP x2" | **BỎ chữ hứa**: không có mã thực hiện; hoàn học phí còn dính tiền |
| `/admin/_template` | **BỎ** khỏi route |
| Phễu gia sư, Điểm chuẩn | **Thứ yếu**: là tuyển sinh/SEO, không phải vận hành lớp |

---

## 4. Vị trí trong giao diện mới

**Nguyên tắc: học liệu nằm trong LỚP, không rải khắp nơi.** Người dùng hỏi "video và tài liệu của lớp Toán 9 ở đâu?" thì câu trả lời là một: *vào lớp*.

### 4.1 Học sinh (4 mục dưới cùng + FAB không cần)

```
 Việc của tôi │ Lịch │ LỚP │ Thêm
```

**Trang Lớp** (mở danh sách lớp trước nếu học nhiều lớp, rồi vào một lớp) có các tab:

| Tab | Chứa | Thay cho |
|---|---|---|
| Bài học | Cây Phần > Chương > Bài, video, tiến độ, "bài tiếp theo" | `/student/hoc-tap`, `/student/bai-giang` |
| Tài liệu & bản ghi | Tài liệu tải/xem thử + bản ghi buổi live, lọc theo bài | `/thu-vien`, tab Tài liệu |
| Bài tập | Azota (link + "đã làm") + bài tập tự nộp + hạn | Tab Bài tập, QuizContent |
| Kiểm tra | Đề được giao cho lớp, kết quả, chữa bài | `/thi-thu` (danh sách chung) |
| Hỏi đáp | Thảo luận của riêng lớp | `/cong-dong` bảng chung |

"Thêm" chỉ còn: Hồ sơ, Học phí, Chủ đề màu, Nhập mã lớp, Điểm thưởng.

### 4.2 Giáo viên

```
 Hộp việc │ Lịch │ LỚP │ Học phí │ Thêm
```

Trong **mỗi lớp** (một trang, thay cho cả `/admin/khoa-hoc/[id]` 2.380 dòng): **Tổng quan · Giáo trình · Bài giao & chấm · Kiểm tra · Điểm danh · Học viên · Học phí · Báo cáo.**
- "Giáo trình" là nơi dán link YouTube, tải tài liệu, dán link Azota, **có nút "Xem như học sinh"** (xem trước đúng cái học sinh sẽ thấy).
- "Bài giao & chấm" gom cả chấm file, chấm tự luận, và bảng "ai đã làm Azota".
- "Thêm" chứa Thư viện của tôi (đề gốc, ngân hàng câu hỏi), Hồ sơ công khai, Bài đăng tìm học sinh, Doanh thu.

### 4.3 Quản trị trung tâm (4 module, đổi nội dung)

| Module | Trang |
|---|---|
| **Việc chờ** | Hàng chờ (gồm duyệt gia sư, báo cáo, đánh giá, **yêu cầu nạp Coin**) |
| **Con người** | Giáo viên, Học sinh (chia theo lớp), Nhân sự |
| **Học vụ** | Danh sách lớp, Kiểm tra, Ngân hàng câu hỏi |
| **Vận hành** | Tổng quan "hôm nay cần làm gì", Doanh thu, Số đo, Nhật ký, Cron, Truyền thông |

### 4.4 Phụ huynh
Giữ một trang "Sổ của con" (không tài khoản). Thêm một khối: **Bài tập tháng này** (đã nộp/chưa, điểm, bài Azota cô giao).

---

## 5. Khoảng trống lớn và việc nào dùng tự động hóa

| Khoảng trống | Hiện trạng | Đề xuất | Dính tiền/trẻ em? |
|---|---|---|---|
| **Video bản ghi TẢI LÊN** | KiN không lưu file video (ghi rõ ở Thư viện); chỉ dán link | **Giữ link làm chuẩn**: YouTube "không công khai" là rẻ nhất, không băng thông. Thêm nhận diện Drive/Vimeo; nếu muốn tải thẳng thì cần dịch vụ video (Cloudflare Stream, Mux) và tính chi phí theo giờ phát | **Có** (chi phí hạ tầng lên KiN hay gia sư?) → hỏi Thọ |
| **Tài liệu tải lên** | **Đã có** (Cloudinary, upload không ký, `secure_url`) | Thêm giới hạn dung lượng/loại báo trước; **không còn là "chưa có"** | Có, về quyền xem (mục 6) |
| **Up bài test** | **Đã có**: tải PDF/Word/ảnh vào Thi thử hoặc Bài tập web, AI trích câu (≤ 4MB, có thể quá 60s với đề dài); nhập bằng dán văn bản/CSV/XLSX | Tách "tạo nhanh" và "cài đặt nâng cao" trong drawer đề thi | — |
| **Học sinh dán link/ảnh bài làm Azota** | **Chưa có** | Cho `AssignmentSubmission` nhận link; gia sư thấy bảng "đã làm/chưa" | **Có**: ảnh bài làm của em dưới 16 (mục 6) |
| **Điểm Azota về KiN** | Không có (chưa kiểm chứng Azota có xuất điểm/API; không giả định) | Giáo viên nhập tay điểm, đánh nhãn "nhập tay" | — |
| **Thông báo học sinh khi bài được chấm** | Chưa có | Dùng `notify()` đã có | — |
| **Sổ điểm theo lớp** | Chưa có; có GPA 40/60 thiên về vinh danh | Một bảng điểm lớp: bài tập + kiểm tra + chuyên cần | — |

**Việc nào dùng tự động hóa được (làm thẳng, rủi ro thấp)**
1. Nhận diện loại link khi dán (YouTube/Drive/Azota/Zoom) và **gợi ý loại bài**, báo lỗi sớm.
2. Tự tính số bài, thời lượng lớp từ dữ liệu thật (bỏ số tự đặt).
3. Hạn Azota vào "Việc của tôi" và lịch (một chuẩn thời gian có múi giờ VN).
4. Nhắc 07:00 "bài Azota hôm nay hết hạn", dùng cron đã có.
5. Gợi ý tiến độ lên báo cáo tháng ("em đã xem 3/10 bài video, 2 bài Azota chưa làm").
6. Nhân bản lớp kèm **làm mới hạn** (hiện sao chép nguyên hạn cũ).
7. Tách câu hỏi từ tệp đề bằng AI (đã có), gợi ý (hint) bằng AI: để sau, đưa vào Coin/AI là việc dính tiền.

**Không tự động:** tính tiền, chốt điểm danh, gửi tin Zalo (chỉ "đã mở Zalo", không bao giờ "đã gửi"), duyệt gia sư, chạm dữ liệu trẻ em.

---

## 6. Rủi ro riêng

### 6.1 Tiền
- KiN **không giữ học phí**; phụ huynh chuyển thẳng gia sư. Muốn "như trung tâm" mà **thu học phí cấp trung tâm hoặc chia doanh thu** thì đổi vị thế sang trung gian thanh toán: dừng và hỏi luật sư.
- **Coin**: đã chốt 26/09 "ngoài phạm vi", nhưng mã thưởng bài học (3 xu), thưởng làm bài (5+5), thưởng bảng tin vẫn chạy. Cần Thọ chốt: giữ làm điểm thưởng học tập, hay ẩn. Nếu giữ, không đổi ra tiền/quà, không chuyển giữa tài khoản, tách ví gia sư (1 Coin = 1 đồng).
- Nạp Coin của gia sư và VIP: có cờ `KIN_TRIAL_MODE`, chưa bật ở Production. `/admin/topups` chưa có lối vào ở menu.
- Lời hứa thưởng "hoàn học phí 10%" trong huy hiệu: **bỏ chữ hứa**.
- Mật khẩu vào thi lưu chuỗi thô trong DB `[Đ]`: nên băm.

### 6.2 Trẻ dưới 16 tuổi (Nghị định 13/2023, luật sư chưa chốt: PH-225)
- **Video của học sinh** (bài nói, quay clip) và **ảnh bài làm/ảnh bài nộp** là dữ liệu cá nhân của trẻ. Hiện upload bài tập đi Cloudinary bằng link công khai. Không mở thêm "học sinh tải video/ảnh" cho tới khi có câu trả lời pháp lý.
- Form đăng ký **không hỏi ngày sinh**, nên chưa tính được tuổi; `pending_consent` chưa bật.
- **Bảng xếp hạng/vinh danh công khai** hiện ra tên thật và trường, không cần đăng nhập; không có ẩn danh. Đổi sang theo lớp, tên rút gọn, tuỳ chọn tham gia.
- **Cộng đồng/Hỏi đáp**: khách đọc được nội dung do trẻ viết; không có duyệt trước.
- Hồ sơ "Sổ của con" là link token 128 bit, không hết hạn; đã cân nhắc, ghi nhận.

### 6.3 Bản quyền tài liệu
- Gia sư tải SGK, đề của nhà xuất bản/bên thứ ba lên. KiN nên có **cam kết sở hữu/được phép dùng** khi tải lên và quy trình gỡ khi có khiếu nại (không đang có).
- Video YouTube của người khác: nhúng là ổn; **không tải lại**. Video riêng của gia sư để "không công khai" vẫn nghe được nếu lộ link.
- Ngân hàng câu hỏi dùng chung có thể chứa câu bản quyền: duyệt chỉ kiểm trùng, không kiểm nguồn.

### 6.4 Quyền xem: chỉ học viên đã ghi danh
Đã **kiểm mã** ở lượt này:
- `GET /api/courses/[id]` trả toàn bộ bài học, **kể cả `videoUrl`, `documents`, `azotaUrl`**, cho người không có quyền (khách). Mã chỉ đổi cờ `isLocked` khi có quyền, không xoá các trường nhạy cảm. Tài liệu `tien-do-dang-do.md` coi đây là lỗi nghiêm trọng; mã vẫn chưa xoá.
- Tài liệu là URL Cloudinary công khai, upload không ký: **ai có link là tải được**, ai biết tên cloud và preset là tải lên được.
- `/xem-tai-lieu?url=...` nhận URL bất kỳ; với `.pdf` đưa thẳng vào `iframe src` không lọc scheme `[K]`. Chưa chạy thử khai thác; cần kiểm trước khi coi là an toàn.
- Một số API ghi chú/tiến độ chỉ kiểm đăng nhập, chưa kiểm ghi danh `[Đ]`.
- `/api/leaderboard` công khai, lộ tên và trường `[Đ]`.
- Cron nhắc: nếu không đặt `CRON_SECRET` thì mở công khai `[Đ]`.

---

## 7. Mười điểm UI/UX quan trọng nhất cần sửa

1. **Nút "Làm bài Azota" hỏng khi bài có từ 2 link.** Admin lưu JSON mảng vào `azotaUrl`, trang học sinh đưa nguyên chuỗi vào `href` (`bai-giang/[lessonId]/page.tsx` dòng 355, 671) `[K]`. Làm hỏng cả link trong lịch.
2. **Học sinh không có chỗ dán link/ảnh bài làm Azota; gia sư không thấy ai đã làm.** Vì thế bài Azota không bao giờ "xong" và phải hỏi qua Zalo.
3. **Học liệu rải ở 4 nơi tên giống nhau** (Thư viện, trang Lớp, tab Tài liệu trong bài, Ngân hàng đề). Gộp vào tab "Tài liệu & bản ghi" trong Lớp.
4. **Trang bài giảng của học sinh nhồi một trang** (khoảng 1.280 dòng): giáo trình, video, hoàn thành, 3 tab, ghi chú, bài tập tự nộp, bài tương tác; học sinh không phân biệt "Tài liệu / Bài tập / Quiz Azota / Bài tập tự nộp".
5. **Màn soạn bài của giáo viên là một Drawer với link video/Zoom/Azota/tài liệu/ghi chú/bài tập**, loại bài tự suy ra từ ô nào có link, không có "xem như học sinh". Cần danh sách mục nội dung rõ kiểu + xem trước.
6. **Hạn Azota không vào lịch và "Việc của tôi"**: `toISO()` chỉ nhận `YYYY-MM-DD` hoặc `DD/MM/YYYY`, còn ô admin lưu `YYYY-MM-DDTHH:mm`, nên trả `null` `[K]`. Hạn hiện ở bài dạng chuỗi thô, ba kiểu hiển thị hạn khác nhau.
7. **Dán link video không phải YouTube không báo lỗi**: học sinh chỉ thấy "Video chưa được cập nhật". Thêm kiểm link ngay lúc lưu.
8. **Chữ giả/số giả**: "Quiz — Xử lý số liệu" cho mọi môn, "Thiết bị 1/2", lượt xem luôn 0, "link hiện trước 15 phút" nhưng hiện ngay. Bỏ hoặc làm thật.
9. **Quản trị: Nạp Coin không có lối vào, Nhật ký chỉ ghi không đọc, duyệt gia sư ba lối vào, "Nội dung" nhồi 8 tab không cùng loại; trang `/admin` thiên về thống kê thay vì "hôm nay cần làm gì"**. Ngoài ra các tệp lớn (`khoa-hoc/[id]` 2.384 dòng, `thi-thu` 1.970 dòng) rất khó sửa.
10. **Không có tiến trình "xem tiếp" và trạng thái "đang xem" lẫn "đã xong"**: `PATCH` tiến độ tạo luôn bản ghi mà `GET` coi mọi bản ghi là "đã hoàn thành"; `markComplete` ghi đè `watchedSeconds=0`. Học sinh mới đăng ký chỉ gặp "Việc của tôi" trống, không có nút "Nhập mã lớp".

---

## 8. Điều chưa kiểm, và việc nên làm trước

**Chưa kiểm chứng bằng chạy thật:** thứ tự ưu tiên khi bài vừa có video vừa có Azota (`parseLessonType` chọn `record` > `live` > `quiz` > `document` `[K]`, nên bài video+Azota chỉ hiện khung video và Azota nằm ở tab Bài tập); giới hạn thật của gói Cloudinary; liệu Azota có xuất điểm; hành vi `/xem-tai-lieu` với scheme lạ; phần tiếp của báo cáo mạng "học sinh/cộng đồng" bị cắt sau mục huy hiệu, nên Tin tức, Tra cứu, đánh giá khoá chỉ nêu ở mức tổng quan.

**Ba việc nên làm trước (không dính tiền, không dính trẻ em, không đổi schema):**
1. Vá `GET /api/courses/[id]` không trả `videoUrl/documents/azotaUrl/zoomUrl` cho người không có quyền.
2. Một hàm đọc danh sách link (chuỗi hoặc JSON) dùng chung cho admin, học sinh, lịch; sửa `href` Azota; sửa `toISO` nhận `datetime-local`.
3. Cho học sinh nộp **link** vào `AssignmentSubmission` và gia sư thấy bảng "đã làm/chưa" (cần Thọ xác nhận trước vì có thể kéo theo ảnh của trẻ: nếu chỉ nhận link text thì không).

**Câu hỏi để Thọ chọn:** (a) "trung tâm" có nghĩa thêm thực thể Tổ chức hay chỉ là cách gọi cho nhóm gia sư; (b) Coin giữ làm điểm thưởng hay ẩn; (c) video tải lên: giữ link hay mở dịch vụ video trả phí; (d) cho học sinh tải ảnh/video bài làm khi luật sư chưa trả lời hay chờ.
