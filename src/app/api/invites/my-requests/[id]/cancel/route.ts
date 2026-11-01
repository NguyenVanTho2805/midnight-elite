// BU-01 (R5) — POST /api/invites/my-requests/[id]/cancel (form): học sinh huỷ yêu cầu CỦA MÌNH. Của người khác 403, không có 404.
// pending → cancelled + hoàn lượt mã; không còn pending ⇒ không đổi gì. Kết quả: 303 về trang nhập mã kèm ?huy=ok | da-xu-ly.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { cancelJoinRequest, requireStudentForJoin } from "@/lib/enrollServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudentForJoin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const row = await prisma.classJoinRequest.findUnique({ where: { id }, select: { userId: true } });
  if (!row) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404, headers: NO_STORE });
  if (row.userId !== auth.userId) return NextResponse.json({ error: "Yêu cầu này không phải của bạn" }, { status: 403, headers: NO_STORE });
  const r = await cancelJoinRequest(id, auth.userId);
  return NextResponse.redirect(new URL(`/student/nhap-ma-lop?huy=${r.changed ? "ok" : "da-xu-ly"}`, req.url), { status: 303, headers: NO_STORE });
}
