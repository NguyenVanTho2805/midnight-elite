# Học thử có hạn + nối form đăng ký BCA Midnight Class vào KiN + làm lại màn học sinh (SCL đợt 5)

Ngày chốt: 22/11/2026. Nhánh `claude/sua-chua-lon-5` (rẽ từ đợt 4, PR chồng thứ 5).

## Hiện trạng
- Form `aodtsix-cmd.github.io/bca-midnight-class` (một tệp `index.html`) có hai phiếu: **học thử 2 tuần** và **chính thức** (có phụ huynh). Gửi `POST` JSON tới Web App Apps Script, script ghi vào Sheet. Màn cảm ơn hẹn "anh Thanh nhắn Zalo trong 24 giờ"; link nhóm Zalo đang gửi qua email.
- `appsscript.json`: múi giờ Asia/Ho_Chi_Minh, có dịch vụ Calendar v3 (mời Meet qua Gmail), Web App chạy bằng tài khoản chủ, ai cũng gọi được.
- KiN: `Enrollment.status` chỉ có pending_consent / active / suspended; **không có hạn**. Mỗi lớp đã có `zaloGroupLink` (chỉ thành viên thấy). Có sẵn luồng quên/đặt lại mật khẩu.
- Chưa có lớp nào của BCA Midnight Class trên KiN.

## Quyết định của chủ (22/11)
| # | Quyết định |
|---|---|
| D1 | Form vẫn ở GitHub. Apps Script ghi Sheet như cũ **rồi gọi KiN**; KiN tự tạo tài khoản + ghi danh học thử, trả về link để trang GitHub chuyển tới. |
| D2 | Trang chuyển tới (trên KiN) có: nút **Đặt mật khẩu và vào lớp**, **lịch học** theo môn đã chọn, nút **nhóm Zalo học thử**, **hướng dẫn** vào Meet + dùng web. |
| D3 | Link Zalo học thử **chỉ** hiện cho người vừa gửi phiếu (mã dùng một lần, có hạn), không nằm trên trang công khai. |
| D4 | Gmail vẫn bắt buộc (mời Meet, đăng nhập dự phòng). Email vẫn gửi, chứa lại link vào KiN, làm kênh dự phòng. |
| D5 | Học thử **14 ngày, tính từ lần đầu em mở lớp trên web**; **một hạn chung** cho mọi môn em chọn. |
| D6 | Trong hạn: thấy **toàn bộ** tài liệu, bài tập, kiểm tra, video như học sinh chính thức. |
| D7 | Hết hạn mà chưa lên chính thức: **khoá hẳn** tài liệu/bài tập; vẫn đăng nhập được, thấy lớp mờ + nút "Đăng ký chính thức" + Zalo của anh Thanh. |
| D8 | Gửi phiếu chính thức (cùng SĐT) ⇒ em vào hàng "chờ xác nhận"; chủ bấm một nút ⇒ bỏ hạn, thành học sinh chính thức. |
| D9 | **Chỉ Khối 11, 12** được KiN tự tạo tài khoản. Khối 10 / khác: Sheet vẫn nhận, KiN không tạo, chủ xử lý tay qua Zalo. |
| D10 | Lịch học lấy **từ lịch lớp trên KiN** làm chuẩn (trang chào và vỏ học sinh cùng đọc). |
| D11 | Mỗi môn một lớp trên KiN (Toán, Sử, Địa, Anh — chủ tạo); nhóm Zalo chính thức của môn hiện trong trang lớp (ô có sẵn). |
| D12 | Màn học sinh làm lại cho "đầy đặn": thẻ lớp có ảnh bìa + màu môn + tiến độ; danh mục **chương › bài** có trạng thái; trang bài học như một bài giảng đủ khối (video, tài liệu, bài tập, bài trước/sau); động lực nhẹ (chuỗi ngày, vinh danh, điểm). Thương hiệu KiN, tên lớp "BCA Midnight Class". Điện thoại và máy tính ngang nhau. |
| D13 | Quy trình thiết kế: tham khảo các bên → **3 phương án** → hội đồng agent nhiều kiểu người chấm độc lập → chủ chọn → mới code. |
| D14 | Tài liệu: chủ tự kéo thả dần (không nhập hàng loạt từ máy). |

## Các tình huống phải xử lý (đã vạch)
1. **Gửi trùng**: cùng SĐT/Gmail gửi lại phiếu thử ⇒ không tạo tài khoản thứ hai, không gia hạn thêm; trang chào hiện lại link đặt mật khẩu / đăng nhập.
2. **Đã có tài khoản KiN** (cùng Gmail) ⇒ không đổi mật khẩu; ghi danh thêm môn mới; trang chào hiện "Đăng nhập".
3. **Mất trang chuyển tới** (tắt tab, hết pin) ⇒ email dự phòng chứa link; link hết hạn thì dùng "Quên mật khẩu" bằng Gmail.
4. **Mã trên link chuyển trang**: chỉ là mã ngẫu nhiên dùng một lần, hết hạn (vd. 7 ngày) — **không** đưa tên/SĐT/Gmail vào URL.
5. **Gọi giả từ ngoài**: Apps Script gọi KiN bằng khoá bí mật (header), KiN từ chối nếu thiếu/sai; giữ chặn spam sẵn có (ô bẫy `website`, thời gian mở form).
6. **KiN sập / chậm khi Apps Script gọi** ⇒ Sheet vẫn ghi xong, trang GitHub hiện màn cảm ơn cũ + Zalo anh Thanh (không mất phiếu); chủ tạo tay sau.
7. **Khối 10 / thí sinh tự do** ⇒ D9.
8. **Môn chưa có lớp trên KiN** ⇒ bỏ qua môn đó, trang chào ghi "môn này anh Thanh gửi lịch qua Zalo".
9. **Hạn 14 ngày khi em chưa mở lớp**: chưa tính ngày; trang lớp ghi "Bắt đầu tính 14 ngày từ lần đầu bạn vào lớp".
10. **Sắp hết hạn**: còn 3 ngày thì hiện băng nhắc trong lớp (không email/thông báo đẩy có tên).
11. **Lên chính thức giữa chừng**: chủ xác nhận ⇒ bỏ hạn ngay, giữ điểm/bài đã nộp.
12. **Chủ muốn gia hạn tay** cho một em ⇒ nút "Gia hạn 7 ngày" trong danh sách học sinh.
13. **Học sinh thử hết hạn cố mở link tài liệu trực tiếp** ⇒ máy chủ chặn (không chỉ ẩn nút).

## Việc còn chờ chủ
- **Gửi lại mã Apps Script** (tệp "BCA Midnight Class On-Demand Registration" đã không còn trên Desktop) để tôi viết phần gọi KiN.
- Tạo 4 lớp trên KiN (hoặc để tôi tạo trên máy thử để dựng giao diện).
- Duyệt 3 phương án giao diện khi có.

## Ràng buộc giữ nguyên
Schema chỉ thêm (dự kiến: `Enrollment.trialEndsAt`, `Enrollment.trialStartedAt`, bảng mã chào một lần); POST+303; token `--kin-*`; không chạm 5 tệp tiền; không thu thêm dữ liệu cá nhân ngoài phiếu; thông báo không tên/số tiền.
