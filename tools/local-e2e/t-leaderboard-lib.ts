// STU-003 / quyết định 1B (04/11/2026) — hai hàm thuần phía sau bảng xếp hạng:
//   src/lib/leaderboardPublic.ts (shapeLeaderboard): KHÁCH chỉ thấy tên che, không trường, không userId, tối đa 10 dòng; người đã đăng nhập thấy như cũ, tối đa 20 dòng.
//   src/lib/ttlCache.ts (makeTtlCache, leaderboardCacheMs): bộ đệm có hạn dùng, có trần số khoá, tắt được.
// Chạy: npx tsx tools/local-e2e/t-leaderboard-lib.ts  (không cần DB, không cần máy chủ)
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - shapeLeaderboard: bỏ `maskName(...)` (trả r.name) → ca "tên khách bị che" đỏ.
//   - shapeLeaderboard: thêm `school: r.school` hoặc `userId: r.userId` vào bản khách → ca "khách không có userId / school" đỏ.
//   - GUEST_LEADERBOARD_LIMIT 10 → 20 → ca "khách tối đa 10 dòng" đỏ.
//   - makeTtlCache: đổi `>= ttlMs` thành `> ttlMs` ở get → ca "đúng hạn là hết" đỏ; bỏ vòng `while (store.size >= max)` → ca "trần số khoá" đỏ.
import { shapeLeaderboard, GUEST_LEADERBOARD_LIMIT, MEMBER_LEADERBOARD_LIMIT, type LeaderboardRow, type GuestLeaderboardRow } from "@/lib/leaderboardPublic";
import { makeTtlCache, leaderboardCacheMs } from "@/lib/ttlCache";
import { check, section, done } from "./h";

const row = (i: number, o: Partial<LeaderboardRow> = {}): LeaderboardRow => ({ userId: `u${i}`, name: `Nguyễn Văn Em${i}`, school: `THPT Số ${i}, Hà Nội`, best: 100 - i, avg: 90 - i, count: 2, ...o });
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(i));

