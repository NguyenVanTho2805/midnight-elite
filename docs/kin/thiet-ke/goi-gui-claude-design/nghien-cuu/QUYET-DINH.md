# Quyết định hướng thiết kế KiN: chọn Hướng A "Thoáng như sổ tay"

Soạn 22/10/2026 bởi giám đốc thiết kế. Tài liệu thiết kế, không sửa mã `src/`. Căn cứ: `DINH-HUONG.md`, và ảnh chụp 390px của cả ba hướng (Tổng quan, Lịch, Học phí của cả ba; thêm Lớp, Trang chủ học sinh, Bài tập, Lịch học sinh của Hướng A, Trang chủ học sinh của B và C). Điểm tự chấm trong ba báo cáo của ba nhà thiết kế không dùng chung thang (B chấm trên thang 5, A và C trên thang 10) nên **không so điểm với nhau**; quyết định dựa trên ảnh và ba tiêu chí của chủ dự án: thoáng, dễ dùng, ít dày.

## 1. Hướng thắng: A "Thoáng như sổ tay"

## 2. Lý do (8 dòng)

1. **Ít khung nhất.** A là một cột dòng trên nền phẳng, ngăn bằng đường kẻ mảnh; B dựng thẻ có nền riêng, thẻ nằm trong thẻ (thẻ "8 việc cần làm" chứa dòng việc, rồi thêm thẻ buổi, thẻ tiền). Ảnh Tổng quan 390px của A thoáng nhất, kể cả khi đã có đủ việc, buổi, lớp.
2. **Điều hướng giữ nguyên, nhẹ.** A dùng thanh dưới 5 mục (Hộp việc, Lịch, Lớp, Học phí, Khác); học sinh 5 mục (Việc của tôi, Lịch, Lớp, Bài tập, Khác). C đẩy lên 7 mục ở gia sư, mỗi mục chừng 55px, nhãn "Bài KT", "Thư viện" chen nhau và đổi tên tab thành "Hôm nay"/"Tuần": trái "ít rối" và phải dạy lại người dùng cũ.
3. **Một nút đặc mỗi màn, nút còn lại hạ xuống chữ hoặc viền.** Học phí A: "Gửi phiếu" cho Đỗ Hà là nút duy nhất, Trần Gia Bảo không có nút đặc. B đặt "Lập phiếu cả lớp" thành nút ở góc trên phải (vùng khó với tay một tay) và C có hai nút cạnh nhau ở Học phí cộng sticky "Vào lớp" ở đáy.
4. **Đủ dữ liệu mà không thêm.** A giữ giờ bắt đầu–kết thúc, sĩ số, hạn, số tiền, mã phiếu `KINTQF43`; không thêm số mới trái luật (không "Phải thu", không "tiềm năng"). C thêm "Phải thu tháng này 1.040.000đ" và "Còn lại" ở trang chủ, đúng điều mục 1.4 đã LOẠI.
5. **Không vượt luật cứng.** A đạt: không mã màu viết tay, trạng thái luôn chấm cộng chữ, nút ≥ 44px (đã đo lại 8 trang), không tràn ngang ở 390px, Coin chỉ là chữ mờ không bấm được, không màn mua Coin.
6. **Học phí rõ nhất.** Dải "Đã thu 480.000đ" xanh lá và "Còn lại 560.000đ" cam đứng cạnh nhau, dòng nhắc đối soát một dòng, mỗi phiếu một dòng. Cách trình bày thay đổi, cách tính phiếu và đối soát giữ nguyên.
7. **Ít dựng nhất, ít rủi ro nhất.** Gần giao diện hiện có nhất (điểm sơ bộ trong `DINH-HUONG.md` mục 4.2 cũng cho A đứng đầu về T10); đổi cách xếp, không đổi hành vi, không đổi điều hướng.
8. **Dễ mở rộng.** Mọi thứ là dòng 50px nên thêm trạng thái hay màn mới không phải thiết kế lại thành phần; hai hướng kia cần thêm bộ token màu lớp (B) hoặc dòng thời gian mới (C).

## 3. Điểm mạnh và yếu của hai hướng thua

### Hướng B "Thẻ một con số"

