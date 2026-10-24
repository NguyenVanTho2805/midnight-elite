// KiN Pro — webhook SePay xác nhận thanh toán + nhắc gia hạn T-7/T-3/T-0: quy tắc THUẦN + quét tĩnh mã. Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-pro-webhook-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMemoCode, MEMO_ALPHABET } from "@/lib/planLimits";
import { decideProPayment, extractProCode, proPayConfig, proPrefixDisjointFromInvoice, proWebhookConfig, verifyEnvApiKey } from "@/lib/proPayment";
import { extractInvoiceCode } from "@/lib/tuitionInvoice";
import { RENEWAL_MILESTONES, daysLeftVn, planRenewals, renewalMilestone, renewalText } from "@/lib/proRenewal";
import { PUSH_TYPES } from "@/lib/pushRules";
import { check, section, done } from "./h";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const GOOD = { KINPRO_BANK_BIN: "970436", KINPRO_ACCOUNT_NO: "9704360012345", KINPRO_ACCOUNT_NAME: "Kin Pro Thu", KINPRO_SEPAY_API_KEY: "khoa-sepay-thu-nghiem-0123456789" };
const D = 86_400_000;

(async () => {
  section("Webhook chỉ BẬT khi đủ biến môi trường");
  const on = proWebhookConfig(GOOD);
  check("đủ khoá + tài khoản nhận tiền → bật, tiền tố mặc định KINPRO-", on.enabled && on.reason === null && on.prefix === "KINPRO-" && on.accountNo === "9704360012345" && on.apiKey === GOOD.KINPRO_SEPAY_API_KEY, on);
  check("không có gì → tắt, không lộ khoá", (() => { const c = proWebhookConfig({}); return !c.enabled && c.reason === "no-key" && c.apiKey === null; })());
  check("thiếu khoá (chỉ có tài khoản) → tắt 'no-key'", proWebhookConfig({ ...GOOD, KINPRO_SEPAY_API_KEY: "" }).reason === "no-key");
  check("thiếu tài khoản nhận tiền (chỉ có khoá) → tắt 'no-config'", proWebhookConfig({ KINPRO_SEPAY_API_KEY: GOOD.KINPRO_SEPAY_API_KEY }).reason === "no-config");
  check("PHÁ: khoá quá ngắn (15 ký tự) hay toàn khoảng trắng → tắt", !proWebhookConfig({ ...GOOD, KINPRO_SEPAY_API_KEY: "a".repeat(15) }).enabled && !proWebhookConfig({ ...GOOD, KINPRO_SEPAY_API_KEY: " ".repeat(40) }).enabled && proWebhookConfig({ ...GOOD, KINPRO_SEPAY_API_KEY: "a".repeat(16) }).enabled);
  check("VERCEL_ENV=preview → tắt 'preview' dù đủ biến", (() => { const c = proWebhookConfig({ ...GOOD, VERCEL_ENV: "preview" }); return !c.enabled && c.reason === "preview" && c.apiKey === null; })());
  check("VERCEL_ENV=production vẫn bật", proWebhookConfig({ ...GOOD, VERCEL_ENV: "production" }).enabled);
  check("tài khoản sai định dạng (BIN 5 chữ số) → tắt", !proWebhookConfig({ ...GOOD, KINPRO_BANK_BIN: "97043" }).enabled);
  check("cờ chạy thử KIN_TRIAL_MODE không làm webhook tắt (chỉ màn bán gói đóng), nhưng không có đơn nào để khớp", proWebhookConfig({ ...GOOD, KIN_TRIAL_MODE: "1" }).enabled && !proPayConfig({ ...GOOD, KIN_TRIAL_MODE: "1" }).open);

  section("Tiền tố KHÁC luồng học phí: mã Pro không bao giờ bị luồng học phí nhận nhầm");
  check("tiền tố mặc định KINPRO- không trùng mã phiếu KIN+5", proPrefixDisjointFromInvoice("KINPRO-"));
  let clash = 0;
  for (let i = 0; i < 3000; i++) {
    const memo = buildMemoCode("KINPRO-", () => Math.floor(Math.random() * 256));
    for (const content of [memo, `CK ${memo}`, `NGUYEN VAN A CHUYEN KHOAN ${memo} CAM ON`, memo.replace("-", " "), memo.replace("-", "")]) if (extractInvoiceCode(null, content) || extractInvoiceCode(memo, content)) clash++;
  }
  check("3000 mã ngẫu nhiên x 5 cách ghi nội dung: extractInvoiceCode luôn null", clash === 0, clash);
  check("PHÁ: tiền tố 'KIN' / 'KIN2' sẽ trùng mã phiếu → bị phát hiện, và webhook TẮT 'prefix-clash'", !proPrefixDisjointFromInvoice("KIN") && !proPrefixDisjointFromInvoice("KIN2") && proWebhookConfig({ ...GOOD, KINPRO_CODE_PREFIX: "KIN2" }).reason === "prefix-clash");
  check("ngược lại: mã phiếu học phí thật không bị luồng Pro nhận (KINAB2C3 → không có mã Pro)", extractProCode("KINPRO-", "KINAB2C3", "HOC PHI KIN AB2C3") === null);

  section("Tìm mã đơn trong nội dung chuyển khoản");
  const code = "KINPRO-7K2Q9XMD";
  check("nguyên văn", extractProCode("KINPRO-", null, code) === code);
  check("ngân hàng bỏ gạch / đổi gạch thành cách / chữ thường / dán tên liền sau", [code, "KINPRO 7K2Q9XMD", "KINPRO7K2Q9XMD", "kinpro-7k2q9xmd", "NGUYEN VAN A KINPRO-7K2Q9XMDNGUYEN", "CK  KINPRO7K2Q9XMD  "].every(c => extractProCode("KINPRO-", null, c) === code));
  check("mã nằm ở trường `code` của SePay cũng được", extractProCode("KINPRO-", "KINPRO7K2Q9XMD", "noi dung khac") === code);
  check("PHÁ: thiếu ký tự (7 thay vì 8), ký tự cấm (O, I, U), tiền tố dính vào chữ khác → không khớp", [
    "KINPRO-7K2Q9XM", "KINPRO-7K2O9XMD", "KINPRO-7K2I9XMD", "KINPRO-7K2U9XMD", "XKINPRO-7K2Q9XMD", "KINPRO", "", "KINPR0-7K2Q9XMD"].every(c => extractProCode("KINPRO-", null, c) === null));
  check("tiền tố khác (đặt qua env) cũng dùng được", extractProCode("PRO-", null, "PRO 7K2Q9XMD") === "PRO-7K2Q9XMD" && extractProCode("PRO-", null, "KINPRO-7K2Q9XMD") === null);
  check("mọi mã sinh ra bởi buildMemoCode đều được tìm lại đúng", Array.from({ length: 500 }, () => buildMemoCode("KINPRO-", () => Math.floor(Math.random() * 256))).every(m => extractProCode("KINPRO-", null, `CK ${m.replace("-", " ")} ok`) === m));
  check("bảng ký tự mã không có O, I, U (không nhầm với 0, 1, V)", !/[OIU]/.test(MEMO_ALPHABET));

  section("Xác thực khoá");
  check("đúng khoá → true", verifyEnvApiKey(GOOD.KINPRO_SEPAY_API_KEY, GOOD.KINPRO_SEPAY_API_KEY));
  check("PHÁ: sai 1 ký tự / dài hơn / ngắn hơn / rỗng / null / khoá env rỗng → false", !verifyEnvApiKey(GOOD.KINPRO_SEPAY_API_KEY + "x", GOOD.KINPRO_SEPAY_API_KEY) && !verifyEnvApiKey(GOOD.KINPRO_SEPAY_API_KEY.slice(0, -1), GOOD.KINPRO_SEPAY_API_KEY) && !verifyEnvApiKey("khoa-sepay-thu-nghiem-012345678X", GOOD.KINPRO_SEPAY_API_KEY) && !verifyEnvApiKey("", GOOD.KINPRO_SEPAY_API_KEY) && !verifyEnvApiKey(null, GOOD.KINPRO_SEPAY_API_KEY) && !verifyEnvApiKey("", "") && !verifyEnvApiKey("x", "") && !verifyEnvApiKey("x", null));

  section("Quyết định khi tiền về: chỉ ĐÚNG số tiền mới kích hoạt");
  const ord = { status: "pending", source: "purchase", priceVnd: 79_000 };
  check("mã đúng + pending + đúng số → kích hoạt", decideProPayment({ code, order: ord, amount: 79_000 }).action === "activate");
  const r = (o: Parameters<typeof decideProPayment>[0]) => { const d = decideProPayment(o); return d.action === "review" ? d.reason : "activate"; };
  check("thiếu 1 đồng → duyệt tay amount_mismatch", r({ code, order: ord, amount: 78_999 }) === "amount_mismatch");
  check("thừa 1 đồng → duyệt tay (không tự nhận số dư)", r({ code, order: ord, amount: 79_001 }) === "amount_mismatch");
  check("đúng giá niêm yết nhưng đơn đã có giảm giá sáng lập → sai số, duyệt tay", r({ code, order: { ...ord, priceVnd: 71_100 }, amount: 79_000 }) === "amount_mismatch" && r({ code, order: { ...ord, priceVnd: 71_100 }, amount: 71_100 }) === "activate");
  check("không có mã → no_code; mã lạ → unknown_code", r({ code: null, order: null, amount: 79_000 }) === "no_code" && r({ code, order: null, amount: 79_000 }) === "unknown_code");
  check("PHÁ: không có mã nhưng số tiền khớp một đơn → KHÔNG ghép theo số tiền", r({ code: null, order: ord, amount: 79_000 }) === "no_code");
  check("đơn đã active / cancelled → tiền về thêm vào duyệt tay, KHÔNG kích hoạt lần hai", r({ code, order: { ...ord, status: "active" }, amount: 79_000 }) === "order_not_pending" && r({ code, order: { ...ord, status: "cancelled" }, amount: 79_000 }) === "order_not_pending");
  check("suất tặng (giá 0) không bao giờ kích hoạt qua webhook", r({ code, order: { status: "pending", source: "legacy_grant", priceVnd: 0 }, amount: 0 }) === "order_not_purchase" && r({ code, order: { ...ord, priceVnd: 0 }, amount: 0 }) === "amount_mismatch");
  check("PHÁ: số tiền lẻ / NaN / âm → duyệt tay", r({ code, order: ord, amount: 79_000.5 }) === "amount_mismatch" && r({ code, order: ord, amount: NaN }) === "amount_mismatch" && r({ code, order: ord, amount: -79_000 }) === "amount_mismatch");

  section("Nhắc gia hạn: cửa sổ mốc T-7 / T-3 / T-0");
  check("ba mốc là 7, 3, 0", RENEWAL_MILESTONES.join() === "7,3,0");
  const m = (n: number) => renewalMilestone(n);
  check("8 ngày → chưa nhắc; 7,6,5,4 → T-7; 3,2,1 → T-3; 0 → T-0", m(8) === null && [7, 6, 5, 4].every(n => m(n) === 7) && [3, 2, 1].every(n => m(n) === 3) && m(0) === 0);
  check("PHÁ: đã quá hạn (-1), NaN, Infinity → không nhắc", m(-1) === null && m(NaN) === null && m(Infinity) === null);
  const NOW = new Date("2026-11-01T00:30:00Z"); // 07:30 ngày 01/11 giờ VN
  check("ngày lịch VN: hết hạn 23:30 UTC (06:30 sáng hôm sau VN) cách 7 ngày lịch", daysLeftVn(new Date("2026-11-07T23:30:00Z"), NOW) === 7 && daysLeftVn(new Date("2026-11-01T16:59:00Z"), NOW) === 0 && daysLeftVn(new Date("2026-11-01T17:01:00Z"), NOW) === 1);
  const mk = (userId: string, startOff: number, endOff: number) => ({ userId, orders: [{ status: "active", startDate: new Date(NOW.getTime() + startOff * D), endDate: new Date(NOW.getTime() + endOff * D) }] });
  const plan = planRenewals([mk("a", -23, 7), mk("b", -27, 3), mk("c", -29.5, 0.2), mk("d", -20, 10), mk("e", -40, -1), mk("f", 2, 30)], NOW);
  const by = Object.fromEntries(plan.map(p => [p.userId, p.milestone]));
  check("a(7 ngày)=T-7, b(3 ngày)=T-3, c(hôm nay)=T-0; d(10 ngày), e(đã hết hạn), f(chưa bắt đầu) không nhắc", by.a === 7 && by.b === 3 && by.c === 0 && !("d" in by) && !("e" in by) && !("f" in by) && plan.length === 3, plan);
  const chain = planRenewals([{ userId: "g", orders: [{ status: "active", startDate: new Date(NOW.getTime() - 20 * D), endDate: new Date(NOW.getTime() + 2 * D) }, { status: "active", startDate: new Date(NOW.getTime() + 2 * D), endDate: new Date(NOW.getTime() + 32 * D) }] }], NOW);
  check("đã gia hạn nối tiếp (cộng dồn) → hạn thật còn 32 ngày → KHÔNG nhắc dù kỳ đầu sắp hết", chain.length === 0);
  check("đơn 'pending' / 'cancelled' không tính là Pro", planRenewals([{ userId: "h", orders: [{ status: "pending", startDate: null, endDate: null }, { status: "cancelled", startDate: new Date(NOW.getTime() - D), endDate: new Date(NOW.getTime() + D) }] }], NOW).length === 0);
  check("cycleEnd là hạn thật (đổi khi gia hạn → chu kỳ mới, nhắc lại được)", plan.find(p => p.userId === "a")!.cycleEnd.getTime() === NOW.getTime() + 7 * D);

  section("Chữ nhắc: trung thực, không tên, không số tiền");
  const texts = [renewalText(7, 7, new Date("2026-11-08T05:00:00Z")), renewalText(3, 2, new Date("2026-11-03T05:00:00Z")), renewalText(0, 0, new Date("2026-11-01T05:00:00Z"))];
  check("T-7 nêu số ngày và ngày hết hạn giờ VN (08/11/2026)", /còn 7 ngày/.test(texts[0].message) && /08\/11\/2026/.test(texts[0].message));
  check("T-3 gửi trễ vẫn nói đúng số ngày thật (2), không nói 3", /còn 2 ngày/.test(texts[1].message) && !/còn 3 ngày/.test(texts[1].message));
  check("T-0 nói 'hôm nay'", /hôm nay/.test(texts[2].title) && /hôm nay/.test(texts[2].message));
  const all = texts.map(t => `${t.title} ${t.message}`).join(" | ");
  check("không có số tiền (đ, VND, nghìn, số ≥ 4 chữ số ngoài năm) và không có tên người", !/\d[\d.,]*\s*(đ|₫|vnd|nghìn|k\b)/i.test(all) && !/\b\d{4,}\b(?!\/)/.test(all.replace(/\d{2}\/\d{2}\/\d{4}/g, "")) && !/(Cô|Thầy|Bạn\s[A-Z])/.test(all));
  check("không hứa gửi email / tin nhắn / Zalo / tự trừ tiền ('KiN không tự trừ tiền' là lời cam kết)", !/(đã gửi|sẽ gửi|email|tin nhắn|Zalo|SMS)/i.test(all) && /không tự trừ tiền/.test(all));
  check("loại thông báo pro_renewal / pro_activated KHÔNG nằm trong PUSH_TYPES (không đẩy ra điện thoại, chữ app không lên màn hình khoá)", !(PUSH_TYPES as readonly string[]).includes("pro_renewal") && !(PUSH_TYPES as readonly string[]).includes("pro_activated"));

  section("Quét tĩnh mã");
  const route = read("src/app/api/webhooks/sepay-pro/route.ts"), settle = read("src/lib/proPaymentServer.ts"), cron = read("src/app/api/cron/pro-renewal-reminders/route.ts"), ren = read("src/lib/proRenewalServer.ts");
  check("webhook Pro: kiểm cấu hình/xem trước trước khi đụng DB, kiểm khoá bằng verifyEnvApiKey, không so khoá bằng ===", /proWebhookConfig\(\)/.test(route) && /verifyEnvApiKey/.test(route) && !/apiKey\s*===|===\s*cfg\.apiKey/.test(route) && route.indexOf("proWebhookConfig()") < route.indexOf("settleProPayment("));
  check("webhook Pro không có khoá viết cứng và không dùng bảng/khoá webhook học phí", !/Apikey\s+[A-Za-z0-9_-]{8,}/.test(route) && !/tutorPayoutAccount|webhookKeyHash|tuitionInvoice\./.test(route + settle));
  check("settleProPayment chặn bản xem trước, tạo dòng chống trùng TRƯỚC khi kích hoạt, bắt P2002", /isPreviewEnv\(\)/.test(settle) && settle.indexOf("proPayment.create") < settle.indexOf("applyProActivation(db") && /P2002/.test(settle));
  check("webhook không có đường hoàn tiền / chuyển tiền (không gọi API ngân hàng, không refund)", !/refund|hoan_tien|transfer\(|payout\(|fetch\(/i.test(route + settle));
  check("cron nhắc: đòi CRON_SECRET, production thiếu khoá → 503, ghi dấu lần chạy", /CRON_SECRET/.test(cron) && /cronSecretMissingIsFatal/.test(cron) && /Bearer \$\{secret\}/.test(cron) && /recordCronRun\("pro-renewal-reminders"\)/.test(cron));
  check("nhắc chạy: bỏ qua bản xem trước và khi chưa mở bán; thông báo và dòng chống trùng cùng MỘT giao dịch", /isPreviewEnv\(\)/.test(ren) && /proPayConfig\(\)\.open/.test(ren) && /\$transaction/.test(ren) && ren.indexOf("proRenewalReminder.create") < ren.indexOf("notification.create"));
  check("nhắc chỉ gửi cho chủ gói: where theo userId của đơn active, không gọi notifyMany/broadcast", !/notifyMany/.test(ren) && /status: "active"/.test(ren));
  check("vercel.json có cron nhắc gia hạn", JSON.parse(read("vercel.json")).crons.some((c: { path: string }) => c.path === "/api/cron/pro-renewal-reminders"));
  check("schema chỉ THÊM: hai bảng mới, ràng buộc unique chỉ nằm trong bảng mới", (() => {
    const s = read("prisma/schema.prisma");
    const blk = (n: string) => new RegExp(`model ${n} \\{[\\s\\S]*?\\n\\}`).exec(s)?.[0] ?? "";
    return /@@unique/.test(blk("ProPayment")) && /@@unique/.test(blk("ProRenewalReminder")) && !/(?<!@)@unique/.test(blk("ProPayment") + blk("ProRenewalReminder"));
  })());
  await done();
})();
