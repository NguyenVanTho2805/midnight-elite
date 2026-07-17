import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LESSON_REWARD } from "@/lib/wallet-constants";

const LESSON_REWARD_REASON = "lesson_reward";

// POST /api/progress/[lessonId] — đánh dấu bài học đã hoàn thành (kèm watchedSeconds tùy chọn)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { lessonId } = await params;
  const body = await req.json().catch(() => ({}));
  const watchedSeconds: number = typeof body.watchedSeconds === "number" ? body.watchedSeconds : 0;

  // Verify lesson thuộc khoá học mà student đang enroll (hoặc bài học thử miễn phí)
  const lesson = await prisma.lesson.findUnique({
    where:  { id: lessonId },
    select: { isFree: true, chapter: { select: { section: { select: { courseId: true } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  const courseId = lesson.chapter.section.courseId;
  if (!lesson.isFree) {
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
    });
    if (!enrolled) return NextResponse.json({ error: "Chưa đăng ký khoá học" }, { status: 403 });
  }

  // Thưởng coin chỉ 1 lần/bài học — dựa vào đã từng có giao dịch thưởng cho
  // lessonId này chưa (KHÔNG dựa vào LessonProgress còn tồn tại hay không, vì
  // DELETE xoá hẳn row khi "bỏ đánh dấu" — nếu dựa vào đó, đánh dấu lại sau khi
  // bỏ đánh dấu sẽ bị coi là "lần đầu" và cộng coin lặp lại vô hạn).
  const { row, coinsEarned } = await prisma.$transaction(async (tx) => {
    const alreadyRewarded = await tx.coinTransaction.findFirst({
      where: { userId: session.userId, reason: LESSON_REWARD_REASON, refId: lessonId },
      select: { id: true },
    });

    const row = await tx.lessonProgress.upsert({
      where:  { userId_lessonId: { userId: session.userId, lessonId } },
      create: { userId: session.userId, lessonId, watchedSeconds },
      update: { completedAt: new Date(), watchedSeconds },
    });

    let coinsEarned = 0;
    if (!alreadyRewarded) {
      await tx.wallet.upsert({
        where: { userId: session.userId },
        create: { userId: session.userId, balance: LESSON_REWARD },
        update: { balance: { increment: LESSON_REWARD } },
      });
      await tx.coinTransaction.create({
        data: { userId: session.userId, amount: LESSON_REWARD, reason: LESSON_REWARD_REASON, refId: lessonId },
      });
      coinsEarned = LESSON_REWARD;
    }

    return { row, coinsEarned };
  });

  return NextResponse.json({ ...row, coinsEarned });
}

// PATCH /api/progress/[lessonId] — lưu watchedSeconds mà chưa mark complete
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { lessonId } = await params;
  const { watchedSeconds } = await req.json().catch(() => ({ watchedSeconds: 0 }));
  if (typeof watchedSeconds !== "number" || watchedSeconds < 0) {
    return NextResponse.json({ error: "watchedSeconds không hợp lệ" }, { status: 400 });
  }

  // Verify enrollment
  const lesson = await prisma.lesson.findUnique({
    where:  { id: lessonId },
    select: { chapter: { select: { section: { select: { courseId: true } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  const courseId = lesson.chapter.section.courseId;
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
  });
  if (!enrolled) return NextResponse.json({ error: "Chưa đăng ký khoá học" }, { status: 403 });

  // Chỉ update watchedSeconds — KHÔNG đổi completedAt
  const row = await prisma.lessonProgress.upsert({
    where:  { userId_lessonId: { userId: session.userId, lessonId } },
    create: { userId: session.userId, lessonId, watchedSeconds },
    update: { watchedSeconds },
  });

  return NextResponse.json(row);
}

// DELETE /api/progress/[lessonId] — bỏ đánh dấu (xem lại)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { lessonId } = await params;

  // Verify enrollment (hoặc bài học thử miễn phí) — consistent với POST
  const lesson = await prisma.lesson.findUnique({
    where:  { id: lessonId },
    select: { isFree: true, chapter: { select: { section: { select: { courseId: true } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  const courseId = lesson.chapter.section.courseId;
  if (!lesson.isFree) {
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
    });
    if (!enrolled) return NextResponse.json({ error: "Chưa đăng ký khoá học" }, { status: 403 });
  }

  await prisma.lessonProgress.deleteMany({
    where: { userId: session.userId, lessonId },
  });

  return NextResponse.json({ success: true });
}