Mạnh:
- Lịch dạng thẻ có vạch lớp mảnh và một nút "Xử lý" duy nhất rất dễ đọc, dòng "4 buổi đã qua giờ, chưa điểm danh xong · Điểm danh" lấp được loại việc thứ tư mà A bỏ sót.
- Dải hai thẻ số ở Học phí và dòng "Cần bạn quyết" cho khoản đối soát cân đối.
- Ở Trang chủ học sinh, thẻ "Buổi sắp tới" tách rõ khỏi danh sách việc.

Yếu:
- Mỗi thẻ có nền, bo góc, chip: hộp trong hộp, trái "ít dày".
- Học phí bốn khối (nút góc trên, thẻ nhắc, hai thẻ phiếu) gần như thẻ nào cũng có viền riêng.
- Số tiền cam lớn trong thẻ ở 320px chưa được thử; "Lập phiếu cả lớp" ở góc trên khó với.
- Điểm dữ liệu hay bị bỏ: ví dụ Tổng quan mất danh sách lớp.

### Hướng C "Hôm nay là trung tâm"

Mạnh:
- Ý "mốc hiện tại": việc quá hạn lên trước, đường "Bây giờ", buổi kế tiếp nổi bật, là cách trả lời "việc gì ngay bây giờ" trực tiếp nhất.
- Cột giờ bên trái (19:00 trên, 20:30 dưới) đọc nhanh.
- Học sinh có "Cần làm / Đã xong" và "Còn 2 ngày" hữu ích.
- Nút chính sát đáy nằm đúng vùng ngón cái.

Yếu:
- Dày nhất: Tổng quan có đủ đỏ, cam, xanh dương, xanh lá, nhãn "Quá hạn"/"Sát giờ" ở cột trái, "Học phí không đổi", đường kẻ, mục "Đang chờ", dòng tiền, "Trạng thái khác".
- Lịch một ngày mở sẵn dài khoảng 900px, nhiều nút viền.
- Thanh tab 7 mục.
- Đổi tên và vai trò tab (Hôm nay/Tuần/Tiền) là thay đổi điều hướng lớn nhất.
- Hai dòng thông tin đã qua giờ ("Quá hạn" cộng "Sát giờ") dùng màu đỏ, trong khi đỏ chỉ dành cho lỗi thật.

## 4. DANH SÁCH SỬA trên Hướng A (12 mục)

Đường dẫn gốc: `docs/kin/thiet-ke/mockups/huong-a/`. Sửa xong chụp lại ảnh 390px và 1280px vào `anh/`.

