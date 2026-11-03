# CAT-02 — Thiết kế lại danh mục khoá học phía QUẢN TRỊ (danh sách khoá + danh mục)

**Phòng / vai:** pb-admin → adm-rnd viết; adm-code ∥ adm-dev làm. **Cỡ:** L (có schema nhỏ, 2 màn, 7 endpoint). **Ngày:** 01/11/2026.
**Nhánh đề xuất:** `claude/adm-cat-02` rẽ từ `origin/main` (không phụ thuộc HOME-01; liên hệ CAT-01 của phòng Học sinh chỉ ở mục 9 câu 4).
**Đọc mã tại:** worktree `claude/stu-home` (main + STU-001/002). **Hai tệp lớn `admin/khoa-hoc/[id]/page.tsx` và `admin/thi-thu/**` KHÔNG đụng** (mục 2).
**Nguồn tham khảo cách sắp xếp (không sao chép):** NN/g "Data Tables: Four Major User Tasks" — https://www.nngroup.com/articles/data-tables/ (tìm bản ghi · so sánh · xem/sửa một hàng · hành động trên bản ghi; vì thế cột đầu là định danh, bảng ưu tiên so sánh); NN/g "Modal & Nonmodal Dialogs" — https://www.nngroup.com/articles/modal-nonmodal-dialog/ (sửa trong panel không chặn nền); PatternFly "Bulk selection" — https://www.patternfly.org/patterns/bulk-selection/ (chọn nhiều đặt ở thanh công cụ, "chọn tất cả" chỉ tính trang đang hiện). Figma: tham chiếu BU-08 (`docs/kin/rd/BIGUPDATE-KE-HOACH.md` mục BU-08, dòng 100-105 trong commit `535b997`) — "mọi bảng theo NN/g: cột đầu là định danh, bộ lọc hiện khi áp, sửa trong panel bên, ≤2 nút/hàng, Chọn tất cả + thanh ngữ cảnh + hoàn tác". Khung `608:728` (thanh bên) và `608:1515` (bảng + panel bên) **tôi chưa mở bằng MCP** — COO/adm-dev đọc bằng `get_design_context` trước khi dựng; spec này dựa vào văn bản BU-08, không dựa vào hình.
**Cờ:** TIỀN = **trình bày** (giá khoá chỉ hiển thị; không có ô sửa giá ở màn mới) · TRẺ EM = không (chỉ đếm sĩ số, không tên học sinh) · ĐỔI NỀN = không.

---

## 1. Vấn đề và bằng chứng

Thanh nói bố cục "nhìn không hay, chưa tối ưu tí nào". Đọc cấu trúc JSX (không chạy) thấy **bốn lớp lỗi**: sai mẫu bảng, thiếu chức năng cơ bản, một số nút **nói dối**, và mobile.

### 1A. Danh sách khoá học — `src/app/(admin)/admin/khoa-hoc/page.tsx` (730 dòng)

| # | Điểm xấu cụ thể | Tệp:dòng |
|---|---|---|
| 1 | **Cột đầu là "ID" số** (`course.adminId`), không phải tên khoá. Tên khoá đứng cột 2, gia sư cột 5 — sai mẫu NN/g "cột đầu là định danh" mà BU-08 đòi. | `:627`, `:640`, `:641-643`, `:650` |
| 2 | **Tám cột** (ID, Tên, Slug, Danh mục, Gia sư, Trạng thái, Ngày tạo, Hành động); Slug lặp lại tên (`:644-646`), "Ngày tạo" là chuỗi `createdAt` thô (`:669`). Bảng `min-w-[800px]` → cuộn ngang trên điện thoại. | `:624`, `:627`, `:669` |
| 3 | **Thiếu hẳn thứ quản trị cần so sánh:** sĩ số (`capacity` có trong `CourseFull`, `src/lib/api.ts:296`), trạng thái nhận học viên (`classStatus`, `:297`) và giá đều **có dữ liệu mà không hiện**. Không có cột nào cho biết lớp đầy/đóng/miễn phí. | `:430-439` (kiểu `Course` chỉ giữ 9 trường), `:535-544` |
| 4 | **Bộ lọc nghèo:** chỉ tên/slug, danh mục, "Hiện/Ẩn". Không lọc theo gia sư, không miễn phí/có phí, không theo trạng thái lớp; không sắp xếp. Danh mục dùng `<option value="">Chọn danh mục</option>` (nghĩa "Tất cả" mà ghi "Chọn"). | `:584-607`, `:595` |
| 5 | **Bộ lọc chiếm một khối ~100px luôn hiện** (ba ô có nhãn + nút) trước khi thấy hàng đầu; ở 390px xếp 1 cột = ~400px mới tới bảng. Không có "chip đang lọc" nên người dùng không biết mình đang lọc gì sau khi cuộn. | `:584` (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) |
| 6 | **Bộ lọc chỉ nửa đồng bộ với URL:** `?category=` được đọc (`:550`, `:558-560`) nhưng tìm kiếm và trạng thái chỉ ở state → tải lại / chia sẻ liên kết là mất. | `:549-551` |
| 7 | **Nút "Tạo mới" chui vào ô thứ 4 của lưới bộ lọc**, cạnh "Làm mới" — hành động chính không nằm ở đầu trang. | `:608-619` |
| 8 | **"Làm mới" làm hai việc:** xoá toàn bộ bộ lọc **và** tải lại dữ liệu. Muốn chỉ tải lại thì mất lọc. | `:609` |
| 9 | **Công tắc Hiện/Ẩn trong từng hàng** (`Toggle`), không chữ, không xác nhận, không hoàn tác: một lần chạm nhầm là ẩn khoá khỏi trang công khai. Ý nghĩa chỉ bằng vị trí/màu. | `:651-668` |
| 10 | **Tên khoá không phải liên kết.** Muốn mở khoá phải bấm `···` → "Cài đặt". Hàng không bấm được. | `:641-643`, `:457-460` |
| 11 | **Menu `···` nhét 8 mục** (3 liên kết tab, 1 liên kết gia sư, 1 liên kết ngoài, Sao chép, Xoá + xác nhận xoá ngay trong menu). Không giống mẫu "≤2 nút/hàng, còn lại vào panel". Menu là `absolute` trong vùng `overflow-auto` → hàng cuối dễ bị cắt. | `:442-527`, `:470`, `:623` |
| 12 | **Liên kết "Xem portal học viên" dẫn về trang chủ học tập chung** (`/student/hoc-tap`), không về khoá này, và viết cứng tên miền `midnightelite-edu.com` thay vì `MAIN_HOST` (`src/lib/hostRouting.ts:23`). Tên nhãn hứa điều liên kết không làm. | `:488` |
| 13 | **Lỗi tải bị nuốt thành "Không tìm thấy khoá học nào":** `useCourses` trả `error` nhưng trang chỉ lấy `data, loading, refetch`. Mất mạng / 500 → bảng rỗng + câu "không tìm thấy" (sai). | `:534`; `src/hooks/useCourses.ts:7-24` |
| 14 | **Trạng thái rỗng chỉ có một câu** dù là "chưa có khoá nào" hay "lọc không ra"; không nút "Xoá bộ lọc" hay "Tạo khoá đầu tiên". | `:692-698` |
| 15 | **Không chọn nhiều / không hành động hàng loạt / không hoàn tác.** Ẩn 10 khoá = 10 lần bấm công tắc, 10 lần gọi API tuần tự. | toàn tệp (không có `checkbox`) |
| 16 | **Khung `height: calc(100vh - 104px)` + `overflow-hidden`** trong vỏ đã có khung riêng → cuộn lồng, ở điện thoại thanh địa chỉ co giãn làm sai chiều cao. | `:573` |
| 17 | **Màu và cỡ chữ viết bằng lớp Tailwind thô** (`gray-*`, `blue-*`, `red-*`, `text-xs`) thay vì token `--kin-*` và `KIN_TABLE_HEAD/ROW`, `KIN_FIELD` của `src/components/kin/PageLayout.tsx:14-22` mà `nhat-ky/page.tsx` đã dùng → trang này nhìn như của một sản phẩm khác. Tiêu đề cột in hoa giãn chữ. | `:586-619`, `:625-631`, `:640-669` |
| 18 | **Hai hệ thông báo:** `AdminToast` ở đây, `KinToast` ở trang khác. | `:13`, `:546`, `:575` |
| 19 | **Không có trạng thái "đang lưu một dòng"** ngoài khoá công tắc; đổi Hiện/Ẩn xong gọi `refetch()` toàn danh sách (`:660`) → bảng nhấp nháy `loading` (SkeletonTable thay hết hàng, `:635-637`). | `:655-666` |
| 20 | **Phạm vi vai gia sư dùng chung trang này** (`isTeacher`, `:45`, `:673`; `ownerScopeWhere` ở `src/app/api/courses/route.ts:32`). Thiết kế lại **phải giữ**: gia sư chỉ thấy khoá của mình, có lối "Mở lớp (mã mời, học viên)" (`:479-485`), và không có quản lý danh mục. | `:478-485`, `:673` |

