// BU-HS-NOP-TEP A8 — học sinh CHỐT bài nộp bằng tệp. FORM POST thường + 303 về /student/bai-giang/<lessonId>?nop=<mã> (luật kho 5.5; mã, không dán chữ người dùng vào URL).
// Mọi mốc giờ (submittedAt) do MÁY CHỦ đặt. Một $transaction dưới khoá advisory (bài, học sinh): lấy các tệp "ready" CHƯA gắn của học sinh này ở bài này (1–3 tệp),
// upsert AssignmentSubmission { kind:"tep", fileUrl:"/api/media/nop-bai/<tệp đầu>" (đường riêng tư, KHÔNG phải URL công khai), fileName: tên đầu đã làm sạch }.
// Nộp lại: xoá điểm/nhận xét như hành vi cũ, đặt "removed" mọi tệp cũ (kể cả tệp gia sư đã trả: nhận xét cũ cũng bị xoá), xoá kho SAU giao dịch.
// Bấm đúp / hai tab / 5 yêu cầu song song: yêu cầu sau không còn tệp "chưa gắn" nhưng bài nộp đã có đúng các tệp ấy ⇒ coi là thành công (idempotent), vẫn 303 ?nop=ok.
// `fileId` do trình duyệt gửi KHÔNG được dùng: chỉ tệp CỦA HỌC SINH NÀY, kind "student", "ready", chưa gắn.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { isEnrollmentActive } from "@/lib/enrollment";
import { isLearnerVisible } from "@/lib/lessonStatus";
import { notify } from "@/lib/notify";
import { NOP_TEP_API, NOP_TEP_MAX_FILES, NOP_TEP_RESULT, NOP_TEP_SUBMISSION_KIND, type NopTepResultCode } from "@/lib/nopTep";
import { loadAssignmentScope, lockNopTep, nopTepErr, nopTepRuntimeConfig, removeStoredFiles } from "@/lib/nopTepServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") return nopTepErr("Chỉ học sinh mới nộp được bài tập", 403);
  const { assignmentId } = await params;

  const scope = await loadAssignmentScope(assignmentId);
  // Bài Nháp/Ẩn ⇒ 404 TRƯỚC kiểm ghi danh (như submit/route.ts).
  if (!scope || !isLearnerVisible(scope.lessonStatus) || scope.mode === "azota" || assignmentId.startsWith("azota-")) return nopTepErr("Không tìm thấy bài tập", 404);
  const back = (code: NopTepResultCode) => NextResponse.redirect(new URL(`/student/bai-giang/${encodeURIComponent(scope.lessonId)}?nop=${code}`, req.url), 303);

  const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: auth.userId, courseId: scope.courseId } }, select: { status: true } });
  if (!isEnrollmentActive(enrolled)) return back(NOP_TEP_RESULT.classDenied);
  if (!nopTepRuntimeConfig().enabled) return back(NOP_TEP_RESULT.off);

  const now = new Date();
  const dropped: { id: string; driver: string; storageKey: string }[] = [];
  const out = await prisma.$transaction(async tx => {
    await lockNopTep(tx, assignmentId, auth.userId);
    const files = await tx.submissionFile.findMany({
      where: { assignmentId, studentUserId: auth.userId, ownerUserId: auth.userId, kind: "student", status: "ready", submissionId: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: NOP_TEP_MAX_FILES + 1,
    });
    const existing = await tx.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId, userId: auth.userId } }, select: { id: true, kind: true } });

    if (files.length === 0) {
      // Yêu cầu trùng: bài nộp đã có tệp gắn sẵn ⇒ thành công, không đổi gì.
      if (existing && existing.kind === NOP_TEP_SUBMISSION_KIND && await tx.submissionFile.count({ where: { submissionId: existing.id, kind: "student", status: "ready" } }) > 0) return { state: "again" as const };
      return { state: "none" as const };
    }
    const use = files.slice(0, NOP_TEP_MAX_FILES);   // hạn mức 3 đã được init/complete giữ; cắt thêm để chắc
    const first = use[0];
    const data = { kind: NOP_TEP_SUBMISSION_KIND, fileUrl: NOP_TEP_API.file(first.id), fileName: first.originalName, submittedAt: now };

    let submissionId: string;
    if (existing) {
      const olds = await tx.submissionFile.findMany({ where: { submissionId: existing.id, status: { in: ["pending", "ready"] } }, select: { id: true, driver: true, storageKey: true } });
      if (olds.length) { await tx.submissionFile.updateMany({ where: { id: { in: olds.map(o => o.id) } }, data: { status: "removed", removedAt: now } }); dropped.push(...olds); }
      await tx.assignmentSubmission.update({ where: { id: existing.id }, data: { ...data, score: null, comment: null, gradedAt: null, gradedBy: null } });
      submissionId = existing.id;
    } else {
      submissionId = (await tx.assignmentSubmission.create({ data: { assignmentId, userId: auth.userId, ...data }, select: { id: true } })).id;
    }
    await tx.submissionFile.updateMany({ where: { id: { in: use.map(u => u.id) } }, data: { submissionId } });
    return { state: "ok" as const };
  });

  if (out.state === "none") return back(NOP_TEP_RESULT.noFile);
  if (out.state === "again") return back(NOP_TEP_RESULT.ok);
  await removeStoredFiles(dropped);

  // Báo người chấm (chỉ trong ứng dụng): chủ lớp, hoặc giáo viên bộ môn của nhóm chứa bài (+ người soạn bài). Đồng giảng không bị báo (tránh spam). KHÔNG tên học sinh/tên tệp/tên bài/số lượng.
  const recipients = new Set<string>();
  const grader = scope.chapterTeacherId ?? scope.courseOwnerId;
  if (grader) recipients.add(grader);
  if (scope.ownerId) recipients.add(scope.ownerId);
  for (const uid of recipients) {
    await notify(uid, { type: "submission_received", title: "Có bài nộp mới", message: "Một học sinh vừa nộp bài. Mở để xem và chấm.", link: "/lop-cua-toi/bai-tap" });
  }
  return back(NOP_TEP_RESULT.ok);
}
