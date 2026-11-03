// BU-03 P2 — POST → AzotaParse + images từ Word của một tệp đề gốc (ExamFile). CHỈ XEM TRƯỚC: không ghi DB, không AI.
// Chỉ tải từ https://res.cloudinary.com (chống SSRF). Không phải .docx → 400 NOT_DOCX; host lạ → 400 BAD_HOST; tệp không có 404 / của người khác 403; đã gán đề → 409 ALREADY_EXTRACTED.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, splitSourceFile } from "@/lib/deThiServer";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { fileId } = await params;
    const out = await splitSourceFile(auth.userId, fileId);
    if (!out.ok) return failResponse(out);
    return NextResponse.json(out.parsed, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/tep-goc/[fileId]/tach]", e);
    return NextResponse.json({ error: "Chưa tách được tệp. Thử lại sau ít phút." }, { status: 500 });
  }
}
