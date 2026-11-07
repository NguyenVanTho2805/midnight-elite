# ADM-xoa-tk-len-gia-su — Xoá (ẩn danh hoá) tài khoản + chuyển học sinh thành gia sư

Trạng thái: đặc tả, quyết định A–F đã chốt bởi chủ. Cờ: TIỀN (chặn khi còn tiền), TRẺ EM (xoá PII), ĐỔI NỀN (không).

## 1. Vấn đề
- `/admin/hoc-sinh` chỉ "Ẩn học sinh" (ADM-001: deletedAt+banned, giữ email, nên không đăng ký lại được) + Khôi phục. Không có cách xoá thật PII.
- `/admin/gia-su` chỉ có lịch sử đơn; gia sư đã duyệt không xoá/khoá được.
- Đổi vai chỉ có `PUT /api/users/[id]/role` (admin/student, quyền MANAGE_ADMINS, không bước giữ dữ liệu). `api/auth/register-tutor` chỉ tạo TK mới, email có rồi trả 409. Học sinh muốn dạy phải lập TK thứ hai.

## 2. Phạm vi tệp (adm-code / adm-dev, không trùng)
- adm-code (logic + API): `src/lib/permissions.ts` (thêm quyền), `src/lib/account-delete.ts` (mới: hàm ẩn danh hoá + kiểm tra chặn), `src/app/api/admin/students/[id]/xoa-tai-khoan/route.ts`, `.../students/[id]/len-gia-su/route.ts`, `src/app/api/admin/tutors/[id]/xoa-tai-khoan/route.ts`, sửa nhánh khôi phục trong route ẩn học sinh (409 account_deleted), lọc danh sách (học sinh, đơn gia sư) bỏ email bắt đầu `deleted+`.
- adm-dev (giao diện): `src/app/admin/hoc-sinh/**` (panel), `src/app/admin/gia-su/**` (tab Đã duyệt), test ui-*.
- Test API/đơn vị: adm-code.

## 3. Schema
Không (chỉ cập nhật cột sẵn có).

## 4. Hợp đồng API
Quyền mới `DELETE_ACCOUNTS` trong permissions.ts: chỉ admin_super (admin_super đã lấy `Object.values` nên tự có; admin_content/teacher liệt kê tay, không thêm).

| Route | Quyền | Vào | Ra thành công |
|---|---|---|---|
| POST /api/admin/students/[id]/xoa-tai-khoan | DELETE_ACCOUNTS | không | 200 `{ok:true}`; đã xoá rồi: 200 `{ok:true,alreadyDeleted:true}` |
| POST /api/admin/tutors/[id]/xoa-tai-khoan | DELETE_ACCOUNTS | không | như trên |
| POST /api/admin/students/[id]/len-gia-su | requireCenterAdmin (admin_super + admin_content) | `{subjects:string[] 1..10, mỗi ≤60 ký tự; bio?:≤1000}` | 200 `{ok:true, activeEnrollments:n}` |

Mã lỗi chung: 401 khách; 403 thiếu quyền; 404 không có người dùng; 400 body sai.
- Xoá học sinh: 403 `not_student` nếu role != student.
- Xoá gia sư: chỉ role admin + adminRole teacher, nếu không 403 `not_tutor` (không xoá admin_content/admin_super qua đường này); 400 `self` (tự xoá mình); 409/400 `last_super` (không xoá admin_super cuối cùng).
- 409 chặn, luôn kèm `code` + câu tiếng Việt nói rõ việc cần làm:
  - `active_enrollments` (học sinh còn ghi danh active).
  - `owned_courses_active` (gia sư: lớp còn học sinh active, hoặc lớp công khai status=true mà classStatus != "closed"; hướng dẫn đóng lớp trước).
  - `open_invoices` (TuitionInvoice draft/sent/parent_reported/partial, vai học sinh hoặc gia sư).
  - `uninvoiced_fees` (FeeCharge amount>0 chưa có invoiceId).
  - `active_packages` (SessionPackage active, học sinh).
  - `pending_money` (CoinTopupRequest pending hoặc ProOrder pending).
  - `wallet_from_money` (ví > 0 VÀ từng có CoinTopupRequest approved). Coin thưởng không chặn: Coin chỉ là điểm thưởng.
  - `active_subscription` (TutorSubscription active).
