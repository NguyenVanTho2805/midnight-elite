# Màn Hôm nay — BCA-D1-TK (26/11/2026)

Màn đầu tiên sau khi đăng nhập của chủ lớp và giáo viên (`huong-chon.md` sửa 3). Đường dẫn `/quan-ly`.
Khung, trạng thái chung, chỉ báo lưu: [khung-quan-ly.md](khung-quan-ly.md). Thay cho tab "📣 Việc hôm nay" và "🏠 Tổng quan" của sheet.

## 1. Mục đích
Trả lời trong 3 giây: **tối nay có buổi gì, đã điểm danh chưa, còn việc gì phải làm hôm nay**. Mọi mục là liên kết hoặc nút thật dẫn tới chỗ xử lý (không có ô chỉ để xem).

## 2. Ai dùng và khác nhau thế nào
| Khối | Chủ lớp | Giáo viên môn |
|---|---|---|
| Buổi tối nay | Mọi môn có buổi hôm nay | Chỉ môn mình dạy; không có buổi → "Tối nay không có buổi Toán" + buổi kế của môn mình |
| Thẻ số liệu | Đơn mới · Hết thử ≤ 3 ngày · Buổi chưa điểm · Buổi chưa có record | Buổi chưa điểm · Buổi chưa có record (2 thẻ) |
| Em hết thử trong 3 ngày | Có (kèm nhóm "Đã hết, chưa quyết") | **Không** (gia hạn/chuyển chính thức chỉ chủ lớp — mục 16) |
| Đơn mới | Có | Không |
| Việc dở | Tất cả (xem §4) | Chỉ của môn mình: buổi chưa điểm, chưa có record |
| Phiếu chưa thu | Từ Đợt 3 | Không bao giờ |
| 7 ngày tới | Mọi môn | Môn mình |

## 3. Số liệu thật ngày 26/11 (thứ Năm) dùng làm mẫu
- Tối nay: **Tiếng Anh 22:15**, chị Thu Hương · anh Quang Minh, 51 em (8 chính thức, 43 học thử).
- Hết thử trong 3 ngày (ngày cuối thử từ 26/11 tới 29/11, cùng quy tắc `today + 3` của sheet): **33 em** — 16 em hết 28/11, 17 em hết 29/11. Ngày 30/11 thêm 13 em (ngoài khung 3 ngày).
- Đơn chờ duyệt: 1.
- Buổi đã qua chưa điểm danh: **5** (Địa 20/11, Toán 21/11 và 24/11, Anh 23/11, Sử 25/11 — sheet chỉ mới tick 5/10 buổi từ 16/11). Giáo viên Toán thấy 2.
- Buổi đã học trong 7 ngày chưa có link record: **7** (sheet chưa có link record nào).
→ Khối "hết thử" phải chịu được **hàng chục em cùng lúc**: gom theo ngày hết, không liệt kê dài 33 hàng trên Hôm nay.

## 4. Nội dung theo thứ tự ưu tiên
1. **Buổi tối nay** (thẻ lớn, nút Điểm danh).
2. **Thẻ số liệu bấm được** — mỗi thẻ là `<a>` tới danh sách đã lọc:
   - Đơn mới `1` → `/quan-ly/don?trang-thai=moi`
   - Hết thử ≤ 3 ngày `33` → `/quan-ly/hoc-sinh?het=3`
   - Buổi chưa điểm `5` → `/quan-ly/diem-danh#chua-diem`
   - Chưa có record `7` → `/quan-ly/buoi-hoc?record=thieu` (chỉ tính buổi đã học trong 7 ngày qua, để con số còn làm được)
3. **Em hết thử trong 3 ngày** (chủ lớp): nhóm theo ngày hết.
4. **Đơn mới** (chủ lớp): 3 đơn mới nhất.
5. **Việc dở**: lấy từ danh sách việc của sheet (`kin_viecList`), bỏ học phí (Đợt 3):
   - Buổi đã qua chưa điểm danh (14 ngày) — gộp theo môn: "Toán: 2 buổi chưa điểm (21/11, 24/11)".
   - Buổi đã học chưa có link record (7 ngày).
   - Em mới chưa nhận thư chào (chủ lớp).
   - Dữ liệu cần sửa (chủ lớp): Gmail có thể gõ nhầm ("…@gmial.com → @gmail.com"), SĐT không hợp lệ, ghi danh chồng ngày.
6. **7 ngày tới**: danh sách gọn, mỗi ngày một dòng.

