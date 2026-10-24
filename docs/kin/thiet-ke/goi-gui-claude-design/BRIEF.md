# Brief thiết kế giao diện KiN — dán nguyên văn vào Claude Design hoặc Figma

## KiN là gì
Phần mềm quản lý lớp cho **gia sư và giáo viên dạy thêm ở Việt Nam**: lịch dạy, điểm danh, học phí (phiếu chuyển khoản QR, tự gạch nợ), báo cáo cho phụ huynh. Học sinh dùng để xem lịch, làm bài, luyện thi. Dùng nhiều nhất trên **điện thoại**. Tiếng Việt, giờ 24h, tiền VND ("480.000đ").

## Cách dùng gói
Đọc theo thứ tự này (danh sách đầy đủ từng tệp: `MUC-LUC.md`):
1. Tệp này (BRIEF.md): việc cần làm, phong cách, luật cứng, dữ liệu mẫu.
2. `man-hinh/` (6 tệp): đặc tả từng màn, viết từ mã thật và đã kiểm chứng. Mỗi tệp có mục 4 (bố cục đề xuất), mục 8 (luật cứng phải giữ), mục 9 (điều chưa tốt ở bản hiện tại), mục 10 (mẫu học từ đối thủ, ảnh trong `anh-tham-khao-so-gia-su/` và `anh-tham-khao-doi-thu/`), mục 11 (dữ liệu mẫu), mục 12 (câu hỏi còn mở). Nếu BRIEF.md và một tệp màn hình lệch nhau, lấy tệp màn hình, riêng ngày "hôm nay" lấy Thứ Sáu 23/10/2026 như mục dưới.
3. `nghien-cuu/`: vì sao ra hướng này. `QUYET-DINH.md` (chọn Hướng A và lý do), `DINH-HUONG.md` (ba hướng, so sánh), `RESEARCH-TONG-HOP.md` (nghiên cứu 102 ảnh đối thủ).
4. `../mockups/de-xuat/index.html`: **bản mẫu tĩnh đề xuất** (Hướng A đã chỉnh), mở thẳng bằng trình duyệt; ảnh chụp 390px và 1280px ở `../mockups/de-xuat/anh/`. `../mockups/index.html` là thư viện xem nhanh cả ba hướng. Khi gửi gói đi, kèm thư mục `mockups/` (cùng cấp với gói này) vì bản mẫu gọi `../kin-tokens.css`.
5. `tai-lieu/`: bộ màu `kin-tokens-day-du.css`, bố cục khung, thanh bên trái, hai bản phân tích giao diện từ ảnh đối thủ.
6. Ảnh: `anh-hien-trang/` (6 ảnh bản hiện tại, kể cả bản bị chê), `anh-tham-khao-so-gia-su/` (8 ảnh), `anh-tham-khao-doi-thu/` (37 ảnh, bảng đối chiếu ở `ANH-THAM-KHAO.md`).

Hướng đã chốt: **A "Thoáng như sổ tay"**: một cột dòng trên nền phẳng, ngăn bằng đường kẻ mảnh, một nút đặc mỗi màn. Trên điện thoại dùng thanh tab dưới 5 mục (gia sư: Hộp việc, Lịch, Lớp, Học phí, Khác; học sinh: Việc của tôi, Lịch, Lớp, Bài tập, Khác); từ 720px thì thanh đó thành thanh bên trái 80px, đúng với khung Outlook hiện có.

## Việc cần làm
Thiết kế **giao diện gia sư** cho 4 màn, mỗi màn có bản điện thoại (390px) và máy tính (1280px):
1. **Trang chủ gia sư** (lời chào, vài con số, buổi hôm nay và sắp tới, việc cần làm, danh sách lớp)
2. **Lịch** (tuần hiện tại, từng buổi, nhắc phụ huynh qua Zalo)
3. **Danh sách lớp** (mỗi lớp: sĩ số, trạng thái, mở lớp, điểm danh, danh sách học sinh)
4. **Học phí** (đã thu, còn lại, phiếu theo từng học sinh, gửi phiếu)

Nếu còn thời gian: giao diện **học sinh** (Trang chủ, Lịch học, Lớp của tôi, Bài tập/Thi).

## Phong cách (quan trọng nhất)
- **Thoáng, ít dày, dễ dùng.** Chủ dự án chê bản hiện tại "quá to, tràn mắt, dày, dư thừa". Ưu tiên khoảng trắng, đường kẻ mảnh thay cho khung thẻ, ít màu, ít chữ phụ.
- Học theo **Sổ Gia Sư** (ảnh trong thư mục `anh-tham-khao-so-gia-su/`): mỗi khối **một con số lớn + một dòng nhãn nhỏ**, một nút chính mỗi màn, lịch có màu theo lớp.
- Một hành động chính mỗi màn. Trạng thái luôn có **chữ**, không chỉ màu.
- Điện thoại trước: một cột, nút chạm ≥ 44px, không bảng nhiều cột, không chữ bị cắt "…".
- Trạng thái rỗng có một câu giải thích và một nút.

## Ràng buộc kỹ thuật (để tôi dựng được đúng như thiết kế)
- Dùng **bộ màu có sẵn** trong `tai-lieu/kin-tokens-day-du.css` (tên dạng `--kin-*`, có sáng và tối). Đừng thêm màu ngoài bộ này; nếu cần màu mới, nêu rõ để thêm vào bộ.
- Màu nghĩa: xanh lá = xong/đã thu, cam = chờ/còn nợ, đỏ = quá hạn/nghỉ, xanh dương = đã lên lịch.
- Khung hiện tại là vỏ kiểu Outlook: thanh bên trái (Hộp việc, Lịch, Lớp, Bài KT, Thư viện, Học phí, Khác). Giữ nguyên thanh này, chỉ thiết kế phần nội dung bên phải. Chi tiết: `tai-lieu/bo-cuc-outlook.md`, `thanh-ben-trai.md`.
- Giữ nguyên các chữ chức năng đã có (ví dụ: "Gửi lịch tuần qua Zalo", "Lập phiếu cả lớp", "Điểm danh", "Mở lớp", "Danh sách HS").
- Không thiết kế màn mua/nạp Coin cho học sinh (Coin của học sinh chỉ nhận thưởng khi làm bài).
- Học sinh có thể dưới 16 tuổi: không thêm màn thu thập dữ liệu cá nhân.

## Dữ liệu mẫu để điền vào thiết kế
- Thời điểm xem: chiều **Thứ Sáu 23/10/2026** ("Chào buổi chiều, Cô Lan"); buổi Toán 9 19:00–20:30 là **hôm nay**
- Gia sư: **Cô Lan**, 7 lớp (Toán 9, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9…), 8 học viên đang học
- Đã thu tháng 10: **480.000đ**; còn lại 560.000đ; học sinh "Đỗ Hà" phải đóng 560.000đ (phiếu nháp), "Trần Gia Bảo" đã đóng 480.000đ
- Buổi: Thứ Sáu 23/10 19:00–20:30 Toán 9 (2 học viên); Thứ Bảy 24/10 16:00–17:30 Văn 8
- Việc cần làm: 2 yêu cầu xác nhận của phụ huynh · 1 báo nghỉ sát giờ · 1 khoản tiền cần đối soát · 4 buổi chưa điểm danh

## Anh cần gửi lại cho Claude Code
- Với **Claude Design**: gói bàn giao (thư mục có README và các file mẫu).
- Với **Figma**: link file + số khung của từng màn (ví dụ `node-id=12:34`).
