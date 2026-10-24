# Học phí của gia sư

Route: `/lop-cua-toi/hoc-phi` (mở thẳng một tab bằng `?tab=doi-soat` hoặc `?tab=nhan-tien`; không có tham số thì là tab Phiếu). Tệp mã chính: `src/app/lop-cua-toi/(tutor)/hoc-phi/page.tsx`, `HocPhiClient.tsx`, `InvoicesTab.tsx`, `ReconcileTab.tsx`, `PayoutTab.tsx`; thành phần dùng chung `src/components/tutor/shared.tsx`; logic thuần `src/lib/tuitionInvoice.ts`, `src/lib/invoiceZalo.ts`, `src/lib/zaloShare.ts`. Vai người dùng: **chỉ gia sư** (`role = admin` và `adminRole = teacher`). Học sinh bị chuyển sang `/student/hoc-phi`, quản trị khác sang `/lop-cua-toi`, chưa đăng nhập sang `/dang-nhap?redirect=/lop-cua-toi/hoc-phi`.

> **Màn này dính tiền.** Bản này chỉ mô tả cách TRÌNH BÀY. Nhà thiết kế không được đổi cách tính phiếu, cách đối soát, điều kiện hiện nút hay việc mỗi nút làm (xem mục 8). Những chỗ nhà thiết kế muốn đổi hành vi (hoàn tác, xác nhận hai bước, gộp nút vào menu…) đều nằm ở mục 12 chờ chủ dự án quyết, không tự làm.

---

## 1. Mục đích và người dùng

Cô Lan (gia sư, 7 lớp, 8 học viên đang học) mở màn này để trả lời ba câu hỏi theo thứ tự:

1. **Tháng này ai còn chưa đóng, còn bao nhiêu?** (tab **Phiếu**)
2. **Có khoản tiền nào vào tài khoản mà KiN chưa dám tự gạch không?** (tab **Chờ đối soát**)
3. **Tiền có đang đi thẳng vào tài khoản của tôi không, KiN đọc được tiền vào chưa?** (tab **Nhận tiền**)

Nguyên tắc nghiệp vụ nền (đọc từ mã, không phải ý kiến thiết kế):

- **KiN không giữ tiền, không thu hộ, không cắt phần trăm.** Phụ huynh quét mã VietQR và chuyển thẳng vào tài khoản của gia sư. KiN chỉ ĐỌC tiền vào (qua SePay do gia sư tự nối) để gạch phiếu. (`page.tsx`, `PayoutTab.tsx`, `tuitionInvoice.ts` đầu tệp)
- **Chỉ tự gạch phiếu khi có mã phiếu VÀ đúng số tiền còn lại VÀ phiếu đang mở.** Mọi trường hợp khác vào hàng chờ cho gia sư bấm quyết. **Không bao giờ tự ghép theo số tiền**, chỉ gợi ý. (`tuitionInvoice.ts`: `canAutoApply`, `suggestInvoices`)
- Số tiền của phiếu được **chốt lúc lập phiếu** (tiền chốt vào sự kiện). Đổi giá lớp sau đó không đổi phiếu cũ. Sửa số tiền là thao tác riêng, có lý do, mã phiếu giữ nguyên.

Người dùng quen điện thoại (390px) nhiều nhất. Gia sư 1–20 học viên, không phải kế toán: họ cần thấy con số lớn và một nút chính, không cần bảng.

---

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)

1. **Xem tháng này còn thiếu bao nhiêu** (dải tổng + danh sách phiếu theo em, mặc định tháng hiện tại giờ Việt Nam).
2. **Lập phiếu cả lớp** cho tháng đang chọn (ra các phiếu NHÁP), rồi **Gửi phiếu nháp**.
3. **Gửi phiếu cho phụ huynh qua Zalo** (soạn sẵn tin, gia sư tự bấm gửi trong Zalo; KiN không gửi giúp) hoặc **Sao chép tin nhắn**.
4. **Ghi "Đã nhận tiền"** khi nhận tiền mặt hoặc chuyển khoản không qua SePay.
5. **Xử lý từng khoản trong hàng Chờ đối soát** (ghi nhận, ghi một phần, ghép vào phiếu, trừ vào tháng sau, ghi đã trả lại, "Không phải tiền học").
6. **Sửa số tiền** hoặc **Huỷ phiếu** (bắt buộc lý do), **Khôi phục** phiếu đã huỷ về nháp.
7. **Cài nhận tiền một lần:** lưu tài khoản ngân hàng, lấy địa chỉ webhook và khoá API dán vào SePay, xem trạng thái "Đang nối SePay".

Lối vào khác tới màn này (để thiết kế giữ đúng đích): Hộp việc có nút **Đối soát** → `/lop-cua-toi/hoc-phi?tab=doi-soat`; thông báo "cần đối soát" → cùng đích; thông báo "đã gạch phiếu" → `/lop-cua-toi/hoc-phi`; thông báo "phụ huynh báo đã chuyển" → `/lop-cua-toi/hoc-phi?phieu=<id>` (chỉ thông báo này có tham số `phieu`, và trang **bỏ qua** nó, không mở sẵn phiếu nào); lối tắt "Học phí" ở trang chủ gia sư; mục "Học phí" trên thanh module trái (module này luôn bật với gia sư, không tắt được: `userPreferences.ts`, `always: true`).

---

## 3. Dữ liệu hiển thị

Chỉ liệt kê trường THẬT có trong mã. Định dạng tiền: hàm `vnd()` = số nguyên nhóm bằng dấu chấm theo `vi-VN` + chữ `đ` dính liền, ví dụ `480.000đ` (không dấu cách trước `đ`). Tháng: `monthLabel` = `Tháng 10/2026`.

### 3.1 Khung trang

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Liên kết quay lại | `page.tsx` (chữ cố định) | chữ + mũi tên | `← Lớp của tôi` |
| Tiêu đề trang | `page.tsx` (h1) | chữ | `Học phí` |
| Mô tả dưới tiêu đề | `page.tsx` (chữ cố định) | 1–2 dòng | `Phiếu có mã riêng, tiền chuyển thẳng vào tài khoản của bạn. KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền.` |
| Số khoản chờ đối soát (đứng cạnh tên tab) | `page.tsx`: `prisma.bankTransaction.count({ tutorId, status: "pending" })`; sau đó `ReconcileTab` cập nhật bằng `pendingCount` của API | `Chờ đối soát (3)`, ẩn khi 0 | `Chờ đối soát (1)` |

### 3.2 Tab Phiếu (`InvoicesTab.tsx`, API `GET /api/tutor/invoices?yearMonth=YYYY-MM`)

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Ô chọn Tháng | `lastMonths()` trong `InvoicesTab.tsx` (12 tháng: **tháng sau**, tháng này và 10 tháng trước, giờ VN); mặc định `vnMonthKey(new Date())` | `Tháng 10/2026` | `Tháng 10/2026` |
| Số phiếu | `summary.count` (route.ts: số phiếu **không tính đã huỷ**) | số nguyên | `2` |
| Phải thu | `summary.totalDue` (tổng `amountDue`, không tính đã huỷ, **tính cả nháp**) | `vnd` | `1.040.000đ` |
| Đã thu | `summary.totalPaid` (tổng `paidAmount`) | `vnd` | `480.000đ` |
| Còn lại | `summary.totalRemaining` (tổng `remaining`) | `vnd` | `560.000đ` |
| Tên học viên | `items[].studentName` (`User.name`) | chữ đậm | `Đỗ Hà` |
| Mã phiếu | `items[].code` (`KIN` + 5 ký tự A–Z 2–9, bỏ O, I, L) | chữ đơn cách (`font-mono`), nhỏ | `KINTQF43` |
| Trạng thái phiếu | `items[].status` + `statusLabel` (`INVOICE_STATUS_LABEL`); màu theo `invoiceTone` | thẻ có chấm + chữ (`KinStatus`) | `Nháp`, `Đã gửi`, `Phụ huynh báo đã chuyển`, `Đóng một phần`, `Đã đóng`, `Đã huỷ` |
| Cảnh báo quá 24 giờ | `items[].needsBankCheck` (`parent_reported` và `parentReportedAt` quá 24 giờ) | 1 dòng đậm, màu chờ | `Quá 24 giờ chưa thấy tiền — kiểm sao kê` |
| Phải đóng | `items[].amountDue` | `vnd` đậm | `560.000đ` |
| Đã nhận | `items[].paidAmount` | `vnd` đậm | `0đ` |
| Còn lại (từng phiếu) | `items[].remaining` = `max(0, amountDue − paidAmount)` | `vnd` đậm | `560.000đ` |
| Đã mở Zalo lúc | `items[].zaloOpenedAt` (hiện khi có) | `Đã mở Zalo lúc HH:mm ngày dd/MM` giờ VN (`vnWhen`) | `Đã mở Zalo lúc 19:05 ngày 21/10` |
| Phụ huynh đã xem lúc | `items[].parentViewedAt` (hiện khi có, màu xong) | `Phụ huynh đã xem lúc HH:mm ngày dd/MM` | `Phụ huynh đã xem lúc 20:12 ngày 21/10` |
| Tiền đóng dư đã trừ | `items[].creditApplied` (`breakdown.creditApplied`, hiện khi > 0) | câu có `vnd` | `Đã trừ 80.000đ tiền đóng dư từ tháng trước.` |
| Lý do huỷ | `items[].cancelReason` (hiện khi `status = cancelled`) | `Lý do huỷ: …` | `Lý do huỷ: Em chuyển lớp` |
| Có tài khoản nhận tiền chưa | `hasPayoutAccount` (`TutorPayoutAccount` tồn tại) | điều khiển banner | (ẩn/hiện banner) |
| Danh sách "Chưa lập được cho N em" | phản hồi `POST /api/tutor/invoices` → `skipped[]` (`studentName`, `reason`) | danh sách `tên: lý do` | `Lê Minh: Chưa nhập số buổi của tháng này` |

Trường API trả về nhưng **màn hiện không hiển thị**: `sentAt`, `paidAt`, `parentReportedAt` (chỉ dùng để tính cờ), `studentId`, `qrUrl` và `transferContent` (chỉ đưa vào tin nhắn sao chép; gia sư **không thấy mã QR** trên màn này). Xem mục 12.

### 3.3 Hộp thoại trong tab Phiếu

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề Sửa số tiền | `AmountDialog`: `inv.code` | `Sửa số tiền phiếu KINTQF43` | |
| Ô số tiền (Sửa) | `inv.amountDue`, chỉ nhận chữ số | số nguyên thuần (không nhóm nghìn khi gõ) | `560000` |
| Ô lý do điều chỉnh | nhập tay, tối đa 300 ký tự | chữ; gợi ý trong ô: `Ví dụ: em vào lớp giữa tháng` | |
| Tiêu đề Ghi nhận tiền | `PayDialog`: `inv.studentName` | `Ghi nhận tiền — Đỗ Hà` | |
| Dòng hướng dẫn Ghi nhận | `inv.remaining` | câu có `vnd` | `Dùng khi nhận tiền mặt hoặc chuyển khoản không qua SePay. Còn lại 560.000đ.` |
| Số tiền đã nhận | mặc định `inv.remaining` | số nguyên thuần | `560000` |
| Phần dư | tính ở máy khách: `n − inv.remaining` khi `n > remaining` (chỉ để hiện tuỳ chọn, **việc tính tiền thật ở máy chủ**) | `Dư 80.000đ — xử lý thế nào?` | |
| Tiêu đề Huỷ phiếu | `ReasonDialog`: `inv.code` | `Huỷ phiếu KINTQF43` | |
| Tiêu đề Gửi Zalo | `ZaloDialog`: `inv.studentName` | `Gửi phiếu qua Zalo — Đỗ Hà` | |
| Tin nhắn soạn sẵn | `POST /api/tutor/invoices/[id]/zalo {action:"prepare"}` → `yearMonth`, `studentName`, `amount` (= `remaining`), `path`, `expiresAt`, `phone`; dựng bằng `privateInvoiceMessage` / `groupInvoiceMessage` | ô nhiều dòng, sửa được | xem mục 7 |
| Số điện thoại phụ huynh | `phone` (`User.parentPhone`) | chữ trong câu giải thích | `Sẽ mở Zalo của 0901234567.` |
| Link còn dùng được | `expiresAt` → `invoiceLinkDaysLeft` (link phiếu sống 30 ngày) | `Link phiếu dùng được 30 ngày nữa` | |

### 3.4 Tab Chờ đối soát (`ReconcileTab.tsx`, API `GET /api/tutor/bank-transactions?status=pending|all`)

