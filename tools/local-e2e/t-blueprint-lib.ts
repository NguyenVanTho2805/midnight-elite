// BU-03 P2 — ma trận đề và bốc câu (src/lib/deThiBlueprint.ts). THUẦN, không DB. Ca phá cố ý ở từng mục.
import { check, section, done } from "./h";
import {
  BLUEPRINT_MAX_ROWS, drawFromBlueprint, expandSubtree, makeRng, normalizeBlueprintName, rowsFromJson, shortagesForSelection, shuffleSeeded, swapOne, validateBlueprintRows,
  type BlueprintRow, type CatRef, type PoolItem,
} from "@/lib/deThiBlueprint";
import type { Level } from "@/lib/azotaDocx";

// Cây: toan › c1 (yccd a, b) · c2 ; toan lẻ: x
const cats: CatRef[] = [
  { id: "toan", parentId: null }, { id: "c1", parentId: "toan" }, { id: "a", parentId: "c1" }, { id: "b", parentId: "c1" }, { id: "c2", parentId: "toan" }, { id: "ly", parentId: null },
];
let n = 0;
const mk = (categoryId: string, difficulty: Level | null, hash?: string): PoolItem => { n++; return { id: `q${String(n).padStart(3, "0")}`, categoryId, difficulty, contentHash: hash ?? `h${n}` }; };
const many = (k: number, cat: string, d: Level) => Array.from({ length: k }, () => mk(cat, d));
const pool: PoolItem[] = [...many(6, "a", "NB"), ...many(4, "b", "NB"), ...many(5, "a", "TH"), ...many(3, "c2", "VD"), ...many(2, "a", "VDC"), ...many(5, "ly", "NB")];
const ids = (r: { picks: { itemIds: string[] }[] }) => r.picks.flatMap(p => p.itemIds);

