# Lịch lớp và vào học một chạm

Bản 26/10/2026. Nguồn: cách lớp mẫu của anh Thanh chạy trên bảng tính (tab Dashboard, Lịch Meet, mã v7), chẩn đoán lịch Meet ngày 26/10 (`kin-apps-script/chan-doan-lich-meet-26-10.md`), quyết định 02/10 "bảng tính chỉ để tham khảo, vận hành chuyển hẳn lên web". Liên quan: `lich-nhac-va-che-do-gon.md` (nhắc 24 giờ, 1 giờ; báo nghỉ), `diem-danh-bai-kiem-tra-va-diem.md` (điểm danh tự gợi ý từ lượt bấm vào lớp).

Ý của anh Thanh: làm theo kiểu sổ gia sư. Gia sư tạo lớp và chốt lịch **một lần**. Sau đó, đến giờ, gia sư và học sinh chỉ bấm một nút là vào học, không phải tìm link trong Zalo, email hay Google Calendar.

---

## 0. Nguyên tắc

1. **Lịch trên KiN là gốc.** Google Calendar chỉ là bản sao cho tiện. Lịch Google bị sửa hay xoá ở ngoài thì KiN báo, không tự tạo phòng mới.
2. **Mỗi lớp một phòng Meet cố định.** Đổi giờ, đổi ngày, thêm học sinh đều giữ nguyên link. Học sinh không bao giờ phải nhận link mới vì gia sư sửa lịch.
3. **Học sinh vào lớp từ KiN.** Nút "Vào lớp" trỏ tới link riêng của lớp trên KiN, KiN chuyển tiếp sang Meet. Link Meet có đổi thì nút vẫn đúng.
4. **Một lượt bấm là một dữ kiện.** KiN ghi ai bấm vào lớp lúc mấy giờ, dùng để gợi ý điểm danh. Gợi ý không phải điểm danh chính thức.

---

## 1. Tạo lớp và chốt lịch

### Gia sư nhập

| Trường | Ví dụ (lớp mẫu) | Ghi chú |
|---|---|---|
| Tên lớp | Môn Toán | tiêu đề hiện khi học sinh vào Meet là "<Tên hiển thị của gia sư> · <Tên lớp>" |
| Ngày học trong tuần | T3, T7 | chọn nhiều |
| Giờ bắt đầu | 22:15 | một giờ cho cả lớp; buổi nào lệch thì sửa riêng buổi đó |
| Thời lượng | 90 phút | |
| Ngày bắt đầu | 03/10/2026 | |
| Ngày kết thúc | để trống = lặp mãi | có ngày thi thì điền ngày thi |
| Phòng học | tự tạo Meet / dán link có sẵn / Zoom | xem mục 2 |

### Chốt lịch

- Lúc mới tạo, lịch ở trạng thái **Nháp**. Gia sư sửa thoải mái, KiN không gửi gì cho ai.
- Bấm **"Chốt lịch"** thì KiN sinh trước các buổi của 8 tuần tới, gửi link "Sổ học" cho học sinh và phụ huynh (`gui-qua-zalo.md`), và nếu có nối Google thì tạo **một** sự kiện lặp.
- Sau khi chốt, mỗi lần sửa gia sư chọn một trong hai:
  - **Chỉ buổi này** (dời một buổi, nghỉ một buổi): buổi đó đổi, các buổi khác giữ nguyên.
  - **Từ buổi này về sau** (đổi lịch cố định): các buổi từ đó trở đi đổi, các buổi đã qua giữ nguyên để không làm sai điểm danh và học phí.
- Mỗi lần sửa sau khi chốt, KiN hỏi "Báo cho học sinh và phụ huynh?" và mặc định là Có. Đổi tên lớp hay sửa ghi chú thì không báo.
- Mỗi đêm KiN sinh thêm buổi cho đủ 8 tuần tới. Buổi tương lai chưa diễn ra thì sửa được; buổi đã qua thì chỉ sửa điểm danh.

### Buổi học là một bản ghi

Buổi học không còn là "một ô ngày trong bảng" như ở tab Điểm Danh nữa, mà là một bản ghi có trạng thái:

```
Sắp tới → Đang diễn ra (từ 15 phút trước giờ học tới hết giờ) → Đã qua
   ↘ Lớp nghỉ (gia sư báo; không tính tiền, không tính chuyên cần)
   ↘ Đã dời (trỏ tới buổi thay thế)
```

