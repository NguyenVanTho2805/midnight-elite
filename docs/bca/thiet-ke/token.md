# Token màu và chữ — BCA Midnight (chốt 26/11/2026)

Tỉ lệ tương phản đã tính (WCAG 2.x). Tối là mặc định.

> **Cập nhật 27/11/2026 (QĐ 27):** web có cả sáng và tối, tự theo máy + nút đổi (`data-theme` trên `<html>`, khoá lưu `bca-giao-dien`). Giá trị đang dùng là trong `bca/app/globals.css` — hai bảng dưới đây là bản 26/11, đã đổi:
> - Tối: tách tầng rõ hơn — `bg` #0C1226 · `surface` #18223F · `raised` #212D52 · `border` #36436C · `border-input` #7682AA · `warn` #FFB86B.
> - Sáng (cả web, không chỉ phiếu): `bg` #F1F4FA · `surface` #FFFFFF · `raised` #E9EDF6 · `border` #D0D7E8 · chữ #0F1A3A / #46507A / #5F6A8A · `ok` #0B6B47 · `warn` #8A4500 · `danger` #B42318 · `excused` #1D4ED8 · `focus` #1D4ED8; nút trạng thái đang chọn chữ trắng.
> - Vàng tách hai vai: `--gold` #F5B544 chỉ làm NỀN (nút chính, chấm, huy hiệu); chữ và viền vàng (`text-gold`, `border-gold`) dùng `--gold-chu` = #F5B544 ở tối, #8A5A00 ở sáng (5.9:1 trên trắng).
> - Màu môn `--mon-toan|su|dia|anh`: tối #8AB4FF · #E3A6FF · #5CC8E0 · #FF9FC0; sáng #1D5FD0 · #8A3FC0 · #0B7A90 · #C2356E. Đã khai, bắt đầu dùng từ bước 2. Tương phản các màu mới CHƯA đo bằng máy.

## Tối (mặc định)
| Token | Hex | Dùng cho · tương phản |
|---|---|---|
| `bg` | #0A0F1E | nền trang · `text` 16.88 |
| `surface` | #121A2E | thẻ · `text` 15.31 · `text-2` 9.71 · `text-3` 7.02 |
| `raised` | #18223D | thẻ nổi, phần đầu · `text-3` 6.38 |
| `text` | #EEF1F8 | chữ chính |
| `text-2` | #B8C2DB | chữ phụ |
| `text-3` | #9AA5C0 | chữ mờ · trên `bg` 7.74 |
| `gold` | #F5B544 | nhấn, nút chính · trên `bg` 10.52 |
| `on-gold` | #1A1305 | chữ trên nút vàng · 10.16 |
| `gold-hover` | #FFD27A | 12.95 |
| `ok` | #7BD3A8 | có mặt, đạt · trên `surface` 9.67 |
| `warn` | #FFB199 | sắp hạn · 9.89 |
| `danger` | #FF8A80 | vắng, lỗi · 7.58 |
| `trial-fg` / `trial-bg` | #F5D38A / #1A1608 | nhãn học thử · 12.53 |
| `border` | #26304A | viền trang trí (không dùng cho ô nhập) |
| `border-input` | #66729A | viền ô nhập, ô tích · 3.66 |
| `focus` | #F5B544 | viền tiêu điểm 2px, cách 2px |

## Sáng (phiếu học phí, ảnh tin nhắn Zalo, bản in)
| Token | Hex | Tương phản |
|---|---|---|
| `bg` | #F7F8FB | |
| `surface` | #FFFFFF | |
| `text` | #0F1629 | 16.94 |
| `text-2` | #4A5470 | 7.52 |
| `text-3` | #5F6A85 | 5.09 |
| `accent` | #8A5A00 | chữ/link vàng đậm · 5.93 |
| nút chính | #0A0F1E chữ #FFFFFF | 19.09 |
| `ok` / `danger` | #0B6B47 / #B42318 | 6.55 / 6.57 |
| `border-input` | #8A93AB | 3.07 |

