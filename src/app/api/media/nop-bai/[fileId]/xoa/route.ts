// BU-HS-NOP-TEP A5 — bỏ một tệp: học sinh bỏ tệp CỦA MÌNH (nháp, hoặc đã nộp), gia sư bỏ tệp MÌNH trả. Người khác ⇒ 404 (không lộ tồn tại).
// Đặt "removed" rồi xoá tệp gốc ngay (lỗi mạng ⇒ giữ removed với deletedAt null để cron bước 3 thử lại). Không bao giờ xoá hàng ở đây.
// Học sinh bỏ tệp ĐÃ NỘP: bài đã chấm thì phải xác nhận ({"confirm":true}) vì điểm/nhận xét/tệp gia sư trả bị xoá như khi nộp lại; không bỏ được tệp CUỐI CÙNG (hãy nộp lại).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { NOP_TEP_API, isNopTepId } from "@/lib/nopTep";
import { graderGate, lockNopTep, nopTepErr, nopTepJson, removeStoredFiles, studentGate } from "@/lib/nopTepServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { fileId } = await params;
  if (!isNopTepId(fileId)) return nopTepErr("Không tìm thấy tệp.", 404);
  const body = await req.json().catch(() => null) as { confirm?: unknown } | null;
  const confirm = body?.confirm === true;

  const row = await prisma.submissionFile.findUnique({ where: { id: fileId } });
  if (!row || row.ownerUserId !== auth.userId) return nopTepErr("Không tìm thấy tệp.", 404);
  const gate = row.kind === "tutor_return" ? await graderGate(row.assignmentId) : await studentGate(row.assignmentId);
  if (!gate.ok) return gate.res;
  if (row.status === "removed" || row.status === "expired") return nopTepJson({ ok: true, href: NOP_TEP_API.file(row.id) });

  const extra: { id: string; driver: string; storageKey: string }[] = [];
  const out = await prisma.$transaction(async tx => {
    await lockNopTep(tx, row.assignmentId, row.studentUserId);
    const cur = await tx.submissionFile.findUnique({ where: { id: row.id } });
    if (!cur || cur.status === "removed" || cur.status === "expired") return { state: "ok" as const };
    const now = new Date();
    if (cur.kind === "student" && cur.submissionId) {
      const sub = await tx.assignmentSubmission.findUnique({ where: { id: cur.submissionId }, select: { id: true, gradedAt: true } });
      const remaining = await tx.submissionFile.findMany({
        where: { submissionId: cur.submissionId, kind: "student", status: "ready", id: { not: cur.id } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, originalName: true },
      });
      if (remaining.length === 0) return { state: "last" as const };
      if (sub?.gradedAt && !confirm) return { state: "graded" as const };
      await tx.submissionFile.update({ where: { id: cur.id }, data: { status: "removed", removedAt: now } });
      if (sub) {
        await tx.assignmentSubmission.update({
          where: { id: sub.id },
          data: { fileUrl: NOP_TEP_API.file(remaining[0].id), fileName: remaining[0].originalName, ...(sub.gradedAt ? { score: null, comment: null, gradedAt: null, gradedBy: null } : {}) },
        });
        if (sub.gradedAt) {
          const ret = await tx.submissionFile.findMany({ where: { submissionId: sub.id, kind: "tutor_return", status: { in: ["pending", "ready"] } }, select: { id: true, driver: true, storageKey: true } });
          if (ret.length) { await tx.submissionFile.updateMany({ where: { id: { in: ret.map(r => r.id) } }, data: { status: "removed", removedAt: now } }); extra.push(...ret); }
        }
      }
      return { state: "ok" as const };
    }
    await tx.submissionFile.update({ where: { id: cur.id }, data: { status: "removed", removedAt: now } });
    return { state: "ok" as const };
  });
  if (out.state === "last") return nopTepErr("Đây là tệp duy nhất của bài đã nộp. Hãy nộp lại bằng tệp khác để thay.", 409, { code: "last_file" });
  if (out.state === "graded") return nopTepErr("Bài đã được chấm. Bỏ tệp sẽ xoá điểm, nhận xét và tệp gia sư đã trả.", 409, { code: "graded_confirm" });

  await removeStoredFiles([row, ...extra]);
  return nopTepJson({ ok: true });
}
