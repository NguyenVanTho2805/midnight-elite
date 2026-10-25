# Định hướng thiết kế giao diện KiN: quyết định ý tưởng và ba hướng

Soạn 22/10/2026. Tài liệu thiết kế, không sửa mã. Người soạn: trưởng sản phẩm, sau khi đọc ba tệp ý tưởng (`IDEAS-gia-su-ban.md`, `IDEAS-hoc-sinh-phu-huynh.md`, `IDEAS-van-hanh-tien.md`) và `RESEARCH-TONG-HOP.md`.

## 0. Cách đọc

- Mục tiêu duy nhất của chủ dự án: **thoáng, dễ dùng, ít dày** trên điện thoại. Không ý nào được thêm dòng, khung, nút "chính" nếu không bỏ đi thứ khác.
- Nguồn viết tắt: **GS** = `IDEAS-gia-su-ban.md`, **HS** = `IDEAS-hoc-sinh-phu-huynh.md`, **VH** = `IDEAS-van-hanh-tien.md`, **RS** = `RESEARCH-TONG-HOP.md`, **MH-0N** = đặc tả `man-hinh/0N-*.md`. Mã ý tưởng giữ nguyên theo từng tệp (ví dụ GS TQ-1, VH T1) vì ba tệp đánh mã khác nhau cho cùng một ý.
- Dữ liệu mẫu dùng thống nhất: Cô Lan; 7 lớp (Toán 9, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9, Toán 8); 8 học viên; đã thu tháng 10: 480.000đ; còn lại: 560.000đ; phiếu Đỗ Hà 560.000đ (nháp), Trần Gia Bảo 480.000đ (đã đóng); Thứ Sáu 23/10 19:00–20:30 Toán 9 (2 học viên); Thứ Bảy 24/10 16:00–17:30 Văn 8; việc cần làm: 2 yêu cầu xác nhận của phụ huynh, 1 báo nghỉ sát giờ, 1 khoản cần đối soát, 4 buổi chưa điểm danh (cộng lại là 8 việc). Học sinh mẫu: Trần Gia Bảo.
- Màu chỉ gọi qua token `--kin-*` trong `src/app/kin-tokens.css` (không viết mã màu). Token dùng nhiều ở tài liệu này: `--kin-nen-trang`, `--kin-nen-bang`, `--kin-vien-nhat`, `--kin-chu-chinh`, `--kin-chu-phu`, `--kin-chu-mo`, `--kin-chu-tren-nut-chinh`, `--kin-tt-chu-xong` (xanh lá, xong), `--kin-tt-chu-cho` (cam, chờ hoặc còn lại), `--kin-tt-chu-loi` (đỏ, lỗi thật), `--kin-th-xanh-link`, `--kin-cham-toi-thieu` (44px), `--kin-cham-dong` (50px), `--kin-kc-1..9` (khoảng cách), `--kin-bo-*` (bo góc).
- Ba chữ cần nhớ khi đọc phần quyết định: **NHẬN** = đưa vào thiết kế vòng này; **LOẠI** = không làm vòng này, ghi lại để khỏi bị đề xuất lại; **CHỜ** = hợp lý nhưng là hành vi hoặc cần chủ dự án quyết, không đưa vào bản dựng vòng này.

---

## 1. Quyết định: ý tưởng nào NHẬN, ý tưởng nào LOẠI

### 1.1 Cách quyết (bốn bộ lọc, theo thứ tự)

1. **Chạm cách tính tiền hay hành vi ghi tiền?** Có thì LOẠI hoặc CHỜ. Màn Học phí chỉ đổi cách trình bày: không đổi cách tính phiếu, không đổi đối soát, không đổi mã `KIN` + 5 ký tự `[MH-04 §8, §12]`.
2. **Chạm dữ liệu trẻ em?** Học sinh có thể dưới 16 tuổi. Thêm thu thập dữ liệu, đưa tên em ra màn của người khác, đưa dữ liệu của em ra ngoài hệ thống: LOẠI.
3. **Làm màn dày hơn?** Thêm khung, dòng, nút mà không bỏ gì: LOẠI.
4. **Có bằng chứng và dùng được trên điện thoại một tay?** Ý có ảnh đỡ lưng hoặc đặc tả hiện trạng thì NHẬN dễ hơn; ý chỉ là suy luận phải ghi rõ và để mức ưu tiên thấp hơn.

### 1.2 Mười hai ý NHẬN cho cả ba hướng (nền chung)

Đây là các thay đổi mà **cả ba hướng đều phải có**, vì cả ba tệp ý tưởng đều chọn và không hướng nào phản đối. Khác nhau giữa ba hướng nằm ở cách xếp, không ở việc có hay không.

