// NV-188 — một thao tác chữa bài trên MỘT câu.
// POST { action: "submit", optionId } | { action: "submit", text } | { action: "reveal" } | { action: "reflect", text }
// Trả { item, summary }. Không bao giờ đổi điểm bài thi — chữa bài chỉ để học.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { actOnCorrection, type CorrectionAction } from "@/lib/examCorrectionServer";
import { limitOrBlock } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string; questionId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const blocked = limitOrBlock(session.userId, "exam-correction", 120, 10 * 60_000);
  if (blocked) return blocked;
  const { attemptId, questionId } = await params;
  let body: CorrectionAction;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const r = await actOnCorrection(session.userId, attemptId, questionId, body);
  return r.ok ? NextResponse.json({ item: r.item, summary: r.summary }) : NextResponse.json({ error: r.error }, { status: r.status });
}
