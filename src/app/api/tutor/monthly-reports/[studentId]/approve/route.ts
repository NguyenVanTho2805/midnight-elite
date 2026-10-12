// NV-189 — gia sư DUYỆT báo cáo: bản đang đọc trên màn hình trở thành bản phụ huynh thấy trên "Sổ của con".
// POST ?yearMonth= { items }  → đóng băng số liệu từng môn lúc này (snapshot) + các dòng "Điều chưa đạt" đã duyệt.
// DELETE ?yearMonth=          → gỡ khỏi Sổ của con (phụ huynh không còn thấy; bản nháp giữ nguyên).
// Mục "Điều chưa đạt" luôn có trong báo cáo, kể cả khi rỗng.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { isFutureMonth, isYearMonth, loadStudentMonth } from "@/lib/monthlyReportServer";
import { renderReportText, sanitizeUnmetItems } from "@/lib/monthlyReport";
import { tutorTitle } from "@/lib/classSessions";
import { Prisma } from "@/generated/prisma/client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { studentId } = await params;
  const ym = new URL(req.url).searchParams.get("yearMonth") ?? vnMonthKey(new Date());
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  if (isFutureMonth(ym)) return NextResponse.json({ error: "Chưa tới tháng này" }, { status: 400 });
  let body: { items?: unknown } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  const clean = sanitizeUnmetItems(body.items);
  if (!clean.ok) return NextResponse.json({ error: clean.error }, { status: 400 });

  const data = await loadStudentMonth(auth.userId, studentId, ym);
  if (!data) return NextResponse.json({ error: "Không tìm thấy học sinh trong lớp của bạn" }, { status: 404 });
  const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
  const now = new Date();
  const items = clean.items as unknown as Prisma.InputJsonValue;
  const snapshot = { subjects: data.subjects, studentName: data.student.name } as unknown as Prisma.InputJsonValue;
  await prisma.monthlyReport.upsert({
    where: { tutorId_studentId_yearMonth: { tutorId: auth.userId, studentId, yearMonth: ym } },
    create: { tutorId: auth.userId, studentId, yearMonth: ym, draftItems: items, approvedItems: items, approvedSnapshot: snapshot, approvedAt: now },
    // Duyệt lại là một bản mới: chưa ai mở Zalo cho bản này.
    update: { draftItems: items, approvedItems: items, approvedSnapshot: snapshot, approvedAt: now, zaloOpenedAt: null },
  });
  return NextResponse.json({
    ok: true, approvedAt: now.toISOString(),
    text: renderReportText({ studentName: data.student.name, parentName: data.student.parentName, yearMonth: ym, subjects: data.subjects, unmet: clean.items, tutorName: tutorTitle(me?.name) }),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { studentId } = await params;
  const ym = new URL(req.url).searchParams.get("yearMonth") ?? vnMonthKey(new Date());
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  const r = await prisma.monthlyReport.updateMany({
    where: { tutorId: auth.userId, studentId, yearMonth: ym, approvedAt: { not: null } },
    data: { approvedItems: Prisma.DbNull, approvedSnapshot: Prisma.DbNull, approvedAt: null, zaloOpenedAt: null },
  });
  if (r.count === 0) return NextResponse.json({ error: "Báo cáo này chưa được duyệt" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
