// Phần chạm DB của hồ sơ học sinh + sổ đồng ý (23/10/2026). Quy tắc thuần: consentPolicy.ts, studentProfile.ts.
//
// Phân quyền (mọi hàm ở đây khoá theo gia sư đang đăng nhập, KHÔNG nhận tutorId từ client):
//  • hồ sơ của gia sư khác → 403, không có → 404;
//  • lớp (courseId) phải do chính gia sư này làm chủ; em có tài khoản (userId) phải đang ghi danh lớp của chính gia sư này;
//  • gia đình, trường tuỳ chỉnh: chỉ của gia sư này.
// Log máy chủ KHÔNG chứa dữ liệu của trẻ: chỉ id và tên trường.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/session";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import {
  CONSENT_TEXT_VERSION, evaluateConsent, isAgeGroup, requiredConsent, type ConsentParty, type ConsentRow, type ConsentScope, type ConsentState, type RequiredConsent,
} from "@/lib/consentPolicy";
import { maskProfile, type ProfileRow, type ProfileView } from "@/lib/studentProfile";

export type Tx = Prisma.TransactionClient;
export const SUBJECT = "student_profile" as const;

export const newId = (): string => "c" + randomBytes(12).toString("hex");

export const PROFILE_SELECT = {
  id: true, tutorId: true, userId: true, courseId: true, name: true, ageGroup: true, status: true, familyId: true, guardianName: true, guardianPhone: true,
  birthDate: true, address: true, phone: true, phoneExtra: true, email: true, emailExtra: true, startDate: true, subjects: true, notes: true, customData: true,
  source: true, batchId: true, waitlistedAt: true, createdAt: true,
} as const;
export type ProfileDb = Prisma.StudentProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

/** Chủ hồ sơ hoặc lỗi 403/404. Không lộ nội dung hồ sơ của người khác. */
export async function ownProfile(auth: SessionPayload, id: string): Promise<{ profile: ProfileDb } | { res: NextResponse }> {
  const profile = await prisma.studentProfile.findUnique({ where: { id }, select: PROFILE_SELECT });
  if (!profile) return { res: NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 }) };
  if (profile.tutorId !== auth.userId) return { res: NextResponse.json({ error: "Hồ sơ này không thuộc lớp của bạn" }, { status: 403 }) };
  return { profile };
}

export async function consentRowsOf(ids: string[], client: Pick<typeof prisma, "consentRecord"> = prisma): Promise<Map<string, ConsentRow[]>> {
  const out = new Map<string, ConsentRow[]>();
  if (!ids.length) return out;
  const rows = await client.consentRecord.findMany({
    where: { subjectType: SUBJECT, subjectId: { in: ids } },
    select: { subjectId: true, party: true, scopes: true, revokedAt: true, grantedAt: true, textVersion: true },
    orderBy: { grantedAt: "asc" },
  });
  for (const r of rows) { const l = out.get(r.subjectId) ?? []; l.push(r); out.set(r.subjectId, l); }
  return out;
}

/** Ngày sinh / tự đồng ý của em có tài khoản đứng sau hồ sơ (nếu có). */
export async function accountFacts(userIds: string[]): Promise<Map<string, { dob: Date | null; selfConsentAt: Date | null }>> {
  const m = new Map<string, { dob: Date | null; selfConsentAt: Date | null }>();
  if (!userIds.length) return m;
  const us = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, dateOfBirth: true, selfConsentAt: true } });
  for (const u of us) m.set(u.id, { dob: u.dateOfBirth, selfConsentAt: u.selfConsentAt });
  return m;
}

/** Ngày sinh dùng để tính tuổi: ngày sinh gia sư ghi trong hồ sơ, nếu chưa có thì ngày sinh em tự khai ở tài khoản. */
export function birthKeyOf(p: { birthDate: string | null }, acct?: { dob: Date | null }): string | null {
  if (p.birthDate) return p.birthDate;
  return acct?.dob ? new Date(acct.dob.getTime() + 7 * 3600_000).toISOString().slice(0, 10) : null;
}

