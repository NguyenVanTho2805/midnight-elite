# LOI-03 · Lõi dạy học — lớp của học sinh: thư viện lớp kiểu HSA, trang lớp 2 tab, ô nộp tệp to, phiếu "Hôm nay có lớp"

Đặc tả của `stu-rnd` (pb-hoc-sinh), 11/11/2026. Nhánh `claude/loi-lop-hoc-sinh` (worktree `.claude/worktrees/loi-hs`, rẽ từ `c5f6fb7d` = #156 đã gộp #154 + #155).
Đợt GỌN: không Figma (bố cục mô tả bằng chữ ở mục 4), không tra web. Mọi số dòng dưới đây đọc trực tiếp trong worktree.

Cờ: **TIỀN = không** (link "Học phí" chỉ dời chỗ, không hiện số; không đụng Coin — `POST /api/progress/[id]` có cộng Coin nhưng ta chỉ ĐỌC tiến độ) · **TRẺ EM = trình bày** (chỉ tên hiển thị gia sư; không bạn học; giữ nguyên quy tắc tệp nộp của BU-HS-NOP-TEP) · **ĐỔI NỀN = không** (không thư viện mới, không push, không cron mới).
Schema: **đúng 2 dòng ở `Lesson`** (mục 2), **COO đã duyệt trong phiếu giao** — không cần phiếu D.

---

## 0. Quyết định gọn

1. "Lớp của tôi" = `/student/hoc-tap` (không `?course=`) — **luôn** là thư viện lớp, kể cả khi chỉ có 1 lớp (bỏ tự nhảy vào lớp, `LopCuaToi.tsx:151-155`). Câu hỏi Q1.
2. Trang lớp = `/student/hoc-tap?course=<id>` (giữ URL, `t-links.ts:102` khoá `searchParams.get("course")`). Hai tab **Tổng quan · Nội dung**, mặc định **Nội dung**. Bỏ tab "Bài tập" và tab "Tài liệu & bản ghi" (nội dung của chúng dời vào Tổng quan).
3. Dữ liệu thư viện: API MỚI `GET /api/student/lop` (một lượt, tính sẵn x/y, %, bài "Học tiếp"). Trang lớp giữ `/api/courses/[id]` + `/api/progress` như cũ (không sửa route của phòng khác) — cột `scheduledAt` tự có trong cây vì route `include` nguyên `Lesson`.
4. Phiếu hôm nay: API MỚI `GET /api/student/hom-nay`, vẽ ở đầu `/student/viec-cua-toi` (trang học sinh mở đầu tiên — mục 1.4).
5. Một hàm thuần chung `src/lib/studentLop.ts` cho cả máy chủ và giao diện: tiến độ, "Học tiếp", chia ngày theo giờ VN, dòng phụ của bài. Thư viện, trang lớp và phiếu không thể tính lệch nhau.
6. Ô nộp tệp: dùng nguyên `NopTepBox` + API `nop-bai` (#155), chỉ đổi trình bày và thứ tự. Kho chưa bật ⇒ "Kho tệp chưa bật".
7. `/lop-cua-toi` và `/lop-cua-toi/<lớp>` (vai học sinh) không còn trang riêng có link "Lịch học"/"Học phí": danh sách vẽ đúng thư viện mới; trang lớp chuyển sang `/student/hoc-tap?course=`. Câu hỏi Q4 (tệp của phòng Gia sư, phiếu cho phép chỉ nhánh học sinh).

---

## 1. Vấn đề và hiện trạng

### 1.1 "Lớp của tôi" của học sinh: hai chỗ, cả hai không giống thư viện
| Chỗ | Hiện trạng | Tệp:dòng |
|---|---|---|
| `/student/hoc-tap` (mục "Lớp của tôi" của thanh bên, `StudentShell.tsx:88`) | 0 lớp: trống + Nhập mã; **1 lớp: tự `router.replace` vào lớp**; ≥2 lớp: `DanhMucLop` = danh sách hàng chữ (`KinListRow`: tên, gia sư · môn, "x/y bài đã hoàn thành", "Vào lớp →"). Không ảnh bìa, không vòng %, không lọc, không "Học tiếp" | `LopCuaToi.tsx:151-155`, `:196-209`; `DanhMucLop.tsx:16-37` |
| `/lop-cua-toi` vai học sinh (nơi `redirectIfNotTutor` đẩy học sinh về — GS-LOP-GON mục 3 ý 1; `ui-role-everything.ts:144,152,409` kỳ vọng `finPath === "/lop-cua-toi"`) | Danh sách thô `max-w-4xl`: tên + "Đang học" + hai nút **"Lịch học"** `/student/lich-hoc` và **"Học phí"** `/student/hoc-phi` | `src/app/lop-cua-toi/(tutor)/page.tsx:51-56` (truy vấn), `:70-76` (thẻ có 2 nút) |
| `/lop-cua-toi/<lớp>` vai học sinh | `OutlookShell` role student: 3 khối "Lịch học của tôi" / "Bài tập của tôi" / "Phiếu học phí" — chỉ là lối sang trang khác | `[courseId]/page.tsx:127`; `OutlookShell.tsx:88-100` |

### 1.2 Trang lớp (`?course=`) chưa theo mẫu
- Ba tab Tổng quan (cây) / Tài liệu & bản ghi / Bài tập (`LopCuaToi.tsx:223-227`); h1 luôn là "Lớp của tôi", tên lớp ở dòng phụ (`:184-190`, `:251`).
- Khung tiến độ ở cột TRÁI trên tab (`:254-277`, `data-course-hero`), cột phải 354px là "Các lớp của bạn / Tự học / Đang chờ duyệt / Tham gia lớp khác / Buổi học sắp tới / Thông tin lớp" (`:348-411`).
- Cây chương: `CourseOutline variant="page"` (#155) — đã gập/mở, đếm "x/y bài", ô tìm, "Mở hết/Thu hết" (`CourseOutline.tsx:97-98`, `:141`). Thiếu: số thứ tự chương "01", dòng phụ của bài ("1 tài liệu", "Có bài tập", ngày học), khối "Nội dung lớp: n chương · m bài".
- "Học tiếp" = bài đầu tiên chưa xong (`:174`) — **bỏ qua bài đang xem dở** dù `useProgress` có `watching` (`useProgress.ts:9`).

### 1.3 Dữ liệu tiến độ thật (định nghĩa "hoàn thành bài")
- `LessonProgress { userId, lessonId, completed, watchedSeconds, completedAt }` (`schema.prisma:1844-1858`). `completed=true` khi học sinh bấm "Đánh dấu xong" (`bai-giang/[lessonId]/page.tsx:770-780` → `POST /api/progress/[id]`, `route.ts:56-59`); `completed=false` + `watchedSeconds>0` = đang xem dở (`PATCH`, `:123-126`).
- `GET /api/progress` đã lọc bài Đã đăng và lớp đã nghỉ (`progress/route.ts:15-50`).
- **Định nghĩa dùng trong LOI-03:** *bài hoàn thành* = bài Đã đăng (`status === "published"`) của lớp có hàng `LessonProgress` của chính em với `completed = true`. Không có dữ liệu "học xong" nào khác; giữ câu thật thà đang có: "Tiến độ tính theo số bài bạn đã đánh dấu hoàn thành trong lớp." (`LopCuaToi.tsx:410`).
- **"Bài dở gần nhất" không đo được**: `PATCH` không cập nhật mốc giờ nào (`completedAt` chỉ ghi lúc tạo/hoàn thành; không có `updatedAt`). ⇒ "Học tiếp" = bài **đang xem dở đầu tiên theo thứ tự giáo trình**; không có thì bài chưa xong đầu tiên; xong hết thì bài đầu (nút đổi chữ "Xem lại"). Không bịa "gần nhất".

### 1.4 Trang học sinh mở đầu tiên = `/student/viec-cua-toi`
`landingPath` học sinh → `/student/viec-cua-toi` (`src/lib/landing.ts:9-13`; ưu tiên `?redirect=` nếu có); `/student` → redirect cùng chỗ (`(student)/student/page.tsx:3-4`); logo/landing của Navbar "Vào trang của tôi" dùng `landingPath`. "/" giữ là trang chủ công khai cho mọi vai (BU-HS-TRANG-CHU 1.4) — phiếu "Hôm nay có lớp" KHÔNG đặt ở "/".

### 1.5 Nộp bài
`AssignmentCard` (`bai-giang/[lessonId]/page.tsx:167-201`) vẽ: tiêu đề + hạn → link đề bài → khối điểm → **`NopTepBox` ở cuối**. `TabBaiTap` (`:379-414`) đặt **`AzotaPanel` trước** các thẻ bài tập (`:404-410`). Tab mặc định là "Tài liệu" trừ khi có `?nop=` (`:529`). Vùng thả `min-h-[132px] md:min-h-[160px]` (`NopTepBox.tsx:214`); tắt cấu hình ⇒ callout "Tính năng nộp tệp chưa bật" (`:247-248`). ⇒ Bài tập tệp là thứ **thứ ba/thứ tư** em thấy.

### 1.6 Chưa có ngày học của bài
`Lesson` không có cột ngày (`schema.prisma:186-214`). Có `azotaDeadline` (chuỗi hạn Azota) và `Assignment.dueDate` (hạn nộp) — đều là HẠN, không phải ngày học. ⇒ cần cột mới (mục 2), phòng Gia sư làm ô nhập ở nhánh khác; nhánh này chỉ đọc.

---

## 2. Schema (COO đã duyệt trong phiếu giao — chỉ thêm)

Trong `model Lesson`, **ngay sau** dòng 211 `  status         String           @default("published")`, thêm đúng hai dòng, giữ nguyên từng chữ (để nhánh phòng Gia sư thêm cùng hai dòng thì git gộp sạch):
```prisma
  // LOI-0111: ngày giờ học của bài (gia sư ghi ở màn sửa bài). Null = bài không gắn ngày. Dùng cho phiếu "Hôm nay có lớp" của học sinh.
  scheduledAt    DateTime?
```
Không index (truy vấn lọc theo `courseId` của em trước, vài trăm bài). Cột rỗng, nullable ⇒ `prisma db push` không cảnh báo (`t-db-push-guard`). stu-code chạy `npx prisma generate` + `db push` trên DB máy.
Hệ quả phụ: `/api/courses/[id]` trả nguyên hàng `Lesson` nên **tự có `scheduledAt`** (ISO) trong cây — trang lớp dùng được ngay, không sửa route đó. Xem Q3 về khách thấy ngày.

---

## 3. Hợp đồng dữ liệu

### 3.1 `src/lib/studentLop.ts` — THUẦN (không prisma/next/react), stu-code viết TRƯỚC (bước 0)
Chỉ import đọc: `vnDateKeyOf`, `addDaysKey`, `instantOf` (`lib/classSessions.ts:52,62,76`), `isLearnerVisible` (`lessonStatus.ts:9`), `parseLessonDocuments` + `viewerHref` (`lib/library.ts:24,66`), `parseLinkList` + `classifyMediaLink` (`lib/mediaLink.ts`), `coverImageOf` (`lib/tutorClassRoutes.ts:119`).
```ts
export interface TreeLesson { id: string; title: string; status?: unknown }
export interface TreeChapter { id: string; title: string; isImplicit?: boolean; lessons: TreeLesson[] }
export interface TreeSection { id: string; chapters: TreeChapter[] }

/** id bài Đã đăng theo đúng thứ tự giáo trình (phần → chương → bài như mảng đưa vào). Bài status khác "published" bị bỏ (ĐÓNG KHI LẠ). */
export function orderedLessonIds(s: TreeSection[]): string[];

/** x/y/%: chỉ đếm id có trong `ids` (tiến độ của bài lớp khác / bài nháp không lọt vào). pct = floor(done*100/total), CHỈ = 100 khi done === total; total 0 → pct 0. */
export function lopProgress(ids: readonly string[], completed: ReadonlySet<string>): { done: number; total: number; pct: number };

/** Bài "Học tiếp": bài đầu tiên (theo ids) đang xem dở và chưa xong → "dang-xem"; không có → bài đầu tiên chưa xong → "chua-hoc";
 *  xong hết → bài đầu → "on-lai"; ids rỗng → { lessonId: null, reason: "trong" }. Bài khoá (`locked`) bị bỏ qua. */
export function hocTiep(ids: readonly string[], completed: ReadonlySet<string>, watching: ReadonlySet<string>, locked?: ReadonlySet<string>):
  { lessonId: string | null; reason: "dang-xem" | "chua-hoc" | "on-lai" | "trong" };
export const HOC_TIEP_LABEL: Record<"dang-xem" | "chua-hoc" | "on-lai", string>; // "Học tiếp →" | "Học tiếp →" (done=0: "Bắt đầu học →") | "Xem lại →" — hàm nhãn nhận thêm done

export type LopTrangThai = "dang-hoc" | "hoan-thanh";
export const lopTrangThai = (p: { done: number; total: number }): LopTrangThai; // total>0 && done>=total ⇒ hoan-thanh
export const LOP_TRANG_THAI_LABEL = { "dang-hoc": "Đang học", "hoan-thanh": "Hoàn thành" } as const;
export type LopLoc = "tat-ca" | "dang-hoc" | "hoan-thanh";
export function locLop<T extends { trangThai: LopTrangThai }>(rows: T[], loc: LopLoc): T[];
export function demLoc(rows: { trangThai: LopTrangThai }[]): Record<LopLoc, number>;

/** "Gia sư: Cô Lan"; rỗng hoặc "KiN" (tên giữ chỗ của lớp tạo bằng wizard) → "" (cùng luật teacherLabel ở DanhMucLop.tsx:11-14). */
export function giaSuLabel(instructor: string | null | undefined): string;

/** Giờ VN, KHÔNG phụ thuộc TZ máy chủ/trình duyệt (cộng 7 giờ cố định như classSessions). */
export function vnTimeHHmm(d: Date): string;                        // "19:30"
export function vnDayTitle(dateKey: string, todayKey: string): string; // "Hôm nay" | "Ngày mai" | "T5, 14/11"

/** Cửa sổ truy vấn: from = 00:00 VN hôm nay; until = 00:00 VN của (hôm nay + days + 1). Dùng cho where.scheduledAt { gte: from, lt: until }. */
export function vnWindow(now: Date, days?: number /* = 7 */): { todayKey: string; from: Date; until: Date };

/** Chia bài theo NGÀY VN: today = cùng dateKey VN với now (kể cả giờ đã qua, kèm past=true); upcoming = dateKey trong (hôm nay, hôm nay+days];
 *  ngày đã qua, null, Invalid Date bị bỏ. Sắp theo scheduledAt tăng, hoà thì theo lessonId. Không đổi mảng gốc. */
export function chiaHomNay<T extends { lessonId: string; scheduledAt: Date | null }>(items: T[], now: Date, days?: number):
  { todayKey: string; today: (T & { dateKey: string; time: string; past: boolean })[]; upcoming: (T & { dateKey: string; time: string; past: false })[] };

/** Dòng phụ của bài ở trang lớp: ["1 tài liệu" | "n tài liệu", "Có bài tập", "Học T5, 14/11 · 19:30"] — mục nào không có dữ liệu thì không có (không bịa, không lượt xem).
 *  "Có bài tập" khi assignmentCount > 0 hoặc azotaUrl có ≥1 link hợp lệ. scheduledAt nhận ISO hoặc Date; hỏng → bỏ. */
export function lessonMetaParts(l: { documents?: string | null; azotaUrl?: string | null; assignmentCount?: number; scheduledAt?: string | Date | null }, todayKey: string): string[];

/** "Nội dung lớp: 3 chương · 12 bài"; chỉ đếm chương KHÔNG ngầm (isImplicit) và bài Đã đăng; 0 chương → "Nội dung lớp: 12 bài"; 0 bài → "Lớp chưa có bài học". */
export function contentSummary(s: TreeSection[]): string;
export const chapterNo = (i: number): string;  // 0 → "01", 9 → "10"

/** Tài liệu mở được của bài cho phiếu: tối đa 5, { name, href: viewerHref(name,url) } — parseLessonDocuments(raw, { allowKinFiles: true }). */
export function docLinks(raw: string | null | undefined): { name: string; href: string }[];
/** Link Azota hợp lệ của bài (parseLinkList → classifyMediaLink ok), tối đa 3, nhãn "Bài Azota" / "Bài Azota 2". */
export function azotaLinks(raw: string | null | undefined): { label: string; url: string }[];
```

### 3.2 `src/lib/studentLopServer.ts` — có prisma, stu-code
- `loadThuVienLop(userId): Promise<ThuVienRow[]>` — `Enrollment { userId, status: "active" }` xếp `createdAt asc, courseId asc` (giữ thứ tự hiện tại, `ui-lop-nhieu-lop.ts:87`); MỘT truy vấn cây `section → chapter → lesson { id, title, status, isLocked:false }` theo `order` cho mọi lớp; MỘT truy vấn `LessonProgress` của em trên các bài đó. Gọi `orderedLessonIds` → `lopProgress` → `hocTiep` → `lopTrangThai`.
- `loadHomNay(userId, now): Promise<HomNayResp>` — `Lesson.findMany({ where: { status: "published", scheduledAt: { gte: from, lt: until }, chapter: { section: { course: { enrollments: { some: { userId, status: "active" } } } } } }, select: { id, title, scheduledAt, documents, azotaUrl, _count: { select: { assignments: true } }, chapter: { select: { section: { select: { course: { select: { id: true, name: true } } } } } } }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: 60 })` rồi `chiaHomNay`; cắt today ≤ 20, upcoming ≤ 10.
  - Kiểm quyền nằm TRONG `where` (enrollment active của chính em + bài Đã đăng ; KHÔNG lọc `Course.status` — xem Q2 đã chốt). Chương/phần không có cờ ẩn riêng; "chương ẩn" = chương không còn bài Đã đăng ⇒ tự loại.
  - Lớp em đã nghỉ (`suspended`) / chờ phụ huynh (`pending_consent`) ⇒ không hiện.

### 3.3 `GET /api/student/lop` (MỚI, stu-code)
- Cổng: `requireStudentRole()` (`lib/studentOnly.ts:17`): khách **401**, gia sư/quản trị **403** (vai đọc lại từ DB). Chỉ GET (POST/PUT/DELETE → 405 mặc định của Next). `Cache-Control: private, no-store`.
- 200:
```json
{ "classes": [ { "id": "…", "name": "Toán 9", "category": "Toán", "giaSu": "Gia sư: Cô Lan", "cover": "https://…" ,
                 "done": 3, "total": 12, "pct": 25, "trangThai": "dang-hoc",
                 "hocTiep": { "lessonId": "…", "title": "Bài 4 …", "reason": "dang-xem" } } ] }
```
  `cover` = `coverImageOf(Course.bg)` hoặc `null` (KHÔNG BAO GIỜ trả chuỗi `bg`/`strip`/`tagColor` thô — chứa mã hex). `hocTiep` = `null` khi lớp chưa có bài.
- **KHÔNG trả:** `ownerId`, email/số điện thoại của ai, tên/số học sinh khác, `price`/`originalPrice`/`feeMode`/`tag` (TIỀN), `bg`/`strip`/`tagColor`, `zaloGroup*`/`classJoinUrl`, bất kỳ trường bài nháp/ẩn (tên, id), `adminNote`, `videoUrl`/`zoomUrl`/`azotaUrl`/`documents`.
- 500: `{ error: "Lỗi server" }`, log `[student/lop]` không kèm userId.

### 3.4 `GET /api/student/hom-nay` (MỚI, stu-code)
- Cổng giống 3.3 (401 / 403 / 200). `no-store`.
- 200 — **mốc giờ do máy chủ quyết**, trình duyệt không tự tính "hôm nay":
```json
{ "now": "2026-11-11T12:00:00.000Z", "todayKey": "2026-11-11",
  "today":    [ { "lessonId": "…", "courseId": "…", "courseName": "Toán 9", "lessonTitle": "Bài 5 …",
                  "scheduledAt": "…Z", "dateKey": "2026-11-11", "dayTitle": "Hôm nay", "time": "19:30", "past": false,
                  "href": "/student/bai-giang/<id>", "docs": [ { "name": "Đề cương.pdf", "href": "/xem-tai-lieu?…" } ],
                  "azota": [ { "label": "Bài Azota", "url": "https://azota.vn/…" } ],
                  "baiTapHref": "/student/bai-giang/<id>?tab=bai-tap" } ],
  "upcoming": [ { …cùng dạng, không "docs"/"azota" (gọn), "dayTitle": "Ngày mai" | "T5, 14/11" } ] }
```
  `baiTapHref` có khi `_count.assignments > 0`, ngược lại `null`. `azota` chỉ là link do gia sư dán (học sinh đã ghi danh mới nhận — đúng quyền MD-03, vì chỉ bài của lớp em đang học).
- **KHÔNG trả (người đang làm bài):** câu hỏi, phương án, **đáp án đúng**, **lời giải**, điểm, bài nộp, nhận xét (không đọc bảng `AssignmentQuestion`/`AssignmentSubmission`/`Exam*` chút nào); `adminNote`, `videoUrl`, `zoomUrl`, `documents` thô, `status`, `isLocked`, `statsViews`/`statsVideos` (KiN không đo — không hiện "lượt xem"), email/tên học sinh khác, `ownerId`.
- Không có bài hôm nay và 7 ngày tới ⇒ `{ today: [], upcoming: [] }` (200).

### 3.5 Trang lớp — đọc API đã có, KHÔNG sửa route
`/api/courses/[id]` (đã lọc bài Nháp/Ẩn `route.ts:74`, mở khoá cho học sinh đang học `:78-86`, có `_count.assignments` `:30`, `documents`, `azotaUrl`, và sau mục 2 có `scheduledAt`) + `/api/progress` (`completedIds`, `watching`). Giao diện gọi `orderedLessonIds`/`lopProgress`/`hocTiep`/`lessonMetaParts`/`contentSummary`/`chapterNo` — cùng hàm với máy chủ ⇒ x/y ở thư viện và ở trang lớp luôn bằng nhau. `todayKey` cho chữ "Hôm nay/Ngày mai" ở trang lớp: `vnDateKeyOf(new Date())` của trình duyệt (chỉ là nhãn hiển thị, không quyết quyền; lệch giờ máy chỉ đổi chữ).

---

## 4. Luồng màn (1600 và 390) — học sinh; khách không vào được (AuthGuard của `(student)` → `/dang-nhap?redirect=`)

Quy tắc chung: token `--kin-*` (không mã hex), `kinButtonClass`, `KinStatus` (nhãn CHỮ, không chỉ màu), mọi nút/hàng bấm ≥ 44px, 390 không cuộn ngang, tên dài xuống dòng (`break-words`). Một nút đặc mỗi khối (Hướng A).

### 4.1 Thư viện lớp — `/student/hoc-tap` (component MỚI `ThuVienLop`)
**1600** (khung nội dung `max-w-[1120px]`, lề `md:px-10`):
1. Đầu trang: h1 "Lớp của tôi"; dòng phụ "Bạn đang học n lớp."
2. Hàng lọc (`role="group" aria-label="Lọc lớp"`, nút `aria-pressed`, `data-loc-lop=<key>`): **Tất cả (n) · Đang học (a) · Hoàn thành (b)** — lọc ở trình duyệt bằng `locLop`, không gọi lại API.
3. Danh sách thẻ dọc, khoảng cách `--kin-kc-6`; mỗi thẻ (`data-class-card=<id>`, nằm trong `ul[data-class-catalog]` — giữ hai móc cũ cho `ui-lop-nhieu-lop`) là một hàng ngang:
   - Trái: ảnh bìa 240×135 (16:9, `object-cover`, `alt=""` vì tên lớp ở ngay cạnh); không có `cover` ⇒ khối `--kin-nhan-nen-nhat` + chữ tên lớp (2 dòng, `--kin-nhan-link`).
   - Giữa: `KinStatus` "Đang học"/"Hoàn thành"; tên lớp đậm (h2, là liên kết tới `/student/hoc-tap?course=<id>`); "Gia sư: … · Môn" (bỏ phần rỗng); thanh tiến độ (`role="progressbar"`, `aria-valuenow=pct`); "Đã hoàn thành x/y bài" (lớp 0 bài: "Lớp chưa có bài học", không thanh).
   - Phải: `KinProgressRing` (`components/kin/ProgressRing.tsx`, size 64, `label="Hoàn thành pct%"`) có chữ "pct%" ở giữa; dưới là nút đặc **"Học tiếp →"** (hoặc "Bắt đầu học →" khi done=0, "Xem lại →" khi xong hết) tới `/student/bai-giang/<hocTiep.lessonId>`; lớp 0 bài: nút viền "Vào lớp" tới trang lớp.
   - **Không** có link "Lịch học", không link "Học phí" trên thẻ.
4. Dưới danh sách (cột đơn, `max-w-[560px]`): "Đang chờ duyệt" (`PendingJoinBlock`, `data-pending-join` — dời nguyên từ `LopCuaToi.tsx:88-120`), "Tham gia lớp khác" (`JoinAnotherClass`), "Tự học" (khối cũ `:365-369`).

**390:** một cột; thẻ xếp dọc: ảnh bìa rộng hết thẻ (16:9, tối đa 180px cao) → nhãn → tên → gia sư · môn → hàng [thanh + "x/y bài"] | vòng 56px bên phải → nút "Học tiếp →" rộng hết thẻ. Hàng lọc cuộn ngang được nếu tràn (không xuống dòng vỡ), mỗi nút ≥44px.

**Ba trạng thái:** đang tải = `WorkSkeleton label="Đang tải Lớp của tôi"` (`role="status"`); lỗi = `ErrorStrip "Không tải được danh sách lớp của bạn."` + Thử lại (KHÔNG coi là "chưa vào lớp"); rỗng = `KinEmptyState "Bạn chưa vào lớp nào"` + "Nhập mã lớp" + "Tìm lớp miễn phí" (y như `LopCuaToi.tsx:198-203`). Lọc rỗng: dòng nhẹ "Chưa có lớp nào đã hoàn thành." / "Không có lớp nào đang học." + nút "Xem tất cả".

### 4.2 Trang lớp — `/student/hoc-tap?course=<id>`
**1600:** `grid lg:grid-cols-[minmax(0,1fr)_354px]`.
- Đầu: liên kết "← Lớp của tôi" (`data-all-classes`, `/student/hoc-tap`, luôn có); **h1 = tên lớp**; dòng phụ "Môn · Gia sư: …".
- Cột trái: `KinTabs` hai tab, thứ tự **Tổng quan · Nội dung**, mặc định **Nội dung** (`tabId lop-tab-tong-quan|lop-tab-noi-dung`, panel `lop-panel`).
  - **Nội dung:** dòng "Nội dung lớp: n chương · m bài" (`data-noi-dung-tom-tat`, `contentSummary`) + nút "Mở rộng tất cả"/"Thu gọn tất cả" (chính `data-outline-open-all`/`data-outline-close-all`); ô tìm giữ nguyên. Cây = `CourseOutline variant="page"` mở rộng:
    - Hàng chương là thẻ có viền (`--kin-vien-nhat`, bo `--kin-bo-md`): số thứ tự `chapterNo(i)` ("01", "02"… đếm trong toàn lớp, `data-chapter-no`), tên chương, "x/y bài" (giữ định dạng cũ — `ui-lop-outline.ts:96-98`), chữ "Đã xong" khi đủ, mũi tên `KinChevron`. Phần chỉ hiện khi khoá >1 phần (`outlineShape`, như cũ).
    - Dòng bài: biểu tượng ▷ (`aria-hidden`), tên bài; dòng dưới = `lessonMetaParts(...).join(" · ")` (`data-lesson-meta`) — ví dụ "1 tài liệu · Có bài tập · Học Hôm nay · 19:30"; bên phải nhãn chữ Đã học / Học tiếp / Đang xem / Chưa học / Đã khoá (như cũ). Cả dòng là liên kết `/student/bai-giang/<id>`. Không "lượt xem".
  - **Tổng quan:** "Thông tin lớp" (Gia sư, Môn, Bài cần làm / Bài chờ chấm — `LopCuaToi.tsx:402-409`); liên kết "Phiếu học phí của bạn →" `/student/hoc-phi` (chỉ chữ, không số — CỜ TIỀN không); khối "Tài liệu & bản ghi" = nguyên nội dung tab cũ (`data-materials-tab`, `:289-334`: bản ghi theo tháng, tài liệu đính kèm bài, bài giảng/bản ghi bài); khối "Bài tập của lớp" = danh sách bài loại quiz cũ (`:336-343`) — không mất dữ liệu nào của hai tab bị bỏ.
- Cột phải (`aside`): thẻ tiến độ `data-course-hero`: tên lớp (dòng nhỏ), nút đặc "Học tiếp →" (`hocTiep`, cùng chữ như 4.1; chưa vào lớp: "Xem lớp học →" `/khoa-hoc/<id>` như `:266-270`), "Bạn đã hoàn thành x/y bài" + thanh, "Gia sư: …" (bỏ nếu `giaSuLabel` rỗng), câu "Tiến độ tính theo số bài bạn đã đánh dấu hoàn thành.", liên kết "Tài liệu & bản ghi của lớp này →" (`data-thu-vien-link`, giữ cho `ui-library-links`). Dưới thẻ: "Buổi học sắp tới" (`data-course-sessions`, nguyên `:373-401`), "Các lớp của bạn" khi ≥2 lớp (`data-my-classes`, nguyên `:349-364`). **Không** có khối "Đánh giá".

**390:** một cột: đầu → **thẻ tiến độ lên trước** → hai tab → nội dung tab → "Buổi học sắp tới" → "Các lớp của bạn". Hàng chương/bài full-width, số thứ tự + tên + "x/y bài" xuống dòng được.
**Ba trạng thái:** đang tải `WorkSkeleton`; lỗi `ErrorStrip` + Thử lại + "Về danh sách khóa học" (`:211-215`); rỗng "Lớp chưa có bài học nào" (`:282-283`). Lớp đã nghỉ: `SuspendedNotice` như cũ (`:218`). Chưa vào lớp (lớp công khai): cây vẫn hiện, bài khoá có chữ "Đã khoá".

### 4.3 Bài học + ô nộp tệp — `/student/bai-giang/<id>` (giữ luồng làm bài/chấm)
- Đọc thêm `?tab=bai-tap` ⇒ mở tab "Bài tập" (cạnh `?nop=` đang có, `:529`); bài loại `quiz` cũng mở "Bài tập" mặc định. Không đổi gì khác của trang 864 dòng.
- `TabBaiTap`: thứ tự mới = [thông báo `?nop`] → **thẻ bài tập nộp tệp** (`mode !== "interactive"`) → thẻ làm trên web → `AzotaPanel` (khi bài có cả hai; bài chỉ có Azota thì Azota đứng một mình như cũ).
- `AssignmentCard`: tiêu đề + "Hạn dd/mm/yyyy" → **`NopTepBox` ngay dưới** → hướng dẫn + "Tải đề bài" → khối điểm/nhận xét (khi đã chấm thì khối điểm lên trên `NopTepBox`).
- `NopTepBox` (mode student, không compact): vùng thả rộng hết thẻ, `min-h-[200px] md:min-h-[240px]` (vẫn qua `ui-nop-tep.ts:104,293` ≥160/≥132), chữ chính "Kéo thả tệp Word hoặc PDF vào đây" cỡ `--kin-co-tieu-de`, dòng "hoặc" + nút "Chọn tệp" (≥44px), chú thích giới hạn ngay dưới (giữ `Caption`, không đổi số). Nhiều tệp, thanh tiến độ, lỗi tại chỗ — **giữ nguyên** (`NopTepBox.tsx`, `nopTepClient.ts`). Giới hạn 10 MB / 3 tệp / 60 ngày / cron hết hạn / quy tắc trẻ em (không ảnh) — **không đổi một số nào**.
- Kho chưa cấu hình (`danh-sach` trả `enabled:false`): callout tiêu đề **"Kho tệp chưa bật"**, thân giữ nguyên câu "Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota." (`ui-nop-tep.ts:274` kiểm câu này); không vùng thả, không nút Nộp, trang không vỡ.
- 390: thẻ bài tập full-width, vùng thả ≥200px cao, nút Nộp bài full-width.

### 4.4 Phiếu "Hôm nay có lớp" — đầu `/student/viec-cua-toi` (component MỚI `HomNayCoLop`)
- Vị trí: ngay dưới header (`ViecCuaToi.tsx:94-104`), trên thông báo gia sư chờ duyệt và lưới hai cột; full-width ở cả 1600 và 390.
- **Có bài hôm nay:** `section aria-labelledby` `data-hom-nay`, nền `--kin-nen-nhan`, tiêu đề "Hôm nay có lớp" + dòng phụ `vnDayTitle` của máy chủ ("Thứ Tư, 11/11" — từ `todayKey`). Mỗi bài một hàng (`data-hom-nay-bai=<lessonId>`): **giờ** (tabular, `time`; `past` ⇒ nhãn chữ "Đã qua") · **tên lớp** · **tên bài** (liên kết `href`); dưới: các tài liệu "Mở ↗" (`docs`, mở tab mới, `rel="noopener noreferrer"`), "Bài Azota ↗" (`azota`), "Làm bài tập" (`baiTapHref`). 1600: hàng ngang [giờ 72px | tên lớp + tên bài | nút]; 390: giờ + tên lớp một dòng, tên bài dòng dưới, nút xếp dưới (wrap).
- **Sắp tới (7 ngày):** dưới cùng phiếu, tiêu đề nhỏ "Sắp tới", tối đa 5 hàng gọn "Ngày mai · 19:30 · Toán 9 · Bài 6" (`data-hom-nay-sap-toi`), mỗi hàng là liên kết bài; >5 thì "Xem thêm" mở hết (≤10).
- **Không có bài hôm nay, có sắp tới:** phiếu chỉ còn một dòng nhẹ "Hôm nay không có bài nào được hẹn." + khối Sắp tới.
- **Cả hai rỗng:** **không vẽ gì** (không khung trống).
- Đang tải: không vẽ gì (tránh nháy; phần dưới đã có `WorkSkeleton`). Lỗi: một `ErrorStrip "Không tải được bài hôm nay."` + Thử lại (không im lặng).
- Không ghi chú cá nhân, không thẻ, không hẹn giờ, không push, không đếm ngược.

### 4.5 `/lop-cua-toi` vai học sinh (Q4)
- `src/app/lop-cua-toi/(tutor)/page.tsx`: nhánh `session.role === "student"` (sau kiểm gia sư chờ duyệt `:40`) ⇒ `return <ThuVienLop />` (cùng component 4.1, nằm trong vỏ học sinh `LopCuaToiFrame`). URL giữ `/lop-cua-toi` nên `ui-role-everything` không phải đổi kỳ vọng. Truy vấn `enrolled` và thẻ có "Lịch học"/"Học phí" của học sinh bị bỏ; nhánh gia sư/quản trị KHÔNG đổi một dòng.
- `src/app/lop-cua-toi/[courseId]/page.tsx:127`: học sinh đã qua kiểm ghi danh (`:68-79`) ⇒ `redirect("/student/hoc-tap?course=" + encodeURIComponent(course.id))` (trang không có `loading.tsx` ⇒ 307 thật). Người không ghi danh vẫn 404 như cũ. `OutlookShell.tsx` không sửa; sau đổi nó không còn ai gọi (nhánh gia sư/đồng giảng/quản trị đã trả `LopChiTiet` ở `:89-125`) — để nguyên, gỡ ở đợt sau (mục 11); bỏ luôn `import OutlookShell` ở `:16` nếu lint báo không dùng.

---

## 5. BẢNG CHIA TỆP (không tệp nào hai người cùng sửa)

Thứ tự: stu-code làm **bước 0** (schema + `studentLop.ts` + chữ ký API, có thể trả dữ liệu giả cùng kiểu) trước, stu-dev bắt đầu giao diện song song dựa trên chữ ký mục 3.

| Tệp | Người | Việc |
|---|---|---|
| `prisma/schema.prisma` | **stu-code** | đúng 2 dòng mục 2; `prisma generate` + `db push` máy |
| `src/lib/studentLop.ts` (MỚI, thuần) | **stu-code** | mục 3.1 |
| `src/lib/studentLopServer.ts` (MỚI) | **stu-code** | mục 3.2 |
| `src/app/api/student/lop/route.ts` (MỚI) | **stu-code** | mục 3.3 |
| `src/app/api/student/hom-nay/route.ts` (MỚI) | **stu-code** | mục 3.4 |
| `tools/local-e2e/t-loi03-lib.ts` (MỚI) | **stu-code** | mục 6.1 |
| `tools/local-e2e/t-loi03-api.ts` (MỚI) | **stu-code** | mục 6.2 |
| `tools/local-e2e/mock/loi-03.ts` (MỚI; `mock-seed.ts` tự chạy mọi tệp `mock/*.ts`, KHÔNG sửa `mock-seed.ts`) | **stu-code** | hocsinh@kin.local: lớp "Toán 9 (LOI-03)" có ảnh bìa https, 2 chương × 3 bài, 1 bài `scheduledAt` hôm nay 19:30 VN (1 tài liệu + 1 link Azota + 1 Assignment nộp tệp), 1 bài hôm nay 23:30, 1 bài ngày mai 00:30, 1 bài +3 ngày, 1 bài NHÁP hẹn hôm nay (không được hiện); lớp "Văn 9 (LOI-03)" không ảnh bìa, đã hoàn thành đủ (để lọc "Hoàn thành"); 1 bài đang xem dở (`completed=false, watchedSeconds=120`). `upsert` có `update: { scheduledAt }` để chạy lại là dời về ngày chạy. Trả dòng "xem ở /student/viec-cua-toi, /student/hoc-tap". |
| `src/components/student/ThuVienLop.tsx` (MỚI, client) | **stu-dev** | mục 4.1 (gọi `/api/student/lop`; chuyển `PendingJoinBlock`, `JoinAnotherClass`, "Tự học" từ `LopCuaToi.tsx` sang đây hoặc export từ đó — cùng người làm) |
| `src/components/student/LopCuaToi.tsx` | **stu-dev** | không `?course=` ⇒ `<ThuVienLop/>` (bỏ auto-enter); trang lớp theo 4.2; dùng `hocTiep`/`lopProgress`/`lessonMetaParts`/`contentSummary`; GIỮ `searchParams.get("course")` |
| `src/components/student/CourseOutline.tsx` | **stu-dev** | variant `page`: số chương, thẻ chương, ▷, dòng `meta` (đã có prop `meta`), nhãn "Mở rộng tất cả/Thu gọn tất cả" CHỈ ở `page`; giữ mọi `data-outline-*`, rail/sheet không đổi |
| `src/components/student/HomNayCoLop.tsx` (MỚI, client) | **stu-dev** | mục 4.4 |
| `src/components/student/ViecCuaToi.tsx` | **stu-dev** | chèn `<HomNayCoLop/>` dưới header |
| `src/components/student/nop-tep/NopTepBox.tsx` | **stu-dev** | vùng thả to (mode student), tiêu đề "Kho tệp chưa bật"; KHÔNG sửa `nopTepClient.ts` logic |
| `src/app/(student)/student/bai-giang/[lessonId]/page.tsx` | **stu-dev** | `?tab=bai-tap`, thứ tự `TabBaiTap`/`AssignmentCard` (4.3) |
| `src/app/lop-cua-toi/(tutor)/page.tsx` — CHỈ nhánh học sinh | **stu-dev** | 4.5 (Q4) |
| `src/app/lop-cua-toi/[courseId]/page.tsx` — CHỈ dòng 127 | **stu-dev** | 4.5 (Q4) |
| `tools/local-e2e/ui-loi03.ts` (MỚI) | **stu-dev** | mục 6.3 |
| Sửa kỳ vọng cũ: `ui-lop-nhieu-lop.ts` (`:146` 1 lớp → thư viện, `:97,:102` chữ thẻ tiến độ), `ui-student-pages.ts:81-90` (tab, h1 = tên lớp, "Bạn đã hoàn thành"), `ui-class-recordings.ts:69` (tab "Tổng quan"), `ui-lop-outline.ts` (chỉ nếu đụng chữ "Mở hết" ở variant page) | **stu-dev** | chỉ đổi kỳ vọng theo 4.x, ghi lý do ở đầu tệp |
| `DanhMucLop.tsx` | không ai sửa | `HomeMyClass.tsx:9` còn import `teacherLabel`; để nguyên dù trang lớp thôi dùng |

stu-dev **không** import prisma, không sửa `api/`, không sửa `src/lib/studentLop*.ts`; cần đổi hàm thì báo trưởng phòng. stu-code **không** sửa trang/component/`ui-*.ts`.

---

## 6. Test

### 6.1 `t-loi03-lib.ts` (stu-code, thuần, `npx tsx`; chạy HAI lần: `TZ=UTC` và `TZ=America/Los_Angeles` — kết quả phải giống hệt)
- `orderedLessonIds`: bỏ "draft", "hidden", null, "Published"; giữ thứ tự phần→chương→bài.
- `lopProgress`: tiến độ của id ngoài lớp không đếm; 0 bài ⇒ 0%; 199/200 ⇒ 99% (không 100); 200/200 ⇒ 100; done > total không vượt 100.
- `hocTiep`: bài 3 đang xem dở, bài 1-2 chưa học ⇒ bài 3 "dang-xem"; không xem dở ⇒ bài chưa xong đầu "chua-hoc"; xong hết ⇒ bài đầu "on-lai"; rỗng ⇒ null "trong"; bài khoá bị bỏ qua.
- `chiaHomNay` + `vnWindow` (giờ VN, ranh giới ngày):
  - now `2026-11-11T16:45Z` (23:45 VN 11/11): bài `16:30Z` (**23:30 VN**) ⇒ today, `past: true`, time "23:30"; bài `17:30Z` (**00:30 VN 12/11**, cùng ngày UTC) ⇒ upcoming "Ngày mai", KHÔNG today.
  - now `2026-11-11T17:15Z` (00:15 VN 12/11): bài `16:30Z` ⇒ bị bỏ (hôm qua); bài `17:30Z` ⇒ today.
  - biên 7 ngày: now 11/11 VN; bài 18/11 23:59 VN ⇒ upcoming; 19/11 00:00 VN ⇒ bỏ. `vnWindow.from` = `2026-11-10T17:00Z`, `until` = `2026-11-18T17:00Z`.
  - null / `new Date("x")` ⇒ bỏ, không ném; mảng gốc không đổi; hoà giờ ⇒ theo lessonId.
- `lessonMetaParts`: "1 tài liệu" / "2 tài liệu"; JSON hỏng ⇒ không có mục tài liệu; `javascript:` ⇒ không đếm; azota link hỏng ⇒ không "Có bài tập"; `scheduledAt` hỏng ⇒ bỏ; không bao giờ có chữ "lượt xem".
- `contentSummary` (chương ngầm không đếm), `chapterNo`, `giaSuLabel("KiN")===""`, `locLop`/`demLoc`.
- **Ca phá cố ý** (ghi ở đầu tệp, mỗi ca phải làm bài ĐỎ — người viết thử từng ca rồi hoàn tác): (1) thay cộng 7 giờ bằng `getHours()`/`toDateString()` ⇒ ca 00:30 đỏ dưới `TZ=UTC`; (2) `lopProgress` đếm mọi id trong `completed` ⇒ ca "id ngoài lớp" đỏ; (3) `Math.round` ⇒ 199/200 đỏ; (4) `hocTiep` bỏ `watching` ⇒ ca "dang-xem" đỏ; (5) biên `<=` thành `<` ở 7 ngày ⇒ ca 18/11 đỏ; (6) `orderedLessonIds` dùng `!== "draft"` ⇒ ca "hidden"/null đỏ.

### 6.2 `t-loi03-api.ts` (stu-code, máy chủ thử ở `BASE`; tạo dữ liệu có hậu tố `stamp`, **không gọi `wipe()`**)
Dữ liệu: học sinh A (lớp X active), học sinh B (lớp Y active), C (lớp X `suspended`), D (lớp X `pending_consent`), gia sư T chủ X, quản trị S. Lớp X: bài hôm nay 19:30 VN có tài liệu + azota + Assignment (kèm `AssignmentQuestion` có `correct`/giải thích — để bắt lộ), bài NHÁP hẹn hôm nay tên `NHAP-BI-MAT-<stamp>`, bài `hidden` hẹn hôm nay, bài ngày mai 00:30 VN. Lớp Y: bài hôm nay tên `LOP-KHAC-<stamp>`. Lớp Z `status=false` (lớp riêng, ẩn khỏi danh mục) có A ghi danh + bài hôm nay `LOP-RIENG-<stamp>` — A PHẢI thấy (Q2 đã chốt).
- `/api/student/hom-nay` và `/api/student/lop`: khách ⇒ **401**; T, S ⇒ **403**; `POST` ⇒ 405; header `no-store`.
- A: today có đúng bài 19:30 của X (time "19:30", `todayKey` = `vnDateKeyOf(now)` máy chủ), upcoming có bài 00:30; **không** có `NHAP-BI-MAT`, bài hidden, `LOP-KHAC`, `LOP-AN`.
- B: không thấy bất kỳ bài/ngày/tên bài nào của X (chuỗi tên bài X và `scheduledAt` ISO của bài X không xuất hiện trong thân). C, D: today/upcoming rỗng.
- **Ca phá: JSON lộ** — thân của mọi lượt gọi KHÔNG khớp `/adminNote|videoUrl|zoomUrl|"documents"|"status"|isLocked|statsViews|ownerId|email|phone|price|feeMode|"bg"|"strip"|tagColor|correct|explanation|loiGiai|options|answer|score|submission|storageKey/i` và không chứa mã hex `/#[0-9a-f]{3,8}\b/i`; không chứa tên học sinh khác.
- `/api/student/lop` của A: x/y không đếm bài nháp (tạo tiến độ `completed=true` trên bài nháp ⇒ `done` không đổi); `hocTiep.lessonId` không bao giờ là bài nháp; `cover` null hoặc `https://`.
- Ghi nhận (CẢNH BÁO, không đỏ — chờ Q3): `GET /api/courses/<X>` với B/khách có trả `scheduledAt` không.

### 6.3 `ui-loi03.ts` (stu-dev, Playwright, 1600 và 390, ảnh vào `scratchpad/shots/loi03-*.png`)
Thư viện (thẻ, ảnh bìa/khối màu, nhãn chữ, vòng %, "Học tiếp →" đúng bài dở, lọc 3 nút + đếm, KHÔNG có link "Lịch học"/"Học phí" trên thẻ, 1 lớp vẫn ở thư viện) → bấm tên lớp → trang lớp (h1 tên lớp, tab Nội dung mặc định, "Nội dung lớp: n chương · m bài", "01"/"02", Mở rộng tất cả, dòng bài có "1 tài liệu · Có bài tập · Học Hôm nay · 19:30"; 390: thẻ tiến độ nằm TRÊN dải tab; tab Tổng quan có "Phiếu học phí của bạn" không chữ số/"đ") → bấm bài → tab Bài tập: `[data-nop-tep-vung-tha]` là khối đầu tiên của thẻ bài tập, cao ≥200px; chặn route `danh-sach` trả `enabled:false` ⇒ "Kho tệp chưa bật", không vùng thả, trang còn nguyên → `/student/viec-cua-toi`: `[data-hom-nay]` có bài 19:30, tài liệu mở tab mới, "Sắp tới" có "Ngày mai · 00:30"; tài khoản không có bài hẹn ⇒ không có `[data-hom-nay]`; chặn `hom-nay` trả 500 ⇒ ErrorStrip + Thử lại. `/lop-cua-toi` (học sinh) hiện thư viện, `/lop-cua-toi/<X>` ⇒ về `/student/hoc-tap?course=<X>`. 390: không cuộn ngang mọi màn; mọi nút/hàng ≥44px.

### 6.4 Chạy lại phải xanh (COO chạy tuần tự)
`ui-role-everything` (`ROLE=student`, `ROLE=guest`), `ui-student-shell`, `ui-home-doors` (thay cho "ui-hs-trang-chu" — không có tệp tên đó), `t-nop-tep`, `ui-nop-tep`, `t-quiz-hs`, `t-db-push-guard`, `t-no-hex`, `t-no-fabricated`, `t-links`; thêm vì trang lớp đổi: `ui-lop-nhieu-lop`, `ui-student-pages`, `ui-class-recordings`, `ui-student-schedule-link`, `ui-library-links`, `ui-lop-outline`, `ui-join-request`, `t-lesson-outline-lib`, `t-media-access-lib`.
**Đỏ có sẵn trên main (không tính cho LOI-03):** role-student `/mentor/khong-co-gia-su` không có giải thích; role-guest 401 `/api/honor-leaderboard` ở `/bang-xep-hang`.

---

## 7. Quy tắc nội dung + thông báo
- Không nhắn riêng, không ô soạn, không bạn học, không "lượt xem", không số tiền. Chỉ tên hiển thị gia sư (`Course.instructor`, đã công khai). Khách không vào được khu này.
- **Không tạo thông báo mới** trong LOI-03 (không push). Nếu sau này nhắc "Hôm nay có lớp": chữ cố định, không tên gia sư/học sinh, không tiền.

## 8. Rủi ro
1. **Ngày lệch dữ liệu gia sư:** phòng Gia sư ghi `scheduledAt` ở nhánh khác; trước khi nhánh đó gộp, cột luôn null ⇒ phiếu không bao giờ hiện trên production (đúng, không vỡ). Ô nhập của gia sư phải lưu giờ VN → UTC đúng (`instantOf`) — báo phòng Gia sư dùng cùng hàm.
2. **Gộp schema:** hai nhánh thêm cùng hai dòng tại cùng chỗ ⇒ gộp sạch CHỈ khi giống từng ký tự (kể cả khoảng trắng canh cột). Lệch một dấu ⇒ xung đột; người gộp giữ một bản.
3. **Thay đổi hành vi 1 lớp** (Q1) đổi nhiều `ui-*` cũ — đã liệt kê ở mục 5.
4. Chạy `t-loi03-api` sát 00:00 VN có thể đỏ giả (bài "hôm nay" thành "hôm qua" giữa lúc tạo và gọi) — bài in giờ VN lúc chạy; chạy lại.
5. Cây giáo trình lớn: `loadThuVienLop` một truy vấn cho mọi lớp, chọn ít cột; không N+1.

## 9. Câu hỏi cho trưởng phòng (kèm mặc định — không trả lời thì làm theo mặc định)
- **Q1.** Học sinh chỉ có 1 lớp: vẫn hiện thư viện (mặc định — đúng mẫu HSA, "Học tiếp" vẫn một chạm) hay giữ tự nhảy vào lớp như NC2-041?
- **Q2.** Phiếu giao nói "lớp ẩn không hiện". `Course.status=false` là "ẩn khỏi danh mục công khai" — lớp riêng của gia sư vẫn có học sinh học bình thường (trang lớp vẫn mở cho các em, `courses/[id]/route.ts:66-69`). Mặc định: **làm đúng phiếu** (loại khỏi phiếu hôm nay), nhưng đề nghị chủ xác nhận vì có thể làm mất bài hôm nay của lớp riêng.
- **Q3.** `/api/courses/[id]` (tut-code) sẽ trả `scheduledAt` cho cả khách / học sinh lớp khác ở lớp công khai (như tên bài). Mặc định: **chấp nhận trong đợt này** (ngày học của bài công khai không phải dữ liệu cá nhân); nếu muốn chặn: COO giao tut-code thêm `scheduledAt` vào `PROTECTED_LESSON_FIELDS` (`mediaAccess.ts:25`) + sửa `t-media-access-lib.ts:46` (5 → 6).
- **Q4.** Hai tệp phòng Gia sư (`lop-cua-toi/(tutor)/page.tsx` nhánh học sinh, `[courseId]/page.tsx:127`) — phiếu cho phép nhánh học sinh. Mặc định: stu-dev sửa đúng hai chỗ đó, trưởng phòng báo pb-gia-su trước để họ không sửa cùng lúc.

## 10. Tệp chung / ngoài phòng
- `prisma/schema.prisma` — 2 dòng, **COO đã duyệt trong phiếu giao**.
- Hai tệp phòng Gia sư ở Q4 (chỉ nhánh học sinh, phiếu cho phép) — cần báo, không cần phiếu D.
- KHÔNG đụng: `StudentShell`/`TutorShell`/`Navbar`/`adminNav`/`proxy`/`hostRouting`/trang chủ khách, `components/tutor/**`, `admin/khoa-hoc/[id]`, `admin/thi-thu`, `components/kin/**` (chỉ dùng lại `ProgressRing`, `Tabs`, `Status`, `Fold`…), `tools/local-e2e/h.ts`/`wipe`/`seed*`/`mock-seed.ts`, `api/courses/**`, `api/progress/**`, `api/enrollments`.

## 11. Để đợt sau
"Bài dở gần nhất" thật (cần mốc giờ cập nhật ở `LessonProgress` — schema); nhắc/push "Hôm nay có lớp"; ghi chú/thẻ/hẹn giờ cá nhân; lượt xem thật; gộp "Buổi học sắp tới" (lịch tuần) với `scheduledAt` của bài thành một nguồn; gỡ `OutlookShell` nhánh học sinh và `DanhMucLop` khi không còn ai dùng.

## Quyết định trưởng phòng (11/11/2026)

- **Q1:** luôn hiện thư viện, kể cả 1 lớp (đúng mẫu HSA). Sửa kỳ vọng `ui-lop-nhieu-lop` cho khớp.
- **Q2:** KHÔNG lọc `Course.status`. Phiếu giao COO chỉ nói "bài nháp/ẩn (status ≠ published) không hiện" — "ẩn" là của BÀI. Lớp riêng (`Course.status=false`) vẫn có học sinh học, bài hôm nay của các em phải hiện. Kiểm quyền = enrollment active của chính em + `Lesson.status = "published"`.
- **Q3:** chấp nhận trong đợt này; ghi vào gói phát hành cho COO quyết (tut-code nếu muốn chặn).
- **Q4:** stu-dev sửa đúng hai chỗ nhánh học sinh; trưởng phòng ghi vào gói phát hành để COO báo pb-gia-su (nhánh LOI-02).