| # | Ý tưởng NHẬN | Mã nguồn | Vì sao nhận |
|---|---|---|---|
| 1 | Một khối "Việc cần làm" gộp Tổng quan và Hộp việc, mỗi dòng một câu và một chữ trạng thái ("Cần xử lý", "Chờ bạn"), tối đa 3 dòng rồi "Xem tất cả 8 việc"; bằng 0 thì chỉ một dòng "Không có việc cần làm", không dựng thẻ rỗng | GS TQ-1, VH T1+T2, HS TQ-1 | Cả ba tệp xếp hạng 1. Gỡ lỗi lớn nhất của gia sư: hai màn trùng, đếm lệch chữ, thẻ rỗng chiếm hàng `[MH-01 §9 điểm 1]`, `[ảnh 9eca7149]` |
| 2 | Buổi hôm nay không hiện hai lần ("Hôm nay" và "Sắp tới"); mỗi buổi ghi đủ giờ bắt đầu–kết thúc và sĩ số: "19:00–20:30 · Toán 9 · 2 học viên" | GS TQ-2, VH T4, HS TQ-2 | Lỗi thật `[MH-01 §9 điểm 3, 4]`, sửa chỉ là xếp lại |
| 3 | Lịch mở tại hôm nay, dải 7 ngày dính đầu màn, ô ≥ 44px, ngày có buổi có chấm | GS LI-1+LI-2, VH L1, HS LI-2+LI-7 | Trả lời "hôm nay tôi dạy gì" không cần cuộn `[MH-02 §9 điểm 19]`, `[ảnh 66e5b5d6]` |
| 4 | Thẻ buổi chỉ một chip trạng thái bằng chữ theo thứ tự ưu tiên (Cần xử lý, Đã dời, Sắp tới, Đã kết thúc); việc phụ vào chi tiết | GS LI-3, VH L2, HS LI-3 | Bỏ ba huy hiệu xếp cột ép tên lớp `[MH-02 §9 điểm 2]` |
| 5 | Chi tiết buổi là tờ trượt từ đáy: việc gấp nhất đứng đầu, một nút đặc rộng trong vùng ngón cái | GS LI-4, VH L3, HS LI-4 | `[MH-02 §9 điểm 6]`, `[ảnh 190a8682]` |
| 6 | Điểm danh bốn nút ≥ 44px (Có mặt, Muộn, Có phép, Vắng), một dòng đếm bằng chữ, nút "Tất cả có mặt" ở đáy; **không chép nhãn "tính phí"** | GS LO-1 | Việc lặp nhiều nhất mỗi tuần; ở KiN tiền không phụ thuộc điểm danh `[RS §3.5]`, `[ảnh ecaca8dc]` |
| 7 | Thẻ lớp chạm được cả thẻ, một chip chữ; nút "+ Tạo lớp" luôn thấy khi đã có lớp; tạo lớp một ô bắt buộc (Tên, thứ, giờ), ô còn lại gập | GS LO-2+LO-3+LO-4, VH C1+C2, HS LO-2+LO-5 | Gỡ ngõ cụt "đã có lớp thì không còn lối tạo lớp" `[MH-03 §9 điểm 1, 8]` |
| 8 | Học phí: dải tổng **hai số** "Đã thu 480.000đ" (`--kin-tt-chu-xong`) và "Còn lại 560.000đ" (`--kin-tt-chu-cho`); thẻ phiếu một số tiền lớn, một chip chữ, mỗi phiếu **một nút đặc** | GS HP-1+HP-2+HP-3, VH H1+H2, HS HP-1+HP-2+HP-5 | Cắt 24 cặp nhãn–số và 5 nút ngang hàng; chỉ xếp lại số đã có `[MH-04 §9 điểm 2, 3, 4]`, `[ảnh 22608da4]` |
| 9 | Khoản chờ đối soát thành dòng nhắc có chữ ("1 khoản tiền vào cần đối soát") và nhãn tab "Chờ đối soát · 1"; đỏ chỉ cho lỗi thật, các loại còn lại dùng nhãn trung tính "Cần bạn quyết" | GS HP-4, VH H3, HS HP-6 | Việc gấp nhất về tiền đang ẩn trong "(1)" `[MH-04 §9 điểm 7, 8]` |
| 10 | Em chưa vào lớp: một câu "Bạn chưa vào lớp nào" và ô mã mời 5 ký tự ngay trang, thay cho "Bạn đã xong hết"; ô tự nhảy, tự viết hoa | GS HT-1+HK-3, VH S1+K2, HS HN-2+LO-1 | Sai nghĩa hiện nay làm em lạc ngay bước đầu, không thu thêm dữ liệu `[MH-05 Màn A §9 điểm 1]`, `[ảnh ef4f8038]` |
| 11 | Trang chủ học sinh theo thứ tự: chào một dòng → buổi sắp tới (nút "Vào lớp") → tối đa 3 việc theo hạn, mỗi việc một chữ trạng thái; lịch học dải 7 ngày, buổi đã huỷ ghi "Đã huỷ" và bỏ nút "Vào học" | GS HT-2+HL-1..3, VH S2+M1+M2, HS HN-1+HL-1+HL-3 | Ba tệp trùng ý; sửa hai lỗi em gặp thật (chạm nhầm, vào buổi không còn) `[MH-05 Màn B §9 điểm 2, 7]` |
| 12 | Phòng thi: chip chữ "Đã lưu" / "Chưa lưu được, đang thử lại"; cổng vào đề một thẻ một nút; kết quả có điểm lớn và dòng thưởng; lề ngang 16px ở các màn trước và sau bài thi | GS HB-1..4+HB-6, VH B1+B2+B4, HS HB-2+HB-3+HB-4 | An toàn cho em: mất mạng mà không biết là lỗi nặng nhất của phòng thi `[MH-06 §9 điểm 2, 3, 6]`. Chỉ đổi hiển thị, không đổi đề, đáp án, đồng hồ, cách chấm |

### 1.3 Các NHẬN phụ (mức P2/P3, làm nếu còn chỗ trong bản dựng)

| Ý tưởng | Mã nguồn | Ghi chú quyết |
|---|---|---|
| Icon mắt ẩn số tiền ở trang chủ gia sư | GS TQ-3, VH T3 | NHẬN: chỉ ẩn hiển thị, nhớ lựa chọn trên máy. Mẫu có sẵn `[ảnh 9eca7149]` |
| Danh sách lớp trang chủ: một dòng mỗi lớp, tối đa 3 lớp rồi "Xem cả 7 lớp"; bỏ hàng "Lối tắt" nhỏ ở đáy | GS TQ-4+TQ-5, HS TQ-5 | NHẬN. Hai tệp khác nhau ở số lớp (3 hay 4): chốt **3**, vì 3 dòng vừa một màn không cuộn |
| Nhắc lịch: một nút "Nhắc cả lớp qua Zalo", danh sách từng em thu gọn; giữ chữ "KiN không gửi giúp" và "Đã mở Zalo lúc…" | GS LI-5, VH L4, HS LI-4 | NHẬN. Không sửa nội dung tin Zalo đang có (xem 1.5) |
| Hộp thoại có ✕ 44px, nút "Đóng" cố định ở chân, thống nhất chữ "Sao chép" | GS LI-6, VH L5+L6, HS LI-6 | NHẬN. Đã có trong ba tệp |
| Một kiểu giờ một kiểu ngày cả màn ("22/10 · 08:42", bỏ giây); chữ xuống 2 dòng thay vì cắt "…" | VH H7+T6, HS TQ-3 | NHẬN |
| Đầu trang Học phí gọn: tiêu đề + ‹ Tháng 10/2026 › 44px, bỏ đoạn mô tả hai dòng; hai nút đầu thành một nút theo bước kế | GS HP-5, VH H5, HS HP-6 | NHẬN |
| Xem trước phiếu như phụ huynh sẽ thấy, xếp dọc: số tiền → khung QR → mã `KIN`+5 ký tự có nút sao chép → chip "Chưa đóng"/"Đã đóng" | GS HP-6, VH H6, HS HP-7 | NHẬN P2. **Khung QR theo đặc tả KiN, không theo ảnh** vì không ảnh nào có QR thật `[RS §3.8]`. Chỉ hiển thị dữ liệu sẵn có, kiểm số tiền xem trước khớp số tiền thật |
| Tab Nhận tiền: đã nối thì một dòng, chưa nối thì mỗi lần một bước | GS HP-7 | NHẬN P3, không đổi thông tin ngân hàng |
| Chi tiết lớp: chấm màu + tên + ba chip, bốn dòng 50px, phần khác gập; vùng nguy hiểm ở cuối | GS LO-5+LO-8, VH C3+C4, HS LO-3 | NHẬN |
| Danh sách học sinh trong lớp: avatar chữ cái, tên, chip chữ ("Đang học", "Chờ phụ huynh xác nhận", "Tạm dừng"); bỏ email, trường, cột "Tiến độ 0/0" | GS LO-7, VH C8, HS LO-6 | NHẬN. **Giảm** dữ liệu trẻ hiển thị, không thêm trường |
| Chữ cảnh báo "Không đổi được sau khi tạo lớp" đặt ngay trên chỗ chọn hình thức học phí | VH C5 | NHẬN chỗ đặt chữ. Việc khoá hay mở là hành vi, không động tới |
| Màu vạch lớp chỉ trang trí; bộ màu lớp bỏ xanh lá, cam, đỏ (đã có nghĩa trạng thái); hôm nay tô token xanh dương, không dùng đỏ | GS LI-7, VH C7, HS LI-5, HL-5 | NHẬN |
| Một cửa "Lớp của tôi" cho học sinh: tab Lớp luôn mở danh sách, thẻ "Toán 9 · Cô Lan · Thứ Sáu 19:00" + nút "Vào lớp"; ẩn vòng tiến độ khi lớp không có bài; sửa khung "Đã hoàn thành khoá học" hiện sai | GS HK-1+HK-2, VH K1, HS HLo-1..3 | NHẬN |
| Lỗi tải có "Thử lại" ở mọi màn; lỗi khác hẳn "không có dữ liệu" | GS TQ-7+HT-4+HL-7, VH T7+S4+M3, HS HN-7 | NHẬN |
| Phòng thi: "Nộp bài" tách khỏi "Câu trước/Câu sau"; nút "Đúng"/"Sai" viết đủ chữ; chữ đáp án ≥ 14px; thanh bước chữa bài một hàng cuộn ngang | GS HB-5+HB-7, VH B3+B5+B8, HS HB-5+HB-7 | NHẬN P2, chỉ đổi vị trí và cỡ, hộp xác nhận nộp bài giữ nguyên |
| Hạn bài tập có giờ và chữ "Còn 2 ngày"; lỗi báo bằng dải trong trang thay `alert()` | GS HB-8, VH B6+B7 | NHẬN hiển thị. Việc bài khoá lúc 07:00 hay cuối ngày là hành vi: CHỜ (xem 1.5) |

