import { NextResponse } from "next/server";
import { getSessionChecked, type SessionPayload } from "./session";
import { checkPermission, type Permission } from "./permissions";

// NC2-033: tài khoản bị khoá → 403 (có chữ rõ); đã bị xoá / phiên quản trị quá hạn theo vai DB → 401. Chỉ áp cho yêu cầu ghi (xem getSessionChecked).
const BANNED_MSG = "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ.";

export async function requirePermission(permission: Permission): Promise<SessionPayload | NextResponse> {
  const { session, denied } = await getSessionChecked();
  if (denied === "banned") return NextResponse.json({ error: BANNED_MSG }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  if (!checkPermission(session.adminRole, permission)) {
    return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
  }
  return session;
}

// true nếu session được phép thao tác trên 1 tài nguyên có chủ sở hữu
// (Course.ownerId / Exam.ownerId): admin_super, admin_content luôn được;
// "teacher" chỉ được với tài nguyên do chính mình tạo (ownerId === userId).
// ownerId = null (nội dung cũ/của trung tâm) → teacher KHÔNG được sửa.
export function ownsResource(session: SessionPayload, ownerId: string | null): boolean {
  if (session.adminRole !== "teacher") return true;
  return ownerId === session.userId;
}

// Kết hợp requirePermission + kiểm tra sở hữu trong 1 lần gọi — dùng ở các
// route sửa/xoá 1 tài nguyên cụ thể đã biết ownerId (vd sau khi findUnique).
export async function requireOwnedResource(
  permission: Permission,
  ownerId: string | null,
): Promise<SessionPayload | NextResponse> {
  const auth = await requirePermission(permission);
  if (isNextResponse(auth)) return auth;
  if (!ownsResource(auth, ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với nội dung này" }, { status: 403 });
  }
  return auth;
}

// Where-clause bổ sung cho các query findMany danh sách — teacher chỉ thấy
// nội dung của mình, admin_super/admin_content thấy tất cả (where rỗng).
export function ownerScopeWhere(session: SessionPayload): { ownerId?: string } {
  return session.adminRole === "teacher" ? { ownerId: session.userId } : {};
}

export function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export async function requireSession(): Promise<SessionPayload | NextResponse> {
  const { session, denied } = await getSessionChecked();
  if (denied === "banned") return NextResponse.json({ error: BANNED_MSG }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
  return session;
}
