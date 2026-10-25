// KiN Pro — NỀN GÓI: phần THUẦN (không DB, không React, không node:crypto) để chạy được ở cả máy chủ lẫn giao diện và test bằng tsx.
// Nguồn: docs/kin/rd/pro/tinh-nang-pro-tra-phi.md mục 8.4 (Cấu hình KiN Pro, Cổng kỹ thuật), 9-F1, 9-F5.
//
// Nguyên tắc cứng:
//  • Cổng hạn mức CHỈ CHẶN TẠO MỚI. Không bao giờ ẩn/xoá lớp, khoá điểm danh, phiếu, xuất dữ liệu hay Sổ của con.
//  • Công tắc cưỡng chế là biến môi trường KIN_PLAN_ENFORCE, MẶC ĐỊNH TẮT (cùng mẫu PUSH_ENABLED): tắt thì không ai bị chặn, chỉ "đếm bóng".
//  • Mọi con số hạn mức / giá nằm ở bảng cấu hình (PlanConfig, SettingKV) sửa từ admin; PLAN_DEFAULTS chỉ là giá trị dùng khi chưa có dòng nào.
//  • Lỗi đọc gói thì CHO PHÉP thao tác (không chặn gia sư vì lỗi hạ tầng).
import { vnMonthKey } from "@/lib/revenue";

export type PlanCode = "free" | "pro";
export type BillingPeriod = "month" | "quarter" | "year";
export type QuotaState = "ok" | "warn" | "blocked" | "over";
/** Tính năng mà agent khác sẽ gọi `canUse(userId, feature)`. */
export type PlanFeature = "reminder_steps" | "branded_docs" | "advanced_stats" | "ai_extract_quota";

export const PLAN_FEATURES: readonly PlanFeature[] = ["reminder_steps", "branded_docs", "advanced_stats", "ai_extract_quota"];
/** Từ ngưỡng này (phần trăm) trở lên là "warn": hiện thanh và chữ, vẫn làm được. */
export const WARN_PCT = 80;

export interface PlanConfigRow {
  code: PlanCode;
  name: string;
  studentLimit: number;
  aiExtractPerMonth: number;
  priceMonthVnd: number;
  priceQuarterVnd: number;
  priceYearVnd: number;
}
export type PlanLimits = Pick<PlanConfigRow, "studentLimit" | "aiExtractPerMonth">;

/** Giá trị dùng khi bảng cấu hình chưa có dòng. Giá là KHỞI ĐIỂM cần kiểm chứng (tài liệu 8.4), N=10 chốt sau thí nghiệm E1. */
export const PLAN_DEFAULTS: Record<PlanCode, PlanConfigRow> = {
  free: { code: "free", name: "Free",     studentLimit: 10,  aiExtractPerMonth: 3,  priceMonthVnd: 0,      priceQuarterVnd: 0,       priceYearVnd: 0 },
  pro:  { code: "pro",  name: "KiN Pro",  studentLimit: 500, aiExtractPerMonth: 20, priceMonthVnd: 79_000, priceQuarterVnd: 199_000, priceYearVnd: 599_000 },
};

export interface PlanSettings {
  /** Số ngày Pro tặng gia sư hiện có khi bật Pro. */
  legacyTrialDays: number;
  /** Giảm giá sáng lập (%) cho những người đầu tiên. */
  foundingDiscountPct: number;
  /** Số người được hưởng giá sáng lập. */
  foundingSlots: number;
  /** Giá sáng lập khoá trong bao nhiêu tháng kể từ lần mua đầu. */
  foundingMonths: number;
}
export const SETTING_DEFAULTS: PlanSettings = { legacyTrialDays: 60, foundingDiscountPct: 30, foundingSlots: 30, foundingMonths: 12 };
export const SETTING_KEYS: Record<keyof PlanSettings, string> = {
  legacyTrialDays: "pro.legacyTrialDays", foundingDiscountPct: "pro.foundingDiscountPct", foundingSlots: "pro.foundingSlots", foundingMonths: "pro.foundingMonths",
};
const SETTING_RANGE: Record<keyof PlanSettings, [number, number]> = {
  legacyTrialDays: [0, 365], foundingDiscountPct: [0, 90], foundingSlots: [0, 10_000], foundingMonths: [0, 60],
};

