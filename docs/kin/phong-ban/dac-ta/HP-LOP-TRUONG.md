# HP-LOP-TRUONG — Gia sư tạo lớp (trưởng lớp) đặt học phí từng học sinh; bảng bậc theo gia sư; nhập từ Excel hoặc Google Sheet có xem trước

Đặc tả bởi tut-rnd, 09/11/2026. Đọc trên `origin/main` f0378557 (mọi `tệp:dòng` bên dưới là của bản này, đọc bằng `git show`, không phải cây làm việc đang mở). Không sửa `src/`.

**TIỀN = có. TRẺ EM = chạm nhẹ (tên học sinh trong tệp). ĐỔI NỀN = không.**
**Việc chạm tiền nên CHỜ CHỦ DUYỆT đặc tả này trước khi tut-code/tut-dev bắt đầu.** Mục 9 liệt kê chính xác chỗ nào đổi luồng tiền.

Figma: xem mục 5.4. **Khung đã dựng (COO, 09/11/2026)**, trang Bigupdate của tệp `2orXvoHL2upkiGoMjlq8aX`, section `720:5078`: desktop `720:5079` bảng tháng, `720:5413` bảng bậc, `720:5747` nhập Excel, `720:6081` xem trước, `720:6415` sửa một em, `720:6749` trạng thái, `720:7083` gia sư bộ môn; mobile là cặp tương ứng (ví dụ `720:5320` cho bảng tháng).

Dữ liệu mẫu trong đặc tả: tên học sinh là **tên giả** (Mai Anh, Bảo Châu, Minh Khôi, Gia Hân, Tuấn Kiệt), không có số điện thoại, không chép gì từ bảng tính thật của chủ.

---

## 0a. QUYẾT ĐỊNH CHỐT của chủ KiN (09/11/2026) — THẮNG mọi chỗ khác trong tệp này nếu mâu thuẫn

Chủ đã trả lời 9 câu ở mục 9.3. Mục này là bản chốt; mã làm theo mục này.

| # | Chốt | Khác đặc tả gốc ở |
|---|---|---|
| 1 | Lớp đã có tiền (`FeeCharge` / `MonthlyCourseFee`) **giữ yên**, không chuyển loại. `monthly_sheet` chỉ cho lớp mới / lớp chưa có tiền. | giống mặc định |
| 2 | "Số môn" chọn bậc: **mặc định lấy cột "Số môn" trong tệp nếu có** (chủ nhập tay); nếu trống thì **đếm số môn có buổi trong tháng**. Xem trước / API ghi rõ TỪNG em dùng cách nào (`subjectCountSource: "file" \| "counted"`, thêm cột `subjectCountSource` vào `CourseFeeSheetRow`; sửa tay = "file" khi có điền, "counted" khi để trống). PR ghi "đã chọn mặc định, chủ xem lại". | thêm trường nguồn |
| 3 | Buổi miễn phí **trừ vào tổng buổi**. | giống |
| 4 | **Sàn 0**: đã về 0 thì không giảm thêm, không bao giờ ra số âm. Giảm % cũ (`StudentDiscount`) chỉ **cảnh báo** ở xem trước. | giống |
| 5 | **Gia sư bộ môn KHÔNG thấy học phí** (và đồng giảng). **Quản trị trung tâm được XEM và SỬA** bằng quyền sẵn có: `money.view` + `money.edit` (hành động `money.edit` có ở **`owner` và `admin`**, không có ở `co_teacher` / `subject_teacher`). Quản trị gọi cùng API `/api/tutor/lop/[courseId]/bang-hoc-phi/*` (đã qua `requireCourseAccess`); `FeeCharge.tutorId` vẫn = `Course.ownerId`; `AuditLog` ghi người thật + `byRole` + `override:true`; khi quản trị (khác chủ lớp) ghi, **thông báo chủ lớp bằng loại sẵn có `course_fee_override`** (`buildFeeOverrideNotification`, không tên/không tiền, chống dội theo `type+link` chưa đọc) — không thêm loại thông báo mới, không sửa `notify.ts`. **Giao diện admin**: không sửa hai tệp lớn của phòng Quản trị → chỉ làm **API**; giao diện admin ghi vào "CHƯA LÀM". | thay mục 4.1 hàng Quản trị và mục 7 |
| 6 | Một phiếu thu về chủ lớp; gia sư mở lớp tự chia với bộ môn bên ngoài KiN. KiN không chia tiền. | giống |
| 7 | **Bảng bậc THEO TỪNG LỚP**, điền sẵn từ lớp `monthly_sheet` gần nhất của cùng gia sư, sửa được. | giống |
| 8 | **Kỳ thu mặc định THÁNG DƯƠNG LỊCH.** Gia sư có thể đặt **ngày bắt đầu kỳ thu riêng cho lớp**: thêm `CourseFeeTable.periodStartDay Int @default(1)` (chỉ thêm, **validate 1..28**, 1 = tháng dương lịch). Khoá kỳ vẫn là chuỗi `"YYYY-MM"` = tháng chứa NGÀY BẮT ĐẦU kỳ (ví dụ start 15, kỳ "2026-11" = 15/11 → 14/12/2026). Kỳ "hiện tại" mặc định của lớp = tháng của (hôm nay giờ VN lùi về ngày bắt đầu gần nhất). `FeeCharge.dateKey` = `<ym>-<DD bắt đầu>`. Đổi `periodStartDay` **bị chặn (409 `HAS_ROWS`) khi lớp đã có dòng học phí** (an toàn nhất). Mọi nhãn kỳ hiển thị "kỳ 11/2026 (15/11 – 14/12)" khi start ≠ 1; start = 1 hiển thị "tháng 11/2026". | thêm trường + nhãn |
| 9 | Sửa phiếu sai bằng "Sửa số tiền phiếu" (`set_amount`) có sẵn. | giống |

**Quy tắc chung chủ dặn:** gặp điểm chưa rõ → chọn mặc định an toàn nhất (không đổi số hiện có), ghi vào PR. **Nếu bất kỳ bước nào làm đổi số của phiếu / lớp hiện có → DỪNG và báo.** KHÔNG sửa `invoiceServer*`, `feeChargeServer*`, `sessionBookServer*`, `tuition.ts`.

---

## 0. Tóm tắt một đoạn

Chủ đang tính học phí trong Google Sheet: số môn em đăng ký chọn bậc đơn giá (1 môn 70.000, 2 môn 60.000, 3 môn 55.000, 4 môn 50.000; mỗi gia sư một bảng bậc), số buổi từng môn (Toán, Sử, Địa, Anh), buổi miễn phí, đơn giá riêng, học bổng, giảm trừ, ra "Phải đóng". KiN **đã có** phiếu thu, đối soát, vai chủ lớp / gia sư bộ môn và đơn giá riêng theo lớp, nhưng **không có chỗ nào nhập "số buổi từng môn của từng em"** và bảng bậc thì cứng toàn hệ thống. Bản nhỏ nhất đạt mong muốn của chủ:

1. Một cách tính mới cho lớp: **"Theo bảng học phí tháng"** (`Course.feeMode = "monthly_sheet"`, giá trị chuỗi mới, **không đổi schema bảng cũ**).
2. Hai bảng mới chỉ thêm: **bảng bậc + danh sách môn của lớp** và **một dòng học phí cho mỗi (em, tháng)** lưu đủ số đầu vào và số đã tính.
3. Nhập bằng **mẫu Excel / dán từ Google Sheet → xem trước (đúng / sai / không khớp) → bấm xác nhận mới ghi**, hoặc sửa tay từng em ở màn bảng.
4. **Tiền đi vào phiếu qua đường đã có**: mỗi em một `FeeCharge` (kind mới `sheet`) ghi số "Phải đóng" theo bảng. `issueInvoice`, `feeChargeServer`, `sessionBookServer`, `tuition.ts` **không sửa dòng nào**; phiếu đã lập không đổi một đồng (mục 8 chứng minh bằng băm trước/sau).
5. Chỉ **gia sư tạo lớp** ghi được; gia sư bộ môn và đồng giảng **403 ở mọi API mới** (đã là mặc định của ma trận quyền, thêm một hành động `money.edit` chỉ dành cho chủ lớp).

### Cái ĐÃ có (không thiết kế lại)

| Nhu cầu của chủ | Đã có | Chỗ |
|---|---|---|
| Trưởng lớp / gia sư bộ môn | `Course.ownerId` = người tạo lớp; `CourseTeacher.role` ∈ `co_teacher` \| `subject_teacher`, nhãn môn `subjects[]` chỉ để hiển thị | `schema.prisma:3138-3146`; `courseAccess.ts:36-39` |
| Gia sư bộ môn không thấy tiền | `money.view` chỉ có ở `owner` và `admin`; tab "Học phí" ẩn với người không phải chủ | `courseAccess.ts:39,46-66`; `LopChiTiet.tsx:114` |
| Phiếu thu, trạng thái, đối soát, còn lại | `TuitionInvoice` (nháp → đã gửi → đóng một phần → đã đóng / huỷ), sửa số tiền phiếu `set_amount` | `schema.prisma:1367`; `api/tutor/invoices/[id]/route.ts:7,90-107` |
| Học bổng + giảm trừ (đ) | chỉ ở lúc lập phiếu cho **đúng 1 em**, không lưu theo lớp/tháng | `api/tutor/invoices/route.ts:110-114`; `invoiceServer.ts:130` (`computeMonthlyFee({… scholarship, discount})`) |
| Giảm % riêng từng em | `StudentDiscount` (theo gia sư + em, áp tự động lúc lập phiếu) | `schema.prisma:1623`; `invoiceServer.ts:140` |
| Đơn giá riêng từng em | `CourseStudentRate` (chỉ cho lớp theo buổi / giờ / khoá) và `TuitionOverride` (toàn cục theo em, **không có đường ghi nào ngoài test**) | `schema.prisma:1530,1169`; xem 1.3 |
| Bậc theo số môn | `TUITION_TIER_VND` 70/60/55/50 **cứng** cho mọi gia sư | `tuition.ts:12-24` |
| Nhập hàng loạt có xem trước + đọc .xlsx an toàn | `studentImport.ts`, `studentImportServer.ts` (chặn bom nén, 1 MB, công thức chỉ lấy kết quả), mẫu Excel `quizSheetTemplate.ts` | `studentImportServer.ts:10-65`; `quizSheetTemplate.ts:23` |
| exceljs | có trong repo | `package.json:23` |