### 1B. Danh mục — `src/app/(admin)/admin/khoa-hoc/danh-muc/page.tsx` (482 dòng)

| # | Điểm xấu cụ thể | Tệp:dòng |
|---|---|---|
| 21 | **Nút "Xoá" danh mục là giả.** `confirmDelete` chỉ bỏ dòng khỏi state và báo "Đã xoá danh mục"; **không có lời gọi API nào** — và `src/app/api/categories/route.ts` chỉ có `GET`, `PUT`. Tải lại là dòng trở về. Còn nếu `courseCount > 0` thì chặn. Danh mục trong CSDL **luôn** có ≥1 khoá (nó chỉ tồn tại vì khoá dùng tên đó) nên với quản trị nút này **không bao giờ xoá được gì**. | `:299-309`; `route.ts:12-53` |
| 22 | **Nút "+ Thêm danh mục" không lưu gì:** toast "Chưa lưu gì: danh mục … chỉ có khi một khoá học dùng tên này". Hành động chính của trang không làm việc. | `:273-277`, `:369-374` |
| 23 | **Gốc rễ:** danh mục chỉ là chuỗi `Course.category` (`prisma/schema.prisma:21`), không có bảng riêng → không có thứ tự, không tạo được danh mục trống, không xoá, không có mã định danh bền. API trả `id: i + 1` theo vị trí (`route.ts:26`) — **đổi khi thêm/xoá danh mục khác**. | `route.ts:19-26`; `schema.prisma:21` |
| 24 | **Thứ tự danh mục vô nghĩa:** `groupBy … orderBy category asc` (chữ cái) trong khi trang công khai dùng danh sách tĩnh `COURSE_CATEGORIES` (`src/lib/courseData.ts:6`). Quản trị không đặt được thứ tự mà học viên thấy. | `route.ts:19`; `courseData.ts:6-15` |
| 25 | **Đổi tên gộp ngầm:** `PUT` đổi `oldName→newName` bằng `updateMany`; nếu `newName` đã có thì hai danh mục **gộp một, không cảnh báo** (không kiểm trùng, không cắt khoảng trắng). Đổi tên ghi đè khoá của **mọi gia sư** nhưng **không ghi nhật ký kiểm toán** (không `logAction`). | `route.ts:31-53` |
| 26 | **Cột "Slug" là chuỗi tính tại chỗ** (`toSlug(cat.name)`), không lưu, không dùng trong đường dẫn nào (lọc là `?category=<tên>`). Người dùng tưởng sửa được / có tác dụng. Cột "#" là chỉ số dòng, không phải mã. | `:414`, `:436`, `:440`; `/khoa-hoc?category=` ở `src/app/page.tsx:94` |
| 27 | **Số khoá là nút vuông 36px** (liên kết) thay vì con số có chữ; gộp cả khoá ẩn lẫn hiện, không tách "đang hiển thị". | `:441-449` |
| 28 | **Menu `···` chỉ có 2 mục** (Chỉnh sửa, Xoá) — ẩn đi cái lẽ ra phải thấy; ngược lại, hàng không bấm được. | `:179-222`, `:451-455` |
| 29 | **Xoá dùng hộp thoại chặn nền (`DelModal`)** — trái nguyên tắc "sửa trong panel bên, không hộp thoại". | `:29-60`, `:325-331` |
| 30 | **Dòng đường dẫn "Bảng điều khiển / Danh sách khoá học / Danh mục khoá học"** lặp với dải tab của vỏ (module Nội dung › Khoá học | Danh mục, `adminNav.ts:33-34`); "Bảng điều khiển" không bấm được. Hai dải thông tin dài (xanh/vàng) đẩy bảng xuống. | `:342-348`, `:390-407` |
| 31 | **Cùng khung cao cố định `calc(100vh - 104px)`**, `min-w-[600px]`, màu Tailwind thô — như 16, 17, 2. | `:314`, `:411` |
| 32 | **Lỗi/rỗng:** lỗi có dải đỏ + "Thử lại" (`:380-388`, tốt, giữ), nhưng rỗng chỉ một câu, không dẫn người dùng tới "Tạo khoá học". | `:463-469` |