## 5. Khối "Buổi tối nay" theo giờ (giờ Việt Nam)
| Lúc | Dòng chính (h1) | Dòng phụ | Nút chính (vàng 56px, rộng hết) | Nút phụ (44px) |
|---|---|---|---|---|
| Trước 21:45 | "Tối nay học Tiếng Anh lúc 22:15" | "Chị Thu Hương · 51 em · còn 3 giờ 20 phút" | Điểm danh | Mở Meet |
| 21:45–22:15 | như trên | "còn 12 phút" | Điểm danh | Mở Meet |
| 22:15–23:45 | "Đang học Tiếng Anh" | "Đã điểm 12/51" | Điểm danh | Mở Meet |
| Sau 23:45, chưa điểm đủ | "Tiếng Anh tối nay chưa điểm xong" (chữ `warn`) | "Còn 39 em chưa điểm" | Điểm danh tiếp | Dán link record |
| Sau 23:45, đã đủ | "Tiếng Anh tối nay đã điểm đủ" | "49 có mặt · 1 phép · 1 vắng" | Dán link record (nếu chưa có) | Xem điểm danh |
| Không có buổi | "Tối nay không có buổi" | "Buổi kế: Thứ Sáu 27/11 · Địa lí 22:15" | — (không có nút vàng) | Xem lịch |
| Buổi bị huỷ (Nghỉ) | "Tiếng Anh tối nay nghỉ" | lý do nếu có | — | Xem buổi |
| 2 buổi cùng tối (có học bù) | 2 thẻ xếp chồng, buổi giờ sớm hơn trước | | | |

- Câu và nút to theo mẫu C, tô theo token A (nền `raised`, bo 20). Đây là chỗ **duy nhất** có nút vàng trên Hôm nay.
- "Mở Meet" là `<a target="_blank" rel="noopener">` tới link Meet của môn; "Điểm danh" là `<Link>` có prefetch để màn điểm danh mở tức thì (và có sẵn dữ liệu nếu mạng rớt trong buổi).
- Giờ đếm ngược cập nhật mỗi phút (không mỗi giây); dựng lần đầu ở máy chủ theo `Asia/Ho_Chi_Minh`.

## 6. Khối "Em hết thử trong 3 ngày" (chỉ chủ lớp)
```
Hết thử trong 3 ngày · 33 em                    Xem tất cả ›
┌──────────────────────────────────────────────────────────┐
│ Đã hết, chưa quyết · 0 em         (ẩn khi bằng 0)         │
├──────────────────────────────────────────────────────────┤
│ Hết thứ Bảy 28/11 · 16 em                   Xem 16 em ›   │
│   Trần Gia Bảo        Toán, Anh        [Thử · còn 2 ngày] │
│   Phạm Đức Huy        Sử               [Thử · còn 2 ngày] │
│   Lê Hoàng Nam        Toán, Sử, Anh    [Thử · còn 2 ngày] │
│   + 13 em nữa                                            │
├──────────────────────────────────────────────────────────┤
│ Hết Chủ nhật 29/11 · 17 em                  Xem 17 em ›   │
│   …3 em đầu…                                             │
└──────────────────────────────────────────────────────────┘
```
- Mỗi nhóm hiện 3 em đầu (theo tên), mỗi hàng là `<a>` tới hồ sơ em (nơi có nút Gia hạn / Chuyển chính thức). "Xem 16 em" → `/quan-ly/hoc-sinh?het=2026-11-28` — ở đó chủ lớp chọn nhiều em để gia hạn một lần (xem `man-hoc-sinh.md`).
- Nhóm "Đã hết, chưa quyết" (ngày cuối thử đã qua, chưa lên chính thức, chưa nghỉ) đứng đầu, chip `danger-bg` "Hết thử 25/11"; đây là các em đang bị khoá.
- Chip: còn ≤ 3 ngày dùng `warn-bg`/`warn` (sửa 4 của `huong-chon.md`).
- 0 em: một dòng "Không có em nào hết thử trong 3 ngày tới."

