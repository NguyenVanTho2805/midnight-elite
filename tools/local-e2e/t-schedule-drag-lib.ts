// TUT-lich-keo-tha — logic thuần của lưới khung giờ kéo-thả (src/lib/scheduleDrag.ts). Không DB, không máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-schedule-drag-lib.ts
import {
  snapMin, pxToMin, minToPx, createRange, moveRange, resizeRange, moveBlock, overlaps, findConflicts, layoutDayLanes,
  toApiSlot, fromApiRow, diffBlocks, applyOp, invertOp, nudge, validateBlocks, describeBlock, weeklyMinutes, formatDuration, toWizardSlots,
  WEEK_ORDER, MAX_BLOCKS_PER_COURSE, NOTE_MAX, type ScheduleBlock, type ScheduleOp,
} from "@/lib/scheduleDrag";
import { slotsOverlap } from "@/lib/sessionBook";
import { check, section, done } from "./h";

const B = (id: string, day: number, s: number, e: number, o: Partial<ScheduleBlock> = {}): ScheduleBlock => ({ id, dayOfWeek: day, startMin: s, endMin: e, ...o });
const H = (h: number, m = 0) => h * 60 + m;
const throws = (f: () => unknown, ctor: new (...a: never[]) => Error = RangeError) => { try { f(); return false; } catch (e) { return e instanceof ctor; } };
const noThrow = (f: () => unknown) => { try { f(); return true; } catch { return false; } };
const norm = (bs: readonly ScheduleBlock[]) => JSON.stringify([...bs].sort((a, b) => a.id.localeCompare(b.id)).map(b => JSON.parse(JSON.stringify(b))));
const exact = (bs: readonly ScheduleBlock[]) => JSON.stringify(bs.map(b => JSON.parse(JSON.stringify(b))));

section("snapMin");
check("0 → 0; 7 → 0; 8 → 15; 22 → 15; 23 → 30", [0, 7, 8, 22, 23].map(x => snapMin(x)).join() === "0,0,15,15,30");
check("1439 → 1440 (kẹp); 1440 → 1440; 5000 → 1440", [1439, 1440, 5000].every(x => snapMin(x) === 1440));
check("âm kẹp về 0 (−5, −500) và KHÔNG ra −0", snapMin(-5) === 0 && !Object.is(snapMin(-5), -0) && snapMin(-500) === 0);
check("NaN → 0; Infinity → 1440; −Infinity → 0; không ném", snapMin(NaN) === 0 && snapMin(Infinity) === 1440 && snapMin(-Infinity) === 0 && noThrow(() => snapMin(NaN)));
check("số lẻ 7.5 (đúng nửa bước) làm tròn lên → 15; 7.49 → 0", snapMin(7.5) === 15 && snapMin(7.49) === 0);
check("bước khác: snapMin(70, 30) = 60; step 0 / âm / NaN rơi về 15 (không chia 0)", snapMin(70, 30) === 60 && snapMin(37, 0) === 30 && snapMin(37, -5) === 30 && snapMin(37, NaN) === 30);

section("pxToMin / minToPx");
for (const pph of [48, 56, 64]) {
  check(`khứ hồi ở ${pph} px/giờ: phút → px → phút giữ nguyên (0, 495, 1140, 1440)`, [0, 495, 1140, 1440].every(m => Math.abs(pxToMin(minToPx(m, pph, 360), pph, 360) - m) < 1e-9 || m < 360), [pph]);
}
check("gốc 6:00, 64px/giờ: px 64 → 7:00 (420 phút); px 0 → 360", pxToMin(64, 64, 360) === 420 && pxToMin(0, 64, 360) === 360);
check("pxPerHour = 0 / âm / NaN → ném RangeError (lỗi lập trình, không thành NaN âm thầm)", throws(() => pxToMin(10, 0)) && throws(() => pxToMin(10, -64)) && throws(() => pxToMin(10, NaN)) && throws(() => minToPx(10, 0)));
check("px âm / rất lớn → kẹp 0..1440; px NaN → gốc", pxToMin(-9999, 64) === 0 && pxToMin(1e9, 64) === 1440 && pxToMin(NaN, 64, 360) === 360);
check("minToPx: 7:00 so với gốc 6:00 ở 56px/giờ = 56", minToPx(420, 56, 360) === 56);

