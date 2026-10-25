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
Nếu `(guest)/layout` đọc cookie phiên để chọn khung, **cả nhóm trang khách thành dựng-lại-mỗi-lần** (mất bộ nhớ đệm), trong đó có các trang cần SEO (`/khoa-hoc`, `/giang-vien`, `/diem-chuan`, `/tin-tuc`). → quyết định bằng `AuthContext` ở máy khách (`GuestChrome`). **Hệ quả đã biết:** lần *tải cứng* đầu tiên, người đã đăng nhập thấy khung khách một thoáng rồi đổi sang vỏ; chuyển trang trong ứng dụng thì không nháy. **Đã bớt (15/10):** máy nhớ "lần trước đăng nhập kiểu gì" (`localStorage kin.vo`), một dòng chạy trước khi vẽ đặt `data-kin-vo` lên `<html>` và CSS ẩn thanh trên + chân trang của khách ngay từ khung hình đầu — hết "hiện ra trang chủ một thoáng" (xem 6.6). Trang vẫn không phải dựng lại mỗi lần.

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
| 1 | ~~**Khung Figma cho trạng thái thu**: nút mở, tiêu điểm, chấm đỏ~~ **ĐÃ VẼ 14/10** (chỉ thêm khung mới): 218:365, 218:424, 220:455 ở trang 5:39. Thọ đã xem ngày 15/10: không có vấn đề (xem `tien-do-dang-do.md` mục K) | — | Thanh xem lại |
| 2 | **Thanh rộng 220px có nhãn + mục con** (phương án B) — gom "Khác" thành mục con | Cần thiết kế; đổi cách tìm trang | Thọ chọn có / không |
| 3 | ~~**Gia sư ↔ quản trị là hai tên miền**~~ **ĐÃ SỬA 14/10**: gia sư ở lại tên miền chính, cùng phiên, trong vỏ gia sư (`hostRouting.ts`). **Còn lại:** cookie vẫn không dùng chung giữa hai tên miền cho quản trị cấp 1 / nội dung | Đụng bảo mật phiên | Thọ nếu muốn dùng chung cookie |
| 4 | **`/lop-cua-toi/[courseId]`** (xem một lớp) dùng khung riêng, không có thanh module | Cần quyết: thanh module + khung lớp cạnh nhau, hay giữ drill-in | Thọ + Thanh |
| 5 | ~~**Khi thu, "Khác" (hồ sơ, đăng xuất, trang phụ) nằm sau nút mở**~~ **ĐÃ SỬA 14/10**: menu tài khoản ở dải trên (`AccountMenu`). "Trang phụ" khác trong "Khác" vẫn nằm sau thanh bên | — | — |
| 6 | ~~**Hết nháy ở trang khách khi tải cứng**~~ **ĐÃ LÀM 15/10** theo cách đã ghi (gợi ý ở `localStorage` + script trước khi vẽ + CSS `html[data-kin-vo] [data-guest-chrome]`; `src/lib/signedInShell.ts`, `src/lib/shellHint.ts`). **Còn lại:** trong 1–2 khung đầu nội dung hiện không có thanh bên (chừa chỗ 79px chưa làm) rồi thanh bên hiện ra; gợi ý chỉ để *ẩn* khung khách, vỏ thật vẫn do `shellFor` quyết sau khi biết người dùng | Làm khi cần chừa chỗ 79px |
| 7 | Điện thoại: ngăn kéo "thò ra từ trái" thay vì thanh dưới | Thanh dưới hợp một tay hơn; chưa có yêu cầu | Chỉ làm nếu Thọ muốn |
| 8 | Rê chuột mép trái để thò ra tạm | Không có phương án bàn phím/cảm ứng | Hoãn |
| 9 | Quản trị cấp 1 / cấp nội dung ở trang khách của tên miền chính | Không có trang nào cần | Không cần |

