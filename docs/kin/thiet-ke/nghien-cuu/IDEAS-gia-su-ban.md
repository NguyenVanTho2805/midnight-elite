# Ý tưởng giao diện KiN — góc nhìn "gia sư rón dùng điện thoại giữa hai buổi dạy"

Soạn 22/10/2026. Tài liệu ý tưởng, không sửa mã. Mục tiêu chung: **thoáng hơn, không thêm dòng, không thêm khung**; mọi ý tưởng đều bớt đi hoặc gộp lại một thứ.

## 0. Cách đọc

**Góc nhìn.** Gia sư (Cô Lan) vừa xong một buổi, có 5 đến 10 phút nghỉ, một tay cầm điện thoại, ngón cái ở nửa dưới màn hình. Cô cần: biết ngay việc gì gấp, bấm một lần là xử lý xong, không phải đọc. Học sinh (Trần Gia Bảo) cũng cầm một tay, giữa giờ học, cần biết "tiếp theo là gì" trong 2 giây.

**Bốn phép thử cho mỗi ý tưởng:**
1. Một tay, ngón cái với tới được (nút chính ở nửa dưới, cao ít nhất 44px).
2. Liếc 2 giây thấy việc chính, không cuộn.
3. Ít chạm: không quá hai lần bấm cho việc thường làm.
4. Bớt thay vì thêm: sau khi làm, màn có ít khung, ít dòng, ít nút hơn trước.

**Nguồn.** `[RS §x]` là mục trong `RESEARCH-TONG-HOP.md`; `[MH-0N §x]` là mục trong đặc tả `man-hinh/0N-*.md` (số trong ngoặc là điểm "chưa tốt" của mục 9 đặc tả); `[ảnh xxxxxxxx]` là ảnh trong 102 ảnh (theo quy ước của RS); `[suy luận]` là điều tôi suy ra, không có ảnh hay mã chứng minh. Lưu ý chung đã ghi ở RS §6.3: không ảnh nào là điện thoại dọc của sản phẩm gia sư, nên mọi bố cục điện thoại dưới đây là suy luận từ bản rộng.

**Độ khó.** Dễ: đổi chữ hay xếp lại bố cục, vài giờ. Vừa: đổi thành phần, vài ngày. Khó: đổi luồng hoặc cần dữ liệu mới.

**Rủi ro tiền / trẻ em.** Mỗi ý tưởng ghi rõ. Ý tưởng dính tiền hoặc dữ liệu trẻ em đánh dấu **LOẠI** (không làm vòng này, chỉ ghi lại để không ai đề xuất lại). Riêng màn Học phí: chỉ đổi cách trình bày, không đổi cách tính phiếu hay đối soát `[MH-04 §8]`.

**Dữ liệu mẫu dùng thống nhất.** Cô Lan; 7 lớp (Toán 9, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9, Toán 8); 8 học viên; đã thu tháng 10: 480.000đ; còn lại: 560.000đ; phiếu Đỗ Hà 560.000đ (nháp), Trần Gia Bảo 480.000đ (đã đóng); buổi Thứ Sáu 23/10 19:00–20:30 Toán 9 (2 học viên), Thứ Bảy 24/10 16:00–17:30 Văn 8; việc cần làm: 2 yêu cầu xác nhận của phụ huynh, 1 báo nghỉ sát giờ, 1 khoản cần đối soát, 4 buổi chưa điểm danh.

**Mã ý tưởng.** TQ (tổng quan gia sư), LI (lịch), LO (lớp), HP (học phí), HT (học sinh trang chủ), HL (học sinh lịch), HK (học sinh lớp), HB (học sinh bài tập và thi). Số cuối là thứ tự, P1 làm trước.

---

## 1. Tổng quan gia sư (trang chủ)

