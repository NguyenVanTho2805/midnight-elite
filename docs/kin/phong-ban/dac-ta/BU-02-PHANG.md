# Đặc tả BU-02-PHẲNG · Giáo trình dạng DANH SÁCH PHẲNG, có kiểu + trạng thái từng mục

Người viết: tut-rnd (pb-gia-su) · 05/11/2026 · nhánh `claude/bu02-giao-trinh-phang` (rẽ từ `origin/main`, repo midnight-elite).
Kế thừa `dac-ta/BU-02.md` (đã gộp vào main: `giaoTrinh.ts`, `giaoTrinhServer.ts`, `components/tutor/giao-trinh/*`, G1–G3, A1–A6 đã có). Bản này **chỉ nói phần đổi**; phần không nhắc ở đây giữ nguyên như BU-02 (ô tải lên chung, A1–A6, nhận diện link, Thư viện, V6/V7/V8 đã vá).
Nguồn khác: `bao-cao/doi-chieu-figma-bu02-bu05-bu07-05-11-2026.md` (đọc từ `origin/claude/figma-bu01-03-06`), `PHAM-VI.md`, `BAN-GIAO.md`.
**Cờ: TIỀN = không · TRẺ EM = CÓ (mục nháp/ẩn là lớp bảo vệ nội dung dạy trẻ; một chỗ lọc sót là lộ bài chưa duyệt cho em) · ĐỔI NỀN = không** (thêm cột chỉ-thêm, không đổi cột có sẵn). Cỡ L.

**Figma: CHƯA ĐỌC TRỰC TIẾP, CHƯA SỬA.** Phiên này không nạp được công cụ Figma (không có `ToolSearch`/`mcp__plugin_figma_figma__*`), nên không mở được 606:5, 607:218, 607:491, không `get_screenshot`/`get_design_context`, không `use_figma`. Không bịa nodeId. Những gì bản này biết về khung chỉ là **chữ từng nút do bản đối chiếu 05/11 đã đọc bằng Plugin API** (ghi ở mục 5.1, kèm nodeId nhóm/khung đã có trong bản đối chiếu). Việc Figma còn nợ (frame mới, ghi chú cạnh 607:218 và 607:491) liệt kê ở **mục 5.6** để người có công cụ Figma làm trước bước giao diện; nodeId đã sửa/thêm do người đó điền vào bảng 5.6 sau khi làm.

---

## 0. Quyết định của chủ và cái gì đổi so với BU-02

Chủ chốt: cây Phần › Chương › Bài bắt gia sư tạo chương dù chỉ có "Phần 1" rồi vào bài → **bỏ**. Làm danh sách phẳng, mỗi mục có KIỂU + TRẠNG THÁI, thêm thẳng vào lớp, chương chỉ để nhóm tuỳ chọn, video chỉ gắn link YouTube.

| Hạng mục | BU-02 (đã gộp) | BU-02-PHẲNG |
|---|---|---|
| Đơn vị hiển thị | Bài (có nhiều mục con) trong cây 3 cột | **Mục = một `Lesson`** trong danh sách phẳng một cột. Mục mới luôn có đúng 1 nội dung. Bài cũ nhiều nội dung hiện **một hàng**, mở rộng ra thấy các nội dung kèm theo (4.1) |
| Chương/Phần | Bắt buộc, tự tạo "Phần 1 › Chương 1" | Tuỳ chọn. "Thêm chương" là nút phụ ở đầu trang. Mục không nhóm nằm trong **chương ngầm** (3) |
| Trạng thái từng mục | Không có | `Nháp · Đã đăng · Ẩn` (cột mới `Lesson.status`) + `Đang tải` (chỉ phía trình duyệt, không lưu) |
| Mục mới | tạo xong là học sinh thấy ngay | **Nháp**, đăng bằng một chạm (mục 6) |
| Video | tải tệp khi bật cờ; cờ tắt thì hiện báo tắt | Gia sư **chỉ gắn link YouTube**. **Không hiện** giao diện tải video, không đọc `config.video` (4.3) |
| Cột phải "Thông tin bài" | cố định | Ngăn kéo "Sửa" (5) |
| Mũi tên đổi thứ tự, ô bản quyền, "Xem như học sinh" | có | **Giữ cả ba** (khung không có hai thứ đầu, lý do ở 5.5) |

---

## 1. Vấn đề và bằng chứng (tệp:dòng trên `origin/main` lúc viết)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| P1 | Gia sư bị ép qua cây ba cột. Lớp trống: ô tải lên nói "KiN sẽ tự tạo Phần 1 › Chương 1" — tức chương là chuyện bắt buộc, chỉ là máy tự làm hộ. Thêm bài thủ công phải bấm "+ Bài" trong từng chương. | `components/tutor/giao-trinh/GiaoTrinh.tsx:152` (`const tree`), `:209`, `:212`; `OTaiLen.tsx:30`, `:294`; `lib/giaoTrinhServer.ts:132-150` (tạo "Phần 1"/"Chương 1"); `prisma/schema.prisma` `Lesson.chapterId String` bắt buộc (`:197`), `Chapter.sectionId` bắt buộc (`:171`) |
| P2 | **Không có trạng thái nháp/ẩn nào ở bài.** Bài nào vừa tạo là học sinh đã ghi danh thấy ngay (`GET /api/courses/[id]` mở khoá hết cho người `hasAccess`). Gia sư không có chỗ soạn dở. | `schema.prisma:179-205` (`Lesson` chỉ có `isLocked`, `isFree`); `api/courses/[id]/route.ts:64-70`; `api/chapters/[id]/lessons/route.ts:54` (`isLocked ?? true`, không có trạng thái) |
| P3 | `isLocked` KHÔNG phải nháp: người đã ghi danh luôn thấy mở (`isLocked:false` ép ở `courses/[id]/route.ts:64-70` và `lessons/[id]/context/route.ts:82`). Không thể dùng cột có sẵn để giấu bài với học sinh. | như trên |
| P4 | Giao diện tải video vẫn nằm trong giao diện gia sư (cờ tắt thì hiện câu "chưa bật", cờ bật thì hiện ô xác nhận). Chủ không bật tải video. | `OTaiLen.tsx:69,137,222,238,305-311`; `lib/giaoTrinh.ts:176-184` (`routeInput` nhận tệp video), `GiaoTrinhSnapshot.config.video` (`giaoTrinh.ts:23`); `components/media/TutorLessonMedia.tsx:101` (`VideoUploadBox`, dùng trong tab Chương bài cũ) |
| P5 | Ô video nhận cả Vimeo, Zoom bản ghi, Drive: không khớp "video chỉ là link YouTube". Link Drive `/file/d/` hiện xếp vào Video dù thường là PDF. | BU-02.md bảng 4.3; `lib/giaoTrinh.ts:215` (`routeToSlot`) |
| P6 | Mọi đường học sinh/khách đọc bài hiện KHÔNG lọc trạng thái (vì chưa có). Thêm cột mà quên một đường là lộ bài nháp. Có hai đường đọc rộng sẵn: `GET /api/lessons/[id]/assignments` cho **bất kỳ ai đăng nhập** và kho tài liệu công khai cho khách. | `api/lessons/[id]/assignments/route.ts:13-18` (chỉ `requireSession`); `lib/libraryKhoServer.ts:14-27` (`isFree` là điều kiện duy nhất); danh sách đầy đủ ở 4.4 |
| P7 | Tệp tài liệu lấy bằng "bài tham chiếu" (`Lesson.documents` chứa mã): bài nháp vẫn là bài tham chiếu hợp lệ ⇒ học sinh đoán/được chia sẻ mã vẫn tải được tệp của bài nháp. | `api/media/[id]/file/route.ts:31-48`; `api/media/[id]/stream/route.ts:25-35` |
| P8 | Nhân bản bài/khoá dựng dữ liệu tường minh nên **không tự thừa kế cột mới**; không sửa thì nhân bản nháp thành "Đã đăng". | `api/courses/[id]/duplicate/route.ts` (7 chỗ `lesson/chapter/section`); `components/tutor/giao-trinh/useGiaoTrinh.ts:131-145` (`duplicateLesson`) |

---

## 2. Phạm vi tệp (không trùng nhau)

**C** = tut-code (mọi `route.ts`, `src/lib/**` thuần và server). **D** = tut-dev (`.tsx`, hook). **T** = tut-test (chỉ `tools/local-e2e/**`). **XIN** = ngoài phòng ⇒ mục 10. tut-dev chỉ `import type` từ `src/lib/giaoTrinh.ts`, `lessonStatus.ts`; không mở `route.ts`, `src/lib/*`.

### 2.1 tut-code
| Tệp | Việc |
|---|---|
| `src/lib/lessonStatus.ts` (**mới**, thuần) | `LessonStatus`, `isLessonStatus`, `isLearnerVisible`, `canTransition`, `publishBlockFor`, `PUBLISHED_ONLY`, `pruneTreeForViewer` (4.1) |
| `src/lib/giaoTrinh.ts` | kiểu `GtEntry`/`GtGroup`/`GiaoTrinhSnapshot` mới, `buildEntries`, `entryKind`, `moveEntry`, `isGenericTree`; `routeInput` bỏ video-tệp, video chỉ YouTube; bỏ `GtLesson`, `config.video` (4.1, 4.3). `deriveItems`, `placeItem`, `itemKey`, `mergeLibrary` giữ |
| `src/lib/giaoTrinhServer.ts` | `loadGiaoTrinh` trả snapshot mới; `addItem` tạo mục mới ở chương ngầm, mặc định `draft`; `setStatus`, `setStatusBulk`, `moveToGroup`, `createGroup`, `renameGroup`, `ungroup` (4.2); bỏ tạo "Phần 1 › Chương 1" cứng |
| `src/lib/tutorLibraryServer.ts` | đích "Dùng ở lớp khác" = lớp ▸ "mục mới" hoặc mục có sẵn; `LibUse` thêm `status` |
| `src/app/api/tutor/lop/[courseId]/giao-trinh/route.ts` | G1 trả snapshot mới |
| `.../giao-trinh/muc/route.ts` | G2 mở rộng, G3 giữ |
| `.../giao-trinh/bai/[lessonId]/route.ts` (**mới**) | G4 `PATCH` đổi trạng thái / chuyển nhóm |
| `.../giao-trinh/trang-thai/route.ts` (**mới**) | G5 `PATCH` đổi trạng thái hàng loạt |
| `.../giao-trinh/chuong/route.ts`, `chuong/[chapterId]/route.ts` (**mới**) | G6 tạo chương, đổi tên, bỏ nhóm |
| `src/app/api/courses/[id]/route.ts` | lọc trạng thái trong `GET` (R1) |
| `src/app/api/courses/[id]/duplicate/route.ts` | chép `status`, `isImplicit` (P8) |
| `src/app/api/courses/[id]/reorder/route.ts` | không đổi mã; thêm test (đường sắp xếp phẳng dùng nó) |
| `src/app/api/lessons/[id]/route.ts`, `.../context/route.ts`, `.../assignments/route.ts`, `.../azota-done/route.ts` | lọc trạng thái (R2, R3, R5, R6). `PUT` **bỏ qua** khoá `status` (whitelist `allowed` không thêm) |
| `src/app/api/chapters/[id]/lessons/route.ts` | nhận `status:"draft"` (chỉ giá trị này; mọi giá trị khác ⇒ mặc định `published`, hành vi tab Chương bài cũ không đổi) |
| `src/app/api/media/[id]/file/route.ts`, `.../stream/route.ts` | bài tham chiếu phải `published` với người không phải quản lý lớp (R20) |
| `src/lib/lessonVisibility.ts` (**mới**, có DB) | `learnerLessonWhere`, `managerOf(session, ownerId)` dùng chung cho các route trên |

