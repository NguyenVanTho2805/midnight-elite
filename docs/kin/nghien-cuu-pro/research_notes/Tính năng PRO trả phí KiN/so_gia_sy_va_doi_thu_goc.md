# Sổ Gia Sư và đối thủ gốc: dữ kiện kiếm tiền, gói trả phí, hạn mức, chuyển đổi (trích từ báo cáo nội bộ 19/10/2026)

> **Phạm vi và phương pháp.** Ghi chú này chỉ trích từ MỘT tệp: báo cáo nội bộ "Sổ Gia Sư (sogiasu.com) và 14 nền tảng tham khảo", bản 2.1, khảo sát 19/10/2026 bằng tài khoản thật (sogiasu, TutorBird, Teachworks, Preply, Wyzant, Shub). Nguồn trong git: nhánh `origin/claude/nang-cap-2`, `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md` (867 dòng). Tôi đã `diff` bản sao ở scratchpad với blob git: **giống hệt**, nên số dòng ghi dưới đây đúng cho cả hai. Bản checkout hiện tại của kho chỉ có `docs/kin/bao-cao/P0-bao-mat.md`, tức báo cáo này KHÔNG nằm trong checkout (đúng như `ke-hoach-phat-trien-tu-research.md` dòng 10 nói). Không dùng web. Tôi không tự đọc Google Sheet backlog; chỗ nào nhắc sheet là trích lại qua ghi chú anh em `hien_trang_kin.md`.
>
> **Ký hiệu.**
> - `[Nguồn: báo cáo nội bộ 19/10, mục X, dòng N]` = chép từ báo cáo; "dòng N" là số dòng trong tệp nguồn 867 dòng. Số liệu chép NGUYÊN VĂN (kể cả dấu `~`, dấu phẩy thập phân kiểu Việt, ký hiệu tiền như báo cáo viết).
> - `[Suy luận]` = nhận định hoặc phép tính của tôi, KHÔNG phải của báo cáo. `[Suy luận — tính lại]` = tôi tự nhân/chia lại từ số của báo cáo.
> - `[Đối chiếu kho: tệp, dòng]` = dữ kiện từ tài liệu khác trong `/home/user/midnight-elite/docs/kin` hoặc mã nguồn tôi đã mở.
> - Quy đổi tiền trong báo cáo (dòng 329): 1 USD ≈ 25.500đ, 1 GBP ≈ 33.000đ, 1 EUR ≈ 28.000đ, 1 JPY ≈ 170đ, 1 KRW ≈ 19đ. Mọi "~đ" của đối thủ nước ngoài là theo tỉ giá cố định này, không phải giá niêm yết bằng VND.
>
> **Tám điều người viết báo cáo Pro cần biết trước khi đọc tiếp.**
> 1. Báo cáo KHÔNG ghi giá "theo tháng" riêng cho Sổ Gia Sư. Chỉ có hai thẻ giá: Quý 179.000đ và Năm 499.000đ. "~42.000đ/tháng" là giá quy đổi của gói năm (dòng 98, 141, 247).
> 2. Tài khoản khảo sát đang ở **Pro dùng thử 30 ngày** (dòng 54), nút "Thanh toán" **chưa bấm** (dòng 108). Báo cáo không ghi quan sát nào về màn hình bị khoá hay vượt hạn mức Free; phần Free vs Pro là đọc từ `/pricing` và `/dashboard/billing`.
> 3. Số mẫu phiếu QR mâu thuẫn ngay trong báo cáo: "9 mẫu (4 Free, 5 Pro)" (dòng 34, 219) nhưng danh sách tên có 10 mẫu và 4 + 6 = 10 (dòng 101, 221). Chi tiết ở câu hỏi 1.
> 4. "Mười hai điểm nghẽn" có HAI danh sách khác nhau: bảng 3.5 (dòng 296–309) và bảng 8.6 (dòng 744–757); các số thứ tự không khớp nhau. Chi tiết ở câu hỏi 4.
> 5. Mục 8 (gói và hạn mức, rủi ro, lộ trình) được báo cáo tự nhận là viết "cho một sản phẩm giả định đang đuổi kịp Sổ Gia Sư" (dòng 5), không phải riêng KiN. Nhiều giả định đã lỗi thời so với KiN (câu hỏi 8).
> 6. Trong các điều liên quan gói Pro, bảng QUYẾT ĐỊNH ĐÃ CHỐT của báo cáo chỉ có: **"Trước mắt miễn phí toàn bộ; chạy ổn rồi mới nâng Pro"** (8.1 hàng 4, dòng 634; 8.9 hàng 3, dòng 789: "Trước mắt miễn phí toàn bộ sản phẩm (cả SaaS lẫn sàn); chạy ổn rồi mới bật Pro"), kèm hệ quả ghi trong 8.1 hàng 1 là "Không thu hoa hồng, không giữ tiền hộ, không xếp lịch hộ" (dòng 631) và ô bảng 8.5 "Có (đã chốt: miễn phí cho mọi gia sư)" cho hồ sơ công khai + nhận yêu cầu (dòng 735). **Điều kiện bật Pro** được báo cáo ghi là "Điều kiện gợi ý để bật Pro" (dòng 740) và **"Không nên cạnh tranh bằng giá thấp hơn"** nằm trong danh sách "Rủi ro và lưu ý" (dòng 771), không nằm trong bảng quyết định. Đề bài mô tả cả hai như "đã chốt"; báo cáo không nói vậy. Chi tiết ở câu hỏi 5.
> 7. Số quy mô của các hãng là "tự công bố" (dòng 80, 329). Review chỉ dùng định tính (dòng 329).
> 8. Khảo sát ngày 19/10/2026; hôm nay là 22/10/2026. Dùng thử của tài khoản khảo sát hết hạn 20/10/2026 (dòng 54). Banner khuyến mãi `PHU_NU_VN_20_10` gắn với dịp 20/10 nhưng báo cáo không ghi ngày hết hạn của mã. [Suy luận: có thể đã hết hạn; giá và khuyến mãi có thể đã đổi sau 19/10.]

---

## 1. Bảng giá và hạn mức CHÍNH XÁC của Sổ Gia Sư (Free vs Pro), và các chi tiết dùng để thúc nâng cấp

### Takeaway
Sổ Gia Sư bán hai kỳ hạn Pro (Quý 179.000đ, Năm 499.000đ), có Free 0đ và dùng thử trọn bộ Pro 30 ngày không cần thẻ. Free chỉ bị khoá ở 8 học sinh, 4 mẫu phiếu QR, 50 MB, không đính kèm Google Drive, không đối soát (còn "sắp có"), không hỗ trợ ưu tiên; toàn bộ lõi sổ lớp (lớp, buổi, điểm danh, học phí, báo cáo phụ huynh qua link, Google Calendar + Meet) mở ở cả hai gói. Báo cáo gọi mốc 8 học sinh là "chốt chặn chuyển đổi"; các đòn còn lại là banner khuyến mãi trên mọi trang, mã giảm giá tự áp, cảnh báo "còn 1 ngày" và hai tính năng "sắp có" đang được bán trước.

### Cited Findings

#### 1.A Giá, kỳ hạn, dùng thử (nguyên văn)
- Bảng giá và giới hạn gói được báo cáo "đọc từ /pricing và /dashboard/billing". [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 94]
- **Free: 0đ.** [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 98]
- **Pro:** "~42.000đ/tháng nếu trả năm (499.000đ/12 tháng, tiết kiệm 217.000đ) · 179.000đ/quý (~60.000đ/tháng). Gia hạn cộng dồn vào hạn hiện tại." [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 98]
- Tóm tắt điều hành nhắc lại: "Pro ≈ 42.000đ/tháng (trả năm 499.000đ) hoặc 179.000đ/quý; Free giới hạn 8 học sinh, 4 mẫu phiếu, 50MB." [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 5), dòng 38]
- Trang `/pricing` công khai: hero "Trọn bộ Pro miễn phí 30 ngày", bảng so sánh 2 cột Miễn phí/Pro (cột Pro nền xanh nhạt) "với 10 dòng như bảng ở 3.1", dưới là **hai thẻ giá Quý 179.000đ và Năm 499.000đ (nhãn "Tiết kiệm 217.000đ")**, rồi CTA. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.1, dòng 141]
- Trang Gói trong app: "Đơn hàng" chọn **Quý/Năm**, dòng giảm giá, tổng cộng, ghi chú "Cộng dồn vào hạn hiện tại, dùng đến 20/01/2027", nút Thanh toán; có lịch sử thanh toán. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.11, dòng 247]
- **Dùng thử:** "Trọn bộ Pro 30 ngày, không cần thẻ; hết hạn tự về Free, giữ nguyên dữ liệu". [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 99]
- Tài khoản khảo sát: "đang dùng thử Pro 30 ngày, hết hạn 20/10/2026". [Nguồn: báo cáo nội bộ 19/10, mục 2.1, dòng 54]
- Lịch sử thanh toán của tài khoản hiện đúng một dòng "Dùng thử 30 ngày – Thành công"; nút "Thanh toán" "(chưa bấm)". [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 108]

#### 1.B Free vs Pro (chép nguyên bảng, dòng 96–108)

| Hạng mục | Miễn phí | Pro | Nguồn |
|---|---|---|---|
| Giá | 0đ | ~42.000đ/tháng nếu trả năm (499.000đ/12 tháng, tiết kiệm 217.000đ) · 179.000đ/quý (~60.000đ/tháng). Gia hạn cộng dồn vào hạn hiện tại. | mục 3.1, dòng 98 |
| Dùng thử | Trọn bộ Pro 30 ngày, không cần thẻ; hết hạn tự về Free, giữ nguyên dữ liệu | (ô Pro để trống trong báo cáo) | mục 3.1, dòng 99 |
| Học sinh | 8 | Không giới hạn | mục 3.1, dòng 100 |
| Mẫu hoá đơn QR thu học phí | 4 mẫu (Cơ bản, Tối giản, Biên nhận, Chuyên nghiệp…) | Tất cả (thêm Sang trọng, Thân gửi, Bé yêu, Mùa hè, Mùa thu, Trung Thu) | mục 3.1, dòng 101 |
| Lưu trữ tài liệu | 50 MB | 5 GB | mục 3.1, dòng 102 |
| Đính kèm từ Google Drive | Không | Có | mục 3.1, dòng 103 |
| Đối soát chuyển khoản vào học phí | Không | Có – ghi "sắp có" | mục 3.1, dòng 104 |
| Hỗ trợ ưu tiên | Không | Có | mục 3.1, dòng 105 |
| Lớp, buổi, điểm danh · Học phí đã đóng/còn nợ · Báo cáo phụ huynh qua link · Google Calendar + Meet | Có | Có | mục 3.1, dòng 106 |
| Khuyến mãi quan sát được | Banner "Giảm 20% · Chúc mừng ngày phụ nữ Việt Nam 20/10 · tối đa 40.000đ", mã PHU_NU_VN_20_10, hiện trên mọi trang dashboard | (để trống) | mục 3.1, dòng 107 |
| Thanh toán gói | Nút "Thanh toán" (chưa bấm); lịch sử thanh toán hiện dòng "Dùng thử 30 ngày – Thành công" | (để trống) | mục 3.1, dòng 108 |

Mọi ô trên chép đúng chữ của báo cáo. Hai hàng cuối (khuyến mãi, thanh toán) báo cáo đặt chữ ở cột "Miễn phí" dù chúng không phải đặc điểm của riêng Free; tôi giữ nguyên vị trí.

#### 1.C Các chi tiết cho thấy cái gì được dùng để thúc nâng cấp (theo đúng thứ bạn hỏi)

**(a) Hạn mức 8 học sinh**
- "Giới hạn 8 học sinh ở gói Free chính là chốt chặn chuyển đổi: một gia sư có 2 lớp nhóm nhỏ là vượt ngay." [Nguồn: báo cáo nội bộ 19/10, mục 3.1 (Nhận xét), dòng 110]
- Ba nhóm khách hàng Sổ Gia Sư tự khai: (1) gia sư cá nhân dạy tại nhà; (2) "giáo viên tự mở lớp nhóm 5–20 học sinh"; (3) người dạy đa môn nhiều ca. Không nhắm trung tâm nhiều giáo viên. [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 90]
- So sánh: ClassUp Free đến 100 học sinh; báo cáo ghi "Freemium theo số học sinh (100) đúng như Sổ Gia Sư (8) nhưng hào phóng hơn". [Nguồn: báo cáo nội bộ 19/10, mục 4.6, dòng 482 và 484]
- Số "học sinh đang hoạt động" là một thẻ KPI trên Tổng quan (không rõ có phải là biến đếm hạn mức). [Nguồn: báo cáo nội bộ 19/10, mục 3.3.2, dòng 147]

**(b) Mẫu phiếu**
- "Phiếu thu QR là tính năng đinh: 9 mẫu phiếu (4 Free, 5 Pro), QR VietQR sinh từ số tài khoản ngân hàng cấu hình một lần, nội dung chuyển khoản điền sẵn, xuất ảnh để gửi Zalo." [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 3), dòng 34]
- Hộp thoại Phiếu học phí (Hình 17, tiêu đề ghi "9 mẫu"): "Chọn mẫu" lưới 3 cột: "Cơ bản, Tối giản, Biên nhận, Chuyên nghiệp, Sang trọng (nền đen), Thân gửi, Bé yêu (Pro), Mùa hè (Pro), Mùa thu (Pro), Trung Thu (Pro)". [Nguồn: báo cáo nội bộ 19/10, mục 3.3.9, dòng 219 và 221]
- **Ba cách đếm khác nhau trong cùng báo cáo** (cần người viết chọn cách nêu, đừng chép một số): (i) "9 mẫu (4 Free, 5 Pro)" (dòng 34); (ii) danh sách Free 4 + danh sách "thêm" ở Pro 6 tên = 10 (dòng 101); (iii) ở hộp thoại, 10 tên được liệt kê, trong đó chỉ 4 tên đánh dấu "(Pro)", còn 6 tên không đánh dấu (dòng 221). [Nguồn: báo cáo nội bộ 19/10, mục 1, 3.1, 3.3.9, dòng 34, 101, 221]
- Mẫu Pro mang tính trang trí/theo mùa (Bé yêu, Mùa hè, Mùa thu, Trung Thu) và "Sang trọng (nền đen)". [Nguồn: báo cáo nội bộ 19/10, mục 3.1 và 3.3.9, dòng 101 và 221]
- Hàng bảng giá tên là "Mẫu hoá đơn QR thu học phí" và cột Free ghi "4 mẫu"; khi đã cấu hình tài khoản ngân hàng, phiếu thêm mã VietQR đúng số tiền và nội dung chuyển khoản theo tên học sinh (sửa được). [Nguồn: báo cáo nội bộ 19/10, mục 3.1 dòng 101 và mục 3.3.9 dòng 221] [Suy luận: vì vậy QR có vẻ không bị khoá riêng ở Free, chỉ số mẫu giới hạn; báo cáo không nói thẳng điều này.]
- Tuỳ chọn trong hộp phiếu: công tắc "Ẩn chi tiết học phí", "Kèm phiếu báo cáo (Mới)", "Kèm lời nhắn"; "Tạo nhiều phiếu" (Mới), "Gộp phiếu"; xuất hàng loạt bố cục ảnh 1×1/2×2/2×3/3×3. Báo cáo KHÔNG ghi những tính năng này thuộc Free hay Pro. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.9, dòng 217, 221, 223]
- Phiếu thu lưu dạng "Ảnh PNG, không lưu trạng thái 'đã gửi'". [Nguồn: báo cáo nội bộ 19/10, mục 3.4.1, dòng 269]

**(c) Dung lượng**
- Lưu trữ tài liệu: Free 50 MB, Pro 5 GB; Đính kèm từ Google Drive: Free Không, Pro Có. [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 102–103]
- Trang Gói hiện "hạn mức 4 dòng với thanh % dung lượng" (báo cáo không liệt kê 4 dòng là gì). [Nguồn: báo cáo nội bộ 19/10, mục 3.3.11, dòng 247]
- Quản lý tệp: "Thư mục theo lớp học; 'Kho tài liệu' sắp có; thanh dung lượng". [Nguồn: báo cáo nội bộ 19/10, mục 3.2, dòng 125]
- "Lưu trữ tài liệu" là một khối tính năng trên trang chủ. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.1, dòng 139]
- Kết nối Google Drive để "đính kèm không cần tải lại". [Nguồn: báo cáo nội bộ 19/10, mục 3.3.11, dòng 247]

**(d) Đối soát "sắp có" và tính năng bán trước**
- "Đối soát chuyển khoản tự động được quảng cáo 'sắp có' (Pro)." [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 3), dòng 34]
- Điểm nghẽn #10 (bảng 3.5): "Kho tài liệu 'Sắp có'; đối soát chuyển khoản 'Sắp có'" — bằng chứng "Nhãn trong app và pricing" — hệ quả "Hai tính năng đang được bán trước". [Nguồn: báo cáo nội bộ 19/10, mục 3.5 (#10), dòng 307]
- Thu tiền là thao tác thủ công; "app không biết tiền đã về tài khoản hay chưa cho đến khi có 'Đối soát chuyển khoản' (sắp có)". [Nguồn: báo cáo nội bộ 19/10, mục 3.4.3, dòng 282]
- Đối chiếu với nghiên cứu Gemini trước: "'Đối soát chuyển khoản vào học phí' chỉ mới 'sắp có' (Pro)"; "Chưa bên nào trong danh sách làm được không phí; Comiru thu 58¥/giao dịch". [Nguồn: báo cáo nội bộ 19/10, mục 7, dòng 619]
- Lời dặn cho sản phẩm của chủ dự án: "Không hứa 'đối soát tự động' như Sổ Gia Sư đang hứa." [Nguồn: báo cáo nội bộ 19/10, mục 8.4C (Lưu ý), dòng 703]

**(e) Banner khuyến mãi, mã giảm giá, vị trí các lời mời nâng cấp**
- Khung chung: "Trên cùng có thanh khuyến mãi tím, thanh công cụ với nút thu gọn sidebar, nút nền tối, chọn ngôn ngữ (Tiếng Việt/English), avatar + tên + email + nhãn gói (Pro)" (nhãn gói hiện cạnh avatar). [Nguồn: báo cáo nội bộ 19/10, mục 3.2, dòng 114]
- Banner "Giảm 20% · Chúc mừng ngày phụ nữ Việt Nam 20/10 · tối đa 40.000đ", mã `PHU_NU_VN_20_10`, "hiện trên mọi trang dashboard". [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 107]
- Trang Gói: "Ưu đãi dành cho bạn" (thẻ mã giảm giá **tự áp**) + ô nhập mã; thẻ gói hiện tại có ngày hết hạn và cảnh báo "còn 1 ngày"; bảng so sánh Free/Pro. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.11, dòng 247]
- Trang chủ: banner trên cùng "Trải nghiệm trọn bộ Pro miễn phí 30 ngày, không cần thẻ"; hero có ba tick "Có gói miễn phí · Không cần thẻ tín dụng · Dùng được trên điện thoại"; nút "Tạo tài khoản →" (đen) và "Đăng nhập"; header có mục "Bảng giá". [Nguồn: báo cáo nội bộ 19/10, mục 3.3.1, dòng 139]
- Khối tin cậy trên trang chủ: "Dữ liệu của bạn là của riêng bạn" (mục 8 trong thứ tự section); FAQ 10 câu. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.1, dòng 139]
- Báo cáo xếp "Giá rất thấp, trial không cần thẻ, mã giảm giá theo dịp" vào điểm mạnh "đúng tâm lý gia sư cá nhân". [Nguồn: báo cáo nội bộ 19/10, mục 3.6, dòng 325]