(async () => {
section("Kiểm ma trận (Q5)");
const ok = validateBlueprintRows([{ categoryId: "c1", difficulty: "nb", count: 3, junk: 1 }, { categoryId: "c2", difficulty: "VD", count: 2 }]);
check("hợp lệ: mức chữ thường được chuẩn hoá, khoá lạ bị bỏ — đúng ba khoá", ok.ok && ok.total === 5 && JSON.stringify(Object.keys(ok.rows[0])) === JSON.stringify(["categoryId", "difficulty", "count"]) && ok.rows[0].difficulty === "NB", ok);
check("rỗng / không phải mảng → EMPTY", [[], null, "x", {}].every(v => { const r = validateBlueprintRows(v); return !r.ok && r.code === "EMPTY"; }));
check("51 dòng → TOO_MANY_ROWS; 50 dòng vẫn được", (() => { const mkRows = (k: number) => Array.from({ length: k }, () => ({ categoryId: "a", difficulty: "NB", count: 1 })); const a = validateBlueprintRows(mkRows(BLUEPRINT_MAX_ROWS + 1)); const b = validateBlueprintRows(mkRows(BLUEPRINT_MAX_ROWS)); return !a.ok && a.code === "TOO_MANY_ROWS" && b.ok; })());
check("một dòng 0 hoặc 101 câu, số lẻ, chữ → BAD_ROW; 100 câu vẫn được", [0, 101, 1.5, "3", -1, NaN].every(c => { const r = validateBlueprintRows([{ categoryId: "a", difficulty: "NB", count: c }]); return !r.ok && r.code === "BAD_ROW"; }) && validateBlueprintRows([{ categoryId: "a", difficulty: "NB", count: 100 }]).ok);
check("tổng 201 → TOO_MANY_TOTAL; đúng 200 được", (() => { const r3 = (c: number) => [{ categoryId: "a", difficulty: "NB", count: 100 }, { categoryId: "b", difficulty: "NB", count: 100 }, { categoryId: "c", difficulty: "NB", count: c }]; const a = validateBlueprintRows(r3(1)); const b = validateBlueprintRows(r3(1).slice(0, 2)); return !a.ok && a.code === "TOO_MANY_TOTAL" && b.ok; })());
check("mức lạ (TB), thiếu categoryId → BAD_ROW", !validateBlueprintRows([{ categoryId: "a", difficulty: "TB", count: 1 }]).ok && !validateBlueprintRows([{ difficulty: "NB", count: 1 }]).ok);
check("tên ma trận: rỗng bị từ chối, 101 ký tự bị từ chối, khoảng trắng gộp", !normalizeBlueprintName("  ").ok && !normalizeBlueprintName("x".repeat(101)).ok && (() => { const r = normalizeBlueprintName("  Giữa   kỳ 1 "); return r.ok && r.name === "Giữa kỳ 1"; })());
check("rowsFromJson bỏ dòng hỏng thay vì ném", rowsFromJson([{ categoryId: "a", difficulty: "NB", count: 2 }, { categoryId: 5 }, null, { categoryId: "b", difficulty: "XX", count: 1 }]).length === 1 && rowsFromJson("x").length === 0);

section("Cây");
check("expandSubtree: nút + mọi con; nút lá chỉ chính nó", expandSubtree("toan", cats).sort().join() === "a,b,c1,c2,toan" && expandSubtree("a", cats).join() === "a");
check("PHÁ: vòng parentId hỏng không treo", expandSubtree("x", [{ id: "x", parentId: "y" }, { id: "y", parentId: "x" }]).sort().join() === "x,y");

section("PRNG có hạt");
check("makeRng cùng hạt → cùng dãy; khác hạt → khác dãy", (() => { const a = makeRng("s"), b = makeRng("s"), c = makeRng("t"); const A = [a(), a(), a()], B = [b(), b(), b()], C = [c(), c(), c()]; return A.join() === B.join() && A.join() !== C.join() && A.every(v => v >= 0 && v < 1); })());
check("shuffleSeeded giữ đủ phần tử, không sửa mảng gốc", (() => { const src = [1, 2, 3, 4, 5, 6]; const out = shuffleSeeded(src, makeRng("z")); return out.length === 6 && [...out].sort().join() === "1,2,3,4,5,6" && src.join() === "1,2,3,4,5,6"; })());

section("Bốc đủ số câu");
const rows: BlueprintRow[] = [
  { categoryId: "c1", difficulty: "NB", count: 5 },   // c1 gồm a,b → 10 câu NB sẵn
  { categoryId: "a", difficulty: "TH", count: 3 },
  { categoryId: "c2", difficulty: "VD", count: 2 },
  { categoryId: "toan", difficulty: "VDC", count: 2 },
];
const d1 = drawFromBlueprint({ rows, pool, categories: cats, seed: "S1" });
check("mỗi dòng đủ số câu, không thiếu", d1.shortages.length === 0 && d1.picks.map(p => p.itemIds.length).join() === "5,3,2,2", d1.picks.map(p => p.itemIds.length));
check("câu bốc đúng nút (kể cả con) và đúng mức", d1.picks.every((p, i) => p.itemIds.every(id => { const it = pool.find(x => x.id === id)!; return it.difficulty === rows[i].difficulty && expandSubtree(rows[i].categoryId, cats).includes(it.categoryId); })));
check("câu của môn khác (ly) không lọt vào dòng c1", !ids(d1).some(id => pool.find(x => x.id === id)!.categoryId === "ly"));
check("không câu nào dùng hai lần qua các dòng", new Set(ids(d1)).size === ids(d1).length);
check("seed trả lại đúng hạt vào", d1.seed === "S1");

section("Thiếu câu: báo rõ từng ô, không tự hạ mức");
const short = drawFromBlueprint({ rows: [{ categoryId: "a", difficulty: "VDC", count: 5 }, { categoryId: "c2", difficulty: "VD", count: 3 }, { categoryId: "b", difficulty: "TH", count: 2 }], pool, categories: cats, seed: "S" });
check("ô a×VDC có 2/5 → shortage {need 5, have 2}", (() => { const s = short.shortages.find(x => x.rowIndex === 0); return !!s && s.need === 5 && s.have === 2 && s.categoryId === "a" && s.difficulty === "VDC"; })());
check("ô b×TH có 0 câu (a có TH nhưng b thì không) → need 2 have 0", (() => { const s = short.shortages.find(x => x.rowIndex === 2); return !!s && s.need === 2 && s.have === 0; })());
check("ô c2×VD đủ 3/3 → không nằm trong shortages", !short.shortages.some(x => x.rowIndex === 1));
check("PHÁ: dòng thiếu KHÔNG mượn câu mức khác (a×VDC chỉ lấy câu VDC)", short.picks[0].itemIds.every(id => pool.find(x => x.id === id)!.difficulty === "VDC"));
check("shortages theo thứ tự dòng", short.shortages.map(s => s.rowIndex).join() === "0,2");

section("Trộn ổn định theo hạt");
const d1b = drawFromBlueprint({ rows, pool, categories: cats, seed: "S1" });
check("cùng hạt → cùng kết quả", JSON.stringify(d1) === JSON.stringify(d1b));
check("không phụ thuộc thứ tự pool", JSON.stringify(drawFromBlueprint({ rows, pool: [...pool].reverse(), categories: cats, seed: "S1" }).picks) === JSON.stringify(d1.picks));
const seeds = ["a", "b", "c", "d", "e", "f"].map(s => drawFromBlueprint({ rows, pool, categories: cats, seed: s }).picks[0].itemIds.join());
check("hạt khác → (gần như chắc chắn) khác: trong 6 hạt có ≥2 kết quả khác nhau", new Set(seeds).size >= 2, seeds);

section("Không trùng nội dung");
const dupPool = [mk("a", "NB", "SAME"), mk("a", "NB", "SAME"), mk("a", "NB", "SAME"), mk("a", "NB", "OTHER")];
const dd = drawFromBlueprint({ rows: [{ categoryId: "a", difficulty: "NB", count: 3 }], pool: dupPool, categories: cats, seed: "x" });
check("3 câu cùng contentHash chỉ lấy 1; câu thứ hai khác hash → 2/3 và báo thiếu", ids(dd).length === 2 && dd.shortages[0]?.have === 2, dd);
check("trùng hash giữa hai dòng khác nhau cũng không lấy hai lần", (() => { const p = [mk("a", "NB", "K"), mk("b", "NB", "K")]; const r = drawFromBlueprint({ rows: [{ categoryId: "a", difficulty: "NB", count: 1 }, { categoryId: "b", difficulty: "NB", count: 1 }], pool: p, categories: cats, seed: "x" }); return ids(r).length === 1 && r.shortages.length === 1; })());
check("contentHash rỗng coi là duy nhất (không gộp nhầm)", (() => { const p = [mk("a", "NB", ""), mk("a", "NB", "")]; p.forEach(x => { x.contentHash = ""; }); return ids(drawFromBlueprint({ rows: [{ categoryId: "a", difficulty: "NB", count: 2 }], pool: p, categories: cats, seed: "x" })).length === 2; })());
check("PHÁ: một câu khớp hai dòng (c1×NB và a×NB) chỉ dùng một lần", (() => { const p = many(3, "a", "NB"); const r = drawFromBlueprint({ rows: [{ categoryId: "c1", difficulty: "NB", count: 2 }, { categoryId: "a", difficulty: "NB", count: 2 }], pool: p, categories: cats, seed: "x" }); return new Set(ids(r)).size === ids(r).length && ids(r).length === 3 && r.shortages.length === 1; })());

section("locked / exclude");
const one: BlueprintRow[] = [{ categoryId: "c1", difficulty: "NB", count: 4 }];
const base = drawFromBlueprint({ rows: one, pool, categories: cats, seed: "L" });
const keep = base.picks[0].itemIds.slice(0, 2);
const again = drawFromBlueprint({ rows: one, pool, categories: cats, seed: "L2", locked: keep });
check("bốc lại với hạt mới: câu giữ lại vẫn ở đó, đủ 4 câu", keep.every(k => ids(again).includes(k)) && ids(again).length === 4 && again.shortages.length === 0);
const bad = base.picks[0].itemIds[0];
const ex = drawFromBlueprint({ rows: one, pool, categories: cats, seed: "L", exclude: [bad] });
check("exclude: câu bị bỏ không bao giờ xuất hiện", !ids(ex).includes(bad) && ids(ex).length === 4);
check("PHÁ: câu vừa locked vừa exclude → exclude thắng (không xuất hiện)", !ids(drawFromBlueprint({ rows: one, pool, categories: cats, seed: "L", locked: [bad], exclude: [bad] })).includes(bad));
check("locked không khớp dòng nào (câu môn Lý) → bị bỏ qua, không chen vào", !ids(drawFromBlueprint({ rows: one, pool, categories: cats, seed: "L", locked: [pool.find(p => p.categoryId === "ly")!.id] })).some(id => pool.find(p => p.id === id)!.categoryId === "ly"));
check("locked nhiều hơn chỗ của dòng → không vượt số câu", ids(drawFromBlueprint({ rows: [{ categoryId: "c1", difficulty: "NB", count: 1 }], pool, categories: cats, seed: "L", locked: base.picks[0].itemIds })).length === 1);
check("locked trùng id hai lần chỉ tính một", ids(drawFromBlueprint({ rows: one, pool, categories: cats, seed: "L", locked: [keep[0], keep[0]] })).filter(i => i === keep[0]).length === 1);

section("Đổi một câu");
const cur = ids(base);
const sw = swapOne({ itemId: cur[0], rowIndex: 0, rows: one, pool, categories: cats, seed: "W", current: cur });
check("đổi → câu mới khác câu cũ, chưa có trong đề, cùng ô (c1 × NB)", "itemId" in sw && sw.itemId !== cur[0] && !cur.includes(sw.itemId) && (() => { const it = pool.find(p => p.id === (sw as { itemId: string }).itemId)!; return it.difficulty === "NB" && ["a", "b"].includes(it.categoryId); })());
check("cùng hạt → cùng câu thay", JSON.stringify(sw) === JSON.stringify(swapOne({ itemId: cur[0], rowIndex: 0, rows: one, pool, categories: cats, seed: "W", current: cur })));
check("hết câu thay → NO_ALTERNATIVE (ô a×VDC chỉ có 2 câu, đang dùng cả 2)", (() => { const r2: BlueprintRow[] = [{ categoryId: "a", difficulty: "VDC", count: 2 }]; const dr = drawFromBlueprint({ rows: r2, pool, categories: cats, seed: "q" }); const c = ids(dr); const s = swapOne({ itemId: c[0], rowIndex: 0, rows: r2, pool, categories: cats, seed: "q", current: c }); return "code" in s && s.code === "NO_ALTERNATIVE"; })());
check("câu bị exclude không được chọn làm câu thay", (() => { const others = pool.filter(p => (p.categoryId === "a" || p.categoryId === "b") && p.difficulty === "NB" && !cur.includes(p.id)); const s = swapOne({ itemId: cur[0], rowIndex: 0, rows: one, pool, categories: cats, seed: "W", current: cur, exclude: others.slice(1).map(o => o.id) }); return "itemId" in s && s.itemId === others[0].id; })());
check("PHÁ: câu thay có nội dung trùng câu đang có bị loại", (() => { const p = [mk("a", "NB", "H1"), mk("a", "NB", "H1"), mk("a", "NB", "H2")]; const s = swapOne({ itemId: p[0].id, rowIndex: 0, rows: [{ categoryId: "a", difficulty: "NB", count: 1 }], pool: p, categories: cats, seed: "z", current: [p[0].id] }); return "itemId" in s && s.itemId === p[2].id; })());
check("rowIndex ngoài phạm vi → NO_ALTERNATIVE, không ném", "code" in swapOne({ itemId: "x", rowIndex: 9, rows: one, pool, categories: cats, seed: "s", current: [] }));

section("Thiếu câu theo lựa chọn cuối (tạo đề)");
const sel = [{ id: "1", categoryId: "a", difficulty: "NB" as Level }, { id: "2", categoryId: "b", difficulty: "NB" as Level }, { id: "3", categoryId: "a", difficulty: "TH" as Level }, { id: "9", categoryId: "ly", difficulty: "NB" as Level }];
const sh = shortagesForSelection([{ categoryId: "c1", difficulty: "NB", count: 2 }, { categoryId: "a", difficulty: "TH", count: 2 }], sel, cats);
check("c1×NB đủ 2 (a và b cùng tính), a×TH thiếu 1; câu Lý thêm tay không bị tính lỗi", sh.length === 1 && sh[0].rowIndex === 1 && sh[0].need === 2 && sh[0].have === 1, sh);
check("PHÁ: lựa chọn rỗng → mọi dòng thiếu", shortagesForSelection([{ categoryId: "a", difficulty: "NB", count: 1 }], [], cats).length === 1);

await done();
})();
