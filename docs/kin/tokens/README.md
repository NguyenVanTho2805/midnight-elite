# KiN — token giao diện cho code

Sáu file. Màu, số đo và chữ đều sinh tự động từ file Figma **KiN Design System**
(`2orXvoHL2upkiGoMjlq8aX`), không gõ tay.

| File | Là gì |
|---|---|
| `tokens.css` | Thứ cần cắm vào sản phẩm. Không phụ thuộc gì. |
| `demo.html` | Mở bằng trình duyệt: bấm thử 5 chủ đề, chế độ tối, và xem thang chữ. |
| `bien-figma.json` | Toàn bộ biến xuất từ Figma (4 bộ: Màu, Số đo, Chủ đề, Chữ), kèm giá trị từng mode. |
| `sinh-tokens.py` | Sinh `tokens.css` từ `bien-figma.json`. |
| `kiem-tra-token.py` | Kiểm `tokens.css` có giữ đúng 6 luật của KiN không. Gắn vào CI. |
| `README.md` | File này. |

---

## Cắm vào

```html
<html lang="vi" data-chu-de="navy">
  <link rel="stylesheet" href="tokens.css">
```

Rồi dùng biến thay cho mã màu và cỡ chữ:

```css
.nut-chinh {
  background: var(--kin-nhan-nen);
  color:      var(--kin-nhan-chu-tren-nen);
  font:       var(--kin-kieu-body);
  min-height: var(--kin-cham-toi-thieu);   /* 44px */
  border-radius: var(--kin-bo-sm);
}
.nut-chinh:hover { background: var(--kin-nhan-nen-re); }
```

**Không viết mã màu hay cỡ chữ thẳng vào CSS.** Viết `#1e3a8a` là chỗ đó sẽ không
đổi theo chủ đề và sẽ sai ở chế độ tối. Viết `font-size: 15px` là chen thêm một cỡ
ngoài thang.

## Đổi chủ đề

```js
document.documentElement.dataset.chuDe = 'co-vit';
// navy · co-vit · man · ca-phe · muc
```

Lưu theo tài khoản, không lưu theo máy — gia sư đổi máy vẫn thấy màu của mình.

## Chế độ sáng / tối

Không đặt `data-che-do` thì tự theo cài đặt của máy
(`prefers-color-scheme`). Muốn ép thì:

```js
document.documentElement.dataset.cheDo = 'toi';   // hoặc 'sang'
```

---

## Chữ

Thang **Minor Third 1,2**, tám bậc, theo brand book. Không chế thêm cỡ ở giữa —
cần to hơn thì lên một bậc.

| Bậc | Cỡ | Dòng | Đậm | Họ chữ | Dùng cho |
|---|---:|---:|---:|---|---|
| `display` | 39,8px | 1,2 | 600 | Be Vietnam Pro | Trang chủ, màn hình chào |
| `h1` | 33,2px | 1,25 | 600 | Be Vietnam Pro | Tiêu đề trang |
| `h2` | 27,6px | 1,25 | 600 | Be Vietnam Pro | Tiêu đề khối |
| `h3` | 23px | 1,3 | 600 | Be Vietnam Pro | Tiêu đề thẻ |
| `h4` | 19,2px | 1,3 | 600 | Inter | Tiêu đề nhỏ, tên học sinh |
| `body` | 16px | 1,6 | 400 | Inter | Nội dung — **đề thi bắt buộc bậc này** |
| `small` | 13,3px | 1,5 | 400 | Inter | Chú thích, nhãn ô nhập |
| `caption` | 11,1px | 1,4 | 500 | Inter | Nhãn bảng, đơn vị. **Nhỏ nhất, không xuống dưới.** |

Mỗi bậc có năm biến. Dùng biến gộp là gọn nhất:

```css
h1        { font: var(--kin-kieu-h1); }
.de-thi   { font: var(--kin-kieu-body); max-width: 68ch; }  /* 60–75 ký tự mỗi dòng */
.so-lieu  { font: var(--kin-kieu-caption); font-family: var(--kin-ho-ma); }
```

