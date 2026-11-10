# GS-LOP-GON — Lớp gọn của gia sư (đặc tả)

Phòng Gia sư · rnd: tut-rnd · 09/11/2026 · căn cứ origin/main `f0378557` · nguồn việc: brief COO "Lớp gọn" (chủ thấy bản chạy thật "khó dùng, ẩu").
Tệp này là đặc tả, KHÔNG phải mã. tut-rnd không sửa `src/`. Số dòng ghi theo `f0378557`.

Quy ước: "gia sư" gọi là "cô" trong chữ hiển thị. Không chữ "đã xác minh". Không số bịa. Mọi màu qua `--kin-*`. Nút ≥ 44px. Không tràn ngang ở 390 và 1280. Mọi trạng thái có CHỮ.

---

## 0. Tóm tắt quyết định

1. Giữ phương án ROUTE-THEO-TAB của trưởng phòng, có 4 chỉnh có bằng chứng (mục 4.2): tab Học sinh và tab Cài đặt chứa "mục con" bằng `?muc=`; nhãn tab Bài tập; đồng giảng chỉ có 2 tab; `moi=1` hạ cánh ở Học sinh.
2. Một dải tab duy nhất (`TutorContentTabs`) + một đầu lớp (tên, môn, trạng thái, "← Lớp học") ở layout lồng `quan-lop/[id]/layout.tsx`. Bỏ breadcrumb và dải tab thứ hai của trang quản khoá khi chạy trong vỏ gia sư.
3. `/lop-cua-toi/[courseId]` với chủ lớp + gia sư → 307 + `no-store` sang đúng tab, giữ query. Đồng giảng, quản trị xem, học sinh giữ `LopChiTiet` / `OutlookShell`.
4. Ngăn "Thêm bài học": thả tệp thật (init → PUT/POST có tiến trình → complete → gắn vào `Lesson.documents`). Bỏ nhánh `pendingDocuments` chết. Khi kho tắt: hiện lý do + vẫn dán link. Không có UI video.
5. Lớp học = thư viện thẻ, thay bảng. Bỏ callout "Điểm danh và học phí đi cùng nhau".
6. Bỏ "Kế hoạch buổi" khỏi `MORE_BASE`. Chứng minh bằng mã: đó là `SessionPlan`, không phải chốt buổi / sinh phí (mục 7).
7. Không đổi schema. Không đổi tính tiền. Chuyển `LopHocPhi` / `LopPhiKhac` chỉ là DI CHUYỂN (cờ TIỀN).

---

## 1. Vấn đề + bằng chứng

### 1.1 Năm việc

| # | Vấn đề | Bằng chứng (tệp:dòng) |
|---|---|---|
| 1 | Ngăn "Thêm bài học" không cho thả tệp. Chữ trong ngăn nói "dùng tab Giáo trình của lớp (sắp có). Hiện chỉ dán link Drive" | `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx:645-647` (`data-tai-lieu-dong`). Nhánh "tệp chờ tải lúc bấm Lưu" là mã chết: `resolvePendingDocuments` ném lỗi "Tải tệp công khai đã đóng" khi có tệp chờ (`:1491-1498`), còn `DocumentsEditor` vẫn vẽ hàng "Sẽ tải lên khi bấm Lưu" (`:617-626`) và giữ `pendingDocuments` (`:85`, `:93`, `:1457`, `:1571`, `:1727-1728`). Trong khi đường tải thật đã có: `OTaiLen.tsx:147-166` (init → `sendWithProgress` → complete), `/api/media/document/{init,complete}`, `DropZone.tsx:10-61` |
| 2 | Lớp học là một cái bảng 5 cột, không có ảnh bìa, chữ "Đặt lịch" / "Mời học sinh →" lẫn trong ô | `src/components/tutor/LopHoc.tsx:19` (`COLS` 5 cột), `:85-87` (đầu bảng), `:92-122` (hàng). Callout thừa `:124-126` "Điểm danh và học phí đi cùng nhau" |
| 3 | Mở một lớp rơi vào "Buổi học & điểm danh", không thấy giáo trình. Có tới 6 tab trong trang và 4 nút trên đầu lặp lại tab | `src/app/lop-cua-toi/[courseId]/page.tsx:104` (`initialTab ?? "diem-danh"`); `LopChiTiet.tsx:110-115` (6 tab), `:119-134` (nút "Lịch học", "Giáo trình", "Bản ghi của lớp", "Cài đặt lớp" lặp tab) |
| 4 | Tab bị lặp: dải tab vỏ gia sư + breadcrumb quản trị + đầu trang quản khoá + dải tab thứ hai | `quan-lop/[id]/page.tsx` chỉ re-export trang quản khoá; trang đó vẽ "Bảng điều khiển / Danh sách khoá học / …" (`admin/khoa-hoc/[id]/page.tsx:2199-2204`), đầu khung + nút "Mở lớp" (`:2208-2224`), dải tab riêng `TABS.map` (`:2228-2240`, `:2130-2135`), trong khi `(noi-dung)/layout.tsx` đã vẽ `TutorContentTabs` |
| 5 | "Kế hoạch buổi" nằm trong nhóm "Dạy học" của bảng Khác nhưng không phải chốt buổi / phí | `TutorShell.tsx:32`; bằng chứng mã ở mục 7 |

### 1.2 RÀ LẶP toàn vỏ gia sư (h1, tab, nút)

| Chỗ | Lặp gì | Bằng chứng | Cách sửa |
|---|---|---|---|
| `quan-lop/[id]?tab=cai-dat|chuong-bai` | 2 dải tab (vỏ + trang) | `TutorContentTabs.tsx:13-23` và `admin/khoa-hoc/[id]/page.tsx:2228-2240` | Trang gia sư mới KHÔNG dùng khung của trang quản khoá. Chỉ tái dùng `TabCaiDat` / `TabChuongBai` |
| cùng trang | breadcrumb quản trị trong vỏ gia sư | `:2199-2204` | Không vẽ ở đường gia sư |
| cùng trang | tên lớp 2 lần (breadcrumb + h1) | `:2203`, `:2212` | Một đầu lớp ở layout lồng |
| cùng trang | "Mở lớp" dẫn về trang đang chuyển hướng tới chính nó sau GS-LOP-GON | `:2217-2224` | Bỏ ở đường gia sư |
| `quan-lop/[id]/giao-trinh` | tên tab "Giáo trình" = h1 "Giáo trình" | `giao-trinh/GiaoTrinh.tsx:49`, `:149` (`KinPageHeader title="Giáo trình"`) | Prop `embedded`: bỏ tiêu đề + "back", giữ `actions` |
| `quan-lop/[id]/diem-danh` | tab "Điểm danh" = h1 "<lớp> · Điểm danh" | `DiemDanh.tsx:263` | Prop `embedded` |
| `quan-lop/[id]/lich-hoc` | h1 "Khung giờ học của lớp" dưới tab "Lịch học" | `LichKhung.tsx:156` | Prop `embedded` |
| `quan-lop/[id]/hoc-vien` | h1 "Danh bạ lớp" dưới tab | `admin/khoa-hoc/[id]/hoc-vien/page.tsx:66-67` | Tách phần danh bạ ra `src/components/tutor/DanhBaLop.tsx`, trang quản trị import lại |
| `/lop-cua-toi/[courseId]` (LopChiTiet) | 4 nút đầu trang trùng tab và trùng hành vi tab | `LopChiTiet.tsx:121-134` | Sau 307 chủ lớp không còn thấy trang này. Đồng giảng giữ trang; chỉ giữ nút "Giáo trình" (đã có tab thì bỏ), xem mục 4.5 |
| Thanh bên gia sư | "Kế hoạch buổi" trong "Dạy học" nhưng lối thật là từ Lịch / Buổi | `TutorShell.tsx:32`, `LichClient.tsx:671`, `BuoiChiTiet.tsx:279` | Bỏ khỏi `MORE_BASE` |
| Danh sách lớp | callout lặp ý với mục Học phí | `LopHoc.tsx:124-126` | Bỏ |

Việc tut-dev: quét lại toàn vỏ sau khi sửa bằng test mới `ui-gs-lop-gon.ts` (mục 9): mỗi trang `quan-lop/[id]/*` đúng 1 `h1`, đúng 1 `nav[aria-label^="Trang của"]`, không chữ "Bảng điều khiển /".

---

## 2. Phạm vi tệp

Nguyên tắc: không tệp nào thuộc cả hai. Hai phòng khác sở hữu: `admin/khoa-hoc` và `admin/thi-thu` (Quản trị) — xem 2.3.

### 2.1 tut-code (máy chủ, hàm thuần, dữ liệu)

