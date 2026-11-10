# HOCPHI-THEO-BUOI — Học phí mặc định theo buổi, quy tắc do gia sư hoặc quản trị đặt, bảng tổng hợp cuối tháng

Đặc tả bởi tut-rnd, 05/11/2026. Gộp TUT-001 và phần "an toàn" của CHỦ-01. Không sửa `src/` ở bước này.
Figma: chưa dựng khung nào cho việc này (xem mục 5, dùng lại bộ `src/components/kin/*` và mẫu `RevenueByClassTable.tsx`).

**TIỀN = có. Đây là ngoại lệ có chủ đích cho "học phí chỉ đọc" của PHAM-VI.md** theo quyết định của chủ:
"Việc tính học phí cứ tính theo buổi (per_session) và có quy tắc tính tiền học phí do gia sư HOẶC quản trị đều có quyền đặt;
cuối tháng có bảng dashboard tổng hợp và tính ra tổng học phí."
Nhưng đặc tả này cố ý chia làm hai phần để phần lớn việc **không chạm tệp KHÓA** (`feeChargeServer.ts`, `invoiceServer.ts`, `sessionBookServer.ts`):

- **Phần A (làm ngay, không chạm tệp KHÓA):** lớp MỚI mặc định theo buổi · quyền đặt/ghi đè đơn giá + AuditLog + thông báo · gộp cửa tạo lớp · sửa chữ · bảng tổng hợp tháng (gia sư + quản trị).
- **Phần B (chỉ làm mã, KHÔNG chạy `--apply` trên production tới khi Thọ quyết CHỦ-01):** công cụ chuyển lớp CŨ + "mốc tháng" chống hai hệ phí. Phần này cần sửa 3 tệp tiền đã khóa → mục 10, xin COO.

---

## 1. Vấn đề và bằng chứng

| # | Hiện trạng | Bằng chứng |
|---|---|---|
| 1 | Lớp mới mặc định vẫn là cách cũ (gia sư gõ tay số buổi tháng) | `prisma/schema.prisma:85` `feeMode @default("monthly_sessions")`; `TaoLop.tsx:51` `useState<FeeMode>(FEE_MODE_LEGACY)`; `TaoLop.tsx:197-200` liệt kê cả 4 cách, nhãn "mặc định" gắn cho cách cũ; `api/courses/route.ts:99-107` không gửi `feeMode` → lớp cũ |
| 2 | Ba cửa tạo lớp, chỉ một cửa chọn được kiểu phí | (a) `TaoLop` tại `/lop-cua-toi/lop/tao` (`lop/tao/page.tsx`); (b) `/lop-cua-toi/quan-lop?tao=1` = bí danh re-export trang admin `admin/khoa-hoc/page.tsx:47-48` mở ngăn kéo tạo lớp **không có kiểu phí** → lớp cũ; (c) `/lop-cua-toi/quan-lop/tao-moi` re-export `admin/khoa-hoc/tao-moi/page.tsx` rồi `router.replace("/admin/khoa-hoc?tao=1")`. Sáu nơi trỏ vào (b): `TutorClassList.tsx:21`, `LopHoc.tsx:61`, `HopViec.tsx:67,208`, `TutorLibrary.tsx:69`, `LibraryView.tsx:70`, `ThuVienCuaToi.tsx:63` |
| 3 | Chữ sai với lớp theo buổi | `BuoiChiTiet.tsx:166` "Việc này không tạo hay sửa học phí." — lớp `per_session`/`per_hour` thì bấm "Đã dạy xong" CHÍNH LÀ lúc sinh phí (`close/route.ts:7-10,41`, `feeChargeServer.ts:syncChargesOnClose`) |
| 4 | Comment schema cũ mâu thuẫn | `schema.prisma:1128-1131`: "Vắng KHÔNG trừ tiền (D01). Attendance dùng cho chuyên cần, không cho học phí" — kiểu mới thì điểm danh (có mặt/muộn) quyết định tiền (`tuitionFee.ts:isChargeableStatus`) |
| 5 | Quy tắc đơn giá đã có API nhưng audit chưa đủ để biết "quản trị ghi đè" | `api/courses/[id]/fee-rates/route.ts:19-23` (MANAGE_COURSES + `ownsResource`) cho cả gia sư chủ lớp lẫn `admin_super`/`admin_content`; `:89-93` `logAction` có nhưng metadata không ghi **ai là chủ lớp / có phải ghi đè**, không báo chủ lớp |
| 6 | Không có bảng tổng hợp học phí theo lớp/tháng | `/lop-cua-toi/doanh-thu` (`users/me/revenue/route.ts`) là tiền **ĐÃ THU** (BankTransaction.appliedAmount); `/lop-cua-toi/bao-cao-thang` là báo cáo chuyên cần từng em; `/admin/doanh-thu` là Coin nền tảng. Không trang nào cộng `FeeCharge` theo lớp × tháng |
| 7 | PUT số buổi tháng vẫn nhận ghi cho lớp đã là kiểu mới | `api/courses/[id]/fees/route.ts:50-80` không kiểm `feeMode`; `issueInvoice` bỏ qua dòng đó (`invoiceServer.ts:114,124`) → gia sư gõ vào chỗ không có tác dụng |

### Luật tính tiền HIỆN HÀNH (chỉ mô tả, không đổi) — nguồn `tuitionFee.ts`, `feeChargeServer.ts`
- **Lớp `per_session`:** một dòng `FeeCharge(kind="session")` cho MỖI bản ghi điểm danh (`@@unique([recordId])`), số tiền = đơn giá/buổi tại **ngày của buổi** (`sessionFee`).
- **Điều kiện sinh dòng:** buổi **đã chốt** ("Đã dạy xong", `AttendanceSession.state="closed"`) — lưu điểm danh thôi không sinh (`syncSessionCharges` trả `skipped:"open"`).
- **Có mặt (`present`) và muộn (`late`)** → tính ĐỦ một buổi (không trừ theo phút muộn). **`absent` và `excused` (có phép)** → không tính. Một chỗ duy nhất quyết điều này: `isChargeableStatus` (DD-09, chủ chưa quyết nghĩa "có phép").
- **Buổi bù:** em dùng buổi bù (`MakeupCredit.usedSessionId` = buổi này) thì buổi bù đó **không tính thêm tiền** (`makeupUsed`). Buổi vắng gốc cũng không tính → học bù là 0đ ở cả hai đầu (xem câu hỏi Q4).
- **Miễn:** kiểu mới KHÔNG có "số buổi miễn phí" như `MonthlyCourseFee.freeCount`. Đơn giá riêng của em (`CourseStudentRate`) có sàn 1.000đ (`FEE_RATE_MIN`) nên cũng không đặt được 0đ. Lớp "Miễn phí" = lớp không có đơn giá (không sinh dòng nào).
- **Đơn giá theo ngày:** `pickClassRate` lấy mốc `effectiveFrom` lớn nhất ≤ ngày buổi; buổi trước mọi mốc dùng mốc đầu. Giá riêng của em (`pickStudentRate`) thắng giá lớp nếu đã có hiệu lực. Lớp mới có mốc đầu `2000-01-01` (`FEE_RATE_FROM_START`).
- **Làm tròn:** số nguyên đồng, từng dòng. `per_session`: đơn giá là số nguyên nên không cần làm tròn; `per_hour`: `hourlyAmount = floor((rate×phút×2 + 60)/120)` (nửa đồng làm tròn lên). Không dồn sai số.
- **Đóng băng:** dòng đã vào phiếu (`invoiceId` khác null) KHÔNG đổi: đổi đơn giá chỉ tính lại dòng chưa vào phiếu có `dateKey ≥ effectiveFrom` (`planReprice`); mở lại buổi chỉ gỡ dòng chưa vào phiếu.
- **Tháng của dòng phí:** `FeeCharge.yearMonth` = **tháng dương lịch theo giờ VN của ngày buổi** (`feeChargeServer.ts:syncSessionCharges` `dateKey.slice(0,7)`, `dateKey = vnDateKeyOf(session.date)`), KHÔNG phải chu kỳ 15→14. Hai ngoại lệ: dòng `kind="course"` mang `yearMonth` của **phiếu** đang lập (`ensureCourseCharges`), dòng `kind="extra"` mang tháng của `dateKey` gia sư chọn. Phiếu `TuitionInvoice.yearMonth` và `MonthlyCourseFee.yearMonth` cũng là tháng dương lịch `YYYY-MM`.

