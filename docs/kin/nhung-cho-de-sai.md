# Những chỗ dễ sai

Ghi lại các lỗi đã thật sự xảy ra trong sản phẩm này, cách phát hiện và cách sửa. Viết cho người sẽ dựng lại hệ thống ở quy mô lớn hơn: phần lớn những chỗ này không phải lỗi lập trình cẩu thả, mà là **những chỗ mà làm đúng theo bản năng lại ra sai**.

Mỗi mục đều có một bài trong `tests/` giữ chỗ để lỗi không quay lại.

Cách tìm ra: dựng một môi trường chạy thật với dữ liệu ba gia sư cố ý đặt trùng tên lớp và trùng tên học sinh, rồi soát song song bốn mặt trận — tách tài khoản, tính tiền, phiên đăng nhập, và chạy tay mọi luồng bằng trình duyệt. Tổng cộng 45 phép thử; 34 trong số đó đã đưa vào `tests/` chạy được bằng `npm test`, phần còn lại là kiểm tay bằng trình duyệt.

---

## 1. Nút kẹt vĩnh viễn ở "Đang lưu…" — bài học đắt nhất

**Triệu chứng.** Gia sư bấm "Thêm học sinh". Em đầu tiên vào được. Từ em thứ hai, nút chuyển thành "Đang lưu…" rồi **đứng im mãi mãi**, `disabled`. Tệ hơn: trong lúc kẹt, màn hình vẫn hiện dòng xanh "Đã thêm Em 1" — nên gia sư gõ tên Em 2, Em 3, Em 4, mỗi lần bấm đều thấy một thông báo thành công, mà không em nào được lưu. Họ đi dạy với nửa lớp bị thiếu và không hề biết.

**Quan sát được gì.** Bắt sự kiện mạng trong trình duyệt: request POST của server action bị **huỷ giữa chừng** (`net::ERR_ABORTED`) khoảng 200 ms sau khi bấm. Máy chủ đã xử lý xong và ghi dữ liệu đúng; chỉ có phía trình duyệt là không bao giờ nhận được kết thúc, nên React giữ trạng thái "đang gửi" vĩnh viễn.

**Điều quan trọng nhất.** Lỗi này **có sẵn trong bản gốc**, không phải do bản vá sinh ra — tôi dựng lại nguyên bản mã cũ và nó hỏng y hệt. Nó ẩn được lâu vì chỉ hiện ra khi bấm liên tiếp nhiều lần mà không tải lại trang, và vì thông báo thành công của lần trước vẫn nằm trên màn hình che mất.

**Đã thử năm cách trong React** — bỏ remount form, thêm mã ngẫu nhiên vào địa chỉ chuyển hướng, đổi `key`, đổi chỗ `redirect()`, tách `useActionState` khỏi `useFormStatus` — cách nào cũng lúc được lúc không.

**Cách sửa.** Bỏ hẳn server action cho chín thao tác có ghi dữ liệu, chuyển về **gửi biểu mẫu thường của trình duyệt rồi chuyển hướng 303**:

```
app/(gs)/lop/them/route.js        thêm học sinh
app/(gs)/lop/diem-danh/route.js   lưu điểm danh
app/(gs)/lop/thao-tac/route.js    sửa điểm danh, xử lý báo sai, cho nghỉ, đổi link, xoá buổi
app/(gs)/hoc-phi/ghi/route.js     ghi nhận / huỷ ghi nhận học phí
```

Trình duyệt tự điều hướng, không có trạng thái nào để kẹt. Đổi lại là mỗi thao tác tải lại trang trong khoảng nửa giây đến một giây rưỡi — chậm hơn, nhưng chắc chắn. Kiểm lại hơn 40 lượt bấm liên tiếp, không kẹt lần nào.

**Quy tắc rút ra.** Thao tác có ghi dữ liệu thì dùng POST thường. Server action để dành cho việc cần trả lỗi về form mà không điều hướng (đăng nhập, cài đặt, góp ý).

**Họ hàng của nó.** `<Link>` của Next.js trỏ tới **cùng đường dẫn chỉ khác query** cũng bị huỷ giữa chừng — đo được hỏng 4 trên 10 lần trên nút "Tháng trước", "Tháng sau" và "Mã QR" ở trang Học phí. Với người dùng thì đó là "bấm không có gì xảy ra". Sửa bằng cách dùng thẻ `<a>` thường.

---

## 2. Tiền phải được chốt vào sự kiện, không được đọc lại từ cha

**Lỗi.** Học phí tính bằng `số buổi × classes.rate`, tức là đọc giá **hiện tại** của lớp. Tháng 9 thu đủ 180.000 đ/buổi. Sang tháng 10 gia sư tăng giá lên 250.000 đ. Mở lại phiếu **tháng 9** thì hệ thống nói phụ huynh còn thiếu 70.000 đ, kèm nút đòi tiền và mã QR gửi đi. Giao diện lúc đó còn ghi "đổi học phí sẽ áp dụng cho các buổi chưa thu tiền" — câu đó sai.

