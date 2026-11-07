# TUT-lich-keo-tha — Lớp phải có lịch từ lúc tạo; lịch tuần kéo-thả như Google Calendar

Đặc tả của `tut-rnd` (pb-gia-su). Nhánh `claude/lich-lop-keo-tha` từ `origin/main` 20c53413.
Lập 07/11/2026. Không sửa `src/` ở bước này. Khung Figma: **chưa dựng** (không có node cho lịch kéo-thả);
đề xuất vẽ sau khi chủ chốt mục 12, trước khi `tut-dev` làm phần hình.

Lời chủ: "mỗi lớp có lịch học, tức lúc tạo lớp phải có lịch học rồi, kể cả lớp tạo trước hay sau; với cái lịch
thay vì phải click vào để soạn, sao không giống Google Calendar, kéo thả để tạo ô công việc có tốt hơn không?"

Cờ: **TIỀN = trình bày** (không đổi cách sinh phí, nhưng đổi khung giờ làm thay đổi cách Lịch khai triển buổi — mục 12.1) ·
**TRẺ EM = trình bày** (không thu dữ liệu trẻ; chữ trùng giờ chỉ có SỐ em chung, không tên) · **ĐỔI NỀN = không**
(không đổi schema, không thêm thư viện, không thêm biến môi trường).

---

## 0. Quyết định đã chọn (đọc mục này trước)

| # | Quyết định | Lý do một dòng |
|---|---|---|
| Q1 | **Wizard bắt buộc có ≥ 1 khung giờ mới cho "Tiếp tục" ở bước Lịch học.** Lối thoát duy nhất: dòng chữ "Lớp này học buổi lẻ, không lặp hằng tuần" → hộp `KinConfirm` nói rõ hệ quả. | Bắt buộc cứng hoàn toàn sẽ chặn lớp học ôn tự do / 1-kèm-1 không cố định; mà KiN đã có "buổi lẻ" (`ThemBuoiNhanh`). |
| Q2 | **Máy chủ KHÔNG từ chối tạo lớp thiếu lịch** (`POST /api/courses` vẫn nhận như cũ). Thêm tham số tùy chọn `schedules[]` để tạo lớp + khung giờ **trong một giao dịch** (hết cảnh "lớp tạo rồi, khung giờ lỗi"). | Bắt buộc ở máy chủ vỡ ≥ 8 bài test cũ, ngăn kéo tạo khoá của Quản trị, mock và mọi `mkCourse` (Prisma trực tiếp). |
| Q3 | **Lớp không có lịch (cũ hoặc tạo qua đường khác) không bị chặn, chỉ bị nhắc mạnh**: (a) hàng mới ở Hộp việc `noSchedule` "N lớp chưa có lịch học", (b) khung `KinCallout` đầu trang lớp, (c) chữ "Chưa xếp lịch" ở danh sách lớp thành liên kết "Đặt lịch". | Nhắc có sẵn quá yếu (xem 1.4): chỉ là chữ mờ + một bước checklist đóng được. |
| Q4 | **Nhân bản lớp (`duplicate`) sao chép luôn khung giờ đang bật.** | Hôm nay bản sao mất lịch (duplicate/route.ts:60-97 không đọc `classSchedules`) — đây là đường sinh ra lớp "chưa lịch" thứ hai. |
| Q5 | **Khung hằng tuần sửa bằng `WeekScheduleEditor`; ngoại lệ một tuần vẫn là `ClassSessionChange` (dời/huỷ một buổi) — đã có, không làm lại.** Kéo trong editor = đổi quy tắc cho mọi tuần. | `ClassSchedule` lặp theo `dayOfWeek`; ngoại lệ đã có bảng riêng (schema.prisma:2362). |
| Q6 | **Xoá bằng phím/nút nhanh = TẮT khung (`active:false`) + hoàn tác được; "Xoá hẳn" nằm trong panel, có `KinConfirm`.** | `DELETE` cứng làm mất `scheduleId` mà báo nghỉ, nhắc lịch, `ClassSessionChange` đang tham chiếu; hoàn tác xoá cứng sẽ sinh id mới và mồ côi lịch sử. |
| Q7 | **Không thêm cột schema.** Tên/ghi chú khung dùng `note` có sẵn (thêm giới hạn 200 ký tự cho lần ghi mới). Nhãn giáo viên là **slot tùy chọn** trong component, chờ PR đồng giảng thêm `teacherId`. | Giữ PR này không đụng tệp chung. |
| Q8 | **Tự dựng bằng pointer events, không thêm thư viện.** Logic thuần ở `src/lib/scheduleDrag.ts`. | `dnd-kit`/`react-big-calendar` ≥ 30-100 KB gzip, kéo theo CSS riêng không theo token `--kin-*`; bài toán ở đây chỉ là lưới 7 cột × phút. |
| Q9 | **Trên điện thoại, đường chính là "bấm ô trống / bấm khối → panel có bộ chọn giờ"; chạm-giữ-kéo là đường phụ.** | Kéo bằng ngón tay dễ cuộn nhầm; bộ chọn luôn làm được, cũng là đường cho bàn phím và trình đọc màn hình. |

---

## 1. Vấn đề + bằng chứng (tệp:dòng)

### 1.1 Wizard cho bỏ qua lịch
- `src/components/tutor/TaoLop.tsx:147` — phụ đề "Ba bước, cô có thể bỏ qua lịch học để làm sau."
- `TaoLop.tsx:271` — tiêu đề mục "Lịch học · Có thể để sau"; `:273` "Chưa có khung giờ: lớp vẫn được tạo, lịch thêm sau ở trang lớp."; `:340-343` "Thêm khung giờ nếu chưa xếp lịch … Tất cả đều tùy chọn".
- `TaoLop.tsx:57` `slots` khởi tạo `[]`; `:103` `validateSlots([])` trả `null` (tutorStudentView.ts:137-148 chỉ kiểm định dạng/trùng chính xác, không kiểm "ít nhất một").
- `TaoLop.tsx:129-132` khung giờ gửi **tuần tự sau khi lớp đã tạo**, lỗi thì chỉ cờ `lich=loi` (LopChiTiet.tsx:131-134): lớp tồn tại mà thiếu lịch.

### 1.2 Mọi đường tạo lớp (rà `course.create`, `api.courses.create`, trang tạo)
| # | Đường | Tệp | Có lịch lúc tạo? | Xử lý đề xuất |
|---|---|---|---|---|
| 1 | Wizard gia sư `/lop-cua-toi/lop/tao` (cũng là đích của `quan-lop?tao=1`, `quan-lop/tao-moi`) | `components/tutor/TaoLop.tsx:122` → `POST /api/courses` | Tùy chọn (có thể bỏ) | **Bắt buộc ≥ 1 khung hoặc tick "buổi lẻ"** (Q1); gửi `schedules[]` cùng lúc (Q2) |
| 2 | `POST /api/courses` trực tiếp (API, test, mock) | `api/courses/route.ts:143` `tx.course.create` | Không | Nhận `schedules[]` tùy chọn; **không bắt buộc** (Q2). Trả thêm `scheduleCount` |
| 3 | Ngăn kéo "Tạo khoá học" của Quản trị | `components/admin/courses/CreateCourseDrawer.tsx:147` → `api.courses.create` | Không | Không chặn. Sau khi tạo, hiện nhắc + dẫn sang tab Lịch học (mục D1) |
| 4 | Nhân bản lớp | `api/courses/[id]/duplicate/route.ts:60-97` (chép Section/Chapter/Lesson, **không** chép lịch) | Không (mất lịch) | Chép khung đang bật, chạy trong cùng `$transaction` (Q4) |
| 5 | Hồ sơ nhập (`ho-so/nhap`) | `api/tutor/ho-so/nhap/route.ts:31-44` | **Không tạo lớp**; chỉ thêm khung vào lớp có sẵn (`parseScheduleImport`) | Không đổi. Là đường *bù* lịch hàng loạt, nhắc ở Hộp việc nên dẫn tới đây được |
| 6 | Seed/test: `mkCourse` | `tools/local-e2e/h.ts:34` (Prisma trực tiếp) | Không | Giữ nguyên (tệp chung). Mọi bài cũ không đổi |
| 7 | Trang `admin/khoa-hoc/tao-moi` | chỉ chuyển hướng (ui-journey-new-tutor.ts:353) | — | Không có đường tạo thứ ba |

Kết luận: đường tạo thật chỉ có **POST /api/courses** (gọi bởi wizard + ngăn kéo Quản trị) và **duplicate**.

### 1.3 Không có chỗ nào dễ để sửa khung giờ
- Gia sư chỉ sửa khung hằng tuần ở **tab "Lịch học" của trang quản khoá** — tệp thuộc Quản trị: `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx` (`TabLichHoc` :2122, form thêm :2144, bật/tắt :2165, xoá :2176, rỗng :2269). Đây là danh sách + form "+ Thêm khung giờ", không có lưới.
- `LichClient.tsx` là **lịch BUỔI** (kết quả khai triển khung, `GET /api/tutor/schedule`), không phải lịch KHUNG. Câu rỗng `:397` còn bảo gia sư "mở lớp → Quản khoá" để thêm giờ.
- `LichGrid.tsx` (lưới 7 cột, `PX_PER_HOUR=64`, :10) chỉ ≥ 1024px (`LichClient.tsx:54`), khối là nút mở chi tiết, **không kéo được**, điện thoại dùng danh sách.

