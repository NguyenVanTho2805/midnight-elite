# Thanh bên trái — luôn hiện sau đăng nhập, thu vào / thò ra

Phân tích + quyết định + trạng thái dựng. Viết 14/10/2026, theo yêu cầu của Thọ cùng ngày.
Liên quan: `bo-cuc-outlook.md` (mục 2, 3, 6, 8), `src/components/kin/shell/ModuleRail.tsx`.

---

## 1. Yêu cầu (nguyên văn rồi diễn giải)

> "Khi đăng nhập dashboard rồi thì luôn hiện left side bar, hoặc có thể thò ra thụt vào."

Hai vế, **không mâu thuẫn** nếu hiểu đúng: *mặc định luôn hiện*; *thu vào là hành động chủ động của người dùng*, được nhớ lại. Thanh không bao giờ tự thu, và không bao giờ biến mất vì lý do kỹ thuật.

Diễn giải thành bốn điều kiểm được:

| # | Yêu cầu | Kiểm bằng |
|---|---|---|
| R1 | Đã đăng nhập thì ở trang nào cũng thấy thanh điều hướng bên trái — trừ chỗ **cố ý** không có (phòng thi, trang phụ huynh, trang xác thực) | `ui-sidebar` mục "Thư viện / trang khách" |
| R2 | Thu vào và mở ra bằng một thao tác rõ ràng, có cả bàn phím, tiêu điểm không lạc | `ui-sidebar` mục "Thu vào / Mở ra / Bàn phím" |
| R3 | Lựa chọn được nhớ: lần sau, máy khác (cùng tài khoản) vẫn vậy; **không nháy** khi tải lại | `ui-sidebar` mục "Tải lại", "Máy khác" |
| R4 | Không làm hỏng gì: khung Outlook 3 cột vẫn vừa màn hình; điện thoại không mất lối điều hướng | `ui-sidebar` mục "Điện thoại", "Quản trị" |

---

## 2. Hiện trạng trước khi sửa (đo ngày 14/10)

Thanh module (`ModuleRail`, 79px, đúng Figma 11:98 / 9:2) đã có ở ba vỏ, nhưng **không thu được** và **chỉ có ở một phần các trang**:

| Khu | Vỏ | Có thanh bên? |
|---|---|---|
| `/student/*` (trừ phòng thi) | `StudentShell` | Có (79px) |
| Phòng thi `/student/thi-thu/<mã>` | không có vỏ — **cố ý** (toàn màn hình, khoá Navy) | Không (đúng) |
| `/lop-cua-toi/*` của gia sư | `TutorShell` | Có |
| `/admin/*` (tên miền `admin.midnightelite-edu.com`) | `AdminShell` | Có |
| **Trang khách khi ĐÃ đăng nhập**: `/thu-vien`, `/khoa-hoc`, `/khoa-hoc/[slug]`, `/khoa-hoc-da-luu`, `/giang-vien`, `/mentor/[id]`, `/diem-chuan`, `/tin-tuc`, `/cong-dong`, `/bang-xep-hang`, `/thi-thu`, `/tra-cuu`, `/ban-do`, `/chinh-sach` | `(guest)/layout` = Navbar + Footer của khách | **KHÔNG — thanh bên biến mất** |
| `/lop-cua-toi/[courseId]` (xem một lớp) | `OutlookShell` riêng (2 khung) | Không |
| Gia sư bấm "Bài KT" / "Thư viện" | nhảy sang tên miền quản trị → `AdminShell` | Có, **nhưng là thanh của quản trị** (module khác hẳn) |
| Điện thoại (<768px) | thanh dưới 60px | Có, luôn hiện |

**Lỗi gốc của "thanh bên biến mất":** các trang khách nằm trong nhóm layout `(guest)`, không phải `(student)`. Chính thanh bên học sinh có module **"Thư viện" trỏ tới `/thu-vien`**, và bảng "Khác → Khám phá" trỏ tới `/khoa-hoc`, `/giang-vien`, `/diem-chuan`, `/khoa-hoc-da-luu` — tức là *bấm một mục của thanh bên thì thanh bên mất*. Đó đúng là điều Thọ thấy.