**(f) Nhắc hết dùng thử: có hay không**
- Điểm nghẽn #12: "Khuyến mãi hiện mọi trang, trial hết hạn 'còn 1 ngày' nhưng không có nhắc email" — bằng chứng "Banner + trang Gói" — hệ quả "Chuyển đổi dựa vào người dùng tự nhìn thấy". [Nguồn: báo cáo nội bộ 19/10, mục 3.5 (#12), dòng 309]
- **Nhưng** Phụ lục B liệt kê "email/thông báo khi trial hết hạn" trong mục CHƯA KIỂM CHỨNG của Sổ Gia Sư. Vậy "không có nhắc email" ở #12 là suy ra từ việc không thấy, chưa phải xác nhận. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 833]
- Duy nhất nhắc có chứng cứ quan sát được trong app: banner khuyến mãi mọi trang + cảnh báo "còn 1 ngày" trên trang Gói (dòng 107, 247).

**(g) Hỗ trợ ưu tiên và các kênh hỗ trợ miễn phí**
- Hỗ trợ ưu tiên chỉ Pro (dòng 105). Menu "Hỗ trợ" của mọi người dùng: Cài đặt app · Gửi email (support@sogiasu.com) · Nhắn tin Page (Messenger) · Nhóm Zalo. [Nguồn: báo cáo nội bộ 19/10, mục 3.2, dòng 129]

**(h) Những thứ báo cáo cho thấy KHÔNG bị khoá giữa Free và Pro (hoặc không nói)**
- Cùng có ở Free và Pro: lớp, buổi, điểm danh; học phí đã đóng/còn nợ; báo cáo phụ huynh qua link; Google Calendar + Meet. [Nguồn: báo cáo nội bộ 19/10, mục 3.1, dòng 106]
- Báo cáo KHÔNG ghi tầng (Free/Pro) của: Phân tích doanh thu (nhãn "Mới"), Xuất Excel điểm danh (nhãn "Mới"), nút Tải PDF trên trang phụ huynh, ghi âm thành chữ, Tạo nhiều phiếu/Gộp phiếu, xuất phiếu hàng loạt, Chia sẻ lịch, đồng bộ Google Calendar. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.3, 3.3.6, 3.3.8, 3.3.9, 3.3.10, 3.3.12, dòng 153, 191, 211, 217, 223, 235, 253]
- Trang Gói trong app gồm: "Gói hiện tại, hạn mức, so sánh Free/Pro, đơn hàng, mã giảm giá, lịch sử". [Nguồn: báo cáo nội bộ 19/10, mục 3.2, dòng 128]

**(i) Mô hình kinh doanh Sổ Gia Sư theo cách báo cáo mô tả**
- "Không có cổng thanh toán, không thu phí giao dịch." [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 3), dòng 34]
- Tích hợp: "không có Zoom API (chỉ dán link), không có Zalo OA, không có cổng thanh toán, không có API công khai." [Nguồn: báo cáo nội bộ 19/10, mục 3.4.5, dòng 290]
- Kênh phụ huynh dùng Zalo thủ công, "tránh phí tin nhắn" (ClassUp thu 9 KRW/tin Alimtalk; Teachworks bán credit SMS). [Nguồn: báo cáo nội bộ 19/10, mục 3.4.4, dòng 286]
- Không có quản lý nhiều giáo viên/trợ giảng; "trong app không có khái niệm nhân viên/giáo viên thứ hai". [Nguồn: báo cáo nội bộ 19/10, mục 3.1 dòng 90, mục 3.5 (#5) dòng 302]
- Giá Pro "nằm dưới cả ngưỡng 150.000–500.000đ mà nghiên cứu Gemini trước ước tính là 'chấp nhận được' cho cơ sở 25 học sinh". [Nguồn: báo cáo nội bộ 19/10, mục 3.1 (Nhận xét), dòng 110]
- "Sổ Gia Sư định giá 42.000–60.000đ – thấp hơn 3–10 lần, cho thấy họ chọn chiến lược khối lượng (gia sư cá nhân) chứ không phải trung tâm." [Nguồn: báo cáo nội bộ 19/10, mục 7, dòng 621]
- "Giá rẻ hơn mọi đối thủ quốc tế từ 10 đến 50 lần." [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 5), dòng 38]
- Menu và trạng thái nhãn: Sổ Gia Sư có 11 mục menu (so với 13 của TutorBird, 30+ của Teachworks). [Nguồn: báo cáo nội bộ 19/10, mục 4.1 dòng 353 và mục 7 dòng 617]

### Inferences
- [Suy luận] Hạ tầng thanh toán Pro của Sổ Gia Sư không được mô tả (nút "Thanh toán" chưa bấm), nên mọi suy diễn về cách thu tiền (thẻ, QR, ví) là chưa có cơ sở trong báo cáo.
- [Suy luận — tính lại] 499.000 / 12 = 41.583đ (báo cáo ghi "~42.000đ"). 179.000 / 3 = 59.667đ (báo cáo ghi "~60.000đ"). 4 × 179.000 = 716.000đ, trừ 499.000đ = 217.000đ, trùng đúng "tiết kiệm 217.000đ". Nghĩa là mức "tiết kiệm" so với việc trả bốn quý liên tiếp, KHÔNG so với giá tháng (không có giá tháng).
- [Suy luận — tính lại] Ngày: hết dùng thử 20/10/2026 + một quý = 20/01/2027, khớp ghi chú "dùng đến 20/01/2027" (dòng 247), tức gói mua cộng dồn vào hạn đang có.
- [Suy luận — tính lại, chưa kiểm chứng] Banner "Giảm 20% … tối đa 40.000đ": 20% của 179.000đ = 35.800đ (dưới trần), 20% của 499.000đ = 99.800đ (vượt trần, bị chặn ở 40.000đ). Báo cáo không ghi số tiền sau giảm nên đây chỉ là phép tính nếu mã áp lên cả hai gói; không dùng làm số liệu.
- [Suy luận] Cấu trúc "khoá" của Sổ Gia Sư xoay quanh số lượng (8 học sinh), thẩm mỹ (mẫu phiếu), dung lượng (50 MB / 5 GB), và một tính năng chưa giao (đối soát). Không có khoá nào được báo cáo ghi trên lõi sổ lớp. Đây là suy từ bảng ở dòng 96–108, không phải phát biểu của báo cáo.
- [Suy luận] Vì tài khoản khảo sát đang dùng thử Pro, báo cáo chưa ghi: bao nhiêu học sinh thì bị chặn, bị chặn thêm hay chuyển chế độ chỉ đọc, và điều gì xảy ra với 9+ học sinh khi hết dùng thử "tự về Free, giữ nguyên dữ liệu".

### Gaps
- Không có giá theo tháng (gói tháng riêng) của Sổ Gia Sư; không có giá sau giảm; không có phương thức thanh toán gói.
- Không rõ "8 học sinh" đếm học sinh đang học hay tất cả bản ghi (kể cả đã nghỉ); không rõ hành vi khi vượt 8 hoặc khi hết dùng thử với số học sinh hơn 8.
- Không rõ 4 dòng "hạn mức" trên trang Gói gồm gì.
- Không rõ tầng của Phân tích, Xuất Excel, Tải PDF, ghi âm, phiếu hàng loạt (xem 1.C(h)).
- Nội dung FAQ 10 câu không được chép (chỉ có câu xác nhận không có app native).
- Có nhắc email khi hết dùng thử hay không: chưa kiểm chứng (Phụ lục B).
- Không có số liệu chuyển đổi, số người dùng hay doanh thu của Sổ Gia Sư trong báo cáo.

---

## 2. Giá, gói, hạn mức, khoá tính năng của từng đối thủ SaaS (mục 4.1–4.8)

### Takeaway
Cả tám đối thủ SaaS đều tính phí khác Sổ Gia Sư ở đơn vị tính: TutorBird theo giáo viên (một gói phẳng, +4,95 USD/giáo viên), Teachworks theo cặp phí nền tảng cộng phí mỗi học sinh mỗi buổi, Teach 'n Go và Eduspace theo bậc số học viên, ClassUp theo bậc số học sinh cộng tin nhắn trả trước, Comiru theo học sinh/tháng cộng phí giao dịch, TutorCruncher theo ba gói (Pay as you go, Startup, Enterprise). Chỉ ClassUp (Free đến 100 học sinh) và Comiru (gói FREE hạn chế) có tầng miễn phí; Eduspace ghi "Không giới hạn thời gian dùng thử".

### Cited Findings

#### 2.0 Quy ước chung của nhóm này
- "Số liệu 'tự công bố' là từ trang của hãng; review Capterra/G2/Trustpilot chỉ dùng định tính." [Nguồn: báo cáo nội bộ 19/10, mục 4 (Quy ước), dòng 329]
- Quy đổi: 1 USD ≈ 25.500đ, 1 GBP ≈ 33.000đ, 1 EUR ≈ 28.000đ, 1 JPY ≈ 170đ, 1 KRW ≈ 19đ. [Nguồn: báo cáo nội bộ 19/10, mục 4 (Quy ước), dòng 329]

#### 2.1 TutorBird (Port 443 Inc., Canada) — mức tiếp cận: vào trong tài khoản dùng thử
- **Gói và giá:** "Một gói duy nhất 16,95 USD/tháng (~432.000đ), đủ tính năng, không giới hạn học sinh; thêm 4,95 USD/giáo viên; dùng thử 30 ngày không cần thẻ; hoàn tiền 90 ngày; SMS miễn phí; lưu trữ không giới hạn (2GB/file); hosting website miễn phí. Phí cổng Stripe/PayPal do cổng thu." [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 340]
- **Khoá tính năng:** không có tầng nào được nêu; "đủ tính năng" trong một gói. Tính năng gồm: lịch 1-1 và nhóm, nhắc email/SMS, điểm danh với make-up credit, học sinh + gia đình + lead/danh sách chờ, hoá đơn tự động theo lịch, **gói buổi**, **phí trễ hạn**, cổng học viên/phụ huynh (đặt lịch, trả tiền, nộp bài, Study Log/Timer), website builder, tự đặt lịch tư vấn, thư viện cho mượn, chi phí & số dặm, **nhiều giáo viên + trả lương**, Zoom/Skype/FaceTime, báo cáo kinh doanh. [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 341]
- **Gói nhóm/trung tâm:** nhắm gia sư tư nhân, trung tâm dạy kèm, trung tâm luyện thi; thêm giáo viên tính 4,95 USD/giáo viên. [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 339–340]
- **Phí trên mỗi đơn vị:** theo giáo viên (4,95 USD); không phí theo học sinh/buổi; phí cổng thanh toán do Stripe/PayPal thu (không phải TutorBird). [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 340]
- **Cơ chế tính tiền liên quan doanh thu:** ghi nợ gia đình ngay khi lên lịch (30 USD đã bị ghi nợ trước khi dạy); "Gói (prepaid packages)" trống trong tài khoản thử; Gia đình & Hoá đơn có tab Tài khoản gia đình/Hoá đơn/Giao dịch, "Số dư trả trước". [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 381, 391, 395]
- **Tín hiệu thị trường:** Capterra 4,8/5 từ 268 review; khen gộp lịch–hoá đơn–thanh toán, giá hợp lý; chê báo cáo hạn chế, mẫu email/SMS khó tuỳ biến, không undo lịch. Cùng công ty với My Music Staff; "Phần mềm quản lý gia sư số 1 từ 2014" (tự mô tả). [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 339 và 342]
- **Chưa kiểm chứng:** giá 16,95 USD (trang chính) vs 14,95 (blog đối thủ) vs C$/£13,95 (trang phụ); phí Stripe/PayPal áp cho người dùng; app native; trụ sở. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 835]
- Mô tả tính khác biệt lõi: TutorBird coi "gia đình" là đơn vị thanh toán và ghi nợ theo lịch; có cổng tự đặt lịch, make-up credit, trạng thái "Vắng đã thông báo – không tính phí". [Nguồn: báo cáo nội bộ 19/10, mục 4.1 (Lưu ý), dòng 395]
- Điểm danh có 8 trạng thái, mỗi trạng thái ghi rõ có tính phí hay không (5 tính phí, 3 không). [Nguồn: báo cáo nội bộ 19/10, mục 4.1 dòng 371 và mục 6.1 dòng 593]

#### 2.2 Teachworks (Ontario, Canada) — mức tiếp cận: vào trong tài khoản dùng thử
- **Gói và giá (hai thành phần):** "Starter 16,49 USD/tháng + 0,320 USD/học sinh/buổi (~420.000đ + 8.160đ) · Growth 47,99 + 0,189 (có API) · Premium 187,99 + 0,065 (5 chi nhánh, thêm 35 USD/chi nhánh). Không giới hạn học sinh/giáo viên. Dùng thử 21 ngày. Email vượt fair-use 1 USD/1.000. Trang giá còn một bộ số cũ (15/45/175 USD) kèm chữ Lorem ipsum – lấy bộ 16,49 làm chuẩn." [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 406]
- **Ví dụ của báo cáo:** "20 học sinh × 8 buổi = 160 lượt → 67,69 USD/tháng (~1,73 triệu đ)". [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 406]
- **Tác động tới gia sư nhiều học sinh:** "Với 1 gia sư 25 học sinh, chi phí có thể vượt 2 triệu đ/tháng, gấp ~50 lần Sổ Gia Sư"; báo cáo gọi đây là "mô hình phạt cơ sở dạy nhóm hiệu quả". [Nguồn: báo cáo nội bộ 19/10, mục 4.2 (Lưu ý), dòng 440]
- **Khoá/ giới hạn tính năng:** Growth "có API"; Premium có 5 chi nhánh (+35 USD/chi nhánh); email vượt fair-use tính 1 USD/1.000; đồng bộ 2 chiều Google Calendar là "add-on Pro có phí"; đặt lịch online là add-on; SMS mua credit; "70–80 add-on miễn phí". [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 406–407]
- **Giới hạn tài khoản mới:** "Tài khoản mới chỉ được gửi tối đa 100 email mỗi ngày". [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 412]
- **Gói nhóm/trung tâm:** nhắm trung tâm gia sư, trường nhạc, trường lái xe, luyện thi, ngoại ngữ; có Master Account nhiều chi nhánh; "Không nhắm gia sư cá nhân"; có cổng giáo viên/nhân viên/phụ huynh/học sinh, trả lương giáo viên (payslip). [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 405 và 407]
- **Phí trên mỗi đơn vị:** theo học sinh/buổi (0,320 / 0,189 / 0,065 USD tuỳ bậc). [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 406]
- **Cơ chế tính tiền:** Billing Method = Giá niêm yết dịch vụ / Giá theo hồ sơ học sinh / Phí cố định / Gói; ghi đè cách tính tiền theo từng buổi. [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 422 và 407]
- **Tín hiệu thị trường:** Capterra 4,6/5 (67), G2 4,7 (9); chê cài đặt hoá đơn/loại khoá học phức tạp, giao diện lỗi thời, không app native. [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 408]
- **Chưa kiểm chứng:** hai bộ giá trên cùng trang; 45/46 ngôn ngữ; 50/70/80 add-on; "giá SMS và add-on Pro". [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 837]

#### 2.3 Teach 'n Go (EU, teachngo.com) — mức tiếp cận: trang công khai + nguồn chính thức
- **Gói và giá:** "Chính thức chỉ 2 gói: 'Teach 'n Go' 69/tháng (EUR/USD, ~1,93 triệu đ) tối đa 100 học viên live, giáo viên/lớp không giới hạn, trả năm tặng 2 tháng; 'Pro' không công bố giá (AI, nhiều cơ sở, white-label)." [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 450]
- **Giới hạn gói thường:** "100 AI draft, 1.000 email/tháng, 3 admin, 10GB, API chỉ đọc." [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 450]
- **Dùng thử/hoàn tiền:** "Dùng thử 14 ngày không thẻ; hoàn tiền 30 ngày." Landing còn có "bảo đảm hoàn tiền 30 ngày" và "ưu đãi (giảm 25% năm đầu, onboarding miễn phí)". [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 449–450]
- **Dịch vụ trả phí kèm theo:** "onboarding 500 EUR, đào tạo 150 EUR, chuyển dữ liệu 150 EUR". Capterra còn liệt kê 4 gói cũ 69/89/119/219 EUR. [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 450]
- **Gói nhóm/trung tâm:** nhắm học viện, trung tâm, trường ngoại ngữ; 3 admin trong gói thường; gói Pro cho nhiều cơ sở. [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 448 và 450]
- **Phí trên mỗi đơn vị:** theo bậc học viên (tối đa 100 học viên live ở gói 69/tháng); giáo viên/lớp không giới hạn. [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 450]
- **Chưa kiểm chứng:** giá gói Pro; giới hạn học viên Pro; 2 gói (web) vs 4 gói (Capterra). Đơn vị "EUR/USD" của mức 69 không được báo cáo làm rõ; bảng tóm tắt dùng "69 EUR" (dòng 38) và quy ra "~1,93 triệu đ" (khớp tỉ giá EUR). [Nguồn: báo cáo nội bộ 19/10, Phụ lục B dòng 839; mục 1 dòng 38; mục 4.3 dòng 450]
- **Review:** Capterra 4,7/5 (91), "phần lớn 'vendor referred – incentive offered'"; chê "tăng giá". [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 452]

#### 2.4 TutorCruncher (Anh) — mức tiếp cận: trang công khai + nguồn chính thức
- **Gói và giá:** "Pay as you go từ 25 GBP/tháng (~825.000đ, + phí % giao dịch theo nghiên cứu Gemini cũ: 3,85% thẻ, 1% doanh thu offline), Startup từ 60 GBP, Enterprise từ 200 GBP; dùng thử 2 tuần; 3 tháng hỗ trợ ưu tiên; cài đặt trong 1 ngày với trợ giúp." [Nguồn: báo cáo nội bộ 19/10, mục 4.4, dòng 462]
- Phần trăm giao dịch (3,85% thẻ, 1% offline) là **từ nghiên cứu Gemini cũ**, không phải số báo cáo tự xác minh. [Nguồn: báo cáo nội bộ 19/10, mục 4.4, dòng 462]
- **Gói nhóm/trung tâm:** "Nhắm agency/công ty, không nhắm gia sư cá nhân"; được "hơn 1.800 công ty gia sư" tin dùng, "4,8 điểm trên 500+ review (tự công bố)". Cơ chế: Jobs, split invoicing cho agency, theo dõi 1099, cổng gia sư và cổng khách, pay run tự động. [Nguồn: báo cáo nội bộ 19/10, mục 4.4, dòng 460 và 463]
- **Khoá tính năng:** báo cáo không nêu tính năng nào thuộc gói nào (chỉ "3 gói" ở landing). [Nguồn: báo cáo nội bộ 19/10, mục 4.4, dòng 461]

