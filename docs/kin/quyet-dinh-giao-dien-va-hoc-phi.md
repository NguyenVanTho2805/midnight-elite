# Quyết định giao diện và cách tính học phí

Cập nhật 27/09/2026. Chốt sau khi đọc sheet vận hành thật và `Mã.gs` (1.609 dòng)
của lớp BCA Midnight Class.

Bản thiết kế: [KiN Design System trên Figma](https://www.figma.com/design/2orXvoHL2upkiGoMjlq8aX/KiN-Design-System)

---

## 1. Hai không gian tách rời

| | Cộng đồng | Ứng dụng |
|---|---|---|
| Ai vào được | Ai cũng vào, không cần đăng nhập | Phải đã vào một lớp |
| Ở đâu | `kin.vn/cong-dong` — **web riêng**, Google lập chỉ mục được | `app.kin.vn` |
| Để làm gì | Hỏi đáp mở · xem lớp đang mở · đăng ký học thử | Dạy và vận hành lớp |
| Thấy gì | Câu hỏi, câu trả lời, lịch lớp | Điểm danh, học phí, bản ghi, điểm |

**Không trộn hai cái vào một.** Lý do là phễu thật: hiện 36 học thử so với
23 chính thức. Người chưa vào lớp mà phải tải app mới hỏi được thì mất luôn.
Web mở thì mỗi câu trả lời thành một cửa vào từ Google.

Trong app chỉ còn một dòng **"Cộng đồng ↗"** ở đáy menu — bấm mở tab mới.

### Ranh giới phải nói thẳng trên trang cộng đồng

Người chưa vào lớp **không thấy**: số tiền, tên phụ huynh, điểm của bất kỳ ai.

---

## 2. Khung ứng dụng

Gộp ba kiểu bố cục, mỗi kiểu trả lời một câu hỏi khác nhau:

```
┌──────────┬──────────────────────────────────────┐
│  MENU    │  NỘI DUNG                            │
│  (cố     │                                      │
│  định)   │  • Hộp việc  → một cột, dòng việc    │
│          │  • Vào lớp   → hai cột kiểu Outlook  │
└──────────┴──────────────────────────────────────┘
```

**Menu trái** (226px, luôn hiện):
- HÔM NAY — Hộp việc · Lịch dạy
- LỚP CỦA TÔI — liệt kê thẳng từng môn kèm sĩ số
- VẬN HÀNH — Học phí · Bài kiểm tra · Thư viện
- đáy: Cộng đồng ↗

**Màn mặc định = Hộp việc.** Mở app ra thấy việc cần làm, không thấy menu.
Nhóm theo `NGAY BÂY GIỜ / TRONG HÔM NAY / ĐỂ SAU ĐƯỢC`, mỗi việc có nút làm ngay.

**Bấm một lớp** → phần phải tách đôi: danh sách buổi ở giữa, nội dung buổi bên phải.
Đúng kiểu Outlook. Đây là chỗ gia sư sống phần lớn thời gian.

---

## 3. Học phí tính THEO THÁNG

> Đây là thay đổi lớn nhất so với bản thiết kế trước. Bản cũ tính theo
> từng buổi có mặt. Sai với cách lớp đang vận hành thật.

### Công thức

```
Đơn giá/buổi  = theo TỔNG SỐ MÔN học sinh đăng ký
                1 môn 70.000đ · 2 môn 60.000đ · 3 môn 55.000đ · 4 môn 50.000đ
                (có thể ghi đè bằng đơn giá riêng cho từng em)

Học phí gốc   = Σ theo môn: (số buổi của MÔN trong tháng − buổi miễn phí)
                            × đơn giá/buổi

Phải đóng     = Học phí gốc − Học bổng − Giảm trừ      (không bao giờ âm)
```

**Số buổi là của MÔN, không phải của từng học sinh.** Nhập một lần cho cả lớp.

### Vắng KHÔNG trừ tiền

Vì buổi nào cũng có bản ghi để xem lại — em nghỉ vẫn học lại được phần đó.

Điểm danh **chỉ** dùng cho chuyên cần và xếp hạng, **không** dùng để tính tiền.

### Ví dụ thật

Ninh Hoài Thu, 3 môn → 55.000đ/buổi:

| Môn | Lịch | Buổi tháng 9 | Thành tiền |
|---|---|---|---|
| Toán | Thứ 3, Thứ 7 · 22:15 | 8 | 440.000đ |
| Sử | Thứ 4, CN · 22:15 | 6 | 330.000đ |
| Anh | Thứ 2, Thứ 5 · 22:15 | 8 | 440.000đ |
| | | **22 buổi** | **1.210.000đ** |

Giảm trừ 100.000đ → **cần đóng 1.110.000đ**.
Em vắng 1 buổi Toán và 1 buổi Sử — số tiền không đổi.

---

## 4. Phụ huynh: thấy, nhưng không dính tiền

Bản trước có cơ chế "phụ huynh xác nhận buổi trong 72 giờ, quá hạn tự chốt".
Cơ chế đó sinh ra để **bảo vệ tiền**. Tiền giờ không phụ thuộc điểm danh nữa,
nên nó **bị bỏ**.

Thay bằng **Sổ học của con** — phụ huynh mở link riêng, không cần tài khoản:
- Học phí tháng và hạn đóng
- Con đi học thế nào từng môn (ví dụ Toán 7/8, Sử 5/6, Anh 8/8)
- Mở lại bản ghi những buổi con vắng

**Không có nút xác nhận. Không có đếm ngược. Không treo tiền.**

Nếu phụ huynh thấy ghi nhầm → màn **Báo ghi nhầm điểm danh**, nói rõ ngay đầu màn:
*"Việc này chỉ sửa sổ điểm danh. Học phí tháng KHÔNG đổi."*

---

## 5. Phòng thi khoá cứng, không theo chủ đề

Người dùng chọn được 1 trong 5 chủ đề màu (Navy · Cổ vịt · Mận · Cà phê · Mực).
**Phòng thi không theo chủ đề** — luôn Navy. Bọc trong `[data-vung="phong-thi"]`.

Hai lý do:
1. Ô đáp án đang chọn mà tô xanh cổ vịt thì học sinh đọc nhầm là "đáp án đúng"
2. Học sinh đi thi không nên thấy màu ưa thích của thầy cô — phòng thi phải
   giống hệt nhau với mọi người

Token: `docs/kin/tokens/tokens.css`. Mở `docs/kin/tokens/demo.html` để bấm thử.

---

## 6. Ba màu không bao giờ đổi theo chủ đề

`--kin-tt-chu-xong` (xanh lá) · `--kin-tt-chu-cho` (vàng) · `--kin-tt-chu-loi` (đỏ)

Đây là **nghĩa**: có mặt, đã trả, đang chờ, vắng, lỗi. Không phải trang trí.
