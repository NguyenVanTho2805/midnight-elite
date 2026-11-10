// BU-HS-NOP-TEP A7 — người chấm GẮN tệp trả bài (đã "ready") vào bài nộp của học sinh. JSON (không 303) vì chạy trong khung chấm điểm, không rời trang.
// Cổng quyền: NGUYÊN requireAssignmentAccess(…, "grade"). Chỉ gắn tệp kind "tutor_return" do CHÍNH người này tải, cùng bài + cùng học sinh, đã ready. Cả lô hợp lệ hoặc không gắn gì.
// Gắn bộ mới THAY bộ trả bài cũ (không giữ nhiều phiên bản): tệp cũ → removed + xoá kho. Thông báo "đã trả bài" cho học sinh (không tên, không số, không tên tệp) chỉ khi có tệp MỚI được gắn.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { notify } from "@/lib/notify";
import { unusableId } from "@/lib/courseAccessServer";
import { NOP_TEP_MAX_FILES, describeNopTepFile, isNopTepId, type NopTepAttachResponse } from "@/lib/nopTep";
import { graderGate, lockNopTep, nopTepErr, nopTepJson, removeStoredFiles } from "@/lib/nopTepServer";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { submissionId?: unknown; fileIds?: unknown } | null;
  if (!body || typeof body.submissionId !== "string" || unusableId(body.submissionId) || !Array.isArray(body.fileIds)) return nopTepErr("Thiếu bài nộp hoặc tệp cần gắn.", 400);
  const ids = [...new Set(body.fileIds)];
  if (ids.length < 1 || ids.length > NOP_TEP_MAX_FILES || !ids.every(isNopTepId)) return nopTepErr(`Gắn từ 1 đến ${NOP_TEP_MAX_FILES} tệp.`, 400);

  const sub = await prisma.assignmentSubmission.findUnique({ where: { id: body.submissionId }, select: { id: true, userId: true, assignmentId: true } });
  if (!sub) {
    const g = await graderGate("-");           // người không phải gia sư vẫn nhận 403 như các route chấm khác
    return !g.ok && g.res.status !== 404 ? g.res : nopTepErr("Không tìm thấy bài nộp", 404);
  }
  const gate = await graderGate(sub.assignmentId);
  if (!gate.ok) return gate.res;

  const now = new Date();
  const dropped: { id: string; driver: string; storageKey: string }[] = [];
  const out = await prisma.$transaction(async tx => {
    await lockNopTep(tx, sub.assignmentId, sub.userId);
    const files = await tx.submissionFile.findMany({ where: { id: { in: ids as string[] } } });
    const okAll = files.length === ids.length && files.every(f =>
      f.kind === "tutor_return" && f.status === "ready" && f.ownerUserId === auth.userId && f.assignmentId === sub.assignmentId && f.studentUserId === sub.userId && (f.submissionId === null || f.submissionId === sub.id));
    if (!okAll) return null;
    const fresh = files.filter(f => f.submissionId === null);
    const old = await tx.submissionFile.findMany({ where: { submissionId: sub.id, kind: "tutor_return", status: { in: ["pending", "ready"] }, id: { notIn: ids as string[] } }, select: { id: true, driver: true, storageKey: true } });
    if (old.length) { await tx.submissionFile.updateMany({ where: { id: { in: old.map(o => o.id) } }, data: { status: "removed", removedAt: now } }); dropped.push(...old); }
    if (fresh.length) await tx.submissionFile.updateMany({ where: { id: { in: fresh.map(f => f.id) } }, data: { submissionId: sub.id } });
    const final = await tx.submissionFile.findMany({ where: { id: { in: ids as string[] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return { final, freshCount: fresh.length };
  });
  if (!out) return nopTepErr("Tệp trả bài không hợp lệ (phải là tệp của bạn, đã kiểm xong, cùng bài và cùng học sinh).", 400);
  await removeStoredFiles(dropped);

  if (out.freshCount > 0) {
    const scope = gate.scope;
    await notify(sub.userId, { type: "submission_returned", title: "Gia sư đã trả bài", message: "Bài của bạn đã được trả. Mở để xem điểm và nhận xét.", link: `/student/bai-giang/${scope.lessonId}` });
  }
  const body2: NopTepAttachResponse = { files: out.final.map((r, i) => describeNopTepFile(r, { namesVisible: true, index: i + 1, now })) };
  return nopTepJson(body2 as unknown as Record<string, unknown>);
}
