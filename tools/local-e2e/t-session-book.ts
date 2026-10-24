// BU-01..BU-07, LI-02/03/10/11/16/17 — API thật: trang buổi học, ghi chép 3 phần, chốt / mở lại buổi, buổi lẻ-bù-phát sinh trên Lịch,
// Online/Offline + ba cách đặt link, kiểm xung đột, màu lớp, nhận xét riêng từng em chỉ cho đúng phụ huynh.
// TRỌNG TÂM TIỀN: chốt / mở lại buổi / ghi chép / thêm buổi KHÔNG sinh, sửa hay xoá dòng học phí nào và KHÔNG đổi phiếu (so khớp từng dòng, 0 lệch).
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-session-book.ts
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { issueInvoice } from "@/lib/invoiceServer";
import { api, check, done, mkTutor, mkUser, section, wipe } from "./h";

const day = (k: string) => new Date(`${k}T00:00:00Z`);
const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};
let seq = 0;
async function createCourse(as: any, extra: Record<string, unknown> = {}) {
  seq++;
  const id = `bu-${Date.now().toString(36)}-${seq}`;
  const r = await api("POST", "/api/courses", { as, body: { ...COURSE_BASE, id, name: `Lớp ${seq}`, adminName: `Lớp ${seq}`, shortTitle: `L${seq}`, ...extra } });
  if (r.status !== 201) throw new Error("tạo lớp lỗi " + JSON.stringify(r.json));
  return id;
}
const enroll = (u: { id: string }, courseId: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status: "active" } });
/** Ảnh chụp mọi thứ liên quan tiền: dòng phí, phiếu, số buổi tháng, đơn giá. Hai ảnh phải GIỐNG HỆT. */
const moneySnap = async () => JSON.stringify({
  charges: (await prisma.feeCharge.findMany({ orderBy: { id: "asc" } })).map(c => [c.id, c.studentId, c.courseId, c.dateKey, c.amount, c.rate, c.units, c.invoiceId, c.updatedAt.toISOString()]),
  invoices: (await prisma.tuitionInvoice.findMany({ orderBy: { id: "asc" } })).map(i => [i.id, i.studentId, i.yearMonth, i.amountDue, i.paidAmount, i.status, i.updatedAt.toISOString()]),
  monthly: (await prisma.monthlyCourseFee.findMany({ orderBy: { id: "asc" } })).map(m => [m.id, m.courseId, m.yearMonth, m.sessionCount, m.freeCount]),
  rates: (await prisma.courseFeeRate.findMany({ orderBy: { id: "asc" } })).map(r => [r.id, r.courseId, r.rate, r.effectiveFrom]),
});

