// HOCPHI-THEO-BUOI mục 8 — API thật: mặc định theo buổi khi tạo lớp, quyền đặt quy tắc (gia sư / quản trị ghi đè), AuditLog + thông báo, luật tính,
// lớp có hai hệ phí (phần B). Có ca phá cố ý. Cần máy chủ dev (BASE) + DB test (wipe() xoá sạch).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-hocphi-theo-buoi.ts
// Ca đánh dấu [D1] cần sửa invoiceServer/feeChargeServer (tệp khóa, mục 10 D1 của đặc tả): nếu chưa mở khóa thì đỏ ĐÚNG như dự kiến — không phải lỗi bài.
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { issueInvoice } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { api, check, done, mkSuper, mkTutor, mkUser, mkCourse, section, wipe } from "./h";

const day = (k: string) => new Date(`${k}T00:00:00Z`);
const prevYm = (ym: string) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};
let seq = 0;
async function createCourse(as: any, extra: Record<string, unknown> = {}) {
  seq++;
  const id = `hb-${Date.now().toString(36)}-${seq}`;
  const res = await api("POST", "/api/courses", { as, body: { ...COURSE_BASE, id, name: `Lớp ${seq}`, adminName: `Lớp ${seq}`, shortTitle: `L${seq}`, ...extra } });
  return { id, res };
}
const enroll = (u: { id: string }, courseId: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status: "active" } });
const charges = (where: object) => prisma.feeCharge.findMany({ where, orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }] });
const audits = (id: string, action?: string) => prisma.auditLog.findMany({ where: { resourceType: "Course", resourceId: id, ...(action ? { action } : {}) }, orderBy: { createdAt: "asc" } });
const notifs = (userId: string, type = "course_fee_override") => prisma.notification.findMany({ where: { userId, type } });

