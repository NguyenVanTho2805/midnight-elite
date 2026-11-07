// BU-01 — phần MÁY CHỦ của "vào lớp": MỘT đường duy nhất tạo Enrollment cho học sinh tự vào / được duyệt (enrollInTx), mã cá nhân, gửi / duyệt / từ chối / huỷ
// yêu cầu vào lớp, và các bộ đọc cho trang (để trang không viết prisma tay). Luật thuần ở src/lib/joinRequest.ts.
// KHÔNG chạm đường tiền: tệp này không nhập feeCharge*/invoiceServer*/sessionBook*, không đọc Course.price.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { requireSession } from "@/lib/auth-guard";
import { isApplicant } from "@/lib/tutorGate";
import { loadTutorStatus, requireTutorOnly } from "@/lib/tutorGateServer";
import type { Prisma } from "@/generated/prisma/client";
import { deriveStatusForNewEnrollment, ENROLLMENT_STATUS } from "@/lib/enrollment";
import { assertCanAddStudent, type EnrollGate } from "@/lib/planServer";
import { CLASS_PAUSED_MESSAGE } from "@/lib/planLimits";
import { generateInviteCode } from "@/lib/classInvite";
import { logAction } from "@/lib/auditLog";
import { notify, notifyLikeAggregate } from "@/lib/notify";
import {
  JOIN_NOTIFY_TYPES, PERSONAL_CODE_TTL_DAYS, nextJoinState, normalizeJoinNote, type JoinStatus,
} from "@/lib/joinRequest";

type Tx = Prisma.TransactionClient;

export type EnrollSource = "class_invite" | "join_open" | "join_approved";
export interface EnrollCourse { id: string; ownerId: string | null; capacity: number | null; classStatus: string }
export type EnrollResult =
  | { ok: true; enrollmentId: string; status: "active" | "pending_consent" | "suspended"; created: boolean }
  | { ok: false; code: "CLASS_CLOSED" | "CAPACITY_FULL" | "CLASS_NOT_ACCEPTING" | "NOT_STUDENT"; status: 409; error: string; gate?: EnrollGate };

/** Việc DUY NHẤT tạo Enrollment cho học sinh tự vào / được duyệt. Trong giao dịch `tx` của người gọi: khoá advisory theo LỚP, kiểm classStatus === "open",
 *  sức chứa (đếm active), hạn mức gói của gia sư (feature "redeem"), trạng thái qua deriveStatusForNewEnrollment (cổng ĐỒNG Ý giữ nguyên), rồi tạo Enrollment.
 *  Đã có Enrollment ⇒ { ok: true, created: false }. classStatus / capacity được ĐỌC LẠI sau khi có khoá (giá trị trong `course` của người gọi có thể đã cũ).
 *  Không ghi log: gọi logEnrollment() SAU khi commit (logAction dùng prisma toàn cục, không dùng tx). */
