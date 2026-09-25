# Đặc tả bố cục Outlook — một vỏ, bốn vai

Bản giao cho người code. Cập nhật 24/09/2026.
Bản dựng đối chiếu: `../nguyen-mau/03-khong-gian-bon-vai.html` (mở bằng trình duyệt).
Mọi con số dưới đây **đo từ chính bản dựng đó**, không phải ước lượng.

---

## 1. Ý tưởng, và vì sao không làm cách khác

Outlook đáng học **không phải vì nó có email**. Nó đáng học vì **một cái vỏ duy nhất**
chứa lịch, việc cần làm, người, tệp — và người dùng không bao giờ phải rời khỏi cái vỏ đó.

KiN lấy cơ chế ấy, thay ruột bằng danh từ của mình: buổi học, bài tập, học phí,
xác nhận của phụ huynh.

**Không dựng bốn ứng dụng cho bốn vai.** Dựng **một vỏ**, đổi ba thứ theo vai:

1. Danh sách module ở thanh dọc
2. Nội dung trong khung danh sách
3. **Cách gọi tên cùng một sự việc**

Điểm 3 là điểm hay bị bỏ. Cùng một buổi chờ xác nhận:

| Vai | Đọc thấy |
|---|---|
| Gia sư | "6 phụ huynh chưa xác nhận buổi 24/09" |
| Phụ huynh | "Cần anh/chị xác nhận 2 buổi học của con" |
| Học sinh | **không hiện gì** |

Đây không phải dịch ba lần. Là ba người khác nhau nói về cùng một việc.
Ô nào ghi "không hiện" là **một quyết định đã chốt**, không phải chỗ trống chờ điền.

---

## 2. Khung ứng dụng

```css
.app {
  display: grid;
  grid-template-columns: 78px 330px minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);   /* 14px */
}
```

| Cột | Rộng | Tên | Việc |
|---|---|---|---|
| 1 | `78px` cố định | **Thanh module** (`.rail`) | Đổi module. Nền `--panel`, viền phải `--line`. |
| 2 | `330px` cố định | **Danh sách** (`.list`) | Các mục trong module. Cuộn riêng. |
| 3 | `minmax(0,1fr)` | **Khung đọc** (`.read`) | Chi tiết mục đang chọn. Cuộn riêng. |

`minmax(0,1fr)` chứ không phải `1fr`: thiếu `min-width:0` thì một tiêu đề dài không
xuống dòng sẽ đẩy phình cột và phá cả lưới. Cả `.list` và `.read` đều phải có `min-width:0`.

**Hai khung cuộn độc lập.** `.list-body` và `.read-body` mỗi cái `overflow-y:auto; flex:1`.
Không cho cả trang cuộn — nếu cuộn cả trang thì thanh module trôi mất và người dùng
lạc chỗ, đúng thứ bố cục này sinh ra để tránh.

---

## 3. Thanh module theo vai

| | Gia sư | Học sinh | Phụ huynh | Quản trị |
|---|---|---|---|---|
| 1 | Hộp việc `(3)` | Việc của tôi `(2)` | Cần xác nhận `(2)` | Kiểm duyệt `(2)` |
| 2 | Lịch | Lịch | Lịch của con | Người dùng |
| 3 | Lớp | Lớp | Sổ học | Báo cáo |
| 4 | Bài KT | Thư viện | Học phí | |
| 5 | Thư viện | | | |
| 6 | Học phí | | | |

Số trong ngoặc là badge đỏ — **chỉ cho việc cần người đó ra tay**, không phải đếm
mục chưa đọc. Badge sai chỗ thì người dùng học cách phớt lờ nó trong một tuần.

Nút module: rộng `66px`, `padding: 8px 2px 6px`, bo `var(--r-md)`, icon `21×21px`,
chữ nhãn `9.5px`. Trạng thái đang chọn dùng `aria-current="true"` → nền `--tint`,
chữ `--navy`, `font-weight:600`.

