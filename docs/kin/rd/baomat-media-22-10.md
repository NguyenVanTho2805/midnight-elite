# Bảo mật và dữ liệu học liệu: 5 lỗi đã sửa (đợt 22/10)

Nhánh `claude/wt-fbaomat2` (gốc `claude/wt-fbaomat1`). Phạm vi: chỉ API, thư viện thuần và nội dung trang; không đụng vỏ gia sư/học sinh, không đụng token, không đổi tiền hay dữ liệu trẻ em. Schema chỉ THÊM một cột nullable.

## MD-03 · API trả link học liệu cho người chưa ghi danh
- **Lỗi.** `GET /api/courses/[id]` và các route bài học trả `videoUrl`, `zoomUrl`, `azotaUrl`, `documents` (và `adminNote`) cho cả khách và học sinh chưa ghi danh.
- **Sửa.** `src/lib/mediaAccess.ts` (hàm thuần, một nơi duy nhất): được xem link khi là quản trị, gia sư CHỦ lớp (`ownerId`; lớp người khác hoặc lớp không chủ thì khoá), học viên có ghi danh `status = active`, hoặc bài `isFree`. Người khác nhận `null` (link) và `"[]"` (tài liệu); khung bài vẫn hiện. Áp ở `api/courses/[id]`, `api/lessons/[id]`, `api/lessons/[id]/context`, trang bài giảng học sinh. Tạm ngưng và chờ đồng ý không được coi là đang học.
- **Kiểm.** `t-media-access-lib.ts` (30 ca, gồm gia sư lạ, enrollment suspended, `isFree`, không sửa đối tượng gốc); `t-media-security.ts` gọi API thật với khách, chưa ghi danh, đã ghi danh, gia sư chủ, gia sư lạ, quản trị.

## MD-09 · `/xem-tai-lieu` nhận URL bất kỳ (nguy cơ proxy mở / SSRF)
- **Lỗi.** `?url=` được đưa thẳng vào iframe, nút Tải xuống (`javascript:`) và Office Viewer (tải địa chỉ tuỳ ý).
- **Sửa.** `src/lib/viewerUrl.ts` cho phép đúng ba nguồn: đường dẫn nội bộ một dấu `/` (cấm `//host`), `https://res.cloudinary.com/<cloud của KiN>/…` (chưa cấu hình tên kho thì đóng hoàn toàn), và link Google Docs/Sheets/Slides/Drive đúng dạng. Cấm: scheme khác https, tài khoản/mật khẩu/cổng trong URL, ký tự điều khiển, khoảng trắng, gạch ngược, độ dài hơn 2048. Bị từ chối thì trang hiện thông báo tiếng Việt, không có iframe, không có nút Tải xuống, không gọi Office Viewer.
- **Kiểm.** `t-viewer-url-lib.ts` (23 ca, gồm `javascript:`, `data:`, `//evil`, `\\`, `https://res.cloudinary.com.evil.com`, kho Cloudinary của người khác, đầu vào không phải chuỗi); `ui-baomat.ts` kiểm trang thật ở 1280px.

## QZ-14 · mật khẩu vào thi lưu chuỗi thô
- **Lỗi.** `Exam.password` lưu nguyên văn và có đường để lộ qua API.
- **Sửa.** Schema thêm `Exam.passwordHash String?` (nullable, không `@unique`). `src/lib/examPassword.ts`: bcrypt trên sha256 của mật khẩu (tránh bị cắt ở 72 byte). Đặt hoặc đặt lại mật khẩu chỉ ghi `passwordHash` và xoá `password`. Đề cũ còn bản thô vẫn vào thi được (so khớp thời gian không đổi) và TỰ NÂNG LÊN băm khi một học viên nhập đúng, hoặc khi gia sư đặt lại; sai mật khẩu không làm nâng cấp. Sửa đề mà không gửi `password` thì giữ nguyên; gửi chuỗi rỗng là bỏ mật khẩu. API GET chỉ trả `hasPassword: boolean`, không bao giờ trả `password` hay `passwordHash` (`withoutExamSecrets`). Mật khẩu kiểu số/mảng/đối tượng bị từ chối 403, không 500; mật khẩu qua query string không có tác dụng.
- **Kiểm.** `t-exam-password-lib.ts` (22 ca); `t-media-security.ts` gồm đề cũ thô, nâng cấp, đặt lại, bỏ, gia sư lạ, học viên không được đặt mật khẩu, phản hồi vào thi không chứa mật khẩu/băm.

