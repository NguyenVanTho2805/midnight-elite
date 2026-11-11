# LOI-05 · Làm lại giao diện Tìm gia sư (`/giang-vien`) và hồ sơ (`/mentor/<id>`), vẫn ẩn sau cờ

Đặc tả của pb-hoc-sinh, 11/11/2026. Đợt GỌN theo phiếu COO: trưởng phòng viết thẳng (phiếu đã chốt phạm vi + "xong khi"), không Figma, không tra web.
Nhánh `claude/loi-05-tim-gia-su` (worktree `.claude/worktrees/loi5`, rẽ từ `origin/claude/loi-lop-hoc-sinh` df485dae). Không có dòng backlog CSV.

Cờ: **TIỀN = trình bày** (giá tham khảo tự khai, không đổi cách tính) · **TRẺ EM = không** · **ĐỔI NỀN = không**. Schema: **không đổi**.
Cờ tính năng `NEXT_PUBLIC_KIN_MO_TIM_GIA_SU` giữ mặc định ẨN: KHÔNG sửa `src/lib/features.ts`, StudentShell/TutorShell/Navbar.

Lời chủ: "Các ô gia sư quá bé, không show được ảnh, thông tin; họ tên của gia sư thiếu, mất cả chữ, quá tệ." → nguyên nhân trong mã: `GiaSuCard.tsx:39` `line-clamp-2` ở tên; lưới `grid-cols-2` ở 390 và `lg:grid-cols-4` cạnh cột lọc 264px (`LuoiGiaSu.tsx:6`, `TimGiaSu.tsx:100`) ⇒ thẻ ~150px ở điện thoại, ~250px ở 1600.

---

## 1. Quyết định gọn

1. **Thư mục component mới** `src/components/guest/tim-gia-su/` (phòng Học sinh, stu-dev). KHÔNG sửa `src/components/tutor/**` (phòng Gia sư). Thư mục cũ `components/tutor/tim-gia-su` vẫn còn; sau đợt này `TimGiaSu/BoLoc/ToBoLoc/ThanhTim/LuoiGiaSu/DauHoSo/TabHoSo/ChiSoHoSo` không còn trang nào dùng (GiaSuCard vẫn dùng ở `HomeTutors.tsx`) — ghi nợ P3, phòng Gia sư dọn sau. Được phép IMPORT (chỉ đọc) `LopMoCard`, `LienHeHoSo`, `VaoLopMienPhi`, `VideoGioiThieu`, `KinLinkButton`, `ProfileTracker`, `ReportProfileButton`, kiểu trong `kieu.ts`.
2. **API danh sách không đổi**: `GET /api/tutors` đã trả đủ ảnh, tên, môn, `area` (thành phố, quận, hình thức, giá tự khai), `bio`; cấp lớp suy bằng `gradesOfTutor` (thuần, có sẵn). Facet `subjects`, `cities`, `modes` đủ cho bộ lọc.
3. **Hồ sơ: bỏ tự gọi lại API theo tên miền** (`mentor/[id]/page.tsx:30-44` fetch `${proto}://${host}/api/tutors/<id>`; ở `next dev` http mà thiếu `x-forwarded-proto` thì thành `https://localhost:3186` ⇒ lỗi mạng ⇒ "Chưa mở được hồ sơ / Hệ thống đang bận", kể cả id không tồn tại). Tách phần đọc của `src/app/api/tutors/[id]/route.ts` thành hàm máy chủ dùng chung (mục 3.1); trang gọi thẳng hàm, route gọi cùng hàm ⇒ JSON route **giữ nguyên từng trường**.
4. **Hồ sơ bỏ tab** (Giới thiệu / Lớp đang mở / Chỉ số): một trang cuộn, đủ thông tin. `?tab=` cũ được chấp nhận và bỏ qua (link cũ không chết).
5. **Bộ lọc tối giản**: ô tìm (tên/môn), Môn, Khu vực (thành phố), Hình thức (Tất cả · Online · Dạy trực tiếp). Bỏ lớp/cấp, quận, khoảng giá, "đang hoạt động", sắp xếp khỏi GIAO DIỆN (API vẫn nhận). Tham số cũ trên URL (`grade`, `district`, `priceMin`…) bị bỏ qua khi đọc — link cũ mở ra danh sách đầy đủ hơn, không lỗi.
6. Không thêm nhãn "Đã duyệt hồ sơ" ở thẻ hay hồ sơ (mọi hồ sơ công khai đều đã duyệt — nhãn thừa; tránh bị hiểu là "đã xác minh" thông tin tự khai).

