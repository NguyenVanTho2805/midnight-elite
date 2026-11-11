# LOI-04 · Nhắc học kiểu Reminders cho học sinh (thay chỗ "Lịch học")

Đặc tả của `stu-rnd` (pb-hoc-sinh), 11/11/2026. Nhánh `claude/loi-04-nhac-hoc` (worktree `.claude/worktrees/loi4`, rẽ từ `df485dae`). Đợt GỌN: không Figma (COO cho phép), bố cục mô tả bằng chữ ở mục 5. Số dòng đọc trực tiếp trong worktree.

Lời chủ (11/11): "bỏ lịch học, thay bằng kiểu reminder, học sinh tự take note, hẹn lịch, tag, dán… như Reminder ở MacBook. Ngày nào có lớp thì reminder nhảy lên báo học sinh ngày này có lớp nào, kèm một phiếu gồm tên bài, tài liệu học, link bài tập (nếu có)."

Cờ: **TIỀN = không** (không Coin, không học phí) · **TRẺ EM = trình bày + 1 câu hỏi** (ghi chú tự do là dữ liệu cá nhân của học sinh, có thể là trẻ em; không đẩy ra điện thoại; Q3 xoá tài khoản) · **ĐỔI NỀN = không** (không thư viện mới, không hàng đợi; một cron hằng ngày mới theo mẫu có sẵn).

---

## 0. Quyết định gọn

1. Màn `/student/nhac-hoc`, mục thanh bên **"Nhắc học"** (luôn hiện, không theo cờ LICH). API JSON `/api/student/nhac-hoc` + `/[id]` + `/xoa-da-xong`, gọi bằng `fetch` từ client — **theo mẫu chị em `lich-rieng`** (NC2-043), không phải POST+303 (lý do mục 4.0).
2. Bảng MỚI `StudentReminder` (`student_reminders`). **Không dùng lại** `StudentPersonalEvent` (lịch riêng): bảng đó bắt buộc ngày + giờ bắt đầu (`personalEvents.ts:36-42`), không có thẻ / "xong" / gắn bài. Lịch riêng **để yên** (route vẫn chạy, chỉ trang Lịch học bị ẩn bằng cờ LOI-01) — Q2.
3. Mục TỰ ĐỘNG theo lớp = **gọi lại nguyên `loadHomNay(userId, now)`** (`studentLopServer.ts:93-133`) — cùng quyền, cùng cửa sổ 7 ngày, cùng phiếu (tên bài, tài liệu, Azota, "Làm bài tập") như phiếu "Hôm nay có lớp" của LOI-03. Không viết truy vấn bài thứ hai cho giao diện.
4. Báo: **chỉ thông báo trong app** (chuông) qua `notify()` — một bản tóm tắt sáng **07:05 VN** từ cron MỚI `nhac-hoc-sang`. **Không đẩy web push trong đợt này** (lý do mục 7; Q1).
5. `notify.ts`, `pushRules.ts`, `pushServer.ts` **KHÔNG sửa** (ngược với gợi ý phiếu — lý do mục 7).
6. `LessonNote` (vở ghi MỘT bản/bài trong trang bài, `schema.prisma:1928-1940`) khác việc này: nhắc học là việc có hẹn ngày; "Ghi chú cho buổi này" tạo một `StudentReminder` gắn `lessonId`, không đụng `LessonNote`.

---

## 1. Vấn đề + bằng chứng

| Điều | Tệp:dòng |
|---|---|
| "Lịch học" của học sinh đã rời thanh khi cờ LICH tắt (LOI-01) ⇒ học sinh không còn chỗ tự hẹn việc | `StudentShell.tsx:89-90`, `features.ts:66` |
| Lịch riêng có sẵn nhưng là sự kiện lịch: tên ≤80, ghi chú ≤300, **bắt buộc** ngày+giờ, không thẻ, không "xong"; cổng `requireSession` (gia sư cũng gọi được) | `personalEvents.ts:8-16,36-42`; `lich-rieng/route.ts:14` |
| Bài có ngày học (`Lesson.scheduledAt`, LOI-02) chỉ hiện ở phiếu đầu "Việc của tôi", không ai báo | `schema.prisma:213`; `hom-nay/route.ts:10-14`; LOI-03 mục 7 "không tạo thông báo" |
| Cron nhắc học hiện có báo **ngày mai** theo khung giờ tuần, không theo `scheduledAt` của bài | `remind-class/route.ts:35-49,113-118` |
| `Notification` không có khoá chống trùng; mẫu chống trùng = tra `type`+`userId`+`createdAt ≥ 00:00 VN` | `schema.prisma:1805-1820`; `unmarkedDailyServer.ts:30-34`; `unmarkedDaily.ts:10` |
| Web push chỉ cho gia sư: đăng ký thiết bị chặn vai khác; danh sách loại vẽ thẳng ở Cài đặt gia sư | `pushAuth.ts:10-11`; `pushRules.ts:13`; `PushSettings.tsx:182` |
| Xoá tài khoản = ẩn danh hoá, KHÔNG xoá hàng User ⇒ `onDelete: Cascade` không chạy; việc riêng hiện có cũng không bị xoá | `accountDelete.ts:1-2,93-105` |

---

## 2. Chia tệp (song song, không tệp nào hai người cùng sửa)

Thứ tự: stu-code làm **bước 0** = schema + `src/lib/nhacHoc.ts` (thuần, đủ chữ ký mục 4.1) và push lên nhánh trước; stu-dev code giao diện theo chữ ký đó ngay, không chờ API.

