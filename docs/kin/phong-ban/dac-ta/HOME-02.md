# HOME-02 — Màn sửa trang chủ trong quản trị (`/admin/trang-chu`)

**Phòng / vai:** pb-admin → adm-rnd viết; adm-code + adm-dev làm **SAU khi HOME-01 (phòng Học sinh) xong trên cùng nhánh**. **Cỡ:** M.
**Nhánh đề xuất:** `claude/adm-home-02` rẽ từ nhánh có HOME-01 (hiện là `claude/stu-home`: main + STU-001/002). Ghi rõ trong PR.
**Ngày:** 01/11/2026. **Đọc mã tại:** worktree `claude/stu-home` (`src/app/page.tsx` 212 dòng, `src/lib/landingCopy.ts`, `src/lib/adminNav.ts`, `src/lib/permissions.ts`, `src/lib/adminOps.ts`, `src/components/admin/AdminShell.tsx`, `src/app/(admin)/layout.tsx`, `src/lib/hostRouting.ts`). **Chưa có** `src/lib/siteContent.ts` hay bảng `site_content` — mọi chỗ gọi là "HOME-01" dưới đây là **hợp đồng giả định**, mục 3 liệt kê chính xác điều gì phải khớp.
**Cờ:** TIỀN = không · TRẺ EM = không · ĐỔI NỀN = không (xem mục 9 cho hai điểm cần Thanh trả lời).
**Nguồn tham khảo cách sắp xếp (không sao chép):** NN/g "Modal & Nonmodal Dialogs" (sửa trong panel bên, không hộp thoại) — https://www.nngroup.com/articles/modal-nonmodal-dialog/ ; NN/g "Data Tables" — https://www.nngroup.com/articles/data-tables/ ; PatternFly bulk selection (chỉ để tham khảo CAT-02) — https://www.patternfly.org/patterns/bulk-selection/.

---

## 1. Vấn đề và bằng chứng

Chữ trang chủ nằm **cứng trong mã**. Muốn đổi một câu phải có người sửa mã, mở PR, chờ gộp, chờ triển khai. Vừa có STU-002 sửa 6 lời hứa sai — cho thấy chữ trang chủ cần đổi nhanh và đổi bởi người không viết mã.

| Chỗ cứng | Tệp:dòng (nhánh `claude/stu-home`) |
|---|---|
| badge hero | `src/app/page.tsx:72-74` |
| h1 hai dòng (`<br />` viết cứng) | `src/app/page.tsx:75-77` |
| mô tả hero | `src/app/page.tsx:78-80` |
| 2 nút hero (chữ + đường dẫn `/khoa-hoc`, `/thi-thu`) | `src/app/page.tsx:81-84` |
| 4 ô kỳ thi (mảng `HERO_CATEGORIES`) | `src/app/page.tsx:21-26`, vẽ ở `:90-100` |
| 4 thẻ "Học ở đây thì được gì?" (mảng `WHY_ITEMS`, icon là component) | `src/app/page.tsx:50-55`, vẽ ở `:117-137` |
| tiêu đề + 2 nút khối gia sư | `src/app/page.tsx:143-147`, `:169-172` (đường dẫn trong `TUTOR_CTA`, `src/lib/landingCopy.ts:34`) |
| CTA cuối trang | `src/app/page.tsx:194-205` |

Hai bẫy đã thấy trong mã, form phải chặn:
1. **Nhãn ô kỳ thi đồng thời là tham số lọc**: `src/app/page.tsx:93-94` ghi chú "trang /khoa-hoc đọc ?category= với đúng các tên này". Nếu quản trị gõ tự do "Đánh giá năng lực HSA" mà danh mục thật là "ĐGNL HSA" thì ô mở ra danh sách rỗng. → ô kỳ thi phải **chọn danh mục từ danh sách thật**, chữ hiển thị tách riêng.
2. **Lời hứa không có thật** quay lại chỉ bằng một lần gõ: `tools/local-e2e/t-no-fabricated.ts` chỉ quét **mã nguồn**, không quét dữ liệu trong CSDL. Nội dung sửa ở quản trị sẽ **lọt qua test hiện có**. → máy chủ phải tự chặn cùng danh sách cụm cấm khi lưu (mục 4).

Hiện không có nơi nào trong quản trị sửa nội dung trang công khai ngoài Tin tức (`src/lib/adminNav.ts:38`) và Điểm chuẩn.

## 2. Phạm vi tệp (adm-code và adm-dev, không trùng)

**Điều kiện bắt đầu:** HOME-01 đã gộp vào nhánh và có **đủ 4 thứ** ở mục 3.3. Chưa đủ → adm-code/adm-dev dừng, báo trưởng phòng (không tự viết lại tầng dữ liệu).