| Tên hiển thị | Nguồn trong mã | Định dạng | Ví dụ |
|---|---|---|---|
| Số tiền khoản vào | `items[].amount` | `vnd`, cỡ lớn đậm (20px) | `560.000đ` |
| Thời điểm | `items[].occurredAt` (qua `fmtTime`: `toLocaleString("vi-VN", Asia/Ho_Chi_Minh, hour12 false)`) | `HH:mm:ss d/M/yyyy` (có giây) | `08:42:10 22/10/2026` |
| Nguồn ghi tay | `items[].provider === "manual"` | hậu tố ` · ghi tay` | |
| Loại khoản (khoản đang chờ) | `items[].kind` + `kindLabel` (`TX_KIND_LABEL`) | thẻ chữ | `Khớp đủ`, `Đóng thiếu`, `Đóng dư`, `Phiếu đã đóng — có thể chuyển trùng`, `Phiếu đã huỷ`, `Mã không thuộc gia sư này`, `Không có mã` |
| Kết quả xử lý (khoản đã xử lý) | `items[].resolution` qua bảng `RESOLUTION` | thẻ chữ màu xong | `Tự gạch phiếu`, `Đã ghi nhận vào phiếu`, `Trừ vào tháng sau`, `Đã trả lại`, `Gia sư ghép tay`, `Tiền mặt`, `Không phải tiền học`, dự phòng `Đã xử lý` |
| Nội dung chuyển khoản | `items[].content` | chữ đơn cách, xuống dòng được | `CK HOC PHI CHO CON`; rỗng thì `(không có nội dung)` |
| Phiếu đã gắn | `items[].invoice` (`code`, `studentName`, `yearMonth`, `remaining`, `amountDue`) | 1 câu | `Phiếu KINTQF43 · Đỗ Hà · Tháng 10/2026 · còn lại 560.000đ / 560.000đ` |
| Gợi ý phiếu cùng số tiền | `items[].suggestions[]` (chỉ khi `kind` là `no_code` hoặc `unknown_code`) | từng dòng `tên · tháng · mã` | `Đỗ Hà · Tháng 10/2026 · KINTQF43` |

Không hiển thị: `provider` (ngoài dấu "ghi tay"), `matchedCode`, `appliedAmount`, `status`.

### 3.5 Hộp thoại "Ghép vào phiếu" (`PickInvoice`, gọi `GET /api/tutor/invoices` không lọc, lấy phiếu **chưa đóng đủ và chưa huỷ**)

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề | `tx.amount` | `Ghép 560.000đ vào phiếu` | |
| Dòng phiếu | `studentName`, `yearMonth`, `code`, `remaining` | `tên · tháng · mã` + dòng nhỏ `Còn lại …` | `Đỗ Hà · Tháng 10/2026 · KINTQF43` / `Còn lại 560.000đ` |
| Phần dư | `tx.amount − chosen.remaining` | `Khoản này dư 40.000đ so với phần còn lại — xử lý thế nào?` | |

### 3.6 Tab Nhận tiền (`PayoutTab.tsx`, API `GET /api/tutor/payout-account`)

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Ngân hàng | `account.bankBin`; danh sách `BANKS` (20 ngân hàng + `Ngân hàng khác (nhập mã BIN)`); mặc định `970436` | ô chọn | `Vietcombank` |
| Mã BIN (6 số) | chỉ hiện khi chọn "khác" | 6 chữ số | |
| Số tài khoản | `account.accountNo` (bỏ khoảng trắng, 6–19 chữ số) | chữ đơn cách | `0123456789` |
| Tên chủ tài khoản | `account.accountName` (máy chủ đổi thành IN HOA không dấu, 2–50 chữ cái) | chữ | `NGUYEN THI LAN` |
| Địa chỉ webhook | `webhookUrl` = `<NEXT_PUBLIC_APP_URL hoặc origin>/api/webhooks/sepay/<tutorId>` | ô chỉ đọc, chữ đơn cách nhỏ | |
| Khoá API vừa tạo | `key` trả về **một lần** (`kin_` + 48 ký tự hex) | ô chỉ đọc, nhãn `Khoá API mới` | |
| Đuôi khoá đã có | `account.keyHint` (4 ký tự cuối); `hasKey` | `Đã có khoá (đuôi …ab12)` | |
| Trạng thái nối SePay | `account.seenAt` (`webhookSeenAt`) | `Đang nối SePay (từ d/M/yyyy)` (`toLocaleDateString("vi-VN")`, **không đệm số 0**: ngày 5/10 hiện `5/10/2026`) hoặc `Chưa nhận giao dịch nào` | `Đang nối SePay (từ 11/10/2026)` |
| Đếm gói miễn phí | `sepay.monthCount`, `sepay.freeLimit` (50), `sepay.warn` (≥ 40) | câu | `Tháng này đã nhận 12/50 giao dịch qua SePay.` |

---

## 4. Bố cục đề xuất

Tinh thần: **thoáng, ít dòng, ít khung, ít màu.** Bản hiện tại bọc từng phiếu, từng ô tổng, từng khoản chờ trong khung viền riêng (xem ảnh `anh-hien-trang/4-hoc-phi-hien-tai.jpg`); bản đề xuất bỏ khung thẻ, dùng đường kẻ mảnh `--kin-vien-nhat` giữa các hàng, và chỉ để màu ở những chỗ có nghĩa (cam = còn nợ/chờ, xanh lá = đã thu/xong, đỏ = chỉ khi sai thật). Chỉ dùng token `--kin-*`, không mã hex.

Khung ngoài (không đổi): trang nằm trong vỏ gia sư (thanh module trái 79px trên máy tính, người dùng thu gọn được về 0 hoặc mở rộng 220px; trên điện thoại có dải trên 48px và thanh module dưới 60px; vỏ `TutorShell` đã tự chừa `pb-[60px]` ở đáy trên điện thoại nên thiết kế chỉ cần giữ khoảng đệm cuối trang đủ cho nút cuối, không phải tự cộng thêm chiều cao thanh dưới). Nội dung hiện đặt trong cột giữa `max-w-4xl` (896px), lề ngang 16px.

### 4.1 Điện thoại 390px (một cột, lề 16px, vùng nội dung 358px)

**Thứ tự chung cho mọi tab (từ trên xuống):**

1. **Dòng quay lại** `← Lớp của tôi` (chữ phụ, vùng chạm 44px) rồi **h1 `Học phí`** (một dòng). Mô tả dưới h1 rút còn **một dòng ngắn**: `KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền.` (nửa câu đầu "Phiếu có mã riêng, tiền chuyển thẳng vào tài khoản của bạn" có thể dời xuống đầu tab Nhận tiền; xem mục 12 câu 1).
2. **Dải 3 tab** (`KinTabs`): `Phiếu` · `Chờ đối soát (n)` · `Nhận tiền`. Cao 44px, gạch chân trượt màu nhấn. Số `(n)` đổi sang màu "chờ" (`--kin-tt-chu-cho`) khi n > 0; **vẫn giữ dấu ngoặc và dấu cách trong chữ** (bài test tìm `Chờ đối soát (3)`). Đủ rộng cho 3 tab ở 390px, không cuộn ngang.

**Tab Phiếu:**

3. **Hàng điều khiển tháng:** một ô chọn `Tháng` rộng đầy (cao ≥ 44px), nhãn nhỏ phía trên. Không để nút nào cạnh ô này.
4. **Dải tổng, bỏ khung:** hai hàng.
   - Hàng 1: nhãn nhỏ `Còn lại` và **con số `560.000đ` rất lớn (cỡ h2 27,6px), màu `--kin-tt-chu-cho` khi > 0, màu `--kin-tt-chu-xong` khi = 0**. Đây là thứ to nhất màn.
   - Hàng 2: ba cặp nhỏ nằm ngang, không khung, ngăn bằng khoảng trắng: `Phải thu 1.040.000đ` · `Đã thu 480.000đ` (xanh lá) · `Số phiếu 2`. Nếu 390px chật thì xếp 2 + 1; **không cắt chữ "…", không viết tắt**.
5. **Nút chính của màn, toàn chiều ngang, cao ≥ 44px:** `Lập phiếu cả lớp`. Khi có phiếu nháp, hiện thêm nút `Gửi {n} phiếu nháp` ngay dưới (cùng bề rộng). **Khi có nháp, đổi độ nổi: `Gửi {n} phiếu nháp` là nút đặc, `Lập phiếu cả lớp` thành nút viền** (chỉ đổi vẻ ngoài, hành vi giữ nguyên); khi không có nháp thì `Lập phiếu cả lớp` là nút đặc. Luôn chỉ một nút đặc trong vùng này.
6. **Banner có điều kiện** (hai khối **độc lập, có thể hiện cùng lúc**, (a) đứng trước (b); không được ẩn (b) khi (a) đang hiện, vì (b) là kết quả của thao tác vừa bấm và nói vì sao một em không có phiếu): (a) thiếu tài khoản nhận tiền: **một hàng** nền `--kin-tt-nen-cho`, chữ `Bạn chưa lưu tài khoản nhận tiền nên phiếu chưa có mã QR.` + liên kết `Cài đặt nhận tiền →`; (b) danh sách `Chưa lập được cho N em` hiện dạng danh sách chữ thường, không khung đậm, nút `Ẩn` ở góc.
7. **Danh sách phiếu: hàng, không phải thẻ khung.** Mỗi phiếu là một `<li>` cao dần theo nội dung, ngăn bằng đường kẻ mảnh:
   - **Dòng 1:** trái = tên học viên (16px, đậm, được xuống dòng, không cắt); phải = **số `Còn lại` lớn đậm** (cam khi > 0, xanh lá khi 0; **phiếu `Đã huỷ` thì số này mờ/trung tính, không cam**, vì máy chủ không tính phiếu huỷ vào dải tổng nhưng vẫn trả `remaining` = phải đóng − đã nhận cho phiếu đó).
   - **Dòng 2:** trái = mã phiếu chữ đơn cách nhỏ (`KINTQF43`); phải = **thẻ trạng thái chấm + chữ**.
   - **Dòng 3 (chữ phụ 13,3px, một dòng):** `Phải đóng 560.000đ · Đã nhận 0đ`. (Thay cho ba cột nhãn–số lặp lại ở mọi thẻ như bản cũ.)
   - **Dòng 4 (chỉ khi có):** `Quá 24 giờ chưa thấy tiền — kiểm sao kê` (đậm, màu chờ); `Đã mở Zalo lúc … ngày …`; `Phụ huynh đã xem lúc … ngày …` (xanh lá); `Đã trừ … tiền đóng dư từ tháng trước.`; `Lý do huỷ: …`. Mỗi thông tin một dòng riêng (xem ràng buộc ở mục 7 về dòng Zalo).
   - **Hàng nút, xếp theo độ ưu tiên, mỗi nút cao ≥ 44px:**
     - Hàng A (toàn chiều ngang, nút đặc duy nhất của phiếu): `Gửi phiếu` nếu nháp; `Gửi phiếu qua Zalo` / `Gửi lại qua Zalo` nếu đã gửi / phụ huynh báo / một phần; `Khôi phục` (viền) nếu đã huỷ; **không có nút đặc** nếu đã đóng.
     - Hàng B (hai nút viền chia đôi): `Đã nhận tiền` | `Sao chép tin nhắn` (đủ trạng thái đã gửi / phụ huynh báo / một phần). Nháp chỉ có `Sao chép tin nhắn`.
     - Hàng C (hai nút ghost, chữ xám, trái–phải): `Sửa số tiền` · `Huỷ phiếu` (đúng điều kiện hiện nút hiện có).
   - Khoảng cách giữa các nút ≥ 8px; giữa hai phiếu ≥ 16px.
   - **"Thoáng" ở đây đến từ bỏ khung viền, bỏ lưới 3 cột nhãn–số và chỉ còn một nút đặc, không đến từ việc ít nút hơn.** Ba hàng nút vẫn chiếm tối thiểu 3 × 44px + 2 × 8px = 148px mỗi phiếu đã gửi (bản hiện nay cũng xếp 5 nút bằng `flex-wrap` nên thường xuống 2–3 hàng ở 390px; chưa đo chiều cao thật của hai bản). Muốn danh sách ngắn hơn nữa thì phải gộp nút, đó là mục 12 câu 4, không tự làm. Nếu thiết kế thấy ba hàng nút vẫn nặng thì không được bỏ nút hay hạ vùng chạm dưới 44px; chỉ chỉnh được khoảng cách (≥ 8px) và độ nổi.
8. **Trạng thái chờ / lỗi / rỗng** thay cho mục 5–7: xem mục 6.

**Tab Chờ đối soát:**

3. **Một dòng hướng dẫn** chữ phụ: `KiN chỉ tự gạch phiếu khi đúng mã và đúng số tiền còn lại. Các khoản dưới đây cần bạn quyết.`
4. **Công tắc** `Hiện cả khoản đã xử lý` (hộp chọn, hàng cao 44px) đặt ngay dưới dòng hướng dẫn, không nằm cạnh nó.
5. **Danh sách khoản vào, mỗi khoản một hàng:**
   - Dòng 1: trái = **số tiền lớn đậm** (20px); phải = thẻ loại (`Đóng thiếu`…) hoặc kết quả (`Tự gạch phiếu`…).
   - Dòng 2: thời điểm (chữ phụ nhỏ).
   - Dòng 3: nội dung chuyển khoản, chữ đơn cách, xuống dòng được.
   - Dòng 4 (nếu có phiếu gắn): `Phiếu KINTQF43 · Đỗ Hà · Tháng 10/2026 · còn lại … / …`.
   - Khối gợi ý (nếu có): **không dùng viền nét đứt đậm**; chỉ một dòng nhãn chữ phụ `Gợi ý: phiếu chưa đóng có cùng số tiền (KiN không tự ghép)` rồi từng dòng `tên · tháng · mã` kèm nút viền `Ghép vào phiếu này` (cao ≥ 44px, cùng kiểu cho mọi gợi ý; **không tô nổi hay đặt sẵn gợi ý nào**).
   - Hàng nút theo loại khoản: **giữ đúng nút đặc và thứ tự nút hiện có ở từng loại** (bảng mục 5.3: nút đầu tiên của loại đó là nút đặc, nút viền kế tiếp, `Không phải tiền học` là ghost cuối hàng). Không đổi nút nào thành nổi hơn nút khác: `Trừ vào tháng sau` và `Ghi đã trả lại` là hai cách ghi sổ khác nhau, chọn nhầm là ghi sai (mục 5.2). Loại `no_code` và `unknown_code` hiện **không có nút đặc** (chỉ `Ghép vào phiếu…` viền và ghost) và phải giữ vậy, vì KiN không được ưu tiên hộ phiếu nào.
