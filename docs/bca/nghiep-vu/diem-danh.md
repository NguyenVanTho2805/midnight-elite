# Nghiệp vụ — Điểm danh (Đợt 1)

Nguồn: `kinDiemDanh`, `kin_luuDiemDanh`, `kin_ddMarks`, `kin_ddKiemDS`, `kin_ddTong`, `kin_ddLive`, `K.chuyenCan`, `kin_ccThang` trong script v8.12; bản xuất sheet ngày 26/11/2026 (tab `__DiemDanh` và ma trận ✅ Điểm danh); quyết định 21; `thiet-ke/huong-chon.md` (mục "Sửa bắt buộc" 1, 2, 5). Quy ước chung xem đầu tệp `ghi-danh.md`.

## Điều 1. Ký hiệu thống nhất

1.1. Mỗi cặp (buổi, em) có **tối đa một** bản ghi điểm danh, mang một trong ba trạng thái sau:

| Trạng thái | Nút trên điện thoại | Ô ma trận (theo thiết kế) | Mã lưu |
|---|---|---|---|
| Có mặt | **Có** | ✓ | `co` |
| Vắng có phép | **Phép** | P | `phep` |
| Vắng không phép | **Vắng** | K | `vang` |

1.2. **Chưa có bản ghi nghĩa là "chưa điểm danh"**, không phải có mặt. Ma trận để trống ô đó, và màn Hôm nay đếm em đó là "còn thiếu".

## Điều 2. Danh sách em cần điểm danh của một buổi

2.1. Danh sách gồm các em có ghi danh môn của buổi (**Thử hoặc Chính thức**) còn hiệu lực vào ngày của buổi (`ghi-danh.md` Điều 3.2). Bỏ em đã ẩn, trừ khi em đó đã có bản ghi ở buổi này từ trước khi bị ẩn. Danh sách sắp theo tên tiếng Việt.

2.2. Buổi đã huỷ không có danh sách và không điểm danh được.

- Ví dụ thật (đếm từ sheet ngày 26/11, chỉ tính hồ sơ còn ở 👥 Học sinh):
  - buổi Sử T4 25/11 có **54 em** (14 Chính thức, 40 Thử);
  - buổi Sử CN 29/11 chỉ còn **43 em**, vì các em thử Sử hết hạn ngày 28/11 không còn trong danh sách.
- Ca biên lên chính thức giữa chừng: em thử Toán đến 07/12, Chính thức từ 08/12. Buổi 05/12 em có tên ở dạng **Thử**, buổi 08/12 ở dạng **Chính thức**. Trên ma trận tháng, cột "Loại" hiện "Chính thức" nếu em có ít nhất một buổi Chính thức trong tháng, giống sheet.
- Ca biên đổi môn: em nghỉ Toán đến 08/12 và học Sử từ 09/12. Em có trong các buổi Toán 01, 05, 08 và các buổi Sử từ 09/12. Em không xuất hiện ở Toán 12/12.

## Điều 3. Cách GV điểm danh trên điện thoại (quyết định 21)

3.1. Màn điểm danh của một buổi xếp một cột, mỗi em một hàng, có ba nút Có / Phép / Vắng. Mỗi lần bấm **lưu ngay**: hiện "Đã lưu 22:31", và nếu mất mạng thì xếp vào hàng đợi.

3.2. Nút **"Đánh tất cả có mặt"**: đặt **Có** cho mọi em **chưa có** bản ghi. Không ghi đè Phép/Vắng đã chọn. Có thanh "Hoàn tác" trong 5 giây.
- Ví dụ: buổi 25/11 Sử có 54 em. GV bấm "Đánh tất cả có mặt" được 54 Có, rồi chạm Vắng cho 35 em và Phép cho 4 em. Kết quả: **15 Có · 4 Phép · 35 Vắng**.
- Ca biên: GV đã chọn Vắng cho 2 em rồi mới bấm "Đánh tất cả có mặt". Kết quả: 52 Có và 2 Vắng, 2 em Vắng không bị đổi.

3.3. **Buổi đã điểm danh xong** khi mọi em trong danh sách đều có bản ghi. Hệ thống lưu `da_diem_danh_luc` (thời điểm đủ lần đầu). Không cần tick riêng như ô "Đã điểm danh" của sheet.

