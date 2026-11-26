# Màn Điểm danh — BCA-D1-TK (26/11/2026)

Ưu tiên số 1 của Đợt 1 (`QUYET-DINH.md` mục 21): **giáo viên điểm danh trên điện thoại ngay trong buổi Meet**.
Khung chung, chỉ báo lưu, hàng đợi khi mất mạng: [khung-quan-ly.md](khung-quan-ly.md). Token: `token.md` (phần bổ sung khu quản lý).

## 1. Mục đích và ai dùng
- **Mục đích:** ghi Có / Phép / Vắng cho từng em của một buổi, nhanh, bằng một tay, khi điện thoại đang chạy Google Meet; xem lại cả tháng dạng ma trận.
- **Giáo viên cộng tác:** chỉ buổi của môn mình. **Chủ lớp:** mọi buổi.
- **Ba màn con:**
  1. `/quan-ly/diem-danh` — danh mục: buổi hôm nay, buổi chưa điểm (14 ngày gần nhất), lối vào ma trận tháng.
  2. `/quan-ly/diem-danh/[buoiId]` — điểm danh một buổi (điện thoại 1 cột / máy tính bảng).
  3. `/quan-ly/diem-danh/thang?mon=toan&thang=2026-11` — ma trận tháng.

## 2. Số liệu thật để thiết kế (sheet ngày 26/11)
- Toán: 63 em có ghi danh (14 chính thức + 49 học thử); Anh 51; Sử 54; Địa 20. → danh sách một buổi **dài tới ~65 hàng**.
- Sheet hiện chỉ lưu ngoại lệ: `__DiemDanh` có 51 dòng `V` (vắng) + 4 dòng `P` (phép); em không có dòng nào trong buổi "Đã điểm danh" được coi là có mặt. Web mới phải **tách "Chưa điểm" khỏi "Có"** — đó là lý do có nút "Đánh tất cả có mặt" thay vì mặc định ngầm.
- Ký hiệu cũ `V` = vắng; bộ ký hiệu mới của ma trận: ✓ có · P phép · K vắng (không phép). Chuyển dữ liệu: `V` → K, `P` → P, trống trong buổi đã điểm → ✓ (bàn giao cho `bca-nghiep-vu`).

## 3. Điểm danh một buổi — điện thoại 390px (bản chính)

### Thứ tự ưu tiên nội dung
1. Hàng của từng em: tên + nút Có / Phép / Vắng.
2. Nút "Đánh tất cả có mặt" (dưới ngón cái).
3. Đếm nhanh: Chưa điểm / Có / Phép / Vắng (đồng thời là bộ lọc).
4. Tên buổi, giờ, chỉ báo lưu.
5. Ghi chú từng em, link record, mở Meet — phụ, nằm sau một lần chạm.

