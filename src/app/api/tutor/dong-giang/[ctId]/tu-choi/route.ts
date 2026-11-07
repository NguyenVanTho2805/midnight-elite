// TUT-dong-giang — POST tu-choi: người được mời trả lời lời mời. `ctId` phải là của CHÍNH người gọi (của người khác ⇒ 404). Chưa xử lý mới đổi được (409 ALREADY_RESPONDED).
import { NextRequest, NextResponse } from "next/server";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { declineInvitation } from "@/lib/courseTeacherServer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ ctId: string }> }) {
  const { ctId } = await params;
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  const out = await declineInvitation(ctId, auth.userId);
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