**Figma** (file `2orXvoHL2upkiGoMjlq8aX`): chỉ có thanh 79px với 4 module học sinh (11:98) và bộ "Nút module" (8:122) có 4 trạng thái × có/không badge — **không có trạng thái thu gọn, không có nút mở lại**. Phần thu/mở trong tài liệu này là *phát triển thêm*, chưa có khung thiết kế.

---

## 3. Phân tích

### 3.1 Thu thanh 79px có lợi bao nhiêu?
Trên laptop 1280px, khung Outlook của "Việc của tôi" = thanh 79 + danh sách 330 + khung đọc 871. Thu thanh → khung đọc 950px (**+9%**). Lợi ích rộng không lớn; lợi ích thật là:
1. **Tập trung** khi đọc/làm (bài giảng, báo cáo, bảng doanh thu, điểm danh nhiều cột).
2. **Màn hình hẹp / phóng chữ 200%** (WCAG 1.4.10 reflow): ở 768–1024px, thanh + danh sách đã chiếm hơn 40% bề ngang.
3. Quen tay: Outlook, Slack, Notion, VS Code đều có.

### 3.2 Các phương án đã cân

| Phương án | Ưu | Nhược | Quyết |
|---|---|---|---|
| **A. Hai trạng thái**: 79px (đúng Figma) ⇄ thụt vào hẳn (0px) + nút mở ở dải trên | Đổi ít nhất, không phá Figma, dễ test, không có trạng thái "nửa vời" | Khi thu thì mất cả lối điều hướng cho tới khi mở lại | **Chọn** |
| B. Ba trạng thái: rộng 220px (nhãn + mục con) ⇄ 79px ⇄ ẩn | Đầy đủ như menu 226px cũ của gia sư (đã bỏ 13/10 để theo Figma); gom được "Khác" thành mục con | Cần thiết kế mới trong Figma; nhiều trạng thái hơn để giữ đồng bộ | Hướng phát triển nếu Thọ muốn |
| C. Chỉ biểu tượng 56px ⇄ 79px | Giữ lối điều hướng | Tiết kiệm có 23px; mất nhãn chữ → người mới khó đoán | Bỏ |
| D. Tự thu khi màn hình hẹp | Đỡ phải bấm | **Trái yêu cầu "luôn hiện"**; bất ngờ | Bỏ |
| E. Rê chuột mép trái để thò ra tạm (như dock) | Nhanh với người dùng chuột | Không dùng được bằng bàn phím/cảm ứng; khó test | Bỏ (có thể thêm sau, phải có phương án bàn phím) |

### 3.3 Chỗ dễ sai (đã tính trước)
1. **Nháy khi tải lại.** Nếu đọc trạng thái trong `useEffect`, thanh hiện ra rồi mới thụt. → script chạy **trước khi vẽ** (`next/script`, `beforeInteractive`) đặt `data-kin-rail="thu"` lên `<html>`; CSS ẩn thanh từ khung hình đầu. Test đo bề rộng thanh mỗi lần DOM đổi: không có khoảnh khắc nào > 0.
2. **`position: sticky` hỏng.** Khung bọc đổi bề rộng cần cắt phần tràn; `overflow: hidden` biến nó thành khung cuộn và thanh trong đó **mất sticky**. → dùng `overflow-x: clip`.
3. **Tab rơi vào chỗ ẩn.** Thanh ẩn bằng bề rộng 0 vẫn có thể nhận tiêu điểm. → `visibility: hidden` (đặt trễ đúng 180ms để chạy xong chuyển động): gỡ khỏi thứ tự Tab và cây trợ năng. Test: `focus()` vào liên kết trong thanh khi đang thu → không nhận.
4. **Mất tiêu điểm.** Bấm nút "Thu gọn" rồi nút biến mất → bàn phím rơi về đầu trang. → chuyển tiêu điểm sang nút đối diện (`[data-rail-open]` ↔ `[data-rail-close]`).
5. **Giấu mất việc cần làm.** Chấm đỏ nằm trên thanh; thu thanh là mất chấm. → nút "Mở thanh bên" mang chấm đỏ và nói số việc bằng chữ ("Mở thanh bên, có 3 việc cần xử lý").
6. **Bảng "Khác" neo vào thanh** (`md:left-[87px]`). Thu thanh mà bảng còn mở thì treo lơ lửng. → thu thanh thì đóng bảng.
7. **Phím tắt nuốt chữ.** `[` không được nuốt khi đang gõ trong ô nhập / vùng soạn thảo / bộ gõ tiếng Việt; không bắt khi giữ phím (nhấp nháy); nhường mọi tổ hợp Ctrl/Cmd/Alt.
8. **Điện thoại.** Thanh dưới là điều hướng chính khi cầm một tay; không thu được. Dù trạng thái đã lưu là "thu" (đặt từ máy tính), điện thoại vẫn hiện thanh dưới (CSS chỉ áp từ 768px). Có test.
9. **Chuyển động.** 180ms `ease-out` (đúng nhịp mục 9 của `bo-cuc-outlook.md`: "công cụ dùng hằng ngày, ngắn"); `prefers-reduced-motion: reduce` → 0s.
10. **Máy khác / nhiều tab.** Nguồn đúng là **tài khoản** (cùng cách với chủ đề màu, TK-167): đăng nhập ở máy mới thì lấy lựa chọn của tài khoản. `localStorage` chỉ là bản nháp để khỏi nháy.

