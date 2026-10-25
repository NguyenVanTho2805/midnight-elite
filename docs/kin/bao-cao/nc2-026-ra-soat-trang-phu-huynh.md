# NC2-026 — Rà soát trang công khai cho phụ huynh (lỗi lọc theo ngày / trạng thái / múi giờ)

Nhánh `claude/nang-cap-2`. Chỉ đọc mã, không chạy máy chủ hay test. Ký hiệu: **[mã]** = thấy trực tiếp trong mã; **[suy]** = suy ra từ mã, chưa chạy thử.

## Kết luận ngắn

Lỗi gốc của Sổ Gia Sư ("buổi hôm nay đã chốt mà báo chưa có buổi") KHÔNG có ở KiN: danh sách điểm danh của phụ huynh lọc theo khoảng ngày của cả tháng, không lọc ngày ≤ hôm nay và không lọc theo trạng thái, nên buổi vừa chốt luôn hiện [mã]. Nhưng rà ra lỗi ngược lại và vài lỗi khác: có 2 lỗi P1, 3 lỗi P2, 3 lỗi P3 (bên dưới).

## Các danh sách phụ huynh nhìn thấy và điều kiện lọc đã kiểm

| # | Chỗ hiển thị | Nguồn | Điều kiện lọc |
|---|---|---|---|
| A | "Chuyên cần tháng này" (mỗi lớp: % · N buổi / "Chưa có buổi điểm danh") | `so-cua-con/[token]/page.tsx:55-58` (và API `parent-portal/[token]/route.ts:116-129`, cùng điều kiện) | `AttendanceRecord` của em; `session.courseId in` lớp có ghi danh `active`; `session.date >= 01 tháng (UTC)` và `< 01 tháng sau (UTC)`; KHÔNG lọc trạng thái, KHÔNG chặn ngày tương lai, không `take`. Tháng lấy từ `currentYearMonth()` (UTC). `computeAttendanceStats` tính cả 4 trạng thái (hệ số 1/0,9/0,8/0,5), bỏ trạng thái lạ. |
| B | "Buổi học sắp tới" | `absenceServer.ts:203-243` | Lịch `active` của lớp em đang `active`; cửa sổ ngày VN `[hôm nay, hôm nay+13]` (`vnDateKeyOf`); sau `applyChanges` giữ buổi có `startAt > now` (huỷ vẫn hiện, dời hiện ở ngày mới); báo nghỉ khớp theo `scheduleId + ngày gốc`. Giờ hiển thị qua `vnMinutesOfDay` (đúng giờ VN, không phụ thuộc múi giờ máy). Không `take`. |
| C | "Con đang giữ N buổi bù" / "Con chưa có buổi bù nào" | `absenceServer.ts:223-227` | `makeupCredit` của em: `status = active` và `expiresAt > now`; không lọc theo lớp còn ghi danh. |
| D | "Báo cáo tháng" | `monthlyReportServer.ts:112-125` | `yearMonth in [tháng này, tháng trước]` và `approvedAt != null`; số liệu đọc từ snapshot đã đóng băng. Snapshot sinh ở `loadStudentMonth` (dòng 74-77) với khoảng `attStart..attEnd` theo tháng, KHÔNG chặn ngày tương lai, ghi danh `active` + `suspended`. |
| E | "Phiếu học phí" | `invoiceServer.ts:186-196` rồi lọc ở `page.tsx:66` | `status in PARENT_VISIBLE_STATUSES`, `take: 60`; sau đó giữ phiếu `yearMonth === tháng này (UTC)` hoặc chưa `paid`. |
| F | "Học phí tháng" | `page.tsx:61, 81-89` | `MonthlyCourseFee` của lớp `active` ở tháng này; số buổi do gia sư nhập, không suy từ điểm danh. |
| G | Trang `/phieu/[token]` | `phieu/[token]/page.tsx` | Chỉ 1 phiếu theo `viewToken`; không có danh sách buổi hay điểm danh. Hết hạn / huỷ / nháp có thông báo riêng, đúng sự thật. Không có lỗi liên quan phạm vi này. |
| H | `/api/parent-portal/**` | `route.ts`, `absences/route.ts`, `invoices/[code]/reported` | Cùng truy vấn như A-F (route.ts) hoặc ghi, không có danh sách mới. `absences` chỉ ghi. |

