# Sổ giả định KiN

Khi thiếu một quyết định, em không dừng lại hỏi mà **đặt giả định**, ghi vào sổ này, rồi làm
tiếp. Mỗi giả định có lý do, cái giá nếu sai, và cách kiểm. Anh Thanh chốt hoặc bác bất cứ lúc
nào; đổi giá trị thì sửa ở tài liệu đặc tả được nêu, không sửa công thức.

Trạng thái: **Đang dùng** (chưa ai chốt) · **Đã chốt** (anh đồng ý) · **Bác** (anh đổi, đã sửa đặc tả).

Cập nhật 02/10/2026.

| Mã | Giả định | Vì sao chọn | Nếu sai thì | Cách kiểm | Trạng thái | Đặc tả |
|---|---|---|---|---|---|---|
| GD-01 | Môn được miễn vẫn được đếm vào số môn khi chọn bậc đơn giá | mã v7 đang làm vậy | em học 1 môn trả tiền + 1 môn miễn được giá 2 môn (60.000đ thay vì 70.000đ) | anh xác nhận luật lớp | Đang dùng | `nghiep-vu/dua-bang-tinh-len-web.md` |
| GD-02 | % của Hỗ trợ ngoài và Nguồn khác tính trên học phí gốc, không dây chuyền | dễ giải thích với phụ huynh | tổng giảm lệch vài chục nghìn so với cách tính nối tiếp | so với 3 phiếu thật tháng 10 | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-03 | "Học bổng" số tiền cũ khi nhập vào web đưa sang Nguồn khác | không biết số cũ thuộc môn nào | báo cáo học bổng theo môn thiếu số tháng cũ | anh xem bảng nhập thử | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-04 | Hạn đóng học phí là trước ngày 20 | tin nhắc v7 dùng mốc này | nhắc sai hạn trong 5 ngày 15–20 | anh xác nhận | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-05 | Hệ số Muộn = 0,9 | phải cao hơn Nghỉ có phép (0,8), vì em vẫn học phần lớn buổi | thứ hạng chuyên cần xê dịch nhẹ | anh xác nhận | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-06 | Ô điểm danh trống là "Chưa điểm danh", không phải vắng | tránh trừ điểm vì gia sư quên tick | lớp quen để trống nghĩa là vắng sẽ thấy điểm cao hơn trước | so 1 tháng điểm danh cũ | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-07 | Hoà cả ba tiêu chí thì hiện đồng hạng, không phân bằng tên | tên không nói gì về học lực | TOP 1 có thể có 2 em, gia sư phải chọn người nhận học bổng | anh xác nhận | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-08 | E13 xét nợ các tháng trước, không xét tháng đang tính | trước ngày 20 ai cũng "còn lại" > 0 | em nợ tháng này vẫn được báo học bổng | anh xác nhận luật E13 | Đang dùng | `dua-bang-tinh-len-web.md` |
| GD-09 | Mở đánh giá trên hồ sơ sau 4 buổi phụ huynh đã xác nhận | chưa có đối soát VietQR để biết đã trả tiền | có thể có đánh giá của gia đình chưa trả tiền | theo dõi 1 tháng đầu | Đang dùng | `nghiep-vu/pheu-gia-su.md` |
| GD-10 | Nhóm học tối đa 8 bạn | học từ nhóm học của Quizlet | lớp đông phải tách nhóm | hỏi 5 gia sư dùng thử | Đang dùng | `pheu-gia-su.md` |
| GD-11 | Link công khai dùng tên miền `kin.vn` làm mẫu | chưa có tên miền | phải đổi mẫu tin và thẻ xem trước | anh mua tên miền | Đang dùng | `pheu-gia-su.md` |
| GD-12 | Tin buổi học bắt đầu trong 30 phút vẫn báo trong giờ nghỉ 22:00–07:00 | lớp học lúc 22:15 | học sinh không nhận được nhắc vào lớp | thử với lớp 22:15 | Đang dùng | `dua-bang-tinh-len-web.md`, `pheu-gia-su.md` |
| GD-13 | Báo trước khi buổi bù hết hạn: 3 ngày | đủ để hẹn giờ bù | phụ huynh mất buổi bù | theo dõi số buổi bù hết hạn | Đang dùng | `nghiep-vu/lich-nhac-va-che-do-gon.md` |
| GD-14 | Tin nhắc 24 giờ rơi vào giờ yên lặng thì dời về 21:30 hôm trước | trước giờ yên lặng | phụ huynh nhận tin sớm hơn 1 ngày | hỏi 3 phụ huynh | Đang dùng | `lich-nhac-va-che-do-gon.md` |
| GD-15 | Buổi bắt đầu trước 08:00 thì bỏ tin nhắc 1 giờ | tránh gửi lúc 06:00–07:00 | học sinh quên buổi sáng sớm | theo dõi vắng buổi sáng | Đang dùng | `lich-nhac-va-che-do-gon.md` |
| GD-16 | Ngưỡng đạt năng lực môn = 8,0 | theo báo cáo Khan 10.1 | nhãn "Đạt ngưỡng" quá khó hoặc quá dễ | xem phân bố điểm 1 tháng | Đang dùng | `nghiep-vu/hoc-tu-khan.md` |
| GD-17 | Bài về nhà nộp dưới 70% thì vào mục "Điều chưa đạt" | khớp mức cảnh báo 4 của v7 | báo phụ huynh quá nhiều hoặc quá ít | xem 1 tháng | Đang dùng | `hoc-tu-khan.md` |
| GD-18 | Mức thành thạo 5 bậc chỉ gia sư thấy, chưa in lên phiếu phụ huynh | chưa chốt ngưỡng từng bậc | — | anh chốt ngưỡng | Đang dùng | `pheu-gia-su.md` |
| GD-19 | Mã phiếu = KIN + 5 ký tự (bỏ O I L 0 1), không đổi khi sửa số tiền | ngắn, gõ tay được, 28,6 triệu mã | phụ huynh gõ nhầm mã, giao dịch vào hàng chờ | đếm giao dịch "không có mã" tháng đầu | Đang dùng | `nghiep-vu/doi-soat-vietqr.md` |
| GD-20 | Không bao giờ tự ghép tiền vào phiếu theo số tiền, chỉ gợi ý | hai em cùng học phí là chuyện thường | gia sư phải bấm tay nhiều hơn | đếm lượt ghép tay | Đang dùng | `doi-soat-vietqr.md` |
| GD-21 | Đóng dư: gia sư chọn trừ vào tháng sau hoặc ghi đã trả lại; KiN không tự trừ | tiền dư là thoả thuận giữa gia sư và phụ huynh | thêm một bước cho gia sư | hỏi 3 gia sư | Đang dùng | `doi-soat-vietqr.md` |
| GD-22 | Không lưu số dư tài khoản (`accumulated`) của gia sư từ webhook | không cần cho đối soát, là dữ liệu riêng | — | — | Đang dùng | `doi-soat-vietqr.md` |
| GD-23 | Phụ huynh bấm "Tôi đã chuyển" mà 24 giờ chưa thấy tiền thì nhắc gia sư kiểm sao kê | chuyển khoản liên ngân hàng thường vào trong ngày | nhắc sớm hoặc muộn | theo dõi tháng đầu | Đang dùng | `doi-soat-vietqr.md` |