Hiện trạng: hai màn Tổng quan và Hộp việc làm cùng một việc nhưng chữ và thứ tự khác nhau; con số tiền không ở nơi nhìn đầu tiên; danh sách lớp 7 lớp × 3 liên kết dài `[MH-01 §9 điểm 1, 2, 13]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| TQ-1 | P1 | **Một khối "Việc cần làm" lên đầu, tự biến mất khi bằng 0** | Cô Lan mở app giữa hai buổi phải đoán việc gấp ở đâu; màn hiện nhiều thẻ số đứng trước | Dưới lời chào một dòng là tối đa 3 dòng việc, mỗi dòng một câu và một chữ trạng thái: "2 yêu cầu chờ phụ huynh xác nhận · Cần xử lý", "1 báo nghỉ sát giờ · Cần xử lý", "1 khoản tiền vào cần đối soát · Chờ bạn", còn dòng "Xem tất cả 8 việc" (4 buổi chưa điểm danh nằm trong đó). Cả dòng là vùng chạm 50px. Khi cả bốn bằng 0: một dòng xanh "Không có việc cần làm", không dựng thẻ rỗng | SGS đặt việc chưa xong làm nhắc nhở duy nhất nhưng thẻ rỗng vẫn chiếm cả hàng `[ảnh 9eca7149]`; Shub dùng câu rỗng một dòng `[ảnh 11a4cd13]`; `[RS §3.1]`; `[MH-01 §4.1 vùng 3]` | Dễ | Không. Thông báo ngoài không chứa tên em hay số tiền; chi tiết nằm sau liên kết `[RS §6.1]` |
| TQ-2 | P1 | **"Hôm nay" thành một thẻ buổi kế tiếp, bỏ hai trong ba con số** | Màn đầu có 3 số, 3 buổi sắp tới, 4 lớp, lối tắt: hơn một màn cuộn; buổi muộn còn hiện hai lần `[MH-01 §9 điểm 3]` | Chỉ một thẻ lớn: "Thứ Sáu 23/10 · 19:00–20:30 · Toán 9 · 2 học viên" và nút đặc "Vào lớp". Nếu hôm nay có nhiều buổi, thẻ là buổi gần nhất, dưới là dòng chữ "Còn 1 buổi nữa hôm nay". Bỏ "Học viên đang học" và "Lớp đang dạy" khỏi màn đầu (đã có ở tab Lớp). Giữ đúng một số tiền: "Đã thu tháng này 480.000đ" xanh lá | Thấy "hôm nay có gì" trước số liệu là thói quen của người dùng `[ảnh 2b427782]`; số tiền đã thu là mục duy nhất người dùng muốn nhìn `[MH-01 §3.A]`; thứ tự "chờ chủ dự án chọn" ở `[RS §3.1]`, ý tưởng này chọn việc → hôm nay → tiền **[suy luận]** | Dễ | Hiển thị số đã thu sẵn có, không đổi cách tính |
| TQ-3 | P2 | **Icon mắt ẩn số tiền** | Gia sư mở app trước mặt phụ huynh, số tiền hiện sẵn | Một icon mắt (vùng chạm 44px) cạnh số "480.000đ"; bấm để thay bằng "••••••". Nhớ lựa chọn trên máy | SGS có đúng mẫu này `[ảnh 9eca7149]`, `[RS §3.1]` | Dễ | Chỉ ẩn hiển thị, không đổi dữ liệu |
| TQ-4 | P2 | **Danh sách lớp: một dòng mỗi lớp, tối đa 3 lớp** | 7 lớp × tên + dòng phụ + 3 liên kết 44px chiếm gần hết màn `[MH-01 §9 điểm 13]` | Mỗi lớp một dòng: chấm trạng thái + "Toán 9 · 2 học viên"; cả dòng chạm để mở lớp. Hiện 3 lớp có buổi gần nhất, cuối là "Xem cả 7 lớp". Bỏ ba liên kết "Mở lớp / Điểm danh / Danh sách HS" khỏi trang chủ (điểm danh đi từ thẻ buổi) | Đầu chi tiết lớp SGS dùng chấm màu + tên + chip thay đoạn văn `[ảnh 486587a8]`; `[RS §3.3]` | Dễ | Không |
| TQ-5 | P2 | **Gộp "Lối tắt" vào menu Khác** | Hàng chữ nhỏ 6 lối tắt ở đáy trang, nhỏ hơn 44px, ít ai bấm | Bỏ hẳn hàng lối tắt khỏi trang chủ; Học phí, Báo cáo tháng, Doanh thu nằm trong "Khác" (đã có). Trang chủ kết thúc ở danh sách lớp | Menu 13 mục của TB là bài học tránh `[ảnh e5604abf]`; KiN đã có ẩn mục chưa dùng `[RS §3.1]` | Dễ | Không |
| TQ-6 | P2 | **Một ngôn ngữ cho Tổng quan và Hộp việc** | Cùng dữ liệu nhưng chữ, thứ tự, đích bấm khác nhau | Tổng quan dùng đúng câu của Hộp việc (số đứng trước, kèm chữ trạng thái), bấm vào đúng lớp, đúng ngày điểm danh. Màn "Xem tất cả" là Hộp việc nguyên vẹn | `[MH-01 §4.0, §9 điểm 1]`. **Cảnh báo:** 7 kiểm tra `ui-tutor-dash` đòi "nhãn rồi số", phải quyết cùng chủ dự án trước | Vừa | Không |
| TQ-7 | P3 | **Lỗi tải có "Thử lại" và khung xương khớp** | Lỗi lần đầu để màn "Đang tải…" mãi; khung xương là bố cục cũ `[MH-01 §9 điểm 10, 11]` | Dải lỗi một dòng + nút "Thử lại" 44px; khung xương đúng 3 vùng (lời chào, việc, hôm nay) | Gia sư mới nhận lỗi không biết app có hỏng không **[suy luận]** | Dễ | Không |
| TQ-8 | P3 | **Gia sư mới: một việc, một nút** | Gia sư chưa có lớp thấy khung trống nhiều vùng | Chỉ một câu "Bạn chưa có lớp nào" và nút đặc "Tạo lớp đầu tiên"; không thanh 8 bước | TW dùng thanh 8 bước, quá nặng `[ảnh b8b4e041]`; `[RS §3.1]` | Dễ | Không |

---

## 2. Lịch gia sư

Hiện trạng: dải 7 ngày đã có trong mã; mỗi buổi là thẻ viền, mở ra là chồng 5 khối, ba huy hiệu xếp cột bên phải; danh sách luôn bắt đầu từ Thứ Hai `[MH-02 §9]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| LI-1 | P1 | **Mở lịch tại hôm nay** | Vào giữa tuần, các buổi đầu tuần đã qua nằm trên cùng, buổi hôm nay ở xa dưới `[MH-02 §9 điểm 19]` | Khi tải, tự cuộn tới tiêu đề hôm nay (Thứ Sáu 23/10); buổi đã qua của tuần gập lại thành một dòng "2 buổi đã qua" | Màn này trả lời "hôm nay tôi dạy gì" `[MH-02 §2]`; nút Hôm nay mờ khi đang ở hôm nay `[ảnh 313a202f]` | Dễ | Không |
| LI-2 | P1 | **Dải 7 ngày dính đầu màn, ngón cái chạm được** | Chuyển ngày phải cuộn lên xa tay | Dải T2…CN dính trên cùng khi cuộn, ô cao 44px, hôm nay tô đặc, ngày có buổi có chấm; đổi tuần bằng "← Tuần trước · Tuần này · Tuần sau →" (giữ nguyên chữ). Ô ngày chỉ có buổi huỷ vẫn bấm được và có chấm | Dải 7 chip ngày ngang là mẫu của sàn `[ảnh 66e5b5d6]`; SGS có nhóm 3 ngày / Tuần / Tháng `[ảnh 50852205]`; giữ lưới 7 cột × 16 giờ là điều tránh `[RS §3.2]` | Dễ | Không |
| LI-3 | P1 | **Thẻ buổi một dòng, một chip chính** | Ba huy hiệu xếp cột ("Đã dời", "1 báo nghỉ sát giờ", "2 tin nhắc chờ gửi") làm thẻ cao và ép tên lớp `[MH-02 §9 điểm 2]` | Thẻ: vạch lớp mỏng + giờ đậm "19:00–20:30" + "Toán 9 · 2 học viên" + đúng một chip chữ theo thứ tự ưu tiên (Cần xử lý > Đã dời > Sắp tới > Đã kết thúc). Các việc còn lại thành chữ "+2 việc" bên trong chi tiết. Bỏ viền lồng trong thẻ | Thẻ buổi có vạch màu bên trái, giờ in đậm `[ảnh 2b427782]`; chip trạng thái bằng chữ, không dùng icon một mình `[ảnh 50852205]` | Dễ | Không |
| LI-4 | P1 | **Chi tiết buổi là tờ trượt đáy, một nút đặc theo trạng thái** | Chi tiết là chồng 5 khối; việc gấp nằm sau hai dòng tiện ích `[MH-02 §9 điểm 6]` | Tờ trượt từ đáy: dòng 1 là việc gấp nhất (báo nghỉ chờ xử lý hoặc "Điểm danh"), nút đặc rộng ở đáy trong vùng ngón cái; "Dời / Huỷ", "Soạn kế hoạch", "Link vào lớp" là liên kết chữ phía dưới. Mở một khối mỗi lần | Popover có hàng icon nhỏ ở trên và một nút Điểm danh rộng đáy thẻ `[ảnh 190a8682]` | Vừa | Không |
| LI-5 | P2 | **Nhắc lịch: một nút cho cả lớp thay cho 12 nút giống nhau** | Một em có 4 dòng nhắc; 3 em là 12 nút "Soạn & mở Zalo" cùng nhãn `[MH-02 §9 điểm 5]` | Một nút đặc "Nhắc cả lớp qua Zalo"; bên dưới danh sách em thu gọn, mỗi em một dòng "Đỗ Hà · chưa nhắc" (mở rộng mới thấy 24 giờ / 1 giờ). Giữ chữ "KiN không gửi giúp" và chỉ ghi "Đã mở Zalo lúc…" | Zalo bán tự động đã chốt `[KH d.45]` (qua RS §2.3) | Vừa | Không dính tiền. Tin nhắn ra ngoài không chứa tên em hay số tiền, chi tiết nằm sau link `[RS §3.9]`. Chỉ dùng dữ liệu đã có, không thu thêm của trẻ |
| LI-6 | P2 | **Mọi hộp thoại có ✕ 44px, Đóng cố định ở đáy, một chữ "Sao chép"** | Hộp không có ✕; trên điện thoại ít ai biết bấm nền; "Sao chép" và "Chép tin" lẫn nhau `[MH-02 §9 điểm 14, 15]` | Tờ trượt có thanh nắm kéo, nút ✕ ở góc trên, nút "Đóng" ở chân; thống nhất "Sao chép" (sửa một dòng test của hộp lịch tuần) | Hộp sửa có chân cố định chứa Huỷ và Cập nhật `[ảnh 6b52ce72]` | Dễ | Không |
| LI-7 | P3 | **Vạch lớp chỉ là trang trí, hôm nay không dùng đỏ** | Màu lớp trùng màu nghĩa (xanh lá, cam) và hai token cùng mã `[MH-02 §9 điểm 8]` | Tên lớp luôn bằng chữ; vạch mỏng 3px; hôm nay tô token xanh dương; cam và xanh lá chỉ cho trạng thái | SGS dùng dấu tích và đồng hồ không chữ `[ảnh 50852205]`, `[RS §3.2]` | Dễ | Không |
| LI-8 | P2 | **Báo nghỉ sát giờ: hai lựa chọn thành hai thẻ có hệ quả bằng chữ** | Hai nút "Không tính phí, giữ 1 buổi bù" / "Tính phí buổi này" nằm sau câu giải thích dài | Hai thẻ chọn lớn, mỗi thẻ một dòng hệ quả | TB ghi hệ quả cạnh lựa chọn `[ảnh 8eac9e56]` | Vừa | **LOẠI.** Chạm quyết định tính phí; chữ và logic của hai nút này thuộc hành vi tiền, giữ nguyên `[MH-02 §5]` |

