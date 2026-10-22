# Báo cáo research: Sổ Gia Sư (sogiasu.com) và 14 nền tảng tham khảo — bản chữ (không ảnh)

> Bản 2.1, khảo sát ngày 19/10/2026 bằng tài khoản thật (sogiasu, TutorBird, Teachworks, Preply, Wyzant, Shub) và nguồn công khai.
> Đưa vào kho theo quyết định Q8 (Nâng cấp lần 1) để trích dẫn. File .docx gốc có 129 trang và 71 ảnh; bản này chỉ giữ chữ, chú thích ảnh giữ nguyên dạng "Hình N – …" để đối chiếu.
> **Lưu ý khi đọc:** mục 8 viết cho một sản phẩm giả định đang đuổi kịp Sổ Gia Sư; `docs/kin/ke-hoach-phat-trien-tu-research.md` mục 2 và 6 liệt kê những đề xuất KiN đã có hoặc cố ý không làm.

BÁO CÁO SẢN PHẨM

**Sổ Gia Sư (sogiasu.com)**

Giao diện tĩnh · Cơ chế vận hành · Điểm nghẽn · Định hướng sản phẩm

và đối chiếu 14 nền tảng tham khảo trong và ngoài nước

Nhóm SaaS quản lý lớp: TutorBird · Teachworks · Teach 'n Go · TutorCruncher · Comiru (Nhật) · ClassUp (Hàn) · Eduspace · Shub Classroom

Nhóm sàn trung gian: Preply · Superprof · Wyzant · italki · Daykemtainha.vn · Snapask · Ruangguru

Bản 2.1 (định hướng sản phẩm – đã chốt mọi điểm mở) · Ngày khảo sát: 19/10/2026 · Phương pháp: thao tác thật trên tài khoản (sogiasu, TutorBird, Teachworks, Preply, Wyzant, Shub) + nghiên cứu nguồn công khai

Ảnh Sổ Gia Sư/Preply/Wyzant dựng lại từ DOM thật (html2canvas); ảnh TutorBird/Teachworks là ảnh chụp màn hình trực tiếp; độ rộng 1040px


## 1. Tóm tắt điều hành

Sổ Gia Sư không phải sàn trung gian ghép gia sư với học viên. Nó là một phần mềm quản trị (SaaS) cho gia sư cá nhân và giáo viên dạy thêm: xếp lịch, điểm danh từng buổi, tự cộng học phí, sinh phiếu thu kèm mã QR chuyển khoản, và gửi phụ huynh một link báo cáo không cần đăng nhập. Toàn bộ sản phẩm được thiết kế quanh một vòng lặp duy nhất: Tạo lớp → Buổi học → Điểm danh → Phí phát sinh → Phiếu thu QR → Thu tiền → Báo cáo phụ huynh.

**Mười phát hiện quan trọng nhất**

1.  **Mô hình dữ liệu rất gọn:** Lớp (class) → Buổi (lesson) → Điểm danh (attendance) → Khoản phí (fee) → Phiếu (receipt) → Khoản thu (payment). Học sinh thuộc lớp với ngày vào lớp và mức phí riêng. Không có khái niệm "gia đình", "dịch vụ", "địa điểm" như TutorBird/Teachworks.

2.  **Phí chỉ phát sinh khi giáo viên bấm "Đã dạy xong":** đây là khác biệt căn bản so với TutorBird (tính phí ngay khi lên lịch) và Teachworks (tính theo lượt học sinh/buổi). Cách này bám sát thói quen "dạy xong mới tính tiền" của gia sư Việt Nam, nhưng tạo nghẽn: quên bấm là không có phí, không có báo cáo.

3.  **Phiếu thu QR là tính năng đinh:** 9 mẫu phiếu (4 Free, 5 Pro), QR VietQR sinh từ số tài khoản ngân hàng cấu hình một lần, nội dung chuyển khoản điền sẵn, xuất ảnh để gửi Zalo. Đối soát chuyển khoản tự động được quảng cáo "sắp có" (Pro). Không có cổng thanh toán, không thu phí giao dịch – đúng "khoảng trống thứ ba" mà nghiên cứu Gemini trước của bạn đã chỉ ra.

4.  **Kênh phân phối báo cáo là link + Zalo, không phải app phụ huynh:** mỗi học sinh một URL cố định dạng /report/\<giáo viên\>/\<học sinh\>, bật/tắt được, hiển thị lịch tháng và nội dung từng buổi, có nút Tải PDF. Không hiện học phí trên trang phụ huynh.

5.  **Giá rẻ hơn mọi đối thủ quốc tế từ 10 đến 50 lần:** Pro ≈ 42.000đ/tháng (trả năm 499.000đ) hoặc 179.000đ/quý; Free giới hạn 8 học sinh, 4 mẫu phiếu, 50MB. So với TutorBird 16,95 USD (~432.000đ), Teachworks từ 16,49 USD + 0,32 USD/học sinh/buổi, Teach 'n Go 69 EUR, TutorCruncher từ 25 GBP, Eduspace 390.000đ (gói Small, 100 học viên).

6.  **Onboarding cực ngắn:** tạo lớp 3 bước trong một màn, dán danh sách học sinh từ Excel vào ô tên, chọn thứ trong tuần và số tuần là có ngay 8 buổi. TutorBird cần 4 bước thêm học sinh + thêm bài học riêng; Teachworks bắt buộc có Giáo viên, Dịch vụ, Địa điểm trước khi lên lịch (checklist 8 bước).

7.  **Điểm nghẽn kỹ thuật/UX đã quan sát được (chi tiết mục 3.6):** "Hình thức học phí" khoá cứng sau khi tạo lớp; trang phụ huynh báo "Chưa có buổi học nào" dù buổi 20/10 đã được chốt (lọc theo ngày ≤ hôm nay, không theo trạng thái); không có app native (PWA); chưa có đối soát; không có nhắc lịch tự động cho phụ huynh/học sinh qua Zalo/SMS; không có quản lý nhiều giáo viên/trợ giảng; bảng điểm danh tháng không xuất được PDF, chỉ Excel.

8.  **Phân tích doanh thu khá tốt cho một công cụ nhỏ:** Đã thu / Chưa thu / Tiềm năng / Tỷ lệ thu theo lớp và theo tháng, biểu đồ buổi theo trạng thái; cách tính "tiềm năng" được giải thích minh bạch ngay dưới biểu đồ.

9.  **Đối thủ cùng loại ở Việt Nam gần như trống:** Shub Classroom là LMS giao bài/thi online cho trường học (không điểm danh, không học phí); Eduspace nhắm trung tâm (CRM, lương, Zalo OA) với giá 390.000đ+. Chưa thấy sản phẩm Việt nào khác làm đúng "sổ tay gia sư + QR".

10. **Sàn trung gian quốc tế vận hành bằng hoa hồng rất cao và lấy "buổi thử" làm phễu:** Preply 33%→18% + 100% buổi thử + phí xử lý phía học viên; Wyzant 25% gia sư + 9% học viên; italki 15–30% theo gói; Superprof thu học viên "Student Pass" (49 USD/tháng ở Mỹ) và miễn hoa hồng; Daykemtainha thu gia sư 10–30% học phí tháng đầu một lần, không có cơ chế quản lý lớp.

## 2. Phạm vi và phương pháp

### 2.1 Những gì đã làm trên Sổ Gia Sư

- Đăng nhập bằng tài khoản thật của bạn (Google OAuth, đang dùng thử Pro 30 ngày, hết hạn 20/10/2026) qua Chrome.

- Tạo lớp thật "Lớp TEST Claude - xoá sau": phí theo buổi, 1 học sinh mới "Học sinh TEST A" 200.000đ/buổi, lịch Thứ Ba + Thứ Năm 18:00–19:30, 4 tuần → hệ thống sinh 8 buổi.

- Đi hết vòng đời một buổi: mở buổi 20/10 → "Đã dạy xong" → phí 200.000đ phát sinh → tạo phiếu học phí (xem 9 mẫu) → xuất phiếu hàng loạt → "Đã thu tiền" → xem Lịch sử thu → "Hoàn tác" → phí quay về Chưa thu.

- Bật chia sẻ báo cáo phụ huynh, mở link công khai, tải ảnh báo cáo PNG do app tự xuất.

- Chụp toàn bộ màn hình dashboard (28 ảnh) + đọc DOM/văn bản từng trang; thử validation form rỗng; thử chuyển đổi 3 hình thức học phí; đọc trang chủ, bảng giá, FAQ công khai.

### 2.2 Những gì đã làm trên các bên tham khảo

| **Nền tảng**                                              | **Nhóm**       | **Mức độ tiếp cận**                                                                                                           | **Ảnh trong báo cáo**                                                  |
|-----------------------------------------------------------|----------------|-------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| TutorBird (Canada/Mỹ)                                     | SaaS gia sư    | Vào bên trong tài khoản dùng thử của bạn: thêm học sinh 4 bước, lên lịch, điểm danh, ghi chú, tài khoản gia đình, tạo hoá đơn | Trang chủ (html2canvas không dựng được màn trong app – mô tả bằng chữ) |
| Teachworks (Canada)                                       | SaaS trung tâm | Vào bên trong tài khoản dùng thử (awdawdas.teachworks.com): dashboard, menu, thêm bài học, thêm học sinh, tạo hoá đơn, lịch   | Trang chủ + dashboard                                                  |
| Preply                                                    | Sàn            | Đăng nhập Google vai học viên: tìm kiếm, hồ sơ gia sư, đặt buổi thử, trang checkout (dừng trước thanh toán)                   | 8 ảnh                                                                  |
| Wyzant (Mỹ)                                               | Sàn            | Đăng nhập Google vai học viên: ghép môn, hồ sơ gia sư, dashboard học viên                                                     | 2 ảnh                                                                  |
| Shub Classroom (VN)                                       | LMS trường học | Đăng nhập vai học sinh (bạn không có tài khoản giáo viên); phía giáo viên lấy từ hướng dẫn ĐH Cần Thơ + báo chí               | 3 ảnh                                                                  |
| Superprof.vn, Daykemtainha.vn, Teach 'n Go, TutorCruncher | Sàn / SaaS     | Trang công khai + nguồn chính thức                                                                                            | Trang chủ (Daykemtainha dựng ảnh thất bại – mô tả chữ)                 |
| italki, Comiru, ClassUp, Eduspace, Snapask, Ruangguru     | Sàn / SaaS     | Nguồn chính thức, báo cáo chứng khoán (Comiru), help center, review                                                           | Không có ảnh                                                           |

### 2.3 Giới hạn của báo cáo

- Ảnh các màn trong app TutorBird và trang chủ/bảng giá công khai của Sổ Gia Sư không dựng lại được bằng html2canvas (web component, hiệu ứng cuộn) – các phần này được mô tả bằng chữ từ những gì đã nhìn thấy trực tiếp.

- Số liệu quy mô của các hãng là số tự công bố, được đánh dấu rõ. Chỗ nào nguồn mâu thuẫn, báo cáo nêu cả hai và không chọn thay bạn.

- Tài khoản Sổ Gia Sư của bạn vẫn còn dữ liệu test (lớp, học sinh, 8 buổi, 1 khoản phí chưa thu, link chia sẻ đang bật). Tài khoản TutorBird còn 1 học sinh "Test Student" + 1 buổi 19/10 (30 USD nợ). Preply và Wyzant đã tạo tài khoản học viên mới bằng Google. Xem Phụ lục C để dọn.

## 3. Sổ Gia Sư – hồ sơ sản phẩm chi tiết

### 3.1 Định vị, đối tượng và mô hình kinh doanh

**Tagline trang chủ:** "Từ lịch dạy, điểm danh tới phiếu học phí kèm mã QR" – "Cuốn sổ tay và file Excel bạn vẫn dùng, giờ nằm gọn trong một app". Nhãn ngay trên tiêu đề: "Dành cho gia sư & giáo viên dạy thêm".

**Ba nhóm khách hàng tự khai:** (1) gia sư cá nhân dạy tại nhà, mỗi em một lịch một mức phí; (2) giáo viên tự mở lớp nhóm 5–20 học sinh; (3) người dạy đa môn nhiều ca trong tuần. Không nhắm trung tâm có nhiều giáo viên – trong app không có khái niệm nhân viên/giáo viên thứ hai.

**Sáu "nỗi đau" trang chủ liệt kê:** cộng tay từng buổi để tính phí cuối tháng; gõ lại số tài khoản và số tiền cho từng phụ huynh; tra lại tin nhắn để biết ai nghỉ buổi nào, nợ bao nhiêu; nhầm lịch khi nhiều ca; không biết doanh thu tháng và lớp nào đóng góp nhiều; không nhớ nội dung từng buổi khi phụ huynh hỏi.

**Bảng giá và giới hạn gói (đọc từ /pricing và /dashboard/billing)**

| **Hạng mục**                                                                                        | **Miễn phí**                                                                                                                 | **Pro**                                                                                                                                |
|-----------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Giá                                                                                                 | 0đ                                                                                                                           | ~42.000đ/tháng nếu trả năm (499.000đ/12 tháng, tiết kiệm 217.000đ) · 179.000đ/quý (~60.000đ/tháng). Gia hạn cộng dồn vào hạn hiện tại. |
| Dùng thử                                                                                            | Trọn bộ Pro 30 ngày, không cần thẻ; hết hạn tự về Free, giữ nguyên dữ liệu                                                   |                                                                                                                                        |
| Học sinh                                                                                            | 8                                                                                                                            | Không giới hạn                                                                                                                         |
| Mẫu hoá đơn QR thu học phí                                                                          | 4 mẫu (Cơ bản, Tối giản, Biên nhận, Chuyên nghiệp…)                                                                          | Tất cả (thêm Sang trọng, Thân gửi, Bé yêu, Mùa hè, Mùa thu, Trung Thu)                                                                 |
| Lưu trữ tài liệu                                                                                    | 50 MB                                                                                                                        | 5 GB                                                                                                                                   |
| Đính kèm từ Google Drive                                                                            | Không                                                                                                                        | Có                                                                                                                                     |
| Đối soát chuyển khoản vào học phí                                                                   | Không                                                                                                                        | Có – ghi "sắp có"                                                                                                                      |
| Hỗ trợ ưu tiên                                                                                      | Không                                                                                                                        | Có                                                                                                                                     |
| Lớp, buổi, điểm danh · Học phí đã đóng/còn nợ · Báo cáo phụ huynh qua link · Google Calendar + Meet | Có                                                                                                                           | Có                                                                                                                                     |
| Khuyến mãi quan sát được                                                                            | Banner "Giảm 20% · Chúc mừng ngày phụ nữ Việt Nam 20/10 · tối đa 40.000đ", mã PHU_NU_VN_20_10, hiện trên mọi trang dashboard |                                                                                                                                        |
| Thanh toán gói                                                                                      | Nút "Thanh toán" (chưa bấm); lịch sử thanh toán hiện dòng "Dùng thử 30 ngày – Thành công"                                    |                                                                                                                                        |

*Nhận xét:* mức 42.000đ/tháng nằm dưới cả ngưỡng 150.000–500.000đ mà nghiên cứu Gemini trước ước tính là "chấp nhận được" cho cơ sở 25 học sinh. Giới hạn 8 học sinh ở gói Free chính là chốt chặn chuyển đổi: một gia sư có 2 lớp nhóm nhỏ là vượt ngay.

### 3.2 Kiến trúc thông tin và khung giao diện chung

Dashboard là ứng dụng web đơn trang (Next.js, Tailwind v4 với màu oklch), bố cục hai cột: sidebar trái cố định 248px, vùng nội dung tối đa ~1040px. Trên cùng có thanh khuyến mãi tím, thanh công cụ với nút thu gọn sidebar, nút nền tối, chọn ngôn ngữ (Tiếng Việt/English), avatar + tên + email + nhãn gói (Pro).

| **Nhóm menu** | **Mục**                                             | **Route**                                       | **Việc chính**                                                                                                                |
|---------------|-----------------------------------------------------|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| (đầu)         | Tổng quan                                           | /dashboard                                      | Lời chào theo giờ, buổi chưa hoàn thành, 5 thẻ KPI, lịch hôm nay, lịch sắp tới                                                |
|               | Lịch dạy                                            | /dashboard/calendar                             | Lịch 3 ngày/tuần/tháng, bộ lọc, chia sẻ lịch; bấm buổi mở modal điểm danh                                                     |
|               | Phân tích                                           | /dashboard/analytics                            | Đã thu/Chưa thu/Tiềm năng/Tỷ lệ thu; biểu đồ buổi và doanh thu theo lớp                                                       |
| Quản lý       | Lớp học                                             | /dashboard/classes, /classes/new, /classes/{id} | Danh sách, tạo lớp 3 bước, chi tiết lớp (buổi, học sinh, phí khác, link báo cáo, kết thúc/xoá)                                |
|               | Học sinh                                            | /dashboard/students, /students/{id}             | Danh sách (lọc Đang học/Đã nghỉ), chia sẻ báo cáo, chi tiết (phí chưa thu, thông tin, lớp đang học, buổi đã học, đã nghỉ/xoá) |
|               | Điểm danh                                           | /dashboard/attendance                           | Lưới học sinh × ngày theo tháng, chọn lớp, xuất Excel                                                                         |
|               | Học phí                                             | /dashboard/fees?tab=pending\|history            | Chưa thu (tạo phiếu, đã thu tiền, tạo nhiều phiếu, gộp phiếu) · Lịch sử thu (hoàn tác)                                        |
|               | Quản lý tệp                                         | /dashboard/storage                              | Thư mục theo lớp học; "Kho tài liệu" sắp có; thanh dung lượng                                                                 |
| Hệ thống      | Cài đặt & Profile                                   | /dashboard/profile                              | Tên, cách đăng nhập, tài khoản ngân hàng (15 ngân hàng) để sinh QR, đặt mật khẩu                                              |
|               | Kết nối                                             | /dashboard/connections                          | Google Calendar + Meet, Google Drive                                                                                          |
|               | Gói của bạn                                         | /dashboard/billing                              | Gói hiện tại, hạn mức, so sánh Free/Pro, đơn hàng, mã giảm giá, lịch sử                                                       |
| Hỗ trợ        | Cài đặt app · Gửi email · Nhắn tin Page · Nhóm Zalo | blog, mailto, m.me, zalo.me                     | PWA hướng dẫn cài lên màn hình chính; support@sogiasu.com; Messenger; nhóm Zalo                                               |
| Buổi học      | (không có menu)                                     | /dashboard/lessons/{id}                         | Trang chi tiết buổi: điểm danh, ghi chú, chia sẻ, xuất ảnh                                                                    |
| Phụ huynh     | (công khai)                                         | /report/{slug-gv}/{slug-hs}                     | Báo cáo học tập không cần đăng nhập                                                                                           |

