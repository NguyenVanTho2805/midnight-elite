// Cây nội dung khoá học Phần > Chương > Bài (BU-HS-TRANG-CHU mục 4.2 + 8). THUẦN: src/lib/lessonOutline.ts. Không cần máy chủ.
//
// Ca phá (đổi gì trong mã thì ca nào phải đỏ):
//  - filterOutline: bỏ `fold` ở so khớp → ca "chuong 2" / "duong thang" / "dai so" đỏ.
//  - filterOutline: trả cây gốc đã bị splice/gán lại (sửa tại chỗ) → ca "không đổi cây gốc" (JSON trước-sau) đỏ.
//  - filterOutline: bỏ `queryTokens` (lọc cả với 1 ký tự) → ca "từ khoá 1 ký tự → không lọc" đỏ.
//  - filterOutline: không giữ cả bài khi chương khớp tên → ca "chương khớp tên giữ cả bài" đỏ.
//  - initialOpenChapters: không rơi về chương đầu khi id lạ → ca "id không tồn tại → chương đầu" đỏ.
import { outlineShape, chapterProgress, allChapterIds, initialOpenChapters, filterOutline, type OSection, type OChapter } from "@/lib/lessonOutline";
import { check, section, done } from "./h";

const L = (id: string, title: string, isLocked?: boolean) => ({ id, title, ...(isLocked ? { isLocked } : {}) });
const C = (id: string, title: string, n: number, prefix = id): OChapter => ({ id, title, lessons: Array.from({ length: n }, (_, i) => L(`${prefix}-b${i + 1}`, `Bài ${i + 1} của ${title}`)) });

// Cây mẫu có dấu: 2 phần × (2 + 1) chương.
const tree = (): OSection[] => [
  { id: "p1", title: "Phần Đại số", chapters: [
    { id: "c1", title: "Chương 1: Hàm số", lessons: [L("l1", "Khái niệm hàm số"), L("l2", "Đồ thị hàm số"), L("l3", "Ôn tập hàm số")] },
    { id: "c2", title: "Chương 2: Phương trình", lessons: [L("l4", "Phương trình bậc nhất"), L("l5", "Đường thẳng và hệ phương trình", true)] },
  ] },
  { id: "p2", title: "Phần Hình học", chapters: [
    { id: "c3", title: "Chương 3: Đường thẳng", lessons: [L("l6", "Góc giữa hai đường thẳng"), L("l7", "Khoảng cách")] },
  ] },
];

section("outlineShape — cây hiện mấy cấp");
{
  const one: OSection[] = [{ id: "s", title: "S", chapters: [C("a", "A", 3)] }];
  const s1 = outlineShape(one);
  check("1 phần / 1 chương → chỉ bài (không hàng phần, không hàng chương)", s1.showSection === false && s1.showChapterIn.s === false, s1);
  const three: OSection[] = [{ id: "s", title: "S", chapters: [C("a", "A", 1), C("b", "B", 1), C("c", "C", 1)] }];
  const s2 = outlineShape(three);
  check("1 phần / 3 chương → có hàng chương, không hàng phần", s2.showSection === false && s2.showChapterIn.s === true, s2);
  const two: OSection[] = [{ id: "s1", title: "S1", chapters: [C("a", "A", 1)] }, { id: "s2", title: "S2", chapters: [C("b", "B", 1)] }];
  check("2 phần → có hàng phần", outlineShape(two).showSection === true);
  const mix = outlineShape([{ id: "m1", title: "M1", chapters: [C("a", "A", 1)] }, { id: "m3", title: "M3", chapters: [C("b", "B", 1), C("c", "C", 1), C("d", "D", 1)] }]);
  check("phần 1 chương + phần 3 chương → showChapterIn đúng từng phần", mix.showSection === true && mix.showChapterIn.m1 === false && mix.showChapterIn.m3 === true, mix);
  const t = outlineShape(tree());
  check("cây mẫu: có phần; p1 (2 chương) có hàng chương, p2 (1 chương) không", t.showSection === true && t.showChapterIn.p1 === true && t.showChapterIn.p2 === false);
  const empty = outlineShape([]);
  check("cây rỗng → không phần, không chương", empty.showSection === false && Object.keys(empty.showChapterIn).length === 0);
  check("phần không có chương → showChapterIn false, không ném lỗi", outlineShape([{ id: "x", title: "X", chapters: [] }]).showChapterIn.x === false);
}

