# Học sinh: Trang chủ, Lịch học, Lớp của tôi

Gói ba màn của vai học sinh, viết cho nhà thiết kế không đọc được mã. Mọi chữ, tên trường dữ liệu và con số lấy từ mã nguồn và bài test trong kho `midnight-elite` (đọc ngày 22/10/2026). Chỗ nào là ĐỀ XUẤT mới (chưa có trong mã) đều ghi rõ chữ "ĐỀ XUẤT" hoặc "[mới]"; chỗ chưa chắc nằm ở mục 12 của từng màn. Bản này đã được kiểm chứng lại độc lập với mã và các bài test (đọc mã và test, không chạy ứng dụng nên các lỗi ở mục 9 vẫn là "đọc từ mã"); 17 ảnh tham khảo ở mục 10 đã được mở xem lại, chỗ mô tả lệch ảnh đã sửa.

| Màn | Route | Tệp mã chính | Vai |
|---|---|---|---|
| A. Trang chủ ("Việc của tôi") | `/student/viec-cua-toi` (`/student` tự chuyển về đây) | `src/components/student/ViecCuaToi.tsx`; luật ở `src/lib/studentTodo.ts`; đọc dữ liệu `src/lib/studentTodoServer.ts`; API `src/app/api/student/viec-cua-toi/route.ts`; phụ: Ví Coin `src/app/(student)/student/vi/page.tsx`, chip Coin `src/components/CoinBalance.tsx` | Học sinh (role `student`). Quản trị xem thử cũng vào được (`AuthGuard`). |
| B. Lịch học | `/student/lich-hoc` | `src/app/(student)/student/lich-hoc/page.tsx`; dữ liệu `src/lib/studentSchedule.ts`; API `src/app/api/schedule/route.ts` | Học sinh |
| C. Lớp của tôi | `/lop-cua-toi` (danh sách), `/lop-cua-toi/[courseId]` (một lớp), `/student/hoc-tap?course=<mã lớp>` (đường học của một lớp), `/student/nhap-ma-lop` (vào lớp bằng mã) | `src/app/lop-cua-toi/(tutor)/page.tsx` (nhánh học sinh), `src/app/lop-cua-toi/[courseId]/page.tsx` + `OutlookShell.tsx`, `src/app/(student)/student/hoc-tap/page.tsx`, `src/app/(student)/student/nhap-ma-lop/page.tsx`, `src/components/student/InviteCodeInput.tsx` | Học sinh |

## Phần chung cho cả ba màn (vỏ học sinh)

Đọc phần này một lần; các màn bên dưới chỉ nhắc lại chỗ riêng.

**P1. Vỏ.** Tệp: `src/components/student/StudentShell.tsx`, bọc bởi `src/app/(student)/layout.tsx` (Trang chủ, Lịch, Học tập, Nhập mã) và `src/components/shell/StudentFrame.tsx` (cho `/lop-cua-toi/*`, vì hai trang này nằm ngoài `/student/*`). Vỏ kiểu Outlook, theo Figma 11:98.
- Máy tính: thanh module dọc bên trái rộng 79px (thu được về 0px, mở rộng ra 220px có nhãn cạnh biểu tượng). Điện thoại: thanh dưới cao 60px, luôn hiện, 5 nút.
- Năm nút theo thứ tự: **Việc của tôi** (`/student/viec-cua-toi`, có badge đỏ đếm việc cần ra tay), **Lịch** (`/student/lich-hoc`), **Lớp** (`/student/hoc-tap`; cũng sáng khi đang ở `/student/bai-giang`, `/student/nhap-ma-lop`, `/lop-cua-toi`), **Thư viện** (`/thu-vien`), **Khác** (nút mở bảng).
- Nhãn vai trên thanh dọc: "HỌC SINH". `aria-label` thanh: "Module của học sinh".
- Dải trên cao 48px: trái nút "Mở thanh bên" (chỉ khi thanh đang thu, máy tính) + logo KiN (liên kết "KiN — Việc của tôi"); phải: chip Coin (hiện tại: emoji 🪙 + số, KHÔNG có chữ "Coin", không bấm được), chuông "Thông báo" (nút 36px, huy hiệu hiện "9+" khi trên 9), menu tài khoản (avatar chữ cái đầu; tên chỉ hiện từ máy tính, điện thoại chỉ có avatar; menu có "Hồ sơ", "Học phí", "Chủ đề màu", "Đăng xuất").
- Phía TRÊN dải 48px có thể có dải cam "Email chưa được xác thực" + "Kiểm tra hộp thư {email} và bấm link xác thực" (nút "Gửi lại email" → "Đang gửi..." → "✓ Đã gửi lại!") khi email chưa xác thực; đóng được bằng nút ✕ (`VerifyEmailBanner`; dùng emoji ⚠️, nút ✕ 24px, nút gửi lại dưới 44px: xem mục 9 Màn A, điểm 10).
- Bảng "Khác" (`role=dialog`, tên "Các mục khác"): nhóm **Học tập** (Thi thử, Bảng xếp hạng, Hỏi đáp, Cộng đồng), **Khám phá** (Khoá học đang mở, Lớp đang theo dõi, Gia sư, Tin tức, Tra cứu điểm chuẩn), **Tài khoản** (Hồ sơ, Học phí, Ví và Coin, Chủ đề màu), rồi "Đăng xuất". Đầu bảng hiện tên và email người dùng.
- Phòng thi `/student/thi-thu/<mã đề>` không có vỏ (toàn màn hình). Không thiết kế lại ở gói này.

**P2. Token và cỡ chữ.** Chỉ dùng token `--kin-*` (tệp `src/app/kin-tokens.css` + `src/app/kin-site.css`). Cỡ chữ: `--kin-co-caption` 11,1px, `--kin-co-small` 13,3px, `--kin-co-body` 16px, `--kin-co-h4` 19,2px, `--kin-co-h2` 27,6px, `--kin-co-display` 39,8px. Khoảng cách `--kin-kc-1..9` = 4/6/8/10/12/14/18/24/32px. Bo góc `--kin-bo-sm` 8, `--kin-bo-the` 14, `--kin-bo-tron` 999. Chạm tối thiểu `--kin-cham-toi-thieu` 44px; dòng danh sách `--kin-cham-dong` 50px. Màu trạng thái: nền `--kin-tt-nen-xong/cho/loi`, viền `--kin-tt-vien-*`, chấm `--kin-tt-cham-xong/cho/trung-tinh`, chữ `--kin-tt-chu-xong/cho/loi`. Nhấn của chủ đề: `--kin-nhan-nen`, `--kin-nhan-link`, `--kin-nhan-nen-nhat`, `--kin-nhan-diem`. Màu lớp: `classAccent(courseId)` trong `src/lib/classColor.ts` (5 token: xanh trời, bạc hà, vàng nắng, xanh link, vàng hub).
- Vỏ học sinh theo cả chế độ Sáng và Tối và 5 chủ đề (Navy, Cổ vịt, Mận, Cà phê, Mực). Bài test `ui-theme.ts` quét chế độ Tối: `/student/viec-cua-toi` và `/student/lich-hoc` ở cả 5 chủ đề, thêm `/student/vi`, `/student/hoc-phi`, `/student/ho-so`, `/cai-dat/chu-de` ở chủ đề Navy. Quét tìm chữ có tương phản dưới 3:1 với nền thật phía sau và mảng nền gần trắng lớn hơn 4000px² (không chữ khó đọc, không mảng nền trắng): màu mới phải qua được. Bài `ui-kin-site.ts` còn kiểm ở chế độ Tối: `/student/hoc-tap`, `/student/lich-hoc`, `/student/ho-so` không còn màu xanh cũ `rgb(0, 104, 255)` ở chữ, nền, viền.
- Bộ 5 màu lớp (`classAccent`) thực tế chỉ có 4 màu phân biệt: `--kin-ph-hub` trùng đúng mã với `--kin-th-vang-nang` (sáng `#f59e0b`, tối `#fbbf24`). Ba màu xanh trời, bạc hà, vàng đo được 2,14:1, 2,54:1, 2,15:1 trên nền trắng (dưới 3:1 của chấm/viền), nên vạch màu lớp chỉ được là trang trí; tên lớp bằng chữ luôn đi kèm, không để màu một mình nói lớp nào.
- Ngữ nghĩa màu của gói thiết kế: xanh lá = xong, cam = chờ, đỏ = quá hạn/nghỉ, xanh dương = đã lên lịch. Màu không nói một mình: luôn kèm chữ (`KinStatus` = chấm 7px + chữ, chữ dùng bộ mã chữ, chấm dùng bộ mã chấm).

**P3. Thành phần dùng lại.** `KinButton` (5 kiểu: primary, secondary, ghost, danger, danger-solid; cao ≥44px; không vòng xoay, chờ thì đổi chữ), `kinButtonClass` cho thẻ `<a>`, `KinStatus`, `KinProgressRing`, `KinSwapText`, khung xương `kin-skel` (không `animate-pulse`, không spinner), `KinLoader` (logo K lúc tải toàn trang), `ListRow`/`ListHead`/`ReadHead`/`ReadBody`/`ReadSection`/`ReadEmpty`/`ErrorStrip` trong `src/components/kin/shell/Outlook.tsx`.

**P4. Quy tắc chung xem ở mục 8 từng màn; phần chữ bắt buộc của vỏ xem "P7" ở cuối mục 7 của Màn A** (mọi màn đều phải giữ).

---

# Màn A. Trang chủ học sinh ("Việc của tôi")

Route: `/student/viec-cua-toi` · Tệp mã chính: `src/components/student/ViecCuaToi.tsx` (+ vỏ `StudentShell.tsx`, Ví Coin `src/app/(student)/student/vi/page.tsx`) · Vai: học sinh.

