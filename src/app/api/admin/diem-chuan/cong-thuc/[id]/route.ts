// NC2-050 — sửa / xoá một công thức. PATCH nhận một phần trường; công thức sau khi gộp phải hợp lệ như khi tạo mới.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseFormulaInput } from "@/lib/admissionFormula";
import { formulaData } from "@/lib/admissionFormulaServer";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const cur = await prisma.admissionFormula.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "Không tìm thấy công thức" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const merged = {
    name: cur.name, school: cur.school, year: cur.year, scale: cur.scale, inputs: cur.inputs, multiplier: cur.multiplier, bonuses: cur.bonuses,
    note: cur.note ?? "", sourceUrl: cur.sourceUrl, sourceName: cur.sourceName, verified: cur.verified, published: cur.published, ...(body as object),
  };
  const p = parseFormulaInput(merged);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  await prisma.admissionFormula.update({ where: { id }, data: formulaData(p.value) });
  await logAction(auth.userId, "admission_formula.update", "AdmissionFormula", id, { fields: Object.keys(body as object) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await prisma.admissionFormula.deleteMany({ where: { id } });
  if (r.count === 0) return NextResponse.json({ error: "Không tìm thấy công thức" }, { status: 404 });
  await logAction(auth.userId, "admission_formula.delete", "AdmissionFormula", id);
  return NextResponse.json({ ok: true });
}
