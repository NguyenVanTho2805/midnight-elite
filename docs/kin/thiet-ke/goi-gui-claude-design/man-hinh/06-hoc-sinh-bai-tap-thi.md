# Học sinh: Bài tập, bài kiểm tra và phòng thi

Route: `/student/thi-thu` (chuyển sang `/thi-thu`, danh sách đề) · `/student/thi-thu/[examId]` (cổng vào đề, phòng thi, kết quả, xem lại, chữa bài) · tab "Bài tập" trong `/student/bai-giang/[lessonId]` (bài tập nộp file / làm trên web / bài Azota) · lối vào từ `/student/viec-cua-toi`.
Tệp mã chính: `src/app/(guest)/thi-thu/page.tsx` (danh sách đề, hiển thị trong vỏ học sinh) · `src/app/(student)/student/thi-thu/[examId]/page.tsx` (cổng vào đề, kết quả, xem lại, nhập điểm Azota) · `src/components/exam/ExamRoomView.tsx` (đang làm bài) · `src/components/exam/CorrectionPanel.tsx` (chữa bài) · `src/lib/examRoom.ts` (chữ thanh Navy, đồng hồ, tiến độ) · `src/lib/examCorrection.ts`, `examCorrectionServer.ts` (quy tắc chữa bài) · `src/lib/examGrading.ts` (chấm, lượt thi, giờ từng Phần) · `src/lib/quizReward.ts` + `wallet-constants.ts` (thưởng Coin) · `src/lib/examData.ts` (`computeExamStatus`) · `src/app/(student)/student/bai-giang/[lessonId]/page.tsx` (`TabBaiTap`, `AssignmentCard`, `InteractiveAssignmentCard`, `QuestionAnswerRow`, `QuizContent`) · `src/lib/studentTodo.ts` (lối vào bài tập ở Việc của tôi).
Vai người dùng: học sinh (`role = "student"`, có thể dưới 16 tuổi). Gia sư và quản trị vào xem thử khu `/student/*` nhưng không phải đối tượng thiết kế.

> Cách đọc: màn này gồm **tám màn con** (A–H) dùng chung một quy tắc "một việc chính mỗi màn". A: danh sách đề. B: cổng vào đề (trước khi thi). C: phòng thi (đang làm bài). D: kết quả. E: xem lại bài làm. F: chữa bài. G: bài tập (tab trong bài giảng). H: đề Azota (không có câu hỏi trong KiN, học sinh nhập điểm). Việc của tôi (trang đầu của học sinh) có tệp thiết kế riêng; ở đây chỉ ghi lối đi từ đó sang bài tập.

---

## 1. Mục đích và người dùng

**Mục đích.** Cho học sinh làm đề thi thử và bài kiểm tra trong KiN, nộp bài tập gia sư giao, xem điểm, xem lại bài, rồi tự chữa các câu sai để nhớ lâu. Điểm thi thử đi vào GPA tháng (60% điểm thi, 40% tiến độ, `src/lib/gpa.ts`) và bảng xếp hạng, nên phòng thi phải công bằng và giống hệt nhau với mọi người.

**Người dùng.** Học sinh lớp 7 đến lớp 12 của lớp gia sư tự do và lớp luyện thi (HSA, TSA, THPT, BCA). Phần lớn dùng điện thoại, tay cầm một bàn tay, thường làm bài trong 15 đến 90 phút, bấm dưới áp lực thời gian. Có em dưới 16 tuổi: không hỏi thêm thông tin cá nhân, không hiện tiền.

**Giọng.** Ngắn, rõ, không doạ. Một câu nói đúng điều sắp xảy ra ("Hết giờ hệ thống tự nộp bài."). Học sinh không thấy học phí, không thấy giá đề. Coin chỉ là phần thưởng, không bán, không nạp.

---

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)

1. **Làm bài trong phòng thi**: chọn đáp án, điền ngắn, viết tự luận, đánh Đúng/Sai từng ý, nhìn đồng hồ, nhảy câu, nộp bài.
2. **Biết điểm ngay sau khi nộp**: điểm, hạng, và (mới) số Coin vừa nhận.
3. **Tìm đề cần thi hôm nay**: thấy đề "Đang mở" lên đầu, một nút "Vào thi".
4. **Nộp bài tập gia sư giao**: nộp file (ảnh/PDF) hoặc làm trực tiếp trên web, thấy hạn và trạng thái bằng chữ.
5. **Xem lại bài làm** sau khi nộp: câu nào đúng, câu nào sai, lời giải (nếu đề cho xem).
6. **Chữa lại các câu sai**: gợi ý trước, đáp án sau, có điểm dừng sau hai lần nộp.
7. **Thi lại** đề đã làm (điểm giữ lần cao nhất).
8. **Rời đi không bị kẹt**: mỗi màn trước và sau bài thi có một lối ra. Hiện có: "← Về danh sách đề thi" ở B, D và màn lỗi; "← Quay lại kết quả" ở E; "← Xem bài làm" ở F. Màn H (nhập điểm Azota) hiện chưa có lối nào (mục 9, điểm 24); thiết kế thêm "← Về danh sách đề thi" ở đó.

---

## 3. Dữ liệu hiển thị

Mọi trường dưới đây có thật trong mã. Chỗ ghi "(chưa hiển thị)" là dữ liệu đã có ở máy chủ nhưng giao diện hiện tại bỏ qua.

### A. Danh sách đề (`(guest)/thi-thu/page.tsx`)
Nguồn: `useExams({active:"true"})` → `GET /api/exams?active=true`; `GET /api/exam-results?mine=true`; `useEnrollments().enrolledIds`.

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Tên đề | `ExamFull.title` | chữ, được xuống dòng | Kiểm tra 15 phút Toán 9: Hệ phương trình |
| Mã đề | `ExamFull.code` (hiện đoạn trước dấu chấm) | `PREFIX.NN`; prefix là HSA, HCM, TSA, BCA hoặc THPT (`api/exams/route.ts: examCodePrefix`; danh mục lạ rơi về THPT) | THPT.07 |
| Danh mục | `ExamFull.category` | chữ tự do do gia sư nhập hoặc chọn (`admin/thi-thu/page.tsx` ghi rõ không phải enum). Năm chip lọc cố định lấy từ `COURSE_CATEGORIES` (`src/lib/courseData.ts`): ĐGNL HSA, ĐGNL HCM, Tốt nghiệp THPT, TSA Bách Khoa, BCA; đề có danh mục khác chỉ hiện ở chip "Tất cả" | Tốt nghiệp THPT |
| Ngày giờ thi | `ExamFull.date` + `ExamFull.time` | `dd/mm/yyyy · HH:mm` (24 giờ), hai chuỗi in nguyên | 22/10/2026 · 08:00 |
| Thời lượng | `ExamFull.duration` | chuỗi tự do, đề dùng "NN phút" | 15 phút |
| Số câu | `ExamFull.questions` | số + " câu" | 10 câu |
| Số thí sinh | `ExamFull.participants` | chỉ hiện khi > 0 | 6 thí sinh |
| Trạng thái đề | `computeExamStatus(date, time, active)` (`examData.ts`) | 3 nhãn: "Sắp diễn ra" (trước giờ bắt đầu), "Đang mở" (từ giờ bắt đầu trở đi, không bao giờ tự đóng theo thời gian), "Đã kết thúc" (chỉ khi `active = false`; vì danh sách chỉ lấy `active=true` nên học sinh đã đăng nhập thực tế không thấy nhãn này, xem mục 9, điểm 22). Đã có kết quả thì nhãn "Đã làm" | Đang mở |
| Điểm của tôi | `myResults[examId].score` / `.totalPoints` | `score/totalPoints` | 8/10 |
| Hạng | `myResults[examId].rank` | "Hạng #N", chỉ hiện khi rank > 0 | Hạng #3 |
| Khoá liên kết | `ExamFull.courseId`, `courseName`, `enrolledIds` | khoá chưa ghi danh thì khoá nút, hiện "Thuộc khóa {courseName hoặc "khác"} — chưa ghi danh" | Thuộc khóa Toán 9 — chưa ghi danh |
| Ba số đầu trang | `done` = số đề đã có kết quả; `available` = đề "Đang mở" chưa làm; `upcoming` = đề "Sắp diễn ra" | số nguyên, nhãn "Đã làm", "Có thể thi", "Sắp diễn ra" | 2 · 1 · 1 |

### B. Cổng vào đề (phase `ready`, `thi-thu/[examId]/page.tsx`)
Nguồn: `GET /api/exams/{id}` (`ExamFull`), `useAuth().user.name`, `GET /api/exam-results?examId=` (Top 10), `GET /api/exams/{id}/attempts?mine=true` (lịch sử).

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Tên đề | `ExamFull.title` | chữ | Kiểm tra 15 phút Toán 9: Hệ phương trình |
| Ngày giờ | `ExamFull.date`, `ExamFull.time` | `dd/mm/yyyy · HH:mm` | 22/10/2026 · 08:00 |
| Thời gian làm bài | `ExamFull.duration` | chuỗi | 15 phút |
| Số câu hỏi | `ExamFull.questions` | "N câu" | 10 câu |
| Danh mục | `ExamFull.category` | chữ | Tốt nghiệp THPT |
| Mã đề | `ExamFull.code` | chữ | THPT.07 |
| Có mật khẩu | `ExamFull.hasPassword` | cờ; chỉ hiện ô nhập khi true. Mật khẩu thô không bao giờ về máy học sinh | (ô nhập) |
| Làm trong KiN hay Azota | `ExamFull.hasQuestions`, `ExamFull.azotaUrl` | hai nhánh nút khác nhau | |
| Tên học viên (dòng "Thông tin ghi nhận") | `useAuth().user.name`, mặc định "Học viên" | chữ | Đỗ Hà |
| Bảng xếp hạng Top 10 | `ExamFull.showLeaderboard` (mặc định true) + `LeaderboardRow {user.name, score}` (10 dòng đầu) | thứ tự 1–10, tên, điểm | 1 · Trần Gia Bảo · 9 |
| Lịch sử làm bài | `ExamAttemptHistoryItem {id, status, score, submittedAt, startedAt}` (mới nhất trước, bỏ lượt đang làm), `ExamFull.totalPoints` | `toLocaleString("vi-VN")` cho ra giờ trước, ngày sau, ngày không đệm số 0: `HH:mm:ss d/M/yyyy`; "(hết giờ)" khi `status = "expired"`; `score/totalPoints` (số in bằng dấu chấm thập phân của JavaScript) | 19:20:11 22/10/2026 · 8/10 |

### C. Phòng thi (đang làm bài, `ExamRoomView.tsx`)
Nguồn: `POST /api/exams/{id}/start` → `ExamAttemptState`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Dòng đầu thanh Navy | `roomHeading({examTitle, sectionLabel, sectionIndex})` (`examRoom.ts`) | đề không chia Phần: tên đề; có Phần: tên Phần (thêm "Phần n · " nếu tên chưa bắt đầu bằng "Phần"); chữ hoa bằng CSS | KIỂM TRA 15 PHÚT TOÁN 9: HỆ PHƯƠNG TRÌNH |
| Câu hiện tại | `questionCounter(cur+1, totalQuestions)` | "Câu N / M"; M là tổng số câu cả đề, kể cả Phần chưa hiện | Câu 4 / 10 |
| Đồng hồ | `formatClock(remainingSec)` từ `ExamAttemptState.expiresAt` hoặc `sectionWindows[i].endsAt` | `mm:ss`, quá 59 phút vẫn hiện phút đầy đủ ("90:00") | 14:31 |
| Nhãn dưới đồng hồ | `sectioned ? "còn lại của {Phần n}" : "còn lại"` | chữ | còn lại của Phần 1 |
| Số lần rời tab | `ExamAttemptState.tabSwitchCount`, cập nhật từ `PATCH /tab-event` | số, dải báo chỉ hiện khi > 0 | 2 |
| Tên Phần (tiêu đề nhóm câu) | `ExamQuestionPublic.sectionLabel` | chữ hoa nhỏ | Phần 1: Toán và xử lý số liệu |
| Câu hỏi | `ExamQuestionPublic.text` (qua `MathText`, có công thức), `imageUrl`, `type` | 4 loại: `MC`, `SHORT_ANSWER`, `ESSAY`, `TRUE_FALSE_CLUSTER` | Câu 4. Nghiệm của hệ … |
| Đáp án MC | `options[].text`, ký hiệu A, B, C, D theo thứ tự xáo | ô cao ≥ 52px | A. x = 2 |
| Ý Đúng/Sai | `options[].subLabel` (a, b, c, d) + `text`; chọn `clusterAnswers[optionId]` | nút "Đ" / "S" (tên truy cập "Đúng"/"Sai") | a) Phát biểu a |
| Tiến độ | `progressLine(answeredHere, inSection.length, short)` | "Đã trả lời N / M câu" + " Phần n" khi chia Phần | Đã trả lời 3 / 10 câu |
| Ghi chú hết giờ | `timeUpNote({sectionName, nextSectionName})` | một trong hai câu cố định (mục 7) | Hết giờ hệ thống tự nộp bài. |
| Số câu chưa trả lời (hộp nộp bài) | `totalQuestions - answeredAll` | số | 2 |
| Báo lỗi | prop `error` (từ `startErr`) | chữ đỏ ở chân trang | Nộp bài thất bại, thử lại |

