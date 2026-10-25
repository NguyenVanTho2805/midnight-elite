# Cập nhật nghiên cứu 24/10/2026: đóng bớt khoảng trống Phụ lục D

Mã trong báo cáo: **CN**. Làm tiếp sau báo cáo 23/10, trong cùng một phiên, bằng công cụ tìm kiếm web.

## 0. Giới hạn của lần này (đọc trước)

- **Không mở được trang gốc nào.** `WebFetch` trả `getaddrinfo ENOTFOUND` cho `azota.vn` và `www.superprof.com`: chính sách mạng của môi trường chặn tên miền ngoài danh sách cho phép. Mọi số dưới đây là **đoạn trích do công cụ tìm kiếm trả về**, không phải toàn văn trang.
- **Mẹo đã dùng được:** tìm kiếm có `allowed_domains` buộc kết quả đến từ đúng tên miền chính thức (azota.vn, lophoc.app, centerpro.vn, sepay.vn, zalo.solutions, ai.google.dev, payos.vn, congbao.chinhphu.vn, thuvienphapluat.vn). Kết quả là đoạn trích của chính trang đó nên được xếp **M2**. Tìm tiếng Việt không giới hạn tên miền thì ra rác (công cụ chỉ trả kết quả Mỹ).
- Thang tin cậy giữ như báo cáo: **M1** tài khoản thật/mã/văn bản chính thức đọc đủ · **M2** trang chính thức qua đoạn trích tìm kiếm · **M3** blog, trang tư vấn, hãng tự công bố · **M4** suy luận của tôi.
- Quá nửa số giá đối thủ ở đây **báo cáo đã có** (Azota 149.000đ/999.000đ và Point, LopHoc 149.000đ và 60 giao dịch, CenterPro, TutorBird, Teachworks). Phần dưới ghi rõ cái nào là *xác nhận*, cái nào *nâng mức tin cậy*, cái nào *mới*.

## 1. Kết quả mới có giá trị hành động

### 1.1 Gemini: giá chính thức và điều khoản dữ liệu (đóng khoảng trống 8) · **M2**

Ghi chú `ai_cho_giao_vien.md` đã gắn cờ: "điều khoản dữ liệu của Gemini API (gói miễn phí vs trả phí) chưa kiểm — quan trọng vì KiN hiện đang gọi Gemini với dữ liệu đề thi". Giờ có câu trả lời từ trang chính thức:

