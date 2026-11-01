// Trình duyệt thật: ô email / mật khẩu của 4 trang auth không để bàn phím điện thoại tự viết hoa / tự sửa (01/11/2026). Phần thuần: t-auth-input-attrs.
//
// Câu chuyện gốc (bạn Phương Uyên, 30/10–01/11): đăng ký xong, đăng nhập lại báo "Email hoặc mật khẩu không đúng". Nút "Hiện" đổi ô mật khẩu sang type="text";
// ô text trên điện thoại tự viết hoa chữ đầu, nên mật khẩu LƯU khác mật khẩu người dùng nghĩ mình đặt.
// Chromium máy tính không có bàn phím ảo nên không tái hiện được việc viết hoa; bài này kiểm thứ trình duyệt đọc để quyết định điều đó — thuộc tính
// autocapitalize / autocorrect / spellcheck trên từng ô, ở CẢ HAI trạng thái ẩn và hiện. Kèm một vòng đăng ký → đăng nhập đúng như người dùng: bấm "Hiện",
// gõ mật khẩu chữ thường, rồi đăng nhập với mật khẩu ẩn (và email gõ HOA, thừa dấu cách) — mật khẩu đã băm phải đúng bằng chữ đã gõ.
//
// Chạy: CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome-linux64/chrome (hoặc đường dẫn khớp máy) npx tsx tools/local-e2e/ui-auth-input-attrs.ts
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { BASE, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
type Mail = { to: string; subject: string; text: string };
const resetToken = (to: string) => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail)
  .filter(m => m.to === to && /Đặt lại mật khẩu/.test(m.subject)).at(-1)?.text.match(/token=([0-9a-f]{64})/)?.[1] ?? "";

