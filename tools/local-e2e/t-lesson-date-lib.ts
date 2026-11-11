// LOI-02 (11/11/2026) — ngày giờ học của bài (src/lib/tutorLessonDate.ts). THUẦN: không DB, không mạng.
// Chạy ở CẢ HAI múi giờ (lỗi lệch ngày chỉ lộ ở một múi — README 23/10):
//   source tools/local-e2e/env.sh && TZ=UTC npx tsx tools/local-e2e/t-lesson-date-lib.ts && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-lesson-date-lib.ts
// Ca phá cố ý (thử phá mã → ca đỏ → trả lại):
//   - parseVnDateTime dùng `new Date(`${d}T${t}`)` (giờ máy) thay cho instantOf → ca 19:00 VN = 12:00Z đỏ dưới TZ=UTC;
//   - bỏ isValidDateKey trong parseScheduledAtInput → ca "2026-02-30T…Z" đỏ (V8 cuộn sang 02/03);
//   - nới ISO_RE cho múi giờ tuỳ chọn → ca "2026-11-13T12:00" (không múi) đỏ;
//   - formatVnLessonWhen dùng getDay() của máy → ca 00:30 VN (= 17:30Z hôm trước) đỏ dưới TZ=UTC.
import { parseVnDateTime, isoToVnParts, formatVnLessonWhen, parseScheduledAtInput } from "@/lib/tutorLessonDate";
import { lichOpenFrom, isLichOpen } from "@/lib/tutorFlags";
import { check, section, done } from "./h";

console.log(`TZ = ${process.env.TZ ?? "(máy)"} · offset máy = ${new Date().getTimezoneOffset()} phút`);
const iso = (r: ReturnType<typeof parseVnDateTime>) => (r.ok ? r.iso : `ERR:${r.error}`);

section("parseVnDateTime — ô ngày + ô giờ (giờ VN) → ISO UTC");
check('"2026-11-13" + "19:00" → 2026-11-13T12:00:00.000Z', iso(parseVnDateTime("2026-11-13", "19:00")) === "2026-11-13T12:00:00.000Z", iso(parseVnDateTime("2026-11-13", "19:00")));
check("00:30 VN → ngày UTC HÔM TRƯỚC 17:30Z", iso(parseVnDateTime("2026-11-13", "00:30")) === "2026-11-12T17:30:00.000Z", iso(parseVnDateTime("2026-11-13", "00:30")));
check("23:30 VN → 16:30Z cùng ngày", iso(parseVnDateTime("2026-11-13", "23:30")) === "2026-11-13T16:30:00.000Z");
check("00:00 VN ngày 01/01/2027 → 2026-12-31T17:00Z (qua năm)", iso(parseVnDateTime("2027-01-01", "00:00")) === "2026-12-31T17:00:00.000Z");
check("29/02 năm nhuận 2028 nhận", iso(parseVnDateTime("2028-02-29", "07:15")) === "2028-02-29T00:15:00.000Z");
check("cả hai rỗng → { ok:true, iso:null } (bài không gắn ngày)", (() => { const r = parseVnDateTime("", ""); return r.ok && r.iso === null; })());
check("khoảng trắng hai đầu được bỏ; chỉ khoảng trắng = rỗng", iso(parseVnDateTime(" 2026-11-13 ", " 19:00 ")) === "2026-11-13T12:00:00.000Z" && (() => { const r = parseVnDateTime("  ", " "); return r.ok && r.iso === null; })());
check("biên năm: 2020 và 2099 nhận", iso(parseVnDateTime("2020-01-01", "08:00")).startsWith("2020-01-01T01:00") && iso(parseVnDateTime("2099-12-31", "08:00")).startsWith("2099-12-31T01:00"));

section("parseVnDateTime — ca phá");
const err = (d: string, t: string) => { const r = parseVnDateTime(d, t); return r.ok ? null : r.error; };
check('chỉ có ngày → "Chọn giờ học."', err("2026-11-13", "") === "Chọn giờ học.", err("2026-11-13", ""));
check('chỉ có giờ → "Chọn ngày học."', err("", "19:00") === "Chọn ngày học.", err("", "19:00"));
for (const [d, t, why] of [
  ["2026-02-30", "19:00", "ngày không có thật 30/02"], ["2027-02-29", "19:00", "29/02 năm thường"], ["2026-13-01", "19:00", "tháng 13"], ["2026-00-10", "19:00", "tháng 0"],
  ["2026-11-31", "19:00", "31/11"], ["2026-11-13", "24:00", "24:00"], ["2026-11-13", "7:5", "7:5"], ["2026-11-13", "19:60", "19:60"], ["2026-11-13", "19:00:00", "có giây"],
  ["2026-11-13", "-1:00", "âm"], ["1999-12-31", "19:00", "năm 1999"], ["2100-01-01", "19:00", "năm 2100"], ["13/11/2026", "19:00", "dd/mm/yyyy"], ["2026-1-5", "19:00", "không đủ 2 chữ số"],
  ["abc", "19:00", "rác"], ["2026-11-13T19:00", "19:00", "dán cả ISO vào ô ngày"],
] as const) check(`phá: ${why} (${d} ${t}) → lỗi có chữ`, typeof err(d, t) === "string" && (err(d, t) ?? "").length > 3, parseVnDateTime(d, t));

