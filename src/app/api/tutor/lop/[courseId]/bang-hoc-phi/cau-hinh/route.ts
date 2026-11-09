// HP-LOP-TRUONG 4.2 — PUT bảng bậc + môn + ngày bắt đầu kỳ thu của lớp (money.edit: chủ lớp + quản trị). `enable:true` bật chế độ cho lớp CHƯA phát sinh tiền.
// Không có đường quay lại cách cũ. Ghi AuditLog fee_sheet.config; quản trị (khác chủ lớp) ghi thì báo chủ lớp (loại course_fee_override, chống dội).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { FEE_MODE_SHEET, normalizeFeeMode } from "@/lib/tuitionFee";
import { moneyPathsBlocked } from "@/lib/feeChargeServer";
import { validatePeriodStartDay, validateSubjects, validateTiers, type Tier } from "@/lib/hocPhiSheet";
import { auditSheetWrite, enableBlockOf, msgSharesLegacy, previewBlocked, sheetFail, sheetGate, sheetOk } from "@/lib/hocPhiSheetServer";
import type { Prisma } from "@/generated/prisma/client";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await sheetGate(courseId, "money.edit");
  if (!g.ok) return g.res;
  if (moneyPathsBlocked()) return previewBlocked();
  const { acc } = g;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return sheetFail(400, "Thân yêu cầu phải là JSON");
  const sub = validateSubjects(body.subjects);
  if (!sub.ok) return sheetFail(400, sub.error);
  const tiers = validateTiers(body.tiers);
  if (!tiers.ok) return sheetFail(400, tiers.error);
  let startDay: number | undefined;
  if (body.periodStartDay !== undefined && body.periodStartDay !== null) {
    const v = validatePeriodStartDay(body.periodStartDay);
    if (!v.ok) return sheetFail(400, v.error);
    startDay = v.value;
  }
  if (body.enable !== undefined && typeof body.enable !== "boolean") return sheetFail(400, "enable phải là true hoặc false");
  const enable = body.enable === true;
  const previousFeeMode = normalizeFeeMode(acc.course.feeMode);
  const isSheet = previousFeeMode === FEE_MODE_SHEET;

  if (!isSheet && !enable) {
    const b = await enableBlockOf(acc.course);
    return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE", { canEnable: b.canEnable, enableBlockedReason: b.reason, sharedStudents: b.sharedStudents });
  }

  type Out = { ok: true; config: { subjects: string[]; tiers: Tier[]; periodStartDay: number } } | { ok: false; res: ReturnType<typeof sheetFail> };
  const out: Out = await prisma.$transaction(async (tx): Promise<Out> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course-fee-config:${acc.course.id}`}))`;
    // Đọc lại trong giao dịch: người khác có thể vừa đổi cách tính / vừa thêm dòng.
    const course = await tx.course.findUnique({ where: { id: acc.course.id }, select: { feeMode: true } });
    const nowSheet = normalizeFeeMode(course?.feeMode) === FEE_MODE_SHEET;
    if (!nowSheet) {
      if (!enable) return { ok: false, res: sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE") };
      const b = await enableBlockOf({ id: acc.course.id, ownerId: acc.course.ownerId, feeMode: course?.feeMode }, tx);
      if (b.reason === "HAS_MONEY_HISTORY") {
        return { ok: false, res: sheetFail(409, "Lớp đã phát sinh học phí nên không chuyển sang bảng tháng được. Hãy tạo lớp mới.", "HAS_MONEY_HISTORY", { feeCharges: b.feeCharges, monthlyFees: b.monthlyFees }) };
      }
      // Lật feeMode làm lớp rời legacyEnrollments → em học thêm lớp cách cũ khác rơi bậc đơn giá ở các phiếu chưa lập của lớp đó. Dừng trước khi lật.
      if (b.reason === "SHARES_LEGACY_STUDENTS") {
        return { ok: false, res: sheetFail(409, msgSharesLegacy(b.sharedStudents), "SHARES_LEGACY_STUDENTS", { sharedStudents: b.sharedStudents }) };
      }
      await tx.course.update({ where: { id: acc.course.id }, data: { feeMode: FEE_MODE_SHEET } });
    }
    const cur = await tx.courseFeeTable.findUnique({ where: { courseId: acc.course.id }, select: { periodStartDay: true, subjects: true } });
    const day = startDay ?? cur?.periodStartDay ?? 1;
    const dayChanged = day !== (cur?.periodStartDay ?? 1);
    // Dòng cũ lưu `sessions` theo NHÃN môn: bỏ / đổi nhãn một môn đã có thì dòng cũ hiện 0 buổi mà Phải đóng vẫn có số. So nhãn đúng từng ký tự (đổi hoa / thường cũng lệch khoá).
    const droppedSubject = !!cur && cur.subjects.some(s => !sub.value.includes(s));
    if (dayChanged || droppedSubject) {
      const rows = await tx.courseFeeSheetRow.count({ where: { courseId: acc.course.id } });
      if (rows > 0 && dayChanged) return { ok: false, res: sheetFail(409, "Lớp đã có dòng học phí nên không đổi ngày bắt đầu kỳ thu được.", "HAS_ROWS", { rows }) };
      if (rows > 0) return { ok: false, res: sheetFail(409, "Lớp đã có dòng học phí nên không đổi tên hay bỏ môn đã có dòng học phí; thêm môn mới hoặc đổi bậc thì được.", "HAS_ROWS", { rows }) };
    }
    const data = { subjects: sub.value, tiers: tiers.value as unknown as Prisma.InputJsonValue, periodStartDay: day, updatedBy: acc.session.userId };
    await tx.courseFeeTable.upsert({ where: { courseId: acc.course.id }, create: { courseId: acc.course.id, ...data }, update: data });
    return { ok: true, config: { subjects: sub.value, tiers: tiers.value, periodStartDay: day } };
  }, { timeout: 15_000 });
  if (!out.ok) return out.res;

  const override = await auditSheetWrite(acc, "fee_sheet.config", {
    subjects: sub.value.length, tiers: tiers.value.length, periodStartDay: out.config.periodStartDay, enabled: !isSheet, previousFeeMode,
  });
  return sheetOk({ ok: true, feeMode: FEE_MODE_SHEET, enabled: !isSheet, config: out.config, override });
}
