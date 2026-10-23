// Thu hồi đồng ý của một bên (theo yêu cầu của phụ huynh / em, hoặc gia sư tự quyết). Body: { party, cause? }.
// Sau thu hồi: hồ sơ bị che (chỉ còn tên), không ghi thêm được cho tới khi đồng ý lại; muốn xoá hẳn thì DELETE hồ sơ.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { ownProfile, revokeConsent } from "@/lib/studentProfileServer";

const CAUSES = ["guardian_request", "child_request", "tutor_decision"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const own = await ownProfile(auth, id);
  if ("res" in own) return own.res;
  const b = await req.json().catch(() => null) as { party?: unknown; cause?: unknown } | null;
  const party = b?.party;
  if (party !== "guardian" && party !== "child" && party !== "self") return NextResponse.json({ error: "Chọn bên thu hồi đồng ý" }, { status: 400 });
  const cause = CAUSES.find(c => c === b?.cause) ?? "tutor_decision";
  const n = await prisma.$transaction(tx => revokeConsent(tx, { subjectId: id, party, byId: auth.userId, cause }));
  if (!n) return NextResponse.json({ error: "Bên này chưa có đồng ý nào còn hiệu lực để thu hồi" }, { status: 409 });
  await logAction(auth.userId, "student_profile.revoke", "StudentProfile", id, { party, cause });
  return NextResponse.json({ ok: true, revoked: n }, { headers: { "Cache-Control": "no-store" } });
}
