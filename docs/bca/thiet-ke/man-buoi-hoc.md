# Màn Buổi học — BCA-D1-TK (26/11/2026)

Lịch buổi theo tháng và môn; thêm buổi học bù, huỷ buổi, dán link record, ghi nội dung buổi. Thay cho tab "📅 Buổi học" (Ngày, Thứ, Môn, Trạng thái Có học/Nghỉ/Học bù, Đã điểm danh, Nội dung buổi, Link record, Ghi chú) và công cụ "🔁 Bắt đầu lại buổi học" của sheet.
**Quy tắc** (sinh buổi, huỷ, học bù, record, ai được làm gì): [`../nghiep-vu/buoi-hoc.md`](../nghiep-vu/buoi-hoc.md), [`../nghiep-vu/phan-quyen.md`](../nghiep-vu/phan-quyen.md). Tệp này chỉ nói giao diện.
Khung và trạng thái chung: [khung-quan-ly.md](khung-quan-ly.md). Điểm danh từng buổi: [man-diem-danh.md](man-diem-danh.md).

Nhãn hiển thị (nghiệp vụ Điều 5.1): **Có học** (theo lịch) · **Học bù** · **Lớp nghỉ** (buổi đã huỷ, kèm lý do).

## 1. Mục đích và ai dùng
- **Đường dẫn:** `/quan-ly/buoi-hoc?thang=2026-11&mon=toan`; buổi đang mở `&buoi=[id]` (điện thoại: trang riêng; máy tính: khung bên phải).
- **Chủ lớp:** mọi môn; sinh buổi tháng, thêm buổi học bù, huỷ buổi, bỏ huỷ, xoá buổi chưa có dữ liệu, dán record, nội dung, ghi chú.
- **Giáo viên:** chỉ môn mình; dán record, nội dung buổi, ghi chú; thêm/huỷ buổi theo Câu hỏi 1 (khuyên: chỉ chủ lớp, vì đổi số buổi là đổi học phí — mục 13).

## 2. Số liệu thật (sheet 26/11)
- Lịch sinh sẵn theo thứ của môn (Toán T3·T7, Sử T4·CN, Địa T6, Anh T2·T5; 22:15, 90 phút) từ 16/11 tới 31/12: 46 buổi; tháng 12 có 31 buổi (Toán 9, Sử 9, Anh 9, Địa 4).
- 10 buổi đã qua (16–25/11): mới 5 buổi được tick "Đã điểm danh"; **chưa buổi nào có link record hay nội dung**. → Việc hay làm nhất ở màn này là **dán record cho buổi vừa học**; phải làm được thẳng từ danh sách.

## 3. Nội dung theo thứ tự ưu tiên
1. Danh sách buổi của tháng, buổi hôm nay nổi bật, tự cuộn tới hôm nay.
2. Ở mỗi buổi: ngày · thứ, môn, giờ, **trạng thái điểm danh** (Đã điểm 61/63 · Chưa điểm · —), **record** (có / thiếu + nút "Dán record"), trạng thái buổi (Có học / Học bù / Lớp nghỉ).
3. Đổi tháng ‹ › và lọc môn.
4. Chi tiết buổi: record, nội dung, ghi chú, điểm danh tóm tắt + mở điểm danh, huỷ / học bù.
5. Thêm buổi học bù (chủ lớp).

