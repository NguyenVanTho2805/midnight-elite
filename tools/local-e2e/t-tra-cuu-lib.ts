// NC2-053 — src/lib/lookupPrivacy.ts: tra cứu công khai chỉ trả mức tối thiểu. PHÁ CỐ ý: số điện thoại sai (kể cả lỗ hổng cũ "0|12345678"), tên rỗng / một từ / nhiều dấu cách / chữ tổ hợp,
// bản che KHÔNG được chứa mã học viên, tên khoá hay tên thật ở bất kỳ trường nào.
import { LOOKUP_PHONE_RE, cleanLookupPhone, maskName, buildLookupResult, LOOKUP_LIMITS, type LookupRow } from "@/lib/lookupPrivacy";
import { check, section, done } from "./h";

section("Số điện thoại");
for (const ok of ["0901234567", "0351234567", "0561234567", "0781234567", "0891234567"]) check(`${ok} hợp lệ`, cleanLookupPhone(ok) === ok);
check("bỏ khoảng trắng: '0901 234 567' → '0901234567'", cleanLookupPhone("0901 234 567") === "0901234567");
check("số dạng số (không phải chuỗi) 0901234567 không có số 0 đầu → từ chối, không đoán", cleanLookupPhone(901234567) === null);
for (const bad of ["0|12345678", "0|1|234567", "0201234567", "0401234567", "090123456", "09012345678", "+84901234567", "84901234567", "090123456a", "", "   ", "0901-234-567", "0901.234.567"])
  check(`'${bad}' bị từ chối`, cleanLookupPhone(bad) === null && !LOOKUP_PHONE_RE.test(bad));
check("null / undefined / mảng / đối tượng bị từ chối", [null, undefined, ["0901234567"], { phone: "0901234567" }].every(v => cleanLookupPhone(v) === null));

section("Che tên");
const cases: [unknown, string][] = [
  ["Nguyễn Văn Thọ", "Nguyễn V. T."],
  ["Trần Thị Minh Anh", "Trần T. M. A."],
  ["  Lê   Hoàng  ", "Lê H."],
  ["Thọ", "T."],
  ["đỗ quốc bảo", "đỗ Q. B."],
  ["Đặng Ân", "Đặng Â."],
  ["", "***"], ["   ", "***"], [null, "***"], [undefined, "***"], [123, "***"], [{}, "***"],
];
for (const [inp, want] of cases) check(`maskName(${JSON.stringify(inp)}) = '${want}'`, maskName(inp) === want, maskName(inp));
const NFD = "Nguyễn Văn Thọ".normalize("NFD");
check("(kiểm tra bài) dạng tổ hợp thật sự khác dạng dựng sẵn", NFD !== "Nguyễn Văn Thọ".normalize("NFC"));
check("chữ tổ hợp (NFD) cho cùng kết quả với dạng dựng sẵn", maskName(NFD) === "Nguyễn V. T.", maskName(NFD));
check("tên đã che không chứa tên đệm / tên gốc ở bất kỳ vị trí nào", !/Văn|Thọ|Minh|Anh|Hoàng/.test(["Nguyễn Văn Thọ", "Trần Thị Minh Anh", "Lê Hoàng"].map(maskName).join(" ")));

section("Dựng kết quả");
const row: LookupRow = { name: "Nguyễn Văn Thọ", studentId: 1234, courses: [
  { id: "lop-su-12", name: "Sử 12 nâng cao", shortTitle: "Sử 12", category: "HSA", status: true },
  { id: "lop-dia-12", name: "Địa 12", shortTitle: "Địa 12", category: "THPT", status: true },
] };
const masked = buildLookupResult(row, false);
check("không phải chủ → detail=false, tên che, courseCount=2", masked.detail === false && masked.name === "Nguyễn V. T." && "courseCount" in masked && masked.courseCount === 2, masked);
const mj = JSON.stringify(masked);
check("bản che KHÔNG chứa mã học viên, mã khoá, tên khoá, tên thật, trường 'courses' / 'studentId'", !/1234|lop-su|Sử 12|Địa|Thọ|Văn|"courses"|"studentId"/.test(mj), mj);
const full = buildLookupResult(row, true);
check("chính chủ → detail=true, đủ tên thật, mã học viên, 2 khoá", full.detail === true && full.name === "Nguyễn Văn Thọ" && full.studentId === 1234 && full.courses.length === 2, full);
check("chưa đăng ký khoá nào: bản che courseCount=0; bản đủ courses rỗng", (() => { const e = { ...row, courses: [] }; const a = buildLookupResult(e, false), b = buildLookupResult(e, true); return !a.detail && a.courseCount === 0 && b.detail && b.courses.length === 0; })());
check("studentId null vẫn dựng được (học sinh chưa có mã)", (() => { const r = buildLookupResult({ ...row, studentId: null }, true); return r.detail && r.studentId === null; })());

section("Giới hạn");
check("giới hạn là số dương hợp lý: IP 10/phút ≤ 60/ngày, mỗi số tối đa 5 lần / 10 phút", LOOKUP_LIMITS.ipPerMinute > 0 && LOOKUP_LIMITS.ipPerDay >= LOOKUP_LIMITS.ipPerMinute && LOOKUP_LIMITS.phonePerWindow >= 1 && LOOKUP_LIMITS.phonePerWindow <= 10 && LOOKUP_LIMITS.phoneWindowMs === 600000, LOOKUP_LIMITS);

done();
