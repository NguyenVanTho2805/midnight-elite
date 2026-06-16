# CHỨC NĂNG 6: PHÂN HỆ QUẢN TRỊ LỚP & VẬN HÀNH NỘI BỘ

> **Nguồn gốc:** Tài liệu Midnight Class — Lớp quản trị vận hành thực tế đặt trên nền tảng TSIX Education.
> Đây là lớp **Quản lý & Điều hành** ngồi trên 5 chức năng kỹ thuật phía trên, biến hệ thống thành một lớp học được vận hành chuyên nghiệp.

---

## 1. Quản trị Hồ sơ & Danh mục Học sinh (Student Portfolio Management)

Mỗi học sinh không chỉ là một cái tên, mà là một **Data Profile** được theo dõi liên tục.

### Cấu trúc Database Hồ sơ Học sinh

| Nhóm dữ liệu | Các trường |
|---|---|
| **Thông tin cơ bản** | Mã HS, Tên, SĐT, SĐT Phụ huynh, Email (liên kết Drive) |
| **Chỉ số Học thuật** | Điểm đầu vào (Baseline Score), GPA cập nhật theo tuần/tháng (lấy từ Azota), Tỷ lệ hoàn thành bài tập (Completion Rate %) |
| **Trạng thái phân loại** | 🟢 An toàn / 🟡 Cảnh báo / 🔴 Báo động |

**Tiêu chí phân loại tự động:**

- 🟢 **Nhóm An toàn:** Hoàn thành >90% bài tập, điểm >7.5
- 🟡 **Nhóm Cảnh báo (Warning):** Trễ deadline 1–2 lần hoặc điểm giảm trong 2 bài test liên tiếp
- 🔴 **Nhóm Báo động (Danger):** Điểm dưới 5, bị dính gậy kỷ luật

### Trực quan hóa Dữ liệu (Dashboarding)

Dữ liệu điểm xuất từ Azota (CSV/Excel) sau khi đẩy vào Database cần được trực quan hóa. Có thể dùng:
- **Trang Admin Dashboard** trực tiếp trên Web
- **Power BI** hoặc **Excel Dashboard** để vẽ biểu đồ xu hướng (trendline) điểm số từng học sinh

---

## 2. Quản trị Tài nguyên: Web Up Tài liệu & Record (Drive 5TB Integration)

### Kiến trúc Lưu trữ

**Trên Drive 5TB:**

```
Năm học → Môn học → Chuyên đề → [Tài liệu PDF] / [Video Record] / [Bài tập]
```

> Toàn bộ file **tắt tính năng Download/Print**, chỉ cho phép **View**.

**Trên Website (Giao diện Học sinh):**

| Khu vực | Mô tả |
|---|---|
| **Kho Record (Replay Vault)** | Chứa video record Google Meet, cấu trúc theo timeline (Ngày/Tháng). Hệ thống lưu "Last watched" để học sinh tiện theo dõi tiếp. |
| **Trung tâm Tài liệu (Doc Center)** | Nhúng (Embed) iframe các file PDF từ Drive. Có nút "Đánh dấu đã đọc" để tính % tiến độ học tập. |
| **Link Azota gắn kèm** | Dưới mỗi iframe Record/Tài liệu có nút API link trực tiếp tới bài Test tương ứng trên Azota. |

---

## 3. Hệ thống Kỷ luật (Strike) & Khen thưởng (Gamification)

### Cơ chế Kỷ luật — Strike System

| Mức | Trigger | Action tự động |
|---|---|---|
| 🟡 **Gậy 1** (Cảnh cáo nhẹ) | Trễ deadline trên Azota **HOẶC** điểm kiểm tra < 4.0 | Web bật Popup cảnh báo đỏ khi đăng nhập; Chatbot/hệ thống tự động gửi tin Zalo/Email yêu cầu làm bài bù |
| 🟠 **Gậy 2** (Cảnh cáo nặng) | Vi phạm lần 2 trong tháng | Gửi thông báo khẩn cấp tới SĐT Phụ huynh kèm báo cáo điểm chi tiết; Khóa tạm tính năng xem Record đến khi hoàn thành bài phạt |
| 🔴 **Gậy 3** (Đình chỉ / Banned) | Vi phạm lần 3 | Tài khoản chuyển trạng thái `Suspended`; Thu hồi quyền truy cập Drive, ẩn link Google Meet; Phải nộp phạt hoặc làm cam kết mới được mở lại |