- Len-gia-su 409/403: `not_student`(403), `hidden`/`deleted`, `banned`, `email_unverified`, `underage` (có dateOfBirth và <18 tuổi), `already_tutor`.

Hiệu ứng ẩn danh hoá (một giao dịch DB): deletedAt=now, banned=true; email=`deleted+<id>@invalid` (giải phóng email cũ, nhận biết bằng tiền tố `deleted+`); name="Tài khoản đã xóa"; xoá phone, phoneE164, phoneVerifiedAt, dateOfBirth, parentPhone, parentName, school, highSchool, city, avatarBase64, facebookUrl, zaloPhone, bio; subjects=[], preferences rỗng; password=chuỗi ngẫu nhiên không phải bcrypt. Xoá PushSubscription, VerifyToken, PasswordResetToken. Gia sư: xoá TutorPayoutAccount, tutorVerified=false, profileLockedAt=now. GIỮ mọi bản ghi con khác (ghi danh, điểm danh, ví, bài làm, phiếu thu, dòng phí, Coin). Tuyệt đối không sửa số tiền, phiếu, học phí, số dư ví. Không hoàn tác: khôi phục từ "Ẩn" với TK đã ẩn danh bị 409 `account_deleted`.

Len-gia-su: như tutor-applications approve (role=admin, adminRole=teacher, tutorVerified/At/By) nhưng không cần đơn trước: tutorAppliedAt = cũ ?? now, xoá tutorRejectedAt/Reason, lưu subjects/bio. Ghi danh KHÔNG đổi. Người đó phải đăng nhập lại để có quyền mới. Thông báo type `tutor_approved` (chỉ chữ, không tên/số tiền).

## 5. Luồng màn
- `/admin/hoc-sinh` panel bên (không hộp thoại mới, ≤2 nút/hàng, nút ≥44px ở 390px):
  - "Chuyển thành gia sư": nhập ≥1 môn (chip), bio tuỳ chọn; xác nhận trong panel nêu: lớp đang học vẫn giữ, không còn vào vỏ học sinh, cần đăng nhập lại. Có lớp active: chỉ cảnh báo, không chặn.
  - "Xoá tài khoản": xác nhận 2 bước ngay trong panel, gõ `XOA`, nêu rõ không hoàn tác và giữ chứng từ tiền. Lỗi 409 hiện câu tiếng Việt + mã.
- `/admin/gia-su` tab Đã duyệt: "Xoá tài khoản" cùng cách.
- Nút chỉ hiện khi có quyền (DELETE_ACCOUNTS cho xoá; admin_super/admin_content cho chuyển vai).
- Trạng thái: đang gửi (nút khoá + nhãn), lỗi (dòng đỏ trong panel, giữ dữ liệu đã nhập), thành công (panel đóng, hàng biến khỏi danh sách; danh sách rỗng có câu trống). Danh sách mặc định không liệt kê TK `deleted+`.
- Figma: không cấp, bỏ qua.

## 6. Máy trạng thái
Học sinh/gia sư hoạt động -> (ẩn, ADM-001) -> ẩn <-> khôi phục. Hoạt động hoặc ẩn -> ẩn danh hoá (cuối, một chiều). Học sinh -> gia sư (một chiều trong đặc tả này). Không có duyệt nhiều bước.

## 7. Nhật ký kiểm toán
- `account.delete`: metadata chỉ số đếm/cờ (kind student|tutor, số lớp, số phiếu, số ghi danh...). Không tên/email/SĐT. Ghi sau khi DB thành công; không ghi khi đã xoá rồi hoặc khi lỗi.
- `student.promote_tutor`: `{activeEnrollments, hadApplication}`.

