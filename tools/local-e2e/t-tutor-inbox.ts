// Hộp việc của gia sư — API /api/tutor/hop-viec với dữ liệu thật: đếm đúng, mô tả đúng, chỉ thấy việc của chính mình.
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { loadTutorTodoTotal } from "@/lib/tutorDashboard";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Hoa"), S = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), R = await mkUser({ name: "Người Báo" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T2.id, { name: "Văn 9" });
  for (const [u, c] of [[S, c1], [S2, c1], [S, c2]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  const YM = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

  section("Quyền");
  const anon = await api("GET", "/api/tutor/hop-viec");
  check("chưa đăng nhập → 401", anon.status === 401, anon.status);
  const stu = await api("GET", "/api/tutor/hop-viec", { as: S });
  check("học viên → 403", stu.status === 403, stu.status);
  const sup = await api("GET", "/api/tutor/hop-viec", { as: await mkUser({ name: "Quản trị", role: "admin", adminRole: "admin_super" }) });
  check("quản trị viên (không phải gia sư) → 403", sup.status === 403, sup.status);

  section("Chưa có việc");
  const e0 = await api("GET", "/api/tutor/hop-viec", { as: T });
  check("rỗng: items=[] total=0", e0.status === 200 && Array.isArray(e0.json.items) && e0.json.items.length === 0 && e0.json.total === 0, e0.json);
  check("Cache-Control: no-store", /no-store/.test(e0.headers.get("cache-control") ?? ""), e0.headers.get("cache-control"));

  section("Có đủ các loại việc");
  // 2 khoản tiền vào chưa ghép (qua webhook thật) + 1 phiếu nháp (qua API thật)
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Lan" } });
  const key = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json.key;
  const hook = { authorization: `Apikey ${key}` };
  await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: hook, body: { id: 9001, transferType: "in", transferAmount: 500000, content: "chuyen khoan hoc phi" } });
  await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: hook, body: { id: 9002, transferType: "in", transferAmount: 120000, content: "khong ma" } });
  await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: YM, sessionCount: 8, updatedBy: T.id } });
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: YM, studentIds: [S.id] } });
  check("dựng được phiếu nháp cho Em An", iss.status < 300 && iss.json.created?.length === 1, iss.json);
  await prisma.enrollment.create({ data: { userId: (await mkUser({ name: "Em Chờ" })).id, courseId: c1.id, status: "pending_consent" } });
  const th = await prisma.thread.create({ data: { content: "Bài đăng bị báo cáo trong lớp Toán 9", authorId: S2.id, courseId: c1.id } });
  await prisma.threadReport.create({ data: { threadId: th.id, reporterId: R.id, reason: "Spam quảng cáo" } });
  const sec = await prisma.section.create({ data: { id: `sec-${Date.now()}`, title: "Chương 1", courseId: c1.id } });
  const chap = await prisma.chapter.create({ data: { id: `chap-${Date.now()}`, title: "Bài 1", sectionId: sec.id } });
  const les = await prisma.lesson.create({ data: { id: `les-${Date.now()}`, code: "L1", title: "Bài học 1", type: "record", chapterId: chap.id } });
  const asg = await prisma.assignment.create({ data: { lessonId: les.id, title: "BTVN 1", ownerId: T.id, mode: "file" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: S.id, fileUrl: "x" } });

  const r = await api("GET", "/api/tutor/hop-viec", { as: T });
  const byId = Object.fromEntries((r.json.items as any[]).map(i => [i.id, i]));
  check("200 và có danh sách", r.status === 200 && Array.isArray(r.json.items), r.status);
  check("2 khoản tiền vào cần đối soát", byId.bank?.title === "2 khoản tiền vào cần đối soát", byId.bank?.title);
  check("khung đọc ghi số tiền + nội dung chuyển khoản", byId.bank?.detail.rows.some((x: any) => /500\.000đ/.test(x.title) && /chuyen khoan hoc phi/.test(x.sub)), byId.bank?.detail.rows);
  check("1 phiếu học phí nháp chưa gửi, nêu tên em", byId.draft?.title === "1 phiếu học phí nháp chưa gửi" && byId.draft.detail.rows.some((x: any) => x.title === "Em An"), byId.draft);
  check("1 học sinh chờ phụ huynh xác nhận, nêu tên + lớp", byId.consent?.title === "1 học sinh chờ phụ huynh xác nhận" && byId.consent.detail.rows[0].title === "Em Chờ" && /Toán 9/.test(byId.consent.detail.rows[0].sub), byId.consent);
  check("dòng 'chờ phụ huynh' dẫn tới danh sách học viên của đúng lớp", byId.consent?.detail.rows[0].href === `/lop-cua-toi/quan-lop/${c1.id}/hoc-vien`, byId.consent?.detail.rows[0].href);
  check("1 báo cáo trong cộng đồng lớp, nêu lý do", byId.reports?.title === "1 báo cáo trong cộng đồng lớp" && /Spam quảng cáo/.test(byId.reports.detail.rows[0].sub), byId.reports);
  check("1 bài chưa chấm, dẫn tới đúng khoá", byId.ungraded?.title === "1 bài chưa chấm" && byId.ungraded.detail.rows[0].title === "Em An" && byId.ungraded.detail.rows[0].href === `/lop-cua-toi/quan-lop/${c1.id}`, byId.ungraded);
  check("khoản tiền vào (khẩn) đứng trước phiếu nháp (thường)", r.json.items.findIndex((i: any) => i.id === "bank") < r.json.items.findIndex((i: any) => i.id === "draft"));
  check("total = tổng các loại = số đỏ trên thanh module", r.json.total === (r.json.items as any[]).reduce((n, i) => n + Number(i.title.match(/^\d+/)?.[0] ?? 0), 0) && r.json.total === (await loadTutorTodoTotal(T.id)), [r.json.total, await loadTutorTodoTotal(T.id)]);
  check("mọi nút/dòng có href đều là đường dẫn trong ứng dụng", (r.json.items as any[]).every(i => [...i.detail.commands, ...i.detail.rows].every((x: any) => !x.href || x.href.startsWith("/"))));

  section("Chỉ thấy việc của chính mình");
  const r2 = await api("GET", "/api/tutor/hop-viec", { as: T2 });
  check("gia sư khác không thấy việc nào của cô Lan", r2.status === 200 && r2.json.total === 0 && r2.json.items.length === 0, r2.json);
  const blob = JSON.stringify(r2.json);
  check("không lộ tên em / lớp của người khác", !/Em An|Toán 9|Em Chờ|Spam/.test(blob));

  section("Việc xong thì biến mất");
  await prisma.bankTransaction.updateMany({ where: { tutorId: T.id }, data: { status: "resolved" } });
  const r3 = await api("GET", "/api/tutor/hop-viec", { as: T });
  check("đối soát xong → dòng 'khoản tiền vào' không còn", !(r3.json.items as any[]).some(i => i.id === "bank"), r3.json.items.map((i: any) => i.id));
  // ─── ĐX-01: buổi đã qua giờ, chưa điểm danh xong ───────────────────────────────────────────────────────────
  section("Buổi đã qua giờ, chưa điểm danh xong (ĐX-01)");
  const vnKey = (off: number) => new Date(Date.now() + 7 * 3600_000 + off * 86400_000).toISOString().slice(0, 10);
  const k10 = vnKey(-10), k3 = vnKey(-3); // cùng thứ trong tuần → khung giờ này có đúng 2 buổi trong 14 ngày qua
  const long = new Date(Date.now() - 30 * 86400_000);
  const dow = new Date(`${k3}T00:00:00Z`).getUTCDay();
  const R1 = await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: dow, startTime: "09:00", endTime: "10:00", createdAt: long } });
  // Các em ghi danh từ 30 ngày trước (ghi danh SAU khi buổi kết thúc thì không thuộc buổi đó)
  await prisma.enrollment.updateMany({ where: { courseId: c1.id }, data: { createdAt: long } });
  const un = async (as = T) => ((await api("GET", "/api/tutor/hop-viec", { as })).json.items as any[]).find(i => i.id === "unmarked");

  let u = await un();
  check("2 buổi đã qua giờ, chưa em nào có bản ghi → '2 buổi đã qua giờ, chưa điểm danh xong'", u?.title === "2 buổi đã qua giờ, chưa điểm danh xong", u?.title);
  check("việc cũ nhất (10 ngày trước) đứng đầu; nêu lớp, 'thiếu 2/2 em' và tên hai em", u?.detail.rows[0].title === "Toán 9" && /thiếu 2\/2 em: Em An, Em Bình/.test(u.detail.rows[0].sub) && u.detail.rows[0].href === `/lop-cua-toi/quan-lop/${c1.id}/diem-danh?date=${k10}`, u?.detail.rows);
  check("em chờ phụ huynh xác nhận (chưa học) không bị tính; là việc thường, không khẩn", !/Em Chờ/.test(JSON.stringify(u)) && u?.urgent === false);
  const tot0 = await api("GET", "/api/tutor/hop-viec", { as: T });
  check("số đỏ trên thanh module vẫn bằng tổng các loại (kể cả loại mới)", tot0.json.total === (await loadTutorTodoTotal(T.id)) && tot0.json.total === (tot0.json.items as any[]).reduce((n, i) => n + Number(i.title.match(/^\d+/)?.[0] ?? 0), 0), tot0.json.total);

  const s3 = await prisma.attendanceSession.create({ data: { courseId: c1.id, date: new Date(`${k3}T00:00:00Z`), createdBy: T.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: s3.id, userId: S.id, status: "present" } });
  u = await un();
  check("Em An đã có bản ghi → buổi gần đây chỉ còn thiếu 1/2 (Em Bình)", /thiếu 1\/2 em: Em Bình/.test(u?.detail.rows.find((x: any) => x.href.endsWith(k3))?.sub ?? ""), u?.detail.rows);
  await prisma.attendanceRecord.create({ data: { sessionId: s3.id, userId: S2.id, status: "excused" } });
  u = await un();
  check("đủ 2 em (có phép cũng là đã ghi) → buổi này biến mất, còn 1 buổi", u?.title === "1 buổi đã qua giờ, chưa điểm danh xong" && !u.detail.rows.some((x: any) => x.href.endsWith(k3)), u?.title);

  await prisma.classAbsence.create({ data: { courseId: c1.id, scheduleId: R1.id, dateKey: k10, startAt: new Date(`${k10}T02:00:00Z`), studentId: S2.id, reportedBy: "parent", leadMinutes: 30, status: "charged" } });
  u = await un();
  check("Em Bình đã có báo nghỉ ('tính phí' — không sinh bản ghi điểm danh) → buổi 10 ngày trước chỉ còn thiếu 1/1 (Em An)", /thiếu 1\/1 em: Em An/.test(u?.detail.rows[0]?.sub ?? ""), u?.detail.rows);

  await prisma.classSessionChange.create({ data: { courseId: c1.id, scheduleId: R1.id, dateKey: k10, kind: "cancel", changedBy: T.id } });
  check("gia sư Huỷ buổi đó → dòng việc biến mất", !(await un()));
  await prisma.classSessionChange.deleteMany({ where: { scheduleId: R1.id } });
  check("bỏ Huỷ → việc quay lại", (await un())?.title === "1 buổi đã qua giờ, chưa điểm danh xong");
  await prisma.classSessionChange.create({ data: { courseId: c1.id, scheduleId: R1.id, dateKey: k10, kind: "move", newDateKey: vnKey(2), newStartTime: "09:00", newEndTime: "10:00", changedBy: T.id } });
  check("buổi bị dời sang ngày tương lai → chưa tới hạn, biến mất", !(await un()));
  await prisma.classSessionChange.deleteMany({ where: { scheduleId: R1.id } });

  await prisma.course.update({ where: { id: c1.id }, data: { classStatus: "closed" } });
  check("lớp đã đóng → không nhắc", !(await un()));
  await prisma.course.update({ where: { id: c1.id }, data: { classStatus: "open" } });
  check("mở lại lớp → việc quay lại", !!(await un()));

  section("ĐX-01: cô lập giữa hai gia sư");
  await prisma.classSchedule.create({ data: { courseId: c2.id, dayOfWeek: dow, startTime: "09:00", endTime: "10:00", createdAt: long } });
  await prisma.enrollment.updateMany({ where: { courseId: c2.id }, data: { createdAt: long } });
  const u2 = await un(T2);
  check("cô Hoa thấy việc của lớp MÌNH (Văn 9) và không thấy lớp Toán 9 / Em Bình của cô Lan", u2?.title === "2 buổi đã qua giờ, chưa điểm danh xong" && /Văn 9/.test(JSON.stringify(u2)) && !/Toán 9|Em Bình/.test(JSON.stringify(u2)), u2);
  check("cô Lan không thấy lớp Văn 9", !/Văn 9/.test(JSON.stringify(await un())));
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
