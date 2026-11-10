# BU-HS-TRANG-CHU · Trang chủ là BỘ MẶT, luôn có đường về từ khu học sinh, lớp học có chương xổ ra/thu vào

Đặc tả của `stu-rnd` (pb-hoc-sinh), 09/11/2026. Nhánh làm việc `claude/bu-hs-trang-chu` (rẽ từ `origin/main` f0378557). Phiếu COO: chủ KiN dùng thử production, học sinh đã đăng nhập bấm "Lớp của tôi" một lần là không quay lại được Trang chủ; chủ muốn trang chủ là nơi cộng đồng để học sinh theo dõi, nơi gia sư đăng quiz tăng tương tác, nơi học sinh tính điểm thi của mình.
Nguồn: mã đọc trực tiếp (tệp:dòng ở từng mục), `BIGUPDATE-KE-HOACH.md` (BU-00, BU-05), `dac-ta/BU-05.md`, `HOME-01.md`, `HOME-02.md`, `diem-yeu-01-11-2026.md` §3.3, `QUYET-DINH.md` (Hướng A: thoáng, một nút đặc mỗi màn, nút ≥44px), `ui-student-shell.ts`, `ui-sidebar-rong.ts`, `ui-home-signed-in.ts`.
**Không truy cập được Figma và không mở được hsavnu.edu.vn trong phiên này.** Bố cục hsavnu lấy theo lời COO (thanh trên toàn cục · bấm My Class ra trang lớp riêng có thanh bên thụt ra thụt vào · nội dung khoá là chương xổ ra/thu vào). Mục 5 và Phụ lục B là bản mô tả đủ để vẽ; số đo nào lệch Figma đã duyệt thì Figma thắng.

Cờ: **TIỀN = không** (không đụng Coin/học phí/điểm) · **TRẺ EM = trình bày + hành vi** (feed chỉ hiện tên rút gọn; Phụ lục A là dữ liệu do học sinh sinh ra, CHƯA LÀM, chờ chủ) · **ĐỔI NỀN = không** cho phần làm ngay (không thư viện mới, không WebSocket); **ĐỔI NỀN = có** nếu chủ chọn lưu tệp bài nộp ở Blob/S3 (Phụ lục A, chưa làm).
**Schema: không thêm gì cho phần làm ngay.** Mọi đề xuất schema nằm ở mục 3 và chỉ là đề xuất cho Phụ lục A và khối Quiz.

---

## 0. Tóm tắt quyết định

1. Nguyên nhân gốc: khu học sinh chỉ có MỘT đường về "/" là mục "Trang chủ KiN" nằm trong menu tài khoản; thanh module, logo, bảng "Khác" đều không có lối về. Thêm lối về ở mọi chỗ (mục 1.3).
2. "/" tiếp tục là trang KHÔNG vỏ, dùng thanh trên (Navbar) cho mọi vai, kiểu hsavnu: Lớp học · Thi thử · Cộng đồng · Tin tức, học sinh thêm "Lớp của tôi". Không đưa "/" vào vỏ học sinh (mục 1.4).
3. Trang chủ giữ tĩnh (`revalidate = 3600`, không đọc cookie ở máy chủ). Khối động là component máy khách dùng `useAuth()` (mục 5.1).
4. Bảng tin trên trang chủ dùng lại `/api/community/feed` + `FeedCard` + `useFeed`, chỉ bài CHUNG (`scope=common`), 5 bài. Không làm lại cộng đồng.
5. **"Quiz của gia sư" KHÔNG có dữ liệu để hiển thị**: hiện không có cơ chế nào đăng quiz lên cộng đồng hay công khai quiz của gia sư (mục 1.2). Làm khung + trạng thái rỗng, ẩn sau cờ; cần chủ quyết (mục 9).
6. "Tính điểm thi" = `TinhDiemChuan` có sẵn (tính ở trình duyệt, không gửi máy chủ). Nhúng vào trang chủ với công thức đọc ở máy chủ trong chu kỳ làm mới 1 giờ.
7. Trang lớp: cây chương CHƯA có ở trang lớp (chương bị trải phẳng, mục 1.5); thanh bên bài giảng đã có phần/chương nhưng thiếu tìm, mở hết/thu hết, đếm theo chương. Làm một component `CourseOutline` dùng cho cả hai chỗ.
8. Nộp bài bằng tệp: **đã có một luồng cũ, lỏng** (mục 1.6, Phụ lục A). Đặc tả màn + câu hỏi cho chủ; không có mã lưu tệp, không có cách "tạm".
9. Việc làm ngay không cần schema, không cần API mới: stu-code chỉ viết hàm thuần + test; stu-dev làm giao diện.
10. Việc chung xin COO: `StudentShell.tsx`, `ShellIcon.tsx` (mục 10).

---

## 1. Vấn đề và bằng chứng (đã xác minh bằng đọc mã)

### 1.1 Học sinh trong khu học sinh không có lối về Trang chủ

Xác minh từng ý trong phiếu:

| Ý trong phiếu | Kết quả | Bằng chứng |
|---|---|---|
| Từ 01/11 "/" `next` cho mọi vai | **Đúng.** Tên miền chính không còn nhánh nào cho "/"; `needsSession` không bắt "/" ở tên miền chính | `src/lib/hostRouting.ts:53` (chỉ `isAdminPath` hoặc `AUTH_PAGES`), `:87` ghi chú, `:88-92` chỉ `/dang-nhap`, `/dang-ky` bị chuyển |
| Test khoá lại "/" | **Đã có sẵn, không cần viết thêm**: `t-host-routing-lib.ts` mục "trang chủ mở được cho mọi vai" (học viên/gia sư/quản trị/khách × `""`, `?utm=x`, `?redirect=…` → `next`); `ui-home-signed-in.ts:29-31` kiểm URL ở lại "/" với học sinh | — |
| `page.tsx` không nằm trong `(guest)`, dùng Navbar riêng | **Đúng.** Không qua `GuestChrome`, không có vỏ | `src/app/page.tsx:48` (`<Navbar />`), `src/app/(guest)/layout.tsx` (chỉ bọc nhóm guest) |
| Navbar có "Vào trang của tôi" → `landingPath` | **Đúng** | `src/components/Navbar.tsx:56` (`myPage = landingPath(...)`), `:103-105`, `:190-192`; `src/lib/landing.ts:9-13` (học sinh → `/student/viec-cua-toi`) |
| Logo ở vỏ học sinh trỏ Việc của tôi | **Đúng** | `StudentShell.tsx:95` (`home={{ href: "/student/viec-cua-toi" … }}`), `:110` (logo điện thoại); `ModuleRail.tsx:197-203` |
| Lối về "/" duy nhất là "Trang chủ KiN" trong menu tài khoản | **Đúng** | `StudentShell.tsx:118` (`links=[… { label: "Trang chủ KiN", href: "/" }]`). Cần hai bước (mở menu, chọn); trên điện thoại menu nằm ở góc trên phải |
| Thanh module / "Khác" không có Trang chủ | **Đúng** | `StudentShell.tsx:77-84` (3 module + Khác), `:29-43` (`MORE_GROUPS`: Khám phá + Tự học); `MorePanel.tsx:62-77` chỉ vẽ `groups` |
| Cùng vỏ bọc `/lop-cua-toi`, `/cong-dong`, `/khoa-hoc` | **Đúng** | `LopCuaToiFrame.tsx:57-58` → `StudentFrame`; `GuestChrome.tsx:18-21` → `StudentShell` khi `shellFor` = "student"; `signedInShell.ts:22-28` |
| AuthGuard / `studentAreaRedirect` / `shellFor` / `shellHint` cần sửa | **Không.** Không cái nào can thiệp "/" (AuthGuard chỉ bọc nhóm `(student)`: `(student)/layout.tsx`); `studentAreaRedirect` (`tutorGate.ts:65-75`) chỉ đẩy gia sư/gia sư chờ duyệt ra khỏi `/student/*`; `shellHintFor` = `shellFor(user, "/")` chỉ để ẩn khung khách ở trang guest | — |

**Phát hiện thêm (phiếu chưa nêu), làm lối về hụt nặng hơn:**
- Khi học sinh thu thanh bên (phím `[` hoặc nút thu), thanh bên rộng 0 và logo điện thoại bị `md:hidden`; ở máy tính dải trên chỉ còn chữ "Không gian học tập" (`StudentShell.tsx:111`, `RailOpenButton.tsx:1-2`). Lúc đó lối về duy nhất vẫn là menu tài khoản.
- Từ Trang chủ, học sinh bấm "Cộng đồng"/"Lớp học"/"Tin tức" trên Navbar (`Navbar.tsx:13-18`) rơi vào `GuestChrome` → vỏ học sinh, mất Navbar, và từ đó cũng không còn lối về "/" trừ menu tài khoản. Cùng gốc, cùng cách sửa.
- Nhánh logo: logo của thanh bên đứng ở vị trí mọi người quen bấm để về trang chủ nhưng trỏ "Việc của tôi". Đây là lý do chính chủ cảm thấy "không quay lại được".

### 1.2 Trang chủ hiện chưa có cộng đồng, quiz, tính điểm

`HomeSections.tsx` (138 dòng) gồm Hero (`:26-73`, kèm 4 thẻ "ĐANG MỞ LUYỆN THI" và số đếm), "Học ở đây thì được gì?" (`:76-100`), "Tìm gia sư" (`:103-119`), CTA (`:122-135`). Không có bảng tin, không có quiz, không có công cụ tính điểm. `page.tsx` tĩnh: `revalidate = 3600` (`:24`), chỉ đọc số đếm và `loadHomeContent()`. Test `t-no-fabricated.ts:69-71` khoá: `page.tsx` phải đếm từ prisma, `revalidate = 3600`, `filter(s => s.value > 0)`, `stats.length > 0` ở `HomeSections` — phải giữ.

Có gì dùng lại được:
- **Bảng tin**: `GET /api/community/feed?tab=&scope=&limit=` (`api/community/feed/route.ts:1-24`): khách xem được, `limit` 1–50, `NO_STORE`. Với khách: không có câu hỏi cũ (STU-006, `communityServer.ts:167-169`, `includeLegacy` cần `viewerId`), không có bài của lớp (`scope=common` → `courseId: null`, `:156`), tên đã rút gọn phía máy chủ. `useFeed` (`components/community/useFeed.ts`; hiện cố định `limit=20` ở `:32`), `FeedCard`/`FeedSkeleton` (`FeedCard.tsx:15,60`), `KinStateCard`/`KinEmptyState`. CSS `kc-*` chỉ nạp khi import `./community.css` (hiện chỉ `CommunityLayout.tsx:3`).
  Lưu ý: với học sinh, `scope=all` kéo cả bài của lớp (`visibleThreadScope`). Trang chủ là BỘ MẶT nên **luôn dùng `scope=common`** cho cả hai.
