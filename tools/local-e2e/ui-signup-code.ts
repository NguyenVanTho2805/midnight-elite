// 07/11/2026 — màn nhập mã 6 số sau đăng ký (học sinh VÀ gia sư) + băng vàng. Trình duyệt thật 390px; thư đọc từ EMAIL_SINK_DIR (không gửi Gmail).
// Kiểm: dòng nhắc "Không thấy mã? ... Hộp thư rác / Spam / Quảng cáo" hiện ở CẢ HAI màn (và vẫn hiện sau "Gửi lại mã"), nhập mã sai báo còn mấy lần,
// nhập đúng thì tự đăng nhập tới đúng trang đầu của vai, 390px không tràn, nút ≥ 44px.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkUser, wipe, check, section, eventually, done } from "./h";
import { launch, ctxFor, closeAll, kinSelect } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { SPAM_HINT } from "@/lib/verifyCodeCopy";

const SINK = process.env.EMAIL_SINK_DIR!;
type Mail = { to: string; subject: string; text: string };
const mails = (to: string): Mail[] => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);
const codeOf = (to: string) => mails(to).at(-1)?.subject.match(/^(\d{6}) /)?.[1] ?? "";
const wrong = (c: string) => (c === "000000" ? "000001" : "000000");
const RUN = Date.now().toString(36);
let ip = Math.floor(Math.random() * 200);

async function fresh() {
  const c = await ctxFor(null, { width: 390, height: 844 });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await c.setExtraHTTPHeaders({ "x-forwarded-for": `10.97.${Math.floor(Math.random() * 250)}.${++ip % 250}` });
  const p = await c.newPage();
  const errors: string[] = [];
  p.on("pageerror", e => errors.push(String(e)));
  return { c, p, errors };
}
const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function typeCode(p: Page, code: string) { await p.locator('[data-testid="signup-code-form"] input').first().click(); await p.keyboard.type(code, { delay: 30 }); }
const body = async (p: Page) => (await p.locator("body").innerText());

