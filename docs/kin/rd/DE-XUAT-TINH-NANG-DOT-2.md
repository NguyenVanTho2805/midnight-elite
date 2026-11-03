# Đề xuất tính năng đợt 2 — phụ huynh, học sinh, gia sư (01/11/2026)

Yêu cầu của Thanh 01/11: "phát triển thêm các tính năng cho phụ huynh, học sinh, gia sư, kèm giao diện thiết kế".
Căn cứ: `HIEN-CO-VA-DINH-VI.md` (KiN đã có gì), `diem-yeu-01-11-2026.md` (điểm yếu thật), `BIGUPDATE-KE-HOACH.md` (9 phòng BU),
`research-so-gia-su-2026-10-19.md`. Đây là **bản đề xuất để Thanh/Thọ chọn**; việc nào chạm TIỀN / TRẺ EM đã gắn cờ và KHÔNG
được phòng ban tự làm. Khung Figma: trang "🚀 Bigupdate (11/2026)", Section "🆕 Đợt 2".

Nguyên tắc chọn: (1) lấp đúng chỗ gãy đã đo được trong mã; (2) dùng dữ liệu KiN đã có, không thu thêm dữ liệu cá nhân;
(3) AI chỉ diễn giải con số đã tính sẵn, không tính tiền; (4) mỗi tính năng nối được với tính năng khác (không rời rạc).

## A. Phụ huynh (vào bằng link riêng của từng em, không tài khoản)

| Mã | Tính năng | Vì sao | Dữ liệu có sẵn | Cỡ | Cờ |
|---|---|---|---|---|---|
| PH-01 | **Sổ của con v2** — một trang gom: buổi sắp tới + nút "Báo nghỉ", chuyên cần tháng, bài tập đã nộp/chưa nộp + điểm, bài thi thử gần nhất, lời nhắn gia sư | Sổ hiện chỉ có chuyên cần + học phí + báo cáo tháng; phụ huynh không thấy con học gì giữa các tháng (`HIEN-CO` §1.3) | `Attendance`, `AssignmentSubmission`, `ExamResult` | M | không (chỉ hiển thị) |
| PH-02 | **Thông báo từ gia sư** — dòng thông báo một chiều (nghỉ, đổi lịch, bài mới), có chấm "chưa đọc"; gửi kèm Zalo như hiện có | Hộp việc gia sư có "báo nghỉ" nhưng phụ huynh không có chỗ xem lại | `notify`, Zalo link | S | thông báo không tên/số tiền |
| PH-03 | **Tìm gia sư cho con** — duyệt hồ sơ + lọc (môn, cấp, khu vực), "Gửi yêu cầu", **theo dõi trạng thái yêu cầu** (đã gửi / gia sư đã xem / đã nhận / vào lớp) | Trang chủ nay phục vụ cả phụ huynh tìm gia sư (HOME-01); yêu cầu đã có (`TutorRequest`) nhưng không có màn theo dõi | `TutorRequest`, BU-06 | M | không |
| PH-04 | **Lịch của con** — lịch tuần/tháng, thêm vào Google Lịch (.ics), nhắc trước 1 giờ qua Zalo | Lịch chỉ ở vỏ học sinh | `ClassSchedule`, `studentSchedule.ts` | S | không |
| PH-05 | **Đánh giá buổi học một chạm** (tuỳ chọn, ẩn danh) — "buổi hôm nay thế nào" 3 mức | Gia sư thiếu tín hiệu chất lượng; không đụng sao/điểm công khai | mới (bảng nhỏ) | S | TRẺ EM = trình bày (không tên em) |

## B. Học sinh