---

## 3. Lớp (danh sách, chi tiết, tạo lớp, điểm danh)

Hiện trạng: đã có lớp thì không còn nút tạo lớp; chi tiết lớp là bảy mục liên kết; ngăn kéo tạo lớp có 13 ô; điểm danh có 5 ô đếm và hộp Zalo chiếm chỗ `[MH-03 §9]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| LO-1 | P1 | **Điểm danh bốn nút to cho bốn trạng thái, một dòng đếm bằng chữ** | Lưới 5 ô đếm + hộp Zalo + thanh xuất 3 nút đẩy danh sách em xuống `[MH-03 §9 điểm 11]` | Trên cùng một dòng: "6 có mặt · 1 muộn · 1 vắng". Mỗi em một hàng với bốn nút Có mặt / Muộn / Có phép / Vắng, mỗi nút ≥ 44px, chọn rồi nút tô đặc kèm chữ. Một nút "Tất cả có mặt" ở đáy trong vùng ngón cái, rồi chỉ sửa người khác. Zalo và xuất file vào menu "⋯" | Ba nút một chạm + "Tất cả có mặt" là mẫu tốt nhất `[ảnh ecaca8dc]`; KiN cần bốn trạng thái, không phải ba `[RS §3.5]` | Vừa | Không dính tiền: **không chép nhãn "tính phí"**, vì tiền KiN không phụ thuộc điểm danh `[RS §3.5]` |
| LO-2 | P1 | **Thẻ lớp: cả thẻ chạm được, chỉ một chip chữ** | 7 lớp đều tăm tắp, ba liên kết mỗi lớp `[MH-03 §9]` | Thẻ: chấm + chữ trạng thái ("Đang nhận học viên" / "Đã đầy"), "Toán 9", "2 học viên", buổi kế tiếp "Thứ Sáu 19:00". Cả thẻ mở lớp. Nút "Điểm danh" chỉ xuất hiện khi lớp có buổi chưa điểm danh | `[RS §3.3 Áp vào KiN]`; chip sĩ số thay đoạn văn `[ảnh 486587a8]`. Thanh sĩ số "n trên sức chứa" **không có trong ảnh nào**, đừng viện dẫn | Dễ | Không |
| LO-3 | P1 | **Nút "+ Tạo lớp" cố định đáy màn khi đã có lớp** | Đã có lớp rồi thì phải đi vòng qua trang quản trị bảng 8 cột `[MH-03 §9 điểm 1]` | Một nút nổi đặc ở đáy phải, cao 48px, trong vùng ngón cái, trên thanh module | Nút "Thêm lớp" ở góc trên xa tay là điều tránh `[ảnh d69ebba7]`; Shub đặt nút chính ở góc phải `[ảnh b03b9eb4]` | Dễ | Không |
| LO-4 | P1 | **Tạo lớp một ô: Tên, rồi chọn thứ và giờ bằng chip** | Ngăn kéo 13 ô, mặc định "ĐGNL HSA" / "KiN", cảnh báo Cloudinary hiện ra với gia sư `[MH-03 §9 điểm 8]` | Bước 1 chỉ có "Tên lớp" và chip T2…CN + giờ; nút cuối đổi nhãn theo hậu quả ("Tạo lớp Toán 9"). Mọi ô còn lại vào "Tuỳ chọn thêm" gập. Ẩn dòng cảnh báo kỹ thuật với gia sư | Wizard 3 bước, nút cuối đổi nhãn "Tạo lớp + 8 buổi" `[ảnh cdbd1f37]`; tránh bước 3 nhồi `[RS §3.3]` | Vừa | Gần tiền: ngăn kéo hiện có ô giá bán và giá gốc. **Không đổi ô giá, chỉ đổi chỗ ẩn/hiện của ô không phải tiền**; nếu cần đụng ô giá thì LOẠI |
| LO-5 | P2 | **Chi tiết lớp: đầu là chip, bốn hành động chính, còn lại gập** | Bảy mục, năm mục chỉ là tiêu đề + 1 câu + "Mở trang →"; dòng "Chào mừng đến hộp việc" sai ngữ cảnh `[MH-03 §9 điểm 3]` | Đầu: chấm màu + "Toán 9" + ba chip (2 học viên, Thứ Sáu 19:00, Đang nhận). Dưới là bốn dòng 50px: Điểm danh, Mã mời, Học sinh, Lịch học. "Khác" gập chứa phần còn lại | `[ảnh 486587a8]`, `[RS §3.3]` | Vừa | Không |
| LO-6 | P2 | **Mã mời: một nút "Sao chép link mời"** | Tạo mã có nhiều tuỳ chọn trước khi chép | Mặc định tạo sẵn một mã, nút đặc "Sao chép link mời"; "Mời cả lớp một lần" là liên kết; số lượt và số ngày vào "Tuỳ chọn" | Mã lớp 5 ô và một nút xanh rộng `[ảnh ef4f8038]` | Dễ | Mời qua Zalo phụ huynh dùng dữ liệu đã có (tên, số Zalo phụ huynh); **không thêm trường dữ liệu của trẻ** |
| LO-7 | P2 | **Danh sách học sinh rút bớt thông tin, thêm chữ trạng thái** | Hiện cả em chờ xác nhận lẫn tạm ngưng không có chữ; cột "Tiến độ 0/0 (0%)" vô nghĩa; hiện email, SĐT, trường `[MH-03 §9 điểm 10]` | Mỗi em một dòng: avatar chữ cái + tên + chip chữ ("Đang học", "Chờ xác nhận"); ẩn "Tiến độ" khi lớp chưa có bài; bỏ email và trường khỏi danh sách | Avatar chữ + tag trạng thái bằng chữ `[ảnh 32187a31]`; hồ sơ trẻ chỉ cần tên, lớp, SĐT Zalo phụ huynh `[RS §3.6]` | Dễ | Giảm dữ liệu trẻ hiển thị. Không thêm trường nào |
| LO-8 | P3 | **Vùng nguy hiểm cuối trang cho Kết thúc / Xoá lớp** | Hành động phá huỷ nằm lẫn nút thường | Gom về cuối chi tiết lớp, nền nhạt, chữ nói rõ hậu quả | `[ảnh 486587a8]` | Dễ | Không |

---

## 4. Học phí gia sư (chỉ đổi cách trình bày)

Quy tắc cứng: không đổi cách tính phiếu, không đổi đối soát SePay, không đổi mã `KIN`+5 ký tự. Gộp nút vào menu, xác nhận hai bước, hoàn tác thuộc hành vi nên chờ chủ dự án `[MH-04 §8, §12]`. Hiện trạng: dải tổng bốn ô cùng cỡ không có điểm nhấn, phiếu 5 nút ngang hàng, số khoản chờ chỉ là "(1)" trong nhãn tab `[MH-04 §9]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| HP-1 | P1 | **Dải tổng hai số có màu nghĩa: Đã thu xanh lá, Còn lại cam** | Bốn ô cùng cỡ cùng màu; con số quan trọng nhất không nổi `[MH-04 §9 điểm 2]` | Hai số lớn cạnh nhau: "Đã thu 480.000đ" (xanh lá) và "Còn lại 560.000đ" (cam), bên dưới một dòng nhỏ "2 phiếu · Tháng 10/2026". "Số phiếu" và "Phải thu" chuyển vào dòng phụ | SGS tô cam khi chưa thu, xanh lá khi đã thu `[ảnh 22608da4]`, `[ảnh c740944e]` | Dễ | **Chạm số tiền hiển thị** nhưng chỉ xếp lại các số đã có, không cộng trừ gì mới. Cần soát lại bằng số mẫu 480.000đ + 560.000đ trước khi dựng |
| HP-2 | P1 | **Thẻ phiếu: tên, một số tiền lớn, một chip trạng thái chữ** | Mỗi phiếu có lưới 3 cột nhãn (Phải đóng / Đã nhận / Còn lại): 8 phiếu là 24 cặp nhãn–số `[MH-04 §9 điểm 3]` | Thẻ Đỗ Hà: avatar + tên + chip "Nháp"; số "560.000đ" cam lớn nhất bên phải; Trần Gia Bảo: chip "Đã đóng" (xanh lá), "480.000đ". Ba cột chi tiết chỉ hiện khi mở phiếu | Số tiền cam lớn bên phải thẻ học sinh `[ảnh 22608da4]`; `[RS §3.4 Áp vào KiN]` | Dễ | Chỉ trình bày. Phiếu đóng bằng tín dụng hiện đúng chữ thay vì "0đ" cần xử lý riêng `[MH-04 §9 điểm 19]` |
| HP-3 | P1 | **Mỗi phiếu đúng một nút đặc, nút còn lại hạ thành viền hoặc chữ** | Phiếu đã gửi có 5 nút ngang hàng, cả màn nhiều nút "chính" `[MH-04 §9 điểm 4]` | Nháp: nút đặc "Gửi phiếu". Đã đóng: không nút đặc. Các nút khác (Sao chép tin nhắn, Sửa số tiền, Huỷ phiếu) xếp một hàng nút viền/chữ, giữ nguyên chữ nhãn và hành vi | Hai nút ở chân thẻ: viền + đặc `[ảnh 22608da4]` | Dễ | **Chỉ làm phần thứ bậc thị giác.** Gộp nút vào menu "⋯" thuộc hành vi, chờ chủ dự án `[MH-04 d.7]` |
| HP-4 | P1 | **Khoản chờ đối soát nổi lên thành chấm cam kèm chữ** | Số khoản chờ chỉ là "(1)" trong tab, không màu; đỏ dùng quá tay cho mọi loại khác "Khớp đủ" `[MH-04 §9 điểm 7, 8]` | Nhãn tab: "Chờ đối soát · 1" với huy hiệu cam; trong tab chỉ dùng cam cho "cần gia sư quyết", đỏ chỉ cho lỗi thật. Rỗng: "Chưa có khoản tiền nào chờ. Tiền chuyển đến sẽ hiện ở đây." (một câu, một nút "Về Phiếu") | Cam của KiN nghĩa là "chờ" `[RS §3.4]`; trạng thái rỗng một câu một nút `[ảnh 02db8767]` | Dễ | Chỉ màu và chữ; không đổi cách ghép khoản |
| HP-5 | P2 | **Đầu trang gọn: tháng chọn bằng ‹ Tháng 10/2026 ›, bỏ đoạn mô tả** | Đầu trang chiếm nửa màn: "← Lớp của tôi", h1, đoạn 2 dòng, tab; chọn tháng bằng `<select>` 12 mục `[MH-04 §9 điểm 6, 15]` | Một hàng: tiêu đề "Học phí" + ‹ Tháng 10/2026 › 44px. Bỏ đoạn mô tả. Hai nút đầu ("Lập phiếu cả lớp", "Gửi N phiếu nháp") thành một nút đặc theo bước kế tiếp. Thời điểm khoản vào dùng một kiểu "19:05 21/10", bỏ giây | `[RS §3.4]`, mũi tên chuyển tháng cạnh tiêu đề `[ảnh 48daa960]` | Dễ | Không đổi cách chọn tháng ra phiếu nào, chỉ đổi nút |
| HP-6 | P2 | **Xem trước phiếu như phụ huynh sẽ thấy, dọc trong tờ trượt** | Gia sư không thấy QR và phiếu như phụ huynh `[MH-04 §9 điểm 13]` | Nút "Xem phiếu" mở tờ trượt dọc: số tiền và tổng nổi, mã `KIN`+5 ký tự có nút sao chép, khung QR từ `qrUrl` đã có | SGS có xem trước phiếu `[ảnh 1ceeb24f]`. **Không ảnh nào có QR thật** `[RS §3.8]` nên khung QR dựng theo đặc tả KiN, không theo ảnh | Vừa | Chỉ hiển thị dữ liệu sẵn có, không tạo, không đổi phiếu |
| HP-7 | P3 | **Tab Nhận tiền: đã nối thì một dòng, chưa nối thì mỗi lần một bước** | Hai khung lớn, bốn bước luôn mở; người đã nối xong vẫn cuộn hết `[MH-04 §9 điểm 20]` | Đã nối: "Đang nối SePay" + "Xem hướng dẫn" gập. Chưa nối: chỉ bước 1, xong mới hiện bước 2. Nút Lưu xám cho đến khi nhập đủ ba trường | `[ảnh faecc690]`, `[RS §3.7]` | Vừa | Không đổi thông tin ngân hàng, chỉ đổi cách sắp xếp |
| HP-8 | P2 | **Hộp tiền có dòng xem lại "= 560.000đ", ô nhóm nghìn khi gõ** | Ô tiền chỉ nhận chữ số, "560000" dễ gõ thừa số 0 `[MH-04 §9 điểm 10]` | Nhóm nghìn khi gõ và dòng xem lại chữ | Dự án đã làm vậy ở sổ tài chính cá nhân (khác sản phẩm) **[suy luận]** | Vừa | **LOẠI.** Chạm ô nhập tiền, rủi ro đổi giá trị sai; chờ chủ dự án. Cùng nhóm LOẠI: xác nhận hai bước "Bạn đã nhận…", Hoàn tác, gộp phiếu, tạo nhiều phiếu `[RS §3.4]` |