---

## 2. Phạm vi tệp

### tut-code (máy chủ)
| Tệp | Việc |
|---|---|
| `src/app/api/courses/route.ts` (POST) | Mặc định `per_session` ở tầng ứng dụng — mục 3.1 |
| `src/app/api/courses/[id]/fee-rates/route.ts` | Ghi đè + AuditLog đầy đủ + thông báo chủ lớp — mục 3.2 |
| `src/app/api/courses/[id]/fees/route.ts` | PUT: 409 nếu lớp đã là kiểu mới (phần A: mọi lớp kiểu mới; phần B: theo mốc tháng) |
| `src/lib/hocPhiDashboard.ts` **(mới, thuần)** | Hàm thuần tính bảng tháng — mục 3.4 |
| `src/lib/hocPhiDashboardServer.ts` **(mới)** | Truy vấn DB → gọi hàm thuần. Tên tệp cố ý KHÔNG khớp mẫu khóa `feeCharge*`/`invoiceServer*`; chỉ ĐỌC `FeeCharge`, `TuitionInvoice`, `AttendanceSession` |
| `src/lib/feeRuleAudit.ts` **(mới, thuần)** | Dựng metadata audit + nội dung thông báo (để test thuần, không tên/tiền) |
| `src/app/api/tutor/hoc-phi-thang/route.ts` **(mới)** | GET bảng tháng của gia sư — mục 4 |
| `scripts/chuyen-lop-cu-sang-theo-buoi.ts` **(mới, phần B)** | Công cụ chuyển lớp cũ — mục 3.5 |
| `src/lib/feeModeFloor.ts` **(mới, thuần, phần B)** | `effectiveFeeModeForMonth` — mục 3.3 |
| Test: `tools/local-e2e/t-hocphi-theo-buoi.ts`, `t-hocphi-dashboard.ts`, `t-hocphi-dashboard-lib.ts`, `t-fee-month-floor-lib.ts`, `t-hocphi-chuyen-lop.ts` | mục 8 (do tut-test viết; tut-code viết các `*-lib` đi kèm hàm thuần) |

### tut-dev (giao diện)
| Tệp | Việc |
|---|---|
| `src/components/tutor/TaoLop.tsx` | Mặc định theo buổi, gập các cách khác, bỏ "cách cũ" khỏi lựa chọn lớp mới |
| `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/page.tsx` | Bọc: `?tao=1` → `redirect("/lop-cua-toi/lop/tao")`, ngoài ra vẫn re-export trang gốc |
| `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/tao-moi/page.tsx` | Thay re-export bằng `redirect("/lop-cua-toi/lop/tao")` |
| `src/components/tutor/BuoiChiTiet.tsx:166` + trang `src/app/lop-cua-toi/(tutor)/buoi/[courseId]/[dateKey]/page.tsx` | Sửa chữ theo kiểu phí (trang server đọc `Course.feeMode` rồi truyền prop; **không** thêm trường vào `loadSessionDetail` vì tệp đó KHÓA) |
| `src/components/tutor/LopHocPhi.tsx` | Chữ "ai đặt" + nhắc lịch sử có ghi đè; prop `adminView` (ẩn nút "Mở Học phí và đối soát" — quản trị không vào được `/lop-cua-toi/hoc-phi`) |
| `src/app/lop-cua-toi/(tutor)/hoc-phi/thang/page.tsx` + `HocPhiThangClient.tsx` **(mới)** | Bảng tháng của gia sư |
| `src/app/lop-cua-toi/(tutor)/hoc-phi/HocPhiClient.tsx` | Thêm một liên kết "Học phí theo tháng" (đầu trang), KHÔNG thêm tab (tránh đụng 3 tab đối soát) |
| `src/components/tutor/HocPhiThang.tsx` **(mới)** | Bảng + trạng thái dùng chung cho trang gia sư và trang quản trị |
| 6 liên kết `?tao=1` ở mục 1.2 | Đổi thành `/lop-cua-toi/lop/tao` (giữ phần chữ) — **trừ** `TutorLibrary.tsx` và `LibraryView.tsx` thuộc `components/library/**`, PHAM-VI chưa gán → để redirect ở trên đỡ; không sửa hai tệp đó |
| Test UI: `tools/local-e2e/ui-tao-lop-per-session.ts` (sửa/ghép từ `ui-tao-lop-wizard.ts`), `ui-hocphi-thang.ts` | mục 8 |

### Phòng Quản trị sở hữu (KHÔNG sửa từ phòng Gia sư — ghi ở mục 10)
`src/app/api/admin/hoc-phi-thang/route.ts`, `src/app/(admin)/admin/hoc-phi-thang/page.tsx`, `src/lib/adminNav.ts` (một dòng menu), và **hai tệp lớn** `admin/khoa-hoc/[id]/page.tsx`, `admin/thi-thu/**` — việc này **không đòi sửa** hai tệp đó (xem 3.1 và 3.2: dùng lại `LopHocPhi` nhúng từ trang mới).

---

## 3. Quyết định kỹ thuật

### 3.1 `feeMode` mặc định cho lớp MỚI = `per_session`, KHÔNG đổi `schema.prisma`
- Cột vẫn `@default("monthly_sessions")` để mọi lớp cũ và mọi đường chưa biết (bản sao, seed, test cũ) không đổi. Mặc định mới đặt ở **hai nơi ứng dụng**:
  1. **`TaoLop.tsx`**: `useState<FeeMode>("per_session")`. Danh sách chọn chỉ hiện "Theo buổi" (nhãn "mặc định"); `per_hour` và `per_course` nằm trong `<details>` "Cách tính khác"; **"Theo số buổi trong tháng (cách cũ)" bỏ khỏi lớp mới** (mục 9 Q1). Lớp "Miễn phí" vẫn không gửi `feeMode`/`feeRate` (giữ `t-free-class-fee.ts`; mục 9 Q2).
  2. **`POST /api/courses`**: nếu thân yêu cầu **có `feeRate` mà không có `feeMode`** → coi là `per_session` (`body.feeMode ?? (body.feeRate !== undefined ? "per_session" : undefined)` trước khối `:99`). Không gửi cả hai → vẫn lớp cũ như trước (giữ `t-hocphi-fee.ts:38`; đó là đường quản trị/ngăn kéo cũ, gia sư không còn đi đường này sau TUT-001).
- Không có đường API nào đổi `Course.feeMode` của lớp đã tạo; giữ bài `t-hocphi-fee.ts:52` (`PUT /api/courses/[id]` bỏ qua `feeMode`). Đổi lớp cũ chỉ qua script (3.5).

