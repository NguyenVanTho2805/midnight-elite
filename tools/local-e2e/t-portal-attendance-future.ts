// NC2-026a — F1: phụ huynh báo nghỉ buổi TƯƠNG LAI không được tính vào "N buổi" / tỷ lệ chuyên cần
// (cổng phụ huynh + báo cáo tháng của gia sư). Cần máy chủ dev đang chạy ở BASE.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, hmOf, vnDateKeyOf } from "@/lib/classSessions";

const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const hex = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);
const D = (k: string) => new Date(`${k}T00:00:00Z`);
async function mkSession(courseId: string, dateKey: string, createdBy: string, recs: Record<string, string>) {
  const s = await prisma.attendanceSession.create({ data: { courseId, date: D(dateKey), createdBy } });
  for (const [uid, st] of Object.entries(recs)) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: uid, status: st } });
}

(async () => {
  await wipe();
  const today = vnDateKeyOf(new Date());
  const ym = today.slice(0, 7);
  const prevYm = (() => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; })();
  // Buổi tương lai phải CÙNG tháng VN với hôm nay mới thử được trần ngày (nếu hôm nay là ngày cuối tháng thì dùng hôm qua làm "hôm nay giả" là không thể → bỏ qua cảnh báo).
  const futureKey = addDaysKey(today, 1);
  check("tiền đề: ngày mai cùng tháng với hôm nay (chạy lại vào ngày không phải cuối tháng)", futureKey.slice(0, 7) === ym, { today, futureKey });

  const T = await mkTutor("Cô Lan");
  const stuNew = await mkUser({ name: "Em Mới" }), stuOld = await mkUser({ name: "Em Cũ" });
  const phNew = await mkUser({ name: "PH Mới" }), phOld = await mkUser({ name: "PH Cũ" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  for (const s of [stuNew, stuOld]) await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } });
  const tokNew = hex(0xa1), tokOld = hex(0xb2);
  await prisma.parentLink.create({ data: { parentId: phNew.id, studentId: stuNew.id, status: "verified", verifiedAt: new Date(), portalToken: tokNew } });
  await prisma.parentLink.create({ data: { parentId: phOld.id, studentId: stuOld.id, status: "verified", verifiedAt: new Date(), portalToken: tokOld } });

  // Lịch có buổi vào ngày mai (xa hơn 2 giờ) → phụ huynh báo nghỉ → markExcused tạo bản ghi 'excused' ở ngày mai.
  const sched = await prisma.classSchedule.create({ data: { courseId: course.id, dayOfWeek: dayOfWeekOfKey(futureKey), startTime: hmOf(12 * 60), endTime: hmOf(13 * 60) } });
  const portal = (tok: string, q = "") => api("GET", `/api/parent-portal/${tok}${q}`);
  const report = (tok: string) => api("POST", `/api/parent-portal/${tok}/absences`, { body: { scheduleId: sched.id, dateKey: futureKey, reason: "Con bận" } });

  section("Em chưa có buổi nào + báo nghỉ buổi tương lai");
  const r1 = await report(tokNew);
  check("báo nghỉ thành công (luồng báo nghỉ không đổi)", r1.status === 201, r1);
  const futureRec = await prisma.attendanceRecord.findFirst({ where: { userId: stuNew.id, session: { date: D(futureKey) } } });
  check("DB có bản ghi excused ở ngày mai (không bị xoá/đổi)", futureRec?.status === "excused");
  let p = await portal(tokNew);
  let att = p.json.courses?.[0]?.attendance;
  check("API: không đếm bản ghi tương lai — total 0, ratio null (không '80% · 1 buổi')", p.status === 200 && att?.total === 0 && att?.ratio === null, att);
  check("buổi tương lai vẫn hiện ở 'sắp tới' với trạng thái đã báo nghỉ", JSON.stringify(p.json.upcoming ?? null).includes(futureKey), p.json.upcoming);
  const html = await fetch(`${process.env.BASE}/so-cua-con/${tokNew}`).then(r => r.text());
  check("Trang: không có '80%', có 'Chưa có buổi điểm danh'", !/80%/.test(html) && html.includes("Chưa có buổi điểm danh"));

  section("Em có buổi quá khứ đủ 4 trạng thái + 1 hôm nay + báo nghỉ tương lai");
  const prevDays = [`${prevYm}-03`, `${prevYm}-10`, `${prevYm}-17`, `${prevYm}-24`];
  await mkSession(course.id, prevDays[0], T.id, { [stuOld.id]: "present" });
  await mkSession(course.id, prevDays[1], T.id, { [stuOld.id]: "late" });
  await mkSession(course.id, prevDays[2], T.id, { [stuOld.id]: "excused" });
  await mkSession(course.id, prevDays[3], T.id, { [stuOld.id]: "absent" });
  const rOld = await report(tokOld);
  check("báo nghỉ buổi tương lai của em cũ cũng thành công", rOld.status === 201, rOld);
  // Tháng trước: 4 trạng thái như cũ = (1+0,9+0,8+0,5)/4 = 0,8
  p = await portal(tokOld, `?yearMonth=${prevYm}`);
  att = p.json.courses?.[0]?.attendance;
  check("tháng trước, 4 trạng thái vẫn đúng như cũ: 4 buổi, 80%", att?.total === 4 && Math.abs(att.ratio - 0.8) < 1e-9, att);
  // Tháng này: thêm 1 buổi present HÔM NAY (phải tính), excused ngày mai không
  await mkSession(course.id, today, T.id, { [stuOld.id]: "present" });
  p = await portal(tokOld);
  att = p.json.courses?.[0]?.attendance;
  check("tháng này: buổi hôm nay tính (1 buổi, 100%), excused ngày mai không tính", att?.total === 1 && att?.ratio === 1, att);

  section("Báo cáo tháng của gia sư không đếm bản ghi tương lai");
  const m = await api("GET", `/api/tutor/monthly-reports/${stuNew.id}?yearMonth=${ym}`, { as: T });
  const sub = m.json.subjects?.[0];
  check("báo cáo tháng (em mới): chuyên cần null, 0 buổi", m.status === 200 && sub?.attendance?.ratio === null && sub?.attendance?.sessions === 0, sub?.attendance);
  const m2 = await api("GET", `/api/tutor/monthly-reports/${stuOld.id}?yearMonth=${ym}`, { as: T });
  check("báo cáo tháng (em cũ): đúng 1 buổi (hôm nay), 100%", m2.json.subjects?.[0]?.attendance?.sessions === 1 && m2.json.subjects?.[0]?.attendance?.ratio === 1, m2.json.subjects?.[0]?.attendance);
  done();
})().catch(e => { console.error(e); process.exit(1); });
