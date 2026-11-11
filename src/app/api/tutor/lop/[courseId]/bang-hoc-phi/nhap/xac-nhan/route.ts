// HP-LOP-TRUONG 4.2 — XÁC NHẬN nhập: GHI. Phân tích lại từ đầu, so fileHash (lệch → 409 FILE_CHANGED), tính lại MỌI số tiền ở máy chủ (số khách gửi lên bị bỏ qua).
// Còn dòng sai / không khớp mà skipErrors ≠ true → 409 HAS_ERRORS (không ghi gì). Dòng đã khoá (vào phiếu) luôn bị bỏ qua. Một giao dịch + khoá advisory; bấm hai lần → written 0.
import { NextRequest } from "next/server";
import { moneyPathsBlocked } from "@/lib/feeChargeServer";
import { auditSheetWrite, buildPreview, previewBlocked, readSheetRequest, resolveYm, sheetFail, sheetGate, sheetOk, writeSheetRows } from "@/lib/hocPhiSheetServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await sheetGate(courseId, "money.edit");
  if (!g.ok) return g.res;
  if (moneyPathsBlocked()) return previewBlocked();
  if (!g.isSheet) return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE");
  if (!g.config) return sheetFail(409, "Lớp chưa đặt bảng bậc. Đặt bảng bậc trước khi nhập.", "NO_TABLE");
  const { acc, config } = g;

  const r = await readSheetRequest(req);
  if ("error" in r) return sheetFail(r.status, r.error, r.code);
  if (!r.fileHash) return sheetFail(400, "Thiếu fileHash: hãy xem trước rồi mới xác nhận.", "NO_HASH");
  const ym = resolveYm(r.ymRaw, config.periodStartDay);
  if (!ym.ok) return sheetFail(400, ym.error);

  const course = { id: acc.course.id, ownerId: acc.course.ownerId };
  const built = await buildPreview(course, config, ym.ym, r.grid, r.pick);
  if ("error" in built) return sheetFail(400, built.error, "BAD_PICK");
  const p = built.preview;
  if (p.fileHash !== r.fileHash) return sheetFail(409, "Tệp hoặc bảng bậc đã đổi, hãy xem trước lại.", "FILE_CHANGED");
  if (p.fatal) return sheetFail(400, p.fatal, "FILE_REJECTED");

  const skip = new Set(r.skipLines);
  const blocking = p.rows.filter(x => (x.status === "error" || x.status === "unmatched" || x.status === "ambiguous") && !skip.has(x.line));
  if (blocking.length && !r.skipErrors) {
    return sheetFail(409, `Còn ${blocking.length} dòng sai hoặc chưa khớp học sinh. Sửa tệp, chọn em cho dòng chưa khớp, hoặc chọn bỏ qua các dòng đó.`, "HAS_ERRORS", {
      errors: blocking.filter(x => x.status === "error").length, unmatched: blocking.filter(x => x.status === "unmatched").length, ambiguous: blocking.filter(x => x.status === "ambiguous").length,
    });
  }
  const writes = built.writes.filter(w => !skip.has(w.line));
  const locked = p.counts.locked, unchanged = p.counts.unchanged;
  const empty = { ok: true, written: 0, replaced: 0, skipped: p.rows.length - unchanged - locked, unchanged, locked, chargesCreated: 0, chargesUpdated: 0, chargesRemoved: 0, totalNet: 0 };
  if (writes.length === 0) return sheetOk(empty);

  const w = await writeSheetRows({ courseId: course.id, ownerId: course.ownerId, config, ym: ym.ym, actorId: acc.session.userId, source: r.source, rows: writes });
  if (!w.ok) return sheetFail(w.status, w.error, w.code, w.extra);
  const skipped = p.rows.length - w.stats.written - unchanged - locked;
  const override = await auditSheetWrite(acc, "fee_sheet.import", {
    yearMonth: ym.ym, source: r.source, written: w.stats.written, replaced: w.stats.replaced, skipped, unchanged, locked,
    chargesCreated: w.stats.chargesCreated, chargesUpdated: w.stats.chargesUpdated, chargesRemoved: w.stats.chargesRemoved, totalNet: w.stats.totalNet,
  });
  return sheetOk({ ok: true, ...w.stats, skipped, unchanged, locked, override });
}
