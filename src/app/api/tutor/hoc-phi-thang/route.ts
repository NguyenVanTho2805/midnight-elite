// HOCPHI-THEO-BUOI 4.3 — bảng học phí theo lớp × tháng của GIA SƯ (chỉ đọc).
// GET ?ym=YYYY-MM[&courseId=][&format=csv]. Tháng = dương lịch giờ VN (khoá FeeCharge.yearMonth), mặc định tháng hiện tại.
// Quyền: gia sư ĐÃ DUYỆT (requireTutorOnly): 401 chưa đăng nhập; học sinh / gia sư chờ duyệt / quản trị 403. Không có tên / ID học sinh ở đầu ra.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { isYearMonth, monthTableCsvRows } from "@/lib/hocPhiDashboard";
import { loadMonthTable } from "@/lib/hocPhiDashboardServer";
import { toCsv, vnMonthKey } from "@/lib/revenue";

export async function GET(req: NextRequest) {
  const auth = await requireTutorOnly();
  if (isNextResponse(auth)) return auth;

  const sp = new URL(req.url).searchParams;
  const now = vnMonthKey(new Date());
  const ymRaw = sp.get("ym");
  const ym = ymRaw === null || ymRaw === "" ? now : ymRaw;
  if (!isYearMonth(ym)) return NextResponse.json({ error: "Tháng phải có dạng YYYY-MM" }, { status: 400 });
  if (ym > now) return NextResponse.json({ error: "Chưa tới tháng này" }, { status: 400 });

  const courseId = sp.get("courseId") || undefined;
  if (courseId) {
    const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
    if (!c) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
    if (c.ownerId !== auth.userId) return NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 });
  }

  try {
    const table = await loadMonthTable({ tutorId: auth.userId }, ym, { courseId, hideInactive: true });
    if (sp.get("format") === "csv") {
      return new NextResponse(toCsv(monthTableCsvRows(table)), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="hoc-phi-thang-${ym}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(table, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/hoc-phi-thang]", e);
    return NextResponse.json({ error: "Không tải được bảng học phí tháng" }, { status: 500 });
  }
}
