# Sổ việc của COO

Một dòng một việc. Trạng thái: `moi` · `dang-lam` · `cho-test` · `cho-ra-soat` · `cho-gop-pr` · `xong` · `dung` (lý do ở ghi chú).

| Mã | Phòng | Việc | Nhánh | PR | Trạng thái | Ghi chú |
|---|---|---|---|---|---|---|
| COO-000 | COO | Dựng phòng ban (16 tác tử, 4 tài liệu) + báo cáo điểm yếu 01/11 | claude/phong-ban-agent | | cho-gop-pr | Nền cho mọi việc sau |
| BU-00 | TUT+STU+ADM | Tách 3 giao diện theo vai | claude/bu-00-phan-vai | #88 | cho-gop-pr | Làm trước khi có phòng ban; chờ Thọ gộp |
| BU-01 | TUT (+STU màn nhập mã) | Lớp: joinPolicy, mã cá nhân, duyệt, lớp miễn phí | | | moi | Mở sau #88; đặc tả = BIGUPDATE-KE-HOACH.md mục BU-01 |
| BU-02 | TUT (ADM giữ 2 tệp lớn) | Học liệu: tab Giáo trình + ô tải lên chung | | | moi | Figma 606:5 |
| BU-05 | STU | Cộng đồng 3 cột / Threads | | | moi | Figma 606:3 |
| BU-07 | STU (ADM soạn bài) | Tin tức | | | moi | Figma 606:4 |
| BU-03 | ADM+TUT | Đề thi kiểu Azota | | | moi | Sau BU-00 |
| BU-04 | STU | Phòng thi một cột | | | moi | Figma 606:6; sau BU-03 |
| BU-06 | STU | Tìm gia sư kiểu sàn | | | moi | Sau BU-01 |
| BU-08 | ADM | Quản trị gọn 4 module | | | moi | Figma 606:7; cuối cùng |
| STU-001 | STU | Mặc định phòng thi an toàn (answerVisibility, giới hạn lượt) | | | moi | S · từ báo cáo điểm yếu 01/11 mục 4 |
| STU-002 | STU | Sửa chữ trang chủ khớp sản phẩm thật | | | moi | S · chủ xem câu chữ |
| ADM-001 | ADM | Audit Tin tức + authorId từ session + nhãn thiếu; xoá học sinh → ẩn | | | moi | S |
| TUT-002 | TUT | Người nộp đơn gia sư không ghi danh lớp được | | | moi | S |
| ADM-003 | ADM | Cron english-voa vào CRON_JOBS; bỏ route _template | | | moi | S |
| ADM-002 | ADM | Validator server bài viết; thông báo theo tag | | | moi | M |
| STU-003 | STU | Cache xếp hạng, rank bằng count | | | moi | M |
| TUT-001 | TUT | Gộp cửa tạo lớp về TaoLop; sửa chữ buổi học | | | moi | S · TIỀN = trình bày · chờ chủ xác nhận mặc định per_session |
| TUT-003 | TUT | Hộp việc: câu hỏi học sinh trong lớp chưa trả lời | | | moi | M · sau BU-05 |
| STU-004 | STU | generateMetadata trang khách + sitemap + lọc thi thử theo ghi danh | | | moi | L · làm chung BU-07 |
| CHỦ-01 | chủ | Đổi feeMode lớp cũ sang per_session; hai hệ phí một phiếu | | | dung | TIỀN = có — chờ Thọ |
| CHỦ-02 | chủ | Coin ẩn hẳn hay giữ; bật cổng ≥17 + hỏi ngày sinh | | | dung | chờ Thọ |
| CHỦ-03 | chủ | Lớp 2 ca/ngày có cần không | | | dung | chờ Thọ |
