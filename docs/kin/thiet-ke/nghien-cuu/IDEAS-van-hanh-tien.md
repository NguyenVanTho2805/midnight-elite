# Ý tưởng giao diện góc nhìn "Vận hành, học phí và tin cậy"

Soạn 22/10/2026. Tài liệu thiết kế, không sửa mã. Góc nhìn: không nhầm tiền, rủi ro rõ, đối soát rõ, trạng thái luôn có chữ, không đổi cách tính.

Nguồn: `RESEARCH-TONG-HOP.md` (viết tắt RS, theo mục), đặc tả `man-hinh/01..06` (viết tắt MH-0N, theo mục 9 "Điều chưa tốt"), bộ ảnh Sổ Gia Sư và các bên khác (`[ảnh xxxxxxxx]`).

## Cách đọc

- **Mức ưu tiên**: P1 làm trước, P2 làm sau khi P1 xong, P3 để dành.
- **Độ khó**: Dễ (chỉ đổi bố cục/chữ/token), Vừa (đổi cấu trúc màn nhưng không đổi dữ liệu), Khó (cần dữ liệu hoặc hành vi mới).
- **Rủi ro tiền/trẻ em**: *Không* nghĩa là chỉ đổi cách trình bày, không đụng cách tính phiếu, đối soát, không thêm dữ liệu trẻ em. Ý nào đụng tiền hoặc trẻ em ở mức hành vi hay dữ liệu thì ghi **LOẠI** và không đưa vào vòng thiết kế này; chỉ ghi lại để chủ dự án biết đã cân nhắc.
- Mọi ý tưởng đều theo hướng bớt khung, bớt dòng, bớt nút. Không ý nào thêm hàng mới vào màn khi không có việc.
- Màu chỉ qua token `--kin-*`; trạng thái luôn có chữ; nút chạm từ 44px; thông báo ra ngoài không chứa tên em hay số tiền.

---

## 1. Tổng quan gia sư (trang chủ gia sư và Hộp việc)

Hiện trạng cần sửa: hai màn (Tổng quan, Hộp việc) cùng một việc nhưng khác chữ, khác đích bấm; Tổng quan bị giấu; buổi muộn hôm nay hiện hai lần; "Việc cần làm" phân biệt khẩn chỉ bằng màu `[MH-01 §9 mục 1, 2, 3, 5]`.

### P1

**T1. Một khối "Việc cần làm", chỉ hiện khi có việc, gộp Hộp việc vào**
- Vấn đề: Hai màn trùng nhau, bộ đếm lệch chữ, đích bấm không khớp (consent, ungraded rơi về danh sách lớp) `[MH-01 §9 mục 1]`. Khi mọi việc bằng 0 vẫn dựng thẻ rỗng to `[ảnh 9eca7149]`.
- Cách giải: Một danh sách duy nhất, mỗi dòng một chữ và một nút: "2 yêu cầu xác nhận của phụ huynh", "1 báo nghỉ sát giờ", "1 khoản cần đối soát", "4 buổi chưa điểm danh". Bấm đi thẳng đúng lớp, đúng ngày. Khi bằng 0: một dòng "Không có việc cần làm", không thẻ.
- Vì sao: SGS đặt việc lên đầu nhưng để thẻ rỗng chiếm hàng; bài học là chỉ hiện khi có `[RS §3.1]`. Chữ "Cần xử lý" thay cho màu đơn độc `[MH-01 §9 mục 5]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không. Dòng "1 khoản cần đối soát" chỉ là bộ đếm, không số tiền, không tên em.

**T2. Xếp việc gấp theo mức độ, mỗi việc ghi hạn bằng chữ**
- Vấn đề: Mọi việc cùng cỡ, báo nghỉ sát giờ (có hạn) ngang hàng buổi chưa điểm danh.
- Cách giải: Báo nghỉ sát giờ đứng đầu, kèm nhãn chữ "Sát giờ"; khoản cần đối soát thứ hai; còn lại sau. Không thêm cột, chỉ đổi thứ tự và thêm một nhãn chữ ngắn.
- Vì sao: Màu không được nói một mình `[MH-01 §9 mục 5]`; thứ tự khi bằng nhau đang khác giữa hai màn `[MH-01 §9 mục 1]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**T3. Hai số tiền, hai màu nghĩa, ẩn được bằng icon mắt**
- Vấn đề: Trang chủ không cho thấy tiền ngay; con số quan trọng không nổi `[MH-01 §9 mục 14]`, `[MH-04 §9 mục 2]`.
- Cách giải: "Đã thu tháng 10: 480.000đ" (xanh lá) và "Còn lại: 560.000đ" (cam), icon mắt che số khi mở app trước mặt người khác. Chỉ hiển thị lại số đã có; không phép cộng mới. Nếu chủ dự án chưa duyệt phép cộng "còn lại" ở trang chủ (mặc định MH-01 là không) thì ý này chỉ làm ở màn Học phí (xem H1).
- Vì sao: Thẻ một số lớn, một nhãn nhỏ, icon mắt `[ảnh 9eca7149]`, `[RS §3.1]`.
- Độ khó: Dễ nếu chỉ dùng số đã có.
- Rủi ro tiền/trẻ em: Thấp. Phép cộng mới trên trang chủ chưa được duyệt, nên trong vòng này chỉ được dùng số đang hiển thị ở Học phí.

**T4. Sửa buổi hôm nay hiện hai lần và dòng buổi cụt thông tin**
- Vấn đề: Buổi 19:00 hôm nay nằm cả ở "Hôm nay" lẫn "Sắp tới"; dòng buổi mất giờ kết thúc và sĩ số `[MH-01 §9 mục 3, 4]`.
- Cách giải: Một danh sách "Hôm nay" rồi "Sắp tới" không trùng; mỗi dòng "19:00–20:30 · Toán 9 · 2 học viên", bấm vào đúng buổi. Khi hôm nay trống thì nói thẳng và hiện buổi kế tiếp: Thứ Sáu 23/10 19:00–20:30.
- Vì sao: Chi tiết giờ và vạch màu lớp trong agenda `[ảnh 2b427782]`; trạng thái rỗng một câu `[ảnh 11a4cd13]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P2

**T5. Bỏ khung viền lồng nhau, dùng dải phân cách**
- Vấn đề: 4 thẻ có viền màu trên cùng, mỗi việc là một thẻ viền trái, bị chê dày `[MH-01 §9 mục 7]`.
- Cách giải: Bỏ viền thẻ; mỗi nhóm cách nhau bằng khoảng trắng và một đường mảnh. Chỉ một nút đặc trên cả màn.
- Vì sao: Học từ hàng thẻ gọn của SGS và nhịp thưa của Shub `[ảnh 9eca7149]`, `[ảnh 11a4cd13]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**T6. Không cắt chữ "…" ở dòng phụ; xuống dòng thay vì cắt**
- Vấn đề: Hộp việc cắt đúng chỗ có thông tin quan trọng nhất `[MH-01 §9 mục 8]`.
- Cách giải: Tiêu đề tối đa hai dòng, dòng phụ xuống dòng. Nhưng thông báo ra ngoài vẫn không chứa tên em, số tiền (chỉ trong màn đã đăng nhập).
- Vì sao: Quy tắc "không chữ bị cắt" trong `BRIEF.md` (nêu ở MH-01).
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp. Phải giữ nguyên nguyên tắc không đẩy tên em/số tiền ra ngoài ứng dụng.

