// Nhập hàng loạt học sinh (LO-06 dán danh sách, LO-17 CSV/Excel) và lịch học hàng tuần (LO-17). Hàm THUẦN: nhận chữ, trả dòng đã kiểm + lỗi TỪNG DÒNG.
// Test: tools/local-e2e/t-student-import-lib.ts. Nhập hàng loạt phải qua hộp xác nhận của gia sư (ConsentBox bulk) — nơi gọi mới được ghi.
//
// Nguyên tắc:
//  • Có dòng lỗi thì KHÔNG bỏ âm thầm: trả trong `errors` (số dòng + lý do) để gia sư sửa hoặc chủ động bỏ qua.
//  • Quá số dòng cấu hình (importMaxRows) → từ chối cả lần nhập, không cắt lặng lẽ.
//  • Chỉ đọc chữ: tệp Excel được máy chủ đổi sang bảng chữ rồi mới vào đây. Công thức (ô bắt đầu bằng = + - @) bị coi là chữ thường, không chạy.
import Papa from "papaparse";
import { cleanText, normalizeKey } from "@/lib/tutorArea";
import { normalizeHm } from "@/lib/classSessions";
import { groupOfAge, isAgeGroup, requiredConsent, type AgeGroup, type ConsentParty } from "@/lib/consentPolicy";
import { parseProfileInput, type ProfileData } from "@/lib/studentProfile";

const BOM = new RegExp("^\\ufeff"); // dấu BOM đầu tệp Excel/CSV (viết bằng chuỗi thoát để mã nguồn chỉ có ASCII)
export const IMPORT_TEXT_MAX = 400_000;
export interface RowError { line: number; message: string }

export interface StudentImportRow {
  line: number;
  data: ProfileData;
  /** Tên lớp ghi trong tệp đã khớp với lớp của gia sư (courseId nằm trong data). */
  hasExtended: boolean;
  parties: ConsentParty[];
}
export interface StudentImportParse {
  rows: StudentImportRow[];
  errors: RowError[];
  /** Dòng bị coi là trùng (cùng tên + cùng SĐT phụ huynh) trong tệp. */
  duplicates: number;
  tooMany: boolean;
  total: number;
  /** Cột nhận ra và cột bị bỏ qua (để nói thật với gia sư). */
  mapped: string[];
  ignored: string[];
  hasHeader: boolean;
  /** Hợp các bên phải đồng ý cho cả lần nhập. */
  parties: ConsentParty[];
  hasExtended: boolean;
}

type Field = "name" | "guardianName" | "guardianPhone" | "phone" | "phoneExtra" | "email" | "emailExtra" | "birthDate" | "address" | "startDate" | "subjects" | "notes" | "ageGroup" | "status" | "course";
const HEADERS: Record<Field, string[]> = {
  name: ["ho ten", "ten", "ho va ten", "hoc sinh", "ten hoc sinh", "ho ten hoc sinh", "name", "student"],
  guardianName: ["phu huynh", "ten phu huynh", "ho ten phu huynh", "nguoi giam ho", "guardian", "parent"],
  guardianPhone: ["sdt phu huynh", "so dien thoai phu huynh", "dien thoai phu huynh", "zalo phu huynh", "sdt ph", "sdt zalo phu huynh", "sdt zalo", "guardian phone", "parent phone"],
  phone: ["sdt", "so dien thoai", "dien thoai", "sdt hoc sinh", "so dien thoai hoc sinh", "phone"],
  phoneExtra: ["sdt 3", "sdt khac", "so dien thoai khac", "sdt phu", "dien thoai 3", "sdt thu ba", "phone 3"],
  email: ["email", "email hoc sinh", "mail"],
  emailExtra: ["email phu", "email bo sung", "email phu huynh", "email 2"],
  birthDate: ["ngay sinh", "sinh nhat", "birthday", "dob"],
  address: ["dia chi", "address"],
  startDate: ["ngay bat dau", "bat dau", "ngay vao hoc", "start"],
  subjects: ["mon", "mon hoc", "subjects"],
  notes: ["ghi chu", "note", "notes"],
  ageGroup: ["nhom tuoi", "tuoi", "age"],
  status: ["trang thai", "status"],
  course: ["lop", "ten lop", "class"],
};
const FIELD_LABEL: Record<Field, string> = {
  name: "Họ tên", guardianName: "Tên phụ huynh", guardianPhone: "SĐT phụ huynh", phone: "SĐT của em", phoneExtra: "SĐT thứ ba", email: "Email", emailExtra: "Email bổ sung",
  birthDate: "Ngày sinh", address: "Địa chỉ", startDate: "Ngày bắt đầu", subjects: "Môn", notes: "Ghi chú", ageGroup: "Nhóm tuổi", status: "Trạng thái", course: "Lớp",
};

