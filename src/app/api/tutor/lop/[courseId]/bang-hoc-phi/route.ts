// HP-LOP-TRUONG 4.2 — GET bảng học phí của lớp theo kỳ (money.view: chủ lớp + quản trị). Chỉ ĐỌC.
// 401 → 403 → 404 lớp → 403 người lạ → 403 ROLE_FORBIDDEN (gia sư bộ môn / đồng giảng). Thân lỗi không có tên lớp, tên em, số tiền.
import { NextRequest } from "next/server";
import { FEE_MODE_SHEET } from "@/lib/tuitionFee";
import { currentPeriodId } from "@/lib/hocPhiSheet";
import { vnDateKeyOf } from "@/lib/classSessions";
import { enableBlockOf, loadSheetView, moneyHistoryOf, periodInfo, resolveYm, sheetFail, sheetGate, sheetOk, suggestedConfigFor } from "@/lib/hocPhiSheetServer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await sheetGate(courseId, "money.view");
  if (!g.ok) return g.res;
  const { acc, config } = g;
  const course = { id: acc.course.id, ownerId: acc.course.ownerId };

  if (!g.isSheet) {
    const b = await enableBlockOf(acc.course);
    return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE", {
      canEnable: b.canEnable, enableBlockedReason: b.reason, sharedStudents: b.sharedStudents, suggestedConfig: await suggestedConfigFor(course.ownerId, course.id),
    });
  }

  const startDay = config?.periodStartDay ?? 1;
  const r = resolveYm(req.nextUrl.searchParams.get("ym"), startDay);
  if (!r.ok) return sheetFail(400, r.error);

  const h = await moneyHistoryOf(course.id);
  const base = {
    feeMode: FEE_MODE_SHEET, yearMonth: r.ym, period: periodInfo(r.ym, startDay),
    currentYearMonth: currentPeriodId(vnDateKeyOf(new Date()), startDay),
    config, canEnable: h.feeCharges === 0 && h.monthlyFees === 0,
    suggestedConfig: config ? null : await suggestedConfigFor(course.ownerId, course.id),
  };
  if (!config) return sheetOk({ ...base, rows: [], totals: { filled: 0, unfilled: 0, net: 0 } });
  return sheetOk({ ...base, ...(await loadSheetView(course, config, r.ym)) });
}
