# Figma Bigupdate — vẽ bổ sung theo quyết định 05/11/2026 (ghi 06/11/2026)

File `2orXvoHL2upkiGoMjlq8aX`, trang `606:2` "Bigupdate (11/2026)". Chỉ thêm/sửa trên trang này, không xoá khung của chủ. Khung mới nằm ở cột x=0, từ y=14500 trở xuống (dưới các section cũ), có dòng "Bổ sung 06/11/2026" trong Mục lục `639:285`.
Khung mới nhân bản từ khung đang có (thanh bên + thanh tài khoản đã dựng từ Bản final 578:2), màu/chữ gắn biến và kiểu chữ của file, nút cao 44px. Tên người, mã, số ca là chỗ giữ chỗ; ô tiền để trống.

## Đã đúng (không sửa)

| Việc | Khung có sẵn | Ghi chú |
|---|---|---|
| 3b màn "chờ gia sư duyệt" + Mã riêng | `670:1027` (1600), `670:1329` (390) | đúng ý; thiếu dòng học phí 0đ nên vẽ bản bổ sung BS-04 |
| 3b thẻ Miễn phí + nút Vào lớp miễn phí | `670:1110`, lựa chọn "Vào ngay" ở `665:890` | đúng |
| 3d hàng chờ duyệt hàng loạt | `665:992` (1600), `670:1225` (390) | đúng chức năng; khung ở 1600 không phải 1440, và chưa có cột Mã riêng nên vẽ BS-06 |

## Đã sửa

| Việc | Node | Sửa gì |
|---|---|---|
| BU-05/BU-07 bỏ "Chủ đề màu", "Nhập mã lớp" khỏi cột trái | `608:71`, `608:352`, `608:538` | xoá hai dòng trong nhóm Tài khoản (còn Hồ sơ, Học phí). Khung mobile không có hai dòng này |
| BU-02 khung cũ bị thay | `607:218`, `607:491` | đổi tên thành "⛔ CŨ — thay bởi «Giáo trình Toán 9 — chỉ Phần 1 (BU-02 v2)»" |
| Nhập Word cũ bị thay | `671:1251` | đổi tên "⛔ CŨ — thay bởi «Nhập câu hỏi từ Word… (BU-03 v2)»" |
| Mục lục | `639:285` | thêm 6 mục BS-02…BS-06, mỗi dòng liên kết tới đúng khung |

## Đã vẽ mới

| Mã | Nội dung | Desktop (1440) | Mobile (390) |
|---|---|---|---|
| BS-02 (section `679:1386`) | Giáo trình v2: chỉ "Phần 1" rồi bài học, không Chương/Section, trạng thái Nháp / Đã đăng (nút Đăng, Gỡ về nháp) | `679:1466` (1440×1110) | `679:1677` (390×960) |
| BS-03 (section `680:1455`) | Học phí theo ca/buổi: bảng đối chiếu, gia sư tự đặt đơn giá mỗi ca, nhiều ca một ngày (có ngày 3 ca, nút "+ Thêm ca") | `680:1456` (1440×1180) | `680:1892` (390×1260) |
| BS-04 (section `682:1524`) | Vào lớp miễn phí: học phí 0đ, mỗi tài khoản 1 mã cá nhân cho 1 lớp, màn chờ gia sư duyệt | gửi mã `682:1525`; chờ duyệt `682:1703` (1440×960) | gửi mã `682:1883` (390×1000); chờ duyệt `682:1961` (390×900) |
| BS-05 (section `683:1592`) | Nhập đề Word: nhãn "Công thức đọc từ MathType — kiểm lại", "Đáp án đọc từ lời giải — kiểm lại", cột ảnh gốc ↔ công thức KiN đoán, nút "Dùng công thức KiN đọc", ca không đọc được | `683:1593` (1440×1620) | `683:1904` (390×1740) |
| BS-06 (section `684:1661`) | Hàng chờ duyệt vào lớp: chọn tất cả, Duyệt / Từ chối đã chọn, lời nhắn chung, cột Mã riêng | `684:1662` (1440×800) | `684:1957` (390×1000) |

Liên kết: `https://www.figma.com/design/2orXvoHL2upkiGoMjlq8aX/KiN-Design-System?node-id=<mã với dấu - thay :>` (ví dụ `679-1466`).

## Chưa làm / cần người quyết

- Cột trái học sinh ở các khung BU-01 cũ (`670:1027`, `670:1329`…) và khung phòng thi vẫn còn "Chủ đề màu", "Nhập mã lớp": việc chỉ yêu cầu BU-05/BU-07, nên không đụng. Khung mới BS-04 đã bỏ hai dòng.
- Khung 1280 của BU-02: đặc tả ghi "1280 + 390" nhưng nhiệm vụ này chốt 1440 + 390 cho mọi khung mới; BU-02 v2 vẽ ở 1440.
- Đơn vị "ca" trong BS-03 giả định một ca có một đơn giá, tổng tháng = cộng đơn giá các ca. Nếu chủ muốn đơn giá theo giờ hoặc theo học sinh thì cần vẽ lại cột.
- Thanh bên trong khung mới là bản nhân từ khung đã có (cùng nguồn Bản final 578:2), không vẽ lại. Khung desktop Word (BS-05) giữ thanh bên của khung 671:1251 nên mục "Hộp việc" đang sáng, chưa có mục Đề thi.
- Ảnh công thức trong BS-05 là chữ minh hoạ, không phải ảnh thật; chưa kiểm bản chạy.
