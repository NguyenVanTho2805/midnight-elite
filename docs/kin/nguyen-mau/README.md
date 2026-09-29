# Nguyên mẫu bấm được

Năm trang HTML, mở thẳng bằng trình duyệt — không cài gì, không chạy server.
Tải kho về rồi bấm đúp vào file, hoặc kéo file thả vào cửa sổ Chrome.

**Số liệu trong đó là dữ liệu mẫu** của lớp HSA 2K9. Không phải dữ liệu thật.

| File | Cho xem cái gì |
|---|---|
| `01-giao-dien-that.html` | Giao diện `kin-app` **đang chạy thật**. CSS lấy nguyên bản từ `app/globals.css`, không vẽ lại. Có nút gạt nền tối và khung xem 390px. |
| `02-ba-khung.html` | Bố cục ba khung kiểu Outlook: thanh module dọc + danh sách + khung đọc. Bấm một dòng thì khung phải đổi, không tải lại trang. |
| `03-khong-gian-bon-vai.html` | **Quan trọng nhất.** Một vỏ, bốn vai: gia sư, học sinh, phụ huynh, quản trị. Bấm đổi vai ở thanh trên cùng — cả module, danh sách và *cách gọi tên sự việc* đều đổi. Có module Lịch dạng tuần. |
| `04-hoc-thu.html` | Luồng hỏi đáp mở và máy trạng thái lời mời học thử sáu bước. Xem được cùng lúc ba bên nhìn thấy gì. |
| `05-quyet-dinh.html` | Mười hai quyết định đang chặn việc, mỗi cái có đề xuất và giá phải trả khi hoãn. |

## Ba điều rút ra từ đây, không chỉ là ảnh đẹp

**Một vỏ, nhiều vai.** Không dựng bốn ứng dụng. Dựng một vỏ rồi đổi ruột theo vai.
`03` là bản chứng minh điều đó làm được.

**Cùng một việc, mỗi vai một giọng.** Buổi chờ xác nhận: gia sư đọc "6 lượt chờ",
phụ huynh đọc "Anh/chị xác nhận giúp 2 buổi học của con", học sinh không thấy gì.
Chỗ nào ghi "không hiện" là một quyết định đã chốt, không phải chỗ trống.

**Màu không bao giờ nói một mình.** Mọi trạng thái đều có chữ đi kèm, không chỉ
chấm màu. Xem `../thiet-ke/tokens.css` để lấy đúng mã màu đã đo tương phản.

## Lưu ý kỹ thuật

- Font lấy từ Google Fonts. Không có mạng thì trang vẫn đọc được, chỉ rơi về font hệ thống.
- Bố cục dùng container query nên thu nhỏ **khung** là thấy bản điện thoại, không cần thu cửa sổ.
- Đây là nguyên mẫu, không phải code sản xuất. Lấy bố cục, luồng và màu — đừng bê nguyên JS.