Cần tách riêng thì dùng `--kin-co-<bậc>`, `--kin-dong-<bậc>`, `--kin-dam-<bậc>`,
`--kin-ho-<bậc>`, và `--kin-ho-ma` cho JetBrains Mono.

Web font chưa được nạp trong `tokens.css`. Sản phẩm cần tự nạp Be Vietnam Pro 600,
Inter 400/500/600 và JetBrains Mono (xem thẻ `<link>` ở đầu `demo.html`).

### Text style trong Figma

Figma có 8 text style `Thang/<bậc>` khớp đúng 8 bậc ở bảng trên. 12 text style đang
dùng trên các màn đã được quy về thang (TK-205, 30/09): cỡ chữ và họ chữ gắn thẳng vào
biến bộ Chữ, đổi biến là style đổi theo. Mô tả của mỗi style ghi sẵn dòng CSS tương ứng.

| Text style trong Figma | Trước | Giờ | CSS |
|---|---:|---|---|
| Tiêu đề/H1 | 30 | `h2` 27,6 | `var(--kin-kieu-h2)` |
| Tiêu đề/H2 | 24 | `h3` 23 | `var(--kin-kieu-h3)` |
| Tiêu đề/H3 — khung đọc | 20 | `h4` 19,2 | `var(--kin-kieu-h4)` |
| Tiêu đề/Khung danh sách | 17 | `body` 16, đậm 600 | `var(--kin-kieu-body)` + `font-weight: 600` |
| Nội dung/Thường | 15 | `body` 16 | `var(--kin-kieu-body)` |
| Nội dung/Dòng — thường | 14 | `small` 13,3, đậm 500 | `var(--kin-kieu-small)` + `font-weight: 500` |
| Nội dung/Dòng — chưa đọc | 14 | `small` 13,3, đậm 600 | `var(--kin-kieu-small)` + `font-weight: 600` |
| Nội dung/Nhỏ | 13 | `small` 13,3 | `var(--kin-kieu-small)` |
| Nội dung/Chú thích | 12,5 | `small` 13,3 | `var(--kin-kieu-small)` |
| Nhãn/Badge | 10 | `caption` 11,1, đậm 600 | `var(--kin-kieu-caption)` + `font-weight: 600` |
| Nhãn/Module | 9,5 | `caption` 11,1, đậm 600 | `var(--kin-kieu-caption)` + `font-weight: 600` |
| Mã/Giờ ngày | 12 | `caption` 11,1 | `var(--kin-kieu-caption)` + `font-family: var(--kin-ho-ma)` |

Hai nhãn 9,5px và 10px trước đây nằm dưới cỡ nhỏ nhất của thang; giờ đều lên 11,1px.
Khoảng cách chữ (letter-spacing) của cả 12 style đưa về 0 cho khớp với code.

**Các màn đã gắn cỡ chữ vào biến (TK-206, 30/09).** Trên 22 trang màn hình, mọi đoạn chữ
đặt cỡ tay (khoảng 1.760 đoạn) được gắn vào biến `cỡ/<bậc>` gần nhất: ≤12 → `caption`,
≤14,6 → `small`, ≤17,5 → `body`, ≤21 → `h4`, ≤25 → `h3`, ≤30,5 → `h2`, ≤36 → `h1`,
≤40 → `display`. Chiều cao dòng đổi từ px sang %, để khi đổi cỡ thì dòng giãn theo. Chữ
bên trong instance không đụng tới, vì nó lấy theo component gốc. Các bảng thương hiệu
(Logo, Màu, Chữ & giọng điệu, Năm chủ đề…) giữ nguyên vì đó là bảng trình bày, không phải
màn hình. Bản trước khi gắn nằm ở trang **🗄 Lưu trữ — trước TK-206 (30/09)** để so lại.

---