**T7. Khung xương khớp hình dạng màn thật**
- Vấn đề: Hai khung xương khác nhau nối nhau; lỗi tải lần đầu để "Đang tải…" mãi `[MH-01 §9 mục 10, 11]`.
- Cách giải: Một khung xương một cột (3 dòng việc, 2 dòng buổi) và khi lỗi hiện một dòng "Không tải được. Thử lại" thay cho khung xương. Làm cho trạng thái luôn có chữ.
- Vì sao: Trạng thái rõ là tinh thần chung của nhóm này; SGS không có khung xương nhưng có toast ngắn `[ảnh c35687c2]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3

**T8. Thanh thiết lập chỉ hiện khi chưa xong**
- Vấn đề: Gia sư mới không biết bước kế.
- Cách giải: Một dải 3 chấm (Tạo lớp, Thêm học viên, Nhận tiền) biến mất khi xong; không dùng 8 bước.
- Vì sao: Thanh bước thiết lập của TW `[ảnh b8b4e041]`, thu gọn lại.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

---

## 2. Lịch gia sư

Hiện trạng: nhiều khung viền lồng nhau, ba huy hiệu xếp cột, mọi chữ phụ cùng độ xám, mỗi em 4 nút "Soạn & mở Zalo" giống hệt, hộp thoại không có ✕, không tự cuộn tới hôm nay `[MH-02 §9 mục 1-6, 14, 19]`.

### P1

**L1. Dải 7 ngày, tự cuộn tới hôm nay, một thẻ một buổi**
- Vấn đề: Vào giữa tuần thấy buổi đầu tuần đã qua trước, buổi hôm nay ở xa `[MH-02 §9 mục 19]`.
- Cách giải: Dải T2…CN, hôm nay tô đặc, chấm nhỏ ở ngày có buổi, mở là cuộn tới hôm nay. Thẻ buổi có vạch màu lớp, giờ in đậm, chip trạng thái bằng chữ (Sắp tới, Đang diễn ra, Đã kết thúc, Đã huỷ).
- Vì sao: Dải ngày ngang `[ảnh 66e5b5d6]`, vạch đỏ giờ hiện tại và khối theo màu lớp `[ảnh 50852205]`; lưới 7 cột không dùng được trên điện thoại `[RS §3.2]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

**L2. Một huy hiệu trạng thái bằng chữ, phần còn lại thu vào chi tiết**
- Vấn đề: "Đã dời" + "1 báo nghỉ sát giờ" + "2 tin nhắc chờ gửi" xếp ba tầng, thẻ cao hẳn, ép tên lớp `[MH-02 §9 mục 2]`.
- Cách giải: Thẻ chỉ giữ một huy hiệu quan trọng nhất (ưu tiên: báo nghỉ sát giờ, rồi đã dời, rồi nhắc chờ). Mọi thứ còn lại nằm trong chi tiết buổi. Thẻ thấp đi, bớt dòng.
- Vì sao: SGS chỉ đặt dấu trạng thái ở góc thẻ `[ảnh 50852205]`; chi tiết mở khi chạm `[ảnh 190a8682]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không. Đây là trình bày; hành vi báo nghỉ và buổi bù giữ nguyên.

**L3. Chi tiết buổi: việc gấp lên đầu, bỏ khung lồng**
- Vấn đề: Chi tiết là chồng 5 khối, việc gấp (báo nghỉ chờ) sau hai dòng tiện ích; mỗi em một khung viền con trong một khung `[MH-02 §9 mục 1, 6]`.
- Cách giải: Thứ tự: báo nghỉ đang chờ, điểm danh, đổi lịch, nhắc lịch; link vào lớp và kế hoạch buổi thu thành hàng icon nhỏ ở trên cùng. Mỗi em một dòng, không viền.
- Vì sao: Hàng icon nhỏ ở trên và một nút Điểm danh rộng ở đáy `[ảnh 190a8682]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

### P2

**L4. Nhắc lịch: một nút "Nhắc cả lớp", chi tiết từng em để thu gọn**
- Vấn đề: 3 em thành 12 nút "Soạn & mở Zalo" giống hệt, dễ bấm nhầm `[MH-02 §9 mục 5]`.
- Cách giải: Mặc định một nút duy nhất cho cả buổi; mở rộng mới thấy từng em. Nhãn nút nói rõ mốc ("Nhắc trước 24 giờ", "Nhắc trước 1 giờ"). Không đổi nội dung tin; tin nhắn vẫn không chứa tên em hay số tiền khi đi ra ngoài.
- Vì sao: Bớt nút ngang hàng; quy tắc thông báo `[RS §3.9]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Thấp. Tin nhắn Zalo đã có quy tắc riêng; không thêm dữ liệu trẻ em.

**L5. Hộp thoại có nút ✕ và thanh nắm kéo**
- Vấn đề: Hộp chỉ đóng bằng Esc hoặc bấm nền; trên điện thoại ít người biết `[MH-02 §9 mục 14]`.
- Cách giải: Mọi hộp có ✕ vùng chạm 44px ở góc, kèm một nút "Để sau" thống nhất.
- Vì sao: Hộp sửa có chân cố định Huỷ và Cập nhật `[ảnh 6b52ce72]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**L6. Thống nhất chữ "Sao chép tin" và bỏ câu sai trên điện thoại**
- Vấn đề: "Sao chép" và "Chép tin" lẫn nhau; câu "Sẽ mở Zalo của {số}" sai trên điện thoại vì dùng bảng chia sẻ `[MH-02 §9 mục 13, 15]`.
- Cách giải: Một chữ cho một việc; câu phụ chỉ nói "Chọn người nhận trong Zalo".
- Vì sao: Chữ nhất quán giảm nhầm; trạng thái nói đúng điều sẽ xảy ra.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3