### 1.4 Các ý LOẠI, kèm lý do

Chia hai nhóm: dính tiền và dính trẻ em, cộng một nhóm làm dày. Bảng này giữ nguyên để người sau khỏi đề xuất lại.

**Dính tiền (đổi hành vi ghi tiền hoặc cách tính, hoặc nhập tiền)**

| Ý LOẠI | Mã nguồn | Lý do |
|---|---|---|
| Hộp xác nhận hai bước "Bạn đã nhận… từ…?", "Hoàn tác" thao tác tiền, gộp phiếu, tạo nhiều phiếu một lần | GS HP-8, VH H9+H11, HS mục 10 | Đổi hành vi ghi tiền, thêm nút trái hướng bớt dòng. MH-04 §12 để chủ dự án quyết riêng |
| Nhóm nghìn khi gõ trong ô tiền và dòng xem lại "= 560.000đ" | GS HP-8 (LOẠI), VH H4 (P1), HS HP-3 (P1) | **Ba tệp bất đồng.** Quyết: LOẠI vòng này. Lý do: chạm ô nhập tiền, rủi ro hiển thị làm đổi số lưu; chỉ nên làm sau khi thử riêng với số mẫu 560.000đ. Ghi CHỜ chủ dự án |
| Gộp nút phụ của phiếu vào menu "⋯" hoặc "Thêm" | VH H2 (một phần), HS HP-2 (một phần) | Quyết: **chỉ nhận thứ bậc thị giác** (một nút đặc, nút khác hạ thành viền hoặc chữ, đúng như GS HP-3). Việc gấp nút vào menu thuộc hành vi `[MH-04 d.7]`. Nút "Đã nhận tiền" vẫn ở ngoài |
| Chỉ số "tiềm năng" kiểu Sổ Gia Sư (đã thu + chưa thu + dự báo) | VH H10, HS mục 10 | Phép cộng mới, dễ khiến gia sư tưởng tiền chắc chắn `[ảnh a6b8f794]` |
| Hiện "Còn lại 560.000đ" trên **trang chủ** gia sư | HS TQ-4, VH T3 | Cần phép cộng mới ở trang chủ, mặc định MH-01 §12 là không. Trang chủ chỉ giữ số "Đã thu" sẵn có; "Còn lại" nằm ở Học phí |
| Hai thẻ chọn lớn cho báo nghỉ sát giờ ("Không tính phí, giữ 1 buổi bù" / "Tính phí buổi này") | GS LI-8 | Chạm quyết định tính phí, chữ và logic hai nút giữ nguyên `[MH-02 §5]` |
| Nhãn "tính phí / không tính phí" trên điểm danh | RS 3.5 | Ở KiN tiền không phụ thuộc điểm danh `[QD d.103]` |
| Màn mua hoặc nạp Coin; thanh toán thẻ, Apple Pay, buổi học thử có phí, hoa hồng; câu "không bị tính phí đến khi hoàn tất" | HS mục 10, RS 6.1 | Quy tắc cứng. KiN thu học phí theo tháng qua chuyển khoản |
| Mục "Học phí của tôi" trên trang chủ học sinh; mục "Học phí của lớp" cho học sinh xem phiếu và QR; chuyển nơi hiển thị phiếu giữa học sinh và phụ huynh | GS HK-8, VH S7, HS HLo-6 | Tiền đi qua phụ huynh, phiếu ở `/so-cua-con/[token]`. Ranh giới em/phụ huynh cần chủ dự án xác nhận trước khi đổi |
| Đổi cách nhập hay cách tính điểm Azota thang 0–150 | VH B10 | Hành vi tính điểm, không phải giao diện |

**Dính trẻ em (dữ liệu của em, tên em, dữ liệu rời hệ thống)**

| Ý LOẠI | Mã nguồn | Lý do |
|---|---|---|
| Bảng xếp hạng hay tên bạn cùng lớp trên trang chủ, lịch, kết quả; mở rộng Top 10 ra màn khác | GS HT-8+HL-8+HB-9, VH S8+B9, HS HB-6 | Tên đầy đủ của em dưới 16 tuổi. Top 10 trong cổng vào đề **giữ đúng hiện trạng**, chỉ sắp xuống phần gập `[MH-06 §12 câu 9]` |
| Banner "chia sẻ yêu cầu của tôi" cho gia sư khác, gợi ý gia sư khác trên trang chủ; tìm gia sư, đánh giá có tên hoặc ảnh học sinh; ô "Bạn muốn học gì?" làm cổng vào | GS HT-7, VH K6, HS mục 10 | Đưa dữ liệu của em ra ngoài. KiN không phải sàn; em vào bằng mã mời của gia sư |
| Chia sẻ lịch của em ra ngoài ứng dụng cho bạn bè | VH M8 | Như trên |
| Thêm ngày sinh, trường học, địa chỉ, ảnh vào hồ sơ học sinh | HS mục 10, RS 3.6 | Học sinh có thể dưới 16 tuổi |
| Phân quyền người xem ghi chú buổi (học sinh / phụ huynh / riêng tư) | HS mục 10, RS 3.5 | Động tới dữ liệu của trẻ, chưa quyết |
| Thông báo (toast, Zalo, push) chứa tên em hoặc số tiền | HS mục 10 | Quy tắc cứng: chi tiết nằm sau link |
| Thưởng ngẫu nhiên, bảng xếp hạng thi, nội dung cờ bạc, dùng Coin để mở đề | GS HB-9, HS mục 10 | Quy tắc cứng, có thể thành cờ bạc với trẻ |

