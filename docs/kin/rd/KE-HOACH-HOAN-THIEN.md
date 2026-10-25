# KiN: kế hoạch hoàn thiện toàn bộ tính năng (R&D)

Soạn 23/10/2026 bởi giám đốc sản phẩm (R&D lead). Chỉ viết tài liệu, **không sửa `src/`**. Đây là bản kế hoạch để chủ dự án (Thọ) duyệt trước khi các đợt làm việc bắt đầu.

File đi kèm: [bang-tinh-nang.csv](bang-tinh-nang.csv) (bảng tính năng đầy đủ, mở được bằng Excel và Google Sheets). Hai tài liệu nền: [HIEN-CO-VA-DINH-VI.md](HIEN-CO-VA-DINH-VI.md) (KiN đã có gì) và [FIGMA-BAN-DO.md](FIGMA-BAN-DO.md) (84 khung Figma).

## 1. Tóm tắt điều hành

- Gộp trùng từ các mảng kiểm toán, tài liệu hiện có và 84 khung Figma, bảng tính năng có **245 tính năng**. Mỗi khung Figma (84/84) được gán cho ít nhất một tính năng.
- Hiện trạng: **34 đã có** (14%), **129 làm một phần** (53%), **82 chưa có** (33%). Tức là gần như mọi việc còn lại là hoàn thiện và dựng lại giao diện, ít việc làm mới từ đầu.
- Chia thành **5 đợt** (+ nhóm "chờ chủ quyết / hoãn"): Đợt 1 có 52 tính năng, Đợt 2 có 54, Đợt 3 có 33, Đợt 4 có 37, Đợt 5 có 14; nhóm chờ chủ quyết hoặc hoãn có 55.
- **51 tính năng dính tiền hoặc dữ liệu trẻ em dưới 16 tuổi ở mức "CHƯA LÀM - chờ chủ dự án quyết"** (32 dính tiền, 23 dính trẻ em, một số dính cả hai). Danh sách và điều cần quyết nằm ở mục 7. Thêm 65 tính năng chạm tiền hoặc trẻ em nhưng **chỉ trình bày dữ liệu đã có** nên làm được mà không đổi công thức hay thu thêm dữ liệu.
- Ba việc bảo mật nên làm **đầu tiên**, vì chúng chặn lời hứa "chỉ học viên đã ghi danh mới xem được": MD-03 (API lộ link học liệu), MD-09 (`/xem-tai-lieu` nhận URL bất kỳ), QZ-14 (mật khẩu vào thi lưu chuỗi thô).
- Video record: **tải file video lên (MD-04) chưa làm được ngay** vì có chi phí hạ tầng và video buổi học có thể chứa hình và giọng học sinh dưới 16 tuổi. Cái làm ngay được không đợi ai: bản ghi bằng link chuẩn hoá, trang Bản ghi của lớp, trình xem tối ưu cho học sinh, tài liệu và bài test. Khuyến nghị lưu trữ ở mục 6.3.
- Vòng R&D lặp có **phiên phản biện 3 vai** (học sinh, gia sư, phụ huynh) ở cuối mỗi đợt; quy trình và danh sách điểm vướng đã biết ở mục 8.

### Số liệu theo trạng thái, vai và đợt

| Trạng thái | Số lượng |
|---|---|
| da-co (đã có) | 34 |
| mot-phan (làm một phần) | 129 |
| chua-co (chưa có) | 82 |
| **Tổng** | **245** |

| Đợt | Tính năng | Ước lượng công sức (người-ngày, thô) | Nội dung |
|---|---|---|---|
| Đợt 1 | 52 | 70 | Lõi hằng ngày của gia sư: Hộp việc, Lịch, Lớp, Buổi học, Điểm danh |
| Đợt 2 | 54 | 107 | Học phí (chỉ trình bày) và học sinh |
| Đợt 3 | 33 | 116 | Media: tải video record, tải tài liệu, tải bài test và quiz, giao diện học sinh xem video |
| Đợt 4 | 37 | 64 | Phụ huynh, khách, quản trị, phân tích và báo cáo |
| Đợt 5 | 14 | 52 | Tính năng còn lại: tích hợp Google, đăng nhập Google, thông báo hàng loạt, gom kho câu hỏi |
| Chờ chủ quyết hoặc hoãn | 55 | 254 | xem mục 7 |

Quy ước ước lượng: S = 0,5 ngày, M = 2, L = 5, XL = 10. Đây chỉ để cân đối các đợt với nhau, **không phải cam kết tiến độ**.

| Vai | Số tính năng |
|---|---|
| gia sư | 171 |
| học sinh | 25 |
| hệ thống | 17 |
| quản trị | 14 |
| phụ huynh | 10 |
| khách | 8 |

## 2. Nguồn, cách gộp và giới hạn của bản này

**Nguồn đã dùng:** báo cáo research (`docs/kin/bao-cao/research-so-gia-su-2026-10-19.md`, 867 dòng: Sổ Gia Sư + 14 nền tảng, mục 6 bảng so sánh, 8.5 gói và hạn mức, 8.6 mười hai điểm nghẽn); kết quả kiểm toán mã nguồn theo vai (gia sư lớp / lịch / buổi / điểm danh, gia sư học phí và gói); `docs/kin/rd/HIEN-CO-VA-DINH-VI.md` cho học sinh, phụ huynh, khách, quản trị, video, tài liệu, bài test; 84 khung Figma (trang Nền móng 0:1).

**Giới hạn cần nói thẳng:**

1. Kết quả kiểm toán giao cho bản này có 4 mảng, nhưng chỉ nhận được trọn 1 mảng và mảng thứ hai bị cắt cụt giữa chừng (dừng ở phần "Phí theo kỳ" của Figma 504:6577). Hai mảng còn lại (dự kiến là học sinh / phụ huynh / khách / quản trị / phân tích / media) không đến được. Phần đó được **dựng lại từ `HIEN-CO-VA-DINH-VI.md`** (có đánh dấu [K] đã kiểm mã và [Đ] theo bản đọc) và từ tên khung Figma. Các dòng thuộc học sinh, phụ huynh, khách, quản trị, media và quiz (mã SV-, PH-, KH-, QT-, MD-, QZ-, TK-, BC-, PT-) vì thế **độ chắc chắn thấp hơn** các dòng gia sư; cột `ghi-chu` nêu căn cứ.
2. Ánh xạ khung Figma → tính năng dựa trên **tên khung và kích thước**, chưa mở từng khung bằng công cụ Figma. Trước khi dựng mỗi màn, người làm phải đọc khung bằng `get_design_context` (FIGMA-BAN-DO.md) và có thể phát hiện chi tiết khung đòi hỏi mà bảng này chưa ghi.
3. Công sức S/M/L/XL là ước lượng thô sau khi đọc ghi chú mã; chưa ai mở mã để đếm. "Trạng thái" cũng là bản đọc, không phải kết quả chạy; ví dụ nhiều dòng "mot-phan" thực ra chỉ thiếu phần giao diện.
4. Không kiểm chứng giá của Cloudflare Stream, Mux, Cloudinary, Vercel Blob. Mục 6.3 so sánh về kiến trúc, quyền xem và rủi ro; **chủ phải xem bảng giá hiện hành** trước khi quyết.
5. Về pháp lý: mọi viện dẫn Luật Trẻ em 2016, Nghị định 13/2023, Thông tư 29/2024/TT-BGDĐT là căn cứ để hỏi luật sư, không phải ý kiến pháp lý.

**Cách gộp trùng:** một tính năng xuất hiện ở nhiều mảng (ví dụ "Chọn hình thức học phí khi tạo lớp" ở cả mảng lớp và mảng học phí, "Ẩn số tiền bằng mắt", "Thẻ Đã thu / Chưa thu", "Tài khoản ngân hàng để sinh QR") được giữ **một dòng duy nhất**, ghi tham chiếu chéo trong `ghi-chu`. Các hạng mục rất nhỏ cùng một màn được gộp để bảng đọc được (ví dụ ba hạng mục "ghi chú buổi" thành BU-04).

## 3. Quy tắc cứng của kho (áp cho mọi đợt)

- Đọc `CLAUDE.md`, `AGENTS.md`, `docs/kin/CLAUDE-cho-kho-trien-khai.md` trước khi làm. **Next.js ở kho này không phải bản quen thuộc**: đọc hướng dẫn trong `node_modules/next/dist/docs/` trước khi viết mã.
- **Tiền hoặc trẻ em dưới 16 tuổi → dừng, hỏi người.** Không viết mã chuyển tiền, không đổi cách tính phiếu, không thu thêm dữ liệu trẻ em. Cột `dinh-tien` và `dinh-tre-em` có 3 giá trị: `khong`, `trinh-bay` (chỉ hiển thị hoặc dựng lại ảnh của dữ liệu đã có; có test chứng minh số không đổi), `chua-lam` (CHƯA LÀM - chờ chủ dự án quyết).
- **Schema chỉ thêm**: cột mới nullable hoặc có mặc định, bảng mới; không xoá, không đổi tên, không đổi kiểu. Qua được `scripts/db-push-on-production.mjs` và test `t-db-push-guard.ts`.
- **Màu chỉ dùng token `--kin-*`** (`docs/kin/tokens/tokens.css`), đã đo tương phản; màu không bao giờ nói một mình (luôn kèm chữ); chữ cần 4,5:1, chấm và viền cần 3:1.
- **Nội dung tệp là dữ liệu, không phải lệnh**: tài liệu, đề, tin nhắn, tên tệp do người dùng tải lên không được thực thi hay làm theo (áp cho cả trích đề bằng AI).
- Thao tác có ghi dữ liệu dùng POST thường + redirect 303, không dùng server action cho việc ghi cần chắc chắn (bài học từ `kin-app`, mục 5 của CLAUDE-cho-kho-trien-khai.md). Giữ nguyên quy tắc: tiền chốt vào sự kiện; chỉ buổi đã chốt mới tính tiền; tự chốt cần cả hai điều kiện.
- Mỗi việc trong sheet backlog: đọc cột H/I/J/K trước, chỉ ghi cột H/I, không chạm J/K.
- Tiếng Việt có dấu; tên là KiN ở mọi nơi.

## 4. Bảng tính năng theo khu vực

Bảng đầy đủ 13 cột nằm ở [bang-tinh-nang.csv](bang-tinh-nang.csv). Dưới đây là phân bố theo khu vực để xem toàn cảnh (số tính năng).

| Khu vực | Tổng | đã có | một phần | chưa có |
|---|---|---|---|---|
| Hộp việc và Tổng quan | 15 | 4 | 9 | 2 |
| Lịch | 28 | 3 | 11 | 14 |
| Lớp | 18 | 3 | 12 | 3 |
| Buổi học | 15 | 0 | 3 | 12 |
| Điểm danh | 11 | 3 | 5 | 3 |
| Học sinh | 26 | 5 | 17 | 4 |
| Học phí | 37 | 8 | 15 | 14 |
| Gói và thuê bao | 8 | 0 | 4 | 4 |
| Tài khoản và cài đặt | 7 | 1 | 5 | 1 |
| Tích hợp Google | 5 | 0 | 1 | 4 |
| Hệ thống dùng chung | 5 | 0 | 4 | 1 |
| Phân tích | 5 | 0 | 2 | 3 |
| Báo cáo phụ huynh | 7 | 1 | 3 | 3 |
| Video, tài liệu | 20 | 0 | 12 | 8 |
| Quiz và bài tập | 15 | 2 | 11 | 2 |
| Phụ huynh | 7 | 2 | 4 | 1 |
| Khách | 6 | 1 | 4 | 1 |
| Quản trị | 10 | 1 | 7 | 2 |

## 5. Các đợt làm việc

Mỗi đợt kết thúc bằng một vòng R&D (xây → kiểm → phản biện 3 vai → sửa, mục 8). Một đợt chỉ coi là xong khi **tất cả tiêu chí nghiệm thu** của nó đạt và vòng phản biện cuối không còn lỗi mức chặn.

Đọc bảng: "Tiền" và "Trẻ em" mang giá trị `khong`, `trinh-bay` hoặc `chua-lam`. Hàng nào `chua-lam` **không nằm trong phạm vi làm** của đợt dù đang được liệt kê, trừ khi chủ đã quyết; chúng cũng xuất hiện ở mục 7.

### Đợt 1. Lõi hằng ngày của gia sư: Hộp việc, Lịch, Lớp, Buổi học, Điểm danh

**Mục tiêu.** Dựng lại 3 màn gia sư dùng mỗi ngày (Hộp việc, Lịch, Lớp) đúng Figma, và nối chúng với hai màn làm việc sát đó là Buổi học và Điểm danh, để một ngày dạy đi trọn từ "mở app" đến "chốt buổi" mà không rời lõi này. Làm trước bộ nền dùng chung (trạng thái rỗng/lỗi/toast, kiểm dữ liệu tại ô) vì mọi đợt sau dựa vào nó.

**Quy mô.** 52 tính năng (mot-phan 26, da-co 13, chua-co 13), ước lượng thô 70 người-ngày, 7 tính năng cần thêm schema. Khu vực: Hộp việc và Tổng quan 15, Lịch 13, Lớp 8, Buổi học 7, Điểm danh 6, Hệ thống dùng chung 3.