section("isoToVnParts — ISO → ô ngày + ô giờ (giờ VN)");
check('"2026-11-13T12:00:00.000Z" → 2026-11-13 / 19:00', JSON.stringify(isoToVnParts("2026-11-13T12:00:00.000Z")) === JSON.stringify({ date: "2026-11-13", time: "19:00" }), isoToVnParts("2026-11-13T12:00:00.000Z"));
check('"2026-11-12T17:30:00Z" → 2026-11-13 / 00:30 (ngày VN, không phải ngày UTC)', JSON.stringify(isoToVnParts("2026-11-12T17:30:00Z")) === JSON.stringify({ date: "2026-11-13", time: "00:30" }));
check('chuỗi có múi "+07:00" đọc đúng', JSON.stringify(isoToVnParts("2026-11-13T19:00:00+07:00")) === JSON.stringify({ date: "2026-11-13", time: "19:00" }));
check("null / undefined / '' / rác → rỗng cả hai", [null, undefined, "", "abc", "2026-99-99T00:00:00Z"].every(v => { const p = isoToVnParts(v as string | null | undefined); return p.date === "" && p.time === ""; }));

section("tròn vòng: parseVnDateTime(isoToVnParts(x)) === x — 50 thời điểm ngẫu nhiên đúng phút");
{
  let seed = 20261111;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const from = Date.UTC(2020, 0, 1, 0, 0) - 7 * 3600_000, to = Date.UTC(2099, 11, 31, 23, 59) - 7 * 3600_000;
  const xs = Array.from({ length: 50 }, () => new Date(Math.floor((from + rnd() * (to - from)) / 60_000) * 60_000).toISOString());
  xs.push("2026-11-12T17:00:00.000Z", "2026-11-13T16:59:00.000Z", "2019-12-31T17:00:00.000Z"); // 00:00 VN, 23:59 VN, 00:00 VN 01/01/2020
  const bad = xs.filter(x => { const p = isoToVnParts(x); const r = parseVnDateTime(p.date, p.time); return !r.ok || r.iso !== x; });
  check(`${xs.length} thời điểm tròn vòng không lệch`, bad.length === 0, bad.slice(0, 3).map(x => [x, isoToVnParts(x), parseVnDateTime(isoToVnParts(x).date, isoToVnParts(x).time)]));
}

section("formatVnLessonWhen — chip ngày trên cây");
const NOW = new Date("2026-11-11T03:00:00Z"); // 10:00 thứ Tư 11/11/2026 giờ VN
const W = (d: string) => formatVnLessonWhen(parseVnDateTime(d, "19:00").ok ? (parseVnDateTime(d, "19:00") as { iso: string }).iso : null, NOW);
check('T6 13/11 · 19:00 (cùng năm: không ghi năm)', formatVnLessonWhen("2026-11-13T12:00:00.000Z", NOW) === "T6 13/11 · 19:00", formatVnLessonWhen("2026-11-13T12:00:00.000Z", NOW));
check("đủ 7 thứ: CN 15/11 · T2 16/11 · … · T7 21/11", ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"].map(W).join(" | ")
  === "CN 15/11 · 19:00 | T2 16/11 · 19:00 | T3 17/11 · 19:00 | T4 18/11 · 19:00 | T5 19/11 · 19:00 | T6 20/11 · 19:00 | T7 21/11 · 19:00", ["2026-11-15", "2026-11-16", "2026-11-21"].map(W));
check("khác năm VN của `now` → thêm /năm", formatVnLessonWhen("2027-01-08T12:00:00.000Z", NOW) === "T6 08/01/2027 · 19:00" && formatVnLessonWhen("2025-12-30T12:00:00.000Z", NOW) === "T3 30/12/2025 · 19:00", [formatVnLessonWhen("2027-01-08T12:00:00.000Z", NOW), formatVnLessonWhen("2025-12-30T12:00:00.000Z", NOW)]);
check("00:30 VN thứ Sáu 13/11 (= 17:30Z thứ Năm 12/11) → 'T6 13/11 · 00:30' (thứ + ngày theo VN)", formatVnLessonWhen("2026-11-12T17:30:00.000Z", NOW) === "T6 13/11 · 00:30", formatVnLessonWhen("2026-11-12T17:30:00.000Z", NOW));
check("năm theo giờ VN: 31/12/2026 23:30 VN vẫn là 2026 (cùng năm với now) dù now là 01/01/2027 00:10 VN thì khác năm", formatVnLessonWhen("2026-12-31T16:30:00.000Z", NOW) === "T5 31/12 · 23:30" && formatVnLessonWhen("2026-12-31T16:30:00.000Z", new Date("2026-12-31T17:10:00Z")) === "T5 31/12/2026 · 23:30");
check("phá: null / undefined / '' / rác → null", [null, undefined, "", "abc", "2026-13-40T00:00:00Z"].every(v => formatVnLessonWhen(v as string | null | undefined, NOW) === null));
check("không truyền now → vẫn ra chuỗi (đọc đồng hồ thật)", typeof formatVnLessonWhen("2026-11-13T12:00:00.000Z") === "string");