- **Tính điểm**: `src/app/(guest)/diem-chuan/TinhDiemChuan.tsx` (80 dòng): nhận `formulas: PublicFormula[]`, tính bằng `computeScore` ngay ở trình duyệt, không gửi gì lên máy chủ (`:1-3`), có câu lưu ý thường trực và nguồn. `loadPublicFormulas()` (`admissionFormulaServer.ts:23-28`) đọc công thức đã công khai và có nguồn; `/diem-chuan` đang `force-dynamic` (`diem-chuan/page.tsx:9`) nhưng dữ liệu này không theo người dùng nên **gọi được trong trang chủ tĩnh** (làm mới theo giờ).
- **Quiz — "quiz" của KiN là `Exam`** (Bài KT / đề thi, mô hình `Exam`, soạn ở `/lop-cua-toi/de-thi`, API gia sư `api/tutor/quiz`). **Hiện không có quiz nào CÔNG KHAI hay ĐĂNG ĐƯỢC lên cộng đồng:**
  - quiz gia sư tạo mới luôn `activeGuest: false, guestCanTake: false, active: false` (`api/tutor/quiz/route.ts:48`, `import-save/route.ts:62`) và `deThiAssign.ts:43` cấm gia sư ghi `price/activeGuest/guestCanTake` (`FORBIDDEN_FIELDS`);
  - đề không gắn lớp mà chủ đề là gia sư ("giao theo link") bị ẩn khỏi danh sách (`examVariantRoute.ts:53-57`, `isListedToStudent`);
  - `Thread` không có cột nào trỏ tới đề (`schema.prisma`, model `Thread` ~`:2000-2040`; `communityTypes.ts` không có `examId`).
  Vậy khối "Quiz của gia sư" không thể có dữ liệu thật nếu không có quyết định + schema mới (mục 3, 9). Không bịa quiz mẫu (`t-no-fabricated`).

### 1.3 Cách sửa lối về (làm ngay, không schema, không API)

Nguyên tắc: **mọi màn có vỏ học sinh đều thấy một lối "Trang chủ" rõ chữ, ≥44px; phòng thi (`/student/thi-thu/<mã đề>`, không vỏ, khoá cứng) KHÔNG có lối về — giữ nguyên.**

| # | Chỗ | Đổi | Ghi chú |
|---|---|---|---|
| a | Thanh module (79px) + thanh rộng (272px) | Thêm module `{ key: "trang-chu", label: "Trang chủ", href: "/", icon: "nha", desktopOnly: true }` **đứng đầu** mảng `modules` (`StudentShell.tsx:77`). `wide` (`:87-90`) tự lấy nó vào nhóm "Làm việc hằng ngày" | `desktopOnly` không có `onClick` → không lên thanh dưới điện thoại (`ModuleRail.tsx:242`: `!m.desktopOnly \|\| (mobileMore && !!m.onClick)`), nên thanh dưới vẫn **4 ô** (3 module + Khác) và test 4 ô ở 320/390px giữ nguyên |
| b | Logo thanh bên (máy tính) | `home={{ href: "/", label: "KiN — Trang chủ" }}` (`:95`) | Logo dẫn về trang chủ là thói quen; "Việc của tôi" đã là mục đầu của thanh |
| c | Logo điện thoại ở dải trên | `href="/"`, `aria-label="KiN — Trang chủ"`, vùng bấm `min-h-11 min-w-11` (`:110`; hiện `KinLogo size={24}`, vùng bấm nhỏ hơn 44px) | Điện thoại: logo là lối về chính |
| d | Bảng "Khác" (điện thoại) | `MorePanel` thêm prop tuỳ chọn `homeLink?: { label; href }`, vẽ **một hàng đầu bảng**, `md:hidden`, ≥44px (`MorePanel.tsx:62`). Hàng ghi "Trang chủ KiN". Không thêm vào `MORE_GROUPS` (để `moreToNavGroup` không nhân đôi mục ở thanh rộng) | Giữ luật BU-00: **không** đưa lại Thư viện, Tiếng Anh, Thi thử, Xếp hạng, Hỏi đáp, Khoá học, Lớp theo dõi, Điểm chuẩn, Ví vào menu |
| e | Dải trên khi thanh bên THU | `useRail()` (`railStore.ts:56`): khi `rail === "thu"`, ở `md+` hiện liên kết chữ "Trang chủ KiN" (`data-top-home`, ≥44px) cạnh `RailOpenButton` (`StudentShell.tsx:109`) | Chặn đúng lỗ hổng "thu thanh bên là mất lối về" |
| f | Menu tài khoản | **Giữ** "Trang chủ KiN" (`:118`); `ui-home-signed-in.ts:76-89` đang kiểm | |
| g | Mục sáng | Mục "Trang chủ" **không bao giờ sáng trong vỏ** (vỏ không bao giờ hiện ở "/"). Khớp chính xác "/" đã đúng sẵn: `navActive.ts:8` `under(p, base) = p === base \|\| p.startsWith(base + "/")` → với `base = "/"` là `startsWith("//")`, không đường thật nào khớp; `ModuleRail.tsx:58` và `MorePanel.tsx:21-24` cùng công thức. **Đúng do tình cờ**, nên phải khoá bằng test (mục 8, `t-nav-home-lib`) để không ai "đơn giản hoá" thành `startsWith(href)` | Nếu một ngày "/" vào vỏ, mục sẽ sáng đúng |

Bài `ui-*` phải sửa kỳ vọng (mục 8): `ui-student-shell.ts` (thêm "Trang chủ", mục 5 của "Bảng Khác": 5 link ở 1280, 6 ở 390), `ui-sidebar-rong.ts` (nhóm đầu thành `Trang chủ|Việc của tôi|Lịch học|Lớp của tôi`).

### 1.4 "/" cho người đã đăng nhập: Navbar nào? — QUYẾT ĐỊNH

**Giữ Navbar (thanh trên), không vỏ, cho mọi vai; học sinh thêm mục "Lớp của tôi".** Thứ tự: `Lớp học · Thi thử · Cộng đồng · Tin tức · Lớp của tôi` (mục cuối chỉ khi `role === "student"` và không `tutorPending`; đích `/student/hoc-tap`). Nút "Vào trang của tôi" (→ `landingPath`) **giữ nguyên** cho mọi vai.
Lý do:
1. Khớp mẫu hsavnu: trang chủ là mặt tiền có thanh trên toàn cục; "My Class" mở ra không gian có thanh bên riêng. Hai nơi, hai vỏ, mỗi nơi một cửa sang nơi kia (mục 1.3 là cửa chiều về).
2. Quyết định HOME-01 (01/11) và bài `ui-home-signed-in.ts:31-32` (có "Điều hướng chính", KHÔNG có thanh bên module) + `ui-journey-new-student.ts:87` đã khoá hành vi này; đổi sang vỏ học sinh là đảo quyết định đã chạy production.
3. Trang chủ phải chia sẻ được và đọc được như nhau với khách và học sinh (SEO, bộ nhớ đệm). Đưa "/" vào `GuestChrome` buộc quyết định vỏ ở máy khách và dính hiệu ứng nháy khung (`GuestChrome.tsx:1-4`).
4. Thêm "Lớp của tôi" vào Navbar = một chạm từ mặt tiền vào lớp, đúng yêu cầu "bấm My Class".
Lệch Figma 146:2 ("4 mục, khách và người đã đăng nhập thấy như nhau", chú thích đầu `Navbar.tsx:12`): đây là lệch CÓ CHỦ ĐÍCH, ghi vào phiếu bàn giao; xin chủ xác nhận (mục 9, câu 1).
Điện thoại: mục "Lớp của tôi" nằm trong menu bung của Navbar (`Navbar.tsx:176-186`) ngay trên khối tài khoản.

### 1.5 Trang lớp: đã có gì, còn thiếu gì (đo bằng mã)

| Yêu cầu | Trang lớp `/student/hoc-tap?course=` (`LopCuaToi.tsx`) | Thanh bên bài giảng `/student/bai-giang/[id]` (`LeftCourseSidebar`, `page.tsx:466-635`) |
|---|---|---|
| Chương xổ ra / thu vào | **Chưa.** Tab "Tổng quan" trải phẳng: mỗi phần một tiêu đề, bài của mọi chương gộp một danh sách (`:275-280`, `s.chapters.flatMap(c => c.lessons)`); **tên chương không hiện ở đâu**. `Chapter` (`:80`) chỉ để kiểu. `KinFold`/`KinChevron` chỉ dùng cho bản ghi theo THÁNG (`:45-73`) | **Có một phần**: phần (section) gập được (`openSections`, `:476-481`, nút `:524-538`); chương chỉ là nhãn tĩnh, chỉ hiện khi phần có >1 chương, **không gập được** (`:546-551`) |
| Thụt cấp rõ | Chưa (phẳng) | Chỉ thụt bằng `px-4`, phần/chương/bài khác nền chứ không khác lề |
| Tìm nhanh | **Chưa** | **Chưa** |
| Mở hết / Thu hết | Chưa | Chưa |
| Đếm x/y mỗi chương | Chỉ đếm theo phần (`:277`) | Chỉ theo phần (`:522-526`, `:533`) |
| Mục đang học đánh dấu | Có trạng thái "Học tiếp" cho bài kế (`:173`, `:227`); không đánh dấu hàng | Có: `isCurrent` nền + vạch trái 3px (`:560-570`) |
| Thanh bên thụt-ra-thụt-vào ở màn rộng | Không có (cột phải 354px là "Thông tin lớp") | Có, chỉ từ `xl` (≥1280px), 268px, nút `‹ ›` (`:488`, `:618-632`), nhớ trạng thái ở `localStorage "lessonSidebar"` (`:656-663`) |
| 390px | Một cột, hàng bài dạng lưới (`:230`) | Không có thanh bên; nút nổi mở tờ trượt "Nội dung khóa học" 75vh, tái dùng cùng hàm với `mobile` (`:940-965`) |

Dữ liệu cây đã đủ (`Section > Chapter > Lesson`, API `/api/courses/[id]`, đã lọc bài Nháp/Ẩn bằng `pruneTreeForViewer` — `lessonStatus.ts:34-48`); **không cần API mới.**

### 1.6 Nộp bài bằng tệp: đã có một luồng lỏng (phát hiện ngoài phiếu)

Phiếu coi "nộp bằng tệp" là việc mới, nhưng `AssignmentCard` (`bai-giang/[lessonId]/page.tsx:164-229`) ĐÃ có kéo-thả + nút chọn tệp:
- trình duyệt gửi thẳng tệp lên Cloudinary bằng preset KHÔNG KÝ (`lib/cloudinary.ts:13-35`) → URL công khai;
- `<input type="file">` **không có `accept`** (`:200`), không giới hạn dung lượng ở máy chủ, không kiểm đuôi hay byte đầu → nhận cả ảnh;
- `POST /api/assignments/[id]/submit` tin nguyên chuỗi `fileUrl` do trình duyệt gửi (`submit/route.ts:54-57`: chỉ kiểm không rỗng), không kiểm nguồn;
- chính tệp đó ghi: "KHÔNG nhận ảnh bài làm của học sinh dưới 16 tuổi" (`:40-41`, `schema.prisma` `AssignmentSubmission.kind`) — và **chỉ** đường `linkUrl` tuân thủ, đường tệp thì không;
- hạ tầng tệp riêng tư kiểu mới (`FileAsset`, `api/media/document/init`, kiểm byte đầu `fileSniff.ts`, hạn mức, `GET /api/media/<id>/file` có kiểm quyền) **chỉ dành cho gia sư** (`document/init/route.ts:20`, `requireTutorOnly`).
Đây là cờ TRẺ EM có thật, xem Phụ lục A và mục 9.

