# Quyết định thiết kế: trang lớp học sinh, trang lớp gia sư, sổ điểm

Người chốt: trưởng hội đồng thiết kế. Dữ liệu đầu vào: 7 đánh giá độc lập cho `phuong-an-1.html`, `phuong-an-2.html`, `phuong-an-3.html` (cùng thư mục). Đối chiếu token với `src/app/kin-tokens.css`; đã kiểm `package.json`: chưa có `gsap`, cũng chưa có `lenis`.

Màn (a) là trang lớp của học sinh ở 390px. Màn (b) là trang lớp của gia sư ở 1280px. Màn (c) là sổ điểm.

---

## 1. Bảng điểm

### 1.1 Điểm trung bình thô của 7 vai, theo phương án và màn

| Phương án | (a) Học sinh 390 | (b) Gia sư lớp 1280 | (c) Sổ điểm | TB 3 màn |
|---|---|---|---|---|
| PA1 – Sổ tay gọn | 7,21 | 7,21 | 6,86 | 7,10 |
| PA2 – Bàn làm việc dày | 5,93 | **7,36** | 7,29 | 6,86 |
| PA3 – Thẻ lớp kiểu Classroom | **8,86** | 6,64 | **7,50** | 7,67 |

### 1.2 Theo nhóm vai

Nhóm học sinh gồm Minh và Lan. Nhóm gia sư gồm Thanh (chủ) và cô Hoa (gia sư phụ). Nhóm ngoài gồm chị Mai (phụ huynh), chuyên gia UX và kỹ sư frontend.

| Phương án | Nhóm | (a) | (b) | (c) |
|---|---|---|---|---|
| PA1 | Học sinh | 7,00 | 6,50 | 6,50 |
| PA1 | Gia sư | 7,50 | **7,50** | 6,75 |
| PA1 | Ngoài | 7,17 | 7,50 | 7,17 |
| PA2 | Học sinh | 5,00 | **7,50** | **7,50** |
| PA2 | Gia sư | 6,00 | 7,00 (Thanh 9, Hoa 5) | 6,50 (Thanh 9, Hoa 4) |
| PA2 | Ngoài | 6,50 | 7,50 | **7,67** |
| PA3 | Học sinh | **9,00** | 6,50 | **7,50** |
| PA3 | Gia sư | **8,75** | 6,75 | **7,50** |
| PA3 | Ngoài | **8,83** | 6,67 | 7,50 |

### 1.3 Trọng số và điểm có trọng số

Trọng số được đặt theo việc ai thật sự dùng màn đó, không chia đều theo số phiếu:

| Màn | Học sinh | Gia sư | Ngoài | Lý do |
|---|---|---|---|---|
| (a) Học sinh 390 | **50%** | 25% | 25% | Học sinh đông nhất và là người dùng duy nhất của màn này. Gia sư được 25% vì chính họ phải đi nhắc khi em nộp trễ. |
| (b) Gia sư lớp | 10% | **60%** | 30% | Gia sư làm việc trên màn này hằng ngày. Ý kiến học sinh ở đây chỉ là đoán. |
| (c) Sổ điểm | 10% | **60%** | 30% | Như (b). Nhóm ngoài được 30% vì có chuyên gia UX (về trạng thái và tiếp cận) và kỹ sư (về khả năng làm). |

Trong nhóm gia sư, Thanh và cô Hoa nặng ngang nhau. Thanh là người dùng nhiều nhất, nhưng cô Hoa đại diện cho đội gia sư phụ sẽ đông lên, và cũng là người dễ bỏ cuộc nhất.

| Phương án | (a) | (b) | (c) |
|---|---|---|---|
| PA1 | 7,17 | **7,40** | 6,85 |
| PA2 | 5,63 | 7,20 | 6,95 |
| PA3 | **8,89** | 6,70 | **7,50** |

Hai điểm vênh lớn nhất giữa các vai ảnh hưởng trực tiếp tới quyết định:
- **Sổ điểm PA2: Thanh cho 9, cô Hoa cho 4.** Lọc theo trạng thái thì cả hai đều cần. Còn chọn ô bằng Shift, đi bằng phím mũi tên và ⌘K thì làm khó gia sư phụ, không dùng được trên cảm ứng, và kỹ sư xếp vào loại rủi ro cao nhất.
- **Màn gia sư PA3 chỉ được 6,6–6,7:** không đổi được lớp, dải màu cao chiếm chỗ, thẻ lồng thẻ. Cả bảy vai đều không muốn giữ dải màu lớn.