---

## 1. Vấn đề và bằng chứng

| # | Hiện trạng | Bằng chứng |
|---|---|---|
| 1.1 | Cách tính "bậc theo số môn" **chỉ có ở lớp cách cũ**, và số buổi là **một số cho cả lớp mỗi tháng**, không phải số của từng em, không tách môn trong một lớp | `schema.prisma:1148-1162` (`MonthlyCourseFee`: `courseId`+`yearMonth` duy nhất, `sessionCount`, `freeCount`); `invoiceServer.ts:114-131` (mỗi lớp = một "môn", số môn = số lớp cách cũ của gia sư mà em đang học) |
| 1.2 | Bảng bậc **cứng, chung**; gia sư không đặt được bảng riêng | `tuition.ts:12-24`; còn hiện cho học sinh xem trước khi vào lớp: `invitePreview.ts:37-48`, `api/invites/by-code/[code]/route.ts:98` (hiện bậc chung **cho mọi lớp có học phí**, kể cả lớp theo buổi 150.000đ — sai số có sẵn, xem 9.2) |
| 1.3 | "Đơn giá riêng" của chủ không có chỗ nhập: `TuitionOverride` được **đọc** ở 5 nơi nhưng không route nào **ghi** (chỉ test tạo) | `invoiceServer.ts:125`; `invites/by-code:66`; `users/[id]/tuition`; `parent-portal/[token]/route.ts:165`; `so-cua-con/[token]/page.tsx:81`; ghi: chỉ `t-core-regression.ts:37`, `t-hocphi-fee.ts:213`, `t-invite-preview.ts:49`. Thêm: nó là giá **theo em toàn cục**, gia sư A đặt thì gia sư B cũng bị áp |
| 1.4 | Lớp mới mặc định theo buổi tự động (từ điểm danh đã chốt) — không hợp với chủ vì chủ đếm buổi tay theo từng môn/em; lớp theo buổi **không có buổi miễn phí** từng em và đơn giá riêng tối thiểu 1.000đ | `TaoLop.tsx:59`; `courses/route.ts:103`; `tuitionFee.ts:50-51` (`FEE_RATE_MIN`), HOCPHI-THEO-BUOI mục 1 "Miễn" |
| 1.5 | Học bổng / giảm trừ chỉ gõ lúc lập phiếu cho 1 em, không lưu, không thấy lại ở lần sau; muốn làm cả lớp phải lập từng phiếu một | `api/tutor/invoices/route.ts:110-114` |
| 1.6 | Không có cách đưa danh sách từ Excel / Google Sheet vào phần học phí; chỉ có nhập **hồ sơ học sinh** và **lịch** | `api/tutor/ho-so/nhap/*`; `studentImport.ts:109` |
| 1.7 | Quyền: chỉ chủ lớp đặt tiền; gia sư bộ môn / đồng giảng đã bị chặn ở mọi route tiền hiện có (`ownsResource`) và ở UI (tab Học phí ẩn) — **đúng ý chủ (a)**, cần giữ và có bài kiểm cho đường mới | `courses/[id]/fee-rates/route.ts:19-23` (`MANAGE_COURSES` + `ownsResource`); `courseAccess.ts:36-39`; `LopChiTiet.tsx:114` |
| 1.8 | Chưa có đường đổi chủ lớp (`Course.ownerId`) ở bất kỳ route nào; `TUT-dong-giang` mục 4.2 hoãn "chuyển chủ lớp" sang vòng 2 | `TUT-dong-giang.md:256`; grep `ownerId:` trong `api/courses/[id]/route.ts` và `api/admin/**` chỉ đọc / lọc |

---

## 2. Phạm vi tệp (không trùng)

Việc **chạm tiền** → cả hai phía chỉ bắt đầu sau khi chủ duyệt. Tệp mới ghi `FeeCharge` nằm ngoài mẫu tên KHÓA (`feeCharge*`, `invoiceServer*`, `sessionBook*`) nhưng **về bản chất là đường ghi tiền**: xin COO ghi nhận ngoại lệ (mục 10, D1), cùng cách HOCPHI-THEO-BUOI đã làm cho `hocPhiDashboardServer.ts`.

### tut-code (máy chủ)

| Tệp | Việc |
|---|---|
| `src/lib/hocPhiSheet.ts` **(mới, thuần)** | `computeSheetFee`, `tierRateFor`, `validateTiers`, `validateSubjects`, `parseVndCell`, `parseSheetGrid` (đọc lưới chữ → dòng đã kiểm), `matchRoster`, `hashSheet`. Không Prisma, không `node:*` |
| `src/lib/hocPhiSheetServer.ts` **(mới)** | đọc/ghi `CourseFeeTable`, `CourseFeeSheetRow`; ghi/cập nhật/gỡ `FeeCharge(kind="sheet")` trong giao dịch; khoá `pg_advisory_xact_lock(course-fee-sheet:<courseId>:<ym>)`; chặn `moneyPathsBlocked()` (preview) |
| `src/lib/hocPhiSheetTemplate.ts` **(mới)** | dựng tệp mẫu .xlsx bằng exceljs nạp động như `quizSheetTemplate.ts` |
| `src/app/api/tutor/lop/[courseId]/bang-hoc-phi/route.ts` **(mới)** | GET bảng tháng |
| `…/bang-hoc-phi/cau-hinh/route.ts` **(mới)** | PUT bảng bậc + môn (+ bật chế độ cho lớp chưa có tiền) |
| `…/bang-hoc-phi/mau/route.ts` **(mới)** | GET tải mẫu .xlsx |
| `…/bang-hoc-phi/nhap/xem-truoc/route.ts`, `…/nhap/xac-nhan/route.ts` **(mới)** | xem trước (không ghi) / xác nhận (ghi) |
| `…/bang-hoc-phi/dong/[studentId]/route.ts` **(mới)** | PUT sửa tay một em (có `dryRun`), DELETE gỡ dòng |
| `src/lib/courseAccess.ts` | thêm hành động `money.edit` **chỉ cho `owner`** (không có ở `admin`, `co_teacher`, `subject_teacher`); cập nhật `t-course-access-lib.ts` |
| `src/lib/courseAccessServer.ts` | không đổi (đã có `requireCourseAccess(courseId, action)`) |
| `src/lib/tuitionFee.ts` | thêm `"monthly_sheet"` vào `NEW_FEE_MODES` (`:16`), nhãn/gợi ý vào `FEE_MODE_LABEL/HINT`, `FEE_RATE_UNIT` (`:33`) đổi kiểu cho khỏi bắt buộc đơn giá/đơn vị với chế độ này. **Chạm tiền: chờ chủ duyệt** |
| `src/app/api/courses/route.ts` (POST) | nhận `feeMode:"monthly_sheet"` **không cần** `feeRate`, không tạo `CourseFeeRate` (`:103-107` rẽ nhánh) |
| `src/app/api/courses/[id]/fee-rates/route.ts` | `POST`: lớp `monthly_sheet` → 409 "Lớp này tính học phí theo bảng tháng, không có đơn giá lớp" (một dòng cạnh `:51`) |
| `src/app/api/courses/[id]/duplicate/route.ts` | lớp `monthly_sheet` nhân bản thì sao chép `CourseFeeTable` (môn + bậc), **không** sao chép dòng học phí tháng; `:39` hiện sao chép `CourseFeeRate` cho mọi kiểu mới |
| `src/app/api/invites/by-code/[code]/route.ts` | lớp `monthly_sheet` → `tuition: null` (không hiện bậc chung sai); xem 9.2 |
| `src/lib/hocPhiDashboard.ts` | `TUITION_KINDS` (`:66`) thêm `"sheet"` để bảng tháng của gia sư cộng đúng; chú thích dưới bảng nói lớp bảng-tháng là **sau học bổng/giảm trừ** |
| Test: `tools/local-e2e/t-hp-sheet-lib.ts`, `t-hp-lop-truong.ts` (viết bởi tut-test; tut-code viết kèm `*-lib` cho hàm thuần) | mục 8 |

### tut-dev (giao diện)

| Tệp | Việc |
|---|---|
| `src/components/tutor/LopBangHocPhi.tsx` **(mới)** | nội dung tab "Học phí" khi lớp là `monthly_sheet`: bảng tháng, nút Tải mẫu / Nhập, bảng bậc, sửa từng em |
| `src/components/tutor/BangHocPhiNhap.tsx` **(mới)** | bước nhập: chọn tháng, tải mẫu, dán / thả tệp, **bảng xem trước**, xác nhận |
| `src/components/tutor/BangHocPhiCauHinh.tsx` **(mới)** | bảng bậc + danh sách môn (panel bên) |
| `src/components/tutor/BangHocPhiDong.tsx` **(mới)** | panel sửa một em: ô số buổi từng môn, buổi miễn phí, đơn giá riêng, học bổng, giảm trừ, dòng công thức |
| `src/components/tutor/LopHocPhi.tsx` | nhánh `feeMode === "monthly_sheet"` → render `LopBangHocPhi` (hiện `isNewFeeMode` ở `:41,53` sẽ gọi `fee-rates` — phải rẽ trước) |
| `src/components/tutor/TaoLop.tsx` | trong mục "Cách tính khác (ít dùng)" (`:273-287`) thêm một lựa chọn "Theo bảng học phí tháng (nhập từ Excel)", **không hỏi đơn giá lúc tạo** (đặt bảng bậc ở tab Học phí sau) |
| `src/components/tutor/BuoiChiTiet.tsx` + `src/app/lop-cua-toi/(tutor)/buoi/[courseId]/[dateKey]/page.tsx:23` | `perSessionFee` hiện `isNewFeeMode(c.feeMode) && c.feeMode !== "per_course"` sẽ **đúng cho `monthly_sheet`** → loại ra, nếu không màn buổi sẽ nói "bấm Đã dạy xong để sinh học phí" sai |
| `src/components/tutor/HocPhiThang.tsx` (`:57`) | nhãn nguồn cho lớp `monthly_sheet` |
| Test UI: `tools/local-e2e/ui-hp-lop-truong.ts` | mục 8 |

