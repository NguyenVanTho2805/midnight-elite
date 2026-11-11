// HP-LOP-TRUONG 4.2 — GET tải mẫu .xlsx của kỳ (money.edit). Mỗi em đang học lớp một hàng, đã điền Mã em + Họ tên. Mọi ô là chuỗi, không công thức.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { periodRange } from "@/lib/hocPhiSheet";
import { hocPhiSheetTemplate, templateFilename, XLSX_MIME } from "@/lib/hocPhiSheetTemplate";
import { resolveYm, sheetFail, sheetGate } from "@/lib/hocPhiSheetServer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await sheetGate(courseId, "money.edit");
  if (!g.ok) return g.res;
  if (!g.isSheet) return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE");
  if (!g.config) return sheetFail(409, "Lớp chưa đặt bảng bậc. Đặt bảng bậc trước khi tải mẫu.", "NO_TABLE");
  const r = resolveYm(req.nextUrl.searchParams.get("ym"), g.config.periodStartDay);
  if (!r.ok) return sheetFail(400, r.error);
  const enr = await prisma.enrollment.findMany({ where: { courseId: g.acc.course.id, status: "active" }, select: { userId: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
  const bytes = await hocPhiSheetTemplate({
    config: g.config, ym: r.ym, periodLabel: periodRange(r.ym, g.config.periodStartDay).label,
    roster: enr.map(e => ({ studentId: e.userId, name: e.user.name ?? "Học sinh" })),
  });
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: { "Content-Type": XLSX_MIME, "Content-Disposition": `attachment; filename="${templateFilename(g.acc.course.id, r.ym)}"`, "Cache-Control": "no-store" },
  });
}
