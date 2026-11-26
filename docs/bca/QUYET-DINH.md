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
25. **Đợt 1 chủ đã thử trên máy và duyệt (26/11).** Bước tiếp chạy song song: (a) đưa bản thử lên mạng, (b) đội làm đăng nhập Google (Đợt 2) để lên chính thức.
26. **Chỗ đặt web (26/11):** project Vercel riêng `bca-midnight` (thư mục gốc `bca/`), địa chỉ riêng; web KiN (project `midnight-elite`) và `DATABASE_URL` của nó giữ nguyên. Tạm bật Vercel Authentication cho **mọi** địa chỉ của `bca-midnight` (kể cả production) tới khi đăng nhập Google xong. Biến đã đặt: `BCA_SESSION_SECRET` (Preview + Production), `BCA_DEV_LOGIN=1` (chỉ Preview). Lệnh dựng chạy `prisma migrate deploy` vào DB riêng của BCA.

## Tạm chọn, chờ chủ duyệt (26/11, chủ vắng 5 giờ — đội chọn phương án khuyên dùng; chủ đổi được)
Nguồn: phiếu BCA-D1-NV, chi tiết từng câu ở `nghiep-vu/*.md` mục "Câu hỏi cho chủ".
- T1. Đăng ký sau 22:15 vẫn tính hôm đó là ngày 1 của 14 ngày thử (đúng chữ quyết định 8); chủ gia hạn nếu cần.
- T2. Em hết hạn thử đăng ký thử lại: không tự cấp, vào hàng chờ chủ.
- T3. Đơn "Chính thức" của em chưa từng thử: thử 14 ngày kèm cờ "muốn chính thức"; chủ bấm chuyển (quyết định 16).
- T4. Gia hạn thử áp cho mọi môn em đang thử.
- T5. Đơn giá theo kỳ: số môn có buổi > 0 trong kỳ quyết định 65.000đ hay 55.000đ (quyết định 13).
- T6. 5 em đăng ký web 15/11 giữ nguyên hạn thử 29/11.
- T7. Học sinh nghỉ chỉ ẩn, không xoá cứng.
- T8. Đổi lịch môn: sinh lại buổi tương lai chưa có dữ liệu; buổi đã có dữ liệu giữ nguyên và báo chủ.
- T9. Chỉ chủ huỷ buổi và thêm học bù.
- T10. Đợt 1 chỉ hiện số đếm Có/Phép/Vắng; công thức chuyên cần chốt ở Đợt 3.
- T11. Giáo viên sửa điểm danh cũ mọi lúc; quá 48 giờ phải xác nhận; có nhật ký.
- T12. Buổi tối qua chưa điểm danh hiện ở Hôm nay đến 05:59 sáng.
- T13. Giáo viên không thấy em thử sắp hết hạn.
- T14. Giáo viên không thấy SĐT và Gmail học sinh.
- T15. Giáo viên thấy em đã nghỉ môn mình, chỉ xem.
- T16. Học sinh nghỉ/hết thử xem được điểm và điểm danh của chính mình, không xem tài liệu/record.
- T17. Chủ và giáo viên đăng nhập Google bằng Gmail do chủ nhập (máy dev dùng đăng nhập thử theo vai).
- T18. Em mất hồ sơ có 4 ghi danh thử: dựng lại từ đơn, giữ mã cũ.
- T19. 12 em đã xoá (__DaXoa) không chuyển.
- T20. Buổi Sử 25/11: coi là đã điểm danh; 39 dấu theo ma trận, 15 em còn lại là Có.
- T21. Chuyển dữ liệu: chạy thử nhiều lần trên DB thử; chuyển thật một lần khi chủ quyết.
- T22. Thanh dưới điện thoại (khu quản lý), mục thứ 5 là "Thêm".
- T23. Giữ đăng nhập 30 ngày, tự gia hạn; chủ khoá phiên được ngay.
- T24. Mục "Điểm danh" ở thanh dưới mở thẳng buổi tối nay từ 21:45 tới 05:59.
- T25. Có ô ghi chú tuỳ chọn cho từng em trong từng buổi.
- T26. Chưa làm chạy khi mất mạng từ trước (PWA) ở Đợt 1; chỉ hàng đợi lưu khi rớt mạng giữa chừng.
- T27. Hôm nay (điện thoại): mỗi em sắp hết thử một nút "Xử lý" mở tờ trượt.
- T28. Mỗi nhóm sắp hết thử hiện 3 em + "Xem tất cả" + "Gia hạn cả nhóm".
- T29. Gia hạn thử nhiều em một lần, kèm Hoàn tác 5 giây.
- T30. Trang một em: mục Ghi danh luôn hiện đủ 4 môn.
- T31. Buổi học: chỉ danh sách theo tuần, không lưới lịch tháng.
- T32. Học sinh thấy "Nội dung buổi" ngay khi giáo viên ghi.
- T33. Có bảng lưu "đánh dấu xong" cho việc ở màn Hôm nay ngay Đợt 1.
- T35. Bỏ ẩn hồ sơ chỉ khôi phục ngày ghi danh cũ nếu bỏ ẩn trong cùng ngày ẩn; sau đó chỉ hiện lại hồ sơ, chủ tự thêm môn (tránh tự tính phí ngày em đã nghỉ).
- T36. Chỉ chủ được "Đánh dấu xong" việc ở Hôm nay.
- T37. Không xoá buổi đã huỷ, buổi có ghi chú hoặc có buổi bù trỏ tới — chỉ huỷ được.
- T38. "Ẩn 3 ngày" tính theo ngày lịch (ngày đánh dấu + 2 ngày sau).
- T39. T13 chỉ áp cho màn Hôm nay: danh sách điểm danh và hồ sơ em vẫn hiện nhãn "Thử · còn N ngày" cho giáo viên.
- T40. Đăng nhập thử trên địa chỉ xem thử Vercel chỉ bật khi DB là dữ liệu giả (có dấu `DU_LIEU_GIA`) và kèm Deployment Protection của Vercel; với DB thật chỉ dùng đăng nhập Google.
- T41. Học sinh cũng có "khoá phiên ngay" như giáo viên (cột thu hồi phiên + kiểm hồ sơ bị ẩn) — làm cùng đăng nhập Google ở Đợt 2.
- T42. Chỉ xoá được buổi TƯƠNG LAI chưa có dữ liệu (kèm hỏi xác nhận + Hoàn tác 5 giây); buổi đã qua chỉ được huỷ. Có nút "Sinh buổi còn thiếu" cho tháng đã có buổi.
- T43. Đợt 1 xử lý đơn chờ duyệt trên web: "Tạo hồ sơ từ đơn" (điền sẵn từ đơn, ghi danh thử theo T1–T3) và "Bỏ qua" (kèm lý do); đơn đã xử lý hết khỏi việc ở Hôm nay.
- T44. Nhận đơn muộn: thử bắt đầu từ hôm nay (không phủ ngược buổi đã qua), ngày hết vẫn theo T1 (ngày đăng ký + 13).
- T45. Hoàn tác "Tạo hồ sơ từ đơn" xoá hẳn hồ sơ vừa tạo (chưa có dữ liệu; mã không cấp lại). Quy ước chung cho mọi Hoàn tác: thanh Hoàn tác hiện 5 giây, máy chủ chấp nhận tới 10 giây (bù mạng chậm).
- T46. Em đã từng có ghi danh (thử hoặc chính thức) nay không còn môn nào mở, gửi đơn học thử ⇒ vào hàng chờ chủ như T2 (không tự cấp). Em đang học (còn môn mở) đăng ký thêm môn mới ⇒ ghi danh thử môn mới bình thường theo T44.
- T47. Gắn đơn vào hồ sơ cũ mà SĐT (phụ huynh / học sinh) trong đơn khác số đang lưu ⇒ giữ số cũ, báo cho chủ để gọi xác minh.
- T34. "Chủ cho nghỉ môn" ghi bằng cột riêng `nghi_luc` trên ghi danh, không dựa vào chữ trong ghi chú.

