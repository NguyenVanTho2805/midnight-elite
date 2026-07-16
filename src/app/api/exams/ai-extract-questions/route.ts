import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { extractQuestionsFromFiles, SUPPORTED_AI_MIME_TYPES, type AiInputFile } from "@/lib/aiExamImport";

// Trích xuất bằng Gemini có thể mất >60s với đề nhiều câu/nhiều ảnh (đã đo thực tế
// timeout ở 60s với đề 28 câu có ảnh biểu đồ) — cần headroom lớn hơn hẳn mặc định.
export const maxDuration = 180;

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB — giới hạn body request của Vercel Serverless

async function toAiInputFile(file: File): Promise<AiInputFile> {
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
    filename: file.name,
  };
}

// POST /api/exams/ai-extract-questions — admin: dùng AI đọc file đề thi gốc
// (PDF/ảnh/Word) + file đáp án (tuỳ chọn) để tự động trích xuất câu hỏi.
// Không gắn với examId cụ thể — dùng được cả lúc tạo đề mới lẫn thêm câu hỏi
// vào đề đã có. Trả về đúng shape {questions, errors} như parser text/CSV/XLSX
// hiện có, để màn hình review dùng chung không cần sửa.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const formData = await req.formData();
    const examFile = formData.get("examFile");
    const answerKeyFile = formData.get("answerKeyFile");

    if (!(examFile instanceof File)) {
      return NextResponse.json({ error: "Thiếu file đề thi" }, { status: 400 });
    }
    if (examFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File đề thi vượt quá 4MB" }, { status: 400 });
    }
    if (!SUPPORTED_AI_MIME_TYPES.includes(examFile.type)) {
      return NextResponse.json({ error: `Định dạng file không hỗ trợ: ${examFile.type || "không xác định"}` }, { status: 400 });
    }
    if (answerKeyFile instanceof File) {
      if (answerKeyFile.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File đáp án vượt quá 4MB" }, { status: 400 });
      }
      if (!SUPPORTED_AI_MIME_TYPES.includes(answerKeyFile.type)) {
        return NextResponse.json({ error: `Định dạng file đáp án không hỗ trợ: ${answerKeyFile.type || "không xác định"}` }, { status: 400 });
      }
    }

    const result = await extractQuestionsFromFiles(
      await toAiInputFile(examFile),
      answerKeyFile instanceof File ? await toAiInputFile(answerKeyFile) : undefined
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/exams/ai-extract-questions]", e);
    const message = e instanceof Error && e.message === "GEMINI_API_KEY chưa được cấu hình"
      ? e.message
      : "Trích xuất bằng AI thất bại — vui lòng thử lại hoặc nhập thủ công";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