**Làm dày hoặc trùng ý (LOẠI vì trái mục tiêu)**

| Ý LOẠI | Mã nguồn | Lý do |
|---|---|---|
| Banner vàng "bài sắp hết hạn" trên trang chủ học sinh | HS HN-5, VH (mẫu Wyzant) | Lặp với danh sách "Việc cần làm" đã có chip "Sắp hết hạn"; thêm một khung mà không bỏ gì |
| Minh hoạ lớn cho trạng thái rỗng; thanh 8 bước thiết lập; banner khuyến mãi, bảng giá, mã giảm giá | RS 3.1, 3.7 | Chiếm chiều cao, nhiễu |
| Cam cho "Offline", "Có phép", nhãn Pro | RS 6.1 | Cam của KiN nghĩa là "chờ/còn nợ" |
| Lưới lịch 7 cột × 16 giờ, lưới điểm danh tháng, bảng 6 đến 8 cột | RS 3.2, 3.4, 3.6 | Không dùng được trên điện thoại |
| Kiểm tra xung đột lịch kiểu Teachworks | RS 3.2 | Hành vi thêm, không phải trình bày |

### 1.5 Ba việc CHỜ chủ dự án và một việc chuyển sang kỹ thuật

CHỜ (không đưa vào bản dựng vòng này, nhưng cả ba hướng được thiết kế để không cản đường nếu sau này được duyệt):

1. **Nhóm nghìn và dòng xem lại trong ô nhập tiền** (xem 1.4). Cần thử riêng với số mẫu 560.000đ.
2. **Gộp nút phụ của phiếu vào menu "⋯"**, xác nhận hai bước, hoàn tác (MH-04 §12).
3. **Hạn bài tập khoá lúc 07:00 hay cuối ngày** (MH-06 §9 điểm 21), và việc lưu lại tin "Đã mở Zalo lúc…" sau khi tải lại (MH-02 §9 điểm 11).

Chuyển kỹ thuật (là lỗi, không phải ý tưởng giao diện): ngày "hôm nay" ở lịch học sinh tính theo giờ trình duyệt rồi đổi sang UTC nên lệch một ngày trong 00:00–07:00 (MH-05 Màn B §9 điểm 1; HS HL-2, GS HL-4, VH M1). Thiết kế chỉ cần ghi: mọi ngày hiển thị theo giờ Việt Nam.

Một ràng buộc áp chung: nội dung tin Zalo đã có không bị sửa trong vòng này. Mọi chữ thông báo, toast, tin nhắn **mới** thiết kế đều không chứa tên em và số tiền; chi tiết nằm sau link.

### 1.6 Một điều chỉnh có chủ ý về Coin (hợp nhất bất đồng giữa các tệp)

HS HN-3 muốn bỏ chip Coin khỏi mọi trang; GS HT-6 muốn giữ "120 Coin" một chỗ; VH S3 muốn đổi sang chữ trung tính. Quyết: **chữ "120 Coin" màu trung tính (`--kin-chu-mo`), không phải cam, không bấm được, chỉ ở trang chủ học sinh**, kèm dòng "+5 Coin vì nộp đúng hạn" ở màn Kết quả. Không có nút mua, không nạp, không lối dẫn tới ví để mua.

---

## 2. Ba hướng thiết kế

Ba hướng khác nhau thật ở **đơn vị cơ bản của màn hình** và **trục tổ chức**:

| | Hướng A: Thoáng như sổ tay | Hướng B: Thẻ một con số | Hướng C: Hôm nay là trung tâm |
|---|---|---|---|
| Đơn vị cơ bản | Dòng trên nền phẳng, ngăn bằng đường kẻ mảnh | Thẻ thưa, mỗi thẻ một số lớn và một nhãn nhỏ | Một dòng thời gian hôm nay/tuần, mọi thứ treo vào đó |
| Trục tổ chức | Theo loại việc: việc, buổi, tiền | Theo chỉ số: bao nhiêu việc, bao nhiêu tiền | Theo thời gian: bây giờ, hôm nay, tuần này |
| Điều hướng điện thoại | Thanh dưới 4 mục chữ + icon, phần còn lại ở "Khác" | Thanh dưới 4 mục, màn đầu giống bảng điều khiển | Thanh dưới theo thời gian: Hôm nay · Tuần · Lớp · Tiền |
| Nhìn từ xa | Tờ giấy kẻ dòng | Vài ô số lớn | Ứng dụng lịch |
| Mật độ trung bình/màn đầu | Thấp nhất | Thấp, nhưng khối lớn | Vừa, nhưng đều và theo giờ |

### HƯỚNG A: "Thoáng như sổ tay"

**Nguyên tắc (5 dòng)**
1. Nền phẳng `--kin-nen-trang`, không viền quanh khối; ngăn các mục bằng đường kẻ mảnh `--kin-vien-nhat` và khoảng trắng (`--kin-kc-7`, `--kin-kc-8`).
2. Mọi thứ là danh sách: mỗi dòng cao `--kin-cham-dong` (50px), cả dòng là vùng chạm, bên phải một chữ trạng thái hoặc một mũi tên.
3. Mỗi khối chỉ có **một số lớn** (nếu có); phần còn lại là chữ thường, tối đa hai cấp độ xám (`--kin-chu-chinh`, `--kin-chu-mo`).
4. Một nút đặc `--kin-th-navy` / `--kin-chu-tren-nut-chinh` mỗi màn, đặt ở nửa dưới; nút khác là chữ hoặc viền.
5. Trạng thái luôn là chữ cạnh chấm; màu chỉ làm sáng thêm cho chữ (xanh lá = xong, cam = chờ, đỏ = lỗi thật).

**Vay mượn:** Sổ Gia Sư là nguồn chính (số lớn nhãn nhỏ, tiền xanh lá/cam, một nút đặc mỗi màn, icon mắt, chip trạng thái chữ) `[ảnh 9eca7149]`, `[ảnh 22608da4]`, `[ảnh 486587a8]`. Từ Shub lấy nhịp thưa và câu rỗng một dòng `[ảnh 11a4cd13]`. Từ Preply lấy dải ngày ngang `[ảnh 66e5b5d6]`. Gần Sổ Gia Sư nhất trong ba hướng.

**Gia sư (4 màn)**