Trên bảng tính, nghỉ lễ được làm bằng cách xoá ô ngày, nên số buổi ở Dashboard và tab Điểm Danh có thể lệch nhau. Trên web, số buổi tính tiền **đếm từ các bản ghi buổi**, chỉ một nguồn.

---

## 2. Phòng học

| Cách | Gia sư làm | KiN làm | Dùng khi |
|---|---|---|---|
| **A. Dán link có sẵn** | dán một link Meet hoặc Zoom dùng lâu dài | lưu link, dùng cho mọi buổi | gia sư mới, chưa muốn nối Google. **Mặc định.** |
| **B. Nối Google Calendar** | bấm "Nối Google", đồng ý quyền sửa sự kiện lịch | tạo một sự kiện lặp có Meet trên lịch chính của gia sư, mời học sinh có Gmail | gia sư muốn học sinh thấy lịch trong Google Calendar và vào Meet không phải chờ duyệt |

Với cách A, KiN không cần quyền gì trên tài khoản Google của gia sư.

### Cách B: luật đồng bộ (rút từ sự cố 26/10)

Bảng tính đã gặp đúng các lỗi sau. KiN phải chặn từ đầu.

| # | Lỗi đã gặp trên bảng tính | Luật của KiN |
|---|---|---|
| 1 | Ba thế hệ sự kiện cho cùng một lớp, ô nào cũng hiện | **Một lớp đúng một sự kiện lặp.** Lưu mã sự kiện, gắn nhãn ẩn `kinLop=<mã lớp>`. Tìm theo nhãn, không tìm theo tiêu đề |
| 2 | Lịch bị cắt "đến hết 24/10" ở ngoài, mã vẫn báo "sẵn sàng" | Sau mỗi lần ghi, và mỗi sáng, KiN **đọc lại** sự kiện: còn tồn tại không, còn lặp mãi không, giờ có khớp không. Lệch thì báo gia sư (mục 4) |
| 3 | Mã không thấy lịch cũ nên tạo phòng mới, đổi link | **Không bao giờ tự tạo phòng mới khi đã có phòng.** Sự kiện bị xoá hẳn thì hỏi gia sư; gia sư bấm "Tạo lại" thì mới tạo |
| 4 | Đổi tên cũng gửi email cho cả lớp | Chỉ gửi thông báo của Google khi đổi giờ, đổi ngày, thêm hoặc bớt học sinh |
| 5 | Lịch phụ "Teaching online" của gia sư bị mời làm khách, sinh bản sao | Khách mời **chỉ là Gmail học sinh** trong lớp. Không mời lịch nào khác của gia sư |
| 6 | Xoá từ app Lịch trên Mac không huỷ lịch của khách, để lại bản mồ côi | Gia sư xoá lớp trên KiN thì KiN **huỷ sự kiện và báo khách** qua Google. Trang trợ giúp nói rõ: muốn bỏ lịch thì làm trên KiN, đừng xoá từ app lịch |

Quyền xin Google: chỉ `calendar.events`, không xin quyền đọc toàn bộ lịch. KiN chỉ đọc và sửa sự kiện do chính KiN tạo.

Học sinh **không có Gmail** vẫn vào được bằng nút "Vào lớp" trên KiN. Các em chỉ có thể phải chờ gia sư duyệt trong Meet, như bảng tính đã cảnh báo.

---

## 3. Vào học một chạm

### Học sinh và phụ huynh

Trang "Sổ học" của học sinh (link riêng, không cần tài khoản, `GD-28`) luôn có ở trên cùng:

```
┌──────────────────────────────────────────────┐
│ Toán · Thứ Ba 27/10 · 22:15–23:45            │
│ [ Vào lớp ]   còn 12 phút                    │
│ Buổi sau: Thứ Bảy 31/10 · Sử: Chủ nhật 01/11 │
└──────────────────────────────────────────────┘
```

- Nút **"Vào lớp"** sáng từ 15 phút trước giờ học tới hết giờ. Ngoài khoảng đó, nút ghi "Buổi sau: …" và không bấm được.
- Học nhiều môn thì hiện **môn sắp tới gần nhất**; các môn khác nằm ở dòng dưới.
- Bấm thì KiN ghi lượt vào lớp (học sinh, buổi, giờ bấm), rồi mở Meet. Trên điện thoại thì mở app Meet.
- Trên link phụ huynh, nút ghi "Mở lớp cho con" và cũng được ghi lượt.

### Gia sư

- Hộp việc / Hôm nay: buổi sắp tới có nút **"Vào lớp"** (cùng link), kèm số học sinh đã bấm vào: "9/14 em đã vào".
- Hết giờ học, KiN đưa việc **"Điểm danh buổi Toán 27/10"** lên đầu Hộp việc, kèm gợi ý từ lượt bấm (xem `diem-danh-bai-kiem-tra-va-diem.md` mục 1).

