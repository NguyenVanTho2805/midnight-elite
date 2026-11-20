# LOI-02 — Lõi dạy học: lớp và bài học của gia sư (đặc tả)

Phòng Gia sư · tut-rnd · 11/11/2026 · căn cứ `origin/main` `c5f6fb7d` (nhánh `claude/loi-lop-gia-su`). Số dòng ghi theo `c5f6fb7d`.
Nền: `GS-LOP-GON.md` (#154, trang lớp gọn), `BU-HS-NOP-TEP.md` (#155), `BU-02.md` / `BU-02-PHANG.md`. Figma: bỏ qua (mô tả bằng lời ở mục 4).
Cờ: **TIỀN = không** (Học phí, FeeCharge, điểm danh tính tiền: chỉ đọc) · **TRẺ EM = trình bày** (mục 2.C4, 2.E) · **ĐỔI NỀN = không**.
Quy ước chữ: gia sư gọi là "cô"; mọi màu `--kin-*`; nút ≥ 44px; không tràn ngang ở 390; mọi trạng thái có CHỮ.

---

## 1. Vấn đề

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 1 | Bấm một lớp rơi vào tab "Giáo trình" (danh sách phẳng + khung "Thêm mục vào lớp"); cây Chương · Bài nằm ở tab tên "Bài tập" (`?tab=chuong-bai`) — tên sai việc | `ThuVienLop.tsx:57` (`giaoTrinhHref`), `tutorRoutes.ts:84-87`, `tutorClassRoutes.ts:82,108`, `tutorRoutes.ts:127-134` |
| 2 | Dải tab có 6 mục, trong đó "Giáo trình" và "Lịch học" chủ đã bỏ | `tutorRoutes.ts:126-135` |
| 3 | Panel "Sửa bài học" còn ô "Link phòng Zoom" và hộp dán link tài liệu; chưa có ngày học | `TabChuongBai.tsx:463-470`, `DocumentsEditor.tsx:221-236`; `schema.prisma:211` (không có cột ngày) |
| 4 | Ô "tệp trả bài" (#155) có sẵn nhưng màn chấm `BaiTap.tsx` chưa gắn | `BaiTap.tsx:107-131` chỉ có nút "Mở bài nộp gốc"; `NopTepBox.tsx:513,535` xuất `NopTepStudentFiles`, `NopTepBox mode="tutor_return"`; API `api/media/nop-bai/dinh-kem/route.ts` có sẵn |
| 5 | Hộp việc: số đỏ ≠ số việc nhìn thấy | mục 8 |
| 6 | `<select>` gốc của trình duyệt ở trang Học sinh, panel bài, cài đặt lớp: lệch giao diện, khó bấm ở 390 | `HocSinh.tsx:125,133`, `AssignmentEditor.tsx:74`, `TabCaiDat.tsx:148,276` |

---

## 2. Quyết định A–G

### A. Thư viện lớp → mở thẳng tab "Bài học"

**A1. Thẻ lớp.** #154 đã có ảnh bìa (`ThuVienLop.tsx:20-31`), tên (`:40`), số học sinh (`:42`), trạng thái chữ (`:48-49`). Chỉ chỉnh:
- Liên kết "Mở lớp" (cả thẻ) → `baiHocHref(c.id)` = `classBase(c.id)` (gốc lớp, không query).
- Dòng "Chưa xếp lịch" và liên kết "Đặt lịch" (`:46`, `:59`) chỉ hiện khi `isLichOpen()`; tắt cờ thì dòng lịch chỉ hiện khi `c.schedule` có giá trị.

**A2. Dải tab mới (chủ lớp).** Đúng 4 tab, thứ tự cố định:

| # | Nhãn | href | Sáng khi |
|---|---|---|---|
| 1 | Bài học | `classBase(id)` | `sub === ""` và `tab ∉ {cai-dat, hoc-vien, diem-danh, lich-hoc}`; hoặc `sub` bắt đầu bằng `giao-trinh` (trang "Xem như học sinh") |
| 2 | Học sinh | `…/hoc-vien` | `sub = hoc-vien[/…]` hoặc `?tab=hoc-vien` |
| 3 | Điểm danh | `…/diem-danh` | `sub = diem-danh[/…]` |
| 4 | Cài đặt | `…?tab=cai-dat` | `tab = cai-dat` |

Trang `…/lich-hoc` (mở bằng link trực tiếp): dải vẫn hiện, **không tab nào sáng**.

**A3. Đồng giảng / giáo viên bộ môn.** Dải chỉ có **"Bài học"** (một tab). Thân "Bài học" của họ = `GiaoTrinh` (`embedded`) — đúng màn họ đang dùng hôm nay (có khoá theo nhóm `GiaoChoNhom.tsx`, API G1 trả theo vai). Không đưa họ vào `TabChuongBai` vì `QuanLopCourse.tsx:53` chặn người không phải chủ và `api/media/document/init/route.ts:30` trả 403 với người không phải chủ. `…/lich-hoc` của họ vẫn mở bằng link như cũ. Họ không mất lối nào: đường cũ `…/giao-trinh` của họ 307 về gốc, gốc vẽ đúng màn cũ.

**A4. Bảng đường cũ → mới.**

| Đường vào | Kết quả |
|---|---|
| `quan-lop/<id>` (không `tab`) | 200, thân Bài học (chủ: `TabChuongBai`; đồng giảng: `GiaoTrinh`) |
| `quan-lop/<id>?tab=chuong-bai` | 200, thân Bài học, tab Bài học sáng — **render thẳng, không chuyển hướng** |
| `quan-lop/<id>?tab=giao-trinh` / `?tab=<lạ>` | 200, thân Bài học |
| `quan-lop/<id>?tab=cai-dat[&muc=]` | 200, thân Cài đặt (như #154) |
| `quan-lop/<id>?tab=diem-danh|lich-hoc|hoc-vien` | chuyển hướng sang trang con như #154 (kiểu stream, xem A5) |
| `quan-lop/<id>/giao-trinh` (mọi query) | **307** + `Cache-Control: no-store` → `classBase(id)` (bỏ hết query) |
| `quan-lop/<id>/giao-trinh/xem/<lessonId>` | 200, giữ nguyên ("Xem như học sinh") |
| `/lop-cua-toi/<id>` (chủ lớp, không `tab` / lạ) | 307 → `classBase(id)` (trước: `…/giao-trinh`) — `legacyClassTarget` đổi nhánh mặc định |
| `/lop-cua-toi/<id>?tab=…` khác | như #154, không đổi |
| `/admin/khoa-hoc/<id>?tab=chuong-bai` (gia sư) | proxy 307 → `quan-lop/<id>?tab=chuong-bai` → 200 Bài học. Không sửa proxy |
| `POST api/tutor/lop/<id>/giao-trinh/muc` (form không JS) | 303 cũ về `…/giao-trinh?…` → 307 về gốc. Không sửa route đó |

**A5. Cách làm 307 cho `…/giao-trinh`.** Xoá `giao-trinh/page.tsx`, thêm `giao-trinh/route.ts`:
```ts
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: classBase(id), adminTo: "/admin" }); // khách → đăng nhập, chờ duyệt → /cho-duyet, học sinh → /lop-cua-toi
  return NextResponse.redirect(new URL(classBase(id), req.url), { status: 307, headers: { "Cache-Control": "no-store" } });
}
```
Lý do: route handler không chịu `(tutor)/loading.tsx` nên trả 307 thật; Next cấm `route.ts` và `page.tsx` CÙNG một đoạn, còn trang con `giao-trinh/xem/[lessonId]/page.tsx` ở đoạn sâu hơn nên vẫn sống (layout `[id]/layout.tsx` vẫn bọc nó). Không lộ dữ liệu: đích luôn là gốc lớp, gốc tự kiểm quyền. Kiểm bằng `next build` + `curl -sI` (mục 6). Dự phòng nếu `next build` từ chối: giữ `page.tsx` gọi `redirect()` (200 + meta refresh) và ghi nợ trong bàn giao — không sửa proxy.
`?tab=chuong-bai` chọn **render thẳng** (không 307) vì: nhiều liên kết đang trỏ vào nó (`BaiTap.tsx:201`, `NganKeoSua.tsx:103`, `TutorLibrary.tsx:29,59`, `LibraryView.tsx:28`, `baiTapServer.ts:51`) và trang gốc có `loading.tsx` nên không 307 được.

**A6. Lối chấm bài không mất.** Màn chấm ở module `/lop-cua-toi/bai-tap` (`(tutor)/bai-tap/page.tsx` → `BaiTap.tsx`), không phải tab lớp — không đổi đường. "Soạn bài tập tự nộp" (`BaiTap.tsx:201` `?tab=chuong-bai`) → nay vào thẳng Bài học, `AssignmentEditor` vẫn nằm trong panel sửa bài (`TabChuongBai.tsx:507-509`). Tên tab "Bài học" cố ý khác module "Bài tập".

**A7. Bỏ tab "Giáo trình" với chủ lớp — những gì đi theo.** Chủ lớp không còn màn danh sách phẳng. Ba thứ phải giữ trong Bài học:
- **Trạng thái bài (TRẺ EM).** Bài tạo từ Giáo trình phẳng là Nháp (`api/chapters/[id]/lessons/route.ts:61`). Cây hiện không hiện trạng thái → cô tưởng học sinh đã thấy. Quyết định: hàng bài có chip CHỮ khi `status !== "published"`: "Nháp · học sinh chưa thấy" / "Ẩn · học sinh không thấy". Panel có ô "Trạng thái" (KinSelect: Đã đăng · Nháp · Ẩn). Đổi trạng thái gọi API có sẵn `PATCH /api/tutor/lop/<courseId>/giao-trinh/trang-thai` `{ lessonIds: [id], status }` (`trang-thai/route.ts:11-24`, có luật chuyển trạng thái G4) — KHÔNG thêm `status` vào PUT bài. Lỗi đổi trạng thái: giữ phần đã lưu, báo riêng "Đã lưu bài, chưa đổi được trạng thái: <lỗi máy chủ>".
- **"Xem như học sinh ↗"** trong panel sửa bài → `${classBase(id)}/giao-trinh/xem/${lessonId}`.
- **Rỗng:** lớp chưa có phần nào → "Lớp chưa có bài học" + nút "Tạo chương đầu tiên" (tạo phần "Nội dung lớp" rồi chương "Chương 1" bằng API có sẵn, rồi mở hàng thêm bài).
Bỏ dòng dẫn "Tệp và video giáo trình mới nằm ở tab Giáo trình" (`QuanLopCourse.tsx:60-63`).

**A8. Ngay trong cây (không mở panel).** Hàng bài có nút "Sửa nhanh": hàng biến thành form một dòng [Tên bài] [Ngày] [Giờ] [Lưu] [Huỷ] (Enter lưu, Esc huỷ) → `PUT /api/lessons/<id>` `{ title, scheduledAt }`. Cuối mỗi chương: hàng "+ Thêm bài" cùng form → `POST /api/chapters/<id>/lessons` `{ title, scheduledAt }` (thêm bài nhanh = Đã đăng như hành vi cũ của cây). "Chi tiết…" mở panel đầy đủ. Chip ngày trên hàng bài (`formatVnLessonWhen`) bấm được → mở Sửa nhanh.

### B. Bỏ tab "Lịch học"
Bỏ khỏi `contentTabsFor` (cả chủ lớp lẫn đồng giảng). `…/lich-hoc/page.tsx` giữ nguyên, mở bằng link; dữ liệu `ClassSchedule` không xoá; điểm danh và học phí theo buổi không đổi dòng nào. Không sửa `TutorShell/StudentShell/adminNav/proxy/hostRouting` (LOI-01 lo cờ `NEXT_PUBLIC_KIN_MO_LICH` ở thanh bên).

### C. Panel "Sửa bài học"
**C1. Zoom.** Bỏ `SlotLinkEditor` Zoom (`TabChuongBai.tsx:463-470`). Cột `zoomUrl` giữ. Cách giữ dữ liệu: `LsForm.zoomUrls` vẫn nạp từ bài (`:218`) nhưng **không hiện ô, không gửi khoá `zoomUrl`** trong PUT (`:325-330`) — PUT chỉ ghi khoá có mặt (`api/lessons/[id]/route.ts:78-80`) nên giá trị cũ còn nguyên. `type` vẫn tính bằng `deriveTypes(videoUrls, zoomUrls, azotaUrls)` để bài cũ giữ nhãn "Live". POST thêm bài không gửi `zoomUrl`. `firstBadLink` (`lessonForm.ts:88-94`) bỏ ô "live" (không chặn lưu vì link cũ cô không sửa được). Bài có Zoom cũ: một dòng chỉ đọc "Bài này có link phòng Zoom cũ — học sinh vẫn thấy." `moveLink(…, "live")` → báo "Không còn ô Zoom riêng." (không chuyển).
**C2. Tài liệu.** Bỏ hộp "Hoặc dán link tài liệu" (`DocumentsEditor.tsx:221-236`) và dòng hướng dẫn Drive (`:238-240`). Thay bằng **một ô thả tệp rộng** (mục 4.3) dùng `useTaiLenTep` (init → gửi có % → complete, `useTaiLenTep.ts:58-83`), `FileAsset kind=document`, nhiều tệp, tối đa 2 tệp song song, 30 tài liệu/bài, 25 MB/tệp, đuôi `DOCUMENT_EXTS` (`mediaStorage.ts:108`). Giữ ô cam kết bản quyền (`DocumentsEditor.tsx:212-215`) và dòng `data-copyright-notice` (`:242`). Tài liệu cũ dạng link Drive trong JSON `documents` vẫn hiện (tên + đường), đổi thứ tự và **xoá được** (`:146-160` giữ nguyên). Không đổi hợp đồng `Lesson.documents`.
**C3. "Thêm link".** Video (YouTube/Drive, giữ `VideoUploadBox` như hiện) + Azota + "Deadline Azota" + "Thời lượng" gom vào một khối gập "Thêm link video · Azota", mở sẵn khi bài đã có link video/Azota.
**C4. Ngày học.** Hai ô `<input type="date">` + `<input type="time">` nhãn "Ngày học (giờ Việt Nam)", nút "Bỏ ngày". Lưu `scheduledAt` (mục 3). Lỗi tại chỗ: chỉ có ngày → "Chọn giờ học."; chỉ có giờ → "Chọn ngày học.". Nhân bản bài/chương KHÔNG chép `scheduledAt` (bài sao là buổi khác).
**C5. Thứ tự khối trong panel:** Tên bài* → Ngày học → Trạng thái → Khoá bài / Học thử miễn phí → Tài liệu (ô thả) → Thêm link (gập) → dòng Zoom cũ (nếu có) → bảng Azota / `AssignmentEditor` (chỉ khi sửa) → Ghi chú cho học viên → "Xem như học sinh ↗" (chỉ khi sửa).
**C6. Kho chưa bật.** Ô thả hiện "Kho tệp chưa bật — chủ cần cấu hình." + "Tài liệu cũ vẫn hiện cho học sinh." Không hiện `document.reason` (câu đó bảo dán link Drive — lối đã bỏ). Trang không vỡ; nút Lưu vẫn dùng được cho các ô khác.

### D. Schema + API `scheduledAt`
Thêm đúng hai dòng sau `status         String           @default("published")` (`schema.prisma:211`) của `model Lesson`, giữ nguyên chữ:
```
  // LOI-0111: ngày giờ học của bài (gia sư ghi ở màn sửa bài). Null = bài không gắn ngày. Dùng cho phiếu "Hôm nay có lớp" của học sinh.
  scheduledAt    DateTime?
```
Chỉ thêm, cột cho phép null, không mặc định, không chỉ mục. `GET /api/courses/<id>` tự trả trường này (include đủ cột, `api/courses/[id]/route.ts:20-33`). Hợp đồng ở mục 3.

### E. Tệp trả bài trong màn chấm `BaiTap.tsx`
Áp phần `BaiTap.tsx` của bản tham khảo `_sao-luu-worktree-0911/mi-wt-bu-hs-nop-tep.diff.patch:260-317`:
- `GradePanel`: bài nộp có `fileUrl` bắt đầu `/api/media/nop-bai/` → `<NopTepStudentFiles assignmentId submissionId />`; còn lại giữ "Mở bài nộp gốc ↗".
- Trong form, trên nút gửi: `<NopTepBox key={cur.id} ref={returnRef} mode="tutor_return" assignmentId={item.id} submissionId={cur.id} />` (nhãn "Tệp trả bài (không bắt buộc)").
- `send()`: chấm điểm trước (`api.assignments.grade`); chỉ khi điểm lưu xong mới `await returnRef.current?.attach()`. Lỗi đính kèm → điểm GIỮ, báo riêng `role="status"`: "Điểm đã gửi. Chưa đính kèm được tệp trả bài — bấm Gửi lại để thử đính kèm." Lỗi chấm → không gọi attach.
- Đường máy chủ đủ: `api/media/nop-bai/{init,complete,dinh-kem,danh-sach,[fileId]}` (#155). `dinh-kem` dùng `graderGate` (= `requireAssignmentAccess(…,"grade")`), JSON. **Không thiếu đường nào** → không có việc máy chủ cho tut-code ở mục này.
- TRẺ EM: giữ cách hiện tên như `GradePanel` hiện có (chỉ người chấm có quyền mới thấy); thông báo "đã trả bài" do `dinh-kem` gửi không tên, không điểm, không tên tệp (đã có); ô xác nhận bản quyền của `NopTepBox` giữ nguyên. Không sửa `src/components/student/nop-tep/*` (chỉ import).

### F. Hộp việc: số đỏ = số việc nhìn thấy
Kết luận sơ bộ ở mục 8. Quyết định sửa (một nguồn sự thật):
- `tutorInbox.ts`: thêm `INBOX_ACTION_KINDS` (= `INBOX_KINDS` bỏ loại `waiting`, hiện chỉ có `consent` — `tutorInbox.ts:77`), `todoCountsToRaw(c)`, `todoBadgeTotal(c)`; `inboxTotal(raw)` đổi nghĩa: chỉ cộng `INBOX_ACTION_KINDS`.
- `tutorDashboard.ts:46-48` `loadTutorTodoTotal` = `todoBadgeTotal(await loadTutorTodoCounts(...))` (không còn cộng mọi khoá).
- Cờ lịch: `isLichOpen()` false (mặc định) ⇒ `loadTutorTodoCounts` KHÔNG chạy truy vấn `noScheduleWhere` và trả `noSchedule: 0` (`tutorDashboard.ts:32`); `loadTutorInboxRaw` không tải `noSchedCourses` (`tutorInboxServer.ts:93`), `noSchedule: mk(0, [], null)` ⇒ không có dòng nhắc đặt lịch.
- `HopViec.tsx:61`: bỏ đếm bằng cách đọc số đầu tiêu đề; "Cần cô xử lý · N việc" dùng `d.total` của API. "Chờ phụ huynh" vẫn hiện (không tính vào số đỏ, đúng chữ "Không tính là việc cô cần làm" `:130`).
- Số đỏ ở layout bị cũ khi điều hướng phía trình duyệt (H3, mục 8): `HopViec` khi tải lại do cửa sổ lấy lại focus (`:52-57`) gọi thêm `router.refresh()` để layout tính lại số đỏ.
- Không sửa `LopCuaToiFrame.tsx` (gọi `loadTutorTodoTotal` như cũ — đổi bên trong hàm là đủ).

### G. `src/components/kin/KinSelect.tsx` (mới)
API (gần `<select>`):
```ts
export interface KinSelectOption { value: string; label: string; disabled?: boolean }
export interface KinSelectProps {
  value: string; onChange: (value: string) => void; options: KinSelectOption[];
  name?: string;              // có ⇒ <input type="hidden" name={name} value={value}> để gửi form
  id?: string; disabled?: boolean; placeholder?: string;   // placeholder khi value không khớp lựa chọn nào
  "aria-label"?: string; "aria-labelledby"?: string; className?: string;
}
```
Hành vi: nút `role="combobox"` `aria-haspopup="listbox"` `aria-expanded` `aria-controls` `aria-activedescendant`; danh sách `role="listbox"`, mục `role="option"` `aria-selected` `aria-disabled`. Bàn phím: đóng — ↓/↑/Enter/Space mở (tô mục đang chọn), gõ chữ nhảy tới mục đầu khớp (so không dấu); mở — ↑↓ đi, Home/End, Enter chọn + đóng, Esc đóng + trả tiêu điểm về nút, Tab đóng. Bấm ngoài đóng. Khi `options.length > 8`: ô tìm ở đầu danh sách (lọc không dấu, chứa chuỗi), không khớp → chữ "Không có lựa chọn khớp". Nút và mỗi mục cao ≥ 44px; danh sách rộng bằng nút, `max-height: min(320px, 50vh)`, cuộn dọc, `max-width: calc(100vw - 2rem)` — không tràn 390. Chỉ token `--kin-*`, không hex. Không sửa `src/components/kin/index.ts` (import thẳng tệp).
Thay: `HocSinh.tsx:125` (Lớp: Tất cả lớp), `:133` (lọc cảnh báo), `AssignmentEditor.tsx:74` (loại câu hỏi — nằm trong panel bài), `TabCaiDat.tsx:148` (môn), `:276` (trạng thái lớp), ô "Trạng thái" mới của panel. Không thay ở trang học sinh / quản trị / `LopHoc.tsx`.

---

## 3. Hợp đồng API `scheduledAt` + hàm thuần

**Hàm thuần — `src/lib/tutorLessonDate.ts` (mới, tut-code; không Prisma, chạy được ở trình duyệt):** giờ VN cố định UTC+7 (không giờ mùa hè).
```ts
/** "2026-11-13" + "19:00" (giờ VN) → ISO UTC "2026-11-13T12:00:00.000Z". Cả hai rỗng ⇒ { ok:true, iso:null }.
 *  Thiếu một nửa / ngày không có thật (2026-02-30) / giờ ngoài 00:00–23:59 / năm ngoài 2020–2099 ⇒ { ok:false, error } (chữ tiếng Việt). */
export function parseVnDateTime(date: string, time: string): { ok: true; iso: string | null } | { ok: false; error: string };
/** ISO → { date:"YYYY-MM-DD", time:"HH:mm" } theo giờ VN; null / rác ⇒ { date:"", time:"" }. */
export function isoToVnParts(iso: string | null | undefined): { date: string; time: string };
/** Chip trên cây: "T6 13/11 · 19:00" (thêm "/2027" khi khác năm VN của `now`); CN viết "CN". null / rác ⇒ null. */
export function formatVnLessonWhen(iso: string | null | undefined, now?: Date): string | null;
/** Máy chủ: đọc body.scheduledAt. Vắng khoá ⇒ { ok:true, value: undefined } (không đổi); null ⇒ null; chuỗi ISO 8601 đầy đủ có múi giờ
 *  (Z hoặc ±hh:mm), Date hợp lệ, năm 2020–2099 ⇒ Date. Mọi thứ khác ("", "abc", số, "2026-11-13" không giờ, mảng) ⇒ { ok:false, error }. */
export function parseScheduledAtInput(v: unknown): { ok: true; value: Date | null | undefined } | { ok: false; error: string };
```
Tròn vòng: `parseVnDateTime(isoToVnParts(x).date, isoToVnParts(x).time).iso === x` với mọi `x` đúng phút.

**`src/lib/tutorFlags.ts` (mới, tut-code):**
```ts
export const lichOpenFrom = (v: string | undefined): boolean => v === "1";
/** Đọc tĩnh process.env.NEXT_PUBLIC_KIN_MO_LICH (để Next nhúng được vào mã trình duyệt). Mặc định (không đặt) ⇒ false. */
export const isLichOpen = (): boolean => lichOpenFrom(process.env.NEXT_PUBLIC_KIN_MO_LICH);
```

**`PUT /api/lessons/[id]`** (JSON, client gọi bằng fetch):
- Thứ tự giữ như route: `requireCourseAccessBy(…,"content.edit.own")` → `canEditChapter` → đọc body. Body JSON hỏng → 400 "Dữ liệu gửi lên không đúng." (thay `await req.json()` ném lỗi ở `route.ts:71`).
- `if ("scheduledAt" in body)`: `parseScheduledAtInput` → lỗi ⇒ 400 `{ error: "Ngày học không hợp lệ." }`; được ⇒ `data.scheduledAt = value`. Vắng khoá ⇒ không đổi cột. `scheduledAt` KHÔNG vào mảng `allowed` (`:74-77`) mà xử lý riêng.
- Mã trả: chưa đăng nhập 401 · học sinh 403 · gia sư chờ duyệt 403 · không có bài 404 · bài lớp người khác 403 · bộ môn ngoài nhóm 403 `ROLE_FORBIDDEN` · rác 400 · được 200 (bản ghi bài, có `scheduledAt` ISO hoặc null).
**`POST /api/chapters/[id]/lessons`**: cùng `parseScheduledAtInput`, kiểm SAU `canEditChapter` và kiểm `title`; vắng / null ⇒ `scheduledAt: null`; rác ⇒ 400 (không tạo bài). Trả 201 như cũ.
Không thêm API khác; không thông báo mới (không có `notify` nào trong mục D).

**Lib dùng chung khác (tut-code sở hữu, tut-dev import):**
- `tutorRoutes.ts`: `contentTabsFor(pathname, tab, role)` (chữ ký giữ) theo bảng A2/A3; `baiHocHref(courseId: string): string` = `classBase(courseId)`; `giaoTrinhHref(id, true)` trả `classBase(id)` (bí danh cũ, nhánh quản trị `…?tab=chuong-bai` giữ).
- `tutorClassRoutes.ts`: `type ClassPageDecision = { kind: "redirect"; to: string } | { kind: "tab"; tab: "bai-hoc" | "cai-dat"; muc: MucCaiDat }`. `classPageDecision`: không tab / `chuong-bai` / `giao-trinh` / lạ ⇒ `{tab:"bai-hoc"}`; `cai-dat` ⇒ như cũ; `diem-danh|lich-hoc|hoc-vien` ⇒ redirect như cũ. `legacyClassTarget` nhánh mặc định (`:82`) ⇒ `Q` (gốc).
- `tutorInbox.ts`: `INBOX_ACTION_KINDS: InboxKind[]`, `todoCountsToRaw(c: TodoCounts): Record<InboxKind, number>`, `todoBadgeTotal(c: TodoCounts): number`, `inboxTotal(raw)` (nghĩa mới). API `/api/tutor/hop-viec` giữ hình `{ items, total, overview }`.

---

## 4. Mô tả màn

**4.1 Trang lớp — 1600.** Vỏ gia sư (thanh bên trái). Khung nội dung: `ClassHead` (h1 tên lớp; dòng phụ "Môn · n học sinh · trạng thái chữ"; "← Lớp học"), dưới là dải 4 tab ngang "Bài học · Học sinh · Điểm danh · Cài đặt". Thân Bài học: dòng tóm tắt "n phần · n chương · n bài" + "+ Thêm phần" bên phải; mỗi Phần là một khối viền, Chương là hàng gập (▶/▼, tên, "n bài", Sửa, Xoá); hàng bài một dòng: kéo · tên · chip loại (Video/Azota/Live/Tài liệu) · chip trạng thái (chỉ khi Nháp/Ẩn) · chip ngày · "Học thử" · hành động "Sửa nhanh" "Chi tiết…" khoá ⋯. Cuối chương: "+ Thêm bài". Panel phải rộng 480px phủ lên, nền mờ.
**4.2 Trang lớp — 390.** `ClassHead` xuống dòng đủ chữ; dải tab cuộn ngang (4 tab vừa khổ, tab sáng được kéo vào giữa). Hàng bài thành 3 dòng: tên (xuống dòng, không cắt) / các chip (xuống dòng) / hàng nút ≥ 44px; ẩn tay kéo. Form "Sửa nhanh": Tên một dòng, Ngày + Giờ cùng dòng, Lưu/Huỷ dòng dưới. Panel = toàn màn (`min(480px,100vw)`), nút Lưu/Huỷ dính đầu. Không cuộn ngang ở bất kỳ trạng thái nào.
**4.3 Ô thả tệp (khối "Tài liệu" của panel).** Rộng hết panel, cao tối thiểu 160px, viền đứt `--kin-vien-o-nhap`. Component mới `src/components/tutor/upload/OThaTep.tsx` (tự đếm dragenter/leave để biết "kéo vào"; không sửa `src/components/DropZone.tsx` dùng chung). Thuộc tính `data-o-tha` theo trạng thái:

| Trạng thái | `data-o-tha` | Chữ / hành vi |
|---|---|---|
| Đang kiểm kho | `dang-kiem` | "Đang kiểm kho tệp…" (`role=status`, `aria-busy`) |
| Lỗi kiểm | `loi-kiem` | "Chưa kiểm được kho tệp." + "Thử lại" |
| Kho chưa bật | `tat` | "Kho tệp chưa bật — chủ cần cấu hình." · "Tài liệu cũ vẫn hiện cho học sinh." Không nhận tệp |
| Không phải chủ lớp | `khong-chu` | "Chỉ chủ lớp tải tệp lên KiN." |
| Rỗng (sẵn sàng) | `san-sang` | "Kéo thả tệp Word, PDF, Excel, PowerPoint hoặc ảnh vào đây" · "PDF, DOC… · tối đa 25 MB mỗi tệp · tối đa 30 tài liệu mỗi bài" · nút "Chọn tệp từ máy" (`<input type=file multiple accept>`) · ô cam kết bản quyền · "Tệp sẽ hiện cho học sinh của lớp ngay khi bài được lưu." |
| Kéo vào | `keo-vao` | nền `--kin-nhan-nen-nhat`, viền liền `--kin-nhan-nen`, chữ "Thả tệp để tải lên" |
| Đang tải | (hàng tệp) `data-tai-lieu-tep="up"` | tên · cỡ · thanh `role=progressbar` + "Đang tải lên… 42%" · "Huỷ"; chờ lượt: "Đang chờ tới lượt…". Nút Lưu của panel: "Đang tải tệp…" khoá |
| Lỗi kiểu | hàng `err` | "Tệp "x.exe" không đúng loại. Chỉ nhận .pdf, …" — báo ngay, không gọi mạng |
| Lỗi dung lượng | hàng `err` | "Tệp "x.pdf" nặng 31 MB, vượt giới hạn 25 MB." — báo ngay, không gọi mạng; video `.mp4` → "Video không tải lên được ở đây…" |
| Chưa tích cam kết | dòng lỗi | "Hãy tích ô cam kết bản quyền trước khi tải tệp lên." |
| Vượt 30 | dòng lỗi | "Mỗi bài tối đa 30 tài liệu." |

Đóng panel không Lưu: xoá best-effort tệp vừa tải (giữ `discardUploads`, `TabChuongBai.tsx:255-262`).
**4.4 KinSelect.** Đóng: khung cao 44px, chữ lựa chọn, mũi tên phải; mở: danh sách bóng `--kin-bong-*`, mục đang chọn có dấu ✓ + `aria-selected`, mục đang tô nền `--kin-nen-re-chuot`; >8 lựa chọn có ô tìm ở đầu; tắt: mờ 45%, không mở.
**4.5 Màn chấm (BaiTap) sau E.** Dưới "Phản hồi cho học sinh": khối "Tệp trả bài" của `NopTepBox` (vùng thả nhỏ + danh sách). Sau "Gửi điểm & phản hồi": một dòng trạng thái (thành công / lỗi điểm / "Điểm đã gửi. Chưa đính kèm được tệp…").

---

## 5. Chia tệp (song song, không chồng)

**tut-code**
- `prisma/schema.prisma` — đúng 2 dòng mục D.
- `src/app/api/lessons/[id]/route.ts` — `scheduledAt`, body hỏng → 400.
- `src/app/api/chapters/[id]/lessons/route.ts` — `scheduledAt`.
- `src/lib/tutorLessonDate.ts` (mới), `src/lib/tutorFlags.ts` (mới).
- `src/lib/tutorRoutes.ts` — `contentTabsFor`, `baiHocHref`, `giaoTrinhHref`.
- `src/lib/tutorClassRoutes.ts` — `classPageDecision`, `legacyClassTarget`.
- `src/lib/tutorInbox.ts`, `src/lib/tutorInboxServer.ts`, `src/lib/tutorDashboard.ts` — mục F.
- Test: `t-lesson-date-lib.ts` (mới), `t-lesson-scheduled.ts` (mới), `t-class-routes-lib.ts`, `t-tutor-routes-lib.ts`, `t-tutor-inbox-lib.ts`, `t-tutor-inbox.ts`, `t-lop-gon.ts` (bảng :69-:188 đổi kỳ vọng `…/giao-trinh` → gốc).

**tut-dev**
- `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/page.tsx` — theo `classPageDecision`; chủ → `QuanLopCourse view="bai-hoc"`, đồng giảng → `GiaoTrinh embedded`.
- `…/quan-lop/[id]/giao-trinh/page.tsx` (XOÁ) + `…/giao-trinh/route.ts` (MỚI, A5).
- `src/components/tutor/quan-lop/QuanLopCourse.tsx`, `TabChuongBai.tsx`, `DocumentsEditor.tsx`, `lessonForm.ts` (`LessonDB.scheduledAt?/status?`, `LsForm.scheduledDate/scheduledTime/status`), `AssignmentEditor.tsx`, `TabCaiDat.tsx`.
- `src/components/tutor/upload/OThaTep.tsx` (mới).
- `src/components/tutor/ThuVienLop.tsx`, `HopViec.tsx`, `HocSinh.tsx`, `BaiTap.tsx`, `TutorContentTabs.tsx` (chỉ chú thích đầu tệp).
- `src/components/kin/KinSelect.tsx` (mới).
- Test: `ui-loi-02.ts` (mới), `ui-gs-lop-gon.ts`, `ui-gs-lop-gon-tha.ts`, `ui-giao-trinh.ts`, `ui-nop-tep.ts`, `ui-kin-components.ts`, `t-kin-components.ts` (tĩnh, thuộc dev vì kiểm component), `ui-lop.ts`, `ui-tao-lop-wizard.ts`, `ui-journey-new-tutor.ts`, `ui-course-teachers-2.ts`, `ui-links-everywhere.ts` (các bài đang chờ `…/giao-trinh`).

**Hợp đồng để dev viết trước:** mục 3 (chữ ký, giá trị trả). Trong lúc chờ, dev dùng bản tạm cùng chữ ký ở chính tệp của mình KHÔNG được (chồng tệp) — dev viết theo chữ ký và chạy sau khi code gộp; thứ tự gộp: tut-code trước, tut-dev rebase.

---

## 6. Test

**Mới — tut-code**
- `t-lesson-date-lib.ts`: `parseVnDateTime("2026-11-13","19:00")` = `…T12:00:00.000Z`; 00:30 VN → ngày UTC hôm trước; 23:30; cả hai rỗng → null; tròn vòng 50 thời điểm ngẫu nhiên. Phá: `"2026-02-30"`, `"2026-13-01"`, `"24:00"`, `"7:5"`, chỉ ngày, chỉ giờ, năm 1999. `parseScheduledAtInput`: vắng → undefined; null; `"2026-11-13T12:00:00Z"`; `"+07:00"`; phá `""`, `"abc"`, `123`, `[]`, `"2026-11-13"`, `"2026-11-13T12:00"` (không múi). `formatVnLessonWhen` thứ CN/T2…T7, khác năm. Chạy dưới cả `TZ=UTC` và `TZ=Asia/Ho_Chi_Minh` (README: lỗi lệch ngày chỉ lộ ở một múi).
- `t-lesson-scheduled.ts` (API): PUT đặt ngày → GET `/api/courses/<id>` thấy đúng ISO; PUT `null` xoá; PUT không có khoá → giữ; PUT bài có `zoomUrl` mà không gửi `zoomUrl` → `zoomUrl` còn nguyên (đọc DB); POST có/không `scheduledAt`. Phá: rác → 400 và DB không đổi / không tạo bài; **lớp người khác 403**; **bài không có 404**; học sinh 403; **gia sư chờ duyệt 403**; chưa đăng nhập 401; bộ môn ngoài nhóm 403; body không phải JSON → 400.
- `t-tutor-inbox.ts` mục "LOI-02 F": seed đúng tình huống — gia sư T, lớp "Lịch Sử - Tổng Ôn" `classStatus=open`, KHÔNG `ClassSchedule`, 1 em `Enrollment active` không `ParentLink`; thêm 1 `Enrollment pending_consent` của em thứ hai cùng lớp (giả thuyết H1). Kiểm: (a) TRƯỚC khi sửa (chạy trên `c5f6fb7d`): `loadTutorTodoTotal(T)` = 2 trong khi số dòng `items` không `waiting` = 1 → ĐỎ; (b) SAU: cờ tắt ⇒ `noSchedule = 0`, không có dòng `noSchedule`, `total = loadTutorTodoTotal = Σ count dòng không waiting = 0`, dòng `consent` vẫn có trong `items` với `waiting: true`; (c) bật cờ trong tiến trình test (`process.env.NEXT_PUBLIC_KIN_MO_LICH="1"`, gọi thẳng `loadTutorTodoCounts`/`loadTutorInboxRaw`) ⇒ `noSchedule = 1` và số đỏ = 1; (d) in ra mọi bộ đếm ≠ 0 của `loadTutorTodoCounts` để ghi vào bàn giao bộ đếm nào thật sự gây "2". Sửa các ca cũ `:19`, `:68`, `:97` theo nghĩa mới của `total`.
- `t-tutor-inbox-lib.ts`: `INBOX_ACTION_KINDS` không có `consent`, có 13 loại; `todoCountsToRaw` đủ 14 khoá, không khoá nào rơi; `todoBadgeTotal` bỏ `pendingConsent`.
- `t-class-routes-lib.ts`, `t-tutor-routes-lib.ts`: từng hàng bảng A2/A4; đồng giảng chỉ "Bài học"; không còn nhãn "Giáo trình", "Lịch học", "Bài tập" trong dải; `…/lich-hoc` không tab sáng; id `".."` vẫn không thoát đường.
**Mới — tut-dev**
- `ui-loi-02.ts` (1600 và 390): thư viện → bấm thẻ → URL = gốc lớp, `aria-current` ở "Bài học", thấy cây; `fetch(…/giao-trinh, {redirect:"manual"})` → 307 + Location gốc; `?tab=chuong-bai` → 200, tab sáng; `…/giao-trinh/xem/<id>` mở được; `…/lich-hoc` mở bằng link, dải không có "Lịch học"; panel không có "Link phòng Zoom", không có "Dán link Google Drive"; bài cũ có link Drive vẫn hiện và xoá được; tải 2 tệp có %, tệp `.exe` và tệp 26 MB báo lỗi ngay (đếm yêu cầu mạng tới `/init` = 0); kho tắt (chặn `/api/media/config` trả `document.enabled=false`) → chữ "Kho tệp chưa bật — chủ cần cấu hình.", trang không lỗi; Sửa nhanh đổi tên + ngày → tải lại thấy chip đúng giờ VN; bài Nháp có chip "Nháp · học sinh chưa thấy"; KinSelect bằng bàn phím (↓ Enter, Esc, gõ chữ); không cuộn ngang ở 390. Phá: gia sư B mở lớp của A → "Bạn không có quyền với lớp này", không tên lớp A; lớp không có → "Không tìm thấy lớp"; gia sư chờ duyệt mở gốc lớp và `…/giao-trinh` → về `/lop-cua-toi/cho-duyet`.
- `ui-nop-tep.ts` thêm: chấm + đính tệp trả bài → học sinh thấy tệp; chặn `/api/media/nop-bai/dinh-kem` trả 500 → điểm vẫn lưu (DB), chữ báo riêng hiện.
- `t-kin-components.ts` + `ui-kin-components.ts`: KinSelect có `role=combobox/listbox/option`, `aria-expanded`, ô tìm khi > 8, không hex, chạm ≥ 44px.
**Chạy lại (bắt buộc, ghi bảng đạt/đỏ):** `ui-tutor-everything` (`TUTOR_REPORT=1`), `ui-tutor-shell`, `ui-gs-lop-gon` (kỳ vọng dải 4 tab), `ui-gs-lop-gon-tha`, `ui-giao-trinh`, `t-tutor-inbox`, `t-tutor-inbox-lib`, `t-nop-tep`, `t-media-api`, `t-db-push-guard`, `t-no-hex`, `t-links`, `t-lop-gon`, `t-giao-trinh` (ca `:150` 303 về `…/giao-trinh` vẫn đúng — chỉ thêm theo 307), `t-course-teachers`, `t-lesson-visibility`. Cộng `next build` (route.ts cạnh trang con) và `curl -sI .../quan-lop/<id>/giao-trinh` → `307`.

---

## 7. Biến môi trường Cloudinary (máy chủ đọc)

Đúng ba biến, đủ cả ba mới bật: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Bật/tắt kho tài liệu: `src/lib/mediaStorage.ts:166` (`resolveDocumentUploadConfig`), gọi qua `src/lib/mediaStorageServer.ts:16` với `process.env`.
- Ký tải lên: `src/lib/mediaStorageServer.ts:98` (`cloudinaryEnv`).
- Tệp nộp / trả bài dùng cùng ba biến: `src/lib/nopTep.ts:101`; công tắc tắt khẩn `KIN_NOP_TEP=0` (`:96-99`).
- Máy dev (`NODE_ENV !== "production"`) thiếu biến ⇒ đĩa cục bộ, ô thả vẫn bật (`mediaStorage.ts:168`). Production thiếu ⇒ tắt (`:169`).
- KHÔNG dùng `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (`cloudinary.ts:1-2` — preset không ký của trang quản trị cũ).

---

## 8. Kết luận sơ bộ mục F (cần test 6 xác nhận)

Số đỏ: `LopCuaToiFrame.tsx:43` → `loadTutorTodoTotal` (`tutorDashboard.ts:46-48`) = cộng **mọi** khoá của `TodoCounts` (`:34-42`). Danh sách: `/api/tutor/hop-viec` → `buildInboxItems` (`tutorInbox.ts:165-197`) → `HopViec.tsx:59-61` chỉ đưa loại KHÔNG `waiting` vào "Cần cô xử lý"; đếm "N việc" bằng số đầu tiêu đề (`:61`).
- **H1 (khả năng cao nhất): `pendingConsent`.** Loại `consent` là `waiting: true` (`tutorInbox.ts:72-78`) nên chỉ hiện ở khối "Chờ phụ huynh" với chữ "Không tính là việc cô cần làm" (`HopViec.tsx:130`), nhưng VẪN được cộng vào số đỏ. Trang Học sinh cố ý không liệt kê ghi danh `pending_consent` (`tutorStudentsServer.ts:3,24`) ⇒ cô chỉ thấy "1 học sinh đang học" và không tìm ra việc thứ hai. Khớp chi tiết "chưa liên kết phụ huynh": một em dưới 18 vào lớp khi chưa có phụ huynh xác nhận sinh `Enrollment pending_consent` (`enrollServer.ts:47,68`).
- **H2: `noSchedule`** (`tutorDashboard.ts:32`, `noScheduleWhere` `tutorInbox.ts:9`): lớp đang mở chưa có khung giờ ⇒ 1. Dòng có hiện ("1 lớp chưa có lịch học") nhưng dẫn tới tab Lịch học mà chủ đã bỏ — việc không còn nên có. Sửa bằng cờ `isLichOpen()` (mục 2.F).
- **H3: số đỏ cũ.** Số đỏ tính ở layout máy chủ (`(tutor)/layout.tsx` → `LopCuaToiFrame`), layout không vẽ lại khi điều hướng phía trình duyệt; `HopViec` tải lại khi focus (`:52-57`) còn số đỏ thì không ⇒ việc vừa xử lý (vd. duyệt xin vào lớp bằng fetch) vẫn nằm trong số đỏ.
- Đã loại: `unmarkedSessions`, `remindersDue`, `makeupExpiring` cần có buổi / khung giờ (tình huống không có); các loại còn lại đều sinh dòng hiện ở mọi khổ (`KinListRow` không có lớp ẩn theo khổ, `ListRow.tsx:29-32`).
- Sau sửa: số đỏ = Σ count các loại trong `INBOX_ACTION_KINDS` = `total` của API = "N việc" của `HopViec`; với tình huống đã cho và cờ tắt ⇒ 0, Hộp việc "Không có việc nào đang chờ cô", khối "Chờ phụ huynh" vẫn hiện em chờ xác nhận (nếu có).

---

## 9. Cần xin COO

Không có tệp cấm phải sửa. Ghi để COO điều phối (không phải xin sửa):
- **Cờ lịch dùng chung với LOI-01:** LOI-02 tạo `src/lib/tutorFlags.ts` (`isLichOpen`). Đề nghị LOI-01 (`TutorShell` / thanh bên) import cùng hàm này thay vì đọc `process.env.NEXT_PUBLIC_KIN_MO_LICH` riêng — một chỗ quyết định. Mặc định nếu LOI-01 đã có hàm riêng: giữ cả hai, cùng điều kiện `=== "1"`, gộp ở đợt sau.
- `src/components/kin/index.ts` không đụng (KinSelect import thẳng tệp).
- `src/components/student/nop-tep/*`, `src/components/DropZone.tsx`, `src/components/media/TutorLessonMedia.tsx`, `src/app/api/tutor/lop/[courseId]/giao-trinh/**`: chỉ import / gọi, không sửa.
- `admin/khoa-hoc/[id]/page.tsx`, `admin/thi-thu`: không đụng (trang quản trị có form bài riêng; không gửi `scheduledAt` ⇒ không đổi gì).

**Câu hỏi cho chủ (có mặc định):**
1. Production chưa đặt 3 biến Cloudinary thì cô KHÔNG thêm được tài liệu mới (đã bỏ dán link Drive theo yêu cầu). Mặc định: giữ quyết định, ghi "đặt 3 biến ở Vercel Production" vào việc của chủ trước khi phát hành.
2. Bài thêm nhanh từ cây đăng ngay (như cây cũ), khác Giáo trình phẳng (tạo Nháp). Mặc định: đăng ngay; chip trạng thái + ô Trạng thái cho đổi.
3. Đồng giảng chỉ có một tab "Bài học". Mặc định: giữ; nếu cần Lịch học cho đồng giảng thì mở lại khi bật cờ lịch.
