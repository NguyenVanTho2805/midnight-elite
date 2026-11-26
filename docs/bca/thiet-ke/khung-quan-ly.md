# Khung khu quản lý — BCA-D1-TK (26/11/2026)

Khung chung cho mọi màn `/quan-ly/*` của chủ lớp và giáo viên cộng tác. Các màn con: [Hôm nay](man-hom-nay.md), [Điểm danh](man-diem-danh.md), [Học sinh](man-hoc-sinh.md), [Buổi học](man-buoi-hoc.md).
Căn cứ: `QUYET-DINH.md` mục 2, 14, 16, 20–24; `huong-chon.md` (nền A, bảng của B, điện thoại của C); `token.md` (cả phần bổ sung khu quản lý).

## 1. Ai dùng
| Vai | Thấy gì | Không thấy |
|---|---|---|
| Chủ lớp (anh Thanh) | Mọi môn, mọi em, đơn đăng ký, gia hạn thử, chuyển chính thức, (Đợt 3: học phí) | — |
| Giáo viên cộng tác (chị Hoa, chị Thu Hương, anh Quang Minh) | Chỉ môn mình dạy: danh sách em của môn, điểm danh, record, (Đợt 3: nhập điểm) | Học phí, SĐT phụ huynh, đơn đăng ký, gia hạn/chuyển chính thức |

Anh Thanh vừa là chủ lớp vừa dạy Toán, Sử, Địa → dùng một tài khoản vai chủ lớp; không cần đổi vai.
Lọc theo vai làm **ở máy chủ** (không chỉ ẩn nút): mục nào không có quyền thì không có trong dữ liệu trả về và không có trên thanh điều hướng.

## 2. Đường dẫn
| Mục | Đường dẫn | Đợt |
|---|---|---|
| Hôm nay | `/quan-ly` | 1 |
| Điểm danh (tối nay / chọn buổi) | `/quan-ly/diem-danh` · `/quan-ly/diem-danh/[buoiId]` · `/quan-ly/diem-danh/thang?mon=toan&thang=2026-11` | 1 |
| Học sinh | `/quan-ly/hoc-sinh?mon=&loai=&lua=&het=3&q=` · `/quan-ly/hoc-sinh/[maHS]` | 1 |
| Buổi học | `/quan-ly/buoi-hoc?thang=2026-11&mon=` · `?buoi=[id]` | 1 |
| Đơn đăng ký | `/quan-ly/don` (chỉ chủ lớp) | 1 (danh sách đơn giản, đặc tả riêng) |
| Sổ điểm, Học phí | `/quan-ly/so-diem`, `/quan-ly/hoc-phi` | 3 |
| Cài đặt | `/quan-ly/cai-dat` (chỉ chủ lớp) | sau |

Mọi bộ lọc, tab, tháng, môn, buổi đang mở **nằm trên URL** (web-design-guidelines: "URL reflects state") để bấm Quay lại không mất chỗ, và gửi link được cho nhau.

## 3. Điều hướng

### Điện thoại `< 640px` — thanh dưới 5 mục
```
┌──────────────────────────────────────┐
│ ‹  Điểm danh            ● Đã lưu 22:31│ 56px đầu trang (dính)
├──────────────────────────────────────┤
│                                      │
│              nội dung                │
│                                      │
├──────┬──────┬──────┬──────┬──────────┤
│Hôm   │Điểm  │Học   │Buổi  │ Thêm  •  │ 64px + env(safe-area-inset-bottom)
│nay   │danh  │sinh  │học   │          │
└──────┴──────┴──────┴──────┴──────────┘
```
- 5 mục cố định, cùng thứ tự cho cả hai vai: **Hôm nay · Điểm danh · Học sinh · Buổi học · Thêm**. 5 là mức trần của thanh dưới (Material: 3–5 đích cùng cấp).
- "Thêm" mở tờ trượt đáy: Đơn đăng ký (huy hiệu số, chỉ chủ lớp), Sổ điểm, Học phí (Đợt 3, chỉ chủ lớp), Cài đặt, Tài khoản, Đăng xuất. Có đơn mới → chấm vàng 8px trên "Thêm" kèm `aria-label="Thêm, 1 đơn mới"`.
- Mỗi mục: biểu tượng 24px + nhãn chữ 12px/600 luôn hiện (không chỉ biểu tượng). Vùng bấm = cả ô (≈ 78 × 64px).
- Mục đang mở: biểu tượng và chữ `gold`, nền viên thuốc `nav-active` 56×32 sau biểu tượng; `aria-current="page"`.
- Thanh dưới **ẩn** trong màn điểm danh một buổi (`/quan-ly/diem-danh/[buoiId]`) để nhường chỗ cho thanh "Đánh tất cả có mặt"; đầu trang có nút ‹ quay lại 44×44.
- Bàn phím ảo mở (ô tìm kiếm) → ẩn thanh dưới để không đè ô nhập (theo `visualViewport`).

