// BU-07 — kẻ tấn công bổ sung cho Tin tức (HTTP vào máy chủ dev + DB thử). VIẾT, chưa chạy (COO chạy tuần tự).
// Chạy: source tools/local-e2e/env.example.sh && npx tsx tools/local-e2e/t-articles-attack.ts
// Phủ: nháp/lên lịch lộ ở TRANG / tin liên quan / khối trang chủ / Xem nhiều / metadata; khách + học sinh + gia sư gọi API admin bài viết;
// học sinh vào /admin; thông báo article_new không tên/số; slug khoảng trắng; category chứa NUL; XFF xoay vòng; XSS ở title/author/tag.
import { prisma } from "@/lib/prisma";
import { api, mkSuper, mkUser, mkTutor, wipe, BASE, check, section, done, cookieFor } from "./h";

const UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const get = (p: string, h: Record<string, string> = {}) => fetch(BASE + p, { redirect: "manual", headers: { "user-agent": UA, ...h } }).then(async r => ({ status: r.status, text: await r.text(), headers: r.headers }));

(async () => {
  await wipe();
  const SA = await mkSuper();
  const ST = await mkUser({ name: "Nguyễn Văn Hạnh Sinh" });
  const TU = await mkTutor();
  const H = 3600_000, now = Date.now();
  const mk = (slug: string, o: Record<string, unknown> = {}) => prisma.article.create({
    data: { slug, title: `Tiêu đề ${slug}`, excerpt: `Sapo ${slug}`, content: `Nội dung ${slug}`, category: "tuyen-sinh", author: "Admin", authorId: SA.id, published: true, publishedAt: new Date(now - H), ...o },
  });
  await mk("ra-mat");
  await mk("ra-mat-2");
  const nhap = await mk("bi-mat-nhap", { published: false, publishedAt: null, title: "TIEUDE_NHAP_BIMAT", views: 99999 });
  const lich = await mk("bi-mat-lich", { publishedAt: new Date(now + 2 * H), title: "TIEUDE_LICH_BIMAT", views: 88888, isPinned: true });
  const BI = ["TIEUDE_NHAP_BIMAT", "TIEUDE_LICH_BIMAT", "bi-mat-nhap", "bi-mat-lich"];
  const leak = (t: string) => BI.filter(x => t.includes(x));

  section("1. Nháp / lên lịch không lộ qua TRANG, tin liên quan, khối trang chủ, Xem nhiều, metadata");
  for (const path of ["/tin-tuc", "/tin-tuc?muc=tuyen-sinh", "/tin-tuc?muc=tuyen-sinh&trang=1", "/tin-tuc/ra-mat", "/tin-tuc/ra-mat-2", "/sitemap.xml", "/api/articles", "/api/articles?sort=xem-nhieu&limit=50", "/api/articles?muc=tuyen-sinh&limit=50"]) {
    const r = await get(path);
    check(`${path}: không có tiêu đề / slug của nháp hoặc bài lịch (kể cả bài ghim 88888 lượt)`, r.status === 200 && leak(r.text).length === 0, { status: r.status, leak: leak(r.text) });
  }
  const miss = await get("/tin-tuc/khong-co-bai-nay");
  for (const s of ["bi-mat-nhap", "bi-mat-lich"]) {
    const r = await get(`/tin-tuc/${s}`);
    // Slug yêu cầu có thể được phản chiếu trong đường dẫn / dữ liệu RSC của trang 404 (slug lạ cũng vậy — đã kiểm "ĐỒNG DẠNG" bên dưới); cái không được lộ là TIÊU ĐỀ / dữ liệu bài.
    check(`/tin-tuc/${s} = 404 và thân không lộ tiêu đề`, r.status === 404 && leak(r.text).filter(x => x.startsWith("TIEUDE")).length === 0, { status: r.status, leak: leak(r.text) });
    check(`/tin-tuc/${s}: có noindex như slug không tồn tại`, /noindex/.test(r.text) === /noindex/.test(miss.text));
    check(`/tin-tuc/${s}: ĐỒNG DẠNG với slug không tồn tại (status ${miss.status}, độ dài thân lệch ≤ 2%)`, r.status === miss.status && Math.abs(r.text.length - miss.text.length) / miss.text.length < 0.02, { a: r.text.length, b: miss.text.length });
  }
  const alias = await get("/student/tin-tuc");
  // /student/tin-tuc là redirect("/tin-tuc") nằm trong vỏ (student) — khách có thể nhận 200 + chuyển hướng phía máy khách; điều cần giữ: không lộ bài nháp/lịch.
  check("/student/tin-tuc (khách) → không lộ gì (3xx hoặc 200 chuyển hướng)", alias.status < 400 && leak(alias.text).length === 0, alias.status);
  const asStu = await fetch(`${BASE}/tin-tuc/bi-mat-lich`, { redirect: "manual", headers: { "user-agent": UA, cookie: await cookieFor(ST) } });
  check("học sinh đăng nhập mở bài lịch = 404 (học sinh không có quyền xem trước)", asStu.status === 404);
  await prisma.article.update({ where: { id: lich.id }, data: { publishedAt: new Date(now - 1000) } });
  const api2 = await api("GET", "/api/articles?slug=bi-mat-lich");
  check("tới giờ thì hiện (không cần sleep)", api2.status === 200);
  await prisma.article.update({ where: { id: lich.id }, data: { publishedAt: new Date(now + 2 * H) } });
  const unpub = await prisma.article.create({ data: { slug: "da-go", title: "TIEUDE_DAGO", excerpt: "x", content: "x", category: "tuyen-sinh", author: "A", authorId: "", published: true, publishedAt: new Date(now - H) } });
  const before = await get("/tin-tuc/da-go");
  await prisma.article.update({ where: { id: unpub.id }, data: { published: false } });
  const after = await get("/tin-tuc/da-go");
  check("bài đã đăng rồi gỡ (published=false) → trang 404 ngay (không kẹt cache)", before.status === 200 && after.status === 404 && !after.text.includes("TIEUDE_DAGO"), { b: before.status, a: after.status });
  check("API sau khi gỡ: GET ?slug= 404", (await api("GET", "/api/articles?slug=da-go")).status === 404);

  section("2. Slug lạ (trang HTML + API)");
  for (const s of ["%00", "a%00b", "..%2F..%2Fetc%2Fpasswd", "%2e%2e/%2e%2e", "x".repeat(500), "%E0%A4%A", "%27%3B%20DROP%20TABLE%20articles%3B--", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", "%20ra-mat", "ra-mat%20", "RA-MAT", "ra-mat/", "ra-mat%2F..%2Fra-mat-2"]) {
    const r = await get(`/tin-tuc/${s}`);
    check(`GET /tin-tuc/${s.slice(0, 24)} → 404 (hoặc 3xx chuẩn hoá), không 500, không phản chiếu chữ nguy hiểm`, r.status !== 500 && (r.status === 404 || r.status === 400 || (r.status >= 300 && r.status < 400) || (s.startsWith("%2e%2e") && r.status === 200 && leak(r.text).length === 0)) && !r.text.includes("<script>alert(1)</script>"), r.status);
    const a = await api("GET", `/api/articles?slug=${s}`);
    check(`GET /api/articles?slug=${s.slice(0, 24)} không 500`, a.status !== 500, a.status);
    const v = await fetch(`${BASE}/api/articles/${s}/view`, { method: "POST", headers: { "user-agent": UA } });
    check(`POST view/${s.slice(0, 24)} không 500`, v.status !== 500, v.status);
  }
  check("trang chỉ khớp slug chính xác: 'RA-MAT' (hoa) không ra bài 'ra-mat'", (await get("/tin-tuc/RA-MAT")).status === 404);

  section("3. category / tham số chứa NUL hoặc rất dài không gây 500");
  for (const q of ["category=a%00b", "category=" + "x".repeat(5000), "muc=%00", "slug=%00", "limit=%00", "sort=%00", "trang=99999999999999999999", "limit=1&limit=2&limit=3", "muc=tuyen-sinh&muc=x"]) {
    const r = await api("GET", `/api/articles?${q}`);
    check(`?${q.slice(0, 30)} không 500 [NGHI api/articles/route.ts:48-49 nếu category có NUL]`, r.status !== 500, r.status);
  }
  for (const q of ["muc=%00", "muc=x", "trang=abc", "trang=0", "trang=99999999"]) {
    const r = await get(`/tin-tuc?${q}`);
    check(`trang /tin-tuc?${q} không 500`, r.status !== 500, r.status);
  }

  section("4. Khách / học sinh / gia sư gọi API admin bài viết");
  const body = { title: "Giả mạo", slug: "gia-mao", excerpt: "x", content: "x", category: "gia-su", published: true };
  const id = nhap.id;
  const calls: [string, string, unknown][] = [["GET", "/api/admin/articles", undefined], ["POST", "/api/admin/articles", body], ["GET", `/api/admin/articles/${id}`, undefined], ["PATCH", `/api/admin/articles/${id}`, { published: true }], ["DELETE", `/api/admin/articles/${id}`, undefined]];
  for (const [who, u] of [["khách", undefined], ["học sinh", ST], ["gia sư", TU]] as const)
    for (const [m, p, b] of calls) {
      const r = await api(m, p, { as: u, body: b });
      check(`${who} ${m} ${p.replace(id, ":id")} → 401/403, thân không lộ nội dung`, (r.status === 401 || r.status === 403) && !/BIMAT|nội dung|content/i.test(r.text), r.status);
    }
  check("sau mọi lần thử: nháp vẫn là nháp, bài 'gia-mao' không tồn tại, bài chưa bị xoá", (await prisma.article.findUnique({ where: { id } }))?.published === false && (await prisma.article.count({ where: { slug: "gia-mao" } })) === 0);
  const spoof = await api("POST", "/api/admin/articles", { headers: { "x-forwarded-for": "127.0.0.1", "x-middleware-subrequest": "middleware", "x-user-role": "admin" }, body });
  check("giả header nội bộ không qua được", spoof.status === 401 || spoof.status === 403, spoof.status);

  section("5. Học sinh / khách vào /admin");
  for (const p of ["/admin/tin-tuc", "/admin"]) {
    const stu = await fetch(BASE + p, { redirect: "manual", headers: { "user-agent": UA, cookie: await cookieFor(ST) } });
    const loc = stu.headers.get("location") ?? "";
    check(`học sinh mở ${p} → chuyển đi (3xx), không 200`, stu.status >= 300 && stu.status < 400 && loc !== "", { s: stu.status, loc });
    const kh = await get(p);
    check(`khách mở ${p} → chuyển đi (3xx), không 200`, kh.status >= 300 && kh.status < 400, kh.status);
  }

  section("6. Thông báo article_new: không tên / số / tiền; lịch tương lai không báo");
  const n0 = await prisma.notification.count({ where: { type: "article_new" } });
  const dang = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "bao-tb", title: "Thông báo tuyển sinh", published: true } });
  check("đăng ngay → 201", dang.status === 201, dang.text);
  const ns = await prisma.notification.findMany({ where: { type: "article_new" } });
  check("gửi cho học sinh (có bản ghi mới)", ns.length > n0 && ns.some(n => n.userId === ST.id));
  check("KHÔNG gửi cho quản trị / gia sư", !ns.some(n => n.userId === SA.id || n.userId === TU.id));
  const n = ns.find(x => x.userId === ST.id)!;
  check("nội dung đúng dạng, link /tin-tuc/<slug>", n.title === "Bài viết mới" && n.message === 'Bài viết mới: "Thông báo tuyển sinh"' && n.link === "/tin-tuc/bao-tb", n);
  const blob = JSON.stringify(n);
  check("thông báo không chứa tên học sinh, email, số lượt xem, tiền (đ/₫/VND/Coin)", !blob.includes("Hạnh") && !blob.includes(ST.email) && !/lượt|\d[\d.,]*\s?(đ|₫|vnd|coin)/i.test(blob), blob);
  check("mọi thông báo cùng bài có nội dung GIỐNG HỆT (không cá nhân hoá)", new Set(ns.slice(n0).map(x => x.message + x.link + x.title)).size === 1);
  const c1 = await prisma.notification.count({ where: { type: "article_new" } });
  await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "lich-khong-bao", publishedAt: new Date(now + 3 * H).toISOString() } });
  check("lịch tương lai: không gửi", (await prisma.notification.count({ where: { type: "article_new" } })) === c1);
  const nhap2 = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "nhap-khong-bao", published: false } });
  await api("PATCH", `/api/admin/articles/${nhap2.json.id}`, { as: SA, body: { title: "đổi tên" } });
  check("nháp + sửa nháp: không gửi", (await prisma.notification.count({ where: { type: "article_new" } })) === c1);
  await api("PATCH", `/api/admin/articles/${(await prisma.article.findUniqueOrThrow({ where: { slug: "bao-tb" } })).id}`, { as: SA, body: { title: "Sửa lại", content: "mới" } });
  check("sửa bài ĐÃ đăng (không đổi trạng thái) không gửi lại", (await prisma.notification.count({ where: { type: "article_new" } })) === c1);
  const titleEvil = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "tb-xss", title: '<img src=x onerror=alert(1)>"' } });
  const nx = await prisma.notification.findFirst({ where: { type: "article_new", link: "/tin-tuc/tb-xss" } });
  check("tiêu đề có HTML vào thông báo nguyên văn (React thoát khi hiện) — ghi nhận, không phải lỗi", titleEvil.status === 201 && !!nx);

  section("7. Kiểm đầu vào admin (kẻ tấn công là quản trị viên lỡ tay / tài khoản bị chiếm)");
  const dup = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: " ra-mat " } });
  check("slug có khoảng trắng bao quanh trùng slug cũ → 409/400, KHÔNG 500 [NGHI admin/articles/route.ts:52 so slug chưa trim, lưu bản trim → P2002]", dup.status === 409 || dup.status === 400, dup.status);
  const slash = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "a/b?c=1#d" } });
  check("slug chứa / ? # → 400 (bài sẽ không mở được nếu nhận) [NGHI route.ts:38 không kiểm định dạng slug]", slash.status === 400, slash.status);
  const longSlug = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "x".repeat(300) } });
  check("slug 300 ký tự → 400 (isPlausibleSlug chỉ nhận ≤200 nên bài sẽ vô hình) [NGHI]", longSlug.status === 400, longSlug.status);
  const upper = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "Chu-Hoa" } });
  check("slug chữ hoa → 400 hoặc chuẩn hoá (bản ghi hoa/thường trùng nhau trong sitemap)", upper.status === 400 || (upper.status === 201 && upper.json.slug === "chu-hoa"), upper.status);
  const strPub = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "pub-chuoi", published: "false" } });
  check("published là chuỗi 'false' → 400 (không được thành đăng công khai, không 500) [NGHI route.ts:68 `published ?? false` không kiểm kiểu]", strPub.status === 400 && (await prisma.article.count({ where: { slug: "pub-chuoi", published: true } })) === 0, strPub.status);
  const numTitle = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "so-title", title: 123 } });
  check("title là số → 400 không 500 (title?.trim không phải hàm)", numTitle.status === 400, numTitle.status);
  const badJson = await api("POST", "/api/admin/articles", { as: SA, raw: "{không phải json" , headers: { "content-type": "application/json" } });
  check("JSON hỏng → 400 (không 500)", badJson.status === 400, badJson.status);
  const inj = await api("POST", "/api/admin/articles", { as: SA, body: { ...body, slug: "inj", views: 999999, id: "ghi-de", authorId: ST.id } });
  const injRow = await prisma.article.findUnique({ where: { slug: "inj" } });
  check("không nhận views / id từ body (không bơm lượt xem)", inj.status === 201 && injRow?.views === 0 && injRow?.id !== "ghi-de", injRow);
  const patchV = await api("PATCH", `/api/admin/articles/${injRow!.id}`, { as: SA, body: { views: 123456, authorId: "x", id: "khac" } });
  check("PATCH không đổi được views / id", patchV.status === 200 && (await prisma.article.findUniqueOrThrow({ where: { id: injRow!.id } })).views === 0);
  const patchT = await api("PATCH", `/api/admin/articles/${injRow!.id}`, { as: SA, body: { title: 5 } });
  check("PATCH title số → 400 không 500", patchT.status === 400, patchT.status);
  const patchSlug = await api("PATCH", `/api/admin/articles/${injRow!.id}`, { as: SA, body: { slug: "  ra-mat  " } });
  check("PATCH slug trùng kèm khoảng trắng → 409/400 không 500 [NGHI [id]/route.ts:35-36]", patchSlug.status === 409 || patchSlug.status === 400, patchSlug.status);
  const ghost = await api("PATCH", `/api/admin/articles/khong-co-id`, { as: SA, body: { title: "x" } });
  check("PATCH id lạ → 404", ghost.status === 404, ghost.status);

  section("8. XSS ở title / author / tag / excerpt / sourceName qua TRANG");
  const X = '<script>alert(7)</script><img src=x onerror=alert(8)>';
  await mk("xss-all", { title: X, author: X, tag: X, excerpt: X, content: X, coverCaption: X, sourceName: X, sourceUrl: "https://example.edu.vn/tb", coverImage: "https://cdn.example.edu.vn/a.png" });
  const pg = await get("/tin-tuc/xss-all");
  const lst = await get("/tin-tuc");
  for (const [tên, r] of [["trang bài", pg], ["trang danh sách", lst]] as const) {
    // Quét phần DOM do trang sinh ra: bỏ các khối <script> hợp lệ (dữ liệu RSC / JSON-LD đã thoát '<' nên chữ nguy hiểm chỉ nằm trong chuỗi), rồi tìm thẻ / thuộc tính sống.
    const scripts = [...r.text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1].trim());
    const dom = r.text.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
    check(`${tên}: không có phần tử <script> do nội dung sinh ra (thân script không bắt đầu bằng alert(7))`, !scripts.some(b => b.startsWith("alert(7)")), r.status);
    check(`${tên}: DOM không có <img onerror> / thuộc tính on*= sống từ dữ liệu`, !/<img[^>]*onerror=/i.test(dom) && !/<[a-z][^>]*\son(error|load|click)=/i.test(dom));
  }
  const hd = pg.text.match(/<head[\s\S]*?<\/head>/)?.[0] ?? "";
  check("<head> (title / og / description) thoát chữ nguy hiểm", !hd.includes("<script>alert(7)") && !/content="[^"]*"[^>]*onerror/.test(hd));
  const ld = [...pg.text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  check("JSON-LD của bài XSS parse được, không chứa '<'", ld.length >= 1 && ld.every(t => { try { JSON.parse(t); return !t.includes("<"); } catch { return false; } }));
  check("link nguồn là thẻ <a> có rel noopener/nofollow nếu mở tab mới (target=_blank)", !/target="_blank"(?![^>]*rel="[^"]*noopener)/.test(pg.text));

  section("9. Spam lượt xem nâng cao");
  const v0 = (await prisma.article.findUniqueOrThrow({ where: { slug: "ra-mat" } })).views;
  let c = 0;
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${BASE}/api/articles/ra-mat/view`, { method: "POST", headers: { "user-agent": UA, "x-forwarded-for": `203.0.113.${i}` } });
    if ((await r.json().catch(() => ({}))).counted) c++;
  }
  check("60 yêu cầu không cookie, XFF xoay vòng 60 IP → views tăng ≤ 1 [NGHI route view: tin x-forwarded-for do client gửi; nếu chạy sau proxy tin cậy (Vercel ghi đè XFF) thì bỏ qua]", c <= 1, { c });
  const v1 = (await prisma.article.findUniqueOrThrow({ where: { slug: "ra-mat" } })).views;
  check("DB khớp số đã báo counted", v1 - v0 === c, { v0, v1, c });
  let cc = 0;
  await Promise.all(Array.from({ length: 30 }, () => fetch(`${BASE}/api/articles/ra-mat-2/view`, { method: "POST", headers: { "user-agent": UA, "x-forwarded-for": "198.51.100.7" } }).then(r => r.json()).then(j => { if (j.counted) cc++; })));
  check("30 yêu cầu SONG SONG cùng nguồn, cùng lúc, không cookie → ≤ 1 lượt (race trong bộ nhớ)", cc <= 1 && (await prisma.article.findUniqueOrThrow({ where: { slug: "ra-mat-2" } })).views <= 1, { cc });
  const cookieBomb = await fetch(`${BASE}/api/articles/ra-mat/view`, { method: "POST", headers: { "user-agent": UA, cookie: "kin_av=" + "abcdef12.".repeat(5000), "x-forwarded-for": "198.51.100.99" } });
  check("cookie kin_av khổng lồ không làm 500", cookieBomb.status !== 500, cookieBomb.status);
  const withBody = await fetch(`${BASE}/api/articles/ra-mat/view`, { method: "POST", headers: { "user-agent": UA, "content-type": "application/json", "x-forwarded-for": "198.51.100.98" }, body: JSON.stringify({ views: 1000000, slug: "bi-mat-nhap" }) });
  check("thân yêu cầu bị bỏ qua (không bơm views, không đổi bài)", withBody.status !== 500 && (await prisma.article.findUniqueOrThrow({ where: { slug: "ra-mat" } })).views - v1 <= 1 && (await prisma.article.findUniqueOrThrow({ where: { id: nhap.id } })).views === 99999);
  for (const m of ["PUT", "DELETE", "PATCH"]) check(`${m} …/view = 405`, (await fetch(`${BASE}/api/articles/ra-mat/view`, { method: m, headers: { "user-agent": UA } })).status === 405);
  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) check(`${m} /api/articles (công khai) không ghi được: 405`, (await fetch(`${BASE}/api/articles`, { method: m, headers: { "user-agent": UA, "content-type": "application/json" }, body: m === "POST" ? JSON.stringify(body) : undefined })).status === 405);
  check("Cache-Control của POST view là no-store", (await fetch(`${BASE}/api/articles/ra-mat-2/view`, { method: "POST", headers: { "user-agent": UA, "x-forwarded-for": "198.51.100.200" } })).headers.get("cache-control") === "no-store");

  section("10. Cache công khai không giữ bài đã gỡ quá lâu / không giữ phiên");
  const pubList = await api("GET", "/api/articles");
  check("danh sách công khai không đặt cookie (không cache theo người)", !pubList.headers.get("set-cookie"));
  const withCookie = await api("GET", "/api/articles", { as: ST });
  check("gửi kèm cookie học sinh: kết quả y như khách (không có trường riêng)", JSON.stringify(withCookie.json) === JSON.stringify(pubList.json));

  section("11. sitemap / robots");
  const sm = await get("/sitemap.xml");
  check("sitemap không chứa slug có ký tự lạ chưa mã hoá (<, \", khoảng trắng) và là XML hợp lệ", !/<loc>[^<]*[ "']/.test(sm.text) && /^<\?xml/.test(sm.text.trim()), sm.text.slice(0, 120));
  check("sitemap: bài đã gỡ / bài xss-all (đã đăng) — chỉ bài đăng hiện", !sm.text.includes("da-go") && sm.text.includes("xss-all"));
  const rb = await get("/robots.txt");
  check("robots chặn /admin và /api/ cho mọi UA, không chặn /tin-tuc", /Disallow: \/admin/.test(rb.text) && /Disallow: \/api\//.test(rb.text) && !/Disallow: \/tin-tuc/.test(rb.text));

  await done();
})().catch(async e => { console.error(e); await done(); });
