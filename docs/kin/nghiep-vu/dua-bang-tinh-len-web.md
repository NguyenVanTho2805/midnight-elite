# Đưa bảng tính lớp đang chạy lên web: quy tắc cho AS-191 đến AS-198

Soạn 30/09/2026 cho anh Thọ. Lớp của anh Thanh đang chạy bằng Google Sheets và Apps Script
(4 môn Toán, Sử, Địa, Anh; học qua Meet lúc 22:15; học phí theo tháng). Tài liệu này ghi
các quy tắc đó thành đặc tả, để web KiN tính ra **đúng con số bảng tính đang tính**.

Nguồn: mô tả trong backlog (AS-191 đến AS-198) và báo cáo *Học gì từ Khan* (27/09). Em chưa
mở được mã Apps Script, nên chỗ nào ghi **"cần đối chiếu"** thì anh Thọ so với mã trước khi dựng.

---

## 0. Điểm mấu chốt: KiN phải có hai chế độ tính học phí

Web KiN hiện tính **theo buổi đã dạy**: mỗi lần điểm danh, học phí được chốt vào buổi đó
(xem báo cáo kiểm thử 24/09). Lớp của anh Thanh tính **theo lịch cả tháng**: mọi buổi trong
lịch đều thu, **vắng không trừ tiền**, chỉ trừ buổi miễn.

Hai cách này cho ra hai con số khác nhau với cùng một tháng. Vì vậy KiN cần một cài đặt ở
cấp lớp, không phải sửa công thức chung:

| Chế độ | Thu cho buổi nào | Học sinh vắng | Dùng cho |
|---|---|---|---|
| **Theo buổi** (mặc định) | buổi đã điểm danh | báo nghỉ trước 2 giờ: không thu, giữ 1 buổi bù (TT-202) | gia sư mới trên KiN |
| **Theo lịch tháng** | mọi buổi trong lịch của môn, trừ buổi miễn | **không trừ tiền**, chỉ được học bù | lớp của anh Thanh |

Thiết kế Figma: trang *📚 Lớp & Thư viện*, khung *Lớp — Quy tắc tính tiền và điểm danh*
(node `198:74`). Đổi chế độ chỉ áp từ tháng sau; phiếu các tháng trước giữ nguyên.

---

## AS-193 · Đơn giá bậc thang theo số môn

| Số môn em đăng ký | Đơn giá mỗi buổi |
|---:|---:|
| 1 | 70.000đ |
| 2 | 60.000đ |
| 3 | 55.000đ |
| 4 | 50.000đ |

- Đơn giá áp cho **mọi môn** em đó học, không phải chỉ môn thứ hai trở đi.
- Gia sư vẫn đặt được giá riêng cho từng em (hai anh em, học sinh cũ). Giá riêng thắng bậc
  thang. Khung Figma *Lớp — HSA 2K9* (`34:2`) đã có cột này.
- Đổi bảng giá chỉ áp cho buổi từ ngày đổi trở đi, không áp ngược (đã sửa ở web ngày 24/09).

## AS-192 · Học phí tháng

Chế độ **Theo lịch tháng**:

```
Học phí gốc = Σ theo từng môn [ (số buổi của môn trong tháng − số buổi miễn) × đơn giá ]
Phải đóng   = max(0, Học phí gốc − Học bổng − Giảm trừ)
```

- "Số buổi của môn" = số buổi **theo lịch** của môn đó trong tháng, không phải số buổi em có mặt.
- **Buổi miễn** = buổi gia sư nghỉ, ngày lễ, buổi gia sư tự cho miễn. Buổi miễn là thuộc
  tính của **buổi**, áp cho cả lớp. Nếu miễn cho riêng một em thì dùng Giảm trừ.
- **Học sinh vắng không trừ tiền.** Em báo nghỉ trước 2 giờ thì được giữ 1 buổi bù (hạn 30
  ngày), học phí không đổi.
- Học bổng và Giảm trừ là **số tiền gia sư nhập tay** cho từng em, từng tháng (xem AS-196).
- Sàn 0: không bao giờ ra số âm, không chuyển phần âm sang tháng sau.

**Ví dụ** (dữ liệu mẫu). Em học 3 môn nên đơn giá 55.000đ. Tháng 10 theo lịch: Toán 9 buổi
(1 buổi lễ được miễn), Sử 4 buổi, Địa 4 buổi. Em vắng 2 buổi Sử. Gia sư giảm 50.000đ.

