# Đối thủ trong nước, giá công cụ quản lý lớp/gia sư ở Việt Nam, và khả năng chi trả của người dạy

> **Ngày thu thập: 22/10/2026.** Không có giá USD nào được dùng nên không cần tỉ giá giả định.
>
> **Giới hạn phương pháp (đọc trước).** Lượt nghiên cứu này bị giới hạn công cụ:
> - `WebFetch` lỗi DNS (`getaddrinfo ENOTFOUND`) với mọi tên miền, kể cả Wikipedia, nên **không mở được trang gốc nào**.
> - `curl` qua proxy bị chặn 403 (chính sách egress) với `sogiasu.com` và `azota.vn`. Không tìm cách lách.
> - `WebSearch` hết hạn mức sau khoảng 14 truy vấn. Sáu truy vấn cuối (Klassi, Sổ tay giáo viên, diemdanh.app, CenterPro, daythem.uk, Shub) không chạy được. Không tìm cách lách.
>
> Vì vậy **mọi mục web dưới đây chỉ ở mức "tóm tắt của công cụ tìm kiếm gán thông tin cho URL đó"**, không phải đọc nguyên trang.
>
> Chú giải thẻ:
> - **[Đã kiểm nguồn*]**: URL xuất hiện trong kết quả tìm kiếm và bản tóm tắt gán con số/ý đó cho URL ấy. Tôi chưa mở được trang. Nên mở lại bằng tay các số liệu giá trước khi đưa vào báo cáo cuối.
> - **[Nội bộ repo, chưa kiểm ngoài]**: lấy từ tài liệu trong repo `midnight-elite`, không xác nhận được bằng web.
> - **[Suy luận]**: tôi suy ra, không phải sự kiện.
>
> Hạn mức tìm kiếm là của cả lượt chạy chứ không riêng tôi. Nếu cần tiếp, phải chạy lại sau khi hạn mức được nâng (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`) hoặc ở lượt mới. Danh sách truy vấn đề xuất nằm ở cuối mỗi mục "Gaps".

---

## 1. Sổ Gia Sư (sogiasu.com): gói, giá, hạn mức Free, tính năng khoá, onboarding, phàn nàn

### Takeaway
**Không kiểm chứng được độc lập** sự tồn tại của gói Pro ~42.000đ/tháng, hạn mức Free, số người dùng hay đánh giá của Sổ Gia Sư: `sogiasu.com` bị chặn egress (403), và 6 truy vấn tìm kiếm khác nhau không trả về trang nào của sản phẩm này. Mọi thứ biết được về Sổ Gia Sư hiện chỉ đến từ báo cáo nội bộ trước đó của dự án (bản 2.1, khảo sát 19/10/2026), mà file gốc không nằm trong repo.

### Cited Findings
- Bản giao việc của dự án mô tả KiN từng nghĩ tới "một gói Pro khoảng 42.000đ/tháng (học theo đối thủ Sổ Gia Sư)" và ví Coin nạp trước dưới 20.000đ/tháng, chưa chốt giá/gói. Con số 42.000đ **chỉ xuất hiện ở lời mô tả này và ở một dòng trong kế hoạch bên dưới**, không có URL. [Nội bộ repo, chưa kiểm ngoài] — bản giao việc (không có URL); [CLAUDE-cho-kho-trien-khai.md](/home/user/midnight-elite/docs/kin/CLAUDE-cho-kho-trien-khai.md) (dòng 25: "Coin nạp trước, dưới 20k/tháng")
- Kế hoạch phát triển (soạn 21/10/2026) nói rõ nguồn của nó là báo cáo research "Sổ Gia Sư (sogiasu.com) + 14 nền tảng tham khảo" (bản 2.1, khảo sát 19/10/2026) và "File gốc không nằm trong repo". Dòng "Gói Pro ~42.000đ, hạn mức Free/Pro" được liệt vào mục "Không làm" vì "Hoãn có chủ đích (TT-204); chưa có model `Plan`". Con số hạn mức Free/Pro cụ thể (số lớp, số học sinh) **không được chép lại** trong repo. [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 9–10, 54, 273)
- Điểm nghẽn của Sổ Gia Sư theo báo cáo đó (chép lại từ kế hoạch, chưa kiểm gốc): (a) nghẽn #1: gia sư quên bấm "Đã dạy xong" thì "mất phí và báo cáo"; (b) nghẽn #8: chỉ xuất Excel bảng điểm danh tháng, không có PDF; (c) lỗi trang phụ huynh lọc theo ngày ≤ hôm nay. [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 53, 84, 136)
- Onboarding của Sổ Gia Sư "rất ngắn": dán cột tên từ Excel, chọn thứ và số tuần là có lớp. [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 214)
- Hai dòng "Không làm" liên quan tới cơ chế tiền của Sổ Gia Sư: "Phí phát sinh khi bấm 'Đã dạy xong'" và "Đổi hình thức học phí của lớp". Tài liệu **không nói** đây là phí nền tảng thu của gia sư hay là cách tính học phí lớp; lý do bỏ ghi là "KiN tính học phí theo tháng và bậc thang số môn". [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 271–272)
- Truy vấn "Sổ Gia Sư Pro 42.000đ/tháng" không trả về trang nào của Sổ Gia Sư. Kết quả duy nhất chứa "42.000đ" là một đại lý bán lại gói nâng cấp Gemini, không liên quan. [Đã kiểm nguồn*] — [sonhainguyen.com](https://sonhainguyen.com/blog/gemini-pro-bao-nhieu-tien)
- Sáu truy vấn (`Sổ Gia Sư app quản lý lớp gia sư giá gói Pro`, `"Sổ Gia Sư" ứng dụng`, `"sogiasu" OR "so gia su"`, `sogiasu.com`, "Sổ Gia Sư quản lý học viên lịch dạy học phí Google Play", và truy vấn có "42.000đ") đều không trả về trang sản phẩm nào mang tên này; chỉ ra các app tìm gia sư/quản lý khác. [Đã kiểm nguồn*] — ví dụ các bài tổng hợp [funix.edu.vn](https://funix.edu.vn/chia-se-kien-thuc/ung-dung-gia-su-online/), [mona.media](https://mona.media/giao-duc/phan-mem-quan-ly-trung-tam-gia-su/) không nhắc tên Sổ Gia Sư trong phần tóm tắt trả về. (Tôi chưa đọc nguyên bài nên chỉ kết luận được "không thấy trong snippet", không kết luận "bài không nhắc".)
- Truy vấn `sogiasu.com` còn trả về các miền giống tên "sogou" mà công cụ tìm kiếm cảnh báo là có thể giả mạo; không liên quan tới Sổ Gia Sư. [Đã kiểm nguồn*] — kết quả tìm kiếm, ví dụ [hackmd.io](https://hackmd.io/@sogousoucom/sogousoucom1)

### Inferences
- [Suy luận] Việc 6 truy vấn tìm kiếm không ra gì cho thấy Sổ Gia Sư có thể rất nhỏ/mới, ít được báo chí, blog, App Store, Google Play lập chỉ mục. Đây chỉ là suy đoán từ việc **không thấy**, không phải bằng chứng nó nhỏ: công cụ tìm kiếm ở đây giới hạn ở Mỹ và hay bỏ sót nội dung tiếng Việt.
- [Suy luận] Nếu Pro ~42.000đ/tháng là thật, nó thấp hơn 3–4 lần mốc trả phí thấp nhất mà tôi thấy cho giáo viên cá nhân (Azota VIP cá nhân 149.000đ/tháng, LopHoc Plus 149.000đ/tháng; xem mục 2). 42.000 / 149.000 ≈ 28%. Một mức giá lệch xa thị trường như vậy cần được kiểm lại từ trang giá gốc trước khi KiN lấy làm điểm neo.

### Gaps
- Toàn bộ các câu hỏi chính của mục này đều **chưa trả lời được từ nguồn bên ngoài**: gói và giá hiện hành, có thật gói Pro ~42.000đ hay không, hạn mức Free (số lớp, số học sinh), tính năng khoá sau Pro, chính sách phí phát sinh, số người dùng tự công bố, đánh giá/phàn nàn của người dùng, cách thúc nâng cấp, lịch sử giá trên web.archive.org. Lý do: `sogiasu.com` trả 403 ở tầng proxy, `WebFetch` lỗi DNS, và tìm kiếm không ra.
- Báo cáo gốc bản 2.1 (19/10/2026) là nguồn duy nhất có thông tin; cần Thọ/Thanh chép phần "Sổ Gia Sư" (đặc biệt mục có con số hạn mức Free/Pro, nguồn của con số 42.000đ, ngày chụp trang giá) vào `docs/kin/bao-cao/` như câu hỏi Q8 trong kế hoạch đã nêu. Khi đó kiểm lại bằng tay trên trình duyệt thường.
- Truy vấn đề xuất khi có hạn mức: "Sổ Gia Sư" + `site:play.google.com`, `site:apps.apple.com`; `web.archive.org/web/*/sogiasu.com/*`; "Sổ Gia Sư" review/đánh giá; hỏi trực tiếp Thọ xem 42.000đ là giá tháng hay năm, có khuyến mãi không.

---

## 2. Azota, Shub và mọi công cụ khác cho dạy thêm/gia sư/trung tâm nhỏ: giá, gói miễn phí, tính năng khoá

### Takeaway
Công cụ đúng ngách (điểm danh + học phí cho 1–20 học viên) **hầu hết cho dùng miễn phí** hoặc có gói Free khá rộng (Sổ tay giáo viên, Klassi, diemdanh.app, Loppi, LopHoc, CenterPro, ứng dụng "Quản Lý & Điểm Danh"). Mức trả phí đầu tiên có giá niêm yết rõ cho giáo viên cá nhân là **149.000đ/tháng** (Azota VIP cá nhân; LopHoc Plus), trong khi gói trung tâm bắt đầu 199.000đ/tháng (CenterPro) và đi tới 1,8–6,8 triệu đ/tháng (EDUCRM). Chưa tìm thấy giá của Shub.

### Cited Findings

**Azota (kiểm tra bài, giao bài; không phải sổ lớp thuần)**
- Trang báo giá chính thức: "Gói VIP cá nhân: chỉ từ 149.000đ/tháng hoặc 999.000đ/năm". Tiêu đề trang tự nhận "tin dùng bởi hơn 300.000+ giáo viên" (số tự công bố, không rõ bao nhiêu người trả tiền). [Đã kiểm nguồn*] — [azota.vn/bao-gia](https://azota.vn/bao-gia/)
- Quyền lợi VIP cá nhân (theo tóm tắt): không giới hạn lượt thi, tải kết quả thi dạng Excel cho trên 50 học sinh, học sinh làm đề không có quảng cáo; gói dành cho một giáo viên, số lớp và số học sinh không giới hạn (tức Azota **không khoá theo số lớp/học sinh** mà khoá theo tính năng và thiết bị). [Đã kiểm nguồn*] — [azota.vn/bao-gia](https://azota.vn/bao-gia/)
- Có hai loại VIP: VIP cá nhân và VIP tổ chức (trường/trung tâm), gói tổ chức báo giá theo số giáo viên và học sinh; bảng so sánh ghi mức 50 giáo viên, 1TB lưu trữ, tập huấn triển khai. [Đã kiểm nguồn*] — [azota.vn/bao-gia](https://azota.vn/bao-gia/)
- Giới hạn thiết bị: VIP cá nhân mặc định 2 thiết bị đồng thời; gói nhiều thiết bị 5 và 10 thiết bị; nâng cấp tính tiền theo ngày còn lại. [Đã kiểm nguồn*] — [docs.azota.vn: hướng dẫn nâng VIP](https://docs.azota.vn/docs/huong-dan-su-dung/goi-vip-point/huong-dan-nang-vip/); [docs.azota.vn: gói VIP nhiều thiết bị](https://docs.azota.vn/docs/huong-dan-su-dung/goi-vip-point/goi-vip-nhieu-thiet-bi/)
- "Point" là tiền nạp trước, trả theo lượt cho tính năng AI/chuyên sâu, tách khỏi VIP. Tài khoản VIP được miễn phí 100 trang số hoá OCR mỗi tháng, vượt thì tính theo trang. [Đã kiểm nguồn*] — [docs.azota.vn: gói VIP & Point](https://docs.azota.vn/docs/huong-dan-su-dung/goi-vip-point/); [docs.azota.vn: giới thiệu và nạp Point](https://docs.azota.vn/docs/huong-dan-su-dung/goi-vip-point/gioi-thieu-va-huong-dan-nap-point/)
- Azota còn có VIP cho **tài khoản học sinh** (trang hướng dẫn kích hoạt) và chính sách bán đề thi/tài liệu trên Azota (chỉ thấy tiêu đề trang, chưa biết hoa hồng). [Đã kiểm nguồn*] — [docs.azota.vn: kích hoạt VIP học sinh](https://docs.azota.vn/docs/huong-dan-su-dung/cau-hoi-thuong-gap/huong-dan-kich-hoat-vip-cho-tai-khoan-hoc-sinh/); [docs.azota.vn: chính sách bán đề thi](https://docs.azota.vn/docs/huong-dan-su-dung/thi-online/cai-dat-gia-khi-hoc-sinh-vao-thi-lam-de/)
- Bài tổng hợp ngoài về Azota: [TechCrunch 2022](https://techcrunch.com/2022/07/05/azota-is-solving-exam-headaches-vietnams-teachers), [Mona Media](https://mona.media/giao-duc/azota/), [Sevenam 2025](https://sevenam.vn/azota/), [xemayanhloc.com.vn review](https://xemayanhloc.com.vn/review-azota-chi-tiet/). Mới thấy tiêu đề, **chưa đọc nội dung**.

**LopHoc (lophoc.app): đối thủ gần KiN nhất về VietQR + đối soát**
- Free 0đ/tháng: tối đa 10 học viên và 1 giáo viên; có điểm danh, thời khoá biểu, chốt sổ, tạo QR nhận tiền VietQR; **đối soát thanh toán làm thủ công; phiếu có watermark**. [Đã kiểm nguồn*] — [lophoc.app](https://lophoc.app/)
- Plus: học viên không giới hạn, 2 ghế giáo viên, **tự đối soát 60 giao dịch/tháng**, nhập học viên bằng AI. Pro: 5 ghế giáo viên, 150 giao dịch đối soát/tháng, bỏ watermark, sổ thu chi, tính lương giáo viên. Center: mọi tính năng Pro cộng thêm tính năng cao cấp, nhiều chi nhánh. [Đã kiểm nguồn*] — [lophoc.app](https://lophoc.app/)
- Giá: trang tự mâu thuẫn. Phần chi tiết gói ghi Plus 149.000đ và Pro 319.000đ/tháng (trả theo năm, 3.828.000đ/năm); phần câu hỏi thường gặp ghi Plus 149.000đ/tháng, Pro 399.000đ/tháng, Center 990.000đ/tháng, trả năm tiết kiệm 20% (tức 119.000/319.000/790.000đ/tháng). [Đã kiểm nguồn*] — [lophoc.app](https://lophoc.app/)
- Dùng thử 30 ngày Pro miễn phí, không cần thẻ; hết hạn tự về Free và không mất dữ liệu. Tính năng tự gửi tin Zalo của nhà cung cấp này vẫn ở mục "đang phát triển". [Đã kiểm nguồn*] — [lophoc.app](https://lophoc.app/)

**Loppi (loppi.io.vn)**
- Nhắm gia sư và trung tâm nhỏ: điểm danh, học phí, công nợ, phiếu học phí cho phụ huynh; dữ liệu lưu trên máy và đồng bộ khi có mạng lại; ghi "miễn phí để bắt đầu, không giới hạn thời gian". [Đã kiểm nguồn*] — [loppi.io.vn/phan-mem-quan-ly-lop-day-them](https://loppi.io.vn/phan-mem-quan-ly-lop-day-them)
- Gói miễn phí mãi mãi cho 10 học sinh và 2 lớp; gói Chuyên nghiệp tới 3 cơ sở; gói Doanh nghiệp không giới hạn cơ sở/lớp/học viên; dùng thử 14 ngày. **Giá gói trả phí: không tìm thấy.** [Đã kiểm nguồn*] — [loppi.io.vn](https://loppi.io.vn/); [loppi.io.vn: chuỗi trung tâm](https://loppi.io.vn/phan-mem-quan-ly-chuoi-trung-tam-nhieu-co-so)

**Các công cụ miễn phí khác (chỉ có mô tả quảng bá, chưa có giá trả phí)**
- Sổ tay giáo viên: quảng bá "toàn bộ tính năng hiện tại miễn phí cho giáo viên dạy thêm tại nhà"; điểm danh, sổ điểm, tự tính học phí, xuất phiếu gửi phụ huynh qua Zalo. [Đã kiểm nguồn*] — [sotay.aiteacherpark.vn](https://sotay.aiteacherpark.vn/)
- Klassi: "miễn phí vĩnh viễn cho giáo viên & phụ huynh", có điểm danh, học phí, trang phụ huynh. [Đã kiểm nguồn*] — [klassi.vn](https://klassi.vn/)
- diemdanh.app: miễn phí cho giáo viên, dùng trên web và app, tự gửi thông báo điểm danh tới Zalo phụ huynh. [Đã kiểm nguồn*] — [diemdanh.app](https://diemdanh.app/)
- daythem.uk, tiêu đề "Trung Tâm Dạy Thêm Miễn Phí — Phần Mềm Quản Lý Trung Tâm Dạy Thêm": chỉ thấy tiêu đề. [Đã kiểm nguồn*] — [daythem.uk](https://daythem.uk/)
- Ứng dụng iOS "Quản Lý & Điểm Danh" (miễn phí): dành cho giáo viên lớp học thêm, danh sách học sinh, thống kê buổi vắng, phụ huynh xem học phí trong app. [Đã kiểm nguồn*] — [App Store id6448912318](https://apps.apple.com/app/id6448912318)
- Ứng dụng iOS "Quản Lý Lớp Học" và "SchoolOnline Attendance" (chỉ điểm danh ra vào lớp, không thấy nói học phí): chỉ thấy tiêu đề/mô tả ngắn. [Đã kiểm nguồn*] — [Quản Lý Lớp Học](https://apps.apple.com/vn/app/qu%E1%BA%A3n-l%C3%BD-l%E1%BB%9Bp-h%E1%BB%8Dc/id6747802666?l=vi); [SchoolOnline Attendance](https://apps.apple.com/vn/app/id6476476675)
- Ứng dụng Android "Quản Lý Lớp Học" (package `com.passio.classmanager`): lớp, thời khoá biểu, hồ sơ học sinh, điểm danh, báo cáo học tập cho gia sư/trung tâm; giá/IAP chưa biết. [Đã kiểm nguồn*] — [Google Play](https://play.google.com/store/apps/details?id=com.passio.classmanager)
- Bài tổng hợp "Top 11 phần mềm quản lý lớp học miễn phí 2025" và "Top 7 phần mềm quản lý lớp học" (chỉ thấy tiêu đề): [dotb.vn](https://dotb.vn/news/phan-mem-quan-ly-lop-hoc-mien-phi/), [eduspace.vn](https://eduspace.vn/top-7-phan-mem-quan-ly-lop-hoc-tot-nhat-hien-nay). Eduspace được tóm tắt là cảnh báo học bù, điểm danh linh hoạt, tích hợp Zalo có thể chưa được hỗ trợ đầy đủ với trung tâm ngoài trường (chưa đọc nguyên bài).

**Gói trả phí cho trung tâm**
- CenterPro: có gói miễn phí cho lớp nhỏ; Cơ Bản 199.000đ/tháng; Nâng Cao 399.000đ/tháng cho chuỗi (700 học viên, đa chi nhánh). [Đã kiểm nguồn*] — [centerpro.vn/bang-gia](https://centerpro.vn/bang-gia/)
- EDUCRM: ba gói theo tháng, từ 1.800.000đ đến 6.800.000đ/tháng, phân theo số học viên lưu trữ và dung lượng. [Đã kiểm nguồn*] — [educrm.vn](https://educrm.vn/)
- SheetStore (Google Sheets): "chỉ từ 699.000đ trọn đời", không thuê bao tháng. [Đã kiểm nguồn*] — [sheet.com.vn/nganh/giao-duc](https://sheet.com.vn/nganh/giao-duc). Có thêm [mẫu quản lý lớp học trung tâm gia sư trên Google Sheets](https://sheet.com.vn/template/template-quan-ly-lop-hoc-trung-tam).
- ModunSoft: dùng thử miễn phí 15 ngày; giá không thấy. [Đã kiểm nguồn*] — [modunsoft.com](https://modunsoft.com/phan-mem-quan-ly-giao-duc-tao-bai-giang-elearning.html)

### Inferences
- [Suy luận] **Mốc giá niêm yết thấp nhất cho một giáo viên cá nhân mà tôi thấy là 149.000đ/tháng** (Azota VIP, LopHoc Plus), hoặc 83.250đ/tháng nếu Azota trả năm (999.000 / 12). Trả năm Azota rẻ hơn khoảng 44% so với 12 tháng lẻ (12 × 149.000 = 1.788.000).
- [Suy luận] Giá 42.000đ/tháng (nếu Sổ Gia Sư đúng như vậy) và Coin dưới 20.000đ/tháng của KiN sẽ nằm ở khoảng 28% và 13% mức 149.000đ. KiN sẽ là rẻ nhất trong những gì tôi thấy, nhưng đồng thời **không có đối thủ đúng ngách nào tôi thấy đang bán ở mức đó**, nên chưa có bằng chứng thị trường cho "mức giá một chữ số nghìn–vài chục nghìn".
- [Suy luận] Tính năng KiN đang có (VietQR + tự đối soát SePay) chính là thứ LopHoc **khoá sau gói Plus 149.000đ** (Free chỉ đối soát thủ công). Đây là bằng chứng gián tiếp rằng đối soát tự động là tính năng được định giá; cần so sánh nếu KiN để nó miễn phí hay đưa vào Pro.
- [Suy luận] Các gói Free rộng (Loppi 10 học sinh/2 lớp, LopHoc 10 học viên/1 giáo viên) phủ phần dưới của ngách 1–20 học viên. Nếu phần lớn gia sư KiN dưới 10 học sinh, **cổng khoá theo số học viên sẽ không bao giờ kích hoạt**; khoá phải dựa trên tính năng (đối soát, xuất PDF, watermark, báo cáo) chứ không dựa trên số lượng. Cần số liệu phân bố số học sinh/gia sư để chắc chắn.
- [Suy luận] Mô hình "dùng thử Pro 30 ngày rồi tự về Free không mất dữ liệu" của LopHoc là một cách thúc nâng cấp ít rủi ro cho người dùng; có thể tham khảo.

### Gaps
- **Shub**: không tìm thấy giá, gói, tính năng (truy vấn Shub cuối bị cắt do hết hạn mức; `shub.edu.vn` không mở được vì WebFetch lỗi DNS). Truy vấn đề xuất: "Shub Classroom bảng giá", "Shub Việt Nam gói trả phí giáo viên".
- Giá gói trả phí của Loppi, Klassi, diemdanh.app, Sổ tay giáo viên, daythem.uk; giới hạn Free cụ thể của Klassi, diemdanh.app. Có thể họ miễn phí thật hoặc chưa công bố giá.
- Ayotree, MONA EduConnect, MISA EMIS, Mona eLMS, SMAS, Facework, Edubox, TutorO, edDue: chỉ có nhắc tên; giá Ayotree trong tóm tắt **không nhất quán** giữa các bài (có bài ghi 25$/tháng, bài ghi 10$/tháng cho gói Standard 10 học sinh) và tôi không gán được vào URL nào, nên **không dùng** số này. Cần kiểm trang chính thức Ayotree.
- Azota: chưa thấy từng cột của bảng so sánh Free/VIP (nên mở azota.vn/bao-gia trong trình duyệt), số người dùng trả phí, chính sách hoa hồng bán đề/tài liệu.- Lịch sử giá (web.archive.org) của tất cả sản phẩm: không truy cập được.
- Benchmark quốc tế (ví dụ TutorBird khoảng 14,95 USD/tháng theo một bài so sánh): tóm tắt tìm kiếm không cho biết URL cụ thể nên không đưa vào làm số liệu.

---

## 3. Người dạy Việt Nam đang dùng gì thay thế (Excel, Google Sheets, sổ tay, Zalo, Facebook); có khảo sát đo tỉ lệ không

### Takeaway
**Không tìm thấy khảo sát hay bài viết nào đo tỉ lệ** người dạy dùng Excel/Sheets/sổ tay/Zalo/Facebook. Chỉ có bằng chứng gián tiếp: sự tồn tại của mẫu Google Sheets bán/cho không và của rất nhiều app miễn phí nhắm thẳng vào "thay Excel/sổ giấy/Zalo".

### Cited Findings
- Có mẫu Google Sheets để quản lý học viên, lịch, học phí, điểm danh, bán lẻ: SheetStore ghi "chỉ từ 699.000đ trọn đời". [Đã kiểm nguồn*] — [sheet.com.vn/nganh/giao-duc](https://sheet.com.vn/nganh/giao-duc); [mẫu quản lý lớp học trung tâm gia sư](https://sheet.com.vn/template/template-quan-ly-lop-hoc-trung-tam)
- Một dự án mã nguồn mở "GiaSu Manager Pro" trên GitHub tự xưng là hệ thống quản lý lịch dạy, học phí, học sinh cho gia sư (chỉ là mã nguồn để chạy thử, không phải sản phẩm thương mại đã kiểm chứng). [Đã kiểm nguồn*] — [github.com/luongtrungdung651-sketch/giasu-manager-pro](https://github.com/luongtrungdung651-sketch/giasu-manager-pro)
- Nhà cung cấp giải thích sản phẩm bằng việc "thay" cách làm cũ: Loppi nhấn vào offline-first (dữ liệu lưu trên máy, đồng bộ khi có mạng), Sổ tay giáo viên và diemdanh.app nhấn vào gửi phiếu/thông báo qua Zalo. Đây là thông điệp quảng bá, không phải khảo sát. [Đã kiểm nguồn*] — [loppi.io.vn](https://loppi.io.vn/phan-mem-quan-ly-lop-day-them); [sotay.aiteacherpark.vn](https://sotay.aiteacherpark.vn/); [diemdanh.app](https://diemdanh.app/)
- Bài so sánh của Eduspace được tóm tắt là cảnh báo rằng học bù, điểm danh linh hoạt và tích hợp Zalo có thể chưa được hỗ trợ đầy đủ với trung tâm ngoài trường (gợi ý nhu cầu thực chưa được phần mềm phục vụ tốt, nên người dạy quay về Zalo/Excel). Chưa đọc nguyên bài. [Đã kiểm nguồn*] — [eduspace.vn](https://eduspace.vn/top-7-phan-mem-quan-ly-lop-hoc-tot-nhat-hien-nay)
- Tài liệu nội bộ của KiN ghi câu chào bán phải là "giấy tờ đúng quy định" chứ không phải "tiện hơn Zalo", và cho rằng Thông tư 29/2024/TT-BGDĐT buộc người dạy thêm có thu tiền phải công khai lịch dạy, tên người dạy và mức học phí. Nội dung pháp lý này **chưa được kiểm** (kế hoạch cũng ghi "đó là căn cứ để hỏi luật sư, không phải ý kiến pháp lý"). [Nội bộ repo, chưa kiểm ngoài] — [CLAUDE-cho-kho-trien-khai.md](/home/user/midnight-elite/docs/kin/CLAUDE-cho-kho-trien-khai.md) (dòng 29–32); [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 207)

### Inferences
- [Suy luận] Việc có ít nhất 7 app/web miễn phí hoặc có Free rộng cùng nhắm "sổ lớp + học phí + Zalo" cho thấy các nhà làm sản phẩm tin rằng đối thủ chính là Excel/sổ tay/Zalo thủ công và rằng người dạy **chưa quen trả tiền** cho nhóm công cụ này (nếu không, hầu hết đã không dùng chiến lược cho không). Đây là suy luận từ hành vi nhà cung cấp, không phải dữ liệu người dùng.
- [Suy luận] Việc SheetStore bán mẫu Sheets 699.000đ **một lần** cho thấy có người sẵn sàng trả một lần cho sổ thay thế, nhưng không biết số lượng bán. Một lần 699.000đ tương đương khoảng 17 tháng ở mức 42.000đ/tháng.

### Gaps
- Tỉ lệ người dạy Việt Nam dùng Excel / Google Sheets / sổ giấy / Zalo / Facebook: **không tìm thấy khảo sát**. Truy vấn đề xuất: "khảo sát gia sư quản lý học phí bằng", "giáo viên dạy thêm ghi sổ học phí Excel", "gia sư nhắn Zalo nhắc học phí", "nhóm Facebook gia sư cách quản lý lớp"; thử Voz, Webtretho, Tinhte, Reddit r/vietnam.
- Facebook/Zalo/Voz/Webtretho/Tinhte: chưa tìm được (WebSearch chỉ trả vài bài tổng hợp SEO, nhiều bài 1–4 năm tuổi).

---

## 4. Quy mô thị trường và khả năng chi trả: số học sinh học thêm, số gia sư/giáo viên dạy thêm, số trung tâm nhỏ; thu nhập/học phí điển hình

### Takeaway
**Không tìm thấy số liệu chính thống nào** (Bộ GD&ĐT, Tổng cục Thống kê, VHLSS, báo chí có nguồn) về số học sinh học thêm, số người dạy thêm, số trung tâm. Về giá học phí chỉ có một mức tham khảo từ bảng giá của trung tâm môi giới gia sư (140.000–250.000đ/buổi cho gia sư sinh viên ở TP.HCM, 2026), chưa đọc nguyên trang và có độ tin cậy thấp.

### Cited Findings
- Các bảng giá năm 2026 của các trung tâm môi giới gia sư cho thấy mức phổ biến ở TP.HCM khoảng 140.000–250.000đ/buổi với gia sư sinh viên, cao hơn với giáo viên (theo tóm tắt tìm kiếm; không rõ đơn vị buổi 90 hay 120 phút, không rõ cấp lớp). Đây là **giá phụ huynh trả cho trung tâm môi giới**, không phải thu nhập thực của người dạy sau hoa hồng và không đại diện cho người dạy tự do ngách 1–20 học viên. [Đã kiểm nguồn*] — [giasutainha.com.vn/bang-gia-gia-su](https://giasutainha.com.vn/bang-gia-gia-su)
- Có các trang bảng giá/lương gia sư khác (tiêu đề, chưa đọc nội dung, nên **không dùng số**): [giasudaytot.com: mức lương gia sư sinh viên, giáo viên 2025](https://giasudaytot.com/luong-gia-su-bao-nhieu/), [giasusuphamhanoi.edu.vn: bảng giá Hà Nội](https://giasusuphamhanoi.edu.vn/bang-gia-gia-su-ha-noi/), [giasuinfo.com: TP.HCM](https://giasuinfo.com/tphcm/bang-gia-gia-su), [daykemcaptoc.vn: gia sư bao nhiêu tiền 1 tiếng](https://daykemcaptoc.vn/gia-su-bao-nhieu-tien-1-tieng/).
- Điểm tham chiếu nội bộ: quy mô hiện tại của KiN rất nhỏ (~25 học sinh thật); tài liệu dự án đã rút bài học về con số "1.200+ học viên" từng ghi mà không có căn cứ, nên mọi phần trăm trên mẫu nhỏ cần thận trọng. [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 168)
- Chi phí phía KiN, nếu thêm Zalo OA: Thanh ghi khoảng 1.000.000đ/năm cộng khoảng 300đ/tin. [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 172)

### Inferences
- [Suy luận] Nếu một buổi dạy thu 140.000–250.000đ (con số trên, nhiều khả năng cao hơn thu nhập thực của gia sư sinh viên vì chưa trừ hoa hồng), thì **149.000đ/tháng ≈ 60–106% của một buổi dạy**, **42.000đ ≈ 17–30% của một buổi**, **20.000đ ≈ 8–14% của một buổi**. Phép tính chỉ mang tính cỡ độ lớn: dữ liệu đầu vào yếu.
- [Suy luận] Với ngách 1–20 học viên và học phí tháng điển hình chưa biết, chưa thể nói công cụ chiếm bao nhiêu phần trăm doanh thu của người dạy. Cần số liệu "doanh thu/tháng của một gia sư KiN" từ dữ liệu thật của KiN (25 học sinh, vài gia sư) để tính tỉ lệ này tốt hơn bất kỳ số liệu thị trường nào.

### Gaps
- Số học sinh học thêm, tỉ lệ học thêm theo cấp học, chi tiêu hộ gia đình cho học thêm (VHLSS của Tổng cục Thống kê), số giáo viên/người dạy thêm, số cơ sở dạy thêm đã đăng ký sau Thông tư 29/2024/TT-BGDĐT: **không tìm thấy**; tôi chưa chạy được truy vấn nào về chủ đề này. Truy vấn đề xuất: "tỷ lệ học sinh học thêm Tổng cục Thống kê VHLSS", "Bộ GD&ĐT số học sinh học thêm khảo sát", "chi tiêu giáo dục hộ gia đình học thêm gso.gov.vn", "Thông tư 29/2024 số cơ sở dạy thêm đăng ký sau 14/2/2025", "thu nhập gia sư sinh viên mỗi tháng khảo sát", "học phí gia sư trung bình mỗi buổi 2025 báo".
- Thu nhập và số học sinh trung bình của gia sư sinh viên / giáo viên dạy kèm tự do: **không tìm thấy** từ nguồn có phương pháp. Ghi chú: các bảng giá của trung tâm môi giới là tài liệu tiếp thị.

---

## 5. Bằng chứng về mức giá công cụ mà người dạy sẵn sàng trả; mốc "rẻ không cần nghĩ" và mốc bắt đầu do dự; bằng chứng chống lại giả thuyết

### Takeaway
**Không tìm thấy bằng chứng trực tiếp** (đánh giá, bình luận, khảo sát) về mức giá người dạy Việt Nam sẵn sàng trả, nên chưa xác định được mốc "rẻ không cần nghĩ" hay mốc do dự. Bằng chứng gián tiếp nghiêng về **thận trọng**: giá neo của công cụ cốt lõi (điểm danh + học phí) ở thị trường là 0đ cho tới khoảng 10 học viên, và bậc trả phí thấp nhất có giá niêm yết là 149.000đ/tháng.

### Cited Findings
- **Bằng chứng ĐI NGƯỢC giả thuyết "người dạy sẵn sàng trả tiền":** ít nhất 7 sản phẩm cùng ngách cho dùng miễn phí hoặc có Free rộng: Sổ tay giáo viên ("toàn bộ tính năng hiện tại miễn phí"), Klassi ("miễn phí vĩnh viễn"), diemdanh.app (miễn phí cho giáo viên, có tự gửi Zalo), Loppi (Free mãi mãi 10 học sinh/2 lớp), LopHoc (Free 10 học viên/1 giáo viên, có VietQR), CenterPro (gói miễn phí cho lớp nhỏ), app "Quản Lý & Điểm Danh" (miễn phí). [Đã kiểm nguồn*] — [sotay.aiteacherpark.vn](https://sotay.aiteacherpark.vn/); [klassi.vn](https://klassi.vn/); [diemdanh.app](https://diemdanh.app/); [loppi.io.vn](https://loppi.io.vn/); [lophoc.app](https://lophoc.app/); [centerpro.vn/bang-gia](https://centerpro.vn/bang-gia/); [App Store id6448912318](https://apps.apple.com/app/id6448912318)
- **Đi ngược:** trong số công cụ có bậc trả phí cho giáo viên cá nhân, mức thấp nhất tôi thấy là 149.000đ/tháng (Azota VIP cá nhân, LopHoc Plus). Không thấy sản phẩm nào đang bán công khai ở mức vài chục nghìn đồng/tháng. [Đã kiểm nguồn*] — [azota.vn/bao-gia](https://azota.vn/bao-gia/); [lophoc.app](https://lophoc.app/)
- **Đi ngược / chưa chứng minh:** Azota tự nhận "hơn 300.000+ giáo viên" nhưng không công bố bao nhiêu người trả; số người dùng tự công bố không chứng minh sẵn sàng trả. [Đã kiểm nguồn*] — [azota.vn/bao-gia](https://azota.vn/bao-gia/)
- **Đi ngược:** các nhà cung cấp phải dùng dùng thử dài và "tự về Free không mất dữ liệu" để thuyết phục (LopHoc 30 ngày Pro không thẻ; Loppi 14 ngày; ModunSoft 15 ngày). Đây là dấu hiệu nhà cung cấp coi rào cản chuyển đổi sang trả phí là cao, nhưng cũng chỉ là suy diễn từ cách thiết kế gói. [Đã kiểm nguồn*] — [lophoc.app](https://lophoc.app/); [loppi.io.vn](https://loppi.io.vn/); [modunsoft.com](https://modunsoft.com/phan-mem-quan-ly-giao-duc-tao-bai-giang-elearning.html)
- **Ủng hộ giả thuyết (yếu):** có người bán mẫu Google Sheets thu một lần từ 699.000đ; có các gói trung tâm 199.000–399.000đ/tháng (CenterPro) và 1,8–6,8 triệu đ/tháng (EDUCRM) đang bán công khai, tức có thị trường trả phí ở **trung tâm**, không nhất thiết ở gia sư cá nhân. [Đã kiểm nguồn*] — [sheet.com.vn/nganh/giao-duc](https://sheet.com.vn/nganh/giao-duc); [centerpro.vn/bang-gia](https://centerpro.vn/bang-gia/); [educrm.vn](https://educrm.vn/)
- **Ủng hộ (yếu):** Azota có VIP cho giáo viên (149.000đ/tháng) và có cả VIP cho học sinh, tức một nền tảng lớn trong nước đã chọn thu phí ở cả hai phía. Không có số liệu doanh thu. [Đã kiểm nguồn*] — [azota.vn/bao-gia](https://azota.vn/bao-gia/); [docs.azota.vn: VIP học sinh](https://docs.azota.vn/docs/huong-dan-su-dung/cau-hoi-thuong-gap/huong-dan-kich-hoat-vip-cho-tai-khoan-hoc-sinh/)
- Dự án KiN hiện chưa thu phí ai; hạn mức Free/Pro chưa chốt, "Hoãn có chủ đích (TT-204)". [Nội bộ repo, chưa kiểm ngoài] — [ke-hoach-phat-trien-tu-research.md](/home/user/midnight-elite/docs/kin/ke-hoach-phat-trien-tu-research.md) (dòng 54)

### Inferences
- [Suy luận] Mốc **"rẻ không cần nghĩ"** chưa có dữ liệu. Hai mốc giả thuyết cần kiểm nghiệm: (a) giá ≤ khoảng 20.000–42.000đ/tháng, tức 8–30% của một buổi dạy; (b) giá ≈ 1 buổi dạy (khoảng 140.000–250.000đ) như mức 149.000đ của đối thủ. Cả hai đều chưa có bằng chứng về hành vi trả tiền.
- [Suy luận] Mốc **bắt đầu do dự** có thể nằm quanh 149.000đ/tháng (giá bậc thấp nhất của hai đối thủ có giá niêm yết), nhưng đây là điểm các nhà bán chọn, không phải ngưỡng khách hàng; hai nhà bán cùng chọn 149.000đ có thể là bắt chước nhau.
- [Suy luận] Rủi ro lớn nhất với giả thuyết: khi người dùng có thể dùng miễn phí ở ít nhất 4 nơi (Loppi và LopHoc tới 10 học viên; Sổ tay giáo viên và Klassi không nêu giới hạn trong tóm tắt), thì sức hút của Pro KiN phải đến từ tính năng chỉ KiN có (đối soát SePay + Zalo bán tự động + Sổ của con cho phụ huynh + báo nghỉ sát giờ/buổi bù), không phải từ giá thấp. Ví dụ LopHoc đã khoá đối soát tự động sau Plus, tức là họ cũng tin đó là tính năng đáng tiền.
- [Suy luận] Nếu KiN thử giá: nên có thí nghiệm nhỏ (hỏi giá trực tiếp gia sư đang dùng; trang giá giả/"smoke test"; hỏi "sẽ trả bao nhiêu" theo mô hình Van Westendorp) vì không có dữ liệu bên ngoài đủ để chốt.

### Gaps
- Không tìm thấy bất kỳ đánh giá Google Play/App Store, bình luận Voz/Webtretho/Tinhte/Facebook hay khảo sát nào nói người dạy Việt Nam thấy giá công cụ này "đắt" hay "rẻ". Truy vấn đề xuất: "Azota VIP đắt", "Azota 149k có đáng không", "phần mềm quản lý lớp học thêm đắt quá", đánh giá Google Play của `com.passio.classmanager` và các app khác; bình luận bài review Azota (xemayanhloc.com.vn, cellphones.com.vn/sforum).
- Tỉ lệ chuyển đổi Free → trả phí, churn, số người trả của bất kỳ sản phẩm nào: không có công bố.
- Phàn nàn/đánh giá của người dùng đối với Sổ Gia Sư và các đối thủ: không có. Lưu ý: để biết người dùng thật nghĩ gì cần phỏng vấn trực tiếp vài gia sư đang dùng Azota/Sổ Gia Sư/Excel.
- Thông tin KiN đã có về ý định trả tiền của gia sư thật (25 học sinh, vài gia sư): không có trong tài liệu tôi đọc; nên bổ sung bằng khảo sát nhỏ nội bộ.

---

## Phụ lục: những thứ cần làm bằng tay trên trình duyệt thường (tôi không làm được)

1. Mở lại và chụp ngày: [azota.vn/bao-gia](https://azota.vn/bao-gia/), [lophoc.app](https://lophoc.app/) (đặc biệt phần Plus/Pro và mâu thuẫn 319.000/399.000đ), [centerpro.vn/bang-gia](https://centerpro.vn/bang-gia/), [loppi.io.vn](https://loppi.io.vn/), [klassi.vn](https://klassi.vn/), [diemdanh.app](https://diemdanh.app/), [sotay.aiteacherpark.vn](https://sotay.aiteacherpark.vn/), [educrm.vn](https://educrm.vn/).
2. `sogiasu.com` và Shub (`shub.edu.vn` hoặc tên miền khác): trang giá, điều khoản, FAQ; và bản lưu ở `web.archive.org`.
3. Google Play / App Store: đánh giá và "mua trong ứng dụng" của các app nêu trên.