| Tệp | Người |
|---|---|
| `prisma/schema.prisma` — model mới + 3 dòng quan hệ ngược (mục 3) | **stu-code** |
| `src/lib/nhacHoc.ts` (MỚI, thuần: không prisma/next/react) | **stu-code** |
| `src/lib/nhacHocServer.ts` (MỚI: đọc/ghi, kiểm gắn lớp, kế hoạch cron) | **stu-code** |
| `src/app/api/student/nhac-hoc/route.ts`, `[id]/route.ts`, `xoa-da-xong/route.ts` (MỚI) | **stu-code** |
| `src/app/api/cron/nhac-hoc-sang/route.ts` (MỚI) + `vercel.json` (1 mục) + `src/lib/adminOps.ts` `CRON_JOBS` (1 dòng — xin COO, mục 10) | **stu-code** |
| `tools/local-e2e/t-nhac-hoc-lib.ts`, `t-nhac-hoc.ts`, `mock/loi-04.ts` (MỚI) | **stu-code** |
| `src/app/(student)/student/nhac-hoc/page.tsx` (+ `loading.tsx` nếu cần) (MỚI) | **stu-dev** |
| `src/components/student/nhac-hoc/**` (MỚI: `NhacHoc.tsx`, `NhacHocChiTiet.tsx`, `PhieuBuoiHoc.tsx`…) | **stu-dev** |
| `src/components/student/StudentShell.tsx` — CHỈ thêm một phần tử `modules` | **stu-dev** |
| `tools/local-e2e/ui-nhac-hoc.ts` (MỚI); sửa kỳ vọng `ui-student-shell.ts` (thêm module, điện thoại 4 ô khi LICH tắt) | **stu-dev** |

stu-dev không import prisma, không sửa `api/**`, `src/lib/nhacHoc*.ts`; cần đổi hàm thì báo trưởng phòng. stu-code không sửa trang/component/`ui-*.ts`.

**KHÔNG sửa trong đợt này:** `src/components/tutor/**`, trang lớp gia sư, `src/lib/features.ts`, `proxy`/`hostRouting`, `admin/khoa-hoc/[id]`, `admin/thi-thu`, `/giang-vien`, `/mentor`, `api/cron/remind-class`, `lich-rieng/**`, `personalEvents.ts`, `studentLop*.ts` (chỉ import), `notify.ts`, `pushRules.ts`, `pushServer.ts`, `NotificationBell.tsx` (loại lạ tự rơi về biểu tượng 🔔, `NotificationBell.tsx:128`), `components/kin/**`, `h.ts`, `mock-seed.ts`.

---

## 3. Schema — CHỈ THÊM

```prisma
// LOI-04: nhắc học của học sinh (kiểu Reminders). Chỉ chủ đọc/sửa. Ghi chú là dữ liệu cá nhân: không vào thông báo, không gửi AI.
model StudentReminder {
  id         String    @id @default(cuid())
  userId     String
  title      String
  note       String?   @db.Text
  tags       String[]  @default([])
  dueAt      DateTime?            // mốc UTC; có ngày mà không giờ ⇒ 00:00 VN của ngày đó + dueHasTime=false
  dueHasTime Boolean   @default(false)
  doneAt     DateTime?
  courseId   String?
  lessonId   String?
  notifiedAt DateTime?            // đã vào tóm tắt sáng; đổi ngày/giờ hẹn ⇒ về null
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  user   User    @relation("StudentReminderOwner", fields: [userId], references: [id], onDelete: Cascade)
  course Course? @relation(fields: [courseId], references: [id], onDelete: SetNull)
  lesson Lesson? @relation(fields: [lessonId], references: [id], onDelete: SetNull)

  @@index([userId, dueAt])
  @@index([dueAt])
  @@map("student_reminders")
}
```
Quan hệ ngược (bắt buộc với Prisma, mỗi model **một dòng cuối khối quan hệ**): `User`: `studentReminders StudentReminder[] @relation("StudentReminderOwner") // LOI-04` (ngay dưới `personalEvents`, `schema.prisma:1042`); `Course`: `studentReminders StudentReminder[] // LOI-04` (sau `joinRequests`, `:92`); `Lesson`: `studentReminders StudentReminder[] // LOI-04` (sau `assignments`, `:209` — KHÔNG chen giữa `status`/`scheduledAt` của LOI-02 để git gộp sạch).
**Có tính là "chỉ thêm" không:** có. Trường quan hệ ngược không sinh cột; `db push` chỉ `CREATE TABLE student_reminders` + 3 khoá ngoại + 2 index trên bảng MỚI; không `@unique`, không đổi bảng cũ ⇒ `t-db-push-guard` không có cảnh báo. stu-code chạy `npx prisma generate` + `db push` máy, dán log vào phiếu bàn giao.
Không thêm bảng chống trùng: dùng `notifiedAt` (mục nhắc) + mẫu tra `Notification` theo ngày VN (bài lớp) — mục 7.

---

## 4. Hợp đồng

### 4.0 Vì sao JSON + fetch, không POST+303
Thêm nhanh bằng Enter, bấm "Xong", sửa trong panel cần cập nhật tại chỗ; mẫu chị em `lich-rieng` đã là JSON (`route.ts:27-39`, `[id]/route.ts:12-33`). Luật 5.5 cấm **server action**, không cấm fetch. Bắt buộc ở giao diện: `AbortController` 15 giây; lỗi/hết giờ ⇒ tải lại danh sách từ máy chủ rồi báo lỗi tại chỗ (không bao giờ kẹt "Đang lưu…", không báo thành công giả).

