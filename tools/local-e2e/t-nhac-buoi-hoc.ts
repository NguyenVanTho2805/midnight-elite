// DG-HOC-ONLINE — API + DB: /api/cron/nhac-buoi-hoc (email nhắc trước giờ học) và link Meet trong thư remind-class 07:00.
// Cần máy chủ dev chạy với CÙNG EMAIL_SINK_DIR và CRON_SECRET (tools/local-e2e/env.sh). Thư ghi thành tệp JSON, không gửi đi. Bài wipe() DB riêng.
// Buổi dựng theo GIỜ THẬT: bắt đầu sau ~55 phút (lead 1 giờ ⇒ lẽ ra gửi ~5 phút trước) và sau ~10 phút (lead 15 phút).
// Chạy: TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-nhac-buoi-hoc.ts
import { readdirSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { looksLikeMoney } from "@/lib/lessonReminder";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe, type TUser } from "./h";

const SINK = process.env.EMAIL_SINK_DIR;
const SECRET = process.env.CRON_SECRET;
if (!SINK || !SECRET) { console.error("Cần EMAIL_SINK_DIR và CRON_SECRET (source tools/local-e2e/env.sh)."); process.exit(2); }
type Mail = { to: string; subject: string; text?: string; html?: string };
const mails = (): Mail[] => readdirSync(SINK).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail);
const to = (email: string) => mails().filter(m => m.to === email);
const AUTH = { authorization: `Bearer ${SECRET}` };
const MEET = "https://meet.google.com/kin-test-abc";
const ZOOM = "https://us02web.zoom.us/j/9988776655";

async function enroll(courseId: string, status: string, name: string): Promise<TUser> {
  const u = await mkUser({ name });
  await prisma.enrollment.create({ data: { userId: u.id, courseId, status } });
  return u;
}
/** Khung giờ tuần bắt đầu sau `inMin` phút (làm tròn xuống phút) theo giờ VN. */
async function slotIn(courseId: string, inMin: number, extra: { joinUrl?: string; mode?: string } = {}) {
  const at = new Date(Date.now() + inMin * 60_000);
  const dk = vnDateKeyOf(at), m = vnMinutesOfDay(at);
  const s = await prisma.classSchedule.create({
    data: { courseId, dayOfWeek: dayOfWeekOfKey(dk), startTime: hmOf(m), endTime: hmOf(Math.min(m + 60, 23 * 60 + 59)), ...extra },
  });
  return { schedule: s, dateKey: dk };
}