## 4. 390px — danh sách
```
┌──────────────────────────────────────┐
│ Buổi học                  [+ Học bù] │ 56  (+ Học bù: chủ lớp)
├──────────────────────────────────────┤
│      ‹   Tháng 11/2026   ›           │ 44
│ [Tất cả] [Toán] [Sử] [Địa] [Anh]     │ chip lọc môn, xuống dòng nếu thiếu chỗ
├──────────────────────────────────────┤
│ Tuần 23–29/11                        │ tiêu đề tuần, dính khi cuộn
│ ┌────┐ Sử · 22:15                    │
│ │ T4 │ Chưa điểm · Thiếu record      │ 72
│ │ 25 │                 [Dán record]  │
│ └────┘                               │
│ ┌────┐ Tiếng Anh · 22:15   Hôm nay   │ nền today-col
│ │ T5 │ 51 em · chưa tới giờ          │
│ │ 26 │                 [Điểm danh]   │
│ └────┘                               │
│ ┌────┐ Địa lí · 22:15                │
│ │ T6 │ 20 em                         │
│ │ 27 │                               │
│ └────┘                               │
│ ┌────┐ Toán · Lớp nghỉ               │ chữ text-3, nhãn "Lớp nghỉ" (không chỉ gạch ngang)
│ │ T7 │ Lý do: trùng lịch thi         │
│ │ 28 │                               │
│ └────┘                               │
└──────────────────────────────────────┘
```
- Hàng là `<a>` tới chi tiết buổi; nút trong hàng ("Dán record", "Điểm danh") là nút riêng 44px, không lồng trong liên kết (hàng dùng `::after` phủ vùng bấm, nút có `position: relative; z-index` cao hơn).
- Khối ngày 48 × 48, thứ 12/600 `text-3`, ngày 18/800 `tabular-nums`.
- Dòng trạng thái: "Đã điểm 61/63" `text-2` · "Chưa điểm" `warn` (chỉ buổi đã qua hoặc hôm nay sau 22:15) · "Thiếu record" `warn` (chỉ buổi đã qua) · "Có record" `ok`.
- Mở trang → cuộn tức thì tới tuần có hôm nay (không trượt).
- Nút hàng: buổi đã qua thiếu record → "Dán record"; buổi hôm nay từ 21:45 (và buổi tối qua tới 05:59) → "Điểm danh"; còn lại không có nút.

## 5. 390px — chi tiết buổi
```
┌──────────────────────────────────────┐
│ ‹  Buổi học                       …  │ 56  (… = Huỷ buổi, Thêm học bù cho buổi này — chủ lớp)
├──────────────────────────────────────┤
│ Toán · Thứ Bảy 28/11                 │ h1 22/800
│ 22:15–23:45 · Anh Thanh, chị Hoa     │
│ Có học                               │ chip trạng thái
│ ┌──────────────────────────────────┐ │
│ │ Điểm danh                        │ │
│ │ 54 có · 4 phép · 3 vắng · 2 chưa │ │
│ │ [        Mở điểm danh         ]  │ │ 48 (vàng nếu còn em chưa điểm)
│ └──────────────────────────────────┘ │
│ Link record                          │ nhãn
│ ┌───────────────────────────┐┌─────┐ │
│ │ https://drive.google.com/…││ Dán │ │ 48, chữ 16
│ └───────────────────────────┘└─────┘ │
│ Đã lưu · Mở link ↗                   │
│ Nội dung buổi                        │
│ ┌──────────────────────────────────┐ │
│ │ Hàm số lượng giác — phần 2       │ │ textarea 3 dòng
│ └──────────────────────────────────┘ │
│ Ghi chú nội bộ                       │
│ ┌──────────────────────────────────┐ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Link record:** `<input type="url" inputmode="url" autocomplete="off" spellcheck="false" name="record">`, placeholder "https://drive.google.com/…". Lưu khi dán, khi Enter, khi rời ô. Không chặn dán.
  - Nút "Dán" (44 × 64) chỉ hiện khi trình duyệt có `navigator.clipboard.readText` (Safari sẽ hiện ô "Dán" của hệ thống — chấp nhận); không có thì chỉ giữ ô nhập.
  - Theo nghiệp vụ 8.2: dán `drive.google.com/abc` (thiếu giao thức) → **tự thêm** `https://` và hiện lại link đã sửa trong ô; chuỗi không phải URL → lỗi ngay cạnh ô: "Đây không phải link. Dán link chia sẻ của video (bắt đầu bằng https://)."
  - Thêm của thiết kế: tên miền không phải `drive.google.com`, `docs.google.com`, `youtube.com`, `youtu.be` → **cảnh báo, không chặn**: "Link không phải Drive/YouTube — kiểm tra học sinh mở được không."
