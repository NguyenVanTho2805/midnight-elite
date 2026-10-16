// Luồng ĐI QUA hai tên miền (15/10/2026): cùng một người bấm một nút ở tên miền này có tới đúng chỗ ở tên miền kia không, và có đăng nhập lại vô lý không.
// Bài `ui-links-everywhere` mở từng đích; bài này đi theo các hành trình có thao tác: gõ, bấm, đăng nhập.
//   H1  Trang đăng nhập admin (ca Thọ báo): không còn khung khách (thanh trên / chân trang / "Đăng ký" / mã mời); mọi nút còn lại đi đúng chỗ.
//   H2  "Quên mật khẩu?" ở trang đăng nhập admin → trang quên mật khẩu ở tên miền chính, đã điền sẵn email.
//   H3  Liên kết cũ /admin/kiem-duyet ở tên miền chính → tới ĐÚNG trang đó ở tên miền admin (trước đây rơi về dashboard); đăng nhập xong quay lại đúng trang.
//   H4  Nút công khai gõ nhầm ở tên miền admin (/khoa-hoc) → trang công khai ở tên miền chính.
//   H5  Học viên / gia sư đăng nhập nhầm cửa admin → thông báo rõ (không để lại phiên ở tên miền admin, không trang trắng, không quay vòng).
//   H6  Quản trị đăng nhập đúng cửa → vào đúng trang đích (redirect), kể cả trang sâu.
//   H7  (16/10/2026) Chuyển hướng không bị trình duyệt NHỚ: chưa đăng nhập mở /admin/khoa-hoc (bị đẩy sang cửa admin), rồi đăng nhập GIA SƯ và mở lại đúng địa chỉ đó → vào được
//       trang quản khoá ở tên miền chính. Trước đây là 308 (vĩnh viễn): trình duyệt dùng lại bản nhớ, gia sư mãi bị đẩy sang tên miền không có phiên của họ.
import { launch, closeAll } from "./ui";
import { mkUser, mkTutor, mkSuper, wipe, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import type { Page } from "playwright";

const PORT = Number(process.env.PORT ?? 3100);
const MAIN = `http://midnightelite-edu.com:${PORT}`;
const ADMIN = `http://admin.midnightelite-edu.com:${PORT}`;
const u = (s: string) => new URL(s);
const visible = (p: Page, sel: string) => p.locator(sel).first().isVisible().catch(() => false);

async function settle(p: Page, ms = 700) {
  await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  let last = p.url(), still = 0;
  for (let i = 0; i < 30 && still * 180 < ms; i++) { await p.waitForTimeout(180); const n = p.url(); if (n === last) still++; else { last = n; still = 0; await p.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {}); } }
}
async function fillLogin(p: Page, email: string, password: string) {
  await p.locator('input[type="email"], input[autocomplete="username"], input[name="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill(password);
  await p.locator('form button[type="submit"]').first().click();
}

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const S = await mkUser({ name: "Học viên nhầm cửa" });
  const T = await mkTutor("Gia sư nhầm cửa");
  const browser = await launch();
  const fresh = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" }); const p = await ctx.newPage(); p.on("dialog", d => { void d.dismiss(); }); return { ctx, p }; };

  section("H1. Trang đăng nhập admin: không còn khung khách");
  {
    const { ctx, p } = await fresh();
    await p.goto(ADMIN + "/dang-nhap?redirect=%2Fadmin", { waitUntil: "domcontentloaded" }); await settle(p);
    check("ở tên miền admin, trang đăng nhập mở được (200, vẫn là /dang-nhap)", u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/dang-nhap");
    check("KHÔNG thấy thanh trên của khách (Lớp học / Thi thử / Cộng đồng / Tin tức)", !(await visible(p, 'header nav[aria-label="Điều hướng chính"]')) && !(await p.getByRole("link", { name: "Lớp học", exact: true }).first().isVisible().catch(() => false)));
    check("KHÔNG thấy chân trang của khách (Bảng xếp hạng, Điểm chuẩn, Dành cho học sinh…)", !(await visible(p, "footer")) && !(await p.getByRole("link", { name: "Dành cho học sinh" }).first().isVisible().catch(() => false)));
    check("KHÔNG có nút 'Đăng ký ngay' / 'Tôi có mã mời vào lớp' / 'Tìm hiểu thêm' (chỉ dành cho học viên ở tên miền chính)", !(await p.getByRole("link", { name: /Đăng ký ngay|Tôi có mã mời|Tìm hiểu thêm/ }).first().isVisible().catch(() => false)));
    check("còn đủ phần đăng nhập: ô tài khoản, ô mật khẩu, nút Đăng nhập, 'Quên mật khẩu?'", await visible(p, 'input[type="email"], input[autocomplete="username"]') && await visible(p, 'input[type="password"]') && await visible(p, 'form button[type="submit"]') && await p.getByRole("link", { name: "Quên mật khẩu?" }).first().isVisible().catch(() => false));
    check("có lối sang cửa học viên / gia sư (đăng nhập ở midnightelite-edu.com)", await p.getByRole("link", { name: /midnightelite-edu\.com|học viên|gia sư/i }).first().isVisible().catch(() => false));
    // cùng trang ở tên miền chính vẫn đầy đủ khung khách (không bị ảnh hưởng)
    await p.goto(MAIN + "/dang-nhap", { waitUntil: "domcontentloaded" }); await settle(p);
    check("ở tên miền CHÍNH trang đăng nhập vẫn có thanh trên + chân trang + 'Đăng ký ngay' (không bị ẩn nhầm)", await visible(p, "header") && await visible(p, "footer") && await p.getByRole("link", { name: "Đăng ký ngay" }).first().isVisible().catch(() => false));
    await ctx.close();
  }

  section("H2. 'Quên mật khẩu?' ở cửa admin → trang quên mật khẩu (tên miền chính), điền sẵn email");
  {
    const { ctx, p } = await fresh();
    await p.goto(ADMIN + "/dang-nhap?redirect=%2Fadmin", { waitUntil: "domcontentloaded" }); await settle(p);
    await p.locator('input[type="email"], input[autocomplete="username"]').first().fill("quan.tri@example.com");
    await p.getByRole("link", { name: "Quên mật khẩu?" }).first().click();
    // chuyển tên miền + biên dịch lần đầu của /quen-mat-khau ở `next dev` có thể mất vài chục giây: chờ tới khi tới nơi thay vì đoán thời gian
    await eventually("đến /quen-mat-khau ở tên miền CHÍNH (không quay lại đăng nhập admin)", () => u(p.url()).pathname === "/quen-mat-khau" && !u(p.url()).host.startsWith("admin."), 60000);
    await p.locator("#qmk-email").waitFor({ timeout: 60000 }).catch(() => {});
    check("ô email đã điền sẵn email vừa gõ", (await p.locator("#qmk-email").inputValue().catch(() => "")) === "quan.tri@example.com");
    await ctx.close();
  }

  section("H3. Liên kết cũ /admin/kiem-duyet ở tên miền chính → đúng trang ở tên miền admin");
  {
    const { ctx, p } = await fresh();
    await p.goto(MAIN + "/admin/kiem-duyet?x=1", { waitUntil: "domcontentloaded" }); await settle(p);
    check("sang tên miền admin, GIỮ /admin/kiem-duyet (không rơi về dashboard)", u(p.url()).host.startsWith("admin.") && (u(p.url()).searchParams.get("redirect") ?? u(p.url()).pathname).includes("/admin/kiem-duyet"), p.url());
    await fillLogin(p, SA.email, "Passw0rd!");
    // trang đích biên dịch lần đầu có thể mất vài giây ở `next dev`: chờ tới khi tới nơi thay vì đoán thời gian
    await eventually("đăng nhập xong vào đúng /admin/kiem-duyet (ở tên miền admin)", () => u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/admin/kiem-duyet", 40000);
    await ctx.close();
  }

  section("H4. Nút công khai gõ nhầm ở tên miền admin → trang công khai ở tên miền chính");
  {
    const { ctx, p } = await fresh();
    for (const [path, expected] of [["/khoa-hoc", "/khoa-hoc"], ["/thi-thu", "/thi-thu"], ["/dang-ky?vai=gia-su", "/dang-ky"], ["/chinh-sach", "/chinh-sach"]] as const) {
      await p.goto(ADMIN + path, { waitUntil: "domcontentloaded" }); await settle(p);
      check(`${path} ở tên miền admin → ${expected} ở tên miền chính (không về đăng nhập admin)`, !u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === expected, p.url());
    }
    await ctx.close();
  }

  section("H5. Đăng nhập nhầm cửa admin bằng tài khoản học viên / gia sư");
  for (const [name, who] of [["học viên", S], ["gia sư", T]] as const) {
    const { ctx, p } = await fresh();
    await p.goto(ADMIN + "/dang-nhap?redirect=%2Fadmin", { waitUntil: "domcontentloaded" }); await settle(p);
    await fillLogin(p, who.email, "Passw0rd!"); await settle(p, 1200);
    check(`${name}: vẫn ở trang đăng nhập admin, có thông báo rõ (không trang trắng, không bị đưa đi chỗ lạ)`, u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/dang-nhap" && (await p.locator('[role="alert"]').first().innerText().catch(() => "")).includes("quản trị"), { url: p.url(), alert: await p.locator('[role="alert"]').first().innerText().catch(() => "") });
    const cookies = (await ctx.cookies(ADMIN)).filter(c => c.name === "midnight_session");
    check(`${name}: KHÔNG để lại phiên đăng nhập ở tên miền admin`, cookies.length === 0, cookies.map(c => c.name));
    await ctx.close();
  }

  section("H6. Quản trị đăng nhập đúng cửa → vào đúng trang đích");
  {
    const { ctx, p } = await fresh();
    await p.goto(ADMIN + "/dang-nhap?redirect=%2Fadmin%2Fkiem-duyet", { waitUntil: "domcontentloaded" }); await settle(p);
    await fillLogin(p, SA.email, "Passw0rd!");
    await eventually("redirect=/admin/kiem-duyet → vào đúng trang đó (ở tên miền admin)", () => u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/admin/kiem-duyet", 40000);
    await eventually("khung quản trị hiện ra (thanh module QUẢN TRỊ)", async () => (await p.locator("body").innerText()).includes("QUẢN TRỊ"));
    await ctx.close();
  }

  section("H7. Chưa đăng nhập mở /admin/khoa-hoc, rồi đăng nhập gia sư và mở lại đúng địa chỉ đó (chuyển hướng không bị trình duyệt nhớ)");
  {
    const { ctx, p } = await fresh();
    await p.goto(MAIN + "/admin/khoa-hoc", { waitUntil: "domcontentloaded" }); await settle(p);
    check("lần 1 (chưa đăng nhập) → cửa đăng nhập quản trị ở tên miền admin, giữ ?redirect=", u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/dang-nhap" && u(p.url()).searchParams.get("redirect") === "/admin/khoa-hoc", p.url());
    // Lối "Học viên / gia sư đăng nhập tại midnightelite-edu.com" phải mang theo trang đang định vào.
    const hint = p.locator('[data-chi-admin] a[href*="midnightelite-edu.com"]').first();
    const href = await hint.getAttribute("href").catch(() => null);
    check("lối sang cửa chính mang theo ?redirect=/admin/khoa-hoc", !!href && u(href).host === u(MAIN).host && u(href).pathname === "/dang-nhap" && u(href).searchParams.get("redirect") === "/admin/khoa-hoc", href);
    await hint.click().catch(() => {}); await settle(p);
    check("bấm lối đó → trang đăng nhập của tên miền chính (không phải cửa admin)", !u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/dang-nhap", p.url());
    await fillLogin(p, T.email, "Passw0rd!");
    await eventually("gia sư đăng nhập xong → vào ĐÚNG /admin/khoa-hoc ở tên miền chính (không bị đẩy sang tên miền admin)", () => !u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/admin/khoa-hoc", 40000);
    await eventually("trong vỏ gia sư", async () => (await p.locator('nav[aria-label="Module của gia sư"]').count()) > 0, 20000);
    // Mở LẠI đúng địa chỉ ấy bằng tay trên cùng trình duyệt: không được dùng bản chuyển hướng đã nhớ từ lần 1.
    await p.goto(MAIN + "/admin/khoa-hoc", { waitUntil: "domcontentloaded" }); await settle(p);
    check("mở lại đúng địa chỉ cũ → ở lại tên miền chính", !u(p.url()).host.startsWith("admin.") && u(p.url()).pathname === "/admin/khoa-hoc", p.url());
    await ctx.close();
  }

  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