| Mã | Tính năng | Vì sao | Dữ liệu có sẵn | Cỡ | Cờ |
|---|---|---|---|---|---|
| HS-01 | **Kế hoạch ôn thi** — chọn kỳ thi + ngày thi → đếm ngược, bài cần làm mỗi tuần, tiến độ so với kế hoạch | Trang chủ cũ từng có đếm ngược viết cứng (đã bỏ); thiếu chỗ học sinh tự đặt mục tiêu | `Exam`, bài tập, `LessonProgress` | M | không |
| HS-02 | **Sổ lỗi sai** — sau mỗi lần chữa bài, câu sai tự vào sổ, nhóm theo chủ đề, nút "làm lại 5 câu sai" | Chữa bài có nhưng không gom lại; đây là thứ học sinh thật sự dùng để ôn | `ExamAttempt` đáp án, ngân hàng câu hỏi | M | không (lộ đáp án chỉ sau khi nộp — theo STU-001) |
| HS-03 | **Hỏi gia sư trong lớp** — đăng câu hỏi gắn bài/lớp, gia sư nhận ở Hộp việc, có dấu "đã trả lời" | Gãy thật: `Question` không gắn lớp, Hộp việc không có loại này (`diem-yeu` §3.2) | `Thread.courseId` | M | không (không nhắn riêng) |
| HS-04 | **Bài tập và hạn của tôi** — một danh sách theo hạn (quá hạn/hôm nay/tuần này), gom cả Azota, nộp file, quiz | Việc của tôi có, nhưng bài Azota là ngõ cụt (KiN không biết đã làm chưa) | `studentTodo*.ts` | S | không |
| HS-05 | **Tiến bộ qua từng đề** — biểu đồ điểm theo thời gian + điểm mạnh/yếu theo chủ đề | Dashboard "GPA/streak" cũ là công thức tự chế (`diem-yeu` §3.3); thay bằng số thật | `ExamResult` | M | không |

## C. Gia sư

| Mã | Tính năng | Vì sao | Dữ liệu có sẵn | Cỡ | Cờ |
|---|---|---|---|---|---|
| GS-01 | **Hộp việc có "câu hỏi học sinh"** + số chờ + gợi ý trả lời nhanh | Đóng khoảng trống HS-03 | `Thread.courseId` | M | không |
| GS-02 | **Mã mời cá nhân + duyệt vào lớp + lớp miễn phí** | = BU-01 đã thiết kế sẵn | `ClassInvite` | L | TIỀN = trình bày |
| GS-03 | **Bản nháp báo cáo tháng bằng AI** — tổng hợp chuyên cần, điểm, bài nộp thành 5 câu nhận xét để gia sư sửa rồi gửi | Gia sư mất nhiều thời gian nhất ở báo cáo; AI chỉ viết lời, số lấy từ máy chủ | `bao-cao-thang` | M | AI không tính tiền; không tên em ra ngoài |
| GS-04 | **Lịch rảnh + nhận yêu cầu tìm gia sư** — gia sư khai khung giờ rảnh, nhận/từ chối yêu cầu từ PH-03 | Nối PH-03 ↔ gia sư | `TutorRequest` | M | không |
| GS-05 | **Thư viện lớp tôi dạy** — bản ghi, tài liệu theo lớp thay vì trỏ sang trang khách | `diem-yeu` §3.2 P3 | `Lesson.documents` | S | không |

## D. Đề xuất thứ tự (không chạm TIỀN/TRẺ EM trước)

1. **Đợt 2a (S/M, làm ngay, ba phòng song song):** HS-03 + GS-01 (một cặp), PH-01, HS-04, PH-04.
2. **Đợt 2b:** HS-02, HS-01, PH-03 + GS-04 (một cặp), GS-03.
3. **Sau khi Thọ quyết:** GS-02 (BU-01, có TIỀN trình bày), PH-05 (TRẺ EM trình bày), HS-05.
4. Mọi việc đi qua đường ống phòng ban: `*-rnd` viết đặc tả → code ∥ dev → test → rà soát → PR; mỗi cặp liên phòng do `kin-coo` chia.

## E. Cần Thanh/Thọ chọn

- Đợt 2a có đúng 5 việc trên không, hay thêm/bớt?
- PH-05 (đánh giá buổi học): có làm không? (đụng cảm nhận về gia sư — nên Thọ quyết.)
- PH-02: phụ huynh có cần "đã đọc" hay chỉ một chiều?
