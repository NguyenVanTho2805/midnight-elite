# Đưa bảng tính lớp đang chạy lên web: quy tắc cho AS-191 đến AS-198

Bản 01/10/2026, thay bản 30/09. Nguồn: mã **BCA Midnight Class v7** (Google Apps Script) anh
Thanh gửi ngày 01/10, và bốn câu trả lời của anh cùng ngày. Mọi quy tắc dưới đây đã đối chiếu
với mã; chỗ nào là giả định của em thì ghi mã `GD-xx` (xem `../quy-trinh/so-gia-dinh.md`).

Thiết kế Figma: trang *📚 Lớp & Thư viện*, khung *Lớp — Quy tắc tính tiền và điểm danh* (`199:74`) và khung *Phiếu học phí từng em* (`200:74`, ví dụ em vào môn Địa ngày 15/10, đơn giá đổi giữa tháng).

---

## 0. Bốn quyết định của anh Thanh (01/10)

1. Học sinh vào giữa tháng: **gia sư tự quyết**, bằng cách sửa số buổi tính tiền của em đó.
2. Tính tiền **theo số buổi**. Gia sư được chỉnh linh động, vì thoả thuận giữa gia sư, phụ huynh
   và học sinh được đặt lên trước.
3. **Không làm tròn** học phí.
4. **Thêm trạng thái Muộn** vào điểm danh.

Ngoài ra, giảm giá có **ba loại**: học bổng theo %, hỗ trợ từ bên ngoài, và nguồn khác.

---

## 1. Học phí (AS-192, AS-193)

### Công thức

```
Với mỗi môn m của em:
  Tiền môn m     = Σ đơn giá của từng buổi tính tiền của môn m      (0đ nếu môn m được miễn)
  Học bổng môn m = Tiền môn m × % học bổng môn m

Học phí gốc = Σ Tiền môn
Tổng giảm   = Σ Học bổng môn + Hỗ trợ ngoài + Nguồn khác
Phải đóng   = max(0, Học phí gốc − Tổng giảm)          ← không làm tròn
```

### Số buổi tính tiền

- Mặc định = số buổi **lớp môn đó đã học** trong tháng. Buổi lễ, buổi gia sư nghỉ không có
  trong lịch đã học nên tự không tính.
- **Học sinh vắng vẫn tính tiền** (như bảng tính đang làm). Em báo nghỉ trước 2 giờ thì được
  giữ 1 buổi bù, hạn 30 ngày (TT-202). Gia sư tắt được quy tắc này ở cài đặt lớp nếu thoả thuận
  với phụ huynh là vắng không tính tiền. Khi tắt: buổi Vắng và Nghỉ có phép không tính tiền;
  Muộn tính đủ; buổi Chưa điểm danh vẫn tính, và KiN nhắc gia sư điểm danh trước khi gửi phiếu.
  `GD-25`, anh chốt 02/10.
- **Gia sư sửa được số buổi của từng em, từng môn**, ví dụ em vào lớp ngày 15. Ô sửa bắt buộc
  ghi lý do; phiếu phụ huynh hiện dòng "Đã điều chỉnh: …".
- Trong bảng tính, số buổi đang **nhập tay một lần cho cả lớp** ở Dashboard (`bcaThietLapHocPhi`,
  ô "Số buổi tháng này"). Web lấy số đó từ lịch đã học, gia sư chỉ sửa khi cần.

### Đơn giá

| Số môn em đang đăng ký | Đơn giá mỗi buổi |
|---:|---:|
| 1 | 70.000đ |
| 2 | 60.000đ |
| 3 | 55.000đ |
| 4 | 50.000đ |

- Đơn giá **chốt vào từng buổi**, theo số môn em đang đăng ký đúng ngày buổi đó. Em thêm môn
  thứ tư ngày 15 thì các buổi từ ngày 15 tính 50.000đ, các buổi trước vẫn 55.000đ.
- Môn được miễn vẫn **được đếm** vào số môn, như mã đang làm (`s.soMon = mon.length`, tính cả
  môn đánh "M"). `GD-01`
