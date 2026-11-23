# SCL5 · Nghiên cứu cho màn học sinh BCA Midnight Class

Ngày: 22–23/11/2026. Đầu vào: D12, D5–D7, D10 trong `docs/kin/rd/HOC-THU-VA-DANG-KY.md`; hiện trạng `scl/ban-chot.html`, `scl/QUYET-DINH-GIAO-DIEN.md`, `COMPONENTS.md`, `src/app/kin-tokens.css`, `LopCuaToi.tsx`, `CanLam.tsx`. Dữ liệu mẫu lấy từ tệp Apps Script v8.12 của chủ: lịch môn (`MON_DEF`), giờ 22:15, 90 phút, 14 ngày học thử, cột "Đồng ý vinh danh", và lộ trình Toán 12 (`LO_TRINH_MAC_DINH`).

Mức tin cậy: **[A]** nghiên cứu có bình duyệt hoặc tài liệu chính thức · **[B]** bài của chính nền tảng hoặc phân tích có phương pháp · **[C]** blog, bài tổng hợp, quảng cáo.

## 1. Các bên học trực tuyến

| Bên | Điều quan sát được | Lấy gì cho BCA | Nguồn |
|---|---|---|---|
| Google Classroom | Mỗi lớp có ảnh bìa hoặc màu chủ đề (bảng 8 màu cố định); chọn ảnh thì tự có màu đi kèm. Bài tập gom theo **chủ đề** (topic) trên trang Classwork. | Thẻ lớp có bìa + màu môn cố định (D11: 4 môn). Chương = topic. | [A] [support.google.com/edu/classroom/answer/6020273](https://support.google.com/edu/classroom/answer/6020273) · [C] [alicekeeler.com](https://alicekeeler.com/2022/04/03/wow-google-classroom-custom-colors/) |
| Khan Academy | Bỏ % thành thạo cả khoá, chuyển sang **tiến độ theo từng unit**; thẻ "unit mission" ghi kiểu "3 of 22 skills". Bốn mức kỹ năng có icon riêng. | Tiến độ hiện theo **chương đang học** ("4/10 bài chương 1") thay vì chỉ % cả lớp: mục tiêu gần. Trạng thái có hình riêng. | [A] [support.khanacademy.org …48487691680653](https://support.khanacademy.org/hc/en-us/articles/48487691680653-Update-See-your-course-progress-at-a-glance-in-Khan-Academy-Reimagined) · [support.khanacademy.org …47216131257997](https://support.khanacademy.org/hc/en-us/articles/47216131257997-Why-don-t-I-see-Course-Mastery-in-the-reimagined-Khan-Academy-experience) |
| Duolingo | Chuỗi ngày dựa trên ngại mất (loss aversion); có **Streak Freeze** để nghỉ một ngày không mất chuỗi. | Chuỗi tính theo **buổi học 22:15**, không theo ngày (lớp 1–2 buổi/tuần/môn); **báo nghỉ trước giữ chuỗi**. Không có thông báo dọa mất chuỗi. | [B] [blog.duolingo.com](https://blog.duolingo.com/how-duolingo-streak-builds-habit) · [B] [mobbin.com, 859 thiết kế chuỗi](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs) · [C] [smashingmagazine.com 02/2026](https://smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/) |
| Coursera | Học thử có hạn; nhiều phàn nàn vì điều khoản thử không nói rõ (chứng chỉ, tiền). deceptive.design ghi nhận "Enroll for free" thành gói trả phí sau khi đăng nhập. | Băng học thử ghi **ngày giờ hết hạn cụ thể**, nói rõ trong hạn được gì, hết hạn mất gì, **giữ gì**. Không đổi nhãn sau đăng nhập. | [C] [coursera.org/courseraplus](https://www.coursera.org/courseraplus) · [B] [deceptive.design](https://deceptive.design/articles/coursera-shows-course-as-enroll-for-free-but-after-a-user-signs-in-it-becomes-a-39-month-premium-subscription) · [C] [trustpilot](https://ca.trustpilot.com/review/coursera.org?page=4) |
| OLM | Đường đi: chọn khối, môn, rồi bài đánh số thứ tự; mỗi bài có lý thuyết, video, bài tập. Có vinh danh/thưởng cho câu đố tuần. | Trang bài đủ khối theo đúng thứ tự học sinh VN đã quen (lý thuyết, video, bài tập). | [C] [fptshop.com.vn](https://fptshop.com.vn/tin-tuc/giai-tri/olm-vn-185416) · [C] [gearvn.com](https://gearvn.com/blogs/thu-thuat-giai-dap/huong-dan-su-dung-olm-vn) |
| Tuyensinh247 | Mỗi bài giảng có bài tập dạng thi online đi kèm; hỏi trong video; ghi chú trong bài, xem lại trong lịch sử học. | Bài tập nằm **ngay trong trang bài**, không tách màn khác; có lối "Hỏi bài" (ở BCA là nhóm Zalo môn). | [C] [apps.apple.com/app/id1574432354](https://apps.apple.com/app/id1574432354) |
| Hocmai | Kho bài giảng + phòng luyện đề mô phỏng HSA/TSA; khoá chia lộ trình. Không tìm được tài liệu giao diện chính thức. | Chỉ lấy ý "lộ trình theo giai đoạn" (BCA đã có: Back to 11 / Level up 12 / Final sprint). | [C] [huongnghiep.hocmai.vn](https://huongnghiep.hocmai.vn/hocmai-co-uy-tin-khong-review-chi-tiet-tu-trai-nghiem-hoc-sinh) |
| Vietjack | Khoá chia theo môn và bộ sách; mỗi bài có trắc nghiệm + video ngắn; trang danh mục ghi giá, lượt xem, số bài. Không tìm được mô tả màn bài học. | Ghi **số bài** trên thẻ lớp; không ghi lượt xem (không giúp học sinh). | [C] [vietjack.com/khoa-hoc](https://vietjack.com/khoa-hoc/khoa-hoc-online-lop-12.jsp) · [C] [khoahoc.vietjack.com](https://khoahoc.vietjack.com/khoa-hoc?group%5B%5D=nen_tang) |

Chưa kiểm chứng: giao diện thật bên trong Hocmai, Tuyensinh247, Vietjack (cần tài khoản); các con số tăng trưởng của Duolingo trong blog tổng hợp không truy được nguồn gốc nên **không dùng**.

## 2. Tâm lý học: nguyên tắc rút ra và chỗ áp dụng

| Nguyên tắc | Căn cứ | Áp vào thiết kế | Giới hạn tự đặt |
|---|---|---|---|
| **Hiệu ứng gần đích (goal-gradient)** và **tiến độ có sẵn (endowed progress)**: người ta tăng tốc khi thấy gần đích; thẻ 12 ô tặng sẵn 2 ô hoàn thành nhanh hơn thẻ 10 ô. | [A] Kivetz, Urminsky, Zheng (2006), *Journal of Marketing Research* 43:39–58 — [PDF Columbia](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf); [A] Nunes & Drèze (2006) — [PDF](https://msbfile03.usc.edu/digitalmeasures/jnunes/intellcont/Endowed%20Progress%20Effect-1.pdf) | Tiến độ ghi theo **chương** ("còn 6 bài là xong Chương 1"), không chỉ % cả khoá (16% trông xa). C chia một bài thành 4 bước và tính bước "Tải phiếu" đã xong. | **Không tặng tiến độ giả.** Chỉ đếm việc đã thật sự làm. |
| **Mục tiêu gần** (proximal goals) | Cùng nguồn trên + mô hình unit của Khan Academy | Màn đầu chỉ có một "việc tiếp theo"; B dùng dấu trang "dừng ở 41:05". | — |
| **Luật Hick**: thời gian quyết định tăng theo số lựa chọn | [C] [accessibility.education.gov.uk – Laws of UX](https://accessibility.education.gov.uk/profession-guidance/interaction-design/laws-of-ux) | Đúng một nút chính mỗi màn; chương chưa mở gập lại; thanh dưới 4 mục. A là phương án vi phạm nhiều nhất (4 con số + nhiều khối), đã ghi là rủi ro. | — |
| **Luật Fitts**: mục tiêu to và gần thì bấm nhanh | Cùng nguồn trên | Nút Nộp bài / Học tiếp cao 50px, rộng hết thẻ, nằm nửa dưới màn điện thoại; hàng bài 56px, vùng chạm ≥ 44px. | — |
| **Tải nhận thức** (Sweller) | [C] [blog.logrocket.com/ux-design/cognitive-overload](https://blog.logrocket.com/ux-design/cognitive-overload) | Trang bài chia khối có tiêu đề rõ; mục lục video bằng mốc thời gian; 23 giờ đêm nên ít màu, chữ phụ ≥ 14px `--kin-chu-phu`. | — |
| **Ngại mất** (loss aversion) dùng có kiểm soát | [B] Duolingo blog; [C] Smashing 2026 (cần cơ chế cứu chuỗi) | Chuỗi đêm học có "nghỉ có báo vẫn giữ chuỗi"; hết hạn học thử nói **những gì được giữ** (bài đã nộp, điểm) thay vì dọa mất. | Không thông báo đẩy "sắp mất chuỗi"; không đếm ngược theo giây; không màu đỏ cho hạn học thử (đỏ chỉ dành cho lỗi và quá hạn bài). |
| **Bảng xếp hạng có hại cho người hạng thấp** | [A] Nghiên cứu HKU: nhóm giữa và cuối bảng xếp hạng tuyệt đối thấy áp lực tăng, bảng tương đối thì mọi nhóm đều tích cực — [hub.hku.hk](https://hub.hku.hk/bitstream/10722/368255/1/content.pdf); [A] tổng quan tác động tiêu cực của gamification — [arXiv 2305.08346](https://arxiv.org/pdf/2305.08346) | **Không có bảng xếp hạng.** Vinh danh tuần = danh sách tên các em nộp đủ bài **và** đã tick "Đồng ý vinh danh" trên phiếu (cột có sẵn trong Sheet), xếp theo tên. Điểm chăm chỉ để em tự theo dõi. | Không hiện hạng, không so điểm giữa các em, không hiện tên em chưa đồng ý. |
| **Chống thao túng** (dark patterns) | [B] [deceptive.design](https://deceptive.design/articles/coursera-shows-course-as-enroll-for-free-but-after-a-user-signs-in-it-becomes-a-39-month-premium-subscription) | Học thử: hạn ghi bằng ngày giờ; trong hạn nút "Đăng ký chính thức" chỉ là nút **phụ**; hết hạn vẫn thấy tên bài, lịch, có Zalo người thật. | Không chặn màn hình bằng hộp thoại bán hàng, không "chỉ còn 2 suất", không ẩn nút đóng. |

## 3. Ràng buộc đã giữ

- Màu: khối token chép **nguyên** từ `kin-tokens.css` (nền, chữ, sáng/tối), mã hex chỉ có trong khối đó; mọi chỗ khác dùng `var(--kin-*)` hoặc `color-mix` trên token. Bộ sinh tự kiểm và dừng nếu thấy hex ngoài khối.
- Màu môn: Toán `--kin-th-navy`, Lịch sử `--kin-th-vang-doanh-nghiep`, Địa lí `--kin-th-bac-ha`, Tiếng Anh `--kin-th-xanh-troi`. Chỉ để trang trí, luôn đi kèm tên môn.
- Trạng thái hình + chữ theo QUYET-DINH §3.6; đỏ chỉ cho lỗi/quá hạn; chữ thông tin ≥ 14px.
- Logo KiN vẽ bằng path của `KinMark` trong `KinLogo.tsx`, màu qua token.
- Lớp học thử theo D5–D7, D10: một hạn chung cho mọi môn, băng nhắc khi còn 3 ngày, hết hạn khoá hẳn nội dung nhưng vẫn đăng nhập, thấy lớp mờ + Đăng ký chính thức + Zalo anh Thanh; tình huống 11 (giữ điểm/bài đã nộp) ghi rõ trên màn.

## 4. Chưa làm / cần hội đồng xem

- Chưa vẽ chế độ tối riêng (token đã có khối tối; chưa chụp kiểm).
- Chưa vẽ trạng thái rỗng, đang tải, lỗi mạng cho 4 màn mới.
- Phương án A dùng ảnh bìa cao ở trang lớp, trái với QUYET-DINH §2.4; nếu chọn A cần chủ quyết lại điểm này.
- Tiến độ theo chương giả định chương có số bài cố định khi lớp đang chạy; bài chưa đăng thì không đếm.
