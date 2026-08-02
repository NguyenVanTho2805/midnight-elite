import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownerScopeWhere } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { uploadRawFileToCloudinary } from "@/lib/cloudinaryServer";
import { SUPPORTED_AI_MIME_TYPES } from "@/lib/aiExamImport";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB — giống giới hạn body Vercel Serverless ở ai-extract-questions

// GET /api/exam-files — danh sách file đề thi đã lưu trữ. Giáo viên chỉ thấy
// file mình up, admin_content/admin_super thấy tất cả (ownerScopeWhere).
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const items = await prisma.examFile.findMany({
      where: ownerScopeWhere(auth),
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true } } },
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("[GET /api/exam-files]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/exam-files — upload lưu trữ file đề gốc (KHÔNG tự tách câu —
// xem [id]/extract/route.ts cho hành động tách câu riêng, chủ động).
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File vượt quá 4MB" }, { status: 400 });
    }
    if (!SUPPORTED_AI_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Định dạng file không hỗ trợ: ${file.type || "không xác định"}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadRawFileToCloudinary(buffer, file.name, file.type);

    const item = await prisma.examFile.create({
      data: { fileName: file.name, fileUrl, fileType: file.type, ownerId: auth.userId },
      include: { owner: { select: { name: true } } },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exam-files]", e);
    const message = e instanceof Error && e.message === "Cloudinary chưa được cấu hình" ? e.message : "Upload thất bại";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
