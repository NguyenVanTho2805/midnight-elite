// Nội dung trang chủ sửa được (src/lib/siteContent.ts, HOME-01 01/11/2026). Thuần: không DB, không mạng.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HOME_CONTENT as DEF, HOME_ICON_KEYS, isExternalHref, parseHomeContent, validateHomeContent, type HomeContent } from "@/lib/siteContent";
import { check, section, done } from "./h";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const good = (): HomeContent => clone(DEF);
const issuesOf = (raw: unknown) => { const r = validateHomeContent(raw); return r.ok ? [] : r.issues; };
const hasPath = (raw: unknown, path: string) => issuesOf(raw).some(i => i.path === path);
const long = "a".repeat(5000);

section("1. Mặc định hợp lệ qua chính parse");
check("validate(DEFAULT) ok", validateHomeContent(DEF).ok);
check("parse(DEFAULT) bằng sâu DEFAULT", eq(parseHomeContent(DEF), DEF));
check("DEFAULT có 4 exams, 4 thẻ icon key/calendar/clipboard/chat, h1 có đúng một \\n",
  DEF.exams.length === 4 && eq(DEF.why.cards.map(c => c.icon), ["key", "calendar", "clipboard", "chat"]) && DEF.title.split("\n").length === 2);
check("href ô kỳ thi mã hoá đúng tên", DEF.exams[0].href === "/khoa-hoc?category=" + encodeURIComponent("ĐGNL HSA"));

section("2. Không có đối tượng dùng chung");
{
  const a = parseHomeContent(null), b = parseHomeContent(null);
  check("hai lần parse(null) là hai đối tượng khác nhau", a !== b && a.why.cards !== b.why.cards);
  a.why.cards.push({ icon: "star", title: "x", desc: "y" }); a.title = "x"; a.exams.length = 0;
  check("sửa a không làm đổi b hay DEFAULT", b.why.cards.length === 4 && b.title === DEF.title && b.exams.length === 4 && DEF.why.cards.length === 4 && DEF.exams.length === 4);
  check("parse(object hợp lệ) cũng là bản sao", parseHomeContent(DEF) !== DEF && parseHomeContent(DEF).why !== DEF.why);
  let threw = false;
  try { (DEF as HomeContent).why.cards.push({ icon: "star", title: "x", desc: "y" }); } catch { threw = true; }
  try { (DEF as HomeContent).title = "đổi"; } catch { threw = true; }
  check("DEFAULT bị đóng băng sâu (ghi vào ném lỗi và không đổi)", threw && DEF.why.cards.length === 4 && DEF.title !== "đổi" && Object.isFrozen(DEF.why.cards[0]) && Object.isFrozen(DEF.exams));
}

section("3. Ca phá liên kết");
const badHrefs = ["javascript:alert(1)", "JaVaScRiPt:x", "data:text/html,x", "//evil.example", "/\\evil.example", "http://a.b", "mailto:x@y", "/a b", "https://u:p@evil.example/", "https://", "/" + long, "", "khoa-hoc", "tel:123"];
for (const h of badHrefs) {
  const raw = good(); raw.cta.primary.href = h;
  const p = parseHomeContent(raw);
  check(`href ${JSON.stringify(h.slice(0, 30))}${h.length > 30 ? "…" : ""} → validate báo cta.primary.href, parse trả mặc định`, hasPath(raw, "cta.primary.href") && p.cta.primary.href === DEF.cta.primary.href, issuesOf(raw));
}
for (const h of ["/khoa-hoc?category=%C4%90GNL", "/giang-vien", "https://zalo.me/x"]) {
  const raw = good(); raw.findTutor.buttonHref = h;
  check(`href ${h} hợp lệ và giữ nguyên`, validateHomeContent(raw).ok && parseHomeContent(raw).findTutor.buttonHref === h);
}
{
  const raw = good(); raw.cta.secondary.href = " /khoa-hoc ";
  check("khoảng trắng hai đầu href được trim -> hợp lệ (kỳ vọng ghi rõ)", validateHomeContent(raw).ok && parseHomeContent(raw).cta.secondary.href === "/khoa-hoc");
  const e = good(); e.exams[1].href = "javascript:x";
  const pe = parseHomeContent(e);
  check("exams[1] có href hỏng -> bỏ phần tử đó, 3 ô còn lại", pe.exams.length === 3 && !pe.exams.some(x => x.label === "ĐGNL HCM") && hasPath(e, "exams[1].href"));
}
check("isExternalHref", isExternalHref("https://a.b") && !isExternalHref("/a") && !isExternalHref("http://a.b"));

