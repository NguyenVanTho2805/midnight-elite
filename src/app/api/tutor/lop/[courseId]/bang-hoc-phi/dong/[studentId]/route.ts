// HP-LOP-TRUONG 4.2 — PUT sửa tay học phí MỘT em trong một kỳ (có dryRun: tính, không ghi) / DELETE gỡ dòng. money.edit.
// studentId phải là em đang học lớp (khác → 404 STUDENT_NOT_IN_COURSE, không lộ em lớp khác). Dòng đã vào phiếu → 409 ROW_LOCKED.
// dryRun vẫn chạy ở bản xem trước của Vercel (không ghi gì); ghi thật / xoá → 503 ở bản xem trước.
import { NextRequest } from "next/server";
import { moneyPathsBlocked } from "@/lib/feeChargeServer";
import { unusableId } from "@/lib/courseAccessServer";
import { compactSessions, parseRowInput } from "@/lib/hocPhiSheet";
import { auditSheetWrite, classifyRow, deleteSheetRow, loadEvalContext, previewBlocked, resolveYm, sheetFail, sheetGate, sheetOk, writeSheetRows } from "@/lib/hocPhiSheetServer";

const NOT_IN_COURSE = () => sheetFail(404, "Học sinh này không học lớp này", "STUDENT_NOT_IN_COURSE");

export async function PUT(req: NextRequest, { params }: { params: Promise<{ courseId: string; studentId: string }> }) {
  const { courseId, studentId } = await params;
  const g = await sheetGate(courseId, "money.edit");
  if (!g.ok) return g.res;
  if (!g.isSheet) return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE");
  if (!g.config) return sheetFail(409, "Lớp chưa đặt bảng bậc. Đặt bảng bậc trước khi nhập.", "NO_TABLE");
  const { acc, config } = g;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return sheetFail(400, "Thân yêu cầu phải là JSON");
  if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") return sheetFail(400, "dryRun phải là true hoặc false");
  const dryRun = body.dryRun === true;
  if (!dryRun && moneyPathsBlocked()) return previewBlocked();
  if (unusableId(studentId)) return NOT_IN_COURSE();
  const ym = resolveYm(body.yearMonth, config.periodStartDay);
  if (!ym.ok) return sheetFail(400, ym.error);
  const input = parseRowInput(body, config.subjects);
  if (!input.ok) return sheetFail(400, input.error, "INVALID_ROW");

  const course = { id: acc.course.id, ownerId: acc.course.ownerId };
  const ctx = await loadEvalContext(course, config, ym.ym, [studentId]);
  if (!ctx.roster.some(x => x.studentId === studentId)) return NOT_IN_COURSE();
  const cl = classifyRow(ctx, studentId, input.value);
  if (cl.status === "locked") return sheetFail(409, cl.messages[0], "ROW_LOCKED");
  if (cl.status === "error" || !cl.fee) return sheetFail(400, cl.messages[0] ?? "Số liệu không hợp lệ", "INVALID_ROW");
  const f = cl.fee;
  const row = {
    studentId, subjectCount: f.subjectCount, subjectCountSource: f.subjectCountSource, sessions: compactSessions(input.value.sessions), totalSessions: f.totalSessions,
    freeSessions: input.value.freeSessions, rateOverride: input.value.rateOverride, scholarship: input.value.scholarship, discount: input.value.discount,
    tierRate: f.tierRate, unitRate: f.unitRate, rateSource: f.rateSource, billable: f.billable, gross: f.gross, deduction: f.deduction, net: f.net, note: input.value.note, source: "manual", locked: false,
  };
  const view = { yearMonth: ym.ym, status: cl.status, row, messages: cl.messages, hasWarning: cl.hasWarning, before: cl.before };
  if (dryRun) return sheetOk({ ok: true, dryRun: true, applied: false, ...view });
  if (cl.status === "unchanged") return sheetOk({ ok: true, dryRun: false, applied: false, unchanged: true, ...view });

  const w = await writeSheetRows({ courseId: course.id, ownerId: course.ownerId, config, ym: ym.ym, actorId: acc.session.userId, source: "manual", rows: [{ studentId, input: input.value, fee: f }] });
  if (!w.ok) return sheetFail(w.status, w.error, w.code, w.extra);
  const override = await auditSheetWrite(acc, "fee_sheet.row", { yearMonth: ym.ym, deleted: false, replaced: w.stats.replaced > 0, chargesCreated: w.stats.chargesCreated, chargesUpdated: w.stats.chargesUpdated, chargesRemoved: w.stats.chargesRemoved });
  return sheetOk({ ok: true, dryRun: false, applied: true, override, ...view });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ courseId: string; studentId: string }> }) {
  const { courseId, studentId } = await params;
  const g = await sheetGate(courseId, "money.edit");
  if (!g.ok) return g.res;
  if (moneyPathsBlocked()) return previewBlocked();
  if (!g.isSheet) return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE");
  const { acc } = g;
  if (unusableId(studentId)) return sheetFail(404, "Không có dòng học phí này", "ROW_NOT_FOUND");
  const ym = resolveYm(req.nextUrl.searchParams.get("ym"), g.config?.periodStartDay ?? 1);
  if (!ym.ok) return sheetFail(400, ym.error);
  const r = await deleteSheetRow({ courseId: acc.course.id, ownerId: acc.course.ownerId, ym: ym.ym, studentId });
  if (!r.ok) return sheetFail(r.status, r.error, r.code);
  const override = await auditSheetWrite(acc, "fee_sheet.row", { yearMonth: ym.ym, deleted: true, chargeRemoved: r.chargeRemoved });
  return sheetOk({ ok: true, deleted: true, chargeRemoved: r.chargeRemoved, override });
}
