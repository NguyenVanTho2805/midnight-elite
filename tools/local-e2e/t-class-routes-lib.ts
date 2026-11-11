// GS-LOP-GON (09/11/2026) → LOI-02 (11/11/2026) — hợp đồng đường của trang lớp gia sư (src/lib/tutorClassRoutes.ts) + dải tab 4 mục (contentTabsFor). THUẦN: không DB, không mạng.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-class-routes-lib.ts
// Ca phá cố ý (thử phá mã → ca đỏ → trả lại):
//   - legacyClassTarget: bỏ nhánh `case "hoc-sinh"` xin-vao (muc=xin-vao khi có duyet/n) → ca 'hoc-sinh + duyet → muc=xin-vao' đỏ;
//   - bỏ KEEP khỏi `ma-moi` → ca 'giữ moi/them/ma' đỏ; thêm tham số lạ vào danh sách trắng → ca 'tham số lạ bị bỏ' đỏ;
//   - đổi `encodeURIComponent` trong classBase thành chuỗi thô → ca 'id có / ? # % được mã hoá' và 'không mở chuyển hướng ra ngoài' đỏ;
//   - coverImageOf: nới regex nhận `http:` hoặc `data:` → ca 'chỉ https' đỏ; bỏ kiểm `u.username` → ca 'địa chỉ có tài khoản' đỏ.
//   - contentTabsFor: để "Cài đặt" sáng khi không ?tab= → ca 'gốc trần → Bài học' đỏ; bỏ lọc vai đồng giảng → ca 'đồng giảng chỉ Bài học' đỏ.
//   - LOI-02: classPageDecision trả redirect …/giao-trinh khi không tab (bản cũ) → mọi hàng "thân Bài học" đỏ; legacyClassTarget nhánh mặc định còn …/giao-trinh
//     → ca 'không tab → gốc lớp' đỏ; để lại tab 'Lịch học' trong dải → ca '…/lich-hoc không tab nào sáng' đỏ.
import {
  legacyClassTarget, classPageDecision, coverImageOf, mucHocSinhOf, mucCaiDatOf, classBase, coTeacherClassHref,
  MUC_HOC_SINH, MUC_CAI_DAT, KEEP_QUERY_KEYS,
} from "@/lib/tutorClassRoutes";
import { contentTabsFor, giaoTrinhHref, baiHocHref } from "@/lib/tutorRoutes";
import { check, section, done } from "./h";

const Q = "/lop-cua-toi/quan-lop/toan-9";
const L = (q: Record<string, string | string[] | undefined>) => legacyClassTarget("toan-9", q);