### Cơ chế Khen thưởng & Học bổng (Gamification)

- **Thưởng Ngắn hạn (EXP):** Nộp bài sớm trước 12h, điểm Azota > 8.5 → Tự động cộng "Điểm năng nổ" vào Hồ sơ trên Web.
- **Học bổng Tháng (Monthly Scholarship):** Cuối tháng, hệ thống tự động lọc **Top 3 học sinh** có GPA cao nhất và không dính gậy → Cấp Badge "Học viên Xuất sắc" + hoàn lại một phần học phí để tạo động lực đua Top.

---

## 4. Tích hợp Chatbot & Vòng lặp Cải thiện Điểm số

### Vai trò của Chatbot (Nhúng trên Web/Zalo)

Chatbot đóng vai trò **"Trợ lý Vận hành"** (Operation Assistant), không chỉ trả lời bài tập:

| Vai trò | Ví dụ |
|---|---|
| **Nhắc nhở tự động** | *"Chỉ còn 4 tiếng nữa là đóng link Azota bài Khảo sát hàm số, hệ thống ghi nhận bạn chưa làm, hãy hoàn thành ngay để tránh Gậy 1."* |
| **Tra cứu điểm số** | Phụ huynh/Học sinh nhắn: *"Tra cứu điểm môn Toán tuần 2"* → Bot trả về kết quả từ Database |
| **Support Tài liệu (RAG)** | Thay vì hỏi xin link cũ, Bot đọc từ kho Drive và trả về: *"Tài liệu bạn tìm nằm ở Chuyên đề 2, truy cập link này trên Web nhé."* |

### Vòng lặp Cải thiện Điểm số (Tác vụ Vận hành)

Khi hệ thống xác định học sinh rơi vào 🔴 **Nhóm Báo động** (GPA < 5.0):

```
Phát hiện (Hệ thống: GPA < 5.0)
    ↓
Cách ly (Web): Mở khóa module tài liệu "Lấy lại gốc" dành riêng cho học sinh này
    ↓
Giao việc (Azota): Tự động assign bài Test phục hồi mức độ Dễ
    ↓
Đánh giá lại:
    ✅ Pass → Xóa trạng thái Báo động
    ❌ Fail → Báo notification cho Admin → Gọi điện can thiệp trực tiếp
```

---

## 5. Góc độ Quản lý — Những gì Owner cần làm

### Năng lực cốt lõi của Người quản lý

- **Thiết kế Trải nghiệm Học tập (User Journey Mapping):** Đảm bảo luồng đi không có điểm nghẽn. Từ click vào Website → xem Video/Tài liệu → nhảy sang Azota → nhận kết quả → tự động cộng thẻ phạt hoặc thưởng điểm. Mọi thứ phải mượt mà và khép kín.

- **Kiểm soát Chất lượng Lõi (Quality Assurance):** Trực tiếp đứng lớp Live môn Toán và Lịch sử (mũi nhọn tạo doanh thu và uy tín). Với môn Tiếng Anh và Địa lý, đóng vai "Tổng biên tập" — duyệt outline giáo án của partner/trợ giảng trước khi cho phép giảng dạy.

- **Ra quyết định dựa trên Dữ liệu (Data-Driven):** Nếu hệ thống báo 40% học sinh trễ deadline ở tuần thứ 3, phải ngay lập tức lên Live "thiết quân luật" hoặc mở Mini-challenge thưởng điểm để kéo lại nhịp độ.

