# Quyết định hội đồng: giao diện học sinh KiN (SCL5)

Hội đồng 5 vai chấm 3 phương án (A: Danh sách lớp, B: Kệ sách, C: Thẻ việc hôm nay). Cả 5 vai chấm trên ảnh 390px; chưa vai nào mở bản 1280px hay HTML trực tiếp.

## 1. Bảng điểm

| Vai | A | B | C | Chọn |
|---|---|---|---|---|
| Học sinh lớp 12, học 22:15, Android tầm trung | 6 | 6 | 8,5 | C |
| Phụ huynh 45 tuổi, ít rành công nghệ | 6,5 | 7,5 | 8 | C (+ nhật ký của B, điểm từng bài của A) |
| Gia sư chủ lớp (anh Thanh) | 6 | 7,5 | 8 | C (+ Tài liệu kèm và điểm ở lề của B) |
| Chuyên gia UX và tâm lý giáo dục | 6 | 7 | 8,5 | C (+ Mục tiêu bài, Tự kiểm tra, chú thích nhật ký của B) |
| Học sinh học thử 14 ngày | 6,5 | 7 | 8,5 | C (+ trang bài và mục lục chương sắp mở của B) |
| **Trung bình** | **6,2** | **7,0** | **8,3** | **C: 5/5 phiếu** |

## 2. Phương án đề xuất: nền C, ghép thêm từ B và A

Dùng **C (Thẻ việc hôm nay)** làm nền. Lý do cả 5 vai cùng nêu: màn đầu trả lời ngay câu "tối nay làm gì" (gom việc từ mọi lớp, mỗi thẻ một nút), trang lớp thu gọn quanh bài đang học, trang bài có bậc thang bước, và màn hết hạn học thử nêu những gì được giữ (5 bài, 3 bài nộp, 8,0) chứ không đe doạ.

Ghép thêm:

| Lấy từ | Ý | Đặt vào đâu trong C | Vai đề nghị |
|---|---|---|---|
| B | Ô "Nhật ký đêm học" 14 buổi (Có mặt / Nghỉ có báo / Vắng, kèm số đếm) và câu "nghỉ có báo vẫn tính là giữ nhịp" | Màn Hôm nay, thay hoặc đặt cạnh ô "6 buổi liền" | Phụ huynh, UX |
| B | Khối "Mục tiêu bài" và "Tự kiểm tra (chỉ em thấy, không tính điểm)" | Trang bài, trước và sau bậc thang | UX, Học thử |
| B | Mục "Tài liệu kèm" ở vị trí cố định, liệt kê mọi tệp; tệp chưa mở ghi rõ khi nào mở | Trang bài, thành một khu cố định chứ không chỉ một phiếu ở bước 1 | Gia sư |
| B | Mục lục chương sắp mở có tên bài và ngày mở ("Mở từ 05/12") | Trang lớp; luôn mở được trong 1 lần chạm | Phụ huynh, Học thử |
| A + B | Điểm từng bài ở lề phải danh sách bài ("Đã chấm 8,5/10") | Trang lớp, kể cả trong phần "đã học · xem lại" | Phụ huynh, Gia sư |

Không lấy: khối "Vinh danh tuần này" và câu "còn 1 bài để vào danh sách tuần này" của A (UX gọi đây là áp lực so sánh xã hội; học sinh học thử cũng thấy áp lực). Không lấy ẩn dụ "Đọc tiếp / Đang đọc" của B cho lớp video (học sinh và phụ huynh đều thấy lạ).

## 3. Danh sách bắt buộc sửa

Gộp từ 5 phiếu. Cột "Vai" ghi số vai nêu: HS = học sinh, PH = phụ huynh, GS = gia sư, UX = chuyên gia, HT = học thử.

### P1: sửa trước khi đưa học sinh xem thử

