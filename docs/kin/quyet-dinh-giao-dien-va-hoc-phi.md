# Quyết định giao diện và cách tính học phí

Cập nhật 27/09/2026. Chốt sau khi đọc sheet vận hành thật và `Mã.gs` (1.609 dòng)
của lớp BCA Midnight Class.

> **Sửa ngày 01/10/2026.** Mục 3 (học phí) đã được thay bằng
> `nghiep-vu/dua-bang-tinh-len-web.md`: tính theo số buổi, gia sư sửa được số buổi, không làm
> tròn, ba loại giảm. Mục 1 (cộng đồng): giao diện theo `nghiep-vu/pheu-gia-su.md` mục 4
> (30/09); vẫn là không gian riêng, nhưng phải đăng nhập mới xem (`GD-24` trong
> `quy-trinh/so-gia-dinh.md`).

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

## 3. Học phí tính theo số buổi (sửa 01/10)

Bản 27/09 ghi "tính theo tháng, số buổi nhập một lần cho cả lớp, trừ buổi miễn phí". Sau khi đọc
lại mã v7 và theo quyết định của anh Thanh ngày 01/10, quy tắc đúng là:

```
Tiền môn     = Σ đơn giá của từng buổi lớp môn đó đã học   (môn được miễn: 0đ)
Học phí gốc  = Σ Tiền môn
Phải đóng    = max(0, Học phí gốc − Học bổng % theo môn − Hỗ trợ ngoài − Nguồn khác)
               không làm tròn
```

- Đơn giá theo tổng số môn em đăng ký (70.000 / 60.000 / 55.000 / 50.000đ), chốt vào từng buổi.
- Em vắng **vẫn tính tiền** vì buổi nào cũng có bản ghi. Gia sư tắt được quy tắc này ở cài đặt
  lớp nếu đã thoả thuận khác với phụ huynh.
- Gia sư sửa được số buổi của từng em (vào lớp giữa tháng, thoả thuận riêng), bắt buộc ghi lý do.

Chi tiết và bảng tham số: `nghiep-vu/dua-bang-tinh-len-web.md`.

### Ví dụ (khớp Figma `24:2`)

Ninh Hoài Thu, 3 môn → 55.000đ/buổi, tháng 9/2026, lớp nghỉ lễ 2/9:

| Môn | Lịch | Buổi đã học | Thành tiền |
|---|---|---:|---:|
| Toán | Thứ 2, Thứ 5 · 22:15 | 8 | 440.000đ |
| Sử | Thứ 3 · 22:15 | 5 | 275.000đ |
| Anh | Thứ 4, Thứ 7 · 22:15 (nghỉ 2/9) | 8 | 440.000đ |
| | | **21 buổi** | **1.155.000đ** |

Nguồn khác 100.000đ → **cần đóng 1.055.000đ**. Em vắng 1 buổi Toán và 1 buổi Sử: số tiền không
đổi, chỉ trừ vào chuyên cần.

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
Câu này chỉ đúng khi lớp để "vắng vẫn tính tiền" (mặc định). Lớp đã tắt quy tắc đó thì sửa
điểm danh có thể đổi học phí, nên màn phải nói: *"Nếu gia sư sửa thành có mặt, phiếu học phí
sẽ được tính lại."*

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
