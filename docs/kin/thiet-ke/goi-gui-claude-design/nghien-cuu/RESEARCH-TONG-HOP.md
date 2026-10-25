# Research tổng hợp cho giao diện KiN — từ báo cáo Sổ Gia Sư và 102 ảnh

Soạn 22/10/2026. Dùng để thiết kế giao diện KiN (gia sư trước, học sinh sau). Đây là tài liệu thiết kế, không sửa mã.

## 0. Cách đọc và cách ghi nguồn

Mỗi khẳng định có nguồn trong ngoặc vuông. Có bốn loại nguồn:

| Ký hiệu | Nghĩa | Ví dụ |
|---|---|---|
| `[BC §x.y d.N]` | Báo cáo chữ `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md`, mục và dòng N | `[BC §3.3.2 d.147]` |
| `[ảnh xxxxxxxx]` | Ảnh trong 102 ảnh gốc, gọi bằng 8 ký tự đầu tên tệp (tên đầy đủ 40 ký tự `.jpg`, không trùng nhau). Mô tả ảnh lấy từ hai journal của các chuyên viên đã mở từng ảnh | `[ảnh 9eca7149]` |
| `[ảnh xxxxxxxx ✓]` | Như trên, và tôi đã tự mở lại ảnh gốc để đối chiếu mô tả (6 ảnh: 9eca7149, 22608da4, 2e32d1cb, 11a4cd13, d2a216a5, 66e5b5d6) | |
| `[KH d.N]`, `[QD d.N]`, `[MH-04 d.N]`, `[TD d.N]`, `[PH d.N]` | Tài liệu KiN: `ke-hoach-phat-trien-tu-research.md`, `quyet-dinh-giao-dien-va-hoc-phi.md`, `thiet-ke/goi-gui-claude-design/man-hinh/0N-*.md`, `tien-do-dang-do.md`, `bao-cao/nc2-026-ra-soat-trang-phu-huynh.md` | `[MH-04 d.7]` |

Chỗ nào là suy luận của tôi, không có trong ảnh hay báo cáo, được ghi rõ chữ **[suy luận]**. Chỗ nào không có bằng chứng được ghi **[không có bằng chứng]**.

Tên viết tắt sản phẩm dùng ở các bảng: **SGS** Sổ Gia Sư, **TB** TutorBird, **TW** Teachworks, **TnG** Teach 'n Go, **TC** TutorCruncher, **SH** Shub Classroom, **PR** Preply, **SP** Superprof, **WY** Wyzant.

Số ảnh theo sản phẩm (đếm lại từ hai journal, cộng đúng 102): SGS 29 (28 ảnh dashboard + 1 ảnh PNG báo cáo do app xuất), TB 19, TW 14, nhóm TnG/TC/SH 12 (SH 4, TnG 3, TC 3, 2 ảnh trắng hoặc chỉ có banner cookie không rõ hãng), PR 19, SP 4, WY 5.

## 1. Tóm tắt 10 dòng

1. Sổ Gia Sư là sổ tay số cho gia sư, không phải sàn: một vòng lặp Lớp → Buổi → Điểm danh → Phí → Phiếu QR → Thu tiền → Báo cáo phụ huynh `[BC §1 d.26]`.
2. Cách trình bày đáng học nhất là "mỗi thẻ một con số lớn và một dòng nhãn nhỏ", màu có nghĩa, một nút đặc mỗi màn `[ảnh 9eca7149 ✓]`, `[ảnh 22608da4 ✓]`.
3. Việc cần làm phải lên đầu màn chủ. SGS làm đúng ý nhưng thẻ rỗng chiếm cả hàng và lịch hôm nay bị đẩy xuống cuối `[ảnh 9eca7149 ✓]`; KiN nên gộp thành một khối chỉ hiện khi có việc **[suy luận]**.
4. Học phí: thẻ theo học sinh, số tiền cam lớn bên phải, hai nút ở chân thẻ (viền + đặc), dải tổng đầu danh sách (cam khi chưa thu, xanh lá khi đã thu) `[ảnh 22608da4 ✓]`, `[ảnh c740944e]`.
5. Điểm danh một chạm bằng ba nút có chữ, kèm hàng đếm ba số, chip bước 10 phần trăm cho bài tập về nhà `[ảnh ecaca8dc]`. Ở SGS tiền gắn vào điểm danh, ở KiN thì không `[QD d.103]`, nên không chép nhãn "tính phí".
6. Mọi lưới nhiều cột của đối thủ (lịch 7 cột × 16 giờ, điểm danh tháng, bảng học sinh 8 cột, hoá đơn 6 cột) không dùng được trên điện thoại; thay bằng dải 7 ngày, danh sách theo ngày, thẻ một cột `[ảnh 50852205]`, `[ảnh ede79870]`, `[ảnh 32187a31]`, `[ảnh 6c1629f4]`.
7. Phía học sinh chỉ có mẫu từ sàn và LMS: hỏi một câu rồi mới lọc, chia quyết định nhỏ, tóm tắt đơn trước khi trả, trạng thái rỗng một câu một nút `[ảnh 45d3102f]`, `[ảnh 91b83e9d ✓]`, `[ảnh d2a216a5 ✓]`, `[ảnh 11a4cd13 ✓]`.
8. Không có ảnh nào về làm bài, phòng thi, QR thật, thanh toán học phí của học sinh; những màn đó phải tự thiết kế **[không có bằng chứng]**.
9. Cái tuyệt đối tránh: màn mua Coin, thanh toán thẻ, hoa hồng, chia sẻ yêu cầu của học sinh ra ngoài, trường dữ liệu cá nhân thừa (ngày sinh, trường học), banner khuyến mãi mọi trang, cam cho "Offline" và "Có phép" (cam của KiN là "chờ").
10. Ảnh SGS, PR, WY dựng lại từ DOM bằng html2canvas `[BC d.21]`, nên một số lỗi bố cục trong ảnh (thẻ nằm lệch một góc, viền hồng quanh ảnh) có thể là lỗi dựng ảnh, không phải lỗi của hãng.

## 2. Mô hình dữ liệu và luồng việc của Sổ Gia Sư (từ báo cáo)

### 2.1 Thực thể và trạng thái

Nguồn gốc: `[BC §3.4.1 d.261-270]`. Tôi chỉ chép lại phần quan sát được.

| Thực thể | Tạo khi | Trạng thái | Điểm cần nhớ |
|---|---|---|---|
| Lớp | Wizard 3 bước | Hoạt động → Đã kết thúc / Xoá | Có màu (25 màu), link online chung, phí khác chung; **hình thức học phí khoá cứng sau khi tạo** `[BC §3.3.4 d.171]` |
| Học sinh | Trong wizard hoặc Thêm học sinh | Đang học → Đã nghỉ / Xoá | Mỗi cặp (học sinh, lớp) có **ngày vào lớp** và **học phí riêng**; học sinh cũ gắn được vào nhiều lớp |
| Buổi | Sinh hàng loạt từ thứ + giờ + khoảng, hoặc "Buổi mới" | Đã lên lịch → Hoàn thành / Đã nghỉ / Xoá | Online/Offline, link riêng; đồng bộ Google Calendar nếu bật |
| Điểm danh | Trong buổi, hoặc trên lưới tháng | Có mặt (tính phí) · Vắng (tính phí) · Có phép (không tính phí) | Kèm % BTVN, điểm 0–10, nhận xét riêng, tài liệu |
| Khoản phí | Khi bấm "Đã dạy xong", cho học sinh Có mặt hoặc Vắng | Chưa thu → Đã thu (có Hoàn tác) | Theo buổi: giá × 1; theo giờ: giá × thời lượng; theo khoá: chưa thử |
| Phiếu thu | Từ các khoản chưa thu | Ảnh PNG, không lưu "đã gửi" | QR VietQR theo tài khoản gia sư |
| Báo cáo phụ huynh | Bật chia sẻ | Đang chia sẻ / Tắt | URL cố định, công khai, không mật khẩu |

### 2.2 Luồng một vòng

1. Tạo lớp trong một màn: chọn thứ, giờ, khoảng 1/4/8 tuần hoặc 3 tháng, bỏ tick buổi không muốn, nút cuối ghi "Tạo lớp + 8 buổi" `[BC §3.3.4 d.169]`, `[ảnh cdbd1f37]`.
2. Buổi diễn ra, gia sư mở buổi, điểm danh, bấm **Đã dạy xong** (có hộp xác nhận); phí chỉ phát sinh lúc này `[BC §3.4.3 d.282]`.
3. Phí vào "Học phí chưa thu"; gia sư tạo phiếu (có QR nếu đã cài ngân hàng), gửi ảnh phiếu qua Zalo thủ công `[BC §3.4.4 d.286]`.
4. Gia sư bấm "Đã thu tiền" (hộp xác nhận nêu số tiền và tên); có Lịch sử thu và Hoàn tác `[BC §3.3.9 d.229]`.
5. Phụ huynh xem báo cáo qua link cố định hoặc ảnh PNG báo cáo buổi `[BC §3.3.12 d.253]`, `[ảnh c0670eec]`.

### 2.3 Khác nhau giữa SGS và KiN (đối chiếu để khỏi chép nhầm)

| Điểm | Sổ Gia Sư | KiN hiện có |
|---|---|---|
| Tiền và điểm danh | Phí sinh ra khi chốt buổi; Vắng tính phí `[BC §3.4.2 d.274]` | Tiền **không còn phụ thuộc điểm danh**; điểm danh nuôi Sổ của con, chuyên cần, buổi bù `[QD d.103]`, `[KH d.86]` |
| Đối soát chuyển khoản | "Sắp có", gia sư bấm "Đã thu tiền" thủ công `[BC §3.4.3 d.282]` | Webhook SePay, mã `KIN`+5 ký tự, tự gạch khi đúng mã và đúng số `[KH d.46]` |
| Phụ huynh thấy học phí | Không `[BC §3.3.12 d.253]` | Trang `/so-cua-con/[token]` có phiếu học phí `[PH d.36]`, khung riêng cho phụ huynh `[TD d.185]` |
| Dời, huỷ, báo nghỉ, buổi bù | 3 trạng thái buổi, không có dạy bù `[BC §3.5 d.298-309]` | Đã có `class_session_changes`, `class_absences`, `makeup_credits` `[KH d.47]` |
| Zalo | Gia sư tự gửi ảnh và link | Zalo bán tự động, chỉ ghi "Đã mở Zalo lúc…", cố ý không ghi "đã gửi" `[KH d.45]` |
| Ẩn mục chưa dùng | Không `[BC §7 d.617]` | Có, mặc định chỉ Lịch + Học phí `[KH d.48]` |