export async function enrollInTx(
  tx: Tx,
  i: { userId: string; course: EnrollCourse; source: EnrollSource; inviteId?: string | null },
): Promise<EnrollResult> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`class_enroll:${i.course.id}`}))`;

  // TUT-dong-giang (H1): chỉ HỌC SINH mới được ghi danh làm học viên. Tài khoản đã chuyển thành gia sư / quản trị (Enrollment cũ vẫn còn, không đụng) không được thêm
  // lớp nào nữa qua mã mời, vào lớp mở, hay đơn xin vào được duyệt muộn. Đọc vai từ DB (JWT có thể cũ). Gốc của cả ba đường E1–E3.
  const who = await tx.user.findUnique({ where: { id: i.userId }, select: { role: true } });
  if (!who || who.role !== "student") return { ok: false, code: "NOT_STUDENT", status: 409, error: "Tài khoản này không phải học sinh" };

  const existing = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: i.userId, courseId: i.course.id } }, select: { id: true, status: true } });
  if (existing) {
    // Đã nghỉ lớp (suspended) được trả ĐÚNG là "suspended" — không giả làm "active" (người gọi báo "đã trong lớp" sai và có vẻ như đã học lại). Không tự mở lại.
    const status = existing.status === ENROLLMENT_STATUS.PENDING_CONSENT ? "pending_consent" : existing.status === ENROLLMENT_STATUS.SUSPENDED ? "suspended" : "active";
    return { ok: true, enrollmentId: existing.id, status, created: false };
  }

  const fresh = await tx.course.findUnique({ where: { id: i.course.id }, select: { classStatus: true, capacity: true, ownerId: true } });
  const classStatus = fresh?.classStatus ?? i.course.classStatus;
  const capacity = fresh ? fresh.capacity : i.course.capacity;
  const ownerId = fresh ? fresh.ownerId : i.course.ownerId;
  if (classStatus !== "open") return { ok: false, code: "CLASS_CLOSED", status: 409, error: "Lớp đang đóng, không nhận học viên mới" };

  if (capacity !== null) {
    const activeCount = await tx.enrollment.count({ where: { courseId: i.course.id, status: ENROLLMENT_STATUS.ACTIVE } });
    if (activeCount >= capacity) return { ok: false, code: "CAPACITY_FULL", status: 409, error: "Lớp đã đầy" };
  }

  // KiN Pro: hạn mức học viên đang học của gia sư (cổng TẮT mặc định). Học viên thấy chữ trung tính, không lộ gói.
  const gate = await assertCanAddStudent(ownerId, { feature: "redeem", studentId: i.userId, db: tx });
  if (!gate.allow) return { ok: false, code: "CLASS_NOT_ACCEPTING", status: 409, error: CLASS_PAUSED_MESSAGE, gate };

  const status = await deriveStatusForNewEnrollment(i.userId);
  const enr = await tx.enrollment.create({ data: { userId: i.userId, courseId: i.course.id, status } });
  return { ok: true, enrollmentId: enr.id, status: status === ENROLLMENT_STATUS.PENDING_CONSENT ? "pending_consent" : "active", created: true };
}

export async function logEnrollment(
  actorId: string,
  r: Extract<EnrollResult, { ok: true }>,
  i: { courseId: string; source: EnrollSource; inviteId?: string | null },
): Promise<void> {
  if (!r.created) return;
  await logAction(actorId, "enrollment.create", "Enrollment", r.enrollmentId, {
    courseId: i.courseId, status: r.status, source: i.source, ...(i.inviteId ? { inviteId: i.inviteId } : {}),
  });
}

// ── Mã cá nhân (spec 4.4) ───────────────────────────────────────────────────────────────────────

/** Cấp / tái dùng mã cá nhân của (em, lớp). Gọi hai lần (kể cả song song) ⇒ cùng một dòng, cùng một `code`.
 *  Còn hạn và còn lượt ⇒ trả y nguyên; hết hạn / hết lượt mà em chưa có yêu cầu đang chờ ⇒ làm sống lại dòng cũ, GIỮ `code`.
 *  Mã đã THU HỒI (revoked) KHÔNG bao giờ được làm sống lại: bị bỏ qua, em nhận một mã cá nhân mới. */
export async function issuePersonalCode(courseId: string, userId: string, now: Date = new Date()): Promise<{ code: string; inviteId: string; reused: boolean }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const out = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`personal_code:${courseId}:${userId}`}))`;
        const found = await tx.classInvite.findFirst({ where: { courseId, boundUserId: userId, kind: "personal", revoked: false }, orderBy: { createdAt: "asc" } });
        const expiresAt = new Date(now.getTime() + PERSONAL_CODE_TTL_DAYS * 86_400_000);
        if (!found) {
          const created = await tx.classInvite.create({
            data: { courseId, code: generateInviteCode(), maxUses: 1, expiresAt, createdBy: userId, boundUserId: userId, kind: "personal" },
          });
          return { code: created.code, inviteId: created.id, reused: false, fresh: true };
        }
        const dead = (found.expiresAt !== null && found.expiresAt <= now) || (found.maxUses !== null && found.usedCount >= found.maxUses);
        if (dead) {
          const req = await tx.classJoinRequest.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { status: true } });
          if (req?.status !== "pending") {
            await tx.classInvite.update({ where: { id: found.id }, data: { usedCount: 0, revoked: false, expiresAt } });
          }
        }
        return { code: found.code, inviteId: found.id, reused: true, fresh: false };
      });
      if (out.fresh) await logAction(userId, "class_invite.personal_issue", "ClassInvite", out.inviteId, { courseId });
      return { code: out.code, inviteId: out.inviteId, reused: out.reused };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 4) continue; // trùng mã ngẫu nhiên: thử mã khác
      throw e;
    }
  }
  throw new Error("Không cấp được mã cá nhân");
}

