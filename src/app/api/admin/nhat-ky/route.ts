// QT-02 — trang ĐỌC nhật ký kiểm toán (AuditLog). Chỉ đọc, chỉ quyền MANAGE_ADMINS (quản trị cấp 1).
// Không trả `metadata` và không trả tên/SĐT/ngày sinh của học sinh: người thực hiện là học sinh/phụ huynh chỉ hiện vai (xem src/lib/adminOps.ts).
import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseAuditFilter } from "@/lib/adminOps";
import { loadAuditPage } from "@/lib/adminOpsServer";

export async function GET(req: Request) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_ADMINS);
  if (isNextResponse(auth)) return auth;
  try {
    const f = parseAuditFilter(new URL(req.url).searchParams);
    const r = await loadAuditPage(f);
    return NextResponse.json({ ...r, filter: f }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/nhat-ky]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