- Giá riêng của từng em (cột "💵 Đơn giá riêng") thắng bảng bậc thang. Gia sư đặt giá riêng
  theo thoả thuận.

### Ba loại giảm giá

| Loại | Nhập | Áp vào | Ví dụ |
|---|---|---|---|
| **Học bổng** | % theo từng môn | tiền của môn đó | TOP 2 môn Toán: 90% tiền môn Toán |
| **Hỗ trợ ngoài** | số tiền hoặc %, kèm tên bên hỗ trợ | cả phiếu | quỹ khuyến học, trường tài trợ |
| **Nguồn khác** | số tiền hoặc %, kèm lý do | cả phiếu | anh em ruột, học sinh cũ |

- % của Hỗ trợ ngoài và Nguồn khác tính trên **học phí gốc**, không tính dây chuyền. `GD-02`
- Mỗi dòng giảm có ô lý do. Lý do in lên phiếu phụ huynh.
- Mã hiện tại có hai ô số tiền "🎓 Học bổng" và "🎁 Giảm trừ" cho cả phiếu. Web đổi thành ba
  loại trên; khi nhập dữ liệu cũ, "Học bổng" cũ vào **Nguồn khác** với lý do "Học bổng (số cũ)",
  vì không biết nó thuộc môn nào. `GD-03`

### Ví dụ (dữ liệu mẫu)

Em học 3 môn, đơn giá 55.000đ. Lịch tháng 10/2026 có Toán 9 buổi (thứ Hai, thứ Năm), Sử 4, Địa 5.
Gia sư nghỉ thứ Hai 26/10 và thứ Sáu 30/10, nên lớp đã học: Toán 8 buổi, Sử 4, Địa 4. Em vắng 2 buổi Sử.
Em đạt TOP 2 môn Toán (học bổng 90%). Gia sư giảm 50.000đ vì em là học sinh cũ.

| Dòng | Tính | Số tiền |
|---|---|---:|
| Toán | 8 × 55.000 | 440.000đ |
| Sử | 4 × 55.000 (2 buổi vắng vẫn tính) | 220.000đ |
| Địa | 4 × 55.000 | 220.000đ |
| **Học phí gốc** | | **880.000đ** |
| Học bổng Toán 90% | 440.000 × 90% | − 396.000đ |
| Nguồn khác (học sinh cũ) | | − 50.000đ |
| **Phải đóng** | 880.000 − 446.000 | **434.000đ** |

### Hạn đóng

Mã đang ghi hai hạn khác nhau: tin chào "kỳ đóng 15–20 hằng tháng", tin nhắc "trước ngày 20".
Em lấy **trước ngày 20** làm hạn duy nhất. `GD-04`

---

## 2. Điểm danh và chuyên cần (AS-191)

Mã: `BCA_CFG.DIEM_DANH = {comat:1, phep:0.8, vang:0.5}`, hàm `bca_dungDiemDanh`.

| Trạng thái | Ký hiệu trong bảng tính | Hệ số |
|---|---|---:|
| Có mặt | ✓ | 1 |
| **Muộn** (mới, theo anh Thanh 01/10) | chưa có | **0,9** `GD-05` |
| Nghỉ có phép | P | 0,8 |
| Vắng | V | 0,5 |
| **Chưa điểm danh** | để trống | **không tính** |

```
Chuyên cần = Σ hệ số các buổi đã điểm danh / số buổi đã điểm danh     (thang 0–1, ×10 khi hiện)
```

- **Sửa so với bảng tính:** mã đang coi ô trống là vắng 0,5, và tính cả buổi của hôm nay dù
  22:15 mới học. Gia sư quên tick thì học sinh bị trừ điểm. Web tách "Chưa điểm danh" khỏi
  "Vắng", và nhắc gia sư điểm danh buổi còn trống. `GD-06`
