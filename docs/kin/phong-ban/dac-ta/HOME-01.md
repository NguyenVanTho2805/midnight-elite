# HOME-01 — Trang chủ mở được khi đã đăng nhập, bỏ khối gia sư, nội dung lưu trong cơ sở dữ liệu

**Phòng / vai:** pb-hoc-sinh → stu-rnd viết; stu-code (máy chủ) ∥ stu-dev (giao diện) làm. **Cỡ:** M.
**Nhánh:** `claude/stu-home`. **Phụ thuộc:** HOME-02 (phòng Quản trị: API lưu + màn sửa) làm SAU, dựa vào hợp đồng mục 4.
**Cờ:** TIỀN = không · TRẺ EM = không · ĐỔI NỀN = không. Schema chỉ thêm đúng một bảng `site_content`.
Mọi dòng tệp:dòng dưới đây đã đọc lại trong worktree ngày 01/11/2026.

---

## 1. Vấn đề + bằng chứng

**(1) Người đã đăng nhập không xem được trang chủ.**
- `src/lib/hostRouting.ts:79-83`: trên tên miền chính, học sinh / gia sư mà mở `/` thì 307 sang `landingPath` (`/student/viec-cua-toi`, `/lop-cua-toi`). Ý định ghi ở `:7` (14/10/2026, "không thấy trang giới thiệu của khách"). Hệ quả: học sinh hay gia sư muốn đọc lại trang chủ, hay gửi đường dẫn gốc cho người khác, đều bị đá đi; không còn đường nào quay về.
- `hostRouting.ts:47`: `needsSession` bắt giải mã phiên ở `/` cho mọi lượt mở trang chủ, chỉ để phục vụ chuyển hướng trên.
- Không có lối quay về: `Navbar.tsx` chỉ hiện ở "/" và trang khách (trang khách của người đã đăng nhập nằm trong vỏ, `GuestChrome`), `StudentShell.tsx:105-106` chỉ có Hồ sơ / Học phí / Chủ đề màu, `TutorShell.tsx:123-124` chỉ có Cài đặt / Hồ sơ gia sư, `(parent)/layout.tsx:12` chỉ có chữ "Trang riêng cho phụ huynh" (logo không phải liên kết).
- Test đang khoá hành vi cũ: `t-host-routing-lib.ts` (mục "người đã đăng nhập không thấy trang giới thiệu của khách": học viên / gia sư mở `/` → 307) và `ui-tutor-admin.ts:58-60`, `:126-129`.

**(2) Khối gia sư chiếm trang chủ của học sinh và phụ huynh.** `src/app/page.tsx:139-190` (nỗi đau, Cách hoạt động, 10 câu hỏi, hai nút) cao hơn cả hai khối còn lại cộng lại, nói với gia sư, trong khi người mở trang chủ chủ yếu là học sinh và phụ huynh. Chữ nằm ở `src/lib/landingCopy.ts`, chỉ trang chủ dùng. Tham chiếu còn lại (grep toàn kho trừ `node_modules`): `page.tsx:19,139`, `tools/local-e2e/t-landing-copy-lib.ts`, `ui-landing-tutor.ts`, và chữ trong `docs/kin/tien-do-dang-do.md`, `docs/kin/thiet-ke/goi-gui-claude-design/MUC-LUC.md`, `docs/kin/backlog/nang-cap-lan-2.csv`, `STU-002.md` (chỉ nhắc, không cần sửa). `ui-kin-site.ts` KHÔNG import `landingCopy` (dòng 78 chỉ là comment nhắc "mục dành cho gia sư") nhưng dòng 78-79 sẽ sai sau khi bỏ khối → sửa comment.

**(3) Sửa trang chủ phải nhờ lập trình viên.** Toàn bộ chữ nằm cứng trong `page.tsx:21-26` (4 ô kỳ thi), `:50-55` (4 thẻ), `:72-79` (badge, h1, hero), `:120-123`, `:195-203` (CTA cuối). Quản trị nội dung (`admin_content`) muốn đổi một câu phải đổi mã và triển khai lại.

## 2. Phạm vi tệp

Theo `PHAM-VI.md`: trang chủ thuộc stu-dev; `prisma/schema.prisma`, `hostRouting.ts`, `StudentShell.tsx`, `TutorShell.tsx` là **tệp chung** (mục 10). Hai bên không trùng tệp.

### stu-code (máy chủ, test thuần)
| Tệp | Việc |
|---|---|
| `prisma/schema.prisma` | THÊM model `SiteContent` (mục 3), cuối tệp. Không đổi dòng nào khác. |
| `src/lib/siteContent.ts` (MỚI) | Thuần (không import prisma / next / react). Kiểu, danh sách khoá icon, mặc định, `parseHomeContent`, `validateHomeContent` (mục 4.1). |
| `src/lib/siteContentServer.ts` (MỚI) | Có `import "server-only"` và prisma: `loadHomeContent`, `revalidateHome` (mục 4.2). |
| `src/lib/hostRouting.ts` | Bỏ chuyển hướng `/` cho người đã đăng nhập; bỏ `/` khỏi `needsSession` tên miền chính; sửa comment đầu tệp dòng 7 (ghi 01/11/2026). |
| `tools/local-e2e/t-site-content-lib.ts` (MỚI) | Test thuần mục 8. |
| `tools/local-e2e/t-host-routing-lib.ts` | Đổi kỳ vọng cũ có chủ đích + ca mới (mục 8). |

