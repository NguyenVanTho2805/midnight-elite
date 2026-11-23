// SCL đợt 5 (D1) — POST /api/intake/bca: Apps Script của form BCA Midnight Class gọi SAU khi đã ghi Sheet. KiN tạo / tìm học sinh, ghi danh HỌC THỬ, trả link trang chào.
// Header `x-kin-intake-key` so bằng timingSafeEqual với KIN_INTAKE_KEY (thiếu / ngắn < 24 ký tự ⇒ 503, sai ⇒ 401). Body JSON ≤ 5 KB:
//   { loai: "hocthu"|"chinhthuc", hoTen, sdt, gmail, khoi, mon: ("Toán"|"Sử"|"Địa"|"Anh")[], reqId }
// Trả { ok: true, next?: "<origin>/chao/<mã>", skip?: "khoi"|"khong_co_lop" } | { ok: false, error }. Gọi lại cùng dữ liệu: cùng người, không ghi danh thứ hai, không gia hạn.
// URL trả về CHỈ có mã ngẫu nhiên (tình huống 4): không tên / SĐT / Gmail.
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { intakeGradeAllowed } from "@/lib/trial";
import { INTAKE_SUBJECTS, intakeCourseMap, runIntake, type IntakeInput, type IntakeSubject } from "@/lib/intakeServer";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY = 5 * 1024;
const j = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const digest = (s: string) => createHash("sha256").update(s).digest();
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null);

function parse(raw: unknown): IntakeInput | null {
  const b = raw as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  const loai = b.loai === "hocthu" || b.loai === "chinhthuc" ? b.loai : null;
  const hoTen = str(b.hoTen, 100), sdt = str(b.sdt, 20), gmail = str(b.gmail, 254), khoi = str(b.khoi, 40), reqId = str(b.reqId, 100);
  if (!loai || !hoTen || !sdt || !gmail || !khoi || !reqId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) return null;
  if (!Array.isArray(b.mon) || b.mon.length > 8 || !b.mon.every(m => (INTAKE_SUBJECTS as readonly unknown[]).includes(m))) return null;
  return { loai, hoTen, sdt, gmail, khoi, mon: [...new Set(b.mon as IntakeSubject[])], reqId };
}

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "intake-bca", 60, 60_000);
  if (blocked) return blocked;

  const key = process.env.KIN_INTAKE_KEY ?? "";
  if (key.length < 24) return j({ ok: false, error: "Chưa cấu hình khoá nhận phiếu" }, 503);
  const given = req.headers.get("x-kin-intake-key") ?? "";
  if (!given || !timingSafeEqual(digest(given), digest(key))) return j({ ok: false, error: "Sai khoá" }, 401);

  const text = await req.text().catch(() => "");
  if (Buffer.byteLength(text, "utf8") > MAX_BODY) return j({ ok: false, error: "Phiếu quá lớn" }, 400);
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* bên dưới báo 400 */ }
  const input = parse(body);
  if (!input) return j({ ok: false, error: "Phiếu thiếu hoặc sai thông tin" }, 400);

  if (!intakeGradeAllowed(input.khoi)) return j({ ok: true, skip: "khoi" }); // D9
  const map = intakeCourseMap(process.env.KIN_INTAKE_COURSES);
  const courseIds = input.mon.map(m => map[m]).filter((x): x is string => !!x);
  if (courseIds.length === 0) return j({ ok: true, skip: "khong_co_lop" }); // tình huống 8: không tạo tài khoản

  try {
    const r = await runIntake(input, courseIds);
    if (!r.ok) return j({ ok: false, error: r.error }, r.status);
    if (r.skip) return j({ ok: true, skip: r.skip });
    const origin = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
    return j({ ok: true, next: `${origin}/chao/${r.token}` });
  } catch (e) {
    console.error("[intake/bca]", (e as Error)?.name);
    return j({ ok: false, error: "Lỗi máy chủ" }, 500);
  }
}