### Bố cục
```
┌──────────────────────────────────────┐
│ ‹  Toán · T7 28/11      ● Đã lưu 22:31│ 56  đầu trang dính
├──────────────────────────────────────┤
│ [Chưa điểm 58] [Có 0] [Phép 1] [Vắng 4]│ 48  dải đếm/lọc, dính, cuộn ngang nếu thiếu chỗ
├──────────────────────────────────────┤
│ Nguyễn Minh Anh     ┌────┐┌────┐┌────┐│
│ Chính thức          │ Có ││Phép││Vắng││ 72
│                     └────┘└────┘└────┘│
│ Trần Gia Bảo        ┌────┐┌────┐┌────┐│
│ Thử · còn 2 ngày    │ Có ││Phép││▐Vắng▌│ 72  (Vắng đang chọn: nền danger)
│                     └────┘└────┘└────┘│
│ Nguyễn Ngọc Phương  ┌────┐┌────┐┌────┐│
│ Thảo                │ Có ││▐Phép▌│Vắng││ 92  tên dài xuống 2 dòng, không cắt
│ Thử · còn 9 ngày    └────┘└────┘└────┘│
│ …                                    │
│ 3 em hết thử 28/11 không có trong     │
│ buổi này · Gia hạn (chủ lớp)          │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │   Đánh tất cả có mặt (58)        │ │ 56  nút vàng, dính đáy
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘   + env(safe-area-inset-bottom)
```
- Thanh dưới 5 mục **ẩn** ở màn này (xem khung §3); quay ra bằng ‹ (44×44).
- Hàng: lề 16; nhóm 3 nút rộng 3 × 64 + 2 × 8 = 208px, cao **48**; phần tên còn 138px ở 390px (108px ở 360px), chữ 16/600, xuống dòng tự do. Dưới 340px (container query) nút chuyển xuống hàng riêng, mỗi nút rộng 1/3.
- Nút nằm bên phải (vùng ngón cái tay phải); cả hàng cao ≥ 72px nên hai hàng kề nhau cách nhau ≥ 24px, khó bấm nhầm hàng.
- Nút ghi **chữ đầy đủ** Có / Phép / Vắng (sửa bắt buộc 2 của `huong-chon.md`).
  - Chưa chọn: nền trong suốt, viền 1px `border-input` (3.66:1), chữ `text-2` 15/600.
  - Đã chọn: Có = nền `ok` chữ `on-ok` (10.53) · Phép = nền `excused` chữ `on-excused` (10.07) · Vắng = nền `danger` chữ `on-danger` (8.10); thêm dấu ✓ 14px trước chữ; `aria-pressed="true"`.
  - Đổi màu **tức thì** (`dur-0`), chỉ có `scale(.97)` 80ms khi nhấn.
- Chạm nút đang chọn: không làm gì (không bỏ chọn ngầm). Muốn về "Chưa điểm" → chạm tên em → tờ trượt.
- Thứ tự hàng **cố định** theo tên kiểu Việt (tên → họ đệm, `Intl.Collator('vi')`). Không bao giờ đổi thứ tự khi đang điểm (hàng nhảy dưới ngón tay là lỗi nặng).
- Lọc "Chưa điểm": hàng vừa điểm **vẫn ở lại** tới khi bấm lại bộ lọc hoặc rời màn (tránh hàng biến mất dưới ngón tay); có dòng "Đã điểm 3 em · Ẩn" ở đầu.
- Tìm: nút kính lúp 44×44 trên đầu trang mở ô "Tìm tên…" thay chỗ tiêu đề (ô 16px để iOS không phóng to), lọc tức thì, không dấu.
- Chạm **tên em** → tờ trượt đáy: tên + chip, 3 nút to 56px (Có/Phép/Vắng), ô "Ghi chú buổi này" (ví dụ "Ốm, đã báo Zalo"), nút "Về chưa điểm", liên kết "Xem hồ sơ em". Ghi chú lưu khi rời ô.
- Em học thử: chip `TrialChip` dưới tên ("Thử · còn 9 ngày", ≤ 3 ngày thì màu cam `warn`). Em hết thử hoặc đã nghỉ môn trước ngày buổi: **không có trong danh sách**; cuối danh sách có một dòng "3 em hết thử 28/11 không có trong buổi này" — chủ lớp thấy thêm liên kết "Gia hạn" tới danh sách đã lọc.

### Luồng trong buổi Meet (mục tiêu ≤ 10 chạm, < 60 giây cho 63 em có 5 em vắng)
1. Từ Hôm nay bấm "Điểm danh" trên thẻ buổi tối nay (1 chạm) — hoặc mục "Điểm danh" ở thanh dưới khi đang trong khung giờ buổi (xem Câu hỏi 1).
2. Chạm Vắng / Phép cho các em vắng (5 chạm).
3. Chạm "Đánh tất cả có mặt (58)" (1 chạm) → 58 em còn **Chưa điểm** thành Có. Không ghi đè em đã có Phép/Vắng.
4. Thanh Hoàn tác 5 giây hiện (§6). Hết 5 giây: nút đáy đổi thành "Đã điểm đủ 63/63 · Xong" (Xong = về Hôm nay).
- Làm ngược (đánh tất cả trước rồi sửa em vắng) cũng được: chạm Vắng đè lên Có.
- Em vào Meet muộn: chạm Có đè lên Vắng — không có trạng thái "muộn" (sheet không có).

