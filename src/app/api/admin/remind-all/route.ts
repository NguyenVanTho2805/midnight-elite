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

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });
  }

  const students = await prisma.user.findMany({
    where:  { role: "student" },
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