## 1. Mục đích và người dùng
- Đây là trang đầu của học sinh sau khi đăng nhập (xác nhận trong `ui-journey-new-student.ts`: xác thực email xong đi thẳng vào đây; `src/lib/landing.ts` đưa người đã đăng nhập về đây).
- Trả lời đúng một câu: "Hôm nay mình phải làm gì và có buổi nào sắp tới?". Không phải bảng điều khiển số liệu.
- Người dùng: học sinh THCS/THPT, thường dùng điện thoại, có thể dưới 16 tuổi. Đọc nhanh, chạm một tay. Không thu thập thêm dữ liệu cá nhân ở màn này.
- Nguyên tắc nghiệp vụ trong mã (`src/lib/studentTodo.ts` đầu tệp): mỗi dòng việc phải là một hàng dữ liệu có thật (bài tập có hạn, buổi học trong lịch, hạn nộp ngoài); học sinh không tự tích việc; badge chỉ đếm việc cần học sinh ra tay.
- Giọng theo vai (`docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 7): chuyện "buổi chờ phụ huynh xác nhận" học sinh KHÔNG thấy; màn này không được hiện việc của gia sư hay phụ huynh.

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)
1. Thấy ngay việc cần làm gấp (quá hạn, sắp hết hạn, hạn trong 3 ngày).
2. Mở bài để làm hoặc nộp (nút chính trong khung đọc: "Nộp bài" hoặc "Làm bài").
3. Biết buổi học sắp tới (hôm nay đến 3 ngày tới) và vào lớp ("Vào lớp").
4. Xem bài đã nộp hoặc đã chấm (điểm, nhận xét của thầy/cô).
5. Xem chuông thông báo.
6. Chuyển sang Lịch, Lớp, Thư viện hoặc "Khác".
7. (Hiếm) Xem số Coin và lịch sử Coin ở `/student/vi`.

## 3. Dữ liệu hiển thị
Mỗi dòng việc là một `StudentTodoItem` (`src/lib/studentTodo.ts`), trả về từ `GET /api/student/viec-cua-toi` → `{ items, badge, generatedAt }`. `?badge=1` chỉ trả `{ badge }`.

| Tên hiển thị | Nguồn trong mã (tệp + trường/hàm) | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề dòng | `item.title` (`studentTodo.ts`): bài tập = `"{tên bài} {hạn}"`; đã chấm = `"Đã chấm {tên bài}"`; đã nộp = `"Đã nộp {tên bài}"`/`"Đã làm {tên bài}"`; buổi học = `"Buổi {category lớp} {HH:MM}"`; huỷ = `"Buổi đã huỷ {…} {HH:MM}"` | một dòng; hạn viết `hạn HH:MM hôm nay`/`hạn HH:MM ngày mai`/`hạn HH:MM dd/mm` | `Bài tập Phương trình bậc hai hạn 23:59 hôm nay` |
| Nhãn bên phải dòng | `item.when` ← `whenLabel()` | `Hôm nay`, `Ngày mai`, `Thứ 3`…`Thứ 7`, `Chủ nhật` (trong 6 ngày tới), còn lại `dd/mm` | `Ngày mai` |
| Dòng phụ | `item.subtitle` | bài chưa nộp: `"{tên lớp} · {giáo viên} giao dd/mm"`; đã chấm: `"{điểm}/{tổng} · {tên lớp}"`; đã nộp: `"{tên lớp} · chờ thầy/cô chấm"`; buổi học: tên lớp, kèm ` — {ghi chú}` nếu khung giờ có ghi chú (đã bỏ tiền tố `[…]`); hạn nộp ngoài: tên lớp | `Toán 9 · Cô Lan giao 20/10` |
| Trạng thái (chữ + chấm) | `item.status {label, tone}` | tone `cho` (cam), `loi` (đỏ), `mo` (xám trung tính), `xong` (xanh lá) | `Sắp hết hạn` (cho) |
| Việc cần ra tay | `item.needsAction` | boolean: quá hạn hoặc hạn ≤ 3 ngày (`ACTION_WINDOW_MS`) | `true` |
| Đã xong / chỉ để biết | `item.done` | boolean; buổi học đã huỷ cũng `done` | `false` |
| Loại việc | `item.kind` | `bai-tap`, `han-nop`, `buoi-hoc` | `bai-tap` |
| Mốc thời gian | `item.at` | ISO | `2026-10-22T16:59:00.000Z` |
| Nhóm danh sách | tính ở `ViecCuaToi.tsx` (`groupOf`): `needsAction` → "Cần làm"; `done` → "Đã xong"; còn lại → "Sắp tới" | chữ in hoa nhỏ, cách chữ rộng | `CẦN LÀM` |
| Khung đọc: tiêu đề | `item.detail.heading` | | `Bài tập Phương trình bậc hai hạn 23:59 hôm nay` |
| Khung đọc: dòng meta | `item.detail.meta` | `"{lớp} · {giáo viên} giao dd/mm · còn 7 giờ 29 phút"`; `remainingText()`: `còn 3 giờ 50 phút`, `còn 2 ngày 5 giờ`, `quá hạn 1 ngày` | `Toán 9 · Cô Lan giao 20/10 · còn 7 giờ 29 phút` |
| Khung đọc: lệnh | `item.detail.commands[]` `{label, href, kind, external?}` (tối đa 3 hiện ra) | nút `primary` hoặc `secondary`; `external` mở tab mới | `Nộp bài` → `/student/bai-giang/<lessonId>` |
| Khung đọc: đoạn chữ | `item.detail.sections[]` `{title, text}` | tiêu đề đậm + đoạn xám | `Chưa nộp lần nào` / `Nộp lại sẽ ghi đè bản cũ.` |
| Điểm | `fmtScore()` | dấu phẩy thập phân, bỏ ",0" | `8,5/10`, `18,4/25` |
| Vòng tiến độ | tính ở `ViecCuaToi.tsx`: `doneTasks` (done và không phải buổi học) / `total` (= cần ra tay + doneTasks) | `x/y`, `aria-label` "Việc đã xong: x trên y"; ẩn khi `total = 0` | `2/5` |
| Dòng phụ dưới tiêu đề danh sách | `KinSwapText` | `Bài phải nộp và buổi sắp tới` → đổi thành `Đã xong hết việc cần làm` khi `total > 0` và không còn việc cần ra tay | |
| Badge thanh module | `badge` từ API (`?badge=1`, tải lại khi cửa sổ lấy tiêu điểm) | số, `aria-label` "{n} việc cần xử lý", "99+" | `3` |
| Thẻ chờ duyệt gia sư | `useAuth().user.tutorPending` | chỉ hiện khi `true` | xem mục 6 |
| Tên người dùng (dải trên, menu) | `useAuth().user.name`, `.email`, `.avatar` (chữ cái đầu) | | `Đỗ Hà`, `Đ` |
| Số Coin (chip dải trên) | `useWallet().balance` (`GET /api/wallet`) | số nguyên (chip hiện 🪙 + số, không chữ "Coin"); hiện "+N" nổi lên 2,5 giây khi có sự kiện `coin:earned` (phát từ bài học, bài viết, câu trả lời cộng đồng; KHÔNG phát từ phòng thi, xem mục 9 điểm 8) | `58` |
| Chuông | `GET /api/notifications` mỗi 30 giây: `unreadCount`, mỗi thông báo `{id, type, title, message, link, isRead, createdAt}` | "Vừa xong", "{n} phút trước", "{n} giờ trước", "{n} ngày trước" | |
| Ví: số dư | `GET /api/wallet` → `balance` (trang `/student/vi`) | `toLocaleString("vi-VN")` + chữ "Coin" | `58 Coin` |
| Ví: giao dịch gần đây (20 dòng) | `/api/wallet` → `transactions[] {id, amount, reason, createdAt}`; nhãn từ `REASON_LABEL` trong `vi/page.tsx` | `+5` xanh lá / `-n` đỏ; ngày giờ `toLocaleString("vi-VN")` | `Thưởng hoàn thành bài học +3` |

Luật chọn việc hiện ra (để nhà thiết kế hiểu danh sách trống/đầy), hằng số ở `studentTodo.ts`: chỉ bài tập CÓ hạn; quá hạn chưa nộp ≤ 14 ngày; đã nộp/đã chấm giữ 14 ngày; buổi học từ hôm nay đến 3 ngày tới (buổi đã bắt đầu trong 2 giờ vẫn hiện); hạn nộp ngoài (Azota) trong 7 ngày; tối đa 50 dòng; thứ tự: cần ra tay (hạn sớm nhất trước) → sắp tới → đã xong (mới nhất trước). Buổi thi (`exam`) KHÔNG vào danh sách này (chỉ ở Lịch).

## 4. Bố cục đề xuất
Nguyên tắc: thoáng, ít khung, ít màu. Chỉ trạng thái mang màu; còn lại dùng chữ `--kin-chu-chinh` / `--kin-chu-mo` và đường kẻ mảnh `--kin-vien-nhat` thay cho khung thẻ. Một nút chính mỗi khung đọc. Giữ cấu trúc "danh sách + khung đọc" (bị test khoá, xem mục 7).

### 4.1 Điện thoại 390px (một cột; danh sách và khung đọc là hai trang xếp chồng)
Thanh dưới 60px (5 nút) cố định, chừa `pb-[60px]` cho nội dung.

Màn danh sách, từ trên xuống:
1. **Dải trên 48px**: logo KiN trái; phải: số Coin (ĐỀ XUẤT: chỉ chữ "58 Coin", bỏ khung, nền cam và emoji, vì cam đang mang nghĩa "chờ"; đừng thêm nút nạp), chuông (ĐỀ XUẤT nút ≥44px, hiện là 36px), avatar. Không thêm gì khác.
2. **Dải xác thực email** (chỉ khi chưa xác thực): 1 dòng chữ + nút "Gửi lại email", đóng được. Tối đa 2 dòng chữ.
3. **Thẻ chờ duyệt gia sư** (chỉ khi `tutorPending`): 1 dải, tối đa 2 dòng, nền `--kin-tt-nen-cho`.
4. **Đầu danh sách** (ĐỀ XUẤT thêm lời chào, giữ tiêu đề): dòng nhỏ "Chào buổi chiều, Đỗ Hà" (hàm `greetingForHour()` ở `src/lib/classColor.ts` + `user.name`; là thẻ `<p>`, KHÔNG phải h1 vì test cấm h1 ở màn danh sách điện thoại; trên máy tính chỉ được có ĐÚNG MỘT h1, là tiêu đề khung đọc, vì test đọc `getByRole("heading", {level: 1})` theo chế độ chặt) → tiêu đề "Việc của tôi" (h2; hiện tại 16px `--kin-co-body`, ĐỀ XUẤT 19,2px) → dòng phụ `KinSwapText` (13,3px, xám) → vòng tiến độ 44px ở bên phải (đã có). Tối đa 3 dòng, không khung.
5. **Nhóm "Cần làm"**: nhãn nhóm 11,1px in hoa xám. Mỗi dòng: dòng 1 = tiêu đề (cho phép xuống 2 dòng, KHÔNG cắt bằng "…") + nhãn `when` bên phải (chữ đơn cách); dòng 2 = dòng phụ + trạng thái (chấm + chữ) cùng một hàng (ĐỀ XUẤT: bỏ dòng thứ ba riêng cho trạng thái để mỗi việc cao ≈ 2 dòng thay vì 3). Cao tối thiểu 50px, vùng chạm cả dòng. Mỗi việc tối đa 3 dòng chữ kể cả khi tiêu đề xuống 2 dòng; không thêm biểu tượng, chip hay ảnh đại diện vào dòng. Dòng đang chọn nền `--kin-nen-dang-chon` + vạch trái 3px (đã có). Chỉ dòng "Quá hạn" mang màu đỏ ở chữ trạng thái; không tô nền cả dòng.
6. **Nhóm "Sắp tới"** (buổi học, việc hạn xa): cùng kiểu dòng, chữ trạng thái xám/xanh dương.
7. **Nhóm "Đã xong"**: dòng mờ hơn (chữ `--kin-chu-mo`), gạch ngang tiêu đề (đã có), không chấm màu (chữ trạng thái "Đã chấm"/"Đã nộp" giữ). Luôn hiện (đừng thu gọn: bài test đếm đủ số dòng; xem câu hỏi Q3 ở mục 12).
8. Khoảng cách giữa các nhóm ≥ `--kin-kc-8` (24px).

Màn khung đọc (chọn một dòng, trượt vào; `← Quay lại` ở đầu):
1. Nút `← Quay lại` (min 44px, chữ xanh link).
2. Tiêu đề (h1, 19,2px, cho phép 3 dòng) → dòng meta xám 13,3px.
3. Hàng lệnh: tối đa 2 nút (hiện có tối đa 3): nút 1 đặc `primary` (ví dụ "Nộp bài"), nút 2 viền `secondary` (ví dụ "Xem đề"). Nút rộng toàn chiều ngang khi chỉ có một nút.
4. Thân: 2–3 đoạn (`ReadSection`: tiêu đề 13,3px đậm + đoạn xám), cách nhau 12px, không khung.

### 4.2 Máy tính 1280px
Ba cột cố định (bị test khoá): thanh module 79px | danh sách 330px | khung đọc (còn lại ≈ 871px).
1. Danh sách: cùng quy tắc như điện thoại (đầu danh sách có tiêu đề + vòng tiến độ; nhóm; dòng). Mỗi khung cuộn riêng, trang không cuộn.
2. Khung đọc: nội dung căn trái, rộng tối đa ≈ 560px, lề trong 24px, để thừa khoảng trắng bên phải (thoáng). Tiêu đề 19,2px; hàng lệnh ngay dưới meta; thân bên dưới. Không dựng thêm cột thứ tư.
3. Khi danh sách trống: khung đọc hiện `ReadEmpty` ở giữa (tiêu đề đậm + 1 câu).

### 4.3 Trang Ví Coin (`/student/vi`, mở từ "Khác" → "Ví và Coin")
- Một cột, rộng tối đa 768px, căn giữa: tiêu đề "Ví Coin" (h1), 1 dòng giải thích, thẻ số dư lớn (số 39,8px + chữ "Coin"), rồi "Giao dịch Coin gần đây" (dòng nhãn trái, số phải, đường kẻ mảnh).
- Học sinh KHÔNG có form nạp, không nút mua, không ô nhập số tiền (xem mục 5 và 8).
- LƯU Ý: `/student/vi` là MỘT trang dùng chung với GIA SƯ (vai gia sư mở cùng địa chỉ này). Gia sư vẫn có hai nhánh riêng mà thiết kế không được làm mất: form "Yêu cầu nạp Coin" (khi KiN không ở chế độ chạy thử) và khung "KiN miễn phí trong giai đoạn chạy thử" kèm câu "Bạn chưa cần mua gói hay nạp Coin" (khi đang chạy thử); bài `ui-trial-mode` kiểm cả hai nhánh. Chỉ vẽ lại phần của học sinh, không đụng nhánh gia sư.
- ĐỀ XUẤT: thẻ số dư dùng nền nhẹ `--kin-nen-nhan`, không tô kín bằng màu nhấn như hiện nay (khối nền navy lớn là phần "dày" nhất trang).

## 5. Hành động
| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| Việc của tôi (nút thanh module) | Mở trang này | `/student/viec-cua-toi` | Có badge `n` + `aria-label` "n việc cần xử lý" |
| Lịch | Sang lịch tuần | `/student/lich-hoc` | |
| Lớp | Sang lớp | `/student/hoc-tap` | Xem câu hỏi Q1 (mục 12 màn C) |
| Thư viện | Sang thư viện | `/thu-vien` | Vẫn trong vỏ học sinh |
| Khác | Mở bảng "Các mục khác" | Không gọi API; `aria-expanded` bật/tắt | Esc, bấm ra ngoài, hoặc chọn mục thì đóng |
| (dòng việc) | Chọn dòng, mở khung đọc | Không điều hướng; phím ↑ ↓ Home End di chuyển, Enter/Space chọn | `role=option` trong `role=listbox` tên "Việc của tôi" |
| ← Quay lại | Điện thoại: từ khung đọc về danh sách | Không gọi API | Chỉ hiện ở điện thoại |
| Nộp bài | Mở bài giảng chứa bài tập để nộp file | `/student/bai-giang/<lessonId>` | Nộp lại ghi đè bản cũ (chữ trong khung đọc) |
| Làm bài | Làm bài trực tiếp trên web | `/student/bai-giang/<lessonId>` | Bài khoá khi hết hạn |
| Xem đề | Mở file đề (nếu có `fileUrl`) | URL file, tab mới | `external` |
| Xem bài | Xem bài đã chấm | `/student/bai-giang/<lessonId>` | |
| Xem bài đã nộp | Xem bài đã nộp (chưa chấm, bài file) | `/student/bai-giang/<lessonId>` | |
| Xem lại bài làm | Xem lại bài web đã làm | `/student/bai-giang/<lessonId>` | |
| Vào lớp | Vào lớp của buổi học | `/student/hoc-tap?course=<mã lớp>` | Không có ở buổi đã huỷ |
| Xem lịch | Mở lịch | `/student/lich-hoc` | Buổi thường và buổi dời: nút phụ (secondary) đứng sau "Vào lớp"; buổi đã huỷ: là nút DUY NHẤT (primary) |
| Mở bài | Mở bài nộp ngoài KiN (Azota) | URL ngoài, tab mới (`external` nếu bắt đầu bằng http) | KiN chỉ nhắc hạn, không biết đã nộp chưa (chữ trong khung đọc) |
| Thử lại | Tải lại danh sách khi lỗi | `GET /api/student/viec-cua-toi` | Danh sách cũ giữ nguyên bên dưới dải lỗi |
| (tự động) khi cửa sổ lấy tiêu điểm | Tải lại danh sách và badge | cùng API | Không có nút; dòng vừa chuyển sang "đã xong" chạy gạch ngang |
| Thông báo / Thông báo, N chưa đọc | Mở bảng chuông | `GET /api/notifications` (30 giây/lần) | |
| Đánh dấu đã đọc | Đánh dấu mọi thông báo đã đọc | `POST /api/notifications/read-all` (hook `useNotifications.markAllAsRead`) | Chỉ hiện khi có chưa đọc |
| (một thông báo) | Đánh dấu đã đọc, đóng bảng, đi tới `link` của thông báo | `POST /api/notifications/<id>/read` rồi `router.push(link)` | Bài test kiểm từng thông báo dẫn đúng trang |
| Tài khoản của {tên} (menu) | Mở menu | | `aria-haspopup=menu`; ↑ ↓ Home End Esc Tab |
| Hồ sơ / Học phí / Chủ đề màu | Đi tới | `/student/ho-so`, `/student/hoc-phi`, `/cai-dat/chu-de` | |
| Đăng xuất | Đăng xuất | `logout()` rồi tải cứng về `/` | |
| Thu gọn thanh bên / Mở thanh bên | Thu/mở thanh dọc (phím `[`) | Lưu `localStorage` và `User.preferences.rail` | Máy tính |
| Mở rộng thanh bên có nhãn chữ / Thu hẹp thanh bên | 79px ⇄ 220px | như trên | Máy tính, hiện khi rê chuột vào thanh |
| Gửi lại email | Gửi lại thư xác thực | API xác thực email (trong `VerifyEmailBanner`) | Hiện khi chưa xác thực |
| ĐỀ XUẤT: chip Coin thành liên kết "58 Coin" | Mở ví | `/student/vi` | Hiện chip không bấm được; ví chỉ vào được qua Khác → "Ví và Coin". Thành phần `CoinBalance` còn được dùng ở `src/components/Navbar.tsx`, nên đổi chip là đổi cả ở đó. Bài `ui-trial-mode` cấm mọi liên kết tới `/student/vi` trên các màn gia sư (`/lop-cua-toi/*`): chip liên kết chỉ được nằm trong vỏ học sinh. Có liên quan Coin nên hỏi chủ dự án (Q6) |
| ĐỀ XUẤT: nút "Nhập mã mời" khi chưa vào lớp nào | Mở trang nhập mã | `/student/nhap-ma-lop` | Xem mục 6 "Chưa vào lớp nào" và Q2 |
| (Ví) KHÔNG có nút nạp/mua cho học sinh | — | `POST /api/wallet/topups` trả 403 cho học sinh | NC2-036: Coin học sinh chỉ nhận thưởng làm bài, không mua bằng tiền; không game cược |

## 6. Trạng thái
| Trạng thái | Chữ chính xác trong mã | Ghi chú |
|---|---|---|
| Đang tải toàn trang (xác định người dùng) | Biểu tượng K của `KinLoader`; chữ ẩn cho trình đọc "Đang tải" | `AuthGuard` |
| Đang tải lần đầu danh sách | Khung xương 5 dòng (`ListSkeleton`, `aria-busy`, `aria-label` "Đang tải"); khung đọc (máy tính): tiêu đề "Đang tải…" | Không vòng xoay |
| Lỗi tải (đã có danh sách) | Dải đỏ `role=alert`: "Không tải được danh sách." + nút "Thử lại"; danh sách cũ giữ nguyên | |
| Lỗi tải ở lần đầu (chưa có danh sách) | Dải lỗi như trên, nhưng danh sách trống và khung đọc vẫn ghi "Đang tải…" | Lỗi hiện tại, xem mục 9 |
| Trống | Danh sách: "Chưa có việc nào cần làm."; khung đọc: tiêu đề "Bạn đã xong hết", dòng phụ "Bài tập mới, hạn nộp và buổi học sắp tới sẽ hiện ở đây." | Badge ẩn khi bằng 0 |
| Chưa vào lớp nào | Hiện giống "Trống" (API không phân biệt) | ĐỀ XUẤT thêm câu "Bạn chưa vào lớp nào" + nút "Nhập mã mời" (cần cờ từ API, Q2) |
| Bình thường | Ba nhóm "Cần làm" / "Sắp tới" / "Đã xong" (nhóm rỗng thì bỏ) | |
| Xong hết việc cần làm | Vòng tiến độ đổi màu xong + dấu tích + mười chấm toả ra (chỉ chạy lúc VỪA chuyển sang đủ, không chạy lúc mở trang); dòng phụ thành "Đã xong hết việc cần làm" | Tôn trọng `prefers-reduced-motion` |
| Không có việc cần ra tay và không có việc đã xong (chỉ có buổi học) | Không hiện vòng tiến độ (tránh "0/0") | |
| Việc vừa xong lúc làm mới | Tiêu đề bị gạch ngang quét từ trái 0,5 giây | Việc đã xong từ trước: gạch đứng yên |
| Gia sư vừa đăng ký, hồ sơ chưa duyệt | Thẻ `role=status`, thuộc tính `data-tutor-pending`: "**Hồ sơ gia sư của bạn đang chờ quản trị duyệt.** KiN sẽ báo khi xong." | Chỉ người đó thấy |
| Email chưa xác thực | Dòng đậm "Email chưa được xác thực"; dòng nhỏ "Kiểm tra hộp thư {email} và bấm link xác thực" + nút "Gửi lại email" (đổi thành "Đang gửi...", xong thành "✓ Đã gửi lại!") | Đóng được bằng ✕ |
| Hết phiên / chưa đăng nhập | Chuyển tới `/dang-nhap?redirect=%2Fstudent%2Fviec-cua-toi` | |
| Từng loại trạng thái dòng | `Quá hạn` (đỏ), `Sắp hết hạn` (cam), `Cần nộp` (xám), `Có hạn nộp` (xám), `Đã nộp`/`Đã làm` (xám), `Đã chấm` (xanh lá), `Sắp tới` (xám), `Đã huỷ` (đỏ), `Đã dời` (cam) | Đúng nhãn trong mã; tone thực tế: `mo` = xám trung tính |
| Chuông rỗng | "Chưa có thông báo nào" | Học sinh mới |
| Thanh bên thu gọn | Nút "Mở thanh bên, có N việc cần xử lý" + chấm đỏ `data-rail-dot` | Không giấu việc cần làm |
| Ví: đang tải | Số dư "..." | |
| Ví: không có giao dịch | "Chưa có giao dịch nào." (nghiêng) | |
| Ví: học sinh có yêu cầu nạp cũ | Khối "Lịch sử yêu cầu nạp" vẫn hiện nếu còn bản ghi (nhãn "Đã duyệt"/"Bị từ chối"/"Đang chờ") | Chỉ lịch sử, không form |

## 7. Chữ bắt buộc giữ nguyên
Theo từng bài test (đường dẫn `tools/local-e2e/`). Đổi chữ nào dưới đây thì phải sửa bài test đi kèm, nên đừng đổi.

**`ui-student-shell.ts`** (kiểm vỏ + "Việc của tôi"): `/student` chuyển tới `/student/viec-cua-toi`; thanh module tên "Module của học sinh", nhãn "HỌC SINH", bốn liên kết "Việc của tôi", "Lịch", "Lớp", "Thư viện" và nút "Khác" (`aria-haspopup="dialog"`, `aria-expanded`); đúng một phần tử `aria-current=page`; nhãn module không bị cắt "…" (kiểm `span.truncate`); thanh rộng 79px, ở x=0; badge `.kin-badge-dem` có `aria-label` `"{n} việc cần xử lý"` và nội dung `n`; nút chuông tên "Thông báo"; listbox tên "Việc của tôi"; nhóm tên "Cần làm" và "Đã xong" (`role=group`); chữ trạng thái "Quá hạn", "Sắp hết hạn"; nút chính "Nộp bài" (liên kết; đúng MỘT liên kết tên "Nộp bài" trên cả trang ở máy tính) trỏ `/student/bai-giang/<lessonId>`; khung đọc có đúng chữ hướng dẫn của giáo viên (ví dụ "Làm Bài quá hạn theo hướng dẫn"); vùng tên "Danh sách" rộng 330px, listbox `overflow-y:auto`, vùng "Chi tiết" bắt đầu ở x = 79 + 330, trang không cuộn dọc ở 1280×800; bảng "Các mục khác" có đủ liên kết chính xác "Thi thử", "Bảng xếp hạng", "Hỏi đáp", "Cộng đồng", "Tin tức", "Hồ sơ", "Học phí", "Chủ đề màu" và nút "Đăng xuất" + tên người dùng; khung xương `[aria-busy=true]` và KHÔNG `.animate-spin`; dải lỗi "Không tải được danh sách." + nút "Thử lại" và danh sách cũ còn nguyên (5 dòng); trống: "Chưa có việc nào cần làm." và "Bạn đã xong hết", không có badge; điện thoại 390: thanh dưới cao 60px dính đáy, chỉ MỘT thanh module, ở màn danh sách KHÔNG có h1 (chỉ hiện khi mở khung đọc), mỗi nút ≥44px (đúng 5 nút), không tràn ngang, nút `/Quay lại/` ("← Quay lại"), bảng "Khác" nằm gọn trên thanh dưới; chưa đăng nhập → `/dang-nhap` với `redirect=%2Fstudent%2Fviec-cua-toi`; không `pageerror`/`console.error`. Số dòng test dựng là 5 (4 bài chưa nộp + 1 đã nộp) và phím End chọn dòng thứ 5: nếu thu gọn nhóm "Đã xong" thì sai. Còn kiểm thêm: không còn thanh trên cũ, nghĩa là ngoài bảng "Khác" trang KHÔNG được có liên kết tên đúng "Cộng đồng" và không có `navigation` tên "Chính" hoặc "main" (đừng đưa lối "Cộng đồng" ra trang chủ); mọi mục trong bảng "Khác" cao ≥44px; ở điện thoại bảng nằm trong khoảng giữa đỉnh màn và thanh dưới 60px, không tràn ngang; chọn "Hồ sơ" trong bảng thì sang `/student/ho-so`, bảng tự đóng và nút "Khác" có `aria-current=page`; ở `/student/lich-hoc` thì "Lịch" có `aria-current=page` còn "Khác" thì không.

**`t-student-todo-lib.ts`** (luật thuần): `fmtScore` ("18,4", "25", "7,25"); `remainingText` ("còn 3 giờ 50 phút", "còn 2 ngày", "còn 2 ngày 5 giờ", "quá hạn 1 giờ 5 phút", "còn 1 phút"); `whenLabel` ("Hôm nay", "Ngày mai", "Thứ 6", "25/10", "09/10"; tính theo giờ Việt Nam: 23:30 VN vẫn là hôm nay); tiêu đề `"Bài tập Vi-ét hạn 23:59 hôm nay"`; dòng phụ `"Toán 9 · thầy Thanh giao 12/10"`; trạng thái `Sắp hết hạn`, `Cần nộp`, `Quá hạn`, `Đã nộp`, `Đã làm`, `Đã chấm`, `Sắp tới`, `Đã huỷ`, `Đã dời`; đoạn chữ `Chưa nộp lần nào`, `Nộp lại sẽ ghi đè bản cũ.`, `Đã nộp lúc 19:10 13/10`, `Điểm 18,4/25`, "chưa ghi nhận xét", "chờ"; nút `Nộp bài`, `Làm bài`, `Xem đề`, `Vào lớp`, `Xem lịch` (riêng `Mở bài`, `Xem bài`, `Xem bài đã nộp`, `Xem lại bài làm` có trong mã nhưng test KHÔNG kiểm chữ, chỉ kiểm hạn nộp ngoài mở tab ngoài); chữ hạn nộp ngoài có "không biết"; tiêu đề buổi huỷ bắt đầu bằng "Buổi đã huỷ" và không dính "[…]"; tối đa 50 dòng; thứ tự cần ra tay → sắp tới → đã xong; badge = số việc cần ra tay.

**`t-student-todo.ts`** (API): `GET /api/student/viec-cua-toi` cần đăng nhập (401), `?badge=1` chỉ trả `{ badge }`, không lộ tên/email người khác, nhãn như trên.

**`ui-motion-app.ts`**: vòng tiến độ `.kin-ring` có `aria-label` đúng `"Việc đã xong: 1 trên 3"` và số `.kin-ring-num` "1/3"; `.kin-swap` với `data-alt`; gạch ngang `.kin-strike[data-strike=draw|static]`; mỗi dòng có `id="viec-<id>"` và lớp `kin-bloom` với `--d`; trạng thái xong hết `data-all`; thanh bên: `#kin-rail`, `[data-rail-widen]` (aria-label "Mở rộng thanh bên có nhãn chữ" / "Thu hẹp thanh bên"), `[data-rail-close]`, `[data-rail-open]`, `#khac-bang`, `.kin-rail-hl`, `.kin-rail-lab`, khoá `localStorage` `kin.thanh-ben`; rộng 79 ⇄ 220px; phím `[`. Còn kiểm: mục đang chọn (`aria-current=page`) có nền trong suốt vì vạch nổi bật dùng chung `.kin-rail-hl` đã trùng đúng mục đó (sai lệch dưới 1,5px); nút mở rộng ẩn (opacity 0) cho tới khi rê chuột vào thanh hoặc có tiêu điểm bàn phím; khi thanh rộng 220px, bảng `#khac-bang` có mép trái trong khoảng 220–236px; vòng tiến độ chỉ đếm VIỆC (bài tập, hạn nộp), không đếm buổi học.

**`ui-sidebar.ts`**: nút "Thu gọn thanh bên" (`aria-expanded`, `aria-controls="kin-rail"`, cao 44), nút "Mở thanh bên" (cao 44), nhãn `Mở thanh bên, có 3 việc cần xử lý` + chấm `[data-rail-dot]`; vùng "Danh sách" bắt đầu ở x=79 (thu: x=0); khi thu, liên kết trong thanh không nhận được tiêu điểm; phím `[` bật/tắt thanh nhưng không hoạt động khi đang gõ chữ; điện thoại: thanh dưới luôn hiện đủ 5 mục (4 liên kết + nút "Khác"), không có nút thu/mở; mở "Khác" rồi thu thanh thì bảng "Khác" cũng đóng; lựa chọn thu/mở được nhớ theo máy và theo tài khoản (`User.preferences.rail`).

**`ui-account-menu.ts`**: nút tài khoản (`data-account-menu`, `aria-label` chứa "Tài khoản của {tên}", cao và rộng ≥44px; từ máy tính hiện chữ cái đầu VÀ tên, điện thoại CHỈ hiện chữ cái đầu: test kiểm điện thoại không có tên trong nút); menu `role=menu` tên "Tài khoản" có ĐÚNG 4 mục theo thứ tự "Hồ sơ", "Học phí", "Chủ đề màu", "Đăng xuất"; đầu menu hiện tên và email; mỗi mục ≥44px; `tabIndex=-1`; mở thì tiêu điểm vào "Hồ sơ", Esc đóng và trả tiêu điểm về nút, Tab hoặc bấm ra ngoài thì đóng; menu nằm gọn trong màn 390px.

**`ui-role-everything.ts`** (chuông): `button[aria-label^="Thông báo"]`, `.kin-notif-btn` mỗi thông báo một nút (số nút phải bằng số thông báo), "Chưa có thông báo nào"; bấm từng thông báo phải tới đúng trang đã ghi; test nhận diện thông báo bằng cách tách chữ của nút theo dòng và tìm tiêu đề, nên tiêu đề phải nằm trên dòng riêng, tách khỏi nội dung `message`.

**`ui-journey-new-student.ts`**: sau xác thực email → `/student/viec-cua-toi` và có `nav[aria-label="Module của học sinh"]`; "Tài khoản của …" → menuitem "Đăng xuất" → về `/`.

**`nc2-029` / `ui-journey-new-tutor.ts`**: thẻ `[data-tutor-pending]` với chữ "Hồ sơ gia sư của bạn đang chờ quản trị duyệt. KiN sẽ báo khi xong."; học sinh thường không có thẻ này.

**`ui-trial-mode.ts`** (Ví, địa chỉ `/student/vi`; chạy hai lần với cờ chạy thử tắt/bật). Phần kiểm trên tài khoản HỌC SINH ở 390px: tiêu đề "Ví Coin" (`heading`); câu "Coin không mua được bằng tiền" (đủ câu: "Coin nhận được khi làm bài đúng hạn và đúng nhiều, làm nhanh được thêm. Coin không mua được bằng tiền."); KHÔNG thấy nút "Gửi yêu cầu nạp" và ô `VD: 300000`; KHÔNG thấy chữ "KiN miễn phí trong giai đoạn chạy thử". Phần kiểm trên tài khoản GIA SƯ cùng trang đó (thiết kế phải giữ nhánh này): chữ "Số dư hiện tại" và "Giao dịch Coin gần đây" còn nguyên; cờ bật thì có khung "KiN miễn phí trong giai đoạn chạy thử" + câu "Bạn chưa cần mua gói hay nạp Coin" và không còn form nạp, không còn liên kết hay chữ Mua VIP/Nạp Coin; cờ tắt thì form nạp (ô `VD: 300000`) và câu "Nạp Coin để mua gói VIP" còn như cũ; không tràn ngang ở 390px. Các chữ "Yêu cầu nạp Coin", "Số dư hiện tại", "Giao dịch Coin gần đây" nên giữ cho học sinh vì cùng một trang, dù test không kiểm riêng cho học sinh.

**`ui-theme.ts`**: chế độ Tối, quét chữ tương phản dưới 3:1 và mảng nền gần trắng: `/student/viec-cua-toi` và `/student/lich-hoc` ở cả 5 chủ đề; thêm `/student/vi`, `/student/hoc-phi`, `/student/ho-so`, `/cai-dat/chu-de` ở chủ đề Navy.

**`t-no-hex.ts`**, **`t-kin-components.ts`**: quét tĩnh `src`: không mã màu hex viết cứng ngoài danh sách ngoại lệ (chỉ `--kin-*`); không chữ nhỏ hơn 11,1px (`text-[Npx]` hay `fontSize` < 11,1); không `window.confirm`/`confirm()` (mọi hỏi lại qua `KinConfirm`); `KinButton` không có vòng xoay; `Outlook.tsx` phải còn dùng `KinButton`, `kinButtonClass`, `KinStatus` và kiểu lệnh `"primary" | "secondary" | "danger"` (đổi giao diện danh sách thì giữ nguyên các tên này).

**P7. Chữ bắt buộc của vỏ (áp cho cả Màn B và C):** các chuỗi trong `ui-student-shell.ts`, `ui-sidebar.ts`, `ui-account-menu.ts` ở trên (thanh module, "Khác", chuông, menu tài khoản) vì mọi màn học sinh dùng chung vỏ.

## 8. Quy tắc cũng phải giữ
- **Tiền (Ví Coin).** Học sinh không nạp Coin bằng tiền: `POST /api/wallet/topups` trả 403 cho học sinh, form nạp ẩn (NC2-036, `docs/kin/backlog/nang-cap-lan-2.csv`, `docs/kin/tien-do-dang-do.md`). Coin chỉ nhận thưởng: làm bài đúng hạn và đúng từ 50% → +5; đúng từ 80% và dùng tối đa nửa thời gian cho phép (tối thiểu 30 giây) → +5 nữa; mỗi (học sinh, đề) một lần; tối đa 5 lượt/ngày (`src/lib/wallet-constants.ts`, `src/lib/quizReward.ts`). Không thiết kế game cược, không đổi Coin ra tiền/quà, không chuyển giữa tài khoản (ràng buộc ghi trong NC2-036; trẻ em và cược cần luật sư, Q-LS-16).
- **KiN không giữ học phí** (`docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 1); màn này không hiện tiền học phí.
- **Trẻ dưới 16 tuổi / dưới 7 tuổi.** Không thêm màn hay ô thu thập dữ liệu cá nhân (`BRIEF.md`); chỗ có tiền hoặc trẻ nhỏ thì dừng và hỏi người (`CLAUDE-cho-kho-trien-khai.md` mục 9); đồng ý kép từ 7 tuổi là việc chưa chốt (mục 8 cùng tệp), đừng tự quyết.
- **Token màu** `--kin-*`, không mã hex (`t-no-hex.ts`); màu không nói một mình, luôn kèm chữ; chữ cần tương phản 4,5:1, chấm/viền 3:1 (`CLAUDE-cho-kho-trien-khai.md` mục 6).
- **Nút và vùng chạm ≥ 44px** (`--kin-cham-toi-thieu`); chữ ≥ 11,1px.
- **Thông báo**: chữ trong chuông có `message`; nhưng thông báo ĐẨY (khi làm cho học sinh) dựng từ loại thông báo, không tên em, không số tiền, không điểm vì màn hình khoá hiện chữ (`src/lib/pushRules.ts` đầu tệp; `docs/kin/ke-hoach-phat-trien-tu-research.md` mục F). Hiện push mới có cho gia sư.
- **Giờ Việt Nam, 24 giờ, `dd/mm`**: "Hôm nay"/"Ngày mai"/"Thứ N" tính theo ngày Việt Nam bằng `vnDateKeyOf` (`src/lib/classSessions.ts`), không theo giờ máy.
- **Tên sản phẩm là KiN** ở mọi nơi, không dùng "Midnight Elite" (`CLAUDE.md`).
- **Không bịa**: danh sách việc chỉ sinh từ hàng dữ liệu có thật; không "KiN AI" giả, không số liệu mẫu hiện ra thật (`t-no-fabricated.ts`).
- **Việc ghi dữ liệu dùng POST thường + redirect 303**, không server action (`CLAUDE-cho-kho-trien-khai.md` mục 5, điều 5); màn này chỉ đọc nên không bị ảnh hưởng, nhưng nút "Nộp bài" dẫn sang trang có ghi.
- **Chuyển động**: gạch ngang, vòng tiến độ, nở dòng đều phải tắt khi `prefers-reduced-motion: reduce`.
- **Next.js của repo khác bản quen thuộc**: người dựng đọc `node_modules/next/dist/docs/` trước khi viết mã (`AGENTS.md`).

## 9. Điều đang chưa tốt ở bản hiện tại
(Dựa trên mã. Thư mục `anh-hien-trang` chỉ có ảnh màn GIA SƯ; KHÔNG có ảnh chụp màn học sinh, nên mục này không dựa trên ảnh.)
1. **Học sinh mới không có lối "Nhập mã mời" ở trang đầu.** Danh sách trống chỉ ghi "Chưa có việc nào cần làm." và khung đọc ghi "Bạn đã xong hết", sai nghĩa với em chưa vào lớp nào. Bảng "Khác" cũng không có mục nhập mã. Lối tới `/student/nhap-ma-lop` hiện chỉ có ở: trang đăng nhập ("Tôi có mã mời vào lớp"), Học phí và Thư viện (khi chưa có lớp), và trang bài giảng bị khoá.
2. **Lỗi tải ở lần đầu**: dải lỗi hiện nhưng khung đọc vẫn ghi "Đang tải…" và danh sách trống, trông như treo.
3. **Tên buổi học lệch**: tiêu đề dòng dùng `category` của lớp (ví dụ "Buổi toán 19:00" chữ thường) thay vì tên lớp, trong khi khung đọc dùng tên lớp.
4. **Dòng danh sách bị cắt "…"** (`truncate` trong `ListRow`) và mỗi dòng cao 3 dòng (tiêu đề, dòng phụ, trạng thái) nên danh sách dài, dày; trái với "không chữ bị cắt".
5. **Chip Coin màu cam** trên mọi trang: màu cam đang mang nghĩa "chờ/còn nợ"; chip có khung, dùng emoji 🪙 thay biểu tượng, chỉ có số mà không có chữ "Coin", tranh chú ý với việc cần làm; không bấm được.
6. **Khung xương cũ** `src/app/(student)/student/loading.tsx` vẫn dựng hình cũ (băng chào + hai cột + 4 ô) không khớp bố cục Outlook nên nháy sai hình khi chuyển trang. Khung dự phòng `Suspense` trong `src/app/(student)/layout.tsx` (ba khối xám) còn dùng `animate-pulse`, trái quy tắc "khung xương `kin-skel`, không `animate-pulse`".
7. **Nhãn "Việc của tôi" trên thanh 79px**: ghi chú `docs/kin/tien-do-dang-do.md` (dòng nói về lỗi có sẵn trên mã gốc) cho biết bài `ui-student-shell` đang đỏ 61/1 vì nhãn này bị cắt; cùng ghi chú đó còn nói `t-student-todo` đang đỏ 35/1 ở câu "có buổi học ngày mai". Hai chỗ đỏ có sẵn, chưa sửa; cần đo lại khi đổi cỡ chữ và đừng nhầm với lỗi do thiết kế mới gây ra.
8. **Ví**: `REASON_LABEL` ở `vi/page.tsx` thiếu `quiz_reward` nên thưởng làm bài hiện mã thô "quiz_reward" trong lịch sử Coin; khối số dư nền màu nhấn đặc là phần nặng nhất trang. Phòng thi trả `coinsEarned` nhưng giao diện chưa phát sự kiện `coin:earned`, nên em không thấy "+N" nổi lên sau khi nộp (đã đọc `submit/route.ts`; chưa chạy thử).
9. Việc có sẵn `detail.commands` đầy đủ trong dữ liệu nhưng phải qua 3 chạm trên điện thoại (chọn dòng → khung đọc → nút).
10. **Nút dưới 44px và emoji thay biểu tượng trong vỏ**: chuông "Thông báo" là nút 36px (`w-9 h-9`), huy hiệu hiện "9+"; bảng chuông dùng emoji làm biểu tượng loại thông báo (🎓 📝 ⏰ 🎥 💬 ❤️ 📰 🙋 🪙 ⚠️ 🔔); dải xác thực email dùng emoji ⚠️, nút ✕ rộng 24px, nút "Gửi lại email" cao khoảng 28px. Trái quy tắc nút ≥44px và "không emoji thay biểu tượng" (Màn B mục 8). Đọc từ mã, chưa đo trên máy.

## 10. Mẫu học từ đối thủ
Ảnh trong `anh-tham-khao-so-gia-su/` (Sổ Gia Sư) hoặc media gốc `/tmp/rs/x/word/media/`.
- Chia khối theo câu hỏi "hôm nay có gì" (phòng học hôm nay, bài chưa nộp), mỗi khối một tiêu đề và trạng thái rỗng ngắn: Shub Classroom — `11a4cd13870ab67784094443ad71645be24a7000.jpg`.
- Trạng thái rỗng một câu thân thiện thay vì bảng trống ("Thật tuyệt vời! Tất cả bài tập đã được hoàn thành", "Bạn đã đọc hết tất cả tài liệu" đều trong `11a4cd13870ab67784094443ad71645be24a7000.jpg`; "Bạn đã xem hết tất cả bài giảng" và "Bạn chưa có kết quả nào để hiển thị" trong `0b5e59f8d5548f0ec3426c719d25bae05e840b05.jpg`): Shub. Không chép minh hoạ lớn (chiếm chiều cao).
- Lời chào theo buổi + thứ/ngày, mỗi thẻ một con số lớn + một dòng nhãn nhỏ: Sổ Gia Sư — `01-trang-chu.jpg` (`9eca714966e340fa1bb9890eddd213f8ede28a91.jpg`).
- Danh sách "hôm nay" ngay dưới số liệu, thẻ sự kiện có vạch màu bên trái và giờ đậm: TutorBird — `2b42778202338e054738963f94987070146fba2c.jpg`.
- Banner vàng nhắc việc, đóng được, một câu trấn an (ý: không bị tính phí cho tới khi bài học hoàn tất) và trạng thái rỗng có một nút cam: Wyzant — `2e32d1cb11fc824425fdeedcb0af0e20d33cf23d.jpg`. KiN không thu học phí nên đừng chép câu trấn an về phí.
- Thanh đầu gọn, mỗi chức năng một biểu tượng quen (tin nhắn, thông báo, avatar): Preply — `e8a12f5907c3560d38af20c501c528ec183e86ea.jpg`.
- Một câu hỏi một quyết định, hai lựa chọn rõ (25 phút / 50 phút) trong một hộp (áp tinh thần cho nút "Nộp bài"/"Vào lớp này"): Preply — `91b83e9d73ac64ce887d21cb4a68bc05c4aac6e5.jpg`. Ảnh này chỉ thấy phần đầu hộp; nút "Tiếp tục" xám đến khi đã chọn không nằm trong khung ảnh, nguyên tắc đó lấy từ `docs/kin/thiet-ke/hoc-sinh-giao-dien-tu-anh-doi-thu.md` mục 3.
- Không chép: nút "Hỏi đáp" nổi che tab, nội dung dồn trái bỏ phí bên phải (Shub); banner hướng dẫn cao ở đầu trang (TutorBird, Teachworks); nhãn KPI dài tràn thẻ.

## 11. Dữ liệu mẫu để điền vào thiết kế
Học sinh **Đỗ Hà** (lớp Toán 9 và Văn 8 của Cô Lan, giasu@kin.local; Cô Lan có 7 lớp, 8 học viên đang học; đã thu tháng 10: 480.000đ). Hôm nay Thứ 5 22/10/2026, 16:30. (Đỗ Hà có phiếu học phí nháp 560.000đ ở phía gia sư: học sinh KHÔNG thấy phiếu nháp; không đưa tiền vào màn này.)
1. Chào buổi chiều, Đỗ Hà · vòng tiến độ `2/5` · dòng phụ "Bài phải nộp và buổi sắp tới".
(Thứ tự dòng đúng như mã sắp: nhóm CẦN LÀM theo hạn sớm nhất trước nên việc quá hạn đứng ĐẦU; nhóm SẮP TỚI theo giờ; nhóm ĐÃ XONG mới nhất trước.)
2. CẦN LÀM · `Bài đọc hiểu "Chiếc lược ngà" hạn 23:59 21/10` · "Văn 8 · Cô Lan giao 19/10" · 21/10 · Quá hạn (đỏ).
3. CẦN LÀM · `Bài tập Phương trình bậc hai hạn 23:59 hôm nay` · "Toán 9 · Cô Lan giao 20/10" · Hôm nay · Sắp hết hạn (cam).
4. CẦN LÀM · `Phiếu ôn tập Văn 8 hạn 20:00 ngày mai` · "Văn 8 · Cô Lan giao 21/10" · Ngày mai · Cần nộp (xám).
5. SẮP TỚI · `Buổi Toán 9 19:00` · "Toán 9" · Ngày mai · Sắp tới. (Hôm nay 22/10 là Thứ 5; ngày mai là Thứ 6 23/10, giờ học 19:00–20:30 theo lịch lớp. Chữ HIỆN TẠI trong mã là "Buổi toán 19:00" vì lấy `category` của lớp; mẫu này theo đề xuất ở Q4.)
6. SẮP TỚI · `Buổi Văn 8 16:00` · "Văn 8" · Thứ 7 · Sắp tới. (Cùng ghi chú Q4: hiện tại là "Buổi văn 16:00".)
7. ĐÃ XONG · `Đã nộp Bài tập Hàm số` · "Toán 9 · chờ thầy/cô chấm" · Hôm nay · Đã nộp (xám).
8. ĐÃ XONG · `Đã chấm Bài kiểm tra 15 phút` · "8,5/10 · Toán 9" · 21/10 · Đã chấm (xanh lá); khung đọc: "Điểm 8,5/10 — Làm tốt phần hình học." (nhận xét của Cô Lan).
   Ghi chú: trong tuần có thêm hạn nộp ngoài `Đề cương Văn 8` (Azota, Chủ nhật 25/10, xem mẫu Màn B); nếu muốn mẫu này khớp mẫu Lịch thì thêm một dòng SẮP TỚI "Có hạn nộp" cho nó (hạn còn hơn 3 ngày nên chưa vào nhóm CẦN LÀM, chưa tính vào vòng `2/5` và badge `3`).
9. Khung đọc của dòng 3: meta "Toán 9 · Cô Lan giao 20/10 · còn 7 giờ 29 phút"; nút "Nộp bài" (chính) + "Xem đề"; đoạn "Cách nộp — Nộp ảnh chụp hoặc file PDF." và "Chưa nộp lần nào — Nộp lại sẽ ghi đè bản cũ."
10. Badge thanh module: `3`. Chip Coin: `58 Coin`. Chuông: 2 chưa đọc. Menu tài khoản: "Đỗ Hà".
11. Ví: số dư `58 Coin`; giao dịch (mới nhất trước): "Thưởng hoàn thành bài học +3" (21/10 20:14), "Thưởng làm bài +5" (20/10; nhãn thật chưa có trong mã, Q5), "Tặng khi đăng ký +50" (01/10). Tổng 58. (Số +3 và +50 lấy từ `LESSON_REWARD` và `SIGNUP_BONUS` trong `src/lib/wallet-constants.ts`.)
12. Học sinh mới (trạng thái rỗng): "Chưa có việc nào cần làm." — thử cả bản ĐỀ XUẤT "Bạn chưa vào lớp nào" + nút "Nhập mã mời".

## 12. Câu hỏi còn mở
Mỗi câu kèm mặc định đề xuất. Câu THỰC SỰ cần chủ dự án quyết: Q2 (đổi dữ liệu API), Q3 và Q7 (phải sửa bài test), Q6 (chạm vào Coin), Q10 (thêm dữ liệu thiết bị của trẻ nhỏ; theo `CLAUDE-cho-kho-trien-khai.md` mục 9 thì dừng và hỏi). Q5 chỉ cần chủ dự án duyệt chữ. Các câu còn lại (Q1, Q4, Q8, Q9) có mặc định rõ và không động tới tiền, dữ liệu trẻ em hay tên gọi sản phẩm: người dựng cứ làm theo mặc định; Q8 là việc đo, không phải quyết định.
1. Có muốn thêm lời chào "Chào buổi chiều, {tên}" ở đầu danh sách không (đang không có, hàm `greetingForHour` đã có)? Mặc định: có, dạng `<p>` nhỏ, không phải h1.
2. Muốn phân biệt "chưa vào lớp nào" với "đã xong hết" ngay trên trang đầu (cần API trả thêm cờ, ví dụ `enrolled: boolean` hoặc đếm lớp) và thêm nút "Nhập mã mời"? Mặc định: có; nếu chưa muốn đổi API thì chỉ đổi chữ rỗng.
3. Có thu gọn nhóm "Đã xong" trên điện thoại? Hiện bài `ui-student-shell` đếm 5 dòng và dùng phím End; nếu thu gọn phải sửa bài test. Mặc định: KHÔNG thu gọn, chỉ làm mờ.
4. Tiêu đề dòng buổi học dùng tên lớp thay vì `category` (sửa `classItem()` trong `studentTodo.ts`, bài test chỉ kiểm tiền tố "Buổi đã huỷ")? Mặc định: dùng tên lớp.
5. Nhãn lịch sử Coin cho `quiz_reward` viết thế nào ("Thưởng làm bài"?). Mã hiện chưa có nhãn.
6. Có đổi chip Coin thành liên kết tới `/student/vi` và bỏ nền cam? Mặc định: có (chỉ hiện số + chữ "Coin"). Lưu ý đi kèm: `CoinBalance` còn dùng ở `Navbar.tsx`; chip liên kết chỉ được nằm trong vỏ học sinh (bài `ui-trial-mode` cấm liên kết tới `/student/vi` trên màn gia sư). Không thêm nút nạp/mua dù chip mở ví.
7. Có thêm khối "Việc kế tiếp" (nút chính ngay trên danh sách điện thoại, dùng `detail.commands[0]`) để bớt chạm? Mặc định: không, vì trùng dòng đầu và bài test đếm đúng một liên kết "Nộp bài" ở máy tính; chỉ làm nếu chủ dự án chấp nhận sửa test.
8. Nhãn "Việc của tôi" trên thanh 79px có bị cắt (ghi chú trong `tien-do-dang-do.md`) không; có đổi tên module (ví dụ "Việc") không? Mặc định: giữ, đo lại sau khi đổi cỡ chữ.
9. Thứ viết "Thứ 6" (mã hiện dùng) hay "Thứ Sáu" (brief)? Mặc định: theo mã ("Thứ 6") ở danh sách; đầy đủ chỉ ở tiêu đề.
10. Thông báo đẩy cho học sinh (chưa có): nếu làm, đã có luật không tên/tiền/điểm; có làm không? Mặc định: KHÔNG làm cho tới khi chủ dự án quyết. Làm push nghĩa là lưu thêm đăng ký thiết bị (dữ liệu của em, có thể dưới 16 tuổi), nên theo "trẻ nhỏ thì dừng và hỏi" phải hỏi chủ dự án (và luật sư nếu cần) trước, không tự thiết kế.

---

# Màn B. Lịch học

Route: `/student/lich-hoc` · Tệp mã chính: `src/app/(student)/student/lich-hoc/page.tsx` (+ dữ liệu `src/lib/studentSchedule.ts`, API `src/app/api/schedule/route.ts`) · Vai: học sinh.

## 1. Mục đích và người dùng
- Cho học sinh xem tuần này có buổi học nào, có buổi thi thử nào, hạn nộp nào, và vào lớp/thi/nộp bài từ đúng dòng đó.
- Nguồn chung với "Việc của tôi": cùng `loadStudentScheduleEvents()` nên hai nơi không lệch nhau (`t-student-todo.ts` kiểm).
- Người dùng: học sinh, phần lớn trên điện thoại, có thể dưới 16 tuổi; không có phụ huynh ở đây.
- Chỉ XEM: học sinh không sửa, không dời, không báo nghỉ ở màn này.

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)
1. Biết hôm nay và vài ngày tới có buổi nào, mấy giờ.
2. Biết buổi nào đã huỷ hoặc dời (đừng đi nhầm).
3. Vào học / vào thi / nộp bài từ dòng sự kiện.
4. Chuyển sang tuần khác.
5. Thu hẹp theo ngày hoặc theo loại (buổi học, thi thử, deadline).

## 3. Dữ liệu hiển thị
Mỗi sự kiện là `ScheduleEvent` (`src/lib/studentSchedule.ts`), `GET /api/schedule` → `{ events: [...] }`, sắp theo `isoDate` rồi `time`.

| Tên hiển thị | Nguồn trong mã (tệp + trường/hàm) | Định dạng | Ví dụ |
|---|---|---|---|
| Loại | `event.type`: `class` (khung giờ lớp lặp hàng tuần, bảng `ClassSchedule`), `exam` (bảng `Exam`, mọi đề đang mở), `deadline` (`Lesson.azotaDeadline` của lớp đã ghi danh) | chip chữ "Buổi học" / "Thi thử" / "Deadline" (`TYPE_CFG`) | `Buổi học` |
| Giờ | `event.time` | `HH:MM` giờ bắt đầu (CHỈ giờ bắt đầu; hạn nộp luôn "23:59"); buổi dời hiện giờ mới | `19:00` |
| Tên sự kiện | `event.topic` | buổi học: `"{tên lớp}"` hoặc `"{tên lớp} — {ghi chú}"`, có thể có tiền tố `[ĐÃ HUỶ] ` hoặc `[DỜI từ dd/mm] `; thi: tên đề; hạn nộp: tên bài | `Toán 9` |
| Môn | `event.subject` | buổi học: `category` của lớp; thi: `Exam.category`; hạn nộp: tên lớp | `toán` |
| Ngày | `event.isoDate` | `YYYY-MM-DD`; hiển thị `dd/mm`, "Hôm nay" nếu đúng ngày | `23/10` |
| Liên kết | `event.link` | buổi học: `/student/hoc-tap?course=<mã lớp>`; thi: `azotaUrl`; hạn nộp: `azotaUrl` | |
| Tuần | tính ở trang: `weekOffset`, `getWeekBounds()` (thứ 2 → CN) | "Tuần {n} · dd/mm – dd/mm/yyyy" | `Tuần 43 · 19/10 – 25/10/2026` |
| 4 ô thống kê | đếm `weekEvents`: "Hôm nay", "Buổi học tuần này", "Thi thử tuần này", "Deadline tuần này" | số | `1` |
| Số hoạt động trong ngày | `dayEvents.length` | "{n} hoạt động" | `2 hoạt động` |
| Cửa sổ dữ liệu | máy chủ: từ hôm nay đến +90 ngày, theo ngày Việt Nam | chỉ sự kiện TỪ HÔM NAY TRỞ ĐI | |
| Giờ kết thúc | `ClassSchedule.endTime` CÓ trong bảng nhưng KHÔNG nằm trong `ScheduleEvent` | chưa hiện được | cần thêm (Q1) |
| Mã lớp để tô màu | có trong `link` (`?course=`) nhưng chưa có trường riêng | | cần thêm `courseId` (Q2) |

## 4. Bố cục đề xuất
Mục tiêu: tuần có rất ít sự kiện (vài buổi), nên bỏ lưới giờ, bỏ 4 ô thống kê, bỏ khung viền quanh từng ngày. Ngày là tiêu đề, sự kiện là dòng.

### 4.1 Điện thoại 390px (một cột, lề 16px)
1. **Tiêu đề** "Lịch học" (h1, 19,2px) + dòng phụ 13,3px xám: "Tuần này · 19/10 – 25/10" (ĐỀ XUẤT bỏ "Tuần 43": học sinh không nghĩ theo số tuần; hiện chữ "Tuần này"/"Tuần sau"/"26/10 – 01/11"). 1–2 dòng.
2. **Hàng điều hướng tuần** (1 hàng, 3 nút cao ≥44px): `← Tuần trước` · `Tuần này` (mờ khi đang ở tuần này) · `Tuần sau →`. Đặt Ở TRÊN, bỏ hàng nút lặp ở cuối trang.
3. **Dải 7 ngày** (cuộn không cần: 7 chip rộng ≈ 51px, cao 56px): nhãn `T2`…`CN` trên, số ngày dưới; hôm nay tô đặc `--kin-nhan-nen`; có chấm nhỏ nếu ngày đó có sự kiện; chạm một ngày = cuộn tới nhóm của ngày đó (ĐỀ XUẤT thay cho "lọc theo ngày" hiện có; vì danh sách chỉ ≤ 7 ngày nên lọc là thừa). Ngày đã qua của tuần này nhạt đi.
4. **Chip lọc loại** (ĐỀ XUẤT chỉ hiện khi tuần có ≥ 2 loại sự kiện VÀ ≥ 5 sự kiện; ít hơn thì danh sách đã đủ ngắn, bỏ cả hàng cho thoáng): "Tất cả", "Buổi học", "Thi thử", "Deadline"; chữ 13,3px, cao 44px, một hàng cuộn ngang. Nếu chỉ một loại thì ẩn cả hàng.
5. **Danh sách theo ngày**: CHỈ dựng tiêu đề cho ngày có sự kiện và cho hôm nay (dù trống: một dòng xám "Hôm nay không có buổi nào"); ngày trống khác không dựng tiêu đề (tránh danh sách dài toàn "0 hoạt động"). Tiêu đề ngày một dòng ("Hôm nay · Thứ 5 22/10" hoặc "Thứ 6 23/10"; bên phải "{n} hoạt động" xám 11,1px). Dưới là các dòng sự kiện, ngăn bằng đường kẻ mảnh `--kin-vien-nhat`, không khung thẻ. Mỗi dòng: **giờ** đơn cách đậm 16px bên trái (`19:00`; ĐỀ XUẤT `19:00–20:30` khi có giờ kết thúc) · giữa: tên lớp 16px (xuống 2 dòng nếu dài, không cắt) + dòng xám 13,3px "{môn} · Buổi học" · phải: chữ trạng thái nếu có (`Đã huỷ` đỏ / `Đã dời` cam / `Sắp tới` xám) và nút `Vào học` (secondary, ≥44px, chỉ khi có liên kết và không huỷ). Vạch màu lớp 3px bên trái dòng (`classAccent`), nếu chưa có `courseId` thì dùng theo loại: xanh dương = buổi học.
6. Sự kiện đã huỷ: tiêu đề gạch ngang + chữ "Đã huỷ" (đỏ) + KHÔNG có nút "Vào học".
7. Một nút chính của màn: "Vào học" của buổi gần nhất hôm nay (không dựng nút riêng; chính là nút của dòng).
8. Cuối trang: chừa `pb` cho thanh dưới 60px.
9. Giữ thoáng ở phần đầu: tổng chiều cao từ đỉnh màn tới tiêu đề nhóm ngày đầu tiên (dải trên 48px + tiêu đề + hàng tuần + dải 7 ngày + chip nếu có) không quá khoảng 40% chiều cao màn 390×800 (≈320px, ước tính từ cỡ đề xuất, chưa đo). Vượt thì ẩn hàng chip trước, rồi rút dòng phụ "Tuần này · 19/10 – 25/10" vào cùng hàng với nút tuần.

### 4.2 Máy tính 1280px
Phần nội dung nằm bên phải thanh module (lề 32px, tối đa 1536px). ĐỀ XUẤT một cột đọc rộng tối đa ≈ 720px căn trái: tiêu đề + điều hướng tuần cùng một hàng (tiêu đề trái, ba nút phải); dải 7 ngày rộng đủ 720px (mỗi chip ≈ 100px, thêm dòng nhỏ "n buổi"); danh sách dưới như điện thoại. Không dựng 7 cột × giờ. Bên phải trống (thoáng). (Phương án có thể thay: bảng 7 cột ngày, mỗi cột xếp các thẻ; chỉ nên làm nếu một tuần thường > 10 sự kiện.)

## 5. Hành động
| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| Tất cả (hàng ngày) | Bỏ lọc ngày | Không gọi API | `activeDay = "all"` |
| T2, T3, T4, T5, T6, T7, CN | Lọc chỉ ngày đó (hiện có) | Không gọi API | ĐỀ XUẤT: chuyển thành "cuộn tới ngày" |
| Tất cả (hàng loại) | Bỏ lọc loại | | |
| Buổi học / Thi thử / Deadline (chip loại) | Lọc theo `type` | | Thứ tự hiện có: Tất cả, Buổi học, Thi thử, Deadline |
| Tuần trước | `weekOffset - 1`, bỏ lọc ngày | Không gọi API (đã có đủ 90 ngày) | Tuần đã qua luôn trống vì máy chủ chỉ gửi từ hôm nay (xem mục 9) |
| Tuần sau | `weekOffset + 1`, bỏ lọc ngày | | |
| ĐỀ XUẤT: Tuần này | Về `weekOffset = 0` | | Chưa có |
| Vào học | Mở lớp của buổi học | `/student/hoc-tap?course=<mã lớp>` (cùng tab) | Hiện tại cả buổi đã huỷ cũng có nút (lỗi, mục 9) |
| Vào thi | Mở đề thi (Azota) | `azotaUrl`, tab mới (`noopener noreferrer`) | Chỉ hiện nếu có `link` |
| Nộp bài | Mở bài nộp ngoài (Azota) | `azotaUrl`, tab mới | KiN không biết đã nộp chưa |
| (nút thanh module) Lịch | đang ở trang này (`aria-current`) | | |
| Chuông / Menu tài khoản / Khác | như Màn A | | |

Không có nút ghi dữ liệu ở màn này.

## 6. Trạng thái
| Trạng thái | Chữ chính xác trong mã | Ghi chú |
|---|---|---|
| Đang tải | 4 ô thống kê hiện khối xám nhấp nháy (`animate-pulse`, trái quy tắc khung xương `kin-skel` ở P3); 3 khung xương thẻ (`SkeletonBlock variant="card"`) | Tiêu đề, bộ lọc hiện sẵn |
| Tuần không có gì | Biểu tượng lịch + "**Không có lịch nào trong tuần này**" + "Thử chuyển sang tuần khác" | Không có nút; ĐỀ XUẤT thêm nút "Tuần này"/"Tuần sau" |
| Có sự kiện | Nhóm theo ngày | |
| Hôm nay | Ô ngày tô màu `--kin-tt-chu-loi`, chữ "Hôm nay {dd/mm}"; viền trái nhóm cùng màu | Hiện tại dùng ĐỎ cho hôm nay, trong khi đỏ nghĩa là quá hạn/nghỉ (mục 9) |
| Buổi đã huỷ | `topic` bắt đầu `[ĐÃ HUỶ] ` | Hiện in nguyên tiền tố; ĐỀ XUẤT bỏ tiền tố, gạch ngang + chữ "Đã huỷ" |
| Buổi dời | `topic` bắt đầu `[DỜI từ dd/mm] ` (chỉ có NGÀY gốc; giờ gốc KHÔNG có trong dữ liệu, `time` là giờ mới) | ĐỀ XUẤT chữ "Đã dời" (cam) + "từ dd/mm" |
| Lọc không ra gì | Cùng câu "Không có lịch nào trong tuần này" | ĐỀ XUẤT câu riêng: "Không có {loại} nào trong ngày/tuần này" + nút "Bỏ lọc" |
| Lỗi tải (mạng, 401, 5xx) | KHÔNG có chữ riêng: mã nuốt lỗi (`.catch(() => {})`) và hiện "Không có lịch nào trong tuần này" | Lỗi hiện tại (mục 9); ĐỀ XUẤT dải lỗi "Không tải được lịch." + "Thử lại" như `ErrorStrip` |
| Chưa vào lớp nào | Vẫn thấy thi thử và buổi thi (mọi đề đang mở), không thấy buổi học/hạn nộp | Xem Q3 |
| Hết phiên | Chuyển `/dang-nhap?redirect=/student/lich-hoc` | `ui-journey-new-student.ts` J5/J6 |

## 7. Chữ bắt buộc giữ nguyên
Không có bài test giao diện nào khoá các chuỗi bên trong trang Lịch (các bài chỉ kiểm đường dẫn và vỏ). Những chữ ĐÃ có trong mã và nên giữ vì là chữ chức năng của người dùng: "Lịch học cá nhân" (tiêu đề hiện tại; ĐỀ XUẤT rút thành "Lịch học"), "Tuần trước", "Tuần sau", "Hôm nay", "Buổi học", "Thi thử", "Deadline", "Vào học", "Vào thi", "Nộp bài", "Tất cả", "T2…CN", "{n} hoạt động", "Không có lịch nào trong tuần này", "Thử chuyển sang tuần khác".

Bài test có liên quan:
- **`ui-student-shell.ts`**: bấm module "Lịch" → URL `/student/lich-hoc`, `aria-current` chuyển sang "Lịch", "Khác" hết sáng, vỏ vẫn hiện (thuộc P7).
- **`ui-motion-app.ts`**: bấm "Lịch" trên thanh rộng → URL `/student/lich-hoc`; vạch nổi bật trượt tới đúng mục.
- **`ui-journey-new-student.ts` J5/J6**: mở `/student/lich-hoc` khi chưa đăng nhập → `/dang-nhap?redirect=/student/lich-hoc`, đăng nhập xong về đúng trang.
- **`ui-theme.ts`**: `/student/lich-hoc` ở chế độ Tối × CẢ 5 chủ đề (Navy, Cổ vịt, Mận, Cà phê, Mực) sạch: không chữ có tương phản dưới 3:1, không mảng nền gần trắng lớn hơn 4000px².
- **`ui-kin-site.ts`**: `/student/lich-hoc` ở chế độ Tối không còn màu xanh cũ `rgb(0, 104, 255)` ở chữ, nền, viền.
- **`ui-login-password.ts`, `ui-login-code.ts`**: mở `/student/lich-hoc` khi chưa đăng nhập → `/dang-nhap` kèm `redirect=/student/lich-hoc`; đăng nhập xong quay lại đúng trang này.
- **`t-student-todo.ts`**: `/api/schedule` vẫn trả `{ events: [...] }`, có buổi học lớp A và hạn nộp ngoài, không trùng `id`, 401 khi không cookie.
- **`t-no-hex.ts`, `t-kin-components.ts`**: không hex, không chữ < 11,1px, không `confirm()`.
- Cộng thêm toàn bộ "P7" ở Màn A.

## 8. Quy tắc cũng phải giữ
- **Giờ Việt Nam**: ngày, tuần, "Hôm nay" phải tính theo ngày Việt Nam (`CLAUDE-cho-kho-trien-khai.md`/`src/lib/classSessions.ts`; NC2-035 đã sửa phía máy chủ ở `studentSchedule.ts`). Giờ 24 giờ, ngày `dd/mm`, tuần bắt đầu **Thứ 2** (không phải Chủ nhật).
- **Trạng thái luôn có chữ**; màu nghĩa: xanh dương = đã lên lịch, cam = dời/chờ, đỏ = huỷ/quá hạn, xanh lá = xong (`BRIEF.md`, `CLAUDE-cho-kho-trien-khai.md` mục 6).
- **Token `--kin-*`**, không hex, chữ ≥ 11,1px, nút ≥ 44px (`BRIEF.md`, `t-no-hex.ts`, `t-kin-components.ts`).
- Không dùng ảnh/biểu tượng lạ ngoài bộ `griddy-icons` đang dùng; không emoji thay biểu tượng.
- **Không thu thập dữ liệu thêm** (học sinh có thể dưới 16 tuổi); không hiện tên học sinh khác, không hiện tiền.
- **Không bịa lịch**: chỉ hiện buổi từ khung giờ lớp thật; không dựng sự kiện mẫu (`t-no-fabricated.ts`).
- **Tôn trọng huỷ/dời của gia sư** (`sessionChange`): buổi huỷ phải còn hiện để học sinh không đi nhầm (có chú thích rõ), nhưng không cho vào học.
- Chuyển động ngắn, tắt khi `prefers-reduced-motion`.

## 9. Điều đang chưa tốt ở bản hiện tại
(Dựa trên mã; không có ảnh chụp màn học sinh trong `anh-hien-trang`.)
1. **Tính ngày theo giờ trình duyệt rồi đổi sang UTC**: `toISO(d)` dùng `d.toISOString()` trên ngày 00:00 giờ máy, nên ở múi giờ +07 ngày bị lùi 1 ngày (thứ 2 thành Chủ nhật tuần trước…). Hệ quả: tuần lọc bị lệch (có thể rơi Chủ nhật sang tuần sau), nhãn "Hôm nay" sai trong khoảng 00:00–07:00 giờ Việt Nam, chấm ngày có sự kiện lệch. Đọc từ mã, chưa chạy thử; Q4.
2. **Buổi đã huỷ vẫn có nút "Vào học"** (liên kết lớp luôn được gán) và in nguyên tiền tố `[ĐÃ HUỶ] ` / `[DỜI từ dd/mm] ` trong tên; "Việc của tôi" thì xử lý đúng (chỉ nút "Xem lịch").
3. **Lỗi tải bị nuốt**: hiện "Không có lịch nào trong tuần này" như thật; không "Thử lại".
4. **Tuần đã qua luôn trống** (máy chủ chỉ gửi từ hôm nay); nút "Tuần trước" dẫn tới trang trống không giải thích; không có lịch sử buổi đã học.
5. **Thiếu giờ kết thúc** dù dữ liệu có (`endTime`); chỉ hiện giờ bắt đầu.
6. **Đỏ dùng cho "hôm nay"** (ô ngày, viền) và cho chip "Thi thử", trong khi đỏ đang mang nghĩa nghỉ/quá hạn: gây nhầm. Nền chip dùng token chữ (`--kin-chu-tren-nut-chinh`) làm nền.
7. **Quá dày trên điện thoại**: 4 ô thống kê + lưới 8 nút ngày + hàng chip loại + thẻ viền cho từng sự kiện + hàng nút tuần cuối trang. Nút ngày (~32px cao, 8 cột ≈ 38px rộng ở 390px: 390 trừ lề 2×16, trừ đệm thẻ 2×12 và viền, trừ 7 khe 4px, chia 8), chip loại (~28px), nút tuần (~36px), nút "Vào học" (~28px) đều dưới 44px (ước tính từ lớp CSS, chưa đo).
8. **Thi thử lấy mọi đề đang mở**, không giới hạn theo lớp, nên học sinh có thể thấy đề không thuộc lớp mình (Q3).
9. Tiêu đề "Lịch học cá nhân" và "Tuần {n}" dùng số tuần tự tính (không phải tuần ISO); không có ý nghĩa với học sinh.
10. Dùng `text-white` cho chữ nút/ô ngày thay vì token chữ trên nút (`--kin-chu-tren-nut-chinh`); trong chế độ Tối có nguy cơ tương phản kém.

## 10. Mẫu học từ đối thủ
- Thanh điều hướng tuần gọn: nút "Hôm nay" giữa hai mũi tên, chuyển 3 ngày / Tuần / Tháng, vạch đỏ "bây giờ", cột ngày đã qua tô nhạt (ngày hôm nay KHÔNG được tô đặc trong ảnh; "hôm nay tô đặc" ở mục 4 là đề xuất của KiN, không phải điều ảnh này cho thấy): Sổ Gia Sư — `02-lich-tuan.jpg` (`508522051bf2be86b787fa1834c2f11c208fa17a.jpg`). Không chép lưới 7 cột × 16 giờ (ảnh cho thấy tên lớp bị cắt, giờ 07–16 trống).
- Dải ngày ngang với giờ trống ngay dưới mỗi ngày, chọn múi giờ: Preply — `2c486c983ce671e0f6b58e2b39f55aa09c483e93.jpg`.
- Lưới nút giờ 3 cột, giờ hết chỗ vừa xám vừa có chữ (đừng chỉ khác sắc độ): Preply — `a3c40ef1ec29b8c407648d1f9d8e7973b622b948.jpg`; ngày chọn viền đậm: `66e5b5d690ce454dee7cf760ce6b63ec07929518.jpg`.
- Thẻ sự kiện có vạch màu bên trái, giờ đậm nhất, danh sách "hôm nay" có điều hướng ngày: TutorBird — `2b42778202338e054738963f94987070146fba2c.jpg`.
- Thanh chuyển Tuần/Ngày + nút Hôm nay + mũi tên: Teachworks — `313a202fb15a9b3fbeaae5fa21c53d13e26c9fbe.jpg`. Không chép: tuần bắt đầu Chủ nhật, 7 cột hẹp trên điện thoại, khung hướng dẫn dài ở đầu lịch.
- Lịch tháng khoanh tròn hôm nay: TutorBird — `d9a48bb81ed1088b1d3fbf33203016a338ed751a.jpg` (chỉ để tham khảo, không dùng trên điện thoại: ô ~110px, chữ chip nhỏ).
- Lịch 7 ngày của Shub học sinh có tab "Lịch học" nhưng bị nút "Hỏi đáp" che: không chép phần che — `11a4cd13870ab67784094443ad71645be24a7000.jpg`.

## 11. Dữ liệu mẫu để điền vào thiết kế
Học sinh Đỗ Hà; hôm nay Thứ 5 22/10/2026 16:30; tuần 19/10 – 25/10 (chỉ hiện từ hôm nay trở đi).
1. Tiêu đề "Lịch học" · "Tuần này · 19/10 – 25/10".
2. **Hôm nay · Thứ 5 22/10 — 0 hoạt động** (ngày không có buổi: hiện dòng xám "Hôm nay không có buổi nào").
3. **Thứ 6 23/10 — 1 hoạt động**: `19:00–20:30` · `Toán 9` · "toán · Buổi học" · Sắp tới · nút `Vào học` (Cô Lan dạy; lớp 2 học viên).
4. **Thứ 7 24/10 — 1 hoạt động**: `16:00–17:30` · `Văn 8` · "văn · Buổi học" · Sắp tới · nút `Vào học`.
5. **Chủ nhật 25/10 — 2 hoạt động**: `08:00` · `Thi thử Toán 9 — đề số 3` · "toán · Thi thử" · nút `Vào thi`; `23:59` · `Đề cương Văn 8` · "Văn 8 · Deadline" · nút `Nộp bài` (hạn nộp ngoài trên Azota, do gia sư gắn vào bài giảng; KHÁC với bài tập nộp trong KiN như "Phiếu ôn tập Văn 8" ở mẫu Màn A, loại đó không hiện ở Lịch).
6. Tuần sau 26/10 – 01/11: `Thứ 6 30/10 19:00–20:30 Toán 9`; `Thứ 7 31/10 16:00–17:30 Văn 8`.
7. Biến thể buổi huỷ: `Thứ 6 23/10` · `Toán 9` gạch ngang · "Đã huỷ" (đỏ), không có nút `Vào học`.
8. Biến thể buổi dời: `Thứ 7 24/10 17:00` · `Văn 8` · "Đã dời" (cam) · "từ 24/10" (dữ liệu hiện chỉ có NGÀY gốc; muốn hiện giờ cũ "16:00" thì phải thêm dữ liệu, xem Q7).
9. Chip loại: Tất cả · Buổi học (2) · Thi thử (1) · Deadline (1). (Con số trong ngoặc là ĐỀ XUẤT, hiện chưa có.)
10. Tuần trống: "Không có lịch nào trong tuần này" · "Thử chuyển sang tuần khác".
11. Chuông: 2 chưa đọc (khớp mẫu Màn A). Chip Coin: `58 Coin`.

## 12. Câu hỏi còn mở
Câu THỰC SỰ cần chủ dự án quyết: Q3 (học sinh thấy đề thi của lớp nào: liên quan quyền riêng tư giữa các lớp), Q5 (có cho xem buổi đã qua), Q7 (hiện buổi huỷ/dời thế nào, có thêm giờ cũ), Q1 và Q2 (thêm trường dữ liệu vào API; chỉ là giờ và mã lớp, không phải dữ liệu cá nhân của em). Việc kỹ thuật, người dựng tự làm theo mặc định: Q4 (mục 9 điểm 1 là LỖI múi giờ cần sửa chứ không phải lựa chọn; chỉ chọn sửa ở trình duyệt hay ở máy chủ), Q6, Q8, Q9. Không câu nào ở đây đổi cách tính tiền hay thêm dữ liệu trẻ em.
1. Thêm giờ kết thúc vào `ScheduleEvent` (dữ liệu `ClassSchedule.endTime` có sẵn) để hiện "19:00–20:30"? Mặc định: có; đây là việc nhỏ nhất làm lịch đỡ thiếu nhất.
2. Thêm `courseId` vào `ScheduleEvent` để tô màu theo lớp (`classAccent`) như brief ("lịch có màu theo lớp")? Mặc định: có; nếu không thì tô theo loại sự kiện.
3. Thi thử trong Lịch: hiện mọi đề đang mở hay chỉ đề của lớp đã vào (có `Exam.courseId`)? Mặc định: chỉ đề gắn với lớp của em, cộng đề công khai nếu chủ dự án muốn.
4. Sửa tính tuần/ngày ở trình duyệt theo ngày Việt Nam (mục 9.1) hay để máy chủ trả sẵn `today` và các ngày của tuần? Mặc định: máy chủ trả `today` theo `vnDateKeyOf`.
5. Cho học sinh xem buổi ĐÃ qua (lịch sử vài tuần) hay chỉ từ hôm nay? Nếu chỉ từ hôm nay thì bỏ/mờ nút "Tuần trước" khi ở tuần này.
6. Bỏ 4 ô thống kê và lọc theo ngày (thay bằng dải ngày cuộn tới)? Mặc định: bỏ ô thống kê, giữ chip loại khi có ≥2 loại.
7. Buổi đã huỷ có hiện không (mặc định: hiện, gạch ngang, không nút), và buổi dời hiện cả giờ cũ?
8. Nút chính của màn: có thêm "Vào học" nổi cho buổi sắp diễn ra trong 2 giờ (như "Việc của tôi" cho vào kịp)? Mặc định: không, dùng nút trên dòng.
9. Tuần tiếp theo tối đa xem bao xa (dữ liệu hiện 90 ngày)?

---

# Màn C. Lớp của tôi

Route: `/lop-cua-toi` (danh sách), `/lop-cua-toi/[courseId]` (một lớp), `/student/hoc-tap?course=<mã lớp>` (đường học), `/student/nhap-ma-lop` (vào lớp bằng mã). Tệp mã chính: `src/app/lop-cua-toi/(tutor)/page.tsx` (nhánh học sinh), `src/app/lop-cua-toi/[courseId]/OutlookShell.tsx`, `src/app/(student)/student/hoc-tap/page.tsx`, `src/app/(student)/student/nhap-ma-lop/page.tsx` (+ `src/components/student/InviteCodeInput.tsx`). Vai: học sinh (cùng các trang này gia sư thấy bản khác).

Ghi chú cấu trúc hiện tại (rất quan trọng cho nhà thiết kế): thanh module nút "Lớp" đang trỏ tới `/student/hoc-tap`, trang này tự nhảy vào LỚP ĐẦU TIÊN trong danh sách ghi danh còn hiệu lực (nếu có; "đầu tiên" theo thứ tự cơ sở dữ liệu trả về, vì `/api/enrollments` không sắp xếp nên không bảo đảm là lớp mới nhất hay cũ nhất), nên học sinh có nhiều lớp không thấy danh sách lớp. Danh sách lớp thật nằm ở `/lop-cua-toi` (chỉ vào được qua trang lớp "← Lớp của tôi" hoặc trang `/ban-do`). Có ba trang chồng nhau: danh sách (`/lop-cua-toi`), trang lớp 4 mục (`/lop-cua-toi/<lớp>`) và đường học (`/student/hoc-tap`).

## 1. Mục đích và người dùng
- Cho học sinh thấy mình đang học những lớp nào, vào một lớp để học tiếp (bài giảng, bài tập), xem tài liệu của lớp, và vào lớp mới bằng mã mời của gia sư.
- Học sinh học miễn phí với KiN; học phí do gia sư thu trực tiếp. Không có bước "mua lớp" (quyết định D01; test `ui-library-links.ts` kiểm không còn "Mua khóa học ngay").
- Người dùng: học sinh, thường là điện thoại, có thể dưới 16 tuổi.

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)
1. Học tiếp bài kế tiếp của lớp ("Tiếp tục học").
2. Chọn lớp khác nếu học nhiều lớp.
3. Mở tài liệu và bản ghi của lớp ("Tài liệu & bản ghi của lớp này").
4. Xem lịch hoặc học phí của lớp.
5. Vào lớp mới bằng mã mời: gõ mã, xem trước (gia sư, lịch, học phí), bấm "Vào lớp này".
6. Xem tiến độ (phần trăm, số bài đã học).

## 3. Dữ liệu hiển thị
**3.1 Danh sách lớp `/lop-cua-toi` (học sinh)**: truy vấn `prisma.enrollment.findMany({ userId, status: "active" })` + `course {id, name, category}`, sắp theo `createdAt` mới nhất.

| Tên hiển thị | Nguồn trong mã (tệp + trường/hàm) | Định dạng | Ví dụ |
|---|---|---|---|
| Tên lớp | `course.name` | chữ đậm, liên kết tới `/lop-cua-toi/<id>` | `Toán 9` |
| Môn | `course.category` | chữ thường như lưu | `toán` |
| Trạng thái | cứng "Đang học" (không đọc cột nào) | | `Đang học` |
| Đầu trang | "Lớp bạn đang học · {n} lớp" | | `Lớp bạn đang học · 2 lớp` |
| Lối tắt trên thẻ | cứng: "Lịch học" → `/student/lich-hoc`; "Học phí" → `/student/hoc-phi` | | |
| Tên gia sư | `Course.instructor` (có ở API `/api/courses/[id]`, chưa có trong truy vấn danh sách) | | cần thêm (Q2) |
| Buổi kế tiếp | tính từ `ClassSchedule` (chưa có trong truy vấn) | | cần thêm (Q2) |

**3.2 Trang một lớp `/lop-cua-toi/[courseId]`** (`OutlookShell`): `course.id`, `course.name`, `course.category`; nhánh học sinh chỉ khi có `Enrollment` `active` (nếu không: 404, không lộ lớp tồn tại). Mục: "Tổng quan" (chỉ hai câu chữ, không nút), "Lịch học", "Bài tập", "Học phí" (ba mục này mỗi mục chỉ là một khối chữ + nút "Mở trang →"). Từ dưới 640px nhãn mục nằm trong ô chọn `<select>`, từ 640px trở lên là danh sách bên trái rộng 224px.

**3.3 Đường học `/student/hoc-tap`** (`GET /api/courses/<id>`, `useProgress`, `useEnrollments`):

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Tên lớp | `course.name` | h1 | `Toán 9` |
| Môn | `course.category` | chữ nhỏ trên tên | `toán` |
| Gia sư | `course.instructor` | "Gia sư: {tên}" | `Gia sư: Cô Lan` |
| Số giờ video / số bài | `course.hours`, `course.lessons` | "{n}h video", "{n} bài học" | `0h video` |
| Tiến độ | `completedCount / allLessons.length`, `pct` | "{pct}%" + "hoàn thành" + "{done}/{total} bài" + thanh tiến độ | `40%`, `2/5 bài` |
| Vạch màu đầu thẻ | `course.strip` | màu lưu trong DB | |
| Nút bài kế tiếp | `nextLesson` = bài đầu tiên chưa xong và không khoá | "Bắt đầu học" (chưa xong bài nào) / "Tiếp tục học" | |
| Chương | `course.sections[]` (`title`, `chapters[].lessons[]`) | tiêu đề in hoa + "{done}/{n} bài hoàn thành" | |
| Bài | `lesson.title`, `type`, `duration`, `isLocked`, `isFree` | huy hiệu loại: "Video" (`record`), "Live", "Bài tập" (`quiz`), "Tài liệu"; "FREE" | |
| Đã vào lớp chưa | `enrolledIds.has(courseId)` (`GET /api/enrollments` → `courseIds`) | | |

**3.4 Vào lớp bằng mã `/student/nhap-ma-lop`** (`GET /api/invites/by-code/<mã>` sau 400ms; `POST /api/invites/<mã>/redeem`): `course.name`, `course.owner.name` (gia sư), `schedule[]` (`scheduleLabel()` → ví dụ "Gia sư chưa đặt lịch cố định"), `tuition` (`tuitionLabel()` → "70.000đ một buổi khi học 1 môn · tính theo tháng"), `taught` (`taughtLabel()` → "Chưa học buổi nào" / "{n} buổi"), `maxUses`/`usedCount` ("Còn {n} / {max} lượt dùng."), `expiresAt` ("Mã hết hạn: dd/mm/yyyy."), `course.classStatus` (đóng → "Lớp đang đóng — không nhận thêm."), `alreadyEnrolled`.

## 4. Bố cục đề xuất
Đề xuất gộp trải nghiệm thành MỘT luồng rõ: **Lớp (danh sách) → một lớp (đường học)**, bỏ trang trung gian 4 mục (chỉ nhánh học sinh của `/lop-cua-toi/[courseId]`; nhánh gia sư của cùng trang vẫn dùng). Chỉ làm khi chủ dự án chốt Q1; nếu không, thiết kế từng trang bên dưới trong khuôn hiện có.

### 4.1 Điện thoại 390px
**Danh sách lớp** (`/lop-cua-toi`, là đích của nút "Lớp" nếu chốt Q1):
1. Tiêu đề "Lớp của tôi" (h1, 19,2px) + dòng phụ "Lớp bạn đang học · 2 lớp" (13,3px xám).
2. (Khi ≥ 2 lớp, ĐỀ XUẤT) không dựng bộ lọc; danh sách đủ ngắn.
3. Mỗi lớp là MỘT dòng, không khung thẻ, ngăn bằng đường kẻ mảnh: vạch màu lớp 3px bên trái (`classAccent(course.id)`) · tên lớp 16px đậm (xuống dòng nếu dài, không cắt) · dòng xám "toán · Cô Lan" · dòng xám "Buổi kế tiếp: Thứ 6 19:00" (ĐỀ XUẤT, cần thêm dữ liệu; nếu chưa có thì bỏ dòng này). KHÔNG lặp chữ "Đang học" ở mọi dòng: danh sách chỉ lấy lớp đang học nên chữ đó luôn giống nhau, không thêm thông tin (đã nói ở dòng phụ "Lớp bạn đang học · n lớp"); mỗi lớp tối đa 3 dòng chữ. Vạch màu chỉ trang trí (xem P2: bộ màu lớp có hai màu trùng và ba màu dưới 3:1), tên lớp bằng chữ mới là thứ nhận diện. Cả dòng chạm được (≥ 50px) mở lớp. KHÔNG dựng hai nút phụ "Lịch học"/"Học phí" trên mỗi dòng (hiện có, dày, ≈32px cao); lối tới Lịch và Học phí đã có ở thanh module và menu tài khoản.
4. Cuối danh sách: một nút viền "Nhập mã mời" (secondary, rộng toàn chiều ngang) → `/student/nhap-ma-lop`. Đây là lối vào lớp mới duy nhất cần thấy ở màn này.

**Một lớp / đường học** (`/student/hoc-tap?course=<id>`):
1. Dòng đường dẫn "← Lớp của tôi" (ĐỀ XUẤT; hiện là "← Khóa học" → `/khoa-hoc`) + tên lớp.
2. Đầu lớp: vạch màu mỏng, môn (11,1px), tên lớp (19,2px), "Gia sư: {tên}", một dòng "{n} bài học". Bỏ "{h}h video" khi bằng 0 (lớp của gia sư không phải video).
3. Tiến độ: một số lớn "40%" + nhãn "hoàn thành" + thanh mảnh 6px + "{done}/{total} bài" (một dòng, không bốn).
4. **Một nút chính**: "Tiếp tục học" / "Bắt đầu học" (rộng toàn chiều ngang, 44px+). Khi đã xong MỌI bài: dòng chữ "✓ Đã hoàn thành khóa học" nền `--kin-tt-nen-xong` (hiện có; nhưng mã hiện hiện nhầm dòng này cả khi mọi bài còn khoá hoặc lớp chưa có bài nào, xem mục 9 điểm 9: khi dựng cần tách rõ ba trường hợp "đã xong hết", "chưa có bài nào mở", "còn bài kế tiếp").
5. Một liên kết phụ chữ xanh: "Tài liệu & bản ghi của lớp này →" (cao ≥ 44px).
6. "Nội dung khóa học": các chương xếp dọc; chương mở sẵn; dòng bài cao ≥ 44px: vòng trạng thái (xong/kế tiếp/khoá) · tên bài (xuống dòng, không cắt) · huy hiệu loại bằng chữ. Bài kế tiếp có vạch trái `--kin-nhan-nen`. Bài khoá có ổ khoá + chữ.

**Vào lớp bằng mã** (`/student/nhap-ma-lop`): giữ nguyên cấu trúc của Figma 32:54: một thẻ rộng tối đa 420px: tiêu đề "Vào lớp"; ô mã cao 48px; (sau khi gõ đủ) thẻ xem trước; khối "Vào lớp là đồng ý ba điều"; hai nút xếp dọc "Vào lớp này" (chính) và "Không phải lớp của tôi"; chân thẻ. ĐỀ XUẤT chỉ gọn khoảng cách, không đổi chữ (chữ bị test khoá, mục 7).

### 4.2 Máy tính 1280px
- **Danh sách**: cột đọc rộng tối đa ≈ 720px căn trái, cùng dòng như điện thoại (thêm khoảng cách), nút "Nhập mã mời" nằm phía trên bên phải hàng tiêu đề.
- **Đường học**: hai cột — trái ≈ 720px là "Nội dung khóa học"; phải ≈ 280px dính trên cùng: tên lớp, tiến độ, nút "Tiếp tục học", liên kết "Tài liệu & bản ghi của lớp này →". Không đặt hai cột trên điện thoại.
- **Vào lớp bằng mã**: thẻ 420px căn giữa như hiện nay.

## 5. Hành động
| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| Lớp (nút thanh module) | Mở đường học | `/student/hoc-tap` (tự nhảy vào lớp đầu tiên của `/api/enrollments`, thứ tự không bảo đảm) | Xem Q1 |
| (một lớp trong danh sách) | Mở trang lớp | `/lop-cua-toi/<id>` | 404 nếu không có `Enrollment` active |
| Lịch học (nút phụ trên thẻ lớp) | Mở lịch | `/student/lich-hoc` | Không lọc theo lớp |
| Học phí (nút phụ trên thẻ lớp) | Mở học phí | `/student/hoc-phi` | |
| ← Lớp của tôi (trang lớp) | Về danh sách | `/lop-cua-toi` | |
| Tổng quan / Lịch học / Bài tập / Học phí (mục điều hướng trang lớp; điện thoại: ô chọn `<select>`) | Đổi khối nội dung | Không gọi API | `OutlookShell` |
| Mở trang → | Mở trang thật của mục | Lịch học → `/student/lich-hoc`; Bài tập → `/student/hoc-tap`; Học phí → `/student/hoc-phi` | Bài tập không mang `?course=` nên mất ngữ cảnh lớp |
| ← Khóa học | Quay lại | `/khoa-hoc` | Hiện trỏ danh mục công khai, không phải "Lớp của tôi" |
| Bắt đầu học / Tiếp tục học | Mở bài kế tiếp | `/student/bai-giang/<lessonId>` | Chỉ khi đã vào lớp |
| Xem lớp học → | Mở trang công khai của lớp | `/khoa-hoc/<id>` | Hiện khi CHƯA vào lớp; không có nút mua (D01) |
| Tài liệu & bản ghi của lớp này → | Sang Thư viện, khối của lớp | `/thu-vien#c-<id>` (`data-thu-vien-link`) | Chỉ hiện khi đã vào lớp; cao ≥ 44px |
| (chương) | Mở/đóng chương | Không gọi API | |
| (một bài) | Mở bài giảng | `/student/bai-giang/<lessonId>` | Bài khoá (`isLocked`) bị vô hiệu |
| ← Khóa học (ở trạng thái lỗi) / Thử lại | Về danh mục / tải lại | `router.refresh()` | Xem mục 9 |
| Tôi có mã mời vào lớp (ở trang đăng nhập) | Tới trang nhập mã | `/student/nhap-ma-lop` | Khách; sau khi đăng nhập |
| Mã mời (ô nhập) | Gõ mã, tự kiểm tra sau 400ms | `GET /api/invites/by-code/<mã>` | Chỉ giữ chữ/số, ép in hoa, tối đa 20 ký tự; mã ≥ 4 ký tự mới kiểm |
| Vào lớp này | Ghi danh | `POST /api/invites/<mã>/redeem` rồi `/student/hoc-tap?course=<id>` | Ghi dữ liệu; khoá khi chưa có xem trước hợp lệ, khi đang vào, hoặc đã trong lớp |
| Không phải lớp của tôi | Xoá mã, về ô nhập | Không gọi máy chủ | Phòng vào nhầm lớp |
| Vào lớp ngay → | (đã trong lớp) mở lớp | `/student/hoc-tap?course=<id>` | |

## 6. Trạng thái
| Trạng thái | Chữ chính xác trong mã | Ghi chú |
|---|---|---|
| Danh sách lớp trống | "Bạn chưa đăng ký lớp nào." | Hiện không có nút; ĐỀ XUẤT thêm nút "Nhập mã mời" |
| Danh sách lớp có dữ liệu | "Lớp bạn đang học · {n} lớp" | |
| Trang lớp không có quyền / không tồn tại | Trang 404 (không lộ lớp) | |
| Đường học: chưa chọn lớp, đang chờ danh sách | Hai khối xám nhấp nháy (tiêu đề + thẻ) | |
| Đường học: chưa có lớp nào | Biểu tượng sách + "Bạn chưa có khóa học nào." + "← Khóa học" | Từ vựng "khóa học" lệch với "lớp" |
| Đường học: đang tải | Khung xương (`SkeletonBlock`): tiêu đề, thẻ, ba chương × 3 dòng | |
| Đường học: lỗi / lớp không còn | "Không tìm thấy khóa học" (mọi lỗi tải đều ra câu này, kèm nút "Thử lại" của `ErrorState`) + "← Về danh sách khóa học". Câu dài hơn "Không tìm thấy khóa học — có thể bạn đã rời lớp hoặc lớp đã đóng." nằm trong mã nhưng gần như không bao giờ hiện, vì lỗi tải luôn đã đặt câu ngắn trước | `ErrorState` (`role=alert`); bài `ui-role-everything` mở `/student/hoc-tap?course=khong-co` và đòi có lời giải thích khớp một trong các cụm "không tìm thấy", "không tồn tại", "không hợp lệ", "hết hạn", "không có quyền", "chưa vào lớp", "không còn", "sai"… và có ít nhất một liên kết nhìn thấy để đi tiếp |
| Đường học: chưa vào lớp này | "Bạn chưa vào lớp này" + "Xem lớp học →" | Không có "Tài liệu & bản ghi…" |
| Đường học: chưa có bài mở (mọi bài khoá, hoặc lớp chưa có bài nào) | KHÔNG im lặng như tưởng: mã hiện nhầm khung xanh "✓ Đã hoàn thành khóa học", vì nhánh "không có bài kế tiếp" không phân biệt "đã xong hết" với "không còn bài nào mở được" | Lỗi hiện tại, xem mục 9 điểm 9; cần câu riêng (Q7) |
| Đường học: đã hoàn thành | "✓ Đã hoàn thành khóa học" | Hiện cũng hiện khi mọi bài khoá hoặc lớp rỗng (điểm trên) |
| Bài khoá | Ổ khoá + mờ 50% | |
| Nhập mã: ô trống | Nút "Vào lớp này" khoá | |
| Nhập mã: dưới 4 ký tự | "Mã có ít nhất 4 ký tự." | |
| Nhập mã: đang kiểm | Khung xương thẻ (`aria-busy`, `aria-label` "Đang kiểm tra mã"), không vòng xoay | |
| Nhập mã: sai | Hộp đỏ `role=alert`: lỗi từ máy chủ (ví dụ "Mã mời không tồn tại"), hoặc "Mã không hợp lệ", "Không kết nối được máy chủ.", "Bạn cần đăng nhập để nhập mã mời." | Nút vẫn khoá |
| Nhập mã: hợp lệ | Thẻ "Bạn sắp vào lớp" + các dòng "Gia sư", "Lịch", "Học phí", "Đã học" (đúng thứ tự) | |
| Nhập mã: mã bị thu hồi / hết hạn / hết lượt | Hộp đỏ `role=alert` với câu của máy chủ: "Mã mời đã bị thu hồi" / "Mã mời đã hết hạn" / "Mã mời đã hết lượt sử dụng"; không có thẻ xem trước | Nút vẫn khoá |
| Nhập mã: mã còn dùng được, có chú thích | Dưới thẻ xem trước: "Lớp đang đóng — không nhận thêm. Còn {n} / {max} lượt dùng. Mã hết hạn: dd/mm/yyyy." (mỗi vế chỉ hiện khi có: lớp đóng; mã có giới hạn lượt; mã có hạn dùng còn ở tương lai) | Chữ cam khi lớp đóng. Nút "Vào lớp này" KHÔNG khoá khi lớp đóng; máy chủ từ chối lúc bấm (dòng "lỗi vào lớp" bên dưới) |
| Nhập mã: đã trong lớp | "Bạn đã trong lớp này rồi." + nút "Bạn đã trong lớp" (khoá) + "Vào lớp ngay →" | |
| Nhập mã: đang vào | "Đang vào lớp…" | |
| Nhập mã: thành công | Toast "Đã vào lớp!" rồi chuyển tới lớp | |
| Nhập mã: lỗi vào lớp | Toast lỗi: câu của máy chủ, ví dụ "Lớp đang đóng, không nhận học viên mới", "Lớp đã đầy", "Mã mời đã hết lượt sử dụng", "Chỉ học viên mới redeem mã mời" (quản trị đang xem thử, chữ có tiếng Anh "redeem"), hoặc "Không tham gia được lớp" / "Mạng lỗi, thử lại sau." | Chữ máy chủ do `src/app/api/invites/[id]/redeem/route.ts` trả; đừng bịa câu khác |

## 7. Chữ bắt buộc giữ nguyên
**`ui-invite-input.ts`** (trang `/student/nhap-ma-lop`): ô nhập có nhãn truy cập "Mã mời lớp" (và nhãn hiện "Mã mời"), placeholder "Mã mời (8 ký tự)" (có trong mã nhưng test không kiểm chữ này); "Mã có ít nhất 4 ký tự."; "Mã mời không tồn tại" (lỗi máy chủ); thẻ "Bạn sắp vào lớp"; các `dt` đúng thứ tự "Gia sư", "Lịch", "Học phí", "Đã học"; "Gia sư chưa đặt lịch cố định"; "Chưa học buổi nào"; "70.000đ một buổi khi học 1 môn · tính theo tháng"; "Còn 3 / 3 lượt" (`Còn {n} / {max} lượt dùng.`); khối "Vào lớp là đồng ý ba điều" và câu chứa "KiN không giữ tiền, gia sư thu trực tiếp"; chân trang "Xem trước rồi mới vào" và câu chứa "gõ nhầm một ký tự là vào nhầm lớp người khác"; nút "Vào lớp này", "Không phải lớp của tôi" (cao ≥ 44px, cùng chiều rộng); sau "Không phải lớp của tôi": ô rỗng, thẻ biến mất, ô nhập được focus; không `.animate-spin`; điện thoại 390 không tràn ngang; sau "Vào lớp này" → `/student/hoc-tap` và bản ghi `Enrollment` `active`. Còn kiểm: ô nhập tự lọc ký tự lạ và in hoa ("zz-zz yy99" thành "ZZZZYY99"); thẻ xem trước phải hiện tên lớp và tên gia sư (giá trị `dd` ngay sau `dt` "Gia sư"); xoá bớt ký tự xuống dưới 4 thì thẻ biến mất và nút "Vào lớp này" khoá lại; gõ nhanh đổi mã thì kết quả mã cũ không đè mã mới; `?code=` điền sẵn và kiểm luôn; ban đầu nút "Vào lớp này" khoá.

**`ui-journey-new-student.ts`** (J4): `/student/nhap-ma-lop?code=<mã>` → nút "Vào lớp này" → `/student/hoc-tap?course=<id>` và trang hiện đúng tên lớp.

**`ui-library-links.ts`**: ở đường học, học sinh ĐÃ vào lớp thấy phần tử `[data-thu-vien-link]` có chữ chứa "Tài liệu" và "bản ghi" ("Tài liệu & bản ghi của lớp này →"), `href` đúng `/thu-vien#c-<mã lớp>`, cao ≥ 44px; ở Thư viện, `[data-lop-link]` "Học tiếp trong lớp →" trỏ `/student/hoc-tap?course=<mã lớp>`; người CHƯA vào lớp thấy "Xem lớp học →", KHÔNG thấy "Mua khóa học ngay", KHÔNG có `[data-thu-vien-link]`.

**`ui-role-everything.ts`**: học sinh mở `/lop-cua-toi/lich`, `/lop-cua-toi/lop`, `/lop-cua-toi/tong-quan`, … (trang của gia sư) → về `/lop-cua-toi` trong vỏ học sinh; mở `/lop-cua-toi/hoc-phi` hoặc `/lop-cua-toi/doanh-thu` → về `/student/hoc-phi`; `/lop-cua-toi/khong-co-lop`, `/student/hoc-tap?course=khong-co` và `/student/nhap-ma-lop?code=SAIMA999` phải có lời giải thích (không trắng, không sập), trong đó chữ phải khớp một trong các cụm "không tìm thấy", "không tồn tại", "không hợp lệ", "hết hạn", "không có quyền", "chưa vào lớp", "chưa đăng ký", "không còn", "không đúng", "sai"… (đổi câu báo lỗi thì giữ một cụm này) và trang phải còn ít nhất một liên kết nhìn thấy để đi tiếp (không ngõ cụt); không rò bài/tài liệu của lớp khác; bài trả phí khi chưa vào lớp: "dành cho học sinh của lớp", không chữ "mua khóa học", có lối "Nhập mã mời" (`a[href="/student/nhap-ma-lop"]`).

**`ui-sidebar.ts`**: ở `/student/nhap-ma-lop` gõ "[" vào ô nhập không làm thanh bên đổi (phím tắt không nuốt ký tự).

**`ui-student-shell.ts`**, **`ui-motion-app.ts`** (thuộc P7): module "Lớp" là liên kết có chữ bắt đầu "Lớp" (kiểm `^Lớp`); `/lop-cua-toi` của gia sư (cùng vỏ rail) không thuộc gói này.

**`t-course-ids.ts`**: mã lớp là đoạn đường dẫn `/lop-cua-toi/<mã>`; mọi trang cố định dưới `src/app/lop-cua-toi` phải nằm trong danh sách tên giữ chỗ (`src/lib/courseIds.ts`): đừng thêm trang mới cố định dưới `/lop-cua-toi` mà không cập nhật danh sách đó; test kiểm cả chiều ngược lại (danh sách không được chứa mã thừa không ứng với trang nào), nên cũng đừng xoá trang cố định mà để mã trong danh sách. Đề xuất "bỏ trang trung gian 4 mục" chỉ là bỏ NHÁNH HỌC SINH của trang động `[courseId]`; nhánh gia sư của cùng tệp `OutlookShell.tsx` (Điểm danh, Danh sách HS, Quản khoá, Mã mời…) vẫn đang dùng nên không xoá trang, và không đụng danh sách tên giữ chỗ.

Cộng thêm toàn bộ "P7" ở Màn A.

## 8. Quy tắc cũng phải giữ
- **Học sinh học miễn phí, KiN không giữ học phí; không có bước mua lớp** (`CLAUDE-cho-kho-trien-khai.md` mục 1; D01; `ui-library-links.ts`). Không dựng nút "Mua", "Nạp", "Đăng ký có phí".
- **Không hiện tiền ở danh sách lớp** (học phí xem ở `/student/hoc-phi`); học phí hiện ở trang nhập mã là mức "một buổi" của chính lớp đó, đúng thiết kế Figma 32:54.
- **Xem trước rồi mới vào** (Figma 32:54, FE-125/126): học sinh phải thấy tên gia sư và mức học phí TRƯỚC khi bấm "Vào lớp này".
- **Trẻ dưới 16 tuổi / đồng ý của người giám hộ**: câu "Vào lớp là đồng ý ba điều" nói rõ gia sư và phụ huynh thấy điểm danh, điểm bài. Đồng ý kép cho trẻ từ 7 tuổi (Nghị định 13/2023) là việc CHƯA chốt (`CLAUDE-cho-kho-trien-khai.md` mục 8; `docs/kin/bao-cao/cau-hoi-luat-su.md`); đừng đổi chữ này hay thêm ô đồng ý mới khi chưa hỏi chủ dự án.
- **Quyền**: trang lớp chỉ cho người có `Enrollment` `active` (hoặc gia sư chủ lớp / quản trị cấp cao); người khác thấy 404, không lộ lớp tồn tại (`/lop-cua-toi/[courseId]/page.tsx`).
- **Thư viện và tài liệu của lớp chỉ hiện sau khi đã vào lớp.**
- **Nút ≥ 44px, chữ ≥ 11,1px, token `--kin-*`, không hex, không vòng xoay** (`BRIEF.md`, `t-no-hex.ts`, `t-kin-components.ts`).
- **Trạng thái luôn có chữ**, màu không nói một mình.
- **Không bịa** tiến độ/giờ video: chỉ hiện số có trong dữ liệu (nên ẩn "0h video").
- **Mã mời**: mã do KiN sinh dài 8 ký tự, chỉ gồm số 2–9 và chữ in hoa, bỏ các ký tự dễ nhầm 0, 1, I, O, U (31 ký tự, `ALPHABET` trong `src/lib/classInvite.ts`); ô nhập vẫn nhận mọi chữ/số rồi ép in hoa, tối đa 20 ký tự. Không hiện số điện thoại phụ huynh ở bất kỳ đâu (`docs/kin/tien-do-dang-do.md`, mục về mời hàng loạt).
- **Ghi dữ liệu bằng POST + chuyển trang** (`CLAUDE-cho-kho-trien-khai.md` mục 5, điều 5): "Vào lớp này" hiện gọi `fetch POST` rồi `router.push`; giữ cách này (không dùng server action).
- Chủ dự án: bài tập/đề/Coin; học sinh không nạp Coin, không game cược; xem Màn A mục 8.

## 9. Điều đang chưa tốt ở bản hiện tại
(Dựa trên mã; không có ảnh chụp màn học sinh trong `anh-hien-trang`.)
1. **Ba trang chồng nhau cho một ý "lớp của tôi"**: danh sách (`/lop-cua-toi`), trang lớp 4 mục (`/lop-cua-toi/<lớp>`), đường học (`/student/hoc-tap`). Nút "Lớp" nhảy thẳng vào lớp đầu tiên nên học sinh nhiều lớp không thấy danh sách và không có chỗ chọn lớp khác từ đường học.
2. **Trang lớp 4 mục gần như rỗng**: mỗi mục chỉ là một khối chữ + "Mở trang →", dùng biểu tượng emoji (bảng ghi chú, lịch, giấy bút, túi tiền); "Tổng quan" nói "Chào mừng đến hộp việc của {lớp}. Danh sách việc bên trái…" (từ vựng của gia sư); ghi chú lộ mã nội bộ và tiếng Anh: "Breakdown theo môn + VietQR (TK-173)."; "Bài tập" mở `/student/hoc-tap` không mang `?course=`; "Lịch học" mở lịch của mọi lớp.
3. **Danh sách lớp**: trạng thái "Đang học" gõ cứng; thẻ có khung + 2 nút phụ (≈32px cao) lặp ở mọi lớp; thiếu gia sư, buổi kế tiếp, tiến độ; trống không có nút (chỉ chữ "Bạn chưa đăng ký lớp nào."; nhánh dành cho quản trị không phải gia sư, cùng trang, lại nói "Bạn chưa mở lớp nào. Tạo lớp mới ở /admin/khoa-hoc." bằng đường dẫn thô; gia sư thật không vào nhánh này vì được chuyển sang Hộp việc).
4. **Đường học**: nút quay lại "← Khóa học" trỏ `/khoa-hoc` (danh mục công khai) thay vì "Lớp của tôi"; từ vựng "khóa học", "video" lệch với "lớp"; "{h}h video" hiện "0h" cho lớp không có video; 3 khối tiến độ (số lớn, thanh, "n/m bài") nói cùng một việc; lỗi dùng `router.refresh()` làm nút thử lại, nhưng dữ liệu tải trong `useEffect` theo `courseId` nên nút này có thể không tải lại gì (đọc từ mã, chưa chạy thử).
5. **Trang nhập mã**: chân trang viết cho người làm sản phẩm chứ không cho học sinh ("Đừng cho bấm 'vào lớp' khi chưa thấy tên gia sư và mức học phí… lúc đó mới cãi nhau tiền"); chữ này bị `ui-invite-input.ts` khoá một phần ("gõ nhầm một ký tự là vào nhầm lớp người khác", "Xem trước rồi mới vào"). Lối vào trang chỉ có ở trang đăng nhập, Học phí (khi chưa có lớp), Thư viện (khi chưa có lớp), bài giảng khoá; không có ở "Việc của tôi", danh sách lớp hay bảng "Khác".
6. Danh sách lớp sắp theo thời điểm ghi danh, không theo lớp có buổi sớm nhất.
7. Nút điều hướng dạng `<select>` trên điện thoại cao ≈38px (đệm 8px×2 + dòng 20px + viền; dưới 44px); nút phụ ở thẻ lớp ≈32px (ước tính từ lớp CSS, chưa đo).
8. Vỏ: "Lớp" sáng cả ở `/lop-cua-toi` và `/student/hoc-tap` nhưng hai trang trông khác hẳn nhau (một trang rộng tối đa 4xl căn giữa, một trang full width).
9. **Khung xanh "✓ Đã hoàn thành khóa học" hiện SAI** ở đường học: mã chỉ hỏi "có bài kế tiếp (chưa xong và không khoá) không?"; nếu không có thì hiện khung này, nên học sinh đã vào lớp mà mọi bài còn khoá, hoặc lớp chưa có bài nào (0/0 bài, 0%), vẫn bị báo là đã hoàn thành. Đọc từ mã, chưa chạy thử; là lỗi cần sửa chứ không phải chuyện thiết kế.
10. Ô "Đang kiểm tra mã" ở trang nhập mã và khung chờ khi chưa chọn lớp ở đường học dùng `animate-pulse`, trái quy tắc khung xương `kin-skel`; bài test chỉ cấm `.animate-spin` nên không bắt được.

## 10. Mẫu học từ đối thủ
- Danh sách lớp lọc nhanh bằng pill "Lớp của bạn / Lớp đang chờ / Lớp đã ẩn"; một hàng thanh công cụ (tìm, sắp xếp) + nút chính xanh góc phải: Shub — `b03b9eb482a1574f2f36a5bcfd692df399b7768a.jpg`. Không chép bảng 5 cột (Tên lớp + bốn cột đếm Học sinh, Bài giảng, Bài tập, Tài liệu): quá chật trên điện thoại.
- Nhập mã 5 ô gạch chân, một việc duy nhất trên thẻ giữa, nút xanh lá ngang, liên kết "Quay lại danh sách lớp" ngay dưới nút: Shub — `ef4f8038b465603058d2a661fcdee6a6d3aaf7c0.jpg`. KiN đã có bản riêng (Figma 32:54): giữ; học thêm liên kết quay lại. Không chép nền xanh đậm toàn màn (chói).
- Đầu lớp tóm tắt bằng chip nhỏ (hình thức, số buổi, số học sinh), buổi nhóm theo tuần ("Tuần này", "Tuần sau"): Sổ Gia Sư — `03-chi-tiet-lop.jpg` (`486587a87c9cf408f22b3a976fe6c4637aca565b.jpg`). Không chép "vùng nguy hiểm" và hai cột chật.
- "Lớp của tôi": thẻ gọn một nút "Vào lớp", rỗng "Bạn chưa vào lớp nào" + ô mã 5 ký tự: đề xuất ở `docs/kin/thiet-ke/hoc-sinh-giao-dien-tu-anh-doi-thu.md` (từ Shub, Wyzant).
- Trạng thái rỗng một câu + một nút hành động: Wyzant — `2e32d1cb11fc824425fdeedcb0af0e20d33cf23d.jpg`.
- Một câu hỏi một quyết định, hai lựa chọn rõ trong một hộp (áp tinh thần cho bước "Vào lớp này"): Preply — `91b83e9d73ac64ce887d21cb4a68bc05c4aac6e5.jpg`. Ảnh chỉ thấy phần đầu hộp; nút "Tiếp tục" xám tới khi chọn nằm ngoài khung ảnh (nguyên tắc đó ghi ở `docs/kin/thiet-ke/hoc-sinh-giao-dien-tu-anh-doi-thu.md` mục 3).
- Tóm tắt trước khi trả tiền (áp tinh thần cho thẻ xem trước lớp: gia sư, lịch, học phí rõ trước khi bấm): Preply — `d2a216a5990b65e39f28ca2275c767783c1431f9.jpg`. Không chép bảng giá, ví Apple Pay, thanh toán thẻ (KiN không thu học phí).

## 11. Dữ liệu mẫu để điền vào thiết kế
Học sinh Đỗ Hà ghi danh 2 lớp của Cô Lan (giasu@kin.local; Cô Lan có 7 lớp, 8 học viên).
1. Danh sách: tiêu đề "Lớp của tôi" · "Lớp bạn đang học · 2 lớp".
2. Dòng 1: vạch màu · `Toán 9` · "toán · Cô Lan" · "Buổi kế tiếp: Thứ 6 19:00" (ba dòng chữ; không lặp "Đang học", xem mục 4; chữ "Đang học" vẫn là trạng thái HIỆN TẠI trong mã).
3. Dòng 2: vạch màu khác (bộ màu lớp có thể cho hai lớp cùng màu) · `Văn 8` · "văn · Cô Lan" · "Buổi kế tiếp: Thứ 7 16:00".
4. Nút cuối danh sách: "Nhập mã mời".
5. Trống: "Bạn chưa đăng ký lớp nào." + nút "Nhập mã mời".
6. Đường học `Toán 9`: "toán" · "Toán 9" · "Gia sư: Cô Lan" · "5 bài học" · "40%" "hoàn thành" · "2/5 bài" · nút "Tiếp tục học" · liên kết "Tài liệu & bản ghi của lớp này →".
7. Chương "Chương 1. Phương trình bậc hai · 2/3 bài hoàn thành" (mã in hoa tiêu đề): bài "Công thức nghiệm" (xong, Video), "Định lí Vi-ét" (kế tiếp: bài đầu tiên chưa xong, Video), "Bài tập Vi-ét" (xong, Bài tập). Chương 2 còn 2 bài chưa xong, đủ tổng 5 bài, 2/5 = 40%.
8. Chưa vào lớp: "Bạn chưa vào lớp này" · "Xem lớp học →".
9. Nhập mã (cho một học sinh MỚI, chưa vào lớp nào của Cô Lan; với Đỗ Hà, người đã trong lớp này, thẻ sẽ là "Bạn đã trong lớp này rồi." + "Vào lớp ngay →"): ô `ABCD2345`; thẻ "Bạn sắp vào lớp · Toán 9 · Gia sư Cô Lan · Lịch: Thứ 6 · 19:00–20:30 · Học phí: 70.000đ một buổi khi học 1 môn · tính theo tháng · Đã học: Chưa học buổi nào"; "Còn 3 / 3 lượt dùng." (Định dạng lịch đúng như `scheduleLabel`: "{thứ} · {giờ bắt đầu}–{giờ kết thúc}", có dấu chấm giữa. Số môn trong học phí tính theo các lớp đang học CÙNG gia sư cộng lớp này: em đã học một môn của Cô Lan sẽ thấy "khi học 2 môn" với 60.000đ.)
10. Nhập mã sai: "Mã mời không tồn tại".
11. Khối đồng ý: "Vào lớp là đồng ý ba điều — Gia sư thấy điểm danh và điểm bài của bạn · phụ huynh gắn với bạn cũng thấy · học phí tính theo tháng, đơn giá giảm khi học nhiều môn. KiN không giữ tiền, gia sư thu trực tiếp."
12. Đã hoàn thành: "✓ Đã hoàn thành khóa học".

## 12. Câu hỏi còn mở
Câu THỰC SỰ cần chủ dự án quyết: Q1 (nút "Lớp" trỏ đâu), Q3 (giữ hay bỏ nhánh học sinh của trang lớp), Q4 (từ vựng "lớp"/"khóa học"), Q9 (đồng ý của người giám hộ cho em dưới 16 tuổi: CHƯA chốt, dừng và hỏi, đừng tự quyết). Q2 và Q6 (thêm dữ liệu vào danh sách lớp) là mở rộng truy vấn: chỉ thêm tên gia sư, buổi kế tiếp, tiến độ, không phải dữ liệu cá nhân mới của em. Q5 và Q7 chỉ cần chủ dự án duyệt chữ. Q8 đã có đáp án (không). Không câu nào đổi cách tính tiền hay thêm dữ liệu trẻ em.
1. **Nút "Lớp" trên thanh module trỏ đâu?** Mặc định đề xuất: tới danh sách `/lop-cua-toi` (thay `/student/hoc-tap`), danh sách mở lớp ở `/student/hoc-tap?course=<id>`, và bỏ trang trung gian 4 mục. Đổi `href` ở `StudentShell.tsx` chỉ ảnh hưởng nhãn "Lớp" (bài test kiểm `^Lớp`), nhưng `ui-role-everything.ts` liệt kê `/student/hoc-tap` và `/lop-cua-toi` trong các điểm vào: phải rà lại. Nếu đổi `href` sang `/lop-cua-toi` thì phải thêm `/student/hoc-tap` vào danh sách `also` của mục "Lớp" (hiện `also` chứa `/student/bai-giang`, `/student/nhap-ma-lop`, `/lop-cua-toi`), nếu không nút "Lớp" tắt sáng ở đường học và vi phạm quy tắc "đúng một `aria-current=page`". Chủ dự án chọn.
2. Thêm vào danh sách lớp: tên gia sư (`Course.instructor`) và buổi kế tiếp (từ `ClassSchedule`)? Cần mở rộng truy vấn; không thêm thì bỏ hai dòng ấy khỏi thiết kế.
3. Trang lớp 4 mục (`OutlookShell` nhánh học sinh) bỏ hẳn hay giữ? Nếu giữ: sửa chữ ("Tổng quan" đang nói về "hộp việc"), bỏ mã nội bộ và tiếng Anh, và cho "Lịch học"/"Bài tập" mang theo `?course=`.
4. Từ vựng: "lớp" hay "khóa học" cho học sinh? Mặc định: "Lớp" (đồng bộ thanh module); đổi "← Khóa học", "Bạn chưa có khóa học nào.", "Nội dung khóa học", "Đã hoàn thành khóa học" thành "lớp" — nhưng "Đã hoàn thành khóa học" chưa bị test khoá, "Nội dung khóa học" cũng không; chỉ "Xem lớp học →" và `[data-thu-vien-link]` bị khoá.
5. Chân trang nhập mã viết lại cho đúng giọng học sinh (đang nói với người làm sản phẩm)? Đổi sẽ cần sửa `ui-invite-input.ts` (hai câu bị kiểm). Mặc định: giữ hai câu bị kiểm, viết lại phần "Đừng cho bấm… cãi nhau tiền" khi chủ dự án đồng ý.
6. Có nên hiện tiến độ ngay ở danh sách lớp (cần thêm dữ liệu `useProgress` theo lớp)? Mặc định: không, chỉ ở đường học.
7. Khi mọi bài đều khoá hoặc lớp chưa có bài nào: hiện câu gì? Hiện KHÔNG có câu riêng và còn hiện nhầm khung "✓ Đã hoàn thành khóa học" (mục 9 điểm 9, là lỗi cần sửa). Mặc định đề xuất: "Chưa có bài nào được mở trong lớp này." (câu mô tả đúng sự thật, không hứa hẹn thay gia sư; KHÔNG viết kiểu "Cô Lan sẽ mở bài khi tới buổi học" vì KiN không biết gia sư định làm gì, và không gắn cứng tên một gia sư). Cần chủ dự án duyệt chữ.
8. Có thêm "Lớp đang chờ" / "Lớp đã ẩn" như Shub không? Mặc định: không (KiN không có trạng thái chờ duyệt cho học sinh).
9. "Vào lớp là đồng ý ba điều": có thêm gì cho học sinh dưới 16 tuổi (đồng ý của người giám hộ)? Việc chưa chốt, đừng tự quyết (`CLAUDE-cho-kho-trien-khai.md` mục 8).
