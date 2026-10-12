// FE-099 — quản lý điểm chuẩn (quản lý trung tâm: admin_super, admin_content).
//   GET  → mọi dòng (kể cả chưa xuất bản) + số liệu
//   POST → thêm một dòng; trùng khoá (trường, ngành, chương trình, năm, phương thức) → 409
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseScoreInput } from "@/lib/admissionScore";
import { findSameKey, isUniqueViolation, rowData } from "@/lib/admissionScoreServer";
import { SEED_SCORES } from "@/lib/admissionScoreSeed";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const rows = await prisma.admissionScore.findMany({ orderBy: [{ school: "asc" }, { major: "asc" }, { year: "desc" }], take: 5000 });
  return NextResponse.json({
    rows: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
    total: rows.length,
    published: rows.filter(r => r.published).length,
    verified: rows.filter(r => r.verified).length,
    // Bảng trống → trang công khai đang dùng dữ liệu khởi đầu có sẵn.
    usingSeed: rows.length === 0,
    seedCount: SEED_SCORES.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const p = parseScoreInput(await req.json().catch(() => null));
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const DUP = "Đã có dòng này (cùng trường, ngành, chương trình, năm, phương thức) — hãy sửa dòng cũ";
  if (await findSameKey(prisma, p.value)) return NextResponse.json({ error: DUP }, { status: 409 });
  try {
    const row = await prisma.admissionScore.create({ data: rowData(p.value) });
    await logAction(auth.userId, "admission_score.create", "AdmissionScore", row.id, { school: row.school, major: row.major, year: row.year, method: row.method });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: DUP }, { status: 409 });
    throw e;
  }
}