section("chapterProgress");
{
  const c8 = C("c", "Chương", 8);
  const ids = c8.lessons.map(l => l.id);
  const p0 = chapterProgress(c8, new Set());
  check("0/8", p0.done === 0 && p0.total === 8 && p0.complete === false, p0);
  const p3 = chapterProgress(c8, new Set(ids.slice(0, 3)));
  check("3/8", p3.done === 3 && p3.total === 8 && p3.complete === false, p3);
  const p8 = chapterProgress(c8, new Set(ids));
  check("8/8 → complete", p8.done === 8 && p8.total === 8 && p8.complete === true, p8);
  const pe = chapterProgress({ id: "e", title: "Rỗng", lessons: [] }, new Set(["x"]));
  check("chương rỗng 0/0 → complete:false", pe.done === 0 && pe.total === 0 && pe.complete === false, pe);
  const px = chapterProgress(c8, new Set([...ids.slice(0, 2), "khong-thuoc", "l99"]));
  check("id đã học không thuộc chương không được tính", px.done === 2 && px.total === 8, px);
  check("tập đã học chứa id thừa nhưng chương xong đủ → vẫn đúng 8/8", chapterProgress(c8, new Set([...ids, "thua"])).done === 8);
  check("done là null/undefined → 0 bài, không ném lỗi", chapterProgress(c8, null).done === 0 && chapterProgress(c8, undefined).total === 8);
}

section("allChapterIds");
check("theo thứ tự trong cây", allChapterIds(tree()).join() === "c1,c2,c3");
check("cây rỗng → []", allChapterIds([]).length === 0);

section("initialOpenChapters");
{
  const t = tree();
  check("có currentId → đúng chương đó", [...initialOpenChapters(t, { currentId: "l4" })].join() === "c2");
  check("currentId thắng nextId", [...initialOpenChapters(t, { currentId: "l6", nextId: "l1" })].join() === "c3");
  check("không có currentId → dùng nextId", [...initialOpenChapters(t, { nextId: "l7" })].join() === "c3");
  check("currentId=null + nextId → nextId", [...initialOpenChapters(t, { currentId: null, nextId: "l2" })].join() === "c1");
  check("cả hai không tồn tại → chương đầu", [...initialOpenChapters(t, { currentId: "zzz", nextId: "yyy" })].join() === "c1");
  check("không truyền gì → chương đầu", [...initialOpenChapters(t, {})].join() === "c1" && [...initialOpenChapters(t)].join() === "c1");
  check("currentId lạ nhưng nextId có thật → chương của nextId", [...initialOpenChapters(t, { currentId: "zzz", nextId: "l5" })].join() === "c2");
  check("luôn ≥1 chương khi cây có chương", initialOpenChapters(t, { currentId: "", nextId: "" }).size === 1);
  check("cây rỗng → rỗng", initialOpenChapters([], { currentId: "l1" }).size === 0);
  check("cây có phần nhưng không có chương → rỗng", initialOpenChapters([{ id: "s", title: "S", chapters: [] }], {}).size === 0);
  const dup: OSection[] = [{ id: "s", title: "S", chapters: [{ id: "a", title: "A", lessons: [L("x", "X")] }, { id: "b", title: "B", lessons: [L("x", "X trùng")] }] }];
  let threw = false, r = new Set<string>();
  try { r = initialOpenChapters(dup, { currentId: "x" }); } catch { threw = true; }
  check("id bài trùng ở hai chương → không ném lỗi, lấy chương đầu", !threw && r.size === 1 && r.has("a"));
}