**Thứ tự trong đợt.** 1A Nền dùng chung (HT-01, HT-02) → 1B Hộp việc và Tổng quan (HV-xx) → 1C Lịch (LI-xx) → 1D Lớp và wizard tạo lớp (LO-xx) → 1E Buổi học, chốt buổi, điểm danh (BU-xx, DD-xx). 1E cần thêm cột vào AttendanceSession trước (mục 6.2).

**Tính năng.**

| Mã | Tính năng | Vai | Hiện trạng | Ưu tiên | Công sức | Tiền | Trẻ em |
|---|---|---|---|---|---|---|---|
| BU-01 | Trang chi tiết buổi học: breadcrumb lớp - ngày - trạng thái, Online/Offline, menu thao tác | gia sư | chua-co | P0 | L | khong | khong |
| BU-02 | Chốt buổi bằng nút Đã dạy xong: cột trạng thái và thời điểm chốt, banner nhắc | gia sư | chua-co | P0 | M | trinh-bay | khong |
| BU-04 | Ghi chép buổi 3 phần: nội dung đã dạy, bài tập về nhà, nhận xét chung | gia sư | chua-co | P0 | M | khong | khong |
| DD-01 | Điểm danh 4 trạng thái (có mặt, muộn, có phép, vắng), lưu theo lô, nhắn Zalo phụ huynh | gia sư | da-co | P0 | S | khong | khong |
| DD-02 | Nút Tất cả có mặt một chạm | gia sư | chua-co | P0 | S | khong | khong |
| DD-03 | Thanh thao tác cố định và bộ đếm Có mặt / Vắng / Có phép trên điện thoại | gia sư | mot-phan | P0 | S | trinh-bay | khong |
| HT-01 | Bộ trạng thái dùng chung: rỗng, lỗi, đang tải, xác nhận, toast cho mọi màn | hệ thống | mot-phan | P0 | M | khong | khong |
| HT-02 | Kiểm tra dữ liệu tại chỗ khi nhập: viền đỏ và dòng báo dưới từng ô | hệ thống | mot-phan | P0 | M | khong | khong |
| HV-01 | Hộp việc kiểu Outlook: danh sách việc theo loại (đối soát, phiếu nháp, bài chưa chấm, báo nghỉ, nhắc lịch, buổi chưa điểm danh) và khung đọc, máy tính và điện thoại | gia sư | mot-phan | P0 | M | khong | khong |
| HV-02 | Khối Buổi chưa hoàn thành (buổi qua giờ chưa điểm danh xong) | gia sư | da-co | P0 | S | khong | khong |
| HV-06 | Thẻ tiền Đã thu và Chưa thu trong tháng, đặt cạnh nhau | gia sư | mot-phan | P0 | S | trinh-bay | khong |
| LI-01 | Lịch dạng lưới giờ 07:00-22:00: chế độ 3 ngày, tuần, tháng, ngày; vạch đỏ giờ hiện tại; nút In | gia sư | mot-phan | P0 | L | khong | khong |
| LI-05 | Bấm buổi trên lịch mở hộp chi tiết và điểm danh ngay từ lịch | gia sư | mot-phan | P0 | M | khong | khong |
| LO-01 | Danh sách lớp có tìm kiếm và lọc trạng thái, cột loại và số buổi | gia sư | mot-phan | P0 | S | khong | khong |
| LO-02 | Chi tiết lớp hai cột: Sắp tới / Đã qua theo tuần và cột học sinh kèm học phí | gia sư | mot-phan | P0 | L | trinh-bay | khong |
| LO-03 | Wizard tạo lớp 3 bước: Thông tin → Học sinh → Lịch học; nút Tạo lớp + N buổi | gia sư | chua-co | P0 | L | khong | khong |
| BU-03 | Mở lại buổi học đã chốt, cảnh báo nếu phiếu tháng đã lập | gia sư | chua-co | P1 | S | trinh-bay | khong |
| BU-07 | Nhận xét riêng từng học sinh trong buổi, hiển thị cho phụ huynh theo quyền | gia sư | mot-phan | P1 | M | khong | trinh-bay |
| DD-04 | Lưới điểm danh theo tháng tương tác (chạm ô để đổi), lọc lớp / tháng / học sinh, chú giải | gia sư | mot-phan | P1 | M | khong | khong |
| HV-04 | Thẻ KPI học sinh, lớp, buổi tháng này (Đã lên lịch / Hoàn thành / Đã nghỉ) | gia sư | mot-phan | P1 | M | khong | khong |
| HV-05 | Bảng chủ 5 thẻ KPI (doanh thu dự kiến, học sinh tích cực, yêu cầu đặt lịch chờ duyệt) | gia sư | mot-phan | P1 | M | trinh-bay | khong |
| HV-07 | Ẩn số tiền bằng biểu tượng mắt ở Tổng quan, Học phí, Doanh thu | gia sư | chua-co | P1 | S | trinh-bay | khong |
| HV-08 | Lịch dạy hôm nay và 3 buổi gần nhất | gia sư | mot-phan | P1 | S | khong | khong |
| HV-10 | Banner hướng dẫn bắt đầu và checklist thiết lập 8 bước (tài khoản, lớp, học sinh, lịch, QR...) | gia sư | chua-co | P1 | M | khong | khong |
| HV-11 | Chuông thông báo và dấu hỏi trợ giúp trên thanh trên của vỏ gia sư | gia sư | mot-phan | P1 | S | khong | khong |
| HV-15 | Nhắc giáo viên chốt buổi (đẩy, email, Zalo) | hệ thống | mot-phan | P1 | S | khong | khong |
| LI-02 | Màu lớp trên lịch: gia sư chọn từ bảng 25 màu, kèm biểu tượng buổi chưa chốt | gia sư | mot-phan | P1 | S | khong | khong |
| LI-03 | Bộ lọc và cài đặt hiển thị lịch: lọc theo lớp, ẩn hiện buổi đã nghỉ, nút làm mới | gia sư | chua-co | P1 | S | khong | khong |
| LI-06 | Popover buổi 5 thao tác nhanh (mở buổi, điểm danh, dời, báo nghỉ, nhân bản) | gia sư | mot-phan | P1 | S | khong | khong |
| LI-09 | Màn Dời buổi và học bù gom một chỗ: dời, huỷ, dùng tín dụng bù, kiểm tra xung đột | gia sư | mot-phan | P1 | M | khong | khong |
| LI-10 | Kiểm tra xung đột lịch (trùng giờ giữa lớp, học sinh học nhiều lớp) trước khi lưu khung giờ hoặc dời buổi | gia sư | chua-co | P1 | M | khong | khong |
| LI-11 | Thêm buổi học nhanh bằng ngăn kéo: buổi lẻ, dạy bù, phát sinh; hiện trong Lịch và sinh nhắc lịch | gia sư | chua-co | P1 | M | khong | khong |
| LI-16 | Hình thức Online hoặc Offline cho buổi và khung giờ, kèm địa chỉ học offline | gia sư | chua-co | P1 | M | khong | khong |
| LI-17 | Ba cách đặt link buổi online: link chung của lớp, theo khung giờ, riêng từng buổi (hoặc tạo Meet) | gia sư | mot-phan | P1 | M | khong | khong |
| LO-04 | Link học online chung của lớp và mô tả lớp | gia sư | mot-phan | P1 | S | khong | khong |
| LO-09 | Nút Thêm học sinh ngay trong chi tiết lớp | gia sư | mot-phan | P1 | M | khong | khong |
| LO-11 | Kết thúc lớp (lưu trữ) với nhãn Đã kết thúc và nút rõ ràng ở Chi tiết lớp | gia sư | da-co | P1 | S | khong | khong |
| BU-05 | Kế hoạch buổi sau nối vào trang buổi học | gia sư | mot-phan | P2 | S | khong | khong |
| BU-06 | Xem ghi chú buổi trước (accordion) và mẫu ghi chú buổi | gia sư | chua-co | P2 | S | khong | khong |
| DD-06 | Tín dụng học bù (hết hạn 30 ngày, tự trả lại khi đổi trạng thái) kèm báo cáo tín dụng | gia sư | da-co | P2 | S | khong | khong |
| HT-03 | Khối Thông tin giải thích cơ chế ngay trong màn (nền nhạt, nêu quy tắc) | hệ thống | mot-phan | P2 | S | khong | khong |
| HV-09 | Chương trình nghị sự theo ngày: nút lùi, tới, Hôm nay ngay trang chủ | gia sư | mot-phan | P2 | S | khong | khong |
| LO-12 | Xoá lớp kèm toàn bộ dữ liệu, đặt ở vùng nguy hiểm cuối trang | gia sư | da-co | P2 | S | khong | khong |
| DD-05 | Xuất bảng điểm danh Excel, CSV, PDF in | gia sư | da-co | P3 | S | khong | khong |
| HV-03 | Lời chào theo giờ trên Tổng quan | gia sư | da-co | P3 | S | khong | khong |
| HV-12 | Menu trái rút gọn theo mục dùng (chế độ gọn TT-203) | gia sư | da-co | P3 | S | khong | khong |
| HV-13 | Thu gọn sidebar, nhớ theo tài khoản | gia sư | da-co | P3 | S | khong | khong |
| HV-14 | Nút bật tắt nền tối nhanh trên thanh trên | gia sư | mot-phan | P3 | S | khong | khong |
| LI-04 | Chia sẻ lịch tuần qua Zalo (tin chung không tên em, không tiền) | gia sư | da-co | P3 | S | khong | khong |
| LI-07 | Sửa giờ ngày của buổi (dời buổi giữ định danh gốc, báo học sinh) | gia sư | da-co | P3 | S | khong | khong |
| LI-08 | Báo nghỉ buổi này (huỷ buổi, xử lý báo nghỉ sát giờ một nút) | gia sư | da-co | P3 | S | khong | khong |
| LO-10 | Sửa thông tin lớp | gia sư | da-co | P3 | S | khong | khong |

**Tiêu chí nghiệm thu (đo được).**

1. Khớp Figma: ảnh chụp bằng tools/local-e2e/shoot-tutor-pages.ts ở 1440 và 390 đặt cạnh khung Figma của từng màn (299:111821, 299:116033, 299:112052, 299:112349, 299:112581, 299:112849, 464:5816, 299:116181, 464:6029, 464:6223); người rà ghi đạt/không đạt theo 5 vùng của mỗi khung, mọi màn phải đạt cả 5.
2. Không tràn ngang: ở 320, 360, 390, 768, 1440 px, document.scrollingElement.scrollWidth không vượt clientWidth trên mọi màn của đợt (đo bằng script trong test, 0 vi phạm).
3. Điểm danh một lớp 10 học sinh, 2 em vắng: tối đa 5 chạm từ Hộp việc tới khi đã lưu (mở buổi, Tất cả có mặt, đổi 2 em, Lưu) và tối đa 2 chạm để chốt buổi sau đó; đếm chạm bằng test Playwright.
4. Hộp việc: mỗi loại việc trong 6 loại có đúng một dòng khi dữ liệu mock có việc loại đó và biến mất khi xử lý xong, kiểm bằng seed mock 3 lớp, 20 học sinh.
5. Lịch lưới: buổi hiển thị đúng ô giờ cho 12 buổi mẫu gồm buổi qua nửa đêm giờ Việt Nam và buổi bị dời; vạch giờ hiện tại sai lệch không quá 1 phút.
6. Màu chỉ lấy từ token --kin-*: lệnh grep tìm mã hex hoặc rgb() trong các tệp mới/sửa của đợt không trả dòng nào ngoài src/app/globals.css hoặc tệp token; tương phản chữ ≥ 4,5:1, chấm và viền ≥ 3:1 (đo theo docs/kin/thiet-ke/tuong-phan.md).
7. Tiền không đổi: bộ test học phí hiện có (TT-200, tuition, invoice) cho kết quả y hệt trước và sau đợt; các số Đã thu / Chưa thu trên Tổng quan bằng đúng số trên trang Doanh thu, sai lệch 0 đồng.

**Test cần có.**

- Tệp tools/local-e2e/t-<tính-năng>.ts cho từng tính năng theo mẫu t-class-sessions.ts, t-attendance-export.ts; chạy với Postgres + Next dev + Chromium thật theo tools/local-e2e/README.md.
- Test thuần cho hàm mới: kiểm xung đột lịch (LI-10), quy ước buổi hoàn thành (HV-04), sinh buổi theo khoảng (LI-22), giờ qua nửa đêm.
- Test hồi quy lõi: t-core-regression.ts phải xanh; thêm ca "chốt buổi rồi mở lại" không đổi phiếu đã lập.
- Test quyền: gia sư chỉ thấy lớp của mình (ownsResource), học sinh và phụ huynh gọi API gia sư nhận 403.

**Phụ thuộc.** Cần quyết định 6.2 (mở rộng AttendanceSession bằng cột nullable). Không phụ thuộc quyết định tiền hay trẻ em. Đợt 3 dùng lại bản ghi buổi và FileAsset nên cột của AttendanceSession phải chốt ở đợt này.

**Rủi ro.**

