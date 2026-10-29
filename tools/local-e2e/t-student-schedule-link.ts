// Lịch học của học sinh phải khớp MỌI buổi của lớp em đang học: API thật + Postgres thật.
// Trước đây /api/schedule chỉ khai triển khung giờ tuần: buổi lẻ / dạy bù / phát sinh gia sư thêm (thấy ở Lịch của gia sư) không bao giờ tới học sinh,
// buổi không mang link vào lớp / hình thức / địa chỉ, và gia sư thêm buổi cũng không báo ai. Phủ ở đây:
//   A. buổi lẻ / bù / phát sinh có trong lịch (giờ, loại, tên "— Dạy bù"), đúng cửa sổ 90 ngày; B. link vào lớp ưu tiên riêng-buổi > khung giờ > chung lớp,
//   học trực tiếp thì không có link online, buổi huỷ không có link, buổi dời lấy ghi đè theo NGÀY MỚI; C. chỉ học sinh ĐANG HỌC lớp đó nhận link / buổi
//   (chờ đồng ý, tạm dừng, người ngoài, lớp của gia sư khác không lọt); D. gia sư thêm buổi → học sinh đang học nhận thông báo (không tên người), người khác không;
//   E. cron nhắc buổi ngày mai nhắc cả buổi lẻ / bù; F. "Sổ của con" của phụ huynh có danh sách buổi thêm (chỉ đọc), không lẫn lớp khác; G. "Việc của tôi" cùng nguồn.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { generatePortalToken } from "@/lib/parentPortal";

const dayDate = (k: string) => new Date(`${k}T00:00:00Z`);
const J = (x: unknown) => JSON.stringify(x) ?? ""; // undefined → "" (mã cũ thiếu trường thì bài đỏ chứ không văng lỗi)