### 2.2 tut-dev
| Tệp | Việc |
|---|---|
| `src/components/tutor/giao-trinh/GiaoTrinh.tsx` | **viết lại**: một cột, danh sách phẳng (5) |
| `.../giao-trinh/OTaiLen.tsx` | bỏ toàn bộ nhánh video-tệp (`videoOk`, `VIDEO_UPLOAD_NOTICE`, `VIDEO_EXTS`, `vid.*`, `data-gt-video-xac-nhan`); thêm chip "Nhận diện: YouTube ✓" và dải nguồn; ô "Đăng ngay" |
| `.../giao-trinh/useGiaoTrinh.ts` | trạng thái phẳng; gọi G4–G6; sắp xếp bằng `moveEntry`; `duplicateLesson` tạo bản **nháp** |
| `.../giao-trinh/MucHang.tsx`, `NganKeoSua.tsx`, `ChipTrangThai.tsx`, `ThemChuong.tsx` (**mới**) | hàng mục, ngăn kéo sửa, chip trạng thái, form thêm chương |
| `.../giao-trinh/XemNhuHocSinh.tsx` | banner khi mục là Nháp/Ẩn (5.3) |
| `.../giao-trinh/ThuVienCuaToi.tsx` | đích "Dùng ở lớp khác" mới; chip trạng thái |
| `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/giao-trinh/page.tsx`, `.../xem/[lessonId]/page.tsx` | chỉ sửa nếu kiểu snapshot đổi; cổng `redirectIfNotTutor` giữ |

### 2.3 tut-test
`tools/local-e2e/`: `t-giao-trinh-lib`, `t-lesson-status-lib` (mới), `t-giao-trinh`, `t-lesson-visibility` (mới, bảng kẻ tấn công 8.2), `t-media-api`, `t-media-security`, `t-thu-vien`, `ui-giao-trinh`, `ui-thu-vien-gia-su`. Không sửa `h.ts`, `wipe`, `tutor-world.ts` (xin COO nếu cần dữ liệu mẫu có nháp: mục 10-D8).

### 2.4 Ngoài phòng ⇒ mục 10
`prisma/schema.prisma` (cột mới, chỉ-thêm); `api/progress/**`, `api/lesson-notes/**`, `api/assignments/**`, `api/deadlines`, `api/enrollments`; `lib/studentSchedule.ts`, `libraryServer.ts`, `libraryKhoServer.ts`, `studentTodoServer.ts`, `monthlyReportServer.ts`; `components/media/TutorLessonMedia.tsx`; `(student)/**` và `components/student/**` (ẩn tiêu đề phần/chương ngầm); `admin/khoa-hoc/[id]/page.tsx`, `admin/thi-thu/**`; `notify.ts`, `hostRouting.ts`, vỏ. Không đụng `feeCharge*`, `invoiceServer*`, `sessionBook*`.

---

## 3. Schema — chỉ thêm

Quyết định: **ba cột mới, đều có mặc định, không đổi cột nào có sẵn, không bảng mới.**

```prisma
model Section {
  // … cột cũ giữ nguyên
  isImplicit Boolean @default(false)   // "Phần ngầm": chỉ để Chapter có chỗ treo (Chapter.sectionId bắt buộc). Giao diện không hiện tiêu đề Phần này.
}
model Chapter {
  // … cột cũ giữ nguyên
  isImplicit Boolean @default(false)   // "Chương ngầm": các bài trong đó hiện KHÔNG nhóm. Mỗi lớp có tối đa MỘT chương ngầm.
}
model Lesson {
  // … cột cũ giữ nguyên
  status String @default("published")  // "draft" | "published" | "hidden". Cùng kiểu chuỗi như Lesson.type / Exam.status; không dùng enum Prisma.
}
```

**Vì sao chọn vậy**
- `Lesson.status` là một chuỗi có mặc định `"published"`. Postgres `ADD COLUMN … NOT NULL DEFAULT` điền mọi hàng cũ thành `published` ngay trong lệnh `ALTER`, nên **mọi bài cũ thành "Đã đăng", không mất hiển thị, không cần script backfill**. Mặc định ở tầng DB (không chỉ ở tầng mã) cũng giữ nguyên hành vi của mọi nơi đang `INSERT` bài mà không biết cột mới (tab Chương bài cũ của trang quản trị, `duplicate`, seed của test).
- Không dùng `publishedAt/hiddenAt` (hai cột nullable): cần suy ra trạng thái từ cặp thời điểm, dễ lệch; chỉ một cột chuỗi là nguồn sự thật duy nhất. Không dùng enum Prisma: đổi giá trị về sau là migration phá, ngược cách repo đang làm với `Lesson.type`.
- Không đặt `Lesson.chapterId` thành tuỳ chọn: đó là đổi cột có sẵn từ bắt buộc sang tuỳ chọn (phá `include: { chapter: … }` ở rất nhiều chỗ đọc `lesson.chapter.section.courseId`, ví dụ `assignments/[id]/submit/route.ts:30`, `deadlines/route.ts:65`, `progress/[lessonId]/route.ts:35`). Thay vào đó **mọi bài vẫn có chương**; bài "không chương" = bài trong **chương ngầm** của **phần ngầm**. Mọi truy vấn cũ `chapter: { section: { courseId } }` chạy y nguyên.
- Cần cờ ở **cả** `Section` và `Chapter`: Phần ngầm để không hiện tiêu đề Phần; Chương ngầm để phân biệt "chưa nhóm" với các **chương có tên** mà "Thêm chương" tạo ra (các chương có tên cũng nằm trong phần ngầm, vì `Chapter.sectionId` bắt buộc). Chỉ một cờ ở `Section` không phân biệt được hai loại chương này.
- Tiêu đề lưu trong DB của hai hàng ngầm: Phần = `"Nội dung lớp"`, Chương = `"Bài học"`. Giao diện học sinh hiện tại (`apiAdapters.ts`, `KhoaHocChiTiet.tsx`, `LopCuaToi.tsx`) vẽ tiêu đề Phần/Chương: nếu stu-dev chưa kịp ẩn theo cờ thì học sinh thấy "Nội dung lớp › Bài học" — vẫn đọc được, không lỗi (mục 10-D3). Cờ `isImplicit` đi ra JSON công khai mà không cần sửa API vì `include` trả đủ cột vô hướng; nó không phải thông tin nhạy cảm.

**Lớp đang dùng cây cũ phải hiển thị đúng, không mất dữ liệu, bài không chương vẫn hiển thị**
1. Không hàng nào bị đổi. Mọi `Section`/`Chapter` cũ có `isImplicit=false`; mọi `Lesson` cũ có `status="published"`.
2. Lớp cũ nhiều phần/chương ⇒ danh sách phẳng hiện **nhóm** theo từng chương, tiêu đề nhóm là `"{Phần} · {Chương}"` (cùng cách `libraryServer.ts:50` gộp). Không mục nào mất.
3. **Lớp ở trạng thái "chung"** = đúng 1 phần tên `Phần 1`, đúng 1 chương tên `Chương 1`, cả hai `isImplicit=false` (đúng thứ cây cũ tự tạo, `giaoTrinhServer.ts:145`): đọc ra là **không nhóm** (hàm thuần `isGenericTree`), không ghi gì vào DB. Gia sư đã đổi tên Phần/Chương thì không còn "chung", hiện như nhóm bình thường.
4. Bài mới không nhóm đi vào **chương không nhóm của lớp** (`pickUngroupedChapter`): ưu tiên chương `isImplicit`; không có thì chương trong cây "chung" (3); không có nữa thì tạo phần ngầm + chương ngầm (`order` nhỏ nhất ⇒ đứng đầu). Nhờ vậy một lớp luôn có **tối đa một** chương không nhóm.
5. "Thêm chương" ở lớp "chung": trong cùng giao dịch, đặt `isImplicit=true` cho phần + chương "Phần 1/Chương 1" cũ (bài cũ thành "không nhóm", không đổi `chapterId`), rồi tạo chương có tên trong phần ngầm. Chỉ lật cờ, không dời bài.
6. Quay lui: mã cũ bỏ qua ba cột ⇒ bản deploy cũ vẫn chạy; riêng việc học sinh thấy bài nháp quay lại (bài `draft` hiện như đã đăng) — **nên không rollback sau khi gia sư đã dùng nháp**, ghi vào mô tả PR.

**Cách áp schema trong repo này.** `scripts/db-push-on-production.mjs` chạy `prisma db push` lúc build **chỉ ở production** (preview bỏ qua, trừ `PREVIEW_OWN_DB=1`); `scripts/db-push-guard.mjs` chỉ tự chấp nhận cảnh báo "thêm ràng buộc duy nhất". Thêm cột có mặc định **không phát cảnh báo mất dữ liệu nào** nên qua cổng mà không cần `PRISMA_ACCEPT_DATA_LOSS`. Hệ quả cần biết:
- Preview dùng chung DB production nhưng không `db push`: bản preview của nhánh này **sẽ lỗi `P2022 column does not exist`** ở mọi truy vấn đọc `status` cho tới khi production đã build bản có schema. Cách làm: COO gộp **một PR chỉ có `schema.prisma`** (3 cột) vào `main` trước, đợi production build xong, rồi mới gộp PR mã. Test local dùng DB `kin_test` nên không vướng.
- Thêm test `t-giao-trinh-lib` ca "schema": đọc `prisma/schema.prisma` và khẳng định `status String @default("published")`, hai `isImplicit Boolean @default(false)` (khoá việc backfill ngầm bằng mặc định; ai bỏ mặc định thì đỏ).
- Không thêm index (bảng `lessons` nhỏ, mọi truy vấn lọc theo `chapterId` đã có quan hệ).

