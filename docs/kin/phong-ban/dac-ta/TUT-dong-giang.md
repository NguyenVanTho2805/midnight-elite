# TUT-dong-giang — Đồng giảng: giáo viên chủ nhiệm (GVCN) và giáo viên bộ môn trong một lớp

PHÒNG/VAI: pb-gia-su → tut-rnd (đặc tả) · NHÁNH: `claude/gia-su-dong-giang` (rẽ từ `origin/main` 20c53413) · CỠ: L (schema + quyền + 3 mảng màn)
CỜ: **TIỀN có** (chạm gián tiếp: điểm danh/chốt buổi kéo theo sinh phí — mục 4.6, 9) · **TRẺ EM có** (danh sách học viên, liên hệ phụ huynh, điểm — mục 4.5, 9) · **ĐỔI NỀN không** (Next 16 + Prisma hiện có).
Figma: không có khung riêng cho Đồng giảng; tut-rnd KHÔNG vẽ thêm trong phiếu này (phiếu chỉ giao đặc tả). Màn dựng theo khung gia sư có sẵn — Bản final 578:2 (thanh bên gia sư 578:11), Bigupdate 606:5/606:6 (Giáo trình) — và token `--kin-*`. Cần khung mới thì COO giao riêng.

Mọi `tệp:dòng` đọc trên worktree này (origin/main 20c53413, đã có TUT-002, BU-00, BU-01, BU-02). PR #142 (`claude/admin-xoa-tk-len-gia-su`, chưa gộp) chỉ ĐỌC ở `/Users/Admin/Documents/Code/.wt-adm-xoa`.

Lời chủ (nguyên văn): *"Chuyển thành gia sư thì không thể vào lớp như học sinh nữa, gia sư sẽ có lớp riêng hoặc gia sư có thể vào lớp của gia sư khác (kiểu GVCN và giáo viên bộ môn, tức ít quyền hơn, chẳng hạn giáo viên bộ môn không thể xóa lớp của GVCN... tự research và thêm)."*

---

## 1. Vấn đề + bằng chứng

**1.1 Một lớp = một gia sư, cứng ở mọi tầng.** Không có đường nào cho gia sư thứ hai vào lớp.

| Bằng chứng | Tệp:dòng |
|---|---|
| Chủ lớp là MỘT cột `Course.ownerId`; không có bảng giáo viên-lớp | `prisma/schema.prisma:59` (`ownerId String?`), `:93` (`@@index([ownerId])`) |
| `ownsResource`: gia sư (adminRole teacher) chỉ qua khi `ownerId === userId`; quản trị cấp 1/nội dung luôn qua | `src/lib/auth-guard.ts:23-26` |
| `authorizeCourse` (mọi route buổi/lịch/phí): lớp không có 404, lớp người khác 403 | `src/lib/sessionBookServer.ts:27-34` |
| `requireCourseTutor` (giáo trình, duyệt vào lớp): `course.ownerId !== auth.userId` → 403 | `src/lib/enrollServer.ts:354-361` |
| Trang lớp: không phải chủ, không phải quản trị, không phải học sinh có ghi danh → `notFound()` (404, không lộ lớp tồn tại) | `src/app/lop-cua-toi/[courseId]/page.tsx:48-58` |
| Học liệu: `isCourseManager` = quản trị hoặc đúng chủ lớp | `src/lib/mediaAccess.ts:26-30` |
| Danh sách học sinh, hộp việc, tổng quan, điểm danh sót: khoá `course: { ownerId: me }` | `tutorStudentsServer.ts:24,52,55,87`; `tutorInboxServer.ts:33`; `tutorOverviewServer.ts:11`; `unmarkedServer.ts:26`; `hocPhiDashboardServer.ts:18` |
| Cộng đồng lớp: "Members = học viên active + GVCN (`Course.ownerId`)" | `classThreadAccess.ts:6,17-19` |
| Phí luôn ghi cho chủ lớp: `tutorId = course.ownerId ?? by` | `feeChargeServer.ts:81` (điểm danh), `:338` (phí khác) |
| Tên bảng điểm danh buộc `createdBy` vào User với `onDelete: Cascade` — xoá tài khoản người tạo buổi là xoá buổi | `schema.prisma:1191,1211` |

Hôm nay một gia sư "vào lớp người khác" **không có đường nào**: trang 404, API 403 (mọi route ở bảng 3.1 dòng G đều đúng thế). Đó là mặc định muốn GIỮ.