### Máy tính bảng `640–1023px` — thanh bên thu gọn 72px
Cột biểu tượng + nhãn ngắn dưới biểu tượng, đủ 7 mục (Hôm nay, Điểm danh, Học sinh, Buổi học, Đơn, Sổ điểm, Học phí); Cài đặt và tài khoản ở đáy.

### Máy tính `≥ 1024px` — thanh bên 240px
```
┌────────────┬─────────────────────────────────────────────┐
│ ☾ BCA      │ Hôm nay · Thứ Năm 26/11        ● Đã lưu 22:31│ 64px
│  Midnight  ├─────────────────────────────────────────────┤
│            │                                             │
│ Hôm nay    │   nội dung, tối đa 1120px, lề 32            │
│ Điểm danh  │                                             │
│ Học sinh 70│                                             │
│ Buổi học   │                                             │
│ Đơn     [1]│                                             │
│ Sổ điểm    │                                             │
│ Học phí    │                                             │
│            │                                             │
│ ─────────  │                                             │
│ Anh Thanh  │                                             │
│ Chủ lớp  ⌄ │                                             │
└────────────┴─────────────────────────────────────────────┘
```
- Nền `sidebar` #0D1324, viền phải `border`. Mục cao 44, bo 10, chữ 14 `text-2`; đang mở: nền `nav-active`, chữ `text` 600, vạch vàng 3px bên trái.
- Số đếm bên phải mục (Học sinh 70) dùng `text-3` + `tabular-nums`; số cần xử lý (Đơn 1) là huy hiệu `gold`/`on-gold`.
- Hình trên là bản đủ. Mục chưa tới đợt (Sổ điểm, Học phí — Đợt 3) thì **không hiện** ở Đợt 1 (không để mục xám "sắp có"); tương tự ở thanh bên 72px và tờ "Thêm".
- Giáo viên: chỉ Hôm nay, Điểm danh, Học sinh, Buổi học (+ Sổ điểm từ Đợt 3). Dưới tên hiện môn: "Chị Hoa · Toán".

### Đầu trang
- Điện thoại 56px: nút quay lại (màn con) hoặc tiêu đề mục; bên phải **chỉ báo lưu** (xem §5) và nút tài khoản 44×44.
- Máy tính 64px: tiêu đề + ngày hôm nay ("Thứ Năm 26/11", theo `Asia/Ho_Chi_Minh`, `Intl.DateTimeFormat('vi-VN')`), chỉ báo lưu, nút hành động chính của màn (nếu có).
- Dính đầu khi cuộn, khi đã cuộn có `shadow-sticky`. `scroll-padding-top` = chiều cao đầu trang để phần tử được tiêu điểm không bị che.
- Có liên kết "Bỏ qua tới nội dung" (ẩn tới khi Tab).

## 4. Trạng thái chung (mọi màn dùng chung linh kiện)

| Trạng thái | Cách hiện | Ghi chú |
|---|---|---|
| **Đang tải** | Khối `skeleton` đúng hình dạng nội dung thật (hàng 72px, thẻ…), chỉ hiện nếu chờ > 300ms để tránh nháy. Không vệt sáng chạy (shimmer). | `aria-busy="true"` trên vùng nội dung; chữ ẩn "Đang tải…" cho trình đọc màn hình |
| **Trống** | Một câu nói rõ vì sao trống + một nút làm tiếp. Ví dụ: "Chưa có em nào học Địa. — Mở danh sách học sinh". Không minh hoạ, không biểu tượng to. | Trống do bộ lọc: "Không có em nào khớp 'Huy' + Địa · Bỏ lọc" |
| **Lỗi tải** | Giữ dữ liệu cũ nếu có (mờ 60 %), dải `danger-bg` trên cùng: "Không tải được danh sách. Kiểm tra mạng rồi bấm Thử lại." + nút "Thử lại". | Lỗi nói cách sửa, không chỉ báo lỗi (web-design-guidelines) |
| **Mất mạng** | Dải 40px `warn-bg` chữ `text` dưới đầu trang: "Đang mất mạng — thay đổi được giữ trên máy và tự gửi khi có mạng." Hết mạng mà không có thay đổi chờ: chỉ dải; có thay đổi chờ: thêm "3 thay đổi chưa gửi". | Nghe sự kiện `online`/`offline` + lỗi gọi API. `aria-live="polite"` |
| **Không có quyền** | Trang 403 gọn: "Mục này chỉ chủ lớp xem được." + nút "Về Hôm nay". | Ví dụ giáo viên mở link học phí |
| **Phiên đăng nhập hết** | Hộp thoại: "Phiên đăng nhập đã hết. Đăng nhập lại để lưu tiếp." Thay đổi đang chờ **không bị mất** (giữ trong hàng đợi). | |
| **Học thử** (em) | Chip `trial-bg`/`trial-fg` "Thử · còn 9 ngày"; còn ≤ 3 ngày → chip `warn-bg`/`warn` "Thử · còn 2 ngày". | Cùng một linh kiện `TrialChip` ở mọi màn |
| **Khoá** | (a) Em hết thử: chip `danger-bg` "Hết thử 28/11", em không có trong danh sách điểm danh buổi sau ngày đó. (b) Buổi quá 48 giờ: điểm danh chỉ đọc tới khi bấm "Mở sửa" + xác nhận. (c) Không có quyền: nút không hiện (không để nút xám không bấm được). | |