export const PERIOD_DAYS: Record<BillingPeriod, number> = { month: 30, quarter: 90, year: 365 };
export const PERIOD_LABEL: Record<BillingPeriod, string> = { month: "1 tháng", quarter: "3 tháng", year: "12 tháng" };
export const BILLING_PERIODS: readonly BillingPeriod[] = ["month", "quarter", "year"];

/** Chữ duy nhất học viên được thấy khi lớp chạm trần: trung tính, không nhắc gói hay gia sư. */
export const CLASS_PAUSED_MESSAGE = "Lớp tạm chưa nhận thêm";
export const PLAN_LIMIT_CODE = "PLAN_LIMIT";

// ── Công tắc ────────────────────────────────────────────────────────────────────────────────────
/** Bật khi KIN_PLAN_ENFORCE đúng bằng "1". Mọi giá trị khác (rỗng, "0", "true", thiếu) = TẮT. Bản xem trước (Vercel preview) luôn TẮT vì dùng chung DB production. */
export function isPlanEnforced(env: Record<string, string | undefined> = process.env): boolean {
  return env.KIN_PLAN_ENFORCE === "1" && env.VERCEL_ENV !== "preview";
}
/** Bản xem trước dùng chung DB production nên mọi đường tính tiền gói (tạo yêu cầu, QR, kích hoạt) bị chặn ở đó. */
export function isPreviewEnv(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "preview";
}

// ── Trạng thái hạn mức ──────────────────────────────────────────────────────────────────────────
export interface Quota { state: QuotaState; used: number; limit: number; remaining: number; pct: number }

/**
 * ok (<80%) · warn (≥80%, còn làm được) · blocked (đạt trần: chặn tạo MỚI) · over (đang có nhiều hơn trần: giữ nguyên tất cả, chỉ chặn thêm).
 * `used`/`limit` âm hoặc không nguyên được ép về số nguyên ≥ 0, để dữ liệu lạ không làm cổng đóng nhầm.
 */
export function quotaState(usedRaw: number, limitRaw: number): Quota {
  const used = Number.isFinite(usedRaw) ? Math.max(0, Math.floor(usedRaw)) : 0;
  const limit = Number.isFinite(limitRaw) ? Math.max(0, Math.floor(limitRaw)) : 0;
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 100;
  const remaining = Math.max(0, limit - used);
  const state: QuotaState = used > limit ? "over" : used === limit ? "blocked" : used * 100 >= limit * WARN_PCT ? "warn" : "ok";
  return { state, used, limit, remaining, pct };
}

/** Thêm `add` nữa có vẫn trong trần không? Thêm 0 (hoặc ít hơn) thì luôn được: cổng không bao giờ chặn việc không thêm ai. */
export function canAdd(used: number, limit: number, add = 1): boolean {
  if (!(add > 0)) return true;
  return Math.max(0, Math.floor(used)) + Math.max(0, Math.floor(add)) <= Math.max(0, Math.floor(limit));
}

export interface GateDecision { allow: boolean; wouldBlock: boolean; enforced: boolean; quota: Quota }
/** Quyết định của cổng. Cổng TẮT: luôn cho phép, nhưng báo `wouldBlock` để "đếm bóng". */
export function gateDecision(o: { enforced: boolean; used: number; limit: number; add?: number }): GateDecision {
  const quota = quotaState(o.used, o.limit);
  const wouldBlock = !canAdd(o.used, o.limit, o.add ?? 1);
  return { allow: !(o.enforced && wouldBlock), wouldBlock, enforced: o.enforced, quota };
}

