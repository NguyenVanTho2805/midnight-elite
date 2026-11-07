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
| ADM-002 | ADM | Validator server bài viết; thông báo bài mới tối đa một lần | claude/adm-002-bai-viet | #113 | xong | M · 04/11/2026 · phần "theo tag/lớp" CHƯA làm (bài viết không có quan hệ tới lớp; cần chủ quyết nhóm nhận) |
| STU-003 | STU | Cache xếp hạng, rank bằng count | claude/stu-003-xep-hang | #115 | xong một phần | M · 04/11/2026 · rank bằng count ĐÃ làm; cache `/api/leaderboard` và `/api/honor-leaderboard` KHÔNG làm — hai route không đòi đăng nhập và trả tên + trường học sinh (TRẺ EM), chờ chủ quyết |
| HQ-0411 | STU | Hồi quy 04/11: cảnh báo React ở `/khoa-hoc` (CAT-01) + 2 ca đỏ giả lối thoát phòng thi | claude/cat-01-hoi-quy | #116 | xong | S · 04/11/2026 · lỗi thật 1 (replaceState trong hàm cập nhật state), sửa bài kiểm 1; `409` khi bấm "Theo dõi lớp" với hồ sơ `pending_consent` CHƯA sửa (chủ quyết) |
| STU-003b | STU | Quyết định 1B: bảng vinh danh bắt đăng nhập; bảng xếp hạng công khai che tên + top 10; đệm 60 giây | claude/xep-hang-1b | #118 | xong | M · 04/11/2026 · còn mở: `/api/exam-results?examId=` trả tên thật |
| STU-005 | STU | Quyết định 2A: thẻ lớp "Chờ phụ huynh đồng ý" thay nút Theo dõi (pending_consent) | claude/cho-phu-huynh-2a | #119 | xong | S · 04/11/2026 · `suspended` cũng bị 409 khi theo dõi, chưa xử lý |
| STU-006 | STU | Quyết định 3A: khách không thấy câu hỏi cũ trong bảng tin cộng đồng | claude/khach-hoi-dap-3a | #120 | xong | S · 04/11/2026 |
| STU-007 | STU | Quyết định 5A: phòng thi báo "Chưa lưu được" + Thử lại khi máy chủ từ chối đáp án (4xx) | claude/phong-thi-chip-5a | #121 | xong | S · 04/11/2026 · bài kiểm sửa ở PR docs (thứ tự câu bị xáo) |
| GOP-0611 | COO | Gộp hết nhánh chưa gộp: #123–#129 + BU-02-PHẲNG + HOCPHI-THEO-BUOI + tài liệu bàn giao | claude/gop-het-chua-gop | (PR tích hợp) | xong | L · 06/11/2026 · 2 nhóm xung đột đã giải; `ui-role-everything` 38/0, `ui-links-everywhere` 7/0; ~65 nhánh cũ KHÔNG gộp (xem `bao-cao/gop-het-06-11-2026.md`) |
| DON-NHANH | COO | Dọn nhánh rác: phân loại 125 nhánh (đề nghị xoá 119, giữ 6) | claude/docs-nhanh-da-xoa | (PR docs) | chờ Thọ chạy script | S · 06/11/2026 · phiên Claude không có quyền xoá nhánh (HTTP 403) → `tools/xoa-nhanh-rac.sh --apply`; xem `bao-cao/nhanh-da-xoa-06-11-2026.md` |
| GOP-0711 | COO | Gộp 9 PR Điều hướng A/B (quản trị, học sinh, gia sư) + email mã 6 số + ô chọn (#132–#140) | claude/gop-dieu-huong | (PR tích hợp) | xong | L · 07/11/2026 · bốn chuỗi chồng gộp sạch; `ui-role-everything` 38/0, `ui-links-everywhere` 7/0; sửa 3 chỗ bài kiểm; #139 hai nguồn "đã thu" và #133 thư thật chưa kiểm vẫn mở (xem `bao-cao/gop-dieu-huong-07-11-2026.md`) |
| TUT-001 | TUT | Gộp cửa tạo lớp về TaoLop; sửa chữ buổi học | | | moi | S · TIỀN = trình bày · chờ chủ xác nhận mặc định per_session |
| TUT-003 | TUT | Hộp việc: câu hỏi học sinh trong lớp chưa trả lời | claude/tut-003-hop-viec | #114 | xong | M · 04/11/2026 · thông báo cho gia sư khi có câu hỏi mới đã có sẵn (thread_new_class) |
| TUT-lich-keo-tha | TUT | Lịch lớp kéo-thả như Google Calendar, lịch bắt buộc khi tạo lớp | claude/lich-lop-keo-tha | (chưa mở) | cho-gop-pr | L · 07/11/2026 · 4 commit 0e81963c 3f774fd4 5e39518c e24175f8 · schema không đổi, TIỀN không đổi (có test) · chưa làm C7, C3 · chờ chủ C1–C4, C6 · gộp cùng PR đồng giảng cần giải xung đột LopChiTiet/LopHoc/tutorRoutes/class-schedules |
| STU-004 | STU | generateMetadata trang khách + sitemap + lọc thi thử theo ghi danh | | | moi | L · làm chung BU-07 |
| CHỦ-01 | chủ | Đổi feeMode lớp cũ sang per_session; hai hệ phí một phiếu | | | dung | TIỀN = có — chờ Thọ |
| CHỦ-02 | chủ | Coin ẩn hẳn hay giữ; bật cổng ≥17 + hỏi ngày sinh | | | dung | chờ Thọ |
| CHỦ-03 | chủ | Lớp 2 ca/ngày có cần không | | | dung | chờ Thọ |

**Đợt S đầu tiên (01/11/2026):** test đã chạy thật trên bản sao test — adm: 9/12 bài sạch, 2 đỏ có sẵn + 1 nợ P3 `parseAuditFilter` nhận 31/02; tut: 8/8 sạch; stu: 5/5 sạch. Chưa chạy các bài `ui-*` (cần trình duyệt). Nợ mới: ADM-002 (validator bài viết, PUT học sinh), restore giữ `banned` cũ, phân trang đếm bản ẩn, nút 'Vào lớp này' khi đang nộp đơn gia sư, đổi 'bạn'→'em' ở màn review.

**Figma 01/11/2026 (trang "🚀 Bigupdate (11/2026)" 606:2, file 2orXvoHL2upkiGoMjlq8aX):** CAT-01 = Section 647:442 (PR #100) · CAT-02 = Section 651:684 (PR #98) · HOME-02 = Section 653:848 (PR #99). Số liệu trong khung là dữ liệu mẫu; chữ lấy đúng từ mã.

**Đợt 02/11/2026:** PR mới #101 (Tiếng Anh tự học), #102 BU-07, #103 BU-01, #104 BU-05, #105 BU-06, #106 BU-02, #107 BU-03; #98 CAT-02, #99 HOME-02, #100 CAT-01. Lỗi có sẵn ở main (không phải của đợt): ui-tutor-everything 18/4 (/lop-cua-toi/x 404, /mentor trần, console.error), ui-student-shell locator, t-links /hoc-vien, t-hocphi-schema-additive.

**Thứ tự gộp đề nghị:** #94 → #97 → #99; #98 → #100; #93 trước #103; #103 → #106 → #105 (BU-02/06 rẽ từ BU-01); #92 và #102 xung đột nhẹ; #101, #104, #107 độc lập. Sau khi gộp: `prisma db push` (site_content, User.deletedAt, course_categories, schema BU-01/03/05/06/07).

**Figma 05/11/2026 (trang 606:2):** vẽ thêm 3 Section. BU-01 Lớp = Section 664:889 (khung 668:1281, 668:1430, 670:1027, 670:1110, 670:1147, 670:1187, 670:1225, 670:1291, 670:1329) · BU-03 Đề thi phía gia sư = Section 665:889 (671:1071, 671:1251, 671:1417, 671:1572, 671:1761; chưa có khung điện thoại) · BU-06 Tìm gia sư = Section 666:889 (673:1416, 673:1479, 673:1528, 673:1612). Khung cũ giữ nguyên: 664:890, 665:890, 665:992, 666:890, 666:996. Mục lục 639:285 thêm 3 dòng liên kết (675:1416 đến 675:1422). Đối chiếu BU-02/05/07 với mã: `docs/kin/bao-cao/doi-chieu-figma-bu02-bu05-bu07-05-11-2026.md`.