Tệp MỚI:
- `src/lib/tutorClassRoutes.ts` — hàm thuần `legacyClassTarget(courseId, query)` (bảng ở 3.1), `classTabFromQuery`, `MUC_HOC_SINH`, `MUC_CAI_DAT` (danh sách `muc` hợp lệ), `coverImageOf(bg)` (chỉ nhận `url("https://…")`, còn lại `null`).
- `src/lib/tutorClassPageServer.ts` — dựng dữ liệu cho tab Học sinh / Cài đặt / Điểm danh: `loadClassHead(session, courseId)` (vai + tên + môn + trạng thái, trả 403/404 đúng thứ tự), `loadStudentsTab(...)` (danh bạ + hàng chờ duyệt + mã lớp + chính sách vào lớp, TÁCH từ `[courseId]/page.tsx:34-108`), `loadAttendanceHistory(...)` (`history`, `sessionsTaught` từ `[courseId]/page.tsx:78-84`).
- `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/page.tsx` — SỬA (đổi từ re-export). Server: `redirectIfNotTutor` → kiểm chủ → 307 hoặc render tab `cai-dat` / `chuong-bai`.
- `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/layout.tsx` — MỚI. Cổng + đầu lớp + dải tab (cần vì `(noi-dung)/layout.tsx` không có tham số `[id]`).
- `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/hoc-vien/page.tsx` — SỬA: trang gia sư riêng, KHÔNG còn re-export trang quản trị.
- `src/app/lop-cua-toi/(tutor)/(noi-dung)/quan-lop/[id]/diem-danh/page.tsx` (+ `diem-danh/in` nếu có) — SỬA tương tự (tách khỏi re-export).
- `src/app/lop-cua-toi/[courseId]/page.tsx` — SỬA: chủ lớp + gia sư → `redirect()` bằng `legacyClassTarget`; các nhánh còn lại giữ nguyên.

Tệp SỬA (thêm, không đổi hành vi cũ):
- `src/lib/tutorClassTable.ts` — `TutorClassRow` thêm `cover: string | null` (add-only).
- `src/lib/tutorClassTableServer.ts` — `select` thêm `bg`; điền `cover = coverImageOf(bg)`. Không gửi chuỗi `bg` thô ra trình duyệt.
- `src/lib/tutorRoutes.ts` — `contentTabsFor(pathname, tab, role?)` (thứ tự, nhãn, tab theo vai). Tệp này thuần: tut-code sở hữu để có test hàm thuần.
- `tools/local-e2e/t-tutor-routes-lib.ts`, `t-class-routes-lib.ts` (MỚI), `t-lop-gon.ts` (MỚI, API) — mục 9.

### 2.2 tut-dev (giao diện)

Tệp MỚI:
- `src/components/tutor/ClassHead.tsx` — đầu lớp một lần (tên, môn, nhãn trạng thái bằng CHỮ, "← Lớp học").
- `src/components/tutor/HocSinhTab.tsx` — tab Học sinh + mục con (danh bạ / xin vào lớp / mã mời / thêm học sinh).
- `src/components/tutor/CaiDatTab.tsx` — tab Cài đặt + mục con (thông tin lớp / học phí lớp / đồng giảng / cộng đồng / bản ghi).
- `src/components/tutor/DanhBaLop.tsx` — danh bạ tách từ `admin/khoa-hoc/[id]/hoc-vien/page.tsx`.
- `src/components/tutor/quan-lop/QuanLopCourse.tsx` — client tải `/api/courses/<id>` rồi vẽ `TabCaiDat` / `TabChuongBai` (dùng cho trang gia sư).
- `src/components/tutor/quan-lop/TabCaiDat.tsx`, `TabChuongBai.tsx`, `DrawerBaiHoc.tsx`, `DocumentsEditor.tsx`, `AssignmentEditor.tsx` — CẮT từ `admin/khoa-hoc/[id]/page.tsx` (bản đồ ở 2.4).
- `src/components/tutor/upload/useTaiLenTep.ts`, `sendWithProgress.ts` — hook dùng chung (mục 5).
- `src/components/tutor/ThuVienLop.tsx` — thẻ lớp (mục 6). `LopHoc.tsx` chỉ còn bộ lọc + gọi `ThuVienLop`.

Tệp SỬA:
- `src/components/tutor/LopHoc.tsx` — bảng → thư viện thẻ; bỏ callout.
- `src/components/tutor/TutorContentTabs.tsx` — prop `scope: "de-thi" | "quan-lop"`, `role`.
- `src/app/lop-cua-toi/(tutor)/(noi-dung)/layout.tsx` — chỉ vẽ dải cho `de-thi` (`scope="de-thi"`); `quan-lop` do layout lồng vẽ.
- `src/components/tutor/giao-trinh/OTaiLen.tsx` — import hook / `sendWithProgress` từ `upload/` (hành vi KHÔNG đổi).
- `giao-trinh/GiaoTrinh.tsx`, `DiemDanh.tsx`, `LichKhung.tsx` — thêm prop `embedded` (mục 1.2).
- `src/components/tutor/LopChiTiet.tsx` — chỉ dành cho đồng giảng / quản trị: bỏ nút lặp (mục 4.5).
- `src/components/tutor/TutorShell.tsx` — bỏ `MORE_BASE[0].links[0]` (`:32`) + sửa chú thích `:4`. Chỉ thế.
- `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx` — CHỈ cắt mã ra và `import` lại; giữ dải tab trong và breadcrumb của quản trị (xin Quản trị duyệt, mục 12).
- `src/app/(admin)/admin/khoa-hoc/[id]/hoc-vien/page.tsx` — chỉ gọi `DanhBaLop`.
- `tools/local-e2e/ui-*.ts` — các bài giao diện ở mục 9.

### 2.3 Phòng khác

- `admin/khoa-hoc/[id]/page.tsx` (2.250 dòng) thuộc Quản trị. COO đã đồng ý tách. Điều kiện: Quản trị giữ nguyên hành vi, dải tab trong, URL `/admin/khoa-hoc/…`. Ghi vào mục 12.
- `admin/thi-thu` — không đụng.
- `hostRouting.ts`, `notify.ts`, `schema.prisma` — không đụng (mục 12 hỏi nếu cần).
- `feeCharge*`, `invoiceServer*`, `sessionBook*`, `api/fees*`, `api/invoices*` — KHÔNG sửa dòng nào.

### 2.4 Bản đồ cắt `admin/khoa-hoc/[id]/page.tsx`

| Khối | Dòng | Ra tệp |
|---|---|---|
| Hàm link, kiểu, `DrawerToggle`, `Drawer`, `DelModal` | `:96-236` | `quan-lop/DrawerBaiHoc.tsx` (+ `lessonForm.ts` thuần) |
| `TabCaiDat` + `extractBgImage` | `:237-532` | `quan-lop/TabCaiDat.tsx` |
| `detectType`, `DocBadge`, `DocumentsEditor` | `:533-664` | `quan-lop/DocumentsEditor.tsx` |
| Bài tập tự nộp, `AssignmentForm`, `GradeSubmissionsModal`, `InteractiveResultsModal`, `AssignmentEditor` | `:665-1259` | `quan-lop/AssignmentEditor.tsx` |
| `TabChuongBai` | `:1270-1971` | `quan-lop/TabChuongBai.tsx` |
| `TabHocVienKhoaHoc`, `LopLichCaiDat`, `TabLichHoc` | `:1972-2127` | giữ trong trang quản trị (đường gia sư không dùng: đã có `/hoc-vien`, `/lich-hoc`) |
| Trang (`KhoaHocDetailPage`) | `:2137-2250` | giữ |

Chuyển `TabCaiDat` ra ngoài làm hết hiệu lực mục allow-list của `t-no-hex` cho tệp cũ. Hex còn lại trong `TabCaiDat` phải đổi sang `--kin-*` HOẶC đổi đường dẫn trong allow-list. Mặc định: đổi sang token (tut-dev), nếu không thì cập nhật allow-list và ghi trong bàn giao.

---

## 3. Hợp đồng route

Tất cả chuyển hướng phiên là 307 + `Cache-Control: no-store` (không 308). Ghi (POST) vẫn 303 như cũ.

### 3.1 Bảng cũ → mới

`/lop-cua-toi/[courseId]` — chỉ khi người xem là chủ lớp (`isOwner && isTeacher`). Khung đích: `Q = /lop-cua-toi/quan-lop/<encodeURIComponent(id)>`.