## 4. Điểm danh một buổi — máy tính 1280px
```
┌ thanh bên ┬──────────────────────────────────────────────────────────────┐
│           │ Thứ Bảy 28/11 · 22:15–23:45 · Anh Thanh       ● Đã lưu 22:31  │
│           │ Toán — Hàm số lượng giác          [Mở Meet] [Dán link record] │
│           │                                                              │
│           │ [Chưa điểm 2] [Có 54] [Phép 4] [Vắng 3]  Tìm tên…  [Đánh tất cả có mặt (2)] │
│           │ ┌──┬──────────────────────┬──────────────┬────────────────────┬───────────────┐ │
│           │ │# │Học sinh              │Loại          │Điểm danh           │Ghi chú        │ │
│           │ ├──┼──────────────────────┼──────────────┼────────────────────┼───────────────┤ │
│           │ │1 │Nguyễn Minh Anh  HS012│Chính thức    │[✓Có] [Phép] [Vắng] │—              │ │ 48
│           │ │2 │Trần Gia Bảo     HS041│Thử·còn 2 ngày│[✓Có] [Phép] [Vắng] │               │ │
│           │ │3 │Lê Thu Hà        HS007│Chính thức    │[Có] [✓Phép] [Vắng] │Ốm, đã báo Zalo│ │
│           │ └──┴──────────────────────┴──────────────┴────────────────────┴───────────────┘ │
│           │ Phím tắt: ↑↓ chọn em · 1 Có · 2 Phép · 3 Vắng · N ghi chú   │
└───────────┴──────────────────────────────────────────────────────────────┘
```
- Bảng của mẫu A nhưng: bỏ nút "Lưu điểm danh" (lưu ngay); nút ghi chữ đủ, cao **44**, rộng tối thiểu 64; nhãn cột viết thường có dấu (không `uppercase`); thêm cột # và mã HS (`text-3`, `translate="no"`).
- Hàng 48 (Carbon lg), đầu bảng dính, `row-hover` khi rê chuột. Ô ghi chú là ô nhập không viền tới khi rê/tiêu điểm (viền `border-input` khi tiêu điểm), lưu khi rời ô hoặc Enter.
- Thẻ đếm của mẫu A thay bằng dải chip đếm-lọc (cùng dữ liệu, chiếm 1 hàng thay vì 1 khối 96px).
- Bàn phím: cả danh sách là **một điểm dừng Tab** (roving tabindex theo hàng); ↑/↓ đổi hàng, ←/→ đổi nút trong hàng, Space/Enter chọn, phím 1/2/3 chọn thẳng Có/Phép/Vắng cho hàng đang tiêu điểm rồi tự xuống hàng sau, N mở ghi chú. Ctrl/⌘+Z trong 5 giây = Hoàn tác.
- Ngữ nghĩa: mỗi hàng là `<tr>`; nhóm nút có `role="group"` `aria-label="Điểm danh Nguyễn Minh Anh"`; mỗi nút là `<button aria-pressed>`. Không dùng `role="radio"` (mũi tên sẽ tự đổi lựa chọn — dễ sửa nhầm).

