// BU-HS-NOP-TEP A4 — danh sách tệp. Học sinh: `?assignmentId=` (tệp của MÌNH + tệp gia sư đã trả cho mình). Người chấm: `?submissionId=` (tệp học sinh đã nộp + tệp trả bài;
// tên tệp ẩn khi giáo viên bộ môn ngoài nhóm — cổng quyền dùng NGUYÊN requireAssignmentAccess(…, "grade")). Trả `{ enabled, reason, limits, retentionDays, files, submission }`.
// KHÔNG BAO GIỜ trả storageKey, driver, sha256, ownerUserId, studentUserId, courseId, địa chỉ Cloudinary.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { unusableId } from "@/lib/courseAccessServer";
import { describeNopTepFile, type NopTepListResponse } from "@/lib/nopTep";
import { findSubmission, graderGate, nopTepErr, nopTepJson, nopTepRuntimeConfig, studentGate } from "@/lib/nopTepServer";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const q = new URL(req.url).searchParams;
  const assignmentId = q.get("assignmentId"), submissionId = q.get("submissionId");
  if ((!assignmentId && !submissionId) || (assignmentId && submissionId)) return nopTepErr("Thiếu bài tập hoặc bài nộp.", 400);
  const cfg = nopTepRuntimeConfig();
  const now = new Date();
  const head = { enabled: cfg.enabled, reason: cfg.reason, limits: { maxBytes: cfg.maxBytes, maxFiles: cfg.maxFiles, exts: cfg.exts, retentionDays: cfg.retentionDays }, retentionDays: cfg.retentionDays };
  const orderBy = [{ createdAt: "asc" as const }, { id: "asc" as const }];

  if (assignmentId) {
    if (unusableId(assignmentId)) return nopTepErr("Không tìm thấy bài tập", 404);
    const gate = await studentGate(assignmentId);
    if (!gate.ok) return gate.res;
    const rows = await prisma.submissionFile.findMany({
      where: {
        assignmentId, studentUserId: auth.userId,
        OR: [
          { kind: "student", status: { in: ["ready", "expired"] } },
          { kind: "tutor_return", submissionId: { not: null }, status: { in: ["ready", "expired"] } },
        ],
      },
      orderBy, take: 50,
    });
    const sub = await findSubmission(assignmentId, auth.userId);
    const body: NopTepListResponse = {
      ...head, files: rows.map((r, i) => describeNopTepFile(r, { namesVisible: true, index: i + 1, now })),
      submission: sub ? { submittedAt: sub.submittedAt.toISOString(), graded: sub.gradedAt != null } : null,
    };
    return nopTepJson(body as unknown as Record<string, unknown>);
  }

  if (unusableId(submissionId)) return nopTepErr("Không tìm thấy bài nộp", 404);
  const sub = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId! }, select: { id: true, userId: true, assignmentId: true, submittedAt: true, gradedAt: true } });
  if (!sub) {
    // Cùng thứ tự với route chấm: người không phải gia sư vẫn nhận 403, không biết bài nộp có hay không.
    const g = await graderGate("-");
    return !g.ok && g.res.status !== 404 ? g.res : nopTepErr("Không tìm thấy bài nộp", 404);
  }
  const gate = await graderGate(sub.assignmentId);
  if (!gate.ok) return gate.res;
  const rows = await prisma.submissionFile.findMany({
    where: {
      assignmentId: sub.assignmentId, studentUserId: sub.userId,
      OR: [
        { submissionId: sub.id, status: { in: ["ready", "expired"] } },
        { kind: "tutor_return", submissionId: null, ownerUserId: auth.userId, status: "ready" },   // bản nháp tệp trả bài CỦA CHÍNH NGƯỜI NÀY
      ],
    },
    orderBy, take: 50,
  });
  let n = 0;
  const body: NopTepListResponse = {
    ...head,
    files: rows.map(r => describeNopTepFile(r, { namesVisible: gate.namesVisible, index: r.kind === "student" ? ++n : 1, now })),
    submission: { submittedAt: sub.submittedAt.toISOString(), graded: sub.gradedAt != null },
  };
  return nopTepJson(body as unknown as Record<string, unknown>);
}
