// CAT-02 (4.2) — ẩn/hiện, đổi danh mục hàng loạt. Một giao dịch; hoàn tác = gọi lại với `prev`. Không đụng giá.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { planBulk, normalizeBulkIds, type BulkAction } from "@/lib/courseCatalogAdmin";

export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return bad("Yêu cầu không hợp lệ"); }
    if (!body || typeof body !== "object") return bad("Yêu cầu không hợp lệ");

    const norm = normalizeBulkIds(body.ids);
    if (!norm.ok) return bad(norm.error);
    let act: BulkAction;
    if (body.action === "set_status") {
      if (typeof body.status !== "boolean") return bad("Trạng thái hiển thị không hợp lệ");
      act = { action: "set_status", status: body.status };
    } else if (body.action === "set_category") {
      if (auth.adminRole === "teacher") return bad("Chỉ quản trị viên được đổi danh mục hàng loạt", 403);
      const c = typeof body.category === "string" ? body.category.trim() : "";
      if (!c || [...c].length > 60) return bad("Tên danh mục không hợp lệ");
      act = { action: "set_category", category: c };
    } else {
      return bad("Thao tác hàng loạt không hợp lệ");
    }

    if (act.action === "set_category") {
      const [row, used] = await Promise.all([
        prisma.courseCategory.findUnique({ where: { name: act.category }, select: { id: true } }),
        prisma.course.count({ where: { category: act.category } }),
      ]);
      if (!row && used === 0) return bad("Danh mục này chưa có — hãy tạo danh mục trước", 422);
    }

    const result = await prisma.$transaction(async tx => {
      const found = await tx.course.findMany({ where: { id: { in: norm.ids } }, select: { id: true, ownerId: true, status: true, category: true } });
      const plan = planBulk(norm.ids, found, act, { adminRole: auth.adminRole, userId: auth.userId });
      if (!plan.ok) return plan;
      for (const u of plan.updated) {
        await tx.course.update({ where: { id: u.id }, data: act.action === "set_status" ? { status: act.status } : { category: act.category } });
      }
      return plan;
    });
    if (!result.ok) return bad(result.error, result.status);

    if (result.updated.length) {
      await logAction(auth.userId, "course.bulk_update", "Course", "bulk", {
        op: act.action, count: result.updated.length, ids: result.updated.map(u => u.id).slice(0, 100),
        to: act.action === "set_status" ? act.status : act.category, ...(body.undo === true ? { undo: true } : {}),
      });
    }
    return NextResponse.json({ updated: result.updated, skipped: result.skipped });
  } catch (e) {
    console.error("[admin/khoa-hoc/bulk]", e);
    return bad("Lỗi server", 500);
  }
}