1. **`tong-quan.html`, `styles.css`: đưa Việc cần làm lên đầu, dải số xuống dưới.** Hiện dải "Học viên đang học / Lớp đang dạy / Đã thu" nằm trên khối việc nên việc gấp bị đẩy sau ba con số. Thứ tự mới: lời chào, Việc cần làm, Buổi kế tiếp, Đã thu tháng 10 (mắt), Các lớp. Đổi `<h1>` từ "Lớp của tôi" thành "Hộp việc" để khớp tab. Bỏ cặp "Học viên đang học / Lớp đang dạy" khỏi màn này (đã có ở "Lớp: 7 lớp · 8 học viên").
2. **`tong-quan.html`: chọn ba dòng việc đúng độ gấp.** Hiện ba dòng cộng lại chỉ 4 trên 8 việc, thiếu "4 buổi chưa điểm danh". Ba dòng: báo nghỉ sát giờ, buổi chưa điểm danh, khoản cần đối soát; "2 yêu cầu xác nhận của phụ huynh" nằm ở "Xem tất cả 8 việc". Cùng bộ chữ trạng thái ở mọi nơi: "Cần xử lý", "Chờ bạn", "Chờ phụ huynh xác nhận" (hiện lẫn "Chờ đối soát", "Chờ phụ huynh").
3. **Tất cả tệp gia sư và học sinh: thống nhất "hôm nay" là Thứ Sáu 23/10.** Hiện hôm nay là Thứ Năm 22/10 nên "Hôm nay không có buổi dạy nào" lẫn với "báo nghỉ sát giờ 45 phút" của buổi Thứ Sáu, mâu thuẫn. Đổi lời chào, dải ngày (T6 23 là hôm nay), dòng "Hôm nay" của `lich.html`, `hs-lich.html`, `hs-trang-chu.html`; bỏ dòng "Hôm nay không có buổi dạy nào" khỏi `tong-quan.html` và `lich.html`.
4. **`lich.html`: thẻ buổi chỉ một nút đặc.** Chi tiết buổi đang có một nút đặc "Không tính phí, giữ 1 buổi bù" và bốn đến năm liên kết chữ cùng cấp (Tính phí buổi này, Nhắc cả lớp, Dời buổi, Huỷ buổi, Soạn kế hoạch). Giữ nguyên chữ hai nút báo nghỉ sát giờ; đưa Dời buổi, Huỷ buổi, Soạn kế hoạch, Nhắc cả lớp qua Zalo vào một dòng "Việc khác với buổi này" gập sau tờ trượt. Điều này mượn thứ bậc từ B (một việc chính).
5. **`lich.html`: dải điều hướng tuần gọn lại.** Hàng "← Tuần trước / Tuần này / Tuần sau →" đổi thành một hàng nút 44px có nút "Hôm nay" (mượn từ C), dải 7 ngày dính đầu, tự cuộn tới ngày hôm nay. Đẩy dòng "Gửi lịch tuần qua Zalo" xuống chân danh sách như một dòng, không giữa trang.
6. **`lop.html`: tách chi tiết lớp khỏi danh sách.** Hiện danh sách 7 lớp, nút "Tạo lớp mới", rồi khối "Lớp đang xem: Toán 9" với điểm danh dài dùng chung một trang, trang rất dày. Đổi thành hai màn: `lop.html` chỉ có danh sách và nút "Tạo lớp mới" (cố định đáy, 48px, trên thanh tab); chi tiết lớp và điểm danh sang `lop-chi-tiet.html` mới (mockup), mở bằng chạm cả dòng lớp. Giữ nguyên: bốn nút điểm danh 44px, nút "Tất cả có mặt", dòng "Điểm danh không ảnh hưởng đến học phí."
7. **`hoc-phi.html`: giảm liên kết trong thẻ phiếu.** Phiếu Đỗ Hà có một nút đặc rồi hai hàng liên kết (Sao chép tin nhắn, Sửa số tiền, Huỷ phiếu, Xem trước phiếu). Giữ nút đặc "Gửi phiếu" và dòng "Sao chép tin nhắn"; "Sửa số tiền", "Huỷ phiếu", "Xem trước phiếu như phụ huynh sẽ thấy" vào một dòng "Thao tác khác" gập (mượn từ C); không đổi chữ, không đổi vị trí của "Đã nhận tiền". Đưa "Lập phiếu cả lớp" thành dòng ở chân danh sách giữ nguyên. Gập "Đã đóng" khi có từ hai phiếu trở lên (mẫu một phiếu thì để mở).
8. **`styles.css`: nâng cỡ chữ tối thiểu.** Nhãn thanh tab, huy hiệu đếm (hiện 13px) lên 14px, tách "Việc của tôi" thành "Việc" hoặc cho phép 2 dòng (đừng cắt, đừng nhỏ lại); chữ phụ giữ 14px. Kiểm lại ở 320px sau khi nâng; chữ phóng 130% không tràn.
9. **Mọi tệp: bỏ khối "Trạng thái khác" khỏi cuối trang chính.** Đây là phần trình diễn trạng thái rỗng, đang tải, lỗi nhưng nằm ngay dưới nội dung thật như thành phần của màn, làm thêm một dòng ở mỗi màn. Chuyển hết sang một tệp riêng `trang-thai.html` có mục lục theo màn; mỗi màn thật chỉ giữ liên kết nhỏ tới đó ở `index.html`. Giữ nguyên chữ: "Không tải được …" cộng "Thử lại" 44px, "Bạn chưa vào lớp nào", "Không có việc nào đang chờ bạn."
10. **`hs-trang-chu.html`, `hs-bai-tap.html`: thêm hạn dạng "Còn N ngày", thống nhất Coin.** Dòng việc ghi "hạn 23:59 hôm nay", "hạn 21:00 25/10" đổi thành "Hạn 25/10 21:00 · Còn 2 ngày" cùng một kiểu ngày giờ (mượn từ C). Chữ Coin ở đầu trang: dùng một giá trị cho Gia Bảo, trong mẫu hiện A ghi "58 Coin" còn B, C ghi "120 Coin"; chốt **120 Coin** theo `DINH-HUONG.md` mục 1.6, màu `--kin-chu-mo`, không bấm được, không nút nạp.
11. **`hs-lop.html`: bỏ trùng và hạ ô mã mời.** Trang đang có một thẻ "Toán 9 · Vào lớp" rồi tiêu đề "Trong lớp: Toán 9" với nút "Tiếp tục học", lặp tên lớp. Gộp thành một thẻ: dòng lớp, nút "Tiếp tục học" nằm ngay dưới; "Nhập mã mời" xuống cuối trang (mượn từ B) và chỉ lên đầu khi em chưa có lớp nào. Bỏ vòng tiến độ khi lớp không có bài.
12. **`hs-bai-tap.html`, `index.html`: chốt tên tab và khoá việc cần chủ dự án.** Đặc tả vỏ học sinh ghi tab "Thư viện" còn bản mẫu ghi "Bài tập": ghi rõ trong `index.html` "Bài tập (chờ chủ dự án chốt)" và giữ "Bài tập". Mục "Đề thi thử" tách khỏi "Cần làm" bằng khoảng trắng `--kin-kc-8`; một nút đặc "Vào thi" chỉ ở bài đang mở. Ghi vào `index.html` bốn điểm CHỜ: nhóm nghìn khi gõ tiền, gộp nút phiếu vào menu "⋯", bài khoá 07:00 hay cuối ngày, lưu "Đã mở Zalo lúc…".