section("createRange");
check("kéo xuôi 19:00→20:30 = [1140,1230]; kéo NGƯỢC cho cùng kết quả", JSON.stringify(createRange(H(19), H(20, 30))) === JSON.stringify({ startMin: 1140, endMin: 1230 }) && JSON.stringify(createRange(H(20, 30), H(19))) === JSON.stringify(createRange(H(19), H(20, 30))));
check("bấm không kéo → 90 phút (DEFAULT) từ giờ bấm", JSON.stringify(createRange(H(9), H(9))) === JSON.stringify({ startMin: 540, endMin: 630 }));
check("kéo dưới 15' (9:00→9:07) cũng ra 90 phút", createRange(H(9), H(9, 7)).endMin - createRange(H(9), H(9, 7)).startMin === 90);
check("kéo đúng 15' giữ 15'", JSON.stringify(createRange(H(9), H(9, 15))) === JSON.stringify({ startMin: 540, endMin: 555 }));
check("kéo từ trước 0:00 và quá 24:00 → kẹp [0,120] / [600,1440]", JSON.stringify(createRange(-100, H(2))) === JSON.stringify({ startMin: 0, endMin: 120 }) && JSON.stringify(createRange(H(10), 5000)) === JSON.stringify({ startMin: 600, endMin: 1440 }));
check("bấm 23:50 → [1425,1440] (còn 15', không tràn 24:00)", JSON.stringify(createRange(H(23, 50), H(23, 50))) === JSON.stringify({ startMin: 1425, endMin: 1440 }));
check("bấm ngay 24:00 → vẫn [1425,1440], không rỗng", JSON.stringify(createRange(1440, 1440)) === JSON.stringify({ startMin: 1425, endMin: 1440 }));
check("NaN không sinh NaN: createRange(NaN, NaN) hữu hạn và dài ≥ 15", (() => { const r = createRange(NaN, NaN); return Number.isFinite(r.startMin) && r.endMin - r.startMin >= 15; })());

section("moveRange");
check("dời qua 24:00 (1380, dài 90, +60) → kẹp [1350,1440], GIỮ độ dài", (() => { const r = moveRange({ startMin: 1380, endMin: 1470 > 1440 ? 1440 : 1470 }, 60); return r.endMin === 1440; })() && JSON.stringify(moveRange({ startMin: 1290, endMin: 1380 }, 120)) === JSON.stringify({ startMin: 1350, endMin: 1440 }));
check("dời trước 0:00 → [0, dài] giữ độ dài", JSON.stringify(moveRange({ startMin: 60, endMin: 150 }, -600)) === JSON.stringify({ startMin: 0, endMin: 90 }));
check("delta Infinity / −Infinity / NaN → không dời (không văng khỏi lưới)", [Infinity, -Infinity, NaN].every(d => JSON.stringify(moveRange({ startMin: 600, endMin: 690 }, d)) === JSON.stringify({ startMin: 600, endMin: 690 })));
check("delta 0 trả khoảng giá trị cũ (đối tượng mới, không sửa đầu vào)", (() => { const r = { startMin: 600, endMin: 690 }; const o = moveRange(r, 0); return o !== r && o.startMin === 600 && o.endMin === 690; })());
check("delta lẻ làm tròn 15' (+8 → +15, +7 → 0)", moveRange({ startMin: 600, endMin: 660 }, 8).startMin === 615 && moveRange({ startMin: 600, endMin: 660 }, 7).startMin === 600);

