# KIỂM KÊ TOÀN BỘ TRANG, MODULE & COMPONENT — PHỤC VỤ REDESIGN UI/UX

> **Mục đích:** Liệt kê đầy đủ, dựa trên đọc trực tiếp source code (không đoán theo tên file), toàn bộ trang + chức năng + component đang tồn tại trong hệ thống, làm nguồn tham chiếu để thiết kế lại UI/UX trên Figma (xem `files/07_ke_hoach_chuyen_doi_gia_su.md` mục 7).
> **Phạm vi:** 59 trang thật (đã loại các route chỉ redirect) + 35 component dùng chung + 3 layout chính (Guest/Student/Admin).
> **Cách đọc:** Mỗi trang có 4 mục — Mục đích, Chức năng chính (chi tiết từng tương tác/trạng thái), Component/thư viện dùng, Dữ liệu/API. Dùng cột "Chức năng chính" làm checklist khi vẽ wireframe — đừng bỏ sót trạng thái loading/error/empty, đây là nơi UI cũ hay thiếu nhất quán.

---

## 1. Sơ đồ trang tổng quan

| Khu vực | Số trang thật | Số route chỉ redirect (bỏ qua khi làm Figma) |
|---|---|---|
| Guest / Công khai (`(guest)` + `/`) | 22 | 3 (`/gio-hang`, `/gioi-thieu`, `/vinh-danh`) |
| Học viên (`(student)/student`) | 6 | 7 (đều redirect sang trang public tương ứng) |
| Admin (`(admin)/admin`) | 20 | 1 (`/admin/thi-thu/tao-moi`) + 1 file không phải route thật (`_template`, chỉ để copy khi tạo trang mới) |
| **Tổng** | **~59** | **11** |

---

## 2. Nhận định quan trọng về design system hiện tại — đọc trước khi vẽ Figma

Đây là phát hiện quan trọng nhất từ đợt kiểm kê, ảnh hưởng trực tiếp tới cách tổ chức design system mới:

1. **2 phong cách UI đang lẫn lộn trong cùng khu vực Admin:**
   - **"Neumorphism xanh"** — nền `#F0F5FF`, box-shadow lồi/lõm kiểu `8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff`. Dùng ở: Dashboard, Hồ sơ học sinh, Doanh thu, Vinh danh, Sales Leads, Cộng đồng, Quản trị viên.
   - **"Card trắng viền xám phẳng"** — nền trắng, viền `#e5e3df`/`border-gray-200`. Dùng ở: Khóa học (CMS), Thi thử, Tin tức, Danh mục khóa học — đây là các trang theo đúng file mẫu `_template` (chuẩn hoá sau, nên nhất quán hơn).
   - → Khi redesign, **chọn 1 trong 2 làm chuẩn** (khuyến nghị theo `_template` vì đã là bản chuẩn hoá gần nhất), không giữ cả hai.
2. **Toàn bộ style hiện tại dùng inline `style={{}}`**, không dùng token màu/spacing tập trung (không phải Tailwind theme, không phải CSS variables). Màu lặp lại nhiều nơi: xanh brand `#0068FF`, nền trắng `#ffffff`, viền `#e5e3df`, chữ phụ `#787671`/`#a4a097`. **Không có dark mode.**
3. **Không có design token / component library chính thức** — mỗi trang tự viết lại Table/Modal/Drawer/Toast/EmptyState/ErrorState theo pattern giống nhau nhưng code riêng lẻ. Đây là cơ hội lớn nhất khi redesign: chuẩn hoá thành 1 bộ component (Table, Drawer, Modal, Toast, EmptyState, ErrorState, Skeleton) dùng chung thật sự thay vì copy-paste.
4. **Nhiều nơi dữ liệu hard-code trong file** thay vì API: `/diem-chuan` (bảng điểm chuẩn), `/mentor/[id]` (hồ sơ 3 mentor), số liệu thống kê ở trang chủ (`/`). Cần hỏi lại bạn: giữ tĩnh hay chuyển sang API/CMS khi redesign — ảnh hưởng tới việc có cần màn hình quản trị cho các nội dung này không.
5. **File `_template/page.tsx`** (`admin/_template`) là khuôn mẫu chuẩn nội bộ hiện có cho trang CRUD admin (Toast, ActionMenu, Drawer trượt phải, bảng search/filter, Skeleton, empty state) — nên xem trước khi vẽ Figma cho các trang admin mới, để không "phát minh lại" pattern.

---

## 3. Khu vực Guest / Công khai (22 trang)

### /
- **File**: `src/app/page.tsx` (665 dòng — KHÔNG nằm trong layout `(guest)`, tự import Navbar/Footer riêng)
- **Mục đích**: Trang chủ marketing — giới thiệu nền tảng, đếm ngược kỳ thi, khóa học nổi bật, lý do chọn nền tảng, timeline, CTA đăng ký.
- **Chức năng chính**:
  - Hero navy band: tiêu đề, mô tả, 2 CTA ("Xem khóa học", "Thi thử miễn phí")
  - 5 ô danh mục kỳ thi (ĐGNL HSA, ĐGNL HCM, Tốt nghiệp THPT, TSA Bách Khoa, BCA) → `/khoa-hoc`
  - Panel thống kê (1,200+ học viên, 10,000+ đề, 6 gia sư — **hard-code**) + đồng hồ đếm ngược real-time tới kỳ thi tiếp theo (tránh hydration mismatch bằng khởi tạo `ms=null`)
  - "Khóa học nổi bật": sidebar danh mục (desktop, đếm số lượng) + pill danh mục (mobile) + tìm kiếm + grid card (nút "Thêm vào giỏ"/"Đã thêm", nút "Xem khoá học"); loading skeleton, trạng thái rỗng khi tìm không ra
  - "Vừa mở đăng ký": 4 khóa học mới nhất theo ngày khai giảng
  - "Học ở đây thì được gì": 6 card lợi ích
  - Timeline dọc lịch sử phát triển (6 mốc — tĩnh)
  - CTA cuối trang
- **Component/thư viện dùng**: `Navbar`, `Footer`, `SalesBotWidget`, `TeacherTag`, `griddy-icons`; hooks `useCourses`, `useCart`, `useAuth`
- **Dữ liệu/API**: hook `useCourses`; dữ liệu tĩnh `@/lib/courseData`; số liệu STATS hard-code, không gọi API