**Sửa.** Thêm cột `attendances.rate`, ghi giá lớp vào từng buổi **ngay lúc điểm danh**. `invoiceFor` đọc giá đã chốt, chỉ rơi về giá lớp khi buổi cũ chưa có.

**Quy tắc.** Bất cứ con số tiền nào cũng phải chụp lại tại thời điểm phát sinh. Đọc lại từ thực thể cha là mở đường cho việc sửa quá khứ mà không ai hay.

Hệ quả phải xử lý kèm: khi trong một tháng có nhiều mức giá thì biên lai **không được in một mức giá nào cả** — `invoiceFor` trả `mucGia = null` để nơi hiển thị bỏ phần "× giá" đi, thay vì in một con số làm phép nhân không khớp với tổng.

---

## 3. Bấm hai lần phải ra cùng một kết quả — nhưng cẩn thận cách làm

**Lỗi ban đầu.** Bấm "Đã nhận" hai lần (hai tab, hoặc bấm lại khi mạng chậm) thì chèn hai dòng thanh toán, sổ ghi thu gấp đôi. Không có đường lùi: không có chỗ nào xoá được dòng thanh toán.

**Sửa lần một, và nó đẻ ra lỗi nặng hơn.** Đổi thành "đặt lại giá trị thay vì cộng dồn". Nhưng form vẫn gửi lên **phần còn thiếu**, không phải tổng. Hậu quả: thu 540.000 đ giữa tháng, dạy thêm 2 buổi, thu tiếp 360.000 đ → dòng thanh toán bị ghi đè thành 360.000 đ. Sổ mất 540.000 đ, và trang phụ huynh **chủ động đòi họ trả lại đúng phần đã trả**.

**Sửa đúng.** Form gửi lên **tổng cần đạt** (`đã nhận + còn lại`), phía ghi nhận đặt lại giá trị bằng `max(số gửi lên, số đang có)`. Bấm hai lần ra cùng kết quả; thu nhiều đợt vẫn cộng đủ. Thêm nút "Huỷ ghi nhận" làm đường lùi.

**Quy tắc.** Muốn một thao tác bất biến khi lặp thì tham số gửi lên phải là **trạng thái đích**, không phải mức thay đổi.

---

## 4. Chặn trùng ở ba tầng, không phải một

**Lỗi.** Bấm "Lưu điểm danh" sáu lần khi mạng chậm thì tạo sáu buổi cùng ngày. Phiếu ghi 6 buổi, 1.080.000 đ, trong khi thực tế dạy một ngày, 180.000 đ. Không có cảnh báo nào.

**Sửa, cả ba tầng:**

1. Kiểm tra trước khi ghi, trả về câu tiếng Việt nói rõ phải làm gì.
2. `insert ... select ... where not exists` ngay trong câu lệnh, để hai tab gửi cùng lúc cũng chỉ một cái lọt.
3. Ràng buộc duy nhất `sessions_class_date` ở cơ sở dữ liệu, bắt mã lỗi `23505` và đổi thành câu tiếng Việt.

Thiếu tầng nào cũng có đường lọt. Kiểm bằng cách bắn năm lượt gửi cùng lúc: ra đúng một buổi.

---

## 5. Trạng thái không nằm trong công thức thì phải hiện ở chỗ khác

**Lỗi.** Buổi phụ huynh bấm "Không đúng" chuyển sang `DISPUTED`. Công thức tính tiền loại nó ra — đúng. Nhưng nó cũng không nằm trong mục "chờ xác nhận", nên **biến mất khỏi cả phiếu học phí lẫn file Excel**. Với dữ liệu thử, 180.000 đ treo lơ lửng không ai nhìn thấy. Gia sư không mở đúng trang lớp thì khoản đó mất luôn, im lặng.

**Sửa.** `invoiceFor` trả thêm `disputedN` và `disputedAmt`; trang Học phí có một cột riêng và một dải cảnh báo ở đầu trang; file CSV có hai cột mới.

**Quy tắc.** Mỗi trạng thái đều phải có đúng một chỗ trên màn hình. Trạng thái bị loại khỏi công thức mà không hiện ở đâu cả là cách âm thầm nhất để mất tiền.

---

## 6. Chặn kẻ tấn công, đừng chặn nạn nhân

**Lỗi.** Đăng nhập không giới hạn số lần thử. Đo được khoảng 10 lần đoán mỗi giây; một mật khẩu nằm trong danh sách 10.000 từ phổ biến bị dò ra trong **17 phút**. Thêm nữa, email có thật phản hồi chậm hơn email không tồn tại **88 mili giây** (vì chỉ email có thật mới chạy `bcrypt.compare`), đủ để liệt kê chính xác ai đã đăng ký.

**Sửa lần một, và nó đẻ ra lỗi mới.** Khoá theo email sau 8 lần sai. Nhưng ai biết email của một gia sư cũng **khoá được tài khoản người ta** bằng cách gõ sai vài lần — email gia sư hiện công khai ngay trên trang quản trị và trong mọi tin nhắn gửi phụ huynh.

**Sửa đúng.** Khoá theo **máy đang dò** (20 lần sai trong 15 phút). Email bị gõ sai nhiều chỉ bị bắt chờ 1,5 giây, và **mật khẩu đúng thì luôn vào được**. Chạy `bcrypt.compare` với một hash giả khi email không tồn tại để cân bằng thời gian phản hồi.

