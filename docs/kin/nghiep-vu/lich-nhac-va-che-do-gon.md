# Lịch, nhắc lịch và chế độ gọn: quy tắc cho TT-201, TT-202, TT-203

Ba việc này đến từ báo cáo *Phần mềm cho gia sư quy mô nhỏ* (29/09/2026): nhắc lịch là
thứ cơ sở nhỏ thật sự trả tiền, báo nghỉ sát giờ là một trong ba lý do họ bỏ phần mềm
quay về bảng tính, và chưa phần mềm nào cho tắt bớt module. Tài liệu này chốt cách chạy
để ai dựng cũng làm giống nhau.

**Số nào ghi "đề xuất" là số tạm**, anh Thọ cứ dựng theo nhưng để dạng cấu hình. Ngưỡng sát
giờ, hạn buổi bù và giờ yên lặng đã chốt ngày 30/09. Mọi số nằm ở mục Tham số cuối file.

Thiết kế Figma, file *KiN Design System*:

| Việc | Trang | Khung | Node |
|---|---|---|---|
| TT-201 | 🖥 Vỏ ứng dụng — 4 vai | Vỏ — Gia sư · nhắc lịch tự động trước 24 giờ và 1 giờ | `178:285` |
| TT-202 | 🗓 Lịch tuần | Vỏ — Gia sư · báo nghỉ sát giờ | `176:98` |
| TT-203 | 🖥 Vỏ ứng dụng — 4 vai | Vỏ — Gia sư · chế độ gọn, chỉ Lịch + Học phí | `177:265` |

Tên học sinh và phụ huynh trong các khung là **dữ liệu mẫu**.

---

## TT-202 · Báo nghỉ sát giờ: một thao tác

Phụ huynh hoặc học sinh báo nghỉ qua link sổ học. Hệ thống xếp theo thời điểm báo:

| Báo trước giờ học | Hệ thống làm gì | Gia sư phải làm gì |
|---|---|---|
| từ 2 giờ trở lên | Tự ghi "Nghỉ có báo", không tính phí, tự giữ 1 buổi bù | Không gì cả |
| dưới 2 giờ | Đưa vào Hộp việc với nhãn "Báo nghỉ sát giờ" | Bấm **một** nút |

Hai nút trên màn:

- **Không tính phí, giữ 1 buổi bù** (nút chính). Bấm một lần làm đủ ba việc:
  1. Ghi buổi đó là "Nghỉ có báo". Không tính phí, không cần phụ huynh xác nhận.
  2. Cộng 1 buổi bù cho học sinh, hạn dùng 30 ngày.
  3. Nhắn phụ huynh: *"Đã ghi nhận con nghỉ buổi 30/09. Buổi này không tính phí và con
     còn 1 buổi bù. Thầy/Cô sẽ hẹn giờ bù với anh/chị."*
- **Tính phí buổi này.** Chỉ dùng khi gia sư đã báo trước quy định phạt với phụ huynh.
  Chọn nút này thì không có buổi bù.

Không mở thêm hộp thoại hay form nào. Phần mềm nước ngoài làm việc này cồng kềnh, và đó
là một lý do người ta bỏ.

**Buổi bù:**

- Hết hạn thì mất, và gia sư được báo trước 3 ngày.
- Dùng buổi bù thì chọn nó khi điểm danh một buổi mới. Buổi đó không tính phí thêm.
- Hiện số buổi bù đang giữ trên sổ học của phụ huynh, để hai bên cùng thấy một con số.

## TT-201 · Nhắc lịch trước 24 giờ và 1 giờ

| Tin | Gửi lúc | Ngoại lệ |
|---|---|---|
| Nhắc 24 giờ | 24 giờ trước giờ học | Rơi vào 22:00–07:00 thì dời về 21:30 tối hôm trước |
| Nhắc 1 giờ | 1 giờ trước giờ học | Buổi bắt đầu trước 08:00 thì bỏ tin này |

- Gửi cho phụ huynh và học sinh. Gia sư tắt được từng bên.
- Buổi đã huỷ hoặc đã báo nghỉ thì **không gửi**.
- Tối đa 2 tin nhắc cho mỗi phụ huynh, mỗi buổi.
- Tin 24 giờ luôn ghi **hạn báo nghỉ** (giờ học trừ 2 giờ). Như vậy phụ huynh biết
  báo trước giờ đó thì con được giữ buổi bù (TT-202).

Mẫu tin gửi phụ huynh:

```
KiN nhắc lịch: con Minh Anh có buổi Toán 9 lúc 20:00 tối mai, thứ Năm 01/10, với Thầy/Cô Thanh.
Link vào lớp: <link Meet>
Con cần nghỉ thì anh/chị báo ở sổ học trước 18:00 để con được giữ buổi bù.
```

```
Còn 1 giờ nữa là buổi Toán 9 của Minh Anh (20:00).
Link vào lớp: <link Meet>
```

**Kênh gửi: vướng ở TT-199.** Gửi Zalo tự động cần Zalo OA đã xác thực doanh nghiệp hoặc
hộ kinh doanh. Chi phí ước tính cho 25 học sinh, 8 buổi/tháng:

- 400 tin cho phụ huynh ≈ 120.000đ/tháng (giá tin theo số điện thoại khoảng 300đ/tin,
  bảng giá 16/03/2026).
- Gửi cả học sinh thì gấp đôi.
- Phí OA 1.000.000đ/năm.

**Trong lúc chưa có OA, dùng cách bán tự động (miễn phí):**

1. Đến giờ nhắc, KiN đưa tin soạn sẵn lên chính buổi đó trong Lịch, và vào Hộp việc
   nếu Hộp việc đang bật.
2. Gia sư bấm một lần, KiN mở Zalo trên máy gia sư với nội dung đã điền sẵn.

Không dùng bot trên tài khoản Zalo cá nhân, vì dễ bị khoá.

## TT-203 · Chế độ gọn: chỉ Lịch và Học phí

- Gia sư mới vào lần đầu **chỉ thấy hai module: Lịch và Học phí**.
- Các module khác (Hộp việc, Lớp, Bài kiểm tra, Thư viện) tắt sẵn. Bật ở *Cài đặt →
  Module hiển thị*, hoặc nút "+ Thêm" dưới thanh bên.
- Lịch và Học phí luôn bật, không tắt được.
- **Tắt module chỉ là ẩn khỏi thanh bên.** Dữ liệu giữ nguyên, bật lại thấy đủ.
- Khi Hộp việc đang tắt, việc cần xử lý (phụ huynh báo sai, báo nghỉ sát giờ, tin nhắc
  chờ gửi) **hiện thành chấm trên đúng buổi trong Lịch**. Không có việc nào bị mất vì
  một module đang tắt.
- Lưu lựa chọn theo tài khoản, không theo máy.

---

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| NGƯỠNG_SÁT_GIỜ | 2 giờ trước giờ học | **đã chốt 30/09** |
| HẠN_BUỔI_BÙ | 30 ngày | **đã chốt 30/09** |
| BÁO_TRƯỚC_HẾT_HẠN_BÙ | 3 ngày | đề xuất |
| NHẮC_LẦN_1 | 24 giờ trước | theo backlog TT-201 |
| NHẮC_LẦN_2 | 1 giờ trước | theo backlog TT-201 |
| GIỜ_YÊN_LẶNG | 22:00–07:00 | **đã chốt 30/09** |
| DỜI_TIN_24_GIỜ_VỀ | 21:30 | đề xuất |
| BỎ_TIN_1_GIỜ_NẾU_BUỔI_TRƯỚC | 08:00 | đề xuất |