### 3.4 Vì sao trang khách quyết định ở máy khách, không ở máy chủ
Nếu `(guest)/layout` đọc cookie phiên để chọn khung, **cả nhóm trang khách thành dựng-lại-mỗi-lần** (mất bộ nhớ đệm), trong đó có các trang cần SEO (`/khoa-hoc`, `/giang-vien`, `/diem-chuan`, `/tin-tuc`). → quyết định bằng `AuthContext` ở máy khách (`GuestChrome`). **Hệ quả đã biết:** lần *tải cứng* đầu tiên, người đã đăng nhập thấy khung khách một thoáng rồi đổi sang vỏ; chuyển trang trong ứng dụng thì không nháy.

---

## 4. Quyết định cho bản dựng này

| # | Quyết định |
|---|---|
| D1 | **Ai thấy thanh bên ở trang khách:** học viên và gia sư. Quản trị có vỏ riêng trên `admin.midnightelite-edu.com`, trên tên miền chính họ không có trang nào cần vỏ. Khách chưa đăng nhập: Navbar + Footer như cũ. |
| D2 | **Loại trừ:** phòng thi (khoá cứng); trang phụ huynh (không tài khoản); `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/xac-thuc-email`, `/xac-nhan-phu-huynh` (`NO_SHELL_PATHS`, so khớp theo đoạn đường dẫn: `/dang-nhap-gi-do` vẫn có vỏ). |
| D3 | **Hai trạng thái** `mo` / `thu`, chỉ từ 768px. Mặc định `mo`. |
| D4 | **Điều khiển:** nút "Thu gọn thanh bên" (cao 44px) ở đầu thanh; nút "Mở thanh bên" (44px) ở góc trái dải trên khi thu; phím `[`. |
| D5 | **Nhớ:** `localStorage["kin.thanh-ben"]` + `User.preferences.rail` (`"mo"`/`"thu"`; ghi rõ cả `"mo"` để máy khác biết đã mở). Khách không lưu gì. |
| D6 | **Không tự thu** ở bất kỳ kích thước nào. |

---

## 5. Đã dựng (14/10)

