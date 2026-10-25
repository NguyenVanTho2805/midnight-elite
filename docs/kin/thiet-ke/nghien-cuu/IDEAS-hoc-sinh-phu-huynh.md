# Ý tưởng giao diện — góc nhìn học sinh (có thể dưới 16 tuổi) và phụ huynh

Soạn 22/10/2026. Tài liệu ý tưởng, không sửa mã. Mục tiêu duy nhất: giao diện **thoáng hơn, dễ dùng hơn, ít dày hơn** trên điện thoại. Không ý tưởng nào được phép thêm một dòng, một khung, một nút "chính" nữa so với hiện nay mà không bỏ đi thứ khác.

Nguồn đã đọc: `RESEARCH-TONG-HOP.md` (viết tắt **RT**, kèm mục), sáu đặc tả `man-hinh/01..06` (viết tắt **MH-0N**, kèm mục "9" là danh sách điều chưa tốt hiện trạng), `hoc-sinh-giao-dien-tu-anh-doi-thu.md` (**HS-DT**). Ảnh gọi bằng 8 ký tự đầu như trong RT.

## 0. Cách đọc

**Góc nhìn.** Tài liệu này hỏi: học sinh 13–15 tuổi cầm điện thoại, hoặc phụ huynh mở link từ Zalo, nhìn thấy gì trong 2 giây; có hiểu, có bấm đúng nút, có thấy an toàn không. Gia sư là người dựng nội dung, nhưng điều học sinh và phụ huynh *nhìn thấy* (phiếu học phí, lịch, báo nghỉ, bài tập) thường được sinh ra từ màn gia sư, nên ba màn gia sư vẫn được xét theo hướng "em và phụ huynh nhìn vào sẽ ra sao".

**Ưu tiên.** P1 = làm trước, giảm đúng cái đang gây rối, độ khó thấp. P2 = nên làm trong vòng sau. P3 = có thể để sau hoặc cần quyết định.

**Độ khó.** D = dễ (chỉ đổi chữ, thứ tự, kiểu hiển thị), V = vừa (đổi bố cục một khối, thêm trạng thái), K = khó (đổi luồng hoặc cần dữ liệu mới).

**Cột rủi ro.** Mỗi ý tưởng ghi rõ có chạm **tiền** hoặc **trẻ em** không. Quy tắc dự án: màn học phí chỉ đổi cách trình bày, không đổi cách tính phiếu hay đối soát; không thêm thu thập dữ liệu cá nhân; không nội dung cờ bạc; không màn mua hay nạp Coin cho học sinh; thông báo ra ngoài không có tên em và không có số tiền; màu chỉ qua token `--kin-*`, trạng thái luôn có chữ, nút chạm từ 44px. Ý tưởng chạm các điều trên bị **LOẠI** và vẫn được liệt kê ở mục 10 để người sau khỏi đề xuất lại.

**Nguồn.** Chỗ nào là suy luận của tôi, không có ảnh hay đặc tả đỡ lưng, ghi **[suy luận]**. Không ảnh nào là điện thoại dọc của sản phẩm gia sư, và không ảnh nào cho thấy phòng thi hay QR thật (RT 6.3), nên nhiều ý tưởng ở mục học sinh là thiết kế riêng, không phải học từ đối thủ.

**Dữ liệu mẫu** xuyên suốt: Cô Lan; 7 lớp (Toán 9, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9, Toán 8); 8 học viên; đã thu tháng 10 là 480.000đ; còn lại 560.000đ; phiếu Đỗ Hà 560.000đ (nháp), Trần Gia Bảo 480.000đ (đã đóng); Thứ Sáu 23/10 19:00–20:30 Toán 9 (2 học viên), Thứ Bảy 24/10 16:00–17:30 Văn 8; việc cần làm: 2 yêu cầu xác nhận của phụ huynh, 1 báo nghỉ sát giờ, 1 khoản cần đối soát, 4 buổi chưa điểm danh. Học sinh mẫu: Trần Gia Bảo.

---

## 1. Tổng quan gia sư (Trang chủ)

Điều học sinh và phụ huynh được lợi: các việc "chờ phụ huynh xác nhận", "báo nghỉ", "phiếu" được xử lý nhanh hơn khi gia sư không bị lạc giữa hai màn trùng nhau.

**TQ-1 · P1 · D · Tiền: không · Trẻ em: không.** *Một khối "Việc cần làm", ẩn hẳn khi bằng 0.*
- Vấn đề: hai màn (Tổng quan và Hộp việc) cùng đếm việc nhưng khác chữ, khác đích bấm, khác thứ tự (MH-01 §9 điểm 1); Tổng quan phân biệt khẩn bằng màu chấm không chữ (điểm 5); thẻ rỗng chiếm cả hàng ở đối thủ (RT 3.1, ảnh 9eca7149).
- Cách giải: một khối duy nhất, tối đa 4 dòng, mỗi dòng một chữ đủ nghĩa kèm một con số ("2 yêu cầu xác nhận của phụ huynh", "1 báo nghỉ sát giờ", "1 khoản cần đối soát", "4 buổi chưa điểm danh"), chip chữ "Cần xử lý" thay vì chấm màu. Khi cả bốn bằng 0: một dòng chữ xanh "Không có việc cần làm", không dựng thẻ rỗng.
- Vì sao: RT 3.1 "Việc cần làm phải lên đầu"; ảnh 11a4cd13 (trạng thái rỗng một câu); MH-01 §9 điểm 5.

**TQ-2 · P1 · D · Tiền: không · Trẻ em: không.** *Bỏ "Sắp tới" lặp "Hôm nay".*
- Vấn đề: buổi 19:00 hôm nay hiện hai lần, ở "Hôm nay" và ở "Sắp tới" (MH-01 §9 điểm 3) — thêm dòng thừa.
- Cách giải: "Hôm nay" chỉ hiện buổi hôm nay; "Sắp tới" chỉ bắt đầu từ ngày mai. Hôm không có buổi thì một câu nói rõ và hiện luôn buổi kế tiếp: "Thứ Sáu 23/10 · 19:00–20:30 · Toán 9 · 2 học viên".
- Vì sao: MH-01 §9 điểm 3 và 4 (dòng phẳng mất giờ kết thúc, sĩ số); RT 4.1 "Buổi học sắp tới".