(async () => {
  await wipe();
  const today = vnDateKeyOf(new Date());
  const at = (n: number) => addDaysKey(today, n);
  const dow = (n: number) => dayOfWeekOfKey(at(n));

  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S = await mkUser({ name: "Học sinh Đang Học" }), P = await mkUser({ name: "Em Chờ Đồng Ý" }), SUS = await mkUser({ name: "Em Tạm Dừng" });
  const OUT = await mkUser({ name: "Người Ngoài Lớp" }), S2 = await mkUser({ name: "Em Lớp Khác" });
  const C1 = await mkCourse(T.id, { name: "Toán 9" }), C4 = await mkCourse(T2.id, { name: "Hoá 9" });
  const CLASS_URL = "https://meet.example.com/chung-lop-c1", RULE_A_URL = "https://meet.example.com/khung-gio-a", OVR_URL = "https://meet.example.com/rieng-buoi";
  const OTHER_URL = "https://meet.example.com/LOP-KHAC", OTHER_BU = "https://meet.example.com/BU-LOP-KHAC";
  await prisma.course.update({ where: { id: C1.id }, data: { classJoinUrl: CLASS_URL } });
  for (const [u, st] of [[S, "active"], [P, "pending_consent"], [SUS, "suspended"]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: C1.id, status: st } });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: C4.id } });

  // Khung giờ tuần của Toán 9: A (có link riêng, online) thứ của +2 ngày; B (không link, không hình thức) thứ của +3 ngày.
  const A = await prisma.classSchedule.create({ data: { courseId: C1.id, dayOfWeek: dow(2), startTime: "19:00", endTime: "20:30", mode: "online", joinUrl: RULE_A_URL } });
  const B = await prisma.classSchedule.create({ data: { courseId: C1.id, dayOfWeek: dow(3), startTime: "18:00", endTime: "19:00" } });
  await prisma.classSchedule.create({ data: { courseId: C4.id, dayOfWeek: dow(2), startTime: "08:00", endTime: "09:00", joinUrl: OTHER_URL } });
  await prisma.attendanceSession.create({ data: { courseId: C4.id, date: dayDate(at(8)), createdBy: T2.id, kind: "makeup", startTime: "10:00", endTime: "11:00", mode: "online", joinUrl: OTHER_BU } });

  // Ghi đè theo buổi trên buổi theo lịch tuần: A ngày +2 chuyển sang học trực tiếp; B ngày +3 có link riêng buổi.
  await prisma.attendanceSession.create({ data: { courseId: C1.id, date: dayDate(at(2)), createdBy: T.id, mode: "offline", location: "Phòng 3, tầng 2" } });
  await prisma.attendanceSession.create({ data: { courseId: C1.id, date: dayDate(at(3)), createdBy: T.id, joinUrl: OVR_URL } });
  // B ngày +10 bị huỷ; B ngày +17 dời sang +18 lúc 10:00–11:00 và buổi mới có link riêng.
  await prisma.classSessionChange.create({ data: { courseId: C1.id, scheduleId: B.id, dateKey: at(10), kind: "cancel", changedBy: T.id } });
  await prisma.classSessionChange.create({ data: { courseId: C1.id, scheduleId: B.id, dateKey: at(17), kind: "move", newDateKey: at(18), newStartTime: "10:00", newEndTime: "11:00", changedBy: T.id } });
  await prisma.attendanceSession.create({ data: { courseId: C1.id, date: dayDate(at(18)), createdBy: T.id, joinUrl: "https://meet.example.com/ngay-moi" } });

  // Gia sư thêm buổi qua API thật.
  const post = (body: object) => api("POST", `/api/courses/${C1.id}/sessions`, { as: T, body });
  const mk = await post({ dateKey: at(4), startTime: "16:00", endTime: "17:00", kind: "makeup", mode: "online", joinUrl: "https://meet.example.com/bu-rieng" });
  const ex = await post({ dateKey: at(5), startTime: "09:00", endTime: "10:30", kind: "extra", mode: "offline", location: "12 Nguyễn Trãi" });
  const ad = await post({ dateKey: at(6), startTime: "20:00", endTime: "21:00", kind: "adhoc" });
  // Ngoài cửa sổ / ranh giới: quá khứ, +90 (còn trong), +91 (ngoài).
  for (const [n, t] of [[-1, "07:00"], [90, "07:00"], [91, "07:00"]] as const) await prisma.attendanceSession.create({ data: { courseId: C1.id, date: dayDate(at(n)), createdBy: T.id, kind: "extra", startTime: t, endTime: "08:00" } });

  const sched = async (u: typeof S) => (await api("GET", "/api/schedule", { as: u })).json.events as any[];
  const ev = await sched(S);
  const on = (k: string) => ev.filter(e => e.type === "class" && e.isoDate === k);

  section("Tạo buổi qua API gia sư");
  check("buổi bù / buổi lẻ / phát sinh đều tạo được (201)", mk.status === 201 && ex.status === 201 && ad.status === 201, [mk.status, ex.status, ad.status]);
  check("phản hồi cho gia sư biết đã báo cho 1 học sinh đang học (không tính em chờ đồng ý / tạm dừng)", mk.json?.notified === 1 && ex.json?.notified === 1, [mk.json, ex.json]);

  section("A. Buổi lẻ / dạy bù / phát sinh có trong Lịch của học sinh");
  const mkE = on(at(4))[0], exE = on(at(5))[0], adE = on(at(6))[0];
  check("buổi dạy bù: đúng ngày, giờ 16:00–17:00, loại 'makeup', tên '— Dạy bù', đúng lớp", !!mkE && mkE.time === "16:00" && mkE.endTime === "17:00" && mkE.sessionKind === "makeup" && mkE.topic === "Toán 9 — Dạy bù" && mkE.courseId === C1.id, mkE);
  check("buổi lẻ 09:00–10:30 và buổi phát sinh 20:00–21:00 có mặt, đúng loại", exE?.sessionKind === "extra" && exE.endTime === "10:30" && exE.topic === "Toán 9 — Buổi lẻ" && adE?.sessionKind === "adhoc" && adE.topic === "Toán 9 — Phát sinh", [exE, adE]);
  check("nút 'vào lớp' vẫn trỏ trang lớp trong ứng dụng (link cũ giữ nguyên)", mkE?.link === `/student/hoc-tap?course=${C1.id}`, mkE?.link);
  check("buổi theo lịch tuần vẫn còn và đánh dấu 'regular'", on(at(2)).some(e => e.sessionKind === "regular" && e.time === "19:00") && on(at(3)).some(e => e.sessionKind === "regular" && e.time === "18:00"));
  check("sắp xếp theo ngày rồi giờ", ev.every((e, i) => i === 0 || (ev[i - 1].isoDate + ev[i - 1].time) <= (e.isoDate + e.time)));
  check("buổi ở quá khứ (hôm qua) không hiện", on(at(-1)).length === 0);
  check("buổi ngày +90 còn trong cửa sổ, ngày +91 thì không", on(at(90)).some(e => e.sessionKind === "extra") && on(at(91)).length === 0);

  section("B. Link vào lớp, hình thức, địa chỉ");
  check("buổi dạy bù: link RIÊNG buổi, online", mkE?.joinUrl === "https://meet.example.com/bu-rieng" && mkE.mode === "online" && mkE.location === undefined, mkE);
  check("buổi lẻ học trực tiếp: có địa chỉ, KHÔNG có link online (dù lớp có link chung)", exE?.mode === "offline" && exE.location === "12 Nguyễn Trãi" && exE.joinUrl === undefined, exE);
  check("buổi phát sinh không chọn hình thức → rơi xuống link CHUNG của lớp", adE?.joinUrl === CLASS_URL && adE.mode === undefined, adE);
  const a2 = on(at(2)).find(e => e.time === "19:00"), a9 = on(at(9)).find(e => e.time === "19:00");
  check("khung giờ A ngày +2 bị ghi đè riêng buổi sang học trực tiếp → trực tiếp + 'Phòng 3, tầng 2', không link", a2?.mode === "offline" && a2.location === "Phòng 3, tầng 2" && a2.joinUrl === undefined, a2);
  check("khung giờ A tuần sau (không ghi đè) → link CỦA KHUNG GIỜ, online", a9?.joinUrl === RULE_A_URL && a9.mode === "online", a9);
  const b3 = on(at(3)).find(e => e.time === "18:00"), b10 = ev.find(e => e.isoDate === at(10) && e.time === "18:00");
  check("khung giờ B ngày +3 có link riêng buổi → link riêng buổi thắng link chung của lớp", b3?.joinUrl === OVR_URL, b3);
  check("buổi bị huỷ: vẫn hiện '[ĐÃ HUỶ]' nhưng KHÔNG có link, hình thức, địa chỉ", !!b10 && b10.topic.startsWith("[ĐÃ HUỶ]") && b10.joinUrl === undefined && b10.mode === undefined && b10.location === undefined, b10);
  const moved = ev.find(e => e.isoDate === at(18) && e.time === "10:00"), movedOld = ev.find(e => e.isoDate === at(17) && e.time === "18:00");
  check("buổi dời sang +18: hiện ở NGÀY MỚI, lấy ghi đè (link riêng) của ngày mới, kèm '[DỜI từ …]'", !!moved && moved.topic.startsWith("[DỜI từ") && moved.joinUrl === "https://meet.example.com/ngay-moi", moved);
  check("ngày gốc +17 không còn buổi B", movedOld === undefined, movedOld);
  check("không link nào ngoài http/https lọt vào lịch", ev.filter(e => e.joinUrl).every(e => /^https?:\/\//.test(e.joinUrl)));

  section("C. Chỉ học sinh ĐANG HỌC lớp đó mới nhận buổi và link");
  for (const [u, why] of [[P, "đang chờ đồng ý"], [SUS, "tạm dừng"], [OUT, "không ghi danh"]] as const) {
    const list = await sched(u);
    check(`học sinh ${why}: không có buổi học nào, không lộ link/tên lớp`, list.filter(e => e.type === "class").length === 0 && !J(list).includes("meet.example.com") && !J(list).includes("Toán 9"), list.filter(e => e.type === "class").slice(0, 2));
  }
  check("học sinh trong lớp KHÔNG thấy link / buổi bù của lớp gia sư khác", !J(ev).includes("LOP-KHAC") && !J(ev).includes("Hoá 9"));
  const ev2 = await sched(S2);
  check("học sinh lớp khác thấy link khung giờ + buổi bù CỦA LỚP MÌNH, không thấy link lớp Toán 9", J(ev2).includes(OTHER_URL) && ev2.some(e => e.isoDate === at(8) && e.sessionKind === "makeup" && e.joinUrl === OTHER_BU) && !J(ev2).includes("meet.example.com/chung-lop-c1") && !J(ev2).includes("Toán 9"));
  check("chưa đăng nhập → 401", (await api("GET", "/api/schedule")).status === 401);

  section("D. Gia sư thêm buổi → học sinh đang học nhận thông báo");
  const nS = await prisma.notification.findMany({ where: { userId: S.id, type: "class_changed" }, orderBy: { createdAt: "asc" } });
  check("3 thông báo (bù, lẻ, phát sinh) tới học sinh đang học, trỏ về trang Lịch", nS.length === 3 && nS.every(n => n.link === "/student/lich-hoc"), nS.map(n => n.title));
  const nMk = nS.find(n => n.title === "Có buổi dạy bù");
  const d4 = at(4);
  check("nội dung có tên lớp, ngày dd/mm, giờ — KHÔNG có tên gia sư / học sinh / tiền", nMk?.message === `Lớp "Toán 9" có buổi dạy bù ngày ${d4.slice(8, 10)}/${d4.slice(5, 7)} lúc 16:00.` && !/Lan|Học sinh|đồng|₫|VND/i.test(nMk?.message ?? ""), nMk?.message);
  for (const [u, why] of [[P, "chờ đồng ý"], [SUS, "tạm dừng"], [OUT, "ngoài lớp"], [S2, "lớp khác"]] as const) {
    check(`học sinh ${why} không nhận thông báo`, (await prisma.notification.count({ where: { userId: u.id, type: "class_changed" } })) === 0);
  }
  const bad = await post({ dateKey: at(4), startTime: "25:00", endTime: "26:00", kind: "makeup" });
  check("yêu cầu sai (400) thì không có thông báo nào thêm", bad.status === 400 && (await prisma.notification.count({ where: { userId: S.id, type: "class_changed" } })) === 3, bad.json);

  section("E. Cron nhắc lịch: buổi lẻ / bù ngày mai cũng được nhắc");
  const tm = await post({ dateKey: at(1), startTime: "17:30", endTime: "18:30", kind: "makeup", force: true });
  check("gia sư thêm buổi bù cho NGÀY MAI", tm.status === 201, tm.json);
  const before = await prisma.notification.count({ where: { userId: S.id, type: "class_reminder" } });
  const cron = await api("GET", "/api/cron/remind-class", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check("cron chạy được (200) và báo đã xử lý lớp Toán 9", cron.status === 200 && (cron.json?.schedules ?? []).some((l: string) => l.startsWith("Toán 9:")), cron.json);
  const rem = await prisma.notification.findMany({ where: { userId: S.id, type: "class_reminder" } });
  check("học sinh đang học nhận ĐÚNG 1 nhắc cho buổi bù ngày mai, có tên lớp và giờ, link về trang lớp", before === 0 && rem.length === 1 && rem[0].message.includes('"Toán 9"') && rem[0].message.includes("17:30") && rem[0].link === `/student/hoc-tap?course=${C1.id}`, rem);
  for (const [u, why] of [[P, "chờ đồng ý"], [SUS, "tạm dừng"], [OUT, "ngoài lớp"], [S2, "lớp khác"]] as const) {
    check(`học sinh ${why} không nhận nhắc`, (await prisma.notification.count({ where: { userId: u.id, type: "class_reminder" } })) === 0);
  }

  section("F. 'Sổ của con' (phụ huynh): danh sách buổi thêm, chỉ đọc");
  const parent = await mkUser({ name: "Phụ Huynh" }), parentOut = await mkUser({ name: "Phụ Huynh Ngoài" });
  const tok = generatePortalToken(), tokOut = generatePortalToken();
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: S.id, status: "verified", verifiedAt: new Date(), portalToken: tok } });
  await prisma.parentLink.create({ data: { parentId: parentOut.id, studentId: OUT.id, status: "verified", verifiedAt: new Date(), portalToken: tokOut } });
  const pp = await api("GET", `/api/parent-portal/${tok}`), ppOut = await api("GET", `/api/parent-portal/${tokOut}`);
  const x = (pp.json?.extra ?? []) as any[];
  check("cổng phụ huynh trả 200 kèm danh sách `extra`", pp.status === 200 && Array.isArray(pp.json?.extra), pp.status);
  check("có buổi dạy bù ngày mai, buổi bù +4, buổi lẻ +5, phát sinh +6 (trong 14 ngày), đúng thứ tự giờ", x.map(i => i.dateKey).join() === [at(1), at(4), at(5), at(6)].join(), x.map(i => i.dateKey));
  check("hình thức / địa chỉ hiện cho phụ huynh: 'Online', 'Offline · 12 Nguyễn Trãi', phát sinh chưa chọn → null", x.find(i => i.dateKey === at(4))?.place === "Online" && x.find(i => i.dateKey === at(5))?.place === "Offline · 12 Nguyễn Trãi" && x.find(i => i.dateKey === at(6))?.place === null, x.map(i => i.place));
  check("phụ huynh KHÔNG nhận link học online của lớp (chỉ học sinh)", !J(pp.json?.extra).includes("meet.example.com") && !J(x).includes("joinUrl"));
  check("buổi theo lịch tuần vẫn có nút báo nghỉ như cũ: `upcoming` còn scheduleId", (pp.json?.upcoming ?? []).length > 0 && pp.json.upcoming.every((u: any) => typeof u.scheduleId === "string"), pp.json?.upcoming?.[0]);
  check("phụ huynh của em ngoài lớp: `extra` rỗng, không lộ lớp Toán 9", ppOut.status === 200 && (ppOut.json?.extra ?? []).length === 0 && !J(ppOut.json).includes("Toán 9"), ppOut.json?.extra);

  section("G. 'Việc của tôi' cùng nguồn với Lịch (chỉ hiện buổi trong 3 ngày tới)");
  // Lớp riêng cho phần này: buổi ở +2 / +3 ngày; lớp Toán 9 đã có bản ghi buổi ở hai ngày đó (mỗi lớp mỗi ngày một bản ghi).
  const C5 = await mkCourse(T.id, { name: "Văn 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C5.id } });
  const postC5 = (body: object) => api("POST", `/api/courses/${C5.id}/sessions`, { as: T, body });
  const g1 = await postC5({ dateKey: at(2), startTime: "16:30", endTime: "17:30", kind: "makeup", mode: "online", joinUrl: "https://meet.example.com/bu-g" });
  const g2 = await postC5({ dateKey: at(3), startTime: "08:00", endTime: "09:00", kind: "extra", mode: "offline", location: "Phòng 5" });
  check("thêm hai buổi cho lớp Văn 9 (201)", g1.status === 201 && g2.status === 201, [g1.json, g2.json]);
  const todo = await api("GET", "/api/student/viec-cua-toi", { as: S });
  const sessions = ((todo.json?.items ?? []) as any[]).filter(i => i.kind === "buoi-hoc" && i.session?.courseLine === "Văn 9");
  const bu = sessions.find(i => i.session.topic === "Dạy bù"), exOff = sessions.find(i => i.session.topic === "Buổi lẻ");
  check("buổi dạy bù có trong Việc của tôi, kèm hình thức và nút link học online (mở tab ngoài)", !!bu && bu.session.place === "Online" && bu.session.joinUrl === "https://meet.example.com/bu-g" && bu.detail.commands.some((c: any) => c.label === "Mở link học online" && c.external === true && c.href === "https://meet.example.com/bu-g"), bu);
  check("'Vào lớp' vẫn là lệnh đầu tiên (không bị link online chen lên trước)", bu?.detail.commands[0]?.label === "Vào lớp" && bu.detail.commands[0].href === `/student/hoc-tap?course=${C5.id}`, bu?.detail.commands);
  check("buổi lẻ học trực tiếp hiện địa chỉ và KHÔNG có nút link online", !!exOff && exOff.session.place === "Offline · Phòng 5" && exOff.session.joinUrl === undefined && !exOff.detail.commands.some((c: any) => c.label === "Mở link học online"), exOff);
  check("buổi ngoài 3 ngày tới (buổi bù +4 của Toán 9) không có trong Việc của tôi nhưng vẫn có trong Lịch", !((todo.json?.items ?? []) as any[]).some(i => i.session?.topic === "Dạy bù" && i.session?.courseLine === "Toán 9" && i.session.range.startsWith("16:00")) && on(at(4)).length === 1);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
