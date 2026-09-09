# Danh sách tính năng ưu tiên (MVP cho sinh viên gia sư)

## P0 — Phải có để ra mắt (vòng lặp lõi)

| # | Tính năng | Vì sao ưu tiên |
|---|---|---|
| 1 | Gia sư tự đăng ký, tự mở lớp (self-serve, không cần duyệt hồ sơ) | Khớp quyết định "hàng rào thấp"; đây là thay đổi kiến trúc cốt lõi (multi-tenant) |
| 2 | Mời học viên vào lớp bằng mã/link (không cần admin thao tác) | Marketplace tự phục vụ |
| 3 | Upload tài liệu bất kỳ định dạng → AI tự OCR/sắp xếp | Lợi thế cạnh tranh đã chọn — khác Azota ("phải đúng mẫu"); tái dùng `aiExamImport.ts`, `pdfjs-dist`, `mammoth`, `@google/genai` |
| 4 | Lịch dạy + nhắc lịch tự động | Tái dùng `ClassSchedule` + cron `remind-class`, gắn theo từng gia sư |
| 5 | Điểm danh + giao bài tập cơ bản, chấm điểm | Tái dùng `Assignment`, `AssignmentSubmission` |
| 6 | Thông báo phụ huynh cơ bản (điểm danh, điểm số, tiến độ) | Đúng định vị "giữ liên lạc với phụ huynh" |
| 7 | Xin phép phụ huynh (consent) khi tạo tài khoản học sinh dưới 16 tuổi | Bắt buộc theo Nghị định 13/2023 |
| 8 | Nạp Coin & dùng Coin đăng ký/gia hạn lớp (<20k/tháng, có free trial) | Tách hẳn khỏi mô hình escrow |

## P1 — Ngay sau khi có người dùng đầu tiên

- Ngân hàng câu hỏi/đề thi tự soạn cho từng gia sư (`QuestionBankItem`, `Exam` — gắn tenant).
- Hồ sơ năng lực công khai + đánh giá ("CV giảng dạy") — bù cho hàng rào xác minh thấp.
- Coin thưởng mở rộng (điểm danh đều, đánh giá tốt...) — dùng chung `CoinTransaction` khác `reason`.
- Giới hạn dung lượng lưu trữ theo gói subscription.
- Diễn đàn liên lớp (`Thread` mở rộng phạm vi nhìn thấy chéo giữa các lớp).
- Tích hợp Zalo OA API cho thông báo phụ huynh.

## P2 — Khi đã có traction

- Marketplace 2 chiều (phụ huynh đăng nhu cầu tìm gia sư).
- Gọi video tích hợp trong app (hiện để gia sư tự dùng Meet/Zoom).
- Gói dành cho trung tâm (multi-teacher, phân quyền quản trị).
- Affiliate/giới thiệu.

## Ba con đường khác biệt cạnh tranh đã chọn

1. **Tài liệu tự gắn theo buổi học** — giải điểm yếu của Shub Classroom.
2. **AI chuẩn hoá tài liệu không cần đúng mẫu** — giải điểm yếu của Azota.
3. **Một luồng duy nhất** (lịch – gọi video – tài liệu – điểm danh – chấm bài) không rời khỏi app.

Xem chi tiết bối cảnh quyết định tại [`01-chien-luoc.md`](./01-chien-luoc.md).