## 7. Bố cục 390px
```
┌──────────────────────────────────────┐
│ Hôm nay                      Thứ Năm 26/11 │ 56
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Tối nay học Tiếng Anh            │ │ h1 22/800, text-wrap: balance
│ │ lúc 22:15                        │ │
│ │ Chị Thu Hương · 51 em · còn 3 giờ │ │ text-2
│ │ ┌──────────────────────────────┐ │ │
│ │ │         Điểm danh            │ │ │ 56 vàng
│ │ └──────────────────────────────┘ │ │
│ │ ┌──────────────┐                 │ │
│ │ │   Mở Meet ↗  │                 │ │ 44
│ │ └──────────────┘                 │ │
│ └──────────────────────────────────┘ │
│ ┌───────────────┐┌───────────────┐   │
│ │ 1             ││ 33            │   │ thẻ 2×2, cao 80
│ │ Đơn mới       ││ Hết thử ≤ 3 ng│   │
│ └───────────────┘└───────────────┘   │
│ ┌───────────────┐┌───────────────┐   │
│ │ 5             ││ 7             │   │
│ │ Buổi chưa điểm││ Chưa có record│   │
│ └───────────────┘└───────────────┘   │
│ Hết thử trong 3 ngày · 33 em   ›     │
│ …nhóm theo ngày (§6)…                │
│ Đơn mới · 1                    ›     │
│ Việc dở · 3                          │
│ 7 ngày tới                           │
├──────┬──────┬──────┬──────┬──────────┤
│Hôm nay│Điểm danh│Học sinh│Buổi học│Thêm│
└──────┴──────┴──────┴──────┴──────────┘
```
- Một cột, lề 16, khoảng giữa khối 24.
- Thẻ số liệu: số 24/800 `tabular-nums` + nhãn 13 `text-2`, xuống dòng nếu dài (không cắt). Số > 0 của "Hết thử" và "Buổi chưa điểm" dùng màu `warn`; bằng 0 dùng `text-3`. Thẻ vẫn bấm được khi bằng 0.
- Giáo viên: thẻ 2 cột × 1 hàng; không có khối hết thử, đơn mới.

## 8. Bố cục 1280px
```
┌ thanh bên ┬───────────────────────────────────────────────────────────────┐
│           │ Hôm nay · Thứ Năm 26/11                                        │
│           │ ┌───────────────────────────────────┐ ┌──────────┐┌──────────┐ │
│           │ │ Tối nay học Tiếng Anh lúc 22:15   │ │ 1        ││ 33       │ │
│           │ │ Chị Thu Hương · 51 em · còn 3 giờ │ │ Đơn mới  ││ Hết thử  │ │
│           │ │ [   Điểm danh   ] [Mở Meet ↗]     │ └──────────┘└──────────┘ │
│           │ │                                   │ ┌──────────┐┌──────────┐ │
│           │ │                                   │ │ 5 Buổi   ││ 7 Chưa   │ │
│           │ └───────────────────────────────────┘ └──────────┘└──────────┘ │
│           │ ┌ Hết thử trong 3 ngày · 33 em ─────┐ ┌ Đơn mới · 1 ──────────┐ │
│           │ │ (bảng nhóm theo ngày, hàng 48)    │ │                       │ │
│           │ │                                   │ ├ 7 ngày tới ───────────┤ │
│           │ └───────────────────────────────────┘ │ T6 27 Địa · T7 28 Toán│ │
│           │ ┌ Việc dở · 3 ──────────────────────┐ │ CN 29 Sử · …          │ │
│           │ └───────────────────────────────────┘ └───────────────────────┘ │
└───────────┴───────────────────────────────────────────────────────────────┘
```
- Lưới 12 cột, khoảng 24: thẻ buổi 7 cột + 4 thẻ số liệu 5 cột (2×2); hàng sau: hết thử + việc dở 7 cột, đơn mới + 7 ngày tới 5 cột.
- Nút "Điểm danh" ở máy tính cao 48, rộng theo chữ (không rộng hết thẻ).
- Bảng hết thử ở máy tính hiện thêm cột "Lứa" và "SĐT HS" (chủ lớp) để gọi nhanh; vẫn chỉ 3 em đầu mỗi nhóm.

## 9. Trạng thái
| Trạng thái | Cách hiện |
|---|---|
| Đang tải | Mỗi khối tải độc lập (Suspense riêng): khối buổi tối nay `skeleton` cao 200, 4 thẻ 80, 3 hàng 48 cho mỗi danh sách. Khối buổi tối nay ưu tiên tải trước. |
| Trống hoàn toàn | "Hôm nay không còn việc gì cần làm." dưới thẻ buổi tối nay (thẻ buổi vẫn hiện). |
| Lỗi một khối | Chỉ khối đó: "Không tải được đơn mới · Thử lại". Các khối khác vẫn dùng được. |
| Mất mạng | Hiện dữ liệu lần tải gần nhất + "Cập nhật lúc 21:40"; dải mất mạng chung. Nút "Điểm danh" vẫn mở được nếu đã prefetch. |
| Học thử | Khối §6; chip thử `trial`/`warn`. |
| Khoá | Nhóm "Đã hết, chưa quyết" (em đang bị khoá vì hết 14 ngày). Giáo viên không thấy khối này. |
| Lớp chưa có buổi nào (sau khi chuyển dữ liệu mà lịch trống) | "Chưa có lịch buổi học. — Mở Buổi học để tạo lịch tháng 12" (chủ lớp). |