### Phòng Quản trị — ghi yêu cầu mục 10 (không sửa từ đây)
Không cần sửa hai tệp lớn `admin/khoa-hoc/[id]/page.tsx`, `admin/thi-thu/**`. Quản trị chỉ **xem** (GET) qua `money.view`.

---

## 3. Schema chỉ thêm + công thức

### 3.1 Schema (không đổi bảng cũ; không thêm giá trị cho `Enrollment.status`)

```prisma
// HP-LOP-TRUONG: bảng bậc theo số môn + danh sách môn của MỘT lớp tính theo bảng học phí tháng. Một dòng / lớp.
model CourseFeeTable {
  id        String   @id @default(cuid())
  courseId  String   @unique
  subjects  String[] @default([])   // nhãn môn: 1..6 mục, mỗi mục ≤ 40 ký tự, không trùng sau normalizeKey
  tiers     Json                    // [{ "subjects": 1, "rate": 70000 }, …] 1..8 dòng, subjects tăng dần, dòng đầu subjects = 1
  updatedBy String                  // userId (chuỗi, không FK)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@map("course_fee_tables")
}

// Một dòng học phí của MỘT em trong MỘT tháng của MỘT lớp: số đầu vào + số đã tính (chụp lúc ghi, đổi bảng bậc sau không đổi dòng cũ).
model CourseFeeSheetRow {
  id           String   @id @default(cuid())
  courseId     String
  studentId    String                 // chuỗi, không FK tới User (như các bảng HP-14..17)
  yearMonth    String                 // "YYYY-MM" dương lịch, cùng khoá với FeeCharge/TuitionInvoice
  subjectCount Int                    // số môn dùng để chọn bậc
  sessions     Json                   // {"Toán": 8, "Anh": 4} theo nhãn môn tại lúc ghi, mỗi số 0..60
  freeSessions Int      @default(0)   // buổi miễn phí, trừ vào TỔNG buổi
  rateOverride Int?                   // đơn giá riêng (đ/buổi) 1.000..100.000.000; null = theo bậc
  scholarship  Int      @default(0)   // học bổng (đ)
  discount     Int      @default(0)   // giảm trừ (đ)
  tierRate     Int                    // đơn giá bậc đã tra lúc ghi
  unitRate     Int                    // đơn giá áp thật (rateOverride ?? tierRate)
  billable     Int                    // buổi tính tiền = tổng buổi − buổi miễn phí
  gross        Int                    // billable × unitRate
  net          Int                    // max(0, gross − scholarship − discount) = "Phải đóng theo bảng"
  note         String?  @db.Text      // ≤ 300 ký tự
  source       String                 // "xlsx" | "paste" | "manual"
  feeChargeId  String?  @unique       // FeeCharge mang số net sang phiếu; null khi net = 0
  updatedBy    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  course       Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@unique([courseId, studentId, yearMonth])
  @@index([courseId, yearMonth])
  @@map("course_fee_sheet_rows")
}
```
- `Course` thêm hai quan hệ ngược (`feeTable CourseFeeTable?`, `feeSheetRows CourseFeeSheetRow[]`). **Không** đổi cột nào của `Course`, `FeeCharge`, `TuitionInvoice`, `MonthlyCourseFee`, `Enrollment`.
- `Course.feeMode` là chuỗi tự do (`schema.prisma:86`): `"monthly_sheet"` là giá trị mới, không cần migrate.
- `FeeCharge` dùng như sau cho một dòng của bảng: `kind:"sheet"`, `mode:"monthly_sheet"`, `amount = net`, `rate = unitRate`, `units: null`, `rateSource: rateOverride ? "student" : "class"`, `dateKey = "<ym>-01"`, `yearMonth = ym`, `label = "Học phí MM/YYYY · k môn · b buổi"`, `tutorId = Course.ownerId`. Không có `recordId` (duy nhất chỉ áp cho buổi).
- Không khoá ngoại tới `User` (tránh chạm model `User`, giống các bảng HP). Xoá tài khoản gia sư đã bị chặn khi còn `feeCharge` (`accountDelete.ts:69`).
- Gói qua `t-db-push-guard` (chỉ thêm bảng mới). `t-hocphi-schema-additive` đang đỏ sẵn trên main (SO-VIEC): phải **không đổi kết quả**.

### 3.2 Công thức (một chỗ duy nhất: `computeSheetFee` trong `hocPhiSheet.ts`; giao diện chỉ HIỂN THỊ, máy chủ luôn tính lại)

Vào: bảng bậc `T` (danh sách `(m, rate_m)` tăng dần theo `m`), các số buổi `S₁…S_n` theo từng môn (0 ≤ Sᵢ ≤ 60), `k` số môn (cột "Số môn", nếu trống thì `k` = số môn có Sᵢ > 0), `F` buổi miễn phí, `O` đơn giá riêng (hoặc trống), `HB` học bổng, `GT` giảm trừ. Mọi số là **số nguyên đồng**, không làm tròn ở đâu cả.

```
Tổng buổi      = Σ Sᵢ
Buổi tính tiền = Tổng buổi − F                      (0 ≤ F ≤ Tổng buổi, nếu không là LỖI)
Đơn giá bậc(k) = rate của bậc có m lớn nhất mà m ≤ k   (k lớn hơn bậc cuối → dùng bậc cuối; k < 1 mà Tổng buổi > 0 → LỖI)
Đơn giá áp     = O nếu có, ngược lại Đơn giá bậc(k)    (O thắng bậc dù cao hơn hay thấp hơn; O < 1.000 → LỖI)
Học phí gốc    = Buổi tính tiền × Đơn giá áp
Phải đóng      = max(0, Học phí gốc − HB − GT)          (đúng công thức `computeMonthlyFee` hiện hành: tuition.ts "Phải đóng = gốc − học bổng − giảm trừ, sàn 0")
```
Ràng buộc "Số môn" tường minh: nếu cột có giá trị thì `k ≥ số môn có Sᵢ > 0` và `k ≤ 10`; nhỏ hơn thì LỖI ("em học 3 môn trong tháng nhưng ghi số môn 2").

**Ví dụ số** (lớp mẫu, bậc 1→70.000, 2→60.000, 3→55.000, 4→50.000; môn Toán, Sử, Địa, Anh):

| Em (tên giả) | Toán | Sử | Địa | Anh | Số môn | Miễn | Đơn giá riêng | HB | GT | k dùng | Đơn giá áp | Buổi tính tiền | Gốc | **Phải đóng** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mai Anh | 8 | 0 | 0 | 4 | (trống) | 1 | — | 50.000 | 0 | 2 (đếm môn có buổi) | 60.000 | 12 − 1 = 11 | 660.000 | **610.000** |
| Bảo Châu | 8 | 8 | 8 | 8 | (trống) | 0 | — | 0 | 100.000 | 4 | 50.000 | 32 | 1.600.000 | **1.500.000** |
| Minh Khôi | 8 | 0 | 0 | 0 | (trống) | 0 | 45.000 | 0 | 0 | 1 | 45.000 (thắng bậc 70.000) | 8 | 360.000 | **360.000** |
| Gia Hân | 6 | 6 | 0 | 0 | 3 | 0 | — | 0 | 0 | 3 (ghi tay: đăng ký 3 môn, tháng này chỉ học 2) | 55.000 | 12 | 660.000 | **660.000** |
| Tuấn Kiệt | 0 | 0 | 0 | 4 | (trống) | 0 | — | 300.000 | 0 | 1 | 70.000 | 4 | 280.000 | **0** (300.000 > 280.000, sàn 0; **không** tạo `FeeCharge`, cảnh báo "Phải đóng 0đ") |

Cộng các dòng "Phải đóng" > 0: 610.000 + 1.500.000 + 360.000 + 660.000 = **3.130.000đ** (số này là tổng "sẽ ghi" ở màn xem trước).

**Sang phiếu** (`issueInvoice`, không sửa): lớp `monthly_sheet` thuộc nhóm kiểu mới (`isNewFeeMode`) nên **không** vào `legacyEnrollments` (`invoiceServer.ts:114`) — không làm đổi bậc của lớp cách cũ nào; `loadUninvoicedCharges` lấy mọi `FeeCharge` chưa vào phiếu của (gia sư, em, tháng) kể cả `kind:"sheet"`; `composeFinalAmount(b, chargesTotal, percent)` với `gross` cũ = 0 cho ra `chargesTotal − giảm %`. Mai Anh: phiếu = **610.000đ**. Nếu cô còn đặt "giảm 10%" cho em ở Học phí (`StudentDiscount`), phiếu = 610.000 − 61.000 = **549.000đ** → giảm hai lần so với bảng: màn xem trước phải cảnh báo (mục 9, M5).

Dòng trên phiếu hiện một dòng `description = label` ("Học phí 11/2026 · 2 môn · 11 buổi"), thêm đuôi " · đã trừ học bổng/giảm trừ" khi HB + GT > 0. Chi tiết từng môn nằm ở `CourseFeeSheetRow`, không in lên phiếu (giữ phiếu đơn giản).

### 3.3 Bảng bậc theo lớp, sao chép từ lớp trước
Bảng bậc lưu **theo lớp** (`CourseFeeTable`). Khi cô mở "Bảng bậc" của một lớp mới, ô được điền sẵn từ bảng của lớp `monthly_sheet` gần nhất của chính cô (sao chép giá trị lúc điền, **không** liên kết). Đổi bảng bậc **không** đổi dòng đã ghi (chúng đã chụp `tierRate`); chỉ dòng được ghi/sửa/nhập lại sau đó dùng bảng mới.

