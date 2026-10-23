// Nhập hàng loạt (LO-06 dán, LO-17 CSV/Excel + lịch) — API thật: xem trước KHÔNG ghi; ghi cần hộp xác nhận "có quyền cung cấp và đã có đồng ý";
// lỗi từng dòng; giới hạn dòng; chỉ lớp của gia sư; tệp Excel an toàn (xlsx, bom nén, .xls, tệp quá lớn); ghi vết theo lần nhập.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-ho-so-nhap.ts
import { prisma } from "@/lib/prisma";
import { BASE, cookieFor, api, check, done, mkCourse, mkTutor, section, wipe, type TUser } from "./h";

const stamp = Date.now().toString(36);
const NAME = (n: string) => `Em${stamp}${n}`;
const ATT = { rights: true, guardian: true, child: true };

async function multipart(path: string, as: TUser, fields: Record<string, string>, file?: { name: string; data: Uint8Array | Buffer }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file) fd.set("file", new Blob([new Uint8Array(file.data)]), file.name);
  const res = await fetch(BASE + path, { method: "POST", headers: { cookie: await cookieFor(as) }, body: fd, redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ } // eslint-disable-line @typescript-eslint/no-explicit-any
  return { status: res.status, json, text };
}

(async () => {
  await wipe();
  const A = await mkTutor("Gia sư A"), B = await mkTutor("Gia sư B"), R = await mkTutor("Gia sư giới hạn tốc độ");
  const cA = await mkCourse(A.id, { name: "Toán 9" }), cB = await mkCourse(B.id, { name: "Lý 9 của B" });
  const XT = "/api/tutor/ho-so/nhap/xem-truoc", GHI = "/api/tutor/ho-so/nhap";
  const prev = (text: string, extra: Record<string, unknown> = {}, as: TUser = A) => api("POST", XT, { as, body: { kind: "hoc-sinh", text, defaultGroup: "7to15", ...extra } });
  const commit = (text: string, extra: Record<string, unknown> = {}, as: TUser = A) => api("POST", GHI, { as, body: { kind: "hoc-sinh", text, defaultGroup: "7to15", ...extra } });

  section("Quyền");
  check("chưa đăng nhập → 401 (xem trước và ghi)", (await api("POST", XT, { body: { text: "A" } })).status === 401 && (await api("POST", GHI, { body: { text: "A" } })).status === 401);
  const stu = await (await import("./h")).mkUser({ name: "Học sinh" });
  check("học sinh → 403", (await api("POST", XT, { as: stu, body: { text: "A" } })).status === 403 && (await api("POST", GHI, { as: stu, body: { text: "A" } })).status === 403);
  check("chọn lớp của gia sư KHÁC làm lớp mặc định → 403 (cả xem trước lẫn ghi)", (await prev("A An", { courseId: cB.id })).status === 403 && (await commit("A An", { courseId: cB.id, attest: ATT })).status === 403);

  section("Xem trước KHÔNG ghi gì");
  const p1 = await prev(`${NAME("1")}, 0911111111\n0900000000\n${NAME("2")}`);
  check("2 hợp lệ trên 3, lỗi dòng 2 nêu 'Thiếu tên em'", p1.status === 200 && p1.json.valid === 2 && p1.json.total === 3 && p1.json.errors[0].line === 2 && p1.json.errors[0].message === "Thiếu tên em", p1.json);
  check("nêu các bên phải đồng ý (nhóm 7-15 → phụ huynh + em), giới hạn dòng trả kèm", p1.json.parties.join() === "guardian,child" && p1.json.maxRows >= 1);
  check("không có hồ sơ / dòng đồng ý nào được tạo", (await prisma.studentProfile.count()) === 0 && (await prisma.consentRecord.count()) === 0);
  const p2 = await prev(`Họ tên,Nhóm tuổi,Địa chỉ\n${NAME("a")},5,1 Lê Lợi\n${NAME("b")},16+,`);
  check("nhóm tuổi theo dòng: 5 tuổi + 16+ → cần phụ huynh và chính người học; có địa chỉ → hasExtended", p2.json.parties.join() === "guardian,self" && p2.json.hasExtended === true && p2.json.hasHeader === true);
  check("báo trước em đã có hồ sơ (cùng tên + SĐT phụ huynh)", await (async () => { await commit(`${NAME("dup")}, 0922222222`, { attest: ATT }); const q = await prev(`${NAME("dup")}, 0922222222`); return q.json.existing === 1 && q.json.rows[0].existing === true; })());

  section("Ghi: BẮT BUỘC hộp xác nhận của gia sư");
  const t1 = `${NAME("x1")}, 0933333331\n${NAME("x2")}, 0933333332`;
  const n0 = await prisma.studentProfile.count();
  const c0 = await commit(t1);
  check("không gửi hộp xác nhận → 422 needsConsent, nêu bên thiếu", c0.status === 422 && c0.json.needsConsent && c0.json.missing.join() === "guardian,child", c0.json);
  const c1 = await commit(t1, { attest: { guardian: true, child: true } });
  check("có tích bên nhưng KHÔNG có 'rights: true' → 422", c1.status === 422 && c1.json.rights === false);
  const c2 = await commit(t1, { attest: { rights: true, guardian: true } });
  check("thiếu bên 'em' (7-15 tuổi cần đồng ý kép) → 422", c2.status === 422 && c2.json.missing.join() === "child");
  const c3 = await commit(t1, { attest: { rights: "true", guardian: "true", child: "true" } });
  check("giá trị chuỗi 'true' không tính → 422", c3.status === 422);
  check("sau mọi lần bị từ chối: chưa có thêm hồ sơ nào", (await prisma.studentProfile.count()) === n0);
  const ok = await commit(t1, { attest: ATT });
  check("đủ xác nhận → 201, tạo 2 hồ sơ", ok.status === 201 && ok.json.created === 2, ok.json);
  const made = await prisma.studentProfile.findMany({ where: { batchId: ok.json.batchId } });
  const recs = await prisma.consentRecord.findMany({ where: { batchId: ok.json.batchId } });
  check("mọi hồ sơ cùng batchId, source 'paste'; mỗi em 2 dòng đồng ý (guardian + child) do gia sư A xác nhận, có phiên bản chữ", made.length === 2 && made.every(m => m.source === "paste" && m.tutorId === A.id) && recs.length === 4 && recs.every(r => r.givenById === A.id && r.method === "tutor_attestation" && !!r.textVersion && !r.revokedAt));
  const lg = await prisma.auditLog.findFirst({ where: { action: "student_profile.import", resourceId: ok.json.batchId } });
  check("nhật ký lần nhập: số lượng + quyền cung cấp, KHÔNG có tên / số", !!lg && JSON.stringify(lg.metadata).includes('"count":2') && JSON.stringify(lg.metadata).includes('"rights":true') && !JSON.stringify(lg).includes(NAME("x1")) && !JSON.stringify(lg).includes("0933333331"));
  const again = await commit(t1, { attest: ATT });
  check("nhập lại đúng danh sách đó → 0 hồ sơ mới, 2 em 'đã có' bị bỏ qua", again.status === 201 && again.json.created === 0 && again.json.skippedExisting === 2);
  const lists = await api("GET", "/api/tutor/ho-so", { as: B });
  check("gia sư B không thấy hồ sơ nào của A (không thấy tên nào trong lô của A)", lists.json.profiles.length === 0 && !lists.text.includes(`Em${stamp}`));

  section("Lỗi từng dòng: không nhập dở");
  const bad = `${NAME("g1")}, 0944444441\n0900000000\n${NAME("g2")}, 0944444442`;
  const nb = await prisma.studentProfile.count();
  const cb = await commit(bad, { attest: ATT });
  check("còn dòng lỗi mà không skipErrors → 422 hasErrors, KHÔNG ghi dòng nào (kể cả dòng đúng)", cb.status === 422 && cb.json.hasErrors && cb.json.errors[0].line === 2 && (await prisma.studentProfile.count()) === nb);
  const cs = await commit(bad, { attest: ATT, skipErrors: true });
  check("skipErrors → ghi 2 dòng đúng, báo bỏ qua 1 dòng lỗi", cs.status === 201 && cs.json.created === 2 && cs.json.skippedErrors === 1);

  section("Giới hạn số dòng (KIN_IMPORT_MAX_ROWS, mặc định 100)");
  const many = (n: number) => Array.from({ length: n }, (_, i) => `${NAME("m")}${i}`).join("\n");
  const pm = await prev(many(101));
  check("101 dòng → xem trước báo tooMany, 0 dòng hợp lệ", pm.json.tooMany === true && pm.json.valid === 0 && pm.json.errors[0].message.includes("101"));
  const nm = await prisma.studentProfile.count();
  const cm = await commit(many(101), { attest: ATT });
  check("ghi 101 dòng → 400, không ghi gì", cm.status === 400 && (await prisma.studentProfile.count()) === nm);
  const c100 = await commit(many(100), { attest: ATT });
  check("đúng 100 dòng → 201, tạo 100", c100.status === 201 && c100.json.created === 100);

  section("Lớp trong tệp chỉ là lớp của gia sư");
  const cc = await commit(`Họ tên,Lớp\n${NAME("L1")},Toán 9\n${NAME("L2")},Lý 9 của B`, { attest: ATT, skipErrors: true });
  const l1 = await prisma.studentProfile.findFirst({ where: { name: NAME("L1") } });
  check("lớp của A gắn đúng; lớp của B → dòng lỗi, không tạo em đó", cc.json.created === 1 && l1?.courseId === cA.id && (await prisma.studentProfile.count({ where: { name: NAME("L2") } })) === 0);

  section("Tệp: CSV, Excel, từ chối tệp xấu");
  const csv = Buffer.from(`﻿Họ tên,SĐT phụ huynh\n${NAME("csv1")},0955555551\n${NAME("csv2")},0955555552\n`);
  const fcsv = await multipart(GHI, A, { kind: "hoc-sinh", defaultGroup: "7to15", attest: JSON.stringify(ATT) }, { name: "ds.csv", data: csv });
  check("CSV có BOM → 201, source 'csv'", fcsv.status === 201 && fcsv.json.created === 2 && (await prisma.studentProfile.findFirst({ where: { name: NAME("csv1") } }))?.source === "csv", fcsv.json);
  const exMod = await import("exceljs"); const ExcelJS = ((exMod as any).default ?? exMod) as typeof exMod; // eslint-disable-line @typescript-eslint/no-explicit-any
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("DS");
  ws.addRow(["Họ tên", "SĐT phụ huynh", "Ngày sinh"]); ws.addRow([NAME("xl1"), "0966666661", new Date(Date.UTC(2013, 4, 1))]); ws.addRow([NAME("xl2"), { formula: "A2&B2", result: "KQ" } as never, ""]);
  const xbuf = Buffer.from(await wb.xlsx.writeBuffer());
  const pxl = await multipart(XT, A, { kind: "hoc-sinh", defaultGroup: "7to15" }, { name: "ds.xlsx", data: xbuf });
  check("Excel: ô ngày đọc thành dd/mm/yyyy → ngày sinh; ô công thức lấy KẾT QUẢ (chữ), 1 dòng lỗi vì SĐT 'KQ'", pxl.status === 200 && pxl.json.valid === 1 && pxl.json.errors.length === 1 && pxl.json.errors[0].line === 3, pxl.json);
  const fxl = await multipart(GHI, A, { kind: "hoc-sinh", defaultGroup: "7to15", skipErrors: "true", attest: JSON.stringify(ATT) }, { name: "ds.xlsx", data: xbuf });
  const xl1 = await prisma.studentProfile.findFirst({ where: { name: NAME("xl1") } });
  check("ghi Excel → ngày sinh 2013-05-01 (theo UTC của ô), em 13 tuổi", fxl.status === 201 && xl1?.birthDate === "2013-05-01", fxl.json);
  check("tệp .xls cũ → 400 nói rõ", (await multipart(XT, A, { kind: "hoc-sinh" }, { name: "ds.xls", data: Buffer.from("x") })).status === 400);
  check("đuôi lạ (.exe, .pdf) → 400", (await multipart(XT, A, { kind: "hoc-sinh" }, { name: "a.exe", data: Buffer.from("MZ") })).status === 400 && (await multipart(XT, A, { kind: "hoc-sinh" }, { name: "a.pdf", data: Buffer.from("%PDF") })).status === 400);
  check("tệp .xlsx hỏng → 400, không sập", (await multipart(XT, A, { kind: "hoc-sinh" }, { name: "x.xlsx", data: Buffer.from("không phải zip") })).status === 400);
  check("tệp > 1 MB → 413", (await multipart(XT, A, { kind: "hoc-sinh" }, { name: "to.csv", data: Buffer.alloc(1_100_000, 65) })).status === 413);
  const JSZip = (await import("jszip")).default; const z = new JSZip();
  z.file("xl/worksheets/sheet1.xml", Buffer.alloc(25_000_000, 32)); // 25 MB sau khi giải nén, nén còn vài chục KB: "bom nén"
  const bomb = await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const rb = await multipart(XT, A, { kind: "hoc-sinh" }, { name: "bomb.xlsx", data: bomb });
  check(`bom nén (${(bomb.length / 1000).toFixed(0)} KB nén → 25 MB giải nén) → 400, không nạp vào bộ nhớ`, bomb.length < 1_000_000 && rb.status === 400 && (rb.json?.error ?? "").includes("quá lớn"), { size: bomb.length, status: rb.status, json: rb.json });

  section("Lịch học hàng tuần (không có dữ liệu trẻ)");
  const sch = "Lớp,Thứ,Bắt đầu,Kết thúc\nToán 9,2,19:00,21:00\nToán 9,T5,19h,20h30\nToán 9,9,19:00,20:00\nLý 9 của B,3,19:00,20:00";
  const ps = await api("POST", XT, { as: A, body: { kind: "lich", text: sch } });
  check("xem trước lịch: 2 hợp lệ, 2 lỗi (thứ 9; lớp của B)", ps.json.valid === 2 && ps.json.errors.map((e: { line: number }) => e.line).join() === "4,5");
  check("ghi lịch KHÔNG đòi hộp đồng ý trẻ; còn lỗi mà không skipErrors → 422 và không ghi", (await api("POST", GHI, { as: A, body: { kind: "lich", text: sch } })).status === 422 && (await prisma.classSchedule.count({ where: { courseId: cA.id } })) === 0);
  const sg = await api("POST", GHI, { as: A, body: { kind: "lich", text: sch, skipErrors: true } });
  check("skipErrors → tạo 2 khung giờ cho lớp của A", sg.status === 201 && sg.json.created === 2 && (await prisma.classSchedule.count({ where: { courseId: cA.id } })) === 2);
  check("không chạm lớp của B", (await prisma.classSchedule.count({ where: { courseId: cB.id } })) === 0);
  const sg2 = await api("POST", GHI, { as: A, body: { kind: "lich", text: sch, skipErrors: true } });
  check("nhập lại → 0 khung mới, 2 đã có bị bỏ qua", sg2.json.created === 0 && sg2.json.skipped === 2);

  section("Giới hạn tốc độ");
  let last = 0; for (let i = 0; i < 32; i++) last = (await api("POST", GHI, { as: R, body: { kind: "hoc-sinh", text: "" } })).status;
  check("ghi liên tục quá 30 lần/phút → 429", last === 429, last);

  await done();
})();