**adm-code** (máy chủ):
- `src/app/api/admin/site-content/home/route.ts` — mới: `GET`, `PUT` (mục 4).
- `src/lib/homeContentGuard.ts` — mới, **thuần** (không import prisma): `CLAIM_BLOCKLIST` (cụm cấm), `checkClaims(text)`, `LINK_RULE`, `diffHomeContent(before, after): string[]` (danh sách đường dẫn trường đổi), `HOME_LIMITS` (giới hạn ký tự từng trường).
- `src/lib/adminOps.ts` — thêm nhãn nhật ký: action `site_content.update` → "Sửa nội dung trang chủ"; resource `SiteContent` → "Nội dung trang công khai" (`ACTION_LABEL` `adminOps.ts:82`, `RESOURCE_LABEL` `:101`; để `AUDIT_ACTION_OPTIONS` ở bộ lọc Nhật ký có mục này).
- `src/lib/adminNav.ts` — thêm 1 mục (mục 5.1). `src/lib/permissions.ts` — **không đổi** (dùng `MANAGE_NEWS` sẵn có).
- Test: `tools/local-e2e/t-home-content-guard-lib.ts`, `tools/local-e2e/t-home-content-admin.ts` (mục 8).

**adm-dev** (giao diện):
- `src/app/(admin)/admin/trang-chu/page.tsx` — mới: trang sửa (client).
- `src/app/(admin)/admin/trang-chu/xem-truoc/page.tsx` — mới: khung xem trước trong iframe (mục 5.3).
- `src/components/admin/home/HomeEditor.tsx`, `BlockCard.tsx`, `CharCounter.tsx`, `IconPicker.tsx`, `PreviewFrame.tsx` — mới.
- Test: `tools/local-e2e/ui-admin-home-content.ts`.

**Không trùng:** adm-code không đụng `src/app/**` trang/component; adm-dev không đụng `src/app/api/**`, `src/lib/**`. Hai bên chỉ gặp nhau ở hợp đồng JSON mục 4.

**Phần của phòng Học sinh (HOME-01) mà HOME-02 cần — ghi vào phiếu giao HOME-01 nếu chưa có:**
- `src/components/guest/HomeSections.tsx` (stu-dev): phần thân trang chủ (Hero → Lợi ích → khối gia sư → CTA, **không** Navbar/Footer) nhận `props: { content: HomeContent; stats: {value:string;label:string}[] }`, **không** hook, **không** prisma, **không** `async`. `src/app/page.tsx` chỉ còn: tải `loadHomeContent()` + `loadStats()`, bọc `<Navbar/> <main><HomeSections/></main> <Footer/>`. Đây là cách **dùng chung đúng một component** cho trang thật và bản xem trước.
- `src/components/guest/homeIcons.ts` (stu-dev): `HOME_ICON_KEYS` (danh sách khoá icon, mục 5.2) và `HOME_ICONS: Record<key, Component>`. Admin chọn theo khoá; **không lưu tên component** vào CSDL.

## 3. Schema

### 3.1 Không thêm gì trong HOME-02
Bảng `site_content` do HOME-01 làm (`key` unique, `data Json`, `updatedAt`, `updatedBy`). HOME-02 **chỉ dùng**, không sửa.

### 3.2 Hình dạng `HomeContent` mà HOME-02 giả định (tên khoá này cũng là đường dẫn trong `changedFields` và lỗi từng trường)
```
HomeContent {
  hero:   { badge, h1 (≤2 dòng, tách bằng "\n"), desc,
            primary: {label, href}, secondary: {label, href} }
  exams:  [4 phần tử] { label, desc, category }       // category = tên danh mục thật
  why:    { title, sub, items: [1..6] { icon, title, desc } }   // icon ∈ HOME_ICON_KEYS
  tutors: { eyebrow, title, sub, primary: {label, href}, secondary: {label, href} }
  cta:    { title, desc, primary: {label, href}, secondary: {label, href} }
}
```
Nếu HOME-01 đặt tên khoá khác, **chỉ đổi bảng này và `HOME_LIMITS`**; hợp đồng mục 4 không đổi (nội dung đi nguyên khối).