Không có danh sách buổi đã dạy theo từng ngày cho phụ huynh: chỉ có số tổng (A, D). Vì vậy không có "bảng trống do lọc ngày".

## Phát hiện

### F1 — P1 — Buổi CHƯA dạy hiện như đã dạy trong "Chuyên cần tháng này" [mã]
- `so-cua-con/[token]/page.tsx:55-58`, `parent-portal/[token]/route.ts:123-129`, `monthlyReportServer.ts:74-77`.
- Kịch bản: phụ huynh bấm "Báo nghỉ" cho buổi 3 ngày nữa (cho phép tới 35 ngày, `ABSENCE_MAX_DAYS_AHEAD`), báo trước ≥ 2 giờ nên `markExcused` (`absenceServer.ts:30-41`) tạo ngay `AttendanceRecord(status=excused)` ở ngày tương lai. Khoảng lọc là cả tháng nên bản ghi đó được đếm. Ví dụ em mới học, ngày 5 chưa có buổi nào, báo nghỉ buổi ngày 8: trang hiện "80% · 1 buổi" thay vì "Chưa có buổi điểm danh". Em đã có 4 buổi present, báo nghỉ thêm 2 buổi tuần sau: hiện "N=6 buổi", tỷ lệ bị kéo xuống 0,8 cho 2 buổi chưa diễn ra. Cùng lỗi lọt vào snapshot báo cáo tháng khi gia sư duyệt giữa tháng (đóng băng, không sửa lại được). Đây chính là nhánh mà `taughtSessionWhere` đã bịt cho số liệu công khai (file taughtSessions.ts dòng 5-7 nêu đúng kịch bản này) nhưng cổng phụ huynh chưa dùng.
- Sửa ngắn: thêm `date: { gte: firstDay, lt: min(nextMonth, ngày VN hôm nay + 1) }` cho 3 truy vấn trên (không dùng `taughtSessionWhere` vì phụ huynh phải thấy cả excused/absent; chỉ mượn cách tính "hôm nay = 00:00 UTC của ngày VN"). Nên tách helper `vnTodayAttendanceDate(now)` dùng chung.
- Test đề xuất: `tools/local-e2e/t-portal-attendance-future.ts` — em có 1 bản ghi present hôm qua + 1 excused (do báo nghỉ qua API) ngày +3; kỳ vọng `courses[0].attendance.total === 1`, ratio 1; em chỉ có excused tương lai thì `total === 0`, `ratio === null`.

### F2 — P1 — Em chỉ còn ghi danh "suspended"/"pending_consent": cả trang chỉ hiện "Em chưa ghi danh lớp nào", mất cả phiếu học phí và báo cáo [mã]
- `page.tsx:45-49, 107-111` và `route.ts:88-105`: lọc `status: "active"`; khi rỗng, trang chỉ vẽ một dòng chữ, bỏ qua `invoices`, `reports`, buổi bù (đã tải sẵn ở dòng 66-70 nhưng không vẽ). API thì trả đủ `invoices/reports`, nên API và trang không khớp nhau.
- Kịch bản: hết hạn gói → ghi danh chuyển `suspended` (schema: "đã hết hạn gói hoặc bị tạm dừng"). Phụ huynh còn phiếu học phí chưa đóng, link Zalo gia sư gửi dẫn đúng vào đây, nhưng thấy "Em chưa ghi danh lớp nào" (sai sự thật: em có ghi danh, chỉ đang tạm dừng) và không thấy phiếu cần đóng. Gia sư lại vẫn lập được báo cáo cho `suspended` (`listTutorStudents`) mà phụ huynh không xem được.
- Sửa ngắn: khi `enrollments` rỗng vẫn vẽ phần Phiếu học phí và Báo cáo; chữ đổi theo trường hợp ("Con đang tạm dừng ở lớp X" khi có `suspended`; "chưa ghi danh" chỉ khi thật sự không có bản ghi nào). Cân nhắc đọc điểm danh cả lớp `suspended` cho tháng hiện tại.
- Test đề xuất: `tools/local-e2e/t-portal-suspended.ts` — em chỉ có enrollment `suspended` + 1 phiếu `sent`; trang `/so-cua-con/<token>` phải chứa mã phiếu và không chứa "chưa ghi danh lớp nào".

