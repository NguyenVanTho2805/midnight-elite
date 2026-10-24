// QZ-08: GET chi tiết một bài nộp để chấm; POST lưu điểm + nhận xét các câu tự luận (nháp: học sinh CHƯA thấy nếu đề giữ điểm đến khi công bố).
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, loadAttemptDetail, saveEssayGrades } from "@/lib/quizGradeServer";

type P = { params: Promise<{ examId: string; attemptId: string }> };

export async function GET(_req: Request, { params }: P) {
  const { examId, attemptId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    const d = await loadAttemptDetail(ctx.exam, attemptId);
    if (!d) return NextResponse.json({ error: "Không tìm thấy bài nộp" }, { status: 404 });
    return NextResponse.json(d, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET quiz-cham attempt]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: P) {
  const { examId, attemptId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  let body: { grades?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  try {
    const r = await saveEssayGrades(ctx.exam, attemptId, ctx.auth.userId, body.grades);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ success: true, score: r.score, changed: r.changed });
  } catch (e) {
    console.error("[POST quiz-cham attempt]", e);
    return NextResponse.json({ error: "Lưu điểm thất bại" }, { status: 500 });
  }
}
