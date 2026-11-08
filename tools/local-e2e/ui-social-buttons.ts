// Nút "Tiếp tục với Google / Facebook" trên /dang-nhap (tab Học sinh) và /dang-ky — trình duyệt thật.
// Hiện/ẩn theo biến môi trường của SERVER DEV. Chạy với UI_SOCIAL_EXPECT=both | google | facebook | none (mặc định both) tương ứng cách khởi động dev:
//   both: có cả GOOGLE_CLIENT_ID/SECRET và FACEBOOK_APP_ID/SECRET · google: chỉ cặp Google · facebook: chỉ cặp Facebook · none: không đặt biến nào (hoặc chỉ một nửa cặp).
import { BASE, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";

const EXPECT = (process.env.UI_SOCIAL_EXPECT ?? "both") as "both" | "google" | "facebook" | "none";
const wantG = EXPECT === "both" || EXPECT === "google", wantF = EXPECT === "both" || EXPECT === "facebook";

(async () => {
  await wipe();
  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };

  for (const [label, vp] of [["máy tính 1280", { width: 1280, height: 900 }], ["điện thoại 390", { width: 390, height: 844 }]] as const) {
    section(`/dang-nhap tab Học sinh — ${label} — kỳ vọng: ${EXPECT}`);
    const c = await ctxFor(null, vp); const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}/dang-nhap?vai=hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 120000 });
    const g = p.getByRole("link", { name: "Tiếp tục với Google" }), f = p.getByRole("link", { name: "Tiếp tục với Facebook" });
    if (wantG) await eventually("nút Google hiện", () => g.isVisible()); else { await p.waitForTimeout(1500); }
    if (wantF) await eventually("nút Facebook hiện", () => f.isVisible()); else { await p.waitForTimeout(500); }
    check(`Google ${wantG ? "hiện" : "ẨN"}`, (await g.count() > 0) === wantG);
    check(`Facebook ${wantF ? "hiện" : "ẨN"}`, (await f.count() > 0) === wantF);
    if (EXPECT === "none") check("không ngăn 'hoặc' thừa", await p.locator("[data-social-auth]").count() === 0);
    if (wantG || wantF) {
      for (const [btn, on] of [[g, wantG], [f, wantF]] as const) {
        if (!on) continue;
        const box = await btn.boundingBox();
        check("nút cao ≥ 44px, rộng gần hết thẻ", !!box && box.height >= 44 && box.width >= Math.min(200, vp.width - 80), box);
        check("là liên kết thường tới /api/auth/<nhà>/start (không phải next/link)", /^\/api\/auth\/(google|facebook)\/start$/.test((await btn.getAttribute("href")) ?? ""));
      }
      const sep = p.locator("[data-social-auth] [role=separator]");
      const form = p.locator("form").first();
      const sb = await sep.boundingBox(), fb = await form.boundingBox(), lastBtn = await (wantF ? f : g).boundingBox();
      check("ngăn 'hoặc' nằm giữa nút và form", !!sb && !!fb && !!lastBtn && lastBtn.y + lastBtn.height <= sb.y && sb.y + sb.height <= fb.y && /hoặc/.test(await sep.innerText()), { sb, fb, lastBtn });
      check(`${vp.width}px: không tràn ngang`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      check("liên kết (cả hai nút) không mang mã màu hex trong style nội tuyến", !/#[0-9a-f]{3,8}\b/i.test(await p.locator("[data-social-auth]").evaluate(e => e.outerHTML)));
      await shot(p, `social-dang-nhap-${vp.width}`);
    }
    await c.close();
  }

  section("Tab Gia sư mặc định: không có nút (chỉ dành cho học sinh)");
  const cg = await ctxFor(null, { width: 1280, height: 900 }); const pg = await cg.newPage(); watch(pg);
  await pg.goto(`${BASE}/dang-nhap`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForTimeout(1500);
  check("không nút Google/Facebook ở tab Gia sư", await pg.getByRole("link", { name: /Tiếp tục với/ }).count() === 0);
  await cg.close();

  section("Thông báo lỗi từ callback");
  const cn = await ctxFor(null, { width: 390, height: 844 }); const pn = await cn.newPage(); watch(pn);
  for (const [q, text] of [["google=password-only", "Tài khoản này đăng nhập bằng mật khẩu"], ["facebook=email-exists", "Email này đã có tài khoản"], ["facebook=no-email", "Facebook không cung cấp email"], ["google=banned", "Tài khoản đã bị khóa"]] as const) {
    await pn.goto(`${BASE}/dang-nhap?vai=hoc-sinh&${q}`, { waitUntil: "networkidle", timeout: 120000 });
    await eventually(`?${q} → "${text}"`, async () => (await pn.getByRole("alert").first().innerText().catch(() => "")).includes(text));
  }
  check("thông báo không có '@' hay số tiền", !/@|\d+\s*(đ|xu)/i.test(await pn.getByRole("alert").first().innerText()));
  await cn.close();

  section("/dang-ky: nút chỉ ở vai Học viên, có câu đồng ý + chỉ lấy tên và email");
  const cr = await ctxFor(null, { width: 390, height: 844 }); const pr = await cr.newPage(); watch(pr);
  await pr.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
  await pr.getByText("Bạn đăng ký với vai trò nào?").waitFor({ timeout: 60000 });
  if (wantG) await eventually("nút Google hiện ở vai Học viên", () => pr.getByRole("link", { name: "Tiếp tục với Google" }).isVisible()); else await pr.waitForTimeout(1500);
  check("Facebook/Google đúng kỳ vọng ở /dang-ky", (await pr.getByRole("link", { name: "Tiếp tục với Google" }).count() > 0) === wantG && (await pr.getByRole("link", { name: "Tiếp tục với Facebook" }).count() > 0) === wantF);
  if (wantG || wantF) {
    check("có câu đồng ý Điều khoản + 'chỉ nhận tên và email'", await pr.getByText(/KiN chỉ nhận tên và email/).isVisible());
    check("390px không tràn ngang", await pr.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await shot(pr, "social-dang-ky-390");
    await pr.getByRole("button", { name: /Gia sư/ }).first().click();
    await pr.waitForTimeout(400);
    check("chọn vai Gia sư → nút biến mất (đăng ký gia sư vẫn qua đơn duyệt)", await pr.getByRole("link", { name: /Tiếp tục với/ }).count() === 0);
  }
  await cr.close();

  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