### D. Kết quả (phase `done`)
Nguồn: `POST /api/exams/attempts/{id}/submit` hoặc `GET /api/exam-results?mine=true`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Điểm | `MyResult.score` / `.totalPoints` | `score/totalPoints`, số in bằng dấu chấm thập phân (8.5, không phải 8,5). Vào thẳng màn này (đã có kết quả) thì là điểm tốt nhất; ngay sau một lượt nộp thì là điểm CỦA LƯỢT VỪA NỘP (`submit` trả `finalized.score`), có thể thấp hơn điểm tốt nhất đang được giữ | 8/10 |
| Hạng | `MyResult.rank` | "Hạng #N trong bảng xếp hạng", chỉ khi rank > 0 (máy chủ luôn trả ≥ 1; hạng tính theo điểm tốt nhất, đồng điểm đồng hạng) | Hạng #3 trong bảng xếp hạng |
| Đề thi, Ngày thi, Thời gian, Số câu | `exam.code`, `exam.date`, `exam.duration`, `exam.questions` | 4 ô nhỏ | THPT.07 · 22/10/2026 · 15 phút · 10 câu |
| Coin vừa nhận (chưa hiển thị) | `coinsEarned` trong phản hồi `submit` (`api/exams/attempts/[attemptId]/submit/route.ts`); `api.ts` khai báo kiểu trả về không có trường này | số nguyên ≥ 0: 0, 5 hoặc 10 (`QUIZ_REWARD_BASE` 5, thêm `QUIZ_REWARD_FAST_BONUS` 5). Mỗi (học sinh, đề) chỉ được thưởng MỘT lần (`addQuizRewardCoins`: làm lại cùng đề trả 0) và tối đa 5 lần thưởng mỗi ngày | +10 |

### E. Xem lại bài làm (phase `review`)
Nguồn: `GET /api/exams/attempts/{id}/review` → `ExamAttemptReview`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Số câu cần chữa | `correctableCount` | "Bạn có N câu làm chưa đúng." khi > 0. Chỉ đếm câu trắc nghiệm một đáp án (`MC`) và điền ngắn (`SHORT_ANSWER`) làm sai hoặc bỏ trống; câu Đúng/Sai nhiều ý và tự luận không bao giờ vào chữa bài | Bạn có 2 câu |
| Cho xem đáp án chưa | `canSeeAnswers` (từ `Exam.answerVisibility`: never, after_submit, after_exam_ends) và `Exam.hideAnswerForWrong` | cờ; false thì hiện dải "Đề thi này chưa cho phép xem đáp án lúc này — chỉ hiện câu trả lời của bạn." Khi đề bật `hideAnswerForWrong`, câu làm sai bị giấu đáp án (`isCorrect = null`) mà KHÔNG có dải báo nào, và chữa bài cũng không mở | |
| Câu hỏi | `questions[].text`, `sectionLabel` | "Câu N: …" | Câu 4: Nghiệm của hệ … |
| MC: lựa chọn, đáp án của tôi | `options[].text`, `options[].isCorrect` (null khi bị giấu), `studentOptionId` | mũi tên "→" đứng trước lựa chọn của tôi; dấu ✓ sau đáp án đúng | → 3 |
| Lời giải | `explanation` | khung "Giải thích:"; chỉ câu MC mới có (Đúng/Sai, điền ngắn, tự luận không hiện lời giải ở màn này) | |
| Câu chưa chữa | `correctionPending` | nhắc "Câu này chưa chữa. Bấm Chữa lại các câu sai …" | |
| Đúng/Sai theo ý | `options[].subLabel`, `studentAnswerTrue`, `isCorrect` | "bạn chọn: Đúng/Sai/chưa trả lời", "(đáp án đúng: …)" | a) … — bạn chọn: Đúng |
| Tự luận | `textAnswer`, `pointsAwarded`, `points`, `teacherComment` | "Điểm: x/y", "Nhận xét: …" hoặc "Chưa chấm"; số in bằng dấu chấm thập phân của JavaScript | Điểm: 1.5/2 |
| Điền ngắn | `studentAnswer`, `correctAnswer`, `isCorrect` | "Bạn trả lời: …", "Đáp án đúng: …" | Bạn trả lời: 8 |

### F. Chữa bài (`CorrectionPanel.tsx`)
Nguồn: `GET /api/exams/attempts/{id}/correction` → `CorrectionOverview`; `CorrectionItem` từ `examCorrectionServer.ts`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Tiến độ | `summary.total`, `summary.remaining` | "{total − remaining}/{total} câu đã xong" | 1/2 câu đã xong |
| Chip bước | `items[].index`, `state` | số câu, thêm " ✓" khi xong; tên truy cập "Câu N — đã xong/đang chữa/chưa làm" | 4 ✓ |
| Đề câu | `item.text`, `item.index` | "Câu N: …" | Câu 4: … |
| Lựa chọn (MC) | `item.options[]` (chỉ `id`, `text`) | radio, ô ≥ 44px | |
| Ô điền (điền ngắn) | `item.yourText`, tối đa `SHORT_ANSWER_MAX` = 200 ký tự | một dòng | |
| Gợi ý | `item.hint` (chỉ ở bước 2) | "Chưa đúng. Gợi ý: …" | Đưa về dạng hệ số … |
| Đáp án, lời giải | `item.answer {correctOptionId, correctText, explanation}` (chỉ khi câu đã xong) | "Đáp án đúng", "Lời giải:" | |
| Ô tự giải thích | `item.canReflect`, `item.reflection`, tối đa `REFLECTION_MAX` = 500 | một dòng, không bắt buộc | Gợi ý giúp mình nhớ công thức. |
| Tổng kết | `summary.solved`, `summary.revealed` | "Bạn đã chữa xong N câu: a câu tự làm đúng, b câu đã xem đáp án." | |
| Không chữa được | `data.available`, `data.reason` | lý do do máy chủ viết; cùng một câu cho cả ba trường hợp đề không cho xem đáp án (`never`, `after_exam_ends` khi đề chưa hết hạn, hoặc bật `hideAnswerForWrong`). Máy chủ chỉ mở chữa bài cho chủ lượt thi, lượt đã nộp | Đề này chưa cho xem đáp án nên chưa có chế độ chữa bài. |

### G. Bài tập (tab "Bài tập" trong bài giảng)
Nguồn: `GET /api/lessons/{id}/assignments` (`AssignmentFull`), `GET /api/assignments/{id}/answer` (`AssignmentAnswerData`), `lesson.azotaUrl`, `lesson.azotaDeadline`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Tên bài | `AssignmentFull.title` | chữ | Bài tập 3: Hệ hai phương trình bậc nhất |
| Hướng dẫn | `AssignmentFull.instructions` | chữ nhỏ, có thể trống | Nộp ảnh chụp bài làm, ghi rõ họ tên. |
| Hạn | `AssignmentFull.dueDate` | "Hạn dd/mm/yyyy" (chỉ ngày, theo múi giờ máy). Biểu mẫu gia sư chỉ có ô chọn NGÀY (`type="date"`), máy chủ lưu `new Date("yyyy-mm-dd")` = nửa đêm UTC = 07:00 giờ Việt Nam của ngày hạn (mục 9, điểm 21). Chỉ bài làm trên web mới có trạng thái khoá và nhãn "Đã hết hạn dd/mm/yyyy"; bài nộp file luôn in "Hạn …" và máy chủ vẫn nhận bài sau hạn | Hạn 25/10/2026 |
| Đề bài đính kèm | `fileUrl`, `fileName` | liên kết mở `/xem-tai-lieu`, mặc định tên "Tải đề bài" | De-bai-3.pdf |
| Bài nộp của tôi | `mySubmission {submittedAt, score, gradedAt, comment}` | "Đã nộp lúc {toLocaleString("vi-VN")} — chờ chấm điểm." (có giây, giờ trước ngày: `20:15:07 22/10/2026`) hoặc "Điểm: x/maxPoints" + "Nhận xét: …"; điểm in bằng dấu chấm thập phân (8.5/10), khác Việc của tôi dùng dấu phẩy | Điểm: 8.5/10 |
| Kiểu bài | `mode` = "file" hoặc "interactive" | biểu tượng 🖥️ đứng trước tên bài làm trên web (`questionCount` có trong dữ liệu nhưng tab học sinh không dùng) | |
| Tiến độ làm trên web | `completion {answered, total}` | "Đã làm a/b câu — tự lưu khi bạn trả lời." | Đã làm 3/5 câu |
| Điểm bài làm trên web | tính ở máy: MC `isCorrect ? points : 0`, tự luận `pointsAwarded` | "Điểm: x/y" khi đã khoá | Điểm: 4/5 |
| Câu hỏi bài tập | `questions[].text`, `points`, `type` (`MC`, `ESSAY`), `options[]` | "Câu N." + điểm "{points}đ" | Câu 1. … 1đ |
| Bài kiểm tra Azota | `lesson.azotaUrl`, `lesson.azotaDeadline` | trong tab: dòng tên cứng "Quiz — Xử lý số liệu" (chữ viết sẵn trong mã, không lấy từ dữ liệu bài học) + "Deadline: …" (`azotaDeadline` là chuỗi tự do) + nút "Làm bài →". Bài học loại quiz không có tab "Bài tập"; thân bài hiện khối "Bài kiểm tra Azota" | |

### H. Đề Azota (không có câu hỏi trong KiN, phase `submit`)
Nguồn: `ExamFull.azotaUrl`, `POST /api/exam-results {examId, score}`.

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Liên kết Azota | `ExamFull.azotaUrl` | mở tab mới | |
| Điểm tự nhập | trường số, `step 0.5`, `min 0` | máy chủ chỉ nhận 0–150 (thang cố định, `totalPoints` luôn 150 bất kể đề). Khác đề làm trong KiN, nộp lại GHI ĐÈ điểm cũ kể cả khi thấp hơn (`api/exam-results/route.ts` dùng `upsert … update: { score }`) | 112 |

### I. Lối vào từ Việc của tôi (`studentTodo.ts`, chỉ để biết)
Mỗi bài tập có hạn thành một dòng `StudentTodoItem {title, subtitle, when, status {label, tone}, needsAction, done}` kèm nút `detail.commands[]` trỏ `/student/bai-giang/{lessonId}`. Nhãn trạng thái bài tập: "Quá hạn", "Sắp hết hạn", "Cần nộp", "Đã nộp", "Đã làm", "Đã chấm".

---

## 4. Bố cục đề xuất

**Nguyên tắc chung cho cả nhóm màn.** Một cột. Không khung lồng khung: thay khung bằng đường kẻ mảnh `--kin-vien-thuong` và khoảng trắng. Chữ phụ nhỏ nhất `--kin-co-small` (13,3px); chữ 11,1px (`--kin-co-caption`) chỉ cho nhãn nhóm. Một nút chính mỗi màn, nút phụ là chữ hoặc nút `secondary`. Trạng thái luôn có chữ. Lề ngang 16px trên điện thoại (mục 9, điểm 2). Mọi nút chạm ≥ 44px (`--kin-cham-toi-thieu`); ô đáp án trong phòng thi ≥ 52px (`--kin-cham-dap-an`).

**Vỏ.** Danh sách đề (A) và tab Bài tập (G) nằm trong vỏ học sinh (thanh dưới trên điện thoại, thanh trái trên máy tính). **Mọi màn dưới `/student/thi-thu/[examId]` (B, C, D, E, F, H) không có vỏ** (`isExamRoom` trong `StudentShell.tsx`): đây là chủ ý, phòng thi toàn màn hình và khoá cứng Navy (`[data-vung="phong-thi"]`, `kin-tokens.css`). Thiết kế không được thêm thanh module, chuông, ví Coin vào các màn này.

### A. Danh sách đề (`/thi-thu` trong vỏ học sinh)

**Điện thoại 390px**, từ trên xuống:
1. Tiêu đề "Thi thử" một dòng. Bỏ phụ đề "Luyện tập với đề thi thử được cập nhật liên tục" (không ai kiểm, không mang thông tin).
2. Dải ba số một hàng, không khung: số lớn (cỡ `--kin-co-h4`) + nhãn nhỏ dưới ("Đã làm", "Có thể thi", "Sắp diễn ra"). Ba cột bằng nhau, ngăn bằng đường kẻ dọc mảnh.
3. Chip danh mục cuộn ngang một hàng, cao 44px; chip đang chọn nền `--kin-nhan-nen`. Mặc định "Tất cả".
4. Danh sách đề, mỗi đề một hàng, đường kẻ mảnh giữa các hàng, không viền ngoài. Thứ tự: "Đang mở" chưa làm lên đầu, rồi "Sắp diễn ra" (gần nhất trước), rồi "Đã làm", rồi "Đã kết thúc". Mỗi hàng, cao ≥ 76px:
   - dòng 1: tên đề (tối đa 2 dòng, xuống dòng, không cắt "…");
   - dòng 2: `22/10/2026 · 08:00 · 15 phút · 10 câu` (`--kin-chu-mo`, 13,3px);
   - dòng 3: nhãn trạng thái bằng chữ (xanh lá "Đang mở", xanh dương "Sắp diễn ra", xám "Đã kết thúc"); đề đã làm thay bằng "Đã làm · 8/10 · Hạng #3" (số đậm). Nút nằm cùng dòng này, ở mép phải, để mỗi hàng chỉ có ba dòng chữ và không phải chừa một cột riêng cho nút trên 390px.
   - nút ở mép phải dòng 3, cao 44px: "Vào thi" (primary) khi đang mở; "Xem lại" (secondary) khi đã làm; chữ không nút "Chờ mở" khi sắp diễn ra; chữ "Đã kết thúc" khi `active = false` (hiện học sinh không gặp, mục 9, điểm 22). Đề khoá khoá: dòng 3 là chữ "Thuộc khóa Toán 9 — chưa ghi danh" (đúng chuỗi cũ, được xuống dòng), không nút.
   - Máy chủ trả đề theo thứ tự mới tạo trước (`createdAt` giảm dần), nên thứ tự nêu ở đầu điểm 4 phải do giao diện tự sắp.
