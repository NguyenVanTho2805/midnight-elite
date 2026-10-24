// KiN Pro — NỀN GÓI: phần có I/O (DB). Quy tắc thuần ở src/lib/planLimits.ts (có test); tài liệu: docs/kin/rd/pro/tinh-nang-pro-tra-phi.md mục 8.4.
//
// Hàm dùng chung cho các việc Pro sau này:
//   getTutorPlan(userId)        → { code, isPro, proUntil, limits, usage, state, quota, enforced }
//   canUse(userId, feature)     → boolean; feature: 'reminder_steps' | 'branded_docs' | 'advanced_stats' | 'ai_extract_quota'.
//                                 Cổng TẮT (mặc định) thì LUÔN true. Lỗi đọc gói cũng true.
//
// Cổng hạn mức: assertCanAddStudent (ghi danh bằng mã mời, tạo mã mời, mời hàng loạt) và reserveAiExtract (AI trích đề).
// Cổng chỉ chặn TẠO MỚI; cổng TẮT thì "đếm bóng" (ghi usage_events 'gate_would_block'); lỗi đọc gói thì CHO PHÉP.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";
import { logAction } from "@/lib/auditLog";
import {
  PERIOD_DAYS, PLAN_DEFAULTS, SETTING_KEYS, applyDiscount, buildMemoCode, featureCheck, foundingDiscount, gateDecision,
  isPlanEnforced, isPreviewEnv, nextProPeriod, priceOf, proStateOf, quotaState, settingsFromKV, vnMonthStart,
  type BillingPeriod, type GateDecision, type PlanCode, type PlanConfigRow, type PlanFeature, type PlanSettings, type Quota, type QuotaState,
} from "@/lib/planLimits";
import { proPayConfig, proQrUrl, SALE_CLOSED_TEXT } from "@/lib/proPayment";

type Db = Prisma.TransactionClient | typeof prisma;

// ── Cấu hình ────────────────────────────────────────────────────────────────────────────────────
export async function loadPlanConfigs(db: Db = prisma): Promise<Record<PlanCode, PlanConfigRow>> {
  const rows = await db.planConfig.findMany();
  const out: Record<PlanCode, PlanConfigRow> = { free: { ...PLAN_DEFAULTS.free }, pro: { ...PLAN_DEFAULTS.pro } };
  for (const r of rows) {
    if (r.code === "free" || r.code === "pro") {
      out[r.code] = {
        code: r.code, name: r.name, studentLimit: r.studentLimit, aiExtractPerMonth: r.aiExtractPerMonth,
        priceMonthVnd: r.priceMonthVnd, priceQuarterVnd: r.priceQuarterVnd, priceYearVnd: r.priceYearVnd,
      };
    }
  }
  return out;
}
export async function loadPlanSettings(db: Db = prisma): Promise<PlanSettings> {
  return settingsFromKV(await db.settingKV.findMany());
}

// ── Đếm ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * "Học viên đang học" = số học viên KHÁC NHAU có ghi danh status "active" trong các lớp của gia sư.
 * Cùng truy vấn với `loadTutorDashboard().totalStudents` (có test đối chiếu). Không đếm học viên chờ đồng ý hay đã tạm dừng.
 */
