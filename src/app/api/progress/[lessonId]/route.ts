import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LESSON_REWARD, COIN_REASONS, DEFAULT_SOURCE_TYPE_FOR_REASON } from "@/lib/wallet-constants";
import { isEnrollmentActive } from "@/lib/enrollment";

const LESSON_REWARD_REASON = COIN_REASONS.LESSON_REWARD;

// Giây xem hợp lệ: số hữu hạn, không âm, tối đa 24 giờ (một bài không dài hơn). Không phải số → null (không ghi).
function clampSeconds(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.min(Math.floor(v), 86_400);
}

// POST /api/progress/[lessonId] — đánh dấu bài học đã hoàn thành (kèm watchedSeconds tùy chọn)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { lessonId } = await params;
  const body = await req.json().catch(() => ({}));
  // MD-06: chỉ ghi giây xem khi client GỬI một số hợp lệ. Trước đây thiếu thì mặc định 0 và GHI ĐÈ vị trí xem dở về 0 mỗi lần bấm "Đánh dấu xong".
  const sentSeconds = clampSeconds(body.watchedSeconds);

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
    if (!isEnrollmentActive(enrolled)) return NextResponse.json({ error: "Chưa đăng ký khoá học" }, { status: 403 });
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
      create: { userId: session.userId, lessonId, watchedSeconds: sentSeconds ?? 0, completed: true },
      update: { completedAt: new Date(), completed: true, ...(sentSeconds !== null ? { watchedSeconds: sentSeconds } : {}) },
    });

    let coinsEarned = 0;
    if (!alreadyRewarded) {
      await tx.wallet.upsert({
        where: { userId: session.userId },
        create: { userId: session.userId, balance: LESSON_REWARD },
        update: { balance: { increment: LESSON_REWARD } },
      });
      // Gắn sourceType "reward" (xem DEFAULT_SOURCE_TYPE_FOR_REASON) + classId
      // của khoá chứa bài học — cho báo cáo doanh thu/lịch sử ví theo lớp.
      await tx.coinTransaction.create({
        data: {
          userId:     session.userId,
          amount:     LESSON_REWARD,
          reason:     LESSON_REWARD_REASON,
          refId:      lessonId,
          sourceType: DEFAULT_SOURCE_TYPE_FOR_REASON[LESSON_REWARD_REASON],
          classId:    courseId,
        },
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
  const body = await req.json().catch(() => ({}));
  const watchedSeconds = clampSeconds((body as { watchedSeconds?: unknown }).watchedSeconds);
  if (watchedSeconds === null) {
    return NextResponse.json({ error: "watchedSeconds không hợp lệ" }, { status: 400 });
  }

  // Verify enrollment (hoặc bài học thử miễn phí, nhất quán với POST/DELETE)
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
    if (!isEnrollmentActive(enrolled)) return NextResponse.json({ error: "Chưa đăng ký khoá học" }, { status: 403 });
  }

  // MD-06: "đang xem" tách khỏi "đã xong". Hàng MỚI do PATCH tạo là completed=false (trước đây hàng nào có mặt cũng bị đếm là đã xong,
  // nên mới xem 30 giây đã thành "hoàn thành" + cộng vào EXP). Hàng ĐÃ xong thì giữ nguyên cờ và completedAt, chỉ cập nhật vị trí xem.
  const row = await prisma.lessonProgress.upsert({
    where:  { userId_lessonId: { userId: session.userId, lessonId } },
    create: { userId: session.userId, lessonId, watchedSeconds, completed: false },
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
    if (!isEnrollmentActive(enrolled)) return NextResponse.json({ error: "Chưa đăng ký khoá học" }, { status: 403 });
  }

  // "Bỏ đánh dấu xong": giữ lại vị trí xem dở để học sinh vẫn xem tiếp được (trước đây xoá hẳn hàng, mất luôn vị trí).
  await prisma.lessonProgress.updateMany({
    where: { userId: session.userId, lessonId },
    data:  { completed: false },
  });

  return NextResponse.json({ success: true });
}