**TQ-3 · P1 · D · Tiền: không · Trẻ em: không.** *Cho chữ xuống tối đa 2 dòng trên điện thoại thay vì cắt "…".*
- Vấn đề: dòng phụ chính là chỗ có tên em, bị cắt mất (MH-01 §9 điểm 8, §12 câu 6).
- Cách giải: điện thoại cho xuống 2 dòng, máy tính giữ cắt một dòng. Không thêm khung, chỉ đổi cách xử lý chữ.
- Vì sao: `BRIEF.md` "không chữ bị cắt"; MH-01 §12 câu 6.

**TQ-4 · P2 · V · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Hai số tiền lớn một dòng nhãn nhỏ: Đã thu và Còn lại.*
- Vấn đề: trang chủ không có "còn bao nhiêu chưa thu" (MH-01 §9 điểm 14); Sổ Gia Sư làm tốt cách "mỗi thẻ một con số lớn, một nhãn nhỏ" (RT 3.1, ảnh 9eca7149).
- Cách giải: hai số trên cùng một hàng, "Đã thu tháng 10: 480.000đ" xanh lá và "Còn lại: 560.000đ" cam, mỗi số kèm chữ trạng thái. Thêm nút con mắt để ẩn số khi mở app trước mặt người khác (RT 3.1).
- Rủi ro tiền: cần một phép cộng mới (MH-01 §12 câu 5, mặc định là KHÔNG làm). Không đổi cách tính phiếu hay tiền đã thu. Chỉ làm khi chủ dự án đồng ý; ghi **chờ quyết**.
- Vì sao: RT 3.1, 3.4; ảnh 9eca7149.

**TQ-5 · P2 · V · Tiền: không · Trẻ em: không.** *Danh sách lớp chỉ 4 lớp, ưu tiên lớp có buổi hôm nay.*
- Vấn đề: 7 lớp × (tên + dòng phụ + 3 liên kết 44px) chiếm gần hết màn (MH-01 §9 điểm 13).
- Cách giải: 4 lớp đầu + "Xem tất cả 7 lớp"; lớp có buổi hôm nay lên trước; mỗi thẻ chỉ một nút "Mở lớp", bỏ hai liên kết phụ (chúng đã có trong chi tiết lớp).
- Vì sao: RT 3.3; MH-01 §9 điểm 13, §12 câu 8.

**TQ-6 · P3 · D · Tiền: không · Trẻ em: không.** *Lời chào một dòng theo buổi, thứ ngày đầy đủ.* Thay cho banner hay đoạn mô tả; chuẩn "Chào Cô Lan, Thứ Sáu 23/10". Vì sao: RT 3.1 (ảnh 9eca7149).

---

## 2. Lịch gia sư (và cái phụ huynh nhận từ lịch)

**LI-1 · P1 · V · Tiền: không · Trẻ em: có (thông báo ra ngoài).** *Tin lịch gửi Zalo và thông báo báo nghỉ: không tên em, không số tiền.*
- Vấn đề: nhiều nơi trong màn lịch có tin nhắn dài gửi phụ huynh (MH-02 §9 điểm 5, 18); thông báo ra ngoài chạm dữ liệu trẻ.
- Cách giải: tiêu đề tin và nội dung xem trước chỉ nói "Lịch tuần này đã cập nhật", "Có thay đổi buổi học"; tên em, giờ chi tiết, số tiền nằm sau link. Thống nhất nhãn "Sao chép" ở mọi hộp (MH-02 §9 điểm 15).
- Vì sao: RT 3.9 và 6.1 (quy tắc "toast không tên em, không số tiền"); MH-02 §9 điểm 15.

**LI-2 · P1 · D · Tiền: không · Trẻ em: không.** *Lịch tự cuộn tới hôm nay; giờ 24h; tuần bắt đầu thứ Hai; có giờ kết thúc.*
- Vấn đề: vào giữa tuần, các buổi đầu tuần đã qua nằm trên cùng, buổi hôm nay xa phía dưới (MH-02 §9 điểm 19); thiếu giờ kết thúc ở phía học sinh (MH-05 Màn B §9 điểm 5).
- Cách giải: neo vào ngày hôm nay khi mở; mọi thẻ buổi ghi "19:00–20:30". Không thêm khối nào.
- Vì sao: RT 3.2; MH-02 §9 điểm 19.

**LI-3 · P1 · V · Tiền: không · Trẻ em: không.** *Một thẻ buổi chỉ một chip trạng thái bằng chữ, không chồng ba huy hiệu.*
- Vấn đề: ba huy hiệu xếp cột bên phải ép tên lớp (MH-02 §9 điểm 2).
- Cách giải: một chip chữ duy nhất ưu tiên theo mức gấp (ví dụ "Báo nghỉ sát giờ" thắng "Đã dời"); các huy hiệu phụ gom thành một dòng chữ nhỏ trong chi tiết. Trạng thái luôn có chữ, không chỉ chấm màu.
- Vì sao: MH-02 §9 điểm 2; RT 6.1 "trạng thái chỉ phân biệt bằng màu".

**LI-4 · P2 · V · Tiền: không · Trẻ em: không.** *Thẻ chi tiết buổi: đưa việc gấp lên trước, gộp 4 dòng nhắc thành một lựa chọn.*
- Vấn đề: chi tiết buổi là chồng 5 khối, việc gấp sau hai dòng tiện ích (MH-02 §9 điểm 6); một em có 4 dòng nhắc, 3 em là 12 nút giống nhau (điểm 5).
- Cách giải: báo nghỉ chờ xử lý lên đầu; "Nhắc lịch" là một nút duy nhất "Soạn tin nhắc", chọn người nhận và mốc giờ trong hộp; bỏ các dòng lặp.
- Vì sao: ảnh 190a8682 (một nút rộng ở đáy thẻ); MH-02 §9 điểm 5, 6.