### stu-dev (giao diện)
| Tệp | Việc |
|---|---|
| `src/app/page.tsx` | Đọc `loadHomeContent()`; bỏ khối gia sư và import `landingCopy`; thêm khối "Tìm gia sư" sau "Học ở đây thì được gì?"; icon ánh xạ từ `HOME_ICON_KEYS`; giữ `export const revalidate = 3600`, `loadStats` và 3 điều kiện của `t-no-fabricated` (mục 8). |
| `src/components/Navbar.tsx` | Nút "Vào trang của tôi" (mục 5). |
| `src/components/student/StudentShell.tsx`, `src/components/tutor/TutorShell.tsx` | Thêm đúng MỘT phần tử vào mảng `links` của `AccountMenu`. Không đổi gì khác. |
| `src/app/(parent)/layout.tsx` | Liên kết chữ nhỏ "Trang chủ KiN". |
| `src/components/Footer.tsx` | **KHÔNG sửa.** Footer đã có "Dành cho gia sư" → `/dang-ky?vai=gia-su` (`Footer.tsx:17`); lối vào đăng ký gia sư được giữ bằng liên kết cố định trong khối mới và chính liên kết này (mục 5). |
| Xoá | `src/lib/landingCopy.ts` (đặt cho **stu-dev** xoá cùng lúc bỏ import, để nhánh nào cũng biên dịch được), `tools/local-e2e/t-landing-copy-lib.ts`, `tools/local-e2e/ui-landing-tutor.ts`. |
| `tools/local-e2e/ui-kin-site.ts` | Sửa comment dòng 78-79; thêm ca khối "Tìm gia sư" (mục 8). |
| `tools/local-e2e/ui-home-signed-in.ts` (MỚI) | Bài trình duyệt mục 8. |
| `tools/local-e2e/ui-account-menu.ts`, `ui-tutor-admin.ts` | Sửa kỳ vọng cũ (mục 8). |

> Điểm cần trưởng phòng duyệt: xoá `landingCopy.ts` ghi cho stu-dev để không có thời điểm nào `page.tsx` import tệp đã mất. Thứ tự gộp: stu-code trước (siteContent*.ts, schema) vì `page.tsx` import chúng; hoặc COO gộp hai nhánh con trong một PR.

## 3. Schema (chỉ thêm)

```prisma
/// Nội dung trang công khai sửa được từ màn quản trị. Mỗi trang một hàng, khoá cố định (hiện chỉ "home").
/// Không khoá ngoại tới User: xoá người dùng không được kéo theo mất nội dung (updatedBy chỉ là dấu vết).
model SiteContent {
  key       String   @id
  data      Json
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@map("site_content")
}
```

- Thêm bảng mới không sinh cảnh báo mất dữ liệu nên `scripts/db-push-guard.mjs` không chặn; build production tự chạy `db-push-on-production.mjs`. Không có `@unique` mới.
- Không có hàng `home` = dùng mặc định (không cần seed, không cần migration dữ liệu).
- Trước khi bảng tồn tại (máy phát triển chưa `db push`, hoặc build chạy trước khi đẩy schema), `loadHomeContent` bắt lỗi Prisma và trả mặc định → trang chủ không hỏng.

## 4. Hợp đồng

### 4.1 `src/lib/siteContent.ts` (thuần)

Xuất đúng các tên sau (stu-dev và HOME-02 dựa vào):

```ts
export const HOME_CONTENT_KEY = "home";
export const HOME_ICON_KEYS = [
  "key", "calendar", "clipboard", "chat", "book", "users", "graduation", "trophy", "shield", "star",
] as const;
export type HomeIconKey = (typeof HOME_ICON_KEYS)[number];
export interface HomeLink { label: string; href: string }
export interface HomeExam { label: string; desc: string; href: string }
export interface HomeCard { icon: HomeIconKey; title: string; desc: string }
export interface HomeContent {
  badge: string;
  title: string;                 // h1; "\n" = xuống dòng
  lead: string;                  // đoạn hero
  exams: HomeExam[];             // ô "Đang mở luyện thi"
  why: { title: string; subtitle: string; cards: HomeCard[] };
  findTutor: { title: string; desc: string; buttonLabel: string; buttonHref: string; parentNote: string };
  cta: { title: string; desc: string; primary: HomeLink; secondary: HomeLink };
}
export const DEFAULT_HOME_CONTENT: HomeContent;           // = chữ hiện tại của page.tsx (Phụ lục A)
export function parseHomeContent(raw: unknown): HomeContent;     // KHÔNG BAO GIỜ ném lỗi
export type HomeIssue = { path: string; message: string };       // path dạng "why.cards[2].icon"
export function validateHomeContent(raw: unknown): { ok: true; value: HomeContent } | { ok: false; issues: HomeIssue[] };
export const isExternalHref: (href: string) => boolean;          // bắt đầu "https://"
```

**Khoá icon (đã kiểm `typeof === "object"` trong gói `griddy-icons` của worktree):** `key→Key`, `calendar→Calendar`, `clipboard→ClipboardList`, `chat→ChatCircleDots`, `book→BookOpen`, `users→Users`, `graduation→GraduationCap`, `trophy→Trophy`, `shield→Shield`, `star→Star` — 10 khoá, gồm 4 icon đang dùng. Bảng ánh xạ khoá → component nằm trong `page.tsx` (stu-dev), KHÔNG ở `siteContent.ts` (thuần, không import `griddy-icons`). Các tên đã bị loại vì không có trong gói: `Bell`, `Clock`, `Target`, `Notebook`, `Medal`.

**Một lõi, hai cổng.** Một hàm nội bộ đọc `raw` và trả `{ value, issues }`. `parseHomeContent` = `value` (bỏ `issues`); `validateHomeContent` = `ok` khi `issues` rỗng. Hai hàm không thể lệch nhau vì dùng chung lõi. HOME-02 dùng `validateHomeContent` để TỪ CHỐI và nêu trường sai; trang chủ dùng `parseHomeContent` để không bao giờ vỡ.

**Quy tắc từng trường (hằng số đặt tên, đổi một chỗ):**

