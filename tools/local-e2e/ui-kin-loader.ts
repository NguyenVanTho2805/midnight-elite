// Biểu tượng lúc đang tải = logo KiN — 15/10/2026 (Thọ: "đổi biểu tượng lúc loading thành logo mới của tôi"). Trình duyệt thật.
// Trước đó: ô chữ "T" (dấu vết thương hiệu cũ) + hàng 3 chấm nhảy rải ở nhiều trang. Nay: một thành phần KinLoader (src/components/kin/KinLoader.tsx).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkUser, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";

const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx$/.test(f)) out.push(p);
  }
  return out;
}

(async () => {
  section("Mã nguồn: không còn ô chữ 'T' và hàng 3 chấm nhảy làm biểu tượng tải");
  const files = walk(join(root, "src"));
  const bounce = files.filter(f => /animate-bounce/.test(readFileSync(f, "utf8"))).map(f => f.slice(root.length + 1));
  check("chỉ còn chấm nhảy ở khung chat AI (đó là biểu tượng 'đang gõ', không phải đang tải)", bounce.length === 1 && bounce[0].endsWith("components/AIChatWidget.tsx"), bounce);
  const tTile = files.filter(f => /font-black text-white">T<\/span>/.test(readFileSync(f, "utf8"))).map(f => f.slice(root.length + 1));
  check("không còn ô chữ 'T' nào", tTile.length === 0, tTile);
  const users = files.filter(f => /<KinLoader\b/.test(readFileSync(f, "utf8"))).map(f => f.slice(root.length + 1));
  check("KinLoader được dùng ở màn chờ toàn trang (AuthGuard) và 5 trang có chỗ chờ", users.length === 6 && users.some(f => f.endsWith("AuthGuard.tsx")), users);
  const loaderSrc = readFileSync(join(root, "src/components/kin/KinLoader.tsx"), "utf8");
  check("KinLoader dùng chính KinMark (đổi logo một chỗ thì màn chờ đổi theo)", /import \{ KinMark \} from "\.\/KinLogo"/.test(loaderSrc) && /<KinMark\b/.test(loaderSrc));

  await wipe();
  const S = await mkUser({ name: "Học Sinh" });
  await launch();
  const errors: string[] = [];

  section("Màn chờ toàn trang (AuthGuard): logo KiN, đọc được bằng trình đọc màn hình");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 800 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route("**/api/auth/me", async route => { await new Promise(r => setTimeout(r, 4000)); await route.continue(); });
    const p = await ctx.newPage(); p.on("pageerror", e => errors.push(String(e)));
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 150000 });
    const loader = p.locator("[data-kin-loader]");
    await loader.waitFor({ state: "visible", timeout: 90000 });
    const info = await loader.evaluate(el => ({
      role: el.getAttribute("role"),
      live: el.getAttribute("aria-live"),
      srText: el.querySelector(".sr-only")?.textContent,
      rects: el.querySelectorAll("svg rect").length,
      paths: el.querySelectorAll("svg path").length,
      svgHidden: el.querySelector("svg")?.getAttribute("aria-hidden"),
      w: el.querySelector("svg")?.getBoundingClientRect().width,
      anim: Array.from(el.querySelectorAll("svg path")).map(x => getComputedStyle(x).animationName),
      delays: Array.from(el.querySelectorAll("svg path")).map(x => getComputedStyle(x).animationDelay),
      stemAnim: getComputedStyle(el.querySelector("svg rect")!).animationName,
    }));
    check("là logo K của KiN: thân K + ba lưỡi", info.rects === 1 && info.paths === 3, info);
    check("trình đọc màn hình: role=status, aria-live=polite, đọc 'Đang tải'; hình logo là trang trí (aria-hidden)", info.role === "status" && info.live === "polite" && info.srText === "Đang tải" && info.svgHidden === "true", info);
    check("kích thước 56px như đặt cho màn chờ toàn trang", Math.round(info.w ?? 0) === 56, info.w);
    check("ba lưỡi chuyển động lần lượt (cùng hiệu ứng, trễ khác nhau); thân K đứng yên", info.anim.every(a => a === "kin-loader-blade") && new Set(info.delays).size === 3 && info.stemAnim === "none", info);
    check("không còn ô chữ 'T' và không còn chấm nhảy", (await p.locator(".animate-bounce").count()) === 0 && !(await p.getByText("T", { exact: true }).count()));
    await p.locator("#kin-rail").waitFor({ timeout: 90000 });
    check("tải xong thì màn chờ biến mất, vào vỏ học viên", (await p.locator("[data-kin-loader]").count()) === 0);
    await ctx.close();
  }

  section("Người đặt 'giảm chuyển động' thì logo đứng yên nhưng vẫn hiện đủ");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 800 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route("**/api/auth/me", async route => { await new Promise(r => setTimeout(r, 4000)); await route.continue(); });
    const p = await ctx.newPage(); await p.emulateMedia({ reducedMotion: "reduce" });
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 150000 });
    const loader = p.locator("[data-kin-loader]");
    await loader.waitFor({ state: "visible", timeout: 90000 });
    const r = await loader.evaluate(el => Array.from(el.querySelectorAll("svg path")).map(x => ({ a: getComputedStyle(x).animationName, o: getComputedStyle(x).opacity })));
    check("giảm chuyển động: không hoạt hình, ba lưỡi hiện rõ (opacity 1)", r.length === 3 && r.every(x => x.a === "none" && x.o === "1"), r);
    await ctx.close();
  }

  // /giang-vien: khối "Top học viên" (chỗ chờ KinLoader) đã bỏ khi dựng lại trang khách theo Figma KH-02 (299:115283); trang dùng khung chờ thẻ gia sư. Bảng xếp hạng vẫn ở /bang-xep-hang.

  check("không có lỗi JavaScript trên trang nào", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