| `?tab=` cũ | Đích mới | Query giữ (danh sách trắng) |
|---|---|---|
| (không có) | `Q/giao-trinh` | |
| `diem-danh` | `Q/diem-danh` | |
| `hoc-sinh` | `Q/hoc-vien` (thêm `muc=xin-vao` nếu có `duyet` hoặc `n`; còn lại không `muc`) | `them`, `duyet`, `n` |
| `ma-moi` | `Q/hoc-vien?muc=ma-moi` | `moi`, `them`, `ma` |
| `giao-vien` | `Q?tab=cai-dat&muc=dong-giang` | |
| `hoc-phi` | `Q?tab=cai-dat&muc=hoc-phi` | |
| `cong-dong` | `Q?tab=cai-dat&muc=cong-dong` | |
| lạ | như "(không có)" | |
| không `tab`, có `moi=1` | `Q/hoc-vien?muc=ma-moi&moi=1` | `them`, `ma` |
| không `tab`, có `lich=loi` | `Q/lich-hoc?lich=loi` | |
| không `tab`, có `duyet` | `Q/hoc-vien?muc=xin-vao` | `duyet`, `n` |

Danh sách trắng query là `moi, lich, them, duyet, n, ma`. Mọi tham số khác bị bỏ (không mở chuyển hướng ra ngoài, không rò tham số lạ). `courseId` luôn qua `encodeURIComponent`.

`quan-lop/[id]` (trang gia sư MỚI):

| `?tab=` | Hành vi |
|---|---|
| (không có), lạ | 307 → `…/giao-trinh`, giữ danh sách trắng |
| `giao-trinh` | 307 → `…/giao-trinh` |
| `diem-danh` | 307 → `…/diem-danh` |
| `lich-hoc` | 307 → `…/lich-hoc` (liên kết cũ, kể cả từ proxy `/admin/khoa-hoc/<id>?tab=lich-hoc`) |
| `hoc-vien` | 307 → `…/hoc-vien` |
| `cai-dat` | 200, tab Cài đặt; `?muc=` mục con (mặc định `thong-tin`) |
| `chuong-bai` | 200, tab Bài tập (cây Phần / Chương / Bài + `AssignmentEditor`) |

Mục con (do `?muc=`, không dùng `#hash` vì máy chủ không đọc được hash, e2e không `waitForURL` được):

- Học sinh (`…/hoc-vien`): `danh-ba` (mặc định) · `xin-vao` · `ma-moi` · `them`.
- Cài đặt (`…?tab=cai-dat`): `thong-tin` (mặc định) · `hoc-phi` · `dong-giang` · `cong-dong` · `ban-ghi`.
- `muc` lạ → mục mặc định, không lỗi.

Chuỗi hai bước: `/admin/khoa-hoc/<id>?tab=lich-hoc` → (proxy 307) `…/quan-lop/<id>?tab=lich-hoc` → (trang) 307 `…/lich-hoc`. Chấp nhận hai bước. Test `ui-tutor-admin.ts:127-128` phải đổi theo (mục 9).

Liên kết thông báo hiện có trỏ `/lop-cua-toi/<id>?tab=hoc-sinh|hoc-phi|giao-vien` (xem `t-join-request.ts:70`, `t-fee-rule-audit-lib.ts:28`, `t-hocphi-*`). KHÔNG sửa `notify.ts` và nội dung thông báo; các đường này tự chạy qua 307. Thông báo vẫn không chứa tên người, không chứa tiền (không đổi).

### 3.2 Kiểm quyền

Layout lồng `quan-lop/[id]/layout.tsx`, thứ tự trả lời (khớp `courseAccessServer.ts:3` "401 → 403 khoá → 403 không phải gia sư → 404 không có lớp → 403 người lạ"):

1. `redirectIfNotTutor` (gia sư chờ duyệt về `/lop-cua-toi/cho-duyet`; khách về đăng nhập; học sinh về `/lop-cua-toi`).
2. Id không dùng được (`unusableId`) hoặc không có lớp → màn "Không tìm thấy lớp" (HTTP 404 qua `notFound()`).
3. Lớp của người khác (không phải chủ, không phải đồng giảng đang hoạt động) → màn "Bạn không có quyền với lớp này" (HTTP 403, không mang dữ liệu lớp: không tên, không môn).
4. Vai đọc bằng `courseRoleForPage(session, id)` (đọc lại User từ DB cho đồng giảng).

Ai thấy gì:

| Vai | Đường | Kết quả |
|---|---|---|
| Chủ lớp | `quan-lop/[id]/*` | đủ 6 tab |
| Chủ lớp | `/lop-cua-toi/[courseId]` | 307 sang tab |
| Đồng giảng / giáo viên bộ môn | `/lop-cua-toi/[courseId]` | `LopChiTiet` như cũ (`coRole`) |
| Đồng giảng | `quan-lop/[id]/giao-trinh`, `/lich-hoc` | thấy; dải chỉ có "Giáo trình · Lịch học" |
| Đồng giảng | `quan-lop/[id]/hoc-vien`, `/diem-danh`, `?tab=cai-dat|chuong-bai` | 307 → `/lop-cua-toi/<id>` |
| Quản trị xem (admin super/content) | `/lop-cua-toi/[courseId]` | `LopChiTiet` như cũ (preview) |
| Quản trị | `/admin/khoa-hoc/<id>` | trang quản trị như cũ, KHÔNG đổi |
| Học sinh | `/lop-cua-toi/[courseId]` | `OutlookShell` như cũ |
| Học sinh | `quan-lop/…` | về `/lop-cua-toi` (như `(noi-dung)/layout.tsx` hiện tại) |

Lý do cho đồng giảng: `LopChiTiet.tsx:129-134` cho đồng giảng nút "Giáo trình"; API giáo trình G1 trả theo vai. Nếu layout lồng chỉ cho chủ lớp thì đồng giảng gãy. Điểm chưa kiểm được: đồng giảng có thật sự cần `/lich-hoc` không (nút "Lịch học" `LopChiTiet.tsx:123` chỉ nằm ở nhánh `mgr`). Mặc định: cho vào, vì API khung giờ tự chặn theo vai. tut-code xác nhận bằng `grep courseRoleForPage` ở `api/tutor/lop/[courseId]/lich*` trước khi chốt. Nếu API chặn, bỏ tab "Lịch học" khỏi dải của đồng giảng.

### 3.3 Dải tab

`contentTabsFor(pathname, tab, role?)` cho `quan-lop/[id]*`:

| Thứ tự | Nhãn | href | Sáng khi |
|---|---|---|---|
| 1 | Giáo trình | `…/giao-trinh` | `sub=giao-trinh[/…]` |
| 2 | Học sinh | `…/hoc-vien` | `sub=hoc-vien` hoặc `?tab=hoc-vien` |
| 3 | Điểm danh | `…/diem-danh` | `sub=diem-danh[/…]` |
| 4 | Bài tập | `…?tab=chuong-bai` | `tab=chuong-bai` |
| 5 | Lịch học | `…/lich-hoc` | `sub=lich-hoc` hoặc `?tab=lich-hoc` |
| 6 | Cài đặt | `…?tab=cai-dat` | `tab=cai-dat` |

`role === "co_teacher" | "subject_teacher"` → chỉ tab 1 và tab 5. Mặc định "Cài đặt" không còn sáng khi không có `?tab=` (trang không `tab` đã 307 đi). Hàm vẫn thuần, nhận chuỗi `tab`.

Tab "Bài tập" ở đây đổi nhãn từ "Bài tập tự nộp" (A8). Xem câu hỏi Q2.

---

## 4. Nhà mới cho từng khối `LopChiTiet`

### 4.1 Bảng

Khối trong `LopChiTiet.tsx` → chỗ ở. Không khối nào mất lối vào.

