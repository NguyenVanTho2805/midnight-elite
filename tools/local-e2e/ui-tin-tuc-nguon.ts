// NC2-051 — bài Tin tức dán từ bài đăng Facebook (trình duyệt thật + cơ sở dữ liệu thật). Quản trị: ô "Dán nhanh" điền tiêu đề / tóm tắt / nội dung / danh mục,
// báo lỗi nguồn + ảnh bìa đúng ô, lưu, mở lại để sửa (không còn ô dán), xoá nguồn. Công khai: bài hiện như bài báo — ảnh bìa, "Nguồn: …" có link an toàn;
// ảnh bìa hết hạn thì bỏ khung ảnh mà bài vẫn đọc được; bài không nguồn không có dòng "Nguồn"; 390px không tràn ngang.
import { BASE, api, mkSuper, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, ADMIN, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

// Ảnh giả dạng SVG có kích thước thật (ngang 800×500, đứng 800×1000) để đo tỉ lệ; tên miền ảnh không có mạng nên phải chặn và trả thay.
const svg = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#e66"/></svg>`;
const FB = "🎓 THÔNG BÁO: Điểm chuẩn ĐH Mẫu 2026\n\nTrường vừa công bố điểm chuẩn năm 2026.\nNgành Công nghệ thông tin: 27,5 điểm.\n\n#tuyensinh #diemchuan";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 500)}`); }); };

  // ───────────── Quản trị
  section("Quản trị: dán nhanh từ bài Facebook");
  const ca = await ctxFor(SA, { width: 1280, height: 1000 });
  const ap = await ca.newPage(); watch(ap);
  await ap.goto(`${ADMIN}/admin/tin-tuc`, { waitUntil: "domcontentloaded", timeout: 150000 });
  const addBtn = ap.getByRole("button", { name: "+ Thêm bài viết", exact: true });
  await addBtn.waitFor({ timeout: 120000 });
  await addBtn.click();
  const paste = ap.locator("[data-fb-paste]");
  await paste.waitFor({ timeout: 30000 });
  check("ngăn tạo bài có ô 'Dán nhanh từ bài đăng Facebook' và ba ô nguồn / tên nguồn / ảnh bìa", await paste.isVisible() && await ap.locator("#art-source-url").isVisible() && await ap.locator("#art-source-name").isVisible() && await ap.locator("#art-cover").isVisible());
  check("ô dán nói rõ 'Sẽ thay tiêu đề, tóm tắt và nội dung đang có' và 'Chưa lưu gì'", /Sẽ thay tiêu đề, tóm tắt và nội dung/.test(await paste.innerText()) && /Chưa lưu gì/.test(await paste.innerText()));
  check("nhắc link ảnh Facebook (scontent…) hay hết hạn", /hết hạn/.test(await ap.locator("[data-article-source]").innerText()));

  await paste.getByRole("button", { name: "Điền vào form" }).click();
  check("bấm 'Điền vào form' khi chưa dán gì → báo 'Chưa có nội dung', form KHÔNG bị điền", /Chưa có nội dung/.test(await ap.locator("[data-fb-msg]").innerText()) && (await ap.locator("input[placeholder^='VD: ĐGNL']").inputValue()) === "");
  await ap.fill("#art-fb-paste", "   \n  \t ");
  await paste.getByRole("button", { name: "Điền vào form" }).click();
  check("dán toàn khoảng trắng → cũng báo 'Chưa có nội dung'", /Chưa có nội dung/.test(await ap.locator("[data-fb-msg]").innerText()));

  await ap.fill("#art-fb-paste", FB);
  await paste.getByRole("button", { name: "Điền vào form" }).click();
  const title = ap.locator("input[placeholder^='VD: ĐGNL']");
  await eventually("điền tiêu đề = dòng đầu của bài dán", async () => (await title.inputValue()) === "🎓 THÔNG BÁO: Điểm chuẩn ĐH Mẫu 2026", 8000);
  check("slug tự sinh từ tiêu đề (bỏ biểu tượng và dấu)", (await ap.locator("input[placeholder='vd-dgnl-hsa-2026']").inputValue()) === "thong-bao-diem-chuan-dh-mau-2026", await ap.locator("input[placeholder='vd-dgnl-hsa-2026']").inputValue());
  check("nội dung = phần còn lại (không lặp tiêu đề), tóm tắt = nội dung dồn một dòng", (await ap.locator("textarea[placeholder^='Viết nội dung']").inputValue()).startsWith("Trường vừa công bố điểm chuẩn năm 2026.") && (await ap.locator("textarea[placeholder^='Mô tả ngắn']").inputValue()).startsWith("Trường vừa công bố điểm chuẩn năm 2026. Ngành Công nghệ thông tin: 27,5 điểm."));
  check("danh mục tự chuyển sang 'Tuyển sinh'", (await ap.locator("select").first().inputValue()) === "tuyen-sinh");
  check("có dòng báo 'Đã điền vào form bên dưới…' (role=status) và CHƯA có bài nào trong DB", /Đã điền vào form/.test(await ap.locator("[data-fb-msg]").innerText()) && (await prisma.article.count()) === 0);
  await shot(ap, "tin-tuc-dan-nhanh");

  section("Quản trị: báo lỗi nguồn / ảnh bìa đúng ô, không lưu");
  const save = ap.getByRole("button", { name: "Tạo bài viết" });
  await ap.fill("#art-source-url", "javascript:alert(1)");
  await save.click();
  await eventually("nguồn javascript: → lỗi ngay dưới ô nguồn, KHÔNG có bài trong DB", async () => /Đường dẫn nguồn không hợp lệ/.test(await ap.locator("[data-article-source]").innerText()) && (await prisma.article.count()) === 0, 8000);
  await ap.fill("#art-source-url", "https://www.facebook.com/kin.edu/posts/123");
  await ap.fill("#art-cover", "http://cdn.example.edu.vn/bia.png");
  await save.click();
  await eventually("ảnh bìa http → lỗi 'Ảnh bìa phải là đường dẫn https' ngay dưới ô ảnh; lỗi nguồn cũ đã hết", async () => { const t = await ap.locator("[data-article-source]").innerText(); return /Ảnh bìa phải là đường dẫn https/.test(t) && !/Đường dẫn nguồn không hợp lệ/.test(t) && (await prisma.article.count()) === 0; }, 8000);
  await ap.fill("#art-source-name", "Fanpage KiN <b>chính thức</b>");
  await ap.fill("#art-cover", "https://cdn.example.edu.vn/bia.png");

  section("Quản trị: lưu rồi mở lại để sửa");
  await save.click();
  await eventually("lưu thành công: ngăn đóng, DB có 1 bài (nháp) với đủ nguồn, tên nguồn, ảnh bìa, danh mục Tuyển sinh", async () => {
    const n = await prisma.article.count(); if (n !== 1) return false;
    const a = await prisma.article.findFirstOrThrow();
    return a.sourceUrl === "https://www.facebook.com/kin.edu/posts/123" && a.sourceName === "Fanpage KiN <b>chính thức</b>" && a.coverImage === "https://cdn.example.edu.vn/bia.png" && a.category === "tuyen-sinh" && !a.published && a.slug === "thong-bao-diem-chuan-dh-mau-2026";
  }, 20000);
  const row = ap.locator("tbody tr", { hasText: "THÔNG BÁO: Điểm chuẩn ĐH Mẫu 2026" });
  await row.waitFor({ timeout: 20000 });
  await row.getByRole("button", { name: "···" }).click();
  await ap.getByRole("button", { name: /Chỉnh sửa/ }).click();
  await ap.locator("#art-source-url").waitFor({ timeout: 20000 });
  await eventually("mở lại: ba ô nguồn được điền lại từ DB", async () => (await ap.locator("#art-source-url").inputValue()) === "https://www.facebook.com/kin.edu/posts/123" && (await ap.locator("#art-source-name").inputValue()) === "Fanpage KiN <b>chính thức</b>" && (await ap.locator("#art-cover").inputValue()) === "https://cdn.example.edu.vn/bia.png", 8000);
  check("mở để SỬA: KHÔNG có ô 'Dán nhanh' (tránh dán đè nhầm lên bài đã có)", (await ap.locator("[data-fb-paste]").count()) === 0);
  await ap.fill("#art-source-url", "");
  await ap.getByRole("button", { name: "Cập nhật" }).click();
  await eventually("xoá link nguồn rồi Cập nhật → DB: link VÀ tên nguồn cùng null, ảnh bìa còn", async () => { const a = await prisma.article.findFirstOrThrow(); return a.sourceUrl === null && a.sourceName === null && a.coverImage === "https://cdn.example.edu.vn/bia.png"; }, 20000);

  // ───────────── Công khai
  section("Công khai: bài hiện như bài báo, có nguồn");
  const mk = (slug: string, o: Record<string, unknown> = {}) => api("POST", "/api/admin/articles", { as: SA, body: { title: `Bài ${slug}`, slug, excerpt: "Tóm tắt.", content: "Đoạn một.\n\nĐoạn hai.", category: "tuyen-sinh", published: true, ...o } });
  await mk("co-nguon", { title: "Điểm chuẩn ĐH Mẫu 2026", sourceUrl: "https://www.facebook.com/kin.edu/posts/123", sourceName: "Fanpage <b>KiN</b>", coverImage: "https://cdn.example.edu.vn/bia.png" });
  await mk("anh-doc", { sourceUrl: "https://example.edu.vn/poster", coverImage: "https://cdn.example.edu.vn/doc.svg" });
  await mk("anh-het-han", { sourceUrl: "https://example.edu.vn/tb", coverImage: "https://cdn.example.edu.vn/het-han.png" });
  await mk("khong-nguon");
  check("(chuẩn bị) 4 bài công khai", (await prisma.article.count({ where: { published: true } })) === 4);

  const cg = await ctxFor(null, { width: 1280, height: 900 });
  await cg.route("https://cdn.example.edu.vn/bia.png", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(800, 500) }));
  await cg.route("https://cdn.example.edu.vn/doc.svg", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(800, 1000) }));
  await cg.route("https://cdn.example.edu.vn/het-han.png", r => r.fulfill({ status: 403, body: "expired" }));
  const gp = await cg.newPage(); watch(gp);
  await gp.goto(`${BASE}/tin-tuc/co-nguon`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.getByRole("heading", { level: 1, name: "Điểm chuẩn ĐH Mẫu 2026" }).waitFor({ timeout: 120000 });
  const src = gp.locator("[data-article-source]");
  await src.waitFor({ timeout: 30000 });
  const link = src.getByRole("link");
  check("có dòng 'Nguồn:' kèm link", /^Nguồn:/.test((await src.innerText()).trim()));
  check("tên nguồn hiện NGUYÊN VĂN như chữ (thẻ HTML trong tên không được chạy)", /Fanpage <b>KiN<\/b>/.test(await link.innerText()) && (await gp.locator("[data-article-source] b").count()) === 0, await link.innerText());
  const rel = (await link.getAttribute("rel")) ?? "";
  check("link: đúng địa chỉ, mở tab mới, rel có noopener + noreferrer + nofollow", (await link.getAttribute("href")) === "https://www.facebook.com/kin.edu/posts/123" && (await link.getAttribute("target")) === "_blank" && ["noopener", "noreferrer", "nofollow"].every(w => rel.includes(w)), rel);
  check("link cao ≥ 44px (chạm được trên điện thoại)", ((await link.boundingBox())?.height ?? 0) >= 44, await link.boundingBox());
  const cover = gp.locator("[data-article-cover]");
  await eventually("ảnh bìa hiện, tải được (naturalWidth > 0)", async () => (await cover.count()) === 1 && (await cover.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)), 10000);
  check("ảnh bìa: referrerpolicy=no-referrer (không lộ trang đang đọc), loading=lazy, có chữ thay thế", (await cover.getAttribute("referrerpolicy")) === "no-referrer" && (await cover.getAttribute("loading")) === "lazy" && /Ảnh bìa: Điểm chuẩn/.test((await cover.getAttribute("alt")) ?? ""));
  // Chuỗi thay vì hàm: tsx chèn __name() vào hàm có tên và trình duyệt không có hàm đó.
  check("thứ tự trên trang: tiêu đề → ảnh bìa → nội dung → nguồn", await gp.evaluate(`(() => {
    const top = (el) => el ? el.getBoundingClientRect().top : -1;
    const h = top(document.querySelector("h1")), c = top(document.querySelector("[data-article-cover]"));
    const p = top(Array.from(document.querySelectorAll("p")).find(e => e.textContent === "Đoạn một."));
    const s = top(document.querySelector("[data-article-source]"));
    return h >= 0 && h < c && c < p && p < s;
  })()`));
  await shot(gp, "tin-tuc-co-nguon");

  section("Công khai: ảnh KHÔNG bị cắt (poster dạng đứng)");
  const ratioOf = (p: Page) => p.evaluate(`(() => { const i = document.querySelector("[data-article-cover]"); const r = i.getBoundingClientRect(); return { w: r.width, h: r.height, nw: i.naturalWidth, nh: i.naturalHeight, fit: getComputedStyle(i).objectFit }; })()`) as Promise<{ w: number; h: number; nw: number; nh: number; fit: string }>;
  await eventually("ảnh ngang 800×500: hiện đúng tỉ lệ 1,6 (không méo, không cắt)", async () => { const r = await ratioOf(gp).catch(() => null); return !!r && r.nw === 800 && Math.abs(r.w / r.h - 1.6) < 0.02; }, 10000);
  await gp.goto(`${BASE}/tin-tuc/anh-doc`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.locator("[data-article-cover]").waitFor({ timeout: 120000 });
  await eventually("ảnh ĐỨNG 800×1000: giữ tỉ lệ 0,8, cao ≤ 560px, KHÔNG object-fit cover (poster không mất chữ)", async () => { const r = await ratioOf(gp).catch(() => null); return !!r && r.nh === 1000 && Math.abs(r.w / r.h - 0.8) < 0.02 && r.h <= 560.5 && r.fit !== "cover"; }, 10000);
  await shot(gp, "tin-tuc-anh-doc");

  section("Công khai: ảnh hết hạn, bài không nguồn, 390px");
  await gp.goto(`${BASE}/tin-tuc/anh-het-han`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.getByRole("heading", { level: 1, name: "Bài anh-het-han" }).waitFor({ timeout: 120000 });
  await eventually("ảnh bìa không tải được (403) → khung ảnh BIẾN MẤT; bài và dòng Nguồn vẫn còn", async () => (await gp.locator("[data-article-cover]").count()) === 0 && await gp.getByText("Đoạn hai.").isVisible() && await gp.locator("[data-article-source]").isVisible(), 10000);
  await gp.goto(`${BASE}/tin-tuc/khong-nguon`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.getByRole("heading", { level: 1, name: "Bài khong-nguon" }).waitFor({ timeout: 120000 });
  check("bài không nguồn: không có dòng 'Nguồn', không có ảnh bìa", (await gp.locator("[data-article-source]").count()) === 0 && (await gp.locator("[data-article-cover]").count()) === 0);
  const cm = await ctxFor(null, { width: 390, height: 844 });
  await cm.route("https://cdn.example.edu.vn/bia.png", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(800, 500) }));
  const mp = await cm.newPage(); watch(mp);
  await mp.goto(`${BASE}/tin-tuc/co-nguon`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await mp.locator("[data-article-source]").waitFor({ timeout: 120000 });
  check("390px: không tràn ngang", (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await shot(mp, "tin-tuc-co-nguon-390");

  check("không lỗi JS / console trên mọi trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
