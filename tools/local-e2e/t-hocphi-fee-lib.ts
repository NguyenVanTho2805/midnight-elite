// HP-14..HP-17 — bài THUẦN cho src/lib/tuitionFee.ts (kiểu tính học phí mới) + bằng chứng "số cũ không đổi" ở tầng thuần.
// Có ca phá cố ý. Không DB, không mạng.
import {
  FEE_MODE_LEGACY, FEE_RATE_MAX, FEE_RATE_MIN, composeFinalAmount, groupChargeLines, hourlyAmount, isChargeableStatus, isNewFeeMode, normalizeFeeMode,
  pickClassRate, pickStudentRate, planReprice, sessionFee, courseFee, validateEffectiveFrom, validateFeeSetup,
  type ChargeLite, type ClassRate, type StudentRate,
} from "@/lib/tuitionFee";
import { computeMonthlyFee } from "@/lib/tuition";
import { check, section, done } from "./h";

(async () => {
section("Hình thức học phí: mặc định an toàn");
check("không có / lạ / null → cách cũ (monthly_sessions)", normalizeFeeMode(undefined) === FEE_MODE_LEGACY && normalizeFeeMode(null) === FEE_MODE_LEGACY && normalizeFeeMode("per_week") === FEE_MODE_LEGACY && normalizeFeeMode("") === FEE_MODE_LEGACY);
check("3 kiểu mới nhận ra", isNewFeeMode("per_session") && isNewFeeMode("per_hour") && isNewFeeMode("per_course") && !isNewFeeMode("monthly_sessions") && !isNewFeeMode(5));

section("validateFeeSetup");
check("theo buổi 150.000 hợp lệ", (() => { const r = validateFeeSetup({ mode: "per_session", rate: 150_000 }); return r.ok && r.value.sessionMinutes === null; })());
check("theo giờ cần số phút: 90 phút hợp lệ", (() => { const r = validateFeeSetup({ mode: "per_hour", rate: 200_000, sessionMinutes: 90 }); return r.ok && r.value.sessionMinutes === 90; })());
check("[phá] theo giờ thiếu phút → lỗi", !validateFeeSetup({ mode: "per_hour", rate: 200_000 }).ok);
check("[phá] phút ngoài 15–480 → lỗi", !validateFeeSetup({ mode: "per_hour", rate: 200_000, sessionMinutes: 10 }).ok && !validateFeeSetup({ mode: "per_hour", rate: 200_000, sessionMinutes: 600 }).ok);
check("[phá] đơn giá lẻ / âm / quá nhỏ / quá lớn / chữ → lỗi", [100.5, -1, 0, FEE_RATE_MIN - 1, FEE_RATE_MAX + 1, "150000", NaN, Infinity].every(rate => !validateFeeSetup({ mode: "per_session", rate }).ok));
check("[phá] hình thức cách cũ không qua validateFeeSetup (không có đơn giá)", !validateFeeSetup({ mode: "monthly_sessions", rate: 150_000 }).ok);
check("ngày hiệu lực: hợp lệ / không có thật / sai dạng", validateEffectiveFrom("2026-10-23").ok && !validateEffectiveFrom("2026-02-30").ok && !validateEffectiveFrom("23/10/2026").ok && !validateEffectiveFrom(undefined).ok);

section("Làm tròn theo giờ (số nguyên, nửa lên)");
check("150.000đ/giờ × 90 phút = 225.000 (chẵn)", hourlyAmount(150_000, 90) === 225_000);
check("100.000đ/giờ × 50 phút = 83.333 (lẻ xuống)", hourlyAmount(100_000, 50) === 83_333);
check("100.000đ/giờ × 40 phút = 66.667 (lẻ lên)", hourlyAmount(100_000, 40) === 66_667);
check("nửa đồng làm tròn LÊN: 1.001đ/giờ × 30 phút = 500,5 → 501", hourlyAmount(1_001, 30) === 501);
check("ngưỡng lớn không mất chính xác: 100.000.000đ/giờ × 480 phút", hourlyAmount(100_000_000, 480) === 800_000_000);
check("mọi kết quả là số nguyên", [[123_457, 37], [99_999, 59], [1_000, 15], [77_777, 481]].every(([r, m]) => Number.isInteger(hourlyAmount(r, m))));

section("Chọn đơn giá theo ngày");
const cr: ClassRate[] = [{ rate: 150_000, sessionMinutes: null, effectiveFrom: "2026-09-01" }, { rate: 180_000, sessionMinutes: null, effectiveFrom: "2026-11-01" }];
check("trước mốc đầu → dùng mốc đầu (điểm danh bù vẫn có giá)", pickClassRate(cr, "2026-08-15")?.rate === 150_000);
check("giữa hai mốc → mốc trước", pickClassRate(cr, "2026-10-31")?.rate === 150_000);
check("đúng ngày mốc sau → mốc sau", pickClassRate(cr, "2026-11-01")?.rate === 180_000);
check("danh sách xáo trộn vẫn chọn đúng", pickClassRate([cr[1], cr[0]], "2026-12-01")?.rate === 180_000);
check("không có đơn giá → null", pickClassRate([], "2026-10-01") === null);
const sr: StudentRate[] = [{ rate: 100_000, effectiveFrom: "2026-10-10" }];
check("đơn giá riêng KHÔNG áp trước ngày hiệu lực (khác đơn giá lớp)", pickStudentRate(sr, "2026-10-09") === null && pickStudentRate(sr, "2026-10-10")?.rate === 100_000);

section("sessionFee / courseFee");
const base = { classRates: cr, studentRates: [] as StudentRate[] };
check("theo buổi 10/2026 = 150.000, nguồn lớp", (() => { const f = sessionFee({ ...base, mode: "per_session", dateKey: "2026-10-05" }); return !!f && f.amount === 150_000 && f.rateSource === "class" && f.units === null; })());
check("đơn giá mới từ 1/11 chỉ áp từ 1/11", sessionFee({ ...base, mode: "per_session", dateKey: "2026-11-01" })?.amount === 180_000 && sessionFee({ ...base, mode: "per_session", dateKey: "2026-10-31" })?.amount === 150_000);
check("đơn giá riêng của em thắng đơn giá lớp, ghi nguồn 'student'", (() => { const f = sessionFee({ mode: "per_session", classRates: cr, studentRates: sr, dateKey: "2026-10-12" }); return f?.amount === 100_000 && f.rateSource === "student"; })());
const hr: ClassRate[] = [{ rate: 150_000, sessionMinutes: 90, effectiveFrom: "2026-09-01" }];
check("theo giờ: 90 phút × 150.000/giờ = 225.000 kèm số phút", (() => { const f = sessionFee({ mode: "per_hour", classRates: hr, studentRates: [], dateKey: "2026-10-05" }); return f?.amount === 225_000 && f.units === 90; })());
check("theo giờ + đơn giá riêng 100.000/giờ → 150.000", sessionFee({ mode: "per_hour", classRates: hr, studentRates: [{ rate: 100_000, effectiveFrom: "2026-09-01" }], dateKey: "2026-10-05" })?.amount === 150_000);
check("[phá] lớp theo giờ thiếu phút → null (không đoán)", sessionFee({ mode: "per_hour", classRates: [{ rate: 150_000, sessionMinutes: null, effectiveFrom: "2026-09-01" }], studentRates: [], dateKey: "2026-10-05" }) === null);
check("[phá] lớp cách cũ KHÔNG sinh phí theo buổi", sessionFee({ ...base, mode: "monthly_sessions", dateKey: "2026-10-05" }) === null);
check("[phá] lớp theo khoá không sinh phí theo buổi; theo buổi không sinh phí khoá", sessionFee({ ...base, mode: "per_course", dateKey: "2026-10-05" }) === null && courseFee({ ...base, mode: "per_session", dateKey: "2026-10-05" }) === null);
check("theo khoá: một khoản = đơn giá (đơn giá riêng thắng)", courseFee({ mode: "per_course", classRates: [{ rate: 3_000_000, sessionMinutes: null, effectiveFrom: "2026-09-01" }], studentRates: [{ rate: 2_500_000, effectiveFrom: "2026-09-01" }], dateKey: "2026-10-05" })?.amount === 2_500_000);
check("[phá] chưa có đơn giá nào → null", sessionFee({ mode: "per_session", classRates: [], studentRates: [], dateKey: "2026-10-05" }) === null);

section("Buổi nào tính phí (một chỗ duy nhất)");
check("có mặt / muộn tính; có phép / vắng / khác không tính", isChargeableStatus("present") && isChargeableStatus("late") && !isChargeableStatus("excused") && !isChargeableStatus("absent") && !isChargeableStatus("") && !isChargeableStatus("PRESENT"));

section("planReprice: xem trước = áp dụng, phiếu đã chốt không đổi");
const mk = (id: string, studentId: string, dateKey: string, amount: number, invoiceId: string | null = null, kind = "session"): ChargeLite => ({ id, studentId, dateKey, amount, kind, invoiceId });
const charges = [
  mk("c1", "A", "2026-10-05", 150_000, "inv1"),       // đã vào phiếu → đóng băng
  mk("c2", "A", "2026-10-20", 150_000),               // chưa vào phiếu, >= mốc
  mk("c3", "B", "2026-10-21", 150_000),
  mk("c4", "B", "2026-09-28", 150_000),               // trước mốc → không đổi
  mk("c5", "A", "2026-10-25", 150_000, null, "extra"), // không phải buổi → bỏ qua
  mk("c6", "B", "2026-10-22", 180_000),               // đã đúng giá mới → không tính là đổi
];
const newRates: ClassRate[] = [...cr.slice(0, 1), { rate: 180_000, sessionMinutes: null, effectiveFrom: "2026-10-15" }];
const plan = planReprice({ mode: "per_session", fromDateKey: "2026-10-15", charges, next: { classRates: newRates, studentRatesOf: () => [] } });
check("2 dòng đổi (c2, c3): 300.000 → 360.000, +60.000", plan.changedCount === 2 && plan.beforeTotal === 300_000 && plan.afterTotal === 360_000 && plan.delta === 60_000, plan);
check("dòng đã vào phiếu (c1 ở trước mốc nên không đếm; thử mốc 1/10 để đếm)", planReprice({ mode: "per_session", fromDateKey: "2026-10-01", charges, next: { classRates: newRates, studentRatesOf: () => [] } }).frozenCount === 1);
check("[phá] KHÔNG BAO GIỜ có c1 (đã vào phiếu) trong danh sách cập nhật", !planReprice({ mode: "per_session", fromDateKey: "2026-01-01", charges, next: { classRates: [{ rate: 1_000_000, sessionMinutes: null, effectiveFrom: "2026-01-01" }], studentRatesOf: () => [] } }).updates.some(u => u.id === "c1"));
check("dòng 'extra' và dòng trước mốc không bị đụng", !plan.updates.some(u => u.id === "c5" || u.id === "c4"));
check("mỗi dòng cập nhật = đúng sessionFee của bộ giá mới (nguồn số duy nhất)", plan.updates.every(u => u.to === sessionFee({ mode: "per_session", classRates: newRates, studentRates: [], dateKey: u.dateKey })!.amount));
check("đơn giá RIÊNG của em A: dòng của A theo giá riêng (nguồn 'student'), dòng của B vẫn theo giá lớp", (() => {
  const p = planReprice({ mode: "per_session", fromDateKey: "2026-10-15", charges, next: { classRates: newRates, studentRatesOf: id => (id === "A" ? [{ rate: 90_000, effectiveFrom: "2026-10-15" }] : []) } });
  const a = p.updates.filter(u => u.studentId === "A"), b = p.updates.filter(u => u.studentId === "B");
  return a.length === 1 && a[0].to === 90_000 && a[0].rateSource === "student" && b.every(u => u.rateSource === "class" && u.to === 180_000);
})());
check("chỉ truyền dòng của A (như đổi giá riêng một em): chỉ A đổi", (() => {
  const p = planReprice({ mode: "per_session", fromDateKey: "2026-10-15", charges: charges.filter(c => c.studentId === "A"), next: { classRates: cr, studentRatesOf: () => [{ rate: 90_000, effectiveFrom: "2026-10-15" }] } });
  return p.updates.length === 1 && p.updates[0].studentId === "A" && p.updates[0].to === 90_000;
})());
check("thiếu đơn giá → dòng 'không tính lại được', giữ nguyên", planReprice({ mode: "per_session", fromDateKey: "2026-10-01", charges, next: { classRates: [], studentRatesOf: () => [] } }).unresolvedCount === 3);

section("Dòng phí trên phiếu");
const rows = [
  { courseId: "c1", courseName: "Toán 9", kind: "session", label: null, amount: 150_000, units: null, rate: 150_000, mode: "per_session" },
  { courseId: "c1", courseName: "Toán 9", kind: "session", label: null, amount: 150_000, units: null, rate: 150_000, mode: "per_session" },
  { courseId: "c1", courseName: "Toán 9", kind: "session", label: null, amount: 180_000, units: null, rate: 180_000, mode: "per_session" },
  { courseId: "c2", courseName: "Lý 9", kind: "session", label: null, amount: 225_000, units: 90, rate: 150_000, mode: "per_hour" },
  { courseId: "c3", courseName: "Hoá 9", kind: "course", label: null, amount: 3_000_000, units: null, rate: 3_000_000, mode: "per_course" },
];
const lines = groupChargeLines(rows);
check("tổng các dòng = tổng các khoản (không làm tròn lại)", lines.reduce((s, l) => s + l.amount, 0) === rows.reduce((s, r) => s + r.amount, 0));
check("đổi đơn giá giữa tháng → tách thành 2 dòng theo giá", lines.filter(l => l.courseId === "c1").length === 2 && lines.some(l => l.description === "2 buổi × 150.000đ") && lines.some(l => l.description === "1 buổi × 180.000đ"), lines);
check("theo giờ: ghi rõ phút và đơn giá giờ", lines.some(l => l.description === "1 buổi × 90 phút × 150.000đ/giờ"));
check("theo khoá: 'Học phí cả khoá'", lines.some(l => l.courseId === "c3" && l.description === "Học phí cả khoá"));

section("SỐ CŨ KHÔNG ĐỔI: cách cũ + composeFinalAmount(…, 0)");
check("chargesTotal = 0 → trả ĐÚNG finalAmount của computeMonthlyFee, không tính lại (cả khi đầu vào lệch)", composeFinalAmount({ gross: 999, scholarship: 1, discount: 1, finalAmount: 12_345 }, 0) === 12_345);
let seed = 20261023; const rnd = (n: number) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
let diffs = 0, cases = 0;
for (let i = 0; i < 3000; i++) {
  const nSub = 1 + rnd(5);
  const subjects = Array.from({ length: nSub }, (_, k) => { const sc = rnd(31); return { courseId: `c${k}`, courseName: `M${k}`, sessionCount: sc, freeCount: rnd(sc + 1) }; });
  const override = rnd(4) === 0 ? 30_000 + rnd(50) * 1_000 : null;
  const b = computeMonthlyFee({ subjects, override, scholarship: rnd(3) === 0 ? rnd(2_000_000) : 0, discount: rnd(3) === 0 ? rnd(500_000) : 0 });
  const independent = Math.max(0, b.perSubject.reduce((s, x) => s + x.billable * b.pricePerSession, 0) - b.scholarship - b.discount); // công thức gốc viết lại độc lập
  cases++;
  if (composeFinalAmount(b, 0) !== independent) diffs++;
}
check(`${cases} phiếu cách cũ ngẫu nhiên: lệch 0 đồng so với công thức gốc`, diffs === 0, { diffs });
check("có dòng phí mới: cộng vào gốc rồi trừ học bổng/giảm trừ, sàn 0", composeFinalAmount({ gross: 560_000, scholarship: 60_000, discount: 0, finalAmount: 500_000 }, 450_000) === 950_000 && composeFinalAmount({ gross: 0, scholarship: 900_000, discount: 0, finalAmount: 0 }, 450_000) === 0);

await done();
})();