(async () => {
  await wipe();
  const A = await mkTutor("Cô Lan"), B = await mkTutor("Thầy Minh");
  const S1 = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), S3 = await mkUser({ name: "Em Chi" });
  const today = vnDateKeyOf(new Date());
  const past = addDaysKey(today, -3), past2 = addDaysKey(today, -2), future = addDaysKey(today, 3);

  // Lớp theo buổi (tiền mới), lớp cũ (monthly_sessions), lớp của gia sư khác.
  const cS = await createCourse(A, { feeMode: "per_session", feeRate: 150_000, name: "Toán 9" });
  const cL = await createCourse(A, { name: "Lý cũ" });
  const cB = await createCourse(B, { name: "Văn của B" });
  for (const u of [S1, S2]) await enroll(u, cS);
  await enroll(S1, cL); await enroll(S3, cB);
  await prisma.monthlyCourseFee.create({ data: { courseId: cL, yearMonth: past.slice(0, 7), sessionCount: 8, updatedBy: A.id } });
  // Khung giờ tuần: Toán 9 vào đúng thứ của `past` (19:00–20:30); Lý cũ cùng thứ 20:00–21:00 (chồng giờ).
  const dow = dayOfWeekOfKey(past);
  const schS = await prisma.classSchedule.create({ data: { courseId: cS, dayOfWeek: dow, startTime: "19:00", endTime: "20:30" } });
  const schL = await prisma.classSchedule.create({ data: { courseId: cL, dayOfWeek: dow, startTime: "20:00", endTime: "21:00" } });
  const URL_ = (c: string, k: string) => `/api/courses/${c}/sessions/${k}`;

  section("Quyền (BU-01)");
  check("chưa đăng nhập → 401", (await api("GET", URL_(cS, past))).status === 401);
  check("học sinh → 403", (await api("GET", URL_(cS, past), { as: S1 })).status === 403 && (await api("PATCH", URL_(cS, past), { as: S1, body: { taught: "x" } })).status === 403);
  check("gia sư KHÁC → 403 (GET, PATCH, chốt), không lộ tên lớp", await (async () => {
    const g = await api("GET", URL_(cS, past), { as: B }), p = await api("PATCH", URL_(cS, past), { as: B, body: { taught: "x" } }), c = await api("POST", `${URL_(cS, past)}/close`, { as: B, body: { action: "close" } });
    return g.status === 403 && p.status === 403 && c.status === 403 && !g.text.includes("Toán 9");
  })());
  check("lớp không có → 404; ngày sai → 400", (await api("GET", URL_("khong-co", past), { as: A })).status === 404 && (await api("GET", URL_(cS, "2026-02-31"), { as: A })).status === 400 && (await api("GET", URL_(cS, "abc"), { as: A })).status === 400);
  check("sau mọi lần bị từ chối: chưa có bản ghi buổi nào", (await prisma.attendanceSession.count()) === 0);

  section("Chi tiết buổi suy từ lịch tuần, CHƯA có bản ghi (BU-01)");
  const g0 = await api("GET", URL_(cS, past), { as: A });
  check("mở được buổi chưa có bản ghi: scheduled, giờ 19:00–20:30, session null, 2 học sinh", g0.status === 200 && g0.json.scheduled === true && g0.json.session === null && g0.json.time.start === "19:00" && g0.json.time.end === "20:30" && g0.json.rosterCount === 2 && g0.json.kind === "regular", g0.json);
  check("chỉ xem KHÔNG tạo bản ghi nào", (await prisma.attendanceSession.count()) === 0);
  const g1 = await api("GET", URL_(cS, addDaysKey(past, 1)), { as: A });
  check("ngày không có trong lịch tuần: scheduled=false, vẫn mở được", g1.status === 200 && g1.json.scheduled === false && g1.json.time === null);

  section("Ghi chép 3 phần + hình thức (BU-04, LI-16)");
  const money0 = await moneySnap();
  const p1 = await api("PATCH", URL_(cS, past), { as: A, body: { taught: "  Hàm số bậc nhất ", homework: "Bài 1-5", summary: "Cả lớp theo kịp", mode: "offline", location: "Số 5 Ngõ 3" } });
  const sess = await prisma.attendanceSession.findUniqueOrThrow({ where: { courseId_date: { courseId: cS, date: day(past) } } });
  check("lưu 3 phần, cắt khoảng trắng; hình thức offline + địa chỉ", p1.status === 200 && sess.taught === "Hàm số bậc nhất" && sess.homework === "Bài 1-5" && sess.summary === "Cả lớp theo kịp" && sess.mode === "offline" && sess.location === "Số 5 Ngõ 3", p1.json);
  check("PATCH trả chi tiết mới: mode offline, địa chỉ", p1.json.mode === "offline" && p1.json.location === "Số 5 Ngõ 3" && p1.json.session.taught === "Hàm số bậc nhất");
  const p2 = await api("PATCH", URL_(cS, past), { as: A, body: { summary: "" } });
  check("gửi rỗng = xoá đúng phần đó, giữ phần khác", p2.status === 200 && p2.json.session.summary === null && p2.json.session.taught === "Hàm số bậc nhất");
  check("[phá] ghi chép quá 2000 ký tự / mode lạ / link javascript: / body rỗng → 400, không lưu", await (async () => {
    const rs = [await api("PATCH", URL_(cS, past), { as: A, body: { taught: "a".repeat(2001) } }), await api("PATCH", URL_(cS, past), { as: A, body: { mode: "hybrid" } }),
      await api("PATCH", URL_(cS, past), { as: A, body: { joinUrl: "javascript:alert(1)" } }), await api("PATCH", URL_(cS, past), { as: A, body: {} })];
    const s = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sess.id } });
    return rs.every(r => r.status === 400) && s.taught === "Hàm số bậc nhất" && s.mode === "offline";
  })());
  const log = await prisma.auditLog.findFirst({ where: { action: "attendance_session.notes" }, orderBy: { createdAt: "desc" } });
  check("nhật ký chỉ ghi TÊN trường đã đổi, KHÔNG có nội dung ghi chép / địa chỉ", !!log && !JSON.stringify(log).includes("Hàm số") && !JSON.stringify(log).includes("Ngõ 3") && JSON.stringify(log.metadata).includes("fields"), log?.metadata);
  check("ghi chép KHÔNG sinh dòng phí hay đổi phiếu (0 lệch)", (await moneySnap()) === money0);

  section("Link online: riêng buổi > khung giờ > chung lớp (LI-17)");
  const joinOf = async (c: string, k: string) => (await api("GET", URL_(c, k), { as: A })).json.join;
  await prisma.classSchedule.update({ where: { id: schS.id }, data: { joinUrl: null } });
  await prisma.attendanceSession.update({ where: { id: sess.id }, data: { joinUrl: null } });
  check("chưa đặt link nào → null", (await joinOf(cS, past)) === null);
  const cal = await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { classJoinUrl: "https://meet.example/chung-lop" } });
  check("đặt link chung lớp → dùng link chung (nguồn 'class')", cal.status === 200 && (await joinOf(cS, past))?.source === "class" && (await joinOf(cS, past))?.url === "https://meet.example/chung-lop");
  await prisma.classSchedule.update({ where: { id: schS.id }, data: { joinUrl: "https://meet.example/khung-gio" } });
  check("thêm link khung giờ → thắng link chung (nguồn 'schedule')", (await joinOf(cS, past))?.source === "schedule");
  await api("PATCH", URL_(cS, past), { as: A, body: { joinUrl: "https://meet.example/rieng-buoi" } });
  check("thêm link riêng buổi → thắng cả hai (nguồn 'session')", (await joinOf(cS, past))?.source === "session" && (await joinOf(cS, past))?.url === "https://meet.example/rieng-buoi");
  await api("PATCH", URL_(cS, past), { as: A, body: { joinUrl: null } });
  check("xoá link riêng buổi → quay về khung giờ", (await joinOf(cS, past))?.source === "schedule");
  check("[phá] link chung không phải http(s) → 400; lớp người khác → 403", (await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { classJoinUrl: "ftp://x" } })).status === 400 && (await api("PATCH", `/api/courses/${cS}/calendar`, { as: B, body: { classJoinUrl: "https://a.b" } })).status === 403);

  section("Màu lớp từ bảng 25 màu token (LI-02)");
  check("chọn màu 'lop-07' → lưu", (await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { calendarColor: "lop-07" } })).status === 200 && (await prisma.course.findUniqueOrThrow({ where: { id: cS } })).calendarColor === "lop-07");
  check("[phá] mã hex / ngoài bảng ('lop-26', '#ff0000', 'red') → 400, giữ màu cũ", await (async () => {
    const rs = [await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { calendarColor: "lop-26" } }), await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { calendarColor: "#ff0000" } }), await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { calendarColor: "red" } })];
    return rs.every(r => r.status === 400) && (await prisma.course.findUniqueOrThrow({ where: { id: cS } })).calendarColor === "lop-07";
  })());
  check("GET trả màu và link chung; body rỗng → 400", await (async () => { const g = await api("GET", `/api/courses/${cS}/calendar`, { as: A }); return g.status === 200 && g.json.calendarColor === "lop-07" && (await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: {} })).status === 400; })());
  const sch = await api("GET", `/api/tutor/schedule?from=${past}&to=${past}`, { as: A });
  const oS = sch.json.occurrences.find((o: any) => o.courseId === cS);
  check("Lịch trả màu đã chọn, hình thức offline + địa chỉ, link hiệu lực của khung giờ, buổi chưa chốt", sch.status === 200 && oS.color === "lop-07" && oS.mode === "offline" && oS.location === "Số 5 Ngõ 3" && oS.joinSource === "schedule" && oS.sessionState === "open" && oS.hasSession === true && oS.kind === "regular", oS);
  await api("PATCH", `/api/courses/${cS}/calendar`, { as: A, body: { calendarColor: null } });
  check("bỏ chọn (null) → về màu tự động", (await prisma.course.findUniqueOrThrow({ where: { id: cS } })).calendarColor === null);

  section("TIỀN: chốt buổi KHÔNG sinh dòng phí (BU-02)");
  // Buổi của lớp theo-buổi có điểm danh GHI THẲNG vào DB (không qua PUT) → nếu nút chốt tự sinh phí thì sẽ có FeeCharge.
  const sRec = await prisma.attendanceSession.create({ data: { courseId: cS, date: day(past2), createdBy: A.id } });
  await prisma.attendanceRecord.createMany({ data: [{ sessionId: sRec.id, userId: S1.id, status: "present" }, { sessionId: sRec.id, userId: S2.id, status: "late" }] });
  const chargesBefore = await prisma.feeCharge.count();
  const cl1 = await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "close" } });
  const afterClose = await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sRec.id } });
  check("chốt → state 'closed', có closedAt và người chốt", cl1.status === 200 && afterClose.state === "closed" && !!afterClose.closedAt && afterClose.closedBy === A.id && cl1.json.detail.session.state === "closed" && cl1.json.already === false, cl1.json);
  check("CHỐT KHÔNG TẠO dòng phí nào dù lớp tính theo buổi và đã có 2 em có mặt/muộn", (await prisma.feeCharge.count()) === chargesBefore && chargesBefore === 0);
  const t1 = afterClose.closedAt!.getTime();
  const cl2 = await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "close" } });
  check("chốt lần hai: bỏ qua, GIỮ thời điểm chốt cũ", cl2.status === 200 && cl2.json.already === true && (await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sRec.id } })).closedAt!.getTime() === t1);
  const futClose = await api("POST", `${URL_(cS, future)}/close`, { as: A, body: { action: "close" } });
  check("[phá] chốt buổi CHƯA TỚI NGÀY → 400 và KHÔNG để lại bản ghi trống", futClose.status === 400 && futClose.json.error.includes("chưa tới ngày") && (await prisma.attendanceSession.count({ where: { date: day(future) } })) === 0);
  check("[phá] action lạ / thiếu → 400", (await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "xoa-het" } })).status === 400 && (await api("POST", `${URL_(cS, past2)}/close`, { as: A })).status === 400);
  const closeNoRec = await api("POST", `${URL_(cL, past)}/close`, { as: A, body: { action: "close" } });
  check("chốt buổi chưa có bản ghi (lớp cũ) → tạo bản ghi + chốt, vẫn không tiền", closeNoRec.status === 200 && (await prisma.feeCharge.count()) === 0);
  check("lưu điểm danh (đường sẵn có) VẪN sinh phí như trước — nút chốt không thay đổi đường đó", await (async () => {
    const s = await prisma.attendanceSession.create({ data: { courseId: cS, date: day(addDaysKey(today, -5)), createdBy: A.id } });
    const r = await api("PUT", `/api/attendance-sessions/${s.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "absent" }] } });
    const cs = await prisma.feeCharge.findMany({ where: { courseId: cS } });
    return r.status === 200 && cs.length === 1 && cs[0].studentId === S1.id && cs[0].amount === 150_000;
  })());

  section("TIỀN: mở lại buổi đã chốt, cảnh báo khi phiếu tháng đã lập, KHÔNG tự sửa phiếu (BU-03)");
  const ym = past2.slice(0, 7);
  // Điểm danh thật qua đường cũ cho buổi past2 để có dòng phí, rồi lập phiếu cho S1.
  await api("PUT", `/api/attendance-sessions/${sRec.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "present" }] } });
  const reopenNoInvoice = await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "reopen" } });
  check("chưa có phiếu nào của tháng này → mở lại thẳng được (200), state 'open', có reopenedAt", reopenNoInvoice.status === 200 && reopenNoInvoice.json.detail.session.state === "open" && !!reopenNoInvoice.json.detail.session.reopenedAt && (await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sRec.id } })).closedAt === null);
  check("mở lại buổi CHƯA chốt → 409", (await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "reopen" } })).status === 409);
  await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "close" } });
  const inv = await issueInvoice({ tutorId: A.id, studentId: S1.id, yearMonth: ym });
  check("(chuẩn bị) lập phiếu tháng cho em An thành công và gắn dòng phí vào phiếu", inv.ok === true && (await prisma.feeCharge.count({ where: { studentId: S1.id, invoiceId: { not: null } } })) >= 1, inv);
  const moneyBefore = await moneySnap();
  const warn = await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "reopen" } });
  check("phiếu tháng đã lập → 409 needsConfirm + cảnh báo nêu 'KHÔNG tự sửa'; buổi VẪN chốt", warn.status === 409 && warn.json.needsConfirm === true && warn.json.warning.includes("KHÔNG tự sửa") && warn.json.warning.includes(`${ym.slice(5, 7)}/${ym.slice(0, 4)}`) && (warn.json.invoicedCharges >= 1 || warn.json.invoices >= 1) && (await prisma.attendanceSession.findUniqueOrThrow({ where: { id: sRec.id } })).state === "closed", warn.json);
  const confirmed = await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "reopen", confirm: true } });
  check("xác nhận → mở lại được", confirmed.status === 200 && confirmed.json.detail.session.state === "open");
  check("TIỀN: mở lại (kể cả khi phiếu đã lập) KHÔNG đổi dòng phí, phiếu, số buổi tháng, đơn giá — 0 lệch", (await moneySnap()) === moneyBefore);
  await api("POST", `${URL_(cS, past2)}/close`, { as: A, body: { action: "close" } });
  await api("PATCH", URL_(cS, past2), { as: A, body: { taught: "Ôn tập" } });
  check("chốt lại + ghi chép sau đó: tiền vẫn 0 lệch", (await moneySnap()) === moneyBefore);
  const audit = await prisma.auditLog.findMany({ where: { action: { in: ["attendance_session.close", "attendance_session.reopen"] } } });
  check("nhật ký chốt/mở lại có, KHÔNG chứa tên em hay nội dung", audit.length >= 3 && audit.every(a => !JSON.stringify(a).includes("Em An") && !JSON.stringify(a).includes("Ôn tập")));

  section("Thêm buổi nhanh: buổi lẻ / dạy bù / phát sinh trên Lịch (LI-11, LI-10)");
  const moneyX = await moneySnap();
  const extraDay = addDaysKey(today, 5);
  const ex1 = await api("POST", `/api/courses/${cS}/sessions`, { as: A, body: { dateKey: extraDay, startTime: "9:00", endTime: "10:30", kind: "makeup", mode: "online", joinUrl: "https://meet.example/bu" } });
  const exRow = await prisma.attendanceSession.findFirst({ where: { courseId: cS, date: day(extraDay) } });
  check("tạo buổi dạy bù: 201, kind 'makeup', giờ 09:00–10:30, online + link riêng", ex1.status === 201 && exRow?.kind === "makeup" && exRow.startTime === "09:00" && exRow.endTime === "10:30" && exRow.mode === "online" && exRow.joinUrl === "https://meet.example/bu", ex1.json);
  const sch2 = await api("GET", `/api/tutor/schedule?from=${extraDay}&to=${extraDay}`, { as: A });
  const oX = sch2.json.occurrences.find((o: any) => o.kind === "makeup");
  check("buổi bù HIỆN trên Lịch: giờ, online, link riêng buổi, đủ 2 em, không có nhắc/báo nghỉ", !!oX && oX.courseId === cS && oX.mode === "online" && oX.joinSource === "session" && oX.students.length === 2 && oX.pendingAbsences === 0 && oX.remindersDue === 0 && oX.scheduleId.startsWith("extra:"), oX);
  check("thêm buổi KHÔNG đụng tiền (0 lệch, không dòng phí mới)", (await moneySnap()) === moneyX);
  const exDup = await api("POST", `/api/courses/${cS}/sessions`, { as: A, body: { dateKey: extraDay, startTime: "14:00", endTime: "15:00", kind: "extra" } });
  check("cùng lớp, cùng ngày đã có bản ghi → 409 nói rõ, không ghi đè", exDup.status === 409 && exDup.json.error.includes("đã có bản ghi") && (await prisma.attendanceSession.findFirstOrThrow({ where: { courseId: cS, date: day(extraDay) } })).kind === "makeup");
  // Xung đột: Lý cũ có khung 20:00–21:00 vào thứ của `past`; thêm buổi lẻ Toán 9 vào đúng thứ đó ở tương lai, 20:30–21:30 → chồng.
  let confDay = addDaysKey(today, 1); while (dayOfWeekOfKey(confDay) !== dow) confDay = addDaysKey(confDay, 1);
  const exC = await api("POST", `/api/courses/${cS}/sessions`, { as: A, body: { dateKey: confDay, startTime: "20:30", endTime: "21:30", kind: "extra" } });
  check("xung đột lịch → 409 needsConfirm, nêu lớp trùng + giờ; CHƯA ghi gì", exC.status === 409 && exC.json.needsConfirm === true && exC.json.conflicts.some((c: any) => c.kind === "gia-su" && c.text.includes("Lý cũ")) && (await prisma.attendanceSession.count({ where: { courseId: cS, date: day(confDay) } })) === 0, exC.json);
  check("xung đột 'hoc-sinh': em An học cả hai lớp → có dòng kèm SỐ em (1), KHÔNG có tên/ id em", exC.json.conflicts.some((c: any) => c.kind === "hoc-sinh" && c.sharedStudents === 1) && !exC.text.includes("Em An") && !exC.text.includes(S1.id));
  const exF = await api("POST", `/api/courses/${cS}/sessions`, { as: A, body: { dateKey: confDay, startTime: "20:30", endTime: "21:30", kind: "extra", force: true } });
  check("chọn 'vẫn thêm' (force) → 201", exF.status === 201);
  check("[phá] giờ ngược / kind 'regular' / ngày quá 1 năm / thiếu giờ → 400", await (async () => {
    const mk = (b: object) => api("POST", `/api/courses/${cS}/sessions`, { as: A, body: { dateKey: addDaysKey(today, 9), startTime: "09:00", endTime: "10:00", kind: "extra", ...b } });
    return (await mk({ endTime: "08:00" })).status === 400 && (await mk({ kind: "regular" })).status === 400 && (await mk({ dateKey: addDaysKey(today, 400) })).status === 400 && (await mk({ startTime: undefined })).status === 400;
  })());
  check("[phá] gia sư khác thêm buổi vào lớp này → 403; học sinh → 403", (await api("POST", `/api/courses/${cS}/sessions`, { as: B, body: { dateKey: addDaysKey(today, 9), startTime: "09:00", endTime: "10:00", kind: "extra" } })).status === 403 && (await api("POST", `/api/courses/${cS}/sessions`, { as: S1, body: { dateKey: addDaysKey(today, 9), startTime: "09:00", endTime: "10:00", kind: "extra" } })).status === 403);
  check("buổi lẻ KHÔNG thành 'buổi đã dạy' khi chưa có em có mặt (định nghĩa ĐX-00 không đổi)", (await prisma.attendanceSession.count({ where: { id: exRow!.id, records: { some: { status: { in: ["present", "late"] } } } } })) === 0);

  section("Kiểm xung đột khi lưu khung giờ / dời buổi (LI-10)");
  const sc = (c: string, b: object) => api("POST", `/api/courses/${c}/class-schedules`, { as: A, body: b });
  const c409 = await sc(cS, { dayOfWeek: dow, startTime: "20:30", endTime: "21:30", checkConflicts: true });
  check("khung giờ mới chồng khung Lý cũ + em chung → 409 kèm danh sách; CHƯA ghi", c409.status === 409 && c409.json.needsConfirm && c409.json.conflicts.length >= 2 && (await prisma.classSchedule.count({ where: { courseId: cS, startTime: "20:30" } })) === 0, c409.json);
  check("gọi KHÔNG xin kiểm (cách cũ) → vẫn lưu như trước (tương thích ngược)", (await sc(cS, { dayOfWeek: dow, startTime: "20:30", endTime: "21:30" })).status === 201);
  check("có xin kiểm nhưng chọn 'vẫn lưu' (force) → 201, kèm hình thức offline + địa chỉ (LI-16)", await (async () => {
    const r = await sc(cS, { dayOfWeek: (dow + 1) % 7, startTime: "20:30", endTime: "21:30", checkConflicts: true, force: true, mode: "offline", location: "Nhà em A" });
    return r.status === 201 && r.json.mode === "offline" && r.json.location === "Nhà em A";
  })());
  check("khung giờ KHÔNG trùng → 201 thẳng dù có xin kiểm", (await sc(cS, { dayOfWeek: (dow + 2) % 7, startTime: "06:00", endTime: "07:00", checkConflicts: true })).status === 201);
  check("[phá] hình thức lạ khi tạo khung giờ → 400", (await sc(cS, { dayOfWeek: (dow + 3) % 7, startTime: "06:00", endTime: "07:00", mode: "tai-nha" })).status === 400);
  const put1 = await api("PUT", `/api/class-schedules/${schL.id}`, { as: A, body: { startTime: "19:30", endTime: "20:15", checkConflicts: true } });
  check("sửa khung giờ chồng khung khác → 409; không xin kiểm → sửa được", put1.status === 409 && put1.json.needsConfirm === true && (await api("PUT", `/api/class-schedules/${schL.id}`, { as: A, body: { startTime: "19:30", endTime: "20:15" } })).status === 200);
  const put2 = await api("PUT", `/api/class-schedules/${schL.id}`, { as: A, body: { mode: "online", location: null } });
  check("PUT đổi hình thức khung giờ; sai → 400", put2.status === 200 && put2.json.mode === "online" && (await api("PUT", `/api/class-schedules/${schL.id}`, { as: A, body: { mode: "x" } })).status === 400);
  const cf = await api("POST", `/api/courses/${cS}/schedule-conflicts`, { as: A, body: { dateKey: confDay, startTime: "20:30", endTime: "21:30" } });
  check("API kiểm xung đột (chỉ đọc) trả danh sách; lớp người khác → 403; thiếu dateKey/dayOfWeek → 400", cf.status === 200 && cf.json.conflicts.length >= 1 && (await api("POST", `/api/courses/${cS}/schedule-conflicts`, { as: B, body: { dateKey: confDay, startTime: "20:30", endTime: "21:30" } })).status === 403 && (await api("POST", `/api/courses/${cS}/schedule-conflicts`, { as: A, body: { startTime: "20:30", endTime: "21:30" } })).status === 400);
  // Dời buổi: tạo một buổi lẻ Toán 9 (21:00–22:00) ở một ngày KHÁC thứ của khung Lý cũ, rồi dời một buổi Lý cũ tới đúng ngày đó lúc 21:30 → chồng.
  let mvDay = addDaysKey(today, 30); while (dayOfWeekOfKey(mvDay) === dow) mvDay = addDaysKey(mvDay, 1);
  await api("POST", `/api/courses/${cS}/sessions`, { as: A, body: { dateKey: mvDay, startTime: "21:00", endTime: "22:00", kind: "extra", force: true } });
  const mv = await api("POST", "/api/tutor/session-changes", { as: A, body: { scheduleId: schS.id, dateKey: addDaysKey(confDay, 7), kind: "move", newDateKey: addDaysKey(confDay, 8), newStartTime: "09:00", newEndTime: "10:00" } });
  check("dời buổi không trùng (cách cũ, không xin kiểm) vẫn dời được", mv.status === 200);
  const origDay = addDaysKey(confDay, 14);
  const mvC = await api("POST", "/api/tutor/session-changes", { as: A, body: { scheduleId: schL.id, dateKey: origDay, kind: "move", newDateKey: mvDay, newStartTime: "21:30", newEndTime: "22:30", checkConflicts: true } });
  check("dời buổi sang giờ trùng buổi lẻ, có xin kiểm → 409 kèm danh sách; chưa ghi thay đổi", mvC.status === 409 && mvC.json.needsConfirm && mvC.json.conflicts.length >= 1 && (await prisma.classSessionChange.count({ where: { scheduleId: schL.id, dateKey: origDay } })) === 0, mvC.json);
  check("chọn 'vẫn dời' (force) → 200 và buổi được dời", (await api("POST", "/api/tutor/session-changes", { as: A, body: { scheduleId: schL.id, dateKey: origDay, kind: "move", newDateKey: mvDay, newStartTime: "21:30", newEndTime: "22:30", checkConflicts: true, force: true } })).status === 200 && (await prisma.classSessionChange.count({ where: { scheduleId: schL.id, dateKey: origDay, kind: "move" } })) === 1);
  check("dời sang giờ TRỐNG có xin kiểm → 200 thẳng (không báo xung đột oan)", (await api("POST", "/api/tutor/session-changes", { as: A, body: { scheduleId: schL.id, dateKey: addDaysKey(origDay, 7), kind: "move", newDateKey: addDaysKey(mvDay, 1) === addDaysKey(origDay, 7) ? addDaysKey(mvDay, 2) : addDaysKey(mvDay, 1), newStartTime: "05:00", newEndTime: "05:30", checkConflicts: true } })).status === 200);

  section("Bộ lọc lịch lưu ở tài khoản (LI-03)");
  const pf = await api("PUT", "/api/users/me/preferences", { as: A, body: { calendar: { hideCancelled: true, courseId: cS } } });
  check("lưu 'ẩn buổi huỷ' + lớp đang lọc", pf.status === 200 && pf.json.preferences.calendar.hideCancelled === true && pf.json.preferences.calendar.courseId === cS);
  check("đọc lại đúng", (await api("GET", "/api/users/me/preferences", { as: A })).json.preferences.calendar.hideCancelled === true);
  check("[phá] khoá lạ / sai kiểu → 400, giữ nguyên", (await api("PUT", "/api/users/me/preferences", { as: A, body: { calendar: { hideCancelled: "yes" } } })).status === 400 && (await api("PUT", "/api/users/me/preferences", { as: A, body: { calendar: { sapXep: 1 } } })).status === 400 && (await api("GET", "/api/users/me/preferences", { as: A })).json.preferences.calendar.hideCancelled === true);
  check("cài đặt khác (module, chủ đề) KHÔNG bị mất khi đổi lịch", (await api("PUT", "/api/users/me/preferences", { as: A, body: { mode: "toi" } })).json.preferences.calendar?.hideCancelled === true);
  await api("PUT", "/api/users/me/preferences", { as: A, body: { calendar: null } });
  check("calendar: null → về mặc định (hiện cả buổi huỷ)", (await api("GET", "/api/users/me/preferences", { as: A })).json.preferences.calendar === undefined);

  section("Nhận xét riêng từng em: chỉ gia sư chủ lớp và phụ huynh ĐÚNG em đó (BU-07)");
  const P1 = await mkUser({ name: "Phụ huynh An" }), P2 = await mkUser({ name: "Phụ huynh Bình" });
  const mkToken = async (parent: { id: string }, student: { id: string }) => {
    const token = randomBytes(16).toString("hex");
    await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id, status: "verified", verifiedAt: new Date(), portalToken: token } });
    return token;
  };
  const tok1 = await mkToken(P1, S1), tok2 = await mkToken(P2, S2);
  const sNote = await prisma.attendanceSession.create({ data: { courseId: cS, date: day(addDaysKey(today, -1)), createdBy: A.id } });
  const NOTE_AN = "An làm đúng dạng cơ bản, cần luyện thêm phần Vi-et";
  const putN = await api("PUT", `/api/attendance-sessions/${sNote.id}`, { as: A, body: { records: [
    { userId: S1.id, status: "present", note: NOTE_AN, parentVisible: true },
    { userId: S2.id, status: "present", note: "Bình hay mất tập trung, riêng gia sư xem", parentVisible: false },
  ] } });
  check("lưu nhận xét + cờ chia sẻ cho từng em", putN.status === 200);
  const gN = await api("GET", `/api/attendance-sessions/${sNote.id}`, { as: A });
  const rA = gN.json.roster.find((r: any) => r.userId === S1.id), rB = gN.json.roster.find((r: any) => r.userId === S2.id);
  check("gia sư thấy cả hai nhận xét + cờ đúng (An: chia sẻ, Bình: không)", rA.note === NOTE_AN && rA.parentVisible === true && rB.parentVisible === false && rB.note.includes("riêng gia sư"));
  const pj1 = await api("GET", `/api/parent-portal/${tok1}`), pj2 = await api("GET", `/api/parent-portal/${tok2}`);
  check("API: phụ huynh An thấy ĐÚNG nhận xét của An", pj1.status === 200 && pj1.json.notes.length === 1 && pj1.json.notes[0].note === NOTE_AN && pj1.json.notes[0].courseName === "Toán 9", pj1.json.notes);
  check("API: phụ huynh Bình (nhận xét CHƯA chia sẻ) → không có nhận xét; cũng KHÔNG thấy nhận xét của An", pj2.json.notes.length === 0 && !JSON.stringify(pj2.json).includes("Vi-et") && !JSON.stringify(pj1.json).includes("mất tập trung"));
  const clean = (h: string) => h.replace(/<!-- -->/g, "");
  const pg1 = clean((await api("GET", `/so-cua-con/${tok1}`)).text), pg2 = clean((await api("GET", `/so-cua-con/${tok2}`)).text);
  check("Trang Sổ của con: phụ huynh An có mục 'Nhận xét của gia sư' + đúng chữ; phụ huynh Bình không có mục này và không thấy chữ của An", pg1.includes("Nhận xét của gia sư") && pg1.includes("Vi-et") && !pg2.includes("Nhận xét của gia sư") && !pg2.includes("Vi-et") && !pg1.includes("mất tập trung"));
  check("học sinh KHÔNG có đường đọc: GET điểm danh → 403, API tài khoản của em không chứa nhận xét", (await api("GET", `/api/attendance-sessions/${sNote.id}`, { as: S1 })).status === 403 && !(await api("GET", "/api/users/me/attendance", { as: S1 })).text.includes("Vi-et"));
  check("gia sư KHÁC không đọc/ghi được nhận xét → 403", (await api("GET", `/api/attendance-sessions/${sNote.id}`, { as: B })).status === 403 && (await api("PUT", `/api/attendance-sessions/${sNote.id}`, { as: B, body: { records: [{ userId: S1.id, status: "present", note: "x", parentVisible: true }] } })).status === 403);
  check("[phá] parentVisible không phải đúng-sai → 400, không lưu", (await api("PUT", `/api/attendance-sessions/${sNote.id}`, { as: A, body: { records: [{ userId: S2.id, status: "present", note: "y", parentVisible: "co" }] } })).status === 400 && (await prisma.attendanceRecord.findFirstOrThrow({ where: { sessionId: sNote.id, userId: S2.id } })).parentVisible === false);
  const logN = await prisma.auditLog.findFirst({ where: { action: "attendance_session.update" }, orderBy: { createdAt: "desc" } });
  check("nhật ký điểm danh không chứa nhận xét hay tên em", !!logN && !JSON.stringify(logN).includes("Vi-et") && !JSON.stringify(logN).includes("Em An"));
  check("lưu điểm danh KHÔNG gửi lại cờ → cờ cũ giữ nguyên (không tự tắt chia sẻ)", await (async () => {
    await api("PUT", `/api/attendance-sessions/${sNote.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present", note: NOTE_AN }] } });
    return (await prisma.attendanceRecord.findFirstOrThrow({ where: { sessionId: sNote.id, userId: S1.id } })).parentVisible === true;
  })());

  section("Đồng ý theo hồ sơ: thu hồi → ẩn ngay; thiếu đồng ý → không chia sẻ được");
  const mkProfile = async (u: { id: string; name: string }, scopes: string[]) => {
    const r = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: u.name, ageGroup: "16plus", userId: u.id, consent: { self: true, scopes } } });
    if (r.status !== 201) throw new Error("tạo hồ sơ lỗi " + JSON.stringify(r.json));
    return r.json.id as string;
  };
  const prA = await mkProfile(S1, ["basic"]);
  check("em có hồ sơ + đồng ý 'basic' còn hiệu lực → phụ huynh vẫn thấy", (await api("GET", `/api/parent-portal/${tok1}`)).json.notes.length === 1);
  const rv = await api("POST", `/api/tutor/ho-so/${prA}/thu-hoi`, { as: A, body: { party: "self" } });
  check("thu hồi đồng ý của em An", rv.status === 200);
  check("phụ huynh An KHÔNG còn thấy nhận xét (API và trang) ngay sau khi thu hồi", (await api("GET", `/api/parent-portal/${tok1}`)).json.notes.length === 0 && !clean((await api("GET", `/so-cua-con/${tok1}`)).text).includes("Vi-et"));
  const blocked = await api("PUT", `/api/attendance-sessions/${sNote.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present", note: "mới", parentVisible: true }] } });
  check("chia sẻ nhận xét mới cho em đã thu hồi đồng ý → 422 needsConsent, không lưu dở", blocked.status === 422 && blocked.json.needsConsent === true && blocked.json.blocked.join() === S1.id && (await prisma.attendanceRecord.findFirstOrThrow({ where: { sessionId: sNote.id, userId: S1.id } })).note === NOTE_AN);
  await api("POST", `/api/tutor/ho-so/${prA}/dong-y`, { as: A, body: { self: true, scopes: ["basic"] } });
  check("đồng ý lại → phụ huynh lại thấy", (await api("GET", `/api/parent-portal/${tok1}`)).json.notes.length === 1);
  const future2 = await prisma.attendanceSession.create({ data: { courseId: cS, date: day(addDaysKey(today, 45)), createdBy: A.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: future2.id, userId: S1.id, status: "present", note: "Nhận xét của buổi tương lai", parentVisible: true } });
  check("nhận xét của buổi CHƯA TỚI ngày không hiện cho phụ huynh", !JSON.stringify((await api("GET", `/api/parent-portal/${tok1}`)).json.notes).includes("tương lai"));

  await done();
})();
