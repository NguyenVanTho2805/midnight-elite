# Màn Hôm nay — BCA-D1-TK (26/11/2026)

Màn đầu tiên sau khi đăng nhập của chủ lớp và giáo viên (`huong-chon.md` sửa 3). Đường dẫn `/quan-ly`.
**Quy tắc tính** (việc nào hiện, đếm thế nào, ai thấy): [`../nghiep-vu/hom-nay.md`](../nghiep-vu/hom-nay.md) — tệp này chỉ nói giao diện. Khung, trạng thái chung: [khung-quan-ly.md](khung-quan-ly.md). Thay cho tab "📣 Việc hôm nay" và "🏠 Tổng quan" của sheet.

## 1. Mục đích
Trả lời trong 3 giây: **tối nay có buổi gì, đã điểm danh chưa, còn việc gì phải làm**. Mọi mục là liên kết hoặc nút thật dẫn tới chỗ xử lý (`huong-chon.md` sửa 6).

## 2. Ai dùng và khác nhau thế nào (theo nghiệp vụ Điều 6)
| Khối | Chủ lớp | Giáo viên môn |
|---|---|---|
| Lớp tối nay / Buổi tối qua | Mọi môn | Chỉ môn mình; không có buổi → "Tối nay không có buổi Toán" + buổi kế của môn mình |
| Việc cần làm | Mức 1–6 | Chỉ mức 5 của môn mình (buổi chưa điểm, em vắng nhiều, buổi thiếu record) |
| Thử sắp hết / Hết thử – hỏi em, nút Gia hạn / Lên chính thức | Có | **Không** (quyết định 16; nghiệp vụ Câu hỏi 2) |
| Đơn chờ duyệt | Có | Không |
| Thẻ số liệu | Đủ các thẻ | Sĩ số và có mặt của môn mình |
| Phiếu chưa thu | Từ Đợt 3 | Không bao giờ |
| Lịch 7 ngày | Mọi môn | Môn mình |

## 3. Số liệu thật ngày 26/11 (thứ Năm) dùng làm mẫu (từ nghiệp vụ)
- Lớp tối nay: **Anh 22:15–23:45 · 8 chính thức · 43 thử · đã điểm 0/51**.
- Việc: Đơn chờ duyệt 1 · Mất hồ sơ 1 · **Thử sắp hết 33 em** (16 em hết 28/11, 17 em hết 29/11) · **Buổi chưa điểm danh 5** (Toán 21/11 + 24/11, Địa 20/11, Anh 23/11, Sử 25/11) · Buổi thiếu record 5.
- Thẻ: Chính thức 20 · Đang thử 50 · Thử hết trong 3 ngày 33 · Lên chính thức tháng này 0 · sĩ số Toán 14·49, Sử 14·40, Địa 4·16, Anh 8·43.
→ Khối thử sắp hết phải chịu được **hàng chục em cùng lúc** (ngày 28/11 lên 46 em): gom theo ngày hết, không đổ 33 hàng ra Hôm nay.

## 4. Nội dung theo thứ tự ưu tiên (giữ đúng thứ tự nghiệp vụ Điều 7)
1. **Lớp tối nay** (+ "Buổi tối qua" từ 00:00 đến 05:59 nếu buổi hôm qua chưa điểm đủ — đặt trên thẻ ngày mới).
2. **Việc cần làm**: đầu khối là hàng **chip đếm bấm được** (Đơn 1 · Thử sắp hết 33 · Chưa điểm 5 · Thiếu record 5), dưới là danh sách việc theo mức.
3. **Thẻ số liệu** (bấm được, mở danh sách đã lọc).
4. **Lịch 7 ngày tới**.