---

## 2. Phạm vi tệp (không trùng nhau)

Quy tắc: stu-dev **không import prisma**, không sửa `api/`, không sửa `src/lib/*.ts` của stu-code. stu-code **không sửa trang/component**. Hai bên nối nhau bằng hàm thuần ở `src/lib/` (viết TRƯỚC, bước 0).

### stu-code (máy chủ + hàm thuần + test thuần/API)
| Tệp | Việc |
|---|---|
| `src/lib/homeLayout.ts` (MỚI, thuần, không prisma/next/react) | `homeBlocksFor(viewer, flags)` → khối nào hiện cho khách / học sinh / gia sư / gia sư chờ duyệt / quản trị; `homeNavFor(viewer)` → mục của Navbar. Xem mục 4.1 |
| `src/lib/lessonOutline.ts` (MỚI, thuần) | `outlineShape`, `chapterProgress`, `initialOpenChapters`, `filterOutline`, `allChapterIds`. Import `fold`/`queryTokens` từ `librarySearch.ts`. Xem mục 4.2 |
| `tools/local-e2e/t-home-layout-lib.ts` (MỚI) | Test thuần cho `homeLayout.ts` |
| `tools/local-e2e/t-lesson-outline-lib.ts` (MỚI) | Test thuần cho `lessonOutline.ts` |
| `tools/local-e2e/t-nav-home-lib.ts` (MỚI) | Khoá "/" khớp chính xác (`navActive`), mục Trang chủ không sáng ở `/student/*`, hằng "mục bị cấm" của BU-00 |
| `tools/local-e2e/t-home-feed.ts` (MỚI, API) | Feed công khai cho trang chủ: khách `GET feed?tab=all&scope=common&limit=5` (mục 8) |
| API / schema | **Không sửa.** Không thêm route. (`/api/community/feed`, `/api/enrollments?detail=1`, `/api/progress`, `/api/courses/[id]` dùng nguyên.) |

### stu-dev (giao diện)
| Tệp | Việc |
|---|---|
| `src/app/page.tsx` | Tải thêm `loadPublicFormulas().catch(() => [])`; truyền `formulas` + `slots`; giữ `revalidate = 3600`, `loadStats`, ba điều kiện `t-no-fabricated` |
| `src/components/guest/HomeSections.tsx` | Nhận thêm `slots?: { afterHero?: ReactNode; afterWhyIntro?: ReactNode }` (tuỳ chọn; bản xem trước quản trị `/admin/trang-chu/xem-truoc` không truyền → không đổi). Hero gọn lại (mục 5.1). Vẫn không hook, không prisma |
| `src/components/guest/HomeMyClass.tsx` (MỚI, client) | Khối "Lớp của tôi" (chỉ học sinh) |
| `src/components/guest/HomeCommunity.tsx` (MỚI, client) | Khối bảng tin; import `./community.css` |
| `src/components/guest/HomeQuiz.tsx` (MỚI, client) | Khối Quiz của gia sư; **ẩn mặc định** (mục 5.1) |
| `src/components/guest/HomeScore.tsx` (MỚI) | Bọc `TinhDiemChuan` hoặc thẻ dẫn sang `/diem-chuan` |
| `src/components/Navbar.tsx` | Mục "Lớp của tôi" cho học sinh theo `homeNavFor` (`:13-18`, `:73-89`, `:176-186`) |
| `src/components/community/useFeed.ts` | Thêm tuỳ chọn `limit?: number` (mặc định 20, `:32`) — thay đổi tương thích ngược; `CommunityHome` không truyền |
| `src/components/student/CourseOutline.tsx` (MỚI, client) | Cây Phần > Chương > Bài + tìm + Mở hết/Thu hết, ba biến thể `page` / `rail` / `sheet` |
| `src/components/student/LopCuaToi.tsx` | Tab "Tổng quan" dùng `CourseOutline variant="page"` (thay `:275-280`); giữ hai tab còn lại |
| `src/app/(student)/student/bai-giang/[lessonId]/page.tsx` | Thay hàm `LeftCourseSidebar` (`:466-635`) bằng `CourseOutline variant="rail"`/`"sheet"` ở hai chỗ gọi (`:814-823`, `:954-962`). Không đổi phần còn lại của tệp 969 dòng |
| `src/components/kin/shell/MorePanel.tsx` | Prop `homeLink` (mục 1.3d). Tệp thuộc pb-hoc-sinh theo `PHAM-VI.md` |
| Phụ lục A (nộp bài tệp) | **KHÔNG làm.** Chỉ thiết kế (Phụ lục A, B.4) |

### stu-test (bài trình duyệt; viết riêng, stu-dev không sửa)
`tools/local-e2e/ui-home-doors.ts` (MỚI), `ui-lop-outline.ts` (MỚI), sửa kỳ vọng ở `ui-student-shell.ts`, `ui-sidebar-rong.ts`, `ui-home-signed-in.ts` (mục 8). COO chạy tuần tự.

---

## 3. Schema (chỉ thêm)

**Phần làm ngay: không thêm gì.**

Chỉ là đề xuất, chưa tạo, chờ chủ (mục 9):

**(a) Khối Quiz của gia sư trên cộng đồng** — cách nhỏ nhất:
```prisma
model Thread {
  // ... giữ nguyên ...
  examId String?   // quiz gắn kèm bài (không khai relation, như acceptedReplyId, tránh vòng khoá ngoại)
  @@index([examId])
}
```
Kèm quy tắc (cần chủ): gia sư đăng bài gắn một đề của CHÍNH mình; đề phải được công khai riêng cho mục đích này (hiện `activeGuest`/`guestCanTake` bị cấm ghi ở phía gia sư). Phải có thêm cột hoặc chế độ "quiz mở cho khách" để khách/học sinh ngoài lớp làm được — chưa thiết kế vì chạm điểm số, bảng xếp hạng, và dữ liệu do khách sinh ra.

**(b) Nộp bài bằng tệp** — xem Phụ lục A.3.

---

## 4. Hợp đồng

### 4.0 API dùng nguyên (không đổi)

| API | Dùng ở | Điều cần giữ |
|---|---|---|
| `GET /api/community/feed?tab=all&scope=common&limit=5` | `HomeCommunity` | Khách và học sinh đều gọi; JSON **không** chứa `email`, `phone`, `school`, `city`, `dateOfBirth`, `guestIpHash`, `reviewedById`, `rejectReason`, tên đầy đủ của học sinh (`FeedAuthor.label` đã rút gọn). `course` luôn `null` với `scope=common`. Khách không nhận `source:"question"` |
| `GET /api/enrollments?detail=1` (`useMyClasses`), `GET /api/progress` (`useProgress`) | `HomeMyClass` | Chỉ dữ liệu của chính học sinh. Không hiện bạn học |
| `GET /api/courses/[id]` | `CourseOutline` | Đã lọc bài Nháp/Ẩn; không lộ tên chương chỉ có bài nháp |

**Trường KHÔNG được trả / không được hiển thị** (người đang làm bài: quiz, đáp án): trang chủ **không** hiện đề, đáp án đúng, lời giải, điểm, thứ hạng, kết quả của học sinh nào. Khối Quiz (nếu bật) chỉ hiện: tiêu đề đề, tên gia sư (đã xác minh), số câu, thời lượng, nút "Làm quiz" → đường dẫn vào phòng thi hiện có. Mọi mốc giờ (hạn, mở/đóng) lấy từ máy chủ (`serverNow` như `quizRoom.ts:6-15`), không từ đồng hồ trình duyệt. `timeAgo` của `FeedCard` tính từ `createdAt` ISO của máy chủ (chênh vài giây là chấp nhận được, không phải mốc giờ nghiệp vụ).

### 4.1 `src/lib/homeLayout.ts` (thuần) — stu-code viết trước

```ts
export type HomeViewer =
  | { kind: "loading" }                                  // AuthContext chưa trả lời
  | { kind: "guest" }
  | { kind: "student" }                                  // role student, không tutorPending
  | { kind: "tutor-pending" }                            // role student + tutorPending
  | { kind: "tutor" }                                    // admin + adminRole teacher
  | { kind: "admin" };                                   // admin_super / admin_content (xem thử)
export const toHomeViewer = (user: { role: string | null; adminRole?: string | null; tutorPending?: boolean } | null, isLoading: boolean): HomeViewer;

export interface HomeFlags { quiz: boolean }             // KIN_HOME_QUIZ=1 đọc ở máy chủ (page.tsx) rồi truyền xuống
export interface HomeBlocks { myClass: boolean; community: true; quiz: boolean; score: true; ctaFinal: boolean }
export const homeBlocksFor = (v: HomeViewer, f: HomeFlags): HomeBlocks;
//  guest/loading → myClass:false, ctaFinal:true.   student → myClass:true, ctaFinal:false.
//  tutor, tutor-pending, admin → myClass:false (họ không có "lớp để học").   quiz = f.quiz cho mọi vai.

export interface HomeNavItem { label: string; href: string }
export const homeNavFor = (v: HomeViewer): HomeNavItem[];
//  mọi vai: Lớp học /khoa-hoc · Thi thử /thi-thu · Cộng đồng /cong-dong · Tin tức /tin-tuc;  student: + "Lớp của tôi" /student/hoc-tap (cuối).
```
Quy tắc: `loading` **không** được hiện "Lớp của tôi" (tránh nháy cho khách) và không hiện nút đăng ký lung tung.

### 4.2 `src/lib/lessonOutline.ts` (thuần) — stu-code viết trước

```ts
export interface OLesson { id: string; title: string; isLocked?: boolean }
export interface OChapter { id: string; title: string; lessons: OLesson[] }
export interface OSection { id: string; title: string; chapters: OChapter[] }

/** Cây hiện mấy cấp: phần chỉ hiện khi khoá có >1 phần; hàng chương chỉ hiện khi phần đó có >1 chương (1 chương → bài đứng thẳng dưới phần). */
export const outlineShape = (s: OSection[]): { showSection: boolean; showChapterIn: Record<string, boolean> };
export const chapterProgress = (c: OChapter, done: ReadonlySet<string>): { done: number; total: number; complete: boolean };
/** Chương mở sẵn: chương chứa bài đang xem (`currentId`) hoặc bài kế (`nextId`); không có thì chương đầu tiên. Luôn ≥1 chương nếu có chương. */
export const initialOpenChapters = (s: OSection[], opts: { currentId?: string | null; nextId?: string | null }): Set<string>;
export const allChapterIds = (s: OSection[]): string[];
/** Lọc theo từ khoá: bỏ dấu, hoa/thường, đ=d (dùng `fold`/`queryTokens`); từ khoá <2 ký tự → không lọc (trả cây gốc, matches=null).
 *  Bài khớp nếu mọi từ khoá có trong tên bài HOẶC tên chương; chương khớp tên → giữ cả bài của nó. Chương/phần không còn bài thì bỏ.
 *  `openChapterIds` = mọi chương còn lại sau lọc. Không đổi cây gốc. */
export const filterOutline = (s: OSection[], query: string): { sections: OSection[]; openChapterIds: Set<string>; matchedLessons: number; matchedChapters: number } | { sections: OSection[]; matches: null };
```

