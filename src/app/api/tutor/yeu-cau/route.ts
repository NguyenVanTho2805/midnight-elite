// KH-04 — gia sư xem các "Yêu cầu tìm gia sư" gửi TỚI MÌNH (khoá theo phiên; không nhận id gia sư từ client). Số liên hệ chỉ còn ở yêu cầu đang chờ.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { LEVEL_LABEL, isRequestLevel } from "@/lib/tutorRequest";
import { expireOldRequests } from "@/lib/tutorRequestServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  await expireOldRequests();
  const rows = await prisma.tutorRequest.findMany({
    where: { targetTutorId: auth.userId }, orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, status: true, level: true, subject: true, mode: true, slots: true, note: true, contactName: true, contactPhone: true, createdAt: true, decidedAt: true, profileId: true },
  });
  const roles = await prisma.consentRecord.findMany({ where: { subjectType: "tutor_request", subjectId: { in: rows.map(r => r.id) } }, select: { subjectId: true, party: true } });
  const roleOf = new Map(roles.map(r => [r.subjectId, r.party]));
  return NextResponse.json({
    requests: rows.map(r => ({
      id: r.id, status: r.status, level: isRequestLevel(r.level) ? LEVEL_LABEL[r.level] : r.level, subject: r.subject, mode: r.mode, slots: r.slots, note: r.note, contactName: r.contactName,
      contactPhone: r.status === "new" ? r.contactPhone : "", role: roleOf.get(r.id) ?? "guardian", createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null, profileId: r.profileId,
    })),
    newCount: rows.filter(r => r.status === "new").length,
  }, { headers: { "Cache-Control": "no-store" } });
}