### 3.2 Ai đặt quy tắc, ghi đè, audit
- **Quy tắc = đúng cái đã có:** `CourseFeeRate` (đơn giá lớp theo ngày hiệu lực), `CourseStudentRate` (giá riêng em), cùng một API `POST /api/courses/[id]/fee-rates` (`preview_class|set_class|preview_student|set_student`). Không thêm loại quy tắc nào; không thêm luật vắng/muộn/bù (mục 1).
- **Quyền, không thêm quyền mới:**
  | Người gọi | Kết quả |
  |---|---|
  | Chưa đăng nhập | 401 |
  | Học sinh / gia sư **chờ duyệt** (role `student`) | 403 (`requirePermission` đòi `role==="admin"`). **Không dùng `requireTutorOrApplicant`** cho API tiền: hàm đó cố ý cho người đang chờ duyệt đi qua; ở đây phải chặn. Test khẳng định |
  | Gia sư chủ lớp (`adminRole teacher`, `ownerId===userId`) | được |
  | Gia sư khác | 403 "Bạn không có quyền với lớp này" (đã có `:23`) |
  | Lớp không có | 404 (đã có `:21`) — 404 đứng trước 403 thì không lộ tên lớp: giữ đúng thứ tự hiện tại |
  | Lớp `ownerId = null` (lớp trung tâm) | gia sư 403; quản trị được |
  | `admin_super` / `admin_content` (cùng có `MANAGE_COURSES`, `ownsResource` luôn true) | **được đặt/ghi đè mọi lớp** — "ghi đè" = `actor.userId !== course.ownerId`. Chọn quyền có sẵn `MANAGE_COURSES`; muốn siết chỉ `admin_super` thì thêm đúng một dòng kiểm `adminRole` (Q3) |
- **AuditLog (`logAction`, đã gọi ở `:89`) — thêm trường:** `byRole` (`teacher|admin_super|admin_content`), `override: boolean`, `ownerId`, `previousRate` (mốc hiện hành trước khi đổi, hoặc `null`), `preview: false`. Hành động giữ `course_fee.set_rate` / `course_fee.set_student_rate`; ghi đè dùng thêm hậu tố ở metadata, không đổi tên action cũ (bài cũ còn khớp). Gia sư tự đổi lớp mình **cũng** ghi (đã có, giữ). Không ghi tên em: `set_student` chỉ lưu `studentId` (như hiện nay).
- **Thông báo khi quản trị ghi đè** (`notify()` đã có, chỉ GỌI, không sửa `notify.ts`): `type: "course_fee_override"`, `title: "Quản trị đã đổi đơn giá một lớp của bạn"`, `message: "Đơn giá một lớp của bạn vừa được quản trị thay đổi. Mở tab Học phí của lớp để xem lịch sử đơn giá."`, `link: /lop-cua-toi/<courseId>?tab=hoc-phi` (tut-dev xác nhận khóa tab ở `LopChiTiet.tsx:241`). **Không** có tên lớp, tên em, hay số tiền. Chỉ gửi khi `override && ownerId`; chống dội: bỏ qua nếu đã có thông báo chưa đọc cùng `type`+`link`. Nội dung dựng ở `feeRuleAudit.ts` (thuần) để test "không có chữ số, không tên".
- **Xem trước** (`preview_*`) không ghi audit, không thông báo (như hiện nay).
- **Quản trị đặt quy tắc từ đâu:** trang mới `/admin/hoc-phi-thang` có nút "Đổi đơn giá" mỗi lớp mở ngăn nhúng `<LopHocPhi courseId feeMode adminView />` (component của tut-dev, gọi đúng API trên). Nhờ vậy **không sửa `admin/khoa-hoc/[id]/page.tsx`**.

### 3.3 Chống hai hệ phí trên một lớp (đã kiểm `issueInvoice`/`ensureCourseCharges`)
Kết quả đọc mã:
- `issueInvoice` (`invoiceServer.ts:110-124`) chia **theo từng lớp** bằng `normalizeFeeMode(course.feeMode)`: lớp cũ → `MonthlyCourseFee` × `computeMonthlyFee`; lớp mới → `FeeCharge`. Một lớp chỉ đi MỘT trong hai đường, và một phiếu là `(tutorId, studentId, yearMonth)` duy nhất (`:100-106`, khóa duy nhất + advisory lock). Phiếu gộp nhiều lớp là thiết kế sẵn, không phải lỗi.
- `ensureCourseCharges` chỉ chạm lớp `per_course` (`feeChargeServer.ts:ensureCourseCharges`).
- `loadUninvoicedCharges` lấy mọi `FeeCharge` chưa vào phiếu của `(tutor, em, tháng)` **không lọc theo `feeMode` của lớp** → hôm nay an toàn chỉ vì không có đường nào đổi `feeMode`.
- **Hệ quả:** hai hệ trên một lớp/em/tháng chỉ xuất hiện nếu `feeMode` bị đổi giữa chừng. Ba kịch bản hại: (i) đổi giữa tháng, phiếu tháng đó đã lập theo `MonthlyCourseFee` rồi `FeeCharge` mới của cùng tháng bị "gộp khoản rời" (`looseChargeServer.attachLooseCharges`) → tính hai lần; (ii) đổi xong, tháng trước chưa lập phiếu bị `issueInvoice` coi là kiểu mới → mất học phí tháng trước; (iii) buổi đã chốt từ đầu tháng không có `FeeCharge` → mất tiền.
- **Quy tắc (áp phần A + B):**
  1. **`feeMode` không đổi qua API** (đã đúng). Sửa duy nhất là script mục 3.5.
     - **Ngoại lệ duy nhất (HP-LOP-TRUONG, 09/11/2026, chờ chủ duyệt):** `PUT /api/tutor/lop/[courseId]/bang-hoc-phi/cau-hinh` với `enable` được đổi `feeMode` sang `monthly_sheet`, **chỉ** cho lớp chưa có `FeeCharge` và chưa có `MonthlyCourseFee`. Lớp đã có tiền thì bị từ chối (409 `NOT_SHEET_MODE`), lớp cũ giữ nguyên. Chi tiết: `HP-LOP-TRUONG.md` quyết định M2. Quy tắc 2–6 bên dưới không đổi.
  2. **Mốc = đầu một THÁNG** `S` (`YYYY-MM`). Lưu bằng dữ liệu có sẵn: `CourseFeeRate` đầu tiên của lớp chuyển có `effectiveFrom = "S-01"` (lớp tạo mới luôn là `2000-01-01`, tức không có mốc). Không thêm cột.
  3. Hàm thuần `effectiveFeeModeForMonth(feeMode, classRates, yearMonth)` trong `src/lib/feeModeFloor.ts`: nếu `feeMode` là kiểu mới **và** mốc đầu tiên ≠ `2000-01-01` **và** `yearMonth < tháng của mốc` → trả `monthly_sessions`; ngược lại trả `feeMode`. Một lớp ⇒ đúng một hệ cho mỗi tháng.
  4. Nơi dùng (cần sửa tệp KHÓA — mục 10): `issueInvoice` thay `normalizeFeeMode(e.course.feeMode)` bằng hàm trên (cần đọc `courseFeeRate` của các lớp trong cùng giao dịch); `syncSessionCharges` trả sớm `skipped:"before_start"` khi `dateKey` < mốc; `api/users/[id]/tuition` cùng bộ lọc; `api/courses/[id]/fees` PUT (409 nếu tháng ≥ mốc).
  5. `fee-rates` POST: lớp có mốc → từ chối `effectiveFrom < "S-01"` (400, "Lớp này tính theo buổi từ tháng S"), nếu không một mốc lùi sẽ hạ "sàn" và mở lại hệ cũ/mới chồng nhau.
  6. Không sửa, không xóa phiếu hay `FeeCharge` đã có. Chuyển lớp chỉ **thêm** `CourseFeeRate` và (tùy chọn) `FeeCharge` cho buổi đã chốt thuộc tháng ≥ S.