**LI-5 · P2 · D · Tiền: không · Trẻ em: không.** *Màu lớp chỉ là phụ; tên lớp luôn bằng chữ; bỏ màu trùng nghĩa trạng thái.*
- Vấn đề: màu vạch lớp có xanh lá và cam, trùng nghĩa "xong" và "chờ" (MH-02 §9 điểm 8).
- Cách giải: bộ màu vạch lớp dùng nhóm không mang nghĩa trạng thái (xanh dương, tím, xám); xanh lá và cam dành riêng cho trạng thái.
- Vì sao: RT 3.2; MH-02 §9 điểm 8.

**LI-6 · P2 · D · Tiền: không · Trẻ em: không.** *Hộp thoại có nút ✕ ở góc, dễ bấm trên điện thoại.* Hiện chỉ đóng bằng Esc hoặc bấm nền (MH-02 §9 điểm 14). Nút ≥ 44px. Vì sao: MH-02 §9 điểm 14; MH-04 §9 điểm 11.

**LI-7 · P3 · V · Tiền: không · Trẻ em: không.** *Dải 7 chip ngày có chấm ở ngày có buổi; ô ngày chỉ có buổi huỷ vẫn bấm được.* Vì sao: ảnh 66e5b5d6; MH-02 §9 điểm 7.

---

## 3. Lớp (gia sư) — cái phụ huynh và học sinh bước vào

**LO-1 · P1 · D · Tiền: không · Trẻ em: có (mã mời).** *Mã mời hiển thị lớn, 5 ô, nút sao chép; học sinh vào lớp bằng đúng một ô.*
- Vấn đề: học sinh mới không thấy lối "Nhập mã mời" ở trang đầu (MH-05 Màn A §9 điểm 1); chân trang nhập mã viết cho người làm sản phẩm ("lúc đó mới cãi nhau tiền") (MH-05 Màn C §9 điểm 5).
- Cách giải: ô mã 5 ký tự gạch chân, một nút xanh rộng, "Quay lại danh sách lớp" ngay dưới (ảnh ef4f8038). Màn xem trước sau khi nhập mã nói bằng giọng học sinh: "Lớp Toán 9 của Cô Lan. Bạn có muốn vào lớp?" Học phí của lớp hiển thị cho phụ huynh ở nơi khác, không trong màn học sinh 13–15 tuổi. Không hỏi thêm thông tin cá nhân.
- Vì sao: RT 3.3, 4.5 (ảnh ef4f8038); MH-05 Màn C §9 điểm 5.

**LO-2 · P1 · D · Tiền: không · Trẻ em: không.** *Thẻ lớp: tên, chấm trạng thái + chữ, sĩ số, một nút "Mở lớp".*
- Vấn đề: 3 nút nhỏ sát nhau trong thẻ (ảnh 486587a8), nút phụ 32px (MH-05 Màn C §9 điểm 7).
- Cách giải: hai nút phụ chuyển vào chi tiết lớp; thẻ chỉ còn một nút chính ≥ 44px. Sĩ số bằng chữ "2 học viên".
- Vì sao: RT 3.3, 4.5; MH-03 §9 điểm 7.

**LO-3 · P2 · V · Tiền: không · Trẻ em: không.** *Đầu chi tiết lớp: chấm màu, tên, ba chip (học phí, số buổi, số học sinh) thay cho đoạn văn.*
- Vấn đề: chi tiết lớp chỉ là "trung tâm liên kết", năm mục là khối tiêu đề + 1 câu + "Mở trang →" (MH-03 §9 điểm 3).
- Cách giải: ba chip ở đầu; dưới là danh sách buổi nhóm "Tuần này / Tuần sau", mỗi dòng ngày chữ đầy đủ + chip trạng thái + giờ. Bỏ câu "Chào mừng đến hộp việc" sai ngữ cảnh.
- Vì sao: ảnh 486587a8; MH-03 §9 điểm 3.

**LO-4 · P2 · D · Tiền: không · Trẻ em: không.** *Một từ "lớp", bỏ "khoá học", không nói "slug" với người dùng.* Hiện "Tạo khoá học mới" lẫn "lớp" (MH-03 §9 điểm 9). Vì sao: MH-03 §9 điểm 9.

**LO-5 · P2 · V · Tiền: không · Trẻ em: không.** *Tạo lớp một màn, một ô bắt buộc.*
- Vấn đề: ngăn kéo tạo lớp có 13 ô, mặc định "ĐGNL HSA", "KiN" không hợp gia sư dạy kèm (MH-03 §9 điểm 8).
- Cách giải: chỉ hỏi tên lớp, thứ, giờ, khoảng thời gian; các trường còn lại ẩn dưới "Tuỳ chọn". Nút cuối đổi nhãn theo hậu quả ("Tạo lớp + 8 buổi").
- Vì sao: ảnh cdbd1f37, 139b0933; MH-03 §9 điểm 8.

**LO-6 · P3 · V · Tiền: không · Trẻ em: không.** *Danh sách học sinh trong lớp: avatar chữ cái, tên, chữ trạng thái "Đang học", "Chờ phụ huynh xác nhận".* Hiện hiện cả em `pending_consent` và `suspended` không có chữ (MH-03 §9 điểm 10). **Không thêm** ngày sinh, trường học, địa chỉ, ảnh. Rủi ro trẻ em: chỉ trình bày dữ liệu đã có. Vì sao: RT 3.6; MH-03 §9 điểm 10.

---

## 4. Học phí (chỉ đổi cách trình bày, không đổi cách tính)

Quy tắc cứng: mọi ý tưởng dưới đây chỉ đổi bố cục, chữ, thứ tự. Không đổi công thức phiếu, không đổi đối soát SePay, không thêm bước xác nhận hay hoàn tác (đó là hành vi, chờ chủ dự án — MH-04 §12). Mỗi ý tưởng ở mục này có cột rủi ro tiền = **có (chỉ hiển thị)**.

