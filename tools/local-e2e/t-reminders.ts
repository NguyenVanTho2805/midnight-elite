import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey, hmOf, instantOf, addDaysKey, dueReminderKinds, reminderPlan } from "@/lib/classSessions";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function slot(courseId: string, min: number, joinUrl: string | null = null) {
  const t = new Date(Date.now() + min * 60_000);
  const dateKey = vnDateKeyOf(t), m = vnMinutesOfDay(t);
  const sched = await prisma.classSchedule.create({ data: { courseId, dayOfWeek: dayOfWeekOfKey(dateKey), startTime: hmOf(m), endTime: hmOf(Math.min(m + 60, 1439)), joinUrl } });
  return { sched, dateKey, startAt: instantOf(dateKey, m) };
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const other = await mkTutor("Thầy Khác");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" }), C = await mkUser({ name: "Em Chi" });
  await prisma.user.update({ where: { id: A.id }, data: { parentPhone: "0901234567", phone: "0911111111" } });
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  const courseOther = await mkCourse(other.id, { name: "Lý 9" });
  for (const u of [A, B, C]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: courseOther.id, status: "active" } });
  const now0 = new Date();
  const from = vnDateKeyOf(now0), to = addDaysKey(from, 7);
  const sched = (as?: any, q = `?from=${from}&to=${to}`) => api("GET", `/api/tutor/schedule${q}`, { as });

  const near = await slot(course.id, 30, "https://meet.google.com/abc-defg-hij");
  const futureSlot = await slot(course.id, 60 * 24 * 4); // 4 ngày nữa: chưa tới hạn nhắc
  await slot(courseOther.id, 30); // lớp của gia sư khác: không được lộ

  section("Quyền truy cập + kiểm tra khoảng ngày");
  check("chưa đăng nhập → 401", (await sched(undefined)).status === 401);
  check("học viên → 403", (await sched(A)).status === 403);
  check("from > to → 400", (await sched(tutor, `?from=${to}&to=${from}`)).status === 400);
  check("sai định dạng → 400", (await sched(tutor, "?from=hôm-nay&to=mai")).status === 400 && (await sched(tutor, "?from=2026-02-31&to=2026-03-02")).status === 400);
  check("khoảng quá dài → 400", (await sched(tutor, "?from=2026-01-01&to=2026-12-31")).status === 400);
  const def = await sched(tutor, "");
  check("không truyền gì: mặc định tuần này (7 ngày, bắt đầu Thứ Hai)", def.status === 200 && def.json.from <= vnDateKeyOf(now0) && vnDateKeyOf(now0) <= def.json.to && addDaysKey(def.json.from, 6) === def.json.to && dayOfWeekOfKey(def.json.from) === 1, [def.json.from, def.json.to]);

  section("Lịch của gia sư");
  const j = (await sched(tutor)).json;
  const occNear = j.occurrences.find((o: any) => o.scheduleId === near.sched.id && o.dateKey === near.dateKey);
  const occFut = j.occurrences.find((o: any) => o.scheduleId === futureSlot.sched.id && o.dateKey === futureSlot.dateKey);
  check("thấy buổi sắp tới của lớp mình, không thấy lớp gia sư khác", !!occNear && j.occurrences.every((o: any) => o.courseId === course.id), j.occurrences.map((o: any) => o.courseName));
  check("có link vào lớp + kế hoạch nhắc (24h/1h/hạn báo nghỉ)", occNear.joinUrl === "https://meet.google.com/abc-defg-hij" && !!occNear.plan.h24DueAt && !!occNear.plan.absenceDeadlineAt);
  const plan = reminderPlan(near.startAt);
  check("kế hoạch khớp quy tắc: hạn báo nghỉ = giờ học − 2 giờ", occNear.plan.absenceDeadlineAt === new Date(near.startAt.getTime() - 2 * 3600_000).toISOString() && occNear.plan.h24Shifted === plan.h24.shifted);
  check("danh sách học viên theo tên", eq(occNear.students.map((s: any) => s.name), ["Em An", "Em Bình", "Em Chi"]));
  const kinds = dueReminderKinds(near.startAt, new Date());
  const expectedPerStudent = kinds.length * 2; // parent + student
  check(`mỗi em có ${expectedPerStudent} tin tới hạn (kinds=${kinds.join("+")}) cho phụ huynh + học sinh`, occNear.students.every((s: any) => s.reminders.length === expectedPerStudent && s.reminders.every((r: any) => r.due && r.openedAt === null)), occNear.students[0].reminders.length);
  check("buổi 4 ngày nữa: chưa có tin nào tới hạn", occFut.students.every((s: any) => s.reminders.length === 0) && occFut.remindersDue === 0);
  const an = occNear.students[0];
  const pH24 = an.reminders.find((r: any) => r.recipient === "parent" && r.kind === "h24");
  check("tin 24h gửi phụ huynh: đúng mẫu, có link lớp, hạn báo nghỉ, SĐT phụ huynh", pH24.message.startsWith("KiN nhắc lịch: con Em An có buổi Toán 9 lúc ") && pH24.message.includes("với Cô Lan") && pH24.message.includes("Link vào lớp: https://meet.google.com/abc-defg-hij") && /Con cần nghỉ thì anh\/chị báo ở sổ học trước \d\d:\d\d/.test(pH24.message) && pH24.phone === "0901234567", pH24);
  const sH24 = an.reminders.find((r: any) => r.recipient === "student" && r.kind === "h24");
  check("tin gửi học sinh dùng SĐT của học sinh và xưng 'bạn'", sH24.phone === "0911111111" && sH24.message.includes("bạn có buổi"));
  check("em chưa khai SĐT: phone = null (vẫn soạn được tin, copy rồi dán)", occNear.students[1].reminders.every((r: any) => r.phone === null));
  check("bộ đếm: remindersDue = số tin tới hạn chưa mở Zalo", occNear.remindersDue === 3 * expectedPerStudent && j.counters.remindersDue === 3 * expectedPerStudent, [occNear.remindersDue, j.counters]);

  section("Ghi nhận 'Đã mở Zalo lúc …'");
  const post = (body: object, as = tutor) => api("POST", "/api/tutor/reminders", { as, body });
  const base = { scheduleId: near.sched.id, dateKey: near.dateKey, studentId: A.id, recipient: "parent", kind: "h24" };
  check("chưa đăng nhập → 401; học viên → 403", (await api("POST", "/api/tutor/reminders", { body: base })).status === 401 && (await post(base, A as any)).status === 403);
  let p1 = await post(base);
  check("ghi được lần đầu → 200 + openedAt", p1.status === 200 && !!p1.json.openedAt, p1);
  const p2 = await post(base);
  check("ghi lại lần hai: giữ nguyên lần đầu (idempotent)", p2.status === 200 && p2.json.openedAt === p1.json.openedAt);
  check("DB: đúng 1 dòng nhật ký", (await prisma.classReminderLog.count({ where: { scheduleId: near.sched.id, studentId: A.id, recipient: "parent", kind: "h24" } })) === 1);
  const j2 = (await sched(tutor)).json;
  const an2 = j2.occurrences.find((o: any) => o.scheduleId === near.sched.id && o.dateKey === near.dateKey).students[0];
  check("trên lịch: tin đó hiện 'đã mở Zalo lúc' và không còn tính là chờ gửi", !!an2.reminders.find((r: any) => r.recipient === "parent" && r.kind === "h24").openedAt && j2.counters.remindersDue === 3 * expectedPerStudent - 1);
  check("KiN không bao giờ ghi 'đã gửi'", !JSON.stringify(j2).includes('"sent"') && !JSON.stringify(j2).includes("daGui"));
  check("tin chưa tới hạn → 409", (await post({ ...base, scheduleId: futureSlot.sched.id, dateKey: futureSlot.dateKey })).status === 409);
  if (!plan.h1) check("buổi bị bỏ tin 1h (sáng sớm/giờ yên lặng) → 409", (await post({ ...base, kind: "h1" })).status === 409);
  else check("tin 1h tới hạn ghi được", (await post({ ...base, kind: "h1" })).status === 200);
  check("gia sư khác → 404", (await post(base, other)).status === 404);
  check("học viên không thuộc lớp → 404", (await post({ ...base, studentId: (await mkUser({ name: "Người Lạ" })).id })).status === 404);
  check("thiếu/sai trường → 400", (await post({ ...base, recipient: "ông hàng xóm" })).status === 400 && (await post({ ...base, kind: "h5" })).status === 400 && (await post({})).status === 400 && (await post({ ...base, dateKey: "2026-02-31" })).status === 400);
  check("ngày không khớp thứ của khung giờ → 400", (await post({ ...base, dateKey: addDaysKey(near.dateKey, 1) })).status === 400);

  section("Đã báo nghỉ thì không nhắc");
  await prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: near.sched.id, dateKey: near.dateKey, startAt: near.startAt, studentId: B.id, reportedBy: "parent", leadMinutes: 30, status: "pending" } });
  const j3 = (await sched(tutor)).json;
  const bb = j3.occurrences.find((o: any) => o.scheduleId === near.sched.id && o.dateKey === near.dateKey).students[1];
  check("Bình đã báo nghỉ: không còn tin nhắc, hiện trạng thái báo nghỉ", bb.reminders.length === 0 && bb.absence?.status === "pending", bb);
  check("bộ đếm báo nghỉ chờ = 1", j3.counters.pendingAbsences === 1);
  check("không ghi nhật ký nhắc cho em đã báo nghỉ → 409", (await post({ ...base, studentId: B.id })).status === 409);

  section("Gia sư tắt nhắc từng bên");
  await api("PUT", "/api/users/me/preferences", { as: tutor, body: { reminders: { student: false } } });
  const j4 = (await sched(tutor)).json;
  const an4 = j4.occurrences.find((o: any) => o.scheduleId === near.sched.id && o.dateKey === near.dateKey).students[0];
  check("tắt bên học sinh: chỉ còn tin cho phụ huynh", an4.reminders.length > 0 && an4.reminders.every((r: any) => r.recipient === "parent"), an4.reminders.map((r: any) => r.recipient));
  await api("PUT", "/api/users/me/preferences", { as: tutor, body: { reminders: { parent: false } } });
  const j5 = (await sched(tutor)).json;
  check("tắt cả hai: không còn tin nào", j5.occurrences.every((o: any) => o.students.every((s: any) => s.reminders.length === 0)) && j5.counters.remindersDue === 0);
  await api("PUT", "/api/users/me/preferences", { as: tutor, body: { reminders: null } });

  section("Lớp không có lịch / khung giờ hỏng");
  await prisma.classSchedule.create({ data: { courseId: course.id, dayOfWeek: 2, startTime: "7h", endTime: "xx" } });
  check("khung giờ nhập sai định dạng bị bỏ qua, không làm hỏng lịch", (await sched(tutor)).status === 200);
  const empty = await mkTutor("Gia sư mới");
  const je = await api("GET", "/api/tutor/schedule", { as: empty });
  check("gia sư chưa có lớp: lịch rỗng, bộ đếm 0", je.status === 200 && je.json.occurrences.length === 0 && je.json.counters.pendingAbsences === 0 && je.json.counters.remindersDue === 0);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