### 4.3 Hợp đồng giao diện giữa các khối (stu-dev)

- `HomeSections` nhận `slots.afterHero` (khối "Lớp của tôi") và `slots.afterWhyIntro` (bảng tin + quiz + tính điểm, đặt **trước** "Học ở đây thì được gì?"). Không truyền → hành vi cũ (admin xem trước).
- `CourseOutline` props: `sections`, `completedIds`, `currentId?`, `nextId?`, `watching?`, `variant: "page" | "rail" | "sheet"`, `hrefFor(lessonId)` (trang lớp dùng liên kết; thanh bên bài giảng dùng `onSelect` để giữ hành vi `handleSelectLesson`), `idPrefix` (cho `aria-controls`). Trạng thái mở nằm trong component (không lưu), `Mở hết`/`Thu hết` đổi toàn bộ.

---

## 5. Luồng màn — 1600/1280 và 390, ba trạng thái, khách và học sinh

### 5.1 Trang chủ "/" (tĩnh, một URL cho mọi người)

Thứ tự khối: **Navbar → Hero gọn → [Lớp của tôi: chỉ học sinh] → Bảng tin (+ Quiz ở cột phải) → Tính điểm thi → "Học ở đây thì được gì?" rút gọn → "Tìm gia sư" → CTA cuối (chỉ khách) → Footer.**

Kỹ thuật bắt buộc để giữ bộ nhớ đệm và SEO:
- `page.tsx` vẫn tĩnh: không `cookies()`, không `headers()`, `revalidate = 3600`. HTML ban đầu = bản dành cho khách (có Hero, mô tả, thẻ lợi ích, Tìm gia sư, CTA).
- Mọi khối theo người dùng/động là component `"use client"`: `useAuth()` quyết "Lớp của tôi", `useFeed` lấy bảng tin sau khi trang đã vẽ.
- Trong lúc `isLoading`: khối "Lớp của tôi" KHÔNG vẽ gì (không nháy cho khách). Khi biết là học sinh thì khối hiện ra (đẩy nội dung xuống một lần). Tuỳ chọn tốt hơn: đặt chỗ trước bằng gợi ý vỏ `html[data-kin-vo="student"]` (`signedInShell.ts:36-37`) — để stu-dev quyết, không bắt buộc.
- Công thức tính điểm đọc ở máy chủ, nằm trong HTML tĩnh, **làm mới theo giờ** như số đếm (công thức mới công khai có thể trễ ≤1 giờ; ghi vào mục 9, câu 5).
- Đọc `node_modules/next/dist/docs/` (Next 16, theo `AGENTS.md`) trước khi viết các component máy khách trong trang tĩnh; không giả định API cũ.

**Khách (không đăng nhập):**
| Khối | 1280/1600 | 390 |
|---|---|---|
| Hero gọn | Hai cột như cũ, giảm lề dọc (≈ `pt-10 pb-12`), mục tiêu cao ≤ 440px ở 1280 (đo bằng `ui-home-doors`) | Một cột, `h1` `clamp(28px, 7.5vw, …)` như cũ |
| Bảng tin | Hàng 2 cột trong khung 1120px: trái bảng tin 600px, phải rail 360px (Quiz) | Một cột, bảng tin rồi Quiz |
| Tính điểm | Dải đầy bề ngang, tối đa 760px, đứng riêng dưới hàng 2 cột | Một cột, ô nhập một cột |
| Phần giới thiệu | "Học ở đây thì được gì?" rút lề (`py-10` thay `py-[72px]`), "Tìm gia sư", CTA cuối | Như cũ, một cột |

**Học sinh:** như khách, thêm khối "Lớp của tôi" ngay dưới Hero (nền `--kin-nen-bang`), và **ẩn** CTA cuối ("Đăng ký" vô nghĩa với người đã có tài khoản; bằng wrapper client, hiển thị cho tới khi biết đã đăng nhập — P3, tuỳ chọn).
**Gia sư / gia sư chờ duyệt / quản trị:** như khách, KHÔNG có "Lớp của tôi"; Navbar có "Vào trang của tôi" như cũ.

**Ba trạng thái từng khối động (bắt buộc):**
| Khối | Đang tải | Rỗng | Lỗi tải |
|---|---|---|---|
| Lớp của tôi | `KinSkeleton` 2 hàng (`role="status" aria-busy`, nhãn "Đang tải Lớp của tôi") | `KinEmptyState` "Bạn chưa vào lớp nào" + nút "Nhập mã lớp" (`/student/nhap-ma-lop`) và "Tìm lớp miễn phí" (`/khoa-hoc?gia=free`) — giống `LopCuaToi.tsx:200-204` | `ErrorStrip` "Không tải được danh sách lớp của bạn." + "Thử lại" (nói là LỖI, không coi là "chưa vào lớp nào" — bài học `useMyClasses.ts:9-12`) |
| Bảng tin | `FeedSkeleton rows=3` (đúng lưới 48 \| 1fr), `aria-busy` | "Chưa có bài viết nào." / "Khi gia sư hoặc các bạn đăng bài, bài mới sẽ hiện ở đây." + nút "Mở Cộng đồng" | `KinStateCard tone="loi"`: kicker "Lỗi · Có thể thử lại", tiêu đề "Không tải được bảng tin", nút "Thử lại" 44px (`feed.reload`); mất mạng thì chữ "Mất kết nối mạng. Kiểm tra mạng rồi thử lại nhé." (giống `FeedList.tsx:25-37`) |
| Quiz | `KinSkeleton` 1 thẻ | "Chưa có quiz nào được đăng." / "Khi gia sư đăng quiz lên Cộng đồng, quiz mới nhất sẽ hiện ở đây." | "Không tải được quiz." + "Thử lại" |
| Tính điểm | (không đọc mạng khi nhập; tính ngay) | Không có công thức công khai → thẻ "Tra cứu điểm chuẩn": "KiN chưa có công thức tính điểm nào được công khai. Bạn vẫn xem được điểm chuẩn các trường, có dẫn nguồn từng dòng." + nút "Mở Tra cứu điểm chuẩn" (`/diem-chuan`) | Nhập sai: lỗi dưới từng ô như `TinhDiemChuan.tsx:25-27` |

**Khối Quiz — ẩn mặc định.** Trạng thái rỗng "đúng" nghĩa là: dữ liệu có thể có nhưng đang trống. Hiện chưa có CƠ CHẾ tạo dữ liệu (mục 1.2), nên một khung rỗng vĩnh viễn trên mặt tiền production là hại hơn lợi. Quyết định: dựng `HomeQuiz` đủ ba trạng thái, nhận `items` qua một hợp đồng kiểu (khi chủ duyệt mới có API), **không render** trừ khi `KIN_HOME_QUIZ=1` (đọc ở máy chủ, giống `KIN_GUEST_QUESTIONS`). Cờ tắt → khối biến mất, rail phải của bảng tin cũng biến mất và bảng tin dãn thành một cột 600px canh giữa.

**Khách bấm Thích/Lưu/Bình luận ở bảng tin:** `ActionRow` đã chuyển sang `/dang-nhap?redirect=` đúng chỗ (BU-05) — tận dụng làm "tăng tương tác". **Báo cáo bài** giữ nguyên từ `FeedCard`. Không có ô soạn bài, không có ô hỏi của khách, **không nhắn riêng** ở trang chủ.

### 5.2 Khu học sinh — lối về Trang chủ (mọi màn có vỏ)
Xem 1.3. Ở 390px thanh dưới giữ 4 ô; lối về = logo (≥44px) + hàng đầu của bảng "Khác" + menu tài khoản. Ở máy tính: mục "Trang chủ" đầu thanh (79px và 272px), logo, và liên kết "Trang chủ KiN" ở dải trên khi thanh thu.

### 5.3 Lớp của tôi: cây chương
- Chỉ dùng API đã có. **1280:** `[ nội dung | 354px "Thông tin lớp" ]` như cũ; tab "Tổng quan" = thanh công cụ (ô tìm + Mở hết + Thu hết) rồi cây. **390:** một cột; thanh công cụ xếp dọc (ô tìm 44px full-width, hai nút cạnh nhau); ô tìm dính đầu vùng nội dung (`sticky`, dưới dải trên 48px).
- Khách/học sinh khác lớp: trang này yêu cầu đăng nhập (không đổi). Chưa vào lớp: hero báo "Bạn chưa vào lớp này" như cũ; cây vẫn hiện nhưng hàng bài khoá nếu `isLocked`.
- **Mở hết / Thu hết** đổi mọi chương. **Gõ từ khoá** (≥2 ký tự): lọc, tự mở mọi chương còn lại, vùng `role="status"` đọc "Tìm thấy 3 bài trong 2 chương."; không khớp: `KinEmptyState` nhỏ "Không có bài nào khớp “abc”." + nút "Xoá từ khoá". Xoá từ khoá → về trạng thái mở trước đó (chương chứa bài đang học mở sẵn).
- Ba trạng thái: đang tải (khung xương cây 4 hàng, đã có `WorkSkeleton`), rỗng ("Lớp chưa có bài học nào" — có sẵn `:277`), lỗi (có sẵn `ErrorStrip` + "Thử lại").
- Thanh bên bài giảng (`variant="rail"` 268px, từ `xl`): cùng cây, ô tìm + hai nút nằm dưới tiến độ, vùng cây cuộn riêng; mục đang xem sáng (nền `--kin-nhan-nen-nhat`, vạch trái 3px `--kin-nhan-nen`, `aria-current="page"`). Điện thoại: tờ trượt `variant="sheet"` (75vh), ô tìm dính đầu tờ.
- Thụt-ra-thụt-vào "thanh bên thu/mở" ở màn rộng: **giữ** nút `‹ ›` hiện có, thêm `aria-expanded`/`aria-controls` (hiện thiếu `aria-controls`).

### 5.4 Nộp bài bằng tệp — CHƯA LÀM (Phụ lục A)

---