## 10. Token dùng
`bg`, `surface` (thẻ số liệu, khối danh sách), `raised` (thẻ buổi tối nay), `text`, `text-2`, `text-3`, `gold`/`on-gold` (một nút Điểm danh), `warn`/`warn-bg` (số cần xử lý, chip ≤ 3 ngày), `danger`/`danger-bg` (đã hết thử), `trial-fg`/`trial-bg`, `border`, `focus`, `row-hover`; bo 20 (thẻ buổi), 14 (thẻ số liệu); khoảng `space-6` giữa khối.

## 11. Chuyển động
Không có. Số liệu hiện ngay, **không** đếm chạy (không dùng React Bits `Counter`/`CountUp`: màn mở hằng ngày, số phải đọc được ngay lập tức). Không hiện dần khối khi cuộn. Chỉ có `scale(.97)` 80ms khi nhấn nút/thẻ; tắt khi giảm chuyển động.

## 12. Linh kiện React Bits
Không dùng. Đã cân nhắc `Counter` (odometer) cho thẻ số liệu và `AnimatedList` cho việc dở — loại vì làm chậm việc đọc màn hằng ngày và trái chốt "khu quản lý gần như không chuyển động".

## 13. Kiểm nhận
1. 390px, chủ lớp, 26/11 lúc 18:55: thẻ đầu "Tối nay học Tiếng Anh lúc 22:15", có "còn 3 giờ 20 phút"; nút Điểm danh 56px nằm trong màn hình đầu (không cần cuộn).
2. Thẻ "Hết thử ≤ 3 ngày" = 33, bấm → danh sách học sinh lọc đúng 33 em; URL có `het=3`.
3. Tài khoản chị Hoa (Toán) cùng lúc: thẻ "Tối nay không có buổi Toán · Buổi kế: Thứ Bảy 28/11"; không có khối hết thử, đơn mới; chỉ 2 thẻ số liệu.
4. Mọi phần tử bấm được là `<a>` hoặc `<button>`, vùng bấm ≥ 44px; không có `div` bắt sự kiện bấm.
5. Giả lập lỗi API đơn đăng ký → chỉ khối đơn mới báo lỗi, khối buổi tối nay vẫn bấm được.
6. 23:50 khi còn em chưa điểm → dòng chính đổi "chưa điểm xong", nút "Điểm danh tiếp".

## Nguồn tham khảo
- Việc hôm nay, quy tắc "hết thử trong 3 ngày" (`e.den <= today + 3`), các loại việc dở: hàm `kin_viecList` và bảng "Tối nay" trong Apps Script KiN v8.12.
- Mỗi mục "cần làm" là liên kết/nút thật, thẻ số liệu bấm được để lọc: `huong-chon.md` sửa 3 và 6.
- URL giữ trạng thái lọc, xử lý trống/lỗi: skill `web-design-guidelines` (Navigation & State, Content Handling).
- Bố cục câu + nút to: mẫu C; nền và thẻ: mẫu A (đợt chấm 26/11).

## Câu hỏi cho chủ
1. **"Hết thử trong 3 ngày" tính thế nào?**
   - A. Ngày cuối thử từ hôm nay tới hôm nay + 3 (như sheet; ngày 26/11 ra 33 em) — **khuyên dùng**, khớp thói quen cũ.
   - B. Còn ≤ 3 ngày tính cả hôm nay (tới 28/11; ra 16 em) — danh sách ngắn hơn nhưng báo muộn hơn một ngày.
2. **Giáo viên có thấy em học thử sắp hết hạn của môn mình không?** (để nhắc em trong buổi)
   - A. Không, chỉ chủ lớp — **khuyên dùng** (đúng mục 16; giáo viên vẫn thấy chip "Thử · còn 2 ngày" trong danh sách điểm danh).
   - B. Có, chỉ xem, không có nút gia hạn.
3. **Ô "Chưa có record" tính các buổi trong bao lâu?**
   - A. 7 ngày gần nhất — **khuyên dùng** (sheet hiện có nhiều buổi chưa có link; tính từ đầu tháng sẽ ra số lớn khó xử lý).
   - B. Từ đầu tháng.
   - C. Bỏ ô này, chỉ để trong "Việc dở".