section("resizeRange");
const R = { startMin: H(10), endMin: H(11) };
check("mép dưới kéo lên TRÊN mép trên → dừng ở start+15, KHÔNG hoán đổi", JSON.stringify(resizeRange(R, "end", H(9))) === JSON.stringify({ startMin: 600, endMin: 615 }));
check("mép trên kéo xuống DƯỚI mép dưới → dừng ở end−15, không hoán đổi", JSON.stringify(resizeRange(R, "start", H(12))) === JSON.stringify({ startMin: 645, endMin: 660 }));
check("kéo mép dưới quá 24:00 → 1440; mép trên dưới 0:00 → 0", resizeRange(R, "end", 5000).endMin === 1440 && resizeRange(R, "start", -50).startMin === 0);
check("khối dài đúng 15 giữ nguyên khi thu thêm", JSON.stringify(resizeRange({ startMin: 600, endMin: 615 }, "end", 600)) === JSON.stringify({ startMin: 600, endMin: 615 }) && JSON.stringify(resizeRange({ startMin: 600, endMin: 615 }, "start", 700)) === JSON.stringify({ startMin: 600, endMin: 615 }));
check("kéo mép làm tròn 15' (end 11:07 → 11:00)", resizeRange(R, "end", H(11, 7)).endMin === 660);
check("phá: mọi kết quả luôn dài ≥ 15 và trong 0..1440 với con trỏ lung tung", [NaN, -1e9, 1e9, 3, 599, 601, Infinity].every(p => (["start", "end"] as const).every(e => { const r = resizeRange(R, e, p); return r.endMin - r.startMin >= 15 && r.startMin >= 0 && r.endMin <= 1440; })));

section("moveBlock");
const mb = B("a", 2, H(19), H(20, 30), { courseName: "Toán 9", note: "x" });
check("sang Thứ Năm + 30': giữ độ dài, giữ các trường khác, không sửa gốc", (() => { const o = moveBlock(mb, { deltaMin: 30, toDay: 4 }); return o.dayOfWeek === 4 && o.startMin === 1170 && o.endMin === 1260 && o.courseName === "Toán 9" && mb.dayOfWeek === 2 && mb.startMin === 1140; })());
check("toDay −1 → Thứ Hai (cột đầu); 7 → Chủ nhật (cột cuối); không vòng", moveBlock(mb, { toDay: -1 }).dayOfWeek === 1 && moveBlock(mb, { toDay: 7 }).dayOfWeek === 0);
check("toDay 3.5 → làm tròn 4; NaN → giữ nguyên ngày; vắng → giữ", moveBlock(mb, { toDay: 3.5 }).dayOfWeek === 4 && moveBlock(mb, { toDay: NaN }).dayOfWeek === 2 && moveBlock(mb, { deltaMin: 15 }).dayOfWeek === 2);
check("WEEK_ORDER: Chủ nhật (0) đứng CUỐI; Thứ Hai đứng đầu", WEEK_ORDER[0] === 1 && WEEK_ORDER[6] === 0 && WEEK_ORDER.length === 7);