#### 2.5 Comiru (POPER Inc., Nhật) — mức tiếp cận: nguồn chính thức, báo cáo chứng khoán, review
- **Giá:** "Không công bố trên web (gửi tài liệu). Từ báo cáo chứng khoán: BASIC phí khởi tạo 30.000 yên/cơ sở (~5,1 triệu đ) + 300 yên/học sinh/tháng (~51.000đ); ComiruPay 58 yên/giao dịch + 500 yên/tháng/cơ sở; thẻ từ 1,5%; ComiruHR 300 yên/giáo viên; ComiruAir (online) từ 3.000 yên. Gói FREE: đơn đăng ký web, quản lý lead, cảm nhận học thử." [Nguồn: báo cáo nội bộ 19/10, mục 4.5, dòng 471]
- **Quy mô và kinh tế đơn vị (tự công bố, báo cáo FY2025):** "1.939 doanh nghiệp trả phí, 505.000 ID học sinh tính phí, ARR ≈ 1,206 tỷ yên (~205 tỷ đ), ARPU 51.816 yên/khách/tháng, churn 0,6%/tháng, tỷ lệ duy trì ≥99%." Trang chủ: "7.100+ lớp, 510.000+ học sinh (1/2026)". Công ty niêm yết (mã 5134). [Nguồn: báo cáo nội bộ 19/10, mục 4.5, dòng 469–470]
- **Bài học cho VN (báo cáo tự nêu):** "Comiru chứng minh 'báo cáo buổi học gửi phụ huynh qua chat quốc dân' là tính năng giữ chân (retention ≥99%) và sẵn sàng thu 300 yên/học sinh/tháng. Sổ Gia Sư đang làm phiên bản thủ công (ảnh PNG + Zalo) của chính cơ chế này." [Nguồn: báo cáo nội bộ 19/10, mục 4.5, dòng 474]
- **Tính năng hạn chế bởi đóng gói:** quản lý ra vào (thẻ in từ màn quản trị), trích nợ/thẻ, đa cơ sở, chấm công & lương, bảng điểm. Gói theo mô-đun (ComiruPay, ComiruHR, ComiruAir). [Nguồn: báo cáo nội bộ 19/10, mục 4.5, dòng 471–472]
- **Review:** ITreview 3,5/5 (2 review). App phụ huynh App Store 4,3/5 từ 9.803 đánh giá. [Nguồn: báo cáo nội bộ 19/10, mục 4.5, dòng 472–473]
- **Chưa kiểm chứng:** dòng giá 500¥ và 858¥ chưa rõ gói; QR hay thẻ IC; 7.100 lớp (web) vs 1.939 doanh nghiệp (báo cáo) – khác đơn vị. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 841]

#### 2.6 ClassUp (Hàn Quốc) — mức tiếp cận: nguồn chính thức, help center
- **Gói và giá:** "Free 0 won đến 100 học sinh (5 lớp, điểm danh vào/ra, không tích hợp cửa, không thống kê doanh thu, không báo cáo học tập); Lite 29.000 won (~551.000đ) 200 học sinh; Pro 89.000 won (~1,69 triệu đ) 500 học sinh; +5.000 won/100 học sinh. Tin nhắn trả trước: Alimtalk 9 won, SMS 15 won, LMS 39 won; thông báo qua app phụ huynh miễn phí. Kiosk tablet 500.000 won. Tháng đầu dùng Pro miễn phí." [Nguồn: báo cáo nội bộ 19/10, mục 4.6, dòng 482]
- **Khoá tính năng ở Free:** 5 lớp; không tích hợp cửa; không thống kê doanh thu; không báo cáo học tập. [Nguồn: báo cáo nội bộ 19/10, mục 4.6, dòng 482]
- **Nhiều giáo viên:** "Có (Lite+)". [Nguồn: báo cáo nội bộ 19/10, mục 6.1, dòng 596]
- **Cách kiếm tiền (báo cáo tóm lại):** "Freemium theo số học sinh (100) đúng như Sổ Gia Sư (8) nhưng hào phóng hơn, kiếm tiền bằng tin nhắn và kiosk; 'học sinh đến nơi → phụ huynh nhận tin' là lý do phụ huynh ép học viện dùng." [Nguồn: báo cáo nội bộ 19/10, mục 4.6, dòng 484]
- **Quy mô (tự công bố, không ghi năm):** 2.724 học viện, 123.352 học sinh, 1.705 tỷ won giao dịch luỹ kế. [Nguồn: báo cáo nội bộ 19/10, mục 4.6, dòng 483]
- **Chưa kiểm chứng:** "Alimtalk" chưa thấy chữ Kakao trong tài liệu; kiosk Toss Front miễn phí vs tablet 500.000 won; năm của số liệu. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 843]

#### 2.7 Eduspace (Việt Nam) — mức tiếp cận: trang công khai (`/bao-gia`)
- **Giá (tháng, trả năm):** "Small 390.000đ (100 học viên, 10.000 CRM) · Plus 550.000đ (300) · Basic 790.000đ (500) · Premium 1.100.000đ (1.000) · Advance liên hệ. Nhân sự và cơ sở không giới hạn." [Nguồn: báo cáo nội bộ 19/10, mục 4.7, dòng 492]
- **Dùng thử:** "Không giới hạn thời gian dùng thử". [Nguồn: báo cáo nội bộ 19/10, mục 4.7, dòng 490]
- **Nhóm/trung tâm:** nhắm trung tâm ngoại ngữ, năng khiếu, mầm non, gia sư, du học, dạy nghề; nhân sự/cơ sở không giới hạn; lương giáo viên theo bằng cấp/sĩ số/ca, hoa hồng; CRM. [Nguồn: báo cáo nội bộ 19/10, mục 4.7, dòng 490, 492–493]
- **Kênh:** nhắn Zalo miễn phí + SMS. [Nguồn: báo cáo nội bộ 19/10, mục 4.7, dòng 493]
- **So với Sổ Gia Sư:** "Đối thủ VN gần nhất về điểm danh + học phí + Zalo, nhưng đắt gấp ~9 lần gói Pro và nhắm trung tâm (CRM, lương). Không thấy phiếu thu QR; không có review độc lập." [Nguồn: báo cáo nội bộ 19/10, mục 4.7, dòng 494]
- Báo cáo ghi "Đối thủ cùng loại ở Việt Nam gần như trống": Eduspace nhắm trung tâm với giá "390.000đ+". [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 9), dòng 46]

#### 2.8 Shub Classroom (Việt Nam) — mức tiếp cận: đăng nhập vai học sinh; phía giáo viên lấy từ hướng dẫn ĐH Cần Thơ + báo chí
- **Giá:** "Không có bảng giá; giáo viên/học sinh miễn phí theo báo chí; học sinh mua gói hỏi gia sư 300.000đ/15 lượt… ; chân trang nhắc 'gói dịch vụ trả phí'." (dấu "…" là của báo cáo). [Nguồn: báo cáo nội bộ 19/10, mục 4.8, dòng 508]
- **Kết luận của báo cáo:** "Không cùng loại với Sổ Gia Sư: không điểm danh tính phí, không học phí, không phiếu thu, không báo cáo phụ huynh qua link." [Nguồn: báo cáo nội bộ 19/10, mục 4.8, dòng 511]
- **Chưa kiểm chứng:** bảng giá 404; 2.000 trường (web) vs 200+ (2022). [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 845]

#### 2.9 Bảng gộp (chỉ sắp xếp lại số của báo cáo, không đổi số liệu)

| Hãng | Gói/giá (nguyên văn báo cáo) | Đơn vị tính phí | Dùng thử / hoàn tiền | Gói nhóm / trung tâm | Nguồn |
|---|---|---|---|---|---|
| Sổ Gia Sư | Free 0đ; Pro 179.000đ/quý, 499.000đ/năm (~42.000đ/tháng nếu trả năm) | Gói phẳng theo kỳ; Free giới hạn 8 học sinh | Pro 30 ngày không thẻ | Không có (một giáo viên/tài khoản) | mục 3.1, dòng 98–100, 302 |
| TutorBird | 16,95 USD/tháng (~432.000đ), một gói | + 4,95 USD/giáo viên | 30 ngày không thẻ; hoàn tiền 90 ngày | Nhiều giáo viên + trả lương | mục 4.1, dòng 340–341 |
| Teachworks | Starter 16,49 USD + 0,320 USD/HS/buổi; Growth 47,99 + 0,189; Premium 187,99 + 0,065 | Phí nền + theo học sinh/buổi | 21 ngày | Master Account nhiều chi nhánh; Premium 5 chi nhánh (+35 USD/chi nhánh) | mục 4.2, dòng 405–406 |
| Teach 'n Go | 69/tháng (EUR/USD, ~1,93 triệu đ) ≤100 học viên; Pro không công bố | Bậc số học viên; GV/lớp không giới hạn | 14 ngày không thẻ; hoàn tiền 30 ngày | 3 admin (gói thường); Pro nhiều cơ sở | mục 4.3, dòng 450 |
| TutorCruncher | PAYG từ 25 GBP/tháng (~825.000đ); Startup từ 60 GBP; Enterprise từ 200 GBP | Gói + % giao dịch (số của Gemini cũ) | 2 tuần; 3 tháng hỗ trợ ưu tiên | Nhắm agency/công ty | mục 4.4, dòng 460, 462 |
| Comiru | BASIC khởi tạo 30.000 yên/cơ sở + 300 yên/HS/tháng; FREE hạn chế | Theo học sinh/tháng + phí giao dịch + mô-đun | (không nêu) | Đa cơ sở; ComiruHR 300 yên/giáo viên | mục 4.5, dòng 471–472 |
| ClassUp | Free 0 won (≤100 HS); Lite 29.000 won (200 HS); Pro 89.000 won (500 HS); +5.000 won/100 HS | Bậc số học sinh + tin nhắn trả trước | Tháng đầu Pro miễn phí | Nhiều giáo viên từ Lite | mục 4.6, dòng 482; 6.1 dòng 596 |
| Eduspace | Small 390.000đ (100) · Plus 550.000đ (300) · Basic 790.000đ (500) · Premium 1.100.000đ (1.000) · Advance liên hệ (tháng, trả năm) | Bậc số học viên; nhân sự/cơ sở không giới hạn | "Không giới hạn thời gian dùng thử" | Có (trung tâm) | mục 4.7, dòng 490, 492 |
| Shub | Không có bảng giá; GV/HS miễn phí theo báo chí | (không áp dụng) | (không nêu) | Trường học | mục 4.8, dòng 508 |

#### 2.10 Hai hàng của bảng so sánh 6.1 (chép nguyên)
- **Giá tham chiếu/tháng:** Sổ Gia Sư 42.000đ · TutorBird ~432.000đ · Teachworks ~1,7 triệu đ (20 HS×8) · Teach 'n Go ~1,93 triệu đ · TutorCruncher ~825.000đ+ · Comiru ~1,3 triệu đ (25 HS×300¥) · ClassUp 0đ (<100 HS) · Eduspace 390.000đ. [Nguồn: báo cáo nội bộ 19/10, mục 6.1, dòng 599]
- **Nhiều giáo viên:** Sổ Gia Sư Không · TutorBird Có (+4,95 USD/GV) · Teachworks Có, lương · Teach 'n Go Có · TutorCruncher Có, lương · Comiru Có, chấm công · ClassUp Có (Lite+) · Eduspace Có, lương. [Nguồn: báo cáo nội bộ 19/10, mục 6.1, dòng 596]
- **Hoá đơn/phiếu:** Sổ Gia Sư "Phiếu ảnh + QR VietQR, không cổng"; TutorBird "Hoá đơn tự động, Stripe/PayPal"; Teachworks "Hoá đơn, Stripe, QuickBooks"; Teach 'n Go "PayPal/Stripe"; TutorCruncher "Thẻ/chuyển khoản, pay run"; Comiru "ComiruPay 58¥/giao dịch"; ClassUp "VAN/PG"; Eduspace "Thu học phí, Zalo nhắc". [Nguồn: báo cáo nội bộ 19/10, mục 6.1, dòng 594]
- **Kênh phụ huynh:** Sổ Gia Sư "Link công khai + ảnh Zalo"; TutorBird "Cổng + email/SMS"; Teachworks "Cổng + email, SMS credit"; Teach 'n Go "Cổng + app"; TutorCruncher "Cổng khách"; Comiru "App + LINE"; ClassUp "App + Alimtalk"; Eduspace "App + Zalo". [Nguồn: báo cáo nội bộ 19/10, mục 6.1, dòng 595]
- **Bảng đối chiếu Gemini (mục 7), khoảng trống #3:** "Chưa bên nào trong danh sách làm được không phí; Comiru thu 58¥/giao dịch." [Nguồn: báo cáo nội bộ 19/10, mục 7, dòng 619]

### Inferences
- [Suy luận — tính lại] Kiểm số quy đổi của báo cáo: 16,95 × 25.500 = 432.225đ (báo cáo "~432.000đ") đúng; 16,49 × 25.500 = 420.495đ và 0,32 × 25.500 = 8.160đ (báo cáo "~420.000đ + 8.160đ") đúng; 69 EUR × 28.000 = 1.932.000đ (báo cáo "~1,93 triệu đ") đúng nếu 69 là EUR, còn nếu là USD thì 69 × 25.500 = 1.759.500đ; 25 GBP × 33.000 = 825.000đ đúng; 29.000 won × 19 = 551.000đ và 89.000 won × 19 = 1.691.000đ đúng; 30.000 yên × 170 = 5.100.000đ và 300 yên × 170 = 51.000đ đúng; 1,206 tỷ yên × 170 = 205.020.000.000đ (báo cáo "~205 tỷ đ") đúng.
- [Suy luận — tính lại] Ví dụ Teachworks: 16,49 + 160 × 0,32 = 67,69 USD (khớp dòng 406); với 25 học sinh × 8 buổi = 200 lượt: 16,49 + 200 × 0,32 = 80,49 USD ≈ 2.052.495đ, khớp "vượt 2 triệu đ" và ≈ 48,9 lần 42.000đ (báo cáo "~50 lần").
- [Suy luận — tính lại] Ngưỡng đổi bậc Teachworks (báo cáo không nêu): Growth rẻ hơn Starter khi số lượt học sinh/buổi/tháng trên khoảng 240 (31,5 / 0,131 ≈ 240,5); Premium rẻ hơn Growth khi trên khoảng 1.129 lượt (140 / 0,124).
- [Suy luận — tính lại] Hệ số so với 42.000đ: TutorBird 432.000 / 42.000 ≈ 10,3 (khớp "10 lần" ở đầu dải); Eduspace Small 390.000 / 42.000 ≈ 9,3 (khớp "~9 lần"). Con số 6.1 của Comiru "~1,3 triệu đ (25 HS×300¥)" = 7.500 yên × 170 = 1.275.000đ, chưa gồm phí khởi tạo 30.000 yên (~5,1 triệu đ) nên là tháng chạy ổn định, không phải tổng chi phí năm đầu.
- [Suy luận — tính lại, giả định 20 học sinh và 8 buổi/tháng như ví dụ của báo cáo] Mức chi hằng tháng cho một người dạy 20 học sinh: Sổ Gia Sư Pro 41.583–59.667đ (năm/quý); TutorBird 16,95 USD ≈ 432.000đ (1 giáo viên); Teachworks Starter 67,69 USD ≈ 1,73 triệu đ; Eduspace Small 390.000đ; Teach 'n Go 69 (EUR/USD) ≈ 1,76–1,93 triệu đ; ClassUp Free 0đ; Comiru BASIC 20 × 300 yên = 6.000 yên ≈ 1.020.000đ + 30.000 yên khởi tạo một lần. Đây là phép chiếu của tôi, không có trong báo cáo.
- [Suy luận] Bốn kiểu đơn vị tính phí xuất hiện trong nhóm này: theo giáo viên (TutorBird), theo học sinh-buổi (Teachworks), theo bậc học viên (Teach 'n Go, ClassUp, Eduspace), theo học sinh/tháng (Comiru). Sổ Gia Sư là phẳng + giới hạn số học sinh ở Free. Đây là phân loại của tôi dựa trên các dòng 340, 406, 450, 482, 492, 471.
- [Suy luận] Báo cáo cho thấy tầng "miễn phí đúng nghĩa" chỉ có ở ClassUp (≤100 học sinh) và Comiru (gói FREE hạn chế); các hãng còn lại dùng thử có thời hạn (14–30 ngày), riêng Eduspace nói "không giới hạn thời gian dùng thử". Chưa rõ Eduspace dùng thử có hạn chế tính năng/học viên hay không.

### Gaps
- Báo cáo không ghi tính năng nào thuộc gói nào ở TutorCruncher, Comiru (ngoài FREE), Teach 'n Go Pro, Teachworks (ngoài API ở Growth).
- Không có giá Comiru công khai; chỉ có số từ báo cáo chứng khoán (và còn dòng 500¥/858¥ chưa rõ).
- Không có doanh thu/ARR hay số khách của Sổ Gia Sư, TutorBird, Teachworks, Teach 'n Go, TutorCruncher (chỉ Comiru có số kế toán; ClassUp, Eduspace, Shub tự công bố).
- Giá của TutorBird có ba mức khác nhau tuỳ nguồn (16,95 / 14,95 / 13,95).
- "69 EUR/USD" của Teach 'n Go chưa rõ đơn vị.
- Eduspace: báo cáo ghi "Phí dịch vụ" là mục trên menu (dòng 491) nhưng chỉ trích bảng giá `/bao-gia`; không rõ chính sách hoàn tiền/hợp đồng.

---

## 3. Mô hình thu tiền của các sàn (mục 5) và bài học định vị

### Takeaway
Báo cáo thấy ba kiểu thu tiền ở sàn: hoa hồng từ gia sư (Preply, Wyzant, italki, Daykemtainha thu một lần), phí thêm phía học viên (Preply "Processing Fee", Wyzant 9%, Superprof Student Pass), và buổi thử làm phễu. Bài học định vị báo cáo tự nêu cho chủ dự án: không thu hoa hồng, không giữ tiền hộ, không thu phí kết nối ở bất kỳ phía nào, doanh thu duy nhất là gói Pro, mặt sàn chỉ là "mồi" cho SaaS.

### Cited Findings

#### 3.1 Preply (Ukraine/Mỹ) — đã xác minh trên help center, khảo sát sâu phía học viên
- **Hoa hồng gia sư:** "33% → 28% sau 20 giờ → sàn 18% theo tổng giờ tích luỹ; buổi thử đầu với mỗi học viên mới: 100% hoa hồng (gia sư nhận 0). Học viên trả thêm 'Processing Fee' (0,30 USD trong ví dụ)." [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 541]
- **Checkout quan sát được (dừng trước thanh toán):** "27,00 USD + phí xử lý 0,30 USD; huỷ miễn phí trước 12 giờ; thử thêm 2 gia sư miễn phí". [Nguồn: báo cáo nội bộ 19/10, mục 5.1 (Hình 40), dòng 527]
- **Hồ sơ gia sư mẫu:** 45 USD/50 phút; chọn buổi thử 25 phút hoặc 50 phút; "Bạn vẫn còn 2 buổi học thử gia sư miễn phí". [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 521, 523, 537]
- **Buổi thử và thuê bao:** "Buổi thử có phí (27 USD cho gia sư 45 USD/50 phút khi chọn 25 phút); huỷ/dời miễn phí trước 12 giờ; nếu không hợp được thử thêm 2 gia sư miễn phí; thuê bao 28 ngày tối thiểu 4 bài, bài chưa xếp hết hạn khi gia hạn; tài khoản 180 ngày không dùng mất số dư." [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 543]
- **Chống đi ngang:** "cấm trao đổi liên hệ trước khi trả bài đầu, cấm dạy ngoài nền tảng; vi phạm khoá hồ sơ". [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 547]
- **Rút tiền:** "tối đa 3.000 USD/lần qua Wise/PayPal (2%)/Skrill (1%)/Payoneer". [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 547]
- **Huy hiệu liên quan hoa hồng/xếp hạng:** Super Tutor xét hàng tháng trên 90 ngày: "≥40 bài, ≥4,8★, chuyển đổi buổi thử ≥50%, trả lời 80% trong 24h, ≥80% buổi thử trong Preply Classroom". Đăng ký gia sư 8 phần, duyệt 3–5 ngày làm việc. [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 545]
- **Quy mô và uy tín:** 100.000+ gia sư, 180 nước; "Series D 150 triệu USD, định giá 1,2 tỷ USD (1/2026, Bloomberg xác nhận)". Trustpilot 4,4/5 (25.811 review, 13% 1 sao): "phí dịch vụ tăng không báo, bài hết hạn, thuê bao khó đoán; petition về 100% hoa hồng buổi thử". [Nguồn: báo cáo nội bộ 19/10, mục 5.1, dòng 549]
- **Chưa kiểm chứng:** duyệt 3 vs 5 ngày; 33.602 vs 46.278 gia sư tiếng Anh; "bảng bậc hoa hồng đầy đủ là ảnh" (không có trong bản chữ). [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 847]

#### 3.2 Superprof (Pháp; có bản Việt Nam) — khảo sát trực tiếp
- **Mô hình:** "học viên mua 'Student Pass' thuê bao để liên hệ gia sư (39 GBP/tháng Anh, 49 USD/tháng Mỹ; mức VN chưa thấy); gia sư đăng miễn phí, giữ 100% nếu thu trực tiếp, phí 10% nếu thanh toán qua Superprof; bài học đầu thường miễn phí; không hoa hồng buổi học → không có cơ chế chống đi ngang." [Nguồn: báo cáo nội bộ 19/10, mục 5.2, dòng 557]
- **Quy mô:** "~60 triệu EUR doanh thu/năm (phỏng vấn 11/2025), mua Tutors.com 9/2026, không gọi vốn ngoài." [Nguồn: báo cáo nội bộ 19/10, mục 5.2, dòng 557]
- **Trustpilot:** "điểm ẩn do vi phạm, 16% 1 sao, khiếu nại chính về phí 49 USD không rõ và không hoàn tiền." [Nguồn: báo cáo nội bộ 19/10, mục 5.2, dòng 557]
- **Giá hiển thị trên bản Việt Nam:** thẻ gia sư "200.000 VNĐ/giờ · 1 buổi học miễn phí" (quan sát 120.000–200.000đ/giờ). [Nguồn: báo cáo nội bộ 19/10, mục 5.2, dòng 555]
- **Chưa kiểm chứng:** quy mô 13 triệu / 30 triệu / 40 triệu tuỳ nguồn; phí 10% tuỳ chọn vs bắt buộc (Sidehusl); Student Pass VN chưa thấy. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 849]