## 5. Điểm mượn từ hướng khác

| Mượn | Từ | Dùng ở đâu | Điều kiện |
|---|---|---|---|
| Nút "Hôm nay" cạnh điều hướng tuần | C | `lich.html` (mục 5) | Một hàng, 44px, không thêm khối |
| Một việc chính mỗi thẻ buổi, việc phụ ẩn | B | `lich.html` (mục 4) | Giữ chữ hai nút báo nghỉ sát giờ |
| Dòng "4 buổi đã qua giờ, chưa điểm danh xong" như một loại việc | B | `tong-quan.html` (mục 2) | Là dòng trong danh sách, không dải vàng riêng |
| "Thao tác khác" và "Đã đóng · N phiếu" gập | C | `hoc-phi.html` (mục 7) | Nút "Đã nhận tiền" vẫn ở ngoài |
| "Hạn … · Còn N ngày" | C | `hs-trang-chu.html`, `hs-bai-tap.html` (mục 10) | Ngày giờ theo giờ Việt Nam |
| Ô mã mời hạ xuống cuối khi đã có lớp | B | `hs-lop.html` (mục 11) | Lên đầu khi chưa có lớp |
| Thứ tự ưu tiên "việc quá hạn lên trước" | C | `tong-quan.html` (mục 2) | Chỉ sắp thứ tự dòng, không đổi tên tab |

Không mượn, vì trái luật hoặc làm dày: nút dính đáy "Vào lớp · Toán 9 · 19:00" của C (làm thêm một nút đặc ngoài nút của khối buổi kế tiếp, trái "một nút đặc mỗi màn"); "Phải thu tháng này" và "Còn lại" ở trang chủ (đã LOẠI ở mục 1.4); nhãn đỏ "Quá hạn"/"Sát giờ" ở cột trái (đỏ chỉ cho lỗi thật); chuông thông báo; đổi tên tab thành "Hôm nay"/"Tuần"/"Tiền".

## 6. Việc còn lại sau khi sửa

- Chưa kiểm ở 768px và 1024px, chưa đo tương phản ở chế độ sáng và các chủ đề màu khác.
- Cần người thật (một gia sư, một học sinh) thử 2 giây trên Tổng quan: "việc gì làm trước?".
- Điều hướng "Hôm nay" và "Tiền" của C không được thử; nếu chủ dự án muốn dòng thời gian, đặt vòng sau, không trộn vào vòng này.
