# CLAUDE.md — KiN, kho triển khai

> **Cách dùng:** chép file này vào **gốc kho code của bạn** và đổi tên thành
> `CLAUDE.md`. Claude Code sẽ tự đọc nó ở mỗi phiên làm việc. Nội dung dưới đây
> là bối cảnh đã chốt tính đến 24/09/2026.

---

## 1. Sản phẩm là gì

KiN là **hạ tầng cho người dạy** — sinh viên gia sư, giáo viên tự do, trung tâm
nhỏ. Ngách: người dạy tự do **1–20 học viên**, chỗ Azota và Shub không phục vụ tốt.

Mô hình tiền: **gia sư trả phí nền tảng** (Coin nạp trước, dưới 20k/tháng).
**KiN không giữ học phí** giữa gia sư và phụ huynh — phụ huynh chuyển thẳng cho
gia sư qua VietQR.

Đòn bẩy bán hàng: Thông tư 29/2024/TT-BGDĐT buộc người dạy thêm có thu tiền phải
công khai lịch dạy, tên người dạy và mức học phí. Sổ lớp KiN sinh ra sẵn đúng
những thứ đó. Câu chào bán là **"giấy tờ đúng quy định"**, không phải
"tiện hơn Zalo".

Ranh giới: lớp luyện thi HSA của đội là **một người dùng** của KiN, không phải
một phần của KiN.

---

## 2. Có hai kho code, đừng nhầm

| | Kho này (Prisma) | `kin-app` |
|---|---|---|
| ORM | Prisma | không có, Postgres thuần |
| Mô hình | `Course → Section → Chapter → Lesson` | `classes → students → sessions → attendances` |
| Quyền | `adminRole: "teacher"`, `ownsResource()` | `classes.tutor_id` |
| Trạng thái | đang xây | **đang chạy thật** |

`kin-app` ở https://github.com/aodtsix-cmd/kin-app — bản sổ lớp gia sư đang dùng
hằng ngày tại https://kin-app-peach.vercel.app

**Khi tài liệu và `kin-app` nói khác nhau, `kin-app` đúng.** Nó đã va vào thực tế.

### Ba khái niệm hai kho đang xây trùng nhau

| Kho này định làm | `kin-app` đã có |
|---|---|
| `ClassInvite` (BE-063) | `students.token`, `randomBytes(18)` base64url |
| `Enrollment.status = "pending_consent"` (BE-044) | chưa có, nhưng là bước 4 lộ trình |
| gia sư sở hữu lớp | `classes.tutor_id` từ đầu |

Chốt chung trước khi viết. Hai bên trôi nhau rồi sẽ phải bỏ một bên.

---

## 3. Backlog — bắt đầu từ đâu

Trong `kin-app/docs/backlog/`:

- `viec.csv` — **151 việc**, có cột `Chặn bởi` và `Sẵn sàng làm ngay`
- `quyet-dinh.csv` — 13 quyết định chờ anh Thanh
- `KiN-backlog.xlsx` — cùng nội dung, 3 sheet

Tình hình: **7 xong, 92 làm được ngay, 52 đang bị chặn.** P0 48, P1 98, P2 5.

**Lọc `Sẵn sàng làm ngay = Có`, sắp theo `Ưu tiên`.** Đó là 92 việc không phải
đợi ai. Nhóm **1.1 (vá bảo mật)** và **1.2 (dọn code chết)** độc lập hoàn toàn
với mọi quyết định — bắt đầu ở đó.

Ba quyết định D01, D02, D08 mở khoá **43 trên 52** việc đang chặn. Nếu đang rảnh
mà hết việc, nhắc anh Thanh chốt ba cái đó trước.

---

## 4. Hai chỗ tài liệu tự mâu thuẫn — đừng code qua

### Ai trả Coin?

Định hướng 23/09: *"KiN không giữ học phí giữa gia sư và phụ huynh."*
Backlog: `BE-059` cho **học viên** `spendCoins` mua gói lớp, `BE-060` cho học
viên xem gói đã mua.

Hai câu đó ngược nhau. Bản backlog đặt KiN vào vị trí **trung gian thanh toán** —
đúng chỗ định hướng nói phải tránh, và đúng câu đang chờ luật sư.

Ảnh hưởng **D01, D05, D10** và cả mục 1.4.5 (8 việc). Nếu mô hình đúng là gia sư
trả phí nền tảng còn học phí đi thẳng qua VietQR, mục đó phải **viết lại**, không
phải điều chỉnh. **Hỏi trước khi làm 1.4.5.**

### Báo cáo doanh thu sẽ tụt về gần 0

`BE-039` đặt `sourceType = null` cho mọi giao dịch cũ (cố ý, không suy đoán ngược).
`BE-074` cho báo cáo mới chỉ đọc `where sourceType = "class_subscription"`.
Ghép lại: toàn bộ doanh thu lịch sử biến mất.

`BE-077` giữ song song cách tính cũ và đỡ được — nhưng nó là P1 trong khi BE-039
là P0. **Đã nâng BE-077 lên P0 trong `viec.csv`.** Làm BE-077 **cùng lúc** với
BE-039, không phải sau.

---

## 5. Quy tắc nghiệp vụ — đã trả giá để biết