// ── Gói hiện có ─────────────────────────────────────────────────────────────────────────────────
export interface ProPeriodLike { status: string; startDate: Date | null; endDate: Date | null }
/** Pro đang hiệu lực: kỳ có status "active" và start ≤ now < end. Trả về hạn xa nhất. Kỳ nối tiếp (start ở tương lai) chưa tính là Pro. */
export function proStateOf(orders: ProPeriodLike[], now: Date): { isPro: boolean; proUntil: Date | null; nextStart: Date | null } {
  let until: Date | null = null, nextStart: Date | null = null;
  for (const o of orders) {
    if (o.status !== "active" || !o.startDate || !o.endDate) continue;
    if (o.startDate <= now && o.endDate > now) { if (!until || o.endDate > until) until = o.endDate; }
    else if (o.startDate > now && (!nextStart || o.startDate < nextStart)) nextStart = o.startDate;
  }
  // Kỳ nối tiếp sát nhau: hạn thật là điểm cuối của chuỗi liền kề.
  if (until) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const o of orders) {
        if (o.status === "active" && o.startDate && o.endDate && o.startDate <= until && o.endDate > until) { until = o.endDate; moved = true; }
      }
    }
  }
  return { isPro: !!until, proUntil: until, nextStart: until ? null : nextStart };
}

/** Kỳ mới bắt đầu ngay nếu chưa Pro; đang Pro thì nối tiếp ngay sau hạn hiện tại (cộng dồn, không mất ngày đã trả). */
export function nextProPeriod(latestEnd: Date | null, durationDays: number, now: Date): { startDate: Date; endDate: Date } {
  const startDate = latestEnd && latestEnd > now ? latestEnd : now;
  return { startDate, endDate: new Date(startDate.getTime() + durationDays * 86_400_000) };
}

export interface FeatureCheck { allowed: boolean; wouldBlock: boolean; enforced: boolean }
/** Tính năng Pro: cổng TẮT thì ai cũng được dùng (wouldBlock cho biết Free sẽ bị chặn). 'ai_extract_quota' còn lượt thì được. */
export function featureCheck(feature: PlanFeature, o: { enforced: boolean; isPro: boolean; aiRemaining: number }): FeatureCheck {
  const natural = feature === "ai_extract_quota" ? o.aiRemaining > 0 : o.isPro;
  return { allowed: !o.enforced || natural, wouldBlock: !natural, enforced: o.enforced };
}

// ── Giá, giảm giá sáng lập ──────────────────────────────────────────────────────────────────────
export function priceOf(cfg: Pick<PlanConfigRow, "priceMonthVnd" | "priceQuarterVnd" | "priceYearVnd">, period: BillingPeriod): number {
  return period === "month" ? cfg.priceMonthVnd : period === "quarter" ? cfg.priceQuarterVnd : cfg.priceYearVnd;
}
export function applyDiscount(listPrice: number, pct: number): number {
  const p = Math.min(100, Math.max(0, Math.floor(pct)));
  return Math.max(0, Math.round((listPrice * (100 - p)) / 100));
}
/**
 * Giá sáng lập: người đã có suất còn trong thời hạn khoá thì giữ; người mới chỉ được khi còn suất. Hết suất hoặc hết hạn khoá: 0%.
 * `foundingStart` = ngày tạo yêu cầu có giảm giá đầu tiên của người này; `foundingUsers` = số người KHÁC NHAU đang giữ suất.
 */
export function foundingDiscount(o: { settings: PlanSettings; foundingStart: Date | null; foundingUsers: number; now: Date }): { pct: number; newSlot: boolean } {
  const { settings: s } = o;
  if (s.foundingDiscountPct <= 0) return { pct: 0, newSlot: false };
  if (o.foundingStart) {
    const end = new Date(o.foundingStart); end.setUTCMonth(end.getUTCMonth() + s.foundingMonths);
    return o.now < end ? { pct: s.foundingDiscountPct, newSlot: false } : { pct: 0, newSlot: false };
  }
  return o.foundingUsers < s.foundingSlots ? { pct: s.foundingDiscountPct, newSlot: true } : { pct: 0, newSlot: false };
}

