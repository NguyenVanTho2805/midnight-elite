# CHỨC NĂNG 7: KẾ HOẠCH CHUYỂN ĐỔI SANG MÔ HÌNH GIA SƯ — LỚP HỌC — PHỤ HUYNH

> **Nguồn gốc:** Google Sheet "TSIX — Theo dõi tiến độ" (roadmap G0–G7, 125 đầu việc) + đối chiếu trực tiếp với `prisma/schema.prisma` và `files/00_tong_quan.md` / `files/06_quan_tri_lop.md` hiện có trong repo.
> **Phạm vi tài liệu này:** hoàn thành 2 đầu việc G0 không phụ thuộc gì và có mức ưu tiên cao nhất — **G0.06 (Lập ma trận quyền bốn vai trò — P0)** và **G0.02 (Phân loại giữ/sửa/thêm/ngừng dùng — P1)**. Đây là input bắt buộc để chốt các quyết định D01–D10 và mở khoá G1.
> **Trạng thái:** Bản nháp kỹ thuật — cần SP/Owner duyệt trước khi dùng làm căn cứ thiết kế schema chính thức (G1.04, G1.06).

---

## 1. Bối cảnh — mô hình đang thay đổi như thế nào

| | Mô hình hiện tại (đã code) | Mô hình mục tiêu (theo sheet TSIX) |
|---|---|---|
| Đơn vị giảng dạy | `Course` do 1 `User` sở hữu (`ownedCourses`), vận hành tập trung bởi 1 Owner + Mentor/Trợ giảng | `Lớp học` do **gia sư (tutor)** sở hữu độc lập, nhiều gia sư cùng tồn tại trên nền tảng |
| Vai trò | `User.role`: `"student" \| "admin"`; `User.adminRole`: `"admin_super" \| "admin_content" \| "teacher"` (3 cấp, đều thuộc phía vận hành) | 4 vai trò tách bạch: **Gia sư (chủ lớp) / Thành viên (học viên) / Phụ huynh / Admin nền tảng** |
| Phụ huynh | 2 field text trên `User`: `parentPhone`, `parentName` — không có xác thực, không có quan hệ dữ liệu | Bảng quan hệ `ParentLink` + `ParentConsent` có token xác nhận, thời hạn, lịch sử đồng ý |
| Gói/thanh toán | `Wallet` + `CoinTransaction` đã có, nhưng chưa gắn với "gói theo lớp" | Gói (`Subscription`) gắn `courseId`/lớp cụ thể, gia sư nhận Coin theo lớp mình dạy |
| Cộng đồng | `Thread` toàn hệ thống | Giới hạn phạm vi theo lớp (`Thread` scoped theo lớp) |

**Kết luận quan trọng:** đây không phải là thêm tính năng nhỏ — đây là đổi **đơn vị sở hữu dữ liệu** từ "1 Owner vận hành toàn bộ nền tảng" sang "nhiều gia sư độc lập, mỗi người là chủ dữ liệu của lớp mình". Mọi truy vấn hiện tại giả định ngầm "chỉ có 1 đội ngũ vận hành" sẽ phải rà lại theo `classId`/`ownerId` (xem mục 3 — rủi ro).

---

## 2. G0.06 — Ma trận quyền 4 vai trò (P0)

Ký hiệu: **T** = Tạo, **X** = Xem, **S** = Sửa, **XA** = Xoá/Vô hiệu hoá, **D** = Duyệt (approve). Ô trống = không có quyền.

| Tài nguyên / Hành động | Gia sư (chủ lớp) | Thành viên (học viên) | Phụ huynh | Admin nền tảng |
|---|---|---|---|---|
| **Lớp học** (tạo/sửa/lưu trữ) | T S XA (chỉ lớp mình) | X (lớp mình tham gia) | X (lớp của con) | X S XA (toàn bộ, phục vụ hỗ trợ) |
| **Lời mời / mã tham gia lớp** | T XA | dùng để tham gia | — | X (đối soát) |
| **Enrollment (ghi danh)** | X S XA (lớp mình) | T (yêu cầu tham gia) X (của mình) | X (của con) | X S XA |
| **ParentLink / ParentConsent** | X (đọc trạng thái, không tự tạo) | — | T S (chỉ liên kết với con mình) X (lịch sử đồng ý) | X S XA (xử lý tranh chấp) |
| **Tài liệu / bài giảng** | T S XA (lớp mình) | X (lớp mình, theo quyền) | X (chỉ nếu lớp cho phép phụ huynh xem) | X S XA |
| **Xử lý AI tài liệu (chuẩn hoá, sinh câu hỏi)** | T (khởi chạy) D (duyệt kết quả trước xuất bản) | — | — | X (giám sát hàng đợi/lỗi) |
| **Bài tập / nộp bài / chấm điểm** | T (giao bài) S (chấm) | T (nộp bài) X (điểm của mình) | X (điểm của con) | X (đối soát) |
| **Lịch học / buổi học** | T S XA (lớp mình) | X | X (của con) | X |
| **Điểm danh** | T S (lớp mình) | X (của mình) | X (của con) | X |
| **Ví Coin / giao dịch** | X (số dư nhận từ lớp mình) | T (nạp) S (chi tiêu mua gói) X (lịch sử của mình) | X (nếu đứng tên nạp hộ con — cần D01/D05 chốt) | X S XA (đối soát, hoàn tiền, webhook) |
| **Gói / đăng ký / gia hạn** | X (gói lớp mình) | T (đăng ký) X | X (của con) | X S XA |
| **Diễn đàn / cộng đồng (theo lớp)** | S XA (kiểm duyệt lớp mình) | T (đăng bài/trả lời) X | X (nếu được cấp quyền xem) | X S XA (toàn hệ thống) |
| **Đánh giá gia sư/lớp** | X (xem, không tự đánh giá lớp mình) | T (1 lần/lớp) X | — | X S XA |
| **Quản trị tài khoản, phân quyền, banned** | — | — | — | T S XA |
| **Đối soát thanh toán / hoàn tiền thật** | — | — | — | T S XA (tách quyền tài chính khỏi hỗ trợ — xem G5.09) |
| **Nhật ký thao tác (audit log)** | X (log liên quan lớp mình) | — | — | X (toàn bộ) |