section("filterOutline — khớp tiếng Việt");
{
  const t = tree();
  const f = (q: string) => filterOutline(t, q) as Extract<ReturnType<typeof filterOutline>, { openChapterIds: Set<string> }>;
  const r1 = f("chuong 2");
  check("'chuong 2' khớp tên chương 'Chương 2: Phương trình' → giữ cả 2 bài của nó", "openChapterIds" in r1 && r1.sections.length === 1 && r1.sections[0].chapters[0].id === "c2" && r1.sections[0].chapters[0].lessons.length === 2, r1.sections.map(s => s.chapters.map(c => c.id)));
  const r2 = f("duong thang");
  const ids2 = r2.sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id)));
  check("'duong thang' (bỏ dấu, đ=d) khớp 'Đường thẳng' → chương 3 giữ cả bài, và bài l5 ở chương 2", ids2.join() === "l5,l6,l7", ids2);
  // Lọc chỉ nhìn tên CHƯƠNG và tên BÀI (không nhìn tên phần): "Phần Đại số" không làm 'dai so' khớp gì ở cây mẫu, nhưng chương/bài tên "Đại số" thì khớp.
  const r3 = f("dai so");
  check("'dai so' chỉ có ở tên PHẦN → không bài/chương nào khớp, trả rỗng đúng kiểu", r3.sections.length === 0 && r3.openChapterIds.size === 0 && r3.matchedLessons === 0);
  const ds: OSection[] = [{ id: "s", title: "S", chapters: [{ id: "k", title: "Đại số tuyến tính", lessons: [L("k1", "Ma trận")] }, { id: "m", title: "Khác", lessons: [L("m1", "Bài khác")] }] }];
  const rd = filterOutline(ds, "dai so") as { sections: OSection[]; matchedLessons: number };
  check("'dai so' khớp chương 'Đại số tuyến tính' → giữ bài 'Ma trận' (tên bài không chứa từ khoá)", rd.matchedLessons === 1 && rd.sections[0].chapters[0].lessons[0].id === "k1" && rd.sections[0].chapters.length === 1);
  check("hoa/thường: 'HAM SO' = 'ham so'", JSON.stringify(f("HAM SO").sections) === JSON.stringify(f("ham so").sections) && f("HAM SO").matchedLessons === 3);
  check("dấu viết rời / có dấu cũng khớp: 'Hàm số' = 'ham so'", JSON.stringify(f("Hàm số").sections) === JSON.stringify(f("ham so").sections));
  check("'đồ thị' khớp bài 'Đồ thị hàm số'", f("đồ thị").matchedLessons === 1 && f("do thi").sections[0].chapters[0].lessons[0].id === "l2");
  check("'Đ' hoa: 'ĐƯỜNG' = 'duong'", f("ĐƯỜNG").matchedLessons === f("duong").matchedLessons && f("duong").matchedLessons > 0);
  check("nhiều từ = VÀ: 'khoang cach' chỉ ra l7", f("khoang cach").sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id))).join() === "l7");
  check("nhiều từ = VÀ: 'ham so duong thang' (không bài/chương nào có đủ bốn từ) → 0 bài", f("ham so duong thang").matchedLessons === 0);
  check("từ ở tên chương + từ ở tên bài cùng khớp: 'chuong 1 do thi' → chỉ l2", f("chuong 1 do thi").sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id))).join() === "l2");
  check("chương khớp tên → giữ CẢ bài (kể cả bài tên không chứa từ khoá): 'phuong trinh' → l4, l5", f("phuong trinh").sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id))).join() === "l4,l5");
  check("chương không còn bài thì bỏ; phần không còn chương thì bỏ: 'khoang cach' chỉ còn p2 > c3", ((): boolean => { const r = f("khoang cach"); return r.sections.length === 1 && r.sections[0].id === "p2" && r.sections[0].chapters.length === 1 && r.sections[0].chapters[0].id === "c3" && r.sections[0].chapters[0].lessons.length === 1; })());
  check("openChapterIds = đúng các chương còn lại", [...f("duong thang").openChapterIds].sort().join() === "c2,c3");
  check("matchedLessons / matchedChapters đếm đúng", f("duong thang").matchedLessons === 3 && f("duong thang").matchedChapters === 2);
  check("giữ thuộc tính isLocked của bài", f("duong thang").sections[0].chapters[0].lessons[0].isLocked === true);
}

section("filterOutline — không lọc");
{
  const t = tree();
  for (const q of ["", " ", "   ", "a", "Đ", "?", "!!", "$", "-", "\t\n"]) {
    const r = filterOutline(t, q);
    check(`${JSON.stringify(q)} → không lọc (matches:null, trả đúng cây gốc)`, "matches" in r && r.matches === null && r.sections === t);
  }
  check("2 ký tự → lọc", "openChapterIds" in filterOutline(t, "ha"));
  check("một chữ số 1 ký tự vẫn <2 ký tự → không lọc", "matches" in filterOutline(t, "2"));
}

section("filterOutline — không đổi cây gốc");
{
  const t = tree();
  const before = JSON.stringify(t);
  for (const q of ["duong thang", "chuong 2", "khoang cach", "zzz", "", "a", "ham so"]) filterOutline(t, q);
  check("JSON trước = sau với nhiều lần lọc", JSON.stringify(t) === before);
  const r = filterOutline(t, "duong thang") as { sections: OSection[] };
  r.sections[0].chapters[0].lessons.pop();
  r.sections[0].chapters.pop();
  check("sửa kết quả lọc không làm hỏng cây gốc (mảng bài đã sao)", JSON.stringify(t) === before);
  const frozen = Object.freeze(tree().map(s => Object.freeze({ ...s, chapters: Object.freeze(s.chapters.map(c => Object.freeze({ ...c, lessons: Object.freeze([...c.lessons]) as unknown as OChapter["lessons"] }))) as unknown as OChapter[] })));
  let threw = false;
  try { filterOutline(frozen as OSection[], "duong"); } catch { threw = true; }
  check("cây đóng băng (Object.freeze) lọc không ném lỗi — chứng tỏ không ghi vào cây gốc", !threw);
}

