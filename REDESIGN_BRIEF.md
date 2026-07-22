# Redesign brief — Midnight Elite (TSIX Education)

## Bối cảnh
Nền tảng luyện thi ĐGNL/THPT/BCA cho học sinh Việt Nam, Next.js 16 App Router + React 19 + Tailwind v4. Sản phẩm đã có người dùng thật, không phải demo. Hiện UI đang ở giai đoạn "trông giống AI tạo ra" — cần thiết kế lại để có bản sắc riêng, đáng tin cậy hơn với phụ huynh/học sinh đang trả tiền, mà **không được đụng vào logic nghiệp vụ**.

## Ràng buộc cứng — vi phạm là fail toàn bộ task
1. **Không sửa bất kỳ file nào ngoài JSX cấu trúc UI, className, style, và các file CSS/token.** Không đụng vào: gọi API (`fetch`, `api.*`), state logic, Prisma/route handlers trong `src/app/api/**`, `src/lib/**` (trừ file token màu/design nếu tạo mới), hook nghiệp vụ (`useAuth`, `useEnrollments`, `useProgress`...).
2. **Giữ nguyên 100% route/URL hiện có** — không đổi tên, không xoá, không gộp trang. Danh sách module bắt buộc còn nguyên vẹn:
   - **Guest**: trang chủ, `/khoa-hoc` (list + `[slug]` detail), `/giang-vien` (+ `[id]`), `/thi-thu`, `/cong-dong` (+ `[id]`, `/hoi-dap/[id]`), `/bang-xep-hang`, `/tin-tuc` (+ `[slug]`), `/gioi-thieu`, `/vinh-danh`, `/chinh-sach`, `/diem-chuan`, `/tra-cuu`, `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/xac-thuc-email`, `/khoa-hoc-da-luu`, `/gio-hang` (redirect).
   - **Student**: `/student` (dashboard), `/student/hoc-tap`, `/student/bai-giang/[lessonId]`, `/student/thi-thu` (+ `[examId]`), `/student/lich-hoc`, `/student/ho-so`, `/student/bang-xep-hang`, `/student/tin-tuc`, `/student/cong-dong` (+ `[id]`), `/student/hoi-dap` (+ `[id]`), `/student/tra-cuu`.
   - **Admin**: Tổng quan, Khóa học (danh sách + danh mục + chương/bài), Thi thử (đề thi + ngân hàng câu hỏi), Đánh giá khóa học, Bảng vinh danh, Tin tức & Blog, Cộng đồng (bài viết + báo cáo), Hồ sơ học sinh, Lead tư vấn, Doanh thu, Quản trị viên.
3. **Không được để mất chức năng nào** khi test lại thủ công: form submit, filter/search, toggle, drawer/modal mở-đóng, upload ảnh, thi thử (vào phòng → làm bài → nộp → xem lại), tất cả phải hoạt động y hệt sau redesign.
4. Sau mỗi cụm thay đổi, chạy `npx tsc --noEmit` (phải 0 lỗi) và test bằng browser thật, không chỉ đọc code.

## Hiện trạng design system (đã verify trong code, không phải đoán)
- **Font**: Inter (`var(--font-inter)`) toàn bộ site — đây chính là dấu hiệu "AI slop" phổ biến nhất, ưu tiên đổi đầu tiên.
- **Palette guest/student** (Notion-flat, `src/app/globals.css`): canvas `#ffffff`, surface `#f6f5f4`/`#fafaf9`, hairline `#e5e3df`, text scale `#1a1a1a → #37352f → #5d5b54 → #787671 → #a4a097`, brand blue `#0068FF`, các màu semantic (`#00A63D` success, `#FE9900` warning, `#FF2157` danger).
- **Palette admin**: hoàn toàn khác — neumorphism nền `#F0F5FF`, box-shadow kiểu `16px 16px 32px #C5D0EA, -16px -16px 32px #ffffff`, class `.neu-raised/.neu-flat/.neu-pressed`. Đây là 2 hệ thống thiết kế không liên quan nhau trong cùng 1 sản phẩm — cần quyết định: hợp nhất thành 1 ngôn ngữ thiết kế xuyên suốt, hoặc giữ tách biệt có chủ đích (dashboard nội bộ khác trải nghiệm khách/học viên) nhưng phải nhất quán nội tại từng bên.
- **Icon**: `griddy-icons` (đã là lựa chọn khác biệt, không phải Lucide/Feather mặc định — giữ nguyên, không đổi).
- Tailwind v4 (`@import "tailwindcss"`, không dùng cấu hình `tailwind.config` kiểu v3), Next.js 16.2.6.

