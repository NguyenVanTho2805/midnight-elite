// NC2-050 — src/lib/admissionFormula.ts: kiểm công thức tính điểm do quản trị nhập + tính điểm. PHÁ CỐ Ý: công thức vượt thang, môn trùng tên, số âm / quá lớn / quá nhiều
// chữ số thập phân, công khai mà không nguồn, nguồn nguy hiểm (javascript:, tên đăng nhập trong URL), điểm nhập sai (rỗng, chữ, âm, lớn hơn tối đa), kiểu dữ liệu sai.
import { parseFormulaInput, computeScore, maxBase, describeFormula, FORMULA_DISCLAIMER, FORMULA_MAX_INPUTS, FORMULA_MAX_BONUSES, type FormulaValue } from "@/lib/admissionFormula";
import { check, section, done } from "./h";

const NOW = new Date("2026-10-28T00:00:00Z");
const A00 = {
  name: "Khối A00 — Toán nhân đôi", school: "Trường mẫu", year: 2026, scale: 30, multiplier: "0,75",
  inputs: [{ label: "Toán", max: 10, weight: 2 }, { label: "Lý", max: 10, weight: 1 }, { label: "Hoá", max: 10, weight: 1 }],
  bonuses: [{ label: "Điểm ưu tiên", max: 2.75 }], sourceUrl: "https://example.edu.vn/thong-bao-tuyen-sinh", published: true,
};
const ok = (o: unknown) => parseFormulaInput(o, NOW);
const val = (o: unknown): FormulaValue => { const r = ok(o); if (!r.ok) throw new Error(r.error); return r.value; };

section("Công thức hợp lệ");
const f = ok(A00);
check("nhận công thức Toán ×2 + Lý + Hoá, hệ số nhân 0,75, thang 30, 1 khoản ưu tiên", f.ok && f.value.inputs.length === 3 && f.value.multiplier === 0.75 && f.value.scale === 30 && f.value.bonuses.length === 1 && f.value.published, f);
check("khoá môn / điểm cộng do máy sinh (m1…, b1…), không tin khoá từ ngoài", f.ok && f.value.inputs.map(i => i.key).join() === "m1,m2,m3" && f.value.bonuses[0].key === "b1");
check("điểm tối đa theo công thức = (2×10+10+10)×0,75 = 30", maxBase(val(A00)) === 30);
check("câu mô tả: (Toán × 2 + Lý + Hoá) × 0,75 + Điểm ưu tiên", describeFormula(val(A00)) === "(Toán × 2 + Lý + Hoá) × 0,75 + Điểm ưu tiên", describeFormula(val(A00)));
check("bản nháp (published=false) không cần nguồn; sourceName để trống khi không có link", (() => { const r = ok({ ...A00, published: false, sourceUrl: "" }); return r.ok && r.value.sourceUrl === "" && r.value.sourceName === "" && !r.value.published; })());
check("sourceName tự lấy tên miền khi bỏ trống", (() => { const r = ok(A00); return r.ok && r.value.sourceName === "example.edu.vn"; })());
check("hệ số nhân bỏ trống = 1; hệ số môn bỏ trống = 1; không điểm cộng", (() => { const r = ok({ name: "Tổng 3 môn", scale: 30, inputs: [{ label: "Toán", max: 10 }, { label: "Văn", max: 10 }, { label: "Anh", max: 10 }] }); return r.ok && r.value.multiplier === 1 && r.value.inputs.every(i => i.weight === 1) && r.value.bonuses.length === 0; })());