### 3.3 Bốn thứ HOME-01 phải có (điều kiện bắt đầu)
1. `loadHomeContent()` luôn trả `HomeContent` hợp lệ (dòng chưa có / JSON hỏng → `DEFAULT_HOME_CONTENT`, **không ném lỗi**); `DEFAULT_HOME_CONTENT` đúng chữ hiện tại ở `page.tsx` (STU-002).
2. `parseHomeContent(raw): {ok:true,value}|{ok:false,errors:Record<path,string>}` **kiểm chặt, thuần, không import prisma**, trả lỗi **theo đường dẫn trường** (`hero.h1`, `why.items[2].icon`…), từ chối khoá lạ, cắt khoảng trắng đầu/cuối, từ chối ký tự điều khiển. Để admin dùng cả ở trình duyệt, **tách** thành `src/lib/siteContentSchema.ts` (thuần: kiểu, DEFAULT, parse, `HOME_ICON_KEYS`) và `src/lib/siteContent.ts` (prisma: `loadHomeContent`, `saveHomeContent`, `revalidateHome`). Trình duyệt **không** được import tệp có prisma.
3. `revalidateHome()` — gọi `revalidatePath("/")` (trang chủ đang `export const revalidate = 3600`, `page.tsx:30`), nuốt lỗi và trả `boolean`.
4. `saveHomeContent(userId, value, baseUpdatedAt)` ghi `updatedAt`/`updatedBy` và so `baseUpdatedAt` trong **cùng giao dịch** (chống ghi đè mù, mục 4 mã 409). Nếu HOME-01 chưa làm, adm-code làm hàm này trong `siteContent.ts` — **phải xin COO** vì tệp thuộc phòng Học sinh (mục 10).

## 4. Hợp đồng API

Cả hai: `export const dynamic = "force-dynamic"`; xác thực bằng `requirePermission(PERMISSIONS.MANAGE_NEWS)` (`src/lib/auth-guard.ts:8`). `MANAGE_NEWS` có ở `admin_super` và `admin_content` (`src/lib/permissions.ts:27-34`), **không** có ở `teacher`.

### `GET /api/admin/site-content/home`
- Vào: không.
- Ra 200: `{ content: HomeContent, defaults: HomeContent, isDefault: boolean, updatedAt: string|null, updatedBy: { name: string }|null }`. `isDefault=true` khi chưa có dòng trong `site_content` hoặc JSON hỏng. `updatedBy.name` là tên nhân sự (quản trị — không phải học sinh).
- Lỗi: 401 chưa đăng nhập · 403 không đủ quyền / vai gia sư · 500 `{error}` chữ Việt, không lộ stack.

### `PUT /api/admin/site-content/home`
- Vào (JSON, ≤ 32 KB): `{ content: HomeContent, baseUpdatedAt: string|null }` (`null` khi đang sửa từ bản mặc định).
- Thứ tự xử lý: quyền → kích thước → `parseHomeContent` → `LINK_RULE` → `checkClaims` mọi trường chữ → so `baseUpdatedAt` → so với bản đang lưu (`diffHomeContent`) → ghi → nhật ký → `revalidateHome()`.
- Ra 200: `{ ok: true, content, updatedAt, changedFields: string[], revalidated: boolean }`. **Không có thay đổi** → `{ ok: true, unchanged: true, updatedAt }`, không ghi, không nhật ký, không `revalidate`.
- Lỗi:
  - 400 JSON hỏng / thiếu `content`.
  - 401 / 403 như trên.
  - 409 `{ error: "conflict", current: { content, updatedAt, updatedBy } }` — người khác đã lưu sau lúc mở; **CSDL không đổi**.
  - 413 thân > 32 KB.
  - 422 `{ error: "invalid", fields: { "<đường dẫn>": "<câu lỗi Việt>" } }` — vượt giới hạn, icon lạ, đường dẫn xấu, đủ 4 ô kỳ thi, 1–6 thẻ, hoặc dính cụm cấm (câu lỗi nêu **cụm đã khớp** và lý do, ví dụ "'live mỗi tối': KiN không tổ chức lớp live").
  - 500 `{error}` (ghi lỗi `console.error`, không lộ chi tiết).
