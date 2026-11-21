// SCL-C (P2-2) — "+ Giao bài" thẳng, không bắt gắn vào bài học.
// GET  → { courses, quizzes }: lớp người này giao bài được (Chủ nhiệm mọi lớp, gia sư lớp mình làm chủ) + quiz CỦA MÌNH đã phát hành (đề gốc, bản đang dùng).
// POST (JSON) { kind: "bai-tap", courseId, title, documents?, dueDate? } → tạo bài tập nộp tệp trong MỘT mục mới (đã đăng) của lớp, tệp đề đã tải lên KiN;
//      { kind: "quiz", courseId, examId } → gắn quiz có sẵn vào lớp (cùng mã đề con). Quiz đã có lượt làm ở lớp khác ⇒ 409.
// Quyền: courseAccess `content.edit.own` (bài tập) / `quiz.assign` (quiz). Trả { ok, href } để trang chuyển về sổ điểm của lớp.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionChecked } from "@/lib/session";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { createLessonForAssignment } from "@/lib/giaoTrinhServer";
import { claimUploadedDocuments } from "@/lib/lessonMediaServer";
import { gradebookCourses } from "@/lib/gradebookServer";
import { isCenterAdmin, isTeacher } from "@/lib/tutorGate";
import { instantOf, isValidDateKey } from "@/lib/classSessions";
import { kinFileIdOf } from "@/lib/giaoTrinh";
import { MAX_DOCUMENTS_PER_LESSON } from "@/lib/mediaStorage";
import { parseGiaoInput } from "@/lib/soDiem";

const NO_STORE = { "Cache-Control": "no-store" };
const bad = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

async function who() {
  const { session } = await getSessionChecked();
  if (!session) return { res: bad(401, "Chưa đăng nhập") };
  if (!isTeacher(session) && !isCenterAdmin(session)) return { res: bad(403, "Chỉ gia sư mới dùng chức năng này") };
  return { session };
}

export async function GET() {
  const w = await who();
  if ("res" in w) return w.res;
  const [courses, quizzes] = await Promise.all([
    gradebookCourses(w.session),
    prisma.exam.findMany({
      where: { ownerId: w.session.userId, isDraft: false, supersededById: null, variantOfId: null, examQuestions: { some: {} } },
      select: { id: true, title: true, courseId: true }, orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);
  return NextResponse.json({ courses, quizzes }, { headers: NO_STORE });
}

/** Danh sách tài liệu từ ô kéo-thả: chỉ tệp đã tải lên KiN (không link ngoài). */
function cleanDocuments(raw: unknown): { name: string; url: string; type?: string }[] | null {
  if (raw === undefined || raw === null || raw === "") return [];
  try {
    const v: unknown = JSON.parse(String(raw));
    if (!Array.isArray(v) || v.length > MAX_DOCUMENTS_PER_LESSON) return null;
    const out = v.map(d => ({ name: String((d as { name?: unknown })?.name ?? "").slice(0, 200), url: String((d as { url?: unknown })?.url ?? ""), type: typeof (d as { type?: unknown })?.type === "string" ? (d as { type: string }).type : undefined }));
    return out.every(d => d.name && kinFileIdOf(d.url)) ? out : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const w = await who();
  if ("res" in w) return w.res;
  const body = await req.json().catch(() => null);
  const p = parseGiaoInput(body, isValidDateKey);
  if (!p.ok) return bad(400, p.error);
  const v = p.v;
  const acc = await requireCourseAccess(v.courseId, v.kind === "quiz" ? "quiz.assign" : "content.edit.own");
  if (!acc.ok) return acc.res;
  const href = `/lop-cua-toi/so-diem?lop=${encodeURIComponent(v.courseId)}&ghi=da-giao`;

  if (v.kind === "quiz") {
    const e = await prisma.exam.findUnique({ where: { id: v.examId }, select: { id: true, ownerId: true, courseId: true, isDraft: true, supersededById: true, variantOfId: true } });
    if (!e || e.isDraft || e.supersededById || e.variantOfId) return bad(404, "Không tìm thấy quiz này.");
    if (e.ownerId !== w.session.userId) return bad(403, "Quiz này không phải của bạn.");
    if (e.courseId !== v.courseId) {
      const used = await prisma.examAttempt.count({ where: { OR: [{ examId: e.id }, { exam: { variantOfId: e.id } }] } });
      if (used > 0) return bad(409, "Quiz này đã có học sinh làm ở lớp khác. Tạo bản sao quiz rồi giao cho lớp này.");
      await prisma.exam.updateMany({ where: { OR: [{ id: e.id }, { variantOfId: e.id }] }, data: { courseId: v.courseId } });
    }
    return NextResponse.json({ ok: true, href }, { headers: NO_STORE });
  }

  const docs = cleanDocuments((body as Record<string, unknown>).documents);
  if (docs === null) return bad(400, "Tệp đề chưa đúng. Kéo thả lại tệp đề.");
  const documents = JSON.stringify(docs);
  const lessonId = await createLessonForAssignment(v.courseId, v.title, documents);
  // Tệp phải của chính người giao và đã tải xong; sai thì bỏ mục vừa tạo (chưa có gì gắn vào nó).
  const claimErr = await claimUploadedDocuments({ documents, lessonId, userId: w.session.userId, isTeacher: isTeacher(w.session) });
  if (claimErr) { await prisma.lesson.delete({ where: { id: lessonId } }); return bad(400, claimErr); }
  await prisma.assignment.create({
    data: {
      lessonId, title: v.title, fileUrl: docs[0]?.url ?? null, fileName: docs[0]?.name ?? null, maxPoints: 10, mode: "file", ownerId: w.session.userId,
      dueDate: v.dueKey ? instantOf(v.dueKey, 23 * 60 + 59) : null,   // hạn nộp = 23:59 ngày đã chọn, giờ VN
    },
  });
  return NextResponse.json({ ok: true, href }, { headers: NO_STORE });
}
