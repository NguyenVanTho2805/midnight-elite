# Sổ việc của COO

Một dòng một việc. Trạng thái: `moi` · `dang-lam` · `cho-test` · `cho-ra-soat` · `cho-gop-pr` · `xong` · `dung` (lý do ở ghi chú).

| Mã | Phòng | Việc | Nhánh | PR | Trạng thái | Ghi chú |
|---|---|---|---|---|---|---|
| COO-000 | COO | Dựng phòng ban (16 tác tử, 4 tài liệu) + báo cáo điểm yếu 01/11 | claude/phong-ban-agent | #90 | cho-gop-pr | Nền cho mọi việc sau |
| BU-00 | TUT+STU+ADM | Tách 3 giao diện theo vai | claude/bu-00-phan-vai | #88 | cho-gop-pr | Làm trước khi có phòng ban; chờ Thọ gộp |
| BU-01 | TUT (+STU màn nhập mã) | Lớp: joinPolicy, mã cá nhân, duyệt, lớp miễn phí | claude/bu-01-lop | #103 | xong | Mở sau #88; đặc tả = BIGUPDATE-KE-HOACH.md mục BU-01 · PR mở 01/11 · gộp vào main qua #111 (03/11/2026) |
| BU-02 | TUT (ADM giữ 2 tệp lớn) | Học liệu: tab Giáo trình + ô tải lên chung | claude/bu-02-hoc-lieu | #106 | xong | Figma 606:5 · xếp chồng trên #103 · gộp vào main qua #111 (03/11/2026) |
| BU-05 | STU | Cộng đồng 3 cột / Threads | claude/bu-05-cong-dong | #104 | xong | Figma 606:3 · KIN_GUEST_QUESTIONS giữ tắt tới khi #104 + BU-08 cùng lên · gộp vào main qua #111 (03/11/2026) |
| BU-07 | STU (ADM soạn bài) | Tin tức | claude/bu-07-tin-tuc | #102 | xong | Figma 606:4 · kèm STU-004 · gộp vào main qua #111 (03/11/2026) |
| BU-03 | ADM+TUT | Đề thi kiểu Azota | claude/bu-03-de-thi | #107 | xong | Sau BU-00 · gộp trước BU-04 · gộp vào main qua #111 (03/11/2026) |
| BU-04 | STU | Phòng thi một cột | claude/bu-04-phong-thi | #108 | xong | Figma 606:6; sau BU-03 · xếp chồng #107; ghép sẵn #94 ở nhánh -gop-94; múi giờ còn mở · gộp vào main qua #111 (03/11/2026) |
| BU-06 | STU | Tìm gia sư kiểu sàn | claude/bu-06-tim-gia-su | #105 | xong | Sau BU-01 · xếp chồng #103; BU-06b = #109 · gộp vào main qua #111 (03/11/2026) |
| BU-06b | STU+TUT | Gia sư ghi ảnh bìa + video giới thiệu (PUT tutor-profile) | claude/bu-06b-anh-bia-video | #109 | xong | xếp chồng #105; ảnh bìa data URL ≤250 000 ký tự · gộp vào main qua #111 (03/11/2026) |
| BU-08 | ADM | Quản trị gọn 4 module | claude/bu-08-quan-tri | #110 | xong | Figma 606:7; cuối cùng · D2 xử lý khi gộp: cron article-publish chạy HẰNG NGÀY 07:15 giờ VN (không phải 15 phút) vì repo chỉ chấp nhận cron hằng ngày · gộp vào main qua #111 (03/11/2026) |
| STU-001 | STU | Mặc định phòng thi an toàn (answerVisibility, giới hạn lượt) | claude/stu-s1 | #94 | xong | S · giao 01/11 · từ báo cáo điểm yếu mục 4 · gộp vào main qua #111 (03/11/2026) |
| STU-002 | STU | Sửa chữ trang chủ khớp sản phẩm thật | claude/stu-s1 | #94 | xong | S · giao 01/11 · chủ xem câu chữ · gộp vào main qua #111 (03/11/2026) |
| ADM-001 | ADM | Audit Tin tức + authorId từ session + nhãn thiếu; xoá học sinh → ẩn | claude/adm-s1 | #92 | xong | S · giao 01/11 · gộp vào main qua #111 (03/11/2026) |
| TUT-002 | TUT | Người nộp đơn gia sư không ghi danh lớp được | claude/tut-s1 | #93 | xong | S · giao 01/11 · gộp vào main qua #111 (03/11/2026) |
| ADM-003 | ADM | Cron english-voa vào CRON_JOBS; bỏ route _template | claude/adm-s1 | #92 | xong | S · giao 01/11 · sau ADM-001 · gộp vào main qua #111 (03/11/2026) |
| ADM-002 | ADM | Validator server bài viết; thông báo theo tag | | | moi | M |
| STU-003 | STU | Cache xếp hạng, rank bằng count | | | moi | M |
| TUT-001 | TUT | Gộp cửa tạo lớp về TaoLop; sửa chữ buổi học | | | moi | S · TIỀN = trình bày · chờ chủ xác nhận mặc định per_session |
| TUT-003 | TUT | Hộp việc: câu hỏi học sinh trong lớp chưa trả lời | | | moi | M · sau BU-05 |
| STU-004 | STU | generateMetadata trang khách + sitemap + lọc thi thử theo ghi danh | | | moi | L · làm chung BU-07 |
| CHỦ-01 | chủ | Đổi feeMode lớp cũ sang per_session; hai hệ phí một phiếu | | | dung | TIỀN = có — chờ Thọ |
| CHỦ-02 | chủ | Coin ẩn hẳn hay giữ; bật cổng ≥17 + hỏi ngày sinh | | | dung | chờ Thọ |
| CHỦ-03 | chủ | Lớp 2 ca/ngày có cần không | | | dung | chờ Thọ |