| Khối | Dòng | Chỗ mới | Ghi chú |
|---|---|---|---|
| Tab "Buổi học & điểm danh" (`DiemDanh` nhúng, "Buổi đang xem", "Tạo buổi điểm danh") | `:177-231` | tab Điểm danh (`…/diem-danh`) | trang này đã có `DiemDanh` riêng; `embedded` |
| "Lịch sử buổi học" (5 buổi gần nhất, link sang buổi) | `:209-230`, `page.tsx:78-84` | cuối tab Điểm danh | dữ liệu từ `loadAttendanceHistory` |
| Tab "Học sinh · n" + danh sách + nút "Thêm học sinh" + chọn em | `:232-270`, `:99-108` | tab Học sinh, `muc=danh-ba` và `muc=them` | link tới `/lop-cua-toi/hoc-sinh/em/<id>` giữ nguyên |
| `JoinRequests` (duyệt xin vào lớp) | `:235` (`retryHref` `…?tab=hoc-sinh`) | tab Học sinh, `muc=xin-vao`; nhãn mục con có số chờ | `retryHref` đổi sang `…/hoc-vien?muc=xin-vao`. 303 của `/yeu-cau/**` giữ nguyên đích cũ (sang `/lop-cua-toi/<id>?tab=hoc-sinh&duyet=…`) rồi 307 |
| `ClassJoinHowTo` + `ClassInvitesPanel` (mã mời, chính sách vào lớp) | `:169-171`, `:274-281` | tab Học sinh, `muc=ma-moi` | |
| `GiaoVienLop` (đồng giảng) | `:272` | tab Cài đặt, `muc=dong-giang` | |
| `LopHocPhi` + `LopPhiKhac` | `:283-288` | tab Cài đặt, `muc=hoc-phi` | TIỀN: chỉ dời, không đổi dòng nào trong hai tệp |
| "Cộng đồng lớp" (`OpenPage` → `/lop-cua-toi/kiem-duyet`) | `:291-294` | tab Cài đặt, `muc=cong-dong` | |
| "Bản ghi của lớp" (`/lop-cua-toi/[courseId]/ban-ghi`) | `:128`, `:133` | tab Cài đặt, `muc=ban-ghi` (liên kết) | route `ban-ghi` giữ nguyên |
| Callout "Lớp chưa có lịch học" | `:144-150` | tab Lịch học (khi chưa có khung) và đầu Giáo trình (một dòng nhắc) | |
| "Đã tạo lớp", "Đã thêm N học sinh", "Lớp đã tạo nhưng…" | `:160-167` | tab Học sinh (hạ cánh của `moi=1`) | |
| `duyetMessage` (thông báo sau duyệt) | `:168` | tab Học sinh, `muc=xin-vao` | |
| Đầu trang: tên, môn, "← Lớp học" | `:119` | `ClassHead` (layout lồng) | một lần |
| Dải "Miễn phí" | `:142` | `ClassHead` (nhãn chữ) | |

### 4.2 Lỗ hổng của ROUTE-THEO-TAB (có bằng chứng) và cách vá

1. **"Học sinh" ↔ `/hoc-vien` không đủ chỗ.** Trang `/hoc-vien` hiện chỉ là danh bạ (`hoc-vien/page.tsx:24-66`), không có duyệt xin vào lớp, mã mời, thêm học sinh (chúng nằm trong `LopChiTiet.tsx:232-281`). Vá: mục con `?muc=`.
2. **"Cài đặt" ↔ `?tab=cai-dat` chỉ là form thông tin** (`TabCaiDat`, `:242-532`), không chứa học phí, đồng giảng, cộng đồng, bản ghi. Vá: mục con.
3. **Cây Phần/Chương/Bài nằm dưới tab tên "Bài tập"**, trong khi tệp tài liệu của giáo trình phẳng nằm ở tab "Giáo trình" (BU-02). Cô có hai nơi gắn tệp và tên tab không nói đúng. Vá tối thiểu: tab "Bài tập" mở đầu bằng một dòng "Cây Phần · Chương · Bài và bài tập tự nộp. Giáo trình mới nằm ở tab Giáo trình." (CHỮ). Không đổi dữ liệu. Câu hỏi Q2.
4. **`moi=1`** (vừa tạo lớp) trước kia hạ cánh ở tab Mã mời của `LopChiTiet`. Vá: hạ cánh `…/hoc-vien?muc=ma-moi&moi=1` (bảng 3.1) vì lớp mới chưa có học sinh. Test `ui-lop.ts:79`, `ui-tao-lop-wizard.ts:91` đổi theo.
5. **Đồng giảng** dùng `giao-trinh` (mục 3.2) nên layout lồng không được chặn cứng chủ lớp.
6. **`TutorContentTabs` hiện là một dải toàn cục của nhóm `(noi-dung)`** (`(noi-dung)/layout.tsx:19-24`), đặt TRÊN `<main>`. Đầu lớp phải nằm TRÊN dải. Vá: chuyển dải `quan-lop` vào layout lồng (sau `ClassHead`), layout cha chỉ vẽ dải cho `de-thi` (prop `scope`).
7. `ma` (`[courseId]/page.tsx:27`, `sp.ma`) được khai báo nhưng không thấy `d.codeFailed` được gán ở lệnh gọi `LopChiTiet` (`:96-110`; `codeFailed` chỉ có ở `LopChiTiet.tsx:45`, `:161`). Là mã chết từ trước. tut-dev: GIỮ danh sách trắng `ma` nhưng không bắt buộc hiển thị; ghi vào bàn giao, không sửa lan man.

### 4.3 Bốn trạng thái cho trang `quan-lop/[id]/layout`

| Trạng thái | Chữ |
|---|---|
| Đang tải đầu lớp | "Đang tải lớp…" (bộ khung đầu lớp, `aria-busy`) |
| Không có lớp | "Không tìm thấy lớp" + "Về danh sách lớp" |
| Lớp người khác | "Bạn không có quyền với lớp này" + "Về danh sách lớp" |
| Lỗi tải | "Chưa tải được lớp. Thử lại" |

### 4.4 Đầu lớp (`ClassHead`)

`h1` = tên lớp, `sub` = môn · "n học sinh" (số, không tên) · nhãn trạng thái bằng chữ (`CLASS_STATUS_LABEL`, `tutorTodo.ts:41`; "· đang ẩn" khi `status=false`). "← Lớp học" dẫn `/lop-cua-toi/lop`. Chỉ vẽ một lần. Các trang con dùng `h2` cho tiêu đề phần (hoặc không tiêu đề) để trang có đúng một `h1`.

### 4.5 `LopChiTiet` sau thay đổi (đồng giảng, quản trị xem)

- Giữ nguyên bố cục và dữ liệu. Bỏ nút "Lịch học" lặp tab ở nhánh `mgr`? Nhánh `mgr` bây giờ chỉ còn quản trị xem. Giữ nút, vì quản trị không có dải tab gia sư. KHÔNG đổi.
- Nhánh đồng giảng: giữ "Giáo trình" + "Bản ghi của lớp" (`:129-134`) vì đồng giảng không có dải tab đầy đủ.
- Mục tiêu dedupe ở file này: chỉ bỏ chữ/nút trùng thật sự bằng bằng chứng (ví dụ nút "Mời học sinh" `:125` dành cho màn hẹp vẫn cần). Không đổi tab.

---

## 5. Ngăn "Thêm bài học": thả tệp

### 5.1 Hiện trạng cần tái dùng

- `OTaiLen.tsx:47-60` `sendWithProgress` (XHR, PUT/POST, tiến trình, huỷ); `:62-68` `postJson`.
- `:123-141` `enqueue` (kiểm đuôi / cỡ bằng `routeInput`, ô cam kết); `:143-169` `runOne` (init → gửi → complete); `:171-184` hàng đợi `MAX_PARALLEL = 2`, huỷ, thử lại.
- `/api/media/config` (`route.ts`): khối `document {enabled, driver, maxBytes, exts, reason, quotaBytes, usedBytes}`; yêu cầu quyền `MANAGE_CURRICULUM`; `Cache-Control: no-store`.
- `/api/media/document/init` chỉ chấp nhận chủ lớp (`init/route.ts:29-31`: `course.ownerId !== auth.userId` → 403). Hệ quả: quản trị không phải chủ lớp KHÔNG tải được qua ngăn. Cần prop `canUpload`.
- `claimUploadedDocuments` khi tạo bài (`api/chapters/[id]/lessons/route.ts:80`) và khi sửa bài (`api/lessons/[id]/route.ts:88`) nên liên kết `…/api/media/<id>/file` đưa vào JSON `documents` sẽ được gắn vào bài đúng lúc lưu.
- `MAX_DOCUMENTS_PER_LESSON = 30` (`mediaStorage.ts:110`); đuôi cho phép `DOCUMENT_EXTS` (`:108`): pdf doc docx xls xlsx ppt pptx txt png jpg jpeg webp; 25 MB/tệp.

### 5.2 Hook dùng chung (tut-dev)

`src/components/tutor/upload/useTaiLenTep.ts`:

```ts
useTaiLenTep({ courseId, config /* khối document */, pledge, onUploaded(link, name) })
  → { queue, enqueue(files), cancel(id), retry(id), dismiss(id), busy, clear() }
```

