# Audit tiến độ — rà soát bug từng module

Mục tiêu: audit CHỈ TÌM bug, KHÔNG sửa (sửa để review riêng, tránh lẫn 2 việc). Mỗi vòng `/loop` xử lý đúng 1 route trong danh sách "Chưa audit", theo thứ tự từ trên xuống. Test bằng browser thật (Browser pane), không chỉ đọc code — thử đúng luồng người dùng thật (điền form, click, submit...).

Sau mỗi route: đổi trạng thái, liệt kê bug tìm được kèm `file:line`, mức độ (Nghiêm trọng / Trung bình / Nhỏ), mô tả cách tái hiện.

## Đã audit trước đó (không audit lại trừ khi nghi ngờ đã hồi quy)
- [x] `/cong-dong` (+ `[id]`, `/hoi-dap/[id]`) — audit 06/07/2026, tìm bug (đã fix một phần, xem session report)
- [x] `/khoa-hoc` (list + `[slug]`) — audit 06/07/2026
- [x] `/thi-thu` — audit 06/07/2026

## Guest — chưa audit
- [ ] `/chinh-sach`
- [ ] `/diem-chuan`
- [ ] `/tra-cuu`
- [ ] `/dang-nhap`
- [ ] `/dang-ky`
- [ ] `/quen-mat-khau`
- [ ] `/dat-lai-mat-khau`
- [ ] `/xac-thuc-email`
- [ ] `/khoa-hoc-da-luu`
- [ ] `/gio-hang` (redirect — kiểm tra redirect đúng đích)

## Student — chưa audit
- [ ] `/student` (dashboard)
- [ ] `/student/hoc-tap`
- [ ] `/student/bai-giang/[lessonId]`
- [ ] `/student/thi-thu` (+ `[examId]`)
- [ ] `/student/lich-hoc`
- [ ] `/student/ho-so`
- [ ] `/student/bang-xep-hang`
- [ ] `/student/tin-tuc`
- [ ] `/student/cong-dong` (+ `[id]`)
- [ ] `/student/hoi-dap` (+ `[id]`)
- [ ] `/student/tra-cuu`

## Admin — chưa audit
- [ ] Tổng quan
- [ ] Khóa học (danh sách + danh mục + chương/bài)
- [ ] Thi thử (đề thi + ngân hàng câu hỏi)
- [ ] Đánh giá khóa học
- [ ] Bảng vinh danh
- [ ] Tin tức & Blog
- [ ] Cộng đồng (bài viết + báo cáo)
- [ ] Hồ sơ học sinh
- [ ] Lead tư vấn
- [ ] Doanh thu
- [ ] Quản trị viên

---

## Bug tìm được (append theo route, mới nhất lên trên)