- Quy tắc kiểm (một nguồn trong `homeContentGuard.ts` + `parseHomeContent`):
  - **Giới hạn ký tự** (đo sau cắt khoảng trắng; đếm theo ký tự Unicode): hero.badge 60 · hero.h1 70 tổng, ≤1 dấu xuống dòng · hero.desc 200 · nhãn nút 24 · exams.label 24 · exams.desc 36 · why.title 50 · why.sub 80 · item.title 40 · item.desc 160 · tutors.eyebrow 40 · tutors.title 70 · tutors.sub 120 · cta.title 70 · cta.desc 160. (Giá trị đo từ độ dài hiện tại + chỗ trống của bố cục; adm-dev chỉnh nếu xem trước 390px vỡ hàng, số cuối nằm ở `HOME_LIMITS`.)
  - **Đường dẫn nút:** hoặc đường dẫn nội bộ `^/(?!/)[A-Za-z0-9\-._~/?=&%#]*$`, hoặc `https://…` có tên miền. Cấm `javascript:`, `data:`, `//host`, `http://`, khoảng trắng. Có danh sách gợi ý (`/khoa-hoc`, `/thi-thu`, `/giang-vien`, `/dang-ky`, `/dang-ky?vai=gia-su`, `/dang-nhap`, `/cong-dong`, `/tin-tuc`, `/diem-chuan`).
  - **Cụm cấm** (`CLAIM_BLOCKLIST`): sao đúng 6 dòng STU-002 trong `t-no-fabricated.ts:44-49` (khối STU-002) và các dòng `:28-43` đứng trước nó (số 1.200+/10.000+, "hàng đầu Việt Nam", "Hoàn tiền 100%", "Học trọn đời", "AI hỗ trợ giải bài/24/7", "VNPay", "cam kết", "đảm bảo kết quả"). Một dòng test `t-home-content-guard-lib` khoá rằng danh sách này **bao trùm** cả ba câu mẫu STU-002 (mục 8). Khi `t-no-fabricated` đổi, phải đổi cả hai (ghi vào mục 9 câu 4).
  - **Icon:** ∈ `HOME_ICON_KEYS`.
  - **Ô kỳ thi:** `category` là chuỗi không rỗng (không bắt buộc tồn tại trong CSDL — danh mục có thể đổi tên sau; giao diện cảnh báo, mục 5.4).

### Quyền theo vai (đối chiếu `permissions.ts`)
| Vai | GET | PUT |
|---|---|---|
| admin_super | 200 | 200 |
| admin_content | 200 | 200 |
| teacher | 403 | 403 |
| học sinh / phụ huynh / khách | 401 hoặc 403 | 401 hoặc 403 |

## 5. Luồng màn

### 5.1 Lối vào
`src/lib/adminNav.ts`, module `noi-dung`, thêm sau "Tin tức & Blog" (`adminNav.ts:38`): `{ label: "Trang chủ", href: "/admin/trang-chu", permission: PERMISSIONS.MANAGE_NEWS }`. BU-08 sẽ gom module này vào **Học vụ**; mục này đi theo nhóm Nội dung hiện tại và không làm khó BU-08 (một dòng trong mảng). Test `t-admin-nav-lib` / `t-admin-queue-lib` (quét thư mục) phải biết trang mới.

### 5.2 Bố cục (1600px)
Đầu trang `KinPageHeader`: "Trang chủ" + dòng phụ "Chữ trên trang chủ công khai. Số liệu (học sinh, đề thi, gia sư) lấy tự động từ hệ thống, không sửa ở đây." + **một** nút chính `Lưu` (góc phải; tắt khi không có thay đổi hoặc còn lỗi). Dòng trạng thái dưới tiêu đề: "Sửa lần cuối hôm qua 14:20 bởi Quản trị cấp 1 · Nguyễn A" hoặc "Chưa sửa lần nào — đang dùng nội dung mặc định".

Hai cột: **trái 560–640px = form**, **phải = xem trước** (dính khi cuộn, `position: sticky`). Form chia 5 khối, mỗi khối là một `KinPanel`, có neo trên đầu trang (dải liên kết nhỏ: Đầu trang · Ô kỳ thi · Lợi ích · Gia sư · Kêu gọi) — cuộn mượt, không tab ẩn nội dung:
1. **Đầu trang:** badge (1 dòng) · h1 (textarea 2 dòng, nhắc "Enter để xuống dòng, tối đa 2 dòng") · mô tả · nút 1 (chữ + đường dẫn) · nút 2 (chữ + đường dẫn).
2. **Ô kỳ thi (đúng 4, không thêm/bớt):** mỗi ô: chữ hiển thị · mô tả ngắn · **danh mục** (chọn trong danh sách từ `GET /api/categories`; hiện số khoá của danh mục).
3. **"Học ở đây thì được gì?"** tiêu đề + dòng phụ; thẻ 1–6 (`thêm thẻ` tắt khi đủ 6; `xoá`/`lên`/`xuống` từng thẻ — **hai nút mỗi hàng**: "Sửa" mở rộng thẻ tại chỗ, `⋯` chứa lên/xuống/xoá). Mỗi thẻ: icon (lưới chọn, mục dưới) · tiêu đề · mô tả.
4. **Khối gia sư/phụ huynh** (xem mục 9 câu 1): dòng nhỏ trên, tiêu đề, dòng phụ, nút 1, nút 2. Sáu "nỗi đau", ba bước, câu hỏi thường gặp **không sửa ở HOME-02** (còn nằm trong `landingCopy.ts`, đang bị `t-landing-copy-lib` khoá).
5. **Kêu gọi cuối trang:** tiêu đề · mô tả · nút 1 · nút 2.