- Buổi lễ: bảng tính bỏ bằng cách xoá ô ngày; web dùng nút "Buổi này lớp nghỉ".
- Hệ số chỉ tính chuyên cần. Tiền theo mục 1, không phụ thuộc hệ số.
- Mặc định cho gia sư mới dùng đúng bảng hệ số này. `NV-186` (thanh Nỗ lực) đọc chuyên cần từ đây.

---

## 3. Xếp hạng, cảnh báo, học bổng (AS-195, AS-196)

### Điểm xếp hạng (mã: `bcaTaoSoDiem`, cột R)

```
Điểm xếp hạng = 0,5 × Điểm TB môn
              + 0,2 × (% BTVN đúng hạn / 10)
              + 0,2 × min(10, max(0, Điểm cuối kỳ − Điểm đầu kỳ) × 2)
              + 0,1 × Chuyên cần × 10
```

Tên trọng số trong mã dễ nhầm: `TRONG_SO.chuyenCan` (0,2) đang nhân với **% bài về nhà**, còn
`tinhThan` (0,1) mới là **điểm danh**. Web đặt tên theo đúng thứ được đo: Thành tích 50%, Bài
về nhà 20%, Tiến bộ 20%, Chuyên cần 10%.

### Thứ hạng trong môn

Xếp theo thứ tự, dừng ở tiêu chí đầu tiên khác nhau:

1. Điểm xếp hạng, cao hơn đứng trước.
2. Điểm TB môn.
3. % BTVN đúng hạn.
4. Tên.

Mã đang so tên theo **hai cách**: Sổ Điểm so chuỗi thô (`$B$2:$B<B`), Bảng Xếp Hạng so theo
tiếng Việt (`localeCompare(…,'vi')`). Khi ba tiêu chí đầu bằng nhau, hai tab có thể ra hai thứ
hạng khác nhau. Web dùng một cách: **đồng hạng**, hiện cùng thứ hạng và ghi "đồng hạng". `GD-07`

### Học bổng theo hạng (luật lớp anh Thanh)

| Hạng trong môn | Mã đang ghi | Trên web |
|---|---|---|
| TOP 1 | Miễn 100% học phí môn | gợi ý học bổng 100% môn đó |
| TOP 2 | Giảm 90% học phí môn | gợi ý học bổng 90% môn đó |
| TOP 3 | Vinh danh | không kèm tiền |

- Chỉ xét khi em đã có điểm TB > 0 (mã đã sửa, AS-196).
- KiN chỉ **gợi ý**; gia sư bấm "Áp dụng" thì % mới vào phiếu (quyết định NV-184: gia sư tự quyết).
- Đồng hạng TOP 1: gia sư chọn áp cho ai; KiN không tự chia.
- **Sửa so với bảng tính:** tin báo cáo gửi phụ huynh (cột W) đang tự viết "được MIỄN 100% học
  phí" dựa trên thứ hạng, trong khi phiếu học phí nhập học bổng bằng tay. Hai chỗ có thể nói
  khác nhau. Web: tin chỉ nhắc học bổng **đã áp vào phiếu**.

### Điều kiện E13: đang nợ học phí thì chưa xét học bổng

Mã kiểm "Còn lại" của **tháng đang tính** (`noHP`, tra tab Thu Học Phí). Trước ngày 20, gần như
em nào cũng còn "Còn lại" > 0 vì chưa đến hạn đóng, nên bị báo "đang nợ, tạm chưa xét học bổng".
Web kiểm **nợ của các tháng trước**. `GD-08`

### Năm mức cảnh báo (mã: cột Q)

| Mức | Điều kiện (chỉ cần một) |
|---|---|
| 🔴 4 · Nghiêm trọng | BTVN đúng hạn ≤ 70%; hoặc Điểm TB < 4; hoặc vắng mà không xem record |
| 🟠 3 · Cảnh báo, báo phụ huynh | thiếu ≥ 3 bài; hoặc Điểm TB < 5 |
| 🟡 2 · Nhắc nhở | thiếu 2 bài; hoặc nộp muộn ≥ 3 lần |
| 🔵 1 · Nhắc nhẹ | thiếu 1 bài |
| 🟢 Tốt | còn lại |