| Trường | Quy tắc |
|---|---|
| mọi chuỗi | phải là `string`; `trim()`; xoá `\r`; ký tự điều khiển (U+0000–U+001F ngoại trừ `\n` ở `title`, U+007F) → sai; rỗng sau trim → sai. Độ dài đếm theo ký tự sau trim. |
| `badge` | ≤ 100 |
| `title` | ≤ 120 tổng; 1–3 dòng cách nhau `\n`; mỗi dòng ≤ 60, không dòng rỗng. Biểu diễn xuống dòng bằng `"\n"` (không dùng `<br>`, không dùng mảng): `page.tsx` tách theo `\n` và chèn `<br />`. Mặc định `"Học cùng gia sư thật,\ntheo lớp và theo lịch"`. |
| `lead` | ≤ 300 |
| `exams` | mảng 1–6 phần tử (cắt từ phần tử thứ 7); `label` ≤ 40, `desc` ≤ 60, `href` hợp lệ. Phần tử có trường sai bị bỏ cả phần tử. Còn 0 phần tử hợp lệ → dùng mặc định cả mảng. |
| `why.title` / `why.subtitle` | ≤ 80 / ≤ 140 |
| `why.cards` | mảng 1–6 (cắt từ thứ 7); `icon` ∈ `HOME_ICON_KEYS`, `title` ≤ 40, `desc` ≤ 200. Phần tử sai bị bỏ; còn 0 → mặc định cả mảng. Tối đa 6 vì lưới 4 cột `lg` đã đo ở `ui-kin-site.ts:84`. |
| `findTutor` | `title` ≤ 80, `desc` ≤ 200, `buttonLabel` ≤ 30, `parentNote` ≤ 200, `buttonHref` hợp lệ |
| `cta` | `title` ≤ 80, `desc` ≤ 200; `primary`/`secondary`: `label` ≤ 40, `href` hợp lệ |
| **href hợp lệ** | ≤ 300 ký tự, không khoảng trắng / ký tự điều khiển / `\`. Hoặc (a) bắt đầu bằng đúng một `/` (không `//`, không `/\`), hoặc (b) bắt đầu `https://` và `new URL()` đọc được, `protocol === "https:"`, không có `username`/`password`. Mọi thứ khác (`javascript:`, `data:`, `http://`, `//evil.com`, `mailto:`, `tel:`, đường tương đối, rỗng) → sai. |

- **Trường sai → mặc định của riêng trường đó** (không kéo trường khác). Với mảng: sai ở cấp phần tử thì bỏ phần tử (xem trên), không thay bằng phần tử mặc định cùng vị trí.
- **Đầu vào không phải object** (`null`, số, chuỗi, mảng, JSON rác) → toàn bộ mặc định; `validate` báo một lỗi `path: ""`. Khoá lạ trong object bị bỏ lặng lẽ (không phải lỗi); không dùng `Object.assign` / spread từ đầu vào để tránh `__proto__`.
- **Không trả đối tượng dùng chung:** mỗi lần gọi trả bản sao sâu (`structuredClone` hoặc dựng mới), kể cả khi trả mặc định. `DEFAULT_HOME_CONTENT` được `Object.freeze` sâu để test bắt được ai sửa nó.
- Chuỗi chứa `<script>…` hay `&amp;` được GIỮ NGUYÊN là chữ (không cố lọc HTML); an toàn nhờ React tự escape và `page.tsx` không bao giờ dùng `dangerouslySetInnerHTML` cho các trường này (test tĩnh, mục 8).
- **Không có trong `HomeContent`, cố ý:** nút hero "Xem lớp học" / "Thi thử miễn phí" (`ui-kin-site.ts:41-42` đo href và chiều cao), nhãn "ĐANG MỞ LUYỆN THI", khối số đếm thật (`loadStats`), liên kết "Bạn là gia sư? Đăng ký gia sư" (cố định để không ai sửa mất lối vào đăng ký gia sư). Muốn sửa các thứ này là việc riêng.

### 4.2 `src/lib/siteContentServer.ts` (server-only)

```ts
export async function loadHomeContent(): Promise<HomeContent>;  // đọc hàng key="home", parseHomeContent(row.data); không có hàng / lỗi DB → parseHomeContent(null)
export function revalidateHome(): void;                          // revalidatePath("/")
```
- `loadHomeContent` bắt mọi lỗi (kể cả bảng chưa tồn tại) và trả mặc định; ghi `console.error` một dòng ngắn, không ném. Không dùng `unstable_cache` (không cần: trang đã tĩnh theo `revalidate = 3600`, thêm một tầng đệm chỉ khiến "lưu xong vẫn thấy bản cũ" khó lý giải).
- **Chọn `revalidatePath("/")`, không dùng tag.** Đối chiếu `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/` (Next 16.2.6): `revalidateTag` nay bắt chữ ký hai đối số `revalidateTag(tag, profile)` (một đối số đã deprecated) và chỉ có tác dụng với dữ liệu gắn tag (`unstable_cache` / `fetch` tag); trang này đọc bằng Prisma, không gắn tag. `revalidatePath(path)` gọi được trong Route Handler ("đánh dấu, tái tạo ở lần mở kế tiếp") và dùng đường dẫn **đích** — `/` đúng là tệp `src/app/page.tsx`. Tên miền admin không liên quan: `/` ở đó là `rewrite` của `proxy.ts` sang `/admin`, không có bản đệm riêng.
- Hệ quả cần biết (ghi cho HOME-02): lần mở trang đầu tiên sau khi lưu vẫn có thể thấy bản cũ nếu máy chủ trả bản đệm trước khi đánh dấu xong; phép đo cần làm là "lưu, tải lại hai lần". Không hứa "tức thì".
- Đo sau khi gộp: `next build` phải không đòi DB lúc build — `loadHomeContent` trong lúc prerender nếu DB không tới được thì trả mặc định (như `loadStats` đã làm với `catch { return [] }`), và `revalidate = 3600` sửa lại trong tối đa một giờ.

### 4.3 Hợp đồng đề xuất cho HOME-02 (phòng Quản trị, KHÔNG làm trong HOME-01)