- Cắt từ `OTaiLen`: `enqueue`, `runOne` (init → `sendWithProgress` → complete), bơm hàng đợi, huỷ / thử lại. Phần cam kết bản quyền, định tuyến vào giáo trình (`routeInput`, `onAdd`, `publishNow`, `attach`, hoàn tác) ở lại `OTaiLen` qua callback `onUploaded`.
- `sendWithProgress.ts`, `postJson` chuyển nguyên văn. `OTaiLen` import lại; test `ui-giao-trinh.ts` giữ xanh.
- Chỉ nhận `config.document`. KHÔNG bao giờ đọc `config.video`; KHÔNG có `<input accept>` chứa đuôi video; tệp `.mp4` thả vào → lỗi tại chỗ "Video không tải lên được ở đây. Hãy dán link YouTube" (không có yêu cầu mạng). Chữ khớp `OTaiLen.tsx:5`.

### 5.3 Luồng trong `DocumentsEditor`

1. Mở ngăn → gọi `GET /api/media/config` một lần cho cả ngăn. Trạng thái:
   - Đang kiểm: "Đang kiểm kho tệp…".
   - Lỗi: "Chưa kiểm được kho tệp. Cô vẫn dán link được. Thử lại".
   - Tắt (`document.enabled = false`): vẽ `document.reason` nguyên văn trong khung đứt nét; khung thả KHÔNG nhận tệp; ô dán link giữ nguyên.
   - Không phải chủ lớp (`canUpload = false`): "Chỉ chủ lớp tải tệp lên KiN. Bạn vẫn dán link được."
   - Bật: khung thả + nút "Chọn tệp từ máy".
2. Khung thả: `DropZone` (`DropZone.tsx:10-61`) bọc khối; `disabled` khi không bật. Có thêm `<input type="file" multiple accept={exts}>` ẩn + nút "Chọn tệp từ máy" (không chỉ kéo thả: 390px không kéo được).
3. Cam kết bản quyền: ô tích dùng `COPYRIGHT_PLEDGE_LABEL` + `COPYRIGHT_NOTICE` như `OTaiLen.tsx:279-281`. Chưa tích → "Hãy tích ô cam kết bản quyền trước khi tải tệp lên." (không mạng). `init` nhận `confirmedNotice: true`.
4. Nhiều tệp: tối đa 2 tệp cùng lúc (`MAX_PARALLEL`); mỗi tệp một hàng có tên, thanh %, nút Huỷ; xong thì thành hàng tài liệu thường. Lỗi từng tệp ghi tại hàng (chữ), không chặn tệp khác.
5. Giới hạn: tính `docs.length + queue(chưa xong/đang lên)`; vượt 30 → "Mỗi bài tối đa 30 tài liệu." không mạng.
6. Tệp xong → `onUploaded(link, name)` → ghép `{name, url: link, type: detectType()}` vào `documentsRaw` (JSON) — chính là đường dán link hiện có `save([...docs, …])` (`DocumentsEditor :571-583`). Nghĩa là KHÔNG thêm API và KHÔNG đổi hợp đồng `Lesson.documents`.
7. Bỏ hẳn `pending` / `pendingDocuments` (các dòng ở mục 1.1) và nhánh `throw` ở `resolvePendingDocuments`. `resolvePendingDocuments` thành hàm trả `ls.documentsRaw` (hoặc xoá).

### 5.4 Bài chưa có id (chế độ "Thêm bài")

`init` chỉ cần `courseId`, không cần `lessonId`. Tệp lên trước, liên kết nằm trong JSON `documents`, rồi `POST /api/chapters/<id>/lessons` kèm `documents` (route đã nhận, `lessons/route.ts:50-51`) và `claimUploadedDocuments` gắn vào bài mới (`:80`). Không cần tạo bài nháp trước.

### 5.5 Tệp mồ côi

Tải xong nhưng ngăn đóng không Lưu → `FileAsset` ở trạng thái `ready` không thuộc bài nào. Không thêm API mới. Xử lý:
- Khi đóng ngăn không Lưu, gọi best-effort `DELETE /api/media/document/<id>` cho các tệp vừa tải trong phiên ngăn này (id lấy từ phản hồi `complete`). Lỗi xoá bị bỏ qua (không làm hỏng việc đóng ngăn).
- Phần còn sót vẫn nằm ở "Thư viện của tôi" (BU-02) và có hạn mức (`quotaBytes` trong cấu hình). Ghi rõ trong bàn giao: không có quét dọn nền.
- Test phá: tải xong, đóng ngăn, mở lại bài → không thấy tệp; `FileAsset` bị xoá (hoặc còn trong thư viện, tuỳ lỗi xoá), KHÔNG gắn vào bài.

### 5.6 TRẺ EM (cờ)

Ngăn tạo bài được ĐĂNG NGAY (không qua trạng thái nháp: `Lesson.status` có `draft/published/hidden`, nhưng ngăn không hỏi). Thả tệp làm cho việc đưa một tệp lên cho học sinh dưới 18 nhanh hơn. Mặc định: giữ hành vi đăng như cũ (không đổi trong phiên này), thêm một dòng nhắc cố định trong khung thả: "Tệp sẽ hiện cho học sinh của lớp ngay khi bài được lưu." Xem Q3: có nên ép "nháp" cho bài tạo từ ngăn khi có tệp thả không.

### 5.7 Việc của chủ (đưa vào gói phát hành)

"Đặt 3 biến Cloudinary ở Vercel Production: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`." Không đặt thì `document.enabled=false` ở Production (`mediaStorage.ts:166-171`), ngăn hiện lý do và chỉ cho dán link. Đây KHÔNG chặn phát hành: mã đúng khi tắt.

---

## 6. Thư viện lớp (thay bảng)

### 6.1 Dữ liệu

`GET /api/tutor/lop` giữ nguyên route, hình `{ rows, totalStudents }`. `TutorClassRow` (`tutorClassTable.ts:8-11`) thêm đúng một trường: `cover: string | null` (add-only). Có sẵn: `name, category, classStatus, hidden, students, capacity, schedule, sessionsTaught`. Thẻ KHÔNG dùng: tên học sinh, số điện thoại, bất kỳ tiền.

`cover` = `coverImageOf(bg)`: lấy `url(...)` trong `Course.bg` (schema `:28`, cùng cách `extractBgImage` ở trang quản khoá `:237-240`) và CHỈ nhận `https:`; gradient hoặc chuỗi lạ → `null`. Máy chủ lọc, trình duyệt không nhận `bg` thô.

### 6.2 Thẻ

- Bìa: nếu `cover` → `<img alt="" loading="lazy">` tỉ lệ 16:9 (trang trí, tên lớp nằm ngay dưới). Nếu không → ô chữ cái đầu của tên lớp trên nền `--kin-nhan-nen-nhat`, chữ `--kin-nhan-link`. Ảnh lỗi tải → rơi về ô chữ cái (`onError`).
- Tên lớp (liên kết cả thẻ → `giaoTrinhHref(c.id, true)`), môn, "n học sinh" (+ "/capacity" khi có), lịch cố định ("T6 · 19:00–20:30" hoặc "Chưa xếp lịch"), nhãn trạng thái bằng CHỮ (luôn hiện: "Đang nhận học viên" / "Tạm ngừng" / "Đã đóng", thêm "· đang ẩn").
- Hai hành động ≥ 44px: "Mở lớp" (cả thẻ cũng bấm được) và, khi lớp chưa có học sinh, "Mời học sinh" → `…/hoc-vien?muc=ma-moi`. Giữ nhắc "lớp chưa có học sinh → mời" (`LopHoc.tsx:127-133`, nhóm `noStudents`) ở dưới danh sách, đổi liên kết cho đúng đích mới.
- Giữ ô tìm + lọc môn + lọc trạng thái (`LopHoc.tsx:67-84`, `filterClassRows`). Bỏ callout `:124-126`.
- Giữ `<DongGiangNhom part="courses" />` (`:139`) dưới thư viện.

### 6.3 Cột

| Rộng | Cột |
|---|---|
| 1280 | 3 cột (4 cột từ 1440) |
| 768–1279 | 2 cột |
| 390 | 1 cột (mặc định) |
| 320 | 1 cột |

Quyết định 390: 1 cột, lịch xuống dòng đủ chữ, không cắt. Phương án 2 cột ở 390 chỉ khi mọi lịch hiện ≤ 16 ký tự; bị cắt chữ là mất thông tin nên KHÔNG chọn mặc định. Q4.

### 6.4 Bốn trạng thái

| Trạng thái | Chữ / hành vi |
|---|---|
| Đang tải | khung xương thẻ (`aria-label="Đang tải danh sách lớp"`) |
| Lỗi | `ErrorStrip` "Không tải được danh sách lớp." + "Thử lại" (đã có `:60`) |
| Rỗng | "Cô chưa mở lớp nào" + "Tạo lớp đầu tiên" (đã có `:62`) |
| Không khớp lọc | "Không có lớp nào khớp" + "Xoá bộ lọc" (đã có `:90`) |
| Đủ | `Hiển thị n/m lớp` (giữ `:135`) |

