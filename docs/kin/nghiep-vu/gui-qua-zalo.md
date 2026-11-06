# Gửi phiếu học phí và báo điểm danh qua Zalo (TT-199)

Bản 02/10/2026. Nguồn: kiểm khả thi TT-199 ngày 30/09 (Zalo OA, tin mẫu ZBS, nhóm GMF), quyết định
của anh Thanh ngày 02/10 (giai đoạn đầu chưa thu phí). Thiết kế Figma: B1 `186:77` (gửi báo cáo buổi
vào Zalo), B4 `187:124` (kết nối Zalo), phiếu từng em `200:74` (nút "Gửi phiếu qua Zalo"), phiếu phụ
huynh `24:2`.

---

## 0. Quyết định

Làm **hai giai đoạn**. Giai đoạn 1 làm ngay, không cần tư cách pháp lý. Giai đoạn 2 chỉ làm khi KiN
có hộ kinh doanh hoặc doanh nghiệp để mở Zalo OA đã xác thực.

| | Giai đoạn 1 · ngay bây giờ | Giai đoạn 2 · khi có pháp nhân |
|---|---|---|
| Cách gửi | Gia sư bấm "Gửi qua Zalo", KiN mở Zalo trên máy gia sư với tin soạn sẵn, gia sư tự bấm gửi | KiN gửi tự động bằng Zalo OA |
| Cần gì | Không cần gì | OA đã xác thực (gói Tiêu chuẩn khoảng 1.000.000đ/năm) |
| Chi phí | 0đ | Tin mẫu ZBS khoảng 300đ/tin: 25 em × 8 tin = 60.000đ/tháng, cộng phí OA chia theo tháng ≈ 83.000đ, tổng ≈ 143.000đ/tháng |
| Gửi vào nhóm Zalo lớp có sẵn | Có, gia sư chọn nhóm khi chia sẻ | Không. API không đăng được vào nhóm cá nhân có sẵn; phải dùng nhóm do OA tạo (GMF) |
| Phụ huynh cần làm gì | Không cần tài khoản, bấm link mở phiếu | Phải quan tâm OA thì mới nhận tin chăm sóc |

KiN **không dùng bot trên tài khoản Zalo cá nhân** ở cả hai giai đoạn: trái điều khoản Zalo và có thể
khoá tài khoản của gia sư.

---

## 1. Giai đoạn 1: gửi bằng tay, một chạm

### Luồng

1. Gia sư bấm **"Gửi phiếu qua Zalo"** (khung `200:74`) hoặc **"Gửi báo cáo cho phụ huynh"** (`186:77`).
2. Điện thoại: KiN mở bảng chia sẻ của máy (Web Share API) với tin soạn sẵn và link. Gia sư chọn Zalo,
   chọn phụ huynh hoặc nhóm lớp, bấm gửi.
3. Máy tính: KiN chép tin vào bộ nhớ tạm và mở Zalo. Gia sư dán vào đúng cuộc trò chuyện.
4. KiN ghi "Đã mở Zalo lúc …" trên phiếu. KiN **không biết** tin đã gửi thật hay chưa, nên không ghi
   "đã gửi". Khi phụ huynh mở link, phiếu đổi sang "Phụ huynh đã xem".

### Tin soạn sẵn

| Loại | Tin |
|---|---|
| Phiếu học phí | Dạ em gửi anh/chị phiếu học phí tháng 10 của con [tên]: [số tiền]đ, hạn trước ngày 20. Anh/chị bấm vào đây để xem từng buổi và quét mã chuyển khoản: [link] |
| Điểm danh buổi | Buổi [môn] [ngày] của con [tên]: [Có mặt / Muộn / Có phép / Vắng]. Nếu con vắng, anh/chị xem lại bản ghi buổi học ở đây: [link] |
| Báo cáo buổi | như B1 `186:77` |

- Gia sư sửa được tin trước khi gửi. Xưng hô theo giọng KiN: phụ huynh nói "con", gia sư xưng theo
  cách gia sư chọn.
- Link phiếu và số tiền **chỉ gửi vào chat riêng** với phụ huynh. Khi chọn "Nhóm Zalo lớp", KiN chỉ soạn
  tin chung ("Phiếu học phí tháng 10 đã gửi riêng cho từng anh/chị, hạn trước ngày 20"), không kèm link,
  vì ai trong nhóm cũng mở được link.

### Link

- Link riêng từng phụ huynh, có mã khó đoán, hết hạn sau 60 ngày; mở không cần tài khoản (giống "Sổ học
  của con"). `GD-28`
- Thẻ xem trước của link (Open Graph) **không** hiện tên, điểm hay số tiền của con (B2 `186:112`).

---

## 2. Giai đoạn 2: Zalo OA (khi có pháp nhân)

Việc anh cần làm trước:

1. Đăng ký hộ kinh doanh hoặc doanh nghiệp cho KiN.
2. Mở Zalo OA, xác thực bằng giấy đăng ký đó.
3. Hỏi luật sư cùng lúc với PH-225: một OA của KiN gửi tin **thay cho nhiều gia sư** có được không, hay
   mỗi gia sư phải có OA riêng. Câu này quyết định cả cách tính phí sau này.

Khi có OA: tin phiếu học phí và nhắc lịch đi bằng tin mẫu ZBS tới số điện thoại phụ huynh; PDF chỉ gửi
được trong cửa sổ 7 ngày sau khi phụ huynh nhắn OA, hoặc trong nhóm GMF. Giai đoạn 1 vẫn giữ làm
đường dự phòng.

---

## 3. Không làm

- Bot hay công cụ tự động trên tài khoản Zalo cá nhân của gia sư.
- Gửi số tiền, điểm, tên đầy đủ của con vào nhóm lớp.
- Ghi "đã gửi" khi KiN không thể biết tin đã đi.

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| HẠN_LINK_PHỤ_HUYNH | 60 ngày | GD-28 |
| TIN_NHÓM_CÓ_SỐ_TIỀN | không | đề xuất |
| GIAI_ĐOẠN_HIỆN_TẠI | 1 (gửi bằng tay) | đề xuất, vì chưa có OA đã xác thực |
