// GET /api/invites/by-code/<mã>: phần xem trước theo Figma 32:54 — lịch, số buổi đã học, học phí theo bậc thang. Chỉ đọc, đúng người.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, section, done } from "./h";

const DAY = 86_400_000;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S = await mkUser({ name: "Em Học" }), NEW = await mkUser({ name: "Em Mới" });
  const toan = await mkCourse(T.id, { name: "Toán 9" });
  const su = await mkCourse(T.id, { name: "Sử 9" }), dia = await mkCourse(T.id, { name: "Địa 9" });
  const khac = await mkCourse(T2.id, { name: "Lý 9 (thầy khác)" });
  const trung = await mkCourse(null, { name: "Lớp của trung tâm" });
  for (const c of [su, dia, khac]) await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active" } });

  // Toán 9: Thứ 3 & Thứ 5 19:30–21:30 (+ một khung đã tắt phải bị bỏ qua); 2 buổi đã học, 1 buổi ở tương lai
  await prisma.classSchedule.createMany({ data: [
    { courseId: toan.id, dayOfWeek: 2, startTime: "19:30", endTime: "21:30" },
    { courseId: toan.id, dayOfWeek: 4, startTime: "19:30", endTime: "21:30" },
    { courseId: toan.id, dayOfWeek: 6, startTime: "08:00", endTime: "10:00", active: false },
  ] });
  for (const d of [20, 13]) await mkAttendanceSession(toan.id, T.id, new Date(Date.now() - d * DAY));
  await mkAttendanceSession(toan.id, T.id, new Date(Date.now() + 5 * DAY)); // có em có mặt nhưng ở tương lai → không tính
  // ĐX-00: phiên đã qua nhưng rỗng / chỉ có "có phép" cũng không tính là đã học
  await mkAttendanceSession(toan.id, T.id, new Date(Date.now() - 6 * DAY), []);
  await mkAttendanceSession(toan.id, T.id, new Date(Date.now() - 3 * DAY), ["excused"]);

  const mk = async (courseId: string, as = T) => (await api("POST", `/api/courses/${courseId}/invites`, { as, body: { maxUses: 5 } })).json.code as string;
  const cToan = await mk(toan.id), cTrung = await (async () => { const inv = await prisma.classInvite.create({ data: { courseId: trung.id, code: "TRUNG2345", createdBy: T.id } }); return inv.code; })();
  const pv = (code: string, as: any) => api("GET", `/api/invites/by-code/${code}`, { as });

  section("Cần đăng nhập");
  check("không cookie → 401", (await pv(cToan, undefined)).status === 401);

  section("Em đang học 2 môn khác của cùng gia sư (+ 1 môn của gia sư khác không tính)");
  let r = await pv(cToan, S);
  check("200, status ok, tên lớp + gia sư", r.status === 200 && r.json.status === "ok" && r.json.course.name === "Toán 9" && r.json.course.owner.name === "Cô Lan", r.json);
  check("lịch: chỉ 2 khung đang bật (Thứ 3, Thứ 5), khung đã tắt bị bỏ", r.json.schedule.length === 2 && r.json.schedule.every((s: any) => s.startTime === "19:30" && s.endTime === "21:30") && r.json.schedule.map((s: any) => s.dayOfWeek).sort().join() === "2,4", r.json.schedule);
  check("đã học: chỉ đếm buổi đã qua có em có mặt (2); buổi tương lai, phiên rỗng, phiên chỉ có phép không tính", r.json.taught === 2, r.json.taught);
  check("học phí: 3 môn (2 môn cũ của cô Lan + môn này) → 55.000đ, không đếm môn của thầy khác", r.json.tuition?.subjectCount === 3 && r.json.tuition?.pricePerSession === 55_000 && r.json.tuition?.override === false, r.json.tuition);
  check("vẫn giữ các trường cũ (alreadyEnrolled=false, maxUses, usedCount)", r.json.alreadyEnrolled === false && r.json.maxUses === 5 && r.json.usedCount === 0);

  section("Em mới hoàn toàn → 1 môn");
  r = await pv(cToan, NEW);
  check("1 môn → 70.000đ", r.json.tuition?.subjectCount === 1 && r.json.tuition?.pricePerSession === 70_000, r.json.tuition);

  section("Em có mức học phí riêng");
  await prisma.tuitionOverride.create({ data: { userId: NEW.id, pricePerSession: 40_000, updatedBy: T.id } });
  r = await pv(cToan, NEW);
  check("mức riêng 40.000đ, ghi override=true, bỏ bậc thang", r.json.tuition?.pricePerSession === 40_000 && r.json.tuition?.override === true, r.json.tuition);
  check("mức riêng của em này không lộ sang em khác", (await pv(cToan, S)).json.tuition?.pricePerSession === 55_000);

  section("Lớp không có gia sư phụ trách (của trung tâm)");
  r = await pv(cTrung, S);
  check("tuition = null (không bịa mức học phí), vẫn có schedule rỗng + taught 0", r.status === 200 && r.json.tuition === null && Array.isArray(r.json.schedule) && r.json.schedule.length === 0 && r.json.taught === 0, r.json);

  section("Chỉ đọc");
  check("xem trước không tạo ghi danh và không tăng lượt dùng", (await prisma.enrollment.count({ where: { userId: NEW.id } })) === 0 && (await prisma.classInvite.findUnique({ where: { code: cToan } }))?.usedCount === 0);
  check("không lộ dữ liệu người khác (tên/email học sinh khác, mật khẩu)", !/Em Mới|u\d+-.*@test\.local|password/i.test((await pv(cToan, S)).text));

  section("Đã trong lớp");
  await prisma.enrollment.create({ data: { userId: S.id, courseId: toan.id, status: "active" } });
  r = await pv(cToan, S);
  check("alreadyEnrolled=true; số môn vẫn tính 3 (không đếm đôi môn đang xem)", r.json.alreadyEnrolled === true && r.json.tuition?.subjectCount === 3, r.json.tuition);

  section("Mã sai / hết hạn");
  check("mã không tồn tại → status invalid (200), không có trường xem trước", (await pv("ZZZZ9999", S)).json.status === "invalid" && (await pv("ZZZZ9999", S)).json.schedule === undefined);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