## 6. Quy tắc nội dung
1. **Không nhắn riêng**; trang chủ không có ô soạn, không có ô hỏi.
2. **Khách qua duyệt**: khách không đăng được gì ở trang chủ; câu hỏi của khách (BU-05) vẫn đi qua hàng chờ duyệt; trang chủ chỉ đọc bài đã `published`.
3. **Báo cáo bài**: dùng nguyên `ActionRow` (một lần mỗi người mỗi bài; không tự báo cáo bài của mình).
4. **Hiển thị**: chỉ tên hiển thị rút gọn do máy chủ trả (`FeedAuthor.label`); không trường, không lớp, không ảnh đại diện thật (avatar chữ cái trên nền token); văn bản thuần (React tự thoát), không HTML/Markdown.
5. **Bảng tin trang chủ** chỉ bài chung (`scope=common`), không bao giờ bài của lớp, kể cả với học sinh trong lớp (mặt tiền công khai).
6. **Lời hứa**: không thêm "xếp hạng", "GPA", "thưởng", "Coin", "xu" vào các khối mới (`t-no-fabricated`). Công cụ tính điểm giữ nguyên câu "Chỉ mang tính tham khảo. KiN không lưu điểm bạn nhập."
7. Không đưa lại vào menu học sinh: Thư viện, Tiếng Anh tự học (còn là lối tắt trong "Tự học", không thêm), Thi thử, Bảng xếp hạng, Hỏi đáp, Khoá học đang mở, Lớp đang theo dõi, Tra cứu điểm chuẩn, Ví và Coin. Trang chủ có thể dẫn sang `/diem-chuan` bằng nút trong khối tính điểm; đó là nút nội dung, không phải mục menu.
8. Quiz (nếu bật): chỉ hiện tiêu đề đề + tên gia sư đã xác minh; không bảng điểm; không "người đã làm".

## 7. Thông báo không tên, không tiền
Trang này **không tạo thông báo mới.** Nếu sau này có "quiz mới trong Cộng đồng": chữ cố định "Có quiz mới trong Cộng đồng.", không tên gia sư, không tên đề, không số tiền/xu, liên kết `/cong-dong/<id>`; đi qua `communityRules.notificationText` (bài `t-community-feed-lib` đã quét tên/xu/đ). Dòng ghi chú ở thanh trên/`NotificationBell` không đổi.

---

## 8. Test phải có

Chạy trên DB thử `kin_test` (xem `tools/local-e2e/README.md`); mỗi bài tự dựng dữ liệu bằng `h.ts` + `prisma`, không sửa `student-world.ts`. Tuần tự, COO chạy. Mỗi bài ghi dòng "Ca phá" (đổi gì trong mã thì ca nào phải đỏ).

### `t-home-layout-lib.ts` (thuần)
- `toHomeViewer`: `null`+loading → `loading`; student thường → `student`; student + `tutorPending` → `tutor-pending`; admin teacher → `tutor`; admin_super / admin_content → `admin`; role `null`, adminRole lạ → `guest` (đóng khi lạ).
- `homeBlocksFor`: `loading` và `guest` → `myClass:false`; `student` → `myClass:true`; `tutor-pending`/`tutor`/`admin` → `myClass:false`; `ctaFinal` chỉ khách và loading; `quiz` đúng cờ truyền vào, cờ tắt → `false` cho mọi vai.
- `homeNavFor`: đúng 4 mục cho khách/gia sư/quản trị; học sinh 5 mục, "Lớp của tôi" cuối cùng và `href === "/student/hoc-tap"`; **không** mục nào ngoài danh sách (không "Thư viện", "Bảng xếp hạng", "Ví").
- **Ca phá**: đổi `student` → `tutor-pending` ở nhánh `myClass` → ca "gia sư chờ duyệt không thấy Lớp của tôi" đỏ.

### `t-nav-home-lib.ts` (thuần) — khoá mục 1.3g
- `activeIndex("/student/hoc-tap", [{href:"/"}, {href:"/student/viec-cua-toi"}, {href:"/student/hoc-tap"}])` = **2** (không phải 0); `activeIndex("/student/viec-cua-toi", …)` = 1; `activeIndex("/cong-dong", [{href:"/"}, …])` không bao giờ trả chỉ số của "/"; `matchLen("/student/x", {href:"/"})` = 0; `matchLen("/", {href:"/"})` = 1; `activeIndex("/", [{href:"/"},{href:"/student/viec-cua-toi"}])` = 0.
- Hằng "mục bị cấm" (BU-00) tách thành mảng trong test, so với nhãn của `MORE_GROUPS`/`modules` bằng cách đọc nguồn `StudentShell.tsx` (regex): không nhãn bị cấm nào xuất hiện trong `label: "…"`.
- **Ca phá**: sửa `navActive.under` thành `pathname.startsWith(base)` → ca đầu đỏ (mục Trang chủ sáng ở mọi trang).

### `t-lesson-outline-lib.ts` (thuần)
- `outlineShape`: 1 phần/1 chương → chỉ bài; 1 phần/3 chương → hàng chương, không hàng phần; 2 phần → có hàng phần; phần 1 chương + phần 3 chương → `showChapterIn` đúng từng phần.
- `chapterProgress`: 0/8, 3/8, 8/8 (`complete`), chương rỗng (0/0 → `complete:false`); id đã học không thuộc chương không tính.
- `initialOpenChapters`: có `currentId` → đúng chương đó; không có thì `nextId`; cả hai không tồn tại → chương đầu; cây rỗng → rỗng; hai chương cùng chứa (id trùng bất thường) → không ném lỗi.
- `filterOutline`: bỏ dấu ("chuong 2" khớp "Chương 2", "duong thang" khớp "Đường thẳng", "dai so" khớp "Đại số"); hoa/thường; từ khoá 1 ký tự và chuỗi toàn dấu cách → không lọc; nhiều từ = VÀ; khớp tên chương → giữ cả bài; chương không còn bài biến mất, phần không còn chương biến mất; `openChapterIds` = đúng các chương còn lại; **cây gốc không bị đổi** (so `JSON.stringify` trước-sau); từ khoá dài 5000 ký tự không treo (<50ms); ký tự đặc biệt `$ ^ ( ) [`, `<script>` coi như chữ thường, không ném lỗi, không regex.
- **Ca phá**: bỏ `fold` ở so khớp → ca "chuong 2" đỏ; trả cây gốc đã bị `splice` → ca "không đổi cây gốc" đỏ.

### `t-home-feed.ts` (API thật)
- Khách `GET /api/community/feed?tab=all&scope=common&limit=5` → 200, `items.length + pinned.length` hợp lệ, ≤5 mục trong `items`; **không** có mục `source:"question"` dù DB có câu hỏi cũ (dựng một câu hỏi cũ bằng `prisma.question.create`); **không** có bài có `course` (dựng một bài lớp); mọi `author.label` không chứa họ tên đầy đủ của học sinh mẫu; `likedByMe/bookmarkedByMe/isOwn` đều `false`.
- Quét đệ quy thân trả về: không khoá `email`, `phone`, `zaloPhone`, `school`, `highSchool`, `city`, `dateOfBirth`, `avatarBase64`, `guestIpHash`, `reviewedById`, `rejectReason`, `password`.
- Học sinh trong lớp `GET …scope=common` → vẫn **không** có bài của lớp.
- `limit=0|51|abc` → 400 `limit_invalid`; bài xoá mềm/`pending`/`rejected` không có trong kết quả.
- Khách gọi API học sinh: `GET /api/enrollments?detail=1`, `GET /api/progress`, `GET /api/student/viec-cua-toi` → `401`; `POST /api/community/threads` → `401` (khách không đăng được từ trang chủ).
- **Ca phá**: bỏ `viewerId !== null` ở `includeLegacy` (`communityServer.ts:169`) → ca "khách không thấy câu hỏi cũ" đỏ.

### `ui-home-doors.ts` (trình duyệt, 1600/1280/390/320)
- **Cửa về, từng màn có vỏ** (học sinh): `/student/viec-cua-toi`, `/student/lich-hoc`, `/student/hoc-tap`, `/student/hoc-tap?course=<id>`, `/student/bai-giang/<id>`, `/student/ho-so`, `/student/hoc-phi`, `/lop-cua-toi`, `/cong-dong`, `/tin-tuc`, `/giang-vien`, `/khoa-hoc`, `/cai-dat/chu-de`: có đúng một liên kết "Trang chủ" **nhìn thấy được** tới "/" trong thanh module (1280, cả thanh hẹp lẫn rộng) **hoặc** logo ≥44px (390); bấm → URL là "/" và **ở lại "/"** (không 307 sang Việc của tôi), có Navbar "Điều hướng chính" và không có thanh bên module.
- Bảng "Khác" ở 390: hàng đầu "Trang chủ KiN", cao ≥44px; ở 1280 hàng đó **không hiện**; bảng vẫn **đúng** mục cũ (không có mục bị cấm).
- Thu thanh bên (`[`): hiện liên kết "Trang chủ KiN" ở dải trên ≥44px; mở lại thanh → liên kết biến mất.
- Mục "Trang chủ" **không** có `aria-current` ở mọi trang `/student/*`; đúng MỘT `aria-current` trong thanh module như cũ.
- Phòng thi `/student/thi-thu/<mã đề>`: **không** có lối về (không vỏ) — khẳng định không đổi.
- **"/" mở được với học sinh đã đăng nhập** (ca khẳng định phiếu yêu cầu): `goto("/")` → URL "/" sau 3 giây, có khối "Lớp của tôi", có "Vào trang của tôi" → `/student/viec-cua-toi`, có "Lớp của tôi" trong Navbar → `/student/hoc-tap`.
- Khối theo vai: khách không thấy "Lớp của tôi"; gia sư, gia sư chờ duyệt, quản trị không thấy "Lớp của tôi"; học sinh 0 lớp thấy trạng thái rỗng đúng chữ; chặn mạng `/api/enrollments` → thấy lỗi + "Thử lại" bấm được; **trễ 2 giây** → thấy khung xương (`aria-busy`) rồi biến mất.
- Bảng tin: chặn mạng `feed` → "Không tải được bảng tin" + "Thử lại"; trả `{pinned:[],items:[]}` → chữ rỗng; ≤5 thẻ; khách bấm "Thích" → `/dang-nhap?redirect=%2F`; liên kết "Xem tất cả" ≥44px → `/cong-dong`.
- Quiz: cờ tắt → không có khối, không chữ "Quiz" trên trang; (cờ bật, ca riêng) rỗng đúng chữ.
- Tính điểm: nhập điểm → kết quả; **không có yêu cầu mạng nào** phát sinh khi bấm "Tính điểm" (đếm request); câu "KiN không lưu điểm bạn nhập" hiện thường trực; không công thức → thẻ dẫn `/diem-chuan`.
- Mọi nút/liên kết nhìn thấy cao ≥44px; `scrollWidth ≤ innerWidth` ở 1600, 1280, 390, 320; chữ phóng 130% không tràn; 0 `pageerror`/`console.error`.
- Quét `t-no-hex` (không hex trong tệp mới).
- **Trang chủ vẫn tĩnh**: `curl /` (không cookie) cho HTML có `<h1>` và `Cache-Control` có `s-maxage`; lặp với cookie học sinh cho **cùng** thân HTML (khối "Lớp của tôi" không nằm trong HTML máy chủ). Đây là ca khoá "không đọc cookie ở máy chủ".