## 8. Test phải có
- Leo quyền: teacher/student/admin_content gọi 2 route xoá -> 403; teacher/student gọi len-gia-su -> 403; khách -> 401. (Ca phá: admin_content có MANAGE_TUTORS vẫn bị 403 xoá.)
- Xoá rồi đăng ký lại cùng email -> thành công; hàng cũ giữ id, email `deleted+...`.
- Xoá không đổi số dư ví, tổng phiếu, dòng phí, ghi danh (so snapshot trước/sau). Ca phá: ví Coin thưởng > 0 vẫn xoá được; ví từ nạp tiền > 0 bị chặn.
- PII đã xoá hết; password không khớp bcrypt; token/push bị xoá; TutorPayoutAccount bị xoá.
- Từng mã 409: active_enrollments, owned_courses_active (cả hai nhánh), open_invoices (4 trạng thái, 2 vai), uninvoiced_fees, active_packages, pending_money (2 loại), wallet_from_money, active_subscription. Cộng not_tutor, self, last_super, 404, alreadyDeleted 200 không ghi audit.
- Khôi phục TK đã ẩn danh -> 409 account_deleted.
- Chuyển vai: học sinh có lớp active vẫn giữ ghi danh; từng mã chặn (hidden, deleted, banned, email_unverified, underage biên 18 tuổi, already_tutor); không cần đơn trước; bio/subjects lưu.
- Audit không chứa PII (quét metadata).
- ui-*: panel học sinh và gia sư ở 390 và 1280 (nút ≥44px, không tràn ngang, xác nhận XOA, trạng thái lỗi/rỗng).

## 9. Cờ và câu hỏi cho chủ
- TIỀN: chỉ chặn và đọc, không đổi số tiền. TRẺ EM: xoá PII học sinh, giữ chứng từ; cần chủ xác nhận thời hạn lưu chứng từ theo luật.
- Hỏi chủ: (a) học sinh tự xoá TK (không làm ở đây); (b) gia sư -> học sinh: hiện chỉ có PUT /api/users/[id]/role (chỉ MANAGE_ADMINS, thiếu bước giữ dữ liệu/ghi audit), chưa làm mới; (c) hiện không có cách "gỡ học sinh khỏi lớp" riêng trong đặc tả này.

## 10. Tệp chung cần xin COO
`src/lib/permissions.ts` (thêm `DELETE_ACCOUNTS`). Có thể thêm hằng mã audit nếu có danh sách chung.

## Đối chiếu Azota (chỉ đọc, đã mở thật)
Nguồn: https://docs.azota.vn/docs/huong-dan-su-dung/ (mục lục), .../phan-quyen/, .../danh-sach-lop/, .../danh-sach-lop/xoa-hoc-sinh/, .../danh-sach-lop/xoa-hoc-sinh-tqb/, .../dang-ky-dang-nhap/xoa-tai-khoan/. Tham khảo ngoài NN/g không cần thêm.
- Họ làm gì: (1) Gỡ học sinh khỏi lớp = "Quản lý lớp > Danh sách học sinh > cột Hành động > Xóa học sinh > Xác nhận"; trang không nói dữ liệu/điểm có giữ không. (2) Xoá tài khoản: chỉ trên App, avatar > Xóa tài khoản > (nhập lý do) > xác nhận; "tài khoản của bạn và các dữ liệu trong tài khoản sẽ không thể khôi phục lại" (xoá vĩnh viễn, tự phục vụ). Trang không nêu điều kiện chặn, thời gian chờ, hay xuất dữ liệu. (3) Phân quyền: là chia sẻ quyền giữa giáo viên theo thư mục/lớp/khoá/đề; trang đã mở chỉ là tổng quan.
- Không tìm thấy: tài liệu công khai về chuyển vai học sinh -> giáo viên, hay về giữ chứng từ tài chính khi xoá. Không suy diễn.
- Khác KiN: Azota để người dùng tự xoá vĩnh viễn, không đối chiếu tiền/phiếu; KiN do quản trị thực hiện, ẩn danh hoá, giữ chứng từ, có chặn khi còn tiền.
- Nên áp dụng: tách "gỡ khỏi lớp" khỏi "xoá tài khoản" (KiN đã có qua ghi danh); xác nhận rõ không hoàn tác; xin lý do (nên cân nhắc thêm lý do tuỳ chọn, hiện chưa chốt). Không áp dụng: xoá vĩnh viễn và tự xoá không điều kiện (không hợp ví/phiếu/trẻ em).