#### 3.3 Wyzant (Mỹ, thuộc IXL) — khảo sát phía học viên
- **Mô hình:** "gia sư nhận 75%, Wyzant giữ 25% (100% nếu học sinh do gia sư tự giới thiệu); học viên trả thêm 9% phí dịch vụ + thuế, trả sau từng buổi; trả gia sư ngày 1 và 15 qua chuyển khoản; cần SSN/W-9 từ 50 USD; không nhận tiền ngoài nền tảng. Good Fit Guarantee: hoàn giờ đầu với gia sư mới trong 30 ngày." [Nguồn: báo cáo nội bộ 19/10, mục 5.3, dòng 567]
- Câu "(100% nếu học sinh do gia sư tự giới thiệu)" mơ hồ: bảng 6.2 diễn giải rõ là "25% (0% khách tự giới thiệu)". [Nguồn: báo cáo nội bộ 19/10, mục 6.2, dòng 607]
- **Quy mô và uy tín:** "65.000 gia sư, 12+ triệu buổi, 3+ triệu học sinh (tự công bố). Trustpilot 1,6/5 (1.534): tính phí trái ý, hoàn tiền khó, từ chối đơn gia sư không rõ lý do." [Nguồn: báo cáo nội bộ 19/10, mục 5.3, dòng 567]
- **Quan sát giao diện:** hồ sơ mẫu 125 USD/giờ, 5★ 2.081 đánh giá, 1.327 giờ dạy, phản hồi 14 phút, "Giờ đầu được bảo đảm Phù hợp"; dashboard học viên yêu cầu thêm thông tin thanh toán trước khi nhắn gia sư. [Nguồn: báo cáo nội bộ 19/10, mục 5.3 (Hình 43, 44), dòng 561 và 563]
- **Chưa kiểm chứng:** 65.000 (web) vs 500.000 (Wikipedia 2013); Trustpilot biểu đồ 82% 5 sao nhưng điểm 1,6. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 851]

#### 3.4 italki
- "Sàn ngôn ngữ 1-1 + lớp nhóm + cộng đồng miễn phí; 'Start real learning, see clear progress – No subscriptions'". [Nguồn: báo cáo nội bộ 19/10, mục 5.4, dòng 571]
- **Hoa hồng (help center):** "bậc thang buổi thử 0% · buổi lẻ 21% · gói 5 buổi 19% · 10 buổi 17% · 15–20 buổi 15% · lớp nhóm 30%; trang chính sách cũ ghi 15% – mâu thuẫn chưa giải quyết." [Nguồn: báo cáo nội bộ 19/10, mục 5.4, dòng 571]
- **Phía học viên:** trả bằng italki Credits (~1 USD); "buổi thử giảm ~50% tối đa 3 lần"; chọn italki Classroom/Zoom. [Nguồn: báo cáo nội bộ 19/10, mục 5.4, dòng 571]
- **Gia sư:** Professional cần CELTA/TESOL 120h/bằng sư phạm; đơn duyệt 10 ngày, onboarding 15 ngày; mở đơn theo ngôn ngữ hàng tuần (tiếng Việt đang đóng tuần 19–25/10/2026). [Nguồn: báo cáo nội bộ 19/10, mục 5.4, dòng 571]
- **Quy mô/uy tín:** 20.000–30.000 giáo viên, 150+ ngôn ngữ, 10+ triệu học viên (tự công bố). Trustpilot 4,4/5 (15.019). [Nguồn: báo cáo nội bộ 19/10, mục 5.4, dòng 571]
- **Chưa kiểm chứng:** 15% (chính sách cũ) vs 15–30% (help center); 20.000 vs 30.000 giáo viên; sàn giá 4 vs 5 USD. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 853]

#### 3.5 Daykemtainha.vn (Trung tâm gia sư Tài Năng Trẻ, TP.HCM)
- **Mô hình:** "môi giới thu một lần phí nhận lớp từ gia sư (25% học phí tháng đầu cho năng khiếu/ngoại ngữ, 25–30% môn văn hoá theo hợp đồng mẫu; nút trên thẻ hiện 10–25%) đóng trước khi nhận Giấy giới thiệu; hoàn 100% nếu phụ huynh từ chối, giữ 10% nếu lỗi gia sư chưa nhận lương, không hoàn nếu vi phạm; hợp đồng kết thúc sau tháng đầu." [Nguồn: báo cáo nội bộ 19/10, mục 5.5, dòng 577]
- **Thẻ lớp mẫu:** "Mã lớp 27432, 'Học phí: 150,000/Buổi', nút xanh 'phí: 25% (300,000) Nhận lớp ngay'", tuần học 2 buổi, 90 phút/buổi. [Nguồn: báo cáo nội bộ 19/10, mục 5.5, dòng 575]
- Phụ huynh đăng yêu cầu có thể nhập "mã khuyến mãi giảm 200.000đ"; yêu cầu được kiểm duyệt. Không có lịch, thanh toán, rating trên thẻ, không có điều khoản chống đi ngang. [Nguồn: báo cáo nội bộ 19/10, mục 5.5, dòng 577]
- **Bối cảnh:** "bối cảnh ngành có nhiều cảnh báo lừa 'phí nhận lớp' (Tuổi Trẻ 2021)"; FAQ ghi 4 tài khoản ngân hàng đứng tên cá nhân; "Không tìm thấy khiếu nại trực tiếp". [Nguồn: báo cáo nội bộ 19/10, mục 5.5, dòng 577]
- **Chưa kiểm chứng:** phí 25–30% (hợp đồng) vs 10–25% (thẻ lớp); Điều 7 có hai cách đọc; số ĐKKD chưa tra. [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 855]

#### 3.6 Snapask, Ruangguru (số cũ)
- Snapask: "2020: 3 triệu học viên, 2+ triệu câu hỏi/tháng, ~60 câu/người thuê bao/tháng, 350.000 đơn gia sư, gia sư ~2 giờ/ngày kiếm ~1.200 USD/tháng; vòng B 35 triệu USD". Không có số mới hơn. [Nguồn: báo cáo nội bộ 19/10, mục 5.6, dòng 581]
- Ruangguru: "nền tảng học theo gói, không phải sàn thuần; 2021: 22+ triệu học viên, 300.000 giáo viên đối tác, có lãi 2020, tổng vốn 200+ triệu USD; 2022 sa thải hàng trăm người, chuyển sang học lai với 100+ Learning Centers". [Nguồn: báo cáo nội bộ 19/10, mục 5.6, dòng 583]

#### 3.7 Bảng tóm tắt mô hình thu tiền của báo cáo (6.2, chép nguyên)

| Sàn | Ai trả nền tảng | Mức | Buổi thử | Chống đi ngang | Thẻ gia sư hiển thị |
|---|---|---|---|---|---|
| Preply | Gia sư (hoa hồng) + học viên (phí xử lý) | 33%→18%; 100% buổi thử | Có phí, huỷ trước 12h, đổi 2 gia sư miễn phí | Cấm liên hệ trước khi trả; khoá hồ sơ | Giá/bài, ★ + số review, số HS, số bài, huy hiệu, video |
| Superprof | Học viên (Student Pass 39 GBP/49 USD) | 0% nếu thu trực tiếp; 10% nếu qua sàn | Thường miễn phí | Không có | Giá/giờ, ★ + số review, "Gia sư mới", 1 buổi miễn phí |
| Wyzant | Gia sư 25% + học viên 9% | 25% (0% khách tự giới thiệu) | Giờ đầu hoàn tiền (Good Fit) | Cấm nhận tiền ngoài; trả 1 & 15 hàng tháng | Giá/giờ, ★ + review, giờ dạy, phản hồi, InstantBook |
| italki | Gia sư theo gói | 15–30% (buổi thử 0%) | Giảm ~50%, tối đa 3 | Credits trong sàn | Giá, ★, số buổi, Professional/Community, id verified |
| Daykemtainha | Gia sư một lần | 10–30% học phí tháng đầu | Không | Thu phí trước thay cho hợp đồng | Không giá, không rating; thẻ LỚP có học phí/buổi + phí nhận lớp |

[Nguồn: báo cáo nội bộ 19/10, mục 6.2, dòng 603–609]

#### 3.8 Bài học định vị mà BÁO CÁO TỰ NÊU
- Tóm tắt: "Sàn trung gian quốc tế vận hành bằng hoa hồng rất cao và lấy 'buổi thử' làm phễu: Preply 33%→18% + 100% buổi thử + phí xử lý phía học viên; Wyzant 25% gia sư + 9% học viên; italki 15–30% theo gói; Superprof thu học viên 'Student Pass' (49 USD/tháng ở Mỹ) và miễn hoa hồng; Daykemtainha thu gia sư 10–30% học phí tháng đầu một lần, không có cơ chế quản lý lớp." [Nguồn: báo cáo nội bộ 19/10, mục 1 (phát hiện 10), dòng 48]
- **Không hoa hồng:** quyết định 1 của chủ dự án: "Không thu hoa hồng, không giữ tiền hộ, không xếp lịch hộ – khác hẳn Preply/Wyzant/Daykemtainha." [Nguồn: báo cáo nội bộ 19/10, mục 8.1 (hàng 1), dòng 631]
- **Không thu phí kết nối ở bất kỳ phía nào:** "Sàn kiểu này khác Daykemtainha (thu 10–30% học phí tháng đầu) và Superprof (bán Student Pass cho học viên): bạn không thu phí kết nối ở bất kỳ phía nào. Doanh thu duy nhất là gói Pro. Điều này hợp với việc chưa có pháp nhân, nhưng cũng có nghĩa mặt sàn chỉ là 'mồi' cho SaaS – cần đo đúng chỉ số (mục 8.8)." [Nguồn: báo cáo nội bộ 19/10, mục 8.2.2 (Lưu ý), dòng 652]
- **Phía học viên/phụ huynh không trả và không cần tài khoản:** vai "Phụ huynh / học sinh (khách)": "Không đặt lịch, không thanh toán, không đánh giá công khai (giai đoạn 1) – tránh gánh nặng kiểm duyệt khi chưa có pháp nhân." [Nguồn: báo cáo nội bộ 19/10, mục 8.2.1, dòng 643]
- **Pháp lý khi không thu hoa hồng:** "chừng nào không thu tiền hộ, không giữ tiền, không hưởng hoa hồng thì bạn chỉ là nền tảng đăng thông tin … Khi có pháp nhân, xem lại Nghị định 52/2013 về sàn TMĐT nếu bắt đầu thu phí kết nối." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 761]
- **Không có cơ chế chống đi ngang cần thiết khi không hoa hồng:** Superprof "không hoa hồng buổi học → không có cơ chế chống đi ngang"; Daykemtainha "thu phí trước thay cho hợp đồng". [Nguồn: báo cáo nội bộ 19/10, mục 5.2 dòng 557 và mục 6.2 dòng 609]
- **Lợi thế dữ liệu thật thay cho đánh giá sao:** hồ sơ công khai "sinh từ dữ liệu vận hành thật (số buổi đã dạy, tỷ lệ đúng hẹn), đây là lợi thế không sàn nào có"; "Chỉ số tự động là thứ sàn khác không có"; giai đoạn 1 không có đánh giá sao công khai. [Nguồn: báo cáo nội bộ 19/10, mục 8.1 hàng 1 dòng 631; mục 8.3 dòng 661; mục 8.4D bước 5 dòng 715]
- **Buổi thử ở sàn:** Preply buổi thử có phí và 100% hoa hồng; italki buổi thử 0% hoa hồng và học viên giảm ~50% tối đa 3 lần; Superprof "1 buổi học miễn phí"; Wyzant hoàn giờ đầu (Good Fit); Daykemtainha không có. [Nguồn: báo cáo nội bộ 19/10, mục 6.2, dòng 605–609]. Báo cáo KHÔNG đưa ra một "bài học buổi thử" riêng cho chủ dự án; thiết kế mục 8 không có cơ chế buổi thử.
- **Bài học từ SaaS phụ huynh-giữ-chân:** Comiru: báo cáo buổi học qua chat là tính năng giữ chân; ClassUp: "học sinh đến nơi → phụ huynh nhận tin" là lý do phụ huynh ép học viện dùng. [Nguồn: báo cáo nội bộ 19/10, mục 4.5 dòng 474 và mục 4.6 dòng 484]
- **Phí phía học viên gây phản ứng:** Trustpilot: Preply "phí dịch vụ tăng không báo, bài hết hạn, thuê bao khó đoán" (dòng 549); Superprof "phí 49 USD không rõ và không hoàn tiền" (dòng 557); Wyzant "tính phí trái ý, hoàn tiền khó" (dòng 567). [Nguồn: báo cáo nội bộ 19/10, mục 5.1, 5.2, 5.3, dòng 549, 557, 567] (báo cáo ghi nhận các khiếu nại; KHÔNG rút ra "bài học" tường minh.)
- **Ngành có nghi ngờ "phí nhận lớp":** "bối cảnh ngành có nhiều cảnh báo lừa 'phí nhận lớp' (Tuổi Trẻ 2021)". [Nguồn: báo cáo nội bộ 19/10, mục 5.5, dòng 577]

### Inferences
- [Suy luận] Theo dữ kiện báo cáo ghi, Preply (33%→18%), Wyzant (25%), italki (15–30%) thu % từ gia sư; Daykemtainha thu % một lần trên học phí tháng đầu; Superprof thu thuê bao phía học viên (Student Pass) và 10% nếu thanh toán qua sàn; Preply (phí xử lý) và Wyzant (9%) còn thu thêm phía học viên. Trong những gì báo cáo ghi, không sàn nào bán gói phần mềm quản lý cho gia sư; đó là chỗ báo cáo đặt sản phẩm của chủ dự án đứng (8.2.2: "Doanh thu duy nhất là gói Pro").
- [Suy luận — tính lại] Thẻ Daykemtainha: 25% × (150.000đ × 2 buổi/tuần × 4 tuần = 1.200.000đ) = 300.000đ, khớp "phí: 25% (300,000)"; nên phí được tính trên học phí tháng đầu với giả định 8 buổi/tháng (báo cáo không nói giả định này).
- [Suy luận — tính lại] Preply: trong ví dụ gia sư 45 USD/50 phút, nửa giá 25 phút sẽ là 22,50 USD, nhưng báo cáo ghi giá buổi thử 25 phút là 27,00 USD; báo cáo không giải thích chênh lệch, nên đừng khái quát thành "buổi thử giảm giá".
- [Suy luận] Điểm khiếu nại chung của người dùng sàn (phí tăng không báo, phí không rõ, hoàn tiền khó) cho thấy minh bạch phí là điểm yếu của nhóm này; chưa có phát biểu tương ứng của báo cáo.
- [Suy luận] Báo cáo coi KiN/sản phẩm của chủ dự án không có luồng thu tiền từ sàn; do đó mọi bài học "hoa hồng/phí học viên" ở đây chủ yếu là bối cảnh định vị ("khác biệt") chứ không phải đòn bẩy doanh thu cho Pro.

### Gaps
- Không có giá của gói "Pro" cho người dạy ở bất kỳ sàn nào (không có sàn bán gói người dạy); Superprof Student Pass bản Việt Nam chưa thấy giá.
- Bảng bậc hoa hồng đầy đủ của Preply là ảnh, không có trong bản chữ.
- Snapask/Ruangguru số cũ (2020–2022), không có mô hình hoa hồng chi tiết.
- italki và Daykemtainha có hai mức phí mâu thuẫn trong chính nguồn (Phụ lục B).
- Không có số liệu chuyển đổi buổi thử → trả tiền của các sàn (ngoài tiêu chí Super Tutor "chuyển đổi buổi thử ≥50%").

---

## 4. Mười hai điểm nghẽn của Sổ Gia Sư (3.5 / 8.6) và mỗi điểm có thể thành cơ hội Pro hay không