type Loc = ReturnType<Page["locator"]>;
const read = async (l: Loc) => ({
  type: await l.getAttribute("type"),
  cap: await l.getAttribute("autocapitalize"),
  corr: await l.getAttribute("autocorrect"),
  spell: await l.getAttribute("spellcheck"),
});
const protectedAttrs = (a: Awaited<ReturnType<typeof read>>) => a.cap === "off" && a.corr === "off" && a.spell === "false";

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  await launch();
  const errors: string[] = [];
  let ip = Math.floor(Math.random() * 200);
  const guest = async () => {
    const c = await ctxFor(null, { width: 390, height: 844 }); // cỡ điện thoại: nơi lỗi xảy ra
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await c.setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${++ip % 250}` });
    return c;
  };
  const page = async () => {
    const p = await (await guest()).newPage();
    p.on("pageerror", e => errors.push(`${new URL(p.url()).pathname} :: ${String(e).slice(0, 200)}`));
    return p;
  };

  // ───────────────────────────── Đăng ký + vòng đăng ký → đăng nhập
  section("/dang-ky (390px): ô email, mật khẩu, nhập lại — ẩn và hiện");
  const p = await page();
  const email = `uyen.${Date.now()}@example.com`;
  const PASS = "uyen2005xyz"; // chữ thường toàn bộ: nếu bàn phím viết hoa chữ đầu thì mật khẩu lưu sẽ lệch
  await p.goto(`${BASE}/dang-ky`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.getByPlaceholder("Nguyễn Văn A").fill("Phương Uyên");
  const nameAttrs = await read(p.getByPlaceholder("Nguyễn Văn A"));
  check("ô Họ và tên KHÔNG bị tắt viết hoa (tên người vẫn viết hoa chữ đầu)", nameAttrs.cap !== "off" && nameAttrs.spell !== "false", nameAttrs);
  await p.locator('input[type="tel"]').nth(0).fill("0912345678");
  await p.locator('input[type="tel"]').nth(1).fill("0987654321");
  await p.locator("form select").first().selectOption({ index: 1 });
  await p.getByPlaceholder("THPT Chu Văn An").fill("THCS Thử Nghiệm");
  await p.getByRole("button", { name: /Tiếp theo/ }).click();
  const em = p.getByPlaceholder("ten@gmail.com"), pw = p.getByPlaceholder("Tối thiểu 8 ký tự"), cf = p.getByPlaceholder("Nhập lại mật khẩu");
  await em.waitFor({ timeout: 30000 });
  let a = await read(em);
  check("email: tắt viết hoa + tự sửa + chính tả", protectedAttrs(a), a);
  a = await read(pw);
  check("mật khẩu (đang ẩn, type=password): có ba thuộc tính", a.type === "password" && protectedAttrs(a), a);
  a = await read(cf);
  check("nhập lại mật khẩu (đang ẩn): có ba thuộc tính", a.type === "password" && protectedAttrs(a), a);
  await p.getByRole("button", { name: "Hiện mật khẩu" }).first().click();     // ô mật khẩu → type="text" (đúng chỗ gây lỗi)
  a = await read(pw);
  check("bấm Hiện: ô mật khẩu thành type=text VÀ vẫn giữ ba thuộc tính", a.type === "text" && protectedAttrs(a), a);
  await p.getByRole("button", { name: "Hiện mật khẩu" }).first().click();     // nút còn lại là của ô nhập lại
  a = await read(cf);
  check("bấm Hiện: ô nhập lại thành type=text VÀ vẫn giữ ba thuộc tính", a.type === "text" && protectedAttrs(a), a);

  section("Vòng người dùng: đăng ký với mật khẩu đang HIỆN → đăng nhập với mật khẩu ẩn");
  await em.fill(email);
  await pw.fill(PASS);
  await cf.fill(PASS);
  check("ô mật khẩu giữ đúng chữ đã gõ (không bị đổi chữ)", (await pw.inputValue()) === PASS && (await cf.inputValue()) === PASS);
  await p.locator('form input[type="checkbox"]').check();
  await p.getByRole("button", { name: "Tạo tài khoản miễn phí" }).click();
  await eventually("hiện 'Kiểm tra hộp thư' (đăng ký xong)", async () => (await p.locator("body").innerText()).includes("Kiểm tra hộp thư"), 40000);
  const row = await prisma.user.findUnique({ where: { email } });
  check("tài khoản có trong DB", !!row);
  check("mật khẩu đã băm ĐÚNG bằng chữ đã gõ (không lệch hoa/thường, không thừa dấu cách)", !!row && await bcrypt.compare(PASS, row.password));
  check("và KHÔNG khớp bản viết hoa chữ đầu (đối chứng: bcrypt phân biệt hoa/thường)", !!row && !(await bcrypt.compare("Uyen2005xyz", row.password)));

  const p2 = await page();
  await p2.goto(`${BASE}/dang-nhap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p2.locator("#dn-id-pw").waitFor({ timeout: 90000 });
  await p2.locator("#dn-id-pw").fill(`  ${email.toUpperCase()}  `);              // gõ HOA + dấu cách thừa (bàn phím điện thoại hay thêm)
  await p2.locator("#dn-pass").fill(PASS);
  // Chốt vào PHẢN HỒI của máy chủ, không vào thời gian tải trang đích: lần mở đầu của `next dev` biên dịch trang đích rất lâu (README), bài từng đỏ vì hạn 60 giây đó.
  const [resp] = await Promise.all([
    p2.waitForResponse(r => r.url().includes("/api/auth/login") && r.request().method() === "POST", { timeout: 90000 }),
    p2.getByRole("button", { name: "Đăng nhập", exact: true }).click(),
  ]);
  check("máy chủ trả 200 cho đăng nhập (email gõ HOA + dấu cách thừa, mật khẩu đã gõ khi ẩn)", resp.status() === 200, { status: resp.status(), body: await resp.text().catch(() => "") });
  await eventually("rồi trang rời /dang-nhap", () => new URL(p2.url()).pathname !== "/dang-nhap", 180000);
  check("không hiện 'Email hoặc mật khẩu không đúng'", !(await p2.locator("body").innerText()).includes("Email hoặc mật khẩu không đúng"));

  // ───────────────────────────── Đăng nhập
  section("/dang-nhap (390px): ô tài khoản, mật khẩu — ẩn và hiện; ô nhập mã");
  const p3 = await page();
  await p3.goto(`${BASE}/dang-nhap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p3.locator("#dn-pass").waitFor({ timeout: 90000 });
  a = await read(p3.locator("#dn-id-pw"));
  check("ô tài khoản (email / số điện thoại): ba thuộc tính", protectedAttrs(a), a);
  a = await read(p3.locator("#dn-pass"));
  check("mật khẩu (ẩn): ba thuộc tính", a.type === "password" && protectedAttrs(a), a);
  await p3.getByRole("button", { name: "Hiện", exact: true }).click();
  a = await read(p3.locator("#dn-pass"));
  check("bấm Hiện: type=text VÀ vẫn giữ ba thuộc tính", a.type === "text" && protectedAttrs(a), a);
  const p3b = await page();                                                    // tab "đăng nhập bằng mã" mở thẳng bằng ?cach=ma (nút chuyển chỉ hiện sau khi bị khoá)
  await p3b.goto(`${BASE}/dang-nhap?cach=ma`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p3b.locator("#dn-email").waitFor({ timeout: 90000 });
  a = await read(p3b.locator("#dn-email"));
  check("ô nhập tài khoản của 'đăng nhập bằng mã': ba thuộc tính", protectedAttrs(a), a);

  // ───────────────────────────── Quên mật khẩu
  section("/quen-mat-khau (390px): ô email");
  const p4 = await page();
  await p4.goto(`${BASE}/quen-mat-khau`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p4.locator("#qmk-email").waitFor({ timeout: 60000 });
  a = await read(p4.locator("#qmk-email"));
  check("email: ba thuộc tính", protectedAttrs(a), a);

  // ───────────────────────────── Đặt lại mật khẩu
  section("/dat-lai-mat-khau (390px): mật khẩu mới + nhập lại — ẩn và hiện");
  const S = await mkUser({ name: "Minh Anh" });
  const r = await fetch(`${BASE}/api/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.88.${Math.floor(Math.random() * 250)}.7` }, body: JSON.stringify({ email: S.email }) });
  check("xin link đặt lại: 200", r.status === 200, r.status);
  await eventually("thư đặt lại tới hộp thư (sink)", () => resetToken(S.email).length === 64, 20000);
  const p5 = await page();
  await p5.goto(`${BASE}/dat-lai-mat-khau?token=${resetToken(S.email)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p5.locator("#dl-mk").waitFor({ timeout: 90000 });
  a = await read(p5.locator("#dl-mk"));
  check("mật khẩu mới (ẩn): ba thuộc tính", a.type === "password" && protectedAttrs(a), a);
  a = await read(p5.locator("#dl-nl"));
  check("nhập lại (ẩn): ba thuộc tính", a.type === "password" && protectedAttrs(a), a);
  await p5.getByRole("button", { name: "Hiện", exact: true }).click();         // một nút điều khiển cả hai ô
  a = await read(p5.locator("#dl-mk"));
  check("bấm Hiện: mật khẩu mới thành type=text VÀ vẫn giữ ba thuộc tính", a.type === "text" && protectedAttrs(a), a);
  a = await read(p5.locator("#dl-nl"));
  check("bấm Hiện: nhập lại thành type=text VÀ vẫn giữ ba thuộc tính", a.type === "text" && protectedAttrs(a), a);

  section("Không lỗi JS trên cả 5 trang");
  check("không có pageerror", errors.length === 0, errors);

  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll().catch(() => {}); process.exit(1); });
