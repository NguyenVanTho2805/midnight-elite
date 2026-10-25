// Một hồ sơ học sinh của gia sư: GET xem (đã che theo đồng ý, kèm nhật ký sửa + sổ đồng ý) · PATCH sửa · DELETE xoá hẳn.
// Sửa dữ liệu phải qua đủ đồng ý của MỌI bên theo tuổi; thiếu thì 422 kèm cái còn thiếu. Nhật ký sửa chỉ ghi TÊN trường.
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rate-limit";
import { attestationFromBody, evaluateConsent, requiredConsent, type ConsentRow, type ConsentScope, isAgeGroup } from "@/lib/consentPolicy";
import { changedFields, parseProfileInput } from "@/lib/studentProfile";
import {
  PROFILE_SELECT, accountFacts, birthKeyOf, consentRowsOf, courseOwnedBy, editLogOf, grantConsent, ownProfile, revokeConsent, studentIsInTutorClass, tutorCustomIds, viewOf,
} from "@/lib/studentProfileServer";

const NO_STORE = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const own = await ownProfile(auth, id);
  if ("res" in own) return own.res;
  const rows = (await consentRowsOf([id])).get(id) ?? [];
  const acct = own.profile.userId ? (await accountFacts([own.profile.userId])).get(own.profile.userId) : undefined;
  const view = viewOf(own.profile, rows, new Date(), acct);
  const ledger = await prisma.consentRecord.findMany({
    where: { subjectType: "student_profile", subjectId: id },
    select: { id: true, party: true, scopes: true, method: true, textVersion: true, grantedAt: true, revokedAt: true, revokeCause: true, batchId: true },
    orderBy: { grantedAt: "desc" },
  });
  // HS-12: liên hệ chung + các em cùng gia đình, CHỈ khi hồ sơ này có đồng ý phạm vi "family"; mỗi em cùng nhà chỉ hiện nếu chính em đó cũng có.
  let family: { id: string; label: string; guardianName: string | null; guardianPhone: string | null; members: { id: string; name: string }[]; hiddenMembers: number } | null = null;
  if (own.profile.familyId && view.consent.ok.family) {
    const fam = await prisma.familyGroup.findUnique({ where: { id: own.profile.familyId }, select: { id: true, label: true, guardianName: true, guardianPhone: true, tutorId: true } });
    if (fam && fam.tutorId === auth.userId) {
      const mem = await prisma.studentProfile.findMany({ where: { familyId: fam.id, tutorId: auth.userId, NOT: { id } }, select: PROFILE_SELECT });
      const mrows = await consentRowsOf(mem.map(m => m.id));
      const macct = await accountFacts(mem.map(m => m.userId).filter((x): x is string => !!x));
      const shown = mem.filter(m => viewOf(m, mrows.get(m.id) ?? [], new Date(), m.userId ? macct.get(m.userId) : undefined).consent.ok.family);
      family = { id: fam.id, label: fam.label, guardianName: fam.guardianName, guardianPhone: fam.guardianPhone, members: shown.map(m => ({ id: m.id, name: m.name })), hiddenMembers: mem.length - shown.length };
    }
  }
  return NextResponse.json({
    family,
    profile: view,
    ledger: ledger.map(r => ({ ...r, grantedAt: r.grantedAt.toISOString(), revokedAt: r.revokedAt?.toISOString() ?? null })),
    editLog: await editLogOf(id),
    accountSelfConsent: !!acct?.selfConsentAt,
  }, { headers: NO_STORE });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  if (!rateLimit(`ho-so-sua:${auth.userId}`, 120, 60_000)) return NextResponse.json({ error: "Bạn thao tác quá nhanh, thử lại sau ít phút" }, { status: 429 });
  const { id } = await params;
  const own = await ownProfile(auth, id);
  if ("res" in own) return own.res;
  const p = own.profile;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
  const now = new Date();

  const parsed = parseProfileInput(body, { partial: true, customIds: await tutorCustomIds(auth.userId), now });
  const firstErr = Object.values(parsed.errors)[0];
  if (firstErr) return NextResponse.json({ error: firstErr, errors: parsed.errors }, { status: 400 });
  const d = parsed.data;

  if (d.courseId && !(await courseOwnedBy(auth.userId, d.courseId))) return NextResponse.json({ error: "Lớp này không thuộc về bạn" }, { status: 403 });
  if (d.familyId) {
    const f = await prisma.familyGroup.findUnique({ where: { id: d.familyId }, select: { tutorId: true } });
    if (!f || f.tutorId !== auth.userId) return NextResponse.json({ error: "Gia đình này không thuộc về bạn" }, { status: 403 });
  }
  if (p.userId && !(await studentIsInTutorClass(auth.userId, p.userId))) {
    return NextResponse.json({ error: "Em này không còn học lớp nào của bạn" }, { status: 403 });
  }

  const rows: ConsentRow[] = (await consentRowsOf([id])).get(id) ?? [];
  const acct = p.userId ? (await accountFacts([p.userId])).get(p.userId) : undefined;
  const newGroup = d.ageGroup ?? (isAgeGroup(p.ageGroup) ? p.ageGroup : null);
  const newBirth = "birthDate" in d ? (d.birthDate ?? null) : p.birthDate;
  const req2 = requiredConsent({ declared: newGroup, birthKey: birthKeyOf({ birthDate: newBirth }, acct), now });
  const att = attestationFromBody(body.consent);
  const givenParties = att ? att.parties.filter(x => req2.parties.includes(x)) : [];
  const virtual: ConsentRow[] = givenParties.map(party => ({ party, scopes: att!.scopes, revokedAt: null }));
  const state = evaluateConsent(req2.parties, [...rows, ...virtual], { childOrSelfByAccount: !!acct?.selfConsentAt });

  // Sửa bất cứ gì cũng cần phạm vi cơ bản; chạm dữ liệu mở rộng (có giá trị) cần "extended"; gắn gia đình cần "family".
  const need: ConsentScope[] = ["basic"];
  if (parsed.touchesExtended) need.push("extended");
  if (d.familyId) need.push("family");
  const scopesMissing = need.filter(s => !state.ok[s]);
  if (scopesMissing.length) {
    const partiesMissing = [...new Set(scopesMissing.flatMap(s => state.missing[s]))];
    return NextResponse.json({
      error: "Cần xác nhận đã có đồng ý trước khi lưu thay đổi này", needsConsent: true, required: req2.parties, missing: partiesMissing, scopesMissing,
    }, { status: 422 });
  }

  const changed = changedFields(p as unknown as Record<string, unknown>, d);
  await prisma.$transaction(async tx => {
    if (att && givenParties.length) await grantConsent(tx, { subjectId: id, parties: givenParties, scopes: att.scopes, tutorId: auth.userId, now });
    if (!changed.length) return;
    const leavingWaitlist = d.status && d.status !== "waitlist" && p.status === "waitlist";
    await tx.studentProfile.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }), ...(d.ageGroup !== undefined && { ageGroup: d.ageGroup }), ...(d.status !== undefined && { status: d.status }),
        ...(d.courseId !== undefined && { courseId: d.courseId }), ...(d.familyId !== undefined && { familyId: d.familyId }),
        ...(d.guardianName !== undefined && { guardianName: d.guardianName }), ...(d.guardianPhone !== undefined && { guardianPhone: d.guardianPhone }),
        ...(d.birthDate !== undefined && { birthDate: d.birthDate }), ...(d.address !== undefined && { address: d.address }),
        ...(d.phone !== undefined && { phone: d.phone }), ...(d.phoneExtra !== undefined && { phoneExtra: d.phoneExtra }),
        ...(d.email !== undefined && { email: d.email }), ...(d.emailExtra !== undefined && { emailExtra: d.emailExtra }),
        ...(d.startDate !== undefined && { startDate: d.startDate }), ...(d.subjects !== undefined && { subjects: d.subjects }), ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.customData !== undefined && { customData: d.customData ?? Prisma.JsonNull }),
        ...(d.status === "waitlist" && p.status !== "waitlist" && { waitlistedAt: now }),
        ...(leavingWaitlist && { waitlistedAt: null }),
      },
    });
  });
  if (att && givenParties.length) await logAction(auth.userId, "student_profile.consent", "StudentProfile", id, { parties: givenParties, scopes: att.scopes });
  if (changed.length) await logAction(auth.userId, "student_profile.update", "StudentProfile", id, { fields: changed });
  return NextResponse.json({ ok: true, changed }, { headers: NO_STORE });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const own = await ownProfile(auth, id);
  if ("res" in own) return own.res;
  const p = own.profile;
  await prisma.$transaction(async tx => {
    for (const party of ["guardian", "child", "self"] as const) await revokeConsent(tx, { subjectId: id, party, byId: auth.userId, cause: "profile_deleted" });
    // Điểm từng buổi gia sư này đã ghi cho em (nếu hồ sơ gắn tài khoản) xoá cùng.
    if (p.userId) await tx.sessionStudentScore.deleteMany({ where: { tutorId: auth.userId, userId: p.userId } });
    await tx.studentProfile.delete({ where: { id } });
  });
  await logAction(auth.userId, "student_profile.delete", "StudentProfile", id, {});
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