---

## 4. Hợp đồng

Quy ước chung (như BU-02): 401 chưa đăng nhập; **403 mọi trường hợp không phải gia sư đã duyệt** (học sinh, quản trị, **gia sư chờ duyệt**) bằng `requireCourseTutor` → `requireTutorOnly`; 404 lớp/bài không tồn tại **hoặc không thuộc lớp trong đường dẫn**; 403 lớp của người khác. `Cache-Control: private, no-store`. Form ⇒ 303 + `?ok=1|loi=<mã>`; JSON chỉ khi client gửi `Content-Type: application/json`. Không có tên học sinh ở bất kỳ câu trả lời nào của mục 4.2.

### 4.1 Thư viện thuần

**`src/lib/lessonStatus.ts`** (không React, không DB) — test `t-lesson-status-lib`:
```ts
export const LESSON_STATUSES = ["draft", "published", "hidden"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export const isLessonStatus = (v: unknown): v is LessonStatus => typeof v === "string" && (LESSON_STATUSES as readonly string[]).includes(v);
/** ĐÓNG KHI LẠ: chỉ đúng chuỗi "published" mới là học sinh/khách thấy được. null, "", "Published", giá trị chưa biết ⇒ false. */
export const isLearnerVisible = (status: unknown): boolean => status === "published";
export const PUBLISHED_ONLY = { status: "published" } as const;           // mảnh `where` Prisma dùng ở mọi truy vấn của người học
export function canTransition(from: LessonStatus, to: LessonStatus): boolean;   // bảng ở mục 6
export function publishBlockFor(entry: { items: { broken: boolean }[]; selfSubmitCount: number }): string | null;  // null = đăng được
/** Bản sao cây với chỉ bài published; chương/phần ĐÃ CÓ bài nhưng bị lọc hết thì bỏ luôn (không lộ tên chương chỉ có bài nháp). Chương/phần trống sẵn từ trước giữ nguyên. Người quản lý lớp ⇒ trả nguyên. */
export function pruneTreeForViewer<T extends { sections: { chapters: { lessons: { status: unknown }[] }[] }[] }>(tree: T, isManager: boolean): T;
```
**`src/lib/giaoTrinh.ts`** — thay kiểu snapshot (test `t-giao-trinh-lib`, cập nhật các ca đang dùng `sections`/`GtLesson`):
```ts
export type ItemKind = "video" | "document" | "assignment" | "live" | "exam";  // nhãn: Video · Tài liệu · Bài tập · Buổi live · Kiểm tra (khớp khung)
export interface GtEntry {             // MỘT MỤC = một Lesson
  id: string; title: string;
  kind: ItemKind;                      // entryKind(items): video > live > assignment > document; không nội dung ⇒ "document" + publishBlock
  status: LessonStatus;
  chapterId: string;                   // chương thật chứa bài (kể cả chương ngầm) — dùng cho reorder
  groupId: string | null;              // null = không nhóm (chương ngầm / cây "chung"); còn lại = chapterId của nhóm có tên
  isLocked: boolean; isFree: boolean; duration: string | null; azotaDeadline: string | null;
  items: GtItem[];                     // mục mới: đúng 1 phần tử. Bài cũ: ≥1. Phần tử "chỉ đếm" (Bài tập tự nộp) có url null
  selfSubmitCount: number;
  publishBlock: string | null;         // null = đăng được; còn lại là câu tiếng Việt vì sao chưa đăng được
}
export interface GtGroup { id: string; title: string }   // chương có tên, theo thứ tự cây. Rỗng = lớp không dùng nhóm ⇒ không vẽ tiêu đề nào
export interface GiaoTrinhSnapshot {
  courseId: string; courseName: string;
  entries: GtEntry[];                  // đã sắp theo (section.order, chapter.order, lesson.order): khối không nhóm trước, rồi từng nhóm
  groups: GtGroup[];
  exams: GtItem[];                     // Exam của lớp, chỉ đọc; trạng thái là của Exam (mục 6.4), không phải LessonStatus
  counts: { draft: number; published: number; hidden: number };
  config: { document: { enabled: boolean; reason: string | null; maxBytes: number; quotaBytes: number; usedBytes: number; exts: string[] } };  // KHÔNG còn `video`
}
export function buildEntries(sections: TreeSection[], extra: { assignmentsByLesson: Record<string, number> }): { entries: GtEntry[]; groups: GtGroup[] };
export function isGenericTree(sections: TreeSection[]): boolean;                  // quy tắc 3 ở mục 3
export function pickUngroupedChapter(sections: TreeSection[]): { chapterId: string } | null;   // quy tắc 4 ở mục 3; null ⇒ phải tạo
export function entryKind(items: GtItem[], selfSubmitCount: number): ItemKind;
/** ▲▼ trong cùng một nhóm. Trả payload cho PATCH /api/courses/[id]/reorder, hoặc ok:false ở mép (nút bị vô hiệu). */
export function moveEntry(entries: readonly GtEntry[], id: string, dir: -1 | 1): { ok: true; type: "lesson"; items: { id: string; order: number; parentId: string }[] } | { ok: false };
```
`deriveItems`, `placeItem`, `removeItem`, `itemKey`, `docTypeOf`, `mergeLibrary`, `lessonTypeFor` giữ nguyên chữ ký. Gỡ `GtLesson` và `config.video`.

### 4.2 API

| # | Route | Vào | Ra / lỗi |
|---|---|---|---|
| **G1** | `GET /api/tutor/lop/[courseId]/giao-trinh` | — | 200 `GiaoTrinhSnapshot` (mới). Chủ lớp thấy cả `draft`/`hidden`. 401/403/404 như quy ước |
| **G2** | `POST .../giao-trinh/muc` | JSON `{ url, name?, slot?, chapterId?, lessonId?, publish?: boolean, from?: "library" }`. `url` là link https hoặc `/api/media/<id>/file`. **Không có `lessonId`** ⇒ tạo MỤC MỚI (một `Lesson`) trong `chapterId` (nếu có và thuộc lớp) hoặc chương không nhóm; `status = publish ? "published" : "draft"` (mặc định **draft**). **Có `lessonId`** ⇒ gắn thêm vào mục có sẵn (không đổi `status`) | Một giao dịch + khoá advisory (`course_tree:<id>` khi tạo mục/chương ngầm, `lesson:<id>` khi gắn). 201 `{ item, lessonId, status, created: { lesson }, warning }`; 200 `{ duplicate:true }`. 400: link sai / vượt `MAX_LINKS` 20 / `MAX_DOCUMENTS_PER_LESSON` 30 / **video không phải YouTube** / tệp video (4.3); 403: lớp người khác, hoặc `/api/media/<id>/file` mà `FileAsset.ownerId` không phải mình; 404: `lessonId`/`chapterId` không thuộc `[courseId]` (kiểm khoá ngoại, không tin id client). Link sai **không tạo gì** (kể cả không tạo chương ngầm) |
| **G3** | `DELETE .../giao-trinh/muc` | `{ lessonId, key }` | như BU-02 (gỡ hai lần vẫn 200; không xoá `FileAsset`) |
| **G4** | `PATCH .../giao-trinh/bai/[lessonId]` | `{ status?: LessonStatus, groupId?: string \| null }` (ít nhất một) | 200 `{ id, status, groupId }`. 400 giá trị lạ (`status:"Published"`, `groupId:""`); 404 bài hoặc nhóm không thuộc lớp; 403 lớp người khác; **409** chuyển trạng thái không hợp lệ (`canTransition`) hoặc `publishBlockFor` ≠ null, kèm `error` tiếng Việt. `groupId:null` = đưa về không nhóm. `status` bằng trạng thái hiện tại ⇒ 200, không ghi (idempotent) |
| **G5** | `PATCH .../giao-trinh/trang-thai` | `{ lessonIds: string[] (1–100), status }` | 200 `{ changed: string[], skipped: { id, reason }[] }`. Có id không thuộc lớp ⇒ **404 và không ghi gì**. Mỗi id đi qua cùng luật G4; id không đổi được vào `skipped` (không làm hỏng cả lô) |
| **G6** | `POST .../giao-trinh/chuong` · `PATCH .../chuong/[chapterId]` · `DELETE .../chuong/[chapterId]` | `{ title }` (1–120 ký tự) | POST 201 `{ id, title }` (tạo trong phần ngầm; nếu lớp "chung" thì lật cờ ngầm theo quy tắc 5 mục 3). PATCH đổi tên: 200. DELETE = **"Bỏ nhóm"**: mọi mục trong chương chuyển về chương không nhóm rồi xoá chương **trống**; không bao giờ xoá `Lesson`. 404/403 như trên; chương ngầm ⇒ 400 "Đây không phải nhóm" |
| Form | `POST .../muc` kiểu form | `url`, `chapterId?`, `lessonId?` | 303 → `.../giao-trinh?ok=1&lessonId=…` hoặc `?loi=link\|gioi-han\|quyen` |
| (có sẵn) | `PATCH /api/courses/[id]/reorder` | `{ type:"lesson", items:[{id,order,parentId}] }` | dùng cho ▲▼ (đã vá V6: mục + `parentId` phải thuộc lớp, sai ⇒ 403, không ghi). `type:"chapter"` sắp xếp nhóm |
| (có sẵn) | `PUT /api/lessons/[id]` | `title`, `duration`, `isLocked`, `isFree`, `azotaDeadline` … | **bỏ qua `status`** (không có trong `allowed`): trạng thái chỉ đổi bằng G4/G5 để luật chuyển trạng thái không bị đi vòng |
| (có sẵn) | `POST /api/chapters/[id]/lessons` | thêm `status?` | chỉ nhận `"draft"`; khác ⇒ `published` (tab Chương bài cũ giữ hành vi). Màn mới dùng nó cho "Nhân bản" với `status:"draft"` |
| (có sẵn) | `loadLessonPreview` (Xem như học sinh) | — | thêm `status` vào kết quả |

