// BU-06 — Tìm gia sư kiểu sàn: phần THUẦN (src/lib/tutorSearch.ts + tutorSearchMedia.ts). Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost:1/x npx tsx tools/local-e2e/t-tutor-search-lib.ts
import {
  GRADE_GROUPS, MAX_PAGE, MAX_PAGE_SIZE, TUTOR_LIST_ITEM_KEYS, activeFilterCount, buildSuggestions, compareFor, computeFacets, gradesOfSubject, matchesFilters,
  paginate, parseSuggestQuery, parseTutorQuery, scoreMatch, searchTutors, sortSearchable, toListItem,
  type SearchableTutor, type TutorFilters, type TutorSortKey,
} from "@/lib/tutorSearch";
import { introVideoView, isValidCover, parseCoverInput, parseIntroVideoInput, coverForPublic } from "@/lib/tutorSearchMedia";
import { parseTutorProfileInput } from "@/lib/tutorProfile";
import { check, section, done } from "./h";

const Q = (s: string) => parseTutorQuery(new URLSearchParams(s));
const F = (o: Partial<TutorFilters> = {}): TutorFilters => ({ ...Q(""), ...o });
const T = (id: string, name: string, o: Partial<SearchableTutor> = {}): SearchableTutor => ({
  id, name, avatarBase64: null, bio: null, subjects: [], tutorVerified: true, classCount: 0, studentCount: 0, sessionsTaught: 0, recentlyActive: false,
  area: null, rating: { avg: null, total: 0 }, verifiedAtMs: null, ...o,
});
const A = (o: Partial<NonNullable<SearchableTutor["area"]>> = {}) => ({ city: null, district: null, mode: null, credential: null, price: null, ...o });
const ids = (xs: { id: string }[]) => xs.map(x => x.id).join(",");
const perms = <X,>(a: X[]): X[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));