## 5. Trạng thái
| Trạng thái | Điện thoại | Máy tính |
|---|---|---|
| Đang tải | 8 hàng `skeleton` cao 72 (tên 60 % + 3 ô 64×48); dải đếm xám | 10 hàng 48 |
| Trống (môn chưa có em) | "Buổi này chưa có em nào ghi danh Địa. — Xem danh sách học sinh" | như điện thoại |
| Lỗi tải | Giữ danh sách cũ (nếu đã mở trước), dải `danger-bg` "Không tải được danh sách buổi. Bấm Thử lại." | |
| Mất mạng | Dải `warn-bg` dưới đầu trang. Mọi chạm vẫn đổi màu ngay; hàng chưa gửi có chấm rỗng 8px cạnh tên (`aria-label="Chưa gửi"`); đầu trang "3 thay đổi chưa gửi". Có mạng lại → tự gửi, chấm biến mất, "Đã lưu 22:34". | |
| Lưu lỗi một hàng (máy chủ từ chối, ví dụ hết quyền) | Hàng có viền trái 3px `danger` + chữ "Không lưu được · Thử lại" dưới tên | |
| Mở khi đang mất mạng mà chưa từng tải | "Không mở được danh sách vì đang mất mạng. Mở lại khi có mạng; lần sau mở trang này trước giờ học." | |
| Buổi chưa tới giờ (cùng ngày) | Dải `raised` nhỏ "Buổi bắt đầu lúc 22:15" — **vẫn cho điểm** | |
| Buổi ngày mai trở đi | Không có nút điểm danh; chỉ "Buổi chưa diễn ra" | |
| Buổi trạng thái Nghỉ | "Buổi này nghỉ — không điểm danh." + (chủ lớp) "Đổi thành Có học" | |
| **Khoá 48 giờ** | Quá 48 giờ từ giờ bắt đầu buổi: nút chỉ đọc (mờ 60 %, vẫn đọc được trạng thái), dải trên cùng "Buổi đã qua 3 ngày. Sửa điểm danh sẽ đổi chuyên cần và học phí." + nút "Mở sửa". Bấm → hộp thoại xác nhận một lần cho cả buổi (không hỏi lại từng chạm). | |
| Giáo viên khác cùng môn vừa sửa | Hàng nhấp nền `raised` 1 lần (không động nếu giảm chuyển động) + chữ nhỏ "Chị Hoa đổi lúc 22:33". Dữ liệu làm mới mỗi 15 giây khi trang đang hiện. Cùng một ô: bản ghi sau thắng. | |
| Học thử / khoá học thử | Xem §3: chip thử; em hết thử không có trong danh sách + dòng cuối. | |

## 6. Thanh Hoàn tác 5 giây (`UndoBar`)
- Hiện sau "Đánh tất cả có mặt" (và sau "Huỷ buổi" ở màn Buổi học). Không hiện sau từng chạm lẻ (chạm lẻ tự sửa được bằng chạm khác).
- Vị trí: điện thoại — nổi ngay trên nút đáy, rộng hết lề; máy tính — giữa đáy, rộng 480. Nền `raised`, `shadow-overlay`, bo 14.
- Nội dung: "Đã đánh 58 em có mặt" (`text`) + nút **Hoàn tác** cao 44, chữ `gold` 600, viền `border-input`. Vạch 2px `gold` ở mép dưới co từ phải sang trái trong 5 giây (`transform: scaleX`, `linear`, `transform-origin: left`).
- Dừng đếm khi: trang bị ẩn (`visibilitychange` — giáo viên chuyển sang Meet), con trỏ nằm trên thanh, hoặc tiêu điểm ở trong thanh (WCAG 2.2.1 cho phép chỉnh thời gian).
- Hoàn tác trả đúng những em mà lần bấm đó đã đổi **và chưa bị sửa tay sau đó** về "Chưa điểm"; báo "Đã hoàn tác, 58 em về chưa điểm". Hai thao tác (đánh tất cả + hoàn tác) đều đi qua hàng đợi nên đúng cả khi mất mạng.
- `role="status"` + `aria-live="polite"`; Esc đóng thanh (giữ kết quả).
- Giảm chuyển động: hiện/ẩn tức thì; vạch thay bằng chữ "còn 5 giây" đếm lùi mỗi giây.
- 5 giây theo mặc định "Hoàn tác gửi thư" của Gmail; Material khuyên một hành động "Undo" trên snackbar.

## 7. Ma trận tháng — `/quan-ly/diem-danh/thang`
Lấy bảng dày của mẫu B, tô theo token A, sửa ký hiệu.

