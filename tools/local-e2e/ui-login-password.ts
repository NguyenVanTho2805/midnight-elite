// Đăng nhập bằng TÀI KHOẢN + MẬT KHẨU — màn hình thật (14/10/2026: đường chính, mã 6 số là tab bên cạnh). Xem cả luồng mã ở ui-login-code.
import bcrypt from "bcryptjs";
import { BASE, mkTutor, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const RUN = Math.floor(Math.random() * 90_000_000) + 10_000_000;
let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.77.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`; // mỗi trang một IP: không vướng giới hạn theo IP giữa các kịch bản
const PW = "Passw0rd!";

(async () => {
  await wipe();
  await launch();
  const errors: string[] = [];
  const open = async (path: string, o: { width?: number; height?: number } = {}) => {
    const ctx = await ctxFor(null, { width: o.width ?? 1280, height: o.height ?? 900 });
    await ctx.setExtraHTTPHeaders({ "x-forwarded-for": nextIp() });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration|401|429|403/i.test(m.text())) errors.push(m.text()); });
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
    return p;
  };
  const A = (p: any) => p.locator('[role="alert"]:not(#__next-route-announcer__)');
  const acct = (p: any) => p.getByLabel(/Số điện thoại hoặc email|^Email$/);
  const pass = (p: any) => p.locator("#dn-pass"); // KHÔNG dùng getByLabel: vùng tab cũng có tên "Mật khẩu" (aria-labelledby tới tab) nên bị trùng
  const submit = (p: any) => p.getByRole("button", { name: "Đăng nhập", exact: true });

  section("Màn đầu: tab 'Mật khẩu' là mặc định");
  const U = await mkUser({ name: "Nguyễn Minh Anh" });
  const p0 = await open("/dang-nhap");
  await p0.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 90000 });
  const tabs = p0.getByRole("tablist", { name: "Cách đăng nhập" });
  check("có dải tab 'Cách đăng nhập' với đúng hai tab: Mật khẩu, Mã một lần", await tabs.getByRole("tab").count() === 2 && await tabs.getByRole("tab").allInnerTexts().then((t: string[]) => t.join("|") === "Mật khẩu|Mã một lần"));
  check("tab 'Mật khẩu' đang chọn (aria-selected), tab 'Mã một lần' không", await tabs.getByRole("tab", { name: "Mật khẩu" }).getAttribute("aria-selected") === "true" && await tabs.getByRole("tab", { name: "Mã một lần" }).getAttribute("aria-selected") === "false");
  const panel = p0.getByRole("tabpanel");
  check("khung nội dung là tabpanel, gắn đúng tab đang chọn", await panel.count() === 1 && await panel.getAttribute("aria-labelledby") === "dn-tab-mat-khau");
  check("có ô tài khoản + ô mật khẩu + nút 'Đăng nhập'", await acct(p0).isVisible() && await pass(p0).isVisible() && await submit(p0).isVisible());
  check("ô tài khoản autocomplete=username, ô mật khẩu autocomplete=current-password + type=password (trình quản lý mật khẩu nhận ra)", await acct(p0).getAttribute("autocomplete") === "username" && await pass(p0).getAttribute("autocomplete") === "current-password" && await pass(p0).getAttribute("type") === "password");
  check("ô tài khoản được focus sẵn", await acct(p0).evaluate((e: any) => e === document.activeElement));
  const sb = await submit(p0).boundingBox();
  check("nút cao 48px, nền navy #1e3a8a, chữ trắng", sb?.height === 48 && await submit(p0).evaluate((e: any) => { const s = getComputedStyle(e); return s.backgroundColor === "rgb(30, 58, 138)" && s.color === "rgb(255, 255, 255)"; }), sb);
  check("hai ô nhập cao 48px", (await acct(p0).boundingBox())?.height === 48 && (await pass(p0).boundingBox())?.height === 48);
  check("link 'Quên mật khẩu?' → /quen-mat-khau, 'Đăng ký ngay' → /dang-ky", (await p0.getByRole("link", { name: "Quên mật khẩu?" }).getAttribute("href")) === "/quen-mat-khau" && (await p0.getByRole("link", { name: "Đăng ký ngay" }).getAttribute("href")) === "/dang-ky");
  check("giữ nút 'Tôi có mã mời vào lớp' + khung 'Phụ huynh thì không cần đăng nhập' (Figma 32:19, 32:21)", (await p0.getByRole("link", { name: "Tôi có mã mời vào lớp" }).getAttribute("href")) === "/student/nhap-ma-lop" && await p0.getByText("Phụ huynh thì không cần đăng nhập").isVisible());
  const body = await p0.locator("body").innerText();
  check("KHÔNG còn chữ 'KiN không dùng mật khẩu' / 'Vì sao không có mật khẩu' (Figma 32:14/32:25 trái quyết định 14/10)", !/không dùng mật khẩu/i.test(body) && !/Vì sao không có mật khẩu/i.test(body));
  check("không tràn ngang", await p0.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(p0, "login-pw-1-default");

  section("Hiện / Ẩn mật khẩu");
  await pass(p0).fill("bi-mat-123");
  const eye = p0.getByRole("button", { name: "Hiện" });
  check("nút 'Hiện' (aria-pressed=false) cao 44px", await eye.getAttribute("aria-pressed") === "false" && (await eye.boundingBox())?.height === 44);
  await eye.click();
  check("bấm 'Hiện' → ô thành chữ thường, nút đổi thành 'Ẩn' (aria-pressed=true)", await pass(p0).getAttribute("type") === "text" && await p0.getByRole("button", { name: "Ẩn" }).getAttribute("aria-pressed") === "true");
  await p0.getByRole("button", { name: "Ẩn" }).click();
  check("bấm 'Ẩn' → ô trở lại dạng mật khẩu", await pass(p0).getAttribute("type") === "password");

  section("Lỗi: để trống, sai mật khẩu, tài khoản lạ");
  await acct(p0).fill(""); await pass(p0).fill("");
  await submit(p0).click();
  check("để trống rồi bấm → 'Vui lòng nhập tài khoản và mật khẩu' (role=alert)", await A(p0).getByText("Vui lòng nhập tài khoản và mật khẩu").isVisible());
  await acct(p0).fill(U.email);
  await pass(p0).fill("sai-mat-khau");
  await submit(p0).click();
  await eventually("sai mật khẩu → 'Email hoặc mật khẩu không đúng' màu đỏ #dc2626", async () => await A(p0).getByText("Email hoặc mật khẩu không đúng").evaluate((e: any) => getComputedStyle(e).color === "rgb(220, 38, 38)"));
  check("nút bấm lại được sau lỗi (không kẹt 'Đang đăng nhập…')", await submit(p0).isEnabled());
  await acct(p0).fill(`khong.co.${RUN}@test.local`);
  await submit(p0).click();
  await eventually("email lạ → cùng một câu (không lộ ai có tài khoản)", async () => (await A(p0).innerText()).trim() === "Email hoặc mật khẩu không đúng");
  await shot(p0, "login-pw-2-wrong");

  section("Đăng nhập đúng bằng bàn phím (Enter) → vào khu học viên");
  await acct(p0).fill(U.email);
  await pass(p0).fill(PW);
  await pass(p0).press("Enter");
  await p0.waitForURL(/\/student\//, { timeout: 120000 });
  const me = await p0.evaluate(async () => (await fetch("/api/auth/me")).json());
  check("vào khu học viên, /api/auth/me trả đúng người", /\/student\//.test(p0.url()) && me.email === U.email, me);
  await p0.context().close();

  section("Quay lại đúng trang đang định vào + chặn chuyển hướng ra ngoài");
  const G = await mkUser({ name: "Quay lại" });
  const p1 = await open("/student/lich-hoc");
  await p1.waitForURL(/\/dang-nhap\?redirect=/, { timeout: 60000 });
  check("trang cần đăng nhập → /dang-nhap?redirect=… và vẫn mở ở tab 'Mật khẩu'", await p1.getByRole("tab", { name: "Mật khẩu" }).getAttribute("aria-selected") === "true");
  await acct(p1).fill(G.email); await pass(p1).fill(PW); await submit(p1).click();
  await eventually("đăng nhập xong → quay lại /student/lich-hoc", async () => new URL(p1.url()).pathname === "/student/lich-hoc");
  await p1.context().close();
  for (const evil of ["https://evil.example/phish", "//evil.example/phish"]) {
    const X = await mkUser({ name: "Mở link lạ" });
    const px = await open(`/dang-nhap?redirect=${encodeURIComponent(evil)}`);
    await acct(px).fill(X.email); await pass(px).fill(PW); await submit(px).click();
    await px.waitForURL(/\/student\//, { timeout: 120000 });
    check(`redirect=${evil} bị bỏ qua: vẫn ở localhost, vào khu học viên`, new URL(px.url()).hostname === "localhost" && /\/student\//.test(px.url()), px.url());
    await px.context().close();
  }

  section("Gia sư vào đúng không gian của gia sư");
  const T = await mkTutor("Cô Lan");
  const pt = await open("/dang-nhap");
  await acct(pt).fill(T.email); await pass(pt).fill(PW); await submit(pt).click();
  await pt.waitForURL(/\/lop-cua-toi/, { timeout: 120000 });
  check("gia sư → /lop-cua-toi", /\/lop-cua-toi/.test(pt.url()), pt.url());
  await pt.context().close();

  section("Số điện thoại làm tài khoản (môi trường test đã bật SMS nên ô nhận cả hai)");
  const Ph = await mkUser({ name: "Có số xác minh" });
  const num = `09${String(RUN).slice(-8)}`;
  await prisma.user.update({ where: { id: Ph.id }, data: { phone: num, phoneE164: `+84${num.slice(1)}`, phoneVerifiedAt: new Date() } });
  const pp = await open("/dang-nhap");
  check("nhãn ô là 'Số điện thoại hoặc email'", await pp.getByLabel("Số điện thoại hoặc email").isVisible());
  await acct(pp).fill(`${num.slice(0, 4)} ${num.slice(4, 7)} ${num.slice(7)}`); await pass(pp).fill("sai"); await submit(pp).click();
  await eventually("số + sai mật khẩu → 'Số điện thoại hoặc mật khẩu không đúng'", async () => await A(pp).getByText("Số điện thoại hoặc mật khẩu không đúng").isVisible());
  await pass(pp).fill(PW); await submit(pp).click();
  await pp.waitForURL(/\/student\//, { timeout: 120000 });
  check("số đã xác minh (gõ có dấu cách) + mật khẩu đúng → vào được", /\/student\//.test(pp.url()));
  await pp.context().close();

  section("Chuyển tab: giữ chữ đã gõ, bàn phím, mở thẳng tab mã");
  const p2 = await open("/dang-nhap");
  await acct(p2).fill("giu-lai@test.local"); await pass(p2).fill("khong-duoc-lo");
  await p2.getByRole("tab", { name: "Mã một lần" }).click();
  check("sang 'Mã một lần': thấy 'Gửi mã đăng nhập', ô tài khoản giữ chữ, KHÔNG còn ô mật khẩu trong trang", await p2.getByRole("button", { name: "Gửi mã đăng nhập" }).isVisible() && await acct(p2).inputValue() === "giu-lai@test.local" && await pass(p2).count() === 0);
  check("tabpanel đổi theo (aria-labelledby = tab mã)", await p2.getByRole("tabpanel").getAttribute("aria-labelledby") === "dn-tab-ma");
  await p2.getByRole("tab", { name: "Mã một lần" }).focus();
  await p2.keyboard.press("ArrowLeft");
  await eventually("sau mũi tên trái, tiêu điểm Ở LẠI trên dải tab (không bị ô nhập mới giành mất — lỗi đã sửa)", async () => await p2.evaluate(() => document.activeElement?.getAttribute("role") === "tab"));
  check("phím mũi tên trái ở tab → về 'Mật khẩu' và focus theo", await p2.getByRole("tab", { name: "Mật khẩu" }).getAttribute("aria-selected") === "true" && await p2.getByRole("tab", { name: "Mật khẩu" }).evaluate((e: any) => e === document.activeElement));
  await p2.keyboard.press("End");
  check("phím End → tab cuối ('Mã một lần')", await p2.getByRole("tab", { name: "Mã một lần" }).getAttribute("aria-selected") === "true");
  const roving = await p2.getByRole("tab").evaluateAll((els: any[]) => els.map(e => e.tabIndex).join(","));
  check("chỉ tab đang chọn nằm trong thứ tự Tab (roving tabindex)", roving === "-1,0", roving);
  await p2.context().close();
  const p3 = await open("/dang-nhap?cach=ma");
  check("/dang-nhap?cach=ma mở thẳng tab 'Mã một lần'", await p3.getByRole("tab", { name: "Mã một lần" }).getAttribute("aria-selected") === "true" && await p3.getByRole("button", { name: "Gửi mã đăng nhập" }).isVisible());
  await p3.context().close();

  section("Bị chặn tạm (429): mời sang mã một lần");
  const p4 = await open("/dang-nhap");
  await p4.route("**/api/auth/login", r => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Bạn đã nhập sai nhiều lần. Thử lại sau 15 phút, hoặc đăng nhập bằng mã một lần.", code: "wait", retryAfterSec: 900 }) }));
  await acct(p4).fill(U.email); await pass(p4).fill("x"); await submit(p4).click();
  await eventually("hiện câu chặn tạm của máy chủ + nút 'Đăng nhập bằng mã một lần'", async () => await A(p4).getByText(/Thử lại sau 15 phút/).isVisible() && await A(p4).getByRole("button", { name: "Đăng nhập bằng mã một lần" }).isVisible());
  await A(p4).getByRole("button", { name: "Đăng nhập bằng mã một lần" }).click();
  check("bấm nút đó → sang tab mã, câu báo biến mất", await p4.getByRole("tab", { name: "Mã một lần" }).getAttribute("aria-selected") === "true" && await A(p4).count() === 0);
  await p4.context().close();

  section("Mất mạng giữa chừng: không kẹt ở 'Đang đăng nhập…'");
  const p5 = await open("/dang-nhap");
  await p5.route("**/api/auth/login", r => r.abort("failed"));
  await acct(p5).fill(U.email); await pass(p5).fill(PW); await submit(p5).click();
  await eventually("báo 'Không có kết nối' và nút bấm lại được", async () => await A(p5).getByText(/Không có kết nối/).isVisible() && await submit(p5).isEnabled());
  await p5.context().close();

  section("Điện thoại 390px");
  const pm = await open("/dang-nhap", { width: 390, height: 844 });
  check("không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const tiny = await pm.evaluate(`[...document.querySelectorAll('main button, main input, main [role=tab], main a')].filter(e => e.offsetParent && /^(Đăng nhập|Mật khẩu|Mã một lần|Hiện|Quên mật khẩu\\?|Tôi có mã mời vào lớp)$/.test((e.textContent || '').trim() || e.getAttribute('aria-label') || '') ).filter(e => e.getBoundingClientRect().height < 44).map(e => (e.textContent || '').trim())`) as string[];
  check("nút / tab / link chính đều cao ≥ 44px (chạm được)", tiny.length === 0, tiny);
  const inputs = await pm.locator("#dn-id-pw, #dn-pass").evaluateAll((els: any[]) => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("hai ô nhập (tài khoản, mật khẩu) cao 48px", inputs.length === 2 && inputs.every((h: number) => h === 48), inputs);
  await shot(pm, "login-pw-3-mobile");
  await pm.context().close();

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
