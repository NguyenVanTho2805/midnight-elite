// Gia sư dời / huỷ một buổi (hoàn thiện NV-189). Chỉ chủ lớp.
//   POST   { scheduleId, dateKey, kind: "cancel"|"move", newDateKey?, newStartTime?, newEndTime?, reason? }
//          → 200 { change, message, zaloGroupUrl, absencesVoided, absencesKept, notified }   (gọi lại cho cùng buổi = ĐỔI sang lựa chọn mới)
//   DELETE ?scheduleId=&dateKey=   → khôi phục buổi về lịch tuần (chỉ khi giờ gốc còn ở tương lai)
// `dateKey` là ngày GỐC theo lịch tuần (định danh buổi), kể cả khi buổi đã được dời.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { isValidDateKey } from "@/lib/classSessions";
import { changeSession, restoreSession } from "@/lib/sessionChangeServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.scheduleId !== "string" || typeof body.dateKey !== "string" || !isValidDateKey(body.dateKey)) {
    return NextResponse.json({ error: "Thiếu hoặc sai scheduleId / dateKey" }, { status: 400 });
  }
  const r = await changeSession({ tutorId: auth.userId, scheduleId: body.scheduleId, dateKey: body.dateKey, body });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const { ok: _ok, ...rest } = r; void _ok;
  return NextResponse.json(rest);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const sp = new URL(req.url).searchParams;
  const scheduleId = sp.get("scheduleId"), dateKey = sp.get("dateKey");
  if (!scheduleId || !dateKey || !isValidDateKey(dateKey)) return NextResponse.json({ error: "Thiếu hoặc sai scheduleId / dateKey" }, { status: 400 });
  const r = await restoreSession({ tutorId: auth.userId, scheduleId, dateKey });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const { ok: _ok, ...rest } = r; void _ok;
  return NextResponse.json(rest);
}