---

## 2. Quyết định: ghép theo từng màn

Không phương án nào thắng trọn. Màn học sinh lấy PA3, màn gia sư lấy PA1 (thêm hai thứ của PA2), sổ điểm lấy PA3 (thêm bộ lọc và mã hoá trạng thái của PA2). Mọi thứ dựng bằng component có sẵn.

### 2.1 Màn (a) Học sinh 390: nền PA3

| Thành phần | Lấy từ | Ghi chú |
|---|---|---|
| Khối "Cần làm N" ở đầu trang, gom **mọi** việc sắp hạn (bài tập và kiểm tra), có số đếm | PA3 | Sửa lỗi PA1 bỏ sót "Kiểm tra 15'" |
| Thẻ việc có viền trái màu trạng thái, nhãn hạn có icon đồng hồ, nút "Nộp bài" rộng hết thẻ ngay trong thẻ | PA3 | Nút cao ≥48px |
| Hạn ghi đủ **thứ, ngày, giờ** và số ngày còn lại: "Hạn T3 24/11, 21:00 · còn 3 ngày" | PA1 | Minh yêu cầu giờ cụ thể |
| Câu phụ trên nút: "Chụp ảnh vở hoặc chọn tệp PDF"; bấm nút là mở luôn chọn ảnh hoặc camera (`accept="image/*,application/pdf"`) | PA1 | Lan yêu cầu |
| Dock nộp bài ghim đáy, **chỉ hiện khi thẻ Cần làm đã cuộn khỏi màn hình**, ghi tên bài ("Nộp bài tập buổi 5") | PA1 | Nhắm vào bài hạn gần nhất. Cách thanh dưới ≥12px |
| Danh sách "Buổi học": **hàng kẻ mảnh** 56px (KinListRow), không mỗi buổi một thẻ | PA1 | Trang ngắn, record cũ không bị đẩy xuống sâu |
| Icon tròn theo loại việc, **icon video dùng màu navy** (không dùng đỏ) | PA3, có sửa | Màu đỏ chỉ dành cho lỗi và quá hạn |
| Trạng thái có hình và chữ | PA2 (hình) và PA3 (nhãn) | Xem §3.6 |
| Đầu trang: tên lớp, tên cô, lịch học trên **một dòng**, kèm một vạch màu môn mảnh 4px | PA3, đã thu gọn | Phụ huynh cần thấy "lớp có tổ chức", nhưng không cần dải cao 100–160px |
| Nhóm "Đã xong" có điểm ghi dạng 8,5/10, nằm trong tab Điểm | PA2 | Chị Mai và Minh yêu cầu |
| Thanh dưới 4 mục | PA3 | Xem §3.4 |

### 2.2 Màn (b) Trang lớp gia sư 1280: nền PA1, thêm phần của PA2 và PA3

| Thành phần | Lấy từ | Ghi chú |
|---|---|---|
| Hai cột: danh sách buổi bên trái, ngăn "Sửa buổi N" **luôn mở** bên phải | PA1 | Cô Hoa sợ nút "Thu gọn" làm mất chữ. Ngăn mở sẵn thì không có rủi ro đó |
| Đúng **một** nút chính "+ Giao bài" ở góc phải thanh trên, cùng vị trí trên mọi màn gia sư | PA1 và PA2 | Sửa lỗi P2-7 (bốn nút navy trên một màn) |
| Câu dẫn dưới tiêu đề: "Giao bài tập, gắn video hoặc tài liệu cho lớp" | PA3 | Nói rõ nút chính làm gì |
| Danh sách lớp nằm trong thanh bên (ModuleRail) kèm chấm màu và sĩ số. Đổi lớp một cú bấm. Ô lọc lớp chỉ hiện khi có >8 lớp | PA2 | Thanh và UX bắt buộc. **Sửa ModuleRail, không viết vỏ mới** |
| Hàng buổi có cột "Nộp 4/12" và "Video 42 phút" (ghi đủ chữ, không viết "42′") | PA2 | Hàng vẫn là KinListRow mở rộng thêm cột phải, không làm bảng 6 cột |
| Ô "Link YouTube": nhãn chữ, logo YouTube, dòng nhắc "Để video ở chế độ Không công khai là đủ", dán xong thì **hiện xem trước** (ảnh thu nhỏ, tên, thời lượng) | PA1 (dòng nhắc), PA3 (logo), PA2 (xem trước) | |
| Vùng kéo-thả to, viền đứt, có nút "Chọn tệp" thật (button), ghi loại tệp và dung lượng tối đa. Mỗi tệp hiện dung lượng và có chữ "Gỡ" kèm hỏi lại | PA1 và PA2 | Dùng `DropZone.tsx` có sẵn |
| Dòng "Đã tự lưu lúc 20:14" có icon check, đặt ngay trong ngăn sửa | PA1 | |
| Khối "Cần bạn xử lý" (Bài chờ chấm 4 · Điểm chờ duyệt 2 · Xin vào lớp 1), mỗi mục là **một hàng KinListRow bấm được**, đặt trên đầu cột trái | PA3, đã làm phẳng | Không làm thành thẻ. Dữ liệu chỉ của lớp này; bản gom mọi lớp nằm ở Hộp việc (§3.4) |