Hệ quả cho thiết kế: bài học của SGS về **cách trình bày** dùng được gần như nguyên vẹn; bài học về **cơ chế** (phí theo chốt buổi, đối soát "sắp có", ẩn học phí khỏi phụ huynh) không áp được.

## 3. Bài học giao diện theo từng màn gia sư

Quy ước ở mỗi màn: **Nên theo** (có ảnh), **Nên tránh** (có ảnh), **Áp vào KiN** (dữ liệu mẫu thống nhất: Cô Lan, 7 lớp Toán 9, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9, Toán 8; 8 học viên; đã thu tháng 10 là 480.000đ; còn lại 560.000đ; phiếu Đỗ Hà 560.000đ nháp, Trần Gia Bảo 480.000đ đã đóng; Thứ Sáu 23/10 19:00–20:30 Toán 9 có 2 học viên; Thứ Bảy 24/10 16:00–17:30 Văn 8; việc cần làm: 2 yêu cầu xác nhận của phụ huynh, 1 báo nghỉ sát giờ, 1 khoản cần đối soát, 4 buổi chưa điểm danh).

### 3.1 Trang chủ gia sư

Nguồn chính: SGS `[ảnh 9eca7149 ✓]`, TB `[ảnh 2b427782]`, TW `[ảnh b8b4e041]`, `[BC §3.3.2 d.147]`.

**Nên theo**
- Mỗi thẻ một con số lớn, một dòng nhãn nhỏ; số tiền và số đếm là thứ to nhất màn `[ảnh 9eca7149 ✓]`, `[BC §3.3.2 d.147]`.
- Lời chào theo buổi kèm thứ và ngày đầy đủ, một nút làm mới ở góc `[ảnh 9eca7149 ✓]`.
- Số tiền riêng tư có icon mắt để ẩn khi mở app trước mặt người khác `[ảnh 9eca7149 ✓]`, `[BC §3.6 d.323]`.
- Ba số nhỏ trong thẻ "Buổi học tháng này" mỗi số một màu **và** có chữ dưới (Đã lên lịch, Hoàn thành, Đã nghỉ) `[ảnh 9eca7149 ✓]`.
- "Hôm nay" ngay dưới số liệu, có ‹ Hôm nay › và vạch màu bên trái thẻ buổi, giờ in đậm `[ảnh 2b427782]`.
- Việc cần làm đứng đầu: SGS có khối "Buổi chưa hoàn thành" làm nhắc nhở duy nhất `[BC §3.3.2 d.147]`.
- Thanh bước thiết lập chỉ hiện khi chưa xong, bước xong có dấu tích `[ảnh b8b4e041]`; dùng ý, không dùng 8 bước.
- Trạng thái rỗng một câu thân thiện, không bảng trống: Shub "Không có buổi học nào diễn ra hôm nay", "Thật tuyệt vời! Tất cả bài tập đã được hoàn thành" `[ảnh 11a4cd13 ✓]`.

**Nên tránh**
- Thẻ rỗng chiếm cả hàng: "Buổi chưa hoàn thành" trống vẫn to bằng ba thẻ số cộng lại, đẩy Lịch dạy hôm nay xuống cuối trang `[ảnh 9eca7149 ✓]`.
- Hàng tiền chỉ có 2 thẻ, để lệch một góc `[ảnh 9eca7149 ✓]`.
- Banner khuyến mãi trên cùng mọi trang `[ảnh 9eca7149 ✓]`, `[BC §3.1 d.107]`.
- Nhãn KPI dài tràn thẻ (TB) `[ảnh 2b427782]`; khung lưu ý dài ở đầu, biểu đồ rỗng toàn số 0 (TW) `[ảnh b8b4e041]`, `[ảnh 99ed171b]`.
- Menu 13 mục (TB) `[ảnh e5604abf]` so với KiN đã có "ẩn mục chưa dùng" `[KH d.48]`.

**Áp vào KiN**
- Thứ tự trên điện thoại đề xuất: lời chào một dòng → khối "Việc cần làm" (chỉ hiện khi có, mỗi dòng một chữ + một nút: "2 yêu cầu xác nhận của phụ huynh", "1 báo nghỉ sát giờ", "1 khoản cần đối soát", "4 buổi chưa điểm danh") → "Hôm nay" (nếu không có buổi, nói rõ và hiện buổi kế tiếp: Thứ Sáu 23/10 19:00–20:30 Toán 9, 2 học viên) → hai số tiền (Đã thu tháng 10 là 480.000đ xanh lá; Còn lại 560.000đ cam) → các lớp dạng thẻ **[suy luận]**.
- **Mâu thuẫn với bản nháp cũ:** `gia-su-giao-dien-tu-102-anh.md` mục 1 đặt hàng 4 thẻ số lên trước "Hôm nay". Ảnh TB đặt KPI trước agenda `[ảnh 2b427782]`, ảnh SGS đặt thẻ số trước lịch `[ảnh 9eca7149 ✓]`, nhưng cả hai đều có màn hình rộng, còn Shub (nhiều nhất cho thấy "hôm nay có gì" trước) lại ở phía học sinh `[ảnh 11a4cd13 ✓]`. Chưa có ảnh điện thoại nào của một sản phẩm gia sư để phân xử. Chờ chủ dự án chọn thứ tự.
- Khi cả bốn việc bằng 0: một dòng chữ xanh "Không có việc cần làm", không dựng thẻ rỗng **[suy luận từ ảnh 9eca7149 ✓]**.

### 3.2 Lịch

Nguồn: SGS `[ảnh 50852205]`; TB `[ảnh d9a48bb8]`, `[ảnh 7b441e2f]`, `[ảnh 189297bf]`, `[ảnh 190a8682]`; TW `[ảnh 313a202f]`, `[ảnh 02ac0797]`, `[ảnh 8a3fc5b1]`; PR `[ảnh 66e5b5d6 ✓]`, `[ảnh 2c486c98]`.

**Nên theo**
- Nhóm nút một hàng: 3 ngày / Tuần / Tháng, nút đang chọn nền đậm; nút Hôm nay nằm giữa hai mũi tên; khoảng ngày ở giữa `[ảnh 50852205]`, `[BC §3.3.3 d.153]`.
- Vạch đỏ ngang "bây giờ" trên lưới giờ, cột hôm nay nền nhạt khác `[ảnh 50852205]`.
- Khối buổi theo màu lớp, dấu trạng thái ở góc (dấu tích là xong, đồng hồ là sắp tới) `[ảnh 50852205]`.
- Dải 7 chip ngày ngang, ngày chọn có viền đậm và ghi rõ múi giờ `[ảnh 66e5b5d6 ✓]`; ngày còn giờ trống có gạch màu `[ảnh 2c486c98]`. Đây là mẫu chọn ngày của sàn, dùng được cho dải 7 ngày của lịch gia sư **[suy luận]**.
- Nút Hôm nay mờ khi đang ở hôm nay `[ảnh 313a202f]`.
- Chạm buổi mở chi tiết, hàng icon thao tác nhỏ ở trên, một nút Điểm danh rộng đặc ở đáy thẻ `[ảnh 190a8682]`.
- Menu "Thêm" tách 3 loại, bài học nhanh đứng đầu `[ảnh 7b441e2f]`.
- Một nút "Chia sẻ lịch" ở góc phải tiêu đề `[ảnh 50852205]`, tương ứng chữ KiN "Gửi lịch tuần qua Zalo".

**Nên tránh**
- Lưới 7 cột × 16 giờ: chữ trong khối bị cắt "Lớp TEST …", giờ 07–16 trống, buổi 18:00 phải cuộn `[ảnh 50852205]`.
- Ô tháng cao khoảng 110px, chip chữ rất nhỏ, thanh công cụ 5 nút `[ảnh d9a48bb8]`.
- Tuần bắt đầu bằng Chủ nhật, cột đầu bị dịch thành "Mặt trời" `[ảnh d9a48bb8]`, `[ảnh 313a202f]`; giờ 12h AM/PM, múi giờ Mỹ `[ảnh 8a3fc5b1]`.
- Khung hướng dẫn dài ở đầu lịch đẩy lịch xuống thấp `[ảnh 313a202f]`.
- Form thêm buổi dài với nhiều radio, giờ mặc định 11:00 PM `[ảnh 189297bf]`.
- Chuỗi giờ rảnh dài một dòng khó đọc `[ảnh c4ad5abc]`.

**Áp vào KiN**
- Dải 7 ngày (T2…CN + ngày), hôm nay tô đặc, chấm nhỏ ở ngày có buổi, chạm để nhảy tới ngày; dưới dải là danh sách buổi dạng thẻ có vạch màu lớp bên trái, giờ in đậm, chip trạng thái bằng chữ (Sắp tới, Đang diễn ra, Đã kết thúc, Đã huỷ) `[ảnh 66e5b5d6 ✓]`, `[ảnh 50852205]` **[suy luận cho phần điện thoại; chưa có ảnh điện thoại nào của lịch gia sư]**.
- Giữ nguyên chữ "← Tuần trước · Tuần này · Tuần sau →" và "Gửi lịch tuần qua Zalo" `[MH-02 d.154]`; giờ 24h, tuần bắt đầu T2.
- Màu lớp chỉ là phụ: tên lớp luôn bằng chữ, vì SGS dùng icon (dấu tích, đồng hồ) không chữ `[ảnh 50852205]`.
- "Kiểm tra xung đột" của TW `[ảnh 8a3fc5b1]` là hành vi thêm, không phải trình bày; chỉ ghi nhận, không đưa vào thiết kế khi chưa có quyết định.

