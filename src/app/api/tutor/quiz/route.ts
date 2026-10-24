// QZ-04 — danh sách quiz của gia sư (để chọn nơi thêm câu khi nhập đề) và tạo quiz nháp mới. Chỉ gia sư; mọi thứ khoá theo chính gia sư đó.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { QUIZ_CATEGORY, dmyFromKey, durationText, logChange, newExamCode, newExamId, todayKeyVN, tutorOwnsCourse } from "@/lib/quizServer";

const TITLE_MAX = 150;

// GET /api/tutor/quiz?editable=1 — quiz của mình; editable=1: chỉ những quiz còn sửa trực tiếp được (chưa ai làm, chưa bị thay bằng bản khác).
export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const editable = new URL(req.url).searchParams.get("editable") === "1";
    const exams = await prisma.exam.findMany({
      where: { ownerId: auth.userId, supersededById: null, ...(editable ? { attempts: { none: {} } } : {}) },
      select: { id: true, title: true, isDraft: true, versionNo: true, questions: true },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    return NextResponse.json({ items: exams }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/quiz]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/tutor/quiz { title, courseId? } — tạo quiz NHÁP (học sinh chưa thấy). Phát hành là bước riêng.
export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const body = await req.json().catch(() => ({})) as { title?: unknown; courseId?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Cô đặt tên cho quiz trước nhé." }, { status: 400 });
    if (title.length > TITLE_MAX) return NextResponse.json({ error: `Tên quiz tối đa ${TITLE_MAX} ký tự.` }, { status: 400 });
    let courseId: string | null = null;
    if (typeof body.courseId === "string" && body.courseId) {
      if (!(await tutorOwnsCourse(auth.userId, body.courseId))) return NextResponse.json({ error: "Không tìm thấy lớp này trong lớp của cô." }, { status: 404 });
      courseId = body.courseId;
    }
    const exam = await prisma.$transaction(async tx => {
      const id = newExamId();
      const created = await tx.exam.create({
        data: {
          id, code: await newExamCode(tx), title, category: QUIZ_CATEGORY, date: dmyFromKey(todayKeyVN()), time: "19:00", duration: durationText(15),
          questions: 0, status: "upcoming", participants: 0, active: false, activeGuest: false, guestCanTake: false, createdAt: new Date().toLocaleDateString("vi-VN"),
          ownerId: auth.userId, courseId, isDraft: true, rootExamId: null, versionNo: 1, totalPoints: 10,
        },
      });
      await logChange(tx, { examId: id, rootExamId: null, actorId: auth.userId, kind: "create", note: "Tạo quiz nháp" });
      return created;
    });
    return NextResponse.json({ id: exam.id }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tutor/quiz]", e);
    return NextResponse.json({ error: "Chưa tạo được quiz. Thử lại sau ít phút." }, { status: 500 });
  }
}
