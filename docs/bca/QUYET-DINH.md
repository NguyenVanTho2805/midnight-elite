# Quyết định của chủ — BCA Midnight (bản xây lại)

Nguồn sự thật cho đội `bca-*`. Chỉ thêm dòng mới (ghi ngày); quyết định đổi thì gạch dòng cũ và ghi dòng mới bên dưới.

## Bối cảnh (26/11/2026)
- Lớp **BCA Midnight Class**: ôn thi BCA/ĐGNL cho Khối 12 (2K9) và thí sinh tự do. 4 môn, học Google Meet 22:15, 90 phút:
  Toán (T3, T7 · anh Thanh, chị Hoa), Sử (T4, CN · anh Thanh), Địa (T6 · anh Thanh), Anh (T2, T5 · chị Thu Hương, anh Quang Minh).
- Đang chạy bằng Google Sheet "PHIẾU ĐĂNG KÝ HỌC THÊM HÈ/NĂM HỌC MỚI (Câu trả lời)" + Apps Script KiN v8.12 (chủ sheet: anh Thanh).
  Ngày 26/11: 70 học sinh (20 chính thức, 50 học thử), 192 lượt ghi danh, 154 đơn đăng ký, 46 buổi, học phí tháng 11 còn nháp.
- Mô hình dữ liệu gốc: xem `COLS`, `CFG_DEF`, `MON_DEF` ở đầu script (tab 👥 Học sinh, 📝 Ghi danh, 📅 Buổi học, __DiemDanh, 🧾 Sổ điểm, 🧾 Phiếu học phí, 💳 Thu tiền, 📥 Đăng ký, 🌐 Lộ trình web, ⚙️ Cài đặt).

## Đã chốt (26/11/2026)
1. **Web mới thay hẳn Sheet.** Chuyển dữ liệu một lần, sau đó vận hành 100% trên web; Sheet chỉ để lưu trữ.
2. **Người dùng:** chủ lớp (quản trị), giáo viên cộng tác, học sinh, phụ huynh (ở mức tin nhắn Zalo). Không có nhóm nào khác (ô "Khác" tick nhầm).
3. **Bản đầu có đủ:** học sinh + ghi danh môn (Học / Thử / Nghỉ, lứa); buổi học + điểm danh; sổ điểm + báo cáo; học phí + thu tiền.
4. **Học sinh đăng nhập bằng Google** (Gmail đã khai trong phiếu).
5. **Phụ huynh:** chưa có tài khoản hay link; web soạn sẵn tin nhắn Zalo (báo cáo tháng, học phí) để chủ sao chép gửi.
6. **Giao diện:** Claude dựng 2–3 mẫu, các agent giám khảo chấm và chọn.
7. **Tự động phải có ngay bản đầu:** nhận đơn đăng ký; email chào + link Zalo; đồng bộ lớp Google Meet; tin nhắn Zalo soạn sẵn.
8. **Học thử:** đăng ký trên web xong có ngay link nhóm Zalo học thử; vào được các lớp đã chọn **14 ngày tính từ ngày đăng ký**, xem điểm, điểm danh… như học sinh chính thức; hết 14 ngày thì khoá, trừ khi gia sư gia hạn thêm ngày.
9. **Form đăng ký:** web mới có cả **trang giới thiệu** (lộ trình, vinh danh) + form; bỏ GitHub Pages.
10. **Điểm:** nhập tay + dán bảng điểm xuất từ Azota (tự khớp theo tên / username Azota).
11. **Học bổng + xếp hạng tháng:** để sau.
12. **Tên miền:** chạy thử ở tên miền phụ / địa chỉ Vercel; chủ hài lòng mới đổi tên miền chính.
13. **Học phí:** tiền = số buổi lớp có học (Có học / Học bù) của môn trong tháng, tính từ ngày em chính thức; chủ sửa được số buổi từng em trước khi gửi phiếu. Đơn giá như sheet: 65.000đ/buổi nếu kỳ đó em học 1 môn, 55.000đ/buổi/môn nếu từ 2 môn.
14. **Giáo viên cộng tác:** chỉ môn mình dạy (danh sách em của môn, điểm danh, nhập điểm, record/tài liệu). Không thấy học phí, không thấy SĐT phụ huynh.
15. **Thu tiền:** phiếu có mã VietQR (đúng số tiền + nội dung "Mã HS + kỳ"), chủ bấm "Đã thu". Không cổng thanh toán.
16. **Gia hạn học thử / chuyển chính thức:** chỉ chủ lớp.
17. **Nơi đặt mã:** ~~kho mới~~ → dùng luôn kho `NguyenVanTho2805/midnight-elite`, dựng trên nhánh riêng; mỗi lần đẩy mã Vercel tạo địa chỉ xem thử. Web KiN đang chạy giữ nguyên tới khi chủ đồng ý thay.
18. **Cơ sở dữ liệu:** Neon miễn phí, một DB mới tách hẳn khỏi DB của KiN đang chạy.
19. **Công cụ:** Graphify, Playwright CLI, Agent Skills (Vercel), Ponytail, GSAP, Lenis, React Bits (qua `components.json` → `@react-bits/…`), 21st.dev (cần khoá API của chủ để cài linh kiện; xem trang `.md` để tham khảo thì không cần).

20. **Giao diện (26/11, 3 giám khảo chọn):** một ngôn ngữ nền tối "Midnight" (mẫu A) cho mọi khu; phần đầu học sinh dạng câu + nút to (mẫu C); bảng dày kiểu ma trận (mẫu B). Chi tiết: `thiet-ke/huong-chon.md`, `thiet-ke/token.md`.

21. **Giáo viên điểm danh trên điện thoại ngay trong buổi Meet** — màn điểm danh 1 cột, nút to, "đánh tất cả có mặt" là ưu tiên của Đợt 1.
22. **Trang giới thiệu theo cài đặt sáng/tối của máy** (`prefers-color-scheme`); khu học sinh và quản lý giữ nền tối.
23. **Thứ tự đợt:** Đợt 1 quản lý lớp (học sinh + ghi danh, buổi học + điểm danh, màn Hôm nay, chuyển dữ liệu từ sheet) → Đợt 2 khu học sinh + đăng nhập Google → Đợt 3 sổ điểm, học phí → Đợt 4 trang giới thiệu + form, email, Meet.
24. **Chủ duyệt cuối mỗi đợt.** Trong đợt đội tự làm, tự kiểm, tự rà; câu hỏi nghiệp vụ gửi chủ ngay khi gặp.

## Câu hỏi đang mở
- Khoá API 21st.dev (nếu muốn cài linh kiện từ 21st.dev).