async function main() {
  await wipe();
  rmSync(SINK!, { recursive: true, force: true }); mkdirSync(SINK!, { recursive: true });
  const tutor = await mkTutor("Gia sư Nhắc");

  // A: lead 1 giờ, link Meet chung, buổi sau 55 phút. Học sinh: 1 đang học, 1 chờ phụ huynh, 1 tạm dừng, 1 đã báo nghỉ, 1 tài khoản bị khoá.
  const A = await mkCourse(tutor.id, { name: "Toán 9 Nhắc" });
  await prisma.course.update({ where: { id: A.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: 60 } });
  const a = await slotIn(A.id, 55);
  const aOk = await enroll(A.id, "active", "Em Đang Học");
  const aPend = await enroll(A.id, "pending_consent", "Em Chờ Phụ Huynh");
  const aSusp = await enroll(A.id, "suspended", "Em Tạm Dừng");
  const aAbs = await enroll(A.id, "active", "Em Báo Nghỉ");
  const aBan = await enroll(A.id, "active", "Em Bị Khoá");
  await prisma.user.update({ where: { id: aBan.id }, data: { banned: true } });
  await prisma.classAbsence.create({ data: { courseId: A.id, scheduleId: a.schedule.id, dateKey: a.dateKey, startAt: new Date(Date.now() + 55 * 60_000), studentId: aAbs.id, reportedBy: "student", leadMinutes: 55, status: "pending" } });

  // B: cùng giờ nhưng TẮT nhắc ⇒ không thư.
  const B = await mkCourse(tutor.id, { name: "Văn Tắt Nhắc" });
  await prisma.course.update({ where: { id: B.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: null } });
  await slotIn(B.id, 55);
  const bOk = await enroll(B.id, "active", "Em Lớp Tắt");

  // C: lead 15 phút, buổi LẺ sau 10 phút có link Zoom RIÊNG buổi (ưu tiên hơn link chung).
  const C = await mkCourse(tutor.id, { name: "Lý Buổi Lẻ" });
  await prisma.course.update({ where: { id: C.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: 15 } });
  const cAt = new Date(Date.now() + 10 * 60_000);
  const cDk = vnDateKeyOf(cAt), cM = vnMinutesOfDay(cAt);
  await prisma.attendanceSession.create({ data: { courseId: C.id, date: new Date(`${cDk}T00:00:00Z`), createdBy: tutor.id, kind: "extra", startTime: hmOf(cM), endTime: hmOf(Math.min(cM + 45, 23 * 60 + 59)), joinUrl: ZOOM } });
  const cOk = await enroll(C.id, "active", "Em Buổi Lẻ");

  // D: lead 1 giờ nhưng buổi sau 2 giờ ⇒ chưa tới hạn. E: lead 1 giờ, buổi sau 55 phút nhưng HỌC TRỰC TIẾP ⇒ thư không có link.
  const D = await mkCourse(tutor.id, { name: "Hoá Chưa Tới" });
  await prisma.course.update({ where: { id: D.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: 60 } });
  await slotIn(D.id, 120);
  const dOk = await enroll(D.id, "active", "Em Chưa Tới");
  const E = await mkCourse(tutor.id, { name: "Sinh Trực Tiếp" });
  await prisma.course.update({ where: { id: E.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: 60 } });
  await slotIn(E.id, 55, { mode: "offline" });
  const eOk = await enroll(E.id, "active", "Em Trực Tiếp");

  section("khoá cron");
  const r0 = await api("GET", "/api/cron/nhac-buoi-hoc");
  check("1. không có Authorization ⇒ 401", r0.status === 401, r0.status);
  const r0b = await api("GET", "/api/cron/nhac-buoi-hoc", { headers: { authorization: "Bearer sai-sai-sai-sai-sai-sai" } });
  check("2. sai CRON_SECRET ⇒ 401", r0b.status === 401, r0b.status);
  const r0c = await api("POST", "/api/cron/nhac-buoi-hoc?dryRun=1");
  check("3. POST không khoá cũng 401", r0c.status === 401, r0c.status);

  section("dryRun");
  const dry = await api("GET", "/api/cron/nhac-buoi-hoc?dryRun=1", { headers: AUTH });
  check("4. dryRun ⇒ 200, 3 buổi tới hạn (A, C, E), 3 thư lẽ ra gửi", dry.status === 200 && dry.json?.dryRun === true && dry.json?.due === 3 && dry.json?.sent === 3, dry.json);
  check("5. dryRun KHÔNG ghi bảng chống trùng, KHÔNG gửi thư", (await prisma.classLessonReminderLog.count()) === 0 && mails().length === 0);
  check("6. phản hồi không có tên / email học sinh", !dry.text.includes("Em Đang Học") && !dry.text.includes("@test.local"));

  section("chạy thật");
  const r1 = await api("GET", "/api/cron/nhac-buoi-hoc", { headers: AUTH });
  check("7. 200, gửi đúng 3 thư, không lỗi", r1.status === 200 && r1.json?.sent === 3 && r1.json?.failed === 0, r1.json);
  check("8. em đang học lớp A nhận đúng 1 thư", to(aOk.email).length === 1);
  check("9. em chờ phụ huynh / tạm dừng / đã báo nghỉ / bị khoá KHÔNG nhận", [aPend, aSusp, aAbs, aBan].every(u => to(u.email).length === 0));
  check("10. lớp tắt nhắc (B) và buổi chưa tới hạn (D) KHÔNG gửi", to(bOk.email).length === 0 && to(dOk.email).length === 0);
  const mA = to(aOk.email)[0];
  check("11. thư A có tên lớp, giờ bắt đầu và link Meet chung", !!mA && mA.subject.includes("Toán 9 Nhắc") && mA.subject.includes(a.schedule.startTime) && (mA.text ?? "").includes(MEET), mA);
  const mC = to(cOk.email)[0];
  check("12. buổi lẻ C dùng link RIÊNG buổi (Zoom), không dùng link chung", !!mC && (mC.text ?? "").includes(ZOOM) && !(mC.text ?? "").includes(MEET), mC?.text);
  const mE = to(eOk.email)[0];
  check("13. buổi học trực tiếp (E): có thư nhưng KHÔNG có link online", !!mE && !(mE.text ?? "").includes(MEET) && (mE.text ?? "").includes("chưa có link"), mE?.text);
  check("14. mọi thư không có số tiền", mails().every(m => !looksLikeMoney(m.subject) && !looksLikeMoney(m.text ?? "") && !looksLikeMoney((m.html ?? "").replace(/#[0-9a-f]{3,6}/gi, ""))));
  check("15. bảng chống trùng có 3 dòng (A, C, E — mỗi em một dòng)", (await prisma.classLessonReminderLog.count()) === 3);
  const lastCall = await prisma.settingKV.findUnique({ where: { key: "cron.nhac-buoi-hoc.lastCall" } });
  check("16. ghi 'lần gọi gần nhất' cho trang Triển khai", !!lastCall);

  section("chạy lại — không gửi trùng");
  const before = mails().length;
  const r2 = await api("POST", "/api/cron/nhac-buoi-hoc", { headers: AUTH });
  check("17. lượt 2 (POST) ⇒ 200, gửi 0, 3 đã gửi trước", r2.status === 200 && r2.json?.sent === 0 && r2.json?.alreadySent === 3, r2.json);
  check("18. không thêm thư nào", mails().length === before);
  check("19. bảng chống trùng vẫn 3 dòng", (await prisma.classLessonReminderLog.count()) === 3);

  section("em mới vào lớp sau lượt 1 vẫn được nhắc, em cũ không bị nhắc lại");
  const aNew = await enroll(A.id, "active", "Em Mới Vào");
  const r3 = await api("GET", "/api/cron/nhac-buoi-hoc", { headers: AUTH });
  check("20. lượt 3 gửi đúng 1 thư cho em mới", r3.json?.sent === 1 && to(aNew.email).length === 1 && to(aOk.email).length === 1, r3.json);

  section("tắt nhắc giữa chừng ⇒ dừng");
  await prisma.course.update({ where: { id: A.id }, data: { reminderLeadMinutes: null } });
  await enroll(A.id, "active", "Em Vào Sau Khi Tắt");
  const r4 = await api("GET", "/api/cron/nhac-buoi-hoc?dryRun=1", { headers: AUTH });
  check("21. lớp A đã tắt ⇒ không còn trong danh sách buổi tới hạn", r4.status === 200 && !(r4.json?.lessons ?? []).some((l: { courseId: string }) => l.courseId === A.id), r4.json);

  section("remind-class 07:00 — chèn link Meet vào thư nhắc ngày mai");
  rmSync(SINK!, { recursive: true, force: true }); mkdirSync(SINK!, { recursive: true });
  const tomorrow = addDaysKey(vnDateKeyOf(new Date()), 1);
  const F = await mkCourse(tutor.id, { name: "Anh Ngày Mai" });
  await prisma.course.update({ where: { id: F.id }, data: { classJoinUrl: MEET } });
  await prisma.classSchedule.create({ data: { courseId: F.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "19:00", endTime: "20:30" } });
  const fOk = await enroll(F.id, "active", "Em Ngày Mai");
  const G = await mkCourse(tutor.id, { name: "Địa Không Link" });
  await prisma.classSchedule.create({ data: { courseId: G.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "18:00", endTime: "19:00" } });
  const gOk = await enroll(G.id, "active", "Em Không Link");
  // Lớp chọn nhắc trước 1 ngày ⇒ thư 07:00 bỏ qua (đã có thư 24 giờ trước); lớp chọn 1 giờ ⇒ vẫn nhận thư 07:00.
  const H = await mkCourse(tutor.id, { name: "Tin Nhắc Một Ngày" });
  await prisma.course.update({ where: { id: H.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: 1440 } });
  await prisma.classSchedule.create({ data: { courseId: H.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "17:00", endTime: "18:00" } });
  const hOk = await enroll(H.id, "active", "Em Một Ngày");
  const K = await mkCourse(tutor.id, { name: "GDCD Nhắc Một Giờ" });
  await prisma.course.update({ where: { id: K.id }, data: { reminderLeadMinutes: 60 } });
  await prisma.classSchedule.create({ data: { courseId: K.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "16:00", endTime: "17:00" } });
  const kOk = await enroll(K.id, "active", "Em Một Giờ");
  const rc = await api("GET", "/api/cron/remind-class", { headers: AUTH });
  check("22. remind-class ⇒ 200", rc.status === 200, rc.json);
  const mF = to(fOk.email)[0], mG = to(gOk.email)[0];
  check("23. thư ngày mai của lớp có link ⇒ có link Meet", !!mF && (mF.html ?? "").includes(MEET), mF?.subject);
  check("24. lớp không có link ⇒ thư không có dòng link", !!mG && !(mG.html ?? "").includes("Link học online"), mG?.subject);

  check("25. lớp nhắc trước 1 ngày ⇒ thư 07:00 KHÔNG gửi (tránh hai thư cho một buổi)", to(hOk.email).length === 0);
  check("26. lớp nhắc trước 1 giờ ⇒ thư 07:00 vẫn gửi", to(kOk.email).length === 1);

  await done();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
