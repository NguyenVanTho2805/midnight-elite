# Màn Học sinh — BCA-D1-TK (26/11/2026)

Danh sách 70 em và trang chi tiết một em. Thay cho tab "👥 Học sinh" (1 dòng/1 em, 4 ô môn Học/Thử/Nghỉ) và "📝 Ghi danh" của sheet.
Khung và trạng thái chung: [khung-quan-ly.md](khung-quan-ly.md).

## 1. Mục đích và ai dùng
- **Danh sách** `/quan-ly/hoc-sinh`: tìm nhanh một em, lọc nhóm em (theo môn, loại, lứa, hạn thử), gia hạn thử nhiều em một lần.
- **Chi tiết** `/quan-ly/hoc-sinh/[maHS]`: xem ghi danh từng môn, chuyên cần, liên hệ; **gia hạn thử, chuyển chính thức, cho nghỉ môn — chỉ chủ lớp** (mục 16).
- **Chủ lớp:** cả 70 em, mọi thao tác. **Giáo viên:** chỉ em có ghi danh môn mình (đang học, đang thử, hoặc đã từng học trong tháng); chỉ xem; không thấy SĐT phụ huynh (mục 14), không thấy học phí.

## 2. Số liệu thật (sheet 26/11)
70 em: 20 có ít nhất một môn chính thức, 50 chỉ học thử. Lứa: L1 "Lứa 1 – BCA Midnight 2K9" 20 em, L2 "Tổng Ôn Lý Thuyết Nền Tảng" 50 em. Một em có thể **chính thức môn này, thử môn kia** (ví dụ chính thức Sử, thử Toán) → tình trạng phải hiện theo từng môn, không chỉ một nhãn chung.

## 3. Danh sách — nội dung theo thứ tự ưu tiên
1. Ô tìm: tên (không dấu), mã HS, SĐT, Gmail. Khớp ngay khi gõ (70 em lọc ở máy, không gọi máy chủ).
2. Chip lọc nhanh có số đếm (cho xuống dòng, không cắt): **Hết thử ≤ 3 ngày 33** · **Đã hết, chưa quyết 0** · Học thử 50 · Chính thức 20.
3. Mỗi em: tên, chip môn theo loại, tình trạng thử, mã HS · lứa.
4. Bộ lọc đủ (trong tờ trượt "Lọc"): Môn (Toán/Sử/Địa/Anh), Loại (Chính thức/Học thử/Nghỉ), Lứa (L1/L2), Hạn thử (≤ 3 ngày / đã hết / chọn ngày hết), Sắp xếp (Tên A–Z theo tên kiểu Việt — mặc định · Mới đăng ký · Hết thử sớm nhất).
5. Thao tác hàng loạt (chủ lớp): chọn nhiều em → "Gia hạn thử".

Quy tắc lọc: "Môn + Loại" đi cùng nhau — chọn Toán + Học thử = em đang **thử Toán**. Chỉ chọn Loại = em có ít nhất một môn loại đó. Mọi bộ lọc nằm trên URL: `?mon=toan&loai=thu&lua=L2&het=3&q=huy&sap=het`.