### 3.3 Lớp (danh sách, chi tiết, tạo lớp)

Nguồn: SGS `[ảnh d69ebba7]`, `[ảnh 486587a8]`, `[ảnh 139b0933]`, `[ảnh cdbd1f37]`, `[ảnh 6b52ce72]`; Shub `[ảnh b03b9eb4]`, `[ảnh ef4f8038]`.

**Nên theo**
- Đầu chi tiết lớp: chấm màu + tên + ba chip (hình thức học phí, số buổi, số học sinh) thay cho một đoạn văn `[ảnh 486587a8]`.
- Danh sách buổi nhóm theo "Tuần này / Tuần sau / 2 tuần sau", mỗi dòng ngày chữ đầy đủ + chip trạng thái + giờ + Offline + mũi tên `[ảnh 486587a8]`, `[ảnh cdbd1f37]`.
- Hành động phá huỷ (Kết thúc, Xoá) gom vào "Vùng nguy hiểm" nền hồng ở cuối trang, tách khỏi nút thường `[ảnh 486587a8]`.
- Wizard 3 bước có thanh tiến trình, bước xong có dấu tích, nút cuối đổi nhãn theo hậu quả ("Tạo lớp + 8 buổi") `[ảnh cdbd1f37]`, `[ảnh 139b0933]`.
- Chọn thứ bằng chip T2…CN; chip khoảng tạo buổi 1 tuần / 4 tuần / 8 tuần / 3 tháng / Tuỳ chỉnh; danh sách buổi tick sẵn, bỏ từng buổi `[ảnh cdbd1f37]`.
- Hình thức học phí hiện thành ba thẻ chọn có mô tả một dòng, và **nói trước** "Không thể thay đổi sau khi tạo lớp" `[ảnh 139b0933]`; khi sửa lớp, trường này hiện thành chip chỉ đọc `[ảnh 6b52ce72]`.
- Lọc nhanh bằng ba pill (Lớp của bạn / Lớp đang chờ / Lớp đã ẩn) kèm ô tìm và ô sắp xếp một hàng `[ảnh b03b9eb4]`; mã lớp 5 ô gạch chân, một nút xanh rộng, liên kết quay lại ngay dưới `[ảnh ef4f8038]`.
- Hộp thoại sửa có chân cố định chứa Huỷ và Cập nhật `[ảnh 6b52ce72]`.

**Nên tránh**
- Bước 3 nhồi quá nhiều khối (thứ, giờ, khoảng, đồng bộ, hình thức, link, danh sách buổi) `[ảnh cdbd1f37]`.
- Thanh "Quay lại / Tiếp tục" đè lên nội dung đang cuộn `[ảnh 139b0933]`.
- Cột học sinh hẹp, tên bị cắt ("Học sinh TE…", "Thêm học…"), 5 nút nhỏ sát nhau trong một thẻ `[ảnh 486587a8]`.
- Danh sách lớp rỗng hoàn toàn, không câu giải thích, nút "Thêm lớp" ở góc trên xa tay `[ảnh d69ebba7]`.
- Trạng thái rỗng minh hoạ lớn chiếm gần hết màn `[ảnh b03b9eb4]`, `[ảnh 0b5e59f8]`.
- Bảng nhiều cột đếm số (học sinh, bài giảng, bài tập, tài liệu) `[ảnh b03b9eb4]`.
- Form học sinh nhiều trường (xem 3.6).

**Áp vào KiN**
- Thẻ lớp: tên lớp (Toán 9, Văn 8…), chấm trạng thái + chữ, sĩ số "2 học viên", ba nút: **Mở lớp** (chính) · Điểm danh · Danh sách HS `[MH-03]`, `gia-su-giao-dien-tu-102-anh.md` mục 3.
- "Thanh sĩ số" (n trên sức chứa) **không có trong ảnh nào**; SGS chỉ dùng chip "1 học sinh" `[ảnh 486587a8]` và Shub dùng số đếm `[ảnh b03b9eb4]`. Giữ như thiết kế riêng của KiN, ghi rõ không phải bài học từ ảnh **[không có bằng chứng]**.
- Pill lọc theo trạng thái `[ảnh b03b9eb4]`: để vòng sau như bản nháp cũ đã ghi.
- Cảnh báo "không đổi được sau khi tạo" là bài học về chỗ đặt chữ cảnh báo (trước lúc chọn); việc khoá hay mở là hành vi, không thuộc phạm vi trình bày `[BC §3.3.4 d.171]`.

### 3.4 Học phí (chỉ trình bày, không đổi cách tính)

Quy tắc cứng: màn này dính tiền, chỉ đổi cách trình bày; những thứ như hoàn tác, xác nhận hai bước, gộp nút vào menu thuộc hành vi và chờ chủ dự án quyết `[MH-04 d.7]`.

Nguồn: SGS `[ảnh 22608da4 ✓]`, `[ảnh c740944e]`, `[ảnh 510dc007]`, `[ảnh ad91d1bd]`, `[ảnh a6b8f794]`; TB `[ảnh 686b1125]`, `[ảnh fa04f891]`, `[ảnh 26fe8fc3]`, `[ảnh b04b188c]`; TW `[ảnh 6c1629f4]`.

**Nên theo (trình bày)**
- Hai tab "Học phí chưa thu / Lịch sử thu", chỉ hiện nội dung tab đang chọn `[ảnh 22608da4 ✓]`. KiN đã có ba tab Phiếu / Chờ đối soát / Nhận tiền `[MH-04 d.11-14]`; dùng cùng cách một tab một nội dung.
- Dải tổng ngay dưới bộ lọc: "Học phí chưa thu 200.000đ · 1 học sinh", số tiền cam; ở lịch sử là "Đã thu trong tháng", số tiền xanh lá `[ảnh 22608da4 ✓]`, `[ảnh c740944e]`.
- Thẻ theo học sinh: avatar chữ cái + tên, số tiền cam lớn nhất thẻ ở bên phải, dưới là lớp + số buổi, chân thẻ hai nút (viền "Tạo phiếu học phí", đặc xanh lá "Đã thu tiền") `[ảnh 22608da4 ✓]`.
- Một dòng "kể chuyện" làm số chính: "Số tiền còn nợ … tính đến [ngày]" `[ảnh fa04f891]`, `[ảnh 686b1125]`.
- Cảnh báo thiếu tài khoản ngân hàng đặt ngay trong khung phiếu, kèm liên kết "Cài đặt ngay" `[ảnh 1ceeb24f]`.
- Giải thích cách tính ngay dưới số liệu và nói rõ dự báo là mức trần, không phải tiền chắc chắn `[ảnh a6b8f794]`; mỗi biểu đồ có tiêu đề và một câu mô tả `[ảnh ad91d1bd]`; màu nhất quán xanh lá là đã thu, cam là chưa thu `[ảnh ad91d1bd]`.
- Tạo hoá đơn có "Chọn nhanh" khoảng thời gian, mặc định tháng kế tiếp, nút Tiếp theo đặc ở góc phải `[ảnh 26fe8fc3]`.

**Nên tránh**
- Thẻ nằm lệch một góc, nửa màn còn lại trống `[ảnh 22608da4 ✓]` (có thể là lỗi dựng ảnh, xem mục 6).
- Hàng nút trên cùng quá nhiều (Tạo nhiều phiếu, Gộp phiếu, Làm mới) và nút "Chọn buổi" xám nhạt khó thấy `[ảnh 22608da4 ✓]`.
- Nút "Hoàn tác" hồng nhạt tương phản thấp trên nền trắng `[ảnh c740944e]`.
- Số âm trong ngoặc "(30.00)" và huy hiệu đỏ cho cả phí lẫn nợ gây hiểu nhầm `[ảnh fa04f891]`.
- Bảng hoá đơn 6 cột (Dịch vụ, Mô tả, Số lượng, Đơn giá, Giảm giá %, Số tiền), xử lý thuế `[ảnh 6c1629f4]`, `[ảnh e89f8796]`.
- Wizard tạo hoá đơn nhiều tuỳ chọn, câu hỏi dài `[ảnh 26fe8fc3]`, `[ảnh b04b188c]`.
- Trục biểu đồ ghi "N" (nghìn), font serif lệch hệ thống `[ảnh ad91d1bd]`.
- Nhãn mẫu Pro, Mùa hè, Trung Thu trên phiếu `[BC §3.3.9 d.221]`.

**Áp vào KiN**
- Dải tổng: Đã thu 480.000đ (xanh lá) · Còn lại 560.000đ (cam). Thẻ **Đỗ Hà 560.000đ**, trạng thái chữ "Nháp", nút đặc duy nhất "Gửi phiếu"; thẻ **Trần Gia Bảo 480.000đ**, trạng thái chữ "Đã đóng", không nút đặc `[MH-04 d.162-163]`.
- Giữ nguyên mã phiếu `KIN`+5 ký tự và nút "Sao chép tin nhắn" `[KH d.46]`, `[MH-04 d.221]`; bài học từ TW chỉ là "mã tự điền, sao chép được" `[ảnh 6c1629f4]`.
- **Hành vi, không đưa vào thiết kế khi chưa quyết:** hộp xác nhận hai bước "Bạn đã nhận … từ …?", Lịch sử thu có Hoàn tác, gộp phiếu, tạo nhiều phiếu `[BC §3.3.9 d.229]`, `[ảnh 510dc007]`. Riêng toast sau thao tác tiền: ngắn, **không chứa tên và số tiền**; chi tiết nằm trong hộp thoại.
- Cách tính "tiềm năng" của SGS (đã thu + chưa thu + dự báo buổi đã lên lịch) là chỉ số của SGS `[BC §3.3.10 d.235]`, không phải một thay đổi cách tính của KiN.

### 3.5 Điểm danh và chi tiết buổi