### 4.1 `src/lib/nhacHoc.ts` — THUẦN (stu-dev import được)
Chỉ import: `vnDateKeyOf`, `addDaysKey`, `instantOf`, `isValidDateKey`, `parseHm`, `hmOf` (`classSessions.ts`), `vnTimeHHmm`, `vnDayTitle` (`studentLop.ts`), kiểu `HomNayResp` (`studentLop.ts:276`).
```ts
export const NHAC_TITLE_MAX = 200, NHAC_NOTE_MAX = 4000, NHAC_TAGS_MAX = 10, NHAC_TAG_LEN_MAX = 30, NHAC_MAX_PER_USER = 500;
export const NHAC_BODY_MAX_BYTES = 20_000, NHAC_PAST_DAYS = 366, NHAC_FUTURE_DAYS = 731;
export interface NhacLop { courseId: string; courseName: string; lessonId: string | null; lessonTitle: string | null; href: string } // href: lessonHref hoặc /student/hoc-tap?course=
export interface NhacItem { id: string; title: string; note: string | null; tags: string[]; dueAt: string | null; dueHasTime: boolean;
  dueDate: string | null /* "YYYY-MM-DD" VN */; dueTime: string | null /* "HH:mm" VN, null khi !dueHasTime */; doneAt: string | null; lop: NhacLop | null; createdAt: string }
export interface NhacResp { now: string; todayKey: string; items: NhacItem[]; lop: HomNayResp; used: number; max: number }

/** "#Toán" | "toán" → "toán": NFC, bỏ # đầu, trim, toLocaleLowerCase("vi"); chỉ [\p{L}\p{N}_-]; rỗng/ký tự lạ/>30 → null. */
export function normalizeTag(raw: string): string | null;
/** Mảng thẻ từ JSON (không tin): khử trùng sau chuẩn hoá, giữ thứ tự; phần tử hỏng/>10 thẻ → lỗi tiếng Việt nói rõ. */
export function cleanTags(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string };
/** Thêm nhanh: "Ôn chương 2 #toan #on-thi" → { title: "Ôn chương 2", tags: ["toan","on-thi"] }. Thẻ = "#" sau đầu chuỗi/khoảng trắng. */
export function splitQuickTitle(text: string): { title: string; tags: string[] };
/** Tạo (POST): title (đã tách #thẻ, gộp với body.tags), note?, tags?, dueDate?, dueTime? (cần dueDate), courseId?, lessonId?. */
export function cleanNhacCreate(raw: unknown, todayKey: string): { ok: true; value: NhacCreate } | { ok: false; error: string };
/** Sửa (PATCH, từng phần): title (KHÔNG tách #), note|null, tags, dueDate|null, dueTime|null, done: boolean (đúng kiểu, "true" bị từ chối), courseId|null, lessonId|null. Không khoá nào → lỗi. */
export function cleanNhacPatch(raw: unknown, todayKey: string): { ok: true; value: NhacPatch } | { ok: false; error: string };
/** Ngày+giờ VN → mốc. Không giờ ⇒ instantOf(dateKey, 0), dueHasTime=false. */
export function dueOf(dateKey: string, time: string | null): { dueAt: Date; dueHasTime: boolean };
/** Quá hạn: chưa xong và (có giờ: dueAt < now; chỉ ngày: dueDate < hôm nay VN). Mục chỉ ngày KHÔNG quá hạn trong chính ngày đó. */
export function isOverdue(it: Pick<NhacItem, "dueAt" | "dueHasTime" | "dueDate" | "doneAt">, now: Date): boolean;
export type NhacNhom = "hom-nay" | "da-hen" | "tat-ca" | "da-xong";
export const NHAC_NHOM_KEYS: readonly NhacNhom[]; export const NHAC_NHOM_LABEL: Record<NhacNhom, string>; // Hôm nay · Đã hẹn · Tất cả · Đã xong
/** hom-nay = chưa xong & (dueDate = hôm nay hoặc quá hạn), quá hạn lên đầu rồi theo dueAt; da-hen = chưa xong & dueDate > hôm nay, theo dueAt;
 *  tat-ca = mọi mục chưa xong (có ngày theo dueAt, rồi không ngày theo createdAt mới→cũ); da-xong = doneAt mới→cũ. Hoà → id. Không đổi mảng gốc. */
export function chiaNhom(items: NhacItem[], now: Date): Record<NhacNhom, NhacItem[]>;
export function locTheoThe(items: NhacItem[], tag: string | null): NhacItem[];
export function demThe(items: NhacItem[]): { tag: string; count: number }[]; // nhiều → ít, hoà theo chữ (localeCompare "vi")
/** "Hôm nay · 15:00" | "Ngày mai" | "T5, 14/11 · 19:30" | "Quá hạn · T3, 10/11" | "" (không ngày). */
export function dueLabel(it: NhacItem, now: Date): string;
/** Ghi chú → đoạn chữ / link. Chỉ http(s), bỏ dấu câu cuối; javascript:/data:/mailto: là chữ thường. Giao diện vẽ bằng React (không innerHTML). */
export function noteSegments(note: string | null): ({ kind: "text"; text: string } | { kind: "link"; href: string; text: string })[];
/** Cron: chữ thông báo — CHỈ số đếm, không tiêu đề/ghi chú/tên lớp/tên người. n ngoài 1–99 ⇒ "nhiều". */
export function studyTodayText(n: number): { title: "Hôm nay có lớp"; message: string }; // "Hôm nay bạn có 2 buổi học. Mở Nhắc học để xem phiếu bài."
export function reminderDueText(n: number): { title: "Nhắc việc hôm nay"; message: string }; // "Bạn có 1 nhắc việc đến hạn hôm nay."
export const NHAC_HREF = "/student/nhac-hoc";
```
Làm sạch chữ theo đúng mẫu `oneLine`/`multiLine` của `personalEvents.ts:22-23` (bỏ ký tự điều khiển; tiêu đề một dòng; ghi chú giữ đổi dòng, gộp ≥3 dòng trống).