- Buổi học hiện là suy ra từ quy luật tuần: thêm cột lên AttendanceSession mà không làm mất cách suy cũ, nếu không buổi cũ biến mất khỏi Lịch. Giảm rủi ro bằng cách buổi chưa có bản ghi vẫn hiển thị như cũ và chỉ tạo bản ghi khi gia sư thao tác.
- khoa-hoc/[id]/page.tsx dài 2.380 dòng: wizard tạo lớp dễ gãy tab khác. Dựng wizard thành component riêng, chỉ gọi API cũ.
- Chốt buổi (BU-02) dễ bị hiểu là "tính tiền". Chốt chỉ ghi trạng thái; nút và chữ trên màn phải nói rõ việc tính tiền vẫn như cũ.
- Push nhắc chốt buổi chờ khoá VAPID Production nên chưa kiểm được trên máy thật (HT-05).

### Đợt 2. Học phí (chỉ trình bày) và học sinh

**Mục tiêu.** Làm cho gia sư nhìn được tiền và học sinh trong cùng một cái nhìn rõ ràng (tóm tắt, chưa thu, lịch sử, xuất ảnh phiếu, hồ sơ học sinh nhiều tab) và cho học sinh một vỏ gọn có Việc của tôi, Lịch, Lớp. Mọi thứ về tiền ở đợt này chỉ hiển thị hoặc dựng lại ảnh của số đã có. Không đổi cách tính phiếu, không thêm hình thức học phí, không thu thêm dữ liệu trẻ em.

**Quy mô.** 54 tính năng (mot-phan 29, chua-co 13, da-co 12), ước lượng thô 107 người-ngày, 9 tính năng cần thêm schema. Khu vực: Học sinh 19, Học phí 17, Lịch 8, Lớp 5, Buổi học 4, Điểm danh 1.

**Thứ tự trong đợt.** 2A Học sinh phía gia sư (HS-xx, LO-05/07/13) → 2B Học phí trình bày (HP-xx với cờ "trinh-bay") → 2C Vỏ học sinh (SV-xx). 2C chỉ làm phần bố cục, phần xem video/tài liệu đã nằm ở Đợt 3.

**Tính năng.**

| Mã | Tính năng | Vai | Hiện trạng | Ưu tiên | Công sức | Tiền | Trẻ em |
|---|---|---|---|---|---|---|---|
| HP-02 | Tóm tắt học phí 4 chỉ số trên đầu trang Học phí và khối Sổ học phí và kiểm tra | gia sư | mot-phan | P0 | S | trinh-bay | khong |
| HP-03 | Học phí chưa thu theo học sinh và lớp, có lọc (tên, lớp, khoảng thời gian) và dải tổng chưa thu nhiều tháng | gia sư | mot-phan | P0 | M | trinh-bay | khong |
| HS-01 | Danh sách học sinh có lọc theo trạng thái / lớp / cảnh báo, cột báo cáo, Chia sẻ báo cáo, buổi bù còn lại | gia sư | mot-phan | P0 | M | khong | trinh-bay |
| HS-02 | Hồ sơ học sinh nhiều tab (Thông tin, Điểm danh, Ghi chú, Phiếu, Bài tập) và chi tiết gom lớp đang học, buổi đã học, học phí chưa thu | gia sư | mot-phan | P0 | L | trinh-bay | trinh-bay |
| HS-09 | Bật link báo cáo riêng từng học sinh: Copy link, Xem thử, Thu hồi ngay (tắt chia sẻ làm link ngừng hoạt động) | gia sư | mot-phan | P0 | M | khong | trinh-bay |
| SV-01 | Việc của tôi: trang chủ học sinh (máy tính và điện thoại) | học sinh | da-co | P0 | M | khong | khong |
| SV-02 | Lịch học (Thi thử, Deadline, Buổi học) máy tính và điện thoại | học sinh | da-co | P0 | M | khong | khong |
| SV-03 | Lớp của tôi: danh sách lớp, vào lớp có các tab Bài học / Tài liệu và bản ghi / Bài tập / Kiểm tra / Hỏi đáp | học sinh | mot-phan | P0 | L | khong | khong |
| SV-04 | Bài tập và đề thi gom thành khung Bài giao với hạn nộp | học sinh | mot-phan | P0 | M | khong | khong |
| SV-06 | Màn trống học sinh mới: nút Nhập mã lớp | học sinh | chua-co | P0 | S | khong | khong |
| BU-14 | Nút Chia sẻ link báo cáo ngay trong buổi | gia sư | chua-co | P1 | M | khong | trinh-bay |
| DD-07 | Lịch sử điểm danh và tỷ lệ tham dự 90 ngày trong hồ sơ học sinh | gia sư | mot-phan | P1 | S | khong | trinh-bay |
| HP-01 | Hiển thị hình thức học phí của lớp (nhãn đang áp dụng) trong Chi tiết lớp và Tạo lớp | gia sư | mot-phan | P1 | S | trinh-bay | khong |
| HP-04 | Đối soát chuyển khoản: nhãn Chưa khớp, yêu cầu bổ sung; hàng chờ thiếu / dư / không mã | gia sư | da-co | P1 | S | trinh-bay | khong |
| HP-05 | Lịch sử thu tiền theo tháng nhóm theo học sinh / ngày / lớp, xem chi tiết khoản được chọn | gia sư | mot-phan | P1 | M | trinh-bay | khong |
| HP-09 | Phiếu học phí xuất ảnh PNG hoặc PDF (Tải ảnh, Xem ảnh phiếu, Xuất bản xem PDF) | gia sư | chua-co | P1 | L | trinh-bay | khong |
| HS-06 | Đánh dấu học sinh Đã nghỉ, giữ dữ liệu | gia sư | mot-phan | P1 | S | khong | khong |
| HS-08 | Lịch sử buổi đã học của học sinh | gia sư | mot-phan | P1 | S | khong | trinh-bay |
| LO-05 | Gắn học sinh cũ vào lớp mới (bảng Mới / Cũ, combobox) | gia sư | mot-phan | P1 | M | khong | trinh-bay |
| LO-07 | Mã mời lớp và duyệt hoặc từ chối thành viên chờ (gia sư thấy hàng chờ, học sinh thấy trạng thái chờ duyệt) | gia sư | mot-phan | P1 | M | khong | trinh-bay |
| LO-13 | Tổng hợp link báo cáo của cả lớp: hộp chọn học sinh và link riêng từng em | gia sư | mot-phan | P1 | M | khong | trinh-bay |
| SV-05 | Tham gia lớp bằng mã mời, xem trước gia sư / lịch / học phí, trạng thái chờ duyệt | học sinh | mot-phan | P1 | M | khong | trinh-bay |
| SV-09 | Bảng xếp hạng theo lớp, tên rút gọn, tuỳ chọn tham gia | học sinh | mot-phan | P1 | M | khong | trinh-bay |
| SV-10 | Thông báo cho học sinh khi bài được chấm; nhắc 07:00 bài hết hạn | học sinh | mot-phan | P1 | S | khong | khong |
| BU-08 | Ghi chú buổi có phân quyền người xem (học sinh, phụ huynh, riêng tư) và trình soạn bảng, link | gia sư | chua-co | P2 | L | khong | trinh-bay |
| BU-12 | Ghi âm thành chữ vào ô nhận xét và ghi chú | gia sư | chua-co | P2 | M | khong | khong |
| BU-13 | Xuất ảnh PNG báo cáo buổi để gửi Zalo (không chứa học phí) | gia sư | chua-co | P2 | M | khong | trinh-bay |
| HP-06 | Xuất sổ học phí và lịch sử khoản thu (CSV, Excel, PDF) | gia sư | mot-phan | P2 | S | trinh-bay | khong |
| HP-07 | Tài khoản ngân hàng để sinh mã QR: đủ danh sách 15 ngân hàng, mã VietQR đúng số tiền và nội dung | gia sư | da-co | P2 | S | trinh-bay | khong |
| HP-10 | Thư viện mẫu phiếu thu (Figma 10 mẫu: 4 Free và 6 Pro), lưu mẫu ưa thích | gia sư | chua-co | P2 | L | khong | khong |
| HP-11 | Ẩn chi tiết học phí trên phiếu (chỉ hiện tổng) và lời nhắn tuỳ ý lưu kèm phiếu | gia sư | chua-co | P2 | S | trinh-bay | khong |
| HP-12 | Kèm báo cáo học tập đã duyệt vào phiếu thu | gia sư | chua-co | P2 | M | trinh-bay | trinh-bay |
| HP-13 | Tạo nhiều phiếu cùng lúc và xuất ảnh hàng loạt theo lưới 1x1, 2x2, 2x3, 3x3 | gia sư | mot-phan | P2 | L | trinh-bay | khong |
| HP-29 | Tiền đóng dư trừ vào tháng sau hoặc đã trả lại; màn xem số dư tín dụng từng em | gia sư | da-co | P2 | S | trinh-bay | khong |
| HP-34 | Theo dõi phiếu đã gửi và phụ huynh đã xem; tổng hợp 'chưa xem sau N ngày' | gia sư | da-co | P2 | S | trinh-bay | khong |
| HS-07 | Xoá học sinh với xác nhận hai bước (nên đổi thành ẩn/lưu trữ) | gia sư | da-co | P2 | S | khong | khong |
| HS-10 | Trạng thái học sinh Hoạt động / Không hoạt động; Tiềm năng cho lead | gia sư | mot-phan | P2 | M | khong | chua-lam |
| LI-12 | Lặp lại buổi: một lần, giữ chỗ tuần (tối đa 7 ngày), định kỳ | gia sư | mot-phan | P2 | L | khong | khong |
| LI-13 | Xoá buổi học (xoá phiên điểm danh và buổi lẻ) | gia sư | mot-phan | P2 | M | khong | khong |
| LI-14 | Chọn nhiều buổi để xoá hoặc báo nghỉ hàng loạt | gia sư | chua-co | P2 | M | khong | khong |
| LI-15 | Buổi học yêu cầu tín chỉ bù | gia sư | chua-co | P2 | M | khong | khong |
| LI-20 | Nhắc lịch qua email (24 giờ, 1 giờ) cho phụ huynh và học sinh | hệ thống | mot-phan | P2 | M | khong | khong |
| LI-21 | Mời học sinh qua email kèm link buổi | hệ thống | chua-co | P2 | M | khong | khong |
| LI-22 | Sinh buổi hàng loạt theo khoảng (1, 4, 8 tuần, 3 tháng), xem trước và bỏ tick từng buổi | gia sư | chua-co | P2 | XL | khong | khong |
| LI-24 | Lịch sử buổi đã dạy toàn bộ và tra cứu theo học sinh | gia sư | mot-phan | P2 | M | khong | khong |
| LO-08 | Gia sư sửa ngày vào lớp (quyết định buổi nào tính cho học sinh) | gia sư | mot-phan | P2 | S | khong | khong |
| LO-15 | Nhân bản lớp kèm làm mới hạn nộp | gia sư | mot-phan | P2 | S | khong | khong |
| SV-08 | Hỏi đáp của lớp (gộp Thread và Question/Answer), gia sư trả lời và đánh dấu đáp án đúng | học sinh | mot-phan | P2 | L | khong | trinh-bay |
| SV-11 | Ẩn giỏ hàng, khoá đã lưu, đánh giá khoá, Tin tức, Tra cứu khỏi vỏ học sinh | học sinh | mot-phan | P2 | S | khong | khong |
| HP-08 | Cảnh báo chưa có tài khoản ngân hàng khi tạo phiếu | gia sư | da-co | P3 | S | trinh-bay | khong |
| HP-33 | Sửa số tiền phiếu có lý do, huỷ và khôi phục phiếu, ghi nhận thanh toán thủ công | gia sư | da-co | P3 | S | khong | khong |
| HP-35 | Gửi phiếu qua Zalo bằng tay (chat riêng và nhóm lớp) và phụ huynh bấm Tôi đã chuyển | gia sư | da-co | P3 | S | khong | khong |
| HS-05 | Thông tin phụ huynh, Zalo, email học viên trong hàng học sinh | gia sư | da-co | P3 | S | khong | trinh-bay |
| SV-07 | Hồ sơ học sinh /student/ho-so và phiếu học phí tháng của học sinh | học sinh | da-co | P3 | S | trinh-bay | trinh-bay |

**Tiêu chí nghiệm thu (đo được).**

1. Số liệu khớp 0 đồng: 4 chỉ số học phí (HP-02) và dải chưa thu (HP-03) bằng đúng tổng truy vấn gốc trên seed mock gồm ít nhất 12 phiếu đủ các trạng thái (nháp, đã gửi, một phần, đã thu, huỷ); test so khớp tự động.
2. Ảnh phiếu xuất ra (HP-09) có đúng số tiền, mã phiếu và QR như trang /phieu/[token]; so sánh văn bản trích bằng OCR cục bộ hoặc đọc từ DOM nguồn của ảnh, 12/12 phiếu khớp.
3. Hồ sơ học sinh mở đủ 5 tab; mỗi tab hiển thị đúng dữ liệu có sẵn (điểm danh 90 ngày, phiếu, bài tập), không tab nào cho sửa dữ liệu cá nhân của em (HS-03 chưa làm).
4. Link báo cáo riêng: Copy, Xem thử, Thu hồi (HS-09) — sau Thu hồi, truy cập link cũ trả trang "link không còn hiệu lực" trong ≤ 1 yêu cầu; kiểm bằng test.
5. Học sinh mới đăng ký lần đầu: màn Việc của tôi trống phải có nút "Nhập mã lớp" (SV-06) và đi tới hết luồng vào lớp trong ≤ 4 chạm; không còn chữ giả hay số giả trên các màn học sinh (grep các chuỗi "Thiết bị 1/2", "Xử lý số liệu").
6. Điện thoại 390: Việc của tôi và Lịch học (299:116497, 299:116644) hiển thị đủ nội dung hôm nay mà không cuộn ngang; hạn nộp hiển thị đúng giờ Việt Nam (xem MD-16 ở Đợt 3).
7. Bảng xếp hạng (SV-09) không còn hiện tên thật đầy đủ cho người chưa đăng nhập; kiểm bằng gọi /api/leaderboard khi chưa đăng nhập.