| | |
|---|---|
| `GET /api/admin/site-content/home` | 401 không phiên; 403 nếu không phải `admin_super` / `admin_content` (gia sư `teacher` → 403). Trả `{ content: HomeContent, isDefault: boolean, updatedAt: string \| null, updatedBy: { id, name } \| null }`. `content` luôn qua `parseHomeContent`; `isDefault` = không có hàng. |
| `PUT /api/admin/site-content/home` | Cùng quyền. Nhận `{ content: unknown }` (JSON ≤ 20 KB, quá → 413). Chạy `validateHomeContent`; **sai → 400** `{ error: "…", issues: [{path, message}] }`, không lưu, **không tự sửa lặng lẽ** (kể cả cắt mảng thừa hay chuỗi quá dài: báo lỗi). Đúng → `upsert` hàng `key = HOME_CONTENT_KEY` với `data = value` đã chuẩn hoá, `updatedBy = actor.id`; ghi `AuditLog` (`action: "site_content.update"`, `resourceType: "site_content"`, `resourceId: "home"`, `metadata` chỉ gồm danh sách tên trường đã đổi, không chép nguyên văn); gọi `revalidateHome()`; trả `{ ok: true, updatedAt }`. |
| `DELETE /api/admin/site-content/home` | "Khôi phục mặc định": xoá hàng (không lỗi nếu chưa có), `AuditLog` (`site_content.reset`), `revalidateHome()`. |
| Quyền | Dùng `PERMISSIONS.MANAGE_NEWS` (cả `admin_super` lẫn `admin_content` đều có, `teacher` không) — không cần quyền mới ở `permissions.ts`. |
| Màn sửa | `src/app/(admin)/admin/…` (tên đường dẫn do adm-dev chọn): form theo từng khối đúng như `HomeContent`, bộ đếm ký tự theo hằng số trong `siteContent.ts` (xuất thêm `HOME_LIMITS` nếu adm-code muốn — HOME-01 không bắt), xem trước, nút "Khôi phục mặc định" có hộp xác nhận, hiện lỗi `issues` ngay cạnh trường. |
| Sở hữu tệp | HOME-01 (pb-hoc-sinh) sở hữu `siteContent.ts`, `siteContentServer.ts`, `page.tsx`, schema `SiteContent`. HOME-02 (pb-admin) sở hữu route `api/admin/site-content/**` và màn sửa; **chỉ import** hai tệp lib, không sửa. Cần thêm trường vào `HomeContent` → yêu cầu pb-hoc-sinh. |

## 5. Luồng màn (1600px và 390px, ba trạng thái)

### 5.1 Chuyển hướng (`hostRouting.ts`)
- Tên miền chính, `pathname === "/"`: **luôn `{ kind: "next" }`** cho mọi vai và cho khách.
- GIỮ NGUYÊN: `/dang-nhap` (có `?redirect=` an toàn → đích đó, không thì `landingPath`), `/dang-ky` → `landingPath`, `/admin*` (gia sư ở lại, người khác sang tên miền admin).
- `needsSession`, tên miền chính: bỏ `pathname === "/"` → còn `isAdminPath || AUTH_PAGES.includes`. Trang chủ không còn tốn giải mã phiên.
- Tên miền admin: không đổi. `/` vẫn `rewrite` sang `/admin`; học sinh có phiên ở tên miền admin mở `/` vẫn 307 về tên miền chính (`landingPath("student")`) như cũ (`hostRouting.ts:53`).
- Giữ AUTH_PAGES chuyển hướng là cố ý: người đã đăng nhập mà bấm "Tạo tài khoản miễn phí" ở trang chủ sẽ vào dashboard chứ không thấy form đăng ký (xem câu hỏi 3 mục 9).

### 5.2 Navbar (`Navbar.tsx`, đã dùng `useAuth`)
- `user` có (đã đăng nhập): hiện liên kết/nút **"Vào trang của tôi"** → `landingPath(user.role, user.adminRole)`.
  - **Máy tính (≥ md):** trong khối `hidden md:flex` (`Navbar.tsx:87`), đặt **giữa** `NotificationBell` và khối menu thả xuống (hoặc ngay trước `CoinBalance`; stu-dev chọn vị trí không làm chật 768px), kiểu `solidBtn`, cao 44px. **Nằm NGOÀI `<div role="menu">`**: `ui-kin-site.ts:124-125` kiểm các `menuitem` của menu tài khoản; không thêm `role="menuitem"` cho nút này.
  - **Điện thoại:** đầu khối tài khoản trong menu bung (`Navbar.tsx:178-180`), trước `accountLinks`, cao ≥ 44px, `onClick` đóng menu.
  - `isLoading`: giữ khung xương hiện có (không thêm nút). Chưa đăng nhập: không đổi (Đăng nhập / Đăng ký).
- **Dùng thẻ `<a>` thường (không `next/link`) khi đích nằm ở tên miền khác:** vai `admin` mà `adminRole !== "teacher"` (landingPath = `/admin`, proxy 307 sang `admin.midnightelite-edu.com`). Lý do: `next/link` tải trước RSC và `router.push` sang tên miền khác bị CORS chặn (chính `hostRouting.ts:36-37` đã ghi lỗi này), còn `<a>` tải cứng thì qua.
- **Trường hợp quản trị cấp 1 / nội dung trên tên miền chính (quyết định, chọn cách nhỏ nhất):** vẫn hiện cùng nút, cùng chữ, trỏ `/admin` bằng `<a>`. Cookie phiên không dùng chung hai tên miền, nên họ sang tên miền admin và có thể gặp trang đăng nhập admin — đúng như mọi liên kết tới `/admin` hôm nay (và đúng với `ui-kin-site.ts:114-125` đã dựng ca này). Không ẩn nút (sẽ làm họ không có lối nào), không dựng cầu nối phiên giữa hai tên miền (vượt cỡ M, đụng bảo mật phiên). Ghi cho chủ ở câu hỏi 2.
- Một nút duy nhất cho mọi vai; nhãn không đổi theo vai (không làm phụ thuộc chữ vào `role`).

### 5.3 Vỏ học sinh / gia sư
- `StudentShell.tsx:106`: thêm cuối mảng `links`: `{ label: "Trang chủ KiN", href: "/" }` (đứng sau "Chủ đề màu", trước "Đăng xuất" nên thứ tự menu: Hồ sơ | Học phí | Chủ đề màu | Trang chủ KiN | Đăng xuất). `TutorShell.tsx:124`: tương tự (Cài đặt | Hồ sơ gia sư | Trang chủ KiN | Đăng xuất).
- Mở bằng `next/link` trong `AccountMenu` (cùng tên miền chính, `"/"` đã `next` sau khi sửa 5.1). Không đổi `AccountMenu.tsx`, bố cục, `MORE_GROUPS`. Mục "Tất cả mục" (chỉ điện thoại) vẫn đứng cuối trước Đăng xuất như hiện tại.