### Trang chủ (`/`) — 22/07/2026
Không phát hiện bug. Đã kiểm tra: `useCourses` fetch + skeleton loading state, filter theo danh mục (sidebar desktop, đồng bộ đúng state với pill mobile), search (kể cả empty state "Không tìm thấy..."), toggle giỏ hàng (thêm/xoá qua `/api/cart/[courseId]`, state "Đã thêm" persist đúng), đếm ngược `useCountdown` (không hydration mismatch), link điều hướng sang `/khoa-hoc/[slug]`, không có console error / network request lỗi.
Ghi chú không phải bug (do môi trường test dùng chung dev server đã đăng nhập sẵn tài khoản admin): không kiểm tra được nhánh guest chưa đăng nhập click "Thêm vào giỏ" → redirect `/dang-nhap` ([src/app/page.tsx:319-322](src/app/page.tsx#L319-L322)) bằng browser thật; đã review code, logic có vẻ đúng (`if (!user) router.push("/dang-nhap")`) nhưng nên xác minh lại bằng tài khoản thật chưa đăng nhập ở lượt audit khác.

### `/giang-vien` — 22/07/2026
- **[Trung bình]** [src/lib/teacherData.ts:20,30,40,50,60](src/lib/teacherData.ts#L20) — Toàn bộ 7 link "Khóa học phụ trách" trên thẻ gia sư (`hsa-tron-goi`, `hsa-toan`, `toan-12`, `combo-8-mon`, `hsa-van`, `hcm-tron-goi`, `tsa-bach-khoa`) trỏ tới slug tĩnh không khớp với dữ liệu khóa học thật trong DB (DB hiện chỉ có 1 khóa `midnight-bca---lich-su---anh-thanh`, xem `/api/courses`). Click vào bất kỳ link nào trong số này sẽ ra trang "Không tìm thấy khóa học" ([src/app/(guest)/khoa-hoc/[slug]/page.tsx](<src/app/(guest)/khoa-hoc/[slug]/page.tsx>), xác nhận qua network request `GET /api/courses/hsa-tron-goi → 404`). Không crash (có empty state tử tế) nhưng là dead-end cho 100% người dùng bấm vào — nên gán `courses` trong `teacherData.ts` bằng slug thật từ DB, hoặc ẩn khối "Khóa học phụ trách" khi course không tồn tại.
- Ghi chú không phải bug: brief liệt kê `/giang-vien` kèm `+ [id]` (trang chi tiết gia sư) nhưng route đó không tồn tại trong code hiện tại và không có link nào trỏ tới nó — không gây lỗi vì không được tham chiếu, nhưng khác với mô tả trong REDESIGN_BRIEF.md.
- Dữ liệu bảng "Top học viên nổi bật" có hạng #1 tên "abv" / trường "ádasd" — có vẻ là dữ liệu test còn sót trong DB, không phải lỗi code, nhưng nên dọn trước khi lên production thật.

### `/bang-xep-hang` — 22/07/2026
Không phát hiện bug. Đã kiểm tra: tab "Thi thử" (`/api/leaderboard`, filter theo danh mục qua `?category=`, podium top3, highlight "Bạn" đúng user đang đăng nhập), tab "Vinh danh" (`/api/honor-leaderboard`, sort GPA/Điểm thi/Tiến độ, badge tháng này, empty-state từng badge), loading skeleton, không console error / network error.

### `/tin-tuc` (+ `[slug]`) — 22/07/2026
Không phát hiện bug. Đã kiểm tra: filter theo danh mục (empty state "Không tìm thấy bài viết nào" đúng khi lọc ra danh mục không có bài), trang chi tiết bài viết (breadcrumb, meta, nội dung, view count tăng qua `/api/articles?slug=`), slug không tồn tại → empty state "Không tìm thấy bài viết" đúng (không trắng trang/crash), không console error.

### `/gioi-thieu` — 22/07/2026
Không phát hiện bug. Route này chỉ là `redirect("/")` ([src/app/(guest)/gioi-thieu/page.tsx](<src/app/(guest)/gioi-thieu/page.tsx>)) — không có nội dung riêng, nhưng redirect hoạt động đúng, đã xác nhận `window.location.href` về `/` sau khi điều hướng. Không phải bug, chỉ là route rỗng có chủ đích (hoặc chưa build nội dung).

### `/vinh-danh` — 22/07/2026
- **[Nhỏ]** [src/app/(guest)/vinh-danh/page.tsx:4](<src/app/(guest)/vinh-danh/page.tsx#L4>) — Redirect `"/bang-xep-hang"` không giữ lại ý định của người dùng: vào `/vinh-danh` (kỳ vọng thấy bảng vinh danh) nhưng luôn hạ cánh ở tab mặc định "Thi thử" thay vì tab "Vinh danh Midnight Elite" (tab state khởi tạo cứng `useState<Tab>("thi-thu")` ở [src/app/(guest)/bang-xep-hang/page.tsx:441](<src/app/(guest)/bang-xep-hang/page.tsx#L441>), redirect không truyền query/hash để chọn tab). Tác động thấp vì không có link nội bộ nào trỏ tới `/vinh-danh` (đã grep toàn `src/`), chỉ ảnh hưởng nếu có bookmark/link ngoài cũ còn trỏ tới route này — nhưng route này vẫn phải giữ theo ràng buộc cứng của REDESIGN_BRIEF.md. Có thể sửa bằng redirect sang `/bang-xep-hang?tab=vinh-danh` + đọc query param để set tab ban đầu.

<!-- Vòng loop tiếp theo sẽ thêm mục mới vào đây -->