**Chọn icon:** lưới radio 5×2 (44px mỗi ô, nhãn chữ dưới icon, `aria-label` Việt), khoá = tên ngắn không dấu. Danh sách: `ma-moi` (Key) · `lich` (Calendar) · `bai-thi` (ClipboardList) · `hoi-dap` (ChatCircleDots) · `tai-lieu` (BookOpen) · `tien-do` (ChartBar) · `hoan-thanh` (CheckCircle) · `bai-tap` (FileText) · `vinh-danh` (Trophy) · `an-toan` (Shield). (10 icon đều đã có trong `griddy-icons` và đang dùng ở nơi khác trong mã; stu-dev xác nhận lúc làm `homeIcons.ts`.) Icon không phải lời hứa, nhưng `tien-do` dễ đi kèm câu "theo dõi tiến độ" → chặn bằng cụm cấm chứ không bằng cách giấu icon.

**Cảnh báo độ dài:** dưới mỗi ô chữ có bộ đếm `42/70`. Từ 85% giới hạn → màu cam **và** chữ "Sắp hết chỗ"; vượt → màu đỏ **và** chữ "Dài hơn 12 ký tự", nút `Lưu` tắt, lỗi nối bằng `aria-describedby`. Màu không bao giờ là tín hiệu duy nhất.

**Khôi phục mặc định từng khối:** nút chữ `Khôi phục khối này` ở đầu mỗi `KinPanel`. Bấm → điền lại bản `defaults` (từ GET) **vào form**, chưa lưu; hiện toast có `Hoàn tác` 8 giây (đưa form về giá trị trước khi bấm). **Không hộp thoại xác nhận** (có hoàn tác thay thế). Nút tắt khi khối đã bằng mặc định. Một nút `Khôi phục toàn bộ trang` ở cuối cột trái, dùng cùng cơ chế hoàn tác.

### 5.3 Xem trước (cùng component với trang thật)
- **Cách chia sẻ:** `HomeSections` (mục 2) là **một** component dùng cho `page.tsx` thật và cho `xem-truoc/page.tsx`.
- **Vì sao iframe:** trang chủ dùng điểm gãy theo **khung nhìn** (`sm:`, `lg:`, `page.tsx:68-125`). Vẽ thẳng vào cột rộng 800px trong trang 1600px sẽ không bao giờ ra bố cục điện thoại. Iframe có chiều rộng riêng nên điểm gãy chạy đúng.
- `PreviewFrame` có công tắc hai nút (nhóm radio): **Máy tính** (iframe rộng 1280 logic, thu nhỏ bằng `transform: scale(cộtRộng/1280)`, chiều cao tính theo `scale`) và **Điện thoại** (iframe 390, không thu).
- `xem-truoc/page.tsx` là client: nghe `message` từ **cùng origin** (`event.origin === location.origin`, bỏ thư lạ), chạy `parseHomeContent` (nếu lỗi thì **giữ bản hợp lệ gần nhất** và gửi lỗi lên cha, không vẽ nửa vời), vẽ `<div data-vung="sang" className="kin-chu-than …"><HomeSections content stats={[]}/></div>`. Gửi `ready` cho cha khi gắn xong; cha gửi bản nháp mỗi khi form đổi (debounce 150 ms).
- `stats={[]}` → khối số liệu hero **ẩn** theo đúng luật có sẵn (`page.tsx:102`), kèm dòng chú thích dưới khung: "Số liệu thật hiện ở trang công khai, không hiện ở bản xem trước." Không bịa số mẫu.
- **Vỏ:** trang xem trước nằm dưới `(admin)/layout.tsx` nên bị bọc `AdminShell`. Cần **chế độ trần** (không thanh module, không tab): xin COO sửa `AdminShell.tsx` một nhánh sớm — nếu `pathname` kết thúc `/xem-truoc` thì trả `<>{children}</>` (mục 10). **Phương án dự phòng nếu COO không cho sửa vỏ:** bỏ iframe, vẽ `HomeSections` trực tiếp trong cột phải với chiều rộng cố định, chấp nhận chỉ xem được bố cục máy tính; bản điện thoại xem bằng cách mở trang thật. (adm-dev không tự chọn — hỏi trưởng phòng.)
- Điện thoại 390: tab hai nút `Sửa | Xem trước` (`KinTabs`) thay vì hai cột; tab Xem trước dùng iframe 100% chiều rộng.
- Liên kết "Mở trang chủ" luôn dẫn tới **tên miền chính** `https://${MAIN_HOST}/` (`src/lib/hostRouting.ts:23`), mở tab mới.

