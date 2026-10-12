// NV-189 — danh sách học sinh của gia sư + trạng thái báo cáo tháng (chưa soạn / nháp / đã duyệt).
// GET ?yearMonth=YYYY-MM (mặc định tháng này, giờ VN; không nhận tháng chưa tới).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { isFutureMonth, isYearMonth, listTutorStudents } from "@/lib/monthlyReportServer";

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const ym = new URL(req.url).searchParams.get("yearMonth") ?? vnMonthKey(new Date());
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  if (isFutureMonth(ym)) return NextResponse.json({ error: "Chưa tới tháng này" }, { status: 400 });

  const [students, reports] = await Promise.all([
    listTutorStudents(auth.userId),
    prisma.monthlyReport.findMany({ where: { tutorId: auth.userId, yearMonth: ym }, select: { studentId: true, draftItems: true, approvedItems: true, approvedAt: true, zaloOpenedAt: true } }),
  ]);
  const byStudent = new Map(reports.map(r => [r.studentId, r]));
  const items = students.map(s => {
    const r = byStudent.get(s.id);
    const status = !r ? "none" : r.approvedAt ? "approved" : "draft";
    return {
      studentId: s.id, name: s.name, courses: s.courses.map(c => c.name), status,
      approvedAt: r?.approvedAt?.toISOString() ?? null,
      zaloOpenedAt: r?.zaloOpenedAt?.toISOString() ?? null,
      // Đã duyệt nhưng sau đó có sửa bản nháp: phụ huynh vẫn thấy bản cũ cho tới khi duyệt lại.
      changedSinceApproval: !!r?.approvedAt && JSON.stringify(r.draftItems ?? null) !== JSON.stringify(r.approvedItems ?? null),
    };
  });
  return NextResponse.json({
    yearMonth: ym, items,
    summary: { total: items.length, approved: items.filter(i => i.status === "approved").length, draft: items.filter(i => i.status === "draft").length, none: items.filter(i => i.status === "none").length },
  });
}