**Tóm lại:** danh sách khoá là bảng 8 cột không có định danh ở đầu, không so sánh được, không chọn nhiều, giấu mọi thứ trong menu, nuốt lỗi; danh mục có hai nút (Thêm, Xoá) **không hoạt động thật** vì thiếu bảng dữ liệu.

## 2. Phạm vi tệp (adm-code và adm-dev, không trùng)

**KHÔNG đụng:** `src/app/(admin)/admin/khoa-hoc/[id]/**` (và mọi `tao-moi`/alias), `src/app/(admin)/admin/thi-thu/**`, `src/app/api/courses/**` (phòng Gia sư — `PUT/PATCH /api/courses/[id]` chỉ được **gọi**), mọi tệp `fee*`/`invoice*`/`tuitionFee*`. Không sửa `createdAt`, `price`, `originalPrice`, `feeMode`, `CourseFeeRate`.

**adm-code**
- `src/app/api/admin/khoa-hoc/route.ts` — mới: `GET` danh sách mỏng + facet (mục 4.1).
- `src/app/api/admin/khoa-hoc/bulk/route.ts` — mới: `POST` ẩn/hiện, đổi danh mục hàng loạt (4.2).
- `src/app/api/admin/danh-muc/route.ts` — mới: `GET` (kèm đếm, đồng bộ lười), `POST` tạo (4.3).
- `src/app/api/admin/danh-muc/[id]/route.ts` — mới: `PUT` đổi tên, `DELETE` (4.4).
- `src/app/api/admin/danh-muc/thu-tu/route.ts` — mới: `PUT` đặt thứ tự (4.5).
- `src/app/api/categories/route.ts` — **sửa** (chỉ thêm, xem mục 10): `GET` trả thêm `sortOrder`, sắp theo thứ tự lưu, danh mục chưa có dòng xếp cuối theo chữ cái; `PUT` giữ tương thích nhưng gọi cùng thư viện, kiểm trùng (409) và ghi nhật ký.
- `src/lib/courseCatalogAdmin.ts` — mới, **thuần**: `buildFacets`, `filterRows` (dùng chung trình duyệt + test), `planBulk(rows, action, actor)` (tách `updated`/`skipped` theo quyền sở hữu), `categorySlug(name)`, `validateOrderIds`.
- `src/lib/adminOps.ts` — thêm nhãn nhật ký (mục 7).
- `src/lib/adminNav.ts` — **không đổi** (hai mục "Khoá học", "Danh mục" đã có, `:33-34`).
- Test: `tools/local-e2e/t-course-catalog-lib.ts`, `tools/local-e2e/t-course-catalog.ts`.

**adm-dev**
- `src/app/(admin)/admin/khoa-hoc/page.tsx` — viết lại (client, vẫn dùng chung cho gia sư trong `TutorAdminFrame`).
- `src/app/(admin)/admin/khoa-hoc/danh-muc/page.tsx` — viết lại.
- `src/components/admin/panel/SidePanel.tsx` — **panel bên dùng chung** (BU-08 sẽ dùng lại cho Việc chờ, Gia sư…): khung phải 420px ở ≥1280, tấm toàn màn hình ở <768, đóng bằng Esc/nút ✕/chạm nền (nền **không khoá** thao tác trên bảng ở màn rộng), bẫy tiêu điểm nhẹ, `aria-labelledby`.
- `src/components/admin/courses/`: `CourseTable.tsx`, `CourseFilters.tsx` (thanh lọc + chip), `CoursePanel.tsx` (sửa nhanh), `BulkBar.tsx`, `CreateCourseDrawer.tsx` (**chuyển nguyên văn** từ `page.tsx:19-427`; **không đổi logic** — gồm ô giá bán, giá gốc `:327-343`, giữ nguyên vì TIỀN).
- `src/components/admin/categories/`: `CategoryList.tsx`, `CategoryPanel.tsx`.
- Test: `tools/local-e2e/ui-admin-courses.ts`, `tools/local-e2e/ui-admin-categories.ts`.

**Hai bên chỉ gặp nhau ở JSON mục 4.** adm-code không đụng `src/app/(admin)/**` hay `src/components/**`; adm-dev không đụng `src/app/api/**` và `src/lib/**`.

## 3. Schema (chỉ thêm)

```prisma
model CourseCategory {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  sortOrder Int      @default(0)        // KHÔNG @unique: đổi thứ tự không phải né va chạm khoá
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("course_categories")
}
```
- `Course.category` **giữ nguyên là chuỗi, không thêm khoá ngoại** — để không động vào `Course` (phòng Gia sư, nhiều tuyến đang đọc) và để `POST /api/courses` (`api/courses/route.ts:67`) vẫn tạo được khoá với tên danh mục tự do như hôm nay.
- **Không cần script chuyển dữ liệu.** `GET /api/admin/danh-muc` **đồng bộ lười**: mọi `Course.category` khác nhau chưa có dòng → tạo dòng mới ở cuối (cùng giao dịch, idempotent, thứ tự theo chữ cái). `GET /api/categories` công khai **chỉ đọc**: dòng đã có theo `sortOrder`, rồi tên chưa có dòng theo chữ cái (không ghi khi khách xem).
- Tệp chung `prisma/schema.prisma` → mục 10, qua `t-db-push-guard` (chỉ thêm bảng).
- Phương án **không cần schema** (nếu COO/Thanh không muốn bảng mới): bỏ thứ tự, bỏ tạo danh mục trống, bỏ xoá; giữ đếm + đổi tên + lọc. Phần còn lại vẫn làm được. Nêu ở mục 9 câu 1.

## 4. Hợp đồng API