const phoneLike = (s: string) => /^[+(]?\d[\d\s.\-()]{6,}$/.test(s.trim());

function fieldOfHeader(h: string): Field | null {
  const k = normalizeKey(h);
  for (const f of Object.keys(HEADERS) as Field[]) if (HEADERS[f].includes(k)) return f;
  return null;
}

/** "7", "dưới 7", "7-15", "16+", "từ 16 tuổi trở lên", "u7" → nhóm tuổi; không đọc được → null. */
export function parseAgeCell(raw: string): AgeGroup | null {
  const t = normalizeKey(raw);
  if (!t) return null;
  if (isAgeGroup(raw.trim())) return raw.trim() as AgeGroup;
  if (/(^| )(duoi 7|under 7|<\s*7)( |$)/.test(t)) return "u7";
  if (/16/.test(t) && /(tro len|plus|\+|tu|tren)/.test(t + raw)) return "16plus";
  if (/\b7\b.*\b15\b/.test(t)) return "7to15";
  const n = /^\d{1,2}$/.test(t) ? Number(t) : /^(\d{1,2}) tuoi$/.test(t) ? Number(/^(\d{1,2})/.exec(t)![1]) : null;
  return n !== null && n >= 1 && n <= 99 ? groupOfAge(n) : null;
}

const STATUS_WORDS: [RegExp, string][] = [[/^(khong hoat dong|nghi|inactive)$/, "inactive"], [/^(hoat dong|dang hoc|active)$/, "active"], [/^(cho|dang cho|cho xep lop|waitlist)$/, "waitlist"]];

export interface ImportContext {
  /** Nhóm tuổi áp cho dòng không ghi nhóm tuổi / ngày sinh. */
  defaultGroup: AgeGroup;
  /** Tên trường tuỳ chỉnh (đã chuẩn hoá bằng normalizeKey) → id. */
  customByKey: ReadonlyMap<string, string>;
  /** Tên lớp (normalizeKey) → courseId, chỉ lớp CỦA gia sư. */
  courseByKey: ReadonlyMap<string, string>;
  /** Lớp mặc định khi tệp không có cột lớp. */
  defaultCourseId?: string | null;
  /** Trạng thái mặc định cho dòng không ghi (vd. "waitlist" khi nhập danh sách chờ). */
  defaultStatus?: "active" | "inactive" | "waitlist";
  now: Date;
  maxRows: number;
}

const sheetRows = (text: string): string[][] => {
  const r = Papa.parse<string[]>(text, { delimiter: "", skipEmptyLines: false, quoteChar: '"' });
  return r.data.filter((x): x is string[] => Array.isArray(x));
};

/** Tách một dòng KHÔNG có tiêu đề: dòng nào dùng dấu tách của dòng đó (TAB từ Excel, dấu phẩy, chấm phẩy, gạch đứng). */
const looseSplit = (line: string): string[] => line.split(/[\t;|,]/).map(c => cleanText(c));

export function parseStudentImport(textRaw: string, ctx: ImportContext): StudentImportParse {
  const empty = (msg: string): StudentImportParse => ({ rows: [], errors: [{ line: 0, message: msg }], duplicates: 0, tooMany: true, total: 0, mapped: [], ignored: [], hasHeader: false, parties: [], hasExtended: false });
  const text = textRaw.replace(BOM, "");
  if (text.length > IMPORT_TEXT_MAX) return empty("Tệp quá lớn. Chỉ cần tên em và vài cột liên hệ.");
  const rawLines = text.split(/\r\n|\r|\n/);
  const firstIdx = rawLines.findIndex(l => l.trim());
  const out: StudentImportParse = { rows: [], errors: [], duplicates: 0, tooMany: false, total: 0, mapped: [], ignored: [], hasHeader: false, parties: [], hasExtended: false };
  if (firstIdx < 0) return out;

  // Dòng đầu là tiêu đề nếu ≥1 ô nhận ra được là tên cột (và không ô nào là số điện thoại).
  const probe = looseSplit(rawLines[firstIdx]);
  const isHeader = (probe.some(c => fieldOfHeader(c)) || probe.some(c => ctx.customByKey.has(normalizeKey(c)))) && !probe.some(c => phoneLike(c));
  out.hasHeader = isHeader;
  // Có tiêu đề: tệp CSV thật (ngoặc kép, dấu phẩy trong ô) → Papa. Không tiêu đề: dán tên, mỗi dòng tự tách.
  const grid: string[][] = isHeader ? sheetRows(text) : rawLines.map(looseSplit);
  const lines = grid.map((cells, i) => ({ line: i + 1, cells: cells.map(c => cleanText(String(c ?? ""))) })).filter(l => l.cells.some(c => c));
  const first = lines[0];
  let colField: (Field | null)[] = [], colCustom: (string | null)[] = [];
  if (isHeader) {
    colField = first.cells.map(c => fieldOfHeader(c));
    colCustom = first.cells.map(c => ctx.customByKey.get(normalizeKey(c)) ?? null);
    out.mapped = first.cells.map((c, i) => colField[i] ? FIELD_LABEL[colField[i]!] : colCustom[i] ? c : "").filter(Boolean);
    out.ignored = first.cells.filter((c, i) => c && !colField[i] && !colCustom[i]);
    if (!colField.includes("name")) return { ...out, rows: [], errors: [{ line: first.line, message: "Không thấy cột tên em. Đặt tên cột là “Họ tên” hoặc “Tên”." }], tooMany: true };
  } else {
    out.mapped = ["Họ tên", "SĐT phụ huynh"];
  }
  const dataLines = isHeader ? lines.slice(1) : lines;
  out.total = dataLines.length;
  if (dataLines.length > ctx.maxRows) {
    return { ...out, rows: [], errors: [{ line: 0, message: `Tối đa ${ctx.maxRows} dòng mỗi lần nhập (đang có ${dataLines.length}). Chia thành nhiều lần.` }], tooMany: true };
  }

  const seen = new Set<string>();
  const partiesAll = new Set<ConsentParty>();
  for (const l of dataLines) {
    const fail = (message: string) => out.errors.push({ line: l.line, message });
    const body: Record<string, unknown> = {};
    const custom: Record<string, string> = {};
    let courseCell = "", ageCell = "", statusCell = "";
    if (isHeader) {
      l.cells.forEach((c, i) => {
        if (!c) return;
        const f = colField[i];
        if (f === "course") courseCell = c; else if (f === "ageGroup") ageCell = c; else if (f === "status") statusCell = c;
        else if (f) body[f] = c;
        else if (colCustom[i]) custom[colCustom[i]!] = c;
      });
    } else {
      // Không tiêu đề: ô chữ đầu = tên em, ô chữ thứ hai = tên phụ huynh, ô toàn số = SĐT (đầu: phụ huynh, hai: của em). Ô thừa → báo lỗi, KHÔNG bỏ lặng lẽ.
      const cells = l.cells.filter(Boolean);
      const isNum = (c: string) => /^[+(]?\d[\d\s.\-()]*$/.test(c);
      const nums = cells.filter(isNum), words = cells.filter(c => !isNum(c));
      const name = words.find(c => /\p{L}/u.test(c));
      if (!name) { fail("Thiếu tên em"); continue; }
      const rest = words.filter(c => c !== name);
      if (rest.length > 1 || nums.length > 2) { fail("Dòng có nhiều cột hơn “Tên, SĐT phụ huynh”. Thêm dòng tiêu đề (Họ tên, SĐT phụ huynh, Ngày sinh…) để KiN biết từng cột."); continue; }
      body.name = name;
      if (rest[0]) body.guardianName = rest[0];
      if (nums[0]) body.guardianPhone = nums[0];
      if (nums[1]) body.phone = nums[1];
    }
    // Nhóm tuổi: ô riêng → ngày sinh quyết định ở parseProfileInput → mặc định của cả lần nhập.
    if (ageCell) { const g = parseAgeCell(ageCell); if (!g) { fail(`Nhóm tuổi “${ageCell.slice(0, 20)}” không đọc được (ghi: dưới 7, 7-15, hoặc 16+)`); continue; } body.ageGroup = g; }
    else body.ageGroup = ctx.defaultGroup;
    if (statusCell) { const k = normalizeKey(statusCell); const m = STATUS_WORDS.find(([re]) => re.test(k)); if (!m) { fail(`Trạng thái “${statusCell.slice(0, 20)}” không hợp lệ (hoạt động / không hoạt động / chờ)`); continue; } body.status = m[1]; }
    else if (ctx.defaultStatus) body.status = ctx.defaultStatus;
    if (courseCell) {
      const id = ctx.courseByKey.get(normalizeKey(courseCell));
      if (!id) { fail(`Lớp “${courseCell.slice(0, 30)}” không phải lớp của bạn`); continue; }
      body.courseId = id;
    } else if (ctx.defaultCourseId) body.courseId = ctx.defaultCourseId;
    if (Object.keys(custom).length) body.customData = custom;

    const p = parseProfileInput(body, { partial: false, customIds: new Set([...ctx.customByKey.values()]), now: ctx.now });
    const err = Object.values(p.errors)[0];
    if (err) { fail(err); continue; }
    const d = p.data;
    const key = `${normalizeKey(d.name ?? "")}|${d.guardianPhone ?? ""}`;
    if (seen.has(key)) { out.duplicates++; continue; }
    seen.add(key);
    const req = requiredConsent({ declared: d.ageGroup ?? null, birthKey: d.birthDate ?? null, now: ctx.now });
    req.parties.forEach(x => partiesAll.add(x));
    const hasExtended = p.touchesExtended;
    if (hasExtended) out.hasExtended = true;
    out.rows.push({ line: l.line, data: d, hasExtended, parties: req.parties });
  }
  out.parties = (["guardian", "child", "self"] as ConsentParty[]).filter(x => partiesAll.has(x));
  return out;
}

// ── Lịch học hàng tuần (LO-17, phần "lịch") ────────────────────────────────────────

export interface ScheduleImportRow { line: number; courseId: string; dayOfWeek: number; startTime: string; endTime: string; note: string | null }
export interface ScheduleImportParse { rows: ScheduleImportRow[]; errors: RowError[]; duplicates: number; tooMany: boolean; total: number }

const DAY_WORDS: [RegExp, number][] = [
  [/^(cn|chu nhat|8|sun|sunday)$/, 0], [/^(t2|thu 2|thu hai|2|mon|monday)$/, 1], [/^(t3|thu 3|thu ba|3|tue|tuesday)$/, 2], [/^(t4|thu 4|thu tu|4|wed|wednesday)$/, 3],
  [/^(t5|thu 5|thu nam|5|thu|thursday)$/, 4], [/^(t6|thu 6|thu sau|6|fri|friday)$/, 5], [/^(t7|thu 7|thu bay|7|sat|saturday)$/, 6],
];
export function parseDayOfWeek(raw: string): number | null {
  const k = normalizeKey(raw);
  const m = DAY_WORDS.find(([re]) => re.test(k));
  return m ? m[1] : null;
}
/** "19:00", "19h", "19h30", "7:05" → "19:00"; sai → null. */
export function parseTimeCell(raw: string): string | null {
  const t = cleanText(raw).toLowerCase().replace(/\s+/g, "");
  const m = /^(\d{1,2})(?:[:h](\d{1,2})?)$/.exec(t);
  if (!m) return null;
  return normalizeHm(`${m[1]}:${(m[2] ?? "00").padStart(2, "0")}`);
}

const SCHEDULE_HEADERS: Record<string, string[]> = {
  course: ["lop", "ten lop", "class"], day: ["thu", "ngay", "thu trong tuan", "day"], start: ["bat dau", "gio bat dau", "tu", "start"], end: ["ket thuc", "gio ket thuc", "den", "end"], note: ["ghi chu", "note"],
};

/** CSV lịch: cột Lớp, Thứ, Bắt đầu, Kết thúc, Ghi chú. Không có tiêu đề thì thứ tự cột như vậy (không có cột lớp nếu có `defaultCourseId`). */
export function parseScheduleImport(textRaw: string, o: { courseByKey: ReadonlyMap<string, string>; defaultCourseId?: string | null; maxRows: number }): ScheduleImportParse {
  const out: ScheduleImportParse = { rows: [], errors: [], duplicates: 0, tooMany: false, total: 0 };
  const text = textRaw.replace(BOM, "");
  if (text.length > IMPORT_TEXT_MAX) return { ...out, tooMany: true, errors: [{ line: 0, message: "Tệp quá lớn." }] };
  const lines = sheetRows(text).map((cells, i) => ({ line: i + 1, cells: cells.map(c => cleanText(String(c ?? ""))) })).filter(l => l.cells.some(c => c));
  if (!lines.length) return out;
  const colOf = (h: string) => Object.entries(SCHEDULE_HEADERS).find(([, ks]) => ks.includes(normalizeKey(h)))?.[0] ?? null;
  const head = lines[0].cells.map(colOf);
  const isHeader = head.filter(Boolean).length >= 2;
  const cols = isHeader ? head : (o.defaultCourseId ? ["day", "start", "end", "note"] : ["course", "day", "start", "end", "note"]);
  const body = isHeader ? lines.slice(1) : lines;
  out.total = body.length;
  if (body.length > o.maxRows) return { ...out, tooMany: true, errors: [{ line: 0, message: `Tối đa ${o.maxRows} dòng mỗi lần nhập (đang có ${body.length}).` }] };
  const seen = new Set<string>();
  for (const l of body) {
    const cell = (name: string) => l.cells[cols.indexOf(name)] ?? "";
    const fail = (message: string) => out.errors.push({ line: l.line, message });
    let courseId = o.defaultCourseId ?? null;
    if (cell("course")) { courseId = o.courseByKey.get(normalizeKey(cell("course"))) ?? null; if (!courseId) { fail(`Lớp “${cell("course").slice(0, 30)}” không phải lớp của bạn`); continue; } }
    if (!courseId) { fail("Thiếu lớp"); continue; }
    const day = parseDayOfWeek(cell("day"));
    if (day === null) { fail(`Thứ “${cell("day").slice(0, 15)}” không đọc được (ghi 2 đến 7, hoặc CN)`); continue; }
    const start = parseTimeCell(cell("start")), end = parseTimeCell(cell("end"));
    if (!start) { fail(`Giờ bắt đầu “${cell("start").slice(0, 10)}” không đọc được (ví dụ 19:00)`); continue; }
    if (!end) { fail(`Giờ kết thúc “${cell("end").slice(0, 10)}” không đọc được (ví dụ 21:00)`); continue; }
    if (end <= start) { fail("Giờ kết thúc phải sau giờ bắt đầu"); continue; }
    const key = `${courseId}|${day}|${start}|${end}`;
    if (seen.has(key)) { out.duplicates++; continue; }
    seen.add(key);
    out.rows.push({ line: l.line, courseId, dayOfWeek: day, startTime: start, endTime: end, note: cell("note").slice(0, 200) || null });
  }
  return out;
}