3.4. **Được điểm danh từ lúc nào:** mở từ 30 phút trước giờ bắt đầu. Không được điểm danh buổi ở các ngày sau.
- Ví dụ: buổi 22:15 thì mở nút từ 21:45. Buổi T7 05/12 không điểm danh được vào ngày 04/12.

3.5. **Sửa sau buổi:** sửa buổi đã quá 48 giờ phải xác nhận lại (theo thiết kế). Phạm vi sửa của GV xem Câu hỏi 2. Mọi lần sửa đều ghi nhật ký: ai sửa, lúc nào, giá trị cũ và mới.

## Điều 4. Sau nửa đêm và múi giờ

4.1. Điểm danh gắn với **mã buổi**, không gắn với "hôm nay".
- Ví dụ: buổi Anh T5 26/11 lúc 22:15–23:45. GV mở điện thoại lúc 00:20 ngày 27/11:
  - màn Hôm nay vẫn hiện thẻ "Buổi tối qua — Anh 26/11 — còn thiếu 51 em" (xem `hom-nay.md` Điều 2);
  - GV điểm danh bình thường;
  - bản ghi thuộc buổi 26/11, và tính vào tháng 11.
- Ca biên đổi tháng: buổi Anh 30/11 được điểm danh lúc 00:10 ngày 01/12 vẫn là điểm danh **tháng 11**.

4.2. Giờ hiển thị "Đã lưu hh:mm" và giờ ghi trong nhật ký đều theo giờ Việt Nam. Trong CSDL lưu `timestamptz`.

## Điều 5. Khi ghi danh thay đổi sau khi đã điểm danh

5.1. **Em được thêm vào một buổi đã điểm danh xong**, ví dụ chủ lùi ngày bắt đầu ghi danh: buổi đó quay lại trạng thái "còn thiếu 1 em", và hệ thống **không** tự đặt Có cho em.

5.2. **Em bị cắt khỏi một buổi đã có bản ghi**, ví dụ chủ lùi ngày nghỉ về trước: bản ghi vẫn giữ trong CSDL nhưng không hiện trên danh sách, không tính chuyên cần. Nếu ghi danh được nới lại thì bản ghi hiện lại.

5.3. Buổi bị huỷ sau khi đã điểm danh: xem `buoi-hoc.md` Điều 6.2.

## Điều 6. Số liệu chuyên cần (chỉ để xem trong Đợt 1)

6.1. Với mỗi em, mỗi môn, mỗi tháng, chỉ tính các buổi **đã có bản ghi** của em:
- đếm số buổi Có, Phép, Vắng;
- hiện "có mặt x/y buổi", với y = Có + Phép + Vắng;
- công thức chuyên cần dạng điểm (dùng để xếp hạng ở Đợt 3) xem Câu hỏi 1.
- Ví dụ thật: buổi Anh 19/11 có 49 em, gồm 31 Có, 3 Phép, 15 Vắng.
  - Tỉ lệ có mặt (Có/tổng) = 63%.
  - Nếu tính Phép là có mặt như cột "Chuyên cần" của 👥 thì được 69%.
  - Ma trận sheet ghi "có mặt 83%" cho môn Anh tháng 11. Con số này gộp 2 buổi đã tick (16/11 đủ 37 em và 19/11) và tính Phép là có mặt: (37 + 49 − 15) / 86 = 83%.

6.2. **Cần chú ý:** em có **từ 2 buổi Vắng trở lên** trong tháng ở cùng một môn thì hiện ở màn Hôm nay (giống "Cần chú ý" của sheet). Phép không tính vào ngưỡng này.

6.3. Điểm nối Đợt 2: chuỗi đi học liên tiếp của học sinh (theo thiết kế, mục 5):
- Có thì chuỗi +1;
- Phép giữ nguyên chuỗi;
- Vắng đưa chuỗi về 0;
- buổi huỷ và buổi chưa điểm danh thì bỏ qua.

## Điều 7. Chuyển ký hiệu cũ từ sheet