section("PHÁ CỐ Ý — công thức sai phải bị từ chối, có lý do tiếng Việt");
const bad = (name: string, o: unknown, re: RegExp) => { const r = ok(o); check(`${name} → từ chối`, !r.ok && re.test(r.error), r); };
bad("không phải đối tượng", "x", /không hợp lệ/);
bad("mảng", [A00], /không hợp lệ/);
bad("thiếu tên", { ...A00, name: " " }, /tên công thức/i);
bad("tên toàn ký tự tàng hình (zero-width, BOM) = thiếu tên", { ...A00, name: "​‍﻿" }, /tên công thức/i);
bad("tên 101 ký tự", { ...A00, name: "a".repeat(101) }, /100/);
bad("thang 0", { ...A00, scale: 0 }, /thang/i);
bad("thang 30,5 (không nguyên)", { ...A00, scale: "30,5" }, /thang/i);
bad("năm 1999", { ...A00, year: 1999 }, /Năm/);
bad("hệ số nhân 0", { ...A00, multiplier: 0 }, /Hệ số nhân/);
bad("hệ số nhân âm", { ...A00, multiplier: -1 }, /Hệ số nhân/);
bad("hệ số nhân 5 chữ số thập phân", { ...A00, multiplier: 0.12345 }, /4 chữ số/);
bad("không có môn nào", { ...A00, inputs: [] }, /ít nhất một môn/);
bad("quá nhiều môn", { ...A00, inputs: Array.from({ length: FORMULA_MAX_INPUTS + 1 }, (_, i) => ({ label: `M${i}`, max: 1 })) }, /Tối đa 8/);
bad("môn không phải đối tượng", { ...A00, inputs: [7] }, /không hợp lệ/);
bad("môn chưa có tên", { ...A00, inputs: [{ label: "", max: 10 }] }, /chưa có tên/);
bad("hai môn trùng tên (khác hoa thường)", { ...A00, inputs: [{ label: "Toán", max: 10 }, { label: "TOÁN", max: 10 }] }, /trùng/);
bad("môn trùng tên với điểm cộng", { ...A00, bonuses: [{ label: "Toán", max: 1 }] }, /trùng/);
bad("điểm tối đa của môn = 0", { ...A00, inputs: [{ label: "Toán", max: 0 }] }, /lớn hơn 0/);
bad("điểm tối đa của môn âm", { ...A00, inputs: [{ label: "Toán", max: -10 }] }, /lớn hơn 0/);
bad("điểm tối đa 1001", { ...A00, inputs: [{ label: "Toán", max: 1001 }], scale: 2000 }, /không quá 1000/);
bad("hệ số môn 11", { ...A00, inputs: [{ label: "Toán", max: 10, weight: 11 }] }, /Hệ số của/);
bad("hệ số môn chữ", { ...A00, inputs: [{ label: "Toán", max: 10, weight: "hai" }] }, /Hệ số của/);
bad("nhiều điểm cộng hơn cho phép", { ...A00, bonuses: Array.from({ length: FORMULA_MAX_BONUSES + 1 }, (_, i) => ({ label: `B${i}`, max: 1 })) }, /Tối đa 4/);
bad("điểm cộng không phải mảng", { ...A00, bonuses: "ưu tiên" }, /điểm cộng/i);
bad("VƯỢT THANG: Toán ×2 mà quên hệ số nhân (tối đa 40 > thang 30)", { ...A00, multiplier: 1 }, /vượt thang 30/);
bad("công khai mà không có nguồn", { ...A00, sourceUrl: "" }, /nguồn/);
bad("nguồn javascript:", { ...A00, sourceUrl: "javascript:alert(1)" }, /Đường dẫn nguồn/);
bad("nguồn giả tên miền bằng user@", { ...A00, sourceUrl: "https://trusted.vn@evil.example/x" }, /Đường dẫn nguồn/);
bad("nguồn ftp", { ...A00, sourceUrl: "ftp://x.example/a" }, /Đường dẫn nguồn/);
bad("published là chữ lạ", { ...A00, published: "có" }, /đúng hoặc sai/);
bad("ghi chú 401 ký tự", { ...A00, note: "n".repeat(401) }, /400/);