5. Cuối trang một dòng chữ nhỏ thay cho khung "ℹ": "Kết quả thi thử được ghi nhận và tính vào Bảng xếp hạng vinh danh hàng tháng. Làm bài nghiêm túc để có điểm số chính xác nhất."
   Không dùng ô vuông gradient mã đề; mã đề (THPT.07) đặt ở cuối dòng 2 bằng chữ nhỏ.

**Máy tính 1280px**: cột nội dung rộng tối đa 720px, căn trái trong vùng nội dung của vỏ. Dải ba số nằm cùng hàng với tiêu đề (tiêu đề trái, ba số phải). Hàng đề: tên trái, nút phải, dòng 2 và 3 dưới tên; không chia hai cột.

### B. Cổng vào đề (trước khi thi)

**Điện thoại 390px**:
1. Hàng đầu: liên kết "← Về danh sách đề thi", cao 44px, chữ `--kin-nhan-link`.
2. Tên đề cỡ `--kin-co-h4`, đậm, tối đa 3 dòng; dưới là `22/10/2026 · 08:00` (`--kin-chu-mo`).
3. Ba con số lớn một hàng, không khung: "15 phút" / "10 câu" / mã đề; nhãn nhỏ phía dưới ("Thời gian làm bài", "Số câu hỏi", "Mã đề"). Bỏ ô "Danh mục" (đã có ở danh sách).
4. Khối "Quy định phòng thi" một khối duy nhất, ba gạch đầu dòng 13,3px (gộp "Lưu ý quan trọng", "Thông tin ghi nhận" và "Quy định phòng thi" cũ). Đề trong KiN: "Hệ thống đếm số lần bạn rời khỏi tab khi làm bài. Không quay màn hình, không dùng camera." · "Không chụp ảnh màn hình hoặc chia sẻ đề thi" · "Bài tự động nộp khi hết giờ". Nối thêm dòng chữ thường (không khung vàng): "Làm bài nghiêm túc như thi thật. Kết quả sẽ được ghi nhận và tính vào GPA tháng." Đề Azota (không có câu hỏi trong KiN) giữ hai gạch đầu dòng riêng của mã: "Không thoát khỏi trang Azota trong khi làm bài" · "Không chụp ảnh màn hình hoặc chia sẻ đề thi", không có câu về rời tab.
5. Ô mật khẩu (chỉ khi `hasPassword`): nhãn rõ phía trên ("Mật khẩu đề thi"), ô cao 52px, chỗ trống giữ nguyên "Nhập mật khẩu đề thi (hỏi giáo viên)".
6. Nút "Bắt đầu làm bài" rộng hết bề ngang, cao 52px, nền Navy, dính đáy màn hình (sticky) để không phải cuộn tìm. Lỗi hiện ngay trên nút, chữ đỏ, một dòng.
7. Dưới nút (cuộn tới): "Lịch sử làm bài" (nếu có) là danh sách mỗi lượt một dòng `thời điểm · điểm`; "Bảng xếp hạng Top 10" là mục gập, mặc định gập (chỉ hiện khi `showLeaderboard` và có dòng).

**Máy tính 1280px**: cột 560px căn giữa vùng nội dung (không có vỏ nên căn giữa toàn trang). Nút "Bắt đầu làm bài" rộng 280px, nằm ngay dưới khối quy định, không dính đáy. Lịch sử và Top 10 nằm hai cột dưới nút.

### C. Phòng thi (đang làm bài). Giữ cấu trúc hiện có, chỉ làm gọn

Khung cố định đã có test: trang không cuộn, thanh trên và chân trang dính, chỉ thân cuộn. Giữ nguyên.

**Điện thoại 390px**, từ trên xuống:
1. **Thanh Navy** (`<header>` duy nhất của trang): trái hai dòng, dòng 1 tên Phần hoặc tên đề (chữ hoa 11,1px, tối đa 2 dòng, không cắt), dòng 2 nút "Câu 4 / 10 ▼" (cao 44px, bấm mở lưới nhảy câu); phải đồng hồ `mm:ss` phông đơn cách 27,6px, dưới là "còn lại" hoặc "còn lại của Phần 1". Dưới 60 giây đồng hồ đổi sang tông đỏ nhạt (`--kin-tt-nen-loi`) kèm thông báo đọc to "Còn dưới 1 phút."
2. **Dải rời tab**, chỉ khi `tabLeaves > 0`: một dòng nền `--kin-tt-nen-cho`, chấm cam + chữ đúng chuỗi mục 7. Cao tối đa hai dòng.
3. **Lưới nhảy câu**, chỉ khi mở: nền `--kin-nen-bang`, ô 44px, 6 ô một hàng trên 390px, cao tối đa 40% màn hình rồi cuộn. Ô đã trả lời: viền liền, nền `--kin-nen-nhan`; chưa trả lời: viền đứt. Ô đang xem viền 2px.
4. **Thân cuộn** (cột chữ tối đa 900px, lề 16px). Mỗi câu một khối cách nhau 32px, không viền, không nền: tên Phần (chỉ ở câu đầu của Phần, 11,1px, `--kin-nhan-link`), tiêu đề "Câu N." + đề (16px, đậm), ảnh minh hoạ (nếu có, rộng hết cột), rồi vùng trả lời:
   - **MC**: bốn ô cao ≥ 52px, cách nhau 10px; ô đang chọn viền Navy 2px + nền `--kin-nen-nhan` (không chỉ đổi màu chữ); ký hiệu A B C D mờ ở bên trái.
   - **Điền ngắn**: một ô cao 52px, nhãn trong ô "Nhập đáp án...".
   - **Tự luận**: ô nhiều dòng 5 dòng, "Nhập câu trả lời của bạn...", tự lưu khi rời ô.
   - **Đúng/Sai nhiều ý**: mỗi ý một hàng: chữ ý bên trái xuống dòng được, hai nút "Đúng" và "Sai" bên phải (hoặc dưới trên 320px), mỗi nút ≥ 44px cao và ≥ 64px rộng; đề xuất chữ hiện đầy đủ "Đúng"/"Sai" thay cho "Đ"/"S" (tên truy cập giữ nguyên).
   - Phần đã hết giờ: cả khối mờ 60%, trên đầu có chữ đỏ "Đã hết giờ Phần này — không thể sửa câu trả lời."
5. **Chân trang cố định**, hai hàng:
   - hàng 1: "Đã trả lời 3 / 10 câu" (đậm) và, trên cùng dòng hoặc ngay dưới, ghi chú hết giờ 11,1px màu `--kin-tt-chu-cho`; lỗi (nếu có) chữ đỏ.
   - hàng 2: đúng **ba nút** cao ≥ 44px, rộng ≥ 44px: "Câu trước" (secondary), "Câu sau" (primary), "Nộp bài" (danger). Đề xuất thứ tự trái sang phải: Câu trước, Câu sau, Nộp bài (hiện tại "Nộp bài" đứng đầu, sát "Câu trước"); đã có hộp xác nhận nên không đổi nghĩa chức năng.
6. **Hộp "Nộp bài ngay?"** (`KinConfirm`, tone nguy hiểm, rộng tối đa 420px): tiêu điểm đầu rơi vào "Làm tiếp"; nút đỏ "Nộp bài". Đang nộp: "Đang nộp…".
7. **Giữ chỗ thở cho đề.** Phần cố định (thanh Navy + dải rời tab + chân trang) cộng lại không quá khoảng 40% chiều cao màn 800px khi chưa mở lưới; chân trang tối đa ba dòng chữ (tiến độ, ghi chú hết giờ, lỗi) phía trên hàng nút. Tiến độ và ghi chú hết giờ phải nằm trong `<footer>` (test kiểm chữ ở đó), nên rút gọn bằng cỡ chữ và khoảng cách, không bằng cách dời chúng khỏi chân trang.

**Máy tính 1280px**: giữ cấu trúc, cột đề tối đa 900px căn giữa; thanh Navy và chân trang kéo hết chiều ngang, nội dung trong chúng căn theo cột 900px; chân trang một hàng (tiến độ trái, ba nút phải, mỗi nút không rộng quá 140px). Lưới nhảy câu hiện 12 ô một hàng.

### D. Kết quả

**Điện thoại 390px**:
1. "Kết quả của bạn" (cỡ `--kin-co-h4`, là tiêu đề trang, đúng chữ cũ), dưới là tên đề (`--kin-chu-mo`).
2. Điểm rất lớn ở giữa (`--kin-co-display` 39,8px): `8/10`, mẫu số nhỏ hơn và xám. Dưới: "Hạng #3 trong bảng xếp hạng" (chỉ khi rank > 0).
3. Dòng thưởng, chỉ khi `coinsEarned > 0`: "Bạn nhận được +10 Coin" nền `--kin-tt-nen-xong`, chữ `--kin-tt-chu-xong`, một dòng. Khi 0 không hiện gì (không hiện "0 Coin", không giải thích lý do vì máy chủ không trả lý do).
4. Một dòng meta duy nhất thay cho bốn ô: `THPT.07 · 22/10/2026 · 15 phút · 10 câu`.
5. Nút chính "Xem lại bài làm" rộng hết bề ngang, cao 52px (chỉ khi `exam.hasQuestions` và có lượt thi). Dưới: nút `secondary` "Thi lại đề này". Dưới cùng liên kết "← Về danh sách đề thi" cao 44px.

**Máy tính 1280px**: cột 480px căn giữa; hai nút nằm một hàng (chính trái).

### E. Xem lại bài làm

**Điện thoại 390px**:
1. Hàng đầu: "← Quay lại kết quả" (44px); tiêu đề "Xem lại bài làm" + tên đề.
2. Nếu `correctableCount > 0`: một khối nổi bật duy nhất ở đầu, nền `--kin-nen-nhan`: "Bạn có N câu làm chưa đúng. Chữa lại từng câu: gợi ý trước, đáp án sau." và nút "Chữa lại các câu sai" (primary, 52px, rộng hết bề ngang). Chỉ đây là nút chính của màn.
3. Dải vàng nhạt "Đề thi này chưa cho phép xem đáp án lúc này — chỉ hiện câu trả lời của bạn." khi `!canSeeAnswers`.
4. Danh sách câu, mỗi câu một khối phân cách bằng đường kẻ, không khung: dòng đầu "Câu N: đề" (16px); dưới là nhãn trạng thái bằng chữ (đề xuất: "Đúng" xanh lá, "Chưa đúng" đỏ, "Chưa chữa" cam, "Chưa chấm" xám, "Đã trả lời" khi đáp án bị giấu), rồi các lựa chọn 13,3px (đáp án tôi chọn có "→", đáp án đúng có "✓" và chữ "Đáp án đúng"), rồi "Giải thích: …" nền `--kin-nen-bang`. Tên Phần chen giữa các nhóm câu.

**Máy tính 1280px**: cột 720px căn giữa; khối "Chữa lại các câu sai" nằm ngang (chữ trái, nút phải).

### F. Chữa bài

**Điện thoại 390px**:
1. Hàng đầu: "Chữa bài" (đúng chữ, cỡ `--kin-co-h4`) trái; "← Xem bài làm" phải (44px). Dưới: "1/2 câu đã xong · Chữa bài chỉ để học, không đổi điểm bài thi." (13,3px).
2. Thanh bước "Các câu cần chữa": một hàng chip 44×44 cuộn ngang (thay cho `flex-wrap` nhiều hàng); chip hiện số câu, thêm " ✓" khi xong; chip đang chọn nền `--kin-nhan-nen`, chip xong nền `--kin-tt-nen-xong`.
3. Câu hỏi (không khung): "Câu N: đề" 16px. Nếu đang ở bước 2: dải nền `--kin-tt-nen-cho` "Chưa đúng. Gợi ý: …".
4. Vùng trả lời: ô radio cao ≥ 44px (MC) hoặc một ô điền 52px. Sau khi nộp sai: ô đã chọn viền đỏ và chữ "Chưa đúng" bên trong ô. Khi xong: đáp án đúng viền xanh + chữ "Đáp án đúng"; dưới là "Chính xác!" hoặc "Đây là đáp án đúng." rồi "Lời giải: …". Ô tự giải thích (không bắt buộc) hiện sau cùng.
5. **Nút hành động dính đáy**, luôn đúng một nút chính theo trạng thái: chưa nộp "Nộp câu này" (tắt cho tới khi chọn); bước 2 "Thử lại" (primary) cùng "Xem đáp án" (secondary); xong "Sang câu tiếp"; câu cuối và đã xong hết "Hoàn thành".
6. Khi xong tất cả: một dòng nền `--kin-tt-nen-xong` "Bạn đã chữa xong 2 câu: 1 câu tự làm đúng, 1 câu đã xem đáp án."

**Máy tính 1280px**: cột 640px căn giữa; thanh bước ở trên, nút hành động nằm cuối khối câu (không dính đáy).

### G. Bài tập (tab "Bài tập" trong bài giảng)

Chỉ thiết kế **nội dung của tab**; khung bài giảng (video, thanh bên, "Đánh dấu xong") giữ nguyên.

