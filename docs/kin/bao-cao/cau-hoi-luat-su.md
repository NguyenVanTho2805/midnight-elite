# Câu hỏi gửi luật sư (NC2-006)

> **Căn cứ để hỏi luật sư, KHÔNG phải ý kiến pháp lý.** Tài liệu này chỉ gom câu hỏi từ những gì đã ghi trong kho và trong sheet `Todo list - Kin class`. Không tự kết luận điều gì là được phép hay bị cấm. Tên văn bản nêu dưới đây là tên đã xuất hiện trong kho; người soạn chưa đọc bản gốc của chúng.

Ngày gom: 22/10/2026 · Nhánh: `claude/nang-cap-2` · Người gửi: chủ dự án (Thọ), phối hợp Thanh.

## 0. Hai điều cần biết trước khi gửi

1. **Văn bản căn cứ đang mâu thuẫn giữa hai tài liệu trong kho.** `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 8 viện Nghị định 13/2023 (đồng ý của cả trẻ và người giám hộ từ 7 tuổi). Mục 7 trong `pheu-gia-su.md` (do Thanh soạn, sheet PH-225 cột F cũng ghi vậy) nói Nghị định 13/2023 đã được thay bằng Luật 91/2025 và Nghị định 356/2025 từ 01/01/2026. Xin luật sư chốt văn bản nào đang có hiệu lực (xem Q-LS-01).
2. **Thanh chưa đọc được bản PDF gốc của Nghị định 356**; các điều 5, 6 (NĐ 356) và 8, 28 (Luật 91) chỉ có theo nguồn thứ cấp. Cần luật sư đối chiếu bản gốc (câu 6 của Thanh).

## (a) Bối cảnh: sản phẩm đang làm gì và không làm gì

KiN là phần mềm quản lý lớp cho gia sư, giáo viên tự do và trung tâm nhỏ (sổ lớp, điểm danh, phiếu học phí QR, báo cáo cho phụ huynh), cộng thêm mặt "góc tìm gia sư" cho phụ huynh (báo cáo research 19/10, mục 8.2).

**Đang làm:**
- Sổ lớp, điểm danh, phiếu học phí có mã QR và đối chiếu chuyển khoản (SePay); phụ huynh bấm "Tôi đã chuyển".
- Hồ sơ gia sư công khai (`/mentor/[id]`); ĐX-06 vừa thêm khu vực, hình thức dạy, trường/bằng cấp ("Tự khai"), giá tham khảo, tất cả tuỳ chọn.
- Link "Sổ của con" cho phụ huynh không cần đăng nhập; mời cả lớp một lần (ĐX-07 phương án nhẹ).
- Học sinh có tài khoản, cộng đồng và tin nhắn riêng đã được thiết kế (Figma) nhưng **chưa dựng** (PH-217–222, PH-226).

**Không làm / không có:**
- KiN **không giữ học phí**, **không thu hoa hồng**, không thu phí kết nối ở bất kỳ phía nào; doanh thu dự kiến duy nhất là gói Pro, hiện chạy thử miễn phí (báo cáo research 8.2, Q9).
- Chưa có pháp nhân (báo cáo research 8.2).
- Ảnh chuyển khoản (ĐX-08) và form tìm gia sư (ĐX-09) **chưa viết code**.
- Ảnh không bao giờ dùng để tự gạch nợ (quy tắc GD-20 trong NC1-092).

## (b) Bảng câu hỏi

Cột "Mở khoá" là việc sẽ được phép bắt đầu nếu có câu trả lời; không có nghĩa câu trả lời sẽ là "được".

### Nhóm 1 · Dữ liệu trẻ em và đồng ý

| Số | Câu hỏi | Vì sao hỏi (việc bị chặn) | Mở khoá |
|---|---|---|---|
| Q-LS-01 | Văn bản nào đang điều chỉnh dữ liệu cá nhân của trẻ em tại thời điểm KiN ra mắt: Nghị định 13/2023, hay Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP như PH-225 ghi? Hai tài liệu của kho đang viện hai văn bản khác nhau. | `CLAUDE-cho-kho-trien-khai.md` mục 8 vs `pheu-gia-su.md` mục 7 câu 1. Quyết định bảng `ParentConsent` phụ thuộc. | PH-208, ĐX-09 |
| Q-LS-02 | Mốc tuổi và ai phải đồng ý: từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện, trong trường hợp nào? Mốc "dưới 16 tuổi" ở KiN đang dùng có phải của Nghị định 147/2024 (mạng xã hội) chứ không phải luật dữ liệu? Bảng `ParentConsent` cần cột riêng cho từng bên không? | Mục 8 của file hướng dẫn: "đừng tự quyết". Câu 4 của Thanh. | PH-208, PH-211, PH-217–222, PH-226 |
| Q-LS-03 | Đồng ý phải "không đặt sẵn" và "lưu được bằng chứng": bằng chứng tối thiểu cần lưu những gì (thời điểm, phiên bản điều khoản, ai tích, từ thiết bị nào)? Ô đồng ý không tích sẵn kèm dòng thời gian có đủ không? | PH-208 thiết kế "ô đồng ý không tích sẵn, lưu bằng chứng đồng ý". Câu 2 của Thanh. | PH-208 |
| Q-LS-04 | Quyền xoá: yêu cầu xoá dữ liệu phải phản hồi trong bao lâu và thực hiện trong bao lâu (Thanh ghi 2 ngày làm việc và 20 ngày, theo nguồn thứ cấp)? Nút "Xoá dữ liệu của con" cần xoá tới mức nào với dữ liệu đã nằm trong phiếu học phí, điểm danh và sổ sách của gia sư? | Câu 3 của Thanh. Hiện sổ lớp, phiếu và buổi học là dữ liệu của gia sư, không chỉ của KiN. | PH-208, PH-225 |
| Q-LS-05 | KiN là "bên kiểm soát" hay "bên xử lý" dữ liệu học sinh do gia sư nhập (tên, lớp, điểm danh, số Zalo phụ huynh)? Gia sư có nghĩa vụ riêng không, và điều khoản KiN cần ghi gì? | Cả sản phẩm lưu dữ liệu học sinh do gia sư nhập; `/chinh-sach` chưa được đối chiếu (NC2-025). **Câu này do người gom thêm, không phải của Thanh.** | NC2-025, mọi việc có học sinh |
| Q-LS-06 | Cộng đồng có bảng tin công khai và tin nhắn riêng thì có bị coi là "mạng xã hội" theo Nghị định 147/2024 không? Nếu có thì kéo theo xác thực tài khoản và quy định cho người dưới 16 tuổi. Nghĩa vụ nặng chỉ áp cho nền tảng trên 1 triệu lượt truy cập/tháng (theo ghi chú của Thanh), nhưng muốn chắc. | Câu 5 của Thanh. | PH-217, PH-218–222, PH-226 |
| Q-LS-07 | Khi có tin nhắn riêng giữa học sinh: học sinh dưới 16 tuổi nhắn với người lạ, phụ huynh thấy con nhắn với ai và thời gian dùng nhưng không đọc nội dung, báo cáo tin nhắn đi thẳng quản trị, nội dung nguy hiểm bị khoá ngay. Thiết kế "năm lớp an toàn" này đủ chưa, thiếu gì? | PH-226 dừng chủ động. Thiết kế ở `pheu-gia-su.md` mục 4. | PH-226 |
| Q-LS-08 | Bài Công khai của học sinh 13–18 tuổi (tên hiển thị và ảnh) mà người chưa đăng nhập xem được, và Google lập chỉ mục bài của học sinh từ 16 tuổi (GD-26): có cần đồng ý riêng của phụ huynh không, lưu bằng chứng thế nào? | Câu 7 của Thanh (thêm 02/10). | PH-217, PH-218 |

### Nhóm 2 · Form tìm gia sư và đăng ký học thử

| Số | Câu hỏi | Vì sao hỏi | Mở khoá |
|---|---|---|---|
| Q-LS-09 | Form yêu cầu tìm gia sư **rút gọn, không thu tên con**, chỉ gồm cấp học, khu vực, giờ học và số Zalo phụ huynh: có còn là dữ liệu liên quan đến trẻ em không? Cấp học + khu vực + giờ học của một đứa trẻ đi kèm số điện thoại phụ huynh có làm xác định được trẻ không? | NC1-Q7 (Thọ). Mặc định: chưa viết code cho tới khi có trả lời, không tự kết luận bản rút gọn có thoát vùng dữ liệu trẻ em. | ĐX-09 (NC2-031, NC1-101..103), PH-211 |
| Q-LS-10 | Form đăng ký học thử không cần tài khoản (PH-208): nếu làm bản tối thiểu, không bắt buộc họ tên con, chỉ gia sư thấy số Zalo, có đủ không, hay vẫn phải chờ trả lời Q-LS-01..04? | PH-208 cột I hỏi Thọ chọn "làm bản tối thiểu hay chờ luật sư". | PH-208 |
| Q-LS-11 | Phụ huynh (người lớn) tự đăng yêu cầu và số Zalo của họ lộ cho gia sư được chọn, tối đa 5 gia sư nhắn lại: phụ huynh cần đồng ý gì cho việc chia sẻ số này, và thu hồi thế nào? | PH-211 (P3, Giai đoạn 2). | PH-211 |
| Q-LS-12 | Chống spam bằng reCAPTCHA v3 cộng giới hạn theo số điện thoại và IP (3 lần/ngày/số), không OTP: dữ liệu IP và điểm reCAPTCHA có cần nêu trong điều khoản và đồng ý không? | Báo cáo research 8.9, nằm trong ĐX-09. | ĐX-09 |

### Nhóm 3 · Ảnh chuyển khoản, biên lai, đối soát

| Số | Câu hỏi | Vì sao hỏi | Mở khoá |
|---|---|---|---|
| Q-LS-13 | Ảnh chuyển khoản / biên lai gia sư hoặc phụ huynh tải lên (có số tài khoản và tên người chuyển) có là dữ liệu cá nhân không, và có thuộc loại nhạy cảm không? Cần đồng ý gì, lưu bao lâu, xoá thế nào? | NC1-090..092 (ĐX-08): "Biên lai có số tài khoản và tên người chuyển nên là dữ liệu cá nhân". Hiện nhóm này còn bị chặn thêm bởi quyết định về tiền Q6 (ngưỡng mở ĐX-08) ngoài pháp lý. | ĐX-08 (NC2-030) |
| Q-LS-14 | Phụ huynh tự tải ảnh lên (không phải gia sư): ai chịu trách nhiệm về nội dung ảnh, KiN có phải kiểm duyệt không? | NC1-092: phụ huynh tải ảnh cần giới hạn tốc độ; chưa rõ trách nhiệm. **Người gom thêm.** | ĐX-08 |
| Q-LS-15 | Đối soát chuyển khoản (TT-200): KiN đọc giao dịch tiền vào tài khoản của gia sư qua SePay. Dữ liệu giao dịch của gia sư và tên phụ huynh trong nội dung chuyển khoản cần đồng ý gì theo Luật 91? Khi KiN bắt đầu thu phí, cách này có thành "trung gian thanh toán" theo Nghị định 52/2024 không? | Câu 8 của Thanh. KiN hiện không giữ tiền; câu hỏi là việc đọc giao dịch có kéo KiN vào vùng thanh toán không. | TT-200, ĐX-08 |

### Nhóm 4 · Hồ sơ công khai (Thông tư 29/2024/TT-BGDĐT)

| Số | Câu hỏi | Vì sao hỏi | Mở khoá |
|---|---|---|---|
| Q-LS-16 | Thông tư 29/2024/TT-BGDĐT (theo `CLAUDE-cho-kho-trien-khai.md`: người dạy thêm có thu tiền phải công khai lịch dạy, tên người dạy và mức học phí) có áp cho gia sư tự do dùng KiN không, và áp cho KiN với tư cách nền tảng không? Hồ sơ công khai có bắt buộc hiện lịch dạy và học phí không? | NC1-Q4 và NC1-073. Dữ kiện đã kiểm 21/10: trước ĐX-06, `/mentor/[id]` không hiện lịch dạy và học phí; `/api/tutors/[id]` không trả lịch; trang khoá học `/khoa-hoc/[slug]` hiện giá khoá; giá tham khảo mới thêm là tự bật, mặc định tắt. | PH-207, NC2-022 (Q11) |
| Q-LS-17 | Nếu có bắt buộc, nhóm nào buộc phải hiện khi hồ sơ bật (trường, bằng cấp, môn/cấp, khu vực, hình thức, giá)? Thọ đã chốt 21/10 "không nhóm nào bắt buộc"; báo cáo research 8.9 (19/10) từng ghi một số mục bắt buộc hiện. | NC2-Q11. Cần luật sư để chốt giữa hai quyết định. | NC2-022 |

### Nhóm 5 · Liên kết phụ huynh không cần đăng nhập

| Số | Câu hỏi | Vì sao hỏi | Mở khoá |
|---|---|---|---|
| Q-LS-18 | Link "Sổ của con" là đường dẫn có mã (token), thu hồi được, hạn 30 ngày (theo mô tả NC2-025): ai cầm link xem được dữ liệu của con (điểm danh, học phí). Có cần đồng ý rõ của phụ huynh trước khi tạo link, và gia sư có quyền gửi link đó cho người khác không? | Báo cáo research 8.7; còn mở trong `tien-do-dang-do.md`: "có cho link hết hạn không (hiện không)". | NC2-025 |
| Q-LS-19 | Mời cả lớp một lần (ĐX-07): gia sư nhập danh sách tên và số Zalo phụ huynh thay mặt họ. Phụ huynh chưa đồng ý mà số đã nằm trong hệ thống: gia sư hay KiN chịu trách nhiệm về sự đồng ý? | ĐX-07 phương án nhẹ đã làm xong phần mã; KHÔNG làm học sinh không tài khoản (Q5, Thọ chốt 21/10). **Người gom thêm.** | ĐX-07, ĐX-09 |

### Nhóm 6 · Gia sư tự khai bằng cấp và tổ chức

| Số | Câu hỏi | Vì sao hỏi | Mở khoá |
|---|---|---|---|
| Q-LS-20 | Hồ sơ hiển thị trường/bằng cấp gắn nhãn "Tự khai" (≤100 ký tự, không xác minh): KiN có trách nhiệm gì nếu thông tin sai; điều khoản cần ghi gì? Có cần cơ chế báo cáo hồ sơ (đã có `tutor_profile_reports`) và quy trình xử lý? | NC1-Q4, báo cáo research 8.7 và NC2-025. | NC2-025, PH-207 |
| Q-LS-21 | Zalo OA (TT-199 giai đoạn 2): một OA của KiN gửi tin thay cho nhiều gia sư có được không, hay mỗi gia sư phải có OA riêng? KiN cần đăng ký hộ kinh doanh hay doanh nghiệp? | Câu 9 của Thanh. | TT-199 giai đoạn 2 |

## (c) Chín câu của Thanh, chép nguyên văn

**Nguồn:** sheet `Todo list - Kin class`, tab `Trang tính1`, dòng PH-225, cột K "Thanh Note" nói: "[02/10] Thêm 3 câu hỏi (mục 7, câu 7–9 trong pheu-gia-su.md) … [30/09] Việc của anh: danh sách câu hỏi ở mục 7 của docs/kin/nghiep-vu/pheu-gia-su.md". Nghĩa là **ô K không chứa 9 câu**, nó trỏ tới mục 7 của `pheu-gia-su.md`. Tệp này **không có trên nhánh hiện tại** (NC2-006 đã ghi) nhưng còn trong lịch sử git: chép dưới đây từ `git show a191e16:docs/kin/nghiep-vu/pheu-gia-su.md`, mục 7 "Pháp lý: việc cần hỏi luật sư" (a191e16, 01/10/2026; tác giả Nguyễn Phúc Thanh).

Dòng mở đầu của mục đó: "Đây là căn cứ để hỏi, không phải ý kiến pháp lý. Tôi không phải luật sư."

1. **Nghị định 13/2023 đã hết hiệu lực từ 01/01/2026**, thay bằng Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP. Đã ghi chú trong đặc tả cộng đồng 24/09.
2. Đồng ý: không được đặt sẵn là đồng ý, phải lưu được bằng chứng (NĐ 356, Điều 6 theo bản tóm tắt thứ cấp). A2 và C4 đã thiết kế theo hướng này.
3. Yêu cầu xoá dữ liệu: phản hồi trong 2 ngày làm việc, thực hiện trong 20 ngày (NĐ 356, Điều 5, theo nguồn thứ cấp). Cần một nút "Xoá dữ liệu của con" và quy trình phía quản trị.
4. Trẻ em: Luật 91 có mốc từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện trong một số trường hợp. Mốc "dưới 16 tuổi" đến từ Nghị định 147/2024 về mạng xã hội, không phải luật dữ liệu.
5. **Cộng đồng có bảng tin công khai và tin nhắn riêng thì có bị coi là "mạng xã hội" theo NĐ 147/2024 không?** Nếu có thì kéo theo xác thực tài khoản và quy định cho người dưới 16. Nghĩa vụ nặng chỉ áp cho nền tảng trên 1 triệu lượt truy cập/tháng, nhưng phải hỏi để chắc.
6. Chưa đọc được bản PDF gốc của NĐ 356. Nhờ luật sư đối chiếu Điều 5, Điều 6 NĐ 356 và Điều 8, 28 Luật 91.
7. **Thêm 02/10, sau quyết định cộng đồng xem tự do:** người chưa đăng nhập xem được bài Công khai của học sinh 13–18 tuổi (tên hiển thị và ảnh), Google lập chỉ mục bài của học sinh từ 16 tuổi (`GD-26`). Hiển thị công khai như vậy có cần đồng ý riêng của phụ huynh không, và cần lưu bằng chứng đồng ý thế nào?
8. **Đối soát chuyển khoản (TT-200):** KiN đọc giao dịch tiền vào tài khoản của gia sư qua SePay. Dữ liệu giao dịch của gia sư và tên phụ huynh trong nội dung chuyển khoản cần đồng ý gì theo Luật 91? Khi KiN bắt đầu thu phí, cách này có thành trung gian thanh toán theo NĐ 52/2024 không?
9. **Zalo OA (TT-199 giai đoạn 2):** một OA của KiN gửi tin thay cho nhiều gia sư có được không, hay mỗi gia sư phải có OA riêng? KiN cần đăng ký hộ kinh doanh hay doanh nghiệp?

Ghi chú: các mục 1, 2, 3, 4 và 6 là điều Thanh ghi lại để kiểm chứng; chỉ các mục 5, 7, 8, 9 là câu hỏi dạng hỏi. Bản bảng ở (b) đã chuyển cả 9 mục thành câu hỏi. Đối chiếu: câu 1 → Q-LS-01; 2 → Q-LS-03; 3 → Q-LS-04; 4 → Q-LS-02; 5 → Q-LS-06; 6 → mục 0.2; 7 → Q-LS-08; 8 → Q-LS-15; 9 → Q-LS-21.

## (d) Việc làm được ngay trong lúc chờ luật sư

Chỉ gồm việc không đụng dữ liệu trẻ em và không đụng tiền, theo `CLAUDE-cho-kho-trien-khai.md` mục 9 và `ke-hoach-nang-cap-2.md`:

- NC2-012 · đối chiếu các dòng dở ở Trang tính1 (TK-170, TK-173, PH-207/210/212/213/214/215), ghi còn thiếu gì.
- NC2-013 · phần chỉ-giao-diện đã có khung Figma, không đổi cách tính tiền.
- NC2-020 · số đo kích hoạt gia sư ở `/admin/so-do` (không trả tên).
- NC2-021 · đo onboarding "lớp đầu tiên trong 2 phút".
- NC2-022 · công tắc Hiện/Ẩn hồ sơ công khai (mặc định HIỆN); chờ Q11, nhưng nếu chỉ làm công tắc thì không đụng trẻ em.
- NC2-024 · "Gửi lịch tuần qua Zalo", tin soạn sẵn không tên học sinh.
- NC2-025 · dự thảo rà `/chinh-sach` ở dạng tài liệu, không sửa trang; đem kèm bản này cho luật sư.
- NC2-010 / NC2-011 · tin đẩy (chữ đẩy không tên, không số tiền, công tắc mặc định TẮT).
- Gửi luật sư kèm: sơ đồ dữ liệu (bảng `ParentConsent`, `tutor_profile_reports`, `bank_transactions`), nội dung `/chinh-sach` hiện tại, và ảnh Figma các khung A2, A5, C1, C6.
- Chuẩn bị sẵn nhưng không dựng: danh sách nơi cần ô đồng ý (PH-208, PH-211) để áp ngay khi luật sư trả lời.

**Chưa làm được cho tới khi có trả lời:** PH-208, PH-211, PH-217–222, PH-226, ĐX-09 (cần Q-LS-01..12); ĐX-08 (cần Q-LS-13..15 và quyết định Q6 về tiền).
