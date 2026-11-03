// BU-08 mục 7 — các chỗ xử lý hàng chờ TRƯỚC ĐÂY không ghi AuditLog: thread-reports/resolve, answer-reports/resolve (trừ Coin), reviews PATCH/DELETE.
// Quy tắc: ghi SAU khi trạng thái đã lật thành công (409/403 KHÔNG ghi); actor = người xử lý; metadata không tên / nội dung.
// Đã chạy trên máy test (02/11/2026) (cần Next dev cổng 3100 + Postgres thử) — COO chạy tuần tự.
// Ca phá cố ý: xoá `logAction` khỏi DELETE của reviews/[id]/route.ts → ca "review.delete" đỏ; đặt `logAction` của answer-reports TRƯỚC `updateMany`
// (ghi cả khi thua cuộc đua) → ca "2 lần bấm đồng thời → đúng 1 dòng log" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const kidName = "Nguyễn Bé Bí Mật";
  const kid = await mkUser({ name: kidName }), rep = await mkUser({ name: "Người Báo Cáo" });
  const mine = await mkCourse(T.id, { name: "Lớp của cô Lan" });
  const logs = (action: string, resourceId: string) => prisma.auditLog.findMany({ where: { action, resourceId } });
  const noName = (l: unknown) => !JSON.stringify(l).includes(kidName) && !JSON.stringify(l).includes("Bí Mật");

  section("thread-reports/resolve");
  const mkThread = async (courseId: string | null) => { const t = await prisma.thread.create({ data: { content: "Nội dung cần xử lý", authorId: kid.id, courseId, category: "hoi-dap" } }); const r = await prisma.threadReport.create({ data: { threadId: t.id, reporterId: rep.id, reason: "x" } }); return { t, r }; };
  const g1 = await mkThread(null), g2 = await mkThread(null), g3 = await mkThread(mine.id);
  check("gỡ bài (approved) → 200 + 1 dòng thread_report.approve, actor = người xử lý, metadata { threadId }", await (async () => {
    const x = await api("POST", `/api/admin/thread-reports/${g1.r.id}/resolve`, { as: SA, body: { decision: "approved" } });
    const l = await logs("thread_report.approve", g1.r.id);
    return x.status === 200 && l.length === 1 && l[0].actorId === SA.id && l[0].resourceType === "ThreadReport" && (l[0].metadata as any)?.threadId === g1.t.id && noName(l);
  })());
  check("giữ bài (rejected) → 200 + 1 dòng thread_report.reject", await (async () => {
    const x = await api("POST", `/api/admin/thread-reports/${g2.r.id}/resolve`, { as: CA, body: { decision: "rejected" } });
    const l = await logs("thread_report.reject", g2.r.id);
    return x.status === 200 && l.length === 1 && l[0].actorId === CA.id;
  })());
  check("xử lý lần 2 → 409 và KHÔNG thêm dòng log", (await api("POST", `/api/admin/thread-reports/${g1.r.id}/resolve`, { as: SA, body: { decision: "approved" } })).status === 409 && (await logs("thread_report.approve", g1.r.id)).length === 1);
  check("gia sư khác chủ lớp → 403 và KHÔNG ghi log", (await api("POST", `/api/admin/thread-reports/${g3.r.id}/resolve`, { as: T2, body: { decision: "approved" } })).status === 403 && (await logs("thread_report.approve", g3.r.id)).length === 0);
  check("gia sư CHỦ LỚP vẫn xử lý được báo cáo bài trong lớp mình (đường /lop-cua-toi/kiem-duyet giữ nguyên) và có log", (await api("POST", `/api/admin/thread-reports/${g3.r.id}/resolve`, { as: T, body: { decision: "rejected" } })).status === 200 && (await logs("thread_report.reject", g3.r.id)).length === 1);
  check("decision sai → 400 và không log", (await api("POST", `/api/admin/thread-reports/${g1.r.id}/resolve`, { as: SA, body: { decision: "x" } })).status === 400);

  section("answer-reports/resolve (có thể trừ Coin)");
  const q = await prisma.question.create({ data: { authorId: kid.id, title: "Câu hỏi", content: "nội dung", bountyPaid: 0 } });
  const mkAns = async (reward: number) => { const a = await prisma.answer.create({ data: { questionId: q.id, authorId: kid.id, content: "tl", rewardPaid: reward } }); const r = await prisma.answerReport.create({ data: { answerId: a.id, reporterId: rep.id, reason: "sai" } }); return { a, r }; };
  const p1 = await mkAns(30), p0 = await mkAns(0), pk = await mkAns(10);
  await prisma.wallet.upsert({ where: { userId: kid.id }, create: { userId: kid.id, balance: 100 }, update: { balance: 100 } });
  check("xác nhận vi phạm có thưởng 30 → 200, ví 100 → 70, log answer_report.approve { penalized:true, coinDeducted:30 }", await (async () => {
    const x = await api("POST", `/api/admin/answer-reports/${p1.r.id}/resolve`, { as: SA, body: { decision: "approved" } });
    const l = await logs("answer_report.approve", p1.r.id);
    return x.status === 200 && (await prisma.wallet.findUnique({ where: { userId: kid.id } }))?.balance === 70 && l.length === 1 && (l[0].metadata as any)?.penalized === true && (l[0].metadata as any)?.coinDeducted === 30 && (l[0].metadata as any)?.answerId === p1.a.id && noName(l);
  })());
  check("xác nhận vi phạm KHÔNG có thưởng → coinDeducted 0 (số nguyên, ghi cả khi 0)", await (async () => {
    const x = await api("POST", `/api/admin/answer-reports/${p0.r.id}/resolve`, { as: SA, body: { decision: "approved" } });
    const l = await logs("answer_report.approve", p0.r.id);
    return x.status === 200 && l.length === 1 && (l[0].metadata as any)?.coinDeducted === 0 && (l[0].metadata as any)?.penalized === true;
  })());
  check("bỏ qua báo cáo (rejected) → log answer_report.reject, ví không đổi", await (async () => {
    const before = (await prisma.wallet.findUnique({ where: { userId: kid.id } }))?.balance;
    const x = await api("POST", `/api/admin/answer-reports/${pk.r.id}/resolve`, { as: SA, body: { decision: "rejected" } });
    return x.status === 200 && (await logs("answer_report.reject", pk.r.id)).length === 1 && (await prisma.wallet.findUnique({ where: { userId: kid.id } }))?.balance === before;
  })());
  check("2 lần bấm ĐỒNG THỜI trên báo cáo có thưởng → đúng 1 dòng log và đúng 1 lần trừ", await (async () => {
    const c = await mkAns(20);
    await prisma.wallet.update({ where: { userId: kid.id }, data: { balance: 100 } });
    const rs = await Promise.all([1, 2, 3].map(() => api("POST", `/api/admin/answer-reports/${c.r.id}/resolve`, { as: SA, body: { decision: "approved" } })));
    return rs.filter(x => x.status === 200).length === 1 && rs.filter(x => x.status === 409).length === 2
      && (await logs("answer_report.approve", c.r.id)).length === 1 && (await prisma.wallet.findUnique({ where: { userId: kid.id } }))?.balance === 80;
  })());
  check("gia sư → 403 và không log", await (async () => { const c = await mkAns(5); return (await api("POST", `/api/admin/answer-reports/${c.r.id}/resolve`, { as: T, body: { decision: "approved" } })).status === 403 && (await logs("answer_report.approve", c.r.id)).length === 0; })());

  section("reviews PATCH / DELETE");
  const mkRev = async () => { const u = await mkUser({ name: "Em Đánh Giá" }); return prisma.courseReview.create({ data: { userId: u.id, courseId: mine.id, rating: 5, comment: "Rất hay", status: "pending" } }); };
  const v1 = await mkRev(), v2 = await mkRev(), v3 = await mkRev();
  check("PATCH approved → 200 + review.approve { courseId }, actor = người duyệt", await (async () => {
    const x = await api("PATCH", `/api/admin/reviews/${v1.id}`, { as: SA, body: { status: "approved" } });
    const l = await logs("review.approve", v1.id);
    return x.status === 200 && l.length === 1 && l[0].actorId === SA.id && l[0].resourceType === "CourseReview" && (l[0].metadata as any)?.courseId === mine.id && !JSON.stringify(l).includes("Rất hay");
  })());
  check("PATCH rejected → review.reject", (await api("PATCH", `/api/admin/reviews/${v2.id}`, { as: CA, body: { status: "rejected" } })).status === 200 && (await logs("review.reject", v2.id)).length === 1);
  check("PATCH trạng thái sai → 400, không log", (await api("PATCH", `/api/admin/reviews/${v3.id}`, { as: SA, body: { status: "pending" } })).status === 400 && (await prisma.auditLog.count({ where: { resourceId: v3.id } })) === 0);
  // BU-08 rà soát: người thua cuộc đua không lật quyết định của người thắng; không ghi nhật ký lần hai.
  const raceRev = await mkRev();
  const rr = await Promise.all([api("PATCH", `/api/admin/reviews/${raceRev.id}`, { as: SA, body: { status: "approved" } }), api("PATCH", `/api/admin/reviews/${raceRev.id}`, { as: CA, body: { status: "rejected" } })]);
  const finalSt = (await prisma.courseReview.findUnique({ where: { id: raceRev.id } }))?.status;
  check("hai quản trị xử lý cùng một đánh giá: đúng 1 bên 200, bên kia 409; trạng thái cuối = của bên thắng; đúng 1 dòng nhật ký", rr.filter(x => x.status === 200).length === 1 && rr.filter(x => x.status === 409).length === 1
    && ((rr[0].status === 200 && finalSt === "approved") || (rr[1].status === 200 && finalSt === "rejected")) && (await prisma.auditLog.count({ where: { resourceId: raceRev.id } })) === 1, [rr.map(x => x.status), finalSt]);
  check("đánh giá ĐÃ xử lý: PATCH lại (đổi ý) → 409, trạng thái không đổi, không thêm nhật ký", await (async () => {
    const before = await prisma.auditLog.count({ where: { resourceId: v1.id } });
    const again = await api("PATCH", `/api/admin/reviews/${v1.id}`, { as: SA, body: { status: "rejected" } });
    return again.status === 409 && (await prisma.courseReview.findUnique({ where: { id: v1.id } }))?.status === "approved" && (await prisma.auditLog.count({ where: { resourceId: v1.id } })) === before;
  })());
  check("gia sư KHÔNG sở hữu lớp → 403, không log; id không tồn tại → 404, không log",(await api("PATCH", `/api/admin/reviews/${v3.id}`, { as: T2, body: { status: "approved" } })).status === 403 && (await api("PATCH", `/api/admin/reviews/khong-co`, { as: SA, body: { status: "approved" } })).status === 404 && (await prisma.auditLog.count({ where: { resourceId: v3.id } })) === 0);
  check("DELETE → 200 + review.delete { courseId }", (await api("DELETE", `/api/admin/reviews/${v3.id}`, { as: SA })).status === 200 && (await logs("review.delete", v3.id)).length === 1 && !(await prisma.courseReview.findUnique({ where: { id: v3.id } })));
  check("DELETE lần 2 (đã xoá) → 404, KHÔNG thêm log", (await api("DELETE", `/api/admin/reviews/${v3.id}`, { as: SA })).status === 404 && (await logs("review.delete", v3.id)).length === 1);

  section("Nhật ký đọc được (nhãn) và lọc theo nhóm");
  const nk = await api("GET", "/api/admin/nhat-ky?nhom=duyet", { as: SA });
  check("nhom=duyet trả các dòng duyệt, nhãn tiếng Việt, KHÔNG có metadata / tên trẻ", nk.status === 200 && nk.json.rows.length >= 6 && nk.json.rows.every((x: any) => !/ · /.test(x.actionLabel)) && !nk.text.includes(kidName) && !("metadata" in nk.json.rows[0]), nk.json.rows?.map((x: any) => x.action));
  check("nhom=tien KHÔNG chứa các dòng duyệt ở trên", (await api("GET", "/api/admin/nhat-ky?nhom=tien", { as: SA })).json.rows.every((x: any) => !/^(review|thread_report|answer_report)\./.test(x.action)));
  check("nhom lạ bị bỏ (trả toàn bộ, không 400/500)", (await api("GET", "/api/admin/nhat-ky?nhom=%27%3Bdrop", { as: SA })).status === 200);
  check("admin_content → 403 (nhật ký chỉ cấp 1)", (await api("GET", "/api/admin/nhat-ky?nhom=duyet", { as: CA })).status === 403);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