## 2. Không bịa, không lộ (mục C phiếu)

- Không sao, không điểm đánh giá, không "đã xác minh"/"uy tín"/"top", không số liệu ước. Trường `rating` của API KHÔNG được vẽ.
- Số đếm (buổi đã dạy, học sinh đang học) chỉ hiện ở hồ sơ, chỉ khi > 0, kèm chữ "theo sổ lớp do gia sư ghi".
- Giá: chỉ khi `area.price !== null`, luôn kèm "tự khai" (thẻ: `200.000đ / buổi · giá tham khảo, tự khai`).
- Khu vực chỉ quận + thành phố (như `areaLine`). Không email, không số điện thoại: Zalo chỉ khi API đã trả (gia sư tự bật), như hiện tại.
- Thiếu trường nào thì BỎ dòng đó, không in "chưa khai", không đoán.

## 3. Hợp đồng mã

### 3.1 `src/lib/tutorPublicProfile.ts` (stu-code, MỚI, máy chủ)
```ts
export type TutorPublicProfile = /* đúng hình JSON route đang trả: { profileHidden, tutor{…}, stats{…}, classes[…] } */;
export async function loadPublicTutorProfile(db: PrismaClient, id: string, opts?: { viewerId?: string | null; preview?: boolean }): Promise<TutorPublicProfile | null>;
```
- `null` khi: id rỗng / > 64 ký tự / chứa NUL; không phải gia sư đã duyệt, bị khoá, bị cấm; hồ sơ ẩn trừ khi `preview && viewerId === id`.
- `route.ts` thành vỏ mỏng: đọc `?preview=1` + `getSession()` (chỉ khi preview) → gọi hàm → `null` ⇒ 404 `{ error: "Không tìm thấy gia sư" }`, có ⇒ `NextResponse.json(data)`. Lỗi DB vẫn ném (500) như cũ.
- Trang `/mentor/[id]` gọi `loadPublicTutorProfile(prisma, id)` (không preview) trong `cache()`; `null` ⇒ khối "Không tìm thấy"; ném ⇒ khối lỗi tạm thời + "Thử lại".
- `TutorDetailResponse` trong `components/tutor/tim-gia-su/kieu.ts` phải gán được từ `TutorPublicProfile` (kiểm bằng tsc).

### 3.2 `src/lib/tutorCardView.ts` (stu-code, MỚI, THUẦN — không React, không Prisma)
```ts
export function initialsOf(name: string): string;            // ≤ 2 chữ cái in hoa, chữ đầu của từ ĐẦU và từ CUỐI ("Nguyễn Thị Minh Anh" → "NA"); rỗng/rác → "?"
export function gradeLine(subjects: readonly string[]): string; // "" khi không suy được. Số 1–12 gom dải: [6,7,8,9,12] → "Lớp 6–9, 12"; thêm "Đại học" nếu có; không có số thì nhóm: "THCS · THPT"
export function bioSnippet(bio: string | null, max = 180): string; // gộp khoảng trắng/xuống dòng, cắt ở ranh giới từ + "…" khi dài hơn max; null → ""
export interface TutorCardView { id; name; initials; avatar: string | null; subjects: string[]; moreSubjects: number; gradeLine; areaLine; modeLabel; priceLine; bio }
export function tutorCardView(t: TutorListItem, maxSubjects = 4): TutorCardView;
```
- `name` = `t.name` đã `trim()` + gộp khoảng trắng, KHÔNG cắt. `areaLine` dùng `areaLine()` của `tutorArea.ts` (chỉ khi `hasPublicArea`). `modeLabel` = `MODE_LABEL[mode]` hoặc "". `priceLine` = `priceText(price) + " · giá tham khảo, tự khai"` hoặc "". `avatar` chỉ nhận chuỗi bắt đầu `data:image/` (còn lại → null, hiện chữ cái đầu).