- **Tổng quan.** Lời chào một dòng "Chào Cô Lan, Thứ Sáu 23/10". Khối "Việc cần làm": 3 dòng ("2 yêu cầu xác nhận của phụ huynh · Cần xử lý", "1 báo nghỉ sát giờ · Cần xử lý", "1 khoản tiền vào cần đối soát · Chờ bạn") rồi dòng "Xem tất cả 8 việc". Khối "Buổi kế tiếp": một dòng "19:00–20:30 · Toán 9 · 2 học viên" và nút đặc "Vào lớp". Một dòng số "Đã thu tháng 10 · 480.000đ" xanh lá với icon mắt. Cuối cùng 3 dòng lớp rồi "Xem cả 7 lớp". Không hàng "Lối tắt".
- **Lịch.** Dải 7 ngày dính đầu, tự cuộn tới hôm nay. Dưới là danh sách theo ngày: tiêu đề ngày chữ (Thứ Sáu 23/10) rồi các buổi, mỗi buổi một dòng gồm vạch lớp mỏng, giờ đậm, "Toán 9 · 2 học viên", một chip chữ ("Sắp tới"). Chạm dòng mở tờ trượt đáy với nút đặc "Điểm danh" hoặc việc gấp nhất. "Nhắc cả lớp qua Zalo" là một dòng trong tờ trượt.
- **Lớp.** Danh sách dòng: chấm trạng thái + "Toán 9" + "2 học viên" + "Thứ Sáu 19:00", cả dòng mở lớp. Nút "+ Tạo lớp" là thanh cố định đáy, 48px. Trong chi tiết lớp: đầu là chấm + tên + ba chip, dưới là bốn dòng (Điểm danh, Mã mời, Học sinh, Lịch học), "Khác" gập, vùng nguy hiểm ở cuối. Điểm danh: dòng đếm "6 có mặt · 1 muộn · 1 vắng", mỗi em một hàng bốn nút, nút đặc "Tất cả có mặt" ở đáy.
- **Học phí.** Đầu trang một hàng: "Học phí" và ‹ Tháng 10/2026 ›. Dải hai số đứng cạnh nhau: "Đã thu 480.000đ" (xanh lá) và "Còn lại 560.000đ" (cam). Dòng nhắc "1 khoản tiền vào cần đối soát" mở tab Chờ đối soát. Danh sách phiếu mỗi phiếu một dòng: tên, chip chữ ("Nháp", "Đã đóng"), số tiền bên phải (Đỗ Hà 560.000đ cam; Trần Gia Bảo 480.000đ). Một nút đặc theo bước kế: "Gửi phiếu" cho Đỗ Hà; Trần Gia Bảo không nút đặc. Các thao tác còn lại hạ thành chữ/viền, giữ nguyên nhãn.

**Học sinh (4 màn)**

- **Trang chủ.** "Chào buổi chiều, Gia Bảo". Dòng buổi sắp tới "Thứ Sáu 19:00–20:30 · Toán 9 · Cô Lan" với nút đặc "Vào lớp" (chỉ sáng gần giờ). Ba dòng việc theo hạn, mỗi dòng một chữ (Chưa làm, Sắp hết hạn, Chờ chấm), cuối "Xem tất cả". Hết việc: một dòng xanh "Bạn đã xong hết việc hôm nay."; chưa có lớp: câu + ô mã 5 ký tự.
- **Lịch.** Dải 7 ô ≥ 44px, hôm nay tô token xanh dương, chọn ngày viền đậm. Danh sách buổi của ngày chọn mỗi buổi một dòng "19:00–20:30 · Toán 9 · Cô Lan" + chip chữ; buổi huỷ: "Đã huỷ" gạch ngang, nút "Xem lịch". Lọc loại là một chip "Tất cả ▾".
- **Lớp.** Danh sách dòng "Toán 9 · Cô Lan · Thứ Sáu 19:00" + "Vào lớp". Một dòng "Nhập mã mời" luôn ở đầu. Trong lớp: nút đặc "Tiếp tục học", một dòng "Tài liệu và bản ghi · 4 mục"; vòng tiến độ chỉ khi lớp có bài.
- **Bài tập và thi.** Danh sách theo hạn, nhóm "Đang mở" rồi "Sắp diễn ra"; mỗi dòng: tên đề, "Hạn 25/10 · Còn 2 ngày", chip chữ, nút "Vào thi" 44px. Cổng vào đề: một thẻ (tên đề, "60 phút · 40 câu"), quy định gập 3 dòng, nút đặc rộng ở đáy "Bắt đầu làm bài". Phòng thi giữ cấu trúc, thêm chip "Đã lưu". Kết quả: điểm "8,5/10" lớn nhất, một dòng "+5 Coin vì nộp đúng hạn", hai nút "Xem lại" và "Chữa bài".

**Rủi ro của hướng này:** quá phẳng thì các dòng trông giống nhau, mắt phải đọc; cần chữ trạng thái và thứ tự thật chặt để không thành một danh sách dài. Bù lại là hướng ít dựng nhất, nhiều khả năng giữ được mọi chữ và mọi hành vi hiện có.

---

### HƯỚNG B: "Thẻ một con số"

**Nguyên tắc (5 dòng)**
1. Màn đầu là vài thẻ thưa trên nền `--kin-nen-bang`, thẻ nền `--kin-nen-trang`, bo `--kin-bo-the`, mỗi thẻ **một con số lớn và một nhãn nhỏ** bên dưới.
2. Tối đa 3 thẻ trên màn đầu của bất kỳ vai nào; muốn xem thêm thì chạm thẻ để vào màn chi tiết (không nhồi chi tiết vào thẻ).
3. Màu theo hai tầng: **màu nghĩa** (xanh lá, cam, đỏ) chỉ cho trạng thái và tiền; **màu lớp** (vạch mỏng 3px) chỉ để nhận diện lớp, lấy từ bộ token không trùng màu nghĩa.
4. Nút chính nằm trong thẻ hoặc ở thanh đáy, luôn ≥ 44px; mỗi thẻ có đúng một hành động.
5. Dashboard rõ nhưng ít chữ: nhãn thẻ ≤ 3 từ, câu dài chỉ nằm sau khi chạm vào.

**Vay mượn:** Sổ Gia Sư bản desktop (ba thẻ số, hai thẻ tiền, icon mắt) `[ảnh 9eca7149]` và TutorBird (KPI icon tròn + chương trình nghị sự) `[ảnh 2b427782]`; từ Sổ Gia Sư còn lấy thẻ theo học sinh với số cam lớn bên phải `[ảnh 22608da4]`. Cảnh báo cần tránh từ chính hai nguồn này: nhãn KPI dài tràn thẻ, thẻ rỗng chiếm hàng `[ảnh 2b427782]`, `[ảnh 9eca7149]`; vì vậy thẻ rỗng biến mất. Từ Teachworks chỉ lấy ý "đừng nhồi 3×2 thẻ thống kê" `[ảnh b8b4e041]`.

**Gia sư (4 màn)**

