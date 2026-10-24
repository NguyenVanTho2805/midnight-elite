// QZ-08: tải nhật ký công bố + chấm/sửa điểm của đề ra CSV (UTF-8 BOM, chống CSV injection). Chỉ gia sư chủ đề — có tên học sinh nên không cache.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, loadHistory } from "@/lib/quizGradeServer";
import { historyCsv, historyCsvFilename } from "@/lib/quizHistoryCsv";
import { logAction } from "@/lib/auditLog";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    const csv = historyCsv(await loadHistory(ctx.exam));
    await logAction(ctx.auth.userId, "exam_history.export", "Exam", ctx.exam.id, { format: "csv" });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${historyCsvFilename(new Date().toISOString())}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[GET quiz-cham history xuat-csv]", e);
    return NextResponse.json({ error: "Chưa xuất được. Thử lại sau ít phút." }, { status: 500 });
  }
}
