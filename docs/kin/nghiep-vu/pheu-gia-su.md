# Phễu gia sư: kéo nhu cầu từ nhóm Facebook, Zalo về KiN

Soạn 30/09/2026 cho anh Thanh (BA) và anh Thọ (code). Tài liệu trả lời câu hỏi:
**gia sư đang tìm học sinh qua nhóm Facebook, làm sao KiN thu được phễu đó về?**

Thiết kế Figma, file *KiN Design System*, trang *🌱 Phễu, Zalo & Cộng đồng — v2 (30/09)*
(node `182:74`), cùng hai khung mới ở trang *📚 Lớp & Thư viện*. Danh sách node ở mục 10.
Tên, số điện thoại và mọi con số trong khung đều là **dữ liệu mẫu**.

---

## 0. Trả lời ngắn

KiN không kéo được phễu bằng máy. Meta đã gỡ quyền đăng bài và đọc thành viên nhóm qua API
từ 22/04/2024, và đăng tự động vào nhóm thì dễ bị khoá tài khoản. Cách còn lại là để **mỗi
link gia sư tự dán, tự gửi đều dẫn về KiN**, rồi đo xem link nào mang người về.

Có bốn vòng như vậy, xếp theo mức nên làm trước:

| # | Vòng | Ai gửi link | Người nhận thấy gì | Khung |
|---|---|---|---|---|
| 1 | Báo cáo buổi | gia sư gửi phụ huynh qua Zalo | báo cáo con, cuối trang có hồ sơ gia sư | B1, B2 |
| 2 | Bài đăng tìm lớp | gia sư dán vào nhóm Facebook | hồ sơ công khai và nút học thử | A3, A1, A2 |
| 3 | Lời mời bạn học | học sinh gửi bạn cùng lớp | giới thiệu nhóm học, bạn gửi bố mẹ đăng ký | B3 |
| 4 | Yêu cầu tìm gia sư | phụ huynh đăng trên KiN | gia sư phù hợp nhắn lại | A5 (Giai đoạn 2) |

Vòng 1 xếp đầu vì nó không tốn công gia sư: báo cáo buổi đằng nào cũng phải gửi. Phụ huynh
hài lòng chuyển tiếp báo cáo cho người quen, và người quen thấy một gia sư có số liệu thật.
Khảo sát 09/2026 cho thấy 47% gia sư lấy học sinh từ phụ huynh cũ và 63% từ người quen.
Kênh này có sẵn, KiN chỉ cần làm cho nó để lại dấu vết.

---

## 1. Phễu hiện nay

- 83% gia sư trong khảo sát KiN (23 phản hồi, 20–22/09/2026) tìm học sinh qua nhóm Facebook
  tìm gia sư. Mẫu nhỏ, chỉ để định hướng.
- Nhiều nhóm do trung tâm làm quản trị. Mức phí nhận lớp các trung tâm tự công bố: Tri Thức
  25%, Gia Sư Việt 30–40%, Dân Trí 35–45% lương tháng đầu.
- Lừa đảo lặp lại nhiều năm: Tuổi Trẻ 2020 và 2021; Dân trí 16/12/2025 (mất 800.000đ);
  VTV 22/06/2026 (phụ huynh giả, trên 30 triệu đồng mỗi vụ).

Vì vậy KiN có hai thứ để hứa với gia sư: **không thu phí nhận lớp** và **không có lớp ảo**.
Cả hai đều phải nhìn thấy được trên hồ sơ (A1), không chỉ nằm trong điều khoản.

---

## 2. Vòng 2 chi tiết: từ bài đăng trong nhóm đến lớp

### A3 · Soạn bài đăng tìm lớp

- KiN soạn sẵn bài từ hồ sơ: môn, lớp, giờ còn trống, học phí, số buổi đã dạy, tỉ lệ
  phụ huynh xác nhận.
- Mỗi nhóm có **link riêng** (đuôi `?n=fb-hn9`). Không có nó thì không biết nhóm nào mang
  phụ huynh tới.
- Ba nút: Sao chép bài đăng, Chia sẻ lên Facebook (nút chia sẻ vẫn hoạt động), Gửi qua Zalo.
- Dòng cuối bài luôn có: *"Thầy không nhận chuyển khoản trước buổi học thử."*

### A1 · Hồ sơ công khai

