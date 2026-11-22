// SCL đợt 5 (D5, D7, D8, tình huống 11–13) — học thử hết hạn bị CHẶN Ở MÁY CHỦ (tài liệu / bài tập), mở đồng hồ khi vào lớp, cron lật đúng và chỉ đúng em,
// chủ lớp / Chủ nhiệm xác nhận chính thức hoặc gia hạn thì mở lại. Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-trial-access.ts
import { prisma } from "@/lib/prisma";
import { BASE, api, cookieFor, mkCourse, mkSuper, mkTutor, mkUser, wipe, check, section, done } from "./h";

const D = 86_400_000;
const CRON = process.env.CRON_SECRET ?? "";
const days = (n: number) => new Date(Date.now() - n * D);

(async () => {
  await wipe();
  const T = await mkTutor("Anh Thanh"), OTHER = await mkTutor("Cô Khác"), ADM = await mkSuper("Chủ nhiệm");
  const C = await mkCourse(T.id, { name: "BCA Toán" }), C2 = await mkCourse(T.id, { name: "BCA Sử" });
  await prisma.section.create({ data: { id: "s-tr", title: "P", courseId: C.id } });
  await prisma.chapter.create({ data: { id: "c-tr", title: "C", sectionId: "s-tr" } });
  await prisma.lesson.create({ data: { id: "l-tr", code: "l-tr", title: "Bài 1", type: "document", chapterId: "c-tr", status: "published", documents: JSON.stringify([{ name: "De.pdf", url: "https://example.com/de.pdf" }]) } });
  const asg = await prisma.assignment.create({ data: { lessonId: "l-tr", title: "Bài tập 1", mode: "interactive", dueDate: new Date(Date.now() + 5 * D) } });

  const EXP = await mkUser({ name: "Em Hết Hạn" }), LIVE = await mkUser({ name: "Em Đang Thử" }), NEW = await mkUser({ name: "Em Chưa Mở" });
  const OFF = await mkUser({ name: "Em Chính Thức" }), WAIT = await mkUser({ name: "Em Chờ Xác Nhận" });
  const eExp = await prisma.enrollment.create({ data: { userId: EXP.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: days(15) } });
  const eExp2 = await prisma.enrollment.create({ data: { userId: EXP.id, courseId: C2.id, status: "active", trialDays: 14, trialStartedAt: days(15) } });
  const eLive = await prisma.enrollment.create({ data: { userId: LIVE.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: days(3) } });
  const eNew = await prisma.enrollment.create({ data: { userId: NEW.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: null } });
  const eNew2 = await prisma.enrollment.create({ data: { userId: NEW.id, courseId: C2.id, status: "active", trialDays: 14, trialStartedAt: null } });
  const eOff = await prisma.enrollment.create({ data: { userId: OFF.id, courseId: C.id, status: "active", trialStartedAt: days(40) } });
  const eWait = await prisma.enrollment.create({ data: { userId: WAIT.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: days(20), trialConvertRequestedAt: days(2) } });

  section("Hết hạn nhưng cron CHƯA lật: máy chủ vẫn chặn (tình huống 13)");
  const ctx = await api("GET", `/api/lessons/l-tr/context`, { as: EXP });
  check("GET bài học (context) ⇒ 403", ctx.status === 403, ctx.status);
  const les = await api("GET", `/api/lessons/l-tr`, { as: EXP });
  check("GET /api/lessons/<id> ⇒ 403", les.status === 403, les.status);
  const ans = await api("GET", `/api/assignments/${asg.id}/answer`, { as: EXP });
  check("GET bài tập ⇒ 403", ans.status === 403, ans.status);
  const sub = await api("POST", `/api/assignments/${asg.id}/submit`, { as: EXP, body: {} });
  check("nộp bài ⇒ bị chặn (403)", sub.status === 403, sub.status);
  const crs = await api("GET", `/api/courses/${C.id}`, { as: EXP });
  check("GET lớp ⇒ trialExpired, không cây bài, không link tài liệu", crs.status === 200 && crs.json?.trialExpired === true && crs.json.sections.length === 0 && !crs.text.includes("example.com/de.pdf"), crs.json);
  const lop = await api("GET", "/api/student/lop", { as: EXP });
  check("thư viện lớp vẫn có lớp, đánh dấu trialExpired, không 'Học tiếp'", lop.json?.classes?.some((c: any) => c.id === C.id && c.trialExpired === true && c.hocTiep === null), lop.json);
  const live = await api("GET", `/api/lessons/l-tr/context`, { as: LIVE });
  check("em đang thử: xem bài 200 + thấy link tài liệu (D6)", live.status === 200 && live.text.includes("example.com/de.pdf"), live.status);
  const liveC = await api("GET", `/api/courses/${C.id}`, { as: LIVE });
  check("em đang thử: lớp có băng 'còn 11 ngày'", liveC.json?.trial?.kind === "dang_thu" && liveC.json.trial.daysLeft === 11, liveC.json?.trial);
  check("em chính thức: không có băng học thử", !(await api("GET", `/api/courses/${C.id}`, { as: OFF })).json?.trial);

  section("Mở đồng hồ (D5): vào trang lớp lần đầu ⇒ mọi ghi danh thử bắt đầu cùng lúc");
  const t0 = Date.now();
  const hp = await fetch(`${BASE}/student/hoc-tap?course=${C.id}`, { headers: { cookie: await cookieFor(NEW) } });
  check("trang lớp 200", hp.status === 200, hp.status);
  const [n1, n2] = await Promise.all([prisma.enrollment.findUnique({ where: { id: eNew.id } }), prisma.enrollment.findUnique({ where: { id: eNew2.id } })]);
  check("cả 2 lớp thử của em có trialStartedAt, CÙNG một mốc", !!n1?.trialStartedAt && n1.trialStartedAt.getTime() >= t0 - 2000 && n1.trialStartedAt.getTime() === n2?.trialStartedAt?.getTime(), [n1?.trialStartedAt, n2?.trialStartedAt]);
  await fetch(`${BASE}/student/hoc-tap?course=${C.id}`, { headers: { cookie: await cookieFor(NEW) } });
  check("mở lần hai không dời mốc", (await prisma.enrollment.findUnique({ where: { id: eNew.id } }))?.trialStartedAt?.getTime() === n1?.trialStartedAt?.getTime());
  check("em chính thức không bị đặt mốc", (await prisma.enrollment.findUnique({ where: { id: eOff.id } }))?.trialDays === null);

  section("Cron /api/cron/het-han-hoc-thu");
  check("không khoá ⇒ 401", (await api("GET", "/api/cron/het-han-hoc-thu")).status === 401);
  check("sai khoá ⇒ 401", (await api("GET", "/api/cron/het-han-hoc-thu", { headers: { authorization: "Bearer sai" } })).status === 401);
  const run = await api("GET", "/api/cron/het-han-hoc-thu", { headers: { authorization: `Bearer ${CRON}` } });
  check("chạy ⇒ 200, lật 3 (2 lớp của em hết hạn + em chờ xác nhận đã quá hạn)", run.status === 200 && run.json?.expired === 3, run.json);
  const st = async (id: string) => (await prisma.enrollment.findUnique({ where: { id } }))?.status;
  check("em hết hạn: cả hai lớp → trial_expired", (await st(eExp.id)) === "trial_expired" && (await st(eExp2.id)) === "trial_expired");
  check("em đang thử / vừa mở / chính thức (mốc cũ 40 ngày) KHÔNG đổi", (await st(eLive.id)) === "active" && (await st(eNew.id)) === "active" && (await st(eOff.id)) === "active");
  check("em chờ xác nhận nhưng quá hạn → trial_expired (chưa được xác nhận)", (await st(eWait.id)) === "trial_expired");
  check("chạy lại ⇒ 0 (không lật hai lần)", (await api("GET", "/api/cron/het-han-hoc-thu", { headers: { authorization: `Bearer ${CRON}` } })).json?.expired === 0);
  check("nhật ký cron chỉ có số đếm", (await prisma.auditLog.findMany({ where: { action: "enrollment.trial_expire_run" } })).every(a => !JSON.stringify(a.metadata).includes(EXP.id)));

  section("Vỏ học sinh tự lật (không chờ cron)");
  const LATE = await mkUser({ name: "Em Muộn" });
  const eLate = await prisma.enrollment.create({ data: { userId: LATE.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: days(14.5) } });
  await fetch(`${BASE}/student/viec-cua-toi`, { headers: { cookie: await cookieFor(LATE) } });
  check("mở vỏ học sinh ⇒ ghi danh quá hạn lật trial_expired", (await st(eLate.id)) === "trial_expired");

  section("Quyền nút Xác nhận / Gia hạn");
  const act = (as: any, enrollmentId: string, action: string) => fetch(`${BASE}/api/tutor/lop/${C.id}/hoc-thu`, { method: "POST", headers: as ? { cookie: as } : {}, body: new URLSearchParams({ enrollmentId, action }), redirect: "manual" });
  check("khách ⇒ 401", (await act(null, eExp.id, "gia-han")).status === 401);
  check("học sinh ⇒ 403", (await act(await cookieFor(EXP), eExp.id, "gia-han")).status === 403);
  check("gia sư lớp khác ⇒ 403", (await act(await cookieFor(OTHER), eExp.id, "gia-han")).status === 403);
  check("ghi danh của lớp khác (C2) qua route lớp C ⇒ không đổi (303 ?hocthu=loi)", ((await act(await cookieFor(T), eExp2.id, "gia-han")).headers.get("location") ?? "").includes("hocthu=loi") && (await st(eExp2.id)) === "trial_expired");

  section("Gia hạn 7 ngày mở lại");
  const g = await act(await cookieFor(T), eExp.id, "gia-han");
  check("chủ lớp ⇒ 303 về tab Học sinh ?hocthu=ok", g.status === 303 && (g.headers.get("location") ?? "").includes("/hoc-vien?hocthu=ok"), g.headers.get("location"));
  const ge = await prisma.enrollment.findUnique({ where: { id: eExp.id } });
  check("status active, còn ~7 ngày tính từ hôm nay", ge?.status === "active" && !!ge.trialDays && ge.trialStartedAt!.getTime() + ge.trialDays * D - Date.now() > 6 * D, ge);
  check("API tài liệu mở lại (200)", (await api("GET", `/api/lessons/l-tr/context`, { as: EXP })).status === 200);
  check("API bài tập mở lại (200)", (await api("GET", `/api/assignments/${asg.id}/answer`, { as: EXP })).status === 200);
  const gl = await prisma.enrollment.findUnique({ where: { id: eLive.id } });
  await act(await cookieFor(T), eLive.id, "gia-han");
  check("gia hạn em đang thử ⇒ trialDays +7, mốc giữ", (await prisma.enrollment.findUnique({ where: { id: eLive.id } }))?.trialDays === (gl!.trialDays! + 7));

  section("Xác nhận chính thức (Chủ nhiệm cũng được)");
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: WAIT.id, fileUrl: "/u/x.pdf", score: 8 } });
  const x = await act(await cookieFor(ADM), eWait.id, "xac-nhan");
  check("quản trị trung tâm ⇒ 303 ok", x.status === 303 && (x.headers.get("location") ?? "").includes("hocthu=ok"), x.headers.get("location"));
  const xe = await prisma.enrollment.findUnique({ where: { id: eWait.id } });
  check("trialDays null, trialConvertRequestedAt null, active", xe?.trialDays === null && xe.trialConvertRequestedAt === null && xe.status === "active", xe);
  check("điểm / bài đã nộp giữ nguyên (tình huống 11)", (await prisma.assignmentSubmission.count({ where: { userId: WAIT.id, score: 8 } })) === 1);
  check("API tài liệu mở (200)", (await api("GET", `/api/lessons/l-tr/context`, { as: WAIT })).status === 200);
  const rerun = await api("GET", "/api/cron/het-han-hoc-thu", { headers: { authorization: `Bearer ${CRON}` } });
  check("cron sau xác nhận không khoá lại em chính thức", rerun.json?.expired === 0 && (await st(eWait.id)) === "active", rerun.json);
  check("nhật ký trial_confirm + trial_extend", (await prisma.auditLog.count({ where: { action: "enrollment.trial_confirm" } })) === 1 && (await prisma.auditLog.count({ where: { action: "enrollment.trial_extend" } })) === 2);
  check("nút lỗi: action lạ ⇒ ?hocthu=loi", ((await act(await cookieFor(T), eLive.id, "xoa")).headers.get("location") ?? "").includes("hocthu=loi"));

  section("Tab Học sinh của gia sư hiện nhãn");
  const tab = await fetch(`${BASE}/lop-cua-toi/quan-lop/${C.id}/hoc-vien`, { headers: { cookie: await cookieFor(T) } });
  const html = await tab.text();
  check("có khối Học thử với nhãn và hai nút", tab.status === 200 && html.includes("data-lop-hoc-thu") && html.includes("data-hoc-thu-xac-nhan") && html.includes("data-hoc-thu-gia-han") && /Học thử · còn \d+ ngày/.test(html) && html.includes("Hết hạn"), tab.status);
  check("em chính thức không có hàng học thử", !html.includes(`data-hoc-thu-row="${eWait.id}"`) && !html.includes(`data-hoc-thu-row="${eOff.id}"`));

  await done();
})();