| Môn | Buổi theo lịch | Buổi miễn | Buổi tính | Thành tiền |
|---|---:|---:|---:|---:|
| Toán | 9 | 1 | 8 | 440.000đ |
| Sử | 4 | 0 | 4 | 220.000đ |
| Địa | 4 | 0 | 4 | 220.000đ |
| **Gốc** | | | **16** | **880.000đ** |

Phải đóng = 880.000 − 0 (học bổng) − 50.000 (giảm trừ) = **830.000đ**. Hai buổi Sử em vắng
vẫn tính tiền.

**Cần anh Thanh chốt:**

1. Em vào lớp giữa tháng: tính từ buổi đầu tiên em học (đề xuất), hay cả tháng?
2. Em thêm hoặc bỏ một môn giữa tháng: đơn giá theo số môn **ngày 1 của tháng**, hay số môn
   nhiều nhất trong tháng? Đề xuất: ngày 1, tháng sau mới đổi bậc.
3. Có làm tròn học phí không (ví dụ tròn nghìn)? Đề xuất: không làm tròn.

## AS-191 · Điểm danh theo buổi và hệ số chuyên cần

Bảng tính đang dùng ba trạng thái. Web KiN hiện có thêm "Muộn" (NV-186). Gộp lại thành bốn
trạng thái, **hệ số đặt theo lớp**:

| Trạng thái | Lớp anh Thanh (theo bảng tính) | Mặc định cho gia sư mới (đề xuất) |
|---|---:|---:|
| Có mặt | 1 | 1 |
| Muộn | chưa dùng (bật thì 0,5) | 0,5 |
| Nghỉ có phép (báo trước) | 0,8 | 0,8 |
| Vắng không báo | 0,5 | 0 |

```
Chuyên cần = Σ hệ số của các buổi em có trong lịch / số buổi đó
```

- Buổi miễn và buổi gia sư huỷ **không** nằm trong mẫu số.
- Hệ số chỉ dùng cho **điểm chuyên cần** (xếp hạng, thanh Nỗ lực ở NV-186). Hệ số **không
  ảnh hưởng tiền**; tiền theo AS-192.
- Cần đối chiếu: vắng không báo đang được 0,5 điểm trong bảng tính. Nếu đó là nhầm với "Muộn"
  thì sửa lại trước khi đưa lên web, vì hai nơi phải ra cùng một số.

## AS-194 · Cấu hình lớp

Bốn môn Toán, Sử, Địa, Anh; mỗi môn một lịch riêng; buổi học trên Meet lúc 22:15.
Đây là dữ liệu, nhập một lần khi tạo lớp trên web.

**Chỗ va chạm với quy tắc 30/09:** buổi 22:15 nằm trong giờ yên lặng 22:00–07:00.

- Nhắc 24 giờ rơi vào 22:15 tối hôm trước → dời về 21:30 (đúng TT-201, không cần sửa).
- Nhắc 1 giờ lúc 21:15 → gửi bình thường.
- **Giờ nghỉ của học sinh (C4) không được chặn tin của chính buổi học đang diễn ra.** Thêm quy
  tắc: tin về buổi học bắt đầu trong vòng 30 phút tới hoặc đang diễn ra thì vẫn báo. Tin cộng
  đồng và tin nhắn riêng vẫn bị giữ trong giờ nghỉ.

## AS-195 · Xếp hạng trong môn có luật phá hoà

Xếp theo thứ tự, dừng ở tiêu chí đầu tiên khác nhau:

1. Điểm trung bình môn, cao hơn đứng trước.
2. Tỉ lệ bài về nhà nộp đúng hạn, cao hơn đứng trước.
3. Tên, theo thứ tự chữ cái tiếng Việt.

Apps Script đã sửa theo luật này; web phải làm y hệt để hai nơi không ra hai kết quả.
Bảng xếp hạng chỉ dùng để **vinh danh** trong lớp, không in lên phiếu phụ huynh (NV-186).

Gợi ý cho anh Thanh (không chặn việc dựng): tiêu chí 3 làm em tên "An" luôn thắng em tên
"Vy" khi hoà. Có thể hiện "đồng hạng" thay vì phân bằng tên.

## AS-196 · Học bổng chỉ xét khi đã có điểm