- Ba con số lấy từ sổ lớp, gia sư **không tự sửa được**: số buổi đã dạy, tỉ lệ buổi được
  phụ huynh xác nhận, số lớp đang dạy.
- Đánh giá: chỉ phụ huynh có con học **đủ 4 buổi đã xác nhận** mới viết được. Hiện tên
  dạng "Phụ huynh học sinh lớp 9", không hiện tên thật.
- Hai nhãn tin cậy: "Đã xác minh số điện thoại", "Không thu phí nhận lớp".
- Chân trang: *"Hồ sơ tạo bằng KiN · sổ lớp miễn phí cho gia sư → Tạo hồ sơ của bạn"*.
  Đây là vòng lấy **gia sư mới**, học từ Calendly: huy hiệu "Powered by" bật sẵn.

### A2 · Đăng ký học thử, không cần tài khoản

- Bốn trường: tên con, lớp và môn, khung giờ, số Zalo.
- Số Zalo ghi rõ "Chỉ Thầy Thanh thấy số này".
- Ô đồng ý **không tích sẵn**. KiN lưu lại thời điểm và nội dung câu đồng ý (xem mục 7).
- Sau khi gửi: *"Nếu ai đòi chuyển khoản trước buổi học thử, anh/chị đừng chuyển và bấm Báo cáo."*

### D · Bảng phễu của quản trị

Năm bước đo: mở link hồ sơ → xem hết hồ sơ → gửi đăng ký học thử → học thử xong → nhận lớp.
Chia theo kênh bằng đuôi `?n=`. Bảng mẫu trong Figma cố ý cho thấy điều cần kiểm bằng số thật:
nhóm Facebook nhiều lượt nhưng chuyển đổi thấp, còn báo cáo được chuyển tiếp ít lượt nhưng
chuyển đổi cao hơn nhiều lần.

Không đếm được bài đăng trong nhóm, chỉ đếm lượt bấm link. Ghi rõ điều này trên bảng.

---

## 3. Zalo và Messenger cho ba vai

| Vai | Làm được ngay | Để sau |
|---|---|---|
| Gia sư | Đăng nhập Zalo; gửi báo cáo, nhắc lịch bằng tin soạn sẵn (bấm một lần); gắn link nhóm Zalo lớp và `m.me` | Zalo OA tự gửi |
| Phụ huynh | Nhận link trong Zalo, mở không cần tài khoản; thẻ xem trước rõ ràng | Theo dõi OA để nhận tin tự động |
| Học sinh | Mời bạn qua Zalo, Messenger, chép link cho Instagram, mã QR | Mini App |

### Những điều đã kiểm (30/09/2026)

- **Tin mẫu Zalo (ZBS).** Từ 01/01/2026 Zalo gộp tin ZNS và tin UID vào "ZBS Template Message".
  Tin chăm sóc giới hạn 1 tin/ngày, 30 tin/tháng mỗi người. Người chưa quan tâm OA thì tin
  rơi vào mục **Business Box**, dễ bị bỏ qua. Giá chính thức: 200đ/tin mẫu thường, 300đ/tin
  xác thực hoặc thanh toán, chưa gồm VAT.
- **Nhóm chat qua OA: "Quản lý nhóm (GMF)".** OA tạo nhóm và nhắn vào nhóm qua API. Tin OA
  gửi vào nhóm đang miễn phí đến 31/12/2026. Nhóm mua thêm có phí duy trì 25.000–300.000đ/tháng
  theo sức chứa. Cần OA đã xác thực; hộ kinh doanh có đủ điều kiện không thì chưa rõ, phải
  hỏi Zalo.
- **Link `zalo.me/<số điện thoại>` để lộ số.** Vì vậy nút "Hiện số Zalo trên hồ sơ" tắt sẵn (B4).
- **Đăng nhập bằng Zalo không trả về số điện thoại.** Số điện thoại vẫn xác minh bằng OTP riêng.
  Mini App có API lấy số, nhưng cần Mini App đã xác thực và người dùng đồng ý.
- **Mini App mục Giáo dục phải xác thực giấy tờ** theo nhóm ngành đặc thù. Để sau.
- **Messenger.** `m.me/<Trang>?text=` điền sẵn tin được. Nút Chat Plugin đã ngừng từ 09/05/2024.
  "Trả lời riêng" chỉ chắc chắn dùng được với bình luận trên bài của chính Trang, trong 7 ngày.
  **Không** dùng để trả lời bài phụ huynh đăng trong nhóm.
