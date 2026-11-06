# Rà soát vận hành lớp mẫu: bảng tính đã chạy thế nào, web cần gì

Bản 26/10/2026. Lớp mẫu là lớp học đêm 4 môn của anh Thanh. Lớp chạy trên một Google Sheet và mã Apps Script v7 từ tháng 9/2026. Ngày 02/10 anh chốt ngừng cập nhật bảng tính và chuyển hẳn lên web. Bảng tính giữ lại để hiểu lớp đã vận hành ra sao. Tài liệu này rút từ bảng tính và dữ liệu thật ngày 26/10 (chỉ đếm, không chép tên học sinh).

---

## 1. Vòng vận hành trên bảng tính

| Khi nào | Gia sư làm (nút menu v7) | Bảng tính tạo ra |
|---|---|---|
| Học sinh đăng ký | gửi Google Form; bấm **2. Nạp HS từ Form** | Hồ Sơ Học Sinh (sổ gốc) |
| Học thử | **5. Mẫu tin rủ học thử**, **7. Follow-up học thử** | Danh Sách Học Thử, tin Zalo soạn sẵn |
| Mở lớp | **6b. Tạo / Cập nhật lịch Meet** | 4 sự kiện lặp trên Google Calendar, tab Lịch Meet |
| Chào học sinh mới | **4. Tin nhắn chào mừng** | tin chào + mời phụ huynh, soạn sẵn |
| Mỗi buổi | tick ✓ / P / V ở tab Điểm Danh | chuyên cần |
| Sau bài kiểm tra | chép điểm từ Azota sang Sổ Điểm | Điểm TB, % BTVN |
| Đầu tháng | **3. Thiết lập Học Phí**, **♻️ Cập nhật tất cả** | Thu Học Phí, Dashboard, tin nhắc đóng |
| Cuối tháng | **8. Sổ Điểm**, **9. Xếp hạng** | hạng, học bổng, tin báo cáo phụ huynh |
| Khi cần | **10. Tra cứu**, **11. Đồng bộ Azota**, **12. Khảo sát** | tra một em, danh sách nhập Azota, khảo sát |

Số liệu ngày 26/10: 23 học sinh chính thức, 4 lớp; đã thu khoảng 85% học phí tháng 10.

## 2. Cái gì chạy, cái gì không

| Phần | Thực tế | Vì sao |
|---|---|---|
| Học phí, nhắc đóng | **chạy**: đã thu khoảng 85% học phí tháng 10 | một nút, ra sẵn số và tin nhắn |
| Lịch Meet | chạy nhưng **rối**: 3 thế hệ lịch, Toán và Anh dừng từ 22–24/10 mà mã vẫn báo ổn | lịch sửa ở hai nơi (mã và app Lịch), mã không kiểm lại |
| Điểm danh | **gần như bỏ**: chỉ tick 1 buổi Sử trong tháng 10 | phải mở tab, tìm đúng cột ngày, tick từng ô sau 23:45 |
| Điểm kiểm tra | **chưa có điểm nào** trong Sổ Điểm | điểm nằm ở Azota, phải chép tay |
| Xếp hạng, học bổng | không chạy được | thiếu điểm |
| Tin báo cáo phụ huynh | toàn "Chưa nhập điểm" | thiếu điểm |

Bài học: phần nào **ra kết quả sau một nút** thì được dùng. Phần nào **bắt gõ tay hằng ngày** thì bị bỏ, và kéo theo mọi phần phía sau.

## 3. Web cần gì

| # | Yêu cầu | Đặc tả |
|---|---|---|
| 1 | Lịch là gốc trên KiN; mỗi lớp một phòng Meet cố định; KiN kiểm lại lịch Google mỗi sáng | `lich-lop-va-vao-hoc.md` mục 0, 2, 4 |
| 2 | Học sinh, phụ huynh, gia sư vào lớp bằng **một nút**, không tìm link | `lich-lop-va-vao-hoc.md` mục 3 |
| 3 | Điểm danh **tick sẵn** theo lượt vào lớp; gia sư chỉ xác nhận | `diem-danh-bai-kiem-tra-va-diem.md` mục 1 |
| 4 | Điểm về **tự động** từ phòng thi KiN hoặc file Azota | `diem-danh-bai-kiem-tra-va-diem.md` mục 2 |
| 5 | Bảng điểm tự tính; ô trống ghi "chưa có", không thành 0 hay 100% | `diem-danh-bai-kiem-tra-va-diem.md` mục 3 |
| 6 | Học phí đếm buổi từ bản ghi buổi học, chỉ một nguồn | `dua-bang-tinh-len-web.md` mục 1 |
| 7 | Nhập lớp mẫu từ bảng tính **một lần** | `lich-lop-va-vao-hoc.md` mục 5 |
| 8 | Việc hằng ngày của gia sư gói vào Hộp việc: vào lớp, điểm danh, giao bài | `quyet-dinh-giao-dien-va-hoc-phi.md` mục 2 |

## 4. Giữ lại từ bảng tính

- Công thức học phí, hệ số chuyên cần, điểm xếp hạng, 5 mức cảnh báo, học bổng TOP 1 và TOP 2: **giữ nguyên**, đã ghi trong `dua-bang-tinh-len-web.md`.
- Tin nhắn soạn sẵn theo từng tình huống (chào, rủ học thử, nhắc đóng, báo cáo): giữ giọng văn, gửi theo `gui-qua-zalo.md`.
- Giờ học 22:15 cố định, 90 phút.
- "Cập nhật tất cả không ghi đè dữ liệu gõ tay": trên web là luật **ô sửa tay có dấu, không bị tính lại đè lên**.

## 5. Bỏ

- Tab AZOTA có cột Mật khẩu (`GD-27`, đã bỏ cùng bảng tính).
- Số báo danh dựng từ số điện thoại. Thay bằng mã học sinh KiN.
- Xoá ô ngày để báo nghỉ lễ. Thay bằng nút "Buổi này lớp nghỉ".
