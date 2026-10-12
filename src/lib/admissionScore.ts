// FE-099 — điểm chuẩn tuyển sinh có dẫn nguồn. Hàm thuần (không Prisma) để test.
// Nguyên tắc: không có số nào hiện ra mà không có đường dẫn nguồn; không so sánh giữa các thang điểm khác nhau;
// `verified` chỉ đúng khi quản trị đã đối chiếu với thông báo chính thức của trường.

export const SCORE_METHODS = [
  { key: "thpt", label: "Điểm thi tốt nghiệp THPT" },
  { key: "hsa", label: "ĐGNL ĐHQG Hà Nội (HSA)" },
  { key: "dgnl-hcm", label: "ĐGNL ĐHQG TP.HCM" },
  { key: "tsa", label: "Đánh giá tư duy (TSA)" },
  { key: "tong-hop", label: "Xét tuyển tổng hợp" },
  { key: "khac", label: "Khác / theo thông báo của trường" },
] as const;
export type ScoreMethod = (typeof SCORE_METHODS)[number]["key"];
export const METHOD_KEYS: string[] = SCORE_METHODS.map(m => m.key);
export const methodLabel = (key: string) => SCORE_METHODS.find(m => m.key === key)?.label ?? key;

export const YEAR_MIN = 2015;
export const SCHOOL_MAX = 120;
export const MAJOR_MAX = 150;
export const VARIANT_MAX = 80;
export const NOTE_MAX = 300;
export const URL_MAX = 500;
export const SOURCE_NAME_MAX = 80;
export const SCALE_MAX = 2000;
export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_CHARS = 200_000;

export interface ScoreInput {
  school: string; major: string; variant: string; year: number; method: string;
  score: number; scale: number; note: string; sourceUrl: string; sourceName: string;
  verified: boolean; published: boolean;
}
/** Dòng trả cho trang công khai (không có trường nội bộ). */
export interface PublicScore {
  id: string; school: string; major: string; variant: string; year: number; method: string;
  score: number; scale: number; note: string | null; sourceUrl: string; sourceName: string; verified: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// NFC: chữ có dấu dán từ Mac/Excel có thể ở dạng tổ hợp (NFD) — chuẩn hoá để cùng một tên luôn khớp nhau.
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/\s+/g, " ").trim() : "");

/** Chỉ nhận http(s), không kèm tên/mật khẩu trong URL (tránh link lừa đảo kiểu https://trusted.vn@evil.com). Trả URL đã chuẩn hoá hoặc null. */
export function cleanSourceUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > URL_MAX) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (!u.hostname.includes(".")) return null;
  return u.toString();
}
export const sourceNameFromUrl = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** "29,19" / "29.19" / 29.19 → số; còn lại → null. */
export function parseScoreNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: unknown, fallback: boolean): boolean | null {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "x", "có", "co", "yes", "y"].includes(s)) return true;
    if (["false", "0", "không", "khong", "no", "n"].includes(s)) return false;
  }
  return null;
}