- **Tổng quan.** Ba thẻ xếp dọc, mỗi thẻ cao vừa một ngón cái: thẻ 1 "8 · việc cần làm" (số lớn, chip "Cần xử lý", chạm mở danh sách ≤ 3 dòng rồi "Xem tất cả"); thẻ 2 "19:00 · Toán 9" nhãn "Buổi kế tiếp · Thứ Sáu 23/10 · 2 học viên" với nút "Vào lớp"; thẻ 3 "480.000đ · đã thu tháng 10" xanh lá, icon mắt. Thẻ rỗng (0 việc) không dựng, thay bằng dòng xanh một câu. Danh sách lớp không nằm ở màn đầu; chạm thẻ lớp ở tab Lớp.
- **Lịch.** Đầu màn một thẻ tóm tắt tuần ("2 buổi gần nhất" kèm dải 7 ngày). Dưới là mỗi buổi **một thẻ**: vạch lớp, giờ lớn "19:00–20:30", "Toán 9 · 2 học viên", một chip chữ, một nút theo trạng thái ("Điểm danh"). Thẻ Thứ Bảy 24/10 16:00–17:30 Văn 8 thấp hơn (chưa tới giờ nên chỉ có chip "Sắp tới"). Chi tiết buổi là tờ trượt đáy.
- **Lớp.** Mỗi lớp một thẻ cao thống nhất: chấm trạng thái, "Toán 9" lớn, "2 học viên", "Thứ Sáu 19:00", không nút phụ; nút "Điểm danh" chỉ xuất hiện khi lớp có buổi chưa điểm danh. Nút nổi "+ Tạo lớp" đáy phải. Chi tiết lớp bắt đầu bằng ba thẻ nhỏ (học viên, buổi kế, trạng thái) rồi bốn dòng hành động. Điểm danh: thẻ tóm tắt "6 có mặt · 1 muộn · 1 vắng" rồi hàng nút bốn trạng thái.
- **Học phí.** Hai thẻ số ngang nhau đầu màn: "480.000đ" xanh lá nhãn "Đã thu" và "560.000đ" cam nhãn "Còn lại"; chạm thẻ cam lọc các phiếu chưa đóng. Dưới là thẻ phiếu: Đỗ Hà "560.000đ" cam lớn + chip "Nháp" + nút đặc "Gửi phiếu"; Trần Gia Bảo "480.000đ" + chip "Đã đóng", không nút đặc. Dòng "1 khoản tiền vào cần đối soát" là thẻ nhỏ màu chờ (`--kin-tt-chu-cho`) có chữ "Cần bạn quyết".

**Học sinh (4 màn)**

- **Trang chủ.** Thẻ lớn "Buổi sắp tới": "Thứ Sáu 19:00" lớn, "Toán 9 · Cô Lan", nút "Vào lớp". Dưới là một thẻ "Việc cần làm" với số đếm và tối đa 3 dòng chữ trạng thái. Chưa vào lớp: một thẻ duy nhất với ô mã 5 ký tự. Chip "120 Coin" trung tính nhỏ ở góc trên, không bấm được.
- **Lịch.** Dải 7 ô đầu màn, mỗi buổi là một thẻ thấp có giờ bắt đầu–kết thúc, chip chữ. Buổi huỷ: thẻ nền nhạt `--kin-nen-re-chuot` ghi "Đã huỷ", chỉ nút "Xem lịch".
- **Lớp.** Mỗi lớp một thẻ: tên lớp, gia sư, buổi kế tiếp, nút "Vào lớp"; thẻ "Nhập mã mời" nhỏ ở đầu. Trong lớp: thẻ đầu có nút "Tiếp tục học" và vòng tiến độ nếu có bài.
- **Bài tập và thi.** Thẻ "Đang mở" cho mỗi đề: tên, hạn, chip chữ, nút "Vào thi". Cổng vào đề là một thẻ lớn: tên, "60 phút · 40 câu", nút đáy rộng. Kết quả: thẻ điểm "8,5/10" cỡ lớn nhất, thẻ phụ "+5 Coin vì nộp đúng hạn". Phòng thi giữ cấu trúc, chip "Đã lưu" ở góc.

**Rủi ro của hướng này:** thẻ dễ biến thành "hộp trong hộp"; quy tắc "không nhồi chi tiết vào thẻ" phải giữ chặt. Số lớn cũng dễ khiến người ta thêm thẻ số mới (tiềm năng, dự báo): các thẻ đó đã bị LOẠI ở 1.4. Màu lớp cần bộ token riêng, chưa có trong `kin-tokens.css` (hiện chỉ 5 token băm theo id, 7 lớp chắc chắn trùng `[MH-03 §9 điểm 12]`).

---

### HƯỚNG C: "Hôm nay là trung tâm"

**Nguyên tắc (5 dòng)**
1. Mọi màn trả lời một câu theo thời gian: "bây giờ có gì", "hôm nay có gì", "tuần này có gì". Việc, tiền, lớp đều được treo vào một mốc thời gian.
2. Thanh tab dưới có 4 mục theo cách dùng ứng dụng lịch: **Hôm nay · Tuần · Lớp · Tiền** (gia sư) và **Hôm nay · Tuần · Lớp · Bài** (học sinh). "Khác" nằm ở nút tròn góc trên.
3. Dòng thời gian dọc: giờ nằm cột trái (chữ số `--kin-chu-chinh`), nội dung bên phải; mốc "Bây giờ" là một vạch mảnh `--kin-th-xanh-link` có chữ.
4. Việc quá hạn hoặc sắp hết hạn là một dòng nằm đúng chỗ trong dòng thời gian, không ở khối riêng, nên ít khung nhất trong ba hướng.
5. Nút chính luôn là "hành động của mốc hiện tại" (Điểm danh khi buổi vừa xong, Vào lớp khi sắp tới, Gửi phiếu khi tới kỳ), đặt ở đáy trên thanh tab.

**Vay mượn:** ứng dụng lịch nói chung; Sổ Gia Sư lấy vạch giờ hiện tại và khối buổi theo màu lớp `[ảnh 50852205]`; TutorBird lấy chương trình nghị sự theo ngày và vạch màu bên trái thẻ `[ảnh 2b427782]`; Preply lấy dải ngày và nhóm giờ "Buổi chiều / Buổi tối" cho học sinh `[ảnh 66e5b5d6]`, `[ảnh 2c486c98]`; Superprof/Preply là gần nhất ở phía học sinh (một ô tìm hay một nút chính, thanh đầu gọn `[ảnh e8a12f59]`, `[ảnh 6508f5f6]`) nhưng KiN **không** lấy phần sàn (tìm gia sư, đặt lịch học thử, thanh toán thẻ).

**Gia sư (4 màn)**

