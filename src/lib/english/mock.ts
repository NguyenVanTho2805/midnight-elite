// Thi thử IELTS: quy đổi điểm thô → band, đọc phần đáp án dán từ sách, chấm phiếu trả lời 40 câu, band tổng. Thuần.
//
// Bảng quy đổi là bảng XẤP XỈ được công bố rộng rãi (Cambridge/IDP/British Council dùng một bảng cho mỗi đề, lệch nhẹ
// theo độ khó từng đề). Nguồn đối chiếu: examenglish.com/IELTS/IELTS_Band_Scores.html và bảng của ielts.org trích lại.
// Vì vậy app luôn đặt mục tiêu theo NGƯỠNG AN TOÀN (vd Reading 6.5 → nhắm ≥ 28 câu, không phải 27).

import { gradeAnswer } from "./grading";

export type MockSkill = "listening" | "reading" | "writing" | "speaking";
export type ReadingModule = "academic" | "general";
export const MOCK_SKILLS: MockSkill[] = ["listening", "reading", "writing", "speaking"];
export const SKILL_LABEL: Record<MockSkill, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };
export const QUESTIONS = 40;
/** Thời gian làm bài trên máy (phút). Listening trên máy: ~30 phút nghe + 2 phút soát. */
export const MOCK_MINUTES: Record<"listening" | "reading", number> = { listening: 32, reading: 60 };

// [điểm thô tối thiểu, band], xếp giảm dần.
const LISTENING: [number, number][] = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
const READING_ACADEMIC: [number, number][] = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
// General Training: chọn mốc chặt hơn ở band 7 (35 câu) theo bản cập nhật 10/2025 mà ILSC trích từ ielts.org.
const READING_GENERAL: [number, number][] = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [35, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1]];

function table(skill: "listening" | "reading", module: ReadingModule = "academic"): [number, number][] {
  if (skill === "listening") return LISTENING;
  return module === "general" ? READING_GENERAL : READING_ACADEMIC;
}

export function bandFromRaw(skill: "listening" | "reading", raw: number, module: ReadingModule = "academic"): number {
  const r = Math.max(0, Math.min(QUESTIONS, Math.floor(raw)));
  for (const [min, band] of table(skill, module)) if (r >= min) return band;
  return 0;
}

/** Số câu đúng tối thiểu để đạt band (theo bảng xấp xỉ). null nếu band không có trong bảng. */
export function rawNeeded(skill: "listening" | "reading", band: number, module: ReadingModule = "academic"): number | null {
  const rows = table(skill, module).filter(([, b]) => b >= band);
  return rows.length ? rows[rows.length - 1][0] : null;
}

/**
 * Band tổng theo quy tắc làm tròn của IELTS: trung bình 4 kỹ năng; phần lẻ < .25 làm tròn xuống, .25–.75 thành .5, ≥ .75 lên số nguyên.
 * Ví dụ: 6.125 → 6.0 · 6.25 → 6.5 · 6.375 → 6.5 · 6.75 → 7.0.
 */
export function overallBand(bands: number[]): number | null {
  if (bands.length !== 4 || bands.some(b => !Number.isFinite(b))) return null;
  const avg = bands.reduce((s, b) => s + b, 0) / 4;
  const base = Math.floor(avg + 1e-9);
  const frac = avg - base;
  if (frac < 0.25 - 1e-9) return base;
  if (frac < 0.75 - 1e-9) return base + 0.5;
  return base + 1;
}

/**
 * Mục tiêu từng kỹ năng để band tổng đạt T: kéo điểm ở Listening/Reading (chấm khách quan, dễ tăng nhất), giữ Writing/Speaking.
 * T = 6.5 → L 7.0 · R 6.5 · W 6.0 · S 6.0 → trung bình 6.375 → 6.5.
 */
export function componentTargets(target: number): Record<MockSkill, number> {
  const clamp = (b: number) => Math.min(9, Math.max(1, b));
  return { listening: clamp(target + 0.5), reading: clamp(target), writing: clamp(target - 0.5), speaking: clamp(target - 0.5) };
}

/** Chuẩn hoá một đáp án trong key: "OR" → "/", bỏ dấu chấm cuối. */
function cleanKey(s: string): string {
  return s.replace(/\s+OR\s+/g, " / ").replace(/\s+/g, " ").replace(/[.;,]\s*$/, "").trim();
}

