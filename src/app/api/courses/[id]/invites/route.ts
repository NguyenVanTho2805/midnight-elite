// BE-064/065 (1.4.6) — mã mời lớp.
//   POST /api/courses/[id]/invites — gia sư tạo mã mời
//   GET  /api/courses/[id]/invites — xem danh sách mã mời của lớp
//
// Scope: `ownsResource` → gia sư chỉ thấy/tạo mã mời cho LỚP CỦA MÌNH;
// admin_super/admin_content thấy mọi lớp.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { generateInviteCode, invites } from "@/lib/classInvite";
import { logAction } from "@/lib/auditLog";

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) {
    return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  }
  return { auth };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!;

  let body: { maxUses?: unknown; expiresAt?: unknown } = {};
  try { body = await req.json(); } catch { /* không bắt buộc có body */ }

  // Validate maxUses: null | số nguyên dương
  let maxUses: number | null = null;
  if (body.maxUses !== undefined && body.maxUses !== null) {
    if (typeof body.maxUses !== "number" || !Number.isInteger(body.maxUses) || body.maxUses <= 0) {
      return NextResponse.json({ error: "maxUses phải là số nguyên dương hoặc null" }, { status: 400 });
    }
    maxUses = body.maxUses;
  }
  // Validate expiresAt: null | ISO string trong tương lai
  let expiresAt: Date | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    if (typeof body.expiresAt !== "string") {
      return NextResponse.json({ error: "expiresAt phải là ISO string" }, { status: 400 });
    }
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "expiresAt không hợp lệ" }, { status: 400 });
    if (d.getTime() <= Date.now()) {
      return NextResponse.json({ error: "expiresAt phải ở tương lai" }, { status: 400 });
    }
    expiresAt = d;
  }

  // Thử sinh code vài lần nếu đụng unique (xác suất tối thiểu nhưng không
  // phải 0 ở >~1 triệu mã còn hiệu lực).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const inv = await invites().create({
        data: { courseId: id, code, maxUses, expiresAt, createdBy: auth.userId },
      });
      await logAction(auth.userId, "class_invite.create", "ClassInvite", inv.id, {
        courseId: id, code, maxUses, expiresAt,
      });
      return NextResponse.json(inv, { status: 201 });
    } catch (e: unknown) {
      // P2002 = unique violation trên `code`
      if ((e as { code?: string })?.code === "P2002") continue;
      console.error("[POST /api/courses/[id]/invites]", e);
      return NextResponse.json({ error: "Tạo mã mời thất bại" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Không sinh được mã mời (thử lại sau)" }, { status: 503 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;

  const list = await invites().findMany({
    where:   { courseId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items: list });
}