Nguồn: SGS `[ảnh ecaca8dc]`, `[ảnh ede79870]`, `[ảnh c35687c2]`; TB `[ảnh ace26321]`, `[ảnh 8eac9e56]`, `[ảnh f7493a14]`, `[ảnh fbbf914c]`.

**Nên theo**
- Điểm danh bằng ba nút một chạm Có mặt / Vắng / Có phép, trạng thái đang chọn nổi rõ; nút "Tất cả có mặt" rồi chỉ sửa người vắng `[ảnh ecaca8dc]`, `[BC §3.3.6 d.191]`.
- Hàng tóm tắt ba số có màu **và** chữ (Có mặt, Vắng, Có phép) `[ảnh ecaca8dc]`.
- Chip tick sẵn cho % BTVN (bước 10) và điểm 0–10, "+0.5"; nhận xét có nút mic `[ảnh ecaca8dc]`.
- Banner trạng thái nói thẳng việc kế tiếp: buổi chưa chốt thì banner vàng + nút xanh; đã chốt thì banner xanh + "Mở lại buổi học" `[ảnh ecaca8dc]`, `[BC §3.3.6 d.189]`.
- TB ghi hệ quả bằng chữ ngay cạnh từng lựa chọn ("Có thể lập hoá đơn", "Không tính phí") `[ảnh 8eac9e56]`.
- Hộp chọn người xem ghi chú (Học sinh / Phụ huynh / Riêng tư) dạng chip `[ảnh f7493a14]`.
- Toast xanh ngắn xác nhận thao tác nhanh ("Đã tải ảnh báo cáo") `[ảnh c35687c2]`.
- Khối tỷ lệ tham dự: số phần trăm lớn + thanh tiến độ ngắn `[ảnh fbbf914c]`.

**Nên tránh**
- Hộp hướng dẫn ba gạch đầu dòng chiếm nhiều chỗ phía trên danh sách điểm danh `[ảnh ecaca8dc]`.
- Bốn ô ghi chú lặp lại (nội dung, bài tập về nhà, nhận xét chung, kế hoạch buổi sau) + nhận xét riêng làm trang rất dài; nút Lưu xám nhỏ ở cuối dễ bỏ sót `[ảnh ecaca8dc]`.
- Dropdown 8 trạng thái thay cho nút chọn nhanh, ký hiệu ($) trong tên `[ảnh 8eac9e56]`.
- Trình soạn thảo văn bản đầy đủ quá nặng cho gia sư dùng điện thoại `[ảnh f7493a14]`.
- Lưới điểm danh tháng: ô vuông rất nhỏ, chữ ngày nhỏ, cuộn ngang, chữ "K", "P" chỉ phân biệt nhờ màu `[ảnh ede79870]`.
- Toast che lên hộp hướng dẫn và không nằm ở góc màn `[ảnh c35687c2]`.

**Áp vào KiN**
- **Đừng chép nhãn "tính phí / không tính phí" lên điểm danh.** Ở SGS và TB, trạng thái điểm danh quyết định tiền `[BC §3.4.2 d.274-276]`, `[ảnh 8eac9e56]`; ở KiN tiền không phụ thuộc điểm danh `[QD d.103]`, và màn Báo ghi nhầm nói thẳng "Học phí tháng KHÔNG đổi" `[QD d.113-114]`. Bài học giữ lại là **hệ quả bằng chữ cạnh lựa chọn**, nhưng hệ quả của KiN là chuyên cần, Sổ của con và buổi bù, không phải tiền **[suy luận]**.
- KiN có 4 trạng thái điểm danh tính chuyên cần (trong mã có present, late, excused; hệ số 1 / 0,9 / 0,8 / 0,5) `[PH d.13]`, `[KH d.86]`; ba nút của SGS không đủ, cần bố cục 4 lựa chọn đều ≥ 44px **[suy luận]**.
- "4 buổi chưa điểm danh" lên khối Việc cần làm của trang chủ `[KH d.86]`; mở buổi nào thì vào thẳng trang điểm danh của buổi đó, kèm ngày.
- Màu cam của KiN nghĩa là "chờ" `[BC §3.2 d.133]`, quy ước màu KiN ở `BRIEF.md`; SGS dùng cam cho "Có phép" và "Offline" `[BC §3.2 d.133]`, `[ảnh ecaca8dc]`: không chép, chọn màu theo token trạng thái KiN.
- Ghi chú buổi, BTVN, điểm: thu gọn mặc định, mở khi cần **[suy luận]**; phần phân quyền người xem ghi chú động tới dữ liệu của trẻ nên chưa đưa vào khi chưa quyết.

### 3.6 Học sinh (danh sách và hồ sơ)

Nguồn: SGS `[ảnh 1c5d46fe]`, `[ảnh b1ba0bf8]`; TB `[ảnh 32187a31]`, `[ảnh 1cd39a2b]`; TW `[ảnh ef8b370b]`, `[ảnh 017e218f]`.

**Nên theo**
- Một ô tìm theo tên, SĐT, phụ huynh; bộ lọc mặc định "Đang học" `[ảnh 1c5d46fe]`.
- Avatar chữ cái + tag trạng thái bằng chữ cạnh tên `[ảnh 32187a31]`, `[ảnh b1ba0bf8]`.
- Hồ sơ: số tiền còn nợ màu cam lớn nhất thẻ, chi tiết theo lớp bung ra bằng "Chọn buổi", nút "Đã thu tiền" xanh lá ngay chân thẻ nợ `[ảnh b1ba0bf8]`.
- Chấm xanh trên nút "Link báo cáo" cho biết link đang bật `[ảnh b1ba0bf8]`.
- Cảnh báo vàng đặt ngay chỗ thiếu thông tin ("thiếu email"), có nút Bỏ qua / Nhắc tôi sau `[ảnh 1cd39a2b]`.
- Hành động huỷ (Đã nghỉ, Xoá) gom ở "Vùng nguy hiểm" `[ảnh b1ba0bf8]`.

**Nên tránh**
- Bảng 8 cột cuộn ngang, tên bị cắt nhiều dòng `[ảnh 32187a31]`.
- 6 tab ngang tràn màn nhỏ; nhiều hộp thông báo chồng lên nhau `[ảnh 1cd39a2b]`.
- Khối "Thông tin" trống chiếm nửa hàng `[ảnh b1ba0bf8]`; thông tin nợ lặp lại giữa hồ sơ và màn Học phí `[ảnh b1ba0bf8]`, `[ảnh 22608da4 ✓]`.
- Form học sinh đủ thứ: điện thoại nhà, ngày sinh, trường, lớp, hai tầng điều hướng (thanh bước + tab) `[ảnh 017e218f]`, `[ảnh ef8b370b]`.

**Áp vào KiN**
- Học sinh có thể dưới 16 tuổi: **không thêm** ngày sinh, trường học, địa chỉ, ảnh. Từ form của TW chỉ cần tên, lớp và SĐT Zalo phụ huynh **[suy luận từ ảnh 017e218f và quy tắc cứng]**.
- Khối nợ ở hồ sơ chỉ là một dòng "Còn lại" + liên kết sang phiếu, không lặp cả thẻ **[suy luận]**.
- Thẻ học viên mẫu: Đỗ Hà (phiếu 560.000đ nháp), Trần Gia Bảo (480.000đ đã đóng); trạng thái luôn có chữ.

### 3.7 Cài đặt (nhận tiền, kết nối)

Nguồn: SGS `[ảnh faecc690]`, `[ảnh 02db8767]`, `[ảnh fe51ab8d]`, `[ảnh b2a06099]`, `[ảnh 6f57ab79]`; TW `[ảnh 4635ee4c]`.

**Nên theo**
- Mỗi nhóm thông tin một thẻ nhỏ có icon và mô tả ngắn; tài khoản ngân hàng gồm ba trường (ngân hàng, số tài khoản, tên chủ tài khoản) để sinh QR `[ảnh faecc690]`, `[BC §3.3.11 d.247]`.
- Nút Lưu xám cho đến khi nhập đủ `[ảnh faecc690]`.
- Mỗi dịch vụ một thẻ, một nút ở chân; chip cam "Chưa cấp" nói quyền chưa được cấp `[ảnh 02db8767]`.
- Trạng thái rỗng có icon và một câu `[ảnh 02db8767]`, `[ảnh 6f57ab79]`.
- Mục chưa có được làm xám và gắn "Sắp có" `[ảnh 6f57ab79]`.
- Hạn mức nói bằng thanh phần trăm `[BC §3.3.11 d.247]`.

**Nên tránh**
- Mã người dùng dài hiện ở màn chính `[ảnh faecc690]`; hai cột không gập được trên điện thoại `[ảnh faecc690]`.
- Trang Gói rất dài, hạn mức nhắc lại bảng giá `[ảnh fe51ab8d]`; bảng giá, mã giảm giá, khuyến mãi (xem mục 6).
- Hơn 80 tiện ích cùng nhiều lớp khung xanh nhạt chồng nhau `[ảnh 4635ee4c]`.
- Quảng bá tính năng chưa có: "Kho tài liệu" và đối soát đều "Sắp có" nhưng đã được bán trước `[BC §3.5 d.307]`.

**Áp vào KiN**
- Nơi nhận tiền của KiN là tab "Nhận tiền" của Học phí `[MH-04 d.119-134]`: dùng ba trường + nút Lưu xám khi chưa đủ, chip trạng thái bằng chữ ("Đang nối SePay" hoặc "Chưa nối") **[suy luận]**.
- Không có màn gói, thanh toán, mã giảm giá trong thiết kế giai đoạn này; KiN trước mắt miễn phí toàn bộ `[BC §8.1 d.634]` (quyết định đã chốt trong báo cáo, chưa đối chiếu lại với chủ dự án hôm nay).

### 3.8 Phiếu thu

Nguồn: SGS `[ảnh 1ceeb24f]`, `[ảnh 5d3fea9a]`, `[ảnh c0670eec]`; TB `[ảnh b04b188c]`.