### F3 — P2 — "Tháng này" tính theo UTC, lệch 7 giờ so với giờ Việt Nam [mã; hậu quả suy]
- `tuition.ts:38-42` `currentYearMonth()` dùng `getUTCMonth()`; được gọi ở `page.tsx:39` và `route.ts:73-74`. So sánh: `monthlyReportServer.isFutureMonth` đã dùng `vnMonthKey` (đúng giờ VN).
- Kịch bản: 00:00-06:59 giờ VN ngày 01 tháng 10, UTC vẫn là 30/9 → trang ghi "Tháng 09/2026", chuyên cần và học phí của tháng 9, báo cáo [09, 08], phiếu tháng 10 đã `paid` bị ẩn (`i.yearMonth === ym`), buổi điểm danh ngày 01/10 (lúc 00:00-07:00) không được đếm. Cửa sổ chỉ 7 giờ/tháng nên P2, nhưng khoảng hay gặp phụ huynh mở link lúc sáng sớm đầu tháng.
- Sửa ngắn: dùng `vnMonthKey(now)` (src/lib/revenue.ts:15) thay `currentYearMonth()` ở hai chỗ; hoặc sửa chính `currentYearMonth` (kiểm xem chỗ khác có chủ ý dùng UTC không — [suy] không thấy).
- Test đề xuất: `tools/local-e2e/t-portal-month-vn.ts` — gọi hàm thuần với `new Date("2026-09-30T20:00:00Z")` kỳ vọng `2026-10`; (nếu cần e2e) tạo điểm danh ngày 01/10 và kiểm trang chứa "Tháng 10/2026".

### F4 — P2 — Chữ "Vắng không trừ tiền" mâu thuẫn với luồng "báo nghỉ sát giờ → tính phí" [mã]
- `page.tsx:191-193` ghi "Vắng không trừ tiền (buổi nào cũng có bản ghi để xem lại)"; trong khi `UpcomingSessions.tsx:20` (`charged`) và `absenceServer.resolveAbsence` cho gia sư chọn "charge" = tính phí buổi nghỉ báo muộn. Phụ huynh đọc hai câu trái nhau trên cùng một trang. Ngoài ra "buổi nào cũng có bản ghi" sai với buổi `charge` (điểm danh để "chưa điểm danh", `absenceServer.ts:7-8`).
- Sửa ngắn: đổi câu thành "Nghỉ có báo trước được tính theo quy định của gia sư; xem phần Buổi học sắp tới." hoặc bỏ câu.
- Test đề xuất: `tools/local-e2e/ui-portal-fee-note.ts` — kiểm trang không chứa chuỗi "Vắng không trừ tiền" (nếu chốt bỏ).

### F5 — P2 — Mẫu số "N buổi" đếm cả "có phép" và "vắng" như buổi học, không có chú thích; phụ huynh không thấy 4 trạng thái riêng [mã]
- `page.tsx:126-130` chỉ in "% · N buổi"; `computeAttendanceStats` cộng cả excused (hệ số 0,8) và absent (0,5) vào `total`. Phụ huynh không thể phân biệt "10 buổi, 8 có mặt" với "10 buổi, 2 vắng, 2 có phép"; buổi do chính họ báo nghỉ ("excused") vẫn đếm là "1 buổi" với 80%, nên báo nghỉ làm TỶ LỆ GIẢM (xem F1: càng rõ với buổi tương lai). Nói thẳng: 4 trạng thái đều được TÍNH, nhưng không trạng thái nào được HIỆN riêng; không có danh sách buổi theo ngày.
- Sửa ngắn: thêm một dòng nhỏ dưới mỗi lớp: "Có mặt a · Muộn b · Có phép c · Vắng d" (đếm từ cùng danh sách bản ghi, thuần, đã có sẵn dữ liệu). Cần quyết định sản phẩm; đây là đề xuất, không bắt buộc.
- Test đề xuất: `tools/local-e2e/t-portal-status-breakdown.ts` — 4 bản ghi, mỗi trạng thái 1, kỳ vọng API/trang trả đủ 4 con số đúng.

### F6 — P3 — "Con đang giữ N buổi bù" đếm cả buổi bù của lớp em không còn học [mã]
- `absenceServer.ts:223-227` không giới hạn `courseId` theo lớp `active`; `nameOf` (dòng 209) chỉ có lớp active nên `items[].courseName` rỗng (`""`). `UpcomingSessions` hiện số tổng nên phụ huynh có thể thấy "2 buổi bù" mà một buổi thuộc lớp không còn để dùng.
- Sửa ngắn: lọc `courseId in` lớp active (hoặc ghi rõ tên lớp). Test: `t-portal-makeup-inactive.ts`.

