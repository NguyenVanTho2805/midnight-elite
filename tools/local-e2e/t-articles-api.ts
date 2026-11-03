// BU-07 — API Tin tức công khai + phần admin tối thiểu (coverCaption, publishedAt). Cần dev server (BASE) và DB thử; KHÔNG chạy trong phiên viết mã.
// Chạy: source tools/local-e2e/env.example.sh && npx tsx tools/local-e2e/t-articles-api.ts
// Ca phá: nháp / lên lịch tương lai không lộ ở danh sách, ?slug=, POST view, sitemap, 404 giống từng byte; slug lạ; tham số sai → 400;
// spam lượt xem (cùng cookie, không cookie, bot, GET ?slug=, tải trang SSR); trường cấm; XSS; coverImage sửa tay; bài cũ publishedAt null.
import { prisma } from "@/lib/prisma";
import { api, mkSuper, wipe, BASE, check, section, done } from "./h";
const PAD = "Nội dung bổ sung cho đủ độ dài tối thiểu của bài viết (ADM-002: nội dung ≥ 100 ký tự). ".repeat(2);

const FORBIDDEN_LIST = ["content", "authorId", "published", "sourceUrl"];
const UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36";

async function view(slug: string, o: { cookie?: string; ua?: string; ip?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${BASE}/api/articles/${encodeURIComponent(slug)}/view`, {
    method: "POST", redirect: "manual",
    headers: { "user-agent": o.ua ?? UA, ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.ip ? { "x-forwarded-for": o.ip } : {}), ...(o.headers ?? {}) },
  });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, setCookie: res.headers.get("set-cookie") ?? "" };
}
const views = async (slug: string) => (await prisma.article.findUniqueOrThrow({ where: { slug } })).views;

async function main() {
  await wipe();
  const SA = await mkSuper();
  const mk = async (slug: string, o: Record<string, unknown> = {}) => {
    const r = await api("POST", "/api/admin/articles", { as: SA, body: { title: `Bài viết ${slug}`, slug, excerpt: "Tóm tắt.", content: `Đoạn một.\n\nĐoạn hai.\n\n${PAD}`, category: "tuyen-sinh", published: true, ...o } });
    if (r.status !== 201) throw new Error(`tạo ${slug}: ${r.status} ${r.text}`);
    return r.json;
  };
  const hourLater = new Date(Date.now() + 3600_000).toISOString();

  await mk("dang-hien");
  await mk("nhap", { published: false });
  const lich = await mk("len-lich", { publishedAt: hourLater });
  await prisma.article.create({ data: { slug: "bai-cu", title: "Bài cũ", excerpt: "x", content: "x", category: "hoc-thuat", author: "A", authorId: "", published: true, publishedAt: null } });

  section("1. Nháp không lộ");
  const list = await api("GET", "/api/articles");
  const slugs = (list.json as any[]).map(a => a.slug);
  check("danh sách có bài đã đăng + bài cũ (publishedAt null), không có nháp / lịch", slugs.includes("dang-hien") && slugs.includes("bai-cu") && !slugs.includes("nhap") && !slugs.includes("len-lich"), slugs);
  const miss = await api("GET", "/api/articles?slug=khong-co-bai-nay");
  for (const s of ["nhap", "len-lich"]) {
    const r = await api("GET", `/api/articles?slug=${s}`);
    check(`?slug=${s} = 404, thân GIỐNG TỪNG BYTE với slug không tồn tại`, r.status === 404 && r.text === miss.text, r.text);
    const v = await view(s);
    check(`POST view ${s} = 404 và không ghi`, v.status === 404 && (await views(s)) === 0, v.text);
  }
  const pageDraft = await fetch(`${BASE}/tin-tuc/nhap`).then(r => r.status);
  check("trang /tin-tuc/nhap = 404", pageDraft === 404, pageDraft);

  section("2. Lên lịch không lộ rồi hiện khi tới giờ");
  const sm = await fetch(`${BASE}/sitemap.xml`).then(r => r.text());
  check("sitemap: có bài đã đăng, không có nháp / lịch", sm.includes("/tin-tuc/dang-hien") && !sm.includes("/tin-tuc/nhap") && !sm.includes("/tin-tuc/len-lich") && !sm.includes("/admin") && !sm.includes("/api/"));
  const mostRead = await api("GET", "/api/articles?sort=xem-nhieu");
  check("Xem nhiều không có bài lịch", !(mostRead.json as any[]).some(a => a.slug === "len-lich"));
  await prisma.article.update({ where: { id: lich.id }, data: { publishedAt: new Date(Date.now() - 1000) } }); // không dùng sleep
  const after = await api("GET", "/api/articles?slug=len-lich");
  check("chỉnh publishedAt về quá khứ → hiện", after.status === 200 && after.json.slug === "len-lich", after.text);
  const adm = await api("POST", "/api/admin/articles", { as: SA, body: { title: "Tiêu đề đủ dài", slug: "lich-sai", excerpt: "x", content: PAD, category: "gia-su", published: true, publishedAt: "mai" } });
  check("admin: publishedAt sai định dạng → 400", adm.status === 400, adm.text);
  const adm2 = await api("POST", "/api/admin/articles", { as: SA, body: { title: "Tiêu đề đủ dài", slug: "chu-thich-dai", excerpt: "x", content: PAD, category: "gia-su", coverCaption: "x".repeat(201) } });
  check("admin: coverCaption 201 ký tự → 400", adm2.status === 400, adm2.text);
  const notif0 = await prisma.notification.count({ where: { type: "article_new" } });
  await mk("lich-xa", { publishedAt: new Date(Date.now() + 86400_000).toISOString() });
  check("admin: published:true + tương lai không gửi thông báo article_new", (await prisma.notification.count({ where: { type: "article_new" } })) === notif0);
  const row = await prisma.article.findUniqueOrThrow({ where: { slug: "lich-xa" } });
  check("admin: publishedAt lưu đúng giờ đã đặt", Math.abs((row.publishedAt?.getTime() ?? 0) - (Date.now() + 86400_000)) < 5000);
  const local = await api("POST", "/api/admin/articles", { as: SA, body: { title: "Tiêu đề đủ dài", slug: "gio-vn", excerpt: "x", content: PAD, category: "gia-su", published: true, publishedAt: new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 16) } });
  check("admin: chuỗi datetime-local không múi giờ nhận được (hiểu theo giờ VN)", local.status === 201, local.text);

  section("3. Slug lạ không gây 500");
  for (const s of ["../etc/passwd", "%00", "a%00b", "x".repeat(500), "%E0%A4%A", "'; DROP TABLE articles; --"]) {
    const r = await fetch(`${BASE}/api/articles?slug=${s}`);
    check(`?slug=${s.slice(0, 20)} → 404`, r.status === 404, r.status);
    const v = await fetch(`${BASE}/api/articles/${s}/view`, { method: "POST", headers: { "user-agent": UA } });
    // Đường dẫn hỏng mã hoá (%E0%A4%A) bị chính Next chặn 400 trước khi tới route → chấp nhận 400 hoặc 404; điều quan trọng là không 500 và không đếm.
    check(`POST view/${s.slice(0, 20)} → 404 (hoặc 400 do Next chặn đường dẫn hỏng)`, v.status === 404 || v.status === 400, v.status);
  }

  section("4. Tham số");
  for (const q of ["limit=0", "limit=51", "limit=abc", "limit=1.5", "limit=-1", "limit=", "sort=x", "muc=x", "muc='; DROP", "trang=0", "trang=abc"])
    check(`?${q} → 400`, (await api("GET", `/api/articles?${q}`)).status === 400, q);
  check("category lạ (cũ) không 400", (await api("GET", "/api/articles?category=khong-co")).status === 200);
  check("muc=all hợp lệ", (await api("GET", "/api/articles?muc=all")).status === 200);
  for (const [i, v] of [["a", 5], ["b", 20], ["c", 10]] as const) await prisma.article.create({ data: { slug: `xn-${i}`, title: i, excerpt: "x", content: "x", category: "tuyen-sinh", author: "A", authorId: "", published: true, publishedAt: new Date(), views: v, isPinned: i === "a" } });
  const top = await api("GET", "/api/articles?limit=2&muc=tuyen-sinh&sort=xem-nhieu");
  check("limit=2&muc&sort=xem-nhieu: 2 bài, đúng thứ tự views, KHÔNG ưu tiên ghim", top.status === 200 && top.json.length === 2 && top.json[0].slug === "xn-b" && top.json[1].slug === "xn-c", top.json?.map?.((a: any) => a.slug));
  const moi = await api("GET", "/api/articles?muc=tuyen-sinh");
  check("sort mặc định: bài ghim đứng đầu", moi.json[0].slug === "xn-a");
  const hocTap = await api("GET", "/api/articles?muc=hoc-thuat");
  check("muc=hoc-thuat gồm bài kinh-nghiem", (await prisma.article.create({ data: { slug: "kn-1", title: "kn", excerpt: "x", content: "x", category: "kinh-nghiem", author: "A", authorId: "", published: true, publishedAt: new Date() } })) && (await api("GET", "/api/articles?muc=hoc-thuat")).json.some((a: any) => a.slug === "kn-1") && hocTap.status === 200);
  check("limit mặc định 20", (await prisma.article.count({ where: { published: true } })) < 21 || (await api("GET", "/api/articles")).json.length <= 20);

  section("5. Lượt xem không tăng bằng spam");
  const v0 = await views("dang-hien");
  const first = await view("dang-hien", { ip: "10.0.0.1" });
  const cookie = first.setCookie.split(";")[0];
  check("lần đầu đếm, đặt cookie kin_av httpOnly", first.json?.counted === true && /^kin_av=/.test(cookie) && /httponly/i.test(first.setCookie), first.setCookie);
  check("không trả số lượt", !("views" in (first.json ?? {})));
  let extra = 0;
  for (let i = 0; i < 50; i++) { const r = await view("dang-hien", { cookie, ip: "10.0.0.1" }); if (r.json?.counted) extra++; }
  check("50 lần cùng cookie → views +1 duy nhất", extra === 0 && (await views("dang-hien")) === v0 + 1, { extra, v: await views("dang-hien"), v0 });
  const v1 = await views("dang-hien");
  let cl = 0;
  for (let i = 0; i < 50; i++) { const r = await view("dang-hien", { ip: "10.0.0.2" }); if (r.json?.counted) cl++; }
  check("50 lần không cookie cùng nguồn → ≤ 1 (1 lần/bài/giờ), chắc chắn ≤ trần 30", cl <= 1 && (await views("dang-hien")) - v1 === cl, cl);
  const v2 = await views("dang-hien");
  for (const ua of ["Googlebot/2.1", "HeadlessChrome/120", "curl/8", ""]) await view("dang-hien", { ua, ip: "10.0.0.3" });
  check("UA bot / rỗng → +0", (await views("dang-hien")) === v2);
  await view("dang-hien", { ip: "10.0.0.4", headers: { "sec-fetch-site": "cross-site" } });
  await view("dang-hien", { ip: "10.0.0.5", headers: { origin: "https://evil.example", host: new URL(BASE).host } });
  check("yêu cầu khác nguồn → +0", (await views("dang-hien")) === v2);
  for (let i = 0; i < 20; i++) await api("GET", "/api/articles?slug=dang-hien");
  check("GET ?slug= 20 lần → +0", (await views("dang-hien")) === v2);
  for (let i = 0; i < 20; i++) await fetch(`${BASE}/tin-tuc/dang-hien`, { headers: { "user-agent": UA } }).then(r => r.text());
  check("tải trang HTML /tin-tuc/<slug> 20 lần (SSR) → +0", (await views("dang-hien")) === v2);
  check("GET …/view = 405", (await fetch(`${BASE}/api/articles/dang-hien/view`)).status === 405);

  section("6. Khách không thấy trường cấm");
  const l2 = await api("GET", "/api/articles");
  check("danh sách không có content / authorId / published / sourceUrl", (l2.json as any[]).every(a => FORBIDDEN_LIST.every(k => !(k in a))), Object.keys(l2.json[0]));
  const one = await api("GET", "/api/articles?slug=dang-hien");
  check("?slug= không có authorId / published, có content và coverCaption", !("authorId" in one.json) && !("published" in one.json) && "content" in one.json && "coverCaption" in one.json, Object.keys(one.json));
  check("header Cache-Control công khai", /s-maxage=60/.test(l2.headers.get("cache-control") ?? ""));

  section("7. XSS");
  const evil = await mk("xss", { title: "</script><script>alert(1)</script>", content: "<script>alert(1)</script> " + PAD, coverCaption: '"><img src=x onerror=alert(1)>', coverImage: "https://cdn.example.edu.vn/a.png" });
  const ev = await api("GET", "/api/articles?slug=xss");
  check("API trả nguyên văn (không thoát hộ)", ev.json.content.startsWith("<script>alert(1)</script>") && ev.json.coverCaption === '"><img src=x onerror=alert(1)>' && ev.json.title.includes("</script>"));
  const html = await fetch(`${BASE}/tin-tuc/xss`).then(r => r.text());
  check("HTML không chứa <script>alert(1) do nội dung sinh ra", !html.includes("<script>alert(1)</script>") && !html.includes('onerror=alert(1)>'));
  check("coverCaption hiện thành chữ (đã thoát)", html.includes("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"));
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  check("JSON-LD parse được và không đóng <script> sớm", ld.length >= 1 && ld.every(t => { try { JSON.parse(t); return true; } catch { return false; } }) && !ld.some(t => t.includes("<")));
  void evil;

  section("8. coverImage sửa tay trong DB");
  await prisma.article.update({ where: { slug: "xss" }, data: { coverImage: "javascript:alert(1)", sourceUrl: "javascript:alert(2)", sourceName: "Gian" } });
  const bad = await api("GET", "/api/articles?slug=xss");
  check("?slug=: coverImage / sourceUrl / sourceName = null", bad.json.coverImage === null && bad.json.sourceUrl === null && bad.json.sourceName === null, bad.json);
  check("danh sách: coverImage = null", (await api("GET", "/api/articles")).json.find((a: any) => a.slug === "xss").coverImage === null);
  const badHtml = await fetch(`${BASE}/tin-tuc/xss`).then(r => r.text());
  check("trang không có javascript: trong src/href", !/(?:src|href)="javascript:/i.test(badHtml));

  section("9. Bài cũ publishedAt = null");
  const old = await api("GET", "/api/articles?slug=bai-cu");
  check("hiện ở ?slug=", old.status === 200 && old.json.publishedAt === null);
  check("hiện ở sitemap", (await fetch(`${BASE}/sitemap.xml`).then(r => r.text())).includes("/tin-tuc/bai-cu"));
  const v = await view("bai-cu", { ip: "10.0.0.9" });
  check("đếm được lượt xem", v.json?.counted === true);

  section("10. Admin PATCH");
  const p1 = await api("PATCH", `/api/admin/articles/${lich.id}`, { as: SA, body: { coverCaption: "Chú thích mới", publishedAt: "" } });
  check("PATCH coverCaption lưu; publishedAt trống không làm mất giờ đã qua", p1.status === 200 && p1.json.coverCaption === "Chú thích mới" && new Date(p1.json.publishedAt).getTime() <= Date.now());
  check("PATCH coverCaption 201 ký tự → 400", (await api("PATCH", `/api/admin/articles/${lich.id}`, { as: SA, body: { coverCaption: "x".repeat(201) } })).status === 400);
  check("PATCH publishedAt rác → 400", (await api("PATCH", `/api/admin/articles/${lich.id}`, { as: SA, body: { publishedAt: "hôm qua" } })).status === 400);
  const future = new Date(Date.now() + 5 * 86400_000).toISOString();
  const p2 = await api("PATCH", `/api/admin/articles/${lich.id}`, { as: SA, body: { publishedAt: future } });
  check("PATCH đặt lịch tương lai → bài ẩn khỏi khách", p2.status === 200 && (await api("GET", "/api/articles?slug=len-lich")).status === 404);
  const p3 = await api("PATCH", `/api/admin/articles/${lich.id}`, { as: SA, body: { publishedAt: "" } });
  check("PATCH xoá giờ khi đang lên lịch → đăng ngay, hiện lại", p3.status === 200 && (await api("GET", "/api/articles?slug=len-lich")).status === 200);
  check("API admin vẫn cần quyền (không cookie → không phải 200)", (await api("PATCH", `/api/admin/articles/${lich.id}`, { body: { coverCaption: "x" } })).status !== 200);

  await done();
}
main().catch(async e => { console.error(e); await done(); });