**Ngôn ngữ thiết kế:** font hệ thống, bo góc 8–12px, viền xám nhạt, nhãn màu trạng thái (xanh dương "Đã lên lịch", xanh lá "Hoàn thành"/"Hoạt động", đỏ "Vắng"/"Xoá", cam "Có phép"), nút chính màu đen, nút phụ viền trắng, nút nguy hiểm đỏ. Mọi ô nhập đều có placeholder ví dụ tiếng Việt ("Lớp TOEIC Căn bản", "123 Lê Lợi, Q1, TP.HCM"). Các khối "Thông tin" nền xanh nhạt giải thích cơ chế ngay trong màn (ví dụ: "Báo cáo chỉ hiển thị sau khi bạn bấm Dạy xong").

### 3.3 Giao diện tĩnh từng màn hình

#### 3.3.1 Trang chủ và bảng giá công khai (mô tả, không có ảnh dựng lại)

Thứ tự section trang chủ: (1) banner trên cùng "Trải nghiệm trọn bộ Pro miễn phí 30 ngày, không cần thẻ"; (2) header: Tính năng, Cách hoạt động, Phù hợp với ai, Bảng giá, FAQ, Blog, nút đen "Vào Dashboard"; (3) hero hai cột: nhãn "Dành cho gia sư & giáo viên dạy thêm", tiêu đề 2 dòng với cụm "phiếu học phí kèm mã QR" tô xanh ngọc, hai nút "Tạo tài khoản →" (đen) và "Đăng nhập" (trắng), ba tick "Có gói miễn phí · Không cần thẻ tín dụng · Dùng được trên điện thoại", bên phải là khung trình duyệt giả hiển thị lịch tuần nhiều màu; (4) "Vấn đề thường gặp – Việc giấy tờ tăng theo số lớp" (6 ý); (5) khối tính năng xen kẽ ảnh–chữ theo thứ tự: Mã QR · phiếu thu → Lịch · dạy online (Google Calendar/Meet, mời học sinh qua email, huỷ buổi thì gỡ sự kiện) → Phụ huynh · minh bạch (link riêng) → Tổng quan → Doanh thu · phân tích (gắn nhãn "Mới") → Điện thoại · PWA → Lưu trữ tài liệu; (6) "Cách hoạt động" 3 bước; (7) "Phù hợp với ai" 3 thẻ; (8) khối tin cậy "Dữ liệu của bạn là của riêng bạn"; (9) FAQ 10 câu dạng accordion; (10) CTA cuối. Màu chủ đạo: xanh ngọc đậm (#0F766E-ish) trên nền trắng/xanh rất nhạt, nút đen; nút chat tròn xanh ở góc.

Trang /pricing: hero "Trọn bộ Pro miễn phí 30 ngày", bảng so sánh 2 cột Miễn phí/Pro (cột Pro nền xanh nhạt) với 10 dòng như bảng ở 3.1, dưới là hai thẻ giá Quý 179.000đ và Năm 499.000đ (nhãn "Tiết kiệm 217.000đ"), rồi CTA.

#### 3.3.2 Tổng quan (Dashboard home)

*Hình 1 – Tổng quan sau khi tạo lớp test*

Thành phần từ trên xuống: lời chào theo buổi + ngày; khối "Buổi chưa hoàn thành" (danh sách buổi đã qua giờ nhưng chưa bấm Dạy xong – đây là cơ chế nhắc duy nhất của app); hàng 3 thẻ: Học sinh đang hoạt động, Lớp học đang mở, Buổi học tháng này (Đã lên lịch / Hoàn thành / Đã nghỉ với màu xanh-lục-đỏ); hàng 2 thẻ tiền: "Đã thu trong tháng" và "Học phí chưa thu" (có icon mắt để ẩn số – tính năng riêng tư khi mở app trước mặt người khác); hai cột dưới: "Lịch dạy hôm nay" và "Lịch sắp tới" (3 buổi gần nhất, mỗi dòng có nhãn trạng thái, tên lớp, giờ, ngày, Online/Offline).

#### 3.3.3 Lịch dạy

*Hình 2 – Lịch tuần, 2 buổi test được tô màu "Graphite" của lớp*

Thanh điều hướng: ‹ Hôm nay ›, tiêu đề khoảng ngày, bộ chuyển 3 ngày/Tuần/Tháng, nút lọc, nút cài đặt hiển thị, nút làm mới; góc phải "Chia sẻ lịch". Lưới giờ 07:00–22:00, vạch đỏ giờ hiện tại. Sự kiện hiển thị giờ, tên lớp, icon đồng hồ (chưa chốt) và màu lớp. Bấm sự kiện mở modal chi tiết buổi (giống trang /lessons/{id}). Menu ⋮ của buổi: Làm mới · Báo nghỉ buổi này · Xoá buổi học; nút bút chì để sửa giờ/ngày.

#### 3.3.4 Tạo lớp mới – wizard 3 bước (route đích của khảo sát)

*Hình 3 – Bước 1 Thông tin lớp*

**Bước 1 – Thông tin lớp.** Trường: Tên lớp (bắt buộc; bỏ trống → viền đỏ + "Tên lớp không được trống"); Màu lớp (bắt buộc, dropdown 25 màu đặt tên theo Google Calendar: Lavender, Sage, Grape, Flamingo, Banana, Tangerine, Peacock (mặc định), Graphite, Blueberry, Basil, Tomato, Rose, Coral, Amber, Lime, Emerald, Teal, Cyan, Sky, Indigo, Deep, Violet, Magenta, Pink, Brown – có tooltip "Màu trên Google Calendar"); Hình thức học phí (3 thẻ radio: Theo giờ "tính tiền theo số giờ dạy mỗi buổi" · Theo buổi học "tính tiền từng buổi khi điểm danh" (mặc định) · Theo khoá học "thu trọn gói theo khoảng thời gian" – kèm cảnh báo "Không thể thay đổi sau khi tạo lớp"); Link online chung (nút "Tạo link Meet" cần kết nối Google, hoặc dán link Zoom/Meet; "để trống nếu học offline"); Mô tả (textarea). Nút: Quay lại (trái) · Tiếp tục → (phải, đen).

*Hình 4 – Bước 2 Học sinh, hàng mở rộng Email/Phụ huynh*

*Hình 5 – Bước 2 khi bấm Tiếp tục với hàng trống: lỗi inline dưới từng ô*

**Bước 2 – Học sinh.** Khối "Thông tin" nêu 3 mẹo: chọn Mới/Cũ, bấm mũi tên cột Khác để thêm email và phụ huynh, có thể dán cột tên từ Excel để tạo nhiều hàng. Khối "Phí khác" (accordion) cho phép thêm dòng Tên + Số tiền (placeholder "Phí tài liệu, quỹ lớp, phí thi… / 200.000") áp dụng chung cho mọi học sinh trong lớp. Bảng học sinh: \# · Nguồn (toggle Mới/Cũ – Cũ mở combobox "Tìm học sinh…") · Học sinh\* · Học phí / buổi\* (hậu tố đ) · Ngày vào lớp\* (date picker, mặc định hôm nay, chú thích "Ngày vào lớp quyết định học sinh xuất hiện ở buổi học nào") · Khác (chevron mở 3 ô Email học viên, Tên phụ huynh, SĐT phụ huynh) · thùng rác. Nút "+ Thêm học sinh". Validation: "Họ tên phải có ít nhất 2 ký tự", "Vui lòng nhập số tiền".

*Hình 6 – Bước 3 Lịch học (chế độ Online hiện thêm 3 lựa chọn link) (2 phần)*

**Bước 3 – Lịch học.** "Lớp học vào thứ mấy?\*" 7 chip T2…CN; chọn thứ nào thì xuất hiện hàng "Giờ học từng buổi" với Bắt đầu/Kết thúc (mặc định 18:00–19:30, mỗi thứ một giờ riêng, có thể xoá). "Tạo buổi học trong khoảng\*" với chip 1 tuần / 4 tuần (mặc định) / 8 tuần / 3 tháng / Tuỳ chỉnh (mở 2 ô Ngày bắt đầu – Ngày kết thúc; "Chọn Tuỳ chỉnh nếu muốn tạo trong quá khứ"). Công tắc "Đồng bộ Google Calendar" (mờ khi chưa kết nối, có link Kết nối). "Hình thức học\*": Online/Offline – Offline hiện ô Địa chỉ; Online hiện "Link buổi học" với 3 radio: Dùng link của lớp (mờ nếu lớp chưa có link) · Meet riêng cho buổi này ("mỗi buổi một link Meet khác nhau", cần Google) · Link khác (ô dán URL). Khối "Các buổi sẽ tạo": danh sách checkbox nhóm theo "Tuần này / Tuần sau / 2 tuần sau / 3 tuần sau", "Chọn tất cả (8/8)" – bỏ tick buổi nào thì không tạo buổi đó. Nút submit đổi nhãn động: "Tạo lớp + 0 buổi" (mờ) → "Tạo lớp + 8 buổi". Sau khi tạo, app chuyển thẳng sang Lịch dạy (không có màn "thành công").

> **Lưu ý:** Hình thức học phí bị khoá sau khi tạo lớp là quyết định thiết kế có chủ đích (tránh phá vỡ các khoản phí đã phát sinh) nhưng không có lối thoát: muốn đổi phải tạo lớp mới và chuyển học sinh. TutorBird cho đổi cách tính tiền trên từng học sinh bất kỳ lúc nào; Teachworks cho "ghi đè cách tính tiền" ngay trên từng buổi.

#### 3.3.5 Danh sách lớp và chi tiết lớp

*Hình 7 – Danh sách lớp học*

Bảng: Tên lớp (chấm màu + tên + nhãn "Chi tiết" + mô tả cắt ngắn) · Loại (Theo buổi/giờ/khoá) · Học sinh (số) · Buổi học (số) · Trạng thái (Hoạt động/Đã kết thúc) · Thao tác (Chi tiết). Bộ lọc: ô tìm theo tên + dropdown trạng thái. Nút "+ Thêm lớp" đen ở góc phải.

*Hình 8 – Chi tiết lớp: cột trái buổi học, cột phải học sinh; cuối trang là "Vùng nguy hiểm"*

*Hình 9 – Hộp thoại Sửa lớp học (hình thức học phí chỉ hiển thị, không sửa được)*

Chi tiết lớp: tiêu đề + chip "Theo buổi · 8 buổi · 1 học sinh" + mô tả; nút Sửa và Làm mới. Cột trái "Buổi học": nút "+ Buổi mới", khối "Sắp tới (n buổi)" có nút "Chọn" để chọn nhiều buổi (xoá/báo nghỉ hàng loạt), nhóm theo tuần, mỗi dòng: ngày, nhãn trạng thái, giờ, Online/Offline, mũi tên; khối "Đã qua" thu gọn. Cột phải "Học sinh": nút Thêm học sinh, Thêm phí khác, "Tổng hợp link báo cáo" (mở hộp "Soạn tin nhắn chia sẻ báo cáo": chọn học sinh, tin nhắn soạn sẵn kèm link, nút Chia sẻ/Copy tin nhắn); thẻ từng học sinh: tên, nhãn Đang học, Vào lớp, Học phí/buổi, nút Học phí · Phí khác · Sửa · xoá đỏ. Cuối trang "Vùng nguy hiểm": Kết thúc (lưu trữ) và Xoá (xoá toàn bộ dữ liệu lớp).

#### 3.3.6 Chi tiết buổi học – màn hình "làm việc" chính của giáo viên

*Hình 10 – Buổi học sau khi "Đã dạy xong": nhãn Hoàn thành, học phí buổi này 200.000đ*

**Cấu trúc:** breadcrumb tên lớp; tiêu đề "Thứ Ba, 20 thg 10 năm 2026" + nhãn trạng thái (Đã lên lịch → Hoàn thành) + chip Online/Offline; dòng giờ "18:00 – 19:30 · 1,5 giờ"; menu ⋮ (Làm mới, Báo nghỉ buổi này, Xoá buổi học) và nút bút chì. Thanh trạng thái: trước khi chốt là banner vàng "Buổi học chưa chốt. Điểm danh xong rồi bấm Đã dạy xong để tính điểm danh và tạo học phí" với nút xanh "Đã dạy xong" (có hộp xác nhận "Buổi học sẽ được đánh dấu hoàn thành và tạo phí cho học sinh có mặt"); sau khi chốt thành banner xanh "Buổi học đã chốt và học phí đã được tạo cho học sinh có mặt" với nút "Mở lại buổi học".

**Cột trái – Điểm danh học sinh:** khối Thông tin (báo cáo chỉ hiển thị sau khi Dạy xong; nút Chia sẻ ở mỗi học sinh để lấy link; nhận xét/lý do nghỉ/tài liệu hiện trong báo cáo riêng). Nút "Tất cả có mặt" + làm mới. Ba ô đếm: Có mặt (Tính phí) · Vắng (Tính phí) · Có phép (Không tính phí). Sau khi chốt thêm dòng "Học phí buổi này: 200.000đ". Mỗi học sinh: tên, nút Chia sẻ (sau khi bật thành "Link báo cáo ●"), nút ảnh, số tiền; 3 nút trạng thái Có mặt/Vắng/Có phép; "Hoàn thành BTVN" chip 0%→100% bước 10%; "Điểm số" chip 0→10 + "+0.5"; "Nhận xét riêng" (textarea có mic ghi âm → chữ); "Tài liệu đính kèm" + Thêm tài liệu; nút Lưu.

**Cột phải – Ghi chú buổi học:** "Xem ghi chú buổi trước" (accordion); nút "Xuất ảnh" (tải PNG báo cáo buổi – xem Hình 12); bốn ô có mic và "Thêm tài liệu": Nội dung đã dạy · Bài tập về nhà · Nhận xét chung · Kế hoạch buổi sau.

*Hình 11 – Sau khi bấm "Xuất ảnh": toast "Đã tải ảnh báo cáo"; cột trái hiện Link báo cáo đã bật*

*Hình 12 – File PNG "bao-cao-hoc-sinh-test-a-2026-10-20.png" do app tự xuất để gửi Zalo*

#### 3.3.7 Học sinh

*Hình 13 – Danh sách học sinh với cột Báo cáo (Chia sẻ)*

*Hình 14 – Chi tiết học sinh*

Danh sách: Học sinh (avatar chữ cái + tên) · Phụ huynh · Trạng thái (Đang học/Đã nghỉ) · Báo cáo (nút Chia sẻ) · Thao tác (bút chì, Chi tiết). Lọc tên/SĐT/phụ huynh + trạng thái. Chi tiết: header tên + nhãn + nút "Chia sẻ"; khối "Học phí chưa thu" (trống → "Đã thu đủ"); khối "Thông tin" 2 cột (Ngày sinh, SĐT, Email học viên, Địa chỉ \| Tên/SĐT/Email phụ huynh) với nút Sửa (hộp thoại Hình 15); "Lớp đang học" (thẻ lớp với Vào lớp, Học phí); "Buổi đã học" (0 → "Các buổi đã hoàn thành của học sinh này sẽ hiện ở đây"); "Vùng nguy hiểm": Đã nghỉ, Xoá. Hộp "Chia sẻ báo cáo với phụ huynh": 3 gạch đầu dòng (mỗi học sinh một link riêng; phụ huynh thấy ngày học, điểm danh, nhận xét, nội dung; tắt chia sẻ thì link ngừng), nút "Tạo link" → hiện URL + Copy link + "Xem thử" + "Tắt chia sẻ" (đỏ).

#### 3.3.8 Điểm danh theo tháng

*Hình 15 – Lưới điểm danh tháng 10/2026 (buổi 20/10 đã tick xanh sau khi chốt)*

Chú giải: ✓ Có mặt (xanh), K Vắng (đỏ), P Có phép (cam); hướng dẫn "Chạm vào ô để điểm danh". Bộ lọc: tìm học sinh, "Chọn lớp 1/1", tháng. Nút "Xuất Excel" (gắn nhãn Mới) và "Chú thích". Lưới cuộn ngang theo ngày, hàng đầu là tên lớp với icon đồng hồ ở ngày có buổi, hàng dưới là học sinh; cột cuối "Buổi" đếm số buổi có mặt. Điểm danh ngay trên lưới (không cần mở buổi).

#### 3.3.9 Học phí – chưa thu, phiếu, lịch sử, hoàn tác

*Hình 16 – Học phí chưa thu sau khi chốt buổi 20/10*

Hai tab: Học phí chưa thu / Lịch sử thu. Tab chưa thu: tiêu đề + mô tả "Danh sách học sinh chưa đóng học phí"; nút "Tạo nhiều phiếu" (Mới) và "Gộp phiếu"; bộ lọc tên, lớp, thời gian; dải tổng "Học phí chưa thu: 200.000đ · 1 học sinh"; thẻ theo học sinh: tên + tổng; từng lớp: tên lớp, số tiền, "1 buổi", "Chọn buổi ▾" (chọn một phần để thu); hai nút "Tạo phiếu học phí" và "Đã thu tiền" (xanh lá). Trạng thái rỗng giải thích: "Trang này chỉ hiện các buổi đã hoàn thành mà học sinh chưa đóng… đây là tín hiệu tốt".

*Hình 17 – Hộp thoại Phiếu học phí: tuỳ chọn trái, xem trước phải, 9 mẫu*

Hộp "Phiếu học phí · Học sinh TEST A": cảnh báo "Chưa có tài khoản ngân hàng nên phiếu sẽ không có mã QR" + link Cài đặt ngay; công tắc Ẩn chi tiết học phí · Kèm phiếu báo cáo (Mới) · Kèm lời nhắn; "Chọn mẫu" lưới 3 cột: Cơ bản, Tối giản, Biên nhận, Chuyên nghiệp, Sang trọng (nền đen), Thân gửi, Bé yêu (Pro), Mùa hè (Pro), Mùa thu (Pro), Trung Thu (Pro). Bên phải: xem trước (Phiếu học phí · Học viên · bảng Khoản thu/Chi tiết/Số tiền: "Buổi học · 18:00-19:30 · 20/10 · T3 · 200.000đ" · Tổng cộng) và nút Tải xuống. Chân hộp: "Chia sẻ ảnh" và "Tải ảnh". Khi có tài khoản ngân hàng, phiếu thêm mã VietQR đúng số tiền và nội dung chuyển khoản theo tên học sinh (sửa được).

*Hình 18 – "Xuất phiếu học phí hàng loạt": chọn học sinh, bố cục ảnh 1×1/2×2/2×3/3×3*

*Hình 19 – Lịch sử thu tiền theo tháng*

*Hình 20 – Mở rộng khoản thu, tick chọn để Hoàn tác*

"Đã thu tiền" mở hộp xác nhận "Bạn đã nhận 200.000đ (1 khoản) từ Học sinh TEST A?" rồi toast "Đã thu 1 khoản". Lịch sử thu: lọc tháng; dải "Đã thu trong tháng · số khoản"; thẻ học sinh → ngày thu → lớp → từng buổi; nút "Hoàn tác" chỉ bật khi tick khoản; hộp xác nhận "1 khoản (200.000đ) sẽ quay lại mục Chưa thu. Dùng khi bạn lỡ đánh dấu đã thu". Mọi thao tác tiền đều có xác nhận hai bước và có đường quay lại.

#### 3.3.10 Phân tích

*Hình 21 – Phân tích: 4 KPI, biểu đồ buổi theo trạng thái, Đã thu vs Tiềm năng, giải thích cách tính (2 phần)*

Bộ lọc: Chọn lớp (đa chọn, hiển thị "1/2" – tài khoản có thêm 1 lớp đã kết thúc) và tháng. KPI: Đã thu · Chưa thu · Tiềm năng ("trần doanh thu: đã thu + chưa thu + dự báo các buổi đã lên lịch") · Tỷ lệ thu. Biểu đồ ngang chồng (Đã nghỉ/Hoàn thành/Đã lên lịch) kèm dòng "Đã dạy 0 buổi · 0 giờ · Sắp tới 4 buổi · ~6 giờ · Nghỉ 0 buổi". Biểu đồ "Đã thu vs Tiềm năng" trục N (nghìn). Khối "Cách tính tiềm năng" 4 gạch đầu dòng, trong đó quan trọng: số liệu quy vào tháng theo ngày buổi học, không theo ngày đóng tiền; phí khác chưa gắn kỳ hiện ở mọi tháng.

#### 3.3.11 Cài đặt & Profile, Kết nối, Gói, Quản lý tệp

*Hình 22 – Cài đặt & Profile: thông tin cá nhân, đặt mật khẩu, tài khoản ngân hàng cho QR*

*Hình 23 – Kết nối Google Calendar/Meet và Google Drive*

*Hình 24 – Gói & thanh toán: gói hiện tại, hạn mức, so sánh, đơn hàng với mã giảm giá (2 phần)*

*Hình 25 – Quản lý tệp (Kho tài liệu "Sắp có")*

Tài khoản ngân hàng: dropdown 15 ngân hàng (MB, VietinBank, Vietcombank, BIDV, ACB, Techcombank, VPBank, TPBank, HDBank, Agribank, OCB, Sacombank, VIB, MSB, SHB), Số tài khoản, Tên chủ tài khoản → dùng để sinh QR trên phiếu. Đặt mật khẩu để đăng nhập email song song với Google (tối thiểu 8 ký tự, hoa, thường, số). Kết nối Google tách 2 quyền: Calendar (đồng bộ tạo/sửa/huỷ sự kiện) và Meet (tạo phòng cố định); Drive để đính kèm không cần tải lại. Trang Gói: thẻ gói hiện tại với ngày hết hạn và cảnh báo "còn 1 ngày"; hạn mức 4 dòng với thanh % dung lượng; bảng so sánh; "Ưu đãi dành cho bạn" (thẻ mã giảm giá tự áp) + ô nhập mã; "Đơn hàng" chọn Quý/Năm, dòng giảm giá, tổng cộng, ghi chú "Cộng dồn vào hạn hiện tại, dùng đến 20/01/2027", nút Thanh toán; lịch sử thanh toán.

#### 3.3.12 Trang báo cáo phụ huynh (công khai)

*Hình 26 – /report/thanh-nguyen/hoc-sinh-test-a: lịch tháng + danh sách buổi (đang rỗng)*

Header tối giản (logo + "Báo cáo học tập"); thẻ học sinh (avatar, BÁO CÁO HỌC TẬP, tên, "Giáo viên: …", nút "Tải PDF"); lịch tháng với chip buổi (giờ + tên học sinh) và bộ đếm "4 buổi"; dưới là danh sách buổi đã học với nội dung/BTVN/nhận xét; chân trang "Trang này được giáo viên chia sẻ riêng cho phụ huynh. Không cần đăng nhập." + "Tạo bởi Sổ Gia Sư". Không có học phí, không có học sinh khác (đúng cam kết trang chủ).

> **Lưu ý:** Quan sát được lỗi logic: buổi 20/10 đã được chốt "Hoàn thành" nhưng trang phụ huynh vẫn báo "Chưa có buổi học nào trong tháng này" vì danh sách lọc theo ngày ≤ hôm nay (19/10) thay vì theo trạng thái. Với giáo viên chốt sớm hoặc dạy bù sai ngày, phụ huynh sẽ không thấy báo cáo đến ngày hôm sau.

### 3.4 Cơ chế vận hành

#### 3.4.1 Vòng đời dữ liệu

| **Thực thể**      | **Tạo khi**                                                                 | **Trạng thái**                                                 | **Ghi chú**                                                                                          |
|-------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| Lớp               | Wizard 3 bước                                                               | Hoạt động → Đã kết thúc (lưu trữ) / Xoá                        | Thuộc tính khoá: hình thức học phí. Có màu, link online chung, mô tả, phí khác chung                 |
| Học sinh          | Trong wizard (Mới) hoặc Thêm học sinh; có thể gắn học sinh Cũ vào nhiều lớp | Đang học → Đã nghỉ / Xoá                                       | Mỗi (học sinh, lớp) có ngày vào lớp + học phí riêng; email/phụ huynh tuỳ chọn; slug cho link báo cáo |
| Buổi học          | Sinh hàng loạt từ thứ + giờ + khoảng; hoặc "Buổi mới" thủ công              | Đã lên lịch → Hoàn thành / Đã nghỉ (Báo nghỉ) / Xoá            | Có Online/Offline + link riêng; đồng bộ Google Calendar nếu bật                                      |
| Điểm danh         | Trong buổi hoặc trên lưới tháng                                             | Có mặt (tính phí) · Vắng (tính phí) · Có phép (không tính phí) | Kèm % BTVN, điểm 0–10, nhận xét riêng, tài liệu                                                      |
| Khoản phí         | Khi bấm "Đã dạy xong" → cho học sinh Có mặt/Vắng                            | Chưa thu → Đã thu (có Hoàn tác)                                | Theo buổi: giá/buổi × 1; theo giờ: giá × thời lượng; theo khoá: gói theo kỳ (chưa thử)               |
| Phí khác          | Thêm ở lớp hoặc học sinh                                                    | Chưa thu → Đã thu                                              | Phí tài liệu, quỹ lớp…; chưa gắn kỳ nên hiện ở mọi tháng trong Phân tích                             |
| Phiếu thu         | Từ các khoản chưa thu (chọn buổi, gộp, hàng loạt)                           | Ảnh PNG, không lưu trạng thái "đã gửi"                         | QR VietQR theo tài khoản giáo viên; mẫu Free/Pro; kèm báo cáo & lời nhắn                             |
| Báo cáo phụ huynh | Bật chia sẻ ở học sinh/buổi                                                 | Đang chia sẻ / Tắt                                             | URL cố định, công khai, không mật khẩu; có Tải PDF; ảnh PNG từng buổi                                |

#### 3.4.2 Ba hình thức học phí

- **Theo buổi học (mặc định):** mỗi buổi chốt tạo 1 khoản = học phí/buổi của học sinh. Vắng vẫn tính phí (quy ước phổ biến ở Việt Nam), Có phép không tính.

- **Theo giờ:** khoản = đơn giá giờ × thời lượng buổi (1,5 giờ trong ví dụ). Phù hợp gia sư 1-1 có buổi dài ngắn khác nhau.

- **Theo khoá học:** thu trọn gói theo khoảng thời gian; Phân tích tính "tiềm năng = đã thu + các gói chưa thu". Chưa đi sâu vì không thể đổi hình thức của lớp test.

#### 3.4.3 Cơ chế phí phát sinh và thu tiền

Khác với TutorBird (ghi nợ ngay khi lên lịch, điểm danh sau chỉ điều chỉnh) và Teachworks (tính theo lượt tham dự), Sổ Gia Sư chỉ ghi nợ khi giáo viên chủ động chốt buổi. Hệ quả: (1) bảng Học phí chưa thu luôn phản ánh thực dạy, không có "nợ ảo"; (2) muốn thu trước (học phí tháng) phải dùng "Theo khoá học" hoặc tự thu ngoài; (3) toàn bộ nhắc nhở phụ thuộc khối "Buổi chưa hoàn thành" ở Tổng quan – không có push/email/Zalo nhắc giáo viên chốt. Thu tiền là thao tác ghi nhận thủ công ("Đã thu tiền"); app không biết tiền đã về tài khoản hay chưa cho đến khi có "Đối soát chuyển khoản" (sắp có).

#### 3.4.4 Kênh giao tiếp với phụ huynh

Không có app phụ huynh, không có SMS/email tự động. Giáo viên tự gửi 3 loại ảnh/link qua Zalo: (a) link báo cáo cố định, (b) ảnh PNG báo cáo buổi, (c) ảnh phiếu thu QR. Đây là lựa chọn phù hợp với Zalo-first ở Việt Nam và tránh phí tin nhắn (ClassUp Hàn Quốc thu 9 KRW/tin Alimtalk; Teachworks bán credit SMS), nhưng làm app không có vòng phản hồi: không biết phụ huynh đã xem chưa, đã trả chưa.

#### 3.4.5 Tích hợp

- Google Calendar: đẩy buổi lên lịch cá nhân, huỷ buổi thì gỡ sự kiện, mời học sinh qua email kèm link. Google Meet: link cố định cho lớp hoặc riêng từng buổi. Google Drive: đính kèm tài liệu (Pro). Không có Zoom API (chỉ dán link), không có Zalo OA, không có cổng thanh toán, không có API công khai.

- PWA: cài lên màn hình chính từ trình duyệt; không có app trên App Store/CH Play (FAQ trang chủ xác nhận).

### 3.5 Lưu ý và điểm nghẽn (xếp theo mức ảnh hưởng)

| **\#** | **Điểm nghẽn / lưu ý**                                                                   | **Mức**    | **Bằng chứng**                                      | **Hệ quả cho người dùng**                                      |
|--------|------------------------------------------------------------------------------------------|------------|-----------------------------------------------------|----------------------------------------------------------------|
| 1      | Phí chỉ phát sinh khi bấm "Đã dạy xong"; không có nhắc tự động                           | Cao        | Banner vàng trong buổi; khối "Buổi chưa hoàn thành" | Quên chốt → thiếu phí, thiếu báo cáo; cuối tháng phải chốt dồn |
| 2      | Hình thức học phí khoá cứng sau khi tạo lớp                                              | Cao        | Cảnh báo ở bước 1; hộp Sửa lớp chỉ hiển thị         | Đổi từ theo buổi sang theo tháng phải tạo lớp mới              |
| 3      | Trang phụ huynh lọc theo ngày, không theo trạng thái                                     | Trung bình | Hình 26: "Chưa có buổi học nào" dù 20/10 Hoàn thành | Chốt sớm/dạy bù → phụ huynh không thấy                         |
| 4      | Không có vòng phản hồi phụ huynh (đã xem/đã trả)                                         | Cao        | Link công khai, ảnh PNG, không có app               | Giáo viên vẫn phải hỏi tay; đối soát "sắp có"                  |
| 5      | Một giáo viên/tài khoản; không có trợ giảng, không phân quyền                            | Trung bình | Không có menu nhân sự                               | Lớp nhóm có 2 người dạy hoặc trung tâm nhỏ không dùng được     |
| 6      | Không có app native, PWA phụ thuộc trình duyệt                                           | Trung bình | FAQ + menu "Cài đặt app" trỏ blog                   | Khó dùng ghi âm nhận xét, thông báo đẩy trên iOS               |
| 7      | Link báo cáo công khai không mật khẩu, slug đoán được (/report/tên-gv/tên-hs)            | Trung bình | URL tạo ra                                          | Rủi ro riêng tư nếu tên phổ biến; chỉ có cách Tắt chia sẻ      |
| 8      | Điểm danh tháng chỉ xuất Excel, không PDF; trang chủ hứa "Tải PDF" chỉ ở trang phụ huynh | Thấp       | Nút Xuất Excel                                      | Nhu cầu in bảng điểm danh gửi trung tâm                        |
| 9      | Phí khác không gắn kỳ → hiện ở mọi tháng trong Phân tích                                 | Thấp       | Dòng giải thích dưới biểu đồ                        | Số "chưa thu" theo tháng bị lặp                                |
| 10     | Kho tài liệu "Sắp có"; đối soát chuyển khoản "Sắp có"                                    | Thấp       | Nhãn trong app và pricing                           | Hai tính năng đang được bán trước                              |
| 11     | Màn hình rộng tối thiểu ~1040px mới giữ 2 cột; sidebar thu gọn thủ công                  | Thấp       | Khi thu nhỏ cửa sổ                                  | Trên tablet ngang vẫn ổn, điện thoại dọc cần kiểm tra thêm     |
| 12     | Khuyến mãi hiện mọi trang, trial hết hạn "còn 1 ngày" nhưng không có nhắc email          | Thấp       | Banner + trang Gói                                  | Chuyển đổi dựa vào người dùng tự nhìn thấy                     |

### 3.6 Điểm mạnh đáng học

- Wizard tạo lớp một màn, sinh buổi hàng loạt và cho bỏ tick từng buổi trước khi tạo – nhanh hơn TutorBird/Teachworks rõ rệt.

- Mọi thao tác tiền có xác nhận hai bước và đường lùi (Mở lại buổi học, Hoàn tác khoản thu).

- Giải thích cơ chế ngay trong màn (khối Thông tin, "Cách tính tiềm năng", trạng thái rỗng có ý nghĩa) – giảm nhu cầu help center.

- Phiếu thu nhiều mẫu, xuất ảnh, QR đúng số tiền – giải đúng nỗi đau "gõ lại số tài khoản cho từng phụ huynh".

- Ghi âm → chữ ở mọi ô nhận xét; chip % BTVN và điểm số giúp ghi nhận sau buổi mất dưới 30 giây.

- Ẩn số tiền bằng icon mắt ở Tổng quan; không hiển thị học phí trên trang phụ huynh.

- Giá rất thấp, trial không cần thẻ, mã giảm giá theo dịp – đúng tâm lý gia sư cá nhân.

## 4. Nhóm tham khảo 1 – SaaS quản lý lớp cho gia sư/trung tâm

*Quy ước:* số liệu "tự công bố" là từ trang của hãng; review Capterra/G2/Trustpilot chỉ dùng định tính. Quy đổi 1 USD ≈ 25.500đ, 1 GBP ≈ 33.000đ, 1 EUR ≈ 28.000đ, 1 JPY ≈ 170đ, 1 KRW ≈ 19đ.

### 4.1 TutorBird (Port 443 Inc., Canada – tutorbird.com)

*Hình 27 – Trang chủ TutorBird (phần footer; hero là chữ chạy "Helping you… reduce no-shows")*

**Hồ sơ**

| **Mục**   | **Nội dung**                                                                                                                                                                                                                                                                                                                                                                        |
|-----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị   | "Phần mềm quản lý gia sư số 1 từ 2014" cho gia sư tư nhân, trung tâm dạy kèm, trung tâm luyện thi, gia sư di động và online. Cùng công ty với My Music Staff.                                                                                                                                                                                                                       |
| Giá       | Một gói duy nhất 16,95 USD/tháng (~432.000đ), đủ tính năng, không giới hạn học sinh; thêm 4,95 USD/giáo viên; dùng thử 30 ngày không cần thẻ; hoàn tiền 90 ngày; SMS miễn phí; lưu trữ không giới hạn (2GB/file); hosting website miễn phí. Phí cổng Stripe/PayPal do cổng thu.                                                                                                     |
| Tính năng | Lịch 1-1 và nhóm, nhắc email/SMS, điểm danh với make-up credit, học sinh + gia đình + lead/danh sách chờ, hoá đơn tự động theo lịch, gói buổi, phí trễ hạn, cổng học viên/phụ huynh (đặt lịch, trả tiền, nộp bài, Study Log/Timer), website builder, tự đặt lịch tư vấn, thư viện cho mượn, chi phí & số dặm, nhiều giáo viên + trả lương, Zoom/Skype/FaceTime, báo cáo kinh doanh. |
| Review    | Capterra 4,8/5 từ 268 review; dễ dùng 4,6; hỗ trợ 4,8. Khen: gộp lịch–hoá đơn–thanh toán, giá hợp lý. Chê: báo cáo hạn chế, mẫu email/SMS khó tuỳ biến, hoá đơn đôi khi khó hiểu, không undo lịch, đồng bộ Google Calendar chưa tốt. Blog đối thủ Teach 'n Go (thiên vị) nói không có lớp ảo tích hợp, không bảng điểm, không push.                                                 |
| Mobile    | Web-based, không có app native rõ ràng (Capterra ghi Android/iPhone nhưng chưa xác minh).                                                                                                                                                                                                                                                                                           |

**Bên trong sản phẩm (tài khoản dùng thử của bạn, giao diện tiếng Việt do Chrome dịch)**

**Trang chủ (Home):** banner "Hướng dẫn bắt đầu"; lời chào "Nguyễn, chúng ta bắt đầu thôi nào!"; 5 thẻ KPI: Còn lại các sự kiện trong tuần · Các khoản thanh toán nhận được trong tháng · Doanh thu dự kiến trong tháng · Học sinh tích cực · Đang chờ xét duyệt (đặt lịch từ cổng học viên); dưới là "Chương trình nghị sự" theo ngày với ‹ Hôm nay ›. Thanh trên: chuông thông báo, dấu hỏi trợ giúp, avatar.

*Hình 27a – TutorBird: Trang chủ với 5 thẻ KPI và chương trình nghị sự ngày 19/10 (ảnh chụp màn hình thật)*

*Hình 27b – TutorBird: menu trái 13 mục*

**Menu trái (13 mục):** Trang chủ · Học sinh · Lịch · Thư viện cho mượn · Tài nguyên trực tuyến · Nộp bài tập về nhà · Gia đình & Hoá đơn · Gói · Chi phí và doanh thu khác · Nhật ký quãng đường · Trang web · Tin tức & Bài đăng trên Blog · Báo cáo kinh doanh. So với Sổ Gia Sư (11 mục) TutorBird nhiều hơn các mục không cốt lõi: thư viện, website, blog, số dặm.

*Hình 27c – TutorBird: danh sách Học sinh (1 học sinh test, cột Gia đình, Tín dụng học bù)*

*Hình 27d – TutorBird: hồ sơ học sinh, 7 tab; tab Cổng thông tin sinh viên (cần email để bật)*

**Thêm học sinh – wizard 4 bước trong ngăn kéo bên phải:** (1) Thông tin sinh viên: Loại học sinh Con/Người lớn; Trạng thái (Hoạt động/Không hoạt động/Tiềm năng…); Tên, Họ; Email, SĐT (tuỳ chọn) + checkbox "Có khả năng gửi SMS"; "Thông tin chi tiết bổ sung" (accordion). (2) Chi tiết gia đình: "Một gia đình mới" (tạo tài khoản Gia đình & Hoá đơn) hoặc "Một gia đình hiện có"; Tên/Họ cha mẹ, Email, Điện thoại + SMS. (3) Cài đặt bài học: "Một tiết học điển hình của học sinh này diễn ra như thế nào?" – Danh mục (Bài học), Thời lượng (30 phút), Giá bài học với 4 radio: Mỗi bài học (giá cố định bất kể thời lượng) · Cố định hàng tháng · Theo giờ (tự điều chỉnh theo thời lượng) · Không tính phí (dùng gói/thời gian trong gói); Đánh giá "\$30.00 mỗi bài học". (4) Xác nhận "Học sinh đã được thêm!" với 3 việc tiếp: Lên lịch học · Thiết lập hoá đơn tự động · Xem hồ sơ sinh viên; nút "Thêm một học sinh khác"/"Xong".

**Lịch & thêm bài học nhanh:** lịch tháng/tuần/ngày, nút "Thêm sự kiện ▾", "Tuỳ chọn", "In". Ngăn "Thêm bài học nhanh": Loại sự kiện (Buổi học với một học sinh / Mở khung giờ học – không chỉ định học sinh, để học sinh tự đặt từ cổng); Học sinh (chọn hoặc "Tạo sinh viên"); Ngày, Thời gian; Lặp lại: Sự kiện một lần / Tạm thời giữ lại hàng tuần (giữ chỗ tối đa 7 ngày chờ xác nhận) / Sự kiện định kỳ; Khả năng hiển thị: Công khai (mọi học sinh thấy trên cổng) / Riêng tư (chỉ người tham dự); "Điểm cộng thêm" (sự kiện yêu cầu tín chỉ bù). Sự kiện trên lịch hiện giờ, tên, loại; popover có 5 icon (sửa, email, SMS, nhân bản, xoá), ngày giờ, "1 Người tham dự – 30,00 đô la", nút "Điểm danh".

*Hình 27e – TutorBird: Lịch tháng với sự kiện 19/10 14:30*

*Hình 27f – TutorBird: menu Thêm sự kiện (bài học nhanh / sự kiện mới / không phải dạy kèm)*

*Hình 27g – TutorBird: ngăn Thêm bài học nhanh (loại sự kiện, lặp lại, khả năng hiển thị)*

*Hình 27h – TutorBird: popover sự kiện với 5 icon và nút Điểm danh*

**Điểm danh (3 tab: Điểm danh · Chi tiết bài học · Lịch sử):** dropdown Trạng thái với 8 giá trị, mỗi giá trị ghi rõ có tính phí hay không: Chưa được ghi nhận (\$) · Hiện tại (\$) · Hiện tại, Muộn (\$) · Vắng mặt, không được hoàn tiền học phí (\$) · Vắng mặt, cấp tín chỉ bù (\$) · Vắng mặt, Đã thông báo (không tính phí) · Gia sư đã huỷ (không tính phí) · Buổi học bị huỷ, cấp tín dụng bù giờ (\$). Tab Chi tiết bài học: "Hiển thị ghi chú cho: Học sinh / Phụ huynh / Riêng tư" + trình soạn thảo đầy đủ (bảng, link, ảnh) + "Mẫu" + "In". Khác Sổ Gia Sư: ghi chú phân quyền người xem; không có chip điểm/% BTVN.

*Hình 27i – TutorBird: hộp Điểm danh, 3 tab, trạng thái mặc định Chưa được ghi nhận (\$)*

*Hình 27j – TutorBird: 8 trạng thái điểm danh, mỗi trạng thái ghi rõ có tính phí hay không*

*Hình 27k – TutorBird: tab Chi tiết bài học – ghi chú phân quyền Học sinh / Phụ huynh / Riêng tư*

*Hình 27l – TutorBird: tab Điểm danh & Ghi chú trong hồ sơ học sinh (tỷ lệ tham dự 90 ngày)*

**Gia đình & Hoá đơn:** 3 tab Tài khoản gia đình · Hoá đơn · Giao dịch; dòng tổng "Tính đến thời điểm hiện tại, bạn không được nhận bất kỳ khoản tiền nào – 31/10/2026"; "Số dư trả trước"; bảng Gia đình · Liên hệ · Thẻ · Cân bằng · Hoá đơn tự động. Ngay khi lên lịch, tài khoản gia đình đã bị ghi nợ (30,00 USD) – sổ cái theo ngày: Ngày · Học sinh · Mô tả "14:30 (30 phút) – Bài học" · Phí & Giảm giá · Thanh toán & Hoàn tiền · Cân bằng. Tạo hoá đơn 2 bước: (1) Ngày lập; "Bao gồm số dư và các khoản thanh toán trước ngày bắt đầu" hay "Chỉ áp dụng phí trong khoảng thời gian đã chọn"; Khoảng thời gian + "Chọn nhanh"; "Bao gồm ngày đến hạn". (2) Kiểu hiển thị Thu gọn/Bình thường/Mở rộng; Ghi chú chân trang; ghi chú riêng tư; "Gửi hoá đơn qua email?" Không/Có ngay; link Cài đặt doanh nghiệp.

*Hình 27m – TutorBird: Gia đình & Hoá đơn – 3 tab, Tự động lập hoá đơn*

*Hình 27n – TutorBird: sổ cái gia đình – đã ghi nợ 30 USD ngay khi lên lịch, chưa dạy*

*Hình 27o – TutorBird: Hoá đơn mới bước 1 (ngày lập, phạm vi, khoảng thời gian)*

*Hình 27p – TutorBird: Hoá đơn mới bước 2 (kiểu hiển thị, ghi chú, gửi email)*

*Hình 27q – TutorBird: Gói (prepaid packages) – trống*

*Hình 27r – TutorBird: 12 loại báo cáo kinh doanh (Điểm danh, Giờ tính phí, Cân bằng gia đình, Tín dụng học bù, Tỷ lệ giữ chân…)*

> **Lưu ý:** Điểm khác lõi với Sổ Gia Sư: TutorBird coi "gia đình" là đơn vị thanh toán và ghi nợ theo lịch (calendar-based billing); điểm danh chỉ điều chỉnh. Sổ Gia Sư coi "học sinh trong lớp" là đơn vị và ghi nợ theo buổi đã dạy. TutorBird có cổng tự đặt lịch, make-up credit và trạng thái "Vắng đã thông báo – không tính phí"; Sổ Gia Sư chỉ có Có mặt/Vắng/Có phép.

### 4.2 Teachworks (Ontario, Canada – teachworks.com)

*Hình 28 – Trang chủ Teachworks (Chrome dịch): "Đơn giản hoá và tự động hoá công việc của bạn – Kinh doanh gia sư" (4 phần)*

*Hình 29 – Dashboard tài khoản dùng thử awdawdas.teachworks.com (2 phần)*

| **Mục**            | **Nội dung**                                                                                                                                                                                                                                                                                                                                                                                                                  |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị            | Phần mềm quản lý "teaching business": trung tâm gia sư, trường nhạc, trường lái xe, luyện thi, ngoại ngữ. Có Master Account nhiều chi nhánh. Không nhắm gia sư cá nhân.                                                                                                                                                                                                                                                       |
| Giá (2 thành phần) | Starter 16,49 USD/tháng + 0,320 USD/học sinh/buổi (~420.000đ + 8.160đ) · Growth 47,99 + 0,189 (có API) · Premium 187,99 + 0,065 (5 chi nhánh, thêm 35 USD/chi nhánh). Không giới hạn học sinh/giáo viên. Dùng thử 21 ngày. Email vượt fair-use 1 USD/1.000. Trang giá còn một bộ số cũ (15/45/175 USD) kèm chữ Lorem ipsum – lấy bộ 16,49 làm chuẩn. Ví dụ 20 học sinh × 8 buổi = 160 lượt → 67,69 USD/tháng (~1,73 triệu đ). |
| Tính năng          | Lịch với giáo viên/dịch vụ/địa điểm, giới hạn sĩ số, kiểm tra xung đột, ghi đè cách tính tiền theo buổi; đặt lịch online (add-on); cổng giáo viên/nhân viên/phụ huynh/học sinh; nhắc email (SMS mua credit); ghi chú sau buổi gửi email; hoá đơn, Stripe, QuickBooks, trả lương giáo viên (payslip); báo cáo; 70–80 add-on miễn phí; Zoom/Meet chỉ dán link; đồng bộ 2 chiều Google Calendar là add-on Pro có phí.            |
| Review             | Capterra 4,6/5 (67), G2 4,7 (9). Khen: giá trị, linh hoạt, hỗ trợ. Chê: cài đặt hoá đơn và loại khoá học phức tạp, khó tìm học sinh không hoạt động, không đồng bộ 2 chiều Google, giao diện lỗi thời, không app native.                                                                                                                                                                                                      |

**Bên trong sản phẩm**

**Dashboard:** tiêu đề + link Cài đặt; cảnh báo "Tài khoản mới chỉ được gửi tối đa 100 email mỗi ngày"; checklist thiết lập 8 bước: Cài đặt tài khoản → Thêm dịch vụ → Thêm địa điểm → Thêm nhân viên → Thêm học sinh → Lên lịch học → Tiện ích bổ sung → Thiết lập hoàn tất; widget "Giờ theo trạng thái" (Attended/Cancelled/Missed/Scheduled) theo tuần; "Tính năng mới" (Pencil Spaces); Thống kê tháng (học sinh tích cực, giáo viên, tổng hoá đơn, bài học, giờ, thanh toán); biểu đồ Tổng cộng hoá đơn và Thanh toán đã nhận; Hoá đơn quá hạn. Thanh trên có nút nền tối, widget, lịch; chat Intercom.

**Menu trái:** Bảng điều khiển · Lịch (Lịch chính, Lịch giáo viên, Lịch vị trí, Danh sách lịch, Thêm bài học, Thêm sự kiện khác, Thêm trạng thái không khả dụng, Lịch sử bài học, Lịch sử theo từng học sinh, Lịch sử sự kiện khác, Tình trạng không khả dụng) · Học sinh (Gia đình, Học sinh, Thêm gia đình, Thêm học sinh vào gia đình, Thêm học sinh độc lập) · Nhân viên · Thanh toán (Số dư khách hàng, Số dư gói, Thanh toán, Hoá đơn, Tạo hoá đơn đơn lẻ, Tạo nhiều hoá đơn, Phát hành phiếu ghi nợ) · Báo cáo (Tóm tắt bài học, Phân tích, Chuỗi thời gian, Báo cáo bài học đầu tiên, Báo cáo bài học cuối) · Nhập khẩu · Hỗ trợ (Hướng dẫn, Cơ sở tri thức, Nhật ký thay đổi) · Tài khoản.

**Thêm bài học (/event_instances/new):** Học sinh (một hoặc nhiều), Giáo viên\*, Tiêu đề, Dịch vụ\*, Mô tả (rich text), Vị trí\* (có "Trang chủ của học sinh"), cảnh báo múi giờ mặc định Giờ miền Đông, Bài học bắt đầu/kết thúc, Không gian trống (giới hạn sĩ số), Lặp lại, nút Kiểm tra xung đột, Huỷ/Lưu. Ba trường bắt buộc (giáo viên, dịch vụ, địa điểm) là rào cản onboarding lớn nhất.

*Hình 29a – Teachworks: Thêm bài học – checklist 8 bước phía trên, Học sinh/Giáo viên/Dịch vụ*

*Hình 29b – Teachworks: Thêm bài học – cảnh báo múi giờ, giờ bắt đầu/kết thúc, Không gian trống, Lặp lại, Kiểm tra xung đột*

**Thêm học sinh độc lập (/customers/new/individual):** form một trang rất dài chia tab Tất cả/Hồ sơ/Chi tiết bổ sung/Thanh toán/Cài đặt: trạng thái (Hoạt động/Không hoạt động/Tiềm năng), danh xưng, tên, email, email bổ sung, 3 số điện thoại, địa chỉ 2 dòng + thành phố/bang/mã bưu chính/quốc gia (có Viet Nam); Chi tiết học sinh (ngày sinh, ngày bắt đầu, trường, lớp, môn, thông tin thêm); Dịch vụ mặc định, Địa điểm mặc định, Giáo viên, Màu lịch + xem trước; Trường tuỳ chỉnh (add-on); Thanh toán: Billing Method = Giá niêm yết dịch vụ / Giá theo hồ sơ học sinh / Phí cố định / Gói; Giảm giá %; Thông báo: nhắc bài học, email ghi chú, email chào mừng; "Enable User Account" để học sinh đăng nhập cổng.

*Hình 29c – Teachworks: Sinh viên mới – 6 tab (Tất cả/Hồ sơ/Chi tiết/Gia đình/Thanh toán/Cài đặt)*

*Hình 29d – Teachworks: Sinh viên mới – thông tin gia đình và thông tin sinh viên*

**Tạo hoá đơn (/invoices/new):** Khách hàng, Ngày, Ngày đến hạn, Số INV-0001, Tham chiếu, Xử lý thuế (Miễn thuế), bảng Dịch vụ/Mô tả/Số lượng/Đơn giá/Giảm giá %/Số tiền với nút "Thêm phí", Tổng phụ, Thuế bán hàng %.

*Hình 29e – Teachworks: Tạo hoá đơn đơn lẻ (INV-0001, Xử lý thuế, bảng dịch vụ)*

*Hình 29f – Teachworks: Tạo nhiều hoá đơn – chọn nhiều khách hàng, lọc bài học theo trạng thái*

**Lịch chính:** lịch tháng kiểu FullCalendar (Hôm nay/Tháng/Tuần/Ngày + bộ lọc), bên dưới có lịch mini và bộ lọc theo giáo viên/địa điểm.

*Hình 29g – Teachworks: Lịch chính (FullCalendar) với checklist thiết lập*

*Hình 29h – Teachworks: Tích hợp & Tiện ích bổ sung – 80 add-on, 0 đã bật*

> **Lưu ý:** Teachworks tối ưu cho trung tâm nhiều giáo viên (lương, chi nhánh, QuickBooks) và tính tiền theo lượt học sinh/buổi – mô hình phạt cơ sở dạy nhóm hiệu quả (như nghiên cứu Gemini đã chỉ ra). Với 1 gia sư 25 học sinh, chi phí có thể vượt 2 triệu đ/tháng, gấp ~50 lần Sổ Gia Sư.

### 4.3 Teach 'n Go (EU – teachngo.com)

*Hình 30 – Trang chủ Teach 'n Go (hero bị che bởi cookie banner trong lúc dựng ảnh) (4 phần)*

| **Mục**           | **Nội dung**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị           | "All-in-one school management software to streamline and grow your business" cho học viện, trung tâm, trường ngoại ngữ; 24 ngôn ngữ (có tiếng Việt), app iOS/Android, "AI that does the busywork".                                                                                                                                                                                                                                                                                                                |
| Landing (21 khối) | Hero → tab 10 tính năng (Scheduling, Payments, Communication, Manage lessons, Booking system, Registration page, Leads, Student CRM, Grades, Student/parent portal) → logo → AI → "What makes us unique" (user-friendly, multilingual, mobile app, flexible) → vấn đề → giải pháp 6 khối → 5 key outcomes → bảo đảm hoàn tiền 30 ngày → ưu đãi (giảm 25% năm đầu, onboarding miễn phí) → 4 advantage → How it works → FAQ → case studies → 55+ countries → CTA → chọn vai trò admin/học viên/giáo viên/phụ huynh. |
| Giá               | Chính thức chỉ 2 gói: "Teach 'n Go" 69/tháng (EUR/USD, ~1,93 triệu đ) tối đa 100 học viên live, giáo viên/lớp không giới hạn, trả năm tặng 2 tháng; "Pro" không công bố giá (AI, nhiều cơ sở, white-label). Giới hạn gói thường: 100 AI draft, 1.000 email/tháng, 3 admin, 10GB, API chỉ đọc. Dùng thử 14 ngày không thẻ; hoàn tiền 30 ngày. Dịch vụ cài đặt: onboarding 500 EUR, đào tạo 150 EUR, chuyển dữ liệu 150 EUR. Capterra còn liệt kê 4 gói cũ 69/89/119/219 EUR.                                       |
| Tính năng         | Điểm danh vài cú click, lịch chống trùng, học phí + PayPal/Stripe, cổng học viên/phụ huynh/giáo viên, email nhóm & SMS, booking, trang đăng ký, CRM lead, điểm số, app mobile, 11 tích hợp (Zoom, Meet, Teams, Google Calendar, PayPal, Stripe, HubSpot, Zapier).                                                                                                                                                                                                                                                 |
| Review            | Capterra 4,7/5 (91), phần lớn "vendor referred – incentive offered". Khen dễ dùng, hỗ trợ nhanh. Chê lỗi giao diện/lịch, nhiều việc thủ công, báo cáo và tích hợp hạn chế, tăng giá.                                                                                                                                                                                                                                                                                                                              |

### 4.4 TutorCruncher (Anh – tutorcruncher.com)

*Hình 31 – Trang chủ TutorCruncher (popup "Bobbin – Better lessons") (4 phần)*

| **Mục**           | **Nội dung**                                                                                                                                                                                                                                                                                                                              |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị           | "Phần mềm toàn diện nhất dành cho các doanh nghiệp dạy kèm"; "Được hơn 1.800 công ty gia sư tại Anh, Mỹ và trên toàn thế giới tin dùng"; 4,8 điểm trên 500+ review (tự công bố). Nhắm agency/công ty, không nhắm gia sư cá nhân. Sản phẩm mới Bobbin: lập kế hoạch bài học, báo cáo phụ huynh, phân tích; có TutorCruncher MCP (10/2026). |
| Landing           | Hero + 2 CTA (Dùng thử miễn phí / Đặt lịch demo) → logo khách → 5 khối (tự động bảng lương, tối ưu lịch, tích hợp bảng trắng, phân tích, hỗ trợ con người) → 3 khối lợi ích ("giảm 60% công việc quản lý") → 6 testimonial → giá 3 gói → bảo mật (GDPR, Stripe) → FAQ 6 câu → blog → CTA + popup Bobbin.                                  |
| Giá               | Pay as you go từ 25 GBP/tháng (~825.000đ, + phí % giao dịch theo nghiên cứu Gemini cũ: 3,85% thẻ, 1% doanh thu offline), Startup từ 60 GBP, Enterprise từ 200 GBP; dùng thử 2 tuần; 3 tháng hỗ trợ ưu tiên; cài đặt trong 1 ngày với trợ giúp.                                                                                            |
| Cơ chế đáng chú ý | Quản lý theo "Jobs" (hợp đồng dạy dài hạn) thay vì buổi lẻ; split invoicing cho agency theo Employment Agencies Act (Anh); theo dõi 1099 cho Mỹ; cổng gia sư (lịch, báo cáo buổi, thu nhập) và cổng khách (đặt, trả, theo dõi); thu tiền bằng thẻ hoặc chuyển khoản, hoá đơn tự động, pay run tự động.                                    |

### 4.5 Comiru (POPER Inc., Nhật – comiru.co)

| **Mục**        | **Nội dung**                                                                                                                                                                                                                                                                                                                                                                                                   |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị        | Hệ thống quản lý juku "No.1 về số cơ sở triển khai" (tự công bố): "塾・スクールの業務を効率化 子どもや保護者と向き合う「教育」をご支援" (Tối ưu nghiệp vụ juku/trường để dành thời gian cho giáo dục). Công ty niêm yết (mã 5134).                                                                                                                                                                             |
| Quy mô         | Trang chủ: 7.100+ lớp, 510.000+ học sinh (1/2026). Báo cáo FY2025: 1.939 doanh nghiệp trả phí, 505.000 ID học sinh tính phí, ARR ≈ 1,206 tỷ yên (~205 tỷ đ), ARPU 51.816 yên/khách/tháng, churn 0,6%/tháng, tỷ lệ duy trì ≥99%.                                                                                                                                                                                |
| Giá            | Không công bố trên web (gửi tài liệu). Từ báo cáo chứng khoán: BASIC phí khởi tạo 30.000 yên/cơ sở (~5,1 triệu đ) + 300 yên/học sinh/tháng (~51.000đ); ComiruPay 58 yên/giao dịch + 500 yên/tháng/cơ sở; thẻ từ 1,5%; ComiruHR 300 yên/giáo viên; ComiruAir (online) từ 3.000 yên. Gói FREE: đơn đăng ký web, quản lý lead, cảm nhận học thử.                                                                  |
| Tính năng      | Thông báo & khảo sát, báo cáo giảng dạy (指導報告) có duyệt trước khi gửi và chat với phụ huynh, nghỉ/học bù, đặt lịch phỏng vấn, quản lý ra vào (thẻ in từ màn quản trị, báo phụ huynh theo thời gian thực), trích nợ/thẻ, hoá đơn, xếp thời khoá biểu tự động, chấm công & lương, tuyển sinh, đa cơ sở, bảng điểm. Tích hợp LINE từ 2018 (báo chí, review). App phụ huynh App Store 4,3/5 từ 9.803 đánh giá. |
| Review         | ITreview 3,5/5 (2 review): mạnh ở chia sẻ thời gian thực, giảm in giấy, cảnh báo ra vào, LINE; yếu ở UI khó học, mất nháp, không Zoom, muốn AI soạn báo cáo.                                                                                                                                                                                                                                                   |
| Bài học cho VN | Comiru chứng minh "báo cáo buổi học gửi phụ huynh qua chat quốc dân" là tính năng giữ chân (retention ≥99%) và sẵn sàng thu 300 yên/học sinh/tháng. Sổ Gia Sư đang làm phiên bản thủ công (ảnh PNG + Zalo) của chính cơ chế này.                                                                                                                                                                               |

### 4.6 ClassUp (Hàn Quốc – classup.io)

| **Mục**           | **Nội dung**                                                                                                                                                                                                                                                                                                                                                                                         |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị           | "학원 홍보까지 하는 학원관리프로그램, 클래스업 하나로 끝냅니다" (Chương trình quản lý hagwon kiêm quảng bá). Nhấn mạnh an toàn: khoá cửa, xác thực số/khuôn mặt/vân tay, ảnh báo đến nơi cho phụ huynh.                                                                                                                                                                                              |
| Landing (15 khối) | Hero 2 nút (Bắt đầu miễn phí / Trải nghiệm trước) → banner trung tâm trực doanh → "Chúng tôi dùng ClassUp cho học viện của mình trước" → việc tốn công nhất → an toàn/cửa → 5 loại hình → chuyển dữ liệu 15 phút → "학원찾기" 203.588 học viện → lời chủ học viện → bảng giá → kiosk Toss Front → bảo mật → FAQ → form → footer.                                                                     |
| Giá               | Free 0 won đến 100 học sinh (5 lớp, điểm danh vào/ra, không tích hợp cửa, không thống kê doanh thu, không báo cáo học tập); Lite 29.000 won (~551.000đ) 200 học sinh; Pro 89.000 won (~1,69 triệu đ) 500 học sinh; +5.000 won/100 học sinh. Tin nhắn trả trước: Alimtalk 9 won, SMS 15 won, LMS 39 won; thông báo qua app phụ huynh miễn phí. Kiosk tablet 500.000 won. Tháng đầu dùng Pro miễn phí. |
| Quy mô            | 2.724 học viện, 123.352 học sinh, 1.705 tỷ won giao dịch luỹ kế (tự công bố, không ghi năm).                                                                                                                                                                                                                                                                                                         |
| Bài học           | Freemium theo số học sinh (100) đúng như Sổ Gia Sư (8) nhưng hào phóng hơn, kiếm tiền bằng tin nhắn và kiosk; "học sinh đến nơi → phụ huynh nhận tin" là lý do phụ huynh ép học viện dùng.                                                                                                                                                                                                           |

### 4.7 Eduspace (Việt Nam – eduspace.vn)

| **Mục**              | **Nội dung**                                                                                                                                                                                                                                                                                                                                   |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị              | "Vận hành trung tâm hiệu quả hơn với Eduspace.vn – Phù hợp với mọi mô hình đào tạo – Không giới hạn thời gian dùng thử". Nhắm trung tâm ngoại ngữ, năng khiếu, mầm non, gia sư, du học, dạy nghề.                                                                                                                                              |
| Landing (14 khối)    | Nav (Giới thiệu, Tính năng, Video, Cẩm nang, Phí dịch vụ, Đăng ký) → hero → 3 nhóm (CRM, Đào tạo, E-learning) → danh sách tính năng → "Đơn giản – hiệu quả – dễ sử dụng" → cách vận hành → 2 testimonial (Bestar, Language Academy Phú Quốc) → ~15 logo → tương tác phụ huynh → báo chí (VTV1) → CTA → video → trang theo ngành → footer form. |
| Giá (tháng, trả năm) | Small 390.000đ (100 học viên, 10.000 CRM) · Plus 550.000đ (300) · Basic 790.000đ (500) · Premium 1.100.000đ (1.000) · Advance liên hệ. Nhân sự và cơ sở không giới hạn.                                                                                                                                                                        |
| Tính năng            | Học viên, danh sách chờ, bảo lưu, học bù; điểm danh, thu học phí; lương giáo viên theo bằng cấp/sĩ số/ca, hoa hồng; CRM, báo cáo; khoá học online, thi online; nhắn Zalo miễn phí + SMS; app.                                                                                                                                                  |
| So với Sổ Gia Sư     | Đối thủ VN gần nhất về điểm danh + học phí + Zalo, nhưng đắt gấp ~9 lần gói Pro và nhắm trung tâm (CRM, lương). Không thấy phiếu thu QR; không có review độc lập.                                                                                                                                                                              |

### 4.8 Shub Classroom (Việt Nam – shub.edu.vn)

*Hình 32 – Shub vai học sinh: Phòng học hôm nay, Bài tập chưa nộp, Thành tích (2 phần)*

*Hình 33 – Danh sách lớp của học sinh (Lớp của bạn / đang chờ / đã ẩn) với cột Học sinh · Bài giảng · Bài tập · Tài liệu*

*Hình 34 – Tham gia lớp bằng mã lớp 5 ký tự*

| **Mục**                                     | **Nội dung**                                                                                                                                                                                                                                                                                      |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Định vị                                     | "Một cách hiệu quả để quản lý lớp học" – LMS cho trường phổ thông và giáo viên: tài nguyên, học liệu, giao bài, thi trực tuyến, lớp online, nhiệm vụ học tập, sổ điểm, thời khoá biểu. Công ty CP Công nghệ SHub (Khu CNPM ĐHQG-HCM), VIISA đầu tư 2022.                                          |
| Quy mô (tự công bố)                         | 2.000 trường, 500.000 lớp, 3 triệu học sinh, 100.000 giáo viên, 63 tỉnh thành (trang chủ ghi bản quyền 2022; bài VIISA 2022 ghi 200+ trường – lệch 10 lần).                                                                                                                                       |
| Giá                                         | Không có bảng giá; giáo viên/học sinh miễn phí theo báo chí; học sinh mua gói hỏi gia sư 300.000đ/15 lượt… ; chân trang nhắc "gói dịch vụ trả phí".                                                                                                                                               |
| Luồng giáo viên (theo hướng dẫn ĐH Cần Thơ) | Đăng ký vai giáo viên → Tạo lớp (tên, ảnh) → nhận mã lớp + mã bảo vệ → học sinh tự tạo tài khoản và nhập mã để vào → giao bài (tải file, số câu, đáp án, thời gian, hạn nộp) → chấm tự động, thống kê. Không có bước giáo viên nhập danh sách học sinh.                                           |
| Phía học sinh (đã đăng nhập)                | Header: Tổng quan · Lớp học · Lịch học · nút "Hỏi đáp cùng SHub Share"; trang Tổng quan có menu trái Phòng học hôm nay · Bài tập chưa làm · Tài liệu chưa đọc · Bài giảng chưa xem · Thành tích; trạng thái rỗng dễ thương. Đăng nhập chỉ email/SĐT + mật khẩu, Facebook, SGD-HCM (không Google). |
| Kết luận                                    | Không cùng loại với Sổ Gia Sư: không điểm danh tính phí, không học phí, không phiếu thu, không báo cáo phụ huynh qua link. Chỉ cạnh tranh ở "giao bài & chấm" nếu Sổ Gia Sư mở rộng.                                                                                                              |

## 5. Nhóm tham khảo 2 – Sàn trung gian gia sư ↔ học viên

### 5.1 Preply (Ukraine/Mỹ – preply.com) – khảo sát sâu phía học viên

*Hình 35 – Trang chủ Preply (bản tiếng Việt, bố cục hẹp) (3 phần)*

*Hình 36 – Trang tìm gia sư tiếng Anh sau đăng nhập: 46.278 gia sư, bộ lọc, thẻ gia sư (4 phần)*

*Hình 37 – Hồ sơ gia sư Grace A: 45 USD/50 phút, top 5%, 3.340 bài, đánh giá 4 tiêu chí, lịch, bằng cấp đã xác minh (4 phần)*

*Hình 38 – Đặt buổi thử: chọn 25 phút / 50 phút (2 phần)*

*Hình 39 – Chọn ngày giờ trống theo múi giờ của học viên (2 phần)*

*Hình 40 – Checkout: 27,00 USD + phí xử lý 0,30 USD; huỷ miễn phí trước 12 giờ; thử thêm 2 gia sư miễn phí (dừng trước thanh toán)*

*Hình 41 – Trang học viên sau đăng nhập (3 phần)*

**Giao diện tĩnh**

**Trang chủ:** header (Tìm gia sư, Đào tạo doanh nghiệp, ngôn ngữ/tiền tệ, Đăng nhập) → hero "Học nhanh hơn với gia sư ngôn ngữ giỏi nhất" + "Tìm gia sư của bạn" → số liệu (100.000+ gia sư, 300.000+ review 5 sao, 120+ môn, 180+ quốc tịch, 4,8 App Store) → danh sách ngôn ngữ kèm số gia sư (Tiếng Anh 33.602…) → "Preply hoạt động như thế nào" 3 bước → "Bài học bạn sẽ yêu thích – Đảm bảo" (đổi gia sư miễn phí) → Trở thành gia sư → doanh nghiệp → footer SEO. Trang chủ không có thanh tìm kiếm.

**Trang tìm kiếm:** tiêu đề "Gia sư và giáo viên tiếng Anh trực tuyến dạy kèm riêng"; chọn ngôn ngữ + nút "Tìm gia sư của bạn"; "Hiển thị 46.278 gia sư"; bộ lọc: Mục tiêu, Trọng tâm, Giá/buổi (3–40+ USD), Cũng nói, Quốc gia, Loại gia sư, Lịch rảnh, Xem lịch đầy đủ; sắp xếp "Lựa chọn hàng đầu". Thẻ gia sư: ảnh + video; tên; huy hiệu "Siêu gia sư"/"Chuyên nghiệp"; môn + ngôn ngữ nói (trình độ); rating + số đánh giá; số học sinh; số bài học; tagline + bio cắt ngắn "Tìm hiểu thêm"; nhãn "Khuyến khích"; nút "Đặt lịch học thử" (hồng) và "Gửi tin nhắn"; cột phải "Xem lịch trình đầy đủ"/"Xem hồ sơ".

**Hồ sơ gia sư:** video giới thiệu; "Phong cách giảng dạy" (tag từ dữ liệu + review); "Thuộc top 5% gia sư"; "Gia sư chuyên nghiệp – chứng chỉ được xác nhận"; Về tôi (dài); Tôi nói; "Đánh giá bài học" 4 tiêu chí (Trấn an, Rõ ràng, Tiến độ, Chuẩn bị – 45 đánh giá ẩn danh); 25 review có ngày; Lịch tuần; Resume (bằng cấp "Diploma verified"); chuyên môn; gợi ý gia sư khác với giá; thẻ dính bên phải: 45 USD/50 phút, 5★ 25 đánh giá, 3340 bài, "Đặt lịch học thử", "Bạn vẫn còn 2 buổi học thử gia sư miễn phí".

**Cơ chế vận hành (đã xác minh trên help center)**

- Hoa hồng gia sư 33% → 28% sau 20 giờ → sàn 18% theo tổng giờ tích luỹ; buổi thử đầu với mỗi học viên mới: 100% hoa hồng (gia sư nhận 0). Học viên trả thêm "Processing Fee" (0,30 USD trong ví dụ).

- Buổi thử có phí (27 USD cho gia sư 45 USD/50 phút khi chọn 25 phút); huỷ/dời miễn phí trước 12 giờ; nếu không hợp được thử thêm 2 gia sư miễn phí; thuê bao 28 ngày tối thiểu 4 bài, bài chưa xếp hết hạn khi gia hạn; tài khoản 180 ngày không dùng mất số dư.

- Đăng ký gia sư 8 phần (ảnh, chứng chỉ, học vấn, mô tả, video 30 giây–2 phút theo quy tắc nghiêm, lịch rảnh, giá); duyệt 3–5 ngày làm việc; xác minh danh tính/bằng cấp cho huy hiệu; Super Tutor xét hàng tháng trên 90 ngày (≥40 bài, ≥4,8★, chuyển đổi buổi thử ≥50%, trả lời 80% trong 24h, ≥80% buổi thử trong Preply Classroom).

- Chống đi ngang: cấm trao đổi liên hệ trước khi trả bài đầu, cấm dạy ngoài nền tảng; vi phạm khoá hồ sơ. Review không kiểm duyệt trừ khi bị báo cáo. Rút tiền tối đa 3.000 USD/lần qua Wise/PayPal (2%)/Skrill (1%)/Payoneer.

- Quy mô: 100.000+ gia sư, 180 nước; Series D 150 triệu USD, định giá 1,2 tỷ USD (1/2026, Bloomberg xác nhận). Trustpilot 4,4/5 (25.811 review, 13% 1 sao): phí dịch vụ tăng không báo, bài hết hạn, thuê bao khó đoán; petition về 100% hoa hồng buổi thử.

### 5.2 Superprof (Pháp – superprof.vn có bản Việt Nam)

*Hình 42 – superprof.vn: hero "Tìm gia sư phù hợp nhất", thanh tìm kiếm, chip môn, "45 hàng triệu gia sư đã đánh giá", thẻ gia sư với giá VND/giờ và "1 buổi học miễn phí" (4 phần)*

**Giao diện:** header (logo, Dạy học, Kết nối, dấu hỏi); hero chữ lớn + thanh tìm kiếm "Thử ngay Lập trình" + nút hồng "Tìm kiếm"; dải chip môn (Tiếng Anh, Toán, Tiếng Việt cho người nước ngoài, Tiếng Trung, Luyện thi IELTS, Hoá học…); lưới thẻ gia sư 3 cột: ảnh lớn phủ tên + thành phố "(học trực tuyến)", nút tim, dòng "5 (7 lượt đánh giá) · Gia sư được đề xuất" hoặc "Gia sư mới", môn – bio 2 dòng, giá "200.000 VNĐ/giờ · 1 buổi học miễn phí" (quan sát 120.000–200.000đ/giờ); khối "Bạn có thể trở thành một gia sư tuyệt vời"; "Khám phá thành phố của bạn"; review. Lưu ý: subagent nghiên cứu không mở được superprof.vn nhưng khảo sát trực tiếp xác nhận bản Việt Nam hoạt động.

**Mô hình:** học viên mua "Student Pass" thuê bao để liên hệ gia sư (39 GBP/tháng Anh, 49 USD/tháng Mỹ; mức VN chưa thấy); gia sư đăng miễn phí, giữ 100% nếu thu trực tiếp, phí 10% nếu thanh toán qua Superprof; bài học đầu thường miễn phí; không hoa hồng buổi học → không có cơ chế chống đi ngang. Quy mô: ~60 triệu EUR doanh thu/năm (phỏng vấn 11/2025), mua Tutors.com 9/2026, không gọi vốn ngoài. Trustpilot: điểm ẩn do vi phạm, 16% 1 sao, khiếu nại chính về phí 49 USD không rõ và không hoàn tiền.

### 5.3 Wyzant (Mỹ, thuộc IXL – wyzant.com) – khảo sát phía học viên

*Hình 43 – Hồ sơ gia sư Wyzant: 125 USD/giờ, 5★ 2.081 đánh giá, 1.327 giờ dạy, phản hồi 14 phút, "Giờ đầu được bảo đảm Phù hợp" (3 phần)*

*Hình 44 – Dashboard học viên: yêu cầu thêm thông tin thanh toán trước khi nhắn gia sư (2 phần)*

**Giao diện:** sau đăng nhập Google, Wyzant hỏi "Bạn muốn học gì?" rồi ghép thẳng sang hồ sơ gia sư. Hồ sơ: ảnh, tiêu đề, 5★ + số review, "Đã dạy kèm X giờ", nhãn "Buổi học đầu tiên được đảm bảo Phù hợp", "Giá mỗi giờ", nút cam "Liên hệ", thời gian phản hồi; cột phải: đánh giá nổi bật, "Điều kiện để học", môn liên quan, hourly rate, lịch. Dashboard học viên: cảnh báo thẻ, Bài học đã lên lịch, Gia sư của tôi, Chia sẻ yêu cầu, tải app, menu Tài khoản (Gia sư của tôi, Bài học, Bản ghi âm, Thanh toán, Giao dịch, Phiếu giảm giá).

**Mô hình:** gia sư nhận 75%, Wyzant giữ 25% (100% nếu học sinh do gia sư tự giới thiệu); học viên trả thêm 9% phí dịch vụ + thuế, trả sau từng buổi; trả gia sư ngày 1 và 15 qua chuyển khoản; cần SSN/W-9 từ 50 USD; không nhận tiền ngoài nền tảng. Good Fit Guarantee: hoàn giờ đầu với gia sư mới trong 30 ngày. 65.000 gia sư, 12+ triệu buổi, 3+ triệu học sinh (tự công bố). Trustpilot 1,6/5 (1.534): tính phí trái ý, hoàn tiền khó, từ chối đơn gia sư không rõ lý do.

### 5.4 italki

Sàn ngôn ngữ 1-1 + lớp nhóm + cộng đồng miễn phí; "Start real learning, see clear progress – No subscriptions"; 20.000–30.000 giáo viên, 150+ ngôn ngữ, 10+ triệu học viên (tự công bố). Thẻ giáo viên: tên + tagline, sao, số buổi, "id verified", nhãn Professional Teacher/Community Tutor, ngôn ngữ, thẻ chuyên môn, giá thử hoặc giá/giờ, giờ trống gần nhất, nút Book trial/Book lesson; bộ lọc danh mục, giá, giờ, ngôn ngữ nói, quốc gia. Hoa hồng: help center ghi bậc thang buổi thử 0% · buổi lẻ 21% · gói 5 buổi 19% · 10 buổi 17% · 15–20 buổi 15% · lớp nhóm 30%; trang chính sách cũ ghi 15% – mâu thuẫn chưa giải quyết. Học viên trả bằng italki Credits (~1 USD), buổi thử giảm ~50% tối đa 3 lần, chọn italki Classroom/Zoom. Professional cần CELTA/TESOL 120h/bằng sư phạm; đơn duyệt 10 ngày, onboarding 15 ngày; mở đơn theo ngôn ngữ hàng tuần (tiếng Việt đang đóng tuần 19–25/10/2026). Trustpilot 4,4/5 (15.019): chê hỗ trợ khó liên hệ, lịch trên app kém.

### 5.5 Daykemtainha.vn (Trung tâm gia sư Tài Năng Trẻ, TP.HCM)

**Giao diện (mô tả vì không dựng được ảnh):** header xanh lá với 2 hotline + email, logo; menu Trang chủ · Lớp mới (Hot) · Gia sư · Học phí tham khảo (New) · Tìm gia sư · Đăng ký làm gia sư · Bài viết · Liên hệ; hero ảnh lớp học + "Đội ngũ gia sư Tài Năng Trẻ có hơn 30.000 giáo viên và sinh viên giỏi" + "HÃY TÌM GIA SƯ GIỎI NGAY!" + ô "Hãy nhập một môn học!" + nút "Tìm Gia Sư Ngay!" + "Hoặc gọi ngay 090.333.1985 – 09.87.87.0217 cô Mượt"; nút điện thoại nổi góc trái. Trang /lop-hoc: bộ lọc Môn học + Khu vực; thẻ lớp: tiêu đề "Cần Gia Sư Môn Toán Lớp 6 Tại Quận 8", Mã lớp 27432, "Học phí: 150,000/Buổi", nút xanh "phí: 25% (300,000) Nhận lớp ngay", mô tả nhu cầu (nữ, lớp 6, tối 19:00–20:30, thứ 4 và 5), Tạo lúc, Yêu cầu gia sư (nữ sinh viên), Tuần học 2 buổi (90 phút/buổi), 1 học viên, địa điểm có bản đồ; cột phải: "Bạn đã tham gia đội ngũ Gia Sư của chúng tôi chưa?" + hotline + "Gia sư cần biết" (Quy trình nhận lớp, Hợp đồng mẫu).

**Mô hình:** môi giới thu một lần phí nhận lớp từ gia sư (25% học phí tháng đầu cho năng khiếu/ngoại ngữ, 25–30% môn văn hoá theo hợp đồng mẫu; nút trên thẻ hiện 10–25%) đóng trước khi nhận Giấy giới thiệu; hoàn 100% nếu phụ huynh từ chối, giữ 10% nếu lỗi gia sư chưa nhận lương, không hoàn nếu vi phạm; hợp đồng kết thúc sau tháng đầu. Phụ huynh đăng yêu cầu (SĐT, tóm tắt ≤20 từ, địa điểm, số học viên, ngày bắt đầu, môn, mô tả; tuỳ chọn giờ/buổi, giới tính, mức phí, số buổi, mã khuyến mãi giảm 200.000đ) sau khi đăng nhập; yêu cầu được kiểm duyệt. Không có lịch, thanh toán, rating trên thẻ, không có điều khoản chống đi ngang. Pháp nhân: CÔNG TY TNHH DỊCH VỤ TÀI NĂNG TRẺ, Q.8; FAQ ghi 4 tài khoản ngân hàng đứng tên cá nhân. Không tìm thấy khiếu nại trực tiếp; bối cảnh ngành có nhiều cảnh báo lừa "phí nhận lớp" (Tuổi Trẻ 2021).

### 5.6 Snapask và Ruangguru (châu Á, số liệu cũ)

- Snapask (Hong Kong): app chụp câu hỏi → gia sư giải 1-1; 2020: 3 triệu học viên, 2+ triệu câu hỏi/tháng, ~60 câu/người thuê bao/tháng, 350.000 đơn gia sư, gia sư ~2 giờ/ngày kiếm ~1.200 USD/tháng; vòng B 35 triệu USD; thị trường HK, Đài Loan, Malaysia, Indonesia, Thái, Nhật, Hàn, dự kiến VN. Không có số mới hơn.

- Ruangguru (Indonesia): nền tảng học theo gói, không phải sàn thuần; 2021: 22+ triệu học viên, 300.000 giáo viên đối tác, có lãi 2020, tổng vốn 200+ triệu USD; 2022 sa thải hàng trăm người, chuyển sang học lai với 100+ Learning Centers; có mặt VN (KienGuru) và Thái (StartDee).

## 6. Bảng so sánh tổng hợp

### 6.1 Tính năng lõi – nhóm SaaS

| **Tính năng**        | **Sổ Gia Sư**                               | **TutorBird**                                    | **Teachworks**                                      | **Teach 'n Go** | **TutorCruncher**         | **Comiru**                | **ClassUp**               | **Eduspace**           |
|----------------------|---------------------------------------------|--------------------------------------------------|-----------------------------------------------------|-----------------|---------------------------|---------------------------|---------------------------|------------------------|
| Đơn vị thanh toán    | Học sinh trong lớp                          | Gia đình                                         | Khách hàng/gia đình                                 | Học viên        | Khách/Job                 | Học sinh                  | Học sinh                  | Học viên               |
| Cách tính phí        | Theo buổi/giờ/khoá, phát sinh khi chốt buổi | Mỗi bài/tháng/giờ/không phí; ghi nợ khi lên lịch | Giá dịch vụ/hồ sơ/phí cố định/gói; ghi đè theo buổi | Theo gói/khoá   | Theo job                  | Theo tháng, trích nợ      | Theo tháng                | Theo khoá/tháng        |
| Điểm danh            | Có mặt/Vắng/Có phép + % BTVN + điểm         | 8 trạng thái (5 tính phí), make-up credit        | Attended/Cancelled/Missed                           | Có              | Có                        | Ra/vào thẻ, báo phụ huynh | Kiosk số/mặt/vân tay, cửa | Có                     |
| Hoá đơn/phiếu        | Phiếu ảnh + QR VietQR, không cổng           | Hoá đơn tự động, Stripe/PayPal                   | Hoá đơn, Stripe, QuickBooks                         | PayPal/Stripe   | Thẻ/chuyển khoản, pay run | ComiruPay 58¥/giao dịch   | VAN/PG                    | Thu học phí, Zalo nhắc |
| Kênh phụ huynh       | Link công khai + ảnh Zalo                   | Cổng + email/SMS                                 | Cổng + email, SMS credit                            | Cổng + app      | Cổng khách                | App + LINE                | App + Alimtalk            | App + Zalo             |
| Nhiều giáo viên      | Không                                       | Có (+4,95 USD/GV)                                | Có, lương                                           | Có              | Có, lương                 | Có, chấm công             | Có (Lite+)                | Có, lương              |
| Online               | Meet/Zoom link                              | Zoom/Skype/FaceTime                              | Link, Lessonspace, Pencil                           | Zoom/Meet/Teams | Bobbin, bảng trắng        | ComiruAir                 | —                         | Khoá online            |
| App native           | PWA                                         | Web                                              | Web                                                 | iOS/Android     | Web                       | iOS                       | iOS/Android               | Có                     |
| Giá tham chiếu/tháng | 42.000đ                                     | ~432.000đ                                        | ~1,7 triệu đ (20 HS×8)                              | ~1,93 triệu đ   | ~825.000đ+                | ~1,3 triệu đ (25 HS×300¥) | 0đ (\<100 HS)             | 390.000đ               |

### 6.2 Mô hình thu tiền – nhóm sàn

| **Sàn**      | **Ai trả nền tảng**                      | **Mức**                               | **Buổi thử**                                 | **Chống đi ngang**                         | **Thẻ gia sư hiển thị**                                         |
|--------------|------------------------------------------|---------------------------------------|----------------------------------------------|--------------------------------------------|-----------------------------------------------------------------|
| Preply       | Gia sư (hoa hồng) + học viên (phí xử lý) | 33%→18%; 100% buổi thử                | Có phí, huỷ trước 12h, đổi 2 gia sư miễn phí | Cấm liên hệ trước khi trả; khoá hồ sơ      | Giá/bài, ★ + số review, số HS, số bài, huy hiệu, video          |
| Superprof    | Học viên (Student Pass 39 GBP/49 USD)    | 0% nếu thu trực tiếp; 10% nếu qua sàn | Thường miễn phí                              | Không có                                   | Giá/giờ, ★ + số review, "Gia sư mới", 1 buổi miễn phí           |
| Wyzant       | Gia sư 25% + học viên 9%                 | 25% (0% khách tự giới thiệu)          | Giờ đầu hoàn tiền (Good Fit)                 | Cấm nhận tiền ngoài; trả 1 & 15 hàng tháng | Giá/giờ, ★ + review, giờ dạy, phản hồi, InstantBook             |
| italki       | Gia sư theo gói                          | 15–30% (buổi thử 0%)                  | Giảm ~50%, tối đa 3                          | Credits trong sàn                          | Giá, ★, số buổi, Professional/Community, id verified            |
| Daykemtainha | Gia sư một lần                           | 10–30% học phí tháng đầu              | Không                                        | Thu phí trước thay cho hợp đồng            | Không giá, không rating; thẻ LỚP có học phí/buổi + phí nhận lớp |

## 7. Đối chiếu với nghiên cứu trước của bạn (file kin-deep-research-phan-mem-gia-su.txt)

Nghiên cứu Gemini (30/9/2026) kết luận ba "khoảng trống" mà các công cụ quốc tế đều chưa giải quyết cho phân khúc 1–3 giáo viên. Khảo sát hôm nay cho thấy Sổ Gia Sư đã chạm vào cả ba ở mức độ khác nhau:

| **Khoảng trống (Gemini)**                      | **Sổ Gia Sư đang làm**                                           | **Còn thiếu**                                                            | **Bên nào làm tốt nhất**                                                  |
|------------------------------------------------|------------------------------------------------------------------|--------------------------------------------------------------------------|---------------------------------------------------------------------------|
| 1\. Tối giản, ẩn tính năng thừa                | 11 mục menu, không website builder, không thư viện; wizard 1 màn | Không có chế độ "ẩn mục chưa dùng"; Kho tài liệu/Phân tích vẫn chiếm chỗ | Sổ Gia Sư (so với 13 mục TutorBird, 30+ mục Teachworks)                   |
| 2\. Giao tiếp đa kênh trên chat nội địa (Zalo) | Xuất ảnh/link để gửi Zalo thủ công; nhóm Zalo hỗ trợ             | Không có Zalo OA/ZNS gửi tự động; không biết phụ huynh đã xem            | Comiru (LINE), ClassUp (Alimtalk), Eduspace (Zalo miễn phí)               |
| 3\. Đối soát chuyển khoản 0 phí                | QR VietQR đúng số tiền + nội dung; đánh dấu "Đã thu" thủ công    | "Đối soát chuyển khoản vào học phí" chỉ mới "sắp có" (Pro)               | Chưa bên nào trong danh sách làm được không phí; Comiru thu 58¥/giao dịch |

Ngưỡng giá Gemini ước tính 150.000–500.000đ/tháng cho 25 học sinh; Sổ Gia Sư định giá 42.000–60.000đ – thấp hơn 3–10 lần, cho thấy họ chọn chiến lược khối lượng (gia sư cá nhân) chứ không phải trung tâm. Kết luận Gemini "điểm danh + học phí + nhắc phụ huynh là lõi mọi công cụ đều làm" được xác nhận; riêng "nhắc phụ huynh" Sổ Gia Sư chưa làm tự động.

## 8. Định hướng sản phẩm của bạn (theo 4 quyết định đã chốt)

Mục này thay cho "hàm ý và câu hỏi" của bản 1. Bốn câu hỏi bạn đã trả lời trở thành khung cố định; mọi đề xuất bên dưới chỉ lấp đầy khung đó bằng những gì đã quan sát được ở Sổ Gia Sư và 14 nền tảng tham khảo. Những chỗ tôi phải chọn thay bạn được đánh dấu rõ là "đề xuất" để bạn gật hoặc lắc, không phải quyết định.

### 8.1 Bốn quyết định đã chốt và hệ quả trực tiếp

| **\#** | **Quyết định của bạn**                                                                                                                      | **Hệ quả đối với thiết kế**                                                                                                                                                                                                                                                                                                                                                                          |
|--------|---------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | Gia sư là người dùng chính (dùng hằng ngày). Học sinh/phụ huynh có thể vào tìm gia sư – sản phẩm kiêm vai trung gian giúp hai bên gặp nhau. | Mô hình "hai mặt nhưng lệch": mặt SaaS (lịch – điểm danh – phí – phiếu QR) là sản phẩm; mặt sàn (hồ sơ gia sư công khai + trang tìm gia sư) là kênh kéo nhu cầu về cho gia sư. Không thu hoa hồng, không giữ tiền hộ, không xếp lịch hộ – khác hẳn Preply/Wyzant/Daykemtainha. Hồ sơ công khai được sinh từ dữ liệu vận hành thật (số buổi đã dạy, tỷ lệ đúng hẹn), đây là lợi thế không sàn nào có. |
| 2      | Kênh phụ huynh giữ như Sổ Gia Sư: Zalo thủ công, tối thiểu chi phí.                                                                         | Không ZNS, không SMS, không app phụ huynh. Sản phẩm phải làm "gửi Zalo" nhanh hơn Sổ Gia Sư: soạn sẵn nội dung + ảnh + link trong một nút; dùng deep-link zalo.me/\<số điện thoại\>; ghi lại "đã gửi lúc" để gia sư không gửi trùng. Chi phí vận hành kênh = 0đ.                                                                                                                                     |
| 3      | Đối soát chuyển khoản bán tự động: gia sư tự thêm ảnh chuyển khoản. Chưa có pháp nhân/đối tác ngân hàng.                                    | Không webhook ngân hàng, không cổng thanh toán, không giấy phép trung gian thanh toán. Mỗi phiếu thu có ô "Đính kèm ảnh chuyển khoản"; hệ thống chỉ đọc số tiền/ngày từ ảnh nếu làm được (OCR giai đoạn sau), còn lại gia sư xác nhận. Giá trị tạo ra: bằng chứng thu tiền gắn với từng buổi/từng học sinh, trang phụ huynh hiện "Đã nhận ✓" – thứ Sổ Gia Sư mới chỉ hứa.                            |
| 4      | Trước mắt miễn phí toàn bộ; chạy ổn rồi mới nâng Pro (hạn mức tham chiếu Sổ Gia Sư).                                                        | Giai đoạn chạy thử: một gói Free duy nhất, không khoá tính năng nào (kể cả phần sàn). Hạn mức 8 học sinh / 4 mẫu phiếu / 50MB của Sổ Gia Sư chỉ là tham chiếu để thiết kế sẵn cơ chế hạn mức; chưa bật. Khi bật Pro sau này, mốc ~42.000đ/tháng là điểm so sánh trực tiếp. Mọi hạn mức phải cấu hình được từ admin, không viết cứng trong mã, để bật/tắt không cần phát hành lại.                    |

### 8.2 Mô hình sản phẩm lai: SaaS cho gia sư + "góc tìm gia sư" cho phụ huynh

#### 8.2.1 Ba vai và quyền hạn

| **Vai**                      | **Cần tài khoản?**                | **Làm được gì**                                                                                                                                                                                                                   | **Không làm được gì (cố ý)**                                                                                                 |
|------------------------------|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Gia sư / giáo viên           | Có (email, Google, số điện thoại) | Toàn bộ SaaS: lớp, học sinh, buổi, điểm danh, phí, phiếu QR, ảnh chuyển khoản, báo cáo; bật/ẩn hồ sơ công khai và chọn phần nào hiện (trừ nhóm trường bắt buộc, xem 8.3); nhận và trả lời yêu cầu tìm gia sư; gửi Zalo phụ huynh. | Không xem hồ sơ gia sư khác; không nhận tiền qua hệ thống.                                                                   |
| Phụ huynh / học sinh (khách) | Không                             | Xem trang báo cáo qua link (như Sổ Gia Sư); duyệt trang tìm gia sư với bộ lọc; xem hồ sơ công khai; bấm "Nhắn Zalo" hoặc gửi "Yêu cầu tìm gia sư" bằng form 5 ô.                                                                  | Không đặt lịch, không thanh toán, không đánh giá công khai (giai đoạn 1) – tránh gánh nặng kiểm duyệt khi chưa có pháp nhân. |
| Quản trị (bạn)               | Có                                | Duyệt/ẩn hồ sơ công khai bị báo cáo, điều chỉnh hạn mức Free/Pro, xem số liệu phễu (hồ sơ → lượt xem → yêu cầu → lớp được tạo).                                                                                                   | —                                                                                                                            |

#### 8.2.2 Vòng lặp lõi (giữ nguyên của Sổ Gia Sư) và vòng lặp mới (sàn)

Vòng lặp lõi: Tạo lớp → Buổi → Điểm danh → Phí (chỉ khi "Đã dạy xong") → Phiếu QR → Thu tiền (có ảnh) → Báo cáo phụ huynh. Đây là thứ Sổ Gia Sư đã chứng minh đúng với thói quen gia sư Việt Nam (mục 3) và không nên thay đổi về bản chất; chỉ sửa 12 điểm nghẽn ở mục 3.6 (bảng 8.6).

Vòng lặp mới: Gia sư dạy thật trên hệ thống → hồ sơ công khai tự cập nhật "đã dạy N buổi, M học sinh, đúng hẹn X%" → phụ huynh tìm thấy → nhắn Zalo / gửi yêu cầu → gia sư "Nhận lớp" → hệ thống tạo sẵn Lớp + Học sinh từ yêu cầu → quay lại vòng lặp lõi. Điểm mấu chốt: mặt sàn không có bước nào cần tiền hay cần phụ huynh đăng nhập, nên chi phí gần như bằng 0 và không đụng pháp lý trung gian thanh toán.

> **Lưu ý:** Sàn kiểu này khác Daykemtainha (thu 10–30% học phí tháng đầu) và Superprof (bán Student Pass cho học viên): bạn không thu phí kết nối ở bất kỳ phía nào. Doanh thu duy nhất là gói Pro. Điều này hợp với việc chưa có pháp nhân, nhưng cũng có nghĩa mặt sàn chỉ là "mồi" cho SaaS – cần đo đúng chỉ số (mục 8.8).

### 8.3 Mô hình dữ liệu đề xuất

Giữ nguyên 6 thực thể của Sổ Gia Sư, thêm 5 thực thể cho ảnh chuyển khoản và sàn. Cột "Khác Sổ Gia Sư" ghi đúng chỗ sửa.

| **Thực thể**                     | **Trường chính**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Khác Sổ Gia Sư ở điểm nào**                                                                                                       |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Gia sư (Tutor)                   | tên, điện thoại (dùng cho zalo.me), email, ngân hàng + STK (cho VietQR), gói (Free/Pro), hạn Pro                                                                                                                                                                                                                                                                                                                                                                                                                                | Thêm: cờ "hồ sơ công khai", slug công khai (/gs/\<slug\>).                                                                          |
| Hồ sơ công khai (TutorProfile)   | Trạng thái: Hiện / Ẩn (gia sư tự chọn). Nhóm BẮT BUỘC hiện khi hồ sơ đang Hiện: trường đang học/đã tốt nghiệp, bằng cấp hoặc chứng chỉ chính (ví dụ IELTS, bằng sư phạm), môn/cấp dạy, khu vực, hình thức online/offline. Nhóm TUỲ CHỌN (gia sư bật/tắt từng mục): ảnh, giá tham khảo theo buổi, giới thiệu ≤ 600 ký tự, lịch trống (suy từ lịch lớp), số điện thoại Zalo (nếu tắt thì phụ huynh chỉ gửi được yêu cầu). Chỉ số tự động luôn hiện và không sửa được: số buổi đã dạy, số học sinh đang dạy, tỷ lệ chốt đúng ngày. | Mới. Bằng cấp/trường do gia sư tự khai; giai đoạn 1 chỉ gắn nhãn "Tự khai", chưa xác minh. Chỉ số tự động là thứ sàn khác không có. |
| Lớp (Class)                      | như Sổ Gia Sư + loại phí (buổi/giờ/khoá) + "cho phép đổi loại phí cho buổi tương lai"                                                                                                                                                                                                                                                                                                                                                                                                                                           | Mở khoá loại phí có kiểm soát (nghẽn \#2).                                                                                          |
| Học sinh (Student)               | như Sổ Gia Sư + SĐT Zalo phụ huynh + link báo cáo + PIN 4 số (tuỳ chọn)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | PIN giải nghẽn \#7 (ai có link cũng xem được).                                                                                      |
| Buổi (Lesson)                    | như Sổ Gia Sư + trạng thái mở rộng: Chưa dạy / Đã dạy / Nghỉ có báo trước (không phí) / Nghỉ không báo (tính phí tuỳ cài đặt) / Dạy bù của buổi X                                                                                                                                                                                                                                                                                                                                                                               | TutorBird có 8 trạng thái (5 tính phí, 3 không); Sổ Gia Sư 3. "Dạy bù" là thói quen VN rất phổ biến.                                |
| Điểm danh (Attendance)           | như Sổ Gia Sư + ghi chú buổi + ảnh bài làm (≤ 3 ảnh, tính vào 50MB)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ảnh bài làm là lý do phụ huynh mở link.                                                                                             |
| Khoản phí (Fee)                  | như Sổ Gia Sư + "phí khác" gắn kỳ + "thu trước gói N buổi, trừ dần"                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Gói buổi như TutorBird Packages; giải nghẽn thu đầu tháng.                                                                          |
| Phiếu thu (Receipt)              | như Sổ Gia Sư + nội dung CK chuẩn hoá: \<mã học sinh\>-\<tháng\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Nội dung CK có cấu trúc để sau này đối soát OCR/sao kê.                                                                             |
| Ảnh chuyển khoản (TransferProof) | ảnh (jpg/png ≤ 2MB), phiếu thu liên quan, số tiền đọc được (nếu OCR), ngày đọc được, trạng thái: Chờ xác nhận / Đã khớp / Lệch số tiền, người xác nhận = gia sư                                                                                                                                                                                                                                                                                                                                                                 | Mới (quyết định 3). Một ảnh có thể gắn nhiều phiếu (phụ huynh chuyển gộp).                                                          |
| Khoản thu (Payment)              | như Sổ Gia Sư + tham chiếu TransferProof (có thể null = thu tiền mặt)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Thu tiền mặt vẫn cho phép, không ảnh.                                                                                               |
| Yêu cầu tìm gia sư (Lead)        | môn, cấp, khu vực, hình thức, lịch mong muốn, SĐT Zalo phụ huynh, ghi chú; trạng thái: Mới / Gia sư đã nhận / Thành lớp / Huỷ                                                                                                                                                                                                                                                                                                                                                                                                   | Mới. Form 5–6 ô, không cần đăng nhập, có chống spam (reCAPTCHA v3 + giới hạn theo IP).                                              |
| Kết nối (Match)                  | lead ↔ gia sư, thời điểm gia sư nhận, lớp được tạo từ lead (nếu có)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Mới. Dùng để đo phễu sàn → SaaS.                                                                                                    |

### 8.4 Các luồng chính

**A. Gia sư vào lần đầu (mục tiêu: có lớp đầu tiên trong 2 phút như Sổ Gia Sư)**

1.  Đăng ký bằng Google hoặc số điện thoại → vào thẳng màn "Tạo lớp đầu tiên" (không màn tổng quan trống).

2.  Màn tạo lớp giữ 3 bước trong một trang của Sổ Gia Sư (thông tin – lịch – học sinh dán từ Excel); thêm ô "SĐT Zalo phụ huynh" ngay cạnh tên học sinh để kênh Zalo dùng được từ buổi đầu.

3.  Sau khi tạo: hộp "Việc tiếp theo" 3 dòng – cấu hình ngân hàng cho QR (1 lần), bật hồ sơ công khai (tuỳ chọn), gửi link báo cáo cho phụ huynh.

**B. Chốt buổi và thu tiền (vòng lặp hằng tuần)**

1.  Trang chủ hiện "Buổi hôm nay" + "Buổi quá hạn chưa chốt" (giải nghẽn \#1: quên bấm Đã dạy xong). Chốt một chạm cho cả lớp, sửa lẻ từng học sinh.

2.  Khi đủ điều kiện (cuối tháng hoặc đủ gói buổi), hệ thống gợi ý "Tạo phiếu thu cho 5 học sinh" → sinh phiếu QR hàng loạt với nội dung CK chuẩn.

3.  Nút "Gửi Zalo" trên từng phiếu: sao chép sẵn nội dung + tải ảnh phiếu + mở zalo.me/\<SĐT phụ huynh\>. Ghi "đã gửi lúc …". Đây là toàn bộ "tự động hoá" của kênh Zalo thủ công – không tốn phí.

**C. Đối soát bằng ảnh chuyển khoản (quyết định 3)**

1.  Phụ huynh chuyển khoản và gửi ảnh qua Zalo như hiện nay. Gia sư mở phiếu thu → "Thêm ảnh chuyển khoản" (chọn ảnh từ máy hoặc kéo thả).

2.  Giai đoạn 1: gia sư nhập/ xác nhận số tiền; hệ thống so với phiếu: khớp → phiếu chuyển "Đã thu (có ảnh)"; lệch → cảnh báo và cho ghi nhận thu một phần.

3.  Giai đoạn 2 (khi có lưu lượng): OCR ảnh ngân hàng phổ biến (Vietcombank, Techcombank, MB, BIDV, VietinBank, ACC, TPBank, MoMo) để điền sẵn số tiền/ngày/nội dung; gia sư chỉ bấm xác nhận. Vẫn không cần đối tác ngân hàng.

4.  Trang phụ huynh hiện dòng "Học phí tháng 10: Đã nhận ✓ (20/10)" – không hiện số tiền trừ khi gia sư bật. Ảnh chuyển khoản không bao giờ hiện cho phụ huynh khác.

5.  Hoàn tác giữ hai bước như Sổ Gia Sư; xoá ảnh không xoá khoản thu (phải hoàn tác khoản thu trước).

> **Lưu ý:** Ảnh chuyển khoản có thể bị chỉnh sửa. Vì gia sư là người tự xác nhận và tự chịu, sản phẩm chỉ cần nói rõ "ảnh là bằng chứng do bạn lưu, hệ thống không xác minh với ngân hàng". Không hứa "đối soát tự động" như Sổ Gia Sư đang hứa.

**D. Phụ huynh tìm gia sư (mặt sàn, không đăng nhập)**

1.  Trang /tim-gia-su: bộ lọc môn, cấp, quận/huyện, online/offline, khoảng giá; sắp xếp mặc định theo "đang hoạt động" (có buổi chốt trong 30 ngày) rồi theo gói Pro.

2.  Thẻ gia sư: ảnh, tên, môn/cấp, khu vực, giá tham khảo, 3 chỉ số tự động ("đã dạy 128 buổi trên hệ thống", "đang dạy 6 học sinh", "chốt buổi đúng ngày 92%"), nút "Nhắn Zalo" (deep-link) và "Gửi yêu cầu".

3.  Form yêu cầu 6 ô (môn, cấp, khu vực, lịch, SĐT Zalo, ghi chú) → gửi đến gia sư được chọn, hoặc "gửi cho gia sư phù hợp" (tối đa 5 gia sư cùng bộ lọc) nếu phụ huynh không chọn ai. Chống spam rẻ nhất: reCAPTCHA v3 (miễn phí) + tối đa 3 yêu cầu/ngày/số điện thoại + 10/ngày/IP; không OTP (OTP Zalo/SMS tốn vài trăm đồng mỗi lần).

4.  Gia sư nhận thông báo trong app + email; bấm "Nhận lớp" → màn tạo lớp đã điền sẵn tên học sinh, SĐT phụ huynh, môn → vào vòng lặp lõi. Lead chuyển "Thành lớp".

5.  Không có đánh giá sao công khai ở giai đoạn 1; thay bằng chỉ số tự động (không giả được vì sinh từ dữ liệu chốt buổi). Có nút "Báo cáo hồ sơ" cho quản trị ẩn thủ công. Thẻ gia sư luôn hiện nhóm bắt buộc (trường, bằng cấp chính, môn/cấp, khu vực) kể cả khi gia sư ẩn ảnh, giá hay SĐT.

**E. Trang báo cáo phụ huynh (giữ của Sổ Gia Sư, sửa 3 chỗ)**

1.  Sửa lỗi lọc theo ngày ≤ hôm nay: hiện mọi buổi đã có trạng thái, kể cả chốt trước ngày (bug quan sát ở mục 3.4).

2.  PIN 4 số tuỳ chọn + dấu "phụ huynh đã xem lúc …" cho gia sư (nghẽn \#7).

3.  Thêm khối "Học phí: Đã nhận ✓ / Chưa" và ảnh bài làm từng buổi; giữ nút Tải PDF và ảnh PNG từng buổi để gửi Zalo.

### 8.5 Gói và hạn mức (quyết định 4: miễn phí toàn bộ khi chạy thử, Pro bật sau)

Khi ra mắt chỉ có một gói Free, không khoá gì. Bảng dưới là thiết kế sẵn cho ngày bật Pro: cột Free là hạn mức sẽ áp khi đó (tham chiếu Sổ Gia Sư), cột Pro là phần mở thêm. Trong thời gian chạy thử, mọi người dùng được hưởng cột Pro mà không trả tiền; hệ thống vẫn đếm để biết bao nhiêu người vượt hạn mức Free – đó là số liệu quyết định thời điểm bật Pro.

| **Hạng mục**                             | **Free (áp dụng khi bật Pro)**        | **Pro (sau này, tham chiếu ~42.000đ/tháng trả năm)**                                             |
|------------------------------------------|---------------------------------------|--------------------------------------------------------------------------------------------------|
| Học sinh đang dạy                        | 8                                     | Không giới hạn                                                                                   |
| Mẫu phiếu thu QR                         | 4                                     | Tất cả (9+)                                                                                      |
| Lưu trữ ảnh (bài làm + ảnh chuyển khoản) | 50MB                                  | 2GB                                                                                              |
| Ảnh chuyển khoản / đối soát thủ công     | Có                                    | Có + OCR khi có (giai đoạn 2)                                                                    |
| Hồ sơ công khai + nhận yêu cầu           | Có (đã chốt: miễn phí cho mọi gia sư) | Có + ưu tiên hiển thị + huy hiệu "Hoạt động"                                                     |
| Gửi Zalo một chạm                        | Có                                    | Có                                                                                               |
| Xuất Excel/PDF                           | Excel                                 | Excel + PDF (bảng điểm danh tháng, nghẽn \#12)                                                   |
| Trợ giảng / giáo viên thứ hai            | Không                                 | Chưa làm ở giai đoạn 1 – để sau nếu dữ liệu cho thấy cần (TutorBird thu 4,95 USD/giáo viên thêm) |

*Mọi con số trong bảng là hạn mức cấu hình được và chưa bật. Mốc 8 học sinh và 42.000đ giữ theo Sổ Gia Sư để khi bật Pro có thể so sánh "ngang giá, nhiều hơn 3 thứ": ảnh chuyển khoản, hồ sơ công khai, Zalo một chạm. Điều kiện gợi ý để bật Pro: ≥ 200 gia sư hoạt động và ≥ 30% trong số đó vượt hạn mức Free trong 2 tháng liên tiếp.*

### 8.6 Mười hai điểm nghẽn của Sổ Gia Sư → cách xử lý trong sản phẩm của bạn

| **\#** | **Điểm nghẽn quan sát được (mục 3.6)**                   | **Xử lý**                                                                              | **Giai đoạn** |
|--------|----------------------------------------------------------|----------------------------------------------------------------------------------------|---------------|
| 1      | Quên bấm "Đã dạy xong" → không phí, không báo cáo        | Khối "quá hạn chưa chốt" ở trang chủ + chốt cả lớp một chạm + email nhắc tuần          | 1             |
| 2      | Hình thức học phí khoá cứng sau khi tạo lớp              | Cho đổi, áp dụng cho buổi chưa chốt; buổi đã chốt giữ nguyên                           | 1             |
| 3      | Không có đối soát chuyển khoản (mới hứa)                 | Ảnh chuyển khoản gắn phiếu (8.4C)                                                      | 1 → OCR ở 2   |
| 4      | Không nhắc lịch phụ huynh/học sinh                       | Giữ thủ công theo quyết định 2; thêm "Gửi lịch tuần qua Zalo" một chạm (ảnh lịch tuần) | 1             |
| 5      | Chỉ 3 trạng thái buổi, không có dạy bù                   | 5 trạng thái + liên kết buổi bù ↔ buổi gốc                                             | 1             |
| 6      | Không quản lý trợ giảng/nhiều giáo viên                  | Chưa làm; đo nhu cầu bằng câu hỏi trong app                                            | 3             |
| 7      | Link báo cáo ai có cũng xem, không biết phụ huynh đã xem | PIN tuỳ chọn + dấu đã xem                                                              | 1             |
| 8      | Bug: trang phụ huynh lọc ngày ≤ hôm nay                  | Lọc theo trạng thái                                                                    | 1             |
| 9      | Không có app native, PWA chưa có thông báo đẩy           | PWA + Web Push cho gia sư (nhắc chốt buổi, có yêu cầu mới); phụ huynh vẫn Zalo         | 2             |
| 10     | Phí khác không gắn kỳ, không thu trước                   | Phí khác theo kỳ + gói N buổi trừ dần                                                  | 2             |
| 11     | Không tìm được gia sư mới từ sản phẩm                    | Mặt sàn (8.4D)                                                                         | 2             |
| 12     | Bảng điểm danh tháng không xuất PDF                      | Xuất PDF (Pro)                                                                         | 1             |

### 8.7 Rủi ro và lưu ý cần ghi nhớ

- **Pháp lý trung gian:** chừng nào không thu tiền hộ, không giữ tiền, không hưởng hoa hồng thì bạn chỉ là nền tảng đăng thông tin; vẫn cần Điều khoản sử dụng + Chính sách bảo mật nêu rõ (Daykemtainha có mẫu để tham khảo, mục 5.5). Khi có pháp nhân, xem lại Nghị định 52/2013 về sàn TMĐT nếu bắt đầu thu phí kết nối.

- **Dữ liệu cá nhân trẻ em:** tên học sinh + SĐT phụ huynh + ảnh bài làm là dữ liệu cá nhân (Nghị định 13/2023). Mặc định ẩn mọi thông tin học sinh khỏi hồ sơ công khai; chỉ hiện số đếm.

- **Chất lượng nguồn cung ban đầu:** sàn chỉ có giá trị khi có đủ gia sư trong một khu vực. Đề xuất mở theo từng thành phố (bắt đầu nơi bạn có gia sư thật), và chỉ bật trang tìm gia sư khi khu vực đó có ≥ 30 hồ sơ đang hoạt động.

- **Ảnh chuyển khoản giả/ chỉnh sửa:** rủi ro thuộc gia sư; sản phẩm nêu rõ và không dùng chữ "đối soát tự động".

- **Kênh Zalo thủ công:** tỷ lệ gửi sẽ thấp nếu cần \> 2 thao tác. Đo "số phiếu được gửi / số phiếu tạo" ngay từ bản đầu; nếu \< 50% thì mới cân nhắc ZNS (có phí) ở giai đoạn 3.

- **Cạnh tranh trực diện với Sổ Gia Sư:** họ đã có mốc giá và tập khách; lợi thế của bạn phải nằm ở 3 thứ họ chưa có (ảnh chuyển khoản, hồ sơ công khai, Zalo một chạm) và ở việc sửa đúng 12 nghẽn. Không nên cạnh tranh bằng giá thấp hơn.

- **Phụ thuộc deep-link Zalo:** zalo.me/\<SĐT\> mở được trên điện thoại và web; cần kiểm tra trên cả iOS/Android/desktop trước khi dựa vào.

### 8.8 Lộ trình đề xuất và chỉ số đo

| **Giai đoạn**                          | **Phạm vi**                                                                                                                                                                           | **Chỉ số cần đạt trước khi sang giai đoạn sau**                                                                                                    |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 – Ngang Sổ Gia Sư + sửa nghẽn (SaaS) | Lớp/buổi/điểm danh/phí/phiếu QR/báo cáo; ảnh chuyển khoản thủ công; Zalo một chạm; PIN; 5 trạng thái buổi; sửa bug lọc ngày; PDF; cơ chế hạn mức có sẵn nhưng tắt (miễn phí toàn bộ). | ≥ 70% gia sư đăng ký tạo lớp trong ngày đầu; ≥ 60% buổi được chốt trong 24h; ≥ 50% phiếu thu có ảnh chuyển khoản; ≥ 50% phiếu được bấm "Gửi Zalo". |
| 2 – Mặt sàn                            | Hồ sơ công khai + chỉ số tự động; trang tìm gia sư theo thành phố; form yêu cầu; "Nhận lớp" tạo lớp sẵn; PWA + Web Push cho gia sư; gói N buổi; OCR ảnh chuyển khoản.                 | ≥ 30 hồ sơ hoạt động/thành phố; tỷ lệ yêu cầu → thành lớp ≥ 20%; ≥ 30% lớp mới trong tháng đến từ sàn.                                             |
| 3 – Mở rộng có điều kiện               | Trợ giảng/giáo viên thứ hai; ZNS nhắc lịch trả phí (nếu tỷ lệ gửi Zalo thủ công thấp); đánh giá có kiểm duyệt; API/sao kê khi có pháp nhân.                                           | Quyết định bằng dữ liệu giai đoạn 1–2, không làm trước.                                                                                            |

### 8.9 Ba điểm mở của bản 2 – đã chốt (19/10/2026)

| **Điểm mở**                          | **Quyết định của bạn**                                                                                                                               | **Đã đưa vào đâu**                                              |
|--------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| Hồ sơ công khai mặc định bật hay tắt | Gia sư tự chọn Hiện/Ẩn; nhưng một số thông tin bắt buộc vẫn hiện khi hồ sơ đang Hiện: trường, bằng cấp/chứng chỉ chính, môn/cấp, khu vực, hình thức. | 8.3 (TutorProfile: nhóm bắt buộc / tuỳ chọn), 8.4D bước 2 và 5. |
| Chống spam form yêu cầu              | Cách tiết kiệm nhất: reCAPTCHA v3 miễn phí + giới hạn theo số điện thoại và IP; không OTP.                                                           | 8.4D bước 3.                                                    |
| Phần sàn miễn phí cho ai             | Trước mắt miễn phí toàn bộ sản phẩm (cả SaaS lẫn sàn); chạy ổn rồi mới bật Pro.                                                                      | 8.1 hàng 4, 8.5, 8.8 giai đoạn 1.                               |

Với ba quyết định này, không còn điểm nào trong mục 8 chờ bạn. Việc kế tiếp là chuyển mục 8 thành đặc tả màn hình (wireframe) và backlog giai đoạn 1 – nếu bạn muốn, tôi làm ở bản 3.

## Phụ lục A – Danh mục ảnh và nguồn

**A.1 Ảnh chụp**

Ảnh Sổ Gia Sư: sgs_01…sgs_25 + bao-cao-hoc-sinh-test-a-2026-10-20.png (dựng từ DOM bằng html2canvas-pro trong Chrome của bạn, 19/10/2026, 11:30–13:40). Ảnh đối thủ: cmp_preply\_\* (8), cmp_wyzant\_\* (2), cmp_superprof_home, cmp_teachworks_home, tw_01_dashboard, cmp_tutorbird_home, cmp_tutorcruncher_home, cmp_teachngo_home, shub_01–03 (file gốc trong thư mục Downloads của bạn). Bản 2 thêm 27 ảnh chụp màn hình trực tiếp trong app TutorBird (tb_01…tb_16b, 19 ảnh) và Teachworks (tw_02…tw_08, 8 ảnh), 19/10/2026 22:30–22:45.

**A.2 Nguồn chính đã mở**

- sogiasu.com, /pricing, /dashboard/\* (tài khoản của bạn), /report/thanh-nguyen/hoc-sinh-test-a

- tutorbird.com, /pricing, gettingstarted.tutorbird.com, capterra.com/p/181623/TutorBird, trustpilot.com/review/tutorbird.com; app.tutorbird.com (tài khoản dùng thử)

- teachworks.com, /pricing, /features/integrations, intercom.help/teachworks (Adding lessons), capterra.co.uk/software/136856/teachworks; awdawdas.teachworks.com

- teachngo.com, /pricing, /features, capterra.com/p/149259/Teach-n-Go

- tutorcruncher.com (trang chủ, giá 3 gói, FAQ)

- comiru.co, /plan/, /service/communication/, edinetdb.jp/company/E38036 (FY2025), apps.apple.com/jp/app/id1219573110, itreview.jp/products/comiru

- classup.io, docs.channel.io/classup_guide (giá, Free plan, Pro plan)

- eduspace.vn, /bao-gia

- shub.edu.vn (+ /login, /overview, /class, /find), thsp.ctu.edu.vn hướng dẫn SHub, diendandoanhnghiep.vn (VIISA 2022), fptshop.com.vn, cellphones.com.vn

- preply.com, /en/online/english-tutors, /en/tutor/3825759, /en/checkout (xem trước), help.preply.com (commission model, trial lesson, cancellation, withdraw, register, Super Tutor), termsofuse.preply.com (Refund Policy 16/08/2026, Terms), kyodonewsprwire (Series D 1/2026), trustpilot.com/review/preply.com

- superprof.vn (trực tiếp), superprof.com, superprof.co.uk/blog/charges-payments-superprof, pulse2.com (phỏng vấn CPO 11/2025), trustpilot.com/review/superprof.com

- wyzant.com, /student/dashboard, /match/tutor/85900251, support.wyzant.com (fee structure 25%, student payment 9%, tutor payment policy, Good Fit Guarantee), /howitworks/tutors, trustpilot.com/review/www.wyzant.com

- italki.com, /en/teachers/english, company.italki.com, support.italki.com (commission, teacher types, certificates, application, language openings), trustpilot.com/review/italki.com

- daykemtainha.vn, /lop-hoc, /gia-su, /dang-ky-lam-gia-su, /tim-gia-su, /hop-dong-mau, /chinh-sach-bao-mat-dieu-khoan-dich-vu; baophapluat.vn (2010), tuoitre.vn (2021)

- techcrunch.com (Snapask 2/2020), cyberport.hk, kr-asia.com (Ruangguru 4/2021), dailysocial.id (2022)

## Phụ lục B – Điều chưa kiểm chứng / mâu thuẫn

- Sổ Gia Sư: hành vi "Theo khoá học" và "Theo giờ" khi chốt buổi (chưa tạo lớp loại này); nội dung QR thật khi đã cấu hình ngân hàng; hiển thị trên điện thoại dọc; email/thông báo khi trial hết hạn; cách đồng bộ Google Calendar thực tế (chưa kết nối).

- TutorBird: trụ sở, app native, phí Stripe/PayPal áp cho người dùng, danh sách báo cáo; giá 16,95 USD (trang chính) vs 14,95 (blog đối thủ) vs C\$/£13,95 (trang phụ).

- Teachworks: hai bộ giá trên cùng trang; 45/46 ngôn ngữ; 50/70/80 add-on; màu chủ đạo; giá SMS và add-on Pro.

- Teach 'n Go: giá gói Pro; giới hạn học viên Pro; 2 gói (web) vs 4 gói (Capterra).

- Comiru: dòng giá 500¥ và 858¥ chưa rõ gói; QR hay thẻ IC; 7.100 lớp (web) vs 1.939 doanh nghiệp (báo cáo) – khác đơn vị.

- ClassUp: "Alimtalk" chưa thấy chữ Kakao trong tài liệu; kiosk Toss Front miễn phí vs tablet 500.000 won; năm của số liệu.

- Shub: 2.000 trường (web) vs 200+ (2022); 3 triệu học sinh vs 3 triệu người dùng/ngày; bảng giá 404.

- Preply: duyệt 3 vs 5 ngày; 33.602 vs 46.278 gia sư tiếng Anh; bảng bậc hoa hồng đầy đủ là ảnh.

- Superprof: quy mô 13 triệu / 30 triệu / 40 triệu tuỳ nguồn; phí 10% tuỳ chọn vs bắt buộc (Sidehusl); Student Pass VN chưa thấy.

- Wyzant: 65.000 (web) vs 500.000 (Wikipedia 2013); Trustpilot biểu đồ 82% 5 sao nhưng điểm 1,6.

- italki: 15% (chính sách cũ) vs 15–30% (help center); 20.000 vs 30.000 giáo viên; sàn giá 4 vs 5 USD.

- Daykemtainha: phí 25–30% (hợp đồng) vs 10–25% (thẻ lớp); Điều 7 có hai cách đọc; số ĐKKD chưa tra.

## Phụ lục C – Dữ liệu test cần dọn

- Sổ Gia Sư: Lớp học → "Lớp TEST Claude - xoá sau" → cuối trang Vùng nguy hiểm → Xoá (kéo theo 8 buổi, phí, điểm danh). Sau đó Học sinh → "Học sinh TEST A" → Tắt chia sẻ (hoặc Xoá). Lớp "Lớp demo chụp ảnh" chưa được tạo (chỉ điền form).

- TutorBird: Students → "Test Student" (gia đình "Parent Test") xoá; Calendar → sự kiện 19/10 14:30 xoá; tài khoản gia đình có nợ 30 USD sẽ tự biến mất.

- Teachworks (awdawdas): không tạo dữ liệu, chỉ mở form.

- Preply và Wyzant: đã tạo tài khoản học viên mới bằng Google; không có giao dịch. Có thể xoá tài khoản trong cài đặt nếu không dùng.

- Shub: đăng nhập vai học sinh, không tạo dữ liệu.