### 2.3 Màn (c) Sổ điểm: nền PA3, thêm phần của PA1 và PA2

| Thành phần | Lấy từ | Ghi chú |
|---|---|---|
| Bảng thường, bấm ô là mở bài nộp, kèm câu "Bấm một ô để mở bài nộp" | PA3 | Không dùng `role=grid` |
| Đầu cột ghi tên bài đầy đủ và hạn ("Bài tập buổi 5 · Hạn 24/11"), dòng phụ ghi "/10" | PA3, có sửa | Thanh không muốn "/10" lặp ở từng ô; Hoa và Mai cần biết thang điểm. Đặt "/10" một lần ở đầu cột |
| Ô điểm in đậm "8,0". Ô chưa có điểm hiện nhãn trạng thái có icon hình và chữ | PA3 và PA2 | |
| Chip lọc "Chờ chấm 4 / Chờ duyệt 2 / Chưa nộp 4 / Tất cả", là button `aria-pressed` cao 44px | PA2 | |
| Nút chính duy nhất "Chấm N bài đang chờ" ở đầu trang, mở lần lượt từng bài | PA1 và PA3 | Chấm cả loạt **không cần** chọn ô |
| Cột "Trung bình", ghi tên đầy đủ, không viết "TB" | PA1 | Cô Hoa và chị Mai yêu cầu |
| Cột tên học sinh dính khi cuộn ngang (`position: sticky`) | UX và kỹ sư | |
| Dòng giải thích "Chờ duyệt: điểm do gia sư phụ nhập, chủ nhiệm xác nhận xong học sinh mới thấy" | PA1 | |
| Nút phụ "Xuất CSV", đặt cạnh nút chính dưới dạng secondary | PA2 | |

### 2.4 Những gì cố tình KHÔNG lấy

| Không lấy | Từ | Lý do |
|---|---|---|
| Dải màu lớp cao 100–160px, tên lớp lặp hai lần | PA3 | Gia sư phải cuộn qua mỗi lần mở lớp; lặp đúng lời chê 14. Thay bằng vạch màu 4px |
| Thẻ buổi tự mở rộng thành form, có nút "Thu gọn" và hiệu ứng Flip | PA3 | Sợ mất chữ; cần GSAP Flip; giật trên máy yếu |
| Thẻ lồng thẻ ("Cần bạn xử lý", "Buổi tới", ô soạn bài cùng chồng trên một màn) | PA3 | Lời chê mục 8 |
| Bảng lệnh ⌘K, phím tắt một ký tự "N" | PA2 | Vi phạm WCAG 2.1.4; gia sư phụ không hiểu; không ai yêu cầu |
| Chọn nhiều ô bằng Shift, đi bằng phím mũi tên, thanh nổi "4 ô đang chọn" | PA2 | Dùng không được trên cảm ứng, dễ chấm nhầm cả loạt, công sức lớn. **Để lại** cho tới khi gia sư thật sự kêu chấm chậm |
| Thay toàn bộ vỏ gia sư trong một đợt | PA2 | Không tách nhỏ PR được, rủi ro hồi quy cao |
| Hàng học sinh dày 44–52px, chữ phụ 12px, cắt tiêu đề bằng dấu "…" | PA2 | Cả hai học sinh coi là điểm loại |
| Nút nổi ở góc phải sát thanh dưới | PA2 | Dễ bấm nhầm sang tab "Tôi", người thuận tay trái khó với |
| Ba viên tab "Nội dung / Video / Kết quả" trong trang lớp học sinh | PA1 và PA3 | Trùng ý với thanh dưới, Lan không biết bấm cái nào |
| Viết tắt "B3", "KT 15′", "TB", "42′" | PA2 | |
| Chỉ dùng một chấm màu 8px làm trạng thái | PA1 | Vi phạm 1.4.1 |
| Avatar học sinh tô màu môn | PA3 | Màu không mang nghĩa, dễ nhầm với màu lớp |
| Icon video màu đỏ | PA3 | Trùng nghĩa với "Quá hạn" |
| Thêm `gsap` hoặc `lenis` vào trong lớp học | Cả 3 | Xem §3.8 |
| Làm phẳng mô hình Phần > Chương > Bài thành "Buổi" | Cả 3 vẽ phẳng | Đây là đổi dữ liệu, không phải đổi giao diện. Xem rủi ro R1 |

