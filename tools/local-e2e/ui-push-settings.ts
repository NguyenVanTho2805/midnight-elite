// ĐX-02 (NC1-032) — Cài đặt → "Thông báo đẩy" trên trình duyệt thật (Chromium), với PushManager / Notification / serviceWorker GIẢ (init script):
// Chromium không đầu không có dịch vụ đẩy nên `subscribe` thật sẽ lỗi; ở đây kiểm cả luồng giao diện + máy chủ THẬT (API, DB), chỉ thay phần trình duyệt.
// Phần "tin thật tới điện thoại" không test tự động được — kiểm tay (NC1-033).
// Cần Postgres + Next dev (xem README) và máy chủ dev khởi động với PUSH_ENABLED=1 + VAPID_* (xem env.example.sh).
import webpush from "web-push";
import { BASE, mkTutor, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

const keys = webpush.generateVAPIDKeys();
const P256DH = keys.publicKey, AUTH = keys.privateKey.slice(0, 22);
const stamp = Date.now().toString(36);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

interface Stub { permission: "default" | "granted" | "denied"; onRequest: "granted" | "denied"; endpoint: string; p256dh: string; auth: string; noPush?: boolean; ua?: string }
/**
 * Mã dựng PushManager / Notification / serviceWorker giả, chạy TRƯỚC khi trang chạy. Viết thành CHUỖI JavaScript thuần (không phải hàm TS):
 * tsx / esbuild chèn lời gọi `__name(...)` vào thân hàm, mà hàm đưa sang trình duyệt bằng toString() thì không có `__name` → ReferenceError.
 * Đăng ký giả và quyền được nhớ trong sessionStorage để sống qua lần tải lại trang.
 */
const STUB_SRC = `(a) => {
  const w = window;
  const st = { registered: null, subscribeCalls: [], unsubscribed: 0 };
  const perm = () => sessionStorage.getItem("__perm") || a.permission;
  const make = () => ({ endpoint: a.endpoint, toJSON: () => ({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }),
    unsubscribe: async () => { sessionStorage.removeItem("__sub"); st.sub = null; st.unsubscribed++; return true; } });
  st.sub = sessionStorage.getItem("__sub") ? make() : null;
  if (!a.noPush) {
    const N = function () {};
    Object.defineProperty(N, "permission", { get: () => perm() });
    N.requestPermission = async () => { if (perm() === "default") sessionStorage.setItem("__perm", a.onRequest); return perm(); };
    w.Notification = N;
    w.PushManager = function () {};
    const reg = { pushManager: { getSubscription: async () => st.sub, subscribe: async (o) => { st.subscribeCalls.push(o.applicationServerKey && o.applicationServerKey.length); st.sub = make(); sessionStorage.setItem("__sub", "1"); return st.sub; } } };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: async (u, o) => { st.registered = [u, o]; return reg; }, ready: Promise.resolve(reg), getRegistration: async () => reg } });
  } else {
    try { delete w.PushManager; } catch (e) {}
    try { delete w.Notification; } catch (e) {}
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
  }
  if (a.ua) Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => a.ua });
  w.__push = st;
}`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await launch();
  const open = async (stub: Partial<Stub> = {}, size?: { width: number; height: number }) => {
    const ctx = await ctxFor(T, size);
    const arg: Stub = { permission: "default", onRequest: "granted", endpoint: `https://fcm.googleapis.com/fcm/send/ui-${stamp}`, p256dh: P256DH, auth: AUTH, ...stub };
    await ctx.addInitScript({ content: `(${STUB_SRC})(${JSON.stringify(arg)})` });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|409|429/i.test(m.text())) errors.push(m.text()); });
    await page.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByRole("heading", { name: "Thông báo đẩy" }).waitFor({ timeout: 90000 });
    return { page, errors };
  };
  const here = (p: Awaited<ReturnType<typeof open>>["page"]) => p.getByTestId("push-here");
  const secOf = (p: Awaited<ReturnType<typeof open>>["page"]) => p.locator("#thong-bao-day");
  const stateOf = (p: Awaited<ReturnType<typeof open>>["page"]) => here(p).getAttribute("data-state");

  section("Hệ thống đang bật");
  const probe = await open();
  await eventually("mục hiện trạng thái (không còn khung chờ)", async () => (await stateOf(probe.page)) !== null);
  if ((await stateOf(probe.page)) === "server-off") { console.error("THIẾU CẤU HÌNH: máy chủ dev phải khởi động với PUSH_ENABLED=1 và VAPID_* (xem env.example.sh)."); process.exit(2); }

  section("Chưa bật: giao diện và giá trị mặc định");
  const { page, errors } = probe;
  check("trạng thái 'off', badge 'Chưa bật', nút 'Bật trên máy này'; KHÔNG có nút Tắt / Gửi thử", await stateOf(page) === "off" && await here(page).getByText("Chưa bật", { exact: true }).isVisible() && await here(page).getByRole("button", { name: "Bật trên máy này" }).isVisible() && (await here(page).getByRole("button", { name: /Tắt máy này|Gửi thử/ }).count()) === 0);
  // Phạm vi trong mục "Thông báo đẩy": công tắc module "Lịch" ở trên cũng có chữ "báo nghỉ sát giờ" trong phần mô tả nên tìm theo tên trên cả trang bị trùng.
  const sw = (name: string) => page.locator("#thong-bao-day").getByRole("switch", { name });
  check("ba công tắc: báo nghỉ BẬT, tiền chưa khớp BẬT, phiếu đóng đủ TẮT", await sw("Báo nghỉ sát giờ").isChecked() && await sw("Khoản tiền vào chưa khớp phiếu").isChecked() && !(await sw("Phiếu học phí đã đóng đủ").isChecked()));
  check("NC2-010/011: có thêm hai công tắc mới, MẶC ĐỊNH TẮT, đúng nhãn + mô tả ('Có phụ huynh báo đã chuyển khoản, cần đối soát' / nhắc điểm danh 7 giờ sáng)",
    !(await sw("Phụ huynh báo đã chuyển khoản").isChecked()) && !(await sw("Nhắc điểm danh buổi hôm qua").isChecked())
    && await secOf(page).getByText("Có phụ huynh báo đã chuyển khoản, cần đối soát").isVisible() && await secOf(page).getByText(/7 giờ sáng báo hôm qua còn bao nhiêu buổi chưa điểm danh/).isVisible()
    && (await secOf(page).getByRole("switch").count()) === 5);
  check("có ghi: giờ yên lặng 22:00–07:00 + ngoại lệ dưới 2 giờ; chữ khoá màn hình không có tên / tiền; hướng dẫn iPhone 16.4+", await secOf(page).getByText("Giờ yên lặng 22:00–07:00").isVisible() && await secOf(page).getByText(/báo nghỉ còn dưới 2 giờ/).isVisible() && await secOf(page).getByText(/không có tên học sinh hay số tiền/).isVisible() && await secOf(page).getByText(/iOS 16\.4/).isVisible());
  check("chưa đăng ký gì: không có mục 'Thiết bị đã bật'", (await secOf(page).getByRole("heading", { name: /Thiết bị đã bật/ }).count()) === 0);
  await shot(page, "push-settings-off");

  section("Bật trên máy này");
  await here(page).getByRole("button", { name: "Bật trên máy này" }).click();
  await eventually("trạng thái 'on' sau khi bật", async () => (await stateOf(page)) === "on", 30000);
  const reg = await page.evaluate(() => ({ r: (window as any).__push.registered, k: (window as any).__push.subscribeCalls }));
  check("đã đăng ký /sw.js với scope '/' và updateViaCache 'none'; xin đăng ký với khoá VAPID 65 byte", reg.r?.[0] === "/sw.js" && reg.r?.[1]?.scope === "/" && reg.r?.[1]?.updateViaCache === "none" && reg.k?.[0] === 65, reg);
  const row = await prisma.pushSubscription.findFirst({ where: { userId: T.id } });
  check("DB có đúng một thiết bị của gia sư, đúng endpoint và khoá; userAgent là Chrome", (await prisma.pushSubscription.count({ where: { userId: T.id } })) === 1 && row?.endpoint === `https://fcm.googleapis.com/fcm/send/ui-${stamp}` && row?.p256dh === P256DH && /Chrome/.test(row?.userAgent ?? ""));
  check("hiện badge 'Đã bật', nút 'Tắt máy này' và 'Gửi thử'; danh sách thiết bị ghi '· máy này' và KHÔNG có nút Gỡ cho chính máy này", await here(page).getByText("Đã bật", { exact: true }).isVisible() && await here(page).getByRole("button", { name: "Tắt máy này" }).isVisible() && await here(page).getByRole("button", { name: "Gửi thử" }).isVisible()
    && await secOf(page).getByText(/· máy này/).isVisible() && (await secOf(page).getByRole("button", { name: /^Gỡ / }).count()) === 0);
  check("trang không in endpoint hay khoá ra màn hình", !(await page.content()).includes(`ui-${stamp}`) && !(await page.content()).includes(P256DH));
  await page.getByText("Đã bật thông báo đẩy trên máy này.").waitFor({ timeout: 15000 }).catch(() => {});
  await shot(page, "push-settings-on");

  section("Tải lại: vẫn 'đã bật' (trình duyệt có đăng ký + máy chủ nhớ)");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Thông báo đẩy" }).waitFor({ timeout: 60000 });
  await eventually("trạng thái 'on' sau tải lại", async () => (await stateOf(page)) === "on", 30000);

  section("Công tắc từng loại lưu theo tài khoản");
  await sw("Phiếu học phí đã đóng đủ").click(); // công tắc điều khiển bởi state sau khi máy chủ trả lời nên dùng click(), không check()
  await eventually("DB: preferences.push.types.invoice_paid = true", async () => ((await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences as any)?.push?.types?.invoice_paid === true);
  await sw("Phụ huynh báo đã chuyển khoản").click();
  await sw("Nhắc điểm danh buổi hôm qua").click();
  await eventually("DB: bật parent_reported + unmarked_daily (hai loại mới)", async () => { const t = ((await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences as any)?.push?.types; return t?.parent_reported === true && t?.unmarked_daily === true; });
  await sw("Báo nghỉ sát giờ").click();
  await eventually("DB: tắt báo nghỉ, phiếu đóng đủ vẫn bật", async () => { const t = ((await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences as any)?.push?.types; return t?.absence_late === false && t?.invoice_paid === true; });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Thông báo đẩy" }).waitFor({ timeout: 60000 });
  check("tải lại: công tắc giữ đúng (báo nghỉ TẮT, phiếu đóng đủ BẬT, tiền chưa khớp BẬT)", !(await sw("Báo nghỉ sát giờ").isChecked()) && await sw("Phiếu học phí đã đóng đủ").isChecked() && await sw("Khoản tiền vào chưa khớp phiếu").isChecked());
  await sw("Báo nghỉ sát giờ").click();
  await eventually("bật lại báo nghỉ", async () => ((await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences as any)?.push?.types?.absence_late === true);

  section("Gửi thử và thiết bị khác");
  await page.route("**/api/push/test", route => { void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sent: 1, failed: 0, revoked: 0 }) }); });
  await here(page).getByRole("button", { name: "Gửi thử" }).click();
  await page.getByText(/Đã gửi thử/).waitFor({ timeout: 15000 });
  check("Gửi thử → báo 'Đã gửi thử …' (máy chủ giả lập kết quả để không gọi ra mạng)", await page.getByText(/Đã gửi thử/).isVisible());
  await page.unroute("**/api/push/test");
  await prisma.pushSubscription.create({ data: { userId: T.id, endpoint: `https://web.push.apple.com/ui-${stamp}-iphone`, p256dh: P256DH, auth: AUTH, userAgent: IPHONE } });
  await page.reload({ waitUntil: "networkidle" });
  await secOf(page).getByRole("heading", { name: /Thiết bị đã bật \(2\/10\)/ }).waitFor({ timeout: 60000 });
  const rm = secOf(page).getByRole("button", { name: /^Gỡ Safari · iPhone/ });
  check("thiết bị thứ hai (Safari · iPhone) có nút Gỡ; máy này không có", (await rm.count()) === 1 && (await secOf(page).getByRole("button", { name: /^Gỡ / }).count()) === 1);
  await rm.click();
  await eventually("Gỡ → danh sách còn 1 thiết bị, DB chỉ còn máy này", async () => (await secOf(page).getByRole("heading", { name: /Thiết bị đã bật \(1\/10\)/ }).count()) === 1 && (await prisma.pushSubscription.count({ where: { userId: T.id } })) === 1);

  section("Tắt máy này");
  await here(page).getByRole("button", { name: "Tắt máy này" }).click();
  await eventually("trạng thái về 'off', DB hết thiết bị, trình duyệt cũng đã huỷ đăng ký", async () => (await stateOf(page)) === "off" && (await prisma.pushSubscription.count({ where: { userId: T.id } })) === 0 && (await page.evaluate(() => (window as any).__push.unsubscribed)) === 1, 30000);

  section("Máy chủ từ chối thì không để lại đăng ký mồ côi");
  await page.route("**/api/push/subscribe", route => { if (route.request().method() === "POST") void route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Tối đa 10 thiết bị. Hãy gỡ bớt thiết bị không dùng rồi thử lại." }) }); else void route.continue(); });
  await here(page).getByRole("button", { name: "Bật trên máy này" }).click();
  await page.getByText(/Tối đa 10 thiết bị/).waitFor({ timeout: 15000 });
  check("báo lỗi đúng chữ của máy chủ; trạng thái vẫn 'off'; đăng ký vừa tạo ở trình duyệt đã bị huỷ (không mồ côi)", await stateOf(page) === "off" && (await page.evaluate(() => (window as any).__push.sub)) === null && (await page.evaluate(() => (window as any).__push.unsubscribed)) === 2);
  await page.unroute("**/api/push/subscribe");

  check("không lỗi trang / console (ngoài 409 cố ý)", errors.length === 0, errors.slice(0, 3));

  section("Trình duyệt chặn thông báo");
  const blocked = await open({ permission: "denied" });
  check("trạng thái 'blocked': nói rõ cách mở lại, có nút Thử lại, KHÔNG có nút Bật; việc vẫn hiện ở Hộp việc", await stateOf(blocked.page) === "blocked" && await blocked.page.getByText(/ổ khoá cạnh địa chỉ trang/).isVisible() && await blocked.page.getByRole("button", { name: "Thử lại" }).isVisible()
    && (await blocked.page.getByRole("button", { name: "Bật trên máy này" }).count()) === 0 && await blocked.page.getByText(/Hộp việc và thanh số đỏ/).isVisible());
  await shot(blocked.page, "push-settings-blocked");

  section("Người dùng từ chối ở hộp xin quyền");
  const deny = await open({ permission: "default", onRequest: "denied" });
  await here(deny.page).getByRole("button", { name: "Bật trên máy này" }).click();
  await eventually("báo 'đang chặn', chuyển sang 'blocked', DB không có thiết bị", async () => (await stateOf(deny.page)) === "blocked" && (await prisma.pushSubscription.count({ where: { userId: T.id } })) === 0, 20000);

  section("Trình duyệt không hỗ trợ / iPhone chưa cài vào Màn hình chính");
  const unsup = await open({ noPush: true });
  check("không có PushManager → 'unsupported' + nói trình duyệt không hỗ trợ; không có nút Bật", await stateOf(unsup.page) === "unsupported" && await unsup.page.getByText(/không hỗ trợ thông báo đẩy/).isVisible() && (await unsup.page.getByRole("button", { name: "Bật trên máy này" }).count()) === 0);
  const ios = await open({ noPush: true, ua: IPHONE });
  check("iPhone chưa Thêm vào Màn hình chính → 'ios-install' + hướng dẫn; không nói 'không hỗ trợ'", await stateOf(ios.page) === "ios-install" && await ios.page.getByText(/Thêm vào Màn hình chính/).first().isVisible() && (await ios.page.getByText(/Trình duyệt này không hỗ trợ/).count()) === 0);

  section("Điện thoại (390px)");
  const mob = await open({}, { width: 390, height: 800 });
  check("không tràn ngang", await mob.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const bb = await here(mob.page).getByRole("button", { name: "Bật trên máy này" }).boundingBox();
  const sb = await mob.page.locator("#thong-bao-day").getByRole("switch", { name: "Báo nghỉ sát giờ" }).boundingBox();
  check("nút Bật cao ≥ 44px; công tắc đủ lớn để chạm (≥ 20px, cả dòng ≥ 44px)", !!bb && bb.height >= 44 && !!sb && sb.width >= 20, { bb, sb });
  await shot(mob.page, "push-settings-mobile");

  check("không lỗi trang ở các lần mở còn lại", [blocked, deny, unsup, ios, mob].every(x => x.errors.length === 0), [blocked, deny, unsup, ios, mob].flatMap(x => x.errors).slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