export async function countTutorActiveStudents(tutorId: string, db: Db = prisma): Promise<number> {
  const rows = await db.enrollment.findMany({ where: { status: "active", course: { ownerId: tutorId } }, select: { userId: true }, distinct: ["userId"] });
  return rows.length;
}
export async function countAiExtractThisMonth(userId: string, now: Date, db: Db = prisma): Promise<number> {
  const r = await db.usageEvent.aggregate({ where: { userId, kind: "ai_extract", createdAt: { gte: vnMonthStart(now) } }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}

// ── Gói của gia sư ──────────────────────────────────────────────────────────────────────────────
export interface TutorPlan {
  code: PlanCode;
  isPro: boolean;
  /** Hạn Pro hiện tại (null nếu Free). */
  proUntil: Date | null;
  limits: { students: number; aiExtract: number };
  usage: { students: number; aiExtract: number };
  state: { students: QuotaState; aiExtract: QuotaState };
  quota: { students: Quota; aiExtract: Quota };
  enforced: boolean;
}

export async function getTutorPlan(userId: string, now: Date = new Date(), db: Db = prisma): Promise<TutorPlan> {
  const [cfg, orders, students, aiUsed] = await Promise.all([
    loadPlanConfigs(db),
    db.proOrder.findMany({ where: { userId, status: "active" }, select: { status: true, startDate: true, endDate: true } }),
    countTutorActiveStudents(userId, db),
    countAiExtractThisMonth(userId, now, db),
  ]);
  const pro = proStateOf(orders, now);
  const code: PlanCode = pro.isPro ? "pro" : "free";
  const c = cfg[code];
  const qs = quotaState(students, c.studentLimit), qa = quotaState(aiUsed, c.aiExtractPerMonth);
  return {
    code, isPro: pro.isPro, proUntil: pro.proUntil,
    limits: { students: c.studentLimit, aiExtract: c.aiExtractPerMonth },
    usage: { students, aiExtract: aiUsed },
    state: { students: qs.state, aiExtract: qa.state },
    quota: { students: qs, aiExtract: qa },
    enforced: isPlanEnforced(),
  };
}

/** Tính năng này dùng được không? Cổng TẮT → true. Lỗi đọc gói → true (không chặn gia sư vì lỗi hạ tầng). */
export async function canUse(userId: string, feature: PlanFeature): Promise<boolean> {
  try {
    if (!isPlanEnforced()) return true;
    const p = await getTutorPlan(userId);
    return featureCheck(feature, { enforced: true, isPro: p.isPro, aiRemaining: p.quota.aiExtract.remaining }).allowed;
  } catch (e) {
    console.error("[canUse] lỗi đọc gói, cho phép:", e);
    return true;
  }
}

// ── Nhật ký lượt dùng ───────────────────────────────────────────────────────────────────────────
/** Ghi một dòng đo. Không bao giờ ném lỗi. Ghi bằng kết nối riêng (không dùng giao dịch đang có) để dòng "bị chặn" không bị hoàn lại cùng giao dịch. */
export async function recordUsage(userId: string, kind: string, o: { quantity?: number; refType?: string; refId?: string; meta?: Prisma.InputJsonValue } = {}): Promise<string | null> {
  try {
    const r = await prisma.usageEvent.create({ data: { userId, kind, quantity: o.quantity ?? 1, refType: o.refType, refId: o.refId, meta: o.meta } });
    return r.id;
  } catch (e) {
    console.error("[recordUsage] không ghi được:", e);
    return null;
  }
}

async function isTeacher(userId: string, db: Db): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true } });
  return !!u && u.role === "admin" && u.adminRole === "teacher";
}

// ── Cổng: thêm học viên ─────────────────────────────────────────────────────────────────────────
export type EnrollFeature = "redeem" | "invite" | "invite_many";
export interface EnrollGate {
  allow: boolean;
  /** Cổng bật và đã chặn (dùng để chọn thông điệp). */
  blocked: boolean;
  decision: GateDecision | null;
  plan: PlanCode | null;
}
const OPEN_GATE: EnrollGate = { allow: true, blocked: false, decision: null, plan: null };

/**
 * Kiểm xem gia sư `ownerId` còn nhận thêm được học viên không. Gọi NGAY SAU bước kiểm quyền.
 *  • `studentId`: học viên sắp vào. Nếu em đã đang học ở một lớp khác của cùng gia sư thì KHÔNG thêm người mới (không đếm hai lần).
 *  • `add`: số học viên sắp thêm (mời hàng loạt = số em dán).
 *  • `db`: truyền giao dịch đang mở để đọc cùng khoá; hàm xin khoá advisory theo gia sư nên hai yêu cầu cùng lúc không cùng vượt trần.
 * Chỉ áp cho gia sư (adminRole teacher). Lỗi bất kỳ khi đọc gói → CHO PHÉP. Cổng TẮT → luôn cho phép nhưng ghi 'gate_would_block' để đo.
 */