### Ghi chú bắt buộc khi triển khai (ánh xạ sang G1)

- **G1.10 / G1.11**: mọi API thao tác dữ liệu theo lớp phải kiểm tra `ownerId`/`classId` khớp với người gọi — **không được dựa vào UI ẩn nút** để chặn truy cập chéo lớp.
- **G1.13**: bảng audit log cần ghi `actorId`, `role`, `resourceId`, `action`, `timestamp` cho các hành động: đổi quyền, điểm, consent, giao dịch Coin.
- **G1.15 (D03)**: một tài khoản có thể mang nhiều vai trò (vd. vừa là phụ huynh vừa là gia sư), nhưng **quyền admin không được tự cấp** — phải qua thao tác riêng của Admin nền tảng.
- Vai trò **Admin nền tảng** ở bảng trên gộp chung để dễ đọc; theo **G5.09 (P0)**, khi triển khai thật phải tách nhỏ thành: Admin hỗ trợ / Admin kiểm duyệt / Admin tài chính — không cấp quyền tài chính mặc định cho toàn bộ admin.

---

## 3. G0.02 — Phân loại giữ / sửa / thêm mới / ngừng dùng

Đối chiếu từng nhóm model hiện có trong `prisma/schema.prisma` với yêu cầu mô hình gia sư–lớp–phụ huynh.

### 3.1. Giữ nguyên (không đổi cấu trúc, chỉ scope lại quyền truy cập)

| Model hiện có | Lý do giữ | Việc cần làm kèm theo |
|---|---|---|
| `Wallet`, `CoinTransaction` | Đã đúng khái niệm ví/giao dịch Coin generic | Thêm loại giao dịch mới theo D01/D05 (topup, class_renewal, activity_reward) — xem G4.03 |
| `Exam`, `ExamAttempt`, `ExamAnswer*`, `QuestionBankItem` | Hệ thi thử/ngân hàng câu hỏi độc lập với mô hình lớp, không xung đột | Rà lại quyền xem theo lớp nếu đề thi gắn với 1 lớp cụ thể |
| `Assignment`, `AssignmentSubmission`, `AssignmentQuestion/Option/Answer` | Đúng khái niệm bài tập/nộp bài | Cần thêm ràng buộc "chỉ thành viên lớp được xem" (G3.09, G3.15) |
| `Notification` | Cơ chế thông báo chung, tái dùng được | Thêm loại thông báo mới cho lời mời, consent, hạn nộp (G3.20–G3.22) |
| `Thread`, `ThreadReply`, `ThreadReport`, `*Like`, `ThreadBookmark` | Cộng đồng đã có đủ cấu trúc | Thêm cột phạm vi lớp (xem mục 3.2) để giới hạn hiển thị (G5.01) |
| `LessonProgress`, `LessonNote`, `ExamResult`, `UserBadge` | Theo dõi tiến độ cá nhân, không phụ thuộc mô hình sở hữu | Không đổi |

### 3.2. Cần sửa (thêm cột/quan hệ, không đổi bản chất bảng)

