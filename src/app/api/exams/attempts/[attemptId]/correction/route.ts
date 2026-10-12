// NV-188 — Chữa bài: danh sách câu làm sai + trạng thái chữa từng câu của học viên.
// GET → { available, reason, items, summary }. Đáp án/lời giải chỉ có ở câu đã xong; gợi ý chỉ ở bước 2.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCorrection } from "@/lib/examCorrectionServer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { attemptId } = await params;
  const r = await getCorrection(session.userId, attemptId);
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status });
}