### 5.4 Lưu
- **fetch `PUT` rồi giữ nguyên trang** (không POST + 303): cần hiện lỗi theo từng trường, xử lý 409, và để bản xem trước còn nguyên sau khi lưu. Phím tắt Ctrl/Cmd+S.
- Thành công: toast "Đã lưu. Trang chủ cập nhật trong vài giây." + liên kết "Mở trang chủ"; `baseUpdatedAt` trong form lấy `updatedAt` mới; `dirty = false`. Nếu `revalidated=false` → toast cam "Đã lưu nhưng trang chủ có thể chậm tới 1 giờ mới đổi" (đây là hành vi `revalidate = 3600` khi cache chưa xoá).
- `beforeunload` cảnh báo khi còn thay đổi chưa lưu. Chuyển trang trong ứng dụng cũng hỏi bằng dải cảnh báo trong trang (không `confirm()`).
- 422: cuộn tới trường lỗi đầu tiên, tô viền + câu lỗi dưới ô, tóm tắt "Có 3 chỗ cần sửa" ở đầu form (liên kết nhảy tới từng chỗ).
- 409: dải cảnh báo cam đầu form: "Hoàng B vừa lưu lúc 14:32. Bạn đang sửa bản cũ hơn." Hai nút: `Tải bản mới (mất thay đổi của bạn)` · `Giữ bản của tôi và ghi đè` (gửi lại với `baseUpdatedAt` mới). Không hộp thoại.
- Cảnh báo mềm (không chặn): ô kỳ thi có `category` không còn trong `GET /api/categories` → "Danh mục này hiện không có khoá nào — ô sẽ mở ra danh sách trống"; nút có `href` nội bộ không nằm trong danh sách gợi ý → "Hãy mở thử đường dẫn này".

### 5.5 Trạng thái
| Trạng thái | Hiện |
|---|---|
| Đang tải | Khung `KinSkeleton`: 5 khối cột trái + khung xám cột phải; nút Lưu tắt. |
| Lỗi tải (mạng / 500) | `KinStateCard` "Không tải được nội dung trang chủ" + nút `Thử lại`; không hiện form rỗng (tránh lưu nhầm bản trắng). |
| 403 | `PermissionGuard` (`MANAGE_NEWS`) như các trang quản trị khác. |
| Rỗng (`isDefault`) | Form điền sẵn nội dung mặc định; dải `KinCallout`: "Chưa ai sửa — trang chủ đang dùng nội dung mặc định. Bấm Lưu để bắt đầu quản lý ở đây." Nút Lưu bật chỉ khi có đổi. |
| Đang lưu | Nút `Lưu` đổi thành "Đang lưu…", tắt; form vẫn sửa được nhưng nhãn "Đang lưu bản trước" (không mất ký tự gõ giữa chừng). |
| Lỗi lưu mạng | Toast đỏ "Chưa lưu được. Nội dung bạn gõ vẫn còn đây." + `Thử lại`. |

### 5.6 Khung Figma cần vẽ (COO vẽ, trong file Bigupdate `606:7`, cạnh khung thanh bên 608:728 và bảng + panel 608:1515)
Mỗi cái 1600 và 390:
1. Trang sửa — bình thường (form trái, xem trước phải; 390: tab Sửa).
2. Trang sửa — có lỗi 422 (cảnh báo độ dài cam + đỏ, tóm tắt lỗi).
3. Trang sửa — xung đột 409.
4. Trang sửa — đang tải / lỗi tải / mặc định (ba khung nhỏ).
5. Chọn icon (lưới 5×2, một ô được chọn, viền + dấu ✓).
6. Xem trước chế độ Điện thoại 390 trong khung 1600.

## 6. Máy trạng thái
Không có luồng duyệt. Trạng thái trang: `đang tải → sạch ⇄ đã sửa → đang lưu → (sạch | lỗi 422 | xung đột 409 | lỗi mạng)`. Đã ghi ở 5.4–5.5.

## 7. Nhật ký kiểm toán
- Một dòng cho mỗi lần `PUT` **có thay đổi thật**: `logAction(auth.userId, "site_content.update", "SiteContent", "home", { fields: changedFields, count: changedFields.length })` (`src/lib/auditLog.ts:7`).
- `metadata` **chỉ chứa tên trường** (`["hero.h1","why.items[2].title"]`) — **không** chứa chữ cũ/mới (chữ trang chủ không bí mật nhưng không cần nhân đôi vào nhật ký; trang Nhật ký `src/app/(admin)/admin/nhat-ky/page.tsx:1-3` cũng không hiện metadata).
- Không ghi khi `unchanged`, 4xx, 5xx.
- Nhật ký hiện ở `/admin/nhat-ky` với nhãn "Sửa nội dung trang chủ" (`adminOps.ts`).
- Chưa có "xem lại các bản cũ" — ngoài phạm vi (mục 9 câu 3).

## 8. Test phải có