---

## 5. Học sinh: Trang chủ ("Việc của tôi")

Hiện trạng: học sinh mới chưa vào lớp thấy "Chưa có việc nào cần làm", sai nghĩa; lỗi tải hiện "Đang tải…" mãi; chuông 36px, dải xác thực email dùng emoji, nút dưới 44px `[MH-05 Màn A §9]`. Học sinh có thể dưới 16 tuổi: không hỏi thêm thông tin cá nhân, không hiện tiền.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| HT-1 | P1 | **Em chưa vào lớp: một câu và ô nhập mã 5 ký tự ngay trên trang** | Em mới thấy "Bạn đã xong hết", không biết bước tiếp; lối nhập mã chỉ có ở trang đăng nhập và vài trang sâu `[MH-05 Màn A §9 điểm 1]` | Thay trạng thái rỗng bằng: "Bạn chưa vào lớp nào. Nhập mã mà cô giáo gửi." + ô 5 ký tự gạch chân, một nút "Vào lớp". Bỏ "Bạn đã xong hết" khi chưa có lớp | Mã lớp 5 ô gạch chân, một nút xanh rộng `[ảnh ef4f8038]`; trạng thái rỗng một câu một nút `[ảnh 2e32d1cb]` | Dễ | Không thu thêm dữ liệu; mã lớp không phải thông tin cá nhân |
| HT-2 | P1 | **Thứ tự: chào một dòng → buổi sắp tới → tối đa 3 việc theo hạn** | Danh sách việc dài, nửa phải màn trống ở máy rộng; không có buổi kế tiếp nổi bật `[MH-05 Màn A §4]` | Chào "Chào buổi chiều, Gia Bảo". Thẻ "Buổi sắp tới": "Thứ Sáu 19:00 · Toán 9 · Cô Lan" + nút đặc "Vào lớp" (chỉ sáng từ lúc gần giờ). Dưới, "Việc cần làm" tối đa 3 dòng sắp theo hạn, mỗi dòng một chữ trạng thái (Chưa làm, Sắp hết hạn, Chờ chấm), cuối "Xem tất cả". Không lặp một mục ở hai nơi | Chia khối theo câu hỏi "hôm nay có gì" `[ảnh 11a4cd13]`; `[RS §4.1]` | Vừa | Không có tiền học phí và không có Coin ở trang này |
| HT-3 | P1 | **Hết việc: một dòng xanh, không minh hoạ** | Minh hoạ lớn khi rỗng chiếm chiều cao `[ảnh 0b5e59f8]` | "Bạn đã xong hết việc hôm nay." một dòng xanh lá, không hình | Shub dùng câu thân thiện nhưng thêm minh hoạ lớn, KiN chỉ lấy câu | Dễ | Không |
| HT-4 | P2 | **Lỗi tải: "Không tải được" và nút "Thử lại"** | Khung đọc ghi "Đang tải…" mãi, trông như treo `[MH-05 Màn A §9 điểm 2]` | Dải một dòng và nút 44px | `[MH-01 §9 điểm 10]` cùng lỗi ở phía gia sư | Dễ | Không |
| HT-5 | P2 | **Vỏ học sinh: chuông 44px, bỏ emoji, dải xác thực gọn** | Chuông 36px; bảng chuông và dải email dùng emoji; nút "Gửi lại email" ~28px, ✕ 24px `[MH-05 Màn A §9]` | Chuông, ✕, "Gửi lại" đều ≥ 44px; icon cùng bộ với phần còn lại; dải email một dòng. Thông báo ngoài app không có tên em hay số tiền | Thanh đầu gọn, mỗi chức năng một icon quen `[ảnh e8a12f59]` | Dễ | Không |
| HT-6 | P3 | **Chip Coin kèm chữ "Coin", không bấm được, không dẫn tới mua** | Hiện chỉ có emoji và số, người lạ không hiểu | Hiển thị "120 Coin" đúng một chỗ ở dải trên | `[MH-05 vỏ P1]` | Dễ | **Gần Coin.** Chỉ hiển thị số đã nhận; **không bao giờ có nút mua hay nạp**. Nếu ai đề xuất biến chip thành lối vào ví để mua: LOẠI |
| HT-7 | — | **Banner "chia sẻ yêu cầu của tôi" hoặc gợi ý gia sư khác trên trang chủ** | — | — | `[ảnh 2e32d1cb]` | — | **LOẠI.** Đưa dữ liệu của em (có thể dưới 16 tuổi) ra ngoài hệ thống `[RS §6.1]` |
| HT-8 | — | **Bảng xếp hạng hiện tên bạn cùng lớp ngay trang chủ** | — | — | — | — | **LOẠI.** Tên đầy đủ trẻ em, quyết định thuộc chủ dự án `[MH-06 §12 câu 9]` |