### F7 — P3 — Buổi đang diễn ra / đã bắt đầu biến mất khỏi "Buổi học sắp tới", và câu rỗng nói "chưa có buổi học nào" [mã]
- `absenceServer.ts:215` `.filter(o => o.startAt.getTime() > now.getTime())` rồi `UpcomingSessions.tsx:79` "14 ngày tới con chưa có buổi học nào theo lịch". Kịch bản: lớp duy nhất của em học 19:00-20:30 thứ Ba, phụ huynh mở lúc 19:30 thứ Ba, không có buổi nào khác trong 13 ngày tới → thấy đúng câu "chưa có buổi nào" trong khi buổi hôm nay vừa bắt đầu. Hiếm vì lịch tuần thường lặp; P3. Cũng: `nowIso` cố định lúc render nên nhãn "còn trong hạn báo nghỉ" (`free`) có thể cũ nếu mở tab lâu; máy chủ vẫn quyết định thật, nên chỉ là chữ.
- Sửa ngắn: giữ buổi có `endAt > now` (hoặc nêu "Hôm nay con đã/đang học"); đổi câu rỗng thành "Trong 14 ngày tới không còn buổi nào theo lịch."
- Test: `t-portal-upcoming-started.ts`.

### F8 — P3 — Phiếu: `take: 60` rồi lọc `yearMonth`/chưa đóng ở trang [mã]
- `invoiceServer.ts:191` lấy 60 phiếu mới nhất; lọc ở page. Chỉ đủ rộng cho vài năm; nếu một phụ huynh có >60 phiếu thì phiếu cũ chưa đóng có thể không hiện. [suy] gần như không xảy ra. Bỏ qua trừ khi có dữ liệu thật.

## Điều đã kiểm và KHÔNG thấy lỗi

- Buổi hôm nay đã chốt: `date` lưu là 00:00 UTC của ngày VN (`normalizeAttendanceDate`); khoảng `[01 tháng UTC, 01 tháng sau UTC)` chứa ngày đó, không loại buổi hôm nay (A). Không lọc theo ngày ≤ hôm nay là nguyên nhân F1, không phải của lỗi Sổ Gia Sư, nhưng cần thêm trần ngày.
- Không có điều kiện `status` nào bị dùng nhầm để ẩn bản ghi: cả 4 trạng thái (present, late, excused, absent) vào `computeAttendanceStats` (A, D).
- Buổi do phụ huynh báo nghỉ: đã có bản ghi `excused` thì hiện trong tổng (xem F1/F5 về đếm); buổi `charged` không có bản ghi nên không hiện — đúng với `absenceServer` nhưng không giải thích cho phụ huynh (liên quan F4).
- Múi giờ ở danh sách sắp tới: tất cả đi qua `vnDateKeyOf`, `vnMinutesOfDay`, `instantOf`; giờ bắt đầu/kết thúc, "dời từ", hạn báo nghỉ đều hiển thị theo giờ VN (B).
- Chữ rỗng đúng sự thật: "Chưa có buổi điểm danh" (A, đúng khi tháng này chưa có bản ghi), "Con chưa có buổi bù nào" (C, đúng khi không còn credit active chưa hết hạn), "Báo cáo" chỉ vẽ khi có (D).
- `/phieu/[token]`: hết hạn 30 ngày, huỷ, nháp (404) có thông báo riêng, không lẫn trạng thái.
- Token không hợp lệ / bị thu hồi: 404, không rò dữ liệu; `limitOrBlock` cho báo nghỉ.

## Phân biệt thấy / đoán

- Thấy trong mã: toàn bộ điều kiện lọc ở bảng trên, F1-F4, F6, F7 (cơ chế). 
- Suy ra (chưa chạy): kịch bản dữ liệu cụ thể trong từng mục (các con số 80%, giờ 19:30...), mức P, F8. Cần chạy test đề xuất để xác nhận trước khi sửa.

## Thứ tự sửa gợi ý

F2 và F1 trước (cùng file page.tsx/route.ts, ít dòng), rồi F3 (một dòng, dùng `vnMonthKey`), rồi F4 (đổi chữ).
