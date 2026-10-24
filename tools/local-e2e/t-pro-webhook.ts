// KiN Pro — webhook SePay xác nhận thanh toán (API + DB thật) + cron nhắc gia hạn T-7/T-3/T-0.
// Cờ là biến môi trường của MÁY CHỦ nên chạy BỐN lần, mỗi lần khởi động lại máy chủ (xem tools/local-e2e/pro-webhook-run.sh):
//   on:       KINPRO_* + KINPRO_SEPAY_API_KEY                → EXPECT_MODE=on        (webhook bật, nhắc chạy)
//   nokey:    KINPRO_*, KHÔNG có khoá SePay                   → EXPECT_MODE=nokey     (webhook 503)
//   noconfig: khoá SePay nhưng KHÔNG có KINPRO_* nhận tiền   → EXPECT_MODE=noconfig  (webhook 503, nhắc không chạy vì chưa mở bán)
//   preview:  VERCEL_ENV=preview + đủ biến                    → EXPECT_MODE=preview   (webhook 403, nhắc không chạy)
// Bài tự đặt biến KINPRO_* trong tiến trình của nó cho khớp máy chủ (runProRenewalReminders chạy ngay trong bài).
import { api, mkSuper, mkTutor, mkUser, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";
import { buildMemoCode } from "@/lib/planLimits";

const MODE = process.env.EXPECT_MODE as "on" | "nokey" | "noconfig" | "preview";
if (!["on", "nokey", "noconfig", "preview"].includes(MODE)) throw new Error("Đặt EXPECT_MODE=on|nokey|noconfig|preview");
const KEY = "khoa-sepay-thu-nghiem-0123456789", ACCT = "9704360012345", DAY = 86_400_000;
const hasAcct = MODE !== "noconfig", hasKey = MODE !== "nokey";
for (const k of ["KINPRO_BANK_BIN", "KINPRO_ACCOUNT_NO", "KINPRO_ACCOUNT_NAME", "KINPRO_SEPAY_API_KEY", "VERCEL_ENV"]) delete process.env[k];
if (hasAcct) { process.env.KINPRO_BANK_BIN = "970436"; process.env.KINPRO_ACCOUNT_NO = ACCT; process.env.KINPRO_ACCOUNT_NAME = "Kin Pro Thu"; }
if (hasKey) process.env.KINPRO_SEPAY_API_KEY = KEY;
if (MODE === "preview") process.env.VERCEL_ENV = "preview";
const CRON = process.env.CRON_SECRET!;
const ENABLED = MODE === "on";

let txSeq = 5000;
const memo = () => buildMemoCode("KINPRO-", () => Math.floor(Math.random() * 256));
const hook = (o: { id?: number | string; amount?: number; content?: string; type?: string; key?: string | null; scheme?: string; account?: string; code?: string | null }) =>
  api("POST", "/api/webhooks/sepay-pro", {
    headers: o.key === null ? {} : { authorization: `${o.scheme ?? "Apikey"} ${o.key ?? KEY}` },
    body: { id: o.id ?? ++txSeq, transferType: o.type ?? "in", transferAmount: o.amount ?? 79_000, content: o.content ?? "", code: o.code ?? null, accountNumber: o.account ?? ACCT, gateway: "MBBank", transactionDate: "2026-10-24 10:00:00", accumulated: 99999999 },
  });
const mkOrder = (userId: string, o: { price?: number; status?: string; source?: string; days?: number; code?: string; start?: Date; end?: Date } = {}) =>
  prisma.proOrder.create({ data: { userId, period: "month", durationDays: o.days ?? 30, listPriceVnd: 79_000, priceVnd: o.price ?? 79_000, source: o.source ?? "purchase", memoCode: o.code ?? memo(), status: o.status ?? "pending", startDate: o.start ?? null, endDate: o.end ?? null } });
const ord = (id: string) => prisma.proOrder.findUniqueOrThrow({ where: { id } });
const pays = () => prisma.proPayment.count();

(async () => {
  await wipe();
  const T = await mkTutor("Cô Mua Pro"), T2 = await mkTutor("Cô Sai Số"), T3 = await mkTutor("Cô Chạy Đua"), A = await mkSuper("Admin Tiền"), S = await mkUser({ name: "Học sinh" });
  const before = { inv: await prisma.tuitionInvoice.count(), btx: await prisma.bankTransaction.count(), coin: await prisma.coinTopupRequest.count() };

  section(`Máy chủ đúng chế độ: ${MODE}`);
  const o0 = await mkOrder(T.id), c0 = o0.memoCode;
  const probe = await hook({ content: c0, amount: 79_000 });
  if (!ENABLED) {
    const want = MODE === "preview" ? 403 : 503;
    check(`webhook TẮT (${MODE}) → ${want}, kể cả khi gửi đúng khoá và đúng mã`, probe.status === want && probe.json?.success === false, probe.json);
    check("không ghi gì vào DB, đơn vẫn chờ, không có Pro", (await pays()) === 0 && (await ord(o0.id)).status === "pending");
    check("PHÁ: không khoá / sai khoá cũng không lộ khác biệt (vẫn cùng mã TẮT)", (await hook({ key: null })).status === want && (await hook({ key: "sai" })).status === want);
    check("GET không phải đường vào (405)", (await api("GET", "/api/webhooks/sepay-pro")).status === 405);
  } else {
    check("bật: đúng khoá + đúng mã + đúng số → 200 {success:true}", probe.status === 200 && probe.json.success === true && !probe.json.duplicate, probe);
    check("đơn chuyển active, hạn = hôm nay + 30 ngày, ghi mã giao dịch ngân hàng, người kích hoạt = hệ thống (null)", await (async () => {
      const o = await ord(o0.id);
      return o.status === "active" && !!o.endDate && !!o.startDate && Math.abs(o.endDate.getTime() - o.startDate.getTime() - 30 * DAY) < 1000 && Math.abs(o.startDate.getTime() - Date.now()) < 60_000 && o.activatedBy === null && o.bankRef === String(txSeq);
    })());
    const p0 = await prisma.proPayment.findMany();
    check("sổ đối soát: 1 dòng 'activated' gắn đơn, đúng số tiền, mã đã chuẩn hoá", p0.length === 1 && p0[0].status === "activated" && p0[0].orderId === o0.id && p0[0].amount === 79_000 && p0[0].matchedCode === c0 && p0[0].reason === null, p0);
    const ns = await prisma.notification.findMany({ where: { userId: T.id, type: "pro_activated" } });
    check("gia sư nhận đúng 1 thông báo, chữ KHÔNG có tên và KHÔNG có số tiền, trỏ /lop-cua-toi/goi", ns.length === 1 && ns[0].link === "/lop-cua-toi/goi" && !/\d|Cô /.test(ns[0].title + ns[0].message), ns);
    check("ghi audit pro_order.activate_sepay", (await prisma.auditLog.count({ where: { action: "pro_order.activate_sepay", resourceId: o0.id } })) === 1);
    const plan = (await api("GET", "/api/tutor/goi", { as: T })).json.plan;
    check("màn Gói của tôi thấy Pro", plan.code === "pro" && plan.isPro === true, plan);

    section("Xác thực và lọc đầu vào");
    const n0 = await pays();
    check("không có khoá → 401; sai khoá (khác 1 ký tự) → 401; khoá rỗng → 401", (await hook({ key: null })).status === 401 && (await hook({ key: KEY.slice(0, -1) + "X", content: c0 })).status === 401 && (await hook({ key: "" })).status === 401);
    check("PHÁ: khoá đúng nhưng sai kiểu ('Basic') → 401", (await hook({ scheme: "Basic" })).status === 401);
    check("kiểu 'Bearer' cũng được chấp nhận (SePay hỗ trợ cả hai)", (await hook({ scheme: "Bearer", content: "không có mã" })).status === 200);
    check("tiền RA (transferType out) → bỏ qua, không ghi", (await hook({ type: "out", content: memo() })).json.ignored === true && (await pays()) === n0 + 1);
    const o9 = await mkOrder(T2.id), c9 = o9.memoCode, n1 = await pays();
    const wrongAcc = await hook({ content: c9, account: "1111222233" });
    check("PHÁ: tiền vào tài khoản KHÁC tài khoản KiN Pro (cùng khoá SePay) → bỏ qua, đơn không bị kích hoạt, không ghi", wrongAcc.json.ignored === true && (await ord(o9.id)).status === "pending" && (await pays()) === n1);
    check("body hỏng / thiếu id / số tiền không nguyên → 400, không ghi", (await api("POST", "/api/webhooks/sepay-pro", { headers: { authorization: `Apikey ${KEY}` }, raw: "{không phải json" })).status === 400 && (await hook({ id: "", content: c9 })).status === 400 && (await hook({ amount: 79_000.5, content: c9 })).status === 400 && (await hook({ amount: -1, content: c9 })).status === 400 && (await ord(o9.id)).status === "pending");

    section("Idempotent: cùng giao dịch gọi lại không kích hoạt hai lần");
    const endBefore = (await ord(o0.id)).endDate!.getTime();
    const first = await prisma.proPayment.findFirstOrThrow({ where: { status: "activated" } });
    const replay = await hook({ id: first.providerTxId, content: c0 });
    check("gọi lại đúng giao dịch cũ → 200 duplicate, hạn không đổi, vẫn 1 thông báo", replay.status === 200 && replay.json.duplicate === true && (await ord(o0.id)).endDate!.getTime() === endBefore && (await prisma.notification.count({ where: { userId: T.id, type: "pro_activated" } })) === 1);
    const o1 = await mkOrder(T3.id), id1 = 777001;
    const burst = await Promise.all(Array.from({ length: 6 }, () => hook({ id: id1, content: o1.memoCode })));
    const o1a = await ord(o1.id);
    check("PHÁ: 6 lần gọi ĐỒNG THỜI cùng một giao dịch → tất cả 200, đúng 1 lần kích hoạt (hạn +30 ngày một lần), đúng 1 dòng sổ", burst.every(b => b.status === 200 && b.json.success === true) && o1a.status === "active" && o1a.endDate!.getTime() - o1a.startDate!.getTime() === 30 * DAY && (await prisma.proPayment.count({ where: { providerTxId: String(id1) } })) === 1 && (await prisma.notification.count({ where: { userId: T3.id, type: "pro_activated" } })) === 1, burst.map(b => b.json));
    const endO1 = o1a.endDate!.getTime();
    const o1b = await mkOrder(T3.id), id2 = 777002;
    await Promise.all([hook({ id: id2, content: o1b.memoCode }), hook({ id: id2 + 1, content: o1b.memoCode })]);
    const o1bNow = await ord(o1b.id);
    check("PHÁ: hai giao dịch KHÁC nhau cùng trả một đơn, đồng thời → chỉ một cái kích hoạt, cái kia vào duyệt tay (không cộng 60 ngày)", o1bNow.status === "active" && o1bNow.endDate!.getTime() - endO1 === 30 * DAY && (await prisma.proPayment.count({ where: { providerTxId: { in: [String(id2), String(id2 + 1)] }, status: "review", reason: "order_not_pending" } })) === 1, await prisma.proPayment.findMany({ where: { providerTxId: { in: [String(id2), String(id2 + 1)] } } }));

    section("Sai số tiền / mã lạ / không mã → ghi để admin duyệt tay, KHÔNG kích hoạt, KHÔNG hoàn tiền");
    const rev = (tx: number | string) => prisma.proPayment.findFirst({ where: { providerTxId: String(tx) } });
    const oS = await mkOrder(T2.id, { price: 199_000 });
    await hook({ id: 801, amount: 198_999, content: oS.memoCode });
    await hook({ id: 802, amount: 199_001, content: oS.memoCode });
    await hook({ id: 803, amount: 79_000, content: oS.memoCode });
    check("thiếu 1đ, thừa 1đ, và đúng số của gói khác → cả ba 'amount_mismatch', đơn vẫn chờ", (await Promise.all([801, 802, 803].map(rev))).every(p => p?.status === "review" && p.reason === "amount_mismatch" && p.orderId === oS.id) && (await ord(oS.id)).status === "pending");
    await hook({ id: 804, amount: 199_000, content: `CK ${oS.memoCode.replace("-", " ")} nguyen van b` });
    check("sau khi gia sư chuyển đúng số (ngân hàng đổi gạch thành cách) → kích hoạt, các khoản sai số cũ vẫn nằm ở sổ duyệt tay", (await ord(oS.id)).status === "active" && (await rev(804))?.status === "activated" && (await prisma.proPayment.count({ where: { status: "review", reason: "amount_mismatch" } })) === 3);
    await hook({ id: 811, content: "KINPRO-ZZZZZZZZ" });
    await hook({ id: 812, content: "chuyen tien hoc phi", amount: 79_000 });
    await hook({ id: 813, content: "KIN AB2C3 hoc phi", amount: 79_000 });
    check("mã lạ → unknown_code; không mã → no_code (kể cả đúng 79.000); mã phiếu học phí KIN… → no_code, không đụng phiếu học phí", (await rev(811))?.reason === "unknown_code" && (await rev(812))?.reason === "no_code" && (await rev(813))?.reason === "no_code" && (await prisma.bankTransaction.count()) === before.btx);
    const oC = await mkOrder(T2.id, { status: "cancelled" });
    await hook({ id: 821, content: oC.memoCode });
    check("đơn đã huỷ mà tiền vẫn về → duyệt tay order_not_pending, đơn vẫn huỷ", (await rev(821))?.reason === "order_not_pending" && (await ord(oC.id)).status === "cancelled");
    const oG = await mkOrder(T2.id, { price: 0, source: "legacy_grant", status: "pending", code: "GRANT-ABCDEF123456" });
    await hook({ id: 831, amount: 1000, content: "GRANT-ABCDEF123456" });
    check("mã suất tặng không khớp (không phải KINPRO-) → no_code, suất tặng không bị đụng", (await rev(831))?.reason === "no_code" && (await ord(oG.id)).status === "pending");

    section("Admin: danh sách duyệt tay, đánh dấu đã xử lý (chỉ đổi nhãn)");
    const adm = await api("GET", "/api/admin/pro", { as: A });
    const list = adm.json.payments as { id: string; reason: string; reasonText: string; amount: number }[];
    check("API admin liệt kê đúng các khoản 'review' (không có tên người), kèm lý do bằng chữ", adm.status === 200 && list.length === (await prisma.proPayment.count({ where: { status: "review" } })) && list.every(p => p.reasonText.length > 5) && !JSON.stringify(adm.json.payments).includes("Cô "), adm.json.payments?.length);
    check("trạng thái webhook hiện 'Đang bật' đúng chế độ", adm.json.webhook.enabled === true);
    const target = list[0];
    const sumBefore = (await prisma.proOrder.findMany({ select: { status: true } })).map(o => o.status).join();
    const rs = await api("POST", `/api/admin/pro/payments/${target.id}/resolve`, { as: A });
    const rs2 = await api("POST", `/api/admin/pro/payments/${target.id}/resolve`, { as: A });
    check("đánh dấu đã xử lý → 200; bấm lại → 409; không đổi trạng thái đơn nào", rs.status === 200 && rs2.status === 409 && (await prisma.proOrder.findMany({ select: { status: true } })).map(o => o.status).join() === sumBefore);
    check("quyền: chưa đăng nhập 401, gia sư 403, học sinh 403, quản trị nội dung 403; id lạ 404", (await api("POST", `/api/admin/pro/payments/${list[1].id}/resolve`)).status === 401 && (await api("POST", `/api/admin/pro/payments/${list[1].id}/resolve`, { as: T })).status === 403 && (await api("POST", `/api/admin/pro/payments/${list[1].id}/resolve`, { as: S })).status === 403 && (await api("POST", `/api/admin/pro/payments/${list[1].id}/resolve`, { as: await mkUser({ name: "ND", role: "admin", adminRole: "admin_content" }) })).status === 403 && (await api("POST", "/api/admin/pro/payments/khong-co/resolve", { as: A })).status === 404);
    check("admin bấm kích hoạt tay đơn đã tự kích hoạt → 409 (không cộng đôi)", (await api("POST", `/api/admin/pro/orders/${o0.id}/activate`, { as: A, body: {} })).status === 409 && (await ord(o0.id)).endDate!.getTime() === endBefore);
    check("API admin GET payments: gia sư 403", (await api("GET", "/api/admin/pro", { as: T })).status === 403);
    check("số cũ không đổi: webhook Pro không tạo/sửa phiếu học phí, giao dịch ngân hàng của gia sư, hay yêu cầu nạp Coin", (await prisma.tuitionInvoice.count()) === before.inv && (await prisma.bankTransaction.count()) === before.btx && (await prisma.coinTopupRequest.count()) === before.coin);
  }

  section("Nhắc gia hạn: chạy trong bài với đồng hồ giả (T-7 / T-3 / T-0)");
  const { runProRenewalReminders } = await import("@/lib/proRenewalServer");
  await prisma.notification.deleteMany({}); await prisma.proRenewalReminder.deleteMany({});
  await prisma.proOrder.deleteMany({});
  const N0 = new Date("2027-01-10T00:30:00Z"); // 07:30 giờ VN
  const R = await mkTutor("Cô Nhắc Gia Hạn"), R2 = await mkTutor("Cô Chưa Tới Hạn"), Rb = await mkTutor("Cô Bị Khoá"), Rg = await mkTutor("Cô Được Tặng");
  await prisma.user.update({ where: { id: Rb.id }, data: { banned: true } });
  await mkOrder(R.id, { status: "active", start: new Date(N0.getTime() - 23 * DAY), end: new Date(N0.getTime() + 7 * DAY + 6 * 3_600_000) });
  await mkOrder(R2.id, { status: "active", start: new Date(N0.getTime() - 5 * DAY), end: new Date(N0.getTime() + 25 * DAY) });
  await mkOrder(Rb.id, { status: "active", start: new Date(N0.getTime() - 23 * DAY), end: new Date(N0.getTime() + 7 * DAY) });
  await mkOrder(Rg.id, { status: "active", source: "legacy_grant", price: 0, start: new Date(N0.getTime() - 53 * DAY), end: new Date(N0.getTime() + 7 * DAY + 3_600_000) });
  await mkOrder(S.id, { status: "pending" });
  const notes = (uid: string) => prisma.notification.findMany({ where: { userId: uid, type: "pro_renewal" }, orderBy: { createdAt: "asc" } });
  const run = (now: Date) => runProRenewalReminders(now);
  const r1 = await run(N0);
  if (!ENABLED && MODE !== "nokey") {
    check(`chưa mở bán / bản xem trước → KHÔNG nhắc (nhắc 'hãy gia hạn' khi màn Gói ghi Chưa mở bán là đường chết), skipped=${MODE === "preview" ? "preview" : "sale-closed"}`, r1.skipped === (MODE === "preview" ? "preview" : "sale-closed") && r1.created === 0 && (await prisma.notification.count({ where: { type: "pro_renewal" } })) === 0, r1);
  } else {
    check("ngày T-7: đúng chủ gói (cô Nhắc + cô Được tặng) nhận, mỗi người 1; cô chưa tới hạn, cô bị khoá, học sinh không nhận", r1.skipped === null && r1.created === 2 && (await notes(R.id)).length === 1 && (await notes(Rg.id)).length === 1 && (await notes(R2.id)).length === 0 && (await notes(Rb.id)).length === 0 && (await notes(S.id)).length === 0, r1);
    const t7 = (await notes(R.id))[0];
    check("chữ T-7: còn 7 ngày, có ngày hết hạn giờ VN (17/01/2027), không tên, không số tiền, trỏ /lop-cua-toi/goi, chưa đọc", /còn 7 ngày/.test(t7.message) && /17\/01\/2027/.test(t7.message) && t7.link === "/lop-cua-toi/goi" && !t7.isRead && !/Cô |\d[\d.,]*\s?(đ|₫|vnd|nghìn)/i.test(t7.title + t7.message), t7);
    const r1b = await run(N0), r1c = await run(new Date(N0.getTime() + 3_600_000));
    check("PHÁ: chạy lại cùng ngày (và vài giờ sau) → không nhắc thêm, vẫn 1 thông báo mỗi người, alreadySent đếm đúng", r1b.created === 0 && r1b.alreadySent === 2 && r1c.created === 0 && (await notes(R.id)).length === 1 && (await prisma.proRenewalReminder.count()) === 2, [r1b, r1c]);
    const r6 = await run(new Date(N0.getTime() + 1 * DAY));
    check("hôm sau (còn 6 ngày, vẫn cửa sổ T-7) → không nhắc lại", r6.created === 0 && (await notes(R.id)).length === 1);
    const r3 = await run(new Date(N0.getTime() + 4 * DAY));
    check("còn 3 ngày → T-3: thêm đúng 1 thông báo mới 'còn 3 ngày'", r3.created === 2 && (await notes(R.id)).length === 2 && /còn 3 ngày/.test((await notes(R.id))[1].message));
    const r3b = await run(new Date(N0.getTime() + 5 * DAY));
    check("còn 2 ngày (vẫn cửa sổ T-3) → không nhắc lại T-3", r3b.created === 0 && (await notes(R.id)).length === 2);
    const rLate = await run(new Date(N0.getTime() + 6 * DAY + 3_600_000));
    check("còn 1 ngày (vẫn cửa sổ T-3 đã gửi) → không gửi lại, mỗi mốc một lần", rLate.created === 0 && (await notes(R.id)).length === 2);
    const r0 = await run(new Date(N0.getTime() + 7 * DAY));
    const t0 = await notes(R.id);
    check("ngày hết hạn (còn mấy tiếng) → T-0: thông báo 'hết hạn hôm nay', tổng 3 thông báo = 3 mốc", r0.created >= 1 && t0.length === 3 && /hôm nay/.test(t0[2].title) && (await prisma.proRenewalReminder.count({ where: { userId: R.id } })) === 3, t0.map(n => n.title));
    const r0b = await run(new Date(N0.getTime() + 7 * DAY + 3_600_000));
    check("T-0 chạy lại → không nhắc thêm", r0b.created === 0 && (await notes(R.id)).length === 3);
    const rAfter = await run(new Date(N0.getTime() + 8 * DAY));
    check("sau hạn (đã hết Pro) → không nhắc nữa", rAfter.created === 0 && (await notes(R.id)).length === 3);

    section("Gia hạn → chu kỳ mới → nhắc lại được; hạn xa thì không nhắc");
    await prisma.notification.deleteMany({}); // chỉ để đếm gọn
    await mkOrder(R.id, { status: "active", start: new Date(N0.getTime() + 7 * DAY + 6 * 3_600_000), end: new Date(N0.getTime() + 37 * DAY + 6 * 3_600_000) });
    const rr = await run(new Date(N0.getTime() + 6 * DAY));
    check("đã gia hạn nối tiếp (hạn thật còn 37 ngày) → hôm kỳ cũ sắp hết KHÔNG nhắc cô Nhắc", (await notes(R.id)).length === 0 && rr.candidates >= 0);
    const rn = await run(new Date(N0.getTime() + 31 * DAY));
    check("tới T-7 của chu kỳ MỚI → nhắc lại (cycleEnd mới), đúng 1 lần", (await notes(R.id)).length === 1 && /còn 6 ngày|còn 7 ngày/.test((await notes(R.id))[0].message) && rn.created >= 1 && (await prisma.proRenewalReminder.count({ where: { userId: R.id } })) === 4, await notes(R.id));
    const Rl = await mkTutor("Cô Cron Lỡ");
    await mkOrder(Rl.id, { status: "active", start: new Date(N0.getTime() + 8 * DAY), end: new Date(N0.getTime() + 38 * DAY) });
    await run(new Date(N0.getTime() + 36 * DAY)); // cron lỡ mọi ngày T-7, T-3 → lần đầu chạy là khi chỉ còn 2 ngày
    check("PHÁ: cron lỡ T-7 và ngày T-3 → gửi muộn vẫn nói đúng số ngày thật (còn 2 ngày), không bịa 'còn 3'/'còn 7', chỉ 1 thông báo", (await notes(Rl.id)).length === 1 && /còn 2 ngày/.test((await notes(Rl.id))[0].message) && !/còn (3|7) ngày/.test((await notes(Rl.id))[0].message));
  }

  section("Cron nhắc: khoá CRON_SECRET");
  const rc = (h?: Record<string, string>) => fetch(`${BASE}/api/cron/pro-renewal-reminders`, { headers: h });
  check("không khoá → 401; sai khoá → 401; kiểu khác 'Bearer' → 401", (await rc()).status === 401 && (await rc({ authorization: "Bearer sai-khoa" })).status === 401 && (await rc({ authorization: CRON })).status === 401);
  const before401 = await prisma.settingKV.findUnique({ where: { key: "cron.pro-renewal-reminders.lastCall" } });
  check("gọi sai khoá không ghi dấu 'lần gọi gần nhất'", before401 === null);
  const okc = await rc({ authorization: `Bearer ${CRON}` });
  const okj = await okc.json();
  check("đúng khoá → 200, phản hồi chỉ có số đếm (không tên, không số tiền)", okc.status === 200 && typeof okj.created === "number" && !/Cô |@/.test(JSON.stringify(okj)), okj);
  check("đúng khoá → ghi dấu lần gọi gần nhất; trang Triển khai thấy việc mới", !!(await prisma.settingKV.findUnique({ where: { key: "cron.pro-renewal-reminders.lastCall" } })) && (await api("GET", "/api/admin/trien-khai", { as: A })).json.crons.some((c: { key: string }) => c.key === "pro-renewal-reminders"));
  if (MODE === "preview") check("bản xem trước: cron trả skipped=preview, không tạo thông báo", okj.skipped === "preview" && okj.created === 0);
  if (MODE === "noconfig") check("chưa mở bán: cron trả skipped=sale-closed", okj.skipped === "sale-closed");

  await done();
})();