**L7. Đổi tuần có khung chờ, không nháy "Tuần này chưa có buổi"**
- Vấn đề: Đổi tuần thì danh sách mờ và trống, có thể nháy câu rỗng giả `[MH-02 §9 mục 9, 10]`.
- Cách giải: Giữ dải ngày, danh sách hiện 2 dòng khung xương trong lúc tải; câu rỗng đọc đúng tuần đang xem ("Tuần 27/10 chưa có buổi").
- Vì sao: Trạng thái đúng chữ là mục tiêu của nhóm này.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**L8. Giữ tin "Đã mở Zalo lúc…" sau khi tải lại**
- Vấn đề: Tin xử lý báo nghỉ chỉ sống trong phiên; tải lại là mất `[MH-02 §9 mục 11]`.
- Cách giải: Đọc lại từ dữ liệu đã lưu thay vì state tạm.
- Vì sao: Mất việc đã làm là lỗi tin cậy.
- Độ khó: Khó (cần lưu thêm trạng thái).
- Rủi ro tiền/trẻ em: Thấp, nhưng đổi hành vi lưu dữ liệu. **Tạm thời để chờ chủ dự án quyết**, không đưa vào vòng thiết kế.

---

## 3. Lớp gia sư (danh sách, chi tiết, tạo lớp)

Hiện trạng: không có lối tạo lớp khi đã có lớp; chi tiết lớp là trung tâm liên kết; danh sách 7 lớp dài đều tăm tắp; ngăn tạo lớp 13 ô; chữ "khoá học" lẫn "lớp"; chạm dưới 44px `[MH-03 §9 mục 1, 3, 7, 8, 9, 13]`.

### P1

**C1. Nút "Thêm lớp" đặt gần tay, mở ngăn kéo ngắn một ô**
- Vấn đề: Chỉ có "Tạo lớp đầu tiên" lúc rỗng; thêm lớp phải đi vòng qua trang quản trị `[MH-03 §9 mục 1, 8]`.
- Cách giải: Nút tròn hoặc thanh dưới cùng "Thêm lớp" luôn thấy. Ngăn kéo chỉ hỏi tên lớp, thứ + giờ, số tuần; mọi thứ khác ẩn dưới "Thêm tuỳ chọn". Nút cuối ghi hậu quả: "Tạo lớp + 8 buổi".
- Vì sao: Wizard 3 bước, nút cuối đổi nhãn theo hậu quả `[ảnh cdbd1f37]`; bước 3 nhồi nhiều khối là chỗ tránh `[RS §3.3]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không. Không thêm trường dữ liệu mới; các ô thừa (Slug, Cloudinary, Giá gốc) chỉ được ẩn, không xoá.

**C2. Thẻ lớp gọn: ưu tiên lớp có buổi hôm nay, 4 lớp rồi "Xem tất cả"**
- Vấn đề: 7 lớp × 3 liên kết chiếm gần hết màn; không ưu tiên lớp có buổi hôm nay `[MH-03 §9 mục 13]`.
- Cách giải: Mỗi thẻ: tên lớp, chấm trạng thái + chữ, "2 học viên", một nút chính "Mở lớp". Điểm danh và danh sách học sinh đưa vào trong lớp. Lớp có buổi hôm nay đứng trước, ghi "Hôm nay 19:00".
- Vì sao: Chip trạng thái thay đoạn văn `[ảnh 486587a8]`; pill lọc gọn `[ảnh b03b9eb4]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**C3. Đầu chi tiết lớp: chấm màu + tên + ba chip, thêm một dòng "Việc của lớp này"**
- Vấn đề: Chi tiết lớp chỉ là bảy mục dẫn đi nơi khác; "Học phí" và "Cộng đồng" trong lớp lại mở trang của cả tài khoản `[MH-03 §9 mục 3, 4]`.
- Cách giải: Một đầu trang gọn (hình thức học phí, số buổi, số học viên), rồi buổi kế tiếp, rồi việc riêng của lớp (buổi chưa điểm danh, em chờ xác nhận). Liên kết sang trang cả tài khoản ghi rõ "Học phí của tất cả lớp".
- Vì sao: Đầu chi tiết lớp bằng ba chip `[ảnh 486587a8]`; hành động nguy hiểm gom xuống cuối.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

### P2

**C4. "Vùng nguy hiểm" ở cuối: Kết thúc lớp, Xoá lớp**
- Vấn đề: Nút phá huỷ đứng cạnh nút thường.
- Cách giải: Gom xuống cuối, nền khác, chữ rõ hậu quả. Chỉ đổi chỗ đặt, không đổi điều kiện cho phép xoá.
- Vì sao: `[ảnh 486587a8]`, `[ảnh b1ba0bf8]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**C5. Nói trước điều không đổi được ngay trước chỗ chọn**
- Vấn đề: Hình thức học phí khoá sau khi tạo `[RS §3.3]`; nếu báo sau, gia sư chọn nhầm và lúng túng.
- Cách giải: Dòng "Không đổi được sau khi tạo lớp" nằm ngay trên các lựa chọn, khi sửa lớp hiện thành chip chỉ đọc. Chỉ là chỗ đặt chữ; việc khoá hay mở là hành vi.
- Vì sao: Cảnh báo trước lúc chọn `[ảnh 139b0933]`, chip chỉ đọc `[ảnh 6b52ce72]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp. Không động tới cách tính; nếu chủ dự án muốn mở khoá thì đó là hành vi, tách riêng.

**C6. Nhập mã mời: ô 5 ký tự, một nút, một đường quay lại**
- Vấn đề: Mã lớp là cách học viên vào; ô nhỏ thì khó nhập `[ảnh ef4f8038]`.
- Cách giải: Ô mã lớn, ký tự cách nhau, nút rộng, "Quay lại" ngay dưới.
- Vì sao: Mẫu Shub, bỏ nền xanh đặc choá mắt `[RS §4.5]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3

**C7. Màu lớp chọn được từ một bảng nhỏ, tránh trùng màu nghĩa**
- Vấn đề: Chỉ 5 token băm theo id nên 7 lớp chắc chắn trùng; xanh lá và cam đang là màu nghĩa `[MH-03 §9 mục 12]`, `[MH-02 §9 mục 8]`.
- Cách giải: Một bảng màu lớp riêng không dùng xanh lá, cam, đỏ (đã có nghĩa); tên lớp luôn bằng chữ. Chỉ dùng token.
- Vì sao: SGS cho chọn 25 màu nhưng dùng icon không chữ `[RS §3.2]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