**HP-1 · P1 · D · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Dải tổng hai màu có chữ: Đã thu xanh lá, Còn lại cam.*
- Vấn đề: bốn ô tổng cùng cỡ chữ cùng màu; con số quan trọng nhất không nổi (MH-04 §9 điểm 2).
- Cách giải: thu bốn ô thành hai số lớn trong một dải: "Đã thu 480.000đ" (xanh lá), "Còn lại 560.000đ" (cam), mỗi số kèm chữ. Số phiếu đi xuống dòng phụ.
- Vì sao: ảnh 22608da4 (dải tổng cam/xanh lá); MH-04 §9 điểm 2.

**HP-2 · P1 · D · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Một nút chính mỗi thẻ phiếu; nút còn lại vào menu "Thêm".*
- Vấn đề: phiếu đã gửi có tới 5 nút ngang hàng, cả màn nhiều nút đặc (MH-04 §9 điểm 4).
- Cách giải: thẻ Đỗ Hà 560.000đ, chip chữ "Nháp", một nút đặc "Gửi phiếu"; thẻ Trần Gia Bảo 480.000đ, chip chữ "Đã đóng", không nút đặc. "Sao chép tin nhắn", "Sửa số tiền", "Huỷ phiếu" gom vào một nút "Thêm" (không bỏ chức năng nào).
- Rủi ro: gom nút không đổi hành vi. Nếu muốn thêm xác nhận hai bước hay "Hoàn tác" thì đó là hành vi, **không** thuộc ý này.
- Vì sao: ảnh 22608da4; MH-04 §9 điểm 4, 12.

**HP-3 · P1 · D · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Ô nhập tiền nhóm nghìn khi gõ, kèm dòng xem lại "= 560.000đ".*
- Vấn đề: ô chỉ nhận chữ số, không nhóm nghìn ("560000"), dễ gõ thừa số 0 (MH-04 §9 điểm 10).
- Cách giải: nhóm nghìn khi nhập; dòng xem lại ngay dưới ô. Là hiển thị, giá trị lưu vẫn là số nguyên như cũ.
- Vì sao: MH-04 §9 điểm 10.

**HP-4 · P1 · D · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Toast sau thao tác tiền ngắn, không chứa tên và số tiền.* Ví dụ "Đã ghi nhận", "Đã gửi phiếu". Chi tiết nằm trong hộp thoại. Vì sao: RT 3.4 và 6.1 (quy tắc "toast không tên em, không số tiền"); MH-04 §8.

**HP-5 · P2 · V · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Bỏ lặp nhãn "Phải đóng / Đã nhận / Còn lại" ở mỗi phiếu.*
- Vấn đề: 8 phiếu là 24 cặp nhãn–số (MH-04 §9 điểm 3).
- Cách giải: số "Còn lại" cam lớn bên phải thẻ (như ảnh 22608da4), dòng phụ chữ nhỏ "Phải đóng 560.000đ · Đã nhận 0đ" chỉ khi khác nhau. Phiếu đóng bằng tín dụng ghi "Đã đóng bằng số dư" thay vì "Phải đóng 0đ · Đã nhận 0đ" (điểm 19).
- Vì sao: ảnh 22608da4; MH-04 §9 điểm 3, 19.

**HP-6 · P2 · V · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Đầu trang ngắn: bỏ đoạn mô tả hai dòng, số khoản chờ đối soát thành chip nổi trên tab.*
- Vấn đề: đầu trang chiếm gần nửa màn trước khi thấy con số; khoản chờ đối soát, việc gấp nhất, chỉ là "(1)" trong nhãn tab (MH-04 §9 điểm 6, 7).
- Cách giải: tab "Chờ đối soát" có chip số cam kèm chữ; phần mô tả đưa vào dòng gợi ý xám dưới tab, bỏ khi đã dùng quen.
- Vì sao: MH-04 §9 điểm 6, 7; RT 3.4 (hai tab, một tab một nội dung).

**HP-7 · P2 · V · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Phiếu cho phụ huynh: một tóm tắt phiếu ở đầu, mã QR + nội dung chuyển khoản sao chép được, một dòng trạng thái bằng chữ.*
- Vấn đề: phía phụ huynh/học sinh chưa có mẫu từ ảnh; phía gia sư không xem được phiếu như phụ huynh thấy (MH-04 §9 điểm 13).
- Cách giải: xếp dọc trên điện thoại: tên lớp và tháng → số tiền lớn → QR → "Sao chép nội dung chuyển khoản" (mã `KIN` + 5 ký tự) → chip "Chưa đóng"/"Đã đóng". Tổng tiền lặp lại ngay trong nút, theo cách Preply làm ở màn thanh toán (ảnh d2a216a5). Câu trấn an kiểu "không bị tính phí đến khi hoàn tất" **không** dùng (RT 4.4).
- Rủi ro: khung QR không có ảnh nguồn (RT 3.8, 4.4) — thiết kế dựa vào đặc tả KiN; không đổi cách phát sinh phiếu hay khớp tiền.
- Vì sao: RT 3.8, 4.4; ảnh d2a216a5.

**HP-8 · P3 · V · Tiền: có (chỉ hiển thị) · Trẻ em: không.** *Thay `<select>` tháng bằng "‹ Tháng 10 ›" và ô tìm theo tên / lọc chip trạng thái (Nháp, Chưa đóng, Đã đóng).* Vì sao: MH-04 §9 điểm 14, 15.

---

## 5. Học sinh · Trang chủ

Người dùng: em 13–15 tuổi, mở app trên điện thoại hầu hết mỗi tối. Câu hỏi duy nhất: "tối nay em phải làm gì?"

**HN-1 · P1 · D · Tiền: không · Trẻ em: không.** *Một dòng chào + "Buổi học sắp tới" + "Việc cần làm", chỉ vậy.*
- Vấn đề: Việc của tôi dày: thẻ có viền, mỗi dòng cao 3 dòng, tên buổi lệch (MH-05 Màn A §9 điểm 3, 4); chỉ có bảng ghi "Chưa có việc nào cần làm".
- Cách giải: thứ tự cố định: lời chào → thẻ buổi gần nhất ("Thứ Sáu 23/10 · 19:00–20:30 · Toán 9" + nút "Vào lớp") → "Việc cần làm" (tối đa 3 dòng, mỗi dòng một chữ + hạn: "Bài tập Toán 9 — hạn 25/10") → lối tắt bằng chữ. Phần còn lại ẩn.
- Vì sao: HS-DT "Trang chủ"; RT 4.1 (ảnh 11a4cd13 chia khối theo câu hỏi "hôm nay có gì").