## 5. Chỉ báo lưu (dùng ở mọi màn có sửa)
Lưu ngay sau mỗi thao tác, không có nút "Lưu" (bỏ nút "Lưu điểm danh" của mẫu A).

| Tình huống | Chữ ở đầu trang | Màu |
|---|---|---|
| Không có gì chờ | "Đã lưu 22:31" | chấm `ok` + chữ `text-3` |
| Đang gửi | "Đang lưu…" | chấm rỗng `text-3` |
| Mất mạng, có thay đổi chờ | "3 thay đổi chưa gửi" | chấm `warn` |
| Gửi lỗi (máy chủ từ chối) | "Lưu lỗi · Thử lại" (nút) | chấm `danger` |

- Hàng đợi thay đổi lưu trong IndexedDB của máy, mỗi thay đổi có khoá (ví dụ `buổi + mã HS`), cùng khoá thì bản sau ghi đè bản trước. Gửi lại khi có sự kiện `online`, khi mở lại trang, và mỗi 15 giây khi đang mở. Không dựa vào Background Sync (Safari trên iPhone chưa hỗ trợ).
- Đóng tab khi còn thay đổi chưa gửi → cảnh báo `beforeunload`.
- Trình đọc màn hình chỉ được báo khi **lỗi** hoặc khi chuyển từ "chưa gửi" sang "đã lưu"; không báo mỗi lần bấm (tránh ồn).

## 6. Linh kiện dùng chung (tự viết, ngắn)
| Linh kiện | Mô tả |
|---|---|
| `AppShell` | Thanh bên / thanh dưới / đầu trang theo điểm ngắt; `color-scheme: dark`; `<meta name="theme-color" content="#0A0F1E">` |
| `BottomSheet` | Tờ trượt đáy điện thoại (bo 20 trên, tay nắm 36×4, `overscroll-behavior: contain`, đóng bằng nút "Đóng", Esc, chạm nền). Trên máy tính thành hộp thoại giữa màn 480px. Dùng `<dialog>` gốc. |
| `UndoBar` | Thanh Hoàn tác 5 giây (xem `man-diem-danh.md` §6) |
| `StatusChip`, `TrialChip` | Chip có chữ, cho xuống dòng, không cắt |
| `SaveIndicator` | §5 |
| `FilterChips` | Chip lọc có số đếm, là `<a>` đổi URL; chip đang bật có ✓ và `aria-current` |
| `EmptyState`, `ErrorBanner`, `OfflineBanner`, `Skeleton` | §4 |

Biểu tượng: **Phosphor Icons** (`@phosphor-icons/react`, kiểu Bold, 24px; trong thanh bên 20px) — skill `minimalist-ui` khuyên Phosphor và tránh Lucide; một bộ cho toàn khu. Biểu tượng trang trí có `aria-hidden="true"`; nút chỉ có biểu tượng phải có `aria-label`.