## Sáu luật — `kiem-tra-token.py` canh cho

```bash
python3 kiem-tra-token.py            # thoát 0 nếu đạt, 1 nếu vi phạm
python3 kiem-tra-token.py --tu-kiem  # tự cấy 5 lỗi, cả 5 phải bị bắt
```

**1. Xanh lá · vàng · đỏ không bao giờ đổi theo chủ đề.**
`--kin-tt-*` là **nghĩa**, không phải trang trí: có mặt, đã trả, đang chờ, vắng, lỗi.
Chủ đề Mận mà nút vẫn xanh lá thì học sinh đọc nhầm là "đúng rồi".

**2. Chủ đề chỉ được đổi màu nhấn** (`--kin-nhan-*`). Nền, viền, chữ thường giữ nguyên.

**3. Màu trạng thái có đủ ở cả chế độ sáng và tối.**

**4. Phòng thi khoá cứng ở Navy.** Bọc mọi màn hình phòng thi trong
`[data-vung="phong-thi"]`:

```html
<main data-vung="phong-thi"> ... </main>
```

Hai lý do. Ô đáp án đang chọn mà tô xanh cổ vịt thì học sinh đọc nhầm là
"đáp án đúng" — cổ vịt chỉ cách màu "đúng" 53 đơn vị trong không gian RGB.
Và học sinh đi thi không nên thấy màu ưa thích của thầy cô: phòng thi phải
giống hệt nhau với mọi người, đó là một phần của việc thi công bằng.

**5. Thang chữ đủ tám bậc, đúng tỉ lệ 1,2, nội dung đề thi 16px / dòng 1,6.**

**6. `tokens.css` đúng bằng bản sinh từ `bien-figma.json`.** Ai sửa tay là luật này
báo ngay.

Thêm một luật không máy nào kiểm được: **chữ trên nền nhạt dùng
`--kin-nhan-chu-tren-nhat`, không dùng `--kin-nhan-nen`.** Biến này đảo màu giữa
hai chế độ. Dùng nhầm thì ở chế độ tối chữ và nền cùng tối, chữ biến mất — lỗi này
đã xảy ra thật khi dựng bản demo.

---

## Sinh lại sau khi sửa Figma

1. Sửa biến trong Figma (bộ Màu, Số đo, Chủ đề hoặc Chữ).
2. Xuất lại `bien-figma.json`. Hiện chưa có nút xuất trong Figma — việc này đang làm
   qua Claude đọc biến bằng Figma MCP.
3. Chạy:

```bash
python3 sinh-tokens.py
python3 kiem-tra-token.py
```

**Đừng sửa `tokens.css` bằng tay.** Luật 6 sẽ báo.

Trong Figma Dev Mode, mỗi biến giờ hiện đúng tên CSS (ví dụ `var(--kin-nen-trang)`),
không còn tên cũ kiểu `var(--bg)`.

---

## Số đã kiểm

Mọi cặp màu trong file đã đo tương phản WCAG 2.1. Ngưỡng: 4,5:1 cho chữ,
3:1 cho viền và đồ hoạ.

| Chủ đề | Chữ trắng trên nút | Đường dẫn (sáng) | Đường dẫn (tối) | Chữ cái tên (sáng / tối) |
|---|---|---|---|---|
| Navy | 10,36 | 5,17 | 7,60 | 9,40 / 6,85 |
| Cổ vịt | 5,36 | 5,36 | 9,02 | 4,86 / 7,83 |
| Mận | 8,72 | 6,98 | 7,31 | 7,77 / 6,91 |
| Cà phê | 9,07 | 7,31 | 11,45 | 8,15 / 10,57 |
| Mực | 17,85 | 10,35 | 13,01 | 16,30 / 11,75 |

Vùng chạm tối thiểu 44px (`--kin-cham-toi-thieu`), dòng danh sách 50px,
ô đáp án trong phòng thi 52px — cao hơn vì người ta bấm dưới áp lực thời gian.