### 4.2 `src/lib/nhacHocServer.ts` (stu-code)
- `loadNhac(userId, now): Promise<NhacResp>` — `findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }], take: NHAC_MAX_PER_USER })` + `loadHomNay(userId, now)` song song. Mỗi mục có `courseId/lessonId` được **kiểm lại khi đọc**: lớp còn enrollment `active` của em, bài còn `status: "published"` ⇒ `lop` đầy đủ; ngược lại `lop: null` (mục vẫn hiện, mất nhãn lớp — không lộ tên bài đã chuyển nháp). Một truy vấn enrollment + một truy vấn bài cho mọi mục (không N+1).
- `checkAttach(userId, courseId?, lessonId?)` — `lessonId` ⇒ bài `published` thuộc lớp có enrollment `active` của em; `courseId` suy từ bài (gửi kèm mà lệch ⇒ lỗi). Chỉ `courseId` ⇒ enrollment `active`. Sai mọi kiểu (lớp khác, bài nháp/ẩn, `suspended`/`pending_consent`, id bịa) ⇒ **cùng một** lỗi 400 "Bài hoặc lớp này không thuộc lớp bạn đang học." (không lộ là bài nháp hay không tồn tại).
- `planMorningDigest(now)` / `runMorningDigest(now, { dryRun })` — mục 7.

### 4.3 Route (stu-code). Cổng chung: `requireStudentRole()` (`studentOnly.ts:17`): khách **401**, gia sư/quản trị (kể cả xem thử) **403**. Mục của người khác hoặc không có ⇒ **404** "Không tìm thấy nhắc việc này." (mẫu `lich-rieng/[id]/route.ts:10,21` — mọi `where` có `userId: session.userId`, không lộ tồn tại). Mọi phản hồi `Cache-Control: private, no-store`. Ghi: `limitOrBlock(userId, "nhac-hoc-write", 120, 60*60_000)` ⇒ 429. Thân > `NHAC_BODY_MAX_BYTES` ⇒ **413** (đọc `req.text()` rồi `JSON.parse`; hỏng ⇒ 400). 500: `{ error: "Lỗi server" }`, log `[student/nhac-hoc]` **không kèm userId, tiêu đề, ghi chú**.

| Route | Thân | 2xx | Lỗi |
|---|---|---|---|
| `GET /api/student/nhac-hoc` | — | 200 `NhacResp` | 401/403/500 |
| `POST /api/student/nhac-hoc` | `{ title, note?, tags?, dueDate?, dueTime?, courseId?, lessonId? }` | 201 `{ item: NhacItem }` | 400 (chữ nói rõ ô), 409 "Đã đủ 500 nhắc việc. Hãy xoá bớt mục đã xong rồi thêm.", 413, 429 |
| `PATCH /api/student/nhac-hoc/[id]` | một phần như 4.1 `cleanNhacPatch` | 200 `{ item }` | 400/404/413/429 |
| `DELETE /api/student/nhac-hoc/[id]` | — | 200 `{ ok: true }` | 404 |
| `POST /api/student/nhac-hoc/xoa-da-xong` | — | 200 `{ deleted: n }` (chỉ mục `doneAt` khác null của chính em) | 401/403/429 |

Quy tắc ghi: `doneAt`/`notifiedAt` **máy chủ đặt** (`done:true` ⇒ `doneAt = now`, `false` ⇒ null; client gửi `doneAt` bị bỏ). Đổi `dueDate`/`dueTime` ⇒ `notifiedAt = null`. Đếm 500 tính mọi mục (cả đã xong). Không route nào thêm Coin/điểm.
**KHÔNG BAO GIỜ trả:** `userId`, `notifiedAt`, mục/ghi chú của người khác, email/tên/số điện thoại ai, tên/id bài nháp/ẩn, `status`, `isLocked`, `videoUrl`/`zoomUrl`/`documents` thô, `adminNote`, `ownerId`, giá/`feeMode`, `bg`/`strip`/`tagColor`; và (phần `lop` từ `loadHomNay`) **câu hỏi, phương án, đáp án đúng, lời giải, điểm, bài nộp** — không đọc `AssignmentQuestion`/`AssignmentSubmission`/`Exam*`. Mốc "hôm nay", "quá hạn" do **máy chủ** cấp qua `now`/`todayKey`; giao diện tính nhóm bằng `chiaNhom(items, new Date(resp.now))` và làm mới `now` mỗi lần tải lại (chỉ là nhãn, không quyết quyền).

---

## 5. Luồng màn — học sinh (khách: AuthGuard `(student)` → `/dang-nhap?redirect=/student/nhac-hoc`; gia sư không tới vỏ học sinh; quản trị xem thử: API 403 ⇒ hiện "Nhắc học chỉ dùng được với tài khoản học sinh.", không ErrorStrip đỏ)

