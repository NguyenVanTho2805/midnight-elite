// XEM TRƯỚC nhập hàng loạt (LO-06 dán danh sách, LO-17 CSV/Excel — học sinh hoặc lịch). KHÔNG ghi gì vào DB.
// Trả: số dòng hợp lệ, lỗi TỪNG DÒNG, cột nhận ra / bỏ qua, các bên phải đồng ý (để hiện đúng hộp xác nhận).
// Nhận JSON { kind, text, defaultGroup, courseId?, status? } hoặc multipart (có `file`: .csv .tsv .txt .xlsx, ≤ 1 MB).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeKey } from "@/lib/tutorArea";
import { importMaxRows } from "@/lib/studentProfile";
import { buildContext, parseScheduleImport, parseStudentImport, readImportRequest } from "@/lib/studentImportServer";

export async function POST(req: Request) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  if (!rateLimit(`nhap-xem:${auth.userId}`, 40, 60_000)) return NextResponse.json({ error: "Bạn thao tác quá nhanh, thử lại sau ít phút" }, { status: 429 });
  const r = await readImportRequest(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const now = new Date();
  const built = await buildContext(auth.userId, r, now);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: built.status });
  const { ctx, courses } = built;
  const NO_STORE = { "Cache-Control": "no-store" };

  if (r.kind === "lich") {
    const p = parseScheduleImport(r.text, { courseByKey: ctx.courseByKey, defaultCourseId: r.courseId, maxRows: importMaxRows() });
    return NextResponse.json({
      kind: "lich", total: p.total, valid: p.rows.length, errors: p.errors, duplicates: p.duplicates, tooMany: p.tooMany, maxRows: importMaxRows(),
      rows: p.rows.map(x => ({ line: x.line, course: courses.get(x.courseId) ?? "", dayOfWeek: x.dayOfWeek, startTime: x.startTime, endTime: x.endTime, note: x.note })),
    }, { headers: NO_STORE });
  }

  const p = parseStudentImport(r.text, ctx);
  // Hồ sơ đã có của chính gia sư (cùng tên + cùng SĐT phụ huynh) sẽ bị bỏ qua khi ghi: báo trước.
  const have = await prisma.studentProfile.findMany({ where: { tutorId: auth.userId }, select: { name: true, guardianPhone: true } });
  const haveKeys = new Set(have.map(h => `${normalizeKey(h.name)}|${h.guardianPhone ?? ""}`));
  const rows = p.rows.map(x => ({
    line: x.line, name: x.data.name, ageGroup: x.data.ageGroup, course: x.data.courseId ? courses.get(x.data.courseId) ?? null : null, status: x.data.status ?? "active",
    hasGuardianPhone: !!x.data.guardianPhone, hasExtended: x.hasExtended, existing: haveKeys.has(`${normalizeKey(x.data.name ?? "")}|${x.data.guardianPhone ?? ""}`),
  }));
  return NextResponse.json({
    kind: "hoc-sinh", total: p.total, valid: p.rows.length, errors: p.errors, duplicates: p.duplicates, tooMany: p.tooMany, maxRows: importMaxRows(),
    mapped: p.mapped, ignored: p.ignored, hasHeader: p.hasHeader, parties: p.parties, hasExtended: p.hasExtended, existing: rows.filter(x => x.existing).length, rows,
  }, { headers: NO_STORE });
}
