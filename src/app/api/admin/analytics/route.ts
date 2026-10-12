// BE-074 + BE-075 — báo cáo doanh thu nền tảng, đọc từ sổ Coin thật.
//
// Doanh thu = Coin gia sư trả để mua VIP (CoinTransaction.sourceType =
// "tutor_subscription", 1 Coin = 1 VND, amount âm trong sổ). Học viên học
// miễn phí (D01 05/10) nên không còn doanh thu theo Enrollment × price — đã
// cắt hẳn theo BE-077 (06/10). Giao dịch cũ có sourceType = null được loại
// trừ có chủ đích, không suy đoán ngược (BE-039).
//
// BE-074 nêu "class_subscription join Course qua classId" là mô hình gói theo
// lớp của backlog gốc; D01 đã thay bằng VIP của gia sư nên nguồn là
// "tutor_subscription" và không có classId.
//
// GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD  (giờ Việt Nam, gồm
// cả hai đầu; bỏ trống = toàn bộ thời gian). Quyền VIEW_REVENUE.
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COIN_REASONS, COIN_SOURCE_TYPES } from "@/lib/wallet-constants";
import { TUTOR_VIP_PLANS } from "@/lib/tutorSubscription";
import { parseDateRange, rangeWhere, vnMonthKey } from "@/lib/revenue";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.VIEW_REVENUE);
  if (isNextResponse(auth)) return auth;

  const range = parseDateRange(new URL(req.url).searchParams);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });
  const createdAt = rangeWhere(range);
  const now = new Date();

  try {
    const [vipTx, refundTx, topupTx, tutors, coinSum, vipNow, classByOwner, studentsByOwner, topClassRows, studentTotal] =
      await Promise.all([
        prisma.coinTransaction.findMany({
          where:   { sourceType: COIN_SOURCE_TYPES.TUTOR_SUBSCRIPTION, ...(createdAt ? { createdAt } : {}) },
          select:  { id: true, userId: true, amount: true, refId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.coinTransaction.findMany({
          where:  { sourceType: COIN_SOURCE_TYPES.REFUND, reason: COIN_REASONS.SUBSCRIPTION_REFUND, ...(createdAt ? { createdAt } : {}) },
          select: { amount: true, createdAt: true },
        }),
        prisma.coinTransaction.findMany({
          where:  { sourceType: COIN_SOURCE_TYPES.TOPUP, amount: { gt: 0 }, ...(createdAt ? { createdAt } : {}) },
          select: { amount: true, createdAt: true },
        }),
        prisma.user.findMany({
          where:   { role: "admin", adminRole: "teacher", tutorVerified: true },
          select:  { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
        prisma.wallet.aggregate({ _sum: { balance: true } }),
        // Mọi gói còn hạn, kể cả gói mua nối tiếp chưa tới ngày bắt đầu: "đang VIP"
        // cần gói đang chạy, còn "VIP đến" phải là hạn xa nhất của chuỗi gói.
        prisma.tutorSubscription.findMany({
          where:  { status: "active", endDate: { gt: now } },
          select: { userId: true, startDate: true, endDate: true },
        }),
        prisma.course.groupBy({ by: ["ownerId"], where: { ownerId: { not: null } }, _count: { _all: true } }),
        // Số học viên (không trùng) đang học ở các lớp của mỗi gia sư.
        prisma.$queryRaw<{ owner: string; students: number }[]>`
          SELECT c."ownerId" AS owner, COUNT(DISTINCT e."userId")::int AS students
          FROM enrollments e JOIN courses c ON c.id = e."courseId"
          WHERE e.status = 'active' AND c."ownerId" IS NOT NULL
          GROUP BY c."ownerId"`,
        prisma.$queryRaw<{ id: string; name: string; owner: string | null; students: number }[]>`
          SELECT c.id, c.name, c."ownerId" AS owner, COUNT(e.id)::int AS students
          FROM courses c JOIN enrollments e ON e."courseId" = c.id AND e.status = 'active'
          GROUP BY c.id, c.name, c."ownerId"
          ORDER BY students DESC, c.name ASC
          LIMIT 5`,
        prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(DISTINCT "userId")::int AS n FROM enrollments WHERE status = 'active'`,
      ]);

    // refId của giao dịch VIP = TutorSubscription.id → biết gói nào.
    const subIds = vipTx.map(t => t.refId).filter((x): x is string => !!x);
    const subs = subIds.length
      ? await prisma.tutorSubscription.findMany({ where: { id: { in: subIds } }, select: { id: true, planCode: true } })
      : [];
    const planOf = new Map(subs.map(s => [s.id, s.planCode]));

    const tutorById = new Map(tutors.map(t => [t.id, t]));
    // Người mua VIP không còn là gia sư đã duyệt (bị hạ quyền...) vẫn phải có
    // mặt trong bảng, nếu không tổng bảng sẽ lệch tổng doanh thu.
    const extraIds = [...new Set(vipTx.map(t => t.userId))].filter(id => !tutorById.has(id));
    if (extraIds.length) {
      const extra = await prisma.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, email: true } });
      for (const u of extra) tutorById.set(u.id, u);
    }

    // ── Tổng hợp ────────────────────────────────────────────────────────────
    const revenueOf = (amount: number) => -amount; // sổ ghi âm khi gia sư trả
    const vipRevenue   = vipTx.reduce((s, t) => s + revenueOf(t.amount), 0);
    const refunds      = refundTx.reduce((s, t) => s + t.amount, 0);
    const topupTotal   = topupTx.reduce((s, t) => s + t.amount, 0);

    const monthMap = new Map<string, { month: string; vipRevenue: number; vipCount: number; topup: number }>();
    const bucket = (key: string) => {
      let b = monthMap.get(key);
      if (!b) { b = { month: key, vipRevenue: 0, vipCount: 0, topup: 0 }; monthMap.set(key, b); }
      return b;
    };
    for (const t of vipTx)   { const b = bucket(vnMonthKey(t.createdAt)); b.vipRevenue += revenueOf(t.amount); b.vipCount++; }
    for (const t of topupTx) { bucket(vnMonthKey(t.createdAt)).topup += t.amount; }
    const byMonth = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

    const planMap = new Map<string, { planCode: string; name: string; count: number; revenue: number }>();
    for (const t of vipTx) {
      const code = (t.refId && planOf.get(t.refId)) || "unknown";
      const name = code in TUTOR_VIP_PLANS ? TUTOR_VIP_PLANS[code as keyof typeof TUTOR_VIP_PLANS].name : "Không rõ gói";
      const p = planMap.get(code) ?? { planCode: code, name, count: 0, revenue: 0 };
      p.count++; p.revenue += revenueOf(t.amount);
      planMap.set(code, p);
    }
    const byPlan = [...planMap.values()].sort((a, b) => b.revenue - a.revenue);

    // ── BE-075: theo gia sư ─────────────────────────────────────────────────
    const classCount = new Map(classByOwner.map(r => [r.ownerId as string, r._count._all]));
    const studentCount = new Map(studentsByOwner.map(r => [r.owner, r.students]));
    const vipUntil = new Map<string, Date>();    // hạn xa nhất (gồm gói nối tiếp)
    const vipRunning = new Set<string>();         // có gói đang chạy ngay lúc này
    for (const s of vipNow) {
      const cur = vipUntil.get(s.userId);
      if (!cur || s.endDate > cur) vipUntil.set(s.userId, s.endDate);
      if (s.startDate <= now) vipRunning.add(s.userId);
    }
    const paidBy = new Map<string, { revenue: number; purchases: number }>();
    for (const t of vipTx) {
      const p = paidBy.get(t.userId) ?? { revenue: 0, purchases: 0 };
      p.revenue += revenueOf(t.amount); p.purchases++;
      paidBy.set(t.userId, p);
    }
    const byTutor = [...tutorById.values()].map(u => ({
      tutorId:   u.id,
      name:      u.name,
      email:     u.email,
      classes:   classCount.get(u.id) ?? 0,
      students:  studentCount.get(u.id) ?? 0,
      vipRevenue: paidBy.get(u.id)?.revenue ?? 0,
      vipPurchases: paidBy.get(u.id)?.purchases ?? 0,
      vipUntil:  vipUntil.get(u.id)?.toISOString() ?? null,
    })).sort((a, b) => b.vipRevenue - a.vipRevenue || a.name.localeCompare(b.name, "vi"));

    const transactions = vipTx.map(t => ({
      id:        t.id,
      tutorId:   t.userId,
      tutorName: tutorById.get(t.userId)?.name ?? "—",
      planCode:  (t.refId && planOf.get(t.refId)) || "unknown",
      amount:    revenueOf(t.amount),
      createdAt: t.createdAt.toISOString(),
    }));

    const ownerName = new Map([...tutorById.values()].map(u => [u.id, u.name]));
    const topClasses = topClassRows.map(c => ({
      id: c.id, name: c.name, tutorName: c.owner ? ownerName.get(c.owner) ?? null : null, students: c.students,
    }));

    return NextResponse.json({
      range: { from: range.from?.toISOString() ?? null, toExclusive: range.toExclusive?.toISOString() ?? null },
      totals: {
        vipRevenue,
        refunds,
        netVipRevenue: vipRevenue - refunds,
        topupTotal,
        vipPurchases:  vipTx.length,
        activeVipTutors: vipRunning.size,
        tutorCount:    tutors.length,
        classCount:    [...classCount.values()].reduce((s, n) => s + n, 0),
        activeStudents: studentTotal[0]?.n ?? 0,
        coinOutstanding: coinSum._sum.balance ?? 0, // Coin đang nằm trong ví người dùng
      },
      byMonth,
      byPlan,
      byTutor,
      transactions,
      topClasses,
    });
  } catch (e) {
    console.error("[GET /api/admin/analytics]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