Chung: token `--kin-*` (không mã hex), `kinButtonClass`, `KinStatus` (nhãn CHỮ), nút/hàng ≥44px, 390 không cuộn ngang, chữ dài `break-words`, **không modal** (kho tránh hộp thoại; xoá dùng `useConfirm`/`KinConfirm`, không `window.confirm`).

**Thanh bên** (`StudentShell.tsx:88-92`): thêm `{ key: "nhac", label: "Nhắc học", href: "/student/nhac-hoc", icon: "bai-kt" }` ngay sau `viec`, ngoài nhánh `isLinkHidden` của Lịch. Không `desktopOnly` ⇒ điện thoại: Việc của tôi · Nhắc học · Lớp của tôi · Khác (4 ô khi LICH tắt; 5 ô khi `NEXT_PUBLIC_KIN_MO_LICH=1`, mỗi ô ≥72px ở 390 — Q6).

**1600** (`max-w-[1120px]`, `md:px-10`): h1 "Nhắc học", dòng phụ "Việc bạn tự ghi và buổi học có hẹn ngày. Chỉ mình bạn xem được."
- Cột trái 240px: `nav aria-label="Nhóm nhắc việc"` gồm nút `aria-pressed` (`data-nhac-nhom=<key>`; `WorkSkeleton`/`ErrorStrip` lấy từ `components/student/shared.tsx`): **Hôm nay (n) · Đã hẹn (n) · Tất cả (n) · Đã xong (n)**; dưới là "Thẻ" — chip `#toán (3)` (`data-nhac-the=<tag>`, `aria-pressed`), bấm lại để bỏ lọc; nút chữ "Bỏ lọc thẻ".
- Cột giữa: ô thêm nhanh trên cùng (`data-nhac-them`, nhãn ẩn "Thêm nhắc việc", placeholder "Thêm nhắc việc… gõ #thẻ, Enter để lưu"); Enter ⇒ POST (`splitQuickTitle`), ô khoá trong lúc gửi (chống Enter đôi), xong thì xoá ô và giữ con trỏ; đang ở "Hôm nay" thì mục mới tự hẹn **hôm nay, không giờ**; "Đã hẹn" ⇒ ngày mai; nhóm khác ⇒ không ngày. Danh sách: mỗi hàng (`data-nhac-muc=<id>`): ô tròn "Xong" (`<input type=checkbox>` ≥44px, nhãn "Đánh dấu xong: <tiêu đề>") · tiêu đề · dòng phụ [`dueLabel` · `#thẻ` · nhãn lớp] · `KinStatus` "Quá hạn" (tông lỗi `--kin-*`) khi `isOverdue`. Bấm hàng ⇒ mở chi tiết.
- **Mục tự động theo lớp** (chỉ ở "Hôm nay" và "Đã hẹn", trên các mục tự ghi cùng ngày): khối `KinPanel variant="nhan"` `data-nhac-buoi=<lessonId>`, nhãn chữ "Buổi học" + giờ + tên lớp + tên bài (liên kết `href`); **phiếu**: tài liệu "Mở ↗" (`docs`, tab mới, `rel="noopener noreferrer"`), "Bài Azota ↗", "Làm bài tập" (`baiTapHref`) — ngày khác hôm nay chỉ có tên bài + "Làm bài tập" (đúng dữ liệu `upcoming` của `loadHomNay`). Không ô "Xong" (chỉ đọc). Nút viền **"Ghi chú cho buổi này"** ⇒ POST `{ title: "Ghi chú: <tên bài>", lessonId, dueDate: dateKey, dueTime: time }` rồi mở chi tiết mục mới.
- Cột phải 400px = **panel chi tiết** (`aside data-nhac-chi-tiet`, không phủ màn): Tiêu đề (ô một dòng, ≤200, `KinCharRing`) · Ghi chú (textarea `useAutoGrow`, ≤4000, dán link được; xem dạng `noteSegments` khi không sửa) · Ngày (`input type=date`) + Giờ (`input type=time`, bỏ trống được; có giờ mà xoá ngày ⇒ chặn tại chỗ) · Thẻ (ô gõ, Enter/dấu phẩy thêm chip, × gỡ; báo lỗi ≤10 thẻ, ≤30 ký tự) · Gắn lớp/bài (`KinSelect` lớp từ `/api/student/lop`, rồi bài từ `/api/courses/<id>` — chỉ bài Đã đăng) · ô "Xong" · nút "Xoá" (xác nhận). Lưu khi rời ô (blur) bằng PATCH, chữ "Đã lưu" / lỗi tại chỗ. Câu nhỏ cuối panel: "Ghi chú chỉ mình bạn xem. Đừng ghi mật khẩu hay số điện thoại vào đây."
- Nhóm "Đã xong": nút viền "Xoá các mục đã xong" (xác nhận, `xoa-da-xong`).

**390:** một cột: h1 → hàng nhóm cuộn ngang (4 nút ≥44px) → chip thẻ cuộn ngang → ô thêm nhanh (dính trên khi cuộn) → danh sách. Bấm hàng ⇒ chi tiết **toàn màn trong trang** (thay danh sách, nút "← Nhắc học" đầu, `history.pushState` `?muc=<id>` để nút Quay lại của máy về danh sách), không modal. Phiếu buổi học: giờ + tên lớp một dòng, tên bài dòng dưới, nút xếp dưới (wrap).

