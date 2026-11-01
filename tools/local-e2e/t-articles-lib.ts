// BU-07 — src/lib/articlesPublic.ts, articleViews.ts, seoPublic.ts: điều kiện hiển thị, chuyên mục, bóc ảnh bìa, đếm lượt xem, giờ đăng, JSON-LD. THUẦN (không DB).
// PHÁ CỐ Ý: nháp / lên lịch tương lai / đúng biên `now`; chuyên mục lạ và SQL; ảnh bìa javascript:/data:/http:; </script> trong JSON-LD; cookie, bot, cross-site, spam 30/giờ;
// giờ đăng sai định dạng / ngoài ±2 năm / không múi giờ (phải hiểu là giờ VN); chú thích 201 ký tự.
import {
  publicArticleWhere, isArticleVisible, categoryGroupOf, categoryLabel, isValidMuc, categoriesForMuc, shapeCover, isPlausibleSlug,
  cleanCoverCaption, parseSchedule, checkNotPast, ARTICLE_BLOCKS, ARTICLE_CATEGORIES, CAPTION_MAX,
} from "@/lib/articlesPublic";
import { shouldCountView, newLimiter, parseViewCookie, nextViewCookie, slugKey, VIEW_COOKIE_MAX_SLUGS, VIEW_HOURLY_CAP } from "@/lib/articleViews";
import { jsonLdSafe, articleJsonLd, articleMetadata, courseMetadata, newsListMetadata, clipText, absoluteUrl, siteUrl, publicCourseWhere } from "@/lib/seoPublic";
import { check, section, done } from "./h";