**Nên theo**
- Xem trước bên cạnh tuỳ chọn; bảng Khoản thu / Chi tiết / Số tiền, dòng Tổng cộng nền xanh nhạt nổi bật `[ảnh 1ceeb24f]`.
- Hai nút cuối: "Chia sẻ ảnh" (viền) và "Tải ảnh" (đặc), tương ứng thói quen gửi Zalo `[ảnh 1ceeb24f]`, `[BC §3.4.4 d.286]`.
- Công tắc tuỳ chọn (Ẩn chi tiết học phí, Kèm lời nhắn) tách khỏi xem trước `[ảnh 1ceeb24f]`.
- Ảnh gửi Zalo: dải tối bo tròn chứa Ngày dạy và Giờ dạy, chữ trắng lớn; tên học sinh và chip trạng thái cùng một hàng; chân trang có tên sản phẩm `[ảnh c0670eec]`.
- Xuất hàng loạt: tick nhiều học sinh, chọn bố cục ảnh 1×1, 2×2, 2×3, 3×3, xem trước lưới trước khi tạo ảnh `[ảnh 5d3fea9a]`.
- Wizard hoá đơn: kiểu hiển thị kèm hình xem trước nhỏ `[ảnh b04b188c]`.

**Nên tránh**
- Hộp thoại hai cột không dùng được trên điện thoại; phần chọn mẫu bị cuộn xuống dưới `[ảnh 1ceeb24f]`.
- Hộp mờ, nền tối, khó đọc; tuỳ chọn bố cục thừa với người mới `[ảnh 5d3fea9a]`.
- Dòng nghiêng "Buổi học chưa có ghi chú" chiếm khoảng trống `[ảnh c0670eec]`.
- Tuỳ chọn nhiều ở bước 2 cho thao tác thường ngày `[ảnh b04b188c]`.
- 9 hoặc 10 mẫu, nhãn Pro. Số mẫu mâu thuẫn trong chính nguồn: báo cáo ghi 9 mẫu `[BC d.34]`, danh sách chữ liệt kê 10 tên `[BC §3.3.9 d.221]`, ảnh chỉ thấy 3 ô nhỏ `[ảnh 1ceeb24f]`.

**Áp vào KiN**
- Phiếu của KiN là trang `/phieu/[token]` có QR và mã `KIN`+5 ký tự `[KH d.46]`, `[TD d.185]`; việc cần học chỉ là bố cục: số tiền và tổng cộng nổi, nội dung chuyển khoản sao chép được, một nút chia sẻ. Trên điện thoại xếp dọc: xem trước trên, tuỳ chọn dưới **[suy luận]**.
- **Không ảnh nào trong 102 ảnh cho thấy một mã QR thật**; ảnh phiếu của SGS chỉ có dòng cảnh báo "chưa có tài khoản ngân hàng nên phiếu sẽ không có mã QR" `[ảnh 1ceeb24f]`, và báo cáo tự ghi mục này chưa kiểm chứng `[BC Phụ lục B d.833]`. Thiết kế khung QR dựa vào đặc tả KiN, không dựa vào ảnh **[không có bằng chứng]**.

### 3.9 Báo cáo phụ huynh

Nguồn: SGS `[ảnh 48daa960]`, `[ảnh c0670eec]`, `[ảnh c35687c2]`; `[BC §3.3.12 d.253-255]`; KiN `[PH d.36]`, `[TD d.185]`.

**Nên theo**
- Trang công khai tối giản: header logo + "Báo cáo học tập", thẻ học sinh (avatar, tên, "Giáo viên: …", nút Tải PDF), lịch tháng; chỉ hai thẻ, không đăng nhập `[ảnh 48daa960]`.
- Chân trang nói rõ "Trang này được giáo viên chia sẻ riêng cho phụ huynh. Không cần đăng nhập." `[ảnh 48daa960]`.
- Mũi tên chuyển tháng ngay cạnh tiêu đề tháng, bộ đếm "4 buổi" `[ảnh 48daa960]`.
- Ảnh PNG từng buổi nền sáng, chữ lớn để gửi Zalo `[ảnh c0670eec]`.
- Hộp chia sẻ nói trước phụ huynh sẽ thấy gì, có Xem thử và Tắt chia sẻ `[BC §3.3.7 d.205]`.

**Nên tránh**
- Ô lịch nhỏ, chữ giờ rất nhỏ trên điện thoại `[ảnh 48daa960]`.
- Dòng rỗng "Chưa có buổi học nào trong tháng này" đặt dưới dù lịch đã có buổi: lỗi lọc theo ngày thay vì theo trạng thái; ghi nhận ngày 19/10, có thể do buổi 20/10 chưa tới `[BC §3.3.12 d.255]`, `[BC Phụ lục B d.833]`.
- Slug đoán được `/report/tên-gv/tên-hs` `[BC §3.5 d.304]`.

**Áp vào KiN**
- Trang KiN đã có token 32 ký tự hex, thu hồi được, và có phiếu `[KH d.52]`, `[PH d.36]`; thiết kế chỉ nâng cách trình bày: câu mở đầu nói đây là trang riêng, không chuyển tiếp, một thẻ tháng này (chuyên cần, phiếu), danh sách buổi.
- **Mâu thuẫn trong chính báo cáo:** mục 3.3.12 khen "không hiện học phí trên trang phụ huynh" `[BC §3.3.12 d.253]`, mục 8.4E lại đề xuất thêm khối "Học phí: Đã nhận ✓" `[BC §8.4 d.723]`. KiN đã hiện phiếu cho phụ huynh `[PH d.36]`, nên không coi "ẩn học phí" là quy tắc.
- Thông báo ra ngoài (Zalo nhóm, push, toast): không tên em, không số tiền; chi tiết nằm sau link `[KH d.117]`, `[MH-02 d.154]`.
- Học sinh có thể dưới 16 tuổi: không thêm ảnh bài làm, ảnh học sinh hay nhận xét công khai khi chưa quyết.

## 4. Bài học cho học sinh

Phạm vi bằng chứng: chỉ có ảnh sàn gia sư (PR 19, SP 4, WY 5) và 4 ảnh Shub phía học sinh. Không ảnh nào của chính SGS, TB, TW cho học sinh. Học sinh KiN có thể dưới 16 tuổi, chủ yếu dùng điện thoại.

### 4.1 Trang chủ học sinh (Việc của tôi)

- **Có mẫu.** Chia khối theo câu hỏi "hôm nay có gì": Phòng học hôm nay, Bài tập chưa nộp, Tài liệu chưa đọc, Bài giảng chưa xem; mỗi khối một tiêu đề trên thẻ trắng và một câu rỗng thân thiện `[ảnh 11a4cd13 ✓]`, `[ảnh 0b5e59f8]`.
- Dấu tích xanh cạnh từng mục menu cho biết đã xong `[ảnh 11a4cd13 ✓]`.
- Banner vàng nhỏ, đóng được, cho việc cần làm (chưa có thông tin thanh toán) `[ảnh 2e32d1cb ✓]`. Với KiN, banner cho việc như "bài sắp hết hạn", không cho thanh toán thẻ.
- Thanh đầu gọn, mỗi chức năng một icon quen (tin nhắn, thông báo, avatar) `[ảnh e8a12f59]`.
- **Tránh:** nút "Hỏi đáp" xanh nổi che mất tab "Lịch học"; nội dung dồn trái, bỏ phí bên phải `[ảnh 11a4cd13 ✓]`; minh hoạ lớn chiếm chiều cao khi không có dữ liệu `[ảnh 0b5e59f8]`; menu ngang nhiều mục, nhiều khối phụ (app, studio, chia sẻ yêu cầu) `[ảnh 2e32d1cb ✓]`.
- **Áp vào KiN:** lời chào một dòng, "Buổi học sắp tới" (giờ, lớp, nút Vào lớp), "Việc cần làm" (bài tập, hạn nộp), lối tắt; tab dưới 4–5 mục `hoc-sinh-giao-dien-tu-anh-doi-thu.md` (mục "Từng màn học sinh"). Hiện KiN đã có 5 nút (Việc của tôi, Lịch, Lớp, Thư viện, Khác) `[MH-05 mục P1]`. Học sinh mẫu: Trần Gia Bảo. Không đưa tiền học phí và không đưa Coin vào trang này (Coin chỉ nhận thưởng khi làm bài).
- Trạng thái rỗng cho học sinh chưa vào lớp: một câu + nút "Nhập mã mời" (ô 5 ký tự) `[ảnh ef4f8038]`, đã có trong ghi nhận lỗi của KiN `[MH-05 d.222]`.

### 4.2 Tìm gia sư

- **Có mẫu.** Hỏi một câu rồi mới lọc: cổng vào "Bạn muốn học gì?" với một lựa chọn rồi nút hồng lớn, hiện luôn số kết quả ("Hiển thị 46.278 gia sư") `[ảnh 45d3102f]`; ô tìm kiếm duy nhất + chip môn cuộn ngang `[ảnh 677d8596]`.
- Thẻ gia sư: ảnh lớn bo góc, tên, sao và số đánh giá, nhãn tin cậy, giá, "buổi học miễn phí" đặt cạnh giá `[ảnh 677d8596]`.
- Hồ sơ: thẻ giá + sao + số bài + nút "Đặt lịch học thử" luôn thấy, ô "Không khớp? Bạn vẫn còn 2 buổi học thử miễn phí" `[ảnh d0c3caf0]`; Wyzant thêm số giờ đã dạy, thời gian phản hồi "14 phút", buổi đầu được bảo đảm `[ảnh 7d3bee55]`.
- Độ tin cậy: điểm theo 4 tiêu chí thay vì một số `[ảnh a18296e2]`; biểu đồ phân bố 5 đến 1 sao `[ảnh c4ad5abc]`; đánh giá cắt ngắn + "Hiển thị thêm" `[ảnh a18296e2]`.
- **Tránh:** luới 3 cột và 2 cột trên điện thoại `[ảnh 677d8596]`, `[ảnh a18296e2]`; ảnh gia sư không tải, mô tả cắt giữa câu `[ảnh 677d8596]`; đoạn giới thiệu dài, nhãn lẫn tiếng Anh `[ảnh 7d3bee55]`; chân trang SEO dài `[ảnh 41e5a9f7]`, `[ảnh 7e6838a0]`; đánh giá dài liên tục không phân trang `[ảnh 813fb225]`.
- **Áp vào KiN:** thẻ một cột, ảnh vừa phải, "Gia sư" nằm trong menu Khác `[MH-05 mục P1]`. Nút "Đặt lịch" dính đáy màn hình trên điện thoại là **[suy luận]**: ảnh chỉ có thẻ dính bên phải của bản rộng `[ảnh d0c3caf0]`.
- **Không chép:** huy hiệu "Siêu gia sư/top 5%", đánh giá có avatar và tên người học `[ảnh d0c3caf0]`, `[ảnh a18296e2]`; "Chia sẻ yêu cầu của tôi" cho các chuyên gia khác `[ảnh 2e32d1cb ✓]` (đưa dữ liệu của học sinh, có thể dưới 16 tuổi, ra ngoài).

