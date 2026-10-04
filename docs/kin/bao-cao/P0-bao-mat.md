# Báo cáo tổng kết đợt vá bảo mật P0 — 2026-10-04

Phạm vi: `src/app/api/**` (Next.js backend). Người làm: Claude Code (3 phiên nối tiếp). Người quyết định & merge: Thọ (`NguyenVanTho2805`).

Đợt này đóng toàn bộ nhóm 1.1 (vá cross-teacher) + 1.4.1–1.4.3 (data model mới cho Wallet/Course/Enrollment) + nhóm P0 còn sót cho `question-categories` + 3 lỗi TOCTOU trên luồng xu phát hiện qua `/code-review`.

Mục `BE-xxx`/`FE-xxx` tham chiếu `docs/kin/backlog/viec.csv`.

---

## Giai đoạn 1 — Vá cross-teacher (BE-001 → BE-010)

**PR #5** — commit `5aa5948` (squash). Mở & merge trong phiên trước.

Mục tiêu: 4 route trước đây chỉ kiểm `MANAGE_COURSES` / `MANAGE_CURRICULUM` mà bỏ sót sở hữu — teacher A có thể tác động nội dung của teacher B.

### Files thay đổi

- `src/app/api/lessons/[id]/assignments/route.ts` (POST): lookup `lesson → chapter → section → course.ownerId`, gọi `ownsResource(auth, ownerId)` → 403.
- `src/app/api/categories/route.ts` (PUT): chặn `adminRole === "teacher"` (category là string dùng chung trên `Course`, không có model riêng — teacher đổi tên sẽ ghi đè khoá học của mọi gia sư).
- `src/app/api/deadlines/route.ts` (GET nhánh admin): dùng `ownerScopeWhere(session)` — teacher chỉ thấy deadline của khoá do mình tạo.
- `src/app/api/admin/reviews/route.ts` (GET) + `src/app/api/admin/reviews/[id]/route.ts` (PATCH/DELETE): GET lọc `course: ownerScopeWhere(guard)`; PATCH/DELETE kiểm `requirePermission` **trước** `findUnique` để non-auth user không dò được id tồn tại, rồi `ownsResource` qua `course.ownerId`.

### Ghi chú

- BE-005/006 (categories PUT): dùng chặn trực tiếp theo `adminRole === "teacher"` thay vì thêm quyền `MANAGE_CATEGORIES` mới — nhanh nhưng gắn cứng tên role; nếu sau này có role tương tự nên chuyển sang quyền riêng.
- BE-010 (admin/reviews): `requirePermission → findUnique → ownsResource` thay vì `requireOwnedResource` ngay, để tránh 404 vs 401 info leak.
- Harness test chéo (teacher A/B, admin_content, admin_super, student, chưa đăng nhập): 40/40 pass; trên code gốc fail 17/40.

### Phần không làm trong PR #5

Không có — BE-001 → BE-010 đều đóng.

---

## Giai đoạn 2 — Wallet sourceType/classId + Course capacity/classStatus + Enrollment status (BE-033 → BE-047)

**PR #6** — commit `3de9f69` (squash). Mở & merge trong phiên trước.

Mục tiêu: thêm trường mới cho báo cáo doanh thu theo lớp + trạng thái vòng đời Enrollment, siết mọi route coi "đã ghi danh" sang `status = "active"`.

### Schema (`prisma/schema.prisma`)

- `CoinTransaction`: thêm `sourceType: String?` (`"topup" | "reward" | "class_subscription" | "refund" | "penalty"`) + `classId: String? @relation Course`, + 2 index `[classId]`, `[sourceType]`. Nullable vì bản ghi cũ chưa có — tuyệt đối **không suy đoán ngược** (BE-039).
- `Course`: thêm `capacity: Int?` (null = không giới hạn) + `classStatus: String @default("open")` (`"open" | "closed" | "paused"`). KHÔNG trùng tên với `Course.status` boolean (ẩn/hiện công khai — giữ vì nhiều route đọc).
- `Enrollment`: thêm `status: String @default("active")` (`"pending_consent" | "active" | "suspended"`) + `@@index([status])`.

### Helpers mới

- `src/lib/wallet-constants.ts`: `COIN_REASONS`, `COIN_SOURCE_TYPES`, `DEFAULT_SOURCE_TYPE_FOR_REASON` — thay chuỗi tự do rải rác.
- `src/lib/enrollment.ts`: hằng số `ENROLLMENT_STATUS` + helper `isEnrollmentActive`.
- `src/lib/wallet.ts`: `spendCoins`/`addCoins` nhận thêm `opts: { sourceType, classId }` (optional, tương thích ngược).

### Route endpoints mới

- `GET /api/wallet/transactions?classId=&sourceType=&cursor=&limit=` — lịch sử ví của chính session, dùng cho Gia sư Dashboard (xem thu nhập theo lớp) + trang Lịch sử ví của học viên.

### Route endpoints cập nhật

