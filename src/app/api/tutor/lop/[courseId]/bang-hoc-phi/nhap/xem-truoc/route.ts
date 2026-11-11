// HP-LOP-TRUONG 4.2 — XEM TRƯỚC nhập học phí từ Excel / Google Sheet. KHÔNG ghi gì (không dòng học phí, không FeeCharge, không audit, không thông báo).
// Nhận multipart (file .xlsx .csv .tsv .txt ≤ 1 MB + ym) hoặc JSON { ym, text } (dán từ Google Sheet = chữ tách TAB); tuỳ chọn pick { "<dòng>": "<mã em>" } để xem lại sau khi chọn em.
// 40 lần / phút / gia sư. Vẫn chạy ở bản xem trước của Vercel (không ghi gì).
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildPreview, readSheetRequest, resolveYm, sheetFail, sheetGate, sheetOk } from "@/lib/hocPhiSheetServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await sheetGate(courseId, "money.edit");
  if (!g.ok) return g.res;
  if (!g.isSheet) return sheetFail(409, "Lớp này không tính học phí theo bảng tháng.", "NOT_SHEET_MODE");
  if (!g.config) return sheetFail(409, "Lớp chưa đặt bảng bậc. Đặt bảng bậc trước khi nhập.", "NO_TABLE");
  if (!rateLimit(`hp-sheet-xem:${g.acc.session.userId}`, 40, 60_000)) return sheetFail(429, "Bạn thao tác quá nhanh, thử lại sau ít phút");

  const r = await readSheetRequest(req);
  if ("error" in r) return sheetFail(r.status, r.error, r.code);
  const ym = resolveYm(r.ymRaw, g.config.periodStartDay);
  if (!ym.ok) return sheetFail(400, ym.error);
  const built = await buildPreview({ id: g.acc.course.id, ownerId: g.acc.course.ownerId }, g.config, ym.ym, r.grid, r.pick);
  if ("error" in built) return sheetFail(400, built.error, "BAD_PICK");
  return sheetOk(built.preview);
}
