# Kết quả đo tương phản — bảng màu KiN

Đo ngày 24/09/2026 bằng công thức tỉ lệ tương phản của WCAG 2.1, chạy trên
đúng các mã màu trong `app/globals.css` của bản đang chạy.

Ngưỡng: **4,5:1** cho chữ thường, **3:1** cho đồ hoạ và biên của control
(WCAG 1.4.3 và 1.4.11).

## Bảy chỗ trượt chuẩn, và bản vá

| Chỗ | Mã cũ | Đo được | Mã mới | Sau khi vá |
|---|---|---|---|---|
| **Chữ trên nút chính, nền tối** | `#FFFFFF` | 3,68:1 ✗ | `#0B0E14` | 5,25:1 ✓ |
| Chữ trạng thái xanh lá, nền sáng | `#059669` | 3,77:1 ✗ | `#047857` | 5,48:1 ✓ |
| Chữ trạng thái vàng, nền sáng | `#D97706` | 3,19:1 ✗ | `#B45309` | 5,02:1 ✓ |
| Chấm trạng thái trung tính | `#9CA3AF` | 2,54:1 ✗ | `#767F8E` | 4,04:1 ✓ |
| Chữ mờ trên dòng đang chọn | `#6B7280` | 4,12:1 ✗ | `#5B6675` | 4,97:1 ✓ |
| Viền ô nhập, nền sáng | `#E6E9EF` | 1,22:1 ✗ | `#8B95A5` | 3,03:1 ✓ |
| Viền ô nhập, nền tối | `#232A36` | 1,34:1 ✗ | `#565F70` | 3,00:1 ✓ |

## Nguyên nhân chung

App dùng **cùng một mã màu cho chấm trạng thái và cho chữ trạng thái**,
trong khi hai thứ đó có ngưỡng khác nhau — đồ hoạ 3:1, chữ 4,5:1.
Xanh lá `#059669` làm chấm thì đạt, làm chữ thì trượt. Vì vậy `tokens.css`
tách thành hai bộ: `--green`/`--amber` cho chữ, `--dot-green`/`--dot-amber`
cho chấm.

Riêng `#B45309` vốn đã nằm sẵn trong brand book KiN dưới tên `sun-ink`, kèm
ghi chú *"chữ trên nền vàng dùng sun-ink"* — người viết brand book đã lường
trước, chỉ là code chưa áp.

## Cách kiểm lại

```js
const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255);
const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
const L = h => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const ratio = (a,b) => { const l1=L(a), l2=L(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1];
                         return (hi+0.05)/(lo+0.05); };
```

Đổi bất cứ màu nào trong `tokens.css` thì chạy lại hàm này trước khi commit.

## Vùng chạm

Brand book KiN bắt buộc 44px trên điện thoại. Đo trên bản dựng mẫu: chip lọc
28px và ô tìm kiếm 32px đều thiếu — đã ép về 44px trong bản mẫu. Kiểm lại
toàn bộ control khi dựng giao diện thật, đừng tin mắt.