Mọi endpoint `/api/admin/*` dưới đây: `export const dynamic = "force-dynamic"`; lỗi trả `{error: "<chữ Việt>"}`; không lộ stack. Quyền: `requirePermission(PERMISSIONS.MANAGE_COURSES)` (`admin_super`, `admin_content`, `teacher` đều có). **Phân vai bên trong:** `teacher` bị `ownerScopeWhere` — chỉ thấy/chỉnh khoá của mình; **mọi endpoint danh mục (4.3–4.5) từ chối `teacher` bằng 403** (quản trị trung tâm mới đổi danh mục dùng chung, như `PUT /api/categories` hiện nay `route.ts:38`).

### 4.1 `GET /api/admin/khoa-hoc`
- Vào: không tham số (lọc phía trình duyệt; số khoá thực tế nhỏ). Tối đa 1000 hàng; vượt thì `truncated:true`.
- Ra 200:
```
{ rows: [{ id /*slug*/, adminId, name, adminName, category, tutor: {id: string|null, name: string},
           status: boolean, classStatus: "open"|"closed"|"paused",
           enrolled: number /*Enrollment.status="active"*/, capacity: number|null,
           price: number, createdAt: string }],
  facets: { categories: [{name, count}], tutors: [{id|null, name, count}],
            shown: number, hidden: number },
  truncated: boolean, canManageCategories: boolean }
```
  `tutor.name` = `owner.name` nếu có, nếu không `instructor`; `id=null` ⇒ "Trung tâm". `enrolled` bằng **một** `groupBy` (không N+1). **Không** trả `bg`, mô tả, `zaloGroupLink`, link học online (nhẹ payload và không lộ link lớp).
- Lỗi: 401 · 403 · 500.

### 4.2 `POST /api/admin/khoa-hoc/bulk`
- Vào: `{ ids: string[1..100], action: "set_status", status: boolean }` hoặc `{ ids, action: "set_category", category: string }`.
- Ra 200: `{ updated: [{id, prev: {status, category}}], skipped: [{id, reason: "not_owner"|"not_found"|"no_change"}] }`. Mỗi khoá một cập nhật trong **một giao dịch**; hoặc tất cả hoặc không (không nửa chừng).
- Lỗi: 400 (ids rỗng / >100 / action lạ / `category` rỗng hoặc >60 ký tự); 403; 422 `category` không tồn tại trong `course_categories` **và** không phải tên đã dùng (không bịa danh mục bằng đường này — tạo ở 4.3).
- `teacher`: khoá không của mình vào `skipped:not_owner`, **không** 403 cả lô (để lô lẫn vẫn chạy phần hợp lệ); `set_category` cho `teacher` → 403 (đổi danh mục hàng loạt chỉ quản trị trung tâm).
- **Hoàn tác** = gọi lại 4.2 với giá trị `prev` (trình duyệt gom theo giá trị trước, tối đa 2 lời gọi cho `set_status`). Không có endpoint "undo" riêng.

### 4.3 `GET` / `POST /api/admin/danh-muc`
- `GET` ra 200: `{ categories: [{id, name, slug, sortOrder, courses: {total, shown, hidden, openForJoin}}], canEdit: boolean }`, theo `sortOrder` rồi tên. `total/shown/hidden` đếm từ `Course.category`. Đồng bộ lười ở mục 3. `teacher` → 403.
- `POST` vào `{ name }`: cắt khoảng trắng, 1–60 ký tự, không ký tự điều khiển, `slug = categorySlug(name)`; ra 201 `{category}` (đặt `sortOrder` = lớn nhất + 1). Lỗi: 400 tên sai · 409 `{error, existing:{id,name}}` trùng tên (không phân biệt hoa/thường, không phân biệt dấu) hoặc trùng `slug`.

### 4.4 `PUT` / `DELETE /api/admin/danh-muc/[id]`
- `PUT` vào `{ name }`: trong **một giao dịch** cập nhật `course_categories.name/slug` và `course.updateMany({category: cũ → mới})`. Ra 200 `{category, renamedCourses: number}`. Lỗi: 400 · 404 · **409 trùng tên** (thay cho gộp ngầm hiện nay — gộp là việc riêng, mục 9 câu 3).
- `DELETE`: chỉ khi `Course.count({category: tên}) === 0`. Ra 200 `{ok:true}`. Lỗi: 404 · **409** `{error: "Còn 12 khoá học đang dùng danh mục này", courses: 12}`.

### 4.5 `PUT /api/admin/danh-muc/thu-tu`
- Vào `{ ids: string[] }` = **toàn bộ** danh mục theo thứ tự mới. Ra 200 `{ok:true}`. Lỗi: 409 nếu `ids` khác tập danh mục hiện có (ai đó vừa thêm/xoá; trả `{error, current: ids[]}`) · 400 trùng id.

### 4.6 Dùng nguyên các API có sẵn (không đổi hợp đồng)
- `PUT /api/courses/[id]` với `{name, adminName, category, instructor, status, capacity, classStatus}` — tất cả nằm trong `allowed` (`src/app/api/courses/[id]/route.ts:94-99`), đã có kiểm sức chứa ≥ số học viên đang học (`:112-126`) và kiểm quyền sở hữu (`:86-88`). **Panel sửa nhanh không gửi `price`, `originalPrice`, `lessons`, `hours`.**
- `POST /api/courses/[id]/duplicate`, `DELETE /api/courses/[id]`.
- `GET /api/categories` (danh sách chọn danh mục ở form tạo khoá).

## 5. Luồng màn

### 5.0 Nguyên tắc cho cả hai màn
Hàng chờ/bảng duy nhất; **cột đầu là định danh**; tìm kiếm + lọc nằm **một thanh** trên bảng; chip hiện bộ lọc đang áp; **bấm hàng = mở panel bên** (không hộp thoại); **≤2 nút mỗi hàng**; chọn nhiều → thanh ngữ cảnh thay thanh lọc; mọi thay đổi hàng loạt có **Hoàn tác**; không biểu đồ tròn/gauge; số liệu chỉ hiển thị, không tính tiền; dùng `KinPage`, `KinPageHeader`, `KIN_TABLE_HEAD/ROW`, `KIN_FIELD`, `KinStatus`, `KinStateCard`, `KinEmptyState`, `KinSkeleton`, `KinToast` (một hệ thông báo), token `--kin-*`, không hex.

