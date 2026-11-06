// BU-07 — /tin-tuc và /tin-tuc/[slug] bằng trình duyệt thật (1600 và 390, khách và học sinh). VIẾT, chưa chạy (cần máy chủ dev + DB).
// Bài mẫu tự tạo bằng prisma (đề xuất D7: không đụng seed): 5 bài hiện (tuyển sinh có ghim + ảnh, học tập, KiN ×2, bài cũ publishedAt=null),
// 1 NHÁP, 1 LÊN LỊCH tương lai thuộc mục Gia sư → khối "Gia sư" phải ẩn hẳn. Ảnh bìa chặn mạng, trả SVG 800×500.
import { BASE, api, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const svg = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="currentColor"/></svg>`;
const H = 3600_000;

(async () => {
  await wipe();
  const S = await mkUser({ name: "Học Sinh Thử" });
  const now = Date.now();
  const mk = (slug: string, category: string, o: Record<string, unknown> = {}) => prisma.article.create({
    data: {
      slug, title: `Bài ${slug}`, excerpt: `Sapo của bài ${slug}.`, content: `Đoạn một của ${slug}.\n\nĐoạn hai.`, category, author: "Admin", authorId: S.id,
      published: true, publishedAt: new Date(now - 2 * H), ...o,
    },
  });
  await mk("ts-ghim", "tuyen-sinh", { isPinned: true, coverImage: "https://cdn.example.edu.vn/a.png", coverCaption: "Thí sinh làm thủ tục", sourceUrl: "https://example.edu.vn/tb", views: 5 });
  await mk("ts-hai", "tuyen-sinh", { coverImage: "https://cdn.example.edu.vn/b.png", publishedAt: new Date(now - 3 * H), views: 9 });
  await mk("ht-mot", "hoc-thuat", { publishedAt: new Date(now - 4 * H), views: 20 });
  await mk("kin-mot", "tin-midnight", { publishedAt: new Date(now - 5 * H), author: "Cô Lan" });
  await mk("kin-cu", "tin-midnight", { publishedAt: null, views: 1 });
  await mk("nhap-1", "hoc-thuat", { published: false, publishedAt: null });
  await mk("lich-1", "gia-su", { publishedAt: new Date(now + 3 * H) });
  check("(chuẩn bị) 7 bài trong DB, 5 hiện được", (await prisma.article.count()) === 7);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 400)}`); }); };
  const anh = async (c: Awaited<ReturnType<typeof ctxFor>>) => c.route("https://cdn.example.edu.vn/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(800, 500) }));
  const go = async (p: Page, path: string) => { await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 150000 }); };

  // ───────────── Khách, 1600
  section("Khách 1600: nổi bật / phụ / khối / Xem nhiều");
  const cg = await ctxFor(null, { width: 1600, height: 1000 }); await anh(cg);
  const g = await cg.newPage(); watch(g);
  await go(g, "/tin-tuc");
  await g.getByRole("heading", { level: 1, name: "Tin tức" }).waitFor({ timeout: 120000 });
  const nb = g.locator("[data-tin=noi-bat]:visible");
  check("bài nổi bật = bài GHIM (ts-ghim)", /Bài ts-ghim/.test(await nb.innerText()));
  await eventually("ảnh bìa nổi bật rộng ≥ 600 ở 1600", async () => ((await nb.locator("img").first().boundingBox())?.width ?? 0) >= 600, 10000);
  check("cột tin phụ có mặt, rộng 280", Math.abs(((await g.locator("[data-tin=phu]:visible").boundingBox())?.width ?? 0) - 280) <= 2);
  check("khối Tuyển sinh, Học tập, KiN hiện; khối Gia sư (chỉ có bài lên lịch) ẨN HẲN", (await g.locator("[data-khoi]:visible").evaluateAll(els => els.map(e => e.getAttribute("data-khoi")))).join() === "tuyen-sinh,hoc-thuat,tin-midnight");
  check("nháp và bài lên lịch không xuất hiện ở đâu trên trang", (await g.locator("body").innerText()).indexOf("nhap-1") < 0 && (await g.locator("body").innerText()).indexOf("lich-1") < 0);
  check("Xem nhiều: ≤5 mục, không có số lượt xem", await g.locator("[data-xem-nhieu=doc] li").count() <= 5 && !/lượt xem/i.test(await g.locator("[data-xem-nhieu=doc]").innerText()));
  check("thanh chuyên mục là LIÊN KẾT ?muc=", (await g.getByRole("navigation", { name: "Chuyên mục tin tức" }).getByRole("link", { name: "Tuyển sinh" }).getAttribute("href")) === "/tin-tuc?muc=tuyen-sinh");
  check("1600 không tràn ngang", (await g.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await shot(g, "tin-tuc-1600");

  section("Khách 1600: một chuyên mục");
  await go(g, "/tin-tuc?muc=hoc-thuat");
  await g.getByRole("heading", { level: 1, name: "Học tập" }).waitFor({ timeout: 120000 });
  const dsMuc = await g.locator("[data-ds-muc]").innerText();
  check("?muc=hoc-thuat chỉ còn bài mục Học tập (danh sách bài; cột Xem nhiều là của mọi mục nên không tính)", /Bài ht-mot/.test(dsMuc) && !/Bài ts-ghim|Bài kin-mot/.test(dsMuc));
  await go(g, "/tin-tuc?muc=khong-co");
  await g.getByRole("heading", { level: 1, name: "Tin tức" }).waitFor({ timeout: 120000 });
  check("?muc= lạ → coi như tất cả (không 404)", await g.locator("[data-tin=noi-bat]:visible").count() === 1);

  // ───────────── Trang bài
  section("Trang bài: thứ tự báo điện tử");
  await go(g, "/tin-tuc/ts-ghim");
  await g.getByRole("heading", { level: 1, name: "Bài ts-ghim" }).waitFor({ timeout: 120000 });
  await eventually("ảnh bìa tải được", async () => g.locator("[data-article-cover]").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), 10000);
  check("thứ tự DOM: meta → h1 → chia sẻ → sapo → ảnh bìa → nội dung → tác giả → nguồn → trở lại",
    await g.evaluate(`(() => {
      const sel = ["[data-article-meta]", "h1", "[data-chia-se-bai]", "[data-article-sapo]", "[data-article-cover]", "[data-article-content]", "[data-article-author]", "[data-article-source]", "[data-tro-lai]"];
      const els = sel.map(s => document.querySelector(s));
      if (els.some(e => !e)) return false;
      for (let i = 1; i < els.length; i++) if (!(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      return true;
    })()`));
  check("(05/11) dòng meta có 'N phút đọc' tính từ nội dung (bài mẫu ngắn → 1 phút đọc)", /1 phút đọc/.test(await g.locator("[data-article-readtime]").innerText()));
  const inBtn = g.locator("[data-in-bai]");
  check("(05/11) nút 'In bài' có ở thanh chia sẻ, cao ≥44px", (await inBtn.isVisible()) && ((await inBtn.boundingBox())?.height ?? 0) >= 44);
  await g.evaluate(`window.__printed = 0; window.print = () => { window.__printed++; }`);
  await inBtn.click();
  check("(05/11) bấm 'In bài' gọi hộp thoại in đúng một lần", (await g.evaluate(`window.__printed`)) === 1);
  check("chú thích ảnh hiện thành chữ", /Thí sinh làm thủ tục/.test(await g.locator("[data-article-caption]").innerText()));
  check("không còn dòng 'lượt xem' công khai; tác giả 'Admin' hiện là 'KiN'", !/lượt xem/i.test(await g.locator("article").innerText()) && (await g.locator("[data-article-author]").innerText()).trim() === "KiN");
  check("'Trở lại' trỏ đúng mục Tuyển sinh", (await g.locator("[data-tro-lai]").getAttribute("href")) === "/tin-tuc?muc=tuyen-sinh");
  const lq = await g.locator("[data-tin-lien-quan] li").evaluateAll(els => els.map(e => e.querySelector("a:last-of-type")?.getAttribute("href")));
  check("Tin liên quan ≤4 và không chứa chính bài", lq.length > 0 && lq.length <= 4 && !lq.includes("/tin-tuc/ts-ghim"), lq);
  check("khối 'Nguồn' còn: rel đủ noopener noreferrer nofollow, cao ≥44", await (async () => { const a = g.locator("[data-article-source] a"); const rel = (await a.getAttribute("rel")) ?? ""; return ["noopener", "noreferrer", "nofollow"].every(w => rel.includes(w)) && ((await a.boundingBox())?.height ?? 0) >= 44; })());
  await shot(g, "tin-tuc-bai-1600");

  section("Trang bài: 404 cho nháp / lịch / lạ");
  for (const s of ["nhap-1", "lich-1", "khong-ton-tai"]) {
    const r = await api("GET", `/tin-tuc/${s}`);
    check(`/tin-tuc/${s} → 404 có noindex`, r.status === 404 && /noindex/i.test(r.text), r.status);
  }

  section("<head>: og:title, og:image tuyệt đối, canonical");
  for (const [path, kind] of [["/tin-tuc", "list"], ["/tin-tuc/ts-ghim", "bai"]] as const) {
    const r = await api("GET", path);
    check(`${path}: có og:title`, /property="og:title" content="[^"]+/.test(r.text));
    check(`${path}: og:image là URL tuyệt đối https`, /property="og:image" content="https:\/\/[^"]+/.test(r.text));
    check(`${path}: có canonical`, /rel="canonical" href="https:\/\/[^"]+\/tin-tuc/.test(r.text));
    if (kind === "bai") check("bài: có JSON-LD NewsArticle và không có '</script>' sớm", /"@type":"NewsArticle"/.test(r.text));
  }

  // ───────────── Điện thoại 390
  section("Khách 390: kiểu Threads");
  const cm = await ctxFor(null, { width: 390, height: 844 }); await anh(cm);
  const m = await cm.newPage(); watch(m);
  await go(m, "/tin-tuc");
  await m.locator("[data-dong-tin]:visible").first().waitFor({ timeout: 120000 });
  check("390: không tràn ngang", (await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  check("390: có dòng tin và dải 'Xem nhiều' ngang", await m.locator("[data-dong-tin]:visible").count() >= 3 && await m.locator("[data-xem-nhieu=ngang]:visible").count() === 1);
  const chia = m.locator("[data-dong-tin]:visible [data-chia-se]").first();
  check("390: nút Chia sẻ ≥44px", ((await chia.boundingBox())?.height ?? 0) >= 44, await chia.boundingBox());
  check("390: liên kết 'Mở' ≥44px", ((await m.locator("[data-dong-tin]:visible [data-dong-mo]").first().boundingBox())?.height ?? 0) >= 44);
  await shot(m, "tin-tuc-390");
  await go(m, "/tin-tuc/ts-ghim");
  await m.getByRole("heading", { level: 1, name: "Bài ts-ghim" }).waitFor({ timeout: 120000 });
  check("390: trang bài không tràn ngang", (await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await shot(m, "tin-tuc-bai-390");

  // ───────────── Học sinh đăng nhập
  section("Học sinh: cùng nội dung trong StudentShell");
  const cs = await ctxFor(S, { width: 1600, height: 1000, rail: "rong" }); await anh(cs);
  const s = await cs.newPage(); watch(s);
  await go(s, "/tin-tuc");
  await s.waitForURL(/\/tin-tuc/, { timeout: 120000 });
  await s.locator("[data-tin=noi-bat]:visible").waitFor({ timeout: 120000 });
  await eventually("có vỏ học sinh (nhãn vai .kin-rail-role)", async () => (await s.locator(".kin-rail-role").count()) > 0, 20000);
  await eventually("mục 'Tin tức' ở thanh bên sáng (aria-current)", async () => (await s.locator('[aria-current="page"]', { hasText: "Tin tức" }).count()) > 0, 10000);
  check("cùng bài nổi bật như khách", /Bài ts-ghim/.test(await s.locator("[data-tin=noi-bat]:visible").innerText()));
  await go(s, "/student/tin-tuc");
  await s.waitForURL(url => url.pathname === "/tin-tuc", { timeout: 60000 });
  check("/student/tin-tuc chuyển tới /tin-tuc", new URL(s.url()).pathname === "/tin-tuc");
  await shot(s, "tin-tuc-hoc-sinh");

  check("không lỗi JS / console trên mọi trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
