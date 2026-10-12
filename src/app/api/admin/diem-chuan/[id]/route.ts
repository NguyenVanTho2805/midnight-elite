// FE-099 — sửa / xoá một dòng điểm chuẩn. PATCH nhận một phần trường; dòng sau khi gộp phải hợp lệ như khi tạo mới.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseScoreInput } from "@/lib/admissionScore";
import { findSameKey, isUniqueViolation, rowData } from "@/lib/admissionScoreServer";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const cur = await prisma.admissionScore.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "Không tìm thấy dòng" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const merged = { school: cur.school, major: cur.major, variant: cur.variant, year: cur.year, method: cur.method, score: cur.score, scale: cur.scale, note: cur.note ?? "", sourceUrl: cur.sourceUrl, sourceName: cur.sourceName, verified: cur.verified, published: cur.published, ...(body as object) };
  const p = parseScoreInput(merged);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const DUP = "Đã có dòng khác trùng trường, ngành, chương trình, năm, phương thức";
  if (await findSameKey(prisma, p.value, id)) return NextResponse.json({ error: DUP }, { status: 409 });
  try {
    await prisma.admissionScore.update({ where: { id }, data: rowData(p.value) });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: DUP }, { status: 409 });
    throw e;
  }
  await logAction(auth.userId, "admission_score.update", "AdmissionScore", id, { fields: Object.keys(body as object) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await prisma.admissionScore.deleteMany({ where: { id } });
  if (r.count === 0) return NextResponse.json({ error: "Không tìm thấy dòng" }, { status: 404 });
  await logAction(auth.userId, "admission_score.delete", "AdmissionScore", id, {});
  return NextResponse.json({ ok: true });
}