### 3.4 Bảng tháng — nguồn và công thức
- **Tháng = `yearMonth` dương lịch giờ VN `YYYY-MM`** (khóa `FeeCharge.yearMonth` / `TuitionInvoice.yearMonth`). Mặc định = `vnMonthKey(new Date())` (`revenue.ts:15`). Không dùng chu kỳ 15→14. Tháng sai định dạng hoặc ở tương lai → 400.
- **Nguồn chính = `FeeCharge`** (phát sinh, chưa cần có phiếu). Phiếu chỉ dùng để (a) tách "đã vào phiếu / chưa" qua `invoiceId`, (b) đếm dòng nằm trong phiếu **đã huỷ** (dòng phí không được thả khi huỷ phiếu, nên vẫn tính là phát sinh và hiện riêng), (c) lớp cũ (dưới).
- **Cột mỗi lớp:**
  | Cột | Cách tính |
  |---|---|
  | Lớp, Cách tính | `Course.name`, `FEE_MODE_LABEL` |
  | Số buổi đã chốt | đếm `AttendanceSession` của lớp có `state="closed"` và `date` trong tháng (`date` là 00:00 UTC của ngày VN → so `toISOString().slice(0,7)`). **Kể cả buổi không em nào bị tính phí** |
  | Số học sinh | số `studentId` khác nhau có ít nhất một `FeeCharge` `kind∈{session,course}` của lớp trong tháng. Chỉ SỐ, không tên |
  | Học phí tháng | Σ `amount` các `FeeCharge` `kind∈{session,course}` có `yearMonth = tháng` |
  | Phí khác | Σ `amount` `kind="extra"` (tài liệu, quỹ lớp) — tách riêng, không lẫn học phí |
  | Tháng trước, Chênh (đ), Chênh (%) | cùng công thức với `prevYearMonth`; chênh = hiện tại − trước (đồng, có dấu); % = `pctChange` |
- **`pctChange(prev, cur)`** (thuần, số nguyên): `prev = 0` → `null` (hiện "Mới", không chia 0); ngược lại làm tròn **nửa ra xa số 0** tới **1 chữ số thập phân** bằng `Math.floor((|cur−prev|×2000 + prev) / (2×prev)) / 10` rồi gắn dấu. `prevYearMonth("2026-01") = "2025-12"`.
- **Tổng dòng cuối:** cộng các cột trên (không cộng lại phần trăm: tính `pctChange` từ hai tổng).
- **Lớp cũ (`monthly_sessions`) trong bảng:** KHÔNG có `FeeCharge`. Lấy từ phiếu: Σ `breakdown.perSubject[].subtotal` của phiếu **không huỷ** tháng đó, theo `courseId` (đúng cách `users/me/revenue` đã quy về lớp). `Học phí tháng` = tổng đó (trước học bổng/giảm trừ/giảm %/tín dụng); chưa lập phiếu → `null`, hiện "Chưa lập phiếu". `Số học sinh` = số phiếu có `subtotal>0`. Dòng gắn nhãn "Cách cũ, theo phiếu". Tổng dưới bảng tách **"Theo buổi" / "Cách cũ (theo phiếu)" / "Cộng"** để không trộn thầm hai nguồn.
- **Hai nguồn khớp nhau thế nào:** với mỗi phiếu không huỷ, `Σ FeeCharge.amount (invoiceId = phiếu)` phải bằng `breakdown.chargesTotal` (kể cả sau "gộp khoản rời", nơi `chargesTotal` được cộng thêm). Bảng KHÔNG dùng `amountDue` (đã trừ học bổng, giảm %, tín dụng) nên **không** khớp `amountDue`; chữ chú thích dưới bảng nói rõ "trước giảm giá và học bổng". Khoản gộp từ tháng khác nằm ở tháng của `FeeCharge.yearMonth`, không ở tháng của phiếu — test mục 8 kiểm hiệu số này bằng 0 cho phiếu thường.
- **Hàm thuần** (`hocPhiDashboard.ts`): `isYearMonth`, `prevYearMonth`, `pctChange`, `buildMonthTable({ ym, courses, charges, closedSessions, legacyInvoices, cancelledInvoiceIds })` → `MonthTable`. Không Prisma, không `node:*`. `hocPhiDashboardServer.ts` chỉ chạy bốn truy vấn đọc rồi gọi hàm thuần (một truy vấn `FeeCharge` cho cả hai tháng `{ym, prev}`, không N+1).

### 3.5 Công cụ chuyển lớp CŨ → theo buổi (phần B; lớp cũ KHÔNG tự đổi)
`scripts/chuyen-lop-cu-sang-theo-buoi.ts`, chạy `npx tsx scripts/chuyen-lop-cu-sang-theo-buoi.ts …`.

```
--from-month YYYY-MM     bắt buộc; = tháng hiện tại hoặc tháng kế (giờ VN). Tháng đã qua → từ chối cả lượt
--rates tệp.json         bắt buộc; {"<courseId>": <đồng/buổi>}. Lớp thiếu đơn giá → BỎ QUA (không đoán đơn giá từ bậc thang cũ 70/60/55/50k)
--course id[,id] | --owner userId    chọn lớp (mặc định: mọi lớp cũ có trong --rates)
(mặc định)               DRY-RUN: chỉ in, không mở giao dịch ghi
--apply --yes            mới ghi. Thiếu một trong hai → in kế hoạch rồi thoát mã 1
--allow-production --confirm-month YYYY-MM    bắt buộc thêm khi VERCEL_ENV=production hoặc NODE_ENV=production (confirm-month phải bằng from-month); không có → thoát mã 2, không ghi
```
- `VERCEL_ENV=preview` → luôn từ chối kể cả có cờ (dùng chung DB production, như `moneyPathsBlocked`). Đầu ra luôn in **host của DATABASE_URL** (không in mật khẩu).
- **Báo cáo mỗi lớp** (tên lớp + id; **không tên học sinh**): `ĐỔI` hoặc `BỎ QUA (lý do)`, số học sinh đang học, số buổi đã chốt từ `S-01` sẽ được tính bù + tổng tiền dự kiến (đồng), số phiếu bị ảnh hưởng theo trạng thái `draft/sent/paid/cancelled`.
- **BỎ QUA nếu:** đã là kiểu mới · có phiếu **không huỷ** tháng ≥ S mà `perSubject` chứa lớp (mọi trạng thái; ghi rõ số phiếu `paid`/`sent`/`draft`, kể cả nháp — gia sư phải huỷ nháp và lập lại thì mới chuyển) · có `MonthlyCourseFee` `sessionCount>0` ở tháng ≥ S · thiếu đơn giá · đơn giá không qua `validateFeeSetup`.
- **Khi `--apply --yes`, mỗi lớp một giao dịch:** (1) `Course.feeMode="per_session"`; (2) `CourseFeeRate{ mode:"per_session", rate, effectiveFrom:"S-01", note:"Chuyển từ tính theo tháng (CHỦ-01)", createdBy:"script:chuyen-lop" }`; (3) với mỗi buổi đã chốt có `dateKey ≥ S-01` gọi `lockAttendanceSession` + `syncChargesOnClose` (hàm có sẵn, idempotent, không đụng dòng đã vào phiếu); (4) `logAction(null, "course_fee.convert_to_per_session", "Course", id, { fromMonth, rate, backfilled, byScript:true })`. Sau giao dịch: `notify(ownerId, {type:"course_fee_converted", title:"Lớp của bạn đã chuyển sang tính học phí theo buổi", message:"Một lớp của bạn vừa được chuyển sang tính học phí theo buổi từ đầu tháng. Mở tab Học phí của lớp để xem đơn giá.", link})` — không tên, không tiền.
- **Chạy lại** → mọi lớp đã đổi báo `BỎ QUA (đã theo buổi)`, không ghi gì (idempotent). Không có `--revert` ở lần này (Q6).
- Không sửa, không xóa phiếu/`FeeCharge`/`MonthlyCourseFee` nào đã có. Chỉ THÊM `CourseFeeRate`, `FeeCharge`, `AuditLog`, `Notification` và đổi một cột `Course.feeMode`.