### 5.4 Phụ huynh (`(parent)/layout.tsx`)
- Thanh trên: bên cạnh `<span>` "Trang riêng cho phụ huynh" thêm `<Link href="/">Trang chủ KiN</Link>` chữ nhỏ `text-caption`, màu token `--kin-nhan-link`, vùng chạm ≥ 44px (padding, không phóng chữ). Giữ nguyên `<span>` (test `ui-parent-shell.ts:42,72` tìm chữ này) và chân trang.
- Hai chữ cùng một dòng ở 390px: nếu hẹp thì liên kết xuống dòng dưới cùng thanh (`flex-wrap`), không tràn ngang.
- An ninh: liên kết trỏ `/` (trang công khai), không mang token. Dùng `referrerPolicy="no-referrer"` trên `<a>` hoặc `<Link>` để địa chỉ có `portalToken` không đi vào tiêu đề `Referer` — rẻ và không đổi hành vi. Phụ huynh không tài khoản không thấy thêm gì ngoài trang chủ vốn công khai.

### 5.5 Trang chủ (`page.tsx`)
Thứ tự: Navbar → Hero → "Học ở đây thì được gì?" → **khối "Tìm gia sư" (mới)** → CTA cuối → Footer. Bỏ cả `<section aria-labelledby="h-gia-su">` (`page.tsx:139-190`) và import `landingCopy` (`:19`).

- Khách / học sinh / gia sư / quản trị / phụ huynh có phiên đều thấy CÙNG trang chủ (trang tĩnh, không đọc cookie); chỉ khác Navbar (khách: Đăng nhập / Đăng ký; đã đăng nhập: Vào trang của tôi + menu).
- **Khối "Tìm gia sư":** `<section>` + `<h2>` + `<p>` + `<a>/<Link>` (không `<article>`, không `<h3>`; `ui-kin-site.ts:83` lấy `article` đầu tiên toàn trang, `:81` lấy h3 trong mục "Học ở đây"). Nút lớn `buttonLabel` ("Tìm gia sư") → `buttonHref` (`/giang-vien`). Dòng `parentNote` dưới nút. Hàng chữ nhỏ cố định: "Bạn là gia sư? **Đăng ký gia sư**" → `/dang-ky?vai=gia-su`. Nút / liên kết cao ≥ 44px (ca ≤ 44px của `ui-landing-tutor` không còn tồn tại nên phải tự kiểm trong `ui-kin-site`). Nền `--kin-nen-trang` (xen kẽ với khối bảng trước nó), 1600px: cột chữ canh giữa, rộng tối đa 760px; 390px: một cột, nút rộng 100%.
- Ba trạng thái của vùng đọc DB: **có hàng** → nội dung đã lưu; **không có hàng / bảng chưa có / lỗi DB / dữ liệu hỏng** → mặc định của trường đó; **khối số đếm** → như cũ (ẩn nếu rỗng). Không có spinner, không trạng thái lỗi hiện ra người dùng.
- Mảng thẻ có 5-6 phần tử: lưới `lg:grid-cols-4` sẽ mồ côi hàng cuối; stu-dev dùng 3 cột khi `cards.length > 4` (4 cột khi ≤ 4; mặc định 4 giữ `ui-kin-site.ts:84`: thẻ đầu cách mép trái 260px).
- `href` ngoài (`isExternalHref`) → `<a target="_blank" rel="noopener noreferrer">`; nội bộ → `<Link>`.

## 6. Quy tắc nội dung

- Chỉ chữ có thật; không số liệu bịa; không cam kết kết quả / SLA / live / trợ giảng (`t-no-fabricated`). Mặc định (Phụ lục A) lấy nguyên từ `page.tsx` hiện tại (đã qua STU-002) cộng khối mới với hai câu có sẵn trong mã: "Phụ huynh xem Sổ của con bằng đường dẫn riêng" (STU-002 / hero) và "Hồ sơ gia sư được quản trị KiN xem trước khi hiện ở trang Tìm gia sư" (từ `landingCopy.ts` `TUTOR_STEPS[0]`, đã chạy qua `t-landing-copy-lib`).
- Nội dung do quản trị nhập không đi qua `t-no-fabricated` lúc chạy: trách nhiệm chữ thuộc người sửa; `validateHomeContent` chỉ chặn hình thức (độ dài, liên kết, icon). Không thêm bộ lọc từ khoá lúc chạy (dễ chặn nhầm, khó giải thích).
- Không có đầu vào của người dùng cuối nên không có kiểm duyệt / báo cáo ở đây. Không có thông báo, không tên, không tiền (mục 7).

## 7. Thông báo

Không. HOME-01 không gửi thông báo nào (không đụng `notify.ts`).

## 8. Test phải có

**Bộ chạy tuần tự (stu-test; Postgres + dev ở 3100, theo `tools/local-e2e/README.md`):**
`t-site-content-lib`, `t-host-routing-lib`, `t-no-fabricated`, `t-no-hex`, `t-db-push-guard`, `ui-home-signed-in` (mới), `ui-kin-site`, `ui-account-menu`, `ui-tutor-admin`, `ui-role-everything` (student, tutor, guest), `ui-student-shell`, `ui-tutor-shell`, `ui-parent-shell`, và `npx tsc --noEmit` + `npm run lint` (bắt import `landingCopy` còn sót, biến icon không dùng). Sau khi đổi schema: `prisma generate`, khởi động lại Next dev (README "Lưu ý đã gặp").

