// Đăng nhập bằng mã 6 số qua email — màn hình thật (Figma 21:9: 32:2 nhập email, 32:27 nhập mã). Thư đọc từ EMAIL_SINK_DIR.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
type Mail = { to: string; subject: string; text: string };
const mails = (to: string): Mail[] => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);
const codeOf = (to: string) => mails(to).at(-1)?.text.match(/của bạn: (\d{6})/)?.[1] ?? "";
const wrongOf = (c: string) => (c === "000000" ? "000001" : "000000");

let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.88.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`; // mỗi trang một IP riêng: không vướng giới hạn theo IP giữa các kịch bản

const eventually2 = async (fn: () => Promise<boolean>, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } return false; };

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  await launch();
  const errors: string[] = [];
  const open = async (path: string, o: { width?: number; height?: number; clock?: boolean } = {}) => {
    const ctx = await ctxFor(null, { width: o.width ?? 1280, height: o.height ?? 900 });
    await ctx.setExtraHTTPHeaders({ "x-forwarded-for": nextIp() });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration|401|429|403/i.test(m.text())) errors.push(m.text()); });
    if (o.clock) await p.clock.install({ time: new Date() });
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
    return p;
  };
  // Hộp thông báo của trang (loại thẻ role="alert" của bộ thông báo chuyển trang do Next tự thêm).
  const A = (p: any) => p.locator('[role="alert"]:not(#__next-route-announcer__)');
  const boxes = (p: any) => p.getByRole("group", { name: "Mã 6 số" }).locator("input");
  const typeCode = async (p: any, c: string) => { await boxes(p).first().focus(); await p.keyboard.type(c, { delay: 25 }); };

  section("Màn nhập email (Figma 32:2)");
  const p0 = await open("/dang-nhap?cach=ma");
  await p0.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 90000 });
  // 24/10/2026 (TK-02, Figma 464:9828): logo nằm ở thanh trên của trang khách; trong trang là tiêu đề "Đăng nhập KiN" + dòng phụ, không lặp logo/câu giới thiệu trong thẻ.
  check("có tiêu đề 'Đăng nhập KiN' + dòng phụ 'Dành cho gia sư và học sinh' (logo ở thanh trên)", await p0.getByRole("heading", { name: "Đăng nhập KiN", level: 1 }).isVisible() && await p0.getByText("Dành cho gia sư và học sinh").isVisible() && await p0.locator("header svg, nav svg").first().isVisible());
  check("một ô Email + nút 'Gửi mã đăng nhập'", await p0.getByLabel("Email").isVisible() && await p0.getByRole("button", { name: "Gửi mã đăng nhập" }).isVisible());
  check("không còn ô mật khẩu ở màn đầu", await p0.getByLabel("Mật khẩu").count() === 0);
  const send0 = p0.getByRole("button", { name: "Gửi mã đăng nhập" });
  const b0 = await send0.boundingBox();
  check("nút cao 48px, nền navy #1e3a8a, chữ trắng", b0?.height === 48 && await send0.evaluate((e: any) => { const s = getComputedStyle(e); return s.backgroundColor === "rgb(30, 58, 138)" && s.color === "rgb(255, 255, 255)"; }), b0);
  check("ô email cao 48px, viền #8b95a5 (đạt 3:1) khi chưa focus", await p0.getByLabel("Email").evaluate((e: any) => { (e as HTMLElement).blur(); return e.getBoundingClientRect().height === 48; }) && await eventually2(async () => await p0.getByLabel("Email").evaluate((e: any) => getComputedStyle(e).borderTopColor === "rgb(139, 149, 165)")));
  check("chữ giải thích: mã 6 số dùng một lần", await p0.getByText(/mã 6 số dùng một lần/).isVisible());
  check("nút 'Tôi có mã mời vào lớp' → /student/nhap-ma-lop", (await p0.getByRole("link", { name: "Tôi có mã mời vào lớp" }).getAttribute("href")) === "/student/nhap-ma-lop");
  check("khung 'Phụ huynh thì không cần đăng nhập' + link tìm hiểu", await p0.getByText("Phụ huynh thì không cần đăng nhập").isVisible() && (await p0.getByRole("link", { name: "Tìm hiểu thêm" }).getAttribute("href")) === "/phu-huynh");
  check("tab 'Mã một lần' đang mở (?cach=ma), tab 'Mật khẩu' ngay cạnh, và link 'Đăng ký ngay'", await p0.getByRole("tab", { name: "Mã một lần" }).getAttribute("aria-selected") === "true" && await p0.getByRole("tab", { name: "Mật khẩu" }).isVisible() && (await p0.getByRole("link", { name: "Đăng ký ngay" }).getAttribute("href")) === "/dang-ky");
  check("không tràn ngang", await p0.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(p0, "login-code-1-email");
  await send0.click();
  check("để trống email rồi bấm gửi → báo 'Vui lòng nhập số điện thoại hoặc email' (môi trường test có SMS nên ô nhận cả hai)", await A(p0).getByText("Vui lòng nhập số điện thoại hoặc email").isVisible());
  await p0.getByLabel("Email").fill("khong-phai-email");
  await send0.click();
  await eventually("email sai dạng → báo 'Nhập số điện thoại hoặc email hợp lệ' từ máy chủ", async () => await A(p0).getByText("Nhập số điện thoại hoặc email hợp lệ").isVisible());
  check("chưa có thư nào gửi đi", readdirSync(SINK).length === 0);

  section("Gửi mã → màn nhập mã (Figma 32:27)");
  const U = await mkUser({ name: "Nguyễn Minh Anh" });
  await p0.getByLabel("Email").fill(U.email.toUpperCase());
  await send0.click();
  await p0.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  check("hiện email (chữ thường) + 'mã sống 10 phút'", await p0.getByText(U.email, { exact: true }).isVisible() && await p0.getByText(/mã sống 10 phút/).isVisible());
  check("sáu ô nhập, ô đầu được focus", await boxes(p0).count() === 6 && await boxes(p0).first().evaluate((e: any) => e === document.activeElement));
  check("ô đầu gợi ý mã từ tin nhắn (one-time-code), kiểu số", await boxes(p0).first().getAttribute("autocomplete") === "one-time-code" && await boxes(p0).first().getAttribute("inputmode") === "numeric");
  const bb = await boxes(p0).first().boundingBox();
  check("ô cao 56px", bb?.height === 56, bb);
  check("'Gửi lại sau 0:5x/1:00' và chưa có nút gửi lại", await p0.getByText(/Gửi lại sau (0:5\d|1:00)/).isVisible() && await p0.getByRole("button", { name: "Gửi lại mã" }).count() === 0);
  check("nút Xác nhận tắt cho tới khi đủ 6 số", await p0.getByRole("button", { name: "Xác nhận" }).isDisabled());
  check("đã có đúng 1 thư gửi tới email", mails(U.email).length === 1);
  await shot(p0, "login-code-2-code");

  section("Gõ phím: tự nhảy ô, Backspace lùi ô");
  await boxes(p0).first().focus();
  await p0.keyboard.type("12", { delay: 30 });
  const vals = async () => boxes(p0).evaluateAll((els: any[]) => els.map(e => (e as HTMLInputElement).value).join(","));
  check("gõ 1,2 → vào hai ô đầu, focus nhảy sang ô 3", (await vals()) === "1,2,,,," && await boxes(p0).nth(2).evaluate((e: any) => e === document.activeElement), await vals());
  await p0.keyboard.press("Backspace");
  check("Backspace ở ô trống → lùi và xoá ô trước", (await vals()) === "1,,,,," , await vals());
  await p0.keyboard.press("Backspace");
  check("Backspace tiếp → xoá ô 1", (await vals()) === ",,,,,", await vals());
  await boxes(p0).first().focus();
  await p0.keyboard.type("1a2", { delay: 30 });
  check("ký tự không phải số bị bỏ qua", (await vals()) === "1,2,,,,", await vals());

  section("Nhập sai mã");
  await p0.reload({ waitUntil: "networkidle" }); // quay lại màn email
  await p0.getByLabel("Email").fill(U.email);
  await p0.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p0.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  check("gửi lại ngay sau khi tải lại (còn trong 60 giây) vẫn sang màn nhập mã, không báo lỗi", await p0.getByText(/Gửi lại sau/).isVisible() && mails(U.email).length === 1, mails(U.email).length);
  const real = codeOf(U.email);
  await typeCode(p0, wrongOf(real));
  const alertBox = A(p0);
  await alertBox.waitFor({ timeout: 30000 });
  check("báo 'Mã không đúng — còn 4 lần thử' + giải thích khoá 15 phút", (await alertBox.innerText()).includes("Mã không đúng — còn 4 lần thử") && (await alertBox.innerText()).includes("khoá đăng nhập email này trong 15 phút"), await alertBox.innerText());
  check("tự gửi khi gõ đủ 6 số (không cần bấm Xác nhận)", true);
  check("sáu ô viền đỏ #dc2626 và được xoá để nhập lại", await eventually2(async () => await boxes(p0).evaluateAll((els: any[]) => els.every(e => getComputedStyle(e).borderTopColor === "rgb(220, 38, 38)" && (e as HTMLInputElement).value === ""))));
  check("focus quay về ô đầu", await boxes(p0).first().evaluate((e: any) => e === document.activeElement));
  check("tiêu đề lỗi màu đỏ #dc2626", await alertBox.locator("p").first().evaluate((e: any) => getComputedStyle(e).color === "rgb(220, 38, 38)"));
  await shot(p0, "login-code-3-wrong");
  await p0.keyboard.type("5");
  await eventually("gõ lại thì viền đỏ biến mất", async () => await boxes(p0).first().evaluate((e: any) => getComputedStyle(e).borderTopColor !== "rgb(220, 38, 38)"));

  section("Nhập đúng mã (dán cả mã) → vào, chuyển trang");
  await p0.reload({ waitUntil: "networkidle" });
  // sau reload quay về màn email; xin lại mã vẫn đang trong 60 giây nên dùng mã cũ
  await p0.getByLabel("Email").fill(U.email);
  await p0.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p0.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  await boxes(p0).first().focus();
  await p0.keyboard.insertText(`${real.slice(0, 3)} ${real.slice(3)}`);
  await p0.waitForURL(/\/student\//, { timeout: 120000 });
  check("đúng mã → vào khu học viên", /\/student\//.test(p0.url()), p0.url());
  const me = await p0.evaluate(async () => (await fetch("/api/auth/me")).json());
  check("phiên hợp lệ: /api/auth/me trả đúng người", me.email === U.email && me.name === "Nguyễn Minh Anh", me);
  await p0.context().close();

  section("Sai 5 lần → khoá, nói rõ 15 phút");
  const L = await mkUser({ name: "Lê Khánh Vy" });
  const p1 = await open("/dang-nhap?cach=ma");
  await p1.getByLabel("Email").fill(L.email);
  await p1.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p1.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  const lreal = codeOf(L.email);
  const left: string[] = [];
  for (let i = 0; i < 4; i++) {
    await typeCode(p1, wrongOf(lreal));
    await eventually(`sai lần ${i + 1}: còn ${4 - i} lần thử`, async () => (await A(p1).innerText()).includes(`còn ${4 - i} lần thử`));
    left.push(await A(p1).innerText());
  }
  await typeCode(p1, wrongOf(lreal));
  await eventually("sai lần 5 → báo đã khoá 15 phút", async () => /bị khoá/.test(await A(p1).innerText()) && /15 phút/.test(await A(p1).innerText()));
  await typeCode(p1, lreal);
  await eventually("đang khoá thì mã ĐÚNG cũng không vào được (vẫn ở màn nhập mã, báo khoá)", async () => /bị khoá/.test(await A(p1).innerText()) && !/\/student\//.test(p1.url()));
  await shot(p1, "login-code-4-locked");
  await p1.getByRole("button", { name: "Đổi email" }).click();
  await p1.getByLabel("Email").fill(L.email);
  await p1.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await eventually("xin mã khi đang khoá → ở màn email, báo khoá", async () => /bị khoá/.test(await A(p1).innerText()) && await p1.getByRole("heading", { name: "Đăng nhập", exact: true }).isVisible());
  await p1.context().close();

  section("Gửi lại mã (đồng hồ giả để khỏi chờ 60 giây thật)");
  const R = await mkUser({ name: "Phạm Quốc Huy" });
  const p2 = await open("/dang-nhap?cach=ma", { clock: true });
  await p2.getByLabel("Email").fill(R.email);
  await p2.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p2.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  check("lúc đầu chưa có nút 'Gửi lại mã'", await p2.getByRole("button", { name: "Gửi lại mã" }).count() === 0);
  await prisma.loginCode.update({ where: { email: R.email }, data: { sentAt: new Date(Date.now() - 61_000) } });
  await p2.clock.fastForward(61_000);
  await p2.getByRole("button", { name: "Gửi lại mã" }).waitFor({ timeout: 10000 });
  check("sau 60 giây hiện nút 'Gửi lại mã'", true);
  await p2.getByRole("button", { name: "Gửi lại mã" }).click();
  await eventually("bấm gửi lại → có thư thứ 2, đồng hồ đếm lại", async () => mails(R.email).length === 2 && await p2.getByText(/Gửi lại sau/).isVisible());
  const r2 = codeOf(R.email);
  await typeCode(p2, r2);
  await p2.waitForURL(/\/student\//, { timeout: 120000 });
  check("dùng mã mới → vào được", true);
  await p2.context().close();

  section("Email không có tài khoản: trải nghiệm y hệt (không lộ)");
  const p3 = await open("/dang-nhap?cach=ma");
  await p3.getByLabel("Email").fill(`nguoi.la.${Date.now().toString(36)}@khong-co.test`);
  await p3.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p3.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  check("vẫn sang màn nhập mã, có 'mã sống 10 phút' + đồng hồ gửi lại", await p3.getByText(/mã sống 10 phút/).isVisible() && await p3.getByText(/Gửi lại sau/).isVisible());
  await typeCode(p3, "123456");
  await eventually("nhập sai → 'Mã không đúng — còn 4 lần thử' như thật", async () => (await A(p3).innerText()).includes("còn 4 lần thử"));
  await p3.context().close();

  section("Chuyển giữa hai cách (đăng nhập bằng mật khẩu có bài test riêng: ui-login-password)");
  const p4 = await open("/dang-nhap");
  check("không có ?cach= thì mở tab 'Mật khẩu' (đường chính)", await p4.getByRole("tab", { name: "Mật khẩu" }).getAttribute("aria-selected") === "true" && await p4.locator("#dn-pass").isVisible());
  await p4.getByLabel("Email").fill("giu-lai@test.local");
  await p4.getByRole("tab", { name: "Mã một lần" }).click();
  check("sang tab 'Mã một lần': có nút 'Gửi mã đăng nhập', ô tài khoản giữ nguyên chữ đã gõ", await p4.getByRole("button", { name: "Gửi mã đăng nhập" }).isVisible() && await p4.getByLabel("Email").inputValue() === "giu-lai@test.local");
  await p4.context().close();

  section("Tài khoản bị khoá");
  const B = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  const p5 = await open("/dang-nhap?cach=ma");
  await p5.getByLabel("Email").fill(B.email);
  await p5.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p5.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  await typeCode(p5, codeOf(B.email));
  await eventually("đúng mã nhưng bị khoá → báo 'Tài khoản của bạn đã bị khóa'", async () => /bị khóa/.test(await A(p5).innerText()));
  check("không vào được", !/\/student\//.test(p5.url()));
  await p5.context().close();

  section("Quay lại đúng trang đang định vào + chặn chuyển hướng ra ngoài");
  const G = await mkUser({ name: "Quay lại" });
  const p6 = await open("/student/lich-hoc");
  await p6.waitForURL(/\/dang-nhap\?redirect=/, { timeout: 60000 });
  check("vào trang cần đăng nhập → /dang-nhap kèm ?redirect=trang đang định vào", decodeURIComponent(new URL(p6.url()).searchParams.get("redirect") ?? "") === "/student/lich-hoc", p6.url());
  await p6.getByRole("tab", { name: "Mã một lần" }).click();
  await p6.getByLabel("Email").fill(G.email);
  await p6.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await p6.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  await typeCode(p6, codeOf(G.email));
  await eventually("đăng nhập xong → quay lại /student/lich-hoc", async () => new URL(p6.url()).pathname === "/student/lich-hoc");
  await p6.context().close();
  for (const evil of ["https://evil.example/phish", "//evil.example/phish", "/\\evil.example"]) {
    const X = await mkUser({ name: "Mở link lạ" });
    const px = await open(`/dang-nhap?cach=ma&redirect=${encodeURIComponent(evil)}`);
    await px.getByLabel("Email").fill(X.email);
    await px.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
    await px.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
    await typeCode(px, codeOf(X.email));
    await px.waitForURL(/\/student\//, { timeout: 120000 });
    check(`redirect=${evil} bị bỏ qua: vẫn ở localhost, vào khu học viên`, new URL(px.url()).hostname === "localhost" && /\/student\//.test(px.url()), px.url());
    await px.context().close();
  }

  section("Điện thoại 390px");
  const M = await mkUser({ name: "Điện thoại" });
  const pm = await open("/dang-nhap?cach=ma", { width: 390, height: 844 });
  await pm.getByLabel("Email").fill(M.email);
  check("màn email không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "login-code-5-mobile-email");
  await pm.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await pm.getByRole("heading", { name: "Nhập mã 6 số" }).waitFor({ timeout: 30000 });
  const widths = await boxes(pm).evaluateAll((els: any[]) => els.map(e => Math.round(e.getBoundingClientRect().width)));
  check("sáu ô cùng rộng ≥ 44px (chạm được) trên 390px", widths.length === 6 && widths.every((w: number) => w >= 44), widths);
  check("màn nhập mã không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "login-code-6-mobile-code");
  await typeCode(pm, codeOf(M.email));
  await pm.waitForURL(/\/student\//, { timeout: 120000 });
  check("đăng nhập được trên điện thoại", /\/student\//.test(pm.url()));
  await pm.context().close();

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