- **Hôm nay (thay Tổng quan).** Lời chào một dòng. Rồi dòng thời gian của hôm nay, từ trên xuống: các việc quá hạn lên trước ("4 buổi chưa điểm danh · Cần xử lý", "1 báo nghỉ sát giờ · Cần xử lý"), dòng "Bây giờ", buổi kế tiếp "19:00–20:30 · Toán 9 · 2 học viên" với nút "Vào lớp" hoặc "Điểm danh" tuỳ giờ, rồi dòng "Ngày mai · Thứ Bảy 24/10 · 16:00–17:30 Văn 8". Hai việc còn lại ("2 yêu cầu xác nhận của phụ huynh", "1 khoản tiền vào cần đối soát") xếp ở cuối như "Chờ bạn" với chip chữ. Hôm nay trống: nói rõ và hiện buổi kế tiếp. Số "Đã thu tháng 10 · 480.000đ" là một dòng nhỏ ở chân, có icon mắt.
- **Tuần (thay Lịch).** Dải 7 ngày dính đầu, ngày chọn viền đậm. Dưới là dòng thời gian của ngày chọn, kèm bộ chuyển ‹ Tuần trước · Tuần này · Tuần sau ›. Buổi là khối có vạch lớp; chạm mở tờ trượt đáy. Nhắc lịch qua Zalo là một dòng trong tờ trượt.
- **Lớp.** Vẫn danh sách dòng như Hướng A nhưng sắp theo thời gian: lớp có buổi hôm nay đứng trước, ghi "Hôm nay 19:00", rồi "Thứ Bảy 16:00". Nút nổi "+ Tạo lớp". Điểm danh mở từ dòng thời gian, không từ danh sách lớp.
- **Tiền (thay Học phí).** Dải hai số trên cùng: "Đã thu 480.000đ" xanh lá và "Còn lại 560.000đ" cam; ‹ Tháng 10/2026 ›. Dưới là các phiếu xếp theo mốc: "Chờ đối soát" lên trước, rồi "Nháp" (Đỗ Hà 560.000đ, nút đặc "Gửi phiếu"), rồi "Đã đóng" (Trần Gia Bảo 480.000đ, gập mặc định). Tab "Nhận tiền" nằm ở hàng chip nhỏ, đã nối thì một dòng.

**Học sinh (4 màn)**

- **Hôm nay.** Chào một dòng. Dòng thời gian của hôm nay: buổi "19:00–20:30 · Toán 9 · Cô Lan" (nút "Vào lớp" từ lúc gần giờ), rồi hạn bài tập đặt đúng giờ hạn ("Hạn 25/10 · Còn 2 ngày"). Hết việc: một dòng xanh. Chưa vào lớp: câu + ô mã.
- **Tuần.** Dải 7 ngày to, danh sách theo ngày chọn bằng cùng thành phần dòng thời gian; buổi huỷ ghi "Đã huỷ", gạch ngang; tuần đã qua ghi rõ "Chưa lưu lịch sử buổi đã học".
- **Lớp.** Danh sách thẻ gọn "Toán 9 · Cô Lan · Thứ Sáu 19:00" với "Vào lớp"; nút "Nhập mã mời" ở đầu. Trong lớp: nút đặc "Tiếp tục học".
- **Bài.** Danh sách theo hạn nộp (đúng như hiện có, thêm chữ "Còn N ngày" và chip trạng thái). Cổng vào đề một thẻ một nút đáy; phòng thi giữ cấu trúc, chip "Đã lưu"; kết quả điểm lớn và dòng Coin thưởng.

**Rủi ro của hướng này:** đổi tên và đổi vai trò tab (Tổng quan thành Hôm nay, Học phí thành Tiền) là thay đổi điều hướng lớn nhất trong ba hướng; "Tiền" cũng có thể gợi mua bán với học sinh nên **phía học sinh không có tab Tiền, dùng tab Bài**. Cần kiểm tra chữ "Tiền" có hợp với gia sư không; có thể giữ nhãn "Học phí". Dòng thời gian cần dữ liệu giờ chuẩn theo giờ Việt Nam (xem 1.5), và hôm nào ít buổi thì màn khá trống: phải xử lý bằng dòng "Buổi kế tiếp".

---

## 3. Điểm chung cần chốt trước khi dựng, bất kể hướng nào

1. **Thứ tự màn đầu gia sư** (RS 3.1 chưa phân xử được vì không có ảnh điện thoại): ba hướng đã cố ý chọn ba thứ tự khác nhau để chủ dự án nhìn bản dựng rồi chọn. A: việc → buổi → tiền. B: ba thẻ (việc, buổi, tiền) ngang cấp. C: thời gian, việc quá hạn lên trước.
2. **Bộ chữ trạng thái dùng chung, mỗi trạng thái đúng một cách viết:** "Cần xử lý", "Chờ bạn", "Nháp", "Đã đóng", "Sắp tới", "Đang diễn ra", "Đã kết thúc", "Đã huỷ", "Đã dời", "Đang học", "Chờ phụ huynh xác nhận", "Tạm dừng", "Chưa làm", "Sắp hết hạn", "Chờ chấm", "Đã nộp", "Đã lưu", "Chưa lưu được, đang thử lại".
3. **Màu nghĩa:** xanh lá `--kin-tt-chu-xong` = xong hoặc đã thu; cam `--kin-tt-chu-cho` = chờ hoặc còn lại; đỏ `--kin-tt-chu-loi` = lỗi thật hoặc quá hạn; xanh dương `--kin-th-xanh-link` = hôm nay hoặc liên kết. Màu lớp chỉ là vạch mảnh.
4. **Cỡ chạm:** nút ≥ `--kin-cham-toi-thieu` (44px), dòng danh sách `--kin-cham-dong` (50px), đáp án thi `--kin-cham-dap-an` (52px). Chuông, ✕, "Gửi lại", chip ngày trong dải đều đạt 44px.
5. **Trạng thái rỗng:** một câu, tối đa một nút, không minh hoạ lớn. Trạng thái lỗi: một dải chữ + nút "Thử lại" 44px.
6. **Hộp thoại:** tờ trượt đáy, ✕ 44px ở góc, "Đóng" ở chân, đóng được bằng nền và phím Esc.
7. **Ngày giờ:** giờ 24h, tuần bắt đầu thứ Hai, "dd/mm", một kiểu "22/10 · 08:42"; luôn theo giờ Việt Nam.
8. **Thông báo ngoài ứng dụng:** không tên em, không số tiền; chi tiết sau link.

---

## 4. Tiêu chí chấm chung (thang 1–5, dùng cho cả ba hướng)

Mỗi hướng được chấm trên **mười tiêu chí** dưới đây, theo hai bước: (a) dựng bản mô phỏng khung điện thoại 390px cho 8 màn với dữ liệu mẫu ở mục 0; (b) chấm bằng danh sách kiểm. Điểm 5 là đạt đủ; điểm 3 là đạt nhưng có 1–2 chỗ cần sửa; điểm 1 là vi phạm quy tắc. Năm tiêu chí **bắt buộc** (T4, T5, T6, T7, T9, đều là quy tắc cứng) mà bất kỳ tiêu chí nào dưới 4 điểm thì hướng đó **không được chọn**, bất kể tổng điểm.

