// BU-03 P2 — HỢP ĐỒNG cho BU-04: pickVariantFor / pickVariantNo (src/lib/deThiVariantPick.ts). THUẦN, không DB.
import { check, section, done } from "./h";
import { pickVariantFor, pickVariantNo } from "@/lib/deThiVariantPick";

(async () => {
section("Ổn định");
check("cùng (đề, học sinh, n) → luôn cùng mã", Array.from({ length: 50 }, () => pickVariantFor("exam1", "stu1", 4)).every((v, _i, a) => v === a[0]));
check("giá trị trong 0..n-1; pickVariantNo = chỉ số + 1 (1..n)", (() => { for (let n = 2; n <= 8; n++) for (let u = 0; u < 40; u++) { const v = pickVariantFor("e", `u${u}`, n), no = pickVariantNo("e", `u${u}`, n); if (v < 0 || v >= n || no !== v + 1) return false; } return true; })());
check("n ≤ 1, n lẻ/âm/NaN → 0 (đề một mã), không ném", [1, 0, -3, 2.5, NaN, Infinity].every(n => pickVariantFor("e", "u", n) === 0) && pickVariantNo("e", "u", 1) === 1);
section("Phân bố");
const counts = Array(4).fill(0);
for (let u = 0; u < 4000; u++) counts[pickVariantFor("examA", `student-${u}`, 4)]++;
check("4000 học sinh, 4 mã: mỗi mã 800–1200 (đều, không lệch)", counts.every(c => c > 800 && c < 1200), counts);
check("PHÁ: không phải luôn mã đầu", new Set(Array.from({ length: 60 }, (_, u) => pickVariantFor("examA", `s${u}`, 4))).size === 4);
check("cùng học sinh, đề khác → có thể khác mã (không dính cứng một mã)", new Set(Array.from({ length: 40 }, (_, e) => pickVariantFor(`exam${e}`, "stuX", 4))).size > 1);
check("đổi n thì phép chia thay đổi nhưng vẫn ổn định (n=3 và n=5)", pickVariantFor("e", "u", 3) === pickVariantFor("e", "u", 3) && pickVariantFor("e", "u", 5) === pickVariantFor("e", "u", 5));
check("PHÁ: ghép chuỗi không nhập nhằng — (ab, c) khác (a, bc) về băm", (() => { let diff = 0; for (let i = 0; i < 30; i++) if (pickVariantFor(`ab${i}`, "c", 8) !== pickVariantFor(`a`, `b${i}c`, 8)) diff++; return diff > 0; })());
await done();
})();
