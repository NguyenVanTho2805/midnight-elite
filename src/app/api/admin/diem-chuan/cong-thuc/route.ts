// NC2-050 — quản lý công thức tính điểm xét tuyển (quản lý trung tâm: admin_super, admin_content).
//   GET  → mọi công thức (kể cả bản nháp)   ·   POST → thêm một công thức (kiểm nghiêm ở src/lib/admissionFormula.ts)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseFormulaInput } from "@/lib/admissionFormula";
import { formulaData, rowToValue } from "@/lib/admissionFormulaServer";

export const dynamic = "force-dynamic";
const MAX_FORMULAS = 300;

export async function GET() {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const rows = await prisma.admissionFormula.findMany({ orderBy: [{ school: "asc" }, { name: "asc" }], take: MAX_FORMULAS });
  // `broken` = dữ liệu trong CSDL không còn hợp lệ (sửa tay?): trang quản trị vẫn liệt kê để xoá hoặc sửa lại, trang công khai thì bỏ qua.
  const formulas = rows.map(r => { const value = rowToValue(r); return { id: r.id, name: r.name, value, broken: value === null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }; });
  return NextResponse.json({ formulas, total: rows.length, published: rows.filter(r => r.published).length });
}

export async function POST(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const p = parseFormulaInput(await req.json().catch(() => null));
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  if ((await prisma.admissionFormula.count()) >= MAX_FORMULAS) return NextResponse.json({ error: `Đã đủ ${MAX_FORMULAS} công thức — xoá bớt công thức cũ` }, { status: 409 });
  const row = await prisma.admissionFormula.create({ data: formulaData(p.value) });
  await logAction(auth.userId, "admission_formula.create", "AdmissionFormula", row.id, { name: row.name, published: row.published });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
