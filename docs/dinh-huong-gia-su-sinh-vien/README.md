# Định hướng Tsix — hạ tầng cho gia sư sinh viên

Bộ tài liệu này ghi lại toàn bộ quá trình định vị lại Tsix: từ nền tảng tự bán khoá học THPT/ĐGNL
sang **bên thứ ba cung cấp hạ tầng cho sinh viên đi dạy gia sư** (quản lý lớp, tài liệu tự chuẩn
hoá bằng AI, giữ liên lạc với phụ huynh), cùng toàn bộ biểu đồ phân tích/thiết kế và roadmap triển
khai đi kèm.

## Mục lục

| File | Nội dung |
|---|---|
| [`01-chien-luoc.md`](./01-chien-luoc.md) | **Bắt đầu từ đây.** Câu định vị sản phẩm, bảng quyết định chiến lược đã chốt, rủi ro đã nhận diện |
| [`02-cau-hoi-dinh-vi.md`](./02-cau-hoi-dinh-vi.md) | Bộ 36 câu hỏi gốc + câu trả lời — nguồn thô dẫn tới các quyết định ở trên |
| [`03-tinh-nang-uu-tien.md`](./03-tinh-nang-uu-tien.md) | Danh sách tính năng P0 / P1 / P2 |
| [`04-bieu-do-hanh-vi.md`](./04-bieu-do-hanh-vi.md) | Biểu đồ Use Case · Activity · Sequence (mermaid, render trực tiếp trên GitHub) |
| [`05-bieu-do-cau-truc.md`](./05-bieu-do-cau-truc.md) | Biểu đồ Lớp (Class Diagram) · ERD |
| [`06-bieu-do-trien-khai.md`](./06-bieu-do-trien-khai.md) | Biểu đồ Thành phần (Component) · Triển khai (Deployment) |
| [`07-roadmap.md`](./07-roadmap.md) | Checklist triển khai — 12 giai đoạn, 61 đầu việc, theo đúng thứ tự phụ thuộc kỹ thuật |
| [`Tsix-BieuDoUML.drawio`](./Tsix-BieuDoUML.drawio) | Cả 8 biểu đồ ở dạng draw.io/diagrams.net — mở và chỉnh sửa trực quan |

## Thay đổi kiến trúc cốt lõi cần biết trước khi đọc code

Schema hiện tại (`prisma/schema.prisma`) là **đơn-chủ** (`Course.adminId` 1-1 với admin) — chưa hề
có khái niệm nhiều gia sư độc lập tự mở lớp. Việc chuyển sang **đa-gia-sư (multi-tenant)**
(`Course.tutorId`, N-1) là thay đổi nền tảng đầu tiên và bắt buộc trước mọi tính năng khác — xem
chi tiết ở [`07-roadmap.md`](./07-roadmap.md) giai đoạn 01–02 và ERD ở
[`05-bieu-do-cau-truc.md`](./05-bieu-do-cau-truc.md).

## Lưu ý về `files/*.md` ở gốc repo

Thư mục `files/` mô tả một mô hình kinh doanh **cũ và khác hẳn** (TSIX tự bán khoá học THPT/ĐGNL,
1 admin sở hữu toàn bộ nội dung, đề xuất Kafka/Redis/MongoDB/DRM cho quy mô hàng nghìn học sinh thi
đồng thời). Bộ tài liệu trong thư mục này **ghi đè định hướng đó**. `files/*.md` nên được coi là
tài liệu lịch sử — xem mục QA trong roadmap để xử lý chính thức.
