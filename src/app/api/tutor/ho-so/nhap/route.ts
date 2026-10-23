// GHI nhập hàng loạt (sau khi đã xem trước). Học sinh: BẮT BUỘC hộp xác nhận "tôi có quyền cung cấp và đã có đồng ý" của gia sư, ghi vết theo lần nhập
// (batchId + từng dòng đồng ý theo bên cần). Lịch: không chứa dữ liệu của trẻ nên không cần hộp đồng ý.
// Còn dòng lỗi mà không gửi skipErrors=true → từ chối, không ghi dòng nào.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeKey } from "@/lib/tutorArea";
import { CONSENT_TEXT_VERSION, attestationFromBody, missingParties } from "@/lib/consentPolicy";
import { importMaxRows } from "@/lib/studentProfile";
import { buildContext, parseScheduleImport, parseStudentImport, readImportRequest } from "@/lib/studentImportServer";
import { newId } from "@/lib/studentProfileServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  if (!rateLimit(`nhap-ghi:${auth.userId}`, 30, 60_000)) return NextResponse.json({ error: "Bạn thao tác quá nhanh, thử lại sau ít phút" }, { status: 429 });
  const r = await readImportRequest(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const now = new Date();
  const built = await buildContext(auth.userId, r, now);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: built.status });
  const { ctx } = built;

  // ── Lịch hàng tuần
  if (r.kind === "lich") {
    const p = parseScheduleImport(r.text, { courseByKey: ctx.courseByKey, defaultCourseId: r.courseId, maxRows: importMaxRows() });
    if (p.tooMany) return NextResponse.json({ error: p.errors[0]?.message ?? "Quá nhiều dòng" }, { status: 400 });
    if (p.errors.length && !r.skipErrors) return NextResponse.json({ error: "Còn dòng lỗi. Sửa tệp hoặc chọn bỏ qua dòng lỗi.", hasErrors: true, errors: p.errors }, { status: 422 });
    if (!p.rows.length) return NextResponse.json({ error: "Không có dòng hợp lệ để nhập" }, { status: 400 });
    let created = 0, skipped = 0;
    await prisma.$transaction(async tx => {
      for (const x of p.rows) {
        const dup = await tx.classSchedule.findFirst({ where: { courseId: x.courseId, dayOfWeek: x.dayOfWeek, startTime: x.startTime, endTime: x.endTime, active: true }, select: { id: true } });
        if (dup) { skipped++; continue; }
        await tx.classSchedule.create({ data: { courseId: x.courseId, dayOfWeek: x.dayOfWeek, startTime: x.startTime, endTime: x.endTime, note: x.note } });
        created++;
      }
    });
    await logAction(auth.userId, "class_schedule.import", "ClassSchedule", "batch", { created, skipped, errors: p.errors.length });
    return NextResponse.json({ created, skipped, errors: p.errors.length }, { status: 201, headers: NO_STORE });
  }

  // ── Học sinh
  const p = parseStudentImport(r.text, ctx);
  if (p.tooMany) return NextResponse.json({ error: p.errors[0]?.message ?? "Quá nhiều dòng" }, { status: 400 });
  if (p.errors.length && !r.skipErrors) return NextResponse.json({ error: "Còn dòng lỗi. Sửa tệp hoặc chọn bỏ qua dòng lỗi.", hasErrors: true, errors: p.errors }, { status: 422 });
  if (!p.rows.length) return NextResponse.json({ error: "Không có dòng hợp lệ để nhập" }, { status: 400 });

  // Hộp xác nhận của gia sư: quyền cung cấp + đồng ý của MỌI bên mà các dòng cần.
  const a = r.attest ?? {};
  const att = attestationFromBody(a);
  const missing = missingParties(p.parties, att?.parties ?? []);
  if (a.rights !== true || missing.length) {
    return NextResponse.json({ error: "Cần xác nhận “tôi có quyền cung cấp và đã có đồng ý” trước khi nhập", needsConsent: true, required: p.parties, missing, rights: a.rights === true }, { status: 422 });
  }

  const have = await prisma.studentProfile.findMany({ where: { tutorId: auth.userId }, select: { name: true, guardianPhone: true } });
  const haveKeys = new Set(have.map(h => `${normalizeKey(h.name)}|${h.guardianPhone ?? ""}`));
  const batchId = newId();
  const source = r.fromFile ? "csv" : "paste";
  const toCreate = p.rows.filter(x => !haveKeys.has(`${normalizeKey(x.data.name ?? "")}|${x.data.guardianPhone ?? ""}`));
  const skippedExisting = p.rows.length - toCreate.length;
  const profiles = toCreate.map(x => ({
    id: newId(), row: x,
  }));
  await prisma.$transaction(async tx => {
    await tx.studentProfile.createMany({
      data: profiles.map(({ id, row: x }) => {
        const d = x.data;
        return {
          id, tutorId: auth.userId, courseId: d.courseId ?? null, name: d.name!, ageGroup: d.ageGroup!, status: d.status ?? "active", guardianName: d.guardianName ?? null, guardianPhone: d.guardianPhone ?? null,
          birthDate: d.birthDate ?? null, address: d.address ?? null, phone: d.phone ?? null, phoneExtra: d.phoneExtra ?? null, email: d.email ?? null, emailExtra: d.emailExtra ?? null,
          startDate: d.startDate ?? null, subjects: d.subjects ?? [], notes: d.notes ?? null, customData: d.customData ?? undefined, source, batchId,
          waitlistedAt: d.status === "waitlist" ? now : null,
        };
      }),
    });
    await tx.consentRecord.createMany({
      data: profiles.flatMap(({ id, row: x }) => x.parties.map(party => ({
        subjectType: "student_profile", subjectId: id, party, scopes: x.hasExtended ? ["basic", "extended"] : ["basic"], method: "tutor_attestation",
        textVersion: CONSENT_TEXT_VERSION, givenById: auth.userId, givenByRole: "tutor", batchId, grantedAt: now,
      }))),
    });
  });
  await logAction(auth.userId, "student_profile.import", "StudentProfile", batchId, { count: profiles.length, skippedExisting, skippedErrors: p.errors.length, source, parties: p.parties, rights: true });
  return NextResponse.json({ created: profiles.length, skippedExisting, skippedErrors: p.errors.length, duplicates: p.duplicates, batchId }, { status: 201, headers: NO_STORE });
}