- **Instagram**: không nhắn trước được cho người chưa nhắn mình, nên chỉ có nút chép link.

### Quy tắc khi gửi vào nhóm Zalo lớp (B2, khung Lớp mới)

- Thẻ xem trước của link gửi nhóm **không có tên, điểm hay nhận xét của con**. Chỉ phụ huynh
  của con mở được nội dung.
- Tin điểm danh vào nhóm chỉ ghi "đủ 5/5 bạn". Không nêu em nào vắng.
- **Phiếu học phí không bao giờ gửi vào nhóm.** Luôn gửi riêng.
- Mỗi link có đuôi nguồn (`?n=zl-rieng`, `?n=zl-nhom`) để đo ở bảng D.

---

## 4. Cộng đồng học tập: dùng như Threads và Instagram

**Đặc tả này (30/09) thay đặc tả 24/09** (`../thiet-ke/cong-dong.md`). Bản 24/09 chỉ còn để
chắt lọc; phần nào còn dùng được ghi ở cuối mục này.

Học sinh đã quen Threads và Instagram, nên cộng đồng KiN dùng đúng những thói quen đó để
không phải học cách dùng. An toàn dựa trên cài đặt cho tuổi teen (học từ Instagram Teen),
không dựa vào cấm tính năng.

| Khung | Nội dung |
|---|---|
| C1 | Bảng tin: vòng tin theo nhóm, ba thẻ Nhóm của bạn / Hỏi bài / Tiến bộ. Có "Cổ vũ" nhưng **không đếm lượt thích công khai** |
| C2 | Chi tiết câu hỏi: gợi ý bị che tới khi chạm, lời giải khoá tới khi thử lại (giống NV-188). Người hỏi đánh dấu "đã hiểu" thì câu đó vào kho câu hỏi của lớp |
| C3 | Soạn bài có chọn người xem: nhóm này, chỉ gia sư, **Bạn thân** (như Close Friends), **Mọi người trên KiN** (như Threads; dưới 16 tuổi cần phụ huynh bật, dưới 13 không đăng) |
| C4 | An toàn: riêng tư mặc định, giờ nghỉ 22:00–07:00, ai được nhắn cho bạn, ẩn từ xúc phạm, hạn chế một người, báo cáo, bản ghi phụ huynh đồng ý |
| C5 | Gia sư duyệt bài trong nhóm mình theo kiểu hộp thư Outlook; quyền đăng theo lớp ba mức |
| C6 | **Tin nhắn** như Instagram Direct: thẻ Bạn bè / Nhóm học / Gia sư / Yêu cầu |

### Tin nhắn riêng giữa học sinh: có, kèm năm lớp an toàn

1. Nhắn thẳng được với: bạn cùng nhóm học, bạn theo dõi nhau, gia sư.
2. Người khác vào **Yêu cầu nhắn tin**: tin bị ẩn, ảnh và link không hiện tới khi chấp nhận.
   Học sinh dưới 16 tuổi không nhận ảnh từ người lạ.
3. Giờ nghỉ 22:00–07:00: tin vẫn đến nhưng không báo.
4. Phụ huynh thấy con nhắn với ai và thời gian dùng, **không đọc nội dung** (như chế độ giám
   sát của Instagram). Gia sư không đọc tin nhắn riêng giữa học sinh.
5. Báo cáo tin nhắn đi thẳng tới quản trị KiN. Nội dung nguy hiểm (tự hại, xâm hại) bị khoá
   ngay, không chờ ai duyệt.

Quyền đăng mặc định trong nhóm lớp mới: **"Chỉ trả lời bài của gia sư"**. Gia sư mở rộng khi
lớp đã quen.

### Chắt lọc từ đặc tả 24/09

**Còn dùng:**

- Gia sư trả lời bằng tên thật và hồ sơ thật, có nhãn "Gia sư" (C2).
- Chỉ gia sư đã trả lời một câu hỏi mới được mời người hỏi học thử. Hạn mức: 5 lời mời đang
  chờ mỗi gia sư, 2 buổi thử miễn phí mỗi tháng mỗi học sinh (số của bản dựng cũ, vẫn là đề xuất).
- Thẻ thoả thuận học thử sáu dòng, khoá sau khi chốt, không sửa một phía.
- Phụ huynh chỉ được gọi vào từ bước chốt buổi thử; tên thật, số điện thoại, địa chỉ chỉ
  lộ cho gia sư sau khi phụ huynh đồng ý.