### Đợt 2 — đăng nhập Google (26/11, phiếu BCA-D2-DN; chi tiết `bca/README.md` mục "Đăng nhập Google")
- T48. So Gmail khi đăng nhập theo "hộp thư": `@gmail.com` / `@googlemail.com` bỏ dấu chấm và phần `+…`, không phân biệt hoa thường (Gmail coi là cùng một hộp); địa chỉ khác so nguyên văn, không phân biệt hoa thường. Hai tài khoản/hồ sơ trỏ cùng một hộp ⇒ từ chối, báo nhắn chủ gộp (không đoán).
- T49. Một Gmail vừa là tài khoản chủ/GV vừa ghi trên hồ sơ học sinh ⇒ vào vai chủ/GV.
- ~~T50. Tài khoản chủ đầu tiên (và GV, khi chưa có màn Tài khoản) tạo bằng `bca/scripts/them-nguoi-dung.ts` chạy từ máy chủ với chuỗi Neon; không dùng biến môi trường "Gmail chủ".~~ → T54 (script giữ làm dự phòng).
- T51. Hồ sơ đang ẩn không đăng nhập được và phiên đang mở hết hiệu lực (T41). Em nghỉ mà chủ muốn em vẫn xem điểm/điểm danh cũ (T16) ⇒ chủ chỉ "cho nghỉ môn", không ẩn hồ sơ.
- T52. Không ghi nhật ký mỗi lần đăng nhập (chuyen-tu-sheet coi nhật ký có người dùng là "web đã vận hành" và chặn `--apply`). Gmail không bao giờ nằm trong địa chỉ trang hay nhật ký.
- T53. Preview không dùng đăng nhập Google (địa chỉ preview đổi mỗi lần đẩy nên Google không nhận); preview vẫn dùng đăng nhập thử trên DB giả (T40). Google chỉ bật ở Production (và máy chủ lớp nếu tự thêm redirect URI localhost).
- T54. (27/11, phiên chính quyết thay theo uỷ quyền của chủ — mục tiêu: chủ mở web là dùng được, không chạy lệnh) Biến `BCA_GMAIL_CHU`: chỉ khi DB chưa có tài khoản chủ nào còn hoạt động, Gmail đó (dạng gốc T48) đăng nhập Google lần đầu ⇒ tạo tài khoản chủ; đã có chủ còn hoạt động ⇒ biến bị bỏ qua. Một dòng nhật ký `tao_chu_dau_tien` vai `he_thong` (không chặn `chuyen-tu-sheet --apply`).
- T55. (27/11, như trên) Có màn **Tài khoản** ngay Đợt 2: chủ thêm giáo viên (Gmail, tên, môn), sửa tên/môn, khoá/mở khoá, đăng xuất mọi máy; chỉ chủ thấy, quyền kiểm ở máy chủ; không khoá được chủ còn hoạt động cuối cùng (kể cả tự khoá mình).
- T51 giữ nguyên (27/11, như trên): hồ sơ đã ẩn không đăng nhập được.
- T56. (27/11, đội tạm chọn — khu học sinh) "Liên hệ gia hạn" ở màn khoá mở link `ZALO_CHUNG`, không có thì `ZALO_HOC_THU`, không có cả hai thì câu "Nhắn chủ lớp qua Zalo để gia hạn". Nút Meet chỉ hiện khi môn có `link_meet` (Đợt 4 mới đồng bộ Meet); chưa có thì chỉ "Link Meet gửi trong nhóm Zalo của môn" + nút nhóm Zalo môn nếu có.
- T57. (27/11, đội tạm chọn) Nút "Vào lớp ngay" bật từ 15 phút trước giờ học; trước đó nút vẫn bấm được và ghi "còn N phút".

## Câu hỏi đang mở
- Khoá API 21st.dev (nếu muốn cài linh kiện từ 21st.dev).
- ~~3 câu hỏi Đợt 2 ngày 26/11 (chủ đầu tiên, màn Tài khoản, hồ sơ ẩn)~~ — đã quyết 27/11: T54, T55, T51.