### 5.1 Danh sách khoá học — `/admin/khoa-hoc`
**Đầu trang:** `KinPageHeader` "Khoá học" + dòng phụ "42 khoá · 36 đang hiển thị · 6 đang ẩn" (số từ `facets`) + nút chính **"Tạo khoá học"** (góc phải; mở `CreateCourseDrawer` như cũ). `?tao=1` vẫn mở sẵn (giữ liên kết của gia sư mới, `page.tsx:547`).

**Thanh công cụ (một hàng):** ô tìm (tên công khai, tên nội bộ, slug — gõ là lọc ngay, không gọi mạng) · bốn bộ lọc dạng nút-mở-danh-sách: **Kỳ thi** (danh mục, có số khoá) · **Trạng thái** (Đang hiển thị / Đang ẩn) · **Gia sư** (ẩn với vai gia sư) · **Giá** (Miễn phí = giá 0 / Có phí) · sắp xếp (Mới tạo, Tên A–Z, Đông học viên nhất, Thứ tự trang công khai). Dưới thanh: **chip đang lọc** (`Kỳ thi: ĐGNL HSA ✕`, `Đang ẩn ✕`) + "Xoá bộ lọc" chỉ hiện khi có chip. Không còn nút "Làm mới" lẫn trong bộ lọc; tải lại là nút biểu tượng riêng nhỏ ở góc thanh và **giữ nguyên** bộ lọc. **Mọi bộ lọc/sắp xếp/tìm đồng bộ vào URL** (`?q=&kythi=&tt=&giasu=&gia=&sx=`) → tải lại/chia sẻ giữ nguyên (sửa điểm 6; `?category=` cũ tiếp tục được đọc).

**Bảng (≥768px)** — 6 cột + ô chọn:
| Cột | Nội dung |
|---|---|
| ☐ | ô chọn; tiêu đề cột là ô "chọn trang này" (PatternFly: chọn tất cả chỉ trong trang đang hiện) |
| **Khoá học** (định danh) | dòng 1: tên công khai (đậm, cắt "…" ở 1 dòng); dòng 2: gia sư · mã `slug` nhỏ xám |
| Trạng thái | chip **chữ**: `Đang hiển thị` / `Đang ẩn`; bên cạnh `Đang nhận` / `Đã đóng` / `Tạm ngừng` (`classStatus`) — mỗi chip = chấm màu + chữ (`KinStatus`), không chỉ màu |
| Sĩ số | `12/30` hoặc `12 · không giới hạn`; đầy (`enrolled ≥ capacity`) thêm chữ "Đầy" |
| Kỳ thi | tên danh mục |
| Giá | `2.990.000đ` hoặc `Miễn phí` — **chỉ hiển thị**, căn phải, số tabular; không bấm sửa |
| (cuối) | **một** liên kết **"Mở"** → `/admin/khoa-hoc/<slug>` |

Hàng cao `--kin-hang-bang`; chữ ≥ 14px; tiêu đề cột chữ thường (không in hoa giãn). **Không còn cột ID, Slug, Ngày tạo, Hành động.** (Ngày tạo xem trong panel; ID không cần với người dùng.) Hàng có `cursor-pointer`, `Enter`/`Space` mở panel.

**Điện thoại 390:** mỗi khoá là một thẻ-hàng (`KinListRow`): dòng 1 tên, dòng 2 gia sư, dòng 3 chip trạng thái + sĩ số + giá; chạm = mở panel dạng tấm toàn màn hình. Bộ lọc gập vào một nút **"Lọc (2)"** mở tấm lọc (kèm chip bên ngoài); ô tìm luôn thấy. Không `min-w` cố định (bỏ `:624`), không cuộn ngang. Nút "Tạo khoá học" nổi ở đáy (cùng mẫu nút nổi các trang gia sư).

**Panel bên "Sửa nhanh" (`CoursePanel`)** — mở khi bấm hàng; 420px bên phải ở ≥1280, bảng thu hẹp; <1280 chồng lên có nền mờ; <768 toàn màn hình. Nội dung từ trên xuống:
1. Đầu panel: tên khoá, `slug`, ngày tạo; nút ✕.
2. Trường (một cột): Tên công khai · Tên nội bộ · Kỳ thi (chọn danh mục) · Gia sư hiển thị · **Hiển thị trên website** (công tắc **có chữ** "Đang hiển thị trên website / Đang ẩn") · Trạng thái lớp (nhóm 3 nút: Đang nhận / Đã đóng / Tạm ngừng) · Sức chứa (số hoặc ô "Không giới hạn").
3. Một dòng chỉ đọc: **Giá 2.990.000đ (giá gốc 4.990.000đ) — đổi ở trang khoá học →** (liên kết). Không có ô nhập giá.
4. Chân panel dính: `Lưu` (chính) · `Huỷ`. Dưới đó, nhóm phụ: `Mở trang quản khoá` · `Sao chép khoá` · (vai gia sư) `Mở lớp (mã mời, học viên)` · và mục **"Xoá khoá học"** cuối cùng, **bấm lần một ra hai nút ngay trong panel** "Xoá vĩnh viễn khoá và toàn bộ bài học" · "Giữ lại" (không hộp thoại, không menu).
Lỗi lưu hiện ngay dưới trường (ví dụ "Không thể hạ sức chứa xuống 5 — hiện có 12 học viên đang theo học" lấy từ 400 của `PUT /api/courses/[id]`). Lưu xong: hàng trong bảng cập nhật tại chỗ (không `refetch` cả danh sách, sửa điểm 19), toast `KinToast`.

**Chọn nhiều + thanh ngữ cảnh (`BulkBar`):** chọn ≥1 hàng → thanh lọc đổi thành "Đã chọn 3 khoá · **Hiện** · **Ẩn** · **Đổi kỳ thi ▾** · Bỏ chọn" (vai gia sư không có "Đổi kỳ thi"). Có dòng "Chọn cả 42 khoá khớp bộ lọc" khi chọn hết trang. Xong → toast 8 giây **"Đã ẩn 3 khoá — Hoàn tác"** (4.2 với `prev`). Bảng giữ vị trí cuộn.

