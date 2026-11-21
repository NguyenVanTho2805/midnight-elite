# Sửa chữa lớn (SCL) — 21/11/2026

Không thêm tính năng. Mục tiêu: KiN đi vào hoạt động cho MỘT chủ (vừa admin vừa dạy) và vài gia sư phụ.

**Học sinh chỉ cần:** HS1 xem record (YouTube không công khai), HS2 lấy tài liệu, HS3 làm bài tập, HS4 xem điểm.
**Gia sư chỉ cần:** GS1 kéo-thả tài liệu (không link Drive), GS2 gắn link YouTube, GS3 quản lý điểm.

Nguồn: hội đồng 8 agent chê + research (bản tổng hợp chép ở `docs/kin/bao-cao/che-21-11-2026.md`). Nhánh tích hợp `claude/sua-chua-lon` (từ main 83b3654d).

## Quyết định của chủ (21/11)

| # | Quyết định |
|---|---|
| Q1 | **Một tài khoản**: admin (GVCN) đứng lớp ngay trong vỏ gia sư, thấy mọi lớp, có nhóm "Quản lý" (Gia sư, Học sinh, Hàng chờ). Vỏ admin.* chỉ còn quản người + nhật ký. |
| Q2 | Gia sư khác (GV bộ môn) là chủ lớp của lớp mình; admin thấy và sửa được mọi lớp. Không đổi schema. |
| Q3 | Nộp bài **nhận ảnh**: máy học sinh gộp các ảnh thành MỘT PDF rồi mới tải lên, ảnh không lưu riêng (người học ≥17 tuổi theo quyết định 25/10). |
| Q4 | Video = **YouTube không công khai**, nhúng youtube-nocookie; ghi rõ rủi ro link chia ra ngoài. |
| Q5 | Điểm tự khai (đề Azota) phải chờ gia sư duyệt; chưa duyệt thì không vào báo cáo phụ huynh. *(mặc định hội đồng)* |
| Q6 | Bỏ màn chặn OTP khi đăng ký học sinh. *(mặc định)* |
| Q7 | Mã lớp không hạn + nút "Đổi mã" một chạm; lớp cũ `joinPolicy` null → "duyệt" và ẩn khỏi trang công khai. *(mặc định)* |
| Q8 | **Xoá hẳn** Tiếng Anh, Điểm chuẩn, Tin tức, Xếp hạng; **ẩn giữ mã** Học phí, Cộng đồng (và phần cờ khác chưa quyết). |
| Q9 | Giao diện: giữ màu KiN, khoá token, sửa bố cục; dựng 2–3 phương án màn chính cho chủ chọn trước khi sửa. *(mặc định)* |
| Q10 | Trang công khai liệt kê lớp + ô đánh giá: tắt mặc định, lớp là riêng. *(mặc định)* |
| Q11 | Xưng "bạn" trong giao diện. *(mặc định)* |

## Đợt và nhóm việc

| Đợt | Nhóm | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | A Bảo mật điểm/lớp | P1-2, P1-3, P1-4, P2-7, P2-8 (+ dữ liệu: ẩn lớp lỡ công khai, Q7) | — |
| 1 | B Vai GVCN/GVBM | P1-6, nhãn vai, nhóm Quản lý trong vỏ gia sư, gỡ 403 giáo trình | Q1, Q2 |
| 1 | E Vào lớp | P1-5, P2-9, P2-11, P2-13, P2-17, P2-20 | Q6, Q7 |
| 1 | J Bảo mật phụ | header chống iframe, overwrite:false, chống dò mật khẩu bền | — |
| 2 | C Bài tập & điểm | bật SO_DIEM gọn, tab Kết quả học sinh, "+ Giao bài" thẳng, điểm tự khai chờ duyệt | A, B |
| 2 | D Tài liệu + YouTube | một chỗ soạn (vỏ gia sư), ngăn bài học 3 ô, tab Video gộp record, nộp ảnh→PDF (Q3) | B |
| 2 | H Hiệu năng | vỏ học sinh gác ở server, lọc đề SQL, phông | — |
| 3 | F Rút gọn | xoá 4 phần (Q8), bịt lối vào phần tắt, một cửa tạo lớp, gộp soạn đề, gỡ cron | D |
| 3 | G Giao diện | 2–3 phương án → chủ chọn → token, nút chính, KinListRow, "Cần làm" | F, Q9 |
| 3 | I Tiếp cận | dialog chung, Toggle, ô 16px, skip link | D, G |

Mỗi đợt: agent làm từng nhóm trong worktree riêng → test thật → rà soát độc lập (kin-ra-soat + agent-skills:code-reviewer) → gộp vào `claude/sua-chua-lon` → một PR mỗi đợt, chủ bấm gộp.

## Quy tắc giữ nguyên
Schema chỉ thêm; POST+303; token `--kin-*`, không hex; nút ≥44px, 390px không tràn; không chạm cách tính tiền; thông báo không tên/số tiền; Next 16 đọc `node_modules/next/dist/docs`.