**C8. Mỗi em một dòng trạng thái bằng chữ trong danh sách học sinh**
- Vấn đề: Danh sách trộn em chờ xác nhận và em tạm dừng mà không có chữ, sĩ số lệch `[MH-03 §9 mục 10]`.
- Cách giải: Chip chữ "Đang học", "Chờ phụ huynh xác nhận", "Tạm dừng". Bỏ thanh "Tiến độ 0/0 (0%)" khi lớp không có bài học.
- Vì sao: Avatar chữ cái + tag trạng thái `[ảnh 32187a31]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp. Chỉ bày dữ liệu đã có; không thêm trường dữ liệu trẻ em.

---

## 4. Học phí gia sư

Màn dính tiền nên mọi ý ở đây chỉ trình bày. Hiện trạng: quá nhiều khung; dải tổng bốn ô cùng cỡ; năm nút ngang hàng ở phiếu đã gửi; khoản chờ đối soát chỉ là chữ `(1)`; đỏ dùng quá tay; ô tiền không nhóm nghìn; hộp thoại không có ✕ `[MH-04 §9]`.

### P1

**H1. Dải tổng hai số, hai màu nghĩa**
- Vấn đề: Bốn ô cùng cỡ chữ 18px, "Còn lại" không nổi, "Đã thu" không xanh lá `[MH-04 §9 mục 2]`.
- Cách giải: Hai số lớn: "Đã thu 480.000đ" (xanh lá) và "Còn lại 560.000đ" (cam), mỗi số một nhãn nhỏ. Số phiếu và Phải thu nhỏ lại thành dòng phụ. Dùng đúng số máy đã tính; không phép cộng mới.
- Vì sao: Dải tổng cam khi chưa thu, xanh lá khi đã thu `[ảnh 22608da4]`, `[ảnh c740944e]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không (chỉ trình bày số đã có).

**H2. Thẻ phiếu: một nút đặc, số tiền to bên phải, nhãn không lặp**
- Vấn đề: 8 phiếu thành 24 cặp nhãn–số; phiếu đã gửi 5 nút; nhiều nút "chính" `[MH-04 §9 mục 3, 4]`.
- Cách giải: Thẻ: tên học viên + trạng thái chữ ở trái, số tiền lớn ở phải, một dòng phụ "Toán 9 · tháng 10". Nút đặc duy nhất theo trạng thái: Đỗ Hà "Nháp" có "Gửi phiếu"; Trần Gia Bảo "Đã đóng" không nút đặc. Các thao tác còn lại ("Sao chép tin nhắn", "Sửa số tiền", "Huỷ phiếu") gom vào menu "Thêm". Chỉ đổi chỗ đặt nút; điều kiện cho phép từng thao tác giữ nguyên.
- Vì sao: Thẻ theo học sinh, số cam lớn bên phải, nút ở chân thẻ `[ảnh 22608da4]`; dữ liệu mẫu `[RS §3.4]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Thấp. Đưa nút vào menu không đổi hành vi; riêng việc ẩn nút "Đã nhận tiền" vào menu cần chủ dự án duyệt vì dễ khiến gia sư tưởng không thể ghi tiền, nên để "Đã nhận tiền" vẫn ở ngoài.

**H3. Khoản chờ đối soát thành dải nhắc có chữ, đỏ chỉ khi sai thật**
- Vấn đề: Việc gấp nhất chỉ là chữ `(1)` trong nhãn tab; mọi loại khác "Khớp đủ" đều đỏ `[MH-04 §9 mục 7, 8]`.
- Cách giải: Trên đầu tab Phiếu một dòng "1 khoản tiền vào cần đối soát" bấm sang tab Chờ đối soát. Trong tab đối soát: "Không có mã" và "Đóng dư" dùng nhãn trung tính "Cần bạn quyết"; chỉ lỗi thật mới dùng màu lỗi. Nhãn luôn có chữ.
- Vì sao: Cảnh báo tại chỗ có nút Bỏ qua `[ảnh 1cd39a2b]`; màu không nói một mình.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Thấp. Không đổi cách ghép, chỉ đổi cách gọi tên trạng thái. Không số tiền trong thông báo ngoài ứng dụng.

**H4. Ô tiền nhóm nghìn và dòng xem lại "= 560.000đ"**
- Vấn đề: Ô chỉ nhận chữ số, không nhóm nghìn, dễ gõ thừa số 0 `[MH-04 §9 mục 10]`.
- Cách giải: Nhóm nghìn khi gõ, dưới ô một dòng "= 560.000đ" bằng chữ nhỏ; trong hộp Sửa số tiền và Ghi nhận tiền. Không đổi giá trị lưu, chỉ hiển thị.
- Vì sao: Xác nhận số tiền rõ trong hộp `[RS §3.4]`; tổng tiền lặp lại ngay trong nút `[ảnh d2a216a5]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp (chỉ trình bày), nhưng phải thử kỹ để định dạng không làm đổi số lưu.

### P2

**H5. Đầu trang ngắn: bỏ đoạn mô tả, ô chọn tháng có mũi tên trước/sau**
- Vấn đề: Đầu trang dài, chiếm nửa màn đầu; Tháng là `<select>` 12 mục `[MH-04 §9 mục 6, 15]`.
- Cách giải: Tiêu đề một dòng + tháng với ‹ › ; hai nút đầu màn gộp thành một nút chính theo trạng thái ("Lập phiếu cả lớp" hoặc "Gửi 1 phiếu nháp"). Bỏ đoạn mô tả hai dòng.
- Vì sao: Chọn nhanh khoảng thời gian, mặc định tháng kế `[ảnh 26fe8fc3]`; dải ngày/tháng có mũi tên cạnh tiêu đề `[ảnh 48daa960]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**H6. Phiếu xem trước một thẻ: tổng cộng nổi, QR, mã `KIN`, nút "Sao chép tin nhắn"**
- Vấn đề: Gia sư không thấy phiếu như phụ huynh sẽ thấy `[MH-04 §9 mục 13]`.
- Cách giải: Xem trước xếp dọc trên điện thoại: bảng Khoản thu, dòng Tổng cộng nổi bật, khung QR, nội dung chuyển khoản sao chép được, một nút chia sẻ. Dùng đúng nội dung phiếu và mã đã có.
- Vì sao: Bảng Khoản thu và dòng Tổng cộng `[ảnh 1ceeb24f]`; mã tự điền, sao chép được `[ảnh 6c1629f4]`. Lưu ý: không ảnh nào có QR thật `[RS §3.8]`, nên khung QR theo đặc tả KiN, không theo ảnh.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Thấp. Không đổi nội dung phiếu. Phải kiểm số tiền trên phiếu xem trước khớp số tiền thật.

**H7. Một kiểu giờ, một kiểu ngày trong cả màn**
- Vấn đề: Tab đối soát in cả giây `08:42:10 22/10/2026`, tab Phiếu in `19:05 ngày 21/10` `[MH-04 §9 mục 9]`.
- Cách giải: Mọi nơi "22/10 · 08:42".
- Vì sao: Nhất quán giảm đọc sai.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**H8. Trạng thái rỗng một câu một nút ở mọi tab**
- Vấn đề: Rỗng tab Phiếu nhắc "ở trang quản khoá" không có liên kết; rỗng đối soát chỉ một câu `[MH-04 §9 mục 16]`.
- Cách giải: Tab Phiếu rỗng: "Chưa có phiếu tháng 10" + nút "Lập phiếu". Tab đối soát rỗng: "Không có khoản nào chờ. Tiền chuyển đúng mã sẽ tự gạch." Nhận tiền chưa nối: "Chưa nối SePay" + nút.
- Vì sao: Rỗng thân thiện một câu `[ảnh 11a4cd13]`, `[ảnh 02db8767]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3 (một số ý bị LOẠI)