Lỗi đã gặp: môn Sử 7 em cùng 4,6 điểm, cả 7 em đều được báo TOP 1, miễn 100% học phí.

Theo quyết định 30/09 (NV-184), **KiN không tự tính học bổng**. Khi đưa lên web:

- KiN hiện bảng xếp hạng làm gợi ý. Gia sư **nhập tay số tiền học bổng** vào phiếu từng em.
- Bảng xếp hạng một môn chỉ hiện khi **mọi em trong môn đã có ít nhất một điểm** trong kỳ.
  Chưa đủ thì hiện "Chưa đủ điểm để xếp hạng" và tên các em còn thiếu.
- Không bao giờ tự điền học bổng từ thứ hạng. Lỗi 7 em TOP 1 là lỗi tiền, không phải lỗi hiển thị.

## AS-197 · Soạn tin nhắn phụ huynh từ dữ liệu có sẵn

Dùng lại mẫu tin đã chốt, không soạn mẫu mới:

| Tin | Dữ liệu lấy từ | Đặc tả |
|---|---|---|
| Nhắc lịch 24 giờ và 1 giờ | lịch, hạn báo nghỉ | `lich-nhac-va-che-do-gon.md` (TT-201) |
| Báo cáo buổi | điểm danh, nhận xét, bài về nhà | `pheu-gia-su.md` (B1) |
| Phiếu học phí tháng | AS-192, mã VietQR | phiếu học phí trên web |
| Báo nghỉ sát giờ | TT-202 | `lich-nhac-va-che-do-gon.md` |

Gia sư luôn xem và sửa tin trước khi gửi. Chưa có Zalo OA thì KiN mở Zalo với tin điền sẵn.

## AS-198 · Mật khẩu học sinh trong bảng tính

Ba tab AZOTA đang lưu mật khẩu học sinh dạng chữ thường.

- **Không đưa cột mật khẩu lên web**, kể cả đã băm. KiN có đăng nhập riêng; mật khẩu AZOTA là
  của AZOTA.
- Công cụ nhập dữ liệu phải tự bỏ mọi cột có tên chứa "mật khẩu", "mat khau", "password",
  "pass", và báo cho gia sư biết đã bỏ cột nào.
- Việc xoá cột mật khẩu trong bảng tính đang chạy là việc của anh Thanh. Em không đụng vào dữ
  liệu thật. Đề xuất: chuyển mật khẩu sang trình quản lý mật khẩu, rồi xoá khỏi bảng tính.

---

## Bảng đối chiếu bảng tính → web

| Trong bảng tính | Trên web KiN |
|---|---|
| Tab điểm danh theo môn | Điểm danh theo buổi, 4 trạng thái |
| Công thức học phí tháng | Chế độ "Theo lịch tháng" ở cài đặt lớp |
| Bảng đơn giá theo số môn | Bảng giá bậc thang của lớp + giá riêng từng em |
| Cột học bổng TOP 1/2/3 | Ô "Học bổng" nhập tay trên phiếu, bảng xếp hạng làm gợi ý |
| Cột giảm trừ | Ô "Giảm trừ" nhập tay trên phiếu |
| Buổi miễn | Thuộc tính của buổi: "Miễn cho cả lớp" |
| Tin nhắn soạn tay | Mẫu tin TT-201, B1, phiếu học phí |
| Tab AZOTA | Không nhập |

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| CHẾ_ĐỘ_HỌC_PHÍ (lớp anh Thanh) | Theo lịch tháng | theo bảng tính |
| CHẾ_ĐỘ_HỌC_PHÍ (mặc định) | Theo buổi | theo web hiện tại |
| ĐƠN_GIÁ_1..4_MÔN | 70.000 / 60.000 / 55.000 / 50.000đ | theo bảng tính |
| HỆ_SỐ_CÓ_MẶT / MUỘN / PHÉP / VẮNG (lớp anh Thanh) | 1 / – / 0,8 / 0,5 | theo bảng tính, cần đối chiếu |
| HỆ_SỐ mặc định | 1 / 0,5 / 0,8 / 0 | đề xuất |
| BẬC_ĐƠN_GIÁ_KHI_ĐỔI_MÔN | theo ngày 1 của tháng | đề xuất |
| TIN_BUỔI_HỌC_VƯỢT_GIỜ_NGHỈ | 30 phút trước giờ học | đề xuất |