### 1280px
```
 Ma trận điểm danh   [Toán][Sử][Địa][Anh]   ‹ Tháng 11/2026 ›   [ ] Chỉ em đang học
┌───────────────────────┬────┬────┬────┬────┬────┬────┬────┬▓▓▓▓┬──────┬──────┐
│ Học sinh              │T3  │T7  │T3  │T7  │T3  │T7  │T3  │T7  │Có mặt│Chuỗi │
│                       │03  │07  │10  │14  │17  │21  │24  │28  │      │      │
├───────────────────────┼────┼────┼────┼────┼────┼────┼────┼▓▓▓▓┼──────┼──────┤
│ Nguyễn Minh Anh       │ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │ P  │ ✓  │▓ ✓▓│ 7/8  │  7   │
│ Trần Gia Bảo · thử    │ –  │ –  │ –  │ ✓  │ ✓  │ ✓  │ ✓  │▓ ✓▓│ 5/5  │  5   │
│ Lê Thu Hà             │ ✓  │ ✓  │ K  │ ✓  │ ✓  │ ✓  │ ✓  │▓ P▓│ 6/8  │  4   │
│ Vũ Khánh Linh         │ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │▓ ·▓│ 7/7  │  7   │
└───────────────────────┴────┴────┴────┴────┴────┴────┴────┴▓▓▓▓┴──────┴──────┘
 ✓ có mặt · P vắng có phép · K vắng không phép · · chưa điểm · – không học ngày này
```
- Cột tên dính trái (220px, tên + "· thử" `trial-fg`), đầu bảng dính trên, ô 44 × 40, ký hiệu 15/600 giữa ô.
- Màu ký hiệu trên `surface`: ✓ `ok` (9.67) · P `excused` (10.14) · K `danger` (7.58) · "·" và "–" `text-3` (7.02). Ký hiệu khác nhau về **hình**, màu chỉ bổ trợ.
- Cột hôm nay (hoặc buổi gần nhất đã qua) nền `today-col`, chữ đầu cột `gold`; khi mở, bảng **tự cuộn ngang** để cột này nằm trong tầm nhìn (cuộn tức thì, không trượt).
- Buổi "Nghỉ": cột hẹp 28px, đầu cột "Nghỉ", ô gạch chéo `border`, không bấm được. Buổi "Học bù": đầu cột thêm "· bù".
- "Có mặt" = số ✓ / số buổi em thuộc lớp (đã điểm). "Chuỗi" = số buổi có mặt liên tiếp gần nhất; **P không làm đứt chuỗi và không cộng vào chuỗi**, ô "·" chưa điểm bị bỏ qua (`huong-chon.md` sửa 5). Cả hai `tabular-nums`.
- Bấm ô (chủ lớp, giáo viên môn đó) → menu nhỏ cạnh ô: Có · Phép · Vắng · Về chưa điểm (mỗi mục cao 44). **Không bấm đổi vòng** như mẫu B. Ô quá 48 giờ: menu có thêm dòng "Buổi đã qua 48 giờ" và hỏi xác nhận một lần cho cả cột.
- Bàn phím: bảng là lưới (`role="grid"`), mũi tên đi giữa ô, Enter mở menu, phím 1/2/3 đặt thẳng, Delete về chưa điểm.
- Mỗi ô có `aria-label` đầy đủ: "Nguyễn Minh Anh, Thứ Bảy 28/11: có mặt".
- Bấm tên em → hồ sơ em. Bấm đầu cột → màn điểm danh buổi đó.
- 70 hàng × ~9 cột: không cần ảo hoá; đặt `content-visibility: auto` cho hàng.

### 390px
- Cùng bảng, cuộn ngang trong khung `overflow-x: auto` (trang không cuộn ngang). Cột tên dính 128px (tên xuống 2 dòng, hàng 48), ô 40 × 48.
- Bộ lọc gọn: hàng 1 chip môn (giáo viên 1 môn thì không có), hàng 2 "‹ Tháng 11 ›".
- Chạm ô → tờ trượt đáy (3 nút 56px + Về chưa điểm), không dùng menu nổi.
- Ghi chú cạnh bảng: "Vuốt ngang để xem các buổi khác" chỉ hiện lần đầu.