### 1.4 Nhắc "lớp chưa lịch" có sẵn rất yếu
- `LopHoc.tsx:105` và `LopChiTiet.tsx:106` chỉ in chữ mờ "Chưa xếp lịch".
- `tutorOverview.ts:38` bước checklist "Đặt lịch học cho lớp" xong khi **bất kỳ** lớp nào có lịch (`c.schedules > 0`), đóng được (`SetupChecklist.tsx`), và biến mất khi đủ 8 bước.
- `tutorInbox.ts:7` — `InboxKind` không có loại nào cho lớp thiếu lịch.

### 1.5 API đã sẵn gần đủ (dùng lại, đừng viết lại)
- `POST /api/courses/[id]/class-schedules` (class-schedules/route.ts:35-93): chuẩn hoá giờ `normalizeHm`, `end > start`, link, `mode/location` (LI-16), kiểm trùng LI-10 với `checkConflicts`+`force` (409 `needsConfirm`).
- `PUT /api/class-schedules/[id]` (route.ts:10-84): **đã sửa từng phần** (chỉ field có trong body), kể cả `active`, `mode`, `location`, `note`, `joinUrl`, kiểm trùng LI-10. `DELETE` :87-110 xoá cứng.
- `POST /api/courses/[id]/schedule-conflicts` (31 dòng): chỉ đọc, hai kiểu (`dateKey` hoặc `dayOfWeek`), trả `sharedStudents` là **số**, không tên.
- Quyền: `requirePermission(MANAGE_COURSES)` + `ownsResource` (auth-guard.ts:23): `adminRole==="teacher"` chỉ sửa lớp của mình, `admin_super/admin_content` sửa mọi lớp. Thứ tự hiện nay: 404 (không có) → 403 (lớp người khác).
- Giới hạn giờ: `parseHm` (classSessions.ts:30) chỉ nhận `00:00`–`23:59`; **không có "24:00"**.
- Trùng giờ: `slotsOverlap` (sessionBook.ts:178) `a.start < b.end && b.start < a.end` → hai khung **chạm đầu** (18:00–19:00 và 19:00–20:00) KHÔNG trùng. `sessionBook*` là TIỀN/khoá: chỉ gọi, không sửa.

### 1.6 Điểm yếu cần xử lý khi cho kéo-thả
- Hiệu lực: sửa khung áp **cho mọi tuần**, kể cả tuần đã qua (Lịch khai triển lại từ quy tắc hiện tại — `expandOccurrences`, classSessions.ts:109). Hôm nay chỉ gõ sửa nên ít xảy ra; kéo dễ xảy ra hơn. Xem 12.1 và câu hỏi C2.
- `DELETE` cứng làm mất `scheduleId` (xem Q6).
- Không có giới hạn số khung/lớp và độ dài `note`: thêm trần 14 khung/lớp, `note` ≤ 200 (cho lần ghi mới, không đụng dữ liệu cũ).

---

## 2. Lựa chọn cho "lớp phải có lịch" (đã chọn B+C+Q3)

| Phương án | Ưu | Nhược | Kết |
|---|---|---|---|
| A. Máy chủ từ chối `POST /api/courses` không có khung | Đúng chữ "phải có" tuyệt đối | Vỡ `t-course-validate`, `t-course-ids`, `t-free-class-fee`, `t-hocphi-dashboard` và mọi bài `api("POST","/api/courses")`; vỡ ngăn kéo Quản trị (không có bước lịch); lớp nhân bản/đã có không áp dụng được; buộc 1-kèm-1 giả khung | **Không** |
| B. Chỉ cảnh báo, không đổi gì ở wizard | Rẻ | Giữ nguyên vấn đề chủ nêu | Không |
| C. Wizard bắt buộc (≥ 1 khung hoặc tick "buổi lẻ"); máy chủ nhận `schedules[]` và vẫn dung thứ | Chặn đúng cửa mà gia sư dùng hằng ngày; không vỡ test/mock/Quản trị; tạo nguyên tử | Gọi API thẳng vẫn tạo được lớp trống | **Chọn** |
| D. C + thêm cờ `requireSchedule:true` máy chủ kiểm khi client gửi | Chặn cả khi ai đó sửa giao diện | Thêm một tham số chỉ để tự ràng buộc; wizard là client duy nhất | Làm: wizard gửi `requireSchedule:true`, máy chủ trả 400 `schedule_required` nếu cờ bật mà `schedules` rỗng và không có `noFixedSchedule:true`. Rẻ, chỉ thêm |

Lớp hiện có không lịch: **không chặn** gì (không đổi quyền vào lớp, không ẩn lớp, không ảnh hưởng điểm danh/phí) — chỉ nhắc (Q3). Mức nhắc:
1. Hộp việc: loại mới `noSchedule` (tutorInbox*.ts), không khẩn (`urgent:false`), tiêu đề "N lớp chưa có lịch học", lệnh "Đặt lịch" → `/lop-cua-toi/quan-lop/<lớp đầu tiên>/lich-hoc`; chi tiết liệt kê tên lớp (không tên em). Chỉ tính lớp `classStatus === "open"` và `ownerId` là gia sư.
2. Trang lớp (`LopChiTiet`): `KinCallout` "Lớp chưa có lịch học" + nút "Đặt lịch bằng lưới kéo-thả" khi `schedule == null`.
3. Danh sách lớp (`LopHoc.tsx:105`): "Chưa xếp lịch" thành liên kết "Đặt lịch".
4. Bước checklist `lich` (tutorOverview.ts:38): đổi nghĩa thành "mọi lớp đang mở đều có lịch" — **chỉ nếu chủ đồng ý** (đụng số bước hoàn thành của gia sư đang dùng); mặc định giữ nguyên, ghi vào câu hỏi C5.

Tương thích: lớp cũ không đổi gì cho tới khi gia sư vào. Test cũ và mock không sửa (trừ các bài wizard ở mục 10.4). Số đỏ trên thanh module = `inboxTotal` sẽ **tăng** với gia sư có lớp trống ngay khi triển khai → báo trước (C4).

---

## 3. Thành phần `WeekScheduleEditor` (`src/components/tutor/WeekScheduleEditor.tsx`)

### 3.1 Dữ liệu và props (đề xuất, `tut-dev` được tinh chỉnh nếu giữ hợp đồng)
```ts
// Một khung hằng tuần, theo phút trong ngày (0–1440), thứ theo Date.getDay() (0=CN).
interface ScheduleBlock {
  id: string;                    // id máy chủ, hoặc "tmp-<n>" khi chưa lưu
  dayOfWeek: number;             // 0–6
  startMin: number; endMin: number; // bội 15; 0 ≤ start < end ≤ 1440
  courseId?: string; courseName?: string;
  note?: string | null;          // dùng làm "tên/ghi chú khung"
  mode?: "online" | "offline" | null; location?: string | null; joinUrl?: string | null;
  active?: boolean;              // false = đã tắt
  teacherLabel?: string | null;  // SLOT cho PR đồng giảng; hôm nay luôn null → không vẽ
  draft?: boolean;               // chưa lưu (viền nét đứt + chữ "Chưa lưu")
}
interface WeekScheduleEditorProps {
  blocks: ScheduleBlock[];                       // khung của lớp ĐANG SỬA (có thể sửa)
  ghosts?: ScheduleBlock[];                      // khung lớp KHÁC của cùng gia sư: chỉ đọc, dùng tính trùng
  accent: string;                                // token, vd classAccentFor(...)
  state: "loading" | "error" | "ready";          // + onRetry
  onRetry?: () => void;
  onOp(op: ScheduleOp): Promise<OpResult> | OpResult; // cha lưu (API hoặc cục bộ). Trả {ok}|{ok:false,error}|{conflicts}
  canEdit?(b: ScheduleBlock): boolean;           // "chỉ sửa khung của mình" (sau này theo teacherId); mặc định true
  renderBadge?(b: ScheduleBlock): ReactNode;     // chỗ nhãn giáo viên
  checkConflicts?(b: ScheduleBlock): Promise<Conflict[]>; // chế độ có courseId: gọi schedule-conflicts để lấy sharedStudents; mặc định tính cục bộ bằng ghosts
  density?: "week" | "day";                      // điện thoại: ngày/tuần
  visibleRange?: [number, number];               // mặc định [6*60, 22*60]; nút "Hiện cả ngày" mở [0,1440]
}
type ScheduleOp =
  | { type: "create"; block: ScheduleBlock }
  | { type: "update"; id: string; patch: Partial<Pick<ScheduleBlock,"dayOfWeek"|"startMin"|"endMin"|"note"|"mode"|"location"|"joinUrl"|"active">> }
  | { type: "remove"; id: string };               // xoá hẳn (sau KinConfirm)
```
Component **không biết API**. Cha (mục 3.6) quyết định cục bộ hay gọi mạng. Cha áp thao tác lạc quan vào `blocks` ngay, gửi API, lỗi thì `invertOp` và báo `role="alert"`.

