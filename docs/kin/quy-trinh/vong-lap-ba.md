# Vòng lặp BA của KiN

Quy trình em chạy mỗi khi anh Thanh nói "tiếp tục". Mỗi vòng xử lý một việc trong backlog, từ
lúc đọc nguồn đến lúc tick sheet. Vòng tự hoàn thiện theo hai nghĩa: **không dừng lại hỏi**
khi thiếu quyết định (đặt giả định rồi làm tiếp), và **tự sửa chính quy trình** sau mỗi vòng
(mục Nhật ký cuối file).

Cập nhật 01/10/2026.

---

## Bảy bước

### 1. Chọn việc

- Nguồn: sheet *Todo list – Kin class*, dòng có cột Thanh (J) chưa tick.
- Chỉ nhận việc thuộc phần BA: đặc tả, thiết kế, nghiên cứu, đối chiếu. Code là của anh Thọ.
- Thứ tự: P0 → P1 → P2 → P3. Cùng mức thì ưu tiên việc đang **chặn** việc khác, rồi theo mã.
- Bỏ qua: việc anh đã hoãn (ghi "Hoãn" trong ghi chú), việc cần dữ liệu thật em không được đụng.

### 2. Đọc nguồn, theo thứ tự tin cậy

1. Lời anh Thanh mới nhất trong cuộc trò chuyện.
2. Mã đang chạy (Apps Script, web) — thứ đang thật sự tính tiền.
3. Đặc tả có ngày mới hơn.
4. Đặc tả cũ: **chỉ để chắt lọc**. Khác bản mới thì làm theo bản mới, ghi phần bị thay vào mục
   "Không dùng nữa" của đặc tả mới.
5. Nghiên cứu (Gemini, web): dữ liệu, phải kiểm chứng trước khi dùng.

### 3. Đối chiếu mâu thuẫn

Tìm chỗ việc này đụng việc khác: cùng một con số ở hai tài liệu, cùng một màn ở hai trang
Figma, một quy tắc cũ bị quy tắc mới làm sai. Mỗi chỗ ghi: hai bên nói gì, bên nào thắng
(theo bước 2), cần sửa tài liệu nào.

### 4. Đặt giả định thay vì dừng lại

- Thiếu quyết định → chọn phương án an toàn nhất, ghi vào `so-gia-dinh.md` với mã `GD-xx`:
  lý do, cái giá nếu sai, cách kiểm. Trong đặc tả ghi mã GD cạnh chỗ dùng.
- **Chỉ dừng hỏi anh** khi việc không đảo ngược được hoặc chạm vào: tiền thật của người khác,
  pháp lý, xoá hay sửa dữ liệu thật, đăng công khai, gửi tin thay anh.
- Mỗi báo cáo cuối vòng liệt kê giả định mới để anh chốt hoặc bác.

### 5. Làm

- Đặc tả: `docs/kin/nghiep-vu/*.md`. Mở đầu bằng quyết định, có công thức, **ví dụ số**, bảng
  tham số, và mục "Cần anh chốt" nếu có.
- Thiết kế: Figma *KiN Design System*, dùng biến màu, cỡ chữ, khoảng cách có sẵn. Dữ liệu mẫu ghi
  rõ là mẫu.
- Viết tiếng Việt thường ngày, câu ngắn, không gạch ngang dài, không từ lóng.

### 6. Tự kiểm trước khi giao

- [ ] Tính lại mọi ví dụ số bằng tay; tổng các dòng bằng dòng tổng.
- [ ] Ví dụ có ngày tháng thì đếm lại theo lịch thật (thứ mấy, tháng có mấy buổi).
- [ ] Chụp từng khung Figma vừa làm, soát chữ tràn, lệch, màu sai.
- [ ] Tìm từ khoá của quy tắc vừa đổi trong các đặc tả khác; sửa chỗ còn nói cách cũ.
- [ ] Mọi giả định mới đã có trong sổ.
- [ ] Không có dữ liệu thật của học sinh, số điện thoại, mật khẩu trong tài liệu.

### 7. Giao và ghi lại

- GitHub: đẩy lên nhánh `kin-tai-lieu-ban-giao`; đọc lại file theo mã commit và so hash với bản
  của em. Tiêu đề commit phải đúng chữ em viết, có dòng ghi tác giả.
- Sheet: ghi chú `[ngày] Xong phần Thanh: … Spec: … Figma: … Chờ dựng.` rồi tick cột J.
  **Không tick** khi còn việc của anh (xoá dữ liệu thật, chốt pháp lý). Trước khi sửa, kiểm hàng
  ẩn (hiện có 171–184 và 188–199): nhảy tới ô mà bị đẩy sang hàng khác là hàng đó đang ẩn. Sửa
  xong phải ẩn lại đúng khoảng cũ.
- Project: lưu bản mới của đặc tả.
- Báo cáo cho anh: làm gì, phát hiện gì, giả định mới, anh cần chốt gì, việc kế tiếp.

---

## Khi nào vòng dừng

- Hết việc thuộc phần BA trong sheet.
- Việc kế tiếp cần anh quyết (bước 4, điều kiện dừng).
- Công cụ không vào được (Figma, Chrome, máy của anh mất kết nối): báo và dừng, không làm vòng.

---

## Nhật ký vòng lặp (bài học đã thành luật)

| Ngày | Chuyện xảy ra | Luật mới |
|---|---|---|
| 30/09 | Em làm lại cộng đồng theo đặc tả 24/09, anh nhắc phải theo bản mới | Bước 2: đặc tả cũ chỉ để chắt lọc |
| 30/09 | GitHub tự thay tiêu đề commit ở 2 lần đẩy | Bước 7: chờ hộp thoại ổn định, kiểm lại tiêu đề trước khi bấm |
| 30/09 | Dán nội dung vào trình soạn GitHub khi chưa xoá hết → nội dung bị lẫn | Xoá bằng phím ảo trong trang, kiểm trình soạn trống, rồi mới dán |
| 01/10 | Bản 30/09 đoán sai luật bảng tính ("buổi miễn" là buổi lễ; thực ra là môn miễn của từng em) | Bước 2: có mã đang chạy thì đọc mã trước khi viết đặc tả |
| 01/10 | Lớp học 22:15 nằm trong giờ yên lặng 22:00–07:00 | Bước 3: đối chiếu mọi mốc giờ với giờ yên lặng |
| 01/10 | Ví dụ "Toán 8 buổi tháng 10" sai lịch thật (tháng 10/2026 có 9 buổi thứ Hai và thứ Năm) | Bước 6: đếm ví dụ theo lịch thật, ghi rõ buổi nghỉ |
| 01/10 | Đổi luật học phí nhưng các màn cũ (điểm danh, phiếu, trang phụ huynh) và quyết định 27/09 vẫn ghi "tính theo tháng" | Bước 6: đổi một luật thì tìm câu cũ trong cả Figma, không chỉ trong đặc tả |
| 01/10 | Hàng TK-170 đến TK-183 đang ẩn, lệnh nhảy ô rơi sang hàng khác | Bước 7: kiểm hàng ẩn trước khi ghi sheet |
