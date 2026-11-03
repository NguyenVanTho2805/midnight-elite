import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { limitOrBlock } from "@/lib/rate-limit";
import { checkPracticeQuestion } from "@/lib/examPracticeServer";

// POST /api/exams/attempts/[attemptId]/check — BU-04: chấm TỪNG CÂU khi đang làm, CHỈ ở đề luyện tập (mode=practice) và không giữ điểm.
// Vào: { questionId, action?: "check" | "reveal" }. Đáp án được chấm là đáp án ĐÃ LƯU ở máy chủ, không lấy từ thân yêu cầu.
// Đáp án / lời giải chỉ có trong phản hồi theo chính sách của đề (answerVisibility, hideAnswerForWrong) và không bao giờ ở trạng thái "hint".
// Không đổi điểm: điểm vẫn chấm lúc nộp theo đáp án cuối. Luật máy trạng thái = NV-188 (2 lần thử, gợi ý, xem đáp án).
export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const blocked = limitOrBlock(session.userId, "exam-practice-check", 300, 10 * 60_000);
  if (blocked) return blocked;

  const { attemptId } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as { questionId?: unknown; action?: unknown };
    const r = await checkPracticeQuestion(session.userId, attemptId, body ?? {});
    if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(r.data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[POST /api/exams/attempts/[attemptId]/check]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
