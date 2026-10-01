# Bàn giao màn hình cho anh Thọ (TK-165 đến TK-183)

Bản 01/10/2026. Mỗi việc TK trong sheet ghi: khung Figma nào, đặc tả nào quyết định luật, và
những điểm dễ làm sai. Khi Figma và đặc tả khác nhau thì **đặc tả thắng**; báo em để sửa Figma.

File Figma: **KiN Design System** (`2orXvoHL2upkiGoMjlq8aX`). Mở một khung bằng
`https://www.figma.com/design/2orXvoHL2upkiGoMjlq8aX/KiN-Design-System?node-id=<mã>`, đổi dấu
`:` trong mã thành `-` (ví dụ `22:2` → `22-2`).

Token và chữ: `docs/kin/tokens/` (đọc `README.md` trước). Không viết mã màu hay cỡ chữ thẳng
vào CSS.

---

## Nền tảng

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-165 · cắm `tokens.css` | trang *📐 Nền móng* | `tokens/README.md` | chạy `kiem-tra-token.py` trong CI; không sửa `tokens.css` bằng tay |
| TK-167 · 5 chủ đề × sáng/tối | *🎨 Năm chủ đề* | `tokens/README.md` | lưu theo tài khoản, không theo máy; chỉ đổi màu nhấn |
| TK-168 · khoá phòng thi Navy | *🧪 Phòng thi* `27:2` | `tokens/README.md`, luật 4 | bọc `[data-vung="phong-thi"]` |
| TK-183 · ô nhập, modal, toast, tab | *🧩 Ô nhập & thông báo*: `105:26` ô nhập, `106:23` toast, `106:30` tab, `106:51` hộp xác nhận | — | là component có biến thể; dựng một lần, dùng lại |

## Vào ứng dụng

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-170 · đăng nhập, nhập mã, vào lớp | *🔐 Đăng nhập*: `32:2`, `32:27` (gồm lúc sai mã), `32:54` | — | một ô, một mã 6 số; không mật khẩu |
| TK-177 · bản đồ đường vào | `33:2` | — | ai vào bằng gì, hết hạn thì sao; dùng làm luật cho phiên đăng nhập |

## Khung lớp và hộp việc

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-179 · hộp việc kiểu Outlook | *🧭 Khung gộp* `123:6`; phương án C `119:149` | `quyet-dinh-giao-dien-va-hoc-phi.md` mục 2, `thiet-ke/bo-cuc-outlook.md` | màn mặc định khi mở app; nhóm Ngay bây giờ / Trong hôm nay / Để sau |
| TK-180 · Lớp của tôi | `123:145` (bố cục Outlook), `34:2` (danh sách lớp) | như trên | bấm lớp → hai cột: danh sách buổi, nội dung buổi |
| TK-171 · danh sách học sinh | `34:2`; điện thoại `108:2` | — | vạch màu chủ đề bên trái, vòng chữ cái tên |
| Vỏ 4 vai | *🖥 Vỏ ứng dụng*: `9:2`, `11:98`, `11:197`, `11:287`; chế độ gọn `177:265`; nhắc lịch `178:285` | `nghiep-vu/lich-nhac-va-che-do-gon.md` | menu trái 226px |

## Điểm danh và học phí

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-172 · điểm danh | `22:2`; điện thoại `107:3` | `nghiep-vu/dua-bang-tinh-len-web.md` mục 2 | **5 trạng thái**: Có mặt, Muộn, Có phép, Vắng, và Chưa điểm danh (không chọn nút nào). Chưa điểm danh không tính vào chuyên cần. Cột chuyên cần là điểm /10 theo hệ số 1 / 0,9 / 0,8 / 0,5 |
| TK-173 · phiếu học phí + VietQR | phiếu phụ huynh `24:2`, điện thoại `108:114`; quy tắc lớp `199:74`; sửa phiếu từng em `200:74` | `dua-bang-tinh-len-web.md` mục 1, `nghiep-vu/doi-soat-vietqr.md` | tiền = tổng đơn giá từng buổi; **không làm tròn**; ba loại giảm; QR mang đúng phần còn lại; nội dung bắt đầu bằng mã `KIN` + 5 ký tự |
| TT-200 · đối soát chuyển khoản | hàng chờ của gia sư `205:76` | `doi-soat-vietqr.md` | dựng được (anh chốt 02/10: giai đoạn đầu chưa thu phí). KiN không giữ tiền, chỉ đọc tiền vào |