| # | Tiêu chí | Điểm 5 là | Điểm 1 là | Cách kiểm |
|---|---|---|---|---|
| T1 | **Thoáng** | Màn đầu của mỗi vai không cuộn quá 1,5 màn; số khung có viền ≤ 3; khoảng trắng giữa các nhóm ≥ `--kin-kc-7` | Phải cuộn hơn 3 màn; khung lồng khung; hàng nút ngang hàng ≥ 4 | Đếm khung viền, số dòng chữ, số nút mỗi màn ở 390px; so với hiện trạng (MH-01 đến MH-06 mục 9) |
| T2 | **Ưu tiên thông tin** | Việc gấp nhất thấy được trong 2 giây không cuộn; chỉ một nút đặc mỗi màn | Việc gấp nằm sau hai dòng tiện ích; nhiều nút đặc tranh nhau | Thử 2 giây: người xem trả lời được "việc gì cần làm trước?" |
| T3 | **Đủ dữ liệu** | Mọi trường hiện có mà người dùng cần ra quyết định vẫn truy cập được ≤ 2 chạm (giờ kết thúc, sĩ số, hạn, số tiền, trạng thái) | Mất trường hiện có hoặc phải đoán nghĩa | Lập bảng trường hiện có đối chiếu với bản mô phỏng; không trường nào mất |
| T4 | **Đúng chữ bắt buộc** | Giữ nguyên chữ nhãn trong đặc tả cho các nút liên quan tiền và báo nghỉ ("Gửi phiếu", "Sao chép tin nhắn", "KiN không gửi giúp", chữ hai nút báo nghỉ sát giờ…); mọi trạng thái có chữ | Đổi chữ nút tiền; trạng thái chỉ bằng màu hoặc chữ tắt "K", "P", "Đ", "S" | Đọc từng nhãn so với `man-hinh/*.md`; tắt màu (thang xám) vẫn phân biệt được mọi trạng thái |
| T5 | **Đúng token** | 100% màu qua `--kin-*`; không mã màu viết tay; màu lớp không trùng màu nghĩa; sáng và tối đều đủ tương phản | Có mã màu viết tay; xanh lá/cam dùng cho thứ không phải trạng thái | Tìm trong bản dựng mã màu không phải biến `--kin-*`; thử chế độ tối |
| T6 | **Nút chạm ≥ 44px** | Mọi vùng chạm (nút, chip ngày, ✕, chuông, "Gửi lại", dòng) ≥ 44px cả hai chiều | Có nút < 44px ở màn học sinh hoặc hộp thoại | Đo vùng chạm bằng công cụ trình duyệt trên 8 màn |
| T7 | **Điện thoại không tràn** | Ở 390px và 320px không cuộn ngang; không chữ bị cắt "…" ở dòng có thông tin quan trọng (tên em, giờ); số tiền dài `560.000đ` không đẩy bố cục | Cuộn ngang; chữ bị cắt mất giờ hay tên | Quét tràn ngang cả 8 màn ở 390px và 320px, chữ lớn 130% |
| T8 | **Một tay** | Hành động chính ở nửa dưới màn, trong vùng ngón cái; không cần với lên góc trên cho việc thường làm | Nút chính ở góc trên (như "Thêm lớp" cũ) | Thử ngón cái trên khung 390 x 844 |
| T9 | **An toàn tiền và trẻ em** | Không đổi cách tính phiếu/đối soát; không thêm thu thập dữ liệu; không màn mua Coin; không tên bạn cùng lớp; thông báo không tên em, không số tiền; Top 10 giữ nguyên hiện trạng | Có một mục trong 1.4 xuất hiện lại | Lập danh sách kiểm theo mục 1.4 và 3 điểm 8 |
| T10 | **Gọn trong dựng** | Dùng lại thành phần hiện có, ít thành phần mới nhất; ước lượng số thành phần phải viết mới ≤ 6 | Cần viết lại hệ thành phần hoặc đổi điều hướng toàn app | Đếm thành phần mới so với các thành phần đang dùng trong `src/` (chỉ đọc, không sửa) |

### 4.1 Cách chấm và cách chọn

- Tổng 10 tiêu chí, tối đa 50. Ngưỡng đạt: **≥ 40** và không tiêu chí bắt buộc nào dưới 4.
- Trọng số khuyến nghị khi hoà điểm: T2 và T7 nặng hơn (chủ dự án nhấn mạnh "thoáng, dễ dùng" và "chủ yếu điện thoại"), sau đó T3.
- Khuyến nghị chấm bởi ít nhất hai người độc lập (một người trưởng sản phẩm, một người từ phía gia sư thật hoặc học sinh thật, nếu được), rồi lấy trung bình.

### 4.2 Chấm sơ bộ của người soạn (chưa phải kết quả, chỉ để định thứ tự dựng)

Chấm bằng đọc bố cục ở mục 2, **chưa** dựng nên chưa đo T1, T6, T7 thật. Điểm dưới đây cần thay bằng điểm đo sau khi có bản mô phỏng.

| Tiêu chí | A | B | C | Nhận xét ngắn |
|---|---|---|---|---|
| T1 Thoáng | 5 | 4 | 3 | A ít khung nhất; B có thẻ nên có viền; C có dòng thời gian cộng khối đáy |
| T2 Ưu tiên thông tin | 4 | 5 | 4 | B cho thấy số lớn nhất; A cần thứ tự chặt; C tốt khi ngày có nhiều buổi |
| T3 Đủ dữ liệu | 5 | 3 | 4 | B giấu chi tiết sau lần chạm thứ hai |
| T4 Đúng chữ bắt buộc | 5 | 4 | 3 | C đổi tên tab (Tiền) nên cần rà lại chữ |
| T5 Đúng token | 4 | 3 | 4 | B cần bộ token màu lớp mới |
| T6 Nút ≥ 44px | 5 | 4 | 4 | A dùng dòng 50px sẵn |
| T7 Điện thoại không tràn | 5 | 4 | 4 | Số tiền lớn trong thẻ B cần thử ở 320px |
| T8 Một tay | 4 | 4 | 5 | C đặt hành động theo mốc ở đáy |
| T9 An toàn tiền và trẻ em | 5 | 5 | 4 | C đụng điều hướng và tên tab "Tiền" |
| T10 Gọn trong dựng | 5 | 3 | 2 | C đổi tab và dòng thời gian mới |
| **Tổng sơ bộ** | **47** | **39** | **37** | |

Kết luận sơ bộ (để chủ dự án xem, không thay cho việc xem bản dựng): **A là nền an toàn nhất**; B nên mượn **dải hai số của Học phí và thẻ số lớn ở trang chủ** để dùng lẻ trong A nếu chủ dự án thích; C nên mượn **"hôm nay là mốc"** (việc quá hạn lên trước, buổi kế tiếp nổi, tab Lịch mở tại hôm nay) để dùng lẻ trong A. Phần chung ở 1.2 và mục 3 làm được trước cả khi chọn hướng.

---

## 5. Điều chưa kiểm chứng

- Không ảnh nào trong 102 ảnh là điện thoại dọc của sản phẩm gia sư, nên mọi bố cục điện thoại ở mục 2 là suy luận từ bản rộng (RS 6.3).
- Không ảnh nào có mã QR thật hay màn phòng thi; khung QR và phòng thi theo đặc tả KiN, không theo ảnh. Mọi ý về bài tập và thi là thiết kế riêng, chưa có đối thủ đỡ lưng (RS 4.7).
- Một số lỗi trong đặc tả là suy từ mã chưa chạy thử (MH-02 §9 điểm 7, 9, 19; MH-05 Màn C §9 điểm 9). Nên chạy thử trước khi dựng.
- Điểm sơ bộ ở 4.2 là đọc bố cục, chưa đo trên bản dựng.
- Tên token màu lớp cụ thể cho Hướng B chưa chốt; hiện chỉ có 5 token băm theo id (MH-03 §9 điểm 12).
