// Gia sư dời / huỷ một buổi — API + DB thật: quyền, huỷ, dời, khôi phục, báo nghỉ liên quan, nhắc lịch, lịch học viên / phụ huynh, cron, báo cáo tháng, đồng thời.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey, hmOf, instantOf, addDaysKey } from "@/lib/classSessions";

const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const hex = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
const POST = "/api/tutor/session-changes";

// Khung giờ có buổi bắt đầu cách bây giờ `min` phút.
async function slot(courseId: string, min: number) {
  const t = new Date(Date.now() + min * 60_000);
  const dateKey = vnDateKeyOf(t), m = vnMinutesOfDay(t);
  const sched = await prisma.classSchedule.create({ data: { courseId, dayOfWeek: dayOfWeekOfKey(dateKey), startTime: hmOf(m), endTime: hmOf(Math.min(m + 60, 1439)) } });
  return { sched, dateKey, startAt: instantOf(dateKey, m), startHm: hmOf(m) };
}
const sched = (as: any, from: string, to: string) => api("GET", `/api/tutor/schedule?from=${from}&to=${to}`, { as });
const occOf = (r: any, key: string) => (r.json.occurrences as any[]).find(o => o.key === key);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S1 = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), S3 = await mkUser({ name: "Em Chi" }), STR = await mkUser({ name: "Em Ngoài Lớp" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  const course2 = await mkCourse(T2.id, { name: "Lý 9" });
  await prisma.course.update({ where: { id: course.id }, data: { zaloGroupUrl: "https://zalo.me/g/abcxyz" } });
  for (const s of [S1, S2, S3]) await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } });
  const tok1 = hex(0xa1);
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "PH An" })).id, studentId: S1.id, status: "verified", verifiedAt: new Date(), portalToken: tok1 } });

  const A = await slot(course.id, 3 * 24 * 60);        // buổi của khung A cách 3 ngày
  const A2 = A.sched; const D3 = A.dateKey; const D4 = addDaysKey(D3, 1); const D10 = addDaysKey(D3, 7);
  const X = await slot(course2.id, 3 * 24 * 60);       // khung của gia sư khác
  const P = await slot(course.id, -30);                // buổi đã bắt đầu cách đây 30 phút
  const body = (o: Record<string, unknown>) => ({ scheduleId: A2.id, dateKey: D3, ...o });
  const move = (o: Record<string, unknown> = {}) => ({ kind: "move", newDateKey: D4, newStartTime: "20:30", newEndTime: "22:00", reason: "Trùng lịch thi", ...o });

  section("Quyền");
  check("chưa đăng nhập → 401", (await api("POST", POST, { body: body({ kind: "cancel" }) })).status === 401);
  check("học viên → 401/403", [401, 403].includes((await api("POST", POST, { as: S1, body: body({ kind: "cancel" }) })).status));
  const foreign = await api("POST", POST, { as: T2, body: body({ kind: "cancel" }) });
  check("gia sư KHÁC (không phải chủ lớp) → 404, không ghi gì", foreign.status === 404 && (await prisma.classSessionChange.count()) === 0, foreign.json);
  check("khung giờ của gia sư khác: gia sư này cũng không đổi được", (await api("POST", POST, { as: T, body: { scheduleId: X.sched.id, dateKey: X.dateKey, kind: "cancel" } })).status === 404);
  check("DELETE / zalo cũng cần đăng nhập", (await api("DELETE", `${POST}?scheduleId=${A2.id}&dateKey=${D3}`)).status === 401 && (await api("POST", `${POST}/xyz/zalo`)).status === 401);

  section("Kiểm dữ liệu");
  check("thiếu scheduleId / dateKey sai → 400", (await api("POST", POST, { as: T, body: { kind: "cancel" } })).status === 400 && (await api("POST", POST, { as: T, body: { scheduleId: A2.id, dateKey: "13/10", kind: "cancel" } })).status === 400);
  check("thân không phải JSON → 400", (await api("POST", POST, { as: T, raw: "xx", headers: { "content-type": "application/json" } })).status === 400);
  const wrongDow = await api("POST", POST, { as: T, body: body({ kind: "cancel", dateKey: addDaysKey(D3, 1) }) });
  check("ngày gốc không đúng thứ của khung → 400", wrongDow.status === 400 && /không có buổi học/.test(wrongDow.json.error), wrongDow.json);
  const started = await api("POST", POST, { as: T, body: { scheduleId: P.sched.id, dateKey: P.dateKey, kind: "cancel" } });
  check("buổi đã bắt đầu → 400 'đã bắt đầu hoặc đã qua'", started.status === 400 && /đã bắt đầu hoặc đã qua/.test(started.json.error), started.json);
  check("dời sang ngày học khác của chính khung này → 400", (await api("POST", POST, { as: T, body: body(move({ newDateKey: D10 })) })).status === 400);
  check("dời về quá khứ → 400; thiếu giờ mới → 400", (await api("POST", POST, { as: T, body: body(move({ newDateKey: addDaysKey(vnDateKeyOf(new Date()), -1) })) })).status === 400 && (await api("POST", POST, { as: T, body: body(move({ newStartTime: undefined })) })).status === 400);
  check("sau các lần bị từ chối: chưa ghi gì", (await prisma.classSessionChange.count()) === 0);

  section("Huỷ buổi: báo nghỉ liên quan + thông báo + nhật ký");
  const absPending = await prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: A2.id, dateKey: D3, startAt: A.startAt, studentId: S1.id, reportedBy: "parent", leadMinutes: 60, status: "pending" } });
  const absAuto = await prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: A2.id, dateKey: D3, startAt: A.startAt, studentId: S2.id, reportedBy: "parent", leadMinutes: 300, status: "excused_auto", resolvedAt: new Date() } });
  await prisma.makeupCredit.create({ data: { studentId: S2.id, courseId: course.id, absenceId: absAuto.id, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
  const c = await api("POST", POST, { as: T, body: body({ kind: "cancel", reason: "  Cô   ốm  " }) });
  check("200 + change.kind=cancel + lý do gọn khoảng trắng", c.status === 200 && c.json.change.kind === "cancel" && c.json.change.reason === "Cô ốm" && c.json.change.newDateKey === null, c.json);
  check("tin báo lớp soạn sẵn: có môn, chữ HUỶ, lý do, chữ ký; KHÔNG tên em / link / tiền", c.json.message.includes("Toán 9") && c.json.message.includes("HUỶ") && c.json.message.includes("Lý do: Cô ốm") && c.json.message.includes("Cô Lan") && !/Em An|Em Bình|https?:|đ\b/.test(c.json.message), c.json.message);
  check("trả link nhóm Zalo của lớp để mở đúng nhóm", c.json.zaloGroupUrl === "https://zalo.me/g/abcxyz");
  check("báo nghỉ đang chờ → 'voided' (không tính phí); báo nghỉ đã xử lý (buổi bù) GIỮ NGUYÊN; đếm đúng 1 / 1", c.json.absencesVoided === 1 && c.json.absencesKept === 1 && (await prisma.classAbsence.findUnique({ where: { id: absPending.id } }))?.status === "voided" && (await prisma.classAbsence.findUnique({ where: { id: absAuto.id } }))?.status === "excused_auto" && (await prisma.makeupCredit.count({ where: { absenceId: absAuto.id, status: "active" } })) === 1, c.json);
  check("KHÔNG đụng tiền: không phiếu học phí, không tạo / thu hồi buổi bù", (await prisma.tuitionInvoice.count()) === 0 && (await prisma.makeupCredit.count()) === 1);
  const notes = await prisma.notification.findMany({ where: { type: "class_changed" } });
  check("thông báo trong ứng dụng tới đúng 3 học viên của lớp (không tới em ngoài lớp / gia sư)", c.json.notified === 3 && notes.length === 3 && !notes.some(n => n.userId === STR.id || n.userId === T.id) && /huỷ/.test(notes[0].message) && /Cô ốm/.test(notes[0].message), notes.map(n => n.message));
  check("ghi nhật ký thao tác (class_session.cancel)", (await prisma.auditLog.count({ where: { action: "class_session.cancel", actorId: T.id } })) === 1);

  section("Lịch của gia sư thấy buổi đã huỷ");
  let sc = await sched(T, D3, D3);
  let o = occOf(sc, `${A2.id}:${D3}`);
  check("buổi hiện ở ngày gốc, status cancelled, kèm id thay đổi + lý do, chưa mở Zalo", o?.status === "cancelled" && o.dateKey === D3 && o.change.kind === "cancel" && o.change.reason === "Cô ốm" && o.change.zaloOpenedAt === null && o.originalDateKey === D3, o);
  check("buổi huỷ KHÔNG có tin nhắc nào, không báo nghỉ chờ, không tin tới hạn", o.students.every((s: any) => s.reminders.length === 0) && o.pendingAbsences === 0 && o.remindersDue === 0);
  check("bộ đếm Hộp việc không còn tính báo nghỉ đã huỷ", sc.json.counters.pendingAbsences === 0);
  check("buổi huỷ vẫn liệt kê học viên và trạng thái 'voided' của báo nghỉ", o.students.find((s: any) => s.id === S1.id)?.absence?.status === "voided");

  section("Phụ huynh / học viên thấy buổi đã huỷ");
  const pp = await api("GET", `/api/parent-portal/${tok1}`);
  const up = (pp.json.upcoming as any[]).find(u => u.scheduleId === A2.id);
  check("Sổ của con: buổi hiện với status cancelled + lý do", up?.status === "cancelled" && up.changeReason === "Cô ốm" && up.originalDateKey === D3, up);
  const rep = await api("POST", `/api/parent-portal/${tok1}/absences`, { body: { scheduleId: A2.id, dateKey: D3 } });
  check("phụ huynh KHÔNG báo nghỉ được buổi đã huỷ → 409", rep.status === 409 && /đã huỷ/.test(rep.json.error), rep.json);
  const cal = await api("GET", "/api/schedule", { as: S1 });
  const ev = (cal.json.events as any[]).find(e => e.id === `class-${A2.id}-${D3}`);
  check("lịch học viên: buổi còn đó nhưng ghi '[ĐÃ HUỶ]' ở ngày gốc", ev?.topic.startsWith("[ĐÃ HUỶ]") && ev.isoDate === D3, ev);
  const nudge = await api("POST", "/api/tutor/reminders", { as: T, body: { scheduleId: A2.id, dateKey: D3, studentId: S3.id, recipient: "parent", kind: "h24" } });
  check("ghi 'đã mở Zalo' nhắc lịch cho buổi huỷ → 409 'đã huỷ'", nudge.status === 409 && /huỷ/.test(nudge.json.error), nudge.json);

  section("Đổi từ HUỶ sang DỜI: báo nghỉ chờ được mở lại; xoá mốc đã mở Zalo của tin nhắc");
  await prisma.classReminderLog.create({ data: { courseId: course.id, scheduleId: A2.id, dateKey: D3, studentId: S3.id, recipient: "parent", kind: "h24", tutorId: T.id } });
  const m = await api("POST", POST, { as: T, body: body(move()) });
  check("200 + change.kind=move + giờ mới", m.status === 200 && m.json.change.kind === "move" && m.json.change.newDateKey === D4 && m.json.change.newStartTime === "20:30" && m.json.change.newEndTime === "22:00", m.json);
  check("vẫn CHỈ 1 dòng cho buổi này (cập nhật, không nhân đôi)", (await prisma.classSessionChange.count({ where: { scheduleId: A2.id, dateKey: D3 } })) === 1);
  check("tin báo: DỜI sang 20:30, có lý do 'Trùng lịch thi'", m.json.message.includes("DỜI sang 20:30") && m.json.message.includes("Trùng lịch thi"), m.json.message);
  check("báo nghỉ 'voided' trả về 'pending' để gia sư quyết định lại", (await prisma.classAbsence.findUnique({ where: { id: absPending.id } }))?.status === "pending");
  check("mốc 'Đã mở Zalo' của nhắc lịch buổi này bị xoá (tin mới theo giờ mới sẽ hiện lại)", (await prisma.classReminderLog.count({ where: { scheduleId: A2.id, dateKey: D3 } })) === 0);

  section("Lịch của gia sư thấy buổi đã dời");
  sc = await sched(T, D3, D4);
  o = occOf(sc, `${A2.id}:${D3}`);
  check("buổi hiện ở NGÀY MỚI, status moved, định danh gốc không đổi, có 'dời từ' ngày/giờ cũ", o?.status === "moved" && o.dateKey === D4 && o.originalDateKey === D3 && o.movedFrom.dateKey === D3 && vnHm(o.movedFrom.startAt) === A.startHm, o);
  check("giờ hiệu lực là 20:30–22:00 (đồng hồ VN)", vnHm(o.startAt) === "20:30" && vnHm(o.endAt) === "22:00");
  check("ngày gốc không còn hiện buổi này", !(sc.json.occurrences as any[]).some(x => x.dateKey === D3 && x.scheduleId === A2.id));
  check("cửa sổ chỉ chứa ngày MỚI vẫn thấy; cửa sổ chỉ chứa ngày GỐC thì không", !!occOf(await sched(T, D4, D4), `${A2.id}:${D3}`) && !occOf(await sched(T, D3, D3), `${A2.id}:${D3}`));
  check("báo nghỉ chờ của buổi dời vẫn hiện ở đúng buổi (định danh gốc)", o.pendingAbsences === 1 && o.students.find((s: any) => s.id === S1.id)?.absence?.status === "pending");
  check("kế hoạch nhắc tính theo giờ MỚI: hạn báo nghỉ = 20:30 − 2 giờ = 18:30", vnHm(o.plan.absenceDeadlineAt) === "18:30");

  section("Phụ huynh: báo nghỉ buổi đã dời tính theo giờ MỚI");
  const pp2 = await api("GET", `/api/parent-portal/${tok1}`);
  const up2 = (pp2.json.upcoming as any[]).find(u => u.scheduleId === A2.id);
  check("Sổ của con: status moved, ngày hiệu lực D4, movedFrom D3, vẫn gửi báo nghỉ bằng ngày GỐC", up2?.status === "moved" && up2.dateKey === D4 && up2.originalDateKey === D3 && up2.movedFrom.dateKey === D3 && vnHm(up2.startAt) === "20:30", up2);
  const rep2 = await api("POST", `/api/parent-portal/${tok1}/absences`, { body: { scheduleId: A2.id, dateKey: D3 } });
  // em S1 đã có báo nghỉ ở buổi này (pending, tạo tay) nên báo thêm → 409 trùng; dùng em S3 qua token riêng.
  const tok3 = hex(0xa3);
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "PH Chi" })).id, studentId: S3.id, status: "verified", verifiedAt: new Date(), portalToken: tok3 } });
  const rep3 = await api("POST", `/api/parent-portal/${tok3}/absences`, { body: { scheduleId: A2.id, dateKey: D3 } });
  const abs3 = await prisma.classAbsence.findFirst({ where: { studentId: S3.id, scheduleId: A2.id } });
  check("(báo trùng của em đã có → 409)", rep2.status === 409);
  check("báo nghỉ mới (còn > 2 giờ): startAt lưu = giờ MỚI (D4 20:30), tự giữ buổi bù", rep3.status === 201 && rep3.json.kind === "auto" && abs3?.startAt.getTime() === instantOf(D4, 20 * 60 + 30).getTime(), rep3.json);
  check("điểm danh 'Có phép' ghi vào NGÀY BUỔI THẬT SỰ DIỄN RA (D4), không phải ngày gốc D3", !!(await prisma.attendanceSession.findFirst({ where: { courseId: course.id, date: new Date(`${D4}T00:00:00Z`) } })) && !(await prisma.attendanceSession.findFirst({ where: { courseId: course.id, date: new Date(`${D3}T00:00:00Z`) } })));
  const cal2 = await api("GET", "/api/schedule", { as: S1 });
  const ev2 = (cal2.json.events as any[]).find(e => e.id === `class-${A2.id}-${D3}`);
  check("lịch học viên: buổi ở ngày MỚI, giờ 20:30, ghi '[DỜI từ dd/mm]'", ev2?.isoDate === D4 && ev2.time === "20:30" && ev2.topic.startsWith(`[DỜI từ ${D3.slice(8, 10)}/${D3.slice(5, 7)}]`), ev2);
  check("lịch học viên không còn buổi ở ngày gốc", !(cal2.json.events as any[]).some(e => e.id === `class-${A2.id}-${D3}` && e.isoDate === D3));

  section("Xung đột khi dời + đồng thời");
  const clash = await api("POST", POST, { as: T, body: { scheduleId: A2.id, dateKey: D10, kind: "move", newDateKey: D4, newStartTime: "20:30" } });
  check("buổi khác của CÙNG khung dời tới ngày đã có buổi dời → 409", clash.status === 409 && /đã có một buổi khác/i.test(clash.json.error), clash.json);
  const [c1, c2] = await Promise.all([
    api("POST", POST, { as: T, body: { scheduleId: A2.id, dateKey: D10, kind: "move", newDateKey: addDaysKey(D10, 1), newStartTime: "19:00" } }),
    api("POST", POST, { as: T, body: { scheduleId: A2.id, dateKey: addDaysKey(D10, 7), kind: "move", newDateKey: addDaysKey(D10, 1), newStartTime: "19:00" } }),
  ]);
  check("hai buổi cùng dời tới MỘT ngày cùng lúc: đúng 1 thành công, 1 bị 409 (khoá theo khung giờ)", [c1.status, c2.status].sort().join() === "200,409", [c1.status, c2.status]);
  const many = await Promise.all(Array.from({ length: 5 }, () => api("POST", POST, { as: T, body: { scheduleId: A2.id, dateKey: D3, kind: "cancel" } })));
  check("5 lần bấm Huỷ cùng lúc: đều 200 và vẫn chỉ 1 dòng", many.every(r => r.status === 200) && (await prisma.classSessionChange.count({ where: { scheduleId: A2.id, dateKey: D3 } })) === 1, many.map(r => r.status));

  section("Ghi nhận 'Đã mở Zalo' (không bao giờ 'đã gửi')");
  const chg = await prisma.classSessionChange.findFirst({ where: { scheduleId: A2.id, dateKey: D3 } });
  const z1 = await api("POST", `${POST}/${chg!.id}/zalo`, { as: T });
  const z2 = await api("POST", `${POST}/${chg!.id}/zalo`, { as: T });
  check("200 + openedAt; gọi lại giữ nguyên lần đầu", z1.status === 200 && z2.json.openedAt === z1.json.openedAt, [z1.json, z2.json]);
  check("gia sư khác → 404; học viên → chặn; id lạ → 404", (await api("POST", `${POST}/${chg!.id}/zalo`, { as: T2 })).status === 404 && [401, 403].includes((await api("POST", `${POST}/${chg!.id}/zalo`, { as: S1 })).status) && (await api("POST", `${POST}/khong-co/zalo`, { as: T })).status === 404);
  sc = await sched(T, D3, D3);
  check("lịch hiện mốc 'đã mở Zalo'", !!occOf(sc, `${A2.id}:${D3}`).change.zaloOpenedAt);
  await api("POST", POST, { as: T, body: body({ kind: "cancel", reason: "Đổi ý" }) });
  check("đổi lại thay đổi → mốc 'đã mở Zalo' được xoá (tin cũ không còn đúng)", (await prisma.classSessionChange.findFirst({ where: { scheduleId: A2.id, dateKey: D3 } }))?.zaloOpenedAt === null);

  section("Khôi phục");
  const restore = (as: any, sid: string, dk: string) => api("DELETE", `${POST}?scheduleId=${sid}&dateKey=${dk}`, { as });
  const rs = await restore(T, A2.id, D3);
  check("200 + tin 'GIỮ NGUYÊN lịch' + link nhóm; dòng bị xoá", rs.status === 200 && rs.json.message.includes("GIỮ NGUYÊN") && rs.json.zaloGroupUrl === "https://zalo.me/g/abcxyz" && (await prisma.classSessionChange.count({ where: { scheduleId: A2.id, dateKey: D3 } })) === 0, rs.json);
  check("khôi phục buổi từ trạng thái HUỶ: báo nghỉ 'voided' mở lại thành 'pending'", rs.json.reopened >= 0 && (await prisma.classAbsence.findUnique({ where: { id: absPending.id } }))?.status === "pending");
  sc = await sched(T, D3, D4);
  o = occOf(sc, `${A2.id}:${D3}`);
  check("lịch: buổi trở về ngày gốc, status scheduled, không có thay đổi", o?.status === "scheduled" && o.dateKey === D3 && o.change === null && o.movedFrom === null);
  check("khôi phục buổi không có thay đổi → 404; của gia sư khác → 404; thiếu tham số → 400", (await restore(T, A2.id, D3)).status === 404 && (await restore(T2, A2.id, D3)).status === 404 && (await api("DELETE", POST, { as: T })).status === 400);
  await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: P.sched.id, dateKey: P.dateKey, kind: "cancel", changedBy: T.id } });
  const late = await restore(T, P.sched.id, P.dateKey);
  check("buổi có giờ gốc ĐÃ QUA → không khôi phục được (409)", late.status === 409 && /đã qua/.test(late.json.error), late.json);
  check("có nhật ký khôi phục", (await prisma.auditLog.count({ where: { action: "class_session.restore" } })) === 1);

  section("Nhắc lịch của ngày mai (cron) bỏ buổi huỷ, theo giờ mới của buổi dời");
  const tomorrow = addDaysKey(vnDateKeyOf(new Date()), 1);
  const cc = await mkCourse(T.id, { name: "Hoá 9" });
  const c3 = await mkCourse(T.id, { name: "Sử 9" });
  const cm = await mkCourse(T.id, { name: "Địa 9" });
  const stu = await mkUser({ name: "Em Cron" }), stu2 = await mkUser({ name: "Em Vắng" });
  for (const cr of [cc, c3, cm]) for (const s of [stu, stu2]) await prisma.enrollment.create({ data: { userId: s.id, courseId: cr.id, status: "active" } });
  const tdow = dayOfWeekOfKey(tomorrow);
  const rN = await prisma.classSchedule.create({ data: { courseId: cc.id, dayOfWeek: tdow, startTime: "18:00", endTime: "19:00" } });
  const rC = await prisma.classSchedule.create({ data: { courseId: c3.id, dayOfWeek: tdow, startTime: "18:00", endTime: "19:00" } });
  const dayAfter = addDaysKey(tomorrow, 1); // "ngày kia": buổi gốc của Địa 9 nằm ở đây rồi được dời VÀO ngày mai
  const rM = await prisma.classSchedule.create({ data: { courseId: cm.id, dayOfWeek: dayOfWeekOfKey(dayAfter), startTime: "16:00", endTime: "17:00" } });
  const cron = async () => { await prisma.notification.deleteMany({ where: { type: "class_reminder" } }); const r = await api("GET", "/api/cron/remind-class"); const n = await prisma.notification.findMany({ where: { type: "class_reminder" } }); return { r, n }; };
  let run = await cron();
  check("khi chưa có thay đổi: Hoá + Sử đều được nhắc lúc 18:00 (2 học viên mỗi lớp)", run.r.status === 200 && run.n.filter(x => /Hoá 9|Sử 9/.test(x.message) && x.message.includes("18:00")).length === 4, run.n.map(x => x.message));
  await api("POST", POST, { as: T, body: { scheduleId: rC.id, dateKey: tomorrow, kind: "cancel" } });
  run = await cron();
  check("Sử 9 bị HUỶ → không còn tin nhắc cho lớp này; Hoá 9 vẫn nhắc", !run.n.some(x => x.message.includes("Sử 9")) && run.n.filter(x => x.message.includes("Hoá 9")).length === 2, run.n.map(x => x.message));
  await api("POST", POST, { as: T, body: { scheduleId: rN.id, dateKey: tomorrow, kind: "move", newDateKey: addDaysKey(tomorrow, 1), newStartTime: "18:00" } });
  run = await cron();
  check("Hoá 9 bị DỜI sang ngày kia → không nhắc ngày mai", !run.n.some(x => x.message.includes("Hoá 9")), run.n.map(x => x.message));
  await api("POST", POST, { as: T, body: { scheduleId: rN.id, dateKey: tomorrow, kind: "move", newDateKey: tomorrow, newStartTime: "17:15", newEndTime: "18:15" } });
  run = await cron();
  check("Hoá 9 đổi giờ TRONG NGÀY mai (17:15) → nhắc theo giờ MỚI 17:15", run.n.filter(x => x.message.includes("Hoá 9") && x.message.includes("17:15")).length === 2 && !run.n.some(x => x.message.includes("Hoá 9") && x.message.includes("18:00")), run.n.map(x => x.message));
  const mvIn = await api("POST", POST, { as: T, body: { scheduleId: rM.id, dateKey: dayAfter, kind: "move", newDateKey: tomorrow, newStartTime: "07:45", newEndTime: "08:45" } });
  check("dời buổi của ngày kia VÀO ngày mai được chấp nhận (khác thứ của khung)", mvIn.status === 200, mvIn.json);
  run = await cron();
  check("Địa 9 có ngày gốc là ngày KIA nhưng được dời VÀO ngày mai → nhắc lúc 07:45", run.n.filter(x => x.message.includes("Địa 9") && x.message.includes("07:45")).length === 2, run.n.map(x => x.message));
  await prisma.classAbsence.create({ data: { courseId: cm.id, scheduleId: rM.id, dateKey: dayAfter, startAt: instantOf(tomorrow, 7 * 60 + 45), studentId: stu2.id, reportedBy: "parent", leadMinutes: 600, status: "excused_auto" } });
  run = await cron();
  check("em đã báo nghỉ (khoá theo ngày GỐC) không bị nhắc buổi dời; em còn lại vẫn được nhắc", run.n.filter(x => x.message.includes("Địa 9")).length === 1 && run.n.find(x => x.message.includes("Địa 9"))!.userId === stu.id, run.n.map(x => [x.userId, x.message]));

  section("Báo cáo tháng: dòng gợi ý loại 4 có dữ liệu thật");
  const ym = vnDateKeyOf(new Date()).slice(0, 7);
  await prisma.classSessionChange.deleteMany({});
  await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: A2.id, dateKey: `${ym}-03`, kind: "cancel", changedBy: T.id } });
  await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: A2.id, dateKey: `${ym}-10`, kind: "move", newDateKey: `${ym}-11`, newStartTime: "19:00", changedBy: T.id } });
  await prisma.classSessionChange.create({ data: { courseId: course2.id, scheduleId: X.sched.id, dateKey: `${ym}-05`, kind: "cancel", changedBy: T2.id } });
  const prevYm = (() => { const y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7)); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; })();
  await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: A2.id, dateKey: `${prevYm}-20`, kind: "cancel", changedBy: T.id } });
  const rep4 = await api("GET", `/api/tutor/monthly-reports/${S1.id}?yearMonth=${ym}`, { as: T });
  const items = (rep4.json.suggested as { kind: string; text: string }[]).filter(i => i.kind === "doi-buoi");
  check("báo cáo tháng này của em: 2 dòng 'doi-buoi' (huỷ 03/MM + dời 10/MM) — không lấy lớp của gia sư khác, không lấy tháng trước", rep4.status === 200 && items.length === 2 && items[0].text.includes(`03/${ym.slice(5, 7)}`) && items[0].text.includes("huỷ") && items[1].text.includes(`10/${ym.slice(5, 7)}`) && items[1].text.includes("dời") && items.every(i => i.text.includes("Toán 9") && i.text.includes("không phải của em")), items);
  check("văn bản báo cáo có các dòng này trong mục 'Điều chưa đạt'", rep4.json.text.includes("Điều chưa đạt tháng này") && rep4.json.text.includes("gia sư huỷ"));
  const prevRep = await api("GET", `/api/tutor/monthly-reports/${S1.id}?yearMonth=${prevYm}`, { as: T });
  check("tháng trước: chỉ có dòng của tháng trước", (prevRep.json.suggested as any[]).filter(i => i.kind === "doi-buoi").length === 1);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
