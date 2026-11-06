// HOCPHI-THEO-BUOI 4.3 / mục 8 — API thật: GET /api/tutor/hoc-phi-thang. Số tay tính, khớp phiếu, tháng rỗng, không lộ tên/ID học sinh, cô lập gia sư,
// lớp cũ theo phiếu, dòng trong phiếu huỷ, chỉ đọc (đếm bảng trước/sau), CSV.
// Ca (k) — route quản trị /api/admin/hoc-phi-thang — BỎ (chưa có, phòng Quản trị làm).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-hocphi-dashboard.ts     (chạy cả TZ=Asia/Ho_Chi_Minh; xem ca buổi ngày cuối tháng)
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { issueInvoice } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { api, BASE, cookieFor, check, done, mkTutor, mkUser, mkCourse, section, wipe } from "./h";

const day = (k: string) => new Date(`${k}T00:00:00Z`);
const prevYm = (ym: string) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const nextYm = (ym: string) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };
const lastDay = (ym: string) => `${ym}-${String(new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;
const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};
let seq = 0;
async function createCourse(as: any, extra: Record<string, unknown>) {
  seq++;
  const id = `hd-${Date.now().toString(36)}-${seq}`;
  const res = await api("POST", "/api/courses", { as, body: { ...COURSE_BASE, id, name: extra.name ?? `Lớp ${seq}`, adminName: extra.name ?? `Lớp ${seq}`, shortTitle: `L${seq}`, ...extra } });
  if (res.status !== 201) throw new Error("tạo lớp lỗi " + JSON.stringify(res.json));
  return id;
}
const enroll = (u: { id: string }, courseId: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status: "active" } });

(async () => {
  await wipe();
  const now = vnMonthKey(new Date());
  const M1 = prevYm(now), M2 = prevYm(M1), M3 = prevYm(M2);
  const A = await mkTutor("Cô Lan"), B = await mkTutor("Thầy Minh"), C = await mkTutor("Cô Không Lớp");
  const S1 = await mkUser({ name: "Em Hà Trúc" }), S2 = await mkUser({ name: "Em Bình An" }), S3 = await mkUser({ name: "Em Chi Mai" }), SB = await mkUser({ name: "Em Của Thầy Minh" });
  const PEND = await mkUser({ name: "Cô Chờ Duyệt" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });

  const toan = await createCourse(A, { name: "Toán 9", feeMode: "per_session", feeRate: 100_000 });
  const ly = await createCourse(A, { name: "Lý 10", feeMode: "per_hour", feeRate: 200_000, feeSessionMinutes: 90 }); // 300.000 / buổi 90 phút
  const cu = await createCourse(A, { name: "Hóa cũ" }); // lớp cũ (cách tính theo số buổi tháng)
  const lopB = await createCourse(B, { name: "Văn của Thầy Minh", feeMode: "per_session", feeRate: 70_000 });
  for (const u of [S1, S2, S3]) await enroll(u, toan);
  await enroll(S1, ly);
  for (const u of [S2, S3]) await enroll(u, cu);
  await enroll(SB, lopB);
  await prisma.monthlyCourseFee.create({ data: { courseId: cu, yearMonth: M1, sessionCount: 8, updatedBy: A.id } });

  const closed = async (courseId: string, dateKey: string, rows: Array<{ userId: string; status: string }>, tutor = A) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date: day(dateKey), createdBy: tutor.id, state: "closed", closedAt: new Date(), closedBy: tutor.id } });
    const r = await api("PUT", `/api/attendance-sessions/${s.id}`, { as: tutor, body: { records: rows } });
    if (r.status !== 200) throw new Error("điểm danh lỗi " + JSON.stringify(r.json));
  };
  // M2: Toán 2 buổi (10 và NGÀY CUỐI THÁNG — ca múi giờ), mỗi buổi tính theo số em có mặt.
  await closed(toan, `${M2}-10`, [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "present" }]); // 200.000
  await closed(toan, lastDay(M2), [{ userId: S1.id, status: "present" }]); // 100.000 — phải rơi vào M2, không phải M1
  // M1: Toán 3 buổi
  await closed(toan, `${M1}-05`, [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "late" }, { userId: S3.id, status: "present" }]); // 300.000
  await closed(toan, `${M1}-12`, [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "absent" }, { userId: S3.id, status: "excused" }]); // 100.000
  await closed(toan, `${M1}-19`, [{ userId: S1.id, status: "absent" }, { userId: S2.id, status: "absent" }]); // 0 nhưng vẫn là 1 buổi đã chốt
  await closed(ly, `${M1}-08`, [{ userId: S1.id, status: "present" }]); // 300.000
  await closed(lopB, `${M1}-09`, [{ userId: SB.id, status: "present" }], B); // 70.000 — của B
  await prisma.feeCharge.create({ data: { tutorId: A.id, courseId: toan, studentId: S1.id, kind: "extra", dateKey: `${M1}-12`, yearMonth: M1, amount: 50_000, mode: "per_session", label: "Tài liệu" } });
  // Phiếu tháng M1 cho 3 em (gom Toán + Lý + Hóa cũ), rồi HUỶ phiếu của S3; sau đó phát sinh thêm 1 buổi Lý chưa vào phiếu.
  for (const u of [S1, S2, S3]) await issueInvoice({ tutorId: A.id, studentId: u.id, yearMonth: M1 });
  const invS3 = await prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: S3.id, yearMonth: M1 } });
  await prisma.tuitionInvoice.update({ where: { id: invS3.id }, data: { status: "cancelled", cancelReason: "test" } });
  await closed(ly, `${M1}-25`, [{ userId: S1.id, status: "present" }]); // +300.000 CHƯA vào phiếu

  const GET = (ym: string | null, as: any = A, extra = "") => api("GET", `/api/tutor/hoc-phi-thang${ym === null ? "" : `?ym=${ym}`}${extra}`, { as });
  const row = (j: any, id: string) => j.rows.find((r: any) => r.courseId === id);

  section("(a) hai lớp, hai tháng — số tính tay");
  const r1 = await GET(M1);
  const toanR = row(r1.json, toan), lyR = row(r1.json, ly), cuR = row(r1.json, cu);
  check("200, yearMonth/prevYearMonth đúng, emptyMonth=false", r1.status === 200 && r1.json.yearMonth === M1 && r1.json.prevYearMonth === M2 && r1.json.emptyMonth === false, r1.json);
  check("Toán 9: 3 buổi chốt (kể cả buổi không ai bị tính), 3 học sinh, học phí 400.000, phí khác 50.000 tách riêng", !!toanR && toanR.closedSessions === 3 && toanR.students === 3 && toanR.tuition === 400_000 && toanR.extra === 50_000 && toanR.source === "fee_charge" && toanR.feeMode === "per_session", toanR);
  check("Toán 9: tháng trước 300.000 (kể cả buổi NGÀY CUỐI THÁNG M2) → chênh +100.000, +33,3%", toanR.prevTuition === 300_000 && toanR.delta === 100_000 && toanR.deltaPct === 33.3, toanR);
  check("Lý 10 (per_hour 200.000/giờ × 90 phút): 2 buổi, 1 học sinh, 600.000", !!lyR && lyR.closedSessions === 2 && lyR.students === 1 && lyR.tuition === 600_000 && lyR.feeMode === "per_hour", lyR);
  check("(d) Lý 10: tháng trước không có số → delta và deltaPct = null (không chia 0)", lyR.delta === null && lyR.deltaPct === null, lyR);
  check("buổi vắng/có phép không vào số học sinh của buổi 19 (vẫn 3 học sinh vì S1,S2,S3 có dòng ở buổi khác)", toanR.students === 3);
  const t = r1.json.totals;
  check("tổng: perSession = 400.000 + 600.000, extra 50.000, closedSessions = 5 (3+2+0)", t.perSession === 1_000_000 && t.extra === 50_000 && t.closedSessions === 5, t);
  check("tổng chênh tính từ hai TỔNG (không trung bình các dòng): prevTuition 300.000", t.prevTuition === 300_000 && t.delta === t.tuition - 300_000 && t.deltaPct === Math.floor((Math.abs(t.delta) * 2000 + 300_000) / 600_000) / 10, t);
  check("tổng tuition = perSession + legacyByInvoice", t.tuition === t.perSession + t.legacyByInvoice, t);

  section("(g) lớp cũ theo phiếu");
  const invs = await prisma.tuitionInvoice.findMany({ where: { yearMonth: M1, status: { not: "cancelled" } } });
  const legacySubs = invs.flatMap(i => ((i.breakdown as any).perSubject ?? []).filter((p: any) => p.courseId === cu).map((p: any) => p.subtotal as number));
  check("Hóa cũ: source = invoice, tuition = Σ subtotal các phiếu KHÔNG huỷ (phiếu S3 đã huỷ không tính), > 0", !!cuR && cuR.source === "invoice" && cuR.tuition === legacySubs.reduce((a, b) => a + b, 0) && cuR.tuition > 0 && legacySubs.length === 1, { cuR, legacySubs });
  check("Hóa cũ: students = số phiếu có subtotal > 0 (1: phiếu S2; S3 huỷ)", cuR.students === 1);
  check("tổng 'Theo buổi' và 'Cách cũ' TÁCH: perSession không chứa tiền Hóa cũ, legacyByInvoice = tuition Hóa cũ", t.perSession === 1_000_000 && t.legacyByInvoice === cuR.tuition);
  const r2cu = row((await GET(M2)).json, cu);
  check("Hóa cũ tháng M2 chưa lập phiếu → tuition null (không phải 0)", !r2cu || r2cu.tuition === null, r2cu);

  section("(b) khớp phiếu / (h) phiếu huỷ");
  const liveInvs = await prisma.tuitionInvoice.findMany({ where: { status: { not: "cancelled" } } });
  const diffs: unknown[] = [];
  for (const i of liveInvs) {
    const sum = (await prisma.feeCharge.aggregate({ where: { invoiceId: i.id }, _sum: { amount: true } }))._sum.amount ?? 0;
    const ct = (i.breakdown as any).chargesTotal ?? 0;
    if (sum !== ct) diffs.push({ code: i.code, sum, chargesTotal: ct });
  }
  check("mọi phiếu không huỷ: Σ FeeCharge theo invoiceId = breakdown.chargesTotal (lệch 0 đồng)", liveInvs.length >= 2 && diffs.length === 0, diffs);
  check("invoiced = 600.000 (S1: 200.000 Toán + 300.000 Lý; S2: 100.000), uninvoiced = 300.000 (buổi Lý ngày 25), inCancelledInvoice = 100.000 (S3 Toán buổi 5 — phiếu huỷ)", t.invoiced === 600_000 && t.uninvoiced === 300_000 && t.inCancelledInvoice === 100_000, t);
  check("dòng nằm trong phiếu huỷ VẪN tính vào tuition (Toán 400.000), không biến mất", toanR.tuition === 400_000);
  check("invoiced + uninvoiced + inCancelledInvoice = perSession", t.invoiced + t.uninvoiced + t.inCancelledInvoice === t.perSession);

  section("(d)(c) tháng trước rỗng / tháng rỗng");
  const rM2 = await GET(M2);
  check("M2: Toán 300.000, 2 buổi chốt (buổi NGÀY CUỐI THÁNG nằm trong M2), tháng trước (M3) rỗng → delta/deltaPct null", rM2.status === 200 && row(rM2.json, toan)?.tuition === 300_000 && row(rM2.json, toan)?.closedSessions === 2 && row(rM2.json, toan)?.delta === null && row(rM2.json, toan)?.deltaPct === null, row(rM2.json, toan));
  check("tháng M1 KHÔNG đếm buổi ngày cuối M2 (Toán M1 vẫn 3 buổi)", toanR.closedSessions === 3);
  const rNow = await GET(now);
  check("tháng hiện tại không có buổi nào → 200, emptyMonth=true, mọi số 0", rNow.status === 200 && rNow.json.emptyMonth === true && rNow.json.totals.tuition === 0 && rNow.json.totals.closedSessions === 0 && rNow.json.totals.extra === 0, rNow.json);
  const rM3 = await GET(M3);
  check("tháng xa chưa từng có dữ liệu → 200, emptyMonth=true, rows rỗng", rM3.status === 200 && rM3.json.emptyMonth === true && rM3.json.rows.length === 0, rM3.json);
  const rC = await GET(M1, C);
  check("gia sư chưa có lớp nào → 200, rows=[], emptyMonth=true", rC.status === 200 && rC.json.rows.length === 0 && rC.json.emptyMonth === true, rC.json);
  const rDef = await GET(null);
  check("không gửi ym → mặc định tháng hiện tại giờ VN", rDef.status === 200 && rDef.json.yearMonth === now);

  section("(e) không lộ tên/ID học sinh");
  const csv = await GET(M1, A, "&format=csv");
  const bodies = [JSON.stringify(r1.json), JSON.stringify(rM2.json), csv.text, JSON.stringify(rNow.json)];
  const secrets = [S1.name, S2.name, S3.name, S1.id, S2.id, S3.id, S1.email, S2.email, S3.email];
  check("quét toàn thân JSON + CSV: không tên, không ID, không email học sinh", bodies.every(b => secrets.every(s => !b.includes(s))), secrets.filter(s => bodies.some(b => b.includes(s))));
  check("JSON không có khoá studentId / userId / name học sinh", !/"(studentId|userId|studentName|email)"/.test(JSON.stringify(r1.json)));
  // api() đọc .text() nên bỏ mất BOM → lấy byte thô.
  const rawBytes = new Uint8Array(await (await fetch(`${BASE}/api/tutor/hoc-phi-thang?ym=${M1}&format=csv`, { headers: { cookie: await cookieFor(A) } })).arrayBuffer());
  check("CSV: 3 byte đầu là BOM UTF-8 (EF BB BF) — Excel đọc đúng tiếng Việt", rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf, Array.from(rawBytes.slice(0, 4)));
  check("CSV: 200, text/csv, no-store, có tiêu đề cột + dòng Tổng + tên lớp", csv.status === 200 && (csv.headers.get("content-type") ?? "").startsWith("text/csv") && (csv.headers.get("cache-control") ?? "").includes("no-store") && csv.text.includes("Học phí tháng") && csv.text.includes("Toán 9") && /Tổng/.test(csv.text), { ct: csv.headers.get("content-type"), cc: csv.headers.get("cache-control"), head: csv.text.slice(0, 60) });
  const csvLines = csv.text.replace(/^﻿/, "").trim().split(/\r?\n/);
  check("CSV: số dòng = 1 tiêu đề + số lớp + 1 tổng", csvLines.length === 1 + r1.json.rows.length + 1, csvLines.length);
  check("CSV: số tiền là số nguyên đồng (không 'tr', không 'k', không dấu chấm nhóm)", !/\d(tr|k)\b/i.test(csv.text) && csvLines.some(l => l.includes("400000")), csvLines.slice(0, 3));

  section("(f)(j) cô lập gia sư + đầu vào xấu");
  const rB = await GET(M1, B);
  check("(j) gia sư B chỉ thấy lớp của mình; không thấy lớp của A (tên lẫn id)", rB.status === 200 && rB.json.rows.length === 1 && rB.json.rows[0].courseId === lopB && rB.json.rows[0].tuition === 70_000 && ![toan, ly, cu].some(id => rB.text.includes(id)) && !rB.text.includes("Toán 9"), rB.json);
  check("A không thấy lớp của B", !r1.text.includes(lopB) && !r1.text.includes("Văn của Thầy Minh"));
  check("(f) B xin courseId của A → 403, không lộ tên lớp", await (async () => { const r = await GET(M1, B, `&courseId=${toan}`); return r.status === 403 && !r.text.includes("Toán 9"); })());
  check("(f) courseId lạ → 404", (await GET(M1, A, "&courseId=khong-co-lop")).status === 404);
  const one = await GET(M1, A, `&courseId=${toan}`);
  check("courseId của chính mình → chỉ 1 dòng", one.status === 200 && one.json.rows.length === 1 && one.json.rows[0].courseId === toan);
  check("(f) ym = 2026-13 / 2026-00 / abc / 26-11 / 2026-1 → 400", (await Promise.all(["2026-13", "2026-00", "abc", "26-11", "2026-1", "2026-11-01"].map(v => GET(v)))).every(r => r.status === 400));
  check("(f) ym tương lai (tháng sau) → 400", (await GET(nextYm(now))).status === 400 && (await GET("2099-01")).status === 400);
  check("ym rỗng (?ym=) → dùng mặc định, không lỗi", (await api("GET", "/api/tutor/hoc-phi-thang?ym=", { as: A })).status === 200);
  check("chưa đăng nhập 401 · học sinh 403 · gia sư chờ duyệt 403 · quản trị 403", (await GET(M1, null)).status === 401 && (await GET(M1, S1)).status === 403 && (await GET(M1, PEND)).status === 403 && (await GET(M1, await mkUser({ name: "Quản trị", role: "admin", adminRole: "admin_super" }))).status === 403);
  check("[phá] ym có tiêm SQL/ký tự lạ → 400, không 500", (await GET("2026-11';drop table users;--")).status === 400 && (await GET("%00")).status === 400);

  section("(i) GET không ghi gì");
  const count = async () => JSON.stringify([
    await prisma.feeCharge.count(), await prisma.tuitionInvoice.count(), await prisma.auditLog.count(), await prisma.notification.count(),
    await prisma.attendanceSession.count(), await prisma.attendanceRecord.count(), await prisma.course.count(), await prisma.courseFeeRate.count(), await prisma.monthlyCourseFee.count(),
  ]);
  const c0 = await count();
  const snapCharges = JSON.stringify((await prisma.feeCharge.findMany({ orderBy: { id: "asc" } })).map(c => [c.id, c.amount, c.invoiceId, c.updatedAt.toISOString()]));
  for (const ym of [M1, M2, M3, now]) { await GET(ym); await GET(ym, A, "&format=csv"); await GET(ym, B); }
  check("chạy 12 lần GET (JSON + CSV, nhiều tháng): đếm 9 bảng trước = sau", (await count()) === c0);
  check("và từng dòng FeeCharge giữ nguyên byte (số tiền, phiếu, updatedAt)", JSON.stringify((await prisma.feeCharge.findMany({ orderBy: { id: "asc" } })).map(c => [c.id, c.amount, c.invoiceId, c.updatedAt.toISOString()])) === snapCharges);
  void vnDateKeyOf; void mkCourse;
  await done();
})();