**Quy tắc.** Cơ chế chống lạm dụng nào cũng phải hỏi: ai là người bị chặn? Nếu kẻ tấn công chặn được nạn nhân bằng chính cơ chế đó thì nó là lỗ hổng mới, không phải bản vá.

---

## 7. Danh sách quản trị không được có giá trị mặc định trong mã

**Lỗi.** `ADMIN_EMAILS` có danh sách mặc định ghi cứng trong `lib/auth.js`, và đăng ký không xác minh email. Bất kỳ ai vào trang đăng ký, điền đúng một trong những email đó, đặt mật khẩu tuỳ ý, là **vào thẳng trang quản trị** — thấy danh sách toàn bộ gia sư kèm email, mọi khiếu nại của phụ huynh kèm tên học sinh, toàn bộ góp ý.

**Sửa.** Danh sách chỉ đọc từ biến môi trường, để trống thì không ai là quản trị. Email trong danh sách bị chặn đăng ký.

**Quy tắc.** Giá trị mặc định tiện cho lúc chạy thử, nhưng danh sách quyền thì không được có mặc định — thiếu cấu hình phải là "không ai có quyền", không phải "người đoán trúng có quyền".

---

## 8. Kiểm quyền sở hữu trước mọi lệnh ghi, kể cả lệnh dọn dẹp

**Lỗi.** Trang lớp gọi `applyAutoConfirm({ classId })` **trước** khi kiểm tra lớp đó có phải của mình không. Mở đường dẫn lớp của gia sư khác thì trang báo "không tìm thấy" — nhưng lệnh cập nhật đã chạy trên dữ liệu của họ rồi.

**Sửa.** Nạp lớp và `notFound()` trước, rồi mới chạy lệnh ghi. `applyAutoConfirm` cũng kẹp thêm `tutor_id`. `loadSessions` đổi chữ ký thành `loadSessions(tutorId, classId)`.

**Quy tắc.** Hàm nào nhận mã lớp hay mã học sinh thì nhận luôn mã gia sư và kẹp vào câu truy vấn. Đừng tin nơi gọi đã kiểm rồi.

Soát 11 thao tác nhận mã từ người dùng: tất cả đều chặn đúng khi gọi bằng mã của gia sư khác. Lỗ duy nhất là lệnh dọn dẹp tự động ở trên — thứ mà không ai nghĩ là "thao tác của người dùng".

---

## 9. Migration trên hệ thống có người dùng thật thì không được xoá gì

Bản migration đầu tiên có lệnh xoá các dòng trùng lặp trước khi tạo ràng buộc duy nhất. Trên dữ liệu thử thì sạch sẽ. Nhưng nếu hệ thống thật có hai buổi cùng ngày vì **lý do chính đáng** — gia sư dạy hai ca một ngày — thì lệnh đó xoá lịch sử thật.

Viết lại: đếm trước, nếu có dữ liệu trùng thì **bỏ qua việc tạo ràng buộc** và ghi cảnh báo ra log để người thật xem, chứ không tự dọn. Vì ràng buộc có thể không tạo được, phần chặn trùng trong mã ứng dụng không được phép dựa vào nó (xem mục 4, tầng 2).

---

## 10. Báo lỗi thì giữ nguyên thứ người dùng vừa nhập

Mọi form đều xoá trắng dữ liệu khi báo lỗi. Nặng nhất là điểm danh: chọn nhầm ngày thì **mất hết trạng thái vừa bấm cho cả lớp** — lớp 8 em phải bấm lại từ đầu.

Còn một dạng tinh vi hơn ở trang đăng ký: sau khi báo "email đã có tài khoản", ô tên còn nguyên nhưng email và mật khẩu bị xoá. Người dùng gõ lại email rồi bấm, **không có gì xảy ra** (trình duyệt âm thầm chặn vì ô mật khẩu trống), trong khi dòng chữ đỏ cũ vẫn nằm đó. Họ kết luận email mới cũng "đã có tài khoản" và bỏ cuộc.

Sửa: trả lỗi kèm những gì đã nhập, đặt lại vào form, đưa con trỏ vào ô trống đầu tiên, và ẩn thông báo lỗi cũ ngay khi người dùng sửa dữ liệu.

---

## Còn lại, chưa sửa

- **Khoá ký phiên nằm trong cơ sở dữ liệu.** Ai đọc được dữ liệu thì giả mạo được đăng nhập của mọi gia sư, không cần mật khẩu. Không có cách thu hồi từng phiên; đổi khoá là đá văng tất cả.
- **Link phụ huynh nằm trong đường dẫn**, nên đi vào lịch sử trình duyệt và log máy chủ. Có nút tạo lại link, nhưng bản chất thiết kế vẫn vậy.
- **Giới hạn 5 góp ý mỗi giờ tính theo tài khoản**, mà đăng ký thì không giới hạn.
- **Một lớp một ngày chỉ được một buổi** — quyết định nghiệp vụ, chưa chốt lại với người dùng thật.