section("overlaps / findConflicts");
check("giao một phần; chứa nhau; giống hệt", overlaps(B("a", 1, 600, 700), B("b", 1, 650, 750)) && overlaps(B("a", 1, 600, 900), B("b", 1, 650, 700)) && overlaps(B("a", 1, 600, 700), B("b", 1, 600, 700)));
check("CHẠM ĐẦU 18:00–19:00 vs 19:00–20:00 = KHÔNG trùng (cả hai chiều)", !overlaps(B("a", 1, H(18), H(19)), B("b", 1, H(19), H(20))) && !overlaps(B("b", 1, H(19), H(20)), B("a", 1, H(18), H(19))));
check("khác thứ không trùng dù cùng giờ", !overlaps(B("a", 1, 600, 700), B("b", 2, 600, 700)));
check("khớp slotsOverlap của sessionBook trên lưới 15' (kiểm chéo ngẫu nhiên, 2000 cặp)", (() => {
  let seed = 7; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < 2000; i++) {
    const s1 = rnd(90) * 15, e1 = Math.min(1440, s1 + 15 + rnd(8) * 15), s2 = rnd(90) * 15, e2 = Math.min(1440, s2 + 15 + rnd(8) * 15);
    if (overlaps(B("a", 1, s1, e1), B("b", 1, s2, e2)) !== slotsOverlap({ startMin: s1, endMin: e1 }, { startMin: s2, endMin: e2 })) return false;
  }
  return true;
})());
check("phá (cài đặt ngây thơ dùng <= sẽ SAI ở chạm đầu): bản sao <= báo trùng, hàm thật thì không", (() => {
  const naive = (a: ScheduleBlock, b: ScheduleBlock) => a.dayOfWeek === b.dayOfWeek && a.startMin <= b.endMin && b.startMin <= a.endMin;
  const a = B("a", 1, H(18), H(19)), b = B("b", 1, H(19), H(20));
  return naive(a, b) === true && overlaps(a, b) === false;
})());
const own = [B("o1", 3, H(18), H(19), { courseName: "Toán 9" }), B("o2", 3, H(19), H(20), { courseName: "Toán 9" }), B("o3", 3, H(18), H(19), { courseName: "Toán 9", active: false })];
const ghosts = [B("g1", 3, H(18, 30), H(19, 30), { courseName: "Lý 8" }), B("g2", 3, H(18, 30), H(19, 30), { courseName: "Hoá 7", active: false })];
const cf = findConflicts(B("n", 3, H(18, 30), H(19, 15), { courseName: "Toán 9" }), own, ghosts);
check("findConflicts: trùng 2 khung cùng lớp (o1,o2) + 1 lớp khác (g1); bỏ khung tắt (o3, g2)", cf.map(c => c.otherId).sort().join() === "g1,o1,o2" && cf.filter(c => c.kind === "cung-lop").length === 2 && cf.find(c => c.otherId === "g1")?.kind === "lop-khac", cf);
check("chữ trùng giờ có tên lớp khác + giờ, đúng dạng", cf.find(c => c.otherId === "g1")?.text === "Trùng giờ với Lý 8 (18:30–19:30)", cf.find(c => c.otherId === "g1")?.text);
check("bỏ qua chính nó (cùng id) và khối đang tắt không báo trùng", findConflicts(own[0], own, []).every(c => c.otherId !== "o1") && findConflicts(B("z", 3, H(18), H(19), { active: false }), own, ghosts).length === 0);
check("chạm đầu với khung khác thì KHÔNG trùng", findConflicts(B("n", 3, H(20), H(21)), own, ghosts).length === 0);
check("TRẺ EM: chữ trùng giờ không chứa tên học sinh dù dữ liệu mẫu nhét tên vào note/location", (() => {
  const g = [B("g", 3, H(18), H(19), { courseName: "Lý 8", note: "Nguyễn Văn An", location: "nhà em Bình" })];
  const t = JSON.stringify(findConflicts(B("n", 3, H(18), H(19)), [B("o", 3, H(18), H(19), { note: "Trần Thị Bình" })], g));
  return !/Nguyễn Văn An|Trần Thị Bình|Bình/.test(t);
})());

section("layoutDayLanes");
const L3 = [B("a", 1, 600, 720), B("b", 1, 630, 700), B("c", 1, 650, 760), B("d", 1, 900, 960)];
const l1 = layoutDayLanes(L3);
check("3 khối chồng nhau → 3 làn khác nhau, lanes=3; khối rời d → 1 làn", new Set([l1.a.lane, l1.b.lane, l1.c.lane]).size === 3 && l1.a.lanes === 3 && l1.d.lane === 0 && l1.d.lanes === 1, l1);
check("xáo thứ tự mảng → CÙNG kết quả (ổn định)", [[3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]].every(p => JSON.stringify(layoutDayLanes(p.map(i => L3[i]))) === JSON.stringify(l1)));
check("không chồng → mọi khối 1 làn; chạm đầu cũng 1 làn", Object.values(layoutDayLanes([B("a", 1, 600, 660), B("b", 1, 660, 720), B("c", 2, 600, 720)])).every(x => x.lane === 0 && x.lanes === 1));
check("khối khác thứ không chiếm làn của nhau", layoutDayLanes([B("a", 1, 600, 720), B("b", 2, 600, 720)]).b.lane === 0);