### 8.1 `t-site-content-lib.ts` (thuần, stu-code)
1. **Mặc định hợp lệ qua chính parse:** `validateHomeContent(DEFAULT_HOME_CONTENT)` → `ok`; `parseHomeContent(DEFAULT_HOME_CONTENT)` bằng sâu mặc định; mặc định có đúng 4 `exams`, 4 `why.cards` (icon `key, calendar, clipboard, chat`), h1 chứa đúng một `\n`.
2. **Không tồn tại đối tượng chung:** `parseHomeContent(null)` hai lần cho hai đối tượng khác nhau; sửa `a.cards.push(...)`, `a.title = "x"` không làm đổi `b` hay `DEFAULT_HOME_CONTENT`; `DEFAULT_HOME_CONTENT` bị đóng băng sâu (ghi vào ném lỗi ở chế độ strict hoặc không đổi).
3. **Ca phá liên kết:** `href` = `javascript:alert(1)`, `JaVaScRiPt:x`, `data:text/html,x`, `//evil.example`, `/\evil.example`, `http://a.b`, `mailto:x@y`, ` /khoa-hoc` (khoảng trắng đầu — sau trim hợp lệ, ghi rõ kỳ vọng), `/a b`, `https://u:p@evil.example/`, `https://`, chuỗi 5000 ký tự, rỗng → mỗi ca: `validate` báo đúng `path`, `parse` trả href mặc định của trường đó; ngược lại `/khoa-hoc?category=%C4%90GNL`, `/giang-vien`, `https://zalo.me/x` → hợp lệ.
4. **Ca phá icon:** `"rocket"`, `""`, `123`, `"Key"` (hoa), `"__proto__"` → phần tử thẻ đó bị bỏ, thẻ khác giữ nguyên.
5. **Ca phá độ dài / số lượng:** chuỗi 5000 ký tự ở `badge`/`lead`/`cards[0].desc` → `parse` trả mặc định của trường đó, `validate` báo lỗi (không cắt lặng lẽ); `exams` 20 phần tử → `parse` giữ 6 đầu; `validate` báo lỗi "quá 6"; `title` 4 dòng / dòng 61 ký tự / dòng rỗng giữa → sai.
6. **Đầu vào rác:** `null`, `undefined`, `42`, `"x"`, `true`, `[]`, `[{…}]`, `{}`, `JSON.parse('{"__proto__":{"x":1}}')`, đối tượng có `toJSON` ném lỗi, vòng tham chiếu → không ném; `parse` bằng mặc định; `({} as any).x` vẫn `undefined` sau khi parse (không ô nhiễm prototype).
7. **Trường sai không kéo trường khác:** ghép đối tượng hợp lệ nhưng `cta.primary.href = "javascript:x"` và `why.cards[1].icon = "zzz"` → kết quả: `cta.primary.href` = mặc định, `cta.secondary`, `badge`, `title`, `exams`, `why.cards[0,2,3]` giữ giá trị đã nhập; `issues.length === 2`.
8. **Mã HTML chỉ là chữ:** `badge = "<script>alert(1)</script> &amp; <b>x</b>"` → trả đúng nguyên chuỗi (ghi chú trong test: React escape; không lọc). `title` có `\r\n` → `\r` bị bỏ.
9. **Chuẩn hoá:** trim hai đầu; khoảng trắng giữa chuỗi giữ nguyên; `title` `"a\nb"` giữ `\n`; `lead` có `\n` → sai (chỉ `title` cho xuống dòng).
10. **Quét chữ cấm trên `DEFAULT_HOME_CONTENT`** (cùng danh sách `BANNED` của `t-no-fabricated.ts` gồm sáu dòng STU-002 và các dòng cũ, cộng: `/miễn phí.*(trọn đời|mãi mãi)|đảm bảo|cam kết|hàng đầu|số 1|tốt nhất/i`, `/\d{2,}\s?(học sinh|gia sư|phụ huynh)|\d+\s?%/` — không số liệu bịa) trên mọi chuỗi mặc định (đệ quy). Kèm **ca phá cố ý**: bộ quét bắt được `"Học live mỗi tối"`, `"Trợ giảng riêng 1-1"`, `"1.200+ học sinh"`, `"cam kết 100%"`.
11. **Quét tĩnh `page.tsx`:** không chứa `dangerouslySetInnerHTML`, không còn `landingCopy`, không còn `h-gia-su`; có `export const revalidate = 3600`; import `loadHomeContent`.

### 8.2 `t-host-routing-lib.ts` (stu-code)
Đổi kỳ vọng cũ **có chủ đích** (ghi lý do trong comment, ngày 01/11/2026), mục "người đã đăng nhập không thấy trang giới thiệu của khách":
- "học viên mở '/' → vào 'Việc của tôi'" ⇒ **"học viên mở '/' → next"**; tương tự gia sư → `next`.
- Ca mới: `d(MAIN, "/", student|tutor|sup|content|null)` đều `{kind:"next"}` — cả `search` có tham số (`?utm=x`, `?redirect=/student/lich-hoc`).
- Giữ: `/dang-ky` và `/dang-nhap` của học viên / gia sư vẫn 307 (dashboard hoặc `?redirect=` an toàn), ba ca `redirect=` độc hại, khách xem `/dang-nhap` `/dang-ky`.
- `needsSession(MAIN, "/")` là **false**; danh sách "chỉ ... cần phiên" bỏ `/`; tên miền admin: `needsSession(ADM, "/")` vẫn true; `d(ADM, "/", sup)` vẫn `rewrite /admin`; `d(ADM, "/", student)` vẫn 307 về tên miền chính; `d(ADM, "/", tutor)` vẫn `redirect`.
- Hồi quy: mọi ca `/admin*` và tệp PWA giữ nguyên; ca mới "mọi vai × `/` ở tên miền chính × `needsSession false`" → vẫn `next` khi `session = null`.