**Điện thoại 390px**: danh sách bài tập, mỗi bài một khối cách nhau bằng đường kẻ mảnh, không viền bao:
1. Dòng đầu: tên bài (đậm, xuống dòng được) và, bên phải hoặc ngay dưới, "Hạn 25/10/2026" (đỏ nếu còn dưới 24 giờ, xám khi đã hết hạn). Chưa thêm giờ: dữ liệu hiện chỉ có ngày (mục 9, điểm 21; câu hỏi mở 7 và 8).
2. Hướng dẫn (nếu có) tối đa 3 dòng, 13,3px.
3. Một dòng trạng thái bằng chữ (không chỉ màu): "Chưa nộp" · "Đã nộp lúc 20:15 22/10/2026 — chờ chấm điểm." (đề xuất bỏ giây; mã hiện in `20:15:07 22/10/2026`) · "Điểm: 8,5/10" (xanh lá; đề xuất dấu phẩy như Việc của tôi, mã hiện in `8.5/10`) kèm "Nhận xét: …" · với bài làm trên web "Đã làm 3/5 câu — tự lưu khi bạn trả lời." · khi khoá "Đã hết hạn 25/10/2026" (chỉ bài làm trên web có trạng thái khoá).
4. Một nút chính 52px rộng hết bề ngang: bài nộp file "Nộp bài" (chữ "(hoặc kéo-thả file)" chỉ hiện trên máy tính); đã nộp thì "Nộp lại bài"; bài làm trên web "Bắt đầu làm bài" / "Tiếp tục làm bài" / "Xem lại bài làm". Liên kết phụ cùng hàng: tên file đề bài (mở `/xem-tai-lieu`).
5. Bài làm trên web mở rộng ngay trong khối: mỗi câu "Câu N." + điểm "{points}đ" + đề, các ô đáp án cao ≥ 44px (đang chọn: viền `--kin-nhan-nen` 2px), ô tự luận 3 dòng có "Đang lưu..." khi lưu; cuối cùng liên kết chữ "Thu gọn". Sau khi khoá: ô đúng viền xanh, ô sai tôi chọn viền đỏ, kèm chữ "Giải thích:".
6. Bài kiểm tra Azota (nếu `lesson.azotaUrl`): một hàng tên bài + "Deadline: …" và nút "Làm bài →" mở tab mới. Mã hiện in cứng tên "Quiz — Xử lý số liệu" cho mọi bài Azota; thiết kế để chỗ tên là tên bài học thật (chưa có trường riêng, mục 9, điểm 23), không dùng lại chữ cứng đó. Bài học loại quiz không có tab này mà hiện thẳng khối "Bài kiểm tra Azota" + nút "Làm bài trên Azota →".
7. Trống: "Bài học này không có bài kiểm tra." (giữ chữ).

**Máy tính 1280px**: tab nằm trong cột nội dung bài giảng; mỗi bài tập một hàng: tên và trạng thái trái, nút phải; câu hỏi bài làm trên web mở bên dưới hàng, cột 720px.

### H. Đề Azota (nhập điểm)

Chỉ dành cho đề không có câu hỏi trong KiN. Một cột 480px (máy tính) hoặc rộng hết bề ngang trừ lề (điện thoại): tên đề, thông báo xanh "Đã mở Azota. Sau khi hoàn thành bài thi, nhập điểm của bạn dưới đây.", một ô số 52px "Điểm của bạn (ví dụ: 112 hoặc 8.5)", nút chính "Nộp kết quả" 52px, liên kết "Mở lại Azota →", rồi liên kết "← Về danh sách đề thi" cao 44px (mã hiện chưa có, mục 9, điểm 24). Giai đoạn "đang chuyển hướng": ô vuông đếm 5, 4, 3, 2, 1 và chữ "Đang chuyển hướng đến Azota...".

---

## 5. Hành động

| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| (chip) "Tất cả", "ĐGNL HSA", "ĐGNL HCM", "Tốt nghiệp THPT", "TSA Bách Khoa", "BCA" | Lọc danh sách theo danh mục | Chỉ trạng thái trên máy | Không gọi máy chủ |
| "Vào thi" | Mở cổng vào đề | Liên kết tới `/student/thi-thu/{id}` | Chỉ hiện khi đề "Đang mở" và học sinh đã ghi danh khoá của đề |
| "Xem lại" (danh sách) | Mở màn kết quả của đề | `/student/thi-thu/{id}` (trang thấy đã có kết quả nên vào thẳng "Kết quả của bạn") | |
| "← Về danh sách đề thi" | Về danh sách | Liên kết `/student/thi-thu`, chuyển tiếp tới `/thi-thu` | Hiện có ở B (kể cả lúc đếm lùi Azota), D và màn lỗi "Không tìm thấy đề thi"; KHÔNG có ở E (có "← Quay lại kết quả"), F (có "← Xem bài làm") và H. Test chỉ kiểm B và D, dựa vào `a[href="/student/thi-thu"]` hiển thị (ô lỗi chỉ cần có một liên kết bất kỳ) |
| "▶ Bắt đầu làm bài" | Tạo lượt thi mới hoặc tiếp tục lượt đang làm | `api.examAttempts.start` → `POST /api/exams/{id}/start`, thân `{password}` | Lỗi: "Sai mật khẩu đề thi" (403); "Đề thi này chỉ dành cho học viên đã ghi danh khoá học liên quan" (403); "Đề thi này yêu cầu phí — liên hệ tư vấn để được duyệt quyền vào thi" (402); "Đề thi này chưa có câu hỏi trong platform" (409); "Không thể bắt đầu bài thi" (500). Học sinh không thấy giá, không có nút trả tiền |
| "▶ Vào phòng thi ngay" | Đề Azota: bắt đầu đếm 5 giây rồi mở tab Azota | Đặt `phase = "entering"`; hết đếm `window.open(azotaUrl, "_blank")`, sang phase `submit` | Chỉ hiện khi đề không có câu hỏi và có `azotaUrl`; nếu thiếu: "Đề thi chưa có link Azota" / "Admin cần cập nhật Azota URL cho đề thi này." |
| "Nộp kết quả" / "Đang lưu..." | Đề Azota: ghi điểm tự nhập | `POST /api/exam-results {examId, score}` | Điểm do học sinh tự khai, máy chủ chỉ kiểm 0–150 (cố định, không theo `totalPoints` của đề); nộp lại ghi đè điểm cũ, không giữ lần cao nhất; lỗi "Điểm không hợp lệ", "Lỗi nộp kết quả", "Thông tin điểm không hợp lệ (0–150)" |
| "Mở lại Azota →" | Mở lại liên kết | `<a target="_blank">` | |
| (chọn ô đáp án MC) | Lưu đáp án ngay khi chọn | `PATCH /api/exams/attempts/{attemptId}/answer {questionId, optionId}` | Lỗi bị nuốt im lặng (`.catch(() => {})`); máy chủ từ chối "Đã hết giờ làm bài", "Phần này đã hết giờ" (409) |
| (rời ô điền ngắn / tự luận) | Lưu chữ khi rời ô | `PATCH .../answer {questionId, textAnswer}` | Cũng được gửi lại hết một lượt trước khi nộp bài |
| "Đúng" / "Sai" (từng ý) | Lưu đánh giá một ý | `PATCH /api/exams/attempts/{attemptId}/answer-bool {optionId, answerTrue}` | Tên truy cập "Đúng" / "Sai"; lỗi nuốt im lặng |
| "Câu 4 / 10" (nút trên thanh Navy) | Mở / đóng lưới nhảy câu | Trạng thái trên máy (`aria-expanded`, `aria-controls="luoi-nhay-cau"`) | |
| (ô số trong lưới) | Cuộn tới câu và đóng lưới | `scrollIntoView` | Tên truy cập "Câu N, đã trả lời" / "Câu N, chưa trả lời" |
| "Câu trước" / "Câu sau" | Cuộn tới câu liền trước / liền sau | `scrollIntoView` | Tắt ở câu đầu / câu cuối |
| "Nộp bài" (chân trang) | Mở hộp xác nhận | Trạng thái trên máy | Luôn qua hộp, hết giờ thì tự nộp không qua hộp |
| "Nộp bài" (trong hộp) | Nộp thật | Gửi lại các câu viết chưa lưu, rồi `POST /api/exams/attempts/{attemptId}/submit` | Không hoàn tác. Lỗi: chân trang hiện "Nộp bài thất bại, thử lại". Thưởng Coin cộng trong cùng lệnh này |
| "Làm tiếp" | Đóng hộp, quay lại làm | Trạng thái trên máy | Tiêu điểm mặc định của hộp (nhấn Enter nhầm không nộp); Esc có tác dụng như "Làm tiếp" |
| (tự động) rời tab | Đếm một lần rời tab | `PATCH /api/exams/attempts/{attemptId}/tab-event` khi `visibilitychange = hidden` | Chỉ đếm, không quay màn hình, không camera. Vượt `QUIZ_MAX_TAB_SWITCH` (3) thì không được thưởng Coin |
| (tự động) hết giờ | Tự nộp khi Phần cuối hết giờ (hoặc cả đề nếu không chia Phần) | cùng lệnh submit | Hết giờ một Phần giữa chừng chỉ khoá Phần đó và sang Phần kế |
| "Xem lại bài làm" | Mở màn xem lại | `GET /api/exams/attempts/{id}/review` | Cần có lượt thi (lượt vừa làm hoặc lượt gần nhất trong lịch sử); lỗi "Không tải được bài làm" |
| "Thi lại đề này" | Quay về cổng vào đề để làm lượt mới | Trạng thái trên máy, sau đó "Bắt đầu làm bài" | Đề làm trong KiN: điểm giữ lần cao nhất (`upsertBestResult`), nhưng màn D ngay sau lượt mới hiện điểm của lượt đó. Coin KHÔNG thưởng lại: mỗi (học sinh, đề) chỉ một lần (`addQuizRewardCoins`, test `t-quiz-reward.ts`), nên lượt thi lại luôn có `coinsEarned = 0`. Đề Azota: nộp lại ghi đè điểm cũ |
| "← Quay lại kết quả" | Về màn kết quả | Trạng thái trên máy | |
| "Chữa lại các câu sai" | Mở chữa bài | `GET /api/exams/attempts/{id}/correction` | Chỉ hiện khi `correctableCount > 0`; chữa bài không đổi điểm |
| (chip số câu) | Nhảy sang câu cần chữa | Trạng thái trên máy | |
| "Nộp câu này" / "Đang nộp…" | Nộp một lần chữa | `POST /api/exams/attempts/{id}/correction/{questionId}`, thân `{action:"submit", optionId}` hoặc `{action:"submit", text}` | Tối đa 2 lần nộp mỗi câu; hai lần bấm cùng lúc không đếm đôi (khoá ở máy chủ); 409 thì tải lại |
| "Thử lại" | Mở lại ô chọn ở bước 2 | Trạng thái trên máy | Gợi ý vẫn hiện |
| "Xem đáp án" | Xem đáp án sau ít nhất một lần nộp | `POST .../correction/{questionId}` thân `{action:"reveal"}` | 409 nếu chưa nộp lần nào |
| "Lưu" (ô tự giải thích) | Lưu một câu tự viết | thân `{action:"reflect", text}` | Chỉ hiện khi đã xem gợi ý và đã xong câu; tối đa 500 ký tự |
| "Sang câu tiếp" | Sang câu cần chữa kế tiếp | Trạng thái trên máy | |
| "Hoàn thành" | Đóng chữa bài, tải lại bài xem lại | `onClose` → `GET /review` | Chỉ ở câu cuối khi đã chữa xong hết |
| "← Xem bài làm" | Đóng chữa bài giữa chừng | `onClose` | Tiến độ đã lưu ở máy chủ |
| "Nộp bài (hoặc kéo-thả file)" / "Nộp lại bài (hoặc kéo-thả file)" / "Đang nộp..." | Bài tập nộp file: tải file lên rồi ghi nhận | `uploadToCloudinary(file, "assignments/submissions")` rồi `POST /api/assignments/{id}/submit {fileUrl, fileName}` | Nộp lại ghi đè bản cũ và xoá điểm, nhận xét cũ. Máy chủ không kiểm hạn nộp (nộp sau hạn vẫn được nhận). Bài đã chấm thì hỏi bằng hộp xác nhận "Nộp lại bài đã chấm?" (nút "Nộp lại"). Không có nút nếu Cloudinary chưa cấu hình. Lỗi hiện bằng `alert("Nộp bài thất bại: …")` |
| "Bắt đầu làm bài" / "Tiếp tục làm bài" / "Xem lại bài làm" (bài tập) | Mở các câu của bài làm trên web | `GET /api/assignments/{id}/answer` (tải ngay khi thẻ bài hiện ra, không đợi bấm nút; nút chỉ bung các câu ra) | Chỉ học sinh; phải ghi danh khoá |
| (chọn đáp án / rời ô tự luận trong bài tập) | Tự lưu từng câu | `PATCH /api/assignments/{id}/answer {questionId, optionId | textAnswer}` | Không có nút "Nộp"; khoá khi qua hạn: "Đã hết hạn nộp bài, không thể sửa nữa" (403); lỗi hiện `alert(...)` rồi tải lại |
| "Thu gọn" | Gập các câu bài tập | Trạng thái trên máy | |
| "Làm bài →" / "Làm bài trên Azota →" | Mở bài Azota | `<a href={azotaUrl} target="_blank">` | Nộp bài và chấm ở Azota, KiN không biết kết quả |
| (từ Việc của tôi) "Nộp bài" / "Làm bài" / "Xem bài đã nộp" / "Xem lại bài làm" / "Xem bài" / "Xem đề" | Mở bài giảng chứa bài tập (hoặc đề bài) | `/student/bai-giang/{lessonId}` hoặc `fileUrl` | Thuộc màn Việc của tôi, nhắc ở đây vì là lối vào |

---

## 6. Trạng thái

**A. Danh sách đề**
- Đang tải: ba thanh xám cao 80px (`animate-pulse`, nền `--kin-vien-thuong`). Đề xuất: ba hàng khung xương đúng hình dạng hàng thật; không dùng vòng xoay.
- Rỗng (không có đề trong danh mục): "Không có đề thi nào trong danh mục này". Đề xuất thêm một nút "Xem tất cả đề" đưa chip về "Tất cả".
- Lỗi tải (hiện chưa có): `useExams` trả `error` nhưng trang bỏ qua, rơi về trạng thái rỗng. Đề xuất: "Không tải được danh sách đề thi." + nút "Thử lại".
- Bình thường: như mục 4A.
- Đặc biệt: đề khoá khoá ("Thuộc khóa Toán 9 — chưa ghi danh"); đề đã làm ("Đã làm"); đề sắp diễn ra ("Chờ mở"); đề đã tắt ("Đã kết thúc", hiện học sinh đã đăng nhập không thấy vì danh sách chỉ lấy đề đang bật; đề quá ngày giờ thi vẫn là "Đang mở", mục 9 điểm 22).