export type ScoreParse = { ok: true; value: ScoreInput } | { ok: false; error: string };
/** Kiểm một dòng điểm chuẩn. Nghiêm: sai là từ chối, không tự sửa số. */
export function parseScoreInput(body: unknown, now: Date = new Date()): ScoreParse {
  if (!isObj(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const school = oneLine(body.school), major = oneLine(body.major), variant = oneLine(body.variant), note = oneLine(body.note);
  if (!school) return { ok: false, error: "Thiếu tên trường" };
  if (school.length > SCHOOL_MAX) return { ok: false, error: `Tên trường tối đa ${SCHOOL_MAX} ký tự` };
  if (!major) return { ok: false, error: "Thiếu tên ngành" };
  if (major.length > MAJOR_MAX) return { ok: false, error: `Tên ngành tối đa ${MAJOR_MAX} ký tự` };
  if (variant.length > VARIANT_MAX) return { ok: false, error: `Chương trình tối đa ${VARIANT_MAX} ký tự` };
  if (note.length > NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${NOTE_MAX} ký tự` };

  const yearN = typeof body.year === "string" && /^\d{4}$/.test(body.year.trim()) ? Number(body.year.trim()) : body.year;
  const maxYear = now.getUTCFullYear() + 1;
  if (typeof yearN !== "number" || !Number.isInteger(yearN) || yearN < YEAR_MIN || yearN > maxYear) return { ok: false, error: `Năm phải từ ${YEAR_MIN} đến ${maxYear}` };

  const method = oneLine(body.method);
  if (!METHOD_KEYS.includes(method)) return { ok: false, error: `Phương thức phải là một trong: ${METHOD_KEYS.join(", ")}` };

  const scale = parseScoreNumber(body.scale);
  if (scale === null || !Number.isInteger(scale) || scale < 1 || scale > SCALE_MAX) return { ok: false, error: `Thang điểm phải là số nguyên từ 1 đến ${SCALE_MAX} (VD 30)` };
  const score = parseScoreNumber(body.score);
  if (score === null) return { ok: false, error: "Điểm chuẩn phải là số (VD 28,5)" };
  if (score <= 0 || score > scale) return { ok: false, error: `Điểm chuẩn phải lớn hơn 0 và không vượt thang ${scale}` };
  if (Math.round(score * 100) / 100 !== score) return { ok: false, error: "Điểm chuẩn tối đa 2 chữ số thập phân" };

  const sourceUrl = cleanSourceUrl(body.sourceUrl);
  if (!sourceUrl) return { ok: false, error: "Cần đường dẫn nguồn hợp lệ (http/https) — không nhận điểm không có nguồn" };
  const sourceName = oneLine(body.sourceName) || sourceNameFromUrl(sourceUrl);
  if (sourceName.length > SOURCE_NAME_MAX) return { ok: false, error: `Tên nguồn tối đa ${SOURCE_NAME_MAX} ký tự` };

  const verified = parseBool(body.verified, false);
  const published = parseBool(body.published, true);
  if (verified === null || published === null) return { ok: false, error: "verified / published phải là đúng hoặc sai" };

  return { ok: true, value: { school, major, variant, year: yearN, method, score, scale, note, sourceUrl, sourceName, verified, published } };
}

// ─── Nhập hàng loạt (CSV hoặc JSON) ─────────────────────────────────────────────────────────────────────────────
export const IMPORT_COLUMNS = ["school", "major", "variant", "year", "method", "score", "scale", "sourceUrl", "sourceName", "note", "verified", "published"] as const;

/** CSV nhỏ: hỗ trợ dấu ngoặc kép, dấu phân tách , ; hoặc Tab (tự nhận theo dòng tiêu đề — Excel tiếng Việt hay dùng ;), BOM, CRLF. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

export interface ImportResult { rows: ScoreInput[]; errors: { line: number; error: string }[] }
/** Đọc văn bản dán vào: mảng JSON hoặc CSV có dòng tiêu đề (tên cột như IMPORT_COLUMNS). Dòng lỗi được báo kèm số dòng; không dòng nào bị bỏ lặng lẽ. */
export function parseImportText(text: string, now: Date = new Date()): ImportResult {
  const out: ImportResult = { rows: [], errors: [] };
  const src = text.trim();
  if (!src) { out.errors.push({ line: 0, error: "Chưa có nội dung để nhập" }); return out; }
  if (src.length > IMPORT_MAX_CHARS) { out.errors.push({ line: 0, error: `Nội dung quá dài (tối đa ${IMPORT_MAX_CHARS} ký tự)` }); return out; }

  let records: { line: number; data: unknown }[] = [];
  if (src.startsWith("[") || src.startsWith("{")) {
    let json: unknown;
    try { json = JSON.parse(src); } catch { out.errors.push({ line: 0, error: "JSON không đọc được" }); return out; }
    if (!Array.isArray(json)) { out.errors.push({ line: 0, error: "JSON phải là một mảng các dòng" }); return out; }
    records = json.map((data, i) => ({ line: i + 1, data }));
  } else {
    const table = parseCsv(src);
    const header = (table[0] ?? []).map(h => h.trim());
    const missing = ["school", "major", "year", "method", "score", "scale", "sourceUrl"].filter(c => !header.includes(c));
    if (missing.length) { out.errors.push({ line: 1, error: `Dòng tiêu đề thiếu cột: ${missing.join(", ")}` }); return out; }
    const unknown = header.filter(h => h && !(IMPORT_COLUMNS as readonly string[]).includes(h));
    if (unknown.length) { out.errors.push({ line: 1, error: `Cột không nhận ra: ${unknown.join(", ")}` }); return out; }
    records = table.slice(1).map((cells, i) => ({ line: i + 2, data: Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""])) }));
  }
  if (records.length === 0) { out.errors.push({ line: 0, error: "Không có dòng dữ liệu nào" }); return out; }
  if (records.length > IMPORT_MAX_ROWS) { out.errors.push({ line: 0, error: `Tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập` }); return out; }

  const seen = new Map<string, number>();
  for (const { line, data } of records) {
    const p = parseScoreInput(data, now);
    if (!p.ok) { out.errors.push({ line, error: p.error }); continue; }
    const k = scoreKey(p.value);
    const dup = seen.get(k);
    if (dup) { out.errors.push({ line, error: `Trùng với dòng ${dup} (cùng trường, ngành, chương trình, năm, phương thức)` }); continue; }
    seen.set(k, line);
    out.rows.push(p.value);
  }
  return out;
}

/** Khoá nhận diện một dòng (khớp @@unique của AdmissionScore). */
export const scoreKey = (r: { school: string; major: string; variant: string; year: number; method: string }) =>
  [r.school.toLowerCase(), r.major.toLowerCase(), r.variant.toLowerCase(), r.year, r.method].join("|");

// ─── Hiển thị ───────────────────────────────────────────────────────────────────────────────────────────────────
/** 29.19 → "29,19"; 28.5 → "28,5"; 85 → "85". */
export const formatScore = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export interface ScoreGroup {
  key: string; school: string; major: string; variant: string; method: string;
  /** Mới → cũ. */
  entries: PublicScore[];
}
/** Gom các năm của cùng (trường, ngành, chương trình, phương thức) thành một dòng. Nhóm sắp theo trường, ngành. */
export function groupScores(rows: PublicScore[]): ScoreGroup[] {
  const map = new Map<string, ScoreGroup>();
  for (const r of rows) {
    const key = [r.school.toLowerCase(), r.major.toLowerCase(), r.variant.toLowerCase(), r.method].join("|");
    let g = map.get(key);
    if (!g) { g = { key, school: r.school, major: r.major, variant: r.variant, method: r.method, entries: [] }; map.set(key, g); }
    g.entries.push(r);
  }
  const groups = [...map.values()];
  for (const g of groups) g.entries.sort((a, b) => b.year - a.year);
  groups.sort((a, b) => a.school.localeCompare(b.school, "vi") || a.major.localeCompare(b.major, "vi") || a.variant.localeCompare(b.variant, "vi") || a.method.localeCompare(b.method));
  return groups;
}

/** Chênh lệch so với năm liền trước CÙNG THANG ĐIỂM; khác thang hoặc thiếu năm → null (không so sánh gượng). */
export function scoreDelta(cur: PublicScore, prev: PublicScore | undefined): number | null {
  if (!prev || prev.scale !== cur.scale || prev.year !== cur.year - 1) return null;
  return Math.round((cur.score - prev.score) * 100) / 100;
}

/** Các năm xuất hiện trong dữ liệu, mới → cũ, tối đa `n` năm — dùng làm cột. */
export function recentYears(rows: PublicScore[], n = 3): number[] {
  return [...new Set(rows.map(r => r.year))].sort((a, b) => b - a).slice(0, n);
}

export function filterGroups(groups: ScoreGroup[], q: string, method: string): ScoreGroup[] {
  const needle = q.trim().toLowerCase();
  return groups.filter(g =>
    (method === "" || g.method === method) &&
    (!needle || `${g.school} ${g.major} ${g.variant}`.toLowerCase().includes(needle)));
}