### /bang-xep-hang
- **File**: `src/app/(guest)/bang-xep-hang/page.tsx`
- **Mục đích**: Bảng xếp hạng thi thử toàn server + bảng vinh danh học sinh xuất sắc.
- **Chức năng chính**:
  - Tab "Thi thử": lọc theo danh mục, bục top 3 (podium huy chương), bảng đầy đủ (#, tên, trường, điểm cao nhất), highlight dòng "Bạn", loading/error(kèm nút thử lại)/empty riêng, CTA đăng ký cho khách
  - Tab "Vinh danh": sắp xếp theo GPA/Điểm thi/Tiến độ, bục top 3, bảng đầy đủ (GPA-bar, điểm thi, tiến độ %, điểm bài tập — ẩn dần theo breakpoint), badge tự tính theo `BADGE_RULES`
- **Component/thư viện dùng**: `GpaBar`; `griddy-icons` (Trophy, Crown); `useAuth`; `@/lib/honorData`, `@/lib/courseData`
- **Dữ liệu/API**: `GET /api/leaderboard?category=`, `GET /api/honor-leaderboard`

### /chinh-sach
- **File**: `src/app/(guest)/chinh-sach/page.tsx`
- **Mục đích**: Trang tĩnh Chính sách bảo mật / Điều khoản sử dụng / Cookie.
- **Chức năng chính**: Tab nav 3 tab chuyển nội dung client-side; nội dung text tĩnh nhiều section; box liên hệ email cuối trang.
- **Component/thư viện dùng**: `griddy-icons` (Shield, Lock, FileText, InfoCircle)
- **Dữ liệu/API**: Không có — toàn bộ hard-code

### /cong-dong
- **File**: `src/app/(guest)/cong-dong/page.tsx`
- **Mục đích**: Diễn đàn cộng đồng — đăng bài, đặt câu hỏi trả phí bằng xu, tương tác.
- **Chức năng chính**:
  - 5 tab feed (Tất cả/Hỏi đáp/Chia sẻ/Tài liệu/Góc vui), đồng bộ `?tab=`
  - Form đăng bài mở rộng: loại "Đăng bài"/"Hỏi đáp" (trừ xu), textarea 2000 ký tự, tiêu đề nếu là câu hỏi, 4 category, upload ≤4 ảnh + 1 file qua Cloudinary (kéo-thả `DropZone`), cache URL đã upload để tránh upload lại khi retry
  - CTA đăng nhập cho khách thay form
  - ThreadCard: avatar, badge "Gia sư", media grid ảnh, file đính kèm, Like, số reply, Bookmark, Copy link, xoá (chủ bài/admin có quyền, confirm 2 bước), báo cáo (modal lý do)
  - QuestionCard: trạng thái Đã giải/Đang mở, số xu treo thưởng, số câu trả lời
  - Polling tự refresh 30s + khi tab focus lại; nút "Tải thêm" (cursor pagination)
  - Modal chi tiết: `ThreadModal`, `QuestionModal`
- **Component/thư viện dùng**: `ThreadModal`, `QuestionModal`, `DropZone`; hooks `useAuth`, `useWallet`; `@/lib/cloudinary`; `@/lib/permissions`
- **Dữ liệu/API**: `GET/POST /api/community/threads`, `POST .../like`, `.../bookmark`, `DELETE .../:id`, `POST .../report`, `GET/POST /api/questions`

### /cong-dong/[id]
- **File**: `src/app/(guest)/cong-dong/[id]/page.tsx`
- **Mục đích**: Chi tiết 1 bài viết cộng đồng — nội dung đầy đủ, ảnh, trả lời.
- **Chức năng chính**: Card bài viết (badge ghim, tác giả+badge Gia sư, lightbox ảnh full-screen, file tải về); thanh hành động (Like, reply count, Bookmark, Copy link, báo cáo — ẩn nếu là chủ bài); panel báo cáo mở rộng; danh sách reply (like riêng, xoá nếu là chủ/có quyền); form trả lời (chỉ khi đăng nhập, upload ảnh) hoặc CTA đăng nhập; loading skeleton thanh ngang, lỗi (thử lại), không tìm thấy.
- **Component/thư viện dùng**: `@/components/community/ThreadDetailShared` (CAT_MAP, timeAgo, Avatar, MediaGrid, Lightbox, ReplyCard, ReplyForm, ReportPanel, hook `useThreadDetail`); `useAuth`
- **Dữ liệu/API**: qua hook `useThreadDetail` (nhóm endpoint `/api/community/threads/:id/*`)

### /cong-dong/hoi-dap/[id]
- **File**: `src/app/(guest)/cong-dong/hoi-dap/[id]/page.tsx`
- **Mục đích**: Chi tiết 1 câu hỏi Hỏi đáp trả phí xu — câu trả lời, gửi trả lời, chấp nhận trả lời.
- **Chức năng chính**: Card câu hỏi (trạng thái, xu treo thưởng, tác giả, nội dung); danh sách trả lời (badge "Được chấp nhận" kèm `ANSWER_REWARD`, badge "Vi phạm" làm mờ, nút "Chấp nhận" chỉ cho chủ câu hỏi khi còn mở, nút báo cáo); form gửi trả lời; toast 3s; loading, không tìm thấy.
- **Component/thư viện dùng**: `@/lib/wallet-constants`; `ReportModal` tự viết riêng trong file
- **Dữ liệu/API**: `GET /api/questions/:id`, `POST .../answers`, `POST /api/answers/:id/accept`, `POST /api/answers/:id/report`

### /dang-ky
- **File**: `src/app/(guest)/dang-ky/page.tsx`
- **Mục đích**: Đăng ký tài khoản học viên, luồng 2 bước.
- **Chức năng chính**: Stepper 2 bước; Bước 1 — Họ tên, SĐT Zalo (bắt buộc), SĐT phụ huynh (tuỳ chọn), Tỉnh/Thành (34 tỉnh sau sáp nhập 2025), Trường (validate client-side, icon check/x khi blur); Bước 2 — Email, Mật khẩu (thanh đo độ mạnh 5 mức), Xác nhận mật khẩu, checkbox điều khoản, toggle hiện/ẩn mật khẩu; sau submit: màn hình "Kiểm tra hộp thư" hoặc lỗi cấu hình email (fallback liên hệ admin); hiển thị lỗi server (email trùng...).
- **Component/thư viện dùng**: `griddy-icons` (Eye, EyeOff, CheckCircle, CloseCircle); `useAuth`
- **Dữ liệu/API**: `POST /api/auth/register`

### /dang-nhap
- **File**: `src/app/(guest)/dang-nhap/page.tsx`
- **Mục đích**: Đăng nhập.
- **Chức năng chính**: Form Email + Mật khẩu (toggle ẩn/hiện), checkbox "Ghi nhớ đăng nhập" (chỉ UI), link "Quên mật khẩu?"; tự redirect nếu đã đăng nhập (theo query `redirect` hoặc role); hiển thị lỗi sai; trạng thái submitting.
- **Component/thư viện dùng**: `useAuth` (login)
- **Dữ liệu/API**: qua `useAuth().login()`

### /dat-lai-mat-khau
- **File**: `src/app/(guest)/dat-lai-mat-khau/page.tsx`
- **Mục đích**: Đặt lại mật khẩu mới bằng token từ email.
- **Chức năng chính**: Đọc `token` từ query (thiếu → báo lỗi ngay); form Mật khẩu mới (đo độ mạnh) + Xác nhận (báo khớp/không khớp); thành công → progress bar animate rồi tự chuyển hướng sau 2s theo role; lỗi → message + link yêu cầu link mới.
- **Component/thư viện dùng**: Không dùng UI lib ngoài
- **Dữ liệu/API**: `POST /api/auth/reset-password`

### /diem-chuan
- **File**: `src/app/(guest)/diem-chuan/page.tsx`
- **Mục đích**: Tra cứu điểm chuẩn đại học theo trường/ngành/phương thức.
- **Chức năng chính**: Tìm kiếm text + dropdown phương thức xét + nút Đặt lại; số kết quả tìm thấy; bảng (Trường & Ngành, Phương thức, điểm 2025/2024/2023 — ẩn cột theo breakpoint, mũi tên tăng điểm); không tìm thấy → nút xem tất cả; CTA thi thử cuối trang.
- **Component/thư viện dùng**: `griddy-icons` (Search)
- **Dữ liệu/API**: **Không có** — dữ liệu hard-code (8 dòng), lọc hoàn toàn client-side

### /giang-vien
- **File**: `src/app/(guest)/giang-vien/page.tsx`
- **Mục đích**: Giới thiệu đội ngũ gia sư + top học viên nổi bật.
- **Chức năng chính**: Hero band; grid card gia sư (avatar, tên, chức danh, bio, tag chuyên môn, khóa phụ trách, nút "Nhắn Zalo"); "Top học viên nổi bật" (top 10 theo điểm thi, huy chương top 3, loading dạng chấm nhảy, rỗng, link xem bảng đầy đủ); CTA cuối trang (Xem khóa học / Gọi hotline).
- **Component/thư viện dùng**: `griddy-icons` (Trophy); dữ liệu tĩnh `@/lib/teacherData`, `@/lib/courseData`
- **Dữ liệu/API**: `GET /api/leaderboard` (10 đầu)

### /khoa-hoc-da-luu
- **File**: `src/app/(guest)/khoa-hoc-da-luu/page.tsx`
- **Mục đích**: Danh sách khóa học đã lưu (wishlist), liên hệ tư vấn để chốt đơn (không thanh toán online trực tiếp).
- **Chức năng chính**: Chưa đăng nhập → màn hình yêu cầu đăng nhập; đã đăng nhập → header badge số lượng, loading skeleton, rỗng (link Xem khóa học); danh sách item (thumbnail, tên, gia sư, số bài/giờ, giá + giá gốc gạch ngang + % giảm, nút Chi tiết + xoá); panel tóm tắt đơn hàng sticky (tổng cộng, nút "Đặt mua ngay"); modal checkout (tổng tiền, 2 lựa chọn Zalo/Hotline — không có form thanh toán online thật).
- **Component/thư viện dùng**: hooks `useCart`, `useAuth`
- **Dữ liệu/API**: qua hook `useCart`

### /khoa-hoc
- **File**: `src/app/(guest)/khoa-hoc/page.tsx`
- **Mục đích**: Danh sách toàn bộ khóa học, lọc/tìm kiếm.
- **Chức năng chính**: Sidebar danh mục (desktop sticky, liệt kê từng khóa) + pill danh mục (mobile); tìm kiếm tên/gia sư/danh mục; grid card (nút Lưu/Đã lưu — redirect đăng nhập nếu chưa; nút Mua → popup `PopupBuyRequired` nếu chưa ghi danh, hoặc "Tiếp tục học" nếu đã); loading skeleton, rỗng; dải "Cam kết" cuối trang; đọc query `category` khi vào trang.
- **Component/thư viện dùng**: `PopupBuyRequired`, `TeacherTag`; hooks `useCourses`, `useCart`, `useAuth`, `useEnrollments`; `@/lib/courseData`
- **Dữ liệu/API**: qua `useCourses`, `useCart`, `useEnrollments`

### /khoa-hoc/[slug]
- **File**: `src/app/(guest)/khoa-hoc/[slug]/page.tsx`
- **Mục đích**: Chi tiết 1 khóa học — thông tin, chương trình học, đánh giá, mua hàng.
- **Chức năng chính**: Breadcrumb; video giới thiệu YouTube nhúng hoặc placeholder, badge "MIỄN PHÍ xem thử"; thông tin khóa (category, hashtag, ngày khai giảng, `TeacherTag`, 2 ô thống kê); chương trình học dạng cây 3 cấp gấp/mở (Section→Chapter→Lesson), checkbox hoàn thành (chỉ bài free hoặc đã ghi danh), badge Free, nút Xem/khóa; section đánh giá (điểm TB, form gửi review yêu cầu đăng nhập, danh sách review, "đang chờ duyệt"); cột phải sticky (giá + giảm giá, CTA theo trạng thái ghi danh, 5 cam kết, gợi ý combo 8 môn); loading, không tìm thấy.
- **Component/thư viện dùng**: `TeacherTag`; hooks `useAuth`, `useProgress`, `useEnrollments`
- **Dữ liệu/API**: `GET /api/courses/:slug`, `GET/POST /api/courses/:id/reviews`

### /mentor/[id]
- **File**: `src/app/(guest)/mentor/[id]/page.tsx` (server component)
- **Mục đích**: Hồ sơ chi tiết 1 mentor (khác `/giang-vien` — 3 mentor riêng: Toán/Hóa/Lý).
- **Chức năng chính**: Nút quay lại; hero card (avatar, tên, môn dạy, bio, 4 ô thống kê: Đánh giá/Học viên/Buổi dạy/Kinh nghiệm); 2 cột (Học vấn, Thành tích, Lịch dạy cố định | Khóa học đang dạy + CTA "Đăng ký học với [tên]"); không tìm thấy mentor.
- **Component/thư viện dùng**: `griddy-icons` (Star, BookOpen, Users, Time, ArrowLeft, CheckCircle)
- **Dữ liệu/API**: **Không có** — 3 mentor hard-code trong file

### /quen-mat-khau
- **File**: `src/app/(guest)/quen-mat-khau/page.tsx`
- **Mục đích**: Yêu cầu gửi email đặt lại mật khẩu.
- **Chức năng chính**: Form Email; trạng thái "sent" (thông báo đã gửi, lưu ý hết hạn 1 giờ, nút thử email khác/về đăng nhập); lỗi từ server.
- **Component/thư viện dùng**: Không dùng UI lib ngoài
- **Dữ liệu/API**: `POST /api/auth/forgot-password`

### /thi-thu
- **File**: `src/app/(guest)/thi-thu/page.tsx`
- **Mục đích**: Danh sách đề thi thử — giao diện khác nhau cho khách vs học viên.
- **Chức năng chính**: Trạng thái đề tự tính lại real-time (`computeExamStatus`, không dùng field tĩnh); **Học viên**: 3 ô thống kê, filter danh mục, danh sách đề (điểm+hạng nếu đã làm, khóa nếu chưa ghi danh khóa liên quan, lý do khóa rõ ràng); **Khách**: 2 ô thống kê, band CTA đăng ký, danh sách đề không điểm số (nút "Đăng nhập để thi"), bảng so sánh quyền Khách vs Học viên (7 dòng); loading skeleton chung.
- **Component/thư viện dùng**: hooks `useExams`, `useAuth`, `useEnrollments`; `@/lib/courseData`, `@/lib/examData`
- **Dữ liệu/API**: qua `useExams`; `GET /api/exam-results?mine=true` (nếu đăng nhập)

### /tin-tuc
- **File**: `src/app/(guest)/tin-tuc/page.tsx`
- **Mục đích**: Danh sách bài viết Tin tức & Blog.
- **Chức năng chính**: Tìm kiếm + 5 nút lọc danh mục; bài ghim hiện card lớn riêng phía trên, còn lại grid 2 cột; mỗi card (badge danh mục màu riêng, tag, tiêu đề, excerpt, tác giả, ngày, thời gian đọc); loading skeleton, lỗi (thử lại), rỗng (phân biệt "chưa có bài" vs "không khớp filter").
- **Component/thư viện dùng**: Không dùng component/icon ngoài
- **Dữ liệu/API**: `GET /api/articles`

### /tin-tuc/[slug]
- **File**: `src/app/(guest)/tin-tuc/[slug]/page.tsx`
- **Mục đích**: Đọc chi tiết 1 bài tin tức/blog.
- **Chức năng chính**: Breadcrumb; badge danh mục + tag + "📌 Nổi bật"; tiêu đề, excerpt, meta (tác giả, ngày, thời gian đọc, lượt xem); nội dung tách đoạn theo `\n\n` (không dùng markdown/HTML parser); link xem tất cả bài viết; loading, lỗi, không tìm thấy theo slug.
- **Component/thư viện dùng**: Không dùng component/icon ngoài
- **Dữ liệu/API**: `GET /api/articles?slug=`

### /tra-cuu
- **File**: `src/app/(guest)/tra-cuu/page.tsx`
- **Mục đích**: Phụ huynh/học sinh tra cứu mã học viên + khóa học đã đăng ký bằng SĐT, không cần đăng nhập.
- **Chức năng chính**: Form 1 trường SĐT (validate regex real-time, icon check/x, nút disable khi không hợp lệ/đang tải); kết quả có thể nhiều học sinh (1 SĐT phụ huynh gắn nhiều con) — mỗi học sinh 1 card (avatar chữ đầu, mã HS, danh sách khóa học màu theo loại); lỗi không tìm thấy (box cam); ghi chú bảo mật cuối trang.
- **Component/thư viện dùng**: `griddy-icons` (Search, CheckCircle, CloseCircle, BookOpen)
- **Dữ liệu/API**: `POST /api/tra-cuu`

### /xac-nhan-phu-huynh
- **File**: `src/app/(guest)/xac-nhan-phu-huynh/page.tsx`
- **Mục đích**: Phụ huynh đồng ý/từ chối cho con tham gia lớp, qua link token email, không cần đăng nhập.
- **Chức năng chính**: Đọc `token` (thiếu → lỗi ngay); trạng thái loading/pending (tên HS+khóa học, nút Đồng ý/Từ chối)/approved/rejected/expired/error.
- **Component/thư viện dùng**: SVG inline, không dùng icon lib ngoài
- **Dữ liệu/API**: `GET/POST /api/parent-consents/:token`

### /xac-thuc-email
- **File**: `src/app/(guest)/xac-thuc-email/page.tsx`
- **Mục đích**: Xác thực email sau đăng ký, qua link token email.
- **Chức năng chính**: Đọc `token` (thiếu → lỗi); loading/success (chào mừng, tự chuyển hướng 3s, progress bar)/already/error (2 nút Đăng ký lại/Đăng nhập).
- **Component/thư viện dùng**: SVG inline
- **Dữ liệu/API**: `GET /api/auth/verify-email?token=`

### Layout chung Guest (Navbar/Footer)
- **`(guest)/layout.tsx`**: Navbar → main (Suspense + PageSkeleton) → nội dung → Footer → SalesBotWidget → StudentBottomNav (mobile). *Lưu ý: trang chủ `/` KHÔNG dùng layout này.*
- **Navbar**: logo → link nav đổi theo trạng thái đăng nhập (khách: Khóa học/Gia sư/Thi thử/Bảng xếp hạng/Tin tức; học viên: +Cộng đồng) → phải: loading skeleton hoặc (CoinBalance + NotificationBell + dropdown avatar: Thông tin cá nhân/Khoá học của tôi/Lịch học/Khóa học đã lưu/Đăng xuất) hoặc (Đăng nhập + "Bắt đầu miễn phí") → hamburger mobile.
- **Footer**: cột Brand (logo + mô tả + 4 icon MXH) / "Công cụ học tập" / "Hỗ trợ học viên" (hotline, Zalo, giờ hỗ trợ) / thanh dưới (copyright + Chính sách bảo mật).

---

## 4. Khu vực Học viên (6 trang thật + 7 redirect)

> 7 route sau chỉ là **stub redirect** sang trang public tương ứng, không có UI riêng: `/student` → `/student/hoc-tap`; `/student/bang-xep-hang` → `/bang-xep-hang`; `/student/cong-dong` → `/cong-dong`; `/student/cong-dong/[id]` → `/cong-dong/[id]`; `/student/hoi-dap` → `/cong-dong?tab=hoi-dap-qa`; `/student/hoi-dap/[id]` → `/cong-dong/hoi-dap/[id]`; `/student/thi-thu` → `/thi-thu`; `/student/tin-tuc` → `/tin-tuc`; `/student/tra-cuu` → `/tra-cuu`. **Khi vẽ Figma, các mục nav này nên trỏ trực tiếp tới trang public, không cần màn hình riêng.**

### /student/bai-giang/[lessonId]
- **File**: `src/app/(student)/student/bai-giang/[lessonId]/page.tsx` (1281 dòng — **trang phức tạp nhất khu vực học viên**)
- **Mục đích**: Trang học 1 bài học — trình phát video, làm bài tập, xem tài liệu, ghi chú, sidebar điều hướng toàn chương trình.
- **Chức năng chính**:
  - Layout 2 cột: sidebar trái (desktop, thu/mở nhớ trạng thái qua localStorage) — cây Section→Chapter→Lesson, đánh dấu hoàn thành/hiện tại/khoá + progress bar; mobile: bottom-sheet kéo lên
  - Nội dung theo 4 loại bài học, mỗi loại UI riêng:
    - **record**: `VideoPlayer` (Plyr, nhúng YouTube), nút CC tự viết (Plyr không tự xử lý với YouTube), watermark email mờ đè video (chống quay màn hình), tự lưu tiến trình xem mỗi 30s, tự đánh dấu hoàn thành khi xem ≥80%
    - **live**: khối "Buổi học LIVE" + nút "Vào phòng Zoom" (disable nếu chưa có link)
    - **quiz**: khối "Bài kiểm tra Azota" + nút mở link ngoài + deadline
    - **document**: dùng chung UI với quiz
  - Dưới video: thông tin bài (mã, thời lượng, lượt xem, số tài liệu, badge "Đang theo dõi phiên học · Thiết bị 1/2") + toggle hoàn thành thủ công
  - 3 tab: **Tài liệu** (mở qua `/xem-tai-lieu`), **Bài tập** (ẩn nếu type=quiz — 2 chế độ: nộp file qua Cloudinary có cảnh báo nộp đè bài đã chấm, hoặc làm trực tiếp trên web với autosave từng câu, khoá khi hết hạn), **Ghi chú** (riêng tư + ghi chú công khai từ giáo viên)
  - Breadcrumb + điều hướng Bài trước/Tiếp; modal `PopupBuyRequired` khi bấm bài khoá; loading 3 chấm; lỗi phân biệt 403 (chưa mua) và 404
- **Component/thư viện dùng**: `PopupBuyRequired`, `DropZone`, `MathText`; hook `useProgress`; `plyr`, `griddy-icons`
- **Dữ liệu/API**: `GET /api/lessons/[id]/context`, `PATCH /api/progress/[lessonId]`, `GET/PUT /api/lesson-notes/[lessonId]`, `GET /api/lessons/[lessonId]/assignments`, `GET/PATCH /api/assignments/[id]/answer`, `POST /api/assignments/[id]/submit`

### /student/ho-so
- **File**: `src/app/(student)/student/ho-so/page.tsx` (967 dòng)
- **Mục đích**: Hồ sơ cá nhân học viên — thông tin, mật khẩu, avatar, liên kết phụ huynh, thống kê học tập, huy hiệu, thiết bị.
- **Chức năng chính**:
  - Header: avatar (upload/kéo-thả `DropZone`, modal crop vuông `react-easy-crop`), tên, email, phone, trường/TP, badge "Học viên"
  - Section "Thông tin học sinh" (xem/sửa: họ tên*, SĐT, trường, tỉnh/TP)
  - Section "Thông tin phụ huynh" (tự khai — SĐT/tên)
  - **Khối "Liên kết phụ huynh" (ParentLink xác minh 2 chiều)**: 2 danh sách — yêu cầu gửi tới mình (nút Xác nhận/Từ chối), con đã liên kết (trạng thái Chờ/Đã xác nhận/Đã thu hồi); form gửi yêu cầu liên kết mới bằng email
  - Section "Mạng xã hội" (Facebook, Zalo)
  - "Lịch sử thi & điểm số" + `ScoreSparkline` (SVG tự vẽ, không dùng chart lib)
  - "Khóa học đã đăng ký" (link sang trang học)
  - Cột phải: 4 thẻ chỉ số (GPA/Xếp hạng/Streak/EXP), "Huy hiệu" (lưới `BADGE_RULES`, mờ nếu chưa đạt), `StreakCalendar` (heatmap 60 ngày)
  - "Thiết bị" (**mock, chưa có device tracking thật**: 2 thiết bị hard-code, nút Kick local, mô phỏng thiết bị thứ 3 mở `PopupDeviceLimit`)
  - "Bảo mật": đổi mật khẩu (modal, validate ≥8 ký tự + khớp), "Kết nối Google" (chỉ toast "đang phát triển"), đăng xuất tất cả thiết bị (modal xác nhận)
  - Toast góc trên-phải mọi thao tác (tự ẩn 3s)
- **Component/thư viện dùng**: `PopupDeviceLimit`, `DropZone`; `react-easy-crop`, `griddy-icons`; `@/lib/honorData` (BADGE_RULES); `useAuth`
- **Dữ liệu/API**: `GET/PUT /api/users/me`, `GET /api/exam-results?mine=true`, `GET /api/my-badges`, `GET/PUT /api/users/me/avatar`, `GET /api/users/me/stats`, `GET /api/users/me/activity`, `GET /api/enrollments` + `/api/courses`, `GET/POST /api/parent-links`, `PATCH /api/parent-links/[id]`, `POST /api/auth/change-password`

### /student/hoc-tap
- **File**: `src/app/(student)/student/hoc-tap/page.tsx` (312 dòng)
- **Mục đích**: Trang "vào học" 1 khóa học cụ thể (`?course=<id>`) — tiến độ tổng thể + mục lục chọn bài.
- **Chức năng chính**: Không có `?course=` → tự chọn khóa đầu tiên đã ghi danh và replace URL; chưa ghi danh khóa nào → empty-state; thẻ header khóa (strip màu, tên, danh mục, gia sư, tổng giờ/bài, % hoàn thành + progress bar); CTA động theo trạng thái (Mua ngay / Bắt đầu-Tiếp tục học / ✓ Đã hoàn thành); danh sách nội dung accordion (Section→Chapter→Lesson), mỗi bài: icon trạng thái, `TypeBadge` màu theo loại, thời lượng, badge FREE, bài kế tiếp tô nền xanh nhạt nổi bật; loading skeleton, lỗi (không tìm thấy khóa học).
- **Component/thư viện dùng**: hook `useProgress`, `useEnrollments`; `griddy-icons`; `<Suspense>`
- **Dữ liệu/API**: `GET /api/courses/[courseId]`

### /student/lich-hoc
- **File**: `src/app/(student)/student/lich-hoc/page.tsx` (300 dòng)
- **Mục đích**: Lịch học cá nhân theo tuần, gộp 3 loại sự kiện (buổi học, thi thử, deadline bài tập).
- **Chức năng chính**: Điều hướng tuần trước/sau (tự tính số tuần); 4 thẻ thống kê nhanh (Hôm nay/Buổi học/Thi thử/Deadline tuần này, skeleton riêng); bộ lọc 8 nút theo ngày (chấm nhỏ báo có sự kiện) + bộ lọc theo loại; danh sách sự kiện nhóm theo ngày (timeline dọc, hôm nay tô đỏ), mỗi thẻ có badge loại/giờ/chủ đề/môn + nút hành động theo loại; loading, empty ("Không có lịch nào trong tuần này").
- **Component/thư viện dùng**: `griddy-icons`
- **Dữ liệu/API**: `GET /api/schedule`

### /student/thi-thu/[examId]
- **File**: `src/app/(student)/student/thi-thu/[examId]/page.tsx` (840 dòng)
- **Mục đích**: "Phòng thi" đầy đủ vòng đời 1 lượt thi — xem đề, làm bài (trong nền tảng hoặc qua Azota), nộp, xem kết quả, xem lại bài làm.
- **Chức năng chính** (state machine `phase`: loading/error/ready/entering/submit/taking/done/review):
  - **ready**: thẻ thông tin đề, cảnh báo nghiêm túc, "Thông tin ghi nhận"; có ngân hàng câu hỏi → ô mật khẩu (nếu có) + "Bắt đầu làm bài"; có `azotaUrl` → "Vào phòng thi ngay"; không có gì → lỗi; cuối trang: Top 10 leaderboard + lịch sử lượt làm bài
  - **entering**: đếm ngược 5s rồi tự mở tab mới tới Azota
  - **submit**: form nhập điểm thủ công (tự khai sau khi làm Azota)
  - **taking** (thi trong nền tảng): sidebar sticky (đếm ngược đổi đỏ <60s, hỗ trợ nhiều "Phần" có giờ riêng, thanh tiến độ, lưới nhảy nhanh câu, nút Kết thúc) + 4 loại câu hỏi (MC/ESSAY/SHORT_ANSWER/TRUE_FALSE_CLUSTER); khoá câu thuộc Phần hết giờ; tự nộp khi hết giờ Phần cuối; theo dõi chuyển tab (`visibilitychange`) chống gian lận
  - **done**: điểm, hạng, bảng chi tiết, nút Xem lại bài làm + Thi lại
  - **review**: xem lại câu hỏi + đáp án học viên + đáp án đúng (nếu được phép), điểm/nhận xét giáo viên (tự luận)
- **Component/thư viện dùng**: `MathText`; `griddy-icons`; `useAuth`; `api.examAttempts.*`
- **Dữ liệu/API**: `GET /api/exams/[examId]`, `GET /api/exam-results?mine=true`, `?examId=` (leaderboard), `POST /api/exam-results`, `POST /api/exams/[examId]/start`, `GET .../attempts?mine=true`, `PATCH .../answer`, `.../answer-bool`, `.../tab-event`, `POST .../submit`, `GET .../review`

### Layout chung Học viên
- **`(student)/layout.tsx`**: bọc `AuthGuard requiredRole="student"` → `VerifyEmailBanner` → `Navbar` → `<main>` (Suspense + 3 skeleton, padding-bottom lớn hơn mobile) → `StudentBottomNav` (mobile) → widget chat động (`AIChatWidget` nếu đã có khóa học ghi danh, `SalesBotWidget` nếu chưa).
- **StudentBottomNav**: chỉ mobile, pill bo tròn kính mờ; 5 tab (Khóa học/Thi thử/Lịch học/Tin tức/Cộng đồng) + tab riêng "Tài khoản" (avatar chữ cái đầu, gradient xanh khi active); không có badge số thông báo.

---

## 5. Khu vực Admin (20 trang thật + 1 redirect + 1 file mẫu)

### /admin (dashboard)
- **File**: `src/app/(admin)/admin/page.tsx`
- **Mục đích**: Tổng quan cho quản trị viên, số liệu tùy theo cấp quyền.
- **Chức năng chính**: 4 health-card (Super Admin) hoặc 2 card (Content Admin), skeleton loading; biểu đồ thanh "Khoá học phổ biến" (top 5); panel "Kích hoạt gần đây" hoặc "Thống kê học sinh"; "Danger Zone" (≤4 học sinh GPA<7, nút Liên hệ mở modal gọi/email riêng lẻ); nút "Nhắc nhở tất cả" (soạn email hàng loạt); 4 Quick Action; badge cấp quyền; toast kết quả.
- **Component/thư viện dùng**: `griddy-icons`; `useAuth`/`hasPermission`/`PERMISSIONS`
- **Dữ liệu/API**: `/api/admin/students`, `/api/admin/analytics`, `/api/admin/remind`, `/api/admin/remind-all`

### /admin/cong-dong
- **File**: `src/app/(admin)/admin/cong-dong/page.tsx`
- **Mục đích**: Kiểm duyệt bài viết Cộng đồng (ghim/xoá).
- **Chức năng chính**: Tìm kiếm nội dung/tác giả + filter 4 category; danh sách chia "Bài ghim"/"Bài viết" (category badge, ngày, nội dung line-clamp-2, tác giả, like/reply); Ghim/Bỏ ghim (PATCH ngay), Xoá (confirm inline 2 bước); "Tải thêm" (cursor pagination); polling 30s + refetch khi focus tab, merge âm thầm bài mới; banner lỗi tải/thao tác.
- **Component/thư viện dùng**: `PermissionGuard`
- **Dữ liệu/API**: `/api/community/threads` (GET/PATCH/DELETE)

### /admin/cong-dong/bao-cao
- **File**: `src/app/(admin)/admin/cong-dong/bao-cao/page.tsx`
- **Mục đích**: Duyệt report vi phạm (bài cộng đồng + trả lời Hỏi đáp).
- **Chức năng chính**: 2 section riêng; mỗi report (người báo cáo, thời gian tương đối, nội dung gốc, lý do); report trả lời có thêm câu hỏi gốc + badge xu đã nhận; nút "Xác nhận vi phạm" / "Bỏ qua"; empty state riêng từng section.
- **Component/thư viện dùng**: React thuần
- **Dữ liệu/API**: `/api/admin/answer-reports`, `/api/admin/thread-reports`, `.../resolve`

### /admin/danh-gia
- **File**: `src/app/(admin)/admin/danh-gia/page.tsx`
- **Mục đích**: Duyệt đánh giá sao khóa học.
- **Chức năng chính**: 4 tab trạng thái (Chờ/Đã duyệt/Từ chối/Tất cả); bảng (học viên, khóa, sao, nhận xét line-clamp-2, ngày, trạng thái, hành động Duyệt/Từ chối/Xóa — `confirm()` trình duyệt).
- **Component/thư viện dùng**: `PermissionGuard`, `AdminToast`
- **Dữ liệu/API**: `/api/admin/reviews` (GET/PATCH/DELETE)

### /admin/doanh-thu
- **File**: `src/app/(admin)/admin/doanh-thu/page.tsx`
- **Mục đích**: Báo cáo doanh thu tổng hợp từ kích hoạt khóa học.
- **Chức năng chính**: 4 stat card; 2 biểu đồ thanh (theo khóa học, theo tháng); bảng "Lịch sử kích hoạt" (filter theo khóa, Export CSV client-side); nút Tải lại; footer tổng số giao dịch + tổng tiền đã lọc.
- **Component/thư viện dùng**: `PermissionGuard`, `griddy-icons`
- **Dữ liệu/API**: `/api/admin/analytics`

### /admin/hoc-sinh
- **File**: `src/app/(admin)/admin/hoc-sinh/page.tsx`
- **Mục đích**: Quản lý hồ sơ toàn bộ học sinh.
- **Chức năng chính**: 3 stat-card bấm lọc theo GPA; filter vai trò + tìm kiếm đa trường; bảng (SBD, tên, liên hệ, khóa học, GPA màu, badge, nút Chi tiết); modal chi tiết (3 chỉ số, progress bar, Ban/Gỡ ban, Xóa (confirm 2 bước), toggle kích hoạt/thu hồi từng khóa + nút "Xác nhận PH", form nhắc nhở email); drawer "Thêm học sinh mới" (tự gửi email đặt mật khẩu); toast mọi thao tác.
- **Component/thư viện dùng**: `PermissionGuard`, `griddy-icons`
- **Dữ liệu/API**: `/api/admin/students`, `/api/admin/students/[id]`, `/api/admin/enrollments`, `/api/parent-consents`, `/api/admin/remind`, `/api/courses?all=1`

### /admin/khoa-hoc
- **File**: `src/app/(admin)/admin/khoa-hoc/page.tsx`
- **Mục đích**: Danh sách toàn bộ khóa học — entry point CMS.
- **Chức năng chính**: Bảng (ID, tên, slug, danh mục, gia sư, toggle hiển thị, ngày tạo, ActionMenu: Cài đặt/Chương bài/Học viên/Xem portal/Sao chép/Xoá confirm 2 bước); filter tên/slug/danh mục (sync query)/trạng thái; drawer "Tạo khoá học mới" chi tiết (tự sinh slug, upload/kéo-thả ảnh Cloudinary chỉ upload thật lúc Lưu, danh mục tĩnh+DB, gia sư, ngày khai giảng, giá+giá gốc tự tính %, số bài/giờ, nhãn tùy chỉnh màu, preview trực quan).
- **Component/thư viện dùng**: `useCourses`, `SkeletonTable`, `Toggle`, `AdminToast`, `DropZone`
- **Dữ liệu/API**: `/api/categories`, `/api/courses?all=1`, `api.courses.create/update/remove`, `.../duplicate`

### /admin/khoa-hoc/[id] — **trang lớn nhất hệ thống (2293 dòng)**
- **File**: `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx`
- **Mục đích**: Quản trị chi tiết 1 khóa học — cấu hình, chương trình học, lịch học, học viên.
- **Chức năng chính** (4 tab qua `?tab=`):
  - **Cài đặt**: tên, slug (readonly), gia sư, danh mục, ảnh nền, giá, ngày khai giảng, toggle hiển thị, nhãn màu, video giới thiệu, link Zalo
  - **Danh sách chương bài**: cây Phần→Chương→Bài kéo-thả sắp xếp lại (rollback nếu lỗi API); Thêm/Sửa/Xoá từng cấp qua Drawer; Sao chép chương/bài; badge loại bài (Video/Tài liệu/Azota/Live), khóa/free; Drawer sửa bài: nhiều URL video/zoom/azota động, deadline, Documents Editor (Drive link hoặc Cloudinary upload), ghi chú học viên, **AssignmentEditor** lồng bên trong (2 chế độ: Nộp file có GradeSubmissionsModal, hoặc Làm trên web — AI trích câu hỏi bằng Gemini hoặc nhập tay, InteractiveResultsModal)
  - **Lịch học**: khung giờ cố định hàng tuần (thứ/giờ/ghi chú), bật/tắt/xoá
  - **Học viên đăng ký**: bảng học viên, tìm kiếm, progress bar tiến độ
- **Component/thư viện dùng**: `Toggle`, `DropZone`, `MathText`, Cloudinary upload
- **Dữ liệu/API**: `/api/courses/[slug]`, `.../reorder`, `/api/sections`, `/api/chapters`, `/api/lessons`, `api.assignments.*`, `api.classSchedules.*`, `.../students`, `/api/categories`

### /admin/khoa-hoc/danh-muc
- **File**: `src/app/(admin)/admin/khoa-hoc/danh-muc/page.tsx`
- **Mục đích**: Quản lý danh mục khóa học (không có model DB riêng — chỉ tồn tại khi có khóa học dùng).
- **Chức năng chính**: Bảng (#, tên, slug tự sinh, số khóa học → link filter, ActionMenu Sửa/Xoá); tìm kiếm; drawer thêm/sửa (thêm mới chỉ ghi nhớ tạm tới khi có khóa dùng; sửa áp dụng toàn bộ khóa đang dùng); chặn xóa nếu còn khóa dùng; banner giải thích cơ chế đồng bộ.
- **Component/thư viện dùng**: `Toggle` (import nhưng không thấy dùng logic chính)
- **Dữ liệu/API**: `/api/categories` (GET/PUT)

### /admin/quan-tri-vien
- **File**: `src/app/(admin)/admin/quan-tri-vien/page.tsx`
- **Mục đích**: Phân quyền — nâng/hạ cấp giữa Học viên và các vai trò Admin.
- **Chức năng chính**: Stats inline (Tổng/Admin/Học viên/Chưa KH); filter tab + tìm kiếm; bảng (RoleBadge, số khóa đăng ký); hành động theo ngữ cảnh (Thêm Admin Cấp 2/Giáo viên, Nâng/Hạ cấp, Thu hồi quyền — confirm inline, không tự đổi quyền chính mình).
- **Component/thư viện dùng**: `PermissionGuard`
- **Dữ liệu/API**: `/api/users`, `/api/users/[id]/role`

### /admin/sales-leads
- **File**: `src/app/(admin)/admin/sales-leads/page.tsx`
- **Mục đích**: Xem hội thoại tư vấn từ Sales Bot (chatbot AI) để đội sales theo dõi lead.
- **Chức năng chính**: Filter tab theo giai đoạn + toggle "Cần hỗ trợ"; bảng (lead score màu, tóm tắt, badge giai đoạn, số tin nhắn, thời gian, nút Xem); modal chi tiết hội thoại dạng chat bubble.
- **Component/thư viện dùng**: `PermissionGuard`
- **Dữ liệu/API**: `/api/admin/sales-leads`, `/api/admin/sales-leads/[id]`

### /admin/thi-thu — **1965 dòng**
- **File**: `src/app/(admin)/admin/thi-thu/page.tsx`
- **Mục đích**: Danh sách + quản lý đề thi thử, tạo đề mới với soạn câu hỏi tích hợp AI.
- **Chức năng chính**: Stats inline (tự tính lại mỗi phút); filter + phân trang; bảng (mã đề badge màu, tên+thí sinh, danh mục, ngày/giờ, thời lượng, số câu, trạng thái, toggle Công khai/activeGuest, ActionMenu); **CreateExamDrawer** (rất phức tạp: dán text theo cú pháp tự nhận diện 4 loại câu + LaTeX + ảnh + Phần thi, tải .txt/.csv/.xlsx, tải pdf/docx/ảnh để AI Gemini trích câu hỏi, chọn từ Ngân hàng câu hỏi, "Chế độ 2 khung" form↔markup đồng bộ 2 chiều, khuôn điểm theo mẫu chính thức, chống trùng 3 cấp khi thêm vào ngân hàng); **EditExamDrawer** (thêm: gắn khóa học liên quan, phí thi, mật khẩu, hiển thị BXH, khi nào xem đáp án, thang điểm % câu Đúng-Sai, áp dụng điểm hàng loạt).
- **Component/thư viện dùng**: `PermissionGuard`, `useExams`, `AdminToast`, `Toggle`, `QuestionBankPicker`, `CategoryPicker`, `DropZone`; `papaparse`, `exceljs` (dynamic import)
- **Dữ liệu/API**: `api.exams.*`, `api.examQuestions.bulkCreate/setPoints`, `api.courses.list`, `api.questionCategories.list`, `api.questionBank.checkDuplicate/create`

### /admin/thi-thu/[id] — **1347 dòng**
- **File**: `src/app/(admin)/admin/thi-thu/[id]/page.tsx`
- **Mục đích**: Soạn/sửa câu hỏi của 1 đề, xem kết quả thi, chấm bài tự luận.
- **Chức năng chính**: Danh sách câu hỏi (sắp xếp ▲▼, Sửa/Xoá/"Lưu vào ngân hàng"); **QuestionDrawer** (4 loại câu + Phần thi); **BulkImportDrawer** (dán text hoặc AI-extract có bước xem lại/áp khuôn điểm); "+ Từ ngân hàng" (QuestionBankPicker); **AttemptsPanel** (bảng đã thi — điểm, thời gian, số lần rời tab, badge chưa chấm tự luận, `GradeAttemptDrawer` chấm chi tiết); **GuestAccessPanel** (duyệt thủ công quyền vào thi miễn phí cho guest đã thanh toán ngoài); **SaveToBankModal**.
- **Component/thư viện dùng**: `PermissionGuard`, `AdminToast`, `MathText`, `QuestionBankPicker`, `CategoryPicker`, `DropZone`
- **Dữ liệu/API**: `api.exams.get`, `api.examQuestions.*`, `api.examAttemptsAdmin.*`, `api.examGuestAccess.*`

### /admin/thi-thu/ngan-hang-cau-hoi
- **File**: `src/app/(admin)/admin/thi-thu/ngan-hang-cau-hoi/page.tsx`
- **Mục đích**: Gallery các ngân hàng câu hỏi gốc (mỗi ngân hàng là 1 đầu mục root).
- **Chức năng chính**: Lưới thẻ (tổng câu hỏi cộng dồn cả cây con; hover: Sửa tên inline/Copy toàn cây (modal đặt tên)/Xoá (chỉ khi rỗng)); tìm kiếm + phân trang 12/trang; "Tạo ngân hàng mới" + Upload/Extract AI.
- **Component/thư viện dùng**: `PermissionGuard`, `AdminToast`, `UploadAndExtractButton`
- **Dữ liệu/API**: `api.questionCategories.*`

### /admin/thi-thu/ngan-hang-cau-hoi/[id]
- **File**: `src/app/(admin)/admin/thi-thu/ngan-hang-cau-hoi/[id]/page.tsx`
- **Mục đích**: Chi tiết 1 ngân hàng — quản lý cây đầu mục không giới hạn cấp.
- **Chức năng chính**: Cây thu gọn/mở rộng đệ quy (link sang câu hỏi lọc theo đầu mục, tổng cộng dồn, badge theo độ khó NB/TH/VD/VDC; hover Thêm mục con/Sửa/Xoá); tìm kiếm trong cây (tự mở nhánh khớp); 2 view "Cây cấu trúc"/"Thống kê" (bảng theo độ khó + theo loại câu, từng Chương + tổng); nút Tải file AI extract, Copy ngân hàng, Quét trùng lặp, Tự chọn câu hỏi, Thêm câu hỏi/chương.
- **Component/thư viện dùng**: `PermissionGuard`, `AdminToast`, `UploadAndExtractButton`, `DuplicateScanModal`
- **Dữ liệu/API**: `api.questionCategories.*`

### /admin/thi-thu/ngan-hang-cau-hoi/cau-hoi
- **File**: `src/app/(admin)/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi/page.tsx`
- **Mục đích**: Danh sách + soạn câu hỏi Ngân hàng (lọc `?categoryId=`), có quy trình duyệt.
- **Chức năng chính**: Filter (nội dung, đầu mục cây, độ khó, trạng thái Nháp/Chờ duyệt/Đã duyệt) + phân trang 20; bảng (mức sử dụng: số đề dùng + % đúng màu theo tỉ lệ; hành động theo quyền: chủ sở hữu Sửa/Xoá/Gửi duyệt, người khác Duyệt/Từ chối kèm lý do); "Chọn nhiều" (checkbox mode, thanh action nổi: Copy đầu mục khác / Thêm vào đề); **ItemDrawer** (CategoryPicker, độ khó, 4 loại câu, ảnh minh họa upload lúc Lưu, đáp án theo loại, giải thích, tags).
- **Component/thư viện dùng**: `PermissionGuard`, `AdminToast`, `CategoryPicker`, `AddToExamModal`, `CopyToCategoryModal`, `MathText`, `DropZone`
- **Dữ liệu/API**: `api.questionBank.*`, `api.questionCategories.list`

### /admin/thi-thu/ngan-hang-de-thi
- **File**: `src/app/(admin)/admin/thi-thu/ngan-hang-de-thi/page.tsx`
- **Mục đích**: File-manager kiểu Azota lưu file đề thi gốc (PDF/Word/ảnh) phục vụ tách câu hỏi.
- **Chức năng chính**: Giao diện 1 cấp phẳng (breadcrumb, bảng gộp thư mục+file, sort, checkbox chọn nhiều xoá hàng loạt, thư mục: Đổi tên/Xoá confirm, file: Xem/Tách câu (`ExtractReviewModal` AI)/chuyển thư mục/Xoá); khu "Tải lên gần đây" (4 file, chỉ ở root); tìm kiếm, tạo thư mục, upload/kéo-thả.
- **Component/thư viện dùng**: `PermissionGuard`, `AdminToast`, `ExtractReviewModal`, `DropZone`
- **Dữ liệu/API**: `api.examFiles.*`, `api.examFileFolders.*`

### /admin/tin-tuc
- **File**: `src/app/(admin)/admin/tin-tuc/page.tsx`
- **Mục đích**: Quản lý bài viết Tin tức & Blog.
- **Chức năng chính**: Bảng (tiêu đề+slug, badge danh mục 4 loại, tác giả, toggle Xuất bản, lượt xem, ngày, ActionMenu Sửa/Xem trước/Xoá); filter tiêu đề/tác giả/danh mục/trạng thái; drawer thêm/sửa (tự sinh slug sửa được, danh mục, tag, thời gian đọc, tác giả, tóm tắt ≤250 ký tự có đếm, nội dung markdown đơn giản, toggle Ghim + Xuất bản); footer đếm xuất bản/nháp.
- **Component/thư viện dùng**: `PermissionGuard`, `Toggle`, `AdminToast`
- **Dữ liệu/API**: `/api/admin/articles` (GET/POST/PATCH/DELETE)

### /admin/vinh-danh
- **File**: `src/app/(admin)/admin/vinh-danh/page.tsx`
- **Mục đích**: Quản lý Bảng vinh danh — xếp hạng, trao badge, import điểm ngoài.
- **Chức năng chính**: 3 tab — **Bảng xếp hạng** (sort GPA/Tiến độ/Điểm thi, huy chương top 3); **Trao Badge** (quy tắc tự động từ `BADGE_RULES`, danh sách đủ điều kiện, cấp từng huy hiệu hoặc cấp tất cả); **Import điểm thi** (form kỳ thi + ngày, kéo-thả CSV/Excel — **còn đang phát triển, chưa xử lý thật**).
- **Component/thư viện dùng**: `PermissionGuard`, `@/lib/honorData` (BADGE_RULES, computeRankings), `GpaBar`, `DropZone`
- **Dữ liệu/API**: `/api/honor-leaderboard`, `/api/admin/badges`

### Layout chung Admin
- **`(admin)/layout.tsx`**: `AuthGuard requiredRole="admin"` → `AdminSidebar` (trái) + `AdminTopbar` (trạng thái hệ thống, link "Portal học viên"/"Khóa học" mở tab mới sang domain học viên riêng, badge cấp quyền, avatar+tên) + nội dung (Suspense).
- **AdminSidebar** — menu đầy đủ (lọc theo quyền):
  1. Tổng quan → `/admin`
  2. Khóa học (CMS) → Danh sách / Danh mục
  3. Thi thử → Danh sách đề / Ngân hàng câu hỏi / Ngân hàng đề thi
  4. Đánh giá khóa học
  5. Bảng vinh danh
  6. Tin tức & Blog
  7. Cộng đồng → Bài viết / Báo cáo trả lời
  8. Hồ sơ học sinh
  9. Lead tư vấn
  10. Doanh thu
  11. Quản trị viên
  - Badge vai trò màu riêng (Cấp 1 cam / Cấp 2 xanh / Giáo viên xanh lá); mục con tự mở khi active; nút Đăng xuất đáy sidebar.

---

## 6. Component dùng chung (`src/components/`, 35 file + subfolder `community/`)

| Component | Mô tả ngắn |
|---|---|
| `AIChatWidget` | Trợ lý AI học tập, hiện cho học viên đã có khóa học ghi danh (thay thế `SalesBotWidget`) |
| `AddToExamModal` | Modal chọn 1 đề đích để gộp câu hỏi đã chọn từ Ngân hàng vào |
| `AdminSidebar` | Sidebar điều hướng khu vực admin (chi tiết ở mục 5) |
| `AdminToast` | Toast thông báo dùng trong các trang admin |
| `AgentationWrapper` | Công cụ hỗ trợ dev/QA (visual feedback toolbar) — **không phải UI sản phẩm**, có thể bỏ qua khi làm Figma |
| `AuthGuard` | Bọc route yêu cầu đăng nhập + đúng role (student/admin) |
| `CategoryPicker` | Chọn 1 đầu mục trong cây phân cấp không giới hạn tầng (Môn→Chương→Bài→Dạng) |
| `CoinBalance` | Hiển thị số dư xu trên Navbar |
| `CopyToCategoryModal` | Modal sao chép nhiều câu hỏi lẻ sang 1 đầu mục khác |
| `CourseShowcase` | Component hiển thị khóa học (dùng ở landing/showcase) |
| `DropZone` | Bọc 1 khu vực để nhận kéo-thả file, song song với cách bấm-chọn cũ |
| `DuplicateScanModal` | Quét trùng lặp hàng loạt trong 1 ngân hàng câu hỏi |
| `ExtractReviewModal` | Xem lại/chỉnh sửa câu hỏi AI trích từ file trước khi lưu |
| `Features` | Section tính năng tĩnh |
| `Footer` | Chân trang dùng chung toàn site |
| `GlobalDropGuard` | Chặn hành vi mặc định của trình duyệt khi thả file lệch ra ngoài vùng `DropZone` |
| `GpaBar` | Thanh hiển thị GPA (dùng ở bảng xếp hạng, hồ sơ, vinh danh) |
| `Leaderboard` | Component bảng xếp hạng tái sử dụng |
| `MathText` | Render công thức toán (`$...$` inline, `$$...$$` khối), escape HTML vì nội dung từ giáo viên không được tin tưởng tuyệt đối |
| `Navbar` | Thanh điều hướng trên cùng dùng chung toàn site (chi tiết ở mục 3) |
| `NotificationBell` | Chuông thông báo trên Navbar |
| `PermissionGuard` | Bọc UI theo quyền admin cụ thể (ẩn nếu không đủ quyền) |
| `PopupBuyRequired` | Popup yêu cầu mua khóa học khi bấm nội dung khoá |
| `PopupDeviceLimit` | Popup giới hạn thiết bị đăng nhập đồng thời |
| `PopupStrikeWarning` | Popup cảnh báo kỷ luật (strike) |
| `QuestionBankPicker` | Chọn câu hỏi có sẵn từ Ngân hàng câu hỏi để thêm vào đề |
| `QuestionModal` | Modal chi tiết 1 câu hỏi Hỏi đáp cộng đồng |
| `SalesBotWidget` | Chatbot tư vấn bán hàng cho khách/học viên chưa có khóa học |
| `Skeleton` | Khối loading skeleton dùng chung |
| `StudentBottomNav` | Thanh điều hướng dưới cho học viên, chỉ mobile (chi tiết ở mục 4) |
| `TeacherTag` | Tag hiển thị tên/badge gia sư trên card khóa học |
| `ThreadModal` | Modal chi tiết 1 bài viết cộng đồng |
| `Toggle` | Switch bật/tắt dùng chung |
| `UploadAndExtractButton` | Nút "Tải file lên & tách câu hỏi" AI, gộp 2 bước cũ thành 1 luồng liền mạch |
| `VerifyEmailBanner` | Banner nhắc xác minh email, hiện có điều kiện trong layout học viên |
| `community/ThreadDetailShared` | Logic + UI dùng chung cho trang chi tiết thread (CAT_MAP, Avatar, MediaGrid, Lightbox, ReplyCard, ReplyForm, ReportPanel, hook `useThreadDetail`) |

---

## 7. Khuyến nghị hành động tiếp theo

1. **Thống nhất 1 design system trước khi vẽ chi tiết từng trang** (mục 2) — nếu không, Figma sẽ kế thừa luôn sự lẫn lộn 2 style hiện có ở Admin.
2. **Ưu tiên vẽ trước các pattern lặp lại nhiều lần** thay vì vẽ từng trang riêng lẻ: Table (list + filter + search + pagination), Drawer trượt phải (thêm/sửa), Modal xác nhận, Toast, EmptyState, ErrorState (kèm nút thử lại), Skeleton loading — pattern này lặp lại ở ít nhất 15/20 trang Admin.
3. **3 trang phức tạp nhất nên làm sau cùng, sau khi đã có component chuẩn**: `/admin/khoa-hoc/[id]` (2293 dòng), `/admin/thi-thu` (1965 dòng), `/admin/thi-thu/[id]` (1347 dòng), `/student/bai-giang/[lessonId]` (1281 dòng) — đây là 4 trang lõi nghiệp vụ, rủi ro cao nếu vẽ vội.
4. **Xác nhận lại với bạn 2 việc trước khi vẽ**: (a) các trang có dữ liệu hard-code (`/diem-chuan`, `/mentor/[id]`, số liệu trang chủ) có chuyển sang quản trị được qua CMS không; (b) 3 route chỉ redirect (`/gio-hang`, `/gioi-thieu`, `/vinh-danh`) có nên bỏ khỏi sitemap Figma luôn không.
5. Khi có link Figma, gắn vào tài liệu này (hoặc `files/07_...` mục 7) làm nguồn tham chiếu chung.

---

## 8. Rà soát trang không còn phù hợp với mô hình chuyển đổi (gia sư–lớp–phụ huynh)

> Đối chiếu 59 trang ở mục 3–5 với mô hình mục tiêu trong `files/07_ke_hoach_chuyen_doi_gia_su.md` (đa gia sư sở hữu lớp riêng, phụ huynh xác minh, gói theo lớp trả Coin) và roadmap gốc trong Google Sheet TSIX (D01–D10, G0–G7). Xếp theo mức độ cần thay đổi — từ "phải bỏ/thay hẳn luồng" đến "giữ nguyên, chỉ đổi hình thức".

### A. Mâu thuẫn trực tiếp với mô hình mới — nên bỏ luồng cũ, không chỉ vẽ lại giao diện

| Trang/khối | Vấn đề |
|---|---|
| `/khoa-hoc-da-luu`, `/gio-hang`, modal checkout ("Nhắn Zalo tư vấn" / "Gọi hotline") | Toàn bộ là luồng **"liên hệ ngoài để chốt đơn"**, không có thanh toán online thật. Mâu thuẫn trực tiếp với D01 (gói theo lớp trả bằng Coin) và G4 (webhook, ví, gia hạn tự động) — mô hình mới cần mua/đăng ký ngay trong app, không qua Zalo/hotline. |
| Nút "Mua khóa học" → `PopupBuyRequired` (ở `/khoa-hoc`, `/khoa-hoc/[slug]`) | Cùng gốc vấn đề — popup chỉ đưa số Zalo/hotline, không phải luồng mua/đăng ký lớp thật. Cần thay bằng nút đăng ký lớp + trừ Coin trực tiếp (G2, G4). |
| `/admin/hoc-sinh` — khối "Kích hoạt / Thu hồi khoá học" (toggle tay từng học viên) | Đây là cách duy nhất hiện có để 1 học viên vào được 1 khóa — hoàn toàn do **admin bấm tay**. Mâu thuẫn với luồng tự đăng ký qua lời mời (`ClassInvite`, G2.03) mà sheet đặt ra — trong mô hình mới, gia sư/hệ thống phải là nơi cấp quyền, không phải admin trung tâm làm thay cho mọi gia sư. |

### B. Đúng mục đích nhưng sai chủ thể/kiến trúc thông tin — cần thiết kế lại luồng, không chỉ đổi màu

| Trang/khối | Vấn đề |
|---|---|
| `/giang-vien`, `/mentor/[id]` | Đang là **trang marketing tĩnh, dữ liệu hard-code** (`TEACHERS`, `MENTORS` viết cứng trong file). Mô hình mới cần đây là hồ sơ gia sư **thật, động, do chính gia sư tự cập nhật** (`TutorProfile`, G1.02) — khác hẳn về IA: từ "trang giới thiệu do content admin viết" thành "hồ sơ do gia sư sở hữu và quản lý". |
| `/admin/khoa-hoc`, `/admin/khoa-hoc/[id]` (toàn bộ CMS khóa học, 2293 dòng) | Thiết kế theo góc nhìn **"1 đội content quản lý mọi khóa học"**. Mô hình đa gia sư cần thêm hẳn 1 portal riêng — **"Gia sư Dashboard"** (tạo/sửa lớp của chính mình, không lồng trong menu Admin) — tách bạch theo đúng ma trận quyền ở `files/07` mục 2 (Gia sư ≠ Admin nền tảng). Hiện tại "giáo viên" chỉ là 1 `adminRole` bị lọc theo `ownerId`, dùng chung y hệt giao diện Admin — cần tách hẳn không gian làm việc. |
| `/cong-dong`, `/cong-dong/[id]` | Diễn đàn hiện là **toàn hệ thống** — mọi học viên thấy mọi bài, không phân biệt theo lớp/gia sư nào. Theo G5.01 ("Phạm vi lớp cho diễn đàn"), cộng đồng phải giới hạn theo lớp. Cần thêm bộ chọn "đang xem cộng đồng của lớp nào" hoặc tách hẳn thành cộng đồng-trong-lớp. |
| `/admin/doanh-thu` | Tính doanh thu theo **"lượt kích hoạt khóa học"** (sự kiện admin bấm tay), không phải giao dịch Coin thật. Mô hình mới cần đổi hẳn sang sổ giao dịch Coin/gói theo lớp (G4), và nhiều khả năng phải tách doanh thu theo từng gia sư — vì nền tảng giờ có nhiều gia sư cùng thu nhập, không phải 1 trung tâm duy nhất. |
| `/admin/quan-tri-vien` — luồng "Thêm Giáo viên" | Hiện là **admin tự tay tạo tài khoản giáo viên** cho người khác. Mô hình đa gia sư cần luồng ngược lại: **gia sư tự đăng ký → admin duyệt xác minh** (đúng field "trạng thái xác minh" ở G1.02) — khác hẳn thao tác "cấp phát" như hiện tại. |

### C. Có dữ liệu/2 nguồn xung đột — dọn khi redesign, đã cảnh báo trong `files/07`

| Trang/khối | Vấn đề |
|---|---|
| `/student/ho-so` — section "Thông tin phụ huynh" (form tự khai `parentPhone`/`parentName`) | Đang tồn tại **song song** với khối "Liên kết phụ huynh" (ParentLink đã xác minh) mới build. `files/07` mục 3.4 đã ghi rõ: field tự khai này **không được dùng làm nguồn cấp quyền**. Khi redesign nên gộp 2 khối lại hoặc bỏ hẳn section cũ, chỉ giữ 1 nguồn duy nhất là ParentLink đã verified — tránh học viên/phụ huynh bối rối vì có 2 nơi "khai báo phụ huynh" khác nhau. |
| `/tra-cuu` | Đã kiểm tra trực tiếp `src/app/api/tra-cuu/route.ts`: tra cứu **khớp thẳng vào field `parentPhone` tự khai**, không qua xác minh (`OR: [{ phone }, { parentPhone }]`). Đây chính là kiểu "cấp thông tin chỉ từ SĐT nhập tay" mà nguyên tắc G2.10 đang muốn loại bỏ cho luồng cấp quyền — tuy `/tra-cuu` chỉ đọc (không cấp quyền truy cập gì), nhưng vẫn nên cân nhắc khi redesign: giữ như tiện ích tra cứu công khai độc lập, hay hợp nhất vào luồng ParentLink thật để tránh 2 khái niệm "phụ huynh" khác nhau trong cùng hệ thống. |

### D. Gap — trang chưa tồn tại, không phải "sai" mà là "thiếu hẳn" cho mô hình mới

Không nằm trong 59 trang ở mục 3–5 vì thực sự chưa được xây:

1. **Gia sư Dashboard** — lớp của tôi / học viên của tôi / doanh thu của tôi / hồ sơ của tôi. Hiện gia sư chỉ dùng chung giao diện Admin bị lọc theo quyền sở hữu.
2. **Trang mua/quản lý gói theo lớp** (Subscription, G4.01) — chưa có route nào, khớp với ghi chú "chưa code, chờ Figma" ở `files/07` mục 3.3/6.
3. **Trang tạo & quản lý lời mời lớp** (ClassInvite, G2.03) — chưa có.
4. **Trang duyệt hồ sơ gia sư mới đăng ký** (khác với "Thêm Giáo viên" hiện tại ở `/admin/quan-tri-vien`) — chưa có.

### E. Không mâu thuẫn với chuyển đổi — chỉ cần redesign hình thức, giữ nguyên chức năng

Toàn bộ hệ **Thi thử** (`/thi-thu`, `/admin/thi-thu*`, ngân hàng câu hỏi), **Bảng xếp hạng/Vinh danh**, **Auth** (đăng ký/đăng nhập/quên mật khẩu), **Tin tức**, **Coin wallet + kinh tế Hỏi-đáp trong cộng đồng** — các khối này độc lập với việc "ai sở hữu lớp", không cần đổi luồng, chỉ cần redesign giao diện theo design system mới. Riêng **Đăng ký** (`/dang-ky`) nên cân nhắc thêm bước "chọn vai trò: học viên hay gia sư" ngay từ đầu, vì hiện tại mặc định mọi tài khoản mới đều là `role: "student"`.

### Tóm tắt cho việc lập sitemap Figma

- **Bỏ khỏi sitemap mới**: `/gio-hang`, `/gioi-thieu`, `/vinh-danh` (đã là alias redirect), luồng checkout Zalo/Hotline trong `/khoa-hoc-da-luu`.
- **Thiết kế lại từ đầu (không tái dùng luồng cũ)**: `/giang-vien`, `/mentor/[id]` → hồ sơ gia sư động; CMS khóa học → Gia sư Dashboard riêng; `/cong-dong` → cộng đồng theo lớp; `/admin/doanh-thu` → sổ Coin.
- **Thêm mới hoàn toàn**: Gia sư Dashboard, mua gói theo lớp, tạo lời mời lớp, duyệt hồ sơ gia sư.
- **Giữ nguyên chức năng, chỉ đổi giao diện**: Thi thử, Bảng xếp hạng/Vinh danh, Auth, Tin tức, Coin/Hỏi-đáp.