---

## 7. "Kế hoạch buổi" không phải chốt buổi / sinh phí

### 7.1 Bằng chứng

- Bảng `SessionPlan` (`prisma/schema.prisma:2278-2295`): `courseId, tutorId, dateKey, title, goal, activities Json`. Chú thích `:2274-2277`: "Kế hoạch buổi 4 hoạt động (PH-223) … bản gia sư và phiếu học sinh". Không có khoá sang `AttendanceSession`, hoá đơn, tiền.
- Mã: `src/lib/sessionPlan.ts`, `src/lib/planServer.ts`, `src/lib/planLimits.ts`, `src/app/api/tutor/session-plans/**`, `ke-hoach-buoi/**`. `grep -rln "feeCharge|invoiceServer|sessionBook|AttendanceSession|closeSession" ke-hoach-buoi session-plans` → rỗng.
- Chốt buổi thật ở `BuoiChiTiet.tsx:245-262` ("Chốt buổi đã dạy", callout "Chốt buổi và học phí" `:262`), trang `/lop-cua-toi/buoi/…`. Học phí ở mục Học phí / `LopHocPhi`.
- Hệ quả: nhóm "Dạy học" trong bảng Khác gợi ý sai việc. Bỏ mục.

### 7.2 Mọi chỗ còn trỏ `/lop-cua-toi/ke-hoach-buoi` (sau khi bỏ khỏi `MORE_BASE`)

| Chỗ | Dòng | Giữ? |
|---|---|---|
| Lịch dạy, liên kết theo buổi | `(tutor)/lich/LichClient.tsx:671` | giữ (lối vào chính) |
| Chi tiết buổi, "Soạn kế hoạch buổi" | `BuoiChiTiet.tsx:279` | giữ |
| Danh sách / soạn kế hoạch | `ke-hoach-buoi/page.tsx:9`, `[id]/page.tsx:10`, `KeHoachListClient.tsx:55,111`, `KeHoachEditorClient.tsx:79,85` | giữ nguyên route |
| Chuỗi ID module | `src/lib/courseIds.ts:5` (`"ke-hoach-buoi"`) | giữ |
| `TutorShell.tsx:32` | — | XOÁ mục này; sửa chú thích `:4` (đang liệt kê "Kế hoạch buổi" trong các trang không có trên thanh) |
| Test | `ui-plan.ts:129-133`, `ui-sidebar-rong.ts:40`, `ui-tutor-shell.ts:99`, `ui-tutor-everything.ts:277`, `ui-role-everything.ts:134,404`, `t-kin-components.ts:39`, `tutor-world.ts:93` | xem mục 9 |

Sau khi bỏ, cô vào Kế hoạch buổi từ Lịch (`LichClient:671`) và từ chi tiết buổi (`BuoiChiTiet:279`). Không thêm lối mới ở shell (Q6).

---

## 8. Schema + cờ

### 8.1 Schema

KHÔNG đổi schema. Không migration. Mọi dữ liệu dùng bảng/cột sẵn có. `Enrollment.status` giữ `pending_consent | active | suspended`. Không thu thêm dữ liệu trẻ em. Trường `cover` là trường thêm vào kiểu `TutorClassRow` (TypeScript), không phải cột DB.

### 8.2 Cờ

- **TIỀN — có (chỉ DI CHUYỂN).** `LopHocPhi` / `LopPhiKhac` đổi chỗ từ tab "Học phí" của `LopChiTiet` sang tab Cài đặt → `muc=hoc-phi` (`:283-288`). Không sửa `feeCharge*`, `invoiceServer*`, `sessionBook*`, `api/fees*`, `api/invoices*`, không đổi cách tính phí / hoá đơn / doanh thu. Không số tiền mới trong thẻ thư viện. Không số tiền trong thông báo (không đổi). Test: mọi test `ui-hocphi-*`, `ui-session-package`, `t-hocphi-*` giữ xanh qua 307 (mục 9).
- **TRẺ EM — có.** (1) Ngăn thả tệp làm việc đăng tệp tới học sinh nhanh hơn (mục 5.6). (2) Danh bạ lớp có email/số điện thoại học sinh (`hoc-vien/page.tsx:20-21`): tách ra `DanhBaLop` KHÔNG mở rộng trường nào, không thêm cột. (3) Thư viện lớp không tên / không liên lạc học sinh. (4) API tổng hợp (`/api/tutor/lop`) không trả tên học sinh (đang đúng).
- **ĐỔI NỀN — không.** Không đổi nền tảng, không đổi hạ tầng, không thêm thư viện. Cloudinary là cấu hình sẵn (mục 5.7), không phải nền mới.

---

## 9. Test cần có

Quy ước repo: `tsx` thuần trong `tools/local-e2e`, hàm `check()`, `h.ts` `api()` dùng `redirect:"manual"` (nên đã thấy 307, không tự theo). Máy thử: server worktree cổng 3141, DB `kin_wt_gslop`.

### 9.1 Test MỚI

`t-class-routes-lib.ts` (hàm thuần, không mạng):
- `legacyClassTarget` đúng từng hàng bảng 3.1; `moi`, `lich`, `them`, `duyet`, `n`, `ma` được giữ; tham số lạ bị bỏ; `courseId` có `/`, `?`, `#`, `%` được mã hoá (không chuyển hướng ra ngoài).
- `coverImageOf`: `url("https://x/y.jpg")` ✓; `linear-gradient(...)`, `url(javascript:…)`, `url(data:…)`, `url(http://…)`, chuỗi rỗng → `null`.
- `contentTabsFor`: 6 tab đúng thứ tự; mỗi đường chỉ MỘT tab sáng; vai đồng giảng → 2 tab; `giao-trinh-khac` không sáng.

`t-lop-gon.ts` (API + redirect, hai gia sư):
- Chủ lớp `GET /lop-cua-toi/<id>` → 307, `Location` đúng, `Cache-Control` chứa `no-store`, KHÔNG 308 (cho mọi hàng bảng 3.1). Xác nhận `redirect()` của Next trong trang `force-dynamic` thật sự phát `no-store`; nếu không → xin COO (mục 12).
- `quan-lop/<id>` (không tab) → 307 `giao-trinh`; `?tab=lich-hoc|hoc-vien|diem-danh|giao-trinh` → 307 đúng; `?tab=cai-dat|chuong-bai` → 200.
- **Ca phá — lớp người khác:** gia sư B mở `quan-lop/<lớp của A>`, `…/giao-trinh`, `…/hoc-vien`, `…/diem-danh`, `?tab=cai-dat`, `?tab=chuong-bai` → 403; thân phản hồi KHÔNG chứa tên lớp / môn của A.
- **Ca phá — không có lớp:** id `khong-co`, id chứa `%00`, id dài 300 ký tự → 404, không 500.
- **Ca phá — gia sư chờ duyệt:** mọi đường `quan-lop/**` và `/lop-cua-toi/<id>` → chuyển về `/lop-cua-toi/cho-duyet` (không lộ dữ liệu lớp). Khách → đăng nhập. Học sinh → `/lop-cua-toi`.
- **Ca phá — đồng giảng:** `hoc-vien`, `diem-danh`, `?tab=cai-dat` → 307 `/lop-cua-toi/<id>`; `giao-trinh` → 200; `/lop-cua-toi/<id>` KHÔNG chuyển hướng (vẫn `LopChiTiet`).
- **Ca phá — quản trị xem:** `/lop-cua-toi/<id>` KHÔNG bị chuyển sang `quan-lop`.
- **Ca phá — mở chuyển hướng:** `?tab=//evil.example`, `?duyet=http://x` → đích luôn nằm trong `/lop-cua-toi/quan-lop/…`.
- Hai gia sư: B gọi `POST /api/media/document/init` với `courseId` của A → 403 (đã có ở `init/route.ts:31`; test phá bổ sung nếu chưa).
- `GET /api/tutor/lop` của A không trả lớp của B; `cover` luôn `null` hoặc chuỗi https; thân không chứa tên học sinh.

