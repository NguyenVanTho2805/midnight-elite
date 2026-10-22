// NC2-011 — tin 07:00 "Hôm qua có N buổi chưa điểm danh" với DỮ LIỆU THẬT: đếm đúng N, chỉ buổi HÔM QUA, buổi huỷ / dời đi / đủ điểm danh / lớp đóng không tính,
// 1 tin / gia sư / ngày VN, cô lập giữa các gia sư, công tắc mặc định TẮT, chữ đẩy chỉ có N, và cron remind-class (HTTP) vẫn gửi khi NGÀY MAI không có buổi nào.
// Cần Postgres + Next dev, PUSH_ENABLED=1 + VAPID_* (xem env.example.sh). Bộ gửi giả: không gọi ra mạng. Phần thuần: t-unmarked-daily-lib.ts.
import { api, BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { setPushSender, pushToUser, type PushSender } from "@/lib/pushServer";
import { PUSH_DEFS, pushConfig, pushPayload } from "@/lib/pushRules";
import { inQuietHours, vnMinutesOfDay, dayOfWeekOfKey, addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { sendUnmarkedDaily } from "@/lib/unmarkedDailyServer";
import { yesterdayKeyVn } from "@/lib/unmarkedDaily";
import webpush from "web-push";

const stamp = Date.now().toString(36);
const keys = webpush.generateVAPIDKeys();
const sub = (n: string) => ({ subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/ud-${stamp}-${n}`, keys: { p256dh: keys.publicKey, auth: keys.privateKey.slice(0, 22) } }, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0.0.0 Mobile Safari/537.36" });
const epOf = (n: string) => sub(n).subscription.endpoint;
const calls: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
const fake: PushSender = async (t, payload) => { calls.push({ endpoint: t.endpoint, payload: JSON.parse(payload) }); };
const vn = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 21, hh - 7, mm));
const notesOf = (u: TUser) => prisma.notification.findMany({ where: { userId: u.id, type: "unmarked_daily" } });

(async () => {
  if (!pushConfig(process.env).enabled) { console.error("THIẾU CẤU HÌNH: cần PUSH_ENABLED=1 và VAPID_* (xem env.example.sh)."); process.exit(2); }
  await wipe();
  const now = new Date();
  const yday = yesterdayKeyVn(now);
  const ydow = dayOfWeekOfKey(yday), long = new Date(Date.now() - 30 * 86400_000);
  const TA = await mkTutor("Cô An"), TB = await mkTutor("Thầy Bình"), TC = await mkTutor("Cô Chi"), TD = await mkTutor("Thầy Dũng"), TE = await mkTutor("Cô Em"), TF = await mkTutor("Thầy Phúc"), TG = await mkTutor("Cô Giang");

  /** Lớp + 1 khung giờ vào đúng thứ của hôm qua (09:00–10:00, đã kết thúc từ lâu) + 1 em ghi danh từ 30 ngày trước. */
  async function mkClass(owner: TUser, name: string, o: { classStatus?: string; dow?: number } = {}) {
    const c = await mkCourse(owner.id, { name, classStatus: o.classStatus });
    const sch = await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: o.dow ?? ydow, startTime: "09:00", endTime: "10:00", createdAt: long } });
    const stu = await mkUser({ name: `Em của ${name}` });
    await prisma.enrollment.create({ data: { userId: stu.id, courseId: c.id, status: "active", createdAt: long } });
    return { c, sch, stu };
  }
  await mkClass(TA, "An-Toán"); await mkClass(TA, "An-Lý");          // TA: 2 buổi hôm qua (và 1 tuần trước cũng chưa điểm danh — không được cộng vào N)
  await mkClass(TB, "Bình-Văn");                                      // TB: 1 buổi
  const cC = await mkClass(TC, "Chi-Hoá");                            // TC: đã điểm danh đủ
  await prisma.attendanceSession.create({ data: { courseId: cC.c.id, date: new Date(`${yday}T00:00:00Z`), createdBy: TC.id, records: { create: [{ userId: cC.stu.id, status: "present" }] } } });
  const cD = await mkClass(TD, "Dũng-Sử");                            // TD: buổi hôm qua bị huỷ
  await prisma.classSessionChange.create({ data: { courseId: cD.c.id, scheduleId: cD.sch.id, dateKey: yday, kind: "cancel", changedBy: TD.id } });
  const cE = await mkClass(TE, "Em-Địa");                             // TE: buổi hôm qua đã dời sang 3 ngày sau (không còn là buổi hôm qua)
  await prisma.classSessionChange.create({ data: { courseId: cE.c.id, scheduleId: cE.sch.id, dateKey: yday, kind: "move", newDateKey: addDaysKey(vnDateKeyOf(now), 3), newStartTime: "09:00", newEndTime: "10:00", changedBy: TE.id } });
  await mkClass(TG, "Giang-Anh", { classStatus: "closed" });          // TG: lớp đã đóng
  // TF: gia sư không có lớp nào.

  setPushSender(fake);
  const post = (u: TUser, n: string) => api("POST", "/api/push/subscribe", { as: u, body: sub(n) });
  for (const [u, n] of [[TA, "a"], [TB, "b"], [TF, "f"]] as const) await post(u, n);
  await api("PUT", "/api/push/settings", { as: TB, body: { unmarked_daily: true } });
  const quietNow = inQuietHours(vnMinutesOfDay(new Date()));

  section("Cài đặt: loại mới hiện đúng, mặc định TẮT");
  const g = await api("GET", "/api/push/settings", { as: TA });
  check("công tắc unmarked_daily và parent_reported có trong API, mặc định TẮT", g.json.types.unmarked_daily === false && g.json.types.parent_reported === false, g.json.types);
  check("TB đã bật unmarked_daily → API trả BẬT; parent_reported vẫn TẮT", (await api("GET", "/api/push/settings", { as: TB })).json.types.unmarked_daily === true);

  section("Chạy lần 1 (07:00): đúng gia sư, đúng N");
  const r1 = await sendUnmarkedDaily(now);
  check("báo cho đúng 2 gia sư (TA, TB); duyệt 5 gia sư có lớp mở (TG lớp đóng + TF không lớp không bị duyệt)", r1.notified === 2 && r1.alreadySent === 0 && r1.date === yday && r1.tutorsChecked === 5, r1);
  const nA = await notesOf(TA), nB = await notesOf(TB);
  check("TA: đúng 1 thông báo, N = 2 (không cộng buổi tuần trước), đích /lop-cua-toi", nA.length === 1 && /\b2\b/.test(nA[0].message) && nA[0].link === "/lop-cua-toi" && nA[0].isRead === false, nA);
  check("TB: đúng 1 thông báo, N = 1", nB.length === 1 && /\b1\b/.test(nB[0].message));
  const others = await prisma.notification.count({ where: { type: "unmarked_daily", userId: { in: [TC, TD, TE, TF, TG].map(t => t.id) } } });
  check("gia sư đủ điểm danh / buổi huỷ / buổi dời đi / lớp đóng / không có lớp → KHÔNG có thông báo", others === 0, others);
  const all = JSON.stringify(await prisma.notification.findMany({ where: { type: "unmarked_daily" } }));
  check("nội dung thông báo không chứa tên lớp, tên em hay tên gia sư", !/Toán|Lý|Văn|Em của|Cô An|Thầy Bình/.test(all), all);

  section("Đẩy: công tắc, chữ chỉ có N, cô lập");
  await new Promise(r => setTimeout(r, 600));
  const toA = calls.filter(c => c.endpoint === epOf("a")), toB = calls.filter(c => c.endpoint === epOf("b"));
  check("TA để công tắc mặc định (TẮT) → KHÔNG đẩy dù có thông báo trong ứng dụng", toA.length === 0, toA);
  check(`TB bật: ${quietNow ? "đang giờ yên lặng thật → không đẩy" : "ngoài giờ yên lặng → đẩy đúng 1 tin"}; tin tới thiết bị của TB, không tới máy ai khác`,
    toB.length === (quietNow ? 0 : 1) && calls.every(c => c.endpoint !== epOf("f")) && calls.length === toB.length, calls);
  if (!quietNow) {
    check("chữ đẩy của TB: 'Hôm qua có 1 buổi chưa điểm danh'; chỉ có đúng một dãy số là N; không tên", toB[0].payload.title === "Hôm qua có 1 buổi chưa điểm danh" && JSON.stringify(toB[0].payload.title + toB[0].payload.body + toB[0].payload.url).match(/\d+/g)?.join() === "1" && toB[0].payload.url === "/lop-cua-toi", toB[0]);
  }
  calls.length = 0;
  const o7 = await pushToUser(TB.id, "unmarked_daily", { count: 3, now: vn(7, 0) });
  check("giờ yên lặng KHÔNG áp cho tin 07:00: pushToUser lúc đúng 07:00 giờ VN → đẩy, chữ có N = 3", o7.sent === 1 && calls.length === 1 && calls[0].payload.title === "Hôm qua có 3 buổi chưa điểm danh", { o7, calls });
  calls.length = 0;
  const o6 = await pushToUser(TB.id, "unmarked_daily", { count: 3, now: vn(6, 59) });
  check("06:59 giờ VN vẫn là giờ yên lặng → không đẩy", o6.skipped === "quiet-hours" && calls.length === 0);
  const oOff = await pushToUser(TA.id, "unmarked_daily", { count: 2, now: vn(10) });
  check("TA (công tắc TẮT) → 'type-off' ngay cả ban ngày", oOff.skipped === "type-off");
  const oBad = await pushToUser(TB.id, "unmarked_daily", { count: 0, now: vn(10) });
  check("count không hợp lệ (0) → chữ gốc không có số nào (không bao giờ đẩy 'có 0 buổi')", calls.at(-1)?.payload.title === PUSH_DEFS.unmarked_daily.title && oBad.sent === 1, calls.at(-1));
  check("chữ chuẩn của loại không đổi với count hợp lệ ở hàm thuần", pushPayload("unmarked_daily", { count: 3 }).title === "Hôm qua có 3 buổi chưa điểm danh");

  section("Chạy lại trong ngày: không trùng");
  const r2 = await sendUnmarkedDaily(now);
  check("cron chạy lần 2 → 0 mới, 2 đã gửi; vẫn đúng 1 thông báo mỗi gia sư", r2.notified === 0 && r2.alreadySent === 2 && (await notesOf(TA)).length === 1 && (await notesOf(TB)).length === 1, r2);
  const r3 = await sendUnmarkedDaily(new Date(now.getTime() + 3600_000));
  check("chạy lần 3 sau 1 giờ (cùng ngày VN, nếu chưa sang ngày mới) → vẫn không thêm", vnDateKeyOf(new Date(now.getTime() + 3600_000)) !== vnDateKeyOf(now) || (r3.notified === 0 && (await notesOf(TA)).length === 1), r3);
  await prisma.notification.updateMany({ where: { type: "unmarked_daily" }, data: { createdAt: new Date(Date.now() - 26 * 3600_000) } });
  const r4 = await sendUnmarkedDaily(now);
  check("sang NGÀY VN mới (tin cũ từ hôm qua) → gửi lại được: TA và TB lại có tin", r4.notified === 2 && (await notesOf(TA)).length === 2 && (await notesOf(TB)).length === 2, r4);

  section("Cron remind-class (HTTP): gửi cả khi NGÀY MAI không có buổi nào");
  const TH = await mkTutor("Cô Hà");
  await mkClass(TH, "Hà-Sinh");
  const noAuth = await fetch(`${BASE}/api/cron/remind-class`);
  check("không có Bearer CRON_SECRET → 401 (đoạn xác thực nguyên vẹn)", noAuth.status === 401, noAuth.status);
  const cron = await fetch(`${BASE}/api/cron/remind-class`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const cj = await cron.json() as { sent: number; message?: string; unmarked?: { notified: number; alreadySent: number; date: string } };
  check("ngày mai không có buổi nào → vẫn trả 'Không có buổi học nào…' (trường cũ giữ nguyên) và có thêm trường `unmarked`", cron.status === 200 && cj.sent === 0 && /^Không có buổi học nào/.test(cj.message ?? "") && !!cj.unmarked, cj);
  check("`unmarked` cho biết đã báo TH (mới) và 2 người đã gửi trước đó trong ngày", cj.unmarked?.date === yday && cj.unmarked.notified === 1 && cj.unmarked.alreadySent === 2, cj.unmarked);
  await eventually("DB: TH có đúng 1 thông báo unmarked_daily do CRON tạo", async () => (await notesOf(TH)).length === 1);
  const cron2 = await (await fetch(`${BASE}/api/cron/remind-class`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).json() as typeof cj;
  check("gọi cron lần nữa → 0 mới; TH vẫn 1 thông báo", cron2.unmarked?.notified === 0 && (await notesOf(TH)).length === 1, cron2.unmarked);

  setPushSender(null);
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