**B. Cổng vào đề**
- Đang tải: vòng logo K (`KinLoader` cỡ 44, nhãn ẩn "Đang tải") giữa màn hình.
- Lỗi / không có đề: "Không tìm thấy đề thi" (đỏ) + liên kết "← Về danh sách đề thi". Hiện nay mất mạng cũng hiện đúng chữ này; đề xuất tách lỗi mạng ("Không tải được đề thi. Kiểm tra mạng rồi thử lại." + nút "Thử lại") khỏi không tìm thấy.
- Lỗi bắt đầu: dòng đỏ dưới nút (chuỗi mục 5).
- Cần mật khẩu: ô nhập hiện trên nút.
- Đang tiếp tục lượt dang dở: bấm "Bắt đầu làm bài" mở lại đúng lượt cũ, kèm các đáp án đã lưu và số lần rời tab (máy chủ trả).
- Đề không có câu hỏi, không có liên kết Azota: khối đỏ "Đề thi chưa có link Azota" / "Admin cần cập nhật Azota URL cho đề thi này."

**C. Phòng thi**
- Đang vào: nút "Bắt đầu làm bài" ở B; vào xong thì thay cả trang.
- Đề không có câu: "Đề này chưa có câu hỏi."
- Đã rời tab: dải "Bạn đã rời khỏi tab N lần. Hệ thống có ghi lại số lần, không quay màn hình."
- Sắp hết giờ: còn ≤ 5 phút thông báo đọc "Còn dưới 5 phút."; còn ≤ 1 phút "Còn dưới 1 phút."; đồng hồ đổi tông đỏ nhạt khi còn dưới 60 giây (`remainingSec < 60`).
- Phần đã hết giờ: "Đã hết giờ Phần này — không thể sửa câu trả lời." (khối mờ 60%, ô khoá). Phần chưa tới lượt bị ẩn hoàn toàn, không lộ đề.
- Đang nộp: hộp xác nhận đổi nhãn nút "Đang nộp…", khoá hai nút và Esc.
- Lỗi nộp: dòng đỏ ở chân trang "Nộp bài thất bại, thử lại". Nếu lần tự nộp khi hết giờ thất bại, hệ thống không tự thử lại (cờ `autoSubmitted`); học sinh bấm "Nộp bài" tay.
- Mất mạng khi lưu đáp án (hiện chưa có trạng thái): đề xuất dải "Chưa lưu được đáp án. Kiểm tra mạng, đáp án sẽ được gửi lại." (xem mục 12).

**D. Kết quả**: không có lỗi riêng (dữ liệu đã có). Đặc biệt: hạng ẩn khi rank = 0; dòng Coin ẩn khi 0; nút "Xem lại bài làm" ẩn khi đề không có câu hỏi trong KiN hoặc chưa có lượt thi.

**E. Xem lại**
- Đang tải: "Đang tải..." giữa màn hình (đề xuất khung xương).
- Lỗi: `reviewErr` hoặc "Không tải được bài làm" (đỏ, giữa màn hình) + liên kết "← Quay lại kết quả".
- Đề không cho xem đáp án: dải "Đề thi này chưa cho phép xem đáp án lúc này — chỉ hiện câu trả lời của bạn."
- Câu chưa chữa: "Câu này chưa chữa. Bấm Chữa lại các câu sai để thử trước — gợi ý sẽ hiện nếu chưa đúng, đáp án hiện sau khi bạn thử." (MC) / "… — đáp án hiện sau khi bạn thử." (điền ngắn).
- Tự luận: "Chưa chấm" hoặc "Điểm: x/y"; "Bạn chưa trả lời".

**F. Chữa bài**
- Đang tải: "Đang tải…".
- Lỗi: chữ đỏ (`role="alert"`) do máy chủ trả hoặc "Không tải được phần chữa bài"; lỗi lúc nộp: "Không thực hiện được" hoặc câu máy chủ ("Lỗi kết nối, thử lại sau" khi mất mạng).
- Không dùng được: lý do máy chủ ("Đề này chưa cho xem đáp án nên chưa có chế độ chữa bài.") + liên kết "Quay lại xem bài làm".
- Không có câu nào sai: "Không có câu nào cần chữa — bạn đã làm đúng các câu trắc nghiệm và câu điền ngắn." + liên kết "Quay lại xem bài làm".
- Bốn trạng thái của một câu: `new` (chưa nộp), `hint` (sai lần 1, có gợi ý), `solved` ("Chính xác!"), `revealed` ("Đây là đáp án đúng."). Câu chưa có gợi ý: sai lần 1 là hiện đáp án luôn. Câu làm xong mà chưa có lời giải: "Câu này chưa có lời giải chi tiết."
- Xong hết: "Bạn đã chữa xong N câu: a câu tự làm đúng, b câu đã xem đáp án."

**G. Bài tập**
- Đang tải danh sách: không có chữ; đề xuất khung xương hai khối. Bài làm trên web đang tải: "Đang tải...".
- Rỗng: "Bài học này không có bài kiểm tra."
- Chưa nộp / đã nộp chờ chấm / đã chấm / nộp lại (mục 3G). Bài nộp file không có trạng thái "Đã hết hạn": quá hạn vẫn hiện "Hạn …" và vẫn nộp được.
- Bài làm trên web: đang làm ("Đã làm a/b câu — tự lưu khi bạn trả lời."), đang lưu ("Đang lưu..."), đã khoá ("Đã hết hạn dd/mm/yyyy" + "Đã hết hạn — xem lại đáp án bên dưới." + "Một số câu tự luận chưa được chấm, điểm có thể thay đổi." khi còn tự luận chưa chấm; tự luận: "Chưa được giáo viên chấm.").
- Lỗi nộp / lưu: hiện nay `alert(...)` ("Nộp bài thất bại: …", "Lưu đáp án thất bại"); đề xuất dòng lỗi trong khối kèm "Thử lại".
- Không có nút nộp: khi Cloudinary chưa cấu hình (không có chữ giải thích). Đề xuất: "Chưa nộp file được lúc này. Báo thầy/cô giúp em." (xem mục 12).

**H. Azota**: "Đang chuyển hướng đến Azota..." (đếm 5 giây), rồi biểu mẫu nhập điểm; lỗi dưới ô nhập (chữ đỏ 11,1–13,3px).

---

## 7. Chữ bắt buộc giữ nguyên

Các chuỗi dưới đây được các bài test trong `tools/local-e2e/` kiểm trực tiếp (đối chiếu từng chuỗi với tệp test ngày 22/10/2026). Đổi một chữ là test đỏ, trừ những chỗ ghi rõ "test không kiểm" hoặc "dữ liệu của bài test".

### `ui-exam-room.ts` (phòng thi, Figma 27:2)
- Khung: phần tử `[data-vung="phong-thi"]` đúng một cái; `<header>` và `<footer>` (một `<header>`, một `<footer>` trong trang); `[data-phong-thi-phan]` (dòng đầu thanh Navy); `[data-dai-roi-tab]` (dải rời tab); `[data-cau]` (mỗi câu); `id="q-{questionId}"`; `role="timer"` đồng hồ. (Thuộc tính `data-da-tra-loi` trên ô lưới có trong mã nhưng không bài test nào dùng; test tìm ô lưới theo tên truy cập `Câu N, đã trả lời` / `Câu N, chưa trả lời` và kiểu viền liền/đứt.)
- Nút: tên khớp `/Bắt đầu làm bài/`; nút trên thanh Navy tên khớp `/^Câu \d+ \/ \d+/` ("Câu 1 / 2") có `aria-expanded`; trong chân trang đúng **ba** nút tên "Nộp bài", "Câu trước", "Câu sau" (mỗi nút cao ≥ 44px, rộng ≥ 44px); điều hướng tên "Nhảy tới câu"; hộp thoại tên "Nộp bài ngay?" với nút "Làm tiếp" (nhận tiêu điểm) và nút "Nộp bài" (tên chính xác).
- Câu chữ: dòng đầu thanh Navy in đúng tên đề / tên Phần lấy từ dữ liệu, chữ hoa do CSS, văn bản gốc giữ nguyên. Bài test dùng đề mẫu tên "Phòng thi thử" (hiện "PHÒNG THI THỬ") và Phần "Phần 1: Toán và xử lý số liệu" (nguyên văn, không thêm "Phần 1 · "); đó là DỮ LIỆU của bài test, không phải chữ giao diện cố định; "còn lại" (đúng chữ, ở dưới đồng hồ); "còn lại của Phần 1"; nhãn đồng hồ khớp `/^Còn lại \d+ phút \d+ giây$/`; đồng hồ định dạng `mm:ss`; "Đã trả lời 1 / 2 câu"; "Đã trả lời 0 / 2 câu Phần 1"; "Đã trả lời 1 / 2 câu Phần 1"; "Hết giờ hệ thống tự nộp bài."; "Hết giờ Phần 1 thì Phần 1 khoá lại, tự sang Phần 2. Không sửa lại được."; ô lưới `Câu {N}, đã trả lời` và `Câu {N}, chưa trả lời` (viền liền / viền đứt); "Bạn đã rời khỏi tab 1 lần. Hệ thống có ghi lại số lần, không quay màn hình." (nguyên văn, kể cả "2 lần"); "Bạn còn 2 câu chưa trả lời. Sau khi nộp không sửa lại được."; "Kết quả của bạn" (tiêu đề `heading` sau khi nộp); lựa chọn "Đáp án một" (chữ của lựa chọn trong đề mẫu, test bấm theo chữ này); ý Đúng/Sai: `role="radio"` tên "Đúng" và "Sai".
- Kích thước và màu: ô đáp án `label:has(input[type=radio])` cao ≥ 52px; nút Đúng/Sai cao ≥ 44px; thanh trên `rgb(30, 58, 138)` chữ trắng bất kể chủ đề Cổ vịt; nút "Bắt đầu làm bài" nền `rgb(30, 58, 138)`; ô đang chọn viền `rgb(30, 58, 138)`; đồng hồ phông đơn cách (khớp `/mono/`); trang không cuộn dọc, thân `overflow-y: auto`, thanh trên `top = 0`, chân trang `bottom = chiều cao màn hình`; ở 390px không tràn ngang, đồng hồ nằm trong thanh Navy, ba nút chân trang đều ≥ 44×44, không có thanh module "Module của học sinh".
- Hành vi: chưa rời tab thì không có dải; Esc đóng hộp nộp bài không nộp; nộp xong không còn `role="timer"`.

### `ui-correction.ts` (chữa bài)
- "Xem lại bài làm" (nút); khớp `/Bạn có 4 câu làm chưa đúng/`; "Chữa lại các câu sai" (nút); "Giải thích:"; khớp `/Câu này chưa chữa/` (số lần xuất hiện được đếm: đúng 4 lần và đúng 1 chữ "Giải thích:" trên màn xem lại lúc chưa chữa câu nào, nên các nhãn trạng thái mới đề xuất ở 4E phải dùng chữ khác, không lặp hai cụm này; sau khi chữa xong, test đòi hết "Câu này chưa chữa"); heading "Chữa bài"; "0/4 câu đã xong"; khớp `/không đổi điểm bài thi/`; điều hướng tên "Các câu cần chữa" (chip chỉ chứa số, vd "1|2|3|5", thêm " ✓" khi xong); radio tên là chữ của lựa chọn; "Nộp câu này"; "Gợi ý:"; "Chưa đúng." (câu), "Chưa đúng" (chữ đơn trong ô đã chọn, đúng một lần); "Thử lại"; "Xem đáp án"; "Đáp án đúng" (chữ đơn) và "Đáp án đúng:" (điền ngắn); "Chính xác!"; "Đây là đáp án đúng."; nhãn khớp `/gợi ý ở trên giúp bạn ở chỗ nào/`; "Lưu" (chính xác); "Sang câu tiếp"; "Câu trả lời của bạn" (nhãn ô điền); `/Bạn đã chữa xong 4 câu: 1 câu tự làm đúng, 3 câu đã xem đáp án/`; "Hoàn thành"; "4/4 câu đã xong"; "1/4 câu đã xong".
- Giao diện: ở 390px không tràn ngang; các nút bước ≥ 44×44.

### `t-correction.ts` (API chữa bài)
- Khoá trường: `CorrectionItem` có `index`, `state` ("new", "hint", "solved", "revealed"), `tries`, `hint`, `answer` (null tới khi xong), `canReveal`, `canReflect`, `reflection`, `yourOptionId`, `yourText`, `lastTryCorrect`; lựa chọn chỉ có `id` và `text`; `summary {total, solved, revealed, remaining}`; `available`, `reason`; `/review` có `correctableCount` và `correctionPending` từng câu. Giới hạn: tối đa 2 lần nộp, gợi ý ≤ 1000 ký tự, tự giải thích ≤ 500, điền ngắn ≤ 200. Mã trạng thái 401, 404, 409, 403, 400 như test. Khi đề không cho xem đáp án (ba cấu hình: `never`, `after_exam_ends` chưa hết hạn, `hideAnswerForWrong`): `available = false`, không liệt kê câu nào, `reason` khác rỗng, thao tác trả 403, `/review` báo `correctableCount = 0`. Test KHÔNG kiểm chữ của `reason`; câu "Đề này chưa cho xem đáp án nên chưa có chế độ chữa bài." chỉ nằm trong mã (`examCorrectionServer.ts`), đổi được mà không làm test đỏ (vẫn nên giữ để các màn thống nhất).

