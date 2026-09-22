# CHỨC NĂNG 7: KẾ HOẠCH CHUYỂN ĐỔI SANG MÔ HÌNH GIA SƯ — LỚP HỌC — PHỤ HUYNH

> **Nguồn gốc:** Google Sheet "TSIX — Theo dõi tiến độ" (roadmap G0–G7, 125 đầu việc) + đối chiếu trực tiếp với `prisma/schema.prisma` và `files/00_tong_quan.md` / `files/06_quan_tri_lop.md` hiện có trong repo.
> **Phạm vi tài liệu này:** hoàn thành 2 đầu việc G0 không phụ thuộc gì và có mức ưu tiên cao nhất — **G0.06 (Lập ma trận quyền bốn vai trò — P0)** và **G0.02 (Phân loại giữ/sửa/thêm/ngừng dùng — P1)**. Đây là input bắt buộc để chốt các quyết định D01–D10 và mở khoá G1.
> **Trạng thái:** Bản nháp kỹ thuật — cần SP/Owner duyệt trước khi dùng làm căn cứ thiết kế schema chính thức (G1.04, G1.06).

> **Đính chính sau khi rà `src/lib/permissions.ts`:** nhận định ban đầu ở mục 3.2 ("`adminRole` đang lẫn vai trò gia sư vào nhóm vận hành nền tảng") **không chính xác** — hệ thống đã có sẵn cơ chế scope quyền cho `adminRole === "teacher"` theo `Course.ownerId`/`Exam.ownerId` (giáo viên chỉ thấy/sửa nội dung do chính mình tạo; `admin_super`/`admin_content` mới thấy toàn bộ). Đây thực chất đã là mô hình "gia sư sở hữu lớp riêng" ở mức quyền — không cần tách bảng. Rủi ro #2 ở mục 4 vì vậy được **gỡ bỏ**. Phần còn thiếu thật sự chỉ là: xác thực phụ huynh (`ParentLink`/`ParentConsent`) và `dateOfBirth`. **Đã triển khai** 2 phần này trực tiếp vào `prisma/schema.prisma` — xem mục 6.

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

---

## 4. Khoảng trống rủi ro cần chốt sớm (đưa vào G0.03)

1. **Không có khái niệm "Lớp" tách khỏi "Khoá học"** — cần D01/D02 xác nhận: dùng `Course` hiện có làm đơn vị lớp học (đã có `ownerId` scoped theo giáo viên, xem đính chính đầu tài liệu), hay tạo bảng `Class` mới tham chiếu tới `Course` (khoá học = nội dung dùng chung, lớp = phiên bản do 1 gia sư dạy). Quyết định này ảnh hưởng trực tiếp tới cách viết migration cho `Subscription` (G4.01).
2. **Phụ huynh hiện là dữ liệu tự khai, không xác thực** — mọi tính năng dựa trên `parentPhone` cũ phải coi là **không đáng tin cậy** cho tới khi có `ParentLink` xác minh (đúng nguyên tắc G2.10: "không cấp quyền chỉ từ số điện thoại nhập"). Đã có model, còn thiếu API/UI xác nhận (xem mục 6).
3. **Chính sách hoàn tiền nạp (R04/D10)** vẫn là nút chặn cứng trước khi bật thanh toán thật — không liên quan trực tiếp đến ma trận quyền nhưng cần nêu lại vì đã phát hiện `Wallet`/`CoinTransaction` sẵn sàng về mặt kỹ thuật, chỉ thiếu chính sách nghiệp vụ.

---

## 5. Đã triển khai vào `prisma/schema.prisma` (phần được duyệt làm ngay)

Sau khi đối chiếu, chỉ phần **ParentLink/ParentConsent + `dateOfBirth`** là đủ rõ ràng và không phụ thuộc D01/D02 (không đụng tới `Course`/`adminRole`) nên đã thêm thẳng vào schema, thay vì chỉ dừng ở đề xuất:

- `User.dateOfBirth` (nullable) — phục vụ tính tuổi tại backend cho ngưỡng xác nhận phụ huynh (D04).
- `User.parentPhone`/`parentName` được chú thích rõ là dữ liệu cũ, không dùng để cấp quyền.
- Model `ParentLink` — quan hệ phụ huynh–học viên, trạng thái `pending/verified/revoked`.
- Model `ParentConsent` — bản ghi đồng ý gắn 1-1 với `Enrollment` (nullable, vì không phải enrollment nào cũng cần), token dùng 1 lần, có hạn, lưu `contentVersion` để đối chiếu khi tranh chấp.
- `Enrollment` được nối quan hệ ngược `parentConsent` (không đổi cấu trúc cũ, chỉ thêm quan hệ).

