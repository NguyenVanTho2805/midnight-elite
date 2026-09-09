# Chốt chiến lược: Tsix — hạ tầng cho gia sư sinh viên

> Kết quả của một phiên brainstorm chuyển Tsix từ "nền tảng tự bán khoá học THPT/ĐGNL"
> (mô hình cũ mô tả trong `files/*.md`) sang **bên thứ ba cung cấp hạ tầng cho sinh viên đi dạy gia sư**.

## 1. Định vị sản phẩm

> "Tsix là văn phòng làm việc trọn gói của gia sư sinh viên: quản lý lớp, tài liệu được hệ thống
> tự sắp xếp gọn gàng, và giữ liên lạc với phụ huynh — tất cả trong một chỗ, giá chưa bằng một ly
> cà phê đen."

## 2. Các quyết định đã chốt

| Hạng mục | Quyết định | Lý do / ghi chú |
|---|---|---|
| **Vai trò** | Tsix là bên trung gian cung cấp hạ tầng (lớp học, tài liệu, đề thi) cho gia sư — không tự sản xuất nội dung, không đứng ra thu/giữ học phí giữa gia sư và học viên. | Tránh nghĩa vụ trung gian thanh toán; gia sư tự thu học phí của mình theo cách riêng. |
| **Đối tượng mục tiêu (giai đoạn 1)** | Tập trung 100% vào **sinh viên đang đi dạy gia sư**. Tạm gác nhóm trung tâm luyện thi. | Ngách hẹp, đủ khác biệt để không đối đầu trực diện Shub Classroom / Azota ở quy mô toàn quốc. |
| **Mô hình thu phí** | Chỉ thu phí từ **gia sư**, không thu học viên. | Học viên chỉ dùng miễn phí tính năng công khai (diễn đàn, tra điểm...); tài liệu/lớp học cần được gia sư mời vào. |
| **Cơ chế thu phí** | Gia sư **nạp Coin bằng tiền thật** (không quy đổi được ra tiền mặt, không chuyển giữa 2 tài khoản), rồi **dùng Coin để đăng ký / gia hạn lớp** theo `Plan.coinCostPerMonth`. | Thay thế mô hình thuê bao trừ tiền tự động — đơn giản hơn cho MVP (không cần tích hợp recurring billing/webhook gia hạn). Về pháp lý: đây là số dư trả trước cho dịch vụ của chính Tsix (gia sư tự nạp, tự tiêu), khác hẳn ví trung gian giữ tiền giữa 2 người dùng nên không vướng quy định trung gian thanh toán của Ngân hàng Nhà nước. |
| **Coin thưởng** | Tồn tại song song, **kiếm miễn phí qua hoạt động** (điểm danh đều, được đánh giá tốt...), không mua được bằng tiền, không quy đổi ngược lại Coin nạp. | Giữ lớp gamification, tách bạch hoàn toàn khỏi dòng tiền thật (khác `reason` trong cùng bảng `CoinTransaction`). |
| **Mức giá giai đoạn đầu** | Dưới 20.000đ/tháng (quy đổi qua Coin), hoặc gói miễn phí giới hạn. Ưu tiên tăng trưởng người dùng trước, mô hình giá chi tiết tính sau khi có traction. | Câu định vị "giá chưa bằng một ly cà phê đen" bám sát đúng mức giá này. |
| **Ngưỡng tuổi cần xin phép phụ huynh** | **Dưới 16 tuổi** bắt buộc xin phép phụ huynh trước khi kích hoạt tham gia lớp. | Khớp đúng định nghĩa "trẻ em" của Luật Trẻ em 2016 và ngưỡng mà Nghị định 13/2023/NĐ-CP áp cơ chế bảo vệ dữ liệu cá nhân nghiêm ngặt nhất. *Lưu ý:* Bộ luật Dân sự vẫn coi 16–17 tuổi là "chưa thành niên" với giao dịch có phí — đây là rủi ro dân sự nhỏ được chấp nhận có chủ đích ở giai đoạn MVP, không phải khoảng trống chưa biết tới. |
| **Xác minh gia sư** | Hàng rào thấp, tự đăng ký (self-serve), không cần duyệt hồ sơ phức tạp. | Bù lại bằng hồ sơ năng lực công khai + đánh giá (CourseReview) làm cơ chế sàng lọc thay thế. |
| **Dữ liệu học viên** | Thuộc về nền tảng để dùng phân tích/AI chung, có thể áp dụng bảo mật riêng theo hợp đồng từng gia sư. | Cần công bố rõ trong điều khoản; đặc biệt cẩn trọng với dữ liệu học sinh dưới 16 tuổi theo Nghị định 13/2023. |
| **Kênh tăng trưởng đầu tiên** | Cộng đồng sinh viên, hợp tác nhóm sinh viên — ưu tiên hơn quảng cáo diện rộng. | Gia sư là bên tạo cung, phải có trước khi có học viên; chi phí thu hút thấp nhất trong 3 kênh đã cân nhắc. |