### `t-exam-room-lib.ts` (`examRoom.ts`)
- `formatClock(1902) = "31:42"`, `formatClock(5400) = "90:00"`, âm hoặc `NaN` → `"00:00"`.
- `spokenClock(1902) = "31 phút 42 giây"`, `spokenClock(42) = "42 giây"`.
- `lowTimeAnnouncement`: `"Còn dưới 5 phút."` (≤ 300 giây), `"Còn dưới 1 phút."` (≤ 60), rỗng ngoài các mốc và khi hết giờ; chỉ ba giá trị khác nhau trong 5 phút cuối.
- `roomHeading`: tên đề; tên Phần bắt đầu bằng "Phần" giữ nguyên; còn lại "Phần n · tên".
- `questionCounter(18, 50) = "Câu 18 / 50"`, không có câu: "Chưa có câu hỏi".
- `progressLine(17, 50, "Phần 1") = "Đã trả lời 17 / 50 câu Phần 1"`.
- `timeUpNote` hai chuỗi như trên; `shortSectionName`: "Phần 1", "Phần Trắc nghiệm", "Phần 3" (tên "Khoa học" ở vị trí 2).

### `t-quiz-reward.ts` (thưởng Coin)
- Phản hồi `POST /api/exams/attempts/{id}/submit`: test kiểm `score` là số và `coinsEarned` đúng giá trị (nộp lại cùng lượt và làm lại cùng đề đều trả `coinsEarned = 0`, chỉ một giao dịch `quiz_reward`). `totalPoints` và `rank` có trong mã nhưng test này không kiểm.
- Hằng số: thưởng cơ bản 5 (`QUIZ_REWARD_BASE`), cộng 5 khi nhanh (`QUIZ_REWARD_FAST_BONUS`); từ 50% điểm mới được thưởng; nhanh = từ 80% điểm và dùng ≤ 50% thời gian và ≥ 30 giây; rời tab quá 3 lần không được thưởng; nộp sau hạn không được thưởng; tối đa 5 lượt thưởng mỗi ngày; mỗi đề chỉ thưởng một lần cho mỗi học sinh (làm lại không thưởng thêm); gia sư làm đề không được thưởng.
- Học sinh gửi yêu cầu nạp Coin bằng tiền (`POST /api/wallet/topups`) nhận 403 với lời "không nạp bằng tiền". Giao diện không được có nút nạp hay mua Coin cho học sinh.

### Các test chung có chạm màn này
- `ui-role-everything.ts`, `ui-student-shell.ts`, `ui-links-everywhere.ts`: `/student/thi-thu` phải chuyển tiếp tới `/thi-thu` và hiện trong vỏ học sinh; màn kết quả và màn chuẩn bị vào thi (B, D) **không có** thanh module nhưng **có** `a[href="/student/thi-thu"]` hiển thị, bấm vào dẫn tới `/thi-thu` trong khung học sinh (chữ cũ: "← Về danh sách đề thi"); trong "Khác" có mục "Thi thử" (tên chính xác).
- `t-kin-components.ts`: toàn mã nguồn không còn `window.confirm` hoặc `confirm()`, mọi hỏi lại đi qua `KinConfirm`/`useKinConfirm`; trang `bai-giang/[lessonId]/page.tsx` phải dùng `await ask(` với số `useKinConfirm()` bằng số `{dialog}`; không còn chữ nhỏ hơn 11,1px (`text-[Npx]`, `fontSize`).
- `t-student-todo.ts`, `t-student-todo-lib.ts` (lối vào bài tập): nhãn trạng thái "Sắp hết hạn", "Cần nộp", "Quá hạn", "Đã nộp", "Đã chấm", "Đã làm"; nút "Nộp bài" (bài nộp file) và "Làm bài" (bài làm trên web) trỏ `/student/bai-giang/{lessonId}`; điểm viết dấu phẩy (test kiểm hàm `fmtScore`: "18,4/25"). `ui-student-shell.ts` kiểm liên kết "Nộp bài" ở Việc của tôi.
- `t-thu-vien.ts`: nhãn "Đã nộp · chờ chấm" và liên kết "Mở bài" dẫn tới `/student/bai-giang/{id}` (màn Thư viện).
- `ui-theme.ts`: phòng thi bị loại khỏi phép quét chủ đề (`[data-vung=phong-thi]`): phòng thi không theo chủ đề màu của người dùng.

---

## 8. Quy tắc cũng phải giữ

| Quy tắc | Áp vào màn này thế nào | Nguồn |
|---|---|---|
| **Next.js ở đây khác bản đã biết**: đọc `node_modules/next/dist/docs/` trước khi viết mã | Khi dựng, không giả định API cũ | `AGENTS.md`, `CLAUDE.md` |
| **Chỉ dùng token `--kin-*`**, không mã hex, không màu ngoài bộ | Danh sách đề hiện dùng `CATEGORY_GRADIENT` (mã hex ngoài bộ) cho ô mã đề: bỏ, dùng chữ | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 6; `src/app/kin-tokens.css` |
| **Màu không bao giờ nói một mình**: mọi trạng thái có chữ đi kèm | Lưới nhảy câu: viền liền / viền đứt + chữ "đã trả lời"; chữa bài: "Chưa đúng", "Đáp án đúng"; bài tập: "Chưa nộp", "Đã nộp", "Đã chấm" | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 6; `CorrectionPanel.tsx`, `ExamRoomView.tsx` |
| **Hai bộ mã ngữ nghĩa**: chữ cần 4,5:1, chấm và viền cần 3:1 | Chữ trạng thái dùng `--kin-tt-chu-*`; nền dải dùng `--kin-tt-nen-*`; chấm và viền dùng `--kin-tt-cham-*`, `--kin-tt-vien-*` | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 6 |
| **Phòng thi khoá cứng Navy**: không theo chủ đề màu người dùng (ô đang chọn tô cổ vịt dễ bị đọc nhầm là "đáp án đúng") | Mọi màn dưới `/student/thi-thu/[examId]` nằm trong `[data-vung="phong-thi"]`; Navy `#1e3a8a`, liên kết `#2563eb` (tối: `#60a5fa`) | `src/app/kin-tokens.css` (khối "Phòng thi: KHOÁ CỨNG"); `ui-exam-room.ts`; `ui-theme.ts` |
| **Nút ≥ 44px; ô đáp án 52px** | `--kin-cham-toi-thieu`, `--kin-cham-dap-an`; áp cả chip bước chữa bài, ô lưới nhảy câu, nút Đúng/Sai | `src/app/kin-tokens.css`; `ui-exam-room.ts`; `ui-correction.ts` |
| **Chữ không nhỏ hơn 11,1px** (`--kin-co-caption`) | Chữ phụ nhỏ nhất 13,3px (`--kin-co-small`) cho học sinh | `t-kin-components.ts` (sàn cỡ chữ) |
| **Không `window.confirm`**: hỏi lại bằng `KinConfirm` (tone `nguy-hiem` cho việc không hoàn tác) | Nộp bài; nộp lại bài đã chấm | `t-kin-components.ts` |
| **Không vòng xoay chờ**: dùng chữ, `KinLoader` hoặc khung xương | Nút "Đang nộp…", "Đang lưu..."; trang "Đang tải" | `src/components/kin/Button.tsx`, `KinLoader.tsx` |
| **Học sinh có thể dưới 16 tuổi**: không thêm màn thu thập dữ liệu cá nhân; không thêm hỏi tuổi, trường, số điện thoại | Phòng thi chỉ đếm số lần rời tab, ghi rõ "không quay màn hình, không dùng camera"; đừng đổi lời này sang cách làm khác | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 8 và 9; `BRIEF.md`; `ExamRoomView.tsx` |
| **Tiền: không thiết kế mua hay nạp Coin cho học sinh**; Coin chỉ nhận thưởng khi làm bài | Không có nút nạp ở phòng thi, kết quả, ví trên màn này; không hiện giá đề (đề thu phí có đường riêng do gia sư duyệt, học sinh chỉ thấy lời "Đề thi này yêu cầu phí — liên hệ tư vấn để được duyệt quyền vào thi") | `BRIEF.md`; `t-quiz-reward.ts`; `wallet-constants.ts` |
| **Học sinh không thấy tiền học phí** ở màn này; Coin là "tiền chơi", không đổi ra tiền | Số Coin chỉ ghi "+N Coin", không quy ra đồng | `src/lib/quizReward.ts` (nguyên tắc ở đầu tệp); `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 7 |
| **Thông báo không tên, không tiền** | Nhắc thi: tiêu đề "Nhắc nhở thi thử", "Có đề thi mới" chỉ chứa tên đề và ngày; không đưa điểm, hạng, tên học sinh khác vào nội dung | `src/app/api/cron/remind-exam/route.ts`, `api/exams/route.ts` |
| **Ngày giờ giờ Việt Nam, 24 giờ**: `dd/mm/yyyy`, `HH:mm` | Giữ định dạng của mã: ngày đề in nguyên chuỗi `dd/mm/yyyy` + `HH:mm`; mốc thời gian lượt thi dùng `toLocaleString("vi-VN")` ra dạng `HH:mm:ss d/M/yyyy` (giờ trước, ngày không đệm 0), theo múi giờ máy | `src/lib/examData.ts`; `docs/kin/CLAUDE-cho-kho-trien-khai.md` |
| **Ghi dữ liệu bằng POST/PATCH thường qua `fetch`, không dùng server action** (server action từng bị huỷ giữa chừng khiến nút kẹt "Đang lưu…") | Mọi lưu đáp án, nộp bài, chữa bài đều đã là `fetch`; đừng đổi sang server action | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 5.5 |
| **Giọng theo vai**: học sinh không thấy mục "chờ xác nhận" của gia sư hay phụ huynh | Màn này chỉ nói với học sinh, câu ngắn, xưng "bạn" | `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 7 |
| **Công bằng phòng thi**: giữ thứ tự xáo riêng từng lượt, ẩn Phần chưa tới lượt, đáp án chỉ về máy sau khi nộp | Thiết kế không được tiết lộ đề hoặc đáp án sớm (ví dụ không hiện câu hỏi hay lưới nhảy câu của Phần chưa tới lượt, không hiện đáp án đúng trong chữa bài trước khi thử). Ngoại lệ có chủ ý và được test đòi: ghi chú chân trang nói "tự sang Phần 2" (tên ngắn của Phần kế như "Phần 2", không có đề; tên bắt đầu bằng "Phần" nhưng không có số, ví dụ "Phần Trắc nghiệm", được in nguyên) | `api/exams/[id]/start/route.ts`; `examCorrectionServer.ts`; `t-correction.ts` |
| **Màn trước và sau bài thi phải có lối đi tiếp** | "← Về danh sách đề thi" ở B, D, lỗi; "← Quay lại kết quả", "← Xem bài làm" ở E, F | `ui-role-everything.ts`; `thi-thu/[examId]/page.tsx` (`ExamExitLink`) |

---

## 9. Điều đang chưa tốt ở bản hiện tại

Căn cứ vào mã. Thư mục `anh-hien-trang` chỉ có ảnh của gia sư (Hộp việc, Lịch, Lớp, Học phí, Tổng quan), **không có ảnh nào của màn học sinh làm bài hay bài tập**, nên các điểm dưới đây chưa được kiểm bằng ảnh chụp. Điểm nào chỉ suy từ mã ghi rõ "theo mã".

