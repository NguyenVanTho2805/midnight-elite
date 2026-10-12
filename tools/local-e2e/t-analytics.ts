import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

async function topupAndApprove(u: any, sup: any, amountVnd: number) {
  const c = await api("POST", "/api/wallet/topups", { as: u, body: { amountVnd, bankRef: "FT" + Math.random().toString(36).slice(2, 8) } });
  if (c.status !== 201) throw new Error("topup create " + JSON.stringify(c.json));
  const a = await api("POST", `/api/admin/topups/${c.json.request.id}/approve`, { as: sup });
  if (a.status !== 200) throw new Error("topup approve " + JSON.stringify(a.json));
}

(async () => {
  await wipe();
  const sup = await mkSuper("Super");
  const contentAdmin = await mkUser({ role: "admin", adminRole: "admin_content", name: "Content" });
  const t1 = await mkTutor("Cô Lan");
  const t2 = await mkTutor("Thầy Minh");
  const t3 = await mkTutor("Cô Chưa Mua");
  const s1 = await mkUser({ name: "HS 1" }), s2 = await mkUser({ name: "HS 2" });

  // lớp + học viên
  const c1 = await mkCourse(t1.id, { name: "Toán 9" }), c2 = await mkCourse(t1.id, { name: "Lý 9" }), c3 = await mkCourse(t2.id, { name: "Hoá 9" });
  for (const [u, c] of [[s1, c1], [s1, c2], [s2, c1], [s2, c3]] as const)
    await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: (await mkUser({ name: "HS treo" })).id, courseId: c1.id, status: "suspended" } });

  // nạp Coin + mua VIP bằng API thật
  await topupAndApprove(t1, sup, 3_000_000);
  await topupAndApprove(t2, sup, 500_000);
  check("t1 mua monthly", (await api("POST", "/api/subscriptions/monthly/purchase", { as: t1 })).status === 201);
  check("t1 mua yearly", (await api("POST", "/api/subscriptions/yearly/purchase", { as: t1 })).status === 201);
  check("t2 mua monthly", (await api("POST", "/api/subscriptions/monthly/purchase", { as: t2 })).status === 201);

  // giao dịch ngoài luồng để kiểm loại trừ / ranh giới
  await prisma.coinTransaction.create({ data: { userId: t3.id, amount: -999_999, reason: "class_subscription", sourceType: null } }); // dữ liệu cũ
  await prisma.coinTransaction.create({ data: { userId: t2.id, amount: 100_000, reason: "subscription_refund", sourceType: "refund" } });
  const sub = await prisma.tutorSubscription.findFirst({ where: { userId: t2.id } });
  await prisma.coinTransaction.create({ data: { userId: t2.id, amount: -300_000, reason: "tutor_vip_purchase", sourceType: "tutor_subscription", refId: sub!.id, createdAt: new Date("2026-09-30T20:00:00Z") } }); // = 01/10 giờ VN

  section("Quyền");
  check("ẩn danh 401", (await api("GET", "/api/admin/analytics")).status === 401);
  check("admin_content không có VIEW_REVENUE → 403", (await api("GET", "/api/admin/analytics", { as: contentAdmin })).status === 403);
  check("gia sư → 403", (await api("GET", "/api/admin/analytics", { as: t1 })).status === 403);

  section("Số liệu toàn thời gian");
  const r = await api("GET", "/api/admin/analytics", { as: sup });
  check("200", r.status === 200, r.json);
  const T = r.json.totals;
  check("doanh thu VIP = 300k + 2,5M + 300k + 300k(ranh giới) = 3.400.000", T.vipRevenue === 3_400_000, T);
  check("hoàn = 100.000, doanh thu ròng = 3.300.000", T.refunds === 100_000 && T.netVipRevenue === 3_300_000, T);
  check("nạp = 3.500.000", T.topupTotal === 3_500_000, T);
  check("loại giao dịch cũ sourceType=null (không có 999.999 trong tổng)", T.vipRevenue !== 3_400_000 + 999_999);
  check("số lần mua VIP = 4", T.vipPurchases === 4, T);
  check("3 gia sư; 2 đang VIP", T.tutorCount === 3 && T.activeVipTutors === 2, T);
  check("3 lớp; 2 học viên đang học (suspended không tính)", T.classCount === 3 && T.activeStudents === 2, T);
  check("Coin còn trong ví = nạp − đã trả = 3.5M − 3.1M = 400.000", T.coinOutstanding === 400_000, T);

  section("Theo tháng (giờ VN)");
  const months = Object.fromEntries(r.json.byMonth.map((m: any) => [m.month, m]));
  check("giao dịch 20:00 UTC 30/09 rơi vào tháng 2026-10", months["2026-10"]?.vipRevenue >= 300_000, r.json.byMonth);
  check("tổng các tháng = tổng doanh thu", r.json.byMonth.reduce((s: number, m: any) => s + m.vipRevenue, 0) === T.vipRevenue);

  section("Theo gói");
  const plans = Object.fromEntries(r.json.byPlan.map((p: any) => [p.planCode, p]));
  check("yearly 1 lần 2.500.000", plans.yearly?.count === 1 && plans.yearly?.revenue === 2_500_000, plans);
  check("monthly 3 lần 900.000", plans.monthly?.count === 3 && plans.monthly?.revenue === 900_000, plans);
  check("tổng gói = tổng doanh thu", r.json.byPlan.reduce((s: number, p: any) => s + p.revenue, 0) === T.vipRevenue);

  section("BE-075 theo gia sư");
  const by = Object.fromEntries(r.json.byTutor.map((x: any) => [x.name, x]));
  check("Cô Lan: 2 lớp, 2 HS, 2.800.000", by["Cô Lan"].classes === 2 && by["Cô Lan"].students === 2 && by["Cô Lan"].vipRevenue === 2_800_000, by["Cô Lan"]);
  check("Thầy Minh: 1 lớp, 1 HS, 600.000", by["Thầy Minh"].classes === 1 && by["Thầy Minh"].students === 1 && by["Thầy Minh"].vipRevenue === 600_000, by["Thầy Minh"]);
  check("gia sư chưa mua vẫn có dòng, doanh thu 0, không VIP", by["Cô Chưa Mua"].vipRevenue === 0 && by["Cô Chưa Mua"].vipUntil === null, by["Cô Chưa Mua"]);
  check("bảng gia sư cộng lại = tổng doanh thu", r.json.byTutor.reduce((s: number, x: any) => s + x.vipRevenue, 0) === T.vipRevenue);
  const lanUntil = new Date(by["Cô Lan"].vipUntil).getTime();
  const expect395 = Date.now() + 395 * 86_400_000; // gói tháng 30 ngày + gói năm 365 ngày nối tiếp
  check("VIP đến = hạn xa nhất kể cả gói nối tiếp (~395 ngày nữa)", Math.abs(lanUntil - expect395) < 2 * 86_400_000, { vipUntil: by["Cô Lan"].vipUntil });
  const minhUntil = new Date(by["Thầy Minh"].vipUntil).getTime();
  check("Thầy Minh (1 gói tháng) hạn ~30 ngày", Math.abs(minhUntil - (Date.now() + 30 * 86_400_000)) < 2 * 86_400_000, by["Thầy Minh"].vipUntil);
  check("sắp theo doanh thu giảm dần", r.json.byTutor[0].name === "Cô Lan");
  check("top lớp: Toán 9 có 2 HS đứng đầu", r.json.topClasses[0].name === "Toán 9" && r.json.topClasses[0].students === 2, r.json.topClasses);

  section("Lọc khoảng ngày (giờ VN)");
  const f1 = await api("GET", "/api/admin/analytics?from=2026-10-01&to=2026-10-01", { as: sup });
  check("chỉ ngày 01/10 VN: có giao dịch ranh giới 300.000", f1.json.totals.vipRevenue === 300_000 && f1.json.transactions.length === 1, f1.json.totals);
  const f2 = await api("GET", "/api/admin/analytics?from=2026-09-30&to=2026-09-30", { as: sup });
  check("ngày 30/09 VN: không có (ranh giới đã sang 01/10)", f2.json.totals.vipRevenue === 0, f2.json.totals);
  check("from sai định dạng → 400", (await api("GET", "/api/admin/analytics?from=abc", { as: sup })).status === 400);
  check("from > to → 400", (await api("GET", "/api/admin/analytics?from=2026-10-05&to=2026-10-01", { as: sup })).status === 400);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