**H9. Hoàn tác thao tác tiền và hộp xác nhận hai bước (LOẠI)**
- Vấn đề: Thao tác "Đã nhận tiền" thực hiện ngay, không hoàn tác `[MH-04 §9 mục 12]`.
- Cách giải: SGS có hộp xác nhận nêu số tiền và tên, và Hoàn tác trong Lịch sử thu `[ảnh 510dc007]`.
- **LOẠI** khỏi vòng này: đây là hành vi dính tiền, đổi cách ghi nhận, nên chờ chủ dự án quyết riêng (MH-04 đã ghi là mục 12, không tự sửa). Nếu sau này làm thì toast không chứa tên và số tiền.
- Độ khó: Khó.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

**H10. Chỉ số "tiềm năng" kiểu SGS (đã thu + chưa thu + dự báo) (LOẠI)**
- Cách giải: Cộng dự báo buổi đã lên lịch.
- **LOẠI**: là chỉ số của SGS, một phép cộng mới, đổi cách tính (`[RS §3.4]`). Có nguy cơ gia sư tưởng tiền chắc chắn `[ảnh a6b8f794]`.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

**H11. Gộp phiếu, tạo nhiều phiếu một lần (LOẠI)**
- Cách giải: Thêm thao tác hàng loạt như SGS.
- **LOẠI**: thêm hành vi ghi tiền và thêm nút, trái hướng bớt dòng `[ảnh 22608da4]`.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

**H12. Tìm và lọc phiếu theo tên, theo trạng thái**
- Vấn đề: Với 20 học viên danh sách dài `[MH-04 §9 mục 14]`.
- Cách giải: Chỉ khi có trên 8 phiếu mới hiện một ô tìm và ba chip (Nháp, Chưa đóng, Đã đóng); dưới 8 thì ẩn để màn thoáng.
- Vì sao: Ô tìm + pill lọc một hàng `[ảnh b03b9eb4]`, `[ảnh 1c5d46fe]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

---

## 5. Học sinh: Trang chủ ("Việc của tôi")

Học sinh có thể dưới 16 tuổi, dùng điện thoại. Hiện trạng: em mới không có lối nhập mã mời; chip Coin màu cam mọi trang; dòng danh sách cắt "…"; lỗi tải kẹt "Đang tải…" `[MH-05 Màn A §9 mục 1, 2, 4, 5]`.

### P1

**S1. Em chưa vào lớp: một câu một nút "Nhập mã mời"**
- Vấn đề: Danh sách trống ghi "Bạn đã xong hết", sai nghĩa với em chưa có lớp `[MH-05 Màn A §9 mục 1]`.
- Cách giải: "Bạn chưa vào lớp nào" + nút "Nhập mã mời" (ô 5 ký tự). Không minh hoạ lớn.
- Vì sao: Trạng thái rỗng một câu một nút `[ảnh 2e32d1cb]`, ô mã 5 ký tự `[ảnh ef4f8038]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không (không thêm dữ liệu cá nhân).

**S2. Khối "Hôm nay có gì": buổi sắp tới và việc cần làm, mỗi mục một chữ trạng thái**
- Vấn đề: Danh sách dòng cao 3 tầng, bị cắt "…", không biết cái nào gấp `[MH-05 Màn A §9 mục 4, 9]`.
- Cách giải: Trên cùng một thẻ buổi: "Thứ Sáu 19:00–20:30 · Toán 9 · Cô Lan" và nút "Vào lớp". Dưới là danh sách ngắn việc cần làm với chữ "Hạn hôm nay", "Chưa làm", "Đã nộp". Tối đa ba mục, thêm "Xem tất cả".
- Vì sao: Khối chia theo câu hỏi "hôm nay có gì" `[ảnh 11a4cd13]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

**S3. Chip Coin đổi thành chữ trung tính, không cam, không nổi**
- Vấn đề: Cam đang mang nghĩa "chờ/còn nợ"; chip tranh chú ý với việc cần làm; emoji thay biểu tượng `[MH-05 Màn A §9 mục 5]`.
- Cách giải: Số Coin nhỏ, màu trung tính, có chữ "Coin", ở góc đầu trang. Không có nút mua, không nạp Coin (Coin chỉ nhận thưởng khi làm bài). Đây là ý chỉ đổi trình bày chip hiện có.
- Vì sao: Quy tắc cứng về Coin `[RS §6.1]`; thanh đầu gọn `[ảnh e8a12f59]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp. Phải kiểm rằng thiết kế không gợi ý mua Coin.

### P2

