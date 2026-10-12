// NV-189 — báo cáo tháng của MỘT học sinh.
// GET ?yearMonth=  → số liệu từng môn (tính lại từ dữ liệu thật) + các dòng "Điều chưa đạt" KiN gợi ý + bản nháp gia sư đã lưu
//                    + văn bản soạn sẵn. Chỉ học sinh học lớp của chính gia sư; chỉ các lớp của gia sư.
// PUT { items: [{ text, kind? }] } → lưu bản nháp (gia sư đọc, sửa, xoá, thêm dòng). Không đổi gì phụ huynh đang thấy.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { isFutureMonth, isYearMonth, loadStudentMonth } from "@/lib/monthlyReportServer";
import { renderReportText, sanitizeUnmetItems, suggestUnmetItems, type UnmetItem } from "@/lib/monthlyReport";
import { tutorTitle } from "@/lib/classSessions";
import type { Prisma } from "@/generated/prisma/client";

function parseYm(req: NextRequest): string | NextResponse {
  const ym = new URL(req.url).searchParams.get("yearMonth") ?? vnMonthKey(new Date());
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  if (isFutureMonth(ym)) return NextResponse.json({ error: "Chưa tới tháng này" }, { status: 400 });
  return ym;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { studentId } = await params;
  const ym = parseYm(req);
  if (typeof ym !== "string") return ym;

  const data = await loadStudentMonth(auth.userId, studentId, ym);
  // 404 (không 403): không lộ học sinh của gia sư khác có tồn tại hay không.
  if (!data) return NextResponse.json({ error: "Không tìm thấy học sinh trong lớp của bạn" }, { status: 404 });
  const [report, me] = await Promise.all([
    prisma.monthlyReport.findUnique({ where: { tutorId_studentId_yearMonth: { tutorId: auth.userId, studentId, yearMonth: ym } } }),
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
  ]);
  const suggested = suggestUnmetItems(data.subjects, ym, data.changedSessions);
  const draft = (report?.draftItems ?? null) as UnmetItem[] | null;
  const items = draft ?? suggested;
  return NextResponse.json({
    yearMonth: ym, student: data.student, subjects: data.subjects, suggested, items, hasDraft: draft !== null,
    report: { approved: !!report?.approvedAt, approvedAt: report?.approvedAt?.toISOString() ?? null, zaloOpenedAt: report?.zaloOpenedAt?.toISOString() ?? null, approvedItems: (report?.approvedItems ?? null) as UnmetItem[] | null },
    text: renderReportText({ studentName: data.student.name, parentName: data.student.parentName, yearMonth: ym, subjects: data.subjects, unmet: items, tutorName: tutorTitle(me?.name) }),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { studentId } = await params;
  const ym = parseYm(req);
  if (typeof ym !== "string") return ym;
  let body: { items?: unknown } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  const clean = sanitizeUnmetItems(body.items);
  if (!clean.ok) return NextResponse.json({ error: clean.error }, { status: 400 });

  const data = await loadStudentMonth(auth.userId, studentId, ym);
  if (!data) return NextResponse.json({ error: "Không tìm thấy học sinh trong lớp của bạn" }, { status: 404 });
  await prisma.monthlyReport.upsert({
    where: { tutorId_studentId_yearMonth: { tutorId: auth.userId, studentId, yearMonth: ym } },
    create: { tutorId: auth.userId, studentId, yearMonth: ym, draftItems: clean.items as unknown as Prisma.InputJsonValue },
    update: { draftItems: clean.items as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ ok: true, items: clean.items });
}
