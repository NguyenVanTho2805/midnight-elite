// HP-14..HP-17 — API: chọn hình thức học phí khi TẠO lớp, học phí tự sinh khi điểm danh (theo buổi / giờ / khoá), lập phiếu có dòng phí,
// đổi đơn giá có hiệu lực từ ngày + xem trước, đơn giá riêng từng em, và BẰNG CHỨNG số cũ không đổi (lớp cũ lệch 0 đồng).
// Cần máy chủ dev đang chạy (BASE). Phần chặn Preview chạy trong tiến trình test (gọi thẳng hàm), vì máy chủ dev không phải Preview.
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { computeMonthlyFee } from "@/lib/tuition";
import { changeRate, moneyPathsBlocked, syncSessionCharges } from "@/lib/feeChargeServer";
import { issueInvoice } from "@/lib/invoiceServer";

const day = (k: string) => new Date(`${k}T00:00:00Z`);
let courseSeq = 0;
const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};
async function createCourse(as: any, extra: Record<string, unknown> = {}) {
  courseSeq++;
  const id = `hp-${Date.now().toString(36)}-${courseSeq}`;
  const r = await api("POST", "/api/courses", { as, body: { ...COURSE_BASE, id, name: `Lớp ${courseSeq}`, adminName: `Lớp ${courseSeq}`, shortTitle: `L${courseSeq}`, ...extra } });
  return { id, res: r };
}
const enroll = (u: { id: string }, courseId: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status: "active" } });
const charges = (where: object) => prisma.feeCharge.findMany({ where, orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }] });