- **Giá `gemini-2.5-flash`, gói trả phí, tầng Standard:** 0,30 USD / 1 triệu token vào (văn bản, ảnh, video), 1,00 USD (âm thanh); 2,50 USD / 1 triệu token ra, **tính cả token "suy nghĩ"**; bộ nhớ đệm 0,03 USD / 1 triệu. Batch 0,15 / 1,25. Có gói miễn phí giới hạn tốc độ. ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) → khớp con số 0,30/2,50 mà báo cáo đang dùng, nay từ M3 lên **M2** (số token mỗi tác vụ vẫn là giả định M4).
- **Điều khoản:** "Unpaid Services" (gói miễn phí, gồm cả hạn mức miễn phí của Gemini API): Google dùng nội dung gửi vào và câu trả lời để cung cấp, cải thiện, phát triển sản phẩm và công nghệ học máy; **người đánh giá có thể đọc** (đã tách khỏi tài khoản Google, khoá API, dự án Cloud). "Paid Services": **không** dùng để cải thiện sản phẩm, xử lý theo Phụ lục xử lý dữ liệu. Ngoại lệ EEA/Thuỵ Sĩ/Anh: điều khoản trả phí áp cho mọi dịch vụ. Ngoại lệ khác: "Grounding with Google Search" lưu 30 ngày. ([terms](https://ai.google.dev/gemini-api/terms), [logs-policy](https://ai.google.dev/gemini-api/docs/logs-policy))
- **Chuyển sang trả phí:** gắn tài khoản thanh toán và nạp trước tối thiểu 5 USD. ([billing](https://ai.google.dev/gemini-api/docs/billing)) Diễn đàn Google cho biết khi kích hoạt thanh toán thì dùng cả trong hạn mức miễn phí cũng tính là Paid Services (**M3**, bài đăng của nhân viên Google).
- **Hàm ý:** KiN có biến `GEMINI_API_KEY` ở Production (loại sensitive). Tôi **không biết khoá đó thuộc dự án có bật thanh toán hay không**. Nếu là gói miễn phí, đề thi (và bất cứ gì gia sư tải lên) có thể bị Google dùng để cải thiện sản phẩm và người đánh giá đọc được. Cũng áp cho `gemini-embedding-001` (tra trùng câu hỏi). → quyết định **D19** trong Phụ lục F.

### 1.2 Nghị định 13/2023 đã hết hiệu lực từ 01/01/2026 (đóng một phần khoảng trống 5; trả lời Q-LS-01) · **M2/M3**

- Luật Bảo vệ dữ liệu cá nhân **91/2025/QH15**: ban hành 26/06/2025, hiệu lực **01/01/2026** (danh mục [Công báo](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578.htm) · M2). Điều 9: đồng ý phải rõ ràng, cụ thể, lập thành văn bản hoặc dạng kiểm chứng được, **riêng cho từng mục đích**, im lặng không phải đồng ý; được rút lại bằng văn bản/điện tử (đoạn trích [thuvienphapluat](https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Luat-Bao-ve-du-lieu-ca-nhan-2025-so-91-2025-QH15-625628.aspx) · M3).
- **Nghị định 356/2025/NĐ-CP**: ban hành 31/12/2025, hiệu lực 01/01/2026; **Điều 42: Nghị định 13/2023/NĐ-CP hết hiệu lực** kể từ ngày này ([bản tin](https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/102230/nghi-dinh-13-2023-nd-cp-ve-bao-ve-du-lieu-ca-nhan-het-hieu-luc-tu-01-01-2026) · M3).
- **Mâu thuẫn trong kho được giải:** `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 8 (dòng 183, 187) viện **Nghị định 13/2023** (đồng ý kép từ 7 tuổi) → **lỗi thời**. `pheu-gia-su.md` mục 7 của Thanh (Luật 91 + NĐ 356) là bên đúng. Câu Q-LS-01 trong thư luật sư chuyển từ "chốt văn bản nào" thành "xác nhận".
- **Chưa xác nhận được:** quy tắc "từ đủ 7 tuổi cần đồng ý của cả trẻ" có nằm trong Luật 91 Điều 24/Nghị định 356 hay không, và áp dụng khi nào (tìm kiếm không trả điều khoản trẻ em). Q-LS-02 vẫn mở.
- **Chi tiết mới (M3):** Nghị định 356 mở rộng danh mục dữ liệu nhạy cảm, nêu cụ thể hơn dữ liệu ngân hàng-tài chính như **lịch sử giao dịch** → chạm ảnh chuyển khoản (ĐX-08) và đối soát SePay (Q-LS-13, Q-LS-15). Tổ chức phải chỉ định nhân sự/bộ phận bảo vệ dữ liệu cá nhân (tốt nghiệp từ cao đẳng, ≥2 năm kinh nghiệm, có đào tạo) hoặc thuê dịch vụ; **chưa biết có miễn cho doanh nghiệp nhỏ/khởi nghiệp không** → hỏi luật sư. Thời hạn: yêu cầu ngừng xử lý 20 ngày, chỉnh sửa 15 ngày.

### 1.3 Gia hạn tự động bị luật tiêu dùng chặn (đóng một phần khoảng trống 17; củng cố D11) · **M3**

Luật Bảo vệ quyền lợi người tiêu dùng **19/2023/QH15**, Điều 25 khoản 13: không được ghi vào hợp đồng với người tiêu dùng/hợp đồng theo mẫu/điều kiện giao dịch chung điều khoản **gia hạn hợp đồng mà không báo trước hoặc không cho người tiêu dùng chọn tiếp tục hay chấm dứt**; cũng cấm đơn phương đổi giá trong dịch vụ liên tục mà không cho quyền chấm dứt. Hợp đồng theo mẫu phải bằng tiếng Việt, cỡ chữ ≥12 (Nghị định 55/2024 Điều 6); doanh nghiệp có nhiều người tiêu dùng mua thường xuyên phải đăng ký hợp đồng theo mẫu (danh mục từ 01/07/2025) ([tóm tắt 15 điều khoản cấm](https://thuvienphapluat.vn/banan/tin-tuc/chi-tiet-15-dieu-khoan-khong-duoc-ghi-trong-hop-dong-theo-mau-dieu-kien-giao-dich-chung-voi-nguoi-ti-16769.html), [toàn văn Luật 19/2023](https://datafiles.chinhphu.vn/cpp/files/vbpq/2023/7/luat19_2023.pdf)).

- **Củng cố D11** ("Không tự động gia hạn; QR theo kỳ + nhắc T-7/T-3/T-0"): hướng này không đụng điều cấm.
- **Chưa biết:** gia sư mua gói để *kinh doanh* có phải "người tiêu dùng" theo luật này không (khái niệm thường loại mua để kinh doanh); thuê bao phần mềm có nằm trong danh mục phải đăng ký hợp đồng theo mẫu không. → câu hỏi L3 đã có; thêm ý này.

### 1.4 Thu tiền: payOS và SePay (đóng một phần khoảng trống 7) · **M2 (trang quảng bá của chính hãng)**

- **payOS** ([payos.vn](https://payos.vn/)): trang chủ ghi miễn phí khởi tạo, duy trì và giao dịch không giới hạn cho cổng thanh toán từ 23/01/2026; gói miễn phí cho **cá nhân và hộ kinh doanh**; cá nhân chỉ cần CCCD, không cần giấy phép kinh doanh. Bảng phí 2024 trên blog họ đã cũ. → chi phí kỹ thuật để thu thuê bao Pro bằng QR có thể **bằng 0**; chủ thể nhận tiền (D7) vẫn là vấn đề pháp lý riêng, không được suy từ việc cổng cho phép.
- **SePay** ([bảng giá](https://sepay.vn/bang-gia.html)): gói miễn phí **35 giao dịch/tháng**; gói "Cơ bản" 50.000đ/tháng, gói nâng cao 199.000đ/tháng (nằm trong mục eShop, trang được ghi nhận là cũ); vượt hạn mức tính theo giao dịch; cổng QR VietQR 200–500đ/giao dịch. Ưu đãi liên kết Vietcombank cho tài khoản doanh nghiệp/hộ kinh doanh. → với gia sư 10–20 học viên (10–20 giao dịch/tháng) nằm trong hạn mức miễn phí; **chưa rõ KiN dùng tài khoản SePay của ai** nên chưa tính được ai trả phí vượt (hỏi Thanh).

### 1.5 Zalo ZNS: đơn giá chính thức (đóng một phần khoảng trống 7) · **M2**

Trang [zalo.solutions](https://zalo.solutions/business-message/pricing) (đổi tên thành **ZBS Template Message**): mẫu xác thực **300đ**, hầu hết loại còn lại **200đ**/tin, **chưa gồm VAT**; chỉ tính khi gửi thành công; gửi theo UID có mức trợ giá thấp hơn, có thể đổi không báo trước. Khớp con số báo cáo đang dùng (nguồn bên thứ ba trước đó, M3 → nay **M2**).

**Hàm ý kinh tế (M4, phép tính của tôi):** một gia sư 20 học viên nhận 3 bước nhắc (T-7/T-3/T-0) qua ZNS = 60 tin × 200đ = **12.000đ/tháng ≈ 15% giá Pro 79.000đ** (10 học viên: 6.000đ ≈ 7,6%). Con số này **chỉ phát sinh nếu làm P07** (ZNS tự gửi, đang hoãn). Tiền lệ bán lại: CenterPro bán gói 2.000 tin Zalo/SMS giá 499.000đ ([bảng giá](https://centerpro.vn/bang-gia/) · M2) ≈ 250đ/tin, tức cộng khoảng 25% trên giá gốc ZNS.

### 1.6 Sổ Gia Sư: mốc 31/10 (đóng một phần khoảng trống 2) · **M2 (một bài blog của chính họ)**

Một bài trên [sogiasu.com](https://sogiasu.com/blog/cach-tao-lich-hoc-va-link-google-meet) thông báo: tài khoản tạo **trước 31/8/2026** dùng gói Pro miễn phí **đến hết 31/10/2026**. Nghĩa là **trong 7 ngày nữa** đối thủ sát nhất bắt đầu thu tiền thật: đây là phép thử tự nhiên về mức sẵn lòng trả (khoảng trống 3) với chi phí bằng 0 cho KiN. Không rõ tài khoản khảo sát 19/10 (Pro hết hạn 20/10) thuộc nhóm nào; hai thông tin không mâu thuẫn nếu tài khoản đó tạo sau 31/8. → việc **E8** ở Phụ lục F.

### 1.7 Ứng dụng nhỏ miễn phí trên kho ứng dụng (khoảng trống 1/3) · **M3 (mô tả do nhà phát triển tự công bố)**

Tìm trên App Store/Google Play (không có ứng dụng tên "Sổ Gia Sư"): **ClassFast** ([Google Play](https://play.google.com/store/apps/details?id=com.bizfast.classfast): điểm danh, học phí theo tháng, biên lai VietQR, phụ huynh xem điểm danh, giảm trừ học phí; mô tả miễn phí; 5,0★ trên 120 lượt), **Zenk Class** ([App Store](https://apps.apple.com/vn/app/zenk-class/id6772459435): lịch tuần, check-in từng buổi, tự tính học phí cuối tháng, biên nhận VietQR), **Check5s**, **ClassClap**, "Quản Lý & Điểm Danh" (người dùng phàn nàn bị đòi trả phí sau một thời gian dùng). → (a) lõi sổ lớp **phải giữ miễn phí** vì chuẩn thị trường thấp là miễn phí (khớp báo cáo mục 4.2: ít nhất bảy sản phẩm miễn phí hoặc Free rộng); (b) phản ứng "đòi tiền sau khi dùng quen" là có thật → củng cố D10 (giữ quyền cho người dùng hiện có).

## 2. Xác nhận hoặc nâng mức tin cậy (không đổi kết luận)

| Điểm | Trước | Nay | Nguồn |
|---|---|---|---|
| Azota VIP cá nhân 149.000đ/tháng hoặc 999.000đ/năm; 2 thiết bị mặc định, nâng 5/10; AI tính bằng "Point" trả trước tách khỏi VIP, gói VIP không kèm Point AI; VIP tổ chức báo giá theo số giáo viên/học sinh | M2 | M2 (trang bảng giá + tài liệu hướng dẫn, xác nhận lần 2) | [azota.vn/bao-gia](https://azota.vn/bao-gia/), [docs.azota.vn](https://docs.azota.vn/docs/huong-dan-su-dung/goi-vip-point/) |
| LopHoc: Plus 149.000đ (119.000đ/tháng nếu trả năm), Pro 399.000đ (319.000đ), Center 990.000đ (790.000đ); trả năm giảm 20%; 30 ngày Pro miễn phí không cần thẻ, hết hạn tự về Free không mất dữ liệu | M2 | M2 | [lophoc.app](https://lophoc.app/) |
| **LopHoc hạn mức AI:** Plus **500 lượt AI/tháng**, Pro **2.000 lượt/tháng**; Plus 60 giao dịch tự đối soát/tháng, 2 ghế giáo viên; Pro 150 giao dịch, 5 ghế, sổ thu chi + lương; Center 20 ghế | chưa có chi tiết lượt AI | M2 (đơn vị "lượt AI" chưa định nghĩa, không so thẳng với "3/20 lượt tệp" của F5) | [lophoc.app](https://lophoc.app/) |
| CenterPro: Free (trang giá ghi 70 học viên, bảng so sánh ghi 300), Cơ bản 199.000đ (≤300 học viên, 1 điểm), Nâng cao 399.000đ (≤700, 2 điểm, ZNS marketing), Không giới hạn 599.000đ (4 điểm), vĩnh viễn 14.999.000đ; gói 2.000 tin 499.000đ; điểm thứ hai 299.000đ/tháng | M2 | M2; **mâu thuẫn nội bộ 70 vs 300** ghi nhận | [centerpro.vn/bang-gia](https://centerpro.vn/bang-gia/) |
| TutorBird: **16,95 USD/tháng** + 4,95 USD mỗi gia sư thêm; một gói đủ tính năng, **không giới hạn học viên**; thử 30 ngày, hoàn tiền trong 90 ngày. (14,95 là bản cũ) | hai con số 14,95 và 16,95 cùng có | **16,95 là hiện hành** (đoạn trích trang chính thức) | [tutorbird.com/pricing](https://tutorbird.com/pricing) |
| Teachworks: Starter 16,49 USD + 0,29/buổi-học-viên; Growth 47,99 + 0,172; Premium 187,99 + 0,059; không giới hạn học viên; thử 3 tuần | M2/M3 | M2 | [blog Teachworks](https://blog.teachworks.com/2023/11/teachworks-pricing-explained-pay-for-what-you-use/) |
| Quizlet Plus 7,99 USD/tháng hoặc 35,99 USD/năm, AI (Q-Chat, Magic Notes) chỉ ở Plus; Kahoot+ Bronze 48 / Silver 96 / Gold 144–180 USD/năm (Gold có AI); Photomath Plus ~9,99 / 69,99 USD (nguồn yếu); Duolingo Max **không xác minh được** | chưa tra | M3 (trang tổng hợp chất lượng thấp, trừ Kahoot trang chính thức M2) | [Kahoot plans](https://kahoot.com/schools/plans/) |
| Superprof: doanh thu chính từ **Student Pass** phía học viên (đoạn trích phản hồi của hỗ trợ: 39 bảng/tháng, liên hệ không giới hạn gia sư trong 30 ngày), gia sư gần như không trả; một đánh giá cũ nêu Premium của gia sư 69 bảng/năm | chưa tra | M3, giá lẫn thời điểm | [Trustpilot UK](https://dk.trustpilot.com/review/superprof.co.uk) |
| Nhắc nợ tự động giảm ngày thu tiền | M3 (khẳng định yếu) | **Vẫn M3/M4**: không có nghiên cứu có đối chứng, chỉ số liệu hãng (DSO 40 so với 47 ngày; giảm 3–7 ngày; ca đơn lẻ 45→18 ngày) và cảnh báo nhịp nhắc: nhắc dồn mỗi 3 ngày làm giảm tỉ lệ mở, leo thang ba bước cải thiện | [Resolve](https://resolvepay.com/blog/18-statistics-proving-that-automated-dunning-emails-accelerate-cash-collection), [Agicap](https://agicap.com/en/article/automated-payment-reminders/) |
| Thông tư 29/2024/TT-BGDĐT (hiệu lực 14/02/2025, thay Thông tư 17/2012): gia sư là người dạy thêm; tự mở lớp thu tiền phải đăng ký kinh doanh và công khai môn, thời lượng, địa điểm, hình thức, thời gian, danh sách người dạy, mức thu trước khi tuyển sinh; làm qua trung tâm thì ký hợp đồng với trung tâm | M3 | M3 (giải đáp của trang tư vấn, không phải văn bản gốc) | [thuvienphapluat](https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/79131/thong-tu-29-2024-ve-day-them-hoc-them-co-ap-dung-doi-voi-gia-su-khong) |
| Thuế GTGT: Nghị định 181/2025 Điều 4 khoản 13 loại *sản phẩm/dịch vụ phần mềm theo pháp luật công nghệ thông tin* khỏi diện chịu thuế; không đáp ứng điều kiện thì 5% theo Thông tư 69/2025 (ví dụ công văn 4998) | M3 | M3, vẫn **chưa có toàn văn khoản 13** | [thuvienphapluat](https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Nghi-dinh-181-2025-ND-CP-huong-dan-Luat-Thue-gia-tri-gia-tang-646124.aspx) |

**Chi tiết pháp lý mới nhưng chưa được hỏi (M3), đưa vào thư luật sư:** theo giải đáp trên thuvienphapluat, (a) **không tổ chức dạy thêm cho học sinh tiểu học**, trừ nghệ thuật, thể dục thể thao, kỹ năng sống; (b) **giáo viên đang dạy ở trường không được dạy thêm có thu tiền chính học sinh mình được phân công dạy**. KiN hiện không kiểm hai điều này ở tài khoản gia sư.

## 3. Quy mô thị trường (khoảng trống 11, đóng rất ít) · **M2 cho số vĩ mô, không cho sức mua phần mềm**

- Khảo sát mức sống dân cư 2024 (Cục Thống kê): trong chi tiêu giáo dục của hộ, học phí và khoản trái tuyến chiếm 41,1%, **học thêm 21,4%**, giáo dục khác 19,3% ([thông cáo](https://www.nso.gov.vn/tin-tuc-thong-ke/2025/05/thong-cao-bao-chi-ket-qua-khao-sat-muc-song-dan-cu-nam-2024/)). Khảo sát 2020: học thêm trung bình khoảng 1,2 triệu đồng/người đi học/năm, 17,5% chi giáo dục ([GSO](https://www.gso.gov.vn/du-lieu-va-so-lieu-thong-ke/2021/09/chi-tieu-cho-giao-duc-dao-tao-cua-cac-ho-gia-dinh-o-viet-nam-nhung-nam-gan-day/)). Viện Khoa học giáo dục: học thêm là khoản lớn nhất trong phần gia đình chi ở bậc phổ thông (tiểu học 32%, THCS 42%, THPT 43%) (báo, M3).
- **Không trả lời được:** có bao nhiêu gia sư/giáo viên dạy thêm cá nhân, bao nhiêu người dùng Excel/sổ giấy, mức sẵn lòng trả cho phần mềm. Cầu học thêm là có thật và bền; chưa có dữ kiện về cầu *phần mềm quản lý* của người dạy. Số "75% phụ huynh cho con học thêm" của báo Thanh Niên là khảo sát cũ (khoảng 2014), "86% học sinh thành phố lớn" của VnExpress không rõ nguồn: **không dùng**.

## 4. Còn chưa đóng được

- **Trang giá gốc chưa đọc đủ**: mọi giá ở trên là đoạn trích. Mở được bằng cách nới "Network access" của môi trường (xem Phụ lục F.6).
- Số liệu nội bộ KiN (khoảng trống 4, 10, 14): cần đọc DB và hoá đơn Production, tôi không có quyền.
- Hỏi trực tiếp (khoảng trống 3, 12): phỏng vấn gia sư, báo giá trung tâm.
- Toàn văn: khoản 13 Điều 4 Nghị định 181/2025; Điều 24 Luật 91 và điều khoản trẻ em Nghị định 356; Thông tư 29/2024 và 19/2026 (tôi chưa thấy bài nào nhắc 19/2026 trong lần tìm này).
- Teachmint, Classplus, Vedantu, Ruangguru: chỉ có giá thứ cấp, mâu thuẫn (Teachmint 5 / 10 / 25 USD mỗi người dùng, nguồn không chính thức; Classplus 19.999–31.999 rupee/năm cho cơ sở dạy), và là sản phẩm cho trung tâm nên **không dùng làm mốc** cho gia sư 1–20 học viên.