G4 phải: (a) tải bài kèm `chapter.section.{courseId}` rồi so với `[courseId]` — id lạ/ở lớp khác ⇒ 404; (b) khoá advisory `lesson:<id>`; (c) đọc `status` hiện tại trong giao dịch rồi mới kiểm `canTransition`, tránh đua ghi.

### 4.3 Video chỉ là link YouTube (đổi `routeInput`, `placeItem`, `addItem`)

- Không còn nhánh tải tệp video: `routeInput({file})` với đuôi `mp4|webm|mov|m4v` ⇒ `{ ok:false, error:"KiN không nhận tệp video. Hãy đăng video lên YouTube (Không công khai) rồi dán link vào đây." }` — **bất kể cờ**; `routeInput` không còn đọc `cfg.video`.
- Ô video chỉ nhận `kind === "youtube"` (watch, youtu.be, shorts, embed, live). Vimeo, bản ghi Zoom, `kin-media:<mã>` ⇒ 400 `"Video chỉ nhận link YouTube. Đăng video lên YouTube (Không công khai) rồi dán link."`. Link Drive `/file/d/…`, `open?id=` ⇒ **Tài liệu** (kèm cảnh báo "KiN không biết đây là tệp gì, học sinh mở ở tab mới"), không còn vào ô video.
- Phía máy chủ chặn lại ở `placeItem`/`addItem` (không tin trình duyệt): ô `video` + link không phải YouTube ⇒ 400, cột không đổi — **trừ** khi URL đó đã đúng bằng giá trị đang lưu (dữ liệu cũ của bài cũ, gỡ/trùng vẫn chạy). Dữ liệu video cũ (Vimeo, Drive, `kin-media:`) vẫn hiện và phát bình thường ở phía học sinh; chỉ **thêm mới** bị chặn.
- **Giữ hạ tầng máy chủ**: `api/media/video/*`, `resolveVideoUploadConfig`, `videoUploadConfig`, `claimUploadedVideos`, `stream`, `KIN_VIDEO_UPLOAD` không đổi một dòng. `GET /api/media/config` vẫn trả khối `video` (tab Chương bài cũ còn đọc). Chỉ **giao diện gia sư của màn Giáo trình** thôi không dùng.
- Tab Chương bài cũ (alias của trang quản trị) còn `VideoUploadBox` ⇒ gia sư vẫn nhìn thấy ô tải video ở đó. Đóng nốt cần sửa `components/media/TutorLessonMedia.tsx` (render `null` khi `!config.video.enabled`) — tệp ngoài phòng ⇒ **mục 10-D5**.

### 4.4 MỌI đường đọc bài/cây khoá học của học sinh/khách — lọc trạng thái ở đâu

Ký hiệu: **QL** = quản lý lớp (`isCourseManager`: quản trị cấp 1/nội dung, hoặc gia sư là `ownerId`) — thấy mọi trạng thái; **người học** = học sinh đã ghi danh (`active`/`suspended`/`pending_consent`), học sinh chưa ghi danh, khách, gia sư/quản trị không phải chủ lớp. Chỉ `status === "published"` mới tới người học. Chữ "Chủ" bên cột Tệp: tut-code làm trong nhánh này; "XIN" = tệp ngoài phòng, mục 10.

| # | Đường đọc (tệp) | Ai chạm | Lọc ở đâu / trả gì với bài `draft`·`hidden` | Tệp |
|---|---|---|---|---|
| R1 | `GET /api/courses/[id]` (`api/courses/[id]/route.ts:15-77`) — cây khoá, **mở cho khách** | khách, học sinh, QL | Sau khi nạp cây, `pruneTreeForViewer(tree, isManager)` **trước** `redactCourseTree`/`redactCourseLinks`. Bài bị lọc biến mất khỏi JSON (cả tên); chương/phần chỉ còn bài nháp cũng biến mất. QL thấy đủ, mỗi bài mang `status`. Khoá `status=false` + không có quyền ⇒ 404 như cũ | C |
| R2 | `GET /api/lessons/[id]` (`:17-50`) | học sinh, QL | QL ⇒ như cũ. Quản trị không phải chủ ⇒ 403 như cũ (giữ nguyên *trước* kiểm trạng thái). Còn lại: bài không `published` ⇒ **404** *trước* kiểm ghi danh (không phân biệt "không có" với "nháp") | C |
| R3 | `GET /api/lessons/[id]/context` (`:44-96`) — trang `/student/bai-giang/[lessonId]` chỉ gọi route này | học sinh, khách (qua `isFree`), QL | (a) bài chính không `published` và không phải QL ⇒ 404 *trước* nhánh `isFree`/403; (b) cây `course.sections` trong câu trả lời đi qua `pruneTreeForViewer` như R1 ⇒ bài học xem một bài miễn phí không nhận tên/link bài nháp khác | C |
| R4 | `GET /api/lessons/[id]/assignments` (`api/lessons/[id]/assignments/route.ts:13-48`) — **mở cho bất kỳ ai đăng nhập** | mọi tài khoản đăng nhập | Thêm: nạp `lesson.status` + chủ lớp; không phải QL và không `published` ⇒ 404. (Lỗ có sẵn, ghi P2: route này không kiểm ghi danh cho bài trả phí; ngoài phạm vi, nhưng lọc trạng thái làm bài nháp ít nhất không lộ) | C |
| R5 | `POST/GET /api/lessons/[id]/azota-done` (`:11-62`) | học sinh | `POST`, `GET`: bài không `published` ⇒ 404 *trước* kiểm ghi danh. `DELETE` (xoá dấu của chính mình) giữ nguyên | C |
| R6 | `GET /api/lessons/[id]/azota-status` | gia sư chủ | tệp của QL; không đổi | — |
| R7 | `POST/PATCH /api/progress/[lessonId]` (`api/progress/[lessonId]/route.ts:29-40,103-107`) — **ghi tiến độ + Coin** | học sinh (kể cả bài `isFree`) | bài không `published` ⇒ **404**, không ghi `LessonProgress`, không phát Coin. Cả nhánh `isFree` | XIN (D1) |
| R8 | `GET /api/progress` (`api/progress/route.ts`) | học sinh | `where: { lesson: { status: "published" } }` để `completedIds`/`byCourse`/`positions` không đếm bài đã ẩn. `users/me/stats` và `users/me/activity` **không đổi** (chỉ tổng của chính học sinh, không lộ bài; EXP đã nhận không bị trừ lại) | XIN (D1) |
| R9 | `GET/PUT /api/lesson-notes/[lessonId]` (`:14-45`) — **ghi ghi chú** | học sinh | bài không tồn tại hoặc không `published` ⇒ 404 (cả `GET`, `PUT`). Hôm nay route này **không kiểm ghi danh** (P2 có sẵn, ghi vào mục 9 Q7) | XIN (D1) |
| R10 | `POST /api/assignments/[id]/submit`, `.../answer`, `GET .../results` (`:26-30`, `:27-45`) | học sinh | `submit`/`answer`: `assignment.lesson.status !== "published"` ⇒ 404 *trước* kiểm ghi danh. `results` là của gia sư, không đổi | XIN (D1) |
| R11 | `GET /api/deadlines` (`:29-44`) — hạn Azota | học sinh | thêm `status: "published"` vào `where` của `lesson.findMany` | XIN (D1) |
| R12 | `loadStudentScheduleEvents` (`lib/studentSchedule.ts:103-125`) → `api/schedule`, `api/student/viec-cua-toi` | học sinh | thêm `status: "published"` vào `where` | XIN (D1) |
| R13 | `studentTodoServer.ts:14-26` — bài tập tự nộp trong "Việc của tôi" | học sinh | thêm `lesson: { status: "published" }` | XIN (D1) |
| R14 | `loadStudentLibrary` (`libraryServer.ts:20-80`) → `/thu-vien`, `libraryOwn` (tìm trong thư viện của mình) | học sinh | `lessons: { where: PUBLISHED_ONLY, … }` trong `courseSelect`. **Nhánh gia sư** `loadTutorLibrary` (`libraryServer.ts:83`, thư viện của chủ) không lọc | XIN (D1) |
| R15 | `loadPublicDocs` (`libraryKhoServer.ts:14-27`) → `/thu-vien` công khai, `api/thu-vien/tim` — **kho cho khách** | khách | điều kiện cũ `isFree` **thêm** `status: "published"`: bài miễn phí còn nháp không được công khai tài liệu. Đây là chỗ lộ nặng nhất nếu sót | XIN (D1) |
| R16 | `monthlyReportServer.ts:76-112` → báo cáo tháng, cổng phụ huynh `api/parent-portal/[token]`, sổ điểm | phụ huynh, học sinh | `lesson.findMany` và `assignment` đếm: thêm `status: "published"` (mẫu số "video/Azota của lớp") | XIN (D1) |
| R17 | `api/enrollments` (`:25-31`) — `lessonCount` | học sinh | `_count: { select: { lessons: { where: PUBLISHED_ONLY } } }` | XIN (D1) |
| R18 | `GET /api/media/[id]/file` (`:31-48`), `GET /api/media/[id]/stream` (`:25-35`) | học sinh, khách | `select` thêm `status`; hàm `mayWatch(l)` trả `false` nếu `!isLearnerVisible(l.status)` và người xem không phải QL của lớp chứa bài. Gỡ khỏi hết bài **published** ⇒ 403 như BU-02. Tệp ở một bài nháp **và** một bài đã đăng của lớp khác ⇒ vẫn mở được qua bài đã đăng | C |
| R19 | `POST /api/courses/[id]/duplicate` | gia sư chủ | chép `status`, `isImplicit` của Phần/Chương/Bài; bài nháp ⇒ bản sao nháp | C |
| R20 | Các đường **của gia sư** đọc bài: G1, `loadLessonPreview`, `tutorLibraryServer`, `baiTapServer`, `tutorStudentDetailServer`, `ban-ghi/page.tsx` (chỉ gia sư/quản lý), `api/courses/[id]/students` | QL | **không lọc** (cần thấy nháp); chỉ trả kèm `status` khi giao diện cần. Không đường nào trong nhóm này nhận học sinh (đã kiểm: `ban-ghi` đẩy học sinh sang `/student/hoc-tap`, `page.tsx:23`) | — |
| R21 | `api/cron/*`, `lib/notify.ts`, `api/tra-cuu`, `api/followed-courses`, `courseCatalogPublicServer.ts`, `api/admin/students`, `honor-leaderboard` | — | đã `grep`: không đọc `Lesson` (chỉ `Course.lessons` là số gõ tay) ⇒ **không đổi**. `statsMaterials/statsVideos/statsViews` cũng là số gõ tay | — |