## 5. Khối "Lớp tối nay" theo giờ (giờ Việt Nam, giờ máy chủ)
| Lúc | Dòng chính (h1) | Dòng phụ | Nút chính | Nút phụ (44px) |
|---|---|---|---|---|
| Trước 21:45 | "Tối nay học Tiếng Anh lúc 22:15" | "8 chính thức · 43 thử · còn 3 giờ 20 phút" | "Điểm danh mở lúc 21:45" — nút phụ viền `border-input`, vẫn bấm được để **xem trước danh sách** (chỉ đọc) | Thêm nội dung / record |
| 21:45–23:45 | "Tối nay học Tiếng Anh lúc 22:15" / "Đang học Tiếng Anh" | "Đã điểm 12/51" | **Điểm danh** — vàng 56px, rộng hết | Mở Meet ¹ |
| Sau 23:45, chưa đủ | "Tiếng Anh tối nay chưa điểm xong" (`warn`) | "Còn 39 em chưa điểm" | **Điểm danh tiếp** (vàng) | Thêm nội dung / record |
| Đã đủ | "Tiếng Anh tối nay đã điểm đủ" | "49 có · 1 phép · 1 vắng" | Thêm nội dung / record (vàng nếu chưa có record) | Xem điểm danh |
| 00:00–05:59, buổi hôm qua chưa đủ | "Buổi tối qua — Anh 26/11" | "Còn thiếu 51 em" | **Điểm danh** (vàng) | — |
| Không có buổi | "Tối nay không có buổi" | "Buổi kế: Thứ Sáu 27/11 · Địa lí 22:15" | — | Xem lịch |
| Buổi bị huỷ | "Tiếng Anh tối nay: lớp nghỉ" | lý do ("GV ốm") | — | Xem buổi |
| 2 buổi cùng tối (học bù) | 2 thẻ xếp chồng, giờ sớm trước | | | |

¹ "Mở Meet" chỉ hiện khi môn đã có link Meet (đồng bộ Meet là Đợt 4; nếu dữ liệu chuyển từ sheet mang theo link thì hiện ngay).
- Câu và nút to theo mẫu C, tô theo token A (nền `raised`, bo 20). Đây là chỗ **duy nhất** có nút vàng trên Hôm nay.
- "Điểm danh" là `<Link>` có prefetch, để màn điểm danh mở tức thì và có sẵn danh sách nếu mạng rớt trong buổi Meet.
- Đếm ngược cập nhật mỗi phút; lần dựng đầu ở máy chủ.
- Trang mở trước 21:45 và để nguyên: tới 21:45 trang tự làm mới một lần (`router.refresh()`), nút "Điểm danh mở lúc 21:45" đổi thành nút vàng "Điểm danh" ở cùng chỗ (bản dựng: `HenLamMoi` trong `components/quan-ly/dem-nguoc.tsx`).

## 6. Khối "Việc cần làm"
_Cập nhật 26/11 theo bản dựng (BCA-D1-GD3)._
```
Việc cần làm
[Đơn 1] [Thử sắp hết 33] [Chưa điểm 5] [Thiếu record 5]     ← chip đếm, là <a> tới danh sách lọc
───────────────────────────────────────────────────────
● Đơn chờ duyệt · Nguyễn … · 25/11                  [Mở]      mức 1 → /quan-ly/don?don=<id> (đúng đơn)
Hết thử – hỏi em · 2 em               [Gia hạn cả nhóm] [Xem 2 em ›]
Thử sắp hết · Hết Thứ Bảy 28/11 · 16 em  [Gia hạn cả nhóm] [Xem 16 em ›]   → /quan-ly/hoc-sinh?het_ngay=2026-11-28
    Trần Gia Bảo  Toán, Anh  còn 2 ngày                            [Xử lý]            ← khối hẹp (< 560px)
    Trần Gia Bảo  Toán, Anh  còn 2 ngày │ L2 │ 0912 345 678 │ [Lên chính thức] [Gia hạn] [⋯]   ← khối rộng (≥ 560px)
    + 13 em nữa
Thử sắp hết · Hết Chủ nhật 29/11 · 17 em  …
Buổi chưa điểm danh · Toán · 2 buổi                [T6 21/11] [T2 24/11]   ← mỗi buổi một nút tới màn điểm danh
Em vắng nhiều · Anh · 3 em vắng từ 2 buổi           [Tên 2] [Tên 3] [Ma trận ›]
Buổi thiếu record · Toán · 2                        [Mở]
Sửa dữ liệu · Tên · Gmail, SĐT                      [Mở]      mức 6
```
- **Chip đếm** đầu khối là "thẻ số liệu bấm được để lọc" của `huong-chon.md` sửa 3: `Đơn` → `/quan-ly/don`, `Thử sắp hết` → `/quan-ly/hoc-sinh?het=3`, `Chưa điểm` → `/quan-ly/diem-danh#chua-diem`, `Thiếu record` → `/quan-ly/buoi-hoc?record=thieu`. Số > 0 chữ `warn`, bằng 0 chữ `text-3` (vẫn bấm được).
- Việc xếp theo mức của nghiệp vụ, mỗi hàng ≥ 56px, là `<a>` hoặc có nút thật.
- **Thử sắp hết / Hết thử – hỏi em** (chủ lớp): gom theo ngày hết; mỗi nhóm hiện 3 em đầu (theo tên). Nhóm "Hết thử – hỏi em" (đã hết, đang bị khoá) đứng trên, chip `danger-bg` "Hết thử 25/11".
  - Nghiệp vụ 3.2 cho mỗi hàng ba việc **Lên chính thức / Gia hạn / Cho nghỉ**. Bố cục theo **bề rộng khối** (container query 560px), không theo màn hình:
    - Khối hẹp (điện thoại): một nút **"Xử lý"** mở tờ trượt có 3 việc đó + "Đánh dấu xong (ẩn 3 ngày)".
    - Khối rộng (máy tính): **2 nút 44px** trên hàng — "Lên chính thức", "Gia hạn" — và nút **"⋯"** (mẫu disclosure, Esc đóng) chứa "Cho nghỉ…" (chữ `danger`) và "Ẩn 3 ngày". Hàng có thêm cột Lứa và SĐT HS (bấm gọi). Hộp thoại của từng việc: `man-hoc-sinh.md` §9.
  - "Gia hạn cả nhóm" mở hộp thoại gia hạn nhiều em (`man-hoc-sinh.md` §9.1), sẵn 16 em, **liệt kê tên từng em** (môn · hạn hiện tại) trước nút Gia hạn.
  - "Xem N em ›" mở danh sách học sinh lọc đúng ngày hết của nhóm (`?het_ngay=YYYY-MM-DD`); số trên nút bằng số em trong nhóm và bằng số em danh sách hiện (trừ em chủ vừa "Ẩn 3 ngày").
