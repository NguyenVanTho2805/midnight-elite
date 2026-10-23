// Ghi thêm đồng ý cho một hồ sơ có sẵn (vd. thêm phạm vi "Điểm từng buổi", hoặc đồng ý lại sau khi thu hồi / khi em tròn 16 tuổi).
// Body: { guardian?: true, child?: true, self?: true, scopes: ["basic","extended",…] }. Chỉ ghi các bên hồ sơ này ĐANG cần.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { attestationFromBody } from "@/lib/consentPolicy";
import { prisma } from "@/lib/prisma";
import { accountFacts, consentOf, consentRowsOf, grantConsent, ownProfile } from "@/lib/studentProfileServer";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const own = await ownProfile(auth, id);
  if ("res" in own) return own.res;
  const att = attestationFromBody(await req.json().catch(() => null));
  if (!att || !att.parties.length || !att.scopes.length) return NextResponse.json({ error: "Hãy tích xác nhận và chọn phạm vi" }, { status: 400 });
  const now = new Date();
  const rows = (await consentRowsOf([id])).get(id) ?? [];
  const acct = own.profile.userId ? (await accountFacts([own.profile.userId])).get(own.profile.userId) : undefined;
  const { req: need } = consentOf(own.profile, rows, now, acct);
  const parties = att.parties.filter(p => need.parties.includes(p));
  if (!parties.length) return NextResponse.json({ error: "Xác nhận này không khớp bên cần đồng ý theo tuổi của em", required: need.parties }, { status: 422 });
  await prisma.$transaction(tx => grantConsent(tx, { subjectId: id, parties, scopes: att.scopes, tutorId: auth.userId, now }));
  await logAction(auth.userId, "student_profile.consent", "StudentProfile", id, { parties, scopes: att.scopes });
  return NextResponse.json({ ok: true, parties }, { headers: { "Cache-Control": "no-store" } });
}
