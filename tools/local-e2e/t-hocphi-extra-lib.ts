// HP-18/HP-24/HP-32 — bài THUẦN: giảm giá phần trăm, kiểm phí khác. Có ca phá cố ý. Không DB.
import { composeFinalAmount, percentAmount, validateDiscountPercent, validateExtraFee, EXTRA_LABEL_MAX, EXTRA_AMOUNT_MIN, EXTRA_AMOUNT_MAX } from "@/lib/tuitionFee";
import { computeMonthlyFee } from "@/lib/tuition";
import { check, section, done } from "./h";

(async () => {
section("percentAmount: số nguyên, nửa lên");
check("10% của 560.000 = 56.000", percentAmount(560_000, 10) === 56_000);
check("33% của 100.000 = 33.000", percentAmount(100_000, 33) === 33_000);
check("15% của 1.003 = 150,45 → 150; 15% của 1.010 = 151,5 → 152 (nửa lên)", percentAmount(1_003, 15) === 150 && percentAmount(1_010, 15) === 152);
check("0% = 0, 100% = toàn bộ", percentAmount(777_777, 0) === 0 && percentAmount(777_777, 100) === 777_777);
check("mọi kết quả nguyên và không vượt tổng", [[1, 50], [999_999, 7], [123_457, 99]].every(([s, p]) => Number.isInteger(percentAmount(s, p)) && percentAmount(s, p) <= s));

section("composeFinalAmount có giảm %");
const legacy = { gross: 560_000, scholarship: 0, discount: 0, finalAmount: 560_000 };
check("không phí mới, không giảm % → đúng finalAmount cũ", composeFinalAmount(legacy, 0, 0) === 560_000);
check("giảm 10% trên 560.000 → 504.000", composeFinalAmount(legacy, 0, 10) === 504_000);
check("giảm 10% tính trên (gốc cũ + phí mới): (560.000 + 300.000) × 90% = 774.000", composeFinalAmount(legacy, 300_000, 10) === 774_000);
check("giảm % rồi mới trừ học bổng/giảm trừ, sàn 0", composeFinalAmount({ ...legacy, scholarship: 100_000, discount: 4_000 }, 0, 10) === 400_000 && composeFinalAmount({ ...legacy, scholarship: 900_000 }, 0, 10) === 0);
check("100% → 0", composeFinalAmount(legacy, 0, 100) === 0);
let seed = 99, diffs = 0, n = 0;
const rnd = (m: number) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % m; };
for (let i = 0; i < 3000; i++) {
  const subjects = Array.from({ length: 1 + rnd(4) }, (_, k) => { const sc = rnd(25); return { courseId: `c${k}`, courseName: `M${k}`, sessionCount: sc, freeCount: rnd(sc + 1) }; });
  const b = computeMonthlyFee({ subjects, override: rnd(4) === 0 ? 45_000 : null, scholarship: rnd(3) === 0 ? rnd(300_000) : 0, discount: rnd(3) === 0 ? rnd(100_000) : 0 });
  n++; if (composeFinalAmount(b, 0, 0) !== b.finalAmount) diffs++;
}
check(`${n} phiếu cũ ngẫu nhiên, không phí mới, không giảm %: lệch 0 đồng`, diffs === 0, { diffs });

section("Kiểm giảm giá %");
check("0..100 nguyên hợp lệ", [0, 1, 50, 100].every(p => validateDiscountPercent(p).ok));
check("[phá] -1, 101, 5.5, '10', NaN bị từ chối", [-1, 101, 5.5, "10", NaN, null].every(p => !validateDiscountPercent(p).ok));

section("Kiểm phí khác");
check("hợp lệ: tên được cắt khoảng trắng thừa", (() => { const r = validateExtraFee({ label: "  Tài liệu   học kỳ 1 ", amount: 150_000 }); return r.ok && r.label === "Tài liệu học kỳ 1" && r.amount === 150_000; })());
check("[phá] thiếu tên / tên quá dài / số tiền lẻ, âm, quá nhỏ, quá lớn, chữ", !validateExtraFee({ label: " ", amount: 150_000 }).ok && !validateExtraFee({ label: "x".repeat(EXTRA_LABEL_MAX + 1), amount: 150_000 }).ok
  && [1000.5, -5, EXTRA_AMOUNT_MIN - 1, EXTRA_AMOUNT_MAX + 1, "150000", undefined].every(amount => !validateExtraFee({ label: "ok", amount }).ok));
await done();
})();
