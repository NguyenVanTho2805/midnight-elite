import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { FEE_MODE_SHEET, isNewFeeMode, pickClassRate, validateFeeSetup, type FeeSetup } from "@/lib/tuitionFee";
import { PREVIEW_BLOCKED_MESSAGE, createInitialFeeRate, moneyPathsBlocked } from "@/lib/feeChargeServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const source = await prisma.course.findUnique({
      where: { id },
      include: {
        // TUT-lich-keo-tha: chép khung giờ đang BẬT sang bản sao (trước đây bản sao mất lịch).
        classSchedules: { where: { active: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        sections: {
          orderBy: { order: "asc" },
          include: {
            chapters: {
              orderBy: { order: "asc" },
              include: { lessons: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });
    if (!source) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    if (!ownsResource(auth, source.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    // HP-15: bản sao của lớp tính phí kiểu mới giữ hình thức + đơn giá hiện hành (lớp mới tạo ra SAU nên được phép); lớp cách cũ → bản sao mặc định như trước.
    let feeSetup: FeeSetup | null = null;
    // HP-LOP-TRUONG: bản sao của lớp theo bảng học phí tháng giữ cách tính + bảng bậc / môn / ngày bắt đầu kỳ (CourseFeeTable), KHÔNG sao dòng học phí của tháng nào.
    const sheetTable = source.feeMode === FEE_MODE_SHEET ? await prisma.courseFeeTable.findUnique({ where: { courseId: source.id } }) : null;
    if (source.feeMode === FEE_MODE_SHEET) {
      if (moneyPathsBlocked()) return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 503 });
    } else if (isNewFeeMode(source.feeMode)) {
      if (moneyPathsBlocked()) return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 503 });
      const rates = await prisma.courseFeeRate.findMany({ where: { courseId: source.id } });
      const cur = pickClassRate(rates, vnDateKeyOf(new Date()));
      if (cur) {
        const v = validateFeeSetup({ mode: source.feeMode, rate: cur.rate, sessionMinutes: cur.sessionMinutes });
        if (v.ok) feeSetup = v.value;
      }
    }

    // Tạo slug mới, tránh trùng
    const baseSlug = `${source.id}-ban-sao`;
    let newSlug = baseSlug;
    let suffix = 2;
    while (await prisma.course.findUnique({ where: { id: newSlug } })) {
      newSlug = `${baseSlug}-${suffix++}`;
    }

    // adminId must be unique — take current max + 1
    const maxAdmin = await prisma.course.aggregate({ _max: { adminId: true } });
    const nextAdminId = (maxAdmin._max.adminId ?? 0) + 1;

    const today = new Date().toLocaleDateString("vi-VN");

    const newCourse = await prisma.$transaction(async tx => {
      const course = await tx.course.create({
        data: {
          id: newSlug, adminId: nextAdminId,
          name: `${source.name} (bản sao)`, adminName: `${source.adminName} (bản sao)`,
          shortTitle: source.shortTitle, category: source.category,
          instructor: source.instructor, teacherAvatar: source.teacherAvatar,
          openDate: source.openDate, types: source.types, tag: source.tag,
          tagColor: source.tagColor, bg: source.bg, strip: source.strip,
          introVideo: source.introVideo, zaloGroupLink: source.zaloGroupLink,
          price: source.price, originalPrice: source.originalPrice,
          lessons: 0, hours: source.hours, status: false, createdAt: today,
          ownerId: auth.userId,
          ...(feeSetup ? { feeMode: feeSetup.mode } : {}),
          ...(source.feeMode === FEE_MODE_SHEET ? { feeMode: FEE_MODE_SHEET } : {}),
        },
      });
      if (feeSetup) await createInitialFeeRate(tx, course.id, feeSetup, auth.userId);
      if (sheetTable) {
        await tx.courseFeeTable.create({
          data: { courseId: course.id, subjects: sheetTable.subjects, tiers: sheetTable.tiers as Prisma.InputJsonValue, periodStartDay: sheetTable.periodStartDay, updatedBy: auth.userId },
        });
      }

      for (const sec of source.sections) {
        const newSec = await tx.section.create({
          data: { id: `s-${crypto.randomUUID()}`, title: sec.title, order: sec.order, courseId: course.id, isImplicit: sec.isImplicit },
        });
        for (const ch of sec.chapters) {
          const newCh = await tx.chapter.create({
            data: { id: `c-${crypto.randomUUID()}`, title: ch.title, order: ch.order, sectionId: newSec.id, isImplicit: ch.isImplicit },
          });
          for (const l of ch.lessons) {
            await tx.lesson.create({
              data: {
                id: `l-${crypto.randomUUID()}`,
                title: l.title, code: l.code, type: l.type, order: l.order,
                videoUrl: l.videoUrl, zoomUrl: l.zoomUrl, azotaUrl: l.azotaUrl,
                azotaDeadline: l.azotaDeadline, duration: l.duration,
                isLocked: l.isLocked, isFree: l.isFree,
                documents: l.documents, adminNote: l.adminNote,
                statsVideos: l.statsVideos, statsMaterials: l.statsMaterials, statsViews: 0,
                chapterId: newCh.id,
                status: l.status,   // BU-02-PHẲNG (R19): bản sao giữ nguyên Nháp/Đã đăng/Ẩn
              },
            });
          }
        }
      }

      if (source.classSchedules.length) {
        await tx.classSchedule.createMany({
          data: source.classSchedules.map(c => ({
            courseId: course.id, dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime,
            note: c.note, joinUrl: c.joinUrl, mode: c.mode, location: c.location, active: true,
          })),
        });
      }

      return course;
    });

    return NextResponse.json({ id: newCourse.id, schedulesCopied: source.classSchedules.length });
  } catch (e) {
    console.error("[POST /api/courses/[id]/duplicate]", e);
    return NextResponse.json({ error: "Sao chép thất bại" }, { status: 500 });
  }
}