section("4. Ca phá icon");
for (const ic of ["rocket", "", 123, "Key", "__proto__", null, undefined, ["key"]]) {
  const raw = good() as unknown as { why: { cards: Record<string, unknown>[] } }; raw.why.cards[1].icon = ic;
  const p = parseHomeContent(raw);
  check(`icon ${JSON.stringify(ic) ?? "undefined"} -> thẻ đó bị bỏ, 3 thẻ khác giữ nguyên`,
    p.why.cards.length === 3 && eq(p.why.cards.map(c => c.icon), ["key", "clipboard", "chat"]) && hasPath(raw, "why.cards[1].icon"));
}
check("mọi khoá HOME_ICON_KEYS hợp lệ", HOME_ICON_KEYS.every(k => { const r = good(); r.why.cards[0].icon = k; return validateHomeContent(r).ok; }) && HOME_ICON_KEYS.length === 10);

section("5. Ca phá độ dài / số lượng");
for (const [name, mut, path] of [
  ["badge", (r: HomeContent) => { r.badge = long; }, "badge"],
  ["lead", (r: HomeContent) => { r.lead = long; }, "lead"],
  ["cards[0].desc", (r: HomeContent) => { r.why.cards[0].desc = long; }, "why.cards[0].desc"],
  ["findTutor.desc", (r: HomeContent) => { r.findTutor.desc = long; }, "findTutor.desc"],
] as const) {
  const raw = good(); mut(raw);
  check(`${name} 5000 ký tự -> validate báo lỗi (không cắt lặng lẽ), parse không trả chuỗi dài`, hasPath(raw, path) && JSON.stringify(parseHomeContent(raw)).length < 3000);
}
{
  const raw = good(); raw.badge = long;
  check("badge quá dài -> parse trả badge mặc định", parseHomeContent(raw).badge === DEF.badge);
  const e = good(); e.exams = Array.from({ length: 20 }, (_, i) => ({ label: `K${i}`, desc: "d", href: "/khoa-hoc" }));
  const pe = parseHomeContent(e);
  check("exams 20 phần tử -> parse giữ 6 đầu; validate báo 'quá 6'", pe.exams.length === 6 && pe.exams[5].label === "K5" && issuesOf(e).some(i => i.path === "exams" && /quá 6/.test(i.message)));
  const c = good(); c.why.cards = Array.from({ length: 9 }, () => ({ icon: "star" as const, title: "t", desc: "d" }));
  check("cards 9 -> giữ 6, báo lỗi", parseHomeContent(c).why.cards.length === 6 && hasPath(c, "why.cards"));
  const emp = good(); emp.exams = [];
  check("exams rỗng -> mặc định cả mảng (4)", parseHomeContent(emp).exams.length === 4);
  const allBad = good(); allBad.why.cards = [{ icon: "zzz" as never, title: "t", desc: "d" }];
  check("mọi thẻ sai -> mặc định cả mảng", eq(parseHomeContent(allBad).why.cards, DEF.why.cards));
}
for (const [name, t] of [["4 dòng", "a\nb\nc\nd"], ["dòng 61 ký tự", "a".repeat(61)], ["dòng rỗng giữa", "a\n\nb"], ["tổng 121", "a".repeat(60) + "\n" + "b".repeat(60) + "x"]] as const) {
  const raw = good(); raw.title = t;
  check(`title ${name} -> sai`, hasPath(raw, "title") && parseHomeContent(raw).title === DEF.title);
}
check("title 3 dòng ≤ 60 -> hợp lệ", (() => { const r = good(); r.title = "a\nb\nc"; return validateHomeContent(r).ok; })());
check("chuỗi để trống / sai kiểu -> sai", (() => { const r = good() as unknown as Record<string, unknown>; r.badge = "   "; r.lead = 5; return hasPath(r, "badge") && hasPath(r, "lead"); })());
check("ký tự điều khiển (\\u0007, \\u007f) -> sai", (() => { const r = good(); r.badge = "a\u0007b"; const q = good(); q.lead = "a\u007fb"; return hasPath(r, "badge") && hasPath(q, "lead"); })());

