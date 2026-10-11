# Tiến độ đang dở — chốt 11/10/2026 (Claude, nhánh `claude/peaceful-bell-6vfrb5`)

Thọ yêu cầu tạm dừng để làm tiếp lúc khác. File này ghi đúng chỗ dừng. Ghi chú từng việc đã có trong Google Sheet
(cột H/I của Thọ; không đụng cột J/K của Thanh).

## Đã xong và đã đẩy lên nhánh (đều có test, xem `tools/local-e2e/`)
- Doanh thu: BE-074/075/076, FE-137, FE-153/154, FE-164
- Duyệt gia sư: FE-138
- Gia sư Dashboard: FE-141..146, 147, 149, 151, 155/156, 160, 161/162/163 (FE-148/152 giữ nguyên; FE-150 không áp dụng theo D01)
- TT-200 (phiếu học phí + đối soát VietQR/SePay), TT-201 (nhắc lịch), TT-202 (báo nghỉ sát giờ + buổi bù), TT-203 (chế độ gọn), TK-167 (chủ đề theo tài khoản)
- Đã ghi vào sheet cho các việc trên (TK-170 và TK-173 ghi "làm một phần", chưa tick).

## Đang dở: NV-188 (Chữa bài: gợi ý trước, đáp án sau)
Đã có (commit cuối): schema `ExamQuestion.hint`, `QuestionBankItem.hint`, bảng `ExamCorrection`; thư viện thuần
`src/lib/examCorrection.ts` (máy trạng thái: nộp lần 1 sai → gợi ý; lần 2 sai hoặc bấm "Xem đáp án" → đáp án; câu không
có gợi ý bỏ bước 2) — test thuần 15/15.
Còn lại:
1. API `GET/POST /api/exams/attempts/[attemptId]/correction[/questionId]` (chỉ lượt thi đã nộp của chính mình; chỉ MC + câu điền ngắn
   và chỉ câu đã làm sai/bỏ trống; chỉ bật khi đề cho xem đáp án và không bật `hideAnswerForWrong`; khoá theo (lượt × câu); đáp án
   và lời giải CHỈ trả khi state = solved/revealed; không bao giờ đổi `ExamAttempt.score`).
2. Thêm `correctionAvailable` vào `/review`; UI `CorrectionPanel` ở `/student/thi-thu/[examId]` (3 trạng thái, màu luôn kèm chữ,
   ô "gợi ý giúp bạn ở chỗ nào?" không bắt buộc).
3. Ô "Gợi ý" trong form soạn câu hỏi (admin thi-thu/[id] và ngân hàng câu hỏi) + các route tạo/sửa/copy/lưu-vào-ngân-hàng
   nhận và copy `hint`; `QuestionBankPicker` copy hint khi rút vào đề.
4. Test API + trình duyệt; ghi sheet NV-188 (row 189).

## Chưa làm
- NV-189 (mục "Điều chưa đạt", row 190): 4 loại dòng gợi ý, gia sư sửa trước khi gửi; đọc `docs/kin/nghiep-vu/hoc-tu-khan.md`.
  Cần dữ liệu: NV-185 `src/lib/mastery.ts`, bài về nhà nộp đúng hạn, buổi gia sư dời/huỷ (hiện chưa có dữ liệu "dời/huỷ buổi").
- TT-199 giai đoạn 1 (gửi phiếu học phí / điểm danh qua Zalo bằng tay): helper `src/lib/zaloShare.ts` đã có, thiếu nút ở phiếu học phí và báo cáo buổi.
- Phễu gia sư PH-207..210, 212..216, 223/224 — đọc `docs/kin/nghiep-vu/pheu-gia-su.md`.
- FE-098/099/130/134/136/139/140 (tái cấu trúc/redesign).
- Ghi sheet cho: NV-188/189, TT-199, các việc còn lại; báo cáo cuối.
- KHÔNG làm (chờ Thọ/luật sư): PH-217..222, 226, 211 (cộng đồng/tin nhắn cho học sinh dưới 16 tuổi, chờ PH-225); TK-170 đăng nhập bằng mã 6 số;
  nối "không tính phí" của báo nghỉ vào phiếu học phí (liên quan GD-25, đụng tiền).

## Việc Thọ cần làm khi triển khai
- Vercel build chạy `prisma db push`: thêm cột `users.preferences`, `class_schedules.joinUrl`, `exam_questions.hint`, `question_bank_items.hint`
  và bảng `class_absences`, `makeup_credits`, `class_reminder_logs`, `exam_corrections` (chỉ THÊM, không xoá dữ liệu cũ).
- Chưa chạy được `next build` trong môi trường này (Google Fonts bị chặn); đã kiểm `tsc` sạch, lint không tệ hơn mốc ban đầu, mọi trang chạy được trên Next dev.
- Chưa kiểm được ảnh QR VietQR thật (img.vietqr.io bị chặn); mới kiểm được URL.
- Lưu ý hành vi mới: gia sư hiện có (chưa chọn gì) vào chế độ gọn (Lịch + Học phí); bật lại ở Cài đặt → Module hiển thị.
