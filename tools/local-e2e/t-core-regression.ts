// Hồi quy các route đang dùng `as unknown as` (che lỗi khỏi tsc): chạy với DB thật.
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { generatePortalToken } from "@/lib/parentPortal";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan"), other = await mkTutor("Thầy Khác");
  const stu = await mkUser({ name: "Em Học" }), stu2 = await mkUser({ name: "Em Hai" }), stranger = await mkUser({ name: "Người Lạ" });
  const parent = await mkUser({ name: "Phụ Huynh" });
  const c = await mkCourse(tutor.id, { name: "Toán 9" }), c2 = await mkCourse(tutor.id, { name: "Lý 9" });
  for (const [u, k] of [[stu, c], [stu, c2], [stu2, c]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: k.id, status: "active" } });
  const YM = "2026-10";

  section("Số buổi tháng (PUT/GET /api/courses/[id]/fees)");
  const f1 = await api("PUT", `/api/courses/${c.id}/fees`, { as: tutor, body: { yearMonth: YM, sessionCount: 8, freeCount: 1 } });
  check("PUT 200 + lưu 8/1", f1.status === 200 && f1.json.fee.sessionCount === 8 && f1.json.fee.freeCount === 1, f1);
  const f1b = await api("PUT", `/api/courses/${c.id}/fees`, { as: tutor, body: { yearMonth: YM, sessionCount: 9, freeCount: 1 } });
  check("PUT lại = upsert (không trùng bản ghi)", f1b.status === 200 && (await prisma.monthlyCourseFee.count({ where: { courseId: c.id } })) === 1, f1b);
  await api("PUT", `/api/courses/${c2.id}/fees`, { as: tutor, body: { yearMonth: YM, sessionCount: 4 } });
  check("GET trả bản ghi", (await api("GET", `/api/courses/${c.id}/fees?yearMonth=${YM}`, { as: tutor })).json?.fee?.sessionCount === 9);
  check("freeCount > sessionCount → 400", (await api("PUT", `/api/courses/${c.id}/fees`, { as: tutor, body: { yearMonth: YM, sessionCount: 3, freeCount: 5 } })).status === 400);
  check("sessionCount âm → 400", (await api("PUT", `/api/courses/${c.id}/fees`, { as: tutor, body: { yearMonth: YM, sessionCount: -1 } })).status === 400);
  check("yearMonth sai → 400", (await api("PUT", `/api/courses/${c.id}/fees`, { as: tutor, body: { yearMonth: "10/2026", sessionCount: 3 } })).status === 400);
  check("gia sư khác lớp → 403", (await api("PUT", `/api/courses/${c.id}/fees`, { as: other, body: { yearMonth: YM, sessionCount: 3 } })).status === 403);
  check("học viên → 403", (await api("PUT", `/api/courses/${c.id}/fees`, { as: stu, body: { yearMonth: YM, sessionCount: 3 } })).status === 403);

  section("Học phí 1 học viên (GET /api/users/[id]/tuition)");
  const t1 = await api("GET", `/api/users/${stu.id}/tuition?yearMonth=${YM}`, { as: stu });
  // 2 môn → 60.000/buổi. Toán: (9-1)=8 buổi × 60k = 480k; Lý: 4 × 60k = 240k → 720k
  check("em tự xem: 2 môn × 60k → 720.000", t1.status === 200 && t1.json.breakdown.finalAmount === 720_000, t1.json);
  check("gia sư của lớp xem được", (await api("GET", `/api/users/${stu.id}/tuition?yearMonth=${YM}`, { as: tutor })).status === 200);
  check("gia sư KHÁC → 403", (await api("GET", `/api/users/${stu.id}/tuition?yearMonth=${YM}`, { as: other })).status === 403);
  check("học viên khác → 403", (await api("GET", `/api/users/${stu.id}/tuition?yearMonth=${YM}`, { as: stranger })).status === 403);
  const t2 = await api("GET", `/api/users/${stu.id}/tuition?yearMonth=${YM}&scholarship=100000&discount=20000`, { as: tutor });
  check("học bổng + giảm trừ trừ vào: 720k − 120k = 600.000", t2.json.breakdown.finalAmount === 600_000, t2.json);
  await prisma.tuitionOverride.create({ data: { userId: stu.id, pricePerSession: 40_000, updatedBy: tutor.id } });
  const t3 = await api("GET", `/api/users/${stu.id}/tuition?yearMonth=${YM}`, { as: stu });
  check("giá riêng 40k thắng bậc thang: 12 buổi × 40k = 480.000", t3.json.breakdown.finalAmount === 480_000 && t3.json.breakdown.overrideUsed === true, t3.json);
  check("yearMonth sai → 400", (await api("GET", `/api/users/${stu.id}/tuition?yearMonth=abc`, { as: stu })).status === 400);

  section("Điểm danh (sessions + records)");
  const s1 = await api("POST", `/api/courses/${c.id}/attendance-sessions`, { as: tutor, body: { date: "2026-10-05" } });
  check("tạo buổi 201", s1.status === 201 && s1.json.id, s1);
  const sid = s1.json.id;
  check("trùng ngày → 409", (await api("POST", `/api/courses/${c.id}/attendance-sessions`, { as: tutor, body: { date: "2026-10-05T15:00:00Z" } })).status === 409);
  check("ngày sai → 400", (await api("POST", `/api/courses/${c.id}/attendance-sessions`, { as: tutor, body: { date: "không phải ngày" } })).status === 400);
  check("gia sư khác không tạo được → 403", (await api("POST", `/api/courses/${c.id}/attendance-sessions`, { as: other, body: { date: "2026-10-06" } })).status === 403);
  const g1 = await api("GET", `/api/attendance-sessions/${sid}`, { as: tutor });
  check("roster 2 em, chưa ai có status", g1.status === 200 && g1.json.roster.length === 2 && g1.json.roster.every((r: any) => r.status === null), g1.json);
  const p1 = await api("PUT", `/api/attendance-sessions/${sid}`, { as: tutor, body: { records: [{ userId: stu.id, status: "present" }, { userId: stu2.id, status: "late", note: "kẹt xe" }] } });
  check("PUT records 200", p1.status === 200 && p1.json.count === 2, p1);
  const g2 = await api("GET", `/api/attendance-sessions/${sid}`, { as: tutor });
  check("sau khi lưu: present + late(kẹt xe)", g2.json.roster.find((r: any) => r.userId === stu2.id)?.status === "late" && g2.json.roster.find((r: any) => r.userId === stu2.id)?.note === "kẹt xe", g2.json);
  await api("PUT", `/api/attendance-sessions/${sid}`, { as: tutor, body: { records: [{ userId: stu.id, status: "absent" }] } });
  check("sửa lại = upsert (vẫn 2 record)", (await prisma.attendanceRecord.count({ where: { sessionId: sid } })) === 2);
  check("status lạ → 400", (await api("PUT", `/api/attendance-sessions/${sid}`, { as: tutor, body: { records: [{ userId: stu.id, status: "ngủ" }] } })).status === 400);
  check("em không thuộc lớp → 400", (await api("PUT", `/api/attendance-sessions/${sid}`, { as: tutor, body: { records: [{ userId: stranger.id, status: "present" }] } })).status === 400);
  check("gia sư khác → 403", (await api("PUT", `/api/attendance-sessions/${sid}`, { as: other, body: { records: [] } })).status === 403);
  check("danh sách buổi có đếm sĩ số", (await api("GET", `/api/courses/${c.id}/attendance-sessions`, { as: tutor })).json.items[0]._count.records === 2);
  const d1 = await api("DELETE", `/api/attendance-sessions/${sid}`, { as: tutor });
  check("xoá buổi xoá luôn record", d1.status === 200 && (await prisma.attendanceRecord.count({ where: { sessionId: sid } })) === 0, d1);

  section("Token Sổ của con (portal-token) + cổng phụ huynh");
  const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: stu.id, status: "verified", verifiedAt: new Date() } });
  const pending = await prisma.parentLink.create({ data: { parentId: stranger.id, studentId: stu2.id, status: "pending" } });
  const rot = await api("POST", `/api/parent-links/${link.id}/portal-token`, { as: stu });
  check("em tự tạo token 200 + url", rot.status === 200 && /^[0-9a-f]{32}$/.test(rot.json.portalToken) && rot.json.url === `/so-cua-con/${rot.json.portalToken}`, rot);
  const tok1 = rot.json.portalToken;
  const rot2 = await api("POST", `/api/parent-links/${link.id}/portal-token`, { as: parent });
  check("phụ huynh rotate: token mới khác", rot2.status === 200 && rot2.json.portalToken !== tok1);
  check("token cũ chết ngay (404)", (await api("GET", `/api/parent-portal/${tok1}`)).status === 404);
  check("người lạ không rotate được → 403", (await api("POST", `/api/parent-links/${link.id}/portal-token`, { as: stranger })).status === 403);
  check("liên kết chưa verified → 409", (await api("POST", `/api/parent-links/${pending.id}/portal-token`, { as: stranger })).status === 409);
  const tok2 = rot2.json.portalToken;
  const pp = await api("GET", `/api/parent-portal/${tok2}?yearMonth=${YM}`);
  check("cổng phụ huynh 200 với đủ 2 môn", pp.status === 200 && pp.json.courses.length === 2, { s: pp.status, t: pp.text.slice(0, 200) });
  check("cổng KHÔNG lộ email/SĐT của em", !JSON.stringify(pp.json).includes("@test.local"));
  check("tổng cổng = tổng phiếu học phí (giá riêng 40k × 12 = 480.000)", pp.json.total?.finalAmount === 480_000, pp.json.total);
  check("token rác → 404", (await api("GET", `/api/parent-portal/${"z".repeat(32)}`)).status === 404);
  const rev = await api("DELETE", `/api/parent-links/${link.id}/portal-token`, { as: stu });
  check("revoke 200", rev.status === 200, rev);
  check("sau revoke link chết", (await api("GET", `/api/parent-portal/${tok2}`)).status === 404);
  check("revoke lần 2 idempotent", (await api("DELETE", `/api/parent-links/${link.id}/portal-token`, { as: stu })).json?.alreadyRevoked === true);

  section("Nạp Coin: danh sách + từ chối + lịch sử ví");
  const sup = await mkSuper("Admin");
  const tp = await api("POST", "/api/wallet/topups", { as: tutor, body: { amountVnd: 200000, bankRef: "FT111" } });
  check("tạo yêu cầu nạp 201", tp.status === 201, tp);
  check("user xem danh sách của mình", (await api("GET", "/api/wallet/topups", { as: tutor })).json.items.length === 1);
  const al = await api("GET", "/api/admin/topups?status=pending", { as: sup });
  check("admin thấy yêu cầu chờ", al.status === 200 && al.json.items.length === 1, al);
  check("gia sư không vào được danh sách admin", (await api("GET", "/api/admin/topups", { as: tutor })).status === 403);
  const rj = await api("POST", `/api/admin/topups/${tp.json.request.id}/reject`, { as: sup, body: { reason: "Không thấy tiền" } });
  check("từ chối 200", rj.status === 200, rj);
  check("từ chối lần 2 → 409", (await api("POST", `/api/admin/topups/${tp.json.request.id}/reject`, { as: sup, body: { reason: "x" } })).status === 409);
  check("từ chối không cộng Coin", ((await prisma.wallet.findUnique({ where: { userId: tutor.id } }))?.balance ?? 0) === 0);
  const tp2 = await api("POST", "/api/wallet/topups", { as: tutor, body: { amountVnd: 100000 } });
  const ap = await api("POST", `/api/admin/topups/${tp2.json.request.id}/approve`, { as: sup });
  check("duyệt cộng 100.000", ap.status === 200 && ap.json.newBalance === 100_000, ap);
  const apAgain = await Promise.all([1, 2].map(() => api("POST", `/api/admin/topups/${tp2.json.request.id}/approve`, { as: sup })));
  check("duyệt lại: cả 2 đều bị từ chối (409), không cộng đôi", apAgain.every(r => r.status === 409) && (await prisma.wallet.findUnique({ where: { userId: tutor.id } }))?.balance === 100_000, apAgain.map(r => r.status));
  const wt = await api("GET", "/api/wallet/transactions?sourceType=topup", { as: tutor });
  check("lịch sử ví lọc theo nguồn: 1 giao dịch topup", wt.status === 200 && wt.json.items.length === 1 && wt.json.items[0].amount === 100_000, wt.json);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