### Takeaway
Báo cáo có hai bảng "12 điểm nghẽn" khác nhau: bảng 3.5 (quan sát, xếp theo mức ảnh hưởng, 12 mục) và bảng 8.6 (xử lý trong sản phẩm của chủ dự án, 12 mục, cũng được gọi "12 điểm nghẽn ở mục 3.6"); 8 mục trùng nội dung (khác số thứ tự ở 5 mục), 2 mục của 3.5 (#4, #10) bị tách/gộp sang 8.6 #3 và #7, 2 mục chỉ có ở 3.5 (#11, #12), 3 mục chỉ có ở 8.6 (#4, #5, #11). Trong các xử lý của báo cáo, chỉ HAI mục được gắn rõ với Pro: xuất PDF bảng điểm danh (8.6 #12, 8.5) và OCR ảnh chuyển khoản (8.5, giai đoạn 2); hàng "Trợ giảng / giáo viên thứ hai" của bảng 8.5 được đặt ở cột Pro nhưng ghi "Chưa làm ở giai đoạn 1". Phần "cơ hội Pro" bên dưới là suy luận của tôi, đánh dấu riêng.

### Cited Findings

#### 4.A Bảng 3.5 (chép nguyên: điểm nghẽn, mức, bằng chứng, hệ quả)
Xếp theo mức ảnh hưởng (báo cáo). [Nguồn: báo cáo nội bộ 19/10, mục 3.5, dòng 294–309]

| # | Điểm nghẽn / lưu ý | Mức | Bằng chứng | Hệ quả cho người dùng |
|---|---|---|---|---|
| 1 | Phí chỉ phát sinh khi bấm "Đã dạy xong"; không có nhắc tự động | Cao | Banner vàng trong buổi; khối "Buổi chưa hoàn thành" | Quên chốt → thiếu phí, thiếu báo cáo; cuối tháng phải chốt dồn |
| 2 | Hình thức học phí khoá cứng sau khi tạo lớp | Cao | Cảnh báo ở bước 1; hộp Sửa lớp chỉ hiển thị | Đổi từ theo buổi sang theo tháng phải tạo lớp mới |
| 3 | Trang phụ huynh lọc theo ngày, không theo trạng thái | Trung bình | Hình 26: "Chưa có buổi học nào" dù 20/10 Hoàn thành | Chốt sớm/dạy bù → phụ huynh không thấy |
| 4 | Không có vòng phản hồi phụ huynh (đã xem/đã trả) | Cao | Link công khai, ảnh PNG, không có app | Giáo viên vẫn phải hỏi tay; đối soát "sắp có" |
| 5 | Một giáo viên/tài khoản; không có trợ giảng, không phân quyền | Trung bình | Không có menu nhân sự | Lớp nhóm có 2 người dạy hoặc trung tâm nhỏ không dùng được |
| 6 | Không có app native, PWA phụ thuộc trình duyệt | Trung bình | FAQ + menu "Cài đặt app" trỏ blog | Khó dùng ghi âm nhận xét, thông báo đẩy trên iOS |
| 7 | Link báo cáo công khai không mật khẩu, slug đoán được (/report/tên-gv/tên-hs) | Trung bình | URL tạo ra | Rủi ro riêng tư nếu tên phổ biến; chỉ có cách Tắt chia sẻ |
| 8 | Điểm danh tháng chỉ xuất Excel, không PDF; trang chủ hứa "Tải PDF" chỉ ở trang phụ huynh | Thấp | Nút Xuất Excel | Nhu cầu in bảng điểm danh gửi trung tâm |
| 9 | Phí khác không gắn kỳ → hiện ở mọi tháng trong Phân tích | Thấp | Dòng giải thích dưới biểu đồ | Số "chưa thu" theo tháng bị lặp |
| 10 | Kho tài liệu "Sắp có"; đối soát chuyển khoản "Sắp có" | Thấp | Nhãn trong app và pricing | Hai tính năng đang được bán trước |
| 11 | Màn hình rộng tối thiểu ~1040px mới giữ 2 cột; sidebar thu gọn thủ công | Thấp | Khi thu nhỏ cửa sổ | Trên tablet ngang vẫn ổn, điện thoại dọc cần kiểm tra thêm |
| 12 | Khuyến mãi hiện mọi trang, trial hết hạn "còn 1 ngày" nhưng không có nhắc email | Thấp | Banner + trang Gói | Chuyển đổi dựa vào người dùng tự nhìn thấy |

#### 4.B Bảng 8.6 (chép nguyên: điểm nghẽn → cách xử lý → giai đoạn)
[Nguồn: báo cáo nội bộ 19/10, mục 8.6, dòng 742–757]

| # | Điểm nghẽn quan sát được (báo cáo ghi "mục 3.6") | Xử lý | Giai đoạn |
|---|---|---|---|
| 1 | Quên bấm "Đã dạy xong" → không phí, không báo cáo | Khối "quá hạn chưa chốt" ở trang chủ + chốt cả lớp một chạm + email nhắc tuần | 1 |
| 2 | Hình thức học phí khoá cứng sau khi tạo lớp | Cho đổi, áp dụng cho buổi chưa chốt; buổi đã chốt giữ nguyên | 1 |
| 3 | Không có đối soát chuyển khoản (mới hứa) | Ảnh chuyển khoản gắn phiếu (8.4C) | 1 → OCR ở 2 |
| 4 | Không nhắc lịch phụ huynh/học sinh | Giữ thủ công theo quyết định 2; thêm "Gửi lịch tuần qua Zalo" một chạm (ảnh lịch tuần) | 1 |
| 5 | Chỉ 3 trạng thái buổi, không có dạy bù | 5 trạng thái + liên kết buổi bù ↔ buổi gốc | 1 |
| 6 | Không quản lý trợ giảng/nhiều giáo viên | Chưa làm; đo nhu cầu bằng câu hỏi trong app | 3 |
| 7 | Link báo cáo ai có cũng xem, không biết phụ huynh đã xem | PIN tuỳ chọn + dấu đã xem | 1 |
| 8 | Bug: trang phụ huynh lọc ngày ≤ hôm nay | Lọc theo trạng thái | 1 |
| 9 | Không có app native, PWA chưa có thông báo đẩy | PWA + Web Push cho gia sư (nhắc chốt buổi, có yêu cầu mới); phụ huynh vẫn Zalo | 2 |
| 10 | Phí khác không gắn kỳ, không thu trước | Phí khác theo kỳ + gói N buổi trừ dần | 2 |
| 11 | Không tìm được gia sư mới từ sản phẩm | Mặt sàn (8.4D) | 2 |
| 12 | Bảng điểm danh tháng không xuất PDF | Xuất PDF (Pro) | 1 |

#### 4.C Các chỗ lệch giữa hai bảng và lệch tham chiếu nội bộ của báo cáo
- Báo cáo tự gọi bảng 8.6 là xử lý "12 điểm nghẽn ở mục 3.6 (bảng 8.6)" (dòng 648), nhưng mục 3.6 là "Điểm mạnh đáng học"; bảng điểm nghẽn nằm ở **mục 3.5**. Tóm tắt điều hành cũng trỏ "chi tiết mục 3.6" (dòng 42). [Nguồn: báo cáo nội bộ 19/10, mục 1 dòng 42, mục 3.6 dòng 311, mục 8.2.2 dòng 648, mục 8.6 dòng 744]
- Mục 8.4E viết "(bug quan sát ở mục 3.4)" cho lỗi lọc ngày của trang phụ huynh; lỗi này thực sự mô tả ở mục 3.3.12 (dòng 255) và bảng 3.5 #3. [Nguồn: báo cáo nội bộ 19/10, mục 8.4E, dòng 719; mục 3.3.12, dòng 255]
- Mục 8.5 viết "nghẽn #12" cho xuất PDF; số #12 đúng theo bảng 8.6, còn bảng 3.5 đánh số PDF là #8. [Nguồn: báo cáo nội bộ 19/10, mục 8.5 dòng 737; mục 8.6 dòng 757; mục 3.5 dòng 305]
- Mục 8.4E viết "nghẽn #7" cho PIN (đúng theo cả hai bảng, #7). [Nguồn: báo cáo nội bộ 19/10, mục 8.4E, dòng 721]
- **Ánh xạ giữa hai bảng (do tôi lập từ nội dung từng dòng):**

| 3.5 | 8.6 | Ghi chú |
|---|---|---|
| #1 | #1 | Cùng nội dung |
| #2 | #2 | Cùng nội dung |
| #3 (lọc ngày) | #8 | Cùng nội dung, khác số |
| #4 (vòng phản hồi: đã xem/đã trả) | #3 (đối soát) và #7 (đã xem) | 3.5 #4 gộp hai ý mà 8.6 tách |
| #5 (một giáo viên) | #6 | Khác số |
| #6 (không native) | #9 | Khác số |
| #7 (link công khai) | #7 | Cùng số, 8.6 #7 gộp thêm "không biết phụ huynh đã xem" |
| #8 (PDF) | #12 | Khác số |
| #9 (phí khác không gắn kỳ) | #10 | 8.6 #10 thêm "không thu trước" |
| #10 (Kho tài liệu/đối soát "Sắp có") | #3 (phần đối soát) | Phần "Kho tài liệu" không có xử lý ở 8.6 |
| #11 (màn hình rộng ~1040px) | (không có) | Không xuất hiện ở 8.6 |
| #12 (khuyến mãi/trial không nhắc email) | (không có) | Không xuất hiện ở 8.6 |
| (không có) | #4 (không nhắc lịch PH/HS) | Chỉ xuất hiện ở 8.6 (và nhắc ngắn ở mục 1 dòng 42) |
| (không có) | #5 (3 trạng thái buổi, không dạy bù) | Chỉ ở 8.6 (cũng ở mục 8.3 dòng 664) |
| (không có) | #11 (không tìm được gia sư mới từ sản phẩm) | Chỉ ở 8.6 |

#### 4.D Mỗi điểm nghẽn có được báo cáo gắn với Pro hay không (chỉ dữ kiện của báo cáo)

| Điểm nghẽn (theo số 8.6, kèm số 3.5 nếu khác) | Báo cáo gắn với Pro/Free thế nào | Nguồn |
|---|---|---|
| #1 quên chốt buổi (3.5 #1) | Xử lý ở giai đoạn 1; KHÔNG nằm trong bảng gói 8.5 (tức không nêu như khoá Pro). Mục 8.2.2 coi vòng lặp lõi "không nên thay đổi về bản chất; chỉ sửa 12 điểm nghẽn". | mục 8.5 dòng 729–738; mục 8.2.2 dòng 648 |
| #2 học phí khoá cứng (3.5 #2) | Giai đoạn 1, không gắn Pro. Mục 8.3: "Mở khoá loại phí có kiểm soát (nghẽn #2)". | mục 8.6 dòng 747; mục 8.3 dòng 662 |
| #3 đối soát chuyển khoản (3.5 #4, #10) | hàng "Ảnh chuyển khoản / đối soát thủ công" của bảng 8.5: Free "Có"; Pro "Có + OCR khi có (giai đoạn 2)". Đây là chỗ báo cáo tách Free/Pro rõ nhất cho đối soát. | mục 8.5 dòng 734; mục 8.6 dòng 748 |
| #4 không nhắc lịch PH/HS | Giữ thủ công (theo quyết định 2: không ZNS/SMS/app phụ huynh), thêm "Gửi lịch tuần qua Zalo" một chạm; không gắn Pro. "Gửi Zalo một chạm" nằm ở bảng 8.5 là Free: Có, Pro: Có. | mục 8.6 dòng 749; mục 8.5 dòng 736 |
| #5 chỉ 3 trạng thái buổi | 5 trạng thái + dạy bù, giai đoạn 1; không gắn Pro. | mục 8.6 dòng 750 |
| #6 trợ giảng/nhiều giáo viên (3.5 #5) | Bảng 8.5 hàng Pro: "Chưa làm ở giai đoạn 1 – để sau nếu dữ liệu cho thấy cần (TutorBird thu 4,95 USD/giáo viên thêm)"; 8.6 giai đoạn 3: "Chưa làm; đo nhu cầu bằng câu hỏi trong app". | mục 8.5 dòng 738; mục 8.6 dòng 751 |
| #7 link công khai / không biết PH đã xem (3.5 #7) | PIN tuỳ chọn + dấu "phụ huynh đã xem lúc …"; giai đoạn 1; không gắn Pro. | mục 8.6 dòng 752; mục 8.4E dòng 721 |
| #8 bug lọc ngày (3.5 #3) | Giai đoạn 1; lỗi, không gắn Pro. | mục 8.6 dòng 753 |
| #9 không native/PWA không push (3.5 #6) | "PWA + Web Push cho gia sư (nhắc chốt buổi, có yêu cầu mới); phụ huynh vẫn Zalo"; giai đoạn 2; không có trong bảng 8.5. | mục 8.6 dòng 754 |
| #10 phí khác không gắn kỳ, không thu trước (3.5 #9) | "Phí khác theo kỳ + gói N buổi trừ dần", giai đoạn 2; mục 8.3 nói gói buổi "như TutorBird Packages"; không gắn Pro. | mục 8.6 dòng 755; mục 8.3 dòng 666 |
| #11 không tìm được gia sư từ sản phẩm | Mặt sàn giai đoạn 2. Bảng 8.5: "Hồ sơ công khai + nhận yêu cầu": Free "Có (đã chốt: miễn phí cho mọi gia sư)"; Pro "Có + ưu tiên hiển thị + huy hiệu 'Hoạt động'". Mục 8.4D bước 1: sắp xếp mặc định "theo 'đang hoạt động' (có buổi chốt trong 30 ngày) rồi theo gói Pro". | mục 8.6 dòng 756; mục 8.5 dòng 735; mục 8.4D dòng 707 |
| #12 xuất PDF bảng điểm danh (3.5 #8) | **Gắn rõ với Pro:** "Xuất PDF (Pro)". Bảng 8.5: "Xuất Excel/PDF": Free "Excel"; Pro "Excel + PDF (bảng điểm danh tháng, nghẽn #12)". | mục 8.6 dòng 757; mục 8.5 dòng 737 |
| 3.5 #10 Kho tài liệu / đối soát "sắp có" (bán trước) | Báo cáo dặn không hứa "đối soát tự động"; không có xử lý cho Kho tài liệu. | mục 8.4C dòng 703 |
| 3.5 #11 màn hình ~1040px | Không có xử lý ở mục 8. | mục 8.6 dòng 744–757 |
| 3.5 #12 trial không nhắc email, khuyến mãi mọi trang | Không có xử lý/nhận xét ở mục 8 về chuyển đổi sang Pro (xem 8.8: không có chỉ số chuyển đổi Free→Pro nào ngoài điều kiện bật Pro). | mục 8.8 dòng 777–781 |

### Inferences
- [Suy luận] Chỉ #12 (xuất PDF) và phần OCR của #3 là hai "đòn Pro" mà báo cáo tự đặt ra từ điểm nghẽn. Các điểm nghẽn còn lại báo cáo xử lý như sửa lỗi hoặc lõi sổ lớp ở giai đoạn 1–2 mà không gắn khoá Pro. Vì báo cáo cũng nói hạn mức Free (8/4/50MB) là "tham chiếu Sổ Gia Sư" (dòng 634), phần lớn đòn Pro của mục 8 vay từ chính Sổ Gia Sư chứ không rút từ điểm nghẽn.
- [Suy luận] Điểm nghẽn #9 (Web Push) và #1 (nhắc chốt buổi) gắn chặt nhau trong báo cáo (Push cho "nhắc chốt buổi"); đây là loại tính năng có chi phí biên (hạ tầng gửi), nhưng báo cáo không nói giá hay hạn mức cho Push.
- [Suy luận] #6 (trợ giảng/nhiều giáo viên) là cơ hội Pro duy nhất mà báo cáo nêu theo kiểu "giá theo đầu người" (tham chiếu TutorBird 4,95 USD/giáo viên); báo cáo hoãn đến giai đoạn 3 và dựa vào dữ liệu.
- [Suy luận] #11 (mặt sàn) có Pro-hook "ưu tiên hiển thị + huy hiệu 'Hoạt động'": báo cáo đặt thứ tự xếp theo "đang hoạt động" trước rồi theo gói Pro (dòng 707), nhưng cũng nói trang tìm gia sư chỉ bật khi khu vực có ≥ 30 hồ sơ đang hoạt động (dòng 765); cần ≥ 30 hồ sơ/thành phố thì "ưu tiên hiển thị" mới có nghĩa. Đánh dấu: mối liên hệ này là suy luận của tôi.
- [Suy luận] #12 của bảng 3.5 (trial không nhắc email, khuyến mãi mọi trang) là điểm nghẽn về chuyển đổi duy nhất trong bảng, nhưng không có trong 8.6; báo cáo không đề xuất cách KiN xử lý.
- [Suy luận] #8 (bug lọc ngày) và #3 (đối soát) là hai điểm mà tài liệu KiN cho thấy đã khác (xem câu hỏi 8): ke-hoach-phat-trien-tu-research.md §2 hàng "lỗi lọc theo ngày" và hàng "TT-200" cho thấy KiN đã đi một đường khác.

### Gaps
- Báo cáo không ước lượng số gia sư bị ảnh hưởng bởi từng điểm nghẽn, không có dữ liệu về mức độ liên quan đến việc ngừng dùng hoặc chuyển đổi.
- Các mức (Cao/Trung bình/Thấp) ở 3.5 là xếp hạng của người viết, không có phương pháp chấm được nêu.
- Không có bằng chứng người dùng thật (phỏng vấn, review) cho các điểm nghẽn; toàn bộ là quan sát trên một tài khoản.

---

## 5. Mục 8.5 (gói và hạn mức), 8.7 (rủi ro), 8.8 (lộ trình và chỉ số), 8.9 (ba điểm mở đã chốt), cùng 8.1 — chép nguyên ý

### Takeaway
Trong các điều liên quan gói Pro, quyết định báo cáo ghi là đã chốt của chủ dự án là "Trước mắt miễn phí toàn bộ sản phẩm (cả SaaS lẫn sàn); chạy ổn rồi mới bật Pro" (8.9 hàng 3; 8.1 hàng 4), cùng hệ quả không thu hoa hồng/không giữ tiền hộ (8.1 hàng 1) và hồ sơ công khai + nhận yêu cầu miễn phí (8.5 dòng 735). Bảng gói/hạn mức 8.5, điều kiện bật Pro (≥ 200 gia sư hoạt động và ≥ 30% vượt hạn mức Free trong 2 tháng liên tiếp), và lời dặn "không nên cạnh tranh bằng giá thấp hơn" được báo cáo ghi là "thiết kế sẵn", "gợi ý" và "lưu ý", không phải quyết định đã chốt.

### Cited Findings

#### 5.A Trạng thái "đã chốt" so với "đề xuất" theo chính lời báo cáo
- Mục 8 "thay cho 'hàm ý và câu hỏi' của bản 1. Bốn câu hỏi bạn đã trả lời trở thành khung cố định; mọi đề xuất bên dưới chỉ lấp đầy khung đó … Những chỗ tôi phải chọn thay bạn được đánh dấu rõ là 'đề xuất' để bạn gật hoặc lắc, không phải quyết định." [Nguồn: báo cáo nội bộ 19/10, mục 8, dòng 625]
- Tiêu đề 8.9: "Ba điểm mở của bản 2 – đã chốt (19/10/2026)"; kết luận: "Với ba quyết định này, không còn điểm nào trong mục 8 chờ bạn." [Nguồn: báo cáo nội bộ 19/10, mục 8.9, dòng 783 và 791]
- Tiêu đề 8.8: "Lộ trình đề xuất và chỉ số đo". [Nguồn: báo cáo nội bộ 19/10, mục 8.8, dòng 775]
- Báo cáo không nói ai là "bạn" (không có tên); URL của trang báo cáo phụ huynh trong tài khoản khảo sát là `/report/thanh-nguyen/hoc-sinh-test-a`. [Nguồn: báo cáo nội bộ 19/10, mục 3.3.12, dòng 251]

#### 5.B Mục 8.1 — bốn quyết định đã chốt (chép nguyên ý, dòng 629–634)

| # | Quyết định | Hệ quả đối với thiết kế |
|---|---|---|
| 1 | Gia sư là người dùng chính (dùng hằng ngày). Học sinh/phụ huynh có thể vào tìm gia sư – sản phẩm kiêm vai trung gian giúp hai bên gặp nhau. | Mô hình "hai mặt nhưng lệch": mặt SaaS (lịch – điểm danh – phí – phiếu QR) là sản phẩm; mặt sàn (hồ sơ gia sư công khai + trang tìm gia sư) là kênh kéo nhu cầu về cho gia sư. Không thu hoa hồng, không giữ tiền hộ, không xếp lịch hộ – khác hẳn Preply/Wyzant/Daykemtainha. Hồ sơ công khai được sinh từ dữ liệu vận hành thật (số buổi đã dạy, tỷ lệ đúng hẹn), đây là lợi thế không sàn nào có. |
| 2 | Kênh phụ huynh giữ như Sổ Gia Sư: Zalo thủ công, tối thiểu chi phí. | Không ZNS, không SMS, không app phụ huynh. Sản phẩm phải làm "gửi Zalo" nhanh hơn Sổ Gia Sư: soạn sẵn nội dung + ảnh + link trong một nút; dùng deep-link zalo.me/<số điện thoại>; ghi lại "đã gửi lúc" để gia sư không gửi trùng. Chi phí vận hành kênh = 0đ. |
| 3 | Đối soát chuyển khoản bán tự động: gia sư tự thêm ảnh chuyển khoản. Chưa có pháp nhân/đối tác ngân hàng. | Không webhook ngân hàng, không cổng thanh toán, không giấy phép trung gian thanh toán. Mỗi phiếu thu có ô "Đính kèm ảnh chuyển khoản"; hệ thống chỉ đọc số tiền/ngày từ ảnh nếu làm được (OCR giai đoạn sau), còn lại gia sư xác nhận. Giá trị tạo ra: bằng chứng thu tiền gắn với từng buổi/từng học sinh, trang phụ huynh hiện "Đã nhận ✓" – thứ Sổ Gia Sư mới chỉ hứa. |
| 4 | **Trước mắt miễn phí toàn bộ; chạy ổn rồi mới nâng Pro (hạn mức tham chiếu Sổ Gia Sư).** | **Giai đoạn chạy thử: một gói Free duy nhất, không khoá tính năng nào (kể cả phần sàn). Hạn mức 8 học sinh / 4 mẫu phiếu / 50MB của Sổ Gia Sư chỉ là tham chiếu để thiết kế sẵn cơ chế hạn mức; chưa bật. Khi bật Pro sau này, mốc ~42.000đ/tháng là điểm so sánh trực tiếp. Mọi hạn mức phải cấu hình được từ admin, không viết cứng trong mã, để bật/tắt không cần phát hành lại.** |

[Nguồn: báo cáo nội bộ 19/10, mục 8.1, dòng 629–634]

#### 5.C Mục 8.2.1, 8.2.2, 8.3 — những chỗ liên quan đến gói/hạn mức
- Vai Quản trị: "Duyệt/ẩn hồ sơ công khai bị báo cáo, điều chỉnh hạn mức Free/Pro, xem số liệu phễu (hồ sơ → lượt xem → yêu cầu → lớp được tạo)." [Nguồn: báo cáo nội bộ 19/10, mục 8.2.1, dòng 644]
- Doanh thu: "Doanh thu duy nhất là gói Pro" (8.2.2 Lưu ý, dòng 652; xem câu hỏi 3).
- Mô hình dữ liệu: thực thể Gia sư (Tutor) có trường "gói (Free/Pro), hạn Pro". [Nguồn: báo cáo nội bộ 19/10, mục 8.3, dòng 660]
- Ảnh bài làm "(≤ 3 ảnh, tính vào 50MB)"; Ảnh chuyển khoản "(jpg/png ≤ 2MB)". [Nguồn: báo cáo nội bộ 19/10, mục 8.3, dòng 665 và 668]
- Hồ sơ công khai: Trạng thái Hiện/Ẩn do gia sư chọn; nhóm BẮT BUỘC hiện (trường, bằng cấp/chứng chỉ chính, môn/cấp, khu vực, hình thức); nhóm TUỲ CHỌN (ảnh, giá tham khảo theo buổi, giới thiệu ≤ 600 ký tự, lịch trống, số Zalo); chỉ số tự động luôn hiện (số buổi đã dạy, số học sinh đang dạy, tỷ lệ chốt đúng ngày). [Nguồn: báo cáo nội bộ 19/10, mục 8.3, dòng 661]

#### 5.D Mục 8.5 — Gói và hạn mức (chép nguyên, dòng 725–740)

Câu mở đầu: "Khi ra mắt chỉ có một gói Free, không khoá gì. Bảng dưới là thiết kế sẵn cho ngày bật Pro: cột Free là hạn mức sẽ áp khi đó (tham chiếu Sổ Gia Sư), cột Pro là phần mở thêm. Trong thời gian chạy thử, mọi người dùng được hưởng cột Pro mà không trả tiền; hệ thống vẫn đếm để biết bao nhiêu người vượt hạn mức Free – đó là số liệu quyết định thời điểm bật Pro." [Nguồn: báo cáo nội bộ 19/10, mục 8.5, dòng 727]

| Hạng mục | Free (áp dụng khi bật Pro) | Pro (sau này, tham chiếu ~42.000đ/tháng trả năm) |
|---|---|---|
| Học sinh đang dạy | 8 | Không giới hạn |
| Mẫu phiếu thu QR | 4 | Tất cả (9+) |
| Lưu trữ ảnh (bài làm + ảnh chuyển khoản) | 50MB | 2GB |
| Ảnh chuyển khoản / đối soát thủ công | Có | Có + OCR khi có (giai đoạn 2) |
| Hồ sơ công khai + nhận yêu cầu | Có (đã chốt: miễn phí cho mọi gia sư) | Có + ưu tiên hiển thị + huy hiệu "Hoạt động" |
| Gửi Zalo một chạm | Có | Có |
| Xuất Excel/PDF | Excel | Excel + PDF (bảng điểm danh tháng, nghẽn #12) |
| Trợ giảng / giáo viên thứ hai | Không | Chưa làm ở giai đoạn 1 – để sau nếu dữ liệu cho thấy cần (TutorBird thu 4,95 USD/giáo viên thêm) |

[Nguồn: báo cáo nội bộ 19/10, mục 8.5, dòng 729–738]

Đoạn chú dưới bảng (nguyên văn): "Mọi con số trong bảng là hạn mức cấu hình được và chưa bật. Mốc 8 học sinh và 42.000đ giữ theo Sổ Gia Sư để khi bật Pro có thể so sánh 'ngang giá, nhiều hơn 3 thứ': ảnh chuyển khoản, hồ sơ công khai, Zalo một chạm. Điều kiện gợi ý để bật Pro: ≥ 200 gia sư hoạt động và ≥ 30% trong số đó vượt hạn mức Free trong 2 tháng liên tiếp." [Nguồn: báo cáo nội bộ 19/10, mục 8.5, dòng 740]

Lưu ý khi chép: ở dòng 735 cột Free ghi "(đã chốt: miễn phí cho mọi gia sư)", tức chỉ riêng việc hồ sơ công khai + nhận yêu cầu miễn phí được đánh dấu "đã chốt" trong bảng; các ô khác chưa. Đối chiếu: 8.9 hàng 3 "Phần sàn miễn phí cho ai" (dòng 789).

#### 5.E Mục 8.7 — Rủi ro và lưu ý (chép nguyên ý, mỗi gạch đầu dòng, dòng 759–773)
- **Pháp lý trung gian:** "chừng nào không thu tiền hộ, không giữ tiền, không hưởng hoa hồng thì bạn chỉ là nền tảng đăng thông tin; vẫn cần Điều khoản sử dụng + Chính sách bảo mật nêu rõ (Daykemtainha có mẫu để tham khảo, mục 5.5). Khi có pháp nhân, xem lại Nghị định 52/2013 về sàn TMĐT nếu bắt đầu thu phí kết nối." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 761]
- **Dữ liệu cá nhân trẻ em:** "tên học sinh + SĐT phụ huynh + ảnh bài làm là dữ liệu cá nhân (Nghị định 13/2023). Mặc định ẩn mọi thông tin học sinh khỏi hồ sơ công khai; chỉ hiện số đếm." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 763]
- **Chất lượng nguồn cung ban đầu:** "sàn chỉ có giá trị khi có đủ gia sư trong một khu vực. Đề xuất mở theo từng thành phố (bắt đầu nơi bạn có gia sư thật), và chỉ bật trang tìm gia sư khi khu vực đó có ≥ 30 hồ sơ đang hoạt động." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 765]
- **Ảnh chuyển khoản giả/chỉnh sửa:** "rủi ro thuộc gia sư; sản phẩm nêu rõ và không dùng chữ 'đối soát tự động'." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 767]
- **Kênh Zalo thủ công:** "tỷ lệ gửi sẽ thấp nếu cần > 2 thao tác. Đo 'số phiếu được gửi / số phiếu tạo' ngay từ bản đầu; nếu < 50% thì mới cân nhắc ZNS (có phí) ở giai đoạn 3." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 769]
- **Cạnh tranh trực diện với Sổ Gia Sư:** "họ đã có mốc giá và tập khách; lợi thế của bạn phải nằm ở 3 thứ họ chưa có (ảnh chuyển khoản, hồ sơ công khai, Zalo một chạm) và ở việc sửa đúng 12 nghẽn. **Không nên cạnh tranh bằng giá thấp hơn.**" [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 771]
- **Phụ thuộc deep-link Zalo:** "zalo.me/<SĐT> mở được trên điện thoại và web; cần kiểm tra trên cả iOS/Android/desktop trước khi dựa vào." [Nguồn: báo cáo nội bộ 19/10, mục 8.7, dòng 773]

