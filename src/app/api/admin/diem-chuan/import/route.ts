// FE-099 — nhập hàng loạt từ văn bản dán (CSV hoặc JSON). { text, dryRun? }
//   dryRun = true → chỉ kiểm tra, trả số dòng hợp lệ + danh sách lỗi theo dòng, KHÔNG ghi gì.
//   Còn lỗi ở bất kỳ dòng nào → không ghi gì cả (tất cả hoặc không có gì) để không để dữ liệu nhập dở.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseImportText, scoreKey } from "@/lib/admissionScore";
import { upsertScores } from "@/lib/admissionScoreServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { text?: unknown; dryRun?: unknown } | null;
  if (!body || typeof body.text !== "string") return NextResponse.json({ error: "Thiếu nội dung cần nhập" }, { status: 400 });
  const res = parseImportText(body.text);
  if (res.errors.length) return NextResponse.json({ ok: false, valid: res.rows.length, errors: res.errors }, { status: 422 });

  // Báo trước dòng nào sẽ ghi đè dòng đã có.
  const existing = await prisma.admissionScore.findMany({ select: { school: true, major: true, variant: true, year: true, method: true } });
  const have = new Set(existing.map(scoreKey));
  const willUpdate = res.rows.filter(r => have.has(scoreKey(r))).length;
  if (body.dryRun === true) return NextResponse.json({ ok: true, dryRun: true, valid: res.rows.length, willCreate: res.rows.length - willUpdate, willUpdate });

  const out = await upsertScores(res.rows);
  await logAction(auth.userId, "admission_score.import", "AdmissionScore", "bulk", { ...out });
  return NextResponse.json({ ok: true, ...out });
}
