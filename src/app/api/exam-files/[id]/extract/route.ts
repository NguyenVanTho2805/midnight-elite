import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { reserveAiExtract, releaseAiExtract } from "@/lib/planServer";
import { PLAN_LIMIT_CODE } from "@/lib/planLimits";
import { extractQuestionsFromFiles } from "@/lib/aiExamImport";

// Trích xuất bằng Gemini có thể mất >60s — cùng lý do với
// /api/exams/ai-extract-questions (xem ghi chú ở đó).
export const maxDuration = 180;

// POST /api/exam-files/[id]/extract — "Tách câu hỏi" từ 1 file đã lưu trong
// Ngân hàng đề thi. Tải lại file từ fileUrl đã lưu (KHÔNG bắt upload lại) rồi
// chạy đúng pipeline AI-extract dùng chung với tạo/sửa đề (aiExamImport.ts) —
// khác biệt duy nhất: kết quả ở đây được người soạn xem qua màn hình gán Đầu
// mục rồi lưu vào Ngân hàng câu hỏi, KHÔNG lưu thẳng vào 1 đề thi cụ thể.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let eventId: string | null = null; // lượt AI đã giữ (trả lại nếu trích thất bại)

  try {
    const file = await prisma.examFile.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, file.ownerId);
    if (isNextResponse(auth)) return auth;

    // KiN Pro: hạn mức lượt AI mỗi tháng (cổng TẮT mặc định → chỉ ghi lượt để đo).
    const hold = await reserveAiExtract(auth.userId);
    if (!hold.ok) return NextResponse.json({ error: hold.message, code: PLAN_LIMIT_CODE, quota: hold.quota }, { status: 409 });
    eventId = hold.eventId;

    const fileRes = await fetch(file.fileUrl);
    if (!fileRes.ok) {
      await releaseAiExtract(eventId);
      return NextResponse.json({ error: "Không tải lại được file gốc từ Cloudinary" }, { status: 502 });
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const result = await extractQuestionsFromFiles({ buffer, mimeType: file.fileType, filename: file.fileName });
    return NextResponse.json(result);
  } catch (e) {
    await releaseAiExtract(eventId);
    console.error("[POST /api/exam-files/[id]/extract]", id, e);
    const message = e instanceof Error && e.message === "GEMINI_API_KEY chưa được cấu hình"
      ? e.message
      : "Trích xuất bằng AI thất bại — vui lòng thử lại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