(async () => {
  await wipe();
  const now = vnMonthKey(new Date()), today = vnDateKeyOf(new Date());
  const M1 = prevYm(now), M2 = prevYm(M1);
  const A = await mkTutor("Cô Lan"), B = await mkTutor("Thầy Minh");
  const SUP = await mkSuper("Quản trị cấp 1");
  const CON = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const S1 = await mkUser({ name: "Em Hà Trúc" }), S2 = await mkUser({ name: "Em Bình An" }), S3 = await mkUser({ name: "Em Chi Mai" }), S4 = await mkUser({ name: "Em Dũng Tiến" });
  const PEND = await mkUser({ name: "Cô Chờ Duyệt" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } }); // role student + đơn đang chờ

  // ───────────────────────────────────────────────────────────────────────────
  section("1. POST /api/courses — mặc định theo buổi (3.1)");
  const c1 = await createCourse(A, { feeRate: 150_000 });
  const c1db = await prisma.course.findUniqueOrThrow({ where: { id: c1.id } });
  const c1r = await prisma.courseFeeRate.findMany({ where: { courseId: c1.id } });
  check("có feeRate, không feeMode → per_session + đúng 1 CourseFeeRate 150.000 từ 2000-01-01", c1.res.status === 201 && c1db.feeMode === "per_session" && c1r.length === 1 && c1r[0].rate === 150_000 && c1r[0].effectiveFrom === "2000-01-01", { s: c1.res.status, m: c1db.feeMode, r: c1r });
  const c0 = await createCourse(A);
  check("không gửi feeMode lẫn feeRate → lớp cũ (monthly_sessions), 0 CourseFeeRate", c0.res.status === 201 && (await prisma.course.findUniqueOrThrow({ where: { id: c0.id } })).feeMode === "monthly_sessions" && (await prisma.courseFeeRate.count({ where: { courseId: c0.id } })) === 0);
  const cNull = await createCourse(A, { feeRate: null });
  check("feeRate = null (không phải số) không bị coi là có đơn giá → lớp cũ", cNull.res.status === 201 && (await prisma.course.findUniqueOrThrow({ where: { id: cNull.id } })).feeMode === "monthly_sessions");
  const cBad = await createCourse(A, { feeRate: 50 });
  check("[phá] feeRate 50đ (dưới 1.000) không feeMode → 400, KHÔNG tạo lớp", cBad.res.status === 400 && (await prisma.course.count({ where: { id: cBad.id } })) === 0, cBad.res.json);
  const cBad2 = await createCourse(A, { feeRate: 1500.5 });
  check("[phá] feeRate lẻ → 400, không tạo lớp", cBad2.res.status === 400 && (await prisma.course.count({ where: { id: cBad2.id } })) === 0);
  const cBad3 = await createCourse(A, { feeMode: "per_session" });
  check("[phá] per_session thiếu đơn giá → 400, không tạo lớp", cBad3.res.status === 400 && (await prisma.course.count({ where: { id: cBad3.id } })) === 0);
  const cBad4 = await createCourse(A, { feeRate: "abc" });
  check("[phá] feeRate là chữ → 400", cBad4.res.status === 400 && (await prisma.course.count({ where: { id: cBad4.id } })) === 0);
  const cPendCreate = await createCourse(PEND, { feeRate: 150_000 });
  check("[phá] gia sư CHỜ DUYỆT tạo lớp có đơn giá → 403, không tạo", cPendCreate.res.status === 403 && (await prisma.course.count({ where: { id: cPendCreate.id } })) === 0);
  // Lớp Miễn phí: price 0, không đơn giá → vào lớp + 3 buổi chốt = 0 FeeCharge / 0 phiếu.
  const cFree = await createCourse(A, { tag: "Miễn phí", price: 0 });
  await enroll(S4, cFree.id);
  for (const d of ["10", "11", "12"]) {
    const s = await prisma.attendanceSession.create({ data: { courseId: cFree.id, date: day(`${M1}-${d}`), createdBy: A.id, state: "closed", closedAt: new Date(), closedBy: A.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: S4.id, status: "present" } });
    await api("PUT", `/api/attendance-sessions/${s.id}`, { as: A, body: { records: [{ userId: S4.id, status: "present" }] } });
  }
  check("lớp Miễn phí + 3 buổi đã chốt có mặt → 0 FeeCharge, 0 phiếu", (await prisma.feeCharge.count({ where: { courseId: cFree.id } })) === 0 && (await prisma.tuitionInvoice.count()) === 0);
  const put = await api("PUT", `/api/courses/${c1.id}`, { as: A, body: { name: "Đổi tên", feeMode: "monthly_sessions" } });
  check("PUT /api/courses/[id] vẫn bỏ qua feeMode (lớp theo buổi giữ nguyên)", put.status === 200 && (await prisma.course.findUniqueOrThrow({ where: { id: c1.id } })).feeMode === "per_session");

  // ───────────────────────────────────────────────────────────────────────────
  section("2. Cô lập: quyền đặt quy tắc (3.2)");
  const FR = (id: string) => `/api/courses/${id}/fee-rates`;
  const setBody = (rate: number, effectiveFrom = today) => ({ action: "set_class", rate, effectiveFrom });
  const ratesBefore = await prisma.courseFeeRate.count(), auditBefore = await prisma.auditLog.count();
  const rB = await api("POST", FR(c1.id), { as: B, body: setBody(200_000) });
  check("gia sư B sửa luật lớp của A → 403", rB.status === 403, rB.json);
  check("B xem GET fee-rates lớp của A → 403, không lộ tên lớp", (await api("GET", FR(c1.id), { as: B })).status === 403 && !(await api("GET", FR(c1.id), { as: B })).text.includes("Đổi tên"));
  check("403 của B: không ghi CourseFeeRate, không ghi AuditLog, không thông báo", (await prisma.courseFeeRate.count()) === ratesBefore && (await prisma.auditLog.count()) === auditBefore && (await prisma.notification.count({ where: { type: "course_fee_override" } })) === 0);
  check("lớp không có → 404 (GET và POST)", (await api("POST", FR("khong-co-lop"), { as: A, body: setBody(200_000) })).status === 404 && (await api("GET", FR("khong-co-lop"), { as: A })).status === 404);
  check("chưa đăng nhập → 401", (await api("POST", FR(c1.id), { body: setBody(200_000) })).status === 401 && (await api("GET", FR(c1.id))).status === 401);
  check("học sinh → 403", (await api("POST", FR(c1.id), { as: S1, body: setBody(200_000) })).status === 403 && (await api("GET", FR(c1.id), { as: S1 })).status === 403);
  check("gia sư CHỜ DUYỆT (role student + đơn pending) → 403 trên fee-rates GET/POST", (await api("POST", FR(c1.id), { as: PEND, body: setBody(200_000) })).status === 403 && (await api("GET", FR(c1.id), { as: PEND })).status === 403);
  check("gia sư chờ duyệt → 403 trên /api/tutor/hoc-phi-thang; chưa đăng nhập 401; học sinh 403", (await api("GET", "/api/tutor/hoc-phi-thang", { as: PEND })).status === 403 && (await api("GET", "/api/tutor/hoc-phi-thang")).status === 401 && (await api("GET", "/api/tutor/hoc-phi-thang", { as: S1 })).status === 403);
  check("sau mọi ca bị từ chối: vẫn 0 ghi", (await prisma.courseFeeRate.count()) === ratesBefore && (await prisma.auditLog.count()) === auditBefore);
  const cCenter = await mkCourse(null, { name: "Lớp trung tâm" });
  await prisma.course.update({ where: { id: cCenter.id }, data: { feeMode: "per_session" } });
  await prisma.courseFeeRate.create({ data: { courseId: cCenter.id, mode: "per_session", rate: 100_000, effectiveFrom: "2000-01-01", createdBy: SUP.id } });
  check("lớp trung tâm (ownerId null): gia sư 403", (await api("POST", FR(cCenter.id), { as: A, body: setBody(120_000) })).status === 403);
  const rCenter = await api("POST", FR(cCenter.id), { as: SUP, body: setBody(120_000) });
  check("lớp trung tâm: quản trị cấp 1 được (override=false vì không có chủ), không ai nhận thông báo", rCenter.status === 200 && rCenter.json.override === false && (await prisma.notification.count({ where: { type: "course_fee_override" } })) === 0, rCenter.json);
  check("[phá] POST không phải JSON / action lạ → 400", (await api("POST", FR(c1.id), { as: A, body: { action: "xoa-het" } })).status === 400 && (await api("POST", FR(c1.id), { as: A, raw: "khong-phai-json" })).status === 400);
  const legacyPost = await api("POST", FR(c0.id), { as: A, body: setBody(100_000) });
  check("lớp cũ → 409 (không đổi đơn giá ở đây)", legacyPost.status === 409);

  // ───────────────────────────────────────────────────────────────────────────
  section("3. Quản trị ghi đè + AuditLog + đúng 1 thông báo");
  await enroll(S1, c1.id);
  const c2 = await createCourse(A, { feeRate: 100_000 }); // lớp thứ hai của A, cho admin_content
  const pv = await api("POST", FR(c1.id), { as: SUP, body: { action: "preview_class", rate: 180_000, effectiveFrom: today } });
  check("preview_* → 200, applied=false, KHÔNG audit, KHÔNG thông báo", pv.status === 200 && pv.json.applied === false && (await audits(c1.id, "course_fee.set_rate")).length === 0 && (await notifs(A.id)).length === 0, pv.json);
  const o1 = await api("POST", FR(c1.id), { as: SUP, body: setBody(180_000) });
  check("admin_super đổi đơn giá lớp của A → 200, applied, override=true", o1.status === 200 && o1.json.applied === true && o1.json.override === true, o1.json);
  const a1 = (await audits(c1.id, "course_fee.set_rate"))[0];
  const m1 = (a1?.metadata ?? {}) as Record<string, unknown>;
  check("AuditLog: actor = quản trị, override:true, byRole admin_super, ownerId = A, previousRate 150000, preview:false, rate 180000", !!a1 && a1.actorId === SUP.id && m1.override === true && m1.byRole === "admin_super" && m1.ownerId === A.id && m1.previousRate === 150_000 && m1.preview === false && m1.rate === 180_000, m1);
  const n1 = await notifs(A.id);
  check("A nhận đúng 1 Notification course_fee_override, link tab Học phí của lớp", n1.length === 1 && n1[0].link === `/lop-cua-toi/${encodeURIComponent(c1.id)}?tab=hoc-phi` && n1[0].isRead === false, n1);
  await api("POST", FR(c1.id), { as: SUP, body: setBody(190_000, addDaysKey(today, 1)) });
  check("bấm lần hai liên tiếp vẫn 1 thông báo (chống dội), nhưng audit có 2 dòng", (await notifs(A.id)).length === 1 && (await audits(c1.id, "course_fee.set_rate")).length === 2);
  const text = `${n1[0].title} ${n1[0].message}`;
  check("nội dung thông báo không chứa chữ số, không tên em, không tên lớp", !/\d/.test(text) && !/Hà Trúc|Bình An|Chi Mai|Dũng Tiến|Đổi tên|Lớp \d/.test(text), text);
  const o2 = await api("POST", FR(c2.id), { as: CON, body: setBody(110_000) });
  const a2 = (await audits(c2.id, "course_fee.set_rate"))[0];
  check("admin_content đổi lớp của A → 200, audit byRole admin_content + override:true", o2.status === 200 && o2.json.override === true && (a2?.metadata as any)?.byRole === "admin_content" && (a2?.metadata as any)?.override === true, { s: o2.status, m: a2?.metadata });
  check("lớp thứ hai: A có thêm đúng 1 thông báo (link khác lớp) → tổng 2, không dòng trùng link", (await notifs(A.id)).length === 2 && new Set((await notifs(A.id)).map(n => n.link)).size === 2);
  const before = (await notifs(A.id)).length, auditsBefore = (await audits(c2.id, "course_fee.set_rate")).length;
  const self = await api("POST", FR(c2.id), { as: A, body: setBody(120_000, addDaysKey(today, 2)) });
  const aSelf = (await audits(c2.id, "course_fee.set_rate")).at(-1);
  check("A tự đổi lớp mình → 200, override=false, audit byRole teacher override:false, KHÔNG thông báo thêm", self.status === 200 && self.json.override === false && (await audits(c2.id, "course_fee.set_rate")).length === auditsBefore + 1 && (aSelf?.metadata as any)?.override === false && (aSelf?.metadata as any)?.byRole === "teacher" && (await notifs(A.id)).length === before, { j: self.json, m: aSelf?.metadata });
  const sr = await api("POST", FR(c1.id), { as: SUP, body: { action: "set_student", studentId: S1.id, rate: 90_000, effectiveFrom: today } });
  const aS = (await audits(c1.id, "course_fee.set_student_rate")).at(-1);
  check("set_student bởi quản trị → audit course_fee.set_student_rate, chỉ studentId (không tên em), override:true", sr.status === 200 && !!aS && (aS.metadata as any).studentId === S1.id && (aS.metadata as any).override === true && !JSON.stringify(aS.metadata).includes("Hà Trúc"), aS?.metadata);
  check("[phá] đơn giá riêng cho em KHÔNG học lớp → 400, không audit mới", await (async () => { const n = (await audits(c1.id)).length; const r = await api("POST", FR(c1.id), { as: SUP, body: { action: "set_student", studentId: S3.id, rate: 90_000, effectiveFrom: today } }); return r.status === 400 && (await audits(c1.id)).length === n; })());
  check("[phá] đơn giá < 1.000 / ngày hiệu lực xa quá 400 ngày → 400", (await api("POST", FR(c1.id), { as: SUP, body: setBody(500) })).status === 400 && (await api("POST", FR(c1.id), { as: SUP, body: setBody(150_000, addDaysKey(today, 500)) })).status === 400);

  // ───────────────────────────────────────────────────────────────────────────
  section("4. Dòng đã vào phiếu không đổi khi quản trị ghi đè");
  const c4 = await createCourse(A, { feeRate: 100_000 });
  await enroll(S2, c4.id);
  const closedSession = async (courseId: string, dateKey: string, rows: Array<{ userId: string; status: string; makeupCreditId?: string }>, tutor = A) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date: day(dateKey), createdBy: tutor.id, state: "closed", closedAt: new Date(), closedBy: tutor.id } });
    const r = await api("PUT", `/api/attendance-sessions/${s.id}`, { as: tutor, body: { records: rows } });
    return { id: s.id, res: r };
  };
  const s4 = await closedSession(c4.id, `${M2}-10`, [{ userId: S2.id, status: "present" }]);
  const inv4 = await issueInvoice({ tutorId: A.id, studentId: S2.id, yearMonth: M2 });
  const ch4 = await charges({ courseId: c4.id });
  check("buổi chốt tháng M2 → 1 dòng 100.000, đã vào phiếu", s4.res.status === 200 && ch4.length === 1 && ch4[0].amount === 100_000 && ch4[0].invoiceId !== null && (inv4 as any).ok !== false, { ch4, inv4 });
  const snap = JSON.stringify(ch4.map(c => [c.id, c.amount, c.rate, c.invoiceId, c.updatedAt.toISOString()]));
  const inv4db = await prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: S2.id } });
  const o4 = await api("POST", FR(c4.id), { as: SUP, body: { action: "set_class", rate: 300_000, effectiveFrom: `${M2}-01` } });
  const after4 = await charges({ courseId: c4.id });
  check("quản trị đổi đơn giá lùi về đầu M2 → dòng đã vào phiếu giữ nguyên từng byte, phiếu không đổi", o4.status === 200 && JSON.stringify(after4.map(c => [c.id, c.amount, c.rate, c.invoiceId, c.updatedAt.toISOString()])) === snap && (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: inv4db.id } })).amountDue === inv4db.amountDue, { o4: o4.json });
  check("audit ghi frozen ≥ 1, override:true", ((await audits(c4.id, "course_fee.set_rate"))[0]?.metadata as any)?.frozen >= 1 && ((await audits(c4.id, "course_fee.set_rate"))[0]?.metadata as any)?.override === true);

  // ───────────────────────────────────────────────────────────────────────────
  section("5. Luật tính tiền (chỉ mô tả mã hiện hành)");
  const c5 = await createCourse(A, { feeRate: 100_000 });
  for (const u of [S1, S2, S3, S4]) await enroll(u, c5.id);
  const open = await prisma.attendanceSession.create({ data: { courseId: c5.id, date: day(`${M1}-05`), createdBy: A.id } }); // CHƯA chốt
  await api("PUT", `/api/attendance-sessions/${open.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "late" }] } });
  check("lưu điểm danh khi CHƯA chốt → 0 dòng phí", (await charges({ courseId: c5.id })).length === 0);
  const cl = await api("POST", `/api/courses/${c5.id}/sessions/${M1}-05/close`, { as: A, body: { action: "close" } });
  check("bấm Đã dạy xong → 2 dòng (có mặt + muộn) × 100.000", cl.status === 200 && (await charges({ courseId: c5.id })).length === 2 && (await charges({ courseId: c5.id })).every(c => c.amount === 100_000), cl.json);
  const cl2 = await api("POST", `/api/courses/${c5.id}/sessions/${M1}-05/close`, { as: A, body: { action: "close" } });
  check("chốt lần hai → vẫn 2 dòng, không dòng thứ hai cho cùng bản ghi", cl2.status === 200 && (await charges({ courseId: c5.id })).length === 2 && new Set((await charges({ courseId: c5.id })).map(c => c.recordId)).size === 2);
  const s5 = await closedSession(c5.id, `${M1}-06`, [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "absent" }, { userId: S3.id, status: "excused" }, { userId: S4.id, status: "late" }]);
  const d6 = (await charges({ courseId: c5.id, dateKey: `${M1}-06` }));
  check("present + late tính; absent + excused (có phép) không", s5.res.status === 200 && d6.length === 2 && new Set(d6.map(c => c.studentId)).size === 2 && d6.some(c => c.studentId === S1.id) && d6.some(c => c.studentId === S4.id), d6);
  const abs = await prisma.classAbsence.create({ data: { courseId: c5.id, scheduleId: "s", dateKey: `${M1}-01`, startAt: new Date(), studentId: S3.id, reportedBy: "parent", leadMinutes: 600, status: "excused_auto" } });
  const cred = await prisma.makeupCredit.create({ data: { studentId: S3.id, courseId: c5.id, absenceId: abs.id, expiresAt: new Date(Date.now() + 10 * 86400_000) } });
  const s7 = await closedSession(c5.id, `${M1}-07`, [{ userId: S3.id, status: "present", makeupCreditId: cred.id }, { userId: S1.id, status: "present" }]);
  const d7 = await charges({ courseId: c5.id, dateKey: `${M1}-07` });
  check("em dùng buổi bù: buổi bù 0đ; em khác vẫn tính", s7.res.status === 200 && d7.length === 1 && d7[0].studentId === S1.id, d7);
  const c5h = await createCourse(A, { feeMode: "per_hour", feeRate: 150_001, feeSessionMinutes: 90 });
  await enroll(S1, c5h.id);
  await closedSession(c5h.id, `${M1}-08`, [{ userId: S1.id, status: "present" }]);
  const dh = await charges({ courseId: c5h.id });
  check("làm tròn per_hour: 150.001đ/giờ × 90 phút = 225.001,5 → 225.002 (nửa đồng làm tròn lên)", dh.length === 1 && dh[0].amount === 225_002 && dh[0].units === 90, dh);
  await api("POST", `/api/courses/${c5.id}/sessions/${M1}-06/close`, { as: A, body: { action: "close" } });
  check("chốt lại buổi đã chốt không nhân đôi dòng nào của lớp", (await charges({ courseId: c5.id })).length === 5);

  // ───────────────────────────────────────────────────────────────────────────
  section("6. Lớp có hai hệ phí (phần B): MonthlyCourseFee + FeeCharge");
  // Lớp "đã chuyển" dựng bằng DB đúng thứ script để lại: feeMode per_session + CourseFeeRate đầu tiên effectiveFrom = S-01 (S = tháng hiện tại).
  const S = now;
  const c6 = await mkCourse(A.id, { name: "Lớp đã chuyển" });
  await prisma.course.update({ where: { id: c6.id }, data: { feeMode: "per_session" } });
  await prisma.courseFeeRate.create({ data: { courseId: c6.id, mode: "per_session", rate: 100_000, effectiveFrom: `${S}-01`, note: "Chuyển", createdBy: "script:chuyen-lop" } });
  await enroll(S1, c6.id);
  await prisma.monthlyCourseFee.create({ data: { courseId: c6.id, yearMonth: M1, sessionCount: 4, updatedBy: A.id } });
  check("PUT .../fees tháng từ mốc S trở đi → 409", (await api("PUT", `/api/courses/${c6.id}/fees`, { as: A, body: { yearMonth: S, sessionCount: 4 } })).status === 409);
  check("PUT .../fees tháng TRƯỚC mốc vẫn được (cách cũ) → 200", (await api("PUT", `/api/courses/${c6.id}/fees`, { as: A, body: { yearMonth: M1, sessionCount: 5 } })).status === 200);
  const back = await api("POST", FR(c6.id), { as: A, body: { action: "set_class", rate: 90_000, effectiveFrom: `${M1}-15` } });
  check("fee-rates: ngày hiệu lực lùi trước mốc tháng → 400 (không hạ sàn), chưa có dòng đơn giá mới", back.status === 400 && (await prisma.courseFeeRate.count({ where: { courseId: c6.id } })) === 1, back.json);
  check("fee-rates: ngày hiệu lực sau mốc → được", (await api("POST", FR(c6.id), { as: A, body: { action: "preview_class", rate: 90_000, effectiveFrom: `${S}-02` } })).status === 200);
  // [D1] phiếu tháng trước mốc dùng MonthlyCourseFee; tháng mốc dùng FeeCharge; mỗi (em, tháng) đúng một phiếu.
  const sS = await prisma.attendanceSession.create({ data: { courseId: c6.id, date: day(today), createdBy: A.id, state: "closed", closedAt: new Date(), closedBy: A.id } });
  await api("PUT", `/api/attendance-sessions/${sS.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }] } });
  check("buổi chốt ở tháng mốc → 1 FeeCharge 100.000 tháng S", (await charges({ courseId: c6.id })).length === 1 && (await charges({ courseId: c6.id }))[0].yearMonth === S);
  const invPrev = await issueInvoice({ tutorId: A.id, studentId: S1.id, yearMonth: M1 });
  const invPrevDb = await prisma.tuitionInvoice.findFirst({ where: { studentId: S1.id, yearMonth: M1 } });
  const perSubjectPrev = ((invPrevDb?.breakdown as any)?.perSubject ?? []).filter((p: any) => p.courseId === c6.id);
  check("[D1] issueInvoice tháng M1 (trước mốc) của lớp đã chuyển vẫn tính theo MonthlyCourseFee (5 buổi), không mất học phí tháng trước", (invPrev as any).ok !== false && perSubjectPrev.length === 1 && perSubjectPrev[0].subtotal > 0, { invPrev, perSubjectPrev });
  const invCur = await issueInvoice({ tutorId: A.id, studentId: S1.id, yearMonth: S });
  const curCharges = await charges({ courseId: c6.id });
  check("[D1] issueInvoice tháng mốc S dùng FeeCharge: dòng 100.000 vào phiếu S, đúng 1 phiếu (em, S)", (invCur as any).ok !== false && curCharges[0]?.invoiceId !== null && (await prisma.tuitionInvoice.count({ where: { studentId: S1.id, yearMonth: S } })) === 1, { invCur, curCharges });
  const invDup = await issueInvoice({ tutorId: A.id, studentId: S1.id, yearMonth: S });
  check("lập phiếu lần hai cùng (em, tháng) không tạo phiếu thứ hai", (await prisma.tuitionInvoice.count({ where: { studentId: S1.id, yearMonth: S } })) === 1 && (invDup as any).ok !== true || (await prisma.tuitionInvoice.count({ where: { studentId: S1.id, yearMonth: S } })) === 1);
  const allCharges = await prisma.feeCharge.findMany({ where: { studentId: S1.id, courseId: c6.id } });
  check("mỗi FeeCharge của lớp chỉ nằm trong tối đa 1 phiếu và không dòng nào hai lần (recordId duy nhất)", new Set(allCharges.map(c => c.recordId)).size === allCharges.length);
  // [D1] syncSessionCharges: buổi chốt TRƯỚC mốc của lớp đã chuyển không được sinh FeeCharge.
  const sBefore = await prisma.attendanceSession.create({ data: { courseId: c6.id, date: day(`${M1}-20`), createdBy: A.id, state: "closed", closedAt: new Date(), closedBy: A.id } });
  await api("PUT", `/api/attendance-sessions/${sBefore.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }] } });
  check("[D1] buổi chốt trước mốc của lớp đã chuyển KHÔNG sinh FeeCharge (skipped before_start)", (await charges({ courseId: c6.id, dateKey: `${M1}-20` })).length === 0, await charges({ courseId: c6.id, dateKey: `${M1}-20` }));

  await done();
})();