---

## 4. Hợp đồng API

Mọi màn là React gọi `fetch` → **JSON**. Không có form HTML thuần trong việc này, nên không cần `POST + 303`; tải mẫu là `GET` trả tệp (`<a href download>`). Tiền là số nguyên đồng; giao diện viết đủ `1.250.000đ`, không "tr"/"k" (bài `ui` quét DOM).

### 4.1 Bảng quyền theo vai

Cột "Học sinh": chỉ thấy phiếu của mình sau khi gia sư **đã gửi** (đường hiện có), **không** thấy bảng này.

| Việc | Gia sư tạo lớp (trưởng lớp, `owner`) | Gia sư bộ môn (`subject_teacher`) | Đồng giảng (`co_teacher`) | Quản trị trung tâm (`admin_super`/`admin_content`) | Gia sư lớp khác | Gia sư chờ duyệt / học sinh | Chưa đăng nhập |
|---|---|---|---|---|---|---|---|
| Xem bảng tháng (GET), tải mẫu | ✔ | **403** (mặc định; xem Q5) | **403** | ✔ chỉ xem (`money.view`) — tải mẫu **403** | 403 | 403 | 401 |
| Đặt bảng bậc + môn, bật chế độ | ✔ | 403 | 403 | **403** (xem Q5) | 403 | 403 | 401 |
| Xem trước / xác nhận nhập | ✔ | 403 | 403 | 403 | 403 | 403 | 401 |
| Sửa / gỡ học phí một em | ✔ | 403 | 403 | 403 | 403 | 403 | 401 |
| Chọn / điều chỉnh mức học phí từng học sinh | ✔ (đúng ý chủ (a)) | **✘** | ✘ | ✘ | ✘ | ✘ | ✘ |

Thứ tự trả lời (theo `courseAccessServer.ts`, đã có): 401 chưa đăng nhập → 403 bị khoá / không phải gia sư đã duyệt → **404 lớp không tồn tại** → 403 người lạ → 403 `ROLE_FORBIDDEN` thiếu hành động. Gia sư chờ duyệt là `role: "student"` thật nên rơi vào 403 "Chỉ gia sư mới dùng chức năng này". **Không** dùng `requireTutorOnly`/`requireTutor` (chỉ kiểm vai, không kiểm lớp). Thân lỗi 403/404 **không chứa tên lớp, tên học sinh, số tiền**.

Hành động mới `money.edit` chỉ trong tập quyền của `owner` (không nằm trong `OWNER_ONLY` dùng chung với `admin`); `money.view` giữ nguyên (owner + admin).

### 4.2 Điểm vào (tất cả dưới `/api/tutor/lop/[courseId]/bang-hoc-phi`)

**GET `/?ym=YYYY-MM`** (`money.view`). `ym` mặc định tháng hiện tại giờ VN; sai định dạng hoặc quá 12 tháng trước / sau tháng hiện tại → 400.
```json
{
  "feeMode": "monthly_sheet", "yearMonth": "2026-11",
  "config": { "subjects": ["Toán","Sử","Địa","Anh"], "tiers": [{"subjects":1,"rate":70000},{"subjects":2,"rate":60000},{"subjects":3,"rate":55000},{"subjects":4,"rate":50000}] },
  "rows": [{
    "studentId": "…", "name": "Mai Anh", "filled": true,
    "subjectCount": 2, "sessions": {"Toán":8,"Anh":4}, "freeSessions": 1, "rateOverride": null,
    "scholarship": 50000, "discount": 0, "tierRate": 60000, "unitRate": 60000, "billable": 11, "gross": 660000, "net": 610000,
    "note": null, "source": "xlsx", "locked": false,
    "invoice": null
  }],
  "totals": { "filled": 4, "unfilled": 1, "net": 3130000 }
}
```
- `rows` có **một dòng cho mỗi em đang `active`** của lớp, em chưa có dòng → `filled:false`, các số `null`. `config:null` khi chưa đặt bảng bậc (màn hiện trạng thái rỗng "Cô chưa đặt bảng bậc").
- `invoice` = `{ code, status, statusLabel, amountDue, paidAmount, remaining }` đọc từ `TuitionInvoice` của (chủ lớp, em, tháng) nếu có; đây là cột "Còn lại / Trạng thái" của sheet cũ, dùng nhãn `INVOICE_STATUS_LABEL`. `locked:true` khi `FeeCharge` của dòng đã có `invoiceId`.
- Em đã rời lớp mà vẫn có dòng cũ: hiện thêm với `name` và `left:true` (không mất lịch sử).
- Lỗi: 404 lớp; 409 `NOT_SHEET_MODE` (lớp không phải `monthly_sheet`).

**PUT `/cau-hinh`** (`money.edit`). Thân `{ subjects: string[], tiers: [{subjects:int, rate:int}], enable?: boolean }`.
- Kiểm: `subjects` 1..6, mỗi mục sau `cleanText` 1..40 ký tự, không trùng theo `normalizeKey`; `tiers` 1..8 dòng, dòng đầu `subjects:1`, `subjects` tăng nghiêm ngặt, `rate` nguyên 1.000..100.000.000 (dùng `FEE_RATE_MIN/MAX`). Không bắt buộc `rate` giảm dần (chỉ cảnh báo ở UI nếu tăng).
- `enable:true` (chỉ khi lớp **chưa** là `monthly_sheet`): bật chế độ cho lớp **chưa phát sinh tiền** — điều kiện: `FeeCharge` của lớp = 0 **và** `MonthlyCourseFee` của lớp = 0. Không thì 409 `HAS_MONEY_HISTORY` `{ feeCharges, monthlyFees }` (số đếm, không tên). Thành công: `Course.feeMode = "monthly_sheet"` + tạo `CourseFeeTable` trong **một** giao dịch. Không có đường ngược lại.
- `enable` vắng / false mà lớp không phải `monthly_sheet` → 409 `NOT_SHEET_MODE`.
- Ghi `AuditLog` `fee_sheet.config` (metadata: `courseId`, số môn, số bậc, `enabled`, `previousFeeMode`; **không** tên người, không số tiền riêng). Không thông báo.
- Lỗi: 400 kiểm sai (thông điệp tiếng Việt); 403/404 như 4.1; 503 `moneyPathsBlocked()` ở bản xem trước.

**GET `/mau?ym=YYYY-MM`** (`money.edit`). Trả `.xlsx`, `Content-Disposition: attachment; filename="hoc-phi-<id-lop>-<ym>.xlsx"` (chỉ ASCII), `Cache-Control: no-store`. Trang tính 1 "Học phí 2026-11": hàng 1 tiêu đề — `Mã em (đừng sửa)` · `Họ tên` · `Số môn` · `<mỗi môn một cột, tên đúng nhãn môn>` · `Buổi miễn phí` · `Đơn giá riêng` · `Học bổng` · `Giảm trừ` · `Ghi chú`; hàng 2 là ví dụ mở đầu bằng `EXAMPLE_MARK` (bị bỏ qua và báo nếu quên xoá); từ hàng 3: **mỗi em đang học lớp một hàng**, đã điền `Mã em` và `Họ tên`, các ô còn lại trống. Trang tính 2 "Cách điền" (6 dòng + bảng bậc hiện hành). **Mọi ô ghi bằng chuỗi, không công thức.** Lớp chưa có `CourseFeeTable` → 409 `NO_TABLE`.

**POST `/nhap/xem-truoc`** (`money.edit`) — **không ghi gì**. Nhận `multipart/form-data` (`file`, `ym`) hoặc JSON `{ ym, text }` (dán từ Google Sheet = chữ tách TAB). Tệp: `.xlsx`, `.csv`, `.tsv`, `.txt`, ≤ 1.000.000 byte; đi qua `zipUncompressedTotal` + `xlsxToCsv` có sẵn (`studentImportServer.ts:15,44`), trang tính đầu tiên, tối đa 300 dòng dữ liệu, 40 cột; giới hạn tốc độ 40 lần/phút/gia sư.
```json
{
  "yearMonth": "2026-11", "fileHash": "sha256:…", "fatal": null,
  "columns": { "matched": ["Mã em","Họ tên","Toán","Sử","Địa","Anh","Buổi miễn phí","Học bổng"], "ignored": ["Cột trống 14"], "blocking": [] },
  "counts": { "ok": 14, "replace": 3, "warn": 2, "error": 1, "unmatched": 1, "ambiguous": 1, "locked": 1, "unchanged": 0 },
  "writable": 19, "totalNet": 21000000,
  "rows": [{
    "line": 3, "status": "ok", "matchedBy": "code",
    "studentId": "…", "name": "Mai Anh",
    "subjectCount": 2, "sessions": {"Toán":8,"Anh":4}, "freeSessions": 1, "rateOverride": null, "scholarship": 50000, "discount": 0,
    "tierRate": 60000, "unitRate": 60000, "billable": 11, "gross": 660000, "net": 610000,
    "before": null, "messages": [], "candidates": []
  }],
  "rosterNotInFile": [{ "studentId": "…", "name": "Gia Hân" }]
}
```
Trạng thái từng dòng (chữ hiển thị ở mục 5):
| `status` | Nghĩa | Ghi được? |
|---|---|---|
| `ok` | khớp đúng 1 em đang học lớp, số hợp lệ, chưa có dòng tháng này | ✔ |
| `replace` | như `ok` nhưng thay một dòng đã có (chưa vào phiếu); `before` giữ số cũ để hiện "610.000 → 640.000" | ✔ |
| `unchanged` | trùng hệt số đã lưu | không cần ghi |
| `warn` | ghi được nhưng cần xem: Phải đóng = 0; đơn giá riêng **cao hơn** bậc; em còn "giảm %" ở Học phí; phiếu **nháp** tháng này đã có (dòng mới sẽ là khoản rời, cô bấm "Gộp khoản rời") | ✔ |
| `error` | số sai (không phải số nguyên đồng, âm, > 60 buổi/môn, miễn > tổng, đơn giá riêng < 1.000, số môn < số môn có buổi), em xuất hiện **hai lần trong tệp** (cả hai dòng) | ✘ |
| `unmatched` | tên / mã không có trong lớp (hoặc em không còn `active`) | ✘ cho tới khi cô chọn em trong ô chọn, hoặc bỏ dòng |
| `ambiguous` | ≥ 2 em cùng tên sau `normalizeKey`, không có `Mã em` | ✘ cho tới khi cô chọn (`candidates`: tên, ngày vào lớp, 4 ký tự cuối mã) |
| `locked` | dòng của em đã vào phiếu (`FeeCharge.invoiceId` ≠ null) hoặc phiếu tháng đó đã gửi / đóng / huỷ | ✘ (không bao giờ ghi đè) |