`ui-gs-lop-gon.ts` (Playwright, 1280 và 390):
- Danh sách lớp: thẻ thay bảng (không `[role=table]`); có chữ trạng thái; lọc tìm / môn / trạng thái; "Không có lớp nào khớp"; rỗng; lỗi (chặn `/api/tutor/lop` → 500) có "Thử lại"; không callout "Điểm danh và học phí đi cùng nhau"; nút ≥ 44px; không tràn ngang ở 390 và 1280; cột đúng theo rộng.
- Mở lớp → rơi vào Giáo trình; đúng 1 `h1` = tên lớp; đúng 1 `nav[aria-label^="Trang của"]`; thứ tự "Giáo trình · Học sinh · Điểm danh · Bài tập · Lịch học · Cài đặt"; không có chữ "Bảng điều khiển /"; không dải tab thứ hai; quét `h1` / dải trên cả 6 tab.
- Học sinh: danh bạ; duyệt xin vào lớp tại `muc=xin-vao` (303 → 307 giữ `duyet`, `n`); mã mời tại `muc=ma-moi`; liên kết tới `/lop-cua-toi/hoc-sinh/em/<id>`.
- Cài đặt: `muc=hoc-phi` hiện `LopHocPhi`; `dong-giang`; `cong-dong`; `ban-ghi`.
- Mọi khối cũ có lối vào: duyệt `JoinRequests`, `ClassInvites`, `GiaoVienLop`, `LopHocPhi`, cộng đồng, bản ghi, lịch sử buổi.
- Ngăn kéo thả (mục 5): hai tệp cùng lúc (tiến trình hiện, xong thành hàng tài liệu), lưu bài rồi mở lại còn tệp; thả `.mp4` → lỗi tại chỗ, KHÔNG có yêu cầu `/api/media/document/init`; chưa tích cam kết → không mạng; 31 tệp → "Mỗi bài tối đa 30 tài liệu."; `route()` ép `/api/media/config` trả `document.enabled=false` + `reason` → hiện `reason`, khung thả khoá, dán link còn chạy; ép lỗi `init` 403 → hiện chữ lỗi tại hàng; `canUpload=false` (quản trị không phải chủ) → chữ "Chỉ chủ lớp…"; thêm bài (chưa có id) + thả tệp + Lưu → bài mới có tệp; đóng ngăn không Lưu → có yêu cầu `DELETE`.
- 320px: không tràn ngang ở thư viện, ngăn, Học sinh, Cài đặt.

### 9.2 Test CŨ sẽ gãy — phải sửa

Tìm bằng `grep -nE "tab=(ma-moi|hoc-sinh|hoc-phi|giao-vien|cong-dong|diem-danh)|Buổi học & điểm danh|\"Mã mời\"|Cộng đồng lớp|Mời học sinh|Mở lớp|Bài tập tự nộp|Danh bạ lớp|Kế hoạch buổi|ke-hoach-buoi|data-tai-lieu-dong"` trong `tools/local-e2e`. Danh sách đã lần theo mã:

| Tệp | Dòng | Vì sao gãy | Sửa |
|---|---|---|---|
| `t-tutor-routes-lib.ts` | `:83-105` | thứ tự, nhãn, "Cài đặt" mặc định, "Bài tập tự nộp", "Danh bạ lớp" | viết lại theo 3.3 |
| `ui-tutor-admin.ts` | `:127-128`, `:139`, `:144` | `waitForURL(...?tab=lich-hoc)` thành `/lich-hoc`; dải đổi nhãn / thứ tự; "Danh bạ lớp" → "Học sinh" | cập nhật; thêm ca chuỗi hai bước |
| `ui-lop.ts` | `:25`, `:37-52`, `:79`, `waitForURL(…/${id}$)` | tab của `LopChiTiet` (Buổi học & điểm danh / Học sinh · 1 / Mã mời), nút "Mời học sinh" 320px, `h1` "Toán 9" | chuyển sang kiểm trang `quan-lop`; một số ca chuyển qua `ui-gs-lop-gon.ts` |
| `ui-lop-mien-phi.ts` | `:43`, `:74`, `:87`, `:98` | `getByRole("tab",{name:"Mã mời"})` không còn là tab; `?tab=ma-moi` → 307 | đổi sang `muc=ma-moi` |
| `ui-bulk-invite.ts` | `:32`, `:94`, `:105` | nhấn tab "Mã mời" | đổi sang mục con |
| `ui-tao-lop-wizard.ts` | `:91`, `:152` | "tab Mã mời mở sẵn", `?tab=hoc-sinh` | hạ cánh `…/hoc-vien?muc=ma-moi` |
| `ui-tao-lop-per-session.ts`, `ui-journey-new-tutor.ts` | `:277`, `:320` | tab "Mã mời", chữ "Mời học sinh →" / "Mở lớp →" | đổi theo thẻ |
| `ui-join-request.ts` | `:91-96`, `:117-122`, `:184`, `:227-228` | URL cuối thành `quan-lop/<id>/hoc-vien?…`; `tp.url().includes("tab=hoc-sinh")` | cập nhật; `redirect:"manual"` đã thấy 307 |
| `t-join-request.ts` | `:70`, `:124`, `:329`, `:336`, `:347` | `GET /lop-cua-toi/<id>?tab=hoc-sinh…` từng 200, nay 307 | assert 307 + `Location`; link thông báo và 303 giữ đích cũ (không đổi) |
| `ui-hocphi-fee.ts`, `ui-hocphi-extra.ts`, `ui-session-package.ts` | `:44,:77`, `:27`, `:37,:42,:87` | `?tab=hoc-phi` → 307 → `muc=hoc-phi` | `goto` thẳng đích mới; thêm ca 307 |
| `ui-course-teachers.ts` | `:50-54`, `:152-153`, `:185-257` | tab "Giáo viên" / "Mã mời" / "Học phí" của chủ; vẫn đúng cho đồng giảng (giữ `LopChiTiet`) | chủ lớp: chuyển sang `muc=dong-giang`; đồng giảng: giữ |
| `ui-tutor-dash.ts` | `:204` | tab "Cộng đồng lớp" | chuyển `muc=cong-dong` |
| `ui-giao-trinh.ts`, `ui-course-teachers-2.ts` | `:71` | tab Giáo trình nay có `h1` nhúng, đầu lớp mới | cập nhật nơi đo `h1` |
| `ui-admin-tai-lieu.ts` | `:42-63` | `[data-tai-lieu-dong]` ("sắp có") biến mất; test khẳng định KHÔNG `input[type=file]` nhận tài liệu | đổi: có khung thả khi bật; không `input[file]` nhận video; khi `reason` hiện chữ lý do |
| `ui-plan.ts` | `:129-133` | khẳng định "Kế hoạch buổi" ở `#khac-bang` | đổi: KHÔNG có ở bảng Khác; có ở Lịch và chi tiết buổi |
| `ui-sidebar-rong.ts` | `:40` | `gt[1].items = "Tổng quan\|Kế hoạch buổi\|Báo cáo tháng\|…"` | bỏ "Kế hoạch buổi" |
| `ui-tutor-shell.ts` | `:99` | map `want` có "Kế hoạch buổi" | bỏ; đếm số mục bảng Khác nếu có |
| `ui-tutor-everything.ts` | `:277` | danh sách trang duyệt có `/lop-cua-toi/ke-hoach-buoi` | giữ trang (route còn), bỏ khỏi danh sách lối vào shell nếu kiểm lối vào |
| `ui-role-everything.ts` | `:134`, `:404` | `TUTOR_PAGES`, `TUTOR_ONLY` | route còn: giữ; thêm `quan-lop` |
| `ui-links-everywhere.ts` | quét liên kết | liên kết mới qua `contentHref` / `giaoTrinhHref` | chạy lại, cập nhật nếu cần |
| `t-links.ts`, `t-no-hex.ts` | allow-list | `TabCaiDat` chuyển tệp | xem 2.4 |
| `measure-canhchu.ts`, `shoot-lop.ts`, `ui-schedule-drag.ts` | `:14`... | `goto /lop-cua-toi/<id>?tab=…` | chạy lại, cập nhật |

Cổng chạy lại sau sửa: `npx tsc --noEmit`, `t-no-hex`, `t-links`, `t-tutor-routes-lib`, `t-class-routes-lib`, `t-lop-gon`, `ui-gs-lop-gon`, `ui-giao-trinh`, `ui-admin-tai-lieu`, `ui-tutor-admin`, `ui-tutor-shell`, `ui-sidebar-rong`, `ui-plan`, `ui-join-request`, `ui-course-teachers`, `ui-lop`, `ui-hocphi-fee`, `ui-hocphi-extra`, `ui-session-package`. Chạy bằng `tsx` trên cổng 3141, không gọi `npm test`.

---

## 10. Khung Figma (mô tả; tác nhân khác vẽ)

Khung hiện có: Bản final 578:2 (thanh bên gia sư 578:11), Bigupdate 606:5 (Giáo trình), 606:6. Khung mới đặt trong trang Bigupdate, tên "GS-LOP-GON · …".