**Điều kiện chạy:** sau khi HOME-01 gộp. Chạy tuần tự trên máy test (cổng 3100, DB `kin_test`).

**`t-home-content-guard-lib.ts`** (thuần, không máy chủ)
- đếm ký tự: 70 đạt, 71 trượt; tiếng Việt có dấu đếm đúng (ký tự Unicode, không đếm byte); xuống dòng thứ hai trong h1 đạt, dòng thứ ba trượt.
- `LINK_RULE`: đạt `/khoa-hoc`, `/dang-ky?vai=gia-su`, `https://zalo.me/g/abc`; **[phá cố ý]** trượt `javascript:alert(1)`, `data:text/html,x`, `//evil.com`, `http://x.vn`, `/a b`, chuỗi rỗng, `HTTPS://…` hoa thường lẫn giữ nguyên quy tắc.
- **[phá cố ý]** `checkClaims` bắt đủ: "Trợ giảng riêng 1-1", "Buổi học live mỗi tối", "Theo dõi tiến độ realtime", "trợ giảng phản hồi trong ngày", "Hỗ trợ 24/7", "1.200+ học sinh", "Hoàn tiền 100%" — và **không** bắt nhầm "Trợ giảng, nhiều giáo viên", "gpa, streak, rank".
- `diffHomeContent`: đổi 1 trường → đúng 1 đường dẫn; đổi thứ tự thẻ → liệt kê chỉ số thẻ; hai bản bằng nhau → `[]`.
- `parseHomeContent`: **[phá cố ý]** 3 ô kỳ thi · 5 ô · 0 thẻ · 7 thẻ · icon `"../../etc"` · khoá lạ `hero.script` · `null`/mảng/số thay vì object → đều trả lỗi đúng đường dẫn; ký tự điều khiển `\u0000` bị từ chối.

**`t-home-content-admin.ts`** (API, có phiên thật)
- Quyền: không phiên → 401; học sinh → 403; **gia sư (`teacher`) → 403 cả GET và PUT** (ca leo quyền); `admin_content` → 200; `admin_super` → 200.
- `GET` khi chưa có dòng → `isDefault:true`, `content` bằng `defaults`; khi dòng bị đổi tay thành JSON hỏng → vẫn 200 + `isDefault:true`.
- `PUT` hợp lệ → 200; đọc lại `GET` thấy đúng; **`GET /` (trang chủ thật, `cache: no-store`) chứa chữ mới trong ≤ 5 giây** (chứng minh `revalidateHome()` chạy).
- **[phá cố ý]** 422 theo từng trường cho: h1 71 ký tự, 7 thẻ, 3 ô kỳ thi, icon lạ, href `javascript:`, cụm "live mỗi tối" trong mô tả thẻ → `fields` chứa **đúng đường dẫn**; sau mỗi ca đọc lại CSDL: **không đổi**, **không có dòng nhật ký**.
- **[phá cố ý]** XSS: nhập `<script>alert(1)</script>` và `"><img src=x onerror=…>` vào h1 → lưu được như **chữ**; `GET /` trả HTML đã thoát (`&lt;script&gt;`), không có thẻ `<script>` từ nội dung.
- 409: hai `PUT` cùng `baseUpdatedAt`; cái thứ hai → 409, `current` là bản của cái đầu, CSDL giữ bản đầu, **chỉ một dòng nhật ký**.
- `unchanged`: `PUT` y hệt bản đang lưu → `unchanged:true`, **không** thêm dòng nhật ký (đếm `audit_logs` trước/sau).
- 413: thân 40 KB. 400: JSON cụt.
- Nhật ký: một `PUT` đổi 2 trường → đúng 1 dòng `site_content.update`, `resourceType:"SiteContent"`, `resourceId:"home"`, `metadata.fields` đúng 2 đường dẫn, `actorId` đúng người, và **chuỗi chữ mới không xuất hiện** trong `metadata` (chứng minh chỉ lưu tên trường).
- Nhật ký không ghi khi 403/422/409.