### 4.3 Đặt lịch

- **Có mẫu.** Chia quyết định nhỏ: thời lượng → ngày → giờ → xác nhận, mỗi bước một câu hỏi `[ảnh 91b83e9d ✓]`.
- Hai thẻ chọn có mô tả ngắn (25 phút làm quen, 50 phút đầy đủ); nút "Tiếp tục" xám đến khi chọn `[ảnh 91b83e9d ✓]`, `[ảnh 8e8e7015]`.
- Dải ngày ngang, ngày chọn viền đậm; giờ nhóm "Buổi chiều", "Buổi tối", ghi múi giờ của người học `[ảnh 66e5b5d6 ✓]`.
- Lưới nút giờ 3 cột đều, to dễ chạm; giờ hết chỗ xám `[ảnh a3c40ef1]`.
- **Tránh:** chỉ phân biệt giờ hết chỗ bằng sắc độ xám, người kém thị lực khó thấy `[ảnh a3c40ef1]` → thêm chữ "Hết chỗ" **[suy luận]**; nhãn thứ tự xuống dòng lệch hàng `[ảnh 66e5b5d6 ✓]`.
- **Áp vào KiN:** chỉ giữ cấu trúc từng bước, không giữ "buổi thử có phí" hay thanh toán thẻ. Chính sách huỷ ghi rõ giờ ngay cạnh lịch (Preply "huỷ miễn phí đến 6:00", Wyzant 24 giờ) `[ảnh d2a216a5 ✓]`, `[ảnh 7d3bee55]`. KiN không bán buổi lẻ qua sàn; luồng học sinh đặt lịch với gia sư thực tế của KiN chưa có tài liệu trong 102 ảnh **[không có bằng chứng]**.

### 4.4 Thanh toán học phí

- **Bằng chứng yếu.** Chỉ có checkout của Preply (chuyển buổi thử, thẻ/Apple Pay/Google Pay) và cảnh báo thanh toán của Wyzant. Không có ảnh hoá đơn, lịch sử giao dịch hay QR chuyển khoản `[ảnh d2a216a5 ✓]`, `[ảnh 2e32d1cb ✓]`.
- **Dùng được cho trình bày:** tóm tắt đơn trong một thẻ riêng trước khi trả (gia sư, chi tiết buổi, bảng giá); **tổng tiền lặp lại ngay trong nút** "Đặt lịch học và thanh toán · 27,30 đô la"; câu "huỷ miễn phí đến…" ở chân thẻ lịch; ghi chú bảo mật gần nút `[ảnh d2a216a5 ✓]`.
- Câu trấn an "không bị tính phí cho đến khi bài học hoàn tất" `[ảnh 2e32d1cb ✓]`: KiN thu học phí theo tháng qua chuyển khoản, nên đừng chép câu này.
- **Tránh:** nhãn lẫn ngôn ngữ ("Choose thanh toán phương thức", tên gia sư dịch thành "Ân điển") `[ảnh d2a216a5 ✓]` (lỗi dịch của Chrome khi chụp, xem mục 6); hai cột trên điện thoại; khoảng trống lớn do form thẻ chưa tải `[ảnh d2a216a5 ✓]`.
- **Áp vào KiN:** màn học phí của học sinh/phụ huynh: tóm tắt phiếu (lớp, tháng, số tiền) → mã QR + nội dung chuyển khoản sao chép được → trạng thái bằng chữ; sau chuyển tự gạch nợ (đã có). Phần QR và sao chép **không có ảnh nguồn** **[không có bằng chứng]**. **Tuyệt đối không có nút mua hay nạp Coin cho học sinh**; Coin chỉ nhận thưởng khi làm bài.

### 4.5 Lớp của tôi

- **Có mẫu từ SH.** Ba pill lọc (Lớp của bạn / Lớp đang chờ / Lớp đã ẩn), ô tìm, ô sắp xếp, nút chính "+ Tìm lớp học" ở góc phải; nút đổi chế độ danh sách/thẻ `[ảnh b03b9eb4]`.
- Vào lớp bằng mã 5 ô gạch chân, nút xanh lá rộng, liên kết "Quay lại danh sách lớp" ngay dưới `[ảnh ef4f8038]`.
- Khối "Gia sư của tôi" với trạng thái rỗng + một nút cam "Tìm kiếm gia sư" `[ảnh 2e32d1cb ✓]`.
- **Tránh:** bảng nhiều cột số đếm trên điện thoại, đổi thành thẻ `[ảnh b03b9eb4]`; ô nhập mã rất nhỏ, vạch mỏng; nền xanh đặc choá mắt khi dùng lâu `[ảnh ef4f8038]`.
- **Áp vào KiN:** thẻ gọn: tên lớp, gia sư (Cô Lan), buổi kế tiếp, một nút "Vào lớp". Rỗng: "Bạn chưa vào lớp nào" + nhập mã mời `hoc-sinh-giao-dien-tu-anh-doi-thu.md` mục "Từng màn học sinh". Preply không có ảnh cho màn này **[không có bằng chứng]**.

### 4.6 Lịch học của học sinh

- Dải 7 ngày ngang, giờ khả dụng ngay dưới mỗi ngày, múi giờ tự nhận và đổi được `[ảnh 2c486c98]`, `[ảnh 66e5b5d6 ✓]`.
- "Các bài học đã lên lịch": khi rỗng ghi "Hiện không có buổi học nào sắp tới" + liên kết `[ảnh 2e32d1cb ✓]`.
- Lịch tháng chỉ đọc của phụ huynh, chip buổi có giờ và tên em `[ảnh 48daa960]`.
- **Tránh:** cột ngày hẹp khó chạm `[ảnh 2c486c98]`, accordion lỗi chữ chồng nhau `[ảnh 2c486c98]`. Shub có tab "Lịch học" nhưng bị nút nổi che nên không có ảnh màn lịch `[ảnh 11a4cd13 ✓]`.

### 4.7 Bài tập và thi (gần như không có bằng chứng)

- **[không có bằng chứng]** về phòng thi, làm bài, chữa bài, bài tập trực tuyến trong cả 102 ảnh.
- Mẫu nhỏ có thể mượn: bảng "Bài tập chưa nộp" ba cột Tên bài tập / Lớp / Hạn chót `[ảnh 11a4cd13 ✓]`; bảng "Thành tích" ba cột Tên lớp / Giáo viên / ĐTB với trạng thái rỗng `[ảnh 0b5e59f8]`; bài kiểm tra đầu vào miễn phí 10 phút, một nút `[ảnh f6259336]`.
- Còn lại là tự thiết kế, bám phòng thi hiện có của KiN: danh sách theo hạn nộp, mỗi dòng một trạng thái bằng chữ (Chưa làm, Đã nộp, Chờ chấm) `hoc-sinh-giao-dien-tu-anh-doi-thu.md`. Không có nội dung cờ bạc; không đẩy Coin thành thứ để mua.

### 4.8 Điều chung rút ra cho học sinh

1. Một hành động chính mỗi màn, nút tương phản cao `[ảnh 6508f5f6]`, `[ảnh 45d3102f]`.
2. Hỏi một câu rồi lọc; hiện số kết quả `[ảnh 45d3102f]`.
3. Trạng thái rỗng một câu, một nút `[ảnh 2e32d1cb ✓]`, `[ảnh 11a4cd13 ✓]`.
4. Giá và rủi ro nói thẳng gần nút `[ảnh d2a216a5 ✓]`.
5. Tránh tiêu đề khổng lồ (8 dòng trên màn hẹp) `[ảnh 6508f5f6]`, khoảng trắng lớn do ảnh chưa tải `[ảnh b6c77e03]`.

## 5. Ma trận màn × sản phẩm

### 5.1 Bảng phủ nhanh (ảnh nào thuộc màn nào)

| Màn | SGS | TB | TW | TnG/TC | SH | PR | SP | WY |
|---|---|---|---|---|---|---|---|---|
| Trang chủ gia sư | có | có | có | chỉ landing | (phía học sinh) | — | — | — |
| Lịch | có | có | có | — | — | (chọn ngày) | — | (lịch rảnh) |
| Lớp | có | — | — | — | có | — | — | — |
| Học phí | có | có | có | — | — | — | — | — |
| Điểm danh / buổi | có | có | một widget | — | — | — | — | — |
| Học sinh (hồ sơ) | có | có | có | — | — | — | — | — |
| Cài đặt | có | — | một màn | — | — | — | — | — |
| Phiếu thu | có | có (hoá đơn) | có (hoá đơn) | — | — | — | — | — |
| Báo cáo phụ huynh | có | — | — | — | — | — | — | — |
| Trang chủ học sinh | — | — | — | — | có | một phần | một phần | có |
| Tìm gia sư | — | — | — | — | — | có | có | có |
| Đặt lịch | — | — | — | — | — | có | — | — |
| Thanh toán | — | — | — | — | — | có | — | cảnh báo |
| Lớp của tôi | — | — | — | — | có | — | — | một khối |
| Bài tập / thi | — | — | — | — | có (bảng) | bài test đầu | — | — |

