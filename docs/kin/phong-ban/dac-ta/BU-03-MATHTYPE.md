# BU-03-MATHTYPE · Đọc công thức MathType (OLE) trong Word Azota — đặc tả P1b

Lập 05/11/2026 bởi tut-rnd · nhánh `claude/bu03-mathtype`. Bổ sung cho `BU-03.md` (mục "7. Công thức", câu hỏi chủ #1). **Không sửa `src/`.** Spike thật đã chạy trên 3 tệp mẫu; mọi con số dưới đây là đo được, không ước.

## 0. Kết luận ngắn

- **Khả thi, rủi ro thấp hơn dự kiến.** 299/299 công thức trong 3 tệp mẫu là MTEF **v5** (không có v3), CFB đọc tay được 299/299, giải mã sạch (ăn hết byte, 0 lỗi) 299/299.
- Bộ chuyển mẫu (spike, ~90 dòng) ra LaTeX cho **299/299**; **39/39** công thức có sẵn "TeX Input Language" trong tệp khớp LaTeX bộ chuyển ra (sau chuẩn hoá khoảng trắng/`\ `/`\text`). Chữ-số-ký-tự trong MTEF khớp văn bản trong ảnh xem trước WMF ở 299/299 (84 công thức chỉ khác chữ Hy Lạp vì WMF dùng font Symbol).
- Mẫu **chỉ có 6 loại template** (ngoặc tròn, ngoặc vuông, phân số, căn bậc 2, chỉ số dưới, mũ). **Không có** tích phân, tổng, giới hạn, vectơ, ma trận, hệ phương trình, dấu mũ/gạch ngang, mũi tên. Phần đó viết theo tài liệu MTEF nhưng **chưa kiểm bằng mẫu thật** → chỉ bật sau khi có mẫu (mục 4.2, mốc 2).
- Ảnh dự phòng WMF→PNG: **khả thi về cấu trúc** (WMF mẫu chỉ có 17 loại record, đều đơn giản) nhưng **khó đẹp** (ngoặc to ghép từ mảnh font Symbol, server không có font). Đưa vào **mốc 2**; mốc 1 không cần.

## 1. Vấn đề + bằng chứng

| # | Sự thật | Bằng chứng |
|---|---|---|
| 1 | Công thức trong Word Azota là OLE MathType `Equation.DSMT4`, không phải OMML; hiện chỉ gắn nhãn `⟦công thức⟧` và gia sư phải gõ lại | `src/lib/azotaDocxRead.ts:151-154` (`case "object"` → `FORMULA_PLACEHOLDER`, `formula:"ole"`, không đọc `r:id` của `o:OLEObject`) |
| 2 | Bộ đọc quan hệ **vứt** mọi đích ngoài `word/media/*`, nên `embeddings/oleObjectN.bin` không bao giờ vào được | `azotaDocxRead.ts:274` (`!t.startsWith("media/")` → `continue`) |
| 3 | Giới hạn 500 mục nén sẽ từ chối tệp ≥ ~230 công thức (mỗi công thức = 1 `.bin` + 1 `.wmf`; tệp mẫu đã dùng 240/242/181 mục) | `azotaDocxRead.ts` `DOCX_MAX_ENTRIES = 500`; đếm trên x1/x2/x3 |
| 4 | Cờ `formula_unread` + chặn phát hành chỉ dựa vào chuỗi nhãn | `azotaDocx.ts:319-320, 527`; `deThiClient.ts:99` (`hasFormulaPlaceholder`); `MaDe.tsx:71,81`; `NhapWord.tsx:38,44`; `publish/route.ts:4` (422 `FORMULA_UNREAD`) |
| 5 | Công thức OMML thành công đã đi đường `$latex$` + `MathText` (KaTeX) → dùng lại nguyên đường đó cho MathType | `azotaDocxRead.ts:184`; `NhapWord.tsx:319,325` (`<MathText>`) |
| 6 | Trong x1 và x2 có 107/110 công thức nhưng 0 `m:oMath` ở Toán 12 (xem BU-03.md mục 1 #3) | giải nén ba tệp |

## 2. Kết quả spike (số đo)

Script: `tools/mathtype-spike.mjs` (50 dòng, không phụ thuộc; chạy `node tools/mathtype-spike.mjs <tệp.docx|thư-mục-giải-nén> …`; `.docx` cần `jszip` đã có). Ba tệp: x1 = `De_Toan12_GK1_Azota.docx`, x2 = `D. DUNG SAI - CH.docx`, x3 = `F. BAI TAP NANG CAO - CH.docx`.

| Chỉ số | x1 | x2 | x3 | Tổng |
|---|---|---|---|---|
| Công thức (`w:object`, ProgID `Equation.DSMT4`) | 107 | 110 | 82 | **299** |
| `.bin` đọc được bằng CFB tay / luồng "Equation Native" có | 107 | 110 | 82 | 299 / 299 |
| MTEF giải sạch (hết byte, END cân) | 107 | 110 | 82 | 299 / 299 |
| Kích thước luồng (byte) nhỏ–lớn | 228–374 | 229–557 | 230–653 | **228–653** |
| Có "TeX Input Language" (record FUTURE 102) | 9 | 30 | 0 | 39 |
| Ảnh xem trước | 102 wmf (+14 png khác) | 106 wmf | 81 wmf | 299 wmf, 1:1 với `.bin` |
| Số mục zip (xấp xỉ) | 242 | 240 | 181 | — |

Tiêu đề: `EQNOLEFILEHDR` 28 byte ở **cả 299** (cbHdr=28, version 0x00020000, `cbObject == len-28` đúng 299/299). MTEF `ver=5, platform=1 (Win), product=0`, app key `DSMT6` ×128 / `DSMT7` ×171; product version 6.7, 6.9, 7.4, 7.8. Các `.bin` chỉ có luồng `Equation Native` làm nội dung (+ `\x01Ole`, `\x01CompObj`, `\x03ObjInfo`, 11 có `\x02OlePres000`). Không công thức nào dùng MTEF v3.

**Record MTEF (tổng 299 công thức):** END 1640 · LINE 1080 · CHAR 3741 · TMPL 445 · SIZE 2 · FULL(10) 463 · SUB(11) 182 · COLOR 211 · COLOR_DEF 84 · FONT_DEF 1218 · EQN_PREFS 299 · ENCODING_DEF 321 · FUTURE(102) 39. **Không có:** PILE, MATRIX, EMBELL, RULER, FONT_STYLE_DEF, SUB2, SYM, SUBSYM. Độ sâu lồng tối đa **8**; tối đa **137 record**/công thức.

**Template (selector.variation, số ô con):** `28.0` (mũ, 2 ô) ×158 · `11.0` (phân số, 2 ô) ×152 · `1.3` (ngoặc tròn, 3 ô; 2 cái có tuỳ chọn `to=1`) ×99 · `10.0` (căn, 2 ô) ×21 · `3.3` (ngoặc vuông, 3 ô) ×10 · `27.0` (chỉ số dưới, 2 ô) ×5. Tổng 445.

**Typeface dùng:** 1 (text), 2 (function), 3 (variable), 4 (Hy Lạp thường), 6 (symbol), 8 (số), 11 (MTExtra), 22 (expand — ký tự ngoặc nằm trong ô template), 24 (space). 94 tổ hợp (typeface, mtcode, mã 8-bit). Hy Lạp chỉ có α, π; symbol: `= + − < ° ∈ ∞ ≤ ≥ ≈ ≠ ∀ ′`; MTExtra: ℤ (U+2124), ℝ (U+211D); space: U+EF02.

**WMF xem trước (299):** đều có header "placeable" (0x9AC6CDD7). Chỉ có 17 loại record: EOF, SetBkMode, SelectObject, SetTextAlign, DeleteObject, SetBkColor, SetTextColor, SetWindowOrg, SetWindowExt, MoveTo, CreateFontIndirect, **Escape** (chú thích MathType, bỏ qua), **ExtTextOut** (1440 lần — hầu hết nội dung), LineTo (236 lần/117 tệp), CreatePenIndirect, CreateBrushIndirect, Polygon (21 lần/20 tệp — đầu mũi tên/căn). Font: Times New Roman 772, Symbol 439, System 299 (dummy), Euclid Symbol 26, MT Extra 10, VNI-Times 11. Kích thước WMF 598–2874 byte. Ký tự trong ExtTextOut định vị bằng `SetTextAlign` UPDATECP + `MoveTo` + mảng `dx` (tọa độ x,y trong record = 0).

**Spike hạn chế (nói thẳng):** bộ giải mã chạy trên đúng 3 tệp này. Selector ngoài 6 loại trên, PILE/MATRIX/EMBELL, SIZE nhánh 100, RULER, FONT_STYLE_DEF **chưa từng chạy với dữ liệu thật** — hình dạng byte lấy từ tài liệu MTEF 5 (rtf2latex2e `MTEF5.html`, Wiris SDK) và chưa kiểm.

### 2.1 Mẫu đối chiếu (cho tut-code làm test vàng)

Cột "tệp" = `x?/word/embeddings/…` ↔ ảnh xem trước (nối qua `w:object` → `v:imagedata r:id` ↔ `o:OLEObject r:id` → `_rels`).

| Tệp, chỉ số công thức (theo thứ tự trong tài liệu) | `.bin` ↔ xem trước | LaTeX kỳ vọng | TeX Input |
|---|---|---|---|
| x1 #0 | oleObject1 ↔ image1.wmf | `y=f\left(x\right)` | — |
| x1 #1 | oleObject2 ↔ image3.wmf | `\left(-1;0\right).` | — |
| x1 #20 | oleObject21 ↔ image25.wmf | `y_{CT}` | — |
| x1 #27 | oleObject28 ↔ image32.wmf | `\left[-1;5\right]` | — |
| x1 #40 | oleObject41 ↔ image44.wmf | `-27` | — |
| x1 #68 | oleObject69 ↔ image76.wmf | `y=f(x)=\sqrt{4x-x^{2}}` | — |
| x3 #1 | oleObject2 ↔ image2.wmf | `A=\sin A+\sin B+\sin C` (`sin` = tf2, chữ đầu cờ FUNC_START) | — |
| x3 #5 | oleObject6 ↔ image6.wmf | `A=\cos\left(\frac{\pi}{2}+x\right)+\cos\left(2\pi-x\right)+\cos\left(3\pi+x\right)` (`cos` = tf1 text → vẫn ra `\cos`) | — |
| x3 #60 | oleObject61 ↔ image60.wmf | `\frac{\sin^{2}a-\cos^{2}a}{1+2\sin a\cos a}=\frac{\tan a-1}{\tan a+1}` | — |
| x1 oleObject102 | (kiểm bằng tên `.bin`) | `f^{\prime}(t)` | `{f^{\prime}(t)}` |
| x1 oleObject106 | | `5\leq x\leq 10` | `{5 \leq x \leq 10}` |
| x2 (30 công thức có TeX) | | khớp TeX Input | xem mục 8 test `t-mtef-golden` |

Quy tắc test vàng: với 39 công thức có TeX Input, `normalize(latex) === normalize(texInput)` trong đó normalize = bỏ `{ } \ ~ \,`, khoảng trắng, và `\text{x}`/`\mathrm{x}`→`x`. **Đây là bộ kiểm tự động miễn phí; TeX Input chỉ dùng trong test, KHÔNG dùng làm nguồn ở sản xuất** (không rõ có lạc hậu khi gia sư sửa công thức sau đó).

## 3. Định dạng cần giải

Chỉ **MTEF v5** (byte đầu = 5). Byte đầu ≠ 5 (kể cả 3) → `{ok:false, reason:"mtef_version"}`; không viết bộ giải v3 vì mẫu 0/299 có.

### 3.1 CFB (`cfb.ts`)

Header 512 byte: chữ ký `D0CF11E0A1B11AE1`; sector size = `1<<u16@30` (chỉ chấp nhận 512 hoặc 4096), mini sector = `1<<u16@32`; `nFat@44`, `dirStart@48`, `cutoff@56` (thường 4096), `miniFatStart@60`, `nMiniFat@64`, `difStart@68`, `nDif@72`; 109 mục DIFAT đầu @76. Đọc theo thứ tự: DIFAT (mở rộng theo chuỗi `difStart`) → FAT → thư mục (128 byte/mục: tên UTF-16LE độ dài @64, loại @66 [5 = root, 2 = stream], sector đầu @116, kích thước u64 @120) → luồng. Luồng `size < cutoff` đọc qua **mini-stream** (chuỗi của Root Entry cắt theo miniFAT); lớn hơn đọc theo FAT. Lấy luồng tên **chính xác** `Equation Native`. Mẫu: 299/299 nằm trong mini-stream hay FAT đều đọc đúng (kích thước 228–653 B < cutoff → toàn bộ qua mini-stream, nên đường mini-stream **bắt buộc** đúng).

### 3.2 Bọc ngoài và tiêu đề

`EQNOLEFILEHDR` (28 byte): `cbHdr u16 = 28`, `version u32 = 0x00020000`, `cf u16` (định dạng clipboard, thay đổi — bỏ qua), `cbObject u32` (phải bằng `len − 28`, mẫu 299/299 đúng), 12 byte dự trữ. Sau đó MTEF: `version(5) · platform · product · productVersion · productSubversion · appKey (chuỗi kết thúc 0) · equationOptions (1 byte)`.

### 3.3 Record (v5)

Mỗi record: **tag byte**; các record có cấu trúc rồi tới **options byte**. Nudge (`opt & 0x08`): 2 byte; nếu cả hai = 128 thì thêm 2×int16.

| Tag | Tên | Bố cục sau tag | Ghi chú |
|---|---|---|---|
| 0 | END | — | đóng danh sách LINE/PILE/MATRIX/TMPL/CHAR-embell |
| 1 | LINE | opt, [nudge], [line spacing: số nguyên có dấu nếu `opt&4`], [RULER nếu `opt&2`], danh sách đối tượng tới END (bỏ nếu `opt&1` = ô rỗng) | |
| 2 | CHAR | opt, [nudge], typeface (byte, thực = byte−128), mtcode u16 (trừ khi `opt&0x20`), [mã 8-bit nếu `opt&4`], [mã 16-bit nếu `opt&0x10`], [danh sách EMBELL tới END nếu `opt&1`] | `opt&2` = đầu tên hàm |
| 3 | TMPL | opt, [nudge], selector, variation (1 byte; nếu bit 7 bật → `(b&0x7F)|(b2<<8)`), template-options, danh sách ô tới END | |
| 4 | PILE | opt, [nudge], halign, valign, [RULER nếu `opt&2`], các LINE tới END | mốc 2 |
| 5 | MATRIX | opt, [nudge], valign, hjust, vjust, rows, cols, row-partition ⌈2(rows+1)/8⌉ byte, col-partition ⌈2(cols+1)/8⌉ byte, các LINE (theo hàng) tới END | mốc 2 |
| 6 | EMBELL | opt, [nudge], mã | mốc 2 |
| 7 | RULER | n, n×(loại byte, vị trí int có dấu) | |
| 8 | FONT_STYLE_DEF | chỉ số font (uint), style byte | chưa có mẫu |
| 9 | SIZE | `l`: nếu 101 → u16; nếu 100 → 1 byte + u16; ngược lại 1 byte dsize | mẫu 2 lần |
| 10–14 | FULL, SUB, SUB2, SYM, SUBSYM | — | đổi cỡ, bỏ qua |
| 15 | COLOR | uint | bỏ qua |
| 16 | COLOR_DEF | opt, 3 (RGB) hoặc 4 (CMYK, `opt&1`) giá trị u16, [tên 0-kết thúc nếu `opt&4`] | bỏ qua |
| 17 | FONT_DEF | uint, tên 0-kết thúc | bỏ qua |
| 18 | EQN_PREFS | opt, mảng kích thước, mảng khoảng cách (mảng = số lượng byte + các nibble: đơn vị, chữ số `0-9`/`.`=10/`-`=11, kết thúc 15, đệm nibble), mảng kiểu (số lượng; mỗi phần tử: font-index uint, nếu ≠0 thêm 1 byte) | bỏ qua; mẫu ăn khớp 299/299 |
| 19 | ENCODING_DEF | tên 0-kết thúc | bỏ qua |
| ≥100 | FUTURE | `n = uint` rồi n byte | tag 102 = "TeX Input Language": `chuỗi\0` hai lần. **Bỏ qua mọi tag ≥100**; đọc `TeX Input` chỉ ở tools/test. Tag lạ <100 mà không liệt kê → `unsupported_record` |

Số nguyên: *uint* = 1 byte nếu <255, ngược lại 255 + u16. *int có dấu* = 1 byte (−128 bias) nếu <255, ngược lại 255 + u16 (−32768 bias).

### 3.4 Selector template → LaTeX

"Ô" = LINE con (hoặc CHAR cho ký tự ngoặc). Thứ tự ô theo tài liệu MTEF 5; **✔ = đã thấy trong 299 mẫu và khớp**, **◇ = theo tài liệu, chưa kiểm**.

| Sel | Tên | Biến thể (bit) | Ô | LaTeX | Mốc |
|---|---|---|---|---|---|
| 0–7 | Ngoặc: `⟨⟩`, `()`, `{}`, `[]`, `\|\|`, `‖‖`, `⌊⌋`, `⌈⌉` | `1`=có trái, `2`=có phải; ngoài ra → thất bại | thân, [ký tự trái], [ký tự phải] — số ô = 1 + số bit | `\left<trái>…\right<phải>`; bên thiếu = `.`. Cặp: 0 `\langle`/`\rangle`; 1 `(`/`)` ✔; 2 `\{`/`\}`; 3 `[`/`]` ✔; 4 `\vert`; 5 `\Vert`; 6 `\lfloor`/`\rfloor`; 7 `\lceil`/`\rceil`. Chọn cặp **theo selector**, ký tự tf22 chỉ để kiểm số ô | 1 (✔ cho 1,3; 0,2,4–7 ◇ + test tổng hợp) |
| 8 | Ngoặc "mở" | — | — | không có mẫu → thất bại | 2 |
| 9 | Khoảng (interval) | — | — | thất bại | 2 |
| 10 | Căn | 0 = căn bậc 2 ✔; 1 = bậc n ◇ | [bên trong, chỉ số] | `\sqrt{a}` ✔ / `\sqrt[n]{a}` ◇; var 0 mà ô chỉ số không rỗng → thất bại | 1 (var 0), 2 (var 1) |
| 11 | Phân số | 0 ✔; bit `1` nhỏ, `2` gạch chéo, `4` căn baseline ◇ | [tử, mẫu] | `\frac{a}{b}` | 1 (var 0); var≠0 → thất bại (mốc 2 mới: `2` → `{a}/{b}`, `1`→`\tfrac`) |
| 12, 13 | Gạch dưới / gạch trên | bit 1 = gạch đôi | [thân] | `\underline{a}` / `\overline{a}`; đôi → thất bại | 2 |
| 14 | Mũi tên (có chữ trên/dưới) | 0 đơn, 1 đôi, 2 harpoon; 4 ô trên, 8 ô dưới; 0x10/0x20 hướng | [thân, ?, ký tự mũi tên] | `\xrightarrow{…}` / hóa học `\xrightarrow[dưới]{trên}` — **chỉ khi có mẫu** | 2 |
| 15 | Tích phân | 1–3 số dấu ∫, 4/8/C vòng, 0x100 giãn nở ◇ | [thân, cận trên, cận dưới, ký tự] | `\int_{dưới}^{trên} thân` (`\iint`, `\iiint`, `\oint` theo biến thể); thân đi **sau** | 2 |
| 16–22 | ∑ ∏ ∐ ∪ ∩ và hai nhóm "giống tích phân/tổng" | bit `1` cận dưới, `2` cận trên, `0x40` kiểu tổng | [thân, trên, dưới, ký tự] | `\sum_{…}^{…}`, `\prod`, `\coprod`, `\bigcup`, `\bigcap`; 21/22 xác định theo **ký tự toán tử** (mtcode), lạ → thất bại | 2 |
| 23 | Giới hạn | 0 gạch dưới đơn, 1 đôi; bit giới hạn như trên | [thân, dưới, trên] | `\lim_{x\to a}` (tên hàm lấy từ ô thân; chỉ chấp nhận `lim`, `max`, `min`, `sup`, `inf`) | 2 |
| 24, 25 | Ngoặc ngang (trên/dưới) | bit 1 = trên | [thân, ô nhỏ, ký tự] | `\overbrace{a}^{b}` / `\underbrace{a}_{b}` | 2 |
| 26 | Chia dài | bit 1 ô trên | [số bị chia, thương] | thất bại | — |
| 27 | Chỉ số dưới ✔ | bit 1 = đứng trước ◇ | [dưới, (ô trên rỗng)] | `_{…}` gắn vào nguyên tử đứng ngay trước | 1 (var 0) |
| 28 | Mũ ✔ | như trên | [(ô dưới rỗng), trên] | `^{…}` | 1 (var 0) |
| 29 | Dưới-và-mũ | như trên | [dưới, trên] | `_{…}^{…}` | 1 (var 0, test tổng hợp) |
| 30 | Dirac | — | — | thất bại | — |
| 31 | Vectơ | `1` trái, `2` phải, `4` dưới, `8` harpoon | [thân, ký tự] | phải/trên → `\overrightarrow{a}`; trái → `\overleftarrow{a}`; khác → thất bại | 2 |
| 32, 33 | Dấu ngã / mũ (`~`, `^`) | — | [thân, ký tự] | `\widetilde{a}`, `\widehat{a}` (một chữ: `\tilde`/`\hat`) | 2 |
| 34 | Cung (`\frown`) | — | [thân, ký tự] | `\overset{\frown}{a}` | 2 |
| 35 | Trạng thái nối | — | — | thất bại | — |
| 36 | Gạch chéo (strike) | `1` ngang, `2` /, `4` \ | [thân] | `\cancel{a}` (KaTeX có) hoặc thất bại nếu cần tổ hợp | 2 |
| 37 | Khung | `1` bo tròn; `2/4/8/16` các cạnh | [thân] | cả 4 cạnh → `\boxed{a}`; còn lại thất bại | 2 |

**Thứ tự đối tượng cùng cấp:** template chỉ số trên/dưới (27/28/29) có **cơ sở là nguyên tử đứng ngay trước** trong cùng LINE. Triển khai: bộ phát LaTeX giữ danh sách "nguyên tử đã phát"; gặp script thì gắn vào nguyên tử cuối; nếu chưa có nguyên tử (script đầu LINE) phát `{}^{…}`; hai script cùng loại liên tiếp (`^{a}^{b}`) → **thất bại** `double_script`. Mọi nguyên tử nhiều ký tự (`\left(…\right)`, `\cos `, `\text{cm}`, `\alpha `) là **một** nguyên tử.

### 3.5 Bảng ký tự (CHAR)

Khoá chính: `(typeface, mtcode)`. `mtcode` lấy từ u16; nếu `opt&0x20` (không mtcode) → dùng mã 8-bit và coi như Unicode Latin-1 **chỉ khi** typeface ∈ {1,2,3,8}, ngược lại thất bại.

| Typeface | Quy tắc |
|---|---|
| 8 (số) | `0-9 . ,` → chính nó. Dấu `,` giữa hai chữ số → `{,}` (số thập phân kiểu Việt, không tách khoảng). Khác → thất bại |
| 3 (variable) | chữ Latin A–Z a–z → chính nó (KaTeX tự in nghiêng); Hy Lạp/ký tự khác → tra bảng Hy Lạp; không có → thất bại |
| 4, 5 (Hy Lạp thường/hoa) | tra: α β γ δ ε(`\varepsilon`) ϵ(`\epsilon`) ζ η θ ϑ ι κ λ μ ν ξ π ρ σ τ υ φ(`\varphi`) ϕ(`\phi`) χ ψ ω; Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω. Không có → thất bại |
| 1 (text), 2 (function) | **gom chuỗi**: các CHAR liền nhau cùng typeface, đều là chữ Latin ASCII, bắt đầu run mới khi gặp cờ FUNC_START (`opt&2`). Tên (chữ thường) ∈ {sin cos tan cot sec csc log ln lg lim max min arcsin arccos arctan exp det gcd sinh cosh tanh} → `\name ` (cả khi gõ tf1 — x3 #5 "cos" là tf1); tf1 khác → `\text{run}`; tf2 khác → `\mathrm{run}`. Ký tự lẻ: dấu `; : , . ! ? ( ) / ' [ ] \| = + < > -` → chính nó (ngoặc lẻ không có `\left`); khoảng trắng hoặc U+00A0 → `\ `; `% & # _ { } $` → thoát `\%` …; `\ ~ ^` → thất bại |
| 6 (symbol) | U+2212→`-`, `=`, `+`, `<`, `>`, U+00B0 `°`→`\circ ` (**không** bọc `^{}`: mẫu `125°` là mũ chứa `\circ`; bọc sẽ ra `^{^{\circ}}`), 2208 `\in`, 221E `\infty`, 2264 `\leq`, 2265 `\geq`, 2248 `\approx`, 2260 `\neq`, 2200 `\forall`, 2203 `\exists`, 2032 `\prime`, 00B1 `\pm`, 00D7 `\times`, 22C5/00B7 `\cdot`, 00F7 `\div`, 2192 `\to`, 21D2 `\Rightarrow`, 21D4 `\Leftrightarrow`, 222A `\cup`, 2229 `\cap`, 2282 `\subset`, 2286 `\subseteq`, 2209 `\notin`, 2205 `\emptyset`, 2223 `\mid`, 2225 `\parallel`, 22A5 `\perp`, 2220 `\angle`, 2026 `\ldots`, 22EF `\cdots`. Ngoài bảng → thất bại (`unsupported_char:6:<hex>`) |
| 11 (MTExtra) | 2124 `\mathbb{Z}`, 211D `\mathbb{R}`, 2115 `\mathbb{N}`, 211A `\mathbb{Q}`, 2102 `\mathbb{C}`; khác → thất bại |
| 22 (expand) | chỉ hợp lệ làm ký tự ngoặc trong ô của TMPL 0–7; ở nơi khác → thất bại |
| 24 (space) | U+EF00–EF0F → `\,` (khoảng trắng không đổi nghĩa); khác → thất bại |
| 23 (marker), 7, 9, 10, 12 | thất bại (không có mẫu) |
| Có EMBELL (`opt&1`) | mốc 2; mốc 1 → thất bại `embell` |

Bảng EMBELL (mốc 2, ◇): 2/3/4/24 chấm trên → `\dot`/`\ddot`/`\dddot`/`\ddddot`; 5/6/18 phẩy → `^{\prime}`,`^{\prime\prime}`,`^{\prime\prime\prime}`; 8 `\tilde`; 9 `\hat`; 11 `\vec`; 12 `\overleftarrow`; 13 `\overleftrightarrow`; 17 `\bar`; 16/10/19/20/21–23/25–37 → **thất bại** (không có chuyển nghĩa chắc chắn).

## 4. Quy tắc thành bại (cốt lõi)

1. **Cả công thức hoặc không gì cả.** Gặp **bất kỳ** record, selector, variation, typeface, mtcode, tuỳ chọn nào ngoài bảng đã bật → `{ok:false, reason}`; **không** bỏ qua ký tự, không đoán, không trả LaTeX từng phần.
2. Chỉ bỏ qua có chủ đích: FULL/SUB/SUB2/SYM/SUBSYM, SIZE, COLOR, COLOR_DEF, FONT_DEF, ENCODING_DEF, EQN_PREFS, FUTURE ≥100, khoảng trắng tf24 trong dải EF00–EF0F.
3. Thất bại cấu trúc (thiếu END, lệch byte còn sót, số ô sai, độ sâu/giới hạn vượt, `consumed !== len`) → `corrupt`.
4. LaTeX ra phải qua **`katex.renderToString(latex, {throwOnError:true, strict:"error"})`** (KaTeX đã có trong dự án) — lỗi → thất bại `katex_invalid`. Đây là kiểm thứ hai chống mọi lỗi ghép chuỗi (vd. hai mũ liền nhau).
5. Rỗng sau khi bỏ khoảng → `empty`.
6. Hàm không bao giờ ném ra ngoài `decodeMathTypeOle` (bao `try/catch`, tràn ngăn xếp → `limit`).

### 4.1 Giới hạn

| Hạng mục | Trần | Vượt |
|---|---|---|
| Kích thước `.bin` | 64 KB (mẫu tối đa 653 B) | `limit` |
| Luồng "Equation Native" | 32 KB | `limit` |
| Số record/công thức | 2 000 (mẫu tối đa 137) | `limit` |
| Độ sâu lồng khi giải | 40 (mẫu tối đa 8; ngang `ommlLatex.ts` MAX_DEPTH) | `limit` |
| Độ dài LaTeX | 5 000 ký tự (ngang `ommlLatex.ts` MAX_LEN) | `limit` |
| Chuỗi sector CFB | ≤ số sector thực của tệp; phát hiện vòng (tập đã thăm) | `corrupt` |
| Tên chuỗi 0-kết thúc | ≤ 256 byte | `corrupt` |
| Thời gian | 50 ms/công thức; 3 s/tệp Word (đo bằng `Date.now()` giữa các công thức; hết giờ → các công thức còn lại giữ nhãn, thêm cảnh báo `mathtype_timeout`) | nhãn |
| Số công thức/tệp | 1 000 (mẫu tối đa 110) | phần dư giữ nhãn |

Mọi đọc byte đều kiểm biên (ném nội bộ rồi bắt thành `corrupt`). `DOCX_MAX_ENTRIES` nâng **500 → 1 500** (mục 6); `DOCX_MAX_UNPACKED` (30 MB) và `DOCX_MAX_BYTES` (4 MB) giữ nguyên. Chỉ đọc mục `word/embeddings/oleObject<số>.bin` mà quan hệ có `Type` kết thúc `/oleObject`; **không bao giờ thực thi/mở OLE** (chỉ đọc byte).

### 4.2 Chia mốc (bật theo "danh sách đã kiểm")

`mtef.ts` giữ hằng `VERIFIED = { selectors: [0..7, 10(var0), 11(var0), 27, 28, 29], …}`. Mã cho mốc 2 có thể viết sẵn nhưng **tắt** cho tới khi có test dùng `.bin` thật. Bật = thêm vào `VERIFIED` kèm test vàng.

## 5. Hợp đồng module (tut-code)

```ts
// src/lib/mathtype/cfb.ts — thuần, không phụ thuộc
export type CfbResult = { ok: true; data: Buffer } | { ok: false; reason: "not_cfb" | "corrupt" | "stream_missing" | "limit" };
export function readCfbStream(buf: Buffer, streamName: string): CfbResult;

// src/lib/mathtype/mtef.ts — thuần (+ katex để kiểm), không DB/mạng
export type MathTypeFailReason =
  | "not_cfb" | "corrupt" | "no_equation_stream" | "bad_header" | "mtef_version"
  | "limit" | `unsupported_record:${number}` | `unsupported_template:${number}.${number}`
  | `unsupported_char:${number}:${string}` | "embell" | "double_script" | "katex_invalid" | "empty";
export type MathTypeDecode = { ok: true; latex: string; warnings: string[] } | { ok: false; reason: MathTypeFailReason };
export function decodeMathTypeOle(buf: Buffer): MathTypeDecode;     // gọi readCfbStream("Equation Native") → bỏ 28 byte → giải MTEF → LaTeX → kiểm KaTeX
export const MATHTYPE_LIMITS: { maxBin: number; maxRecords: number; maxDepth: number; maxLatex: number };
```

`warnings`: chỉ chuỗi ngắn mã hoá (`has_tex_input`, `size_changed`) — không dữ liệu người dùng. Có thể tách `mtefLatex.ts` (cây → LaTeX) nếu `mtef.ts` > 400 dòng; cùng thư mục nên không đổi phạm vi.

```ts
// src/lib/mathtype/wmfSvg.ts — MỐC 2
export type WmfResult = { ok: true; svg: string; width: number; height: number } | { ok: false; reason: "not_wmf" | "unsupported_record" | "corrupt" | "limit" };
export function wmfToSvg(buf: Buffer): WmfResult;                 // thuần
export async function wmfToPng(buf: Buffer, scale?: number): Promise<{ ok: true; png: Buffer } | { ok: false; reason: string }>; // máy chủ
```

### 5.1 Ảnh dự phòng WMF (mốc 2) — độ khả thi

- Cấu trúc: header "placeable" 22 B (hộp bao + `inch`) + header chuẩn 18 B + record `(size u32 theo từ, function u16, params)`. 299/299 WMF mẫu chỉ có 17 loại record (mục 2); **cần dịch**: SetWindowOrg/Ext (hệ trục), CreateFontIndirect + SelectObject (cỡ = |height|, nghiêng, tên font), SetTextColor, MoveTo/LineTo (+ CreatePenIndirect: độ dày), Polygon (+ brush), **ExtTextOut** (chuỗi 8-bit, `dx[]`, vị trí hiện tại khi `TextAlign & UPDATECP`). Bỏ qua: Escape, SetBkMode/Color, DeleteObject, SetTextAlign (đọc để biết UPDATECP).
- **Vật chứa phải xét kỹ:** văn bản trong SVG cần font. `sharp` (librsvg) trên môi trường máy chủ **không có font hệ thống** → ký tự thành ô trống. Spike đã thử vẽ bằng `@napi-rs/canvas` + font KaTeX (`node_modules/katex/dist/fonts/*.ttf`, đã có trong dự án): chữ, số, gạch phân số, căn vẽ được, **nhưng** (a) font Symbol/Euclid Symbol phải ánh xạ tay (bảng Symbol→Unicode cỡ ~40 ký tự), π/α/ngoặc to hiện ô vuông nếu thiếu glyph; (b) ngoặc to ghép từ ba mảnh `æ ç è` (Symbol 0xE6/E7/E8) cần vẽ bằng đường, không in được bằng font; (c) khoảng cách chữ chưa khớp nếu dùng `dx` không đúng đơn vị. **Kết luận: được cho công thức đơn giản (phân số/mũ/chỉ số), xấu với ngoặc/căn to.** Vì mốc 1 đã giải 299/299 nên ảnh dự phòng chỉ cần cho công thức thất bại → ưu tiên thấp.
- Ảnh lưu: PNG, nền trắng, scale 3, ≤ 200 KB; tải lên qua `uploadImageBufferToCloudinary` giống ảnh Word hiện có (`azotaDocxRead.ts` đã trả `images[]`+`mime[]`).
- **Phụ thuộc chưa kiểm:** mô hình câu hỏi chỉ giữ **1 hình/câu** (`imageUrl`, xem `azotaDocx.ts` `imageIndex`) và `MathText` chưa có cú pháp ảnh nội dòng (tut-code kiểm trước khi làm mốc 2). Nếu không hỗ trợ ảnh nội dòng: ảnh dự phòng chỉ gắn khi câu có **đúng một** công thức hỏng và chưa có hình; ngoài ra giữ nhãn.

## 6. Tích hợp

### 6.1 `azotaDocxRead.ts` (tut-code)

1. `DOCX_MAX_ENTRIES = 1500`. Thêm hằng `DOCX_MAX_FORMULAS = 1000`, `DOCX_MAX_FORMULA_MS = 3000`.
2. Bộ đọc quan hệ: ngoài `media/*`, chấp nhận `embeddings/oleObject<số>.bin` (sau `safeName`); lưu tách `oleRels: Map<id,target>`.
3. `case "object"`: lấy `r:id` của `o:OLEObject`, tra `oleRels`, đọc `word/<target>` bằng `readEntry(..., 64 KB, budget)` (lỗi quá lớn → công thức này giữ nhãn, không hỏng cả tệp); gọi `decodeMathTypeOle`. Thành công → `runs.push({ ...props, text: `$${latex}$`, formula: "ole", latex })` (cùng dạng OMML thành công — mọi chỗ đã dùng `$…$` hoạt động tức thì). Thất bại → như hiện nay (`FORMULA_PLACEHOLDER`, `formula:"ole"`, **không có `latex`**) + `mathtypeFail?: MathTypeFailReason` (chỉ để đếm/ghi nhật ký, **không** gửi lý do thô cho gia sư).
4. `DocxRead` thêm `formulaStats: { total: number; decoded: number; failed: number; byReason: Record<string, number> }` (reason đã gom về nhóm: `unsupported_template`/`unsupported_char`/… không kèm số).
5. Mốc 2: nếu thất bại và có WMF xem trước → `wmfToPng` → đẩy vào `images/mime`, run `{ text: FORMULA_PLACEHOLDER, formula:"ole", image:{index, readable:true}, imageFallback:true }`.
6. Đã có sẵn: `assertDocxDepth`, `budget` giải nén, chặn DOCTYPE, magic `PK`; **giữ nguyên**.

### 6.2 `azotaDocx.ts` (tut-code)

- `DocRun` thêm `imageFallback?: true` (mốc 2). `AzotaFlag` thêm `"formula_image"` (mốc 2).
- Cờ: câu còn `⟦công thức⟧` **không có ảnh dự phòng** → `formula_unread` (chặn phát hành, như nay). Câu chỉ còn công thức **có ảnh dự phòng** → `formula_image` (**cảnh báo vàng, không chặn**; `hasFormulaPlaceholder` vẫn đúng cho cờ đỏ — bổ sung hàm `hasUnreadFormula` để chỉ tính nhãn không-ảnh). Mặc định đề xuất: **chặn phát hành chỉ khi còn nhãn không ảnh**; ảnh dự phòng không chặn nhưng hiện cảnh báo "công thức này hiện bằng ảnh — nên gõ lại LaTeX để học sinh đọc rõ trên điện thoại".
- `stats` thêm `withFormulaImage: number`, `formulaDecoded: number`, `formulaFailed: number`.
- Cảnh báo (mục `warn`): mốc 1 đổi câu chữ `formula_unread` thành "có N công thức MathType KiN chưa đọc được (đã gắn nhãn …)"; thêm dòng tổng ở đầu nếu `formulaStats.decoded>0`: "KiN đọc được X/Y công thức MathType; kiểm lại trước khi lưu".
- **Không** đổi luật hiểu đề khác; `sup/sub` bỏ qua cho run có `formula` (dòng 58) — giữ.

### 6.3 API (tut-code)

`POST /api/tutor/ngan-hang/nhap-word` (route.ts): thêm vào phản hồi `formulaStats`. Không schema DB mới. Không endpoint mới. `FORMULA_UNREAD` ở publish giữ nguyên (nhãn không còn → qua).

### 6.4 UI xem trước (tut-dev, `src/components/tutor/de-thi/**`)

- `MathText` (`src/components/MathText.tsx`, **không thuộc phạm vi tut-dev lẫn tut-code** — xem mục 10) đã render `$…$` bằng KaTeX; câu có công thức MathType giải được tự hiển thị đẹp, không sửa `MathText`.
- `NhapWord.tsx`: (a) khối tóm tắt trên cùng: "KiN đọc được X/Y công thức MathType" (từ `res.stats`/`formulaStats`) bên cạnh dòng `withFormulaUnread` hiện có (dòng ~197); (b) mỗi câu có công thức giải được: nhãn xanh nhỏ "Công thức đã đọc từ MathType — kiểm lại", nút **"Sửa câu"** mở ô sửa LaTeX tay (đã có đường sửa `$…$`; thêm gợi ý ngắn); (c) câu còn nhãn: đỏ như nay (`flagText` dòng 38/44 giữ nguyên); (d) mốc 2: câu `formula_image` hiện vàng "Công thức này hiện bằng ảnh" + giữ nút "Sửa câu". Nhãn tiếng Việt, không lộ `reason` kỹ thuật.
- `deThiClient.ts`: `FLAG_TEXT` thêm `formula_image`; `hasFormulaPlaceholder` giữ; thêm `hasUnreadFormula` nếu tut-code xuất ra.
- Hợp đồng phản hồi UI↔API: **chỉ thêm trường** (`formulaStats`, `stats.formulaDecoded`, `stats.formulaFailed`, `stats.withFormulaImage`, cờ `formula_image`); UI phải chịu được thiếu các trường này (tut-dev có thể làm trước API).

## 7. Phạm vi tệp (không giẫm nhau)

| Bên | Được sửa/tạo | Không đụng |
|---|---|---|
| **tut-code** | `src/lib/mathtype/cfb.ts`, `mtef.ts` (+ `mtefLatex.ts` nếu tách), `wmfSvg.ts` (mốc 2); `src/lib/azotaDocxRead.ts`; `src/lib/azotaDocx.ts`; `src/app/api/tutor/ngan-hang/nhap-word/route.ts`; test thuần trong `tools/local-e2e/mathtype.ts` (và tệp mẫu tổng hợp `tools/local-e2e/mathtype-fixtures.ts` — chỉ `.bin` tự dựng bằng bộ dựng CFB/MTEF nhỏ, **không** commit tệp Word/`.bin` thật của gia sư); `tools/mathtype-spike.mjs` (đã có) | mọi tệp trong `src/components/**` |
| **tut-dev** | `src/components/tutor/de-thi/NhapWord.tsx`, `deThiClient.ts` (chỉ `FLAG_TEXT`/helper hiển thị) | `src/lib/**`, `src/app/api/**`, `MathText.tsx` |
| Cả hai | — (hợp đồng phản hồi ở 6.4 là điểm tựa; tut-code đổi tên trường phải báo tut-dev) | |

Không migration, không `db push`, không đổi `package.json` (jszip/xmldom/katex đã có; **không** thêm thư viện CFB/MTEF — tự viết, ~350 dòng, nhất quán quyết định BU-03.md mục 7 "không dịch vụ ngoài"). Dữ liệu thật từ ba tệp mẫu **không** vào git.

## 8. Test phải có (`t-mtef-*`, thuần, chạy bằng tsx)

| Test | Kiểm |
|---|---|
| `t-cfb-basic` | dựng CFB nhỏ (mini-stream và FAT-stream), đọc `Equation Native`; chữ ký sai/header cụt → `not_cfb`; chuỗi sector vòng, sector vượt tệp, DIFAT vòng → `corrupt`; không có luồng → `stream_missing` |
| `t-mtef-golden` | (cục bộ, không commit mẫu) với 3 tệp mẫu của chủ: 299/299 `ok:true`; 39 công thức có TeX Input khớp (chuẩn hoá mục 2.1); đối chiếu bảng 2.1 |
| `t-mtef-synth` | bộ dựng MTEF nhỏ trong test: ngoặc 0–7, căn, phân số lồng, mũ/dưới/cả hai, hàm tf1/tf2, Hy Lạp, số thập phân `2,5`, `125^{\circ}`, `A_{CT}`, hai mũ liền → `double_script` |
| `t-mtef-fail` | selector 15 (chưa bật), tích phân/MATRIX/PILE/EMBELL → `ok:false` đúng nhóm; typeface 23; mtcode lạ; variation fence=4; số ô fence sai; thiếu END; byte dư; tag lạ 50; SIZE nhánh lạ — **không bao giờ** trả LaTeX từng phần |
| `t-mtef-limits` | độ sâu 41 (dựng), 2 001 record, `.bin` 64 KB+1, LaTeX >5 000 → `limit`; fuzz 2 000 lần lật byte ngẫu nhiên một `.bin` mẫu tổng hợp: không bao giờ ném, mỗi lần đều `ok` hoặc `ok:false` (và nếu `ok` thì KaTeX render được) |
| `t-docx-mathtype` | docx tổng hợp 3 công thức (jszip): 1 giải được → run `$…$`+`latex`; 1 thất bại → nhãn, `formulaStats`; 1 `.bin` hỏng → nhãn, tệp vẫn đọc; 1 `.bin` quá 64 KB → chỉ công thức đó giữ nhãn; >1 500 mục → `TOO_LARGE`; DOCTYPE vẫn bị chặn |
| `t-flags-mathtype` | `parseAzotaBlocks`: câu giải được → không cờ; câu nhãn → `formula_unread`; (mốc 2) nhãn có ảnh → `formula_image` không chặn publish; `hasFormulaPlaceholder` tương thích |
| Ca phá | docx cố đưa `oleObject` có đường dẫn `..`, `embeddings/` giả tên (`.exe`), `r:id` trỏ ngoài `embeddings/` → bỏ qua; `.bin` không phải CFB → nhãn; zip bomb vào `.bin` → `TOO_LARGE` đúng như hiện |
| Quyền | không đổi: `requireTutor()` đã bao route nhập Word (Q1 BU-03.md); thêm 1 ca kiểm 401/403 cho nhap-word nếu chưa có |

## 9. Cờ

- **ĐỔI NỀN:** không thêm thư viện; không schema. Nâng `DOCX_MAX_ENTRIES` 500→1 500 (đổi trần an toàn — ghi vào PR). Tự viết bộ giải nhị phân (~350 dòng) — đã nêu ở BU-03.md.
- **TRẺ EM:** nhập đề là việc của gia sư; **không** ghi tên/ảnh học sinh. Không lưu tệp Word hay `.bin` gốc (chỉ ảnh Word hiện có → Cloudinary). Không đưa mẫu của gia sư vào git/repo. Log: chỉ đếm theo nhóm lý do, **không** log nội dung công thức/LaTeX/TeX Input.
- **TIỀN:** không liên quan.
- **Rủi ro còn lại (thật):**
  1. Chỉ 6 loại template có mẫu; Toán 12 thật có hệ phương trình, tích phân, vectơ, giới hạn, ma trận — **chưa kiểm**. Mốc 1 sẽ **thất bại có kiểm soát** (nhãn) với chúng; mốc 2 cần mẫu.
  2. Thứ tự ô của template ngoài 6 loại lấy từ tài liệu; một lần đoán sai = LaTeX sai nhưng KaTeX vẫn hợp lệ ("sai im lặng"). Vì thế **không bật** selector nào chưa có test vàng bằng mẫu thật.
  3. Bảng ký tự có thể thiếu (ví dụ ký tự tiếng Việt trong tf1 như `ư`, `ơ`, `đ` khi gia sư gõ chữ trong công thức, font VNI-Times thấy ở 11 record WMF): hiện → thất bại `unsupported_char:1:<hex>`. Cần mẫu để quyết (đề xuất: tf1 + chữ Việt → `\text{…}` nếu mtcode là Unicode Latin có dấu — chưa xác nhận).
  4. KaTeX hợp lệ ≠ đúng nghĩa. Giảm nhẹ: gia sư vẫn phải xem lại (nhãn xanh "kiểm lại") trước khi lưu, bản lưu là NHÁP.

**Câu hỏi cho chủ:**
1. Cho **mốc 1** (chỉ 6 loại template trên + ngoặc 0–7) làm trước, đúng không? Phần còn lại làm sau khi có tệp mẫu.
2. Xin thêm **một tệp Word Azota có**: tích phân, tổng/giới hạn, vectơ (có mũi tên), hệ phương trình (ngoặc nhọn), ma trận, chữ Việt trong công thức, hoá học (mũi tên phản ứng) — để mở khoá mốc 2.
3. Câu có công thức đọc được vẫn là **nháp** (đang vậy) — đồng ý không tự động phát hành?

## 10. Tệp chung cần xin COO

- `src/components/MathText.tsx` (KaTeX) — **không sửa ở mốc 1**; mốc 2 cần ảnh nội dòng (`![](url)` hoặc token riêng) → xin COO cho một người sửa (đề xuất tut-dev, nhưng đây là tệp dùng chung cả hệ thống).
- `package.json` / `next.config.ts` — **không đổi**. Nếu mốc 2 dùng `@napi-rs/canvas` (đã nằm `serverExternalPackages`) cần đảm bảo font KaTeX `.ttf` được đóng gói vào hàm serverless: xin COO duyệt thêm `outputFileTracingIncludes` cho route nhap-word (hoặc chép 3 tệp `.ttf` vào `src/assets`).
- Hai tệp lớn `admin/khoa-hoc`, `admin/thi-thu` (phòng Quản trị): **không dính** BU-03-MATHTYPE; không yêu cầu mục D.

## 11. Bảng mốc

| | **Mốc 1** (làm ngay) | **Mốc 2** (khi có mẫu) |
|---|---|---|
| tut-code | `cfb.ts`; `mtef.ts` (record đầy đủ + ngoặc 0–7, căn bậc 2, phân số, mũ/dưới, ký tự theo mục 3.5, KaTeX kiểm); tích hợp `azotaDocxRead.ts`/`azotaDocx.ts` (cờ không đổi) ; test `t-cfb-basic`, `t-mtef-golden`, `t-mtef-synth`, `t-mtef-fail`, `t-mtef-limits`, `t-docx-mathtype` | PILE/MATRIX/EMBELL/tích phân/tổng/giới hạn/vectơ/ngoặc ngang (viết sẵn, bật theo `VERIFIED`), nth-root, gạch chéo; `wmfSvg.ts` + PNG dự phòng; cờ `formula_image`; `t-flags-mathtype` |
| tut-dev | `NhapWord.tsx` khối tóm tắt "đọc được X/Y", nhãn "đã đọc từ MathType — kiểm lại", sửa LaTeX tay | nhãn "hiện bằng ảnh", `FLAG_TEXT.formula_image` |
| Kết quả mong đợi | 299/299 công thức của 3 mẫu thành LaTeX; công thức ngoài danh sách vẫn nhãn như nay | công thức lạ có ảnh hoặc LaTeX; mẫu mới đạt ≥ 95% |
| Chặn phát hành | còn nhãn → chặn (không đổi) | còn nhãn không ảnh → chặn; ảnh dự phòng → cảnh báo |
| Ước | 2 ngày (spike đã chứng minh, mã mẫu ~90 dòng ra 299/299) | 2–3 ngày |

## 12. Cách chạy lại spike

`node tools/mathtype-spike.mjs "/đường/dẫn/De_Toan12_GK1_Azota.docx" "/đường/dẫn/D. DUNG SAI - CH.docx" "/đường/dẫn/F. BAI TAP NANG CAO - CH.docx"` → mỗi tệp in JSON: `bins`, `decodedClean`, `withTexInput`, `bytesMin/Max`, `tags`, `tmpl`, `chars`, `embell`. Kỳ vọng: 107/110/82 `decodedClean` bằng `bins`, `fail: []`. Script chỉ đọc, không ghi, không mạng. Bộ chuyển LaTeX mẫu và bộ vẽ WMF thử nghiệm của spike để trong thư mục tạm của phiên (không commit); mô tả đầy đủ ở mục 3.4–3.5, 5.1.
