import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";
import { limitOrBlock } from "@/lib/rate-limit";

const BATCH_SIZE  = 20;
const BATCH_DELAY = 1000; // ms

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const blocked = limitOrBlock(`admin:${auth.userId}`, "remind-all", 3, 300_000); // 3 lần/5 phút — gửi hàng loạt
  if (blocked) return blocked;

  const { message, courseId } = await req.json().catch(() => ({} as { message?: string; courseId?: string }));
  if (!message?.trim()) {
    return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });
  }
  // QT-07: nhắc hàng loạt CHỈ theo một lớp. Không còn gửi cho toàn nền tảng (trước đây gửi cho mọi học sinh của mọi trung tâm).
  if (typeof courseId !== "string" || !courseId) {
    return NextResponse.json({ error: "Chọn một lớp để nhắc. KiN không nhắc hàng loạt toàn nền tảng." }, { status: 400 });
  }
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const students = await prisma.user.findMany({
    where:  { role: "student", enrollments: { some: { courseId, status: "active" } } },
    select: { name: true, email: true },
  });

  let sent = 0;

  // Gửi từng batch 20, delay 1s giữa các batch — tránh Resend rate limit
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch   = students.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(s => sendReminderEmail(s.email, s.name, message.trim()))
    );
    sent += results.filter(r => r.status === "fulfilled").length;
    if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY);
  }

  return NextResponse.json({ sent, total: students.length });
}
