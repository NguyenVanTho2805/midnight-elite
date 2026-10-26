# Điểm danh, bài kiểm tra và bảng điểm: tự nối với nhau

Bản 26/10/2026. Nguồn: mã v7 (`bca_dungDiemDanh`, `bcaTaoSoDiem`, `bcaTaoXepHang`, `bcaDongBoAzota`), dữ liệu thật trên bảng tính ngày 26/10, `dua-bang-tinh-len-web.md` mục 2 và 3 (hệ số, xếp hạng, cảnh báo), `hoc-tu-khan.md` (Nỗ lực, Năng lực). Công thức **không đổi**. Tài liệu này chỉ đổi **chỗ số liệu được lấy ra**: trước gia sư gõ tay, giờ KiN tự lấy từ điểm danh và bài làm.

---

## 0. Bảng tính đang vướng ở đâu (số liệu 26/10)

| Chỗ | Thực tế trên bảng tính | Hệ quả |
|---|---|---|
| Tab 🗓️ Điểm Danh tháng 10 | Chỉ một buổi được tick: Sử 04/10. Toán chưa tick buổi nào | ô trống bị tính là vắng 0,5, nên **mọi em đều có Tinh thần 5,0** |
| Sổ Điểm, cột Điểm TB môn | trống ở mọi dòng | không xếp hạng, không xét học bổng, tin báo cáo ghi "Chưa nhập điểm" |
| Điểm bài kiểm tra | nằm ở Azota, không về bảng tính | gia sư phải chép tay từng điểm |
| Buổi vắng, Vắng không xem record | gõ tay | trùng với tab Điểm Danh, dễ lệch |

Kết luận: luật trong mã đã đúng. Cái thiếu là **đường nối**. Mỗi chỗ gõ tay là một chỗ bị bỏ trống. Web bỏ hết các cột gõ tay có thể suy ra được.

---

## 1. Điểm danh

### Năm trạng thái (giữ nguyên, `GD-05`, `GD-06`)

Có mặt 1 · Muộn 0,9 · Có phép 0,8 · Vắng 0,5 · Chưa điểm danh (không tính).

### Gợi ý từ lượt bấm "Vào lớp"

Hết giờ học, KiN mở màn điểm danh buổi đó, **tick sẵn theo gợi ý**:

| Lượt bấm vào lớp của em | Gợi ý |
|---|---|
| bấm trước giờ học + 10 phút | Có mặt |
| bấm sau giờ học + 10 phút | Muộn |
| không bấm, phụ huynh đã báo nghỉ (`TT-202`) | Có phép |
| không bấm, không báo | **để trống**, gia sư chọn |

- Gia sư sửa từng em, hoặc bấm **"Xác nhận cả lớp"**. Chỉ khi gia sư xác nhận thì trạng thái mới tính vào chuyên cần và học phí.
- Màn điểm danh ghi rõ "gợi ý từ lượt vào lớp lúc 22:13", để gia sư biết vì sao KiN đoán như vậy.
- Học qua Meet bằng app điện thoại, hoặc vào bằng link cũ không qua KiN, thì không có lượt bấm. Vì vậy **không bao giờ gợi ý Vắng**.
- Qua 24 giờ mà buổi vẫn còn em "Chưa điểm danh" thì KiN nhắc trong Hộp việc. Không tự đổi thành Vắng.

Về sau: Google Meet có API trả danh sách người tham gia kèm giờ vào và giờ ra. Em **chưa kiểm** API này có dùng được với tài khoản Gmail cá nhân hay không. Khi kiểm xong mới thay lượt bấm bằng giờ vào thật.

### Từ điểm danh suy ra (trước đây gõ tay)

| Số liệu | Trước (Sổ Điểm) | Trên web |
|---|---|---|
| Chuyên cần (0–10) | cột L, lấy từ tab Điểm Danh × 10 | giữ nguyên công thức, chỉ tính buổi đã điểm danh |
| Buổi vắng | cột M, gõ tay | **đếm số buổi Vắng** trong kỳ |
| Vắng không xem record | cột N, gõ "x" | **tự đánh dấu** khi em Vắng mà 7 ngày sau chưa mở bản ghi của buổi đó trong Thư viện |

