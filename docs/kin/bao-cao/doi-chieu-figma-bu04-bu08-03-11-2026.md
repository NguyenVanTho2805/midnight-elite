# Đối chiếu khung Figma với bản chạy thật — BU-04 và BU-08 (03/11/2026)

Làm theo Việc 4 của prompt tiếp nối. Hai bên đem so:
- **Figma** (file `2orXvoHL2upkiGoMjlq8aX`, trang `606:2`): `609:285` (BU-04 phòng thi, 1600×1000), `608:1083` (BU-08 Hôm nay, 1600×1000), `608:1515` (BU-08 Hàng chờ, 1600×1080). Đọc bằng ảnh chụp khung.
- **Bản chạy**: ảnh chụp do chính các bài `ui-exam-room`, `ui-admin-hom-nay`, `ui-admin-hang-cho` sinh ra trên bản gộp thử của #92…#110 (Chromium, 1280 rộng — hẹp hơn khung 1600 nên chỉ so **cấu trúc và nội dung**, không so từng điểm ảnh).

Chưa đối chiếu: các khung điện thoại (`609:428` và khung 390 của BU-08) và các trạng thái khác của phòng thi (cổng, luyện tập, kết quả). Không sửa Figma, không sửa mã — chênh lệch dưới đây để Thọ chọn.

Quy tắc ghi trong đặc tả BU-08 (dòng 4): *"chỗ nào khung khác đặc tả này thì khung thắng"*. BU-04.md không có câu tương tự; đặc tả BU-04 mục "Bố cục" mô tả thanh Navy và "Nộp bài" nút viền ở khối riêng.

## BU-04 — Phòng thi (`609:285` so `exam-room-taking-1280`)

| # | Figma | Bản chạy (và đặc tả BU-04) | Mức |
|---|---|---|---|
| 1 | Thanh trên **nền trắng**: tên đề + nhãn chế độ "KIỂM TRA", giữa "Câu 3 / 40 · đã trả lời 2 · đánh dấu 1", phải chip "Đã lưu hh:mm:ss", ô đồng hồ, nút **Nộp bài (Navy, đặc)** | Thanh trên **nền Navy** toàn chiều rộng: trái tên đề (trong ảnh là bài mẫu tên "Phòng thi thử") và "Câu 2 / 2", giữa đồng hồ lớn "còn lại", phải chip "Đã lưu hh:mm:ss". **Không có Nộp bài ở thanh trên** | **Lớn** — màu thanh và chỗ đặt Nộp bài khác hẳn; đặc tả BU-04 (mục 5, dòng 225–229) cố ý viết thanh Navy + Nộp bài nút viền ở khối riêng, nên khung và đặc tả mâu thuẫn nhau |
| 2 | Ghi chú trong khung: "Nộp bài ở **góc trên phải**, tách khỏi Câu trước / Câu sau để không bấm nhầm" | Nộp bài nằm trong cột phải (nút viền) và ở cuối trang; chân trang cố định chỉ có Câu trước / Câu sau — vẫn tách khỏi hai nút kia nên mục đích "không bấm nhầm" đạt, vị trí khác | Vừa |
| 3 | Nhãn chế độ "KIỂM TRA" (chip) cạnh tên đề trên thanh trên | Thanh trên chỉ có tên đề (chữ hoa nhỏ; trong ảnh là tên đề của bài mẫu) và số câu; chỉ chế độ luyện tập mới có chữ "Luyện tập" ở bên phải (`TakingRoom.tsx`). Đề kiểm tra không có chip chế độ trên thanh trên | Nhỏ |
| 4 | Một câu mỗi lần (Từng câu), đáp án dạng hàng có **vòng chữ A–D**, đáp án chọn viền Navy nền nhạt | Mặc định **Cả đề** ở 1280 (đặc tả); chữ A–D là chữ đơn cách (không vòng), đáp án chọn có dấu ✓ bên phải | Nhỏ — khác kiểu vẽ, cùng nghĩa |
| 5 | Bảng số câu: thẻ có nền, đề "Số câu · 40", lưới 8 cột, 3 dòng chú thích | "Bảng số câu" không có nền thẻ, 4 dòng chú thích (viền liền/đứt, cờ, đang xem), lưới theo số câu của đề | Nhỏ |
| 6 | Ô lưu "Đã lưu" màu xanh lá | Chip trắng viền, dấu ✓ nhỏ | Nhỏ |

**Đề xuất:** quyết một lần giữa (A) cập nhật Figma theo đặc tả + mã (thanh Navy, Nộp bài viền ở khối riêng) hoặc (B) sửa mã theo Figma (thanh trắng, Nộp bài Navy ở góc trên phải). (A) rẻ nhất và giữ nguyên các bài đã xanh; (B) cần sửa `RoomLayout`, `SubmitPanel`, `RoomClock` và ba bài giao diện (`ui-exam-room`, `ui-quiz-hs`, `ui-quiz-timeup`). 