## Chữ
- Be Vietnam Pro, độ đậm 400 / 600 / 800, `next/font` với subsets `['vietnamese','latin']`.
- Số liệu (giờ, điểm, tiền): `font-variant-numeric: tabular-nums`.
- Không viết hoa toàn bộ cho nhãn có dấu; viết hoa đầu câu.

## Kích thước
- Vùng bấm ≥ 44px; nút chính học sinh 56px; nút điểm danh trên điện thoại 48px, cách 8px.
- Bo góc: 10 (nút nhỏ) · 14 (nút, ô) · 20 (thẻ lớn).

---

## Bổ sung cho khu quản lý — BCA-D1-TK (26/11/2026)

Thêm vào bảng trên, không đổi token đã chốt. Tương phản tính theo công thức độ chói tương đối của WCAG 2.x: (L1 + 0.05) / (L2 + 0.05), làm tròn 2 chữ số; màu pha (`row-hover`, `today-col`) tính trên giá trị hex đã pha.

### Màu trạng thái điểm danh và nhãn
| Token | Hex | Dùng cho · tương phản |
|---|---|---|
| `on-ok` | #06140D | chữ trên nút "Có" đang chọn (nền `ok`) · 10.53 |
| `excused` | #A9C7FF | "Phép" (xanh nhạt, để khác hẳn vàng của nhãn học thử) · trên `surface` 10.14 · trên `bg` 11.18 |
| `on-excused` | #0A1A3A | chữ trên nút "Phép" đang chọn · 10.07 |
| `on-danger` | #2A0805 | chữ trên nút "Vắng" đang chọn (nền `danger`) · 8.10 |
| `ok-bg` | #13281E | nền chip "Chính thức", "Có" · chữ `ok` 8.69 |
| `excused-bg` | #152038 | nền chip "Phép" · chữ `excused` 9.49 |
| `danger-bg` | #2E1517 | nền chip "Vắng", "Hết thử", lỗi · chữ `danger` 7.44 |
| `warn-bg` | #2E1C14 | nền chip "còn ≤ 3 ngày", thanh mất mạng · chữ `warn` 9.29 · chữ `text` 14.37 |
| `row-hover` | #1B2336 | hàng bảng khi rê chuột (= trắng 4 % trên `surface`) · `text` 13.86 · `text-3` 6.35 |
| `today-col` | #242630 | cột hôm nay trong ma trận (= `gold` 8 % trên `surface`) · `text` 13.31 · `ok` 8.41 · `excused` 8.82 · `danger` 6.59 |
| `nav-active` | #1A2340 | mục đang mở ở thanh bên · `text` 13.67 · `gold` 8.52 |
| `sidebar` | #0D1324 | nền thanh bên · `text-2` 10.37 · `text-3` 7.50 |
| `skeleton` | #1C2640 | khối chờ tải (trang trí, không mang nghĩa) |

Ghi chú tương phản:
- Viền ô nhập/nút chưa chọn `border-input` #66729A: 3.66 trên `surface`, 4.04 trên `bg`, **3.32 trên `raised`** — vẫn ≥ 3:1 (WCAG 1.4.11).
- Nút đang chọn có nền đặc (`ok` 9.67 so với `surface`) nên phân biệt rõ với nút chưa chọn; ngoài màu còn có dấu ✓ và `aria-pressed="true"` (không dựa vào màu đơn thuần, WCAG 1.4.1).
- `ok` và `excused` gần cùng độ sáng (1.05:1 với nhau) → **không bao giờ** phân biệt Có/Phép chỉ bằng màu: luôn kèm chữ (nút) hoặc ký hiệu ✓ / P (ma trận).
- Viền tiêu điểm vàng trên nút vàng/nút xanh đang chọn: vòng cách 2px nên nằm trên nền `surface` (9.54), không chồng lên nút.