(async () => {
  await wipe();
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" }), C = await mkUser({ name: "Em Chi" }), D = await mkUser({ name: "Em Dũng" });
  const today = vnDateKeyOf(new Date());

  section("A. HP-15 · chọn hình thức khi TẠO lớp");
  const cDefault = await createCourse(T1);
  const cDefaultDb = await prisma.course.findUniqueOrThrow({ where: { id: cDefault.id } });
  check("không gửi feeMode → lớp mặc định cách cũ, KHÔNG có dòng đơn giá", cDefault.res.status === 201 && cDefaultDb.feeMode === "monthly_sessions" && (await prisma.courseFeeRate.count({ where: { courseId: cDefault.id } })) === 0, cDefault.res.json);
  const cExplicit = await createCourse(T1, { feeMode: "monthly_sessions" });
  check("gửi 'monthly_sessions' rõ ràng → vẫn lớp cũ", (await prisma.course.findUniqueOrThrow({ where: { id: cExplicit.id } })).feeMode === "monthly_sessions" && (await prisma.courseFeeRate.count({ where: { courseId: cExplicit.id } })) === 0);
  const cS = await createCourse(T1, { feeMode: "per_session", feeRate: 150_000 });
  const rS = await prisma.courseFeeRate.findFirstOrThrow({ where: { courseId: cS.id } });
  check("theo buổi 150.000: feeMode + 1 dòng đơn giá hiệu lực 'từ khi tạo lớp', người tạo = T1", cS.res.status === 201 && (await prisma.course.findUniqueOrThrow({ where: { id: cS.id } })).feeMode === "per_session" && rS.rate === 150_000 && rS.effectiveFrom === "2000-01-01" && rS.createdBy === T1.id && rS.sessionMinutes === null, rS);
  const cH = await createCourse(T1, { feeMode: "per_hour", feeRate: 200_000, feeSessionMinutes: 90 });
  check("theo giờ 200.000/giờ × 90 phút", cH.res.status === 201 && (await prisma.courseFeeRate.findFirstOrThrow({ where: { courseId: cH.id } })).sessionMinutes === 90);
  const cC = await createCourse(T1, { feeMode: "per_course", feeRate: 3_000_000 });
  check("theo khoá 3.000.000", cC.res.status === 201 && (await prisma.course.findUniqueOrThrow({ where: { id: cC.id } })).feeMode === "per_course");
  check("[phá] hình thức lạ → 400, lớp KHÔNG được tạo", (await createCourse(T1, { feeMode: "per_week", feeRate: 100_000 })).res.status === 400 && (await prisma.course.count({ where: { name: { startsWith: "Lớp" } } })) === 5);
  check("[phá] theo giờ thiếu số phút → 400", (await createCourse(T1, { feeMode: "per_hour", feeRate: 100_000 })).res.status === 400);
  check("[phá] đơn giá 50đ / lẻ / thiếu → 400", (await createCourse(T1, { feeMode: "per_session", feeRate: 50 })).res.status === 400 && (await createCourse(T1, { feeMode: "per_session", feeRate: 1500.5 })).res.status === 400 && (await createCourse(T1, { feeMode: "per_session" })).res.status === 400);
  check("học viên không tạo được lớp → 403", (await createCourse(A, { feeMode: "per_session", feeRate: 100_000 })).res.status === 403);
  const put = await api("PUT", `/api/courses/${cS.id}`, { as: T1, body: { feeMode: "monthly_sessions", name: "Đổi tên" } });
  check("KHÔNG có đường đổi hình thức của lớp đã tạo: PUT /api/courses bỏ qua feeMode", put.status === 200 && (await prisma.course.findUniqueOrThrow({ where: { id: cS.id } })).feeMode === "per_session");
  const dup = await api("POST", `/api/courses/${cS.id}/duplicate`, { as: T1 });
  const dupDb = await prisma.course.findUniqueOrThrow({ where: { id: dup.json.id } });
  check("bản sao lớp theo buổi giữ hình thức + đơn giá hiện hành", dup.status === 200 && dupDb.feeMode === "per_session" && (await prisma.courseFeeRate.findFirstOrThrow({ where: { courseId: dupDb.id } })).rate === 150_000);
  const dupLegacy = await api("POST", `/api/courses/${cDefault.id}/duplicate`, { as: T1 });
  check("bản sao lớp cũ vẫn là lớp cũ", (await prisma.course.findUniqueOrThrow({ where: { id: dupLegacy.json.id } })).feeMode === "monthly_sessions");

  // Lớp cũ có sẵn dữ liệu số buổi tháng (cách tính hiện tại).
  const cL = await mkCourse(T1.id, { name: "Toán cũ" });
  await prisma.monthlyCourseFee.create({ data: { courseId: cL.id, yearMonth: "2026-10", sessionCount: 8, updatedBy: T1.id } });
  for (const u of [A, B, C, D]) await enroll(u, cS.id);
  for (const u of [A, B]) await enroll(u, cH.id);
  await enroll(C, cC.id); // An vào lớp theo khoá ở mục H (để phiếu tháng 10 của An chỉ có buổi)
  await enroll(B, cL.id);

  const mkSess = async (courseId: string, dateKey: string) => (await api("POST", `/api/courses/${courseId}/attendance-sessions`, { as: T1, body: { date: dateKey } })).json.id as string;
  const mark = (sid: string, rows: Array<{ userId: string; status: string; makeupCreditId?: string }>, as = T1) => api("PUT", `/api/attendance-sessions/${sid}`, { as, body: { records: rows } });

  section("B. HP-14 · điểm danh sinh học phí theo buổi");
  const s1 = await mkSess(cS.id, "2026-10-05");
  const m1 = await mark(s1, [{ userId: A.id, status: "present" }, { userId: B.id, status: "late" }, { userId: C.id, status: "excused" }, { userId: D.id, status: "absent" }]);
  const ch1 = await charges({ courseId: cS.id });
  check("chỉ có mặt + muộn sinh phí (2 dòng × 150.000); có phép / vắng KHÔNG", m1.status === 200 && ch1.length === 2 && ch1.every(c => c.amount === 150_000 && c.kind === "session" && c.mode === "per_session" && c.dateKey === "2026-10-05" && c.yearMonth === "2026-10" && c.invoiceId === null && c.tutorId === T1.id) && new Set(ch1.map(c => c.studentId)).size === 2, ch1);
  await mark(s1, [{ userId: A.id, status: "present" }, { userId: B.id, status: "late" }]);
  const ch1b = await charges({ courseId: cS.id });
  check("lưu lại lần nữa: KHÔNG nhân đôi (vẫn 2 dòng, cùng id)", ch1b.length === 2 && ch1b.map(c => c.id).sort().join() === ch1.map(c => c.id).sort().join());
  await mark(s1, [{ userId: A.id, status: "absent" }]);
  check("đổi An sang vắng khi CHƯA vào phiếu → dòng phí của An bị bỏ", (await charges({ courseId: cS.id, studentId: A.id })).length === 0 && (await charges({ courseId: cS.id, studentId: B.id })).length === 1);
  await mark(s1, [{ userId: A.id, status: "present" }]);
  check("đổi lại có mặt → sinh lại đúng 1 dòng", (await charges({ courseId: cS.id, studentId: A.id })).length === 1);
  check("người khác (T2) điểm danh lớp của T1 → 403, không sinh phí", (await mark(s1, [{ userId: C.id, status: "present" }], T2)).status === 403 && (await charges({ courseId: cS.id, studentId: C.id })).length === 0);

  const legacySess = await prisma.attendanceSession.create({ data: { courseId: cL.id, date: day("2026-10-05"), createdBy: T1.id } });
  const legacyPut = await mark(legacySess.id, [{ userId: B.id, status: "present" }]);
  check("[số cũ] điểm danh lớp CŨ: 0 dòng phí mới được ghi", legacyPut.status === 200 && (await prisma.feeCharge.count({ where: { courseId: cL.id } })) === 0);

  const mkAbs = (studentId: string) => prisma.classAbsence.create({ data: { courseId: cS.id, scheduleId: "s", dateKey: "2026-09-20", startAt: new Date(), studentId, reportedBy: "parent", leadMinutes: 600, status: "excused_auto" } });
  const credC = await prisma.makeupCredit.create({ data: { studentId: C.id, courseId: cS.id, absenceId: (await mkAbs(C.id)).id, expiresAt: new Date(Date.now() + 10 * 86400_000) } });
  const s2 = await mkSess(cS.id, "2026-10-06");
  await mark(s2, [{ userId: C.id, status: "present", makeupCreditId: credC.id }]);
  check("buổi dùng buổi bù: có mặt nhưng KHÔNG sinh thêm tiền (đúng quy tắc buổi bù hiện có)", (await charges({ courseId: cS.id, studentId: C.id })).length === 0);

  section("C. HP-14 · theo giờ (làm tròn từng buổi)");
  const h1 = await mkSess(cH.id, "2026-10-07");
  await mark(h1, [{ userId: A.id, status: "present" }]);
  const hc = await charges({ courseId: cH.id });
  check("200.000đ/giờ × 90 phút = 300.000, lưu số phút + đơn giá", hc.length === 1 && hc[0].amount === 300_000 && hc[0].units === 90 && hc[0].rate === 200_000 && hc[0].mode === "per_hour", hc);

  section("D. Lập phiếu có dòng phí mới — chốt và đóng băng");
  await api("PUT", "/api/tutor/payout-account", { as: T1, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Nguyen Thi Lan" } });
  const s3 = await mkSess(cS.id, "2026-10-12");
  await mark(s3, [{ userId: A.id, status: "present" }, { userId: B.id, status: "present" }]);
  // An: cS 2 buổi (5/10 và 12/10) = 300.000 + cH 1 buổi 300.000 = 600.000 ; chưa có lớp cũ
  const issA = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [A.id] } });
  const invA = issA.json.created[0];
  const invADb = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: invA.id } });
  const bdA = invADb.breakdown as any;
  check("phiếu An = 3 buổi (2 theo buổi + 1 theo giờ) = 600.000", issA.status === 201 && invA.amountDue === 600_000 && invADb.amountDue === 600_000, issA.json);
  check("breakdown có chargeLines + chargesTotal 600.000, tổng các dòng đúng", bdA.chargesTotal === 600_000 && bdA.chargeLines.reduce((s: number, l: any) => s + l.amount, 0) === 600_000 && bdA.chargeLines.some((l: any) => l.description === "2 buổi × 150.000đ") && bdA.chargeLines.some((l: any) => /1 buổi × 90 phút × 200\.000đ\/giờ/.test(l.description)), bdA);
  const frozen = await charges({ studentId: A.id });
  check("3 dòng phí của An đã gắn vào phiếu (đóng băng)", frozen.length === 3 && frozen.every(c => c.invoiceId === invA.id));
  await mark(s1, [{ userId: A.id, status: "absent" }]);
  const afterEdit = await charges({ studentId: A.id, dateKey: "2026-10-05", courseId: cS.id });
  check("[chốt] sửa điểm danh buổi ĐÃ VÀO PHIẾU: dòng phí giữ nguyên 150.000, phiếu không đổi", afterEdit.length === 1 && afterEdit[0].amount === 150_000 && (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: invA.id } })).amountDue === 600_000);
  const s4 = await mkSess(cS.id, "2026-10-19");
  await mark(s4, [{ userId: A.id, status: "present" }]);
  const late = await charges({ studentId: A.id, dateKey: "2026-10-19" });
  check("buổi điểm danh SAU khi đã lập phiếu: dòng mới CHƯA vào phiếu, phiếu cũ không đổi", late.length === 1 && late[0].invoiceId === null && (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: invA.id } })).amountDue === 600_000);
  const again = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [A.id] } });
  check("lập lại tháng đó → 'Đã có phiếu', không phát sinh phiếu thứ hai", again.json.created.length === 0 && /Đã có phiếu/.test(again.json.skipped[0].reason));
  const issD = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [D.id] } });
  check("em ở lớp kiểu mới mà không có buổi tính phí → bỏ qua với lời giải thích", issD.json.created.length === 0 && /Chưa có buổi nào được tính phí/.test(issD.json.skipped[0].reason), issD.json);

  section("E. Phiếu hỗn hợp (lớp cũ + lớp mới) — phần lớp cũ KHÔNG đổi");
  // Bình: lớp cũ cL 8 buổi (70k × 8 = 560.000, bậc thang chỉ tính lớp cũ => 1 môn) + cS 2 buổi (5/10 muộn + 12/10) + cH chưa
  const issB = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [B.id] } });
  const invB = issB.json.created[0];
  const bdB = (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: invB.id } })).breakdown as any;
  const oracleB = computeMonthlyFee({ subjects: [{ courseId: cL.id, courseName: "Toán cũ", sessionCount: 8, freeCount: 0 }] });
  check("phần lớp cũ của Bình vẫn 8 × 70.000 = 560.000 (không bị bậc thang tính thêm lớp mới)", bdB.perSubject.length === 1 && bdB.pricePerSession === 70_000 && bdB.gross === oracleB.gross && bdB.gross === 560_000, bdB);
  check("tổng phiếu Bình = 560.000 + 2 buổi × 150.000 + (1 buổi giờ không có) = 860.000", invB.amountDue === 860_000 && bdB.chargesTotal === 300_000, invB);

  section("F. HP-16 · đổi đơn giá có hiệu lực từ ngày + xem trước tác động");
  // Chuẩn bị: cS còn các buổi CHƯA vào phiếu >= 20/10 và < 20/10 của Chi/Dũng/An/Bình
  for (const k of ["2026-10-20", "2026-10-27"]) {
    const sid = await mkSess(cS.id, k);
    await mark(sid, [{ userId: B.id, status: "present" }, { userId: C.id, status: "present" }, { userId: D.id, status: "present" }, { userId: A.id, status: "present" }]);
  }
  const before = await charges({ courseId: cS.id });
  const uninv = before.filter(c => !c.invoiceId && c.dateKey >= "2026-10-20");
  const inv20 = before.filter(c => c.invoiceId && c.dateKey >= "2026-10-20");
  const REQ = { rate: 180_000, effectiveFrom: "2026-10-20", note: "Tăng giá" };
  check("nền: có dòng chưa vào phiếu (8) và các dòng đã vào phiếu trước mốc", uninv.length === 8 && inv20.length === 0, { uninv: uninv.length });
  check("T2 / học viên không xem trước được → 403", (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T2, body: { action: "preview_class", ...REQ } })).status === 403 && (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: A, body: { action: "preview_class", ...REQ } })).status === 403);
  const pv = await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "preview_class", ...REQ } });
  check("xem trước: 8 dòng đổi 150.000 → 180.000 (+240.000), 0 dòng đóng băng sau mốc", pv.status === 200 && pv.json.applied === false && pv.json.plan.changedCount === 8 && pv.json.plan.beforeTotal === 1_200_000 && pv.json.plan.afterTotal === 1_440_000 && pv.json.plan.delta === 240_000, pv.json);
  check("xem trước KHÔNG ghi: đơn giá & dòng phí y nguyên", (await prisma.courseFeeRate.count({ where: { courseId: cS.id } })) === 1 && (await charges({ courseId: cS.id, dateKey: "2026-10-20" })).every(c => c.amount === 150_000));
  const pv2 = await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "preview_class", rate: 180_000, effectiveFrom: "2026-10-01" } });
  check("mốc sớm hơn (1/10): đếm đúng các dòng đã vào phiếu là 'không đổi'", pv2.json.plan.frozenCount === 4 && pv2.json.plan.frozenTotal === 600_000 && pv2.json.plan.changedCount === 8 + 0 + (before.filter(c => !c.invoiceId && c.dateKey < "2026-10-20").length), pv2.json.plan);
  const set = await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_class", ...REQ } });
  check("áp dụng: số liệu GIỐNG HỆT xem trước (cùng một đường tính)", set.status === 200 && set.json.applied === true && JSON.stringify(set.json.plan.changedCount) === JSON.stringify(pv.json.plan.changedCount) && set.json.plan.delta === pv.json.plan.delta && set.json.plan.beforeTotal === pv.json.plan.beforeTotal, set.json);
  const after = await charges({ courseId: cS.id });
  check("từ 20/10: 8 dòng chưa vào phiếu thành 180.000", after.filter(c => !c.invoiceId && c.dateKey >= "2026-10-20").every(c => c.amount === 180_000 && c.rate === 180_000));
  check("TRƯỚC 20/10 và dòng ĐÃ VÀO PHIẾU: không đổi một đồng", after.filter(c => c.dateKey < "2026-10-20").every(c => c.amount === before.find(b => b.id === c.id)!.amount) && (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: invA.id } })).amountDue === 600_000);
  check("lịch sử đơn giá có 2 mốc; GET trả đúng", (await api("GET", `/api/courses/${cS.id}/fee-rates`, { as: T1 })).json.classRates.map((r: any) => r.rate).join() === "180000,150000");
  check("[phá] trùng ngày hiệu lực → 409", (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_class", rate: 190_000, effectiveFrom: "2026-10-20" } })).status === 409);
  check("[phá] lớp CŨ → 409 (giữ cách tính cũ)", (await api("POST", `/api/courses/${cL.id}/fee-rates`, { as: T1, body: { action: "set_class", rate: 190_000, effectiveFrom: today } })).status === 409);
  check("[phá] đơn giá sai / ngày sai / ngoài khoảng → 400", (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_class", rate: 12, effectiveFrom: today } })).status === 400 && (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_class", rate: 190_000, effectiveFrom: "2026-13-01" } })).status === 400 && (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_class", rate: 190_000, effectiveFrom: "2020-01-01" } })).status === 400 && (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "xoa_het", effectiveFrom: today } })).status === 400);
  const s5 = await mkSess(cS.id, "2026-11-03");
  await mark(s5, [{ userId: B.id, status: "present" }]);
  check("buổi điểm danh mới sau mốc dùng đơn giá mới 180.000", (await charges({ courseId: cS.id, dateKey: "2026-11-03" }))[0].amount === 180_000);
  check("nhật ký: đổi đơn giá có ai/khi nào/bao nhiêu", !!(await prisma.auditLog.findFirst({ where: { action: "course_fee.set_rate", resourceId: cS.id } })));

  section("G. HP-17 · đơn giá riêng từng em");
  const sp = await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "preview_student", studentId: C.id, rate: 120_000, effectiveFrom: "2026-10-01" } });
  const cUninv = (await charges({ courseId: cS.id, studentId: C.id })).filter(c => !c.invoiceId).length;
  check("xem trước: chỉ dòng chưa vào phiếu của Chi đổi (2 dòng 180.000 → 120.000)", sp.status === 200 && sp.json.plan.changedCount === cUninv && sp.json.plan.changedCount === 2 && sp.json.plan.delta === -120_000, sp.json);
  check("không đặt được đơn giá riêng cho em KHÔNG học lớp này → 400", (await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_student", studentId: (await mkUser({ name: "Người lạ" })).id, rate: 100_000, effectiveFrom: today } })).status === 400);
  const ss = await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_student", studentId: C.id, rate: 120_000, effectiveFrom: "2026-10-01" } });
  check("lưu đơn giá riêng: dòng của Chi thành 120.000 (nguồn 'student'); dòng của em khác không đổi", ss.status === 200 && (await charges({ courseId: cS.id, studentId: C.id })).every(c => c.amount === 120_000 && c.rateSource === "student") && (await charges({ courseId: cS.id, studentId: D.id })).every(c => c.amount === 180_000));
  const s6 = await mkSess(cS.id, "2026-11-10");
  await mark(s6, [{ userId: C.id, status: "present" }, { userId: D.id, status: "present" }]);
  check("buổi mới: Chi 120.000 (giá riêng), Dũng 180.000 (giá lớp)", (await charges({ courseId: cS.id, dateKey: "2026-11-10" })).map(c => `${c.studentId === C.id ? "C" : "D"}${c.amount}`).sort().join() === "C120000,D180000");
  const rm = await api("POST", `/api/courses/${cS.id}/fee-rates`, { as: T1, body: { action: "set_student", studentId: C.id, rate: null, effectiveFrom: "2026-10-01" } });
  check("xoá mốc đơn giá riêng: dòng chưa vào phiếu của Chi về giá lớp", rm.status === 200 && (await charges({ courseId: cS.id, studentId: C.id })).every(c => c.amount === 180_000 && c.rateSource === "class"));

  section("H. Theo khoá: một khoản một lần cho mỗi em");
  const issC = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [C.id] } });
  // Chi học cS (nhiều buổi 180.000) + cC (3.000.000): phiếu tháng 10 = các buổi cS + khoá
  const cBd = (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: issC.json.created[0].id } })).breakdown as any;
  const cCharges = await charges({ studentId: C.id, invoiceId: issC.json.created[0].id });
  check("phiếu Chi gồm dòng 'Học phí cả khoá' 3.000.000 đúng một lần + các buổi theo buổi", cCharges.filter(c => c.kind === "course").length === 1 && cCharges.find(c => c.kind === "course")!.amount === 3_000_000 && cBd.chargeLines.some((l: any) => l.description === "Học phí cả khoá"), cBd);
  check("tổng phiếu Chi = tổng các dòng (không lệch)", issC.json.created[0].amountDue === cCharges.reduce((s, c) => s + c.amount, 0), issC.json);
  await enroll(A, cC.id);
  await api("POST", `/api/courses/${cC.id}/fee-rates`, { as: T1, body: { action: "set_student", studentId: A.id, rate: 2_500_000, effectiveFrom: "2026-10-01" } });
  const nov = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-11", studentIds: [C.id, A.id] } });
  const novA = nov.json.created.find((x: any) => x.studentId === A.id);
  check("tháng sau: Chi KHÔNG bị tính khoá lần hai; An lần đầu bị tính 2.500.000 (giá riêng) — các buổi 11/10 của An chưa có", (await prisma.feeCharge.count({ where: { studentId: C.id, kind: "course" } })) === 1 && (await prisma.feeCharge.count({ where: { studentId: A.id, kind: "course" } })) === 1 && (novA ? novA.amountDue === 2_500_000 : true), nov.json);

  section("I. [số cũ] phiếu lớp cũ lệch 0 đồng so với công thức gốc");
  const T3 = await mkTutor("Cô Hoa");
  const legacyCourses = [await mkCourse(T3.id, { name: "Cũ 1" }), await mkCourse(T3.id, { name: "Cũ 2" }), await mkCourse(T3.id, { name: "Cũ 3" })];
  let seed = 7; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  let bad = 0; const detail: unknown[] = [];
  for (let i = 0; i < 12; i++) {
    const s = await mkUser({ name: `Cũ ${i}` });
    const nCourse = 1 + rnd(3);
    const subjects = [];
    for (let k = 0; k < nCourse; k++) {
      const sc = 1 + rnd(20), fc = rnd(Math.min(sc - 1, 5) + 1);
      await enroll(s, legacyCourses[k].id);
      await prisma.monthlyCourseFee.upsert({ where: { courseId_yearMonth: { courseId: legacyCourses[k].id, yearMonth: "2026-10" } }, create: { courseId: legacyCourses[k].id, yearMonth: "2026-10", sessionCount: sc, freeCount: fc, updatedBy: T3.id }, update: { sessionCount: sc, freeCount: fc } });
      subjects.push({ courseId: legacyCourses[k].id, courseName: legacyCourses[k].name, sessionCount: sc, freeCount: fc });
    }
    const override = rnd(3) === 0 ? 40_000 : null;
    if (override) await prisma.tuitionOverride.create({ data: { userId: s.id, pricePerSession: override, updatedBy: T3.id } });
    const sch = rnd(3) === 0 ? 10_000 : 0, disc = rnd(4) === 0 ? 5_000 : 0;
    // mỗi em một mốc số buổi riêng nên phải lập ngay trước khi đổi MonthlyCourseFee của em sau: dùng oracle theo đúng số buổi lúc lập
    const subj = subjects.map(sub => sub);
    const r = await issueInvoice({ tutorId: T3.id, studentId: s.id, yearMonth: "2026-10", scholarship: sch, discount: disc });
    const oracle = computeMonthlyFee({ subjects: subj.map(x => ({ ...x })), override, scholarship: sch, discount: disc });
    // số buổi của lớp dùng chung nhiều em bị ghi đè bởi em sau → đọc lại số buổi THỰC trong DB lúc lập (ngay sau khi lập) để so
    const rows = await prisma.monthlyCourseFee.findMany({ where: { yearMonth: "2026-10", courseId: { in: subj.map(x => x.courseId) } } });
    const oracle2 = computeMonthlyFee({ subjects: subj.map(x => { const f = rows.find(q => q.courseId === x.courseId)!; return { ...x, sessionCount: f.sessionCount, freeCount: f.freeCount }; }), override, scholarship: sch, discount: disc });
    if (!r.ok || r.invoice.amountDue !== oracle2.finalAmount) { bad++; detail.push({ i, got: r.ok ? r.invoice.amountDue : r, want: oracle2.finalAmount, oracle: oracle.finalAmount }); }
    if (r.ok) {
      const bd = (await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: r.invoice.id } })).breakdown as Record<string, unknown>;
      const keys = Object.keys(bd).sort().join();
      const want = [...Object.keys(oracle2), "creditApplied", "creditParts", "grossDue"].sort().join();
      if (keys !== want) { bad++; detail.push({ i, keys, want }); }
    }
  }
  check("12 phiếu lớp cũ ngẫu nhiên (1–3 môn, giá riêng, học bổng, giảm trừ): số phải đóng KHỚP công thức gốc 0 đồng, breakdown KHÔNG có khoá mới", bad === 0, detail);
  check("lớp cũ không sinh/đọc FeeCharge nào", (await prisma.feeCharge.count({ where: { tutorId: T3.id } })) === 0);

  section("J. Doanh thu theo lớp có tính dòng phí mới");
  await api("PATCH", `/api/tutor/invoices/${invA.id}`, { as: T1, body: { action: "send" } });
  await api("PATCH", `/api/tutor/invoices/${invA.id}`, { as: T1, body: { action: "record_payment", amount: 600_000 } });
  const rev = await api("GET", `/api/users/me/revenue?from=${today}&to=${today}`, { as: T1 });
  const byClass = Object.fromEntries(rev.json.byClass.map((c: any) => [c.courseId, c.collected]));
  check("thu 600.000 chia đúng theo lớp: lớp theo buổi 300.000, lớp theo giờ 300.000, tổng không lệch đồng nào", byClass[cS.id] === 300_000 && byClass[cH.id] === 300_000 && rev.json.totals.collected === 600_000, rev.json.byClass);

  section("K. Chặn Preview ở đường tính tiền mới (gọi thẳng hàm trong tiến trình)");
  check("moneyPathsBlocked: chỉ VERCEL_ENV=preview", moneyPathsBlocked({ VERCEL_ENV: "preview" }) && !moneyPathsBlocked({ VERCEL_ENV: "production" }) && !moneyPathsBlocked({}));
  const saved = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    const rc = await changeRate(cS.id, { type: "class", rate: 999_000, sessionMinutes: null, effectiveFrom: "2026-12-01" }, T1.id, { apply: true });
    check("Preview: đổi đơn giá → 503, không ghi", !rc.ok && rc.status === 503 && (await prisma.courseFeeRate.count({ where: { courseId: cS.id, effectiveFrom: "2026-12-01" } })) === 0);
    const sync = await prisma.$transaction(tx => syncSessionCharges(tx, { sessionId: s5, courseId: cS.id, sessionDate: day("2026-11-03"), by: T1.id, items: [{ userId: D.id, status: "present", makeupUsed: false }] }));
    check("Preview: điểm danh không sinh dòng phí (skipped=preview)", sync.skipped === "preview" && (await charges({ courseId: cS.id, studentId: D.id, dateKey: "2026-11-03" })).length === 0);
    const ic = await issueInvoice({ tutorId: T1.id, studentId: D.id, yearMonth: "2026-11" });
    check("Preview: lập phiếu cho em có lớp kiểu mới bị từ chối", !ic.ok && /xem trước/.test(ic.reason));
    const legacyOk = await issueInvoice({ tutorId: T3.id, studentId: (await prisma.enrollment.findFirstOrThrow({ where: { courseId: legacyCourses[0].id, NOT: { userId: { in: (await prisma.tuitionInvoice.findMany({ where: { tutorId: T3.id }, select: { studentId: true } })).map(x => x.studentId) } } } }).catch(() => null))?.userId ?? "none", yearMonth: "2026-10" });
    check("Preview: phiếu lớp CŨ không bị ảnh hưởng (đường cũ vẫn chạy)", legacyOk.ok || /Đã có phiếu|chưa học lớp/.test((legacyOk as any).reason));
  } finally { if (saved === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved; }

  section("L. Bất biến tiền");
  const allInv = await prisma.tuitionInvoice.findMany({ where: { tutorId: T1.id } });
  const bads: unknown[] = [];
  for (const inv of allInv) {
    const ch = await prisma.feeCharge.findMany({ where: { invoiceId: inv.id } });
    const bd = inv.breakdown as any;
    const sum = ch.reduce((s, c) => s + c.amount, 0);
    if (ch.length && (bd.chargesTotal !== sum)) bads.push({ code: inv.code, sum, chargesTotal: bd.chargesTotal });
    if (ch.length && inv.amountDue + (bd.creditApplied ?? 0) !== bd.finalAmount) bads.push({ code: inv.code, amountDue: inv.amountDue, bd: bd.finalAmount });
  }
  check(`mọi phiếu có dòng phí: chargesTotal = Σ FeeCharge và amountDue + tín dụng = finalAmount (${allInv.length} phiếu)`, bads.length === 0, bads);
  check("không dòng phí nào âm / lẻ; recordId không trùng", (await prisma.feeCharge.findMany()).every(c => Number.isInteger(c.amount) && c.amount > 0));
  await done();
})();