1. **Coin thưởng không bao giờ hiện cho học sinh.** Máy chủ trả `coinsEarned` khi nộp (`api/exams/attempts/[attemptId]/submit/route.ts`) nhưng kiểu `api.examAttempts.submit` trong `api.ts` bỏ trường này, `submitAttempt()` không đọc, trang cũng không phát sự kiện `coin:earned` như trang Cộng đồng và bài học đã làm. Học sinh làm đúng hạn, được +5 hoặc +10 Coin mà không biết. Phòng thi không có thanh trên (`StudentShell` trả thẳng nội dung, không gắn `CoinBalance`), nên có phát `coin:earned` ngay trong phòng thi cũng không có ví nào nghe; số dư chỉ đổi khi học sinh về lại một trang có vỏ (ví tự tải lại lúc gắn vào) và không có dòng nào nói vì sao. Chỗ duy nhất báo được là màn Kết quả (4D). Phần thưởng là lý do học sinh làm bài đều, và thiết kế học sinh đã đề xuất "Thưởng Coin hiện ngay sau khi nộp" (`hoc-sinh-giao-dien-tu-anh-doi-thu.md`).
2. **Không có lề ngang trên điện thoại ở B, D, E, F, H (theo mã).** `src/app/(student)/layout.tsx` đặt `main` không có `px-4` cho mọi đường dẫn phòng thi (`flush`), trong khi các màn con chỉ dùng `max-w-lg mx-auto` hay `max-w-2xl mx-auto` mà không có lề ngang. Ở 390px, các thẻ chạm sát mép màn hình. Bài test 390px chỉ kiểm màn làm bài và chữa bài (không tràn ngang), không kiểm lề.
3. **Cổng vào đề có sáu khung lớn, trong đó khung đầu lại chồng thêm khung nhỏ**: thẻ chính (bên trong có một ô biểu tượng và lưới bốn ô, mỗi ô một khung), hộp "Lưu ý quan trọng", hộp "Thông tin ghi nhận", thẻ "Quy định phòng thi", thẻ Top 10, thẻ Lịch sử. Ba hộp đầu nói gần cùng một việc (làm bài nghiêm túc, hệ thống ghi nhận). Đây chính là kiểu "dày, dư thừa" chủ dự án chê.
4. **"Thông tin ghi nhận" hiện giờ của lúc vẽ trang** (`new Date().toLocaleString("vi-VN")`), không phải lúc bắt đầu thi, dễ gây hiểu nhầm là mốc đã ghi.
5. **Chữ rất nhỏ cho học sinh**: kết quả, xem lại, bài tập, quy định đều dùng cỡ `text-xs` (12px) cho lựa chọn đáp án, lời giải, nhãn, ngày hạn. Đạt sàn 11,1px nhưng khó đọc trên điện thoại.
6. **Mất mạng lúc đang thi không báo gì.** Lưu đáp án (`api.examAttempts.answer`, `answerEssay`, `answerBool`) đều `.catch(() => {})`; giao diện vẫn tô ô đã chọn và tính "Đã trả lời", dù máy chủ chưa nhận. Học sinh nộp bài xong mới thấy câu thiếu. Thêm: nếu lần tự nộp khi hết giờ thất bại thì không tự thử lại.
7. **Nút "Nộp bài" nằm đầu chân trang, sát "Câu trước"** (thứ tự mã: Nộp bài, Câu trước, Câu sau) và cùng kích cỡ với hai nút còn lại; bấm nhầm khi chuyển câu là nguy cơ thật, dù đã có hộp xác nhận.
8. **Nút Đúng/Sai chỉ hiện chữ "Đ" và "S"** (chỉ tên truy cập là "Đúng"/"Sai"); với học sinh nhỏ, chữ tắt dễ hiểu nhầm.
9. **Danh sách đề**: ô vuông mã đề tô gradient bằng mã hex ngoài bộ token (`CATEGORY_GRADIENT`); ba ô số trong khung riêng; lỗi tải bị nuốt rồi hiện "Không có đề thi nào trong danh mục này" như thể chưa có đề; danh mục lọc thiên về luyện thi (ĐGNL HSA, HCM, TSA, BCA) không có mục cho kiểm tra lớp (mục 12; `Exam.category` là chữ tự do nên đề của lớp vẫn có thể có danh mục riêng, nhưng chỉ hiện ở chip "Tất cả"); danh sách giữ nguyên thứ tự máy chủ trả (đề mới tạo trước), đề đang mở chưa làm không được đưa lên đầu.
10. **Trang đề lỗi mạng hiện "Không tìm thấy đề thi"** y như đề không tồn tại, không có nút "Thử lại" (`phase = "error"`).
11. **Màn kết quả bỏ mất Top 10**: bảng xếp hạng chỉ có ở cổng vào đề, nên sau khi nộp học sinh thấy "Hạng #3" mà không thể xem ai đứng đầu mà không bấm quay lại. Chỉ ghi nhận hiện trạng: có đưa Top 10 sang màn Kết quả hay không liên quan tới tên đầy đủ của bạn cùng lớp có thể dưới 16 tuổi, nên là quyết định của chủ dự án (mục 12, câu 9), không phải việc thiết kế tự thêm.
12. **Bài tập: hạn chỉ có ngày, không có giờ** (`fmtDue` in `dd/mm/yyyy`), trong khi Việc của tôi in cả giờ ("hạn 07:00 25/10"). Hai nơi nói hai mức chi tiết về cùng một hạn, và giờ ở Việc của tôi không phải giờ gia sư chọn (xem điểm 21).
13. **Bài tập báo lỗi bằng `alert()`** ("Nộp bài thất bại: …", "Lưu đáp án thất bại") và không có chữ nào khi Cloudinary chưa cấu hình (nút nộp biến mất không lời giải thích).
14. **Bài tập làm trên web không có hạn sẽ bị coi là đã khoá** (chỉ là lưới an toàn, hiện không thể xảy ra qua giao diện): máy chủ đặt `locked = !dueDate || now >= dueDate` và chặn lưu "Đã hết hạn nộp bài, không thể sửa nữa". Đã đối chiếu mã: tạo bài làm trên web BẮT BUỘC có hạn (`POST /api/lessons/{id}/assignments` trả 400 "Bài tập làm trên web bắt buộc phải có Hạn nộp"; biểu mẫu `admin/khoa-hoc/[id]/page.tsx` chặn cả lúc tạo và lúc sửa; `PUT /api/assignments/{id}` từ chối xoá hạn). Chỉ bài nộp file mới được để trống hạn, và bài đó không có trạng thái khoá. Thiết kế không cần màn "không hạn" cho bài làm trên web.
15. **Bài tập không có hạn không hiện ở Việc của tôi** (`studentTodo.ts` trả `null` khi không có `dueDate`), nên chỉ tìm được qua bài giảng hoặc Thư viện.
16. **Đề Azota**: điểm do học sinh tự nhập, thang cố định 0–150 (`api/exam-results/route.ts`, ô gợi ý "0 — 150") bất kể đề thật có `totalPoints` khác; KiN không kiểm được. Điểm này đi thẳng vào GPA và bảng xếp hạng, và nộp lại ghi đè điểm cũ (kể cả thấp hơn) thay vì giữ lần cao nhất như đề làm trong KiN.
17. **Chữa bài: thanh bước dùng `flex-wrap`**, một em sai 20 câu sẽ có nhiều hàng chip chiếm cả màn trước khi tới câu hỏi.
18. **Ngày giờ theo múi giờ máy**: `computeExamStatus` và `toLocaleString("vi-VN")` đọc theo múi giờ của thiết bị, không cố định giờ Việt Nam; học sinh đổi múi giờ máy sẽ thấy đề mở sớm hoặc muộn.
19. **Hai nút chính của cổng vào đề mang ký tự "▶"** ("▶ Bắt đầu làm bài", "▶ Vào phòng thi ngay"): ký tự trang trí không cần thiết; test chỉ khớp phần chữ sau nên bỏ được.
20. **Số thập phân viết hai kiểu**: điểm ở Kết quả, danh sách đề, Xem lại, tab Bài tập và Top 10 in thẳng số của JavaScript (`8.5/10`, `1.5/2`); Việc của tôi dùng `fmtScore` (`8,5/10`, test `t-student-todo-lib.ts` đòi dấu phẩy). Cùng một điểm hiện hai cách tùy màn.
21. **Hạn bài tập là nửa đêm UTC, không phải cuối ngày**: biểu mẫu gia sư chỉ có ô ngày (`type="date"`), máy chủ lưu `new Date("2026-10-25")` = 00:00 UTC = 07:00 sáng 25/10 giờ Việt Nam. Hệ quả: bài làm trên web tự khoá lúc 07:00 sáng NGÀY HẠN (học sinh đọc "Hạn 25/10" sẽ tưởng còn tới hết ngày); Việc của tôi in "hạn 07:00 25/10" và đếm "Sắp hết hạn" theo mốc đó. Dữ liệu mẫu "hạn 21:00 25/10" ở mục 11 là hình dung cho thiết kế, chưa thể xảy ra với biểu mẫu hiện tại.
22. **Đề không bao giờ tự "Đã kết thúc"**: `computeExamStatus` chỉ chia "Sắp diễn ra" và "Đang mở" theo giờ bắt đầu; quá ngày giờ thi đề vẫn "Đang mở" mãi (máy chủ `start` cũng không kiểm giờ). Nhãn "Đã kết thúc" chỉ ứng với `active = false`, mà danh sách học sinh chỉ lấy `active=true`, nên đề bị tắt biến mất khỏi danh sách (kể cả đề em đã làm; vẫn mở được bằng liên kết trực tiếp). Khác với bài kiểm tra có hạn: bài làm trên web tự khoá, đề thi thì không.
23. **Tab Bài tập có chữ viết cứng**: khi bài học có `azotaUrl`, hàng Azota luôn ghi "Quiz — Xử lý số liệu" bất kể môn học (`TabBaiTap`), và bài học loại `document` hiện thêm khối "Bài kiểm tra Azota" với nút tắt "Chưa có link bài" (`<QuizContent />` gọi không có đường dẫn). Không có test nào giữ hai chuỗi này.
24. **Màn nhập điểm Azota (H) không có lối ra**: phase `submit` không gắn `ExamExitLink` (khác B, D), học sinh đi tiếp chỉ bằng nút Back của trình duyệt hoặc "Mở lại Azota →". Test lối ra (`ui-role-everything.ts`) chỉ phủ B và D.

---

## 10. Mẫu học từ đối thủ

Không có ảnh đối thủ nào về **màn làm bài, phòng thi, chữa bài hay giao bài** (đã xác nhận trong `docs/kin/thiet-ke/hoc-sinh-giao-dien-tu-anh-doi-thu.md`, dòng "Bài tập / Thi: Chưa có mẫu từ ảnh", căn cứ 28 ảnh; con số 12 ảnh còn lại ghi theo journal của phiên làm việc, nằm ngoài repo). Các đường dẫn `/tmp/rs/x/word/media/…` dưới đây là ảnh bung từ báo cáo research trên máy người làm tài liệu, đã kiểm còn tồn tại ngày 22/10/2026 nhưng là thư mục tạm, không thuộc repo. Chỉ có hai ảnh gần nghĩa. Đề xuất: **bám phòng thi hiện có của KiN và làm gọn**, mượn thêm vài nguyên tắc chung dưới đây.

- **Một nút, một lời hứa ngắn cho bài kiểm tra** — Preply, khối "Kiểm tra trình độ tiếng Anh của bạn" ("bài kiểm tra miễn phí 10 phút" + một nút hồng) — `/tmp/rs/x/word/media/f6259336567a0eb31e9ed4bd851a796948bf3fe4.jpg`. Áp cho cổng vào đề: tên đề, thời lượng, một nút "Bắt đầu làm bài".
- **Nói rõ thời lượng trước khi bắt đầu** — cùng ảnh Preply ("10 phút"). Áp cho ba con số lớn ở B.
- **Khối "Bài tập chưa nộp" (mục trái ghi "Bài tập chưa làm") là một khối riêng, hàng có cột Tên bài tập / Lớp / Hạn chót, rỗng thì có câu khích lệ ("Thật tuyệt vời! Tất cả bài tập đã được hoàn thành")** — Shub Classroom, Tổng quan học sinh — `/tmp/rs/x/word/media/11a4cd13870ab67784094443ad71645be24a7000.jpg`. Áp cho trạng thái rỗng và nhóm "Cần làm" ở lối vào; trên điện thoại chuyển bảng ba cột thành danh sách ba dòng, không giữ bảng.
- **Thanh trái có dấu tích xanh cạnh mỗi mục khi không còn việc** — cùng ảnh Shub (ảnh chụp lúc mọi mục đã xong nên không thấy số đếm khi còn việc). Tương ứng với số đếm đỏ trên module "Việc của tôi" của KiN (đã có, `kin-badge-dem`).
- **Danh sách lớp với cột "Bài tập"** — Shub, tab Lớp học — `/tmp/rs/x/word/media/b03b9eb482a1574f2f36a5bcfd692df399b7768a.jpg`. Chỉ lấy ý: mỗi lớp có số bài tập; không dùng bố cục bảng.
- **Bài tập thành một mục menu riêng và một tab ở hồ sơ học sinh** — TutorBird, menu có mục "Nộp bài tập về nhà" (ảnh menu đếm được 13 mục) và hồ sơ học sinh có tab cùng tên "Nộp bài tập về nhà" (trong 6 tab ngang) — `/tmp/rs/x/word/media/e5604abfe19a5c1ac74bf4ee27d1168e0ceb9da5.jpg` và `/tmp/rs/x/word/media/1cd39a2be6add5be756928d8b3f1bcb2c0cacc67.jpg`. Cảnh báo của journal: hơn mười mục menu và 6 tab ngang là quá nhiều cho điện thoại; KiN giữ bài tập trong tab bài giảng và Việc của tôi.
- **Ghi nhận bài tập về nhà bằng chip phần trăm và điểm 0 đến 10** — Sổ Gia Sư, chi tiết buổi học (phía gia sư) — `anh-tham-khao-so-gia-su/07-chi-tiet-buoi-hoc.jpg` (mô tả ở `research-so-gia-su-2026-10-19.md`, dòng 191). Chỉ để biết gia sư ghi điểm như vậy; không phải màn học sinh.
- **Banner vàng nhỏ, đóng được, nhắc việc cần làm** — Wyzant dashboard (mô tả ở `docs/kin/thiet-ke/hoc-sinh-giao-dien-tu-anh-doi-thu.md`, hàng "Trang chủ"; journal gốc `wf_d882f29b-ff4` nằm ngoài repo). Áp cho dải "Đề đang mở hôm nay" ở đầu danh sách đề nếu cần nhắc, nhưng chưa có ảnh gốc cụ thể.
- **Nút "Tiếp tục" xám cho tới khi chọn xong** — Preply, hộp đặt lịch học thử (nguyên tắc 3 trong `docs/kin/thiet-ke/hoc-sinh-giao-dien-tu-anh-doi-thu.md`; ảnh gốc `91b83e9d…jpg` ghi trong journal `wf_d882f29b-ff4`, ngoài repo). Tương ứng nút "Nộp câu này" ở chữa bài, đã có.

Không sao chép: bố cục desktop hai cột của Preply; khung chọn ngôn ngữ; bảng giá; nội dung blog; cờ bạc hoá phần thưởng.

---

## 11. Dữ liệu mẫu để điền vào thiết kế

Học sinh **Đỗ Hà**, lớp **Toán 9** của **Cô Lan** (`giasu@kin.local`), một trong 8 học viên đang học của 7 lớp. Hôm nay là **Thứ Năm 22/10/2026**; buổi Toán 9 là Thứ Sáu 23/10, 19:00–20:30. Học phí tháng 10 (đã thu 480.000đ) **không** hiện ở màn này.