- Bài có số điện thoại hoặc link ngoài giữ lại chờ duyệt.

**Không dùng nữa:**

- "Cấm tin nhắn riêng giữa học sinh với học sinh". Thay bằng năm lớp an toàn ở trên.
- Hỏi đáp công khai là một diễn đàn riêng, hỏi không cần tài khoản. Nay "Mọi người trên KiN"
  là một lựa chọn người xem trong bảng tin (C3).
- Căn cứ Nghị định 13/2023 (hết hiệu lực từ 01/01/2026, xem mục 7).

---

## 5. Những điểm hay đưa vào Lớp

Rà lại bốn bản nghiên cứu (phần mềm gia sư quy mô nhỏ 29/09, Khan 27/09, soạn giáo án
29/09, phễu 30/09). Năm điểm được đưa vào hai khung mới ở trang Lớp:

| Điểm | Lấy từ | Vào đâu |
|---|---|---|
| Nhóm Zalo sẵn có làm "cổng phụ huynh", không bắt tải app | Phần mềm gia sư quy mô nhỏ (Comiru với LINE, ClassUp với Kakao) | Lớp — Tiến bộ và kết nối |
| Mức thành thạo lên và xuống; lên "Vững" phải qua bài trộn làm cách 1 tuần | Khan (5 mức, mastery challenge) | Lớp — Tiến bộ và kết nối |
| Câu hỏi của học sinh quay lại thành bài buổi sau | Cộng đồng C2 | Lớp — Kho câu hỏi |
| Kế hoạch buổi theo 4 hoạt động: Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng; mỗi hoạt động có "Sản phẩm" | Công văn 5512 (khung giáo án giáo viên đã quen) | Lớp — Buổi học |
| Một lần soạn ra hai bản: bản gia sư và phiếu học sinh không có đáp án, chỉ có câu hỏi dẫn đường | Bản nghiên cứu soạn giáo án (đầu vào đơn, đầu ra kép) | Lớp — Buổi học |

Soạn nháp bằng AI để ở **Đợt 2, dùng Coin**, khớp với kế hoạch sau khảo sát. AI chỉ soạn
nháp, gia sư sửa rồi mới gửi.

Mức thành thạo 5 bậc là phần mở rộng của NV-185. Quy tắc "Đạt ngưỡng" của NV-185 giữ nguyên;
5 bậc chỉ hiện cho gia sư. Chưa chốt ngưỡng từng bậc (xem mục 9).

---

## 6. Đánh giá bản Gemini Deep Research 30/09

Bản "Nghiên cứu Startup Gia sư" (Gemini, 214 trang nguồn) có ích nhưng phải lọc.
Tôi đã cho một lượt kiểm chứng độc lập mở lại nguồn gốc.

**Dùng được:**

- Vòng báo cáo có "Powered by" giống Calendly. Đây là vòng 1 ở mục 0.
- Chuyển ZNS sang ZBS, giới hạn 1 tin/ngày, Business Box. Đã kiểm, đúng.
- Có thể tạo nhóm và nhắn nhóm qua OA. Đã kiểm, đúng, nhưng tên đúng là "Quản lý nhóm (GMF)".
- Đánh giá chỉ mở khi có giao dịch thật. Ý đúng. KiN chưa có đối soát tự động (TT-200), nên
  bản đầu dùng mốc **4 buổi đã được phụ huynh xác nhận**.
- Preply thu 100% buổi thử với học sinh mới, sau đó 33% giảm dần còn 18%; Wyzant giữ 25%.
  Đã kiểm, đúng. Dùng làm lý do định vị "không cắt phần trăm".

**Sai hoặc lỗi thời:**

- Gói OA "Nâng cao 99.000đ" và "Premium 399.000đ": giá năm 2023, đã ngừng bán.
- "Tin nhóm không tính phí": chỉ miễn phí đến 31/12/2026.
- Dùng Messenger "trả lời riêng" để tự nhắn phụ huynh đăng bài trong nhóm: không có nguồn nào
  xác nhận làm được với bài của thành viên nhóm. Không đưa vào kế hoạch.
- Mức phạt 5% doanh thu: thuộc Luật 91/2025/QH15 và áp cho chuyển dữ liệu ra nước ngoài trái
  quy định, không phải NĐ 356 và không phải mọi vi phạm.

**Không nên làm, dù bản Gemini đề xuất:**