section("Ca phá — đầu vào rác");
{
  let threw = false;
  const run = <T,>(fn: () => T): T | undefined => { try { return fn(); } catch { threw = true; return undefined; } };
  run(() => outlineShape(undefined as unknown as OSection[]));
  run(() => outlineShape(null as unknown as OSection[]));
  run(() => allChapterIds(undefined as unknown as OSection[]));
  run(() => initialOpenChapters(undefined as unknown as OSection[], {}));
  run(() => filterOutline(undefined as unknown as OSection[], "abc"));
  run(() => filterOutline([], "abc"));
  run(() => filterOutline(tree(), undefined as unknown as string));
  run(() => filterOutline(tree(), null as unknown as string));
  run(() => filterOutline(tree(), 123 as unknown as string));
  run(() => chapterProgress(undefined as unknown as OChapter, new Set()));
  run(() => chapterProgress({ id: "x", title: "x" } as unknown as OChapter, new Set(["a"])));
  check("undefined / null / thiếu mảng con → không hàm nào ném lỗi", !threw);

  check("cây undefined → outlineShape rỗng", outlineShape(undefined as unknown as OSection[]).showSection === false);
  check("cây rỗng [] → lọc 'abc' ra rỗng, không ném lỗi", ((): boolean => { const r = filterOutline([], "abc") as { sections: OSection[]; openChapterIds: Set<string> }; return r.sections.length === 0 && r.openChapterIds.size === 0; })());
  check("chuỗi rỗng + cây rỗng → matches:null", "matches" in filterOutline([], ""));
  check("từ khoá không phải chuỗi (null/undefined/số) → không lọc", [undefined, null, 5, {}, []].every(q => "matches" in filterOutline(tree(), q as unknown as string)));

  const noLessons: OSection[] = [{ id: "s", title: "S", chapters: [{ id: "c", title: "Chương không bài", lessons: [] }, { id: "d", title: "D", lessons: [L("x", "Bài x")] }] }];
  check("chương không có bài: allChapterIds vẫn liệt kê, tiến độ 0/0 không 'xong'", allChapterIds(noLessons).join() === "c,d" && chapterProgress(noLessons[0].chapters[0], new Set()).complete === false);
  const r = filterOutline(noLessons, "khong bai") as { sections: OSection[]; matchedLessons: number };
  check("chương không bài khớp tên nhưng không có gì để hiện → bị bỏ", r.sections.length === 0 && r.matchedLessons === 0);
  check("chương không bài không làm hỏng chương khác khi lọc", (filterOutline(noLessons, "bai x") as { matchedLessons: number }).matchedLessons === 1);
  check("phần thiếu `chapters` (undefined) → bỏ qua, không ném lỗi", ((): boolean => { const bad = [{ id: "s", title: "S" }, ...tree()] as unknown as OSection[]; const r = filterOutline(bad, "khoang cach") as { matchedLessons: number }; return r.matchedLessons === 1 && allChapterIds(bad).length === 3; })());
}

section("Ca phá — từ khoá lạ, rất dài, ký tự đặc biệt");
{
  const t = tree();
  const t0 = Date.now();
  const huge = "a".repeat(5000) + " duong ".repeat(500);
  const r = filterOutline(t, huge) as { sections: OSection[] };
  const ms = Date.now() - t0;
  check(`từ khoá dài 5000+ ký tự không treo (${ms}ms < 50ms)`, ms < 50 && Array.isArray(r.sections), ms);
  for (const q of ["$ ^ ( ) [", "(((", ".*", "[a-z]+", "\\", "<script>alert(1)</script>", "a|b", "%", "'; DROP TABLE x; --", "😀😀", "\u0000\u0000"]) {
    let threw = false, res: ReturnType<typeof filterOutline> | null = null;
    try { res = filterOutline(t, q); } catch { threw = true; }
    check(`${JSON.stringify(q).slice(0, 40)} → coi như chữ thường, không ném lỗi, không regex`, !threw && res !== null);
  }
  check("'.*' không khớp mọi thứ (không phải regex)", ((): boolean => { const r = filterOutline(t, ".*"); return "matches" in r; })());
  check("'<script>' bị chuẩn hoá thành chữ 'script' (không khớp bài nào) → rỗng", (filterOutline(t, "<script>") as { matchedLessons: number }).matchedLessons === 0);
  check("tên bài chứa ký tự đặc biệt vẫn tìm được bằng chữ thường", ((): boolean => { const s: OSection[] = [{ id: "s", title: "S", chapters: [{ id: "c", title: "C", lessons: [L("a", "Bài (nâng cao) [2]: x^2 + y^2")] }] }]; return (filterOutline(s, "nang cao") as { matchedLessons: number }).matchedLessons === 1; })());
  check("tên bài 200 ký tự không làm hỏng việc lọc", ((): boolean => { const s: OSection[] = [{ id: "s", title: "S", chapters: [{ id: "c", title: "C", lessons: [L("a", "Rất dài ".repeat(25) + "đáy")] }] }]; return (filterOutline(s, "day") as { matchedLessons: number }).matchedLessons === 1; })());
}

void done();