---

## 2. Bài kiểm tra và bài về nhà

### Ba loại bài

| Loại | Ví dụ | Có hạn nộp | Vào số liệu nào |
|---|---|---|---|
| **Kiểm tra** | bài 15 phút cuối buổi, bài Azota cuối tuần | có | Điểm TB môn, Năng lực |
| **Đầu kỳ / Cuối kỳ** | bài khảo sát tháng 9, bài thi thử | có | Điểm đầu kỳ / cuối kỳ → Tiến bộ; cũng tính vào Điểm TB |
| **Bài về nhà** | phiếu bài tập sau buổi | có | % BTVN đúng hạn, Số bài thiếu, Số lần nộp muộn |

Gia sư chọn loại khi giao bài. Bài có thể gắn với một buổi ("Bài trong buổi 27/10"), hoặc giao riêng.

### Điểm về từ đâu

1. **Phòng thi KiN** (`TK-174`): học sinh làm trên KiN, điểm tự vào.
2. **Nhập file Azota**: gia sư tải file kết quả Excel từ Azota rồi kéo vào KiN. KiN ghép theo thứ tự ưu tiên: (a) mã học sinh KiN trong cột Số báo danh, (b) họ tên trùng khớp **và** cùng lớp. Dòng không ghép được thì đưa vào hàng chờ "Chưa khớp", gia sư chọn tay. **Không ghép theo số điện thoại.**
3. **Gõ tay**: chấm bài giấy thì gõ điểm thẳng vào cột của bài đó.

Ở chỗ "Số báo danh", bảng tính dùng `000` + 5 số cuối điện thoại. Trên web thay bằng **mã học sinh KiN** (6 ký tự, không lộ số điện thoại). Gia sư dán mã này vào cột Số báo danh khi tạo lớp trên Azota.

### Vắng buổi có bài kiểm tra

- Em vắng thì bài đó ở trạng thái **"Chưa làm"**, mở cho làm bù trong 7 ngày.
- Quá 7 ngày, gia sư chọn: **Miễn** (mặc định, không tính vào điểm TB) hoặc **Tính 0**. `GD-30`
- "Chưa làm" không bao giờ tự thành 0 điểm. Cách này khớp với luật Năng lực: bài em vắng không làm thì bỏ qua (`hoc-tu-khan.md`, NV-185).

---

## 3. Bảng điểm môn (thay tab Sổ Điểm Theo Môn)

Mỗi dòng là một học sinh trong một lớp, tính theo **tháng**. Ô trắng là KiN tự tính; ô vàng là gia sư được sửa.

| Cột | Cách tính | Nguồn |
|---|---|---|
| Điểm TB môn | trung bình các bài Kiểm tra + Đầu/Cuối kỳ có điểm trong tháng; bài gia sư đánh "hệ số 2" thì tính hai lần | bài kiểm tra · `GD-31` |
| % BTVN đúng hạn | số bài về nhà nộp đúng hạn / số bài về nhà **đã đến hạn** trong tháng | bài về nhà |
| Số BTVN thiếu | số bài đã quá hạn mà chưa nộp | bài về nhà |
| Số lần nộp muộn | số bài nộp sau hạn | bài về nhà |
| Điểm đầu kỳ, cuối kỳ | điểm bài gắn nhãn Đầu kỳ / Cuối kỳ gần nhất | bài kiểm tra |
| Tiến bộ | cuối kỳ − đầu kỳ | tự tính |
| Chuyên cần | mục 1 | điểm danh |
| Buổi vắng, Vắng không xem record | mục 1 | điểm danh + Thư viện |
| Nhận xét | **gõ tay** | gia sư |
| Mức cảnh báo (5 mức) | công thức cũ (`dua-bang-tinh-len-web.md` mục 3) | tự tính |
| Điểm xếp hạng | 0,5 × Điểm TB + 0,2 × BTVN/10 + 0,2 × Tiến bộ quy đổi + 0,1 × Chuyên cần | tự tính |
| Hạng, sĩ số, vượt % bạn | như cũ; hoà thì đồng hạng (`GD-07`) | tự tính |
| Học bổng gợi ý | TOP 1 / TOP 2; gia sư bấm "Áp dụng" mới vào phiếu | tự tính, gia sư quyết |