`fatal` (cả tệp bị từ chối, `writable: 0`): tệp trống; không có cột `Họ tên` lẫn `Mã em`; quá 300 dòng ("Chia thành nhiều lần", **không cắt lặng lẽ**); quá 1 MB (413); `.xls`/`.xlsm`/định dạng lạ (400); tệp hỏng / có mật khẩu / bom nén (400 "Tệp Excel không đọc được…"); cột lạ **có dữ liệu** không khớp môn nào của lớp (`columns.blocking`, ví dụ cột "Hoá" khi lớp chưa có môn Hoá — bỏ âm thầm là mất tiền) — thông điệp nêu tên cột, cách xử lý: thêm môn vào bảng bậc hoặc xoá cột. Cột lạ **trống hoàn toàn** chỉ liệt vào `ignored`.

Quy tắc khớp học sinh (`matchRoster`): (1) `Mã em` nếu có và thuộc lớp → khớp theo mã (`matchedBy:"code"`); mã lạ → `unmatched`; (2) không có mã → so `normalizeKey(Họ tên)` với em `active` của lớp: đúng 1 → `matchedBy:"name"`, 0 → `unmatched`, ≥ 2 → `ambiguous`. **Không tự tạo học sinh, không đoán gần đúng.** Tên chỉ để đối chiếu; không lưu tên từ tệp.

Đọc ô: chuỗi `cleanText`; công thức chỉ lấy kết quả đã tính, ô bắt đầu `= + - @` là chữ thường (không bao giờ chạy); số tiền chấp nhận `70000`, `70.000`, `70,000`, `70 000` (đúng cụm nghìn); **từ chối** `70k`, `1tr`, `70.5`, `-5`, ô chữ trong cột số (thông điệp kèm số dòng thật trong tệp và tên cột). Ô trống ở cột số buổi = 0.

**POST `/nhap/xac-nhan`** (`money.edit`) — **ghi**. Thân: giống xem trước (gửi lại **tệp / chữ**) cộng `fileHash`, `pick: { "<line>": "<studentId>" }` (chọn em cho dòng `unmatched`/`ambiguous`), `skipLines: number[]`, `skipErrors: boolean`.
- Máy chủ **phân tích lại** từ đầu, so `fileHash` (băm lưới chữ đã chuẩn hoá + `ym`): lệch → 409 `FILE_CHANGED` "Tệp đã đổi, xem trước lại". Mọi số tiền **tính lại ở máy chủ**; số khách gửi lên (nếu có) bị bỏ qua.
- `pick` chỉ nhận em `active` của lớp và chưa được dòng khác dùng; sai → 400.
- Còn dòng `error` mà `skipErrors` ≠ true → 409 `HAS_ERRORS` (không ghi gì). Dòng `locked` luôn bị bỏ qua và đếm.
- Ghi trong **một giao dịch** (tất cả hoặc không gì), khoá `course-fee-sheet:<courseId>:<ym>`; với mỗi dòng ghi được: upsert `CourseFeeSheetRow`; `net > 0` → tạo/cập nhật `FeeCharge(kind:"sheet")` **chỉ khi** `invoiceId` còn null (đọc `FOR UPDATE`; gặp dòng vừa bị gắn phiếu trong lúc chờ → rollback 409 `ROW_LOCKED` kèm số dòng, không tên); `net = 0` → gỡ `FeeCharge` chưa vào phiếu nếu có.
- Bấm hai lần liên tiếp: lần hai ra `unchanged` hết → `written: 0`, không tạo dòng thứ hai.
```json
{ "ok": true, "written": 19, "replaced": 3, "skipped": 2, "chargesCreated": 16, "chargesUpdated": 3, "chargesRemoved": 0, "totalNet": 21000000 }
```
- `AuditLog` `fee_sheet.import` (metadata: `courseId`, `yearMonth`, `source`, các số đếm, `totalNet`; **không** tên, không số từng em). Không thông báo ai (mục 7).
- Lỗi: 400/401/403/404 như trên; 409 `NOT_SHEET_MODE`, `NO_TABLE`, `FILE_CHANGED`, `HAS_ERRORS`, `ROW_LOCKED`; 413; 429; 503 ở bản xem trước.

**PUT `/dong/[studentId]`** (`money.edit`). Thân `{ yearMonth, sessions, subjectCount?: number|null, freeSessions, rateOverride: number|null, scholarship, discount, note?, dryRun?: true }`. `dryRun:true` → trả dòng đã tính, **không ghi** (cho ô tính sống ở panel). `studentId` phải là em `active` của lớp (khác → 404 `STUDENT_NOT_IN_COURSE`, không lộ em lớp khác). Dòng đã vào phiếu → 409 `ROW_LOCKED`. Ghi `AuditLog` `fee_sheet.row` (không tên, không số).

**DELETE `/dong/[studentId]?ym=`** (`money.edit`). Xoá dòng + gỡ `FeeCharge` chưa vào phiếu. Đã vào phiếu → 409 `ROW_LOCKED`. Không có dòng → 404.

### 4.3 Đổi nhỏ ở API sẵn có
- `POST /api/courses`: `feeMode:"monthly_sheet"` hợp lệ **không cần** `feeRate`; kết quả: lớp tạo xong chưa có `CourseFeeTable` (cô đặt ở tab Học phí). Gửi `feeMode` lạ vẫn 400 như hiện tại. Gửi `feeRate` không `feeMode` vẫn là `per_session` (không đổi).
- `POST /api/courses/[id]/fee-rates` cho lớp `monthly_sheet` → 409.
- `GET /api/invites/by-code/[code]`: lớp `monthly_sheet` → `tuition: null`.

---

## 5. Luồng màn gia sư

Vỏ gia sư hiện có, token `--kin-*` (không hex, `t-no-hex`), phần tử bấm cao ≥ 44px ở 390px (`--kin-cham-toi-thieu`), tiền bằng `KinMoney` (theo công tắc ẩn tiền), chữ xưng "cô". Lối vào: **tab "Học phí" đã có của lớp** (`/lop-cua-toi/<courseId>?tab=hoc-phi`, chỉ chủ lớp thấy). Với lớp `monthly_sheet` tab này hiện bảng tháng; bước nhập là **panel / trang con** `/lop-cua-toi/<courseId>/bang-hoc-phi/nhap?ym=` (một trang con kiểu `ban-ghi`, người không phải chủ lớp → 404 như `ban-ghi/page.tsx`).

### 5.1 Hành trình ngắn nhất (đúng ý "đơn giản")
```
Tab Học phí (lớp bảng tháng)
  ├─ lần đầu: "Đặt bảng bậc" (điền sẵn từ lớp trước) ─ Lưu
  └─ hàng tháng: [Tháng 11/2026 ▾]  [Tải mẫu Excel]  [Nhập từ Excel / Google Sheet]
        Nhập: dán (từ Google Sheet) HOẶC thả tệp .xlsx  →  Xem trước  →  [Xác nhận ghi N dòng]
        hoặc bấm một em trong bảng → panel bên sửa tay (số buổi từng môn, miễn, đơn giá riêng, học bổng, giảm trừ)
  → sang tab/trang Học phí & đối soát hiện có để "Lập phiếu" (không đổi)
```
Không có cấu hình nào khác. Cô không phải học khái niệm mới: bảng giống sheet cũ, thêm bước "xem trước".

### 5.2 1600px
- **Tab Học phí:** đầu trang tóm tắt bảng bậc một dòng ("1 môn 70.000đ · 2 môn 60.000đ · 3 môn 55.000đ · 4 môn 50.000đ · Môn: Toán, Sử, Địa, Anh") + nút "Sửa bảng bậc". Bên dưới bộ chọn tháng (liên kết `?ym=`, không sang tháng tương lai quá 12 tháng) và hai nút. Bảng cột: Họ tên · (cột mỗi môn: buổi) · Miễn · Đơn giá áp · Học bổng · Giảm trừ · **Phải đóng** · Phiếu (mã + trạng thái + "Còn lại"). Dòng tổng cố định cuối bảng. Em chưa có dòng: ô trống kèm "Chưa nhập". Bấm dòng → panel bên phải (không hộp thoại) sửa em đó.
- **Xem trước:** thanh tóm tắt (Đúng 14 · Thay số cũ 3 · Cần xem 2 · Sai 1 · Không khớp 1 · Trùng tên 1 · Đã vào phiếu 1); bảng như trên, thêm cột Trạng thái (chữ + biểu tượng, **không chỉ màu**) và Ghi chú; dòng `unmatched`/`ambiguous` có ô chọn em ngay trong dòng; dòng `replace` hiện "610.000 → 640.000"; chân bảng: "Sẽ ghi 19 dòng · Tổng Phải đóng 21.000.000đ", nút **Xác nhận ghi 19 dòng** (tắt khi 0 dòng ghi được hoặc còn dòng sai mà chưa chọn "Bỏ qua dòng sai"), nút "Chọn tệp khác". Dòng `locked`/`error` có lý do bằng chữ.
- **Panel sửa một em:** tên em, 4 ô buổi (nhãn theo môn), Buổi miễn phí, Số môn (để trống = tự đếm), Đơn giá riêng, Học bổng, Giảm trừ, Ghi chú; dưới cùng **một dòng công thức sống** do `dryRun`: "11 buổi × 60.000đ = 660.000đ − 50.000đ = **610.000đ**" và chữ nói rõ nguồn bậc ("bậc 2 môn" / "đơn giá riêng của em").