section("6. Đầu vào rác");
{
  const circ: Record<string, unknown> = { badge: "x" }; circ.self = circ; circ.why = circ;
  const garbage: unknown[] = [null, undefined, 42, "x", true, [], [{ a: 1 }], {}, JSON.parse('{"__proto__":{"x":1}}'), { toJSON() { throw new Error("boom"); } }, circ,
    { exams: "x", why: 5, findTutor: [], cta: null }, { why: { cards: [null, 1, "x", []] } }, { exams: [null, undefined, 3] }];
  let threw = false; const results: HomeContent[] = [];
  for (const g of garbage) { try { results.push(parseHomeContent(g)); validateHomeContent(g); } catch { threw = true; } }
  check("không ném với mọi đầu vào rác", !threw && results.length === garbage.length);
  check("đầu vào không phải object -> đúng mặc định, validate báo path ''", [null, undefined, 42, "x", true, []].every(g => eq(parseHomeContent(g), DEF) && issuesOf(g).length === 1 && issuesOf(g)[0].path === ""));
  check("{} -> mặc định; validate từ chối (thiếu trường = báo lỗi từng trường)", eq(parseHomeContent({}), DEF) && issuesOf({}).length > 0);
  check("không ô nhiễm prototype", ({} as Record<string, unknown>).x === undefined && ({} as Record<string, unknown>).badge === undefined);
  check("__proto__ trong đầu vào không rò sang kết quả", eq(parseHomeContent(JSON.parse('{"__proto__":{"badge":"hack"},"badge":"ok"}')).badge, "ok") && eq(parseHomeContent(JSON.parse('{"__proto__":{"badge":"hack"}}')).badge, DEF.badge));
  check("khoá lạ bị bỏ lặng lẽ, không là lỗi", validateHomeContent({ ...good(), loLa: 1 }).ok && !("loLa" in parseHomeContent({ ...good(), loLa: 1 })));
}

section("7. Trường sai không kéo trường khác");
{
  const raw = good(); raw.badge = "Huy hiệu mới"; raw.title = "Tiêu đề\nmới"; raw.exams[0].label = "Kỳ thi X"; raw.cta.primary.href = "javascript:x"; raw.cta.secondary.label = "Nút hai";
  (raw.why.cards[1] as { icon: string }).icon = "zzz";
  raw.why.cards[0].title = "Thẻ một"; raw.why.cards[2].title = "Thẻ ba"; raw.why.cards[3].title = "Thẻ bốn";
  const p = parseHomeContent(raw), is = issuesOf(raw);
  check("cta.primary.href = mặc định; các trường khác giữ giá trị nhập",
    p.cta.primary.href === DEF.cta.primary.href && p.cta.primary.label === DEF.cta.primary.label && p.cta.secondary.label === "Nút hai" && p.badge === "Huy hiệu mới" && p.title === "Tiêu đề\nmới" && p.exams[0].label === "Kỳ thi X");
  check("thẻ 1 bị bỏ; thẻ 0, 2, 3 giữ", eq(p.why.cards.map(c => c.title), ["Thẻ một", "Thẻ ba", "Thẻ bốn"]));
  check("đúng 2 issues", is.length === 2, is);
}

