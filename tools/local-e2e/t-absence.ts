import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey, hmOf, instantOf, parseHm } from "@/lib/classSessions";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Token ngẫu nhiên mỗi lần chạy: bộ giới hạn tốc độ của server nhớ theo token, chạy lại nhiều lần sẽ chạm trần.
const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const hex = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);

// Một khung giờ học có buổi bắt đầu cách bây giờ `min` phút (làm tròn xuống phút).
async function slot(courseId: string, min: number, extra: { joinUrl?: string | null } = {}) {
  const t = new Date(Date.now() + min * 60_000);
  const dateKey = vnDateKeyOf(t), m = vnMinutesOfDay(t);
  const sched = await prisma.classSchedule.create({
    data: { courseId, dayOfWeek: dayOfWeekOfKey(dateKey), startTime: hmOf(m), endTime: hmOf(Math.min(m + 60, 1439)), joinUrl: extra.joinUrl ?? null },
  });
  return { sched, dateKey, startAt: instantOf(dateKey, m) };
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const other = await mkTutor("Thầy Khác");
  const stuA = await mkUser({ name: "Em An" });
  const stuB = await mkUser({ name: "Em Bình" });
  const stuC = await mkUser({ name: "Em Chi" });
  const parentA = await mkUser({ name: "PH An" });
  const parentB = await mkUser({ name: "PH Bình" });
  await prisma.user.update({ where: { id: stuA.id }, data: { parentPhone: "0901234567", phone: "0911111111" } });
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  const course2 = await mkCourse(other.id, { name: "Lý 9" });
  for (const s of [stuA, stuB]) await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: stuC.id, courseId: course2.id, status: "active" } });
  const tokA = hex(0xa1), tokB = hex(0xb2), tokRev = hex(0xc3);
  await prisma.parentLink.create({ data: { parentId: parentA.id, studentId: stuA.id, status: "verified", verifiedAt: new Date(), portalToken: tokA } });
  await prisma.parentLink.create({ data: { parentId: parentB.id, studentId: stuB.id, status: "verified", verifiedAt: new Date(), portalToken: tokB } });
  const parentC = await mkUser({ name: "PH Chi" });
  await prisma.parentLink.create({ data: { parentId: parentC.id, studentId: stuC.id, status: "revoked", portalToken: tokRev } });
  const report = (token: string, body: unknown) => api("POST", `/api/parent-portal/${token}/absences`, { body });

  section("Báo nghỉ trước ≥ 2 giờ → tự ghi + tự giữ buổi bù");
  const far = await slot(course.id, 300);
  let r = await report(tokA, { scheduleId: far.sched.id, dateKey: far.dateKey, reason: "Con đi khám" });
  check("201 + kind=auto + giữ buổi bù", r.status === 201 && r.json.kind === "auto" && r.json.makeupGranted === true && r.json.status === "excused_auto", r);
  const absFar = await prisma.classAbsence.findFirst({ where: { scheduleId: far.sched.id, studentId: stuA.id } });
  check("DB: ClassAbsence excused_auto, lưu lý do + số phút báo trước", absFar?.status === "excused_auto" && absFar.reason === "Con đi khám" && absFar.leadMinutes >= 290 && absFar.leadMinutes <= 300, absFar);
  const mk = await prisma.makeupCredit.findMany({ where: { absenceId: absFar!.id } });
  const days = (mk[0].expiresAt.getTime() - mk[0].grantedAt.getTime()) / 86400_000;
  check("đúng 1 buổi bù, hạn 30 ngày, đang active", mk.length === 1 && days === 30 && mk[0].status === "active" && mk[0].studentId === stuA.id && mk[0].courseId === course.id, mk);
  const sess = await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: course.id, date: new Date(`${far.dateKey}T00:00:00Z`) } } });
  const rec = sess && await prisma.attendanceRecord.findUnique({ where: { sessionId_userId: { sessionId: sess.id, userId: stuA.id } } });
  check("điểm danh ghi 'Có phép' (excused), buổi do gia sư chủ lớp đứng tên", rec?.status === "excused" && sess?.createdBy === tutor.id, { rec, sess });
  check("gia sư không nhận thông báo (không có việc cần làm)", (await prisma.notification.count({ where: { userId: tutor.id, type: "absence_late" } })) === 0);

  section("Báo trùng, báo hai lần song song");
  r = await report(tokA, { scheduleId: far.sched.id, dateKey: far.dateKey });
  check("báo lại cùng buổi → 409", r.status === 409, r);
  const racing = await slot(course.id, 400);
  const rs = await Promise.all(Array.from({ length: 6 }, () => report(tokB, { scheduleId: racing.sched.id, dateKey: racing.dateKey })));
  check("6 lần báo cùng lúc: đúng 1 lần thành công, 5 lần 409", rs.filter(x => x.status === 201).length === 1 && rs.filter(x => x.status === 409).length === 5, rs.map(x => x.status));
  const racedAbs = await prisma.classAbsence.findFirst({ where: { scheduleId: racing.sched.id, studentId: stuB.id } });
  check("đúng 1 ClassAbsence và 1 buổi bù", (await prisma.classAbsence.count({ where: { scheduleId: racing.sched.id } })) === 1 && (await prisma.makeupCredit.count({ where: { absenceId: racedAbs!.id } })) === 1);

  section("Báo trước < 2 giờ → vào Hộp việc, chờ gia sư");
  const near = await slot(course.id, 90);
  r = await report(tokA, { scheduleId: near.sched.id, dateKey: near.dateKey });
  check("201 + kind=late, chưa có buổi bù", r.status === 201 && r.json.kind === "late" && r.json.makeupGranted === false && r.json.status === "pending", r);
  const absNear = await prisma.classAbsence.findFirst({ where: { scheduleId: near.sched.id } });
  check("DB: pending, chưa có buổi bù, chưa có điểm danh", absNear?.status === "pending" && (await prisma.makeupCredit.count({ where: { absenceId: absNear!.id } })) === 0);
  check("gia sư được thông báo 'Báo nghỉ sát giờ'", await (async () => { await new Promise(r => setTimeout(r, 400)); return (await prisma.notification.count({ where: { userId: tutor.id, type: "absence_late" } })) === 1; })());
  const sc = await api("GET", "/api/tutor/schedule", { as: tutor });
  check("bộ đếm Hộp việc: 1 báo nghỉ chờ xử lý", sc.status === 200 && sc.json.counters.pendingAbsences === 1, sc.json?.counters);

  section("Gia sư xử lý bằng MỘT nút");
  check("học viên không gọi được", (await api("PATCH", `/api/tutor/absences/${absNear!.id}`, { as: stuA, body: { action: "free_makeup" } })).status === 403);
  check("gia sư lớp khác → 403", (await api("PATCH", `/api/tutor/absences/${absNear!.id}`, { as: other, body: { action: "free_makeup" } })).status === 403);
  check("action sai → 400", (await api("PATCH", `/api/tutor/absences/${absNear!.id}`, { as: tutor, body: { action: "xoa" } })).status === 400);
  check("không tồn tại → 404", (await api("PATCH", `/api/tutor/absences/khong-co`, { as: tutor, body: { action: "charge" } })).status === 404);
  const fr = await Promise.all(Array.from({ length: 4 }, () => api("PATCH", `/api/tutor/absences/${absNear!.id}`, { as: tutor, body: { action: "free_makeup" } })));
  check("bấm đúp/4 lần cùng lúc: đúng 1 lần thành công, còn lại 409", fr.filter(x => x.status === 200).length === 1 && fr.filter(x => x.status === 409).length === 3, fr.map(x => x.status));
  const ok = fr.find(x => x.status === 200)!;
  check("trả tin nhắn đúng mẫu + số buổi bù đang giữ", ok.json.message.startsWith("Đã ghi nhận con nghỉ buổi") && ok.json.message.includes("không tính phí") && ok.json.message.includes(`con còn ${ok.json.makeupCount} buổi bù`) && ok.json.makeupCount === 2, ok.json);
  check("tin dùng 'Cô Lan' (không lặp 'Thầy/Cô Cô')", ok.json.message.includes("Cô Lan sẽ hẹn giờ bù") && !ok.json.message.includes("Cô Cô"), ok.json.message);
  check("trả SĐT phụ huynh để mở Zalo", ok.json.parentPhone === "0901234567");
  const after = await prisma.classAbsence.findUnique({ where: { id: absNear!.id } });
  check("DB: excused_free + resolvedBy gia sư; đúng 1 buổi bù", after?.status === "excused_free" && after.resolvedBy === tutor.id && (await prisma.makeupCredit.count({ where: { absenceId: absNear!.id } })) === 1, after);
  const sessN = await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: course.id, date: new Date(`${near.dateKey}T00:00:00Z`) } } });
  check("điểm danh 'Có phép'", (await prisma.attendanceRecord.findFirst({ where: { sessionId: sessN?.id, userId: stuA.id } }))?.status === "excused");
  check("đã xử lý thì bộ đếm về 0", (await api("GET", "/api/tutor/schedule", { as: tutor })).json.counters.pendingAbsences === 0);

  section("'Tính phí buổi này' → không buổi bù");
  const near2 = await slot(course.id, 60);
  r = await report(tokB, { scheduleId: near2.sched.id, dateKey: near2.dateKey });
  const abs2 = await prisma.classAbsence.findFirst({ where: { scheduleId: near2.sched.id } });
  const attBefore = await prisma.attendanceRecord.count();
  const ch = await api("PATCH", `/api/tutor/absences/${abs2!.id}`, { as: tutor, body: { action: "charge" } });
  check("200 + status charged + tin không hứa buổi bù", ch.status === 200 && ch.json.status === "charged" && ch.json.message.includes("không có buổi bù"), ch.json);
  check("không có buổi bù, không tự ghi điểm danh", (await prisma.makeupCredit.count({ where: { absenceId: abs2!.id } })) === 0 && (await prisma.attendanceRecord.count()) === attBefore);
  check("đã tính phí rồi không đổi sang miễn phí được → 409", (await api("PATCH", `/api/tutor/absences/${abs2!.id}`, { as: tutor, body: { action: "free_makeup" } })).status === 409);

  section("Từ chối báo nghỉ không hợp lệ");
  const past = await slot(course.id, -10);
  check("buổi đã bắt đầu → 400", (await report(tokA, { scheduleId: past.sched.id, dateKey: past.dateKey })).status === 400);
  const wrongDay = (dayOfWeekOfKey(far.dateKey) + 1) % 7 === dayOfWeekOfKey(far.dateKey) ? far.dateKey : `${far.dateKey.slice(0, 8)}${String((Number(far.dateKey.slice(8)) % 28) + 1).padStart(2, "0")}`;
  check("ngày không khớp thứ của khung giờ → 400", wrongDay === far.dateKey || (await report(tokB, { scheduleId: far.sched.id, dateKey: wrongDay })).status === 400);
  check("ngày sai định dạng → 400", (await report(tokB, { scheduleId: far.sched.id, dateKey: "2026-02-31" })).status === 400 && (await report(tokB, { scheduleId: far.sched.id, dateKey: "mai" })).status === 400);
  check("thiếu dữ liệu → 400", (await report(tokB, {})).status === 400);
  check("buổi không tồn tại → 404", (await report(tokB, { scheduleId: "khong-co", dateKey: far.dateKey })).status === 404);
  const farC = await slot(course2.id, 300);
  check("con không học lớp đó → 403 (token của em An không báo được lớp Lý 9)", (await report(tokA, { scheduleId: farC.sched.id, dateKey: farC.dateKey })).status === 403);
  check("token sai định dạng → 404", (await report("abc", { scheduleId: far.sched.id, dateKey: far.dateKey })).status === 404);
  check("token không có thật → 404", (await report(hex(0xdead), { scheduleId: far.sched.id, dateKey: far.dateKey })).status === 404);
  check("liên kết phụ huynh đã thu hồi → 404", (await report(tokRev, { scheduleId: farC.sched.id, dateKey: farC.dateKey })).status === 404);
  const inactive = await slot(course.id, 500);
  await prisma.classSchedule.update({ where: { id: inactive.sched.id }, data: { active: false } });
  check("khung giờ đã tắt → 404", (await report(tokB, { scheduleId: inactive.sched.id, dateKey: inactive.dateKey })).status === 404);
  const lateDrop = await slot(course.id, 600);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: stuB.id, courseId: course.id } }, data: { status: "suspended" } });
  check("em đã bị tạm dừng lớp → 403", (await report(tokB, { scheduleId: lateDrop.sched.id, dateKey: lateDrop.dateKey })).status === 403);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: stuB.id, courseId: course.id } }, data: { status: "active" } });

  section("Sổ của con: buổi sắp tới + số buổi bù");
  const pa = await api("GET", `/api/parent-portal/${tokA}`);
  const up = pa.json.upcoming as { scheduleId: string; dateKey: string; absence: { status: string } | null; freeWindowOpen: boolean }[];
  const upFar = up.find(u => u.scheduleId === far.sched.id && u.dateKey === far.dateKey);
  const upNear = up.find(u => u.scheduleId === near.sched.id);
  check("buổi đã báo nghỉ hiện trạng thái; buổi >2h còn cửa sổ giữ buổi bù", pa.status === 200 && upFar?.absence?.status === "excused_auto" && upFar.freeWindowOpen === true, upFar);
  check("buổi đã xử lý hiện excused_free; buổi cách <2h không còn cửa sổ", !upNear || (upNear.absence?.status === "excused_free" && upNear.freeWindowOpen === false), upNear);
  check("không liệt kê buổi hôm nay đã bắt đầu (tuần sau thì có, vì lịch lặp)", !up.some(u => u.scheduleId === past.sched.id && u.dateKey === past.dateKey) && up.some(u => u.scheduleId === past.sched.id));
  check("số buổi bù đang giữ = 2 (1 tự động + 1 gia sư xử lý)", pa.json.makeup.count === 2 && pa.json.makeup.items.length === 2 && !!pa.json.makeup.nextExpiresAt, pa.json.makeup);
  const pb = await api("GET", `/api/parent-portal/${tokB}`);
  check("em Bình chỉ thấy buổi bù của em (1 tự động từ lần báo song song)", pb.json.makeup.count === 1, pb.json.makeup);
  check("không lộ buổi của em khác", !(pb.json.upcoming as { scheduleId: string }[]).some(u => u.scheduleId === farC.sched.id));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