7.1. Lấy dữ liệu từ **cả hai nguồn**:
- `__DiemDanh`: chỗ lưu bền, chỉ chứa V và P;
- ma trận ✅ Điểm danh đang hiển thị: có thể còn dấu GV đã gõ mà chưa được lưu, vì sheet chỉ lưu khi bấm Làm mới hoặc khi chạy lượt tự động 20:30.

Bảng ánh xạ:

| Ở sheet | Điều kiện | Bản ghi mới |
|---|---|---|
| `V` hoặc `v` | bất kỳ | `vang` |
| `P` hoặc `p` | bất kỳ | `phep` |
| ô trống | buổi đã tick "Đã điểm danh" và em có trong danh sách (Điều 2) | `co` |
| ô trống | buổi chưa tick | không tạo bản ghi |
| `—` | em không có ghi danh hoặc lớp nghỉ | không tạo bản ghi |
| ký tự khác (ví dụ `x`, `C`, `Vắng`) | bất kỳ | **không tự đoán**: đưa vào danh sách lỗi để chủ xem |

Ở ký tự khác, sheet tự coi là có mặt mà không báo gì. Bản xuất 26/11 không có ô nào thuộc loại này.

7.2. Số thật trong bản xuất ngày 26/11:
- `__DiemDanh` có 55 dấu: 51 V, 4 P. Thuộc 2 buổi là Anh 19/11 (15 V, 3 P) và Sử 22/11 (36 V, 1 P).
- Ma trận còn **39 dấu chưa lưu** của buổi **Sử 25/11** (35 `v`, 4 `p`, đều chữ thường). Buổi này **chưa tick** "Đã điểm danh". Cách xử lý xem Câu hỏi 3 ở `chuyen-du-lieu.md`.
- Các buổi đã tick: 16/11 Anh, 17/11 Toán, 18/11 Sử, 19/11 Anh, 22/11 Sử. Số bản ghi sẽ tạo ra xem `chuyen-du-lieu.md` mục 4.4.

## Khác sheet

| # | Sheet | Web mới | Căn cứ |
|---|---|---|---|
| K1 | Ô trống nghĩa là có mặt. | Ô trống nghĩa là chưa điểm danh; Có phải được bấm (hoặc dùng "Đánh tất cả có mặt"). | Thiết kế mục 1, quyết định 21 |
| K2 | Tick "Đã điểm danh" là việc riêng. | Buổi tự thành "đã điểm danh" khi mọi em có bản ghi. | Tránh lệch như buổi 25/11 |
| K3 | Dấu gõ vào chỉ được lưu khi Làm mới hoặc lúc 20:30. | Lưu ngay mỗi lần bấm. | Thiết kế mục 1 |
| K4 | Gõ ký tự lạ thì tự coi là có mặt. | Chỉ có 3 nút, không gõ tự do. | Toàn vẹn dữ liệu |
| K5 | Ma trận dùng V cho vắng. | Ma trận dùng K cho vắng không phép, nút ghi chữ "Vắng" đầy đủ. | Thiết kế mục 2 |

## Câu hỏi cho chủ

1. **Chuyên cần dạng số (dùng cho báo cáo và xếp hạng ở Đợt 3) tính thế nào?** Sheet đang có hai công thức khác nhau: cột 👥 "Chuyên cần" = (buổi − Vắng)/buổi, coi Phép là có mặt; còn sổ điểm thì Có = 1, Phép = 0,8, Vắng = 0,5, thang 10.
   - A. Đợt 1 chỉ hiện số đếm Có/Phép/Vắng; công thức điểm chốt ở Đợt 3, tạm giữ công thức của sổ điểm. **(khuyên dùng)**
   - B. Thống nhất một tỉ lệ: Có/(Có + Phép + Vắng).
   - C. Thống nhất một tỉ lệ: (Có + Phép)/(Có + Phép + Vắng), như cột 👥.
2. **GV được sửa điểm danh cũ đến bao giờ?**
   - A. Mọi lúc; quá 48 giờ phải xác nhận; có nhật ký. **(khuyên dùng: khớp thiết kế)**
   - B. Chỉ trong 7 ngày; sau đó chỉ chủ sửa được.
   - C. Chỉ trong ngày của buổi (đến 06:00 sáng hôm sau).
