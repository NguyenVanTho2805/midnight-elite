// PH-223 — kế hoạch buổi 4 hoạt động của gia sư.
//   GET  ?courseId= → danh sách kế hoạch CỦA MÌNH (mới sửa trước)
//   POST { courseId, title?, dateKey? } → tạo kế hoạch trống (4 hoạt động rỗng) cho lớp của mình
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { emptyActivities, filledCount, isDateKey, readActivities, totalMinutes, TITLE_MAX } from "@/lib/sessionPlan";

const MAX_PLANS = 500;

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const courseId = new URL(req.url).searchParams.get("courseId");
  const rows = await prisma.sessionPlan.findMany({
    where: { tutorId: auth.userId, ...(courseId ? { courseId } : {}) },
    orderBy: { updatedAt: "desc" }, take: 200,
  });
  const courses = await prisma.course.findMany({ where: { ownerId: auth.userId }, select: { id: true, name: true } });
  const nameOf = new Map(courses.map(c => [c.id, c.name]));
  return NextResponse.json({
    items: rows.map(r => {
      const acts = readActivities(r.activities);
      return { id: r.id, courseId: r.courseId, courseName: nameOf.get(r.courseId) ?? "", title: r.title, dateKey: r.dateKey, filled: filledCount(acts), minutes: totalMinutes(acts), updatedAt: r.updatedAt.toISOString() };
    }),
    courses,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { courseId?: unknown; title?: unknown; dateKey?: unknown } | null;
  if (typeof body?.courseId !== "string" || !body.courseId) return NextResponse.json({ error: "Hãy chọn lớp" }, { status: 400 });
  const dateKey = body.dateKey === undefined || body.dateKey === null || body.dateKey === "" ? null : body.dateKey;
  if (dateKey !== null && !isDateKey(dateKey)) return NextResponse.json({ error: "Ngày dạy không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
  if (body.title !== undefined && body.title !== null && typeof body.title !== "string") return NextResponse.json({ error: "Tên phải là chữ" }, { status: 400 });
  const titleIn = typeof body.title === "string" ? body.title.trim() : "";
  if (titleIn.length > TITLE_MAX) return NextResponse.json({ error: `Tên kế hoạch tối đa ${TITLE_MAX} ký tự` }, { status: 400 });
  const course = await prisma.course.findFirst({ where: { id: body.courseId, ownerId: auth.userId }, select: { id: true, name: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if ((await prisma.sessionPlan.count({ where: { tutorId: auth.userId } })) >= MAX_PLANS) return NextResponse.json({ error: `Tối đa ${MAX_PLANS} kế hoạch — xoá bớt kế hoạch cũ` }, { status: 409 });
  const title = titleIn || (dateKey ? `Buổi ${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}` : "Buổi mới");
  const row = await prisma.sessionPlan.create({ data: { courseId: course.id, tutorId: auth.userId, dateKey, title, goal: null, activities: emptyActivities() as unknown as object } });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