section("legacyClassTarget — bảng 3.1 (chủ lớp mở /lop-cua-toi/[courseId])");
check("LOI-02: không tab → gốc lớp (tab Bài học; trước: …/giao-trinh)", L({}) === Q, L({}));
check("tab lạ → như không tab (gốc lớp)", L({ tab: "xyz" }) === Q && L({ tab: "" }) === Q);
check("LOI-02: tab=giao-trinh / chuong-bai (lạ với bảng 3.1) → gốc lớp, KHÔNG query", L({ tab: "giao-trinh" }) === Q && L({ tab: "chuong-bai" }) === Q);
check("diem-danh → …/diem-danh", L({ tab: "diem-danh" }) === `${Q}/diem-danh`);
check("hoc-sinh → …/hoc-vien (không muc)", L({ tab: "hoc-sinh" }) === `${Q}/hoc-vien`, L({ tab: "hoc-sinh" }));
check("hoc-sinh + duyet + n → muc=xin-vao, giữ duyet, n", L({ tab: "hoc-sinh", duyet: "ok", n: "2" }) === `${Q}/hoc-vien?muc=xin-vao&duyet=ok&n=2`, L({ tab: "hoc-sinh", duyet: "ok", n: "2" }));
check("hoc-sinh + chỉ n → vẫn xin-vao", L({ tab: "hoc-sinh", n: "1" }) === `${Q}/hoc-vien?muc=xin-vao&n=1`);
check("hoc-sinh + them=3 → giữ them, không muc", L({ tab: "hoc-sinh", them: "3" }) === `${Q}/hoc-vien?them=3`, L({ tab: "hoc-sinh", them: "3" }));
check("ma-moi → …/hoc-vien?muc=ma-moi", L({ tab: "ma-moi" }) === `${Q}/hoc-vien?muc=ma-moi`);
check("ma-moi giữ moi / them / ma", L({ tab: "ma-moi", moi: "1", them: "loi", ma: "loi" }) === `${Q}/hoc-vien?muc=ma-moi&moi=1&them=loi&ma=loi`, L({ tab: "ma-moi", moi: "1", them: "loi", ma: "loi" }));
check("giao-vien → cai-dat + muc=dong-giang", L({ tab: "giao-vien" }) === `${Q}?tab=cai-dat&muc=dong-giang`);
check("hoc-phi → cai-dat + muc=hoc-phi", L({ tab: "hoc-phi" }) === `${Q}?tab=cai-dat&muc=hoc-phi`);
check("cong-dong → cai-dat + muc=cong-dong", L({ tab: "cong-dong" }) === `${Q}?tab=cai-dat&muc=cong-dong`);
check("không tab + moi=1 → hạ cánh ở mã mời, giữ moi (lớp mới chưa có học sinh)", L({ moi: "1" }) === `${Q}/hoc-vien?muc=ma-moi&moi=1`, L({ moi: "1" }));
check("moi=1 giữ them / ma / lich để không mất thông báo lỗi", L({ moi: "1", them: "2", ma: "loi", lich: "loi" }) === `${Q}/hoc-vien?muc=ma-moi&moi=1&them=2&ma=loi&lich=loi`, L({ moi: "1", them: "2", ma: "loi", lich: "loi" }));
check("moi khác '1' không phải hạ cánh tạo lớp", L({ moi: "0" }) === Q);
check("không tab + lich=loi → …/lich-hoc?lich=loi", L({ lich: "loi" }) === `${Q}/lich-hoc?lich=loi`);
check("không tab + duyet → muc=xin-vao", L({ duyet: "tuchoi" }) === `${Q}/hoc-vien?muc=xin-vao&duyet=tuchoi`);
check("thứ tự ưu tiên khi không tab: moi > lich > duyet", L({ moi: "1", lich: "loi", duyet: "ok" }).includes("muc=ma-moi") && L({ lich: "loi", duyet: "ok" }).includes("/lich-hoc"));
check("URLSearchParams cũng được nhận (như Request.url)", legacyClassTarget("toan-9", new URLSearchParams("tab=hoc-sinh&duyet=ok&n=1")) === `${Q}/hoc-vien?muc=xin-vao&duyet=ok&n=1`);
check("giá trị mảng (?tab=a&tab=b) lấy phần tử đầu, không nổ", L({ tab: ["diem-danh", "hoc-phi"] }) === `${Q}/diem-danh`);

section("legacyClassTarget — ca phá: tham số lạ, mở chuyển hướng, id lạ");
check("tham số lạ bị bỏ (evil, redirect, next, q)", (() => { const t = L({ tab: "ma-moi", evil: "1", redirect: "https://evil.example", next: "/x", q: "a" }); return t === `${Q}/hoc-vien?muc=ma-moi` && !/evil|redirect|next|q=/.test(t); })(), L({ tab: "ma-moi", evil: "1", redirect: "https://evil.example" }));
check("tab=//evil.example → coi như tab lạ, đích vẫn trong quan-lop", L({ tab: "//evil.example" }) === Q);
check("duyet=http://x được MÃ HOÁ thành giá trị query, không thành đích", (() => { const t = L({ tab: "hoc-sinh", duyet: "http://x" }); return t.startsWith(`${Q}/hoc-vien?`) && t.includes("duyet=http%3A%2F%2Fx"); })(), L({ tab: "hoc-sinh", duyet: "http://x" }));
check("giá trị quá dài (> 64 ký tự) bị bỏ", L({ tab: "hoc-sinh", duyet: "a".repeat(65) }) === `${Q}/hoc-vien`);
check("MỌI đích đều nằm dưới /lop-cua-toi/quan-lop/ và cùng gốc", ["", "diem-danh", "hoc-sinh", "ma-moi", "giao-vien", "hoc-phi", "cong-dong", "//evil.example", "https://evil.example", "javascript:alert(1)"]
  .every(tab => { const t = L({ tab, moi: "1", duyet: "//evil.example", n: "http://x" }); return t.startsWith("/lop-cua-toi/quan-lop/toan-9") && !t.includes("//evil") && !t.startsWith("//"); }));