// ── Gửi / huỷ yêu cầu (học sinh) ────────────────────────────────────────────────────────────────

export type SubmitJoinResult =
  | { ok: true; requestId: string; created: boolean }
  | { ok: false; status: 409; error: string; code: "CLASS_CLOSED" | "CAPACITY_FULL" | "COOLDOWN" | "ALREADY_MEMBER" | "INVITE_UNAVAILABLE"; retryAt?: Date };

/** Trong giao dịch của người gọi: gửi yêu cầu vào lớp "approve" bằng mã `invite`. Đã `pending` ⇒ trả lại yêu cầu cũ, KHÔNG tăng lượt (`created:false`).
 *  Mỗi yêu cầu đang chờ giữ một lượt của mã (`usedCount+1`, nguyên tử, không vượt maxUses); từ chối / huỷ trả lại. */
export async function submitJoinRequestTx(
  tx: Tx,
  i: { userId: string; courseId: string; invite: { id: string; maxUses: number | null }; now?: Date },
): Promise<SubmitJoinResult> {
  const now = i.now ?? new Date();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`class_enroll:${i.courseId}`}))`;
  const course = await tx.course.findUnique({ where: { id: i.courseId }, select: { classStatus: true, capacity: true } });
  if (!course || course.classStatus !== "open") return { ok: false, status: 409, code: "CLASS_CLOSED", error: "Lớp đang đóng, không nhận học viên mới" };
  const enrolled = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: i.userId, courseId: i.courseId } }, select: { id: true } });
  const cur = await tx.classJoinRequest.findUnique({ where: { userId_courseId: { userId: i.userId, courseId: i.courseId } } });
  const step = nextJoinState((cur?.status as JoinStatus | undefined) ?? null, "apply", { hasEnrollment: !!enrolled, now, decidedAt: cur?.decidedAt ?? null });
  if (!step.ok) {
    return { ok: false, status: 409, code: step.code === "COOLDOWN" ? "COOLDOWN" : "ALREADY_MEMBER", error: step.error, retryAt: step.retryAt };
  }
  if (cur?.status === "pending") return { ok: true, requestId: cur.id, created: false };

  if (course.capacity !== null) {
    const activeCount = await tx.enrollment.count({ where: { courseId: i.courseId, status: ENROLLMENT_STATUS.ACTIVE } });
    if (activeCount >= course.capacity) return { ok: false, status: 409, code: "CAPACITY_FULL", error: "Lớp đã đầy" };
  }

  const bumped = await tx.classInvite.updateMany({
    where: i.invite.maxUses === null ? { id: i.invite.id, revoked: false } : { id: i.invite.id, revoked: false, usedCount: { lt: i.invite.maxUses } },
    data: { usedCount: { increment: 1 } },
  });
  if (bumped.count === 0) return { ok: false, status: 409, code: "INVITE_UNAVAILABLE", error: "Mã mời đã hết lượt sử dụng" };

  const row = await tx.classJoinRequest.upsert({
    where: { userId_courseId: { userId: i.userId, courseId: i.courseId } },
    create: { userId: i.userId, courseId: i.courseId, inviteId: i.invite.id, status: "pending" },
    update: { status: "pending", inviteId: i.invite.id, note: null, decidedBy: null, decidedAt: null },
  });
  return { ok: true, requestId: row.id, created: true };
}

/** Sau commit: báo gia sư có yêu cầu mới (gộp theo lớp khi chưa đọc). Không tên em, không số tiền. */
export async function notifyTutorNewJoinRequest(course: { id: string; name: string; ownerId: string | null }): Promise<void> {
  if (!course.ownerId) return;
  await notifyLikeAggregate(course.ownerId, {
    type: JOIN_NOTIFY_TYPES.new,
    link: `/lop-cua-toi/${course.id}?tab=hoc-sinh`,
    singularTitle: "Có học sinh xin vào lớp",
    buildMessage: (n) => n > 1 ? `Có ${n} yêu cầu vào lớp "${course.name}" đang chờ bạn duyệt` : `Có yêu cầu vào lớp "${course.name}" đang chờ bạn duyệt`,
  });
}

async function refundInviteUse(tx: Tx, inviteId: string | null): Promise<void> {
  if (!inviteId) return;
  await tx.classInvite.updateMany({ where: { id: inviteId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
}

/** Học sinh huỷ yêu cầu của CHÍNH MÌNH. Người gọi đã kiểm chủ sở hữu (id không có / của người khác ⇒ cùng 403, không lộ id nào tồn tại). */
export async function cancelJoinRequest(requestId: string, userId: string): Promise<{ ok: true; changed: boolean }> {
  const changed = await prisma.$transaction(async (tx) => {
    const r = await tx.classJoinRequest.findUnique({ where: { id: requestId } });
    if (!r || r.userId !== userId) return false;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`class_enroll:${r.courseId}`}))`;
    const fresh = await tx.classJoinRequest.findUnique({ where: { id: requestId }, select: { status: true, inviteId: true } });
    if (!fresh) return false;
    const step = nextJoinState(fresh.status as JoinStatus, "cancel");
    if (!step.ok) return false;
    await tx.classJoinRequest.update({ where: { id: requestId }, data: { status: step.next } });
    await refundInviteUse(tx, fresh.inviteId);
    return true;
  });
  if (changed) await logAction(userId, "class_join_request.cancel", "ClassJoinRequest", requestId);
  return { ok: true, changed };
}