### 3.3 `src/lib/tutorFloorFilter.ts` (stu-code, MỚI, THUẦN)
```ts
export interface SanLoc { q: string; subject: string; city: string; mode: "" | "online" | "offline" }
export const SAN_LOC_RONG: SanLoc;
export function docSanLoc(sp: URLSearchParams): SanLoc;     // kẹp độ dài như locUrl (q 60, subject 50, city 60); mode lạ → ""; bỏ mọi tham số khác
export function ghiSanLoc(f: SanLoc): string;               // chuỗi URL trang, bỏ giá trị rỗng, KHÔNG có "?"
export function apiQuery(f: SanLoc, page: number, pageSize = 24): string; // cho GET /api/tutors (page>1 mới ghi page)
export function demSanLoc(f: SanLoc): number;               // số lọc đang bật, KHÔNG tính ô tìm
export function moTaSanLoc(f: SanLoc): string[];            // cho trạng thái rỗng: ['từ khóa "x"', "môn Toán", "Hà Nội", "dạy online"|"dạy trực tiếp"]
```

### 3.4 Dữ liệu thử `tools/local-e2e/mock-tim-gia-su.ts` (stu-code, MỚI; KHÔNG sửa seed*/h.ts/wipe dùng chung)
- Thêm 8 gia sư đã duyệt vào DB của `DATABASE_URL`, KHÔNG wipe; chạy lại không nhân đôi (khoá theo email `mock-tgs-<n>@kin.test`). `--xoa` gỡ đúng 8 người này.
- Có: 1 tên rất dài ("Nguyễn Trần Hoàng Bảo Ngọc Phương Thảo Uyên Nhi" hoặc dài hơn), 2 người không ảnh, 2 người không khai giá, đủ Online/Dạy trực tiếp/cả hai, ≥3 thành phố, môn có số lớp (Toán 9, Vật lý 12, Tiếng Anh lớp 5…), bio dài và bio trống. Ảnh: data URL PNG/JPEG tự sinh bằng mã (không tải mạng), mỗi người một màu. Đánh dấu rõ trong tên/bio KHÔNG có chữ "đã xác minh".
- Đặt khu vực/giá đúng như lưu thật (`users.city` + `preferences.teaching`, xem `parseAreaInput`/`publicArea`).

## 4. Màn hình (stu-dev)

Token `--kin-*` duy nhất, không mã hex; chạm ≥ `--kin-cham-toi-thieu`; tên gia sư mọi nơi: `break-words`, KHÔNG `truncate`/`line-clamp`/`text-ellipsis`/`whitespace-nowrap`.

### 4.1 `/giang-vien` — `src/app/(guest)/giang-vien/page.tsx` + `components/guest/tim-gia-su/SanGiaSu.tsx` (client, Suspense)
- Khung: `max-w-[1440px]`, đệm như cũ. Đầu trang: H1 "Tìm gia sư" + một câu "Hồ sơ do gia sư tự khai. Xem miễn phí, không cần tài khoản."
- **≥ lg (1600)**: một hàng lọc ngang trên lưới: ô tìm (giãn) · chọn Môn · chọn Khu vực · nhóm 3 nút Hình thức · "Xóa lọc" (chỉ khi có lọc). Lưới **3 cột** toàn bề ngang (không cột lọc trái).
- **md (768–1023)**: lưới 2 cột; hàng lọc xuống 2 dòng được.
- **< md (390)**: ô tìm full + nút "Lọc (n)" (n = `demSanLoc`) mở **tờ trượt** (role=dialog aria-modal, Esc/nút Đóng, khoá cuộn nền, trả tiêu điểm về nút mở) chứa Môn, Khu vực, Hình thức, "Xem kết quả", "Xóa lọc". Lưới **1 cột**.
- Ô tìm: Enter hoặc dừng gõ 400 ms ⇒ áp. Bộ lọc nằm trên URL (`router.replace`, scroll:false).
- Dòng đếm `role=status`: "Đang tải…" / "N gia sư". "Xem thêm gia sư" khi `hasMore` (24/trang, nối, bỏ trùng id).
- Trạng thái: **đang tải** = 6 khung chờ cùng dáng thẻ (`data-the-gia-su-cho`); **lỗi** = `KinStateCard` tone lỗi + "Thử lại", giữ bộ lọc; **rỗng có lọc** = nêu lọc đang bật (`moTaSanLoc`) + "Xóa lọc"; **rỗng không lọc** = "Chưa có gia sư nào mở hồ sơ công khai." + liên kết "Xem lớp đang mở" (`/khoa-hoc`).
- Câu chân trang nhỏ: "Khu vực, bằng cấp, giá do gia sư tự khai; KiN chưa xác minh. KiN không thu phí nhận lớp."

