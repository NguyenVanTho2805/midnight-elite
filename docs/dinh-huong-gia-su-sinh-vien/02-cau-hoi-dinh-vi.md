# Bộ 36 câu hỏi định vị chiến lược (kèm câu trả lời gốc)

> Đây là bộ câu hỏi dùng để tự phản biện hướng đi trước khi code, cùng câu trả lời gốc của người
> sáng lập Tsix. Kết luận cuối cùng rút ra từ các câu trả lời này nằm ở
> [`01-chien-luoc.md`](./01-chien-luoc.md) — file này là **nguồn thô** để tra lại ngữ cảnh khi cần.

## 1. Tầm nhìn & vai trò trung gian

**1.1.** Nếu Tsix trở thành "bên thứ ba" đứng giữa giáo viên và học viên, ai là khách hàng trả tiền chính?
> Tôi muốn theo kiểu đăng ký và chỉ thu tiền ở đầu người dạy - gia sư.

**1.2.** Tsix có nên tự sản xuất nội dung dạy học nữa không, hay chuyển hẳn sang chỉ cung cấp hạ tầng?
> Định hướng dài hạn sẽ là cung cấp hạ tầng nhé. Hạ tầng vững rồi thì tính tiếp sau.

**1.3.** Ranh giới trách nhiệm ở đâu khi có tranh chấp giữa giáo viên và học viên?
> Sẽ phải có các ràng buộc pháp lý với người dạy. Hạ tầng tôi build là giáo viên sẽ thuê để phục vụ
> việc dạy của mình, chứ không phải học sinh cũng phải bỏ tiền ra thuê — học sinh chỉ tải về và có
> một số tính năng free như confession, tra điểm... còn khoá học với từng gia sư tự do thì sẽ khác.

**1.4.** Coin có nên trở thành đơn vị giữ tiền ký quỹ (escrow) giữa giáo viên và học viên không?
> Chưa có thông tin (lúc trả lời) → sau đó chốt: **không escrow**, Coin là số dư trả trước
> gia sư tự nạp — tự tiêu (xem 01-chien-luoc.md).

**1.5.** Tsix thu phí theo % doanh thu, phí cố định hàng tháng, hay cả hai?
> Thu theo phí cố định nhé, lớp càng đông thì thu thêm cao.

## 2. Đối thủ & việc tự dạy online tự do

**2.1.** Điểm đau cụ thể nào đủ lớn để giáo viên trả phí chuyển từ Meet/Zalo sang Tsix?
> Azota chấm nhanh nhưng chuẩn hoá tài liệu khó, phải đúng mẫu. Tôi tích hợp AI quét và sắp xếp
> đúng thứ tự. Shub quản lý bài tập nhưng tìm rất lâu, không gắn liền với buổi học.

**2.2.** Tsix khác Shub/Azota ở điểm nào khi cùng có ngân hàng đề/chấm bài?
> Call API AI xử lý dựa trên câu hỏi và đáp án mà gia sư đã chuẩn bị từ trước.

**2.3.** Nếu Shub/Azota miễn phí, điều gì bù đắp cho việc Tsix thu phí giáo viên?
> Phải tích hợp sâu vào workflow của người dạy, người học, phụ huynh — không tách riêng khỏi
> Zalo/Messenger mà gắn sâu vào đó.

**2.4.** Tính năng nào Tsix có mà Meet/Shub/Azota không có?
> Chưa nghĩ ra, nhờ gợi ý → đã đề xuất: hồ sơ năng lực công khai, marketplace 2 chiều, dashboard
> phụ huynh qua Zalo OA (xem 03-tinh-nang-uu-tien.md).

**2.5.** Trung tâm luyện thi đã dùng Shub lâu năm ngại điều gì khi chuyển sang Tsix?
> Cho dùng miễn phí với quy mô lớp bé, sẵn sàng thay đổi theo mong muốn của từng tài khoản riêng.

## 3. Đối tượng mục tiêu & nhu cầu thị trường

**3.1.** Ưu tiên nhóm giáo viên nào trước?
> Trước mắt sẽ là gia sư tại nhà. Mô hình dạy online, có record, up record thành bài giảng kèm
> tài liệu.

**3.2.** Nhu cầu lưu trữ tài liệu khác nhau thế nào giữa các nhóm học viên?
> Trước hết là học sinh phổ thông và sinh viên, sau thêm khoá kỹ năng. Tài liệu do người dạy chuẩn
> bị, AI chuẩn hoá lại đúng form.

**3.3.** Phụ huynh có phải một "người dùng" riêng không?
> Phụ huynh có thể theo dõi con, theo cách mà VNEDU đã từng làm.

**3.4.** Nhu cầu lớn nhất của giáo viên dạy thêm tại Việt Nam là gì?
> Chỗ lưu tài liệu, hệ thống khoá học, show lộ trình cho phụ huynh; check điểm, lưu quá trình học;
> thông tin kỳ thi, định hướng tâm lý học sinh.

**3.5.** Thị trường ngách nào đủ nhỏ để Tsix chiếm ưu thế trước?
> Chưa nghĩ tới quy mô toàn quốc — trước mắt muốn phát triển dịch vụ cho **sinh viên muốn đi dạy
> gia sư** với chi phí rất rẻ. *(Đây là câu trả lời chốt ICP quan trọng nhất của cả bộ câu hỏi.)*

