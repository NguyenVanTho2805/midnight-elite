// KH-04 — gia sư TIẾP NHẬN yêu cầu thành hồ sơ học sinh (chờ xếp lớp hoặc hoạt động). Body: { name, ageGroup, status?, courseId?, consent?: { child?, self?, guardian? } }.
// Đồng ý của người gửi (phụ huynh bấm ở biểu mẫu, method "guest_form") được SAO sang hồ sơ; bên nào theo tuổi còn thiếu (vd. em từ 7 tuổi) gia sư phải xác nhận thêm, không thì 422.
// Tên của em do gia sư nhập (biểu mẫu khách không thu tên trẻ). Sau khi nhận, số liên hệ chỉ còn ở hồ sơ, bị xoá khỏi yêu cầu.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { attestationFromBody, requiredConsent, type ConsentParty } from "@/lib/consentPolicy";
import { parseProfileInput } from "@/lib/studentProfile";
import { courseOwnedBy, grantConsent, newId } from "@/lib/studentProfileServer";
import { SCRUB, tutorCustomIdsNone } from "@/lib/tutorRequestServer";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await prisma.tutorRequest.findUnique({ where: { id }, select: { id: true, targetTutorId: true, status: true, contactName: true, contactPhone: true } });
  if (!r) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
  if (r.targetTutorId !== auth.userId) return NextResponse.json({ error: "Yêu cầu này không gửi tới bạn" }, { status: 403 });
  if (r.status !== "new") return NextResponse.json({ error: "Yêu cầu này đã được xử lý hoặc đã đóng" }, { status: 409 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
  const now = new Date();
  const st = body.status === "active" ? "active" : "waitlist";
  const parsed = parseProfileInput({ name: body.name, ageGroup: body.ageGroup, status: st, courseId: body.courseId ?? null, guardianName: r.contactName, guardianPhone: r.contactPhone }, { partial: false, customIds: tutorCustomIdsNone, now });
  const firstErr = Object.values(parsed.errors)[0];
  if (firstErr) return NextResponse.json({ error: firstErr, errors: parsed.errors }, { status: 400 });
  const d = parsed.data;
  if (d.courseId && !(await courseOwnedBy(auth.userId, d.courseId))) return NextResponse.json({ error: "Lớp này không thuộc về bạn" }, { status: 403 });

  // Đồng ý đã có: dòng của người gửi trên biểu mẫu (còn hiệu lực). Hồ sơ chỉ nhận phạm vi CƠ BẢN từ yêu cầu (tên do gia sư nhập, liên hệ của người gửi); môn khách ghi KHÔNG chép sang vì "môn" thuộc nhóm mở rộng.
  const guest = await prisma.consentRecord.findMany({ where: { subjectType: "tutor_request", subjectId: id, revokedAt: null, method: "guest_form" }, select: { party: true, textVersion: true, grantedAt: true } });
  if (guest.some(g => g.party === "self") && d.ageGroup !== "16plus") {
    return NextResponse.json({ error: "Người gửi yêu cầu là người học đã đủ 16 tuổi nên hồ sơ phải ở nhóm “Từ 16 tuổi trở lên”", errors: { ageGroup: "Chọn nhóm từ 16 tuổi trở lên" } }, { status: 400 });
  }
  const need = requiredConsent({ declared: d.ageGroup!, birthKey: null, now }).parties;
  const covered = need.filter(p => guest.some(g => g.party === p)) as ConsentParty[];
  const att = attestationFromBody(body.consent);
  const remaining = need.filter(p => !covered.includes(p));
  const missing = remaining.filter(p => !(att?.parties ?? []).includes(p));
  if (missing.length) {
    return NextResponse.json({ error: "Cần xác nhận đồng ý của các bên còn thiếu trước khi nhận", needsConsent: true, required: need, covered, missing }, { status: 422 });
  }

  const pid = newId();
  await prisma.$transaction(async tx => {
    await tx.studentProfile.create({
      data: {
        id: pid, tutorId: auth.userId, courseId: d.courseId ?? null, name: d.name!, ageGroup: d.ageGroup!, status: st, guardianName: d.guardianName ?? null, guardianPhone: d.guardianPhone ?? null,
        source: "request", requestId: id, waitlistedAt: st === "waitlist" ? now : null,
      },
    });
    for (const g of guest.filter(x => covered.includes(x.party as ConsentParty))) {
      await tx.consentRecord.create({ data: { subjectType: "student_profile", subjectId: pid, party: g.party, scopes: ["basic"], method: "guest_form", textVersion: g.textVersion, givenById: null, givenByRole: "guest", grantedAt: g.grantedAt } });
    }
    if (remaining.length) await grantConsent(tx, { subjectId: pid, parties: remaining, scopes: ["basic"], tutorId: auth.userId, now });
    await tx.tutorRequest.update({ where: { id }, data: { status: "accepted", decidedAt: now, profileId: pid, ...SCRUB } });
  });
  await logAction(auth.userId, "tutor_request.accept", "TutorRequest", id, { profileId: pid, copiedParties: covered, attestedParties: remaining });
  return NextResponse.json({ profileId: pid }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
