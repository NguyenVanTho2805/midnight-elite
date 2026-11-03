# Sổ việc của COO

Một dòng một việc. Trạng thái: `moi` · `dang-lam` · `cho-test` · `cho-ra-soat` · `cho-gop-pr` · `xong` · `dung` (lý do ở ghi chú).

| Mã | Phòng | Việc | Nhánh | PR | Trạng thái | Ghi chú |
|---|---|---|---|---|---|---|
| COO-000 | COO | Dựng phòng ban (16 tác tử, 4 tài liệu) + báo cáo điểm yếu 01/11 | claude/phong-ban-agent | #90 | cho-gop-pr | Nền cho mọi việc sau |
| BU-00 | TUT+STU+ADM | Tách 3 giao diện theo vai | claude/bu-00-phan-vai | #88 | cho-gop-pr | Làm trước khi có phòng ban; chờ Thọ gộp |
| BU-01 | TUT (+STU màn nhập mã) | Lớp: joinPolicy, mã cá nhân, duyệt, lớp miễn phí | claude/bu-01-lop | #103 | cho-gop-pr | Gộp #93 (redeem) trước |
| BU-02 | TUT (ADM giữ 2 tệp lớn) | Học liệu: tab Giáo trình + ô tải lên chung | claude/bu-02-hoc-lieu | #106 | cho-gop-pr | Rẽ từ BU-01; chờ chủ: Cloudinary/KIN_VIDEO_UPLOAD; tab Chương bài cũ admin còn tải không ký → BU-08 |
| BU-05 | STU | Cộng đồng 3 cột / Threads | claude/bu-05-cong-dong | #104 | cho-gop-pr | Không bật KIN_GUEST_QUESTIONS ở production tới khi có UI kiểm duyệt (BU-08) |
| BU-07 | STU (ADM soạn bài) | Tin tức | claude/bu-07-tin-tuc | #102 | cho-gop-pr | Xung đột nhẹ #92; cron bài hẹn giờ = ADM-002 |
| BU-03 | ADM+TUT | Đề thi kiểu Azota | claude/bu-03-de-thi | #107 | cho-gop-pr | Từ main; chờ chủ: jszip/xmldom (9d0ebca), MathType, nút gốc Môn; đề nhiều mã khoá tới BU-04 |
| BU-04 | STU | Phòng thi một cột |  |  | dung | TẠM DỪNG 02/11 (hạn mức tuần); chỉ có đặc tả dac-ta/BU-04.md (commit 0ebccdf, worktree wt-bu04, chưa push); duyệt D-a/b/c; chờ chủ: leaderboard lộ tên top 50, participants đếm đôi, múi giờ |
| BU-06 | STU | Tìm gia sư kiểu sàn | claude/bu-06-tim-gia-su | #105 | cho-gop-pr | Rẽ từ BU-01; còn BU-06b: đường ghi coverUrl/introVideoUrl (phòng Gia sư) |
| BU-08 | ADM | Quản trị gọn 4 module |  |  | dung | TẠM DỪNG 02/11 (hạn mức tuần); chưa có mã; gồm UI kiểm duyệt cộng đồng, ADM-002, thay tab Chương bài cũ |
| STU-001 | STU | Mặc định phòng thi an toàn (answerVisibility, giới hạn lượt) | claude/stu-s1 | #94 | cho-gop-pr | S · giao 01/11 · từ báo cáo điểm yếu mục 4 |
| STU-002 | STU | Sửa chữ trang chủ khớp sản phẩm thật | claude/stu-s1 | #94 | cho-gop-pr | S · giao 01/11 · chủ xem câu chữ |
| ADM-001 | ADM | Audit Tin tức + authorId từ session + nhãn thiếu; xoá học sinh → ẩn | claude/adm-s1 | #92 | cho-gop-pr | S · giao 01/11 |
| TUT-002 | TUT | Người nộp đơn gia sư không ghi danh lớp được | claude/tut-s1 | #93 | cho-gop-pr | S · giao 01/11 |
| ADM-003 | ADM | Cron english-voa vào CRON_JOBS; bỏ route _template | claude/adm-s1 | #92 | cho-gop-pr | S · giao 01/11 · sau ADM-001 |
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