## 4. Sản phẩm & tính năng khác biệt

**4.1.** Diễn đàn hỏi đáp có nên mở rộng liên lớp không?
> Có, tương tác giữa mọi nơi, vừa giải trí vừa học thuật.

**4.2.** Tsix cần môi giới chủ động hay chỉ marketplace tự phục vụ?
> Chủ yếu marketplace: gia sư lập tài khoản, mở khoá học, add học sinh của mình vào — kết hợp ý
> tưởng từ Shub, Azota, ClassIn, VNedu và QUANDA nhưng chỉn chu hơn.

**4.3.** Có nên tích hợp gọi video ngay trong Tsix?
> Hướng tới sự tiện lợi toàn diện — giúp giáo viên và học sinh có trải nghiệm tốt nhất.

**4.4.** Có nên có hồ sơ năng lực công khai cho giáo viên?
> Có.

**4.5.** AI nên đóng vai trò gì?
> Như một bộ não gắn kết giữa tài liệu và người đọc — thu hẹp khoảng cách, đẩy năng suất học tập,
> rút ngắn thời gian.

## 5. Lưu trữ tài liệu & dữ liệu

**5.1.** Có cần không gian lưu trữ tổng quát, tách khỏi khoá học/đề thi cụ thể?
> Có.

**5.2.** Ai sở hữu tài liệu khi giáo viên rời nền tảng?
> Có thể ở lại với học viên, có thể bị khoá nếu không đủ tiêu chí chất lượng, giáo viên cũng có thể
> tải về toàn bộ nếu ngừng hoạt động với nền tảng.

**5.3.** Giới hạn dung lượng nên gắn với gói thuê bao hay miễn phí không giới hạn?
> Theo từng gói từ thấp đến cao, tương ứng với khối lượng dung lượng lưu.

**5.4.** Cơ chế bảo vệ tài liệu có bản quyền?
> Watermark theo học viên, giới hạn tải xuống, chỉ xem online — có thể áp dụng cả ba tuỳ mức độ
> bảo mật gia sư mong muốn.

## 6. Mô hình doanh thu & giá

**6.1.** Thuê bao cố định, hoa hồng %, hay bán gói Coin nạp trước — mô hình nào phù hợp?
> Chưa biết nên thu cái nào để người dạy sẵn sàng chi nhất — thời gian đầu sẽ free, sau đó tạo vài
> rào cản để họ muốn dùng bản premium.

**6.2.** Học viên có nên trả phí riêng cho lưu trữ tài liệu?
> Học viên không tự lưu tài liệu được — phải vào lớp của giáo viên mới có tài liệu. Nếu chưa vào
> lớp nào thì giao diện giống học sinh ở Azota, gần như trống.

**6.3.** Mức phí nào là ngưỡng tâm lý giáo viên sẵn sàng trả?
> Trung bình 1 buổi dạy thêm khoảng 300k/buổi, mức phí thu khoảng 50k/tháng sẽ ổn.

**6.4.** Có nên có gói miễn phí giới hạn số học viên?
> Có.

## 7. Vận hành, pháp lý & lòng tin

**7.1.** Có cần xác minh danh tính/bằng cấp giáo viên trước khi cho thuê nền tảng?
> Sẽ không yêu cầu quá cao trong mục này.

**7.2.** Nghĩa vụ pháp lý gì khi giữ tiền hộ hai bên?
> Chắc chắn sẽ tuân thủ hoàn toàn pháp lý Việt Nam đưa ra.

**7.3.** Chính sách hoàn tiền nên do Tsix quyết định hay để gia sư tự đặt?
> Tiền nong giữa người dạy và học sinh (học phí 2 bên) tôi không can dự. Tôi chỉ thu tiền giáo viên
> khi họ sử dụng sản phẩm của mình.

**7.4.** Dữ liệu học viên thuộc về ai?
> Sẽ thuộc về toàn bộ nền tảng, hoặc áp dụng bảo mật tuỳ theo hợp đồng của từng giáo viên.

## 8. Tăng trưởng, rủi ro & ưu-nhược điểm

**8.1.** Kênh nào thu hút giáo viên đầu tiên rẻ nhất?
> Cân nhắc cả 3 phương án (cộng đồng mạng xã hội, hợp tác trung tâm nhỏ, SalesLead cũ), trước mắt
> sẽ hợp tác với sinh viên nhiều hơn.

**8.2.** Rủi ro lớn nhất của mô hình trung gian?
> Rò rỉ tài liệu/dữ liệu khách hàng, không tạo được khác biệt độc quyền, không giữ chân được khách
> hàng gây mất uy tín nền tảng.

**8.3.** Ưu thế thực sự của Tsix nói trong một câu?
> "Chưa hiểu lắm" (lúc trả lời) → đã đề xuất và được chốt: xem câu định vị ở đầu
> [`01-chien-luoc.md`](./01-chien-luoc.md).

**8.4.** Nếu chỉ giữ đúng một tính năng làm mũi nhọn, sẽ là tính năng nào?
> Khoá học — vì mỗi gia sư (là sinh viên) sẽ có riêng cho mình một khoá học.
