// ĐX-02 (NC1-032) — thông báo đẩy với DỮ LIỆU THẬT: quyền, đăng ký / gỡ thiết bị, cô lập giữa hai gia sư, giới hạn, công tắc (kể cả hai yêu cầu đồng thời),
// nút Gửi thử, và việc gửi bằng BỘ GỬI GIẢ (không gọi ra mạng): loại nào được đẩy, giờ yên lặng, 410 → đánh dấu chết, notify() không lộ tên em / số tiền.
// Cần Postgres + Next dev (xem README). QUAN TRỌNG: cả máy chủ dev LẪN bài test đều phải thấy PUSH_ENABLED=1 và ba biến VAPID_* (xem env.example.sh);
// khoá thử sinh bằng `npx web-push generate-vapid-keys --json`, KHÔNG dùng khoá Production. Phần thuần: t-push-lib.ts.
// Tin thật tới điện thoại không test tự động được — kiểm tay theo docs/kin/tien-do-dang-do.md mục ĐX-02 (NC1-033).
import { api, mkTutor, mkUser, mkSuper, wipe, check, eventually, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import webpush from "web-push";
import { notify } from "@/lib/notify";
import { pushToUser, sendTestPush, setPushSender, type PushSender } from "@/lib/pushServer";
import { PUSH_DEFS, endpointFingerprint, pushConfig, pushPayload } from "@/lib/pushRules";
import { inQuietHours, vnMinutesOfDay } from "@/lib/classSessions";

const stamp = Date.now().toString(36);
const keys = webpush.generateVAPIDKeys();
const P256DH = keys.publicKey, AUTH = keys.privateKey.slice(0, 22);
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ep = (n: string) => `https://fcm.googleapis.com/fcm/send/test-${stamp}-${n}`;
const sub = (n: string, ua = ANDROID) => ({ subscription: { endpoint: ep(n), keys: { p256dh: P256DH, auth: AUTH } }, userAgent: ua });
const rowsOf = (u: TUser) => prisma.pushSubscription.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
const prefsOf = async (u: TUser) => (await prisma.user.findUnique({ where: { id: u.id }, select: { preferences: true } }))?.preferences as Record<string, any> | null;
const vn = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 21, hh - 7, mm));
const NIGHT = vn(23), DAY = vn(10);

interface Call { endpoint: string; payload: any; opts: { TTL: number; urgency: string; timeout: number } }
const calls: Call[] = [];
let behaviour: (endpoint: string) => void = () => {};
const fake: PushSender = async (t, payload, opts) => { calls.push({ endpoint: t.endpoint, payload: JSON.parse(payload), opts }); behaviour(t.endpoint); };
const err = (statusCode?: number) => Object.assign(new Error(statusCode ? `push ${statusCode}` : "network down"), statusCode ? { statusCode } : {});

