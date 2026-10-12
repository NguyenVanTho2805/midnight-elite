// TT-202 — gia sư xử lý một báo nghỉ sát giờ bằng MỘT nút.
// PATCH { action: "free_makeup" | "charge" }
//   free_makeup → ghi "Có phép" + giữ 1 buổi bù (30 ngày) + trả sẵn tin nhắn cho phụ huynh
//   charge      → tính phí buổi này, không có buổi bù
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { resolveAbsence } from "@/lib/absenceServer";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  let body: { action?: unknown } = {};
  try { body = await req.json(); } catch { /* xuống kiểm tra bên dưới */ }
  if (body.action !== "free_makeup" && body.action !== "charge") {
    return NextResponse.json({ error: 'action phải là "free_makeup" hoặc "charge"' }, { status: 400 });
  }
  const r = await resolveAbsence({ absenceId: id, tutorId: auth.userId, action: body.action });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, status: r.status, message: r.message, makeupCount: r.makeupCount, parentPhone: r.parentPhone, parentName: r.parentName });
}