export function consentOf(p: { ageGroup: string; birthDate: string | null }, rows: readonly ConsentRow[], now: Date, acct?: { dob: Date | null; selfConsentAt: Date | null }): { req: RequiredConsent; state: ConsentState } {
  const req = requiredConsent({ declared: isAgeGroup(p.ageGroup) ? p.ageGroup : null, birthKey: birthKeyOf(p, acct), now });
  const state = evaluateConsent(req.parties, rows, { childOrSelfByAccount: !!acct?.selfConsentAt });
  return { req, state };
}

export interface ConsentSummary {
  required: ConsentParty[]; group: string; kind: "child" | "adult"; conflict: boolean;
  ok: Record<ConsentScope, boolean>; missingBasic: ConsentParty[]; missingExtended: ConsentParty[]; revoked: ConsentParty[];
}
export interface ProfileOut extends ProfileView { consent: ConsentSummary }

export function viewOf(p: ProfileDb, rows: readonly ConsentRow[], now: Date, acct?: { dob: Date | null; selfConsentAt: Date | null }): ProfileOut {
  const { req, state } = consentOf(p, rows, now, acct);
  const masked = maskProfile(p as unknown as ProfileRow, state);
  return {
    ...masked,
    consent: { required: req.parties, group: req.group, kind: req.kind, conflict: req.conflict, ok: state.ok, missingBasic: state.missing.basic, missingExtended: state.missing.extended, revoked: state.revoked },
  };
}

/** Lớp phải do chính gia sư làm chủ. */
export async function courseOwnedBy(tutorId: string, courseId: string): Promise<boolean> {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  return !!c && c.ownerId === tutorId;
}
/** Em có tài khoản đang (hoặc từng) học lớp của gia sư này — điều kiện để gia sư ghi hồ sơ riêng về em. "pending_consent" chưa tính: chưa được thu thêm gì. */
export async function studentIsInTutorClass(tutorId: string, userId: string): Promise<boolean> {
  const e = await prisma.enrollment.findFirst({
    where: { userId, status: { in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.SUSPENDED] }, course: { ownerId: tutorId } }, select: { id: true },
  });
  return !!e;
}

export async function tutorCustomIds(tutorId: string): Promise<Set<string>> {
  const defs = await prisma.studentFieldDef.findMany({ where: { tutorId }, select: { id: true } });
  return new Set(defs.map(d => d.id));
}

/** Ghi các dòng đồng ý (một dòng mỗi bên). Chỉ ghi bên nằm trong `parties`. */
export async function grantConsent(tx: Tx, o: {
  subjectId: string; parties: readonly ConsentParty[]; scopes: readonly ConsentScope[]; tutorId: string; batchId?: string | null; now?: Date;
}): Promise<void> {
  const now = o.now ?? new Date();
  for (const party of o.parties) {
    await tx.consentRecord.create({
      data: {
        subjectType: SUBJECT, subjectId: o.subjectId, party, scopes: [...o.scopes], method: "tutor_attestation", textVersion: CONSENT_TEXT_VERSION,
        givenById: o.tutorId, givenByRole: "tutor", batchId: o.batchId ?? null, grantedAt: now,
      },
    });
  }
}

/** Thu hồi mọi dòng còn hiệu lực của một bên. Trả số dòng đã thu hồi. */
export async function revokeConsent(tx: Tx, o: { subjectId: string; party: ConsentParty; byId: string; cause: string; now?: Date }): Promise<number> {
  const r = await tx.consentRecord.updateMany({
    where: { subjectType: SUBJECT, subjectId: o.subjectId, party: o.party, revokedAt: null },
    data: { revokedAt: o.now ?? new Date(), revokedById: o.byId, revokeCause: o.cause },
  });
  return r.count;
}

/** Nhật ký sửa (HS-03): chỉ TÊN trường, không giá trị. */
export async function editLogOf(profileId: string): Promise<{ at: string; action: string; fields: string[] }[]> {
  const rows = await prisma.auditLog.findMany({
    where: { resourceType: "StudentProfile", resourceId: profileId, action: { startsWith: "student_profile." } },
    select: { action: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 40,
  });
  return rows.map(r => {
    const m = (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {}) as Record<string, unknown>;
    const fields = Array.isArray(m.fields) ? m.fields.filter((x): x is string => typeof x === "string") : [];
    return { at: r.createdAt.toISOString(), action: r.action, fields };
  });
}