### 8.3 `ui-home-signed-in.ts` (mới, stu-dev; dựng bằng `ctxFor` + `mkUser` / `mkTutor` / `mkSuper`)
- **Ba vai mở được `/` (1600px):** học sinh, gia sư, quản trị cấp 1 → URL sau khi tải là `/` (không đổi), thấy h1 (`getByRole("heading",{level:1})`), thanh `Điều hướng chính` của Navbar, và KHÔNG thấy thanh bên module (`Module của học sinh`).
- **Nút "Vào trang của tôi":** có ở cả ba vai trên `header`, nằm NGOÀI `role=menu` (`header [role=menu]` đóng: nút vẫn hiển thị); `href` lần lượt `/student/viec-cua-toi`, `/lop-cua-toi`, `/admin`; cao ≥ 44px; bấm (học sinh, gia sư) tới đúng trang. Quản trị: kiểm `href` và rằng đó là thẻ `<a>` không phải nút JS (không bấm, vì sang tên miền admin chưa có phiên). Mở menu tài khoản: số `menuitem` không tăng so với trước (4 mục + Đăng xuất).
- **Điện thoại 390px:** mở menu bung → "Vào trang của tôi" là mục đầu khối tài khoản, cao ≥ 44px, không tràn ngang.
- **Lối "Trang chủ KiN":** học sinh ở `/student/viec-cua-toi` mở menu tài khoản → mục `Trang chủ KiN` → URL `/`; cùng cho gia sư ở `/lop-cua-toi`; phụ huynh mở `/so-cua-con/<token>` thấy liên kết `Trang chủ KiN`, bấm → `/`; trang phụ huynh vẫn còn dòng "Trang riêng cho phụ huynh" và chân trang.
- **Khách:** `/` vẫn có Đăng nhập / Đăng ký, không có "Vào trang của tôi".
- **Không còn khối gia sư:** trang không chứa `Việc giấy tờ tăng theo số lớp`, `Cách hoạt động`, `Câu hỏi thường gặp`, `#h-gia-su`, `#cau-hoi`, `details`.
- **Khối "Tìm gia sư":** có sau mục "Học ở đây thì được gì?" (thứ tự DOM), nút "Tìm gia sư" → `/giang-vien`, chữ "Phụ huynh xem Sổ của con bằng đường dẫn riêng", liên kết "Đăng ký gia sư" → `/dang-ky?vai=gia-su` (khách bấm vào thì `/dang-ky` có nút vai Gia sư được chọn sẵn); không có `article` hoặc `h3` bên trong khối.
- **Nội dung sửa được:** (a) chưa có hàng → h1 mặc định; (b) `prisma.siteContent.upsert` đặt h1 khác + một thẻ dùng icon `star` + một `href` `javascript:` giả (ghi thẳng vào DB để mô phỏng dữ liệu hỏng) → sau khi tải lại (bài chạy trên `next dev` nơi trang dựng lại mỗi lượt nên thấy ngay; `revalidateHome()` chỉ cần thử ở bài của HOME-02, không ở đây): h1 mới hiện, thẻ `star` hiện, `href` hỏng bị thay bằng mặc định; (c) `data = "rác"` / `[]` → trang vẫn 200 với mặc định; (d) `deleteMany` lại → mặc định. Mọi tải trang không có lỗi `pageerror` / console.
- 1600px và 390px đều không tràn ngang; ảnh chụp `home-signed-in-1600/390` bằng `shot`.

### 8.4 Bài hiện có phải sửa kỳ vọng cũ (có chủ đích, không xoá ca)
- `ui-kin-site.ts`: dòng 78-79 sửa comment ("khối gia sư đã bỏ"); thêm ca "khối Tìm gia sư" (cao nút ≥ 44px, không `article`/`h3` trong khối, `article` đầu tiên vẫn là thẻ lợi ích đầu và vẫn cách mép trái 260px); các ca h1 / 4 thẻ / CTA giữ nguyên chữ mặc định.
- `ui-account-menu.ts:32`: `"Hồ sơ|Học phí|Chủ đề màu|Đăng xuất"` → `"Hồ sơ|Học phí|Chủ đề màu|Trang chủ KiN|Đăng xuất"` (đổi tên "đúng 4 mục" → "đúng 5 mục"); `:94`: `"Cài đặt|Hồ sơ gia sư|Đăng xuất"` → `"Cài đặt|Hồ sơ gia sư|Trang chủ KiN|Đăng xuất"`. Rà các ca bàn phím (↓ ↑ Home End, `Esc`) trong cùng tệp phụ thuộc số mục.
- `ui-tutor-admin.ts:58-60` (học viên / gia sư mở `/` → 307) ⇒ **200**, ở lại `/`; `:126-129` ("học viên gõ trang chủ → /student/viec-cua-toi, thấy thanh bên, không thấy Navbar khách") ⇒ ở `/`, có Navbar, có "Vào trang của tôi", không có thanh bên; tiêu đề mục `:123` đổi theo. Giữ `:61-62` (khách / quản trị 200) và `:130-131` (`/dang-ky` → dashboard).
- `ui-role-everything.ts`: `:145` ("/" … `finPath === HOME` là chuyển hướng hợp lệ) vẫn đúng nhưng không còn xảy ra với `/`; chạy bài hai vai và đọc kết quả (khách không đổi; học sinh / gia sư giờ ở lại `/`, không được bị tính là lỗi "vỏ"). Nếu bài đánh dấu `/` là phải ra vỏ, sửa kỳ vọng và ghi lý do.
- `ui-student-shell.ts`, `ui-tutor-shell.ts`, `ui-sidebar-rong.ts`: chạy lại; sửa kỳ vọng nếu đếm mục menu tài khoản.
- Xoá hẳn `ui-landing-tutor.ts` và `t-landing-copy-lib.ts` (và bỏ khỏi mọi danh sách chạy trong tài liệu nếu có: `grep` đã cho thấy chỉ chính hai tệp và `STU-002.md` nhắc tới).

### 8.5 `t-no-fabricated.ts` (không đổi mã, phải còn xanh)
Ba điều kiện của mục "Số liệu trang chủ là số đếm thật" (`prisma.`, `export const revalidate = 3600`, `filter(s => s.value > 0)`, `catch { return []; }`, `stats.length > 0`) phải còn trong `page.tsx`; sáu dòng STU-002 quét cả `siteContent.ts` (nơi giờ chứa chữ) — mặc định không được chứa chữ bị cấm. `t-no-hex`: không thêm màu viết cứng, chỉ token `--kin-*`.

### 8.6 `t-db-push-guard.ts`
Chạy nguyên trạng (không đổi) để chứng minh script vẫn đúng; việc thật của chủ nằm ở mục 9.

## 9. Cờ + câu hỏi cho chủ

**Cờ:** TIỀN không · TRẺ EM không · ĐỔI NỀN không. Chạm vỏ ba vai (`StudentShell`, `TutorShell`): đúng một phần tử mỗi nơi, phải chạy `ui-role-everything`.

**Việc của chủ (không tự động được):**
1. `prisma db push` cho bảng `site_content` trên DB phát triển và DB thử (`kin_test`); trên production, build tự chạy `scripts/db-push-on-production.mjs`. Bảng mới nên không bị `db-push-guard` chặn; nếu build đỏ thì gửi log cho COO.
2. Không cần seed. Chưa có hàng thì trang chủ chạy đúng như hôm nay.