1. **Lớp học 1280** — dải trên + thanh bên gia sư; đầu "Lớp học" + "Tạo lớp"; hàng tìm + hai ô lọc; lưới 3 cột thẻ 16:9 bìa (một thẻ ảnh, hai thẻ chữ cái trên nền nhạt); dưới mỗi bìa tên, "Toán · 12 học sinh", "T6 · 19:00–20:30", nhãn "Đang nhận học viên"; hai nút ≥ 44px. Bên dưới: nhắc "… chưa có học sinh → Mời học sinh".
2. **Lớp học 390** — 1 cột, thẻ xếp dọc, nhãn trạng thái chữ, tab thanh dưới; lịch xuống dòng không cắt. Thêm biến thể rỗng ("Cô chưa mở lớp nào"), lỗi ("Không tải được… Thử lại"), không khớp lọc.
3. **Trang lớp 1280, tab Giáo trình** — đầu lớp MỘT lần (← Lớp học · Toán 9 · Toán · 12 học sinh · Đang nhận học viên) → MỘT dải tab 6 mục, "Giáo trình" sáng → nội dung giáo trình. Không breadcrumb, không dải thứ hai.
4. **Trang lớp 390** — cùng cấu trúc; dải tab cuộn ngang, tab sáng được cuộn vào khung nhìn; nút ≥ 44px.
5. **Ngăn "Thêm bài học" có khung thả** — ba trạng thái: (a) rỗng: khung đứt nét "Kéo tệp vào đây hoặc Chọn tệp từ máy", ô cam kết, dòng giới hạn "tối đa 30 tài liệu · 25 MB / tệp", dưới là ô dán link; (b) đang tải: hai hàng tệp có thanh %, nút Huỷ, một hàng xong; (c) kho tắt: khung đứt nét xám + chữ lý do "Tải tệp tài liệu lên chưa bật…" + ô dán link còn hoạt động; thêm biến thể lỗi từng tệp và biến thể "Chỉ chủ lớp tải tệp lên KiN". Ở 390 ngăn full-width, nút ≥ 44px.
6. **Tab Học sinh 1280 / 390** — dải mục con "Danh bạ · Xin vào lớp (2) · Mã mời · Thêm học sinh"; danh bạ dạng thẻ ở 390; trạng thái tải / lỗi / rỗng ("Lớp chưa có học sinh" + "Mời học sinh").
7. **Tab Cài đặt 1280 / 390** — dải mục con "Thông tin · Học phí · Đồng giảng · Cộng đồng · Bản ghi".

Khung phải khớp mã: token `--kin-*`, không màu thô.

---

## 11. Chia việc (tut-code ∥ tut-dev, tệp không trùng)

Hai bên làm song song được vì hợp đồng đã chốt ở mục 3 và 6.1: tut-dev dùng `legacyClassTarget`/`MUC_*`/`TutorClassRow.cover` bằng chữ ký đã nêu; tut-code không mở tệp `.tsx` của tut-dev.

| tut-code | tut-dev |
|---|---|
| `src/lib/tutorClassRoutes.ts` (mới) | `src/components/tutor/ClassHead.tsx`, `HocSinhTab.tsx`, `CaiDatTab.tsx`, `DanhBaLop.tsx`, `ThuVienLop.tsx` (mới) |
| `src/lib/tutorClassPageServer.ts` (mới) | `src/components/tutor/quan-lop/*` (cắt từ trang quản khoá) |
| `src/lib/tutorRoutes.ts` (`contentTabsFor`) | `src/components/tutor/upload/*` + `OTaiLen.tsx` |
| `src/lib/tutorClassTable.ts`, `tutorClassTableServer.ts` | `LopHoc.tsx`, `LopChiTiet.tsx`, `TutorContentTabs.tsx`, `TutorShell.tsx` |
| `quan-lop/[id]/{layout,page,hoc-vien/page,diem-danh/page}.tsx` | `giao-trinh/GiaoTrinh.tsx`, `DiemDanh.tsx`, `LichKhung.tsx` (prop `embedded`) |
| `src/app/lop-cua-toi/[courseId]/page.tsx` | `(noi-dung)/layout.tsx` (chỉ `scope="de-thi"`) |
| `t-class-routes-lib.ts`, `t-lop-gon.ts`, `t-tutor-routes-lib.ts`, `t-join-request.ts`, `t-fee-rule-audit-lib.ts`, `t-hocphi-*` | `ui-gs-lop-gon.ts` + mọi `ui-*.ts` ở bảng 9.2 |
| | `admin/khoa-hoc/[id]/{page,hoc-vien/page}.tsx` (chỉ cắt + import lại, báo Quản trị) |

Ghi chú tiếp giáp: `quan-lop/[id]/layout.tsx` (tut-code) nhập `ClassHead` và `TutorContentTabs` (tut-dev) theo chữ ký: `ClassHead({ name, category, status, hidden, studentCount })`, `TutorContentTabs({ scope, role })`. Nếu tut-dev chưa xong, tut-code gọi stub cùng chữ ký ở nhánh của mình (không sửa tệp của tut-dev).

Thứ tự gợi ý: (1) `tutorClassRoutes.ts` + `t-class-routes-lib.ts` (tut-code), `upload/` hook (tut-dev) song song → (2) layout lồng + 307 + `HocSinhTab`/`CaiDatTab` → (3) thư viện lớp + ngăn kéo thả → (4) sửa test cũ + `ui-gs-lop-gon.ts` → (5) bỏ "Kế hoạch buổi" khỏi shell.

---

## 12. Xin COO (tệp chung)

1. `src/components/tutor/TutorShell.tsx` — COO đã cho: bỏ "Kế hoạch buổi" (`:32`) + dedupe. Cam kết chỉ thế.
2. `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx` + `hoc-vien/page.tsx` (Quản trị) — COO đã đồng ý tách. Xin thêm: báo Quản trị rằng trang quản trị chỉ đổi vị trí mã, hành vi + URL + dải tab trong giữ nguyên; và đồng ý đổi hex trong `TabCaiDat` sang token (hoặc cập nhật allow-list `t-no-hex`).
3. `next.config.ts` — CHỈ NẾU cần: nếu `redirect()` trong trang `force-dynamic` không phát `Cache-Control: no-store` trên cổng 3141, xin một quy tắc `headers()` cho `/lop-cua-toi/:courseId` và `/lop-cua-toi/quan-lop/:id` (hiện chỉ `/sw.js` có `headers()`, `next.config.ts:25-37`). Phương án khác không cần tệp chung: chuyển nhánh chuyển hướng sang route handler tự đặt header. Mặc định: tut-code đo trước; chỉ xin khi đo ra thiếu.
4. KHÔNG đụng: `hostRouting.ts`, `notify.ts`, `schema.prisma`, `proxy.ts`. Không cần.
5. Không cần tệp chung mới nào khác.

Việc của chủ (đưa vào gói phát hành): đặt `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` ở Vercel Production (mục 5.7).

---

## 13. Câu hỏi cho chủ (mỗi câu có mặc định)

- **Q1.** Học sinh / mã mời / duyệt xin vào lớp và học phí / đồng giảng / cộng đồng / bản ghi dùng mục con bằng `?muc=` — đúng ý "tab con trong Học sinh và Cài đặt"? Mặc định: đúng; không thêm tab thứ 7.
- **Q2.** Nhãn tab 4: "Bài tập" (theo brief) hay giữ "Bài tập tự nộp" (A8, để phân biệt với bài tập của BU-03 sau này)? Mặc định: "Bài tập", kèm dòng giải thích đầu tab; đổi lại khi BU-03 đổi.
- **Q3.** Bài tạo từ ngăn "Thêm bài học" có nên ra dạng nháp khi có tệp thả (để cô xem lại rồi mới cho học sinh thấy)? Mặc định: KHÔNG, giữ hành vi cũ (đăng ngay) + dòng nhắc cố định. Đây là cờ TRẺ EM, chủ nên biết.
- **Q4.** Thư viện lớp ở 390px: 1 cột (lịch đủ chữ) hay 2 cột (lịch bị cắt)? Mặc định: 1 cột.
- **Q5.** Đồng giảng có cần tab "Lịch học" không? Mặc định: có (API tự chặn theo vai); tut-code xác nhận ở mã, nếu API chặn thì bỏ.
- **Q6.** Sau khi bỏ khỏi thanh bên, "Kế hoạch buổi" chỉ vào được từ Lịch và chi tiết buổi. Có cần thêm lối thứ ba (ví dụ nút ở tab Giáo trình) không? Mặc định: không.
- **Q7.** Tệp tải lên rồi đóng ngăn không lưu: có cần quét dọn nền tệp mồ côi ngay không? Mặc định: không (xoá best-effort lúc đóng + "Thư viện của tôi" + hạn mức); xử lý nền để sau.