export async function assertCanAddStudent(ownerId: string | null, o: { feature: EnrollFeature; studentId?: string; add?: number; db?: Db }): Promise<EnrollGate> {
  if (!ownerId) return OPEN_GATE;
  const db = o.db ?? prisma;
  try {
    if (!(await isTeacher(ownerId, db))) return OPEN_GATE;
    if (o.db && "$executeRaw" in o.db) await (o.db as Prisma.TransactionClient).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan_tutor:${ownerId}`}))`;
    let add = Math.max(0, Math.floor(o.add ?? 1));
    if (o.studentId && add > 0) {
      const already = await db.enrollment.findFirst({ where: { userId: o.studentId, status: "active", course: { ownerId } }, select: { id: true } });
      if (already) add = 0;
    }
    const plan = await getTutorPlan(ownerId, new Date(), db);
    const decision = gateDecision({ enforced: plan.enforced, used: plan.usage.students, limit: plan.limits.students, add });
    // Không thêm ai (add = 0) mà đã vượt trần thì không phải việc của cổng: không chặn, không đo.
    if (add > 0 && decision.wouldBlock) {
      await recordUsage(ownerId, decision.allow ? "gate_would_block" : "gate_blocked", { refType: "students", meta: { feature: o.feature, plan: plan.code, used: plan.usage.students, limit: plan.limits.students, add } });
      return { allow: decision.allow, blocked: !decision.allow, decision, plan: plan.code };
    }
    return { allow: true, blocked: false, decision, plan: plan.code };
  } catch (e) {
    console.error("[assertCanAddStudent] lỗi đọc gói, cho phép:", e);
    return OPEN_GATE;
  }
}

/** Thông điệp CHO GIA SƯ khi cổng chặn (không dùng cho học viên: học viên chỉ thấy CLASS_PAUSED_MESSAGE). */
export function tutorLimitMessage(g: EnrollGate, add = 1): string {
  const q = g.decision?.quota;
  if (!q) return "Gói hiện tại chưa nhận thêm học viên.";
  if (add > 1 && q.remaining > 0) return `Gói ${g.plan === "pro" ? "KiN Pro" : "Free"} còn chỗ cho ${q.remaining} học viên đang học (đang có ${q.used}/${q.limit}). Mời ít hơn, hoặc xem gói ở mục Gói của tôi. Lớp và dữ liệu hiện có giữ nguyên.`;
  return `Gói ${g.plan === "pro" ? "KiN Pro" : "Free"} cho tối đa ${q.limit} học viên đang học, bạn đang có ${q.used}. Lớp và dữ liệu hiện có giữ nguyên, chỉ chưa nhận thêm được. Xem gói ở mục Gói của tôi.`;
}

// ── Cổng: AI trích đề ───────────────────────────────────────────────────────────────────────────
export type AiReserve =
  | { ok: true; eventId: string | null }
  | { ok: false; quota: Quota; message: string };

/**
 * Giữ chỗ MỘT lượt AI trước khi gọi mô hình: đếm + ghi trong cùng giao dịch có khoá theo gia sư (hai yêu cầu cùng lúc không cùng vượt hạn mức).
 * Gọi `releaseAiExtract(eventId)` khi việc trích THẤT BẠI để trả lượt. Chỉ áp cho gia sư; quản trị khác không bị đếm.
 * Cổng TẮT: vẫn ghi lượt (để đo), không chặn. Lỗi đọc gói → cho phép, không ghi.
 */