/**
 * Đọc phần đáp án dán từ sách (Cambridge IELTS, Improve your Skills…). Nhận:
 *  - mỗi dòng một câu: "1 TRUE", "2. B", "3) cars / vehicles", "14   iv"
 *  - hoặc cả đoạn liền: "1 A 2 C 3 NOT GIVEN 4 (the) river"
 * Trả mảng `n` phần tử ("" = chưa đọc được câu đó).
 */
export function parseAnswerKey(text: string, n = QUESTIONS): string[] {
  const out: string[] = Array(n).fill("");
  const src = text.replace(/\r/g, "").replace(/[‐-―]/g, "-");
  const lines = src.split("\n").map(l => l.trim()).filter(Boolean);
  const LINE = /^(\d{1,2})\s*[.):\-]?\s+(.+)$/;
  const lineHits = lines.map(l => l.match(LINE)).filter((m): m is RegExpMatchArray => !!m && Number(m[1]) >= 1 && Number(m[1]) <= n);

  if (lineHits.length >= Math.min(n, 10) / 2) {
    for (const m of lineHits) {
      const q = Number(m[1]);
      // một dòng có thể chứa nhiều câu ("1 A   2 B"): tách tiếp bằng cách quét liền ở dưới
      const rest = `${q} ${m[2]}`;
      const inline = scanInline(rest, q, n);
      for (const [k, v] of inline) if (!out[k - 1]) out[k - 1] = v;
    }
    return out;
  }
  for (const [k, v] of scanInline(src.replace(/\n/g, " "), 1, n)) if (!out[k - 1]) out[k - 1] = v;
  return out;
}

/** Quét đoạn liền: tìm số câu tăng dần bắt đầu từ `start`, phần chữ giữa hai số là đáp án. */
function scanInline(text: string, start: number, n: number): [number, string][] {
  const marks: { q: number; at: number; end: number }[] = [];
  const re = /(?:^|\s)(\d{1,2})\s*[.):\-]?(?=\s)/g;
  let expect = start;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const q = Number(m[1]);
    if (q !== expect || q > n) continue;
    // "3 4": số 4 ngay sau dấu của câu 3 là ĐÁP ÁN của câu 3, không phải câu 4 — đòi câu trước phải có chữ.
    const prev = marks.at(-1);
    if (prev && !text.slice(prev.end, m.index).trim()) continue;
    marks.push({ q, at: m.index, end: m.index + m[0].length });
    expect++;
  }
  return marks.map((mk, i) => [mk.q, cleanKey(text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : text.length))] as [number, string])
    .filter(([, v]) => v.length > 0);
}

const TFNG: Record<string, string> = { t: "true", f: "false", ng: "not given", y: "yes", n: "no" };
const expandTfng = (s: string) => { const k = s.trim().toLowerCase().replace(/\.$/, ""); return TFNG[k] ?? s; };
const LETTERS = /^[a-i](\s*(?:,|&|and)\s*[a-i])+$/i;
const letterSet = (s: string) => [...new Set(s.toLowerCase().match(/\b[a-i]\b/g) ?? [])].sort().join("");

/**
 * Chấm một câu thi thử. Ngoài quy ước của gradeAnswer ("/" nhiều cách viết, "(…)" có cũng được):
 * T/F/NG/Y/N viết tắt được chấp nhận; câu chọn nhiều chữ cái ("A, C") không phụ thuộc thứ tự.
 */
export function gradeMockAnswer(key: string, input: string): boolean {
  if (!key.trim() || !input.trim()) return false;
  const k = key.trim();
  if (LETTERS.test(k)) return letterSet(k) === letterSet(input) && letterSet(input).length > 0;
  return gradeAnswer([k], expandTfng(input)) || gradeAnswer([k], input);
}

export interface SheetItem { n: number; key: string; answer: string; correct: boolean }
export function gradeSheet(key: string[], answers: string[]): { items: SheetItem[]; raw: number; keyed: number } {
  const items = key.map((k, i) => ({ n: i + 1, key: k, answer: (answers[i] ?? "").trim(), correct: gradeMockAnswer(k, answers[i] ?? "") }));
  return { items, raw: items.filter(x => x.correct).length, keyed: key.filter(k => k.trim()).length };
}
