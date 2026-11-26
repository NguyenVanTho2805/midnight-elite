# Token màu và chữ — BCA Midnight (chốt 26/11/2026)

Tỉ lệ tương phản đã tính (WCAG 2.x). Tối là mặc định.

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
