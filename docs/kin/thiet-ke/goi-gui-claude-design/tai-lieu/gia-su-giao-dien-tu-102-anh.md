# Thiết kế giao diện gia sư — rút từ 102 ảnh trong báo cáo research (22/10/2026)

Nguồn: 4 agent đã mở từng ảnh (29 ảnh Sổ Gia Sư mục 3.3, 19 TutorBird, 14 Teachworks, 12 Teach 'n Go / TutorCruncher / Shub). Không xem 28 ảnh sàn gia sư (Preply, Superprof, Wyzant) vì đó là màn phía học viên, không phải màn quản lý lớp. **Hạn chế:** ảnh Teach 'n Go và TutorCruncher chỉ là trang quảng cáo; Shub chỉ là màn học sinh. Màn Lịch và Học phí chủ yếu dựa trên Sổ Gia Sư, TutorBird, Teachworks.

## Hiện trạng KiN (chụp trên web demo)
Vỏ kiểu Outlook tối. Mọi màn là danh sách chữ trên nền phẳng: số liệu cùng cỡ chữ với nhãn, không màu nghĩa (xong, chờ, nợ), lớp học là thẻ chữ giống hệt nhau, Lịch là một cột dài chỉ khác giờ. Việc cần làm nằm giữa trang, lối tắt chiếm đầu trang.

## Nguyên tắc chung (đều thấy lặp lại ở nhiều ảnh)
1. **Mỗi thẻ một con số lớn + một dòng nhãn nhỏ.** Số tiền và số đếm là thứ to nhất màn.
2. **Màu có nghĩa, luôn kèm chữ:** xanh lá = xong/đã thu, cam = chờ/còn nợ, đỏ = nghỉ/quá hạn, xanh dương = đã lên lịch. Dùng token `--kin-tt-*`, không mã hex.
3. **Việc đang cần làm lên trước** (hôm nay, việc cần xử lý), lối tắt xuống cuối.
4. **Mỗi màn một hành động chính** (nút đặc mầu), hành động phụ là nút viền.
5. **Điện thoại trước:** một cột, nút ≥ 44px, không bảng nhiều cột. Tránh điều ảnh cho thấy hỏng: tên bị cắt "…", lưới 7 cột chữ nhỏ, trạng thái rỗng trống trơn.
6. **Trạng thái rỗng có lời giải thích + nút hành động.**

## Từng màn
### 1. Trang chủ (Tổng quan)
- Đầu trang: "Chào buổi chiều, Cô Lan" + thứ/ngày hôm nay.
- Hàng 4 thẻ số: Học viên đang học · Lớp đang dạy · Đã thu tháng này (xanh lá) · Việc cần làm (cam/đỏ, hoặc xanh "Ổn" khi bằng 0).
- **"Hôm nay"** đứng ngay dưới: giờ to, tên lớp, số học viên, chip trạng thái chữ (Sắp tới / Đang diễn ra / Đã kết thúc / Đã huỷ). Nếu hôm nay không có buổi: nói rõ và hiện buổi kế tiếp.
- Việc cần làm (giữ nguyên danh sách và số hiện có), các lớp dạng thẻ, lối tắt ở cuối.
- Nguồn học: Sổ Gia Sư (thẻ một số, lịch hôm nay), TutorBird (KPI + danh sách hôm nay), Teachworks (số lớn, trạng thái rỗng có câu).

### 2. Lịch
- Một hàng điều khiển: ← Tuần trước · Tuần này · Tuần sau → (giữ nguyên nút và chữ).
- **Dải 7 ngày** ngay dưới tiêu đề: mỗi ngày một chip (T2…CN + ngày), hôm nay tô đặc, chấm nhỏ nếu có buổi, bấm để nhảy tới ngày đó. Đây là cách thay "lưới 7 cột × 16 giờ" mà ảnh cho thấy không dùng được trên điện thoại.
- Buổi học là thẻ có **vạch màu theo lớp** bên trái (cùng lớp luôn cùng màu), giờ in đậm, chip trạng thái chữ. Phần mở rộng (nhắc Zalo, dời, huỷ, báo nghỉ) giữ nguyên.
- Nút "Gửi lịch tuần qua Zalo" thành hành động phụ gọn một hàng.
- Nguồn học: Sổ Gia Sư (khối màu theo lớp, nút Hôm nay giữa hai mũi tên), TutorBird (popover buổi học), Teachworks (thanh điều hướng + Hôm nay mờ khi đang ở hôm nay).

### 3. Danh sách lớp
- Thẻ lớp: chấm trạng thái + chữ (Đang nhận / Đã đóng / Tạm dừng), **thanh sĩ số** (n / sức chứa, "đã đầy" bằng chữ), 3 nút: **Mở lớp** (chính) · Điểm danh · Danh sách HS.
- Dùng chung ở Tổng quan và module Lớp nên đổi một chỗ, cả hai màn đổi.
- Nguồn học: Sổ Gia Sư (đầu lớp bằng chip, số học sinh), Shub (lọc nhanh dạng pill — để vòng sau).

### 4. Học phí (chưa dựng ở vòng này)
- Dải tổng: Đã thu (xanh lá) · Còn lại (cam), thẻ theo học sinh với số tiền in đậm bên phải, "Đã thu tiền / Gửi phiếu" là hành động chính, hoàn tác thu tiền trong khung đỏ riêng. Nguồn: Sổ Gia Sư mục 3.3.9, TutorBird (câu "còn nợ … tính đến ngày").
- Việc tiền nên tôi chỉ đổi cách trình bày, không đụng cách tính, phiếu, đối soát.

## Không làm (và lý do)
- Không chép bố cục desktop cứng của đối thủ (sidebar cắt, hai cột chật).
- Không đổi vỏ Outlook, thanh bên trái, hay màn đầu mặc định (Hộp việc): đó là quyết định đã có theo Figma 9:2. Trang chủ mới vào qua `/lop-cua-toi/tong-quan` (mục "Khác"). **Anh quyết** có muốn Trang chủ thành màn mặc định không.
- Không thêm màu mới ngoài token, không mã hex, không thêm thư viện.

## Cách kiểm
Chụp ảnh trước/sau cả máy tính và điện thoại 390px; bài test giao diện cũ của từng màn phải xanh; `t-no-hex` xanh.
