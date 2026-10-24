// QZ-08: bật/tắt "giữ điểm đến khi gia sư công bố" cho đề. Đề chưa có chính sách = học sinh thấy điểm ngay như trước.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, setHoldPolicy } from "@/lib/quizGradeServer";

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  let body: { hold?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  if (typeof body.hold !== "boolean") return NextResponse.json({ error: "Thiếu hold (true/false)" }, { status: 400 });
  const p = await setHoldPolicy(examId, ctx.auth.userId, body.hold);
  return NextResponse.json({ success: true, hold: p.holdUntilPublish });
}