**Trạng thái:**
| | Hiện |
|---|---|
| Đang tải lần đầu | `KinTableSkeleton` 8 hàng; thanh công cụ vẫn thấy nhưng tắt |
| Đang tải lại | giữ bảng cũ, thanh mảnh trên đầu bảng; không thay hàng bằng khung xám |
| **Lỗi tải** | `KinStateCard` "Không tải được danh sách khoá học" + `Thử lại` (**không** hiện câu "không tìm thấy", sửa điểm 13) |
| Chưa có khoá nào | `KinEmptyState` "Chưa có khoá học" + nút "Tạo khoá học đầu tiên" |
| Lọc không ra | `KinEmptyState` "Không có khoá khớp bộ lọc" + nút "Xoá bộ lọc" |
| 403 | `PermissionGuard` như các trang khác |
| Đang lưu ở panel | nút Lưu đổi chữ, tắt; hàng đang lưu mờ nhẹ |
| Cắt bớt | `truncated` → dải "Chỉ hiện 1000 khoá đầu — thu hẹp bằng bộ lọc" |

### 5.2 Danh mục — `/admin/khoa-hoc/danh-muc`
Bỏ dòng "Bảng điều khiển / …" và hai dải thông tin dài (dải tab của vỏ đã cho biết chỗ đứng; câu giải thích rút thành **một dòng phụ** dưới tiêu đề: "Danh mục dùng chung cho mọi gia sư. Đổi tên sẽ cập nhật khoá của tất cả gia sư.").

**Đầu trang:** "Danh mục khoá học" + "5 danh mục · 42 khoá" + nút chính **"Thêm danh mục"** (mở panel ở chế độ thêm; **giờ lưu thật**, 4.3).
**Danh sách (1600):** bảng có tay nắm kéo ⋮⋮ đầu hàng, 4 cột:
| Cột | Nội dung |
|---|---|
| ⋮⋮ | tay nắm kéo thả; `Alt+↑/↓` đổi thứ tự bằng bàn phím; **thứ tự này là thứ tự mà `GET /api/categories` trả** |
| **Danh mục** (định danh) | tên (đậm) + dòng nhỏ `slug` |
| Khoá học | `12 khoá · 9 hiển thị · 3 ẩn` (chữ, không nút vuông); là liên kết tới `/admin/khoa-hoc?kythi=<tên>` |
| (cuối) | **một** liên kết "Xem khoá" (≤2 nút/hàng; sửa/xoá nằm trong panel) |
Hàng bấm = mở **panel bên "Danh mục"**: Tên (ô sửa) · `slug` (chỉ đọc, giải thích "tự tạo từ tên") · Vị trí (nút `Lên` / `Xuống` — đường thay thế kéo thả cho bàn phím và điện thoại) · 5 khoá đầu (tên, liên kết) + "Xem tất cả 12 khoá →" · `Lưu tên` · cuối panel **"Xoá danh mục"**: tắt khi còn khoá, kèm lý do chữ "Còn 12 khoá — chuyển sang danh mục khác trước (chọn các khoá rồi Đổi kỳ thi)" và liên kết sang danh sách đã lọc; bật khi 0 khoá, bấm ra hai nút trong panel như khoá học. Đổi tên trùng → lỗi 409 hiện dưới ô: "Đã có danh mục tên này".
Kéo thả: lưu **ngay khi thả** (4.5) với toast `Hoàn tác`; lỗi 409 → tải lại thứ tự và nói "Danh sách vừa đổi, đã tải lại".

**Cây (danh mục cha–con):** **không làm ở CAT-02.** Hiện chỉ có 5 danh mục phẳng theo kỳ thi (`COURSE_CATEGORIES`, `courseData.ts:6`); cây cần cột `parentId` và quyết định hiển thị công khai. Mục 9 câu 2. Phần "ít nhất đếm số khoá mỗi danh mục" (đúng mức tối thiểu Thanh nêu) **đã đạt** bằng cột Khoá học.

**Điện thoại 390:** hàng thẻ (tên, `12 khoá · 9 hiển thị`); không kéo thả — dùng `Lên/Xuống` trong panel; panel toàn màn hình.
**Vai gia sư** (xem trang): danh sách chỉ đọc, đếm khoá **của mình**, không tay nắm, không "Thêm", không panel sửa; dòng ghi "Chỉ quản trị viên đổi được danh mục" (giữ ý `:400-406`).

**Trạng thái:** tải = `KinTableSkeleton`; lỗi = `KinStateCard` + `Thử lại` (giữ hành vi tốt hiện có `:380-388`); rỗng = "Chưa có danh mục — tạo khoá học hoặc bấm Thêm danh mục"; đang lưu thứ tự = chấm nhỏ ở đầu bảng.

### 5.3 Khung Figma cần vẽ (COO vẽ; mỗi khung 1600 và 390; dưới file Bigupdate `606:7`, đọc `608:728` và `608:1515` trước để lấy đúng thanh bên và mẫu bảng + panel)
1. Danh sách khoá — mặc định (bảng 6 cột, thanh công cụ, đầu trang).
2. Danh sách khoá — có chip lọc + 1 hàng chọn + panel "Sửa nhanh" mở.
3. Danh sách khoá — đã chọn nhiều (thanh ngữ cảnh) + toast Hoàn tác.
4. Danh sách khoá — trạng thái: đang tải / lỗi tải / chưa có khoá / lọc không ra (4 khung nhỏ).
5. Panel xoá khoá — bước xác nhận trong panel.
6. Danh mục — bảng + tay nắm kéo + panel danh mục (còn khoá: nút xoá tắt có lý do).
7. Danh mục — trạng thái thêm mới; lỗi trùng tên; lỗi/rỗng.
8. 390: thẻ-hàng khoá, tấm lọc "Lọc (2)", panel toàn màn hình, thẻ-hàng danh mục.

## 6. Máy trạng thái
Không có luồng duyệt. Trạng thái hiển thị của khoá chỉ có `status` (boolean) và `classStatus` (`open|closed|paused`) **đã có**, không thêm trạng thái mới. Ghi chú để tránh lẫn: `status=false` ẩn khoá khỏi trang công khai nhưng học viên đã ghi danh vẫn thấy (`src/app/api/courses/route.ts:37-46`); `classStatus="closed"` là ngừng nhận học viên mới, **không** ẩn khoá. Panel và chip phải nói hai điều này bằng hai chip riêng, không gộp.

## 7. Nhật ký kiểm toán ghi gì
`logAction` (`src/lib/auditLog.ts:7`); `metadata` **không chứa tên học sinh**, chỉ mã khoá/danh mục và giá trị trạng thái.