export async function reserveAiExtract(userId: string, now: Date = new Date()): Promise<AiReserve> {
  try {
    if (!(await isTeacher(userId, prisma))) return { ok: true, eventId: null };
    const res = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan_ai:${userId}`}))`;
      const plan = await getTutorPlan(userId, now, tx);
      const d = gateDecision({ enforced: plan.enforced, used: plan.usage.aiExtract, limit: plan.limits.aiExtract, add: 1 });
      if (!d.allow) return { ok: false as const, quota: d.quota, plan: plan.code, id: null };
      const ev = await tx.usageEvent.create({ data: { userId, kind: "ai_extract", quantity: 1, meta: { plan: plan.code, wouldBlock: d.wouldBlock } } });
      return { ok: true as const, quota: d.quota, plan: plan.code, id: ev.id, wouldBlock: d.wouldBlock };
    });
    if (!res.ok) {
      await recordUsage(userId, "gate_blocked", { refType: "ai_extract", meta: { plan: res.plan, used: res.quota.used, limit: res.quota.limit } });
      return { ok: false, quota: res.quota, message: aiLimitMessage(res.plan, res.quota) };
    }
    if (res.wouldBlock) await recordUsage(userId, "gate_would_block", { refType: "ai_extract", meta: { plan: res.plan, used: res.quota.used, limit: res.quota.limit } });
    return { ok: true, eventId: res.id };
  } catch (e) {
    console.error("[reserveAiExtract] lỗi đọc gói, cho phép:", e);
    return { ok: true, eventId: null };
  }
}
export async function releaseAiExtract(eventId: string | null): Promise<void> {
  if (!eventId) return;
  try { await prisma.usageEvent.deleteMany({ where: { id: eventId, kind: "ai_extract" } }); }
  catch (e) { console.error("[releaseAiExtract] không trả được lượt:", e); }
}
export function aiLimitMessage(plan: PlanCode, q: Quota): string {
  return `Gói ${plan === "pro" ? "KiN Pro" : "Free"} cho ${q.limit} lượt AI trích đề mỗi tháng, bạn đã dùng hết. Lượt tính lại từ đầu tháng sau. Bạn vẫn nhập câu hỏi bằng tay được.`;
}