**Ba trạng thái:** tải = `WorkSkeleton label="Đang tải Nhắc học"`; lỗi = `ErrorStrip "Không tải được Nhắc học."` + Thử lại (không coi là rỗng); rỗng theo nhóm — Hôm nay: "Hôm nay chưa có việc nào. Gõ vào ô trên để thêm." · Đã hẹn: "Chưa hẹn việc nào cho những ngày tới." · Tất cả: `KinEmptyState` "Chưa có nhắc việc nào" + câu "Ghi việc cần làm, hẹn ngày giờ, gắn #thẻ — như ghi chú trên điện thoại." · Đã xong: "Chưa có việc nào đã xong."; lọc thẻ rỗng: "Không có mục nào mang #<thẻ>." + "Bỏ lọc thẻ". Gần đủ (≥480 mục): `KinPanel canh-bao` "Bạn đã dùng n/500 mục…".
**Khách thấy gì:** không có trang (chuyển đăng nhập); `GET /api/student/nhac-hoc` ⇒ 401. **Học sinh thấy gì:** chỉ mục của mình + bài Đã đăng có hẹn ngày của lớp đang học.

---

## 6. Quy tắc nội dung
Không nhắn riêng, không chia sẻ mục cho ai, không bạn học, không gia sư/phụ huynh/quản trị xem (không có route quản trị nào đọc bảng này). Không bình luận, không báo cáo bài (không có nội dung công khai nào để duyệt). Link trong ghi chú chỉ http(s), mở tab mới `noopener noreferrer`, KiN không xem trước/không tải link. Ghi chú không gửi AI, không vào log, không vào `logAction`. Không thu thêm trường cá nhân nào (chỉ chữ em tự gõ).

## 7. Thông báo (không tên, không tiền, không nội dung riêng)
- Cron MỚI `GET /api/cron/nhac-hoc-sang`, `vercel.json` `"5 0 * * *"` (**07:05 VN**, sau `remind-class` 07:00, ngoài giờ yên lặng 22:00–07:00 `classSessions.ts:17-18`). Mẫu cổng: `checkCronAuth` (`cronAuth.ts:17`) ⇒ 503/401; `recordCronRun("nhac-hoc-sang")` (bắt buộc — `t-adm-003-lib.ts:26-29`); dòng `CRON_JOBS` `{ key: "nhac-hoc-sang", label: "Tóm tắt sáng Nhắc học của học sinh", path: "/api/cron/nhac-hoc-sang", schedule: "Mỗi ngày 07:05 giờ VN", maxGapHours: 36 }`.
- Người được xét: `role: "student"`, `banned: false`, `deletedAt: null`. (a) **Buổi học hôm nay**: bài `published`, `scheduledAt` trong `vnWindow(now, 0)` (00:00 VN hôm nay → 00:00 VN mai), đếm theo enrollment `active` (một truy vấn bài + một truy vấn enrollment). (b) **Nhắc việc đến hạn hôm nay**: `doneAt: null`, `notifiedAt: null`, `dueAt` trong cùng cửa sổ.
- Gửi: (a) `notify(uid, { type: "study_today", ...studyTodayText(n), link: NHAC_HREF })` — chống trùng: bỏ người đã có `Notification` `type: "study_today"` `createdAt ≥ vnDayStart(now)` (mẫu `unmarkedDailyServer.ts:30-34`). (b) **giành chỗ trước**: `updateMany({ where: { id: { in: ids }, notifiedAt: null }, data: { notifiedAt: now } })` theo từng người; `count === 0` ⇒ bỏ; còn lại `notify(uid, { type: "reminder_due", ...reminderDueText(count), link: NHAC_HREF })`. Chạy lại cùng ngày ⇒ 0 tin mới.
- `?dryRun=1` (vẫn cần CRON_SECRET): không ghi gì (không Notification, không `notifiedAt`, có `recordCronRun`), trả `{ dryRun: true, dateKey, studyToday: [{ userId, count }], reminderDue: [{ userId, count }], alreadySent: { studyToday: n } }` — **chỉ id + số**, không tên/tiêu đề. Chạy thật trả cùng dạng `dryRun: false` + `notified`. Tối đa 5000 người/lượt, quá thì `partial: true`.
- **GIỚI HẠN (ghi vào màn + gói phát hành):** cron hằng ngày (`adminOps.ts:57`) ⇒ mục hẹn 15:00 chỉ được báo trong tóm tắt 07:05, **không báo đúng giờ**; mục tạo/dời sang hôm nay sau 07:05 không có thông báo — chỉ hiện ở nhóm "Hôm nay" khi em mở trang. Quá hạn **không nhắc lại** các sáng sau (chỉ chữ "Quá hạn" trong app) — Q5.
- **Không web push đợt này:** (1) học sinh không đăng ký được thiết bị (`pushAuth.ts:10-11`, chỉ gia sư); (2) thêm loại vào `PUSH_TYPES` sẽ hiện công tắc lạ ở Cài đặt **gia sư** (`PushSettings.tsx:182`, tệp cấm sửa); (3) trẻ em + màn hình khoá. `study_today`/`reminder_due` không thuộc `PUSH_TYPES` ⇒ `notify()` không đẩy (`notify.ts:38`; cùng cách `pro_renewal`, `proRenewal.ts:2`). Thiết kế đợt sau (Q1): `STUDENT_PUSH_DEFS` tách riêng, chữ cố định từ `type`, giờ yên lặng, `PUSH_ENABLED=1`, trang bật cho học sinh.