## 4. Danh sách — 390px
```
┌──────────────────────────────────────┐
│ Học sinh · 70                  [Chọn] │ 56
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ⌕  Tìm tên, mã HS, SĐT, Gmail…   │ │ 48, chữ 16
│ └──────────────────────────────────┘ │
│ [Hết thử ≤ 3 ngày 33] [Học thử 50]   │ chip 36 cao, vùng bấm 44
│ [Chính thức 20]          [Lọc · 1 ▾] │
│ Toán ✕                    33 em      │ lọc đang bật + số kết quả
├──────────────────────────────────────┤
│ Trần Gia Bảo                       › │
│ HS041 · Lứa 2                        │ 84
│ [Toán · thử] [Anh · thử] [còn 2 ngày]│
├──────────────────────────────────────┤
│ Lê Thu Hà                          › │
│ HS007 · Lứa 1                        │
│ [Toán · chính thức] [Sử · chính thức]│
├──────────────────────────────────────┤
│ …                                    │
└──────────────────────────────────────┘
```
- Mỗi hàng là một `<a>` tới chi tiết (cả hàng bấm được), cao tối thiểu 64, thường 84 khi có chip; chip tự xuống dòng.
- Chip môn: `Toán · chính thức` nền `ok-bg` chữ `ok`; `Toán · thử` nền `trial-bg` chữ `trial-fg`; `Toán · nghỉ` viền `border`, chữ `text-3`. Một chip hạn thử riêng ở cuối: "còn 9 ngày" (`trial`), "còn 2 ngày" (`warn`), "Hết thử 25/11" (`danger`).
- "Lọc" mở tờ trượt đáy với 4 nhóm (môn, loại, lứa, hạn thử) dạng nút bật/tắt 44px + sắp xếp; nút "Xem 33 em" ở đáy tờ (cập nhật số khi chọn); "Bỏ lọc".
- **Chế độ chọn** (chủ lớp): bấm "Chọn" → mỗi hàng có ô tích 44×44 bên trái (tích cả hàng cũng được), đầu trang đổi "12 em đã chọn · Bỏ chọn", thanh dưới 5 mục được thay bằng thanh hành động "Gia hạn thử (12)" vàng 56px. Chọn em không có môn nào đang thử → nút ghi "Gia hạn thử (11) · 1 em không đang thử".

## 5. Danh sách — 1280px
```
 Học sinh · 70        ⌕ Tìm tên, mã HS, SĐT, Gmail…        [Lọc ▾] Sắp xếp: Tên A–Z ▾
 [Hết thử ≤ 3 ngày 33] [Đã hết, chưa quyết 0] [Học thử 50] [Chính thức 20]  Môn: [Toán][Sử][Địa][Anh]  Lứa: [L1][L2]
┌──┬─────────────────────────┬──────────────────────────────────┬──────────────────┬────────────┬─────────────┬──┐
│☐ │Học sinh                 │Môn                               │Hạn thử           │Đăng ký     │SĐT HS       │  │
├──┼─────────────────────────┼──────────────────────────────────┼──────────────────┼────────────┼─────────────┼──┤
│☐ │Trần Gia Bảo  HS041 · L2 │[Toán · thử] [Anh · thử]          │còn 2 ngày · 28/11│15/11       │0912 345 678 │› │ 48–56
│☐ │Lê Thu Hà     HS007 · L1 │[Toán · chính thức] [Sử · chính…] │—                 │02/09       │0987 …       │› │
└──┴─────────────────────────┴──────────────────────────────────┴──────────────────┴────────────┴─────────────┴──┘
 12 em đã chọn   [Gia hạn thử]  Bỏ chọn                               (thanh nổi, chỉ khi có chọn)
```
- Bảng hàng 48 (56 nếu chip xuống dòng), đầu bảng dính, `row-hover`; bấm hàng mở chi tiết (hàng có `<a>` ở tên, cả hàng là vùng bấm qua `::after`).
- Bộ lọc môn/lứa là chip luôn hiện (máy tính đủ chỗ); "Lọc" chỉ còn hạn thử theo ngày và loại Nghỉ.
- Cột ô tích, cột SĐT HS **chỉ chủ lớp** (giáo viên: theo câu hỏi ở `khung-quan-ly.md`). SĐT hiện `0912 345 678`, `tabular-nums`, `translate="no"`, là liên kết `tel:`.
- Bấm đầu cột "Hạn thử", "Đăng ký", "Học sinh" để sắp xếp (`aria-sort`).
- 70 hàng không cần ảo hoá; hàng có `content-visibility: auto`.

## 6. Chi tiết một em — nội dung theo thứ tự ưu tiên
1. **Đầu trang em:** họ tên (h1), mã HS · lứa, chip tình trạng chung. Nếu đang thử: **thanh 14 ngày** "Ngày 12/14 · còn 2 ngày · hết 28/11".
2. **Nút thao tác (chủ lớp):** "Gia hạn thử" và "Chuyển chính thức" (khi có môn đang thử); "Ghi danh thêm môn" (khi có môn chưa học). Menu "…": Cho nghỉ môn, Ẩn hồ sơ.
3. **Ghi danh từng môn** — 4 hàng cố định Toán, Sử, Địa, Anh:
   - "Toán · Học thử · 15/11 → 28/11 · còn 2 ngày" + nút nhỏ (chủ lớp) Gia hạn · Chuyển chính thức · Cho nghỉ
   - "Sử · Chính thức từ 20/11"
   - "Địa · Chưa ghi danh" + "Ghi danh" (chủ lớp)
   - "Anh · Nghỉ từ 22/11 (học thử 08/11 → 21/11)"
   - Dưới mỗi môn: "Lịch sử (3)" mở ra danh sách ngày-loại, ví dụ "15/11 Học thử (đơn web) · 20/11 Gia hạn +7 ngày (anh Thanh) · 26/11 Chính thức". Ai làm, khi nào đều ghi.