section("8. Mã HTML chỉ là chữ; chuẩn hoá");
{
  const html = "<script>alert(1)</script> &amp; <b>x</b>";
  const raw = good(); raw.badge = html;
  check("badge chứa HTML giữ nguyên chuỗi (React escape; không lọc)", parseHomeContent(raw).badge === html && validateHomeContent(raw).ok);
  const t = good(); t.title = "a\r\nb";
  check("title có \\r\\n -> \\r bị bỏ", parseHomeContent(t).title === "a\nb");
  const w = good(); w.badge = "  hai   chữ  ";
  check("trim hai đầu, khoảng trắng giữa giữ nguyên", parseHomeContent(w).badge === "hai   chữ");
  const l = good(); l.lead = "a\nb";
  check("lead có \\n -> sai (chỉ title cho xuống dòng)", hasPath(l, "lead") && parseHomeContent(l).lead === DEF.lead);
  const v = validateHomeContent(w);
  check("validate ok trả value đã chuẩn hoá", v.ok && v.value.badge === "hai   chữ");
}

section("9. Quét chữ cấm trên DEFAULT_HOME_CONTENT");
{
  const BANNED: RegExp[] = [
    /1\.200\+|10\.000\+/, /2,847|2\.847/, /support@tsix/i, /Hoàn tiền 100%/i, /Strike system|hệ thống gậy|3 gậy/i, /hàng đầu Việt Nam/i, /Học trọn đời|Mua 1 lần, xem không giới hạn/i,
    /AI hỗ trợ giải bài|hỏi AI 24\/7|AI giải bài 24\/7|Ngoài giờ có AI/i, /VNPay/i, /Combo 8 môn chỉ|tiết kiệm 57%/i,
    /trợ giảng (riêng|phản hồi|người thật)|phân công trợ giảng/i, /live mỗi tối|Học trực tiếp LIVE|video quay sẵn/i, /realtime|thời gian thực/i, /(phản hồi|trả lời) trong ngày/i, /24\/7/, /thứ hạng toàn hệ thống|GPA, streak và/,
    /miễn phí.*(trọn đời|mãi mãi)|đảm bảo|cam kết|hàng đầu|số 1|tốt nhất/i, /\d{2,}\s?(học sinh|gia sư|phụ huynh)|\d+\s?%/,
  ];
  const strings = (v: unknown, out: string[] = []): string[] => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") Object.values(v).forEach(x => strings(x, out)); return out; };
  const hit = (s: string) => BANNED.some(re => re.test(s));
  const all = strings(DEF).filter(s => !s.startsWith("/")); // bỏ href: "%90" trong URL-encode không phải số liệu
  check(`mọi chuỗi mặc định (${all.length}) sạch chữ cấm`, all.filter(hit).length === 0, all.filter(hit));
  check("[phá cố ý] bộ quét bắt 'Học live mỗi tối', 'Trợ giảng riêng 1-1', '1.200+ học sinh', 'cam kết 100%'", ["Học live mỗi tối", "Trợ giảng riêng 1-1", "1.200+ học sinh", "cam kết 100%"].every(hit));
  check("[không bắt nhầm] 'Học ở đây thì được gì?' và 'Gia nhập cộng đồng KiN'", !hit("Học ở đây thì được gì?") && !hit("Gia nhập cộng đồng KiN ngay hôm nay"));
}

section("10. Quét tĩnh page.tsx");
{
  const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf-8");
  check("page.tsx không có dangerouslySetInnerHTML", !/dangerouslySetInnerHTML/.test(page));
  check("page.tsx không còn landingCopy / h-gia-su", !/landingCopy/.test(page) && !/h-gia-su/.test(page));
  check("page.tsx có export const revalidate = 3600 và import loadHomeContent", /export const revalidate = 3600/.test(page) && /import[^;]*\bloadHomeContent\b[^;]*from/.test(page));
}

done();