section("Tính điểm");
const F = val(A00);
const calc = (v: Record<string, string | number | undefined>) => computeScore(F, v);
let r = calc({ m1: "8,5", m2: "7,25", m3: 9 });
check("Toán 8,5 ×2 + Lý 7,25 + Hoá 9 = 33,25 × 0,75 = 24,94 (làm tròn 2 chữ số)", r.ok && r.score === 24.94 && r.raw === 24.94 && !r.capped, r);
check("kèm các dòng giải thích từng bước (để người dùng tự kiểm)", r.ok && r.lines[0] === "Toán: 8,5 × 2 = 17" && r.lines.some(l => l.startsWith("Tổng có hệ số: 33,25 × 0,75")), r);
r = calc({ m1: "8,5", m2: "7,25", m3: 9, b1: "0,5" });
check("có điểm ưu tiên 0,5 → 25,44 và dòng '+0,5' trong lời giải", r.ok && r.score === 25.44 && r.lines.includes("Điểm ưu tiên: +0,5"), r);
r = calc({ m1: 10, m2: 10, m3: 10, b1: 2.75 });
check("tối đa môn + ưu tiên vượt thang → kẹp ở 30, capped=true, raw giữ 32,75", r.ok && r.score === 30 && r.raw === 32.75 && r.capped, r);
r = calc({ m1: 0, m2: 0, m3: 0 });
check("toàn 0 điểm → 0", r.ok && r.score === 0, r);
check("dấu chấm hoặc phẩy thập phân đều được ('7.5' = '7,5')", (() => { const a = calc({ m1: "7.5", m2: "7,5", m3: "7.5" }), b = calc({ m1: "7,5", m2: "7.5", m3: "7,5" }); return a.ok && b.ok && a.score === b.score; })());
check("không đổi giá trị đầu vào", (() => { const v = { m1: "8,5", m2: "7", m3: "9" }; calc(v); return v.m1 === "8,5" && v.m2 === "7" && v.m3 === "9"; })());

section("PHÁ CỐ Ý — điểm nhập sai: báo lỗi TỪNG Ô, không đoán số");
const errs = (v: Record<string, string | number | undefined | null>) => { const x = computeScore(F, v); return x.ok ? null : x.errors; };
check("bỏ trống một môn → lỗi đúng ô đó ('Chưa nhập điểm Lý')", errs({ m1: 8, m2: "", m3: 9 })?.m2 === "Chưa nhập điểm Lý" && Object.keys(errs({ m1: 8, m2: "", m3: 9 }) ?? {}).length === 1);
check("thiếu hết → lỗi cả ba môn", Object.keys(errs({}) ?? {}).join() === "m1,m2,m3");
check("chữ thay số → 'phải là số'", /phải là số/.test(errs({ m1: "tám", m2: 7, m3: 9 })?.m1 ?? ""));
check("điểm âm → 'phải từ 0 đến 10'", errs({ m1: -1, m2: 7, m3: 9 })?.m1 === "Điểm Toán phải từ 0 đến 10" && errs({ m1: "-1", m2: 7, m3: 9 })?.m1 !== undefined);
check("điểm lớn hơn tối đa (11) → lỗi", errs({ m1: 11, m2: 7, m3: 9 })?.m1 === "Điểm Toán phải từ 0 đến 10");
check("quá 2 chữ số thập phân → lỗi", /2 chữ số/.test(errs({ m1: "8,555", m2: 7, m3: 9 })?.m1 ?? ""));
check("điểm cộng vượt mức tối đa (3 > 2,75) → lỗi ở b1; điểm cộng bỏ trống thì hợp lệ", errs({ m1: 8, m2: 7, m3: 9, b1: 3 })?.b1 === "Điểm Điểm ưu tiên phải từ 0 đến 2,75" && errs({ m1: 8, m2: 7, m3: 9, b1: "" }) === null);
check("NaN / Infinity → lỗi, không ra điểm", errs({ m1: NaN, m2: 7, m3: 9 })?.m1 !== undefined && errs({ m1: Infinity, m2: 7, m3: 9 })?.m1 !== undefined);

section("Chữ tham khảo");
check("câu lưu ý nói 'chỉ mang tính tham khảo', dẫn nguồn, nhắc đối chiếu thông báo chính thức; không có 'đã xác minh' / 'đúng luật'", /chỉ mang tính tham khảo/.test(FORMULA_DISCLAIMER) && /đối chiếu với thông báo chính thức/.test(FORMULA_DISCLAIMER) && !/đã xác minh|đúng luật|chính xác tuyệt đối/i.test(FORMULA_DISCLAIMER));
done();