- **Đơn chờ duyệt** (chủ lớp, T43): "Mở" dẫn tới đúng đơn trên màn Đơn (đơn được tô và cuộn tới); ở đó có "Tạo hồ sơ" và "Bỏ qua". Đơn đã xử lý hết khỏi danh sách việc.
- **Đánh dấu xong** (nghiệp vụ 3.3): việc học thử ẩn 3 ngày, việc khác ẩn tới hết hôm nay; sau khi ẩn hiện thanh Hoàn tác 5 giây.
- Chip ≤ 3 ngày dùng `warn-bg`/`warn` (`huong-chon.md` sửa 4).
- Không còn việc: "Không còn việc gì cần làm hôm nay."

## 7. Khối "Thẻ số liệu"
Theo nghiệp vụ Điều 4, mỗi thẻ là `<a>` tới danh sách đã lọc:
- Chính thức `20` → `/quan-ly/hoc-sinh?loai=chinh-thuc` · Đang thử `50` → `?loai=thu` · Thử hết trong 3 ngày `33` → `?het=3` · Lên chính thức tháng này `0`.
- **Sĩ số theo môn**: 4 dòng "Toán 14 chính thức · 49 thử" → `/quan-ly/hoc-sinh?mon=toan`.
- **Có mặt tháng này theo môn**: "Toán 59/59", "Sử 67/104"… → ma trận tháng của môn. Hiện số đếm, chưa hiện %, chờ `nghiep-vu/diem-danh.md` Câu hỏi 1.
- Số 24/800 `tabular-nums`, nhãn 13 `text-2`, xuống dòng khi dài (không cắt).

## 8. Bố cục 390px
```
┌──────────────────────────────────────┐
│ Hôm nay                 Thứ Năm 26/11 │ 56
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Tối nay học Tiếng Anh            │ │ h1 22/800, text-wrap: balance
│ │ lúc 22:15                        │ │
│ │ 8 chính thức · 43 thử · còn 12 ph│ │ text-2
│ │ ┌──────────────────────────────┐ │ │
│ │ │         Điểm danh            │ │ │ 56 vàng
│ │ └──────────────────────────────┘ │ │
│ │ [ Mở Meet ↗ ]                    │ │ 44
│ └──────────────────────────────────┘ │
│ Việc cần làm                         │
│ [Đơn 1] [Thử sắp hết 33]             │ chip xuống dòng, không cắt
│ [Chưa điểm 5] [Thiếu record 5]       │
│ ● Đơn chờ duyệt · …          [Mở]    │
│ Thử sắp hết · Hết T7 28/11 · 16 em › │
│   Trần Gia Bảo · còn 2 ngày [Xử lý]  │
│   …                                  │
│ Số liệu lớp                          │
│ ┌──────────┐┌──────────┐             │ thẻ 2 cột, cao 80
│ │20 Chính  ││50 Đang   │             │
│ │thức      ││thử       │             │
│ └──────────┘└──────────┘             │
│ 7 ngày tới                           │
├──────┬──────┬──────┬──────┬──────────┤
│Hôm nay│Điểm danh│Học sinh│Buổi học│Thêm│
└──────┴──────┴──────┴──────┴──────────┘
```
- Một cột, lề 16, khoảng giữa khối 24. Ở 18:55, thẻ tối nay + nút nằm trong màn hình đầu; từ 21:45 nút Điểm danh vàng ở cùng chỗ (không đẩy bố cục).
- Giáo viên: thẻ tối nay của môn mình, việc mức 5 của môn mình, thẻ sĩ số và có mặt, lịch.