// ── Mã chuyển khoản ─────────────────────────────────────────────────────────────────────────────
export const MEMO_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";
export function buildMemoCode(prefix: string, rnd: (i: number) => number, len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) s += MEMO_ALPHABET[rnd(i) % MEMO_ALPHABET.length];
  return `${prefix}${s}`;
}
/** Tiền tố hợp lệ: chữ in hoa, số và gạch ngang, 3–12 ký tự (ngân hàng bỏ ký tự lạ trong nội dung chuyển khoản). */
export function cleanMemoPrefix(raw: string | undefined): string {
  const v = (raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9-]{3,12}$/.test(v) ? v : "KINPRO-";
}

// ── Kiểm đầu vào cấu hình (admin) ───────────────────────────────────────────────────────────────
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

export function validatePlanConfigInput(body: unknown): { ok: true; plans: PlanConfigRow[]; settings: Partial<PlanSettings> } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Dữ liệu không hợp lệ" };
  const b = body as { plans?: unknown; settings?: unknown };
  const plans: PlanConfigRow[] = [];
  if (b.plans !== undefined) {
    if (!Array.isArray(b.plans)) return { ok: false, error: "Danh sách gói không hợp lệ" };
    const seen = new Set<string>();
    for (const raw of b.plans) {
      const p = raw as Partial<PlanConfigRow> | null;
      if (!p || (p.code !== "free" && p.code !== "pro")) return { ok: false, error: "Mã gói phải là free hoặc pro" };
      if (seen.has(p.code)) return { ok: false, error: "Mã gói bị lặp" };
      seen.add(p.code);
      if (!isInt(p.studentLimit, 0, 100_000)) return { ok: false, error: "Trần học viên phải là số nguyên từ 0 đến 100.000" };
      if (!isInt(p.aiExtractPerMonth, 0, 10_000)) return { ok: false, error: "Số lượt AI mỗi tháng phải là số nguyên từ 0 đến 10.000" };
      for (const k of ["priceMonthVnd", "priceQuarterVnd", "priceYearVnd"] as const) {
        if (!isInt(p[k], 0, 100_000_000)) return { ok: false, error: "Giá phải là số nguyên đồng từ 0 đến 100.000.000" };
      }
      const name = typeof p.name === "string" ? p.name.trim().slice(0, 40) : "";
      plans.push({
        code: p.code, name: name || PLAN_DEFAULTS[p.code].name, studentLimit: p.studentLimit, aiExtractPerMonth: p.aiExtractPerMonth,
        priceMonthVnd: p.priceMonthVnd as number, priceQuarterVnd: p.priceQuarterVnd as number, priceYearVnd: p.priceYearVnd as number,
      });
    }
  }
  const settings: Partial<PlanSettings> = {};
  if (b.settings !== undefined) {
    if (!b.settings || typeof b.settings !== "object") return { ok: false, error: "Cài đặt không hợp lệ" };
    const s = b.settings as Record<string, unknown>;
    for (const k of Object.keys(SETTING_RANGE) as (keyof PlanSettings)[]) {
      if (s[k] === undefined) continue;
      const [lo, hi] = SETTING_RANGE[k];
      if (!isInt(s[k], lo, hi)) return { ok: false, error: `Cài đặt "${k}" phải là số nguyên từ ${lo} đến ${hi}` };
      settings[k] = s[k] as number;
    }
  }
  return { ok: true, plans, settings };
}

/** Đọc cài đặt từ các cặp khoá-giá trị; giá trị hỏng hoặc ngoài khoảng thì dùng mặc định (không ném lỗi). */
export function settingsFromKV(rows: { key: string; value: string }[]): PlanSettings {
  const out: PlanSettings = { ...SETTING_DEFAULTS };
  for (const k of Object.keys(SETTING_KEYS) as (keyof PlanSettings)[]) {
    const row = rows.find(r => r.key === SETTING_KEYS[k]);
    if (!row) continue;
    const n = Number(row.value), [lo, hi] = SETTING_RANGE[k];
    if (Number.isInteger(n) && n >= lo && n <= hi) out[k] = n;
  }
  return out;
}

/** 00:00 ngày mùng 1 theo giờ Việt Nam của tháng chứa `now` — mốc đếm lượt AI mỗi tháng. */
export function vnMonthStart(now: Date): Date {
  return new Date(`${vnMonthKey(now)}-01T00:00:00+07:00`);
}
