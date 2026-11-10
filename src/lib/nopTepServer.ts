// BU-HS-NOP-TEP — phần CHẠY THẬT (máy chủ): kho tệp (đĩa dev / Cloudinary raw "authenticated"), cổng quyền, khoá tương tranh, dọn tệp.
// Chỉ IMPORT từ mediaStorageServer.ts (hàm ký/xoá/đo của BU-02), không sửa nó. Quy tắc thuần ở nopTep.ts / nopTepInspect.ts (có test).
// Luật cứng: không tin dữ liệu trình duyệt; không bao giờ trả storageKey / địa chỉ Cloudinary; không log tên tệp / tên học sinh; mọi mốc giờ từ máy chủ.
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import type { SessionPayload } from "@/lib/session";
import { isEnrollmentActive } from "@/lib/enrollment";
import { enrollmentDeniedBody } from "@/lib/suspendedContent";
import { isLearnerVisible } from "@/lib/lessonStatus";
import { requireAssignmentAccess, unusableId } from "@/lib/courseAccessServer";
import { cloudinaryDestroy, cloudinaryEnv, cloudinarySignedRawUrl, cloudinaryVerify, localPathFor, removeLocal, statLocalBytes } from "@/lib/mediaStorageServer";
import { NOP_TEP_STORAGE_PREFIX, nopTepConfig, type NopTepConfig, type NopTepErrorJson } from "@/lib/nopTep";
import { readFileSync } from "node:fs";

export const NOP_TEP_NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
export const nopTepJson = (body: NopTepErrorJson | Record<string, unknown>, status = 200): NextResponse => NextResponse.json(body, { status, headers: NOP_TEP_NO_STORE });
export const nopTepErr = (error: string, status: number, extra: Record<string, unknown> = {}): NextResponse => nopTepJson({ error, ...extra }, status);

/** Cấu hình lúc chạy (đọc process.env mỗi lần để test/ops đổi được). */
export const nopTepRuntimeConfig = (): NopTepConfig => nopTepConfig(process.env as Record<string, string | undefined>);

// ── Khoá lưu ────────────────────────────────────────────────────────────────

const seg = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_") || "_";
/** `kin-nop-bai/<lớp>/<bài tập>/<fileId>.<đuôi>`: do MÁY CHỦ sinh, KHÔNG BAO GIỜ từ tên tệp. Dùng làm public_id Cloudinary và đường dẫn dưới thư mục kho cục bộ. */
export const cloudinaryNopTepPublicId = (courseId: string, assignmentId: string, fileId: string, ext: string): string =>
  `${NOP_TEP_STORAGE_PREFIX}/${seg(courseId)}/${seg(assignmentId)}/${seg(fileId)}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;

export interface StoredRef { driver: string; storageKey: string }

/** Dung lượng THẬT của tệp đã tải (Admin API / stat). null = chưa thấy. */
export async function measureStored(f: StoredRef): Promise<number | null> {
  if (!f.storageKey) return null;
  if (f.driver === "cloudinary") {
    const env = cloudinaryEnv();
    if (!env) return null;
    const facts = await cloudinaryVerify(env, f.storageKey, "raw");
    return facts ? facts.bytes : null;
  }
  try { return statLocalBytes(localPathFor(f.storageKey)); } catch { return null; }
}

/** Tải TRỌN tệp (≤ `max` byte) để kiểm; dừng khi vượt trần, không tin Content-Length. "too_big" = vượt; null = chưa đọc được. */
export async function readAllLimited(f: StoredRef, max: number): Promise<Uint8Array | "too_big" | null> {
  try {
    if (f.driver === "cloudinary") {
      const env = cloudinaryEnv();
      if (!env) return null;
      const r = await fetch(cloudinarySignedRawUrl(env, f.storageKey), { cache: "no-store" });
      if (!r.ok || !r.body) return null;
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) { await reader.cancel().catch(() => {}); return "too_big"; }
        chunks.push(value);
      }
      const out = new Uint8Array(total);
      let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
      return out;
    }
    const path = localPathFor(f.storageKey);
    const size = statLocalBytes(path);
    if (size === null) return null;
    if (size > max) return "too_big";
    return new Uint8Array(readFileSync(path));
  } catch { return null; }
}

/** Xoá tệp gốc khỏi kho. "Không tìm thấy" = thành công (để lần chạy lại hội tụ). Lỗi mạng/DB ⇒ false (hàng giữ nguyên, thử lại sau). Không ném lỗi. */
export async function deleteStored(f: StoredRef): Promise<boolean> {
  try {
    if (!f.storageKey) return true;
    if (f.driver === "cloudinary") {
      const env = cloudinaryEnv();
      if (!env) return false;
      return await cloudinaryDestroy(env, f.storageKey, "raw"); // 200 cả khi "not found" (coi là đã xoá); false chỉ khi lỗi mạng/HTTP ⇒ thử lại sau
    }
    removeLocal(f.storageKey);
    return true;
  } catch { return false; }
}

// ── Phạm vi bài tập + cổng quyền ────────────────────────────────────────────

export interface AssignmentScope {
  assignmentId: string; mode: string; ownerId: string | null; lessonId: string; lessonStatus: string; lessonIsFree: boolean;
  courseId: string; courseOwnerId: string | null; chapterTeacherId: string | null;
}
export async function loadAssignmentScope(assignmentId: string): Promise<AssignmentScope | null> {
  if (unusableId(assignmentId)) return null;
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, mode: true, ownerId: true, lessonId: true, lesson: { select: { status: true, isFree: true, chapter: { select: { teacherId: true, section: { select: { courseId: true, course: { select: { ownerId: true } } } } } } } } },
  });
  if (!a) return null;
  const ch = a.lesson.chapter;
  return {
    assignmentId: a.id, mode: a.mode, ownerId: a.ownerId, lessonId: a.lessonId, lessonStatus: a.lesson.status, lessonIsFree: a.lesson.isFree,
    courseId: ch.section.courseId, courseOwnerId: ch.section.course.ownerId, chapterTeacherId: ch.teacherId,
  };
}

/** Khoá tương tranh theo (bài, học sinh): hai tab / bấm đúp / nhiều tệp cùng lúc đi tuần tự qua đây. Gọi TRONG $transaction. */
export async function lockNopTep(tx: Prisma.TransactionClient, assignmentId: string, studentUserId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`nop-tep:${assignmentId}:${studentUserId}`}))`;
}