6. Khoản đã xử lý (khi bật công tắc) hiển thị mờ hơn (chữ phụ), không nút.

**Tab Nhận tiền:** hai phần cách nhau bằng khoảng trắng lớn, không bọc khung (mỗi phần có h2).

3. **Phần "Tài khoản nhận học phí"** (h2): một câu chữ phụ (`Mã VietQR trên phiếu trỏ thẳng vào tài khoản này. KiN không giữ tiền, không thu hộ và không cắt phần trăm.`), rồi các ô **xếp một cột**: `Ngân hàng` (ô chọn), `Số tài khoản`, `Tên chủ tài khoản (in hoa, không dấu — đúng như ngân hàng)`; nút `Lưu tài khoản` toàn chiều ngang.
4. **Phần "Tự gạch phiếu khi tiền vào (SePay)"** (h2): **dòng trạng thái lên đầu** (`Chưa nhận giao dịch nào` hoặc `Đang nối SePay (từ …)` + đếm `x/50`), rồi `Địa chỉ webhook của bạn` (ô chỉ đọc + `Sao chép`), rồi khối `Khoá API`, **bốn bước hướng dẫn thu gọn** trong một mục bấm mở (chữ `Cách nối SePay`) để màn không dài; xem ràng buộc ở mục 7.

### 4.2 Máy tính 1280px

Vỏ gia sư giữ nguyên. Nội dung một cột, **rộng tối đa 720–896px canh giữa** (hiện 896px), không kéo giãn hết 1200px. Thứ tự vùng giống điện thoại, khác ở:

- **Dải tổng nằm một hàng ngang:** bên trái `Còn lại` + số lớn; bên phải ba số nhỏ `Phải thu` · `Đã thu` · `Số phiếu` canh phải.
- **Hàng điều khiển một dòng:** ô chọn `Tháng` trái, các nút `Gửi {n} phiếu nháp` và `Lập phiếu cả lớp` canh phải (nút đặc theo quy tắc ở 4.1 bước 5), nút không còn full-width.
- **Phiếu là hàng ngang có tiêu đề cột một lần ở đầu danh sách** (`Học viên`, `Phải đóng`, `Đã nhận`, `Còn lại`, `Trạng thái`), thay vì lặp nhãn từng phiếu; nút của phiếu nằm bên phải cùng hàng (nút đặc, hai nút viền, hai nút ghost tách hai nhóm). Vẫn là `<ul><li>`; **không** dùng `<table>` (bài test đếm phần tử `li`).
- **Hàng chờ đối soát:** số tiền trái, loại giữa, hành động phải; nội dung chuyển khoản một dòng riêng ngay dưới.
- **Nhận tiền:** hai phần xếp **hai cột** (tài khoản trái, SePay phải) nếu đủ rộng, nếu không thì một cột như điện thoại; **không dùng bố cục 2 cột cứng của đối thủ.**
- **Hộp thoại**: hộp giữa màn hình rộng 448px (`max-w-md` hiện có), không kéo to.

### 4.3 Hộp thoại (mọi kích cỡ)

Điện thoại (dưới 640px, breakpoint `sm` của `Modal`): tờ trượt từ đáy (hiện `Modal`: `rounded-t-2xl`, tối đa 90vh, cuộn trong). Máy tính: giữa màn hình. Nền tối phía sau `rgba(15,23,42,0.5)` (hiện có). **Chân hộp thoại cố định** với hai nút: ghost `Đóng` bên trái, nút đặc hành động bên phải (cao ≥ 44px). Ngoại lệ có thật trong mã: hộp `Gửi phiếu qua Zalo` có **ba** nút (`Đóng`, `Sao chép`, `Mở Zalo`); hộp `Ghép … vào phiếu` ở bước chọn phiếu chỉ có `Đóng`, còn bước xác nhận **không có `Đóng`** mà có `← Chọn phiếu khác` và `Ghép vào phiếu` (hiện chỉ thoát được bằng Esc hoặc bấm nền, nên nút ✕ ở đây có ích thật). Tiêu đề h2. Nút ✕ góc phải là đề xuất mới, xem ràng buộc ở mục 7.

---

## 5. Hành động

### 5.1 Khung trang và tab Phiếu

| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| `← Lớp của tôi` | Quay lại danh sách lớp | Liên kết `/lop-cua-toi` | Không rủi ro |
| Tab `Phiếu` / `Chờ đối soát` / `Nhận tiền` | Đổi nội dung tab; thanh địa chỉ đổi bằng `history.replaceState` (`/lop-cua-toi/hoc-phi` hoặc `?tab=doi-soat` / `?tab=nhan-tien`) | Không gọi API ngay; mỗi tab tự tải dữ liệu khi hiện (tab không hiện thì **bị gỡ khỏi DOM**, không chỉ ẩn: rời tab `Phiếu` rồi quay lại thì ô `Tháng` về tháng hiện tại, khối `Chưa lập được cho N em` mất, dữ liệu tải lại từ đầu) | **Không dùng `<Link>` tới cùng đường dẫn khác query** (đo được bị huỷ giữa chừng 4/10 lần, `docs/kin/nhung-cho-de-sai.md` mục 1) |
| Ô chọn `Tháng` | Đổi tháng đang xem, tải lại danh sách | `GET /api/tutor/invoices?yearMonth=YYYY-MM` | Kết quả cũ bị bỏ khi đổi tháng nhanh (`seq`). Nếu thiết kế thêm nút "tháng trước/sau" thì phải là nút có state, không phải `<Link>` |
| `Lập phiếu cả lớp` | Lập phiếu NHÁP cho mọi học viên đang học của gia sư trong tháng đang chọn; số tiền chốt ngay lúc lập | `POST /api/tutor/invoices` body `{ yearMonth }` | Tiền. Trùng phiếu/chưa nhập số buổi/số phải đóng 0đ thì **bỏ qua** và liệt kê ở khối "Chưa lập được cho N em". Toast `Đã lập N phiếu nháp. Kiểm tra rồi bấm Gửi.` hoặc `Không có phiếu mới để lập.`; lỗi: `Không lập được phiếu` (hoặc thông điệp máy chủ). Chữ `N` đếm **mọi phiếu vừa lập**, kể cả phiếu được lập thẳng ở trạng thái `Đã đóng` vì tín dụng trừ hết (mục 6.2), nên có thể lớn hơn số phiếu thật sự là `Nháp` |
| `Gửi {n} phiếu nháp` (chữ ví dụ `Gửi 3 phiếu nháp`) | Gửi lần lượt từng phiếu nháp (phụ huynh/học viên bắt đầu thấy phiếu) | Với mỗi nháp: `PATCH /api/tutor/invoices/[id]` `{ action: "send" }` | Không hỏi xác nhận. Lỗi từng phiếu bị nuốt, chỉ đếm: toast `Đã gửi X/N phiếu.`, **luôn ở sắc thái thành công (xanh) kể cả khi X = 0** (ví dụ `Đã gửi 0/3 phiếu.` khi cả ba lỗi). Thiết kế không được tự đổi sắc thái toast; đây là điểm chờ duyệt ở mục 12 câu 20 |
| `Cài đặt nhận tiền →` | Chuyển sang tab Nhận tiền | Không gọi API | Chỉ hiện khi chưa lưu tài khoản nhận tiền |
| `Ẩn` (nhãn truy cập `Ẩn danh sách bỏ qua`) | Đóng khối "Chưa lập được cho N em" | Không gọi API | |
| `Thử lại` (khi lỗi tải) | Tải lại danh sách phiếu | `GET /api/tutor/invoices?yearMonth=…` | |
| `Gửi phiếu` (chỉ phiếu `draft`) | Đổi `draft → sent` | `PATCH …/[id]` `{ action: "send" }` | Toast `Đã gửi phiếu.` |
| `Đã nhận tiền` (phiếu `sent`, `parent_reported`, `partial`) | Mở hộp thoại **Ghi nhận tiền** | Không gọi API ngay | Tiền; xem 5.2 |
| `Gửi phiếu qua Zalo` / `Gửi lại qua Zalo` (khi đã có `zaloOpenedAt`) | Mở hộp thoại **Gửi phiếu qua Zalo** | Không gọi API ngay (hộp thoại tự gọi `…/[id]/zalo`) | Chỉ phiếu `sent`, `parent_reported`, `partial` |
| `Sao chép tin nhắn` (phiếu nháp **và** các phiếu đã gửi) | Chép vào bộ nhớ tạm tin: `KiN — học phí tháng M/YYYY của {tên}: {còn lại}.` (tháng viết cả năm, ví dụ `tháng 10/2026`, vì mã dùng `monthLabel(...).toLowerCase()`) + dòng `Quét mã QR: {qrUrl}` (chỉ có khi gia sư đã lưu tài khoản nhận tiền và phiếu còn tiền phải thu) + `Hoặc chuyển khoản với nội dung: {nội dung CK}` + `Anh/chị giữ nguyên mã {mã} ở đầu nội dung để hệ thống ghi nhận đúng. Cảm ơn anh/chị!` | Không gọi API (dùng dữ liệu đã tải) | Toast `Đã sao chép tin nhắn — dán vào Zalo gửi phụ huynh.` hoặc `Không sao chép được, hãy thử lại.` |
| `Sửa số tiền` (phiếu **chưa** `paid`, **chưa** `cancelled`) | Mở hộp thoại **Sửa số tiền** | Không gọi API ngay | Tiền; xem 5.2 |
| `Huỷ phiếu` (mọi phiếu **chưa** `cancelled`, kể cả đã đóng) | Mở hộp thoại **Huỷ phiếu** (bắt buộc lý do) | Không gọi API ngay | **Rủi ro cao:** nút cũng hiện trên phiếu đã đóng; tiền đã ghi (`paidAmount`) vẫn nằm đó trong dữ liệu, nhưng phiếu huỷ **không còn được cộng vào dải tổng** (`Phải thu`, `Đã thu`, `Còn lại`, `Số phiếu` đều bỏ phiếu huỷ), nên huỷ một phiếu đã đóng làm `Đã thu` của tháng tụt đi đúng số đó. Xem mục 12 câu 5 |
| `Khôi phục` (phiếu `cancelled`) | Đưa phiếu về `draft`, xoá lý do huỷ | `PATCH …/[id]` `{ action: "restore" }` | Toast `Đã khôi phục phiếu về nháp.` Luôn về `Nháp`, kể cả phiếu từng đóng đủ (máy chủ không trả về `Đã đóng`, không xoá `paidAmount`) |

### 5.2 Hộp thoại của tab Phiếu

| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| **Sửa số tiền:** `Đóng` | Đóng, không lưu | — | |
| **Sửa số tiền:** `Lưu` | Đổi `amountDue` của phiếu; mã phiếu **không đổi**; lý do hiện trên phiếu phụ huynh | `PATCH …/[id]` `{ action: "set_amount", amountDue, reason }` | Tiền. Khoá khi số tiền không phải số nguyên ≥ 0 hoặc lý do trống. Máy chủ từ chối nếu phiếu đã đóng đủ/đã huỷ. Toast `Đã cập nhật số tiền. Mã phiếu giữ nguyên.` **Hệ quả máy chủ tự làm, hộp thoại không cảnh báo:** nếu số mới ≤ `paidAmount` (kể cả nhập `0` với phiếu chưa nhận đồng nào) thì phiếu **tự thành `Đã đóng`**, kể cả khi đang là `Nháp` chưa từng gửi. Nhãn hai ô là `Số tiền phải đóng (đ)` và `Lý do điều chỉnh`. Xem mục 12 câu 19 |
| **Huỷ phiếu:** `Đóng` | Đóng, không huỷ | — | |
| **Huỷ phiếu:** `Huỷ phiếu` (nút đỏ) | Huỷ, lưu lý do (≤ 300 ký tự) | `PATCH …/[id]` `{ action: "cancel", reason }` | Khoá khi lý do trống. Nên dùng biến thể `danger-solid` của `KinButton` thay cho style tay (mã hiện tại vẫn tô đỏ bằng `style` có `--kin-tt-chu-loi` trong `ReasonDialog`; bài `t-kin-components.ts` không bắt được vì nó chỉ tìm `style={{…}}`, còn mã này dùng biểu thức điều kiện. Thiết kế mới không được lặp lại kiểu đó). Toast `Đã huỷ phiếu.` |
| **Ghi nhận tiền:** `Đóng` | Đóng, không ghi | — | |
| **Ghi nhận tiền:** radio `Trừ vào tháng sau` / `Đã trả lại phụ huynh` | Chỉ hiện khi số nhập lớn hơn phần còn lại; mặc định `Trừ vào tháng sau` | Đi kèm trường `excess: "credit" \| "refunded"` | Tiền. Chọn nhầm = ghi sai sổ |
| **Ghi nhận tiền:** `Ghi nhận` | Ghi khoản tiền mặt/chuyển khoản ngoài SePay vào phiếu | `PATCH …/[id]` `{ action: "record_payment", amount, excess? }` | **Tiền, không có hoàn tác.** Khoá khi số không phải số nguyên > 0. Toast `Đã ghi nhận tiền.` |
| **Gửi Zalo:** radio `Chat riêng với phụ huynh` / `Nhóm Zalo lớp` | Đổi đích; soạn lại tin | `POST …/[id]/zalo` `{ action: "prepare", target }` | Nhóm = tin chung, **không** số tiền, link, tên con |
| **Gửi Zalo:** ô `Tin nhắn (sửa được trước khi gửi)` | Gia sư sửa tin | — | |
| **Gửi Zalo:** `Đóng` | Đóng | — | |
| **Gửi Zalo:** `Sao chép` | Chép tin đang soạn | Không gọi API | Toast `Đã sao chép tin.` / `Không sao chép được.` |
| **Gửi Zalo:** `Mở Zalo` | Điện thoại có bảng chia sẻ: mở bảng đó; máy tính: chép tin rồi mở `zalo.me/<số>` hoặc `chat.zalo.me`; nếu là chat riêng thì ghi "đã mở Zalo" | `POST …/[id]/zalo` `{ action: "opened" }` (chỉ chat riêng) | **KiN chỉ biết đã MỞ Zalo, không biết tin có đi không**, nên không bao giờ hiện chữ "đã gửi qua Zalo". Toast: `Chọn Zalo trong bảng chia sẻ rồi bấm gửi.` / `Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.`; lỗi `Không mở được Zalo. Hãy chép tin và gửi tay.` / `Đã mở Zalo nhưng chưa ghi lại được.` **Hộp thoại tự đóng sau khi mở được Zalo** (và danh sách tải lại để hiện `Đã mở Zalo lúc …`). Nếu người dùng bỏ bảng chia sẻ trên điện thoại thì không có toast, không ghi gì, hộp thoại ở yên mở |

### 5.3 Tab Chờ đối soát

| Nhãn nút CHÍNH XÁC | Hiện khi (loại khoản đang chờ) | Làm gì | API | Ghi chú |
|---|---|---|---|---|
| Hộp chọn `Hiện cả khoản đã xử lý` | luôn | Đổi giữa chỉ khoản đang chờ và tất cả (tối đa 200 dòng) | `GET /api/tutor/bank-transactions?status=pending` hoặc `status=all` | |
| `Thử lại` | khi lỗi tải | Tải lại | như trên | |
| `Ghi nhận một phần` | `short` (Đóng thiếu) | Cộng khoản này vào phiếu đã gắn; phiếu thành `partial` | `POST /api/tutor/bank-transactions/[id]/resolve` `{ action: "apply" }` | Tiền. Toast `Đã ghi nhận một phần.` |
| `Soạn tin nhắc phần còn lại` | `short` | Chép tin `KiN — {tên} đã chuyển {số tiền} cho học phí tháng M/YYYY (ví dụ `tháng 10/2026`). Còn thiếu {còn thiếu}, anh/chị chuyển giúp với nội dung {mã}. Cảm ơn anh/chị!` | Không gọi API | Toast `Đã sao chép tin nhắc phần còn lại.` `{còn thiếu}` = phần còn lại của phiếu trừ khoản này, **trừ ngay ở máy khách chỉ để soạn chữ**; không ghi vào đâu, không phải số của máy chủ. Thiết kế không được dùng phép trừ đó để hiện số mới ở chỗ khác |
| `Ghi nhận` | `exact` (Khớp đủ; thường là phiếu còn nháp) | Cộng đủ, phiếu thành `paid` | `…/resolve` `{ action: "apply" }` | Tiền. Toast `Đã ghi nhận, phiếu đã đóng.` |
| `Trừ vào tháng sau` | `over`, `already_paid`, `cancelled` | Phần dư thành tín dụng trừ vào phiếu tháng sau | `…/resolve` `{ action: "credit_next_month" }` | Tiền. Toast `Đã ghi: trừ vào tháng sau.` |
| `Ghi đã trả lại` | `over`, `already_paid`, `cancelled` | Ghi rằng phần dư đã trả lại phụ huynh ngoài hệ thống | `…/resolve` `{ action: "refunded" }` | Tiền, chỉ ghi sổ. Toast `Đã ghi: đã trả lại.` |
| `Ghép vào phiếu…` | `no_code`, `unknown_code`, `already_paid`, `cancelled` | Mở hộp thoại chọn phiếu | Không gọi API ngay | **Không** hiện ở `short`, `exact`, `over` |
| `Ghép vào phiếu này` (từng gợi ý) | `no_code`, `unknown_code` có gợi ý | Ghép khoản vào đúng phiếu gợi ý | `…/resolve` `{ action: "match_invoice", invoiceId }` | Không tự ghép; gia sư bấm từng cái. Toast `Đã ghép vào phiếu.` |
| `Không phải tiền học` | mọi khoản đang chờ | Ẩn khoản khỏi hàng chờ, **không xoá** | `…/resolve` `{ action: "not_tuition" }` | Toast `Đã ẩn khoản này (không xoá).` |

Hộp thoại **Ghép … vào phiếu** (`PickInvoice`): ô tìm (`Tìm theo tên em hoặc mã phiếu…`, nhãn ẩn `Tìm phiếu`; so khớp tên không phân biệt hoa thường nhưng **có phân biệt dấu**, gõ `do ha` không ra `Đỗ Hà`; so khớp mã là chứa chuỗi viết hoa); danh sách gồm mọi phiếu chưa `Đã đóng` và chưa `Đã huỷ` **kể cả phiếu `Nháp`**, mọi tháng; mỗi phiếu là một nút cả hàng; nút `Đóng` (chỉ ở bước chọn phiếu); sau khi chọn: radio dư (`Trừ vào tháng sau` / `Đã trả lại phụ huynh`), nút `← Chọn phiếu khác` (ghost, trái) và `Ghép vào phiếu` (đặc, phải) → `…/resolve` `{ action: "match_invoice", invoiceId, excess? }`. Mọi `resolve` đều khoá bằng "nhận khoản" có điều kiện: hai lần bấm cùng lúc chỉ một lần thành công; lần sau trả `Khoản này đã được xử lý`.

Mỗi lần `resolve` xong, danh sách tải lại và số `(n)` trên tab cập nhật.

### 5.4 Tab Nhận tiền

| Nhãn nút CHÍNH XÁC | Làm gì | API | Ghi chú |
|---|---|---|---|
| Ô chọn `Ngân hàng` | Chọn một trong 20 ngân hàng hoặc `Ngân hàng khác (nhập mã BIN)` | — | Chọn "khác" thì hiện ô `Mã BIN (6 số)` |
| `Lưu tài khoản` | Lưu ngân hàng + số tài khoản + tên chủ tài khoản | `PUT /api/tutor/payout-account` | Tiền (đích nhận tiền của mọi phiếu). Toast `Đã lưu tài khoản nhận tiền.`; lỗi từ máy chủ ví dụ `Số tài khoản gồm 6–19 chữ số` |
| `Sao chép` (cạnh địa chỉ webhook) | Chép địa chỉ webhook | Không gọi API | Toast `Đã sao chép địa chỉ webhook.` |
| `Tạo khoá API` (chưa có khoá) / `Tạo khoá mới` (đã có) | Cấp khoá cho SePay gửi kèm webhook; hiện bản rõ **một lần** | `POST /api/tutor/payout-account/webhook-key` | **Tạo lại = khoá cũ chết ngay**, và trạng thái "Đang nối SePay" về lại "Chưa nhận giao dịch nào" cho tới khi SePay gửi giao dịch mới. **Không hỏi xác nhận**: bấm `Tạo khoá mới` là khoá đang dán ở SePay chết ngay, tiền vào sau đó trả 401 cho tới khi dán khoá mới (xem mục 12 câu 3). Chưa lưu tài khoản thì máy chủ trả `Hãy lưu tài khoản nhận tiền trước khi lấy khoá`, nhưng giao diện chỉ hiện nút này khi đã có tài khoản nên lỗi đó gần như không gặp. Khoá chỉ hiện trong ô `Khoá API mới` **một lần ở lần bấm này**; tải lại trang là mất (chỉ còn đuôi 4 ký tự) |
| `Sao chép` (cạnh khoá mới) | Chép khoá | Không gọi API | Toast `Đã sao chép khoá API.` |
| `Tôi đã lưu khoá, ẩn đi` | Giấu ô khoá vừa tạo | Không gọi API | Sau khi ẩn không xem lại được (máy chủ chỉ lưu băm) |
| `Thử lại` | Tải lại cài đặt | `GET /api/tutor/payout-account` | |

---

## 6. Trạng thái

