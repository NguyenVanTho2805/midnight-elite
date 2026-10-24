// QZ — hạn nộp riêng từng học sinh của một quiz (chỉ gia sư chủ đề, chỉ học sinh trong lớp của cô). Không đổi lịch chung của đề.
// GET  → danh sách học sinh trong lớp kèm hạn riêng (nếu có).
// POST { action: "set", userIds, dateKey: "YYYY-MM-DD", time: "HH:MM", note? } | { action: "clear", userIds }
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam } from "@/lib/quizGradeServer";
import { clearDeadlines, loadDeadlines, setDeadlines } from "@/lib/quizDeadlineServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    return NextResponse.json(await loadDeadlines(ctx.exam, ctx.auth.userId), { headers: NO_STORE });
  } catch (e) {
    console.error("[GET quiz-cham han-rieng]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  let body: { action?: unknown; userIds?: unknown; dateKey?: unknown; time?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  try {
    const r = body.action === "set" ? await setDeadlines(ctx.exam, ctx.auth.userId, body)
      : body.action === "clear" ? await clearDeadlines(ctx.exam, ctx.auth.userId, body)
      : ({ ok: false, status: 400, error: "action phải là set hoặc clear" } as const);
    return r.ok ? NextResponse.json({ success: true, count: r.count }, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) {
    console.error("[POST quiz-cham han-rieng]", e);
    return NextResponse.json({ error: "Chưa lưu được hạn riêng. Thử lại sau ít phút." }, { status: 500 });
  }
}