export type StudentGate = { ok: true; session: SessionPayload; scope: AssignmentScope } | { ok: false; res: NextResponse };
/**
 * Cổng của HỌC SINH nộp bài (init / complete / xoá / danh sách / nộp). Thứ tự: 401 → vai học sinh (403) → bài tập có & hiện cho người học & không phải bài Azota (404, TRƯỚC kiểm ghi danh)
 * → ghi danh "active" (403, thân nghỉ lớp riêng). Bài Nháp/Ẩn ⇒ 404 như submit/route.ts.
 */
export async function studentGate(assignmentId: string): Promise<StudentGate> {
  const auth = await requireSession();
  if (isNextResponse(auth)) return { ok: false, res: auth };
  if (auth.role !== "student") return { ok: false, res: nopTepErr("Chỉ học sinh mới nộp được bài tập", 403) };
  const scope = await loadAssignmentScope(assignmentId);
  if (!scope || !isLearnerVisible(scope.lessonStatus) || scope.mode === "azota" || assignmentId.startsWith("azota-")) return { ok: false, res: nopTepErr("Không tìm thấy bài tập", 404) };
  const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: auth.userId, courseId: scope.courseId } }, select: { status: true } });
  if (!isEnrollmentActive(enrolled)) return { ok: false, res: nopTepJson(enrollmentDeniedBody(enrolled, "Bạn chưa ghi danh khoá học này"), 403) };
  return { ok: true, session: auth, scope };
}

export type GraderGate = { ok: true; session: SessionPayload; scope: AssignmentScope; role: string; namesVisible: boolean } | { ok: false; res: NextResponse };
/** Cổng của NGƯỜI CHẤM: dùng NGUYÊN requireAssignmentAccess(…, "grade") (cùng cổng với GET …/submissions và PATCH …/grade) — "ai chấm được bài thì xem được tệp bài đó". */
export async function graderGate(assignmentId: string): Promise<GraderGate> {
  const acc = await requireAssignmentAccess(assignmentId, "grade");
  if (!acc.ok) return { ok: false, res: acc.res };
  const scope = await loadAssignmentScope(assignmentId);
  if (!scope) return { ok: false, res: nopTepErr("Không tìm thấy bài tập", 404) };
  return { ok: true, session: acc.session, scope, role: acc.role, namesVisible: acc.namesVisible };
}

/** Tách (bài, học sinh) → bài nộp hiện tại. */
export const findSubmission = (assignmentId: string, userId: string) =>
  prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId, userId } }, select: { id: true, userId: true, assignmentId: true, gradedAt: true, submittedAt: true, kind: true } });

// ── Dọn ─────────────────────────────────────────────────────────────────────

/** Xoá tệp gốc rồi XOÁ HÀNG (dùng khi tệp bị từ chối lúc chốt: sai nội dung, quá cỡ, thứ 4). Lỗi xoá kho ⇒ giữ hàng ở trạng thái removed để cron thử lại (không mất dấu tệp mồ côi). */
export async function discardFile(f: { id: string; driver: string; storageKey: string }): Promise<void> {
  if (await deleteStored(f)) { await prisma.submissionFile.delete({ where: { id: f.id } }).catch(() => {}); return; }
  await prisma.submissionFile.updateMany({ where: { id: f.id }, data: { status: "removed", removedAt: new Date() } }).catch(() => {});
}

/** Đặt `removed` (kèm xoá kho ngay ngoài giao dịch). Lỗi kho ⇒ giữ `removed` + deletedAt null cho cron bước 3. */
export async function removeStoredFiles(rows: { id: string; driver: string; storageKey: string }[]): Promise<void> {
  for (const r of rows) {
    if (await deleteStored(r)) await prisma.submissionFile.updateMany({ where: { id: r.id, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => {});
  }
}

/**
 * Dọn toàn bộ tệp của một bài tập / một học sinh TRƯỚC khi xoá bài tập hoặc ẩn danh tài khoản (spec 3.6). Chưa được nối vào `api/assignments/[id]` DELETE và `account-delete.ts`
 * (hai tệp của phòng khác — xin COO ở phiếu dọn). Nếu chưa gọi, cron vẫn dọn khi expiresAt qua và không ai tải được vì không còn bài nộp để kiểm quyền.
 */
export async function purgeSubmissionFiles(by: { assignmentId: string } | { studentUserId: string }): Promise<{ removed: number; failed: number }> {
  const rows = await prisma.submissionFile.findMany({ where: { ...by, deletedAt: null }, select: { id: true, driver: true, storageKey: true }, take: 500 });
  const now = new Date();
  await prisma.submissionFile.updateMany({ where: { id: { in: rows.map(r => r.id) }, status: { not: "expired" } }, data: { status: "removed", removedAt: now } });
  let failed = 0;
  for (const r of rows) {
    if (await deleteStored(r)) await prisma.submissionFile.updateMany({ where: { id: r.id, deletedAt: null }, data: { deletedAt: new Date() } });
    else failed++;
  }
  return { removed: rows.length - failed, failed };
}