(async () => {
  section("parseTutorQuery: rỗng / rác → mặc định, không ném lỗi");
  const d = Q("");
  check("rỗng ⇒ mặc định (page 1, pageSize 24, sort active, không lọc)", d.page === 1 && d.pageSize === 24 && d.sort === "active" && d.q === "" && d.terms.length === 0
    && !d.subject && !d.grade && !d.city && !d.district && !d.mode && d.priceMin === null && d.priceMax === null && !d.active, d);
  for (const bad of ["abc", "NaN", "-5", "Infinity", "1e9", "0", "", "1.5", "12abc", ";DROP"]) {
    const f = Q(`page=${bad}&pageSize=${bad}&priceMin=${bad}`);
    // "-5", "0", "1e9"… đều không hợp lệ cho page/pageSize/giá ⇒ mặc định (priceMin "0" hợp lệ ⇒ 0)
    check(`page/pageSize="${bad}" ⇒ mặc định`, f.page === 1 && f.pageSize === 24, f);
    const wantMin = bad === "0" || bad === "-5" ? 0 : null; // số nguyên hợp lệ thì KẸP vào [0, 10 000 000]
    check(`priceMin="${bad}" ⇒ ${wantMin === 0 ? "kẹp về 0" : "bỏ qua"}`, f.priceMin === wantMin, f.priceMin);
  }
  check("pageSize kẹp 1..48; page kẹp ≤200", Q("pageSize=9999").pageSize === MAX_PAGE_SIZE && Q("pageSize=1").pageSize === 1 && Q("page=99999").page === MAX_PAGE && Q("page=-3").page === 1);
  check("số khổng lồ (20 chữ số) không làm hỏng: bỏ qua / kẹp", Q("page=99999999999999999999").page === 1 && Q("priceMax=99999999999999999999").priceMax === null);
  check("q ≤ 60 ký tự và ≤ 5 từ", Q(`q=${"a".repeat(100)}`).q.length === 60 && Q("q=a b c d e f g").q === "a b c d e" && Q("q=a b c d e f g").terms.length === 5);
  check("q bỏ ký tự điều khiển / vô hình", Q(`q=${encodeURIComponent("to\u0000a‮n")}`).q === "to a n", Q(`q=${encodeURIComponent("to\u0000a‮n")}`).q);
  check("terms không dấu, chữ thường: 'Toán Đà' ⇒ ['toan','da']", JSON.stringify(Q("q=" + encodeURIComponent("Toán Đà")).terms) === '["toan","da"]');
  check("priceMin>priceMax ⇒ đổi chỗ; priceMax > 10 000 000 bị kẹp", (() => { const f = Q("priceMin=300000&priceMax=100000"); return f.priceMin === 100000 && f.priceMax === 300000; })() && Q("priceMax=99999999").priceMax === 10_000_000);
  check("sort lạ ⇒ active; sort mới hợp lệ giữ nguyên", Q("sort=;DROP").sort === "active" && (["relevant", "newest", "sessions", "price_asc", "price_desc", "rating", "students", "classes", "active"] as TutorSortKey[]).every(s => Q(`sort=${s}`).sort === s));
  check("grade '13' / '0' / 'xyz' ⇒ bỏ; '9' / 'thcs' giữ", Q("grade=13").grade === null && Q("grade=0").grade === null && Q("grade=xyz").grade === null && Q("grade=9").grade === "9" && Q("grade=THCS").grade === "thcs");
  check("mode lạ ⇒ bỏ; active chỉ '1'", Q("mode=both").mode === null && Q("mode=online").mode === "online" && Q("active=true").active === false && Q("active=1").active === true);
  check("subject ≤ 50 ký tự (cắt)", Q(`subject=${"x".repeat(80)}`).subject?.length === 50);

  section("gradesOfSubject: suy cấp từ chữ trong tên môn");
  const g = (s: string) => gradesOfSubject(s).join(",");
  check("'Toán 9' ⇒ 9, thcs", g("Toán 9") === "9,thcs", g("Toán 9"));
  check("'Toán 10' ⇒ 10, thpt", g("Toán 10") === "10,thpt");
  check("'Tiếng Anh lớp 5' ⇒ 5, tieu-hoc", g("Tiếng Anh lớp 5") === "5,tieu-hoc");
  check("'IELTS' ⇒ rỗng", g("IELTS") === "");
  check("'Toán 99' ⇒ rỗng (ngoài 1–12)", g("Toán 99") === "");
  check("'Toán 0' và 'Toán 13' ⇒ rỗng", g("Toán 0") === "" && g("Toán 13") === "");
  check("'IELTS 6.5' KHÔNG bị hiểu là lớp 6 (số thập phân)", g("IELTS 6.5") === "" && g("IELTS 6,5") === "");
  check("'TOEIC 700' / 'A1' / 'Python3' ⇒ rỗng (số dính chữ hoặc quá dài)", g("TOEIC 700") === "" && g("A1") === "" && g("Python3") === "");
  check("'Văn 9, 10' trong một chuỗi ⇒ 9, 10, thcs, thpt", g("Văn 9, 10") === "9,10,thcs,thpt", g("Văn 9, 10"));
  check("cụm cấp: 'Luyện thi Đại học', 'Tiểu học', 'THCS', 'THPT', 'Cấp 3'", g("Luyện thi Đại học") === "dai-hoc" && g("Tiểu học") === "tieu-hoc" && g("Văn THCS") === "thcs" && g("Toán THPT") === "thpt" && g("Lý cấp 3") === "thpt" && g("Toán cấp 2") === "thcs" && g("Cấp 1") === "tieu-hoc");
  check("'thcsx' / 'xdai hoc' không khớp cụm (ranh giới từ)", g("thcsx") === "" && g("xdai hocx") === "");
  check("đầu vào không phải chuỗi không làm hỏng", g(undefined as unknown as string) === "" && g(null as unknown as string) === "");
  check("GRADE_GROUPS có đúng 4 nhóm", GRADE_GROUPS.length === 4);

  section("matchesFilters");
  const toan = T("a", "Nguyễn Văn Toán", { subjects: ["Toán 9", "Vật lý 10"], area: A({ city: "Đà Nẵng", district: "Hải Châu", mode: "online", price: 200000 }) });
  const anh = T("b", "Lê Thị Anh", { subjects: ["Tiếng Anh lớp 5"], area: A({ city: "Hà Nội", district: "Cầu Giấy", mode: "both", price: null }) });
  const trong = T("c", "Trống Trơn"); // không khai gì: area=null, subjects=[]
  check("không lọc ⇒ khớp cả gia sư chưa khai gì (không bị loại)", [toan, anh, trong].every(t => matchesFilters(t, F())));
  check("q không dấu / hoa thường: 'toan' khớp 'Toán' (tên và môn)", matchesFilters(toan, F({ terms: ["toan"] })) && matchesFilters(toan, F({ terms: ["vat", "ly"] })) && !matchesFilters(anh, F({ terms: ["toan"] })));
  check("q là AND giữa các từ", matchesFilters(toan, F({ terms: ["nguyen", "toan"] })) && !matchesFilters(toan, F({ terms: ["nguyen", "anh"] })));
  check("q khớp quận ('cau giay')", matchesFilters(anh, F({ terms: ["cau", "giay"] })) && !matchesFilters(toan, F({ terms: ["cau", "giay"] })));
  check("q: từ không thể ghép qua ranh giới hai môn ('9vat' không khớp 'Toán 9'+'Vật lý')", !matchesFilters(toan, F({ terms: ["9vat"] })));
  check("subject khớp đúng chuỗi", matchesFilters(toan, F({ subject: "Toán 9" })) && !matchesFilters(toan, F({ subject: "Toán" })) && !matchesFilters(trong, F({ subject: "Toán 9" })));
  check("grade: 9 / thcs / 10 / thpt; gia sư không suy ra cấp ⇒ không khớp (không đoán)", matchesFilters(toan, F({ grade: "9" })) && matchesFilters(toan, F({ grade: "thcs" })) && matchesFilters(toan, F({ grade: "thpt" }))
    && !matchesFilters(toan, F({ grade: "tieu-hoc" })) && !matchesFilters(trong, F({ grade: "9" })) && matchesFilters(anh, F({ grade: "tieu-hoc" })));
  check("city: 'đà nẵng' khớp 'Da Nang'; 'tp.hcm' = 'Hồ Chí Minh'", matchesFilters(toan, F({ city: "da nang" })) && matchesFilters(toan, F({ city: "ĐÀ NẴNG" })) && !matchesFilters(toan, F({ city: "Hà Nội" }))
    && matchesFilters(T("h", "H", { area: A({ city: "TP. Hồ Chí Minh" }) }), F({ city: "tp.hcm" })));
  check("chưa khai khu vực ⇒ bị loại khi lọc city/district/mode (không rò users.city cũ)", !matchesFilters(trong, F({ city: "Hà Nội" })) && !matchesFilters(trong, F({ district: "Cầu Giấy" })) && !matchesFilters(trong, F({ mode: "online" })));
  check("area có nhưng thiếu city ⇒ bị loại khi lọc city", !matchesFilters(T("x", "X", { area: A({ mode: "online" }) }), F({ city: "Hà Nội" })));
  check("district không dấu, hoa thường", matchesFilters(anh, F({ district: "cau giay" })) && matchesFilters(anh, F({ district: "CẦU GIẤY" })) && !matchesFilters(toan, F({ district: "Cầu Giấy" })));
  check("mode=online gồm 'both'; offline gồm 'both'; online không khớp 'offline'", matchesFilters(anh, F({ mode: "online" })) && matchesFilters(anh, F({ mode: "offline" })) && matchesFilters(toan, F({ mode: "online" })) && !matchesFilters(toan, F({ mode: "offline" })));
  check("giá: trong khoảng khớp, ngoài khoảng loại, biên khớp", matchesFilters(toan, F({ priceMin: 200000, priceMax: 200000 })) && !matchesFilters(toan, F({ priceMin: 200001 })) && !matchesFilters(toan, F({ priceMax: 199999 })));
  check("gia sư KHÔNG bật giá: bị loại khi có lọc giá (chỉ min, chỉ max, hoặc cả hai), nhưng vẫn hiện khi không lọc giá",
    !matchesFilters(anh, F({ priceMin: 0 })) && !matchesFilters(anh, F({ priceMax: 10_000_000 })) && !matchesFilters(trong, F({ priceMin: 1 })) && matchesFilters(anh, F()));
  check("active=1 loại gia sư không hoạt động gần đây", !matchesFilters(toan, F({ active: true })) && matchesFilters({ ...toan, recentlyActive: true }, F({ active: true })));
  check("nhiều lọc là GIAO", matchesFilters(toan, F({ city: "Đà Nẵng", mode: "online", grade: "9", priceMax: 300000 })) && !matchesFilters(toan, F({ city: "Đà Nẵng", mode: "online", grade: "9", priceMax: 100000 })));
  check("skip bỏ đúng một bộ lọc", matchesFilters(toan, F({ city: "Hà Nội", mode: "online" }), "city") && !matchesFilters(toan, F({ city: "Hà Nội", mode: "offline" }), "city"));
  check("activeFilterCount không tính q/sort/trang; giá tính một lần", activeFilterCount(F({ q: "x", terms: ["x"], sort: "newest", page: 3, city: "Hà Nội", priceMin: 1, priceMax: 2, active: true })) === 3);
  check("matchesFilters không ném lỗi với gia sư subjects trống / area null / tên lạ", [T("e1", ""), T("e2", "ǅ", { subjects: [""] })].every(t => matchesFilters(t, F({ terms: ["x"] })) === false || true));

  section("scoreMatch");
  const hung = T("h1", "Hùng Toán", { subjects: ["Lý"], area: A({ district: "Toán Lâm" }) });
  check("tên bắt đầu bằng từ khoá = 3; từ trong tên = 2; môn = 2; quận = 1; không khớp = 0",
    scoreMatch(T("1", "Toán Học"), ["toan"]) === 3 && scoreMatch(T("2", "Học Toán"), ["toan"]) === 2 && scoreMatch(T("3", "An", { subjects: ["Toán 9"] }), ["toan"]) === 2
    && scoreMatch(T("4", "An", { area: A({ district: "Toán" }) }), ["toan"]) === 1 && scoreMatch(T("5", "An"), ["toan"]) === 0);
  check("mỗi từ lấy điểm cao nhất, cộng các từ; không có từ ⇒ 0", scoreMatch(hung, ["hung", "ly"]) === 3 + 2 && scoreMatch(hung, []) === 0);

  section("compareFor: thứ tự TOÀN PHẦN");
  // Cố ý trùng tên + trùng mọi số: chỉ id phân biệt (ca phá cho tie-break A9).
  const twins = [T("id-3", "Trần An", { sessionsTaught: 5, studentCount: 2, classCount: 1 }), T("id-1", "Trần An", { sessionsTaught: 5, studentCount: 2, classCount: 1 }), T("id-2", "Trần An", { sessionsTaught: 5, studentCount: 2, classCount: 1 })];
  const ALL: TutorSortKey[] = ["relevant", "newest", "sessions", "price_asc", "price_desc", "active", "rating", "students", "classes"];
  for (const s of ALL) {
    const outs = new Set(perms(twins).map(p => ids(sortSearchable(p, s, ["tran"]))));
    check(`sort=${s}: hoán vị đầu vào ⇒ cùng một thứ tự, hoà theo id`, outs.size === 1 && [...outs][0] === "id-1,id-2,id-3", [...outs]);
  }
  const mixed = [
    T("m1", "Bình", { sessionsTaught: 9, recentlyActive: true, verifiedAtMs: 300, area: A({ price: 300000 }), studentCount: 5, classCount: 2 }),
    T("m2", "An", { sessionsTaught: 9, recentlyActive: false, verifiedAtMs: null, area: null }),
    T("m3", "Chi", { sessionsTaught: 1, recentlyActive: true, verifiedAtMs: 100, area: A({ price: 100000 }), studentCount: 9, classCount: 1 }),
    T("m4", "Dũng", { sessionsTaught: 0, verifiedAtMs: 200, area: A({ price: 100000 }), studentCount: 9, classCount: 7, rating: { avg: 4.5, total: 2 } }),
    T("m5", "Em", { verifiedAtMs: 50, area: A({}) }),
  ];
  check("price_asc: không giá luôn CUỐI; hoà giá theo tên", ids(sortSearchable(mixed, "price_asc")) === "m3,m4,m1,m2,m5", ids(sortSearchable(mixed, "price_asc")));
  check("price_desc: không giá vẫn CUỐI (cả hai chiều)", ids(sortSearchable(mixed, "price_desc")) === "m1,m3,m4,m2,m5", ids(sortSearchable(mixed, "price_desc")));
  check("newest: tutorVerifiedAt giảm dần, null cuối", ids(sortSearchable(mixed, "newest")) === "m1,m4,m3,m5,m2", ids(sortSearchable(mixed, "newest")));
  check("sessions: buổi đã dạy giảm dần", ids(sortSearchable(mixed, "sessions")).startsWith("m2,m1,m3"), ids(sortSearchable(mixed, "sessions")));
  check("active (mặc định cũ): đang hoạt động trước → nhiều buổi → …", ids(sortSearchable(mixed, "active")) === "m1,m3,m2,m4,m5", ids(sortSearchable(mixed, "active")));
  check("rating (cũ, còn chạy): có điểm trước", sortSearchable(mixed, "rating")[0].id === "m4");
  check("students/classes (cũ) còn chạy", ids(sortSearchable(mixed, "students")).startsWith("m3,m4") && sortSearchable(mixed, "classes")[0].id === "m4");
  const rel = [T("r1", "Bình Anh", { sessionsTaught: 99, recentlyActive: true }), T("r2", "Anh Bình", { sessionsTaught: 0 }), T("r3", "Cường", { subjects: ["Tiếng Anh"] })];
  check("relevant có q: ưu tiên tên bắt đầu bằng từ khoá (dù ít buổi hơn)", ids(sortSearchable(rel, "relevant", ["anh"])) === "r2,r1,r3", ids(sortSearchable(rel, "relevant", ["anh"])));
  check("relevant không q ≡ active", ids(sortSearchable(rel, "relevant")) === ids(sortSearchable(rel, "active")));
  check("sortSearchable trả mảng MỚI, không đổi đầu vào", (() => { const copy = [...mixed]; sortSearchable(mixed, "price_asc"); return ids(copy) === ids(mixed); })());
  check("compareFor(sort lạ) không ném lỗi, rơi về active", typeof compareFor("zzz" as TutorSortKey) === "function");

  section("paginate");
  const big = Array.from({ length: 53 }, (_, i) => ({ id: `p${String(i).padStart(2, "0")}` }));
  const pages = [1, 2, 3].map(p => paginate(big, p, 24));
  check("trang 1..3 cộng lại đúng tập đầy: không trùng, không mất", pages.flatMap(p => p.items).map(x => x.id).join() === big.map(x => x.id).join());
  check("total đúng ở mọi trang; hasMore đúng (T,T,F)", pages.every(p => p.total === 53) && pages.map(p => p.hasMore).join() === "true,true,false");
  check("trang cuối 5 mục", pages[2].items.length === 5);
  const over = paginate(big, 4, 24);
  check("page vượt cuối ⇒ items=[], hasMore=false, total vẫn đúng", over.items.length === 0 && !over.hasMore && over.total === 53 && over.page === 4);
  check("đúng bội số: 48 mục / 24 ⇒ trang 2 hasMore=false", paginate(big.slice(0, 48), 2, 24).hasMore === false && paginate(big.slice(0, 48), 1, 24).hasMore === true);
  check("tập rỗng", (() => { const p = paginate([], 1, 24); return p.total === 0 && p.items.length === 0 && !p.hasMore; })());
  check("pageSize/page rác (NaN, 0, âm, Infinity) bị kẹp, không ném", (() => { const p = paginate(big, NaN, Infinity); return p.page === 1 && p.pageSize === 24; })() && paginate(big, 0, 0).pageSize === 1 && paginate(big, -3, -3).page === 1);

  section("computeFacets: mỗi facet bỏ chính bộ lọc của nó");
  const pool = [
    T("f1", "Một", { subjects: ["Toán 9", "Lý 9"], recentlyActive: true, area: A({ city: "Hà Nội", district: "Cầu Giấy", mode: "online", price: 100000 }) }),
    T("f2", "Hai", { subjects: ["Toán 9"], area: A({ city: "Hà Nội", district: "Đống Đa", mode: "both", price: 300000 }) }),
    T("f3", "Ba", { subjects: ["Anh 5"], recentlyActive: true, area: A({ city: "Đà Nẵng", district: "Hải Châu", mode: "offline" }) }),
    T("f4", "Bốn", { subjects: [], area: null }),
  ];
  const f0 = computeFacets(pool, F());
  check("không lọc: cities, subjects, activeCount, modes, price", f0.cities.join() === "Hà Nội,Đà Nẵng" || f0.cities.join() === "Đà Nẵng,Hà Nội", f0.cities);
  check("subjects đếm theo GIA SƯ, giảm dần rồi tên", JSON.stringify(f0.subjects) === JSON.stringify([{ value: "Toán 9", count: 2 }, { value: "Anh 5", count: 1 }, { value: "Lý 9", count: 1 }]), f0.subjects);
  check("grades: 9, 5, thcs, tieu-hoc… chỉ mục count>0, theo thứ tự 1..12 rồi nhóm", f0.grades.map(x => `${x.value}:${x.count}`).join() === "5:1,9:2,tieu-hoc:1,thcs:2", f0.grades);
  check("modes: both tính vào cả hai; null mode không tính", f0.modes.online === 2 && f0.modes.offline === 2, f0.modes);
  check("price.min/max chỉ từ giá công khai, count = số gia sư có giá", f0.price.min === 100000 && f0.price.max === 300000 && f0.price.count === 2, f0.price);
  check("activeCount", f0.activeCount === 2);
  check("districts rỗng khi chưa chọn city", f0.districts.length === 0);
  const fc = computeFacets(pool, F({ city: "Hà Nội" }));
  check("chọn city KHÔNG làm facets.cities co lại; districts của city đó, đã sắp", fc.cities.length === 2 && fc.districts.join() === "Cầu Giấy,Đống Đa", { c: fc.cities, d: fc.districts });
  check("các facet khác co lại theo city (subjects chỉ của Hà Nội)", fc.subjects.every(s => s.value !== "Anh 5") && fc.activeCount === 1);
  const fd = computeFacets(pool, F({ city: "Hà Nội", district: "Cầu Giấy" }));
  check("chọn district KHÔNG làm facets.districts co lại", fd.districts.length === 2);
  const fs = computeFacets(pool, F({ subject: "Anh 5" }));
  check("chọn subject KHÔNG làm facets.subjects co lại", fs.subjects.length === 3 && fs.cities.join() === "Đà Nẵng");
  const fm = computeFacets(pool, F({ mode: "offline" }));
  check("chọn mode KHÔNG đổi facets.modes", fm.modes.online === 2 && fm.modes.offline === 2);
  const fp = computeFacets(pool, F({ priceMin: 250000 }));
  check("chọn giá KHÔNG co facets.price; facet khác co lại", fp.price.count === 2 && fp.subjects.length === 1);
  const fg = computeFacets(pool, F({ grade: "tieu-hoc" }));
  check("chọn grade KHÔNG co facets.grades", fg.grades.length === f0.grades.length);
  const fa = computeFacets(pool, F({ active: true }));
  check("active=1 KHÔNG đổi activeCount", fa.activeCount === 2);
  const manySubj = Array.from({ length: 60 }, (_, i) => T(`s${i}`, `T${i}`, { subjects: [`Môn ${String(i).padStart(2, "0")}`] }));
  check("subjects cắt 40", computeFacets(manySubj, F()).subjects.length === 40);
  check("computeFacets trên tập rỗng không ném", (() => { const x = computeFacets([], F({ city: "A" })); return x.cities.length === 0 && x.price.min === null && x.price.count === 0; })());

  section("buildSuggestions / parseSuggestQuery");
  check("q < 2 ký tự (sau làm sạch) ⇒ ''", parseSuggestQuery("a") === "" && parseSuggestQuery("  \u0000 a ") === "" && parseSuggestQuery(null) === "" && parseSuggestQuery("ab") === "ab");
  check("q cắt 60", parseSuggestQuery("a".repeat(100)).length === 60);
  const sgPool: SearchableTutor[] = [
    ...Array.from({ length: 7 }, (_, i) => T(`sg${i}`, `Giáo viên ${i}`, { subjects: [`Toán lớp ${i + 1}`] })),
    T("ts1", "Toàn Văn A"), T("ts2", "Toàn Văn B"), T("ts3", "Toàn Văn C"), T("ts4", "Toàn Văn D"),
  ];
  const sg = buildSuggestions(sgPool, "toan");
  check("tối đa 5 môn + 3 tên = 8, môn trước, tên sau", sg.length === 8 && sg.slice(0, 5).every(s => s.kind === "subject") && sg.slice(5).every(s => s.kind === "tutor"), sg);
  check("gợi ý không dấu/hoa thường; không có ảnh hay trường lạ", Object.keys(sg[0]).sort().join() === "count,kind,label,value" && Object.keys(sg[5]).sort().join() === "id,kind,label");
  check("không khớp ⇒ []; q ngắn ⇒ []", buildSuggestions(sgPool, "zzzz").length === 0 && buildSuggestions(sgPool, "t").length === 0);

  section("searchTutors (tích hợp lib) + không rò khoá");
  const many = Array.from({ length: 50 }, (_, i) => T(`z${String(i).padStart(2, "0")}`, i % 2 ? "Trùng Tên" : `Gia sư ${i}`, { subjects: ["Toán 9"], sessionsTaught: i % 3, area: i % 5 ? A({ city: "Hà Nội", price: 100000 + (i % 4) * 50000 }) : null }));
  for (const s of ["relevant", "newest", "sessions", "price_asc", "price_desc", "active"] as TutorSortKey[]) {
    const seen: string[] = [];
    let p = 1, total = -1, more = true;
    while (more && p < 10) { const r = searchTutors(many, F({ sort: s, page: p, pageSize: 7 })); seen.push(...r.items.map(i => i.id)); total = r.total; more = r.hasMore; p++; }
    check(`sort=${s}: đi hết trang ⇒ không trùng, không mất, total = số id`, new Set(seen).size === seen.length && seen.length === 50 && total === 50 && !more, { n: seen.length, total });
  }
  const one = searchTutors(many, F({ pageSize: 3 }));
  check("khoá của items[i] ⊆ tập khoá cho phép, không có verifiedAtMs", one.items.every(it => Object.keys(it).every(k => (TUTOR_LIST_ITEM_KEYS as readonly string[]).includes(k))) && !JSON.stringify(one).includes("verifiedAtMs"));
  check("toListItem giữ đủ khoá", Object.keys(toListItem(many[0])).sort().join() === [...TUTOR_LIST_ITEM_KEYS].sort().join());
  check("JSON kết quả không chứa email/phone/dateOfBirth/preferences/password/coverUrl", !/email|phone|dateOfBirth|preferences|password|coverUrl|introVideo/i.test(JSON.stringify(one)));
  check("gia sư toàn NULL (area, bio, verifiedAtMs, subjects=[]) hiện khi không lọc và sắp newest/price không ném", (() => {
    const r = [T("n1", "Null Một"), T("n2", "Null Hai")];
    return ["newest", "price_asc", "price_desc", "relevant"].every(s => searchTutors(r, F({ sort: s as TutorSortKey })).items.length === 2);
  })());

  section("tutorSearchMedia: link video");
  const vid = (s: unknown) => { const r = parseIntroVideoInput(s); return r.ok ? r.value : `ERR:${r.error}`; };
  const W = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  check("nhận watch / youtu.be / shorts / embed / không có https", [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s", "youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ].every(s => vid(s) === W), ["watch", "youtu.be"].map(() => vid("https://youtu.be/dQw4w9WgXcQ")));
  const reject = [
    "https://youtube.com.xau.vn/watch?v=dQw4w9WgXcQ", "https://xauyoutube.com/watch?v=dQw4w9WgXcQ", "https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)",
    "https://vimeo.com/123456789", "https://youtu.be/dQw4w9WgXc", "https://youtu.be/dQw4w9WgXcQQ", "https://www.youtube.com/watch?v=", "https://evil.test/?u=https://youtu.be/dQw4w9WgXcQ", "not a url", "data:text/html,<script>",
  ];
  for (const bad of reject) check(`từ chối: ${bad.slice(0, 60)}`, vid(bad).startsWith("ERR:"), vid(bad));
  check("đầu vào chứa \"><script> không lọt ra: luôn trả watchUrl dựng từ mã", vid('https://youtu.be/dQw4w9WgXcQ"><script>alert(1)</script>').startsWith("ERR:") && !String(vid("https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=\"><script>")).includes("script") && vid("https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=\"><script>") === W);
  check("không gửi ⇒ undefined (giữ nguyên); null / '' / '   ' ⇒ null (xoá)", vid(undefined) === undefined && vid(null) === null && vid("") === null && vid("   ") === null);
  check("sai kiểu (số, mảng, object) ⇒ lỗi", vid(5).startsWith("ERR:") && vid(["x"]).startsWith("ERR:") && vid({}).startsWith("ERR:"));
  check("thông điệp lỗi tiếng Việt đúng chữ", vid("vimeo.com/1") === "ERR:Chỉ nhận link video YouTube (youtube.com hoặc youtu.be)");

  section("tutorSearchMedia: introVideoView");
  const v = introVideoView(W);
  check("hợp lệ ⇒ id, watchUrl, embedUrl nocookie, thumbUrl", v?.id === "dQw4w9WgXcQ" && v.watchUrl === W && v.embedUrl === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" && v.thumbUrl.startsWith("https://i.ytimg.com/vi/dQw4w9WgXcQ/"), v);
  check("view chỉ có 4 khoá (không trả chuỗi thô)", Object.keys(v ?? {}).sort().join() === "embedUrl,id,thumbUrl,watchUrl");
  check("chuỗi hỏng / tên miền giả / null / số trong DB ⇒ null", [null, undefined, "", "xyz", 5, "https://youtube.com.xau.vn/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://vimeo.com/1"].every(x => introVideoView(x) === null));
  check("DB lưu nhầm link youtu.be vẫn dẫn xuất lại an toàn (không trả nguyên văn)", introVideoView("https://youtu.be/dQw4w9WgXcQ?si=abc")?.watchUrl === W && !JSON.stringify(introVideoView("https://youtu.be/dQw4w9WgXcQ?si=abc")).includes("si=abc"));

  section("tutorSearchMedia: ảnh bìa");
  const B64 = "A".repeat(400);
  const okCover = `data:image/jpeg;base64,${B64}`;
  check("jpeg / png / webp hợp lệ", isValidCover(okCover) && isValidCover(`data:image/png;base64,${B64}`) && isValidCover(`data:image/webp;base64,${B64}`) && isValidCover(`data:image/jpeg;base64,${B64}==`.replace(B64 + "==", "QUJD" + "QQ==")));
  const badCovers: [string, unknown][] = [
    ["svg", `data:image/svg+xml;base64,${B64}`], ["gif", `data:image/gif;base64,${B64}`], ["html", `data:text/html;base64,${B64}`], ["javascript:", "javascript:alert(1)"],
    ["https", "https://evil.test/a.jpg"], ["base64 hỏng (ký tự lạ)", "data:image/jpeg;base64,@@@@"], ["base64 sai độ dài", "data:image/jpeg;base64,QUJDR"], ["rỗng sau dấu phẩy", "data:image/jpeg;base64,"],
    ["dấu = giữa chuỗi", "data:image/jpeg;base64,QU=JDRA="], ["không phải base64", "data:image/jpeg,AAAA"], ["xuống dòng chen vào", `data:image/jpeg;base64,${B64}\n<script>`],
    ["dài 1 MB", `data:image/jpeg;base64,${"A".repeat(1_000_000)}`], ["null", null], ["số", 7], ["mảng", [okCover]],
  ];
  for (const [n, x] of badCovers) check(`isValidCover từ chối: ${n}`, isValidCover(x) === false);
  const edge = `data:image/jpeg;base64,${"A".repeat(249_976)}`; // 249 999 ký tự (base64 phải chia hết 4)
  check("249 999 ký tự thì nhận, thêm 4 ký tự (vượt 250 000) thì từ chối", edge.length === 249_999 && isValidCover(edge) && !isValidCover(edge + "AAAA"));
  const pc = (x: unknown) => { const r = parseCoverInput(x); return r.ok ? r.value : `ERR:${r.error}`; };
  check("parseCoverInput: không gửi giữ nguyên, null/'' xoá, hợp lệ nhận, sai ⇒ lỗi tiếng Việt", pc(undefined) === undefined && pc(null) === null && pc("  ") === null && pc(okCover) === okCover
    && pc(`data:image/svg+xml;base64,${B64}`) === "ERR:Ảnh bìa phải là JPG/PNG/WebP và nhỏ hơn 250 KB");
  check("coverForPublic: hỏng ⇒ null, hợp lệ giữ nguyên", coverForPublic("javascript:alert(1)") === null && coverForPublic(`data:image/svg+xml;base64,${B64}`) === null && coverForPublic("A".repeat(1_000_000)) === null && coverForPublic(okCover) === okCover && coverForPublic(null) === null);

  // BU-06b — đường GHI: parseTutorProfileInput nhận coverUrl / introVideoUrl (dùng chung đăng ký gia sư và sửa hồ sơ).
  section("BU-06b: parseTutorProfileInput nhận bìa + video");
  const pp = (b: Record<string, unknown>) => parseTutorProfileInput(b);
  check("không gửi khoá nào ⇒ không có coverUrl/introVideoUrl (PUT giữ nguyên, không ghi đè)", (() => { const q = pp({ bio: "x" }); return !("coverUrl" in q) && !("introVideoUrl" in q) && !q.error; })());
  check("bìa hợp lệ ⇒ giữ nguyên; null / rỗng ⇒ null (xoá)", pp({ coverUrl: okCover }).coverUrl === okCover && pp({ coverUrl: null }).coverUrl === null && pp({ coverUrl: "  " }).coverUrl === null);
  check("video: link chữ gõ (có ?si=, youtu.be) ⇒ LƯU dạng chuẩn watchUrl, không lưu chữ gõ", pp({ introVideoUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc&t=9" }).introVideoUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  check("video null / rỗng ⇒ null (xoá)", pp({ introVideoUrl: null }).introVideoUrl === null && pp({ introVideoUrl: "" }).introVideoUrl === null);
  for (const bad of [`data:image/svg+xml;base64,${B64}`, "https://evil.test/a.jpg", "javascript:alert(1)", 123, [okCover], `data:image/jpeg;base64,${"A".repeat(250_000)}`]) {
    check(`bìa xấu bị từ chối với thông báo tiếng Việt (${String(bad).slice(0, 24)})`, /Ảnh bìa/.test(pp({ coverUrl: bad }).error ?? ""));
  }
  for (const bad of ["https://youtube.com.xau.vn/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://vimeo.com/1", "https://www.youtube.com@evil.test/watch?v=dQw4w9WgXcQ", 5]) {
    check(`video xấu bị từ chối với thông báo tiếng Việt (${String(bad).slice(0, 24)})`, /YouTube/.test(pp({ introVideoUrl: bad }).error ?? ""));
  }
  check("lỗi bìa không làm mất lỗi: có error thì KHÔNG trả các trường đã chuẩn hoá khác", (() => { const q = pp({ bio: "ok", coverUrl: "javascript:x" }); return !!q.error && q.bio === undefined; })());

  await done();
})();