### `ui-lop-outline.ts` (trình duyệt, 1280/390/320)
- Dựng khoá có 2 phần × 3 chương × 4 bài (tên có dấu); học sinh đã học 3 bài chương 1.
- Cây có đúng 3 cấp thụt (đo `getBoundingClientRect().left` của tiêu đề phần < chương < bài); chương `aria-expanded` đúng; chương chứa bài kế mở sẵn, chương khác thu.
- Bấm tiêu đề chương → mở/thu; `Mở hết` → mọi `aria-expanded=true`; `Thu hết` → mọi `false`; nhãn "3/4 bài" đúng từng chương; chương xong hết có chữ "Đã xong".
- Tìm "duong thang" → chỉ còn bài/chương khớp, các chương đó tự mở, thông báo `role=status` đúng số; "zzz" → trạng thái không khớp + "Xoá từ khoá"; xoá → về trạng thái trước.
- Mục đang học: `aria-current` trên đúng một hàng; bài khoá `aria-disabled` và không bấm được.
- Thanh bên bài giảng (1280): cùng cây, cùng tìm; thu/mở bằng `‹ ›` nhớ trạng thái; **390**: nút nổi mở tờ trượt, ô tìm dính đầu, chọn bài → tờ đóng và sang bài.
- Ba trạng thái: lớp 0 bài → "Lớp chưa có bài học nào"; chặn `/api/courses/<id>` → lỗi + "Thử lại"; trễ → khung xương.
- Mọi hàng/nút ≥44px (hàng chương, hàng bài, ô tìm, Mở hết, Thu hết); không tràn ngang ở 320; tên bài dài 200 ký tự xuống dòng, không tràn.

### Bài có sẵn phải sửa kỳ vọng (có chủ đích) / chạy lại
- `ui-student-shell.ts`: thêm "Trang chủ" vào danh sách module (1 liên kết, không `aria-current`), giữ "chỉ 4 ô" ở 320/390; mục "bảng Khác" đếm link: 5 ở 1280, 6 ở 390. Ghi chú đầu tệp cập nhật 09/11.
- `ui-sidebar-rong.ts`: nhóm đầu `Trang chủ|Việc của tôi|Lịch học|Lớp của tôi`.
- `ui-home-signed-in.ts`: thêm "Lớp của tôi" trong Navbar của học sinh (đúng 1 liên kết); menu tài khoản vẫn 4 mục + Đăng xuất; khối "Lớp của tôi" có trong trang của học sinh.
- Chạy lại: `ui-role-everything`, `ui-shell-everywhere`, `ui-sidebar`, `ui-lop-nhieu-lop`, `ui-journey-new-student`, `ui-kin-site`, `ui-cong-dong`, `t-host-routing-lib`, `t-landing-lib`, `t-rail-lib`, `t-no-fabricated`, `t-no-hex`, `t-links`.

**Xong khi:** `tsc` 0 lỗi; bốn bài `t-*` mới xanh; `ui-home-doors`, `ui-lop-outline` xanh; các bài có sẵn không đỏ mới; ảnh chụp 1280 + 390 của Trang chủ (khách, học sinh, ba trạng thái từng khối), Lớp của tôi (cây mở hết/thu hết/tìm), thanh bên bài giảng; chủ duyệt riêng hình vì bố cục chưa có Figma đã duyệt.

---

## 9. Cờ và câu hỏi cho chủ

**Cờ**
- **TRẺ EM — trình bày + hành vi.** Feed chỉ tên rút gọn; Phụ lục A (bài nộp của học sinh) là dữ liệu do học sinh sinh ra: không làm trước khi chủ trả lời. Luật phòng: không thu thêm dữ liệu cá nhân; người học ≥17 tuổi (quyết định 25/10) nhưng cổng ≥17 vẫn tắt (`KIN_ENROLL_CONSENT_GATE`, CHỦ-02).
- **Phát hiện ngoài phạm vi (P2, TRẺ EM)**: luồng nộp tệp hiện hành lỏng (mục 1.6) — nhận mọi loại tệp, kể cả ảnh, lên Cloudinary không ký (URL công khai), máy chủ tin chuỗi `fileUrl`. Ghi vào `diem-yeu` / backlog; **không sửa trong phiếu này.**
- **TIỀN = không.** Không đụng Coin/học phí/điểm. Không thêm chữ xu/Coin.
- **ĐỔI NỀN = không** cho phần làm ngay. = **có** nếu chọn Blob/S3 cho bài nộp (Phụ lục A).
- Lệch Figma có chủ đích: Navbar học sinh 5 mục (Figma 146:2 là 4).

**Câu hỏi** (mặc định đề xuất để chạy được nếu chủ chưa trả lời)
1. Navbar của học sinh thêm "Lớp của tôi" (lệch Figma 146:2 "4 mục như nhau")? *(mặc định: có)*
2. Logo trên thanh bên học sinh về **Trang chủ "/"** thay vì "Việc của tôi"? *(mặc định: có; "Việc của tôi" đã là mục đầu)*
3. Hero gọn lại: có muốn **bỏ** khối số đếm "Học sinh đang học / Đề thi thử / Gia sư" và 4 thẻ "ĐANG MỞ LUYỆN THI" để nhường chỗ cho bảng tin? *(mặc định: giữ cả hai, chỉ giảm lề; số đếm vẫn ẩn khi bằng 0)*
4. "Tính điểm thi của mình" nghĩa là **tính điểm xét tuyển** (công cụ `TinhDiemChuan` đã có) hay **tính điểm tổng kết các môn** (chưa có)? *(mặc định: điểm xét tuyển)*
5. Công thức tính điểm trên trang chủ làm mới theo giờ (trễ ≤1 giờ sau khi quản trị công khai); chấp nhận? *(mặc định: có; nếu không, để thẻ dẫn sang `/diem-chuan` thay vì nhúng)*
6. **Quiz của gia sư trên cộng đồng**: có làm không? Làm thì chọn cách: (a) gia sư đăng bài kèm quiz của mình (cột `Thread.examId`, mục 3a); (b) chỉ liệt kê quiz gia sư đã chọn "công khai"; (c) không làm. Ai được làm quiz (khách, học sinh ngoài lớp, chỉ học sinh trong lớp)? Điểm của khách có lưu và có lên bảng xếp hạng không (liên quan STU-001, điểm yếu P1 "dò đáp án rồi thi lại")? *(mặc định: chưa làm; khối ẩn sau `KIN_HOME_QUIZ`)*
7. Bảng tin trang chủ chỉ hiện bài **chung** cho cả học sinh trong lớp, đúng không? *(mặc định: có)*
8. Mục đang học trên cây: mở sẵn chương đang học và thu các chương còn lại; nhớ trạng thái mở/thu theo lớp giữa các lần vào (lưu trình duyệt)? *(mặc định: không nhớ, chỉ mở chương đang học)*
9. Phụ lục A (nộp bài bằng tệp): các câu hỏi A.5 — **cần chủ trả lời trước khi viết một dòng mã lưu tệp.**
10. Có muốn gỡ/siết luồng nộp tệp **hiện hành** (mục 1.6) ngay, tách khỏi tính năng mới, vì đang nhận ảnh? *(đề xuất: có, đưa vào backlog P2, chờ chủ)*

---

## 10. Tệp chung cần xin COO (mục D của `BAN-GIAO.md`)

| Tệp | Dòng | Đổi gì | Ai sửa đề xuất | Phòng bị ảnh hưởng |
|---|---|---|---|---|
| `src/components/student/StudentShell.tsx` | `:1-5` (chú thích đầu), `:77` (thêm module `trang-chu` đầu mảng), `:87-90` (không đổi, `wide` tự hưởng), `:95` (`home` → `"/"`, nhãn "KiN — Trang chủ"), `:109-111` (liên kết `data-top-home` khi `useRail() === "thu"`; import `useRail` từ `./kin/shell/railStore`), `:110` (logo điện thoại `href="/"`, `min-h-11 min-w-11`), `:124` (truyền `homeLink` cho `MorePanel`) | `stu-dev`, **một người sửa một lúc**; phải chạy `ui-role-everything` (`PHAM-VI.md`) | Gia sư/Quản trị: `LopCuaToiFrame`/`GuestChrome` cùng dùng vỏ này. Gia sư dùng `TutorShell`, **không đổi** |
| `src/components/kin/shell/ShellIcon.tsx` | thêm khoá `nha` vào bảng `P` (sau `viec`, `:7`) — khoá lạ hiện rơi về `viec` (`:34`) | `stu-dev` hoặc COO | Mọi vỏ (gia sư, quản trị) — chỉ THÊM, không đổi khoá có sẵn |
| `src/components/kin/shell/ModuleRail.tsx` | **Không đổi.** Đã đủ: `desktopOnly` không `onClick` không lên thanh dưới (`:242`); `home` đã nhận href/nhãn (`:81`, `:197-203`) | — | — |
| `src/components/AuthGuard.tsx`, `src/lib/tutorGate.ts`, `src/lib/signedInShell.ts`, `src/lib/shellHint.ts`, `src/lib/landing.ts`, `src/lib/hostRouting.ts` | **Không đổi** (mục 1.1) | — | — |
| `src/components/Navbar.tsx` | `:13-18`, `:73-89`, `:176-186`: mục "Lớp của tôi" theo `homeNavFor` | `stu-dev` (HOME-01 đã giao Navbar cho stu-dev) | Mọi trang có Navbar |
| `prisma/schema.prisma` | **Không đổi** trong phiếu này | — | — |
| `tools/local-e2e/README.md` | ghi tên 6 bài mới | COO | — |
| `docs/kin/phong-ban/SO-VIEC.md` | ghi mã việc | COO | — |

Không đụng: `kin-tokens.css`, `kin-site.css`, `layout.tsx`, `(student)/layout.tsx`, `notify.ts`.

---

## Phụ lục A — NỘP BÀI BẰNG TỆP (kéo thả .docx): CHƯA LÀM — chờ chủ

Trạng thái: **chỉ đặc tả + thiết kế khung màn. Không schema, không API, không mã lưu tệp, không cách "tạm".** Đây là dữ liệu do học sinh sinh ra (cờ TRẺ EM) và đổi hạ tầng lưu tệp (ĐỔI NỀN) nếu chọn Blob/S3.

### A.1 Hiện trạng (để chủ quyết trên sự thật)
Mục 1.6. Thêm: kho tệp riêng tư có kiểm quyền và kiểm byte đầu đã có cho gia sư (`FileAsset`, `document/init`, `fileSniff.ts`, `mediaStorage.ts:106-110` — `DOCUMENT_MAX_MB = 25`, danh sách đuôi gồm cả `png/jpg/jpeg/webp`) nhưng **chưa dành cho học sinh** và chưa có quét mã độc.