#### 5.F Mục 8.8 — Lộ trình đề xuất và chỉ số đo (chép nguyên, dòng 775–781)

| Giai đoạn | Phạm vi | Chỉ số cần đạt trước khi sang giai đoạn sau |
|---|---|---|
| 1 – Ngang Sổ Gia Sư + sửa nghẽn (SaaS) | Lớp/buổi/điểm danh/phí/phiếu QR/báo cáo; ảnh chuyển khoản thủ công; Zalo một chạm; PIN; 5 trạng thái buổi; sửa bug lọc ngày; PDF; cơ chế hạn mức có sẵn nhưng tắt (miễn phí toàn bộ). | ≥ 70% gia sư đăng ký tạo lớp trong ngày đầu; ≥ 60% buổi được chốt trong 24h; ≥ 50% phiếu thu có ảnh chuyển khoản; ≥ 50% phiếu được bấm "Gửi Zalo". |
| 2 – Mặt sàn | Hồ sơ công khai + chỉ số tự động; trang tìm gia sư theo thành phố; form yêu cầu; "Nhận lớp" tạo lớp sẵn; PWA + Web Push cho gia sư; gói N buổi; OCR ảnh chuyển khoản. | ≥ 30 hồ sơ hoạt động/thành phố; tỷ lệ yêu cầu → thành lớp ≥ 20%; ≥ 30% lớp mới trong tháng đến từ sàn. |
| 3 – Mở rộng có điều kiện | Trợ giảng/giáo viên thứ hai; ZNS nhắc lịch trả phí (nếu tỷ lệ gửi Zalo thủ công thấp); đánh giá có kiểm duyệt; API/sao kê khi có pháp nhân. | Quyết định bằng dữ liệu giai đoạn 1–2, không làm trước. |

[Nguồn: báo cáo nội bộ 19/10, mục 8.8, dòng 777–781]

Ghi chú tôi nhận thấy (dữ kiện, không suy diễn): bảng 8.8 KHÔNG có chỉ số "chuyển đổi Free → Pro" và KHÔNG ghi giai đoạn nào bật Pro; thời điểm bật Pro chỉ được nêu trong "điều kiện gợi ý" ở dòng 740. Giai đoạn 1 ghi "cơ chế hạn mức có sẵn nhưng tắt (miễn phí toàn bộ)". Mục 8.2.2 nhắc "mặt sàn chỉ là 'mồi' cho SaaS – cần đo đúng chỉ số (mục 8.8)" (dòng 652). [Nguồn: báo cáo nội bộ 19/10, mục 8.8 dòng 777–781, mục 8.2.2 dòng 652, mục 8.5 dòng 740]

#### 5.G Mục 8.9 — Ba điểm mở đã chốt (19/10/2026), chép nguyên (dòng 783–791)

| Điểm mở | Quyết định của bạn | Đã đưa vào đâu |
|---|---|---|
| Hồ sơ công khai mặc định bật hay tắt | Gia sư tự chọn Hiện/Ẩn; nhưng một số thông tin bắt buộc vẫn hiện khi hồ sơ đang Hiện: trường, bằng cấp/chứng chỉ chính, môn/cấp, khu vực, hình thức. | 8.3 (TutorProfile: nhóm bắt buộc / tuỳ chọn), 8.4D bước 2 và 5. |
| Chống spam form yêu cầu | Cách tiết kiệm nhất: reCAPTCHA v3 miễn phí + giới hạn theo số điện thoại và IP; không OTP. | 8.4D bước 3. |
| Phần sàn miễn phí cho ai | Trước mắt miễn phí toàn bộ sản phẩm (cả SaaS lẫn sàn); chạy ổn rồi mới bật Pro. | 8.1 hàng 4, 8.5, 8.8 giai đoạn 1. |

Kết: "Với ba quyết định này, không còn điểm nào trong mục 8 chờ bạn. Việc kế tiếp là chuyển mục 8 thành đặc tả màn hình (wireframe) và backlog giai đoạn 1 – nếu bạn muốn, tôi làm ở bản 3." [Nguồn: báo cáo nội bộ 19/10, mục 8.9, dòng 785–791]

#### 5.H Chi tiết vận hành có liên quan chi phí biên / hạn mức (mục 8.4)
- Chống spam form yêu cầu: "reCAPTCHA v3 (miễn phí) + tối đa 3 yêu cầu/ngày/số điện thoại + 10/ngày/IP; không OTP (OTP Zalo/SMS tốn vài trăm đồng mỗi lần)"; form gửi "gia sư phù hợp (tối đa 5 gia sư cùng bộ lọc)". [Nguồn: báo cáo nội bộ 19/10, mục 8.4D bước 3, dòng 711]
- Sắp xếp trang tìm gia sư: "mặc định theo 'đang hoạt động' (có buổi chốt trong 30 ngày) rồi theo gói Pro". [Nguồn: báo cáo nội bộ 19/10, mục 8.4D bước 1, dòng 707]
- Giai đoạn 2 OCR ảnh ngân hàng phổ biến "(Vietcombank, Techcombank, MB, BIDV, VietinBank, ACC, TPBank, MoMo)"; "Vẫn không cần đối tác ngân hàng." [Nguồn: báo cáo nội bộ 19/10, mục 8.4C bước 3, dòng 697]
- Chi phí kênh Zalo thủ công "= 0đ"; ZNS chỉ cân nhắc ở giai đoạn 3 và "có phí" (số tiền không nêu). [Nguồn: báo cáo nội bộ 19/10, mục 8.1 hàng 2 dòng 632, mục 8.7 dòng 769]

### Inferences
- [Suy luận] Đề bài mô tả điều kiện bật Pro và việc không cạnh tranh bằng giá thấp hơn là quyết định đã chốt của chủ dự án. Theo lời báo cáo, hai điều đó là: điều kiện GỢI Ý (dòng 740) và một LƯU Ý rủi ro (dòng 771). Khi viết báo cáo Pro nên ghi đúng mức: quyết định đã chốt chỉ là "Trước mắt miễn phí toàn bộ sản phẩm (cả SaaS lẫn sàn); chạy ổn rồi mới bật Pro" (dòng 789).
- [Suy luận] Lời dặn "Không nên cạnh tranh bằng giá thấp hơn" (dòng 771) kết hợp với "Mốc 8 học sinh và 42.000đ giữ theo Sổ Gia Sư để khi bật Pro có thể so sánh 'ngang giá, nhiều hơn 3 thứ'" (dòng 740) có nghĩa là báo cáo định vị sản phẩm ngang mức giá của Sổ Gia Sư chứ không dưới. Mốc này lệch với "dưới 20k/tháng" (bàn giao) và với giá giữ chỗ 300.000đ trong mã, nhưng không lệch với trần "dưới 500.000đ/tháng" (TT-204) (câu hỏi 8, mục C1).
- [Suy luận] Điều kiện bật Pro dùng hai ngưỡng (≥ 200 gia sư hoạt động; ≥ 30% vượt hạn mức Free 2 tháng liên tiếp). Để đo được "vượt hạn mức Free", hệ thống cần đếm học sinh đang dạy/gia sư; báo cáo nói "hệ thống vẫn đếm" (dòng 727). Báo cáo không định nghĩa "gia sư hoạt động".
- [Suy luận] Ba thứ báo cáo gọi là "nhiều hơn 3 thứ" (ảnh chuyển khoản, hồ sơ công khai, Zalo một chạm) đều nằm ở cột Free trong bảng 8.5 ("Có"), nên chính "3 thứ" đó không phải là đòn khoá Pro theo bảng; chúng là lý do chọn KiN. Riêng hồ sơ công khai có thêm "ưu tiên hiển thị + huy hiệu" ở Pro, ảnh chuyển khoản có thêm "OCR" ở Pro.
- [Suy luận] Dữ liệu trong 8.5 là phép chiếu từ Sổ Gia Sư: Free 8 học sinh / 4 mẫu phiếu / 50MB giữ nguyên; Pro lưu trữ giảm từ 5 GB (Sổ Gia Sư) xuống 2GB (dòng 733 vs dòng 102) và không có hàng "Google Drive" hay "hỗ trợ ưu tiên".

### Gaps
- Báo cáo không ghi căn cứ cho mốc "≥ 200 gia sư hoạt động" hay "≥ 30%".
- Không có giá cho gói trả theo quý/năm của sản phẩm chủ dự án; chỉ có "tham chiếu ~42.000đ/tháng trả năm".
- Không ghi cách thu tiền gói Pro khi "chưa có pháp nhân" (8.1 hàng 3).
- Không có định nghĩa "gia sư hoạt động" cho điều kiện bật Pro (khác với "đang hoạt động" ở 8.4D = có buổi chốt trong 30 ngày).
- Không nêu ai là "bạn" ra quyết định (ghi chú ở 5.A).

---

## 6. Phụ lục B của báo cáo: điều chưa kiểm chứng / mâu thuẫn (chép đủ), kèm các chỗ không nằm trong Phụ lục B

