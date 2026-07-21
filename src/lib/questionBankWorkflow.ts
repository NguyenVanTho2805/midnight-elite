import type { AdminRole } from "@/lib/permissions";

// Giai đoạn 6 — quy trình duyệt. admin_content/admin_super đã có toàn quyền
// sửa/xoá bất kỳ câu nào trong ngân hàng (xem ownsResource() ở auth-guard.ts)
// nên không cần tự duyệt bài của chính mình — tạo/sửa của họ luôn "approved"
// ngay. "teacher" phải qua "draft" → gửi duyệt → "pending" → admin duyệt.
export function initialStatusFor(adminRole: AdminRole | undefined | null): "draft" | "approved" {
  return adminRole === "teacher" ? "draft" : "approved";
}

// true nếu session này được phép duyệt/từ chối câu của người khác (không
// tính chủ sở hữu — admin_content/admin_super review ai cũng được, kể cả bài
// của chính mình dù hiếm khi cần vì tạo/sửa của họ đã tự approved).
export function isReviewer(adminRole: AdminRole | undefined | null): boolean {
  return adminRole !== "teacher";
}