**1.2 Chuyển học sinh thành gia sư (PR #142, chưa gộp).** `POST /api/admin/students/[id]/len-gia-su` đặt `role: "admin", adminRole: "teacher", tutorVerified: true` và ghi chú *"Ghi danh KHÔNG đổi (em vẫn giữ lớp đang học)"* (`.wt-adm-xoa/src/app/api/admin/students/[id]/len-gia-su/route.ts:1-2`, trả về `activeEnrollments`). Sau chuyển người đó không còn vào vỏ học sinh (`studentAreaRedirect` → `/lop-cua-toi`, `tutorGate.ts:65-77`) nhưng **Enrollment cũ còn nguyên**. Mục 2 liệt kê hệ quả.

---

## 2. Rà đường ghi danh làm HỌC SINH — chỗ hở với người đã là gia sư

Grep `enrollment.create|upsert|createMany|enrollInTx(` toàn `src/` (trừ generated): **chỉ 4 nơi ghi** Enrollment. Không có raw SQL, `bulkInvite.ts` và `studentImportServer.ts` KHÔNG tạo Enrollment (bulkInvite tạo mã mời cá nhân; nhập danh sách tạo `StudentProfile`).

| # | Nơi ghi | Ai gọi | Chặn role admin / gia sư chờ duyệt? | Kết luận |
|---|---|---|---|---|
| E1 | `api/invites/[id]/redeem/route.ts:116` (`enrollInTx`) | học sinh tự | Có: `session.role !== "student"` → 403 và `canSelfEnroll` (TUT-002) | ĐÓNG |
| E2 | `api/courses/[id]/join/route.ts:45` (`enrollInTx`) | học sinh tự (lớp `open`) | Có: `denyNonStudent` (`enrollServer.ts:345-351`) | ĐÓNG |
| E3 | `lib/enrollServer.ts:223` `decideJoinRequest` → `enrollInTx` cho `r.userId` | gia sư duyệt đơn xin vào lớp | **KHÔNG**: chỉ kiểm trạng thái đơn, không đọc lại vai của người xin | **HỞ H1** — học sinh gửi đơn "approve", rồi được chuyển thành gia sư, rồi chủ lớp bấm Duyệt ⇒ một tài khoản gia sư thành học viên |
| E4 | `enrollServer.ts:62` (`enrollInTx` tự tạo) | E1+E2+E3 | **KHÔNG kiểm vai của người được ghi danh** (hàm nhận `userId`, không đọc `User.role`) | Gốc của H1. Sửa MỘT chỗ ở đây đóng cả E1–E3 kể cả mã cá nhân |
| E5 | `api/tutor/lop/[courseId]/hoc-sinh/route.ts:42` | gia sư thêm em đã học lớp khác của mình | **KHÔNG**: `known` chỉ lọc theo Enrollment ở lớp khác của gia sư, không lọc `user.role` | **HỞ H2** — học sinh cũ đã chuyển thành gia sư (Enrollment cũ còn) vẫn lọt vào `known` ⇒ bị thêm vào lớp thứ hai; hoặc chính chủ lớp tự thêm đồng nghiệp |
| E6 | `api/admin/enrollments/route.ts:30` | quản trị `MANAGE_STUDENTS` | **KHÔNG** (chỉ chặn `deletedAt`) | **HỞ H3** — quản trị kích hoạt tài khoản gia sư làm học viên, kể cả lớp chính họ dạy. Thuộc Quản trị ⇒ yêu cầu mục D |

Hở khác (H4, đọc-không-ghi): sau chuyển vai, tài khoản vẫn mang `Enrollment` active. API học sinh nào chỉ tra `Enrollment` theo `userId` mà không kiểm `session.role === "student"` thì vẫn mở. Đã kiểm ba route cốt lõi **an toàn**: `lessons/[id]/context` (`session.role === "student"` mới tra), `lessons/[id]` GET (nhánh `role === "admin"` rẽ trước), `media/[id]/file|stream` (qua `canWatchStoredMedia` có `role`). **Chưa an toàn / chưa kiểm** (đếm `role` = 0 trong tệp): `exams/[id]/start`, `progress/[lessonId]`, `assignments/[id]/submit`, `followed-courses/[courseId]`, `enrollments` — thuộc `stu-code` (`api/exams`, `api/student`). Việc tut-test: bài `t-course-teachers` có ca "gia sư có Enrollment cũ gọi từng route này"; route nào trả 200 thì ghi P2 cho stu-code, KHÔNG tự sửa.

**Sửa đề xuất (nhỏ, một nguồn):**
1. `enrollInTx` (tut-code; `enrollServer.ts`, nằm trong PHAM-VI tut-code): đầu hàm, sau khoá, đọc `User.role` của `i.userId`; khác `"student"` ⇒ `{ ok: false, code: "NOT_STUDENT", status: 409, error: "Tài khoản này không phải học sinh" }` (thêm giá trị vào union `EnrollResult`; ba caller E1–E3 map ra 409). `decideJoinRequest` ánh xạ sang outcome mới `"khong-phai-hs"`; đơn bị đánh dấu `cancelled`, không tiêu `usedCount`.
2. `tutor/lop/[courseId]/hoc-sinh` (tut-code): `known` thêm `user: { role: "student" }`; ngoài ra chặn thêm `userId` đang là chủ hoặc đồng giảng của chính lớp (`403`).
3. `admin/enrollments` (Quản trị): `user.role !== "student"` ⇒ `409 { code: "not_student" }`. → mục D.
4. **Người vừa là Enrollment cũ vừa là gia sư (đã chuyển):** Enrollment **giữ nguyên dữ liệu** (không xoá, không đổi trạng thái ⇒ không đụng buổi/phí/phiếu đã có; đúng điều PR #142 chốt). Người đó không thấy vỏ học sinh. Nếu họ là học viên của **chính lớp họ dạy** (là chủ, hoặc được mời đồng giảng): (a) mời đồng giảng chặn `409 code: "is_student_of_course"` khi họ có Enrollment bất kỳ trạng thái ở lớp đó; (b) trường hợp họ TẠO lớp rồi mới có Enrollment cũ ở đúng lớp đó không xảy ra vì E4 chặn ghi mới; Enrollment cũ ở lớp CỦA NGƯỜI KHÁC thì chỉ là dữ liệu. Chuyển vai khi họ còn Enrollment `active` ở lớp thu phí kiểu mới có thể tiếp tục sinh dòng phí — đó là TIỀN, hỏi chủ (mục 9, Q6).

---

## 3. Phạm vi tệp + bảng kiểm route (không trùng nhau)

### 3.1 Bảng kiểm mọi route/trang LIÊN QUAN LỚP

Cách đọc cột "Kiểm hôm nay": `own` = `ownsResource(auth, ownerId)` (`auth-guard.ts:23`); `aC` = `authorizeCourse` (cùng `own`); `rCT` = `requireCourseTutor` (`ownerId !== userId`); `rT` = `requireTutor` (chỉ vai teacher) + tự khoá `ownerId: me`; `mgr` = `isCourseManager`; `author` = người soạn (`Assignment.ownerId`, `Exam.ownerId`).

Phân loại: **G** giữ CHỈ CHỦ (mặc định, đồng giảng tự động 403 — KHÔNG sửa dòng kiểm); **M** mở có chọn lọc (ghi mức: *xem* / *dạy* / *soạn* / *chấm*); **T** chạm TIỀN (đồng giảng KHÔNG thấy, KHÔNG ghi; 403). **N/A** = đường của học sinh/công khai, không thuộc phạm vi (nêu để đủ danh sách). Một route nhiều phương thức tách dòng khi phân loại khác nhau.

Ký hiệu sửa: `aC→acc` nghĩa là thay `authorizeCourse`/`own` bằng `loadCourseAccess` + `canDo(role, action)` (mục 4). Dòng G không có việc sửa.

**A. `api/courses/[id]/*` và `api/courses`**

| Tệp | Kiểm hôm nay | Lớp | Mức/ghi chú |
|---|---|---|---|
| `courses/route.ts` GET | `ownerScopeWhere` (gia sư chỉ thấy lớp của mình) | G | danh sách lớp đồng giảng đi qua route MỚI (mục 5.2), không nới route này |
| `courses/route.ts` POST | `requirePermission` | G | tạo lớp riêng; không ảnh hưởng |
| `courses/[id]/route.ts` GET | `mgr` (dòng 45) | M | *xem*; trả bản **đã bỏ** `price`, `originalPrice`, `feeMode`, `tag`, `lessons`-giá cho đồng giảng (tiền) |
| `courses/[id]/route.ts` PUT, PATCH | `own` (dòng 100) | G | sửa thông tin/giá lớp |
| `courses/[id]/route.ts` DELETE | `own` | G | xoá/ẩn lớp |
| `courses/[id]/attendance-sessions/route.ts` GET | `own` | M | *xem*: chỉ buổi có người dạy là mình + buổi chưa gán (mục 4.4) |
| `courses/[id]/attendance-sessions/route.ts` POST | `own` | M | *dạy*: tạo buổi của MÌNH (`taughtBy = me`) |
| `courses/[id]/attendance-export/route.ts` GET | `own` | G | xuất điểm danh; vòng 1 giữ chủ (xem Q9) |
| `courses/[id]/calendar/route.ts` GET | `aC` | M | *xem* |
| `courses/[id]/calendar/route.ts` PATCH | `aC` | G | màu/link chung lớp |
| `courses/[id]/class-schedules/route.ts` GET | `own` | M | *xem* mọi khung |
| `courses/[id]/class-schedules/route.ts` POST | `own` | M | *dạy*: co_teacher tạo khung với `teacherId = me`; subject_teacher: không |
| `courses/[id]/schedule-conflicts/route.ts` POST | `aC` | M | *dạy*: trùng lịch tính theo người dạy (`teacherId ?? ownerId`), không theo chủ lớp |
| `courses/[id]/sessions/route.ts` POST (buổi lẻ/bù) | `aC` | M | *dạy*: co_teacher + subject_teacher tạo buổi của MÌNH (`taughtBy = me`) |
| `courses/[id]/sessions/[dateKey]/route.ts` GET | `aC` | M | *xem*; bỏ `reopenWarning` (nói về phiếu/tiền) cho đồng giảng |
| `courses/[id]/sessions/[dateKey]/route.ts` PATCH (ghi chép) | `aC` | M | *dạy*: chỉ buổi `taughtBy = me`; đổi `taughtBy` = chỉ chủ |
| `courses/[id]/sessions/[dateKey]/close/route.ts` POST close | `aC` | G | sinh phí (`syncChargesOnClose`, dòng 44-45) ⇒ TIỀN; thay bằng `de-nghi-chot` (5.2) |
| `courses/[id]/sessions/[dateKey]/close/route.ts` POST reopen | `aC` | G | gỡ phí chưa vào phiếu |
| `courses/[id]/students/route.ts` GET | `own` | M | *xem*: **chỉ** `userId`, `name`, `status`, `enrolledAt`, `progress`; bỏ `email`, `phone`, `school` (TRẺ EM) |
| `courses/[id]/invites/route.ts` GET, POST | `own` | G | mã mời |
| `courses/[id]/reorder/route.ts` PATCH | `own` (MANAGE_CURRICULUM) | M | *soạn*: co_teacher; subject_teacher chỉ trong nhóm của mình |
| `courses/[id]/sections/route.ts` POST | `own` | M | *soạn*: co_teacher |
| `courses/[id]/duplicate/route.ts` POST | `own` | G | nhân bản lớp (mang cả cấu hình phí) |
| `courses/[id]/fees/route.ts` GET, PUT | `own` | T | |
| `courses/[id]/fee-rates/route.ts` GET, POST | `own` | T | |
| `courses/[id]/extra-fees/route.ts` GET, POST | `own` | T | |
| `courses/[id]/packages/route.ts`, `packages/[pid]/route.ts` | `aC` | T | gói buổi trả trước (2 tệp) |
| `courses/[id]/recordings/route.ts` GET | vai tự tính (`classRecordingsServer.ts:20-24`, chỉ chủ) | M | *xem* |
| `courses/[id]/recordings/route.ts` POST, `recordings/[rid]/delete/route.ts` POST | như trên | G | thêm/xoá bản ghi buổi (vòng 2 nếu chủ muốn) |
| `courses/[id]/join/route.ts` POST | `requireStudentForJoin` | N/A | đường học sinh; đã chặn vai (E2) |
| `courses/[id]/reviews/route.ts` | `getSession` | N/A | đánh giá của học sinh |

**B. `api/attendance-sessions/*`, `class-schedules`, `invites`**

| Tệp | Kiểm hôm nay | Lớp | Mức/ghi chú |
|---|---|---|---|
| `attendance-sessions/[id]/route.ts` GET | `own` (dòng 45-51) | M | *xem* danh sách điểm danh; bỏ `parentName`, `parentPhone` (dòng 100-101) khỏi roster cho đồng giảng |
| `attendance-sessions/[id]/route.ts` PUT | `own` | M | *dạy*: **chỉ** buổi `taughtBy = me` và buổi **chưa chốt**; đã chốt ⇒ 409 `SESSION_CLOSED_OWNER_ONLY` (PUT chạy `syncSessionCharges` + `syncPackageUsesForSession` trong cùng giao dịch — dòng 177-190 — là TIỀN); không nhận `makeupCreditId`, `parentVisible` (403) |
| `attendance-sessions/[id]/route.ts` DELETE | `own` | G | |
| `attendance-sessions/[id]/diem/route.ts` GET, PUT | `own` | G | điểm theo buổi, đồng ý gắn với chủ lớp (`scoreConsentFor(ownerId)` dòng 35,64) ⇒ TRẺ EM, chờ chủ (Q4) |
| `attendance-sessions/[id]/zalo/route.ts` POST | `own` | G | mở Zalo nhắn phụ huynh = liên hệ phụ huynh |
| `class-schedules/[id]/route.ts` PUT | `own` | M | *dạy*: chỉ khung `teacherId = me`; đổi `teacherId` chỉ chủ |
| `class-schedules/[id]/route.ts` DELETE | `own` | M | *dạy*: chỉ khung `teacherId = me` (không xoá khung người khác, không xoá khung của chủ) |
| `invites/[id]/route.ts` DELETE | `own` | G | thu hồi mã |
| `invites/[id]/redeem`, `invites/by-code/[code]`, `invites/my-requests*` | session học sinh | N/A | |

**C. Nội dung giảng dạy: `sections` `chapters` `lessons` `assignments` `media`**

| Tệp | Kiểm hôm nay | Lớp | Mức/ghi chú |
|---|---|---|---|
| `sections/[id]/route.ts` PUT | `own` | M | *soạn*: co_teacher |
| `sections/[id]/route.ts` DELETE | `own` | G | xoá cả phần |
| `sections/[id]/chapters/route.ts` POST | `own` | M | *soạn*: co_teacher; subject_teacher tạo nhóm thì `Chapter.teacherId = me` |
| `chapters/[id]/route.ts` PUT, DELETE | `own` | M | *soạn*: co_teacher; subject_teacher chỉ nhóm `teacherId = me`; đổi `teacherId` chỉ chủ |
| `chapters/[id]/lessons/route.ts` POST | `own` | M | *soạn*: như trên |
| `lessons/[id]/route.ts` GET | `mgr` (dòng 32-33) | M | *xem* |
| `lessons/[id]/route.ts` PUT (và DELETE nếu có) | `own` (dòng 67) | M | *soạn*: co_teacher; subject_teacher chỉ bài trong nhóm của mình |
| `lessons/[id]/context/route.ts` GET | `mgr` (dòng 49) | M | *xem* |
| `lessons/[id]/assignments/route.ts` GET | `managerOf` (dòng 39) | M | *xem* |
| `lessons/[id]/assignments/route.ts` POST | `own` (dòng 82) | M | *soạn*: `Assignment.ownerId = me` (tác giả); co_teacher mọi bài, subject_teacher bài trong nhóm mình |
| `lessons/[id]/azota-status/route.ts` GET | `own` (dòng 17) | M | *chấm* (xem trạng thái nộp Azota) |
| `lessons/[id]/azota-done/route.ts` | `requireSession` | N/A | học sinh |
| `assignments/[id]/route.ts` PUT, DELETE | `requireOwnedResource(assignment.ownerId)` | M | *soạn*: sửa/xoá khi là tác giả **hoặc** co_teacher của lớp chứa bài; subject_teacher chỉ bài của mình |
| `assignments/[id]/results/route.ts` GET | như trên | M | *chấm* |
| `assignments/[id]/submissions/route.ts` GET | như trên | M | *chấm* |
| `assignments/[id]/submissions/[submissionId]/grade/route.ts` PATCH | như trên | M | *chấm* |
| `assignments/[id]/questions/[questionId]/grade/route.ts` PATCH | như trên | M | *chấm* |
| `assignments/[id]/answer`, `submit` | `requireSession` | N/A | học sinh |
| `media/video/init`, `video/complete`, `upload/[id]`, `document/init`, `document/complete`, `document/[id]`, `media/config` | `requirePermission` + tệp của chính người tải (`asset.ownerId`) | G | KHÔNG đổi: đồng giảng tải lên thư viện CỦA MÌNH rồi gắn vào bài trong phạm vi mình soạn; `lessonMediaServer.ts:65,87` đã buộc "tệp phải của người gắn" |
| `media/[id]/file/route.ts`, `media/[id]/stream/route.ts` | `asset.ownerId === me` hoặc `managerOf` (dòng 30-41 / 24-39) | M | *xem*: thêm nhánh đồng giảng đang active của lớp chứa bài (chủ lớp đọc tệp của đồng giảng đã được qua `managerOf`; học sinh qua ghi danh) |
| `lesson-notes`, `deadlines`, `schedule`, `enrollments`, `progress`, `followed-courses` | session học sinh | N/A | xem H4 mục 2 |

**D. `api/tutor/*` (liên quan lớp)**

| Tệp | Kiểm hôm nay | Lớp | Mức/ghi chú |
|---|---|---|---|
| `tutor/lop/route.ts` GET, POST | `rT` | G | lớp RIÊNG của tôi; giữ nguyên |
| `tutor/lop/[courseId]/giao-trinh/route.ts` (+ `bai/[lessonId]`, `chuong`, `chuong/[chapterId]`, `muc`, `trang-thai`) — 6 tệp | `rCT` | M | *soạn*: `rCT` → `acc`; subject_teacher chỉ bài/nhóm của mình; `trang-thai` (xuất bản/ẩn) cùng quy tắc |
| `tutor/lop/[courseId]/yeu-cau/route.ts`, `yeu-cau/[id]/duyet`, `yeu-cau/[id]/tu-choi`, `yeu-cau/hang-loat` — 4 tệp | `rCT` | G | duyệt vào lớp |
| `tutor/lop/[courseId]/hoc-sinh/route.ts` POST | `rT` + chủ | G | thêm học sinh (+ sửa H2) |
| `tutor/lop/[courseId]/bao-cao-link/route.ts` GET | chủ | G | link phụ huynh |
| `tutor/classes/[id]/zalo-group/route.ts` PUT | `updateMany where ownerId` | G | |
| `tutor/hoc-sinh/route.ts`, `hoc-sinh/[userId]/route.ts`, `trang-thai`, `bao-cao-link` — 4 tệp | `rT` + `ownerId` | G | hồ sơ em, gia đình, phụ huynh (TRẺ EM) |
| `tutor/gia-dinh/route.ts`, `gia-dinh/[id]/route.ts`, `tutor/ho-so/*` (5 tệp), `tutor/truong-tuy-chinh` | `rT` | G | hồ sơ học sinh/gia đình (TRẺ EM) |
| `tutor/so-diem/route.ts` | chủ lớp (dòng 21-23) | G | điểm (TRẺ EM) |
| `tutor/session-plans/route.ts`, `session-plans/[id]/route.ts` | `rT` + `ownerId` | G | kế hoạch buổi của chủ; vòng 2 |
| `tutor/session-changes/route.ts`, `session-changes/[id]/zalo`, `tutor/absences/[id]`, `tutor/reminders`, `tutor/thong-ke-chuyen-can` | `rT` + `ownerId` | G | dời/huỷ buổi, nghỉ, nhắc phụ huynh |
| `tutor/monthly-reports/*` — 5 tệp | `rT` | G | báo cáo tháng gửi phụ huynh (TRẺ EM) |
| `tutor/schedule/route.ts` GET | `rT` | M | *xem*: thêm khung/buổi của lớp đồng giảng mà `teacherId = me` (đọc) |
| `tutor/hop-viec/route.ts` GET (Hộp việc) | `rT`; `tutorInboxServer.ts:33` | M | *xem*: thêm nhóm "Lớp tôi đồng giảng" (lời mời chờ, buổi tôi dạy chưa điểm danh); không thêm việc tiền/phụ huynh |
| `tutor/de-thi/[id]/giao`, `ket-qua*`, `ma-de`, `tutor/quiz/*` (10 tệp), `tutor/quiz-cham/*` (9 tệp) | `author` (`exam.ownerId === me`, `deThiAssignServer.ts:30`, `quizServer.ts:62`) | M | *soạn/chấm*: đề vẫn của TÁC GIẢ; mở thêm duy nhất: tác giả là đồng giảng được **giao** đề vào lớp mình đồng giảng (kiểm `canDo(role,"quiz.assign")` + môn của mình); chủ lớp xem kết quả đề do đồng giảng giao = vòng 2 (Q10) |
| `tutor/de-thi/*` còn lại, `tutor/ngan-hang/*`, `tutor/ai-quota`, `tutor/post-draft`, `tutor/doc-brand`, `tutor/channels`, `tutor/ho-tro` | thư viện/hồ sơ CỦA tác giả | G | không phải dữ liệu lớp |
| `tutor/hoc-phi-thang`, `tutor/invoices` (+ `[id]`, `reminders`, `zalo`), `tutor/student-discounts`, `tutor/bank-transactions*` (3 tệp), `tutor/payout-account*` (2 tệp), `tutor/goi*` (2 tệp), `tutor/late-fee-hint` | `requireTutorOnly` / `rT` + `ownerId` | T | |
| `tutor/yeu-cau/*` | `rT` | G | yêu cầu tìm gia sư (BU-01), chưa gắn lớp |

**E. Cộng đồng lớp, phụ huynh, trang**

| Tệp | Kiểm hôm nay | Lớp | Mức/ghi chú |
|---|---|---|---|
| `community/threads/route.ts` GET/POST, `community/scope-options` | `classThreadAccess` (`Course.ownerId`) | M | *xem/dạy*: đồng giảng đọc và đăng trong cộng đồng lớp như thành viên; duyệt/xoá bài (`communityServer.ts:203`) vẫn chủ. **Tệp của stu-code → mục D** |
| `parent-consents/*`, `parent-portal/*`, `users/[id]/tuition` | `ownerId` | G | đồng ý phụ huynh, học phí (TRẺ EM + TIỀN) |
| Trang `lop-cua-toi/[courseId]/page.tsx` | `isOwner` ... `notFound()` (dòng 48-58) | M | thêm vai đồng giảng ⇒ `roleView = "co_teacher"` (mục 5); người lạ vẫn 404 |
| Trang `lop-cua-toi/[courseId]/ban-ghi/page.tsx` | chủ | M | *xem* (bản ghi buổi) |
| Trang `lop-cua-toi/(tutor)/buoi/[courseId]/[dateKey]/page.tsx` | `c.ownerId === me` (dòng 21-22) | M | *dạy*: buổi mình dạy; ẩn dòng "sẽ sinh phí" (`perSessionFee`) |
| Trang `(tutor)/page.tsx` (Hộp việc), `(tutor)/cai-dat/page.tsx` | `ownerId: me` | M (Hộp việc) / G (Cài đặt) | nhóm "Lớp tôi đồng giảng" |
| Trang `(tutor)/hoc-sinh/*` (7), `(tutor)/hoc-phi*`, `(tutor)/doanh-thu`, `(tutor)/goi`, `(tutor)/bao-cao-thang/*`, `(tutor)/so-diem`, `(tutor)/ke-hoach-buoi/*`, `(tutor)/lich/doi-buoi`, `(tutor)/yeu-cau`, `(tutor)/lop/tao` | `redirectIfNotTutor` + dữ liệu khoá `ownerId` | G/T | đồng giảng vào được trang (là gia sư) nhưng danh sách trống vì khoá `ownerId: me`; không nới |
| Trang `(tutor)/lop/page.tsx` | `redirectIfNotTutor` | M | thêm nhóm "Lớp tôi đồng giảng" |
| Hai tệp lớn `admin/khoa-hoc/[id]/page.tsx` (alias `quan-lop/[id]*`), `admin/thi-thu/**` (alias `de-thi/*`) | `ownerId` rải rác | — | **Quản trị**. Đồng giảng KHÔNG dùng hai trang này ở vòng 1 (mục D, D2) |

**Số liệu phân loại** (đếm theo DÒNG của các bảng A–E; một dòng có thể gộp 2–10 tệp cùng loại; ≈ 190 tệp có chữ `ownerId` nhưng chỉ phần liên quan lớp ở trên, còn lại là tiếng Anh/thư viện/quản trị khác):

| Lớp | Số dòng | Ghi chú |
|---|---|---|
| **G** giữ chỉ chủ | 31 (+1 dòng G/T) | đồng giảng tự động 403, không sửa dòng kiểm |
| **M** mở có chọn lọc | 43 (+1 dòng ghép Hộp việc/Cài đặt) | xem 15 · dạy 9 · soạn 12 · chấm 7 (một dòng có thể thuộc 2 mức) |
| **T** chạm TIỀN | 5 dòng ≈ 22 tệp (+ `users/[id]/tuition` trong dòng G/T) | đồng giảng 403 hết, phản hồi M cũng bỏ khoá tiền |
| **N/A** đường học sinh/công khai | 6 | kê để đủ danh sách |

### 3.2 Phạm vi tệp cho tut-code và tut-dev (không trùng nhau)

**tut-code** (máy chủ; trong PHAM-VI: `src/lib/tutorGate*`, `enrollServer.ts`, `api/tutor/**`, `api/courses/**`, `api/invites/**`, `api/sessions*`, `api/attendance*`):

| Tệp | Việc |
|---|---|
| `src/lib/courseAccess.ts` (MỚI, thuần) | `CourseRole`, `CourseAction`, `canDo`, `canViewCourse/canTeachCourse/canManageCourse/canSeeMoney`, `effectiveSessionTeacher`, `isCoTeacherActive`, `redactCourseForRole`, hằng thông điệp 403 (mục 4) |
| `src/lib/courseAccessServer.ts` (MỚI) | `loadCourseAccess(session, courseId)`; `requireCourseAccess(courseId, action, ctx?)` bọc 401/403/404 |
| `src/lib/courseTeacherServer.ts` (MỚI) | mời / chấp nhận / từ chối / gỡ / rời / đổi vai; đọc danh sách; gỡ gán khung/nhóm; thông báo |
| `src/lib/enrollServer.ts` | `enrollInTx` thêm kiểm vai (H1); `decideJoinRequest` outcome mới; `requireCourseTutor` giữ nguyên (G) |
| `src/lib/sessionBookServer.ts` | KHÔNG sửa (khớp mẫu KHÓA `sessionBook*`); `authorizeCourse` giữ nguyên = mặc định từ chối. Hàm `authorizeCourseFor(courseId, action, ctx)` đặt ở `courseAccessServer.ts` (D1) |
| `src/app/api/courses/[id]/**` | các dòng M ở 3.1-A: attendance-sessions, calendar GET, class-schedules, schedule-conflicts, sessions, sessions/[dateKey] GET/PATCH, students, reorder, sections, route GET; mới `courses/[id]/...` KHÔNG tạo thêm (đồng giảng dùng `tutor/lop/...`) |
| `src/app/api/attendance-sessions/[id]/route.ts` | GET/PUT theo 3.1-B |
| `src/app/api/tutor/lop/[courseId]/giao-vien/route.ts` (MỚI) | GET danh sách giáo viên của lớp; POST mời |
| `src/app/api/tutor/lop/[courseId]/giao-vien/[ctId]/route.ts` (MỚI) | PATCH đổi vai/môn; DELETE gỡ/huỷ lời mời |
| `src/app/api/tutor/lop/[courseId]/buoi/[dateKey]/de-nghi-chot/route.ts` (MỚI) | POST báo chủ chốt buổi |
| `src/app/api/tutor/dong-giang/route.ts` (MỚI) | GET: lời mời gửi tôi + lớp tôi đang đồng giảng |
| `src/app/api/tutor/dong-giang/[ctId]/chap-nhan/route.ts`, `tu-choi/route.ts`, `roi-lop/route.ts` (MỚI) | POST |
| `src/app/api/tutor/lop/[courseId]/giao-trinh/**` (6 tệp) | `rCT` → `acc` |
| `src/app/api/tutor/hop-viec/route.ts`, `schedule/route.ts`; `src/lib/tutorInboxServer.ts` | thêm nhóm đồng giảng (chỉ đọc) |
| `src/app/api/tutor/de-thi/[id]/giao/route.ts`, `src/lib/deThiAssignServer.ts`, `quizServer.ts` | cho giao đề của MÌNH vào lớp đồng giảng |
| `prisma/schema.prisma` | KHÔNG sửa trực tiếp — mục D |
| `tools/local-e2e/t-course-access-lib.ts`, `t-course-teachers.ts` | test (mục 8) |

**Tệp ngoài PHAM-VI tut-code nhưng cần để chạy** (mục D): `src/app/api/{sections,chapters,lessons,assignments,class-schedules,media}/**` (nội dung giảng dạy; PHAM-VI không nêu rõ), `src/lib/{mediaAccess,classThreadAccess,lessonGuard,lessonMediaServer}.ts`.

**tut-dev** (giao diện; PHAM-VI: `src/app/lop-cua-toi/**`, `src/components/tutor/**`):

| Tệp | Việc |
|---|---|
| `src/app/lop-cua-toi/[courseId]/page.tsx` | thêm vai `co_teacher`: gọi `loadCourseAccess`, truyền `roleView`/`access`/`redacted` xuống; người lạ 404 như cũ |
| `src/components/tutor/LopChiTiet.tsx` | tab mới "Giáo viên" (`?tab=giao-vien`); ẩn tab Mã mời / Học phí cho đồng giảng; huy hiệu vai ở đầu trang |
| `src/components/tutor/GiaoVienLop.tsx` (MỚI) | tab Giáo viên: danh sách, mời, đổi vai, gỡ |
| `src/components/tutor/MoiDongGiang.tsx` (MỚI) | hộp thoại mời theo email |
| `src/components/tutor/DongGiangHang.tsx` (MỚI) | một dòng lớp đồng giảng (dùng ở Hộp việc và danh sách lớp) |
| `src/app/lop-cua-toi/(tutor)/dong-giang/page.tsx` (MỚI) + `src/components/tutor/LoiMoiDongGiang.tsx` (MỚI) | trang lời mời: chấp nhận / từ chối |
| `src/app/lop-cua-toi/(tutor)/page.tsx`, `(tutor)/lop/page.tsx`, `src/components/tutor/HopViec.tsx`, `LopHoc.tsx` | nhóm "Lớp tôi đồng giảng" |
| `src/app/lop-cua-toi/(tutor)/buoi/[courseId]/[dateKey]/page.tsx`, `src/components/tutor/BuoiChiTiet.tsx`, `DiemDanh.tsx` | vai co_teacher: nút "Đề nghị chủ chốt buổi" thay "Đã dạy xong"; ẩn dòng phí, ẩn liên hệ phụ huynh |
| `src/components/tutor/giao-trinh/**` | subject_teacher: chỉ nhóm của mình có nút sửa; còn lại chỉ xem |
| `src/components/tutor/JoinRequests.tsx`, `ClassInvites.tsx`, `LopHocPhi.tsx`, `LopPhiKhac.tsx`, `LopGoiBuoi.tsx` | không đổi (không hiện với đồng giảng — ẩn ở `LopChiTiet`) |
| `tools/local-e2e/ui-course-teachers.ts` | test giao diện (mục 8) |

Ranh giới: tut-dev chỉ `import type` từ `courseAccess.ts` và gọi API; không viết `prisma` trong trang. Lớp nào cần dữ liệu đã lọc tiền/phụ huynh thì tut-code cung cấp `loadCoTeacherCourseView(courseId, access)` trong `courseAccessServer.ts` (tut-dev không tự lọc).

---

## 4. Thiết kế quyền

### 4.1 Nghiên cứu ngắn (xem ngày 07/11/2026)

| Nguồn | Điều rút ra |
|---|---|
| Google Classroom, *About Classroom* — https://support.google.com/edu/classroom/answer/6020279 | Đồng giảng tạo và quản lý bài, điểm, đăng thông báo, phản hồi học sinh; **không**: xoá lớp, gỡ giáo viên chính, tắt tiếng giáo viên khác. |
| Google Classroom, *Archive or delete a class* — https://support.google.com/edu/classroom/answer/6149813 | "Teachers and co-teachers can archive a class… only the primary teacher can delete a class"; phải lưu trữ trước khi xoá. Chuyển quyền chủ cho đồng giảng được. |
| Showbie, *Co-teaching a class* — https://support.showbie.com/en/articles/1420211-co-teaching-a-class | Đồng giảng có quyền ngang chủ; đồng giảng "xoá" lớp thì lớp chỉ bị lưu trữ cho mọi người. Bài học: không để người phụ tác động lên toàn lớp theo kiểu khó hoàn tác. |
| Canvas — các trường công bố: JHU https://canvas.jhu.edu/faculty-resources/canvas-course-role-permissions/details-on-canvas-course-role-permissions, UW-Eau Claire https://kb.uwec.edu/articles/1380, Boise State https://boisestate.atlassian.net/wiki/spaces/LTS/pages/1369571404/Canvas+Roles | Teacher rộng nhất; TA hẹp hơn: **không thêm/gỡ người dùng**, không quản trạng thái khoá học; quyền xem điểm tách riêng ("TA Grader" xem/chấm, "TA" thường không); Designer chỉ soạn nội dung, không chấm. Mẫu "một vai soạn-nội-dung" và "một vai chấm" tách nhau. |
| Azota, *Phân quyền* — https://docs.azota.vn/docs/huong-dan-su-dung/phan-quyen/ | Giáo viên được phân quyền theo từng nội dung (đề, lớp, khoá, ngân hàng câu hỏi) và theo lớp; có thể chia sẻ riêng quyền chấm một đề. Trang không nêu chi tiết vai nào không được làm gì. |
| Việt Nam: GVCN và giáo viên bộ môn | Điều lệ trường THCS/THPT (Thông tư 32/2020/TT-BGDĐT) có điều riêng về nhiệm vụ GVCN, tách khỏi nhiệm vụ chung của giáo viên (nguồn tìm được chỉ là bài tư vấn: https://thuvienphapluat.vn/hoi-dap-phap-luat/nhiem-vu-cua-giao-vien-chu-nhiem-truong-thcs-234713.html — máy chủ chặn 403 nên **chưa đọc nguyên văn**; không trích điều khoản cụ thể). Ý dùng được: GVCN giữ quan hệ với phụ huynh và đánh giá chung lớp; giáo viên bộ môn phụ trách môn của mình. |

Điều rút ra áp vào KiN: (1) cả Classroom lẫn Canvas giữ **owner-only** cho xoá lớp, gỡ người, và quản trị người dùng ⇒ giữ nguyên; (2) tách vai soạn / chấm thành mức riêng (Canvas) ⇒ co_teacher và subject_teacher; (3) KiN thêm hai chặn mà các nền tảng đó không cần: **tiền** (KiN sinh học phí từ chốt buổi) và **trẻ em** (liên hệ phụ huynh, điểm) ⇒ phần lớn cặp "đồng giảng × tiền/phụ huynh" đặt ✘.

### 4.2 Định nghĩa vai

| Vai | Là ai | Nằm ở đâu |
|---|---|---|
| **owner** (GVCN) | `Course.ownerId`, gia sư đã duyệt | cột có sẵn. **Không** thêm dòng `owner` vào bảng mới: tránh hai nguồn sự thật cho ~190 tệp đang đọc `ownerId`; chuyển chủ lớp để vòng 2 |
| **co_teacher** (đồng giảng — rộng) | gia sư đã duyệt, được chủ mời, đã chấp nhận | `CourseTeacher.role = "co_teacher"` |
| **subject_teacher** (giáo viên bộ môn — hẹp) | như trên | `CourseTeacher.role = "subject_teacher"` + nhóm giáo trình được gán |
| **admin quản lý trung tâm** | `admin_super` / `admin_content` | hôm nay `ownsResource` luôn true ⇒ giữ nguyên, ghi vai `admin` |
| **gia sư lạ** | gia sư khác, không trong lớp | 403 API / 404 trang |
| **học sinh** | Enrollment active | đường học sinh, không đổi |
| **khách** | chưa đăng nhập | 401 |

**Ranh giới co_teacher và subject_teacher** (một câu): co_teacher soạn mọi nội dung và dạy buổi mình được gán trong cả lớp; subject_teacher chỉ soạn **nhóm giáo trình được chủ gán cho mình** (và đề của mình) và chỉ dạy buổi được gán, không tự lập khung lịch. Cả hai đều không có tiền, không có liên hệ phụ huynh, không quản học sinh, không quản giáo viên.

"Môn" biểu diễn bằng **nhóm giáo trình** (`Chapter`, mục "nhóm có tên" của BU-02-PHẲNG) mà chủ gán qua cột `Chapter.teacherId`. `CourseTeacher.subjects` chỉ là nhãn hiển thị (ví dụ "Toán") để học sinh/chủ nhìn, KHÔNG dùng để cấp quyền (tên môn gõ tự do thì không an toàn để khoá quyền).

### 4.3 MA TRẬN QUYỀN — vai × hành động

✔ cho phép · ✘ chặn (403) · ◐ có điều kiện (ghi dưới bảng). "Gia sư lạ" và "học sinh" đều 403 với mọi hành động quản lý lớp; lớp không tồn tại luôn 404 trước.

| # | Hành động (`CourseAction`) | owner | co_teacher | subject_teacher | admin TT | gia sư lạ | học sinh | khách |
|---|---|---|---|---|---|---|---|---|
| 1 | `course.view` xem lớp (tên, lịch, giáo trình, bản ghi) | ✔ | ✔ | ✔ | ✔ | ✘ | (đường học sinh) | ✘ |
| 2 | `roster.view` danh sách học viên (tên, trạng thái, tiến độ) | ✔ | ✔ | ◐a | ✔ | ✘ | ✘ | ✘ |
| 3 | `roster.contact` email/SĐT học viên, tên/SĐT phụ huynh, hồ sơ em, ngày sinh | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 4 | `attendance.mark.own` điểm danh buổi MÌNH dạy, chưa chốt | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ |
| 5 | `attendance.mark.other` điểm danh buổi người khác dạy | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 6 | `session.note.own` ghi chép buổi mình dạy (đã dạy/BTVN/nhận xét chung) | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ |
| 7 | `session.add.own` tạo buổi lẻ/bù của mình | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 8 | `session.close` chốt buổi (sinh phí) / `session.reopen` mở lại | ✔ | ✘ ◐b | ✘ ◐b | ✔ | ✘ | ✘ | ✘ |
| 9 | `session.request_close` báo chủ chốt buổi mình dạy | — | ✔ | ✔ | — | ✘ | ✘ | ✘ |
| 10 | `session.reassign` đổi người dạy của buổi/khung | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 11 | `content.edit.any` soạn bài giảng/nhóm/phần — nội dung bất kỳ | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 12 | `content.edit.own` soạn bài giảng trong nhóm được gán | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ |
| 13 | `content.delete_section` xoá cả phần | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 14 | `quiz.assign` giao đề/quiz CỦA MÌNH vào lớp | ✔ | ✔ | ◐c | ✔ | ✘ | ✘ | ✘ |
| 15 | `grade` chấm bài tập/quiz của lớp | ✔ | ✔ | ◐c | ✔ | ✘ | ✘ | ✘ |
| 16 | `score.write` ghi điểm theo buổi (`.../diem`) | ✔ | ✘ ◐d | ✘ ◐d | ✔ | ✘ | ✘ | ✘ |
| 17 | `course.edit` sửa tên/thông tin/giá/trạng thái lớp | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 18 | `course.delete` xoá/đóng/nhân bản lớp | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 19 | `student.invite` tạo/thu hồi mã mời, thêm học sinh | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 20 | `student.decide` duyệt/từ chối đơn xin vào lớp | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 21 | `student.remove` xoá/tạm dừng học sinh khỏi lớp | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 22 | `invite_code.rotate` đổi mã mời | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 23 | `teacher.invite` / `teacher.remove` / `teacher.role` mời/gỡ/đổi vai đồng giảng | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 24 | `teacher.leave` tự rời lớp đồng giảng | — | ✔ | ✔ | — | ✘ | ✘ | ✘ |
| 25 | `schedule.add.own` thêm khung lịch dạy của mình | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 26 | `schedule.edit.own` sửa/xoá khung của mình (`teacherId = me`) | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 27 | `schedule.edit.other` sửa/xoá khung của người khác hoặc của chủ | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 28 | `money.view` học phí, phiếu thu, doanh thu, đơn giá, phí khác, gói buổi | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| 29 | `attendance.export` xuất bảng điểm danh | ✔ | ✘ ◐e | ✘ | ✔ | ✘ | ✘ | ✘ |
| 30 | `community.post` đọc/đăng trong cộng đồng lớp | ✔ | ✔ | ✔ | ✔ | ✘ | ✔ (đã có) | ✘ |
| 31 | `community.moderate` duyệt/xoá bài cộng đồng lớp | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |

Điều kiện:
- a. subject_teacher thấy danh sách tên nếu có ít nhất một buổi hoặc nhóm gán cho mình; không có gì được gán thì chỉ thấy số lượng.
- b. Mặc định ✘ (chốt buổi kéo theo sinh phí — mục 4.6). Phương án B xin chủ (Q2): được chốt khi `feeMode ∈ {monthly_sessions, per_course}` (chốt chỉ ghi trạng thái). Mở lại luôn chủ.
- c. subject_teacher: chỉ đề/bài thuộc nhóm của mình, và đề do chính mình soạn (`exam.ownerId = me`).
- d. Điểm theo buổi gắn đồng ý của phụ huynh với CHỦ lớp (`attendance-sessions/[id]/diem/route.ts:35,64`) ⇒ TRẺ EM, chờ chủ (Q4). Mặc định ✘.
- e. Vòng 1 ✘; nếu chủ muốn: chỉ xuất cột các buổi mình dạy (Q9).

### 4.4 Người dạy của một buổi

Thêm hai cột nullable: `ClassSchedule.teacherId` (khung do ai dạy; null = chủ lớp) và `AttendanceSession.taughtBy` (người dạy THỰC của buổi đã có bản ghi; null = suy ra). Thuần:

```ts
// effectiveSessionTeacher: taughtBy của buổi > teacherId của khung (khung trùng ngày/giờ) > chủ lớp.
export function effectiveSessionTeacher(i: { taughtBy: string | null; scheduleTeacherId: string | null; ownerId: string | null }): string | null;
```

Quy tắc: co_teacher/subject_teacher chỉ thao tác buổi có `effectiveSessionTeacher === me`. Buổi do đồng giảng tạo/điểm danh được ghi `taughtBy = me` **và `createdBy = course.ownerId`** (không phải `me`): vì `AttendanceSession.creator` là `onDelete: Cascade`, để `createdBy = đồng giảng` thì xoá tài khoản đồng giảng kéo xoá buổi (kèm điểm danh). `AttendanceRecord.updatedBy` là chuỗi không FK nên ghi `me` được. `closedBy` đã là chuỗi.

Gỡ đồng giảng **không xoá** buổi/điểm danh cũ: không có FK cascade từ `CourseTeacher` tới buổi; `taughtBy` giữ nguyên id người đã dạy (chuỗi, không FK). Khi gỡ: khung `teacherId = người bị gỡ` đặt lại `null` (về chủ) và chủ nhận danh sách đã đổi; nhóm `Chapter.teacherId` đặt lại `null`; buổi tương lai chưa có bản ghi tự về chủ (vì khung đã đổi).

### 4.5 Dữ liệu trẻ em — lựa chọn an toàn (mặc định, không cần hỏi để chạy)

Hôm nay chủ lớp thấy: email, SĐT, trường của học viên (`courses/[id]/students`), tên và SĐT phụ huynh trong danh sách điểm danh (`attendance-sessions/[id]/route.ts:100-101`), hồ sơ em, điểm. **Đồng giảng chỉ thấy**: tên hiển thị, trạng thái ghi danh, tình trạng điểm danh của buổi mình dạy, tiến độ bài; mọi liên hệ (học viên + phụ huynh), hồ sơ em, điểm, đồng ý phụ huynh, báo cáo tháng → ✘ (G/hàng 3 ma trận). Lý do: chủ lớp là người phụ huynh đã đồng ý chia sẻ (`scoreConsentFor`, `noteShareAllowed` buộc `ownerId`); đồng giảng là một bên thứ ba mới chưa có đồng ý nào. Nhận xét điểm danh (`note`, ≤500 ký tự) đồng giảng được ghi nhưng `parentVisible` thì không. **Ghi CHỜ CHỦ** ở Q3–Q4: có mở liên hệ phụ huynh/điểm cho đồng giảng hay không; mặc định đóng.

### 4.6 Tiền: hành vi hiện tại và phương án

Hiện tại (CHỈ ĐỌC, không sửa): (i) `POST .../sessions/[dateKey]/close` ghi `state="closed"` rồi gọi `syncChargesOnClose` + `syncPackageUsesForSession` trong cùng giao dịch (`close/route.ts:44-45`); phí ghi `tutorId = course.ownerId ?? by` (`feeChargeServer.ts:81`) — tức phí luôn mang tên chủ lớp dù ai bấm; (ii) `PUT /api/attendance-sessions/[id]` trên buổi đã chốt đồng bộ lại dòng phí chưa vào phiếu (`route.ts:207-212`), buổi chưa chốt thì không sinh phí; lớp `monthly_sessions`/`per_course` không ghi gì bảng phí. (iii) mở lại buổi gỡ dòng phí chưa vào phiếu.

Phương án mặc định (A): đồng giảng **chỉ điểm danh khi buổi chưa chốt**; không chốt, không mở lại; thêm `POST .../de-nghi-chot` chỉ gửi thông báo cho chủ (không ghi trạng thái buổi, không chạm bảng phí). PUT điểm danh của đồng giảng trên buổi đã chốt ⇒ 409 `SESSION_CLOSED_OWNER_ONLY`. Mọi phản hồi cho đồng giảng bỏ `charges`, `packages`, `warning` (phần nhắc phiếu) và `reopenWarning`. Phương án B (CHỜ CHỦ, Q2): cho chốt khi lớp không sinh phí theo buổi. Không phương án nào sửa `feeCharge*`, `sessionBook*`, `invoiceServer*` (KHÓA).

---

## 5. Schema — chỉ thêm

Không đổi `Course.ownerId`, không thêm giá trị vào `Enrollment.status`, không `@unique` mới trên bảng cũ. Một bảng mới + ba cột nullable. Tệp chung ⇒ mục D (D3).

```prisma
// TUT-dong-giang — giáo viên cùng dạy một lớp. Chủ lớp vẫn là Course.ownerId (KHÔNG có dòng "owner" ở đây).
model CourseTeacher {
  id          String    @id @default(cuid())
  courseId    String
  userId      String
  role        String    // "co_teacher" | "subject_teacher" (kiểm ở courseAccess.ts, không CHECK ở DB)
  subjects    String[]  @default([]) // nhãn môn để HIỂN THỊ (≤5 × ≤40 ký tự); KHÔNG dùng cấp quyền
  status      String    @default("invited") // invited | active | declined | removed
  invitedBy   String    // userId chủ lớp (chuỗi, không FK: gỡ chủ không làm mất lịch sử)
  createdAt   DateTime  @default(now())
  respondedAt DateTime? // chấp nhận hoặc từ chối
  removedAt   DateTime?
  removedBy   String?   // chủ gỡ, hoặc chính người đó khi tự rời
  course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  user        User      @relation("CourseTeacherUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([courseId, userId])
  @@index([userId, status])
  @@index([courseId, status])
  @@map("course_teachers")
}
// Thêm ở model Course: courseTeachers CourseTeacher[]   |   thêm ở model User: courseTeachings CourseTeacher[] @relation("CourseTeacherUser")

// ClassSchedule: teacherId String?   // người dạy khung này; null = chủ lớp. Chuỗi không FK.
// AttendanceSession: taughtBy String? // người dạy THỰC của buổi; null = suy từ khung rồi chủ lớp. Chuỗi không FK.
// Chapter: teacherId String?          // nhóm giáo trình giao cho giáo viên bộ môn này; null = chủ/co_teacher soạn.
```

Quyết định đáng ghi:
- **Không có dòng `owner`**: bảng `CourseTeacher` chỉ chứa người PHỤ. Lý do ở 4.2.
- **`@@unique([courseId, userId])`** (mới, trên bảng mới): mời lại người đã `removed`/`declined` ⇒ cập nhật cùng dòng về `invited`, giữ lịch sử.
- **`status` thêm `declined`** so với gợi ý ban đầu (3 giá trị) để chủ phân biệt "từ chối" với "đã gỡ" trong danh sách; vẫn là chuỗi, không phải `Enrollment.status`.
- **Không FK cho `invitedBy`, `removedBy`, `teacherId`, `taughtBy`**: chuỗi định danh để xoá/ẩn danh hoá tài khoản (PR #142) không kéo lịch sử.
- Cascade `course` và `user` ở `CourseTeacher` là an toàn: bảng chỉ chứa quan hệ, không chứa dữ liệu dạy.
- Chỉ mục: tra "lớp tôi đồng giảng" theo `(userId,status)`; tra giáo viên của lớp theo `(courseId,status)`. Không chỉ mục cho 3 cột nullable (đọc kèm khoá `courseId` đã có).

### 5.1 Cách chủ mời: chọn FORM MỜI THEO EMAIL, không dùng `ClassInvite kind="teacher"`

| | Form email → `CourseTeacher(invited)` | Tái dùng `ClassInvite` |
|---|---|---|
| Đúng người | gửi đích danh một gia sư đã duyệt | mã chia sẻ được, ai có mã thử redeem |
| Chấp nhận | trạng thái `invited`→`active` có đủ ngữ nghĩa | redeem là "dùng ngay", phải bẻ thêm bước chấp nhận |
| Ảnh hưởng t-* | không đụng `redeem` | `redeem` chặn `role !== "student"` (`redeem/route.ts:28-30`) và `canSelfEnroll`; sửa là đụng `t-invites.ts`, `t-tut-002.ts`, `t-join-request.ts`, `ui-invite-input.ts`; `usedCount`/`maxUses` vô nghĩa cho giáo viên |
| Rủi ro | liệt kê email | lộ mã ⇒ người lạ thành đồng giảng nếu duyệt lỏng |

⇒ Chọn cột trái. Chống liệt kê email: khớp **chính xác** (trim + hạ chữ), một câu trả lời chung "Nếu email đúng của một gia sư đã duyệt, lời mời đã được gửi" cho mọi trường hợp (không có, không phải gia sư, chờ duyệt, bị khoá, là học sinh của lớp, đã ở trong lớp), giới hạn 10 lần/10 phút/người mời (`limitOrBlock` như `tim-hoc-sinh` của ADM-xoa-tk 11.1), ghi `AuditLog` không email. Chủ chỉ thấy kết quả thật khi người kia chấp nhận (tên hiện trong tab Giáo viên sau khi `active`; trước đó chỉ hiện email đã nhập).

---

## 6. Hợp đồng API (POST + 303 cho form; JSON chỉ khi client gọi `fetch`)

Quy ước KiN: route cho `<form>` HTML trả `303` về trang; route do `fetch` gọi trả JSON `Cache-Control: no-store`. Trang tab Giáo viên và trang lời mời dùng `fetch` (JSON); không có form HTML thuần ở đây ⇒ không route nào trả 303. Mọi route kiểm theo **thứ tự cố định**:

1. 401 chưa đăng nhập → 2. 403 tài khoản bị khoá (`requireSession`) → 3. 403 không phải gia sư đã duyệt (gồm gia sư CHỜ DUYỆT, học sinh, quản trị ngoài phạm vi từng route) → 4. **404 lớp không tồn tại** → 5. **403 người lạ** (không phải owner/đồng giảng active/admin) → 6. 403 đúng vai nhưng thiếu quyền hành động (mã `code: "ROLE_FORBIDDEN"`) → 7. tham số (400) → 8. trạng thái (409).

Lý do thứ tự 4 trước 5: lớp không tồn tại thì mọi người nhận 404 (không có gì để lộ); lớp tồn tại mà người lạ gọi API nhận 403 (API không cần giấu — `authorizeCourse` làm đúng vậy hôm nay, `sessionBookServer.ts:31-32`). **Trang** (không phải API) giữ hành vi hiện có: người lạ cũng 404 (`[courseId]/page.tsx:53,58`) để không lộ lớp tồn tại.

### 6.1 `src/lib/courseAccess.ts` (thuần: không React, không DB, không cookie; test `t-course-access-lib`)

```ts
export type CourseRole = "owner" | "co_teacher" | "subject_teacher" | "admin" | "none";
export type CourseAction =
  | "course.view" | "roster.view" | "roster.contact" | "attendance.mark.own" | "attendance.mark.other"
  | "session.note.own" | "session.add.own" | "session.close" | "session.request_close" | "session.reassign"
  | "content.edit.any" | "content.edit.own" | "content.delete_section" | "quiz.assign" | "grade" | "score.write"
  | "course.edit" | "course.delete" | "student.invite" | "student.decide" | "student.remove" | "invite_code.rotate"
  | "teacher.invite" | "teacher.remove" | "teacher.role" | "teacher.leave"
  | "schedule.add.own" | "schedule.edit.own" | "schedule.edit.other" | "money.view" | "attendance.export"
  | "community.post" | "community.moderate";

export const ROLE_LABEL: Record<CourseRole, string>;                 // Chủ nhiệm · Đồng giảng · Giáo viên bộ môn · Quản trị trung tâm
export function canDo(role: CourseRole, action: CourseAction): boolean;          // ma trận 4.3 (mặc định false)
export const canViewCourse   = (r: CourseRole) => canDo(r, "course.view");
export const canTeachCourse  = (r: CourseRole) => canDo(r, "attendance.mark.own");
export const canManageCourse = (r: CourseRole) => canDo(r, "course.edit");
export const canSeeMoney     = (r: CourseRole) => canDo(r, "money.view");
export function effectiveSessionTeacher(i: { taughtBy: string | null; scheduleTeacherId: string | null; ownerId: string | null }): string | null;
export function canMarkSession(r: CourseRole, me: string, teacher: string | null, closed: boolean): { ok: true } | { ok: false; code: "ROLE_FORBIDDEN" | "NOT_YOUR_SESSION" | "SESSION_CLOSED_OWNER_ONLY" };
export function canEditChapter(r: CourseRole, me: string, chapterTeacherId: string | null): boolean;
export function isCoTeacherUsable(row: { status: string }, user: { role: string; adminRole: string | null; tutorVerified: boolean; banned: boolean; deletedAt: Date | null }): boolean; // active + gia sư duyệt + không khoá + không xoá
export function redactCourseForRole<T extends Record<string, unknown>>(role: CourseRole, course: T): Partial<T>;   // bỏ price, originalPrice, feeMode, tag... khi !canSeeMoney
export const MAX_TEACHERS_PER_COURSE = 5;           // active + invited
export const ROLE_FORBIDDEN_MESSAGE = "Bạn không có quyền với việc này trong lớp";
```

Mặc định `canDo` là **false** với cặp lạ (vai/hành động không có trong bảng) — "mặc định từ chối" thành mã.

### 6.2 `src/lib/courseAccessServer.ts`

```ts
export type CourseAccess =
  | { ok: true; role: Exclude<CourseRole, "none">; session: SessionPayload; course: { id: string; name: string; ownerId: string | null; feeMode: string; classStatus: string }; ctId: string | null }
  | { ok: false; res: NextResponse };
/** Đọc phiên (getSessionChecked: khoá → 403), đọc Course (404 nếu không có), rồi suy vai:
 *  quản trị cấp 1/nội dung → "admin"; session.userId === ownerId → "owner"; còn lại tra CourseTeacher(courseId,userId,status="active")
 *  VÀ đọc LẠI User từ DB (role, adminRole, tutorVerified, banned, deletedAt) rồi isCoTeacherUsable — không tin JWT cho đường đọc.
 *  Không có → 403 "Bạn không có quyền với lớp này". */
export async function loadCourseAccess(session: SessionPayload | null, courseId: string): Promise<CourseAccess>;
export async function requireCourseAccess(courseId: string, action: CourseAction): Promise<CourseAccess>;   // thêm bước canDo → 403 ROLE_FORBIDDEN
```

Route dòng G **không đổi gì** (vẫn `own`/`aC`/`rCT`): đồng giảng là gia sư nên qua `requirePermission(MANAGE_COURSES)` rồi ngã ở `ownsResource` ⇒ 403 — đây là "mặc định từ chối", test khoá bằng ca phá ở mục 8.

### 6.3 Mời / chấp nhận / gỡ

| Route | Gọi bởi | Hợp đồng |
|---|---|---|
| `POST /api/tutor/lop/[courseId]/giao-vien` body `{ email, role: "co_teacher"\|"subject_teacher", subjects?: string[] }` | owner (admin) | 200 `{ ok: true }` luôn một chữ chung (5.1) khi hợp lệ về hình thức; 400 email/vai/môn sai; 403 không phải owner (`teacher.invite`); 409 `TEACHER_LIMIT` (>5); 409 `ALREADY_IN_COURSE` chỉ khi **chính người gọi** là owner mời chính mình; 429 quá hạn mức. Tạo/làm mới `CourseTeacher(invited)`; thông báo `co_teacher_invited` |
| `GET /api/tutor/lop/[courseId]/giao-vien` | owner, co_teacher, subject_teacher, admin | `{ self: { role }, teachers: [{ id, role, subjects, status, since, name? , email? }], limit }` — `name` chỉ khi `active`; `email` chỉ owner/admin; đồng giảng thấy danh sách tên + vai + môn, không thấy email, không thấy lời mời chờ |
| `PATCH /api/tutor/lop/[courseId]/giao-vien/[ctId]` body `{ role?, subjects? }` | owner | đổi vai/môn khi `active`; 404 `ctId` không thuộc lớp; thông báo `co_teacher_role_changed`. Hạ co_teacher → subject_teacher không xoá nhóm đã gán |
| `DELETE /api/tutor/lop/[courseId]/giao-vien/[ctId]` | owner | `invited`→`removed` (huỷ lời mời) hoặc `active`→`removed`; đặt lại `teacherId`/`Chapter.teacherId` về null; trả `{ ok: true, reassignedSchedules: n, reassignedChapters: m }`; **không** đụng buổi/điểm danh/bài đã có; thông báo `co_teacher_removed` |
| `GET /api/tutor/dong-giang` | gia sư | `{ invitations: [{ id, courseName, role, subjects, sentOn }], courses: [{ courseId, courseName, role, subjects, nextSession?, unmarkedCount }] }` — không tên chủ, không tiền |
| `POST /api/tutor/dong-giang/[ctId]/chap-nhan` | người được mời | `invited`→`active` có điều kiện (`updateMany where status:"invited"`); 409 `ALREADY_RESPONDED`; 409 nếu lớp đã đóng hoặc người này đang là học viên lớp (`is_student_of_course`); thông báo `co_teacher_accepted` (cho chủ, không tên) |
| `POST /api/tutor/dong-giang/[ctId]/tu-choi` | người được mời | `invited`→`declined`; thông báo `co_teacher_declined` |
| `POST /api/tutor/dong-giang/[ctId]/roi-lop` | đồng giảng active | `active`→`removed`, `removedBy = me`; trả như DELETE; thông báo `co_teacher_left` |
| `POST /api/tutor/lop/[courseId]/buoi/[dateKey]/de-nghi-chot` | co_teacher, subject_teacher | buổi phải có `effectiveSessionTeacher === me` và đã có điểm danh; ghi `AuditLog`; gửi thông báo `session_close_request` cho chủ (dedupe: còn thông báo chưa đọc cùng link thì không tạo thêm); **không ghi gì vào `AttendanceSession` hay bảng phí** |

Mọi `ctId` đều kiểm thuộc `courseId`/thuộc người gọi trước khi dùng (IDOR). Người gọi lời mời/chấp nhận phải là gia sư đã duyệt không bị khoá, không `deletedAt`. Gia sư CHỜ DUYỆT: 403 (rơi ở bước 3).

### 6.4 Hành vi route M đã có (đổi nhỏ)

- Mọi route M đọc `loadCourseAccess`, rồi `canDo`. Dòng `own`/`aC` cũ của route đó **được thay**, không để cạnh nhau.
- Trả cho đồng giảng: `courses/[id]` GET bỏ `price/originalPrice/feeMode/tag`; `students` bỏ `email/phone/school`; `attendance-sessions/[id]` GET bỏ `parentName/parentPhone/zaloOpenedAt` và `course.zaloGroupUrl`; `sessions/[dateKey]` bỏ `reopenWarning`; PUT bỏ `charges/packages/warning`.
- Nhận từ đồng giảng: `class-schedules` POST/PUT bỏ qua `teacherId` do client gửi — luôn `me` (co_teacher) hoặc 403 (subject_teacher); `chapters` POST của subject_teacher luôn đặt `teacherId = me`; `PATCH sessions/[dateKey]` từ chối trường `taughtBy`.
- Ghi: `createdBy = course.ownerId` (4.4).

---

## 7. Luồng màn (vỏ gia sư; 1600 và 390; ba trạng thái)

Chung: token `--kin-*`, nút ≥ 44px ở 390, mọi liên kết qua `contentHref`/`toTutorPath` (không viết tay `/admin/...`), xác nhận qua `KinConfirm`, 1600: nội dung ≤ 960px canh giữa theo khung gia sư hiện có (Bản final 578:2, thanh bên 578:11). Ba trạng thái mọi khối: **đang tải** (khung xương, không nhảy bố cục), **lỗi + nút "Thử lại"** (chữ tiếng Việt, không mã), **rỗng** (một câu + một nút hành động).

### 7.1 Chủ lớp — tab "Giáo viên" (`/lop-cua-toi/<courseId>?tab=giao-vien`)
- Tab thêm vào dải tab hiện có của `LopChiTiet` (sau "Học sinh"). Chỉ owner (và admin) thấy nút **Mời giáo viên**, **Đổi vai**, **Gỡ**; đồng giảng thấy danh sách chỉ đọc.
- 1600: bảng 4 cột (Tên · Vai · Môn · Trạng thái) + nút ở cột cuối. 390: thẻ xếp dọc, mỗi thẻ có huy hiệu vai và hai nút ≥44px.
- Hộp thoại "Mời giáo viên": ô email, chọn vai (hai nút radio có mô tả một dòng: *Đồng giảng — soạn mọi bài, dạy buổi được giao* / *Giáo viên bộ môn — chỉ nhóm bài được giao*), ô môn (nhãn). Gửi xong hiện đúng câu chung của 5.1, không báo email có tồn tại hay không.
- Trạng thái: tải (3 thẻ xương) · lỗi (Thử lại) · rỗng: "Lớp này chỉ có bạn dạy. Mời giáo viên nếu có người cùng dạy." + nút **Mời giáo viên**.
- Gỡ: `KinConfirm` nói rõ "Buổi và điểm danh đã có được giữ nguyên. N khung lịch và M nhóm bài được giao sẽ về bạn." Số lấy từ phản hồi DELETE xem trước (route cho `?preview=1`) — tut-code thêm.
- Gán người dạy cho một khung lịch/buổi, và gán nhóm giáo trình cho giáo viên: ô chọn nhỏ "Người dạy" trong form khung lịch (tab Lịch của lớp) và menu "Giao cho…" ở đầu mỗi nhóm trong Giáo trình; chỉ owner thấy.

### 7.2 Đồng giảng — trong lớp
- Mở lớp qua Hộp việc/Lớp của tôi. Đầu trang lớp: huy hiệu vai ("Đồng giảng" / "Giáo viên bộ môn") và dòng "Lớp bạn đồng giảng". **Không** hiện tên chủ lớp.
- Tab hiện: Điểm danh (chỉ buổi mình dạy), Học sinh (chỉ tên/trạng thái), Giáo viên (chỉ đọc), Cộng đồng, Giáo trình. **Ẩn**: Mã mời, Học phí, Phí khác, Gói buổi, Duyệt vào lớp, nút Sửa/Xoá lớp.
- Trang buổi: nút **Lưu điểm danh**; nút "Đã dạy xong" được thay bằng **Đề nghị chủ chốt buổi** (sau khi bấm: "Đã báo chủ lớp" + vô hiệu 1 ngày); buổi đã chốt: banner "Buổi đã chốt, nhờ chủ lớp mở lại nếu cần sửa" + form điểm danh chỉ đọc. Không có dòng "sẽ sinh học phí".
- subject_teacher: Giáo trình chỉ nhóm của mình có nút sửa (các nhóm khác khoá, chú thích "Nhóm do giáo viên khác phụ trách").

### 7.3 Hộp việc và Lớp của tôi — nhóm "Lớp tôi đồng giảng"
- Dưới nhóm lớp riêng, một nhóm riêng có tiêu đề "Lớp tôi đồng giảng" với số lớp; mỗi dòng: tên lớp, huy hiệu vai, "N buổi chưa điểm danh". Rỗng: nhóm KHÔNG hiện (không chiếm chỗ).
- Lời mời chờ: một thẻ trên cùng Hộp việc "Bạn có N lời mời đồng giảng" → `/lop-cua-toi/dong-giang`.

### 7.4 Trang chấp nhận lời mời (`/lop-cua-toi/dong-giang`)
Danh sách lời mời: tên lớp, vai, môn, ngày gửi; hai nút **Nhận lời** / **Từ chối** (≥44px, 390: xếp dọc). Giải thích một dòng quyền của vai (lấy từ `ROLE_LABEL` + 3 gạch đầu dòng: *được*, *không được xem tiền và liên hệ phụ huynh*, *không được xoá lớp*). Lỗi 409 hiện đúng chữ ("Lời mời đã được xử lý"). Rỗng: "Bạn chưa có lời mời nào."

---

## 8. Máy trạng thái

**8.1 Lời mời / thành viên (`CourseTeacher.status`)**

| Từ | Sự kiện | Đến | Ai | Ghi chú |
|---|---|---|---|---|
| (không có) | mời | `invited` | owner | tạo dòng |
| `invited` | chấp nhận | `active` | người được mời | `respondedAt` |
| `invited` | từ chối | `declined` | người được mời | `respondedAt` |
| `invited` | huỷ | `removed` | owner | `removedBy` |
| `active` | gỡ | `removed` | owner | đặt lại khung/nhóm về null |
| `active` | tự rời | `removed` | đồng giảng | `removedBy = chính mình` |
| `active` | đổi vai | `active` | owner | role/subjects |
| `declined`/`removed` | mời lại | `invited` | owner | cùng dòng, xoá `respondedAt/removedAt` |

Chuyển mọi trạng thái bằng `updateMany` có điều kiện trạng thái (hai tab bấm cùng lúc chỉ một thắng). Quyền hiệu lực chỉ khi `status = "active"` **và** `isCoTeacherUsable` (người còn là gia sư duyệt, không khoá, không xoá). Gia sư bị khoá/xoá/hạ vai ⇒ mất quyền ngay ở lần gọi kế tiếp (đọc User từ DB mỗi lần), dòng `CourseTeacher` giữ nguyên.

**8.2 Buổi (người dạy / chốt)**

`(chưa có bản ghi)` → điểm danh bởi người dạy hiệu lực ⇒ `open` (hoặc state null) → *chủ* chốt ⇒ `closed` → *chủ* mở lại ⇒ `open`. Đồng giảng: chỉ cạnh đầu (điểm danh khi chưa chốt) và `de-nghi-chot` (không đổi trạng thái). Đổi `taughtBy`: chỉ owner/admin, kể cả khi buổi đã chốt (chỉ ghi nhãn người dạy, không đụng phí).

**8.3 Duyệt/mời/xoá học sinh**: không đổi (chỉ owner). Học sinh mới vào lớp không tự thấy đồng giảng nào trên màn học sinh (vòng 1).

---

## 9. Thông báo

Loại mới (chuỗi tự do của `Notification.type`; **`notify.ts` KHÔNG cần sửa** vì type không bị liệt kê ở đó). Không tên người, không số tiền, không email; chỉ có tên lớp (đã là thông lệ: "Bạn đã được thêm vào lớp «…»").

| `type` | Tới | Tiêu đề / nội dung | Liên kết |
|---|---|---|---|
| `co_teacher_invited` | người được mời | "Có lời mời đồng giảng" · "Bạn được mời cùng dạy lớp «X»." | `/lop-cua-toi/dong-giang` |
| `co_teacher_accepted` | owner | "Đã có giáo viên nhận lời" · "Một giáo viên đã nhận lời đồng giảng lớp «X»." | `/lop-cua-toi/<id>?tab=giao-vien` |
| `co_teacher_declined` | owner | "Một lời mời đồng giảng bị từ chối" · lớp «X» | như trên |
| `co_teacher_removed` | người bị gỡ | "Bạn không còn đồng giảng lớp «X»" | `/lop-cua-toi/dong-giang` |
| `co_teacher_left` | owner | "Một giáo viên đã rời lớp «X»" | tab Giáo viên |
| `co_teacher_role_changed` | người đó | "Vai của bạn trong lớp «X» đã đổi" | trang lớp |
| `session_close_request` | owner | "Buổi ngày dd/mm của lớp «X» chờ bạn chốt" | `/lop-cua-toi/buoi/<id>/<dateKey>` |

**Giờ yên lặng 22–07 và đẩy ra máy**: vòng 1 chỉ là thông báo **trong ứng dụng** (không đẩy). Hôm nay `notify()` chỉ đẩy các loại có trong `PUSH_TYPES` (`pushRules.ts:13`); loại mới không có trong đó ⇒ không đẩy ⇒ không cần xử lý giờ yên lặng. Nếu chủ muốn đẩy `co_teacher_invited`/`session_close_request`: thêm vào `PUSH_TYPES` + `PUSH_DEFS` (tiêu đề cố định không tên, `defaultOn: false`) — `pushRules.ts` thuộc tệp đẩy chung ⇒ mục D, D5, mặc định KHÔNG làm. Thứ tự đúng nếu làm: `inQuietHours` đã áp ở `pushRules.ts:107`.

---

## 10. Test phải có (ca phá cố ý; bám `tools/local-e2e/h.ts`: `mkTutor`, `mkCourse`, `mkUser`, `api`, `wipe`, `check`)

Quy ước đầu tệp (như `t-enroll-eligibility-lib.ts`): ghi "bẻ X thì ca Y đỏ".

### 10.1 `tools/local-e2e/t-course-access-lib.ts` (thuần, không DB)
- **Ma trận đủ**: lặp mọi cặp (7 vai × 31 hành động) so với bảng 4.3 dựng thành hằng độc lập trong test; thiếu một ô là đỏ. Vai `none` ✘ mọi hành động.
- Mặc định từ chối: hành động lạ ⇒ false.
- `effectiveSessionTeacher`: `taughtBy` thắng khung; khung thắng chủ; cả ba null ⇒ `ownerId`; chủ null ⇒ null.
- `canMarkSession`: co_teacher buổi người khác ⇒ `NOT_YOUR_SESSION`; buổi đã chốt ⇒ `SESSION_CLOSED_OWNER_ONLY`; owner buổi đã chốt ⇒ ok.
- `canEditChapter`: subject_teacher chỉ `teacherId === me`; co_teacher mọi nhóm; `teacherId` null ⇒ subject ✘.
- `isCoTeacherUsable`: mỗi cờ (status≠active, tutorVerified=false, banned, deletedAt, role≠admin) tách riêng làm false.
- `redactCourseForRole`: đồng giảng mất `price/originalPrice/feeMode/tag`; owner nguyên vẹn.
- **Ca phá**: (a) đổi `money.view` của co_teacher sang ✔ ⇒ ô "co_teacher×money.view" đỏ; (b) thêm `roster.contact` cho subject_teacher ⇒ đỏ; (c) bỏ nhánh `status` trong `isCoTeacherUsable` ⇒ ca "invited" đỏ; (d) `canDo` trả true cho hành động lạ ⇒ ca mặc định từ chối đỏ.

### 10.2 `tools/local-e2e/t-course-teachers.ts` (API)
Dữ liệu: `wipe()`; `O = mkTutor("Chủ")`, `C = mkTutor("Đồng giảng")`, `S = mkTutor("Bộ môn")`, `X = mkTutor("Lạ")`, `P` = chờ duyệt (`tutorAppliedAt`), `B` = gia sư bị khoá (`banned`), `H` = học sinh, `ADM = mkSuper()`; lớp `K1` của `O` (kèm học sinh có email/SĐT/phụ huynh), lớp `K2` của `X`. Cấu hình phí `per_session` cho `K1` để thấy tiền.

**IDOR (lớp người khác 403, không có 404)** — mỗi route ở **3.1 dòng G và T** gọi bằng `C` (đồng giảng của K1), `X` (lạ), `P`, `B`, `H`, khách:
- khách 401; `B` 403 (chữ khoá); `P` 403; `H` 403; `X` 403 trên `K1`; lớp không tồn tại ⇒ **404** cho cả `C` và `X` (đặt 404 trước 403); `C` gọi route G của `K1` ⇒ 403 (mỗi route ở bảng: courses PUT/DELETE, invites, duplicate, yeu-cau×4, hoc-sinh POST, bao-cao-link, zalo-group, so-diem, `.../diem`, `.../zalo`, close, reopen, attendance-export, `recordings` ghi).
- `C` gọi `K2` (lớp người khác) ⇒ 403 mọi route M (đồng giảng của K1 không có quyền gì ở K2).
- Gia sư chờ duyệt `P`: mời `P` ⇒ trả đúng câu chung (200) nhưng **không** tạo `CourseTeacher`; `P` gọi `chap-nhan` ⇒ 403.

**Mời/chấp nhận/gỡ**:
- Chủ mời `C` (200) ⇒ `CourseTeacher.invited`, thông báo `co_teacher_invited` không chứa email/tên (quét chuỗi); `C` chưa chấp nhận gọi route M ⇒ 403.
- Mời `P`/`H`/`B`/email lạ/email đã trong lớp/email của chính chủ ⇒ **cùng một body 200** (không phân biệt); đếm `CourseTeacher` chỉ tăng ở ca đúng. Vượt 10 lần ⇒ 429. Vượt 5 giáo viên ⇒ 409 `TEACHER_LIMIT`.
- `C` chấp nhận ⇒ `active`; chấp nhận lần hai ⇒ 409; `S` gọi `chap-nhan` lời mời của `C` ⇒ 403/404 (IDOR `ctId`); `C` từ chối ⇒ `declined`, mời lại ⇒ `invited` cùng dòng.
- Học viên của chính lớp (Enrollment bất kỳ trạng thái) được mời ⇒ vẫn 200 chung nhưng không tạo dòng; nếu lỡ có dòng rồi mới Enrollment ⇒ chấp nhận 409 `is_student_of_course`.
- Gỡ: owner gỡ `C` ⇒ `removed`; `C` gọi route M ⇒ 403 ngay; **buổi và `AttendanceRecord` do `C` ghi trước đó còn nguyên** (đếm trước/sau, `taughtBy` còn là id `C`); khung `teacherId = C` về null; nhóm `Chapter.teacherId = C` về null. `C` tự rời ⇒ cùng kết quả.
- Đồng giảng bị khoá (`banned`) sau khi `active`, hoặc bị hạ role: route M ⇒ 403 dù `CourseTeacher` còn `active` (đọc User từ DB).
- Đồng giảng mời/gỡ/đổi vai người khác ⇒ 403 (`C` gọi POST/PATCH/DELETE `giao-vien`).

**Quyền M (ma trận chạy thật)**:
- `C` GET `courses/[id]` ⇒ 200 nhưng **không có** `price/feeMode`; `students` ⇒ không có `email/phone/school`; `attendance-sessions/[id]` GET ⇒ không có `parentName/parentPhone`.
- `C` điểm danh buổi `taughtBy = C` chưa chốt ⇒ 200; buổi của `O` ⇒ 403 `NOT_YOUR_SESSION`; buổi đã chốt ⇒ 409; gửi `makeupCreditId`/`parentVisible` ⇒ 403; **số dòng `FeeCharge` và `FeeChargeInvoice` không đổi** sau mọi cuộc gọi của `C` (so snapshot) — ca phá: lớp `per_session`, buổi chưa chốt, `C` điểm danh `present` ⇒ 0 dòng phí mới.
- `C` close/reopen ⇒ 403; `de-nghi-chot` ⇒ 200, `AttendanceSession.state` không đổi, 0 dòng phí, `O` nhận đúng một thông báo `session_close_request` (gọi hai lần không tạo bản thứ hai).
- `S` (bộ môn) soạn bài trong nhóm của mình ⇒ 200; nhóm khác ⇒ 403; tạo section ⇒ 403; tạo khung lịch ⇒ 403; sửa khung của `O` ⇒ 403; `C` sửa khung `teacherId = C` ⇒ 200, khung của `O` ⇒ 403, xoá khung của `O` ⇒ 403.
- `C` PATCH `taughtBy`/`teacherId` ⇒ 403/bỏ qua.
- `createdBy` của buổi do `C` tạo = `ownerId`; xoá tài khoản `C` (prisma) ⇒ buổi còn.
- `C` chấm bài (grade/results/submissions) của bài trong lớp ⇒ 200; bài của lớp khác ⇒ 403; `S` bài ngoài nhóm ⇒ 403.
- `C` giao quiz CỦA `C` vào `K1` ⇒ 200; giao quiz của `O` ⇒ 403; giao vào `K2` ⇒ 403.

**Đồng giảng không thấy tiền ở MỌI route tiền (T)**: lặp danh sách T ở 3.1 (`courses/[id]/fees|fee-rates|extra-fees|packages|packages/[pid]`, `tutor/hoc-phi-thang`, `tutor/invoices`+`[id]`+`reminders`+`zalo`, `student-discounts`, `bank-transactions`+2, `payout-account`+1, `goi`+1, `late-fee-hint`, `users/[id]/tuition`) bằng `C` và `S` với `courseId=K1`: không 200 mang số tiền nào. Quét thêm phản hồi M (JSON) của `C`: không có khoá `price|amount|fee|charge|invoice|rate|revenue`.

**Chuyển vai & ghi danh (mục 2)**: học sinh `Y` có Enrollment ở `K1` ⇒ chuyển thành gia sư (prisma đặt `role: admin, adminRole: teacher, tutorVerified`) ⇒ Enrollment cũ còn nguyên; `Y` redeem mã ⇒ 403; đơn xin vào lớp cũ của `Y` được `O` duyệt ⇒ `khong-phai-hs`, không tạo Enrollment mới, không tăng `usedCount`; `O` thêm `Y` qua `hoc-sinh` POST ⇒ bị loại; admin `POST /api/admin/enrollments` cho `Y` ⇒ (sau khi nhánh Quản trị sửa) 409 — nếu chưa sửa thì ghi "chờ Quản trị" thay vì đỏ giả; `Y` gọi `exams/[id]/start`, `progress/[lessonId]`, `assignments/[id]/submit`, `followed-courses/[id]` ⇒ ghi kết quả thật (mới/có sẵn); mời `Y` đồng giảng lớp mà `Y` còn Enrollment ⇒ không tạo dòng.

**Chạy lại bài có sẵn (tut-test)**: `t-invites`, `t-tut-002`, `t-join-request`, `t-course-ops`, `t-giao-trinh`, `t-session-book`, `t-session-scores`, `t-attendance-export`, `t-class-recordings`, `t-enrollments-pending-api`, `ui-role-everything`, `ui-links-everywhere`, `ui-invite-input`, `ui-journey-new-tutor`. Không có bài nào được đổi kỳ vọng (các dòng G không đổi).

### 10.3 `tools/local-e2e/ui-course-teachers.ts` (390 và 1280)
- Mỗi màn ở 390 (iPhone) và 1280: không tràn ngang, nút ≥ 44px, không đứng ở trạng thái trắng.
- Chủ: tab Giáo viên (rỗng → mời → thấy dòng "Chờ nhận lời"); hộp thoại mời (email sai định dạng báo lỗi; gửi xong hiện câu chung); gỡ qua `KinConfirm` (có chữ về buổi được giữ).
- Đồng giảng: trang lời mời (Nhận lời → lớp xuất hiện ở nhóm "Lớp tôi đồng giảng" cả Hộp việc lẫn danh sách lớp); trong lớp **không có** tab Mã mời/Học phí, không nút Sửa/Xoá lớp; trang buổi có "Đề nghị chủ chốt buổi" và không có "Đã dạy xong", không có dòng phí; quét DOM không có `@`/SĐT của học viên/phụ huynh.
- subject_teacher: nhóm khác khoá.
- Ba trạng thái: chặn mạng (tải/lỗi + Thử lại hoạt động) và dữ liệu rỗng.
- Liên kết: mọi `href` qua `contentHref`/`toTutorPath` (không `/admin/`), gọi lại `ui-links-everywhere`.

---

## 11. Cờ và câu hỏi cho chủ (mỗi câu có mặc định an toàn; làm theo mặc định nếu chủ chưa trả lời)

- **TIỀN — CHỜ CHỦ**: Q1 chuyển học sinh thành gia sư khi người đó còn Enrollment `active` ở lớp thu phí kiểu mới: phí tiếp tục sinh. Mặc định: giữ (PR #142 đã chốt "ghi danh không đổi"); KiN không tự đổi trạng thái. Q2 đồng giảng chốt buổi: mặc định **chỉ chủ chốt** (phương án A, đồng giảng chỉ điểm danh + "Đề nghị chủ chốt"); B: cho chốt khi lớp không sinh phí theo buổi (`monthly_sessions`/`per_course`).
- **TRẺ EM — CHỜ CHỦ**: Q3 đồng giảng có được thấy liên hệ phụ huynh/học viên? Mặc định **không** (4.5). Q4 đồng giảng có được ghi điểm theo buổi (`diem`) và chia sẻ nhận xét cho phụ huynh? Mặc định **không**, vì đồng ý phụ huynh buộc với chủ lớp. Q5 học sinh có thấy tên đồng giảng? Mặc định **không** vòng 1.
- Q6 (TIỀN, nêu ở Q1) người mới chuyển vẫn là học viên có phí của lớp cũ: có muốn tạm dừng Enrollment khi chuyển vai (đụng buổi/phí ⇒ việc Quản trị + quyết định chủ)? Mặc định: không.
- Q7 chuyển quyền chủ lớp sang đồng giảng (như Google Classroom): mặc định **không làm** vòng 1 (đụng ~190 chỗ `ownerId`, `tutorId` của phí).
- Q8 lưu trữ/đóng lớp: co_teacher có được "đóng nhận học viên" (`classStatus`)? Mặc định không (nằm trong `course.edit`).
- Q9 xuất điểm danh cho đồng giảng: mặc định không; nếu có, chỉ cột buổi mình dạy.
- Q10 chủ xem kết quả đề do đồng giảng giao: vòng 2 (route mới, không đổi `Exam.ownerId`).
- Q11 tối đa 5 giáo viên/lớp, 1 lớp: được. Một gia sư đồng giảng bao nhiêu lớp: không giới hạn. Gói KiN Pro có tính đồng giảng vào hạn mức học viên/gia sư không: mặc định **không** (`assertCanAddStudent` chỉ đếm học viên theo `ownerId`).
- Cờ ĐỔI NẶNG: không có hạ tầng mới (không WebSocket, không đẩy ra máy).

---

## 12. Tệp chung / ngoài phòng cần xin COO (mẫu BAN-GIAO.md mục D)

```
D1 — MÃ VIỆC: TUT-dong-giang
TỆP CHUNG: src/lib/sessionBookServer.ts (tên khớp mẫu KHÓA `sessionBook*`)
ĐỔI GÌ: KHÔNG sửa. Hàm mới authorizeCourseFor nằm ở src/lib/courseAccessServer.ts (tệp mới của tut-code); các route M gọi hàm này, không đụng authorizeCourse. Ghi để COO biết đã chủ động tránh tệp KHÓA.
AI SỬA: không ai
PHÒNG KHÁC BỊ ẢNH HƯỞNG: không

D2 — Hai tệp lớn của Quản trị
TỆP: src/app/(admin)/admin/khoa-hoc/[id]/page.tsx, src/app/(admin)/admin/thi-thu/**
ĐỔI GÌ: KHÔNG sửa trong phiếu này. Đồng giảng dùng trang lớp mới (lop-cua-toi/[courseId]) và giáo trình BU-02, không dùng quan-lop/[id] (alias). Nếu về sau muốn đồng giảng mở alias: adm-code/adm-dev thêm kiểm vai qua loadCourseAccess ở nhánh dữ liệu (các chỗ `ownerId` trong tệp).
PHÒNG KHÁC BỊ ẢNH HƯỞNG: pb-admin (không phải làm gì lúc này)

D3 — prisma/schema.prisma
ĐỔI GÌ: thêm model CourseTeacher (mục 5); thêm ClassSchedule.teacherId String?, AttendanceSession.taughtBy String?, Chapter.teacherId String?; thêm trường quan hệ ngược courseTeachers ở Course và courseTeachings ở User. Chỉ thêm, không đổi kiểu/không xoá; qua t-db-push-guard.
AI SỬA: đề xuất tut-code (một người sửa một lúc); phòng khác chờ.
PHÒNG KHÁC BỊ ẢNH HƯỞNG: pb-admin, pb-hoc-sinh (chỉ phải generate lại client)

D4 — Quản trị (adm-code), chặn lỗ ghi danh + xoá tài khoản
(a) src/app/api/admin/enrollments/route.ts: thêm kiểm `user.role === "student"` ⇒ 409 { code: "not_student" } (H3).
(b) Sau khi PR #142 gộp: src/lib/accountDelete.ts — thêm mã chặn xoá/ẩn danh hoá gia sư còn `CourseTeacher.status in (active, invited)` (mã đề xuất `co_teaching_active`), và khi xoá ẩn danh phải đặt lại khung/nhóm (hoặc báo chủ lớp) — hoặc chấp nhận xoá và dựa vào cascade của CourseTeacher + tự đặt teacherId null;
(c) src/lib/adminOps.ts: nhãn nhật ký cho course_teacher.invite|accept|decline|remove|leave|role và attendance_session.request_close.
PHÒNG KHÁC BỊ ẢNH HƯỞNG: pb-admin chủ các tệp này.

D5 — Tệp đẩy chung (CHỈ nếu chủ chọn đẩy ra máy; mặc định KHÔNG làm)
src/lib/pushRules.ts: thêm "co_teacher_invited", "session_close_request" vào PUSH_TYPES và PUSH_DEFS (title/body cố định, không tên/tiền, defaultOn false). notify.ts không phải sửa.

D6 — Ngoài PHAM-VI tut-code nhưng cần để làm M
src/app/api/{sections,chapters,lessons,assignments,class-schedules,media}/** và src/lib/{mediaAccess,classThreadAccess,lessonGuard,lessonMediaServer}.ts — PHAM-VI không gán rõ. Đề xuất: giao tut-code cho phiếu này, đổi tương thích ngược (trang admin/khoa-hoc/[id] của Quản trị gọi cùng API, hành vi cho chủ/quản trị không đổi).

D7 — pb-hoc-sinh (stu-code)
(a) src/lib/communityServer.ts:203, src/lib/classThreadAccess.ts:17-19 và api/community/**: đồng giảng active là thành viên đọc/đăng; duyệt/xoá vẫn chủ.
(b) Rà H4: exams/[id]/start, progress/[lessonId], assignments/[id]/submit, followed-courses/[courseId], enrollments — thêm `session.role === "student"` nếu tut-test thấy route trả 200 cho gia sư có Enrollment cũ.

D8 — Tệp chung khác
tools/local-e2e/h.ts: KHÔNG sửa; test tạo CourseTeacher bằng prisma trong bài. docs/kin/**: kin-ghi-so ghi sổ.
```

---

## 13. Việc người chủ cần quyết (tóm tắt)

1. Q2 — Đồng giảng có được chốt buổi hay chỉ "đề nghị chủ chốt"? (mặc định: chỉ đề nghị).
2. Q3, Q4 — Mở liên hệ phụ huynh / ghi điểm theo buổi cho đồng giảng? (mặc định: không).
3. Q1, Q6 — Chuyển học sinh thành gia sư khi còn học và còn phí: giữ ghi danh hay tạm dừng? (mặc định: giữ).
4. Q5 — Học sinh có thấy tên giáo viên bộ môn? (mặc định: không).
5. Q7, Q9, Q10 — chuyển quyền chủ lớp, xuất điểm danh, chủ xem kết quả đề của đồng giảng: để vòng 2.
6. D5 — có muốn đẩy lời mời ra điện thoại (mặc định: không).

## 14. Thứ tự làm đề xuất

1. tut-code: D3 (schema, một người) → `courseAccess.ts` + `t-course-access-lib` → `courseAccessServer.ts` → sửa `enrollInTx` (H1, H2) → API `giao-vien`/`dong-giang` → các route M theo 3.1 (A→B→C→D).
2. tut-dev song song sau khi có hợp đồng `GET /api/tutor/dong-giang` và `giao-vien`: trang lời mời → nhóm "Lớp tôi đồng giảng" → tab Giáo viên → trang buổi/giáo trình theo vai.
3. tut-test: `t-course-teachers` → `ui-course-teachers` → chạy lại danh sách 10.2; ghi H4 cho stu-code.
4. Việc chỉ-đọc/không sửa trong suốt: `feeCharge*`, `invoiceServer*`, `sessionBook*.ts`.

## Hợp đồng API đã làm

Mọi phản hồi có `Cache-Control: no-store`. Lỗi: `{ error: string, code?: string }`. Thứ tự: 401 chưa đăng nhập → 403 bị khoá / chưa là gia sư đã duyệt → 404 lớp không có → 403 không thuộc lớp → 403 `ROLE_FORBIDDEN` → 400 → 409. Mọi POST/PATCH/DELETE là JSON (không phải form).

Quản lý giáo viên của lớp (chủ lớp ghi; đồng giảng / bộ môn chỉ GET):
- `GET /api/tutor/lop/[courseId]/giao-vien` → `{ limit: 5, role, teachers: [{ id, userId, name, role, subjects, status, email?, invitedAt?, respondedAt? }] }`. Chủ / admin thấy cả invited và email; đồng giảng chỉ thấy active, KHÔNG có email.
- `POST .../giao-vien` body `{ email, role: "co_teacher"|"subject_teacher", subjects?: string[] }` → luôn `200 { ok: true, message: "Nếu email đúng của một gia sư đã duyệt, lời mời đã được gửi." }` cho mọi email hợp lệ (không lộ có / không tài khoản). Lỗi: 400 (email / vai / môn sai), 409 `TEACHER_LIMIT` (active + invited >= 5), 409 `ALREADY_IN_COURSE` (chỉ khi chủ tự mời mình), 429 (10 lần / 10 phút / người mời).
- `PATCH .../giao-vien/[ctId]` body `{ role?, subjects? }` (chủ). Đổi vai gửi thông báo `co_teacher_role_changed`. 404 nếu ctId không thuộc lớp.
- `DELETE .../giao-vien/[ctId]` (chủ) → `{ ok, reassignedSchedules, reassignedChapters }`; `?preview=1` chỉ đếm: `{ previewOnly: true, reassignedSchedules, reassignedChapters }`, không ghi. 409 nếu không còn active (hoặc lời mời chờ thì huỷ lời mời).

Phía người được mời (gia sư đã đăng nhập; ctId phải là dòng của chính mình, nếu không 404):
- `GET /api/tutor/dong-giang` → `{ invitations: [{ id, courseId, courseName, role, subjects, invitedAt }], courses: [{ id, ctId, courseName, role, subjects }] }` (không tên chủ lớp, không tiền).
- `POST /api/tutor/dong-giang/[ctId]/chap-nhan` · `/tu-choi` · `/roi-lop` → `{ ok: true }`. 409 `ALREADY_RESPONDED` nếu đã xử lý; 409 `is_student_of_course` nếu người đó còn là học viên của chính lớp (chấp nhận).

Đề nghị chốt buổi:
- `POST /api/tutor/lop/[courseId]/buoi/[dateKey]/de-nghi-chot` (đồng giảng / bộ môn, chỉ buổi MÌNH dạy, chưa chốt, đã có điểm danh) → `{ ok: true }`; chỉ gửi thông báo `session_close_request` cho chủ (chống nhân đôi), KHÔNG đổi trạng thái buổi, KHÔNG sinh phí. 400 ngày sai, 403 `NOT_YOUR_SESSION` / chủ gọi, 409 buổi không có / đã chốt.

Phản hồi các route "M" khi người xem là đồng giảng / bộ môn (đã có sẵn, nay mở):
- Bỏ khoá tiền: `price, originalPrice, feeMode, tag, tagColor, charges, packages, warning, reopenWarning`; bỏ khoá liên hệ: `email, phone, school, parentName, parentPhone, zaloOpenedAt, zaloGroupUrl`, `parentVisible`.
- `GET /api/courses/[id]/students`: bộ môn chưa được giao nhóm / buổi nào → `{ students: [], total, namesHidden: true }`.
- `GET /api/courses/[id]/attendance-sessions`: chỉ buổi mình dạy + buổi chưa gán người dạy.
- `PUT /api/attendance-sessions/[id]`: buổi người khác → 403 `NOT_YOUR_SESSION`; buổi đã chốt → 409 `SESSION_CLOSED_OWNER_ONLY`; gửi `makeupCreditId` / `parentVisible` → 403; không tính phí.
- Buổi tạo bởi đồng giảng: `createdBy` = chủ lớp, `taughtBy` = người tạo. `PATCH sessions/[dateKey]` với `taughtBy` và `PUT class-schedules/[id]` với `teacherId` chỉ chủ gửi được.
- `PATCH /api/tutor/lop/[courseId]/giao-trinh/chuong/[chapterId]` và `PUT /api/chapters/[id]` nhận thêm `teacherId` (chủ; phải là giáo viên active của lớp, hoặc null) để giao nhóm cho bộ môn.
- `GET /api/courses/[id]/recordings` trả `role: "helper"` (chỉ xem) cho đồng giảng.
- Ghi danh: `POST /api/tutor/lop/[courseId]/yeu-cau/[id]/duyet` có thêm kết quả `?duyet=khong-phai-hs` (người xin vào nay đã là gia sư; đơn bị huỷ, lượt dùng mã được trả). `POST .../hoc-sinh` trả 403 `is_teacher_of_course` khi thêm chính giáo viên của lớp. UI cần ánh xạ thông điệp này ở LopChiTiet.

Mã `code` thông báo (link luôn là đường dẫn, không tên, không tiền): `co_teacher_invited` → `/lop-cua-toi/dong-giang`; `co_teacher_accepted|declined|left` → `/lop-cua-toi/[courseId]?tab=giao-vien`; `co_teacher_removed`, `co_teacher_role_changed` → `/lop-cua-toi/dong-giang`; `session_close_request` → `/lop-cua-toi/buoi/[courseId]/[dateKey]`.