## Đã chốt

| Mã | Nội dung | Ngày | Người chốt |
|---|---|---|---|
| — | Ngưỡng báo nghỉ sát giờ 2 giờ; hạn buổi bù 30 ngày; giờ yên lặng 22:00–07:00 | 30/09 | anh Thanh |
| — | Học bổng và giá: gia sư tự quyết (NV-184, TT-204) | 30/09 | anh Thanh |
| — | Cộng đồng theo đặc tả 30/09 (Threads/Instagram, có tin nhắn riêng); đặc tả 24/09 chỉ để chắt lọc | 30/09 | anh Thanh |
| — | Vào giữa tháng: gia sư sửa số buổi; tính theo số buổi, gia sư chỉnh linh động | 01/10 | anh Thanh |
| — | Không làm tròn học phí; thêm trạng thái Muộn; giảm giá 3 loại | 01/10 | anh Thanh |
| GD-25 | Lớp tắt "vắng vẫn tính tiền": Vắng và Có phép không tính, Muộn tính đủ, Chưa điểm danh vẫn tính | 02/10 | anh Thanh |
| — | Giai đoạn đầu KiN chưa thu phí; khi thu phí sẽ bổ sung điều khoản. Đối soát VietQR (TT-200) dựng được | 02/10 | anh Thanh |
| — | Cộng đồng: ai cũng xem không cần đăng nhập; cổ vũ, bình luận phải đăng nhập | 02/10 | anh Thanh |
| GD-26 | Khách chưa đăng nhập chỉ thấy tên hiển thị và ảnh học sinh, không thấy trường, lớp, hồ sơ; Google không lập chỉ mục bài của học sinh dưới 16 tuổi | 02/10 | anh Thanh |
| GD-27 | Giữ tiêu đề cột "Mật khẩu" ở 5 tab AZOTA nhưng luôn để trống, mỗi lần đồng bộ tự xoá. **Không còn áp dụng:** cùng ngày anh chốt bỏ bảng tính, chuyển hẳn sang web | 02/10 | anh Thanh |
| GD-28 | Link phiếu và điểm danh gửi phụ huynh hết hạn sau 60 ngày, mở không cần tài khoản | 02/10 | anh Thanh |

## Đã bác

| Mã | Giả định cũ | Thay bằng | Ngày |
|---|---|---|---|
| — | Cấm tin nhắn riêng giữa học sinh (đặc tả 24/09) | Cho nhắn, kèm 5 lớp an toàn | 30/09 |
| — | Hai chế độ học phí "theo buổi" và "theo lịch tháng" (bản 30/09) | Một công thức theo số buổi, gia sư sửa số buổi, công tắc vắng có tính tiền không | 01/10 |
| — | Hệ số Muộn 0,5 (NV-186) | 0,9 (GD-05), vì vắng đã là 0,5 | 01/10 |
| GD-24 | Cộng đồng phải đăng nhập mới xem | Ai cũng xem; tương tác phải đăng nhập (GD-26) | 02/10 |