| action | resourceType / resourceId | metadata |
|---|---|---|
| `course.bulk_update` | `Course` / `bulk` | `{ op: "set_status"\|"set_category", count, ids (≤100), to: true\|false\|"<tên danh mục>", undo?: true }` — một dòng mỗi lời gọi, **kể cả hoàn tác** |
| `course_category.create` | `CourseCategory` / id | `{ name }` |
| `course_category.rename` | `CourseCategory` / id | `{ from, to, renamedCourses }` |
| `course_category.delete` | `CourseCategory` / id | `{ name }` |
| `course_category.reorder` | `CourseCategory` / `order` | `{ count }` |

Thêm nhãn Việt vào `ACTION_LABEL` (`adminOps.ts:82`): "Đổi hàng loạt khoá học", "Tạo danh mục", "Đổi tên danh mục", "Xoá danh mục", "Đổi thứ tự danh mục"; `RESOURCE_LABEL` (`:101`): `CourseCategory: "Danh mục khoá học"`. **Không ghi** khi 4xx/5xx hoặc `skipped` toàn bộ. Nhận xét ngoài phạm vi (ghi nợ cho tut-code qua trưởng phòng): `PUT /api/courses/[id]` (đổi `status`, `price`, `capacity`…) **không ghi nhật ký** — đặc biệt đổi giá là TIỀN; CAT-02 không sửa nhưng panel mới sẽ gọi nó, nên việc này nên được xử lý ở phòng Gia sư.

## 8. Test phải có

**`t-course-catalog-lib.ts`** (thuần)
- `filterRows`: tìm "toan" khớp "Toán" (bỏ dấu, không phân biệt hoa/thường), khớp slug; kết hợp 3 bộ lọc là giao; giá 0 = Miễn phí.
- `buildFacets`: tổng `shown+hidden` bằng số hàng; danh mục rỗng không xuất hiện.
- `categorySlug`: "ĐGNL HSA" → `dgnl-hsa`; hai tên chỉ khác dấu cho **cùng** slug (để API bắt trùng); chuỗi toàn ký tự lạ → không rỗng hoặc bị từ chối.
- `planBulk`: **[phá cố ý]** gia sư chọn lô lẫn khoá người khác → khoá người khác vào `skipped:not_owner`, khoá của mình vào `updated`; khoá đã đúng trạng thái → `no_change`; 101 mã → từ chối.
- `validateOrderIds`: thiếu một id / thừa id / trùng id → lỗi.

**`t-course-catalog.ts`** (API, phiên thật)
- Quyền: không phiên 401; học sinh 403; **`teacher` gọi `/api/admin/danh-muc` (GET, POST, PUT, DELETE, thu-tu) → 403**; `admin_content` và `admin_super` → 200.
- `GET /api/admin/khoa-hoc`: `teacher` chỉ thấy khoá `ownerId` của mình (tạo 2 gia sư, mỗi người 1 khoá); `enrolled` chỉ đếm `status="active"` (tạo 1 active + 1 `pending_consent` + 1 `suspended` → `enrolled=1`); payload **không** có `zaloGroupLink`, `bg`, link học online.
- `bulk`: ẩn 3 khoá → `GET /api/courses` công khai không còn 3 khoá; **hoàn tác bằng `prev`** → trở lại; **[phá cố ý]** `ids` rỗng 400, 101 mã 400, mã không tồn tại → `skipped:not_found`, `action:"set_price"` 400, `teacher` + `set_category` 403, `teacher` ẩn khoá người khác → `skipped:not_owner` và CSDL không đổi; một dòng nhật ký `course.bulk_update` mỗi lời gọi, có `count`/`to`, **không** có tên học sinh.
- Danh mục: lần `GET` đầu tạo dòng cho mọi `Course.category` đang có (idempotent: gọi hai lần không nhân đôi); tạo danh mục trống rồi `GET /api/categories` công khai thấy nó theo thứ tự; **[phá cố ý]** tạo trùng "ĐGNL HSA" và "dgnl hsa" → 409; tên rỗng / 61 ký tự / chứa `\u0000` → 400.
- Đổi tên: khoá của **hai gia sư khác nhau** cùng đổi sang tên mới (một giao dịch); **[phá cố ý]** đổi sang tên đã có → 409 và **không** khoá nào đổi (đối chiếu hành vi cũ: gộp ngầm); nhật ký `course_category.rename` có `renamedCourses` đúng.
- Xoá: danh mục còn khoá → 409 kèm số khoá, dòng vẫn còn; danh mục trống → 200, `GET` không còn.
- Thứ tự: đặt thứ tự → `GET /api/categories` trả đúng thứ tự; **[phá cố ý]** thiếu một id → 409 + `current`; hai yêu cầu đồng thời → nhất quán (không trùng `sortOrder` gây lỗi vì cột không unique).
- Chứng minh **TIỀN không đổi:** snapshot `price/originalPrice` của mọi khoá trước và sau mọi lời gọi ở trên → bằng nhau; không bảng `CourseFeeRate`/`Invoice` thay đổi.

**`ui-admin-courses.ts`** (1600 và 390)
- Cột đầu là tên khoá (không phải số ID); không có cột Slug/Ngày tạo; liên kết "Mở" đúng `/admin/khoa-hoc/<slug>`; mỗi hàng ≤2 điều khiển tương tác (đếm `a, button` trong hàng ≤ 2, ô chọn tính riêng).
- Gõ tìm → lọc tức thì, **URL đổi**; tải lại giữ nguyên bộ lọc + chip; "Xoá bộ lọc" đưa về đủ hàng.
- Bấm hàng → panel mở (không `role=dialog` modal chặn nền ở 1600: bảng vẫn bấm được); sửa tên + Lưu → hàng đổi tại chỗ **không** hiện skeleton toàn bảng; không có ô nào tên `price`.
- Chọn 3 → thanh ngữ cảnh; Ẩn → toast "Hoàn tác" → bấm → trở lại; chip trạng thái dùng chữ (kiểm `textContent`, không chỉ màu).
- **[phá cố ý]** chặn `GET /api/admin/khoa-hoc` trả 500 (intercept) → hiện "Không tải được…" **không** hiện "Không tìm thấy khoá học"; có nút Thử lại hoạt động.
- Hạ sức chứa dưới số học viên → lỗi hiện dưới ô, dữ liệu không đổi.
- Gia sư: không có bộ lọc Gia sư, không có "Đổi kỳ thi"; chỉ thấy khoá của mình; có "Mở lớp (mã mời, học viên)".
- 390: `scrollWidth <= 390`; bộ lọc gập vào "Lọc (n)"; panel toàn màn hình; nút "Tạo khoá học" thấy được mà không cuộn.
- `t-no-hex`, `t-kin-components`, `ui-admin-shell` xanh.

