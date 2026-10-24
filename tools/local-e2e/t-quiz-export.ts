// QZ — API tải bảng Excel mẫu nhập câu hỏi + xuất nhật ký chấm/sửa điểm ra CSV. Cần máy chủ dev đang chạy ở BASE; gọi wipe() trên DB riêng.
// Trọng tâm: (1) quyền: chưa đăng nhập 401, học sinh 403, gia sư KHÁC 403 (CSV), admin tổng 403, đề không có 404; (2) tệp Excel mẫu là .xlsx thật đúng header;
// (3) CSV: BOM UTF-8, header tải về, nội dung khớp lịch sử thật (chấm → sửa → công bố), tên học sinh '=...' bị chèn nháy, mỗi lần tải có audit log;
// (4) tải CSV không đổi gì trong DB (điểm, lịch sử, công bố).
import { api, cookieFor, mkTutor, mkUser, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { regradeAttempt } from "@/lib/examGrading";

const stamp = Date.now().toString(36);
let seq = 0;
const id = (p: string) => `${p}-${stamp}-${++seq}`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác"), SU = await mkSuper("Admin");
  const evil = await mkUser({ name: "=HYPERLINK(\"http://evil\",\"x\")" }), s2 = await mkUser({ name: "Em Hai" });

  section("Bảng Excel mẫu");
  const tpl = "/api/tutor/quiz/mau-excel";
  check("chưa đăng nhập → 401", (await api("GET", tpl)).status === 401);
  check("học sinh → 403", (await api("GET", tpl, { as: s2 })).status === 403);
  const sheetRes = await fetch((process.env.BASE ?? "") + tpl, { headers: { cookie: (await cookieFor(T)) } });
  const buf = new Uint8Array(await sheetRes.arrayBuffer());
  check("gia sư → 200, xlsx, đính kèm, không cache", sheetRes.status === 200 && /spreadsheetml\.sheet/.test(sheetRes.headers.get("content-type") ?? "") && /attachment; filename="kin-mau-nhap-cau-hoi\.xlsx"/.test(sheetRes.headers.get("content-disposition") ?? "") && /no-store/.test(sheetRes.headers.get("cache-control") ?? ""), [...sheetRes.headers]);
  check("nội dung là zip thật ('PK') và đủ lớn", buf[0] === 0x50 && buf[1] === 0x4b && buf.length > 2000, buf.length);
  const exmod = await import("exceljs"); const { Workbook } = (exmod as unknown as { default?: typeof exmod }).default ?? exmod;
  const wb = new Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer);
  check("trang 'Câu hỏi' có đủ 9 cột tiêu đề, trang 'Hướng dẫn' có nội dung", wb.worksheets[0].getRow(1).cellCount === 9 && wb.worksheets[1].rowCount >= 5);
  check("admin tổng cũng không dùng màn gia sư → 403", (await api("GET", tpl, { as: SU })).status === 403);

  section("Dựng đề + lịch sử chấm thật");
  const eid = id("ex");
  await prisma.exam.create({ data: { id: eid, code: eid, title: "Quiz xuất CSV", category: "Quiz", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 1, status: "available", createdAt: "2026-01-01", ownerId: T.id, totalPoints: 4 } });
  const q = await prisma.examQuestion.create({ data: { id: id("q"), examId: eid, order: 1, text: "Tự luận", type: "ESSAY", points: 4 } });
  await prisma.examPublishPolicy.create({ data: { examId: eid, holdUntilPublish: true, updatedById: T.id } });
  const mkAtt = async (userId: string, text: string) => {
    const a = await prisma.examAttempt.create({ data: { userId, examId: eid, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", totalPoints: 4 } });
    await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: q.id, textAnswer: text } });
    await regradeAttempt(a.id); return a;
  };
  const A = await mkAtt(evil.id, "bài một"), B = await mkAtt(s2.id, "bài hai");
  const base = `/api/tutor/quiz-cham/${eid}`;
  const g1 = await api("POST", `${base}/attempts/${A.id}`, { as: T, body: { grades: [{ questionId: q.id, points: 2, comment: "=cmd|' /C calc'!A0" }] } });
  const g2 = await api("POST", `${base}/attempts/${A.id}`, { as: T, body: { grades: [{ questionId: q.id, points: 3.5, comment: "Tốt, \"đủ ý\"" }] } });
  const g3 = await api("POST", `${base}/attempts/${B.id}`, { as: T, body: { grades: [{ questionId: q.id, points: 4, comment: "" }] } });
  const pub = await api("POST", `${base}/publish`, { as: T, body: { attemptIds: [B.id] } });
  check("dựng được: chấm 3 lần + công bố 1 bài", g1.status === 200 && g2.status === 200 && g3.status === 200 && pub.status === 200 && pub.json.published.length === 1, [g1.json, g2.json, g3.json, pub.json]);

  section("CSV: quyền");
  const url = `${base}/history/xuat-csv`;
  check("chưa đăng nhập → 401", (await api("GET", url)).status === 401);
  check("học sinh (kể cả em có bài trong đề) → 403", (await api("GET", url, { as: evil })).status === 403);
  check("gia sư KHÁC → 403", (await api("GET", url, { as: T2 })).status === 403);
  check("admin tổng → 403", (await api("GET", url, { as: SU })).status === 403);
  check("đề không có → 404", (await api("GET", "/api/tutor/quiz-cham/khong-co/history/xuat-csv", { as: T })).status === 404);
  check("các lần bị chặn không để lại audit log xuất", (await prisma.auditLog.count({ where: { action: "exam_history.export" } })) === 0);

  section("CSV: nội dung khớp lịch sử thật");
  const before = { edits: await prisma.examGradeEdit.count(), pubs: await prisma.examAttemptPublish.count(), score: (await prisma.examAttempt.findUnique({ where: { id: A.id } }))?.score };
  const r = await api("GET", url, { as: T });
  const text: string = r.text;
  check("200, text/csv utf-8, attachment tên ASCII, không cache", r.status === 200 && /text\/csv; charset=utf-8/.test(r.headers.get("content-type") ?? "") && /attachment; filename="nhat-ky-cham-quiz-\d{4}-\d{2}-\d{2}\.csv"/.test(r.headers.get("content-disposition") ?? "") && /no-store/.test(r.headers.get("cache-control") ?? ""), [...r.headers]);
  // fetch().text() tự bỏ BOM, nên kiểm BOM trên byte thô.
  const raw = new Uint8Array(await (await fetch((process.env.BASE ?? "") + url, { headers: { cookie: await cookieFor(T) } })).arrayBuffer());
  check("byte đầu tiên là BOM UTF-8 (EF BB BF)", raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf, [...raw.slice(0, 4)]);
  const lines = text.replace(/^\ufeff/, "").split("\r\n").filter(Boolean);
  check("tiêu đề + 3 lần chấm/sửa + 1 công bố = 5 dòng", lines.length === 5 && lines[0].startsWith("Thời điểm (giờ VN),Loại,Học sinh"), lines.length);
  check("loại sự kiện đủ: Chấm điểm, Sửa điểm, Công bố điểm", /Chấm điểm/.test(text) && /Sửa điểm/.test(text) && /Công bố điểm/.test(text));
  check("tên học sinh '=HYPERLINK' bị chèn nháy đơn (không thành công thức)", text.includes("'=HYPERLINK") && !/,=HYPERLINK/.test(text) && !/\r\n=HYPERLINK/.test(text));
  check("nhận xét '=cmd|...' của gia sư cũng bị chèn nháy", text.includes("'=cmd|") && !/,=cmd/.test(text));
  check("nhận xét có nháy kép được bọc đúng RFC 4180", text.includes('"Tốt, ""đủ ý"""'));
  check("có tên người thực hiện (gia sư) và điểm 3.5 là số trần", text.includes("Cô Lan") && /,2,3\.5,/.test(text), text.slice(0, 600));
  check("audit log ghi MỖI lần xuất (đã tải 2 lần)", (await prisma.auditLog.count({ where: { action: "exam_history.export", actorId: T.id, resourceId: eid } })) === 2);
  const after = { edits: await prisma.examGradeEdit.count(), pubs: await prisma.examAttemptPublish.count(), score: (await prisma.examAttempt.findUnique({ where: { id: A.id } }))?.score };
  check("tải CSV KHÔNG đổi điểm, lịch sử hay công bố trong DB", JSON.stringify(before) === JSON.stringify(after), { before, after });

  section("CSV: đề chưa có lịch sử");
  const eid2 = id("ex");
  await prisma.exam.create({ data: { id: eid2, code: eid2, title: "Đề trống", category: "Quiz", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-01-01", ownerId: T.id, totalPoints: 1 } });
  const r2 = await api("GET", `/api/tutor/quiz-cham/${eid2}/history/xuat-csv`, { as: T });
  check("vẫn 200 với đúng dòng tiêu đề", r2.status === 200 && r2.text.replace(/^\ufeff/, "").split("\r\n").filter(Boolean).length === 1);

  await done();
})();