section("parseScheduledAtInput — máy chủ đọc body.scheduledAt");
const P = (v: unknown) => { const r = parseScheduledAtInput(v); return r.ok ? (r.value === undefined ? "undefined" : r.value === null ? "null" : r.value.toISOString()) : "ERR"; };
check("vắng (undefined) → { ok, value: undefined } (không đổi cột)", P(undefined) === "undefined");
check("null → null (xoá ngày)", P(null) === "null");
check('"2026-11-13T12:00:00Z" → Date đúng', P("2026-11-13T12:00:00Z") === "2026-11-13T12:00:00.000Z");
check('"2026-11-13T12:00:00.000Z" (đúng dạng toISOString) → Date đúng', P("2026-11-13T12:00:00.000Z") === "2026-11-13T12:00:00.000Z");
check('"2026-11-13T19:00:00+07:00" → 12:00Z', P("2026-11-13T19:00:00+07:00") === "2026-11-13T12:00:00.000Z", P("2026-11-13T19:00:00+07:00"));
check('"2026-11-13T19:00+07:00" (không giây) → 12:00Z', P("2026-11-13T19:00+07:00") === "2026-11-13T12:00:00.000Z");
check('"-05:00" cũng nhận (múi giờ tường minh)', P("2026-11-13T07:00:00-05:00") === "2026-11-13T12:00:00.000Z");
check("Date hợp lệ → Date (bản sao)", P(new Date("2026-11-13T12:00:00Z")) === "2026-11-13T12:00:00.000Z");
for (const [v, why] of [
  ["", "chuỗi rỗng"], ["abc", "rác"], [123, "số"], [1763035200000, "số mili giây"], [[], "mảng"], [["2026-11-13T12:00:00Z"], "mảng chứa ISO"], [{}, "đối tượng"], [true, "boolean"],
  ["2026-11-13", "chỉ ngày, không giờ"], ["2026-11-13T12:00", "không múi giờ"], ["2026-11-13T12:00:00", "có giây, không múi"], ["2026-11-13 12:00:00Z", "khoảng trắng thay T"],
  ["2026-02-30T12:00:00Z", "30/02 (V8 tự cuộn)"], ["2026-11-31T12:00:00Z", "31/11"], ["2026-11-13T24:00:00Z", "24:00"], ["2026-11-13T12:60:00Z", "phút 60"],
  ["2026-11-13T12:00:00+25:00", "múi +25"], ["1999-12-31T12:00:00Z", "năm 1999"], ["2100-01-01T12:00:00Z", "năm 2100"], [new Date("x"), "Date hỏng"], [new Date("1990-01-01T00:00:00Z"), "Date năm 1990"],
  [" 2026-11-13T12:00:00Z", "có khoảng trắng đầu"], ["2026-11-13T12:00:00Z".padEnd(60, "0"), "quá dài"], ["13/11/2026 19:00", "dd/mm/yyyy"],
] as [unknown, string][]) check(`phá: ${why} → { ok:false, error }`, (() => { const r = parseScheduledAtInput(v); return !r.ok && typeof r.error === "string" && r.error.length > 0; })(), P(v));

section("tutorFlags — cờ lịch NEXT_PUBLIC_KIN_MO_LICH");
check('lichOpenFrom: chỉ "1" là bật', lichOpenFrom("1") === true && [undefined, "", "0", "true", "yes", " 1", "1 ", "on"].every(v => lichOpenFrom(v) === false));
const saved = process.env.NEXT_PUBLIC_KIN_MO_LICH;
delete process.env.NEXT_PUBLIC_KIN_MO_LICH;
check("isLichOpen: không đặt → false (mặc định)", isLichOpen() === false);
process.env.NEXT_PUBLIC_KIN_MO_LICH = "1";
check('isLichOpen: "1" → true (đọc lúc gọi, không đóng băng lúc nạp)', isLichOpen() === true);
process.env.NEXT_PUBLIC_KIN_MO_LICH = "0";
check('isLichOpen: "0" → false', isLichOpen() === false);
if (saved === undefined) delete process.env.NEXT_PUBLIC_KIN_MO_LICH; else process.env.NEXT_PUBLIC_KIN_MO_LICH = saved;

done();