### Takeaway
Phụ lục B liệt kê 12 dòng, mỗi dòng cho một nền tảng. Các con số quan trọng cho Pro nhất bị gắn nhãn chưa chắc chắn gồm: giá TutorBird (ba mức), hai bộ giá Teachworks, giá gói Pro của Teach 'n Go, các dòng giá Comiru chưa rõ gói, mức phí italki (15% vs 15–30%), phí Daykemtainha (25–30% vs 10–25%), phí Superprof 10% (tuỳ chọn hay bắt buộc), và với Sổ Gia Sư là chuyện có email khi trial hết hạn.

### Cited Findings

#### 6.A Phụ lục B (chép nguyên, dòng 831–855)
- **Sổ Gia Sư:** "hành vi 'Theo khoá học' và 'Theo giờ' khi chốt buổi (chưa tạo lớp loại này); nội dung QR thật khi đã cấu hình ngân hàng; hiển thị trên điện thoại dọc; email/thông báo khi trial hết hạn; cách đồng bộ Google Calendar thực tế (chưa kết nối)." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 833]
- **TutorBird:** "trụ sở, app native, phí Stripe/PayPal áp cho người dùng, danh sách báo cáo; giá 16,95 USD (trang chính) vs 14,95 (blog đối thủ) vs C$/£13,95 (trang phụ)." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 835]
- **Teachworks:** "hai bộ giá trên cùng trang; 45/46 ngôn ngữ; 50/70/80 add-on; màu chủ đạo; giá SMS và add-on Pro." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 837]
- **Teach 'n Go:** "giá gói Pro; giới hạn học viên Pro; 2 gói (web) vs 4 gói (Capterra)." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 839]
- **Comiru:** "dòng giá 500¥ và 858¥ chưa rõ gói; QR hay thẻ IC; 7.100 lớp (web) vs 1.939 doanh nghiệp (báo cáo) – khác đơn vị." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 841]
- **ClassUp:** "'Alimtalk' chưa thấy chữ Kakao trong tài liệu; kiosk Toss Front miễn phí vs tablet 500.000 won; năm của số liệu." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 843]
- **Shub:** "2.000 trường (web) vs 200+ (2022); 3 triệu học sinh vs 3 triệu người dùng/ngày; bảng giá 404." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 845]
- **Preply:** "duyệt 3 vs 5 ngày; 33.602 vs 46.278 gia sư tiếng Anh; bảng bậc hoa hồng đầy đủ là ảnh." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 847]
- **Superprof:** "quy mô 13 triệu / 30 triệu / 40 triệu tuỳ nguồn; phí 10% tuỳ chọn vs bắt buộc (Sidehusl); Student Pass VN chưa thấy." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 849]
- **Wyzant:** "65.000 (web) vs 500.000 (Wikipedia 2013); Trustpilot biểu đồ 82% 5 sao nhưng điểm 1,6." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 851]
- **italki:** "15% (chính sách cũ) vs 15–30% (help center); 20.000 vs 30.000 giáo viên; sàn giá 4 vs 5 USD." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 853]
- **Daykemtainha:** "phí 25–30% (hợp đồng) vs 10–25% (thẻ lớp); Điều 7 có hai cách đọc; số ĐKKD chưa tra." [Nguồn: báo cáo nội bộ 19/10, Phụ lục B, dòng 855]

#### 6.B Chỗ báo cáo tự nhận chưa thử, chưa xác minh hoặc số cũ nhưng NẰM NGOÀI Phụ lục B (tôi quét thân báo cáo)
- Hình thức "Theo khoá học" của Sổ Gia Sư: "gói theo kỳ (chưa thử)"; "Chưa đi sâu vì không thể đổi hình thức của lớp test". Đây là cơ chế trả trước/gói có thể liên quan Pro. [Nguồn: báo cáo nội bộ 19/10, mục 3.4.1 dòng 267 và mục 3.4.2 dòng 278]
- TutorBird mobile: "Web-based, không có app native rõ ràng (Capterra ghi Android/iPhone nhưng chưa xác minh)". [Nguồn: báo cáo nội bộ 19/10, mục 4.1, dòng 343]
- Teachworks giá: "Trang giá còn một bộ số cũ (15/45/175 USD) kèm chữ Lorem ipsum – lấy bộ 16,49 làm chuẩn." (quyết định của người viết báo cáo, không phải xác nhận từ hãng.) [Nguồn: báo cáo nội bộ 19/10, mục 4.2, dòng 406]
- TutorCruncher phí giao dịch: lấy "theo nghiên cứu Gemini cũ: 3,85% thẻ, 1% doanh thu offline". [Nguồn: báo cáo nội bộ 19/10, mục 4.4, dòng 462]
- Comiru giá: "Không công bố trên web"; con số từ báo cáo chứng khoán. [Nguồn: báo cáo nội bộ 19/10, mục 4.5, dòng 471]
- ClassUp quy mô: "(tự công bố, không ghi năm)". [Nguồn: báo cáo nội bộ 19/10, mục 4.6, dòng 483]
- Eduspace: "không có review độc lập". [Nguồn: báo cáo nội bộ 19/10, mục 4.7, dòng 494]
- Shub phía giáo viên: lấy từ hướng dẫn ĐH Cần Thơ + báo chí, không có tài khoản giáo viên. [Nguồn: báo cáo nội bộ 19/10, mục 2.2 dòng 72; mục 4.8 dòng 509]
- Superprof: "subagent nghiên cứu không mở được superprof.vn nhưng khảo sát trực tiếp xác nhận bản Việt Nam hoạt động". [Nguồn: báo cáo nội bộ 19/10, mục 5.2, dòng 555]
- Snapask/Ruangguru: "số liệu cũ" (2020–2022). [Nguồn: báo cáo nội bộ 19/10, mục 5.6, dòng 579–583]
- Daykemtainha: "Không tìm thấy khiếu nại trực tiếp"; ảnh không dựng được, mô tả chữ. [Nguồn: báo cáo nội bộ 19/10, mục 5.5, dòng 575–577; mục 2.2 dòng 73]
- Chữ "Mobile/điện thoại dọc" của Sổ Gia Sư chưa kiểm: bảng 3.5 #11 "điện thoại dọc cần kiểm tra thêm". [Nguồn: báo cáo nội bộ 19/10, mục 3.5 (#11), dòng 308]

#### 6.C Chỗ mâu thuẫn/lệch bên trong báo cáo mà Phụ lục B KHÔNG nêu (tôi phát hiện khi đối chiếu; mỗi mục có cả hai dòng nguồn)
1. **Số mẫu phiếu:** "9 mẫu (4 Free, 5 Pro)" (dòng 34, 219) vs 4 Free + 6 tên Pro thêm = 10 (dòng 101) vs 10 tên với 4 tên đánh dấu "(Pro)" (dòng 221); bảng 8.5 ghi "Tất cả (9+)" (dòng 732).
2. **Hai danh sách 12 điểm nghẽn** không khớp số thứ tự (câu hỏi 4.C); mục 3.6/3.5 bị trỏ nhầm (dòng 42, 648).
3. **Email nhắc hết trial:** bảng 3.5 #12 khẳng định "không có nhắc email" (dòng 309) trong khi Phụ lục B xếp "email/thông báo khi trial hết hạn" là chưa kiểm chứng (dòng 833).
4. **Wyzant "100%":** mục 5.3 "Wyzant giữ 25% (100% nếu học sinh do gia sư tự giới thiệu)" (dòng 567) dễ hiểu nhầm; bảng 6.2 viết "25% (0% khách tự giới thiệu)" (dòng 607).
5. **Teach 'n Go "69/tháng (EUR/USD)":** đơn vị không rõ (dòng 450); tóm tắt ghi "69 EUR" (dòng 38).
6. **Preply buổi thử 25 phút:** 27,00 USD cho gia sư 45 USD/50 phút (dòng 527, 543), không phải nửa giá 22,50 USD; báo cáo không giải thích.
7. **"Thử chuyển đổi 3 hình thức học phí"** (dòng 62, mục 2.1) vs "Chưa đi sâu vì không thể đổi hình thức của lớp test"/"chưa tạo lớp loại này" (dòng 278, 833): có thể là đã thử đổi nhưng bị khoá; báo cáo không nói rõ kết quả.
8. **Tầng Pro của Phân tích/Xuất Excel/Tải PDF:** không nêu (câu hỏi 1.C(h)); đối chiếu 8.5 cho rằng "Excel" ở Free và "Excel + PDF" ở Pro, nhưng đó là thiết kế sản phẩm của chủ dự án chứ không phải quan sát tầng của Sổ Gia Sư.
9. **Trạng thái "đã chốt" vs "gợi ý/đề xuất":** dòng 791 "không còn điểm nào trong mục 8 chờ bạn" nhưng 8.5 (dòng 740) và 8.8 (dòng 775) vẫn mang nhãn gợi ý/đề xuất (câu hỏi 5.A).

### Inferences
- [Suy luận] Độ tin cậy từng con số cho Pro (chỉ phân loại của tôi, dựa trên chỗ báo cáo nói về nguồn):
  - **Chắc nhất (đọc trực tiếp trang `/pricing`, `/billing` bằng tài khoản thật, ảnh dựng lại không được nhưng mô tả "từ những gì đã nhìn thấy trực tiếp"):** Sổ Gia Sư Free vs Pro (8/4/50MB/5GB), Quý 179.000đ, Năm 499.000đ, dùng thử 30 ngày.
  - **Chắc vừa (trang chính thức của hãng + một lần xác nhận qua tài khoản dùng thử):** TutorBird 16,95 USD + 4,95 USD/GV; Teachworks bộ 16,49 (có ghi hai bộ giá trên cùng trang); ClassUp từ help center; Eduspace `/bao-gia`.
  - **Số của hãng tự công bố hoặc báo cáo tài chính (không xác minh độc lập):** quy mô Preply/Wyzant/italki/Superprof/ClassUp/Shub; Comiru từ báo cáo chứng khoán (nguồn tốt nhưng giá không công bố).
  - **Có mâu thuẫn được nêu:** TutorBird 16,95/14,95/13,95; italki hoa hồng; Daykemtainha phí; Superprof phí 10%; Teach 'n Go số gói.
  - **Chưa thấy/không có:** giá gói Pro Teach 'n Go; Student Pass Superprof VN; giá Shub; giá sau giảm của Sổ Gia Sư.

### Gaps
- Phụ lục B không liệt kê mâu thuẫn nội bộ ở 6.C; người viết báo cáo cuối cần tự quyết cách nêu (tôi chỉ chỉ ra chỗ).
- Không có cách nào trong bản chữ để kiểm các số chỉ có trong ảnh (bảng bậc hoa hồng Preply; thân trang giá Sổ Gia Sư dựng không được).

---

## 7. Độ tin cậy: báo cáo đã làm gì thật, chưa làm gì

### Takeaway
Giá và hạn mức của Sổ Gia Sư được đọc trực tiếp bằng một tài khoản thật đang ở Pro dùng thử; chưa quan sát hành vi Free bị khoá, chưa bấm thanh toán, chưa thấy email nhắc. Đối thủ: TutorBird và Teachworks được vào trong tài khoản dùng thử; Preply, Wyzant dừng trước thanh toán; Shub chỉ vai học sinh; phần còn lại là trang công khai/nguồn chính thức/báo cáo chứng khoán, số quy mô là tự công bố. Mục 8 viết cho một sản phẩm giả định nên cần đối chiếu KiN thật trước khi tin.

### Cited Findings

#### 7.A Đã làm trên Sổ Gia Sư (mục 2.1, dòng 52–62)
- Đăng nhập bằng tài khoản thật (Google OAuth), đang dùng thử Pro 30 ngày, hết hạn 20/10/2026, qua Chrome. [Nguồn: báo cáo nội bộ 19/10, mục 2.1, dòng 54]
- Tạo lớp thật "Lớp TEST Claude - xoá sau": phí theo buổi, 1 học sinh "Học sinh TEST A" 200.000đ/buổi, lịch Thứ Ba + Thứ Năm 18:00–19:30, 4 tuần → 8 buổi. [Nguồn: báo cáo nội bộ 19/10, mục 2.1, dòng 56]
- Đi hết vòng đời một buổi: "Đã dạy xong" → phí 200.000đ → tạo phiếu học phí (xem 9 mẫu) → xuất phiếu hàng loạt → "Đã thu tiền" → Lịch sử thu → "Hoàn tác". [Nguồn: báo cáo nội bộ 19/10, mục 2.1, dòng 58]
- Bật chia sẻ báo cáo phụ huynh, mở link công khai, tải ảnh báo cáo PNG. [Nguồn: báo cáo nội bộ 19/10, mục 2.1, dòng 60]
- Chụp 28 ảnh dashboard, đọc DOM/văn bản từng trang; thử validation form rỗng; thử chuyển đổi 3 hình thức học phí; "đọc trang chủ, bảng giá, FAQ công khai". [Nguồn: báo cáo nội bộ 19/10, mục 2.1, dòng 62]

#### 7.B Đã làm trên các bên tham khảo (mục 2.2, dòng 64–74)
- TutorBird: "Vào bên trong tài khoản dùng thử của bạn: thêm học sinh 4 bước, lên lịch, điểm danh, ghi chú, tài khoản gia đình, tạo hoá đơn". [Nguồn: báo cáo nội bộ 19/10, mục 2.2, dòng 68]
- Teachworks: "Vào bên trong tài khoản dùng thử (awdawdas.teachworks.com): dashboard, menu, thêm bài học, thêm học sinh, tạo hoá đơn, lịch"; không tạo dữ liệu, chỉ mở form. [Nguồn: báo cáo nội bộ 19/10, mục 2.2 dòng 69; Phụ lục C dòng 863]
- Preply: "Đăng nhập Google vai học viên: tìm kiếm, hồ sơ gia sư, đặt buổi thử, trang checkout (dừng trước thanh toán)". [Nguồn: báo cáo nội bộ 19/10, mục 2.2, dòng 70]
- Wyzant: "Đăng nhập Google vai học viên: ghép môn, hồ sơ gia sư, dashboard học viên". [Nguồn: báo cáo nội bộ 19/10, mục 2.2, dòng 71]
- Shub: "Đăng nhập vai học sinh (bạn không có tài khoản giáo viên); phía giáo viên lấy từ hướng dẫn ĐH Cần Thơ + báo chí". [Nguồn: báo cáo nội bộ 19/10, mục 2.2, dòng 72]
- Superprof.vn, Daykemtainha.vn, Teach 'n Go, TutorCruncher: "Trang công khai + nguồn chính thức". [Nguồn: báo cáo nội bộ 19/10, mục 2.2, dòng 73]
- italki, Comiru, ClassUp, Eduspace, Snapask, Ruangguru: "Nguồn chính thức, báo cáo chứng khoán (Comiru), help center, review"; không có ảnh. [Nguồn: báo cáo nội bộ 19/10, mục 2.2, dòng 74]

#### 7.C Giới hạn báo cáo tự nêu (mục 2.3, dòng 76–82) và ở đầu báo cáo
- "Ảnh các màn trong app TutorBird và trang chủ/bảng giá công khai của Sổ Gia Sư không dựng lại được bằng html2canvas (web component, hiệu ứng cuộn) – các phần này được mô tả bằng chữ từ những gì đã nhìn thấy trực tiếp." [Nguồn: báo cáo nội bộ 19/10, mục 2.3, dòng 78]
- "Số liệu quy mô của các hãng là số tự công bố, được đánh dấu rõ. Chỗ nào nguồn mâu thuẫn, báo cáo nêu cả hai và không chọn thay bạn." [Nguồn: báo cáo nội bộ 19/10, mục 2.3, dòng 80]
- Tài khoản test còn dữ liệu (lớp, học sinh, 8 buổi, 1 khoản phí chưa thu, link chia sẻ đang bật); TutorBird còn "Test Student" + buổi 19/10 (30 USD nợ); Preply và Wyzant đã tạo tài khoản học viên mới bằng Google. [Nguồn: báo cáo nội bộ 19/10, mục 2.3, dòng 82]
- Bản này "chỉ giữ chữ, chú thích ảnh giữ nguyên dạng 'Hình N – …'"; file `.docx` gốc "có 129 trang và 71 ảnh". Ảnh Sổ Gia Sư/Preply/Wyzant "dựng lại từ DOM thật (html2canvas)"; ảnh TutorBird/Teachworks là ảnh chụp màn hình trực tiếp. [Nguồn: báo cáo nội bộ 19/10, đầu báo cáo, dòng 4 và 21]
- Bản chữ này "Đưa vào kho theo quyết định Q8 (Nâng cấp lần 1) để trích dẫn". [Nguồn: báo cáo nội bộ 19/10, đầu báo cáo, dòng 4]
- Lưu ý đầu báo cáo: "mục 8 viết cho một sản phẩm giả định đang đuổi kịp Sổ Gia Sư; `docs/kin/ke-hoach-phat-trien-tu-research.md` mục 2 và 6 liệt kê những đề xuất KiN đã có hoặc cố ý không làm." [Nguồn: báo cáo nội bộ 19/10, đầu báo cáo, dòng 5]
- Quy ước nguồn: review Capterra/G2/Trustpilot chỉ dùng định tính; quy đổi tiền theo tỉ giá cố định. [Nguồn: báo cáo nội bộ 19/10, mục 4, dòng 329]
- Review Teach 'n Go: "phần lớn 'vendor referred – incentive offered'". [Nguồn: báo cáo nội bộ 19/10, mục 4.3, dòng 452]