## 3. Khác biệt cạnh tranh đã chốt (so với Meet tự do, Shub Classroom, Azota)

1. **Tài liệu tự gắn theo buổi học** — giải điểm yếu của Shub (tài liệu khó tìm, không gắn với buổi học).
2. **AI chuẩn hoá tài liệu không cần đúng mẫu** — giải điểm yếu của Azota (phải đúng form mới chấm được).
3. **Một luồng duy nhất**: lịch – gọi video – tài liệu – điểm danh – chấm bài không rời khỏi app.
4. **Giá gần như miễn phí cho sinh viên mới vào nghề** — Shub/Azota tối ưu cho B2B trường học/trung tâm, không tối ưu cho cá nhân sinh viên.
5. **Tích hợp sâu vào workflow Zalo/Messenger** sẵn có của gia sư–phụ huynh, thay vì bắt họ đổi thói quen sang một app hoàn toàn mới.

## 4. Rủi ro đã nhận diện và cách xử lý

- **Rò rỉ dữ liệu/tài liệu độc quyền của gia sư** → cần watermark/giới hạn tải theo lựa chọn gia sư (đã đưa vào tính năng P0/P1).
- **Gia sư dùng Tsix tìm học viên rồi giao dịch ra ngoài để né phí** → chấp nhận là chi phí của mô hình hàng rào thấp; bù lại bằng trải nghiệm đủ tốt để họ muốn ở lại.
- **Segment sprawl** (vừa muốn sinh viên gia sư vừa muốn chiều trung tâm luyện thi) → đã chốt: chỉ tập trung sinh viên gia sư trong 6–12 tháng đầu.
- **Dữ liệu trẻ em** → xử lý bằng luồng `ParentConsent` bắt buộc với học viên dưới 16 tuổi (xem `04-bieu-do-hanh-vi.md`).

## 5. Tài liệu liên quan trong bộ này

- [`02-cau-hoi-dinh-vi.md`](./02-cau-hoi-dinh-vi.md) — bộ 36 câu hỏi gốc dùng để dẫn ra các quyết định ở trên.
- [`03-tinh-nang-uu-tien.md`](./03-tinh-nang-uu-tien.md) — danh sách tính năng P0/P1/P2.
- [`04-bieu-do-hanh-vi.md`](./04-bieu-do-hanh-vi.md), [`05-bieu-do-cau-truc.md`](./05-bieu-do-cau-truc.md), [`06-bieu-do-trien-khai.md`](./06-bieu-do-trien-khai.md) — 8 biểu đồ UML/kiến trúc.
- [`07-roadmap.md`](./07-roadmap.md) — checklist triển khai 12 giai đoạn.
- [`Tsix-BieuDoUML.drawio`](./Tsix-BieuDoUML.drawio) — bản vẽ có thể chỉnh sửa trực tiếp trong draw.io / diagrams.net.

> **Lưu ý về `files/*.md`:** thư mục `files/` ở gốc repo mô tả một mô hình kinh doanh **cũ và khác**
> (TSIX tự bán khoá học THPT/ĐGNL, 1 admin sở hữu toàn bộ nội dung, dùng Kafka/Redis/MongoDB/DRM).
> Bộ tài liệu này ghi đè định hướng đó — nên coi `files/*.md` là tài liệu lịch sử, không dùng để
> code theo cho đến khi được cập nhật lại hoặc chuyển sang thư mục lưu trữ riêng.
