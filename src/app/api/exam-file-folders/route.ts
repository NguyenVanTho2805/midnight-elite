import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownerScopeWhere } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/exam-file-folders — danh sách thư mục Ngân hàng đề thi (1 cấp
// phẳng). Giáo viên chỉ thấy thư mục mình tạo, admin_content/admin_super
// thấy tất cả — cùng quy tắc với ExamFile (ownerScopeWhere).
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const items = await prisma.examFileFolder.findMany({
      where: ownerScopeWhere(auth),
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("[GET /api/exam-file-folders]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/exam-file-folders — tạo thư mục mới.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { name } = await req.json() as { name?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Thiếu tên thư mục" }, { status: 400 });
    }

    const item = await prisma.examFileFolder.create({
      data: { name: name.trim(), ownerId: auth.userId },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exam-file-folders]", e);
    return NextResponse.json({ error: "Tạo thư mục thất bại" }, { status: 400 });
  }
}