### 3.2 Tương tác chuột (≥ 640px; cũng dùng ở 1280)
- **Tạo**: kéo trên ô trống (cột ngày) → khối **bản nháp** snap 15', hiện nhãn giờ sống "19:00–20:30" khi kéo (chữ, `aria-hidden`). Thả → mở panel sửa với nút **Lưu khung giờ** / **Bỏ**; chưa gọi API. Bấm (không kéo, < 4px) ô trống → bản nháp 90 phút bắt đầu tại giờ vừa bấm, mở panel. (Google Calendar tạo ngay; ở đây chọn nháp vì chế độ có `courseId` mỗi thao tác là một lần ghi — tránh POST do bấm nhầm.)
- **Dời**: kéo thân khối (cả sang ngày khác): giữ độ dài, kẹp 00:00–24:00, kẹp thứ trong 0–6 (không vòng). Thả → `update`.
- **Đổi độ dài**: kéo mép trên (đổi `start`) hoặc mép dưới (đổi `end`); tối thiểu 15'. Vùng nắm 8px nhìn thấy, vùng bắt 12px.
- **Bấm khối** (không kéo) → panel sửa (mục 3.5). **Esc** khi đang kéo = hủy, trả vị trí cũ.
- Bắt buộc `setPointerCapture`; chỉ nhận nút trái; bỏ qua `pointerType==="touch"` ở nhánh chuột (touch có nhánh riêng 3.3). Lưu `getBoundingClientRect` của các cột lúc bắt đầu kéo để đổi x→thứ; không đọc layout mỗi `pointermove` (dùng `requestAnimationFrame`).
- Kéo gần mép cửa sổ (< 48px) tự cuộn trang; tuỳ chọn (không bắt buộc đạt).
- Lặp hằng tuần: **mọi khung đã lặp hằng tuần**. Panel ghi rõ câu "Lặp mọi tuần, áp dụng cho cả lớp" và trỏ sang "Dời/huỷ riêng một buổi" (`/lop-cua-toi/lich` → buổi → Dời/Báo nghỉ). Ngoại lệ một tuần = `ClassSessionChange` (đã có, `POST /api/tutor/session-changes`); **không làm lại trong PR này**. Phụ (giai đoạn 2, tuỳ chọn): kéo một *buổi* trong `LichGrid` mở sẵn hộp "Dời buổi" điền ngày/giờ mới (hộp đó có sẵn thông báo học viên + Zalo, không được dời im lặng).

### 3.3 Tương tác chạm (< 640px)
Đường chính (luôn có, không cần cử chỉ):
1. Bấm ô trống → **panel dạng ngăn dưới** (dùng `Modal` có sẵn trong `components/tutor/shared`) điền sẵn thứ + giờ bắt đầu snap 15' + 90 phút; có bộ chọn "Thứ" (select), "Bắt đầu", "Kết thúc" (`<input type="time" step="900">` hoặc select 15'), nút **−15 / +15** cạnh mỗi giờ (≥ 44px).
2. Bấm khối → chọn khối (hiện tay nắm ở hai đầu, vùng chạm 44px) và mở panel cùng loại.

Đường phụ (nâng cấp, nếu có thời gian): **chạm-giữ-kéo**.
- `pointerdown` (touch) trên khối/ô trống → hẹn giờ **350ms**; nếu ngón di > 8px trước khi hết giờ → hủy hẹn (đó là cuộn, để trình duyệt cuộn).
- Hết 350ms mà ngón đứng yên → bật `dragging=true`, rung nhẹ nếu `navigator.vibrate`, gắn `touchmove` **non-passive** và `preventDefault()` **chỉ khi `dragging`**. CSS `touch-action: pan-x pan-y` mặc định (cho cuộn dọc + ngang), không đặt `none` trên cả lưới. Ghi chú kỹ thuật: `touch-action` được đọc lúc `touchstart`, đổi giữa cử chỉ không có tác dụng; vì vậy phải dùng `preventDefault` ở `touchmove` sau khi chắc chắn chưa bắt đầu cuộn (ngón đứng yên 350ms).
- Chặn menu giữ-chạm: `onContextMenu preventDefault` trên khối, `-webkit-touch-callout:none; user-select:none`.
- Nếu trình duyệt phát `pointercancel` (đã bắt đầu cuộn) → hủy thao tác, không thay đổi dữ liệu.
- Khối thấp hơn 44px: thêm vùng chạm trong suốt (pseudo-element) cho đủ 44px, không đổi hình.

**Chế độ NGÀY** (mặc định ở 390px, `density="day"`): một cột, 64px/giờ, dải chọn ngày T2…CN phía trên (7 nút ≥ 44px, ghi số khung từng ngày bằng chữ "2 khung", không chỉ chấm), vuốt/nút "‹ ›" chuyển ngày. Kéo dời sang ngày khác **không** có trong chế độ ngày (đổi ngày bằng select trong panel).
**Chế độ TUẦN cuộn ngang** (nút chuyển "Ngày | Tuần"): 7 cột × tối thiểu 96px + cột giờ cố định (`position: sticky; left:0`), cuộn ngang trong khung; 56px/giờ. Không để trang tràn ngang ở 390px (kiểm `scrollWidth <= clientWidth` của `<main>`; chỉ khung lưới được cuộn).

### 3.4 Bàn phím + trợ năng
- Vùng lưới: `role="group"` `aria-label="Lịch khung giờ hằng tuần, 7 ngày"`; mỗi cột `role="group"` `aria-label="Thứ Ba"`.
- Mỗi khối: phần tử `<button>` `aria-label` từ `describeBlock()` (ví dụ "Toán 9, Thứ Ba, 19:00 đến 20:30, 90 phút, trùng giờ với Lý 8"), `aria-roledescription="khung giờ"`, `aria-pressed` khi được chọn. **Không** có tên học sinh trong nhãn.
- Phím khi khối có focus: `Enter`/`Space` mở panel · `↑/↓` dời ±15' · `←/→` dời ±1 ngày · `Shift+↑/↓` đổi độ dài (mép dưới) ±15' · `Alt+Shift+↑/↓` mép trên · `Delete`/`Backspace` tắt khung (có hoàn tác) · `Esc` đóng panel/hủy · `Ctrl/Cmd+Z` hoàn tác.
- Phím lặp (giữ mũi tên): gom về **một** lần ghi, gửi sau 400ms không còn phím mới.
- `aria-live="polite"` (một vùng duy nhất, `sr-only`): sau mỗi thao tác xong: "Đã dời Toán 9 sang Thứ Tư 19:00 đến 20:30." / "Đã tắt khung Toán 9 Thứ Ba." / "Không lưu được: …". Lỗi dùng `role="alert"`.
- Nút "**Thêm khung giờ**" (≥ 44px) ngoài lưới cho người không dùng chuột.
- Tab order: nút điều khiển → khối theo thứ tự thứ rồi giờ → panel.
- Màu **không** là cách duy nhất: khung trùng có viền nét đứt + biểu tượng + chữ "Trùng giờ"; khung đã tắt có nền gạch chéo + chữ "Đã tắt"; bản nháp viền nét đứt + chữ "Chưa lưu"; khung lớp khác (ghost) có chữ tên lớp + "lớp khác".
- Màu chỉ dùng token `--kin-*` (`classAccentFor`, `--kin-tt-chu-loi`, `--kin-tt-chu-cho`, `--kin-nen-bang`, `--kin-vien-*`); không hex (`t-no-hex` quét cả tệp mới). Chuyển động tôn trọng `prefers-reduced-motion`.