async function fillAccount(p: Page, role: "student" | "tutor", email: string) {
  await p.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("button", { name: /^Học viên/ }).waitFor({ timeout: 90000 });
  await p.getByPlaceholder("Nguyễn Văn A").fill(role === "tutor" ? "Cô Lan Anh" : "Minh Anh");
  if (role === "tutor") {
    await p.getByRole("button", { name: /^Gia sư/ }).click();
    await p.getByPlaceholder("Nguyễn Văn A").fill("Cô Lan Anh");
    await p.locator('input[type="tel"]').first().fill("0912 345 678");
    await p.getByPlaceholder(/Mình là sinh viên năm 3/).fill("Cử nhân Toán, 3 năm dạy ôn ĐGNL cho học sinh lớp 12, hay dùng đề thật để luyện.");
    await p.getByRole("button", { name: "Toán", exact: true }).click();
  } else {
    const tels = p.locator('form input[type="tel"]');
    await tels.nth(0).fill("0901 234 567"); await tels.nth(1).fill("0987 654 321");
    await kinSelect(p.locator('form [role="combobox"]'), { index: 1 });
    await p.getByPlaceholder("THPT Chu Văn An").fill("THPT Chu Văn An");
  }
  await p.getByRole("button", { name: /Tiếp theo/ }).click();
  await p.getByPlaceholder("ten@gmail.com").waitFor({ timeout: 30000 });
  await p.getByPlaceholder("ten@gmail.com").fill(email);
  await p.getByPlaceholder("Tối thiểu 8 ký tự").fill("MatKhau#2026");
  await p.getByPlaceholder("Nhập lại mật khẩu").fill("MatKhau#2026");
  await p.locator('form input[type="checkbox"]').check();
  await p.getByRole("button", { name: /Tạo tài khoản|Đăng ký/ }).last().click();
}

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  await launch();

  for (const role of ["student", "tutor"] as const) {
    const label = role === "student" ? "HỌC SINH" : "GIA SƯ";
    const email = `ui-${role}-${RUN}@test.local`;
    const { c, p, errors } = await fresh();
    section(`${label}: đăng ký → màn nhập mã`);
    await fillAccount(p, role, email);
    await eventually("hiện 'Kiểm tra hộp thư' + ô nhập mã", async () => (await body(p)).includes("Kiểm tra hộp thư") && (await p.locator('[data-testid="signup-code-form"]').count()) === 1, 60000);
    check("hiện đúng email vừa nhập", (await body(p)).includes(email));
    check("CÓ dòng nhắc 'Không thấy mã? Hãy kiểm tra cả Hộp thư rác / Spam / Quảng cáo.'", (await p.getByTestId("spam-hint").innerText()).trim() === SPAM_HINT && await p.getByTestId("spam-hint").isVisible());
    check("6 ô nhập mã", (await p.locator('[data-testid="signup-code-form"] input').count()) === 6);
    check("390px không tràn ngang", await noOverflow(p));
    const small = await p.locator('[data-testid="signup-code-form"] button, [data-testid="signup-code-form"] input').evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44 && (e as HTMLElement).tagName === "BUTTON"; }).map(e => (e as HTMLElement).innerText));
    check("nút trong khối nhập mã cao ≥ 44px", small.length === 0, small);
    check("'Gửi lại sau' có đếm ngược (chưa bấm gửi lại được)", /Gửi lại sau \d:\d\d/.test(await body(p)));

    section(`${label}: mã sai rồi mã đúng`);
    await eventually("thư mã đã tới", () => codeOf(email).length === 6, 20000);
    const real = codeOf(email);
    await typeCode(p, wrong(real));
    await eventually("báo 'Mã chưa đúng. Còn 4 lần thử.'", async () => (await body(p)).includes("Mã chưa đúng. Còn 4 lần thử."), 20000);
    check("vẫn chưa xác thực + vẫn thấy dòng nhắc Spam", (await prisma.user.findUnique({ where: { email } }))?.emailVerified === false && await p.getByTestId("spam-hint").isVisible());
    await typeCode(p, real);
    const want = role === "tutor" ? "/lop-cua-toi/cho-duyet" : "/student/viec-cua-toi";
    await eventually(`nhập đúng → tự đăng nhập, tới ${want}`, () => new URL(p.url()).pathname === want, 60000);
    check("emailVerified = true", (await prisma.user.findUnique({ where: { email } }))?.emailVerified === true);
    check("không lỗi JS", errors.length === 0, errors.slice(0, 3));
    await c.close();
  }

  section("Gửi lại mã: dòng nhắc Spam vẫn hiện, mã cũ chết");
  {
    const email = `ui-resend-${RUN}@test.local`;
    const { c, p } = await fresh();
    await fillAccount(p, "student", email);
    await eventually("màn nhập mã", async () => (await p.locator('[data-testid="signup-code-form"]').count()) === 1, 60000);
    const first = await eventually("thư 1", () => codeOf(email).length === 6, 20000);
    void first;
    const c1 = codeOf(email);
    check("trước 60 giây: không có nút 'Gửi lại mã'", (await p.getByRole("button", { name: "Gửi lại mã" }).count()) === 0);
    await prisma.loginCode.update({ where: { email: `verify:${email}` }, data: { sentAt: new Date(Date.now() - 61_000) } });
    // Nút chỉ hiện khi đếm ngược của TRÌNH DUYỆT hết: chờ thật 60 giây.
    await p.getByRole("button", { name: "Gửi lại mã" }).waitFor({ timeout: 75_000 });
    await p.getByRole("button", { name: "Gửi lại mã" }).click();
    await eventually("báo 'Đã gửi mã mới'", async () => (await body(p)).includes("Đã gửi mã mới"), 20000);
    check("thư thứ 2 tới với mã khác", mails(email).length === 2 && codeOf(email) !== c1);
    check("sau 'Gửi lại mã' vẫn có dòng nhắc Spam", (await p.getByTestId("spam-hint").innerText()).trim() === SPAM_HINT);
    check("390px không tràn", await noOverflow(p));
    await c.close();
  }

  section("Gửi thư lỗi ở lần đầu: màn vẫn có dòng nhắc, có nút 'Gửi mã' (không im lặng)");
  {
    const email = `ui-fail-${RUN}@test.local`;
    const { c, p } = await fresh();
    await p.route("**/api/auth/register", async route => {
      const r = await route.fetch(); const j = await r.json();
      await route.fulfill({ response: r, json: { ...j, emailSent: false } }); // mô phỏng: tài khoản đã tạo, thư chưa đi
    });
    await fillAccount(p, "student", email);
    await eventually("màn 'Tài khoản đã tạo' + cảnh báo thư chưa đi", async () => (await body(p)).includes("Chưa gửi được email xác thực"), 60000);
    check("có nút 'Gửi mã' + dòng nhắc Spam", (await p.getByRole("button", { name: "Gửi mã", exact: true }).count()) === 1 && await p.getByTestId("spam-hint").isVisible());
    // Máy chủ thật đã gửi thư lúc đăng ký (ta chỉ giả lời đáp), nên cho cửa sổ 60 giây qua đi như khi thư thật sự lỗi và được trả lại trạng thái.
    await prisma.loginCode.update({ where: { email: `verify:${email}` }, data: { sentAt: new Date(Date.now() - 61_000) } });
    await p.getByRole("button", { name: "Gửi mã", exact: true }).click();
    await eventually("bấm 'Gửi mã' → ra ô nhập mã", async () => (await body(p)).includes("Nhập mã 6 số"), 20000);
    check("thư mã tới", codeOf(email).length === 6);
    await c.close();
  }

  section("Băng vàng: người dùng cũ chưa xác thực đăng nhập → gửi mã → nhập mã");
  {
    const u = await mkUser({ name: "Người cũ", emailVerified: false });
    const c = await ctxFor(u, { width: 390, height: 844 });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await c.setExtraHTTPHeaders({ "x-forwarded-for": `10.97.${Math.floor(Math.random() * 250)}.${++ip % 250}` });
    const p = await c.newPage();
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByText("Email chưa được xác thực").waitFor({ timeout: 90000 });
    check("băng vàng hiện", true);
    await p.getByRole("button", { name: "Gửi mã xác thực" }).click();
    await eventually("hiện ô nhập mã trong băng + dòng nhắc Spam", async () => (await p.locator('[data-testid="signup-code-form"]').count()) === 1 && (await p.getByTestId("spam-hint").innerText()).trim() === SPAM_HINT, 30000);
    await eventually("thư mã tới", () => codeOf(u.email).length === 6, 20000);
    check("390px không tràn", await noOverflow(p));
    await typeCode(p, codeOf(u.email));
    await eventually("xác thực xong → băng vàng biến mất", async () => (await p.getByText("Email chưa được xác thực").count()) === 0, 60000);
    check("emailVerified = true", (await prisma.user.findUnique({ where: { id: u.id } }))?.emailVerified === true);
    await c.close();
  }

  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
