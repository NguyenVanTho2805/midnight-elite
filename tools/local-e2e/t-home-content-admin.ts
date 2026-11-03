// HOME-02 (API + DB thật): GET/PUT /api/admin/site-content/home — quyền theo vai, kiểm phía máy chủ (422 theo trường), XSS chỉ là chữ, 409 chống ghi đè mù,
// không thay đổi → không ghi, nhật ký chỉ tên trường, trang chủ thật đổi chữ. KHÔNG chạy cùng lúc với bài khác trên cổng 3100.
import { prisma } from "@/lib/prisma";
import { DEFAULT_HOME_CONTENT as DEF, type HomeContent } from "@/lib/siteContent";
import { api, mkTutor, mkUser, mkSuper, wipe, check, eventually, section, done, BASE } from "./h";

const HOME_TOO_LONG = 400;
const URL_ = "/api/admin/site-content/home";
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const good = (): HomeContent => clone(DEF);

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const audits = () => prisma.auditLog.count({ where: { action: "site_content.update" } });
  const rowCount = () => prisma.siteContent.count();
  const put = (as: any, content: unknown, baseUpdatedAt: string | null) => api("PUT", URL_, { as, body: { content, baseUpdatedAt } });

  section("Quyền theo vai");
  check("không phiên → GET 401, PUT 401", (await api("GET", URL_)).status === 401 && (await api("PUT", URL_, { body: { content: good(), baseUpdatedAt: null } })).status === 401);
  check("học sinh → 403 cả GET và PUT", (await api("GET", URL_, { as: S })).status === 403 && (await put(S, good(), null)).status === 403);
  check("gia sư (teacher) → 403 cả GET và PUT (ca leo quyền)", (await api("GET", URL_, { as: T })).status === 403 && (await put(T, { ...good(), title: "Gia sư tự đổi" }, null)).status === 403);
  check("sau các ca bị chặn: chưa có hàng, chưa có nhật ký", (await rowCount()) === 0 && (await audits()) === 0);
  check("admin_content → GET 200; admin_super → GET 200", (await api("GET", URL_, { as: CA })).status === 200 && (await api("GET", URL_, { as: SA })).status === 200);

  section("GET khi chưa có dòng / dòng hỏng");
  let g = await api("GET", URL_, { as: SA });
  check("chưa có dòng → isDefault, content bằng defaults, updatedAt null", g.json.isDefault === true && JSON.stringify(g.json.content) === JSON.stringify(g.json.defaults) && g.json.updatedAt === null && g.json.updatedBy === null, g.json);
  await prisma.siteContent.create({ data: { key: "home", data: "rác không phải đối tượng" } });
  g = await api("GET", URL_, { as: SA });
  check("dòng hỏng → vẫn 200 + isDefault, nội dung mặc định, không lộ stack", g.status === 200 && g.json.isDefault === true && g.json.content.title === DEF.title && !/Error|at \//.test(g.text), g.text.slice(0, 200));
  await prisma.siteContent.deleteMany();

  section("PUT hợp lệ");
  const c1 = good(); c1.title = "Học cùng gia sư thật\nXem lịch, làm bài tập"; c1.cta.title = "Vào KiN hôm nay";
  let r = await put(CA, c1, null);
  check("200, changedFields đúng 2 trường, có updatedAt", r.status === 200 && r.json.ok && r.json.changedFields.join() === "title,cta.title" && !!r.json.updatedAt && r.json.revalidated === true, r.json);
  const t1 = r.json.updatedAt as string;
  g = await api("GET", URL_, { as: SA });
  check("GET đọc lại đúng, isDefault=false, updatedBy là tên người lưu", g.json.content.title === c1.title && g.json.isDefault === false && g.json.updatedAt === t1 && g.json.updatedBy?.name === "Quản trị nội dung", g.json);
  let home = "";
  await eventually("trang chủ thật (GET /, no-store) có chữ mới trong ≤ 5 giây", async () => { home = await (await fetch(BASE + "/", { cache: "no-store" })).text(); return home.includes("Vào KiN hôm nay"); }, 5000);

  section("Nhật ký: chỉ tên trường");
  const logs = await prisma.auditLog.findMany({ where: { action: "site_content.update" } });
  const meta = logs[0]?.metadata as any;
  check("đúng 1 dòng; resourceType SiteContent; resourceId home; actor đúng người", logs.length === 1 && logs[0].resourceType === "SiteContent" && logs[0].resourceId === "home" && logs[0].actorId === CA.id, logs);
  check("metadata.fields đúng 2 đường dẫn, count=2", meta?.fields?.join() === "title,cta.title" && meta.count === 2, meta);
  check("chuỗi chữ mới KHÔNG xuất hiện trong metadata", !JSON.stringify(logs[0].metadata).includes("Vào KiN hôm nay") && !JSON.stringify(logs[0].metadata).includes("Xem lịch"));

  section("Không thay đổi → không ghi");
  const before = await audits();
  r = await put(SA, c1, t1);
  check("PUT y hệt → unchanged:true, updatedAt giữ nguyên, không thêm nhật ký", r.status === 200 && r.json.unchanged === true && r.json.updatedAt === t1 && (await audits()) === before, r.json);
  check("cũng unchanged khi chỉ thừa khoảng trắng đầu/cuối (chuẩn hoá trước khi so)", (await put(SA, { ...c1, title: "  " + c1.title + "  " }, t1)).json.unchanged === true);

  section("422 theo từng trường [phá cố ý]: CSDL không đổi, không nhật ký");
  const cases: [string, (c: HomeContent) => void, string][] = [
    ["tiêu đề quá dài", c => { c.title = "a".repeat(HOME_TOO_LONG); }, "title"],
    ["7 thẻ", c => { c.why.cards = Array.from({ length: 7 }, () => clone(c.why.cards[0])); }, "why.cards"],
    ["0 ô kỳ thi", c => { c.exams = []; }, "exams"],
    ["icon lạ", c => { (c.why.cards[0] as any).icon = "../../etc"; }, "why.cards[0].icon"],
    ["href javascript:", c => { c.findTutor.buttonHref = "javascript:alert(1)"; }, "findTutor.buttonHref"],
    ["href //host", c => { c.cta.primary.href = "//evil.example"; }, "cta.primary.href"],
    ["cụm cấm 'live mỗi tối' trong mô tả thẻ", c => { c.why.cards[2].desc = "Học live mỗi tối cùng gia sư"; }, "why.cards[2].desc"],
    ["cụm cấm '24/7' ở CTA", c => { c.cta.desc = "Hỗ trợ 24/7"; }, "cta.desc"],
    ["chữ trống", c => { c.badge = "   "; }, "badge"],
  ];
  const snap = JSON.stringify((await prisma.siteContent.findUnique({ where: { key: "home" } }))?.data);
  const nAudit = await audits();
  for (const [name, mut, path] of cases) {
    const c = good(); c.title = c1.title; mut(c);
    const x = await put(SA, c, t1);
    check(`${name} → 422, fields chứa '${path}'`, x.status === 422 && x.json.error === "invalid" && path in x.json.fields, x.json);
  }
  const claim = await put(SA, (() => { const c = good(); c.why.cards[2].desc = "Học live mỗi tối cùng gia sư"; return c; })(), t1);
  check("lỗi cụm cấm nêu cụm đã khớp và lý do", /live mỗi tối/.test(claim.json.fields["why.cards[2].desc"]) && /live/i.test(claim.json.fields["why.cards[2].desc"]), claim.json);
  check("sau mọi ca 422: dòng CSDL không đổi, không thêm nhật ký", JSON.stringify((await prisma.siteContent.findUnique({ where: { key: "home" } }))?.data) === snap && (await audits()) === nAudit);

  section("XSS chỉ là chữ [phá cố ý]");
  const xs = good(); xs.title = "<script>alert(1)</script>"; xs.lead = "\"><img src=x onerror=alert(2)>";
  r = await put(SA, xs, t1);
  check("lưu được như chữ (200)", r.status === 200, r.json);
  const t2 = r.json.updatedAt as string;
  await eventually("GET / trả HTML đã thoát, không có thẻ <script> từ nội dung", async () => {
    home = await (await fetch(BASE + "/", { cache: "no-store" })).text();
    return home.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && !home.includes("<script>alert(1)</script>") && !/<img src=x onerror/.test(home);
  }, 5000);

  section("409 chống ghi đè mù");
  const a = good(); a.cta.title = "Bản của người A";
  const b = good(); b.cta.title = "Bản của người B";
  const nBefore409 = await audits();
  const ra = await put(SA, a, t2), rb = await put(CA, b, t2);
  check("người đầu 200; người sau cùng baseUpdatedAt → 409", ra.status === 200 && rb.status === 409, [ra.status, rb.status]);
  check("409 trả bản hiện tại là của người đầu + tên người lưu", rb.json.error === "conflict" && rb.json.current.content.cta.title === "Bản của người A" && rb.json.current.updatedBy?.name === "Quản trị Hà" && rb.json.current.updatedAt === ra.json.updatedAt, rb.json);
  check("CSDL giữ bản của người đầu; chỉ MỘT dòng nhật ký cho hai PUT này", ((await prisma.siteContent.findUnique({ where: { key: "home" } }))!.data as any).cta.title === "Bản của người A" && (await audits()) === nBefore409 + 1, await audits());
  const ow = await put(CA, b, ra.json.updatedAt);
  check("ghi đè có chủ ý (gửi lại với mốc mới) → 200", ow.status === 200 && ow.json.content.cta.title === "Bản của người B", ow.json);
  check("hàng chưa có mà gửi baseUpdatedAt cũ khác null cũng 409; null khi đã có hàng → 409", (await put(SA, good(), "2020-01-01T00:00:00.000Z")).status === 409 && (await put(SA, good(), null)).status === 409);

  section("Thân yêu cầu xấu");
  const big = await api("PUT", URL_, { as: SA, raw: JSON.stringify({ content: good(), baseUpdatedAt: null, pad: "x".repeat(40 * 1024) }), headers: { "content-type": "application/json" } });
  check("thân 40 KB → 413", big.status === 413, big.status);
  check("JSON cụt → 400", (await api("PUT", URL_, { as: SA, raw: '{"content": {"title": ', headers: { "content-type": "application/json" } })).status === 400);
  check("thiếu content → 400; baseUpdatedAt sai kiểu → 400", (await api("PUT", URL_, { as: SA, body: { baseUpdatedAt: null } })).status === 400 && (await api("PUT", URL_, { as: SA, body: { content: good(), baseUpdatedAt: 5 } })).status === 400);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
