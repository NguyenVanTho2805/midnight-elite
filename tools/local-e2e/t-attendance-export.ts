// ĐX-03 (NC1-045) — GET /api/courses/[id]/attendance-export với dữ liệu thật: quyền, tháng, ba định dạng, cô lập giữa gia sư.
// Cần Postgres + Next dev (xem README). Phần thuần (lưới, CSV, Excel) đã có ở t-attendance-export-lib.ts.
import { Workbook } from "exceljs";
import { api, mkUser, mkTutor, mkSuper, mkCourse, cookieFor, BASE, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const raw = async (path: string, as?: TUser) => {
  const res = await fetch(BASE + path, { headers: as ? { cookie: await cookieFor(as) } : {}, redirect: "manual" });
  return { status: res.status, headers: res.headers, bytes: new Uint8Array(await res.arrayBuffer()) };
};
const INJ = "=cmd|' /C calc'!A0";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khang"), SA = await mkSuper("Quản trị");
  const S = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), S3 = await mkUser({ name: INJ }), LEFT = await mkUser({ name: "Em Đã Rời" }), ORPH = await mkUser({ name: "Em Mồ Côi" });
  const c1 = await mkCourse(T.id, { name: "Toán 9 — lớp A" }), c2 = await mkCourse(T2.id, { name: "Văn 9" });
  const old = new Date("2026-08-01T00:00:00Z");
  for (const [u, c, st] of [[S, c1, "active"], [S2, c1, "active"], [S3, c1, "active"], [LEFT, c1, "suspended"], [S, c2, "active"]] as const) {
    await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: st, createdAt: old } });
  }
  // Tháng 09/2026 (cố định, đã qua): 3/9 An có mặt + Bình muộn + em đã rời có mặt; 10/9 An vắng, Bình chưa điểm danh; em mồ côi có bản ghi 10/9 dù không còn dòng ghi danh
  const ses = async (courseId: string, date: string, recs: [string, string][]) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date: new Date(`${date}T00:00:00Z`), createdBy: T.id } });
    for (const [userId, status] of recs) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId, status } });
    return s;
  };
  await ses(c1.id, "2026-09-03", [[S.id, "present"], [S2.id, "late"], [LEFT.id, "present"]]);
  await ses(c1.id, "2026-09-10", [[S.id, "absent"], [ORPH.id, "excused"]]);
  await ses(c1.id, "2026-10-06", [[S.id, "present"]]); // tháng khác
  await ses(c2.id, "2026-09-03", [[S.id, "present"]]); // lớp khác
  const U = (id: string, q: string) => `/api/courses/${id}/attendance-export?${q}`;

  section("Quyền");
  check("chưa đăng nhập → 401", (await api("GET", U(c1.id, "month=2026-09"))).status === 401);
  check("học sinh → 403", [401, 403].includes((await api("GET", U(c1.id, "month=2026-09"), { as: S })).status));
  check("gia sư KHÁC (không phải chủ lớp) → 403", (await api("GET", U(c1.id, "month=2026-09"), { as: T2 })).status === 403);
  check("lớp không tồn tại → 404", (await api("GET", U("khong-co-lop", "month=2026-09"), { as: T })).status === 404);
  check("quản trị cấp 1 xem được lớp bất kỳ → 200", (await api("GET", U(c1.id, "month=2026-09"), { as: SA })).status === 200);
  check("lỗi cũng không được cache", /no-store/.test((await api("GET", U(c1.id, "month=2026-09"), { as: T2 })).headers.get("cache-control") ?? ""));

  section("Tham số");
  check("tháng sai định dạng → 400", (await api("GET", U(c1.id, "month=2026-13"), { as: T })).status === 400 && (await api("GET", U(c1.id, "month=abc"), { as: T })).status === 400);
  check("định dạng lạ → 400", (await api("GET", U(c1.id, "month=2026-09&format=pdf"), { as: T })).status === 400);
  const cur = await api("GET", U(c1.id, ""), { as: T });
  check("thiếu month → tháng hiện tại (giờ VN), 200", cur.status === 200 && cur.json?.month === new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7), cur.json?.month);

  section("JSON (cho trang in)");
  const j = await api("GET", U(c1.id, "month=2026-09&format=json"), { as: T });
  check("200, no-store, 2 cột ngày 03/09 và 10/09, tên lớp, nhãn tháng", j.status === 200 && /no-store/.test(j.headers.get("cache-control") ?? "") && j.json.dates.map((d: any) => d.label).join() === "03/09,10/09" && j.json.courseName === "Toán 9 — lớp A" && j.json.monthLabel === "Tháng 09/2026", j.json);
  const rowOf = (name: string) => j.json.rows.find((r: any) => r.name === name);
  check("Em An: có mặt rồi vắng; Em Bình: muộn rồi TRỐNG (chưa điểm danh)", rowOf("Em An")?.cells.join() === "present,absent" && rowOf("Em Bình")?.cells[0] === "late" && rowOf("Em Bình")?.cells[1] === null, [rowOf("Em An"), rowOf("Em Bình")]);
  check("em đã rời lớp (suspended) có bản ghi → vẫn có mặt trong bảng, ô còn lại '–'", rowOf("Em Đã Rời")?.cells.join() === "present,na", rowOf("Em Đã Rời"));
  check("em không còn dòng ghi danh nhưng có bản ghi tháng đó → vẫn có mặt (không mất dữ liệu)", rowOf("Em Mồ Côi")?.cells.join() === "na,excused", rowOf("Em Mồ Côi"));
  check("bản ghi của THÁNG KHÁC và LỚP KHÁC không lẫn vào (Em An không có 'present' thứ hai)", rowOf("Em An")?.counts.present === 1, rowOf("Em An")?.counts);
  check("không lộ học sinh của lớp khác", !JSON.stringify(j.json).includes("Văn 9"));
  const empty = await api("GET", U(c1.id, "month=2026-07&format=json"), { as: T });
  check("tháng không có buổi → 200, không cột ngày, vẫn liệt kê em đang học", empty.status === 200 && empty.json.dates.length === 0 && empty.json.rows.length === 3 && empty.json.rows.every((r: any) => r.cells.length === 0), empty.json);

  section("CSV");
  const csv = await api("GET", U(c1.id, "month=2026-09&format=csv"), { as: T });
  check("200, text/csv UTF-8, tải về với tên tệp ASCII có tháng", csv.status === 200 && /text\/csv; charset=utf-8/.test(csv.headers.get("content-type") ?? "") && /attachment; filename="diem-danh-toan-9-lop-a-2026-09\.csv"/.test(csv.headers.get("content-disposition") ?? ""), [csv.headers.get("content-type"), csv.headers.get("content-disposition")]);
  // `Response.text()` của fetch BỎ dấu BOM đầu tệp (đúng chuẩn), nên không thấy được BOM qua `csv.text`: đọc byte thô để kiểm EF BB BF.
  const csvBytes = (await raw(U(c1.id, "month=2026-09&format=csv"), T)).bytes;
  check("BOM UTF-8 (byte EF BB BF đầu tệp), tên lớp và ký hiệu đúng, no-store", csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csv.text.includes("Toán 9 — lớp A") && csv.text.includes("✓") && /no-store/.test(csv.headers.get("cache-control") ?? ""));
  check("tên học sinh bắt đầu bằng '=' bị vô hiệu hoá (dấu nháy đơn), không thành công thức", csv.text.includes("'=cmd") && !/(^|,)=cmd/m.test(csv.text), csv.text.split("\r\n").find(l => l.includes("cmd")));

  section("Excel");
  const x = await raw(U(c1.id, "month=2026-09&format=xlsx"), T);
  check("200, đúng kiểu nội dung, tên tệp .xlsx, là ZIP", x.status === 200 && /spreadsheetml\.sheet/.test(x.headers.get("content-type") ?? "") && /filename="diem-danh-toan-9-lop-a-2026-09\.xlsx"/.test(x.headers.get("content-disposition") ?? "") && x.bytes[0] === 0x50 && x.bytes[1] === 0x4b, x.status);
  const wb = new Workbook(); await wb.xlsx.load(x.bytes.buffer.slice(x.bytes.byteOffset, x.bytes.byteOffset + x.bytes.byteLength) as ArrayBuffer);
  const ws = wb.worksheets[0];
  let found = false, injCellOk = false;
  ws.eachRow(r => {
    if (r.getCell(2).value === "Em An") found = r.getCell(3).value === "✓" && r.getCell(4).value === "V";
    if (typeof r.getCell(2).value === "string" && String(r.getCell(2).value).startsWith("=cmd")) injCellOk = r.getCell(2).value === INJ && !r.getCell(2).formula;
  });
  check("mở được bằng exceljs: dòng Em An có ✓ rồi V; tên '=cmd…' là chữ, không phải công thức", ws.name === "Điểm danh 09-2026" && found && injCellOk, ws.name);
  check("tháng sai với xlsx cũng 400 (không tạo tệp)", (await raw(U(c1.id, "month=2026-99&format=xlsx"), T)).status === 400);
  check("gia sư khác tải xlsx của lớp này → 403", (await raw(U(c1.id, "month=2026-09&format=xlsx"), T2)).status === 403);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