## 7. Sửa 15/10/2026 — "đã vào vai trò thì mọi chức năng mở trong khung thanh bên"
Thọ gửi ảnh vỏ HỌC SINH (tài khoản quản trị "Admin TSIX") và nói "Thi thử", "Thư viện", "Hỏi đáp / Cộng đồng"… lại hiện ra trang kiểu trang chủ. Dựng lại bằng trình duyệt thật: **học viên và gia sư luôn giữ thanh bên; quản trị cấp 1 / cấp nội dung thì mất thanh bên ở MỌI trang khách** (trừ /cai-dat/chu-de) và thấy thanh trên + chân trang của khách.
- **Nguyên nhân:** `AuthGuard` cho quản trị vào `/student/*` để xem thử (hiện vỏ HỌC SINH), nhưng `shellFor` chỉ cho vỏ học viên và gia sư. Các mục trong "Khác" (`/student/thi-thu`, `/student/hoi-dap`, `/student/cong-dong`, `/student/bang-xep-hang`, `/student/tin-tuc`) chỉ là lệnh chuyển hướng sang trang khách (`/thi-thu`, `/cong-dong`…), và "Thư viện" / "Khoá học" / "Gia sư" / "Điểm chuẩn" vốn là trang khách → quản trị rơi ra khung khách.
- **Sửa:** mọi người đã đăng nhập đều có vỏ ở trang khách — quản trị (kể cả tài khoản cũ không có `adminRole`) được **vỏ học viên** ở chế độ xem thử. Vỏ quản trị thật vẫn chỉ ở tên miền quản trị. Các trang đăng nhập / đăng ký / khôi phục vẫn không có vỏ.
- **Nháy "trang chủ" lúc tải cứng:** xem 3.4 và 6.6 (đã làm).
- **Test:** `t-rail-lib` (65, thuần), `ui-shell-everywhere` (16, trình duyệt thật: 4 loại tài khoản × 11 chức năng; đúng thao tác của Thọ — mở "Khác" bấm 10 mục + "Thư viện"; gợi ý vỏ cho học viên, khách, gợi ý cũ, gia sư).
- **Chưa làm / cần Thọ nhìn:** quản trị xem thử khu học sinh đang thấy vỏ HỌC SINH (đúng ảnh Thọ gửi) chứ không phải vỏ quản trị — nếu muốn quản trị có một vỏ riêng trên tên miền chính thì đó là thiết kế mới, chưa làm.

## 8. Trạng thái thứ ba "rộng" 220px (15/10/2026, Thọ chọn; chuyển động theo Lucian UX/UI Prompt No.040)
- **Ba trạng thái:** `mo` 79px (Figma, mặc định) · `rong` 220px (nhãn chữ NẰM CẠNH biểu tượng) · `thu` 0px. Lưu như cũ: `localStorage kin.thanh-ben` + tuỳ chọn tài khoản `rail` (nay nhận thêm `rong`); `kin.thanh-ben-truoc` nhớ bề rộng MỞ gần nhất.
- **Điều khiển:** nút mũi tên ở **cạnh dưới thanh** (hiện khi rê chuột vào thanh, có tiêu điểm, hoặc đang ở trạng thái rộng; `aria-pressed`). Phím `[` và nút "Mở thanh bên" mở lại về ĐÚNG bề rộng đã dùng (79 hoặc 220). Điện thoại: không đổi (thanh dưới 60px, không có nút).
- **Chuyển động:** khung ngoài đổi bề rộng bằng ease 0,45 giây; nhãn hiện lần lượt (trễ 0,12 giây + 35ms mỗi mục); **vạch nổi bật dùng chung trượt (lò xo 0,5 giây)** tới mục đang chọn — áp cả ở 79px (thay cho nền từng mục tự bật/tắt). Bảng "Khác" dời theo bề rộng.
- **Không nháy khi tải lại:** `RAIL_INIT_SCRIPT` đặt `data-kin-rail=rong` trước khi vẽ (test lấy mẫu bề rộng trong lúc dựng trang).
- **Chưa làm:** khung Figma cho trạng thái rộng (Thanh vẽ), mục con. Test: `t-rail-lib` (74), `ui-motion-app` (46).