### 3.6 TUT-001
- Một cửa tạo lớp: `TaoLop` (`/lop-cua-toi/lop/tao`). `quan-lop/tao-moi` và `quan-lop?tao=1` chuyển hướng 307 sang đó (bọc trong tệp mỏng của gia sư, **không sửa** trang admin). Quản trị vẫn tạo lớp ở `/admin/khoa-hoc` (ngăn kéo hiện có, thuộc phòng Quản trị; lớp đó sẽ là lớp cũ nếu không gửi đơn giá — mục 10, yêu cầu D4).
- Chữ `BuoiChiTiet.tsx:166` khi `!closed && past && !cancelled`: lớp kiểu mới → "Khi dạy xong, bấm **Đã dạy xong** ở khung bên cạnh. Với lớp tính học phí theo buổi, lúc đó học phí của buổi được tính cho em có mặt hoặc đi muộn; lưu điểm danh thôi chưa tính." Lớp cũ → giữ câu cũ "Việc này không tạo hay sửa học phí." Giữ nguyên các chuỗi "Đã dạy xong" mà `ui-session-book.ts` bám.
- Comment `schema.prisma:1128-1131`: xin mục D (chỉ comment).

---

## 4. Hợp đồng API (cho tut-code và tut-dev làm song song)

Form HTML thuần dùng POST + 303; các màn dưới đây là React gọi `fetch` nên trả JSON (đúng mẫu `callApi` của `LopHocPhi`). Trang bảng tháng chuyển tháng bằng **liên kết `?ym=`** (GET, không cần JS).

### 4.1 `POST /api/courses` (đổi nhỏ)
Thân thêm quy tắc: có `feeRate`, không có `feeMode` ⇒ `per_session`. Các lỗi cũ giữ nguyên (`400` hình thức lạ / thiếu số phút / đơn giá < 1.000 hoặc lẻ).

### 4.2 `POST /api/courses/[id]/fee-rates` (đổi nhỏ, giữ hình dạng)
Yêu cầu/đáp ứng giữ như tệp hiện tại. Khác: ghi metadata audit mới; thêm `override: boolean` vào đáp ứng khi `applied` (để UI báo "Đã lưu — chủ lớp sẽ được báo"). Lỗi: 401/403/404 như bảng 3.2; 409 lớp cũ; 400 `effectiveFrom` trước mốc tháng (phần B).

### 4.3 `GET /api/tutor/hoc-phi-thang?ym=YYYY-MM[&courseId=][&format=csv]`
Chỉ gia sư đã duyệt (`requireTutorOnly`): chưa đăng nhập 401 · học sinh, **gia sư chờ duyệt**, quản trị 403 · `courseId` không có 404 · `courseId` của người khác 403 · `ym` sai/tương lai 400. Gia sư chưa có lớp nào → 200 với `rows: []`, `emptyMonth: true`.
```json
{
  "yearMonth": "2026-11", "prevYearMonth": "2026-10", "emptyMonth": false,
  "rows": [{
    "courseId": "toan-9", "courseName": "Toán 9", "feeMode": "per_session",
    "source": "fee_charge",
    "closedSessions": 8, "students": 12,
    "tuition": 7200000, "extra": 0,
    "prevTuition": 6000000, "delta": 1200000, "deltaPct": 20.0
  }],
  "totals": {
    "tuition": 7200000, "extra": 0, "prevTuition": 6000000, "delta": 1200000, "deltaPct": 20.0,
    "closedSessions": 8, "invoiced": 4800000, "uninvoiced": 2400000, "inCancelledInvoice": 0,
    "perSession": 7200000, "legacyByInvoice": 0
  }
}
```
Lớp cũ: `source:"invoice"`, `tuition` có thể `null`. `deltaPct`/`delta` `null` khi tháng trước không có số. **Không có tên/ID học sinh** ở bất kỳ trường nào. Số tiền là số nguyên đồng; UI tự viết đầy đủ `1.250.000đ` (không "tr", không "k"). `format=csv` trả cùng các cột, UTF-8 có BOM, `Cache-Control: no-store`.

### 4.4 `GET /api/admin/hoc-phi-thang?ym=YYYY-MM[&tutorId=]` — **phòng Quản trị làm**
`requirePermission(VIEW_REVENUE)` (đã có, chỉ `admin_super`; không thêm quyền): 401/403 · `ym` sai 400. Cùng hình dạng 4.3, mỗi dòng thêm `tutorId`, `tutorName` (tên **gia sư**, không phải học sinh) và `totals` thêm `byTutor: [{tutorId, tutorName, tuition, extra}]`. Hàm tính dùng chung `hocPhiDashboardServer.ts` (tham số `scope: {tutorId} | "all"`).

---

## 5. Luồng màn

Dùng token `--kin-*` (không hex; `t-no-hex`), nút/hàng bấm cao `--kin-cham-toi-thieu` (≥ 44px ở 390px), tiền bằng `KinMoney` (theo công tắc ẩn tiền `KinMoneyEye`). Chữ xưng "cô" như các màn gia sư hiện có.

### 5.1 Tạo lớp (bước 1 của `TaoLop`)
- **1600px:** hai cột như hiện nay. Mục "Cách tính học phí": một thẻ chọn đã chọn sẵn "Theo buổi · mặc định" + ô "Đơn giá (đ / buổi) *" ngay dưới + câu "Học phí sinh ra khi cô bấm Đã dạy xong, cho em có mặt hoặc đi muộn. Em vắng hoặc có phép không tính. Phiếu đã chốt không đổi khi cô đổi đơn giá sau." Dưới cùng `<details>` "Cách tính khác (ít dùng)" chứa Theo giờ, Theo khoá.
- **390px:** một cột; thẻ chọn và ô đơn giá cao ≥ 44px; `<details>` tóm tắt cao ≥ 44px (đã có `min-h-11`).
- **Ba trạng thái:** tải (nút "Tạo lớp" `loading`) · lỗi (`role="alert"`: thiếu đơn giá → "Cô nhập đơn giá một buổi (từ 1.000đ)" dùng đúng `validateFeeSetup`, lỗi máy chủ giữ câu hiện có) · "rỗng" = lớp Miễn phí: ẩn cả mục, thay bằng một dòng "Lớp miễn phí không có học phí".

### 5.2 Tab "Học phí" của lớp (`LopHocPhi`)
- Đã có đơn giá hiện hành, lịch sử, đơn giá riêng, đổi có xem trước. Thêm: dòng nhỏ dưới tiêu đề "Cô hoặc quản trị đều đổi được đơn giá; mọi lần đổi đều được ghi lại" và, nếu `override` xảy ra gần đây, mục "Lịch sử đơn giá" ghi "(quản trị)" cạnh dòng tương ứng — **chỉ khi API trả được cờ**; nếu chưa có thì không hiện (không bịa). 390px: các nút Xem trước/Lưu ≥ 44px, bảng lịch sử xuống dòng.
- Ba trạng thái: đã có (tải, lỗi "Thử lại", dữ liệu) · rỗng "Chưa có đơn giá" (lớp miễn phí).

### 5.3 Bảng học phí tháng — gia sư `/lop-cua-toi/hoc-phi/thang?ym=`
- **1600px:** tiêu đề "Học phí theo tháng"; bộ chọn tháng (← Tháng 10 · **Tháng 11/2026** · Tháng 12 → là liên kết `?ym=`; không cho sang tháng tương lai); bảng 9 cột theo mục 3.4, dòng tổng cố định cuối bảng; dưới bảng một chú thích 2 dòng ("Tính từ các buổi đã chốt, trước học bổng và giảm giá. Lớp cũ lấy theo phiếu đã lập."); nút "Tải CSV".
- **390px:** mỗi lớp là một thẻ xếp dọc (tên lớp + học phí tháng nổi bật; hàng nhỏ: buổi đã chốt · số học sinh · so với tháng trước `+1.200.000đ (+20,0%)`); dòng tổng là thẻ cuối; bộ chọn tháng hai nút ≥ 44px.
- **Ba trạng thái:** tải (khung xương `kin-skel`) · lỗi (`role="alert"` + "Thử lại") · **rỗng**: "Tháng này chưa có buổi nào được chốt" + gợi ý "Bấm Đã dạy xong ở trang buổi để học phí được tính" + liên kết tới Lịch. Tháng trước không có số → ô chênh hiện "Tháng trước chưa có".
- Không có tên em ở bất kỳ đâu trên trang; không nút xoá/sửa — chỉ đọc.

