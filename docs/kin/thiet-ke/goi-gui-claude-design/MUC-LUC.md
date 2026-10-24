# Mục lục gói gửi Claude Design và Figma

Gói này là toàn bộ thứ cần để thiết kế lại giao diện KiN (gia sư và học sinh, ưu tiên điện thoại). Mỗi tệp dưới đây có một dòng "để làm gì". Hướng đã chốt: **A "Thoáng như sổ tay"**, bản mẫu tĩnh ở `../mockups/de-xuat/`.

Ngày "hôm nay" trong mọi dữ liệu mẫu là **Thứ Sáu 23/10/2026**. Sáu tệp `man-hinh/` được viết lúc còn lấy Thứ Năm 22/10 (và có câu "Hôm nay không có buổi dạy nào"); khi lệch, lấy `BRIEF.md` và bản mẫu `../mockups/de-xuat/`.

## 1. Thứ tự đọc nên theo

### Với Claude Design (dựng giao diện từ chữ và ảnh)
1. `BRIEF.md`: việc cần làm, phong cách, luật cứng, dữ liệu mẫu, cách dùng gói.
2. `../mockups/de-xuat/index.html` rồi từng màn (tong-quan, lich, lop, lop-chi-tiet, hoc-phi, hs-trang-chu, hs-lich, hs-lop, hs-bai-tap, trang-thai): đây là đáp án hình dạng cần đạt. Xem nhanh bằng `../mockups/index.html`.
3. `tai-lieu/kin-tokens-day-du.css`: bộ màu và số đo, chỉ được gọi `var(--kin-*)`, không thêm mã màu.
4. `man-hinh/01` đến `06`: đặc tả từng màn. Đọc mục 3 (dữ liệu hiển thị), 4 (bố cục), 7 (chữ phải giữ nguyên), 8 (luật cứng), 11 (dữ liệu mẫu); mục 9, 10, 12 khi cần lý do.
5. `anh-tham-khao-so-gia-su/` và `anh-hien-trang/`: nhìn để lấy cảm giác "thoáng" và để tránh bản đang bị chê.
6. `nghien-cuu/QUYET-DINH.md` nếu cần biết vì sao không chọn Hướng B và C.

### Với Figma (dựng khung, đặt tên khung để Claude Code đối chiếu)
1. `BRIEF.md` (phần "Anh cần gửi lại": trả link file và số khung của từng màn, ví dụ `node-id=12:34`).
2. `tai-lieu/kin-tokens-day-du.css`: tạo biến màu và biến số đo trùng tên (`--kin-*`), cả sáng và tối.
3. `../mockups/de-xuat/anh/*-390.png` và `*-1280.png`: ảnh chụp làm khung mẫu (điện thoại 390px, máy tính 1280px). Số màn: 10.
4. `man-hinh/` theo từng màn đang dựng, riêng mục 4 (bố cục) và mục 7 (chữ phải giữ).
5. `tai-lieu/bo-cuc-outlook.md` và `tai-lieu/thanh-ben-trai.md` để giữ đúng khung vỏ (thanh dưới trên điện thoại, thanh bên trái 80px từ 720px).
6. `anh-tham-khao-doi-thu/` chỉ khi cần ý cho một chi tiết cụ thể; luôn kèm `ANH-THAM-KHAO.md`.

## 2. Từng tệp trong gói

### Gốc
- `BRIEF.md`: brief ngắn dán nguyên văn vào Claude Design hoặc Figma. Có phần "Cách dùng gói".
- `MUC-LUC.md`: tệp này.

### `man-hinh/` (đặc tả từng màn, viết từ mã thật và đã kiểm chứng)
- `01-trang-chu-gia-su.md`: Hộp việc / Tổng quan của gia sư: lời chào, việc cần làm, buổi kế tiếp, các lớp.
- `02-lich-gia-su.md`: Lịch tuần của gia sư, thẻ buổi, báo nghỉ sát giờ, gửi lịch qua Zalo.
- `03-lop-gia-su.md`: Danh sách lớp, chi tiết lớp, điểm danh, mã mời.
- `04-hoc-phi-gia-su.md`: Học phí: đã thu, còn lại, phiếu, đối soát, nhận tiền. Chỉ đổi cách trình bày, không đổi cách tính phiếu và đối soát.
- `05-hoc-sinh-trang-chu-lich-lop.md`: ba màn học sinh: Việc của tôi, Lịch học, Lớp.
- `06-hoc-sinh-bai-tap-thi.md`: Bài tập, đề thi thử, cổng vào đề, phòng thi, kết quả.
  Mỗi tệp có 12 mục: mục đích, việc người dùng làm, dữ liệu, bố cục, hành động, trạng thái, chữ giữ nguyên, luật cứng, điều chưa tốt, mẫu đối thủ, dữ liệu mẫu, câu hỏi còn mở.

### `nghien-cuu/` (vì sao ra hướng này)
- `QUYET-DINH.md`: giám đốc thiết kế chọn Hướng A, 8 lý do, điểm mạnh yếu của B và C.
- `DINH-HUONG.md`: định hướng thiết kế, quyết định ý tưởng và ba hướng A, B, C kèm cách so sánh.
- `RESEARCH-TONG-HOP.md`: research tổng hợp từ báo cáo Sổ Gia Sư và 102 ảnh chụp giao diện đối thủ.

