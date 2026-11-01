import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeCompletion, computeGpa, computeAssignmentAverage } from "@/lib/gpa";
import { sendPasswordResetEmail } from "@/lib/email";
import { grantSignupBonus } from "@/lib/wallet";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.VIEW_STUDENTS);
  if (isNextResponse(auth)) return auth;

  // Optional pagination — không truyền = trả tất cả (backwards compatible)
  const { searchParams } = new URL(req.url);
  const page  = parseInt(searchParams.get("page")  ?? "0");
  const limit = parseInt(searchParams.get("limit") ?? "0");
  const paginate = page > 0 && limit > 0;
  // ADM-001: mặc định chỉ trả học sinh đang hiện (deletedAt null); ?includeHidden=1 trả cả bản đã ẩn.
  const includeHidden = searchParams.get("includeHidden") === "1";

  try {
    // ADM-001 (4.7): findMany LUÔN lấy đủ (kể cả bản ẩn) để SBD — vốn là chỉ số trong danh sách theo createdAt — không đánh số lại
    // khi một em bị ẩn; lọc bỏ bản ẩn SAU khi đã gán SBD. count/skip/take cũng tính trên danh sách đầy đủ để offset nhất quán
    // (trang có thể trả ít hơn `limit` dòng). SBD theo chỉ số là điểm yếu có sẵn — nợ P3, không sửa gốc ở đây.
    const [total, users] = await Promise.all([
      paginate ? prisma.user.count({ where: { role: "student" } }) : Promise.resolve(0),
      prisma.user.findMany({
      where: { role: "student" },
      select: {
        id: true, name: true, email: true, phone: true, school: true, createdAt: true, banned: true, deletedAt: true,
        enrollments: {
          select: {
            courseId: true,
            course: { select: { name: true, lessons: true } },
          },
        },
        lessonProgress: { where: { completed: true }, select: { lessonId: true } },
        examResults: {
          select: { score: true, totalPoints: true },
          orderBy: { score: "desc" },
          take: 1,
        },
        assignmentSubmissions: {
          where: { score: { not: null } },
          select: { score: true, assignment: { select: { maxPoints: true } } },
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
      const assignmentAvg = computeAssignmentAverage(
        u.assignmentSubmissions.map(a => ({ score: a.score!, maxPoints: a.assignment.maxPoints }))
      );

      return {
        id:          u.id,
        name:        u.name,
        email:       u.email,
        phone:       u.phone,
        school:      u.school,
        createdAt:   u.createdAt,
        banned:      u.banned,
        deletedAt:   u.deletedAt, // ADM-001: ISO hoặc null — màn chỉ suy "đã ẩn" từ cột này, không từ `banned`
        enrollments: u.enrollments.map(e => ({ courseId: e.courseId, courseName: e.course.name })),
        gpa,
        completion,
        assignmentAvg,
        sbd,
      };
    });

    const visible = includeHidden ? result : result.filter(r => r.deletedAt === null);

    // Trả kèm pagination metadata khi có params
    if (paginate) {
      return NextResponse.json({ data: visible, total, page, limit, pages: Math.ceil(total / limit) });
    }
    return NextResponse.json(visible);
  } catch (e) {
    console.error("[GET /api/admin/students]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  try {
    // BE-078 (chốt 06/10/2026): route này CHỈ tạo tài khoản. Gán lớp đi riêng
    // qua POST /api/admin/enrollments — 1 chỗ duy nhất tạo Enrollment từ phía
    // admin, để status/kiểm tra lớp không bị viết lặp ở 2 nơi.
    const { name, email, phone, school } = await req.json();
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Thiếu họ tên hoặc email" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, deletedAt: true } });
    if (existing?.deletedAt) {
      // ADM-001: email thuộc một em đã ẩn → chỉ cho khôi phục, không tạo bản trùng.
      return NextResponse.json({ error: "Email này thuộc một học sinh đã ẩn. Khôi phục thay vì tạo mới.", code: "hidden_exists" }, { status: 409 });
    }
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

    await grantSignupBonus(user.id);

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