- `PUT`/`PATCH /api/courses/[id]`: nhận thêm `capacity`, `classStatus`; `capacity` khi hạ phải ≥ số `Enrollment` đang `active`; `classStatus` validate thuộc 3 giá trị.
- 10 route Enrollment-aware chuyển sang `isEnrollmentActive`: `courses/[id]` GET (hasAccess), `courses/[id]/reviews` POST, `exams/[id]/start`, `lessons/[id]/context` (nới `"suspended"` đọc nội dung đã mở theo R01), `schedule`, `deadlines`, `assignments/[id]/answer` GET+PATCH, `assignments/[id]/submit`, `progress/[lessonId]` POST+PATCH+DELETE, `enrollments`.

### Ghi chú

- BE-043 (tách Class khỏi Course): chưa làm — chờ quyết định D01/D02.
- BE-046 (`ClassInvite.redeem`): chưa làm — thuộc 1.4.6, P1.
- BE-047 (ParentConsent → active): chưa làm — model `ParentConsent` chưa có trên nhánh `main`.
- `Course.classStatus = "closed"/"paused"` chưa chặn tạo Enrollment mới — logic đó nên đặt trong `ClassInvite.redeem` và `subscriptions/[id]/purchase` khi làm 1.4.5/1.4.6.
- **Bỏ sót**: `GET /api/lessons/[id]` route vẫn dùng `if (!enrolled)` không kiểm status. Phát hiện ở giai đoạn 4 (code-review), fix trong PR #7.

---

## Giai đoạn 3 — Vá quyền `question-categories` (P0 còn sót) + bỏ sót PR #6

**PR #7** — commit `5ad0a58` (squash). Phiên hiện tại.

Mục tiêu: audit các "categories-like API" sau khi PR #5 vá `categories` string, tìm chỗ sót có cùng pattern.

### Phát hiện

`QuestionCategory` (cây đầu mục ngân hàng câu hỏi) dùng CHUNG giữa mọi giáo viên — không có cột `ownerId`. 3 route liên quan chỉ kiểm `MANAGE_CURRICULUM`:

1. `PATCH /api/question-categories/[id]`: teacher đổi tên hoặc re-parent node → ảnh hưởng câu hỏi của mọi teacher khác.
2. `DELETE /api/question-categories/[id]`: teacher xoá node trống do teacher khác tạo.
3. `POST /api/question-categories/[id]/duplicate`: khi copy cả ngân hàng, `questionBankItem.findMany` đọc **không lọc status/owner** → teacher B rút được bản `draft`/`pending` của teacher A qua cổng "Copy ngân hàng" (clone đi vào bank của B dưới tên B).
4. `POST /api/question-categories` (bonus): teacher tạo đầu mục cấp gốc trong cây dùng chung — không phá dữ liệu nhưng tạo clutter.

### Fix

1 + 2: chặn `adminRole === "teacher"` sau `requirePermission` — cùng pattern PR #5.

3: thêm `statusScope = isReviewer(auth.adminRole) ? {} : { OR: [{ status: "approved" }, { ownerId: auth.userId }] }` cho query lấy source items — giống list/picker/duplicates đã có.

4: chặn teacher tạo đầu mục với `parentId=null`.

### Bỏ sót PR #6 phát hiện trong lúc code-review (gộp luôn vào PR #7)

- `src/app/api/lessons/[id]/route.ts` (GET): thay `if (!enrolled)` → `if (!isEnrollmentActive(enrolled))`. PR #6 đã chuyển mọi route Enrollment-aware sang `isEnrollmentActive` nhưng sót route này.

### Audit kết quả: những chỗ đã OK (không cần sửa)

- `src/app/api/assignments/[id]`, `[id]/results`, `[id]/submissions`, `[id]/submissions/[submissionId]/grade`, `[id]/questions/[questionId]/grade` — đều dùng `requireOwnedResource(..., assignment.ownerId)`. ✓
- `src/app/api/assignments/[id]/answer`, `[id]/submit` — PR #6 đã siết `isEnrollmentActive`. ✓
- `src/app/api/deadlines/route.ts` — PR #5 (`ownerScopeWhere`) + PR #6 (`status: "active"`). ✓
- `src/app/api/question-bank/[id]` PUT/DELETE + `question-bank` POST — dùng `requireOwnedResource` / `ownerId: auth.userId`. ✓

### Chỗ còn sót nhỏ (không P0, không vá trong đợt này)

- `PATCH /api/assignments/[id]/questions/[questionId]/grade` nhận `userId` từ body nhưng không kiểm user có thực sự enroll — teacher có thể tạo `AssignmentAnswer` rác cho userId bất kỳ. **Chỉ ảnh hưởng dữ liệu của chính teacher, không cross-teacher.**
- `POST /api/question-categories`: teacher gửi `parentId` không tồn tại → 400; gửi `parentId=null` → 403. Khác status code → về lý thuyết có thể dò ID. Minor.
- `POST /api/question-categories/[id]/duplicate` dùng `isReviewer` chỉ true cho `admin_super`/`admin_content`. Nếu sau này thêm admin role khác có `MANAGE_CURRICULUM` nhưng không reviewer sẽ bị siết như teacher. Hiện tại OK vì chỉ có 3 role.

