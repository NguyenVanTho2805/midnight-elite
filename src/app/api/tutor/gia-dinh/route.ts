// HS-12 — Hồ sơ gia đình dùng chung LIÊN HỆ cho anh chị em. KHÔNG gộp phiếu học phí theo gia đình (việc đó thuộc phần học phí, chưa làm).
// GET danh sách gia đình của gia sư · POST tạo gia đình (nhãn + liên hệ phụ huynh chung). Gắn một em vào gia đình làm ở PATCH hồ sơ (cần phạm vi đồng ý "family").
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { FAMILIES_MAX, parseFamily } from "@/lib/familyGroup";

const NO_STORE = { "Cache-Control": "no-store" };
export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const fams = await prisma.familyGroup.findMany({ where: { tutorId: auth.userId }, select: { id: true, label: true, _count: { select: { profiles: true } } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ families: fams.map(f => ({ id: f.id, label: f.label, members: f._count.profiles })) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const p = parseFamily(await req.json().catch(() => null) as Record<string, unknown> | null, false);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  if ((await prisma.familyGroup.count({ where: { tutorId: auth.userId } })) >= FAMILIES_MAX) return NextResponse.json({ error: `Tối đa ${FAMILIES_MAX} gia đình` }, { status: 409 });
  const fam = await prisma.familyGroup.create({ data: { tutorId: auth.userId, label: p.data.label!, guardianName: p.data.guardianName ?? null, guardianPhone: p.data.guardianPhone ?? null }, select: { id: true, label: true } });
  await logAction(auth.userId, "family_group.create", "FamilyGroup", fam.id, { fields: Object.keys(p.data) });
  return NextResponse.json({ family: fam }, { status: 201, headers: NO_STORE });
}
