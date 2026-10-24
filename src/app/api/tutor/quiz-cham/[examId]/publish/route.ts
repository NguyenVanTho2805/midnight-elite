// QZ-08: công bố điểm cho học sinh. Body { attemptIds: string[] } = từng em hoặc nhiều em; không có attemptIds = cả lô (mọi bài đã nộp, đã chấm xong).
// Bài còn tự luận chưa chấm không được công bố (trả vào `skipped` kèm lý do; chọn đúng một bài như vậy thì 409).
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, publishAttempts } from "@/lib/quizGradeServer";

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  let body: { attemptIds?: unknown } = {};
  try { body = await req.json(); } catch { /* không body = cả lô */ }
  let ids: string[] | null = null;
  if (body.attemptIds !== undefined) {
    if (!Array.isArray(body.attemptIds) || body.attemptIds.length === 0 || body.attemptIds.length > 500 || body.attemptIds.some(x => typeof x !== "string")) {
      return NextResponse.json({ error: "Danh sách bài nộp không hợp lệ" }, { status: 400 });
    }
    ids = [...new Set(body.attemptIds as string[])];
  }
  try {
    const r = await publishAttempts(ctx.exam, ctx.auth.userId, ids);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    if (ids && ids.length === 1 && r.published.length === 0 && r.alreadyPublished.length === 0 && r.skipped.length === 1) {
      return NextResponse.json({ error: r.skipped[0].reason, ...r }, { status: 409 });
    }
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    console.error("[POST quiz-cham publish]", e);
    return NextResponse.json({ error: "Công bố thất bại" }, { status: 500 });
  }
}
