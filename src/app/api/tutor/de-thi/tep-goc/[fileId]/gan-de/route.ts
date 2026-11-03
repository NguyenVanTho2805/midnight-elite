// BU-03 P2 — POST { examId } → ghi "tệp này đã tách thành đề X" (ExamFile.extractedExamId). Kiểm chủ CẢ HAI: tệp và đề (404 rồi 403).
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, linkSourceFile } from "@/lib/deThiServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { fileId } = await params;
    const body = await req.json().catch(() => null) as { examId?: unknown } | null;
    const out = await linkSourceFile(auth.userId, fileId, body?.examId);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ success: true, fileId: out.fileId, examId: out.examId });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/tep-goc/[fileId]/gan-de]", e);
    return NextResponse.json({ error: "Chưa gán được tệp. Thử lại sau ít phút." }, { status: 500 });
  }
}