### Inferences
- [Suy luận] Tóm tắt giới hạn quan trọng nhất cho báo cáo Pro:
  1. Mọi con số Free/Pro của Sổ Gia Sư đến từ MỘT khảo sát trong một ngày (19/10/2026) với MỘT tài khoản ở trạng thái Pro dùng thử; không có quan sát về Free bị chặn, hành vi khi hết hạn, thanh toán, hay email.
  2. Giá đối thủ nước ngoài quy VND theo tỉ giá cố định của báo cáo, và có chỗ giá khác nhau giữa các trang của cùng hãng (TutorBird, Teachworks, Teach 'n Go).
  3. Quy mô/doanh thu chỉ đáng tin ở Comiru (số trong báo cáo chứng khoán); còn lại là tự công bố.
  4. Mục 8 là thiết kế cho sản phẩm giả định; các "quyết định" trong đó không có tên người quyết định, và chỉ có quyết định "miễn phí toàn bộ khi chạy thử" là nằm trong bảng đã chốt.
  5. Báo cáo ra đời 19/10; hôm nay là 22/10. Dùng thử của tài khoản khảo sát hết hạn 20/10/2026 (dòng 54); khuyến mãi dịp 20/10 có thể đã hết (báo cáo không ghi ngày hết hạn của mã). Giá có thể đã đổi, báo cáo không có cơ chế cập nhật.
  6. Bản chữ mất các số chỉ có trong ảnh (ví dụ bảng bậc hoa hồng đầy đủ của Preply).
- [Suy luận] URL báo cáo phụ huynh `/report/thanh-nguyen/…` cho thấy tài khoản Sổ Gia Sư do một người có slug "thanh-nguyen" tạo; báo cáo không nói đó là ai. Tôi không đủ cơ sở để gán các quyết định ở 8.1/8.9 cho Thọ hay Thanh; nên ghi là "chủ dự án (theo báo cáo)" và tránh nêu tên.
- [Suy luận] Nghiên cứu Gemini (30/9/2026, tệp `kin-deep-research-phan-mem-gia-su.txt`) được báo cáo dùng làm mốc (ngưỡng 150.000–500.000đ cho 25 học sinh; TutorCruncher 3,85%/1%). Tôi đã tìm tệp này trên máy (`find`) và không thấy; nên không kiểm chứng được các số đó.

### Gaps
- Không có nhật ký thao tác, ảnh gốc hay export DOM để đối chiếu từng con số; chỉ có bản chữ.
- Không rõ ngày kiểm từng trang hãng ngoài ngày 19/10 chung (ví dụ trang giá Eduspace, ClassUp).
- Không có thông tin ai đã làm khảo sát (báo cáo viết ở ngôi "tôi" và gọi chủ dự án là "bạn").

---

## 8. Dữ kiện trong báo cáo MÂU THUẪN hoặc CHƯA KHỚP với các tài liệu khác trong kho `docs/kin`

### Takeaway
Có tám chỗ báo cáo chưa khớp với tài liệu KiN, trong đó hai chỗ trực tiếp ảnh hưởng thiết kế Pro: (1) giá tham chiếu 42.000đ/tháng đứng cạnh ba mốc giá KiN khác nhau (dưới 20k/tháng; dưới 500.000đ/tháng cho 25 học sinh; giá giữ chỗ 300.000/1.500.000/2.500.000 Coin trong mã); (2) báo cáo đặt việc dựng cơ chế hạn mức ở giai đoạn 1 (đang tắt, cấu hình từ admin) trong khi mã đã có model `TutorSubscription` với giá viết cứng. Chỗ nào ghi "[Đối chiếu kho]" là tôi đã mở tệp; chỗ nào ghi "qua ghi chú anh em" thì tôi không tự đọc sheet/mã.

### Cited Findings

**C1. Mốc giá Pro: báo cáo 42.000đ so với ba mốc giá trong kho**
- Báo cáo: tham chiếu "~42.000đ/tháng trả năm" (dòng 729 cột Pro; dòng 634); Sổ Gia Sư 179.000đ/quý, 499.000đ/năm (dòng 98). Báo cáo còn dặn "Không nên cạnh tranh bằng giá thấp hơn" (dòng 771) và "ngang giá, nhiều hơn 3 thứ" (dòng 740). [Nguồn: báo cáo nội bộ 19/10, mục 8.1/8.5/8.7]
- Kho (a): "Mô hình tiền: gia sư trả phí nền tảng (Coin nạp trước, dưới 20k/tháng)". [Đối chiếu kho: docs/kin/CLAUDE-cho-kho-trien-khai.md, dòng 25]
- Kho (b): nguyên tắc giá TT-204 "phẳng, không phí giao dịch, dưới 500.000đ/tháng cho cơ sở 25 học sinh (cột E)", "hoãn định giá", "giữ nguyên tắc không cắt phần trăm". [Đối chiếu kho: docs/kin/nghien-cuu-pro/research_notes/Tính năng PRO trả phí KiN/hien_trang_kin.md, dòng 108 (qua ghi chú anh em; tôi không tự đọc sheet)]
- Kho (c): giá trong mã ghi rõ PLACEHOLDER: `monthly` 300.000 / 30 ngày, `half_year` 1.500.000 / 180 ngày, `yearly` 2.500.000 / 365 ngày, đơn vị Coin = VND. [Đối chiếu kho: src/lib/tutorSubscription.ts, dòng 10–15 (tôi đã mở tệp này)]
- Kho (d): `CLAUDE-cho-kho-trien-khai.md` §8 dòng 185: "Giá và gói miễn phí (bảng `PLAN`) — chưa chốt". [Đối chiếu kho: docs/kin/CLAUDE-cho-kho-trien-khai.md, dòng 185]
- Kho (e): ke-hoach-phat-trien-tu-research.md §6, hàng "Gói Pro ~42.000đ, hạn mức Free/Pro", cột lý do: "Hoãn có chủ đích (TT-204); chưa có model `Plan`". [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 273 và 54]
- Hệ quả: [Suy luận — tính lại] có bốn mốc cùng tồn tại: 42.000đ/tháng (báo cáo, quy đổi từ gói năm), 300.000đ/30 ngày (mã giữ chỗ), "dưới 20k/tháng" (bàn giao 24/09) và "dưới 500.000đ/tháng cho cơ sở 25 học sinh" (TT-204). Hai mốc sau là TRẦN, không phải giá chốt. 300.000 / 20.000 = 15 lần; 300.000 / 42.000 ≈ 7,1 lần. Không tài liệu nào trong kho chốt một mức.

**C2. Hạ tầng gói đã có hay chưa**
- Báo cáo: mục 8.5 mô tả "cơ chế hạn mức có sẵn nhưng tắt" ở giai đoạn 1 (dòng 779) và 8.1 "Mọi hạn mức phải cấu hình được từ admin, không viết cứng trong mã" (dòng 634).
- Kho: ke-hoach §6 nói "chưa có model `Plan`" (dòng 273); nhưng mã có model `TutorSubscription` (tôi đã grep `prisma/schema.prisma`: dòng 888; không có `model Plan`). Giá gói viết cứng trong `TUTOR_VIP_PLANS`; ghi chú anh em: `isActiveTutorVIP` không ai gọi, API mua gói bằng Coin có, không có màn mua gói; "bảng `SettingKV` không tồn tại". [Đối chiếu kho: prisma/schema.prisma dòng 888; src/lib/tutorSubscription.ts dòng 10–15; hien_trang_kin.md dòng 91–100]
- Điều chưa khớp: báo cáo đòi hạn mức cấu hình từ admin, còn giá hiện viết cứng trong mã; ke-hoach §2/§6 không nhắc `TutorSubscription`, khác với hien_trang_kin.md dòng 8 ("`docs/kin/*.md` không nhắc tới nó").
- Kỳ hạn gói: Sổ Gia Sư bán Quý/Năm (dòng 141); mã KiN dựng `monthly | half_year | yearly` (tháng / 6 tháng / năm). [Đối chiếu kho: hien_trang_kin.md dòng 92]

**C3. "Miễn phí toàn bộ khi chạy thử": khớp về hướng, nhưng có mâu thuẫn trong kho về mô hình tiền**
- Khớp: quyết định 1.2 ngày 26/09: "Chưa thu lợi nhuận. KiN đứng ở vai cầu nối, chưa thu phí." [Đối chiếu kho: docs/kin/quyet-dinh-va-doi-chieu.md, dòng 30–31]; sheet TT-200 cột K "giai đoạn đầu chưa thu phí" (qua hien_trang_kin.md dòng 107); cờ `KIN_TRIAL_MODE` ẩn lối mua VIP/nạp Coin trong giai đoạn chạy thử, env chưa bật (qua hien_trang_kin.md dòng 112; tôi không đọc được mã nhánh đó).
- Lệch trong kho (không phải lỗi báo cáo): bàn giao 24/09 nói "gia sư trả phí nền tảng (Coin nạp trước, dưới 20k/tháng)"; quyết định 26/09 bỏ Coin khỏi phạm vi (hoãn 15 việc); sheet BE-020 (05/10) đổi thành "SaaS, gia sư trả VIP, 3 gói cố định" (qua hien_trang_kin.md dòng 105–113).
- Báo cáo nói "Doanh thu duy nhất là gói Pro" (dòng 652); kho còn nguyên tắc "KiN không giữ học phí", "không cắt phần trăm doanh thu" (CLAUDE-cho-kho-trien-khai.md dòng 26; hien_trang_kin.md dòng 343) — cùng hướng, không mâu thuẫn.

**C4. Cách tính học phí: lõi của báo cáo khác KiN**
- Báo cáo giữ vòng lặp lõi "Phí (chỉ khi 'Đã dạy xong')" (dòng 648), nghẽn #1 "Quên bấm … → không phí" và #2 "Hình thức học phí khoá cứng" (dòng 746–747).
- KiN: "Học phí tính THEO THÁNG … Vắng KHÔNG trừ tiền … Điểm danh chỉ dùng cho chuyên cần và xếp hạng, không dùng để tính tiền." [Đối chiếu kho: docs/kin/quyet-dinh-giao-dien-va-hoc-phi.md, dòng 58–82]. Và ke-hoach §6 (bảng "Không làm, và vì sao"): hàng "Phí phát sinh khi bấm "Đã dạy xong"" có lý do "KiN tính học phí theo tháng và bậc thang số môn" (dòng 271); hàng "Đổi hình thức học phí của lớp" có lý do "KiN không có loại phí theo lớp" (dòng 272). ĐX-01: "quên điểm danh không làm mất tiền" (ke-hoach dòng 86).
- Liên quan Pro: các điểm nghẽn #1 và #2 của Sổ Gia Sư không áp dụng nguyên văn cho KiN; còn đơn vị "học sinh đang dạy" làm hạn mức cần định nghĩa lại theo mô hình tháng.

**C5. Đối soát chuyển khoản: giả định "chưa có đối tác ngân hàng" đã lỗi thời**
- Báo cáo 8.1 hàng 3: "Chưa có pháp nhân/đối tác ngân hàng … Không webhook ngân hàng, không cổng thanh toán"; 8.5: ảnh chuyển khoản là tính năng của chủ dự án; Pro có "OCR khi có" (dòng 633–634, 734).
- KiN: TT-200 đã có webhook SePay, mã `KIN`+5 ký tự, tự gạch chỉ khi đúng mã và đúng số còn lại, "Tôi đã chuyển", nhắc kiểm sao kê sau 24 giờ; ke-hoach ghi "Báo cáo giả định 'chưa có đối tác ngân hàng', giả định này đã lỗi thời". [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 46]
- Ảnh/OCR: ke-hoach §6, hàng "Ảnh chuyển khoản tự động gạch nợ, OCR", lý do "Trái quy tắc GD-20; đụng tiền" (dòng 275); ĐX-08: "ảnh không bao giờ dùng để tự gạch nợ" (dòng 230), ở Đợt 3, chỉ làm khi số đo cho thấy cần. Báo cáo 8.4C bước 2 cho phép "khớp → phiếu chuyển 'Đã thu (có ảnh)'" sau khi gia sư nhập/xác nhận số tiền (dòng 695). Hai cách đối xử với ảnh chưa khớp.
- Pháp nhân: tien-do-dang-do.md dòng 160 vẫn ghi "giai đoạn 2 (Zalo OA) chờ Thọ có pháp nhân" — vế "chưa có pháp nhân" của báo cáo có vẻ vẫn đúng, vế "đối tác ngân hàng" thì không.
- Liên quan Pro: hàng "Ảnh chuyển khoản / đối soát thủ công" của bảng 8.5 (Free Có / Pro Có + OCR) không phản ánh KiN, nơi đối soát SePay đã là tính năng chạy; ghi chú anh em còn cho thấy mã có hằng `SEPAY_FREE_LIMIT = 50` và `SEPAY_WARN_AT = 40` (tôi đã grep `src/lib/tuitionInvoice.ts` dòng 215–216; hien_trang_kin.md dòng 100 mô tả đó là cảnh báo gói Free của SePay), một giới hạn bên thứ ba mà báo cáo không có.

**C6. "Ghi đã gửi lúc" Zalo**
- Báo cáo: 8.1 hàng 2 "ghi lại 'đã gửi lúc' để gia sư không gửi trùng" (dòng 632); 8.4B bước 3 "Ghi 'đã gửi lúc …'" (dòng 689); chỉ số 8.8 "≥ 50% phiếu được bấm 'Gửi Zalo'" (dòng 779).
- KiN: TT-199 giai đoạn 1 "Chỉ ghi 'Đã mở Zalo lúc…', cố ý không ghi 'đã gửi'"; ke-hoach §6: "KiN không biết tin có đi thật". [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 45 và 274]. ĐX-04 đổi số đo thành "Phiếu đã gửi → gia sư đã mở Zalo" (dòng 159–160).

**C7. Hạn mức "8 học sinh" so với ngách và quy mô KiN**
- Báo cáo: Free 8 học sinh, Pro không giới hạn (dòng 731); điều kiện bật Pro cần "≥ 200 gia sư hoạt động" (dòng 740).
- KiN: ngách "người dạy tự do 1–20 học viên" [Đối chiếu kho: docs/kin/CLAUDE-cho-kho-trien-khai.md, dòng 23]; hiện "25 học sinh" (anh Thanh kèm gia sư) [Đối chiếu kho: docs/kin/quyet-dinh-va-doi-chieu.md, dòng 138–139, ghi ngày 26/09]; ĐX-04: "Hiện quy mô còn rất nhỏ (25 học sinh); phần trăm trên mẫu nhỏ là ngộ nhận", dưới 10 mẫu thì "chưa đủ dữ liệu" [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 168]. Ghi chú anh em: mã hiện KHÔNG có giới hạn số lớp/học viên theo gia sư (hien_trang_kin.md dòng 100).
- Điều chưa khớp: ngưỡng bật Pro của báo cáo (200 gia sư) cách xa quy mô đã ghi trong kho; ĐX-04 chưa có chỉ số đếm số gia sư vượt một ngưỡng học sinh, trong khi báo cáo 8.5 nói "hệ thống vẫn đếm" (sáu chỉ số ĐX-04 ở ke-hoach dòng 158–164 không có chỉ số này).
- Lưu ý: ke-hoach Q6 đặt ngưỡng ĐX-08 "30% trong 2 tháng" (dòng 254) trùng hình thức với điều kiện bật Pro của báo cáo "≥ 30% … 2 tháng liên tiếp", nhưng áp cho việc khác (mở ĐX-08 ảnh chuyển khoản); đừng nhầm hai ngưỡng.

**C8. "Mẫu phiếu thu" và "lưu trữ ảnh" không có đối ứng trong KiN**
- Báo cáo: Free 4 mẫu phiếu, Pro "Tất cả (9+)"; lưu trữ ảnh bài làm + ảnh chuyển khoản 50MB / 2GB (dòng 732–733).
- KiN: phiếu là trang `/phieu/[token]` có QR, hết hạn sau 30 ngày; "Phiếu học phí dạng ảnh/PDF để gửi Zalo: chưa làm" [Đối chiếu kho: docs/kin/tien-do-dang-do.md, dòng 177; docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 52 và 145]. Tôi đã tìm "mẫu phiếu/template" trong `docs/kin/*.md`: không có khái niệm nhiều mẫu phiếu. Ảnh chuyển khoản là ĐX-08 (chưa làm, đụng tiền); "ảnh bài làm" không thấy trong kế hoạch.
- Hồ sơ công khai: báo cáo Pro có "ưu tiên hiển thị + huy hiệu 'Hoạt động'"; ke-hoach ĐX-05/Q3 chỉ sắp xếp mặc định "gia sư hoạt động gần đây lên trước" (dòng 189, 251), không gắn gói; Q4: "không nhóm nào bắt buộc" (dòng 252) trong khi báo cáo 8.9 chốt nhóm BẮT BUỘC (trường, bằng cấp/chứng chỉ chính, môn/cấp, khu vực, hình thức). Form "yêu cầu tìm gia sư" (báo cáo coi là tính năng Free) bị dừng ở KiN do dữ liệu trẻ em, chờ PH-225 (ke-hoach dòng 237). [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md]
- Xuất điểm danh: báo cáo tách Free Excel / Pro Excel+PDF; ĐX-03 làm CSV/Excel và "PDF = trang in" cùng nhau, chưa có phân tầng (ke-hoach dòng 141–143).

**C9. Các điểm KHỚP (để người viết biết đâu không cần cảnh báo)**
- Không thu phí kết nối/hoa hồng: KiN có nhãn "Không thu phí nhận lớp" và khung "không chuyển khoản trước buổi học thử" trên hồ sơ công khai. [Đối chiếu kho: docs/kin/tien-do-dang-do.md, dòng 164–165]
- Trợ giảng/đồng dạy hoãn: khớp với D02 (ke-hoach §2 ghi hàng "Trợ giảng / đồng dạy" là "Hoãn có chủ đích (D02)"). [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md dòng 55, 276; docs/kin/quyet-dinh-va-doi-chieu.md dòng 25]
- "KiN không giữ học phí": khớp. [Đối chiếu kho: docs/kin/CLAUDE-cho-kho-trien-khai.md, dòng 26]
- Lỗi lọc ngày trang phụ huynh của Sổ Gia Sư: ke-hoach ghi KiN "có vẻ không có" (mới đọc lướt). [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 53]
- Link phụ huynh khó đoán, thu hồi được: KiN dùng `/so-cua-con/[token]` 32 ký tự hex; báo cáo nghẽn #7 (slug đoán được) không áp cho KiN. [Đối chiếu kho: docs/kin/ke-hoach-phat-trien-tu-research.md, dòng 52]
- Chi phí Zalo OA: ke-hoach ĐX-04 ghi "Thanh ghi ~1.000.000đ/năm cộng khoảng 300đ/tin" (dòng 172) — bổ sung cho báo cáo (báo cáo chỉ nói ZNS "có phí", OTP "vài trăm đồng mỗi lần", dòng 711 và 769), cùng bậc độ lớn.

### Inferences
- [Suy luận] Khi viết báo cáo Pro: không dùng nguyên các hàng của bảng 8.5 làm gói của KiN; các hàng mẫu phiếu thu QR, lưu trữ ảnh bài làm/ảnh chuyển khoản, OCR, và ưu tiên hiển thị hồ sơ công khai giả định tính năng mà KiN chưa có hoặc cố ý không làm (xem C5, C8). Ba hàng (Học sinh đang dạy; Xuất Excel/PDF; Trợ giảng) có đối ứng trong KiN; theo ghi chú anh em (hien_trang_kin.md dòng 100, tôi không tự kiểm mã) KiN hiện cũng chưa giới hạn số học viên theo gia sư.
- [Suy luận] Ngưỡng 8 học sinh nằm giữa quy mô lớp 1–20 em của KiN; 25 học sinh của nhóm hiện tại vượt ngưỡng gần gấp ba. Nếu giữ "8" như Sổ Gia Sư, phần lớn người dùng thật của KiN sẽ ở vùng Pro; đây là suy luận số học, báo cáo không nói.
- [Suy luận] Cần chọn một trong hai cách nêu mốc giá: ghi rõ bốn mốc đang tồn tại (42.000đ báo cáo; 300.000đ mã; <20k bàn giao; <500.000đ TT-204) và nói chưa tài liệu nào chốt; tránh chọn một mốc rồi coi là "đã chốt".

### Gaps
- Tôi không đọc Google Sheet nên không xác nhận được cột I/J của TT-204, BE-020, NC2-Q9; các dòng ấy chỉ trích qua `hien_trang_kin.md`.
- Tôi không đọc được mã nhánh `KIN_TRIAL_MODE` / NC2-xxx (ghi chú anh em cũng nói vậy).
- Tôi chưa kiểm KiN có thực sự không có lỗi lọc ngày phụ huynh (ke-hoach ghi "mới đọc lướt, chưa chạy thử").
- Tôi không đối chiếu được `docs/kin/nghiep-vu/*` (ke-hoach dòng 283 nói các spec đó không có trong repo).
