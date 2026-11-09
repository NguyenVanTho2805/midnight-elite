// HP-LOP-TRUONG — phần THUẦN của học phí theo bảng tháng (src/lib/hocPhiSheet.ts): công thức, bậc, kỳ thu, đọc lưới chữ, khớp học sinh, băm. Không cần máy chủ / DB.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-hp-sheet-lib.ts   (cũng chạy được với TZ=Asia/Ho_Chi_Minh)
import {
  INT32_MAX, SHEET_EXAMPLE_MARK, chargeLabel, compactSessions, computeSheetFee, currentPeriodId, hashSheet, matchRoster, parseCountCell, parseRowInput, parseSessionsInput,
  parseSheetGrid, parseVndCell, periodDateKey, periodInWindow, periodLabel, periodRange, sha256Hex, shiftYearMonth, stableStringify, textToGrid, tierRateFor,
  validatePeriodStartDay, validateSubjects, validateTiers, type FeeInput, type Tier,
} from "@/lib/hocPhiSheet";
import { vnDateKeyOf } from "@/lib/classSessions";
import { check, section, done } from "./h";

const T: Tier[] = [{ subjects: 1, rate: 70000 }, { subjects: 2, rate: 60000 }, { subjects: 3, rate: 55000 }, { subjects: 4, rate: 50000 }];
const SUBJ = ["Toán", "Sử", "Địa", "Anh"];
const fee = (o: Partial<FeeInput>, tiers: Tier[] = T) => computeSheetFee(tiers, { sessions: {}, subjectCount: null, freeSessions: 0, rateOverride: null, scholarship: 0, discount: 0, ...o });
const net = (o: Partial<FeeInput>) => { const r = fee(o); return r.ok ? r.value.net : `LỖI: ${r.error}`; };
const err = (o: Partial<FeeInput>, tiers: Tier[] = T) => { const r = fee(o, tiers); return r.ok ? "" : r.error; };