## 8. Test (stu-code viết lib + API, stu-dev viết UI; COO chạy tuần tự)
**`t-nhac-hoc-lib.ts`** (thuần, chạy HAI lần `TZ=UTC` và `TZ=America/Los_Angeles`, kết quả giống hệt):
- Nhóm/quá hạn: now `2026-11-11T16:30Z` (23:30 VN 11/11): mục chỉ ngày 11/11 ⇒ hom-nay, KHÔNG quá hạn; mục 11/11 23:00 có giờ ⇒ hom-nay + quá hạn; mục `2026-11-11T17:15Z` (00:15 VN 12/11, cùng ngày UTC) ⇒ da-hen, `dueLabel` "Ngày mai · 00:15". now `2026-11-11T17:30Z` (00:30 VN 12/11): mục chỉ ngày 11/11 ⇒ hom-nay + quá hạn ("Quá hạn · T4, 11/11"); mục 00:15 ⇒ hom-nay + quá hạn. Đã xong không bao giờ quá hạn; thứ tự quá hạn lên đầu; hoà theo id; mảng gốc không đổi.
- Thẻ: "#Toán"/"toán" (NFD) ⇒ "toán" một thẻ; "#" trơn bỏ; `<b>`/emoji/khoảng trắng ⇒ lỗi; 30 ký tự được, 31 lỗi; 10 thẻ được, 11 lỗi; `splitQuickTitle("#toan")` ⇒ title rỗng ⇒ `cleanNhacCreate` lỗi "Chưa có tiêu đề".
- Giới hạn biên: tiêu đề 200 được/201 lỗi; ghi chú 4000/4001; `dueTime` không `dueDate` lỗi; 31/02 lỗi; quá 366 ngày lùi/731 ngày tới lỗi; `done: "true"` lỗi; patch rỗng lỗi; `doneAt`/`notifiedAt`/`userId` trong thân bị bỏ (không có trong value).
- `noteSegments`: `https://azota.vn/x).` ⇒ link không dính `).`; `javascript:alert(1)` là chữ; `studyTodayText(0|100)` không chứa số lạ; cả hai hàm chữ không nhận tham số chuỗi nào.
- **Ca phá cố ý** (ghi đầu tệp, mỗi ca phải làm bài ĐỎ, thử rồi hoàn tác): (1) `getDate()`/`getHours()` thay cộng 7 giờ ⇒ ca 00:15 đỏ dưới UTC; (2) quá hạn mục chỉ ngày tính `dueAt < now` ⇒ ca 23:30 đỏ; (3) bỏ khử trùng thẻ sau chuẩn hoá ⇒ ca NFD đỏ; (4) `<` thành `<=` ở 200 ⇒ đỏ; (5) cho `javascript:` thành link ⇒ đỏ; (6) chấp nhận `done:"true"` ⇒ đỏ.

**`t-nhac-hoc.ts`** (máy chủ ở `BASE`, hậu tố `stamp`, **không `wipe()`**). Dữ liệu: học sinh A (lớp X active), B (lớp Y active), C (X `suspended`), học sinh D bị ẩn danh (`deletedAt`), gia sư T chủ X, quản trị S. Lớp X: bài hôm nay 19:30 VN có tài liệu + Azota + Assignment kèm `AssignmentQuestion` có đáp án/giải thích; bài NHÁP hẹn hôm nay `NHAP-BI-MAT-<stamp>`.
- Cổng: khách 401, T và S 403 ở MỌI route/phương thức (GET, POST, PATCH, DELETE, xoa-da-xong); header `no-store`.
- Chéo người: B PATCH/DELETE mục của A ⇒ 404 và mục A không đổi; thân GET của B không chứa tiêu đề/ghi chú `A-<stamp>`.
- Giới hạn: 201/4001 ký tự, 11 thẻ, thẻ 31 ⇒ 400; thân 25 KB ⇒ 413; tạo 500 mục bằng prisma rồi POST ⇒ 409; JSON hỏng ⇒ 400.
- Gắn: `lessonId` lớp Y (A không học), bài nháp X, `courseId` lệch bài, C gắn bài X ⇒ cùng 400 cùng chữ; hợp lệ ⇒ 201 có `lop`. Chuyển bài đó sang nháp ⇒ GET trả `lop: null` và thân không chứa tên bài.
- **Ca phá JSON lộ:** thân mọi GET không khớp `LEAK_RE` của `t-loi03-api.ts:15` + `/userId|notifiedAt|isCorrect/`, không mã hex, không `NHAP-BI-MAT`, không tên người.
- **Ca phá Coin:** đếm `CoinTransaction` + `Wallet.balance` của A trước và sau 3 lần tạo + bấm xong/bỏ xong ⇒ bằng nhau.
- Cron: không/ sai khoá ⇒ 401; `dryRun=1` ⇒ có A (`studyToday` 1, `reminderDue` 1), không B (không bài, không mục), không C, D, T; sau chạy khô: 0 Notification mới, `notifiedAt` vẫn null. Chạy thật ⇒ A đúng 1 `study_today` + 1 `reminder_due`, `title`/`message` không chứa `stamp`, tên lớp, tên bài; `notifiedAt` đã đặt. **Chạy thật lần 2 ⇒ 0 tin mới.** Dời ngày mục ⇒ `notifiedAt` về null.
- Push / giờ yên lặng: `isPushType("study_today") === false`, `isPushType("reminder_due") === false`; `pushToUser(A, "study_today", { env: { PUSH_ENABLED: "1", … } })` ⇒ `skipped: "type-not-allowed"`; mã cron không import `pushServer`. Lịch cron đổi giờ VN ⇒ 07:05 ngoài `inQuietHours`.