- **Bán quảng cáo nhắm theo dữ liệu học sinh và phụ huynh**, đặt quảng cáo ngay dưới báo cáo
  tiến độ của con, hay quảng cáo vay trả góp lúc phụ huynh vừa đóng học phí. Việc này phá
  đúng thứ KiN đang bán là niềm tin. Về luật, dùng dữ liệu khách hàng để kinh doanh quảng cáo
  phải có đồng ý riêng và cách từ chối (Luật 91/2025, Điều 28). Nếu có ngày cần tiền, đường
  thực tế hơn là gói trả phí cho gia sư (khảo sát: 26% sẵn sàng trả từ 50.000đ/tháng) hoặc Coin.
- **Bắt phụ huynh theo dõi OA mới được dùng sổ lớp.** Chặn ngay cửa vào. Nên để theo dõi OA là
  tuỳ chọn, đổi lại được nhắc tự động.
- **Hợp tác chia doanh thu với quản trị nhóm Facebook.** Chưa bỏ hẳn, nhưng để sau: KiN miễn phí
  nên chưa có doanh thu để chia, và nhiều quản trị viên chính là trung tâm thu phí nhận lớp.

---

## 7. Pháp lý: việc cần hỏi luật sư

Đây là căn cứ để hỏi, không phải ý kiến pháp lý. Tôi không phải luật sư.

1. **Nghị định 13/2023 đã hết hiệu lực từ 01/01/2026**, thay bằng Luật Bảo vệ dữ liệu cá nhân
   91/2025/QH15 và Nghị định 356/2025/NĐ-CP. Đã ghi chú trong đặc tả cộng đồng 24/09.
2. Đồng ý: không được đặt sẵn là đồng ý, phải lưu được bằng chứng (NĐ 356, Điều 6 theo bản tóm
   tắt thứ cấp). A2 và C4 đã thiết kế theo hướng này.
3. Yêu cầu xoá dữ liệu: phản hồi trong 2 ngày làm việc, thực hiện trong 20 ngày (NĐ 356,
   Điều 5, theo nguồn thứ cấp). Cần một nút "Xoá dữ liệu của con" và quy trình phía quản trị.
4. Trẻ em: Luật 91 có mốc từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện trong một số
   trường hợp. Mốc "dưới 16 tuổi" đến từ Nghị định 147/2024 về mạng xã hội, không phải luật
   dữ liệu.
5. **Cộng đồng có bảng tin công khai và tin nhắn riêng thì có bị coi là "mạng xã hội" theo NĐ 147/2024 không?**
   Nếu có thì kéo theo xác thực tài khoản và quy định cho người dưới 16. Nghĩa vụ nặng chỉ áp
   cho nền tảng trên 1 triệu lượt truy cập/tháng, nhưng phải hỏi để chắc.
6. Chưa đọc được bản PDF gốc của NĐ 356. Nhờ luật sư đối chiếu Điều 5, Điều 6 NĐ 356 và
   Điều 8, 28 Luật 91.

---

## 8. Lộ trình ba giai đoạn và chỉ số

| Giai đoạn | Làm gì | Chỉ số chính | Ngưỡng chuyển sang giai đoạn sau |
|---|---|---|---|
| 1 · Sổ lớp để lại dấu vết | B1, B2, A1, A2, A3, đuôi `?n=` và bảng D | Gia sư gửi ít nhất 1 báo cáo/tuần; lượt mở link từ báo cáo; đăng ký học thử | anh Thanh đặt khi có 4 tuần số liệu |
| 2 · Nhóm học và lời mời | C1–C6, B3, khung Lớp mới, nhóm Zalo lớp | Học sinh hoạt động hằng tuần trong nhóm; lời mời được phụ huynh đồng ý; tỉ lệ câu hỏi có trả lời trong 24 giờ | như trên |
| 3 · Phụ huynh tìm gia sư | A5, xem xét hợp tác quản trị nhóm | Thời gian từ lúc đăng yêu cầu đến khi có gia sư nhắn lại; tỉ lệ nhận lớp | chỉ mở khi mỗi khu vực đủ gia sư |

Bốn chỉ số theo dõi từ ngày đầu:

1. **Tỉ lệ nhận lớp trên lượt mở link, theo kênh.** Số chính để quyết định đầu tư kênh nào.
2. **Hệ số lan truyền của báo cáo**: số phụ huynh mới đăng ký học thử từ link báo cáo, chia
   cho số phụ huynh đang nhận báo cáo.