---

## 3. Đặc tả cho đội sửa mã

### 3.1 Nguyên tắc bố cục
1. **Mỗi màn chỉ có một câu hỏi chính, đặt ở đầu trang.** Học sinh: "hôm nay em phải làm gì". Gia sư: "lớp này còn việc gì". Sổ điểm: "còn bao nhiêu bài phải chấm".
2. **Ưu tiên hàng hơn thẻ.** Danh sách nào cũng là KinListRow kẻ mảnh. Thẻ chỉ dùng cho việc cần làm ngay (Cần làm ở màn học sinh). **Cấm thẻ lồng thẻ.**
3. Một thang kích thước duy nhất, cả 3 phương án đã khoá sẵn: bo góc 8/14/tròn, cỡ chữ 14/16/18/23/27,6. **Cỡ 12px chỉ cho nhãn phụ không mang thông tin chính** (ví dụ chữ "/10" ở đầu cột). Hạn nộp, điểm và trạng thái không bao giờ dưới 14px.
4. Màu chữ cho thông tin phụ quan trọng (hạn, số tài liệu, điểm trong dòng phụ) dùng `--kin-chu-phu` (#374151, 10,3:1). `--kin-chu-mo` (#6b7280) chỉ dùng cho chữ thật sự phụ. Đây là cách trả lời lời chê "chữ xám nhạt, buổi tối phải nheo mắt".
5. Tiêu đề tiếng Việt được xuống dòng, **không cắt bằng dấu "…"**. Riêng tên tệp được cắt ở giữa nhưng phải giữ đuôi tệp.
6. Vùng chạm ≥ `var(--kin-cham-toi-thieu)` (44px). Nút chính trên điện thoại ≥48px, nằm trong nửa dưới màn hình.

### 3.2 Thứ bậc nút
| Cấp | Dạng | Số lượng trên một màn | Ví dụ |
|---|---|---|---|
| Chính | Nền navy, chữ trắng | **Đúng 1** (dock ở màn học sinh là bản sao của nút chính, không phải nút thứ hai) | "Nộp bài", "+ Giao bài", "Chấm N bài đang chờ" |
| Phụ | Viền, nền trắng | Tối đa 3 | "Xuất CSV", "+ Thêm buổi học" |
| Ma / chữ | Chỉ có chữ | Tự do | "Gỡ", "Xem tất cả" |
| Nguy hiểm | Nằm trong menu ⋯, có hỏi lại | — | "Xoá buổi" |

Nếu bài đã quá hạn mà vẫn còn cho nộp, **nút của bài đó không được nhạt hơn** nút của bài ít khẩn hơn.

### 3.3 Thẻ và hàng
- **Thẻ Cần làm** gồm: viền trái 4px theo trạng thái, icon tròn theo loại, tiêu đề 18px đậm, nhãn hạn (icon, chữ, nền nhạt), câu phụ, nút chính full-width. Nhiều việc thì xếp nhiều thẻ; chỉ việc hạn gần nhất dùng nút chính, các việc sau dùng nút phụ "Nộp bài".
- **Hàng buổi học (học sinh):** KinListRow 56px. Dòng 1: "05 · Hệ phương trình bậc nhất" (16px). Dòng 2: "Video 42 phút · 2 tài liệu · Đã chấm 8,5" (14px, `--kin-chu-phu`). Bên phải có chevron. Cả hàng là một link thật (`<a>`). Có video thì icon play nằm trước số buổi.
- **Hàng buổi học (gia sư):** dùng cùng KinListRow, thêm cột phải "Nộp 4/12" và nhãn trạng thái. Hàng đang chọn có nền nhạt và `aria-current`.

### 3.4 Điều hướng

**Học sinh, điện thoại: thanh dưới 4 mục, cao 64px**

| Thứ tự | Mục | Nội dung |
|---|---|---|
| 1 | **Cần làm** (badge số) | Mọi việc của mọi lớp, xếp theo hạn |
| 2 | Lớp | Danh sách lớp, rồi vào trang lớp (§2.1) |
| 3 | Lịch | Buổi sắp tới |
| 4 | **Điểm** | Theo lớp: Đã xong kèm điểm dạng x/10, cột Trung bình |

Tài khoản và thông báo nằm trong nút avatar ở đầu trang. Nút này phải có tên truy cập khớp chữ hiển thị (WCAG 2.5.3; sửa lỗi `aria-label="Thông báo"` trên nút có chữ "Minh Anh" ở PA1). Mục đang chọn có nền viên, chữ đậm và `aria-current="page"`. Link từ Zalo dạng `/lop/[id]/bai/[id]` phải mở thẳng vào bài, **không** bắt chọn lớp trước và **không** dẫn qua trang quảng cáo hay Đăng ký.

**Gia sư, máy tính:** ModuleRail gồm "Hộp việc" (badge), "Lớp của bạn" (danh sách lớp, chấm màu, sĩ số), rồi các mục cũ. Trong một lớp có tab "Bài học / Học sinh / Điểm" dạng `role="tablist"` hoặc link, **không dùng `aria-pressed`**.

**Gia sư, điện thoại (bắt buộc, chưa phương án nào vẽ):** thanh dưới 3 mục là **Hộp việc / Lớp / Tôi**. Trên điện thoại tối thiểu phải duyệt điểm chờ, chấm từng bài và nhận học sinh xin vào lớp. Soạn buổi không cần làm trên điện thoại.

**Hộp việc gia sư (màn mới, dựng từ khối "Cần bạn xử lý" của PA3):** chia theo lớp, mỗi lớp một nhóm hàng KinListRow: "Bài chờ chấm N", "Điểm chờ duyệt N", "Xin vào lớp N", "Buổi tới chưa có video".

### 3.5 Sổ điểm
- `<table>` có `<th scope>`. Cột tên dính. Bọc trong `overflow-x: auto` có nhãn vùng ("Sổ điểm, cuộn ngang").
- Bấm ô thì mở bài nộp (một link hoặc button trong ô). Không dùng roving tabindex.
- Học sinh chỉ thấy **hàng của mình**, cùng nhãn và cùng cột Trung bình. Điểm "Chờ duyệt" **không được hiện** cho học sinh.
- Chip lọc lọc theo hàng (học sinh có ít nhất một ô ở trạng thái đó). Nếu lọc theo ô thì quá phức tạp ở giai đoạn này.

### 3.6 Trạng thái phải có chữ (dùng lại KinStatus, thêm hình icon)

| Trạng thái | Chữ | Hình icon (lấy từ PA2) | Tone KinStatus | Màu chữ |
|---|---|---|---|---|
| Chưa nộp, chưa tới hạn | "Chưa nộp" | Vòng nét đứt | mo | `--kin-chu-phu` |
| Chưa nộp, đã quá hạn | "Quá hạn" | Vòng nét đứt, thêm dấu ! | loi | `--kin-tt-chu-loi-dam` (mới) |
| Đã nộp, chờ chấm | "Chờ chấm" | Nửa tô | cho | `--kin-tt-chu-cho` |
| Có điểm, chờ duyệt | "Chờ duyệt · 7,5" | Tô 3/4 | cho | `--kin-tt-chu-cho` |
| Đã chấm | "8,0" (ô) / "Đã chấm 8,0/10" (hàng) | Tô kín | xong | `--kin-tt-chu-xong` |

Đáp ứng yêu cầu của chị Mai: phân biệt rõ "đã nộp, chờ chấm" với "chưa nộp", và bài quá hạn phải nổi bật.

### 3.7 Token mới

Chỉ thêm token nào có lý do về tương phản:

| Token | Giá trị | Lý do |
|---|---|---|
| `--kin-tt-chu-loi-dam` | `#b91c1c` | `--kin-tt-chu-loi` (#dc2626) đạt 4,83:1 trên nền trắng, nhưng trên `--kin-tt-nen-loi` (9% đỏ) chỉ quanh mức 4,4:1, sát ngưỡng. #b91c1c đạt khoảng 6,5:1 trên nền trắng và khoảng 5,9:1 trên nền nhạt. Dùng cho nhãn "Quá hạn" |
| `--kin-cao-thanh-duoi` | `64px` | Dùng chung cho thanh dưới, dock và `padding-bottom` của thân trang, để dock không che hàng cuối |

**Không** thêm token cho dải màu lớp, vì đã bỏ dải lớn. Vạch màu 4px chỉ để trang trí, không mang chữ, nên không cần đạt 4,5:1. Nếu sau này đặt chữ lên màu lớp thì dùng `color-mix(in srgb, var(--kin-lop-NN) 28%, #000)` (cách trộn đen 72% của PA3). Lý do: `--kin-lop-*` (oklch 0.62) với chữ trắng chỉ đạt khoảng 3:1. Trước khi phát hành, đo lại bằng công cụ cả hai giá trị ở bảng trên.

### 3.8 Chuyển động
- **Trong lớp học (học sinh và gia sư): chỉ dùng CSS `transition` trên `transform` và `opacity`, 150–200ms, không thêm `gsap`.** Đề bài cho phép "GSAP nhẹ", nhưng `package.json` chưa có GSAP, và chỉ có 4 chỗ cần chuyển động, đều làm được bằng CSS: dock trượt lên, thông báo "Đã nộp" hiện ra, chuyển tab mờ dần, ngăn sửa đổi buổi. Thêm một phụ thuộc chỉ cho 4 chỗ đó thì không đáng.
- Không animate `height`, không dùng Flip đo layout (gây giật trên máy Android yếu).
- `@media (prefers-reduced-motion: reduce)`: tắt mọi chuyển dịch, chỉ giữ đổi màu tức thì.
- **Lenis: không dùng trong lớp học.** Nếu trang chủ khách muốn có thì làm PR riêng, chỉ ở route đó, có tắt khi reduced-motion. Lúc đó mới cài GSAP nếu trang chủ cần ScrollTrigger.

### 3.9 Phản hồi sau khi nộp
Sau khi nộp xong: thẻ đổi thành "Đã nộp lúc 20:41 · Chờ chấm" (icon nửa tô), kèm thông báo `role="status"` "Đã nộp bài tập buổi 5". Dock biến mất. Badge "Cần làm" giảm đi một. Nếu mạng 4G rớt: báo lỗi bằng chữ, giữ nguyên ảnh đã chọn, có nút "Gửi lại".

### 3.10 Thứ tự làm (mỗi bước là một PR, chạy độc lập sau cờ)

| # | PR | Nội dung | Công sức |
|---|---|---|---|
| 0 | Nền | 2 token mới; KinStatus thêm hình icon và tone "Quá hạn"; KinListRow cho phép tiêu đề xuống dòng | S |
| 1 | Học sinh: trang lớp | §2.1, chưa có thanh dưới: Cần làm, thẻ, hàng buổi, dock, phản hồi sau khi nộp, link Zalo mở thẳng bài | M |
| 2 | Học sinh: thanh dưới và tab Điểm | Component thanh dưới mới; trang Cần làm gom mọi lớp; tab Điểm | M |
| 3 | Sổ điểm | §2.3: nhãn, Trung bình, cột dính, chip lọc, "Chấm N bài đang chờ", CSV, dòng giải thích Chờ duyệt | M |
| 4 | Gia sư: trang lớp | §2.2: ModuleRail thêm danh sách lớp, cột Nộp x/y, ngăn sửa luôn mở, xem trước YouTube, Gỡ có hỏi lại | M |
| 5 | Gia sư: Hộp việc và bản điện thoại | Hộp việc gom mọi lớp; thanh dưới gia sư 3 mục | M |
| — | Để sau, có điều kiện | Chọn nhiều ô và chấm hàng loạt trong lưới | L, chỉ làm khi gia sư báo chấm chậm |

Học sinh được làm trước vì đông người dùng nhất, độ đồng thuận cao nhất (8,9) và rủi ro thấp nhất. Sổ điểm làm trước trang lớp gia sư vì gom được việc chấm hằng tối mà không phải đụng vào ModuleRail.

---

## 4. Điều phải có và điều không được làm (gom từ 7 vai)

### 4.1 Phải có
| # | Điều | Vai yêu cầu |
|---|---|---|
| 1 | Mở trang là thấy "Cần làm" có đủ **mọi** việc (bài tập và kiểm tra), kèm số đếm, hạn có ngày và giờ, và "còn N ngày" bằng màu cảnh báo | Minh, Lan, Mai |
| 2 | Nút Nộp bài ≥48px, trong tầm ngón cái, ghi rõ chụp ảnh vở được, bấm là mở camera hoặc chọn tệp | Minh, Lan, Thanh, Hoa, UX |
| 3 | Báo rõ là đã nộp thành công | Minh |
| 4 | Link Zalo mở thẳng vào bài, không bắt chọn lớp, không dẫn ra trang quảng cáo hay Đăng ký | Lan, Minh |
| 5 | Tab Điểm cố định, điểm ghi x/10 kèm tên bài và ngày, có Trung bình | Minh, Lan, Mai, Hoa |
| 6 | Mỗi buổi có dấu hiệu rõ là có video record, bấm một lần là xem | Minh |
| 7 | Trạng thái luôn có chữ và hình. Đỏ chỉ dùng cho lỗi và quá hạn | UX, Mai, Hoa, kỹ sư |
| 8 | Chữ chính ≥16px; chữ phụ mang thông tin ≥14px và đủ đậm | Minh, Hoa, UX |
| 9 | Mỗi màn đúng 1 nút chính, ở vị trí cố định | Thanh, Hoa, UX, kỹ sư |
| 10 | Gia sư đổi lớp một cú bấm từ thanh bên | Thanh, UX |
| 11 | Hộp việc gom mọi lớp: chờ chấm, chờ duyệt, xin vào lớp | Thanh |
| 12 | Cột "Nộp x/y" ở mỗi buổi | Thanh |
| 13 | Kéo-thả tài liệu có nút "Chọn tệp" thật, tự lưu, hiện "Đã tự lưu lúc …", gỡ tệp bằng chữ "Gỡ" và có hỏi lại | Hoa, Thanh, UX |
| 14 | Link YouTube có dòng nhắc để chế độ Không công khai, và có xem trước | Hoa, Thanh |
| 15 | Có trạng thái "Chờ duyệt" cho điểm của gia sư phụ; học sinh chỉ thấy điểm sau khi chủ xác nhận | Thanh, Mai, Hoa |
| 16 | Sổ điểm lọc được theo trạng thái, có "Chấm N bài đang chờ", Xuất CSV, cột tên dính | Thanh, UX, kỹ sư |
| 17 | Gia sư dùng được trên điện thoại, tối thiểu là Hộp việc | Thanh |
| 18 | Trang nhẹ khi 4G yếu: không ảnh trang trí, không bóng nặng | Minh, kỹ sư |
| 19 | Đầu trang có tên lớp, tên cô và lịch học | Mai |
| 20 | Dùng lại KinListRow, KinTabs, KinStatus, DropZone, PageLayout; tách PR theo màn, có cờ | Kỹ sư |

### 4.2 Không được làm
| # | Điều | Vai nêu |
|---|---|---|
| 1 | Phải cuộn qua cả danh sách buổi mới thấy bài cần nộp hoặc điểm | Minh |
| 2 | Hạn và điểm viết chữ xám nhạt 12px, hoặc giấu trong dòng phụ | Minh, Mai |
| 3 | Nút nộp nhỏ hoặc nằm sát thanh dưới | Minh, Lan, Thanh |
| 4 | Giao diện kiểu bảng tính dày đặc trên điện thoại học sinh | Lan, Mai |
| 5 | Phím tắt (⌘K, N, Shift+bấm, phím mũi tên) là cách duy nhất để làm một việc, hoặc phím tắt một ký tự không tắt được | Hoa, UX, Lan, Mai |
| 6 | Chọn nhiều ô làm bật thanh hành động hàng loạt, dễ chấm nhầm | Hoa |
| 7 | Ô đang sửa đóng được mà không chắc chữ đã lưu | Hoa |
| 8 | Viết tắt khó hiểu: B3, KT 15′, TB, 42′ | Hoa |
| 9 | Trạng thái chỉ phân biệt bằng màu, hoặc dùng icon không kèm chữ | UX, Mai, Hoa |
| 10 | Nhiều nút navy cùng cấp, hoặc hai nút chính trên một thẻ | Thanh, Hoa, UX |
| 11 | Dải hoặc banner trang trí cao, lặp tên lớp, thẻ lồng thẻ | Thanh, UX, kỹ sư |
| 12 | Không có cách nhìn toàn cảnh 4–6 lớp | Thanh |
| 13 | Dock hoặc nút nổi che hàng cuối mà không chừa khoảng đệm | UX, kỹ sư |
| 14 | Animate height, Flip đo layout, thêm GSAP cho lớp học | Kỹ sư |
| 15 | Âm thầm đổi mô hình Phần > Chương > Bài trong lúc sửa giao diện | Kỹ sư |
| 16 | Màu theo môn trong khi chưa có danh sách môn cố định (Q10) | Kỹ sư |

---

## 5. Rủi ro và cách giảm

| # | Rủi ro | Mức | Cách giảm |
|---|---|---|---|
| R1 | Cả 3 phương án vẽ "Buổi" phẳng, nhưng dữ liệu hiện tại là Phần > Chương > Bài | Cao | **Chủ (Thanh) chốt trước PR 1.** Tạm thời hiển thị mỗi Bài là một hàng, có tiêu đề nhóm theo Chương (SectionHead). Không đổi schema trong đợt này |
| R2 | Màu môn phụ thuộc Q10 (danh sách môn chưa cố định) | TB | Dùng `--kin-lop-NN` theo id lớp như hiện tại. Màu chỉ để trang trí, không mang nghĩa, nên đổi sau không vỡ gì |
| R3 | Dock nộp bài che nội dung, hoặc có 2 bài cùng hạn | TB | Thân trang có `padding-bottom` bằng `--kin-cao-thanh-duoi` cộng chiều cao dock cộng 12px. Dock ghi tên bài cụ thể và nhắm vào hạn gần nhất. Kiểm ở 360px và 390px |
| R4 | Học sinh thấy điểm "Chờ duyệt" trước khi chủ xác nhận | Cao | Lọc ở server, không chỉ ẩn bằng CSS. Viết test cho truy vấn điểm phía học sinh |
| R5 | ModuleRail thêm danh sách lớp làm vỡ các màn gia sư khác | TB | Thêm một mục mới vào rail có sẵn, sau cờ; chụp so sánh mọi route gia sư trước và sau |
| R6 | Thiếu chọn nhiều ô làm Thanh chấm chậm | Thấp–TB | "Chấm N bài đang chờ" mở lần lượt và có nút "Bài tiếp", nên đã gần như chấm cả loạt. Đo sau 2 tuần, nếu gia sư vẫn kêu thì mới làm lưới |
| R7 | Tương phản token mới chưa đo bằng công cụ | Thấp | Đo bằng công cụ trước khi merge PR 0. Nếu dưới 4,5:1 thì tối màu thêm |
| R8 | Tải chậm trên 4G yếu | TB | Không thêm thư viện; ảnh thu nhỏ YouTube chỉ tải lazy ở phía gia sư; đo LCP trên cấu hình Moto G giả lập |
| R9 | Trang gia sư điện thoại chưa có bản vẽ | TB | PR 5 vẽ phác bằng HTML tĩnh trong `scratchpad/thiet-ke/` và cho Thanh duyệt trước khi viết mã |
| R10 | Học sinh không hiểu thanh dưới, vẫn tìm tab cũ | Thấp | Badge "Cần làm" có số; link Zalo mở thẳng bài. Bỏ 3 viên tab cũ để không có hai lối đi trùng nhau |