**HN-2 · P1 · D · Tiền: không · Trẻ em: có (lối vào lớp).** *Học sinh chưa vào lớp: một câu + một nút "Nhập mã mời".*
- Vấn đề: trống ghi "Bạn đã xong hết", sai nghĩa với em chưa vào lớp (MH-05 Màn A §9 điểm 1).
- Cách giải: "Bạn chưa vào lớp nào." Nút "Nhập mã mời" (ô 5 ký tự). Không hỏi tuổi, trường, địa chỉ.
- Vì sao: RT 4.1, 4.5 (ảnh ef4f8038, 2e32d1cb); MH-05 Màn A §9 điểm 1.

**HN-3 · P1 · D · Tiền: không · Trẻ em: không.** *Bỏ chip Coin màu cam trên mọi trang; hiện số Coin ở đúng nơi nhận.*
- Vấn đề: chip Coin cam (màu của "chờ/còn nợ"), chỉ có số, không có chữ "Coin", tranh chú ý với việc cần làm (MH-05 Màn A §9 điểm 5).
- Cách giải: ẩn chip khỏi thanh đầu; "+N Coin" chỉ hiện sau khi nộp bài (xem HB-3) và trong "Khác". Coin chỉ nhận thưởng, không có nút mua hay nạp.
- Vì sao: MH-05 Màn A §9 điểm 5; quy tắc cứng (RT 6.1).

**HN-4 · P2 · V · Tiền: không · Trẻ em: không.** *Một chạm từ dòng việc tới hành động.*
- Vấn đề: việc có sẵn `detail.commands` nhưng cần 3 chạm trên điện thoại (chọn dòng → khung đọc → nút) (MH-05 Màn A §9 điểm 9).
- Cách giải: dòng việc có một nút chữ rõ ("Làm bài", "Xem lịch") ngay trên dòng; khung đọc chỉ còn ở máy tính.
- Vì sao: MH-05 Màn A §9 điểm 9; RT 4.8 "một hành động chính mỗi màn".

**HN-5 · P2 · D · Tiền: không · Trẻ em: không.** *Banner vàng nhỏ, đóng được, chỉ cho "bài sắp hết hạn".*
- Cách giải: một banner duy nhất, có chữ ("Sắp hết hạn"), có nút ✕ ≥ 44px, không bao giờ nói về tiền hay thanh toán. Mẫu: banner vàng của Wyzant (ảnh 2e32d1cb), nhưng nội dung khác hẳn.
- Vì sao: RT 4.1.

**HN-6 · P2 · D · Tiền: không · Trẻ em: không.** *Nút chuông 44px, bảng chuông dùng icon KiN thay cho emoji.* Hiện chuông 36px, bảng dùng emoji làm biểu tượng (MH-05 Màn A §9 điểm 10). Vì sao: MH-05 Màn A §9 điểm 10.

**HN-7 · P3 · V · Tiền: không · Trẻ em: không.** *Lỗi tải: dải lỗi rõ + nút "Thử lại", khung đọc không ghi "Đang tải…" mãi.* Vì sao: MH-05 Màn A §9 điểm 2. Cũng áp cho Lịch, Lớp và phòng thi.

---

## 6. Học sinh · Lịch học

**HL-1 · P1 · D · Tiền: không · Trẻ em: không.** *Dải 7 ngày cuộn ngang với chấm là có buổi; hôm nay tô đặc; danh sách buổi dưới dải.*
- Vấn đề: lưới 8 nút ngày ~38px rộng, dưới 44px (MH-05 Màn B §9 điểm 7).
- Cách giải: dải 7 ô, mỗi ô ≥ 44px, ngày chọn viền đậm, chấm nhỏ ở ngày có buổi. Giờ 24h, tuần bắt đầu thứ Hai.
- Vì sao: ảnh 66e5b5d6, 2c486c98 (dải ngày của Preply); HS-DT "Lịch học".

**HL-2 · P1 · D · Tiền: không · Trẻ em: không.** *Giờ hôm nay đúng giờ Việt Nam; "Hôm nay" luôn đúng.*
- Vấn đề: ngày tính theo giờ trình duyệt rồi đổi sang UTC, ở +07 ngày bị lùi 1 ngày, nhãn "Hôm nay" sai trong 00:00–07:00 (MH-05 Màn B §9 điểm 1). Đây là lỗi dữ liệu nhưng người học thấy ngay là lịch sai.
- Cách giải: tính "hôm nay" theo giờ Việt Nam cố định. Là sửa logic hiển thị ngày, không thêm màn.
- Vì sao: MH-05 Màn B §9 điểm 1, §9 điểm 5.

**HL-3 · P1 · D · Tiền: không · Trẻ em: không.** *Buổi đã huỷ ghi chữ "Đã huỷ" và bỏ nút "Vào học".*
- Vấn đề: buổi đã huỷ vẫn có nút "Vào học", tên in nguyên "[ĐÃ HUỶ] " (MH-05 Màn B §9 điểm 2).
- Cách giải: chip chữ "Đã huỷ", gạch ngang giờ, thay nút bằng "Xem lịch"; bỏ tiền tố thô trong tên. Tương tự "Đã dời sang 24/10".
- Vì sao: MH-05 Màn B §9 điểm 2.

**HL-4 · P2 · D · Tiền: không · Trẻ em: không.** *Ghi hạn huỷ ngay cạnh buổi ("Báo nghỉ trước 18:00 hôm nay").* Học từ cách Preply ghi chính sách huỷ cạnh lịch (ảnh d2a216a5). Không thêm thu phí. Vì sao: RT 4.3, HS-DT nguyên tắc 4.