4. **Chuyên cần tháng này** theo môn: "Toán 7/8 có mặt · chuỗi 7" + một dải ô ✓ P K · của các buổi trong tháng (ký hiệu như ma trận); bấm → ma trận tháng lọc môn đó.
5. **Liên hệ:** SĐT HS (`tel:`), Gmail (nút "Sao chép"), Zalo HS; **chỉ chủ lớp:** họ tên PH, SĐT PH, Zalo PH.
6. **Thông tin đăng ký:** trường, khối, mục tiêu, biết qua, nguồn, ngày tạo, đồng ý vinh danh, username Azota.
7. **Ghi chú** (chủ lớp sửa, lưu khi rời ô).
8. Điểm, học phí: từ Đợt 3 (không để chỗ trống ở Đợt 1).

## 7. Chi tiết — 390px
```
┌──────────────────────────────────────┐
│ ‹  Học sinh                       …  │ 56
├──────────────────────────────────────┤
│ Trần Gia Bảo                         │ h1 22/800
│ HS041 · Lứa 2 · Học thử              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░    │ thanh 14 ngày, 8px, màu warn vì còn ≤ 3
│ Ngày 12/14 · còn 2 ngày · hết 28/11  │
│ ┌──────────────────────────────────┐ │
│ │      Chuyển chính thức           │ │ 48 vàng
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │      Gia hạn thử                 │ │ 48 viền border-input
│ └──────────────────────────────────┘ │
│ Ghi danh                             │ h2
│ Toán  Học thử 15/11 → 28/11       ⋯  │ hàng 56, ⋯ = menu thao tác môn
│ Sử    Chính thức từ 20/11         ⋯  │
│ Địa   Chưa ghi danh       [Ghi danh] │
│ Anh   Học thử 15/11 → 28/11       ⋯  │
│ Chuyên cần tháng 11                  │
│ Toán  ✓ ✓ ✓ ✓  4/4 · chuỗi 4         │
│ Liên hệ · Thông tin đăng ký · Ghi chú│ (các mục mở/đóng, mặc định mở Liên hệ)
└──────────────────────────────────────┘
```
- Hai nút chính rộng hết, chồng dọc, khoảng 12. "Chuyển chính thức" là nút vàng (việc mang lại học phí), "Gia hạn thử" là nút phụ. Em không đang thử → không có hai nút này.
- Menu ⋯ của từng môn mở tờ trượt: Gia hạn môn này · Chuyển chính thức môn này · Cho nghỉ môn này.

## 8. Chi tiết — 1280px
Hai cột trong khung 1120: trái 2/3 (đầu trang em + nút ngang hàng bên phải tên, Ghi danh dạng bảng 4 hàng × cột Môn/Loại/Từ/Đến/Còn/Thao tác, Chuyên cần), phải 1/3 (Liên hệ, Thông tin đăng ký, Ghi chú, Lịch sử thao tác). Nút thao tác cao 44.

## 9. Ba hộp thoại của chủ lớp
Điện thoại: tờ trượt đáy; máy tính: hộp thoại 480px. Thao tác này **cần có mạng** (liên quan học phí và quyền vào lớp) — mất mạng thì nút bị thay bằng dòng "Cần có mạng để gia hạn/chuyển chính thức", không xếp hàng đợi như điểm danh.