Ghi chú xử lý: `learnerLessonWhere(isManager)` trong `lessonVisibility.ts` trả `{}` cho QL, `PUBLISHED_ONLY` cho người học — mọi chỗ **truy vấn** dùng nó (không tự viết lại chuỗi `"published"`); mọi chỗ **trả cây** dùng `pruneTreeForViewer`. Test kẻ tấn công ở 8.2 phải đi qua **từng dòng R1–R18** bằng bài thật.

---

## 5. Luồng màn (1280 và 390; ba trạng thái)

Token: `--kin-nen-trang`, `--kin-nen-bang`, `--kin-vien-thuong`, `--kin-tt-chu-xong|cho|loi`, `--kin-kc-*`, `--kin-bo-the`; **không hex** (`t-no-hex`); nút ≥44px; giọng KiN: câu ngắn, gọi "bạn", báo việc đã/chưa xảy ra, không hứa hão.

### 5.1 Chữ trong khung Figma (nguồn: bản đối chiếu 05/11, đọc bằng Plugin API; **chưa xác minh lại trực tiếp trong phiên này**)
Khung 607:218 (máy tính), 607:491 (điện thoại), nhóm 606:5, trang "Bigupdate (11/2026)" 606:2, file `2orXvoHL2upkiGoMjlq8aX`:
- Bố cục một cột: ô thả tệp ở trên, danh sách bên dưới nối nhau.
- Mỗi mục: nhãn kiểu `VIDEO / TÀI LIỆU / BÀI TẬP / KIỂM TRA / BUỔI LIVE`; trạng thái `Đã đăng / Nháp / Đang tải`; nút `Sửa` / `Ẩn`.
- Dòng ghi chú "mục Nháp chỉ gia sư thấy"; nút `Thêm chương` ở đầu trang; nút `Xem như học sinh`.
- Ô tải lên: chip `Nhận diện: YouTube ✓`; dải nguồn `YouTube · Google Drive · Vimeo · Zoom · Azota · PDF · Word · Ảnh`.
- Ba tab `Giáo trình / Lịch / Học viên`. Điện thoại: thanh dưới `Hộp việc / Lịch / Lớp / Học phí`.
- Khung **không có**: mũi tên đổi thứ tự, ô xác nhận bản quyền, hạn mức tệp, "Thư viện của tôi".
Id từng nút chưa có trong bản đối chiếu ⇒ **không ghi ở đây**; người đọc Figma thêm vào bảng 5.6.

### 5.2 Màn Giáo trình `/lop-cua-toi/quan-lop/<id>/giao-trinh` (dải tab của lớp có "Giáo trình")
**Bố cục khác BU-02: bỏ cây 320px và bảng thông tin 300px; một cột đọc (tối đa ~960px), đúng như khung.**

**1280 (từ trên xuống):**
1. `KinPageHeader`: "Giáo trình" · tên lớp · bên phải: `Thêm chương` (nút phụ, `secondary`) và `Xem như học sinh` (`secondary`).
2. **Ô tải lên chung** (BU-02 5.1, bỏ phần video): vùng thả/dán, dòng nhỏ "PDF, Word, Excel, PowerPoint, ảnh · tối đa 25 MB mỗi tệp · còn X MB trong kho của bạn · **Video: dán link YouTube**"; chip nhận diện (`Nhận diện: YouTube ✓ · sẽ thêm vào Video`; lỗi đỏ tại chỗ nếu link sai; Vimeo/Zoom-bản-ghi báo "Video chỉ nhận link YouTube"); dải nguồn chỉ liệt kê loại **nhận được**: `YouTube · Google Drive · Zoom (phòng học) · Meet · Azota · Google Form · PDF · Word · Excel · PowerPoint · Ảnh` (khác khung: bỏ Vimeo, vì chủ chọn YouTube; Zoom ở đây là link *buổi live*); ô xác nhận bản quyền (một lần/phiên, `COPYRIGHT_PLEDGE_LABEL`); công tắc "Đăng ngay cho học sinh" (tắt mặc định; bật ⇒ `publish:true`). Mỗi link/tệp = **một mục mới** (thả 3 tệp ⇒ 3 mục). Lựa chọn phụ "Gắn vào mục có sẵn" (danh sách chọn các mục) cho trường hợp một video + tài liệu kèm.
3. Dải lọc: `Tất cả n · Nháp n · Đã đăng n · Ẩn n` (chip, `counts` từ snapshot) và dòng nhắc "Mục Nháp và Ẩn chỉ gia sư thấy. Học sinh chỉ thấy mục Đã đăng." Nút "Đăng tất cả mục Nháp (n)" hiện khi có nháp đăng được (G5).
4. **Danh sách phẳng**. Không nhóm ⇒ không tiêu đề. Có nhóm ⇒ khối "Chưa nhóm" (nếu có) rồi từng nhóm với tiêu đề + nút `Đổi tên` / `Bỏ nhóm`. Mỗi hàng (≥56px cao):
   `[▲][▼]` · biểu tượng + nhãn kiểu · **tên mục** (+ dòng phụ: nguồn "YouTube" / "Tệp trên KiN · 2,4 MB" / "+2 nội dung kèm") · chip trạng thái · `Sửa` · hành động chính theo trạng thái (`Đăng` khi Nháp; `Ẩn` khi Đã đăng; `Hiện lại` khi Ẩn) · `⋯` (Xem như học sinh · Nhân bản · Chuyển nhóm · Xoá).
   Hàng có cảnh báo (link cũ hỏng, link lạ) hiện dòng cảnh báo `--kin-tt-chu-cho|loi` dưới tên, **không** làm hỏng hàng.
   Hàng "Đang tải": chỉ ở trình duyệt; thanh tiến trình, nút `Huỷ`; xong thì thành mục **Nháp**.
5. Cuối: "Bài kiểm tra của lớp · n" (chỉ đọc, mở đề qua `contentHref` ⇒ `/lop-cua-toi/de-thi/<id>`; chip là trạng thái của `Exam`: Sắp mở / Đang mở / Đã đóng, **không phải** Nháp/Đã đăng; không có nút Ẩn/Đăng) và dòng kho tài liệu `đã dùng X / Y`. Mục Bài tập tự nộp: chip "Bài tập tự nộp: n" + liên kết "Soạn ở tab Chương bài" (BU-02 V12 giữ).
6. **Ngăn kéo "Sửa"** (bên phải 400px ở 1280): tên, thời lượng, hạn Azota (nếu có), "Khoá bài" và "Cho học thử miễn phí" (giữ chữ BU-02, thêm câu "Chỉ có tác dụng khi mục Đã đăng"), nhóm (danh sách chọn: Chưa nhóm / các nhóm), danh sách **nội dung kèm** (mỗi nội dung một dòng + `Gỡ`, link `Xem`/`Mở`), `Nhân bản`, `Xoá`, `Xem như học sinh`.

**390 (một cột, không cuộn ngang):** tiêu đề + `Thêm chương` thu vào `⋯` của header; ô tải lên là hai nút lớn `Dán link` / `Chọn tệp` (không kéo-thả) + chip nhận diện; chip lọc cuộn ngang; hàng mục xếp dọc: dòng 1 tên + chip trạng thái, dòng 2 kiểu · nguồn, dòng 3 hàng nút (▲ ▼ 44×44, `Sửa`, hành động chính, `⋯`); ngăn kéo "Sửa" là tờ toàn màn hình, nút `Lưu`/`Đóng` dính đáy.

### 5.3 Xem như học sinh
Giữ BU-02 5.2 (hai góc nhìn, không gọi `/api/progress`, `/api/lesson-notes`, `azota-done`). **Thêm:** mục `draft`/`hidden` ⇒ băng cam đầu trang "Học sinh chưa thấy mục này vì đang ở trạng thái Nháp/Ẩn. Đây là bản xem thử của riêng bạn." và nút `Đăng mục này` (G4) ngay trong băng. Góc nhìn "Người chưa vào lớp" của mục Nháp: hiện "Người chưa vào lớp không thấy mục này." (đúng với R1–R3).

### 5.4 Ba trạng thái trang
- **Đang tải:** `KinPageSkeleton` (khung xương gồm ô tải lên + 4 hàng).
- **Trống** (lớp chưa có mục): ô tải lên phóng lớn; câu "Lớp chưa có mục nào. Dán link YouTube hoặc thả tệp đầu tiên. Mục mới ở dạng Nháp, bạn đăng khi sẵn sàng." **Không** nhắc Phần/Chương.
- **Lỗi:** `KinStateCard` tone `loi`: 401 "Phiên đăng nhập đã hết", 403/404 "Bạn không có quyền với lớp này" (không dữ liệu lớp), mạng/500 "Chưa tải được giáo trình" + `Thử lại`; không trắng trang.
- Hàng/ngăn kéo: lỗi ghi **tại chỗ** (cạnh nút vừa bấm), 409 của G4 hiện nguyên câu máy chủ ("Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng.").
- Mục không có nội dung nào (bài cũ rỗng): hàng hiện chip `Nháp` nếu draft, kèm "Chưa có nội dung"; nút `Đăng` bị vô hiệu kèm lý do (`aria-describedby`).

### 5.5 Khác khung Figma 606:5 (607:218, 607:491) và lý do
| # | Khác | Lý do |
|---|---|---|
| 1 | **Giữ ▲▼ 44px** (khung không có) | Điện thoại không kéo-thả được; bàn phím/đọc màn hình cần cách đổi thứ tự không dùng chuột (mô hình cũ BU-02 đã có). Kéo-thả để sau |
| 2 | **Giữ ô xác nhận bản quyền** (khung không có) | Cờ TRẺ EM/bản quyền; chữ chưa qua luật sư (BU-02 Q6). Bỏ là bỏ lớp bảo vệ pháp lý |
| 3 | Bỏ Vimeo khỏi dải nguồn | Chủ: video chỉ link YouTube |
| 4 | Khung có `Ẩn` là nút cạnh `Sửa`; bản này là nút chính **đổi theo trạng thái** (Đăng/Ẩn/Hiện lại) | Máy trạng thái 3 trạng thái cần cả "Đăng" lẫn "Hiện lại"; khung chỉ có `Ẩn` |
| 5 | Thêm dải lọc theo trạng thái, "Đăng tất cả mục Nháp", hạn mức tệp, "Gắn vào mục có sẵn" | Danh sách dài cần lọc; mục mới mặc định Nháp nên cần đăng nhiều mục một chạm |
| 6 | Trạng thái `Đang tải` không phải trạng thái lưu | Chỉ có ở trình duyệt khi đang tải; xong là Nháp |
| 7 | Mục `Kiểm tra` hiện trạng thái của `Exam`, không phải Nháp/Đã đăng | `Exam` không có khái niệm nháp; không bịa trạng thái |
| 8 | Ba tab `Giáo trình / Lịch / Học viên` của khung vs dải tab thật của lớp (`Cài đặt · Giáo trình · Chương bài · Lịch học · Học viên · Điểm danh`) | Tab thuộc vỏ lớp, ngoài phạm vi bản này (đối chiếu 05/11 dòng 11: chưa rõ) |

