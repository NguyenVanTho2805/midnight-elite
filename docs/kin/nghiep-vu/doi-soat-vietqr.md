# Đối soát chuyển khoản VietQR: tiền vào thì tự gạch phiếu (TT-200)

Bản 01/10/2026. Nguồn: kiểm khả thi TT-200 ngày 30/09, kiểm lại ngày 01/10 trên trang giá SePay,
tài liệu webhook SePay và tài liệu link nhanh VietQR. Học phí lấy theo
`dua-bang-tinh-len-web.md` (không làm tròn, hạn trước ngày 20). Giả định ghi mã `GD-xx`
(xem `../quy-trinh/so-gia-dinh.md`).

Thiết kế Figma: trang *💰 Học phí & VietQR*: phiếu có mã (`24:2`, bản điện thoại `108:114`),
hàng chờ đối soát của gia sư (`205:76`).

---

## 0. Nguyên tắc

1. **Tiền đi thẳng vào tài khoản của gia sư.** KiN không giữ tiền, không thu hộ, không cắt phần
   trăm.
2. KiN **chỉ đọc tiền vào**, qua dịch vụ trung gian mà **gia sư tự đăng ký** (SePay). KiN không
   nhận tên đăng nhập ngân hàng của ai.
3. **Chỉ tự gạch phiếu khi chắc chắn**: có mã phiếu và đúng số tiền còn lại. Mọi trường hợp khác
   vào hàng chờ, gia sư bấm quyết.
4. Không bao giờ tự ghép theo số tiền. `GD-20`

---

## 1. Mã phiếu và mã VietQR

### Mã phiếu

```
Mã phiếu = "KIN" + 5 ký tự
5 ký tự lấy từ: A–Z và 2–9, bỏ O, I, L (dễ nhầm với 0, 1)   → 31^5 ≈ 28,6 triệu mã
Ví dụ: KIN7B2K9
```

- Mỗi phiếu một mã, **không đổi** kể cả khi gia sư sửa số tiền. `GD-19`
- Mã là duy nhất trong phạm vi tài khoản nhận tiền của một gia sư; KiN vẫn sinh không trùng toàn
  hệ thống cho đơn giản.
- Không dùng dấu gạch, dấu chấm hay khoảng trắng bên trong mã.

### Nội dung chuyển khoản

```
Nội dung = Mã phiếu + " " + tên học sinh không dấu, viết hoa
Cắt tên cho vừa tối đa 50 ký tự (giới hạn addInfo của VietQR, không ký tự đặc biệt)
Ví dụ: KIN7B2K9 TRAN GIA BAO
```

Tên chỉ để gia sư dễ nhìn trên sao kê. Phụ huynh xoá tên cũng không sao; xoá mã thì giao dịch
vào hàng chờ.

### Mã QR

- Dùng link nhanh VietQR: `img.vietqr.io/image/<ngân hàng>-<số tài khoản>-<mẫu>.png` với
  `amount`, `addInfo`, `accountName`.
- `amount` = **phần còn lại phải đóng** của phiếu, đúng đến đồng, không làm tròn.
- Phiếu đã đóng một phần: QR mới mang số còn lại, cùng mã phiếu.
- Phiếu phụ huynh (`24:2`) in rõ: giữ nguyên mã ở đầu nội dung.

---

## 2. Nhận tiền vào

### Nối SePay (gia sư làm một lần)

1. Gia sư tự mở tài khoản SePay, tự liên kết ngân hàng của mình.
2. Trong KiN, gia sư mở *Cài đặt → Nhận tiền* và lấy **địa chỉ webhook riêng** của mình.
3. Gia sư dán địa chỉ đó vào SePay, lọc theo tiền tố mã thanh toán `KIN`, và đặt khoá API do KiN
   cấp để SePay gửi kèm.
4. KiN hiện "Đang nối SePay" khi nhận giao dịch đầu tiên.

Gói miễn phí của SePay: 50 giao dịch mỗi tháng, có webhook, nhận tài khoản cá nhân (kiểm lại
01/10/2026). Lớp 25 em, mỗi em 1–2 lần chuyển mỗi tháng thì vừa. KiN báo khi đã dùng 40/50.

### Xử lý mỗi webhook

SePay có thể gửi **một giao dịch nhiều lần**. Mỗi lần nhận:

1. Kiểm khoá API. Sai thì bỏ.
2. Chỉ nhận `transferType = "in"`.
3. Chống trùng: `id` của SePay là khoá duy nhất. Đã có thì trả thành công, không làm gì.
4. Lưu: `id`, `transactionDate`, `transferAmount`, `content`, `code`, `referenceCode`,
   `gateway`. **Không lưu `accumulated`** (số dư tài khoản của gia sư). `GD-22`
5. Tìm mã phiếu: lấy `code` của SePay; không có thì tìm trong `content` theo mẫu
   `KIN ?[A-HJKMNP-Z2-9]{5}` (chấp nhận một khoảng trắng sau KIN, không phân biệt hoa thường).
6. Phân loại theo bảng ở mục 3.
7. Trả `200` với `{"success": true}` trong 30 giây. Việc nặng (gửi tin, tính lại) làm sau.

---

## 3. Phân loại giao dịch

