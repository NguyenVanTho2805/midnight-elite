# Nghiên cứu: game chơi trực tiếp trong buổi học (kiểu Gimkit)

Ngày 24/10/2026. **Trạng thái: nghiên cứu, chưa chốt, chưa có việc nào trong backlog.**
Chưa đọc Google Sheet backlog (cột H/I/J/K) vì chưa chuyển thành việc cụ thể. Phải đọc trước khi mở việc.

---

## 0. Tóm tắt

1. **Thứ làm nên hiệu quả là việc nhớ lại câu trả lời (retrieval practice), không phải trò chơi.**
   Game chỉ có ích khi nó làm học sinh trả lời *nhiều hơn* và nhận phản hồi *tốt hơn*. Nhiều chế độ của
   Gimkit (câu cá, leo tháp, bản đồ 2D) làm ngược lại: thời gian đi vào thao tác game, không vào câu hỏi.
2. **Hai trục thiết kế quyết định tất cả:** (a) đồng bộ từng câu (Kahoot) hay mỗi em tự nhịp (Gimkit);
   (b) thi đua, hợp tác hay đội. Với lớp 1–20 em trình độ lệch nhau, nên chọn **tự nhịp + hợp tác/đội,
   chấm theo đúng-sai chứ không theo tốc độ**.
3. **Chọn tự nhịp kéo theo một lợi lớn về kỹ thuật:** không cần hạ tầng realtime. Học sinh chỉ cần gửi đáp
   án và nhận về câu kế tiếp cùng tiến độ lớp trong *cùng một phản hồi*. Chỉ màn hình gia sư cần làm mới
   định kỳ. Mô hình đồng bộ kiểu Kahoot mới cần đẩy tin thật sự.
4. **Lý do xây trong KiN, không dùng Kahoot miễn phí:** danh sách lớp có sẵn (chỉ em đã ghi danh, đã có
   đồng ý), ngân hàng câu hỏi có lời giải và gợi ý, và **kết quả chảy ngược về** thống kê từng câu, "Điều
   chưa đạt" của báo cáo tháng và Chữa bài. Nếu kết quả không chảy ngược thì không đáng xây.
5. **Có ba quyết định cần người quyết (mục 10):** bảng xếp hạng, dữ liệu trẻ em, dạy kèm 1–3 em.

---

## 1. Độ tin cậy của nguồn (đọc trước)

- Không mở được trang gimkit.com, Wikipedia, Common Sense trong môi trường làm việc (tên miền bị chặn).
  Phần Gimkit dựa vào **blog và trung tâm trợ giúp chính thức qua kết quả tìm kiếm**, vài bài đánh giá
  giáo dục, và nhiều trang SEO kém tin cậy. Chỗ nào chỉ có SEO thì đánh dấu *chưa xác nhận*.
- Chưa xác nhận được: số chế độ chơi chính xác (các nguồn nói 24–27), giá gói Pro, có bộ tạo câu hỏi AI
  hay không, tuyên bố COPPA/FERPA, tính năng "tên biệt danh tự sinh" của Kahoot.
- **Không tìm được dữ liệu riêng cho Việt Nam** (tỉ lệ học sinh có điện thoại trong giờ học, mạng ở nhà
  học sinh). Đây là khoảng trống thật, cần hỏi anh Thanh (mục 10).
- Số liệu nghiên cứu lấy từ bản tóm tắt của công cụ tìm kiếm, **chưa đọc bài gốc**. Ghi cột "độ tin".

---

## 2. Giải phẫu một buổi chơi và ba trục thiết kế

### Luồng chung của mọi nền tảng

Bộ câu hỏi → gia sư mở phòng (mã hoặc QR) → học sinh vào → phòng chờ → vòng chơi (câu hỏi, đáp án,
phản hồi, điểm) → gia sư có quyền tạm dừng, đuổi, kết thúc → màn kết thúc → báo cáo.

### Trục 1 — Đồng bộ hay tự nhịp

| | Đồng bộ từng câu | Tự nhịp trong một game chung |
|---|---|---|
| Ví dụ | Kahoot (cả lớp cùng một câu) | Gimkit Classic (mỗi em đi nhanh chậm riêng) |
| Chấm điểm | Kahoot mặc định tính theo tốc độ: `(1 − (thời gian trả lời ÷ thời gian câu hỏi) ÷ 2) × điểm gốc`. Có chế độ "Accuracy" mỗi câu đúng 1 điểm | Gimkit nói công khai là **chưa bao giờ thưởng thêm cho trả lời nhanh** |
| Em yếu | Dễ bị bỏ lại, nhịp nhanh | Tự đi theo sức mình |
| Hạ tầng | Cần đồng hồ chung + đẩy tin thật | Không cần đẩy tin (mục 6) |