---

## Giai đoạn 4 — Vá 3 TOCTOU trên luồng xu

**PR #8** — commit `ab5413e` (squash). Phiên hiện tại.

Mục tiêu: BE-011 yêu cầu chạy `/code-review` trên diff đã merge/mở. Code-review phát hiện 6 finding, trong đó 3 TOCTOU trên luồng xu đáng vá ngay.

### Fix

**4a. `POST /api/answers/[id]/accept`**  
Trước: `answer.question.status === "answered"` kiểm ngoài transaction → 2 request accept đồng thời đều qua guard → `addCoins(ANSWER_REWARD)` chạy 2 lần.  
Sau: `question.updateMany({ where: { id, status: { not: "answered" } }, ... })` — atomic flip, chỉ 1 cái qua được `count=1`, cái thua `count=0` bail 409.

**4b. `POST /api/admin/answer-reports/[id]/resolve`**  
Trước: 2 guard đọc stale (`report.status !== "pending"` + `!report.answer.isPenalized`) → 2 admin resolve đồng thời (hoặc nhiều report trên cùng answer approved dồn) → `addCoins(-rewardPaid)` chạy 2 lần, học viên bị phạt kép.  
Sau: `answerReport.updateMany + answer.updateMany` lần lượt với guard trong `where` → `addCoins(-rewardPaid)` chạy đúng 1 lần cho mỗi answer bất kể có bao nhiêu report approved.

**4c. `POST /api/community/threads` + `POST /api/community/threads/[id]/reply`**  
Trước: `count() < MAX` ngoài transaction → burst requests vượt `MAX_THREAD_REWARDS_PER_DAY` / `MAX_REPLY_REWARDS_PER_DAY`.  
Sau: thêm helper `addDailyCappedCoins(userId, amount, reason, refId, cap)` trong `src/lib/wallet.ts` — mở `$transaction`, acquire `pg_advisory_xact_lock(hashtext("userId:reason"))` → 2 request cùng user+reason serialize nhau. Trong lock: `count()` rồi `wallet.upsert` + `coinTransaction.create` nếu dưới cap. Trả bool. **Không đổi schema**, không cần migration.

### Ghi chú

- "Hôm nay" vẫn tính theo `setHours(0,0,0,0)` local server (y hệt code cũ) — không rework timezone trong PR này.
- `addCoins()` cũ không bị đổi — còn 10+ call-site khác dùng, không cần cap theo ngày.

### 3 finding không fix trong PR này

- 2 nit trên PR #7 (admin role edge case, info leak qua status code) — minor, không chặn.
- Finding thứ 7 (`questions/[questionId]/grade` nhận userId tự do) — đã ghi ở giai đoạn 3.

---

## Phần KHÔNG đụng tới trong đợt này

- **PR #4** — xoá `CourseFavorite` dead code (BE-013 → BE-019). Mở từ phiên trước, vẫn chưa merge. Rủi ro `prisma db push` fail trên main vì bảng `course_favorites` còn dữ liệu — cần chạy thủ công `npx prisma db push --accept-data-loss` trên staging trước khi merge.
- Nhóm 2.1 (Design System — FE-087 → FE-097) — frontend, chưa đụng vào.
- Backlog BE-011 nhánh "manual test chéo 2 teacher" — không có DB thật trong session để test.

---

## Hiện trạng CI/CD sau merge #7 + #8

- `main`: 4 commit mới (#5, #6, #7, #8). Vercel đang build/deploy sau merge #8.
- `prisma schema` ở main: có đủ `Course.capacity`, `Course.classStatus`, `Enrollment.status`, `CoinTransaction.sourceType`, `CoinTransaction.classId` — khớp với dữ liệu đã có trên Neon staging (do PR #6 từng test).
- Không còn conflict giữa 4 PR vừa merge.
- `eslint` sạch trên mọi file sửa. `tsc --noEmit` chưa chạy trực tiếp được trong sandbox (binaries.prisma.sh bị proxy chặn — xem PR #4). Build Vercel là phép thử gián tiếp.

## Follow-up đề xuất

Thứ tự ưu tiên:

1. Quyết định PR #4 (merge sau khi chạy `prisma db push --accept-data-loss` thủ công, hoặc close nếu không cần).
2. BE-012 — manual test chéo 2 teacher trên staging thật.
3. Chuyển "chặn thẳng theo `adminRole === 'teacher'`" (ở `categories` + `question-categories`) sang quyền riêng (`MANAGE_SHARED_TAXONOMY` chẳng hạn) khi có thêm role.
4. Vá `PATCH /api/assignments/[id]/questions/[questionId]/grade` — kiểm user có thực sự enroll trước khi upsert `AssignmentAnswer`.
5. Rework timezone cho "hôm nay" ở `addDailyCappedCoins` nếu đổi server region.