**HL-5 · P2 · D · Tiền: không · Trẻ em: không.** *Đổi đỏ "hôm nay" sang token trung tính; đỏ chỉ cho nghỉ/quá hạn.* Hiện đỏ dùng cho "hôm nay" và chip "Thi thử", đang mang nghĩa nghỉ/quá hạn (MH-05 Màn B §9 điểm 6). Vì sao: MH-05 Màn B §9 điểm 6.

**HL-6 · P3 · V · Tiền: không · Trẻ em: không.** *Tuần đã qua: nói rõ "Chưa có lịch sử buổi đã học" thay vì trống.* Hiện nút "Tuần trước" dẫn tới trang trống không giải thích (điểm 4). Vì sao: MH-05 Màn B §9 điểm 4; ảnh 2e32d1cb (trạng thái rỗng một câu).

**HL-7 · P3 · D · Tiền: không · Trẻ em: không.** *Bỏ tiêu đề "Lịch học cá nhân · Tuần 43" và bốn ô thống kê; dùng "23 – 29/10".* Vì sao: MH-05 Màn B §9 điểm 7, 9.

---

## 7. Học sinh · Lớp của tôi

**HLo-1 · P1 · D · Tiền: không · Trẻ em: không.** *Gộp ba trang chồng nhau thành một cửa: danh sách lớp → chi tiết lớp → đường học.*
- Vấn đề: ba trang cho một ý "lớp của tôi"; học sinh nhiều lớp không thấy danh sách (MH-05 Màn C §9 điểm 1, 8).
- Cách giải: nút "Lớp" luôn mở danh sách (kể cả chỉ có một lớp); từ danh sách chạm một lớp vào chi tiết; chi tiết có "Tiếp tục học". Liên kết "← Lớp của tôi" đi đúng danh sách (điểm 4).
- Vì sao: MH-05 Màn C §9 điểm 1, 4; HS-DT.

**HLo-2 · P1 · D · Tiền: không · Trẻ em: không.** *Thẻ lớp: tên lớp, tên gia sư (Cô Lan), buổi kế tiếp, nút "Vào lớp".*
- Vấn đề: thiếu gia sư, buổi kế tiếp; "Đang học" gõ cứng; 2 nút phụ 32px (MH-05 Màn C §9 điểm 3).
- Cách giải: thẻ có ba dòng chữ + một nút ≥ 44px; trống có một câu và một nút "Nhập mã mời".
- Vì sao: HS-DT "Lớp của tôi"; ảnh b03b9eb4, ef4f8038.

**HLo-3 · P1 · D · Tiền: không · Trẻ em: không.** *Sửa khung "Đã hoàn thành khoá học" hiện sai.* Hiện hiện cả khi mọi bài còn khoá hoặc lớp chưa có bài (MH-05 Màn C §9 điểm 9) — thông tin sai làm em hiểu nhầm là đã xong. Cách giải: chỉ hiện khi tất cả bài thật sự xong; nếu lớp chưa có bài thì ghi "Cô chưa đăng bài". Vì sao: MH-05 Màn C §9 điểm 9.

**HLo-4 · P2 · D · Tiền: không · Trẻ em: không.** *Một từ "lớp" và "bài học", bỏ "khoá học", "video", mã nội bộ.* Hiện có "Breakdown theo môn + VietQR (TK-173)" lộ mã nội bộ (MH-05 Màn C §9 điểm 2, 4). Vì sao: MH-05 Màn C §9 điểm 2, 4.

**HLo-5 · P2 · D · Tiền: không · Trẻ em: không.** *Một khối tiến độ thay cho ba (số lớn, thanh, "n/m bài").* Giữ thanh + "3/12 bài", bỏ hai cái còn lại (MH-05 Màn C §9 điểm 4). Vì sao: MH-05 Màn C §9 điểm 4.

**HLo-6 · P3 · V · Tiền: **có (phía phụ huynh)** · Trẻ em: có.** *Nơi phụ huynh xem phiếu tách khỏi nơi em học.*
- Ý: màn học sinh không hiện số tiền; phiếu học phí chỉ xuất hiện trong trang phụ huynh `/so-cua-con/[token]` (đã có, RT 2.3, 3.9). Thêm một dòng chữ trong trang đó "Phiếu của con" thay vì để em 13–15 tuổi thấy số tiền.
- Rủi ro: chỉ sắp xếp lại nơi hiển thị; không đổi tính, không đổi đối soát. Cần chủ dự án xác nhận ranh giới em/phụ huynh.
- Vì sao: RT 3.9, 6.2 điểm 3; quy tắc dự án "không số tiền trong thông báo".

---

## 8. Học sinh · Bài tập và phòng thi

Phần này **không có ảnh đối thủ nào đỡ lưng** (RT 4.7, 6.3). Mọi ý tưởng là thiết kế riêng, bám phòng thi KiN hiện có, đều ghi **[suy luận]**. Không nội dung cờ bạc; Coin chỉ là thưởng.

**HB-1 · P1 · D · Tiền: không · Trẻ em: không.** *Danh sách đề theo hạn nộp, mỗi dòng một chữ trạng thái: Chưa làm / Đã nộp / Chờ chấm.* **[suy luận]** từ mẫu "Bài tập chưa nộp" ba cột Tên / Lớp / Hạn chót (ảnh 11a4cd13) và HS-DT. Giờ hạn in cả giờ ("hạn 07:00 25/10") cho thống nhất với Việc của tôi (MH-06 §9 điểm 12, 21). Điểm viết một kiểu dấu phẩy "8,5/10" (điểm 20).

**HB-2 · P1 · D · Tiền: không · Trẻ em: không.** *Cổng vào đề gọn: một thẻ chính, bỏ hộp lặp.*
- Vấn đề: sáu khung lớn, ba hộp đầu nói gần cùng một việc (MH-06 §9 điểm 3).
- Cách giải: một thẻ chính (tên đề, thời gian, số câu, nút "Bắt đầu làm bài"); các lưu ý gộp thành một danh sách 3 dòng gập mở; Top 10 và lịch sử vào phần dưới "Xem thêm". Bỏ ký tự "▶" ở nút (điểm 19). Bỏ "Thông tin ghi nhận" in giờ lúc vẽ trang (điểm 4).
- Rủi ro trẻ em: Top 10 có thể lộ tên đầy đủ bạn cùng lớp; giữ nguyên hiện trạng, chỉ sắp xếp xuống dưới (xem HB-6).
- Vì sao: MH-06 §9 điểm 3, 4, 19.