### 5.2 Từng ô một câu (kèm tệp ảnh)

**Trang chủ gia sư**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Lời chào theo buổi, thẻ "Buổi chưa hoàn thành" rỗng ngang cả hàng, 3 thẻ số, 2 thẻ tiền có icon mắt, Lịch hôm nay và sắp tới ở cuối | 9eca7149 ✓ |
| TB | Lời chào + 5 thẻ KPI icon tròn + "Chương trình nghị sự" theo ngày có nút Hôm nay, banner Hướng dẫn | 2b427782; menu 13 mục: e5604abf |
| TW | Thanh 8 bước thiết lập, widget "Giờ theo trạng thái", lưới thống kê 3×2, bảng Hoá đơn quá hạn có câu rỗng | b8b4e041, 99ed171b |
| TnG | Chỉ trang quảng cáo; không có màn quản lý | d45ee8dd, 7f7789cb, 8beb18cd |
| TC | Chỉ trang quảng cáo, popup Bobbin; không có màn quản lý | 743415a9, 03323670, 81d0fc02 |
| SH | (Phía học sinh) 5 khối "hôm nay có gì" với trạng thái rỗng có minh hoạ | 11a4cd13 ✓, 0b5e59f8 |

**Lịch**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Lưới tuần 07:00–22:00, 3 ngày/Tuần/Tháng, vạch đỏ giờ hiện tại, khối theo màu lớp | 50852205 |
| TB | Lưới tháng 7 cột, menu Thêm sự kiện 3 loại, ngăn trượt thêm bài học, popover sự kiện có nút Điểm danh | d9a48bb8, 7b441e2f, 189297bf, 190a8682 |
| TW | Lịch tháng Hôm nay/Tháng/Tuần/Ngày, form thêm buổi có nút Kiểm tra xung đột, giờ 12h | 313a202f, 02ac0797, 8a3fc5b1 |
| PR | Dải ngày ngang, giờ nhóm Buổi chiều/Buổi tối, lưới nút giờ 3 cột (khi đặt lịch) | 66e5b5d6 ✓, a3c40ef1; lịch rảnh tuần: 2c486c98 |
| WY | Lịch rảnh theo thứ dạng chuỗi giờ dài | c4ad5abc |

**Lớp**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Wizard 3 bước, chi tiết lớp hai cột, vùng nguy hiểm, hộp sửa lớp, danh sách lớp trống | 139b0933, a7c792e5, 2a572826, cdbd1f37, 74c5c1e7, 486587a8, 6b52ce72, d69ebba7 |
| SH | Pill lọc lớp + ô tìm; nhập mã lớp 5 ô | b03b9eb4, ef4f8038 |

**Học phí**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Hai tab, dải tổng, thẻ theo học sinh, hộp phiếu, xuất hàng loạt, lịch sử thu, hoàn tác, phân tích | 22608da4 ✓, 1ceeb24f, 5d3fea9a, c740944e, 510dc007, ad91d1bd, a6b8f794 |
| TB | Tab Tài khoản gia đình/Hoá đơn/Giao dịch, sổ cái, hoá đơn 2 bước, gói buổi trống | 686b1125, fa04f891, 26fe8fc3, b04b188c, d4a5e8d5 |
| TW | Hoá đơn dạng bảng dòng, tạo nhiều hoá đơn, bảng Hoá đơn quá hạn | 6c1629f4, e89f8796, 99ed171b |

**Điểm danh và buổi học**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Màn buổi học: 3 nút, 3 số, chip BTVN/điểm, 4 ô ghi chú; lưới điểm danh tháng; toast xuất ảnh | ecaca8dc, ede79870, c35687c2 |
| TB | Ngăn điểm danh 3 tab, dropdown 8 trạng thái có dòng phụ, chip người xem ghi chú, tỷ lệ tham dự 90 ngày | ace26321, 8eac9e56, f7493a14, fbbf914c |
| TW | Widget "Giờ theo trạng thái" (Attended, Cancelled, Missed, Scheduled) | b8b4e041 |

**Học sinh**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Danh sách trống có ô tìm; chi tiết có thẻ nợ cam, lớp đang học, vùng nguy hiểm | 1c5d46fe, b1ba0bf8 |
| TB | Bảng 8 cột; hồ sơ 6 tab, cảnh báo vàng thiếu email | 32187a31, 1cd39a2b |
| TW | Form học sinh rất dài nhiều tab | ef8b370b, 017e218f |

**Cài đặt**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Hồ sơ + ngân hàng QR; kết nối Google; gói và thanh toán; quản lý tệp | faecc690, 02db8767, fe51ab8d, b2a06099, 6f57ab79 |
| TW | Màn tích hợp và tiện ích bổ sung (80, 0 bật) | 4635ee4c |

**Phiếu thu**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Hộp phiếu, xem trước, xuất hàng loạt, ảnh PNG báo cáo buổi | 1ceeb24f, 5d3fea9a, c0670eec |
| TB | Hoá đơn 2 bước, kiểu hiển thị kèm xem trước | 26fe8fc3, b04b188c |
| TW | Hoá đơn một khách, bảng dòng dịch vụ, mã tự điền | 6c1629f4 |

**Báo cáo phụ huynh**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SGS | Trang công khai: thẻ học sinh, lịch tháng, chân trang; ảnh PNG buổi; toast | 48daa960, c0670eec, c35687c2 |

**Trang chủ học sinh**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SH | Khối theo câu hỏi, menu dọc có dấu tích | 11a4cd13 ✓, 0b5e59f8 |
| WY | Banner vàng, khối Bài học, khối Gia sư của tôi, trạng thái rỗng + nút cam | 2e32d1cb ✓ |
| SP | Một ô tìm kiếm, chip môn, lưới thẻ gia sư | 677d8596 |
| PR | Thanh đầu gọn với icon; hero một nút; hỏi "Bạn muốn học gì?" | e8a12f59, 8b45d113, 6508f5f6 |

**Tìm gia sư**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| PR | Cổng một lựa chọn rồi lọc, hồ sơ có thẻ giá + CTA, điểm 4 tiêu chí | 45d3102f, d0c3caf0, a18296e2, 2c486c98, 7e6838a0 |
| SP | Thẻ gia sư ảnh lớn, giá, buổi học miễn phí, thẻ nhận xét | 677d8596, 6868dd90, 75694603, 51ba6191 |
| WY | Hồ sơ có giờ đã dạy, thời gian phản hồi, phân bố sao, "Hỏi trước khi đặt" | 7d3bee55, c4ad5abc, 813fb225, 41e5a9f7 |

**Đặt lịch**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| PR | Modal từng bước: thời lượng, ngày, giờ | 91b83e9d ✓, 8e8e7015, 66e5b5d6 ✓, a3c40ef1 |

**Thanh toán**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| PR | Tóm tắt đơn, tổng tiền lặp trong nút, phương thức, ghi chú an toàn | d2a216a5 ✓ |
| WY | Banner vàng nhắc thêm thanh toán, câu "không bị tính phí…" | 2e32d1cb ✓ |

**Lớp của tôi**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SH | Danh sách lớp có pill, nhập mã lớp | b03b9eb4, ef4f8038 |
| WY | Khối "Gia sư của tôi" rỗng + nút | 2e32d1cb ✓ |

**Bài tập / thi**

| Sản phẩm | Nội dung | Ảnh |
|---|---|---|
| SH | Bảng Bài tập chưa nộp; bảng Thành tích | 11a4cd13 ✓, 0b5e59f8 |
| PR | Bài kiểm tra trình độ miễn phí 10 phút | f6259336 |

**Ảnh không thuộc màn nào hữu ích** (trắng, cookie, chân trang): 16f2f44f, e39e7900, 584aa961, 47bb2132, 8beb18cd, b46ef1fe, 56c9b4f4, 51ba6191, aae3f5a3. Trang quảng cáo Teachworks (6ad987a7, 340c3a06, 3bf3057e, ed0c4c09) và ngăn "Tạo báo cáo" của TutorBird (d4e7678c) không có bài học giao diện cho điện thoại; báo cáo kinh doanh không phù hợp gia sư mới giai đoạn đầu.

## 6. Điều cần tránh, mâu thuẫn và điều chưa kiểm chứng

### 6.1 Điều phải tránh khi thiết kế (quy tắc cứng của dự án)

| Điều tránh | Vì sao | Nguồn |
|---|---|---|
| Màn mua hoặc nạp Coin cho học sinh | Coin chỉ nhận thưởng khi làm bài | `BRIEF.md`, `[MH-05 mục P1]` |
| Thanh toán thẻ, Apple Pay, phí xử lý, hoa hồng, buổi thử có phí | KiN thu học phí theo tháng qua chuyển khoản, không giữ tiền, không hoa hồng | `[ảnh d2a216a5 ✓]`, `[BC §5.1 d.541]`, `[MH-04 d.15]` |
| Thu thêm dữ liệu cá nhân của học sinh (ngày sinh, trường, địa chỉ, ảnh) | Có thể dưới 16 tuổi | `[ảnh 017e218f]`, `BRIEF.md` |
| Chia sẻ yêu cầu học sinh ra nhiều gia sư | Dữ liệu của trẻ rời hệ thống | `[ảnh 2e32d1cb ✓]` |
| Đánh giá công khai có avatar và tên học sinh | Như trên | `[ảnh d0c3caf0]`, `[ảnh a18296e2]` |
| Nội dung cờ bạc | Quy tắc cứng | `BRIEF.md` |
| Mã hex trong thiết kế | Chỉ dùng `--kin-*` | `src/app/kin-tokens.css` |
| Cam cho "Offline", "Có phép", nhãn Pro | Cam của KiN là "chờ/còn nợ" | `[BC §3.2 d.133]` |
| Banner khuyến mãi mọi trang, bảng giá, mã giảm giá trong màn làm việc | Nhiễu | `[ảnh 9eca7149 ✓]`, `[BC §3.5 d.309]` |
| Toast hay thông báo có tên em hoặc số tiền | Quy tắc cứng; chi tiết sau link | `[KH d.117]`, `[MH-02 d.154]` |
| Trạng thái chỉ phân biệt bằng màu, chữ "K", "P" | Luôn kèm chữ | `[ảnh ede79870]`, `[ảnh a3c40ef1]` |
| Nút nhỏ hơn 44px, chữ bị cắt "…", lưới nhiều cột | Điện thoại là chính | các ảnh đã dẫn ở mục 3 |