- **Nội dung buổi** (tối đa 2.000 ký tự, bộ đếm hiện khi còn < 200; từ Đợt 2 học sinh thấy) và **Ghi chú nội bộ** (chỉ chủ lớp, giáo viên): lưu khi rời ô, đi qua hàng đợi như điểm danh. Sửa được cả khi buổi đã qua (nghiệp vụ 8.1).
- Nút "Mở điểm danh" vàng khi buổi hôm nay hoặc còn em chưa điểm; nếu đã đủ thì là nút phụ "Xem điểm danh".

## 6. 1280px — danh sách + chi tiết cạnh nhau
```
┌ thanh bên ┬──────────────────────────────────────────────────────────────────────────┐
│           │ Buổi học     ‹ Tháng 11/2026 ›   [Tất cả][Toán][Sử][Địa][Anh]   [+ Thêm buổi học bù] │
│           │ ┌──────────────────────────────────────────────┐ ┌──────────────────────┐ │
│           │ │Ngày     │Môn  │Trạng thái│Điểm danh│Record  │ │ Toán · Thứ Bảy 28/11 │ │
│           │ ├─────────┼─────┼──────────┼─────────┼────────┤ │ 22:15–23:45          │ │
│           │ │T4 25/11 │Sử   │Có học    │Chưa điểm│[Dán]   │ │ Điểm danh …          │ │
│           │ │T5 26/11 │Anh  │Có học    │Hôm nay  │—       │ │ Link record …        │ │
│           │ │T6 27/11 │Địa  │Có học    │—        │—       │ │ Nội dung buổi …      │ │
│           │ │T7 28/11 │Toán │Lớp nghỉ  │—        │—       │ │ Ghi chú …            │ │
│           │ └──────────────────────────────────────────────┘ └──────────────────────┘ │
└───────────┴──────────────────────────────────────────────────────────────────────────┘
```
- Bảng 7/12 cột lưới, khung chi tiết 5/12 dính khi cuộn. Hàng 48, đầu bảng dính, hàng đang mở nền `nav-active`, hàng hôm nay nền `today-col`.
- Cột: Ngày (thứ + ngày, `tabular-nums`) · Môn · Trạng thái · Điểm danh · Record · Nội dung (1 dòng, phần thừa `text-overflow: ellipsis` + đầy đủ ở khung chi tiết).
- Chọn hàng cập nhật `?buoi=` bằng `router.replace` (không thêm lịch sử mỗi lần bấm); phím ↑/↓ đổi buổi khi tiêu điểm ở bảng.
- Không có lưới lịch tháng dạng 7 cột: lịch cố định theo thứ của môn, danh sách theo tuần đọc nhanh hơn và không cần thêm 4 màu môn.

## 7. Thêm buổi học bù (chủ lớp)
Tờ trượt đáy (điện thoại) / hộp thoại 480 (máy tính).
- **Môn** (nút chọn 44px; giáo viên 1 môn thì cố định), **Ngày** (`type="date"`, mặc định ngày gần nhất môn đó không có buổi), **Giờ** (`type="time"`, mặc định 22:15), **Thời lượng** (90 phút), **Bù cho buổi** (chọn trong các buổi "Lớp nghỉ" của môn trong 30 ngày, tuỳ chọn), **Nội dung**.
- Kiểm ngay khi chọn:
  - Trùng môn **và** trùng giờ bắt đầu (khoá của buổi là môn + giờ bắt đầu, nghiệp vụ 7.4) → lỗi: "Toán đã có buổi 22:15 ngày 13/12. Chọn giờ hoặc ngày khác." Cùng ngày khác giờ (ví dụ bù 20:00 trước buổi 22:15) thì được.
  - Trùng giờ với môn khác → cảnh báo (không chặn): "Cùng giờ với Tiếng Anh 22:15 — 12 em học cả hai môn sẽ bị trùng."
- Ghi chú dưới nút (chủ lớp): "Buổi học bù được tính vào học phí như buổi thường."
- Nút: "Thêm buổi" (vàng 48) · "Huỷ". Xong: thanh Hoàn tác 5 giây "Đã thêm buổi học bù Toán 01/12 · Hoàn tác".
- Buổi học bù dùng link Meet cố định của môn (đồng bộ Meet: Đợt 4).