- Ô gia sư sửa tay (ví dụ chỉnh điểm TB vì bài bị lỗi) thì có dấu "đã sửa tay". Bấm vào thấy số KiN tính và số gia sư đã ghi đè.
- Ô chưa có dữ liệu hiện **"chưa có"**, không hiện 0. Đây là chỗ bảng tính hay nhầm: ô % BTVN trống bị coi là 100%, ô điểm danh trống bị coi là vắng.
- Mức cảnh báo cần Điểm TB. Tháng chưa có bài kiểm tra nào thì cột này ghi "chưa đủ dữ liệu", không ghi Tốt.

### Từ bảng điểm đi đâu

```
Điểm danh ─┬─► Chuyên cần ─┬─► Nỗ lực (phiếu phụ huynh, NV-186)
           │               └─► Điểm xếp hạng (10%)
           └─► Học phí (GD-25: Vắng / Có phép không tính khi lớp tắt "vắng vẫn tính tiền")

Bài về nhà ─► % đúng hạn ─┬─► Nỗ lực
                          ├─► Điểm xếp hạng (20%)
                          └─► Mức cảnh báo

Bài kiểm tra ─► Điểm TB ─┬─► Điểm xếp hạng (50%) ─► Hạng ─► Học bổng gợi ý ─► Phiếu học phí (khi gia sư áp)
               3 bài gần └─► Mức cảnh báo
               nhất ─► Năng lực (phiếu phụ huynh, NV-185)
Đầu/Cuối kỳ ─► Tiến bộ ─► Điểm xếp hạng (20%)
```

Mỗi mũi tên là tự động. Gia sư chỉ làm ba việc: **xác nhận điểm danh**, **giao bài**, **viết nhận xét**.

---

## 4. Màn hình

File Figma đã được sắp lại ngày 25/10 (trang *📖 Mục lục & liên kết*, `557:4488`). Mã khung dưới đây là mã **sau** lần sắp lại.

| Màn | Có gì | Khung Figma |
|---|---|---|
| Hộp việc gia sư, có nút Vào lớp | buổi sắp tới có **Vào lớp** và **Mở buổi học**, "1/2 em đã bấm vào lớp"; việc "Điểm danh buổi … tick sẵn theo lượt vào lớp", "Lịch Google đã dừng · Nối lại", "Điểm Azota chưa khớp · Ghép tay" | `598:7909` (thêm 26/10, nhân từ `299:111821`) |
| Việc của tôi (học sinh) | đã có nút **Vào lớp học** ở khung Buổi học tiếp theo | `299:114360` (có sẵn) |
| Điểm danh tháng | cần thêm dòng "gợi ý từ lượt vào lớp lúc …" và nút "Xác nhận cả lớp" | `464:6029` (có sẵn, cần sửa) |
| Sổ điểm và tiến bộ | đã có: TB chỉ tính điểm đã công bố, "Chờ chấm / Chưa nộp" không tính 0, điểm danh không cộng vào TB. **Cần thêm** cho lớp có xếp hạng: % BTVN, chuyên cần, mức cảnh báo, hạng, học bổng gợi ý (bật theo lớp) | `464:5630` (có sẵn, cần sửa) |
| Kết nối và lưu trữ | chỗ đặt nút "Nối Google Calendar" (cách B) | `464:7330` (có sẵn) |

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| NGƯỠNG_MUỘN | sau giờ học 10 phút | đề xuất |
| HẠN_LÀM_BÙ_BÀI_KIỂM_TRA | 7 ngày | đề xuất |
| BÀI_VẮNG_QUÁ_HẠN | Miễn (gia sư đổi được thành Tính 0) | `GD-30` |
| HỆ_SỐ_BÀI | 1; gia sư đánh "hệ số 2" cho bài lớn | `GD-31` |
| KỲ_TÍNH_BẢNG_ĐIỂM | tháng | theo bảng tính |
| VẮNG_KHÔNG_XEM_RECORD | 7 ngày sau buổi | đề xuất |
| GHÉP_FILE_AZOTA | mã học sinh KiN → họ tên + lớp; không dùng số điện thoại | đề xuất |