### 5.4 Trang quản trị `/admin/hoc-phi-thang` (adm-dev; mô tả để khớp)
Bố cục như 5.3 thêm cột "Gia sư" và lọc gia sư; mỗi dòng có nút "Đổi đơn giá" mở ngăn nhúng `LopHocPhi` (`adminView`). Lối vào: mục menu "Học phí theo tháng" nhóm "Theo dõi" trong `adminNav.ts`, quyền `VIEW_REVENUE`. Gia sư mở `/admin/...` vẫn bị `hostRouting` đưa về `/lop-cua-toi` (không sửa). Ba trạng thái như 5.3.

---

## 6. Máy trạng thái

**Duyệt gia sư (chỉ để chặn):** `none → pending → approved(role admin+teacher) | rejected`. Mọi API trong đặc tả này đòi `approved`; `pending` và `rejected` đều là `role student` ⇒ 403.

**Lời mời / ghi danh:** không đổi (BU-01). Điều kiện liên quan học phí: em chỉ có `FeeCharge` khi `Enrollment.status="active"` lúc buổi được chốt (`recordId` thuộc điểm danh của em).

**Buổi → dòng phí (không đổi, ghi lại để test bám):**
```
chưa có bản ghi → (lưu điểm danh) → open ──(Đã dạy xong)──▶ closed ──(Mở lại, xác nhận)──▶ open
                                      │ không sinh dòng phí            │ sinh/đồng bộ FeeCharge          gỡ dòng chưa vào phiếu
                                                                        │ dòng có invoiceId: đóng băng
```
**Kiểu phí của lớp:** `monthly_sessions ──(script, CHỦ-01, mốc tháng S)──▶ per_session`. Không có cạnh ngược, không có cạnh nào khác qua API.

---

## 7. Thông báo (đã gom từ 3.2 và 3.5)
| `type` | Gửi ai | Khi nào | Nội dung | Ràng buộc |
|---|---|---|---|---|
| `course_fee_override` | chủ lớp | quản trị đặt/đổi đơn giá lớp của gia sư khác (`set_*`, không phải `preview_*`) | cố định, xem 3.2 | không tên, không số tiền, không tên lớp; chống dội theo (type, link) chưa đọc |
| `course_fee_converted` | chủ lớp | script `--apply` đổi lớp | cố định, xem 3.5 | như trên |
Cả hai KHÔNG vào `pushRules.ts` (không đẩy ra điện thoại). Không dùng `notifyMany`. `Notification.type` là chuỗi tự do; comment liệt kê loại ở `schema.prisma:1790` xin cập nhật ở mục D (chỉ comment).

---

## 8. Test phải có
Tất cả cần Next ở cổng 3100 + Postgres test (COO chạy tuần tự); tut-test viết, chạy sau khi tut-code/tut-dev xong. Hàm thuần có `*-lib` chạy không cần máy chủ.

**`t-hocphi-dashboard-lib.ts` (thuần):** `prevYearMonth` (01→12 năm trước; 12→11); `isYearMonth` (`2026-13`, `2026-00`, `26-11`, `""` sai); `pctChange` (prev 0 → null; +20,0; −33,3; làm tròn nửa-ra-xa-số-không ở `0,05`; cur=prev → 0,0); `buildMonthTable`: **tháng rỗng** (không dòng nào → mọi số 0/`null`, `emptyMonth`), buổi **vắng** không có dòng phí nên không vào `students` nhưng vẫn vào `closedSessions`, tổng = Σ dòng, tổng `%` tính từ hai tổng chứ không trung bình, dòng `extra` không lẫn `tuition`, lớp cũ `null` khi chưa phiếu và không cộng vào "Theo buổi", đầu ra **không chứa** `studentId`.

**`t-fee-month-floor-lib.ts` (thuần):** `effectiveFeeModeForMonth` — lớp mới (mốc 2000-01-01) mọi tháng → mode; lớp chuyển (mốc `S-01`) tháng < S → `monthly_sessions`, tháng ≥ S → `per_session`; ranh giới đúng 12/2026→01/2027; `monthly_sessions` luôn `monthly_sessions`.

**`t-hocphi-theo-buoi.ts` (API) — ca phá cố ý:**
1. `POST /api/courses` gia sư gửi `feeRate` không `feeMode` → `per_session` + một `CourseFeeRate`; gửi cả hai trống → lớp cũ (giữ `t-hocphi-fee:38`); thiếu đơn giá khi `per_session` → 400; lớp Miễn phí vẫn không `FeeCharge`.
2. **Gia sư B sửa luật lớp của gia sư A → 403**, không ghi `CourseFeeRate`, không ghi `AuditLog`; **lớp không có → 404**; chưa đăng nhập → 401; học sinh → 403; **gia sư chờ duyệt (role student + đơn pending) → 403** trên `fee-rates` GET/POST và `hoc-phi-thang`.
3. **Quản trị ghi đè** (`admin_super` và `admin_content`) đổi đơn giá lớp của A → 200, `AuditLog` có `override:true`, `byRole`, `ownerId`, `previousRate`; **A nhận đúng một `Notification` `course_fee_override`** (hai lần bấm liên tiếp vẫn một); nội dung không chứa chữ số, không tên em/tên lớp. Gia sư A tự đổi → `AuditLog` có `override:false`, **không** thông báo. `preview_*` → không audit, không thông báo.
4. Dòng cũ không đổi: sau khi đổi đơn giá, `FeeCharge` đã vào phiếu giữ nguyên số (đã có ở `t-hocphi-fee`; ghép lại với ghi đè).
5. Luật tính: có mặt/muộn tính đủ; vắng/có phép không tính; buổi dùng buổi bù không tính; **làm tròn** `per_hour` 90 phút × 150.001đ/giờ (nửa đồng lên); chốt hai lần không tạo dòng thứ hai; lưu điểm danh khi chưa chốt không sinh dòng.
6. **Lớp có hai hệ phí (phần B):** tạo lớp cũ có `MonthlyCourseFee` tháng S và phiếu tháng S → script bỏ qua, `feeMode` giữ nguyên; lớp đã chuyển có `FeeCharge` tháng ≥ S nhưng `MonthlyCourseFee` tháng ≥ S bị `PUT .../fees` từ chối 409; `issueInvoice` tháng S−1 của lớp đã chuyển vẫn dùng `MonthlyCourseFee` (không mất học phí tháng trước), tháng S dùng `FeeCharge`; **mỗi (em, tháng) đúng một phiếu** và tổng phiếu = Σ dòng cũ + Σ `FeeCharge`, không dòng nào hai lần.
7. `PUT /api/courses/[id]` vẫn bỏ qua `feeMode`.

**`t-hocphi-dashboard.ts` (API):** (a) hai lớp, hai tháng, kết quả bằng số tay tính; (b) **khớp phiếu:** với mọi phiếu không huỷ, `Σ FeeCharge.amount` theo `invoiceId` = `breakdown.chargesTotal`; (c) **tháng rỗng** → 200, `emptyMonth:true`; (d) tháng trước rỗng → `delta/deltaPct` `null`; (e) **không lộ tên/ID học sinh** (quét toàn thân JSON và CSV tìm tên mẫu và `studentId`); (f) gia sư B xin `courseId` của A → 403, id lạ → 404, `ym=2026-13`/tương lai → 400; (g) lớp cũ có phiếu → `source:"invoice"`, tổng "Theo buổi" và "Cách cũ" tách đúng; (h) dòng nằm trong phiếu **huỷ** vẫn tính vào `tuition` và hiện ở `inCancelledInvoice`; (i) `GET` không ghi gì (đếm bảng trước/sau); (j) gia sư thứ hai không thấy lớp của gia sư thứ nhất trong `rows`; (k) quản trị `admin_super` thấy mọi gia sư, `admin_content` và gia sư → 403 ở route admin (chạy khi adm-code xong).