- **Chuẩn hóa Quy trình (SOPs):** Viết ra từng bước làm việc cho các vị trí. Ví dụ: SOP hướng dẫn Trợ giảng xuất file CSV từ Azota lên Web mỗi tối Thứ 6.

### Chỉ số Vận hành cần theo dõi

| Chỉ số | Ý nghĩa |
|---|---|
| **Completion Rate (Tỷ lệ nộp bài)** | Chỉ số quan trọng nhất. Phản ánh độ lười học sinh và hiệu quả kỷ luật |
| **GPA theo chu kỳ** | Phát hiện sớm cá nhân tụt dốc liên tục 2–3 bài test → Đưa vào "Báo động đỏ" |
| **Attendance Rate (Tỷ lệ đi học Live)** | Điểm danh tự động qua Google Meet |
| **Response Time của Trợ giảng** | Đo thời gian phản hồi khi học sinh hỏi bài trên Zalo/Telegram |
| **Retention Rate** | Gắn KPI lương thưởng trợ giảng trực tiếp vào tỷ lệ giữ chân học sinh của nhóm lớp họ phụ trách |

---

## 6. Góc độ Người dạy — Admin Dashboard & Công cụ

### Phân hệ Admin (Giao diện Người quản lý/Giảng viên)

Mục tiêu: **đánh giá tổng quan sức khỏe lớp học** và **nhận diện rủi ro** để ra quyết định can thiệp ngay.

| Widget / Chỉ số | Mô tả |
|---|---|
| **System Health** | Tổng số học sinh Active, số học sinh Cảnh báo (1–2 gậy), số Đình chỉ (Banned) |
| **Completion Rate** | Biểu đồ tròn/thanh tỷ lệ % học sinh hoàn thành bài test trước deadline. Nếu < 80% → Lớp đang lười tập thể |
| **Score Distribution** | Biểu đồ phổ điểm sau khi import CSV từ Azota. Đỉnh lệch về 4–5 điểm → Đề quá khó hoặc chưa dạy kỹ phần đó |
| **Danger Zone List** | Danh sách tự động lọc học sinh có GPA < 5.0 trong 2 tuần liên tiếp hoặc vừa bị cộng gậy → Bốc máy gọi điện can thiệp |
| **Action Tools** | Nút Upload file điểm Azota, form cộng/trừ EXP thủ công, nút mở khóa tài liệu mới trên Drive |

### Tech Stack Vận hành Thực chiến

| Hạng mục | Công cụ đề xuất | Cách ứng dụng |
|---|---|---|
| **Trung tâm Điều khiển (Hub)** | Website tự code | Nơi lưu Database học viên, cập nhật thẻ phạt, xếp hạng, nhúng mọi tài nguyên |
| **Đánh giá & Khảo thí** | Azota VIP | Chuyên biệt hóa test, trộn đề, chống gian lận, tự động chấm điểm |
| **BI Dashboard** | Power BI / Excel nâng cao | Kéo dữ liệu CSV từ Azota → Dashboard biểu đồ xu hướng theo dõi toàn khóa |
| **Giao tiếp & Tự động hóa** | Zalo OA / Telegram Bots | Kịch bản thông báo tự động khi học sinh dính thẻ vàng; Quản lý nhóm lớp |
| **Lưu trữ & Truyền phát** | Google Drive 5TB + Google Meet | Drive làm Server backend (gắn quyền truy cập bằng email); Meet tự động record đẩy vào Drive |

---

## 7. Góc độ Học sinh — Dashboard Layout & UX

### Bố cục Tổng thể (3 phân khu)

#### Khu vực 1 — Thanh Báo Động & Hành Động Nhanh (Top Banner)

Nằm trên cùng, thay đổi linh hoạt theo thời gian thực:

| Trạng thái | Hiển thị |
|---|---|
| **Khi có lịch học** | Banner đỏ rực + Đồng hồ đếm ngược + Nút **[VÀO LỚP LIVE NGAY]** |
| **Khi có deadline cận** | *"Bạn còn 4 tiếng để hoàn thành Quiz Khảo sát hàm số"* + Nút **[LÀM BÀI TRÊN AZOTA]** |

