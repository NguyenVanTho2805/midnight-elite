// KiN Pro — NỀN GÓI: công thức thuần (src/lib/planLimits.ts, src/lib/proPayment.ts) + quét tĩnh mã (STK giả, chặn nạp Coin, chặn xem trước, công tắc mặc định tắt).
// Không cần DB hay máy chủ. Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-pro-plan-lib.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BILLING_PERIODS, CLASS_PAUSED_MESSAGE, MEMO_ALPHABET, PERIOD_DAYS, PLAN_DEFAULTS, SETTING_DEFAULTS, WARN_PCT,
  applyDiscount, buildMemoCode, canAdd, cleanMemoPrefix, featureCheck, foundingDiscount, gateDecision, isPlanEnforced, isPreviewEnv,
  nextProPeriod, priceOf, proStateOf, quotaState, settingsFromKV, validatePlanConfigInput, vnMonthStart,
  type PlanSettings, type ProPeriodLike,
} from "@/lib/planLimits";
import { proPayConfig, proQrUrl } from "@/lib/proPayment";
import { check, section, done } from "./h";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(ROOT, d))) { const p = join(d, n); if (statSync(join(ROOT, p)).isDirectory()) { if (n !== "generated") walk(p, out); } else out.push(p); } return out; };
const DAY = 86_400_000;
const NOW = new Date("2026-10-23T05:00:00Z");
const st = (u: number, l: number) => quotaState(u, l).state;