## 9. Thanh RỘNG 272px theo nhóm — khung Figma đã có (25/10/2026), thành MẶC ĐỊNH
Thanh vẽ ở mục 8 ("rộng" 220px, chỉ nhãn cạnh biểu tượng) **thay bằng khung Figma "Điều hướng"** mà Thanh đã vẽ cho mọi màn gia sư, học sinh, quản trị (file `2orXvoHL2upkiGoMjlq8aX`, trang "Nền móng", ví dụ 574:5188, 575:5571, 567:4791). Đã dựng:
- **Ba trạng thái, mặc định đổi:** `rong` (272px, nhóm + nhãn) là mặc định cho người dùng chưa chọn gì; `mo` (79px) và `thu` (0px) vẫn chọn được, nhớ theo máy + tài khoản như cũ. Script đầu trang (`RAIL_INIT_SCRIPT`) luôn đặt `data-kin-rail`, nên không nháy. Người đã lưu `mo` hoặc `thu` từ trước giữ nguyên.
- **Số đo lấy từ Figma:** thanh 272px, đệm 24px trên dưới / 17px hai bên; logo KiN 23px + nhãn vai (GIA SƯ / HỌC SINH / QUẢN TRỊ) 11,1px; nhóm cách nhau 6px, tiêu đề nhóm viết hoa 11,1px đậm; mục cao 37px (44px khi màn cảm ứng), bo `--kin-bo-md`, biểu tượng 21px cách chữ 12px, chữ 13,3px; mục đang chọn nền `--kin-nen-dang-chon` + chữ navy đậm; chân "Miễn phí ra mắt". Token mới: `--kin-co-h3: 23px` (Figma có, CSS thiếu).
- **Nhóm:** Gia sư = Làm việc hằng ngày (các module đang bật) · Dạy học · Tiền (Học phí + Doanh thu) · Giới thiệu · Tài khoản; Học sinh = Làm việc hằng ngày (4 module) · Học tập · Khám phá · Tài khoản; Quản trị = mỗi module là một nhóm, trang con là mục (dải tab trang con vẫn còn, như Figma 567:4791). Module gia sư đã tắt vẫn **chỉ ẩn khỏi thanh** (không đổi so với trước); quyền từng trang quản trị giữ nguyên.
- **Hai bộ mục cùng nằm trong DOM**, CSS chọn bộ hiện theo `data-kin-rail` (không dựng lại, không nháy): `modules` cho thanh hẹp + thanh dưới điện thoại, `groups` cho thanh rộng. Nút "Khác" chỉ còn ở thanh hẹp (ở thanh rộng mọi mục đã nằm trong nhóm); nút thu thanh dời lên góc trên phải thanh rộng.
- **Điểm gãy 1024px:** từ 768 đến 1023px thanh rộng chiếm hơn một phần ba màn hình nên vẫn dùng thanh hẹp dù đã chọn "rộng". Điện thoại không đổi (thanh dưới 4 tab).
- **Lệch có chủ ý so với Figma:** mục cao 37px theo Figma nhưng 44px ở màn cảm ứng (quy tắc chạm tối thiểu 44px của brand book); dải trên giữ chuông thông báo + dấu hỏi + (admin) liên kết "Trang học viên" và nút Đăng xuất vì là chức năng thật mà Figma không vẽ; ô nút thu thanh (yêu cầu của Thọ 14/10) Figma cũng không vẽ.
- **Test:** `t-rail-lib` (76, thuần), `ui-sidebar-rong` (mới), `ui-sidebar` và `ui-motion-app` cập nhật sang 272px. Các bài ui-* khác chạy ở thanh hẹp (`ctxFor` đặt sẵn `mo`, xem `tools/local-e2e/ui.ts`) để giữ nguyên ý nghĩa; bài nào kiểm mặc định truyền `rail: "mac-dinh"`.
