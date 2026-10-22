// ĐX-02 (NC1-032) — thông báo đẩy cho gia sư: quy tắc THUẦN (src/lib/pushRules.ts, src/lib/pushClient.ts), service worker chạy trong hộp cát,
// manifest + biểu tượng, và quét tĩnh (chữ đẩy không có tên em / số tiền, chỉ gia sư, chỉ gửi khi được phép). Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-push-lib.ts
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import vm from "node:vm";
import webpush from "web-push";
import {
  MAX_PUSH_DEVICES, PUSH_DEFS, PUSH_HOST_SUFFIXES, PUSH_TEST_TEXT, PUSH_TYPES, decidePush, deviceLabel, endpointFingerprint, isAllowedPushEndpoint, isFingerprint,
  isPushType, parsePushTypesPatch, parseSubscription, pushConfig, pushPayload, readPushPrefs, resolvePushTypes, serializePayload, type PushTypes,
} from "@/lib/pushRules";
import { isIosDevice, pushUiState, serverOffText, urlBase64ToUint8Array, type PushUiInput } from "@/lib/pushClient";
import { applyPreferencesPatch, readPreferences } from "@/lib/userPreferences";
import manifest from "@/app/manifest";
import { check, section, done } from "./h";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** `a` xuất hiện TRƯỚC `b` trong `text` (cả hai phải có; thiếu một trong hai thì sai, không được "đúng suông"). */
const before = (text: string, a: string, b: string) => { const i = text.indexOf(a), j = text.indexOf(b); return i >= 0 && j >= 0 && i < j; };
const keys = webpush.generateVAPIDKeys();
const P256DH = keys.publicKey, AUTH = keys.privateKey.slice(0, 22);
/** Một thời điểm theo GIỜ VIỆT NAM (UTC+7). */
const vn = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 21, hh - 7, mm));
const ALL_ON: PushTypes = { absence_late: true, bank_tx_pending: true, invoice_paid: true };