**S4. Lỗi tải: một dòng "Không tải được, Thử lại", không kẹt "Đang tải…"**
- Vấn đề: Lỗi lần đầu, danh sách trống, khung đọc ghi "Đang tải…" như treo `[MH-05 Màn A §9 mục 2]`.
- Cách giải: Dòng lỗi có chữ và một nút Thử lại ngay vị trí danh sách.
- Vì sao: Trạng thái rõ.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**S5. Chạm một lần mở thẳng việc, bỏ bước khung đọc trên điện thoại**
- Vấn đề: Việc có sẵn nút lệnh nhưng phải qua 3 chạm `[MH-05 Màn A §9 mục 9]`.
- Cách giải: Mỗi việc có một nút hành động ngay trên dòng ("Làm bài", "Vào lớp"); chạm vào dòng vẫn mở chi tiết.
- Vì sao: Một hành động chính mỗi màn `[RS §4.8]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

**S6. Chuông thông báo vùng chạm 44px, icon thay emoji, không số tiền trong thông báo**
- Vấn đề: Chuông 36px, bảng chuông dùng emoji, ✕ 24px `[MH-05 Màn A §9 mục 10]`.
- Cách giải: Vùng chạm 44px, bộ icon KiN. Thông báo chỉ nói loại việc ("Bài sắp hết hạn"), không tên em, không số tiền.
- Vì sao: Quy tắc nút và thông báo.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp.

### P3 (LOẠI)

**S7. Thẻ "Học phí của tôi" ngay trang chủ (LOẠI)**
- Cách giải: Hiện số tiền cần đóng ở trang chủ học sinh.
- **LOẠI**: học sinh dưới 16 tuổi, đưa số tiền cha mẹ phải đóng lên màn của trẻ là rủi ro; đặc tả cũng ghi không đưa tiền học phí vào màn này `[RS §4.1]`.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

**S8. Bảng xếp hạng bạn cùng lớp trên trang chủ (LOẠI)**
- **LOẠI**: lộ tên đầy đủ trẻ dưới 16 tuổi, thêm áp lực; theo MH-06 mục 9 đã ghi là quyết định của chủ dự án.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

---

## 6. Học sinh: Lịch học

Hiện trạng: ngày tính theo giờ trình duyệt rồi đổi UTC nên có thể lệch một ngày; buổi đã huỷ vẫn có "Vào học"; lỗi tải hiện như không có lịch; tuần đã qua trống không giải thích; đỏ vừa là "hôm nay" vừa là "nghỉ/quá hạn"; quá dày `[MH-05 Màn B §9]`.

### P1

**M1. Dải 7 ngày, hôm nay có chữ, ngày lệch giờ Việt Nam đã đúng**
- Vấn đề: Lưới 8 nút ngày ~38px rộng, dưới 44px; "Hôm nay" có thể sai từ 00:00 đến 07:00 `[MH-05 Màn B §9 mục 1, 7]`.
- Cách giải: Dải 7 chip ngày, ngày chọn viền đậm, hôm nay ghi chữ "Hôm nay". Chạm ≥ 44px. Ngày hôm nay luôn tính theo giờ Việt Nam (đây là sửa tính đúng, không đổi dữ liệu).
- Vì sao: Dải ngày ngang, ngày chọn viền đậm `[ảnh 66e5b5d6]`, `[ảnh 2c486c98]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

**M2. Buổi đã huỷ: chữ "Đã huỷ", không nút "Vào học", bỏ tiền tố `[ĐÃ HUỶ]` trong tên**
- Vấn đề: Buổi huỷ vẫn dẫn vào lớp; tên mang tiền tố thô `[MH-05 Màn B §9 mục 2]`.
- Cách giải: Chip trạng thái "Đã huỷ" hoặc "Đã dời sang 25/10" thay tiền tố; nút chỉ còn "Xem lịch".
- Vì sao: Việc của tôi đã xử lý đúng; kéo cho khớp.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**M3. Lỗi tải hiện "Không tải được lịch, Thử lại", không giả làm "không có buổi nào"**
- Vấn đề: Lỗi bị nuốt, hiện câu rỗng như thật `[MH-05 Màn B §9 mục 3]`.
- Cách giải: Hai trạng thái tách bạch: rỗng thật và lỗi.
- Vì sao: Trạng thái rõ.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P2

**M4. Thẻ buổi một dòng: giờ bắt đầu–kết thúc, lớp, cô giáo**
- Vấn đề: Chỉ có giờ bắt đầu dù có `endTime`; thẻ viền riêng cho từng sự kiện `[MH-05 Màn B §9 mục 5, 7]`.
- Cách giải: "19:00–20:30 · Toán 9" một dòng, bỏ viền, ngăn cách bằng đường mảnh. Bỏ bốn ô thống kê đầu trang.
- Vì sao: Vạch màu bên trái thẻ buổi, giờ in đậm `[ảnh 2b427782]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**M5. Đỏ không dùng cho "hôm nay"**
- Vấn đề: Đỏ đang là nghỉ/quá hạn nhưng ô hôm nay cũng đỏ `[MH-05 Màn B §9 mục 6]`.
- Cách giải: Hôm nay dùng màu thương hiệu của KiN (token), đỏ dành cho huỷ/quá hạn; chữ nút dùng token chữ trên nút, không `text-white`.
- Vì sao: Bảng màu nghĩa của KiN.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**M6. Tuần đã qua có câu giải thích**
- Vấn đề: "Tuần trước" dẫn tới trang trống không lời `[MH-05 Màn B §9 mục 4]`.
- Cách giải: Câu "Lịch tuần đã qua chưa xem được" hoặc ẩn nút khi không có dữ liệu.
- Vì sao: Rỗng một câu.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3

**M7. Chip loại (Buổi học, Thi thử) chỉ hiện khi có cả hai loại**
- Cách giải: Bớt một hàng chip; có nhiều loại mới hiện.
- Vì sao: Bớt dòng.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**M8. Lịch có chia sẻ ra ngoài cho bạn bè (LOẠI)**
- **LOẠI**: đưa lịch học của trẻ dưới 16 tuổi ra ngoài ứng dụng; ngoài phạm vi.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

---

## 7. Học sinh: Lớp của tôi

Bằng chứng ảnh yếu: chỉ Shub và Wyzant `[RS §4.5]`.

### P1

**K1. Thẻ lớp gọn: tên lớp, cô giáo, buổi kế tiếp, một nút "Vào lớp"**
- Vấn đề: Bảng nhiều cột đếm số trên điện thoại `[ảnh b03b9eb4]`.
- Cách giải: Mỗi lớp là một dòng thẻ không viền: "Toán 9 · Cô Lan · Thứ Sáu 19:00", nút "Vào lớp". Không bảng, không số đếm.
- Vì sao: `[RS §4.5]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**K2. Nhập mã mời luôn ở đầu trang**
- Vấn đề: Lối tới nhập mã nằm rải rác `[MH-05 Màn A §9 mục 1]`.
- Cách giải: Một nút phụ "Nhập mã mời" ở đầu danh sách lớp, mở ô 5 ký tự, một nút, một "Quay lại".
- Vì sao: `[ảnh ef4f8038]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P2

**K3. Chữ trạng thái của em trong lớp**
- Cách giải: Chip "Đang học", "Chờ phụ huynh xác nhận". Chỉ dùng dữ liệu đã có.
- Vì sao: Tag trạng thái bằng chữ `[ảnh 32187a31]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp (chờ phụ huynh xác nhận đã là quy trình hiện có).