## 8. Danh mục `/quan-ly/diem-danh`
1. **Hôm nay**: thẻ buổi hôm nay của môn mình (0–2 thẻ; có thể 2 nếu có buổi học bù): môn, giờ, "Đã điểm 61/63" hoặc "Chưa điểm", nút "Điểm danh" vàng 48px.
2. **Chưa điểm danh** (14 ngày qua, giống việc ✅ của sheet): mỗi hàng một buổi, "Toán · T3 24/11 · chưa điểm 63 em" → mở buổi.
3. **Ma trận tháng**: nút "Xem ma trận tháng 11".
4. Trống: "Không còn buổi nào chưa điểm. Buổi kế: Chủ nhật 29/11 · Sử 22:15."

## 9. Token dùng
`bg`, `surface`, `raised`, `text`, `text-2`, `text-3`, `gold`/`on-gold` (nút "Đánh tất cả có mặt", Hoàn tác), `ok`/`on-ok`, `excused`/`on-excused`, `danger`/`on-danger`, `trial-fg`/`trial-bg`, `warn`/`warn-bg`, `border`, `border-input`, `today-col`, `row-hover`, `focus`, `shadow-overlay`, `z-sticky`, `z-toast`, `z-overlay`, `dur-0`, `dur-press`, `dur-fast`, `dur-sheet`, `dur-undo`, `ease-out`.

## 10. Chuyển động
| Chỗ | Hiệu ứng | Giảm chuyển động |
|---|---|---|
| Chọn Có/Phép/Vắng | Đổi màu tức thì; `scale(.97)` 80ms khi nhấn | bỏ scale |
| Thanh Hoàn tác | vào: opacity 0→1 + translateY 8→0, 150ms `ease-out`; vạch scaleX 5s `linear` | hiện tức thì; vạch → chữ đếm lùi |
| Tờ trượt đáy (chạm tên, chạm ô ma trận) | translateY 100 %→0, 240ms `ease-out`; ra 180ms `ease-in` | tức thì |
| Hàng do người khác sửa | nền `raised` 600ms rồi về | không đổi nền, chỉ chữ "Chị Hoa đổi lúc…" |

Không GSAP, không Lenis (cần cuộn gốc cho đầu bảng dính và cột tên dính), không chuyển cảnh trang.