1. **Đề đang mở**: "Kiểm tra 15 phút Toán 9: Hệ phương trình", mã THPT.07, 22/10/2026 · 08:00 (đã qua giờ bắt đầu so với "hôm nay" 22/10, nên `computeExamStatus` ra "Đang mở"; ghi 23/10 thì đề phải là "Sắp diễn ra" và không có nút "Vào thi"), 15 phút, 10 câu, 6 thí sinh, danh mục "Tốt nghiệp THPT".
2. **Đề sắp diễn ra**: "Thi thử Toán 9 số 3", mã THPT.08, 30/10/2026 · 08:00, 45 phút, 40 câu → nhãn "Sắp diễn ra", chữ "Chờ mở".
3. **Đề đã làm**: "Thi thử ĐGNL HSA số 2", mã HSA.02, 150 điểm, đề chia Phần ("Phần 1: Toán và xử lý số liệu" 20 phút, "Phần 2: Ngôn ngữ và văn học" 25 phút), Đỗ Hà đạt **112/150**, "Hạng #5 trong bảng xếp hạng".
4. **Phòng thi**: "Câu 4 / 10", đồng hồ **14:31**, "Đã trả lời 3 / 10 câu"; câu 4: "Nghiệm của hệ x + y = 5, x − y = 1 là:" với bốn lựa chọn A. (3; 2), B. (2; 3), C. (4; 1), D. (1; 4); Đỗ Hà đang chọn B. (2; 3) (sai; khớp mục 7). Nếu trả lời hết cả 10 câu thì hộp nộp bài ghi "Bạn đã trả lời hết các câu. Sau khi nộp không sửa lại được." (mục 5 dưới đây là trường hợp còn 2 câu chưa trả lời).
5. **Hộp nộp bài**: "Nộp bài ngay?" – "Bạn còn 2 câu chưa trả lời. Sau khi nộp không sửa lại được." Nút "Làm tiếp" và "Nộp bài".
6. **Kết quả**: "Kết quả của bạn", **8/10**, "Hạng #3 trong bảng xếp hạng" (6 thí sinh), làm trong 6 phút 40 giây nên **+10 Coin** (5 cơ bản + 5 nhanh: từ 80% điểm, dùng dưới nửa thời gian, ≥ 30 giây); ví hiện 250 Coin trước khi cộng.
7. **Xem lại và chữa bài**: "Bạn có 2 câu làm chưa đúng": câu 4 (trắc nghiệm, Đỗ Hà chọn B. (2; 3)) và câu 9 (điền ngắn, đáp án đúng "4", Đỗ Hà điền "8"); "0/2 câu đã xong · Chữa bài chỉ để học, không đổi điểm bài thi."; gợi ý câu 4: "Cộng hai phương trình để mất y."; sau khi chữa: "Bạn đã chữa xong 2 câu: 1 câu tự làm đúng, 1 câu đã xem đáp án."
8. **Bài tập nộp file**: "Bài tập 3: Hệ hai phương trình bậc nhất" · Toán 9 · Cô Lan giao 20/10 · "Hạn 25/10/2026" · "Chưa nộp" · hướng dẫn "Nộp ảnh chụp bài làm, ghi rõ họ tên." · nút "Nộp bài".
9. **Bài tập đã chấm**: "Bài tập 2: Phương trình bậc hai" · "Điểm: 8,5/10" · "Nhận xét: Làm tốt phần hình, chú ý dấu khi chuyển vế."
10. **Bài tập làm trên web**: "Bài tập trắc nghiệm: Đường tròn" · "Đã làm 3/5 câu — tự lưu khi bạn trả lời." · nút "Tiếp tục làm bài" · sau hạn "Đã hết hạn 25/10/2026" "Điểm: 4/5".
11. **Việc của tôi → bài tập**: dòng "Bài tập 3: Hệ hai phương trình bậc nhất hạn 21:00 25/10" · nhãn "Cần nộp" · nút "Nộp bài". (Với biểu mẫu hiện tại, giờ này sẽ là "hạn 07:00 25/10", mục 9 điểm 21. Dòng phụ "Toán 9 · Cô Lan giao 20/10" ở mục 8 chỉ có ở Việc của tôi, không có trong tab Bài tập.)
12. **Bạn cùng lớp trong Top 10**: Trần Gia Bảo 9, Nguyễn Minh Anh 8,5, Đỗ Hà 8, Lê Quốc Huy 7. (Dấu phẩy là cách viết đề xuất cho thiết kế; mã hiện in "8.5", mục 9 điểm 20. Ví dụ "8,5/10" ở mục 4G và ở điểm 9 của dữ liệu mẫu này (bài tập đã chấm) cũng theo cách viết đề xuất; bảng 3G ghi theo mã.)

---

## 12. Câu hỏi còn mở

Đã đối chiếu từng câu với mã ngày 22/10/2026: câu 7 và câu 14 cũ đã được mã trả lời một phần nên viết lại (câu 7 nay hỏi lúc khoá bài, câu 14 chỉ còn xin gật lề), câu 17 là câu mới, các câu còn lại giữ ý cũ và bổ sung dữ kiện đã kiểm. Chia hai loại để chủ dự án khỏi phải đọc hết:
- **Cần chủ dự án quyết** (chặn dựng phần liên quan): 1, 2, 3, 4, 6, 7, 9, 13, 16, 17.
- **Có mặc định, chỉ cần gật hoặc đổi**: 5, 8, 10, 11, 12, 14, 15. Không trả lời thì dựng theo mặc định ghi ở từng câu.

Không câu nào đề nghị đổi cách tính học phí hay giá, và không câu nào thêm dữ liệu cá nhân của học sinh dưới 16 tuổi. Câu 2 và câu 16 chỉ hỏi có hiển thị chỗ nào đó hay không; nếu câu trả lời kéo theo thu thêm hay hiện thêm dữ liệu về trẻ dưới 16 tuổi thì dừng lại hỏi người (`docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 9).

1. **Thưởng Coin hiện thế nào?** Máy chủ trả `coinsEarned` nhưng chưa có chỗ hiện. Mỗi (học sinh, đề) chỉ thưởng một lần, tối đa 5 lần mỗi ngày. Phòng thi và màn Kết quả đều không có ví (không có thanh trên), nên chỗ duy nhất báo được là màn Kết quả; phát `coin:earned` ở đó không có ai nghe, ví tự cập nhật khi học sinh về lại một trang có vỏ. Đề xuất ở D: một dòng "Bạn nhận được +10 Coin" chỉ khi > 0. Cần chốt: có hiện không, và khi 0 Coin có giải thích lý do không. Máy chủ chỉ trả số, nên muốn giải thích phải thêm lý do vào API (lý do thường gặp nhất là "đã thưởng đề này rồi" khi thi lại). Mặc định đề xuất: hiện dòng thưởng, không giải thích khi 0.
2. **Thưởng Coin cho bài tập về nhà không?** `quizReward.ts` ghi "quiz / bài tập về nhà" nhưng chỉ nộp bài thi (`exams/attempts/.../submit`) mới gọi `computeQuizReward`; bài tập (`assignments`) không thưởng. Thiết kế G có cần chỗ cho số Coin không? Đây là hỏi về chỗ hiển thị, không đề xuất đổi công thức thưởng. Chưa quyết thì G không có chỗ nào cho Coin.
3. **Mất mạng khi đang thi**: muốn xây trạng thái "Chưa lưu được" cho từng đáp án và thử gửi lại không? Đây là thay đổi hành vi (gửi lại, hàng đợi cục bộ), không chỉ giao diện.
4. **Danh mục đề**: `Exam.category` là chữ tự do (gia sư gõ hoặc chọn), còn năm chip lọc cố định lấy từ `COURSE_CATEGORIES` (ĐGNL HSA, ĐGNL HCM, Tốt nghiệp THPT, TSA Bách Khoa, BCA). Đề kiểm tra của Cô Lan cho lớp 7, 8, 9 nếu gõ danh mục riêng (ví dụ "Toán 9") chỉ hiện ở chip "Tất cả". Cần thêm chip, tạo chip từ danh mục có thật trong dữ liệu, hay ẩn bộ lọc khi học sinh chỉ có đề của lớp mình?
5. **Có thêm "Hôm nay thi gì" ở đầu danh sách đề** (đề đang mở đưa lên đầu, hay một dải riêng) hay chỉ sắp thứ tự? Máy chủ trả đề mới tạo trước, không theo trạng thái. Mặc định: chỉ sắp thứ tự như 4A, không thêm dải.
6. **Điểm Azota tự nhập (H)**: có giữ không? Nó đi vào GPA và xếp hạng nhưng không kiểm chứng được, thang cố định 150, và nộp lại ghi đè điểm cũ kể cả thấp hơn. Có thể thay bằng tải ảnh bài làm, hoặc ẩn khỏi bảng xếp hạng.
7. **Hạn bài tập tính đến lúc nào?** Biểu mẫu gia sư chỉ chọn ngày, máy chủ lưu nửa đêm UTC, tức 07:00 giờ Việt Nam của ngày hạn (mục 9, điểm 21). Bài làm trên web tự khoá lúc đó, trong khi học sinh đọc "Hạn 25/10/2026" và dễ hiểu là còn tới hết ngày. Muốn khoá lúc cuối ngày hạn (23:59 giờ Việt Nam) hay cho gia sư chọn giờ? Đổi cách lưu hoặc cách so sánh là đổi lúc khoá bài của mọi lớp, nên cần chủ dự án quyết. (Việc "không hạn thì bị khoá" đã được mã trả lời: bài làm trên web bắt buộc có hạn, mục 9 điểm 14.)
8. **Có in giờ ở hạn bài tập không?** Tab Bài tập chỉ in ngày; Việc của tôi in cả giờ nhưng giờ đó luôn là 07:00 chừng nào biểu mẫu chưa có ô giờ. Mặc định: giữ như hiện tại cho tới khi câu 7 chốt; nếu câu 7 chọn "có giờ" thì cả hai nơi in giờ như nhau.
9. **Bảng xếp hạng Top 10 sau khi nộp**: có đưa vào màn Kết quả không? Hiện học sinh dưới 16 tuổi thấy tên đầy đủ của bạn cùng lớp (`LeaderboardRow.user.name`) ở cổng vào đề; cần xác nhận chính sách hiển thị tên trước khi thêm một chỗ xem nữa. Mặc định: không thêm, giữ ở cổng vào đề.
10. **Mục "Thông tin ghi nhận"** (tên, giờ vẽ trang, mã đề): giữ một dòng làm minh bạch chống gian lận, hay bỏ hẳn? Mặc định đề xuất: bỏ (4B đã gộp ý chính vào khối quy định).
11. **Thứ tự ba nút ở chân phòng thi**: đề xuất Câu trước, Câu sau, Nộp bài. Có đồng ý đổi không (test chỉ kiểm tên và kích thước, không kiểm thứ tự)? Mặc định: đổi.
12. **Chữ "Đúng/Sai"** thay "Đ/S" nhìn thấy được: có đồng ý (tên truy cập giữ nguyên, nên test không đổi)? Mặc định: đổi.
13. **Lối vào phòng thi cho đề thu phí** (`ExamFull.price`, `ExamGuestAccess`): học sinh chưa được duyệt nhận "Đề thi này yêu cầu phí — liên hệ tư vấn để được duyệt quyền vào thi". Câu này nhắc tiền; có đúng với quyết định "học viên học miễn phí, không có bước mua" không? Hai tài liệu mô tả D01 khác nhau: `docs/kin/tien-do-dang-do.md` (mục W7) viết "quyết định D01: học viên học miễn phí", còn hàng D01 trong `docs/kin/backlog/quyet-dinh.csv` ghi chủ đề "Gói theo lớp: một giá hay nhiều gói?". Cần chủ dự án xác nhận quyết định nào đang có hiệu lực, rồi mới chốt câu chữ.
14. **Lề ngang ở B, D, E, F, H trên điện thoại**: đã xác nhận bằng mã, không còn là câu hỏi về hiện trạng: `(student)/layout.tsx` bỏ lề cho mọi đường dẫn phòng thi (`flush`), các màn con chỉ có `max-w-lg` hoặc `max-w-2xl` với `mx-auto`, nên ở 390px khung chạm sát mép (mục 9, điểm 2). Chỉ cần gật lề 16px thiết kế đã giả định. Ảnh chụp thật chưa có, nên chưa đo được khoảng hở cụ thể.
15. **Giờ hiển thị**: có ép giờ Việt Nam cho đề (không theo múi giờ máy) không? Hiện theo máy (`computeExamStatus`, `toLocaleString`). Mặc định đề xuất: ép giờ Việt Nam khi tính trạng thái đề.
16. **Hai chỉ số bài tập của đối thủ có cần ở phía học sinh không?** Sổ Gia Sư (đối thủ, không phải KiN) ghi "Hoàn thành BTVN %" và điểm 0–10 cho từng buổi (research dòng 191). KiN không có hai chip đó; KiN có tỷ lệ BTVN đã nộp (`mastery.ts`: `homeworkRatio`, dùng cho chỉ số "Nỗ lực"), điểm BTVN trong xếp hạng (`ranking.ts`), điểm trung bình bài tập tự nộp (`gpa.ts`: `computeAssignmentAverage`, hiển thị cạnh GPA, không tính vào GPA). Học sinh có thấy các số đó ở màn này không, hay chỉ trong báo cáo phụ huynh? Chưa có trường tương ứng ở phía học sinh. Mặc định: không thêm.
17. **Đề quá ngày giờ thi có đóng không?** Hiện không bao giờ đóng: danh sách vẫn ghi "Đang mở", máy chủ `start` không kiểm giờ, và nhãn "Đã kết thúc" chỉ xuất hiện khi gia sư tắt đề (lúc đó đề biến mất khỏi danh sách học sinh, mục 9 điểm 22). Mã đã có khái niệm "hết thời hạn của đề" (`hasExamWindowEnded`: giờ bắt đầu cộng thời lượng) nhưng chỉ dùng để mở đáp án (`after_exam_ends`). Muốn đề đóng cửa vào lúc đó (hay sau một thời gian ân hạn) và hiện "Đã kết thúc", hay giữ mở tới khi gia sư tắt?
