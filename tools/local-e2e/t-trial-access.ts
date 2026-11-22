// SCL đợt 5 (D5, D7, D8, tình huống 11–13) — học thử hết hạn bị CHẶN Ở MÁY CHỦ (tài liệu / bài tập), mở đồng hồ khi vào lớp, cron lật đúng và chỉ đúng em,
// chủ lớp / Chủ nhiệm xác nhận chính thức hoặc gia hạn thì mở lại.
// SCL đợt 5 (sửa sau rà): thêm /api/media stream + file, /thu-vien, /api/deadlines, phạm vi thảo luận lớp, mở đồng hồ ở MỌI đường trả học liệu (không ở lúc dựng
// trang GET), và đường tiền (học phí / lập phiếu) không tính em học thử. Ca phá cố ý: bỏ trialDays/trialStartedAt khỏi select ở media/stream ⇒ ca "video 403" đỏ. Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-trial-access.ts
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
  // Tài liệu KiN (tệp cục bộ) + video KiN của bài, để thử thẳng /api/media/<id>/file và /stream.
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { localPathFor } = await import("@/lib/mediaStorageServer");
  const fDoc = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: C.id, kind: "document", driver: "local", storageKey: "", mimeType: "application/pdf", bytes: 9, originalName: "tl.pdf", status: "ready" } });
  const docKey = `${C.id}/${fDoc.id}-tl.pdf`;
  mkdirSync(localPathFor(`${C.id}/x`).replace(/\/x$/, ""), { recursive: true });
  writeFileSync(localPathFor(docKey), Buffer.from("%PDF-1.4\n"));
  await prisma.fileAsset.update({ where: { id: fDoc.id }, data: { storageKey: docKey } });
  const fVid = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: C.id, kind: "video", driver: "local", storageKey: "v/khong-co.mp4", mimeType: "video/mp4", bytes: 5, originalName: "v.mp4", status: "ready" } });
  await prisma.lesson.update({ where: { id: "l-tr" }, data: {
    videoUrl: `kin-media:${fVid.id}`, azotaDeadline: "2099-01-01T10:00",
    documents: JSON.stringify([{ name: "De.pdf", url: "https://example.com/de.pdf" }, { name: "TL", url: `/api/media/${fDoc.id}/file`, type: "pdf" }]),
  } });
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

  section("Hết hạn chưa lật: các đường KHÔNG qua bài học cũng chặn (media, thư viện, hạn nộp, thảo luận)");
  const vid = await api("GET", `/api/media/${fVid.id}/stream`, { as: EXP });
  check("GET /api/media/<video>/stream ⇒ 403", vid.status === 403, vid.status);
  check("em đang thử: stream KHÔNG bị 403 (qua quyền; tệp giả nên 404)", (await api("GET", `/api/media/${fVid.id}/stream`, { as: LIVE })).status !== 403);
  const fil = await api("GET", `/api/media/${fDoc.id}/file`, { as: EXP });
  check("GET /api/media/<tệp>/file ⇒ 403", fil.status === 403, fil.status);
  check("em đang thử: tải tệp 200", (await api("GET", `/api/media/${fDoc.id}/file`, { as: LIVE })).status === 200);
  const tvExp = await (await fetch(`${BASE}/thu-vien`, { headers: { cookie: await cookieFor(EXP) } })).text();
  check("/thu-vien của em hết hạn: không có link tài liệu / mã tệp", !tvExp.includes("example.com/de.pdf") && !tvExp.includes(fDoc.id));
  const tvLive = await (await fetch(`${BASE}/thu-vien`, { headers: { cookie: await cookieFor(LIVE) } })).text();
  check("/thu-vien của em đang thử: có tài liệu (đối chứng)", tvLive.includes("example.com/de.pdf") || tvLive.includes(fDoc.id));
  const dl = await api("GET", "/api/deadlines", { as: EXP });
  check("/api/deadlines của em hết hạn: không có bài của lớp", dl.status === 200 && !dl.text.includes("l-tr"), dl.text.slice(0, 200));
  check("/api/deadlines của em đang thử: có (đối chứng)", (await api("GET", "/api/deadlines", { as: LIVE })).text.includes("l-tr"));
  const sc = await api("GET", "/api/community/scope-options", { as: EXP });
  check("phạm vi thảo luận lớp của em hết hạn: không có lớp", sc.status === 200 && !sc.text.includes(C.id), sc.text.slice(0, 200));
  check("phạm vi thảo luận lớp của em đang thử: có lớp (đối chứng)", (await api("GET", "/api/community/scope-options", { as: LIVE })).text.includes(C.id));

  section("Mở đồng hồ (D5): KHÔNG lúc dựng trang GET (prefetch, ?course= lạ), mà ở mọi đường trả học liệu");
  const PEEK = await mkUser({ name: "Em Mới Thấy Thẻ" });
  const ePeek = await prisma.enrollment.create({ data: { userId: PEEK.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: null } });
  const hpPeek = await fetch(`${BASE}/student/hoc-tap?course=${C2.id}`, { headers: { cookie: await cookieFor(PEEK) } });
  check("dựng trang lớp (kể cả ?course= không phải lớp của em) ⇒ 200 nhưng CHƯA tính ngày", hpPeek.status === 200 && (await prisma.enrollment.findUnique({ where: { id: ePeek.id } }))?.trialStartedAt === null, hpPeek.status);
  const t0 = Date.now();
  const hp = await api("GET", `/api/courses/${C.id}`, { as: NEW });
  check("trang lớp tải /api/courses/<lớp> ⇒ 200, băng 'bắt đầu tính từ hôm nay'", hp.status === 200 && hp.json?.trial?.kind === "chua_bat_dau", hp.json?.trial);
  const [n1, n2] = await Promise.all([prisma.enrollment.findUnique({ where: { id: eNew.id } }), prisma.enrollment.findUnique({ where: { id: eNew2.id } })]);
  check("cả 2 lớp thử của em có trialStartedAt, CÙNG một mốc", !!n1?.trialStartedAt && n1.trialStartedAt.getTime() >= t0 - 2000 && n1.trialStartedAt.getTime() === n2?.trialStartedAt?.getTime(), [n1?.trialStartedAt, n2?.trialStartedAt]);
  await api("GET", `/api/courses/${C.id}`, { as: NEW });
  check("mở lần hai không dời mốc", (await prisma.enrollment.findUnique({ where: { id: eNew.id } }))?.trialStartedAt?.getTime() === n1?.trialStartedAt?.getTime());
  check("em chính thức không bị đặt mốc", (await prisma.enrollment.findUnique({ where: { id: eOff.id } }))?.trialDays === null);

  for (const [name, hit] of [
    ["/thu-vien", async (u: any) => (await fetch(`${BASE}/thu-vien`, { headers: { cookie: await cookieFor(u) } })).text()],
    ["/api/media/<tệp>/file", (u: any) => api("GET", `/api/media/${fDoc.id}/file`, { as: u })],
    ["/api/media/<video>/stream", (u: any) => api("GET", `/api/media/${fVid.id}/stream`, { as: u })],
    ["/api/lessons/<id>", (u: any) => api("GET", `/api/lessons/l-tr`, { as: u })],
  ] as const) {
    const U = await mkUser({ name: "Em Chưa Mở " + name });
    const e = await prisma.enrollment.create({ data: { userId: U.id, courseId: C.id, status: "active", trialDays: 14, trialStartedAt: null } });
    await hit(U);
    check(`em chưa bắt đầu xem qua ${name} ⇒ đồng hồ bắt đầu`, !!(await prisma.enrollment.findUnique({ where: { id: e.id } }))?.trialStartedAt);
  }

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

  section("Đường tiền: em học thử không vào học phí / lập phiếu (P1 rà SCL5) — ca lập phiếu cần máy chủ bật NEXT_PUBLIC_KIN_MO_HOC_PHI=1");
  const C3 = await mkCourse(T.id, { name: "BCA Địa" }), C4 = await mkCourse(T.id, { name: "BCA Anh" });
  const MIX = await mkUser({ name: "Em Chính Một Thử Một" }), TRY = await mkUser({ name: "Em Chỉ Học Thử" });
  await prisma.enrollment.create({ data: { userId: MIX.id, courseId: C3.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: MIX.id, courseId: C4.id, status: "active", trialDays: 14, trialStartedAt: days(1) } });
  await prisma.enrollment.create({ data: { userId: TRY.id, courseId: C3.id, status: "active", trialDays: 14, trialStartedAt: days(1) } });
  // Có số buổi tháng cho CẢ HAI lớp ⇒ nếu thiếu chốt chặn, invoiceServer sẽ lập phiếu thật (2 môn) — ca dưới mới đỏ được.
  for (const cid of [C3.id, C4.id]) await prisma.monthlyCourseFee.create({ data: { courseId: cid, yearMonth: "2026-11", sessionCount: 8, updatedBy: T.id } });
  const tu = await api("GET", `/api/users/${MIX.id}/tuition?yearMonth=2026-11`, { as: MIX });
  check("bảng học phí của em: chỉ 1 môn (môn học thử KHÔNG vào bậc thang)", tu.status === 200 && tu.json?.breakdown?.subjectCount === 1 && tu.json.breakdown.perSubject[0].courseId === C3.id, tu.json?.breakdown);
  check("bảng học phí em chỉ học thử: 0 môn", (await api("GET", `/api/users/${TRY.id}/tuition?yearMonth=2026-11`, { as: TRY })).json?.breakdown?.subjectCount === 0);
  const inv = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: "2026-11" } });
  if (inv.json?.code === "feature_paused") {
    // Cờ HOC_PHI tắt (mặc định): API ghi học phí đóng hẳn ⇒ không ai lập phiếu được. Bốn ca lập phiếu chạy ở lượt máy chủ bật NEXT_PUBLIC_KIN_MO_HOC_PHI=1.
    check("cờ HOC_PHI tắt: lập phiếu đóng (404 feature_paused) — CHƯA chạy ca lập phiếu, cần lượt bật cờ", inv.status === 404, inv.status);
    await done(); return;
  }
  const ids = (k: string) => (inv.json?.[k] ?? []).map((x: any) => x.studentId);
  check("lập phiếu hàng loạt: em chỉ học thử KHÔNG có trong danh sách", inv.status < 300 && ![...ids("created"), ...ids("skipped")].includes(TRY.id), inv.json);
  check("lập phiếu hàng loạt: em có môn học thử ⇒ bỏ qua vì học thử, không phiếu", (inv.json?.skipped ?? []).some((x: any) => x.studentId === MIX.id && /học thử/.test(x.reason)) && !ids("created").includes(MIX.id), inv.json?.skipped);
  const inv1 = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: "2026-11", studentIds: [TRY.id] } });
  check("lập phiếu đích danh em học thử ⇒ không tạo phiếu", (inv1.json?.created ?? []).length === 0 && (await prisma.tuitionInvoice.count({ where: { studentId: { in: [TRY.id, MIX.id] } } })) === 0, inv1.json);

  await done();
})();