const WEIRD = ["a/b", "a?x=1", "a#h", "../admin", "..", ".", "a%b", "a b", "%00", "x".repeat(300), "https://evil.example/x"];
check("courseId có / ? # % khoảng trắng .. được mã hoá: đích luôn đúng 5 đoạn, không query lẫn, không thoát", WEIRD.every(id => {
  const t = legacyClassTarget(id, { tab: "diem-danh" });
  return t.startsWith("/lop-cua-toi/quan-lop/") && t.endsWith("/diem-danh") && t.split("/").length === 5 && !t.includes("?") && !t.includes("#") && !t.split("/").some(seg => seg === ".." || seg === ".");
}), WEIRD.map(id => legacyClassTarget(id, { tab: "diem-danh" })));
check("classBase mã hoá đúng như giaoTrinhHref / baiHocHref (cùng một cách, LOI-02: = gốc lớp)", WEIRD.every(id => classBase(id) === giaoTrinhHref(id, true) && classBase(id) === baiHocHref(id)));
check("phá: legacyClassTarget không tab với id lạ → gốc lớp đúng 4 đoạn, không thoát", WEIRD.every(id => { const t = legacyClassTarget(id, {}); return t === classBase(id) && t.split("/").length === 4 && !t.includes("?") && !t.includes("#") && new URL(t, "https://x.vn").pathname.startsWith("/lop-cua-toi/quan-lop/"); }), WEIRD.map(id => legacyClassTarget(id, {})));
check("danh sách trắng đúng 6 khoá: moi, lich, them, duyet, n, ma", KEEP_QUERY_KEYS.join() === "moi,lich,them,duyet,n,ma");
check("coTeacherClassHref giữ /lop-cua-toi/<id> đã mã hoá", coTeacherClassHref("toan-9") === "/lop-cua-toi/toan-9" && coTeacherClassHref("a/b") === "/lop-cua-toi/a%2Fb");

section("classPageDecision — trang /lop-cua-toi/quan-lop/[id]");
const D = (q: Record<string, string | string[] | undefined>) => classPageDecision("toan-9", q);
const red = (d: ReturnType<typeof D>) => (d.kind === "redirect" ? d.to : `TAB:${d.tab}:${d.muc}`);
// LOI-02 bảng A4: không tab / chuong-bai / giao-trinh / lạ ⇒ thân Bài học NGAY TẠI gốc (không chuyển hướng — gốc có loading.tsx).
for (const q of [{}, { tab: "chuong-bai" }, { tab: "giao-trinh" }, { tab: "xyz" }, { tab: "" }, { tab: "//evil.example" }, { tab: ["chuong-bai", "cai-dat"] }, { moi: "1" }, { duyet: "ok", n: "2" }, { tab: "chuong-bai", muc: "hoc-phi" }] as Record<string, string | string[]>[])
  check(`LOI-02: ${JSON.stringify(q)} → thân Bài học (kind tab, KHÔNG redirect)`, red(D(q)) === "TAB:bai-hoc:thong-tin", red(D(q)));