### 4.2 Thẻ `TheGiaSu.tsx` (`data-the-gia-su`)
- Đầu thẻ: ảnh tròn **88px** (390) / **96px** (≥ lg), `object-cover`; không ảnh ⇒ khối tròn chữ cái đầu (`initialsOf`) nền `--kin-nen-dang-chon`, chữ `--kin-th-navy`. Bên phải ảnh: **tên đầy đủ** (`h3`, `--kin-co-h4` hoặc gần, semibold, xuống dòng tự nhiên, `data-ten-gia-su`) + dòng môn (tối đa 4, "+n").
- Thân: danh sách nhãn–giá trị, chỉ dòng có dữ liệu: Cấp lớp · Khu vực · Hình thức · Giá tham khảo (`priceLine`). Rồi một đoạn giới thiệu (`bioSnippet`, `line-clamp-2` có chủ ý, `data-gioi-thieu`).
- Đáy thẻ: nút liên kết **"Xem hồ sơ"** full bề ngang thẻ, ≥ 44px, `aria-label="Xem hồ sơ <tên>"`, href `/mentor/<id>`. Tên cũng là liên kết cùng đích. Thẻ cùng hàng cao bằng nhau (nút dính đáy).
- Thẻ không bao giờ hẹp hơn ~320px; không tràn ngang ở 390.

### 4.3 `/mentor/<id>` — `src/app/(guest)/mentor/[id]/page.tsx` (máy chủ) + component trong `components/guest/tim-gia-su/`
- Dữ liệu: `loadPublicTutorProfile` (3.1). `generateMetadata` dùng cùng hàm (qua `cache`).
- **1600**: khung `max-w-[1200px]`; trái (giãn): đầu hồ sơ (ảnh bìa 16:6 nếu có — không có thì KHÔNG khối giả; ảnh tròn 128px hoặc chữ cái đầu; tên đầy đủ H1 xuống dòng; chip môn; nhãn–giá trị Cấp lớp · Khu vực · Hình thức · Trường/bằng cấp (tự khai)) → **Giới thiệu** (bio đầy đủ, `whitespace-pre-line`; trống ⇒ "Gia sư chưa viết phần giới thiệu.") → Video giới thiệu (nếu có, `VideoGioiThieu`) → **Lớp đang mở** (`LopMoCard`; không có ⇒ "Gia sư chưa mở lớp nhận thêm học sinh. Bạn có thể gửi yêu cầu để hỏi lịch.") → dòng số đếm sổ lớp (2). Phải 360px dính: giá (nếu có) + "Giá tham khảo do gia sư tự khai. Thỏa thuận trực tiếp; KiN không thu hộ." · `LienHeHoSo` (Nhắn Zalo khi có · Gửi yêu cầu) · Nhắn Messenger (khi có) · Lớp miễn phí (`VaoLopMienPhi`, giữ luật vai như cũ) · nhắc an toàn + `ReportProfileButton`.
- **390**: một cột: đầu hồ sơ → nút liên hệ → giá → giới thiệu → video → lớp đang mở → lớp miễn phí → nhắc an toàn.
- "Quay lại danh sách" CHỈ khi `featureOn("TIM_GIA_SU")` (như LOI-01); cờ tắt ⇒ lối đi tiếp là "Xem lớp đang mở" (`/khoa-hoc`). Giữ `#kin-profile-end`, `ProfileTracker`, lời mời "Tạo hồ sơ của bạn" cho khách.
- **Không tìm thấy** (`data-ho-so-khong-thay`): H1 "Không tìm thấy gia sư này", "Đường dẫn có thể sai, hoặc gia sư đã ẩn hồ sơ." + nút theo cờ (`/giang-vien` "Xem danh sách gia sư" hoặc `/khoa-hoc` "Xem lớp đang mở") + "Về trang chủ". **Lỗi tạm thời** (`data-ho-so-loi`): giữ như cũ.
- Giữ data-attr cũ mà bài khác dựa vào: `data-ho-so`, `data-ho-so-dau`, `data-lien-he`, `data-gia-tham-khao`, `data-free-class-block`, `data-testid="tutor-area"`.