### 9.1 Gia hạn thử (một em hoặc nhiều em)
- Môn: ô tích các môn **đang thử** (mặc định tích hết), mỗi dòng có ngày hết hiện tại.
- Thêm: nút chọn `+3 ngày` · `+7 ngày` · `+14 ngày` · `Chọn ngày` (ô ngày). Mặc định `+7 ngày`.
- Xem trước: "Toán: 28/11 → 05/12 · Anh: 28/11 → 05/12". Nhiều em: gom theo ngày mới "16 em → 05/12".
- Lý do (tuỳ chọn, 1 dòng): "Em bận thi giữa kỳ".
- Nút: "Gia hạn" (vàng 48) · "Huỷ".
- Xong: thanh Hoàn tác 5 giây "Đã gia hạn Trần Gia Bảo tới 05/12 · Hoàn tác". Em đang bị khoá được mở ngay.

### 9.2 Chuyển chính thức
- Môn: ô tích các môn đang thử (mặc định tích hết) + có thể tích thêm môn chưa ghi danh.
- "Tính phí từ ngày": mặc định hôm nay; ghi chú dưới: "Buổi Có học/Học bù từ ngày này tính vào học phí tháng 11" (mục 13).
- Xem trước đơn giá: "Từ 26/11 học Toán + Anh → 55.000đ/buổi/môn" (1 môn: 65.000đ/buổi). Số tiền `tabular-nums`, `Intl.NumberFormat('vi-VN')`.
- Môn thử không tích: giữ nguyên tới hết hạn thử; ô tích phụ "Cho nghỉ các môn thử còn lại".
- Nút: "Chuyển chính thức" (vàng 48) · "Huỷ". Hộp thoại này chính là bước xác nhận (liên quan tiền) — không hỏi thêm lần nữa.
- Xong: thanh Hoàn tác 5 giây; nếu đã có mẫu tin nhắn, hiện nút "Sao chép tin nhắn Zalo chào phụ huynh" (mẫu tin do `bca-nghiep-vu` chuyển từ sheet).

### 9.3 Cho nghỉ môn
- Môn (một), "Học đến hết ngày" (mặc định hôm nay). Ghi chú: "Từ 27/11 em không còn trong danh sách điểm danh Toán; điểm danh cũ vẫn giữ."
- Nút viền `danger`, chữ `danger`: "Cho nghỉ môn Toán" (không nền đỏ chữ trắng — sửa 7 của `huong-chon.md`) · "Huỷ".

## 10. Trạng thái
| Trạng thái | Danh sách | Chi tiết |
|---|---|---|
| Đang tải | 8 hàng `skeleton` 84 (390) / 10 hàng 48 (1280) | đầu trang + 4 hàng ghi danh |
| Trống (chưa có em) | "Chưa có học sinh. Dữ liệu sẽ có sau khi chuyển từ sheet." | — |
| Không khớp tìm/lọc | "Không có em nào khớp 'Huyy' trong Địa. — Bỏ lọc" | — |
| Lỗi | dải `danger-bg` + Thử lại, giữ danh sách cũ | như vậy |
| Mất mạng | Danh sách lần tải trước, tìm/lọc vẫn chạy ở máy | Thao tác §9 bị thay bằng dòng "Cần có mạng…" |
| Học thử | chip "còn N ngày" (`trial` / `warn` khi ≤ 3) | thanh 14 ngày: rãnh `border`, phần đã qua `trial-fg` (≤ 3 ngày: `warn`); `role="progressbar"` `aria-valuenow="12"` `aria-valuemax="14"` `aria-valuetext="Ngày 12 trên 14, còn 2 ngày"` |
| Khoá (hết thử) | chip `danger-bg` "Hết thử 25/11" | dải `danger-bg` đầu trang: "Hết thử 25/11 — em đang không vào được lớp, record, điểm." + 2 nút Gia hạn / Chuyển chính thức |
| Giáo viên | không có ô tích, không có cột SĐT PH | không có nút thao tác, chỉ môn của mình trong Ghi danh/Chuyên cần |
| Không có quyền xem em này (giáo viên mở link em không học môn mình) | — | 403 gọn |

## 11. Token dùng
`bg`, `surface`, `raised` (đầu trang em), `text`, `text-2`, `text-3`, `gold`/`on-gold` (Chuyển chính thức, Gia hạn trong hộp thoại, thanh hành động hàng loạt), `ok`/`ok-bg`, `trial-fg`/`trial-bg`, `warn`/`warn-bg`, `danger`/`danger-bg`, `border`, `border-input` (ô tìm, ô tích, nút phụ), `row-hover`, `focus`, `shadow-overlay`; bo 14 (ô, nút), 20 (tờ trượt), 999 (chip).