3. **Thời gian gia sư nhắn lại sau đăng ký học thử** (trung vị). Hứa với phụ huynh: trong 24 giờ.
4. **Số báo cáo lừa đảo và thời gian xử lý.** Nếu con số này tăng mà không xử lý, lời hứa
   "không có lớp ảo" mất giá.

---

## 9. Việc anh Thanh cần chốt

1. Ngưỡng từng bậc thành thạo (Đã thử, Quen, Thành thạo, Vững). Đề xuất để gia sư thấy, chưa
   đưa lên phiếu phụ huynh.
2. Mốc mở đánh giá trên hồ sơ: 4 buổi đã xác nhận (đề xuất), hay chờ có đối soát VietQR.
3. Nhóm học tối đa 8 bạn (đề xuất, học từ nhóm học của Quizlet) hay để gia sư tự đặt.
4. Tên miền cho link công khai. Các khung đang dùng `kin.vn/...` làm mẫu.
5. Có đăng ký Zalo OA không, và dưới tư cách nào. Việc này chặn nhắc lịch tự động và GMF.

---

## 10. Figma

Trang *🌱 Phễu, Zalo & Cộng đồng — v2 (30/09)*, node trang `182:74`:

| Khung | Node |
|---|---|
| A1 · Hồ sơ công khai gia sư | `182:78` |
| A2 · Phụ huynh đăng ký học thử | `182:131` |
| A3 · Gia sư soạn bài đăng tìm học sinh | `184:74` |
| A5 · Phụ huynh đăng yêu cầu tìm gia sư (Giai đoạn 2) | `185:74` |
| B1 · Gửi báo cáo buổi vào Zalo / Messenger | `186:77` |
| B2 · Thẻ xem trước link | `186:112` |
| B3 · Học sinh mời bạn vào nhóm học | `187:74` |
| B4 · Cài đặt → Kết nối | `187:124` |
| C1 · Cộng đồng — bảng tin nhóm | `188:77` |
| C2 · Chi tiết câu hỏi | `188:172` |
| C3 · Soạn bài, chọn người xem | `189:74` |
| C4 · An toàn và quyền riêng tư | `189:124` |
| C5 · Gia sư duyệt cộng đồng | `190:74` |
| C6 · Tin nhắn | `197:74` |
| D · Bảng phễu quản trị | `191:77` |

Trang *📚 Lớp & Thư viện*:

| Khung | Node |
|---|---|
| Lớp — Buổi học · kế hoạch 4 hoạt động, hai bản | `193:74` |
| Lớp — Tiến bộ và kết nối | `194:74` |

---

## 11. Nguồn

- Khảo sát gia sư KiN, 20–22/09/2026 (23 phản hồi).
- Meta ngừng Groups API từ Graph API v19 (22/04/2024): Sprinklr Help Center; Meta for Developers.
- Messenger Platform, Private Replies: developers.facebook.com/docs/messenger-platform/discovery/private-replies
- Zalo ZBS Template Message: zalo.solutions (thông báo 22/01/2026); oa.zalo.me/home/documents/guides/zbs-template-message
- Bảng giá tin Zalo: zalo.solutions/business-message/pricing
- Quản lý nhóm (GMF): oa.zalo.me (hướng dẫn và chính sách); zalo.solutions/oa/pricing
- Zalo Mini App, getPhoneNumber: miniapp.zaloplatforms.com/docs/api/getPhoneNumber/
- Xác thực Mini App nhóm ngành đặc thù: miniapp.zaloplatforms.com (30/08/2024)
- Wyzant: support.wyzant.com (cập nhật 21/07/2026). Preply: preply.com/en/teach; help.preply.com
- NĐ 356/2025/NĐ-CP: vanban.chinhphu.vn; tóm tắt của EY (03/2026), thuvienphapluat, wincolaw
- Luật 91/2025/QH15: luattri.com; mps.gov.vn; bocongan.gov.vn
- Bản Gemini Deep Research "Nghiên cứu Startup Gia sư", 30/09/2026 (trong tài khoản Gemini của anh)
- Bản Gemini "Soạn Thảo Prompt Giáo Án", 29/09/2026
- Các báo cáo trước: `hoc-tu-khan.md`, *Phần mềm cho gia sư quy mô nhỏ* (29/09), *Học gì từ Khan* (27/09)