### Chữ (cỡ, khu quản lý)
| Vai trò | Điện thoại | Máy tính | Độ đậm · dòng |
|---|---|---|---|
| Tiêu đề trang `h1` | 22 | 28 | 800 · 1.25, `text-wrap: balance` |
| Tiêu đề mục `h2` | 18 | 18 | 600 · 1.3 |
| Thân, tên học sinh | 16 | 14 (bảng) / 16 | 400–600 · 1.5 |
| Ô nhập | **16** (iOS không tự phóng to) | 14 | 400 |
| Chữ phụ, nhãn cột | 13 | 13 | 600 cho nhãn cột |
| Nhỏ nhất | 12 | 12 | không dùng < 12 |

### Khoảng cách (gốc 4px)
`space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-10` 40 · `space-12` 48.
- Lề trang: 16 (< 640) · 24 (640–1023) · 32 (≥ 1024). Nội dung khu quản lý tối đa 1120px.
- Khoảng giữa các nút liền nhau: 8 (điểm danh), 12 (nút hành động).

### Mật độ hàng (theo thang Carbon: xs 24 · sm 32 · md 40 · lg 48 · xl 64)
- Bảng máy tính có hàng bấm được: 48 (lg). Ma trận điểm danh: hàng 40, cột 44.
- Danh sách điện thoại: hàng tối thiểu 64; hàng điểm danh 72 (tên 2 dòng vẫn vừa).

### Bo góc
10 (chip, nút nhỏ, ô ma trận) · 14 (nút, ô nhập, thẻ nhỏ) · 20 (thẻ lớn, tờ trượt đáy) · 999 chỉ cho chip/huy hiệu đếm.

### Bóng
Nền tối dùng viền `border` thay cho bóng. Chỉ lớp nổi có bóng:
- `shadow-overlay`: `0 12px 32px rgba(0,0,0,.45), 0 0 0 1px #26304A` — tờ trượt đáy, hộp thoại, thanh Hoàn tác.
- `shadow-sticky`: `0 1px 0 #26304A` — mép dưới đầu trang/đầu bảng khi đã cuộn.

### Chuyển động (khu quản lý gần như không)
| Token | Giá trị | Dùng |
|---|---|---|
| `dur-0` | 0ms | đổi trạng thái Có/Phép/Vắng — **tức thì**, không chuyển màu |
| `dur-press` | 80ms | `transform: scale(.97)` khi nhấn nút |
| `dur-fast` | 150ms | hiện/ẩn thanh Hoàn tác, tooltip (opacity + translateY 8px) |
| `dur-sheet` | 240ms | tờ trượt đáy, hộp thoại (translateY / opacity) |
| `dur-undo` | 5000ms | vạch đếm ngược của Hoàn tác, `linear` |
| `ease-out` | cubic-bezier(0.23, 1, 0.32, 1) | vào |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | ra (ra nhanh hơn vào: 180ms) |

- Chỉ động `transform` và `opacity`; không `transition: all`.
- `prefers-reduced-motion: reduce` → mọi thời lượng về 0; vạch đếm ngược thay bằng chữ "còn 5 giây" đổi mỗi giây.
- Không Lenis, không GSAP, không React Bits nền động trong `/quan-ly`. Cuộn gốc của máy (cần cho đầu bảng dính và cột tên dính).

### Lớp chồng (z-index)
`z-sticky` 10 (đầu bảng, cột tên) · `z-header` 20 · `z-nav` 30 (thanh dưới, thanh bên) · `z-toast` 40 · `z-overlay` 50 (tờ trượt, hộp thoại).

### Điểm ngắt
`< 640` điện thoại (thanh dưới) · `640–1023` máy tính bảng (thanh bên thu gọn 72px) · `≥ 1024` máy tính (thanh bên 240px). Kiểm ở 360, 390, 768, 1280.