| Phần | Tệp |
|---|---|
| Trạng thái, phím tắt, script chạy trước khi vẽ (thuần) | `src/lib/railState.ts` |
| Ai/ở trang nào có vỏ (thuần) | `src/lib/signedInShell.ts` |
| Kho trạng thái phía trình duyệt (`<html data-kin-rail>` là nguồn sự thật) | `src/components/kin/shell/railStore.ts` |
| Thanh bên: khung `#kin-rail`, nút thu, phím `[` | `src/components/kin/shell/ModuleRail.tsx` |
| Nút mở + chấm đỏ ở dải trên | `src/components/kin/shell/RailOpenButton.tsx`, gắn vào `StudentShell` / `TutorShell` / `AdminShell` |
| CSS (bề rộng, `visibility`, chuyển động) | `src/app/kin-tokens.css` |
| Script trước khi vẽ | `src/app/layout.tsx` (`<Script strategy="beforeInteractive">`) |
| Lấy lựa chọn của tài khoản về máy | `src/components/AccountThemeSync.tsx` |
| Tuỳ chọn `rail` (đọc khoan dung, ghi nghiêm) | `src/lib/userPreferences.ts` |
| Vỏ ở trang khách cho học viên / gia sư | `src/components/shell/GuestChrome.tsx`, `TutorShellClient.tsx`, `src/app/(guest)/layout.tsx` |
| Menu tài khoản ở dải trên (làm sau, cùng ngày) | `src/components/kin/shell/AccountMenu.tsx`, gắn vào `StudentShell` / `TutorShell` |
| Gia sư ở lại tên miền chính; đăng nhập xong vào thẳng dashboard (làm sau, cùng ngày) | `src/lib/hostRouting.ts` (thuần), `src/proxy.ts`, `src/components/tutor/TutorAdminFrame.tsx`, `src/app/(admin)/layout.tsx` |

Test: `t-rail-lib` (54, thuần), `t-prefs` (+11 về `rail`, tổng 38), `ui-sidebar` (57, trình duyệt thật: học viên, gia sư, quản trị, điện thoại, khách). Làm sau: `t-host-routing-lib` (43), `ui-tutor-admin` (33), `ui-account-menu` (29). Đã **thử phá cố ý**: bỏ script trước khi vẽ → test "không nháy" đỏ (`[79,1,0]`: thanh hiện 79px rồi mới thụt); trả `(guest)/layout` về bản cũ → các kiểm tra "Thư viện / trang khách" đỏ.

---

## 6. Chưa làm — và cần quyết

| # | Việc | Vì sao chưa | Cần ai |
|---|---|---|---|
| 1 | ~~**Khung Figma cho trạng thái thu**: nút mở, tiêu điểm, chấm đỏ~~ **ĐÃ VẼ 14/10** (chỉ thêm khung mới): 218:365, 218:424, 220:455 ở trang 5:39. Chưa ai nhìn ảnh chụp (xem `tien-do-dang-do.md` mục K) | — | Thanh xem lại |
| 2 | **Thanh rộng 220px có nhãn + mục con** (phương án B) — gom "Khác" thành mục con | Cần thiết kế; đổi cách tìm trang | Thọ chọn có / không |
| 3 | ~~**Gia sư ↔ quản trị là hai tên miền**~~ **ĐÃ SỬA 14/10**: gia sư ở lại tên miền chính, cùng phiên, trong vỏ gia sư (`hostRouting.ts`). **Còn lại:** cookie vẫn không dùng chung giữa hai tên miền cho quản trị cấp 1 / nội dung | Đụng bảo mật phiên | Thọ nếu muốn dùng chung cookie |
| 4 | **`/lop-cua-toi/[courseId]`** (xem một lớp) dùng khung riêng, không có thanh module | Cần quyết: thanh module + khung lớp cạnh nhau, hay giữ drill-in | Thọ + Thanh |
| 5 | ~~**Khi thu, "Khác" (hồ sơ, đăng xuất, trang phụ) nằm sau nút mở**~~ **ĐÃ SỬA 14/10**: menu tài khoản ở dải trên (`AccountMenu`). "Trang phụ" khác trong "Khác" vẫn nằm sau thanh bên | — | — |
| 6 | **Hết nháy hoàn toàn ở trang khách khi tải cứng** | Cần cookie gợi ý (không bí mật) + script trước khi vẽ để chừa chỗ 79px | Làm khi cần |
| 7 | Điện thoại: ngăn kéo "thò ra từ trái" thay vì thanh dưới | Thanh dưới hợp một tay hơn; chưa có yêu cầu | Chỉ làm nếu Thọ muốn |
| 8 | Rê chuột mép trái để thò ra tạm | Không có phương án bàn phím/cảm ứng | Hoãn |
| 9 | Quản trị cấp 1 / cấp nội dung ở trang khách của tên miền chính | Không có trang nào cần | Không cần |