## BU-08 — Hôm nay (`608:1083` so `admin-hom-nay-1280`)

| # | Figma | Bản chạy | Mức |
|---|---|---|---|
| 1 | "Hôm nay" nằm trong module **Việc chờ** (cùng "Hàng chờ"); module Vận hành gồm Doanh thu · Số đo · Nhật ký · Cron & triển khai · Gói Pro · Hỗ trợ | "Hôm nay" nằm trong module **Vận hành** (dải tab Hôm nay · Doanh thu · Phễu gia sư · Số đo sản phẩm); module Việc chờ chỉ có "Hàng chờ". Có thêm "Phễu gia sư"; tên mục "Triển khai và hạn mức" thay "Cron & triển khai" | **Lớn** — khác cấu trúc điều hướng (đặc tả BU-08 mục 4 viết như bản chạy; khung viết khác) |
| 2 | Mỗi việc: ô số + tên + dòng phụ + chip đỏ "**QUÁ 3 NGÀY**" + nút **Xử lý** | Mỗi việc: tên + dòng phụ + số ở bên phải; **không** có chip quá hạn, **không** có nút Xử lý (bấm cả dòng) | Vừa |
| 3 | Bốn ô số dạng **thẻ nền xám**: gia sư đang dạy · học sinh có lớp · lớp đang mở · buổi học tuần này | Hàng "Vài con số" không có thẻ: Học sinh · Lớp đang mở · Gia sư đã duyệt · **Doanh thu 30 ngày** (nhãn khác; Doanh thu là tiền — Figma không có số tiền trên trang này) | Vừa |
| 4 | Khối "**Nhật ký gần đây**" (3 dòng: giờ · ai · việc) | **Không có** | Vừa — thiếu cả một khối |
| 5 | Thanh bên **rộng** (238px, có nhóm VIỆC CHỜ / CON NGƯỜI / HỌC VỤ / VẬN HÀNH, chữ cạnh biểu tượng) | Mặc định thanh **hẹp** (≈80px, biểu tượng + chữ dưới); cuối thanh có một nút (chưa bấm thử) và ảnh chụp ở chế độ mặc định | Chưa rõ — chưa kiểm bản thanh rộng bằng tay |

## BU-08 — Hàng chờ (`608:1515` so `admin-hang-cho-1280`)

| # | Figma | Bản chạy | Mức |
|---|---|---|---|
| 1 | Chip lọc: Tất cả · Gia sư · **Vào lớp** · Báo cáo · Coin + ô **tìm theo tên, lớp…** ở bên phải | 8 chip: Tất cả · Hồ sơ gia sư · Bài viết · Hồ sơ bị báo cáo · Câu trả lời · Đánh giá khoá · Nạp Coin · Câu hỏi của khách (hàng chip cuộn ngang); **không** có chip "Vào lớp"; **không có ô tìm** (`HangCho.tsx` không có ô nhập tìm kiếm) | **Lớn** — khung cho quản trị duyệt cả "yêu cầu vào lớp" (BU-01); đặc tả BU-08 (dòng 136–137) chỉ đưa yêu cầu vào lớp chờ quá 3 ngày vào **Hôm nay**, không đưa vào Hàng chờ hay huy hiệu, và BU-01 để **gia sư** duyệt |
| 2 | Cột: Người / nội dung · Loại · Chờ từ · Hành động (**Duyệt** và **Từ chối** ngay trên dòng) | Cột: Việc · Từ ai · ở đâu · Chờ · Trạng thái · Hành động (**Xem** + Duyệt; Từ chối nằm trong panel bên sau khi bấm Xem) | Vừa |
| 3 | Thanh ngữ cảnh khi chọn dòng: "Đã chọn 2 · Duyệt · Từ chối · Bỏ chọn" + "Hoàn tác trong 10 giây sau khi duyệt hàng loạt" | Có chọn tất cả + thanh ngữ cảnh; chưa kiểm tay đủ ba nút/chữ hoàn tác | Nhỏ |
| 4 | Panel bên phải **luôn hiện** chi tiết dòng đầu: nhãn loại, tên, MÔN, GIỚI THIỆU, GỬI LÚC, TRÙNG SỐ ĐIỆN THOẠI, ô ghi chú ≤200 ký tự, nút Duyệt hồ sơ / Từ chối | Panel bên mở **khi bấm Xem**, không hiện sẵn | Nhỏ |

**Đề xuất:** (1) với "Vào lớp" trong Hàng chờ quản trị: đây là quyết định sản phẩm (ai duyệt yêu cầu vào lớp — gia sư hay quản trị?), nên Thọ chốt rồi sửa khung hoặc mã; **không** tự đổi vì chạm luồng BU-01. (2) Chuyển "Hôm nay" vào module Việc chờ nếu muốn đúng khung — đổi `adminNav.ts` và hai bài (`t-admin-nav-lib`, `ui-admin-shell-4module`). (3) Các điểm "Nhỏ" có thể gom thành một việc làm riêng sau khi gộp.
