// Hộp việc của gia sư: GET → { items, total, overview }. Chỉ gia sư; mọi việc khoá theo chính gia sư đó.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { buildInboxItems, inboxTotal } from "@/lib/tutorInbox";
import { loadTutorInboxRaw } from "@/lib/tutorInboxServer";
import { loadHopViecOverview } from "@/lib/tutorOverviewServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const now = new Date();
  const [raw, overview] = await Promise.all([loadTutorInboxRaw(auth.userId, now), loadHopViecOverview(auth.userId, now)]);
  return NextResponse.json({ items: buildInboxItems(raw, now), total: inboxTotal(raw), overview }, { headers: { "Cache-Control": "no-store" } });
}
