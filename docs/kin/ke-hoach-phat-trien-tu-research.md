# Kế hoạch phát triển thêm — rút từ báo cáo research Sổ Gia Sư

Soạn 21/10/2026. **Bản nháp để Thọ và Thanh duyệt.**
**Trạng thái 21/10:** ĐX-00 và ĐX-01 đã làm phần mã (xem `tien-do-dang-do.md`, mục "ĐX-00" và "ĐX-01"; test dùng DB chưa chạy được ở máy làm việc). Các việc còn lại chưa làm.
Mọi việc đang đi chung nhánh `claude/keen-allen-wiz3em` vì phiên làm việc chỉ được đẩy lên một nhánh; mục 5 "mỗi ĐX một nhánh" chỉ áp dụng khi tách PR sau.

Nguồn: báo cáo research "Sổ Gia Sư (sogiasu.com) + 14 nền tảng tham khảo" (bản 2.1, khảo sát 19/10/2026).
File gốc không nằm trong repo, nên mỗi việc dưới đây trích lại ý chính của nó.
Đối chiếu với: `tien-do-dang-do.md` (ghi đến 16/10), `quyet-dinh-va-doi-chieu.md`, `quyet-dinh-giao-dien-va-hoc-phi.md`,
`prisma/schema.prisma`, mã nguồn, và cột H/I/J/K của sheet *Trang tính1* (đọc 21/10).

## 0. Cách đọc

- **Mã việc `ĐX-xx`** là mã tạm của kế hoạch này. Khi đưa vào sheet, người nhập đặt mã thật.
- **Cỡ** (ước lượng thô, đã tính test): **S** ≤ 1 ngày · **M** 2–3 ngày · **L** hơn 3 ngày.
- **Ghi sheet:** chỉ sửa cột H và I (của Thọ). Không đụng cột J, K của Thanh. Kế hoạch này không thêm dòng mới vào sheet.
- **Ranh giới cứng** (từ `CLAUDE-cho-kho-trien-khai.md` mục 9): chỗ nào có **tiền** hoặc có **trẻ dưới 16 tuổi** thì dừng và hỏi người. Việc nào dính hai thứ này nằm ở Đợt 3, và chưa được phép làm.

## 1. Tóm tắt: làm gì, theo thứ tự nào

Báo cáo viết cho một sản phẩm đang đuổi kịp Sổ Gia Sư. KiN đã đi trước ở Zalo bán tự động, đối soát SePay, dời/huỷ buổi,
chế độ gọn, hồ sơ công khai (xem mục 2). Phần còn trống thật là các việc sau.

| Đợt | Mã | Việc | Cỡ | Cần quyết định? |
|---|---|---|---|---|
| 0 | ĐX-00 | Sửa cách đếm "số buổi đã dạy" công khai (đang đếm được cả buổi rỗng/tương lai) | S | Không |
| 1 | ĐX-01 | Hộp việc: "Buổi đã qua giờ, chưa điểm danh xong" | M | Không |
| 1 | ĐX-02 | PWA + Web Push cho gia sư | L | Có 3 điểm nhỏ (mục 4) |
| 1 | ĐX-03 | Xuất điểm danh tháng (CSV/Excel, in PDF) | M | Không |
| 1 | ĐX-04 | Bảng số đo sức khoẻ sản phẩm trong admin | M | Không |
| 2 | ĐX-05 | Chỉ số tự động trên hồ sơ công khai (gỡ chỗ kẹt của PH-207) | M | Có (chọn chỉ số) |
| 2 | ĐX-06 | Khu vực + hình thức dạy trên hồ sơ gia sư | M | Có (thêm lại Tỉnh/Thành?) |
| 2 | ĐX-07 | Tạo lớp nhanh / học sinh không tài khoản | chưa ước | Có (đổi nền, cần xác nhận chủ ý) |
| 3 | ĐX-08 | Ảnh chuyển khoản đính vào khoản thu | M | **Tiền** — chỉ làm khi số đo cho thấy cần |
| 3 | ĐX-09 | Form "yêu cầu tìm gia sư" rút gọn | L | **Trẻ em** — chờ PH-225 |

Phụ thuộc: ĐX-00 → ĐX-05 · ĐX-04 → ĐX-08 · ĐX-02 → ĐX-09 (thông báo cho gia sư) · ĐX-01 → tin push buổi chưa điểm danh (ĐX-02, giai đoạn 2).

## 2. Báo cáo đề xuất mà KiN đã có (đừng làm lại)