**`ui-nhac-hoc.ts`** (Playwright, 1600 + 390, ảnh `scratchpad/shots/loi04-*.png`, dùng `waitForURL`): thanh có "Nhắc học" (điện thoại 4 ô khi LICH tắt) → rỗng (tài khoản mới) có câu + ô thêm → gõ "Ôn chương 2 #toan" Enter ⇒ hàng mới có `#toan`, Enter hai lần nhanh chỉ tạo 1 mục → mở chi tiết (1600 panel phải; 390 toàn màn, nút Quay lại máy về danh sách) → hẹn ngày mai 15:00 ⇒ sang "Đã hẹn" "Ngày mai · 15:00" → thêm thẻ, lọc thẻ → dán link trong ghi chú ⇒ link mở tab mới → bấm Xong ⇒ sang "Đã xong" → mục quá hạn có chữ "Quá hạn" → "Hôm nay" có khối `[data-nhac-buoi]` bài 19:30 với Mở ↗/Bài Azota ↗/Làm bài tập, KHÔNG có bài nháp → "Ghi chú cho buổi này" tạo mục gắn bài → chặn API 500 ⇒ ErrorStrip + Thử lại; quản trị xem thử ⇒ câu "chỉ dùng được với tài khoản học sinh". 390: không cuộn ngang; mọi nút ≥44px.
**Chạy lại phải xanh:** `t-db-push-guard`, `t-adm-003-lib`, `ui-student-shell` (đã sửa kỳ vọng), `ui-role-everything` (`ROLE=student`, `guest`), `t-loi03-lib`, `t-loi03-api`, `ui-loi03`, `t-personal-events`, `t-push`, `t-unmarked-daily`, `t-no-hex`, `t-no-fabricated`, `t-links`.

**Dữ liệu giả `mock/loi-04.ts`** (chạy sau `loi-03.ts` — `mock-seed.ts` sắp tên tệp; upsert id cố định `nh-loi04-*`, mốc dời về ngày chạy): hocsinh@kin.local — "Ôn công thức lượng giác #toan #on-thi" hôm nay 15:00; "Nộp phiếu khảo sát #viec-nha" hôm qua (quá hạn, chỉ ngày); "Đọc trước bài Làng #van" +2 ngày 19:00 gắn `l-loi03-van-1`; "Mua bút chì 2B" không ngày, ghi chú có link https; "Làm đề thử số 1 #toan" đã xong hôm qua. Bài lớp hôm nay: dùng `l-loi03-toan-1` (19:30) của LOI-03 — thiếu thì in dòng "chạy mock loi-03 trước". Trả dòng "xem ở /student/nhac-hoc".

## 9. Cờ + điều cần chủ quyết (không trả lời ⇒ làm theo mặc định)
TIỀN không · TRẺ EM trình bày (ghi chú cá nhân, chỉ chủ xem, không đẩy) · ĐỔI NỀN không.
- **Q1 — Đẩy ra điện thoại cho học sinh?** Mặc định: **không trong đợt này**, chỉ chuông trong app. Muốn bật: đợt riêng (đăng ký thiết bị cho học sinh, danh sách loại riêng, có thể cần phụ huynh đồng ý với em nhỏ).
- **Q2 — Lịch riêng cũ (NC2-043):** Mặc định: để yên, không chuyển dữ liệu, không hiện trong Nhắc học. Nếu production có dữ liệu thật: đợt sau chuyển một lần bằng script.
- **Q3 — Xoá tài khoản học sinh không xoá ghi chú** (ẩn danh hoá, `accountDelete.ts:93-105`; lịch riêng cũng đang vậy). Mặc định: xin COO giao phòng Quản trị thêm `studentReminder.deleteMany` + `studentPersonalEvent.deleteMany` vào `anonymizeUser` (nhánh riêng); LOI-04 không sửa tệp đó.
- **Q4 — Giờ tóm tắt sáng:** mặc định 07:05 VN.
- **Q5 — Quá hạn có nhắc lại mỗi sáng?** Mặc định không (một lần vào ngày đến hạn).
- **Q6 — Khi bật lại Lịch học, điện thoại 5 ô?** Mặc định có (Nhắc học không theo cờ).
- **Q7 — Gõ "#" trong ô thêm nhanh thành thẻ** ("Bài #3" ⇒ thẻ "3"). Mặc định có, như Reminders; ở panel chi tiết tiêu đề giữ nguyên "#".

## 10. Tệp chung cần xin COO
- `prisma/schema.prisma` — model mới + 3 dòng quan hệ ngược ở `User`/`Course`/`Lesson` (không cột mới ở bảng cũ).
- `vercel.json` (1 cron) + `src/lib/adminOps.ts` `CRON_JOBS` (1 dòng, tệp phòng Quản trị; `t-adm-003-lib` bắt hai chiều khớp).
- `src/components/student/StudentShell.tsx` (1 module — phiếu đã cho phép) + `tools/local-e2e/ui-student-shell.ts` (kỳ vọng module/4 ô).
- Ngoài phạm vi, chỉ báo: `src/lib/accountDelete.ts` (Q3).