| # | Việc | Vai |
|---|---|---|
| 1 | **Hết hạn học thử (A, B, C đều mắc):** bài đã học, đã nộp và điểm không được ghi "Đã khoá" hay tô xám. Tách 3 trạng thái: "Đã học · 8,5/10 · xem lại được" (xem được bản ghi, phiếu, bài đã nộp, điểm), "Mở khi đăng ký" (bài chưa tới), "Đã khoá" chỉ cho bài chưa mở theo lịch. Chữ và trạng thái phải khớp với câu "vẫn được giữ". Giữ thẻ tổng kết 5 bài / 3 bài nộp / điểm TB. | 5/5 |
| 2 | **Số việc thống nhất một nguồn:** badge tab "Cần làm" (đang là 2) phải bằng "Hôm nay còn N việc" (đang là 3). Ghi rõ buổi học tối nay và việc đã xong có được đếm không. | 5/5 |
| 3 | **C-4b bị lặp:** bỏ lần lặp của danh sách Chương 2–5 và dòng "Thêm 3 bài nữa trong chương" đang nằm dưới danh sách bài khoá. | 5/5 |
| 4 | **Trạng thái rỗng cho Hôm nay** (không có việc hoặc đã xong hết): một câu ghi nhận, buổi kế tiếp (ví dụ "Thứ Ba 22:15"), bài xem dở hoặc nút ôn lại / làm thử đề. Không để trắng. | 5/5 |
| 5 | **Tương phản:** chữ xám (chương sắp mở, hàng khoá, chữ phụ, hạn nộp) và chip cam trên nền cam đạt ít nhất 4.5:1 (chữ lớn 3:1), không làm mờ bằng opacity; đủ to và đủ đậm để đọc lúc 23h ở độ sáng thấp. | HS, PH, UX |
| 6 | **Nút chính trong màn đầu:** Nộp bài / Làm tiếp / Học tiếp nằm trong khoảng 700px đầu trên điện thoại, không bị ảnh bìa hay khối số liệu đẩy xuống. Việc có hạn gần đứng đầu trang lớp với nút to. | HS, HT |
| 7 | **Bậc thang bước tự rút gọn:** bài thiếu khối (không phiếu, không kiểm tra Azota) thì không hiện bước rỗng; "Xong x/y" đếm theo số bước thật. | HS, UX |

### P2: sửa trong cùng đợt dựng

| # | Việc | Vai |
|---|---|---|
| 8 | Link Meet là nút bấm thẳng, hiện trên màn đầu và trang lớp vào ngày có buổi, kèm giờ mở phòng. Không viết "link có trong lịch Gmail". | GS |
| 9 | Mỗi việc cần làm ghi đủ: môn, hạn (ngày + giờ + còn bao lâu), hình thức nộp (ảnh/PDF, nộp ở đâu). Việc đã nộp ghi "Chờ chấm" hoặc "Đã chấm X/10". | GS |
| 10 | Bài cũ tìm lại được trong tối đa 2 lần chạm từ trang lớp; cân nhắc ô tìm bài/tài liệu trong lớp. | GS |
| 11 | Học thử: ghi ngày giờ hết hạn tuyệt đối và số ngày còn ("Còn 3 ngày, hết 23:59 Thứ Tư 25/11"), môn nào đang học thử, những gì được giữ; giọng trung tính, không dùng thanh đếm ngày tiêu hao hay nền cảnh báo. Trạng thái học thử phải hiện ở màn Hôm nay, không chỉ ở trang lớp. Nút "Đăng ký chính thức" là nút chính, Zalo là nút phụ. | PH, GS, UX, HT |
| 12 | Màn hết hạn nói rõ đăng ký chính thức gồm gì, học phí và cách đóng (hoặc link tới trang đó); nói rõ việc có hạn sau ngày hết học thử, link Meet và nhóm Zalo còn dùng được không. | HT |
| 13 | Không dùng mỗi màu để mang nghĩa (WCAG 1.4.1): chấm màu môn trong "7 ngày tới", ô lịch học thử, ô nhật ký đều có nhãn chữ, hình hoặc aria-label. | UX |
| 14 | Vùng chạm ít nhất 44×44px cho link chữ ("xem lại", "Thêm 3 bài", "Xem lịch tuần", mốc video). Mốc video xếp dọc, không cuộn ngang bị cắt chữ. | UX |
| 15 | Ảnh bìa nhỏ và tĩnh; video chỉ tải khi bấm play, để Android tầm trung không giật khi cuộn. | HS |
| 16 | Giữ quy tắc "nghỉ có báo không mất chuỗi" ở mọi chỗ hiện chuỗi; không có thông báo mất chuỗi kiểu trừng phạt. Điểm chăm ghi "không có bảng xếp hạng" như C đang làm. | UX |
| 17 | Bỏ hoặc giải thích tại chỗ các chữ khó hiểu: "Điểm chăm 340" (tính thế nào), "Azota", "chuỗi". | PH |
| 18 | Zalo chỉ là lối hỏi kiến thức; hạn, link, tệp thì app tự trả lời. | GS |