### 3.5 Panel sửa chi tiết (Modal)
Trường: Thứ (select) · Bắt đầu · Kết thúc (+/− 15') · **Ghi chú/tên khung** (`note`, ≤ 200, đếm ký tự) · Hình thức (online/offline/chưa chọn) · Địa chỉ (hiện khi offline) · Link vào lớp (chỉ http/https) · (slot) nhãn giáo viên · nút **Lưu**, **Tắt khung / Bật lại**, **Xoá hẳn…** (`KinConfirm`, chữ: "Xoá hẳn khung này? Báo nghỉ và nhắc lịch gắn với khung sẽ không còn nơi tham chiếu. Nếu chỉ muốn tạm nghỉ, hãy chọn Tắt khung."). Mọi nút ≥ 44px.
Khối thông tin cố định trong panel: "Khung này lặp **mọi tuần**. Muốn dời một buổi, mở buổi đó ở Lịch dạy rồi chọn Dời."

### 3.6 Trùng giờ
- **Cục bộ, tức thì** (`findConflicts` trong `scheduleDrag.ts`) so khối đang kéo với `blocks` cùng lớp (loại `cung-lop`) và `ghosts` lớp khác (loại `lop-khac`), cùng `dayOfWeek`, đúng luật `slotsOverlap` (chạm đầu không trùng). Hiện **ngay khi kéo** (khối đổi viền nét đứt + dòng chữ "Trùng giờ với Lý 8 (18:30–20:00)") và liệt kê dưới lưới.
- **Máy chủ, lúc ghi**: `PUT/POST` gửi `checkConflicts:true`; `409 {needsConfirm, conflicts[]}` → panel báo "Khung này trùng lịch: … (có N học sinh học cả hai lớp)" + nút **Vẫn lưu** (gửi lại `force:true`) và **Hoàn lại**. Đây là lấy lại đúng hành vi `TabLichHoc` (admin/khoa-hoc/[id]/page.tsx:2144-2147).
- **Không chặn cứng**: cả hai loại chỉ cảnh báo (máy chủ hôm nay cũng chỉ cảnh báo). Hai khung cùng lớp chồng nhau vẫn cho lưu (đồng giảng về sau cần cho phép). Chữ cảnh báo không có tên em, chỉ số.
- Lấy `ghosts`: **API mới** `GET /api/tutor/khung-gio` (mục 5.3).

### 3.7 Hoàn tác
- Ngăn xếp tối đa 20 thao tác (`invertOp` thuần, test được). Toast `Đã dời "Toán 9" sang Thứ Tư 19:00. [Hoàn tác]` hiện 8 giây (nút ≥ 44px) + `Ctrl/Cmd+Z`.
- `update` đảo bằng `update` giá trị cũ; "tắt" đảo bằng "bật"; `create` đảo bằng **tắt** (không xoá cứng, tránh id mồ côi) ở chế độ có `courseId`, bằng xoá ở chế độ cục bộ; "xoá hẳn" **không** hoàn tác được (đã qua `KinConfirm`).

### 3.8 Trạng thái
- **Đang tải** (`state="loading"`): khung lưới xám `kin-skel` đúng kích thước, `aria-busy="true"`, `aria-label="Đang tải lịch khung giờ"`.
- **Lỗi** (`state="error"`): `ErrorStrip` "Không tải được khung giờ của lớp. Kiểm tra mạng rồi thử lại." + **Thử lại**; lưới ẩn.
- **Rỗng** (không khung): lưới trống vẫn dùng được (đây là chỗ để kéo) + dòng nổi bật "Lớp chưa có lịch học. Kéo trên lưới để thêm khung giờ, hoặc bấm Thêm khung giờ." + (chế độ có `courseId`) ghi rõ hệ quả: "Học sinh sẽ không thấy buổi nào trong lịch cho tới khi có khung."
- Mỗi lần ghi: nút/khối đang lưu có `aria-busy`, chữ "Đang lưu…"; lỗi → hoàn lại vị trí cũ + `role="alert"` + (mạng) nút **Thử lại**.

### 3.9 Dùng lại ở hai nơi
| | Wizard (bước 2 "Lịch học") | Trang lịch / trang lớp |
|---|---|---|
| Chế độ | `local` — chưa có `courseId`; `onOp` chỉ đổi state | `remote` — có `courseId`; mỗi op gọi API, lạc quan, hoàn lại khi lỗi |
| Ghost | `GET /api/tutor/khung-gio` (lớp khác của cô) — tải một lần; lỗi tải ghost **không chặn** (chỉ mất cảnh báo trùng, nói rõ) | Cùng API, loại khung của chính lớp đang sửa |
| Lưu | Gom vào `schedules[]` gửi trong `POST /api/courses` khi bấm **Tạo lớp** | Từng thao tác |
| Giữ nguyên ở bước | "Buổi đầu từ ngày" + "Xem trước số tuần" + câu "có N buổi" (`previewSessionCount`, TaoLop.tsx:303-314) | — |

Hai vỏ: `KhungGioWizard` (nhỏ, nằm trong TaoLop) và `LichKhung` (`src/components/tutor/LichKhung.tsx`: tải, tải lại, thao tác, hàng đợi ghi theo từng khung — **tuần tự theo `id`** để không đảo thứ tự PUT —, hoàn tác, chọn lớp).

---

## 4. Logic thuần `src/lib/scheduleDrag.ts` (tut-code; test `t-schedule-drag-lib.ts`)

Không import React/DOM/Prisma. Được import `parseHm`, `hmOf` từ `classSessions.ts` (thuần). Hằng:
`SNAP_MIN=15`, `MIN_DURATION_MIN=15`, `DAY_END_MIN=1440`, `DEFAULT_DURATION_MIN=90`, `MAX_BLOCKS_PER_COURSE=14`, `NOTE_MAX=200`, `WEEK_ORDER=[1,2,3,4,5,6,0]`.

| Hàm | Việc | Ghi chú/luật |
|---|---|---|
| `snapMin(min, step=SNAP_MIN)` | làm tròn gần nhất | `NaN`/`±Infinity` → 0 hoặc kẹp, không ném |
| `pxToMin(px, pxPerHour, originMin)` / `minToPx(...)` | đổi pixel↔phút | `pxPerHour ≤ 0` → ném `RangeError` (lỗi lập trình, không thành NaN âm thầm) |
| `createRange(anchorMin, pointerMin)` | kéo tạo | thứ tự bất kỳ (kéo ngược) → chuẩn hoá; dài < 15 (kể cả bấm không kéo) → `DEFAULT_DURATION_MIN`; kẹp 0–1440 |
| `moveRange(r, deltaMin)` | dời | giữ độ dài; kẹp để `0 ≤ start`, `end ≤ 1440` |
| `resizeRange(r, edge, pointerMin)` | đổi mép | không cho `end - start < 15`; mép vượt mép đối diện thì dừng ở `±15'`, **không** hoán đổi |
| `moveBlock(b, {deltaMin, toDay})` | dời + sang ngày | `toDay` ngoài 0–6 → kẹp theo `WEEK_ORDER` (không vòng) |
| `overlaps(a, b)` | giao nhau | cùng `dayOfWeek` và `a.start < b.end && b.start < a.end` (**chạm đầu = không trùng**, khớp `slotsOverlap`) |
| `findConflicts(block, own, ghosts)` | danh sách trùng | `{otherId, kind:"cung-lop"\|"lop-khac", courseName, text}`; bỏ qua chính nó và khung `active:false`; `text` không chứa tên em |
| `layoutDayLanes(blocks)` | chia làn khối chồng nhau | trả `{lane, lanes}` ổn định, không phụ thuộc thứ tự mảng |
| `toApiSlot(b)` / `fromApiRow(row)` | đổi sang/từ `{dayOfWeek,startTime,endTime,…}` | `1440 ↔ "23:59"` (vì `parseHm` không nhận 24:00); `fromApiRow` với giờ sai định dạng → bỏ khung (trả `null`), không ném |
| `diffBlocks(before, after)` | tập thao tác tối thiểu | khung cùng `id` đổi thứ tự trong mảng ≠ thay đổi; dùng cho "so với dữ liệu cũ" |
| `applyOp(blocks, op)` / `invertOp(op, before)` | reducer + đảo | `applyOp(applyOp(s,op), invertOp(op,s))` ≡ `s` |
| `nudge(b, key, {shift, alt})` | phím → thay đổi | ánh xạ mục 3.4, kẹp như trên |
| `validateBlocks(blocks)` | kiểm trước khi gửi | trùng chính xác (cùng thứ+giờ), `end ≤ start`, >14 khung, `note` > 200; trả lỗi tiếng Việt đầu tiên hoặc `null`. **Không** coi chồng nhau là lỗi |
| `describeBlock(b)` | chuỗi aria | "Toán 9, Thứ Ba, 19:00 đến 20:30, 90 phút" |
| `weeklyMinutes(blocks)` | tổng phút/tuần | hiển thị "Tổng 4 giờ 30 phút mỗi tuần" |

`WizardSlot` (tutorStudentView.ts:124) và `validateSlots` **giữ nguyên** (tệp có test riêng); `TaoLop` đổi sang `ScheduleBlock` + `validateBlocks`, đổi bằng `toWizardSlots()` khi cần cho `previewSessionCount`.

---

## 5. Hợp đồng API (chỉ thêm; form = POST + 303; JSON khi client dùng `fetch`)

Mọi route dưới đây là **JSON-fetch từ component client** (không phải `<form>` HTML), nên trả JSON; trang `/lop-cua-toi/...` là trang đọc (RSC) nên không có form POST + 303 mới. Mẫu chị em: `class-schedules/route.ts`.

### 5.1 `POST /api/courses` (sửa, tut-code)
Thêm vào body, tất cả tùy chọn:
```jsonc
{
  "schedules": [ { "dayOfWeek": 2, "startTime": "19:00", "endTime": "20:30",
                   "note": "Toán 9", "mode": "offline", "location": "Phòng 3", "joinUrl": null } ],  // ≤ 14
  "requireSchedule": true,      // wizard gửi; bật thì schedules rỗng → 400 trừ khi noFixedSchedule
  "noFixedSchedule": false      // wizard gửi true khi gia sư tick "buổi lẻ"
}
```
- Kiểm từng phần tử bằng đúng luật `class-schedules` POST (dùng chung `normalizeHm`, `end>start`, `parseSessionPatch`, `normalizeJoinUrl`): lỗi → `400 {error, field:"schedules", index:n}` và **không tạo gì** (cùng `$transaction` với `tx.course.create`, route.ts:140-146).
- `requireSchedule && !schedules?.length && !noFixedSchedule` → `400 {error:"Lớp cần ít nhất một khung giờ học hằng tuần, hoặc chọn lớp học buổi lẻ.", code:"schedule_required"}`.
- Không kiểm trùng LI-10 khi tạo (lớp mới chưa có học sinh; trùng giữa các lớp cô chỉ cảnh báo ở wizard cục bộ).
- Thành công: `201` như cũ + `scheduleCount` (số khung đã tạo). Không `schedules` → hành vi cũ 100%.
- Quyền không đổi (`MANAGE_COURSES`, chủ lớp = người tạo).

### 5.2 `POST /api/courses/[id]/duplicate` (sửa, tut-code)
Trong `$transaction` hiện có: sao chép mọi `ClassSchedule` `active:true` của nguồn (`dayOfWeek,startTime,endTime,note,joinUrl,mode,location`, `active:true`). Trả `{id, schedulesCopied}`. `ownsResource` đã có (route.ts:31) → lớp người khác 403.

### 5.3 `GET /api/tutor/khung-gio` (mới, tut-code; dùng `requireTutor` như `api/tutor/schedule/route.ts`)
`?courseId=<id>` tùy chọn (lọc 1 lớp, vẫn kiểm chủ lớp), `?includeInactive=1`.
```jsonc
200 { "rules": [ { "id","courseId","courseName","color":"lop-07"|null,"dayOfWeek","startTime","endTime",
                    "note","mode","location","active" } ],
      "courses": [ { "id","name","scheduleCount" } ] }      // cho Hộp việc/chọn lớp
```
- Chỉ lớp có `ownerId = người gọi` (quản trị trung tâm: tất cả — theo `ownsResource`). **Không** trả danh sách học sinh/tên em/`joinUrl` của lớp khác (ghost chỉ cần giờ + tên lớp).
- Mã: 401 khách · 403 học sinh / gia sư chờ duyệt / không phải gia sư · 404 `courseId` không có · 403 `courseId` của người khác · `Cache-Control: no-store`.

### 5.4 `PUT /api/class-schedules/[id]` + `PATCH` (sửa nhỏ, **cần COO giao quyền tệp**, mục D2)
- Giữ PUT (đã sửa từng phần, đổi nhiều trường một lần được: `dayOfWeek,startTime,endTime,note,active,joinUrl,mode,location`). Thêm `export const PATCH = PUT` (cùng hợp đồng, cho khớp thói quen API chị em).
- Thêm: `note` > 200 ký tự → `400 {error:"Ghi chú tối đa 200 ký tự"}` (chỉ khi `note` có trong body).
- `DELETE` giữ nguyên; giao diện chỉ gọi khi "Xoá hẳn".

### 5.5 Giữ nguyên (chỉ gọi)
`GET /api/courses/[id]/class-schedules` (cả khung đã tắt) · `POST /api/courses/[id]/class-schedules` (+`checkConflicts`,`force`) · `POST /api/courses/[id]/schedule-conflicts` (lấy `sharedStudents` khi cần) · `POST /api/tutor/session-changes` (ngoại lệ một buổi) · `POST /api/tutor/ho-so/nhap` (nhập lịch hàng loạt).

### 5.6 Hộp việc `noSchedule` (tut-code, `tutorInbox.ts` + `tutorInboxServer.ts`)
Thêm `"noSchedule"` vào `InboxKind` và `META`; nguồn: `prisma.course.findMany({ where:{ ownerId:tutorId, classStatus:"open", classSchedules:{ none:{ active:true } } } })`; dòng chi tiết = tên lớp + liên kết `/lop-cua-toi/quan-lop/<id>/lich-hoc`. `InboxRaw = Record<InboxKind, …>` nên **mọi chỗ dựng `InboxRaw` (kể cả test) phải thêm khoá** — tut-code rà `rg "InboxRaw|INBOX_KINDS"`.

---

## 6. Schema (chỉ thêm) — **không thêm gì trong PR này**

- `ClassSchedule` (schema.prisma:102-120) đủ: `dayOfWeek,startTime,endTime,note,joinUrl,mode,location,active`. Tên khung = `note`. Không cần cột `title` (nếu chủ muốn tách "môn" khỏi "ghi chú": cột nullable `title String?` — hoãn, mục D3).
- Không thêm giá trị mới cho `Enrollment.status`.
- PR đồng giảng sẽ thêm `ClassSchedule.teacherId` (nullable) ở nhánh riêng: PR này **không thêm**; thiết kế chừa `teacherLabel`, `renderBadge`, `canEdit` để nối vào mà không đổi props.
- Có thể cần về sau (không làm bây giờ, câu hỏi C2): `effectiveFrom String?` (dateKey) trên `ClassSchedule` để "đổi khung từ ngày X, tuần cũ giữ nguyên".

---

## 7. Luồng màn

### 7.1 Wizard tạo lớp (bước 2 "Lịch học", `TaoLop.tsx`)
- 1280: hai cột (`KIN_TWO_COL`): trái = `WeekScheduleEditor` (chế độ tuần, 56px/giờ, 6:00–22:00, nút "Hiện cả ngày"), phải = tóm tắt: danh sách chữ các khung ("Thứ Ba 19:00–20:30 · 90 phút"), "Tổng 3 giờ mỗi tuần", ngày buổi đầu, số tuần xem trước, câu "có N buổi", cảnh báo trùng.
- 390: một cột: chế độ NGÀY, nút "Thêm khung giờ" nổi bật, tóm tắt chữ bên dưới, rồi ngày bắt đầu + số tuần.
- Chữ đổi: phụ đề trang "Ba bước. Lớp nào cũng cần lịch học để học sinh thấy buổi và để KiN nhắc lịch." · mục "Lịch học · Bắt buộc" · rỗng: "Lớp chưa có khung giờ. Kéo trên lưới để thêm." · bỏ `:340-343` "Tất cả đều tùy chọn" → "Lịch học đặt ngay ở bước 2; đổi lại bằng lưới kéo-thả ở trang lớp."
- **Tiếp tục** ở bước 2 khi 0 khung: chặn, `role="alert"` "Cô thêm ít nhất một khung giờ học hằng tuần, hoặc chọn 'Lớp này học buổi lẻ' bên dưới." + đưa focus vào nút Thêm khung giờ.
- Lối thoát (một liên kết chữ, ≥ 44px): "Lớp này học buổi lẻ, không lặp hằng tuần" → `KinConfirm` "Lớp sẽ chưa có lịch cố định. KiN sẽ nhắc cô ở Hộp việc cho tới khi cô đặt lịch. Vẫn tạo lớp không lịch?" [Quay lại] [Vẫn tạo không lịch]. Chọn xong: `noFixedSchedule:true`, nút bước 3 vẫn "Tạo lớp"; gỡ được bằng cách thêm khung.
- Nút cuối: "Tạo lớp + N buổi" như cũ (`createButtonLabel`). Gửi một lần `POST /api/courses` kèm `schedules[]`, `requireSchedule:true`. Lỗi → ở lại wizard, giữ nguyên mọi trường, `role="alert"` (không còn trạng thái lớp-có-mà-lịch-lỗi; `lich=loi` thành mã chết — giữ khai báo trong LopChiTiet để link cũ không vỡ).
- Ba trạng thái: tải ghost (xám, không chặn) · lỗi tải ghost ("Chưa kiểm được trùng với lớp khác — vẫn tạo được.") · rỗng (như trên).

### 7.2 Trang khung giờ của lớp — `/lop-cua-toi/quan-lop/[id]/lich-hoc` (mới) và `/lop-cua-toi/lich/khung` (mới, có chọn lớp)
- Trang mỏng theo mẫu `giao-trinh/page.tsx` (cổng `redirectIfNotTutor`, giao cho `LichKhung courseId`). Dải tab `contentTabsFor` (tutorRoutes.ts:114) đổi href của "Lịch học" sang trang mới cho đường gia sư; `toAdminPath` của đường mới → `/admin/khoa-hoc/<id>?tab=lich-hoc` (mục D1).
- `/lop-cua-toi/lich/khung?lop=<id>`: thanh chọn lớp (select, nhớ `lop` trong URL) → cùng `LichKhung`. Từ `LichClient` thêm nút "Sửa khung giờ" (header, cạnh "+ Thêm buổi") và sửa câu rỗng `:397`.
- 1280: lưới tuần + cột phải "Khung của lớp" (danh sách chữ, bật/tắt, tổng giờ). 390: chế độ ngày + nút chuyển Ngày/Tuần.
- Trạng thái: như 3.8. Quyền: lớp người khác → màn "Bạn không có quyền với lớp này" (không dữ liệu); lớp không có → "Không tìm thấy lớp" (404 từ API → thông báo, không lộ thêm).
- `LopChiTiet`: `KinCallout` khi chưa lịch; mục "Lịch học" thêm tab hoặc nút → trang trên.

---

## 8. Máy trạng thái

**Duyệt gia sư (không đổi).** Chỉ gia sư đã duyệt dùng được API/trang mới (`requireTutor`, `redirectIfNotTutor`); gia sư chờ duyệt bị chặn như mọi route `api/tutor/**`.

**Khung giờ (`ClassSchedule`)**
```
(không có) --kéo/bấm--> NHÁP (client, chưa lưu) --Lưu--> BẬT (active=true)
BẬT --kéo dời/đổi dài/sửa panel--> BẬT        (PUT từng phần)
BẬT --Delete / "Tắt khung"--> TẮT (active=false) --"Bật lại" / Hoàn tác--> BẬT
BẬT|TẮT --"Xoá hẳn" + KinConfirm--> (mất)     (DELETE; không hoàn tác)
NHÁP --Bỏ / Esc--> (mất, không gọi API)
```
**Ghi một thao tác (chế độ có courseId):** `LẠC QUAN` → gửi → `OK` | `409 needsConfirm` → `CHỜ XÁC NHẬN` (Vẫn lưu → gửi `force`; Hoàn lại → trả vị trí cũ) | `LỖI` → trả vị trí cũ + báo + Thử lại.

**Buổi (`ClassSessionChange`, đã có, không đổi):** `theo khung` → `huỷ` | `dời` → khôi phục. Khung đổi **không** tự tạo `ClassSessionChange`.

**Mời / duyệt học sinh vào lớp:** không đụng.

---

## 9. Thông báo

- **Không thêm `type` thông báo mới.** Đổi khung hằng tuần hôm nay không báo học sinh (khớp PUT hiện tại) và PR này giữ nguyên.
- Rủi ro cần chủ biết (C3): học sinh thấy buổi đổi theo khung mà không được báo. Phương án nếu chủ muốn: sau khi lưu thay đổi giờ của khung đang có học sinh, hiện hộp "Báo lớp qua Zalo" soạn sẵn (giống `LichClient` notice, tin chung cả lớp, **không tên em, không tiền**), KiN vẫn không gửi giúp. Mặc định: **không làm** trong PR này, chỉ ghi chú trong panel.
- Chữ trên màn: không tên em, không số tiền (khung giờ không có tiền). `sharedStudents` chỉ là số.

---

## 10. Test phải có

Tên mới dùng tiền tố `t-schedule-drag-*` / `ui-schedule-drag*` (không đụng bài của phòng khác). Chạy **tuần tự**, cổng 3100 (COO chạy). `tut-test` không sửa `src/`.

### 10.1 `t-schedule-drag-lib.ts` (thuần, ≥ 45 ca; có ca phá cố ý)
- `snapMin`: 0, 7→0, 8→15, 22→15, 23→30, 1439→1440, âm (−5→0 sau kẹp), `NaN`, `Infinity`, số lẻ 7.5.
- `pxToMin`/`minToPx` khứ hồi với 48/56/64 px/giờ; `pxPerHour=0` và âm → ném `RangeError`; px âm/rất lớn → kẹp.
- `createRange`: kéo xuôi/ngược cho cùng kết quả; click không kéo → 90 phút; kéo trước 0:00 và sau 24:00 → kẹp; bắt đầu 23:50 → `[1425,1440]` (min 15').
- `moveRange`: dời qua 24:00 (start 1380, dài 90, +60) → kẹp `[1350,1440]`, **giữ độ dài**; dời trước 0:00; delta `Infinity`; delta 0 trả đúng đối tượng giá trị cũ.
- `resizeRange`: mép dưới kéo lên trên mép trên → dừng ở start+15, **không hoán đổi**; mép trên kéo xuống dưới mép dưới tương tự; kéo vượt 24:00 / dưới 0:00; dài đúng 15 giữ nguyên.
- `moveBlock`: `toDay` = −1, 7, 3.5, `NaN` → kẹp/ bỏ; Chủ nhật (0) đứng cuối `WEEK_ORDER`, không vòng sang T2.
- `overlaps`: giao một phần, chứa nhau, **chạm đầu 18:00–19:00 vs 19:00–20:00 = không trùng**, khác thứ, cùng khung với chính nó; `findConflicts` bỏ khung `active:false`, kind `cung-lop`/`lop-khac`, `text` **không** chứa chuỗi tên học sinh giả đặt trong dữ liệu mẫu.
- `layoutDayLanes`: 3 khối chồng nhau, thứ tự mảng xáo → cùng kết quả; không chồng → 1 làn.
- `toApiSlot`/`fromApiRow`: `1440↔"23:59"`, `"9:05"`→`"09:05"`, giờ `"25:00"`/`"abc"`/`null` → `null`, `"24:00"` → `null`.
- `diffBlocks`: không đổi → rỗng; đổi thứ tự mảng → rỗng; một khung dời + một thêm + một bớt → đúng 3 thao tác.
- `applyOp/invertOp`: 200 chuỗi thao tác ngẫu nhiên (PRNG hạt cố định) rồi đảo ngược hết → trạng thái ban đầu; đảo `remove` ở chế độ cục bộ.
- `validateBlocks`: trùng chính xác, `end≤start`, 15 khung (vượt trần 14), `note` 201 ký tự, chồng nhau **không** là lỗi.
- `nudge`: mọi phím ở biên (start=0 nhấn ↑, end=1440 nhấn ↓, Shift+↑ khi dài 15).

### 10.2 `t-schedule-drag-api.ts` (API; ma trận quyền lặp cho từng route)
Nhân vật: gia sư chủ lớp A · gia sư lạ B · quản trị trung tâm · học sinh · khách · gia sư chờ duyệt.
- Chung cho `GET/POST class-schedules`, `PUT/PATCH/DELETE class-schedules/[id]`, `schedule-conflicts`, `GET /api/tutor/khung-gio`, `POST /api/courses` (có `schedules`), `duplicate`:
  - **B (gia sư lạ) → 403, và DB không đổi** (đếm lại `ClassSchedule` trước/sau).
  - **Lớp/khung không có → 404** (cả `id` rác, `id` rỗng).
  - Học sinh → 403 · khách → 401 · **gia sư chờ duyệt bị chặn** (403; nếu hôm nay trả 200 ở route cũ → ghi là lỗi có sẵn, không tự sửa) · quản trị trung tâm → 200/201.
- `POST /api/courses` + `schedules`: tạo nguyên tử (khung thứ 3 hỏng → **không** có Course, không có khung nào); 15 khung → 400; `requireSchedule` không `schedules` → 400 `schedule_required`; `requireSchedule`+`noFixedSchedule` → 201 `scheduleCount:0`; không có cờ nào → hành vi cũ (các bài cũ vẫn xanh); `endTime:"24:00"` → 400; `"23:59"` → 201; `startTime>=endTime` → 400; `joinUrl` `javascript:` → 400; `note` 201 ký tự → 400; `dayOfWeek` 7/−1/"2" → 400; gia sư thường không đặt được `ownerId` người khác qua body.
- `duplicate`: chép đúng số khung **đang bật**, bỏ khung tắt; bản sao có `ownerId` = người nhân bản; khung bản sao là bản ghi mới (id khác); lớp người khác 403 và không tạo bản sao.
- `PUT/PATCH`: đổi nhiều trường một lần (thứ + giờ + note); chỉ `endTime` nhỏ hơn `startTime` đang lưu → 400, giữ nguyên; `active:false` rồi `GET` còn thấy; `PATCH` ≡ `PUT`; trùng giờ lớp khác của cùng gia sư với `checkConflicts` → 409 `needsConfirm`, với `force` → 200; **trùng với lớp của gia sư khác → không báo** (không lộ lớp người khác).
- `GET /api/tutor/khung-gio`: chỉ trả khung lớp của mình; **không có** `joinUrl` của lớp khác, không trường tên học sinh (quét JSON bằng tên em mẫu); `includeInactive`; `courseId` người khác → 403.
- Học sinh/phụ huynh vẫn thấy lịch đúng sau khi gia sư đổi khung (`t-student-schedule-link` chạy lại không đỏ).
- **Bất biến TIỀN (chỉ đọc)**: đổi/tắt/xoá một khung có buổi đã chốt trong quá khứ **không** đổi `TuitionInvoice`/`feeCharge`/số buổi tính phí đã chốt (đếm trước/sau). Nếu đỏ → dừng, báo COO (cờ TIỀN).

### 10.3 `ui-schedule-drag.ts` (trình duyệt thật, **1280 và 390**)
Bắt buộc **kéo thả thật**, không gọi hàm nội bộ:
- 1280 chuột: `page.mouse.move/down/move(steps)/up`:
  1. kéo trên ô trống thứ Ba 19:00→20:30 → khối nháp, nhãn giờ sống đúng, panel mở; Lưu → có bản ghi DB `19:00–20:30` (đọc bằng Prisma);
  2. kéo thân khối sang thứ Năm + 30' → DB `dayOfWeek=4`, giờ đúng, giữ độ dài;
  3. kéo mép dưới thêm 30' → `endTime` đúng; kéo mép trên vượt mép dưới → dừng tối thiểu 15';
  4. kéo ra ngoài lưới (thả ngoài) → không đổi gì; `Esc` giữa chừng → trả vị trí cũ, **không có request** (đếm request mạng);
  5. kéo khối vào giờ trùng lớp khác → có **chữ** "Trùng giờ" + liệt kê; vẫn lưu được; kéo vào đúng chạm đầu → **không** báo trùng;
  6. Delete trên khối focus → khung tắt, hiện "Hoàn tác", bấm → bật lại cùng `id`; "Xoá hẳn" hiện `KinConfirm` (không `window.confirm`), Hủy giữ nguyên;
  7. **lỗi mạng**: chặn route PUT → khối quay về vị trí cũ + `role=alert` + Thử lại;
  8. 409 giả (lớp khác cùng giờ, có em chung) → panel "N học sinh học cả hai lớp" → Vẫn lưu.
- Bàn phím: Tab tới khối, `ArrowDown` ×4 → một PUT duy nhất sau 400ms (gom phím), `+60'`; `Shift+ArrowDown` đổi độ dài; `Enter` mở panel; vùng `aria-live` chứa câu "Đã dời …".
- 390 chạm: dùng `touchscreen.tap` (đường chính: bấm ô trống → panel, chọn giờ bằng bộ chọn, Lưu) và **chạm-giữ-kéo bằng CDP** `Input.dispatchTouchEvent` (`touchStart` → đợi 400ms → `touchMove`… → `touchEnd`): khối dời đúng; ca phá: ngón **di chuyển trước 350ms** → trang cuộn, khối **không** dời; `pointercancel` → không đổi dữ liệu.
- 390: chế độ Ngày/Tuần; `document.documentElement.scrollWidth <= innerWidth` (không tràn); mọi nút/chip ≥ 44px (đo `boundingBox`); không có `:hover`-only.
- Ba trạng thái: chặn `GET khung` → thấy `ErrorStrip` + Thử lại thành công; trì hoãn → `aria-busy`; lớp rỗng → câu "Lớp chưa có lịch học".
- Quyền UI: vào trang của lớp người khác → "không có quyền" không dữ liệu; lớp không có → "Không tìm thấy".
- `ui-links-everywhere` / `t-no-hex` / `ui-role-everything` do COO chạy gộp.

### 10.4 Bài CŨ phải sửa vì hành vi đổi (chỉ rõ tên, `tut-test` sửa — đây là bài `tools/local-e2e/` của phòng Gia sư, không phải `h.ts`)
| Bài | Chỗ đổi |
|---|---|
| `ui-tao-lop-wizard.ts` | Dòng "bước 3: chưa có khung giờ → nút 'Tạo lớp' (0 buổi)" nay **đỏ**: "Tiếp tục" ở bước 2 phải bị chặn khi 0 khung; thêm ca "Lớp này học buổi lẻ" → KinConfirm → nút "Tạo lớp" 0 buổi + DB `scheduleCount=0`. Các ca `[data-wizard-slot]`, `"Bỏ khung giờ 2"`, `select` "Ngày trong tuần", `getByLabel("Ngày trong tuần")` thay bằng thao tác trên lưới/panel; ca "hai khung trùng nhau → lỗi, KHÔNG tạo lớp" (`validateSlots`) giữ ở mức *trùng chính xác*; ca `Buổi đầu từ ngày` / `Xem trước số tuần` / "có N buổi" giữ nguyên chữ |
| `ui-tao-lop-per-session.ts` (:38, :58, :90) | Bấm "Tạo lớp" exact khi chưa có khung → thêm thao tác thêm một khung (hoặc tick buổi lẻ) trước |
| `ui-journey-new-tutor.ts` (:212-250) | G2b `Tạo lớp` exact + G3 `?tab=lich-hoc` "+ Thêm khung giờ": giữ G3 (tab của Quản trị còn nguyên trong PR này); sửa G2b cho bước lịch bắt buộc |
| `t-schedule-api.ts` | Giữ nguyên các ca cũ (phải vẫn xanh = bằng chứng tương thích); thêm ca `PATCH`, `note` 201 ký tự |
| `t-tutor-routes-lib.ts` | `contentTabsFor`: href tab "Lịch học" đường gia sư đổi sang `/lich-hoc`; `toAdminPath` đường mới |
| `t-tutor-inbox-lib.ts`, `t-tutor-inbox.ts` | Thêm khoá `noSchedule` vào `InboxRaw`, `INBOX_KINDS` nay có 14 phần tử, `inboxTotal` |
| `t-tut-003.ts` | Kiểm nếu đếm số hàng Hộp việc cố định |
Không sửa: `t-course-validate`, `t-course-ids`, `t-free-class-fee`, `t-hocphi-dashboard`, `ui-schedule*`, `ui-lich-rieng` — phải **vẫn xanh** (đây là kiểm tương thích của Q2).

---

## 11. Danh sách tệp (không trùng)

### tut-code (`src/lib`, `src/app/api`)
| Tệp | Việc |
|---|---|
| `src/lib/scheduleDrag.ts` (mới) | Logic thuần mục 4 |
| `src/app/api/courses/route.ts` | `schedules[]`, `requireSchedule`, `noFixedSchedule`, `scheduleCount` (POST) |
| `src/app/api/courses/[id]/duplicate/route.ts` | Chép khung đang bật |
| `src/app/api/courses/[id]/class-schedules/route.ts` | `note` ≤ 200, trần 14 khung/lớp (400) cho `POST` |
| `src/app/api/class-schedules/[id]/route.ts` | `PATCH = PUT`, `note` ≤ 200 — **cần COO giao** (mục D2) |
| `src/app/api/tutor/khung-gio/route.ts` (mới) | GET mục 5.3 |
| `src/lib/tutorInbox.ts`, `src/lib/tutorInboxServer.ts` | Loại `noSchedule` (5.6) |
| `src/lib/tutorRoutes.ts` | Tab "Lịch học" → `/lich-hoc` (đường gia sư), `toAdminPath` |
| `tools/local-e2e/t-schedule-drag-lib.ts`, `t-schedule-drag-api.ts` (mới); `t-schedule-api.ts`, `t-tutor-routes-lib.ts`, `t-tutor-inbox*.ts` (sửa) | Test (viết bởi tut-code theo quy ước; tut-test bổ sung ca phá) |
**Không chạm (TIỀN, chỉ đọc):** `sessionBook*`, `feeCharge*`, `invoiceServer*` (chỉ `import { requireTutor }`, `conflictsForRule`).

### tut-dev (`src/components/tutor`, `src/app/lop-cua-toi`)
| Tệp | Việc |
|---|---|
| `src/components/tutor/WeekScheduleEditor.tsx` (mới) | Component mục 3 |
| `src/components/tutor/LichKhung.tsx` (mới) | Vỏ có `courseId`: tải, ghi lạc quan, hàng đợi theo id, hoàn tác, trùng giờ máy chủ, chọn lớp |
| `src/components/tutor/TaoLop.tsx` | Bước 2 dùng editor chế độ cục bộ, bắt buộc ≥ 1 khung/tick buổi lẻ, một `POST` kèm `schedules[]`, bỏ vòng gửi tuần tự (:129-132) |
| `src/components/tutor/LopChiTiet.tsx`, `LopHoc.tsx` | Callout "Lớp chưa có lịch", liên kết "Đặt lịch", tab/nút Lịch học |
| `src/app/lop-cua-toi/(tutor)/lich/khung/page.tsx` (+ `KhungClient.tsx` nếu cần) (mới) | Trang `/lop-cua-toi/lich/khung` |
| `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/lich-hoc/page.tsx` (mới, mỏng) | Trang khung theo lớp |
| `src/app/lop-cua-toi/(tutor)/lich/LichClient.tsx` | Nút "Sửa khung giờ", sửa câu rỗng :397 |
| `tools/local-e2e/ui-schedule-drag.ts` (mới); `ui-tao-lop-wizard.ts`, `ui-tao-lop-per-session.ts`, `ui-journey-new-tutor.ts` (sửa) | Bài UI |
Hai bên làm **song song** theo hợp đồng mục 3.1/5; `tut-dev` dùng `scheduleDrag.ts` ngay (chữ ký mục 4 đã chốt), mock API trong `tools/local-e2e/mock/` nếu API chưa gộp.

---

## 12. Việc chủ cần quyết + cờ

### 12.1 Cờ
- **TIỀN — trình bày.** Không sửa tệp tiền. Nhưng: (1) khung đổi/tắt làm `expandOccurrences` đổi cho **cả tuần cũ** (xem 1.6); buổi đã chốt ở `AttendanceSession` giữ nguyên nên phí đã sinh không đổi — **phải được `tut-test` chứng minh bằng số (10.2 cuối)**; nếu không chứng minh được → dừng, báo. (2) Hôm nay phí sinh khi bấm "Đã dạy xong", không phải khi có khung, nên tạo khung không sinh phí.
- **TRẺ EM — trình bày.** Không thu thêm dữ liệu trẻ. Nhãn aria, chữ trùng giờ, `GET /api/tutor/khung-gio` không chứa tên em; `sharedStudents` là số.
- **ĐỔI NỀN — không.**

### 12.2 Câu hỏi (mỗi câu có mặc định đề xuất)
- **C1** Bắt buộc lịch ở wizard, còn lối thoát "buổi lẻ" — giữ hay bỏ lối thoát? *Mặc định: giữ* (1-kèm-1 và lớp ôn không cố định có thật; bỏ thì họ phải bịa một khung).
- **C2** Sửa khung có hiệu lực *từ tuần này* (mọi tuần, như hôm nay) hay *từ ngày X* (cần cột `effectiveFrom`, đổi nền)? *Mặc định: như hôm nay + chữ cảnh báo trong panel; làm `effectiveFrom` ở PR riêng nếu chủ thấy cần.*
- **C3** Đổi giờ khung có học sinh đang học: có hiện hộp "Báo lớp qua Zalo" soạn sẵn như khi Dời buổi không? *Mặc định: không (PR này), chỉ ghi chú.*
- **C4** Hộp việc `noSchedule` làm tăng số đỏ của gia sư có lớp trống ngay khi triển khai — chấp nhận? *Mặc định: có, vì đó là mục đích; nhưng không khẩn (không chuyển thành "Cần xử lý" đỏ).*
- **C5** Bước checklist "Đặt lịch học cho lớp" đổi thành "mọi lớp đang mở đều có lịch"? *Mặc định: không đổi.*
- **C6** Nút nhanh Delete = *tắt* khung (khuyến nghị) hay xoá cứng? *Mặc định: tắt + hoàn tác* (lý do Q6).
- **C7** Ngoại lệ một tuần bằng kéo trong `LichGrid` (mở hộp "Dời buổi" điền sẵn) có làm ở đợt này không? *Mặc định: để giai đoạn 2 sau khi lưới khung ổn định.*

---

## D. Yêu cầu đổi tệp chung / tệp phòng khác (gửi COO, mẫu BAN-GIAO mục D)

**D1 — Phòng Quản trị (adm-dev), tệp lớn `admin/khoa-hoc/[id]/page.tsx` + `components/admin/courses/*`**
```
MÃ VIỆC:       TUT-lich-keo-tha
TỆP:           src/app/(admin)/admin/khoa-hoc/[id]/page.tsx (TabLichHoc :2122-2300),
               src/components/admin/courses/CreateCourseDrawer.tsx, CoursePanel.tsx
ĐỔI GÌ:        (a) TabLichHoc: thay phần thân (danh sách + form "+ Thêm khung giờ") bằng
                   <LichKhung courseId={courseSlug} /> import từ "@/components/tutor/LichKhung" —
                   MỘT hành vi duy nhất cho gia sư và quản trị. Làm SAU khi tut-dev gộp LichKhung.
                   Cho tới lúc đó giữ nguyên (ui-journey-new-tutor G3 còn dùng).
               (b) CreateCourseDrawer: sau khi tạo, nếu lớp chưa có khung, hiện nhắc "Lớp chưa có lịch học" +
                   chuyển sang ?tab=lich-hoc; tuỳ chọn gửi schedules[] (API đã nhận).
               (c) CoursePanel (nhân bản): toast ghi "đã sao chép N khung giờ" từ `schedulesCopied`.
AI SỬA:        adm-dev (không để tut-dev tự sửa, đúng PHAM-VI)
ẢNH HƯỞNG:     pb-admin; ui-journey-new-tutor G3, ui-admin-courses, ui-course-ops
```
**D2 — Giao quyền tệp API chưa có chủ**
```
TỆP:           src/app/api/class-schedules/[id]/route.ts  (PHAM-VI chỉ liệt kê api/courses/**, api/tutor/**…)
ĐỔI GÌ:        thêm `export const PATCH = PUT`, giới hạn `note` ≤ 200 — chỉ thêm
AI SỬA:        đề xuất tut-code (ghi vào PHAM-VI: api/class-schedules/** thuộc pb-gia-su)
```
**D3 — `prisma/schema.prisma` (tệp chung): KHÔNG cần thay đổi trong PR này.**
Ghi nhận để COO điều phối: (i) PR đồng giảng thêm `ClassSchedule.teacherId String?` — PR này tương thích, hai nhánh không sửa chung dòng; (ii) khả năng về sau `ClassSchedule.title String?` và `effectiveFrom String?` (xem C2) — **chưa xin**.
**D4 — `tools/local-e2e/h.ts`: không cần đổi** (test dùng `prisma.classSchedule.create` như `ui-schedule.ts`).
**D5 — `src/components/kin/**`: không cần thành phần mới** (dùng `KinConfirm`/`useKinConfirm`, `Modal` của `components/tutor/shared`, `ErrorStrip`, `KinEmptyState`, `kin-skel`). Nếu `tut-dev` thấy cần "ngăn dưới" (bottom sheet) dùng chung → xin COO, đừng tự thêm vào `kin/`.
**D6 — `docs/kin/**`**: `kin-ghi-so` ghi tiến độ và backlog; nếu PR gộp, cập nhật `docs/kin/phong-ban/PHAM-VI.md` thêm `api/class-schedules/**` vào hàng pb-gia-su.

Thứ tự gộp gợi ý: (1) tut-code: `scheduleDrag.ts` + API → (2) tut-dev: component + wizard + trang → (3) adm-dev: D1 (b)(c) rồi (a).

---

## Hợp đồng API đã làm (tut-code, 07/11/2026)

Phần máy chủ xong; `schema.prisma` không đổi. Tệp thuần: `src/lib/scheduleDrag.ts` (đã commit sớm, chữ ký mục 4), `src/lib/scheduleInput.ts` (kiểm một khung từ thân yêu cầu, dùng chung).

**Khác/bổ sung so với đặc tả (tut-dev cần biết)**
- `scheduleDrag.ts` thêm kiểu `OpResult`, `Conflict`, `BlockPatch`; hàm `formatDuration(min)` ("4 giờ 30 phút"), `toWizardSlots(blocks)`; `ScheduleOp.create` có `at?` (vị trí chèn, để đảo thao tác xoá đúng thứ tự); `invertOp(op, before, { remote? })` trả `null` khi không hoàn tác được (remove ở chế độ từ xa, id lạ); `layoutDayLanes` trả `Record<id,{lane,lanes}>`; `findConflicts(block, own, ghosts)` trả `Conflict[]`.
- Quy ước: `snapMin` làm tròn nửa-bước LÊN (7.5 → 15); `moveRange` với delta NaN/±Infinity = không dời; `moveBlock.toDay` < 0 → Thứ Hai, > 6 → Chủ nhật, số lẻ làm tròn, NaN giữ nguyên ngày.
- `1440 <-> "23:59"` ở `toApiSlot`/`fromApiRow` (máy chủ không nhận "24:00").

**POST /api/courses** — thêm `schedules[]` (≤ 14), `requireSchedule`, `noFixedSchedule` (chỉ boolean `true` mới là cờ bật). Mỗi khung kiểm bằng `parseScheduleInput`: `dayOfWeek` phải là SỐ NGUYÊN 0–6, giờ `HH:MM` chuẩn hoá (`9:05` → `09:05`), end > start, `note` ≤ 200 và là chữ, `joinUrl` http(s), `mode` online|offline, `location`. Sai một khung → `400 {error, field:"schedules", index}` và không tạo gì; quá 14 → `400 {field:"schedules"}`; `requireSchedule` không khung không `noFixedSchedule` → `400 {code:"schedule_required"}`. Khung tạo cùng `tx.course.create` (một giao dịch). Thành công: `201` như cũ + `scheduleCount`. Không gửi gì mới → hành vi cũ. Không kiểm trùng LI-10 khi tạo.

**POST /api/courses/[id]/duplicate** — chép mọi khung `active:true` (thứ, giờ, note, joinUrl, mode, location) trong cùng `$transaction`; trả `{id, schedulesCopied}`.

**GET /api/tutor/khung-gio** `?courseId=&includeInactive=1` — `requirePermission(MANAGE_COURSES)` + `ownsResource`: gia sư thấy lớp của mình, quản trị trung tâm thấy mọi lớp; khách 401, học sinh / gia sư chờ duyệt 403, `courseId` không có 404 (kiểm trước), của người khác 403. Trả `{ rules:[{id,courseId,courseName,color,dayOfWeek,startTime,endTime,note,mode,location,active}], courses:[{id,name,scheduleCount}] }`, `Cache-Control: no-store`. KHÔNG có `joinUrl`, không học sinh. `scheduleCount` chỉ đếm khung bật. (Dùng `requirePermission` thay `requireTutor` để quản trị trung tâm cũng gọi được như mọi route chị em.)

**class-schedules** — `POST /api/courses/[id]/class-schedules`: `note` ≤ 200 → 400; tối đa 14 khung/lớp (đếm cả khung tắt) → 400 "tối đa 14"; `dayOfWeek` phải nguyên. `PUT /api/class-schedules/[id]`: `note` ≤ 200 (và phải là chữ hoặc null), `dayOfWeek` phải nguyên; `export const PATCH = PUT`. Dữ liệu cũ vượt 14 không bị đụng (vẫn sửa/tắt được). **Cần COO ghi `api/class-schedules/**` vào PHAM-VI của pb-gia-su (D2/D6).**

**Hộp việc** — `InboxKind` thêm `noSchedule` (không khẩn, nhãn "Chưa có lịch", tiêu đề "N lớp chưa có lịch học"); nguồn `noScheduleWhere(tutorId)` = lớp `classStatus:"open"` của gia sư không có khung `active:true`; dòng chỉ có tên lớp, `href` `/lop-cua-toi/quan-lop/<id>/lich-hoc`, không có nút (`commands: []`, dòng việc dẫn tới lớp đầu tiên). Cùng điều kiện đưa vào `TodoCounts.noSchedule` (số đỏ trên thanh module) và `buildTodoItems` (key `noSchedule`), nên **số đỏ tăng** với gia sư có lớp trống (C4). Bước checklist `lich` (C5) KHÔNG đổi.

**tutorRoutes.ts** — `contentTabsFor`: tab "Lịch học" trỏ `/lop-cua-toi/quan-lop/<id>/lich-hoc` (sáng với `/lich-hoc` và với `?tab=lich-hoc` cũ); `toAdminPath("/lop-cua-toi/quan-lop/<id>/lich-hoc")` → `/admin/khoa-hoc/<id>?tab=lich-hoc` (một chiều; `toTutorPath` không đổi). **Trang `/lich-hoc` do tut-dev làm — gộp hai bên cùng lúc, nếu không tab dẫn tới 404.** Bài UI cũ nào bấm tab "Lịch học" mong thấy form "+ Thêm khung giờ" của Quản trị (vd ui-journey-new-tutor G3 dùng thẳng `?tab=lich-hoc` nên không ảnh hưởng) cần tut-test soát.

**Bất biến TIỀN (chứng minh bằng số)** — `t-schedule-drag-api.ts` mục cuối: lớp theo buổi 150.000, 3 buổi đã chốt × 2 em = 6 dòng phí / 900.000đ + 1 phiếu; dời khung, tắt, xoá hết, thêm khung mới, nhân bản lớp → so từng dòng `FeeCharge`, `TuitionInvoice`, `AttendanceSession`, `CourseFeeRate` trước/sau: giống hệt. Không sửa `feeCharge*`/`invoiceServer*`/`sessionBook*`.

**Test** — `t-schedule-drag-lib.ts` (84 ca, đã thử phá 4 chỗ cho đỏ rồi trả lại), `t-schedule-drag-api.ts` (118 ca), sửa `t-tutor-inbox-lib`, `t-tutor-inbox`, `t-todo-lib`, `t-tutor-routes-lib`, `t-schedule-api`.