---

## 6. Học sinh: Lịch học

Hiện trạng: ngày tính theo giờ trình duyệt rồi đổi sang UTC nên ở +07 bị lùi một ngày; buổi đã huỷ vẫn có nút "Vào học"; 4 ô thống kê, lưới 8 nút ngày, chip loại, thẻ viền, hàng nút tuần đều dưới 44px `[MH-05 Màn B §9]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| HL-1 | P1 | **Dải 7 ngày to, mở ở hôm nay, hôm nay không dùng đỏ** | 8 nút ngày ~32px, đỏ vừa là "hôm nay" vừa là "nghỉ/quá hạn" `[MH-05 Màn B §9 điểm 6, 7]` | Đúng 7 cột, ô ≥ 44px, ngày chọn viền đậm, ngày có sự kiện có chấm; hôm nay tô token xanh dương. Mở ra là hôm nay, danh sách chỉ hiện ngày đang chọn | Dải 7 chip ngày ngang, ngày chọn viền đậm `[ảnh 66e5b5d6]`, giờ khả dụng dưới mỗi ngày `[ảnh 2c486c98]` | Dễ | Không |
| HL-2 | P1 | **Mỗi sự kiện một dòng có giờ bắt đầu và kết thúc, bỏ thẻ viền** | Chỉ hiện giờ bắt đầu dù có `endTime`; thẻ viền cho từng sự kiện `[MH-05 Màn B §9 điểm 5, 7]` | Dòng: "19:00–20:30 · Toán 9 · Cô Lan" + chip chữ (Sắp tới / Đang diễn ra / Đã huỷ / Đã dời); phân cách bằng đường kẻ mảnh | `[RS §4.6]` | Dễ | Không |
| HL-3 | P1 | **Buổi đã huỷ: bỏ nút "Vào học", gạch ngang, bỏ tiền tố trong tên** | Buổi huỷ vẫn có "Vào học" và in nguyên "[ĐÃ HUỶ] " `[MH-05 Màn B §9 điểm 2]` | Chip "Đã huỷ" + tên gạch ngang; nút duy nhất là "Xem lịch". Buổi dời: chip "Đã dời từ 22/10" | Mục "Việc của tôi" đã xử lý đúng như vậy `[MH-05 Màn B §9 điểm 2]` | Dễ | Không |
| HL-4 | P1 | **Sửa gốc ngày theo giờ Việt Nam** | Tuần lọc và nhãn "Hôm nay" sai trong 00:00–07:00 `[MH-05 Màn B §9 điểm 1]` | Tính ngày và tuần theo `Asia/Ho_Chi_Minh` cố định, không dùng `toISOString()` trên giờ máy | Đây là lỗi, không phải ý tưởng giao diện, nhưng trực tiếp quyết định em đi nhầm ngày **[suy luận về mức nghiêm trọng]** | Dễ | Không |
| HL-5 | P2 | **Bỏ 4 ô thống kê đầu trang, lọc loại thu về một menu** | 4 ô thống kê + hàng chip loại (~28px) đẩy lịch xuống `[MH-05 Màn B §9 điểm 7]` | Màn mở thẳng vào dải ngày. Lọc loại (buổi học / thi thử / hạn nộp) là một chip "Tất cả ▾" 44px | Khung hướng dẫn dài đầu lịch là điều tránh `[ảnh 313a202f]` | Dễ | Không |
| HL-6 | P2 | **Nút "Vào học" 44px và chỉ nói giờ khi chưa tới** | Nút ~28px, luôn sáng | Trước giờ: chữ "Bắt đầu lúc 19:00"; từ ít phút trước giờ: nút đặc "Vào học" | Nút đặc một chạm cho hành động chính `[ảnh 6508f5f6]` | Vừa | Không |
| HL-7 | P3 | **Tuần đã qua và lỗi tải nói thật** | "Tuần trước" dẫn tới trang trống không giải thích; lỗi tải hiện "Không có lịch" như thật `[MH-05 Màn B §9 điểm 3, 4]` | Tuần quá khứ ghi "Chưa lưu lịch sử buổi đã học"; lỗi có "Thử lại" | `[RS §4.8 điểm 3]` | Dễ | Không |
| HL-8 | — | **Lịch hiện tên và ảnh bạn cùng lớp cùng buổi** | — | — | — | — | **LOẠI.** Dữ liệu trẻ em của người khác; lịch học sinh chỉ cho thấy việc của chính em |

---

## 7. Học sinh: Lớp của tôi

Hiện trạng: nút "Lớp" nhảy thẳng vào lớp đầu tiên theo thứ tự cơ sở dữ liệu, em học nhiều lớp không thấy danh sách; danh sách thật nằm ở `/lop-cua-toi` khó vào `[MH-05 Màn C]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| HK-1 | P1 | **Tab Lớp mở ra danh sách lớp, mỗi lớp một thẻ gọn** | Em học nhiều lớp bị nhảy vào lớp đầu, không thấy lớp khác | Thẻ: "Toán 9" · "Cô Lan" · "Thứ Sáu 19:00" + nút "Vào lớp" 44px. Em chỉ có một lớp thì vẫn mở thẳng vào, nhưng đầu trang có chip tên lớp để đổi | Danh sách lớp dạng thẻ thay bảng nhiều cột `[ảnh b03b9eb4]`; `[RS §4.5]` | Vừa | Không |
| HK-2 | P1 | **Trong lớp: một nút đặc "Tiếp tục học", tiến độ bằng một vòng và chữ** | Cột "Tiến độ 0/0" vô nghĩa với lớp dạy kèm không có bài | Đầu trang: tên lớp, buổi tới, nút đặc "Tiếp tục học". Vòng tiến độ + "3/12 bài" chỉ khi lớp có bài; lớp không có bài thì ẩn hẳn | `[MH-03 §9 điểm 10]` cùng lỗi ở phía gia sư | Dễ | Không |
| HK-3 | P1 | **Nhập mã mời: ô tự nhảy, tự viết hoa, bước xem trước ngắn** | Ô nhập mã nhỏ, nhiều bước | Ô 5 ký tự gạch chân to, tự chuyển ô, tự viết hoa; sau khi đủ 5 ký tự hiện thẻ xem trước "Cô Lan · Toán 9 · Thứ Sáu 19:00" và nút đặc "Vào lớp này" | Ô mã 5 ô, nút xanh rộng, liên kết quay lại ngay dưới `[ảnh ef4f8038]` (ô nhỏ, vạch mỏng là điều tránh) | Vừa | Không thêm dữ liệu cá nhân. **Không đổi nội dung xem trước** (đặc tả hiện có dòng học phí, học sinh không nên thấy tiền, xem câu hỏi mở của chủ dự án trước khi thêm hay bớt) |
| HK-4 | P2 | **Tài liệu và bản ghi: một hàng trong trang lớp** | Khối "Tài liệu & bản ghi của lớp này" chiếm một vùng riêng | Một dòng 50px "Tài liệu và bản ghi · 4 mục" chạm để mở | `[MH-05 Màn C §2]` | Dễ | Không |
| HK-5 | P2 | **Rỗng thân thiện cho tab Lớp** | Em chưa vào lớp thấy trang trống | Dùng chung thành phần với HT-1: một câu và ô nhập mã | `[ảnh 2e32d1cb]` | Dễ | Không |
| HK-6 | P3 | **Pill lọc Đang học / Đã ẩn chỉ khi từ 4 lớp trở lên** | Thêm pill cho em chỉ có 1-2 lớp là thừa | Mặc định không có pill; khi lớp nhiều, một pill tròn ở đầu danh sách | Shub có ba pill nhưng cho LMS trường lớn `[ảnh b03b9eb4]` | Dễ | Không |
| HK-7 | P3 | **Ngày thống nhất dd/mm trong mã mời và danh sách** | "5/11/2026" không có số 0 đầu ở vài chỗ `[MH-03 §9 điểm 14]` | Một hàm định dạng ngày cho toàn app | — | Dễ | Không |
| HK-8 | — | **Mục "Học phí của lớp" cho học sinh xem phiếu và QR** | — | — | `[ảnh d2a216a5]` | — | **LOẠI.** Học sinh không thấy học phí; phiếu và QR thuộc trang phụ huynh `/so-cua-con/[token]`. Cùng nhóm LOẠI: nút mua hay nạp Coin, "Đặt lịch học thử có phí", thanh toán thẻ |

