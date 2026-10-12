// NV-189 / TT-199 giai đoạn 1 — ghi nhận "Đã mở Zalo lúc …" cho báo cáo tháng đã duyệt.
// KiN chỉ biết gia sư ĐÃ MỞ Zalo với tin soạn sẵn, không biết tin có đi thật hay không → không bao giờ ghi "đã gửi".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { isYearMonth } from "@/lib/monthlyReportServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { studentId } = await params;
  const ym = new URL(req.url).searchParams.get("yearMonth") ?? "";
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  const now = new Date();
  const r = await prisma.monthlyReport.updateMany({ where: { tutorId: auth.userId, studentId, yearMonth: ym, approvedAt: { not: null } }, data: { zaloOpenedAt: now } });
  if (r.count === 0) return NextResponse.json({ error: "Hãy duyệt báo cáo trước khi gửi cho phụ huynh" }, { status: 409 });
  return NextResponse.json({ ok: true, openedAt: now.toISOString() });
}
