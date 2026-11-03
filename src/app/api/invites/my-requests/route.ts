// BU-01 (R4) — GET /api/invites/my-requests: yêu cầu vào lớp của CHÍNH học sinh (đang chờ + bị từ chối trong 30 ngày). Không có dữ liệu của em khác.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { loadMyJoinRequests, requireStudentForJoin } from "@/lib/enrollServer";

export async function GET() {
  const auth = await requireStudentForJoin();
  if (isNextResponse(auth)) return auth;
  const items = await loadMyJoinRequests(auth.userId);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