## 9. Bố cục 1280px
_Cập nhật 26/11 theo bản dựng (BCA-D1-GD3): lưới 8/4 thay 7/5 để hàng thử sắp hết đủ chỗ cho cột Lứa · SĐT HS · 2 nút + "⋯" trên một dòng 48px._
```
┌ thanh bên ┬────────────────────────────────────────────────────────────────────┐
│           │ Hôm nay · Thứ Năm 26/11                                             │
│           │ ┌──────────────────────────────────────────┐ ┌────────────────────┐ │
│           │ │ Tối nay học Tiếng Anh lúc 22:15          │ │ Số liệu lớp        │ │
│           │ │ 8 chính thức · 43 thử · còn 12 ph · GV … │ │ 20 Chính · 50 Thử  │ │
│           │ │ [   Điểm danh   ] [Mở Meet ↗]            │ │ 33 Hết ≤3 · 0 Lên  │ │
│           │ └──────────────────────────────────────────┘ │ Sĩ số · Có mặt     │ │
│           │ ┌ Việc cần làm ────────────────────────────┐ ├────────────────────┤ │
│           │ │ [Đơn 1][Thử sắp hết 33][Chưa điểm 5]…    │ │ 7 ngày tới         │ │
│           │ │ Tên · môn · còn 2 ngày │L2│SĐT│[Lên CT][Gia hạn][⋯]│ T6 27 Địa …  │ │
│           │ └──────────────────────────────────────────┘ └────────────────────┘ │
└───────────┴────────────────────────────────────────────────────────────────────┘
```
- Lưới 12 cột, khoảng 24: **cột trái 8** (tối nay, việc cần làm), **cột phải 4** (số liệu, 7 ngày tới). Thứ tự trong DOM vẫn là tối nay → việc → số liệu → lịch (đúng thứ tự đọc của trình đọc màn hình).
- Nút "Điểm danh" cao 56, tối thiểu 224px (`sm:min-w-56`). Hàng thử sắp hết có thêm cột "Lứa" và "SĐT HS" (chủ lớp) để gọi nhanh; việc trên hàng là 2 nút + "⋯" (§6).
- Tên giáo viên phụ trách ("GV Thanh, GV Hoa") đứng cuối dòng phụ của thẻ tối nay, không xuống dòng giữa cụm; không lặp chữ "GV" khi tên hiển thị đã có.
- Mỗi khối có Suspense riêng; khối tối nay đọc hàm riêng (`lopToiNay`) nên hiện trước các khối còn lại.

## 10. Trạng thái
| Trạng thái | Cách hiện |
|---|---|
| Đang tải | Mỗi khối tải độc lập (Suspense riêng), khối tối nay ưu tiên: `skeleton` thẻ cao 200, 4 chip, 3 hàng 56, 4 thẻ 80. |
| Trống hoàn toàn | "Không còn việc gì cần làm hôm nay." (thẻ tối nay vẫn hiện). |
| Lỗi một khối | Chỉ khối đó: "Không tải được việc cần làm · Thử lại"; khối khác vẫn dùng được. |
| Mất mạng | Dữ liệu lần tải gần nhất + "Cập nhật lúc 21:40"; dải mất mạng chung. Nút "Điểm danh" vẫn mở được nếu đã prefetch. Hộp thoại gia hạn/lên chính thức cần mạng. |
| Làm mới | Mở màn hoặc kéo xuống để làm mới (nghiệp vụ Điều 8); không tự làm mới định kỳ khi đang đọc. |
| Học thử | Khối thử sắp hết (§6); chip `trial` / `warn`. |
| Khoá | Nhóm "Hết thử – hỏi em" (đã hết 14 ngày, đang bị khoá). Giáo viên không thấy. |
| Chưa có lịch | "Chưa có lịch buổi học. — Sinh buổi tháng 12" (chủ lớp, mở màn Buổi học). |