## 11. Linh kiện React Bits
**Không dùng.** Đã xem `SwipeToast` (https://reactbits.dev/r/SwipeToast-TS-TW.json — có vạch đếm ngược, `role="status"`, `useReducedMotion`, dừng khi ẩn trang): gần đúng cho Hoàn tác nhưng nút hành động cao 24px (`h-6`) và `outline-none` (trái quy tắc 44px và viền tiêu điểm), kéo thêm `motion` + `@hugeicons/*` (kho đang có `framer-motion`, chưa có `motion`). Tự viết `UndoBar` khoảng 60 dòng bằng CSS `transform` theo §6 là ngắn hơn. `SwipeRow` (vuốt hàng để lộ nút) bị loại: điểm danh không được phụ thuộc cử chỉ vuốt.

## 12. Kiểm nhận (cho `bca-kiem-thu`, Playwright 390 × 844 và 1280 × 800)
1. Buổi Toán 63 em, 5 em vắng: hoàn tất bằng ≤ 7 chạm từ Hôm nay; đo thời gian thao tác < 60 giây.
2. Mỗi nút Có/Phép/Vắng ≥ 48px cao ở 390px, ≥ 44px ở 1280px; khoảng cách giữa hai nút ≥ 8px.
3. "Đánh tất cả có mặt" không đổi em đã có Phép/Vắng; Hoàn tác trong 5 giây đưa đúng các em đó về Chưa điểm; quá 5 giây thì nút Hoàn tác biến mất.
4. Chuyển tab trình duyệt trong lúc đếm 5 giây → về lại vẫn còn thời gian.
5. Mở buổi khi có mạng, tắt hẳn mạng máy, chạm 3 em → 3 hàng có chấm "Chưa gửi", đầu trang "3 thay đổi chưa gửi"; bật mạng → cả 3 lưu lên máy chủ, đầu trang "Đã lưu".
6. Thứ tự hàng không đổi sau mỗi chạm, kể cả khi đang lọc "Chưa điểm".
7. Buổi > 48 giờ: chạm nút không đổi gì cho tới khi "Mở sửa" + xác nhận.
8. Tài khoản chị Thu Hương (Anh) mở link buổi Toán → 403.
9. Bàn phím ở 1280: Tab vào danh sách, ↓ ↓ 3 → em thứ 3 thành Vắng, tiêu điểm sang em thứ 4.
10. Ma trận: mở tháng 11 vào ngày 26/11 → cột T3 24/11 (buổi gần nhất đã qua) nằm trong tầm nhìn; ký hiệu chỉ có ✓ P K · –.

## Nguồn tham khảo
- Hoàn tác thay cho hộp thoại xác nhận khi thao tác đảo ngược được: [UXmatters — "Are You Sure?" Versus Undo](https://uxmatters.com/mt/archives/2020/03/are-you-sure-versus-undo-design-and-technology.php); hộp thoại chỉ cho hậu quả nghiêm trọng: [NN/g — Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/) (dùng cho khoá 48 giờ).
- Thời gian Hoàn tác mặc định 5 giây: [Google — How to undo send in Gmail](https://blog.google/products/gmail/how-to-unsend-email-gmail/). Snackbar có một hành động "Undo": [Material — Snackbars](https://material.io/components/snackbars).
- Mật độ hàng 48/40: [Carbon — Data table style](https://carbondesignsystem.com/components/data-table/style).
- Vùng bấm: [W3C — Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Hàng đợi khi mất mạng: [Chrome for Developers — Workbox background sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync).
- Mẫu gốc đã chấm: `A-QuanLy` (bảng, nền), `B-QuanLy` (ma trận), `C-QuanLy` (ô to điện thoại) trong thư mục mẫu của đợt chấm 26/11; dữ liệu thật: sheet lớp 26/11 (`__DiemDanh`, `📝 Ghi danh`).

## Câu hỏi cho chủ
1. **Bấm "Điểm danh" ở thanh dưới trong giờ học thì mở thẳng buổi tối nay?**
   - A. Có: từ 21:45 tới 02:00, nếu hôm đó môn của người dùng có đúng 1 buổi thì mở thẳng buổi đó; ngoài giờ mở danh mục — **khuyên dùng** (bớt 1 chạm trong Meet, vẫn quay ra danh mục bằng ‹).
   - B. Luôn mở danh mục, người dùng chạm thẻ buổi tối nay.
2. **Toán và Anh có 2 giáo viên. Ai điểm danh một buổi?**
   - A. Cả hai đều điểm được; ai sửa sau thì thắng, màn hiện "Chị Hoa đổi lúc 22:33" — **khuyên dùng** (không cần phân công từng buổi).
   - B. Mỗi buổi gán một giáo viên phụ trách (ở màn Buổi học); người kia chỉ xem.
   - C. Chỉ chủ lớp sửa được sau khi giáo viên phụ trách đã điểm xong.
3. **Có thêm ô "Ghi chú" cho từng em trong từng buổi không?** (Sheet hiện không có; mẫu A có "Ốm, đã báo Zalo".)
   - A. Có, tuỳ chọn, chỉ chủ lớp và giáo viên thấy — **khuyên dùng**.
   - B. Không, chỉ Có/Phép/Vắng như sheet.
4. **Có cần mở được màn điểm danh khi đã mất mạng từ trước (cài như ứng dụng, có service worker)?**
   - A. Chưa cần ở Đợt 1: tải sẵn danh sách khi mở Hôm nay, thay đổi giữ trong hàng đợi khi rớt mạng giữa buổi — **khuyên dùng** (đủ cho trường hợp mạng chập chờn khi đang Meet, ít rủi ro).
   - B. Có: làm PWA "Thêm vào màn hình chính", mở được cả khi không có mạng (tốn thêm công và phải kiểm kỹ bộ nhớ đệm).