**`ui-admin-home-content.ts`** (trình duyệt, 1600 và 390)
- Quản trị cấp 1 thấy mục "Trang chủ" ở module Nội dung; **gia sư không thấy** và `/admin/trang-chu` mở bằng gia sư không hiện form (hoặc 403).
- 1600: hai cột; gõ vào h1 → trong ≤ 1 giây iframe xem trước hiện chữ mới; công tắc Điện thoại → iframe rộng 390 và hero xếp **một cột** (chứng minh điểm gãy chạy đúng).
- Vượt giới hạn: bộ đếm đỏ + chữ "Dài hơn", nút Lưu `disabled`.
- Khôi phục khối: sửa h1 → `Khôi phục khối này` → h1 về mặc định → `Hoàn tác` → h1 trở lại bản đã sửa.
- Lưu → toast + `baseUpdatedAt` mới; lưu lần hai không đổi gì thì nút Lưu tắt.
- Hai tab: tab A lưu, tab B lưu bản cũ → dải 409 hiện, `Giữ bản của tôi` ghi đè thành công.
- 390: không tràn ngang (`document.documentElement.scrollWidth <= 390`); tab `Sửa | Xem trước` hoạt động; nút Lưu luôn thấy (cố định đáy).
- Bàn phím: Tab đi hết biểu mẫu; lưới icon chọn bằng mũi tên; Ctrl/Cmd+S lưu.
- `t-no-hex` xanh (chỉ token `--kin-*`); `t-kin-components` xanh; `ui-admin-shell` và `ui-role-everything` xanh (sau khi sửa `AdminShell` ở mục 10).

## 9. Cờ và câu hỏi cho chủ

**Cờ:** TIỀN = không (không có số tiền nào ở màn này) · TRẺ EM = không (không dữ liệu học sinh; xem trước dùng `stats=[]`) · ĐỔI NỀN = không (không thư viện mới; iframe cùng origin; `revalidatePath` có sẵn của Next). Điểm chạm chính sách: **chữ trang công khai là lời hứa của KiN với phụ huynh** → có chặn cụm cấm ở máy chủ (mục 4).

**Câu hỏi cho Thanh (mỗi câu có mặc định):**
1. "Khối tìm gia sư/phụ huynh" bạn nhắc là khối nào? Trên trang chủ hiện chỉ có khối **"Dành cho gia sư dạy thêm"** (`page.tsx:139-190`); phụ huynh chưa có khối riêng. **Mặc định:** HOME-02 sửa tiêu đề + 2 nút của khối gia sư; sáu "nỗi đau", ba bước, câu hỏi thường gặp giữ trong mã. Nếu bạn muốn khối **phụ huynh** mới ("Xem Sổ của con bằng đường dẫn riêng"), đó là thêm vào HOME-01 (kiểu dữ liệu + hiển thị), không phải HOME-02.
2. Vai **`admin_content`** (có `MANAGE_NEWS`) được sửa trang chủ? **Mặc định: có** (như Tin tức, Điểm chuẩn). Nếu chỉ cấp 1 thì đổi sang `MANAGE_ADMINS` — một dòng, nhưng nghĩa là nhân sự nội dung không tự đổi chữ được.
3. Cần **lịch sử bản cũ + nút "quay về bản hôm qua"**? **Mặc định: chưa** (nhật ký chỉ ghi trường đổi). Làm thì cần bảng mới `site_content_history` — việc riêng.
4. Danh sách cụm cấm nên nằm **một chỗ** cho cả bài test và máy chủ. **Mặc định:** HOME-02 tạo `homeContentGuard.ts` và ghi nợ cho phòng Học sinh đổi `t-no-fabricated.ts` import danh sách đó; trước mắt có bài khoá để hai danh sách không lệch.
5. Ô kỳ thi: giữ đúng **4 ô**? **Mặc định: đúng 4** (lưới 2×2 ở hero). Cho phép 2–6 ô thì lưới đổi, và test hero 1600 phải vẽ lại.

## 10. Tệp chung cần xin COO

| Tệp | Đổi gì | Ai sửa | Phòng khác bị ảnh hưởng |
|---|---|---|---|
| `src/components/admin/AdminShell.tsx` (tệp chung, vỏ BU-00) | thêm 1 nhánh: `pathname` kết thúc `/xem-truoc` → `return <>{children}</>` (không thanh module/tab), **không đổi gì khác**; chạy lại `ui-admin-shell` + `ui-role-everything` | adm-dev, một lần, trước khi làm khung xem trước | không |
| `src/app/page.tsx` + `src/components/guest/HomeSections.tsx` + `src/components/guest/homeIcons.ts` | tách thân trang chủ thành component thuần nhận `content` (mục 2) | **stu-dev (HOME-01)** — HOME-02 chỉ yêu cầu | pb-hoc-sinh; HOME-02 chờ |
| `src/lib/siteContent.ts` (+ `siteContentSchema.ts`) | tách phần thuần để trình duyệt dùng được; nếu `saveHomeContent` chưa có thì thêm | **stu-code (HOME-01)**; nếu COO muốn adm-code làm thì xin riêng | pb-hoc-sinh |
| `prisma/schema.prisma` | **không đổi** ở HOME-02 | — | — |
| `tools/local-e2e/t-no-fabricated.ts` | (nợ, không bắt buộc) import danh sách cụm cấm từ `homeContentGuard.ts` | stu-test, sau | pb-hoc-sinh |