> **Nguyên lý UX:** Xóa bỏ hoàn toàn việc học sinh phải tự nhớ lịch hay mò link. Hệ thống "dí" việc vào tận mặt.

#### Khu vực 2 — Hồ sơ Sinh tồn (Left Sidebar / Top Widget)

| Widget | Nội dung |
|---|---|
| **Thanh Kỷ luật (Strikes)** | 3 biểu tượng ngôi sao/trái tim. Dính 1 gậy → 1 biểu tượng chuyển xám/đỏ gạch chéo |
| **GPA & Target Band** | Số lớn hiển thị Điểm hiện tại / Điểm mục tiêu (VD: **7.5 / 8.5**). Nếu thấp hơn mục tiêu → Số chuyển màu Cam cảnh báo |
| **Rank & EXP** | Huy hiệu hạng (Tân binh/Chiến thần) + Progress bar lên cấp tiếp theo |

#### Khu vực 3 — Lộ trình Học tập (Main Body)

Dạng thẻ (Card UI) theo từng Tuần học, chỉ hiển thị Tuần hiện tại và Tuần tiếp theo. Mỗi thẻ bài học gồm:

- Tên chuyên đề
- Nút **[Xem Lý Thuyết]** → Mở iframe nhúng video từ Drive
- Nút **[Làm Bài Tập]** → Link Azota, với 4 trạng thái màu:
  - ⬜ Xám → Chưa mở
  - 🔵 Xanh dương → Đang mở
  - 🟢 Xanh lá → Đã nộp
  - 🔴 Đỏ → Trễ deadline

### Luồng Trải nghiệm Khép kín (Frictionless Flow)

```
1. Mở khóa Nội dung
   Bấm vào Card → Popup video bài giảng (Drive) ngay giữa màn hình
   + PDF nhúng sẵn bên dưới → Không bị đẩy sang tab khác

2. Chuyển giao Bài tập
   Xem xong Video → Màn hình làm mờ → Nút duy nhất:
   "Chuyển sang Azota làm Daily Quiz"
   → Click → Dẫn thẳng đến đúng bài test, không cần nhập mã lớp

3. Cập nhật Kết quả (Feedback Loop)
   Sau khi submit trên Azota → Quay lại Website →
   Thẻ bài học hiển thị điểm số + Tự động tick xanh hoàn thành
```

### Tối ưu UI/UX Kỹ thuật (Dành cho Dev)

| Yêu cầu | Chi tiết |
|---|---|
| **Mobile-First** | 80% học sinh mở web bằng điện thoại. Dùng **Bottom Navigation Bar** (giống Shopee/TikTok) thay vì menu ngang |
| **Iframe gọn gàng** | Ẩn thanh công cụ Google bằng tham số URL `&rm=minimal`. Đóng khung iframe tỷ lệ chuẩn **16:9** |
| **SPA (Single Page Application)** | Build bằng React/Vue. Chuyển tab "Toán" → "Sử" phải tải ngay lập tức, không bị trắng trang |

### Bảng đối chiếu Admin vs User Dashboard

| Loại dữ liệu | Admin xem | Học sinh xem |
|---|---|---|
| **Bảng điểm** | Phổ điểm cả lớp, GPA toàn khóa, tỷ lệ đạt target | Chỉ điểm cá nhân và đường xu hướng so với điểm mục tiêu |
| **Kỷ luật** | Danh sách vi phạm, lịch sử cộng/trừ gậy toàn hệ thống | Số gậy đang chịu, lý do và cách gỡ phạt |
| **Tài liệu/Video** | Quản lý quyền truy cập (mở/khóa iframe), thống kê lượt xem | Chỉ xem nội dung được cấp quyền, hiển thị tiến độ học (%) |
| **Lịch trình** | Form cài lịch Google Meet, form tạo bài tập gắn link Azota | Đồng hồ đếm ngược deadline, nút "Tham gia lớp Live" sáng khi đến giờ |