**HB-3 · P1 · V · Tiền: không · Trẻ em: không.** *Hiện "+N Coin" ngay sau khi nộp.*
- Vấn đề: máy chủ trả `coinsEarned` nhưng giao diện bỏ, em làm đúng hạn mà không thấy thưởng (MH-06 §9 điểm 1); lịch sử Coin hiện mã thô "quiz_reward" (MH-05 Màn A §9 điểm 8).
- Cách giải: ở màn Kết quả, một dòng chữ "Bạn nhận +10 Coin" (token xanh lá) và lịch sử Coin ghi "Thưởng làm bài". Không có nút mua, không nạp, không đổi Coin lấy tiền.
- Vì sao: MH-06 §9 điểm 1; quy tắc "Coin chỉ nhận khi làm bài".

**HB-4 · P1 · V · Tiền: không · Trẻ em: không.** *Mất mạng khi đang thi: báo bằng chữ và tự thử lại.*
- Vấn đề: lưu đáp án `.catch(() => {})`, em tưởng đã lưu (MH-06 §9 điểm 6).
- Cách giải: chip chữ nhỏ "Đang lưu…" / "Chưa lưu được, đang thử lại" cạnh đồng hồ; không modal. Là trạng thái, không thêm màn.
- Vì sao: MH-06 §9 điểm 6.

**HB-5 · P2 · D · Tiền: không · Trẻ em: không.** *Nút "Nộp bài" tách khỏi "Câu trước / Câu sau"; nút Đúng/Sai có đủ chữ.*
- Vấn đề: "Nộp bài" ngay cạnh "Câu trước", cùng cỡ (MH-06 §9 điểm 7); nút chỉ "Đ" và "S" gây nhầm với học sinh nhỏ (điểm 8).
- Cách giải: "Nộp bài" ở góc riêng, màu khác, cách xa nút chuyển câu; "Đúng" / "Sai" viết đủ chữ.
- Vì sao: MH-06 §9 điểm 7, 8.

**HB-6 · P2 · D · Tiền: không · Trẻ em: có.** *Lề ngang 16px ở Kết quả, Xem lại, Chữa bài; chữ đáp án không nhỏ hơn 14px.* Hiện các thẻ chạm sát mép màn 390px (MH-06 §9 điểm 2), chữ `text-xs` 12px khó đọc (điểm 5). Top 10 hiện tên bạn cùng lớp: chủ dự án quyết có hiện tên viết tắt hay không (MH-06 §9 điểm 11) — **không tự làm**. Vì sao: MH-06 §9 điểm 2, 5, 11.

**HB-7 · P2 · V · Tiền: không · Trẻ em: không.** *Chữa bài: thanh bước một hàng cuộn ngang, câu sai nổi bằng chip chữ "Sai".* Em sai 20 câu không nên thấy nhiều hàng chip che cả màn (MH-06 §9 điểm 17). **[suy luận]** cho phần chip chữ. Vì sao: MH-06 §9 điểm 17.

**HB-8 · P3 · D · Tiền: không · Trẻ em: không.** *Lỗi mạng ở trang đề: "Không tải được, Thử lại" khác hẳn "Không tìm thấy đề".* Hiện hai trường hợp cùng một chữ (MH-06 §9 điểm 10). Vì sao: MH-06 §9 điểm 10.

---

## 9. Danh sách 10 ý tưởng tốt nhất toàn bộ

Chọn theo ba tiêu chí: giảm độ dày thật cho điện thoại, chạm trực tiếp học sinh và phụ huynh, rủi ro tiền và trẻ em bằng 0 hoặc chỉ hiển thị.

| # | Ý tưởng | Màn | Ưu tiên | Độ khó | Tiền | Trẻ em | Vì sao nằm trong 10 |
|---|---|---|---|---|---|---|---|
| 1 | **HN-1** Trang chủ học sinh: chào + buổi sắp tới + việc cần làm, tối đa 3 dòng | Học sinh · Trang chủ | P1 | D | không | không | Màn mở mỗi tối; thay danh sách dày 3 dòng/mục bằng ba khối rõ nghĩa (MH-05 A §9; RT 4.1) |
| 2 | **HN-2 + LO-1** Học sinh chưa vào lớp: một câu + ô mã mời 5 ký tự | Học sinh · Trang chủ, Lớp | P1 | D | không | có (lối vào lớp, không thêm dữ liệu) | Hiện sai nghĩa "Bạn đã xong hết" làm em lạc ngay bước đầu (MH-05 A §9 điểm 1) |
| 3 | **HL-1 + HL-3** Lịch học: dải 7 ô ≥ 44px + buổi huỷ có chữ "Đã huỷ", bỏ nút "Vào học" | Học sinh · Lịch | P1 | D | không | không | Sửa hai lỗi em gặp thật: chạm nhầm và vào buổi đã huỷ (MH-05 B §9 điểm 2, 7) |
| 4 | **HB-3** "+N Coin" ngay sau khi nộp bài | Học sinh · Bài tập/Thi | P1 | V | không | không | Thưởng đã tính nhưng em không thấy; nhỏ nhưng làm em muốn làm bài tiếp (MH-06 §9 điểm 1) |
| 5 | **HB-4** Báo "Đang lưu / Chưa lưu được" khi thi | Học sinh · Phòng thi | P1 | V | không | không | An toàn cho em: mất mạng mà không biết là lỗi nặng nhất của phòng thi (MH-06 §9 điểm 6) |
| 6 | **HP-2** Một nút chính mỗi thẻ phiếu; nút phụ vào "Thêm" | Học phí | P1 | D | có (chỉ hiển thị) | không | Gỡ 5 nút ngang hàng; phụ huynh nhận phiếu rõ hơn (MH-04 §9 điểm 4); không đổi hành vi |
| 7 | **HP-1 + HP-3** Dải tổng Đã thu xanh / Còn lại cam + ô tiền nhóm nghìn "= 560.000đ" | Học phí | P1 | D | có (chỉ hiển thị) | không | Số tiền là thứ to nhất, ít gõ nhầm (MH-04 §9 điểm 2, 10; ảnh 22608da4) |
| 8 | **TQ-1** Một khối "Việc cần làm", ẩn khi bằng 0 | Tổng quan gia sư | P1 | D | không | không | Hai màn trùng nhau là nguồn rối lớn nhất của gia sư (MH-01 §9 điểm 1); xử lý nhanh yêu cầu xác nhận phụ huynh |
| 9 | **LI-1** Tin lịch và báo nghỉ gửi ra ngoài: không tên em, không số tiền | Lịch / thông báo | P1 | V | không | có (bảo vệ) | Quy tắc cứng, bảo vệ em dưới 16 (RT 3.9, 6.1) |
| 10 | **HLo-1** Một cửa "Lớp của tôi": danh sách → chi tiết → đường học | Học sinh · Lớp | P1 | D | không | không | Ba trang chồng cho một ý khiến em nhiều lớp không tìm được lớp mình (MH-05 C §9 điểm 1) |