// ── Duyệt / từ chối (gia sư chủ lớp) ────────────────────────────────────────────────────────────

export type DecideOutcome = "ok" | "tuchoi" | "day" | "dong" | "goi" | "da-xu-ly" | "loi-ghi-chu" | "khong-co" | "da-nghi" | "khong-phai-hs";
export interface DecideCourse { id: string; name: string; ownerId: string | null; capacity: number | null; classStatus: string }

/** Duyệt (`duyet`) hoặc từ chối (`tu-choi`) MỘT yêu cầu của lớp `course`. Người gọi đã kiểm gia sư là chủ lớp.
 *  Yêu cầu không thuộc lớp này ⇒ "khong-co" (404). Lớp đầy / đang đóng / gói chặn ⇒ "day" / "dong" / "goi" và yêu cầu VẪN pending. Đã xử lý ⇒ "da-xu-ly" (không tạo thêm gì).
 *  Học sinh đang tạm dừng (Enrollment suspended) ⇒ "da-nghi": KHÔNG tự mở lại, KHÔNG báo "Bạn đã được vào lớp", yêu cầu VẪN pending — gia sư mở lại ở mục Học sinh rồi duyệt (chỉ gia sư mở lại được). */
export async function decideJoinRequest(
  course: DecideCourse,
  requestId: string,
  action: "duyet" | "tu-choi",
  tutorId: string,
  rawNote?: unknown,
): Promise<DecideOutcome> {
  let note: string | null = null;
  if (action === "tu-choi") {
    const n = normalizeJoinNote(rawNote);
    if (!n.ok) return "loi-ghi-chu";
    note = n.value;
  }
  const now = new Date();
  type Inner = { outcome: DecideOutcome; studentId?: string; enrollment?: Extract<EnrollResult, { ok: true }> };
  const res: Inner = await prisma.$transaction(async (tx): Promise<Inner> => {
    const r0 = await tx.classJoinRequest.findUnique({ where: { id: requestId }, select: { courseId: true } });
    if (!r0 || r0.courseId !== course.id) return { outcome: "khong-co" };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`class_enroll:${course.id}`}))`;
    const r = await tx.classJoinRequest.findUnique({ where: { id: requestId } });
    if (!r) return { outcome: "khong-co" };
    const step = nextJoinState(r.status as JoinStatus, action === "duyet" ? "approve" : "reject");
    if (!step.ok) return { outcome: "da-xu-ly" };
    if (action === "duyet") {
      const enr = await enrollInTx(tx, { userId: r.userId, course, source: "join_approved", inviteId: r.inviteId });
      if (!enr.ok) {
        // TUT-dong-giang (H1): người xin vào nay không còn là học sinh ⇒ KHÔNG tạo Enrollment; đơn bị đánh dấu cancelled và trả lại lượt mã.
        if (enr.code === "NOT_STUDENT") {
          await tx.classJoinRequest.update({ where: { id: requestId }, data: { status: "cancelled", decidedBy: tutorId, decidedAt: now, note: null } });
          await refundInviteUse(tx, r.inviteId);
          return { outcome: "khong-phai-hs" };
        }
        return { outcome: enr.code === "CAPACITY_FULL" ? "day" : enr.code === "CLASS_CLOSED" ? "dong" : "goi" };
      }
      // Đang tạm dừng: enrollInTx giữ nguyên hồ sơ (không mở lại). Không đánh dấu approved, không thông báo "đã vào lớp".
      if (enr.status === "suspended") return { outcome: "da-nghi" };
      await tx.classJoinRequest.update({ where: { id: requestId }, data: { status: "approved", decidedBy: tutorId, decidedAt: now, note: null } });
      return { outcome: "ok", studentId: r.userId, enrollment: enr };
    }
    await tx.classJoinRequest.update({ where: { id: requestId }, data: { status: "rejected", decidedBy: tutorId, decidedAt: now, note } });
    await refundInviteUse(tx, r.inviteId);
    return { outcome: "tuchoi", studentId: r.userId };
  });

  if (res.outcome === "ok" && res.studentId && res.enrollment) {
    await logEnrollment(res.studentId, res.enrollment, { courseId: course.id, source: "join_approved" });
    await logAction(tutorId, "class_join_request.approve", "ClassJoinRequest", requestId, { courseId: course.id });
    // Cổng đồng ý còn chờ: KHÔNG nói "đã vào lớp". Chữ trung tính — không tên em, không tiền.
    const waiting = res.enrollment.status === "pending_consent";
    await notify(res.studentId, {
      type: JOIN_NOTIFY_TYPES.approved,
      title: waiting ? "Gia sư đã duyệt" : "Bạn đã được vào lớp",
      message: waiting ? "Gia sư đã duyệt, đang chờ phụ huynh đồng ý" : `Gia sư đã duyệt. Bạn đã vào lớp "${course.name}"`,
      link: `/student/hoc-tap?course=${course.id}`,
    });
  } else if (res.outcome === "tuchoi" && res.studentId) {
    await logAction(tutorId, "class_join_request.reject", "ClassJoinRequest", requestId, { courseId: course.id });
    await notify(res.studentId, {
      type: JOIN_NOTIFY_TYPES.rejected, title: "Yêu cầu vào lớp chưa được duyệt",
      message: `Yêu cầu vào lớp "${course.name}" chưa được gia sư duyệt`, link: "/student/nhap-ma-lop",
    });
  }
  return res.outcome;
}

/** Hàng loạt (≤ JOIN_BULK_MAX id): duyệt theo thứ tự gửi cho tới khi đầy lớp. id lạ / khác lớp bị bỏ qua. */
export async function decideJoinRequestsBulk(
  course: DecideCourse,
  ids: string[],
  action: "duyet" | "tu-choi",
  tutorId: string,
  rawNote?: unknown,
): Promise<{ done: number; blocked: boolean; closed: boolean; noteError: boolean; suspended: number; notStudent: number }> {
  const rows = await prisma.classJoinRequest.findMany({
    where: { id: { in: ids }, courseId: course.id, status: "pending" }, orderBy: { createdAt: "asc" }, select: { id: true },
  });
  let done = 0;
  let blocked = false;
  let closed = false;
  let notStudent = 0; // người xin vào nay không còn là học sinh: đơn tự huỷ, đếm riêng (không tính vào done)
  let suspended = 0; // yêu cầu của học sinh đang tạm dừng: bỏ qua (vẫn pending), KHÔNG chặn các yêu cầu còn lại
  for (const r of rows) {
    const o = await decideJoinRequest(course, r.id, action, tutorId, rawNote);
    if (o === "loi-ghi-chu") return { done, blocked, closed, noteError: true, suspended, notStudent };
    if (o === "da-nghi") suspended++;
    else if (o === "khong-phai-hs") notStudent++;
    else if (o === "ok" || o === "tuchoi") done++;
    else if (o === "day" || o === "dong" || o === "goi") { blocked = true; if (o === "dong") closed = true; if (action === "duyet") break; }
  }
  return { done, blocked, closed, noteError: false, suspended, notStudent };
}

// ── Bộ đọc cho trang / route ────────────────────────────────────────────────────────────────────

/** Hàng chờ của MỘT lớp — chỉ trang / route của chủ lớp được gọi (đây là chỗ duy nhất trả tên em). */
export async function loadPendingJoinRequests(courseId: string): Promise<{ id: string; studentName: string; createdAt: Date }[]> {
  const rows = await prisma.classJoinRequest.findMany({
    where: { courseId, status: "pending" }, orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, user: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, studentName: r.user.name ?? "Học sinh", createdAt: r.createdAt }));
}

export async function countPendingJoinRequests(courseId: string): Promise<number> {
  return prisma.classJoinRequest.count({ where: { courseId, status: "pending" } });
}

export interface MyJoinRequest {
  id: string;
  status: JoinStatus;
  note: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  course: { id: string; name: string };
  personalCode: string | null;
}

/** Yêu cầu của CHÍNH học sinh: đang chờ + bị từ chối trong 30 ngày. */
export async function loadMyJoinRequests(userId: string, now: Date = new Date()): Promise<MyJoinRequest[]> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await prisma.classJoinRequest.findMany({
    where: { userId, OR: [{ status: "pending" }, { status: "rejected", decidedAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, note: true, decidedAt: true, createdAt: true, courseId: true, course: { select: { id: true, name: true } } },
  });
  if (!rows.length) return [];
  const codes = await prisma.classInvite.findMany({
    where: { boundUserId: userId, kind: "personal", courseId: { in: rows.map((r) => r.courseId) } }, select: { courseId: true, code: true },
  });
  const byCourse = new Map(codes.map((c) => [c.courseId, c.code]));
  return rows.map((r) => ({
    id: r.id, status: r.status as JoinStatus, note: r.note, decidedAt: r.decidedAt, createdAt: r.createdAt,
    course: r.course, personalCode: r.status === "pending" ? byCourse.get(r.courseId) ?? null : null,
  }));
}

// ── Nhãn "Miễn phí" (chỉ ĐỌC; không đụng đường tiền) ───────────────────────────────────────────

/** Tập id lớp ĐÃ có đơn giá (CourseFeeRate) — một truy vấn cho cả danh sách, không N+1. Có đơn giá ⇒ không còn là lớp miễn phí. */
export async function loadFeeRateCourseIds(courseIds: string[], db: Pick<typeof prisma, "courseFeeRate"> = prisma): Promise<Set<string>> {
  if (!courseIds.length) return new Set();
  const rows = await db.courseFeeRate.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds } } });
  return new Set(rows.map((r) => r.courseId));
}

// ── Cổng quyền dùng chung cho các route BU-01 ───────────────────────────────────────────────────

/** Học sinh THẬT (role student, không bị khoá, không phải người nộp đơn gia sư). Chưa đăng nhập 401; role khác / người nộp đơn gia sư 403. */
export async function requireStudentForJoin(): Promise<SessionPayload | NextResponse> {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const denied = await denyNonStudent(auth);
  return denied ?? auth;
}

/** Dùng khi đã có phiên: null = được; ngược lại là câu trả lời 403. */
export async function denyNonStudent(session: SessionPayload): Promise<NextResponse | null> {
  if (session.role !== "student") return NextResponse.json({ error: "Chỉ học sinh mới dùng chức năng này" }, { status: 403 });
  if (isApplicant(await loadTutorStatus(session))) {
    return NextResponse.json({ error: "Tài khoản gia sư chờ duyệt chưa vào lớp bằng cách này" }, { status: 403 });
  }
  return null;
}

/** Gia sư ĐÃ DUYỆT và là CHỦ lớp `courseId`: chưa đăng nhập 401, không phải gia sư / lớp của gia sư khác 403, không có lớp 404. */
export async function requireCourseTutor(courseId: string): Promise<{ session: SessionPayload; course: DecideCourse } | NextResponse> {
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, ownerId: true, capacity: true, classStatus: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (course.ownerId !== auth.userId) return NextResponse.json({ error: "Lớp này không phải của bạn" }, { status: 403 });
  return { session: auth, course };
}