(async () => {
  section("Bốn trạng thái hạn mức (ok / warn ≥80% / blocked / over)");
  check("ngưỡng warn là 80", WARN_PCT === 80);
  check("0/10 và 7/10 → ok", st(0, 10) === "ok" && st(7, 10) === "ok");
  check("8/10 → warn (đúng 80%, vẫn làm được)", st(8, 10) === "warn" && st(9, 10) === "warn");
  check("10/10 → blocked (đạt trần)", st(10, 10) === "blocked");
  check("11/10 và 30/10 → over (đang có nhiều hơn trần Free)", st(11, 10) === "over" && st(30, 10) === "over");
  check("ranh giới làm tròn: 2/3 = 67% → ok; 4/5 = 80% → warn; 3/4 = 75% → ok", st(2, 3) === "ok" && st(4, 5) === "warn" && st(3, 4) === "ok");
  check("trần 0: 0/0 → blocked, 1/0 → over (không chia cho 0, pct không NaN)", st(0, 0) === "blocked" && st(1, 0) === "over" && Number.isFinite(quotaState(0, 0).pct));
  const q = quotaState(8, 10);
  check("remaining và pct", q.remaining === 2 && q.pct === 80 && quotaState(12, 10).remaining === 0);
  // Ca phá: dữ liệu lạ không được làm cổng đóng nhầm hay sinh NaN.
  check("PHÁ: NaN / âm / Infinity / số lẻ không làm hỏng", st(NaN, 10) === "ok" && st(-5, 10) === "ok" && quotaState(Infinity, 10).used === 0 && st(9.9, 10) === "warn" && st(10.9, 10) === "blocked");
  check("PHÁ: limit NaN/âm → coi như 0, không ném lỗi", st(0, NaN) === "blocked" && st(0, -3) === "blocked");

  section("canAdd và cổng");
  check("9/10 thêm 1 được, 10/10 thêm 1 không", canAdd(9, 10) && !canAdd(10, 10) && !canAdd(11, 10));
  check("thêm 5 khi còn 2 chỗ → không; đủ chỗ → được (mời hàng loạt)", !canAdd(8, 10, 5) && canAdd(5, 10, 5) && canAdd(8, 10, 2));
  check("thêm 0 luôn được kể cả đang vượt trần (không chặn việc không thêm ai)", canAdd(30, 10, 0) && canAdd(10, 10, 0));
  const off = gateDecision({ enforced: false, used: 10, limit: 10 }), on = gateDecision({ enforced: true, used: 10, limit: 10 });
  check("cổng TẮT: luôn cho phép nhưng báo wouldBlock (đếm bóng)", off.allow && off.wouldBlock && !off.enforced);
  check("cổng BẬT: chặn tại trần", !on.allow && on.wouldBlock);
  check("cổng BẬT: còn chỗ thì cho", gateDecision({ enforced: true, used: 9, limit: 10 }).allow && !gateDecision({ enforced: true, used: 9, limit: 10 }).wouldBlock);
  check("cổng BẬT: học viên đã đang học (add 0) không bị chặn dù lớp đầy", gateDecision({ enforced: true, used: 10, limit: 10, add: 0 }).allow);
  check("cổng BẬT, vượt trần: chặn thêm", !gateDecision({ enforced: true, used: 14, limit: 10 }).allow);

  section("Công tắc cưỡng chế: biến môi trường, MẶC ĐỊNH TẮT");
  check("không đặt → TẮT", !isPlanEnforced({}));
  check("chỉ đúng '1' mới BẬT", isPlanEnforced({ KIN_PLAN_ENFORCE: "1" }) && !isPlanEnforced({ KIN_PLAN_ENFORCE: "true" }) && !isPlanEnforced({ KIN_PLAN_ENFORCE: "0" }) && !isPlanEnforced({ KIN_PLAN_ENFORCE: "" }) && !isPlanEnforced({ KIN_PLAN_ENFORCE: " 1" }));
  check("bản xem trước luôn TẮT dù đặt 1", !isPlanEnforced({ KIN_PLAN_ENFORCE: "1", VERCEL_ENV: "preview" }) && isPlanEnforced({ KIN_PLAN_ENFORCE: "1", VERCEL_ENV: "production" }));
  check("isPreviewEnv", isPreviewEnv({ VERCEL_ENV: "preview" }) && !isPreviewEnv({ VERCEL_ENV: "production" }) && !isPreviewEnv({}));

  section("Gói hiện có: kỳ Pro, cộng dồn, hết hạn");
  const P = (status: string, s: number, e: number): ProPeriodLike => ({ status, startDate: new Date(NOW.getTime() + s * DAY), endDate: new Date(NOW.getTime() + e * DAY) });
  check("không có kỳ nào → Free", !proStateOf([], NOW).isPro && proStateOf([], NOW).proUntil === null);
  check("đang trong kỳ active → Pro tới ngày cuối", proStateOf([P("active", -5, 25)], NOW).isPro && proStateOf([P("active", -5, 25)], NOW).proUntil!.getTime() === NOW.getTime() + 25 * DAY);
  check("kỳ đã hết → Free (hết hạn về Free)", !proStateOf([P("active", -40, -10)], NOW).isPro);
  check("kỳ chờ / huỷ không tính là Pro", !proStateOf([P("pending", -5, 25)], NOW).isPro && !proStateOf([P("cancelled", -5, 25)], NOW).isPro);
  check("kỳ nối tiếp ở tương lai chưa tính, nhưng báo nextStart", (() => { const r = proStateOf([P("active", 3, 33)], NOW); return !r.isPro && r.nextStart!.getTime() === NOW.getTime() + 3 * DAY; })());
  check("hai kỳ liền nhau → hạn là điểm cuối của chuỗi (cộng dồn)", proStateOf([P("active", -5, 25), P("active", 25, 55)], NOW).proUntil!.getTime() === NOW.getTime() + 55 * DAY);
  check("PHÁ: kỳ thiếu ngày (null) bị bỏ qua, không ném lỗi", !proStateOf([{ status: "active", startDate: null, endDate: null }], NOW).isPro);
  const fresh = nextProPeriod(null, 30, NOW), stack = nextProPeriod(new Date(NOW.getTime() + 10 * DAY), 30, NOW), past = nextProPeriod(new Date(NOW.getTime() - DAY), 30, NOW);
  check("mua khi chưa Pro: bắt đầu ngay; đang Pro: nối sau hạn; hạn đã qua: bắt đầu ngay", fresh.startDate.getTime() === NOW.getTime() && fresh.endDate.getTime() === NOW.getTime() + 30 * DAY && stack.startDate.getTime() === NOW.getTime() + 10 * DAY && stack.endDate.getTime() === NOW.getTime() + 40 * DAY && past.startDate.getTime() === NOW.getTime());

  section("Tính năng Pro cho agent khác: featureCheck");
  check("cổng TẮT: Free vẫn dùng được mọi tính năng, wouldBlock báo thật", ["reminder_steps", "branded_docs", "advanced_stats", "ai_extract_quota"].every(f => {
    const r = featureCheck(f as never, { enforced: false, isPro: false, aiRemaining: 0 });
    return r.allowed && r.wouldBlock;
  }));
  check("cổng BẬT: Free bị chặn ba tính năng Pro, Pro được", (["reminder_steps", "branded_docs", "advanced_stats"] as const).every(f => !featureCheck(f, { enforced: true, isPro: false, aiRemaining: 3 }).allowed && featureCheck(f, { enforced: true, isPro: true, aiRemaining: 0 }).allowed));
  check("cổng BẬT: ai_extract_quota theo lượt còn, không theo gói", featureCheck("ai_extract_quota", { enforced: true, isPro: false, aiRemaining: 1 }).allowed && !featureCheck("ai_extract_quota", { enforced: true, isPro: true, aiRemaining: 0 }).allowed);

  section("Giá, giảm giá sáng lập");
  const d = PLAN_DEFAULTS.pro;
  check("mặc định đề xuất: Free 10 học viên / 3 lượt AI; Pro 20 lượt; giá 79.000 / 199.000 / 599.000", PLAN_DEFAULTS.free.studentLimit === 10 && PLAN_DEFAULTS.free.aiExtractPerMonth === 3 && d.aiExtractPerMonth === 20 && priceOf(d, "month") === 79_000 && priceOf(d, "quarter") === 199_000 && priceOf(d, "year") === 599_000);
  check("Free không có giá", PLAN_DEFAULTS.free.priceMonthVnd === 0);
  check("kỳ: 30 / 90 / 365 ngày", PERIOD_DAYS.month === 30 && PERIOD_DAYS.quarter === 90 && PERIOD_DAYS.year === 365 && BILLING_PERIODS.length === 3);
  check("giảm 30% của 79.000 = 55.300; 0% giữ nguyên; 100% = 0; >100 và âm bị kẹp", applyDiscount(79_000, 30) === 55_300 && applyDiscount(79_000, 0) === 79_000 && applyDiscount(79_000, 100) === 0 && applyDiscount(79_000, 150) === 0 && applyDiscount(79_000, -20) === 79_000);
  const S: PlanSettings = { ...SETTING_DEFAULTS };
  check("người mới còn suất → được giảm và chiếm suất", (() => { const f = foundingDiscount({ settings: S, foundingStart: null, foundingUsers: 29, now: NOW }); return f.pct === 30 && f.newSlot; })());
  check("hết 30 suất → 0%", foundingDiscount({ settings: S, foundingStart: null, foundingUsers: 30, now: NOW }).pct === 0);
  check("người đã có suất giữ giá dù suất đã đầy, trong 12 tháng", foundingDiscount({ settings: S, foundingStart: new Date(NOW.getTime() - 300 * DAY), foundingUsers: 30, now: NOW }).pct === 30);
  check("quá 12 tháng → hết giảm, và KHÔNG được xin lại suất mới", foundingDiscount({ settings: S, foundingStart: new Date(NOW.getTime() - 400 * DAY), foundingUsers: 0, now: NOW }).pct === 0);
  check("giảm giá cấu hình 0% → luôn 0", foundingDiscount({ settings: { ...S, foundingDiscountPct: 0 }, foundingStart: null, foundingUsers: 0, now: NOW }).pct === 0);

  section("Mã chuyển khoản");
  const code = buildMemoCode("KINPRO-", i => i * 7 + 3);
  check("tiền tố + 8 ký tự trong bảng chữ không nhầm lẫn", code.startsWith("KINPRO-") && code.length === 15 && [...code.slice(7)].every(c => MEMO_ALPHABET.includes(c)) && !/[01IOUF]/.test(code.slice(7)));
  check("tiền tố hợp lệ giữ nguyên (viết hoa), sai/trống/quá dài → KINPRO-", cleanMemoPrefix("kp-") === "KP-" && cleanMemoPrefix("") === "KINPRO-" && cleanMemoPrefix(undefined) === "KINPRO-" && cleanMemoPrefix("có dấu!") === "KINPRO-" && cleanMemoPrefix("ABCDEFGHIJKLMN") === "KINPRO-" && cleanMemoPrefix("ab") === "KINPRO-");

  section("Kiểm đầu vào cấu hình (admin)");
  const okBody = { plans: [{ code: "pro", name: "KiN Pro", studentLimit: 500, aiExtractPerMonth: 20, priceMonthVnd: 79000, priceQuarterVnd: 199000, priceYearVnd: 599000 }], settings: { foundingSlots: 30 } };
  check("hợp lệ", validatePlanConfigInput(okBody).ok);
  const bad = (mut: (b: any) => void) => { const b = JSON.parse(JSON.stringify(okBody)); mut(b); return !validatePlanConfigInput(b).ok; };
  check("PHÁ: số âm, số lẻ, chữ, mã gói lạ, gói lặp, cài đặt ngoài khoảng đều bị từ chối", bad(b => { b.plans[0].studentLimit = -1; }) && bad(b => { b.plans[0].priceMonthVnd = 79000.5; }) && bad(b => { b.plans[0].aiExtractPerMonth = "20"; })
    && bad(b => { b.plans[0].code = "vip"; }) && bad(b => { b.plans.push(b.plans[0]); }) && bad(b => { b.settings.foundingDiscountPct = 95; }) && bad(b => { b.plans[0].priceYearVnd = 1e12; }));
  check("thân rỗng / không phải object bị từ chối", !validatePlanConfigInput(null).ok && !validatePlanConfigInput("x").ok);
  check("settingsFromKV: giá trị hỏng / ngoài khoảng → mặc định", (() => { const s = settingsFromKV([{ key: "pro.legacyTrialDays", value: "abc" }, { key: "pro.foundingSlots", value: "-4" }, { key: "pro.foundingMonths", value: "6" }]); return s.legacyTrialDays === 60 && s.foundingSlots === 30 && s.foundingMonths === 6; })());

  section("Mốc tháng AI theo giờ Việt Nam");
  check("20:00Z ngày 30/9 là 03:00 ngày 1/10 giờ VN → tháng 10 bắt đầu 17:00Z ngày 30/9", vnMonthStart(new Date("2026-09-30T20:00:00Z")).toISOString() === "2026-09-30T17:00:00.000Z");
  check("giữa tháng 10", vnMonthStart(new Date("2026-10-23T05:00:00Z")).toISOString() === "2026-09-30T17:00:00.000Z");

  section("Nhận tiền: biến môi trường, không có STK giả");
  const GOOD = { KINPRO_BANK_BIN: "970436", KINPRO_ACCOUNT_NO: "9704 3600 12345", KINPRO_ACCOUNT_NAME: "Nguyễn Văn Thử", KINPRO_CODE_PREFIX: "kinpro-" };
  const open = proPayConfig(GOOD);
  check("đủ biến → mở bán; tên chủ TK chuẩn hoá; số TK bỏ dấu cách; tiền tố viết hoa", open.open && open.account?.accountNo === "9704360012345" && open.account?.accountName === "NGUYEN VAN THU" && open.prefix === "KINPRO-" && open.account?.bankName.length > 0, open);
  check("thiếu biến → 'no-config', KHÔNG có tài khoản nào", (() => { const c = proPayConfig({}); return !c.open && c.reason === "no-config" && c.account === null && !c.configured; })());
  check("thiếu riêng tên chủ TK → chưa mở", !proPayConfig({ ...GOOD, KINPRO_ACCOUNT_NAME: "" }).open);
  check("PHÁ: BIN sai (5 chữ số / chữ) hay số TK có chữ → chưa mở", !proPayConfig({ ...GOOD, KINPRO_BANK_BIN: "97043" }).open && !proPayConfig({ ...GOOD, KINPRO_BANK_BIN: "abcdef" }).open && !proPayConfig({ ...GOOD, KINPRO_ACCOUNT_NO: "12ab34" }).open);
  check("bản xem trước → chưa mở, không lộ tài khoản", (() => { const c = proPayConfig({ ...GOOD, VERCEL_ENV: "preview" }); return !c.open && c.reason === "preview" && c.account === null && c.configured; })());
  check("KIN_TRIAL_MODE=1 → chưa mở, không lộ tài khoản", (() => { const c = proPayConfig({ ...GOOD, KIN_TRIAL_MODE: "1" }); return !c.open && c.reason === "trial" && c.account === null; })());
  check("QR dùng đúng số tiền, số TK và nội dung", (() => { const u = new URL(proQrUrl(open.account!, 55_300, "KINPRO-ABCDEFGH")); return u.pathname.includes(`${open.account!.bankBin}-${open.account!.accountNo}`) && u.searchParams.get("amount") === "55300" && u.searchParams.get("addInfo") === "KINPRO-ABCDEFGH"; })());

  section("Quét tĩnh mã nguồn");
  const src = walk("src").filter(p => /\.(tsx?|css)$/.test(p));
  const noComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const fakeAcc = src.filter(p => /0123456789|CONG TY KIN EDUCATION/.test(noComments(read(p))));
  check("PHASE 0: không còn STK giả (0123456789 / CONG TY KIN EDUCATION) trong mã", fakeAcc.length === 0, fakeAcc);
  check("PHASE 0: BANK_INFO không còn được xuất hay dùng", !src.some(p => /\bBANK_INFO\b/.test(noComments(read(p)))));
  const topups = read("src/app/api/wallet/topups/route.ts");
  check("PHASE 0: POST /api/wallet/topups chặn GIA SƯ khi KIN_TRIAL_MODE (403) TRƯỚC khi tạo bản ghi", /isTrialMode\(\)/.test(topups) && topups.indexOf("isTrialMode()") < topups.indexOf("topups().create") && /status: 403/.test(topups.slice(topups.indexOf("isTrialMode()"), topups.indexOf("isTrialMode()") + 260)));
  check("PHASE 0: khối chuyển khoản trả null khi thiếu cấu hình", /bankOf/.test(topups) && /getTopupBankInfo/.test(topups));
  check("PHASE 0: mua VIP bằng Coin và nạp Coin chặn xem trước (VERCEL_ENV=preview)", /isPreviewEnv\(\)/.test(read("src/app/api/subscriptions/[code]/purchase/route.ts")) && /isPreviewEnv\(\)/.test(topups));
  const ps = read("src/lib/planServer.ts");
  check("tạo yêu cầu / kích hoạt / tặng chặn xem trước", /proPayConfig\(\)/.test(ps) && (ps.match(/isPreviewEnv\(\)/g) ?? []).length >= 2);
  check("mã Pro không đụng Coin, ví hay giao dịch Coin", !/wallet|coinTransaction|spendCoins/i.test(noComments(ps)) && !/wallet|coinTransaction/i.test(noComments(read("src/app/api/tutor/goi/mua/route.ts"))));
  const redeem = read("src/app/api/invites/[id]/redeem/route.ts");
  check("ghi danh bằng mã mời: gọi cổng TRONG giao dịch, học viên chỉ thấy chữ trung tính, không lộ gói", /assertCanAddStudent\(course\.ownerId, \{[^}]*db: tx/.test(redeem) && /CLASS_PAUSED_MESSAGE/.test(redeem) && CLASS_PAUSED_MESSAGE === "Lớp tạm chưa nhận thêm" && !/PLAN_LIMIT|Free|Pro\b/.test(redeem.replace(/\/\/.*$/gm, "")));
  check("mã mời / mời hàng loạt: gọi cổng, trả 409 PLAN_LIMIT", /assertCanAddStudent/.test(read("src/app/api/courses/[id]/invites/route.ts")) && /PLAN_LIMIT_CODE/.test(read("src/app/api/courses/[id]/invites/route.ts")));
  check("mã có maxUses N cần đủ N chỗ (BulkInvite không đổi, vẫn chỉ gửi maxUses + expiresAt)", /const add = maxUses \?\? 1/.test(read("src/app/api/courses/[id]/invites/route.ts")) && !/bulk/.test(read("src/components/tutor/BulkInvite.tsx").replace(/\/\/.*$/gm, "").replace(/bulkInvite|BulkInvite|Bulk[A-Z]\w*|BULK_\w+|bulk-code|[a-z]+Bulk\w*/g, "")));
  const ai1 = read("src/app/api/exams/ai-extract-questions/route.ts"), ai2 = read("src/app/api/exam-files/[id]/extract/route.ts");
  check("hai tuyến AI trích đề: giữ lượt TRƯỚC khi gọi mô hình, trả lượt khi thất bại", [ai1, ai2].every(t => /reserveAiExtract/.test(t) && /releaseAiExtract/.test(t) && t.indexOf("reserveAiExtract(") < t.indexOf("extractQuestionsFromFiles(")));
  check("lỗi đọc gói → CHO PHÉP (cả cổng học viên, AI và canUse)", (ps.match(/lỗi đọc gói, cho phép/g) ?? []).length === 3);
  check("cổng đặt khoá advisory theo gia sư cho học viên và AI", /plan_tutor:/.test(ps) && /plan_ai:/.test(ps));
  const nav = read("src/lib/adminNav.ts");
  check("menu admin có trang cấu hình gói, quyền MANAGE_REVENUE", /\/admin\/goi-pro", permission: PERMISSIONS\.MANAGE_REVENUE/.test(nav));
  check("menu 'Khác' của gia sư có 'Gói của tôi'", /label: "Gói của tôi", href: "\/lop-cua-toi\/goi"/.test(read("src/components/tutor/TutorShell.tsx")));
  const goi = read("src/app/lop-cua-toi/(tutor)/goi/GoiClient.tsx");
  check("màn Gói không có số tiền / số tài khoản viết cứng; giá lấy từ cấu hình", !/\b\d{2,3}[.,]\d{3}\b/.test(noComments(goi)) && /pro\[p\.priceKey\]/.test(goi));

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