| Trường hợp | Điều kiện | KiN làm | Gia sư thấy |
|---|---|---|---|
| **Khớp đủ** | có mã, số tiền = phần còn lại | tự gạch phiếu "Đã đóng" | dòng xanh "Đã gạch phiếu" |
| **Đóng thiếu** | có mã, số tiền < phần còn lại | chưa gạch; giữ ở hàng chờ | "Ghi nhận một phần" · "Soạn tin nhắc phần còn lại" |
| **Đóng dư** | có mã, số tiền > phần còn lại | chưa gạch; giữ ở hàng chờ | "Trừ vào tháng sau" · "Ghi đã trả lại" `GD-21` |
| **Phiếu đã đóng** | có mã, phiếu đã "Đã đóng" | giữ ở hàng chờ, gắn "có thể chuyển trùng" | "Trừ vào tháng sau" · "Ghi đã trả lại" |
| **Mã không có** | mã không thuộc gia sư này | hàng chờ | "Ghép vào phiếu…" · "Không phải tiền học" |
| **Không có mã** | không tìm thấy mã | hàng chờ; gợi ý phiếu chưa đóng có **cùng số tiền** | "Ghép vào phiếu…" · "Không phải tiền học" |

- Gợi ý ở dòng cuối chỉ là gợi ý, **không tự ghép** kể cả khi chỉ có một phiếu trùng số tiền. `GD-20`
- "Không phải tiền học": giao dịch bị ẩn khỏi hàng chờ, không xoá.
- Ghép tay hoặc ghi nhận tay đều lưu ai bấm, lúc nào.
- Phiếu "Đã đóng" đổi màu trên trang phụ huynh ngay. KiN **không tự nhắn** phụ huynh; gia sư bấm
  gửi tin cảm ơn theo mẫu (TT-199 chưa có đường gửi Zalo tự động).

### Trạng thái phiếu

```
Nháp → Đã gửi → (Phụ huynh báo đã chuyển) → Đóng một phần → Đã đóng
                                                        ↘ Đóng dư (gia sư xử lý phần dư)
Bất kỳ lúc nào: Huỷ (phiếu sai, lưu lý do)
```

- Nút **"Tôi đã chuyển"** của phụ huynh chỉ đổi phiếu sang "Phụ huynh báo đã chuyển". Chưa phải
  đã nhận tiền. Quá 24 giờ chưa thấy tiền vào thì nhắc gia sư kiểm sao kê.
- **Tiền mặt** hoặc gia sư không nối SePay: gia sư bấm "Đã nhận tiền" và nhập số tiền, ngày.
  Cùng luật đủ / thiếu / dư như trên.
- Điều kiện E13 (xét học bổng) đọc trạng thái này: còn phiếu tháng trước chưa "Đã đóng" là còn nợ.
  `GD-08`

---

## 4. Ví dụ (dữ liệu mẫu, khớp Figma `205:76`)

| Lúc | Nội dung | Tiền vào | Phiếu | Kết quả |
|---|---|---:|---|---|
| 30/09 22:48 | KIN2WQ8R DO HA | 440.000đ | 440.000đ | Khớp đủ, tự gạch |
| 01/10 19:02 | KIN9PX3D PHAM MINH | 336.000đ | 336.000đ | Khớp đủ, tự gạch |
| 01/10 20:14 | KIN7B2K9 TRAN GIA BAO | 300.000đ | 336.000đ | Đóng thiếu 36.000đ |
| 02/10 07:40 | CK HOC PHI CHO CON | 434.000đ | — | Không có mã; gợi ý phiếu 434.000đ |
| 03/10 21:05 | KIN4HQ7M NGUYEN AN | 1.100.000đ | 1.055.000đ | Đóng dư 45.000đ |

Gia sư bấm "Ghi nhận một phần" ở dòng thứ ba: phiếu Trần Gia Bảo sang "Đóng một phần", còn
36.000đ, QR mới mang 36.000đ và cùng mã KIN7B2K9.

---

## 5. Cần anh chốt

1. **Pháp lý (hỏi luật sư):** KiN chỉ đọc biến động qua tài khoản SePay do gia sư tự mở, không
   giữ tiền. Cách này có bị coi là trung gian thanh toán theo NĐ 52/2024 không? Em thiết kế để
   KiN đứng ngoài dòng tiền, nhưng kết luận phải là của luật sư. **Chưa dựng trước khi có câu trả
   lời.**
2. Có cho phụ huynh thấy trạng thái "Đóng một phần" không, hay chỉ thấy "Còn lại X đồng"? Em đang
   để hiện "Còn lại".

## 6. Không dùng nữa

- Nội dung chuyển khoản dạng `KIN NINHHOAITHU 7B2 T9` và luật "tối đa 25 ký tự" trên phiếu
  cũ (`24:2`): thay bằng mã liền `KIN` + 5 ký tự ở đầu, tối đa 50 ký tự theo VietQR.

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| TIỀN_TỐ_MÃ | KIN | đề xuất |
| ĐỘ_DÀI_MÃ | 5 ký tự, bỏ O I L 0 1 | GD-19 |
| NỘI_DUNG_TỐI_ĐA | 50 ký tự | theo VietQR |
| TỰ_GHÉP_THEO_SỐ_TIỀN | tắt | GD-20 |
| BÁO_HẠN_MỨC_SEPAY | 40/50 giao dịch | đề xuất |
| NHẮC_KIỂM_SAO_KÊ | 24 giờ sau "Tôi đã chuyển" | GD-23 |
| LƯU_SỐ_DƯ | không | GD-22 |
