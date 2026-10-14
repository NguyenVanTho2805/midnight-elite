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
  check("dòng 'chờ phụ huynh' dẫn tới danh sách học viên của đúng lớp", byId.consent?.detail.rows[0].href === `/admin/khoa-hoc/${c1.id}/hoc-vien`, byId.consent?.detail.rows[0].href);
  check("1 báo cáo trong cộng đồng lớp, nêu lý do", byId.reports?.title === "1 báo cáo trong cộng đồng lớp" && /Spam quảng cáo/.test(byId.reports.detail.rows[0].sub), byId.reports);
  check("1 bài chưa chấm, dẫn tới đúng khoá", byId.ungraded?.title === "1 bài chưa chấm" && byId.ungraded.detail.rows[0].title === "Em An" && byId.ungraded.detail.rows[0].href === `/admin/khoa-hoc/${c1.id}`, byId.ungraded);
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
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
