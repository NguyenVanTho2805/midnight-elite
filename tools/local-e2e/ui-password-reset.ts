// Quên mật khẩu — màn hình thật (15/10/2026): /dang-nhap → /quen-mat-khau → thư (đọc từ EMAIL_SINK_DIR) → /dat-lai-mat-khau → vào đúng trang của vai.
// Các lỗi cũ đã sửa: nhãn "Email" không gắn với ô nhập; link hết hạn chỉ biết sau khi gõ mật khẩu; đặt lại xong chuyển trang MỀM nên vẫn bị coi là chưa đăng nhập;
// gia sư bị chuyển nhầm; không có đếm ngược gửi lại. Quy tắc máy chủ: t-password-reset.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkTutor, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
type Mail = { to: string; subject: string; text: string };
const mails = (to: string) => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to && /Đặt lại mật khẩu/.test(m.subject));
const tokenOf = (to: string) => mails(to).at(-1)?.text.match(/token=([0-9a-f]{64})/)?.[1] ?? "";

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  const S = await mkUser({ name: "Minh Anh" });
  const T = await mkTutor("Cô Lan");
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    const where = () => { try { return new URL(p.url()).pathname; } catch { return "?"; } };
    p.on("pageerror", e => errors.push(`${where()} :: ${String(e).slice(0, 200)}`));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 4\d\d/i.test(m.text())) errors.push(`${where()} :: ${m.text().slice(0, 200)}`); });
  };
  let ip = Math.floor(Math.random() * 200);
  const guest = async (w = 1280, h = 900) => {
    const c = await ctxFor(null, { width: w, height: h });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await c.setExtraHTTPHeaders({ "x-forwarded-for": `10.99.${Math.floor(Math.random() * 250)}.${++ip % 250}` }); // mỗi ngữ cảnh một máy riêng: không vướng giới hạn theo IP
    return c;
  };

  // ───────────────────────────── Từ trang đăng nhập
  section("Trang đăng nhập → 'Quên mật khẩu?' mang theo email đã gõ");
  const c1 = await guest();
  const p = await c1.newPage(); watch(p);
  await p.clock.install(); // đồng hồ giả cài TRƯỚC khi trang tạo bộ đếm gửi lại (hẹn giờ có sẵn từ trước không tua được); thời gian vẫn chạy bình thường
  await p.goto(`${BASE}/dang-nhap`, { waitUntil: "networkidle", timeout: 120000 });
  const link = p.getByRole("link", { name: "Quên mật khẩu?" });
  await link.waitFor({ timeout: 90000 });
  check("chưa gõ gì: link trỏ /quen-mat-khau (không kèm email)", (await link.getAttribute("href")) === "/quen-mat-khau");
  await p.locator("#dn-id-pw").fill(S.email);
  check("đã gõ email: link kèm ?email=<email đã gõ>", (await link.getAttribute("href")) === `/quen-mat-khau?email=${encodeURIComponent(S.email)}`);
  await link.click();
  await p.waitForURL(/\/quen-mat-khau\?email=/, { timeout: 60000 });

  section("Màn 'Quên mật khẩu?'");
  const input = p.getByLabel("Email");
  await input.waitFor({ timeout: 60000 });
  check("nhãn 'Email' GẮN với ô nhập (getByLabel tìm được, trình đọc màn hình đọc đúng) — lỗi cũ", (await input.count()) === 1);
  check("ô email được điền sẵn từ trang đăng nhập và đang được focus", (await input.inputValue()) === S.email && (await p.evaluate(`document.activeElement?.id`)) === "qmk-email");
  check("tiêu đề + câu hướng dẫn", await p.getByRole("heading", { name: "Quên mật khẩu?" }).isVisible() && await p.getByText(/KiN gửi cho bạn một link/).isVisible());
  await shot(p, "forgot-ui-1-form");
  await input.fill("");
  await p.getByRole("button", { name: "Gửi link đặt lại mật khẩu" }).click();
  check("để trống → báo 'Vui lòng nhập email' (không gọi máy chủ)", await p.getByRole("alert").filter({ hasText: "Vui lòng nhập email" }).isVisible());
  await input.fill("khong-phai-email");
  await p.getByRole("button", { name: "Gửi link đặt lại mật khẩu" }).click();
  check("sai dạng → báo 'chưa đúng dạng', ô email đánh dấu aria-invalid", await p.getByRole("alert").filter({ hasText: "chưa đúng dạng" }).isVisible() && (await input.getAttribute("aria-invalid")) === "true");
  check("chưa có thư nào được gửi", readdirSync(SINK).length === 0);

  section("Gửi link: màn 'Kiểm tra hộp thư' + đếm ngược gửi lại");
  await input.fill(S.email);
  await p.getByRole("button", { name: "Gửi link đặt lại mật khẩu" }).click();
  await p.getByRole("heading", { name: "Kiểm tra hộp thư" }).waitFor({ timeout: 60000 });
  check("nêu email vừa nhập, giọng 'nếu đã đăng ký' (không khẳng định có tài khoản)", await p.getByRole("status").filter({ hasText: S.email }).isVisible() && await p.getByText(/Nếu .* đã đăng ký KiN/).isVisible());
  check("nhắc: link sống 30 phút, một lần; xem thư mục Spam", await p.getByText(/30 phút/).isVisible() && await p.getByText(/Spam/).isVisible());
  const resend = p.getByRole("button", { name: /Gửi lại/ });
  check("nút gửi lại đang KHOÁ, đếm ngược 'Gửi lại sau 0:5x/0:60'", await resend.isDisabled() && /Gửi lại sau (0:[0-5]\d|1:00)/.test(await resend.innerText()), await resend.innerText());
  await eventually("thư tới hộp thư (thư mục sink)", () => mails(S.email).length === 1);
  await shot(p, "forgot-ui-2-sent");
  const tok = tokenOf(S.email);
  check("thư có link 64 ký tự", tok.length === 64);

  // ───────────────────────────── Gửi lại: đẩy đồng hồ trang và tuổi link để khỏi chờ thật 60 giây
  section("Hết đếm ngược → 'Gửi lại link' dùng được và gửi link MỚI");
  await p.clock.runFor(62_000); // đồng hồ giả đã cài từ đầu (xem trên): runFor chạy đủ 62 nhịp của bộ đếm
  await eventually("nút đổi thành 'Gửi lại link' và bật", async () => (await resend.isEnabled()) && /^Gửi lại link$/.test((await resend.innerText()).trim()));
  await prisma.passwordResetToken.updateMany({ where: { user: { email: S.email } }, data: { expiresAt: new Date(Date.now() + 30 * 60_000 - 61_000) } }); // máy chủ cũng coi đã quá 60 giây
  await resend.click();
  await eventually("thư thứ 2 đã gửi, link khác link đầu", () => mails(S.email).length === 2 && tokenOf(S.email) !== tok);
  check("đếm ngược chạy lại sau khi gửi lại", await resend.isDisabled());
  await c1.close();
  const tok2 = tokenOf(S.email);

  // ───────────────────────────── Đặt lại
  section("Link cũ đã bị thay: mở ra phải báo rõ, KHÔNG để người dùng gõ mật khẩu rồi mới thất bại");
  const c2 = await guest();
  const q = await c2.newPage(); watch(q);
  await q.goto(`${BASE}/dat-lai-mat-khau?token=${tok}`, { waitUntil: "networkidle", timeout: 120000 });
  await q.getByRole("heading", { name: "Link không dùng được" }).waitFor({ timeout: 60000 });
  check("hiện ngay 'Link không dùng được' + lý do + nút 'Yêu cầu link mới'", await q.getByRole("alert").filter({ hasText: /không hợp lệ hoặc đã được dùng/ }).isVisible() && (await q.getByRole("link", { name: "Yêu cầu link mới" }).getAttribute("href")) === "/quen-mat-khau");
  check("không có ô nhập mật khẩu", (await q.locator('input[type="password"]').count()) === 0);
  await q.goto(`${BASE}/dat-lai-mat-khau`, { waitUntil: "networkidle" });
  check("không có ?token → báo link không hợp lệ", await q.getByRole("heading", { name: "Link không dùng được" }).isVisible());

  section("Link hết hạn: báo 'hết hạn'");
  await prisma.passwordResetToken.updateMany({ where: { user: { email: S.email } }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await q.goto(`${BASE}/dat-lai-mat-khau?token=${tok2}`, { waitUntil: "networkidle" });
  await q.getByRole("heading", { name: "Link không dùng được" }).waitFor({ timeout: 60000 });
  check("lý do nêu 'hết hạn' + 30 phút", await q.getByRole("alert").filter({ hasText: /hết hạn.*30 phút/ }).isVisible());
  await prisma.passwordResetToken.updateMany({ where: { user: { email: S.email } }, data: { expiresAt: new Date(Date.now() + 20 * 60_000) } }); // hồi lại để đi tiếp

  section("Form đặt lại: kiểm tra trước khi gửi");
  await q.goto(`${BASE}/dat-lai-mat-khau?token=${tok2}`, { waitUntil: "networkidle" });
  const pw = q.getByLabel("Mật khẩu mới"), pw2 = q.getByLabel("Nhập lại mật khẩu");
  await pw.waitFor({ timeout: 60000 });
  check("2 ô có nhãn gắn đúng, autocomplete=new-password, ô đầu được focus", (await pw.getAttribute("autocomplete")) === "new-password" && (await pw2.getAttribute("autocomplete")) === "new-password" && (await q.evaluate(`document.activeElement?.id`)) === "dl-mk");
  await pw.fill("abc");
  check("thanh độ mạnh hiện 'Quá yếu' khi quá ngắn", await q.getByText("Quá yếu").isVisible());
  await pw.fill("MatKhauMoi#2026");
  check("mật khẩu mạnh → 'Rất mạnh'", await q.getByText("Rất mạnh").isVisible());
  await pw2.fill("KhacHan#2026");
  check("nhập lại khác → báo 'chưa khớp' ngay dưới ô", await q.getByText("Mật khẩu nhập lại chưa khớp").first().isVisible());
  await q.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  check("bấm gửi khi chưa khớp → báo lỗi, KHÔNG đổi mật khẩu", await q.getByRole("alert").filter({ hasText: "chưa khớp" }).isVisible() && (await prisma.passwordResetToken.count({ where: { user: { email: S.email } } })) === 1);
  await pw.fill("1234567"); await pw2.fill("1234567");
  await q.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  check("7 ký tự → báo 'ít nhất 8 ký tự'", await q.getByRole("alert").filter({ hasText: "8 ký tự" }).isVisible());
  const toggle = q.getByRole("button", { name: "Hiện" });
  await toggle.click();
  check("'Hiện' → hai ô chuyển sang chữ thường, nút thành 'Ẩn'", (await pw.getAttribute("type")) === "text" && (await pw2.getAttribute("type")) === "text" && (await q.getByRole("button", { name: "Ẩn" }).count()) === 1);
  await shot(q, "forgot-ui-3-reset");

  section("Đặt lại xong: ĐĂNG NHẬP LUÔN và vào đúng 'Việc của tôi' (tải cứng để phiên được nhận)");
  await pw.fill("MatKhauMoi#2026"); await pw2.fill("MatKhauMoi#2026");
  await q.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await q.getByRole("heading", { name: "Đã đổi mật khẩu" }).waitFor({ timeout: 60000 });
  check("báo 'Đã đổi mật khẩu… đã được đăng nhập'", await q.getByRole("status").filter({ hasText: "đã được đăng nhập" }).isVisible());
  await q.waitForURL(u => u.pathname === "/student/viec-cua-toi", { timeout: 60000 });
  await q.locator("#kin-rail").waitFor({ timeout: 90000 });
  check("vào /student/viec-cua-toi và KHÔNG bị đá về đăng nhập (thấy thanh bên học viên + tên)", await q.getByRole("button", { name: `Tài khoản của ${S.name}` }).isVisible());
  const afterLogin = await c2.newPage();
  const loginAgain = await afterLogin.request.post(`${BASE}/api/auth/login`, { data: { identifier: S.email, password: "MatKhauMoi#2026" }, headers: { "x-forwarded-for": `10.98.1.${++ip % 250}` } });
  check("mật khẩu mới đăng nhập được ở lần khác", loginAgain.status() === 200);
  const oldLogin = await afterLogin.request.post(`${BASE}/api/auth/login`, { data: { identifier: S.email, password: "Passw0rd!" }, headers: { "x-forwarded-for": `10.98.2.${++ip % 250}` } });
  check("mật khẩu cũ không còn đăng nhập được", oldLogin.status() === 401);
  const reuse = await afterLogin.goto(`${BASE}/dat-lai-mat-khau?token=${tok2}`, { waitUntil: "networkidle" });
  void reuse;
  await afterLogin.getByRole("heading", { name: "Link không dùng được" }).waitFor({ timeout: 60000 });
  check("mở lại chính link vừa dùng → 'Link không dùng được'", true);
  await c2.close();

  // ───────────────────────────── Gia sư
  section("Gia sư đặt lại mật khẩu → vào thẳng vỏ gia sư (trước đây bị đưa nhầm vào /admin)");
  const c3 = await guest();
  const g = await c3.newPage(); watch(g);
  await g.goto(`${BASE}/quen-mat-khau`, { waitUntil: "networkidle", timeout: 120000 });
  await g.getByLabel("Email").fill(T.email);
  await g.getByRole("button", { name: "Gửi link đặt lại mật khẩu" }).click();
  await g.getByRole("heading", { name: "Kiểm tra hộp thư" }).waitFor({ timeout: 60000 });
  await eventually("thư của gia sư đã tới", () => mails(T.email).length === 1);
  await g.goto(`${BASE}/dat-lai-mat-khau?token=${tokenOf(T.email)}`, { waitUntil: "networkidle" });
  await g.getByLabel("Mật khẩu mới").fill("MatKhauMoi#2026");
  await g.getByLabel("Nhập lại mật khẩu").fill("MatKhauMoi#2026");
  await g.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await g.waitForURL(u => u.pathname.startsWith("/lop-cua-toi"), { timeout: 90000 });
  await g.locator("#kin-rail").waitFor({ timeout: 90000 });
  // 24/10/2026: isVisible() không tự chờ; Hộp việc nay nạp thêm dữ liệu nên nhãn vai trò có lúc chưa kịp vẽ → chờ thay vì đọc ngay (lúc đỏ lúc xanh trước khi sửa).
  await eventually("gia sư vào /lop-cua-toi, thấy vỏ gia sư 'GIA SƯ'", async () => new URL(g.url()).pathname.startsWith("/lop-cua-toi") && await g.getByText("GIA SƯ", { exact: true }).first().isVisible());
  await c3.close();

  // ───────────────────────────── Điện thoại
  section("Điện thoại 390px: hai trang không tràn ngang, nút đủ cao");
  const cm = await guest(390, 800);
  const m = await cm.newPage(); watch(m);
  for (const path of ["/quen-mat-khau", `/dat-lai-mat-khau?token=${"d".repeat(64)}`]) {
    await m.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await m.waitForTimeout(800);
    check(`${path.slice(0, 22)}: không tràn ngang`, await m.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  }
  await m.goto(`${BASE}/quen-mat-khau`, { waitUntil: "networkidle" });
  const box = await m.getByRole("button", { name: "Gửi link đặt lại mật khẩu" }).boundingBox();
  check("nút gửi cao ≥ 44px", !!box && box.height >= 44, box);
  await shot(m, "forgot-ui-4-mobile");
  await cm.close();

  check("không lỗi JavaScript / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