## 5. Test

| Bài | Ai | Nội dung |
|---|---|---|
| `t-tutor-card-lib.ts` (mới) | stu-code | `initialsOf`, `gradeLine`, `bioSnippet`, `tutorCardView`, bộ lọc 3.3; **ca phá cố ý**: tên 80 ký tự không bị cắt, NFD, emoji, khoảng trắng lạ, `avatar` = `javascript:`/`http:` → null, giá null → không có "tự khai", `rating` không lọt vào view, mode rác, `?mode=<script>`, tham số cũ bị bỏ |
| `t-tutor-profile.ts` (mới) | stu-code viết, stu-test chạy | Route `/api/tutors/<id>` giữ đúng tập khoá cũ; id không có / NUL / 65 ký tự / chưa duyệt / bị khoá / ẩn ⇒ 404; chủ xem trước ẩn ⇒ 200 `profileHidden:true`; người khác `?preview=1` ⇒ 404 |
| `ui-loi05.ts` (mới) | stu-dev viết, stu-test chạy | Cờ BẬT: 390 + 1600 — số cột (1/3), tên dài hiện ĐỦ (chữ trong DOM = tên, `scrollWidth<=clientWidth`, không `text-overflow:ellipsis`, không `-webkit-line-clamp` trên `[data-ten-gia-su]`), ảnh hiện / chữ cái đầu, giá "tự khai" chỉ ở người có giá, không ★, không tràn ngang, mọi nút/link ≥44px, lọc theo Môn/Khu vực/Online đổi kết quả + URL, tờ lọc 390 mở/đóng Esc, rỗng + Xóa lọc. Hồ sơ 390 + 1600: tên dài đủ, có nút Gửi yêu cầu, id sai ⇒ "Không tìm thấy gia sư này". Cờ TẮT: `/giang-vien` 307; `/mentor/<id>` 200 có tên; id sai ⇒ không tìm thấy, không có "Quay lại danh sách". Chụp ảnh vào `scratchpad/shots/loi05-*.png` |
| Chạy lại | stu-test | `ui-role-everything` ROLE=guest và ROLE=student (cờ tắt), `ui-links-everywhere` (tắt và bật), `t-features-lib`, `t-no-hex`, `t-no-fabricated`, `t-tutor-search-lib`, `t-tutor-search`, `ui-tim-gia-su` (sửa ca cũ về 4 cột/2 cột/tab cho khớp thiết kế mới — chỉ sửa kỳ vọng bố cục, giữ ca an toàn), `tsc --noEmit` |

## 6. Câu hỏi cho chủ (mặc định đã chọn)

- Q1. Khối gia sư ở trang chủ (`HomeTutors.tsx`, đang ẩn theo cờ) vẫn dùng thẻ cũ nhỏ. Khi bật cờ có đổi sang thẻ mới không? Mặc định: làm ở đợt sau, cùng lúc bật cờ.
- Q2. Hồ sơ bỏ tab "Chỉ số" (chỉ còn một dòng số đếm sổ lớp). Mặc định: bỏ.