**Chưa làm trong lượt này** (do phụ thuộc D01/D02 chưa chốt, làm trước có rủi ro phải sửa lại): `Subscription` (gói theo lớp), `ClassInvite`, `TutorProfile`, mở rộng `Thread.courseId`, mở rộng `Wallet/CoinTransaction.sourceType`.

**Giới hạn kỹ thuật khi thực hiện:** môi trường thực thi phiên này bị chặn egress tới `binaries.prisma.sh` (chính sách mạng của tổ chức), nên **không chạy được** `prisma generate`/`prisma db push`/`prisma validate` ở đây để xác nhận schema biên dịch được. Đã rà thủ công cú pháp và các quan hệ 2 chiều (`@relation` tên khớp nhau ở cả `User`, `ParentLink`, `ParentConsent`, `Enrollment`). **Bắt buộc chạy `npm run db:generate` (và `db:push` trên môi trường có `DATABASE_URL` thật) trước khi merge**, quy trình build hiện có (`npm run build`) đã tự làm việc này.

---

## 6. Đã triển khai luồng API xác nhận phụ huynh (G1.04, G2.08–G2.11)

Trên nền `ParentLink`/`ParentConsent` ở mục 5, đã viết đủ 1 lát cắt dọc (vertical slice) dùng được thật, theo đúng convention hiện có của repo (`requireSession`/`requirePermission` trong `auth-guard.ts`, `notify()`, style email trong `email.ts`, token `randomBytes(32).hex` giống `forgot-password`):

| Route | Việc |
|---|---|
| `POST /api/parent-links` | Phụ huynh (user đã đăng nhập) gửi yêu cầu liên kết tới học viên bằng email; tạo `ParentLink` status `pending`, báo học viên qua `notify()`. |
| `GET /api/parent-links` | Liệt kê liên kết của user hiện tại ở cả 2 chiều (là phụ huynh / là học viên). |
| `PATCH /api/parent-links/[id]` | `action: "verify"` — **chỉ học viên** trong liên kết được xác nhận (đúng G2.10, không cấp quyền chỉ từ dữ liệu tự khai). `action: "revoke"` — học viên, phụ huynh, hoặc admin (`MANAGE_STUDENTS`). |
| `POST /api/parent-consents` | Tạo/gửi lại yêu cầu đồng ý cho 1 `Enrollment`, gọi được bởi admin hoặc chính phụ huynh có `ParentLink` verified; sinh token 7 ngày, gửi email (`sendParentConsentEmail`) + notify. Có xử lý resend khi yêu cầu cũ đã `rejected`/`expired`, chặn tạo trùng khi đang `pending` hoặc đã `approved`. |
| `GET /api/parent-consents/[token]` | Public (không cần đăng nhập, vì phụ huynh bấm từ email) — trả thông tin tối thiểu để hiển thị trang xác nhận; tự chuyển `pending` quá hạn thành `expired`. |
| `POST /api/parent-consents/[token]` | Public, có rate-limit theo IP — ghi nhận `approved`/`rejected`, báo cả học viên và gia sư sở hữu lớp (`Course.ownerId`) qua `notify()`. |
| `src/app/(guest)/xac-nhan-phu-huynh/page.tsx` | Trang xác nhận mở từ link trong email, theo đúng style/pattern của `xac-thuc-email` và `dat-lai-mat-khau` đã có sẵn. |

**Cố ý chưa làm trong lượt này:**
- Chưa tự động tạo `ParentConsent` khi tạo `Enrollment` theo ngưỡng tuổi (`dateOfBirth`) — vì `/api/admin/enrollments` hiện là nơi duy nhất tạo `Enrollment` (chưa có luồng tự đăng ký/self-serve, đúng như sheet ghi G2.03–G2.05 là "Chưa làm"). Việc tự động hoá theo ngưỡng tuổi nên làm cùng lúc với G2.06/G2.07 khi ngưỡng tuổi (D04) được chốt chính thức, để tránh phải sửa lại logic 2 lần.
- Route `/api/parent-consents` hiện phải được gọi tường minh (ai đó chủ động bấm "gửi yêu cầu xác nhận") — chưa có UI cho việc này trong `admin/hoc-sinh` hay `student/ho-so`.