**`t-hocphi-chuyen-lop.ts` (chạy script bằng `child_process` trên DB test):**
- **Mặc định là dry-run, không ghi gì:** đếm các bảng `courses`, `course_fee_rates`, `fee_charges`, `audit_logs`, `notifications`, `tuition_invoices` trước/sau — bằng nhau.
- `--apply` thiếu `--yes` → mã thoát 1, không ghi.
- **`VERCEL_ENV=production` hoặc `NODE_ENV=production`** có `--apply --yes` nhưng thiếu `--allow-production --confirm-month` → mã 2, không ghi; `VERCEL_ENV=preview` → luôn từ chối.
- **Lớp cũ không đổi** khi: có phiếu `paid`/`sent`/`draft` tháng ≥ S; có `MonthlyCourseFee` tháng ≥ S; thiếu đơn giá; `--from-month` tháng đã qua (cả lượt từ chối).
- Chuyển được: `feeMode`, `CourseFeeRate.effectiveFrom = S-01`, `FeeCharge` bù cho buổi đã chốt tháng S, `AuditLog` `course_fee.convert_to_per_session`, một `Notification`; **phiếu và dòng đã vào phiếu của mọi lớp bất kỳ giữ nguyên byte** (băm JSON trước/sau); chạy lại → không ghi gì.
- Đầu ra script không chứa tên học sinh.

**UI (`ui-*`, cần trình duyệt):**
- `ui-tao-lop-per-session.ts` (sửa `ui-tao-lop-wizard.ts:24-76`: chọn "Theo giờ" nay phải mở `<details>` trước): mở bước 1 thấy "Theo buổi" đã chọn; tạo lớp không đổi cách → DB `per_session` + đúng `rate`; `/lop-cua-toi/quan-lop?tao=1` và `/lop-cua-toi/quan-lop/tao-moi` đều dẫn tới `/lop-cua-toi/lop/tao`; ở **390px** không tràn ngang, phần tử bấm được cao ≥ 44px; lớp Miễn phí ẩn mục cách tính.
- `ui-session-book.ts` (cũ, chạy lại): lớp kiểu mới hiện câu mới ở `BuoiChiTiet`, lớp cũ giữ câu cũ.
- `ui-hocphi-thang.ts`: 1600px và 390px; ba trạng thái (tải/lỗi/rỗng); đổi tháng bằng liên kết; số tiền viết đầy đủ (quét DOM không có `\d(tr|k)\b`); không có tên em; công tắc ẩn tiền che số; CSV tải được.
- `ui-hocphi-thang-admin.ts` (sau khi adm-dev xong): `admin_super` vào được và đổi đơn giá lớp qua ngăn nhúng; gia sư mở `/admin/hoc-phi-thang` → về `/lop-cua-toi`.

**Bài cũ PHẢI chạy lại (đỏ có sẵn đã biết ghi chú bên cạnh):**
`t-hocphi-fee`, `t-hocphi-fee-lib`, `t-hocphi-extra`, `t-hocphi-extra-lib`, `t-hocphi-payment`, `t-hocphi-payment-lib`, `t-hocphi-late-fee-hint`, `t-hocphi-schema-additive` *(đỏ có sẵn trên main theo SO-VIEC)*, `t-session-book`, `t-session-book-lib`, `t-session-package*` *(HP-31 sẽ gỡ riêng)*, `t-free-class-fee`, `t-course-validate`, `t-course-ids`, `t-tutor-revenue`, `t-tutor-gate-lib`, `t-tutor-routes-lib`, `t-notify-links`, `t-links`, `t-no-hex`, `t-no-fabricated`, `ui-tao-lop-wizard`, `ui-hocphi-fee`, `ui-hocphi-extra`, `ui-session-book`, `ui-role-everything`, `ui-links-everywhere`, `ui-tutor-everything` *(18/4 đỏ có sẵn)*. Với `t-hocphi-schema-additive`: mọi thay đổi ở đây là THÊM-chỉ (không đổi schema ở phần A), nên phải **không đổi** kết quả hiện có.

Kiểm tra múi giờ: `t-hocphi-dashboard*` chạy ở cả UTC và `TZ=Asia/Ho_Chi_Minh` (ca buổi lúc 23:30 giờ VN ngày 30 hoặc 31 phải rơi đúng tháng).

---

## 9. Cờ và câu hỏi cho chủ

**Cờ:**
- **TIỀN:** có — mục 1 và 3 chạm cách tính tiền học phí. Phần A không sửa tệp KHÓA nhưng thay đổi hành vi mặc định của lớp mới và cho quản trị đặt đơn giá của gia sư. Mọi `--apply` của phần B chờ CHỦ-01 (SO-VIEC: `dung`, chờ Thọ).
- **TRẺ EM:** không thêm dữ liệu mới. Bảng tổng hợp và CSV chỉ có số lượng, không tên/ID học sinh (người học ≥ 17 theo quyết định 25/10, vẫn giữ nguyên tắc "gia sư chỉ thấy học sinh của mình").
- **ĐỔI NỀN:** không. Không thêm hạ tầng; không đổi `schema.prisma` ở cả hai phần (chỉ xin sửa comment).
- **Không bịa luật:** mọi luật vắng/muộn/bù/miễn/làm tròn ở mục 1 lấy từ mã. Chỗ mã mơ hồ nằm ở các câu hỏi dưới, **không tự quyết**.

**Câu hỏi cho chủ (mặc định đặc tả đã chọn nếu chủ không trả lời):**
- **Q1.** Bỏ hẳn "Theo số buổi trong tháng (cách cũ)" khỏi lựa chọn khi tạo lớp MỚI, và cất Theo giờ / Theo khoá vào mục gập? *(Mặc định: có, theo "cứ tính theo buổi".)*
- **Q2.** Lớp "Miễn phí" giữ cách cũ (không có đơn giá). Sau này cô muốn thu phí lớp đó thì sao: hiện lớp cũ không tự đổi được. *(Mặc định: chưa làm gì; muốn thì cần một ngoại lệ cho phép đặt đơn giá đầu tiên của lớp miễn phí → `per_session`.)*
- **Q3.** Ai trong quản trị được ghi đè: `admin_super` và `admin_content` đều được như hiện nay, hay chỉ `admin_super`? *(Mặc định: cả hai, đều có audit và báo chủ lớp.)*
- **Q4.** Buổi **vắng có phép + học bù** hiện cho kết quả 0đ ở cả buổi vắng lẫn buổi bù (em được học một buổi mà không buổi nào tính). Đúng ý chưa? Và "có phép" có tính tiền không (DD-09 chưa quyết)? *(Mặc định: giữ đúng mã hiện hành.)*
- **Q5.** Kiểu mới không có "buổi miễn phí" cho từng em (đơn giá riêng tối thiểu 1.000đ). Có cần cách miễn một buổi/một em không? *(Mặc định: không làm.)*
- **Q6.** Có cần `--revert` cho script (chỉ cho lớp chưa có `FeeCharge` nào vào phiếu)? *(Mặc định: chưa.)*
- **Q7.** Bảng tổng hợp lớp cũ tính theo **phiếu** (trước học bổng/giảm giá) và chỉ có sau khi lập phiếu; chấp nhận không?
- **Q8.** Khi nào chạy `--apply` trên production và với tháng bắt đầu nào (`S`)? Chờ Thọ (CHỦ-01).

---

## 10. Tệp chung và tệp khóa cần xin COO

**Gửi COO — mẫu BAN-GIAO.md mục D, chỉ thêm:**

