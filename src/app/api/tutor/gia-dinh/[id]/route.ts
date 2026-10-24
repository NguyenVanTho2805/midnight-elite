// Sửa / giải tán một gia đình (HS-12). Chỉ gia sư chủ gia đình (gia sư khác 403, không có 404). Giải tán KHÔNG xoá hồ sơ em nào, chỉ gỡ liên kết.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { parseFamily } from "@/lib/familyGroup";

const NO_STORE = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ id: string }> };

async function own(tutorId: string, id: string) {
  const f = await prisma.familyGroup.findUnique({ where: { id }, select: { id: true, tutorId: true } });
  if (!f) return NextResponse.json({ error: "Không tìm thấy gia đình" }, { status: 404 });
  if (f.tutorId !== tutorId) return NextResponse.json({ error: "Gia đình này không thuộc về bạn" }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const bad = await own(auth.userId, id); if (bad) return bad;
  const p = parseFamily(await req.json().catch(() => null) as Record<string, unknown> | null, true);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  if (!Object.keys(p.data).length) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  await prisma.familyGroup.update({ where: { id }, data: p.data });
  await logAction(auth.userId, "family_group.update", "FamilyGroup", id, { fields: Object.keys(p.data) });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const bad = await own(auth.userId, id); if (bad) return bad;
  await prisma.$transaction(async tx => {
    await tx.studentProfile.updateMany({ where: { familyId: id, tutorId: auth.userId }, data: { familyId: null } });
    await tx.familyGroup.delete({ where: { id } });
  });
  await logAction(auth.userId, "family_group.delete", "FamilyGroup", id, {});
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
