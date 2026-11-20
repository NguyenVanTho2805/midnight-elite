// LOI-05 — phần THUẦN của thẻ gia sư + bộ lọc sàn: src/lib/tutorCardView.ts, src/lib/tutorFloorFilter.ts. Không cần DB hay máy chủ.
// Chạy: TZ=Asia/Ho_Chi_Minh DATABASE_URL=postgresql://x:x@localhost:1/x npx tsx tools/local-e2e/t-tutor-card-lib.ts
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-05.md mục 2, 3.2, 3.3, 5. Có ca phá cố ý (tên 80 ký tự, NFD, emoji, khoảng trắng lạ, avatar javascript:/http:,
// giá null, rating, mode rác, ?mode=<script>, tham số cũ).
import { readFileSync } from "node:fs";
import { BIO_SNIPPET_MAX, PRICE_SUFFIX, bioSnippet, gradeLine, initialsOf, tutorCardView, type TutorCardView } from "@/lib/tutorCardView";
import { SAN_LOC_RONG, apiQuery, demSanLoc, docSanLoc, ghiSanLoc, moTaSanLoc, type SanLoc } from "@/lib/tutorFloorFilter";
import { parseTutorQuery, type TutorListItem } from "@/lib/tutorSearch";
import { areaLine, priceText, type PublicArea } from "@/lib/tutorArea";
import { check, section, done } from "./h";

const T = (o: Partial<TutorListItem> = {}): TutorListItem => ({
  id: "t1", name: "Nguyễn Thị Minh Anh", avatarBase64: null, bio: null, subjects: [], tutorVerified: true, classCount: 0, studentCount: 0,
  sessionsTaught: 0, recentlyActive: false, area: null, rating: { avg: null, total: 0 }, ...o,
});
const A = (o: Partial<PublicArea> = {}): PublicArea => ({ city: null, district: null, mode: null, credential: null, price: null, ...o });
const sp = (s: string) => new URLSearchParams(s);
const len = (s: string) => Array.from(s).length;
const VIEW_KEYS = ["id", "name", "initials", "avatar", "subjects", "moreSubjects", "gradeLine", "areaLine", "modeLabel", "priceLine", "bio"].sort().join();
const PNG = "data:image/png;base64,iVBORw0KGgo=";

(async () => {
  // ── initialsOf ─────────────────────────────────────────────────────────────────────────────────────────────
  section("initialsOf: chữ đầu của từ đầu và từ cuối, in hoa");
  check('"Nguyễn Thị Minh Anh" → "NA"', initialsOf("Nguyễn Thị Minh Anh") === "NA", initialsOf("Nguyễn Thị Minh Anh"));
  check('một từ "Lan" → "L"', initialsOf("Lan") === "L");
  check('chữ thường "đỗ văn ánh" → "ĐÁ" (đ in hoa thành Đ, giữ dấu)', initialsOf("đỗ văn ánh") === "ĐÁ", initialsOf("đỗ văn ánh"));
  check('rỗng → "?"', initialsOf("") === "?");
  check('chỉ khoảng trắng → "?"', initialsOf("   \t\n ") === "?");
  check('rác số/dấu "123 !!! ---" → "?"', initialsOf("123 !!! ---") === "?", initialsOf("123 !!! ---"));
  check('chỉ emoji "😀 🎉" → "?"', initialsOf("😀 🎉") === "?", initialsOf("😀 🎉"));
  check('(phá) emoji đứng đầu "😀 Trần Bình" → "TB"', initialsOf("😀 Trần Bình") === "TB", initialsOf("😀 Trần Bình"));
  check('(phá) dấu ngoặc "(Cô) Lan" → "CL"', initialsOf("(Cô) Lan") === "CL", initialsOf("(Cô) Lan"));
  const nfd = "Nguyễn Ánh".normalize("NFD");
  check("(phá) tên NFD cho cùng kết quả với NFC (không rơi dấu thành chữ trần)", initialsOf(nfd) === initialsOf("Nguyễn Ánh") && initialsOf(nfd) === "NÁ", [initialsOf(nfd), [...initialsOf(nfd)].map(c => c.codePointAt(0))]);
  check("(phá) khoảng trắng lạ (NBSP, tab, zero-width) giữa từ", initialsOf("Lê Văn​Tâm\tHà") === "LH", initialsOf("Lê Văn​Tâm\tHà"));
  check("(phá) ký tự đổi chiều chữ không lọt vào chữ cái đầu", initialsOf("‮An Bình") === "AB", initialsOf("‮An Bình"));
  check("luôn ≤ 2 ký tự, kể cả chữ in hoa thành 2 ký tự (ß)", len(initialsOf("ßeta Zed")) <= 2 && len(initialsOf("Nguyễn Trần Hoàng Bảo Ngọc Phương Thảo Uyên Nhi")) === 2);
  check("đầu vào không phải chuỗi (dữ liệu hỏng) → \"?\" không ném", initialsOf(null as unknown as string) === "?" && initialsOf(42 as unknown as string) === "?");

  // ── gradeLine ──────────────────────────────────────────────────────────────────────────────────────────────
  section("gradeLine: số lớp gom dải; nhóm khi không có số");
  check('[6,7,8,9,12] → "Lớp 6–9, 12"', gradeLine(["Toán 6", "Toán 7", "Văn 8", "Lý 9", "Hoá 12"]) === "Lớp 6–9, 12", gradeLine(["Toán 6", "Toán 7", "Văn 8", "Lý 9", "Hoá 12"]));
  check('một số "Toán 9" → "Lớp 9"', gradeLine(["Toán 9"]) === "Lớp 9");
  check('hai số liền "Toán 8", "Toán 9" → "Lớp 8–9"', gradeLine(["Toán 8", "Toán 9"]) === "Lớp 8–9", gradeLine(["Toán 8", "Toán 9"]));
  check('số không theo thứ tự + trùng → sắp & bỏ trùng', gradeLine(["Lý 12", "Toán 1", "Toán 3", "Văn 12", "Toán 2"]) === "Lớp 1–3, 12", gradeLine(["Lý 12", "Toán 1", "Toán 3", "Văn 12", "Toán 2"]));
  check('"Tiếng Anh lớp 5" → "Lớp 5"', gradeLine(["Tiếng Anh lớp 5"]) === "Lớp 5");
  check('có số + Đại học → thêm "Đại học"', gradeLine(["Toán 12", "Giải tích đại học"]) === "Lớp 12 · Đại học", gradeLine(["Toán 12", "Giải tích đại học"]));
  check('không số: "Toán THCS", "Lý THPT" → "THCS · THPT"', gradeLine(["Toán THCS", "Lý THPT"]) === "THCS · THPT", gradeLine(["Toán THCS", "Lý THPT"]));
  check('không số: "cấp 1" → "Tiểu học" (cấp 1 không phải lớp 1)', gradeLine(["Toán cấp 1"]) === "Tiểu học", gradeLine(["Toán cấp 1"]));
  check('nhóm đã có số đại diện thì không lặp: "Toán 9" + "Văn THCS" → "Lớp 9"', gradeLine(["Toán 9", "Văn THCS"]) === "Lớp 9", gradeLine(["Toán 9", "Văn THCS"]));
  check('nhóm không có số đại diện được nối thêm: "Toán 9" + "Lý THPT" → "Lớp 9 · THPT"', gradeLine(["Toán 9", "Lý THPT"]) === "Lớp 9 · THPT", gradeLine(["Toán 9", "Lý THPT"]));
  check('không suy được: "IELTS 6.5", "Toán 99", "A1", [] → ""', gradeLine(["IELTS 6.5"]) === "" && gradeLine(["Toán 99"]) === "" && gradeLine(["Tiếng Anh A1"]) === "" && gradeLine([]) === "");
  check("(phá) phần tử không phải chuỗi / mảng hỏng không ném", gradeLine([null, 9, "Toán 9"] as unknown as string[]) === "Lớp 9" && gradeLine(null as unknown as string[]) === "");

  // ── bioSnippet ─────────────────────────────────────────────────────────────────────────────────────────────
  section("bioSnippet: gộp khoảng trắng, cắt ở ranh giới từ + …");
  check("null → \"\"", bioSnippet(null) === "");
  check("ngắn giữ nguyên (sau khi gộp khoảng trắng / xuống dòng)", bioSnippet("  Dạy Toán\n\n  cho   học sinh  \r\n lớp 9 ") === "Dạy Toán cho học sinh lớp 9", bioSnippet("  Dạy Toán\n\n  cho   học sinh  \r\n lớp 9 "));
  const longBio = "Tôi dạy Toán và Vật lý cho học sinh trung học cơ sở và trung học phổ thông, chú trọng hiểu bản chất, luyện đề có hệ thống, sửa lỗi sai từng bài và báo tiến độ cho gia đình mỗi tuần. ".repeat(3);
  const sn = bioSnippet(longBio);
  check(`dài hơn ${BIO_SNIPPET_MAX} → ≤ ${BIO_SNIPPET_MAX} ký tự, kết thúc "…"`, len(sn) <= BIO_SNIPPET_MAX && sn.endsWith("…"), [len(sn), sn.slice(-20)]);
  check("cắt ở ranh giới từ: phần trước … là tiền tố đúng của bio và kết thúc trọn một từ", (() => {
    const body = sn.slice(0, -1);
    const clean = longBio.replace(/\s+/g, " ").trim();
    // ký tự ngay sau phần giữ lại là khoảng trắng hoặc dấu câu (không cắt giữa một từ); phần giữ lại không kết thúc bằng khoảng trắng / dấu phẩy
    return clean.startsWith(body) && /[\s,.;:–—-]/.test(clean.charAt(body.length)) && !/[\s,]$/.test(body);
  })(), sn);
  check("đúng bằng max → giữ nguyên, không …", (() => { const s = "a".repeat(180); return bioSnippet(s) === s; })());
  check("max tuỳ chọn: bioSnippet(…, 20) ≤ 20", len(bioSnippet("một hai ba bốn năm sáu bảy tám chín mười", 20)) <= 20 && bioSnippet("một hai ba bốn năm sáu bảy tám chín mười", 20).endsWith("…"), bioSnippet("một hai ba bốn năm sáu bảy tám chín mười", 20));
  check("(phá) một từ rất dài không có khoảng trắng → cắt cứng, vẫn ≤ max", (() => { const s = bioSnippet("x".repeat(500)); return len(s) === BIO_SNIPPET_MAX && s.endsWith("…"); })());
  check("(phá) emoji ở điểm cắt không bị chặt đôi (không còn nửa cặp thay thế)", (() => {
    const s = bioSnippet("😀".repeat(300));
    return !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s) && len(s) <= BIO_SNIPPET_MAX;
  })());
  check("(phá) ký tự vô hình / đổi chiều bị bỏ", bioSnippet("Dạy​‮Toán\u0000") === "Dạy Toán", bioSnippet("Dạy​‮Toán\u0000"));
  check("(phá) max rác (NaN, 0, -5) không ném, không trả rỗng sai", bioSnippet("abc def", Number.NaN) === "abc def" && bioSnippet("abc def", 0) === "…" && bioSnippet("abc def", -5) === "…");

  // ── tutorCardView ──────────────────────────────────────────────────────────────────────────────────────────
  section("tutorCardView: tập khoá, không rating, không bịa");
  const full = tutorCardView(T({
    id: "abc", name: "  Trần   Văn  Bình ", avatarBase64: PNG, bio: "Dạy Toán 9.", subjects: ["Toán 9", "Vật lý 12", "Toán 9", "  ", "Hoá 10", "Tiếng Anh lớp 5", "Văn 8"],
    area: A({ city: "Hà Nội", district: "Cầu Giấy", mode: "both", price: 200000, credential: "ĐH Sư phạm" }), rating: { avg: 4.9, total: 120 },
  }));
  check("đúng 11 khoá của TutorCardView, không thừa", Object.keys(full).sort().join() === VIEW_KEYS, Object.keys(full));
  check("(phá) rating không lọt vào view (không khoá, không số 4.9 / 120 ở bất kỳ đâu)", !("rating" in full) && !/4[.,]9|120|★|sao/.test(JSON.stringify(full)), full);
  check("không có chữ 'xác minh' / 'uy tín' / 'top' trong view", !/xác minh|uy tín|\btop\b/i.test(JSON.stringify(full)));
  check("tên gộp khoảng trắng, đầy đủ", full.name === "Trần Văn Bình");
  check("initials theo tên đã làm sạch", full.initials === "TB");
  check("avatar data:image giữ nguyên", full.avatar === PNG);
  check("môn: bỏ trùng + rỗng, tối đa 4, moreSubjects = phần còn lại", full.subjects.join("|") === "Toán 9|Vật lý 12|Hoá 10|Tiếng Anh lớp 5" && full.moreSubjects === 1, [full.subjects, full.moreSubjects]);
  check("gradeLine tính trên MỌI môn (kể cả môn bị ẩn sau +n)", full.gradeLine === "Lớp 5, 8–10, 12", full.gradeLine);
  check('areaLine = areaLine() của tutorArea: "Hà Nội · Cầu Giấy"', full.areaLine === areaLine({ city: "Hà Nội", district: "Cầu Giấy" }) && full.areaLine === "Hà Nội · Cầu Giấy", full.areaLine);
  check("modeLabel both → \"Online + dạy trực tiếp\"", full.modeLabel === "Online + dạy trực tiếp");
  check("priceLine = priceText + \" · giá tham khảo, tự khai\"", full.priceLine === priceText(200000) + PRICE_SUFFIX && full.priceLine.endsWith("· giá tham khảo, tự khai"), full.priceLine);
  check("bio qua bioSnippet", full.bio === "Dạy Toán 9.");
  check("maxSubjects tuỳ chọn: 2 → 2 môn, +3", (() => { const v = tutorCardView(T({ subjects: ["A", "B", "C", "D", "E"] }), 2); return v.subjects.length === 2 && v.moreSubjects === 3; })());
  check("(phá) maxSubjects rác (-1, NaN) không ném", tutorCardView(T({ subjects: ["A", "B"] }), -1).subjects.length === 0 && tutorCardView(T({ subjects: ["A", "B"] }), Number.NaN).subjects.length === 2);

  section("tutorCardView: tên KHÔNG BAO GIỜ bị cắt");
  const name80 = "Nguyễn Trần Hoàng Bảo Ngọc Phương Thảo Uyên Nhi Lê Phạm Vũ Đặng Bùi Đỗ Hồ Ngô Dương Lý Kim Thanh";
  const n80 = name80.length >= 80 ? name80 : name80 + " Anh".repeat(Math.ceil((80 - name80.length) / 4));
  check(`(phá) tên ${n80.length} ký tự (≥ 80) giữ nguyên từng chữ, không "…"`, tutorCardView(T({ name: n80 })).name === n80 && n80.length >= 80 && !tutorCardView(T({ name: n80 })).name.includes("…"), n80.length);
  const word120 = "A".repeat(120);
  check("(phá) một từ 120 ký tự không khoảng trắng vẫn đủ 120", tutorCardView(T({ name: word120 })).name.length === 120);
  check("(phá) tên NFD: giữ nguyên chữ (chuẩn NFC), so khớp được với tên NFC", tutorCardView(T({ name: "Phương Thảo".normalize("NFD") })).name === "Phương Thảo".normalize("NFC"));
  check("(phá) tên có emoji giữ emoji", tutorCardView(T({ name: "Cô Lan 🌸" })).name === "Cô Lan 🌸" && tutorCardView(T({ name: "Cô Lan 🌸" })).initials === "CL");
  check("(phá) khoảng trắng lạ (NBSP, tab, xuống dòng) gộp thành 1 dấu cách, không mất chữ", tutorCardView(T({ name: "Lê  Văn\t\nTâm" })).name === "Lê Văn Tâm", tutorCardView(T({ name: "Lê  Văn\t\nTâm" })).name);
  check("(phá) tên rỗng → name \"\", initials \"?\" (không ném)", (() => { const v = tutorCardView(T({ name: "" })); return v.name === "" && v.initials === "?"; })());

  section("tutorCardView: ảnh chỉ data:image/");
  const av = (a: unknown) => tutorCardView(T({ avatarBase64: a as string | null })).avatar;
  check("(phá) avatar javascript: → null", av("javascript:alert(1)") === null);
  check("(phá) avatar http:/https: → null", av("http://evil.example/a.png") === null && av("https://cdn.example/a.png") === null);
  check("(phá) avatar data:text/html → null", av("data:text/html;base64,PHNjcmlwdD4=") === null);
  check("(phá) avatar có khoảng trắng đầu / chữ hoa DATA: → null", av(" data:image/png;base64,AAAA") === null && av("DATA:image/png;base64,AAAA") === null);
  check("avatar rỗng / null / không phải chuỗi → null", av("") === null && av(null) === null && av(123) === null);
  check("avatar data:image/jpeg giữ", av("data:image/jpeg;base64,/9j/4AAQ") === "data:image/jpeg;base64,/9j/4AAQ");

  section("tutorCardView: thiếu thì bỏ dòng (\"\"), không đoán");
  const bare = tutorCardView(T({ name: "Gia Sư Trống", subjects: [], area: null, bio: null }));
  check("không area → areaLine/modeLabel/priceLine rỗng; không môn → gradeLine rỗng; bio null → \"\"",
    bare.areaLine === "" && bare.modeLabel === "" && bare.priceLine === "" && bare.gradeLine === "" && bare.bio === "" && bare.subjects.length === 0 && bare.moreSubjects === 0, bare);
  check("không in \"chưa khai\" / \"chưa cập nhật\" ở đâu", !/chưa khai|chưa cập nhật|không rõ/i.test(JSON.stringify(bare)));
  check("(phá) giá null → priceLine \"\" và KHÔNG có chữ \"tự khai\"", (() => { const v = tutorCardView(T({ area: A({ city: "Huế", price: null }) })); return v.priceLine === "" && !JSON.stringify(v).includes("tự khai"); })());
  check("(phá) giá rác (0, âm, NaN, chuỗi) → không có dòng giá", [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "200000"].every(p => tutorCardView(T({ area: A({ city: "Huế", price: p as number }) })).priceLine === ""));
  check("chỉ có mode (không city/district) → areaLine \"\", modeLabel có", (() => { const v = tutorCardView(T({ area: A({ mode: "online" }) })); return v.areaLine === "" && v.modeLabel === "Online"; })());
  check("chỉ city → areaLine = city", tutorCardView(T({ area: A({ city: "Đà Nẵng" }) })).areaLine === "Đà Nẵng");
  check("offline → \"Dạy trực tiếp\"", tutorCardView(T({ area: A({ mode: "offline" }) })).modeLabel === "Dạy trực tiếp");
  const badMode = (m: string) => tutorCardView(T({ area: A({ city: "Huế", mode: m as PublicArea["mode"] }) })).modeLabel;
  check("(phá) mode rác (\"hybrid\", \"<script>\", \"constructor\", \"__proto__\", \"toString\") → \"\"", ["hybrid", "<script>", "constructor", "__proto__", "toString", ""].every(m => badMode(m) === ""), ["constructor", "__proto__", "toString"].map(badMode));
  check("view chỉ lấy từ TutorListItem: không có trường liên hệ (email/phone/zalo)", (() => {
    const v = tutorCardView({ ...T(), email: "x@test.local", phone: "0912345678", zalo: "0912345678" } as unknown as TutorListItem);
    return !/@test\.local|0912345678/.test(JSON.stringify(v));
  })());

  // ── Bộ lọc sàn ─────────────────────────────────────────────────────────────────────────────────────────────
  section("docSanLoc: chỉ 4 tham số, kẹp độ dài, mode lạ → \"\"");
  check("rỗng → SAN_LOC_RONG", JSON.stringify(docSanLoc(sp(""))) === JSON.stringify(SAN_LOC_RONG));
  check("SAN_LOC_RONG đúng hình", JSON.stringify(SAN_LOC_RONG) === JSON.stringify({ q: "", subject: "", city: "", mode: "" }));
  const f1 = docSanLoc(sp(`q=${encodeURIComponent("Toán Hà")}&subject=${encodeURIComponent("Toán 9")}&city=${encodeURIComponent("Hà Nội")}&mode=online`));
  check("đọc đủ 4 mục", f1.q === "Toán Hà" && f1.subject === "Toán 9" && f1.city === "Hà Nội" && f1.mode === "online", f1);
  check("mode=offline giữ", docSanLoc(sp("mode=offline")).mode === "offline");
  check("(phá) ?mode=<script> → \"\"", docSanLoc(sp(`mode=${encodeURIComponent("<script>alert(1)</script>")}`)).mode === "");
  check("(phá) mode=both / ONLINE / online%20 → \"\" (không phải lựa chọn lọc)", ["both", "ONLINE", "online ", "1"].every(m => docSanLoc(sp(`mode=${encodeURIComponent(m)}`)).mode === ""));
  check("kẹp: q ≤ 60, subject ≤ 50, city ≤ 60", (() => {
    const f = docSanLoc(sp(`q=${"a".repeat(200)}&subject=${"b".repeat(200)}&city=${"c".repeat(200)}`));
    return f.q.length === 60 && f.subject.length === 50 && f.city.length === 60;
  })());
  check("(phá) emoji ở mép cắt không để lại nửa cặp thay thế", (() => { const f = docSanLoc(sp(`q=${encodeURIComponent("a" + "😀".repeat(40))}`)); return f.q.length <= 60 && !/[\ud800-\udbff]$/.test(f.q); })());
  const old = docSanLoc(sp("grade=9&district=Cầu Giấy&priceMin=100000&priceMax=300000&active=1&sort=price_asc&page=3&pageSize=48&subject=Toán 9"));
  check("(phá) tham số cũ (grade, district, priceMin/Max, active, sort, page, pageSize) bị bỏ — chỉ còn 4 khoá", Object.keys(old).sort().join() === "city,mode,q,subject" && old.subject === "Toán 9" && old.q === "" && old.city === "" && old.mode === "", old);
  check("tham số lặp: lấy giá trị đầu (như URLSearchParams.get)", docSanLoc(sp("city=Huế&city=Hà Nội")).city === "Huế");
  check("nhận đối tượng chỉ có get() (ReadonlyURLSearchParams của Next)", docSanLoc({ get: (k: string) => (k === "city" ? "Huế" : null) }).city === "Huế");

  section("ghiSanLoc / apiQuery");
  check("rỗng → \"\" (không có ?)", ghiSanLoc(SAN_LOC_RONG) === "");
  const f2: SanLoc = { q: "  Toán  ", subject: "Toán 9", city: "Hà Nội", mode: "offline" };
  const w2 = ghiSanLoc(f2);
  check("bỏ giá trị rỗng, trim q, không có \"?\"", !w2.startsWith("?") && sp(w2).get("q") === "Toán" && sp(w2).get("subject") === "Toán 9" && sp(w2).get("city") === "Hà Nội" && sp(w2).get("mode") === "offline", w2);
  check("chỉ 4 khoá có thể xuất hiện", [...sp(w2).keys()].every(k => ["q", "subject", "city", "mode"].includes(k)));
  check("đi vòng: docSanLoc(ghiSanLoc(f)) giữ nguyên (sau trim)", JSON.stringify(docSanLoc(sp(w2))) === JSON.stringify({ ...f2, q: "Toán" }));
  check("ký tự đặc biệt (&, =, #, %, +) được mã hoá đúng và đọc lại đủ", (() => { const f: SanLoc = { q: "a&b=c#d%e+f", subject: "Toán & Lý", city: "", mode: "" }; return JSON.stringify(docSanLoc(sp(ghiSanLoc(f)))) === JSON.stringify(f); })());
  check("(phá) mode rác trong đối tượng → không ghi", ghiSanLoc({ ...SAN_LOC_RONG, mode: "<script>" as SanLoc["mode"] }) === "");
  check("chỉ q toàn khoảng trắng → \"\"", ghiSanLoc({ ...SAN_LOC_RONG, q: "   " }) === "");
  const a1 = sp(apiQuery(f2, 1));
  check("apiQuery trang 1: KHÔNG có page, có pageSize=24, có 4 lọc", !a1.has("page") && a1.get("pageSize") === "24" && a1.get("subject") === "Toán 9" && a1.get("mode") === "offline");
  check("apiQuery trang 3 → page=3", sp(apiQuery(f2, 3)).get("page") === "3");
  check("(phá) page rác (0, -1, 1.5, NaN) → không ghi page", [0, -1, 1.5, Number.NaN].every(p => !sp(apiQuery(f2, p)).has("page")));
  check("pageSize tuỳ chọn 12; rác → 24; quá 48 → 48", sp(apiQuery(f2, 1, 12)).get("pageSize") === "12" && sp(apiQuery(f2, 1, 0)).get("pageSize") === "24" && sp(apiQuery(f2, 1, 999)).get("pageSize") === "48");
  check("apiQuery không có grade/district/price/active/sort", ["grade", "district", "priceMin", "priceMax", "active", "sort"].every(k => !sp(apiQuery(f2, 2)).has(k)));
  check("apiQuery khớp parseTutorQuery của máy chủ (q, subject, city, mode, page)", (() => {
    const p = parseTutorQuery(sp(apiQuery(f2, 2)));
    return p.q === "Toán" && p.subject === "Toán 9" && p.city === "Hà Nội" && p.mode === "offline" && p.page === 2 && p.pageSize === 24 && !p.grade && !p.district && p.priceMin === null && !p.active;
  })());

  section("demSanLoc / moTaSanLoc");
  check("rỗng → 0, []", demSanLoc(SAN_LOC_RONG) === 0 && moTaSanLoc(SAN_LOC_RONG).length === 0);
  check("KHÔNG tính ô tìm: chỉ q → 0", demSanLoc({ ...SAN_LOC_RONG, q: "Toán" }) === 0);
  check("đủ 3 lọc + q → 3", demSanLoc(f2) === 3);
  check("lọc toàn khoảng trắng không tính", demSanLoc({ ...SAN_LOC_RONG, subject: "  ", city: " " }) === 0);
  check("(phá) mode rác không tính", demSanLoc({ ...SAN_LOC_RONG, mode: "both" as SanLoc["mode"] }) === 0);
  check('moTaSanLoc đủ: [từ khóa "Toán", môn Toán 9, Hà Nội, dạy trực tiếp]', JSON.stringify(moTaSanLoc(f2)) === JSON.stringify(['từ khóa "Toán"', "môn Toán 9", "Hà Nội", "dạy trực tiếp"]), moTaSanLoc(f2));
  check("moTaSanLoc online → \"dạy online\"", moTaSanLoc({ ...SAN_LOC_RONG, mode: "online" }).join() === "dạy online");

  // ── Thuần thật: không React / Prisma / node:* ──────────────────────────────────────────────────────────────
  section("Hai thư viện THUẦN (không React, không Prisma, không node:*)");
  for (const f of ["src/lib/tutorCardView.ts", "src/lib/tutorFloorFilter.ts"]) {
    const src = readFileSync(f, "utf8");
    const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(m => m[1]);
    check(`${f}: chỉ import @/lib/tutorArea | @/lib/tutorSearch`, imports.every(i => i === "@/lib/tutorArea" || i === "@/lib/tutorSearch"), imports);
    check(`${f}: không "use client"/react/prisma/node:`, !/["']use client["']|from\s+["']react|prisma|from\s+["']node:/.test(src));
  }

  // Kiểu: TutorCardView có đủ khoá mà stu-dev dựa vào (bắt đổi tên lúc biên dịch).
  const _shape: Record<keyof TutorCardView, true> = { id: true, name: true, initials: true, avatar: true, subjects: true, moreSubjects: true, gradeLine: true, areaLine: true, modeLabel: true, priceLine: true, bio: true };
  check("TutorCardView đúng 11 khoá (kiểm lúc biên dịch)", Object.keys(_shape).sort().join() === VIEW_KEYS);

  await done();
})();