const NOW = new Date("2026-11-01T05:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

// Bộ đánh giá nhỏ cho đúng hình dạng publicArticleWhere (để chứng minh nó khớp isArticleVisible).
type Where = ReturnType<typeof publicArticleWhere>;
function evalWhere(w: Where, a: { published: boolean; publishedAt: Date | null }): boolean {
  return a.published === w.published && w.OR.some(c => {
    const p = c.publishedAt as null | { lte: Date };
    return p === null ? a.publishedAt === null : a.publishedAt !== null && a.publishedAt.getTime() <= p.lte.getTime();
  });
}

section("Hiển thị: ma trận nháp/đã đăng × publishedAt");
const w = publicArticleWhere(NOW);
const cases: [string, boolean, Date | null, boolean][] = [
  ["đã đăng, publishedAt null (bài cũ)", true, null, true],
  ["đã đăng, quá khứ", true, at(-1), true],
  ["đã đăng, ĐÚNG now (biên lte)", true, NOW, true],
  ["đã đăng, now + 1ms", true, at(1), false],
  ["đã đăng, tương lai 1 giờ", true, at(3600_000), false],
  ["nháp, null", false, null, false],
  ["nháp, quá khứ", false, at(-86400_000), false],
  ["nháp, tương lai", false, at(86400_000), false],
];
for (const [name, pub, when, want] of cases) {
  check(`${name} → ${want ? "hiện" : "ẩn"} (isArticleVisible)`, isArticleVisible({ published: pub, publishedAt: when }, NOW) === want);
  check(`  … và publicArticleWhere cho cùng kết quả`, evalWhere(w, { published: pub, publishedAt: when }) === want);
}
check("publicArticleWhere đúng hình dạng spec", JSON.stringify(w) === JSON.stringify({ published: true, OR: [{ publishedAt: null }, { publishedAt: { lte: NOW } }] }));
check("không nhận now từ ngoài kiểu lạ: mặc định là giờ hiện tại", Math.abs(((publicArticleWhere().OR[1].publishedAt as { lte: Date }).lte.getTime()) - Date.now()) < 2000);

section("Chuyên mục");
check("tuyen-sinh → khối Tuyển sinh", categoryGroupOf("tuyen-sinh")?.label === "Tuyển sinh");
check("hoc-thuat → khối Học tập", categoryGroupOf("hoc-thuat")?.label === "Học tập");
check("tin-midnight → khối KiN", categoryGroupOf("tin-midnight")?.label === "KiN");
check("gia-su → khối Gia sư", categoryGroupOf("gia-su")?.label === "Gia sư");
check("kinh-nghiem → khối Học tập", categoryGroupOf("kinh-nghiem")?.label === "Học tập");
check("chuỗi lạ / rỗng / không phải chuỗi → null", categoryGroupOf("khac") === null && categoryGroupOf("") === null && categoryGroupOf(null) === null && categoryGroupOf(5) === null);
check("không bị lừa bởi tên thuộc tính của object (__proto__, constructor)", categoryGroupOf("__proto__") === null && categoryGroupOf("constructor") === null && !isValidMuc("__proto__"));
check("isValidMuc chỉ nhận 5 giá trị thật", ARTICLE_CATEGORIES.every(c => isValidMuc(c.value)) && ARTICLE_CATEGORIES.length === 5);
for (const bad of ["'; DROP TABLE articles; --", "all", "", "TUYEN-SINH", " tuyen-sinh", "tuyen-sinh ", "tuyen-sinh\u0000", undefined, null, 1, ["tuyen-sinh"]])
  check(`isValidMuc(${JSON.stringify(bad)}) = false`, isValidMuc(bad) === false);
check("4 khối đúng thứ tự Tuyển sinh · Học tập · KiN · Gia sư", ARTICLE_BLOCKS.map(b => b.label).join("·") === "Tuyển sinh·Học tập·KiN·Gia sư");
check("muc của khối Học tập gồm cả kinh-nghiem", categoriesForMuc("hoc-thuat").sort().join() === "hoc-thuat,kinh-nghiem");
check("muc kinh-nghiem chỉ chính nó", categoriesForMuc("kinh-nghiem").join() === "kinh-nghiem");
check("categoryLabel: lạ → 'Tin tức'", categoryLabel("xyz") === "Tin tức" && categoryLabel("gia-su") === "Gia sư");

section("shapeCover: ảnh bìa / nguồn sửa tay trong DB");
const ok = shapeCover({ coverImage: "https://cdn.example.edu.vn/a.png", coverCaption: "Cổng trường", sourceUrl: "https://example.edu.vn/tb", sourceName: "ĐH Mẫu" });
check("hợp lệ giữ nguyên", ok.coverImage === "https://cdn.example.edu.vn/a.png" && ok.coverCaption === "Cổng trường" && ok.sourceUrl === "https://example.edu.vn/tb" && ok.sourceName === "ĐH Mẫu", ok);
for (const evil of ["http://cdn.example.edu.vn/a.png", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "//cdn.example.edu.vn/a.png", "ftp://x.vn/a.png", "https://u:p@x.vn/a.png", "https://" + "a".repeat(1100) + ".vn/x.png", "không phải link"])
  check(`coverImage ${evil.slice(0, 40)} → null`, shapeCover({ coverImage: evil }).coverImage === null);
const mixed = shapeCover({ coverImage: "https://cdn.example.edu.vn/a.png", sourceUrl: "javascript:alert(1)", sourceName: "Gian" });
check("nguồn hỏng bỏ nguồn + tên nguồn, nhưng KHÔNG làm mất ảnh hợp lệ", mixed.sourceUrl === null && mixed.sourceName === null && mixed.coverImage === "https://cdn.example.edu.vn/a.png", mixed);
check("danh sách không có khoá sourceUrl → không thêm khoá", !("sourceUrl" in shapeCover({ coverImage: null })));
check("coverCaption nhiều dòng / ký tự điều khiển gộp một dòng", shapeCover({ coverCaption: "Dòng 1\n\u0000Dòng\t2" }).coverCaption === "Dòng 1 Dòng 2");
check("coverCaption dài 300 bị cắt 200", shapeCover({ coverCaption: "x".repeat(300) }).coverCaption?.length === CAPTION_MAX);
check("coverCaption toàn khoảng trắng → null", shapeCover({ coverCaption: " \n " }).coverCaption === null);
check("coverCaption giữ nguyên chữ nguy hiểm (không thoát hộ — React thoát khi hiện)", shapeCover({ coverCaption: '"><img src=x onerror=alert(1)>' }).coverCaption === '"><img src=x onerror=alert(1)>');
const row = { a: 1, coverImage: "http://x" }; shapeCover(row);
check("không sửa đối tượng gốc", row.coverImage === "http://x");

section("Slug");
check("slug thường hợp lệ", isPlausibleSlug("thong-bao-2026"));
for (const b of ["", "a".repeat(201), "a\u0000b", undefined, null, 5, "../x"].slice(0, 6))
  check(`isPlausibleSlug(${JSON.stringify(b)?.slice(0, 20)}) = false`, !isPlausibleSlug(b));
check("'../x' vẫn là chuỗi (không 500) — DB sẽ không khớp nên ra 404", isPlausibleSlug("../x"));

section("Chú thích ảnh (admin)");
check("trống/undefined/null → null", [undefined, null, "", "  "].every(v => { const r = cleanCoverCaption(v); return r.ok && r.value === null; }));
check("200 ký tự nhận", (() => { const r = cleanCoverCaption("x".repeat(200)); return r.ok && r.value?.length === 200; })());
check("201 ký tự → lỗi (không cắt thầm)", !cleanCoverCaption("x".repeat(201)).ok);
check("không phải chuỗi → lỗi", !cleanCoverCaption(5).ok && !cleanCoverCaption({}).ok);
check("NFD → NFC", (() => { const r = cleanCoverCaption("Tuyển".normalize("NFD")); return r.ok && r.value === "Tuyển".normalize("NFC"); })());

section("Giờ đăng (admin)");
const ps = (v: unknown) => parseSchedule(v, NOW);
check("trống → null", [undefined, null, "", "  "].every(v => { const r = ps(v); return r.ok && r.value === null; }));
check("ISO có Z giữ nguyên", (() => { const r = ps("2026-11-02T01:00:00.000Z"); return r.ok && r.value?.toISOString() === "2026-11-02T01:00:00.000Z"; })());
check("datetime-local KHÔNG múi giờ = giờ VN (09:00 → 02:00Z), không phải giờ máy chủ", (() => { const r = ps("2026-11-02T09:00"); return r.ok && r.value?.toISOString() === "2026-11-02T02:00:00.000Z"; })());
check("chỉ ngày → 00:00 giờ VN", (() => { const r = ps("2026-11-02"); return r.ok && r.value?.toISOString() === "2026-11-01T17:00:00.000Z"; })());
check("có +07:00 rõ ràng", (() => { const r = ps("2026-11-02T09:00:00+07:00"); return r.ok && r.value?.toISOString() === "2026-11-02T02:00:00.000Z"; })());
for (const b of ["mai", "2026-13-40", "2026-11-02T25:00", "11/02/2026", "2026-11-02T09:00; DROP", 12345, {}, [], true])
  check(`sai định dạng ${JSON.stringify(b)} → lỗi`, !ps(b).ok);
check("2026-02-30 (không có thật) → lỗi, cả khi có múi giờ", !ps("2026-02-30").ok && !ps("2026-02-30T01:00:00Z").ok && ps("2028-02-29").ok);
check("cách 3 năm về sau → lỗi", !ps("2029-11-02T09:00").ok);
check("cách 3 năm về trước → lỗi", !ps("2023-11-01T09:00").ok);
check("cách 1 năm → nhận", ps("2027-10-01T09:00").ok);
check("checkNotPast: 4 phút trước ok, 6 phút trước không, tương lai ok", checkNotPast(at(-4 * 60000), NOW) && !checkNotPast(at(-6 * 60000), NOW) && checkNotPast(at(86400000), NOW));

section("SEO: JSON-LD / metadata");
const evil = { title: '</script><script>alert(1)</script>', excerpt: "a<b>c", slug: "x", category: "gia-su", author: "Admin", coverImage: "javascript:alert(1)", publishedAt: NOW };
const j = jsonLdSafe(articleJsonLd(evil));
check("JSON-LD không chứa '<' thô, không có </script>", !j.includes("<") && !j.toLowerCase().includes("</script"), j);
check("JSON-LD vẫn parse được và giữ nguyên chữ", JSON.parse(j).headline === evil.title.slice(0, 110));
check("JSON-LD thoát U+2028/2029", !jsonLdSafe({ s: "a\u2028b\u2029c" }).match(/[\u2028\u2029]/));
check("tác giả 'Admin' → 'KiN'", JSON.parse(j).author.name === "KiN" && JSON.parse(jsonLdSafe(articleJsonLd({ ...evil, author: "Cô Lan" }))).author.name === "Cô Lan");
check("ảnh JSON-LD rơi về og-kin.png khi coverImage hỏng", JSON.parse(j).image[0] === `${siteUrl()}/og-kin.png`);
const md = articleMetadata({ ...evil, title: "Điểm chuẩn ĐH Mẫu 2026", excerpt: "x ".repeat(200), coverImage: "https://cdn.example.edu.vn/a.png", slug: "diem-chuan" });
check("title ≤60 thêm ' — KiN'; description ≤155; canonical tuyệt đối; OG article + ảnh", md.title === "Điểm chuẩn ĐH Mẫu 2026 — KiN" && (md.description?.length ?? 999) <= 155 && md.alternates?.canonical === `${siteUrl()}/tin-tuc/diem-chuan` && (md.openGraph as { type?: string })?.type === "article" && JSON.stringify(md.openGraph).includes("cdn.example.edu.vn/a.png"), md);
check("title dài >60 không thêm hậu tố", articleMetadata({ ...evil, title: "T".repeat(70), coverImage: null }).title === "T".repeat(70));
check("slug có ký tự lạ được mã hoá trong canonical", articleMetadata({ ...evil, slug: "a b/c" }).alternates?.canonical === `${siteUrl()}/tin-tuc/a%20b%2Fc`);
check("clipText ≤ max", clipText("từ ".repeat(300), 155).length <= 155);
check("absoluteUrl: https giữ, '/x' ghép, '//evil' và javascript: → null", absoluteUrl("https://a.vn/x") === "https://a.vn/x" && absoluteUrl("/x") === `${siteUrl()}/x` && absoluteUrl("//evil.com") === null && absoluteUrl("javascript:1") === null);
check("danh sách: muc hợp lệ → canonical ?muc=; muc lạ → /tin-tuc; trang 2 canonical riêng", newsListMetadata("gia-su").alternates?.canonical === `${siteUrl()}/tin-tuc?muc=gia-su` && newsListMetadata("xyz").alternates?.canonical === `${siteUrl()}/tin-tuc` && newsListMetadata("gia-su", 2).alternates?.canonical === `${siteUrl()}/tin-tuc?muc=gia-su&trang=2` && newsListMetadata(null, 2).alternates?.canonical === `${siteUrl()}/tin-tuc?trang=2`);
check("khoá học ẩn / mã dành riêng / không có → noindex", [null, { id: "x", name: "A", status: false }, { id: "lich", name: "A", status: true }].every(c => (courseMetadata(c as never).robots as { index?: boolean })?.index === false));
const cm = courseMetadata({ id: "hsa-tron-goi", name: "HSA trọn gói", instructor: "Cô Lan", status: true });
check("khoá hiện: mô tả chỉ tên + giáo viên, không link/giá", !/zalo|https?:|₫|vnd|đồng|\d{3}\.\d{3}/i.test(String(cm.description)) && cm.alternates?.canonical === `${siteUrl()}/khoa-hoc/hsa-tron-goi`, cm);
check("publicCourseWhere: status true và loại mã dành riêng", publicCourseWhere().status === true && publicCourseWhere().id.notIn.includes("lich"));

section("Đếm lượt xem");
const T0 = Date.UTC(2026, 10, 1, 5, 0, 0);
const req = (o: Record<string, unknown> = {}) => ({ slug: "bai-1", ip: "1.2.3.4", userAgent: "Mozilla/5.0 (iPhone) Safari", host: "kin.vn", origin: "https://kin.vn", now: T0, ...o });
let lim = newLimiter();
const first = shouldCountView(req(), lim);
check("lần đầu → đếm + trả cookie mới chứa mã bài", first.count && parseViewCookie(first.setCookie).includes(slugKey("bai-1")), first);
check("cookie KHÔNG chứa slug thô / IP", first.count && !first.setCookie.includes("bai-1") && !first.setCookie.includes("1.2.3.4"));
const ck = first.count ? first.setCookie : "";
check("cookie đã có slug → không đếm (reason cookie)", (() => { const d = shouldCountView(req({ cookie: ck, now: T0 + 5000 }), newLimiter()); return !d.count && d.reason === "cookie"; })());
check("slug khác cùng cookie vẫn đếm được, cookie giữ cả hai", (() => { const d = shouldCountView(req({ slug: "bai-2", cookie: ck, now: T0 + 1000 }), lim); return d.count && parseViewCookie(d.setCookie).length === 2; })());
check("cookie rác bị bỏ qua (không văng lỗi)", parseViewCookie("<script>.zz.1234567g..abcdef12").join() === "abcdef12");
check("cookie giữ ≤ 20 mã mới nhất", (() => { let c = ""; for (let i = 0; i < 30; i++) c = nextViewCookie(parseViewCookie(c), "s" + i); const p = parseViewCookie(c); return p.length === VIEW_COOKIE_MAX_SLUGS && p.includes(slugKey("s29")) && !p.includes(slugKey("s0")); })());
for (const ua of ["", "   ", undefined, null, "Googlebot/2.1", "Mozilla/5.0 HeadlessChrome/120", "facebookexternalhit/1.1 (crawler)", "Baiduspider", "curl/8.0", "python-requests/2.31"])
  check(`UA ${JSON.stringify(ua)} → không đếm`, (() => { const d = shouldCountView(req({ userAgent: ua }), newLimiter()); return !d.count && d.reason === "bot"; })());
check("Sec-Fetch-Site: cross-site → không đếm", (() => { const d = shouldCountView(req({ secFetchSite: "cross-site" }), newLimiter()); return !d.count && d.reason === "cross-site"; })());
check("Origin khác Host → không đếm", (() => { const d = shouldCountView(req({ origin: "https://evil.com" }), newLimiter()); return !d.count && d.reason === "cross-site"; })());
check("Origin rác → không đếm", !shouldCountView(req({ origin: "not a url" }), newLimiter()).count);
check("không có Origin (cùng nguồn đôi khi không gửi) → vẫn đếm", shouldCountView(req({ origin: null }), newLimiter()).count);
lim = newLimiter();
let counted = 0, lastReason = "";
for (let i = 0; i < 50; i++) { const d = shouldCountView(req({ slug: "b" + i, now: T0 + i }), lim); if (d.count) counted++; else lastReason = d.reason; }
check(`50 bài khác nhau cùng người, không cookie → chỉ ${VIEW_HOURLY_CAP} lần/giờ (còn lại bị 'rate')`, counted === VIEW_HOURLY_CAP && lastReason === "rate", { counted, lastReason });
check("sau 1 giờ mở lại", shouldCountView(req({ slug: "b40", now: T0 + 3600_000 + 100 }), lim).count);
lim = newLimiter();
const a1 = shouldCountView(req({ now: T0 }), lim), a2 = shouldCountView(req({ now: T0 + 60000 }), lim);
check("cùng người, cùng bài, không cookie: lần 2 trong giờ bị chặn (slug-rate)", a1.count && !a2.count && a2.reason === "slug-rate");
check("…mở lại sau 1 giờ", shouldCountView(req({ now: T0 + 3600_001 }), lim).count);
check("người khác (IP khác) không bị ảnh hưởng", shouldCountView(req({ ip: "9.9.9.9", now: T0 + 60000 }), lim).count);
check("yêu cầu bị từ chối KHÔNG làm tốn hạn mức", (() => { const l = newLimiter(); for (let i = 0; i < 100; i++) shouldCountView(req({ userAgent: "bot", now: T0 + i }), l); return shouldCountView(req(), l).count; })());

section("Tấn công bổ sung (kẻ tấn công)");
for (const payload of ["<!--", "<script>", "</SCRIPT >", "]]>", "\u2028\u2029", "<img src=x onerror=alert(1)>"]) {
  const out = jsonLdSafe(articleJsonLd({ title: payload, excerpt: payload, slug: "x", category: "gia-su", author: payload, coverImage: null, publishedAt: NOW }));
  check(`JSON-LD với '${payload.slice(0, 12)}' không có '<' thô, không U+2028/9, parse lại đúng`, !out.includes("<") && !/[\u2028\u2029]/.test(out) && JSON.parse(out).author.name === payload);
}
check("canonical/URL: slug chứa dấu nháy và < được mã hoá", !String(articleMetadata({ title: "t", excerpt: "e", slug: 'a"><b', category: "gia-su" }).alternates?.canonical).match(/["<>]/));
check("categoryGroupOf/categoryLabel không bị lừa bởi tên thuộc tính Object", categoryGroupOf("toString") === null && categoryLabel("hasOwnProperty") === "Tin tức");
check("isArticleVisible: published không phải boolean thật (chuỗi 'false', 1) → ẩn", !isArticleVisible({ published: "false" as never, publishedAt: null }, NOW) && !isArticleVisible({ published: 1 as never, publishedAt: null }, NOW));
check("isArticleVisible: publishedAt là Invalid Date → ẩn (NaN <= now là false)", !isArticleVisible({ published: true, publishedAt: new Date("x") }, NOW));
check("parseSchedule: '+0700' không dấu hai chấm và năm 0000 / 9999", ps("2026-11-02T09:00:00+0700").ok && !ps("0000-01-01").ok && !ps("9999-12-31T23:59").ok);
check("parseSchedule: chuỗi 10 000 ký tự và khoảng trắng bao quanh không văng lỗi", !ps("2026-11-02" + "0".repeat(10000)).ok && ps("  2026-11-02T09:00  ").ok);
check("parseSchedule: múi giờ +99:99 → lỗi", !ps("2026-11-02T09:00:00+99:99").ok);
check("cleanCoverCaption: zero-width / U+202E (RTL override) / BOM bị gộp thành khoảng trắng", (() => { const r = cleanCoverCaption("a\u200bb\ufeffc"); return r.ok && r.value === "a b c"; })());
check("cleanCoverCaption: U+202E (đảo chiều chữ) — GHI NHẬN: oneLine chưa loại ký tự điều hướng", (() => { const r = cleanCoverCaption("abc\u202Efdp.exe"); return r.ok && !r.value?.includes("\u202E"); })());
check("cleanCoverCaption: 200 ký tự toàn tổ hợp (NFD) sau NFC không vượt 200", (() => { const r = cleanCoverCaption("e\u0301".repeat(200)); return r.ok && (r.value?.length ?? 0) <= CAPTION_MAX; })());
{
  const l = newLimiter(); const t0 = Date.UTC(2026, 10, 1, 5);
  const t = performance.now();
  for (let i = 0; i < 20000; i++) shouldCountView({ slug: "a", ip: `10.${i >> 8}.${i & 255}.1`, userAgent: "Mozilla/5.0 Safari", host: "kin.vn", now: t0 + i }, l);
  const ms = performance.now() - t;
  check("IP xoay vòng (XFF giả) KHÔNG làm bộ nhớ giới hạn phình vô hạn (≤ 10 000 mục perClient) [NGHI src/lib/articleViews.ts:50-53]", l.perClient.size <= 10000, { perClient: l.perClient.size, perClientSlug: l.perClientSlug.size });
  check("20 000 yêu cầu IP khác nhau xử lý < 2 giây (prune không O(n) mỗi lần) [NGHI articleViews.ts:51]", ms < 2000, ms);
  const counted = (() => { const l2 = newLimiter(); let c = 0; for (let i = 0; i < 100; i++) if (shouldCountView({ slug: "a", ip: `9.9.9.${i}`, userAgent: "Mozilla/5.0 Safari", host: "kin.vn", now: t0 }, l2).count) c++; return c; })();
  check("GHI NHẬN thiết kế: 100 IP khác nhau cùng bài đều được đếm (hàng rào mềm) — không phải lỗi, chỉ ghi lại", counted === 100);
}
check("cookie 'kin_av' dạng rất dài (10 000 mã) không làm văng và chỉ giữ ≤20", parseViewCookie("abcdef12.".repeat(10000)).length <= VIEW_COOKIE_MAX_SLUGS);

void done();