| Đề xuất của báo cáo | KiN đã có |
|---|---|
| Gửi Zalo một chạm, ghi mốc | TT-199 giai đoạn 1. Chỉ ghi "Đã mở Zalo lúc…", cố ý không ghi "đã gửi" |
| Đối soát chuyển khoản bán tự động bằng ảnh | TT-200: webhook SePay, mã `KIN`+5 ký tự, tự gạch chỉ khi đúng mã và đúng số còn lại, "Tôi đã chuyển", nhắc kiểm sao kê sau 24 giờ. Báo cáo giả định "chưa có đối tác ngân hàng", giả định này đã lỗi thời |
| Dời/huỷ buổi, báo nghỉ sát giờ, buổi bù | TT-202 + bảng `class_session_changes`, `class_absences`, `makeup_credits` |
| Ẩn mục chưa dùng | TT-203 (mặc định chỉ Lịch + Học phí) |
| Hồ sơ công khai, nhãn "không thu phí nhận lớp", báo cáo hồ sơ | PH-207, PH-212 (làm một phần) |
| Bài đăng tìm học sinh, nhóm Zalo của lớp | PH-209, PH-216 |
| Doanh thu theo lớp theo tháng, xuất CSV | BE-076, FE-154 |
| Link phụ huynh khó đoán, thu hồi được | `/so-cua-con/[token]` 32 ký tự hex (128 bit), xoay/thu hồi. Link phiếu hết hạn sau 30 ngày, ghi "Phụ huynh đã xem lúc" |
| Lỗi "trang phụ huynh lọc theo ngày ≤ hôm nay" của Sổ Gia Sư | Có vẻ không có ở KiN: API Sổ của con lọc theo tháng trên bản ghi điểm danh (mới đọc lướt, chưa chạy thử) |
| Hạn mức Free/Pro | Hoãn có chủ đích (TT-204, chưa có model `Plan`) |
| Trợ giảng / đồng dạy | Hoãn có chủ đích (D02) |

## 3. Từng việc

### ĐX-00 · Sửa cách đếm "số buổi đã dạy" (Đợt 0, cỡ S)

**Vì sao đứng đầu.** Mọi chỉ số tự động ở ĐX-05 dựa vào con số này. Nó đang đếm sai.

**Hiện trạng** (đọc mã, chưa chạy thử):
- `src/app/api/tutors/[id]/route.ts:54` đếm `attendanceSession.count({ courseId in … })`, không lọc ngày, không lọc bản ghi.
- `POST /api/courses/[id]/attendance-sessions` nhận mọi ngày hợp lệ, kể cả tương lai, không đối chiếu lịch lớp, và không đòi có bản ghi điểm danh nào.
- `markExcused` (`src/lib/absenceServer.ts:30-40`) tự tạo phiên điểm danh cùng một bản ghi `excused` khi phụ huynh báo nghỉ trước. Một buổi có thể chỉ có đúng bản ghi đó mà vẫn được đếm là "đã dạy".
- Chú thích mã ghi "gia sư không tự sửa được". Chưa đúng: gia sư tạo được phiên rỗng ở ngày bất kỳ.
- Ba chỗ cùng đếm: `tutors/[id]/route.ts:54` (hồ sơ công khai và thẻ og), `invites/by-code/[code]/route.ts:52` (có lọc `date ≤ now`, nhưng vẫn đếm phiên rỗng), `tutor/post-draft/route.ts:27` (chữ trong bài đăng tìm học sinh, nên cũng là chữ quảng bá).

**Việc cần làm**
1. Định nghĩa một chỗ duy nhất: *buổi đã dạy* = phiên có `date ≤ hôm nay (giờ VN)` và có ít nhất 1 bản ghi `present` hoặc `late`.
2. Viết hàm thuần (điều kiện `where` dùng chung hoặc hàm đếm), thay ở cả ba chỗ.
3. **Chỉ đổi cách đếm, không chặn tạo phiên tương lai** — để không đổi hành vi của gia sư đang điểm danh thật.
4. Đổi chú thích mã cho đúng. Lời hiển thị công khai dùng "ghi trên KiN", không dùng "đã xác minh".

**Giới hạn còn lại (nói thẳng).** Gia sư vẫn có thể tạo phiên quá khứ giả có bản ghi `present`. Đây là dữ liệu tự khai; kế hoạch này không hứa chống được.

**Test:** hàm thuần (phiên rỗng, phiên tương lai, phiên chỉ có `excused`, phiên đủ); API `/api/tutors/[id]` trả đúng số; cập nhật `t-funnel`/`ui-funnel` nếu chạm. Không đổi schema.

**Xong khi:** ba chỗ cho cùng một con số, và có test cho bốn ca trên.

### ĐX-01 · Hộp việc: "Buổi đã qua giờ, chưa điểm danh xong" (Đợt 1, cỡ M)