---

## 8. Học sinh: Bài tập và thi

Phần này gần như không có ảnh tham khảo `[RS §4.7]`. Phòng thi không thiết kế lại cấu trúc, chỉ làm gọn: đáp án, đồng hồ, thứ tự câu giữ nguyên để mọi em thi công bằng `[MH-06 §1]`. Hiện trạng: lề ngang không có ở 5 màn, cổng vào đề có sáu khung, mất mạng lúc thi không báo gì, Coin thưởng không hiện `[MH-06 §9]`.

| Mã | Ưu | Ý tưởng | Vấn đề | Cách giải | Vì sao (nguồn) | Khó | Tiền / trẻ em |
|---|---|---|---|---|---|---|---|
| HB-1 | P1 | **Lề ngang 16px cho mọi màn trước và sau bài thi** | Ở 390px thẻ chạm sát mép màn hình ở cổng, kết quả, xem lại, chữa bài, nhập điểm `[MH-06 §9 điểm 2]` | Thêm lề ngang 16px cho các màn B, D, E, F, H; phòng thi giữ toàn màn hình | Điều kiện cơ bản của thiết kế điện thoại, không cần nguồn ngoài | Dễ | Không |
| HB-2 | P1 | **Cổng vào đề: một thẻ, một nút lớn ở đáy** | Sáu khung lớn, ba hộp nói gần cùng một việc `[MH-06 §9 điểm 3]` | Một thẻ: tên đề, "60 phút · 40 câu". Quy định 3 dòng gập mặc định. Nút đặc rộng cuối màn "Bắt đầu làm bài" trong vùng ngón cái, bỏ ký tự "▶". Bỏ khối "Thông tin ghi nhận" hiện giờ vẽ trang. Top 10 và Lịch sử vào hai dòng gập | Hỏi một câu, một nút chính `[ảnh 45d3102f]`; tóm tắt trước khi làm `[ảnh d2a216a5]` | Vừa | **Top 10 chỉ giữ như hiện có**; không đưa thêm tên bạn cùng lớp ra chỗ khác (xem LOẠI bên dưới) |
| HB-3 | P1 | **Danh sách đề: "Đang mở" lên đầu, mỗi dòng có một nút "Vào thi"** | Ô mã đề tô gradient hex ngoài token; ba ô số trong khung riêng; lỗi tải hiện như chưa có đề `[MH-06 §9 điểm 9]` | Nhóm "Đang mở" rồi "Sắp diễn ra"; dòng: tên đề + hạn + chip chữ + nút 44px. Bỏ ô gradient (đổi sang token) và ba ô số. Lỗi tải có "Thử lại" | Bảng "Bài tập chưa nộp" ba cột Tên / Lớp / Hạn chót `[ảnh 11a4cd13]` | Vừa | Không |
| HB-4 | P1 | **Phòng thi: báo lưu đáp án bằng chữ** | Mất mạng lúc thi không báo gì, ô vẫn tô như đã lưu; nộp xong mới thấy thiếu `[MH-06 §9 điểm 6]` | Một chip nhỏ cố định góc: "Đã lưu" / "Chưa lưu được, đang thử lại"; nếu mất mạng thì hiện dòng cảnh báo. Không đổi logic chấm hay thời gian | Chỉ báo trạng thái bằng chữ, đúng quy tắc "trạng thái luôn có chữ" của dự án | Vừa | Không. Đây là chỉnh hiển thị, không đổi đề, đáp án hay đồng hồ |
| HB-5 | P2 | **Phòng thi: nút Nộp bài tách khỏi Câu trước / Câu sau, Đúng/Sai viết đủ chữ** | Nộp bài đứng sát Câu trước, bấm nhầm; nút Đúng/Sai chỉ có "Đ" "S" `[MH-06 §9 điểm 7, 8]` | Chân màn: hai nút Câu trước, Câu sau ≥ 44px; "Nộp bài" chuyển lên bảng danh sách câu (hộp xác nhận giữ nguyên). Nút ghi đầy "Đúng", "Sai" | Phòng thi giữ cấu trúc, chỉ làm gọn `[MH-06 §4C]` | Vừa | Không đổi luật thi |
| HB-6 | P2 | **Kết quả: điểm là số lớn nhất, Coin thưởng một dòng** | Coin thưởng không bao giờ hiện dù máy chủ trả `coinsEarned` `[MH-06 §9 điểm 1]` | Điểm "8,5/10" cỡ lớn, hạng, một dòng "+5 Coin vì nộp đúng hạn". Thống nhất dấu phẩy thập phân giữa các màn | Bố cục "số trước, nhận xét sau" như các thẻ KPI `[ảnh 9eca7149]` | Dễ | **Gần Coin.** Chỉ báo phần thưởng đã có; không nút mua hay nạp; không nội dung cờ bạc, bốc thăm hay đoán |
| HB-7 | P2 | **Chữa bài: thanh bước cuộn ngang một hàng** | `flex-wrap` làm một em sai 20 câu có nhiều hàng chip chiếm cả màn `[MH-06 §9 điểm 17]` | Một hàng chip cuộn ngang; câu hiện tại luôn cuộn vào giữa; gợi ý trước, đáp án sau | — | Dễ | Không |
| HB-8 | P2 | **Bài tập: hạn có giờ và chữ "Còn 2 ngày", lỗi trong trang thay `alert()`** | Hạn chỉ có ngày, Việc của tôi in cả giờ; `alert()` báo lỗi `[MH-06 §9 điểm 12, 13]` | Dòng "Hạn 25/10 · Còn 2 ngày"; trạng thái chữ (Chưa làm, Đã nộp, Chờ chấm); lỗi hiện dải trong trang. Màn nhập điểm Azota có "← Về danh sách đề thi" | Bảng ba cột Tên / Lớp / Hạn chót `[ảnh 11a4cd13]`; `[MH-06 §2 mục 8]` | Vừa | Không. Chỉ đổi cách hiển thị hạn, **không đổi cách khoá bài lúc 07:00** (điểm 21 là hành vi, chờ chủ dự án) |
| HB-9 | — | **Top 10 / hạng hiện tên bạn cùng lớp sang màn Kết quả; xếp hạng công khai theo lớp** | — | — | `[MH-06 §9 điểm 11]` | — | **LOẠI.** Tên đầy đủ của trẻ em, quyết định thuộc chủ dự án `[MH-06 §12 câu 9]`. Cùng nhóm LOẠI: dùng Coin để mở đề, đề thưởng kiểu may rủi, quảng cáo cờ bạc |

