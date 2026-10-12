// Ghi nhận gia sư ĐÃ MỞ Zalo để báo lớp về buổi dời/huỷ. KiN không biết tin có đi thật hay không → tuyệt đối không ghi "đã gửi".
// POST (không thân) → { ok, openedAt }. Gọi lại giữ lần đầu.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { markChangeZaloOpened } from "@/lib/sessionChangeServer";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await markChangeZaloOpened({ tutorId: auth.userId, changeId: id });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, openedAt: r.openedAt });
}