(async () => {
  if (!pushConfig(process.env).enabled) {
    console.error("THIẾU CẤU HÌNH: bài test này cần PUSH_ENABLED=1 và VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT trong môi trường (xem tools/local-e2e/env.example.sh), và máy chủ dev phải khởi động với cùng các biến đó.");
    process.exit(2);
  }
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Hùng"), T3 = await mkTutor("Cô Mai"), T4 = await mkTutor("Cô Sen"), T5 = await mkTutor("Thầy Nam"), T6 = await mkTutor("Cô Hoa");
  const S = await mkUser({ name: "Học sinh" }), SUP = await mkSuper("Admin"), CONTENT = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });

  section("Quyền: chỉ gia sư");
  const ENDPOINTS: [string, string, unknown?][] = [["GET", "/api/push/settings"], ["PUT", "/api/push/settings", { invoice_paid: true }], ["POST", "/api/push/subscribe", sub("auth")], ["DELETE", "/api/push/subscribe", { id: "x" }], ["POST", "/api/push/test"]];
  const st = async (u: TUser | undefined) => Promise.all(ENDPOINTS.map(async ([m, p, b]) => (await api(m, p, { as: u, body: b })).status));
  check("chưa đăng nhập → 401 ở cả năm điểm vào", (await st(undefined)).every(s => s === 401), await st(undefined));
  check("học sinh / quản trị cấp 1 / quản trị nội dung → 403 ở cả năm điểm vào", (await Promise.all([S, SUP, CONTENT].map(st))).every(r => r.every(s => s === 403)), await Promise.all([S, SUP, CONTENT].map(st)));
  const first = await api("GET", "/api/push/settings", { as: T });
  check("gia sư → 200; hệ thống đang BẬT; khoá công khai khớp biến môi trường; không cache", first.status === 200 && first.json.enabled === true && first.json.publicKey === process.env.VAPID_PUBLIC_KEY && /no-store/.test(first.headers.get("cache-control") ?? ""), first.json);
  check("mặc định: báo nghỉ BẬT, tiền chưa khớp BẬT, phiếu đóng đủ TẮT; chưa có thiết bị", first.json.types.absence_late === true && first.json.types.bank_tx_pending === true && first.json.types.invoice_paid === false && first.json.devices.length === 0 && first.json.maxDevices === 10);

  section("Đăng ký thiết bị: kiểm dữ liệu");
  const post = (u: TUser, b: unknown) => api("POST", "/api/push/subscribe", { as: u, body: b });
  const badBodies: [string, unknown][] = [
    ["không có thân", undefined], ["không có subscription", {}],
    ["endpoint http", { subscription: { endpoint: "http://fcm.googleapis.com/fcm/send/x", keys: { p256dh: P256DH, auth: AUTH } } }],
    ["endpoint tên miền lạ", { subscription: { endpoint: "https://evil.example/x", keys: { p256dh: P256DH, auth: AUTH } } }],
    ["endpoint nội bộ", { subscription: { endpoint: "https://169.254.169.254/latest", keys: { p256dh: P256DH, auth: AUTH } } }],
    ["endpoint có userinfo", { subscription: { endpoint: "https://fcm.googleapis.com@evil.example/x", keys: { p256dh: P256DH, auth: AUTH } } }],
    ["khoá ngắn", { subscription: { endpoint: ep("k"), keys: { p256dh: "abc", auth: AUTH } } }], ["thiếu khoá", { subscription: { endpoint: ep("k") } }],
  ];
  const results = await Promise.all(badBodies.map(async ([, b]) => (await post(T, b)).status));
  check("mọi dạng sai (http, tên miền lạ, địa chỉ nội bộ, userinfo, khoá ngắn / thiếu) → 400", results.every(s => s === 400), results.map((s, i) => `${badBodies[i][0]}=${s}`));
  check("sau các lần sai không có dòng nào được tạo", (await prisma.pushSubscription.count()) === 0);

  section("Đăng ký / đăng ký lại / đổi tài khoản");
  const r1 = await post(T, sub("a"));
  const row1 = (await rowsOf(T))[0];
  check("đăng ký đúng → 201, DB có đúng một dòng với khoá và userAgent đã làm sạch", r1.status === 201 && r1.json.ok === true && (await rowsOf(T)).length === 1 && row1.endpoint === ep("a") && row1.p256dh === P256DH && row1.auth === AUTH && /Android/.test(row1.userAgent ?? "") && row1.revokedAt === null, r1.json);
  await new Promise(r => setTimeout(r, 30));
  const r1b = await post(T, sub("a", IPHONE));
  const row1b = (await rowsOf(T))[0];
  check("đăng ký lại ĐÚNG thiết bị đó → không nhân đôi; cập nhật userAgent, lastSeenAt mới hơn, createdAt giữ nguyên", r1b.status === 201 && (await rowsOf(T)).length === 1 && /iPhone/.test(row1b.userAgent ?? "") && row1b.lastSeenAt > row1.lastSeenAt && +row1b.createdAt === +row1.createdAt);
  await prisma.pushSubscription.update({ where: { id: row1.id }, data: { revokedAt: new Date() } });
  await post(T, sub("a"));
  check("thiết bị từng bị đánh dấu chết mà đăng ký lại → sống lại (revokedAt = null)", (await rowsOf(T))[0].revokedAt === null);
  const rMove = await post(T2, sub("a"));
  check("MỘT thiết bị đăng nhập sang gia sư khác: dòng chuyển sang người mới, người cũ không còn nhận (không thuộc hai tài khoản cùng lúc)", rMove.status === 201 && (await rowsOf(T)).length === 0 && (await rowsOf(T2)).length === 1);
  await post(T, sub("a"));          // thiết bị về lại gia sư T (userAgent Android)
  await post(T2, sub("t2"));         // T2 có thiết bị riêng cho các ca cô lập bên dưới

  section("Giới hạn thiết bị");
  for (let i = 1; i <= 10; i++) await post(T3, sub(`cap${i}`));
  const over = await post(T3, sub("cap11"));
  check("đủ 10 thiết bị → thiết bị thứ 11 bị từ chối 409 (và không tạo dòng)", over.status === 409 && (await rowsOf(T3)).length === 10, over.json);
  check("đăng ký lại một thiết bị ĐÃ CÓ khi đang đủ 10 → vẫn được (không tính thêm)", (await post(T3, sub("cap1"))).status === 201 && (await rowsOf(T3)).length === 10);
  check("thiết bị đã bị đánh dấu chết không tính vào giới hạn", await (async () => { const one = (await rowsOf(T3))[9]; await prisma.pushSubscription.update({ where: { id: one.id }, data: { revokedAt: new Date() } }); return (await post(T3, sub("cap11"))).status === 201; })());

  section("Cài đặt: danh sách thiết bị, 'máy này', không lộ endpoint / khoá");
  await post(T, sub("b", IPHONE));
  const fpA = await endpointFingerprint(ep("a")), fpB = await endpointFingerprint(ep("b"));
  const g = await api("GET", `/api/push/settings?e=${fpB}`, { as: T });
  const devs = g.json.devices as { id: string; label: string; mine: boolean }[];
  check("hai thiết bị; tên 'Chrome · Android' / 'Safari · iPhone'; chỉ máy có dấu vân tay khớp là 'mine'", devs.length === 2 && devs.find(d => d.label === "Safari · iPhone")?.mine === true && devs.find(d => d.label === "Chrome · Android")?.mine === false, devs);
  const mineNow = (await api("GET", `/api/push/settings?e=${fpA}`, { as: T })).json.devices.filter((d: any) => d.mine).length;
  check("dấu vân tay máy A → đúng 1 máy 'mine'; dấu vân tay lạ / sai dạng → không máy nào", mineNow === 1 && (await api("GET", `/api/push/settings?e=${"0".repeat(64)}`, { as: T })).json.devices.every((d: any) => !d.mine) && (await api("GET", "/api/push/settings?e=abc", { as: T })).json.devices.every((d: any) => !d.mine));
  const rawText = g.text;
  check("phản hồi KHÔNG chứa endpoint, khoá p256dh, auth của bất kỳ thiết bị nào", !rawText.includes(ep("a")) && !rawText.includes(ep("b")) && !rawText.includes(P256DH) && !rawText.includes(AUTH) && !/endpoint|p256dh|"auth"/.test(rawText), Object.keys(g.json.devices[0]));
  check("thiết bị đã chết không hiện; gia sư khác không thấy thiết bị của mình", await (async () => { const a = (await rowsOf(T)).find(r => r.endpoint === ep("a"))!; await prisma.pushSubscription.update({ where: { id: a.id }, data: { revokedAt: new Date() } }); const d = (await api("GET", "/api/push/settings", { as: T })).json.devices; const other = (await api("GET", "/api/push/settings", { as: T5 })).json.devices; await prisma.pushSubscription.update({ where: { id: a.id }, data: { revokedAt: null } }); return d.length === 1 && other.length === 0; })());

  section("Công tắc từng loại");
  const put = (u: TUser, b: unknown) => api("PUT", "/api/push/settings", { as: u, body: b });
  const p1 = await put(T, { invoice_paid: true });
  check("bật phiếu đóng đủ → 200, trả về ba công tắc; DB lưu preferences.push.types", p1.status === 200 && p1.json.types.invoice_paid === true && p1.json.types.absence_late === true && (await prefsOf(T))?.push?.types?.invoice_paid === true, p1.json);
  const before = JSON.stringify((await prefsOf(T))?.push);
  const badPuts = await Promise.all([{ evil: true }, { absence_late: "false" }, { absence_late: 1 }, {}, [], "x", null, { absence_late: false, enrollment: true }].map(async b => (await put(T, b)).status));
  check("tên lạ / không phải đúng-sai / rỗng / mảng / chuỗi → 400, KHÔNG ghi dở (kể cả ca có một công tắc đúng đi cùng)", badPuts.every(s => s === 400) && JSON.stringify((await prefsOf(T))?.push) === before, badPuts);
  check("tắt báo nghỉ → các công tắc khác giữ nguyên", (await put(T, { absence_late: false })).json.types.invoice_paid === true && (await prefsOf(T))?.push?.types?.absence_late === false);
  await put(T, { absence_late: true });
  check("đổi chế độ sáng/tối ở API giao diện KHÔNG làm mất công tắc đẩy", (await api("PUT", "/api/users/me/preferences", { as: T, body: { mode: "toi" } })).status === 200 && (await prefsOf(T))?.push?.types?.invoice_paid === true && (await prefsOf(T))?.mode === "toi");
  check("API giao diện KHÔNG ghi được khoá 'push' (400) và giá trị cũ còn nguyên", (await api("PUT", "/api/users/me/preferences", { as: T, body: { push: { types: { invoice_paid: false } } } })).status === 400 && (await prefsOf(T))?.push?.types?.invoice_paid === true);
  check("lưu hồ sơ gia sư (đổi giới thiệu) không làm mất công tắc đẩy", (await api("PUT", "/api/users/me/tutor-profile", { as: T, body: { bio: "Giới thiệu mới" } })).status === 200 && (await prefsOf(T))?.push?.types?.invoice_paid === true);
  let lost = 0;
  for (let i = 0; i < 8; i++) {
    const wantMode = i % 2 ? "toi" : "sang", wantPaid = i % 2 === 0;
    await Promise.all([put(T, { invoice_paid: wantPaid }), api("PUT", "/api/users/me/preferences", { as: T, body: { mode: wantMode } })]);
    const p = await prefsOf(T);
    if (p?.push?.types?.invoice_paid !== wantPaid || p?.mode !== wantMode) lost++;
  }
  check("hai yêu cầu ĐỒNG THỜI (đổi công tắc đẩy + đổi sáng/tối) × 8 lần: không lần nào ghi đè mất phần của bên kia", lost === 0, lost);

  section("Gỡ thiết bị");
  const del = (u: TUser, b: unknown) => api("DELETE", "/api/push/subscribe", { as: u, body: b });
  check("không có id / endpoint → 400", (await del(T, {})).status === 400 && (await del(T, undefined)).status === 400);
  const idOfT2 = (await rowsOf(T2))[0].id;
  const steal = await del(T, { id: idOfT2 });
  check("gỡ thiết bị CỦA NGƯỜI KHÁC bằng id → ok nhưng removed = 0, dòng vẫn còn (cô lập)", steal.status === 200 && steal.json.removed === 0 && (await rowsOf(T2)).length === 1, steal.json);
  check("gỡ bằng endpoint của người khác → removed = 0", (await del(T, { endpoint: (await rowsOf(T2))[0].endpoint })).json.removed === 0 && (await rowsOf(T2)).length === 1);
  const mine = (await rowsOf(T)).find(r => r.endpoint === ep("b"))!;
  const dOwn = await del(T, { id: mine.id });
  check("gỡ thiết bị của mình bằng id → removed = 1, dòng bị XOÁ hẳn", dOwn.json.removed === 1 && (await prisma.pushSubscription.findUnique({ where: { id: mine.id } })) === null);
  check("gỡ bằng endpoint → removed = 1; gỡ lần nữa → removed = 0 (idempotent, không lỗi)", (await del(T, { endpoint: ep("a") })).json.removed === 1 && (await del(T, { endpoint: ep("a") })).json.removed === 0 && (await rowsOf(T)).length === 0);
  check("xoá người dùng thì xoá thiết bị của họ (ON DELETE CASCADE)", await (async () => { const tmp = await mkTutor("Tạm"); await post(tmp, sub("tmp")); const had = (await rowsOf(tmp)).length; await prisma.user.delete({ where: { id: tmp.id } }); return had === 1 && (await prisma.pushSubscription.count({ where: { endpoint: ep("tmp") } })) === 0; })());

  section("Nút Gửi thử (API)");
  check("chưa có thiết bị → 409 và KHÔNG tính vào giới hạn 30 giây", (await api("POST", "/api/push/test", { as: T })).status === 409 && (await prisma.auditLog.count({ where: { actorId: T.id, action: "push.test" } })) === 0);
  await post(T, sub("t1"));
  await prisma.auditLog.create({ data: { actorId: T.id, action: "push.test", resourceType: "User", resourceId: T.id } });
  const cool = await api("POST", "/api/push/test", { as: T });
  check("vừa gửi thử trong 30 giây → 429, không gửi thêm", cool.status === 429, cool.json);
  const other = await api("POST", "/api/push/test", { as: T5 });
  check("giới hạn tính RIÊNG từng gia sư: T5 (chưa có thiết bị) nhận 409 chứ không phải 429 dù T đang bị giới hạn", other.status === 409, other.json);

  section("Gửi bằng BỘ GỬI GIẢ: loại nào, lúc nào");
  setPushSender(fake);
  await prisma.pushSubscription.deleteMany({ where: { userId: T4.id } });
  await post(T4, sub("s1")); await post(T4, sub("s2", IPHONE));
  await post(T6, sub("s6"));
  const reset = () => { calls.length = 0; behaviour = () => {}; };
  const toT4 = (c: Call) => c.endpoint === ep("s1") || c.endpoint === ep("s2");

  reset();
  const o1 = await pushToUser(T4.id, "absence_late", { leadMinutes: 30, now: NIGHT });
  check("báo nghỉ còn 30 phút, 23:00 → ĐẨY cả giữa đêm tới cả hai thiết bị; chữ đúng chữ của loại; xin chuyển GẤP; giữ ≤ 2 giờ",
    o1.sent === 2 && o1.skipped === null && calls.length === 2 && calls.every(c => JSON.stringify(c.payload) === JSON.stringify(pushPayload("absence_late")) && c.opts.urgency === "high" && c.opts.TTL === PUSH_DEFS.absence_late.ttl && c.opts.timeout > 0), { o1, calls });
  reset();
  const o2 = await pushToUser(T4.id, "bank_tx_pending", { now: NIGHT });
  check("tiền chưa khớp, 23:00 → KHÔNG đẩy ('quiet-hours'), bộ gửi không bị gọi", o2.skipped === "quiet-hours" && calls.length === 0 && o2.sent === 0);
  const o2b = await pushToUser(T4.id, "absence_late", { now: NIGHT });
  check("báo nghỉ nhưng KHÔNG nói còn bao nhiêu phút, 23:00 → coi như không khẩn, KHÔNG đẩy", o2b.skipped === "quiet-hours" && calls.length === 0);
  const o3 = await pushToUser(T4.id, "bank_tx_pending", { now: DAY });
  check("tiền chưa khớp, 10:00 → đẩy, tin thường (urgency normal)", o3.sent === 2 && calls.every(c => c.opts.urgency === "normal" && JSON.stringify(c.payload) === JSON.stringify(pushPayload("bank_tx_pending"))));
  reset();
  const o4 = await pushToUser(T4.id, "invoice_paid", { now: DAY });
  check("phiếu đóng đủ mặc định TẮT → không đẩy ('type-off')", o4.skipped === "type-off" && calls.length === 0);
  await put(T4, { invoice_paid: true });
  const o5 = await pushToUser(T4.id, "invoice_paid", { now: DAY });
  check("bật rồi → đẩy với chữ của loại đó", o5.sent === 2 && calls.length === 2 && calls.every(c => c.payload.title === PUSH_DEFS.invoice_paid.title));
  reset();
  await put(T4, { absence_late: false });
  const o6 = await pushToUser(T4.id, "absence_late", { leadMinutes: 10, now: NIGHT });
  check("gia sư TẮT báo nghỉ → không đẩy dù khẩn", o6.skipped === "type-off" && calls.length === 0);
  await put(T4, { absence_late: true });
  for (const t of ["enrollment", "thread_reply", "exam_new", "", "ABSENCE_LATE"]) {
    const o = await pushToUser(T4.id, t, { now: DAY });
    if (o.skipped !== "type-not-allowed") check(`loại '${t}' phải bị chặn`, false, o);
  }
  check("loại ngoài danh sách (enrollment, thread_reply, exam_new, rỗng, sai hoa thường) → không bao giờ đẩy", calls.length === 0);
  const o7 = await pushToUser(T4.id, "bank_tx_pending", { now: DAY, env: {} });
  const o8 = await pushToUser(T4.id, "bank_tx_pending", { now: DAY, env: { ...process.env, VERCEL_ENV: "preview" } });
  check("PUSH_ENABLED vắng / bản xem trước Vercel → không đẩy ('disabled'), bộ gửi không bị gọi", o7.skipped === "disabled" && o8.skipped === "disabled" && calls.length === 0);
  const o9 = await pushToUser(S.id, "absence_late", { leadMinutes: 5, now: DAY });
  check("người không có thiết bị nào (học sinh) → 'no-devices', không lỗi", o9.skipped === "no-devices" && calls.length === 0);

  reset();
  await pushToUser(T6.id, "bank_tx_pending", { now: DAY });
  check("tin của gia sư này KHÔNG bao giờ tới thiết bị của gia sư khác", calls.length === 1 && calls[0].endpoint === ep("s6") && !calls.some(toT4));

  section("Thiết bị chết (404/410) và lỗi tạm thời");
  reset();
  behaviour = e => { if (e === ep("s1")) throw err(410); };
  const d1 = await pushToUser(T4.id, "bank_tx_pending", { now: DAY });
  const s1 = (await rowsOf(T4)).find(r => r.endpoint === ep("s1"))!, s2 = (await rowsOf(T4)).find(r => r.endpoint === ep("s2"))!;
  check("một thiết bị trả 410 → bị đánh dấu revokedAt; thiết bị kia vẫn nhận (sent 1, revoked 1)", d1.sent === 1 && d1.revoked === 1 && s1.revokedAt !== null && s2.revokedAt === null, d1);
  check("thiết bị đã chết không còn hiện ở Cài đặt và lần đẩy sau KHÔNG gửi tới nữa", (await api("GET", "/api/push/settings", { as: T4 })).json.devices.length === 1 && await (async () => { reset(); await pushToUser(T4.id, "bank_tx_pending", { now: DAY }); return calls.length === 1 && calls[0].endpoint === ep("s2"); })());
  reset();
  behaviour = () => { throw err(404); };
  const d2 = await pushToUser(T4.id, "bank_tx_pending", { now: DAY });
  check("404 cũng coi là đã chết", d2.revoked === 1 && (await rowsOf(T4)).every(r => r.revokedAt !== null));
  const d3 = await pushToUser(T4.id, "bank_tx_pending", { now: DAY });
  check("hết thiết bị sống → 'no-devices'", d3.skipped === "no-devices");
  reset();
  behaviour = () => { throw err(500); };
  const d4 = await pushToUser(T6.id, "bank_tx_pending", { now: DAY });
  check("lỗi 500 của dịch vụ đẩy → tính là thất bại, KHÔNG đánh dấu chết (lỗi tạm thời)", d4.failed === 1 && d4.revoked === 0 && d4.sent === 0 && (await rowsOf(T6))[0].revokedAt === null);
  behaviour = () => { throw err(); };
  const d5 = await pushToUser(T6.id, "bank_tx_pending", { now: DAY });
  check("mất mạng (lỗi không có mã) → thất bại, thiết bị còn nguyên, hàm KHÔNG ném lỗi", d5.failed === 1 && d5.revoked === 0 && (await rowsOf(T6))[0].revokedAt === null);
  reset();
  const lastBefore = (await rowsOf(T6))[0].lastSeenAt;
  await new Promise(r => setTimeout(r, 30));
  await pushToUser(T6.id, "bank_tx_pending", { now: DAY });
  check("gửi được → lastSeenAt của thiết bị được cập nhật", (await rowsOf(T6))[0].lastSeenAt > lastBefore);

  section("Gửi thử (bộ gửi giả)");
  reset();
  await post(T4, sub("s3"));
  await put(T4, { absence_late: false, bank_tx_pending: false, invoice_paid: false });
  const x1 = await sendTestPush(T4.id);
  check("gửi thử KHÔNG xét công tắc loại tin hay giờ yên lặng; chữ là tin thử; tới đúng thiết bị của người bấm", x1.sent === 1 && calls.length === 1 && calls[0].payload.title === "Thông báo thử từ KiN" && calls[0].endpoint === ep("s3"), { x1, calls });
  check("gửi thử khi không có thiết bị → 'no-devices'; khi hệ thống tắt → 'disabled'", (await sendTestPush(S.id)).skipped === "no-devices" && (await sendTestPush(T4.id, { env: {} })).skipped === "disabled");

  section("notify() → đẩy, không lộ tên em / số tiền");
  reset();
  const MSG = "1.500.000đ từ Nguyễn Văn An — Toán 9 tháng 10. Mở hàng chờ để xử lý.";
  await prisma.pushSubscription.deleteMany({ where: { userId: T6.id } });
  await post(T6, sub("n1"));
  await put(T6, { absence_late: true, bank_tx_pending: true, invoice_paid: true });
  await notify(T6.id, { type: "absence_late", title: "Báo nghỉ sát giờ", message: "Nguyễn Văn An xin nghỉ buổi Toán 9 lúc 19:00 (báo trước 30 phút). Bấm một nút để xử lý.", link: "/lop-cua-toi/lich" }, { leadMinutes: 30 });
  await eventually("báo nghỉ khẩn → đẩy 1 tin tới thiết bị, bất kể giờ", () => calls.length === 1);
  const sent = calls[0];
  check("chữ đẩy là chữ của LOẠI; KHÔNG có tên học sinh, số tiền hay nội dung của thông báo trong ứng dụng", JSON.stringify(sent.payload) === JSON.stringify(pushPayload("absence_late")) && !JSON.stringify(sent.payload).includes("Nguyễn") && !JSON.stringify(sent.payload).includes("Toán"), sent.payload);
  const inApp = await prisma.notification.findFirst({ where: { userId: T6.id, type: "absence_late" } });
  check("thông báo trong ứng dụng vẫn tạo ĐỦ nội dung như trước (message có tên em)", !!inApp && inApp.message.includes("Nguyễn Văn An") && inApp.link === "/lop-cua-toi/lich");
  reset();
  await notify(T6.id, { type: "bank_tx_pending", title: "Có khoản tiền cần đối soát", message: MSG, link: "/lop-cua-toi/hoc-phi?tab=doi-soat" });
  const quietNow = inQuietHours(vnMinutesOfDay(new Date()));
  await new Promise(r => setTimeout(r, 500));
  check(`tiền chưa khớp qua notify(): ${quietNow ? "đang giờ yên lặng → KHÔNG đẩy" : "ngoài giờ yên lặng → đẩy 1 tin"}; tin không chứa tên / số tiền`, calls.length === (quietNow ? 0 : 1) && calls.every(c => !JSON.stringify(c.payload).includes("1.500.000") && !JSON.stringify(c.payload).includes("Nguyễn")), calls);
  reset();
  await notify(T6.id, { type: "thread_reply", title: "Có trả lời mới", message: "Nguyễn Văn An đã trả lời bài của bạn", link: "/cong-dong" });
  await notify(T6.id, { type: "enrollment", title: "Học viên mới", message: "Một học viên vừa vào lớp", link: "/lop-cua-toi" });
  await new Promise(r => setTimeout(r, 500));
  check("thông báo loại khác (thread_reply, enrollment) → tạo thông báo trong ứng dụng nhưng KHÔNG đẩy", calls.length === 0 && (await prisma.notification.count({ where: { userId: T6.id, type: { in: ["thread_reply", "enrollment"] } } })) === 2);
  behaviour = () => { throw err(500); };
  let threw = false;
  try { await notify(T6.id, { type: "absence_late", title: "x", message: "y", link: "/" }, { leadMinutes: 5 }); } catch { threw = true; }
  await new Promise(r => setTimeout(r, 300));
  check("bộ gửi hỏng → notify() KHÔNG ném lỗi và thông báo trong ứng dụng vẫn được tạo", !threw && (await prisma.notification.count({ where: { userId: T6.id, type: "absence_late" } })) === 2);
  reset();
  await notify(S.id, { type: "absence_late", title: "x", message: "y", link: "/" }, { leadMinutes: 5 });
  await new Promise(r => setTimeout(r, 300));
  check("người không có thiết bị (học sinh) nhận thông báo loại này → không đẩy, không lỗi", calls.length === 0);

  section("NC2-010: phụ huynh bấm 'Tôi đã chuyển' → báo gia sư chủ phiếu (3 route, chống dội 24 giờ, cô lập, đẩy)");
  const PA = await mkTutor("Cô Phương"), PB = await mkTutor("Thầy Quân"), PC = await mkTutor("Cô Cúc"), PD = await mkTutor("Thầy Đạt");
  const sA = await mkUser({ name: "Em Nguyễn Văn Khoa" }), sB = await mkUser({ name: "Em Lê Thị Mai" }), sC = await mkUser({ name: "Em Trần Bảo" }), sP = await mkUser({ name: "Em Phạm Hùng" }), sQ = await mkUser({ name: "Em Vũ Quang" });
  const parentU = await mkUser({ name: "Phụ huynh Khoa" });
  const portal = (await import("@/lib/parentPortal")).generatePortalToken();
  await prisma.parentLink.create({ data: { parentId: parentU.id, studentId: sB.id, status: "verified", verifiedAt: new Date(), portalToken: portal } });
  const { generateInvoiceCode } = await import("@/lib/tuitionInvoice");
  let ymSeq = 0;
  const mkInv = async (tutor: TUser, stu: TUser, o: { status?: string; viewToken?: string } = {}) => prisma.tuitionInvoice.create({ data: {
    code: generateInvoiceCode(), tutorId: tutor.id, studentId: stu.id, yearMonth: `2027-${String(++ymSeq).padStart(2, "0")}`, amountDue: 1_234_000, status: o.status ?? "sent",
    viewToken: o.viewToken ?? null, viewTokenExpiresAt: o.viewToken ? new Date(Date.now() + 30 * 86400_000) : null,
  } });
  const viewTok = (await import("node:crypto")).randomBytes(16).toString("hex"); // ngẫu nhiên mỗi lần chạy: bộ giới hạn tốc độ của máy chủ nhớ theo token
  const i1 = await mkInv(PA, sA, { viewToken: viewTok }), i2 = await mkInv(PA, sB), i3 = await mkInv(PA, sC), i4 = await mkInv(PB, sP);
  const rep = (as: TUser | null, path: string) => api("POST", path, as ? { as } : {});
  const pr = (t: TUser, extra: Record<string, unknown> = {}) => prisma.notification.findMany({ where: { userId: t.id, type: "parent_reported", ...extra } });
  const rPhieu = `/api/phieu/${viewTok}/reported`, rPortal = (code: string) => `/api/parent-portal/${portal}/invoices/${code}/reported`, rMe = (code: string) => `/api/users/me/invoices/${code}/reported`;

  const a1 = [await rep(null, rPhieu), await rep(null, rPhieu), await rep(null, rPhieu)];
  check("route /api/phieu: bấm 3 lần → 200 cả ba (lần 2, 3 'alreadyReported'); phiếu sang parent_reported", a1.every(r => r.status === 200) && a1[0].json.alreadyReported === false && a1[1].json.alreadyReported === true && (await prisma.tuitionInvoice.findUnique({ where: { id: i1.id } }))?.status === "parent_reported", a1.map(r => r.json));
  const a2 = [await rep(null, rPortal(i2.code)), await rep(null, rPortal(i2.code)), await rep(null, rPortal(i2.code))];
  check("route parent-portal: bấm 3 lần → 200 cả ba", a2.every(r => r.status === 200), a2.map(r => r.json));
  const a3 = [await rep(sC, rMe(i3.code)), await rep(sC, rMe(i3.code)), await rep(sC, rMe(i3.code))];
  check("route users/me: bấm 3 lần → 200 cả ba", a3.every(r => r.status === 200), a3.map(r => r.json));
  const nA = await pr(PA);
  check("gia sư chủ phiếu có ĐÚNG 3 thông báo (mỗi phiếu đúng 1, qua từng route 3 lần bấm)", nA.length === 3 && new Set(nA.map(n => n.link)).size === 3, nA.map(n => n.link));
  check("đích → /lop-cua-toi/hoc-phi (kèm khoá phiếu ở tham số `phieu`), chưa đọc", nA.every(n => /^\/lop-cua-toi\/hoc-phi\?phieu=[a-z0-9]+$/.test(n.link ?? "") && n.isRead === false) && nA.some(n => n.link === `/lop-cua-toi/hoc-phi?phieu=${i1.id}`));
  const blob = JSON.stringify(nA.map(n => [n.title, n.message]));
  check("chữ thông báo dựng từ LOẠI: không tên em / phụ huynh, không số tiền, không mã phiếu, không chữ số nào", !/Khoa|Mai|Bảo|Phạm/.test(blob) && !/\d/.test(blob) && !blob.includes(i1.code) && !/1\.234|1234/.test(blob), blob);
  check("gia sư KHÁC (PB, PC) không nhận thông báo nào của phiếu PA", (await pr(PB)).length === 0 && (await pr(PC)).length === 0);
  const rB = await rep(sP, rMe(i4.code));
  check("phiếu của PB do em của PB báo → chỉ PB nhận (1), PA vẫn 3", rB.status === 200 && (await pr(PB)).length === 1 && (await pr(PA)).length === 3);

  // Chống dội theo phiếu: đưa phiếu về 'sent' (như gia sư huỷ báo) rồi báo lại trong 24 giờ → ghi nhận lại nhưng không thêm thông báo.
  await prisma.tuitionInvoice.update({ where: { id: i1.id }, data: { status: "sent" } });
  const again = await rep(null, rPhieu);
  check("báo lại cùng phiếu trong 24 giờ (sau khi về 'sent') → ghi nhận lại bình thường nhưng KHÔNG thêm thông báo", again.status === 200 && again.json.alreadyReported === false && (await pr(PA, { link: `/lop-cua-toi/hoc-phi?phieu=${i1.id}` })).length === 1);
  await prisma.notification.updateMany({ where: { userId: PA.id, link: `/lop-cua-toi/hoc-phi?phieu=${i1.id}` }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
  await prisma.tuitionInvoice.update({ where: { id: i1.id }, data: { status: "sent" } });
  await rep(null, rPhieu);
  check("sau 24 giờ (thông báo cũ đã 25 giờ) → báo lại thì có thông báo MỚI (2 cho phiếu này)", (await pr(PA, { link: `/lop-cua-toi/hoc-phi?phieu=${i1.id}` })).length === 2);

  // Báo không thành công thì KHÔNG báo gia sư
  const nBefore = (await pr(PA)).length;
  const bad1 = await rep(null, `/api/phieu/${"b".repeat(32)}/reported`), bad2 = await rep(null, rPortal("KIN00000"));
  const paid = await mkInv(PA, sQ); await prisma.tuitionInvoice.update({ where: { id: paid.id }, data: { status: "paid" } });
  const bad3 = await rep(sQ, rMe(paid.code)), bad4 = await rep(sA, rMe(i2.code));
  check("token rác (404), mã sai (404), phiếu đã đóng đủ (409), phiếu của em khác (404) → KHÔNG tạo thông báo nào", [bad1.status, bad2.status, bad3.status, bad4.status].join() === "404,404,409,404" && (await pr(PA)).length === nBefore, [bad1.status, bad2.status, bad3.status, bad4.status]);
  check("tiền KHÔNG đổi: số đã thu của mọi phiếu vẫn 0 (chỉ báo tin)", (await prisma.tuitionInvoice.findMany({ where: { tutorId: { in: [PA.id, PB.id] } } })).every(i => i.paidAmount === 0));

  // Đẩy: mặc định TẮT; bật thì đẩy với chữ cố định không số / tên (gọi thẳng markParentReported để bộ gửi giả trong tiến trình này bắt được)
  reset();
  const { markParentReported } = await import("@/lib/invoiceServer");
  await post(PC, sub("pc")); await post(PD, sub("pd"));
  const iC = await mkInv(PC, sA), iD = await mkInv(PD, sB);
  await markParentReported(sA.id, iC.code);
  await new Promise(r => setTimeout(r, 500));
  check("công tắc parent_reported mặc định TẮT → có thông báo trong ứng dụng nhưng KHÔNG đẩy", (await pr(PC)).length === 1 && calls.length === 0, calls);
  await put(PD, { parent_reported: true });
  await markParentReported(sB.id, iD.code);
  const quietNow2 = inQuietHours(vnMinutesOfDay(new Date()));
  await new Promise(r => setTimeout(r, 600));
  check(`bật công tắc: ${quietNow2 ? "đang giờ yên lặng thật → không đẩy" : "ngoài giờ yên lặng → đẩy đúng 1 tin tới máy của PD"}`, calls.length === (quietNow2 ? 0 : 1) && calls.every(c => c.endpoint === ep("pd")), calls);
  if (!quietNow2) check("chữ đẩy = chữ của loại ('Có phụ huynh báo đã chuyển khoản, cần đối soát'), không chữ số, không tên; url /lop-cua-toi/hoc-phi", JSON.stringify(calls[0].payload) === JSON.stringify(pushPayload("parent_reported")) && !/\d|Lê Thị Mai/.test(JSON.stringify(calls[0].payload)) && calls[0].payload.url === "/lop-cua-toi/hoc-phi", calls[0]);
  reset();
  const dpd = await pushToUser(PD.id, "parent_reported", { now: DAY });
  const npd = await pushToUser(PD.id, "parent_reported", { now: NIGHT });
  check("ban ngày đẩy; 23:00 giờ VN (giờ yên lặng) thì không", dpd.sent === 1 && npd.skipped === "quiet-hours");

  setPushSender(null);
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