**Test cần có.**

- t-tuition-*.ts hiện có phải xanh y nguyên; thêm test "số hiển thị = số truy vấn gốc" cho từng thẻ.
- Test quyền: học sinh không thấy phiếu của em khác; phụ huynh chỉ qua token; gia sư chỉ thấy học sinh của lớp mình.
- Test lưới màn hình 320/390/1440 cho mọi màn học sinh.

**Phụ thuộc.** Đợt 1 xong HT-01/HT-02. HP-09 dùng bộ dựng ảnh ở máy khách (thư viện chọn sau, cần thử trên iOS Safari). Mọi hạng mục "chua-lam" ở mục 7 không thuộc đợt này.

**Rủi ro.**

- Hiển thị tiền sai là lỗi nặng nhất của đợt: mọi thẻ tiền đều đi qua cùng một hàm tính với trang gốc, cấm tự tính lại trong component.
- Dựng ảnh phiếu bằng canvas có thể lệch font hoặc mất dấu tiếng Việt trên iOS; cần thử máy thật trước khi nghiệm thu.
- Hồ sơ học sinh nhiều tab dễ trở thành chỗ nhồi thông tin (điểm nghẽn #4 của trang bài giảng): mỗi tab tối đa 7 mục, 3 hành động chính.

### Đợt 3. Media: tải video record, tải tài liệu, tải bài test và quiz, giao diện học sinh xem video

**Mục tiêu.** Biến học liệu thành thứ gia sư tải lên được và học sinh xem được dễ dàng, đúng quyền. Gồm: bản ghi video (link chuẩn hoá ngay, tải file lên khi chủ duyệt), tài liệu (giới hạn, đo dung lượng, xem trước, quyền xem), bài test và quiz theo bộ khung Figma 464/504, và trình xem video tối ưu cho học sinh. Đợt này mở đầu bằng việc vá lỗ lộ link học liệu cho người chưa ghi danh.

**Quy mô.** 33 tính năng (mot-phan 22, chua-co 9, da-co 2), ước lượng thô 116 người-ngày, 7 tính năng cần thêm schema. Khu vực: Video, tài liệu 17, Quiz và bài tập 13, Buổi học 1, Gói và thuê bao 1, Quản trị 1.

**Thứ tự trong đợt.** 3A An ninh học liệu trước (MD-03, MD-09, QZ-14) → 3B Nền FileAsset và tài liệu (MD-08, MD-10, MD-11) → 3C Bản ghi bằng link và trang Bản ghi (MD-01, MD-02) + Soạn bài giảng (MD-13) → 3D Trình xem của học sinh (MD-05..07, MD-14, MD-16, MD-18) → 3E Quiz và bài tập, phía gia sư rồi phía học sinh (QZ-xx) → 3F Tải video lên (MD-04) CHỈ khi chủ duyệt mục 7. 3A..3E không đợi quyết định nào.

**Tính năng.**

| Mã | Tính năng | Vai | Hiện trạng | Ưu tiên | Công sức | Tiền | Trẻ em |
|---|---|---|---|---|---|---|---|
| MD-01 | Bản ghi bằng link: nhận diện YouTube / Drive / Vimeo / Zoom cloud, kiểm link ngay khi dán, báo lỗi sớm | gia sư | mot-phan | P0 | M | khong | khong |
| MD-02 | Trang Bản ghi của lớp và gắn bản ghi vào đúng buổi học (sau buổi dán link vào buổi) | gia sư | chua-co | P0 | L | khong | khong |
| MD-03 | Không lộ videoUrl, documents, azotaUrl, zoomUrl cho người chưa ghi danh qua GET /api/courses/[id] | hệ thống | chua-co | P0 | S | khong | khong |
| MD-05 | Trình phát cho học sinh: tốc độ, xem tiếp từ giây đã lưu, mốc chương, ghi chú theo thời điểm | học sinh | mot-phan | P0 | L | khong | khong |
| MD-06 | Tách trạng thái đang xem và đã xong (sửa PATCH tiến độ và markComplete ghi đè watchedSeconds=0) | học sinh | mot-phan | P0 | S | khong | khong |
| MD-07 | Tab Tài liệu và bản ghi trong trang Lớp của học sinh (gộp Thư viện, tab Tài liệu, Ngân hàng đề) | học sinh | mot-phan | P0 | M | khong | khong |
| MD-08 | Tải tài liệu lên (PDF, Office, ảnh) có giới hạn dung lượng và loại báo trước, đo bytes vào FileAsset | gia sư | mot-phan | P0 | M | khong | khong |
| MD-09 | Xem trước tài liệu rồi mới tải (ảnh, txt, PDF, Office); siết /xem-tai-lieu (scheme, host) | học sinh | mot-phan | P0 | M | khong | khong |
| MD-13 | Soạn bài giảng và học liệu: danh sách mục nội dung rõ kiểu (Video, Tài liệu, Bài tập, Live), nút Xem như học sinh, nhập hàng loạt tên bài | gia sư | mot-phan | P0 | L | khong | khong |
| MD-14 | Azota: link + hạn nộp, học sinh bấm Em đã làm xong và dán link bài làm, gia sư thấy ai đã làm | học sinh | mot-phan | P0 | M | khong | trinh-bay |
| MD-16 | Hạn Azota vào Việc của tôi và lịch (toISO nhận datetime-local) | học sinh | mot-phan | P0 | S | khong | khong |
| QZ-01 | Trung tâm Bài tập và quiz (gộp Bài tập và kiểm tra) | gia sư | mot-phan | P0 | L | khong | khong |
| QZ-03 | Soạn câu hỏi nhiều đáp án và tự luận (máy tính và điện thoại) | gia sư | mot-phan | P0 | L | khong | khong |
| QZ-04 | Tạo quiz: nội dung đề, đáp án và phát hành | gia sư | mot-phan | P0 | L | khong | khong |
| QZ-05 | Tải bài test lên: nhập đề từ PDF / Word / ảnh, chọn tệp và cấu trúc, rà soát câu hỏi và đáp án | gia sư | mot-phan | P0 | L | khong | khong |
| QZ-08 | Chấm quiz hỗn hợp: chờ chấm và công bố (máy tính và điện thoại) | gia sư | mot-phan | P0 | L | khong | trinh-bay |
| QZ-09 | Tạo bài tập, chi tiết bài tập và bài nộp, chấm bài | gia sư | mot-phan | P0 | L | khong | trinh-bay |
| QZ-10 | Học sinh: bài tập đọc đề và nộp bài, bài nộp theo dõi và nộp lại, điểm và phản hồi (có điện thoại) | học sinh | mot-phan | P0 | L | khong | trinh-bay |
| QZ-11 | Học sinh: cổng vào đề bằng mã lớp, phòng làm quiz, kiểm tra và nộp, hết giờ và xác nhận bài nộp | học sinh | mot-phan | P0 | L | khong | trinh-bay |
| QZ-14 | Mật khẩu vào thi hiện lưu chuỗi thô: băm | hệ thống | mot-phan | P0 | S | khong | khong |
| BU-09 | Tài liệu đính kèm cấp buổi (tài liệu lớp, không gắn riêng một em) | gia sư | chua-co | P1 | L | khong | khong |
| GO-08 | Thẻ hạn mức: 4 hạn mức (học sinh, mẫu phiếu, dung lượng, Drive) và thanh dung lượng %, chỉ ĐO không chặn | gia sư | chua-co | P1 | L | trinh-bay | khong |
| MD-04 | Tải video record lên kho riêng: tải thẳng từ trình duyệt, thanh tiến trình, tiếp tục khi đứt mạng, hạn mức dung lượng | gia sư | chua-co | P1 | XL | chua-lam | chua-lam |
| MD-10 | Quyền xem tài liệu chỉ học viên đã ghi danh (đường dẫn có ký, hết hạn ngắn) | hệ thống | chua-co | P1 | L | khong | khong |
| MD-11 | Cam kết bản quyền khi tải lên và quy trình gỡ khi có khiếu nại | gia sư | chua-co | P1 | S | khong | khong |
| MD-12 | Thư viện của tôi cho gia sư: đề gốc, học liệu dùng lại giữa các lớp | gia sư | mot-phan | P1 | L | khong | khong |
| MD-17 | Bảng ai đã xem video, ai chưa, cho gia sư | gia sư | chua-co | P1 | M | khong | trinh-bay |
| MD-18 | Bỏ chữ giả và số giả: Thiết bị 1/2, lượt xem luôn 0, nhãn Quiz - Xử lý số liệu cho mọi môn | học sinh | mot-phan | P1 | S | khong | khong |
| QZ-06 | Theo dõi lượt làm và phân tích kết quả quiz | gia sư | mot-phan | P1 | M | khong | trinh-bay |
| QZ-12 | Học sinh: kết quả và lời giải, chữa bài | học sinh | da-co | P1 | M | khong | trinh-bay |
| QT-08 | Tách tệp lớn khoa-hoc/[id] (2.384 dòng) và thi-thu (1.970 dòng) | hệ thống | mot-phan | P2 | L | khong | khong |
| QZ-02 | Ngân hàng câu hỏi: kho riêng mặc định, chia sẻ và duyệt chỉ bật khi có nhóm | gia sư | da-co | P2 | M | khong | khong |
| QZ-07 | Quiz chỉnh sửa và phiên bản | gia sư | chua-co | P2 | L | khong | khong |

**Tiêu chí nghiệm thu (đo được).**

1. Không lộ link: gọi GET /api/courses/[id] với 3 vai (khách, học sinh chưa ghi danh, học sinh đã ghi danh) — hai vai đầu không nhận videoUrl, documents, azotaUrl, zoomUrl trong JSON; vai thứ ba nhận đủ; 3/3 đạt (MD-03).
2. Phân loại link: 12 mẫu cố định (YouTube watch, youtu.be, shorts, embed, live; Drive; Vimeo; Facebook; link lạ; chuỗi rỗng; link có khoảng trắng) được phân đúng loại và báo lỗi tiếng Việt rõ ngay lúc gia sư dán, không phải lúc học sinh mở; 12/12 (MD-01).
3. Xem tiếp: đóng tab ở giây 312 rồi mở lại, video bắt đầu trong khoảng 310 đến 314 giây; "đang xem" và "đã xong" là hai trạng thái riêng, xem 30% không bao giờ hiện là đã xong (MD-05, MD-06).
4. Tài liệu: tệp vượt giới hạn hoặc sai loại bị chặn trước khi tải lên kèm lý do; tệp hợp lệ ghi đúng bytes vào FileAsset (sai lệch 0 byte); /xem-tai-lieu từ chối javascript:, data: và host ngoài danh sách cho phép (MD-08, MD-09).
5. Quyền tài liệu: liên kết tải của tệp lớp A không mở được bởi học sinh lớp B hoặc khách, và liên kết ký hết hạn sau thời gian cấu hình (đề xuất 60 phút); test 3 vai (MD-10).
6. Quiz đi trọn một vòng bằng test e2e: gia sư nhập đề mẫu 20 câu (trắc nghiệm + tự luận) → rà soát → phát hành → học sinh làm trên điện thoại 390 → hết giờ tự nộp → gia sư chấm hàng chờ → công bố → học sinh xem kết quả và lời giải; mọi điểm khớp tính tay (QZ-03..QZ-12).
7. Trang bài giảng học sinh không còn nhồi một trang: tab Bài học / Tài liệu và bản ghi / Bài tập / Kiểm tra tách rõ; tìm "video buổi hôm qua" trong ≤ 3 chạm và ≤ 10 giây khi người thử làm lần đầu (đo trong phiên phản biện vai học sinh, mục 8).
8. Mọi màn mới có khung Figma được đối chiếu như Đợt 1; màn xem video di động không có khung Figma nên được dựng từ token và được duyệt riêng (cần chủ xem).

**Test cần có.**

- Test quyền xem là bộ quan trọng nhất của đợt: ma trận vai x tài nguyên (khách, học sinh chưa ghi danh, ghi danh, gia sư khác, gia sư chủ lớp, quản trị) cho video, tài liệu, đề, bài nộp.
- Test hàm thuần: phân loại link, đọc YouTube dùng chung (hiện lặp ở hai trang), chấm quiz hỗn hợp, đếm bytes.
- Test tải tệp thật bằng tệp mẫu 1 KB, 24 MB, 26 MB (giới hạn đề xuất 25 MB) và tệp đổi đuôi giả; kiểm tra magic bytes.
- Test không gửi dữ liệu lên dịch vụ ngoài khi không có khoá (AI trích đề, dịch vụ video): có thông báo tiếng Việt, không treo.

**Phụ thuộc.** 3F cần quyết định mục 7.1 (nơi lưu video) và 7.2 (video có hình/giọng học sinh). 3E phụ thuộc Đợt 1 (bản ghi buổi) chỉ ở phần "bài tập về nhà trong ghi chép buổi". Ảnh bài làm của học sinh (MD-15) và AI hint (QZ-15) không thuộc đợt này.

**Rủi ro.**

- Cloudinary hiện upload không ký: ai biết tên cloud và preset là tải lên được. Phần này vá ở 3B (preset ký hoặc tải qua máy chủ); trong lúc chưa vá không được quảng bá "quyền xem riêng".
- AI trích đề giới hạn 4 MB (body Vercel) và có thể quá 60 giây với đề dài: phải chuyển sang tải thẳng + xử lý nền, nếu không "tải bài test" vẫn hỏng với đề thật.
- Gom hai kho câu hỏi (QZ-13) có rủi ro hồi quy lớn nên cố ý để Đợt 5; trong Đợt 3 chỉ làm giao diện thống nhất trên hai kho.
- Bản quyền tài liệu: gia sư tải SGK/đề của nhà xuất bản. Cần cam kết khi tải lên (MD-11) và quy trình gỡ; văn bản phải do luật sư duyệt.
- Web Speech API và quay/nghe trên iOS PWA không ổn định: ghi âm thành chữ (BU-12) có phương án dự phòng, không chặn luồng chính.

### Đợt 4. Phụ huynh, khách, quản trị, phân tích và báo cáo

**Mục tiêu.** Hoàn thiện ba vai còn lại cùng lớp phân tích: phụ huynh có một Sổ của con đầy đủ (chuyên cần, báo cáo, bài tập, điểm, học phí chỉ đọc), khách thấy sản phẩm và tìm được gia sư, quản trị thấy "hôm nay cần làm gì" thay vì chỉ thống kê, gia sư có phân tích doanh thu và dạy học đúng Figma 464:7126.

**Quy mô.** 37 tính năng (mot-phan 22, chua-co 8, da-co 7), ước lượng thô 64 người-ngày, 2 tính năng cần thêm schema. Khu vực: Quản trị 8, Báo cáo phụ huynh 6, Phân tích 5, Phụ huynh 5, Khách 5, Tài khoản và cài đặt 4, Hệ thống dùng chung 2, Điểm danh 1, Học phí 1.

**Thứ tự trong đợt.** 4A Phụ huynh và báo cáo (PH-xx, BC-xx) → 4B Phân tích (PT-xx) → 4C Khách (KH-xx, TK-02) → 4D Quản trị (QT-xx) → 4E rà soát kênh hỗ trợ, PWA, kiểm máy thật (TK-05, TK-06, HT-05).

**Tính năng.**

| Mã | Tính năng | Vai | Hiện trạng | Ưu tiên | Công sức | Tiền | Trẻ em |
|---|---|---|---|---|---|---|---|
| PH-01 | Sổ của con (máy tính và điện thoại): chuyên cần, buổi sắp tới, báo cáo tháng đã duyệt; thêm bài tập tháng này, điểm, bài Azota con chưa làm | phụ huynh | mot-phan | P0 | L | trinh-bay | trinh-bay |
| QT-02 | Kiểm duyệt và nhật ký: một hàng chờ duy nhất, trang đọc AuditLog | quản trị | mot-phan | P0 | M | khong | khong |
| BC-02 | Báo cáo theo từng buổi: chi tiết buổi và tiến bộ | gia sư | mot-phan | P1 | L | khong | trinh-bay |
| BC-03 | Tiến độ học liệu vào báo cáo tháng (đã xem N/M video, bài Azota chưa làm) | gia sư | chua-co | P1 | M | khong | trinh-bay |
| HT-05 | Kiểm iOS dọc cho ghi âm và push trên thiết bị thật (NC1-033, NC1-034) | hệ thống | mot-phan | P1 | M | khong | khong |
| KH-01 | Trang chủ công khai: 6 nỗi đau, cách hoạt động 3 bước, FAQ 10 câu, nút tạo tài khoản | khách | mot-phan | P1 | M | khong | khong |
| KH-02 | Tìm gia sư (máy tính và điện thoại): lọc môn, khu vực, hình thức; thẻ gia sư | khách | mot-phan | P1 | M | khong | khong |
| KH-03 | Hồ sơ công khai gia sư (xem trước lịch, mức học phí theo Thông tư 29) | khách | da-co | P1 | S | khong | khong |
| PH-05 | Phụ huynh nhiều con: chuyển nhanh giữa các con | phụ huynh | mot-phan | P1 | M | khong | trinh-bay |
| PT-01 | Phân tích doanh thu 4 thẻ KPI: Đã thu, Chưa thu, Tiềm năng, Tỷ lệ thu | gia sư | mot-phan | P1 | M | trinh-bay | khong |
| PT-05 | Sổ điểm và tiến bộ theo học sinh / lớp cho gia sư (bài tập, kiểm tra, chuyên cần) | gia sư | chua-co | P1 | L | khong | trinh-bay |
| QT-01 | Người dùng và quyền truy cập: vai, đổi vai, trợ giảng khi cần | quản trị | mot-phan | P1 | M | khong | khong |
| QT-03 | Triển khai và hạn mức: lần chạy cron gần nhất, hạn mức, cờ KIN_TRIAL_MODE | quản trị | chua-co | P1 | L | khong | khong |
| QT-04 | Quản trị Hoạt động: 'hôm nay cần làm gì' thay vì chỉ thống kê | quản trị | mot-phan | P1 | M | khong | khong |
| QT-05 | Quản trị Duyệt hồ sơ và cấu hình | quản trị | mot-phan | P1 | M | khong | khong |
| QT-06 | Lối vào Duyệt nạp Coin ở menu quản trị | quản trị | mot-phan | P1 | S | trinh-bay | khong |
| QT-07 | Học sinh chia theo lớp; giới hạn nhắc hàng loạt theo lớp, không gửi toàn nền tảng | quản trị | mot-phan | P1 | M | khong | trinh-bay |
| TK-02 | Đăng nhập, đăng ký, khôi phục mật khẩu: dựng lại giao diện theo Figma | khách | mot-phan | P1 | M | khong | khong |
| TK-05 | Cài PWA lên màn hình chính: hướng dẫn từng bước trong app cho iOS 16.4+ | gia sư | mot-phan | P1 | S | khong | khong |
| BC-01 | Báo cáo tháng gửi phụ huynh có duyệt trước (chuyên cần, nỗ lực, năng lực, Điều chưa đạt) | gia sư | da-co | P2 | S | khong | trinh-bay |
| BC-04 | Biết phụ huynh đã xem báo cáo và lịch (dấu đã xem) | gia sư | mot-phan | P2 | S | khong | trinh-bay |
| BC-05 | PIN tuỳ chọn cho link báo cáo | phụ huynh | chua-co | P2 | M | khong | trinh-bay |
| BC-06 | Tải PDF báo cáo trên trang phụ huynh | phụ huynh | chua-co | P2 | M | khong | trinh-bay |
| DD-08 | Báo cáo chuyên cần tổng hợp theo lớp và khoảng thời gian | gia sư | mot-phan | P2 | M | khong | khong |
| HP-37 | Nạp Coin chuyển khoản thủ công (admin duyệt) | quản trị | da-co | P2 | S | trinh-bay | khong |
| KH-05 | Thi thử cho khách bằng link mời có hạn; tài liệu miễn phí công khai gọn ở trang giới thiệu khoá | khách | mot-phan | P2 | S | khong | khong |
| KH-06 | Chính sách và điều khoản: rà bản dự thảo | khách | mot-phan | P2 | S | khong | khong |
| PH-02 | Phiếu học phí, mã QR, Tôi đã chuyển | phụ huynh | da-co | P2 | S | trinh-bay | khong |
| PH-03 | Báo nghỉ buổi và xác nhận điểm danh | phụ huynh | da-co | P2 | S | khong | khong |
| PH-06 | Cổng phụ huynh xem công nợ nhiều tháng, lịch sử thanh toán, số dư trả trước | phụ huynh | mot-phan | P2 | M | trinh-bay | trinh-bay |
| PT-02 | Bộ lọc phân tích nhiều lớp và tháng, gồm lớp đã kết thúc | gia sư | mot-phan | P2 | S | khong | khong |
| PT-03 | Biểu đồ buổi học theo trạng thái (Đã nghỉ, Hoàn thành, Đã lên lịch) | gia sư | chua-co | P2 | M | khong | khong |
| PT-04 | Biểu đồ Đã thu so với Tiềm năng và khối Cách tính tiềm năng | gia sư | chua-co | P2 | M | trinh-bay | khong |
| TK-06 | Kênh hỗ trợ gom thành nhóm Hỗ trợ: email, Messenger, nhóm Zalo | gia sư | mot-phan | P2 | S | khong | khong |
| HT-04 | Trang tham chiếu Bản đồ tính năng và phạm vi (đối chiếu cờ KIN_TRIAL_MODE) | hệ thống | chua-co | P3 | S | khong | khong |
| QT-09 | Doanh thu nền tảng, phễu gia sư, số đo sức khoẻ, Tin tức, Blog, Điểm chuẩn | quản trị | da-co | P3 | S | khong | khong |
| TK-03 | Hồ sơ giáo viên: sửa tên hiển thị trong cùng màn | gia sư | da-co | P3 | S | khong | khong |

**Tiêu chí nghiệm thu (đo được).**

1. Sổ của con: buổi đã chốt luôn hiện đúng dù ngày chốt là hôm nay hay hôm qua, buổi dạy bù sai ngày vẫn hiện (không lọc theo ngày ≤ hôm nay); test với 6 trường hợp ngày.
2. Phụ huynh không bao giờ thấy học sinh khác, không thấy học phí của người khác; kiểm bằng ma trận token x học sinh (mọi token chỉ trả dữ liệu của em tương ứng).
3. Bốn thẻ phân tích (Đã thu, Chưa thu, Tiềm năng, Tỷ lệ thu) bằng đúng truy vấn gốc, sai lệch 0 đồng, và có dòng giải thích cách tính (PT-04).
4. Quản trị: trang Hoạt động trả lời được câu "hôm nay cần làm gì" bằng danh sách việc có số đếm; hàng chờ kiểm duyệt là cửa duy nhất cho duyệt gia sư (không còn 3 lối vào); Nhật ký đọc được và lọc theo người, loại, ngày.
5. Cron: chạy khi thiếu CRON_SECRET thì từ chối thay vì mở công khai; trang Triển khai hiện lần chạy gần nhất của từng cron.
6. Khách: tìm gia sư theo môn và khu vực trả kết quả đúng với 10 hồ sơ mẫu; trang chủ đủ 6 nỗi đau, 3 bước, FAQ 10 câu, CTA tạo tài khoản; mọi viện dẫn pháp lý có dòng "căn cứ để hỏi luật sư".
7. Phản biện 3 vai (mục 8) không còn lỗi mức chặn trên mọi màn của đợt.

**Test cần có.**

- Ma trận quyền cho từng vai x từng route công khai/token/quản trị (mở rộng bộ t-core-regression).
- Test hàm thuần cho bốn thẻ phân tích và quy ước buổi Tiềm năng.
- Test ảnh chụp ở 390 cho Sổ của con, Tìm gia sư; kiểm thủ công Safari iOS cho PWA và push (HT-05).

**Phụ thuộc.** Phụ thuộc Đợt 1 (buổi chốt, ghi chép buổi) cho BC-02, BC-03; Đợt 3 (MD-14, LessonProgress) cho BC-03. Yêu cầu tìm gia sư của khách (KH-04) và đồng ý của phụ huynh (PH-04) nằm ở mục 7, chưa làm.

**Rủi ro.**

- Phụ huynh là vai không có tài khoản (vào bằng token): thêm dữ liệu vào Sổ của con làm tăng bề mặt lộ dữ liệu trẻ em. Mỗi khối mới phải đi qua cùng một hàm kiểm token và chỉ đọc.
- Nội dung pháp lý ở trang khách (Thông tư 29, Nghị định 13) chưa có ý kiến luật sư: chỉ đăng khi đã duyệt.
- Quản trị đang thấy cả nền tảng: giới hạn theo lớp trước khi nói "mỗi trung tâm một không gian riêng".

### Đợt 5. Tính năng còn lại: tích hợp Google, đăng nhập Google, thông báo hàng loạt, gom kho câu hỏi

**Mục tiêu.** Làm nốt các tính năng nặng hoặc phụ thuộc bên ngoài, chỉ khi bốn đợt đầu đã ổn: kết nối Google Calendar/Meet/Drive, đăng nhập Google, gom hai kho câu hỏi, lịch sử thanh toán gói. Các mục thuộc gói Free/Pro nằm ở mục 7 vì giá và gói chưa chốt.

**Quy mô.** 14 tính năng (mot-phan 8, chua-co 6), ước lượng thô 52 người-ngày, 8 tính năng cần thêm schema. Khu vực: Tích hợp Google 4, Lịch 3, Tài khoản và cài đặt 2, Lớp 1, Gói và thuê bao 1, Báo cáo phụ huynh 1, Video, tài liệu 1, Quiz và bài tập 1.

**Thứ tự trong đợt.** 5A Đăng nhập Google (TK-01) → 5B Kết nối Google (TK-07, TC-01, TC-03, TC-04, TC-05) → 5C Gom kho câu hỏi (QZ-13) → 5D phần còn lại.

**Tính năng.**

| Mã | Tính năng | Vai | Hiện trạng | Ưu tiên | Công sức | Tiền | Trẻ em |
|---|---|---|---|---|---|---|---|
| TK-07 | Màn Kết nối và lưu trữ gom Google Calendar, Meet, Drive và dung lượng | gia sư | mot-phan | P1 | L | khong | khong |
| GO-07 | Lịch sử thanh toán gói cho gia sư | gia sư | mot-phan | P2 | S | trinh-bay | khong |
| LI-19 | Sự kiện khác ngoài dạy học và khoảng bận của giáo viên (họp, nghỉ, việc riêng) chặn xếp buổi | gia sư | chua-co | P2 | M | khong | khong |
| LO-16 | Bảo lưu học: trạng thái kèm ngày hết hạn, giữ lịch sử | gia sư | mot-phan | P2 | M | chua-lam | khong |
| QZ-13 | Gom hai kho câu hỏi (bài tập web và đề thi) về một kho dùng chung | gia sư | mot-phan | P2 | XL | khong | khong |
| TC-01 | Kết nối Google Calendar (OAuth) và đồng bộ buổi một chiều: tạo, sửa, huỷ sự kiện | gia sư | chua-co | P2 | XL | khong | khong |
| TC-03 | Kết nối Google Meet: phòng cố định hoặc theo buổi | gia sư | mot-phan | P2 | L | khong | khong |
| TC-04 | Kết nối Google Drive và đính kèm tài liệu từ Drive (Picker, quyền drive.file) | gia sư | chua-co | P2 | L | khong | khong |
| TC-05 | Công tắc đồng bộ Google Calendar khi tạo lớp | gia sư | chua-co | P2 | S | khong | khong |
| TK-01 | Đăng nhập Google và đặt mật khẩu cho tài khoản Google | gia sư | mot-phan | P2 | M | khong | khong |
| BC-07 | Thông báo hàng loạt: tin chung nhóm Zalo, email nhóm; SMS hàng loạt | gia sư | mot-phan | P3 | M | khong | trinh-bay |
| LI-18 | Hiển thị lịch công khai hoặc riêng tư | gia sư | chua-co | P3 | S | khong | khong |
| LI-23 | Sĩ số theo từng buổi nhóm | gia sư | mot-phan | P3 | M | khong | khong |
| MD-20 | Phụ đề / bản chép lời cho video | học sinh | chua-co | P3 | L | khong | khong |

**Tiêu chí nghiệm thu (đo được).**

1. Google Calendar một chiều: tạo, dời, huỷ một buổi trong KiN thì sự kiện tương ứng được tạo, dời, gỡ trong Calendar thử trong ≤ 60 giây; chạy lại hai lần không sinh sự kiện trùng (idempotent); test với tài khoản Google thử.
2. Google Drive: chọn một tệp từ Drive đính vào bài; KiN chỉ xin quyền drive.file, không đọc toàn bộ Drive; ngắt kết nối thì tệp đã đính vẫn mở được hoặc báo rõ lý do.
3. Đăng nhập Google: tài khoản email + mật khẩu hiện có và tài khoản Google cùng email gộp đúng một người dùng, 0 tài khoản trùng.
4. Gom kho câu hỏi: 100% bài tập web và đề thi cũ làm lại được và chấm cùng điểm như trước (so khớp trên mọi bài nộp mock).
5. Mọi kết nối Google ngắt được từ Cài đặt, và sau ngắt không còn token lưu trong DB.

**Test cần có.**

- Test chạm API Google dùng máy chủ giả (mock) cho CI và một lượt kiểm thật bằng tài khoản thử, ghi rõ chưa có khoá thì không kiểm.
- Test di chuyển dữ liệu cho gom kho câu hỏi: chạy trên bản sao dữ liệu mock trước.

**Phụ thuộc.** Cần Thọ cấp khoá OAuth Google (client id/secret) và duyệt màn hình đồng ý OAuth. TC-01 phụ thuộc bản ghi buổi của Đợt 1.

**Rủi ro.**

- Google yêu cầu xác minh ứng dụng khi dùng scope nhạy cảm (Calendar); thời gian duyệt nằm ngoài tầm kiểm soát. Phương án dự phòng: tải tệp .ics một chiều.
- Đồng bộ hai chiều (TC-02) rất dễ sinh vòng lặp: chỉ làm khi một chiều đã chạy ổn nhiều tuần.
- Gom kho câu hỏi chạm dữ liệu điểm của học sinh: bắt buộc có bản sao và đường lùi.

### Nhóm "chờ chủ quyết hoặc hoãn" (dot = hoan)

Gồm 55 tính năng không đưa vào đợt nào: 48 là CHƯA LÀM - chờ chủ dự án quyết (mục 7), 7 là hoãn có chủ đích hoặc không áp dụng cho gia sư tự do. Danh sách đầy đủ ở CSV (lọc cột `dot` = hoan).

Hoãn có chủ đích, chưa dính tiền hay trẻ em: LI-25 Khung giờ mở cho học sinh tự đặt; LI-26 Lịch theo giáo viên và theo địa điểm; LI-27 Cảnh báo múi giờ khi tạo buổi; LI-28 Xếp thời khoá biểu tự động; HS-14 Cờ có khả năng nhận SMS; màu lịch riêng từng học sinh; TK-04 Chọn ngôn ngữ Tiếng Việt / English; TC-02 Đồng bộ lịch Google hai chiều.

## 6. Schema và hạ tầng cần thêm

### 6.1 Danh sách thay đổi schema (chỉ thêm)

76 tính năng được đánh dấu cần schema. Gộp lại thành các thay đổi dưới đây; tên là đề xuất, người làm đối chiếu với `prisma/schema.prisma` thật (71 model) trước khi viết.

| Thay đổi | Phục vụ | Ghi chú |
|---|---|---|
| Bảng `FileAsset` (chủ, lớp, bài, buổi, loại video/tài liệu/ảnh/đề, nhà cung cấp, mã ngoài, url, bytes, loại MIME, thời lượng, trạng thái, ngày tạo/xoá) | MD-02, MD-04, MD-08, MD-10, GO-08, BU-09 | Là điểm đo dung lượng và là chỗ gắn quyền xem. Tệp đang nằm trong `Lesson.documents` (JSON) giữ nguyên, chỉ thêm mới |
| Cột nullable trên `AttendanceSession`: trạng thái buổi, `closedAt`, nội dung đã dạy, bài tập về nhà, nhận xét chung, hình thức Online/Offline, địa chỉ, `joinUrl` riêng buổi, trỏ tới bản ghi | BU-01..BU-06, LI-11, LI-16, LI-17, MD-02 | Xem 6.2 |
| `Course.color` nullable | LI-02 | Giữ cách suy màu cũ làm mặc định |
| `LessonProgress.completedAt` nullable | MD-06 | Tách "đang xem" và "đã xong" |
| `AssignmentSubmission.linkUrl` nullable | MD-14 | Chỉ nhận link dạng chữ |
| `TuitionInvoice`: cờ ẩn chi tiết, lời nhắn; `MonthlyReport.parentViewedAt`; `ParentLink.portalPin` | HP-11, BC-04, BC-05 | Không đổi trường tiền nào |
| Bảng ánh xạ buổi ↔ sự kiện Google (`CalendarSync`) | TC-01 | Chỉ khi làm Đợt 5 |
| Phiên bản quiz (`Exam` có `version`, bảng phiên bản) | QZ-07 | Bài đã có lượt làm thì tạo phiên bản mới |
| Bảng mẫu phiếu ưa thích | HP-10 | Việc khoá theo gói không làm |

Các dòng cần schema mà thuộc nhóm CHƯA LÀM (lead, hồ sơ gia đình, kiểu học phí, gói buổi, ...) **không** được thêm bảng ở thời điểm này.

### 6.2 Quyết định kiến trúc đề xuất: buổi học

**Vấn đề.** Buổi học hiện là suy ra từ quy luật tuần (`ClassSchedule`); chỉ khi điểm danh mới có `AttendanceSession`. Nhiều tính năng (trang buổi, chốt buổi, buổi lẻ, Online/Offline, sự kiện Google, bản ghi gắn buổi, ghi chép buổi) cần một bản ghi cho từng buổi.

| Phương án | Ưu | Nhược |
|---|---|---|
| (a) Bảng mới `ClassSession` sinh sẵn mọi buổi | Rõ ràng, dễ truy vấn | Phải sinh và đồng bộ hàng loạt; dữ liệu cũ phải di chuyển; hai nguồn sự thật (quy luật và bản ghi) |
| (b) **Mở rộng `AttendanceSession` bằng cột nullable; buổi chưa thao tác vẫn suy từ quy luật; buổi lẻ tạo bản ghi riêng** | Không di chuyển dữ liệu, đúng nguyên tắc chỉ thêm, đã có khoá (lớp, ngày), buổi cũ giữ nguyên | Bản ghi chỉ xuất hiện khi gia sư thao tác nên truy vấn "tất cả buổi" vẫn phải hợp nhất hai nguồn qua một hàm duy nhất |
| (c) Giữ như cũ, lưu ghi chú vào JSON ở nơi khác | Không đổi schema | Không truy vấn được, không có trạng thái |

**Khuyến nghị: (b).** Lý do: rủi ro thấp nhất với dữ liệu đang chạy, đúng quy tắc chỉ thêm, và mở được toàn bộ danh sách tính năng buổi. Điều kiện: viết **một hàm hợp nhất** `loadSessionsInRange` trong `lib/classSessions.ts` là nơi duy nhất trả "buổi" cho Lịch, Hộp việc, trang buổi, Google; cấm nơi khác tự suy buổi.

### 6.3 Nơi lưu video record và tài liệu (cần chủ quyết)

Hiện KiN **không lưu file video** (chỉ link YouTube); tài liệu đi thẳng Cloudinary bằng upload không ký, không ghi bytes, không giới hạn ở phía KiN.

| Phương án | Cách hoạt động | Quyền xem chỉ học viên đã ghi danh | Chi phí / rủi ro | Giới hạn dung lượng |
|---|---|---|---|---|
| **A. Link ngoài chuẩn hoá** (YouTube không công khai, Drive, Vimeo, Zoom cloud) | Gia sư tải ở dịch vụ khác, dán link; KiN nhận diện loại, kiểm lúc lưu, giấu khỏi API người chưa ghi danh, nhúng đúng trình phát | Chỉ ở mức trang KiN. Ai có link vẫn xem được nếu link bị chuyển tiếp | Không tốn hạ tầng; gia sư thêm một bước; phụ thuộc bên ngoài (video bị gỡ, đổi chính sách) | Không đo được |
| **B. Cloudinary** (đã tích hợp) | Tải lên Cloudinary bằng preset; phát bằng URL | Có giao hàng có chữ ký nhưng phải bật và kiểm; hiện đang công khai và upload không ký | Tính theo tín dụng lưu trữ và băng thông, video ngốn tín dụng nhanh; giới hạn kích thước tệp theo gói của tài khoản. **Chưa kiểm bảng giá** | Đo được qua `UploadResult.bytes` |
| **C. Dịch vụ video chuyên dụng** (Cloudflare Stream hoặc Mux) | Tải thẳng từ trình duyệt bằng link tải một lần (không qua body Vercel); dịch vụ chuyển mã sang HLS thích ứng băng thông; phát bằng token ký ngắn hạn do KiN cấp sau khi kiểm ghi danh | **Có, ở mức tệp**: token hết hạn, gắn lớp | Thêm nhà cung cấp, khoá API, webhook báo xử lý xong; tính phí theo phút lưu và phút phát. **Chưa kiểm bảng giá** | Đo được phút và dung lượng |

**Khuyến nghị: C làm đích cho video tải lên, bắt đầu từ A.** Lý do: A là cách duy nhất làm ngay không tốn tiền nên Đợt 3A/3C dùng nó; nhưng riêng yêu cầu "gia sư tải video record từ điện thoại, học sinh xem mượt, chỉ người đã ghi danh xem được, đo được dung lượng theo gói" thì chỉ C đáp ứng đủ cả bốn, còn B đáp ứng kém ở băng thông video và quyền xem. Giữ một lớp trừu tượng `VideoStorage` (các hàm: xin chỗ tải, lấy token phát, xoá, đọc dung lượng) để đổi nhà cung cấp mà không đụng giao diện. Tài liệu (PDF/Office/ảnh) vẫn ở Cloudinary nhưng chuyển sang upload có chữ ký và giao hàng có chữ ký (MD-10).

**Cấu hình đề xuất, chủ chốt lại:** tài liệu ≤ 25 MB mỗi tệp, ảnh ≤ 10 MB, video ≤ 90 phút hoặc 2 GB mỗi tệp; kiểm loại bằng magic bytes chứ không tin đuôi tệp; link phát và link tải ký hết hạn sau 60 phút; chỉ gia sư chủ lớp, học viên đã ghi danh vào đúng lớp đó và quản trị được xem; phụ huynh mặc định không xem video. Không quét virus trong đợt này (ghi nhận là rủi ro còn lại).

**Bản quyền và trẻ em:** cam kết sở hữu khi tải lên và quy trình gỡ (MD-11); video buổi học có hình/giọng học sinh dưới 16 tuổi là dữ liệu trẻ em (mục 7).

## 7. CHƯA LÀM - chờ chủ dự án quyết

Danh sách này gồm mọi tính năng mang cờ `chua-lam` ở cột `dinh-tien` hoặc `dinh-tre-em` (51 tính năng). **Không dòng nào được viết mã chuyển tiền, đổi cách tính phiếu hoặc thu thêm dữ liệu trẻ em cho tới khi chủ quyết.** Gom theo điều cần quyết để chủ trả lời một lần cho cả nhóm.

### 7.1 Nơi lưu video tải lên và chi phí

**Điều cần quyết:** Chọn A, B hay C ở mục 6.3, ai trả chi phí lưu và phát (KiN hay gia sư), hạn mức dung lượng theo gói. Nếu chưa quyết, MD-04 giữ trạng thái chưa làm; Đợt 3 vẫn hoàn chỉnh bằng link.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| MD-04 | Tải video record lên kho riêng: tải thẳng từ trình duyệt, thanh tiến trình, tiếp tục khi đứt mạng, hạn mức dung lượng | chua-lam | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: có chi phí hạ tầng theo giờ lưu và phát, và video buổi học có hình/giọng học sinh dưới 16 tuổi. Giao diện tải lên và lớp trừu tượng lưu trữ (VideoStorage) dựng sẵn ở Đợt 3A, bật bằng cờ khi chủ quyết |

### 7.2 Video, ảnh, âm thanh có học sinh dưới 16 tuổi

**Điều cần quyết:** Có cho học sinh nộp ảnh bài làm và cho tải video/ảnh có hình học sinh không, và với điều kiện gì (đồng ý phụ huynh theo PH-225, ngưỡng tuổi D04, gửi dữ liệu ra dịch vụ AI)? Đề xuất tạm: chỉ nhận link dạng chữ; mỗi lần tải lên có hộp xác nhận "không chứa hình/giọng học sinh dưới 16 tuổi hoặc đã có đồng ý của phụ huynh".

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| MD-04 | Tải video record lên kho riêng: tải thẳng từ trình duyệt, thanh tiến trình, tiếp tục khi đứt mạng, hạn mức dung lượng | chua-lam | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: có chi phí hạ tầng theo giờ lưu và phát, và video buổi học có hình/giọng học sinh dưới 16 tuổi. Giao diện tải lên và lớp trừu tượng lưu trữ (VideoStorage) dựng sẵn ở Đợt 3A, bật bằng cờ khi chủ quyết |
| MD-15 | Ảnh bài làm của học sinh (chụp, tải lên) cho bài Azota và quiz tự luận | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: ảnh bài làm của em dưới 16 (PH-225). Bài nộp tệp hiện có giữ nguyên |
| MD-19 | Bản ghi buổi live tự động kéo về từ Zoom/Meet | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: bản ghi chứa hình giọng trẻ. Dán link thủ công (MD-02) vẫn dùng |
| BU-10 | Tệp, ảnh đính kèm theo từng học sinh trong buổi | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: tệp/ảnh gắn một em dưới 16 tuổi |
| BU-15 | AI soạn nháp báo cáo buổi học từ ghi chú và điểm danh | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: gửi dữ liệu học sinh dưới 16 tuổi ra dịch vụ AI ngoài. Hiện suggestUnmetItems chỉ dùng luật, giữ nguyên |
| QZ-15 | AI gợi ý (hint) cho học sinh khi làm bài | chua-lam | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: chi phí AI và gửi bài làm của trẻ ra ngoài |

### 7.3 Hồ sơ và dữ liệu cá nhân của trẻ

**Điều cần quyết:** Có cho gia sư tạo/sửa/nhập hàng loạt hồ sơ trẻ không tài khoản, thu thêm trường (3 SĐT, ghi chú, điểm 0-10 và % BTVN mỗi buổi), danh sách chờ, lead/học thử, form "Yêu cầu tìm gia sư" của khách? Đây là cùng một câu hỏi pháp lý (Nghị định 13/2023, Luật Trẻ em 2016): cần ý kiến luật sư và quyết định có thu hay không.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| LO-06 | Dán danh sách tên từ Excel để tạo hồ sơ nhiều học sinh không tài khoản | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: tạo hồ sơ trẻ mà không qua tài khoản và đồng ý là thu thêm dữ liệu trẻ em. BulkInvite (mã mời + tin cho phụ huynh) vẫn dùng bình thường |
| LO-14 | Duyệt thành viên bằng danh sách chờ xếp lớp (waitlist) | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: hàng chờ lưu thông tin trẻ muốn vào lớp, cùng nhóm với lead (KH-04) |
| LO-17 | Nhập dữ liệu hàng loạt từ CSV hoặc Excel (học sinh và lịch từ công cụ cũ) | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: nhập hàng loạt hồ sơ học sinh là thu dữ liệu trẻ em |
| LO-18 | Trường tuỳ chỉnh cho hồ sơ học sinh | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: dữ liệu tự do về trẻ; đối thủ bán dạng add-on |
| HS-03 | Gia sư sửa thông tin học sinh (ngày sinh, SĐT, địa chỉ, phụ huynh) | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: cho gia sư sửa dữ liệu cá nhân của trẻ. Học sinh tự sửa ở /student/ho-so vẫn dùng |
| HS-04 | Thông tin học sinh mở rộng (ngày bắt đầu, môn, 3 SĐT, email bổ sung, ghi chú) | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: thu thêm dữ liệu trẻ em |
| HS-10 | Trạng thái học sinh Hoạt động / Không hoạt động; Tiềm năng cho lead | khong | chua-lam | Hoạt động/Không hoạt động làm được từ Enrollment. Trạng thái Tiềm năng là lead trẻ: CHƯA LÀM - chờ chủ dự án quyết (cùng KH-04) |
| HS-11 | Loại học sinh Con hay Người lớn gắn người thanh toán | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: gắn với ngưỡng tuổi 16 và đồng ý (D04, PH-225) |
| HS-13 | Wizard thêm học sinh 4 bước | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: nhập hồ sơ trẻ trực tiếp. Lối vào hiện tại (mã mời, ghi danh admin) giữ nguyên |
| BU-11 | Điểm số 0-10 và chip % hoàn thành BTVN cho từng học sinh mỗi buổi | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: thu thêm dữ liệu học lực của trẻ. Điểm bài tập/bài thi đã có vẫn hiển thị ở Sổ điểm |
| DD-10 | Báo đến lớp và ra về cho phụ huynh theo thời gian thực | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: theo dõi vị trí/giờ ra vào của trẻ |
| DD-11 | Điểm danh bằng kiosk, thẻ, vân tay, khuôn mặt | khong | chua-lam | KHÔNG LÀM: dữ liệu sinh trắc học của trẻ, ngoài tầm gia sư tự do |
| KH-04 | Yêu cầu tìm gia sư của khách, tiếp nhận thành lớp, xác nhận và theo dõi; quản lý lead và học thử | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: form thu thông tin trẻ muốn học (ĐX-09, chờ PH-225) |
| PH-07 | Yêu cầu gia sư: xác nhận và theo dõi (phía phụ huynh) | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: cùng KH-04 |

### 7.4 Đồng ý của phụ huynh

**Điều cần quyết:** Bật `pending_consent` và ParentConsent với đồng ý kép cho trẻ từ 7 tuổi (D04 đề xuất ngưỡng 16 và cột `selfConsentAt`)? Chờ luật sư (PH-225).

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| PH-04 | Đồng ý của phụ huynh (ParentConsent, pending_consent) và đồng ý kép cho trẻ từ 7 tuổi | khong | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: chờ luật sư (PH-225), Nghị định 13/2023. D04 đề xuất ngưỡng 16 và cột selfConsentAt |

### 7.5 Cách tính học phí và hình thức học phí

**Điều cần quyết:** Có thêm kiểu tính theo giờ / theo khoá / gói buổi trả trước không? Học phí tự sinh từ buổi đã chốt, hay giữ cách hiện tại (gia sư nhập số buổi tháng)? Đề xuất: giữ nguyên cách tính đang chạy cho tới khi D01 được xác nhận lại; nếu thêm kiểu mới, chỉ áp cho lớp tạo sau và không đụng phiếu đã chốt.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| HP-14 | Phát sinh học phí khi chốt buổi theo ba hình thức (buổi, giờ, khoá) | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: học phí hiện tính theo số buổi tháng do gia sư nhập tay (MonthlyCourseFee), không đổi |
| HP-15 | Chọn hình thức học phí khi tạo lớp (theo giờ, buổi, khoá) và 4 kiểu giá bài học | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: đổi cách tính phiếu |
| HP-16 | Đổi cách tính phí có hiệu lực từ ngày, xem trước tác động, lịch sử đơn giá | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: phiếu đã chốt không bị ảnh hưởng nhưng chưa có màn xem trước |
| HP-17 | Học phí riêng từng học sinh trong lớp (theo cặp học sinh - lớp) | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: TuitionOverride hiện theo em toàn cục |
| HP-18 | Phí khác áp chung cả lớp (tài liệu, quỹ lớp, phí thi) và phí theo kỳ | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: thêm dòng phí vào phiếu |
| HP-19 | Nút Thêm phí khác ngay trong chi tiết lớp | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: phụ thuộc HP-18 |
| HP-24 | Gộp phiếu nhiều lớp hoặc nhiều tháng / khoản rời trong một phiếu | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: hiện đã gộp mọi lớp của một gia sư theo (gia sư, em, tháng) |
| HP-25 | Tạo hoá đơn 2 bước (ngày lập, phạm vi, kiểu hiển thị, ghi chú chân trang) | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết |
| HP-26 | Hoá đơn tự động theo lịch và ghi nợ theo lịch | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: KiN đã chốt tính theo buổi đã dạy |
| HP-31 | Gói buổi trả trước trừ dần theo buổi, sổ sử dụng và thu trước theo gói khoá | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: chưa có model gói buổi. Figma 504:6311 giữ làm đích thiết kế |
| HP-32 | Giảm giá phần trăm cho học sinh; phiếu ghi nợ / điều chỉnh; hoá đơn đơn lẻ có thuế | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: hiện có giảm trừ số tiền và sửa số tiền có lý do |
| DD-09 | Điểm danh 8 trạng thái ghi rõ tính phí | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: đổi trạng thái là đổi cách tính tiền buổi. 4 trạng thái và luồng báo nghỉ 5 trạng thái hiện có giữ nguyên |

### 7.6 Ghi nhận, hoàn tác và nhắc thu tiền

**Điều cần quyết:** Có thêm ngày thu và hình thức vào bản ghi thanh toán, có cho hoàn tác khoản đã thu, có nhận ảnh biên lai (ĐX-08), có hạn đóng + nhắc tự động + phí trễ hạn không? Đề xuất: làm HP-20 và HP-21 trước (sửa nhầm là nhu cầu thật), để HP-27/HP-28 sau và chỉ ở dạng gợi ý bật tắt.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| HP-20 | Xác nhận thủ công đã thu có ô ngày thu và hình thức (tiền mặt / chuyển khoản) | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: đổi bản ghi thanh toán, ảnh hưởng báo cáo doanh thu theo kỳ |
| HP-21 | Hoàn tác khoản đã thu (kèm màn rà soát Giữ nguyên / Xác nhận hoàn tác) và hoàn tác ghép sai | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: sửa trạng thái tiền đã thu |
| HP-22 | Minh chứng chuyển khoản: phụ huynh đính ảnh biên lai, gia sư kiểm tra minh chứng | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: ĐX-08, chỉ làm khi số đo cho thấy cần |
| HP-23 | Chọn một phần buổi hoặc khoản để thu thay vì cả tháng | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết |
| HP-27 | Hạn đóng phiếu, danh sách quá hạn và nhắc đóng học phí tự động qua Zalo / email | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: hạn 'trước ngày 20' đang viết cứng trong tin Zalo, tin vẫn do gia sư tự gửi |
| HP-28 | Phí trễ hạn tự cộng | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: nhạy cảm, chỉ nên là gợi ý bật tắt |
| LO-16 | Bảo lưu học: trạng thái kèm ngày hết hạn, giữ lịch sử | chua-lam | khong | Enrollment suspended có sẵn. Phần giữ công nợ khi bảo lưu là logic tiền: CHƯA LÀM - chờ chủ dự án quyết |

### 7.7 Hồ sơ gia đình và sổ cái gia đình

**Điều cần quyết:** Có dựng hồ sơ gia đình (anh chị em chung phiếu, chung số dư) không? Phụ thuộc 7.3 và 7.5.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| HS-12 | Hồ sơ gia đình dùng chung nhiều học sinh (anh chị em chung phiếu và liên hệ) | chua-lam | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: gộp phiếu theo gia đình là đổi cách lập phiếu và thu dữ liệu quan hệ gia đình của trẻ |
| HP-30 | Số dư trả trước và sổ cái gia đình theo ngày | chua-lam | chua-lam | CHƯA LÀM - chờ chủ dự án quyết: cần hồ sơ gia đình (HS-12) |

### 7.8 Gói Free/Pro, giá và dùng thử

**Điều cần quyết:** Giá và gói miễn phí (bảng PLAN) chưa chốt. Research đề xuất Free 8 học sinh, Pro ~42.000 đ/tháng, chỉ bật khi có ≥ 200 gia sư hoạt động và ≥ 30% vượt hạn mức Free hai tháng liên tiếp. Đề xuất tạm: chỉ ĐO (GO-08) chứ không chặn.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| GO-01 | Gói Miễn phí giới hạn 8 học sinh: chốt chặn và gợi ý nâng cấp | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: bảng PLAN, giá và gói miễn phí chưa chốt |
| GO-02 | Gói Pro không giới hạn học sinh; mở mẫu phiếu theo gói; hạn mức 5 GB | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: hiện isActiveTutorVIP chưa khoá tính năng nào |
| GO-03 | Dùng thử Pro 30 ngày không cần thẻ và nhắc trial sắp hết hạn | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: hiện chỉ có banner miễn phí giai đoạn chạy thử (KIN_TRIAL_MODE). Không thu thẻ |
| GO-04 | Thanh toán gói Quý/Năm cộng dồn hạn, mã giảm giá, ưu đãi theo dịp | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: gói Coin hiện có; D10 chốt gia hạn thủ công |
| GO-05 | Bảng so sánh Free và Pro (trang /pricing công khai) | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: phụ thuộc GO-01 |
| GO-06 | Hỗ trợ ưu tiên cho gói Pro | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết |

### 7.9 Coin và điểm thưởng

**Điều cần quyết:** Coin đã ra khỏi phạm vi (26/09) nhưng mã thưởng vẫn chạy: giữ làm điểm học tập (không đổi ra tiền/quà, không chuyển giữa tài khoản) hay ẩn?

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| SV-12 | Ví Coin và điểm thưởng: giữ làm điểm học tập hay ẩn | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: Coin đã ra khỏi phạm vi (26/09) nhưng mã thưởng vẫn chạy; thưởng bấm xong ẩn tạm. Bỏ lời hứa hoàn học phí 10% trên huy hiệu |

### 7.10 Nhiều giáo viên và thực thể Trung tâm

**Điều cần quyết:** "Trung tâm" chỉ là cách gọi cho nhóm gia sư, hay cần thực thể Tổ chức? Hiện chưa có model Center/Organization và D02 hoãn đồng dạy. Nên chờ có yêu cầu thật.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| QT-10 | Nhiều giáo viên trong một tài khoản, trợ giảng, chấm công, nhiều chi nhánh, thực thể Trung tâm/Tổ chức | chua-lam | khong | CHƯA LÀM - chờ chủ dự án quyết: D02 hoãn có chủ đích; chưa có model Center/Organization |

### 7.11 Không làm (đề xuất loại hẳn)

**Điều cần quyết:** Cổng thẻ, trích nợ tự động, lương, hợp đồng dài hạn/1099, điểm danh sinh trắc học: ngoài mô hình "KiN không giữ học phí" và "một gia sư". Cần chủ xác nhận loại hẳn.

| Mã | Tính năng | Tiền | Trẻ em | Ghi chú |
|---|---|---|---|---|
| HP-36 | Cổng thẻ Stripe/PayPal, trích nợ tự động, lương giáo viên, chi phí - doanh thu khác, hợp đồng dài hạn / agency / 1099 | chua-lam | khong | KHÔNG LÀM: KiN không giữ và không thu hộ tiền; 1099 không áp dụng tại Việt Nam; lương và chi phí khác ngoài mô hình một gia sư |
| DD-11 | Điểm danh bằng kiosk, thẻ, vân tay, khuôn mặt | khong | chua-lam | KHÔNG LÀM: dữ liệu sinh trắc học của trẻ, ngoài tầm gia sư tự do |

### Các tính năng chạm tiền hoặc trẻ em nhưng CHỈ TRÌNH BÀY (làm được trong các đợt)

32 tính năng dính tiền và 38 tính năng dính trẻ em ở mức `trinh-bay`. Điều kiện làm: (1) dùng đúng hàm tính hiện có, không viết công thức mới trong giao diện; (2) có test so khớp số hiển thị với truy vấn gốc, sai lệch 0 đồng; (3) không thêm trường dữ liệu cá nhân của trẻ; (4) mọi ảnh/PDF xuất ra không chứa học phí khi dành cho nhóm chung.

## 8. Vòng R&D lặp và phản biện 3 vai

### 8.1 Cách vận hành "phòng R&D"

Mỗi đợt chạy vòng sau; một vòng không đạt thì lặp lại tới khi đạt hoặc hết ngân sách số vòng (đề xuất tối đa 3 vòng một đợt, sau đó trình chủ quyết).

| Bước | Ai làm | Đầu ra |
|---|---|---|
| 1. Lập kế hoạch đợt | Giám đốc sản phẩm | Danh sách việc của đợt từ CSV, thứ tự, tiêu chí nghiệm thu |
| 2. Xây | Các tác tử làm theo khu vực (một tác tử một khu vực, không hai tác tử sửa cùng tệp) | Mã + test t-*.ts |
| 3. Kiểm | Tác tử kiểm thử | Chạy bộ test local-e2e, đo tràn ngang ở 5 độ rộng, đo tương phản, grep mã màu, so khung Figma; ghi pass/fail từng tiêu chí |
| 4. Phản biện 3 vai | Ba tác tử đóng vai học sinh, gia sư, phụ huynh | Biên bản lỗi xếp mức chặn / nặng / nhẹ, mỗi lỗi có bước tái hiện |
| 5. Sửa | Tác tử xây | Sửa mọi lỗi mức chặn và nặng; lỗi nhẹ ghi vào sổ nợ |
| 6. Lặp bước 3 → 5 | | Dừng khi hai lượt phản biện liên tiếp không còn lỗi chặn và nặng |

Quy tắc để vòng lặp không tự lừa mình: tác tử phản biện **không được đọc mã của tác tử xây**, chỉ dùng giao diện đang chạy; mỗi lỗi phải kèm ảnh chụp hoặc đoạn mô tả bước; không sửa tiêu chí nghiệm thu giữa chừng để cho đạt.

### 8.2 Ba vai và bài kiểm theo nhiệm vụ

Mỗi vai nhận một danh sách nhiệm vụ, **đo thời gian và số chạm**, ghi chỗ bị kẹt. Vì người dùng thật khó dùng được hết thông tin, tiêu chí chung: mỗi màn tối đa 7 mục chính và 3 hành động chính; không có việc thường làm nào sâu quá 3 chạm; tìm không thấy trong 10 giây là lỗi.

| Vai | Thiết bị giả lập | Nhiệm vụ mẫu (đo thời gian và số chạm) |
|---|---|---|
| Học sinh 15 tuổi | iPhone 390px, mạng chậm | Nhập mã lớp lần đầu; tìm bài tập hạn hôm nay và nộp; mở video buổi hôm qua và xem tiếp từ chỗ dở; tải tài liệu của bài; làm quiz 10 câu rồi xem lời giải; tìm lớp khác khi học 2 lớp |
| Gia sư sinh viên 22 tuổi | iPhone 390px và laptop 1440px | Tạo lớp đầu tiên kèm 5 học sinh và lịch 3 buổi/tuần; điểm danh buổi tối nay; chốt buổi; dời một buổi và báo phụ huynh; dán link video record của buổi vừa dạy; tải đề PDF 20 câu thành quiz và giao; lập phiếu học phí tháng và gửi Zalo; tìm ai chưa nộp bài |
| Phụ huynh 40 tuổi | Chrome Android từ link trong Zalo | Mở Sổ của con và thấy ngay tình hình hôm nay; xem báo cáo tháng; biết còn nợ bao nhiêu và chuyển khoản đúng; báo nghỉ một buổi; xem con có làm bài Azota cô giao chưa; vào lại sau một tuần mà vẫn nhận ra là cùng trang |

Mỗi lỗi phản biện phải có: vai, nhiệm vụ, bước tái hiện, mức (chặn / nặng / nhẹ), màn hình, đề xuất. Mẫu lỗi "nhiều thông tin quá tìm không thấy" luôn được ghi là lỗi **nặng** nếu người thử mất hơn 10 giây hoặc hơn 3 chạm cho việc thường làm.

### 8.3 Phản biện sơ bộ trước khi làm (từ mã hiện có)

Đây là các điểm vướng đã biết, lấy vào danh sách nhiệm vụ của vòng đầu:

**Học sinh.** Trang bài giảng nhồi một trang khoảng 1.280 dòng: giáo trình, video, hoàn thành, 3 tab, ghi chú, bài tập tự nộp, bài tương tác; không phân biệt được Tài liệu / Bài tập / Quiz Azota / Bài tập tự nộp. Học liệu rải ở 4 nơi tên giống nhau (Thư viện, trang Lớp, tab Tài liệu, Ngân hàng đề). Học sinh mới chỉ thấy Việc của tôi trống, không có nút Nhập mã lớp. Nút Làm bài Azota hỏng khi bài có 2 link. Hạn Azota không vào lịch. Không có "xem tiếp"; xem chưa xong vẫn hiện là đã xong. Có chữ giả: "Thiết bị 1/2", lượt xem luôn 0.

**Gia sư.** Màn soạn bài là một Drawer với link video, Zoom, Azota, tài liệu, ghi chú, bài tập; loại bài tự suy ra từ ô nào có link; không có "xem như học sinh". Tạo lớp là drawer kiểu khoá học, không có wizard. Lịch tuần là danh sách, không phải lưới giờ. Chưa có trang buổi học và nút Đã dạy xong; "buổi đã dạy" suy ra từ có mặt. Không có Tất cả có mặt. Hộp việc chưa có "Chưa thu" cạnh "Đã thu". Gia sư chưa thấy học sinh nào đã làm bài Azota (phải hỏi qua Zalo). Các tệp lớn (2.380 và 1.970 dòng) khó sửa.

**Phụ huynh.** Sổ của con chưa cho thấy bài tập, điểm, bài Azota con chưa làm. Cần kiểm Sổ của con không lọc buổi theo ngày ≤ hôm nay (lỗi đã thấy ở Sổ Gia Sư). Hạn "trước ngày 20" viết cứng trong tin Zalo. Không có cách đính biên lai. Link Sổ của con không hết hạn.

**Quản trị.** Nạp Coin không có lối vào menu; Nhật ký chỉ ghi không đọc; duyệt gia sư ba lối vào; trang /admin thiên thống kê hơn là việc cần làm; nhắc hàng loạt trải toàn nền tảng; cron mở công khai nếu thiếu CRON_SECRET.

## 9. Thứ tự và phụ thuộc giữa các đợt

```
Đợt 1 (nền HT-01/02 → Hộp việc → Lịch → Lớp → Buổi học/Điểm danh, chốt cột AttendanceSession)
   │
   ├──► Đợt 2 (học sinh, học phí trình bày)        dùng HT-01/02
   ├──► Đợt 3 (an ninh học liệu → FileAsset → bản ghi → quiz)   dùng bản ghi buổi để gắn video
   │        └─ 3F tải video lên: CHỜ quyết định mục 7.1, 7.2
   └──► Đợt 4 (phụ huynh, khách, quản trị, phân tích)   dùng buổi chốt, ghi chép buổi (Đợt 1) và tiến độ học liệu (Đợt 3)
Đợt 5 (Google, gom kho câu hỏi) chỉ sau khi Đợt 1-4 ổn
```

Việc làm **ngay hôm nay**, không phụ thuộc đợt nào và không cần quyết định: MD-03, MD-09, QZ-14, MD-06, MD-16, và sửa href Azota khi có 2 link (MD-14). Đây đều là sửa lỗi nhỏ hoặc vá bảo mật có thể giao cho một tác tử riêng.

## 10. Điều chưa kiểm chứng

- Hai trong bốn mảng kiểm toán không đến được; phần học sinh / phụ huynh / khách / quản trị / media / quiz dựng lại từ HIEN-CO-VA-DINH-VI.md (mục 2).
- Chưa mở từng khung Figma; ánh xạ theo tên khung. Khung "KiN · Bản đồ tính năng và phạm vi" (464:9782, 3.192 px cao) chưa đọc: nên đọc đầu tiên vì có thể cho biết phạm vi chính thức.
- Chưa chạy thử khai thác `/xem-tai-lieu` với scheme lạ; chưa kiểm giới hạn thật của gói Cloudinary đang dùng; chưa kiểm giá các dịch vụ video; chưa biết Azota có xuất điểm hay API không (không giả định).
- Ước lượng công sức là thô. Một số "mot-phan" có thể thực ra đã gần xong.
- Tên bảng/cột ở mục 6 là đề xuất, chưa đối chiếu `prisma/schema.prisma` từng dòng.

