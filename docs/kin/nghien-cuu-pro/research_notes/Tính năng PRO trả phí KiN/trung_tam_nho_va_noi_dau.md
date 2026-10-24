# Nỗi đau thật của gia sư/trung tâm nhỏ ở Việt Nam, khung ROI cho Pro, và gói "Nhóm/Trung tâm" cho KiN

> Ghi ngày 22/10/2026. Người ghi: researcher (Claude). Đối tượng: KiN (trước là Midnight Elite).
>
> **Cách đọc nhãn độ tin cậy (đọc trước):**
> - **[Đã kiểm nguồn*]** = con số/ý đọc được trong kết quả tìm kiếm gắn với đúng URL đó. Dấu `*` nghĩa là **chưa mở được trang gốc**: công cụ WebFetch của phiên này lỗi DNS (`ENOTFOUND`) với mọi tên miền thử (capterra, teachworks, xero, giaoduc.net.vn, mytour.vn, teachngo). Mọi số liệu ngoài kho code đều đi qua bản tóm tắt của công cụ tìm kiếm, nên người viết báo cáo cần coi đây là mức "thấy trong kết quả tìm kiếm", chưa phải "đã đọc toàn văn".
> - **[Số liệu hãng]** = con số do chính nhà bán phần mềm công bố (tiếp thị), không có mẫu/phương pháp. Không dùng làm bằng chứng độc lập.
> - **[Thứ cấp]** = trang trích lại từ nguồn khác, chưa thấy nguồn gốc.
> - **[Suy luận]** = tôi tự suy ra từ các dữ kiện bên trên; mọi phép tính ghi giả định để tính lại.
> - Việc kiểm kho code (số file kiểm quyền, quyết định D02) là dữ kiện đo được trong repo `/home/user/midnight-elite` tại ngày ghi, trích bằng đường dẫn file thay vì URL.
> - Tỷ giá dùng để quy đổi: **26.000 đ/USD (giả định, không kiểm được tỷ giá tháng 10/2026)**.
> - Một số URL trong cụm kết quả không được tóm tắt gắn rõ cho từng con số; khi vậy tôi ghi "URL ứng viên" thay vì nhận bừa một trang.

---

## 1. Nỗi đau tài chính và thời gian của gia sư/giáo viên dạy kèm (Việt Nam là chính) và khung ROI cho Pro

### Takeaway
Tôi **không tìm được một khảo sát độc lập nào** (Việt Nam hay quốc tế) đo tỉ lệ học phí trễ/nợ, buổi bị quên tính hay số giờ làm sổ sách của gia sư nhỏ; toàn bộ số liệu "gia sư mất X%" là số liệu của hãng phần mềm. Vì vậy khung ROI chỉ vững ở dạng **công thức + ngưỡng hoàn vốn** (Pro phải cứu được khoảng 1,5 giờ hoặc khoảng 1% doanh thu mỗi tháng thì hoà vốn), còn tỉ lệ thất thu phải tự đo bằng dữ liệu KiN (~25 học sinh thật).

### Cited Findings