section("Khách: tên che, không trường, không userId, tối đa 10 dòng");
const g = shapeLeaderboard(rows(30), false) as GuestLeaderboardRow[];
check("giới hạn khách = 10", GUEST_LEADERBOARD_LIMIT === 10 && g.length === 10, g.length);
check("giữ nguyên thứ tự và điểm (hạng 1 là best 100)", g[0].best === 100 && g[9].best === 91 && g.every((x, i) => x.best === 100 - i));
check("tên đã che: 'Nguyễn Văn Em0' → 'Nguyễn V. E.'", g[0].name === "Nguyễn V. E.", g[0].name);
check("không dòng nào còn tên đầy đủ", g.every(x => !/Em\d/.test(x.name)), g.map(x => x.name));
check("khách không có userId / school ở BẤT KỲ dòng nào (kể cả khoá rỗng)", g.every(x => !("userId" in x) && !("school" in x)), Object.keys(g[0]));
check("khoá còn lại đúng 4: name, best, avg, count", g.every(x => Object.keys(x).sort().join() === "avg,best,count,name"));
check("JSON gửi khách không chứa chữ 'THPT' hay 'u3' (trường / mã)", !/THPT|"u\d/.test(JSON.stringify(g)), JSON.stringify(g).slice(0, 160));
check("ít hơn 10 người → trả hết", (shapeLeaderboard(rows(4), false) as unknown[]).length === 4);
check("không có ai → mảng rỗng", (shapeLeaderboard([], false) as unknown[]).length === 0 && (shapeLeaderboard([], true) as unknown[]).length === 0);
check("tên rỗng / một từ cũng được che, không ném lỗi", (() => { const x = shapeLeaderboard([row(0, { name: "" }), row(1, { name: "Thọ" })], false) as GuestLeaderboardRow[]; return x[0].name === "***" && x[1].name === "T."; })());
check("không sửa mảng đầu vào (khách)", (() => { const src = rows(12); const before = JSON.stringify(src); shapeLeaderboard(src, false); return JSON.stringify(src) === before; })());

section("Người đã đăng nhập: như cũ (đủ tên, trường, userId; tối đa 20 dòng)");
const m = shapeLeaderboard(rows(30), true) as LeaderboardRow[];
check("giới hạn thành viên = 20", MEMBER_LEADERBOARD_LIMIT === 20 && m.length === 20, m.length);
check("tên đầy đủ, có trường, có userId", m[0].name === "Nguyễn Văn Em0" && m[0].school === "THPT Số 0, Hà Nội" && m[0].userId === "u0", m[0]);
check("khách thấy ít dòng hơn thành viên", g.length < m.length);

section("Bộ đệm có hạn dùng");
let t = 1_000;
const clock = () => t;
const c = makeTtlCache<number>(60_000, { max: 3, now: clock });
check("chưa có → undefined", c.get("a") === undefined);
c.set("a", 1);
check("vừa đặt → có", c.get("a") === 1);
t += 59_999; check("còn 1 ms thì còn", c.get("a") === 1);
t += 1;      check("ĐÚNG hạn (60 000 ms) là hết", c.get("a") === undefined);
check("mục hết hạn bị bỏ khỏi bộ nhớ khi đọc", c.size() === 0, c.size());

section("Bộ đệm: trần số khoá");
const d = makeTtlCache<number>(60_000, { max: 3, now: clock });
for (const k of ["k1", "k2", "k3"]) { d.set(k, 1); t += 10; }
check("đủ 3 khoá", d.size() === 3);
d.set("k4", 4);
check("thêm khoá thứ 4 → vẫn 3, bỏ khoá CŨ NHẤT (k1)", d.size() === 3 && d.get("k1") === undefined && d.get("k2") === 1 && d.get("k4") === 4, d.size());
t += 60_000;
d.set("k5", 5);
check("đầy mà có mục hết hạn → bỏ hết mục hết hạn trước, giữ mục mới", d.size() === 1 && d.get("k5") === 5, d.size());
const flood = makeTtlCache<number>(60_000, { max: 40, now: clock });
for (let i = 0; i < 5000; i++) flood.set(`lạ-${i}`, i);
check("5000 khoá lạ (vd. ?category=ngẫu nhiên) không làm bộ nhớ vượt trần 40", flood.size() === 40, flood.size());
const e = makeTtlCache<number>(60_000, { max: 2, now: clock });
e.set("x", 1); t += 10; e.set("y", 2); t += 10; e.set("x", 3);   // đặt lại x → x thành mới nhất
e.set("z", 4);
check("đặt lại một khoá làm nó thành mới nhất: thêm z thì bỏ y, giữ x", e.get("y") === undefined && e.get("x") === 3 && e.get("z") === 4);
e.clear(); check("clear() xoá hết", e.size() === 0);

section("Bộ đệm tắt (ttl ≤ 0)");
for (const off of [0, -1, Number.NaN]) {
  const o = makeTtlCache<number>(off, { now: clock });
  o.set("a", 1);
  check(`ttl=${off}: không lưu gì, get luôn undefined`, o.get("a") === undefined && o.size() === 0);
}

section("Số giây giữ đệm theo môi trường");
check("production, không đặt biến → 60 giây", leaderboardCacheMs({ NODE_ENV: "production" }) === 60_000);
check("dev / bài kiểm, không đặt biến → TẮT (0)", leaderboardCacheMs({ NODE_ENV: "development" }) === 0 && leaderboardCacheMs({}) === 0);
check("LEADERBOARD_CACHE_SECONDS=120 → 120 000 ms (kể cả ở dev)", leaderboardCacheMs({ LEADERBOARD_CACHE_SECONDS: "120", NODE_ENV: "development" }) === 120_000);
check("đặt 0 ở production → tắt", leaderboardCacheMs({ LEADERBOARD_CACHE_SECONDS: "0", NODE_ENV: "production" }) === 0);
check("trần 300 giây: đặt 9999 → 300 000", leaderboardCacheMs({ LEADERBOARD_CACHE_SECONDS: "9999" }) === 300_000);
check("giá trị rác ('abc', '-5', rỗng) → tắt hoặc theo mặc định, không NaN", leaderboardCacheMs({ LEADERBOARD_CACHE_SECONDS: "abc", NODE_ENV: "production" }) === 0 && leaderboardCacheMs({ LEADERBOARD_CACHE_SECONDS: "-5" }) === 0 && leaderboardCacheMs({ LEADERBOARD_CACHE_SECONDS: "  ", NODE_ENV: "production" }) === 60_000);

done();
