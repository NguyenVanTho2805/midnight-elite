# Backlog KiN — bản đã chỉnh, 24/09/2026

Nguồn: sheet *Todo list - Kin class*, 164 dòng. Bản này tách phần quyết định
ra khỏi phần việc, thêm cột phụ thuộc, và sửa ba mức ưu tiên xếp sai.

## File trong thư mục này

| File | Là gì |
|---|---|
| `viec.csv` | 151 việc thật, thêm cột **Chặn bởi** và **Sẵn sàng làm ngay** |
| `quyet-dinh.csv` | 13 quyết định, mỗi cái có đề xuất + lý do + **cột trống để anh Thanh điền** |
| `KiN-backlog.xlsx` | Cùng nội dung, 3 sheet, nhập thẳng vào Google Sheets được |

## Tình hình bằng số

| | Số việc |
|---|---|
| Tổng việc (đã tách 13 quyết định ra) | **151** |
| Đã xong | 7 |
| **Sẵn sàng làm ngay** | **92** |
| **Đang bị chặn bởi quyết định** | **52** |

Theo mức ưu tiên: P0 **48**, P1 **98**, P2 **5**.
*(Sheet gốc hiện 61 việc P0 vì đếm cả 13 quyết định — chúng không phải việc.)*

## Điều quan trọng nhất trong tài liệu này

**Chốt ba quyết định D01, D02, D08 là mở khoá 43 trên 52 việc đang bị chặn.**

| Quyết định | Số việc đang chặn |
|---|---|
| D01 — gói theo lớp | 26 |
| D02 — một gia sư một lớp? | 24 |
| D08 — đánh giá theo lớp hay theo gia sư? | 13 |
| Chín quyết định còn lại | 1–2 mỗi cái |

Chín việc còn chặn sau đó nằm rải ở D03–D13, mỗi quyết định chỉ gác một hai việc.

## Đọc trước — hai chỗ tài liệu đang tự mâu thuẫn

### 1. Ai trả Coin? Sheet và định hướng nói ngược nhau

Tài liệu định hướng 23/09 chốt: *"Thu phí ở đầu gia sư qua Coin nạp trước,
**KiN không giữ học phí giữa gia sư và phụ huynh**."*

Backlog thì ngược: `BE-059` là **học viên** `spendCoins` mua gói lớp, `BE-060`
là học viên xem gói đã mua. Tức là học viên nạp tiền vào KiN, KiN giữ, rồi
trả cho gia sư — đúng vị trí trung gian thanh toán mà định hướng nói phải
tránh, và đúng câu đang treo chờ luật sư.

**Phải chốt trước D01, D05, D10** — cả ba đều giả định học viên trả Coin.
Nếu mô hình đúng là gia sư trả phí nền tảng còn học phí đi thẳng qua VietQR,
thì toàn bộ mục 1.4.5 (8 việc) phải viết lại chứ không phải điều chỉnh.

### 2. Báo cáo doanh thu sẽ tụt về gần 0 vào ngày chuyển đổi

`BE-039` đặt `sourceType = null` cho mọi giao dịch cũ, cố ý không suy đoán
ngược. `BE-074` cho báo cáo mới chỉ đọc `where sourceType = "class_subscription"`.
Ghép lại: toàn bộ doanh thu lịch sử biến mất khỏi báo cáo.

`BE-077` (giữ song song cách tính cũ) có đỡ được, nhưng nó là **P1** trong khi
`BE-039` là **P0** — làm đúng thứ tự ưu tiên thì vỡ trước khi có cái đỡ.

## Ba mức ưu tiên đã sửa trong `viec.csv`

Cột **Ưu tiên gốc** giữ lại giá trị cũ để đối chiếu.

| Mã | Gốc | Mới | Lý do |
|---|---|---|---|
| `BE-077` | P1 | **P0** | Giữ song song cách tính doanh thu cũ. Không làm cùng BE-039 thì báo cáo tụt về 0. |
| `BE-078` | P1 | **P0** | Tách `courseId` khỏi `admin/students POST`. Đây là **lỗ bảo mật**, không phải dọn dẹp — xem D13. |
| `BE-081` | P1 | **P0** | Cắt quyền ghi thẳng DB của service Python. Vá 4 route ở 1.1 mà để cửa sau này mở thì gần như vô nghĩa — xem D12. |

## Thay đổi khác so với sheet gốc

- Bỏ cột `Cấp con (thụt lề)` — trống ở cả 164 dòng.
- Điền xuôi `Phần`, `Nhóm lớn`, `Nhóm nhỏ` cho mọi dòng, để lọc và sắp xếp được.
- Bỏ tiền tố `[merged]` trong cột `Phần`.
- `Trạng thái` đổi từ `TRUE`/`FALSE` sang **Xong / Chưa làm / Bị chặn**.
- Thêm cột **Chặn bởi** — mã quyết định, đọc tự động từ chính văn bản trong
  sheet (`[CHỜ D01/D02]`, `cần D02`…) rồi bổ sung tay những chỗ phụ thuộc
  không ghi thành chữ.
- Thêm **Sẵn sàng làm ngay** (Có / Không / —). Lọc `Có` là ra đúng 92 việc
  làm được ngay hôm nay mà không phải đợi ai.
- Thêm cột trống **Người làm**, **Ước lượng**, **Ghi chú**.
- `D09` đã chốt từ trước nhưng trạng thái vẫn để "Chờ quyết định" — đã sửa,
  và nó không còn được tính là đang chặn ai.

## Cách dùng

**Anh Thanh:** mở `quyet-dinh.csv`, điền cột **QUYẾT ĐỊNH CỦA ANH** và
**Ngày chốt**. Ưu tiên D01, D02, D08 — ba cái đó mở khoá 43 việc.

**Anh IT:** lọc `Sẵn sàng làm ngay = Có`, sắp theo `Ưu tiên`. Đó là 92 việc
không phải đợi ai. Nhóm 1.1 (vá bảo mật) và 1.2 (dọn code chết) độc lập
hoàn toàn với mọi quyết định — bắt đầu ở đó.