### Không làm

- Không tự đánh "Có mặt" chỉ vì có lượt bấm. Bấm vào lớp chưa chắc đã ngồi học.
- Không bắt học sinh tạo tài khoản để vào lớp.

---

## 4. Khi lịch Google lệch với KiN

| KiN thấy | KiN báo gia sư | Nút |
|---|---|---|
| Sự kiện bị cắt ngày kết thúc | "Lịch Google của lớp Toán dừng từ 24/10 nhưng lớp trên KiN vẫn học. Học sinh sẽ không thấy buổi trên Google Calendar." | **Nối lại** (giữ link cũ) · Bỏ qua |
| Sự kiện bị xoá | "Lịch Google của lớp Toán đã bị xoá ngoài KiN." | **Tạo lại** (link mới, KiN hỏi lần nữa) · Tắt đồng bộ Google |
| Giờ hoặc ngày khác KiN | "Trên Google lớp Toán học 21:00, trên KiN là 22:15." | **Theo KiN** · Theo Google (đổi lịch KiN từ buổi tới) |
| Có hai sự kiện cùng nhãn lớp | "Có 2 lịch Google cho lớp Toán." | **Giữ cái có link Meet, huỷ cái kia** |

Các thông báo này nằm ở Hộp việc. Hộp việc đang tắt thì hiện thành chấm đỏ trên lớp đó trong Lịch (`TT-203`).

---

## 5. Chuyển lớp mẫu từ bảng tính sang (một lần)

Anh Thanh đã ngừng cập nhật bảng tính. KiN có nút **"Nhập từ bảng tính BCA"** để làm một lần, đọc 4 tab:

| Tab trong bảng tính | Lấy gì | Thành gì trên KiN |
|---|---|---|
| Dashboard (cột Thứ, Số buổi) | thứ học từng môn | lịch lặp từng lớp; giờ lấy 22:15 (`GIO_MEET`) |
| Lịch Meet | link Meet từng môn | phòng học cách A (dán link), giữ đúng link học sinh đang dùng |
| Hồ Sơ Học Sinh | họ tên, Gmail, môn đăng ký, phụ huynh | học sinh + lớp đã đăng ký; môn "M" là miễn phí |
| 🗓️ Điểm Danh | ✓ / P / V theo ngày | điểm danh các buổi đã qua: ✓ → Có mặt, P → Có phép, V → Vắng, **ô trống → Chưa điểm danh** (`GD-06`) |

- Lịch thật hiện tại (đọc từ Dashboard ngày 26/10) **khác** với cấu hình cũ trong mã: Toán T3 và T7, Sử T4 và CN, Địa T6, Anh T2 và T5. Khi nhập, KiN lấy theo Dashboard.
- Nhập xong, KiN hiện bảng đối chiếu số học sinh mỗi lớp và số buổi đã qua để anh kiểm trước khi bấm "Chốt lịch". Lần chốt này **không gửi thông báo** cho học sinh, vì các em đã có link.
- Không nhập số điện thoại học sinh vào phần công khai. Số điện thoại phụ huynh chỉ dùng cho nút "Gửi qua Zalo".

---

## Màn hình

| Màn | Khung Figma |
|---|---|
| Hộp việc gia sư có nút Vào lớp, việc "Nối lại lịch Google" | `598:7909` (thêm 26/10) |
| Việc của tôi (học sinh), nút Vào lớp học | `299:114360` (có sẵn) |
| Lịch · Dời buổi và học bù ("chỉ buổi này / từ buổi này về sau") | `464:6223` (có sẵn) |
| Kết nối và lưu trữ (nối Google Calendar) | `464:7330` (có sẵn) |

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| MỞ_NÚT_VÀO_LỚP | 15 phút trước giờ học | đề xuất `GD-29` |
| SINH_BUỔI_TRƯỚC | 8 tuần | đề xuất |
| PHÒNG_HỌC_MẶC_ĐỊNH | dán link có sẵn (cách A) | đề xuất |
| QUYỀN_GOOGLE | `calendar.events` | đề xuất |
| KIỂM_LẠI_LỊCH_GOOGLE | sau mỗi lần ghi + 07:00 mỗi sáng | đề xuất |
| BÁO_KHI_SỬA_SAU_CHỐT | Có (đổi giờ, ngày, học sinh); Không (đổi tên, ghi chú) | đề xuất |