section("toApiSlot / fromApiRow");
check("1440 → \"23:59\"; 1425 → \"23:45\"; \"9:05\" → \"09:05\"", toApiSlot(B("a", 1, 540, 1440)).endTime === "23:59" && toApiSlot(B("a", 1, 540, 1425)).endTime === "23:45" && toApiSlot(B("a", 1, 545, 600)).startTime === "09:05");
check("fromApiRow: \"23:59\" cuối → 1440; \"9:05\" bắt đầu → 545; khứ hồi giữ nguyên", (() => { const f = fromApiRow({ id: "x", dayOfWeek: 2, startTime: "9:05", endTime: "23:59" }); return f?.startMin === 545 && f.endMin === 1440 && toApiSlot(f).endTime === "23:59" && toApiSlot(f).startTime === "09:05"; })());
check("giờ sai → null, KHÔNG ném: \"25:00\", \"abc\", \"24:00\", null, số, thiếu", ["25:00", "abc", "24:00", null, 5, undefined, "19:60"].every(v => { let r: unknown = "unset"; return noThrow(() => { r = fromApiRow({ id: "x", dayOfWeek: 1, startTime: v, endTime: "20:00" }); }) && r === null; }));
check("hàng hỏng → null: không phải đối tượng, thứ 7 / −1 / 2.5, end ≤ start, không id", [null, 3, "s", [], { id: "x", dayOfWeek: 7, startTime: "9:00", endTime: "10:00" }, { id: "x", dayOfWeek: -1, startTime: "9:00", endTime: "10:00" }, { id: "x", dayOfWeek: 2.5, startTime: "9:00", endTime: "10:00" }, { id: "x", dayOfWeek: 1, startTime: "10:00", endTime: "10:00" }, { dayOfWeek: 1, startTime: "9:00", endTime: "10:00" }].every(r => fromApiRow(r) === null));
check("fromApiRow giữ note/mode/location; mode lạ → null; active:false giữ", (() => { const f = fromApiRow({ id: "x", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", note: "n", mode: "xx", location: "L", active: false })!; return f.note === "n" && f.mode === null && f.location === "L" && f.active === false; })());

section("diffBlocks / applyOp / invertOp");
const S0 = [B("a", 1, 600, 660, { note: "a" }), B("b", 2, 600, 660), B("c", 3, 600, 660)];
check("không đổi → rỗng; ĐỔI THỨ TỰ mảng → vẫn rỗng", diffBlocks(S0, S0).length === 0 && diffBlocks(S0, [S0[2], S0[0], S0[1]]).length === 0);
check("một khung dời + một thêm + một bớt → đúng 3 thao tác (update, create, remove)", (() => { const after = [B("a", 1, 615, 675, { note: "a" }), S0[1], B("d", 4, 700, 760)]; const d = diffBlocks(S0, after); return d.length === 3 && d.map(o => o.type).sort().join() === "create,remove,update" && d.find(o => o.type === "update")?.type === "update"; })());
check("update chỉ chứa trường ĐỔI (dời 15': startMin + endMin)", (() => { const d = diffBlocks(S0, [B("a", 1, 615, 675, { note: "a" }), S0[1], S0[2]])[0]; return d.type === "update" && Object.keys(d.patch).sort().join() === "endMin,startMin"; })());
check("null và undefined của note coi như nhau (không sinh thao tác thừa); active vắng = true", diffBlocks([B("a", 1, 600, 660, { note: null })], [B("a", 1, 600, 660, { active: true })]).length === 0);
check("tắt khung → update {active:false}", (() => { const d = diffBlocks(S0, [{ ...S0[0], active: false }, S0[1], S0[2]]); return d.length === 1 && d[0].type === "update" && d[0].patch.active === false; })());
check("applyOp không sửa mảng/khối gốc", (() => { const snap = exact(S0); applyOp(S0, { type: "update", id: "a", patch: { startMin: 0 } }); applyOp(S0, { type: "remove", id: "b" }); applyOp(S0, { type: "create", block: B("z", 1, 0, 60) }); return exact(S0) === snap; })());
check("applyOp: id lạ → update/remove không làm gì; create trùng id thì thay (không nhân đôi)", norm(applyOp(S0, { type: "update", id: "zz", patch: { startMin: 0 } })) === norm(S0) && norm(applyOp(S0, { type: "remove", id: "zz" })) === norm(S0) && applyOp(S0, { type: "create", block: B("a", 5, 0, 60) }).length === 3);
check("create đảo bằng remove (cục bộ); từ xa đảo bằng TẮT khung, không xoá cứng", invertOp({ type: "create", block: B("n", 1, 0, 60) }, S0)?.type === "remove" && (() => { const o = invertOp({ type: "create", block: B("n", 1, 0, 60) }, S0, { remote: true }); return o?.type === "update" && o.patch.active === false; })());
check("remove từ xa KHÔNG hoàn tác được (null); remove id lạ → null; remove cục bộ đảo thành create đúng vị trí", invertOp({ type: "remove", id: "b" }, S0, { remote: true }) === null && invertOp({ type: "remove", id: "zz" }, S0) === null && (() => { const o = invertOp({ type: "remove", id: "b" }, S0); return o?.type === "create" && o.at === 1; })());
check("đảo từng loại: applyOp(applyOp(s,op), invertOp(op,s)) ≡ s (đúng cả thứ tự)", (["remove", "update", "create"] as const).every(t => {
  const op: ScheduleOp = t === "remove" ? { type: "remove", id: "b" } : t === "update" ? { type: "update", id: "b", patch: { dayOfWeek: 5, startMin: 0, note: "mới" } } : { type: "create", block: B("n", 1, 0, 60) };
  return exact(applyOp(applyOp(S0, op), invertOp(op, S0)!)) === exact(S0);
}));
check("200 thao tác ngẫu nhiên (PRNG hạt cố định) rồi đảo ngược hết → trạng thái ban đầu", (() => {
  let seed = 20261107; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const start = [B("a", 1, 600, 660, { note: "a" }), B("b", 2, 600, 660, { active: false }), B("c", 3, 600, 660, { mode: "online" })];
  let state = start; const inv: ScheduleOp[] = []; let n = 0;
  for (let i = 0; i < 200; i++) {
    const k = rnd(3); let op: ScheduleOp;
    if (k === 0 || state.length === 0) op = { type: "create", block: B(`n${n++}`, rnd(7), rnd(80) * 15, 1200 + rnd(16) * 15, rnd(2) ? { note: "x" + i } : {}) };
    else if (k === 1) op = { type: "update", id: state[rnd(state.length)].id, patch: rnd(2) ? { dayOfWeek: rnd(7), startMin: rnd(60) * 15 } : { active: !!rnd(2), note: rnd(2) ? null : "n" + i } };
    else op = { type: "remove", id: state[rnd(state.length)].id };
    const iv = invertOp(op, state); if (!iv) return false;
    inv.push(iv); state = applyOp(state, op);
  }
  for (let i = inv.length - 1; i >= 0; i--) state = applyOp(state, inv[i]);
  return exact(state) === exact(start);
})());

section("nudge");
const nb = B("a", 3, H(10), H(11));
check("↑/↓ dời ∓/+15'", nudge(nb, "ArrowUp").startMin === 585 && nudge(nb, "ArrowDown").startMin === 615 && nudge(nb, "ArrowDown").endMin === 675);
check("←/→ sang thứ liền kề theo WEEK_ORDER (T4 → T3 / T5)", nudge(nb, "ArrowLeft").dayOfWeek === 2 && nudge(nb, "ArrowRight").dayOfWeek === 4);
check("biên ngày: T2 nhấn ← ở yên; Chủ nhật nhấn → ở yên (không vòng); T7 → CN", nudge(B("a", 1, 0, 60), "ArrowLeft").dayOfWeek === 1 && nudge(B("a", 0, 0, 60), "ArrowRight").dayOfWeek === 0 && nudge(B("a", 6, 0, 60), "ArrowRight").dayOfWeek === 0);
check("biên giờ: start=0 nhấn ↑ ở yên; end=1440 nhấn ↓ ở yên", (() => { const u = nudge(B("a", 1, 0, 60), "ArrowUp"); const d = nudge(B("a", 1, 1380, 1440), "ArrowDown"); return u.startMin === 0 && u.endMin === 60 && d.startMin === 1380 && d.endMin === 1440; })());
check("Shift+↓ giãn mép dưới +15; Shift+↑ co −15; Shift+↑ khi dài 15 ở yên", nudge(nb, "ArrowDown", { shift: true }).endMin === 675 && nudge(nb, "ArrowUp", { shift: true }).endMin === 645 && nudge(B("a", 1, 600, 615), "ArrowUp", { shift: true }).endMin === 615);
check("Alt+Shift+↑ kéo mép trên lên 15; Alt+Shift+↓ khi dài 15 ở yên (không hoán đổi)", nudge(nb, "ArrowUp", { shift: true, alt: true }).startMin === 585 && nudge(B("a", 1, 600, 615), "ArrowDown", { shift: true, alt: true }).startMin === 600);
check("phím lạ / Alt một mình → bản sao không đổi", JSON.stringify(nudge(nb, "x")) === JSON.stringify(nb) && JSON.stringify(nudge(nb, "ArrowUp", { alt: true })) === JSON.stringify(nb) && nudge(nb, "x") !== nb);

section("validateBlocks");
check("hợp lệ → null; rỗng → null", validateBlocks([B("a", 1, 600, 660), B("b", 2, 600, 660)]) === null && validateBlocks([]) === null);
check("trùng CHÍNH XÁC (cùng thứ + giờ) → lỗi; khung tắt trùng thì không tính", validateBlocks([B("a", 1, 600, 660), B("b", 1, 600, 660)]) === "Có hai khung giờ trùng nhau." && validateBlocks([B("a", 1, 600, 660), B("b", 1, 600, 660, { active: false })]) === null);
check("end ≤ start → lỗi (bằng nhau, ngược)", validateBlocks([B("a", 1, 600, 600)]) !== null && validateBlocks([B("a", 1, 700, 600)]) !== null);
check(`${MAX_BLOCKS_PER_COURSE} khung vừa đủ; 15 khung (vượt trần) → lỗi`, validateBlocks(Array.from({ length: 14 }, (_, i) => B(`k${i}`, i % 7, i * 60, i * 60 + 30))) === null && /tối đa 14/.test(validateBlocks(Array.from({ length: 15 }, (_, i) => B(`k${i}`, i % 7, i * 60, i * 60 + 30))) ?? ""));
check(`note đúng ${NOTE_MAX} ký tự qua; ${NOTE_MAX + 1} ký tự → lỗi`, validateBlocks([B("a", 1, 600, 660, { note: "x".repeat(200) })]) === null && /200/.test(validateBlocks([B("a", 1, 600, 660, { note: "x".repeat(201) })]) ?? ""));
check("CHỒNG NHAU một phần KHÔNG phải lỗi (đồng giảng về sau cần cho phép)", validateBlocks([B("a", 1, 600, 720), B("b", 1, 660, 780)]) === null);
check("thứ ngoài 0–6, giờ không nguyên / ngoài 0..1440 → lỗi", validateBlocks([B("a", 7, 600, 660)]) !== null && validateBlocks([B("a", 1, 600.5, 660)]) !== null && validateBlocks([B("a", 1, -15, 60)]) !== null && validateBlocks([B("a", 1, 600, 1455)]) !== null);

section("describeBlock / weeklyMinutes / formatDuration / toWizardSlots");
check("describeBlock đúng mẫu aria", describeBlock(B("a", 2, H(19), H(20, 30), { courseName: "Toán 9" })) === "Toán 9, Thứ Ba, 19:00 đến 20:30, 90 phút", describeBlock(B("a", 2, H(19), H(20, 30), { courseName: "Toán 9" })));
check("describeBlock không có tên lớp → dùng note, rồi 'Khung giờ'; CN đúng chữ", describeBlock(B("a", 0, 600, 660, { note: "Ôn thi" })).startsWith("Ôn thi, Chủ nhật") && describeBlock(B("a", 1, 600, 660)).startsWith("Khung giờ, Thứ Hai"));
check("weeklyMinutes bỏ khung tắt; formatDuration: 270 → '4 giờ 30 phút', 60 → '1 giờ', 45 → '45 phút', âm/NaN → '0 phút'", weeklyMinutes([B("a", 1, 600, 690), B("b", 2, 600, 780), B("c", 3, 0, 600, { active: false })]) === 270 && formatDuration(270) === "4 giờ 30 phút" && formatDuration(60) === "1 giờ" && formatDuration(45) === "45 phút" && formatDuration(-5) === "0 phút" && formatDuration(NaN) === "0 phút");
check("toWizardSlots chỉ khung bật, 1440 → 23:59", JSON.stringify(toWizardSlots([B("a", 1, 540, 1440), B("b", 2, 600, 660, { active: false })])) === JSON.stringify([{ dayOfWeek: 1, startTime: "09:00", endTime: "23:59" }]));

done();