Mọi chuỗi trong dấu ` dưới đây lấy nguyên văn từ mã.

### 6.1 Chung
- **Truy cập:** chưa đăng nhập, học sinh, quản trị không phải gia sư: **chuyển trang** (không có màn nào để thiết kế), xem dòng đầu tệp.
- **Mất mạng / máy chủ lỗi khi gọi nút:** toast lỗi `Lỗi kết nối, thử lại sau` (từ `callApi`), hoặc thông điệp `error` của máy chủ. Toast hiện ở **đầu màn hình** (cố định `top-4`; điện thoại kín ngang trừ lề 16px, máy tính rộng 400px ở góc phải; `z-[200]` nên nằm trên hộp thoại `z-[150]`).
- **Nút đang chạy:** `KinButton loading` khóa nút, `aria-busy`, **không vòng xoay** (Figma dùng chữ, không spinner). Tab Phiếu chỉ có **một** biến `busy` chung cho cả danh sách (một chỗ chứa id phiếu đang chạy hoặc `issue` / `send-all`), không phải mỗi phiếu một biến: nút của phiếu đang chạy bị khoá, nút của phiếu khác vẫn bấm được và bấm vào sẽ **ghi đè** biến này (khoá của phiếu trước nhả sớm). Hộp thoại ghi tiền (`Lưu`, `Ghi nhận`, `Huỷ phiếu`, `Ghép vào phiếu`) có `busy` riêng trong hộp, khoá suốt lúc gọi, và là chỗ chống bấm đúp thật sự cho thao tác tiền. Ở tab Chờ đối soát, mọi nút có `loading` của **cùng một khoản** khoá cùng lúc; `Soạn tin nhắc phần còn lại` và `Ghép vào phiếu…` không có `loading`.

### 6.2 Tab Phiếu
| Trạng thái | Hiện thế nào | Chữ chính xác |
|---|---|---|
| Đang tải (mở lần đầu) | Ba thanh xám nhấp nháy cao 80px (`aria-busy`); dải tổng chưa có nên không hiện | không chữ |
| Đang tải (đổi tháng, hoặc tải lại sau mỗi thao tác) | Danh sách thành ba thanh xám, nhưng **dải tổng của lần tải trước vẫn đang hiện** (mã chỉ ẩn dải tổng khi lỗi, không ẩn khi đang tải). Nghĩa là trong lúc chờ, số của tháng cũ đứng cạnh ô `Tháng` đã đổi sang tháng mới. Thiết kế nên làm mờ hoặc thay dải tổng bằng thanh xám trong lúc `loading` để số cũ không đứng cạnh nhãn tháng mới (chỉ là trình bày, không đổi dữ liệu) | không chữ |
| Lỗi tải | Khối giữa màn có chữ + nút `Thử lại` (role `alert`) | `Không tải được danh sách phiếu.` |
| Rỗng | Khối nét đứt, chữ phụ giữa (role `status`) | `Chưa có phiếu nào cho Tháng 10/2026. Nhập số buổi của lớp (ở trang quản khoá) rồi bấm “Lập phiếu cả lớp”.` |
| Bình thường | Dải tổng + danh sách phiếu | |
| Thiếu tài khoản nhận tiền (đã tải xong) | Banner cam (hiện nay role `alert`) | `Bạn chưa lưu tài khoản nhận tiền nên phiếu chưa có mã QR.` + `Cài đặt nhận tiền →` |
| Sau "Lập phiếu cả lớp" có em bị bỏ qua | Khối danh sách | `Chưa lập được cho N em` rồi `tên: lý do`. Lý do có thể là: `Em chưa học lớp nào của bạn`, `Chưa nhập số buổi của tháng này`, `Số phải đóng bằng 0đ`, `Đã có phiếu KINxxxxx`, `Đã có phiếu KINxxxxx (đã huỷ) — khôi phục thay vì lập mới`, `Lỗi hệ thống khi lập phiếu` |
| Phiếu nháp | Thẻ `Nháp` (trung tính), nút `Gửi phiếu` | |
| Phiếu đã gửi / phụ huynh báo / một phần | Thẻ `Đã gửi` · `Phụ huynh báo đã chuyển` · `Đóng một phần` (màu chờ) | |
| Phụ huynh báo đã chuyển quá 24 giờ | Thêm dòng đậm | `Quá 24 giờ chưa thấy tiền — kiểm sao kê` |
| Đã đóng | Thẻ `Đã đóng` (xanh lá); không có `Sửa số tiền`; không có nút Zalo/Đã nhận tiền | |
| Đã đóng bằng tín dụng (phải đóng 0đ) | `issueInvoice` tạo phiếu `paid` với `amountDue = 0` khi tín dụng trừ hết: hàng hiện `Phải đóng 0đ · Đã nhận 0đ` cùng dòng `Đã trừ … tiền đóng dư từ tháng trước.` Phiếu này còn có `paidAt` đặt ngay lúc lập, **chưa từng qua `Nháp`/`Đã gửi`**, và được tính vào `Số phiếu` của dải tổng (với `0đ` ở cả `Phải thu` lẫn `Đã thu`). Toast `Đã lập N phiếu nháp` của lần lập đó cũng đếm cả phiếu này | Cần câu giải thích rõ, xem mục 12 câu 6 |
| Đã huỷ | Thẻ `Đã huỷ` (trung tính) + `Lý do huỷ: …` + nút `Khôi phục` | |
| Đã mở Zalo | Thêm dòng `Đã mở Zalo lúc HH:mm ngày dd/MM`, nút đổi thành `Gửi lại qua Zalo` | |
| Phụ huynh đã xem | Thêm dòng xanh lá `Phụ huynh đã xem lúc HH:mm ngày dd/MM` | |

Hộp thoại `Ghi nhận tiền`: khi số nhập > còn lại hiện `Dư {x}đ — xử lý thế nào?` + 2 radio. `Lưu`/`Ghi nhận`/`Huỷ phiếu` khoá khi chưa hợp lệ. Hộp `Gửi phiếu qua Zalo`: `Đang chuẩn bị tin nhắn…` (role `status`) → tin soạn sẵn; lỗi (role `alert`): `Không chuẩn bị được tin nhắn` hoặc thông điệp máy chủ, như `Hãy gửi phiếu trước (bấm “Gửi phiếu”) rồi mới gửi qua Zalo`, `Phiếu đã đóng đủ, không cần gửi nữa`, `Phiếu đã huỷ — khôi phục trước khi gửi`, `Không tạo được link, thử lại`. Chưa có số phụ huynh: `Chưa có số điện thoại phụ huynh — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận.` Nhóm: `Tin chung cho nhóm: không có số tiền, link hay tên con, vì ai trong nhóm cũng xem được. Phiếu từng em gửi riêng ở chat riêng.`

Lỗi máy chủ khi ghi tiền hiển thị bằng toast, hộp thoại **ở yên mở** và danh sách vẫn tải lại (không "ngầm": danh sách đổi sang ba thanh xám trong lúc tải, như hàng "tải lại" ở trên, kể cả sau thao tác thành công). Ví dụ: `Phiếu vừa đổi trạng thái, tải lại trang`, `Phiếu đã đóng đủ`, `Phiếu đã huỷ`, `Phiếu đã đóng đủ, không sửa được số tiền`, `Vui lòng ghi lý do điều chỉnh`, `Vui lòng ghi lý do huỷ phiếu`, `Lý do tối đa 300 ký tự`, `Số tiền phải là số nguyên từ 0`, `Số tiền phải là số nguyên dương`. Chữ dự phòng khi máy chủ không trả `error`: `Thao tác thất bại`.

### 6.3 Tab Chờ đối soát
| Trạng thái | Chữ chính xác |
|---|---|
| Đang tải | hai thanh xám cao 96px |
| Lỗi tải | `Không tải được hàng chờ.` + `Thử lại` |
| Rỗng (chỉ khoản chờ) | `Không có khoản nào cần đối soát.` |
| Rỗng (đã bật "Hiện cả khoản đã xử lý") | `Chưa có khoản tiền nào.` |
| Khoản chờ | thẻ loại: `Khớp đủ` (màu chờ), còn lại các loại `Đóng thiếu`, `Đóng dư`, `Phiếu đã đóng — có thể chuyển trùng`, `Phiếu đã huỷ`, `Mã không thuộc gia sư này`, `Không có mã` hiện nay màu **lỗi** (đỏ) |
| Khoản đã xử lý | thẻ màu xong với chữ của bảng `RESOLUTION` (mục 3.4) |
| Lỗi khi xử lý | toast `Xử lý thất bại` hoặc thông điệp máy chủ, ví dụ `Khoản này đã được xử lý`, `Phiếu không còn nhận tiền — chọn cách xử lý phần dư`, `Khoản này lớn hơn phần còn lại của phiếu — chọn trừ vào tháng sau hoặc đã trả lại`, `Không có phần dư — dùng 'Ghi nhận' để cộng vào phiếu`, `Phiếu đã chọn không còn nhận tiền`; sau lỗi danh sách tải lại |
| `PickInvoice` | đang tải `Đang tải…`; lỗi `Không tải được danh sách phiếu.`; rỗng `Không có phiếu chưa đóng nào khớp.` |

### 6.4 Tab Nhận tiền
| Trạng thái | Chữ chính xác |
|---|---|
| Đang tải | một khối xám cao 160px nhấp nháy |
| Lỗi tải | `Không tải được cài đặt.` + `Thử lại` |
| Chưa lưu tài khoản | phần SePay chỉ còn câu: `Lưu tài khoản ở trên trước, sau đó lấy địa chỉ và khoá để nối SePay. Không nối cũng được — bạn vẫn ghi “Đã nhận tiền” bằng tay.` |
| Đã lưu tài khoản, chưa có khoá | hiện 4 bước, ô `Địa chỉ webhook của bạn`, nút `Tạo khoá API`, `Chưa nhận giao dịch nào` |
| Vừa tạo khoá | khối cảnh báo (role `alert`): `Khoá mới — chỉ hiện một lần này. Hãy dán vào SePay ngay.`; ô `Khoá API mới`; `Tôi đã lưu khoá, ẩn đi` |
| Đã có khoá | `Đã có khoá (đuôi …xxxx). Vì lý do an toàn KiN chỉ lưu bản băm nên không xem lại được. Cần khoá mới thì tạo lại — khoá cũ ngừng dùng được ngay.` + nút `Tạo khoá mới` |
| Đã nối SePay | `Trạng thái: Đang nối SePay` (xanh lá) + ` (từ d/M/yyyy)` (không đệm số 0, múi giờ của trình duyệt) |
| Sắp hết gói miễn phí (≥ 40/50) | `Tháng này đã nhận 41/50 giao dịch qua SePay — sắp hết gói miễn phí.` (đậm, màu chờ) |
| Lỗi lưu | toast `Không lưu được` hoặc thông điệp máy chủ: `Mã ngân hàng (BIN) gồm 6 chữ số`, `Số tài khoản gồm 6–19 chữ số`, `Tên chủ tài khoản 2–50 chữ cái` |

Bốn bước hướng dẫn SePay (nguyên văn, đánh số): `Tự mở tài khoản SePay và liên kết ngân hàng của bạn (gói miễn phí 50 giao dịch/tháng).` · `Dán địa chỉ webhook bên dưới vào SePay, lọc theo tiền tố mã thanh toán KIN.` · `Đặt khoá API do KiN cấp để SePay gửi kèm (kiểu xác thực: API Key).` · `KiN hiện “Đang nối SePay” khi nhận giao dịch đầu tiên.`

---

## 7. Chữ bắt buộc giữ nguyên

Các bài test giao diện (`tools/local-e2e/`) tìm theo CHỮ và theo vai trò truy cập (accessible name). Đổi chữ hoặc đổi cấu trúc dưới đây là làm hỏng bài test. **Quy tắc chung rút từ cách test viết:** (a) nhiều chỗ dùng `getByText(...).waitFor()` / `isVisible()` / `.click()` mà không có `.first()`, nên mỗi chuỗi đó phải xuất hiện **đúng một phần tử** trong DOM ở trạng thái ấy (trùng là Playwright báo lỗi "strict mode"); (b) tìm theo tên nút là so khớp **chứa**, không phân biệt hoa thường, trừ nơi ghi `exact`; (c) phần tử phải **thật sự hiện ra** (không ẩn trong mục thu gọn) khi test chờ nó; (d) `locator("li", { hasText: "Nháp" })` và `{ hasText: "Đã gửi" }` cũng so khớp **chứa, không phân biệt hoa thường**, nên một `li` có chữ `nháp` hay `đã gửi` viết thường ở đâu đó trong nội dung cũng bị đếm; (e) `getByRole("dialog")` không có `.first()`, nên khi hộp thoại mở chỉ được có **một** phần tử `role="dialog"` đang hiện, và khi đóng (`state: "detached"`) hộp thoại phải **gỡ khỏi DOM**, không chỉ ẩn; hộp thoại không được là `li` hay nằm trong `li` của một phiếu.

### 7.1 `ui-tt200.ts` (luồng đầy đủ của màn học phí)
- Vai/chữ trang: heading `Học phí` (exact; hiện là h1, bài test không đòi mức heading nhưng giữ h1); tab `Phiếu`, `Chờ đối soát` (kể cả dạng `Chờ đối soát (3)` có dấu ngoặc), `Nhận tiền` với `aria-selected`; mở thẳng tab bằng `?tab=nhan-tien`.
- Tab Nhận tiền: `Tài khoản nhận học phí` (h2, chỉ một chỗ chứa cụm này); `Lưu tài khoản ở trên trước` (khi chưa có tài khoản; chỉ một chỗ); nhãn ô `Số tài khoản`, `Tên chủ tài khoản` (nhãn bắt đầu bằng `Tên chủ tài khoản`); nút `Lưu tài khoản`; toast `Đã lưu tài khoản nhận tiền.`; `Địa chỉ webhook của bạn` (hiện sẵn, **không nằm trong mục thu gọn**); **ô `input[readonly]` đầu tiên trên trang phải là ô địa chỉ webhook** (đặt nó trước ô khoá); nút `Tạo khoá API`; ô nhãn truy cập `Khoá API mới`; `Chưa nhận giao dịch nào` (một chỗ); sau tải lại `Đã có khoá (đuôi` và **khoá cũ không được có trong DOM**.
- Tab Phiếu: nút `Lập phiếu cả lớp` (**đúng một nút có tên này** trong DOM ở mọi trạng thái, kể cả khi rỗng; xem 6.2); toast `Đã lập 3 phiếu nháp` (mẫu `Đã lập N phiếu nháp`); mỗi phiếu là `<li>`, và số `li` chứa chữ `Nháp` phải bằng số phiếu nháp (**không đặt chip lọc "Nháp"/"Đã gửi" thành `li`**); `1.840.000đ` hiện (bài test chỉ tìm chữ này, lấy phần tử đầu tiên ở bất cứ đâu trên trang; để nó ở ô `Phải thu` của dải tổng, đúng với ý nghĩa của số); nút `Gửi 3 phiếu nháp`; toast `Đã gửi 3/3 phiếu.`; `li` chứa `Đã gửi`; vắng `chưa lưu tài khoản nhận tiền` sau khi có tài khoản; nút `Sao chép tin nhắn` + toast `Đã sao chép tin nhắn`; nội dung chép chứa mã `KIN[A-Z2-9]{5}`, `970436-0123456789` và `nội dung: KIN[A-Z2-9]{5} `.
- Tab Chờ đối soát: tab `Chờ đối soát (3)`; `Đóng thiếu`, `Không có mã`, `Phiếu đã đóng` (phần của `Phiếu đã đóng — có thể chuyển trùng`); `KiN không tự ghép` (một chỗ); nút `Ghi nhận một phần` + toast `Đã ghi nhận một phần.`; nút `Ghép vào phiếu này` + toast `Đã ghép vào phiếu.`; nút `Trừ vào tháng sau` + toast `Đã ghi: trừ vào tháng sau.`; `Không có khoản nào cần đối soát.`; hộp chọn nhãn `Hiện cả khoản đã xử lý`; thẻ `Tự gạch phiếu` (exact), `Gia sư ghép tay` (exact). **Không dùng các cụm `Đóng thiếu`, `Không có mã` làm chip lọc hay nhãn khác.**
- Hộp thoại: vai `dialog`; nút `Đã nhận tiền` trong `li` của em; nhãn `Số tiền đã nhận (đ)`; `Dư 80.000đ` (mẫu `Dư {x}đ`); nút `Ghi nhận`; toast `Đã ghi nhận tiền.`; nút `Huỷ phiếu` trong `li` rồi trong hộp thoại (nút trong hộp **khoá** khi lý do trống); nhãn `Lý do huỷ` (`Lý do huỷ (bắt buộc)`); toast `Đã huỷ phiếu.`; `Lý do huỷ: Em chuyển lớp`; nút `Khôi phục`; phiếu `paid` **không có** nút `Sửa số tiền`.
- 390px: `scrollWidth ≤ innerWidth` (không tràn ngang), cả trang gia sư lẫn trang phụ huynh. Không có lỗi console/pageerror.

### 7.2 `ui-invoice-zalo.ts` (gửi phiếu qua Zalo)
- Theo phiếu (`getByRole("listitem")` lọc theo tên em): phiếu đã gửi có nút `Gửi phiếu qua Zalo`; **phiếu nháp không có nút nào chứa chữ `Zalo`** và có nút tên đúng `Gửi phiếu` (exact); chưa mở Zalo thì **không có** `Đã mở Zalo lúc`.
- Hộp thoại: nhãn ô `Tin nhắn (sửa được trước khi gửi)`; radio `Chat riêng với phụ huynh` (mặc định chọn) và `Nhóm Zalo lớp`; các câu `Sẽ mở Zalo của 0901234567`, `Link phiếu dùng được 30 ngày nữa`, `KiN không gửi giúp`, `không có số tiền, link hay tên con`; nút `Mở Zalo` (cao ≥ 44px, nằm hết trong 390px); nút **`Đóng` đúng một nút có tên `Đóng` (exact) trong hộp thoại**. Nếu thêm nút ✕, tên truy cập của nó **phải khác chính xác `Đóng`** (ví dụ `Đóng hộp thoại`).
- Tin soạn sẵn đúng mẫu (xem 7.5). Sau khi mở: `Đã mở Zalo lúc HH:mm ngày dd/MM`; nút thành `Gửi lại qua Zalo`; `Phụ huynh đã xem lúc HH:mm ngày dd/MM`; trạng thái sau khi phụ huynh báo khớp `báo đã chuyển` (hoặc `Chờ`, `Đã báo`).
- **Nội dung chữ của cả thẻ phiếu không được có cụm "đã gửi … Zalo" hoặc "Zalo … đã gửi" trên cùng một dòng** (biểu thức `đã gửi[^.\n]*Zalo` và `Zalo[^.\n]*đã gửi`, không phân biệt hoa thường). Thẻ trạng thái `Đã gửi` và dòng `Đã mở Zalo lúc …` phải ở **hai khối riêng (xuống dòng)**, không đặt cùng một dòng chữ.
- Khi chưa ai mở link phiếu, chữ `Phụ huynh đã xem` (phân biệt hoa thường, `getByText(/Phụ huynh đã xem/).count() === 0`) **không được xuất hiện ở bất cứ đâu trên trang**, kể cả trong chú thích hay gợi ý.
- Phiếu hết hạn link: gia sư mở lại hộp thoại thì tin có link `/phieu/<32 hex>` mới.

### 7.3 Test khác chạm màn này
- `t-kin-components.ts`: `HocPhiClient.tsx` phải dùng `KinTabs` và **không** tự viết `role="tab"`; `Badge` của `shared.tsx` phải dùng `KinStatus`; toàn mã nguồn **không** có `window.confirm` / `confirm()` (mọi hỏi lại đi qua `KinConfirm`); không tô đỏ `KinButton` bằng style tay chứa `--kin-tt-chu-loi` (dùng `danger` / `danger-solid`); không màu hex (`t-no-hex`).
- `t-notify-links.ts`, `t-links.ts`: `page.tsx` phải giữ chữ ký `searchParams: Promise<{ tab?: string }>` (chỉ đọc `tab`); đường dẫn đích của thông báo: `/lop-cua-toi/hoc-phi`, `/lop-cua-toi/hoc-phi?tab=doi-soat`, `/lop-cua-toi/hoc-phi?phieu=<id>`.
- `ui-tutor-shell.ts`: nút `Đối soát` ở Hộp việc dẫn tới `/lop-cua-toi/hoc-phi?tab=doi-soat`; mục thanh module `Học phí`.
- `ui-tutor-dash.ts`: lối tắt `Học phí` tới `/lop-cua-toi/hoc-phi`.
- `ui-theme.ts`: `/lop-cua-toi/hoc-phi` ở chế độ Tối (chủ đề Mận) phải không có chữ khó đọc, không có mảng nền trắng. `ui-tutor-everything.ts`, `ui-role-everything.ts`, `ui-links-everywhere.ts`: đường dẫn chuyển hướng theo vai và không lọt dữ liệu của gia sư khác.

### 7.4 Chuỗi thông báo (toast) cần giữ (đã liệt ở mục 5 và 6)
`Đã lưu tài khoản nhận tiền.` · `Đã lập N phiếu nháp. Kiểm tra rồi bấm Gửi.` · `Đã gửi N/M phiếu.` · `Đã gửi phiếu.` · `Đã sao chép tin nhắn — dán vào Zalo gửi phụ huynh.` · `Đã ghi nhận tiền.` · `Đã cập nhật số tiền. Mã phiếu giữ nguyên.` · `Đã huỷ phiếu.` · `Đã khôi phục phiếu về nháp.` · `Đã ghi nhận một phần.` · `Đã ghi nhận, phiếu đã đóng.` · `Đã ghi: trừ vào tháng sau.` · `Đã ghi: đã trả lại.` · `Đã ghép vào phiếu.` · `Đã ẩn khoản này (không xoá).` · `Đã sao chép tin nhắc phần còn lại.`

### 7.5 Mẫu tin nhắn (bài test so khớp từng chữ)
- Chat riêng (`privateInvoiceMessage`): `Dạ em gửi anh/chị phiếu học phí tháng {N} của con {tên}: {số tiền}, hạn trước ngày 20. Anh/chị bấm vào đây để xem phiếu và quét mã chuyển khoản: {link}`
- Nhóm lớp (`groupInvoiceMessage`): `Phiếu học phí tháng {N} đã gửi riêng cho từng anh/chị, hạn trước ngày 20. Anh/chị xem tin nhắn riêng giúp em nhé.` (không số tiền, không link, không tên con)
- Link phiếu: `<origin>/phieu/<32 ký tự hex>`; hết hạn sau 30 ngày; phụ huynh không cần tài khoản.

---

## 8. Quy tắc cứng phải giữ

**Tiền (bắt buộc cho màn này; thiết kế chỉ đổi cách trình bày):**
- Thiết kế **không được đổi cách tính phiếu, cách đối soát, điều kiện hiện nút hay hành vi nút**. Mọi con số tiền trên màn là số **máy chủ đã tính** (`amountDue`, `paidAmount`, `remaining`, `summary.*`). Không thêm phép tính ở giao diện, không thêm phần trăm, không hiển thị "số buổi × đơn giá" (phiếu không trả chi tiết đó, và tiền chốt vào sự kiện, đọc lại từ lớp là sai). Nguồn: `docs/kin/CLAUDE-cho-kho-trien-khai.md` mục 5 điều 1 và mục 9 câu 3 ("chỗ này có tiền... thì dừng lại và hỏi người"); `docs/kin/nhung-cho-de-sai.md` mục 2; `src/lib/tuitionInvoice.ts` đầu tệp.
- **Chỉ tự gạch khi đúng mã + đúng số tiền còn lại + phiếu đang mở; không bao giờ tự ghép theo số tiền.** Gợi ý chỉ là gợi ý: không tô "đề xuất tốt nhất", không chọn sẵn, không nút "Ghép tất cả". (`tuitionInvoice.ts`: `canAutoApply`, `suggestInvoices`)
- **KiN không giữ tiền, không thu hộ, không cắt phần trăm**: không đặt chữ "ví", "rút", "thanh toán qua KiN". Câu `KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền` phải còn hiện trên màn. (`CLAUDE-cho-kho-trien-khai.md` mục 1; `page.tsx`; `PayoutTab.tsx`)
- Nút ghi tiền phải **giữ trạng thái khoá khi đang chạy** (`loading` / `disabled`) để không bấm đúp; không thêm đường tắt ghi tiền bỏ qua hộp thoại hiện có. Ghi dữ liệu dùng `fetch` tới các API route hiện có (không đổi sang server action; `CLAUDE-cho-kho-trien-khai.md` mục 5 điều 5; `nhung-cho-de-sai.md` mục 1). Không dùng `<Link>` tới cùng đường dẫn khác query để đổi tháng/tab.
- **Zalo: chỉ ghi "đã mở Zalo", không bao giờ "đã gửi qua Zalo"**; tin nhóm không có số tiền, link hay tên con. (`src/lib/invoiceZalo.ts`, `src/lib/zaloShare.ts`, `ui-invoice-zalo.ts`)
- **Thông báo không tên không tiền:** toast và thông báo mới của màn này không chứa tên học viên hay số tiền (các toast hiện có đều đúng, giữ nguyên). Thông báo `Phụ huynh báo đã chuyển khoản` dựng từ loại, không tên, không tiền, không mã phiếu (`src/lib/invoiceServer.ts`, NC2-010). Hai thông báo do webhook SePay tạo (`Đã gạch phiếu học phí`, `Có khoản tiền cần đối soát`) thì **hiện chưa theo quy tắc này**, xem mục 12 câu 17; đó là mã ngoài màn này, thiết kế không sửa. Tiêu đề hộp thoại có tên em là bình thường (đó là màn của gia sư).
- Màn chỉ hiện dữ liệu của **chính gia sư đang đăng nhập** (cô lập giữa các gia sư, `ui-tutor-everything.ts`).

**Trẻ em dưới 16 tuổi:** học viên có thể dưới 16. Màn này không thêm ảnh, tuổi, ngày sinh, trường, địa chỉ hay trường dữ liệu cá nhân mới (`BRIEF.md`, `CLAUDE-cho-kho-trien-khai.md` mục 8–9). Tên và số điện thoại phụ huynh chỉ hiện trong hộp thoại Zalo như hiện nay; không dùng ảnh đại diện (chữ cái đầu làm biểu tượng thì cần chủ dự án duyệt, mục 12).

**Giao diện:**
- Chỉ dùng token `--kin-*` từ `src/app/kin-tokens.css` / `kin-site.css` (sáng, tối và 5 chủ đề: Navy, Cổ vịt, Mận, Cà phê, Mực); **không màu hex** (bài `t-no-hex`); không thêm màu, không thêm thư viện. Ba màu nghĩa **không đổi theo chủ đề**: `--kin-tt-chu-xong` (xanh lá), `--kin-tt-chu-cho` (vàng/cam), `--kin-tt-chu-loi` (đỏ). (`docs/kin/quyet-dinh-giao-dien-va-hoc-phi.md` mục 6)
- **Màu không nói một mình:** mọi trạng thái có chữ đi kèm (`KinStatus` = chấm + chữ). **Hai bộ mã**: chữ cần 4,5:1, chấm và viền 3:1 (`--kin-tt-chu-*` cho chữ, `--kin-tt-cham-*` cho chấm). Nền nhạt dùng `--kin-tt-nen-*`, viền `--kin-tt-vien-*`. (`CLAUDE-cho-kho-trien-khai.md` mục 6)
- **Nút và vùng chạm ≥ 44px** (`--kin-cham-toi-thieu`; `KinButton` đã đảm bảo; hàng radio/hộp chọn `min-h-[44px]`).
- Không chữ bị cắt "…" (tên em, nhãn trạng thái dài như `Phụ huynh báo đã chuyển`, nội dung chuyển khoản phải xuống dòng được); không tràn ngang ở 390px (bài test đo `scrollWidth`) và 320px.
- **Ngày giờ giờ Việt Nam, giờ 24 giờ.** `Đã mở Zalo lúc …` và `fmtTime` đã ghim múi giờ `Asia/Ho_Chi_Minh`; ngày "từ …" ở tab Nhận tiền hiện chưa ghim múi giờ (mục 12).
- Một hành động chính mỗi vùng; trạng thái rỗng có một câu giải thích và một nút (nút phải tuân ràng buộc "một nút `Lập phiếu cả lớp`" ở mục 7).
- Hộp hỏi lại dùng `KinConfirm`, không `window.confirm`. Giọng tiếng Việt, xưng hô tự nhiên; tên sản phẩm luôn là **KiN**, không dùng Midnight Elite.

---

## 9. Điều đang chưa tốt ở bản hiện tại

Dựa trên mã và ảnh `anh-hien-trang/4-hoc-phi-hien-tai.jpg`.

1. **Quá nhiều khung viền.** Mỗi ô tổng, mỗi phiếu, mỗi khoản chờ, mỗi phần cài đặt là một khung riêng; ảnh chụp cho thấy bốn ô tổng và từng phiếu đều có viền, gây cảm giác dày. (`CARD_STYLE` ở mọi tab)
2. **Dải tổng không có màu nghĩa và không có điểm nhấn.** `Số phiếu / Phải thu / Đã thu / Còn lại` là bốn ô cùng cỡ chữ 18px, cùng màu; con số quan trọng nhất (`Còn lại`) không nổi và không cam; `Đã thu` không xanh lá (Sổ Gia Sư tô cam/xanh lá, ảnh `04-hoc-phi-chua-thu.jpg`).
3. **Nhãn lặp ở mọi phiếu.** Từng phiếu dùng lưới 3 cột `Phải đóng / Đã nhận / Còn lại` có nhãn 12px; 8 phiếu là 24 cặp nhãn–số, tốn chiều cao.
4. **Nhiều nút ngang hàng, thiếu thứ bậc.** Phiếu đã gửi có tới 5 nút (`Đã nhận tiền`, `Gửi phiếu qua Zalo`, `Sao chép tin nhắn`, `Sửa số tiền`, `Huỷ phiếu`) xếp dồn, chiều rộng theo chữ; mỗi phiếu có một nút đặc nên cả màn có nhiều nút "chính" (cộng hai nút trên đầu). Ảnh chụp: phiếu nháp có `Gửi phiếu` (đặc) + `Sao chép tin nhắn` (viền đậm) + hai ghost.
5. **Hai nút đầu màn cạnh ô chọn tháng cùng một hàng** (`Lập phiếu cả lớp` đặc + `Gửi N phiếu nháp` viền), ở 390px sẽ xuống dòng lộn xộn; không rõ cái nào là bước kế tiếp.
6. **Đầu trang dài.** `← Lớp của tôi`, h1, đoạn mô tả hai dòng, rồi tab: tốn gần nửa màn đầu ở điện thoại trước khi thấy con số nào. Tên màn lặp với mục "Học phí" đang sáng ở thanh module.
7. **Số khoản chờ chỉ là chữ `(1)` trong nhãn tab**, không màu, không nổi; khoản chờ đối soát là việc gấp nhất lại khó thấy.
8. **Màu đỏ dùng quá tay ở tab Chờ đối soát.** Mọi loại khác `Khớp đủ` (kể cả `Không có mã`, `Đóng dư`) đều dùng sắc thái lỗi `bad` (đỏ), dù đa số chỉ là "cần gia sư quyết". Đỏ là nghĩa "sai/quá hạn"; dùng quá tay làm mất nghĩa.
9. **Thời điểm khoản vào có cả giây và định dạng khác chỗ khác**: tab đối soát in `08:42:10 22/10/2026` (giờ:phút:giây ngày/tháng/năm), tab Phiếu in `lúc 19:05 ngày 21/10`. Nên dùng một kiểu.
10. **Ô tiền chỉ nhận chữ số và không nhóm nghìn** (`560000`): khó đọc, dễ gõ thừa số 0, không có dòng xem lại `= 560.000đ` ở hộp Sửa số tiền / Ghi nhận tiền. (`AmountDialog`, `PayDialog`)
11. **Hộp thoại không có nút ✕**; chỉ đóng được bằng nút `Đóng`, phím Esc hoặc bấm nền (`Modal` trong `shared.tsx`). Tờ trượt trên điện thoại cũng không có thanh nắm kéo.
12. **Không có hoàn tác và không hỏi lại cho thao tác tiền.** `Ghi nhận`, `Đã nhận tiền`, `Trừ vào tháng sau`, `Ghi đã trả lại` thực hiện ngay; Sổ Gia Sư có hộp xác nhận hai bước và `Hoàn tác` (research mục 3.3.9). Đây là điểm yếu về hành vi, thuộc mục 12, không tự sửa trong thiết kế.
13. **Gia sư không thấy mã QR hay phiếu như phụ huynh sẽ thấy.** `qrUrl` có sẵn trong dữ liệu nhưng chỉ nhúng vào tin sao chép; Sổ Gia Sư có xem trước phiếu (ảnh `05-phieu-hoc-phi.jpg`).
14. **Không tìm, không lọc** (theo tên, theo trạng thái: nháp / chưa đóng / đã đóng) trong danh sách phiếu (API trả tối đa 500). Với 8 học viên tạm ổn, với 20 thì dài.
15. **Ô chọn Tháng là `<select>` thuần**, 12 mục (cả tháng sau) và không có nút tháng trước/sau; muốn so sánh hai tháng liền kề phải mở danh sách hai lần.
16. **Trạng thái rỗng thiếu nút/đường dẫn.** Rỗng ở tab Phiếu nhắc "ở trang quản khoá" mà không có liên kết tới đó; rỗng ở đối soát chỉ là một câu, không nói tiền sẽ vào đây khi nào. Yêu cầu của brief: một câu giải thích và một nút.
17. **Danh sách `Chưa lập được cho N em` còn nguyên khi đổi tháng** (trạng thái `skipped` không được đặt lại), dễ hiểu nhầm là của tháng mới.
18. **Banner thiếu tài khoản dùng `role="alert"`** dù không khẩn, nên đọc ngắt ngang người dùng trình đọc màn hình ở mỗi lần vào tab.
19. **Phiếu đóng bằng tín dụng hiện `Phải đóng 0đ · Đã nhận 0đ`** và nhãn `Đã đóng`, dễ khiến gia sư tưởng phiếu hỏng.
20. **Tab Nhận tiền dài và nhiều chữ**: hai khung lớn, bốn bước đánh số luôn mở, câu giải thích dài về khoá API; người đã nối xong vẫn phải cuộn qua tất cả để thấy trạng thái.

---

## 10. Mẫu học từ đối thủ

Ảnh tham khảo Sổ Gia Sư nằm ở `docs/kin/thiet-ke/goi-gui-claude-design/anh-tham-khao-so-gia-su/`. Ảnh gốc khác ở `/tmp/rs/x/word/media/` (**thư mục tạm, giải nén từ báo cáo research, có thể mất sau khi khởi động lại máy; chưa có bản trong kho**, nên nếu cần giữ lâu thì chép các tệp được nêu bên dưới vào `anh-tham-khao-so-gia-su/` trước). Chỉ ghi những ảnh đã tự mở lại để xác nhận; bản rà soát 22/10/2026 đã mở lại cả 5 tệp `/tmp` và 3 ảnh trong kho được trích dưới đây và đối chiếu từng chữ. (Bản mô tả trong hồ sơ `journal.jsonl` của đợt trước lệch tên tệp ở nhóm TutorBird, nên không lấy tên tệp từ đó mà không mở lại.)

- **Một dải tổng một hàng ngay dưới bộ lọc** (`Học phí chưa thu: 200.000đ · 1 học sinh`, tiền màu cam) — Sổ Gia Sư — `anh-tham-khao-so-gia-su/04-hoc-phi-chua-thu.jpg`. Dùng cho dải `Còn lại` ở 4.1 bước 4.
- **Thẻ theo học sinh: tên trái, số tiền cam lớn nhất bên phải** — Sổ Gia Sư — `04-hoc-phi-chua-thu.jpg`. Dùng cho hàng phiếu (dòng 1).
- **Một nút đặc xanh lá `Đã thu tiền` + một nút viền `Tạo phiếu học phí` ở chân thẻ** — Sổ Gia Sư — `04-hoc-phi-chua-thu.jpg`. Dùng cho thứ bậc nút của phiếu (một đặc, còn lại viền/ghost).
- **Banner nhắc ngay trong luồng: `Chưa có tài khoản ngân hàng nên phiếu sẽ không có mã QR` + liên kết `Cài đặt ngay`** — Sổ Gia Sư — `05-phieu-hoc-phi.jpg`. Dùng cho banner thiếu tài khoản (một hàng, một liên kết).
- **Hộp thoại có chân cố định: nút phụ viền bên trái, nút đặc bên phải; tuỳ chọn trái, xem trước phải** — Sổ Gia Sư — `05-phieu-hoc-phi.jpg`. Chỉ lấy chân hộp thoại cố định; không chép bố cục hai cột cứng sang điện thoại.
- **Tổng đã thu màu xanh lá ở đầu danh sách, lọc theo tháng** — Sổ Gia Sư — `/tmp/rs/x/word/media/c740944e1514fca16005f73908cb20a8c96309a2.jpg`. Dùng cho màu `Đã thu`.
- **Chân thẻ hiện `Đã chọn 1 khoản · 200.000đ` (đỏ) cùng nút `Hoàn tác` đỏ đặc** — Sổ Gia Sư — `/tmp/rs/x/word/media/510dc007b09cd7e509cac93f701112e797316ec3.jpg` (trạng thái chưa chọn khoản nào, nút `Hoàn tác` hồng nhạt, nằm ở `/tmp/rs/x/word/media/c740944e1514fca16005f73908cb20a8c96309a2.jpg`). **Chỉ tham khảo nếu chủ dự án duyệt thêm hoàn tác (mục 12 câu 2)**; không dựng trong lượt này.
- **Ô ngân hàng/số tài khoản/tên chủ có dấu `*` đỏ và chữ gợi ý mẫu (`0123456789`, `NGUYEN VAN A`), nút `Lưu thông tin` xám cho đến khi nhập đủ** — Sổ Gia Sư — `/tmp/rs/x/word/media/faecc690e096e4b7d726c0ed05d7d974cf7da896.jpg`. Dùng cho chữ gợi ý mẫu trong ô của tab Nhận tiền; việc khoá nút là đổi hành vi, cần duyệt.
- **Câu tiêu đề nêu thẳng số còn nợ và mốc ngày** (`Số tiền còn nợ: 30,00 đô la tính đến … 31/10/2026`) — TutorBird — `/tmp/rs/x/word/media/d4a5e8d5bc47736274dde0319368f7a9fe361b07.jpg`. Chỉ lấy **ý** "nêu thẳng số còn lại ngay dưới tiêu đề" cho dòng phụ dưới số `Còn lại`, và dòng phụ đó chỉ được là **nhãn tháng đang chọn** (`của Tháng 10/2026`). **Không** viết `tính đến hôm nay` hay một mốc ngày nào khác: `summary.totalRemaining` là tổng phiếu của tháng được chọn, không phải số nợ tính đến một ngày, và máy chủ không tính theo ngày (thêm mốc ngày là đặt thêm một nghĩa cho con số).
- **Ngăn kéo từ phải, hai bước, chân cố định `Huỷ` / `Trước đó` / `Tiếp theo`** — TutorBird — `/tmp/rs/x/word/media/fa04f891b3e7b13155c150301d36f94575ca6932.jpg`. Dùng cho tờ trượt từ đáy trên điện thoại (một câu hỏi mỗi hộp thoại, chân cố định).
- **Tab đôi `Học phí chưa thu` / `Lịch sử thu` dạng viên thuốc** — Sổ Gia Sư — `04-hoc-phi-chua-thu.jpg`, `/tmp/rs/x/word/media/c740944e1514fca16005f73908cb20a8c96309a2.jpg`. Chỉ để đối chiếu: KiN đã có `KinTabs` ba tab, không đổi.

---

## 11. Dữ liệu mẫu để điền vào thiết kế

Cô Lan (`giasu@kin.local`), 7 lớp (Toán 9, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9…), 8 học viên đang học, **đã thu tháng 10: 480.000đ**. Mốc thời gian: thứ Năm 22/10/2026.

1. **Dải tổng Tháng 10/2026 (khớp ảnh hiện trạng):** `Số phiếu 2` · `Phải thu 1.040.000đ` · `Đã thu 480.000đ` · `Còn lại 560.000đ`.
2. **Phiếu 1:** `Đỗ Hà` · `KINTQF43` · `Nháp` · Phải đóng `560.000đ` · Đã nhận `0đ` · Còn lại `560.000đ`; nội dung chuyển khoản mẫu `KINTQF43 DO HA`. Nút: `Gửi phiếu` (đặc), `Sao chép tin nhắn`, `Sửa số tiền`, `Huỷ phiếu`. Dòng đầu trang khi có nháp: nút `Gửi 1 phiếu nháp`.
3. **Phiếu 2:** `Trần Gia Bảo` · `KINGKQRA` · `Đã đóng` · `480.000đ` · `480.000đ` · `0đ`; chỉ còn `Huỷ phiếu`.
4. **Tab `Chờ đối soát (1)`:** khoản `560.000đ`, `08:42:10 22/10/2026`, nội dung `CK HOC PHI CHO CON`, loại `Không có mã`; gợi ý `Đỗ Hà · Tháng 10/2026 · KINTQF43` (cùng số tiền còn lại) với nút `Ghép vào phiếu này`, `Ghép vào phiếu…`, `Không phải tiền học`.
5. **Bộ mẫu thêm để vẽ trạng thái (không cộng vào tổng ở dòng 1):**
   - `Lê Minh` · `Đã gửi` · `560.000đ` · `Đã mở Zalo lúc 19:05 ngày 21/10` · `Phụ huynh đã xem lúc 20:12 ngày 21/10`.
   - `Phạm Khôi` · `Đóng một phần` · phải đóng `720.000đ`, đã nhận `300.000đ`, còn lại `420.000đ`.
   - `Vũ An` · `Phụ huynh báo đã chuyển` · dòng `Quá 24 giờ chưa thấy tiền — kiểm sao kê`.
   - `Em Huỷ` · `Đã huỷ` · `Lý do huỷ: Em chuyển lớp` · nút `Khôi phục`.
6. **Khoản chờ thêm để vẽ các loại:** `600.000đ` mã `KINGKQRA` loại `Phiếu đã đóng — có thể chuyển trùng` (nút `Trừ vào tháng sau`, `Ghi đã trả lại`, `Ghép vào phiếu…`); `300.000đ` mã `KINX7M2D` loại `Đóng thiếu` (nút `Ghi nhận một phần`, `Soạn tin nhắc phần còn lại`).
7. **Đã xử lý (bật "Hiện cả khoản đã xử lý"):** `480.000đ` · `Tự gạch phiếu`; `500.000đ` · `Tiền mặt` (ghi tay; dòng thời điểm hiện thêm ` · ghi tay`, nội dung chuyển khoản do máy chủ đặt cố định là `Tiền mặt / ghi tay`, và có dòng phiếu gắn `Phiếu … · còn lại … / …`).
8. **Tab Nhận tiền (đã nối):** Ngân hàng `Vietcombank`, số tài khoản `0123456789`, tên chủ tài khoản `NGUYEN THI LAN`; `Trạng thái: Đang nối SePay (từ 11/10/2026)`; `Tháng này đã nhận 12/50 giao dịch qua SePay.` Biến thể sắp hết gói: `41/50 … — sắp hết gói miễn phí.`
9. **Tab Nhận tiền (mới):** chưa có tài khoản, hiện câu `Lưu tài khoản ở trên trước, sau đó lấy địa chỉ và khoá để nối SePay…`.
10. **Tin nhắn mẫu (chat riêng):** `Dạ em gửi anh/chị phiếu học phí tháng 10 của con Đỗ Hà: 560.000đ, hạn trước ngày 20. Anh/chị bấm vào đây để xem phiếu và quét mã chuyển khoản: https://…/phieu/3f9a…`
11. **Sao chép tin nhắn mẫu (đúng chữ mã sinh ra):** `KiN — học phí tháng 10/2026 của Đỗ Hà: 560.000đ.` / (khi đã lưu tài khoản nhận tiền thì thêm dòng `Quét mã QR: https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=560000&addInfo=KINTQF43+DO+HA&accountName=NGUYEN+THI+LAN`) / `Hoặc chuyển khoản với nội dung: KINTQF43 DO HA` / `Anh/chị giữ nguyên mã KINTQF43 ở đầu nội dung để hệ thống ghi nhận đúng. Cảm ơn anh/chị!`
12. **Banner:** `Bạn chưa lưu tài khoản nhận tiền nên phiếu chưa có mã QR.` + `Cài đặt nhận tiền →` (dùng khi vẽ bản chưa cài đặt).

---

## 12. Câu hỏi còn mở

Những điểm bản này không thể quyết từ mã và ảnh; chủ dự án quyết trước khi thiết kế bản cuối. **Câu** 1–6, 8, 17, 19 và 20 chạm hành vi, tiền hoặc chữ cam kết nên **không tự làm**. Phân loại để khỏi hỏi thừa:

- **Bắt buộc chủ dự án quyết** (đổi hành vi, tiền, API, dữ liệu trẻ em hoặc chữ cam kết): câu 1, 2, 3, 4, 5, 6, 9, 14, 17, 18, 19, 20.
- **Chủ dự án quyết về phạm vi, nhà thiết kế làm tiếp theo mặc định ghi sẵn nếu chưa có trả lời** (chỉ là trình bày hoặc thêm hiển thị, không đổi tiền): câu 7, 8, 10, 13, 15, 16. Mặc định: không thêm hiển thị mới ở câu 7 và 8, giữ màu hiện có ở câu 10, thêm ✕ với tên `Đóng hộp thoại` ở câu 13, một cột ở câu 15, giữ định dạng ngày giờ hiện có ở câu 16.
- **Chỉ là câu hỏi sự thật về ý định, trả lời một chữ**: câu 11 (nhà thiết kế quyết được; bản này đã chọn giữ cả `← Lớp của tôi` lẫn h1, xem 4.1), câu 12.

1. **Tệp đặc tả nghiệp vụ không có trong kho.** Mã dẫn `docs/kin/nghiep-vu/doi-soat-vietqr.md` và `gui-qua-zalo.md` (các mã GD-19…GD-28, "hạn trước ngày 20") nhưng thư mục `docs/kin/nghiep-vu/` không tồn tại, nên các quy tắc đó chỉ kiểm được qua mã. Đoạn mô tả đầu trang (`KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền`) có được rút gọn như 4.1 không, hay giữ nguyên hai câu (vì là lời cam kết về tiền)?
2. **Hoàn tác thu tiền.** Hiện không có cách đảo ngược `Ghi nhận`, `Đã nhận tiền`, `Trừ vào tháng sau`, `Ghi đã trả lại`. Sổ Gia Sư có `Hoàn tác`. Có muốn thêm không (cần thay đổi API, ngoài phạm vi thiết kế) hay chỉ thiết kế để chừa chỗ?
3. **Hỏi xác nhận trước thao tác ghi tiền.** Hiện bấm là ghi ngay. Thêm bước xác nhận (`KinConfirm`) làm đổi số lần bấm và làm hỏng các bài `ui-tt200.ts` (bấm `Ghi nhận` rồi chờ toast). Có muốn không, cho nút nào (`Ghi nhận`, `Ghi nhận một phần`, `Trừ vào tháng sau`, `Ghi đã trả lại`, `Huỷ phiếu` trên phiếu đã đóng)? Hai nút ở tab Nhận tiền cũng bấm là chạy ngay và khó đảo ngược, nên cần cùng câu hỏi: `Tạo khoá mới` (khoá đang dùng ở SePay chết ngay, tiền vào sau đó bị từ chối cho tới khi dán khoá mới) và `Lưu tài khoản` khi đang sửa tài khoản đã có (đổi nơi nhận tiền của **mọi** phiếu, cả phiếu đã gửi, vì mã QR được dựng lại từ tài khoản hiện tại).
4. **Gộp nút phụ vào menu `Thêm`.** Nếu gộp `Sửa số tiền` / `Huỷ phiếu` (và có thể `Sao chép tin nhắn`) vào một menu thì các bài test bấm trực tiếp những nút này phải sửa. Bản này giữ tất cả nút hiện sẵn (4.1). Có muốn thử gộp để thoáng hơn không?
5. **`Huỷ phiếu` trên phiếu đã đóng.** Mã và máy chủ cho phép huỷ phiếu `paid` (tên bài `ui-tt200.ts` ghi "có Huỷ nhưng không có Sửa" cho phiếu đã đóng, nhưng bài đó chỉ kiểm **không có** `Sửa số tiền`; không bài nào đòi hay cấm nút `Huỷ phiếu` trên phiếu đã đóng). Tiền đã ghi (`paidAmount`) không bị xoá, chỉ phiếu đổi trạng thái, và phiếu huỷ **rời khỏi dải tổng**: `Đã thu` của tháng giảm đúng số đó mà không có dòng nào giải thích. Khôi phục xong phiếu về `Nháp` chứ không về `Đã đóng`, còn giữ `paidAmount` cũ. Nút này có nên hiện trên phiếu đã đóng, và nếu hiện thì có cần chữ cảnh báo nào trong hộp thoại?
6. **Phiếu 0đ đã đóng bằng tín dụng.** Cách hiển thị đề xuất ở 6.2 (một câu giải thích) cần chữ cuối cùng do chủ dự án duyệt.
7. **Thêm thông tin vốn có sẵn trong dữ liệu nhưng chưa hiện:** ngày đóng (`paidAt`), ngày gửi (`sentAt`), xem trước mã QR/phiếu như phụ huynh thấy (`qrUrl`, chỉ có khi đã lưu tài khoản và phiếu còn tiền phải thu). Lưu ý riêng cho QR: mỗi ảnh là một yêu cầu tới `img.vietqr.io` mang tên em không dấu và số tài khoản trong đường dẫn (`addInfo`, `accountName`), nên danh sách 20 phiếu hiện QR sẵn là 20 yêu cầu ra ngoài mỗi lần tải; nếu duyệt thì chỉ nạp khi gia sư mở một phiếu. Có muốn đưa lên màn không, ở đâu?
8. **Tìm/lọc phiếu** theo tên và trạng thái (lọc ở máy khách, không đổi API). Có thêm chip lọc không? (Lưu ý ràng buộc test ở mục 7.1: chip không được là `li` chứa chữ `Nháp`/`Đã gửi`, và không dùng lại cụm `Đóng thiếu`, `Không có mã`.)
9. **Lịch sử thu tách tab** như Sổ Gia Sư (`Học phí chưa thu` / `Lịch sử thu`)? Hiện khoản đã xử lý chỉ xem được bằng công tắc ở tab Chờ đối soát, và có 3 tab cố định mà bài test phụ thuộc.
10. **Màu của loại khoản chờ.** Hiện `Khớp đủ` màu chờ (cam) và mọi loại khác màu lỗi (đỏ). Có muốn đổi `Không có mã`, `Đóng dư`, `Mã không thuộc gia sư này` sang màu chờ/trung tính, chỉ để đỏ cho trường hợp thật sự sai (ví dụ `Phiếu đã đóng — có thể chuyển trùng`)? Đây là đổi trình bày, nhưng thành phần `Badge` còn dùng ở chỗ khác nên cần duyệt.
11. **Dải trên đầu màn:** giữ `← Lớp của tôi` + h1 `Học phí` (trùng mục sáng ở thanh module) hay chỉ giữ h1? Bài test cần heading `Học phí` (exact).
12. **Ô chọn tháng có tháng sau** (`i = -1` trong `lastMonths`): đây là chủ ý để lập phiếu trước kỳ, hay là sót? Giữ như hiện nay trong thiết kế.
13. **Nút ✕ trên hộp thoại và thanh nắm của tờ trượt:** đề xuất thêm, với điều kiện tên truy cập của ✕ khác chính xác `Đóng` (ràng buộc mục 7.2). Chủ dự án có duyệt?
14. **Biểu tượng chữ cái đầu của học viên** (kiểu `HS` của Sổ Gia Sư) có chấp nhận được với học viên dưới 16 tuổi không? Bản này mặc định **không** dùng.
15. **Bố cục máy tính:** giữ trang một cột trong vỏ gia sư, hay chia hai khung kiểu Outlook (danh sách phiếu trái, chi tiết phiếu phải; `docs/kin/thiet-ke/bo-cuc-outlook.md`)? Bản này đề xuất một cột để giữ nguyên cấu trúc `li` và bài test.
16. **Định dạng ngày giờ:** thống nhất một kiểu (đề xuất `HH:mm ngày dd/MM`, bỏ giây) và ghim múi giờ cho ngày "từ …" ở tab Nhận tiền (hiện dùng `toLocaleDateString("vi-VN")` không ghim múi giờ, ra dạng `d/M/yyyy` không đệm số 0). Hiện có ba kiểu cùng lúc: `HH:mm:ss d/M/yyyy` (đối soát), `HH:mm ngày dd/MM` (tab Phiếu), `d/M/yyyy` (Nhận tiền). Có duyệt?
17. **Ngoài màn này nhưng liên quan:** thông báo `Đã gạch phiếu học phí` và `Có khoản tiền cần đối soát` do webhook tạo hiện vẫn mang dữ liệu (`src/app/api/webhooks/sepay/[tutorId]/route.ts`): `Đã gạch phiếu học phí` ghi `{tên em} đóng {số tiền} ({mã phiếu}).` (có cả tên, tiền và mã), còn `Có khoản tiền cần đối soát` ghi `{số tiền} — {loại khoản}. Mở hàng chờ để xử lý.` (có tiền, **không** có tên em). Quy tắc "thông báo không tên không tiền" mới được thực hiện đủ ở thông báo `parent_reported`. Có áp dụng cho cả hai không? (Đổi chữ này là sửa mã ngoài màn, và bài `t-notify-links.ts` chỉ kiểm `type` và `link`, không kiểm chữ.)
18. **Mâu thuẫn tài liệu cần chốt:** `quyet-dinh-giao-dien-va-hoc-phi.md` mục 4 viết phụ huynh "không có nút xác nhận", nhưng mã có nút `Tôi đã chuyển` phía phụ huynh và màn này hiện trạng thái `Phụ huynh báo đã chuyển`. Thiết kế màn gia sư theo mã (có trạng thái này); xin chủ dự án xác nhận.
19. **`Sửa số tiền` có thể đóng phiếu mà không báo trước.** Máy chủ (`set_amount`) đặt trạng thái theo `statusAfterPayment`: nếu số mới ≤ số đã nhận, kể cả nhập `0` cho phiếu chưa nhận đồng nào, phiếu **tự thành `Đã đóng`** (có `paidAt`), kể cả phiếu `Nháp` chưa từng gửi, và từ lúc đó không còn nút `Sửa số tiền`. Hộp thoại không cảnh báo điều này và nút `Lưu` chỉ khoá khi số không hợp lệ. Có thêm một dòng báo trước trong hộp thoại (ví dụ khi số nhập ≤ số đã nhận) không? Đây là chữ trên hộp thoại ghi tiền nên cần chủ dự án duyệt; thiết kế không tự tính để hiện, vì cần so `amountDue` mới với `paidAmount` ở máy khách (mục 8 cấm thêm phép tính ở giao diện), nếu duyệt thì phải do máy chủ trả cờ.
20. **Toast kết quả hàng loạt chưa chính xác.** (a) `Đã gửi X/N phiếu.` luôn là toast xanh thành công kể cả khi X = 0, và không nói phiếu nào lỗi; (b) `Đã lập N phiếu nháp. Kiểm tra rồi bấm Gửi.` đếm cả phiếu lập thẳng ở trạng thái `Đã đóng` vì tín dụng trừ hết (không còn là nháp, không cần gửi). Cả hai chữ này nằm trong danh sách bắt buộc giữ ở 7.4 và `ui-tt200.ts` tìm `Đã lập 3 phiếu nháp` / `Đã gửi 3/3 phiếu.` Có sửa chữ hay sắc thái không (cần sửa mã và có thể cả bài test), hay giữ nguyên?