Mã coi ô % BTVN trống là 100%. Web giữ nguyên để hai nơi ra cùng mức, nhưng hiện "chưa nhập"
thay vì im lặng.

---

## 4. Lịch học (AS-194)

- Toán thứ 2 và 5, Sử thứ 3, Địa thứ 6, Anh thứ 4 và 7. Mọi lớp học trên Meet lúc **22:15**
  (`GIO_MEET`), 90 phút.
- Mã còn ghi giờ `'21:00'` cho từng môn nhưng Meet bỏ qua giờ đó. Web chỉ giữ một giờ học.
- Buổi 22:15 nằm trong giờ yên lặng 22:00–07:00: nhắc 24 giờ dời về 21:30 (TT-201), nhắc 1 giờ
  gửi 21:15. Tin của buổi học bắt đầu trong 30 phút tới vẫn báo cho học sinh.

## 5. Tin nhắn (AS-197)

Mã đang có: chào mừng học sinh và phụ huynh, nhắc đóng học phí (4 trường hợp), báo cáo môn,
follow-up học thử (hạn 7 ngày), 6 mẫu tình huống (rủ học thử, thêm môn, rút môn, tạm nghỉ…).
Web giữ các mẫu này, cộng nhắc lịch TT-201 và báo nghỉ TT-202. Gia sư luôn sửa được trước khi gửi.

## 6. Mật khẩu (AS-198)

- Mã v7 ghi cột "Mật khẩu" **trống** khi đồng bộ AZOTA (`bcaDongBoAzota`). Mật khẩu trong 3 tab
  đang có là do nhập tay hoặc do hàm cũ `dongBoAzota` (file cũ).
- Web không nhập cột mật khẩu. Công cụ nhập tự bỏ cột "mật khẩu / password" và báo lại.
- Việc của anh: xoá mật khẩu khỏi 3 tab và bỏ `'Mật khẩu'` khỏi danh sách `COLS` trong
  `bcaDongBoAzota`. Em không sửa bảng tính đang chạy.

---

## 7. Mười cải tiến cho bảng tính (không làm nữa)

**02/10, anh Thanh chốt: không cập nhật bảng tính nữa, chuyển hẳn sang web.** Bảng tính chỉ còn để **xem lớp
đã vận hành thế nào**, làm nền cho việc thiết kế web (đúng cách tài liệu này đã dùng nó). Bản vá v7.1 không dán.
Cả mười điểm dưới đây đã nằm trong quy tắc của web ở mục 1 đến mục 6, nên không mất gì. Nếu sau này có nhập dữ
liệu cũ lên web thì theo `GD-03` (số học bổng cũ vào Nguồn khác) và bỏ cột mật khẩu.

Ghi lại để tra cứu: em đã vá cả mười chỗ thành bản **v7.1** (AS-227 đến AS-236), kiểm cú pháp và chạy thử với bảng giả.
Anh dán vào Apps Script rồi chạy "Cập nhật TẤT CẢ"; số "Phải thu" phải giữ nguyên. File mã và hướng dẫn em gửi
riêng cho anh, không đưa lên kho này vì mã có số điện thoại và tên thật.

Khác với bảng ở dưới ở hai chỗ:
- **#3 số buổi:** bảng tính hạn đóng trước ngày 20 nên cần số buổi **theo lịch cả tháng**, không phải số buổi đã
  học tới hôm nay. Cột C ở Dashboard đếm các ô ngày ở tab Điểm Danh (xoá ô ngày = lớp nghỉ). Ô cột B để trống thì
  lấy cột C; gõ số thì dùng số gõ tay.
- **#8 mật khẩu:** giữ tiêu đề cột "Mật khẩu" cho đúng mẫu nhập AZOTA nhưng luôn để trống, mỗi lần đồng bộ tự
  xoá. `GD-27`. Ngày 02/10 em đã kiểm 5 tab AZOTA: cột này đang trống ở cả 52 dòng.