(async () => {
  section("Loại tin và mặc định");
  check("đúng ba loại: absence_late, bank_tx_pending, invoice_paid", eq(PUSH_TYPES, ["absence_late", "bank_tx_pending", "invoice_paid"]) && PUSH_TYPES.every(isPushType));
  check("loại lạ / không phải chuỗi không được nhận", !isPushType("enrollment") && !isPushType("thread_reply") && !isPushType("") && !isPushType(null) && !isPushType(5) && !isPushType("ABSENCE_LATE"));
  check("mặc định: báo nghỉ sát giờ BẬT, tiền chưa khớp BẬT, phiếu đóng đủ TẮT (Thọ chốt 21/10)", eq(resolvePushTypes(undefined), { absence_late: true, bank_tx_pending: true, invoice_paid: false }));
  check("đọc khoan dung: rác / mảng / công tắc sai kiểu → dùng mặc định từng cái", eq(resolvePushTypes("x"), resolvePushTypes(undefined)) && eq(resolvePushTypes([true]), resolvePushTypes(undefined))
    && eq(resolvePushTypes({ absence_late: "false", bank_tx_pending: 0, invoice_paid: null }), resolvePushTypes(undefined)));
  check("giá trị đã lưu thắng mặc định (cả hai chiều)", eq(resolvePushTypes({ absence_late: false, invoice_paid: true }), { absence_late: false, bank_tx_pending: true, invoice_paid: true }));
  check("readPushPrefs chỉ giữ công tắc đúng tên và đúng kiểu; không còn gì thì null", eq(readPushPrefs({ types: { absence_late: false, evil: true, bank_tx_pending: "x" } }), { types: { absence_late: false } })
    && readPushPrefs({ types: {} }) === null && readPushPrefs(null) === null && readPushPrefs({ types: [true] }) === null && readPushPrefs("x") === null);
  check("readPreferences GIỮ preferences.push (đổi giao diện không làm mất công tắc); khoá lạ bị bỏ", eq(readPreferences({ theme: "navy", push: { types: { invoice_paid: true }, junk: 1 } }).push, { types: { invoice_paid: true } })
    && readPreferences({ push: { types: { x: true } } }).push === undefined);
  check("API giao diện (applyPreferencesPatch) TỪ CHỐI khoá 'push' và không làm mất giá trị đang có", (() => {
    const cur = readPreferences({ push: { types: { invoice_paid: true } } });
    const r = applyPreferencesPatch(cur, { push: { types: { invoice_paid: false } } });
    const ok = applyPreferencesPatch(cur, { theme: "navy" });
    return !r.ok && ok.ok && eq(ok.value.push, { types: { invoice_paid: true } });
  })());

  section("Bản vá công tắc (ghi thì nghiêm)");
  check("một công tắc đúng-sai → nhận", eq(parsePushTypesPatch({ invoice_paid: true }), { ok: true, value: { invoice_paid: true } }));
  check("ba công tắc cùng lúc → nhận", (() => { const r = parsePushTypesPatch({ absence_late: false, bank_tx_pending: false, invoice_paid: true }); return r.ok && Object.keys(r.value).length === 3; })());
  check("{} / mảng / null / chuỗi / số → từ chối", [{}, [], null, "x", 5, undefined].every(v => !parsePushTypesPatch(v).ok));
  check("tên loại lạ → từ chối cả bản vá (không ghi dở)", !parsePushTypesPatch({ absence_late: true, enrollment: true }).ok && !parsePushTypesPatch({ ["__proto__"]: true } as unknown).ok);
  check("giá trị không phải đúng-sai ('true', 1, null) → từ chối", ["true", 1, null, {}, []].every(v => !parsePushTypesPatch({ absence_late: v }).ok));
  check("JSON.parse tạo khoá '__proto__' riêng vẫn bị từ chối", !parsePushTypesPatch(JSON.parse('{"__proto__": true}')).ok);

  section("Quyết định có đẩy không");
  const day = vn(10), night = vn(23);
  check("loại ngoài danh sách → không đẩy", eq(decidePush({ type: "enrollment", types: ALL_ON, now: day }), { send: false, reason: "type-not-allowed" }) && eq(decidePush({ type: "thread_reply", types: ALL_ON, now: day }), { send: false, reason: "type-not-allowed" }));
  check("ban ngày, loại đang bật → đẩy", PUSH_TYPES.every(t => decidePush({ type: t, types: ALL_ON, now: day }).send === true));
  check("gia sư đã tắt loại đó → không đẩy ('type-off'), kể cả báo nghỉ khẩn", eq(decidePush({ type: "invoice_paid", types: { ...ALL_ON, invoice_paid: false }, now: day }), { send: false, reason: "type-off" })
    && eq(decidePush({ type: "absence_late", types: { ...ALL_ON, absence_late: false }, now: night, leadMinutes: 10 }), { send: false, reason: "type-off" }));
  check("mặc định, phiếu đóng đủ KHÔNG được đẩy dù ban ngày", eq(decidePush({ type: "invoice_paid", types: resolvePushTypes(undefined), now: day }), { send: false, reason: "type-off" }));
  // Ranh giới giờ yên lặng 22:00–07:00 (theo giờ Việt Nam; máy chủ chạy UTC)
  const quiet = (h: number, m: number) => decidePush({ type: "bank_tx_pending", types: ALL_ON, now: vn(h, m) });
  check("21:59 → đẩy; 22:00 → yên lặng", quiet(21, 59).send === true && eq(quiet(22, 0), { send: false, reason: "quiet-hours" }));
  check("23:59, 00:00, 03:30, 06:59 → yên lặng; 07:00 → đẩy", [[23, 59], [0, 0], [3, 30], [6, 59]].every(([h, m]) => !quiet(h, m).send) && quiet(7, 0).send === true);
  check("giờ yên lặng tính theo giờ VIỆT NAM, không theo UTC: 16:00 UTC (= 23:00 VN) yên lặng, 02:00 UTC (= 09:00 VN) đẩy", !decidePush({ type: "bank_tx_pending", types: ALL_ON, now: new Date("2026-10-21T16:00:00Z") }).send
    && decidePush({ type: "bank_tx_pending", types: ALL_ON, now: new Date("2026-10-21T02:00:00Z") }).send === true);
  check("tiền chưa khớp và phiếu đóng đủ KHÔNG được đẩy trong giờ yên lặng dù có 'leadMinutes' nhỏ", ["bank_tx_pending", "invoice_paid"].every(t => eq(decidePush({ type: t, types: ALL_ON, now: night, leadMinutes: 5 }), { send: false, reason: "quiet-hours" })));
  check("báo nghỉ sát giờ còn 119 phút → ĐẨY cả giữa đêm; 0 phút → đẩy", decidePush({ type: "absence_late", types: ALL_ON, now: vn(3), leadMinutes: 119 }).send === true && decidePush({ type: "absence_late", types: ALL_ON, now: night, leadMinutes: 0 }).send === true);
  check("báo nghỉ còn đúng 120 phút (không còn là 'sát giờ') / thiếu / NaN / Infinity / không phải số → TÔN TRỌNG giờ yên lặng",
    [120, 121, 600, undefined, NaN, Infinity, "30" as unknown as number].every(l => eq(decidePush({ type: "absence_late", types: ALL_ON, now: night, leadMinutes: l }), { send: false, reason: "quiet-hours" })));
  check("ban ngày báo nghỉ luôn đẩy dù lead nào", [10, 119, 120, 600, undefined].every(l => decidePush({ type: "absence_late", types: ALL_ON, now: day, leadMinutes: l }).send === true));

  section("Chữ gửi đi: dựng từ LOẠI, không tên em, không số tiền");
  check("đúng chữ Figma G2 cho báo nghỉ và tiền chưa khớp", eq(pushPayload("absence_late"), { title: "Có 1 báo nghỉ sát giờ cần xử lý", body: "Bấm để mở Hộp việc.", url: "/lop-cua-toi" })
    && eq(pushPayload("bank_tx_pending"), { title: "Có khoản tiền vào chưa khớp phiếu", body: "Bấm để xem và gạch thủ công.", url: "/lop-cua-toi/hoc-phi?tab=doi-soat" }));
  check("pushPayload chỉ nhận MỘT tham số (loại): không có đường nào đưa tên em / số tiền vào chữ", pushPayload.length === 1);
  check("mọi loại: chỉ ba khoá title/body/url; url là đường dẫn cùng tên miền (bắt đầu '/', không '//')", PUSH_TYPES.every(t => eq(Object.keys(pushPayload(t)), ["title", "body", "url"]) && /^\/(?!\/)/.test(pushPayload(t).url)));
  check("không có số tiền, số điện thoại hay dãy số nào trong chữ (chữ số duy nhất là '1' của 'Có 1 báo nghỉ')", PUSH_TYPES.every(t => { const s = `${PUSH_DEFS[t].title} ${PUSH_DEFS[t].body}`; return (s.match(/\d/g) ?? []).length === (t === "absence_late" ? 1 : 0) && !/VND|₫|\bđồng\b|@/i.test(s); }));
  check("serializePayload: JSON đúng ba khoá, không thêm gì; ≤ 300 byte (xa mức 4KB của dịch vụ đẩy)", PUSH_TYPES.every(t => { const j = JSON.parse(serializePayload(pushPayload(t))); return eq(Object.keys(j), ["title", "body", "url"]) && serializePayload(pushPayload(t)).length < 300; }));
  check("tin thử cũng chỉ ba khoá và dẫn về trang Cài đặt", eq(Object.keys(PUSH_TEST_TEXT), ["title", "body", "url"]) && PUSH_TEST_TEXT.url === "/lop-cua-toi/cai-dat");
  check("báo nghỉ giữ tin ngắn (TTL ≤ 2 giờ: quá giờ học thì vô nghĩa); hai loại kia giữ lâu hơn", PUSH_DEFS.absence_late.ttl <= 7200 && PUSH_DEFS.bank_tx_pending.ttl > PUSH_DEFS.absence_late.ttl);

  section("Điều kiện được phép gửi thật (PUSH_ENABLED, không phải bản xem trước, đủ khoá VAPID)");
  const GOOD = { PUSH_ENABLED: "1", VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:tho@example.com" };
  const reason = (e: Record<string, string | undefined>) => { const c = pushConfig(e); return c.enabled ? "ENABLED" : c.reason; };
  check("khoá thật do web-push sinh + mailto → bật; đủ thông tin kèm theo", reason(GOOD) === "ENABLED" && pushConfig(GOOD).publicKey === keys.publicKey && pushConfig(GOOD).subject === "mailto:tho@example.com");
  check("không có PUSH_ENABLED / '0' / 'true' / 'yes' / rỗng → tắt ('disabled'); chỉ đúng '1'", [undefined, "0", "true", "yes", ""].every(v => reason({ ...GOOD, PUSH_ENABLED: v }) === "disabled") && reason({}) === "disabled");
  check("bản xem trước Vercel (dùng chung DB với production) KHÔNG BAO GIỜ gửi, dù lỡ đặt PUSH_ENABLED=1 và đủ khoá", reason({ ...GOOD, VERCEL_ENV: "preview" }) === "preview");
  check("production / development / chạy cục bộ (không có VERCEL_ENV) → được phép", ["production", "development", undefined].every(v => reason({ ...GOOD, VERCEL_ENV: v }) === "ENABLED"));
  check("thiếu / sai khoá hoặc subject → 'no-keys' (không gửi nửa vời)", [{ VAPID_PUBLIC_KEY: undefined }, { VAPID_PRIVATE_KEY: undefined }, { VAPID_SUBJECT: undefined }, { VAPID_PUBLIC_KEY: "ngan" }, { VAPID_PRIVATE_KEY: "có dấu cách" },
    { VAPID_SUBJECT: "tho@example.com" }, { VAPID_SUBJECT: "http://example.com" }, { VAPID_SUBJECT: "mailto:" }, { VAPID_SUBJECT: "" }].every(o => reason({ ...GOOD, ...o }) === "no-keys"));
  check("subject dạng https được nhận; khoảng trắng hai đầu biến môi trường được cắt", reason({ ...GOOD, VAPID_SUBJECT: "https://kin.example/lien-he" }) === "ENABLED" && reason({ ...GOOD, VAPID_PUBLIC_KEY: ` ${keys.publicKey}\n` }) === "ENABLED");
  check("khi tắt, không lộ khoá nào ra ngoài", ["disabled", "preview", "no-keys"].every(r => { const c = pushConfig(r === "disabled" ? {} : r === "preview" ? { ...GOOD, VERCEL_ENV: "preview" } : { ...GOOD, VAPID_SUBJECT: "x" }); return !c.enabled && c.publicKey === null && c.privateKey === null && c.subject === null; }));

  section("Địa chỉ nhận thông báo: chỉ dịch vụ đẩy của trình duyệt (chống SSRF)");
  const OKS = ["https://fcm.googleapis.com/fcm/send/abc:APA91bH", "https://updates.push.services.mozilla.com/wpush/v2/gAAAA", "https://web.push.apple.com/QGkAbc", "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://FCM.GOOGLEAPIS.COM/fcm/send/x", "https://fcm.googleapis.com:443/fcm/send/x"];
  check("địa chỉ thật của Chrome / Firefox / Safari / Edge → nhận", OKS.every(isAllowedPushEndpoint), OKS.filter(u => !isAllowedPushEndpoint(u)));
  const BADS = ["http://fcm.googleapis.com/fcm/send/x", "https://fcm.googleapis.com.evil.com/x", "https://evilfcm.googleapis.com/x", "https://googleapis.com/x", "https://fcm.googleapis.com@evil.com/x", "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x", "https://fcm.googleapis.com/x#frag", "https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data", "https://[::1]/x", "https://10.0.0.5/x",
    "file:///etc/passwd", "javascript:alert(1)", "ftp://fcm.googleapis.com/x", "//fcm.googleapis.com/x", "fcm.googleapis.com/x", "", "https://", "https://fcm.googleapis.com./x", "https://notify.windows.com.attacker.io/x"];
  check("địa chỉ nội bộ, http, tên miền giả (đuôi / tiền tố / '@'), cổng lạ, userinfo, fragment, giao thức khác → TỪ CHỐI", BADS.every(u => !isAllowedPushEndpoint(u)), BADS.filter(u => isAllowedPushEndpoint(u)));
  check("không phải chuỗi / quá dài (> 2048) → từ chối", [null, undefined, 5, {}, ["https://fcm.googleapis.com/x"]].every(v => !isAllowedPushEndpoint(v)) && !isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(2100)}`));
  check("danh sách tên miền được phép đúng bốn dịch vụ", eq([...PUSH_HOST_SUFFIXES], ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"]));

  section("Đăng ký thiết bị: kiểm dữ liệu");
  const sub = (o: Record<string, unknown> = {}) => ({ subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: P256DH, auth: AUTH }, ...o }, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36" });
  const ok = parseSubscription(sub());
  check("đối tượng PushSubscription.toJSON() thật → nhận, đúng bốn trường, không thêm gì", ok.ok && eq(Object.keys(ok.value).sort(), ["auth", "endpoint", "p256dh", "userAgent"]) && ok.value.p256dh === P256DH);
  check("thiếu subscription / không phải đối tượng → từ chối", [null, undefined, "x", 5, [], {}, { subscription: null }, { subscription: "x" }].every(v => !parseSubscription(v).ok));
  check("endpoint sai → từ chối (không đụng tới khoá)", !parseSubscription(sub({ endpoint: "https://evil.example/x" })).ok && !parseSubscription(sub({ endpoint: undefined })).ok);
  check("khoá thiếu / ngắn / sai ký tự / sai kiểu → từ chối", [{ keys: undefined }, { keys: {} }, { keys: { p256dh: P256DH } }, { keys: { auth: AUTH } }, { keys: { p256dh: "abc", auth: AUTH } }, { keys: { p256dh: P256DH, auth: "ab" } },
    { keys: { p256dh: P256DH + "!!", auth: AUTH } }, { keys: { p256dh: 5, auth: AUTH } }, { keys: { p256dh: P256DH, auth: `${AUTH}${AUTH}` } }].every(o => !parseSubscription(sub(o)).ok));
  const ua = (v: unknown) => { const r = parseSubscription({ ...sub(), userAgent: v }); return r.ok ? r.value.userAgent : "FAIL"; };
  check("userAgent: ký tự điều khiển → dấu cách, cắt ở 300, rỗng / không phải chuỗi → null (không làm hỏng đăng ký)", ua("A\u0000B\nC") === "A B C" && (ua("x".repeat(500)) as string).length === 300 && ua("") === null && ua(5) === null && ua(undefined) === null && ua("   ") === null);
  check(`giới hạn thiết bị = ${MAX_PUSH_DEVICES}`, MAX_PUSH_DEVICES === 10);

  section("Tên thiết bị từ userAgent");
  const UA = {
    chromeAndroid: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
    edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    samsung: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
    chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    operaWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  };
  check("Chrome Android / Safari iPhone / Chrome iPhone / Edge Windows / Firefox Linux / Samsung / Chrome Mac / Opera",
    deviceLabel(UA.chromeAndroid) === "Chrome · Android" && deviceLabel(UA.safariIphone) === "Safari · iPhone" && deviceLabel(UA.chromeIphone) === "Chrome · iPhone" && deviceLabel(UA.edgeWin) === "Edge · Windows"
    && deviceLabel(UA.firefoxLinux) === "Firefox · Linux" && deviceLabel(UA.samsung) === "Samsung Internet · Android" && deviceLabel(UA.chromeMac) === "Chrome · Mac" && deviceLabel(UA.operaWin) === "Opera · Windows",
    Object.entries(UA).map(([k, v]) => `${k}=${deviceLabel(v)}`));
  check("rỗng / null / không nhận ra → 'Thiết bị khác' (không in nguyên chuỗi userAgent ra màn hình)", deviceLabel(null) === "Thiết bị khác" && deviceLabel("") === "Thiết bị khác" && deviceLabel(undefined) === "Thiết bị khác" && deviceLabel("curl/8.0") === "Thiết bị khác" && !deviceLabel("curl/8.0").includes("curl"));

  section("Dấu vân tay máy này (không đưa endpoint lên URL)");
  const ep = "https://fcm.googleapis.com/fcm/send/abc:APA91bH-secret";
  const fp = await endpointFingerprint(ep);
  check("SHA-256 hex 64 ký tự, đúng với crypto của Node, không lộ endpoint, khác nhau khi endpoint khác", fp === createHash("sha256").update(ep).digest("hex") && isFingerprint(fp) && !fp.includes("secret") && fp !== await endpointFingerprint(`${ep}x`));
  check("isFingerprint: chỉ hex thường 64 ký tự", !isFingerprint(fp.toUpperCase()) && !isFingerprint(fp.slice(1)) && !isFingerprint(`${fp}0`) && !isFingerprint(null) && !isFingerprint(5) && !isFingerprint(ep));

  section("Trạng thái hiện trên trang Cài đặt");
  const base: PushUiInput = { supported: true, ios: false, standalone: false, serverEnabled: true, permission: "default", localSub: false, mineOnServer: false };
  const st = (o: Partial<PushUiInput>) => pushUiState({ ...base, ...o });
  check("bình thường chưa bật → 'off'; đã cho phép + trình duyệt có đăng ký + máy chủ nhớ → 'on'", st({}) === "off" && st({ permission: "granted", localSub: true, mineOnServer: true }) === "on");
  check("trình duyệt còn đăng ký nhưng máy chủ KHÔNG còn (gỡ từ máy khác / báo chết) → 'off' để bấm bật lại, KHÔNG hiện 'đã bật'", st({ permission: "granted", localSub: true, mineOnServer: false }) === "off");
  check("máy chủ nhớ nhưng trình duyệt không còn đăng ký → 'off'", st({ permission: "granted", localSub: false, mineOnServer: true }) === "off");
  check("quyền 'default' dù có đăng ký + máy chủ nhớ → không phải 'on' (quyền chưa cấp)", st({ permission: "default", localSub: true, mineOnServer: true }) === "off");
  check("bị chặn ('denied') → 'blocked', kể cả đang có đăng ký cũ", st({ permission: "denied" }) === "blocked" && st({ permission: "denied", localSub: true, mineOnServer: true }) === "blocked");
  check("hệ thống không được phép gửi → 'server-off' (ưu tiên hơn cả 'blocked' và 'on')", st({ serverEnabled: false }) === "server-off" && st({ serverEnabled: false, permission: "denied" }) === "server-off" && st({ serverEnabled: false, permission: "granted", localSub: true, mineOnServer: true }) === "server-off");
  check("trình duyệt không hỗ trợ → 'unsupported'; iPhone chưa cài vào Màn hình chính → 'ios-install'; iPhone đã cài mà vẫn không hỗ trợ → 'unsupported'",
    st({ supported: false }) === "unsupported" && st({ supported: false, ios: true, standalone: false }) === "ios-install" && st({ supported: false, ios: true, standalone: true }) === "unsupported");
  check("thiếu hỗ trợ thắng 'server-off' (người dùng cần biết máy này không làm được)", st({ supported: false, serverEnabled: false }) === "unsupported" && st({ supported: false, ios: true, serverEnabled: false }) === "ios-install");
  check("nhận ra iPhone, iPad, iPadOS đội lốt Mac (có cảm ứng); Mac thật và Android thì không", isIosDevice(UA.safariIphone, 5) && isIosDevice("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)", 5) && isIosDevice(UA.chromeMac, 5) && !isIosDevice(UA.chromeMac, 0) && !isIosDevice(UA.chromeAndroid, 5));
  check("chữ giải thích khi hệ thống tắt: ba câu khác nhau, lạ → câu chung", new Set([serverOffText("preview"), serverOffText("no-keys"), serverOffText("disabled")]).size === 3 && serverOffText(null) === serverOffText("disabled") && serverOffText("zzz") === serverOffText("disabled"));

  section("Khoá VAPID công khai → byte cho trình duyệt");
  const bytes = urlBase64ToUint8Array(keys.publicKey);
  check("khoá thật: 65 byte, byte đầu 0x04 (điểm không nén P-256), khớp Buffer.from(base64url)", bytes.length === 65 && bytes[0] === 4 && Buffer.from(bytes).equals(Buffer.from(keys.publicKey, "base64url")));
  check("'AQAB' → [1,0,1]; ký tự url-safe '-' '_' đổi đúng ('-_8' → [251,255])", eq(Array.from(urlBase64ToUint8Array("AQAB")), [1, 0, 1]) && eq(Array.from(urlBase64ToUint8Array("-_8")), [251, 255]));
  check("có / không có dấu '=' đệm đều ra cùng kết quả", eq(Array.from(urlBase64ToUint8Array("AQA=")), Array.from(urlBase64ToUint8Array("AQA"))));
  check("sai dạng (rỗng, có '+' '/' của base64 thường, ký tự lạ, dấu cách) → ném lỗi, không đoán", ["", "a+b", "a/b", "!!", "ab cd", "AQ==AQ"].every(v => { try { urlBase64ToUint8Array(v); return false; } catch { return true; } }));

  section("Service worker (chạy trong hộp cát, không cần trình duyệt)");
  const swSrc = src("public/sw.js");
  const mkSw = (wins: { url: string; focus?: () => Promise<void>; navigate?: (u: string) => Promise<void> }[] = []) => {
    const listeners: Record<string, (e: unknown) => void> = {};
    const shown: { title: string; opts: Record<string, unknown> }[] = [], opened: string[] = [];
    const self = {
      addEventListener: (t: string, f: (e: unknown) => void) => { listeners[t] = f; }, skipWaiting: () => {},
      clients: { claim: async () => {}, matchAll: async () => wins, openWindow: async (u: string) => { opened.push(u); } },
      registration: { showNotification: async (title: string, opts: Record<string, unknown>) => { shown.push({ title, opts }); } },
      location: { origin: "https://kin.test" },
    };
    vm.runInNewContext(swSrc, { self, URL });
    const fire = async (type: string, e: Record<string, unknown>) => { const waits: Promise<unknown>[] = []; listeners[type]({ ...e, waitUntil: (p: Promise<unknown>) => waits.push(p) }); await Promise.all(waits); };
    return { listeners, shown, opened, fire };
  };
  const pushOf = (data: unknown) => ({ data: { json: () => { if (data === "THROW") throw new Error("bad json"); return data; } } });
  {
    const sw = mkSw();
    check("chỉ đăng ký bốn sự kiện: install, activate, push, notificationclick — KHÔNG có fetch (không cache, không offline)", eq(Object.keys(sw.listeners).sort(), ["activate", "install", "notificationclick", "push"]));
    check("không nhập script ngoài, không dùng Cache API / fetch", !/importScripts|caches\.|\bfetch\(|XMLHttpRequest|WebSocket|eval\(|new Function/.test(swSrc));
    await sw.fire("push", pushOf({ title: "Có 1 báo nghỉ sát giờ cần xử lý", body: "Bấm để mở Hộp việc.", url: "/lop-cua-toi" }));
    const n = sw.shown[0];
    check("tin hợp lệ → hiện đúng tiêu đề + nội dung + biểu tượng của KiN + đường dẫn", sw.shown.length === 1 && n.title === "Có 1 báo nghỉ sát giờ cần xử lý" && n.opts.body === "Bấm để mở Hộp việc." && n.opts.icon === "/icons/kin-192.png" && eq(n.opts.data, { url: "/lop-cua-toi" }), n);
    check("biểu tượng thông báo là tệp có thật trong public/", existsSync(join(process.cwd(), "public", String(n.opts.icon))));
    for (const [name, data] of [["JSON hỏng", "THROW"], ["không có dữ liệu", null], ["thiếu title", { body: "x" }], ["title rỗng", { title: "" }], ["title không phải chuỗi", { title: 5 }], ["title quá dài (> 120)", { title: "x".repeat(121) }]] as const) {
      const s2 = mkSw(); await s2.fire("push", pushOf(data));
      check(`tin sai dạng (${name}) → KHÔNG hiện thông báo trống`, s2.shown.length === 0);
    }
    const s3 = mkSw(); await s3.fire("push", pushOf({ title: "T", body: "b".repeat(500), url: "/x" }));
    check("nội dung dài bị cắt ở 200 ký tự", (s3.shown[0].opts.body as string).length === 200);
    const s4 = mkSw(); await s4.fire("push", pushOf({ title: "T", body: 5 }));
    check("body không phải chuỗi → rỗng, vẫn hiện tiêu đề", s4.shown.length === 1 && s4.shown[0].opts.body === "");
    const FALLBACK = "/lop-cua-toi";
    const kept: string[] = [];
    for (const bad of ["//evil.com/x", "https://evil.com/x", "/\\evil.com", "javascript:alert(1)", "evil.com", "", 5, null, undefined, `/${"a".repeat(400)}`]) {
      const s5 = mkSw(); await s5.fire("push", pushOf({ title: "T", url: bad }));
      const got = (s5.shown[0]?.opts.data as { url?: string } | undefined)?.url;
      if (got !== FALLBACK) kept.push(`${JSON.stringify(bad)} → ${got}`);
    }
    check("đường dẫn lạ ('//evil.com', 'https://…', '/\\evil', 'javascript:', rỗng, không phải chuỗi, quá dài) đều bị thay bằng Hộp việc: tin lạ không dẫn người dùng ra ngoài", kept.length === 0, kept);
    const s6 = mkSw(); await s6.fire("push", pushOf({ title: "T", url: "/lop-cua-toi/hoc-phi?tab=doi-soat" }));
    check("đường dẫn cùng tên miền có tham số được giữ nguyên", eq(s6.shown[0].opts.data, { url: "/lop-cua-toi/hoc-phi?tab=doi-soat" }));
  }
  {
    const closed: number[] = [];
    const click = (url: unknown) => ({ notification: { close: () => closed.push(1), data: url === undefined ? undefined : { url } } });
    const navigated: string[] = [], focused: string[] = [];
    const swA = mkSw([{ url: "https://other.example/x", focus: async () => { focused.push("other"); } }, { url: "https://kin.test/lop-cua-toi/lich", focus: async () => { focused.push("kin"); }, navigate: async u => { navigated.push(u); } }]);
    await swA.fire("notificationclick", click("/lop-cua-toi/hoc-phi?tab=doi-soat"));
    check("bấm vào tin: đóng thông báo, dùng LẠI cửa sổ KiN đang mở (không mở thêm), điều hướng tới đúng trang; bỏ qua cửa sổ của trang khác", closed.length === 1 && eq(focused, ["kin"]) && eq(navigated, ["https://kin.test/lop-cua-toi/hoc-phi?tab=doi-soat"]) && swA.opened.length === 0, { focused, navigated, opened: swA.opened });
    const swB = mkSw([{ url: "https://other.example/x", focus: async () => {} }]);
    await swB.fire("notificationclick", click("/lop-cua-toi"));
    check("không có cửa sổ KiN nào đang mở → mở cửa sổ mới bằng địa chỉ đầy đủ cùng tên miền", eq(swB.opened, ["https://kin.test/lop-cua-toi"]));
    const swC = mkSw();
    await swC.fire("notificationclick", click("//evil.com/phish"));
    await swC.fire("notificationclick", click(undefined));
    check("dữ liệu của thông báo bị sửa / thiếu → mở Hộp việc, KHÔNG mở trang ngoài", eq(swC.opened, ["https://kin.test/lop-cua-toi", "https://kin.test/lop-cua-toi"]), swC.opened);
    const swD = mkSw([{ url: "https://kin.test/a", focus: async () => { throw new Error("không focus được"); } }]);
    await swD.fire("notificationclick", click("/lop-cua-toi"));
    check("cửa sổ cũ không focus được → mở cửa sổ mới, không để thông báo 'chết'", eq(swD.opened, ["https://kin.test/lop-cua-toi"]));
  }

  section("Manifest và biểu tượng");
  const m = manifest();
  check("khai báo cài đặt được: tên, tên ngắn, start_url '/', scope '/', display standalone, ngôn ngữ vi", m.name === "KiN — Sổ gia sư" && m.short_name === "KiN" && m.start_url === "/" && m.scope === "/" && m.display === "standalone" && m.lang === "vi");
  const pngSize = (p: string) => { const b = readFileSync(join(process.cwd(), "public", p)); return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : "KHÔNG PHẢI PNG"; };
  check("mọi biểu tượng trong manifest là tệp PNG CÓ THẬT, đúng kích thước đã khai", (m.icons ?? []).length >= 3 && (m.icons ?? []).every(i => existsSync(join(process.cwd(), "public", i.src)) && pngSize(i.src) === i.sizes), (m.icons ?? []).map(i => `${i.src}: ${existsSync(join(process.cwd(), "public", i.src)) ? pngSize(i.src) : "THIẾU"} / ${i.sizes}`));
  check("có đủ 192, 512 (dùng thường) và 512 kiểu 'maskable' (Android cắt tròn)", (m.icons ?? []).some(i => i.sizes === "192x192" && i.purpose === "any") && (m.icons ?? []).some(i => i.sizes === "512x512" && i.purpose === "any") && (m.icons ?? []).some(i => i.purpose === "maskable"));
  const tokens = src("src/app/kin-tokens.css");
  const navy = tokens.match(/--kin-th-navy:\s*(#[0-9a-fA-F]{6})/)?.[1];
  check("màu chủ đề của manifest = --kin-th-navy (chế độ sáng) trong kin-tokens.css; nền trắng", !!navy && m.theme_color?.toLowerCase() === navy.toLowerCase() && m.background_color === "#ffffff", [navy, m.theme_color]);
  check("biểu tượng và service worker KHÔNG bị .gitignore chặn (cùng lỗi với ảnh chia sẻ public/og-kin.png mà /mentor/[id] trỏ tới: không bao giờ được commit; lúc làm xong ĐX-02, '*.png' trong .gitignore đã làm biểu tượng không được commit — manifest sẽ trỏ vào tệp không có trên Vercel)",
    [...(m.icons ?? []).map(i => `public${i.src}`), "public/icons/kin-180.png", "public/sw.js", "public/og-kin.png"].every(f => spawnSync("git", ["check-ignore", "-q", f], { cwd: process.cwd() }).status === 1));
  check("biểu tượng cảm ứng của Apple 180×180 có thật và được khai ở layout; layout bật appleWebApp", pngSize("icons/kin-180.png") === "180x180" && /icons:\s*\{\s*apple:\s*"\/icons\/kin-180\.png"/.test(src("src/app/layout.tsx")) && /appleWebApp:\s*\{\s*capable:\s*true/.test(src("src/app/layout.tsx")));
  const cfgMod = (await import("../../next.config")).default;
  const hdrs = await cfgMod.headers?.();
  const swH = hdrs?.find(h => h.source === "/sw.js")?.headers ?? [];
  check("next.config: /sw.js không bao giờ vào bộ nhớ đệm, đúng kiểu JavaScript, CSP chỉ cho mã cùng nguồn", swH.some(h => h.key === "Cache-Control" && /no-store/.test(h.value) && /no-cache/.test(h.value)) && swH.some(h => h.key === "Content-Type" && /javascript/.test(h.value)) && swH.some(h => h.key === "Content-Security-Policy" && /default-src 'self'/.test(h.value)), swH);

  section("Quét tĩnh: chỉ gia sư, chỉ gửi khi được phép, chữ dựng từ loại");
  const server = src("src/lib/pushServer.ts"), notifySrc = src("src/lib/notify.ts"), rules = src("src/lib/pushRules.ts");
  check("mọi API push đều qua requirePushTutor (chỉ gia sư) ở MỖI hàm xuất ra", ["settings", "subscribe", "test"].every(r => { const t = src(`src/app/api/push/${r}/route.ts`); const fns = (t.match(/export async function (GET|POST|PUT|DELETE)/g) ?? []).length; return fns > 0 && (t.match(/await requirePushTutor\(\)/g) ?? []).length === fns; }));
  check("tệp route chỉ xuất tên Next cho phép (GET / POST / PUT / DELETE…): xuất thêm hằng số làm bản build đỏ ('is not a valid Route export field') mà tsc không báo",
    ["settings", "subscribe", "test"].every(r => (src(`src/app/api/push/${r}/route.ts`).match(/^export (?:async )?(?:function|const) (\w+)/gm) ?? []).every(l => /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|dynamic|revalidate|runtime|maxDuration)$/.test(l))));
  check("requirePushTutor: 401 khi chưa đăng nhập (requireSession), 403 trừ role admin + adminRole teacher", /requireSession\(\)/.test(src("src/lib/pushAuth.ts")) && /auth\.role !== "admin" \|\| auth\.adminRole !== "teacher"/.test(src("src/lib/pushAuth.ts")) && /status: 403/.test(src("src/lib/pushAuth.ts")));
  check("subscribe / test chỉ chạy khi pushConfig(...).enabled", ["subscribe", "test"].every(r => /pushConfig\(process\.env\)/.test(src(`src/app/api/push/${r}/route.ts`)) && /!cfg\.enabled/.test(src(`src/app/api/push/${r}/route.ts`))));
  check("subscribe kiểm dữ liệu bằng parseSubscription (có chống SSRF) trước khi chạm DB", /parseSubscription\(body\)/.test(src("src/app/api/push/subscribe/route.ts")) && before(src("src/app/api/push/subscribe/route.ts"), "parseSubscription(body)", "prisma.pushSubscription"));
  check("DELETE chỉ xoá thiết bị CỦA CHÍNH người gọi (userId nằm trong where)", /deleteMany\(\{ where: \{ userId: auth\.userId,/.test(src("src/app/api/push/subscribe/route.ts")));
  check("GET settings không trả endpoint hay khoá của thiết bị (select có endpoint chỉ để tính dấu vân tay; kết quả không có)", /endpoint: true/.test(src("src/app/api/push/settings/route.ts")) && !/endpoint: s\.endpoint|p256dh|auth: s\./.test(src("src/app/api/push/settings/route.ts").split("const devices")[1] ?? ""));
  check("lưu công tắc dùng CÙNG khoá giao dịch prefsLockKey với API giao diện / hồ sơ gia sư", /pg_advisory_xact_lock\(hashtext\(\$\{prefsLockKey\(auth\.userId\)\}\)\)/.test(src("src/app/api/push/settings/route.ts")));
  check("nút Gửi thử có giới hạn (nhật ký push.test) và không tính khi chưa có thiết bị", /action: "push\.test"/.test(src("src/app/api/push/test/route.ts")) && before(src("src/app/api/push/test/route.ts"), "devices === 0", "await logAction("));
  check("chữ đẩy dựng từ LOẠI: pushServer không đọc bảng notifications và gọi pushPayload(type)", !/prisma\.notification|\.message\b[^)]/.test(server.replace(/\(r\.reason as Error\)\?\.message/, "")) && /pushPayload\(type\)/.test(server));
  check("pushToUser kiểm môi trường (pushConfig) TRƯỚC khi đụng DB; loại ngoài danh sách thoát trước cả hai", before(server, "isPushType(type)", "pushConfig(") && before(server, "pushConfig(", "prisma.user.findUnique"));
  check("404 / 410 → đánh dấu revokedAt (không gửi nữa); lỗi khác không làm mất thiết bị", /code === 404 \|\| code === 410/.test(server) && /revokedAt: now/.test(server) && /else \{ failed\+\+/.test(server));
  check("báo nghỉ sát giờ xin dịch vụ đẩy chuyển GẤP (urgency high); hai loại kia bình thường", /type === "absence_late" \? "high" : "normal"/.test(server));
  check("bộ gửi chờ tối đa vài giây (timeout), không treo việc khác", /PUSH_TIMEOUT_MS = 5000/.test(server) && /timeout: PUSH_TIMEOUT_MS/.test(server));
  check("notify(): chỉ loại trong danh sách mới đẩy; đẩy chạy sau phản hồi (after) và nuốt lỗi; không nạp web-push khi không cần (import động)", /if \(isPushType\(data\.type\)\) deferPush/.test(notifySrc) && /after\(run\)/.test(notifySrc) && /await import\("@\/lib\/pushServer"\)/.test(notifySrc) && /catch \(e\)/.test(notifySrc));
  check("báo nghỉ sát giờ truyền leadMinutes cho notify() (để được đẩy trong giờ yên lặng khi còn dưới 2 giờ)", /\{ leadMinutes: cls\.leadMinutes \}/.test(src("src/lib/absenceServer.ts")));
  check("webhook SePay vẫn gọi notify() (loại invoice_paid / bank_tx_pending tự được đẩy), không truyền chữ riêng cho push", /type: "invoice_paid"/.test(src("src/app/api/webhooks/sepay/[tutorId]/route.ts")) && /type: "bank_tx_pending"/.test(src("src/app/api/webhooks/sepay/[tutorId]/route.ts")) && !/push/i.test(src("src/app/api/webhooks/sepay/[tutorId]/route.ts")));
  check("ghi chú nguyên tắc nằm ngay đầu pushRules (chữ từ loại, giờ yên lặng, chỉ Production)", /KHÔNG lấy `message`/.test(rules) && /22:00–07:00/.test(rules) && /PUSH_ENABLED=1/.test(rules));
  const schema = src("prisma/schema.prisma");
  const model = schema.match(/model PushSubscription \{[\s\S]*?\n\}/)?.[0] ?? "";
  check("schema: bảng push_subscriptions, endpoint duy nhất, xoá người dùng thì xoá thiết bị, chỉ mục (userId, revokedAt)", /@@map\("push_subscriptions"\)/.test(model) && /endpoint\s+String\s+@unique/.test(model) && /onDelete: Cascade/.test(model) && /@@index\(\[userId, revokedAt\]\)/.test(model) && /pushSubscriptions\s+PushSubscription\[\]/.test(schema));
  check("schema: bảng MỚI (không đổi cột hay xoá gì của bảng cũ) nên db push không dính cảnh báo mất dữ liệu", !/drop|DROP/.test(model));
  const pkg = JSON.parse(src("package.json"));
  check("package.json có web-push (dependency) và @types/web-push (dev)", typeof pkg.dependencies?.["web-push"] === "string" && typeof pkg.devDependencies?.["@types/web-push"] === "string");
  const ui = src("src/components/tutor/PushSettings.tsx");
  check("trang Cài đặt gắn PushSettings; giao diện không in endpoint hay khoá, không lưu vào localStorage / cookie", /<PushSettings \/>/.test(src("src/app/lop-cua-toi/(tutor)/cai-dat/CaiDatClient.tsx")) && !/p256dh|localStorage|sessionStorage|document\.cookie|console\./.test(ui) && !/\{[^}]*\.endpoint[^}]*\}\s*<\//.test(ui));
  check("xin quyền thông báo NGAY trong cú bấm (không xin lúc mở trang), đăng ký sw.js với updateViaCache 'none'", /Notification\.requestPermission\(\)/.test(ui) && before(ui, "async function enable", "Notification.requestPermission()") && /updateViaCache: "none"/.test(ui) && /userVisibleOnly: true/.test(ui));
  check("đăng ký thất bại ở máy chủ thì gỡ đăng ký vừa tạo ở trình duyệt (không để lại đăng ký mồ côi)", /if \(createdHere\) await sub\.unsubscribe\(\)/.test(ui));
  check("chữ trên giao diện: có hướng dẫn iPhone 16.4+, giờ yên lặng 22:00–07:00 và ngoại lệ dưới 2 giờ", /iOS 16\.4/.test(ui) && /22:00–07:00/.test(ui) && /dưới 2 giờ/.test(ui) && /Dùng iPhone\?/.test(ui));
  check("không dùng màu hex trong giao diện mới (t-no-hex)", ![ui, src("src/lib/pushClient.ts"), rules, server].some(t => /#[0-9a-fA-F]{3,8}\b/.test(t)));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