**Research nói gì.** Nghẽn số 1 của Sổ Gia Sư: quên bấm "Đã dạy xong" thì mất phí và báo cáo. Đề xuất khối "quá hạn chưa chốt" ở trang chủ (mục 8.4B, 8.6 #1).

**KiN khác ở đâu.** Tiền không còn phụ thuộc điểm danh (`quyet-dinh-giao-dien-va-hoc-phi.md` mục 4), nên quên điểm danh không làm mất tiền. Nhưng điểm danh vẫn nuôi Sổ của con (ví dụ "Toán 7/8"), chuyên cần trong báo cáo tháng và buổi bù. Hộp việc hiện có 9 loại việc (`src/lib/tutorTodo.ts`), không có loại này. Mức khẩn: không khẩn (`urgent: false`).

**Thiết kế**
- Thêm loại việc `unmarked` vào `TodoCounts`/`tutorTodo.ts`, `loadTutorTodoCounts` (`tutorDashboard.ts`), `tutorInboxServer.ts` và `tutorInbox.ts`. Số đỏ trên thanh module và khung đọc dùng chung một nguồn, nên chỉ cần thêm ở các chỗ này.
- Nguồn: các buổi của 14 ngày qua, lấy từ `applyChanges(rules, changes, from, to)` (đã tôn trọng dời/huỷ). **Viết hàm nhẹ riêng**, đừng gọi `loadTutorSchedule`: hàm đó dựng tin nhắc cho từng em × từng buổi, thừa cho cửa sổ quá khứ.
- Một buổi tính là *chưa điểm danh xong* khi: không bị huỷ · đã qua giờ kết thúc cộng 60 phút (hằng số "đề xuất" trong `classSessions.ts`, như các hằng số cùng loại) · lớp `classStatus = open` · **còn ít nhất 1 học sinh `active` chưa có bản ghi điểm danh** ở ngày hiệu lực của buổi.
- **Không dùng "đã có phiên điểm danh" làm tiêu chí.** `markExcused` tạo phiên khi phụ huynh báo nghỉ trước (xem ĐX-00), nên phiên tồn tại chưa nghĩa là gia sư đã điểm danh.
- Loại trừ: buổi trước ngày tạo khung giờ (`ClassSchedule.createdAt`, thêm vào truy vấn) · em ghi danh sau ngày buổi đó (`Enrollment.createdAt`).
- Phải kiểm: `ClassAbsence` ở trạng thái `charged` có sinh bản ghi điểm danh không. Nếu không, em đó phải được coi là đã xử lý, nếu không dòng việc sẽ không bao giờ hết.
- Dòng việc: "Lớp — ngày giờ — thiếu N/M em". Đích: trang điểm danh của lớp, kèm ngày. Cần kiểm trang đó có nhận `?date=` chưa, chưa thì thêm.
- Buổi không diễn ra thì gia sư dùng **Huỷ buổi** (đã có), không thêm nút "bỏ qua" mới và không thêm bảng.
- Hiệu năng: bộ đếm chạy mỗi lần tải số đỏ. Đo; nếu chậm thì rút cửa sổ từ 14 xuống 7 ngày.

**Test:** mở rộng `t-tutor-inbox-lib`/`t-todo-lib` và `t-tutor-inbox` (API + DB): đủ bản ghi · thiếu 1 em · buổi huỷ · buổi dời · buổi trước khi tạo lịch · lớp đã đóng · em đã báo nghỉ trước · em ghi danh sau · cô lập giữa hai gia sư. `ui-tutor-shell` kiểm số đỏ.

**Không chạm tiền, không chạm trẻ em, không đổi schema.**
**Sheet gần nhất:** TK-172 (điểm danh), TK-179 (Hộp việc).
**Xong khi:** Hộp việc hiện dòng mới đúng với chín ca trên và số đỏ khớp khung đọc.

### ĐX-02 · PWA + Web Push cho gia sư (Đợt 1, cỡ L)

**Research nói gì.** Mục 8.6 #9, giai đoạn 2: PWA + Web Push cho gia sư (nhắc chốt buổi, có yêu cầu mới). Phụ huynh vẫn dùng Zalo.

**Hiện trạng.** Không có manifest, service worker, hay thư viện push (đã tìm trong cây mã và `package.json`). Thông báo trong app đi qua bảng `notifications` và `src/lib/notify.ts`; vỏ gia sư không có chuông (`tien-do-dang-do.md`, mục V2). Gia sư hiện nhận hai nguồn thông báo: `absence_late` (báo nghỉ sát giờ, `absenceServer.ts:122`) và `bank_tx_pending`/`invoice_paid` (webhook SePay, `api/webhooks/sepay/[tutorId]/route.ts:91`). Việc gấp nhất là báo nghỉ dưới 2 giờ và khoản tiền cần đối soát — hiện gia sư chỉ thấy khi mở app. Lưu ý: phụ huynh bấm "Tôi đã chuyển" **không** tạo thông báo (các route `reported` không gọi `notify()`); thêm lời gọi đó là việc nhỏ đi kèm, có thể để sau.

**Thiết kế**
- **A. PWA tối thiểu:** manifest (dự kiến `app/manifest.ts`; đường dẫn và cách khai báo phải theo hướng dẫn của Next 16, xem ghi chú bên dưới), hai icon 192/512, màu theme theo token Navy, meta cho iOS. Cần file logo PNG (KinMark hiện vẽ bằng SVG).
- **B. Service worker `public/sw.js` chỉ xử lý `push` và `notificationclick`. Không cache offline** — tránh bẫy trang cũ và lỗi phiên đăng nhập.
- **C. Bảng mới `push_subscriptions`:** `userId`, `endpoint` (unique), `p256dh`, `auth`, `userAgent`, `createdAt`, `lastSeenAt`, `revokedAt`. Bảng mới nên không dính cảnh báo `@unique` của sự cố mục P; vẫn chạy `t-db-push-guard`.
- **D. API:** `POST` và `DELETE /api/push/subscribe`, chỉ cho gia sư đã đăng nhập. Khoá VAPID qua `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Thêm dependency `web-push`.
- **E. Móc vào `notify()`:** danh sách loại cho phép, ban đầu chỉ `absence_late` và `bank_tx_pending` (thêm `invoice_paid` nếu Thọ muốn). Gửi sau khi tạo thông báo, nuốt lỗi như `notify()` hiện tại; gặp 404/410 thì đánh dấu `revokedAt`.
- **F. Nội dung tin push không có tên em và không có số tiền** (màn hình khoá hiện chữ). **Dựng chữ push từ `type`, không dùng `message` của thông báo** — `message` hiện chứa tên học sinh và số tiền. Ví dụ: "Có 1 báo nghỉ sát giờ cần xử lý", bấm vào mở Hộp việc. Cùng nguyên tắc với tin chung gửi nhóm Zalo.
- **G. Giờ yên lặng:** tái dùng 22:00–07:00 (`classSessions.ts`). Đề xuất đơn giản: trong giờ yên lặng chỉ tạo thông báo, không push, trừ báo nghỉ dưới 2 giờ. Không cần cron.
- **H. UI:** Cài đặt gia sư, mục "Thông báo đẩy" theo mẫu mục "Kết nối": bật/tắt, danh sách thiết bị, nút gửi thử. Nói rõ trên iPhone phải "Thêm vào Màn hình chính" (iOS 16.4 trở lên).
- **I. Giai đoạn 2:** cuối `remind-class` (cron 07:00 giờ VN, đã có) thêm một tin "Hôm qua có N buổi chưa điểm danh" dựa vào ĐX-01. Không thêm cron mới.

**Cẩn thận**
- **Next 16.** `AGENTS.md` dặn đọc `node_modules/next/dist/docs/` trước khi viết code. Môi trường soạn kế hoạch này chưa `npm install` nên chưa đọc được. **Bước đầu của việc này là cài và đọc hướng dẫn PWA/push của Next 16.**
- `src/proxy.ts` và `hostRouting.ts` phải để `/sw.js` và `/manifest.webmanifest` đi qua, không chuyển hướng theo tên miền. Kiểm bằng test.
- **Bản xem trước Vercel dùng chung cơ sở dữ liệu với production.** Chỉ bật gửi push khi có `PUSH_ENABLED=1` ở môi trường Production, kẻo preview gửi nhầm tới thiết bị thật.
- Phạm vi: chỉ gia sư. Phụ huynh không có tài khoản nên không có push; Zalo vẫn là kênh của họ.

**Test:** hàm thuần (chọn loại, giờ yên lặng, cắt tiêu đề) · API subscribe/unsubscribe, cô lập giữa hai người, 410 · `notify()` với bộ gửi giả · `ui` Cài đặt (quyền bị từ chối, bật, tắt). **Push thật không test tự động được**: kiểm tay trên một máy Android Chrome và một iPhone đã thêm vào Màn hình chính, ghi kết quả vào sheet.

**Việc của Thọ:** tạo cặp VAPID một lần (`npx web-push generate-vapid-keys`) và đặt vào biến môi trường Production; đưa file logo PNG.
**Không chạm tiền, không chạm trẻ em** (nội dung tin không chứa tên em hay số tiền).
**Xong khi:** gia sư bật push trên hai máy thật, báo nghỉ sát giờ làm điện thoại rung, bấm vào mở đúng Hộp việc.

### ĐX-03 · Xuất điểm danh tháng (Đợt 1, cỡ M)

**Research nói gì.** Sổ Gia Sư chỉ xuất Excel bảng điểm danh tháng, không có PDF (nghẽn #8); bản của bạn nên có cả hai (mục 8.5).

**Hiện trạng.** KiN chưa xuất điểm danh. Đã có `toCsv`/`csvCell` trong `src/lib/revenue.ts`, có chống CSV injection. `exceljs` có trong `package.json` nhưng mới chỉ dùng để nhập câu hỏi. Việc in bằng hộp thoại in đã có ở Kế hoạch buổi (PH-223).

**Việc cần làm**
1. `GET /api/courses/[id]/attendance-export?month=YYYY-MM&format=csv|xlsx`. Chỉ gia sư chủ lớp (`ownsResource`) và quản trị. Lưới học sinh × ngày (ký hiệu theo UI điểm danh hiện tại), cột tổng có mặt, dòng đầu ghi tên lớp và tháng. `Cache-Control: no-store`.
2. CSV dùng `toCsv`; Excel dùng `exceljs` nạp động ở phía máy chủ.
3. **PDF = trang in** (`…/diem-danh/in?month=`) với CSS in, người dùng bấm in và chọn "Lưu thành PDF". Không thêm thư viện PDF.
4. Nút "Xuất" trên trang điểm danh.
5. **Phiếu học phí dạng ảnh/PDF để gửi Zalo: chưa làm.** Link `/phieu/…` đã có QR. Chỉ cân nhắc lại nếu ĐX-04 cho thấy tỷ lệ phụ huynh mở link thấp.

**Cẩn thận:** tên học sinh là dữ liệu cá nhân, nên chỉ gia sư chủ lớp tải được; tên kiểu `=cmd(...)` phải được chống injection (test); tháng sai định dạng trả 400.
**Test:** hàm dựng lưới (tháng 28/30/31 ngày, em ghi danh giữa tháng) · API (quyền, lớp của người khác trả 403, tên chứa `=`) · `ui` nút xuất.
**Sheet gần nhất:** TK-172.
**Xong khi:** gia sư tải được CSV/Excel đúng với màn điểm danh và in được ra PDF.

### ĐX-04 · Bảng số đo sức khoẻ sản phẩm (Đợt 1, cỡ M)

**Research nói gì.** Mục 8.7–8.8: đo "số phiếu được gửi / số phiếu tạo"; nếu dưới 50% mới cân nhắc ZNS có phí. Kèm chỉ số cho từng giai đoạn.

**Hiện trạng.** `/admin/pheu` mới đo bước 1–2 của phễu hồ sơ. Dữ liệu cho các số đo khác **đã có sẵn**: `tuition_invoices` (`sentAt`, `zaloOpenedAt`, `parentViewedAt`, `parentReportedAt`, `paidAt`), `bank_transactions` (`kind`, `status`, `resolution`, `provider`), `attendance_records` (`zaloOpenedAt`, `createdAt`), `class_reminder_logs`.

**Chỉ số đề xuất** (mỗi cái hiện kèm mẫu số):
1. Phiếu đã gửi → gia sư đã mở Zalo.
2. Phiếu đã mở Zalo → phụ huynh đã xem.
3. Phiếu đã gửi → đóng đủ trong 14 ngày.
4. Khoản tiền vào: tự gạch / chờ gia sư / ghi tay; tuổi của khoản chờ lâu nhất.
5. Buổi có bản ghi điểm danh trong ngày hoặc ngày hôm sau (dùng thời điểm tạo bản ghi đầu tiên, vì `AttendanceSession.date` không có giờ).
6. Số gia sư có ít nhất 1 buổi điểm danh trong 30 ngày; số gia sư gửi ít nhất 1 phiếu trong tháng.

**Nguyên tắc**
- Chỉ số tổng hợp, không có tên học sinh. Chỉ `admin_super`/`admin_content`, cùng quyền với `/admin/pheu`.
- **Dưới 10 mẫu thì hiện "chưa đủ dữ liệu", không hiện phần trăm.** Hiện quy mô còn rất nhỏ (25 học sinh); phần trăm trên mẫu nhỏ là ngộ nhận. Đây chính là bài học về con số "1.200+ học viên" ghi trong `quyet-dinh-va-doi-chieu.md` mục 4.
- Trang mới phải được đưa vào module admin trong `src/lib/adminNav.ts`; `t-admin-queue-lib` quét thư mục và sẽ đỏ nếu quên.
- Không đổi schema.

**Dùng để quyết:** có cần Zalo OA ở TT-199 giai đoạn 2 (Thanh ghi ~1.000.000đ/năm cộng khoảng 300đ/tin) · có cần phiếu ảnh/PDF · có cần ĐX-08.
**Test:** công thức thuần từ dòng giả lập · API quyền (gia sư nhận 403) · `ui`.
**Sheet gần nhất:** PH-210.
**Xong khi:** admin xem được sáu chỉ số, mỗi chỉ số có mẫu số và định nghĩa ngay trên màn.

### ĐX-05 · Chỉ số tự động trên hồ sơ công khai (Đợt 2, cỡ M, cần quyết định)

**Phụ thuộc ĐX-00.**

**Research nói gì.** Mục 8.4D: hồ sơ hiện 3 chỉ số sinh từ dữ liệu vận hành ("đã dạy N buổi", "đang dạy N học sinh", "chốt đúng ngày X%"); chưa có đánh giá sao ở giai đoạn 1; sắp xếp mặc định theo "đang hoạt động" (có buổi trong 30 ngày).

**Chỗ kẹt cần gỡ.** PH-207 chưa làm "tỉ lệ buổi được phụ huynh xác nhận" vì cơ chế xác nhận đã bỏ, nên không có dữ liệu. **Đề xuất bỏ hẳn vế đó** và thay bằng chỉ số tính từ dữ liệu sẵn có:
- Số buổi đã dạy (theo định nghĩa mới của ĐX-00).
- Số học sinh đang dạy (đã có `studentCount`).
- "Hoạt động gần đây": có ít nhất 1 buổi đã dạy trong 30 ngày.
- "Điểm danh đúng hạn %" (tuỳ chọn): chỉ hiện khi từ 10 buổi trở lên. Cẩn thận: gia sư điểm danh bù hôm sau sẽ bị tính chậm, chỉ số có thể bất công.

**Việc cần làm:** thêm trường vào `stats` của `GET /api/tutors/[id]` và danh sách `/api/tutors`; hiển thị ở `/mentor/[id]` và `TutorCard`; sắp xếp mặc định của `/giang-vien` đưa gia sư hoạt động gần đây lên trước. `TutorCard` là component dùng chung (FE-157/158), nên chạy lại `shoot-tutor-pages.ts` để so ảnh trước/sau.

**Quyết định:** chỉ số nào hiện công khai, và có hiện "đúng hạn %" không. Đây là chữ công khai về một người, nên cần Thanh và Thọ chốt, không tự quyết.
**Sheet gần nhất:** PH-207.
**Xong khi:** hồ sơ và thẻ hiện đúng các chỉ số đã chốt, không còn nhắc "phụ huynh xác nhận".

### ĐX-06 · Khu vực và hình thức dạy trên hồ sơ gia sư (Đợt 2, cỡ M, cần quyết định)

**Research nói gì.** Mục 8.3: nhóm thông tin bắt buộc hiện công khai khi hồ sơ bật (trường đang học/đã tốt nghiệp, bằng cấp hoặc chứng chỉ chính, môn/cấp, khu vực, hình thức online/offline), gắn nhãn "Tự khai". Bộ lọc theo quận/huyện, online/offline, giá.

**Hiện trạng.** Form đăng ký gia sư đã bỏ ô Tỉnh/Thành (`tien-do-dang-do.md` mục U, ghi "Cần Thọ quyết: nếu cần biết khu vực thì thêm lại"). Cột `users.city` và `users.school` vẫn còn. `/giang-vien` mới lọc được theo môn.

**Đề xuất:** **không thêm lại vào form đăng ký** (giữ form ngắn). Thêm vào trang Hồ sơ gia sư (nơi đã có giới thiệu và môn dạy):
- Tỉnh/Thành (dùng `users.city`), Quận/Huyện, Hình thức (online / offline / cả hai), Trường và bằng cấp chính (≤ 100 ký tự, nhãn "Tự khai"), giá tham khảo mỗi buổi (tuỳ chọn, gia sư tự bật).
- Lưu: `city` đã có; phần còn lại vào `User.preferences` hoặc 2 cột cho phép trống, không có `@unique`. Quy mô vài trăm gia sư nên lọc ở máy chủ trên JSON chấp nhận được.
- Chỉ hiện quận/huyện, **không hiện địa chỉ nhà**.
- Bộ lọc `/giang-vien` thêm tỉnh và hình thức.

**Để hỏi:** nhóm nào là "bắt buộc hiện". `CLAUDE-cho-kho-trien-khai.md` nêu Thông tư 29/2024 buộc người dạy thêm có thu tiền công khai lịch dạy, tên người dạy và mức học phí; tôi chưa kiểm hồ sơ công khai có hiện lịch dạy và mức học phí hay không. Đó là căn cứ để hỏi luật sư, không phải ý kiến pháp lý.
**Test:** hàm kiểm dữ liệu · API quyền · `ui-profile-preview` · `shoot-tutor-pages`.
**Sheet gần nhất:** PH-207.
**Xong khi:** hồ sơ hiện đúng nhóm trường đã chốt và `/giang-vien` lọc được theo tỉnh và hình thức.

### ĐX-07 · Tạo lớp nhanh / học sinh không tài khoản (Đợt 2, chưa ước, cần xác nhận)

**Research nói gì.** Onboarding của Sổ Gia Sư rất ngắn: dán cột tên từ Excel, chọn thứ và số tuần là có lớp (mục 1 #6, 8.4A).

**Hiện trạng.** Học sinh vào lớp bằng mã mời **và tài khoản** (`Enrollment.userId`, `api/invites/by-code`). Tôi không thấy chỗ gia sư dán danh sách để tạo học sinh. `/admin/hoc-sinh` ("Thêm học sinh mới") là trang của quản trị. Bản `kin-app` đang chạy có mô hình `students` + token không cần tài khoản — khác kho này. Tài liệu ghi: khi hai bên nói khác nhau, `kin-app` đúng.

**Câu hỏi phải trả lời trước, không làm gì trước đó:** nhóm 1–20 học sinh có nhiều em và phụ huynh không có tài khoản không? Nếu có, đây là đổi nền (học sinh do gia sư tạo), không phải việc nhỏ, và phải đi cùng quyết định về dữ liệu trẻ em. Nếu không, phương án nhẹ là "mời hàng loạt": dán danh sách số điện thoại, KiN sinh mã mời kèm tin Zalo soạn sẵn cho từng phụ huynh.
**Trạng thái:** chờ Thọ xác nhận đây có phải chủ ý hay không. Tôi mới grep, chưa đọc kỹ luồng mời.

### ĐX-08 · Ảnh chuyển khoản đính vào khoản thu (Đợt 3, cỡ M, **đụng tiền**)

**Research nói gì.** Mục 8.4C: đính ảnh chuyển khoản vào phiếu; giai đoạn 2 mới OCR.

**Hiện trạng.** Đã có SePay, "Tôi đã chuyển", ghi tay tiền mặt, hàng chờ đối soát. Ảnh chỉ bù được các ca SePay không phủ: gia sư chưa nối SePay, ngân hàng hoặc ví không hỗ trợ, tranh chấp.

**Điều kiện bắt đầu (do Thọ và Thanh đặt, tôi chỉ đề xuất):** ĐX-04 cho thấy một phần đáng kể phiếu đóng bằng ghi tay/ghép tay hoặc nằm ở "Tôi đã chuyển > 24 giờ, chưa thấy tiền". Mốc ví dụ: từ 30% trong 2 tháng liên tiếp; mốc này chưa có căn cứ.

**Nếu làm, bản tối thiểu:** gia sư (không phải phụ huynh) đính 1 ảnh vào khoản thu ghi tay; thêm cột `proofUrl` cho phép trống ở `bank_transactions`; lưu ở Cloudinary đang dùng; đặt thời hạn xoá; giới hạn dung lượng và loại tệp.
**Ranh giới:** ảnh **không bao giờ** dùng để tự gạch nợ — giữ quy tắc GD-20 (chỉ tự gạch khi đúng mã và đúng số). Biên lai chứa số tài khoản và tên người chuyển nên là dữ liệu cá nhân. Phụ huynh tự tải ảnh lên (không tài khoản) cần thêm giới hạn tốc độ lưu trong cơ sở dữ liệu, vì bộ đếm trong bộ nhớ không đủ trên serverless (bài học đăng nhập mật khẩu, mục H).
**Sheet gần nhất:** TT-200.

### ĐX-09 · Form "yêu cầu tìm gia sư" rút gọn (Đợt 3, cỡ L, **trẻ em**)

**Research nói gì.** Mục 8.4D: form 6 ô không cần đăng nhập (môn, cấp, khu vực, lịch, số Zalo phụ huynh, ghi chú), reCAPTCHA v3, tối đa 3 yêu cầu/ngày/số điện thoại và 10/ngày/IP, không OTP. Gia sư bấm "Nhận lớp" thì lớp được tạo sẵn.

**Hiện trạng.** PH-208 và PH-211 dừng vì form có tên con và bằng chứng đồng ý, tức dữ liệu trẻ em; chờ PH-225 (luật sư).

**Khác biệt của báo cáo:** không thu tên con. Nhưng cấp học, khu vực, giờ học của một đứa trẻ cùng số điện thoại phụ huynh vẫn là dữ liệu liên quan đến trẻ em. **Tôi không kết luận bản rút gọn có thoát khỏi vùng đó hay không.**

**Việc làm được ngay mà không viết code:** thêm câu hỏi này vào danh sách PH-225 để hỏi cùng các câu đã có.
**Nếu được phép sau này:** bảng `tutor_leads`; chống spam bằng bộ đếm trong cơ sở dữ liệu, không dùng bộ nhớ; thông báo cho gia sư (`notify()` + push của ĐX-02); "Nhận lớp" tạo mã mời với tên và số Zalo điền sẵn; đo phễu yêu cầu → thành lớp trong `/admin/pheu`.
**Sheet gần nhất:** PH-208, PH-211, PH-225.

## 4. Quyết định cần chốt

| # | Câu hỏi | Ai | Ảnh hưởng | Mặc định đề xuất |
|---|---|---|---|---|
| Q1 | "Buổi đã dạy" = phiên đến hôm nay có ít nhất 1 em có mặt/muộn; có chặn tạo phiên tương lai không? | Thọ | ĐX-00, ĐX-05 | Chỉ đổi cách đếm, không chặn |
| Q2 | Thêm dependency `web-push`; giờ yên lặng cho push; file logo PNG; chỉ bật push ở Production | Thọ | ĐX-02 | Theo mục 3, ĐX-02 |
| Q3 | Chỉ số nào hiện công khai; có hiện "đúng hạn %" không | Thanh + Thọ | ĐX-05 | 3 chỉ số đầu; "đúng hạn %" tắt |
| Q4 | Thêm lại Tỉnh/Thành, quận/huyện, hình thức, trường, giá tham khảo vào Hồ sơ gia sư? Nhóm nào bắt buộc hiện? | Thọ | ĐX-06 | Thêm vào Hồ sơ, không vào form đăng ký |
| Q5 | Học sinh không tài khoản có phải nhu cầu thật của nhóm 1–20 em không? | Thọ + Thanh | ĐX-07 | Chưa làm |
| Q6 | Ngưỡng nào của ĐX-04 mới mở ĐX-08 | Thọ + Thanh | ĐX-08 | 30% trong 2 tháng (chưa có căn cứ) |
| Q7 | Hỏi luật sư biến thể form rút gọn | Thọ | ĐX-09 | Thêm vào PH-225 |
| Q8 | Có đưa bản text của báo cáo research vào `docs/kin/bao-cao/` để trích dẫn? | Thọ | Mọi mục | Có, chỉ phần chữ |

## 5. Cách làm từng việc

- Mỗi `ĐX` một nhánh và một PR nhỏ. Không gộp.
- Schema chỉ **thêm**. Nhớ sự cố mục P (`tien-do-dang-do.md`): thêm cột `@unique` vào bảng đã có dữ liệu làm build production đỏ; kế hoạch này không có việc nào cần `@unique` trên bảng cũ.
- Mỗi việc đi kèm test trong `tools/local-e2e/`. Trước khi đẩy: `tsc --noEmit`, eslint không tăng so với nền, và chạy lại `t-links`, `t-no-hex`, `t-no-fabricated`, cùng bài vỏ gia sư (`ui-tutor-shell`).
- Không chạy hai bài test cùng lúc (cùng `wipe()` một cơ sở dữ liệu) và không sửa `src/` khi bài đang chạy; xem `tools/local-e2e/README.md`.
- Việc nào dính tiền hoặc trẻ em: dừng và hỏi người, ghi lý do vào cột I của sheet như cách đã làm với PH-208.
- Ghi vào sheet: chỉ cột H và I. Việc chưa có dòng nào thì Thọ/Thanh quyết có thêm dòng hay không.

## 6. Không làm, và vì sao

| Đề xuất của báo cáo | Lý do bỏ |
|---|---|
| Phí phát sinh khi bấm "Đã dạy xong" | KiN tính học phí theo tháng và bậc thang số môn |
| Đổi hình thức học phí của lớp | KiN không có loại phí theo lớp |
| Gói Pro ~42.000đ, hạn mức Free/Pro | Hoãn có chủ đích (TT-204); chưa có model `Plan` |
| Ghi "đã gửi lúc" cho Zalo | KiN không biết tin có đi thật; chỉ ghi "đã mở" |
| Ảnh chuyển khoản tự động gạch nợ, OCR | Trái quy tắc GD-20; đụng tiền |
| Trợ giảng / nhiều giáo viên | D02 hoãn đồng dạy |
| App native | PWA đủ cho nhu cầu hiện tại |

## 7. Giới hạn của kế hoạch này

- Dựa trên tiến độ ghi đến 16/10 và mã nguồn đọc ngày 21/10. **Chưa chạy ứng dụng hay test nào.**
- Môi trường soạn chưa `npm install` (không có `node_modules`), nên chưa đọc được tài liệu Next 16 mà `AGENTS.md` dặn đọc. ĐX-02 phải bắt đầu từ bước đó.
- Các spec của Thanh trong `docs/kin/nghiep-vu/` (ví dụ `pheu-gia-su.md`, `doi-soat-vietqr.md`) **không có trong repo này** (có thể nằm ở `kin-app`), nên chưa đối chiếu được. `kin-app` chưa được xem.
- Dòng BE/FE của sheet chỉ quét theo từ khoá; các dòng TT, PH, TK, NV, AS đọc kỹ.
- Cỡ S/M/L là ước lượng thô. Các điểm ghi "cần kiểm" (trang điểm danh có nhận `?date=`, `ClassAbsence` trạng thái `charged` có sinh bản ghi không, hồ sơ công khai có hiện lịch dạy và mức học phí không) chưa được kiểm.