check("diem-danh / lich-hoc / hoc-vien → đúng trang con (redirect như #154)", red(D({ tab: "diem-danh" })) === `${Q}/diem-danh` && red(D({ tab: "lich-hoc" })) === `${Q}/lich-hoc` && red(D({ tab: "hoc-vien" })) === `${Q}/hoc-vien`);
check("phá: không còn quyết định nào trỏ …/giao-trinh (đường đó nay chỉ 307 về gốc)", [{}, { tab: "giao-trinh" }, { tab: "chuong-bai" }, { tab: "xyz" }, { tab: "diem-danh" }, { tab: "lich-hoc" }, { tab: "hoc-vien" }].every(q => !red(D(q)).includes("giao-trinh")));
check("cai-dat → thân Cài đặt, muc mặc định thong-tin", red(D({ tab: "cai-dat" })) === "TAB:cai-dat:thong-tin");
check("cai-dat + muc hợp lệ → giữ; muc lạ → thong-tin (không lỗi)", MUC_CAI_DAT.every(m => red(D({ tab: "cai-dat", muc: m })) === `TAB:cai-dat:${m}`) && red(D({ tab: "cai-dat", muc: "rac" })) === "TAB:cai-dat:thong-tin" && red(D({ tab: "cai-dat", muc: ["hoc-phi", "x"] })) === "TAB:cai-dat:hoc-phi");
check("phá: kiểu cũ 'chuong-bai' không còn là giá trị tab", red(D({ tab: "chuong-bai" })) !== "TAB:chuong-bai:thong-tin");
check("chuyển hướng giữ danh sách trắng (moi, lich…) và bỏ tham số lạ: ?tab=lich-hoc&moi=1 (tạo lớp từ danh sách khoá)", red(D({ tab: "lich-hoc", moi: "1", evil: "x" })) === `${Q}/lich-hoc?moi=1`, red(D({ tab: "lich-hoc", moi: "1", evil: "x" })));
check("hoc-vien giữ muc hợp lệ (trừ mặc định), bỏ muc lạ", red(D({ tab: "hoc-vien", muc: "xin-vao" })) === `${Q}/hoc-vien?muc=xin-vao` && red(D({ tab: "hoc-vien", muc: "danh-ba" })) === `${Q}/hoc-vien` && red(D({ tab: "hoc-vien", muc: "rac" })) === `${Q}/hoc-vien`);
check("phá: ?tab=//evil.example, ?duyet=http://x → không chuyển hướng ra ngoài (thân Bài học hoặc đích trong quan-lop/toan-9)", [D({ tab: "//evil.example" }), D({ duyet: "http://x" }), D({ tab: "hoc-vien", duyet: "http://x", n: "//e" })].every(d => d.kind === "tab" || (d.to.startsWith(Q) && !d.to.includes("//evil"))) && D({ tab: "hoc-vien", duyet: "http://x", n: "//e" }).kind === "redirect");
check("phá: id lạ vẫn được mã hoá", WEIRD.every(id => { const d = classPageDecision(id, { tab: "lich-hoc" }); return d.kind === "redirect" && d.to.startsWith("/lop-cua-toi/quan-lop/") && d.to.endsWith("/lich-hoc") && d.to.split("/").length === 5; }));

section("mục con (?muc=)");
check("Học sinh: danh-ba · xin-vao · ma-moi · them; mặc định danh-ba", MUC_HOC_SINH.join() === "danh-ba,xin-vao,ma-moi,them" && mucHocSinhOf(undefined) === "danh-ba" && mucHocSinhOf("rac") === "danh-ba" && mucHocSinhOf("ma-moi") === "ma-moi");
check("Cài đặt: thong-tin · hoc-phi · dong-giang · cong-dong · ban-ghi; mặc định thong-tin", MUC_CAI_DAT.join() === "thong-tin,hoc-phi,dong-giang,cong-dong,ban-ghi" && mucCaiDatOf(null) === "thong-tin" && mucCaiDatOf("hoc-phi") === "hoc-phi");
check("phá: muc là mảng / số / __proto__ → mặc định", mucHocSinhOf(["ma-moi"]) === "danh-ba" && mucCaiDatOf(5) === "thong-tin" && mucCaiDatOf("__proto__") === "thong-tin" && mucCaiDatOf("constructor") === "thong-tin");