Thứ tự làm đề xuất: 1, 2, 3, 8 (nhanh, độ khó D, không chạm tiền) → 5, 4, 10 → 9 → 6, 7 (chạm tiền chỉ ở hiển thị, làm sau khi chủ dự án nhìn bản mô phỏng).

---

## 10. Ý tưởng bị LOẠI (đừng đề xuất lại)

| Ý tưởng | Vì sao loại | Nguồn |
|---|---|---|
| Màn mua hoặc nạp Coin, gói Coin, đổi Coin lấy tiền | Quy tắc cứng: Coin chỉ nhận khi làm bài | RT 6.1; HS-DT |
| Thanh toán thẻ, Apple Pay, buổi thử có phí, hoa hồng | KiN thu học phí theo tháng qua chuyển khoản, không giữ tiền | RT 4.4, 6.1; ảnh d2a216a5 |
| Câu trấn an "không bị tính phí đến khi hoàn tất" | Sai với mô hình thu theo tháng | RT 4.4 |
| Chia sẻ yêu cầu của học sinh cho nhiều gia sư | Dữ liệu của trẻ rời hệ thống | RT 4.2, 6.1; ảnh 2e32d1cb |
| Đánh giá công khai có avatar và tên học sinh | Như trên | RT 4.2, 6.1 |
| Thêm ngày sinh, trường học, địa chỉ, ảnh vào hồ sơ học sinh | Học sinh có thể dưới 16 tuổi | RT 3.6, 6.1 |
| Hiện số tiền học phí trong màn học sinh 13–15 tuổi | Tiền nên đi qua phụ huynh | RT 3.9, 6.2 điểm 3 |
| Thông báo (toast, Zalo, push) chứa tên em hoặc số tiền | Quy tắc cứng | RT 3.4, 6.1; KH d.117 |
| Hộp xác nhận hai bước, "Hoàn tác" thao tác tiền, gộp phiếu, tạo nhiều phiếu | Đó là hành vi, không phải trình bày; chờ chủ dự án quyết | MH-04 §9 điểm 12, §12; RT 3.4 |
| Chỉ số "tiềm năng" (đã thu + chưa thu + dự báo) | Là chỉ số của Sổ Gia Sư, thêm cách tính mới | RT 3.4 |
| Nhãn "tính phí / không tính phí" trên điểm danh | Ở KiN tiền không phụ thuộc điểm danh | RT 3.5; QD d.103 |
| Cam cho "Offline", "Có phép", nhãn Pro | Cam của KiN nghĩa là "chờ/còn nợ" | RT 6.1 |
| Banner khuyến mãi mọi trang, bảng giá, mã giảm giá | Nhiễu và không thuộc giai đoạn miễn phí | RT 3.1, 3.7, 6.1 |
| Bảng xếp hạng thêm cho thi, thưởng ngẫu nhiên, nội dung cờ bạc | Có thể thành cờ bạc cho trẻ; quy tắc cứng | RT 6.1 |
| Phân quyền người xem ghi chú buổi (học sinh / phụ huynh / riêng tư) | Động tới dữ liệu của trẻ, chưa quyết | RT 3.5 |
| Ô hỏi "Bạn muốn học gì?" kiểu sàn gia sư làm cổng vào học sinh | KiN không phải sàn; học sinh vào qua mã mời của gia sư | RT 4.2; HS-DT (chỉ giữ ý "hỏi một câu rồi lọc" cho tìm lớp trong tương lai) |

---

## 11. Điều chưa kiểm chứng và việc cần chủ dự án quyết

1. **Thứ tự trang chủ gia sư trên điện thoại** (Việc cần làm trước Hôm nay, hay ngược lại): không có ảnh điện thoại nào phân xử (RT 3.1). Mặc định của tôi là Việc cần làm trước, tối đa 3 dòng.
2. **Hiện "Còn lại" ở trang chủ gia sư (TQ-4)** cần một phép cộng mới, mặc định MH-01 là KHÔNG làm. Cần anh quyết.
3. **Top 10 ở phòng thi có hiện tên đầy đủ bạn cùng lớp không** (HB-6): liên quan học sinh có thể dưới 16 tuổi. Không tự quyết.
4. **Khung QR trên phiếu** (HP-7): không ảnh nào trong 102 ảnh cho thấy QR thật (RT 3.8); thiết kế theo đặc tả KiN, cần xem bản dựng thử.
5. **Mọi ý tưởng phía học sinh về bài tập và phòng thi** (mục 8) là thiết kế riêng, chưa có bằng chứng đối thủ.
6. **Một số lỗi trong đặc tả là suy từ mã, chưa chạy thử** (ví dụ MH-02 §9 điểm 7, 9, 19; MH-05 Màn C §9 điểm 9). Nên chạy thử trước khi dựng.