### 5.6 Việc Figma còn nợ (người có công cụ Figma làm; điền nodeId)
Làm theo skill `figma:figma-use` (bắt buộc đọc trước `use_figma`). Ghi chú/ frame mới **cạnh** 607:218 và 607:491, không xoá khung gốc.
| Việc | Nơi | nodeId đã sửa/thêm (điền sau) |
|---|---|---|
| Ghi chú 5.5 #1 (mũi tên) và #2 (ô bản quyền); thêm mũi tên + ô bản quyền vào hàng/ô tải lên | cạnh 607:218, 607:491 | — |
| Thay `Ẩn` bằng nút chính đổi theo trạng thái; thêm chip `Ẩn` vào bộ chip trạng thái | 607:218, 607:491 | — |
| Bỏ `Vimeo` khỏi dải nguồn; thêm chip lỗi "Video chỉ nhận link YouTube" | ô tải lên | — |
| Vẽ ngăn kéo "Sửa" (1280) và tờ "Sửa" (390) | frame mới | — |
| Vẽ 3 trạng thái trang (tải/trống/lỗi) và băng "Học sinh chưa thấy mục này" | frame mới | — |
| Điện thoại: ô tải lên thành hai nút `Dán link` / `Chọn tệp` | 607:491 | — |

---

## 6. Máy trạng thái

### 6.1 Trạng thái mục (`Lesson.status`)
| Từ \ Sang | draft | published | hidden |
|---|---|---|---|
| **draft** | — | **Đăng** (cần `publishBlockFor = null`) | ✗ (409: "Mục Nháp chưa từng đăng, không cần ẩn") |
| **published** | ✗ (409: dùng "Ẩn") | — | **Ẩn** |
| **hidden** | **Đưa về Nháp** (để sửa lại) | **Hiện lại** (cần `publishBlockFor = null`) | — |

- Ai đổi được: **chỉ gia sư chủ lớp đã duyệt** qua G4/G5. Học sinh, khách, gia sư khác, gia sư chờ duyệt, quản trị ⇒ 403 (quản trị đổi trạng thái là việc của trang quản trị, xin ở D8 nếu cần). `PUT /api/lessons/[id]` không đổi được trạng thái.
- **Mục mới = `draft`** (mặc định G2; `publish:true` mới `published`). Chọn Nháp mặc định vì: (1) cờ TRẺ EM — một link dán nhầm hay tài liệu thiếu bản quyền không tới học sinh trước khi gia sư nhìn lại; (2) khớp khung ("mục Nháp chỉ gia sư thấy"); (3) giá phải trả là một chạm `Đăng` / công tắc "Đăng ngay" / "Đăng tất cả mục Nháp". Ngược lại mọi **bài cũ** và bài tạo từ tab Chương bài cũ giữ `published` (mặc định cột).
- `publishBlockFor`: mục không có nội dung nào dùng được (mọi `GtItem` `broken`, không có Bài tập tự nộp) ⇒ "Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng." Mục có nội dung nhưng một phần hỏng ⇒ đăng được, giữ cảnh báo.
- **Ẩn không xoá gì**: tiến độ, ghi chú, bài nộp, "đã làm xong Azota" của học sinh còn nguyên; chỉ không đường nào mở được (R1–R18). **Hiện lại** trả mọi thứ nguyên vẹn.
- **Bài khoá / miễn phí tương tác thế nào:** `isLocked` và `isFree` độc lập với `status` và **chỉ có nghĩa khi `published`**. `draft`/`hidden` + `isFree=true` ⇒ khách vẫn **không** thấy (R1–R3, R15 đều lọc trạng thái trước khi xét `isFree`). `published` + `isLocked=true` ⇒ khách thấy tên, không thấy link; người đã ghi danh thấy hết (hành vi cũ). Đăng một mục có `isFree=true` là công khai nội dung ra khách ⇒ ngăn kéo hiện câu nhắc trước khi `Đăng` ("Mục này đang cho học thử miễn phí, người chưa vào lớp cũng sẽ thấy") — xác nhận bằng `useKinConfirm`.
- Hàng loạt (G5): luật từng mục như bảng; mục không hợp lệ vào `skipped`.
- Xoá mục (hiện có `DELETE /api/lessons/[id]`) giữ như BU-02; không phải trạng thái.

### 6.2 Mục / nội dung (G2, G3) và tệp tải lên
Như BU-02 mục 6, thêm: **G2 không có `lessonId`** *vắng* → tạo `Lesson` (`draft`) → có 1 nội dung; link sai ⇒ không tạo `Lesson` và không tạo chương ngầm. Gỡ nội dung cuối cùng khỏi mục (G3) ⇒ mục còn nguyên, `publishBlock` bật; nếu đang `published` thì **vẫn published nhưng rỗng** (không tự chuyển trạng thái; hàng hiện cảnh báo "Mục đang đăng nhưng chưa có nội dung").

### 6.3 Chương ngầm / nhóm
`không có chương ngầm` --G2 (không nhóm) hoặc "Thêm chương" ở lớp mới--> `có chương ngầm (order thấp nhất)`; lớp "chung" + "Thêm chương" --lật cờ--> `phần/chương cũ thành ngầm`. Hai G2 đầu tiên song song ⇒ **một** chương ngầm (khoá `course_tree:<id>`). Bỏ nhóm ⇒ mục về chương không nhóm; chương có tên bị xoá chỉ khi đã trống.

### 6.4 `Exam` (chỉ đọc ở Giáo trình)
`upcoming | available | completed` của chính `Exam`; Giáo trình không đổi.

---

## 7. Thông báo

Không thêm `type` `notify` nào và không sửa `notify.ts`: **đăng/ẩn mục không báo học sinh** (tránh báo mỗi lần gia sư sửa; gia sư đăng hàng loạt sẽ thành spam). Nếu chủ muốn "có bài mới" thì là việc sau, dùng `notifyLikeAggregate` — một thông báo gộp cho lớp, **không tên học sinh, không tiền**, và chỉ bắn khi chuyển `draft→published` lần đầu. Không đọc `Enrollment`/tên học sinh ở bất kỳ màn nào của bản này (G1–G6 không nạp `User`).

---

## 8. Test phải có

Bám `tools/local-e2e/h.ts`; `mkUser` không có `tutorAppliedAt` ⇒ `prisma.user.update` như `t-notify-links.ts:20`. Mọi bài chạy tuần tự trên DB `kin_test`. Dữ liệu mẫu: lớp A (gia sư A) và lớp B (gia sư B); trong mỗi lớp có bài `published`, `draft`, `hidden`, và bài `draft` + `isFree=true`; học sinh S1 ghi danh A `active`, S2 chưa ghi danh, S3 `pending_consent`, khách (không phiên).

### 8.1 Bài thuần
| Bài | Nội dung |
|---|---|
| **`t-lesson-status-lib`** (mới) | `isLearnerVisible`: chỉ `"published"` true; `"Published"`, `""`, `null`, `undefined`, `"draft"`, `"hidden"`, `"archived"`, `1` ⇒ false. `canTransition` đủ 9 ô (đúng 4 hợp lệ: draft→published, published→hidden, hidden→published, hidden→draft; 5 ô còn lại ✗, kể cả chuyển về chính nó). `pruneTreeForViewer`: người học không thấy bài nháp/ẩn; chương/phần chỉ còn bài nháp biến mất; **chương trống sẵn giữ nguyên**; QL nhận nguyên cây; **không đổi đối tượng gốc**; `JSON.stringify(kết quả)` không chứa tiêu đề/URL của bài nháp. `publishBlockFor` |
| **`t-giao-trinh-lib`** (sửa) | `buildEntries`: lớp mới (chỉ chương ngầm) ⇒ `groups=[]`, mọi `groupId=null`; lớp cũ nhiều phần ⇒ tiêu đề nhóm `"Phần · Chương"`, bài đúng thứ tự; **cây "chung"** (Phần 1/Chương 1) ⇒ không nhóm; đã đổi tên ⇒ thành nhóm; ngầm + có tên ⇒ khối "chưa nhóm" đứng trước. `moveEntry`: giữa/đầu/cuối, chỉ trong cùng nhóm, payload `order` 1..n và `parentId` đúng. `entryKind` thứ tự ưu tiên. `routeInput`: `.mp4` **bất kể cờ** ⇒ lỗi YouTube; Vimeo/Zoom-bản-ghi/`kin-media:` ⇒ lỗi; Drive `/file/d/` ⇒ document; YouTube 5 dạng ⇒ video; hồi quy 25 đầu vào cũ (cập nhật kỳ vọng ô Drive/Vimeo). Ca "schema" đọc `schema.prisma` (mục 3). Không còn tham chiếu `config.video` |

### 8.2 Bài API — bảng kẻ tấn công `t-lesson-visibility` (mới) + sửa `t-giao-trinh`, `t-media-api`, `t-media-security`
Cột kết quả là mã HTTP **và** nội dung: với "không thấy" phải kiểm `JSON.stringify(body)` **không chứa** tiêu đề, URL, mã tệp của bài nháp/ẩn.