| Model | Sửa gì | Vì sao |
|---|---|---|
| `User` | Thêm `dateOfBirth` (D04), tách vai trò **gia sư** ra khỏi `adminRole` hiện tại (đang gộp `"teacher"` vào nhóm admin — sai bản chất vì gia sư không phải nhân sự vận hành nền tảng) | Ma trận quyền ở mục 2 yêu cầu gia sư là vai trò độc lập, không phải cấp dưới của admin |
| `Course` | Làm rõ ngữ nghĩa: `Course` sẽ đóng vai trò "Lớp học" do gia sư sở hữu qua `ownedCourses`; cần thêm `capacity`, `status` (G2.02) | Hiện `Course` đã có quan hệ owner sẵn — tận dụng thay vì tạo bảng `Class` song song để tránh trùng lặp, nhưng cần đổi tên/diễn giải cho khớp nghiệp vụ mới (quyết định cần D01/D02 chốt trước) |
| `Thread` | Thêm khoá ngoại `courseId` (nullable trong giai đoạn chuyển tiếp) | Giới hạn diễn đàn theo lớp (G5.01) thay vì toàn hệ thống |
| `Enrollment` | Thêm `status` (chờ phụ huynh, hoạt động, ngừng), `parentConsentId` | Enrollment hiện tại chưa mô tả trạng thái chờ đồng ý của phụ huynh (G2.07) |
| `Wallet`/`CoinTransaction` | Thêm `sourceType` (topup/reward), `classId` tham chiếu khi giao dịch gắn với 1 lớp | Truy vết Coin theo nguồn và theo lớp (D05, G4.03, G6.06) |

### 3.3. Thêm mới (chưa tồn tại, bắt buộc cho mô hình gia sư–phụ huynh)

| Model mới | Mục đích | Việc liên quan trong sheet |
|---|---|---|
| `ParentLink` | Quan hệ phụ huynh–con, có trạng thái xác minh | G1.04, G2.10 |
| `ParentConsent` | Bản ghi đồng ý cho từng lần enrollment cần xác nhận, kèm token 1 lần, thời hạn, phiên bản nội dung | G1.04, G2.08, G2.09, G2.11 |
| `Subscription` (gói theo lớp) | Gói học trả bằng Coin, gắn `courseId`, ngày hiệu lực, giá mua | G4.01, G4.12, G4.14 (phụ thuộc D01) |
| `ClassInvite` | Mã/link mời có hạn, có thể thu hồi, tách khỏi enrollment trực tiếp | G2.03 |
| `TutorProfile` (hoặc mở rộng `User`) | Môn dạy, giới thiệu, trạng thái xác minh gia sư | G1.02 |
| `CourseReview` mở rộng → `TutorRating` | Tổng hợp đánh giá theo gia sư (không chỉ theo khoá học) nếu D02 xác nhận mô hình đa gia sư | G5.05 (phụ thuộc D02) |

### 3.4. Ngừng dùng / cần quyết định trước khi xoá

| Hạng mục | Tình trạng |
|---|---|
| `User.parentPhone` / `User.parentName` (dạng text tự do) | **Không xoá ngay** — giữ tạm để tương thích dữ liệu cũ (D06), nhưng ngừng dùng làm nguồn xác thực; thay bằng `ParentLink` đã xác minh. Có kế hoạch dọn ở G6.17 (chỉ dọn sau khi dữ liệu được xác nhận di chuyển). |
| Gộp vai trò `"teacher"` trong `adminRole` | Không xoá field, nhưng ngừng cấp vai trò này cho tài khoản mới — thay bằng vai trò gia sư độc lập theo mục 2 |

---

## 4. Khoảng trống rủi ro cần chốt sớm (đưa vào G0.03)

1. **Không có khái niệm "Lớp" tách khỏi "Khoá học"** — cần D01/D02 xác nhận: dùng `Course` hiện có làm đơn vị lớp học, hay tạo bảng `Class` mới tham chiếu tới `Course` (khoá học = nội dung dùng chung, lớp = phiên bản do 1 gia sư dạy). Quyết định này ảnh hưởng trực tiếp tới cách viết migration G1.07.
2. **`adminRole` đang lẫn vai trò gia sư vào nhóm vận hành nền tảng** — nếu không tách sớm, không thể áp ma trận quyền ở mục 2 mà không phá vỡ logic admin hiện tại.
3. **Phụ huynh hiện là dữ liệu tự khai, không xác thực** — mọi tính năng dựa trên `parentPhone` hiện tại (nếu có) phải coi là **không đáng tin cậy** cho tới khi có `ParentLink` xác minh (đúng nguyên tắc G2.10: "không cấp quyền chỉ từ số điện thoại nhập").
4. **Chính sách hoàn tiền nạp (R04/D10)** vẫn là nút chặn cứng trước khi bật thanh toán thật — không liên quan trực tiếp đến ma trận quyền nhưng cần nêu lại vì đã phát hiện `Wallet`/`CoinTransaction` sẵn sàng về mặt kỹ thuật, chỉ thiếu chính sách nghiệp vụ.

---

## 5. Bước tiếp theo đề xuất

1. Gửi mục 2 và mục 3 cho SP/Owner duyệt — đây chính là input cho **G0.03 (ghi nhận và duyệt D01–D10)**.
2. Sau khi D01, D02, D03, D04 được chốt, cập nhật lại bảng 3.2/3.3 thành spec migration chi tiết cho **G1.04–G1.07**.
3. Song song, có thể bắt đầu **G0.05** (kiểm kê `Course` chưa gán chủ, `User` có `adminRole = "teacher"` hiện tại) để chuẩn bị dữ liệu chuyển đổi trước khi viết migration thật.