**`ui-admin-categories.ts`**
- Nút "Thêm danh mục" **thật sự lưu** (tải lại vẫn còn); nút Xoá tắt khi còn khoá và hiện lý do bằng chữ; xoá danh mục trống hoạt động và **tải lại không trở về** (bài đối chứng với điểm 21).
- Kéo thả (hoặc `Alt+↓`) đổi thứ tự, tải lại giữ; `Lên/Xuống` trong panel cùng kết quả.
- Gia sư mở trang → chỉ đọc, không tay nắm.
- 390 không tràn ngang.

**Bắt buộc chung:** `t-db-push-guard` (bảng mới chỉ-thêm), `tsc --noEmit` 0 lỗi, eslint không tăng.

## 9. Cờ và câu hỏi cho chủ

**Cờ:** **TIỀN = trình bày** — màn chỉ *hiển thị* giá (`price`) và miễn phí/có phí; không có ô sửa giá, không tính toán, không đụng `fee*`/`invoice*`/`CourseFeeRate`; có test snapshot giá. · **TRẺ EM = không** — chỉ số đếm học viên, không tên/tuổi; payload không có dữ liệu học sinh. · **ĐỔI NỀN = không.** · **Thay đổi hành vi cần biết:** đổi tên danh mục sang tên đã có từng *gộp ngầm*, nay trả 409.

**Câu hỏi cho Thanh (mỗi câu có mặc định):**
1. Chấp nhận **bảng mới `course_categories`** (thứ tự + tạo danh mục trống + xoá thật)? **Mặc định: có** (sửa được cả hai nút "Thêm", "Xoá" đang giả; không đổi `Course`). Nếu không: bỏ kéo thả, "Thêm", "Xoá", chỉ giữ đếm + đổi tên + lọc.
2. **Danh mục dạng cây** (cha–con, ví dụ "Đánh giá năng lực › HSA / HCM / TSA")? **Mặc định: không** ở lần này (5 danh mục phẳng); cần thì thêm `parentId` ở việc sau và phải quyết trang công khai hiển thị thế nào.
3. Có cần chức năng **"Gộp danh mục A vào B"**? Trước đây đổi tên sang tên có sẵn là gộp ngầm. **Mặc định: chưa** — 409 và hướng dẫn "chọn các khoá rồi Đổi kỳ thi", sau đó xoá danh mục trống.
4. Danh mục sau khi có thứ tự: trang công khai `/khoa-hoc` (CAT-01, phòng Học sinh) và 4 ô hero (HOME-02) hiện đọc **danh sách tĩnh** `COURSE_CATEGORIES`. **Mặc định:** CAT-02 chỉ làm API `GET /api/categories` có thứ tự và báo cho pb-hoc-sinh; việc chuyển trang công khai sang dùng thứ tự này là việc của phòng Học sinh. Thanh có muốn thế không?
5. "Miễn phí" = `price = 0`. Nhưng gia sư để trống giá thì mặc định 0 (`NC2-029`, `page.tsx:42-45`) → khoá chưa đặt giá cũng hiện "Miễn phí". **Mặc định:** nhãn "Miễn phí (giá 0)" ở bộ lọc. Muốn phân biệt "chưa đặt giá" cần cột mới ở `Course` — không làm ở đây.
6. Ba hành động hàng loạt **Hiện / Ẩn / Đổi kỳ thi** có đủ, hay cần thêm **xoá hàng loạt**? **Mặc định: không** (xoá khoá mất toàn bộ bài học, `page.tsx:507-509`; chỉ xoá từng khoá trong panel).

## 10. Tệp chung cần xin COO
| Tệp | Đổi gì (chỉ thêm) | Ai sửa | Phòng khác bị ảnh hưởng |
|---|---|---|---|
| `prisma/schema.prisma` | thêm `model CourseCategory` (mục 3); chạy `t-db-push-guard` | adm-code, một lần, trước các endpoint danh mục | không (không đổi `Course`) |
| `src/app/api/categories/route.ts` | `GET`: thêm trường `sortOrder`, đổi thứ tự trả về (theo `sortOrder` rồi chữ cái); `PUT`: kiểm trùng 409 + nhật ký. Tệp không thuộc phòng nào trong `PHAM-VI.md`; **xin chỉ định adm-code là chủ duy nhất** | adm-code | pb-hoc-sinh (CAT-01 và form tạo khoá đọc `GET`); pb-gia-su (`CreateCourseDrawer` gọi `GET`) — **thứ tự trả về đổi**, thêm trường không phá |
| `src/lib/adminOps.ts` | thêm nhãn nhật ký (mục 7). Tệp không liệt kê trong `PHAM-VI.md`; xin xác nhận thuộc adm-code như `adminNav.ts` | adm-code | không |
| Hai tệp lớn `khoa-hoc/[id]/page.tsx`, `thi-thu/**` | **không đụng** | — | — |
| `src/app/api/courses/[id]/route.ts` | **không đụng.** Ghi nợ cho tut-code: thêm `logAction` khi đổi `status`/`price`/`capacity` (mục 7) | tut-code, việc riêng | pb-gia-su |

## 11. Nợ
- **409 `baseUpdatedAt` cho đổi tên / hàng loạt:** cố ý KHÔNG làm ở CAT-02 (hai quản trị sửa cùng lúc chỉ được bảo vệ bằng khoá tư vấn + kiểm trùng trong giao dịch, chưa có kiểm bản cũ).
- **`GET /api/admin/danh-muc` còn ghi DB** (đồng bộ lười từ tên danh mục cũ trên `Course.category`): idempotent và có ghi chú trong mã; chuyển sang một lần migration/POST là việc sau.
- **`CreateCourseDrawer.tsx` còn ~66 chỗ dùng lớp Tailwind thô** `gray-*/blue-*/red-*/green-*` (42 dòng): quá nhiều để đổi gọn trong lượt sửa này; đổi sang token `--kin-*` ở việc riêng của pb-gia-su.
- Thao tác tạo danh mục (POST) chưa lấy khoá tư vấn; dựa vào `@unique` + bắt P2002.