## 8. Huỷ buổi (hiện "Lớp nghỉ")
- Từ menu … ở chi tiết buổi (chủ lớp). Hộp thoại xác nhận vì đổi học phí và chuyên cần:
  - Tiêu đề: "Huỷ buổi Toán thứ Bảy 28/11?"
  - Nội dung: "Buổi nghỉ không tính học phí và chuyên cần." Nếu đã có điểm danh: "Buổi đã có 61 lượt điểm danh. Điểm danh được giữ lại và hiện lại nếu đổi về Có học."
  - **Lý do (bắt buộc**, nghiệp vụ 6.1; học sinh thấy dòng "Lớp nghỉ" kèm lý do ở Đợt 2): "GV ốm", "Nghỉ lễ".
  - Ô tích: "Thêm buổi học bù ngay" → xong thì mở luôn §7 với "Bù cho buổi" đã điền.
  - Nút: "Huỷ buổi" (viền và chữ `danger`, không nền đỏ chữ trắng) · "Giữ buổi" (nút phụ, nhận tiêu điểm đầu tiên).
- Xong: thanh Hoàn tác 5 giây.
- Buổi **chưa có dữ liệu gì** (không điểm danh, không nội dung, không record — ví dụ buổi sinh nhầm): có thêm "Xoá buổi" (có Hoàn tác). Buổi đã có dữ liệu chỉ huỷ được, không xoá (nghiệp vụ 6.3). Buổi đã huỷ có "Bỏ huỷ"; điểm danh cũ hiện lại.
- Từ Đợt 3: nếu phiếu học phí tháng đó đã gửi → thêm dòng cảnh báo "Phiếu tháng 11 đã gửi — đổi buổi sẽ tạo chênh lệch cần điều chỉnh kỳ sau."

## 9. Tháng mới / lịch trống
- Lịch sinh tự động theo thứ của môn. Mở tháng chưa có buổi (ví dụ 1/2027): "Tháng 1/2027 chưa có lịch." + (chủ lớp) nút "Sinh buổi tháng 1" (bình thường máy tự sinh lúc 20:30 các ngày 25 → cuối tháng, nghiệp vụ 3.3; sinh lại không tạo buổi trùng) — xem trước "Toán 9 buổi · Sử 9 · Địa 5 · Anh 8" rồi xác nhận. Giáo viên chỉ thấy câu trống.

## 10. Trạng thái
| Trạng thái | Cách hiện |
|---|---|
| Đang tải | 6 hàng `skeleton` 72 (390) / 8 hàng 48 + khung chi tiết xám (1280) |
| Trống | §9; lọc môn không có buổi: "Tháng này không có buổi Địa. — Xem tất cả môn" |
| Lỗi | dải `danger-bg` + Thử lại, giữ danh sách cũ |
| Mất mạng | Dán record, nội dung, ghi chú: vẫn sửa được, vào hàng đợi, chỉ báo "chưa gửi". Thêm/huỷ buổi: nút thay bằng dòng "Cần có mạng để thêm hoặc huỷ buổi". |
| Học thử | Chi tiết buổi ghi sĩ số tách: "63 em · 14 chính thức · 49 thử" |
| Khoá | Giáo viên: không có "+ Học bù", không có menu huỷ (theo `nghiep-vu/buoi-hoc.md` Câu hỏi 2, phương án khuyên dùng). Buổi đã qua > 48 giờ: dán record/nội dung vẫn sửa tự do (không ảnh hưởng tiền); huỷ / bỏ huỷ vẫn qua hộp thoại §8. |

## 11. Token dùng
`bg`, `surface`, `raised` (khung chi tiết), `text`, `text-2`, `text-3`, `gold`/`on-gold` (Mở điểm danh khi còn chưa điểm, Thêm buổi), `ok` (Có record), `warn` (Chưa điểm, Thiếu record), `danger` (Huỷ buổi dạng viền), `today-col`, `nav-active`, `row-hover`, `border`, `border-input` (ô link, ô nội dung), `focus`, `shadow-overlay`, `z-sticky` (tiêu đề tuần, đầu bảng).