section("coverImageOf — chỉ ảnh https đã lọc (thẻ lớp)");
check("url(\"https://…\") ✓ (nháy kép / đơn / không nháy)", coverImageOf('url("https://cdn.example.com/a/b.jpg")') === "https://cdn.example.com/a/b.jpg" && coverImageOf("url('https://cdn.example.com/a.png')") === "https://cdn.example.com/a.png" && coverImageOf("url(https://cdn.example.com/a.webp)") === "https://cdn.example.com/a.webp");
check("nền kèm lớp phủ: lấy đúng url trong chuỗi", coverImageOf('linear-gradient(#000,#111), url("https://cdn.example.com/x.jpg") center/cover') === "https://cdn.example.com/x.jpg");
check("giữ query hợp lệ của ảnh", coverImageOf('url("https://res.cloudinary.com/x/image/upload/v1/a.jpg?w=400&q=80")') === "https://res.cloudinary.com/x/image/upload/v1/a.jpg?w=400&q=80");
check("màu thô / gradient / rỗng / null → null", ["#fff", "", "linear-gradient(135deg, #3b82f6, #1d4ed8)", "red", "   "].every(b => coverImageOf(b) === null) && coverImageOf(null) === null && coverImageOf(undefined) === null);
check("phá: chỉ https — http:, data:, javascript:, ftp:, //cdn → null", ['url("http://x.example/a.jpg")', 'url("data:image/png;base64,AAAA")', 'url(javascript:alert(1))', 'url("javascript:alert(1)")', 'url("ftp://x.example/a.jpg")', 'url("//cdn.example.com/a.jpg")', "url(HTTP://x.example/a.jpg)"].every(b => coverImageOf(b) === null),
  ['url("http://x.example/a.jpg")', 'url("data:image/png;base64,AAAA")'].map(coverImageOf));
check("phá: địa chỉ có tài khoản, khoảng trắng, nháy, ngoặc, < > \\ → null", ['url("https://user:pw@x.example/a.jpg")', 'url("https://x.example/a b.jpg")', 'url("https://x.example/a(b).jpg")', 'url("https://x.example/a<script>.jpg")', 'url("https://x.example/a\\b.jpg")', 'url("https://")', 'url("https:///a.jpg")'].every(b => coverImageOf(b) === null),
  ['url("https://user:pw@x.example/a.jpg")', 'url("https://x.example/a b.jpg")'].map(coverImageOf));