### Trục 2 — Thi đua, hợp tác, đội

- Nghiên cứu gộp của Sailer & Homner (2020) cho thấy **kết hợp thi đua với hợp tác** đặc biệt hiệu quả
  cho kết quả về hành vi.
- Nghiên cứu cũ về học hợp tác (Johnson & Johnson) cho thấy ít căng thẳng hơn thi đua thuần. Slavin
  thêm điều kiện: phải có **mục tiêu nhóm *và* trách nhiệm cá nhân**, nếu không có em ngồi không.
- Đội của Kahoot lấy **điểm trung bình** các thành viên để đội đông không thắng chỉ vì đông.
- Gimkit có chế độ hợp tác (Floor Is Lava, One Way Out) và đội (Tag, Capture the Flag).

### Trục 3 — Cơ chế game gắn vào câu hỏi thế nào

Gimkit Classic: trả lời đúng được tiền, mua nâng cấp (Money Per Question, Streak Bonus, Multiplier,
Insurance). Sai thì chuỗi về 0. Chế độ 2D khác (Fishtopia, Don't Look Down…) đặt câu hỏi *xen giữa* các
thao tác. Đánh giá giáo viên nêu: học sinh giỏi game và bàn phím lấn át em trả lời đúng nhưng thao tác
chậm, và nhiều em chăm chăm kiếm tiền hơn là học. Nghiên cứu ở Nottingham: bảng trò chơi và bài kiểm tra
cho hiệu quả nhớ **như nhau**; yếu tố tạo hiệu quả là phần nhớ lại, không phải hình thức.

**Quy tắc rút ra:** đo "số câu trả lời mỗi phút mỗi em" của mọi chế độ. Chế độ nào làm số này tụt thì bỏ.

### Điều Gimkit làm chưa tốt (đánh giá giáo viên)

Chỉ hiện đáp án đúng, **không giải thích vì sao**. KiN đã có `QuestionBankItem.explanation` và `hint`
(làm cho Chữa bài NV-188), nên đây là chỗ KiN có thể làm tốt hơn mà gần như không tốn thêm.

---

## 3. Bằng chứng

| Nghiên cứu | Nói gì | Độ tin | Bài học cho KiN |
|---|---|---|---|
| Özdemir 2025, *J. Computer Assisted Learning*, gộp 43 thí nghiệm, 3.353 người, về Kahoot | Hiệu quả vừa với kết quả học (0,77), rất lớn với ghi nhớ (1,49), lo âu giảm nhẹ (−0,34) | Vừa. Số ghi nhớ lớn bất thường; phần lớn là sinh viên, ngắn hạn. Một nghiên cứu ở Singapore không thấy khác biệt điểm | Có lẽ tích cực nhưng đừng tin con số to. Đừng hứa "tăng điểm" với phụ huynh |
| Sailer & Homner 2020, gộp về gamification | Nhận thức g=0,49; động lực 0,36; hành vi 0,25. Kết quả nhận thức chỉ vững ở nhóm nghiên cứu chặt chẽ | Khá | Hiệu quả nhỏ–vừa, phụ thuộc thiết kế |
| Hanus & Fox 2015, *Computers & Education* | Cả học kỳ có bảng xếp hạng và huy hiệu: động lực nội tại và hài lòng thấp hơn lớp đối chứng; nhiều bản tóm tắt nói điểm thi cũng thấp hơn | Thấp–vừa (chỉ đọc bản tóm tắt thứ cấp; chưa kiểm số liệu). Tác giả quy cho thiết kế chưa hiệu chỉnh | Rủi ro nằm ở **xếp hạng công khai tích luỹ nhiều tuần**, không phải một ván chơi |
| Học hợp tác với thi đua (Johnson, Slavin) | Hợp tác ít căng thẳng hơn, hiệu quả hơn nếu có trách nhiệm cá nhân | Vừa. Bằng chứng riêng cho game đố vui còn mỏng | Chế độ đội phải chấm theo từng em đóng góp |
| Retrieval practice (Dunlosky 2013 và nhiều nghiên cứu) | Tự kiểm tra là một trong những chiến lược học vững nhất | Cao | Đây là "thành phần hoạt tính". Game là lớp bọc |
| Áp lực thời gian và lo âu | **Không tìm thấy nghiên cứu cô lập tác động của giới hạn thời gian lên việc nhớ.** Chỉ có ý kiến người dạy rằng thi đua và giới hạn giờ làm em yếu nản | Rất thấp | Mặc định tắt giờ; để gia sư tự bật |

---

## 4. KiN đã có gì (đọc từ schema và tiến độ, 24/10)

| Cần cho game | Đã có | Ghi chú |
|---|---|---|
| Ngân hàng câu hỏi | `QuestionBankItem`: `type` (MC / SHORT_ANSWER / TRUE_FALSE_CLUSTER / ESSAY), `explanation`, `hint`, `difficulty` NB-TH-VD-VDC, cây `QuestionCategory`, `status` draft/pending/approved | Game chỉ lấy `status = approved`, loại ESSAY |
| Chữa bài | `ExamCorrection` (NV-188): gợi ý trước, đáp án sau, không đổi điểm thi | Câu sai trong game có thể đưa vào đây |
| Danh sách lớp + đồng ý | `Enrollment.status` (`pending_consent` / `active` / `suspended`), `ParentConsent` | Chỉ em `active` mới vào phòng được: cổng đồng ý có sẵn |
| Buổi học | `ClassSchedule`, `AttendanceSession` (courseId + ngày), `ClassSessionChange` | Gắn ván chơi vào (lớp, ngày) |
| Kế hoạch buổi | `SessionPlan.activities` (JSON, PH-223) | Game là một *loại hoạt động* trong kế hoạch buổi |
| Báo cáo tháng | `MonthlyReport` + gợi ý "Điều chưa đạt" (NV-189) | Đầu ra lý tưởng của game |
| Thống kê điểm | `scoreDistribution.ts` (phân bố điểm) | **Chưa thấy** tỉ lệ đúng/sai theo từng câu |
| Làm mới định kỳ | Hộp việc, thông báo: poll 30 giây + `visibilitychange` | Chưa có realtime nào |
| Xếp hạng | `/student/bang-xep-hang`, vinh danh | Trên điểm thi thử, không phải game |

**Vì sao không dùng Kahoot cho xong?** Gia sư vẫn dùng được, miễn phí cho lớp nhỏ. Xây trong KiN chỉ có lý
nếu có đủ ba thứ mà công cụ ngoài không có: (1) danh sách lớp thật, không biệt danh lạ, không khách;
(2) câu hỏi lấy từ ngân hàng có lời giải; (3) **kết quả quay về sổ lớp**. Thiếu (3) thì đây là bản sao
Kahoot kém hơn.

---

## 5. Đề xuất thiết kế bản đầu

Tên tạm: **"Ôn nhanh cuối buổi"**.

### Luồng gia sư

Lịch → mở buổi → **Mở phòng ôn** → chọn bộ câu (theo chương, độ khó, hoặc "câu cả lớp hay sai gần đây") →
mã phòng + QR → thấy danh sách lớp, ai đã vào → **Bắt đầu** → màn hình chiếu chỉ hiện tiến độ chung →
**Kết thúc** → xem 3 câu khó nhất và bấm "Đưa vào Chữa bài".

### Hai chế độ cho bản đầu (không làm thêm)

1. **Cả lớp cùng leo.** Hợp tác. Một thanh tiến độ chung, mỗi câu đúng đẩy thanh lên, câu sai không trừ.
   Mục tiêu chung đặt trước. Muốn tính vào mục tiêu, mỗi em phải trả lời ít nhất N câu (trách nhiệm
   cá nhân). Em chỉ thấy độ chính xác của mình; **không hiện tên em sai**.
2. **Đội đấu.** Chỉ mở khi lớp từ khoảng 6 em. Gia sư chia đội. Điểm đội = **trung bình** điểm các
   thành viên (theo cách Kahoot, chống đội đông thắng nhờ đông). Mỗi đội cân bằng theo kết quả gần đây.

Lớp 1–3 em (rất phổ biến với gia sư tự do): chế độ 1 trở thành "thử thách cùng thầy/cô" với mục tiêu
đặt cho cả nhóm; đội không có nghĩa.

### Quy tắc chơi

- Chấm theo **đúng/sai, không có điểm thưởng tốc độ**. Giờ mặc định **tắt**; gia sư bật thì chỉ là hạn
  mềm.
- Sau mỗi câu hiện **đáp án + lời giải** (`explanation`); em sai có thể mở `hint` trước khi xem đáp án.
- Bảng xếp hạng cá nhân **tắt mặc định**; nếu bật chỉ hiện cho gia sư và **không lưu** thành xếp hạng
  tích luỹ.
- Loại câu: trắc nghiệm một đáp án và điền ngắn. Bỏ tự luận. Đúng–sai cụm để sau.
- Đảo thứ tự lựa chọn riêng từng em. Máy chủ chấm; **không gửi `isCorrect` xuống trình duyệt** trước khi nộp.

### Giao diện theo bộ quy tắc sẵn có

Màu không bao giờ nói một mình: mỗi lựa chọn có **chữ cái A/B/C/D** đi kèm màu, không chỉ màu như Kahoot.
Nút cao ≥ 44px, chạy tốt ở 390px, tôn trọng giảm chuyển động (`kin-motion.css`), chữ không dưới sàn
11,1px, dùng token `--kin-*`.

### Ba giọng cho cùng một ván

- Gia sư: tiến độ lớp, 3 câu khó nhất, danh sách em chưa vào / chưa trả lời đủ N câu.
- Học sinh: tiến độ riêng + tiến độ lớp, lời giải.
- Phụ huynh: **không thấy gì** từ ván chơi. Chỉ thấy khi gia sư đưa một dòng vào báo cáo tháng đã duyệt.

---

## 6. Kiến trúc realtime

### Phát hiện cần xác minh

Hai nguồn mâu thuẫn về WebSocket trên Vercel. Bài của Ably (nhà bán dịch vụ realtime) nói hàm serverless
không giữ được WebSocket. Tài liệu Vercel (qua chỉ mục bên thứ ba) có ví dụ `experimental_upgradeWebSocket`
trong `@vercel/functions` và máy chủ `ws`. Tài liệu ghi: **tin nhắn bị ghim vào đúng một instance**, và
**kết nối bị cắt khi hàm đạt thời lượng tối đa**. Ngay cả khi WebSocket chạy được, hai em có thể rơi vào
hai instance khác nhau nên vẫn cần một chỗ chung để chia sẻ trạng thái phòng. *Phải đối chiếu lại trên
vercel.com trước khi quyết.*

### Bốn phương án

| Phương án | Hợp với | Chi phí / rủi ro |
|---|---|---|
| **A. Tự nhịp + phản hồi mang theo tiến độ; chỉ màn gia sư làm mới 1–2 giây** | Hai chế độ ở mục 5 | Không thêm nhà cung cấp. Ước tính: 1 màn gia sư ≈ 0,5–1 yêu cầu/giây; học sinh không poll khi đang chơi, chỉ poll 2–3 giây ở phòng chờ. Trễ 1–2 giây chấp nhận được |
| B. SSE từ route handler | Đẩy một chiều | Hàm có giới hạn thời lượng (nguồn thứ cấp nói 300 giây mặc định) nên phải nối lại; bên trong vẫn phải hỏi DB, ít lợi hơn nghĩ |
| C. Dịch vụ pub/sub (Ably, Pusher) | Chế độ đồng bộ, đẩy thật | Gói miễn phí: Ably 200 kết nối + 6 triệu tin/tháng; Pusher 100 kết nối + 200 nghìn tin/ngày (và tính cả tin gửi đến từng người). Dư cho lớp ≤20. Thêm khoá bí mật, thêm điểm hỏng. Chỉ gửi ID ẩn, không gửi tên |
| D. WebSocket trong hàm Vercel | Chưa nên | Ghi là thử nghiệm; ghim instance; cắt kết nối theo thời lượng |

**Khuyến nghị:** làm **A** trước. Trạng thái phòng nằm trong Postgres (Neon). Nếu sau này cần đồng bộ thì
thêm C chỉ như tín hiệu "có thay đổi, hãy tải lại" mà không đổi mô hình dữ liệu.

### Từ bài học `kin-app` (CLAUDE-cho-kho-trien-khai mục 5)

- Gửi đáp án bằng `fetch` tới route handler, **không dùng server action** (server action bị huỷ giữa chừng
  làm nút kẹt "Đang lưu…" dù máy chủ đã ghi). Chống gửi trùng bằng khoá duy nhất `(ván, em, câu)`.
  Chỉ hiện "đã lưu" khi máy chủ trả lời.
- **Chốt vào sự kiện**: mỗi `GameAnswer` lưu luôn `correct` tại lúc trả lời và ảnh chụp nội dung câu hỏi
  của ván, không đọc lại từ ngân hàng. Gia sư sửa câu hỏi sau thì lịch sử ván cũ không đổi.

---

## 7. Dữ liệu (chỉ thêm, theo cách repo đang làm)

Ba bảng mới, gợi ý, chưa chốt tên:
- `GameSession`: lớp, gia sư, ngày buổi, chế độ, trạng thái, cài đặt (JSON), ảnh chụp bộ câu hỏi (JSON).
- `GameParticipant`: ván, học sinh, đội.
- `GameAnswer`: ván, học sinh, câu, lựa chọn/chữ trả lời, `correct`, mili giây; duy nhất `(ván, học sinh, câu)`.

Không đụng ví Coin, học phí hay điểm danh. Không tạo bảng xếp hạng tích luỹ.

---

## 8. An toàn trẻ em

Đây là phần dễ làm sai nhất, đi theo mục 9 của `CLAUDE-cho-kho-trien-khai.md`: có trẻ dưới 16 tuổi thì dừng và hỏi người.

- **Chỉ em `Enrollment.status = active` của lớp đó.** Không có khách, không có biệt danh tự nhập. Tên hiển thị lấy
  từ danh sách lớp (gia sư có thể đặt biệt danh cho từng em).
- **Không có chat, không có nhập chữ tự do** ngoài câu trả lời điền ngắn. Không có avatar tải lên.
- **Không có "vai ẩn" kiểu Trust No One** (một em đóng kẻ phá hoại): giữa trẻ vị thành niên dễ sinh
  quy chụp, loại trừ.
- Không hiện tên em sai trên màn chiếu. Gia sư có nút tạm dừng và đuổi.
- Ván chơi tạo ra **một loại dữ liệu mới về trẻ** (câu trả lời từng em theo thời gian). Có thể cần cập nhật
  `ParentConsent.contentVersion` hoặc chữ trên phiếu đồng ý. *Đây là câu hỏi cho Thanh, không phải Claude quyết.*
  Viện dẫn Nghị định 13/2023 là căn cứ để hỏi, không phải ý kiến pháp lý.

---

## 9. Không làm (và vì sao)

- **Tiền trong game, nâng cấp, power-up gây hại người khác** (Icer, Subtractors). Coin đã chốt là đừng động
  vào (26/09); đánh giá cho thấy em chạy theo tiền; báo cáo tháng của KiN cố ý không xếp hạng.
- **Bảng xếp hạng tích luỹ**, kể cả "người chơi tuần này". Rủi ro Hanus & Fox, và trái nguyên tắc báo cáo.
- **Thư viện bộ câu hỏi công khai.** Đánh giá nêu câu công khai hay sai hoặc lệch chương trình; KiN đã có ngân hàng có duyệt.
- **Chế độ 2D, Creative mode, trò xã hội ẩn vai.** Tốn công, làm tụt số câu trả lời mỗi phút, rủi ro trẻ em.
- **Khách vào bằng mã không tài khoản.** Gimkit cho phép (nguồn SEO, chưa xác nhận); KiN không nên.

---

## 10. Câu hỏi cần Thọ / Thanh quyết

1. **Điện thoại và mạng:** trong buổi học thật, bao nhiêu em có điện thoại riêng? Học Zoom/Meet hay tại nhà học
   sinh? (Tôi không tìm được dữ liệu Việt Nam.) Nếu phần lớn dùng chung một thiết bị thì cần chế độ khác.
2. **Bảng xếp hạng:** tắt hẳn, hay cho gia sư bật cho riêng một ván và không lưu? (Tôi đề xuất vế sau.)
3. **Dữ liệu trẻ em:** có cập nhật chữ đồng ý của phụ huynh khi bắt đầu lưu câu trả lời từng em theo ván không?
4. **Đưa vào báo cáo tháng:** chỉ "câu cả lớp hay sai" (tôi đề xuất), hay cả độ chính xác từng em? Cái sau
   gần với điểm, trái nguyên tắc "không điểm gộp".
5. **Dạy kèm 1–3 em:** chế độ hợp tác đủ không, hay bỏ qua game cho nhóm này?
6. **Em đề xuất câu hỏi (kiểu KitCollab)** là một hướng khác, đi cùng ngân hàng câu hỏi: `QuestionBankItem.status`
   hiện do *quản trị* duyệt, chưa có đường để *gia sư* duyệt câu của học sinh. Cần chốt trước khi làm.

---

## 11. Lộ trình gợi ý và cách đo

0. **Chốt mục 10, đọc Sheet backlog.** Mở việc nếu muốn làm.
1. **Thống kê đúng/sai theo từng câu** cho bài thi thử và bài tập (chưa cần game; dùng ngay `ExamAnswer`).
   Đây là nền cho mọi thứ sau và có ích độc lập.
2. **Chế độ "Cả lớp cùng leo" với phương án A.** Ba bảng, vài route, hai màn (gia sư, học sinh).
3. **Chế độ đội + "Đưa vào Chữa bài"** và dòng gợi ý cho báo cáo tháng.
4. Chỉ khi cần đồng bộ thật: thêm pub/sub (phương án C).

**Đo thử với lớp của anh Thanh (khoảng 25 em):**
- số câu trả lời mỗi phút mỗi em (phải cao hơn làm bài tập thường);
- tỉ lệ em trả lời đủ N câu;
- tỉ lệ đúng lại ở câu sai sau 1 tuần;
- gia sư mất bao lâu để mở một phòng (mục tiêu dưới 2 phút).

**Trước khi viết code:** `AGENTS.md` yêu cầu đọc `node_modules/next/dist/docs/` (Next 16.2.6 có thay đổi phá vỡ).
Trong môi trường này chưa cài `node_modules`, cần cài trước.

---

## Nguồn

- Gimkit: [trợ giúp KitCollab](https://help.gimkit.com/en/article/kitcollab-1chrevu) ·
  [blog "An upgrade gets an upgrade"](https://blog.gimkit.com/blog/an-upgrade-gets-an-upgrade) ·
  [blog KitCollab](https://blog.gimkit.com/blog/kitcollab-rebuilt-from-the-ground-up)
- Kahoot: [How points work](https://support.kahoot.com/hc/articles/115002303908) ·
  [Accuracy experience](https://support.kahoot.com/hc/articles/39818967108627)
- Đánh giá giáo viên: [Common Sense](https://www.commonsense.org/education/reviews/gimkit/teacher-reviews/5031730) ·
  [Educators Technology](https://www.educatorstechnology.com/2023/03/gimkit-live-game-show-for-classroom.html) ·
  [FLTMAG](https://fltmag.com/gimkit-games/)
- Chế độ chơi (SEO, chưa xác nhận): [Gimkit Fandom wiki](https://gimkit.fandom.com/wiki/Gamemodes) ·
  [Gimkit Info](https://gimkitinfo.com/gimkit-game-modes/)
- Nghiên cứu: [Özdemir 2025, Kahoot meta-analysis](https://onlinelibrary.wiley.com/doi/10.1111/jcal.13084) ·
  [Sailer & Homner 2020](https://www.researchgate.net/publication/335189630_The_Gamification_of_Learning_a_Meta-analysis) ·
  [Hanus & Fox 2015](https://www.researchgate.net/publication/265644737_Assessing_the_effects_of_gamification_in_the_classroom_A_longitudinal_study_on_intrinsic_motivation_social_comparison_satisfaction_effort_and_academic_performance) ·
  [Nottingham: board game vs quiz](https://nottingham-repository.worktribe.com/OutputFile/20277918) ·
  [Cạnh tranh và hợp tác trong lớp](https://www.sciencedirect.com/science/article/pii/S187704281403328X/pdf?md5=cad95df44a0bdd9d26567a565a7dc1a2&pid=1-s2.0-S187704281403328X-main.pdf)
- Realtime: [Ably: WebSocket trên Vercel](https://ably.com/topic/ai-stack/websockets-on-vercel-why-serverless-functions-cant-host-them) ·
  [Ably gói miễn phí](https://ably.com/docs/platform/pricing/free) ·
  [Pusher giá](https://www.pusher.com/channels/pricing) ·
  [Vercel: WebSockets](https://vercel.com/docs/functions/websockets)