### 6.2 Mâu thuẫn giữa các nguồn

1. **Số mẫu phiếu:** báo cáo ghi 9 mẫu (4 Free, 5 Pro) `[BC d.34]`, liệt kê tên đến 10 `[BC §3.3.9 d.221]`; ảnh chỉ cho thấy 3 ô nhỏ `[ảnh 1ceeb24f]`. Đừng trích số mẫu.
2. **Số ảnh theo sản phẩm:** bảng 2.2 của báo cáo ghi Preply 8, Wyzant 2, Shub 3 ảnh `[BC §2.2 d.70-72]`; thực tế có Preply 19, Wyzant 5, Shub 4, Superprof 4 trong tệp. Không dùng bảng 2.2 để đếm.
3. **Phụ huynh có thấy học phí không:** SGS không `[BC §3.3.12 d.253]`; chính báo cáo đề xuất thêm `[BC §8.4 d.723]`; KiN đã có phiếu trong Sổ của con `[PH d.36]`.
4. **Tiền và điểm danh:** SGS ràng chặt, KiN tách `[QD d.103]`; mọi lời khuyên về nhãn "tính phí" trong báo cáo (điểm nghẽn #1, #5) cần đọc lại theo KiN.
5. **"Đối soát chuyển khoản":** báo cáo coi là khoảng trống và "sắp có" `[BC §7 d.619]`; KiN đã có SePay `[KH d.46]`, nên giả định "chưa có đối tác ngân hàng" đã lỗi thời `[KH d.46]`.
6. **Mục 8 của báo cáo viết cho một sản phẩm giả định đang đuổi kịp SGS**, không phải KiN `[BC d.5]`; chỉ lấy khi đã đối chiếu `[KH §2 d.41-55]` và mục 6.
7. **Hai bản nháp cũ chia việc theo ảnh:** `gia-su-giao-dien-tu-102-anh.md` chỉ xem ảnh SGS, TB, TW, TnG/TC/Shub và ghi "không xem 28 ảnh sàn"; `hoc-sinh-giao-dien-tu-anh-doi-thu.md` xem 28 ảnh sàn (Preply 19 gồm 3 ảnh trắng, Superprof 4, Wyzant 5) cộng 4 ảnh Shub. Bản này gộp cả hai, và đối chiếu lại bằng 6 ảnh tôi tự mở; nên đọc cả ba cùng nhau, không coi bản nào là đủ.
8. **Thứ tự trang chủ:** xem 3.1, chờ chủ dự án chọn.

### 6.3 Giới hạn của bằng chứng ảnh

- **Không ảnh nào là điện thoại dọc của sản phẩm gia sư.** Ảnh SGS, TB, TW đều ở bản rộng 1040px; Preply "bản hẹp giống tablet" `[ảnh 6508f5f6]`. Mọi kết luận cho điện thoại (dải 7 ngày, thẻ một cột, nút dính đáy) là **[suy luận]** từ bản rộng, ghi rõ ở từng chỗ.
- **Ảnh SGS, PR, WY dựng lại từ DOM bằng html2canvas** `[BC d.21]`: viền hồng nhạt quanh ảnh, thẻ nằm lệch (ví dụ `[ảnh 22608da4 ✓]`), font serif ở biểu đồ `[ảnh ad91d1bd]` có thể do công cụ dựng, không do hãng. Không coi là lỗi thiết kế của hãng nếu chưa có nguồn thứ hai.
- **Bản dịch của Chrome**: các nhãn "Mặt trời", "Ân điển", "Choose thanh toán phương thức", "Sinh viên" lẫn "Học sinh" là lỗi dịch khi chụp, không phải chữ gốc `[ảnh d9a48bb8]`, `[ảnh d2a216a5 ✓]`. Không chép chữ.
- **TnG và TC** chỉ là trang quảng cáo, nhiều ảnh gần trống hoặc phủ tối; **không có** màn quản lý lớp, lịch, học phí của hai hãng này `[ảnh d45ee8dd]`, `[ảnh 743415a9]`, `[ảnh 0332367079]`.
- **Shub** là màn học sinh của LMS trường học; phía giáo viên lấy từ hướng dẫn ĐH Cần Thơ và báo chí `[BC §4.8 d.509]`, độ tin cậy thấp hơn.
- **Dữ liệu trong ảnh là dữ liệu thử** ("Lớp TEST Claude - xoá sau", "Học sinh TEST A", 200.000đ, tên và avatar của tài khoản thật như "Nguyen", "Thanh"): không đưa vào thiết kế. Dùng dữ liệu mẫu của KiN (Cô Lan, Trần Gia Bảo…).
- **Chưa kiểm chứng** (báo cáo tự ghi `[BC Phụ lục B d.831-855]`): hành vi "Theo khoá học" và "Theo giờ", **nội dung QR thật**, hiển thị SGS trên điện thoại dọc, đồng bộ Google Calendar thực tế, email khi hết dùng thử. Số liệu quy mô của các hãng là tự công bố.

## 7. Danh mục ảnh quan trọng theo màn

Các ảnh đã chọn lọc sẵn trong `goi-gui-claude-design/anh-tham-khao-so-gia-su/` (đối chiếu bằng mã băm với tệp gốc): `01-trang-chu.jpg` = 9eca7149; `02-lich-tuan.jpg` = 50852205; `03-chi-tiet-lop.jpg` = 486587a8; `04-hoc-phi-chua-thu.jpg` = 22608da4; `05-phieu-hoc-phi.jpg` = 1ceeb24f; `06-tao-lop-buoc-1.jpg` = 139b0933; `07-chi-tiet-buoi-hoc.jpg` = ecaca8dc; `08-hoc-sinh.jpg` = 1c5d46fe. Ảnh hiện trạng KiN nằm ở `anh-hien-trang/` (6 ảnh, không thuộc 102 ảnh). 94 ảnh còn lại chỉ có trong media của báo cáo gốc `.docx`; bản giải nén tạm đang ở `/tmp/rs/x/word/media/` (có thể mất khi khởi động lại máy).

| Màn | Ảnh nên mở trước | Vì sao |
|---|---|---|
| Trang chủ gia sư | 9eca7149 ✓ (có sẵn: `01-trang-chu.jpg`), 2b427782, b8b4e041, 11a4cd13 ✓ | Thẻ một số; KPI + hôm nay; chỗ tránh; khối "hôm nay có gì" |
| Lịch | 50852205 (`02-lich-tuan.jpg`), 66e5b5d6 ✓, 313a202f, 190a8682 | Chế độ xem, dải ngày, nút Hôm nay mờ, popover |
| Lớp | 486587a8 (`03-chi-tiet-lop.jpg`), 139b0933 (`06-tao-lop-buoc-1.jpg`), cdbd1f37, b03b9eb4, ef4f8038 | Chi tiết lớp, wizard, pill lọc, mã lớp |
| Học phí | 22608da4 ✓ (`04-hoc-phi-chua-thu.jpg`), c740944e, 510dc007, fa04f891, ad91d1bd, a6b8f794 | Thẻ theo học sinh; lịch sử; hoàn tác (hành vi); câu "còn nợ"; giải thích cách tính |
| Điểm danh | ecaca8dc (`07-chi-tiet-buoi-hoc.jpg`), 8eac9e56, ede79870, fbbf914c | 3 nút; hệ quả bằng chữ; lưới tháng (tránh); tỷ lệ tham dự |
| Học sinh | 1c5d46fe (`08-hoc-sinh.jpg`), b1ba0bf8, 1cd39a2b | Danh sách; hồ sơ; cảnh báo tại chỗ |
| Cài đặt | faecc690, 02db8767, 4635ee4c | Ngân hàng QR; trạng thái cấp quyền; ví dụ nhiều lớp (tránh) |
| Phiếu thu | 1ceeb24f (`05-phieu-hoc-phi.jpg`), c0670eec, 5d3fea9a | Xem trước; ảnh gửi Zalo; xuất hàng loạt |
| Báo cáo phụ huynh | 48daa960, c0670eec, c35687c2 | Trang công khai; PNG; toast |
| Trang chủ học sinh | 11a4cd13 ✓, 2e32d1cb ✓, 677d8596, e8a12f59 | Khối rỗng; banner vàng; ô tìm; thanh đầu |
| Tìm gia sư | 45d3102f, 677d8596, d0c3caf0, a18296e2, 7d3bee55, c4ad5abc | Cổng một lựa chọn; thẻ; hồ sơ; tiêu chí; phân bố sao |
| Đặt lịch | 91b83e9d ✓, 66e5b5d6 ✓, a3c40ef1 | Hai thẻ chọn; ngày; lưới giờ |
| Thanh toán | d2a216a5 ✓, 2e32d1cb ✓ | Tóm tắt đơn; tổng trong nút; câu trấn an |
| Lớp của tôi | b03b9eb4, ef4f8038 | Pill + ô mã |
| Bài tập / thi | 11a4cd13 ✓, 0b5e59f8, f6259336 | Chỉ ba mẫu nhỏ; còn lại tự thiết kế |

Bốn nơi cần theo dõi khi dựng bằng Claude Design hoặc Figma: (1) thứ tự trang chủ trên điện thoại (mục 3.1); (2) nhãn điểm danh không mang nghĩa tiền (3.5); (3) khung QR không có ảnh nguồn (3.8, 4.4); (4) mọi hành vi tiền ở Học phí (3.4) chờ chủ dự án quyết.
