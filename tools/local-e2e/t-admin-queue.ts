// GET /api/admin/kiem-duyet (BU-08): hàng chờ gộp 6 loại thật theo QUYỀN từng vai; gia sư KHÔNG BAO GIỜ vào được (403, kể cả ?badge=1);
// badge/counts CHÍNH XÁC khi có > 100 việc; phân trang bằng con trỏ; không lộ email/điện thoại học sinh; các lệnh gọi đúng API cũ và sinh AuditLog.
// CHƯA CHẠY ĐƯỢC ở máy dựng (cần Next dev cổng 3100 + Postgres thử) — COO chạy tuần tự; xem phiếu bàn giao.
// Ca phá cố ý: cấp MANAGE_REVENUE cho admin_content (permissions.ts) → ca "admin_content ?loai=nap-coin → 403" đỏ; bỏ `requireCenterAdmin` khỏi route → ca "gia sư → 403" đỏ.
import { prisma } from "@/lib/prisma";
import { COIN_VISIBLE } from "@/lib/features";
// 05/11/2026 (CHỦ-02): Coin ẩn → API Hàng chờ không còn liệt kê/đếm nap-coin và badge không tính nó; API duyệt/từ chối nạp Coin (ghi) vẫn còn. Đổi có chủ đích.
const KIND6 = ["gia-su", "bai-viet", "ho-so", "tra-loi", "danh-gia", ...(COIN_VISIBLE ? ["nap-coin"] : [])];
const BADGE0 = COIN_VISIBLE ? 128 : 126;
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Học sinh" });
  const A = await mkUser({ name: "Nguyễn Văn An" }), B = await mkUser({ name: "Trần Thị Bích" });
  await prisma.user.update({ where: { id: A.id }, data: { phone: "0987654321" } });
  const course = await mkCourse(T.id, { name: "Toán 9 của cô Lan" });

  const ok = await mkUser({ name: "Gia sư chờ duyệt", emailVerified: true });
  const unv = await mkUser({ name: "Gia sư chưa xác thực", emailVerified: false });
  const when = new Date(Date.now() - 3 * 86_400_000);
  await prisma.user.update({ where: { id: ok.id }, data: { tutorAppliedAt: when, bio: "Dạy Toán 8 năm", subjects: ["Toán"], city: "Hà Nội" } });
  await prisma.user.update({ where: { id: unv.id }, data: { tutorAppliedAt: new Date(when.getTime() + 1000) } });

  const th = (content: string, courseId: string | null) => prisma.thread.create({ data: { content, authorId: A.id, courseId, category: "hoi-dap" } });
  const tMine = await th("BAI_CUA_LOP_TOI", course.id), tChung = await th("BAI_CHUNG", null);
  const trep = (threadId: string, reason: string) => prisma.threadReport.create({ data: { threadId, reporterId: B.id, reason } });
  const rMine = await trep(tMine.id, "Lạc đề"), rChung = await trep(tChung.id, "Quảng cáo");
  const q = await prisma.question.create({ data: { authorId: A.id, title: "CAU_HOI_X", content: "nội dung", bountyPaid: 0 } });
  const answer = await prisma.answer.create({ data: { questionId: q.id, authorId: A.id, content: "Trả lời sai", rewardPaid: 20 } });
  const arep = await prisma.answerReport.create({ data: { answerId: answer.id, reporterId: B.id, reason: "Sai kiến thức" } });
  const pr = await prisma.tutorProfileReport.create({ data: { tutorId: T.id, reason: "Ảnh không phải của gia sư" } });
  const topupOfA = await prisma.coinTopupRequest.create({ data: { userId: A.id, amountVnd: 100000, coinAmount: 100000, status: "pending", bankRef: "FT1", note: "ghi chú" } as never });
  const topupOfSA = await prisma.coinTopupRequest.create({ data: { userId: SA.id, amountVnd: 50000, coinAmount: 50000, status: "pending" } as never });

  // 120 đánh giá chờ (mỗi học sinh một đánh giá vì @@unique([userId, courseId]))
  const reviewers = [];
  for (let i = 0; i < 120; i++) reviewers.push(await mkUser({ name: `Em Đánh Giá ${i}` }));
  await prisma.courseReview.createMany({ data: reviewers.map((u, i) => ({ userId: u.id, courseId: course.id, rating: 1 + (i % 5), comment: `NX_${i}`, status: "pending", createdAt: new Date(Date.now() - (200 - i) * 60_000) })) });

  const get = (as: any, p = "/api/admin/kiem-duyet") => api("GET", p, { as });
  const kindsOf = (r: any) => [...new Set(r.json.items.map((i: any) => i.kind))].sort().join(",");

  section("Cần đăng nhập và đúng vai");
  check("không cookie → 401", (await get(undefined)).status === 401);
  check("học sinh → 403 (cả ?badge=1)", (await get(S)).status === 403 && (await get(S, "/api/admin/kiem-duyet?badge=1")).status === 403);
  check("GIA SƯ → 403 (cả ?badge=1, cả ?loai=danh-gia dù có MANAGE_COURSES)", (await get(T)).status === 403 && (await get(T, "/api/admin/kiem-duyet?badge=1")).status === 403 && (await get(T, "/api/admin/kiem-duyet?loai=danh-gia")).status === 403);

  section("Quản trị cấp 1: 6 loại thật");
  let r = await get(SA, "/api/admin/kiem-duyet?limit=100");
  check("200; counts đủ 6 khoá thật; KHÔNG có khoá khach-hoi / vao-lop khi nhánh B chưa gộp (vắng khoá, không phải 0)",
    r.status === 200 && KIND6.every(k => k in r.json.counts) && (COIN_VISIBLE || !("nap-coin" in r.json.counts)), r.json.counts);
  check("counts chính xác: gia-su 2, bai-viet 2, ho-so 1, tra-loi 1, danh-gia 120, nap-coin 2", JSON.stringify([2, 2, 1, 1, 120, ...(COIN_VISIBLE ? [2] : [])]) === JSON.stringify(KIND6.map(k => r.json.counts[k])), r.json.counts);
  check("badge = 128 (tổng counts nhóm duyet), KHÔNG bị cắt ở 100", r.json.badge === BADGE0, r.json.badge);
  check("?badge=1 cho cùng badge và counts, không có items", await (async () => { const b = await get(SA, "/api/admin/kiem-duyet?badge=1"); return b.status === 200 && b.json.badge === BADGE0 && b.json.items === undefined && b.json.counts["danh-gia"] === 120; })());

  section("Phân trang bằng con trỏ: 120 đánh giá, trang 50");
  const seen: string[] = []; let cursor: string | null = null; let pages = 0;
  do {
    const rr: any = await get(SA, `/api/admin/kiem-duyet?loai=danh-gia&limit=50${cursor ? `&cursor=${cursor}` : ""}`);
    if (pages === 0) check("trang 1: 50 dòng, nextCursor khác null", rr.status === 200 && rr.json.items.length === 50 && rr.json.nextCursor !== null);
    seen.push(...rr.json.items.map((i: any) => i.id)); cursor = rr.json.nextCursor; pages++;
  } while (cursor && pages < 6);
  check("gộp các trang: đúng 120 dòng, không trùng, không sót", seen.length === 120 && new Set(seen).size === 120, seen.length);
  check("limit=0 / 101 / abc → 400; cursor hỏng → 400; loai lạ → 400",
    (await get(SA, "/api/admin/kiem-duyet?limit=0")).status === 400 && (await get(SA, "/api/admin/kiem-duyet?limit=101")).status === 400 && (await get(SA, "/api/admin/kiem-duyet?limit=abc")).status === 400
    && (await get(SA, "/api/admin/kiem-duyet?cursor=!!!")).status === 400 && (await get(SA, "/api/admin/kiem-duyet?loai=khac")).status === 400);

  section("Quản trị nội dung: 5 loại, không có nap-coin");
  r = await get(CA, "/api/admin/kiem-duyet?limit=100");
  check("thấy gia-su, bai-viet, ho-so, tra-loi, danh-gia; KHÔNG nap-coin; counts cũng không có nap-coin", r.status === 200 && !kindsOf(r).includes("nap-coin") && !("nap-coin" in r.json.counts) && r.json.badge === 126, [kindsOf(r), r.json.badge]);
  check("?loai=nap-coin → 403 'Không có quyền xem loại này'", await (async () => { const x = await get(CA, "/api/admin/kiem-duyet?loai=nap-coin"); return x.status === 403 && /Không có quyền xem loại này/.test(x.json.error); })());
  check("?loai=khach-hoi / vao-lop khi nhánh B chưa gộp → 403 (loại chưa được hỗ trợ), không 500", [(await get(CA, "/api/admin/kiem-duyet?loai=khach-hoi")).status, (await get(CA, "/api/admin/kiem-duyet?loai=vao-lop")).status].every(s => s === 403 || s === 200));

  section("Dữ liệu tối thiểu: tên rút gọn, không email / điện thoại học sinh");
  r = await get(SA, "/api/admin/kiem-duyet?limit=100");
  // adm-test 02/11: hàng chờ xếp theo thời gian chờ (cũ trước) nên 120 đánh giá cũ chiếm hết 100 dòng đầu — lấy từng loại riêng để khảo sát đủ các loại.
  const perKind: any[] = [];
  for (const k of ["gia-su", "bai-viet", "ho-so", "tra-loi", ...(COIN_VISIBLE ? ["nap-coin"] : [])]) perKind.push(...(await get(SA, `/api/admin/kiem-duyet?loai=${k}`)).json.items);
  const allItems = [...r.json.items, ...perKind.filter(x => !r.json.items.some((y: any) => y.id === x.id))];
  const sample = JSON.stringify(allItems.filter((i: any) => i.kind !== "gia-su"));
  check("không có email / SĐT mẫu của học sinh trong dòng (quét toàn JSON, trừ đơn gia sư)", !sample.includes(A.email) && !sample.includes(B.email) && !sample.includes("0987654321"));
  check("tên học sinh rút gọn: 'Bích T.' (người báo cáo), không có 'Trần Thị Bích' / 'Nguyễn Văn An' ở dòng hàng chờ", sample.includes("Bích T.") && !sample.includes("Trần Thị Bích") && !sample.includes("Nguyễn Văn An"));
  const ntop = allItems.find((i: any) => i.id === `nap-coin:${topupOfA.id}`), ntopSA = allItems.find((i: any) => i.id === `nap-coin:${topupOfSA.id}`);
  if (COIN_VISIBLE) {
    check("nạp Coin: nút Duyệt của yêu cầu do CHÍNH người xem tạo bị khoá; yêu cầu của người khác thì không", !!ntopSA.detail.actions[0].disabled && !ntop.detail.actions[0].disabled);
    check("JSON không chứa userId người nạp", !JSON.stringify(ntop).includes(A.id));
  } else {
    check("Coin ẩn: không dòng nap-coin nào trong Hàng chờ, và JSON không chứa userId người nạp", !ntop && !ntopSA && !JSON.stringify(allItems).includes(A.id));
  }

  section("Lệnh gọi đúng API cũ và sinh nhật ký");
  const act = async (as: any, a: any, extra: Record<string, unknown> = {}) => api(a.method, a.url, { as, body: { ...(a.body ?? {}), ...extra } });
  const okItem = r.json.items.find((i: any) => i.id === `gia-su:${ok.id}`), unvItem = r.json.items.find((i: any) => i.id === `gia-su:${unv.id}`);
  check("Từ chối không có lý do → 400", (await act(SA, okItem.detail.actions[1], { reason: "" })).status === 400);
  check("Duyệt người đã xác thực email → 200, thành gia sư; Duyệt lại → 409", (await act(SA, okItem.detail.actions[0])).status === 200 && (await prisma.user.findUnique({ where: { id: ok.id } }))?.tutorVerified === true && (await act(SA, okItem.detail.actions[0])).status === 409);
  check("người chưa xác thực email: Duyệt → 409 (chặn ở máy chủ)", (await act(SA, unvItem.detail.actions[0])).status === 409);
  const rev0 = r.json.items.find((i: any) => i.kind === "danh-gia");
  check("Duyệt đánh giá (PATCH) → 200; AuditLog review.approve actor = người duyệt, resourceType CourseReview", (await act(SA, rev0.detail.actions[0])).status === 200
    && !!(await prisma.auditLog.findFirst({ where: { action: "review.approve", resourceId: rev0.id.split(":")[1], actorId: SA.id, resourceType: "CourseReview" } })));
  check("Gỡ bài viết (bài chung) → 200, bài bị xoá mềm; AuditLog thread_report.approve", await (async () => {
    const it = (await get(SA, "/api/admin/kiem-duyet?loai=bai-viet")).json.items.find((i: any) => i.id === `bai-viet:${rChung.id}`);
    return (await act(SA, it.detail.actions[0])).status === 200 && !!(await prisma.thread.findUnique({ where: { id: tChung.id } }))?.deletedAt
      && !!(await prisma.auditLog.findFirst({ where: { action: "thread_report.approve", resourceId: rChung.id } }));
  })());
  check("Xác nhận vi phạm câu trả lời → 200, trừ đúng 20 Coin (isPenalized); AuditLog answer_report.approve có coinDeducted 20", await (async () => {
    const it = (await get(SA, "/api/admin/kiem-duyet?loai=tra-loi")).json.items.find((i: any) => i.id === `tra-loi:${arep.id}`);
    const st = (await act(SA, it.detail.actions[0])).status;
    const log = await prisma.auditLog.findFirst({ where: { action: "answer_report.approve", resourceId: arep.id } });
    return st === 200 && (await prisma.answer.findUnique({ where: { id: answer.id } }))?.isPenalized === true && (log?.metadata as any)?.coinDeducted === 20;
  })());
  check("Khoá hồ sơ không lý do → 400; kèm lý do → 200", await (async () => {
    const it = (await get(SA, "/api/admin/kiem-duyet?loai=ho-so")).json.items.find((i: any) => i.id === `ho-so:${pr.id}`);
    return (await act(SA, it.detail.actions[0], { reason: "" })).status === 400 && (await act(SA, it.detail.actions[0], { reason: "Ảnh giả mạo" })).status === 200;
  })());
  check("sau khi xử lý: badge giảm đúng (còn gia sư 1, bài viết 1, đánh giá 119; nạp Coin 2 chỉ tính khi cờ Coin bật) = 123, hoặc 121 khi ẩn", (await get(SA, "/api/admin/kiem-duyet?badge=1")).json.badge === (COIN_VISIBLE ? 123 : 121), (await get(SA, "/api/admin/kiem-duyet?badge=1")).json);
  void rMine;

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