### 5.3 390px
Một cột. Tab Học phí: mỗi em một **thẻ** (tên + "Phải đóng" nổi bật; hàng nhỏ: số buổi theo môn · trạng thái phiếu); tổng là thẻ cuối. Nút "Tải mẫu" và "Nhập" xếp dọc, cao ≥ 44px. Xem trước: mỗi dòng là một thẻ có nhãn trạng thái ở đầu thẻ; ô chọn em là `<select>` cao ≥ 44px; nút xác nhận dính đáy. Sửa em: màn toàn chiều cao (không hộp thoại nhỏ), ô số dùng bàn phím số. Không tràn ngang (bài quét).

### 5.4 Ba trạng thái + Khung Figma cần dựng
Trạng thái chung cho mọi màn: **tải** (khung xương `kin-skel`) · **lỗi** (`role="alert"` + "Thử lại") · **rỗng**:
- Chưa đặt bảng bậc: "Cô chưa đặt bảng bậc. Đặt một lần, dùng cho mọi tháng." + nút "Đặt bảng bậc".
- Lớp chưa có học sinh: "Lớp chưa có học sinh. Thêm học sinh rồi quay lại." + liên kết tab Học sinh.
- Tháng chưa nhập: "Tháng này chưa có học phí. Tải mẫu Excel hoặc nhập từng em."
- Xem trước tệp trống / `fatal`: thẻ lỗi nêu lý do cụ thể (mục 4.2) + nút "Chọn tệp khác".

**Khung Figma** (trang "Bigupdate (11/2026)" của tệp `2orXvoHL2upkiGoMjlq8aX`; mỗi khung một cặp 1600 × 1000 và 390 × 844; dùng thành phần/biến của Bản final 578:2 và thanh bên gia sư 578:11; **ĐÃ DỰNG (COO, 09/11/2026): section `720:5078`**, mỗi khung một cặp desktop + mobile):
| Tên khung | Nội dung (tên giả) |
|---|---|
| `HP-LT / 1 Bảng học phí tháng` | bảng tháng 11/2026, 5 em ví dụ ở mục 3.2, dòng tổng 3.130.000đ, cột Phiếu có "Nháp", "Đã gửi · Còn lại 360.000đ", "Chưa lập phiếu" |
| `HP-LT / 2 Bảng bậc và môn` | panel bên: 4 bậc, 4 môn, cảnh báo "bậc tăng theo số môn" |
| `HP-LT / 3 Nhập — chọn tháng, tải mẫu, dán / thả tệp` | ô dán, vùng thả tệp, nút Tải mẫu, hướng dẫn 3 dòng |
| `HP-LT / 4 Xem trước` | đủ 7 trạng thái, một dòng `unmatched` có ô chọn em, một `replace` 610.000 → 640.000, chân "Sẽ ghi 19 dòng" |
| `HP-LT / 5 Sửa một em` | panel có dòng công thức sống; biến thể đơn giá riêng, biến thể Phải đóng 0đ |
| `HP-LT / 6 Trạng thái` | tải · lỗi · rỗng (3 loại) · tệp bị từ chối |
| `HP-LT / 7 Gia sư bộ môn` | cho thấy tab Học phí **không tồn tại** với vai này (đối chiếu bài `ui-role-everything`) |

---

## 6. Máy trạng thái và ca biên

### 6.1 Dòng học phí của một em trong tháng
```
(không có dòng) ──nhập/sửa tay──▶ SAVED (có row; net>0 → có FeeCharge chưa vào phiếu)
SAVED ──nhập lại/sửa tay──▶ SAVED (thay số; FeeCharge cập nhật tại chỗ, không tạo thứ hai)
SAVED ──DELETE──▶ (không có dòng; gỡ FeeCharge)
SAVED ──cô bấm "Lập phiếu" (đường hiện có)──▶ LOCKED (FeeCharge.invoiceId ≠ null)
LOCKED: bảng không ghi/xoá được (409 ROW_LOCKED). Sửa số trên PHIẾU bằng `set_amount` (có sẵn, mã phiếu không đổi, có lý do + audit).
        Phiếu huỷ KHÔNG thả dòng phí (như mọi kiểu mới hiện nay) → vẫn LOCKED; muốn dùng lại phiếu thì "Khôi phục" phiếu.
```
Phiếu **nháp** đã có cho (em, tháng) từ lớp khác: vẫn cho ghi, `warn` "phiếu nháp đã có": `FeeCharge` mới là khoản rời, cô dùng "Gộp khoản rời" có sẵn (`LooseAndDiscount.tsx`, `looseChargeServer`). Phiếu đã gửi/đóng một phần/đã đóng → `locked`.

### 6.2 Lớp: cách tính
`bất kỳ ──(PUT cau-hinh enable:true, lớp chưa có tiền)──▶ monthly_sheet`; không cạnh ngược, không cạnh nào khác qua API. Lớp **đã có** `FeeCharge` hoặc `MonthlyCourseFee` không chuyển được: tạo lớp mới (hoặc chờ công cụ chuyển của CHỦ-01).

### 6.3 Ca biên (mỗi ca có bài ở mục 8)
1. **Học sinh trùng tên**: `Mã em` trong tệp mẫu giải quyết; dán không mã → `ambiguous` bắt chọn; không bao giờ tự chọn.
2. **Tên khác dấu / hoa thường / khoảng trắng** ("MAI  ANH", "mai anh") → khớp qua `normalizeKey`.
3. **Em trong tệp không có trong lớp** → `unmatched`, không tạo em; em đã rời/tạm dừng cũng `unmatched`.
4. **Em trong lớp không có dòng trong tệp** → không đổi gì, liệt kê ở `rosterNotInFile`.
5. **Thiếu môn**: tệp không có cột môn nào đó → coi 0 buổi, nói rõ ở `columns`; ô trống = 0; cột môn có mà không có trong lớp (và có dữ liệu) → `fatal` (xem 4.2). Cột "Số môn" nhỏ hơn số môn có buổi → `error`.
6. **Đơn giá riêng so với bậc**: đơn giá riêng luôn thắng; **cao hơn** bậc → `warn`; thấp hơn là giảm giá hợp lệ; trống = theo bậc; `0` → `error` ("để miễn hẳn: đặt Buổi miễn phí bằng tổng buổi").
7. **Số môn vượt bậc cuối** (k = 5 mà bậc cuối là 4) → dùng bậc cuối. **k = 0** mà có buổi → `error`.
8. **Học bổng + giảm trừ > gốc** → Phải đóng 0đ, không tạo `FeeCharge`, `warn`.
9. **Giảm % ở Học phí (`StudentDiscount`)** vẫn áp khi lập phiếu → `warn` nêu "em này đang giảm X% ở Học phí, phiếu sẽ giảm thêm" (đọc `StudentDiscount` của chủ lớp).
10. **Hai dòng cùng em trong tệp** → cả hai `error`.
11. **Đổi bảng bậc giữa chừng**: dòng đã ghi giữ `tierRate`; dòng chưa vào phiếu muốn áp bảng mới thì nhập lại / sửa em.
12. **Lớp đổi trưởng**: hiện **chưa có đường đổi `ownerId`** (1.8). Dữ liệu mới khoá theo `courseId`, nhưng `FeeCharge.tutorId` và phiếu gắn gia sư tại lúc ghi. **Yêu cầu cho việc "chuyển chủ lớp" sau này**: phải chặn khi còn dòng `SAVED` chưa vào phiếu, hoặc chuyển `FeeCharge.tutorId` của chúng cùng lúc; đặc tả này ghi điều kiện, không làm. Gia sư bộ môn được mời / gỡ **không ảnh hưởng** gì tới bảng (không FK, không quyền).
13. **Bản xem trước (`VERCEL_ENV=preview`)**: `xac-nhan`, `row`, `cau-hinh` → 503 như `moneyPathsBlocked()`; `xem-truoc` vẫn chạy (không ghi).
14. **Đồng thời**: hai lần xác nhận cùng (lớp, tháng) xếp hàng bằng khoá; xác nhận song song với "Lập phiếu" không tạo dòng trùng và không để dòng đổi giữa lúc đóng băng (`loadUninvoicedCharges(lock)` đã `FOR UPDATE`).
15. **Tháng**: tháng dương lịch `YYYY-MM` (như `FeeCharge.yearMonth`, `TuitionInvoice.yearMonth`), không phải kỳ 15→14. `dateKey` của dòng phí = ngày 1 của tháng; không phụ thuộc múi giờ.

---

## 7. Thông báo

**Không thêm loại thông báo nào.** Lý do: mọi thứ bảng này làm chỉ nằm trong tay chủ lớp tới khi cô tự "Lập phiếu" và "Gửi" (đường hiện có đã thông báo cho phụ huynh theo luật của nó). Quản trị không ghi (4.1) nên không có "ghi đè cần báo chủ lớp" như `course_fee_override`. Test khẳng định: nhập / sửa / xoá **không tạo `Notification` nào**. Nếu chủ chọn cho quản trị ghi (Q5) thì thêm `course_fee_sheet_override` theo đúng mẫu `buildFeeOverrideNotification` (không tên, không tiền, chống dội theo `type+link` chưa đọc).

Nhật ký kiểm toán (`logAction`): `fee_sheet.config`, `fee_sheet.import`, `fee_sheet.row` — metadata chỉ có `courseId`, `yearMonth`, các số đếm và (với `import`) `totalNet`; **không** tên học sinh, không số từng em.