(async () => {
  section("SHA-256 thuần JS (không node:crypto) khớp vector chuẩn");
  check('sha256("") đúng', sha256Hex("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  check('sha256("abc") đúng', sha256Hex("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  check("sha256 chuỗi dài hơn một khối 64 byte + có dấu tiếng Việt khớp node:crypto", (() => {
    const s = "Học phí tháng 11/2026 · ".repeat(30);
    return sha256Hex(s) === require("node:crypto").createHash("sha256").update(s).digest("hex");
  })());

  section("computeSheetFee: 5 hàng ví dụ của đặc tả (mục 3.2)");
  const mai = fee({ sessions: { Toán: 8, Anh: 4 }, freeSessions: 1, scholarship: 50000 });
  check("Mai Anh: k đếm = 2, bậc 60.000, 11 buổi, gốc 660.000, Phải đóng 610.000, nguồn 'counted'", mai.ok && mai.value.subjectCount === 2 && mai.value.subjectCountSource === "counted" && mai.value.tierRate === 60000 && mai.value.unitRate === 60000
    && mai.value.billable === 11 && mai.value.gross === 660000 && mai.value.net === 610000, mai);
  check("Bảo Châu: 4 môn × 8 buổi, bậc 50.000, giảm trừ 100.000 → 1.500.000", net({ sessions: { Toán: 8, Sử: 8, Địa: 8, Anh: 8 }, discount: 100000 }) === 1500000);
  const kh = fee({ sessions: { Toán: 8 }, rateOverride: 45000 });
  check("Minh Khôi: đơn giá riêng 45.000 thắng bậc 70.000 → 360.000, rateSource 'student'", kh.ok && kh.value.net === 360000 && kh.value.unitRate === 45000 && kh.value.tierRate === 70000 && kh.value.rateSource === "student");
  const han = fee({ sessions: { Toán: 6, Sử: 6 }, subjectCount: 3 });
  check("Gia Hân: ghi tay 3 môn (học 2) → bậc 55.000, 12 buổi → 660.000, nguồn 'file'", han.ok && han.value.net === 660000 && han.value.subjectCount === 3 && han.value.subjectCountSource === "file" && han.value.tierRate === 55000);
  const kiet = fee({ sessions: { Anh: 4 }, scholarship: 300000 });
  check("Tuấn Kiệt: học bổng 300.000 > gốc 280.000 → Phải đóng 0 (sàn 0, không âm) + cảnh báo ZERO_NET", kiet.ok && kiet.value.net === 0 && kiet.value.gross === 280000 && kiet.value.warnings.some(w => w.code === "ZERO_NET"));
  check("tổng các dòng Phải đóng > 0 = 3.130.000", [610000, 1500000, 360000, 660000].reduce((a, b) => a + b) === 3130000);

  section("k: suy ra vs ghi tay; ràng buộc");
  check("k trống đếm đúng số môn có Sᵢ > 0 (môn 0 buổi không tính)", (() => { const r = fee({ sessions: { Toán: 3, Sử: 0, Địa: 2 } }); return r.ok && r.value.subjectCount === 2 && r.value.activeSubjects === 2; })());
  check("k ghi tay NHỎ hơn số môn có buổi → lỗi nêu cả hai số", err({ sessions: { Toán: 1, Sử: 1, Địa: 1 }, subjectCount: 2 }).includes("3 môn") && err({ sessions: { Toán: 1, Sử: 1, Địa: 1 }, subjectCount: 2 }).includes("2"));
  check("k ghi tay > 10 → lỗi; k = 10 ok", err({ sessions: { Toán: 1 }, subjectCount: 11 }) !== "" && fee({ sessions: { Toán: 1 }, subjectCount: 10 }).ok);
  check("k lớn hơn bậc cuối (5 môn, bảng tới 4) → dùng bậc cuối 50.000", (() => { const r = fee({ sessions: { Toán: 1 }, subjectCount: 5 }); return r.ok && r.value.tierRate === 50000; })());
  check("k = 0 mà có buổi → lỗi (qua ràng buộc k ≥ số môn có buổi)", err({ sessions: { Toán: 2 }, subjectCount: 0 }) !== "");
  check("không có buổi nào, k trống → 0 đồng, không lỗi (đơn giá hiển thị = bậc đầu)", (() => { const r = fee({}); return r.ok && r.value.net === 0 && r.value.tierRate === 70000 && r.value.subjectCount === 0; })());

  section("Buổi miễn phí, đơn giá riêng, học bổng / giảm trừ");
  check("miễn phí trừ vào TỔNG buổi (8 + 4 − 2 = 10 buổi × 60.000)", (() => { const r = fee({ sessions: { Toán: 8, Anh: 4 }, freeSessions: 2 }); return r.ok && r.value.billable === 10 && r.value.net === 600000; })());
  check("miễn = tổng buổi hợp lệ → 0 buổi tính tiền, 0đ", (() => { const r = fee({ sessions: { Toán: 4 }, freeSessions: 4 }); return r.ok && r.value.billable === 0 && r.value.net === 0; })());
  check("miễn > tổng → LỖI", err({ sessions: { Toán: 4 }, freeSessions: 5 }).includes("5") && err({ sessions: { Toán: 4 }, freeSessions: 5 }) !== "");
  check("miễn âm / không nguyên → lỗi", err({ sessions: { Toán: 4 }, freeSessions: -1 }) !== "" && err({ sessions: { Toán: 4 }, freeSessions: 1.5 }) !== "");
  check("đơn giá riêng 999 → lỗi; 1.000 ok; 0 → lỗi; 100.000.001 → lỗi", err({ sessions: { Toán: 1 }, rateOverride: 999 }) !== "" && fee({ sessions: { Toán: 1 }, rateOverride: 1000 }).ok
    && err({ sessions: { Toán: 1 }, rateOverride: 0 }).includes("Buổi miễn phí") && err({ sessions: { Toán: 1 }, rateOverride: 100_000_001 }) !== "");
  check("đơn giá riêng CAO hơn bậc → vẫn thắng + cảnh báo OVERRIDE_ABOVE_TIER", (() => { const r = fee({ sessions: { Toán: 2 }, rateOverride: 90000 }); return r.ok && r.value.unitRate === 90000 && r.value.net === 180000 && r.value.warnings.some(w => w.code === "OVERRIDE_ABOVE_TIER"); })());
  check("đơn giá riêng thấp hơn bậc → KHÔNG cảnh báo", (() => { const r = fee({ sessions: { Toán: 2 }, rateOverride: 40000 }); return r.ok && r.value.warnings.length === 0; })());
  check("HB + GT đúng bằng gốc → 0; lớn hơn → 0 (không âm); nhỏ hơn 1đ → còn 1đ", net({ sessions: { Toán: 2 }, scholarship: 100000, discount: 40000 }) === 0
    && net({ sessions: { Toán: 2 }, scholarship: 900000, discount: 900000 }) === 0 && net({ sessions: { Toán: 2 }, scholarship: 100000, discount: 39999 }) === 1);
  check("học bổng / giảm trừ âm, thập phân, hoặc > 1 tỷ → lỗi", err({ sessions: { Toán: 1 }, scholarship: -1 }) !== "" && err({ sessions: { Toán: 1 }, discount: 0.5 }) !== "" && err({ sessions: { Toán: 1 }, scholarship: 1_000_000_001 }) !== "");
  check("số buổi một môn > 60, âm, thập phân → lỗi; đúng 60 ok", err({ sessions: { Toán: 61 } }) !== "" && err({ sessions: { Toán: -1 } }) !== "" && err({ sessions: { Toán: 2.5 } }) !== "" && fee({ sessions: { Toán: 60 } }).ok);

  section("KHÔNG tràn Int 32-bit, không làm tròn");
  const big = { Toán: 60, Sử: 60, Địa: 60, Anh: 60, Lý: 60, Hoá: 60 };
  check("60 × 6 môn × 100.000.000đ = 3,6e10 vượt Int → LỖI rõ nêu giới hạn, không phải số tràn", (() => { const e = err({ sessions: big, rateOverride: 100_000_000 }); return e.includes("vượt giới hạn") && e.includes(INT32_MAX.toLocaleString("vi-VN")); })());
  check("21 buổi × 100.000.000 = 2,1e9 (< 2,147e9) hợp lệ, số nguyên", (() => { const r = fee({ sessions: { Toán: 21 }, rateOverride: 100_000_000 }); return r.ok && r.value.gross === 2_100_000_000 && Number.isInteger(r.value.net); })());
  check("22 buổi × 100.000.000 = 2,2e9 vượt Int → LỖI", err({ sessions: { Toán: 22 }, rateOverride: 100_000_000 }) !== "");
  check("đơn giá riêng vượt trần 100.000.000 bị chặn TRƯỚC khi nhân (không bao giờ tới phép nhân tràn)", err({ sessions: { Toán: 21 }, rateOverride: 102_261_126 }) !== "");
  check("bảng bậc rate lớn nhất 100.000.000 × 6 môn × 60 buổi, k = 6 → lỗi chứ không tràn", err({ sessions: big }, [{ subjects: 1, rate: 100_000_000 }]) !== "");
  check("mọi kết quả là số nguyên (không dấu phẩy động), kể cả với đơn giá lẻ 1.001", (() => { const r = fee({ sessions: { Toán: 7, Anh: 3 }, rateOverride: 1001 }); return r.ok && Number.isInteger(r.value.gross) && r.value.gross === 10010; })());
  check("bảng bậc rỗng → lỗi", err({ sessions: { Toán: 1 } }, []) !== "");

  section("tierRateFor: ranh giới");
  check("k đúng bằng bậc", tierRateFor(T, 1) === 70000 && tierRateFor(T, 2) === 60000 && tierRateFor(T, 4) === 50000);
  check("bảng 1,3 và k = 2 → bậc 1 (m lớn nhất ≤ k)", tierRateFor([{ subjects: 1, rate: 70000 }, { subjects: 3, rate: 55000 }], 2) === 70000);
  check("bảng một dòng: mọi k ≥ 1 cùng một giá; k = 0 → null; k vượt bậc cuối → bậc cuối", tierRateFor([{ subjects: 1, rate: 80000 }], 1) === 80000 && tierRateFor([{ subjects: 1, rate: 80000 }], 9) === 80000 && tierRateFor(T, 0) === null && tierRateFor(T, 99) === 50000);

  section("validateTiers / validateSubjects / validatePeriodStartDay: biên mọi ràng buộc");
  check("bảng hợp lệ, 8 bậc ok, 9 bậc lỗi, 0 bậc lỗi, không phải mảng lỗi", validateTiers(T).ok && validateTiers(Array.from({ length: 8 }, (_, i) => ({ subjects: i + 1, rate: 50000 }))).ok
    && !validateTiers(Array.from({ length: 9 }, (_, i) => ({ subjects: i + 1, rate: 50000 }))).ok && !validateTiers([]).ok && !validateTiers("x").ok && !validateTiers(null).ok);
  check("dòng đầu phải là 1 môn; số môn phải tăng NGHIÊM NGẶT", !validateTiers([{ subjects: 2, rate: 50000 }]).ok && !validateTiers([{ subjects: 1, rate: 50000 }, { subjects: 1, rate: 40000 }]).ok && !validateTiers([{ subjects: 1, rate: 50000 }, { subjects: 3, rate: 1 }, { subjects: 2, rate: 1000 }]).ok);
  check("đơn giá nguyên 1.000..100.000.000; 999, 100.000.001, 1,5, chữ, thiếu → lỗi", validateTiers([{ subjects: 1, rate: 1000 }]).ok && validateTiers([{ subjects: 1, rate: 100_000_000 }]).ok
    && !validateTiers([{ subjects: 1, rate: 999 }]).ok && !validateTiers([{ subjects: 1, rate: 100_000_001 }]).ok && !validateTiers([{ subjects: 1, rate: 1.5 }]).ok && !validateTiers([{ subjects: 1, rate: "70000" }]).ok && !validateTiers([{ subjects: 1 }]).ok);
  check("số môn của bậc phải là nguyên 1..10; 11 / 0 / 1,5 lỗi", validateTiers([{ subjects: 1, rate: 50000 }, { subjects: 10, rate: 40000 }]).ok && !validateTiers([{ subjects: 1, rate: 50000 }, { subjects: 11, rate: 40000 }]).ok);
  check("môn: 1..6 mục ok; 0, 7 lỗi; trùng sau bỏ dấu / hoa thường lỗi; rỗng / toàn dấu lỗi; > 40 ký tự lỗi; không phải chữ lỗi", validateSubjects(["Toán"]).ok && validateSubjects(["a", "b", "c", "d", "e", "f"]).ok
    && !validateSubjects([]).ok && !validateSubjects(["a", "b", "c", "d", "e", "f", "g"]).ok && !validateSubjects(["Toán", "toan"]).ok && !validateSubjects(["Toán", "TOÁN "]).ok
    && !validateSubjects(["   "]).ok && !validateSubjects(["!!!"]).ok && !validateSubjects(["x".repeat(41)]).ok && validateSubjects(["x".repeat(40)]).ok && !validateSubjects([1]).ok && !validateSubjects("Toán").ok);
  check("môn được làm sạch (khoảng trắng, ký tự điều khiển / NUL)", (() => { const r = validateSubjects(["  Toán\u0000  nâng   cao "]); return r.ok && r.value[0] === "Toán nâng cao"; })());
  check("periodStartDay: 1 và 28 ok; 0, 29, 1,5, '15', null lỗi", validatePeriodStartDay(1).ok && validatePeriodStartDay(28).ok && !validatePeriodStartDay(0).ok && !validatePeriodStartDay(29).ok
    && !validatePeriodStartDay(1.5).ok && !validatePeriodStartDay("15").ok && !validatePeriodStartDay(null).ok);

  section("Kỳ thu: currentPeriodId / periodRange / periodLabel / periodDateKey");
  check("start = 1: kỳ hiện tại = tháng của hôm nay (kể cả ngày 1 và ngày cuối tháng)", currentPeriodId("2026-11-01", 1) === "2026-11" && currentPeriodId("2026-11-30", 1) === "2026-11");
  check("start = 15: 15/11 đã sang kỳ '2026-11'; 14/11 vẫn kỳ '2026-10'", currentPeriodId("2026-11-15", 15) === "2026-11" && currentPeriodId("2026-11-14", 15) === "2026-10" && currentPeriodId("2026-11-30", 15) === "2026-11");
  check("qua năm: 05/01/2027 với start 15 → kỳ '2026-12'; 15/01/2027 → '2027-01'", currentPeriodId("2027-01-05", 15) === "2026-12" && currentPeriodId("2027-01-15", 15) === "2027-01");
  check("start = 28 và tháng 2 (28/02 có, 27/02 chưa)", currentPeriodId("2027-02-28", 28) === "2027-02" && currentPeriodId("2027-02-27", 28) === "2027-01");
  check("ngày không tồn tại → ném lỗi (không đoán)", (() => { try { currentPeriodId("2026-02-30", 1); return false; } catch { return true; } })());
  check("periodRange start 1: cả tháng dương lịch, kể cả tháng 2 năm nhuận / không nhuận", (() => {
    const a = periodRange("2026-11", 1), b = periodRange("2028-02", 1), c = periodRange("2027-02", 1);
    return a.from === "2026-11-01" && a.to === "2026-11-30" && b.to === "2028-02-29" && c.to === "2027-02-28";
  })());
  check("periodRange start 15: 15/11 → 14/12; qua năm 15/12 → 14/01", (() => {
    const a = periodRange("2026-11", 15), b = periodRange("2026-12", 15);
    return a.from === "2026-11-15" && a.to === "2026-12-14" && b.from === "2026-12-15" && b.to === "2027-01-14";
  })());
  check("periodRange start 28: 28/01 → 27/02", (() => { const a = periodRange("2027-01", 28); return a.from === "2027-01-28" && a.to === "2027-02-27"; })());
  check("nhãn: start 1 'tháng 11/2026'; start 15 'kỳ 11/2026 (15/11 – 14/12)'", periodLabel("2026-11", 1) === "tháng 11/2026" && periodLabel("2026-11", 15) === "kỳ 11/2026 (15/11 – 14/12)" && periodRange("2026-11", 15).label === "kỳ 11/2026 (15/11 – 14/12)");
  check("dateKey dòng phí = <ym>-<DD bắt đầu>", periodDateKey("2026-11", 1) === "2026-11-01" && periodDateKey("2026-11", 15) === "2026-11-15" && periodDateKey("2026-11", 5) === "2026-11-05");
  check("shiftYearMonth qua năm hai chiều", shiftYearMonth("2026-12", 1) === "2027-01" && shiftYearMonth("2027-01", -1) === "2026-12" && shiftYearMonth("2026-11", -12) === "2025-11" && shiftYearMonth("2026-11", 14) === "2028-01");
  check("cửa sổ kỳ ±12: đúng 12 ok, 13 lỗi (hai phía)", periodInWindow("2027-11", "2026-11") && !periodInWindow("2027-12", "2026-11") && periodInWindow("2025-11", "2026-11") && !periodInWindow("2025-10", "2026-11"));
  check("giờ VN, không phải UTC: 14/11 23:59 VN (16:59Z) còn kỳ tháng 10; 15/11 00:00 VN (17:00Z ngày 14) sang kỳ tháng 11 (start 15)", (() => {
    const before = vnDateKeyOf(new Date("2026-11-14T16:59:00Z")), after = vnDateKeyOf(new Date("2026-11-14T17:00:00Z"));
    return before === "2026-11-14" && after === "2026-11-15" && currentPeriodId(before, 15) === "2026-10" && currentPeriodId(after, 15) === "2026-11";
  })());
  check("nhãn dòng phí: 'Học phí 11/2026 · 2 môn · 11 buổi' (+ đuôi khi có trừ); kỳ khác tháng ghi 'kỳ'", chargeLabel("2026-11", 1, 2, 11, false) === "Học phí 11/2026 · 2 môn · 11 buổi"
    && chargeLabel("2026-11", 1, 2, 11, true) === "Học phí 11/2026 · 2 môn · 11 buổi · đã trừ học bổng/giảm trừ" && chargeLabel("2026-11", 15, 2, 11, false).startsWith("Học phí kỳ 11/2026"));

  section("parseVndCell / parseCountCell");
  const vnd = (s: string) => { const r = parseVndCell(s); return r.ok ? r.value : "LỖI"; };
  check("70000 / 70.000 / 70,000 / 70 000 đều = 70000; nhiều cụm 1.250.000 / 1,250,000 / 1 250 000", vnd("70000") === 70000 && vnd("70.000") === 70000 && vnd("70,000") === 70000 && vnd("70 000") === 70000
    && vnd("1.250.000") === 1250000 && vnd("1,250,000") === 1250000 && vnd("1 250 000") === 1250000);
  check("khoảng trắng không ngắt (NBSP) trong số cũng đọc được", vnd("70 000") === 70000 && vnd("  70000  ") === 70000);
  check("ô trống → null (không phải 0, không lỗi)", vnd("") === null && vnd("   ") === null);
  check("70k, 1tr, 70.5, 1,5, -5, +5, abc, =1+1, @SUM, 70.00, 7.0000, 70.000.00, 70,000.000 đều LỖI",
    ["70k", "1tr", "70.5", "1,5", "-5", "+5", "abc", "=1+1", "@SUM(A1)", "70.00", "7.0000", "70.000.00", "70,000.000", "70đ", "1e5", "0x10"].every(s => vnd(s) === "LỖI"));
  check("số quá lớn (13 chữ số) → lỗi", vnd("1234567890123") === "LỖI");
  check("thông điệp lỗi ô công thức nói rõ KiN không chạy công thức", (() => { const r = parseVndCell("=HYPERLINK(\"http://x\",\"a\")"); return !r.ok && r.error.includes("công thức"); })());
  const cnt = (s: string, m = 60) => { const r = parseCountCell(s, m); return r.ok ? r.value : "LỖI"; };
  check("số buổi: '8' → 8, '' → null, '0' → 0, '60' ok, '61' lỗi, '-1', '1.5', '8 buổi', '1e1' lỗi", cnt("8") === 8 && cnt("") === null && cnt("0") === 0 && cnt("60") === 60 && cnt("61") === "LỖI" && ["-1", "1.5", "8 buổi", "1e1", "1,5"].every(s => cnt(s) === "LỖI"));

  section("parseSheetGrid: tiêu đề, cột, dòng");
  const hdr = ["Mã em (đừng sửa)", "Họ tên", "Số môn", ...SUBJ, "Buổi miễn phí", "Đơn giá riêng", "Học bổng", "Giảm trừ", "Ghi chú"];
  const row = (o: Record<string, string>) => hdr.map(h => o[h] ?? "");
  const p1 = parseSheetGrid([hdr, row({ "Mã em (đừng sửa)": "abc123", "Họ tên": "Mai Anh", "Toán": "8", "Anh": "4", "Buổi miễn phí": "1", "Học bổng": "50.000" })], SUBJ);
  check("bảng mẫu đọc đủ cột; dòng 2 đúng dữ liệu; không lỗi", p1.fatal === null && p1.rows.length === 1 && p1.rows[0].line === 2 && p1.rows[0].code === "abc123" && p1.rows[0].name === "Mai Anh"
    && p1.rows[0].sessions.Toán === 8 && p1.rows[0].sessions.Anh === 4 && p1.rows[0].freeSessions === 1 && p1.rows[0].scholarship === 50000 && p1.rows[0].errors.length === 0, p1);
  check("báo cột đã nhận (kể cả nhãn chuẩn của 'Mã em (đừng sửa)') và môn thiếu cột", p1.columns.matched.includes("Mã em") && p1.columns.matched.includes("Toán") && p1.columns.missingSubjects.length === 0
    && parseSheetGrid([["Họ tên", "Toán"], ["A", "1"]], SUBJ).columns.missingSubjects.join() === "Sử,Địa,Anh");
  check("tiêu đề không dấu, hoa thường, thừa khoảng trắng: '  HO  TEN ', 'toan', 'MON  ANH' không có thì ... ", (() => {
    const r = parseSheetGrid([["  HO  TEN ", " toan ", "ANH", "hoc bong", "MIEN PHI"], ["An", "3", "2", "10000", "1"]], SUBJ);
    return r.fatal === null && r.rows[0].name === "An" && r.rows[0].sessions.Toán === 3 && r.rows[0].sessions.Anh === 2 && r.rows[0].scholarship === 10000 && r.rows[0].freeSessions === 1;
  })());
  check("hàng ví dụ (SHEET_EXAMPLE_MARK) bị BỎ QUA và BÁO số dòng thật", (() => {
    const r = parseSheetGrid([hdr, row({ "Mã em (đừng sửa)": `${SHEET_EXAMPLE_MARK} Mai Anh` }), row({ "Họ tên": "Bé Hai", "Toán": "2" })], SUBJ);
    return r.rows.length === 1 && r.rows[0].name === "Bé Hai" && r.exampleLines.join() === "2" && r.rows[0].line === 3;
  })());
  check("cột LẠ có dữ liệu → 'blocking' + fatal nêu tên cột, không ghi gì (không bỏ âm thầm cột Hoá)", (() => {
    const r = parseSheetGrid([["Họ tên", "Toán", "Hoá"], ["A", "1", "4"]], SUBJ);
    return r.fatal !== null && r.fatal.includes("Hoá") && r.columns.blocking.join() === "Hoá" && r.rows.length === 0;
  })());
  check("cột lạ TRỐNG hoàn toàn → 'ignored', không lỗi", (() => {
    const r = parseSheetGrid([["Họ tên", "Toán", "Cột lạ", ""], ["A", "1", "", ""]], SUBJ);
    return r.fatal === null && r.columns.ignored.join() === "Cột lạ" && r.columns.blocking.length === 0;
  })());
  check("cột không tên (tiêu đề trống) nhưng có dữ liệu → blocking 'Cột N'", (() => { const r = parseSheetGrid([["Họ tên", "Toán", ""], ["A", "1", "x"]], SUBJ); return r.fatal !== null && r.columns.blocking.join() === "Cột 3"; })());
  check("tệp 301 dòng dữ liệu → TỪ CHỐI CẢ TỆP (0 dòng), nêu 301 và 300; đúng 300 → nhận hết", (() => {
    const mk = (n: number) => [["Họ tên", "Toán"], ...Array.from({ length: n }, (_, i) => [`Em ${i}`, "1"])];
    const a = parseSheetGrid(mk(301), SUBJ), b = parseSheetGrid(mk(300), SUBJ);
    return a.fatal !== null && a.fatal.includes("301") && a.fatal.includes("300") && a.rows.length === 0 && b.fatal === null && b.rows.length === 300;
  })());
  check("hàng ví dụ và dòng trống KHÔNG tính vào giới hạn 300", (() => {
    const g = [["Họ tên", "Toán"], [`${SHEET_EXAMPLE_MARK} x`, ""], ...Array.from({ length: 300 }, (_, i) => [`Em ${i}`, "1"]), ["", ""], ["", ""]];
    return parseSheetGrid(g, SUBJ).fatal === null;
  })());
  check("số dòng báo là số dòng THẬT trong tệp (kể cả dòng trống xen giữa)", (() => {
    const r = parseSheetGrid([["", ""], ["Họ tên", "Toán"], ["A", "1"], ["", ""], ["", ""], ["B", "xx"]], SUBJ);
    return r.rows[0].line === 3 && r.rows[1].line === 6 && r.rows[1].errors[0].startsWith("Dòng 6, cột “Toán”");
  })());
  check("ô số sai: 70k ở Học bổng, -5 ở Toán, 1,5 ở Số môn → lỗi dòng nêu số dòng + tên cột", (() => {
    const r = parseSheetGrid([["Họ tên", "Số môn", "Toán", "Học bổng"], ["A", "1,5", "-5", "70k"]], SUBJ);
    const e = r.rows[0].errors.join(" | ");
    return r.rows[0].errors.length === 3 && e.includes("Dòng 2, cột “Số môn”") && e.includes("cột “Toán”") && e.includes("cột “Học bổng”");
  })());
  check("ô công thức: =1+1 và =HYPERLINK(...) trong cột số → lỗi 'chữ'; trong cột Họ tên / Ghi chú giữ NGUYÊN CHỮ (không chạy)", (() => {
    const r = parseSheetGrid([["Họ tên", "Toán", "Ghi chú"], ["=HYPERLINK(\"http://x\",\"a\")", "=1+1", "@cmd|' /C calc'!A0"]], SUBJ);
    return r.rows[0].name.startsWith("=HYPERLINK") && r.rows[0].note?.startsWith("@cmd") === true && r.rows[0].errors.length === 1 && r.rows[0].errors[0].includes("công thức");
  })());
  check("họ tên > 200 ký tự → lỗi (không lưu); ký tự NUL / chữ vô hình bị làm sạch; ghi chú > 300 → lỗi", (() => {
    const r = parseSheetGrid([["Họ tên", "Ghi chú"], ["A".repeat(1001), ""], ["Mai\u0000​Anh", ""], ["B", "x".repeat(301)]], SUBJ);
    return r.rows[0].errors.length === 1 && r.rows[0].name.length <= 40 && r.rows[1].name === "Mai Anh" && r.rows[1].errors.length === 0 && r.rows[2].errors.length === 1;
  })());
  check("dòng không có họ tên lẫn mã → lỗi 'thiếu'", parseSheetGrid([["Họ tên", "Toán"], ["", "3"]], SUBJ).rows[0].errors[0].includes("thiếu"));
  check("không có cột Họ tên lẫn Mã em → fatal; chỉ có Mã em thì ok", parseSheetGrid([["Toán", "Sử"], ["1", "2"]], SUBJ).fatal !== null && parseSheetGrid([["Mã em", "Toán"], ["x", "1"]], SUBJ).fatal === null);
  check("tệp trống / chỉ tiêu đề → fatal", parseSheetGrid([], SUBJ).fatal !== null && parseSheetGrid([["", ""], ["", ""]], SUBJ).fatal !== null && parseSheetGrid([["Họ tên", "Toán"]], SUBJ).fatal !== null);
  check("hơn 40 cột có chữ → từ chối cả tệp", (() => { const wide = Array.from({ length: 41 }, (_, i) => (i === 0 ? "Họ tên" : `c${i}`)); return parseSheetGrid([wide, wide.map(() => "x")], SUBJ).fatal?.includes("40 cột") === true; })());
  check("cột trùng (hai cột Toán): cột sau bị coi lạ, có dữ liệu → blocking", (() => { const r = parseSheetGrid([["Họ tên", "Toán", "Toán"], ["A", "1", "2"]], SUBJ); return r.fatal !== null && r.columns.blocking.length === 1; })());
  check("ô số buổi trống = 0 (không có khoá trong sessions)", (() => { const r = parseSheetGrid([["Họ tên", "Toán", "Sử"], ["A", "", "3"]], SUBJ); return r.rows[0].sessions.Toán === undefined && r.rows[0].sessions.Sử === 3; })());
  check("'Số môn' trống → subjectCount null (đếm); có số → số đó", (() => { const r = parseSheetGrid([["Họ tên", "Số môn", "Toán"], ["A", "", "1"], ["B", "3", "1"]], SUBJ); return r.rows[0].subjectCount === null && r.rows[1].subjectCount === 3; })());

  section("textToGrid: dán từ Google Sheet (TAB), CSV, BOM, ngoặc kép");
  check("TSV dán từ Google Sheet tách đúng cột, kể cả số 70,000 có dấu phẩy", (() => { const g = textToGrid("Họ tên\tToán\tHọc bổng\nMai Anh\t8\t70,000\n"); return g[1][2] === "70,000" && g[0].length === 3; })());
  check("CSV có ngoặc kép chứa dấu phẩy; BOM đầu tệp; CRLF", (() => { const g = textToGrid("﻿Họ tên,Ghi chú\r\n\"Nguyễn, Văn A\",\"ok\"\r\n"); return g[0][0] === "Họ tên" && g[1][0] === "Nguyễn, Văn A"; })());
  check("dòng trống xen giữa GIỮ chỗ (số dòng thật)", (() => { const g = textToGrid("Họ tên\tToán\n\nA\t1"); return g.length === 3 && parseSheetGrid(g, SUBJ).rows[0].line === 3; })());
  check("dán nguyên → parseSheetGrid → số tiền đúng đầu-cuối", (() => { const r = parseSheetGrid(textToGrid("Họ tên\tToán\tAnh\tBuổi miễn phí\tHọc bổng\nMai Anh\t8\t4\t1\t50.000"), SUBJ); const f = computeSheetFee(T, { sessions: r.rows[0].sessions, subjectCount: r.rows[0].subjectCount, freeSessions: r.rows[0].freeSessions, rateOverride: r.rows[0].rateOverride, scholarship: r.rows[0].scholarship, discount: r.rows[0].discount }); return f.ok && f.value.net === 610000; })());

  section("matchRoster");
  const roster = [{ studentId: "u-mai-1", name: "Mai Anh", joinedAt: "2026-09-01" }, { studentId: "u-chau-2", name: "Bảo Châu" }, { studentId: "u-khoi-3", name: "Minh Khôi" }, { studentId: "u-khoi-4", name: "Minh Khôi", joinedAt: "2026-10-05" }];
  check("mã đúng → matched theo mã (mã thắng tên)", (() => { const m = matchRoster({ code: "u-chau-2", name: "Tên khác hẳn" }, roster); return m.status === "matched" && m.studentId === "u-chau-2" && m.matchedBy === "code"; })());
  check("mã lạ → unmatched (KHÔNG quay sang khớp tên, kể cả khi tên khớp)", matchRoster({ code: "u-lạ", name: "Mai Anh" }, roster).status === "unmatched");
  check("mã của em KHÔNG active (không có trong roster) → unmatched", matchRoster({ code: "u-nghi-9", name: "" }, roster).status === "unmatched");
  check("tên khác dấu / hoa thường / khoảng trắng → khớp: 'MAI  anh', 'mai anh', 'Mai-Anh'", ["MAI  anh", "mai anh", " Mai Anh ", "Mai-Anh"].every(n => { const m = matchRoster({ code: null, name: n }, roster); return m.status === "matched" && m.studentId === "u-mai-1" && m.matchedBy === "name"; }));
  check("'Bao Chau' (không dấu) khớp 'Bảo Châu'", (() => { const m = matchRoster({ code: null, name: "Bao Chau" }, roster); return m.status === "matched" && m.studentId === "u-chau-2"; })());
  check("trùng tên không mã → ambiguous, kèm ứng viên: tên, ngày vào lớp, 4 ký tự cuối mã (không tự chọn)", (() => {
    const m = matchRoster({ code: null, name: "minh khoi" }, roster);
    return m.status === "ambiguous" && m.candidates.length === 2 && m.candidates[0].tail === "oi-3" && m.candidates[1].joinedAt === "2026-10-05";
  })());
  check("trùng tên NHƯNG có mã → khớp đúng người đó", (() => { const m = matchRoster({ code: "u-khoi-4", name: "Minh Khôi" }, roster); return m.status === "matched" && m.studentId === "u-khoi-4"; })());
  check("tên không có / tên trống / tên toàn dấu → unmatched (không đoán gần đúng: 'Mai An' ≠ 'Mai Anh')", ["Ai Đó", "", "!!!", "Mai An"].every(n => matchRoster({ code: null, name: n }, roster).status === "unmatched"));
  check("roster rỗng (lớp chưa có em) → unmatched", matchRoster({ code: null, name: "Mai Anh" }, []).status === "unmatched");

  section("parseRowInput / parseSessionsInput (sửa tay một em)");
  check("đầu vào đủ → ok; vắng trường → mặc định 0 / null", (() => { const r = parseRowInput({ sessions: { toan: 8, "ANH": 4 }, freeSessions: 1, scholarship: 50000 }, SUBJ); return r.ok && r.value.sessions.Toán === 8 && r.value.sessions.Anh === 4 && r.value.subjectCount === null && r.value.rateOverride === null && r.value.discount === 0; })());
  check("khoá môn lạ → lỗi (không bỏ âm thầm); môn ghi hai lần ('Toán' và 'toan') → lỗi", !parseSessionsInput({ Hoá: 3 }, SUBJ).ok && !parseSessionsInput({ "Toán": 1, toan: 2 }, SUBJ).ok);
  check("sai kiểu: sessions mảng / chuỗi, số là chuỗi '8', thập phân, null body → lỗi, không ném", !parseSessionsInput([1], SUBJ).ok && !parseSessionsInput("x", SUBJ).ok && !parseSessionsInput({ Toán: "8" }, SUBJ).ok && !parseSessionsInput({ Toán: 1.5 }, SUBJ).ok
    && !parseRowInput(null, SUBJ).ok && !parseRowInput([], SUBJ).ok && !parseRowInput({ sessions: {}, freeSessions: "1" }, SUBJ).ok && !parseRowInput({ sessions: {}, rateOverride: 1.5 }, SUBJ).ok);
  check("ghi chú: làm sạch; > 300 ký tự lỗi; không phải chữ lỗi", (() => { const a = parseRowInput({ sessions: {}, note: "  hay  quên\u0000 " }, SUBJ); return a.ok && a.value.note === "hay quên" && !parseRowInput({ sessions: {}, note: "x".repeat(301) }, SUBJ).ok && !parseRowInput({ sessions: {}, note: 5 }, SUBJ).ok; })());
  check("compactSessions bỏ môn 0 buổi, sắp khoá ổn định", JSON.stringify(compactSessions({ Sử: 0, Toán: 8, Anh: 4 })) === JSON.stringify({ Anh: 4, Toán: 8 }));

  section("hashSheet");
  check("ổn định khi đổi thứ tự khoá JSON; mảng giữ thứ tự", hashSheet({ a: 1, b: { c: 2, d: [1, 2] } }) === hashSheet({ b: { d: [1, 2], c: 2 }, a: 1 }) && hashSheet([1, 2]) !== hashSheet([2, 1]));
  check("đổi MỘT ô (hoặc kỳ) → băm đổi", (() => { const g = [["Họ tên", "Toán"], ["A", "8"]]; const g2 = [["Họ tên", "Toán"], ["A", "9"]]; return hashSheet({ ym: "2026-11", g }) !== hashSheet({ ym: "2026-11", g: g2 }) && hashSheet({ ym: "2026-11", g }) !== hashSheet({ ym: "2026-12", g }); })());
  check("dạng 'sha256:' + 64 hex; undefined bị bỏ như khoá vắng", /^sha256:[0-9a-f]{64}$/.test(hashSheet({})) && stableStringify({ a: 1, b: undefined }) === stableStringify({ a: 1 }));

  await done();
})();