// ── Yêu cầu mua Pro, kích hoạt (thủ công bởi admin) ─────────────────────────────────────────────
const proLock = (tx: Prisma.TransactionClient, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pro_order:${userId}`}))`;

export type CreateOrderResult =
  | { ok: true; created: boolean; order: Prisma.ProOrderGetPayload<object> }
  | { ok: false; status: number; error: string };

/**
 * Tạo yêu cầu mua Pro cho gia sư (thu QR theo kỳ). KHÔNG đụng Coin, KHÔNG trừ tiền. Chặn bản xem trước, giai đoạn chạy thử và khi chưa cấu hình nhận tiền.
 * Cùng kỳ đang chờ → trả lại yêu cầu cũ (không tạo trùng). Kỳ khác → huỷ yêu cầu chờ cũ, tạo mới. Giá và giảm giá sáng lập được CHỤP lại trên yêu cầu.
 */
export async function createProOrder(userId: string, period: BillingPeriod, now: Date = new Date()): Promise<CreateOrderResult> {
  const pay = proPayConfig();
  if (!pay.open) return { ok: false, status: 409, error: pay.reason === "preview" ? "Bản xem trước không bán gói." : "Chưa mở bán" };
  const cfg = (await loadPlanConfigs()).pro, settings = await loadPlanSettings();
  const list = priceOf(cfg, period);
  if (list <= 0) return { ok: false, status: 409, error: "Chưa mở bán" };
  for (let attempt = 0; attempt < 5; attempt++) {
    const memoCode = buildMemoCode(pay.prefix, () => randomBytes(1)[0]);
    try {
      return await prisma.$transaction(async (tx) => {
        await proLock(tx, userId);
        const pending = await tx.proOrder.findFirst({ where: { userId, status: "pending", source: "purchase" }, orderBy: { createdAt: "desc" } });
        if (pending && pending.period === period) return { ok: true as const, created: false, order: pending };
        if (pending) await tx.proOrder.updateMany({ where: { userId, status: "pending", source: "purchase" }, data: { status: "cancelled" } });
        const mine = await tx.proOrder.findFirst({ where: { userId, foundingDiscountPct: { gt: 0 }, status: { not: "cancelled" } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
        const holders = await tx.proOrder.findMany({ where: { foundingDiscountPct: { gt: 0 }, status: { not: "cancelled" } }, select: { userId: true }, distinct: ["userId"] });
        const fd = foundingDiscount({ settings, foundingStart: mine?.createdAt ?? null, foundingUsers: holders.length, now });
        const order = await tx.proOrder.create({
          data: {
            userId, period, durationDays: PERIOD_DAYS[period], listPriceVnd: list, priceVnd: applyDiscount(list, fd.pct),
            foundingDiscountPct: fd.pct, source: "purchase", memoCode, status: "pending",
          },
        });
        return { ok: true as const, created: true, order };
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") continue; // trùng mã chuyển khoản: sinh mã khác
      console.error("[createProOrder]", e);
      return { ok: false, status: 500, error: "Không tạo được yêu cầu, thử lại sau" };
    }
  }
  return { ok: false, status: 503, error: "Không sinh được mã chuyển khoản, thử lại sau" };
}

export type ActivateResult = { ok: true; order: Prisma.ProOrderGetPayload<object> } | { ok: false; status: number; error: string };

/** Admin đối chiếu sao kê rồi kích hoạt: cộng dồn vào hạn Pro hiện có. Chỉ kích hoạt được yêu cầu đang chờ; bấm lần hai → 409, không cộng hai lần. */
export async function activateProOrder(orderId: string, adminId: string, o: { bankRef?: string | null; now?: Date } = {}): Promise<ActivateResult> {
  if (isPreviewEnv()) return { ok: false, status: 403, error: "Bản xem trước không kích hoạt gói." };
  const now = o.now ?? new Date();
  const found = await prisma.proOrder.findUnique({ where: { id: orderId }, select: { userId: true } });
  if (!found) return { ok: false, status: 404, error: "Không tìm thấy yêu cầu" };
  const res = await prisma.$transaction(async (tx) => {
    await proLock(tx, found.userId);
    const order = await tx.proOrder.findUnique({ where: { id: orderId } });
    if (!order) return { ok: false as const, status: 404, error: "Không tìm thấy yêu cầu" };
    if (order.status !== "pending") return { ok: false as const, status: 409, error: order.status === "active" ? "Yêu cầu này đã kích hoạt rồi" : "Yêu cầu này đã huỷ" };
    const latest = await tx.proOrder.findFirst({ where: { userId: order.userId, status: "active", endDate: { gt: now } }, orderBy: { endDate: "desc" }, select: { endDate: true } });
    const { startDate, endDate } = nextProPeriod(latest?.endDate ?? null, order.durationDays, now);
    const upd = await tx.proOrder.update({
      where: { id: orderId },
      data: { status: "active", startDate, endDate, activatedBy: adminId, activatedAt: now, bankRef: o.bankRef?.trim().slice(0, 100) || null },
    });
    return { ok: true as const, order: upd };
  });
  if (res.ok) await logAction(adminId, "pro_order.activate", "ProOrder", orderId, { userId: res.order.userId, period: res.order.period, priceVnd: res.order.priceVnd, startDate: res.order.startDate?.toISOString() ?? null, endDate: res.order.endDate?.toISOString() ?? null });
  return res;
}

export async function cancelProOrder(orderId: string, adminId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const r = await prisma.proOrder.updateMany({ where: { id: orderId, status: "pending" }, data: { status: "cancelled" } });
  if (r.count === 0) {
    const o = await prisma.proOrder.findUnique({ where: { id: orderId }, select: { status: true } });
    return o ? { ok: false, status: 409, error: "Chỉ huỷ được yêu cầu đang chờ" } : { ok: false, status: 404, error: "Không tìm thấy yêu cầu" };
  }
  await logAction(adminId, "pro_order.cancel", "ProOrder", orderId);
  return { ok: true };
}

/**
 * Tặng Pro miễn phí cho MỌI gia sư hiện có (số ngày lấy từ cài đặt, mặc định 60). Mỗi gia sư chỉ được tặng MỘT lần (chạy lại không tặng thêm).
 * Không có tiền đi qua: priceVnd = 0. Quyền và dữ liệu đang có của gia sư vốn không bị đụng tới.
 */
export async function grantLegacyTrial(adminId: string, now: Date = new Date()): Promise<{ ok: true; granted: number; skipped: number; days: number } | { ok: false; status: number; error: string }> {
  if (isPreviewEnv()) return { ok: false, status: 403, error: "Bản xem trước không tặng gói." };
  const days = (await loadPlanSettings()).legacyTrialDays;
  if (days <= 0) return { ok: false, status: 409, error: "Số ngày tặng đang là 0, hãy đặt số ngày ở cài đặt trước" };
  const tutors = await prisma.user.findMany({ where: { role: "admin", adminRole: "teacher", banned: false }, select: { id: true } });
  let granted = 0, skipped = 0;
  for (const t of tutors) {
    const done = await prisma.$transaction(async (tx) => {
      await proLock(tx, t.id);
      if (await tx.proOrder.findFirst({ where: { userId: t.id, source: "legacy_grant" }, select: { id: true } })) return false;
      const latest = await tx.proOrder.findFirst({ where: { userId: t.id, status: "active", endDate: { gt: now } }, orderBy: { endDate: "desc" }, select: { endDate: true } });
      const { startDate, endDate } = nextProPeriod(latest?.endDate ?? null, days, now);
      await tx.proOrder.create({
        data: {
          userId: t.id, period: "grant", durationDays: days, priceVnd: 0, listPriceVnd: 0, source: "legacy_grant", status: "active",
          memoCode: `GRANT-${randomBytes(6).toString("hex").toUpperCase()}`, startDate, endDate, activatedBy: adminId, activatedAt: now,
        },
      });
      return true;
    });
    if (done) granted++; else skipped++;
  }
  await logAction(adminId, "pro_order.grant_legacy", "ProOrder", "legacy", { granted, skipped, days });
  return { ok: true, granted, skipped, days };
}

// ── Lưu cấu hình (admin) ────────────────────────────────────────────────────────────────────────
export async function savePlanConfig(adminId: string, plans: PlanConfigRow[], settings: Partial<PlanSettings>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      const data = { name: p.name, studentLimit: p.studentLimit, aiExtractPerMonth: p.aiExtractPerMonth, priceMonthVnd: p.priceMonthVnd, priceQuarterVnd: p.priceQuarterVnd, priceYearVnd: p.priceYearVnd, updatedBy: adminId };
      await tx.planConfig.upsert({ where: { code: p.code }, update: data, create: { code: p.code, ...data } });
    }
    for (const k of Object.keys(settings) as (keyof PlanSettings)[]) {
      const v = String(settings[k]);
      await tx.settingKV.upsert({ where: { key: SETTING_KEYS[k] }, update: { value: v, updatedBy: adminId }, create: { key: SETTING_KEYS[k], value: v, updatedBy: adminId } });
    }
  });
  await logAction(adminId, "pro_config.update", "PlanConfig", "pro", { plans: plans.map(p => p.code), settings: Object.keys(settings) });
}

// ── Đo (admin): phân bố theo hạn mức Free và số lần cổng "sẽ chặn" ──────────────────────────────
export interface PlanMeasure {
  freeLimit: number;
  tutors: number;
  /** Số gia sư ở mỗi trạng thái nếu áp trần Free cho TẤT CẢ (câu hỏi của thí nghiệm E1). Không có tên người. */
  byState: Record<QuotaState, number>;
  maxStudents: number;
  shadowWouldBlock30d: number;
  enforcedBlocked30d: number;
  aiExtractThisMonth: number;
  proNow: number;
}
export async function loadPlanMeasure(now: Date = new Date()): Promise<PlanMeasure> {
  const cfg = await loadPlanConfigs();
  const freeLimit = cfg.free.studentLimit;
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [teachers, perTutor, wouldBlock, blocked, ai, proActive] = await Promise.all([
    prisma.user.count({ where: { role: "admin", adminRole: "teacher", banned: false } }),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(DISTINCT e."userId")::int AS n
      FROM enrollments e JOIN courses c ON c.id = e."courseId" JOIN users u ON u.id = c."ownerId"
      WHERE e.status = 'active' AND u."adminRole" = 'teacher' AND u.banned = false
      GROUP BY c."ownerId"`,
    prisma.usageEvent.count({ where: { kind: "gate_would_block", createdAt: { gte: since } } }),
    prisma.usageEvent.count({ where: { kind: "gate_blocked", createdAt: { gte: since } } }),
    prisma.usageEvent.aggregate({ where: { kind: "ai_extract", createdAt: { gte: vnMonthStart(now) } }, _sum: { quantity: true } }),
    prisma.proOrder.findMany({ where: { status: "active", startDate: { lte: now }, endDate: { gt: now } }, select: { userId: true }, distinct: ["userId"] }),
  ]);
  const byState: Record<QuotaState, number> = { ok: 0, warn: 0, blocked: 0, over: 0 };
  let max = 0;
  for (const r of perTutor) { byState[quotaState(r.n, freeLimit).state]++; if (r.n > max) max = r.n; }
  byState.ok += Math.max(0, teachers - perTutor.length); // gia sư chưa có học viên nào
  return {
    freeLimit, tutors: teachers, byState, maxStudents: max, shadowWouldBlock30d: wouldBlock, enforcedBlocked30d: blocked,
    aiExtractThisMonth: ai._sum.quantity ?? 0, proNow: proActive.length,
  };
}

// ── Dữ liệu cho màn "Gói của tôi" ───────────────────────────────────────────────────────────────
export interface OrderView {
  id: string; period: string; status: string; priceVnd: number; listPriceVnd: number; foundingDiscountPct: number; source: string;
  memoCode: string; durationDays: number; startDate: string | null; endDate: string | null; createdAt: string;
}
const orderView = (o: Prisma.ProOrderGetPayload<object>): OrderView => ({
  id: o.id, period: o.period, status: o.status, priceVnd: o.priceVnd, listPriceVnd: o.listPriceVnd, foundingDiscountPct: o.foundingDiscountPct, source: o.source,
  memoCode: o.memoCode, durationDays: o.durationDays, startDate: o.startDate?.toISOString() ?? null, endDate: o.endDate?.toISOString() ?? null, createdAt: o.createdAt.toISOString(),
});

export async function buildTutorPlanView(userId: string, now: Date = new Date()) {
  const [plan, configs, settings, pay, orders] = await Promise.all([
    getTutorPlan(userId, now), loadPlanConfigs(), loadPlanSettings(), Promise.resolve(proPayConfig()),
    prisma.proOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const mine = await prisma.proOrder.findFirst({ where: { userId, foundingDiscountPct: { gt: 0 }, status: { not: "cancelled" } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const holders = mine ? [] : await prisma.proOrder.findMany({ where: { foundingDiscountPct: { gt: 0 }, status: { not: "cancelled" } }, select: { userId: true }, distinct: ["userId"] });
  const fd = foundingDiscount({ settings, foundingStart: mine?.createdAt ?? null, foundingUsers: holders.length, now });
  const pending = orders.find(o => o.status === "pending" && o.source === "purchase") ?? null;
  return {
    plan: {
      code: plan.code, isPro: plan.isPro, proUntil: plan.proUntil?.toISOString() ?? null, limits: plan.limits, usage: plan.usage, state: plan.state,
      quota: { students: plan.quota.students, aiExtract: plan.quota.aiExtract }, enforced: plan.enforced,
    },
    configs,
    foundingPct: fd.pct,
    sale: { open: pay.open, reason: pay.reason, text: pay.open ? null : SALE_CLOSED_TEXT },
    pending: pending && pay.open && pay.account ? {
      ...orderView(pending),
      qrUrl: proQrUrl(pay.account, pending.priceVnd, pending.memoCode),
      account: { bankName: pay.account.bankName, accountNo: pay.account.accountNo, accountName: pay.account.accountName },
    } : null,
    orders: orders.filter(o => o.id !== pending?.id).map(orderView),
  };
}
