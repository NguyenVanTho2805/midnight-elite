Audit đúng 1 route/module của dự án Midnight Elite để tìm bug — KHÔNG sửa code trong lượt này.

Quy trình:

1. Mở [AUDIT_PROGRESS.md](../../AUDIT_PROGRESS.md), tìm mục đầu tiên còn `[ ]` (theo thứ tự Guest → Student → Admin). Nếu tất cả đã `[x]`, báo cáo "Đã audit hết toàn bộ module" và dừng — không làm gì thêm.

2. Xác định file route tương ứng trong `src/app/(guest)|(student)|(admin)/...` (dùng Grep/Glob để tìm chính xác, đừng đoán path).

3. Đọc code của route đó: component chính, các hook/API nó gọi (`src/lib/**`, `src/app/api/**` liên quan), state logic. Ghi chú nghi vấn (edge case thiếu, race condition, lỗi validate, v.v).

4. Mở app thật bằng Browser pane (preview_start nếu dev server chưa chạy) và thử luồng người dùng thật của route này:
   - Với form: điền dữ liệu hợp lệ VÀ không hợp lệ, submit, xem lỗi hiển thị đúng không.
   - Với danh sách: filter, search, phân trang, empty state.
   - Với modal/drawer: mở, đóng, huỷ giữa chừng.
   - Với luồng có nhiều bước (vd thi thử, thanh toán): đi hết luồng.
   - Kiểm tra console errors (read_console_messages) và network requests lỗi (read_network_requests).

5. Với mỗi bug tìm được, ghi rõ: `file:line`, mô tả cách tái hiện, mức độ (Nghiêm trọng/Trung bình/Nhỏ). Không cần fix — chỉ audit.

6. Cập nhật [AUDIT_PROGRESS.md](../../AUDIT_PROGRESS.md):
   - Tick `[x]` cho route vừa audit.
   - Thêm phần bug tìm được vào cuối file, dưới mục "Bug tìm được", theo format:
     ```
     ### <tên route> — <ngày>
     - **[Mức độ]** `file:line` — mô tả bug, cách tái hiện
     ```
   - Nếu không tìm thấy bug nào, ghi "Không phát hiện bug" thay vì bỏ trống.

7. Dừng lại sau khi xong đúng 1 route — không tự động sang route tiếp theo trong cùng lượt chạy này. Báo cáo ngắn gọn cho user: route nào vừa audit, tìm được bao nhiêu bug, mức độ nghiêm trọng nhất.

Ràng buộc: đây là audit thuần, tuyệt đối không sửa file code (trừ chính [AUDIT_PROGRESS.md](../../AUDIT_PROGRESS.md)).