Badge: `min-width:16px; height:16px`, nền `--red`, chữ trắng `10px`.
**Ở nền tối chữ badge phải đổi thành `#0B0E14`** — chữ trắng trên đỏ ở nền tối chỉ
đạt 3,68:1, trượt chuẩn 4,5:1. Xem `tuong-phan.md`.

---

## 4. Khung danh sách

`.list-head`: `padding: 12px 14px 10px`, viền dưới `--line`.
Trong đó h2 `600 17px var(--f-h)`, dòng phụ `12.5px` màu `--muted`.

`.list-head` chứa ô tìm kiếm và dải chip lọc. Chip lọc theo module:

| Module | Chip |
|---|---|
| Hộp việc (gia sư) | Tất cả · Cần trả lời · Đã xử lý |

Mỗi dòng `.row` có ba tầng:

| Tầng | Nội dung | Kiểu |
|---|---|---|
| `.l1` | tiêu đề + giờ/ngày bên phải | `500 14px`; **`600` khi chưa đọc** |
| `.l2` | một dòng phụ | `12.5px`, `--muted` |
| `.l3` | các thẻ trạng thái | `flex-wrap: wrap` |

Cả ba tầng `l1`/`l2` đều `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
**Cắt bằng dấu ba chấm, không xuống dòng** — dòng cao bằng nhau thì mắt quét nhanh hơn,
và đó là toàn bộ lý do tồn tại của khung danh sách.

Trạng thái dòng:

| Trạng thái | Biểu hiện |
|---|---|
| Mặc định | nền trong suốt |
| Hover | nền `--hover` |
| Đang chọn | `aria-selected="true"` → nền `--sel`, viền trái `--navy` |
| Focus bàn phím | `outline: 2px solid var(--blue); outline-offset: -2px` |

`outline-offset` âm để viền focus nằm **trong** ô, không bị dòng kế tiếp cắt mất.

---

## 5. Khung đọc

`.read-head`: `padding: 16px 20px 0`, viền dưới `--line`.
h1 `600 20px/1.3 var(--f-h)`, `text-wrap: balance`.
Dòng meta `13px` màu `--muted`.

Dưới tiêu đề là **hàng lệnh** — tối đa 3 nút, thứ tự cố định:

1. một nút chính (`.btn.pri`) — việc hay làm nhất
2. một nút thường — việc phụ
3. nút `…` (`.btn.ghost`) — phần còn lại

Ví dụ ở mục "6 phụ huynh chưa xác nhận": `Nhắc cả 6 phụ huynh` · `Mở buổi học` · `…`

Dưới hàng lệnh là **tab**. Mỗi mục có tab riêng, không phải bộ tab chung.

`.read-body`: `padding: 20px`, cuộn riêng.

### Rỗng, chờ, lỗi

| Trạng thái | Hiện gì |
|---|---|
| Chưa chọn mục nào | Khung đọc hiện dòng gợi ý chọn một mục. **Trên máy tính, mặc định chọn sẵn mục đầu** để không ai phải nhìn khung rỗng khi vừa mở. |
| Module không có mục nào | Câu nói đúng việc đang thiếu: "Chưa có buổi nào chờ xác nhận." Không dùng "Không có dữ liệu". |
| Đang tải | Khung xương ba dòng đúng chiều cao `.row` thật. Không dùng vòng xoay — nó làm bố cục nhảy khi dữ liệu về. |
| Lỗi tải | Giữ nguyên danh sách cũ, hiện dải báo lỗi trên đầu kèm nút thử lại. **Không xoá nội dung đang có.** |

---

## 6. Điện thoại

Không có breakpoint theo bề rộng cửa sổ. Dùng **container query** — bố cục phản ứng
theo bề rộng **khung**, không phải bề rộng màn hình. Nhờ vậy nhúng vào đâu cũng đúng,
và xem thử không cần thu cửa sổ.

```css
body[data-w="phone"] .app {
  max-width: 390px;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) 60px;   /* nội dung trên, thanh module dưới */
}
```

| | Máy tính | Điện thoại |
|---|---|---|
| Thanh module | cột trái, dọc, `78px` | **thanh dưới**, ngang, cao `60px` |
| Danh sách + khung đọc | cạnh nhau | **chồng lên nhau**, mỗi lúc một cái |
| Chọn một mục | khung phải đổi | `data-open="1"` → ẩn danh sách, hiện khung đọc |
| Quay lại | không cần | nút `←` ở đầu khung đọc |

Thanh module xuống đáy vì trên điện thoại người ta cầm một tay — ngón cái với tới đáy,
không với tới đỉnh.

---

## 7. Module Lịch

Lưới tuần. Hằng số trong bản dựng: giờ đầu `13`, giờ cuối `24`, mỗi giờ cao `44px`.

**Phải khai báo hàng tường minh:**

```js
'<div class="cal-grid" style="grid-template-rows:repeat(' + nH + ',' + ROW + 'px)">'
```

Không có nó thì `grid-row: 1 / -1` của cột ngày chỉ trỏ tới vạch cuối của lưới
**tường minh** — tức hàng 1 — nên cả cột dồn vào một hàng và thang giờ sập xuống đáy.
Lỗi này đã xảy ra thật trong lúc dựng.

Vạch "bây giờ" là một đường ngang tính theo phút, không snap về đầu giờ.

---

## 8. Bàn phím và trình đọc màn hình

| Phím | Việc |
|---|---|
| `Tab` | thanh module → ô tìm → chip lọc → danh sách → hàng lệnh → nội dung |
| `↑` `↓` | di chuyển trong danh sách, khung đọc đổi theo |
| `Enter` | trên điện thoại: mở khung đọc |
| `Esc` | trên điện thoại: quay lại danh sách |

Danh sách là `role="listbox"`, mỗi dòng `role="option"` + `aria-selected`.
Nút module dùng `aria-current="true"`, **không** dùng `aria-selected` — chúng là
điều hướng, không phải lựa chọn trong một tập.

Badge phải có nhãn đọc được: `aria-label="3 việc cần xử lý"`, không để trình đọc
màn hình đọc trần số "3".

Vùng đích chạm tối thiểu `var(--touch-min)` = **44px**. Đã đo lại toàn bộ bản dựng:
không nút nào dưới ngưỡng.

---

## 9. Chuyển động

| Chỗ | Kích hoạt | Làm gì | Thời lượng |
|---|---|---|---|
| Khung đọc | chọn dòng khác | mờ dần vào, không trượt | 120ms `ease-out` |
| Điện thoại: mở mục | chạm dòng | trượt từ phải | 180ms `ease-out` |
| Hover dòng | trỏ chuột | đổi nền | 80ms |

Ngắn. Đây là công cụ dùng hằng ngày, không phải trang giới thiệu.
Tôn trọng `prefers-reduced-motion: reduce` → bỏ hết, chỉ đổi trạng thái tức thì.

---

## 10. Việc trong Hộp việc từ đâu ra

Hộp việc **không phải email**. Nó là hàng đợi KiN tự sinh. Mỗi việc phải có một
**sự kiện nguồn** trong cơ sở dữ liệu, không có việc nào do người gõ tay tạo ra.

| Việc | Sinh khi | Biến mất khi |
|---|---|---|
| "N phụ huynh chưa xác nhận buổi X" | có `attendance.confirm = PENDING` sau khi buổi kết thúc | tất cả chuyển CONFIRMED/AUTO/DISPUTED |
| "Phụ huynh báo sai buổi X" | `confirm = DISPUTED` | gia sư xử lý xong |
| "Học phí tháng M chưa thu" | hết tháng mà `payments.received_at` còn trống | ghi nhận đã nhận |
| "Bài KT chưa chấm" | hết hạn nộp | chấm xong |

Quy tắc: **một việc = một hàng dữ liệu có thật**. Không đếm suy ra, không cache riêng.
Cache rời sẽ lệch với sự thật, và lúc lệch thì gia sư mất lòng tin vào cả badge.