**Giới hạn xác thực trong phiên này:** không chạy được `prisma generate` (egress tới `binaries.prisma.sh` bị chặn) nên **không có type-check thật** cho các route này qua `tsc`. Đã: (1) đối chiếu thủ công từng field/quan hệ với `schema.prisma`, (2) xác nhận convention route động `{ params }: { params: Promise<...> }` bằng cách đọc `src/app/api/courses/[id]/route.ts` thật thay vì đoán, (3) chạy `npx eslint` trên toàn bộ file mới — sạch, không lỗi mới (trang xác nhận dùng đúng pattern `fetch` trong `useEffect` như 2 trang tham chiếu `xac-thuc-email`/`dat-lai-mat-khau`, vốn đã vi phạm rule `react-hooks/set-state-in-effect` từ trước — không phải lỗi mới do lượt này gây ra). **Vẫn cần chạy `npm run db:generate` rồi `npx tsc --noEmit` thật trên môi trường có mạng đầy đủ trước khi merge.**

### 6.1. Đã nối vào UI thật (cùng lượt tiếp theo)

- **`student/ho-so`**: thêm khối "Liên kết phụ huynh" — hiển thị yêu cầu gửi tới mình (xác nhận/từ chối nếu đang là học viên), danh sách con đã liên kết (nếu đang là phụ huynh), và ô gửi yêu cầu liên kết mới bằng email. Dùng lại đúng style `Section`/`InfoRow` sẵn có trong file.
- **`admin/hoc-sinh` (DetailModal)**: thêm nút "Xác nhận PH" cạnh mỗi khoá học đã kích hoạt, gọi `POST /api/parent-consents`.
- Mở rộng `POST /api/parent-consents` để nhận thêm `{ userId, courseId }` (ngoài `enrollmentId`) — tra `Enrollment` qua khoá unique `userId_courseId` — vì UI admin có sẵn `userId`/`courseId`, không có `enrollmentId` lộ ra ngoài.
- `npx eslint` sạch cho cả 2 trang; các cảnh báo/lỗi lint hiện ra khi chạy lint toàn file đều ở dòng không liên quan tới thay đổi (đã đối chiếu số dòng để xác nhận là pre-existing).

### 6.2. Đã thêm `AuditLog` — hoàn thành G1.13 (P0) cho phần ParentLink/ParentConsent

Mục 2 (ma trận quyền) ghi rõ G1.13 cần "ghi nhật ký đổi quyền, điểm, consent và Coin" nhưng chưa được triển khai ở các lượt trước — đã bổ sung:

- Model `AuditLog` (`actorId?`, `action`, `resourceType`, `resourceId`, `metadata Json?`, `createdAt`) — `actorId` để `null` khi hệ thống tự thực hiện (vd tự chuyển `expired`).
- Helper `src/lib/auditLog.ts` — `logAction()`, cùng pattern nuốt lỗi như `notify()` (log là tính năng phụ trợ, không được làm hỏng hành động chính).
- Đã nối vào đúng 2 route vừa xây: `PATCH /api/parent-links/[id]` ghi `parent_link.verify`/`parent_link.revoke`; `POST /api/parent-consents/[token]` ghi `parent_consent.approved`/`parent_consent.rejected` (gán `actorId` = `parentLink.parentId` dù request là public/không đăng nhập, vì token chính là bằng chứng uỷ quyền) và `parent_consent.expired` (actor `null`, hệ thống tự chuyển trạng thái).

**Chưa làm:** nối `AuditLog` vào Coin/điểm số (còn nhiều điểm chạm: `wallet.ts`, chấm bài, chấm thi) — để lại cho lượt riêng vì phạm vi rộng hơn nhiều so với 2 route vừa xây.

---

## 7. Bước tiếp theo đề xuất

1. Chạy `npm run db:generate` + `npx tsc --noEmit` trên môi trường không bị chặn mạng để xác nhận schema và các route mới biên dịch sạch, rồi `db:push` lên môi trường staging.
2. Thêm nút "Gửi yêu cầu xác nhận phụ huynh" vào `admin/hoc-sinh` (khi tạo enrollment cho học viên có `ParentLink` verified) và mục "Liên kết phụ huynh" vào `student/ho-so`.
3. Gửi mục 2 và mục 3 cho SP/Owner duyệt — đây chính là input cho **G0.03 (ghi nhận và duyệt D01–D10)**.
4. Sau khi D01, D02, D03, D04 được chốt, cập nhật lại bảng 3.2/3.3 thành spec migration chi tiết cho `Subscription`/`ClassInvite`/`TutorProfile`, và tích hợp tự động hoá theo ngưỡng tuổi (G2.06/G2.07) vào luồng tạo Enrollment.
5. Song song, có thể bắt đầu **G0.05** (kiểm kê `Course` chưa gán chủ, `User` có `adminRole = "teacher"` hiện tại) để chuẩn bị dữ liệu chuyển đổi trước khi viết migration thật.