| # | Yêu cầu | Chủ tệp | Ghi chú |
|---|---|---|---|
| D1 | **Mở khóa có điều kiện** `src/lib/invoiceServer.ts`, `src/lib/feeChargeServer.ts` cho tut-code, **chỉ** sửa theo 3.3.4: (i) `issueInvoice` dùng `effectiveFeeModeForMonth` thay `normalizeFeeMode(e.course.feeMode)` (+ đọc `courseFeeRate` của các lớp trong giao dịch); (ii) `syncSessionCharges` trả sớm `skipped:"before_start"` khi `dateKey` trước mốc. Cần chủ xác nhận bằng văn bản (PHAM-VI: "đổi phải có quyết định của chủ"). Phần A **không** cần mục này | tut-code | Chỉ làm khi bắt đầu phần B; thay đổi không làm đổi số nào của lớp tạo mới (mốc 2000-01-01 → hàm trả nguyên `feeMode`) |
| D2 | **`src/app/api/users/[id]/tuition/route.ts`** (nhóm API người dùng, chưa gán phòng): cùng bộ lọc `effectiveFeeModeForMonth` | COO chỉ định tut-code | Phần B |
| D3 | **Phòng Quản trị** làm: `src/app/api/admin/hoc-phi-thang/route.ts` (4.4), `src/app/(admin)/admin/hoc-phi-thang/page.tsx` (5.4, nhúng `HocPhiThang` và `LopHocPhi` của tut-dev), một dòng ở `src/lib/adminNav.ts` (nhóm "Theo dõi", quyền `VIEW_REVENUE`). Cần tut-code giao hàm `hocPhiDashboardServer.ts` và tut-dev giao hai component trước (hoặc cùng nhánh theo hợp đồng 4.4) | adm-code / adm-dev | Không cần sửa `admin/khoa-hoc/[id]/page.tsx` hay `admin/thi-thu/**` |
| D4 | **Ngăn kéo tạo lớp trong `admin/khoa-hoc/page.tsx`** (tệp quản trị, ngoài hai tệp lớn): hiện tạo lớp cũ vì không gửi đơn giá. Đề nghị phòng Quản trị gửi `feeMode:"per_session"` + `feeRate` hoặc ẩn nó cho vai `teacher` (đằng nào gia sư cũng đã được chuyển hướng sang `TaoLop`). Không chặn phần A | adm-dev | Có thể bỏ nếu chủ chỉ cần lớp của gia sư |
| D5 | **`prisma/schema.prisma` — chỉ sửa comment, không đổi trường:** (a) `:1128-1131` thay "Vắng KHÔNG trừ tiền… không cho học phí" bằng mô tả đúng hai cách tính; (b) `:80-84` ghi "lớp MỚI của gia sư mặc định `per_session` ở tầng ứng dụng"; (c) `:1790` thêm `"course_fee_override" \| "course_fee_converted"` vào danh sách loại thông báo. Đi qua `t-db-push-guard`/`t-hocphi-schema-additive` (không đổi sơ đồ nên phải xanh như cũ) | COO | Nếu chủ muốn lưu mốc bằng cột (`Course.feeFromMonth`) thay vì suy từ `CourseFeeRate` đầu tiên thì đó là thêm cột (chỉ thêm, nhưng đụng schema) — đặc tả này **không** yêu cầu |
| D6 | `docs/kin/phong-ban/SO-VIEC.md`: thêm dòng `HOCPHI-THEO-BUOI` (gồm phần A xong độc lập; phần B chờ CHỦ-01) và đánh dấu TUT-001 gộp vào đây | COO | |
| D7 | `components/library/TutorLibrary.tsx`, `LibraryView.tsx` (chưa gán trong PHAM-VI) còn liên kết `?tao=1` — đã có redirect nên không sửa; nếu muốn bỏ vòng chuyển hướng thì COO giao cho ai sửa hai dòng chữ | COO | Không chặn |

Không cần sửa: `notify.ts`, `hostRouting.ts`, vỏ ba vai (`TutorShell.tsx`…), `src/components/kin/**`, `tools/local-e2e/h.ts`/`seed*`/`wipe` (test dùng `prisma` trực tiếp để dựng `feeMode`/`CourseFeeRate`).

---

## 11. Bổ sung 05/11/2026 (chủ): tính theo CA, không theo ngày

Quyết định: một ngày có thể có nhiều ca (sáng, chiều); mỗi ca là một đơn vị tính tiền; gia sư tự đặt đơn giá từng ca trong "bảng đối chiếu ca dạy ↔ đơn giá"; quản trị vẫn đặt/ghi đè; bảng cuối tháng = số ca đã chốt × đơn giá ca.

**Kiểm mô hình hiện có: CHƯA cho 2 ca trong 1 ngày.**
- `AttendanceSession` có `@@unique([courseId, date])` (schema.prisma ~1209): một lớp một ngày đúng một buổi; `date` chỉ là ngày. Đây chính là CHỦ-03 / P2 trong báo cáo điểm yếu 01/11.
- `ClassSchedule` (schema ~102) cho nhiều khung giờ cùng ngày, nhưng `/api/schedule` dựng buổi theo ngày; điểm danh/chốt/`FeeCharge.recordId` đều gắn một buổi một ngày.
- `FeeCharge` unique theo `recordId`, tính theo buổi nên 1 buổi = 1 ca hiện nay. Nên bảng tháng đang tính "buổi đã chốt" chính là số ca khi mỗi ngày chỉ có một ca; không sai trong thời gian chờ.
- Cách đỡ không cần đổi schema: tạo hai lớp (ca sáng, ca chiều) — mỗi lớp có đơn giá riêng qua `CourseFeeRate`. Chưa tối ưu: học sinh hai ca bị tách hai lớp.

**Đề xuất đổi schema CHỈ THÊM (YÊU CẦU MỤC D12 gửi COO, CHỜ chủ duyệt; KHÔNG làm trong lượt này):**
1. `AttendanceSession.shiftKey String @default("")` (""=ca duy nhất/mọi dữ liệu cũ); đổi unique `[courseId, date]` -> `[courseId, date, shiftKey]` (đổi ràng buộc duy nhất, không xoá dữ liệu; cần xem `t-db-push-guard`/`t-hocphi-schema-additive`; mọi `findUnique` theo `courseId_date` phải đổi, đây là phần rủi ro).
2. Bảng mới `CourseShift` (id, courseId, shiftKey, label "Ca sáng", startTime, endTime, rate Int?, effectiveFrom, createdBy; unique [courseId, shiftKey, effectiveFrom]) = "bảng đối chiếu ca ↔ đơn giá"; gia sư chủ lớp hoặc quản trị đặt, cùng quyền/AuditLog/thông báo như `fee-rates` (3.2). Có thể thay vì bảng mới thêm `shiftKey` vào `CourseFeeRate` (unique mới [courseId, shiftKey, effectiveFrom]) — ít bảng hơn, chọn khi duyệt.
3. `FeeCharge.shiftKey String @default("")` để dashboard nhóm theo ca.
4. Đơn giá một ca: `pickClassRate` nhận thêm `shiftKey`, ưu tiên đơn giá ca, rơi về đơn giá lớp; giá riêng của em vẫn thắng (hiện hành). Làm tròn/ luật có mặt-vắng giữ nguyên.
5. Bảng tháng: thêm cột "Ca" (nhóm theo `shiftKey`), số ca đã chốt = đếm `AttendanceSession` đã chốt theo (lớp, ngày, ca); tiền vẫn Σ `FeeCharge` (đã = ca × đơn giá ca, đóng băng khi vào phiếu). Hàm thuần `buildMonthTable` chỉ cần thêm nhóm theo `shiftKey`.
Việc chạm tệp KHÓA (`feeChargeServer.ts` chọn đơn giá theo ca, `attendance`/`sessions` API) nên cùng gói với D1. Chưa làm gì trong mã cho phần này.