**K4. Trạng thái rỗng: một câu, một nút, không minh hoạ lớn**
- Cách giải: "Bạn chưa vào lớp nào" + "Nhập mã mời". Không hình lớn chiếm màn.
- Vì sao: `[ảnh 0b5e59f8]` là chỗ tránh, `[ảnh 2e32d1cb]` là chỗ theo.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3

**K5. Thông tin cô giáo tối thiểu: tên và nút nhắn**
- Cách giải: Chỉ tên cô và liên kết nhắn; không ảnh, không số điện thoại.
- **Lưu ý**: không thêm thu thập dữ liệu cá nhân của học sinh.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp.

**K6. Tìm gia sư mới, thẻ ảnh, đánh giá có tên học sinh (LOẠI)**
- **LOẠI**: đánh giá công khai kèm tên và ảnh người học, "chia sẻ yêu cầu" cho nhiều gia sư đưa dữ liệu trẻ ra ngoài `[RS §4.2]`, `[RS §6.1]`. Mua buổi thử có phí, hoa hồng cũng LOẠI.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

---

## 8. Học sinh: Bài tập và thi

Bằng chứng ảnh gần như không có `[RS §4.7]`; phần lớn dựa trên mã. Hiện trạng: Coin thưởng không hiện; lề ngang thiếu; cổng vào đề sáu khung; mất mạng lúc thi không báo; Nộp bài sát Câu trước; nút Đ/S chỉ chữ tắt; chữ 12px; báo lỗi bằng `alert()`; điểm 8.5 và 8,5 lẫn nhau `[MH-06 §9]`.

### P1

**B1. Cổng vào đề: một thẻ, một câu quy định, một nút**
- Vấn đề: Sáu khung lớn, ba hộp nói gần cùng một việc `[MH-06 §9 mục 3]`.
- Cách giải: Tên đề, thời lượng, số câu, một dòng quy định "Làm nghiêm túc, hệ thống ghi nhận bài làm", rồi nút "Bắt đầu làm bài" (bỏ ký tự ▶). Top 10 và Lịch sử thu vào hai liên kết nhỏ phía dưới. Bỏ "Thông tin ghi nhận" hiện giờ vẽ trang `[MH-06 §9 mục 4, 19]`.
- Vì sao: Bài kiểm tra đầu vào 10 phút, một nút `[ảnh f6259336]`; hỏi một câu rồi mới chọn `[ảnh 45d3102f]`.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không. Top 10 chỉ giữ như hiện có, không mở rộng hiển thị tên bạn cùng lớp.

**B2. Báo mất mạng lúc làm bài**
- Vấn đề: Lưu đáp án lỗi bị nuốt, em tưởng đã lưu `[MH-06 §9 mục 6]`.
- Cách giải: Dải mảnh trên đầu phòng thi khi chưa lưu được: "Chưa lưu được. Đang thử lại" và chấm "Đã lưu" sau khi xong; mỗi câu đã trả lời có chữ nhỏ.
- Vì sao: Trạng thái rõ bằng chữ.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Thấp. Không thêm thu thập dữ liệu; chỉ hiển thị trạng thái đồng bộ.

**B3. Nút Nộp bài tách khỏi Câu trước/Câu sau**
- Vấn đề: Nộp bài sát Câu trước, cùng cỡ `[MH-06 §9 mục 7]`.
- Cách giải: "Câu trước" và "Câu sau" hai bên; "Nộp bài" đứng riêng ở màn tổng kết câu (bảng chọn câu), vẫn có hộp xác nhận hiện có.
- Vì sao: Một hành động chính mỗi màn `[RS §4.8]`.
- Độ khó: Vừa.
- Rủi ro tiền/trẻ em: Không.

### P2

**B4. Màn kết quả: điểm lớn, Coin nhận được bằng chữ, hai nút**
- Vấn đề: Coin thưởng không hiện; điểm viết hai kiểu `8.5` và `8,5` `[MH-06 §9 mục 1, 20]`.
- Cách giải: Điểm lớn (một kiểu dấu phẩy), dòng "Bạn nhận +5 Coin" (chỉ khi có thưởng, màu trung tính), nút "Xem lại bài" và "Chữa bài". Không bán Coin, không xếp hạng đẩy mạnh.
- Vì sao: `[ảnh fbbf914c]` (số lớn + thanh ngắn).
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp. Coin chỉ là thưởng khi làm bài; không có màn mua hay nạp.

**B5. Đúng/Sai bằng chữ đầy đủ, chữ đáp án 14px trở lên**
- Vấn đề: Nút chỉ "Đ" và "S"; lựa chọn 12px `[MH-06 §9 mục 5, 8]`.
- Cách giải: Hai nút "Đúng" và "Sai" rộng bằng nhau, ≥ 44px; đáp án 14px.
- Vì sao: Chữ rõ cho em nhỏ.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**B6. Hạn bài tập có giờ, một kiểu viết**
- Vấn đề: Hạn chỉ có ngày, trong khi Việc của tôi in cả giờ; hạn thực là 07:00 sáng ngày hạn `[MH-06 §9 mục 12, 21]`.
- Cách giải: Mọi nơi viết "Hạn 25/10 · 07:00". Chỉ thống nhất cách hiện; còn việc hạn nên là cuối ngày là hành vi, hỏi chủ dự án.
- Vì sao: Nhất quán, tránh em hiểu sai giờ nộp.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Thấp.

**B7. Lỗi báo bằng dòng chữ trong trang, không `alert()`**
- Vấn đề: "Nộp bài thất bại" bằng `alert()` `[MH-06 §9 mục 13]`.
- Cách giải: Dòng lỗi ngay trên nút nộp, có Thử lại; khi không bật được nộp ảnh, ghi lý do thay vì biến mất nút.
- Vì sao: Trạng thái rõ bằng chữ.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

### P3

**B8. Chữa bài: thanh bước cuộn ngang một hàng**
- Vấn đề: `flex-wrap` nhiều hàng chip khi sai 20 câu `[MH-06 §9 mục 17]`.
- Cách giải: Chỉ hiện "Câu 3 / 20" và mũi tên, bảng chọn câu mở ra khi chạm.
- Độ khó: Dễ.
- Rủi ro tiền/trẻ em: Không.

