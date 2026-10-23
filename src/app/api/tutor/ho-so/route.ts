// Hồ sơ học sinh của gia sư (HS-03/04/10/11, LO-06/18). GET danh sách (đã che theo đồng ý) · POST tạo (BẮT BUỘC kèm hộp đồng ý).
// Chỉ gia sư; khoá theo phiên, không nhận tutorId từ client. Log không chứa dữ liệu của trẻ.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rate-limit";
import { attestationFromBody, missingParties, requiredConsent, type ConsentScope } from "@/lib/consentPolicy";
import { customFieldsMax, importMaxRows, parseProfileInput } from "@/lib/studentProfile";
import {
  PROFILE_SELECT, accountFacts, birthKeyOf, consentRowsOf, courseOwnedBy, grantConsent, newId, studentIsInTutorClass, tutorCustomIds, viewOf,
} from "@/lib/studentProfileServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const now = new Date();
  const [profiles, defs, courses, families] = await Promise.all([
    prisma.studentProfile.findMany({ where: { tutorId: auth.userId }, select: PROFILE_SELECT, orderBy: [{ createdAt: "desc" }], take: 1000 }),
    prisma.studentFieldDef.findMany({ where: { tutorId: auth.userId }, select: { id: true, label: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.course.findMany({ where: { ownerId: auth.userId }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.familyGroup.findMany({ where: { tutorId: auth.userId }, select: { id: true, label: true, guardianName: true, guardianPhone: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const rows = await consentRowsOf(profiles.map(p => p.id));
  const acct = await accountFacts(profiles.map(p => p.userId).filter((x): x is string => !!x));
  const out = profiles.map(p => viewOf(p, rows.get(p.id) ?? [], now, p.userId ? acct.get(p.userId) : undefined));
  // Số điện thoại phụ huynh của gia đình chỉ hiện khi hồ sơ có phạm vi "family" — ở đây chỉ trả nhãn gia đình, không trả liên hệ cho em bị khoá.
  return NextResponse.json({
    profiles: out, fieldDefs: defs, courses, families: families.map(f => ({ id: f.id, label: f.label })),
    limits: { customFields: customFieldsMax(), importRows: importMaxRows() },
  }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  if (!rateLimit(`ho-so-tao:${auth.userId}`, 60, 60_000)) return NextResponse.json({ error: "Bạn thao tác quá nhanh, thử lại sau ít phút" }, { status: 429 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
  const now = new Date();

  const parsed = parseProfileInput(body, { partial: false, customIds: await tutorCustomIds(auth.userId), now });
  const firstErr = Object.values(parsed.errors)[0];
  if (firstErr) return NextResponse.json({ error: firstErr, errors: parsed.errors }, { status: 400 });
  const d = parsed.data;

  if (d.courseId && !(await courseOwnedBy(auth.userId, d.courseId))) return NextResponse.json({ error: "Lớp này không thuộc về bạn" }, { status: 403 });
  if (d.familyId) {
    const f = await prisma.familyGroup.findUnique({ where: { id: d.familyId }, select: { tutorId: true } });
    if (!f || f.tutorId !== auth.userId) return NextResponse.json({ error: "Gia đình này không thuộc về bạn" }, { status: 403 });
  }
  const userId = typeof body.userId === "string" && body.userId ? body.userId : null;
  let acct: { dob: Date | null; selfConsentAt: Date | null } | undefined;
  if (userId) {
    if (!(await studentIsInTutorClass(auth.userId, userId))) return NextResponse.json({ error: "Em này không học lớp nào của bạn" }, { status: 403 });
    const dup = await prisma.studentProfile.findFirst({ where: { tutorId: auth.userId, userId }, select: { id: true } });
    if (dup) return NextResponse.json({ error: "Bạn đã có hồ sơ riêng cho em này", id: dup.id }, { status: 409 });
    acct = (await accountFacts([userId])).get(userId);
  }

  // ── Hộp đồng ý: chưa đủ thì KHÔNG lưu gì cả.
  const required = requiredConsent({ declared: d.ageGroup, birthKey: birthKeyOf({ birthDate: d.birthDate ?? null }, acct), now });
  const needParties = required.parties.filter(p => !((p === "child" || p === "self") && acct?.selfConsentAt));
  const att = attestationFromBody(body.consent);
  const scopesNeeded: ConsentScope[] = ["basic"];
  if (parsed.touchesExtended) scopesNeeded.push("extended");
  if (d.familyId) scopesNeeded.push("family");
  const missing = missingParties(needParties, att?.parties ?? []);
  const scopesMissing = scopesNeeded.filter(s => !(att?.scopes ?? []).includes(s));
  if (missing.length || scopesMissing.length) {
    return NextResponse.json({
      error: "Cần xác nhận đã có đồng ý trước khi lưu thông tin của em", needsConsent: true, required: required.parties, missing, scopesMissing,
    }, { status: 422 });
  }

  const id = newId();
  await prisma.$transaction(async tx => {
    await tx.studentProfile.create({
      data: {
        id, tutorId: auth.userId, userId, courseId: d.courseId ?? null, name: d.name!, ageGroup: d.ageGroup!, status: d.status ?? "active", familyId: d.familyId ?? null,
        guardianName: d.guardianName ?? null, guardianPhone: d.guardianPhone ?? null, birthDate: d.birthDate ?? null, address: d.address ?? null,
        phone: d.phone ?? null, phoneExtra: d.phoneExtra ?? null, email: d.email ?? null, emailExtra: d.emailExtra ?? null, startDate: d.startDate ?? null,
        subjects: d.subjects ?? [], notes: d.notes ?? null, customData: d.customData ?? undefined,
        source: body.source === "wizard" ? "wizard" : "manual", waitlistedAt: d.status === "waitlist" ? now : null,
      },
    });
    await grantConsent(tx, { subjectId: id, parties: needParties, scopes: att!.scopes, tutorId: auth.userId, now });
  });
  await logAction(auth.userId, "student_profile.create", "StudentProfile", id, { fields: parsed.fields, parties: needParties, scopes: att!.scopes });
  return NextResponse.json({ id }, { status: 201, headers: NO_STORE });
}