## Phụ huynh

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-178 · sổ học của con, báo ghi nhầm | *👪 Trang phụ huynh*: `127:8` sổ học, `127:62` báo ghi nhầm, `171:2` báo cáo tháng | `quyet-dinh-giao-dien-va-hoc-phi.md` mục 4, `nghiep-vu/hoc-tu-khan.md` | link riêng, không tài khoản. Câu "Học phí tháng không đổi" ở màn báo ghi nhầm **phụ thuộc cài đặt lớp** (xem mục 4 đã sửa 01/10) |

## Lớp, thư viện, phòng thi

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-174 · phòng thi | `27:2`; chữa bài `175:87` | `hoc-tu-khan.md` (NV-188) | ô đáp án cao 52px; gợi ý trước, đáp án sau |
| TK-176 · thư viện | *📚 Lớp & Thư viện* `30:2` | — | bản ghi và tài liệu theo buổi |
| Buổi học, tiến bộ (thêm 30/09) | `193:74` kế hoạch 4 hoạt động; `194:74` tiến bộ và kết nối; `172:2` phút luyện tập | `pheu-gia-su.md` mục 5, `hoc-tu-khan.md` | chưa có mã TK riêng; dựng sau TK-180 |

## Cộng đồng

| Việc | Khung Figma | Đặc tả | Lưu ý khi dựng |
|---|---|---|---|
| TK-175, TK-181 · cộng đồng là không gian riêng | *🌱 Phễu, Zalo & Cộng đồng — v2*: C1 `188:77`, C2 `188:172`, C3 `189:74`, C4 `189:124`, C5 `190:74`, C6 `197:74`, C7 người chưa đăng nhập `210:74` | `pheu-gia-su.md` mục 4 | không nằm trong khung lớp, mở từ "Cộng đồng ↗". **Ai cũng xem bài Công khai, không cần đăng nhập**; cổ vũ, bình luận, hỏi, đăng, nhắn phải đăng nhập (anh chốt 02/10). Người chưa đăng nhập chỉ thấy tên hiển thị của học sinh; Google không lập chỉ mục bài của học sinh dưới 16 tuổi (`GD-26`). Khung cũ `29:2` và `120:5` chỉ để tham khảo |
| Phễu gia sư, Zalo | A1 `182:78`, A2 `182:131`, A3 `184:74`, A5 `185:74`; B1–B4 `186:77`, `186:112`, `187:74`, `187:124`; bảng D `191:77` | `pheu-gia-su.md` mục 1–3 | hồ sơ gia sư và trang lớp đang mở là trang công khai; link có đuôi `?n=` để đo nguồn |

## Điện thoại và trạng thái

| Việc | Khung Figma | Lưu ý khi dựng |
|---|---|---|
| TK-182 · bản điện thoại | *📱 Bản điện thoại*: `107:3` điểm danh, `108:2` lớp, `108:114` học phí | cùng luật với bản máy tính; nút cao tối thiểu 44px |
| Rỗng, đang tải, lỗi | *⚠️ Trạng thái*: `28:2`, `28:15`, `28:39` | màn nào có danh sách cũng cần đủ ba trạng thái |

---

## Khung cũ, không dựng theo

| Khung | Vì sao |
|---|---|
| *🖼 Toàn cảnh 12 màn hình* (`91:*`) | bản chụp 27/09 để xem chủ đề màu; số liệu và luật đã cũ |
| *🗄 Lưu trữ — trước TK-206* | bản trước khi gắn cỡ chữ vào biến |
| `29:2`, `120:5` | hỏi đáp mở, bản 24/09; thay bằng C1 đến C7 |

## Đã sửa trên Figma ngày 01/10

- `22:2`, `107:3`: thêm trạng thái **Có phép**; thanh tóm tắt đếm cả "chưa điểm danh"; bỏ câu
  "học phí tính theo tháng".
- `24:2`, `108:114`: lịch đúng lớp (Toán T2–T5, Sử T3, Anh T4–T7), số buổi đếm theo lịch tháng
  9/2026 và ngày lễ 2/9; "Giảm trừ" đổi thành "Nguồn khác"; nội dung chuyển khoản theo mã mới.
- `200:74`: ghi rõ hai buổi lớp nghỉ để số buổi khớp lịch tháng 10/2026.
- Thêm `205:76`: hàng chờ đối soát chuyển khoản.