Năm điều dưới đây rút từ `kin-app` đang chạy. Chi tiết và bằng chứng ở
`kin-app/docs/nhung-cho-de-sai.md`.

**1. Tiền chốt vào sự kiện, không đọc lại từ cha.**
Giá một buổi phải lưu ngay trên bản ghi điểm danh tại thời điểm điểm danh
(`attendances.rate`), không tính bằng `số buổi × giá lớp hiện tại`. Gia sư tăng
giá tháng 10 thì phiếu tháng 9 phải giữ nguyên giá cũ. Trong `kin-app`:

```js
rateOf = (a, classRate) => (Number.isInteger(a?.rate) && a.rate > 0 ? a.rate : classRate)
```

**2. Chỉ buổi đã chốt mới tính tiền.**
```js
counted = (a) => a.status !== "A" && (a.confirm === "CONFIRMED" || a.confirm === "AUTO")
```
`status`: P có mặt, L muộn, A vắng. `confirm`: PENDING, CONFIRMED, DISPUTED, AUTO.

**3. Tự chốt cần CẢ HAI điều kiện, không phải một.**
`72 giờ` im lặng **và** đã nhắc `≥ 2 lần`. Đủ 72 giờ mà mới nhắc 1 lần thì chưa
được tự chốt. Đây là ranh giới giữa "phụ huynh đã có cơ hội phản đối" và "hệ thống
tự ý tính tiền của người ta".

**4. Ghi lại lúc hai bên còn đồng ý, không phải lúc cãi nhau.**
Điểm danh có phụ huynh xác nhận; thẻ thoả thuận học thử khoá lại sau khi hai bên
gật. Cùng một nguyên tắc, và nó là **cốt lõi sản phẩm**, không phải tính năng phụ.

**5. Thao tác có ghi dữ liệu thì dùng POST thường + redirect 303.**
Server action của Next.js bị huỷ giữa chừng (`net::ERR_ABORTED`) khiến nút kẹt
vĩnh viễn ở "Đang lưu…" trong khi máy chủ **đã ghi xong** — gia sư thấy thông báo
thành công giả và đi dạy với nửa lớp bị thiếu. Đã thử 5 cách sửa trong React, cách
nào cũng lúc được lúc không. `kin-app` đã bỏ hẳn server action cho 9 thao tác ghi.
Server action chỉ dành cho việc cần trả lỗi về form mà không điều hướng.

---

## 6. Giao diện

`kin-app/docs/thiet-ke/tokens.css` — token màu sáng + tối, **đã đo tương phản
WCAG 2.1 AA**. Trả lời thẳng FE-087 → FE-090. Dùng file này, đừng tự chọn màu.

`kin-app/docs/thiet-ke/tuong-phan.md` — bảy cặp màu trong bản cũ trượt chuẩn, số
đo và bản vá. Nặng nhất: chữ trắng trên nút chính nền tối đo được 3,68:1, cần 4,5:1.

Hai quy tắc kèm theo:

- **Màu không bao giờ nói một mình.** Mọi trạng thái đều có chữ đi kèm, không chỉ
  chấm màu.
- **Ngữ nghĩa có hai bộ mã.** Chữ cần 4,5:1, chấm và viền chỉ cần 3:1. Dùng một
  mã cho cả hai là nguồn gốc của 7 lỗi trên.

`kin-app/docs/nguyen-mau/` — mở bằng trình duyệt, không cần cài gì, để thấy giao
diện đích. Dữ liệu trong đó là dữ liệu mẫu.

---

## 7. Giọng sản phẩm

Tiếng Việt, xưng hô tự nhiên. Tên là **KiN** ở mọi nơi — không dùng Midnight Elite.

**Cùng một việc, mỗi vai một giọng.** Buổi chờ xác nhận: gia sư đọc "6 lượt chờ",
phụ huynh đọc "Anh/chị xác nhận giúp 2 buổi học của con", học sinh không thấy gì.
Không phải dịch ba lần — là ba người khác nhau nói về cùng một việc. Cột nào ghi
"không hiện" là một quyết định đã chốt, không phải chỗ trống chờ điền.

---

## 8. Đừng tự quyết ba điều này

- **Ai trả Coin** — mục 4 ở trên.
- **Đồng ý kép cho trẻ từ 7 tuổi.** Nghị định 13/2023 yêu cầu cả trẻ **và** người
  giám hộ đồng ý. Bảng `ParentConsent` sẽ cần cột riêng cho từng bên.
- **Giá và gói miễn phí** (bảng `PLAN`) — chưa chốt.

Các viện dẫn Luật Trẻ em 2016, Nghị định 13/2023, Thông tư 29/2024/TT-BGDĐT là căn
cứ để hỏi luật sư, **không phải ý kiến pháp lý**.

---

## 9. Khi bí

Trước khi đoán, hỏi. Ba câu đáng hỏi nhất:

1. Việc này có bị chặn bởi quyết định nào không? (cột `Chặn bởi` trong `viec.csv`)
2. `kin-app` đã làm việc này chưa, và làm thế nào?
3. Chỗ này có tiền hoặc có trẻ dưới 16 tuổi không? Nếu có thì dừng lại và hỏi người.