**B9. Nhãn Top 10 đầy đủ tên bạn cùng lớp trên màn kết quả (LOẠI)**
- **LOẠI**: lộ tên trẻ dưới 16 tuổi; MH-06 đã ghi là quyết định của chủ dự án `[MH-06 §9 mục 11]`.
- Rủi ro tiền/trẻ em: Cao. LOẠI.

**B10. Cho nhập điểm Azota tự do thang 0–150 (không đổi)**
- Vấn đề: Điểm tự nhập, nộp lại ghi đè điểm cũ `[MH-06 §9 mục 16]`.
- **LOẠI**: đổi cách tính điểm/xếp hạng là hành vi, không phải giao diện.
- Rủi ro tiền/trẻ em: Trung bình. LOẠI.

---

## Danh sách 10 ý tưởng tốt nhất toàn bộ

Chọn theo: giảm dày rõ rệt (bớt khung, bớt dòng, bớt nút), tăng tin cậy (trạng thái chữ, không nhầm tiền), không đụng cách tính và không thêm dữ liệu trẻ em. Không ý nào trong 10 mục này mang nhãn LOẠI.

| Hạng | Mã | Ý tưởng | Màn | Vì sao đứng đầu | Độ khó |
|---|---|---|---|---|---|
| 1 | T1 | Một khối "Việc cần làm" duy nhất, chỉ hiện khi có việc, bấm đi thẳng đúng lớp, đúng ngày | Tổng quan | Gỡ hai màn trùng, bỏ thẻ rỗng, là việc đầu tiên gia sư cần mỗi sáng | Vừa |
| 2 | H1 | Dải tổng hai số hai màu nghĩa: Đã thu 480.000đ (xanh lá), Còn lại 560.000đ (cam) | Học phí | Con số quan trọng nhất nổi lên, không phép tính mới | Dễ |
| 3 | H2 | Thẻ phiếu một nút đặc, số tiền to bên phải, nhãn không lặp (Đỗ Hà "Nháp" → "Gửi phiếu"; Trần Gia Bảo "Đã đóng" → không nút đặc) | Học phí | Cắt 24 cặp nhãn–số và 5 nút xuống còn một nút chính | Vừa |
| 4 | H3 | Khoản chờ đối soát thành dải nhắc có chữ, đỏ chỉ khi sai thật | Học phí | Việc gấp nhất về tiền không còn ẩn trong "(1)", đỏ lấy lại nghĩa | Vừa |
| 5 | L1 | Dải 7 ngày, tự cuộn tới hôm nay, một thẻ một buổi có chip chữ | Lịch gia sư | Thay lưới 7 cột bất khả dụng trên điện thoại, trả lời "hôm nay dạy gì" | Vừa |
| 6 | L2 | Một huy hiệu trạng thái bằng chữ, phần còn lại thu vào chi tiết buổi | Lịch gia sư | Thẻ thấp đi, hết ba huy hiệu xếp cột | Dễ |
| 7 | C1 | Nút "Thêm lớp" gần tay, ngăn kéo một ô, nút cuối ghi hậu quả "Tạo lớp + 8 buổi" | Lớp gia sư | Gỡ ngõ cụt khi đã có lớp, bớt 13 ô xuống 1 ô bắt buộc | Vừa |
| 8 | S1+S2 | Em chưa vào lớp: "Nhập mã mời"; em đã vào lớp: thẻ buổi sắp tới + tối đa ba việc | HS trang chủ | Sửa sai nghĩa "Bạn đã xong hết", mỗi việc một chữ trạng thái | Dễ–Vừa |
| 9 | M1+M2 | Dải 7 chip ngày đúng giờ Việt Nam, chạm ≥ 44px; buổi huỷ ghi "Đã huỷ" và bỏ nút "Vào học" | HS lịch | Hết nhầm ngày 00:00–07:00 và hết dẫn vào buổi không còn | Vừa |
| 10 | B1+B2 | Cổng vào đề một thẻ một nút, và dải báo "Chưa lưu được/Đã lưu" lúc làm bài | HS bài tập–thi | Bớt 6 khung, tăng tin cậy lúc thi (em biết bài đã lưu hay chưa) | Dễ–Vừa |

### Ý bị LOẠI, để chủ dự án biết đã cân nhắc

| Mã | Ý | Lý do |
|---|---|---|
| H9 | Hoàn tác và xác nhận hai bước cho thao tác tiền | Đổi hành vi ghi tiền; MH-04 đã để cho chủ dự án quyết |
| H10 | Chỉ số "tiềm năng" kiểu SGS | Phép cộng mới, dễ khiến tưởng tiền chắc chắn |
| H11 | Gộp phiếu, tạo nhiều phiếu một lần | Thêm hành vi ghi tiền, thêm nút |
| S7 | Hiện học phí trên trang chủ học sinh | Trẻ dưới 16 tuổi, không đưa tiền vào màn của trẻ |
| S8, B9 | Bảng xếp hạng, tên bạn cùng lớp | Lộ tên trẻ dưới 16 tuổi |
| M8 | Chia sẻ lịch của em ra ngoài | Dữ liệu trẻ ra ngoài ứng dụng |
| K6 | Tìm gia sư, đánh giá có tên học sinh, buổi thử có phí, hoa hồng | Dữ liệu trẻ ra ngoài; trái nguyên tắc KiN thu học phí chuyển khoản, không hoa hồng |
| B10 | Đổi cách nhập/tính điểm Azota | Là hành vi tính điểm, không phải giao diện |
| L8 | Lưu lại tin "Đã mở Zalo lúc…" sau tải lại | Đổi hành vi lưu dữ liệu; chờ chủ dự án |

### Điều chưa kiểm chứng cần nhớ

- Không ảnh nào là điện thoại dọc của một sản phẩm gia sư; mọi ý về dải 7 ngày, thẻ một cột, nút dính đáy là suy luận từ bản rộng `[RS §6.3]`.
- Không ảnh nào có mã QR thật; ý H6 theo đặc tả KiN, không theo ảnh `[RS §3.8]`.
- Bằng chứng ảnh cho học sinh (mục 5 đến 8) rất mỏng; nhiều ý dựa vào mã trong mục 9 của từng đặc tả, nên cần chạy thử trước khi chốt.
- Thứ tự trang chủ gia sư trên điện thoại (việc cần làm trước hay số tiền trước) còn chờ chủ dự án chọn `[RS §3.1]`; T1 và T3 được viết theo thứ tự "Việc cần làm trước".