## 12. Chuyển động
Không có chuyển cảnh danh sách → chi tiết (không dùng `<ViewTransition>`: khu quản lý mở trang phải tức thì; skill `vercel-react-view-transitions` cũng chỉ khuyên khi chuyển động nói lên quan hệ không gian, ở đây không cần). Chỉ có tờ trượt/hộp thoại 240ms và thanh Hoàn tác 150ms như khung; thanh 14 ngày vẽ tĩnh. Giảm chuyển động → tức thì.

## 13. Linh kiện React Bits
Không dùng. Đã xem `SpringCheck` (ô tích có lò xo) cho chế độ chọn và `GlideSelect` cho bộ lọc: loại vì thêm `motion` và chuyển động không cần cho thao tác hằng ngày; dùng `<input type="checkbox">` và nút gốc.

## 14. Kiểm nhận
1. Gõ "bao" → thấy "Trần Gia Bảo"; gõ SĐT 4 số cuối → thấy đúng em; URL có `q=`.
2. Bấm chip "Hết thử ≤ 3 ngày" ngày 26/11 → 33 em; F5 vẫn giữ lọc.
3. Chủ lớp chọn 16 em hết 28/11 → "Gia hạn thử (16)" → `+7 ngày` → cả 16 em hết 05/12; Hoàn tác trong 5 giây trả về 28/11.
4. Chuyển chính thức em thử Toán + Anh từ 26/11 → xem trước ghi 55.000đ/buổi/môn; em biến khỏi lọc "Học thử" nếu không còn môn thử.
5. Tài khoản giáo viên: không có ô tích, nút gia hạn/chuyển chính thức không có trong DOM; gọi API gia hạn trả 403.
6. Ở 390px: không có thanh cuộn ngang trang; chip xuống dòng, không bị cắt chữ.

## Nguồn tham khảo
- Bộ lọc gắn với URL, chế độ xem đã lọc, chỉ đưa 2–3 bộ lọc ra ngoài trên màn nhỏ: [Shopify Polaris — Index filters](https://polaris.shopify.com/components/selection-and-input/index-filters), [Shopify — Migrate Index Filters](https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/index-filters).
- Bảng tràn trên điện thoại → đổi sang danh sách thẻ: cơ sở dữ liệu UX của skill `ui-ux-pro-max` (mục Responsive / Table Handling; Data Entry / Bulk Actions).
- Thao tác đổi được thì dùng Hoàn tác, việc nghiêm trọng dùng hộp thoại: [NN/g — Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/).
- Cấu trúc dữ liệu: `COLS.HS`, `COLS.GD` (Từ ngày, Học đến hết ngày, Loại), `SO_NGAY_HOC_THU = 14` trong Apps Script KiN v8.12.

## Câu hỏi cho chủ
1. **Gia hạn cho em đã hết thử thì tính từ đâu?** (ví dụ em hết 20/11, ngày 26/11 chủ gia hạn +7 ngày)
   - A. Tính từ hôm nay: học tới hết 02/12 — **khuyên dùng** (em được đủ 7 ngày học thật).
   - B. Nối từ ngày hết cũ: học tới hết 27/11 (chỉ còn 2 ngày).
   (Em chưa hết thử thì cả hai cách như nhau: nối từ ngày hết hiện tại.)
2. **Có cho gia hạn thử nhiều em một lần không?** (ngày 28–29/11 có 33 em hết thử cùng lúc)
   - A. Có, chọn nhiều em rồi gia hạn, có Hoàn tác 5 giây — **khuyên dùng**.
   - B. Không, từng em một trong trang chi tiết.
3. **Ngày bắt đầu tính phí khi chuyển chính thức mặc định là ngày nào?**
   - A. Hôm nay (chủ sửa được) — **khuyên dùng**, đúng mục 13 "tính từ ngày em chính thức".
   - B. Ngày hết thử + 1 (em dùng hết 14 ngày miễn phí rồi mới tính phí).
   - C. Buổi học kế tiếp của môn đó.