## 7. Quy tắc chạm, chữ, an toàn
- Vùng bấm ≥ 44 × 44px mọi nơi (nút điểm danh điện thoại 48px). Khoảng cách giữa hai vùng bấm kề nhau ≥ 8px.
- `touch-action: manipulation` trên `html`; `-webkit-tap-highlight-color: transparent` và thay bằng trạng thái nhấn `scale(.97)`.
- Viền tiêu điểm: `outline: 2px solid #F5B544; outline-offset: 2px` cho `:focus-visible`; không bao giờ `outline: none` trơn.
- Không chặn phóng to (`user-scalable=no` bị cấm).
- Đáy màn: `padding-bottom: calc(64px + env(safe-area-inset-bottom))` khi có thanh dưới.
- Ngày giờ, số, tiền: `Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })`, `Intl.NumberFormat('vi-VN')`; số dùng `tabular-nums`. Ngày giờ dựng ở máy chủ theo giờ Việt Nam để không lệch khi hydrate.
- Chữ có dấu không viết hoa toàn bộ (kể cả nhãn cột bảng — khác mẫu A); chữ đang tải kết thúc bằng "…".
- Tên riêng, mã HS, Gmail: `translate="no"`.
- Sắp xếp tên kiểu Việt: theo **tên** (từ cuối) rồi họ đệm, `Intl.Collator('vi')`; tìm kiếm không phân biệt dấu ("huy" khớp "Huy", "Hùng" không khớp).

## 8. Chuyển động trong khung
- Không chuyển cảnh giữa các trang (không View Transition, không trượt trang): khu quản lý dùng hằng ngày, trang mới phải hiện ngay.
- Chỉ: tờ trượt đáy/hộp thoại `dur-sheet` 240ms `ease-out` (ra 180ms `ease-in`); thanh Hoàn tác/thông báo `dur-fast` 150ms; nhấn nút `scale(.97)` 80ms.
- `prefers-reduced-motion: reduce` → tất cả hiện/ẩn tức thì.
- Không GSAP, không Lenis, không linh kiện React Bits nào trong khung (xem lý do ở từng màn).

## 9. Kiểm nhận (cho `bca-kiem-thu`)
1. Ở 390px: thanh dưới đúng 5 mục, mỗi ô ≥ 44px cao, không bị thanh vuốt iPhone che (kiểm `safe-area`).
2. Ở 640px: thanh dưới biến mất, thanh bên 72px hiện; ở 1024px thanh bên 240px.
3. Tài khoản giáo viên: thanh điều hướng không có Đơn, Học phí, Cài đặt; gọi thẳng API học phí trả 403.
4. Tắt mạng (tắt hẳn mạng máy, không chỉ ô Offline của DevTools) → dải mất mạng hiện trong ≤ 2 giây; bật lại → hàng đợi gửi hết, chỉ báo về "Đã lưu".
5. Tab qua toàn trang: thứ tự đúng, viền vàng thấy rõ, không phần tử nào bị đầu trang dính che.
6. Bật "giảm chuyển động" của máy: tờ trượt hiện tức thì.

## Nguồn tham khảo
- Thanh dưới 3–5 đích, máy lớn chuyển sang thanh bên: [Android Developers — Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns).
- Mật độ hàng bảng 24/32/40/48/64: [Carbon Design System — Data table style](https://carbondesignsystem.com/components/data-table/style).
- Vùng bấm tối thiểu 24px (AA) và 44px (AAA 2.5.5): [W3C — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Hàng đợi yêu cầu lưu trong IndexedDB rồi gửi lại khi có mạng: [Chrome for Developers — Workbox background sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync), [Retrying requests when back online](https://developer.chrome.com/docs/workbox/retrying-requests-when-back-online).
- Quy tắc giao diện web (URL giữ trạng thái, safe-area, `touch-action`, `color-scheme`, `Intl.*`): skill `web-design-guidelines` (bản ghim vercel-labs/web-interface-guidelines@434b7f9).
- Chọn bộ biểu tượng Phosphor thay Lucide: skill `minimalist-ui` §6.

## Câu hỏi cho chủ
1. **Mục thứ 5 của thanh dưới trên điện thoại là gì?**
   - A. "Thêm" (gom Đơn, Sổ điểm, Học phí, Cài đặt) — **khuyên dùng**: giữ đủ 4 việc hằng ngày ở ngoài, đơn mới vẫn có chấm báo và đã có trên Hôm nay.
   - B. "Đơn" (đơn đăng ký) thay cho "Thêm"; Sổ điểm/Học phí vào menu tài khoản.
   - C. "Học phí" (từ Đợt 3) thay cho "Buổi học"; Buổi học vào "Thêm".
2. **Giáo viên cộng tác có thấy SĐT và Gmail của học sinh không?** (Quyết định 14 mới nói không thấy SĐT phụ huynh.)
   - A. Thấy Gmail + Zalo/SĐT học sinh của môn mình (để nhắc vào lớp) — **khuyên dùng**.
   - B. Chỉ thấy Gmail (để đối chiếu lớp Meet), không thấy SĐT.
   - C. Không thấy liên hệ nào, chỉ tên.