### P3: cân nhắc

| # | Việc | Vai |
|---|---|---|
| 19 | Giao diện tối hoặc giảm độ sáng cho khung 22h–23h45 (cả 3 bản đang nền trắng). | UX |

## 4. Điểm bất đồng giữa các vai

| Chủ đề | Bên này | Bên kia | Đề xuất xử lý |
|---|---|---|---|
| Tên ngày trong ô lớp ở 390px | HS: rút gọn "T3, T7" để thẻ không cao lệch | PH: "T3/T7" khó hiểu với người lớn tuổi, nên ghi "Thứ Ba" cỡ chữ nhỏ | Hiện "T3 · T7" trên thẻ kèm aria-label "Thứ Ba, Thứ Bảy"; ghi tên đầy đủ trong trang lớp. Hoặc ghi đầy đủ nhưng cố định chiều cao thẻ. Cần chủ quyết. |
| Vinh danh và điểm chăm | HS, HT: động lực vừa phải ở cuối trang là được; A đặt vinh danh gây áp lực | UX: bỏ mọi so sánh xã hội khỏi màn đầu, vinh danh (nếu có) ở trang riêng, chỉ em đã đồng ý; PH: vinh danh không cần | Bỏ vinh danh khỏi màn đầu (mọi vai đều chấp nhận được). Giữ điểm chăm cá nhân, có giải thích. |
| Độ đầy đặn (tiêu chí D12) và tải nhận thức | HS, HT: A đầy đặn nhưng rối; C "ảnh bìa ít chỗ" là điểm trừ | UX: B ít điểm chăm/vinh danh là điểm cộng về động lực; HS: ảnh bìa phải nhỏ và tĩnh vì hiệu năng | Giữ ảnh bìa nhỏ của C; đầy đặn bằng nội dung thật (việc, vòng %, nhật ký) chứ không bằng ảnh lớn. |
| Bài đã học bị gập ("4 bài đã học · xem lại") | HS, PH, UX: thu gọn giúp đỡ cuộn, tốt hơn B | GS: phải bấm thêm mới tìm được phiếu cũ; PH: muốn thấy toàn bộ nội dung khoá (không giấu sau "Thêm 3 bài") | Giữ thu gọn nhưng hiện điểm ở lề ngay trên hàng tóm tắt, mở được trong 1 lần chạm, thêm ô tìm bài (mục 10). |
| Thanh 14 vạch của A ở học thử | HS: "rõ" | PH: "Ngày 11/14" khó đọc; UX: đọc như cảnh báo khan hiếm | Dùng lịch 14 ô của C kèm số ngày còn và giờ hết hạn tuyệt đối (mục 11). |
| Trang bài: Mục tiêu đứng trước video (B) | UX, HT: Mục tiêu và Tự kiểm tra là điểm mạnh sư phạm | HS: người thiếu kiên nhẫn sẽ bỏ qua, muốn thấy nút play ngay | Khi ghép vào C, để Mục tiêu là 1–2 dòng gọn ngay trên bậc thang, không đẩy video và nút chính ra khỏi màn đầu (mục 6). |

## 5. Giới hạn của phiếu

- Cả 5 vai chỉ xem ảnh 390px. Bản 1280px và hành vi thật (cuộn, chạm, tải) chưa ai kiểm.
- Số tương phản trong mục 5 là ước lượng từ ảnh, chưa đo.
