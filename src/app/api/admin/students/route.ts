import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeCompletion, computeGpa } from "@/lib/gpa";
import { sendPasswordResetEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.VIEW_STUDENTS);
  if (isNextResponse(auth)) return auth;

  // Optional pagination — không truyền = trả tất cả (backwards compatible)
  const { searchParams } = new URL(req.url);
  const page  = parseInt(searchParams.get("page")  ?? "0");
  const limit = parseInt(searchParams.get("limit") ?? "0");
  const paginate = page > 0 && limit > 0;

  try {
    const [total, users] = await Promise.all([
      paginate ? prisma.user.count({ where: { role: "student" } }) : Promise.resolve(0),
      prisma.user.findMany({
      where: { role: "student" },
      select: {
        id: true, name: true, email: true, phone: true, school: true, createdAt: true,
        enrollments: {
          select: {
            courseId: true,
            course: { select: { name: true, lessons: true } },
          },
        },
        lessonProgress: { select: { lessonId: true } },
        examResults: {
          select: { score: true, totalPoints: true },
          orderBy: { score: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
      ...(paginate ? { skip: (page - 1) * limit, take: limit } : {}),
    }),
    ]);

    // Global offset để tính SBD đúng khi paginate
    const globalOffset = paginate ? (page - 1) * limit : 0;

    // Build courseId → Set<lessonId> map in ONE query (không N+1)
    const allCourseIds = [...new Set(users.flatMap(u => u.enrollments.map(e => e.courseId)))];
    const courseLessons = allCourseIds.length > 0
      ? await prisma.lesson.findMany({
          where: { chapter: { section: { courseId: { in: allCourseIds } } } },
          select: { id: true, chapter: { select: { section: { select: { courseId: true } } } } },
        })
      : [];

    const lessonToCourse = new Map(courseLessons.map(l => [l.id, l.chapter.section.courseId]));

    const result = users.map((u, index) => {
      const enrolledCourseIds = new Set(u.enrollments.map(e => e.courseId));

      // Chỉ đếm lesson progress của các khoá ĐANG enroll — tránh sai khi thu hồi khoá
      const completedLessons = u.lessonProgress.filter(lp => {
        const courseId = lessonToCourse.get(lp.lessonId);
        return courseId ? enrolledCourseIds.has(courseId) : false;
      }).length;

      const totalLessons = u.enrollments.reduce((a, e) => a + (e.course.lessons ?? 0), 0);
      const completion   = computeCompletion(completedLessons, totalLessons);
      const gpa          = computeGpa(completion, u.examResults[0]);
      const sbd          = `MD.${String(globalOffset + index + 1).padStart(5, "0")}`;

      return {
        id:          u.id,
        name:        u.name,
        email:       u.email,
        phone:       u.phone,
        school:      u.school,
        createdAt:   u.createdAt,
        enrollments: u.enrollments.map(e => ({ courseId: e.courseId, courseName: e.course.name })),
        gpa,
        completion,
        sbd,
      };
    });

    // Trả kèm pagination metadata khi có params
    if (paginate) {
      return NextResponse.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/admin/students]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  try {
    const { name, email, phone, school, courseId } = await req.json();
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Thiếu họ tên hoặc email" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Email đã tồn tại" }, { status: 409 });

    // Mật khẩu ngẫu nhiên — không ai biết (kể cả admin); học sinh tự đặt mật khẩu qua email
    const randomPass = randomBytes(24).toString("base64url");
    const hashed = await bcrypt.hash(randomPass, 10);

    const user = await prisma.user.create({
      data: {
        name:          name.trim(),
        email:         email.trim().toLowerCase(),
        password:      hashed,
        phone:         phone?.trim() || null,
        school:        school?.trim() || null,
        role:          "student",
        emailVerified: true,
      },
    });

    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) {
        return NextResponse.json({ error: "Không tìm thấy khoá học để ghi danh" }, { status: 400 });
      }
      await prisma.enrollment.create({ data: { userId: user.id, courseId } });
    }

    // Gửi email cho học sinh để tự đặt mật khẩu (tái dùng luồng reset-password)
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await sendPasswordResetEmail(user.email, user.name, token);

    return NextResponse.json({ id: user.id, name: user.name, email: user.email });
  } catch (e) {
    console.error("[POST /api/admin/students]", e);
    return NextResponse.json({ error: "Lỗi tạo học sinh" }, { status: 500 });
  }
}