## 12. Chuyển động
Không có, trừ tờ trượt/hộp thoại 240ms và thanh Hoàn tác 150ms như khung. Đổi tháng: thay nội dung tức thì (không trượt trái/phải). Giảm chuyển động → tức thì.

## 13. Linh kiện React Bits
Không dùng. Lịch là danh sách gốc; không cần `Stepper`/`AnimatedList`.

## 14. Kiểm nhận
1. 390px, mở `/quan-ly/buoi-hoc` ngày 26/11 → thấy ngay hàng "T5 26 · Tiếng Anh · Hôm nay" không cần cuộn tay.
2. Bấm "Dán record" ở hàng Sử 25/11 → mở chi tiết với tiêu điểm ở ô link; dán `https://drive.google.com/file/d/…` → "Đã lưu" ≤ 1 giây (có mạng); hàng đổi thành "Có record".
3. Dán `drive.google.com/…` thiếu `https://` → ô tự thành `https://drive.google.com/…` và lưu; gõ `abc xyz` → lỗi cạnh ô, không lưu.
4. Huỷ buổi Toán 28/11 → hộp thoại; "Giữ buổi" có tiêu điểm đầu; sau khi huỷ, buổi không còn trong danh sách điểm danh hôm đó; Hoàn tác trong 5 giây trả về Có học.
5. Thêm học bù Toán 22:15 vào ngày đã có buổi Toán 22:15 → lỗi, không lưu; Toán 20:00 cùng ngày → được; trùng giờ với Anh → cảnh báo nêu số em học cả hai môn, vẫn thêm được.
6. Tài khoản chị Thu Hương: chỉ thấy buổi Anh; không có "+ Học bù"; gọi API huỷ buổi trả 403 (nếu chủ chọn Câu hỏi 1-A).
7. 1280px: bấm hàng → khung phải đổi, URL đổi `?buoi=` nhưng nút Quay lại của trình duyệt không đi qua từng buổi đã bấm.

## Nguồn tham khảo
- Ô nhập link: `type="url"`, `inputmode`, `autocomplete="off"`, `spellCheck={false}`, không chặn dán, lỗi ngay cạnh ô và nói cách sửa: skill `web-design-guidelines` (Forms, Content & Copy).
- Nút "Dán" dùng Clipboard API; Safari/Firefox cần thao tác của người dùng và hiện ô "Dán" của hệ thống: [MDN — Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), [web.dev — Unblocking clipboard access](https://web.dev/articles/async-clipboard), [Can I use — Asynchronous Clipboard API](https://caniuse.com/async-clipboard).
- Hộp thoại xác nhận cho việc có hậu quả (đổi học phí), Hoàn tác cho việc đảo ngược được: [NN/g — Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/).
- Trạng thái buổi trong sheet `Có học / Nghỉ / Học bù` (web: loại `theo_lich`/`hoc_bu` + trạng thái `binh_thuong`/`huy`, `nghiep-vu/buoi-hoc.md` 5.1), buổi tính phí `BUOI_TINH = ['Có học', 'Học bù']`, cột tab 📅: Apps Script KiN v8.12.

## Câu hỏi cho chủ
Ai được huỷ buổi / thêm học bù và cách xử lý buổi tương lai khi đổi lịch môn: đã có ở `nghiep-vu/buoi-hoc.md` Câu hỏi 1–2 (thiết kế theo phương án khuyên dùng: chỉ chủ lớp). Ai dán record: nghiệp vụ 8.1 (giáo viên của môn và chủ). Câu hỏi giao diện:
1. **Có cần thêm dạng lưới lịch tháng (7 cột) không?**
   - A. Không, chỉ danh sách theo tuần — **khuyên dùng** (lịch cố định theo thứ của môn, tối nào cũng 22:15; danh sách đọc nhanh hơn và làm được ngay "Dán record", "Điểm danh" trên hàng).
   - B. Có, thêm nút chuyển "Danh sách / Lưới tháng" ở máy tính.
2. **Học sinh (Đợt 2) thấy "Nội dung buổi" từ lúc nào?**
   - A. Ngay khi giáo viên ghi, kể cả trước buổi (em biết trước để chuẩn bị) — **khuyên dùng**.
   - B. Chỉ từ giờ bắt đầu buổi.