### A.2 Màn hình đề xuất (nằm trong thẻ bài tập của trang bài giảng; một nút đặc mỗi màn)
- **Vùng thả tệp** (nét đứt `--kin-vien-o-nhap`, nền `--kin-nen-bang`, bo `--kin-bo-xl`, cao tối thiểu 160px ở 1280 / 132px ở 390): chữ "Kéo tệp Word vào đây, hoặc bấm để chọn tệp" · dòng nhỏ "Chỉ nhận tệp .docx, tối đa {X} MB, {N} tệp." (X, N chờ chủ).
- **Danh sách tệp đã chọn** (mỗi hàng ≥56px): biểu tượng tệp, tên tệp (cắt giữa nếu dài, đủ dài trong `title`), dung lượng "182 KB", trạng thái bằng CHỮ ("Sẵn sàng nộp" / "Đang kiểm tra" / "Không dùng được: …"), nút "Bỏ tệp" 44px.
- **Nút** "Nộp bài" (đặc, chỉ bật khi ≥1 tệp hợp lệ), "Chọn lại" (viền).
- Bốn trạng thái bắt buộc + lỗi:
  1. **Trống**: chỉ vùng thả + câu hướng dẫn; nút "Nộp bài" tắt.
  2. **Đã chọn**: danh sách + nút bật.
  3. **Đang nộp**: thanh tiến độ `role="progressbar"` + "Đang tải lên… 60%", mọi nút tắt, `aria-busy`.
  4. **Đã nộp**: dải "Đã nộp lúc 20:41 ngày 09/11/2026. Gia sư sẽ chấm và nhận xét." + "Nộp lại bài" (viền); nếu đã chấm: điểm/nhận xét hiện như `AssignmentCard`, nộp lại hỏi xác nhận xoá điểm cũ (hành vi có sẵn).
  5. **Lỗi** (có chữ + cách làm tiếp, không chỉ màu đỏ): "Tệp này không phải Word (.docx). Hãy lưu bài ở định dạng .docx rồi chọn lại." · "Tệp lớn hơn {X} MB. Hãy nén ảnh trong bài hoặc chia nhỏ tệp." · "Không nộp được. Kiểm tra mạng rồi bấm Thử lại." (nút "Thử lại" 44px) · "Tính năng nộp tệp chưa bật." (khi cấu hình thiếu).
- Mốc giờ "Hạn", "Đã nộp lúc" lấy từ máy chủ.

### A.3 Mô hình dữ liệu ĐỀ XUẤT (chưa tạo)
Hai phương án, chủ chọn:
- **P1 — dùng lại kho riêng tư của gia sư**: `FileAsset` thêm `kind="submission"` (chuỗi, không đổi enum) + cột nullable `assignmentId String?`, `sha256 String?`, `scanStatus String?` ("pending"|"clean"|"rejected"); `ownerId` = học sinh; quyền đọc = chính học sinh + gia sư chủ lớp (+ đồng giảng nếu chủ cho). `AssignmentSubmission.fileUrl` giữ `kinFileLink(<assetId>)`.
- **P2 — bảng riêng** `SubmissionFile(id, assignmentId, userId, version Int, storageKey, driver, originalName, mimeType, bytes, sha256, scanStatus, createdAt, deletedAt?)` với `@@unique([assignmentId, userId, version])`, để giữ **nhiều phiên bản** (hiện nộp lại GHI ĐÈ, mất bản cũ — `submit/route.ts` `upsert`).
Cả hai: chỉ THÊM; hàng cũ không đổi; `t-db-push-guard` không cảnh báo mất dữ liệu.

### A.4 Hợp đồng API ĐỀ XUẤT (chưa tạo)
- Bước 1 (JS, **không đổi trạng thái bài nộp**): `POST /api/student/nop-bai/<assignmentId>/init` `{ fileName, size, mimeType }` → kiểm vai học sinh, ghi danh còn hiệu lực, bài thuộc mục `published` (`isLearnerVisible`), đuôi **chỉ `.docx`**, dung lượng ≤ X, hạn mức N tệp/bài → `{ assetId, upload }` (chỉ dẫn tải riêng tư, không công khai).
- Tải byte lên kho riêng tư (PUT, không qua Cloudinary preset không ký).
- Bước 2 (**biểu mẫu POST + 303**, đổi trạng thái): `POST /api/student/nop-bai/<assignmentId>/nop` → kiểm lại **byte đầu** (gói OOXML: ZIP có `[Content_Types].xml` và `word/document.xml`; mở rộng `fileSniff.ts`), dung lượng thật, quét mã độc (chờ chủ: dịch vụ nào), băm; hợp lệ → ghi bài nộp + 303 về `/student/bai-giang/<id>?nop=ok`; sai → 303 `?nop=loi-dinh-dang|loi-dung-luong|loi-quet`, **xoá tệp**. Không bao giờ nhận `fileUrl` do trình duyệt gửi.
- **Trường KHÔNG được trả** cho người đang làm bài/nộp bài: đường dẫn kho (`storageKey`), `sha256`, `scanStatus` chi tiết, bài nộp của bất kỳ học sinh nào khác, nhận xét/điểm chưa công bố.
- Idempotent: nộp trùng (bấm đúp) → một bài; cùng `sha256` nộp lại không tạo phiên bản mới.

### A.5 Câu hỏi cụ thể cho chủ (mặc định đề xuất)
1. **Lưu bao lâu và ai xoá?** *(đề xuất: giữ tới hết khoá + 6 tháng; sau đó tự xoá bằng cron; học sinh xoá được bài của mình trước khi gia sư chấm)*
2. **Ai xem được?** Chỉ gia sư chủ lớp? Có đồng giảng? Có phụ huynh đã liên kết? *(đề xuất: học sinh + gia sư chủ lớp + đồng giảng của lớp đó; phụ huynh KHÔNG)*
3. **Giới hạn**: dung lượng mỗi tệp và số tệp mỗi bài? *(đề xuất: 10 MB, 1 tệp)*
4. **Chỉ Word?** Cấm ảnh khuôn mặt/ảnh chứa người bằng cách chỉ nhận `.docx` (và `.pdf`?) và **không** nhận ảnh ở mọi đường; tệp Word có ảnh nhúng thì sao (không kiểm được nội dung ảnh)? *(đề xuất: chỉ `.docx`; chặn nếu gói chứa `word/media/` quá X MB hoặc quá N ảnh; ghi rõ trên màn "đừng đưa ảnh có mặt người vào bài")*
5. **Lưu ở đâu?** Giữ Cloudinary raw `authenticated` + đĩa cục bộ như tài liệu gia sư (không đổi nền), hay Vercel Blob / S3 (ĐỔI NỀN, chi phí, biến môi trường mới)? *(đề xuất: không đổi nền, dùng lại cơ chế đang có)*
6. **Học sinh có xoá được bài đã nộp không?** Trước hay sau khi chấm? *(đề xuất: xoá trước khi chấm; sau khi chấm chỉ nộp lại)*
7. **Nộp lại / nhiều phiên bản?** Giữ bản cũ để gia sư so sánh, hay ghi đè như hiện nay? *(đề xuất: giữ tối đa 3 bản, bản mới nhất là bản được chấm)*
8. **Nội dung bài văn có thông tin cá nhân** (tên, trường, SĐT): có cảnh báo trước khi nộp? Có quét SĐT/email trong tệp (khó với .docx)? *(đề xuất: chỉ cảnh báo bằng chữ, không quét nội dung)*
9. **Quét mã độc** bằng dịch vụ nào (chi phí, bên thứ ba)? *(đề xuất: chỉ kiểm cấu trúc OOXML + chặn macro `vbaProject.bin`; không bên thứ ba)*
10. **Luồng cũ** (mục 1.6): tắt ngay đường nhận ảnh/tệp bất kỳ, hay giữ tới khi luồng mới xong?

---

## Phụ lục B — BẢN VẼ TÁCH KHỐI để dựng Figma (1280 và 390)

Chung: token `--kin-*` ở `src/app/kin-tokens.css` + `kin-site.css` (xem `docs/kin/tokens`), không mã hex. Vùng bấm ≥44px. Chữ nền sáng `--kin-chu-chinh`, phụ `--kin-chu-phu`, mờ `--kin-chu-mo`; nền trang `--kin-nen-trang`, băng `--kin-nen-bang`, nhãn/nhấn nhạt `--kin-nen-nhan`; viền `--kin-vien-thuong` (đậm) / `--kin-vien-nhat`; nút đặc `--kin-nhan-nen` chữ `--kin-nhan-chu-tren-nen`; liên kết `--kin-nhan-link`; trạng thái `--kin-tt-*` (xong / chờ / lỗi); lề `--kin-kc-1…9` (4, 6, 8, 10, 12, 14, 18, 24, 32px); bo `--kin-bo-sm/md/lg/xl/the` (8, 9, 10, 12, 14px); cỡ chữ `--kin-co-display/h1/h2/h3/h4/body/tieu-de/goc/small/caption`. Số đo cột bảng tin theo `community.css` (trái 220, giữa 540–560, phải 280–300; thẻ lưới 48 | 1fr, avatar 36).

### B.1 Trang chủ — KHÁCH

**1280** (nội dung tối đa 1440, lề ngang `--kin-kc-9`)
| # | Khối | Mô tả | Token |
|---|---|---|---|
| 1 | Thanh trên (cao 60) | Logo KiN · Lớp học · Thi thử · Cộng đồng · Tin tức · [Đăng nhập] [Đăng ký] | nền `--kin-nen-trang`, viền dưới `--kin-vien-thuong`; nút cao 44, `--kin-bo-md` |
| 2 | Hero gọn (cao ≤440) | Nền `--kin-nhan-nen`. Trái: nhãn pill "KiN · Luyện thi ĐGNL, THPT & BCA cùng gia sư thật"; h1 2 dòng "Học cùng gia sư thật, / theo lớp và theo lịch" (`--kin-co-display`, trắng); đoạn dẫn 2 dòng; hai nút cao 48: "Xem lớp học" (nền trắng) · "Thi thử miễn phí" (viền trắng). Phải: nhãn "ĐANG MỞ LUYỆN THI" + lưới 2×2 bốn thẻ (ĐGNL HSA, ĐGNL HCM, Tốt nghiệp THPT, BCA) + dải số đếm 3 ô | `--kin-nhan-nen`, chữ trắng độ đục ≥0,65 (đạt 4,5:1) |
| 3 | Bảng tin — đầu khối | Tiêu đề h2 "Cộng đồng đang nói gì" (`--kin-co-h2`); phụ "Bài mới nhất từ gia sư và các bạn. Xem tự do, không cần tài khoản."; liên kết phải "Xem tất cả bài viết →" cao 44 | nền `--kin-nen-trang`, lề dọc `--kin-kc-9` |
| 4 | Bảng tin — thân | Cột trái 600px: 5 thẻ bài (lưới 48 \| 1fr; avatar chữ cái 36; tên rút gọn + thẻ "Gia sư"; "2 giờ trước"; nhãn chủ đề; nội dung ≤4 dòng + "Xem thêm"; hàng Thích · Bình luận · Lưu · Báo cáo cao 36 ở chuột/44 ở cảm ứng; kẻ 1px dưới, không viền quanh, không bóng) | thẻ theo `community.css`; kẻ `--kin-vien-nhat` |
| 5 | Quiz (cờ tắt: không vẽ) | Cột phải 360px: h3 "Quiz từ gia sư"; phụ "Làm thử vài câu để biết mình đang ở đâu."; 3 hàng quiz: tiêu đề, "Cô Lan · 20 câu · 30 phút", nút viền "Làm quiz"; rỗng: "Chưa có quiz nào được đăng." | khung `--kin-nen-bang`, bo `--kin-bo-the` |
| 6 | Tính điểm thi | Dải 760px canh giữa, nền `--kin-nen-trang`, viền `--kin-vien-thuong`, bo `--kin-bo-xl`, đệm `--kin-kc-8`: h2 "Tính điểm xét tuyển"; dòng cam (`--kin-tt-chu-cho`) "Chỉ mang tính tham khảo. KiN không lưu điểm bạn nhập."; ô chọn công thức; "Cách tính: …"; "Nguồn: … ↗"; lưới ô nhập 2 cột (ví dụ "Toán (0 – 10)", "Ngữ văn (0 – 10)", "Điểm ưu tiên (không bắt buộc)"); nút đặc "Tính điểm" + nút viền "Xoá nhập"; kết quả khung `--kin-nen-nhan`: "Điểm tính được (tham khảo)" số lớn `--kin-co-h1` "24,50 / 30" | trạng thái lỗi từng ô `--kin-tt-chu-loi` |
| 7 | "Học ở đây thì được gì?" rút gọn | Nền `--kin-nen-bang`, lề dọc 40; 4 thẻ một hàng (icon 38px, tiêu đề, mô tả) | như cũ |
| 8 | "Đang tìm gia sư?" | Giữa, 760px, nút "Tìm gia sư" cao 48; "Bạn là gia sư? Đăng ký gia sư" | như cũ |
| 9 | CTA cuối (chỉ khách) | Thẻ navy 760px, bo 20px: tiêu đề + mô tả + hai nút | `--kin-nhan-nen` |
| 10 | Chân trang | không đổi | |

