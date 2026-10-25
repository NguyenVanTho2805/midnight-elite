// HP-28 — bật/tắt GỢI Ý "phí trễ hạn" trên phiếu quá hạn của gia sư (chủ chốt 24/10/2026: chỉ gợi ý hiển thị).
//   GET  → { enabled }                 (chưa cấu hình = bật)
//   PUT  { enabled: boolean } → { enabled }   (ghi setting_kv khoá `invoice.lateFeeHint.<tutorId>`)
// Route này KHÔNG chạm FeeCharge / phiếu / số tiền nào: chỉ lưu một cờ hiển thị của chính gia sư.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadLateFeeHintEnabled, saveLateFeeHintEnabled } from "@/lib/invoiceReminderServer";
import { logAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  return NextResponse.json({ enabled: await loadLateFeeHintEnabled(auth.userId) }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "enabled phải là true hoặc false" }, { status: 400 });
  await saveLateFeeHintEnabled(auth.userId, body.enabled);
  await logAction(auth.userId, "invoice.late_fee_hint", "User", auth.userId, { enabled: body.enabled });
  return NextResponse.json({ enabled: body.enabled }, { headers: NO_STORE });
}
