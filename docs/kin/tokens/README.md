# KiN — token giao diện cho code

Bốn file. Sinh tự động từ file Figma **KiN Design System**
(`2orXvoHL2upkiGoMjlq8aX`), không gõ tay.

| File | Là gì |
|---|---|
| `tokens.css` | Thứ cần cắm vào sản phẩm. 284 dòng, không phụ thuộc gì. |
| `demo.html` | Mở bằng trình duyệt là bấm thử được 5 chủ đề và chế độ tối. |
| `bien-figma.json` | Toàn bộ biến xuất từ Figma, kèm giá trị từng mode. |
| `sinh-tokens.py` | Script sinh `tokens.css` từ file JSON trên. |

---

## Cắm vào

```html
<html lang="vi" data-chu-de="navy">
  <link rel="stylesheet" href="tokens.css">
```

Rồi dùng biến thay cho mã màu:

```css
.nut-chinh {
  background: var(--kin-nhan-nen);
  color:      var(--kin-nhan-chu-tren-nen);
  min-height: var(--kin-cham-toi-thieu);   /* 44px */
  border-radius: var(--kin-bo-sm);
}
.nut-chinh:hover { background: var(--kin-nhan-nen-re); }
```

**Không viết mã màu thẳng vào CSS.** Viết `#1e3a8a` là chỗ đó sẽ không
đổi theo chủ đề, và sẽ sai ở chế độ tối.

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

## Ba luật không được phá

**1. Xanh lá · vàng · đỏ không bao giờ đổi theo chủ đề.**

`--kin-tt-chu-xong`, `--kin-tt-chu-cho`, `--kin-tt-chu-loi` và ba biến
`--kin-tt-cham-*` là **nghĩa**, không phải trang trí: có mặt, đã trả,
đang chờ, vắng, lỗi. Chủ đề Mận mà nút vẫn xanh lá thì học sinh đọc nhầm
là "đúng rồi".

**2. Phòng thi khoá cứng ở Navy.**

Bọc mọi màn hình phòng thi trong `[data-vung="phong-thi"]`:

```html
<main data-vung="phong-thi"> ... </main>
```

Hai lý do. Ô đáp án đang chọn mà tô xanh cổ vịt thì học sinh đọc nhầm là
"đáp án đúng" — cổ vịt chỉ cách màu "đúng" 53 đơn vị trong không gian RGB.
Và học sinh đi thi không nên thấy màu ưa thích của thầy cô: phòng thi phải
giống hệt nhau với mọi người, đó là một phần của việc thi công bằng.

**3. Chữ trên nền nhạt dùng `--kin-nhan-chu-tren-nhat`, không dùng `--kin-nhan-nen`.**

Biến này đảo màu giữa hai chế độ. Dùng nhầm thì ở chế độ tối chữ và nền
cùng tối, chữ biến mất. Lỗi này đã xảy ra thật khi dựng bản demo — chữ cái
tên trong vòng tròn không đọc được ở chế độ tối.

---

## Sinh lại sau khi sửa Figma

Sửa biến trong Figma → xuất lại `bien-figma.json` → chạy:

```bash
python3 sinh-tokens.py
```

**Đừng sửa `tokens.css` bằng tay.** Sửa tay là lần sinh lại sau mất hết.

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