---

## 9. Mười ý tưởng tốt nhất toàn bộ

Chọn theo: dùng mỗi ngày, bớt được dòng hoặc khung, độ khó thấp, không dính tiền hay trẻ em. Mỗi ý tưởng đều qua đủ bốn phép thử ở mục 0.

| # | Mã | Ý tưởng | Vì sao đứng đầu | Khó |
|---|---|---|---|---|
| 1 | TQ-1 | Khối "Việc cần làm" lên đầu trang chủ gia sư, tự biến mất khi bằng 0 | Việc đầu tiên Cô Lan cần biết giữa hai buổi, gom 4 loại việc vào ≤ 3 dòng, bỏ thẻ rỗng | Dễ |
| 2 | LI-1 + LI-2 | Lịch mở tại hôm nay, dải 7 ngày dính đầu màn, ô ≥ 44px | Trả lời "hôm nay tôi dạy gì" không cuộn | Dễ |
| 3 | LI-3 | Thẻ buổi một dòng với một chip chính (bỏ ba huy hiệu xếp cột) | Giảm độ dày thị giác nhiều nhất của màn Lịch | Dễ |
| 4 | LO-1 | Điểm danh bốn nút ≥ 44px, một dòng đếm bằng chữ, "Tất cả có mặt" ở đáy | Việc lặp nhiều nhất mỗi tuần; không chép nhãn "tính phí" | Vừa |
| 5 | TQ-2 | Thẻ buổi kế tiếp thay danh sách, bỏ hai số thống kê khỏi màn đầu | Bớt hơn nửa màn cuộn của trang chủ | Dễ |
| 6 | HP-1 | Dải tổng hai số: Đã thu 480.000đ xanh lá, Còn lại 560.000đ cam | Điểm nhấn màu nghĩa duy nhất cần có, chỉ xếp lại số đã có | Dễ |
| 7 | HP-2 + HP-3 | Thẻ phiếu một số lớn, một chip chữ, một nút đặc | Bớt 24 cặp nhãn–số và cả hàng nút ngang hàng | Dễ |
| 8 | LO-2 + LO-3 | Thẻ lớp chạm được cả thẻ, nút "+ Tạo lớp" cố định đáy | Gỡ hai chỗ bí: lớp dày đều và không có lối thêm lớp | Dễ |
| 9 | HT-1 + HK-3 | Em chưa vào lớp thấy ô nhập mã ngay trang chủ, ô tự nhảy | Gỡ ngõ cụt của học sinh mới, không thu thêm dữ liệu | Dễ |
| 10 | HB-2 | Cổng vào đề một thẻ và một nút lớn ở đáy | Sáu khung thành một; nút trong vùng ngón cái, trước lúc căng thẳng nhất | Vừa |

Các ý tưởng LOẠI đã gom, không làm vòng này: LI-8, HP-8 (và xác nhận hai bước, hoàn tác, gộp phiếu, tạo nhiều phiếu), HT-7, HT-8, HL-8, HK-8, HB-9.