| # | Kẻ tấn công / hành động | Kỳ vọng |
|---|---|---|
| K1 | Khách `GET /api/courses/A` (có bài published + draft + hidden + draft-free) | 200; chỉ thấy bài published; **không có** tên/link bài draft/hidden; chương chỉ có nháp biến mất |
| K2 | S1 (đã ghi danh) `GET /api/courses/A` | như K1 (không phải QL ⇒ không thấy nháp) |
| K3 | Gia sư A (chủ) `GET /api/courses/A` | 200 thấy đủ 3 trạng thái, mỗi bài có `status` |
| K4 | **Gia sư B** `GET /api/courses/A` | cây published như học sinh (không thấy nháp); lớp ẩn ⇒ 404 (V7) |
| K5 | S1 `GET /api/lessons/<draft A>` / `<hidden A>` | **404** (không phải 403, không phải 200) |
| K6 | S2 (chưa ghi danh) `GET /api/lessons/<draft-free A>` | 404 |
| K7 | S1 `GET /api/lessons/<draft A>/context`; khách `GET …/context` bài draft+`isFree` | 404; và `context` của một bài *published* miễn phí **không chứa** tên bài nháp trong `course.sections` |
| K8 | **Gia sư B** `GET /api/lessons/<bất kỳ bài A>` | **403** (hành vi cũ giữ); `GET …/context` bài published trả đúng như người ngoài |
| K9 | S1 `POST /api/progress/<draft A>` (+`PATCH`) | 404; **không** có hàng `LessonProgress` mới, không phát Coin |
| K10 | S1 `PUT /api/lesson-notes/<draft A>`; `GET` | 404; không có `LessonNote` mới |
| K11 | S1 `POST /api/lessons/<draft A>/azota-done` | 404; không có `LessonAzotaDone` |
| K12 | S1 `POST /api/assignments/<bài tập của lớp draft>/submit` | 404; không có `AssignmentSubmission` |
| K13 | Bất kỳ tài khoản đăng nhập `GET /api/lessons/<draft A>/assignments` | 404 (QL: 200) |
| K14 | Khách `GET /thu-vien` / `GET /api/thu-vien/tim?q=<từ khoá tài liệu của bài draft+isFree>` | không có tài liệu đó |
| K15 | S1 `loadStudentLibrary` / trang `/thu-vien` | không có bài nháp/ẩn của lớp A |
| K16 | S1 `GET /api/deadlines`, `/api/schedule`, `/api/student/viec-cua-toi` với bài Azota có hạn + bài tập tự nộp **ở bài nháp** | không xuất hiện |
| K17 | S1 `GET /api/enrollments` | `lessonCount` không đếm nháp/ẩn |
| K18 | Cổng phụ huynh / báo cáo tháng của S1 | mẫu số không đếm nháp/ẩn |
| K19 | S1 `GET /api/media/<mã tệp chỉ ở bài draft>/file` và `/stream` (video `kin-media`) | **403** (đúng mã của `file/route.ts:51`); tệp ở cả bài draft và bài published ⇒ 200 |
| K20 | Gia sư B `GET /api/media/<mã tệp của A>/file` | 403 (BU-02 giữ) |
| K21 | Gia sư B gọi G1, G2, G3, G4, G5, G6 với `courseId` lớp A | **403** cả sáu; lớp không tồn tại ⇒ 404; **không ghi gì** |
| K22 | Gia sư A gọi G4 với `[lessonId]` thuộc lớp B (đường dẫn lớp A) | **404**, bài của B không đổi `status` |
| K23 | Gia sư A gọi G5 với một id lớp B lẫn id lớp A | 404, **không** id nào đổi |
| K24 | Gia sư A gọi G4 với `groupId` là chương của lớp B | 404, `chapterId` của bài không đổi |
| K25 | **Gia sư chờ duyệt**, học sinh, quản trị gọi G1–G6 | 403 (gia sư chờ duyệt: gồm cả dữ liệu không lộ); khách 401 |
| K26 | S1 `PATCH G4` (đổi nháp→đã đăng) | 403 |
| K27 | Gia sư A `PUT /api/lessons/<bài> { status: "published" }` | 200 nhưng **`status` không đổi** (bị bỏ qua) |
| K28 | G4 `status` lạ: `"Published"`, `"archived"`, `""`, số, mảng, `{}` | 400, không ghi |
| K29 | G4 `draft→hidden`, `published→draft`, đăng mục rỗng | 409 nguyên văn; hai lần liên tiếp cùng trạng thái ⇒ 200 idempotent |
| K30 | 5 `PATCH G4` song song (published/hidden xen kẽ) | kết quả cuối là một trong các trạng thái hợp lệ; không 500 |
| K31 | G2 link độc (`javascript:`, `data:`, `http://`, `https://youtube.com.evil.example/…`, 2.100 ký tự) | 400, **không tạo `Lesson`, không tạo chương ngầm** |
| K32 | G2 dán Vimeo / Zoom bản ghi / `kin-media:x` / tệp `.mp4` | 400 "Video chỉ nhận link YouTube…"; cột không đổi |
| K33 | 5 G2 song song vào lớp **trống** | 5 mục, **đúng 1** chương ngầm + 1 phần ngầm |
| K34 | G2 lần đầu ở lớp "chung" (Phần 1/Chương 1) | bài đi vào chương cũ, **không** tạo chương ngầm thứ hai |
| K35 | G6 "Thêm chương" ở lớp "chung" | bài cũ thành không nhóm, chương mới có tên; **không bài nào đổi `chapterId`** |
| K36 | `DELETE G6` chương có 3 mục | 3 mục về chương không nhóm, chương xoá, `Lesson` còn đủ |
| K37 | `PATCH /api/courses/A/reorder` với id/`parentId` của lớp B | 403, B không đổi (V6, hồi quy) |
| K38 | Nhân bản mục `draft` (`POST chapters/[id]/lessons` với `status:"draft"`) và `POST /api/courses/A/duplicate` | bản sao vẫn `draft`/`hidden` y như gốc; `isImplicit` chép đúng |
| K39 | Hồi quy: lớp cũ (cây Phần›Chương›Bài, mọi bài published, đã có dữ liệu) | `GET /api/courses/[id]` byte-giống trước (trừ khoá `status`, `isImplicit` mới); học sinh vẫn thấy hết; G1 hiện nhóm đúng |
| K40 | Hồi quy toàn bộ BU-02 (G1–G3 cũ chỉnh theo snapshot mới, A1–A6, V6, V7, V8, MD-03, MD-09, QZ-14) | giữ xanh |

### 8.3 Bài giao diện
| Bài | Nội dung |
|---|---|
| **`ui-giao-trinh`** (viết lại, 1280 + 390, có ảnh) | 3 trạng thái (tải/trống/lỗi giả bằng chặn route); lớp trống: dán link YouTube ⇒ có 1 mục **Nháp** và **không** có chữ "Phần"/"Chương"; `Đăng` ⇒ chip đổi, `Ẩn` ⇒ chip đổi, `Hiện lại`; "Đăng ngay" ⇒ đăng thẳng; **không có** ô/chữ tải video (`data-gt-video-xac-nhan` vắng, không `.mp4` trong `accept`); thả `.mp4` ⇒ lỗi tại chỗ, không có yêu cầu mạng; dán Vimeo ⇒ lỗi YouTube; thả 3 PDF ⇒ 3 hàng "Đang tải" rồi 3 mục Nháp, F5 vẫn còn; `Thêm chương` ⇒ nhóm hiện, `Bỏ nhóm` ⇒ mục về "Chưa nhóm"; ▲▼ đổi thứ tự, ≥44px, F5 giữ; ngăn kéo `Sửa` lưu tên/khoá/miễn phí; `Đăng` mục `isFree` hỏi xác nhận; 390 không cuộn ngang; "Xem như học sinh" mục nháp có băng cam và **không có yêu cầu tới `/api/progress`**; gia sư chờ duyệt ⇒ `/lop-cua-toi/cho-duyet`; gia sư khác thấy "Bạn không có quyền với lớp này" và không dữ liệu |
| **`ui-thu-vien-gia-su`** (sửa) | đích "Dùng ở lớp khác" = mục mới (mặc định, Nháp) hoặc mục có sẵn; chip trạng thái; hồi quy phần còn lại |
| **`t-thu-vien`**, **`t-media-api`**, **`t-media-security`** | sửa cho snapshot/đích mới; thêm K19–K20 vào `t-media-security`; ca A1–A6 giữ; `KIN_VIDEO_UPLOAD=0` ⇒ giao diện không có video (ở `ui-giao-trinh`) |
| Hồi quy bắt buộc | `t-media-link-lib`, `t-media-access-lib`, `t-viewer-url-lib`, `t-exam-password-lib`, `t-azota-lib`, `ui-media` (tab Chương bài cũ còn xanh), `ui-baomat`, `ui-bai-tap-thu-vien`, `ui-library-links`, `t-tutor-routes-lib`, `ui-tutor-shell`, `ui-tutor-pending`, `ui-role-everything`, `ui-links-everywhere`, `t-db-push-guard`, `t-no-hex`, `t-no-fabricated`, `t-links`, `t-kin-components`; `tsc --noEmit` 0 lỗi; eslint không tăng |

Ghi chú tut-test: Cloudinary thật chưa chạy được (driver `local`). Cần dữ liệu mẫu có nháp/ẩn trong `tutor-world.ts` ⇒ xin COO (mục 10-D8) hoặc tạo bằng `prisma` ngay trong bài. "Xanh" chỉ ghi khi đã chạy.

---

## 9. Cờ và câu hỏi cho chủ

**TIỀN = không.** Không đụng `fee*`, `invoice*`, `sessionBook*`; không nhà cung cấp mới; bỏ giao diện tải video còn **giảm** chi phí Cloudinary tiềm tàng.
**TRẺ EM = CÓ.** Mặc định Nháp chặn nội dung chưa duyệt tới em; mọi đường học sinh phải lọc (mục 4.4 là bản kê chặt của việc này); không có tên học sinh ở màn mới; ô bản quyền giữ. Mất một chỗ lọc = lộ bài nháp cho em ⇒ `kin-ra-soat` phải rà từng dòng R1–R18, và PR dán bảng 8.2 kèm số chạy thật.
**ĐỔI NỀN = không** (ba cột chỉ-thêm, Next 16/Prisma giữ). `Enrollment.status` **không** thêm giá trị.