## 11. Token dùng
`bg`, `surface` (khối, thẻ số liệu), `raised` (thẻ tối nay), `text`, `text-2`, `text-3`, `gold`/`on-gold` (một nút chính trong thẻ tối nay), `warn`/`warn-bg`, `danger`/`danger-bg`, `trial-fg`/`trial-bg`, `border`, `border-input` (nút phụ), `focus`, `row-hover`; bo 20 (thẻ tối nay), 14 (thẻ, nút), 999 (chip); khoảng `space-6` giữa khối.

## 12. Chuyển động
Không có. Số liệu hiện ngay, **không** đếm chạy. Không hiện dần khi cuộn. Chỉ `scale(.97)` 80ms khi nhấn, tờ trượt "Xử lý" 240ms; giảm chuyển động → tức thì.

## 13. Linh kiện React Bits
Không dùng. Đã cân nhắc `Counter` (odometer) cho thẻ số liệu và `AnimatedList` cho danh sách việc — loại vì làm chậm việc đọc màn hằng ngày và trái chốt "khu quản lý gần như không chuyển động".

## 14. Kiểm nhận
1. 390px, chủ lớp, 26/11 lúc 18:55: thẻ đầu "Tối nay học Tiếng Anh lúc 22:15", "còn 3 giờ 20 phút", nút "Điểm danh mở lúc 21:45" (nút phụ); lúc 21:45 nút thành vàng 56px ở cùng vị trí.
2. 00:20 ngày 27/11 khi buổi Anh 26/11 còn thiếu: thẻ "Buổi tối qua — Anh 26/11" nằm trên cùng; từ 06:00 thì mất, buổi chuyển vào "Buổi chưa điểm danh".
3. Chip "Thử sắp hết 33" → danh sách học sinh lọc đúng 33 em; URL có `het=3`.
4. Tài khoản giáo viên chỉ dạy Anh lúc 22:00: một thẻ "Anh 22:15 · 51 em", việc "Anh 1 buổi chưa điểm danh (23/11)", không có gì của Toán, Sử, Địa, không có khối thử sắp hết.
5. Mọi phần tử bấm được là `<a>`/`<button>`, vùng bấm ≥ 44px; không có `div` bắt sự kiện bấm.
6. Giả lập lỗi API việc cần làm → chỉ khối đó báo lỗi, nút Điểm danh vẫn bấm được.

## Nguồn tham khảo
- Quy tắc việc, thẻ, theo vai, thứ tự trên điện thoại: `docs/bca/nghiep-vu/hom-nay.md` (từ `kin_tqData`, `kin_viecList` của Apps Script v8.12).
- Mỗi mục "cần làm" là liên kết/nút thật; thẻ bấm được để lọc: `huong-chon.md` sửa 3 và 6.
- URL giữ trạng thái lọc, xử lý trống/lỗi: skill `web-design-guidelines` (Navigation & State, Content Handling).
- Câu + nút to: mẫu C; nền và thẻ: mẫu A (đợt chấm 26/11).

## Câu hỏi cho chủ
Câu hỏi về quy tắc của màn này đã ở `nghiep-vu/hom-nay.md` (giờ của "Buổi tối qua"; giáo viên có thấy em thử sắp hết không) — thiết kế đang theo phương án khuyên dùng ở đó. Câu hỏi giao diện:
1. **Trên điện thoại, mỗi em "Thử sắp hết" có ba nút ngay trên hàng hay một nút "Xử lý"?**
   - A. Một nút "Xử lý" mở tờ trượt có Lên chính thức / Gia hạn / Cho nghỉ / Ẩn 3 ngày; máy tính vẫn có 3 nút trên hàng — **khuyên dùng** (hàng gọn, khó bấm nhầm việc liên quan học phí).
   - B. Ba nút ngay trên hàng ở cả điện thoại.
2. **Hôm nay hiện bao nhiêu em mỗi nhóm "Thử sắp hết"?**
   - A. 3 em đầu + "Xem 16 em ›" và "Gia hạn cả nhóm" — **khuyên dùng** (ngày 28/11 có 46 em, hiện hết sẽ đẩy số liệu và lịch xuống rất xa).
   - B. Hiện hết, có nút thu gọn từng nhóm.