**390**: Thanh trên (logo + nút menu 44). Hero một cột: pill, h1 `clamp(28px,7.5vw,…)`, đoạn dẫn, hai nút xếp dọc full-width cao 48, rồi lưới 2×2 bốn thẻ, rồi số đếm. Bảng tin: tiêu đề + liên kết "Xem tất cả bài viết →" (xuống dòng dưới tiêu đề), 5 thẻ một cột (cột đường 48, avatar 36, hàng hành động 44). Quiz (nếu bật) xếp dưới bảng tin. Tính điểm: ô nhập một cột; nút "Tính điểm" full-width 48. Các khối còn lại một cột. Không tràn ngang ở 320.

### B.2 Trang chủ — HỌC SINH
Khác khách đúng 3 chỗ:
- **Thanh trên**: thêm mục "Lớp của tôi" (cuối dãy), nút "Vào trang của tôi" (nền đặc, cao 44), chuông, số dư xu hiện có (không đổi), tên rút gọn + mũi tên (menu: Thông tin cá nhân, Khoá học của tôi, Lịch học, Lớp đang theo dõi, Đăng xuất).
- **Khối "Lớp của tôi"** ngay dưới Hero (1280: nền `--kin-nen-bang`, lề dọc 40, khung 1120): hàng đầu: h2 "Lớp của tôi" + phụ "Tiếp tục học từ chỗ bạn đã dừng." + nút đặc "Vào Lớp của tôi" (phải, cao 48). Dưới: bảng các lớp (tối đa 3 hàng, mỗi hàng ≥64): tên lớp (`--kin-co-tieu-de`), "Gia sư: Cô Hạnh · Toán", trạng thái "12/40 bài đã hoàn thành" (`--kin-chu-mo`), đuôi "Vào lớp →" (`--kin-nhan-link`); quá 3 lớp: liên kết "Xem tất cả 5 lớp →". Rỗng/lỗi/đang tải: bảng ở mục 5.1. **390**: bảng một cột, nút đặc full-width 48 nằm dưới tiêu đề.
- **CTA cuối** ẩn.

### B.3 Lớp của tôi — chương xổ ra/thu vào + tìm nhanh + thanh bên thụt
**1280** (trong vỏ học sinh: thanh bên 272, vùng nội dung 1008, lề ngang 40)
| # | Khối | Mô tả | Token |
|---|---|---|---|
| 1 | Đầu trang | "← Tất cả lớp" (khi ≥2 lớp, cao 44) · h1 "Lớp của tôi" `--kin-co-h2` · phụ "Toán 9 · Cô Lan" | |
| 2 | Lưới 2 cột | `[ minmax(0,1fr) | 354px ]`, khe 32 | |
| 3 | Thẻ lớp (cột trái) | Nền `--kin-nen-nhan`, bo `--kin-bo-sm`, đệm 24: tên lớp `--kin-co-tieu-de`; "12/40 bài đã hoàn thành"; thanh tiến độ cao 6; "Tiếp theo: Bài 13 — Hàm số bậc hai"; nút đặc "Tiếp tục học"; liên kết "Tài liệu & bản ghi của lớp này →" | |
| 4 | Tab | Tổng quan · Tài liệu & bản ghi · 3 · Bài tập · 5 | `KinTabs` |
| 5 | Thanh công cụ (chỉ tab Tổng quan) | Một hàng: ô tìm (co giãn, cao 44, có biểu tượng kính lúp, nhãn "Tìm bài trong lớp", gợi ý "Gõ tên bài hoặc tên chương") · nút viền "Mở hết" · nút viền "Thu hết" (cao 44) | ô `KIN_FIELD`; nút `kinButtonClass("secondary")` |
| 6 | Dòng kết quả | `role=status`, `--kin-chu-mo`: "Tìm thấy 3 bài trong 2 chương." (chỉ khi đang lọc) | |
| 7 | Cây — hàng PHẦN (chỉ khi >1 phần) | Cao ≥48, nền `--kin-nen-bang`, thụt 0; trái: tiêu đề "Phần 1 · Đại số" (đậm, `--kin-co-goc`); phải: "7/20 bài" + mũi tên | |
| 8 | Cây — hàng CHƯƠNG | Cao ≥44, nền trắng, thụt `--kin-kc-8` (24); mũi tên xoay 180° khi mở (trái), tiêu đề chương, phải "3/8 bài" hoặc dấu "Đã xong" (`--kin-tt-chu-xong`); viền dưới `--kin-vien-nhat`; mở/thu mượt (`KinFold`) | |
| 9 | Cây — hàng BÀI | Cao ≥52, thụt `--kin-kc-8 × 2` (48); lưới 3 cột "tên bài 1,6fr \| 'Bài tập · 15 phút' 1fr \| trạng thái 1fr"; trạng thái: "Đã học" (xong) / "Học tiếp" (chờ) / "Chưa học" / "Đã khoá"; bài đang học: nền `--kin-nen-nhan` + vạch trái 3px `--kin-nhan-nen` | |
| 10 | Cột phải 354 | "Các lớp của bạn" (khi ≥2) · "Tự học" · "Đang chờ duyệt" · "Tham gia lớp khác" · "Buổi học sắp tới" · "Thông tin lớp" | như hiện có |

**Thanh bên bài giảng** (`/student/bai-giang/<id>`, từ 1280): cột trái 268 sát vỏ học sinh, nút thu `‹ ›` 16×48 ở mép phải. Đầu: "← Khóa học" · tên lớp (2 dòng) · thanh tiến độ + "12/40". Dưới: ô tìm (cao 44, full-width trừ đệm 12) · hàng hai nút "Mở hết" "Thu hết" (mỗi nút cao 44, rộng bằng nhau). Cây: PHẦN (chữ nhỏ hoa, nền `--kin-nen-bang`) → CHƯƠNG (thụt 16, "1. Hàm số · 3/8") → BÀI (thụt 32, vòng tròn 18px: rỗng/xong/đang xem/khoá; tên bài 2 dòng; nhãn loại; "Đang xem"/"Đã xong"/"FREE").
**390**: Trang lớp một cột: thẻ lớp → tab → thanh công cụ xếp dọc (ô tìm full-width 44; hàng hai nút chia đôi 44) → cây thụt `--kin-kc-5/--kin-kc-7` (12/18px) thay vì 24/48, hàng bài hai dòng (tên · "Bài tập · 15 phút · Đã học"); tờ trượt "Nội dung khóa học" ở trang bài giảng (cao 75vh, đầu tờ có ô tìm + hai nút, nút ✕ Đóng 44).
Trạng thái cần vẽ: cây mở hết · cây thu hết · đang lọc (có kết quả) · lọc không khớp · đang tải (khung xương 4 hàng) · lỗi tải (dải lỗi + Thử lại) · lớp rỗng.

### B.4 Nộp bài bằng tệp (chỉ khung màn; chưa có mã)
**1280** (trong trang bài giảng, cột nội dung ~740px): thẻ nền `--kin-nen-bang`, viền `--kin-vien-thuong`, bo `--kin-bo-xl`, đệm 24. Đầu thẻ: tên bài tập (`--kin-co-tieu-de`), hướng dẫn của gia sư (`--kin-chu-mo`), "Hạn 12/11/2026 21:00" (`--kin-tt-chu-loi` nếu quá hạn); liên kết tải đề bài. Thân: vùng thả (cao 160, nét đứt `--kin-vien-o-nhap`, biểu tượng tệp 32px, chữ "Kéo tệp Word vào đây, hoặc bấm để chọn tệp", dòng nhỏ "Chỉ nhận tệp .docx, tối đa 10 MB."). Dưới: danh sách tệp (hàng 56). Chân thẻ: nút đặc "Nộp bài" (phải) + nút viền "Chọn lại".
Bốn trạng thái vẽ riêng: **(1) Trống** (vùng thả, nút Nộp tắt) · **(2) Đã chọn** (hàng "bai-van-lan-1.docx · 182 KB · Sẵn sàng nộp" + "Bỏ tệp", viền vùng thả chuyển `--kin-nhan-nen`) · **(3) Đang nộp** (thanh tiến độ cao 8 + "Đang tải lên… 60%", mọi nút tắt) · **(4) Đã nộp** (dải `--kin-tt-nen-xong` "Đã nộp lúc 20:41 ngày 09/11/2026. Gia sư sẽ chấm và nhận xét." + "Nộp lại bài"). Biến thể **Lỗi**: dải `--kin-tt-nen-loi` + biểu tượng + chữ (ví dụ "Tệp này không phải Word (.docx). Hãy lưu bài ở định dạng .docx rồi chọn lại.") + "Chọn lại"/"Thử lại".
**390**: vùng thả cao 132, chữ giữ nguyên, nút "Chọn tệp" full-width 48 nằm trong vùng thả (điện thoại không kéo thả được); nút "Nộp bài" full-width 48 dính đáy thẻ; danh sách tệp hàng 56 tên tệp cắt giữa.

---

## Thứ tự làm đề xuất
0. stu-code: `homeLayout.ts`, `lessonOutline.ts` + hai bài thuần xanh (không cần DB).
1. **Làm ngay, độc lập, giá trị cao nhất**: cửa về Trang chủ (mục 1.3) — xin COO sửa `StudentShell.tsx`/`ShellIcon.tsx`; stu-dev `MorePanel`; stu-test sửa 2 bài + `ui-home-doors`. Phát hành riêng một PR.
2. Trang chủ: `Navbar` + `HomeMyClass` + `HomeCommunity` + `HomeScore` (+ `useFeed.limit`). `HomeQuiz` dựng nhưng ẩn.
3. `CourseOutline` + trang lớp + thanh bên bài giảng + `ui-lop-outline`.
4. **Chờ chủ**: Quiz (câu 6), Phụ lục A (câu 9–10).
