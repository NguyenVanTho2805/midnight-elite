// POST /api/english/dictation — { textId, correct, total, seconds } ghi kết quả một câu chép chính tả (chấm ở trình duyệt).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad, logStudy } from "@/lib/english/server";

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { textId?: string; correct?: number; total?: number; seconds?: number } | null;
  const total = Math.round(Number(b?.total)), correct = Math.round(Number(b?.correct));
  if (!b?.textId || !(total > 0 && total <= 200) || !(correct >= 0 && correct <= total)) return bad("Dữ liệu không hợp lệ");
  const t = await prisma.engText.findFirst({ where: { id: b.textId, OR: [{ ownerId: null }, { ownerId: s.userId }] }, select: { id: true } });
  if (!t) return bad("Không tìm thấy bài", 404);
  await logStudy(s.userId, "nghe", { items: 1, correct, total, seconds: Math.min(Number(b.seconds) || 0, 900) });
  return NextResponse.json({ ok: true });
}