---

## 8. Test phải có

Tên bài theo quy ước `t-*` (máy chủ + Postgres test, COO chạy tuần tự), `*-lib` thuần không cần máy chủ, `ui-*` cần trình duyệt. Bài tự dựng dữ liệu bằng `prisma` trực tiếp (không sửa `h.ts`/`seed*`).

**`t-hp-sheet-lib.ts` (thuần):**
- `computeSheetFee`: đủ 5 hàng ví dụ mục 3.2 (610.000 / 1.500.000 / 360.000 / 660.000 / 0); k suy ra vs ghi tay; k > bậc cuối; k = 0 có buổi → lỗi; miễn > tổng → lỗi; đơn giá riêng 999 → lỗi; HB + GT > gốc → 0; **không làm tròn ở đâu** (mọi kết quả nguyên, kiểm với số lớn 60×6×100.000.000 không tràn `Int` 32-bit: nếu vượt thì lỗi rõ, không âm thầm tràn).
- `tierRateFor`: ranh giới m = bậc, m giữa hai bậc (bảng 1,3 và k = 2 → bậc 1), bảng một dòng.
- `parseVndCell`: `70000`, `70.000`, `70,000`, `70 000` đúng; `70k`, `1tr`, `70.5`, `-5`, `abc`, `=1+1` sai; ô trống.
- `parseSheetGrid`: tiêu đề có dấu / không dấu / thừa khoảng trắng; hàng ví dụ `EXAMPLE_MARK` bị bỏ và báo; cột lạ có dữ liệu → blocking; cột lạ trống → ignored; > 300 dòng → từ chối cả tệp; hai dòng cùng em; số dòng báo là **số dòng thật trong tệp**.
- `matchRoster`: mã đúng, mã lạ, trùng tên → ambiguous, tên khác dấu / hoa thường, em không `active`.
- `hashSheet` ổn định khi đổi thứ tự khoá JSON; đổi một ô → băm đổi.
- `validateTiers` / `validateSubjects`: biên mọi ràng buộc 4.2.

**`t-hp-lop-truong.ts` (API) — ca phá cố ý:**
1. **Quyền (chạy trên cả 7 điểm vào của 4.2):** chưa đăng nhập → 401; học sinh → 403; **gia sư chờ duyệt (role student + đơn pending) → 403**; **gia sư khác (lớp không phải của mình) → 403**, thân không chứa tên lớp / tên em; **lớp không có → 404**; **`subject_teacher` active của lớp → 403**; **`co_teacher` → 403**; `admin_content`/`admin_super`: GET 200, mọi điểm ghi và tải mẫu 403; chủ lớp → 200. Mỗi 403 ở điểm ghi kèm kiểm **đếm bảng không đổi** (`course_fee_sheet_rows`, `fee_charges`, `audit_logs`, `notifications`).
2. **Ma trận quyền:** `canDo("owner","money.edit")` đúng, các vai còn lại sai; `t-course-access-lib` cũ vẫn xanh.
3. **Xem trước không ghi:** đếm `course_fee_tables`, `course_fee_sheet_rows`, `fee_charges`, `audit_logs`, `notifications`, `tuition_invoices` trước/sau bằng nhau, kể cả với tệp toàn dòng sai.
4. **Xác nhận đúng số:** xem trước rồi xác nhận → `CourseFeeSheetRow` và `FeeCharge(kind:"sheet")` đúng số tay tính (mục 3.2); `net = 0` không tạo `FeeCharge`; bấm hai lần → không dòng thứ hai (`written: 0`); đổi tệp giữa xem trước và xác nhận → 409 `FILE_CHANGED`; số khách gửi lên bị bỏ qua (gửi `net` giả → ghi số tính lại).
5. **Tệp xấu bị chặn:** `.xls`; `.xlsm`; tệp .xlsx hỏng / cắt cụt; .xlsx có mật khẩu; **bom nén** (tái dùng mẫu của `t-student-import*`); > 1 MB → 413; 301 dòng → từ chối cả tệp, không ghi dòng nào; không có cột tên/mã → `fatal`; cột môn lạ có dữ liệu → `fatal`; ô `=HYPERLINK("http://x","a")` và `=1+1` không chạy gì, giá trị kết quả / chữ thường; ô số có `70k`, `-5`, `1,5`; **tên hơn 1.000 ký tự / ký tự NUL / chữ vô hình**; JSON thân sai kiểu → 400, không 500.
6. **Học sinh:** hai em trùng tên (có mã → khớp; không mã → `ambiguous`, xác nhận mà không `pick` → bỏ qua hoặc 409 theo `skipErrors`); `pick` sang em **lớp khác** hoặc em đã rời → 400, không ghi; em lớp khác trong tệp → `unmatched`; **`PUT /dong/<id-em-lớp-khác>` → 404**.
7. **Khoá:** dòng đã có phiếu (`invoiceId`) → `locked`, xác nhận không thay số, `FeeCharge` và phiếu giữ nguyên byte; phiếu đã gửi → `locked`; phiếu nháp → `warn` + ghi được; song song `Promise.all(xac-nhan, issueInvoice)` → đúng một dòng phí, tổng phiếu = số đúng, không dòng nào hai lần.
8. **Bật chế độ:** `enable` trên lớp có `FeeCharge` / `MonthlyCourseFee` → 409 `HAS_MONEY_HISTORY`, `feeMode` giữ nguyên; trên lớp mới tinh → `monthly_sheet` + `CourseFeeTable` trong một giao dịch (lỗi giữa chừng → không đổi gì); `POST /api/courses` với `feeMode:"monthly_sheet"` không cần `feeRate`, không tạo `CourseFeeRate`; `fee-rates` POST cho lớp này → 409; `duplicate` sao chép bảng bậc, không sao chép dòng học phí.
9. **Không có thông báo** sau nhập / sửa / xoá; `AuditLog` có đủ ba loại; quét `metadata` bằng tên mẫu và mẫu số điện thoại → không có.
10. **Phiếu thật:** sau xác nhận, `issueInvoice` cho Mai Anh → `amountDue = 610.000`, `breakdown.chargeLines` có dòng "Học phí 11/2026 · …", `FeeCharge.invoiceId` đặt; có `StudentDiscount` 10% → 549.000 (và màn xem trước đã cảnh báo trước đó).
11. **Bản xem trước (`VERCEL_ENV=preview`)**: ba điểm ghi → 503, không ghi.
12. `GET /api/invites/by-code/<mã>` của lớp `monthly_sheet` → `tuition: null`; lớp cách cũ vẫn có `tuition` như cũ.

**Chứng minh phiếu thu đang có không đổi số — `t-hp-lop-truong.ts` mục "bất biến" (bắt buộc, đỏ thì không gộp):**
- Dựng dữ liệu "trước": lớp cách cũ có `MonthlyCourseFee` + phiếu nháp / đã gửi / đã đóng (có tín dụng và `StudentDiscount`), lớp theo buổi có `FeeCharge` đã vào phiếu và chưa vào phiếu, lớp theo khoá, `TuitionOverride`, một phiếu huỷ.
- Chụp **băm JSON** của `tuition_invoices`, `fee_charges`, `monthly_course_fees`, `course_fee_rates`, `course_student_rates`, `student_discounts`, `tuition_overrides`, `session_packages`.
- Chạy **toàn bộ** tính năng mới trên một lớp `monthly_sheet` khác (đặt bậc, xem trước, xác nhận, sửa, xoá, lập phiếu cho em của lớp này) và cả trên một em **học đồng thời lớp cách cũ và lớp bảng** của cùng gia sư.
- Băm lại: **mọi bảng trên, trừ các hàng thuộc lớp `monthly_sheet`, giống hệt từng byte.** Riêng em học hai lớp: phiếu của lớp cách cũ **không đổi bậc** (số môn tính bậc chỉ đếm lớp cách cũ vì `monthly_sheet` không vào `legacyEnrollments`).
- `computeMonthlyFee` và `pricePerSessionVnd` cho cùng đầu vào cùng kết quả như trước (`TUITION_TIER_VND` chưa bị đụng; kiểm bằng bài `t-hocphi-fee-lib` + một ca cố định 70/60/55/50).

**UI — `ui-hp-lop-truong.ts` (1600 và 390):** tab Học phí hiện bảng tháng; tải mẫu thật rồi **thả lại chính tệp đó đã điền** (Playwright `setInputFiles`); dán TSV; xem trước đủ trạng thái, nút xác nhận **tắt** khi 0 dòng ghi được; chọn em cho dòng không khớp rồi xác nhận; sửa một em, dòng công thức sống đúng; **ba trạng thái** (tải / lỗi + Thử lại / rỗng 3 loại); không tràn ngang ở 390; phần tử bấm cao ≥ 44px; số tiền viết đủ (quét DOM không có `\d(tr|k)\b`); công tắc ẩn tiền che số; **trạng thái không chỉ bằng màu**; không có tên thật nào ngoài dữ liệu bài. **Gia sư bộ môn mở `/lop-cua-toi/<id>?tab=hoc-phi` và `/lop-cua-toi/<id>/bang-hoc-phi` → không thấy tab, trang con 404/403, không rò số.** Chạy lại `ui-role-everything`, `ui-links-everywhere`, `ui-tao-lop-per-session`, `ui-hocphi-fee`.

**Bài cũ PHẢI chạy lại (đỏ có sẵn ghi bên cạnh):** `t-hocphi-fee`, `t-hocphi-fee-lib`, `t-hocphi-extra(-lib)`, `t-hocphi-payment(-lib)`, `t-hocphi-dashboard(-lib)`, `t-fee-month-floor-lib`, `t-free-class-fee`, `t-core-regression`, `t-invite-preview`, `t-session-book(-lib)`, `t-course-access-lib`, `t-course-teachers`, `t-tutor-gate-lib`, `t-tutor-routes-lib`, `t-student-import-lib`, `t-links`, `t-no-hex`, `t-no-fabricated`, `t-db-push-guard`, `t-hocphi-schema-additive` *(đỏ có sẵn)*.

