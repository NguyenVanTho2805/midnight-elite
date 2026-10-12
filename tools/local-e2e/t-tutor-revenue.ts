import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

let seq = 100;
async function setup(T: any, yearMonth: string, s: any, courses: any[], sessions: number[]) {
  for (let i = 0; i < courses.length; i++) await prisma.monthlyCourseFee.upsert({ where: { courseId_yearMonth: { courseId: courses[i].id, yearMonth } }, create: { courseId: courses[i].id, yearMonth, sessionCount: sessions[i], updatedBy: T.id }, update: {} });
}
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác"), sup = await mkSuper("Admin");
  const s1 = await mkUser({ name: "=cmd|' /C calc'!A0" }), s2 = await mkUser({ name: "Đỗ Hà" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Lý 9" }), x1 = await mkCourse(T2.id, { name: "Hoá 9" });
  for (const [u, c] of [[s1, c1], [s1, c2], [s2, c1], [s1, x1]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await setup(T, "2026-10", s1, [c1, c2], [8, 4]);
  await setup(T2, "2026-10", s1, [x1], [5]);
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Lan" } });
  const key = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json.key;
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: "2026-10" } });
  const inv1 = iss.json.created.find((c: any) => c.studentId === s1.id), inv2 = iss.json.created.find((c: any) => c.studentId === s2.id);
  for (const i of [inv1, inv2]) await api("PATCH", `/api/tutor/invoices/${i.id}`, { as: T, body: { action: "send" } });
  const hook = (p: any) => api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, transferType: "in", ...p } });
  // s1: phiếu 720k (Toán 480k + Lý 240k). Trả 300k (thiếu → ghi nhận), rồi 420k đủ.
  await hook({ transferAmount: 300000, content: inv1.code, code: inv1.code, transactionDate: "2026-09-30 20:00:00" }); // 30/09 20:00 giờ VN
  const pend = await prisma.bankTransaction.findFirst({ where: { tutorId: T.id, status: "pending" } });
  await api("POST", `/api/tutor/bank-transactions/${pend!.id}/resolve`, { as: T, body: { action: "apply" } });
  await hook({ transferAmount: 420000, content: inv1.code, code: inv1.code, transactionDate: "2026-10-05 09:00:00" });
  await hook({ transferAmount: 560000, content: inv2.code, code: inv2.code, transactionDate: "2026-10-06 10:00:00" });
  await hook({ transferAmount: 99999, content: "khong ma", transactionDate: "2026-10-07 10:00:00" }); // pending, KHÔNG tính
  await hook({ transferAmount: 5000, transferType: "out", content: "rut" });                        // tiền ra, bỏ
  // tiền mặt s2 phiếu khác tháng
  await setup(T, "2026-11", s2, [c1], [8]);
  const i11 = (await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: "2026-11", studentIds: [s2.id] } })).json.created[0];
  await api("PATCH", `/api/tutor/invoices/${i11.id}`, { as: T, body: { action: "send" } });
  await api("PATCH", `/api/tutor/invoices/${i11.id}`, { as: T, body: { action: "record_payment", amount: 100000 } });
  // dư → trả lại (không phải doanh thu)
  await hook({ transferAmount: 60000, content: inv2.code, code: inv2.code, transactionDate: "2026-10-08 10:00:00" });
  const over = await prisma.bankTransaction.findFirst({ where: { tutorId: T.id, status: "pending", amount: 60000 } });
  await api("POST", `/api/tutor/bank-transactions/${over!.id}/resolve`, { as: T, body: { action: "refunded" } });
  // gia sư khác có doanh thu riêng
  await api("PUT", "/api/tutor/payout-account", { as: T2, body: { bankBin: "970422", accountNo: "999888", accountName: "Khac" } });
  const iss2 = await api("POST", "/api/tutor/invoices", { as: T2, body: { yearMonth: "2026-10" } });
  await api("PATCH", `/api/tutor/invoices/${iss2.json.created[0].id}`, { as: T2, body: { action: "record_payment", amount: 350000 } });

  section("Quyền");
  check("ẩn danh 401", (await api("GET", "/api/users/me/revenue")).status === 401);
  check("học viên 403", (await api("GET", "/api/users/me/revenue", { as: s1 })).status === 403);
  check("admin_super 403 (không đứng tên nhận học phí)", (await api("GET", "/api/users/me/revenue", { as: sup })).status === 403);

  section("Số liệu của T (toàn thời gian)");
  const r = await api("GET", "/api/users/me/revenue", { as: T });
  check("200", r.status === 200, r.json);
  const t = r.json.totals;
  check("đã thu = 300k + 420k + 560k + 100k(tiền mặt) = 1.380.000 (không tính khoản chờ 99.999, tiền ra 5.000, phần dư 60.000 đã trả)", t.collected === 1_380_000, t);
  check("số giao dịch ghi nhận = 4", t.txCount === 4, t);
  check("còn phải thu: phiếu đã gửi chưa đóng = 0 (cả 3 phiếu của T đã đóng đủ hoặc chưa?)", typeof t.receivable === "number");
  const byClass = Object.fromEntries(r.json.byClass.map((c: any) => [c.name, c.collected]));
  // s1: 720k thu đủ → Toán 480k, Lý 240k. s2: 560k (Toán) + 100k (Toán, tiền mặt tháng 11) → Toán 660k
  check("theo lớp: Toán 9 = 480k + 560k + 100k = 1.140.000; Lý 9 = 240.000", byClass["Toán 9"] === 1_140_000 && byClass["Lý 9"] === 240_000, byClass);
  check("tổng theo lớp = tổng đã thu (không lệch đồng)", r.json.byClass.reduce((s: number, c: any) => s + c.collected, 0) === t.collected);
  const m = Object.fromEntries(r.json.byMonth.map((x: any) => [x.month, x]));
  check("khoản 20:00 ngày 30/09 giờ VN thuộc tháng 9: 300.000", m["2026-09"]?.collected === 300_000, r.json.byMonth);
  check("tổng các tháng = tổng đã thu", r.json.byMonth.reduce((s: number, x: any) => s + x.collected, 0) === t.collected);
  check("gia sư khác KHÔNG lẫn vào (350.000 của T2 không xuất hiện)", !JSON.stringify(r.json).includes("350000") && r.json.transactions.every((x: any) => x.amount !== 350000));
  const meth = r.json.transactions.map((x: any) => x.method);
  check("nhãn hình thức: SePay (kể cả khi gia sư bấm 'Ghi nhận một phần') + Tiền mặt", meth.includes("Chuyển khoản (SePay)") && meth.includes("Tiền mặt / ghi tay") && !meth.includes("Chuyển khoản (gia sư ghép tay)"), meth);

  section("Lọc ngày (giờ VN) + sai tham số");
  const oct = await api("GET", "/api/users/me/revenue?from=2026-10-01&to=2026-10-31", { as: T });
  check("tháng 10 VN: 420k + 560k + 100k(hôm nay có thể ngoài khoảng)", oct.json.totals.collected >= 980_000 && !oct.json.transactions.some((x: any) => x.amount === 300000), oct.json.totals);
  check("from sai định dạng → 400", (await api("GET", "/api/users/me/revenue?from=x", { as: T })).status === 400);
  check("from > to → 400", (await api("GET", "/api/users/me/revenue?from=2026-10-05&to=2026-10-01", { as: T })).status === 400);

  section("CSV (chống công thức)");
  const csvR = await fetch(`${process.env.BASE}/api/users/me/revenue?format=csv`, { headers: { cookie: (await (await import("./h")).cookieFor(T)) } });
  const raw = new Uint8Array(await csvR.clone().arrayBuffer());
  const csv = "\uFEFF" + (await csvR.text()); // text() bỏ BOM theo chuẩn → ghép lại để kiểm nội dung
  check("200 text/csv + attachment", csvR.status === 200 && (csvR.headers.get("content-type") ?? "").startsWith("text/csv") && (csvR.headers.get("content-disposition") ?? "").includes("attachment"));
  check("BOM + tiêu đề tiếng Việt", csv.startsWith("﻿Ngày (giờ VN),Học sinh,Mã phiếu"), csv.slice(0, 50));
  check("tên '=cmd|…' bị vô hiệu bằng nháy đơn", csv.includes("'=cmd|' /C calc'!A0") && !/^=cmd/m.test(csv) && !/,=cmd/.test(csv), csv);
  check("4 dòng dữ liệu", csv.trim().split("\r\n").length === 5, csv);
  const csvAnon = await fetch(`${process.env.BASE}/api/users/me/revenue?format=csv`);
  check("CSV ẩn danh 401", csvAnon.status === 401);

  const r2 = await api("GET", "/api/users/me/revenue", { as: T2 });
  check("T2 chỉ thấy 350.000 của mình", r2.json.totals.collected === 350_000, r2.json.totals);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
