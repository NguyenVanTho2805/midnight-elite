// BE-064/065 (1.4.6) — mã mời lớp.
//   POST /api/courses/[id]/invites — gia sư tạo mã mời
//     Body { ensure: true } (BU-01, "Cách học sinh vào lớp"): đảm bảo lớp có ĐÚNG MỘT mã lớp dài hạn (không giới hạn lượt, không hết hạn, chưa thu hồi) —
//     đã có thì trả lại mã đó (200, existing: true), chưa có mới tạo (201). Gọi hai lần không sinh hai mã (khoá tư vấn theo lớp trong giao dịch).
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
import { assertCanAddStudent, tutorLimitMessage } from "@/lib/planServer";
import { PLAN_LIMIT_CODE } from "@/lib/planLimits";

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) {
    return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  }
  return { auth, ownerId: course.ownerId };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!;

  let body: { maxUses?: unknown; expiresAt?: unknown; ensure?: unknown } = {};
  try { body = await req.json(); } catch { /* không bắt buộc có body */ }
  const ensure = body.ensure === true;

  if (ensure) return ensureClassCode(id, auth.userId, r.ownerId ?? null);

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

  // KiN Pro: hạn mức học viên đang học (cổng TẮT mặc định). Mã có giới hạn lượt N cần đủ N chỗ (đúng "Mời cả lớp": số lượt = số em đã dán);
  // mã không giới hạn lượt cần ít nhất 1 chỗ. Chỉ chặn TẠO MỚI mã; mã cũ, lớp và học viên hiện có giữ nguyên.
  // Chủ gói là gia sư sở hữu lớp, kể cả khi quản trị tạo hộ.
  const add = maxUses ?? 1;
  const gate = await assertCanAddStudent(r.ownerId ?? null, { feature: add > 1 ? "invite_many" : "invite", add });
  if (!gate.allow) {
    return NextResponse.json({ error: tutorLimitMessage(gate, add), code: PLAN_LIMIT_CODE, quota: gate.decision?.quota }, { status: 409 });
  }

  // Thử sinh code vài lần nếu đụng unique (xác suất tối thiểu nhưng không
  // phải 0 ở >~1 triệu mã còn hiệu lực).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const inv = await invites().create({
        // BU-01: luôn là mã LỚP; `kind`/`boundUserId` trong body bị bỏ qua (mã cá nhân chỉ do POST /api/courses/[id]/join cấp).
        data: { courseId: id, code, maxUses, expiresAt, createdBy: auth.userId, kind: "class", boundUserId: null },
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
    // BU-01: chỉ mã lớp — mã cá nhân của học sinh (kèm boundUserId) không lẫn vào danh sách của gia sư.
    where:   { courseId: id, kind: "class" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items: list });
}

/** Mã lớp dài hạn của lớp (không giới hạn lượt, không hết hạn, chưa thu hồi) — "mã lớp" gia sư thấy ở khối Cách học sinh vào lớp. */
async function ensureClassCode(courseId: string, userId: string, ownerId: string | null) {
  const permanent = { courseId, kind: "class", revoked: false, maxUses: null, expiresAt: null };
  const found = await prisma.classInvite.findFirst({ where: permanent, orderBy: { createdAt: "asc" } });
  if (found) return NextResponse.json({ ...found, existing: true });
  const gate = await assertCanAddStudent(ownerId, { feature: "invite", add: 1 });
  if (!gate.allow) {
    return NextResponse.json({ error: tutorLimitMessage(gate, 1), code: PLAN_LIMIT_CODE, quota: gate.decision?.quota }, { status: 409 });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const out = await prisma.$transaction(async tx => {
        // Khoá tư vấn theo lớp: hai lần gọi cùng lúc xếp hàng, lần sau thấy mã của lần trước.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"class_code:" + courseId}))`;
        const again = await tx.classInvite.findFirst({ where: permanent, orderBy: { createdAt: "asc" } });
        if (again) return { inv: again, existing: true };
        const inv = await tx.classInvite.create({ data: { courseId, code, maxUses: null, expiresAt: null, createdBy: userId, kind: "class", boundUserId: null } });
        return { inv, existing: false };
      });
      if (!out.existing) await logAction(userId, "class_invite.create", "ClassInvite", out.inv.id, { courseId, code: out.inv.code, maxUses: null, expiresAt: null, ensure: true });
      return NextResponse.json({ ...out.inv, existing: out.existing }, { status: out.existing ? 200 : 201 });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") continue;
      console.error("[POST /api/courses/[id]/invites ensure]", e);
      return NextResponse.json({ error: "Tạo mã lớp thất bại" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Không sinh được mã lớp (thử lại sau)" }, { status: 503 });
}