## Việc cần làm — theo đúng thứ tự ưu tiên
1. **Đổi font.** Bỏ Inter. Chọn 1 font có cá tính phù hợp ed-tech Việt Nam, hỗ trợ tốt dấu tiếng Việt (kiểm tra kỹ dấu thanh, không vỡ chữ) — ví dụ Be Vietnam Pro, Google Sans Text, hoặc một serif/sans có điểm nhấn cho heading + sans phụ cho body.
2. **Chọn 1 hướng màu duy nhất, bỏ pha trộn 2 hệ.** Giữ brand blue `#0068FF` làm accent chính (đã quen thuộc với người dùng), nhưng tinh chỉnh lại toàn bộ neutral/text scale cho nhất quán. Quyết định rõ ràng: admin có tiếp tục neumorphism hay chuyển về cùng ngôn ngữ với phần còn lại — không được để 2 style xung đột nhau như hiện tại nữa; nếu giữ tách biệt thì phải là lựa chọn có chủ đích, không phải tàn dư.
3. **Áp checklist né AI slop dưới đây cho từng nhóm màn hình** (danh sách/card khóa học, trang chi tiết khóa học, phòng thi, dashboard học viên, bảng admin) — không làm tất cả cùng lúc, làm từng cụm rồi test.

### Checklist né AI slop (bắt buộc rà từng mục)
**Typography**: heading phải có sức nặng thị giác (size lớn, tracking âm), không all-caps tràn lan, không mồ côi chữ cuối dòng (`text-wrap: balance`), số liệu (điểm số, giá tiền, đếm ngược) dùng tabular-nums.

**Layout**: bỏ pattern "3 card đều hàng ngang" cho phần khóa học nổi bật — thử lệch bậc/masonry/zig-zag. Bỏ bo góc đồng nhất tuyệt đối trên mọi thứ. Card trong cùng 1 hàng (khóa học, bảng giá combo) phải căn hàng CTA/tiêu đề cùng 1 baseline dù nội dung dài ngắn khác nhau. Tăng whitespace, đặc biệt các trang marketing (trang chủ, khóa học, giảng viên).

**Màu/bề mặt**: card không mặc định border + shadow + nền trắng cho mọi trường hợp — chỉ dùng elevation khi thực sự cần phân cấp. Shadow phải nhuốm màu nền (không dùng đen thuần opacity thấp). Không thêm gradient tím-xanh kiểu "AI".

**Tương tác**: mọi nút/link phải có hover + active state rõ ràng (hiện nhiều nơi thiếu). Loading state dùng skeleton đúng hình dạng layout thật, không spinner tròn chung chung. Empty state (đã có vài chỗ tốt như "Chưa có khóa học nào") — rà soát để tất cả các danh sách rỗng đều có empty state được thiết kế, không phải text xám mặc định.

**Nội dung**: giữ nguyên toàn bộ copy tiếng Việt hiện có trừ khi câu chữ đang dùng các cliché kiểu "Trải nghiệm học tập đỉnh cao", "Bứt phá giới hạn" — nếu có thì viết lại ngắn gọn, cụ thể, đúng giọng sản phẩm hiện tại (đã khá tốt, tránh làm màu mè hơn).

**Component đặc thù ed-tech cần thiết kế cẩn thận** (đây là nơi UI "generic AI" lộ rõ nhất): thẻ khóa học trong danh sách, sidebar bài giảng (danh sách chương/bài + trạng thái khoá/mở), giao diện phòng thi (đồng hồ đếm ngược, lưới chọn câu hỏi, progress bar), thẻ huy hiệu/badge vinh danh, timeline lịch sử hoạt động ở hồ sơ học viên.

## Quy trình mong muốn
1. Audit trước: liệt kê cụ thể từng vấn đề tìm thấy theo từng trang, kèm file:line, trước khi sửa bất cứ gì.
2. Sửa theo cụm nhỏ (1 nhóm màn hình/lần), build + test trên browser thật sau mỗi cụm.
3. Không rewrite từ đầu — sửa trên nền hiện có (đúng tinh thần "surgical changes").
4. Báo cáo lại: trước/sau (screenshot nếu có), danh sách thay đổi, xác nhận `tsc --noEmit` sạch và toàn bộ luồng chức năng chính vẫn hoạt động.
