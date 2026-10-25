// PT-05 — sổ điểm và tiến bộ theo học sinh / lớp cho GIA SƯ CHỦ LỚP. Chỉ đọc số đã có (chuyên cần, bài về nhà, bài kiểm tra),
// không thu điểm mới; điểm tự luận chưa công bố không được tính (examHold). Tên học sinh chỉ có ở đây vì gọi bởi gia sư chủ lớp.
// GET ?yearMonth=YYYY-MM (mặc định tháng này, giờ VN)&courseId=<lớp của mình>  → lớp người khác 403, không có 404.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { isFutureMonth, isYearMonth } from "@/lib/monthlyReportServer";
import { loadTutorGradebook } from "@/lib/gradebookServer";

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const sp = new URL(req.url).searchParams;
  const ym = sp.get("yearMonth") ?? vnMonthKey(new Date());
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  if (isFutureMonth(ym)) return NextResponse.json({ error: "Chưa tới tháng này" }, { status: 400 });
  const courseId = sp.get("courseId");
  if (courseId) {
    const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
    if (!c) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
    if (c.ownerId !== auth.userId) return NextResponse.json({ error: "Đây không phải lớp của bạn" }, { status: 403 });
  }
  const g = await loadTutorGradebook(auth.userId, ym, courseId);
  return NextResponse.json(g, { headers: { "Cache-Control": "no-store" } });
}
