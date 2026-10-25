// Hồ sơ học sinh nhiều tab + đổi trạng thái Đã nghỉ + link báo cáo riêng + thêm học sinh vào lớp (HS-01/02/06/08/09, DD-07, LO-03/09/13) — API thật.
// Quyền: chưa đăng nhập 401; học sinh / phụ huynh 403; gia sư B 403 với em của A; không có 404. Dữ liệu trẻ đi qua maskProfile. Log chỉ có id.
// Chạy (máy chủ dev bật ở BASE): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tutor-student-detail.ts
import { prisma } from "@/lib/prisma";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const stamp = Date.now().toString(36);
const NAME1 = `TENTRE1${stamp}`, NAME2 = `TENTRE2${stamp}`;
const day = (daysAgo: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - daysAgo * 86_400_000); };

(async () => {
  await wipe();
  const A = await mkTutor("Gia sư A"), B = await mkTutor("Gia sư B");
  const cA = await mkCourse(A.id, { name: "Toán 9" }), cA2 = await mkCourse(A.id, { name: "Lý 9" }), cB = await mkCourse(B.id, { name: "Văn 9 của B" });
  const S1 = await mkUser({ name: NAME1 }), S2 = await mkUser({ name: NAME2 }), S3 = await mkUser({ name: "Em của B" }), STR = await mkUser({ name: "Người lạ" });
  const PAR1 = await mkUser({ name: "Phụ huynh 1" }), PAR3 = await mkUser({ name: "Phụ huynh 3" });
  for (const [u, c] of [[S1, cA], [S2, cA], [S3, cB], [S2, cA2]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  const link1 = await prisma.parentLink.create({ data: { parentId: PAR1.id, studentId: S1.id, status: "verified", verifiedAt: new Date() } });
  const link3 = await prisma.parentLink.create({ data: { parentId: PAR3.id, studentId: S3.id, status: "verified", verifiedAt: new Date() } });
  const pend = await mkUser({ name: "Em chờ đồng ý" });
  await prisma.enrollment.create({ data: { userId: pend.id, courseId: cA.id, status: "pending_consent" } });

  section("Đăng nhập và vai");
  const D = (id: string) => `/api/tutor/hoc-sinh/${id}`;
  check("chưa đăng nhập → 401 (chi tiết, trạng thái, link)", (await api("GET", D(S1.id))).status === 401 && (await api("POST", `${D(S1.id)}/trang-thai`, { body: { status: "suspended" } })).status === 401 && (await api("POST", `${D(S1.id)}/bao-cao-link`, { body: { linkId: link1.id } })).status === 401);
  check("học sinh → 403", (await api("GET", D(S1.id), { as: S1 })).status === 403 && (await api("POST", `${D(S1.id)}/trang-thai`, { as: S1, body: { status: "suspended" } })).status === 403);
  check("phụ huynh (tài khoản học sinh có liên kết) → 403, không tự bật/thu hồi link", (await api("POST", `${D(S1.id)}/bao-cao-link`, { as: PAR1, body: { linkId: link1.id } })).status === 403 && (await api("DELETE", `${D(S1.id)}/bao-cao-link`, { as: PAR1, body: { linkId: link1.id } })).status === 403);
  check("không có học sinh → 404", (await api("GET", D("khong-co"), { as: A })).status === 404);
  check("gia sư B xem em của A → 403 và không lộ tên", await (async () => { const r = await api("GET", D(S1.id), { as: B }); return r.status === 403 && !r.text.includes(NAME1); })());
  check("gia sư A xem em của B → 403", (await api("GET", D(S3.id), { as: A })).status === 403);
  check("em chờ phụ huynh đồng ý (pending_consent) chưa vào hồ sơ → 403", (await api("GET", D(pend.id), { as: A })).status === 403);
  check("gia sư B không đổi trạng thái / bật / thu hồi link của em A → 403", (await api("POST", `${D(S1.id)}/trang-thai`, { as: B, body: { status: "suspended" } })).status === 403
    && (await api("POST", `${D(S1.id)}/bao-cao-link`, { as: B, body: { linkId: link1.id } })).status === 403 && (await api("DELETE", `${D(S1.id)}/bao-cao-link`, { as: B, body: { linkId: link1.id } })).status === 403);
  check("… và dữ liệu của em A không đổi", (await prisma.enrollment.findFirst({ where: { userId: S1.id, courseId: cA.id } }))?.status === "active" && (await prisma.parentLink.findUnique({ where: { id: link1.id } }))?.portalToken === null);

  section("Chi tiết: lớp, điểm danh 90 ngày, buổi đã học (DD-07, HS-08)");
  await prisma.classSchedule.create({ data: { courseId: cA.id, dayOfWeek: 5, startTime: "19:00", endTime: "20:30" } });
  const mkSess = async (courseId: string, creator: string, ago: number, status: string | null) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date: day(ago), createdBy: creator } });
    if (status) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: S1.id, status } });
    return s;
  };
  await mkSess(cA.id, A.id, 1, "present"); await mkSess(cA.id, A.id, 8, "late"); await mkSess(cA.id, A.id, 15, "absent"); await mkSess(cA.id, A.id, 20, null);
  const old = await mkSess(cA.id, A.id, 95, "present"); // ngoài 90 ngày
  const future = await mkSess(cA.id, A.id, -3, "excused"); // báo nghỉ trước ở ngày chưa tới
  const sB = await prisma.attendanceSession.create({ data: { courseId: cB.id, date: day(2), createdBy: B.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: sB.id, userId: S1.id, status: "present" } }); // lớp của gia sư khác: KHÔNG được lẫn vào
  const d1 = await api("GET", D(S1.id), { as: A });
  check("200 và đúng em", d1.status === 200 && d1.json.student.userId === S1.id, d1.status);
  check("lớp: Toán 9 kèm lịch 'Thứ Sáu 19:00–20:30'", d1.json.enrollments.length === 1 && d1.json.enrollments[0].courseName === "Toán 9" && d1.json.enrollments[0].schedule === "Thứ Sáu 19:00–20:30", d1.json.enrollments);
  const att = d1.json.attendance;
  check("90 ngày: 3 bản ghi (có mặt, muộn, vắng); buổi 95 ngày trước, buổi tương lai, buổi lớp B KHÔNG tính", att.n === 3 && att.days === 90 && att.counts.present === 1 && att.counts.late === 1 && att.counts.absent === 1 && att.counts.excused === 0, att);
  check("dưới 10 bản ghi → rate null (chưa đủ dữ liệu, không bịa %)", att.rate === null);
  check("buổi đã học (HS-08) = có mặt + muộn, mới → cũ, KHÔNG giới hạn 90 ngày (buổi 95 ngày trước vẫn có), không có buổi vắng/tương lai", d1.json.learned.length === 3 && d1.json.learned.map((r: { status: string }) => r.status).join() === "present,late,present" && d1.json.learned[0].dateKey > d1.json.learned[1].dateKey && d1.json.learned[1].dateKey > d1.json.learned[2].dateKey, d1.json.learned);
  check("không có dữ liệu lớp của B trong phản hồi", !d1.text.includes("Văn 9 của B") && !d1.text.includes(sB.id) && !d1.text.includes(old.id) && !d1.text.includes(future.id));

  section("Thông tin riêng đi qua maskProfile / đồng ý");
  check("chưa có hồ sơ riêng → profile null (không bịa)", d1.json.profile === null);
  const mk = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME1, ageGroup: "16plus", userId: S1.id, guardianName: "Cô Lan", guardianPhone: "0912345678", consent: { self: true, scopes: ["basic"] } } });
  check("tạo hồ sơ riêng chỉ phạm vi cơ bản", mk.status === 201, mk.json);
  const d2 = await api("GET", D(S1.id), { as: A });
  check("có hồ sơ: thấy người liên hệ (cơ bản), mức basic_only", d2.json.profile?.consentLevel === "basic_only" && d2.json.profile.guardianName === "Cô Lan");
  check("KHÔNG có trường mở rộng (ngày sinh, địa chỉ, ghi chú, SĐT em) trong phản hồi", !("birthDate" in d2.json.profile) && !("notes" in d2.json.profile) && !("address" in d2.json.profile) && !("phone" in d2.json.profile));
  const pid = mk.json.id as string;
  const rv = await api("POST", `/api/tutor/ho-so/${pid}/thu-hoi`, { as: A, body: { party: "self" } });
  const d3 = await api("GET", D(S1.id), { as: A });
  check("thu hồi đồng ý → hồ sơ bị che (chỉ còn tên, locked), không còn tên phụ huynh / số", rv.status === 200 && d3.json.profile?.consentLevel === "locked" && !d3.text.includes("Cô Lan") && !d3.text.includes("0912345678"), d3.json.profile);
  const mk2 = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME2, ageGroup: "16plus", userId: S2.id, notes: "ghi chú riêng", birthDate: "2005-05-01", consent: { self: true, scopes: ["basic", "extended", "scores"] } } });
  const d4 = await api("GET", D(S2.id), { as: A });
  check("hồ sơ đủ 'extended' thì tab Ghi chú có dữ liệu", mk2.status === 201 && d4.json.profile?.consentLevel === "full" && d4.json.profile.notes === "ghi chú riêng", d4.json.profile);
  check("em có 2 lớp của A: cả hai hiện", d4.json.enrollments.length === 2);

  section("Điểm từng buổi chỉ hiện khi đồng ý 'scores' còn hiệu lực");
  const sess = await prisma.attendanceSession.create({ data: { courseId: cA.id, date: day(3), createdBy: A.id } });
  await prisma.sessionStudentScore.create({ data: { sessionId: sess.id, userId: S2.id, tutorId: A.id, score: 8.5, homeworkPct: 90 } });
  await prisma.sessionStudentScore.create({ data: { sessionId: sess.id, userId: S1.id, tutorId: A.id, score: 7, homeworkPct: 70 } });
  const e4 = await api("GET", D(S2.id), { as: A }), e1 = await api("GET", D(S1.id), { as: A });
  check("em có scores: thấy điểm 8,5 và 90%", e4.json.scores.allowed === true && e4.json.scores.items[0]?.score === 8.5 && e4.json.scores.items[0]?.homeworkPct === 90, e4.json.scores);
  check("em hồ sơ đã bị thu hồi: allowed=false, KHÔNG có điểm (dù DB còn dòng điểm)", e1.json.scores.allowed === false && e1.json.scores.items.length === 0 && e1.json.scores.reason === "no_consent", e1.json.scores);

  section("Phiếu: chỉ phiếu của chính gia sư, số đúng như đã lưu");
  const inv = await prisma.tuitionInvoice.create({ data: { code: `KINAAA${stamp.slice(0, 2).toUpperCase().replace(/[O0I1L]/g, "A")}`.slice(0, 8), tutorId: A.id, studentId: S1.id, yearMonth: "2026-10", amountDue: 480_000, paidAmount: 120_000, status: "partial" } });
  await prisma.tuitionInvoice.create({ data: { code: `KINBBB${Math.floor(Math.random() * 9 + 2)}`.slice(0, 8), tutorId: B.id, studentId: S1.id, yearMonth: "2026-10", amountDue: 999_000, paidAmount: 0, status: "sent" } });
  const f = await api("GET", D(S1.id), { as: A });
  check("1 phiếu của A: 480.000 đã đóng 120.000 còn 360.000 'Đóng một phần'", f.json.invoices.length === 1 && f.json.invoices[0].amountDue === 480_000 && f.json.invoices[0].remaining === 360_000 && f.json.invoices[0].statusLabel === "Đóng một phần" && f.json.invoices[0].id === inv.id, f.json.invoices);
  check("phiếu của gia sư B (999.000) KHÔNG lọt vào", !f.text.includes("999000"));
  check("API này không ghi gì vào phiếu", (await prisma.tuitionInvoice.findUnique({ where: { id: inv.id } }))?.paidAmount === 120_000);

  section("Danh sách: tín hiệu cảnh báo (HS-01)");
  await mkSess(cA.id, A.id, 25, "absent"); await mkSess(cA.id, A.id, 26, "excused"); // nhưng buổi 20 ngày trước để trống cắt chuỗi → streak của S1 = mới nhất: present → 0
  const l = await api("GET", "/api/tutor/hoc-sinh", { as: A });
  const sg = Object.fromEntries((l.json.signals as { userId: string }[]).map(s => [s.userId, s]));
  check("200, có students và signals; chỉ em của A", l.status === 200 && l.json.students.every((s: { userId: string }) => s.userId !== S3.id) && !sg[S3.id], l.status);
  check("S1: 1 phiếu chưa đóng đủ, link báo cáo chưa bật (có phụ huynh liên kết)", sg[S1.id].unpaidCount === 1 && sg[S1.id].reportLink === "off", sg[S1.id]);
  check("S2: chưa có phụ huynh liên kết trên KiN", sg[S2.id].reportLink === "no_parent" && sg[S2.id].unpaidCount === 0);
  check("tín hiệu không chứa tên phụ huynh hay số tiền", !JSON.stringify(l.json.signals).includes("Phụ huynh 1") && !JSON.stringify(l.json.signals).includes("480000"));
  // chuỗi vắng: S2 vắng 3 buổi gần nhất của Toán 9 → báo. Dựng: 3 buổi mới nhất S2 absent.
  await prisma.enrollment.updateMany({ where: { userId: S2.id }, data: { createdAt: day(200) } }); // buổi trước ngày ghi danh không tính vào chuỗi vắng
  for (const ago of [0, 4, 5]) { const s = await prisma.attendanceSession.create({ data: { courseId: cA2.id, date: day(ago), createdBy: A.id } }); await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: S2.id, status: ago === 4 ? "excused" : "absent" } }); }
  const l2 = await api("GET", "/api/tutor/hoc-sinh", { as: A });
  const sg2 = Object.fromEntries((l2.json.signals as { userId: string; absentStreak: number }[]).map(s => [s.userId, s]));
  check("S2 vắng/nghỉ phép liên tiếp 3 buổi mới nhất → absentStreak 3", sg2[S2.id].absentStreak === 3, sg2[S2.id]);
  check("S1 có mặt ở buổi mới nhất → absentStreak 0", sg2[S1.id].absentStreak === 0, sg2[S1.id]);

  section("HS-06: Đã nghỉ giữ dữ liệu");
  const before = { att: await prisma.attendanceRecord.count({ where: { userId: S1.id } }), inv: await prisma.tuitionInvoice.count({ where: { studentId: S1.id } }), prof: await prisma.studentProfile.count({ where: { userId: S1.id } }), sc: await prisma.sessionStudentScore.count({ where: { userId: S1.id } }) };
  check("trạng thái lạ → 400", (await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "deleted" } })).status === 400 && (await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: {} })).status === 400);
  const off = await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "suspended" } });
  check("đánh dấu Đã nghỉ → 200, đổi 1 lớp", off.status === 200 && off.json.changed === 1, off.json);
  check("DB: ghi danh = suspended; điểm danh, phiếu, hồ sơ riêng, điểm: KHÔNG mất",
    (await prisma.enrollment.findFirst({ where: { userId: S1.id, courseId: cA.id } }))?.status === "suspended" && (await prisma.attendanceRecord.count({ where: { userId: S1.id } })) === before.att
    && (await prisma.tuitionInvoice.count({ where: { studentId: S1.id } })) === before.inv && (await prisma.studentProfile.count({ where: { userId: S1.id } })) === before.prof && (await prisma.sessionStudentScore.count({ where: { userId: S1.id } })) === before.sc);
  const lo = await api("GET", "/api/tutor/hoc-sinh", { as: A });
  check("danh sách: em hiện ở nhóm suspended", lo.json.students.find((s: { userId: string }) => s.userId === S1.id)?.status === "suspended");
  check("hồ sơ vẫn mở được sau khi nghỉ (giữ dữ liệu), vẫn thấy lịch sử điểm danh như trước", (await api("GET", D(S1.id), { as: A })).json.attendance.n === 5);
  check("đánh dấu lại lần nữa → noop (changed 0)", (await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "suspended" } })).json.changed === 0);
  const on = await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "active" } });
  check("cho học lại → active", on.status === 200 && (await prisma.enrollment.findFirst({ where: { userId: S1.id, courseId: cA.id } }))?.status === "active");
  const wrongCourse = await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "suspended", courseId: cA2.id } });
  check("lớp không có em này → 404, không đổi gì", wrongCourse.status === 404);
  const both = await api("POST", `${D(S2.id)}/trang-thai`, { as: A, body: { status: "suspended" } });
  check("không có courseId → áp cho cả hai lớp của A (2)", both.json.changed === 2);
  const oneOnly = await api("POST", `${D(S2.id)}/trang-thai`, { as: A, body: { status: "active", courseId: cA2.id } });
  check("có courseId → chỉ một lớp", oneOnly.json.changed === 1 && (await prisma.enrollment.findFirst({ where: { userId: S2.id, courseId: cA.id } }))?.status === "suspended");
  await api("POST", `${D(S2.id)}/trang-thai`, { as: A, body: { status: "active" } });
  const crossTutor = await prisma.enrollment.create({ data: { userId: S1.id, courseId: cB.id, status: "active" } });
  await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "suspended" } });
  check("em học cả lớp của B: A đánh dấu nghỉ KHÔNG đụng ghi danh ở lớp của B", (await prisma.enrollment.findUnique({ where: { id: crossTutor.id } }))?.status === "active");
  await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "active" } });
  await prisma.enrollment.updateMany({ where: { userId: S1.id, courseId: cA.id }, data: { status: "pending_consent" } });
  // pending_consent: ownStudent coi như không thuộc lớp → 403 (đúng quy tắc chung), không thể bật
  check("em chờ phụ huynh đồng ý: gia sư KHÔNG tự bật được (bị chặn)", [403, 409].includes((await api("POST", `${D(S1.id)}/trang-thai`, { as: A, body: { status: "active" } })).status) && (await prisma.enrollment.findFirst({ where: { userId: S1.id, courseId: cA.id } }))?.status === "pending_consent");
  await prisma.enrollment.updateMany({ where: { userId: S1.id, courseId: cA.id }, data: { status: "active" } });
  await prisma.enrollment.delete({ where: { id: crossTutor.id } });

  section("HS-09: link báo cáo riêng — bật, xem, thu hồi ngay");
  const L = `${D(S1.id)}/bao-cao-link`;
  check("thiếu linkId → 400", (await api("POST", L, { as: A, body: {} })).status === 400);
  check("liên kết của EM KHÁC (S3) qua đường của S1 → 404, không bật được", (await api("POST", L, { as: A, body: { linkId: link3.id } })).status === 404 && (await prisma.parentLink.findUnique({ where: { id: link3.id } }))?.portalToken === null);
  check("liên kết không tồn tại → 404", (await api("POST", L, { as: A, body: { linkId: "khong-co" } })).status === 404);
  const pendL = await prisma.parentLink.create({ data: { parentId: PAR3.id, studentId: S1.id, status: "pending" } });
  check("liên kết CHƯA xác nhận → 409, không sinh token", (await api("POST", L, { as: A, body: { linkId: pendL.id } })).status === 409 && (await prisma.parentLink.findUnique({ where: { id: pendL.id } }))?.portalToken === null);
  const en = await api("POST", L, { as: A, body: { linkId: link1.id } });
  const tok = (await prisma.parentLink.findUnique({ where: { id: link1.id } }))?.portalToken ?? "";
  check("bật → 201, token 32 hex ngẫu nhiên, đường dẫn /so-cua-con/<token>", en.status === 201 && /^[0-9a-f]{32}$/.test(tok) && en.json.url === `/so-cua-con/${tok}`, en.json);
  check("đường dẫn KHÔNG chứa tên em / id em / id liên kết", !en.json.url.includes(S1.id) && !en.json.url.includes(link1.id) && !en.json.url.toLowerCase().includes("tentre"));
  const en2 = await api("POST", L, { as: A, body: { linkId: link1.id } });
  check("bật lần nữa → trả lại ĐÚNG link đang chạy (không sinh link mới)", en2.status === 200 && en2.json.already === true && en2.json.url === en.json.url);
  const portal = await api("GET", `/api/parent-portal/${tok}`, { headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` } });
  check("trang Sổ của con mở được bằng link đó (Xem thử)", portal.status === 200 && portal.json.student?.name === NAME1, portal.status);
  const dd = await api("GET", D(S1.id), { as: A });
  check("hồ sơ hiện link đang bật cho gia sư", dd.json.report.state === "on" && dd.json.report.links[0].url === `/so-cua-con/${tok}`);
  const rev = await api("DELETE", L, { as: A, body: { linkId: link1.id } });
  check("thu hồi → 200 và token = null", rev.status === 200 && (await prisma.parentLink.findUnique({ where: { id: link1.id } }))?.portalToken === null);
  const portal2 = await api("GET", `/api/parent-portal/${tok}`, { headers: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` } });
  check("NGAY SAU thu hồi: link cũ trả 404", portal2.status === 404, portal2.status);
  check("thu hồi lần nữa → idempotent", (await api("DELETE", L, { as: A, body: { linkId: link1.id } })).json.alreadyRevoked === true);
  const en3 = await api("POST", L, { as: A, body: { linkId: link1.id } });
  const tok3 = (await prisma.parentLink.findUnique({ where: { id: link1.id } }))?.portalToken;
  check("bật lại → token MỚI khác token cũ (link cũ vẫn chết)", en3.status === 201 && tok3 !== tok && (await api("GET", `/api/parent-portal/${tok}`, { headers: { "x-forwarded-for": "10.7.1.1" } })).status === 404);
  await api("DELETE", L, { as: A, body: { linkId: link1.id } });

  section("LO-09 / LO-03: thêm học sinh đã có vào lớp");
  const cNew = await mkCourse(A.id, { name: "Lớp mới của A" });
  const ADD = (c: string) => `/api/tutor/lop/${c}/hoc-sinh`;
  check("chưa đăng nhập 401; học sinh 403", (await api("POST", ADD(cNew.id), { body: { userIds: [S1.id] } })).status === 401 && (await api("POST", ADD(cNew.id), { as: S1, body: { userIds: [S1.id] } })).status === 403);
  check("lớp không có → 404; lớp của gia sư B → 403", (await api("POST", ADD("khong-co"), { as: A, body: { userIds: [S1.id] } })).status === 404 && (await api("POST", ADD(cB.id), { as: A, body: { userIds: [S1.id] } })).status === 403);
  check("gia sư B thêm em vào lớp của A → 403", (await api("POST", ADD(cNew.id), { as: B, body: { userIds: [S3.id] } })).status === 403);
  check("body sai → 400; quá 50 em → 400", (await api("POST", ADD(cNew.id), { as: A, body: { userIds: "x" } })).status === 400 && (await api("POST", ADD(cNew.id), { as: A, body: { userIds: [] } })).status === 400 && (await api("POST", ADD(cNew.id), { as: A, body: { userIds: Array.from({ length: 51 }, (_, i) => `u${i}`) } })).status === 400);
  const stranger = await api("POST", ADD(cNew.id), { as: A, body: { userIds: [S1.id, STR.id] } });
  check("có một người lạ (chưa học lớp nào của A) → 403, KHÔNG thêm ai (kể cả em hợp lệ)", stranger.status === 403 && (await prisma.enrollment.count({ where: { courseId: cNew.id } })) === 0, stranger.json);
  check("em của gia sư B không thêm vào lớp của A được → 403", (await api("POST", ADD(cNew.id), { as: A, body: { userIds: [S3.id] } })).status === 403 && (await prisma.enrollment.count({ where: { courseId: cNew.id, userId: S3.id } })) === 0);
  const good = await api("POST", ADD(cNew.id), { as: A, body: { userIds: [S1.id, S2.id] } });
  check("thêm 2 em đã học với A → 201, ghi danh active, có thông báo", good.status === 201 && good.json.added === 2 && (await prisma.enrollment.count({ where: { courseId: cNew.id, status: "active" } })) === 2 && (await prisma.notification.count({ where: { userId: S1.id, type: "enrollment" } })) === 1, good.json);
  check("thông báo không chứa tên em", !JSON.stringify(await prisma.notification.findMany({ where: { type: "enrollment" } })).includes("TENTRE"));
  const again = await api("POST", ADD(cNew.id), { as: A, body: { userIds: [S1.id] } });
  check("thêm lại → 200, alreadyIn 1, không nhân đôi", again.status === 200 && again.json.alreadyIn === 1 && (await prisma.enrollment.count({ where: { courseId: cNew.id, userId: S1.id } })) === 1);

  section("Nhật ký / log không chứa tên trẻ");
  const logs = JSON.stringify(await prisma.auditLog.findMany({ where: { OR: [{ action: { startsWith: "parent_link." } }, { action: { startsWith: "enrollment." } }, { action: "course.add_students" }] } }));
  check("audit log có hành động nhưng KHÔNG có tên em hay token", logs.includes("enrollment.mark_left") && logs.includes("parent_link.portal_token.enable") && !logs.includes("TENTRE") && !logs.includes(tok) && !logs.includes(String(tok3)));

  await done();
})();