check("phá: đóng ngoặc sớm để chèn thuộc tính CSS không lọt: url(\"https://x.example/a.jpg\");background:url(javascript:1) lấy đúng phần đầu", coverImageOf('url("https://x.example/a.jpg");background:url(javascript:1)') === "https://x.example/a.jpg");
check("phá: quá dài (> 2048) → null", coverImageOf(`url("https://x.example/${"a".repeat(2100)}")`) === null && coverImageOf("x".repeat(5000)) === null);
check("kết quả luôn là https hợp lệ hoặc null (quét 12 mẫu)", ['url("https://a.b/c")', "red", 'url(javascript:1)', "", 'url("http://a.b")', 'url("https://a.b/c d")', "url(https://a.b/c)", "none", "url()", "url(https:)", 'url("https://a.b:8443/x.png")', "url(https://x.y/z?a=1&b=2)"]
  .every(b => { const r = coverImageOf(b); return r === null || (r.startsWith("https://") && !/[\s"'()<>\\]/.test(r)); }));

section("contentTabsFor — dải tab 4 mục (LOI-02, một nơi duy nhất)");
const ORDER = "Bài học · Học sinh · Điểm danh · Cài đặt";
const tabs = (p: string, t: string | null = null, r?: Parameters<typeof contentTabsFor>[2]) => contentTabsFor(p, t, r);
const lit = (p: string, t: string | null = null, r?: Parameters<typeof contentTabsFor>[2]) => tabs(p, t, r)?.tabs.filter(x => x.active).map(x => x.label).join() ?? "∅";
const G = tabs(Q);
check("thứ tự: " + ORDER, G?.label === "Quản lớp" && G.tabs.map(t => t.label).join(" · ") === ORDER, G?.tabs.map(t => t.label));
check("href: gốc · hoc-vien · diem-danh · ?tab=cai-dat", G?.tabs.map(t => t.href).join("|") === [Q, `${Q}/hoc-vien`, `${Q}/diem-danh`, `${Q}?tab=cai-dat`].join("|"), G?.tabs.map(t => t.href));
const A2: [string, string | null, string][] = [
  [Q, null, "Bài học"], [Q, "chuong-bai", "Bài học"], [Q, "giao-trinh", "Bài học"], [Q, "xyz", "Bài học"],
  [`${Q}/giao-trinh`, null, "Bài học"], [`${Q}/giao-trinh/xem/l-1`, "cai-dat", "Bài học"],
  [`${Q}/hoc-vien`, null, "Học sinh"], [Q, "hoc-vien", "Học sinh"], [`${Q}/diem-danh`, null, "Điểm danh"], [`${Q}/diem-danh/in`, "cai-dat", "Điểm danh"],
  [Q, "cai-dat", "Cài đặt"], [Q, "lich-hoc", ""], [Q, "diem-danh", ""], [`${Q}/lich-hoc`, null, ""],
];
check("mỗi đường đúng tab sáng theo bảng A2 (nhiều nhất MỘT)", A2.every(([p, t, want]) => lit(p, t) === want), A2.filter(([p, t, want]) => lit(p, t) !== want).map(([p, t]) => [p, t, lit(p, t)]));
check("…/lich-hoc (mở bằng link): dải vẫn hiện, KHÔNG tab nào sáng", tabs(`${Q}/lich-hoc`)?.tabs.length === 4 && lit(`${Q}/lich-hoc`) === "");
check("phá: không còn nhãn 'Giáo trình' · 'Lịch học' · 'Bài tập' · 'Bài tập tự nộp' · 'Danh bạ lớp'", ![G, tabs(`${Q}/lich-hoc`), tabs(`${Q}/giao-trinh`, null, "co_teacher")].some(g => g?.tabs.some(t => ["Giáo trình", "Lịch học", "Bài tập", "Bài tập tự nộp", "Danh bạ lớp"].includes(t.label))));
check("phá: tiền tố giả (giao-trinh-khac, hoc-vienx, diem-danhx) không làm sáng", lit(`${Q}/giao-trinh-khac`) === "" && lit(`${Q}/hoc-vienx`) === "" && lit(`${Q}/diem-danhx`) === "");
check("tao-moi / danh sách lớp / trang khác → không dải", tabs("/lop-cua-toi/quan-lop/tao-moi") === null && tabs("/lop-cua-toi/quan-lop/tao-moi/giao-trinh") === null && tabs("/lop-cua-toi/quan-lop") === null && tabs("/lop-cua-toi/lich") === null);
check("đồng giảng / bộ môn → chỉ 'Bài học' (sáng ở gốc)", (["co_teacher", "subject_teacher"] as const).every(r => tabs(Q, null, r)?.tabs.map(t => t.label).join(" · ") === "Bài học" && lit(Q, null, r) === "Bài học"));
check("chủ lớp / quản trị / không vai → đủ 4", (["owner", "admin", null, undefined] as const).every(r => tabs(Q, null, r)?.tabs.length === 4));
check("đồng giảng ở trang lịch (mở bằng link) → không tab nào sáng", lit(`${Q}/lich-hoc`, null, "co_teacher") === "");
check("nhóm Đề thi KHÔNG đổi (4 tab, sáng theo tiền tố dài nhất)", tabs("/lop-cua-toi/de-thi/ngan-hang-cau-hoi/b1")?.tabs.map(t => t.label).join(" · ") === "Đề thi · Ngân hàng câu hỏi · Ma trận đề · Tệp đề gốc" && lit("/lop-cua-toi/de-thi/ngan-hang-cau-hoi/b1") === "Ngân hàng câu hỏi");
check("href của mọi tab giữ id đã mã hoá (không thoát khỏi lớp)", (() => { const g = contentTabsFor(`/lop-cua-toi/quan-lop/${encodeURIComponent("a/b")}/giao-trinh`); return !!g && g.tabs.every(t => t.href.startsWith("/lop-cua-toi/quan-lop/a%2Fb")); })());
check("phá: lớp id '..' (classBase → %252E%252E) — mọi tab ở trong quan-lop", (() => { const g = contentTabsFor(classBase("..")); return !!g && g.tabs.every(t => new URL(t.href, "https://x.vn").pathname.startsWith("/lop-cua-toi/quan-lop/")); })());

done();
