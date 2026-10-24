// HP-18/HP-19/HP-24/HP-32 — API: phí khác cả lớp, gộp khoản rời vào phiếu nháp, giảm giá phần trăm cho em. Cần máy chủ dev (BASE).
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { computeMonthlyFee } from "@/lib/tuition";
import { addExtraFee } from "@/lib/feeChargeServer";
import { attachLooseCharges } from "@/lib/looseChargeServer";
import { percentAmount } from "@/lib/tuitionFee";

(async () => {
  await wipe();
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" }), C = await mkUser({ name: "Em Chi" });
  const cL = await mkCourse(T1.id, { name: "Toán cũ" }); // lớp CÁCH CŨ
  for (const u of [A, B, C]) await prisma.enrollment.create({ data: { userId: u.id, courseId: cL.id, status: "active" } });
  await prisma.monthlyCourseFee.create({ data: { courseId: cL.id, yearMonth: "2026-10", sessionCount: 8, updatedBy: T1.id } });
  const today = vnDateKeyOf(new Date());
  const x = (courseId: string, body: object, as = T1) => api("POST", `/api/courses/${courseId}/fee-extra-placeholder`.replace("fee-extra-placeholder", "extra-fees"), { as, body });
  const charges = (where: object) => prisma.feeCharge.findMany({ where, orderBy: { createdAt: "asc" } });

  section("A. HP-18/19 · phí khác cả lớp");
  check("T2 / học viên → 403", (await x(cL.id, { action: "add", label: "Tài liệu", amount: 100_000 }, T2)).status === 403 && (await x(cL.id, { action: "add", label: "Tài liệu", amount: 100_000 }, A)).status === 403);
  check("lớp không có → 404", (await x("khongco", { action: "add", label: "Tài liệu", amount: 100_000 })).status === 404);
  check("[phá] thiếu tên / số tiền lẻ / ngày sai / action lạ → 400", (await x(cL.id, { action: "add", label: "", amount: 100_000 })).status === 400 && (await x(cL.id, { action: "add", label: "Tài liệu", amount: 99.5 })).status === 400 && (await x(cL.id, { action: "add", label: "Tài liệu", amount: 100_000, dateKey: "2026-02-30" })).status === 400 && (await x(cL.id, { action: "xoa" })).status === 400);
  check("[phá] em không học lớp → 400, không ghi gì", (await x(cL.id, { action: "add", label: "Tài liệu", amount: 100_000, studentIds: [(await mkUser({ name: "Lạ" })).id] })).status === 400 && (await prisma.feeCharge.count()) === 0);
  const add = await x(cL.id, { action: "add", label: "Tài liệu HK1", amount: 150_000, dateKey: "2026-10-10" });
  check("thêm cho cả lớp (3 em × 150.000 = 450.000), kind=extra, tháng 2026-10, chưa vào phiếu", add.status === 201 && add.json.created === 3 && add.json.total === 450_000 && (await charges({ kind: "extra" })).every(c => c.amount === 150_000 && c.yearMonth === "2026-10" && c.invoiceId === null && c.label === "Tài liệu HK1" && c.recordId === null), add.json);
  const dup = await x(cL.id, { action: "add", label: "Tài liệu HK1", amount: 150_000, dateKey: "2026-10-10" });
  check("bấm đúp: khoản GIỐNG HỆT không tạo lần hai", dup.json.created === 0 && dup.json.skippedDuplicate === 3 && (await prisma.feeCharge.count({ where: { kind: "extra" } })) === 3);
  const race = await Promise.all([1, 2, 3].map(() => x(cL.id, { action: "add", label: "Quỹ lớp", amount: 50_000, dateKey: "2026-10-11", studentIds: [A.id] })));
  check("3 lần bấm đồng thời cho cùng khoản: đúng 1 dòng (khoá theo lớp+tên+ngày), 2 lần còn lại báo trùng", race.every(r => r.status === 201) && (await prisma.feeCharge.count({ where: { label: "Quỹ lớp" } })) === 1 && race.filter(r => r.json.created === 1).length === 1, race.map(r => r.json));
  const listed = await api("GET", `/api/courses/${cL.id}/extra-fees`, { as: T1 });
  check("danh sách phí khác có tên em, đã/chưa vào phiếu", listed.status === 200 && listed.json.items.length >= 4 && listed.json.items.every((i: any) => typeof i.studentName === "string" && i.invoiced === false), listed.json);
  const qA = (await charges({ label: "Quỹ lớp", studentId: A.id }));
  // dọn các dòng dư do đua để các mục sau chính xác
  if (qA.length > 1) await prisma.feeCharge.deleteMany({ where: { id: { in: qA.slice(1).map(c => c.id) } } });
  const rm = await x(cL.id, { action: "remove", chargeId: qA[0].id });
  check("gỡ khoản chưa vào phiếu → OK", rm.status === 200 && (await prisma.feeCharge.count({ where: { id: qA[0].id } })) === 0);
  check("[phá] gỡ khoản của lớp KHÁC / không tồn tại → 409", (await x(cL.id, { action: "remove", chargeId: "khongco" })).status === 409);

  section("B. Phiếu của lớp CŨ có thêm dòng phí khác: phần cũ không đổi");
  const iss = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [A.id, B.id] } });
  if (iss.json.created.length !== 2) console.log("DEBUG", JSON.stringify(iss.json));
  const iA = iss.json.created.find((c: any) => c.studentId === A.id), iB = iss.json.created.find((c: any) => c.studentId === B.id);
  const bdA = (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iA.id } })).breakdown as any;
  const oracle = computeMonthlyFee({ subjects: [{ courseId: cL.id, courseName: "Toán cũ", sessionCount: 8, freeCount: 0 }] });
  check("phiếu = 8 × 70.000 (cách cũ, đúng công thức) + 150.000 phí khác = 710.000", iA.amountDue === oracle.finalAmount + 150_000 && oracle.finalAmount === 560_000 && bdA.gross === 560_000 && bdA.chargesTotal === 150_000 && bdA.chargeLines[0].description === "Tài liệu HK1", { iA, bdA });
  check("dòng phí đã gắn vào phiếu (đóng băng); gỡ khoản đã vào phiếu → 409", (await charges({ studentId: A.id, kind: "extra" })).every(c => c.invoiceId === iA.id) && (await x(cL.id, { action: "remove", chargeId: (await charges({ studentId: A.id, kind: "extra" }))[0].id })).status === 409);

  section("C. HP-24 · gộp khoản rời vào phiếu nháp");
  await x(cL.id, { action: "add", label: "Phí thi thử", amount: 80_000, dateKey: "2026-10-20" });        // sau khi lập phiếu tháng 10 → rời
  await x(cL.id, { action: "add", label: "Tài liệu hè", amount: 60_000, dateKey: "2026-09-15", studentIds: [A.id] }); // tháng TRƯỚC, chưa vào phiếu nào → rời
  const list = await api("GET", "/api/tutor/invoices?yearMonth=2026-10", { as: T1 });
  const rowA = list.json.items.find((i: any) => i.id === iA.id);
  check("danh sách phiếu báo An có 2 khoản rời = 140.000 (phiếu nháp)", rowA.looseCount === 2 && rowA.looseTotal === 140_000, rowA);
  const det = await api("GET", `/api/tutor/invoices/${iA.id}`, { as: T1 });
  check("chi tiết phiếu nháp liệt kê khoản rời, khoản tháng trước ghi rõ tháng", det.json.looseCharges.length === 2 && det.json.looseLines.some((l: any) => /tháng 9\/2026/.test(l.description)), det.json.looseLines);
  const pv = await api("PATCH", `/api/tutor/invoices/${iA.id}`, { as: T1, body: { action: "attach_charges", preview: true } });
  check("xem trước: 710.000 → 850.000 (+140.000), KHÔNG ghi", pv.status === 200 && pv.json.applied === false && pv.json.amountDueFrom === 710_000 && pv.json.amountDueTo === 850_000 && (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iA.id } })).amountDue === 710_000 && (await charges({ studentId: A.id, invoiceId: null })).length === 2, pv.json);
  check("T2 gộp vào phiếu của T1 → 404", (await api("PATCH", `/api/tutor/invoices/${iA.id}`, { as: T2, body: { action: "attach_charges" } })).status === 404);
  const [r1, r2] = await Promise.all([1, 2].map(() => api("PATCH", `/api/tutor/invoices/${iA.id}`, { as: T1, body: { action: "attach_charges" } })));
  check("2 lần bấm gộp CÙNG LÚC: đúng 1 thành công, 1 bị 409", [r1, r2].filter(r => r.status === 200).length === 1 && [r1, r2].filter(r => r.status === 409).length === 1, [r1.status, r2.status]);
  const afterA = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iA.id } });
  const bd2 = afterA.breakdown as any;
  check("áp dụng: số phải đóng = số xem trước (850.000), breakdown cộng đúng, 2 dòng đã gắn phiếu", afterA.amountDue === 850_000 && bd2.chargesTotal === 290_000 && bd2.finalAmount === 850_000 && bd2.attached.length === 1 && (await charges({ studentId: A.id, invoiceId: null })).length === 0, bd2);
  await api("PATCH", `/api/tutor/invoices/${iB.id}`, { as: T1, body: { action: "send" } });
  const sentTry = await api("PATCH", `/api/tutor/invoices/${iB.id}`, { as: T1, body: { action: "attach_charges" } });
  check("[chốt] phiếu ĐÃ GỬI không gộp được (409), số tiền không đổi, khoản vẫn rời", sentTry.status === 409 && (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iB.id } })).amountDue === 710_000 + 0 + 80_000 - 80_000 && (await charges({ studentId: B.id, invoiceId: null })).length === 1);
  check("không còn gì để gộp → 409 rõ nghĩa", (await api("PATCH", `/api/tutor/invoices/${iA.id}`, { as: T1, body: { action: "attach_charges" } })).status === 409);

  section("D. HP-32 · giảm giá phần trăm");
  check("học viên / ẩn danh → 403 / 401", (await api("POST", "/api/tutor/student-discounts", { as: A, body: { studentId: A.id, percent: 10 } })).status === 403 && (await api("POST", "/api/tutor/student-discounts", { body: { studentId: A.id, percent: 10 } })).status === 401);
  check("[phá] % ngoài 0–100 / lẻ → 400; em không thuộc lớp của mình → 404", (await api("POST", "/api/tutor/student-discounts", { as: T1, body: { studentId: C.id, percent: 101 } })).status === 400 && (await api("POST", "/api/tutor/student-discounts", { as: T1, body: { studentId: C.id, percent: 5.5 } })).status === 400 && (await api("POST", "/api/tutor/student-discounts", { as: T2, body: { studentId: C.id, percent: 10 } })).status === 404);
  const oldC = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [C.id] } });
  const dC0 = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: oldC.json.created[0].id } });
  const D = await mkUser({ name: "Em Dũng" }), E = await mkUser({ name: "Em Em" });
  for (const u of [D, E]) await prisma.enrollment.create({ data: { userId: u.id, courseId: cL.id, status: "active" } });
  const setD = await api("POST", "/api/tutor/student-discounts", { as: T1, body: { studentId: D.id, percent: 10 } });
  check("đặt 10% cho Dũng", setD.status === 200 && (await prisma.studentDiscount.findFirstOrThrow({ where: { studentId: D.id } })).percent === 10);
  const gl = await api("GET", "/api/tutor/student-discounts", { as: T1 });
  check("danh sách em kèm % hiện tại", gl.json.items.find((i: any) => i.studentId === D.id).percent === 10 && gl.json.items.find((i: any) => i.studentId === E.id).percent === 0);
  const issD = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [D.id, E.id] } });
  const iD = issD.json.created.find((c: any) => c.studentId === D.id), iE = issD.json.created.find((c: any) => c.studentId === E.id);
  const bdD = (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iD.id } })).breakdown as any;
  check("Dũng: 560.000 giảm 10% = 504.000 (giảm 56.000); breakdown ghi percentOff", iD.amountDue === 560_000 - percentAmount(560_000, 10) && iD.amountDue === 504_000 && bdD.percentOff === 10 && bdD.percentAmount === 56_000, bdD);
  check("Em không có giảm giá: 560.000 NGUYÊN (đúng công thức cũ), breakdown KHÔNG có khoá percent", iE.amountDue === 560_000 && !("percentOff" in ((await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iE.id } })).breakdown as object)));
  check("đặt giảm giá sau KHÔNG đổi phiếu đã lập", (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: dC0.id } })).amountDue === dC0.amountDue);
  await x(cL.id, { action: "add", label: "Quỹ lớp", amount: 100_000, dateKey: "2026-10-25", studentIds: [D.id] });
  const atD = await api("PATCH", `/api/tutor/invoices/${iD.id}`, { as: T1, body: { action: "attach_charges" } });
  check("khoản gộp thêm cho Dũng cũng giảm 10%: +100.000 − 10.000 = +90.000 → 594.000", atD.status === 200 && atD.json.net === 90_000 && atD.json.amountDueTo === 594_000, atD.json);
  const off = await api("POST", "/api/tutor/student-discounts", { as: T1, body: { studentId: D.id, percent: 0 } });
  check("đặt 0% = bỏ giảm giá (xoá dòng)", off.status === 200 && (await prisma.studentDiscount.count({ where: { studentId: D.id } })) === 0);
  check("nhật ký có student_discount.set", (await prisma.auditLog.count({ where: { action: "student_discount.set" } })) >= 2);

  section("E. Chặn Preview (gọi thẳng hàm)");
  const saved = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    const before = await prisma.feeCharge.count();
    const ax = await addExtraFee({ courseId: cL.id, by: T1.id, label: "Thử", amount: 10_000, dateKey: today });
    check("Preview: thêm phí khác → 503, không ghi", !ax.ok && ax.status === 503 && (await prisma.feeCharge.count()) === before);
    const at = await attachLooseCharges({ invoiceId: iB.id, tutorId: T1.id, preview: false });
    check("Preview: gộp khoản rời → 503", !at.ok && at.status === 503);
    const { issueInvoice } = await import("@/lib/invoiceServer");
    const F = await mkUser({ name: "Em Fa" }), G = await mkUser({ name: "Em Gờ" });
    for (const u of [F, G]) await prisma.enrollment.create({ data: { userId: u.id, courseId: cL.id, status: "active" } });
    await prisma.studentDiscount.create({ data: { tutorId: T1.id, studentId: F.id, percent: 50, updatedBy: T1.id } });
    const iF = await issueInvoice({ tutorId: T1.id, studentId: F.id, yearMonth: "2026-10" });
    check("Preview: lập phiếu cho em CÓ giảm giá % bị từ chối, không tạo phiếu", !iF.ok && /xem trước/.test(iF.reason) && (await prisma.tuitionInvoice.count({ where: { studentId: F.id } })) === 0, iF);
    const iG = await issueInvoice({ tutorId: T1.id, studentId: G.id, yearMonth: "2026-10" });
    check("Preview: em lớp CŨ không giảm giá vẫn lập bình thường 560.000 (đường cũ không bị chặn)", iG.ok && iG.invoice.amountDue === 560_000, iG);
  } finally { if (saved === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved; }

  section("F. Bất biến");
  const invs = await prisma.tuitionInvoice.findMany({ where: { tutorId: T1.id } });
  const bad: unknown[] = [];
  for (const i of invs) {
    const bd = i.breakdown as any, ch = await prisma.feeCharge.findMany({ where: { invoiceId: i.id } });
    if (ch.length && bd.chargesTotal !== ch.reduce((s, c) => s + c.amount, 0)) bad.push({ code: i.code, a: bd.chargesTotal, b: ch.reduce((s, c) => s + c.amount, 0) });
  }
  check(`phiếu có dòng phí: chargesTotal = Σ FeeCharge (${invs.length} phiếu)`, bad.length === 0, bad);
  check("không dòng phí nào bị gắn vào hai phiếu / âm", (await prisma.feeCharge.findMany()).every(c => c.amount > 0));
  await done();
})();