### `tai-lieu/` (tài liệu nền, ít phải sửa)
- `kin-tokens-day-du.css`: bộ token đầy đủ (màu sáng và tối, chủ đề, cỡ chạm, khoảng cách, bo góc). Nguồn sự thật cho màu.
- `tokens.css`: bản token gốc, đã đo tương phản WCAG 2.1 (trả lời FE-087 đến FE-090); dùng để đối chiếu số đo tương phản. Khi hai tệp lệch nhau, lấy `kin-tokens-day-du.css` (trùng với `../mockups/kin-tokens.css`).
- `bo-cuc-outlook.md`: đặc tả bố cục Outlook, một vỏ bốn vai (thanh bên, vùng nội dung, số đo), cập nhật 24/09/2026.
- `thanh-ben-trai.md`: quyết định về thanh bên trái (luôn hiện, thu vào được).
- `gia-su-giao-dien-tu-102-anh.md`: thiết kế giao diện gia sư rút từ các ảnh Sổ Gia Sư, TutorBird, Teachworks, Shub (nêu rõ hạn chế của từng nguồn).
- `hoc-sinh-giao-dien-tu-anh-doi-thu.md`: nguyên tắc giao diện học sinh rút từ ảnh Preply, Superprof, Wyzant, Shub (không có mẫu cho bài tập và thi).

### `anh-hien-trang/` (6 ảnh, bản đang chạy)
- `1-hop-viec-hien-tai.jpg`: Hộp việc hiện tại.
- `2-lich-truoc-khi-sua.jpg`, `3-lop-truoc-khi-sua.jpg`, `4-hoc-phi-hien-tai.jpg`, `5-tong-quan-truoc-khi-sua.jpg`: các màn trước khi sửa, để thấy chỗ bị chê "to, tràn mắt, dày, dư thừa".
- `6-tong-quan-ban-vua-sua-anh-thay-la-day.jpg`: bản Tổng quan vừa sửa lần trước, ảnh chủ dự án đã xem.

### `anh-tham-khao-so-gia-su/` (8 ảnh gốc của Sổ Gia Sư, chuẩn "thoáng" cần học)
- `01-trang-chu.jpg`, `02-lich-tuan.jpg`, `03-chi-tiet-lop.jpg`, `04-hoc-phi-chua-thu.jpg`, `05-phieu-hoc-phi.jpg`, `06-tao-lop-buoc-1.jpg`, `07-chi-tiet-buoi-hoc.jpg`, `08-hoc-sinh.jpg`: trang chủ, lịch tuần, chi tiết lớp, học phí chưa thu, phiếu học phí, tạo lớp bước 1, chi tiết buổi học, danh sách học sinh.

### `anh-tham-khao-doi-thu/` (37 ảnh đối thủ, đánh số 01 đến 37)
- `ANH-THAM-KHAO.md`: bảng ảnh nào của sản phẩm nào (TutorBird, Teachworks, Shub Classroom, Wyzant, Preply, Sổ Gia Sư), màn nào trong sản phẩm đó, dùng cho màn KiN nào, điều nên tránh, mã băm gốc.
- `01-…jpg` đến `37-…jpg`: ảnh chụp đã được nêu ở mục 10 của các tệp `man-hinh/`. Tên có sản phẩm và nội dung. Chỉ lấy ý, không chép bố cục desktop cứng.

## 3. Ngoài thư mục gói (cùng cấp, đi kèm khi gửi)

- `../mockups/index.html`: thư viện xem nhanh với ảnh thu nhỏ của ba hướng và bản đề xuất.
- `../mockups/de-xuat/`: **bản mẫu tĩnh đề xuất** (HTML, CSS, ảnh chụp 390px và 1280px, 10 màn). Mở `index.html`.
- `../mockups/huong-a/`: Hướng A, nội dung giống `de-xuat/`; chỗ để sửa tiếp.
- `../mockups/huong-b/`, `../mockups/huong-c/`: hai hướng không chọn, giữ để so sánh.
- `../mockups/kin-tokens.css`: bộ token mà mọi bản mẫu gọi (`../kin-tokens.css`). Giữ cùng cấp với thư mục hướng.

## 4. Luật cứng (nhắc lại, chi tiết ở `BRIEF.md` và mục 8 của từng tệp `man-hinh/`)
- Màu chỉ qua `var(--kin-*)`, không mã hex.
- Trạng thái luôn có chữ, không chỉ màu. Nút chạm từ 44px. Không chữ bị cắt "…". Không tràn ngang ở 390px.
- Không thiết kế màn mua hay nạp Coin cho học sinh; Coin chỉ là chữ mờ, không bấm được.
- Học sinh có thể dưới 16 tuổi: không thêm thu thập dữ liệu cá nhân. Không nội dung cờ bạc hoá.
- Học phí: chỉ đổi cách trình bày, không đổi cách tính phiếu và đối soát.
- Thông báo không ghi tên và không ghi số tiền.

## 5. Năm điểm còn chờ chủ dự án chốt (cũng ghi ở `../mockups/de-xuat/index.html`)
1. Tên tab thứ tư của học sinh: "Bài tập" hay "Thư viện".
2. Nhóm nghìn khi gõ số tiền (560000 thành 560.000).
3. Menu "⋯" của phiếu học phí hay dòng chữ "Thao tác khác".
4. Hạn bài tập là 07:00 sáng hay cuối ngày.
5. Có lưu "Đã mở Zalo lúc…" khi gia sư bấm nhắc hay không.