Câu hỏi (mỗi câu có mặc định để tut-code không phải chờ):
- **Q1** Mục mới Nháp hay Đã đăng? **Mặc định: Nháp** + công tắc "Đăng ngay" + "Đăng tất cả mục Nháp" (lý do mục 6.1).
- **Q2** "Video chỉ link YouTube" có nghĩa **cấm cả Vimeo/Zoom-bản-ghi/Drive** cho mục MỚI? **Mặc định: cấm**, Drive chuyển sang Tài liệu; dữ liệu cũ giữ phát được.
- **Q3** Bài cũ nhiều nội dung (video + tài liệu + Azota trong cùng bài): **một hàng** + "nội dung kèm", hay tách ra nhiều mục? **Mặc định: một hàng** (tách là đổi dữ liệu, trạng thái phải đồng bộ giữa các hàng của cùng một bài).
- **Q4** Lớp cũ chỉ có "Phần 1/Chương 1" mặc định ⇒ hiện **không nhóm** (đọc ra, không ghi). Đồng ý? **Mặc định: đồng ý**.
- **Q5** Học sinh xem tiêu đề "Nội dung lớp › Bài học" tạm thời tới khi stu-dev ẩn theo cờ `isImplicit` (D3). Chấp nhận? **Mặc định: chấp nhận**, không chặn phát hành.
- **Q6** Ẩn một mục có học sinh đã có tiến độ: tiến độ giữ nguyên nhưng không còn đếm vào `completedIds`. Đồng ý? **Mặc định: đồng ý**.
- **Q7** Lỗ có sẵn: `PUT /api/lesson-notes/[lessonId]` và `GET /api/lessons/[id]/assignments` không kiểm ghi danh. Vá luôn (D1) hay để P2? **Mặc định: chỉ vá phần trạng thái, ghi nợ P2 phần ghi danh**.
- **Q8** Quản trị đổi trạng thái mục của gia sư (gỡ nội dung vi phạm): **chưa có** trong bản này. Cần không? **Mặc định: không, ghi nợ P3**.
- **Q9** Đăng/ẩn không báo học sinh (mục 7). Đồng ý? **Mặc định: đồng ý**.

---

## 10. Tệp chung / ngoài phòng cần xin COO (mẫu `BAN-GIAO.md` mục D)

**D0 `prisma/schema.prisma` (chung, chỉ thêm).** Phiếu COO đã cho phép cột chỉ-thêm cho trạng thái mục. Đúng **ba cột**, không gì khác:
`Section.isImplicit Boolean @default(false)` · `Chapter.isImplicit Boolean @default(false)` · `Lesson.status String @default("published")`.
Không đổi `Lesson.chapterId` hay cột nào có sẵn; không enum; không index; không bảng. Đề nghị: **PR riêng chỉ có ba dòng này gộp trước** để production `db push` xong trước khi bản preview/PR mã chạy (mục 3); không cần `PRISMA_ACCEPT_DATA_LOSS`; không cần script backfill.

**D1 Đường đọc/ghi của học sinh nằm ngoài PHAM-VI phòng Gia sư — đề nghị giao tut-code sửa trong nhánh này, mỗi tệp chỉ vài dòng theo `lessonVisibility.ts` / `PUBLISHED_ONLY`** (stu-code không sở hữu các tệp này theo `PHAM-VI.md`; nếu COO muốn stu-code làm thì theo hợp đồng 4.4):
`src/app/api/progress/route.ts`, `api/progress/[lessonId]/route.ts` (R7, R8) · `api/lesson-notes/[lessonId]/route.ts` (R9) · `api/assignments/[id]/submit|answer/route.ts` (R10) · `api/deadlines/route.ts` (R11) · `api/enrollments/route.ts` (R17) · `src/lib/studentSchedule.ts` (R12) · `src/lib/studentTodoServer.ts` (R13) · `src/lib/libraryServer.ts` (R14) · `src/lib/libraryKhoServer.ts` (R15, **ưu tiên cao: kho công khai cho khách**) · `src/lib/monthlyReportServer.ts` (R16).
Nếu COO chưa giao kịp, **không được phát hành** bản này: thiếu bất kỳ dòng nào trong R7–R17 thì bài nháp vẫn tới học sinh/khách.

**D2 `api/lessons/**`, `api/chapters/**`, `api/sections/**`, `api/media/**`** chưa có chủ trong PHAM-VI (BU-02 D5 đã đề nghị giao tut-code). Xác nhận để sửa R2–R6, R18 và `chapters/[id]/lessons` (nhận `status:"draft"`).

**D3 Giao diện học sinh ẩn tiêu đề Phần/Chương ngầm** (`src/lib/apiAdapters.ts`, `components/student/KhoaHocChiTiet.tsx`, `components/student/LopCuaToi.tsx`; stu-dev): khi `section.isImplicit` thì không vẽ tiêu đề Phần; khi `chapter.isImplicit` thì không vẽ tiêu đề Chương. Chưa làm thì học sinh thấy "Nội dung lớp › Bài học" (vẫn đúng, không lỗi). **Không chặn phát hành.**

**D4 `api/media/config` / `mediaStorage.ts`**: không đổi. Hạ tầng video giữ nguyên.

**D5 `src/components/media/TutorLessonMedia.tsx`** (chưa có chủ): render `null` cho `VideoUploadBox` khi `!config.video.enabled`, để tab Chương bài cũ cũng không hiện giao diện tải video khi cờ tắt. Đề nghị giao tut-dev. Không chặn phát hành; nếu không làm, ghi vào PR rằng gia sư còn thấy ô đó ở tab Chương bài.

**D6 Hai tệp lớn** (`admin/khoa-hoc/[id]/page.tsx`, `admin/thi-thu/**`; adm-code/adm-dev): **không đụng**. Yêu cầu gửi adm: (a) vẫn tạo bài không gửi `status` ⇒ nhận mặc định `published`, hành vi cũ; (b) sau PR này, tab Chương bài hiển thị cây gồm cả phần/chương ngầm — khi hiển thị nên ẩn tiêu đề nếu `isImplicit` (tuỳ chọn); (c) nếu quản trị cần đổi trạng thái mục thì dùng G4 phiên bản quản trị (Q8) — chưa làm.

**D7 `src/lib/notify.ts`, `hostRouting.ts`, vỏ (`TutorShell`, `LopCuaToiFrame`)**: **không cần sửa**. Href mới đi qua `giaoTrinhHref`/`contentHref`/`toTutorPath` (không ghi cứng `/admin/...`); `tutorRoutes.ts` không đổi.

**D8 `tools/local-e2e/tutor-world.ts`, `h.ts`, `wipe`** (chung): nếu COO muốn dữ liệu mẫu có bài `draft`/`hidden` sẵn trong `tutor-world.ts` thì cần phiếu; mặc định tut-test tạo ngay trong bài.

**D9 `adminOps.ts`** (nhãn nhật ký): nếu muốn nhật ký tiếng Việt cho `giao_trinh.status|group`, là việc adm-code (P3, tuỳ chọn).

### Thứ tự làm (đề xuất)
(0) COO: PR chỉ-schema (D0) ⇒ production build xong ⇒ (1) tut-code: `lessonStatus.ts`, `lessonVisibility.ts`, **R1–R5, R18, K1–K13, K19** (đóng lỗ trước khi có dữ liệu nháp), cùng D1 ⇒ (2) `giaoTrinh.ts` mới + `t-*-lib` ⇒ (3) G1–G6 + `routeInput` YouTube ⇒ (4) tut-dev song song từ bước 3 theo kiểu `GiaoTrinhSnapshot` ⇒ (5) tut-test chạy tuần tự ⇒ `kin-ra-soat` (soi bảng R1–R18 từng dòng) ⇒ `kin-ghi-so`.
Rủi ro gộp: BU-02 vừa vào `main` ⇒ rẽ từ `origin/main`; D1 chạm tệp của nhiều phòng ⇒ gộp trong một PR hoặc theo thứ tự COO đặt.

---

## Tóm tắt

1. **Schema (chỉ thêm, 3 cột):** `Lesson.status String @default("published")`, `Section.isImplicit`, `Chapter.isImplicit` (Boolean @default(false)). Không đổi `Lesson.chapterId`; "bài không chương" = bài trong chương ngầm của phần ngầm; lớp cũ đọc nguyên, cây "Phần 1/Chương 1" mặc định hiện là không nhóm (không ghi DB).
2. **Backfill:** mặc định cột làm mọi bài cũ thành "Đã đăng", không script; `db push` production-only không cảnh báo mất dữ liệu; cần PR chỉ-schema gộp trước vì preview dùng chung DB production.
3. **Máy trạng thái:** draft→published→hidden→(published|draft); mục mới = **Nháp** (có công tắc "Đăng ngay"); chỉ gia sư chủ đổi; `isLocked/isFree` chỉ có nghĩa khi Đã đăng.
4. **API mới:** G4 đổi trạng thái/nhóm, G5 hàng loạt, G6 chương; G2 tạo mục mới không cần chương; `PUT /api/lessons` bỏ qua `status`.
5. **Video:** chỉ link YouTube (Vimeo/Zoom-bản-ghi/Drive bị từ chối cho mục mới); giao diện tải video ẩn hẳn khỏi màn Giáo trình; hạ tầng máy chủ giữ.
6. **Đường đọc học sinh/khách cần lọc (R1–R18; R19 duplicate chép cột; R20–R21 không lọc):** `courses/[id]`, `lessons/[id]`, `context`, `lessons/[id]/assignments`, `azota-done`, `progress` (ghi + đọc), `lesson-notes`, `assignments/submit|answer`, `deadlines`, `studentSchedule`, `studentTodoServer`, `libraryServer`, `libraryKhoServer` (kho khách), `monthlyReportServer`, `enrollments`, `media/file|stream`, `duplicate`.
7. **Phạm vi:** tut-code = `lessonStatus.ts`, `giaoTrinh.ts`, `giaoTrinhServer.ts`, `lessonVisibility.ts`, 6 route G, `courses/[id]`, `lessons/**`, `media/**`; tut-dev = viết lại `GiaoTrinh.tsx`, `OTaiLen.tsx`, `useGiaoTrinh.ts` + 4 component mới.
8. **Test:** `t-lesson-status-lib`, `t-lesson-visibility` (K1–K40, kẻ tấn công: học sinh/khách 404 với nháp, gia sư lạ 403, chờ duyệt 403), sửa `t-giao-trinh-lib`, `t-giao-trinh`, `t-media-*`, `t-thu-vien`, `ui-giao-trinh`, `ui-thu-vien-gia-su`.
9. **Figma: chưa đọc/sửa được** (phiên không có công cụ Figma); khác khung đã ghi (giữ ▲▼ và ô bản quyền, bỏ Vimeo, nút chính đổi theo trạng thái) và liệt kê việc Figma còn nợ ở 5.6.
10. **Mục D:** D0 `schema.prisma` (3 cột); D1 mười tệp đọc/ghi của học sinh ngoài phạm vi (giao tut-code, **không phát hành nếu thiếu**); D2 `api/lessons|chapters|sections|media`; D3 stu-dev ẩn tiêu đề ngầm; D5 `TutorLessonMedia.tsx`; D6 hai tệp admin; D8 `tutor-world.ts`.