**Đợt S đầu tiên (01/11/2026):** test đã chạy thật trên bản sao test — adm: 9/12 bài sạch, 2 đỏ có sẵn + 1 nợ P3 `parseAuditFilter` nhận 31/02; tut: 8/8 sạch; stu: 5/5 sạch. Chưa chạy các bài `ui-*` (cần trình duyệt). Nợ mới: ADM-002 (validator bài viết, PUT học sinh), restore giữ `banned` cũ, phân trang đếm bản ẩn, nút 'Vào lớp này' khi đang nộp đơn gia sư, đổi 'bạn'→'em' ở màn review.

**Figma 01/11/2026 (trang "🚀 Bigupdate (11/2026)" 606:2, file 2orXvoHL2upkiGoMjlq8aX):** CAT-01 = Section 647:442 (PR #100) · CAT-02 = Section 651:684 (PR #98) · HOME-02 = Section 653:848 (PR #99). Số liệu trong khung là dữ liệu mẫu; chữ lấy đúng từ mã.

**Đợt 02/11/2026:** PR mới #101 (Tiếng Anh tự học), #102 BU-07, #103 BU-01, #104 BU-05, #105 BU-06, #106 BU-02, #107 BU-03; #98 CAT-02, #99 HOME-02, #100 CAT-01. Lỗi có sẵn ở main (không phải của đợt): ui-tutor-everything 18/4 (/lop-cua-toi/x 404, /mentor trần, console.error), ui-student-shell locator, t-links /hoc-vien, t-hocphi-schema-additive.

**Thứ tự gộp đề nghị:** #94 → #97 → #99; #98 → #100; #93 trước #103; #103 → #106 → #105 (BU-02/06 rẽ từ BU-01); #92 và #102 xung đột nhẹ; #101, #104, #107 độc lập. Sau khi gộp: `prisma db push` (site_content, User.deletedAt, course_categories, schema BU-01/03/05/06/07).