**A. Quy mô tiền: gia sư VN thu bao nhiêu (để đổi ra VND)**
- Khảo sát của Tri Thức - Znews cho thấy thù lao gia sư phổ biến 120.000 đến 350.000 đ/buổi (1,5 đến 2 giờ). [Đã kiểm nguồn*] — [Znews, tuyển gia sư thứ 8](https://znews.vn/tuyen-gia-su-thu-8-vi-7-nguoi-da-bo-chay-o-tphcm-viral-mxh-post1634341.html) (năm bài chưa xác định)
- Khung theo giờ trên trang tuyển dụng: tiểu học khoảng 100.000 đến 250.000 đ, THCS 150.000 đến 300.000, THPT 200.000 đến 400.000, luyện thi ĐH 300.000 đến 600.000, ngoại ngữ 250.000 đến 500.000, gia sư online 100.000 đến 500.000 đ/giờ. [Đã kiểm nguồn*; đây là khung tham khảo của trang tuyển dụng, không phải khảo sát] — [CareerViet](https://careerviet.vn/viec-lam/gia-su-k-vi.html)
- Một ví dụ đơn lẻ: sinh viên sư phạm Hà Nội dạy 140.000 đ/buổi 2 giờ, khoảng 4 buổi/tuần. [Đã kiểm nguồn*; một trường hợp, không đại diện] — [Znews](https://znews.vn/sinh-vien-song-rung-rinh-voi-nghe-go-dau-tre-post262564.html)
- Không tìm được khảo sát thu nhập trung bình gia sư 2025 ở TP.HCM/Hà Nội; kết quả chỉ là bảng lương tin tuyển dụng. (xem Gaps)

**B. Học phí trễ/nợ, cảm giác ngại nhắc (bối cảnh VN, chủ yếu là trường học chứ không phải gia sư riêng)**
- Một giáo viên tiểu học kể cô chưa quen việc nhắc học sinh nộp tiền, thấy việc này trái "thiên chức"; có phụ huynh bắt máy lịch sự xin khất, có người lảng tránh không nghe máy. [Đã kiểm nguồn*; bối cảnh trường học] — [Giáo dục Việt Nam: "Thầy cô giáo đâu phải kẻ… đòi nợ thuê"](https://giaoduc.net.vn/thay-co-giao-dau-phai-ke-doi-no-thue-post179139.gd)
- Một bài báo nêu không ít phụ huynh đóng học phí dây dưa cả năm học vẫn chưa xong, khiến giáo viên phải đứng ra đòi. [Đã kiểm nguồn*; bối cảnh trường học, không có tỉ lệ] — [Giáo dục Việt Nam: "Giáo viên thành người đòi nợ"](https://giaoduc.net.vn/giao-duc-24h/giao-vien-thanh-nguoi-doi-no-loi-cua-khong-it-phu-huynh-post201208.gd)
- Có địa phương cấm giáo viên nhắc học sinh nộp tiền (Khánh Hòa) và TP.HCM có quy định giáo viên không trực tiếp thu chi. [Đã kiểm nguồn*; áp cho trường công, không áp cho gia sư/trung tâm tư] — kết quả tìm kiếm cùng cụm với [Giáo dục Việt Nam](https://giaoduc.net.vn/thay-co-giao-dau-phai-ke-doi-no-thue-post179139.gd) (URL ứng viên; tóm tắt không gắn riêng trang)
- Một bài báo có tiêu đề "Một số phụ huynh chưa hiểu, không chịu đóng học phí online" cho thấy có lực cản phía phụ huynh với thanh toán online. [Đã kiểm nguồn* ở mức tiêu đề; chưa đọc nội dung, bối cảnh trường học] — [Giáo dục Việt Nam](https://giaoduc.net.vn/mot-so-phu-huynh-chua-hieu-khong-chiu-dong-hoc-phi-online-post208213.gd)
- Tôi không tìm thấy tin/khảo sát nào về **gia sư riêng bị phụ huynh "quỵt" học phí**. Truy vấn tiếng Việt về chủ đề này chỉ trả về các bài về lừa đảo khi nhận lớp qua môi giới: sinh viên chuyển phí nhận lớp (30%) cho người nhượng lớp rồi mất tiền, hơn 10 gia sư khác bị lừa cùng cách. [Đã kiểm nguồn*; bài năm 2021] — [Tuổi Trẻ, 29/04/2021](https://tuoitre.vn/sinh-vien-tranh-mat-tien-oan-vi-chieu-lua-tuyen-gia-su-tren-mang-20210429171836316.htm)

**C. Thời gian làm sổ sách/tính học phí/nhắn phụ huynh (quốc tế, toàn bộ là số liệu hãng hoặc giai thoại)**
- Một công ty gia sư ở London (Explore Apollo Tuition) mất khoảng 3 ngày đầy đủ mỗi tháng để tính tiền thủ công và đòi phụ huynh; sau khi dùng phần mềm Wise (nhắc đa kênh WhatsApp/push/email, xuất hoá đơn tự động) báo 0 khoản trễ và "lấy lại 288 giờ/năm". [Số liệu hãng; một case study do chính Wise đăng] — [Wise blog](https://www.wise.live/blog/?p=5249)
- Trong bài đó, con số "thất thu 5 đến 10% doanh thu" không có nguồn gốc nêu rõ. [Số liệu hãng, nguồn gốc không rõ] — [Wise blog](https://www.wise.live/blog/?p=5249)
- Sem Tuition (Anh): chủ cũ dành tối Chủ nhật xem lại sổ buổi học và nhắn từng phụ huynh để thu tiền; một trang liệt kê bên thứ ba ghi "giảm 80% việc hành chính". [Số liệu hãng] — [Wise blog](https://www.wise.live/blog/?p=4061)
- Ước tính 5 đến 10 giờ/tuần chỉ riêng lịch học (blog hãng), và một blog khác ghi 6 đến 10 giờ/tuần cho lịch + hoá đơn + đòi tiền + ghi chú buổi học, dẫn lại eLearning Industry (con số này tôi chưa kiểm được). [Số liệu hãng; URL ứng viên, tóm tắt không chỉ rõ trang] — [Schedly](https://schedly.io/?p=18236), [Wise "Time Management Tips"](https://www.wise.live/blog/?p=5309), [eLearning Industry](https://elearningindustry.com/advertise/elearning-marketing-resources/blog/the-hidden-cost-of-admin-overload-how-technology-can-save-tutoring)
- TutorCruncher đăng một case study khách hàng (AJ Education) giảm 60% thời gian hành chính. [Số liệu hãng; một khách hàng] — [TutorCruncher](https://tutorcruncher.com/blog/tutor-management-software-ajeducation-case-study)
- Một blog trên USC Scalar kể ví dụ minh hoạ gia sư toán 40 học sinh giảm hành chính từ gần 10 giờ/tuần xuống 2 giờ/tuần; đây là ví dụ minh hoạ, không phải dữ liệu. [Thứ cấp, giả định minh hoạ] — [USC Scalar blog](https://scalar.usc.edu/works/s-blogs-3/10-best-tutor-management-software-platforms-for-2025)
- Một vendor nêu ước tính "tiết kiệm 3 đến 5 giờ/tuần mỗi gia sư" nhờ tự động hoá ghi chú, thu tiền và báo cáo. [Số liệu hãng, tự báo cáo] — kết quả tìm kiếm cùng cụm Wise/Schedly ở trên (URL ứng viên: [Wise](https://www.wise.live/blog/?p=5309))

**D. Buổi nghỉ/không đến/buổi bù/nghỉ sát giờ (quốc tế)**
- Tiếp thị của phần mềm hẹn lịch: khoảng 1/5 buổi giáo dục/gia sư kết thúc bằng no-show, trên 30% với chương trình miễn phí/được tài trợ. [Số liệu hãng; số này chủ yếu phản ánh chương trình miễn phí, không đại diện gia sư trả phí] — [AppointmentReminder](https://appointmentreminder.com/industries/education)
- Một blog gia sư dẫn "RAND 2024: no-show trung bình 23% trong dạy kèm bổ trợ"; tôi không xác nhận được trong bản gốc RAND. [Thứ cấp, chưa kiểm] — URL ứng viên: [Doodle](https://doodle.com/en/how-tutors-can-simplify-scheduling-and-reduce-no-shows/)
- Thử nghiệm nội bộ của một nền tảng dạy kèm online: học sinh nhận email nhắc có no-show thấp hơn 17% so với nhóm đối chứng. [Số liệu hãng, thử nghiệm nội bộ] — URL ứng viên: [Upswing](https://upswing.io/?p=2866)
- Quy ước chính sách huỷ phổ biến: báo trước 24 đến 48 giờ, phạt 50% (huỷ trễ) đến 100% (no-show). Một thoả thuận gia sư ghi phạt 75% học phí giờ nếu huỷ muộn/no-show; một trung tâm khác thu $15 phí no-show/huỷ trong 24 giờ và cộng $10 nếu chưa trả đủ trong 24 giờ sau buổi. [Số liệu hãng cho phần 50%/100%; các điều khoản là chính sách thật của từng gia sư/trung tâm] — [SchedulingKit](https://schedulingkit.com/payments/tutors), [thoả thuận TutorCruncher](https://secure.tutorcruncher.com/view-branch-terms/11042) (URL ứng viên cho mức 75%), [TutorBird policies](https://prepinteractive.tutorbird.com/Policies) (URL ứng viên cho $15/$10)
- Wyzant (nền tảng lớn) để mức phí huỷ là tuỳ chọn, tuỳ gia sư. [Đã kiểm nguồn*] — [Wyzant support](https://support.wyzant.com/tutors/tutor-account/how-do-i-determine-my-cancellation-policy/)
- Nguồn nêu mức no-show kèm giá giờ $50 đến $75: một buổi 45 phút mất $37 đến $56 doanh thu. [Số liệu hãng, phép nhân đơn giản; URL ứng viên, tóm tắt không chỉ rõ trang] — [Wise blog](https://www.wise.live/blog/?p=5104)
- Không tìm được dữ liệu VN về tranh cãi buổi nghỉ/buổi bù, nhắn từng phụ huynh qua Zalo, hay học sinh bỏ giữa chừng. (xem Gaps)

**E. Bằng chứng ngược chiều (gia sư coi sổ sách là việc nhỏ; nợ học phí hiếm với người thu trước)**
- Thực tiễn quốc tế là **thu trước theo gói/tháng và không hoàn tiền**: nhiều gia sư/trung tâm ghi rõ buổi trong tháng đã trả trước không hoàn lại; có nơi cho nghỉ hai trong bốn buổi của gói nếu báo trước một ngày làm việc. [Chính sách thật của từng gia sư] — [TutorBird: Above the Limit](https://abovethelimit.tutorbird.com/PAYMENT-PLANS---POLICIES), [Organic Chemistry Tutor](https://www.organicchemistrytutor.com/refund_returns/)
- Một nhà cung cấp phần mềm tự nói thu trước theo gói "như khoản đầu tư giáo dục" và hoá đơn theo từng buổi dễ gây rời bỏ. [Số liệu hãng, nhưng đồng thời là bằng chứng rằng mô hình thu trước thu hẹp phạm vi nợ] — [SchedulingKit](https://schedulingkit.com/payments/tutors)
- Ở VN, nỗi đau được báo chí ghi nhận lại nằm **ở phía phụ huynh bị trung tâm giữ tiền** (Apax English Lào Cai: phụ huynh đóng 24 triệu cho 96 buổi, trung tâm còn nợ hơn 13 triệu, mới trả 50%; Apax Đà Nẵng: khoảng 30 phụ huynh khiếu nại, có học sinh chỉ học 5 đến 6 buổi), chứ không phải gia sư bị nợ. [Đã kiểm nguồn*; vụ việc đơn lẻ, không phải khảo sát] — [PLO](https://plo.vn/phu-huynh-den-trung-tam-tieng-anh-doi-lai-tien-hoc-phi-post704002.html), [Báo Lào Cai](https://baolaocai.vn/trung-tam-apax-english-lao-cai-am-tham-dong-cua-phu-huynh-nhao-nhac-doi-hoc-phi-post362393.html)
- Đã có app miễn phí cho lớp học thêm trên App Store VN: "Quản Lý & Điểm Danh" (tạo danh sách lớp, thống kê điểm danh, phụ huynh đăng nhập bằng số điện thoại để xem học phí). [Đã kiểm nguồn*] — [App Store](https://apps.apple.com/app/id6448912318)

**F. Số liệu nợ hoá đơn quốc tế cho doanh nghiệp nhỏ (làm mốc, KHÔNG phải gia sư)**
- Báo cáo Intuit QuickBooks 2025 (qua trang thứ cấp): 56% doanh nghiệp nhỏ Mỹ có hoá đơn chưa thu, trung bình $17.500 mỗi doanh nghiệp; 47% có hoá đơn quá hạn trên 30 ngày; mẫu 2.487 doanh nghiệp dưới 100 nhân viên. Một trang khác nêu 59% có ít nhất một hoá đơn quá hạn trên 30 ngày (khác định nghĩa/mẫu). [Thứ cấp, B2B Mỹ, không tương đương học phí] — [Agiled](https://agiled.app/statistics/late-payment-statistics), [Stealth Agents](https://stealthagents.com/research/small-business-overdue-invoice-statistics-2026)
- FreshBooks: tiêu đề bản tin "40% freelancer bước vào mùa lễ với hoá đơn chưa thu" (chưa đọc nội dung, năm chưa xác định). [Đã kiểm nguồn* ở mức tiêu đề] — [FreshBooks press](https://freshbooks.com/press/data-research/study-40-of-freelancers-will-head-into-the-holiday-season-with-unpaid-invoices)

### Inferences

**Khung ROI (có thể tính lại).** Dưới đây là phép tính, không phải số liệu quan sát. Mọi giả định bên dưới là của tôi.

Giả định:
- G1. 1 buổi = **200.000 đ** (thấp hơn giữa khoảng 120.000 đến 350.000 đ/buổi của Znews).
- G2. **8 buổi/học sinh/tháng** (2 buổi/tuần).
- G3. Giá trị 1 giờ của gia sư = **100.000 đ** (đáy khung tiểu học của CareerViet).
- G4. Giá Pro giả định = **149.000 đ/tháng** (chưa chốt; thay số khác thì chia lại).
- G5. Thời gian làm sổ/tháng: **10 / 20 / 30 phút mỗi học sinh** (thấp / trung bình / cao) cho tính học phí, nhắn Zalo, nhắc lại, đối chiếu. Đây là giả định, không có nguồn VN.
- G6. Thất thu tiền (% doanh thu): thấp **0,5%** (nợ không đòi được); trung bình **1% nợ + 2% buổi quên tính = 3%**; cao **3% + 4% = 7%**. Mục "buổi quên tính" **chỉ đúng với gia sư tính theo buổi**; gia sư thu cố định theo tháng gần như không mất khoản này. Các tỉ lệ này tôi chọn để có thang chạy thử, không có dữ liệu VN; mốc gần nhất ("5 đến 10% rò rỉ" của Wise) là số liệu hãng không rõ nguồn.

Kết quả (đ/tháng, làm tròn nghìn). Doanh thu D = n × 8 × 200.000 = n × 1.600.000.

| n học sinh | D (đ/tháng) | Mất: Thấp | Mất: TB | Mất: Cao |
|---|---|---|---|---|
| 5 | 8.000.000 | 123.000 (40k tiền + 83k giờ) | 407.000 (240k + 167k) | 810.000 (560k + 250k) |
| 10 | 16.000.000 | 247.000 (80k + 167k) | 813.000 (480k + 333k) | 1.620.000 (1.120k + 500k) |
| 15 | 24.000.000 | 370.000 (120k + 250k) | 1.220.000 (720k + 500k) | 2.430.000 (1.680k + 750k) |

Ngưỡng hoà vốn của Pro 149.000 đ:
- Theo thời gian: **149.000 / 100.000 = 1,49 giờ/tháng** phải cứu được.
- Theo doanh thu: 149.000 / D = **1,86% (n=5), 0,93% (n=10), 0,62% (n=15)** doanh thu.
- Tỉ lệ khoản mất Pro phải cứu để hoà vốn: n=5: 121% (Thấp, **không hoà vốn**), 37% (TB), 18% (Cao). n=10: 60% / 18% / 9%. n=15: 40% / 12% / 6%.
- Một cách nói dễ hiểu: Pro 149.000 đ **rẻ hơn 1 buổi dạy** (200.000 đ). Đây là so sánh số học, không phải bằng chứng hành vi.

Đọc kết quả:
1. Với **5 học sinh và mức thất thu thấp, Pro không tự hoàn vốn bằng tiền**; lý lẽ chỉ còn là "nhẹ đầu, đỡ ngại nhắc". Với **từ 10 học sinh trở lên và mức trung bình**, Pro chỉ cần cứu chưa tới 1/5 khoản mất là hoà vốn. Do đó đối tượng ROI mạnh nhất là gia sư/tổ từ 10 đến 15 học sinh, không phải người dạy 1 đến 3 học sinh (kho này ghi 79% gia sư dạy 1 đến 3 học sinh, xem mục 4).
2. **Phần lớn lợi ích của nhắc nợ tự động là thời gian và gánh nặng tinh thần, không phải tiền lãi vì thu sớm.** Dòng tiền 16 triệu thu sớm 5 ngày gần như không có giá trị tài chính đáng kể ở lãi suất thông thường; cái đáng tiền là bớt ngại, bớt tranh cãi. Khung ROI nên nói "giờ + bớt ngại + hồ sơ rõ ràng khi tranh cãi", đừng hứa "tăng doanh thu X%".
3. Bước đo nhanh nhất để thay giả định: lấy dữ liệu thật của ~25 học sinh trong KiN: tỉ lệ phiếu quá hạn, số ngày trễ trung bình, số buổi được ghi sau ngày, số tin nhắn nhắc gửi tay trước khi có KiN (nếu hỏi được). Một lần khảo sát 5 đến 10 gia sư đang dùng sẽ có giá trị hơn mọi số liệu hãng.
4. Điểm dễ bị bắt bẻ: bằng chứng "nợ học phí hiếm" (mục E) và "thu trước theo tháng" khiến lập luận thất thu yếu với gia sư đã có thói quen thu đầu tháng. Nên định vị Pro quanh **thời gian + trải nghiệm phụ huynh + hồ sơ buổi học**, với thất thu là phụ.

### Gaps
- Không có khảo sát độc lập (VN hay quốc tế) về tỉ lệ học phí trễ/nợ của gia sư; mọi số "gia sư mất X%" là số liệu hãng.
- Không có số liệu VN về: số giờ/tháng làm sổ của gia sư; tranh cãi buổi nghỉ/buổi bù; nhắn Zalo từng phụ huynh; tỉ lệ học sinh bỏ giữa chừng; nghỉ sát giờ. Các truy vấn tiếng Việt chỉ trả về bài về trường công hoặc lừa đảo môi giới.
- Không có khảo sát thu nhập gia sư 2025 (chỉ có bảng lương tin tuyển dụng và trường hợp đơn lẻ).
- Không xác nhận được con số RAND 23% no-show và con số "6 đến 10 giờ/tuần" từ eLearning Industry.
- Chưa mở được trang nào để đọc toàn văn (WebFetch lỗi DNS); các tiêu đề báo VN (nhóm B) mới ở mức tiêu đề + tóm tắt, cần người viết báo cáo hoặc lượt sau mở lại để xác nhận năm đăng và nội dung.

---

## 2. Nhắc nợ/theo dõi công nợ tự động có tác động thật không (bằng chứng Stripe/QuickBooks/FreshBooks/Xero…)

### Takeaway
**Không tìm được nghiên cứu độc lập nào đo tác động của nhắc thanh toán tự động.** Các con số nghe thuyết phục ("thu nhanh gấp 2 đến 3 lần", "đến ngày 30 thanh toán 80,8% so với 54,7%") đều là tiếp thị của hãng hoặc trích lại không rõ nguồn; con số duy nhất có cơ chế rõ là nhắc hẹn giảm no-show 17% trong thử nghiệm nội bộ của một nền tảng. Kết luận an toàn: nhắc tự động **có thể** hữu ích và rẻ, nhưng mức tác động chưa được chứng minh; nên đo bằng A/B ngay trong KiN.

### Cited Findings
- So sánh của một hãng phần mềm: đến ngày thứ 30, 80,8% hoá đơn được trả khi bật nhắc, so với 54,7% khi tắt nhắc; không nêu mẫu hay phương pháp. [Số liệu hãng] — URL ứng viên trong cụm kết quả (tóm tắt không chỉ rõ trang): [Gas Engineer Software](https://gasengineersoftware.co.uk/blog/invoice-payment-reminders-effectiveness-for-plumbers-engineers/)
- Một đơn vị tư vấn tự động hoá nói chuỗi nhắc tự động thường giảm DSO 3 đến 7 ngày trong chu kỳ đầu, không đưa dữ liệu. [Số liệu hãng] — URL ứng viên: [LowCode Agency](https://www.lowcode.agency/blog/send-automated-invoice-reminders)
- Một hãng phần mềm cơ sở vật chất nói thời gian thu trung bình của khách hàng giảm khoảng 15 đến 20 ngày. [Số liệu hãng; tóm tắt cắt ngang trước khi nêu nguồn] — URL ứng viên: [Fieldproxy](https://www.fieldproxy.ai/automations/facilities-send-payment-reminder)
- Một hãng khác báo DSO giảm từ 47 xuống 40 ngày khi dùng thanh toán tự động (rộng hơn nhắc nợ). [Số liệu hãng] — URL ứng viên: [Swipe](https://getswipe.in/blog/article/reduce-late-payments-with-automated-invoice-reminders)
- Stripe: "87% hoá đơn Stripe được trả trong 24 giờ"; trang xếp cạnh tính năng nhắc nhưng **không** nói nhắc là nguyên nhân; Stripe nêu mục tiêu giảm DSO nhưng không nêu con số. [Đã kiểm nguồn* — số liệu hãng, không gắn nhân quả] — [Stripe Invoicing](https://stripe.com/invoices)
- FreshBooks (bản tin của chính hãng, theo tóm tắt): doanh nghiệp dùng FreshBooks kèm cổng thanh toán online thường được trả nhanh gấp đôi so với không dùng cổng — nói về **thanh toán online**, không phải nhắc nợ. [Số liệu hãng; URL ứng viên] — [FreshBooks press](https://freshbooks.com/press/data-research/study-40-of-freelancers-will-head-into-the-holiday-season-with-unpaid-invoices)
- FreshBooks phân tích điều khoản: ghi "21 ngày" được trả nhanh hơn "ngay khi nhận". [Đã kiểm nguồn* qua tóm tắt bài Inc.] — [Inc.](https://www.inc.com/jessica-stillman/3-invoice-changes-to-get-paid-faster.html)
- Câu "hoá đơn có nhắc tự động được trả nhanh gấp 2 đến 3 lần; 37 đến 45 ngày so với 14 đến 21 ngày" được blog freelance gán cho FreshBooks/QuickBooks nhưng **không kèm nghiên cứu gốc**; một trang Gumroad ghi "nhắc lịch sự nhanh hơn 2 ngày" cũng viện "FreshBooks Research" mà không dẫn. [Thứ cấp, chưa kiểm — không nên trích] — URL ứng viên: [YouGot.ai](https://www.yougot.ai/blog/work/freelancer-tools/invoice-payment-reminder-app), [Gumroad](https://quietbuilderf.gumroad.com/l/ymqol)
- Xero (qua tóm tắt thứ cấp): hoá đơn thanh toán online được trả nhanh hơn tới 2 lần so với offline. [Thứ cấp, nói về kênh thanh toán] — [Xero guide](https://www.xero.com/us/guides/how-to-reduce-payment-delays/); tóm tắt qua [SchedulingKit](https://schedulingkit.com/statistics/late-payment-statistics)
- Nhắc hẹn ảnh hưởng no-show: nhóm có email nhắc thấp hơn 17% no-show (thử nghiệm nội bộ); một blog khác dẫn "nhắc tự động giảm vắng mặt khoảng 30% trong chương trình toán sau giờ học" nhưng cũng là nguồn gián tiếp. [Số liệu hãng; thứ cấp] — URL ứng viên: [Upswing](https://upswing.io/?p=2866), [Doodle](https://doodle.com/en/how-tutors-can-simplify-scheduling-and-reduce-no-shows/)
- Phía VN: không có số liệu thu hồi nợ hoặc tác động nhắc nợ cho học phí. Điều tìm được là **rào cản tâm lý phía người nhắc** (giáo viên thấy ngại, phụ huynh né) và quy định cấm giáo viên trường công tự nhắc nộp tiền (xem mục 1B).

**Bằng chứng ngược chiều**
- Các con số lớn nhất (trả nhanh gấp 2 đến 3 lần; DSO giảm 15 đến 20 ngày) đến từ hãng bán phần mềm, không có mẫu/phương pháp, và cố ý đặt cạnh sản phẩm. Stripe tự nói 87% trong 24 giờ nhưng không quy cho nhắc nợ.
- Lợi ích có thể đến từ **kênh thanh toán dễ** (online/QR) hơn là từ **tin nhắc**; các nguồn FreshBooks/Xero đều tách riêng hiệu quả của thanh toán online.
- Cảnh báo phạm vi: hầu hết số liệu là B2B hoặc freelancer; học phí là quan hệ phụ huynh–người dạy với yếu tố tình cảm/niềm tin khác hẳn.

### Inferences
- [Suy luận] Bằng chứng ủng hộ **hướng** (nhắc đúng lúc + thanh toán dễ → thu nhanh hơn, ít vắng hơn) nhưng **không đủ để hứa con số**. Với KiN đã có QR VietQR + SePay đối soát tự động, phần "thanh toán dễ" đã có; nhắc Zalo là phần cộng thêm, tác động riêng của nó cần đo.
- [Suy luận] Giá trị chắc chắn nhất của nhắc nợ tự động với gia sư VN có lẽ là **thay người đóng vai "người đòi"**: bài báo VN cho thấy giáo viên ngại nhắc và phụ huynh né; hệ thống nhắc theo lịch, có lịch sử nhắc, biến cuộc nhắc cá nhân thành thông báo chung. Chưa có dữ liệu VN kiểm chứng điều này.
- [Suy luận] Thiết kế thử nghiệm rẻ: với ~25 học sinh, bật nhắc cho một nửa lớp (hoặc luân phiên theo tháng) và đo số ngày từ ngày lập phiếu đến ngày đối soát; chỉ cần hai ba chu kỳ để có số ngày trung bình của chính KiN thay cho số liệu hãng. Mẫu nhỏ nên coi đây là chỉ báo, không phải kết luận thống kê.
- [Suy luận] Không đưa số của hãng ("nhanh gấp 2 đến 3 lần") vào trang bán hàng; nếu cần dẫn số liệu thì dùng dữ liệu của chính KiN.

### Gaps
- Không tìm được nghiên cứu phản biện hay báo cáo gốc của Stripe/QuickBooks/FreshBooks/Xero đo riêng tác động của nhắc nợ tự động lên ngày thu tiền.
- Không xác định được trang nguồn của nhiều con số (80,8% so với 54,7%; DSO 3 đến 7 ngày; 15 đến 20 ngày); phải mở lại các trang ứng viên để xác nhận.
- Không có nghiên cứu thu hồi công nợ nhỏ cho học phí ở VN.

---

## 3. Trung tâm nhỏ (5 đến 200 học sinh) ở Việt Nam: quy mô, công cụ, giá, nỗi đau, tính năng khiến họ trả tiền, rào cản chuyển đổi

### Takeaway
Tôi **không tìm được giá công khai** của bất kỳ phần mềm quản lý trung tâm VN nào (EasyEdu, EduBox, iSchool, Mona… đều báo giá khi liên hệ hoặc app miễn phí), cũng không có dữ liệu quy mô trung tâm điển hình. Có hai lực đẩy rõ về pháp lý/thuế (Thông tư 29/2024 buộc đăng ký kinh doanh và công khai mức thu; thuế khoán bị bỏ từ 01/01/2026) và một cạnh tranh đáng lo (app miễn phí, phần mềm quản lý dạy thêm của Sở GD&ĐT TP.HCM, phần mềm kế toán dùng chung miễn phí theo chủ trương của Nhà nước).

### Cited Findings

**A. Quy mô thị trường và khung pháp lý**
- TP.HCM có khoảng 10.000 trung tâm dạy thêm (bài không rõ thời điểm thống kê). [Đã kiểm nguồn*; năm không rõ] — [Đại biểu Nhân dân](https://daibieunhandan.vn/tp-ho-chi-minh-khong-de-giao-vien-day-them-cho-hoc-sinh-chinh-khoa-cua-minh-10382702.html)
- Thông tư 29/2024/TT-BGDĐT (ban hành 30/12/2024, hiệu lực 14/02/2025, thay Thông tư 17/2012) áp dụng cho giáo dục phổ thông và thường xuyên; tổ chức/cá nhân dạy thêm ngoài nhà trường phải đăng ký kinh doanh; giáo viên đang dạy ở trường dạy thêm ngoài trường phải báo cáo Hiệu trưởng (trước đây là xin phép); cơ sở phải công khai môn học, thời lượng và mức thu. [Đã kiểm nguồn*] — [Thư viện Pháp luật](https://thuvienphapluat.vn/viec-lam/giao-duc/chinh-thuc-thong-tu-29-2024-tt-bgddt-co-hieu-luc-tu-ngay-14-02-2025-9374.html), [Nông nghiệp & Môi trường](https://nongnghiepmoitruong.vn/thong-tu-29-co-hieu-luc-tu-hom-nay-siet-chat-day-them-hoc-them-d421036.html)
- Tổ chức dạy thêm có thu tiền phải đăng ký kinh doanh và công khai mức thu trước khi tuyển sinh. [Đã kiểm nguồn*] — [Thư viện Pháp luật](https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/gia-su-day-them-tai-nha-co-phai-dang-ky-kinh-doanh-khong-526802-201439.html)
- Sở GD&ĐT TP.HCM đã triển khai phần mềm quản lý hoạt động dạy thêm, học thêm (cổng dtht.hcm.edu.vn) quản lý thông tin cơ sở, giáo viên, học sinh, lớp, học phí. [Đã kiểm nguồn*; chưa rõ cơ sở nào bắt buộc nhập, cập nhật lần nào] — [LSVN](https://lsvn.vn/tp-ho-chi-minh-trien-khai-phan-mem-quan-ly-hoat-dong-day-them-hoc-them-a156592.html)
- Thuế: từ 01/01/2026 bỏ thuế khoán với hộ kinh doanh, chuyển sang kê khai; doanh thu từ 1 tỷ đồng/năm trở lên phải dùng hoá đơn điện tử; hộ trên ngưỡng nhỏ nhất áp chế độ kế toán theo Thông tư 88/2021/TT-BTC; Nhà nước sẽ bố trí cung cấp miễn phí nền tảng số và phần mềm kế toán dùng chung. Các nguồn **mâu thuẫn về ngưỡng miễn thuế** (dưới 500 triệu/năm so với dưới 200 triệu/năm). [Đã kiểm nguồn*; nguồn là bài của đơn vị tư vấn/phần mềm kế toán, không nói riêng về dạy học] — [VOH](https://voh.com.vn/kinh-te/tu-112026-chinh-thuc-bo-thue-khoan-chuyen-sang-ke-khai-thue-642709.html), [MISA SME](https://sme.misa.vn/342561/thue-khoan-ho-kinh-doanh/), [The Leader](https://theleader.vn/hoi-dap-bo-thue-khoan-tu-2026-ho-kinh-doanh-co-can-thue-ke-toan-d43260.html)

**B. Công cụ trung tâm VN đang dùng/được rao, và giá**
- EasyEdu (EMSO Việt Nam): trên App Store ghi là "phần mềm quản lý trung tâm giáo dục, trung tâm ngoại ngữ phổ biến nhất Việt Nam", app miễn phí tải, có app cho phụ huynh theo dõi; hãng tự nói tiết kiệm tới 90% thời gian làm việc và 50% chi phí nhân sự. Giá dịch vụ hàng tháng **không công bố**. [Đã kiểm nguồn*; "phổ biến nhất" và các % là lời quảng cáo] — [App Store: Easy Edu V2](https://apps.apple.com/vn/app/easy-edu-v2/id6504491690), [FPT Shop](https://fptshop.com.vn/tin-tuc/giai-tri/phan-mem-easy-edu-192476)
- Bài trên Mytour mô tả EasyEdu có tự động hoá tới 80%, gồm tài chính, lịch học, marketing, sales, lương, báo cáo thống kê bán hàng, chăm sóc khách hàng; ghi "chính sách giá cực ưu đãi" nhưng không nêu con số. [Số liệu hãng/bài giới thiệu] — [Mytour (EN)](https://mytour.vn/en/blog/bai-viet/discover-the-distinction-with-easyedu-language-center-management-software.html), [Mytour (VI)](https://mytour.vn/vi/blog/bai-viet/danh-sach-ung-dung-quan-ly-trung-tam-tieng-anh-hang-dau.html)
- MISA có báo giá phần mềm giáo dục theo gói (MISA EMIS Ôn tập: gói cơ bản 3.000.000 đ, nâng cao 4.000.000 đ, có phí duy trì hằng năm); đây là sản phẩm cho nhà trường, không phải trung tâm, nên chỉ làm mốc về cách định giá phần mềm giáo dục ở VN (thu theo gói + phí duy trì năm). [Đã kiểm nguồn*; liên quan gián tiếp] — [MISA báo giá EMIS](https://sisap.misa.vn/sisap/documents/EMIS21-OL-BG-VI-2.0-Bao%20gia%20phan%20mem%20MISA%20EMIS%20%C3%94n%20t%E1%BA%ADp-2511.pdf?ver=1)
- Acexis trong kết quả là công ty công nghệ/đơn vị khác, **không phải** phần mềm quản lý trung tâm; EduSoft trả về công ty nước ngoài trùng tên. Không tìm được bảng giá EduBox, iSchool, Mona CMS, CLASSIN, Ucan. [Đã kiểm nguồn* ở mức "không tìm thấy"] — [ITviec: Acexis](https://itviec.com/companies/acexis-innos)
- Một app thu học phí khác (Halozend) chỉ thấy mô tả chức năng (thu học phí, quản lý học sinh/giáo viên/công nợ), không có giá. [Đã kiểm nguồn*] — [SoundCloud Halozend](https://m.soundcloud.com/phanmemthuhocphi)

**C. Nỗi đau trung tâm được báo chí ghi nhận**
- Trung tâm đóng cửa đột ngột/không đủ buổi, phụ huynh đòi hoàn học phí (Apax Lào Cai, Đà Nẵng): xem số liệu ở mục 1E. [Đã kiểm nguồn*] — [PLO](https://plo.vn/phu-huynh-den-trung-tam-tieng-anh-doi-lai-tien-hoc-phi-post704002.html), [Báo Lào Cai](https://baolaocai.vn/trung-tam-apax-english-lao-cai-am-tham-dong-cua-phu-huynh-nhao-nhac-doi-hoc-phi-post362393.html)
- Một số trung tâm yêu cầu phụ huynh đóng học phí vào **tài khoản cá nhân của giáo viên**, và báo lao động nói về "chỉ thu tiền mặt trong giao dịch" dạy thêm sai quy định. [Đã kiểm nguồn*] — [Lao Động](https://news.laodong.vn/giao-duc/day-them-sai-quy-dinh-chi-thu-tien-mat-trong-giao-dich-1727770.ldo)
- Nhu cầu quản lý lương giáo viên/chia doanh thu, lịch phòng, tồn kho học liệu, tuyển sinh: không tìm thấy nguồn VN cụ thể. (xem Gaps)

**D. Tính năng khiến trung tâm chịu trả tiền (suy từ nguồn quốc tế vì thiếu nguồn VN)**
- Phần mềm hẹn lịch chung (Acuity) bị trung tâm gia sư bỏ vì không có **lương gia sư, ghi lại buổi dạy, điểm danh, báo cáo tiến bộ cho phụ huynh**. [Số liệu hãng (hướng dẫn chuyển đổi do Wise bán)] — [Wise: Acuity migration](https://www.wise.live/blog/?p=5982)
- Một bài của Wise có tiêu đề "Vì sao phần mềm lịch cơ bản làm khó trung tâm gia sư lớn". [Đã kiểm nguồn* ở mức tiêu đề] — [Wise](https://www.wise.live/blog/?p=5643)
- Teachworks: lương giáo viên tính theo giờ hoặc theo loại dịch vụ của buổi, có "bậc lương" theo kinh nghiệm/chứng chỉ, xuất giờ dạy cho phần mềm lương ngoài; phân quyền theo loại nhân viên (xem hay không xem chi phí buổi, liên hệ học sinh/phụ huynh, buổi của giáo viên khác); chỉ tài khoản quản trị gốc được đổi gói và thêm nhân viên. [Đã kiểm nguồn*; tài liệu của hãng] — [Teachworks Help: Wage tiers](https://intercom.help/teachworks-e2d272c6e669/en/articles/14689593-wage-tiers), [Employee types](https://intercom.help/teachworks-e2d272c6e669/en/articles/11472428-employee-types), [Blog: Manage Employee Wages](https://blog.teachworks.com/2018/02/manage-employee-wages-teachworks/)

**E. Bằng chứng ngược chiều: trung tâm nhỏ ít khi đổi/ít khi trả tiền**
- App EasyEdu miễn phí tải và "Quản Lý & Điểm Danh" miễn phí đã chiếm các nhu cầu cơ bản (lớp, điểm danh, học phí cho phụ huynh xem). [Đã kiểm nguồn*] — [App Store](https://apps.apple.com/vn/app/easy-edu-v2/id6504491690), [App Store](https://apps.apple.com/app/id6448912318)
- Nhà nước nêu sẽ cung cấp miễn phí phần mềm kế toán dùng chung cho hộ kinh doanh, có thể làm yếu lý do mua phần mềm chỉ để làm sổ. [Đã kiểm nguồn*; chưa rõ tiến độ] — [VOH](https://voh.com.vn/kinh-te/tu-112026-chinh-thuc-bo-thue-khoan-chuyen-sang-ke-khai-thue-642709.html)

### Inferences
- [Suy luận] Trung tâm VN vừa chịu áp lực **tuân thủ** (đăng ký, công khai mức thu, hóa đơn/ sổ doanh thu từ 2026, nhập dữ liệu lên cổng của Sở ở TP.HCM) vừa chịu **thất tín** từ vụ trung tâm đóng cửa giữ tiền. Hai lực này cho KiN hai ý bán: "báo cáo thu tháng gọn để làm sổ/nộp thuế" và "phụ huynh luôn thấy số buổi còn lại trong tháng". Cả hai chưa được kiểm bằng phỏng vấn trung tâm.
- [Suy luận] Nhiều khả năng phần mềm trung tâm ở VN **không niêm yết giá** (trong các kết quả tôi thấy, không sản phẩm nào có bảng giá): KiN không bị neo vào một mức giá thấp, nhưng cũng không có tín hiệu "thị trường trả bao nhiêu". Cách thu thông tin nhanh nhất là gọi 3 đến 5 trung tâm đang dùng EasyEdu/phần mềm khác để hỏi báo giá thật dưới tư cách khách hàng, hoặc xin 5 trung tâm trò chuyện 20 phút.
- [Suy luận] Mốc giá quốc tế (mục 4) quy đổi ra VND là mốc trần, không phải giá VN; chưa có dữ liệu sức mua của trung tâm nhỏ VN.
- [Suy luận] Rào cản lớn nhất để KiN lấy trung tâm: trung tâm cần lương/chia doanh thu giáo viên và tuyển sinh/CRM, là phạm vi lớn hơn "sổ lớp"; EasyEdu nhắm đúng phạm vi đó. KiN thắng nhờ gọn, mở được trong một buổi, thân thiện Zalo/VietQR, không nhờ phủ đủ tính năng.

### Gaps
- Không có số liệu quy mô trung tâm nhỏ điển hình (số học viên, số giáo viên, doanh thu/trung tâm) ở VN; con số duy nhất là ~10.000 trung tâm ở TP.HCM, không rõ năm.
- Không có giá thật (theo tháng/theo học viên) của EasyEdu, EduBox, iSchool, Mona, CLASSIN, Ucan, Acexis; Acexis không phải sản phẩm này. Không tìm được trang có mức giá của MISA cho trung tâm.
- Không có nguồn VN về nỗi đau lương giáo viên/chia doanh thu, lịch phòng, tồn kho học liệu, tuyển sinh của trung tâm nhỏ.
- Chưa xác nhận trung tâm nào bị bắt buộc nhập dữ liệu vào cổng dtht.hcm.edu.vn, tần suất và mẫu dữ liệu.
- Một nguồn nhắc Nghị định 68/2026/NĐ-CP và Thông tư 18/2026/TT-BTC về khai thuế/hoá đơn hộ kinh doanh; tôi chưa kiểm nội dung văn bản gốc.
- Ngưỡng miễn thuế (200 triệu so với 500 triệu) mâu thuẫn giữa các nguồn; cần đối chiếu văn bản gốc trước khi dùng trong tiếp thị.

---

## 4. Gói "Nhóm/Trung tâm" trên SaaS quốc tế, tính năng bị khoá, và chi phí/độ khó thêm đồng dạy cho KiN (có nên đưa vào lộ trình)

### Takeaway
SaaS quốc tế **không khoá vai trò/lương giáo viên sau gói đắt**: đó là tính năng nền, và giá tăng theo số giáo viên (TutorBird +$4,95/giáo viên), số buổi (Teachworks), số học viên (Jackrabbit) hay phiên bản (TutorCruncher). Thứ bị khoá ở gói cao là **nhiều chi nhánh, tên miền/thương hiệu riêng, app có thương hiệu, bảng điều khiển BI, API, hỗ trợ ưu tiên**. Trong kho KiN, thêm đồng dạy ước tính 1,5 đến 2,5 tuần dev ở bản mỏng (xem Suy luận) và mở khoá "nhóm" chỉ nên làm khi có tín hiệu cầu (D02 đã đặt ngưỡng ≥3 giáo viên trung tâm dùng thật); hiện chưa có.

### Cited Findings

**A. Bảng giá quốc tế (quy đổi VND ở 26.000 đ/USD là của tôi)**
- **TutorBird**: một gói $16,95/tháng gồm học viên không giới hạn, **cộng $4,95 cho mỗi gia sư/nhân viên thêm**; mẫu ước tính: 2 gia sư $21,90, 5 gia sư $36,75, 10 gia sư $61,50; dùng thử 30 ngày không cần thẻ; huỷ bất cứ lúc nào, hoàn tiền trong 90 ngày. Một bản cache cũ ghi $14,95. Các trang tổng hợp lệch ($13 trên SoftwareSuggest) nên coi là kém tin. [Đã kiểm nguồn*] — [TutorBird pricing](https://tutorbird.com/pricing), [Teach n Go: TutorBird pricing](https://www.teachngo.com/blog/tutorbird-pricing)
- **Teachworks**: ba bậc theo dùng, **không giới hạn học viên/giáo viên/tài khoản**: Starter $16,49/tháng + $0,29/buổi-học-viên; Growth $47,99 + $0,172; Premium $187,99 + $0,059 và gồm 5 tài khoản chi nhánh đầu, thêm chi nhánh $35/tháng; API từ Growth trở lên. Một số trang bên thứ ba ghi số khác ($0,25 và $0,05; base $15), tức nguồn **mâu thuẫn**; hãng có bài giải thích mô hình "trả theo mức dùng" (11/2023). [Đã kiểm nguồn*; chọn số trang chính thức] — [Teachworks pricing](https://teachworks.com/pricing), [Teachworks blog (2023)](https://blog.teachworks.com/2023/11/teachworks-pricing-explained-pay-for-what-you-use/), [Teach n Go: Teachworks pricing](https://www.teachngo.com/blog/teachworks-pricing)
- **TutorCruncher**: Pay-as-you-go $30/tháng (người dùng không giới hạn), Startup từ $80/tháng, Enterprise từ $240/tháng theo trang giá chính thức Mỹ, nhưng Capterra ghi Enterprise $750/tháng (**mâu thuẫn**). Phí giao dịch cũng lệch giữa các nguồn (3,85%/3,5% so với 1%/0,65%). Trang tính năng quảng bá thương hiệu riêng + tên miền riêng nhưng không nói gói nào; Capterra gắn tên miền riêng với Enterprise cùng quản lý tài khoản riêng, hỗ trợ điện thoại, nhiều chi nhánh. Payroll và thanh toán tự động có ở cả ba gói. Startup thêm bảng điều khiển cấu hình được, mẫu email HTML, xuất dữ liệu/báo cáo. [Đã kiểm nguồn*] — [TutorCruncher pricing](https://tutorcruncher.com/pricing/), [TutorCruncher features](https://tutorcruncher.com/features), [Capterra](https://www.capterra.com/p/145838/TutorCruncher/pricing/), [Teach n Go: TutorCruncher pricing](https://www.teachngo.com/blog/tutorcruncher-pricing)
- **Jackrabbit Class** (lớp ngoại khoá/trung tâm, không riêng gia sư): từ $49/tháng, bậc theo **tổng số học viên cuối tháng** và đếm cả học viên "không hoạt động" (trừ hồ sơ lưu ở Lead File). Bảng bậc (qua đối thủ Black Belt CRM, chưa kiểm trên trang Jackrabbit): 0 đến 100 học viên $49; 101 đến 250 $89; 251 đến 500 $129; 501 đến 1.000 $169; 1.001 đến 3.000 $209; trên 3.000 $245. Plus (app có thương hiệu) từ $89/tháng + phí thiết lập $169 một lần (nguồn khác ghi $93 — mâu thuẫn); Enterprise $245/tháng gồm BI Dashboard; PayPath $0/tháng nhưng chuyển phí công nghệ 1,25% sang phụ huynh. [Đã kiểm nguồn* cho mức khởi điểm và cách tính; bảng bậc là thứ cấp] — [Jackrabbit pricing](https://www.jackrabbitclass.com/pricing), [Black Belt CRM](https://blackbeltcrm.com/alternatives/jackrabbit-class/), [Recess](https://www.recess.tv/jackrabbit-vs-recess)

**B. Tính năng bị khoá hoặc là nền (tổng hợp từ A)**
- Nền, không khoá: nhiều giáo viên, lương theo giờ/loại dịch vụ, phân quyền theo vai trò (Teachworks; TutorBird tính theo ghế; TutorCruncher có payroll ở mọi gói). [Đã kiểm nguồn*]
- Khoá ở gói cao: nhiều chi nhánh (Teachworks Premium; TutorCruncher Enterprise theo Capterra), tên miền riêng (TutorCruncher Enterprise theo Capterra, mâu thuẫn với trang tính năng), app có thương hiệu (Jackrabbit Plus), BI dashboard (Jackrabbit Enterprise), API (Teachworks Growth trở lên). [Đã kiểm nguồn*]

**C. Kho code và quyết định D02 của KiN (dữ kiện đo được trong repo)**
- D02 chốt "một gia sư một lớp, hoãn đồng dạy"; lý do ghi trong `docs/kin/backlog/quyet-dinh.csv`: phân quyền hiện xoay quanh một `ownerId`; cho đồng dạy là mọi lệnh kiểm tra quyền thành phép join, sửa hàng chục chỗ, mỗi chỗ một cơ hội lọt quyền; "Khảo sát: 79% gia sư dạy 1–3 học sinh một mình"; điều kiện đổi ý: "khi có trung tâm từ 3 giáo viên dùng thật". Quyết định này liên quan 24 việc trong backlog.
- `docs/kin/quyet-dinh-va-doi-chieu.md` (dòng 25): "Cho đồng dạy sau chỉ cần thêm bảng nối. Bỏ đồng dạy sau thì phải gỡ dữ liệu đã lỡ tạo." Tức hướng thêm sau là rẻ hơn hướng bỏ sau.
- Đo trong `src` (loại bỏ thư mục sinh tự động `src/generated`): 99 file `.ts/.tsx` chứa `ownsResource|ownerId|adminId` (307 dòng); trong đó 43 file gọi `ownsResource`. Trong `prisma/schema.prisma` có 71 model; trường `ownerId` xuất hiện trên ít nhất 6 model (trong đó có Course và một model bài tập). Con số 99/307 là **cận trên** vì `adminId` có thể là id hiển thị chứ không phải chủ sở hữu.
- Tài liệu `docs/kin/ke-hoach-phat-trien-tu-research.md` (dòng 55, 276) ghi "Trợ giảng / đồng dạy: hoãn có chủ đích (D02)".

### Inferences

**Mốc giá quy đổi** (26.000 đ/USD; chỉ để nhìn bậc độ lớn)
- TutorBird: $16,95 ≈ 441.000 đ; mỗi gia sư thêm $4,95 ≈ 129.000 đ; 5 gia sư $36,75 ≈ 955.000 đ; 10 gia sư $61,50 ≈ 1,6 triệu đ.
- Teachworks Starter: $16,49 + $0,29/buổi. Gia sư 10 học sinh × 8 buổi = 80 buổi-học-viên/tháng: $16,49 + 80 × $0,29 = $39,69 ≈ 1,03 triệu đ. Trung tâm 60 học sinh × 8 = 480 buổi: Starter ≈ $155,69; Growth ($47,99 + 480 × $0,172) ≈ $130,55 ≈ 3,4 triệu đ; Premium ≈ $216,31.
- TutorCruncher: $30 ≈ 780.000 đ; $80 ≈ 2,08 triệu đ.
- Jackrabbit 100 học viên: $49 ≈ 1,27 triệu đ, tức ≈ 12.700 đ/học viên/tháng.
- Sàn quốc tế cho gói gia sư đơn lẻ vào khoảng $17 đến $30 (≈ 440.000 đến 780.000 đ), gấp khoảng 3 đến 5 lần mức 99.000 đến 199.000 đ mà tôi dùng làm giả định Pro VN. [Suy luận] Khoảng cách đó là dư địa trên giấy, nhưng sức mua gia sư sinh viên VN thấp hơn nhiều; chưa có dữ liệu khả năng trả tiền.

**Giả thuyết giá "Nhóm" (cần kiểm bằng phỏng vấn, không phải kết luận)**
- Mô hình theo ghế giống TutorBird là hợp với KiN: Pro cá nhân P đ/tháng + mỗi giáo viên thêm G đ/tháng. Thử P ≈ 149.000 và G ≈ 79.000 đến 99.000 (bằng khoảng 60% đến 75% mức $4,95 quy đổi). Trung tâm 5 giáo viên ≈ 149.000 + 4 × 89.000 ≈ 505.000 đ/tháng, bằng khoảng một nửa TutorBird (≈ 955.000 đ). Mọi số trên là giả định để thử, không có dữ liệu VN.
- Thang theo học sinh (như Jackrabbit) khó hợp vì học sinh nhỏ lẻ biến động theo tháng; thang theo ghế dễ giải thích hơn cho phụ huynh/chủ trung tâm.

**Chi phí đồng dạy (ước tính, chưa có ai kiểm)**
- Cách tính: 43 file gọi `ownsResource` × 0,5 đến 1 giờ (sửa kiểm quyền thành "thành viên của lớp + quyền" và thêm test từ chối) ≈ 20 đến 45 giờ; cộng bảng nối `CourseTeacher` (vai trò chủ/trợ giảng), migration, UI mời giáo viên, cấu hình quyền: khoảng 40 đến 60 giờ. Tổng ≈ **60 đến 105 giờ ≈ 1,5 đến 2,5 tuần** của một dev quen code (40 giờ/tuần). Phần rủi ro không nằm ở độ khó mà ở **lọt quyền** (đúng lý do D02 nêu), nên thời gian review/test nên cộng thêm.
- Bản "Trung tâm" đầy đủ (lương/chia doanh thu giáo viên, báo cáo tổng hợp theo giáo viên, tên miền hoặc thương hiệu riêng, cổng phụ huynh có thương hiệu) vượt xa phép tính trên; ước thô thêm 4 đến 8 tuần, và tên miền/thương hiệu riêng là khối công việc hạ tầng (SSL, định tuyến theo tên miền) khác hẳn đồng dạy.
- Hướng "thêm bảng nối sau" mà D02 chọn là đúng: đồng dạy có thể thêm sau mà không phải gỡ dữ liệu. Chi phí chờ gần như chỉ là cơ hội bán gói Nhóm sớm.

**Có nên đặt "Nhóm" vào lộ trình?** [Suy luận]
- Chưa. Lý do: (1) KiN chưa thu phí và chưa chứng minh Pro cá nhân; (2) ~25 học sinh thật, chưa có trung tâm ≥3 giáo viên dùng thật (điều kiện đổi ý của D02); (3) không có dữ liệu VN về giá/quy mô trung tâm; (4) đối thủ nhắm trung tâm đã có app miễn phí và hệ thống của Sở; (5) đồng dạy chạm vào phân quyền mà D02 đã gọi là nơi dễ sinh lỗi bảo mật.
- Nên làm trước, rẻ: ghi "Nhóm" như một mục thăm dò (nút "báo tôi khi có" + 2 câu hỏi quy mô/số giáo viên) và phỏng vấn 5 trung tâm; làm hoàn thiện báo cáo xuất cho người quản lý. Chỉ khởi động đồng dạy mỏng (chủ + trợ giảng chỉ điểm danh) khi có ≥3 trung tâm tự nguyện trả thử hoặc đạt ngưỡng D02.
- Theo mô hình quốc tế, đưa đồng dạy vào gói **cá nhân/Nhóm theo ghế** (không khoá sau gói đắt), còn tên miền/thương hiệu riêng và đa chi nhánh dành cho bậc cao nhất, nếu có.

### Gaps
- Chưa mở được trang giá chính thức nào để xác nhận (WebFetch lỗi DNS); nhiều con số lệch giữa nguồn (Teachworks, TutorCruncher Enterprise $240 so với $750, phí giao dịch, Jackrabbit Plus $89 so với $93) nên cần người viết báo cáo coi đây là khoảng, không phải giá chắc.
- Chưa xác định gói nào của TutorCruncher mở khoá tên miền riêng/thương hiệu riêng (trang tính năng và Capterra khác nhau).
- Không tìm được phần "cổng phụ huynh có thương hiệu" và "chia doanh thu giáo viên" nằm ở gói nào của Teachworks.
- Ước tính 60 đến 105 giờ là của tôi, chưa có số đo thực; cần dev của dự án rà soát 43 file `ownsResource` trước khi dùng làm kế hoạch.

---

## 5. Chi phí/kết quả khi trung tâm nhỏ chuyển công cụ: vì sao bỏ, vì sao giữ, churn

### Takeaway
**Không tìm được số liệu churn thật** cho phần mềm quản lý gia sư/trung tâm (VN hay quốc tế). Chỉ có các bài hướng dẫn chuyển đổi do hãng viết, nêu hai nhóm lý do chung: bỏ vì thiếu tính năng đặc thù gia sư (lương, điểm danh, báo cáo phụ huynh) hoặc quá phức tạp/đắt; giữ vì sợ mất dữ liệu và phải dựng lại hồ sơ gia đình.

### Cited Findings
- Lý do bỏ (theo hướng dẫn chuyển đổi Acuity của Wise): không có tính lương gia sư theo buổi đã dạy, ghi lại buổi học, điểm danh, báo cáo tiến bộ cho phụ huynh. [Số liệu hãng; bên viết bán sản phẩm thay thế] — [Wise: Acuity migration](https://www.wise.live/blog/?p=5982)
- Lý do bỏ khác: nền tảng hiện tại phức tạp, khó dùng, hoặc chi phí công nghệ quá cao; hoặc chức năng hạn chế/không đáp ứng nhu cầu đặc thù/hỗ trợ kém. [Số liệu hãng/bài tư vấn] — [Fatbit](https://www.fatbit.com/fab/migrate-your-tutoring-website-to-another-technology/), [accessplanit](https://www.accessplanit.com/switching-software-suppliers-ebook)
- Lý do giữ: lo mất dữ liệu cuộc hẹn/học viên (Wise, Testpress); "cái chưa biết cảm giác rủi ro hơn vấn đề đang có" và hồ sơ gia đình (mỗi con một hồ sơ riêng, phải dựng lại quan hệ phụ huynh–học sinh) là chỗ chuyển đổi hay khó (Opus1, viết cho trường học). [Số liệu hãng/bài tư vấn; không phải khảo sát] — [Opus1](https://opus1.io/?p=2144), [Testpress](https://blog.testpress.in/how-to-switch-lms-classplus-appx/), [Wise: Acuity migration](https://www.wise.live/blog/?p=5982)
- Thiết kế giảm khoá chặt của TutorBird: không hợp đồng, huỷ/hạ gói bất cứ lúc nào, hoàn tiền trong 90 ngày. Jackrabbit thì tính cả học viên không hoạt động vào bậc giá (làm chi phí đi lên dù lớp thu nhỏ). [Đã kiểm nguồn*] — [TutorBird pricing](https://tutorbird.com/pricing), [Jackrabbit pricing](https://www.jackrabbitclass.com/pricing)
- Bằng chứng ngược chiều "trung tâm nhỏ không đổi phần mềm": các nguồn trên đều thừa nhận nỗi sợ mất dữ liệu làm chủ doanh nghiệp trì hoãn; một nguồn nói thẳng tutoring business "trì hoãn chuyển vì lo mất dữ liệu lịch hẹn". [Số liệu hãng] — [Wise: Acuity migration](https://www.wise.live/blog/?p=5982)
- Một số liệu của TutorCruncher: AJ Education báo giảm 60% thời gian hành chính sau khi chuyển phần mềm; blog "manual to software" của hãng cổ vũ chuyển từ làm tay sang phần mềm. [Số liệu hãng] — [TutorCruncher blog](https://tutorcruncher.com/blog/manual-to-software-based-tutoring-management), [AJ Education case](https://tutorcruncher.com/blog/tutor-management-software-ajeducation-case-study)
- VN: không tìm được bài hay khảo sát về chuyển đổi/bỏ phần mềm quản lý trung tâm.

### Inferences
- [Suy luận] Điểm vào dễ nhất là trung tâm **đang dùng sổ giấy/Zalo/Excel** chứ không phải trung tâm đã dùng EasyEdu: không có chi phí chuyển, chỉ có chi phí thói quen. KiN nên nhắm "người dùng Excel/Zalo", không nhắm "người dùng phần mềm đối thủ".
- [Suy luận] Rào cản nhập liệu (học viên, phụ huynh, buổi đã học, số dư buổi) là rào cản chính. KiN đã có "mời hàng loạt" và xuất CSV/Excel; thêm **nhập hàng loạt từ Excel/CSV** và **xuất toàn bộ dữ liệu** là hai lời hứa giảm sợ mất dữ liệu tốt nhất, rẻ hơn việc xây tính năng mới. Đây là suy luận từ các lý do giữ ở trên, chưa có bằng chứng VN.
- [Suy luận] Thiết kế giá không khoá chặt (huỷ bất cứ lúc nào, hoàn tiền sớm, xuất dữ liệu) giống TutorBird đáng thử vì nó ăn đúng nỗi sợ nêu ở trên, đồng thời tránh gây cảm giác "bẫy" khi KiN còn mới.
- [Suy luận] Chưa có số churn nên không nên đặt kế hoạch doanh thu theo giả định giữ chân; cần đo churn tháng của chính KiN ngay từ khi thu phí thử.

### Gaps
- Không có tỉ lệ churn/lý do bỏ phần mềm đo bằng khảo sát cho gia sư/trung tâm nhỏ (VN hay quốc tế).
- Không có chi phí chuyển công cụ định lượng (giờ nhập liệu, phí di trú, thời gian ngừng việc) cho trung tâm nhỏ.
- Mọi lý do ở trên đến từ bài do hãng/tư vấn viết để bán dịch vụ chuyển đổi; thiên lệch về phía "nên chuyển". Chưa có tiếng nói của người đã dùng lâu và ở lại (G2/Capterra chưa được mở đọc).
- Chưa đọc được bình luận Reddit (r/tutoring, r/Teachers) hay G2/Capterra: truy vấn Reddit không trả bài Reddit nào; WebFetch lỗi nên không mở được trang đánh giá.