**Câu hỏi (mỗi câu kèm mặc định):**
1. **Footer có thêm "Bạn là gia sư? Đăng ký gia sư" không?** Mặc định **không**: Footer đã có "Dành cho gia sư" → `/dang-ky?vai=gia-su`; liên kết chữ nhỏ cố định nằm trong khối "Tìm gia sư" của trang chủ. (Nếu chủ muốn thêm, vẫn là một dòng ở `Footer.tsx`, không ảnh hưởng test: `ui-kin-site.ts:88-89` dùng `want.every`.)
2. **Quản trị cấp 1 / nội dung trên tên miền chính bấm "Vào trang của tôi"** → sang `admin.midnightelite-edu.com/admin` và có thể phải đăng nhập lại (hai tên miền không chung phiên). Mặc định **chấp nhận** (cách nhỏ nhất, giống mọi liên kết tới `/admin` hiện nay). Phương án khác: ẩn nút cho hai vai này — mặc định không chọn vì làm họ mất lối về.
3. **Nút "Tạo tài khoản miễn phí" ở hero / CTA cuối vẫn hiện cho người đã đăng nhập** (trang tĩnh không biết phiên). Họ bấm sẽ bị `/dang-ky` chuyển thẳng vào dashboard. Mặc định **để vậy** trong HOME-01; đổi CTA theo phiên (client component) là việc riêng nếu chủ thấy lạ.
4. **Quyền sửa nội dung trang chủ (HOME-02):** mặc định `admin_super` + `admin_content` qua `MANAGE_NEWS`. Nếu chủ muốn chỉ `admin_super`, HOME-02 dùng `MANAGE_ADMINS`.
5. **Giới hạn độ dài / số lượng** (mục 4.1) là đề xuất; sửa hằng số một chỗ nếu cần. Đặc biệt `exams` ≤ 6 và `cards` ≤ 6 theo lưới hiện tại.
6. **Tên miền admin `/` vẫn là dashboard admin;** chủ có muốn quản trị cũng xem được trang chủ công khai trên tên miền chính — có, vì `/` luôn `next` ở tên miền chính (không đổi gì với quản trị).

## 10. Tệp chung cần xin COO (`PHAM-VI.md` "Tệp CHUNG")

Một người sửa một lúc, theo thứ tự:
1. `prisma/schema.prisma` — thêm `model SiteContent` (chỉ thêm; `t-db-push-guard`).
2. `src/lib/hostRouting.ts` — bỏ chuyển hướng `/`, sửa `needsSession` + comment đầu tệp.
3. `src/components/student/StudentShell.tsx`, `src/components/tutor/TutorShell.tsx` — mỗi nơi thêm đúng một phần tử mảng `links`; chạy `ui-role-everything` sau khi sửa.
4. `tools/local-e2e/h.ts`, `README.md`: không đổi.
Không đụng `src/app/layout.tsx`, `kin-tokens.css`, `src/components/kin/**` (kể cả `AccountMenu.tsx`), `src/lib/landing.ts`, `permissions.ts`.
`src/app/(parent)/layout.tsx` và `Navbar.tsx` không nằm trong danh sách chung — theo bảng phạm vi chúng thuộc stu-dev (trang khách / vỏ khách); nếu COO coi `(parent)/layout.tsx` thuộc phòng Gia sư (cổng phụ huynh do gia sư dựng), cần xác nhận trước khi sửa.

---

## Phụ lục A — `DEFAULT_HOME_CONTENT` (chép đúng, stu-code)

| Trường | Giá trị |
|---|---|
| `badge` | `KiN · Luyện thi ĐGNL, THPT & BCA cùng gia sư thật` (trong mã `&amp;` chỉ là JSX; trong dữ liệu là `&`) |
| `title` | `Học cùng gia sư thật,\ntheo lớp và theo lịch` |
| `lead` | `Vào lớp bằng mã gia sư gửi, xem lịch và buổi học, làm bài tập và đề thi thử ngay trên KiN. Phụ huynh xem Sổ của con bằng đường dẫn riêng.` |
| `exams[0..3]` | `{ĐGNL HSA, ĐH Quốc gia Hà Nội}`, `{ĐGNL HCM, ĐH Quốc gia TP.HCM}`, `{Tốt nghiệp THPT, 8 môn thi quốc gia}`, `{TSA Bách Khoa, ĐH Bách Khoa HN}`; `href` = `"/khoa-hoc?category=" + encodeURIComponent(label)` (`page.tsx:94`, trang `/khoa-hoc` đọc đúng các tên này) |
| `why.title` / `why.subtitle` | `Học ở đây thì được gì?` / `Những thứ học sinh thực tế dùng mỗi ngày` |
| `why.cards` | `key` · `Vào lớp bằng mã mời` · `Gia sư gửi mã, em nhập là thấy tên gia sư, lịch và học phí (nếu có) của lớp trước khi bấm vào.` — `calendar` · `Lịch học và buổi học` · `Một lịch tuần cho mọi lớp: buổi học với gia sư, hạn nộp bài tập và buổi thi thử.` — `clipboard` · `Thi thử trong phòng thi` · `Làm đề có giờ như thi thật. Nộp xong, KiN ghi nhận bài và tính điểm phần trắc nghiệm.` — `chat` · `Bài tập và hỏi đáp` · `Nộp bài tập gia sư giao ngay trên KiN. Có thắc mắc thì đăng hỏi trong lớp của mình hoặc ngoài cộng đồng.` |
| `findTutor.title` | `Đang tìm gia sư?` |
| `findTutor.desc` | `Xem hồ sơ các gia sư trên KiN. Hồ sơ gia sư được quản trị KiN xem trước khi hiện ở trang Tìm gia sư.` |
| `findTutor.buttonLabel` / `buttonHref` | `Tìm gia sư` / `/giang-vien` |
| `findTutor.parentNote` | `Phụ huynh xem Sổ của con bằng đường dẫn riêng do gia sư gửi, không cần tài khoản.` (khớp `/phu-huynh`: "Phụ huynh thì không cần đăng nhập") |
| `cta.title` | `Gia nhập cộng đồng KiN ngay hôm nay` |
| `cta.desc` | `Tạo tài khoản học sinh để thi thử ngay. Có mã từ gia sư thì vào lớp, xem lịch và nộp bài trên KiN.` |
| `cta.primary` / `secondary` | `{Tạo tài khoản miễn phí →, /dang-ky}` / `{Thi thử ĐGNL ngay, /thi-thu}` |

Độ dài các chuỗi mặc định đều nằm trong giới hạn mục 4.1 (dài nhất: `lead` ≈ 150 ký tự, `cards[3].desc` ≈ 105). `t-site-content-lib` mục 8.1-1 kiểm điều này bằng chính `validate`.