Kiểm múi giờ: `t-hp-*` chạy ở UTC và `TZ=Asia/Ho_Chi_Minh` (tháng chọn không đổi).

---

## 9. Cờ và chỗ đổi LUỒNG TIỀN để chủ duyệt

**Cờ:** TIỀN **có** · TRẺ EM **chạm nhẹ** (tên học sinh trong tệp; chủ vẫn chỉ thấy em của lớp mình; người học ≥ 17 theo quyết định 25/10; không thêm dữ liệu liên hệ; audit không ghi tên) · ĐỔI NỀN **không** (exceljs có sẵn, không hạ tầng mới).

### 9.1 Chính xác chỗ nào đổi luồng tiền
| # | Đổi gì | Ở đâu | Ảnh hưởng tới số đã có |
|---|---|---|---|
| **M1** | **Có đường mới ghi tiền**: một `FeeCharge(kind:"sheet")` cho mỗi (em, tháng) của lớp `monthly_sheet`, số tiền = "Phải đóng theo bảng" (đã trừ học bổng/giảm trừ) | `hocPhiSheetServer.ts` (mới) | không (chỉ thêm dòng, chỉ lớp mới) |
| **M2** | **Giá trị `Course.feeMode` mới `"monthly_sheet"`**, thuộc nhóm "kiểu mới" (`isNewFeeMode`). Và **lần đầu có đường đổi `feeMode` qua API** (HOCPHI-THEO-BUOI 3.3.1 từng chốt "không đổi qua API"), nới **chỉ** cho lớp chưa có `FeeCharge`/`MonthlyCourseFee` | `tuitionFee.ts:16`; `PUT cau-hinh enable` | không: lớp có tiền không đổi được. Lớp cũ giữ nguyên |
| **M3** | **Bảng bậc theo lớp (gia sư tự đặt)** thay cho bậc cứng chung — chỉ trong lớp `monthly_sheet`. `TUITION_TIER_VND` 70/60/55/50 và `tuition.ts` **không sửa** | `CourseFeeTable` | không; lớp cách cũ vẫn dùng bậc chung |
| **M4** | **Chỗ HIỂN THỊ tiền đổi**: (a) bảng học phí tháng cộng `kind:"sheet"`, số của lớp này là **sau** học bổng/giảm trừ (lớp theo buổi là trước giảm) — ghi chú dưới bảng; (b) trang xem trước lớp cho học sinh: lớp `monthly_sheet` không hiện bậc chung | `hocPhiDashboard.ts:66`; `invites/by-code:98` | chỉ chữ/hiển thị |
| **M5** | **Có thể giảm hai lần**: `StudentDiscount` (giảm % ở Học phí) vẫn áp lúc lập phiếu lên số đã trừ học bổng/giảm trừ trong bảng (hành vi hiện có của `composeFinalAmount`, không sửa). Cách xử lý đề xuất: **cảnh báo ở xem trước**, không tự tắt | `invoiceServer.ts:140` | không đổi; chỉ cảnh báo (Q4) |
| **M6** | Ghi tiền bị chặn ở bản xem trước (`moneyPathsBlocked`) như mọi đường tiền khác | `hocPhiSheetServer.ts` | không |

**KHÔNG đổi (sẽ có bài chứng minh):** `invoiceServer.ts`, `feeChargeServer.ts`, `sessionBookServer.ts`, `tuition.ts`, mọi cột / bảng cũ; mọi `FeeCharge`, phiếu, `MonthlyCourseFee`, `CourseFeeRate`, `StudentDiscount`, `TuitionOverride`, `SessionPackage` đã có.
Hiệu ứng gián tiếp cần biết: `feeChargeServer.ts` và `invoiceServer.ts` **nhập `normalizeFeeMode`/`isNewFeeMode` từ `tuitionFee.ts`**; thêm `monthly_sheet` vào danh sách kiểu mới làm hai tệp khóa đối xử lớp này đúng như "kiểu mới không sinh phí theo buổi" (`syncSessionCharges` trả `skipped:"mode"`, `ensureCourseCharges` bỏ qua) **mà không sửa chữ nào** — bài mục 8 kiểm điều này.

### 9.2 Một sai số có sẵn phát hiện thêm (ngoài việc này, báo chủ)
`invites/by-code` hiện trả "bậc chung" (`tuitionPreview`) cho **mọi lớp có học phí**, kể cả lớp theo buổi 150.000đ (`api/invites/by-code/[code]/route.ts:98`): học sinh thấy "70.000đ một buổi" trước khi vào lớp. Việc này chỉ sửa cho lớp `monthly_sheet`; lớp theo buổi / giờ / khoá cần quyết định riêng (đề nghị `tuition: null` hoặc đơn giá lớp thật).

### 9.3 Câu hỏi cho chủ (mặc định nếu chủ không trả lời)
1. **Loại lớp mới "Theo bảng học phí tháng"** tách khỏi "Theo buổi" tự động; **lớp chưa phát sinh tiền** chuyển được, lớp đã có tiền thì tạo lớp mới. Đúng ý chưa? *(Mặc định: đúng.)*
2. **"Số môn" để chọn bậc** = cột "Số môn" cô ghi nếu có, không thì đếm số môn có buổi trong tháng. Hay luôn là số môn em đăng ký? *(Mặc định: như vừa nêu.)*
3. **Buổi miễn phí** trừ vào **tổng buổi** (một đơn giá chung cho mọi môn), đúng như sheet? *(Mặc định: đúng.)*
4. **Học bổng và giảm trừ (đồng)** trừ sau khi nhân đơn giá, không xuống dưới 0 — đúng? **Giảm % ở Học phí** vẫn áp thêm (chỉ cảnh báo) hay muốn tắt cho lớp bảng? *(Mặc định: giữ, chỉ cảnh báo.)*
5. **Gia sư bộ môn**: không xem tiền gì (đúng "chỉ xem nếu cần" ở mức an toàn nhất)? Hay cho xem **mức học phí của lớp** chỉ đọc? **Quản trị trung tâm** chỉ xem, hay được sửa như đơn giá lớp theo buổi hiện nay (có báo chủ lớp)? *(Mặc định: gia sư bộ môn không thấy; quản trị chỉ xem.)*
6. **Chia tiền cho gia sư bộ môn**: KiN không chia, không ghi; một phiếu thu về tài khoản của gia sư tạo lớp, cô tự chia. Đúng? *(Mặc định: đúng.)*
7. **Bảng bậc theo từng lớp** (điền sẵn từ lớp trước) hay **một bảng chung** cho mọi lớp của cô? *(Mặc định: theo lớp.)*
8. **Tháng thu học phí** theo tháng dương lịch (như phiếu hiện nay) hay kỳ 15→14? *(Mặc định: tháng dương lịch.)*
9. **Lập phiếu rồi mới phát hiện sai số**: sửa bằng "Sửa số tiền phiếu" có sẵn (mã phiếu giữ nguyên) — chấp nhận, hay cần mở khoá dòng trong bảng? *(Mặc định: dùng cách có sẵn.)*

---

## 10. Tệp chung / khóa cần xin COO (mẫu BAN-GIAO.md mục D, chỉ thêm)

| # | Yêu cầu | Chủ tệp | Ghi chú |
|---|---|---|---|
| D1 | Ghi nhận **ngoại lệ KHÓA có điều kiện** cho `src/lib/hocPhiSheetServer.ts` (tệp MỚI, **ghi `FeeCharge`**): chỉ làm sau khi chủ duyệt mục 9; không mở khóa `feeChargeServer.ts`/`invoiceServer.ts`/`sessionBookServer.ts` | COO | tiền lệ: `hocPhiDashboardServer.ts` |
| D2 | `prisma/schema.prisma`: thêm hai model mục 3.1 + hai quan hệ ngược trên `Course` (chỉ thêm) | COO | qua `t-db-push-guard`, `t-hocphi-schema-additive` |
| D3 | `src/lib/courseAccess.ts` + `t-course-access-lib.ts`: hành động `money.edit` chỉ cho `owner` (tệp của tut-code, nhưng thuộc TUT-dong-giang đã gộp — xin COO xác nhận không xung đột với nhánh đang mở) | COO / tut-code | |
| D4 | `src/lib/tuitionFee.ts`: thêm `monthly_sheet` vào `NEW_FEE_MODES`, nhãn, đơn vị. Tệp thuần dùng chung máy chủ + giao diện, **gián tiếp đổi cách hai tệp khóa phân loại lớp** (9.1) → cần chủ duyệt bằng văn bản | COO | |
| D5 | `src/app/api/invites/by-code/[code]/route.ts` (`api/invites/**` của tut-code) và `src/lib/invitePreview.ts`: lớp `monthly_sheet` → `tuition: null` | tut-code | hiển thị |
| D6 | `docs/kin/phong-ban/SO-VIEC.md`: thêm dòng `HP-LOP-TRUONG` (TIỀN = có, chờ chủ duyệt); ghi liên hệ với CHỦ-01 (chuyển lớp cũ) và TUT-dong-giang (quyền) | COO | |
| D7 | Khung Figma mục 5.4: dựng khi có công cụ Figma (trang Bigupdate, tệp `2orXvoHL2upkiGoMjlq8aX`) | COO giao | chưa dựng ở lượt này |
| D8 | `docs/kin/phong-ban/dac-ta/HOCPHI-THEO-BUOI.md` mục 3.3.1: ghi chú "ngoại lệ HP-LOP-TRUONG: đổi `feeMode` cho lớp chưa có tiền" | COO | tránh hai tài liệu mâu thuẫn |
| — | Phòng Quản trị: **không cần làm gì** (không sửa `admin/khoa-hoc/[id]/page.tsx`, `admin/thi-thu/**`; quản trị chỉ xem qua GET) | — | nếu chủ chọn Q5 "quản trị được sửa" thì thêm yêu cầu cho adm-code/adm-dev sau |