## Lỗi href Azota khi bài có hai link
- **Lỗi.** Bài có nhiều link Azota lưu chuỗi JSON của mảng (`["https://a","https://b"]`); chuỗi đó bị dùng thẳng làm `href`, ra liên kết hỏng.
- **Sửa.** `src/lib/lessonLinks.ts`: `parseLinkList` tách danh sách (bỏ ô trống, trùng), `httpLinks` chỉ giữ http/https (loại `javascript:`, `data:`), `firstHttpLink` cho nơi cần một link. Trang bài giảng học sinh hiện mỗi link một nút (có đánh số khi nhiều hơn một); `/api/deadlines` và lịch trả MỘT link http.
- **Kiểm.** `t-azota-lib.ts` (28 ca, gồm chuỗi bắt đầu bằng `[` nhưng không phải JSON, phần tử không phải chuỗi, link độc); `ui-baomat.ts` kiểm tab Bài tập hai nút đúng href, một link, và ca phá `javascript:` hiện "Chưa có link bài".

## MD-16 · hạn Azota không vào lịch và Việc của tôi
- **Lỗi.** Ô nhập là `datetime-local` nên hạn có dạng `2026-10-25T20:00`, nhưng `toISO()` chỉ nhận `YYYY-MM-DD` hoặc `DD/MM/YYYY`, trả null: hạn biến mất khỏi lịch. `/api/deadlines` thì dùng `new Date(...)` nên lệch theo múi giờ máy chủ.
- **Sửa.** `src/lib/azotaDeadline.ts`: `parseAzotaDeadline` đọc `YYYY-MM-DD[THH:mm]`, `DD/MM/YYYY [HH:mm]`, cả dạng có múi giờ (`Z`, `+07:00`, đổi sang giờ Việt Nam). Chuỗi không múi giờ = giờ Việt Nam. Chỉ có ngày thì là 23:59. Dùng hàm sẵn có của `classSessions` (`instantOf`, `vnDateKeyOf`, `vnMinutesOfDay`). `calendarDaysLeft` đếm ngày lịch giờ VN. Hạn không đọc được thì bỏ khỏi danh sách, không đoán và không làm hỏng danh sách. Áp ở `src/lib/studentSchedule.ts` (lịch) và `api/deadlines`.
- **Kiểm.** `t-azota-lib.ts`; `t-media-security.ts`: hạn vào lịch đúng ngày và giờ VN (20:00, không còn 23:59), hạn 07:30 không lùi ngày, hạn rác bị bỏ mà API vẫn 200, hạn đã qua bị lọc, học viên chưa ghi danh hoặc chưa đăng nhập không thấy hạn.

## Kết quả chạy (thật, trong worktree fbaomat2)
`t-azota-lib` 28/0 · `t-exam-password-lib` 22/0 · `t-media-access-lib` 30/0 · `t-viewer-url-lib` 23/0 · `t-media-security` (API) 81/0 · `ui-baomat` 22/0 · `t-no-hex` 17/0 · `t-no-fabricated` 37/0 · `t-links` 10/0 · `tsc --noEmit` 0 lỗi. ESLint: trang bài giảng học sinh có 8 lỗi `react-hooks` đã có sẵn từ trước (đếm cùng 8 trước và sau khi sửa), không thêm lỗi mới.

## Khi gộp
- Schema đổi: thêm cột `Exam.passwordHash`; cần `prisma db push` trên mọi môi trường trước khi chạy mã mới. Dữ liệu cũ không cần chuyển đổi.
- Tệp dùng chung dễ xung đột: `prisma/schema.prisma` (model `Exam`), `src/lib/studentSchedule.ts`, `src/app/(student)/student/bai-giang/[lessonId]/page.tsx` (vỏ bài giảng có thể được nhánh khác sửa).
- Ngoài phạm vi, còn lại: MD-08 (tải tệp lên), phần trình xem đầy đủ của MD-09; không đụng tiền hay dữ liệu trẻ em.