| # | Chỗ | Vấn đề | Sửa |
|---|---|---|---|
| 1 | `noHP` (E13) | xét nợ của tháng đang tính, chưa tới hạn đã bị coi là nợ | xét "Còn lại" tháng trước, hoặc chỉ xét sau ngày 20 |
| 2 | `bca_dungDiemDanh` | ô trống = vắng 0,5, buổi hôm nay tính cả trước giờ học | ô trống không tính; chỉ tính buổi đã qua 22:15 |
| 3 | Dashboard "Số buổi" và tab Điểm Danh | hai nguồn số buổi, có thể lệch nhau | lấy số buổi từ tab Điểm Danh, chỉ nhập tay khi sửa |
| 4 | Phá hoà theo tên | Sổ Điểm và Bảng Xếp Hạng so tên khác nhau | cùng một cách, hoặc đồng hạng |
| 5 | Tin báo cáo (cột W) | hứa miễn/giảm theo hạng, phiếu chưa chắc đã áp | đọc học bổng đã nhập ở Thu Học Phí |
| 6 | `TRONG_SO` | tên `chuyenCan` đo bài về nhà, `tinhThan` đo điểm danh | đổi tên cho khớp |
| 7 | Tin chào và tin nhắc | hạn đóng "15–20" và "trước 20" | một hạn: trước ngày 20 |
| 8 | `bcaDongBoAzota` | cột "Mật khẩu" vẫn còn trong mẫu | bỏ cột |
| 9 | Học bổng, Giảm trừ | một số tiền cho cả phiếu | học bổng theo % từng môn + 2 loại giảm |
| 10 | Điểm danh | chưa có Muộn | thêm "Mu", hệ số 0,9 |

---

## Bảng đối chiếu bảng tính → web

| Trong bảng tính (v7) | Trên web KiN |
|---|---|
| Sổ gốc "Hồ Sơ Học Sinh", cột môn "x" / "M" | Học sinh + môn đăng ký; "M" = môn miễn phí |
| Dashboard "Số buổi tháng này" | Số buổi lớp đã học, gia sư sửa từng em |
| Đơn giá bậc thang + Đơn giá riêng | Giữ nguyên, chốt theo từng buổi |
| 🎓 Học bổng, 🎁 Giảm trừ (số tiền) | Học bổng % theo môn, Hỗ trợ ngoài, Nguồn khác |
| Tab 🗓️ Điểm Danh (✓ / P / V) | 5 trạng thái, thêm Muộn và Chưa điểm danh |
| Sổ Điểm Theo Môn | Bảng điểm môn, cùng công thức xếp hạng và cảnh báo |
| Bảng Xếp Hạng & Học Bổng | Bảng vinh danh + gợi ý học bổng |
| Tin Nhắn, Mẫu Tin Nhắn | Mẫu tin, gia sư sửa trước khi gửi |
| Lịch Meet (22:15) | Lịch lớp + link Meet |
| Tab AZOTA | Không nhập mật khẩu |

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| VẮNG_VẪN_TÍNH_TIỀN | Bật | theo bảng tính, gia sư tắt được |
| ĐƠN_GIÁ_1..4_MÔN | 70.000 / 60.000 / 55.000 / 50.000đ | theo mã v7 |
| ĐƠN_GIÁ_CHỐT_THEO | từng buổi | anh chốt 01/10 |
| KÝ_HIỆU_MUỘN (bảng tính) | Mu | v7.1 |
| LÀM_TRÒN | không | anh chốt 01/10 |
| HỆ_SỐ có mặt / muộn / phép / vắng | 1 / 0,9 / 0,8 / 0,5 | theo mã v7; muộn là GD-05 |
| HỌC_BỔNG_TOP1 / TOP2 | 100% / 90% tiền môn | theo mã v7, KiN chỉ gợi ý |
| HẠN_ĐÓNG | trước ngày 20 | GD-04 |
| GIỜ_HỌC_MEET | 22:15, 90 phút | theo mã v7 |
| TIN_BUỔI_HỌC_VƯỢT_GIỜ_NGHỈ | 30 phút trước giờ học | GD-12 |
