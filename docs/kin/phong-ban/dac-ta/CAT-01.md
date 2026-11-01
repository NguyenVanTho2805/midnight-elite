# CAT-01 — Thiết kế lại danh mục khoá học CÔNG KHAI `/khoa-hoc` (khách và học sinh)

**Phòng / vai:** pb-hoc-sinh → stu-rnd viết; stu-code ∥ stu-dev làm (một người làm cả hai vai trong lượt này). **Cỡ:** M. **Ngày:** 01/11/2026.
**Nhánh:** `claude/stu-cat-01`, rẽ từ `origin/claude/adm-cat-02` (PR #98 chưa gộp) → **PR xếp chồng trên #98**: phải gộp #98 trước, hoặc đổi nền sang `main` sau khi #98 vào.
**Cờ:** TIỀN = trình bày (giá chỉ hiển thị, không đổi cách tính; giá 0 hiện chữ "Miễn phí") · TRẺ EM = không (chỉ đếm sĩ số, không tên học sinh, không gửi con số sĩ số ra trình duyệt) · ĐỔI NỀN = không (không schema).
**Tham khảo cách sắp xếp (không sao chép):** sàn gia sư kiểu italki/Preply — một thanh lọc gọn trên cùng, lưới thẻ 3–4 cột (1–2 cột điện thoại), mỗi thẻ trả lời ngay "ai dạy, giá bao nhiêu, còn chỗ không". Figma: COO vẽ.

## 1. Vấn đề thấy trong mã hiện tại (`src/app/(guest)/khoa-hoc/page.tsx`, 376 dòng)

| # | Vấn đề | Dòng |
|---|---|---|
| 1 | Cả trang là `"use client"` + `useCourses()`: máy chủ trả HTML rỗng, công cụ tìm kiếm không thấy khoá nào (SEO yếu). | 1, 160 |
| 2 | Danh mục đọc từ danh sách **tĩnh** `COURSE_CATEGORIES`, không theo thứ tự quản trị đặt (CAT-02 `sortOrder`); danh mục không có khoá nào vẫn hiện. | 12, 190-230 |
| 3 | Thẻ quá cao: nền gradient 168px + dải danh mục + ngày khai giảng + 2 nút (≈420px/thẻ) → ở 390px cuộn rất dài; hai nút "Theo dõi lớp" + "Xem chi tiết" mỗi thẻ. | 49-186 |
| 4 | Thẻ **không cho biết còn chỗ hay đã đầy** dù `capacity`/`classStatus` có sẵn; lớp đã đóng vẫn mời "Xem chi tiết" như lớp mở. | toàn thẻ |
| 5 | Giá 0 hiện "0 đ" thay vì "Miễn phí". | 144 |
| 6 | Bố cục chọn thừa: thanh bên 224px liệt kê **từng khoá** (không phải danh mục), cộng hai hàng chip trùng nhau (mobile + desktop) → chọn một chỗ, hiện hai lần. | 192-217, 239-276 |
| 7 | Bộ lọc chỉ ở state: tải lại / chia sẻ liên kết mất lọc (chỉ đọc `?category=` lúc vào); tìm kiếm không vào URL. | 164 |
| 8 | Không lọc giá (miễn phí/có phí), không lọc "còn chỗ", không sắp xếp. | — |
| 9 | Trạng thái rỗng: một câu + "Xem tất cả" cho cả hai trường hợp (chưa có khoá / lọc không ra). **Lỗi tải bị nuốt** thành rỗng ("Không có khóa học nào"). Đang tải: ô xám dùng `bg-gray-200`, không có chữ. | 291-298, 164 |
| 10 | Nút tắt (✕) xoá tìm kiếm 16px (<44px). Hex `#FF2157`, `#0068FF33` viết cứng trong trang (ngoại lệ trong `t-no-hex.ts`). | 266, 233, 120 |
| 11 | Thẻ là `div` có `onClick` điều hướng (không phải liên kết thật): không mở tab mới, không đọc được bằng bàn phím/trình đọc. | 39 |

## 2. Bố cục mới

Trang **Server Component** (`export const dynamic = "force-dynamic"`): máy chủ đọc DB, dựng sẵn HTML đầy đủ khoá đã lọc theo URL (SEO + không nháy), rồi giao cho một Client Component chỉ để tương tác lọc.

```
Tiêu đề h1 "Khoá học" + 1 dòng mô tả (trái, không căn giữa, không hero)
[ ô tìm (searchbox, ≥44px)                                     ]
[ Tất cả · ĐGNL HSA (4) · ĐGNL HCM (2) · …  ]  ← chip cuộn ngang, thứ tự sortOrder, ≥44px
[ Giá ▾ ]  [ Sắp xếp ▾ ]  [ ☐ Chỉ lớp còn chỗ ]   "N khoá" · Xoá bộ lọc (khi có lọc)
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   ≥1280: 4 cột · ≥1024: 3 · ≥560: 2 · <560: 1
│ thẻ    │ │ thẻ    │ …
```
- Không thanh bên, không hero gradient lớn. Chip danh mục là bộ lọc chính duy nhất (bỏ danh sách từng khoá).
- Chip: chỉ danh mục **có ≥1 khoá đang công khai** (kèm số khoá), theo `sortOrder` rồi chữ cái (cùng luật với `GET /api/categories`); thêm chip của danh mục đang chọn nếu nó rỗng/không tồn tại để người dùng thấy và gỡ được.
- Chip, ô chọn, nút: `min-height: var(--kin-cham-toi-thieu)` (44px). 390px không tràn ngang (chip cuộn trong khung `overflow-x-auto`, không làm rộng trang).

### Thẻ khoá (một liên kết thật `<a href="/khoa-hoc/<slug>">` phủ cả thẻ)
Từ trên xuống: dải mỏng 56px gradient theo danh mục (`CATEGORY_GRADIENT`, có sẵn) mang nhãn danh mục + nhãn giảm giá `-N%` (nếu có `originalPrice`>`price`) → **tên khoá** (tối đa 2 dòng) → **gia sư** (`TeacherTag` 24px; không có tên → "Trung tâm") → `N bài · N giờ` → **dòng chỗ** (`KinStatus`, luôn có chữ) → hàng giá: giá lớn hoặc **Miễn phí** (+ giá gốc gạch nếu giảm) → nút lưu theo dõi (`KinBookmark` 44px, nằm trên liên kết; học sinh đã học lớp đó thì thay bằng nhãn "Đang học", liên kết thẻ vẫn tới trang chi tiết, kèm liên kết "Vào học →" tới `/student/hoc-tap?course=<slug>`).
Bỏ khỏi thẻ: ngày khai giảng, nút "Xem chi tiết" (cả thẻ đã là liên kết).

### Dòng chỗ (`seatState`, hàm thuần)
| Điều kiện (theo thứ tự) | Chữ | Tông |
|---|---|---|
| `classStatus = "closed"` | Đã đóng nhận học viên | mo |
| `classStatus = "paused"` | Tạm ngừng | mo |
| `capacity` null | Đang nhận học viên | xong |
| `đang học ≥ capacity` | Đã đầy | loi |
| còn ≤ 5 chỗ | Chỉ còn N chỗ | cho |
| còn lại (> 5) | Còn chỗ (không kèm số) | xong |
"Đang học" = số `Enrollment` `status="active"` (cùng quy tắc `PUT /api/courses/[id]`); đếm bằng **một** `groupBy`. **Sĩ số, `capacity`, số đang học KHÔNG gửi ra trình duyệt**; chỉ gửi `{state, left}`, trong đó `left` chỉ là số khi `low` (1–5), còn lại `null` — số lớn suy ra được sĩ số. `tagColor` từ DB chỉ được dùng nếu khớp `#rrggbb` hoặc `var(--kin-…)` (`safeTagColor`). Lớp đầy/đóng vẫn hiện (không giấu) và vẫn bấm vào xem được; bộ lọc "Chỉ lớp còn chỗ" giữ state ∈ {open, low, unlimited}.

### Trạng thái
- **Đang tải:** `loading.tsx` của route — khung bộ lọc + 6 ô xám `KinSkeleton`, `aria-busy`, có chữ "Đang tải danh sách khoá học".
- **Lỗi:** máy chủ đọc DB hỏng → `KinStateCard tone="loi"` (role=alert) "Chưa tải được danh sách khoá học" + liên kết "Thử lại" (`href` chính trang) — **không** nuốt thành "rỗng".
- **Rỗng, chưa có khoá công khai nào:** `KinEmptyState` "Chưa có khoá học nào đang mở" + liên kết "Tìm gia sư" `/giang-vien`.
- **Rỗng vì lọc:** "Không có khoá học phù hợp" + nút "Xoá bộ lọc" (ghi rõ đang lọc gì: chip tóm tắt).

## 3. URL và bộ lọc (khớp CAT-02)
`/khoa-hoc?category=<tên danh mục>&q=<chữ>&gia=free|paid&concho=1&sx=moi|gia-tang|gia-giam`
- **Khoá là `name` danh mục, không phải id số.** `?kythi=<tên>` là **bí danh đọc** (CAT-02 admin dùng `kythi`); khi viết lại URL luôn ghi `category` (trang chủ HOME-01 đã trỏ `/khoa-hoc?category=…` → vẫn chạy, kể cả giá trị có dấu, khoảng trắng, mã hoá `%20`). `category=Tất cả` hoặc rỗng = không lọc.
- Máy chủ đọc `searchParams` (Promise, Next 16) để dựng HTML ban đầu; trình duyệt đổi bộ lọc bằng `history.replaceState` (không gọi lại máy chủ, không thêm mục lịch sử mỗi lần gõ), mặc định bị bỏ khỏi URL.
- Tìm: không phân biệt hoa thường và dấu, khớp tên khoá, tên gia sư, tên danh mục.
- `sx=moi` (mặc định) = thứ tự trang công khai hiện có (`Course.sortOrder`); `gia-tang`/`gia-giam` sắp theo giá hiển thị (miễn phí = 0 đứng đầu khi tăng).

## 4. Dữ liệu và phạm vi tệp
Không schema, không API mới (đọc DB trực tiếp ở trang máy chủ, như `thu-vien`, `diem-chuan`).
- `src/lib/courseCatalogPublic.ts` — **thuần**: `seatState`, `priceView`, `parseCatalogParams`, `buildCatalogQuery`, `filterCatalog`, `sortCatalog`, `catalogChips`, `orderCategoryNames`.
- `src/lib/courseCatalogPublicServer.ts` — `loadPublicCatalog()`: chỉ `select` trường cần (không `zaloGroupLink`, `zaloGroupUrl`, `classJoinUrl`, `adminName`, `ownerId`), `status: true`, thứ tự `Course.sortOrder`; danh mục theo `course_categories`.
- `src/components/catalog/CourseCatalog.tsx` (client: lọc, URL, thẻ), `src/app/(guest)/khoa-hoc/page.tsx` (máy chủ), `src/app/(guest)/khoa-hoc/loading.tsx`.
- **Không đụng:** `src/app/(guest)/khoa-hoc/[slug]/**`, `src/app/api/courses/**`, `src/app/api/categories/**`, bất kỳ `fee*`/`invoice*`, menu (không đưa lại mục đã rút ở BU-00). `useCourses` vẫn dùng ở nơi khác.
- `tools/local-e2e/t-no-hex.ts`: bỏ ngoại lệ `(guest)/khoa-hoc/page.tsx` (trang mới không còn hex; test bắt ngoại lệ cũ rích).
- Trong `/api/courses` (công khai) có trả `capacity` nhưng **không** có số đang học → vì vậy thẻ không thể tính "còn chỗ" từ API cũ; trang mới đi đường máy chủ.

## 5. Test cần có
- `tools/local-e2e/t-course-catalog-public-lib.ts` (thuần, không cần máy chủ): `seatState` đủ 6 nhánh + biên (đúng bằng capacity, còn đúng 5, còn 6, capacity 0, enrolled > capacity); `priceView` (0 → Miễn phí, giảm giá làm tròn, `originalPrice` null/≤price không giảm); `parseCatalogParams` (`kythi` bí danh, `category` thắng `kythi`, `Tất cả`, giá trị lạ của `gia`/`sx` về mặc định, mảng lặp lấy phần tử đầu, khoảng trắng); `buildCatalogQuery` khứ hồi + bỏ mặc định + mã hoá dấu; `filterCatalog` (danh mục theo tên, tìm bỏ dấu, miễn phí/có phí, còn chỗ, giao các bộ lọc); `sortCatalog`; `catalogChips` (bỏ danh mục rỗng, giữ danh mục đang chọn, đếm đúng); `orderCategoryNames` theo `sortOrder`; **ca phá**: đối tượng khoá không chứa khoá `capacity`/`enrolled`/`zalo*` sau khi qua `toPublicCard`.
- `tools/local-e2e/t-course-catalog-public.ts` (cần máy chủ — COO chạy): HTML tải về bằng `fetch` (không chạy JS) đã chứa tên khoá (SEO); lọc `?category=` có dấu và `?kythi=`; khoá ẩn (`status=false`) không xuất hiện; không rò `zaloGroupLink`/mã lớp/`capacity` trong HTML.
- `tools/local-e2e/ui-course-catalog.ts` (trình duyệt — COO chạy): 1280 (4 cột) và 390 (không tràn ngang `scrollWidth ≤ clientWidth`, mọi nút/chip/ô ≥44px); chip theo `sortOrder`; chọn chip → URL có `category=`; tải lại giữ lọc; thẻ "Đã đầy" / "Còn N chỗ" / "Đã đóng" / "Miễn phí"; rỗng-do-lọc có "Xoá bộ lọc"; học sinh đã học thấy "Đang học"; khách bấm lưu theo dõi → sang đăng nhập; thẻ là `<a>` thật.
