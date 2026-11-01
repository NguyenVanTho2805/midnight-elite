// BU-03 P1 — hiểu đề Word theo MẪU AZOTA (không AI). THUẦN: nhận DocBlock[] (do azotaDocxRead.ts bóc từ .docx), không DB, không mạng.
// Luật (đặc tả P1.3): mốc PHẦN → loại câu; "Câu N." → câu mới; phương án A. B. C. D. / ý Đ-S a) b) c) d) (kèm [n, MỨC]); đáp án đúng lấy từ
// ① gạch chân nhãn ② dấu * ③ bảng đáp án sau "-----HẾT-----" ④ "Chọn X." / "Đáp án: X" ở Lời giải. Các nguồn MÂU THUẪN nhau → KHÔNG chọn đáp án nào
// (`answer_conflict`) — không bao giờ đoán. Màu một mình KHÔNG đủ. Mức NB/TH/VD/VDC chỉ lấy từ [n, MỨC] của ý Đ-S; còn lại để trống. Điểm không đọc từ tệp.
// Công thức: OMML → LaTeX (ommlLatex.ts); MathType OLE → nhãn ⟦công thức⟧ + cờ formula_unread (P1a — đọc nội dung MathType là P1b, chưa làm).
import type { QuizQuestionInput } from "@/lib/quizQuestion";
import { FORMULA_PLACEHOLDER } from "@/lib/ommlLatex";

// ── Kiểu đầu vào (từ azotaDocxRead.ts) ───────────────────────────────────────────────────────
export type Level = "NB" | "TH" | "VD" | "VDC";
export interface DocRun {
  text: string;
  bold?: boolean; italic?: boolean; underline?: boolean; color?: string; highlight?: string; sup?: boolean; sub?: boolean; br?: boolean;
  /** Hình trong run: index vào `images` của readDocx; readable=false (wmf/emf, quá giới hạn) = không hiển thị được. */
  image?: { index: number; readable: boolean };
  formula?: "omml" | "ole"; latex?: string;
}
export interface DocCell { paragraphs: DocRun[][] }
export type DocBlock = { kind: "p"; runs: DocRun[] } | { kind: "table"; rows: DocCell[][] };

// ── Kiểu đầu ra (đặc tả P1.3) ────────────────────────────────────────────────────────────────
export type AzotaType = "MC" | "MC_MULTI" | "TRUE_FALSE_CLUSTER" | "SHORT_ANSWER" | "ESSAY";
export type AnswerSource = "dau-gach-chan" | "bang-het" | "loi-giai" | "mau" | "khong-co";
export type AzotaFlag = "answer_missing" | "answer_conflict" | "formula_unread" | "image_unreadable";
export interface AzotaQuestion {
  key: string; number: number; sectionIndex: number; sectionLabel: string;
  type: AzotaType;
  text: string; imageUrl?: string;
  /** Chỉ số hình trong tệp (images của readDocx). Máy chủ tải ảnh lên rồi điền `imageUrl` và bỏ trường này khỏi phản hồi. */
  imageIndex?: number;
  options: { text: string; isCorrect: boolean; subLabel?: string }[]; // Đ/S: subLabel "a".."d"; trả lời ngắn: 1 phần tử isCorrect=true chứa đáp án
  explanation: string; difficulty: Level | null;
  answerSource: AnswerSource;
  flags: AzotaFlag[];
}
export interface AzotaParse {
  questions: AzotaQuestion[];
  errors: { block: number; message: string }[];
  warnings: { question: string; code: string; message: string }[];
  stats: { total: number; byType: Record<string, number>; withAnswer: number; withImage: number; withFormulaUnread: number };
  fatal: string | null;
}

export const AZOTA_MAX_QUESTIONS = 200;
const LEVELS: readonly Level[] = ["NB", "TH", "VD", "VDC"];
const OPT_SEQ = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const SUB_SEQ = ["a", "b", "c", "d"] as const;
const TEXT_MAX = 10_000, OPTION_MAX = 2_000, NOTE_MAX = 3_000;

// ── Đoạn văn phẳng: chữ + cờ gạch chân từng ký tự + hình kèm vị trí ───────────────────────────
interface ParaImg { at: number; index: number; readable: boolean }
interface Para { text: string; u: boolean[]; imgs: ParaImg[] }

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎" };
function scriptText(r: DocRun): string {
  const t = r.text;
  if (!t || (!r.sup && !r.sub) || r.formula) return t;
  const map = r.sup ? SUP : SUB;
  const out = [...t].map(ch => (/\s/.test(ch) ? ch : map[ch] ?? null));
  if (out.every(x => x !== null)) return out.join("");
  return r.sup ? `^(${t})` : `_(${t})`;
}

function paraFrom(runs: DocRun[]): Para {
  let text = ""; const u: boolean[] = []; const imgs: ParaImg[] = [];
  for (const r of runs) {
    if (r.image) imgs.push({ at: text.length, index: r.image.index, readable: r.image.readable });
    if (!r.text) continue;
    const t = scriptText(r).replace(/[   ]/g, " ").replace(/[​‌‍﻿]/g, "").normalize("NFC");
    for (let i = 0; i < t.length; i++) u.push(!!r.underline && !/\s/.test(t[i]));
    text += t;
  }
  return { text, u, imgs };
}
const paraFromText = (s: string): Para => ({ text: s, u: new Array(s.length).fill(false), imgs: [] });
function sliceP(p: Para, a: number, b: number = p.text.length): Para {
  return { text: p.text.slice(a, b), u: p.u.slice(a, b), imgs: p.imgs.filter(i => i.at >= a && i.at <= b).map(i => ({ ...i, at: i.at - a })) };
}
const flat = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Chữ sạch để lưu: tab → cách, gộp khoảng trắng, giữ ngắt dòng, bỏ dòng trống đầu/cuối. */
function cleanText(s: string): string {
  return s.split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

// ── Nhận dạng mốc ───────────────────────────────────────────────────────────────────────────
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const SECTION_RE = /^PHẦN\s+([IVX]+|\d+)(?![\p{L}\p{N}])\s*[.:\-–—)]?\s*/iu;
const QUESTION_RE = /^\s*Câu\s*(\d+)\s*[.:)]\s*/iu;
const END_RE = /^[\s\-–—_=*~.]*HẾT[\s\-–—_=*~.]*$/iu;
const SOLUTION_RE = /^(?:Lời giải chi tiết|Lời giải|Hướng dẫn giải)\s*[:：]?\s*([\s\S]*)$/iu;
const ANSWER_LINE_RE = /^\s*Đáp án\s*[:：]\s*([\s\S]*)$/iu;
const PLACEHOLDER_SOLUTION_RE = /^(?:Câu\s*\d+\s*[:.]\s*)?[A-H]?\s*(?:đúng|sai)?\s*vì\s*[….\s]*$/iu;

function sectionNumber(tok: string): number { return /^\d+$/.test(tok) ? Number(tok) : ROMAN[tok.toUpperCase()] ?? 0; }

function typeOfSection(headerText: string): AzotaType | null {
  const lower = headerText.toLowerCase();
  if (/nhiều đáp án/.test(lower)) return "MC_MULTI";
  if (/đúng\s*[-–/]?\s*sai/.test(lower)) return "TRUE_FALSE_CLUSTER";
  if (/trả lời ngắn/.test(lower)) return "SHORT_ANSWER";
  if (/tự luận/.test(lower)) return "ESSAY";
  if (/một đáp án|nhiều phương án|một phương án|trắc nghiệm/.test(lower)) return "MC";
  return null;
}
function sectionLabelOf(headerText: string): string {
  const pieces = headerText.split(/(?<=\.)\s+/);
  let label = pieces[0] ?? headerText;
  if (/^PHẦN\s+\S+\.?$/iu.test(label) && pieces[1]) label = `${label} ${pieces[1]}`;
  return label.replace(/[.\s]+$/, "").slice(0, 150);
}

// ── Tìm nhãn phương án / ý Đ-S trong một đoạn ──────────────────────────────────────────────────
interface Token { letter: string; pos: number; letterIdx: number; textStart: number; star: boolean }
/**
 * Tìm dãy nhãn KẾ TIẾP ĐÚNG THỨ TỰ bắt đầu từ `seq[0]`. Một nhãn chỉ được nhận khi đứng đầu đoạn, hoặc sau tab / ngắt dòng / ≥2 dấu cách
 * (tránh nhầm "điểm A." giữa câu). `closers` = ký tự đóng nhãn hợp lệ ("." hoặc ")" cho phương án; chỉ ")" cho ý Đ-S).
 */
function findTokens(p: Para, seq: readonly string[], closers: string): Token[] {
  const t = p.text; const out: Token[] = [];
  let k = 0;
  for (let i = 0; i < t.length && k < seq.length; i++) {
    let star = false, li = i;
    if (t[i] === "*" && t[i + 1] === seq[k]) { star = true; li = i + 1; }
    if (t[li] !== seq[k] || li + 1 >= t.length || !closers.includes(t[li + 1])) continue;
    const before = t.slice(0, i);
    const sepOk = /^\s*$/.test(before) || /[\t\n]\s*$/.test(before) || /\s{2,}$/.test(before);
    if (!sepOk) continue;
    let ts = li + 2; while (ts < t.length && /[ \t]/.test(t[ts])) ts++;
    out.push({ letter: seq[k], pos: i, letterIdx: li, textStart: ts, star });
    k++; i = li + 1;
  }
  return out;
}

// ── Câu đang dựng ───────────────────────────────────────────────────────────────────────────
type Item = { kind: "p"; para: Para } | { kind: "t"; lines: string[]; cells: string[][] };
interface Sec { index: number; label: string; type: AzotaType; known: boolean }
interface QB { number: number; sec: Sec; items: Item[]; block: number }
interface Src { src: Exclude<AnswerSource, "khong-co">; val: string; bad?: boolean; display?: string }
interface Draft {
  q: AzotaQuestion; srcs: Src[]; optionLetters: string[]; block: number; unreadableImage: boolean; extraImages: number;
  explFromKey?: string;
}
const SRC_ORDER: Src["src"][] = ["dau-gach-chan", "mau", "bang-het", "loi-giai"];

const canonLetters = (ls: readonly string[]): string => [...new Set(ls.map(l => l.toUpperCase()))].sort().join("");
const normShort = (s: string): string => s.replace(/[−–]/g, "-").replace(/\s+/g, "").replace(/,/g, ".").replace(/\.+$/, "").toLowerCase();
const tfWord = (w: string): "Đ" | "S" | null => (/^(đ|đúng|d|true|t)$/i.test(w.trim()) ? "Đ" : /^(s|sai|false|f)$/i.test(w.trim()) ? "S" : null);

function highest(levels: Level[]): Level | null {
  let best = -1;
  for (const l of levels) best = Math.max(best, LEVELS.indexOf(l));
  return best < 0 ? null : LEVELS[best];
}

/** Chữ cái đáp án trong chuỗi như "A", "B, D", "A|B|D", "AB". Trả [] nếu có chữ lạ. */
function lettersIn(s: string): string[] {
  const t = s.trim().replace(/[.\s]+$/, "");
  if (/^[a-h]$/.test(t)) return [t.toUpperCase()];
  if (!/^[A-H](?:\s*(?:[,|;/&]|và)?\s*[A-H])*$/u.test(t)) return [];
  return [...t.matchAll(/[A-H]/g)].map(m => m[0]);
}

function levelOf(s: string): Level | null {
  const u = s.toUpperCase();
  return (LEVELS as readonly string[]).includes(u) ? (u as Level) : null;
}

// ── Dựng một câu từ các đoạn của nó ───────────────────────────────────────────────────────────────
function buildDraft(qb: QB, errors: AzotaParse["errors"], state: { tfOrderSeen: boolean }): Draft | null {
  const { sec } = qb;
  const key = `s${sec.index}-${qb.number}`;
  const fail = (m: string) => { errors.push({ block: qb.block, message: `Câu ${qb.number} (${sec.label || `Phần ${sec.index}`}): ${m}` }); return null; };

  // 1) Tách phần câu hỏi và phần Lời giải.
  const content: Item[] = [], expl: Item[] = [];
  let sawSolution = false;
  for (const it of qb.items) {
    if (!sawSolution && it.kind === "p") {
      const m = SOLUTION_RE.exec(flat(it.para.text));
      if (m) { sawSolution = true; if (m[1]) expl.push({ kind: "p", para: paraFromText(m[1]) }); continue; }
    }
    (sawSolution ? expl : content).push(it);
  }
  // "Đáp án: …" ở bất cứ đâu trong câu: lấy làm đáp án, không để lẫn vào đề.
  const answerLines: string[] = [];
  const stripAnswerLines = (list: Item[]): Item[] => list.filter(it => {
    if (it.kind !== "p") return true;
    const m = ANSWER_LINE_RE.exec(flat(it.para.text));
    if (!m) return true;
    answerLines.push(m[1]); return false;
  });
  const contentItems = stripAnswerLines(content), explItems = stripAnswerLines(expl);

  // 2) Hình: một hình/câu (hình đầu đọc được); thừa → cảnh báo.
  let imageIndex: number | undefined, extraImages = 0, unreadableImage = false;
  for (const it of contentItems) {
    if (it.kind !== "p") continue;
    for (const im of it.para.imgs) {
      if (!im.readable) unreadableImage = true;
      else if (imageIndex === undefined) imageIndex = im.index;
      else if (im.index !== imageIndex) extraImages++;
    }
  }

  // 3) Phương án / ý.
  const stemParts: string[] = [];
  const srcs: Src[] = [];
  const options: AzotaQuestion["options"] = [];
  let difficulty: Level | null = null;
  const optionLetters: string[] = [];

  if (sec.type === "MC" || sec.type === "MC_MULTI") {
    interface O { letter: string; text: string; u: boolean; star: boolean }
    const opts: O[] = [];
    let inOptions = false;
    for (const it of contentItems) {
      if (it.kind === "t") { const txt = it.lines.join("\n"); if (inOptions) opts[opts.length - 1].text += `\n${txt}`; else stemParts.push(txt); continue; }
      const p = it.para;
      const toks = findTokens(p, inOptions ? OPT_SEQ.slice(opts.length) : OPT_SEQ, ".)");
      if (toks.length === 0 || (!inOptions && toks[0].letter !== "A")) {
        const txt = p.text;
        if (!cleanText(txt)) continue;
        if (inOptions) opts[opts.length - 1].text += `\n${txt}`; else stemParts.push(txt);
        continue;
      }
      const pre = p.text.slice(0, toks[0].pos);
      if (cleanText(pre)) { if (inOptions) opts[opts.length - 1].text += `\n${pre}`; else stemParts.push(pre); }
      inOptions = true;
      toks.forEach((tk, i) => {
        const end = i + 1 < toks.length ? toks[i + 1].pos : p.text.length;
        opts.push({ letter: tk.letter, text: p.text.slice(tk.textStart, end), u: !!p.u[tk.letterIdx], star: tk.star });
      });
    }
    if (opts.length < 2) return fail("không đọc được ít nhất 2 phương án A. B. (mỗi phương án cần mở đầu bằng A. B. C. D.).");
    for (const o of opts) { options.push({ text: cleanText(o.text), isCorrect: false }); optionLetters.push(o.letter); }
    const uSet = opts.filter(o => o.u).map(o => o.letter), sSet = opts.filter(o => o.star).map(o => o.letter);
    const multi = sec.type === "MC_MULTI";
    if (uSet.length) srcs.push({ src: "dau-gach-chan", val: canonLetters(uSet), bad: multi ? uSet.length === opts.length : uSet.length !== 1 });
    if (sSet.length) srcs.push({ src: "mau", val: canonLetters(sSet), bad: multi ? sSet.length === opts.length : sSet.length !== 1 });
  } else if (sec.type === "TRUE_FALSE_CLUSTER") {
    interface S { letter: string; text: string; u: boolean; level: Level | null }
    const subs: S[] = [];
    let inSubs = false;
    const PREFIX = /^\[\s*(\d+)\s*[,;]\s*(NB|TH|VDC|VD)\s*\]\s*/iu;
    for (const it of contentItems) {
      if (it.kind === "t") { const txt = it.lines.join("\n"); if (inSubs) subs[subs.length - 1].text += `\n${txt}`; else stemParts.push(txt); continue; }
      const p = it.para;
      const toks = findTokens(p, inSubs ? SUB_SEQ.slice(subs.length) : SUB_SEQ, ")");
      if (toks.length === 0 || (!inSubs && toks[0].letter !== "a")) {
        if (!cleanText(p.text)) continue;
        if (inSubs) subs[subs.length - 1].text += `\n${p.text}`; else stemParts.push(p.text);
        continue;
      }
      const pre = p.text.slice(0, toks[0].pos);
      if (cleanText(pre)) { if (inSubs) subs[subs.length - 1].text += `\n${pre}`; else stemParts.push(pre); }
      inSubs = true;
      toks.forEach((tk, i) => {
        const end = i + 1 < toks.length ? toks[i + 1].pos : p.text.length;
        let txt = p.text.slice(tk.textStart, end);
        let level: Level | null = null;
        const m = PREFIX.exec(txt);
        if (m) { level = levelOf(m[2]); txt = txt.slice(m[0].length); state.tfOrderSeen = true; }
        subs.push({ letter: tk.letter, text: txt, u: !!p.u[tk.letterIdx], level });
      });
    }
    if (subs.length !== 4) return fail(`câu Đúng-Sai cần đủ 4 ý a) b) c) d) (đọc được ${subs.length}).`);
    subs.forEach(s => options.push({ text: cleanText(s.text), isCorrect: false, subLabel: s.letter }));
    optionLetters.push(...SUB_SEQ);
    difficulty = highest(subs.map(s => s.level).filter((l): l is Level => !!l));
    if (subs.some(s => s.u)) srcs.push({ src: "dau-gach-chan", val: subs.map(s => (s.u ? "Đ" : "S")).join("") });
  } else {
    for (const it of contentItems) {
      if (it.kind === "t") stemParts.push(it.lines.join("\n"));
      else if (cleanText(it.para.text)) stemParts.push(it.para.text);
    }
  }

  // 4) Đáp án từ Lời giải / dòng "Đáp án:".
  const explLines: string[] = [];
  for (const it of explItems) {
    if (it.kind === "t") explLines.push(...it.lines);
    else explLines.push(...it.para.text.split("\n"));
  }
  const explClean = explLines.map(l => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  const solutionText = explClean.join("\n");
  if (sec.type === "MC" || sec.type === "MC_MULTI") {
    const multi = sec.type === "MC_MULTI";
    let found: string[] | null = null;
    const cand = [...answerLines];
    for (const m of solutionText.matchAll(/Chọn\s+([A-H](?:\s*(?:[,|;/&]|và)\s*[A-H])*)(?![\p{L}\p{N}])/gu)) cand.push(m[1]);
    for (const c of cand) { const ls = lettersIn(c); if (ls.length) found = ls; } // lấy cái SAU CÙNG
    if (found && (multi || found.length === 1) && found.every(l => optionLetters.includes(l))) srcs.push({ src: "loi-giai", val: canonLetters(found) });
  } else if (sec.type === "TRUE_FALSE_CLUSTER") {
    const vec: Record<string, "Đ" | "S"> = {};
    for (const l of explClean) {
      const m = /^([a-d])\s*\)\s*(Đúng|Sai)(?![\p{L}\p{N}])/iu.exec(l);
      if (m) { const w = tfWord(m[2]); if (w) vec[m[1].toLowerCase()] = w; }
    }
    if (SUB_SEQ.every(k => vec[k])) srcs.push({ src: "loi-giai", val: SUB_SEQ.map(k => vec[k]).join("") });
  } else if (sec.type === "SHORT_ANSWER") {
    const raw = answerLines.find(a => a.trim());
    if (raw) { const disp = raw.replace(/[−–]/g, "-").replace(/[.\s]+$/, "").trim(); if (disp) srcs.push({ src: "loi-giai", val: normShort(disp), display: disp }); }
  }

  // 5) Lời giải (chữ): bỏ dòng mẫu, với trả lời ngắn bỏ nhãn "Giải thích:".
  let explLinesOut = explClean.filter(l => !PLACEHOLDER_SOLUTION_RE.test(l));
  if (sec.type === "SHORT_ANSWER") {
    explLinesOut = explLinesOut.map(l => l.replace(/^Giải thích\s*[:：]?\s*/iu, "")).filter(Boolean);
  }
  const explanation = explLinesOut.join("\n").slice(0, NOTE_MAX);

  // 6) Đề.
  const text = cleanText(stemParts.join("\n")).slice(0, TEXT_MAX);
  if (!text && imageIndex === undefined) return fail("không có nội dung câu hỏi.");
  const flags: AzotaFlag[] = [];
  const hasFormula = text.includes(FORMULA_PLACEHOLDER) || options.some(o => o.text.includes(FORMULA_PLACEHOLDER));
  if (hasFormula) flags.push("formula_unread");
  if (unreadableImage) flags.push("image_unreadable");
  for (const o of options) o.text = o.text.slice(0, OPTION_MAX);

  return {
    q: { key, number: qb.number, sectionIndex: sec.index, sectionLabel: sec.label, type: sec.type, text: text || "(Câu hỏi bằng hình)", ...(imageIndex !== undefined ? { imageIndex } : {}), options, explanation, difficulty, answerSource: "khong-co", flags },
    srcs, optionLetters, block: qb.block, unreadableImage, extraImages,
  };
}

// ── Bảng đáp án sau "HẾT" ───────────────────────────────────────────────────────────────────
interface KeyEntry { kind: "letters" | "tf" | "text"; val: string; display?: string; used?: boolean }

function parseKeyArea(items: { item: Item; block: number }[], secs: Sec[], warn: (q: string, c: string, m: string) => void): { keys: Map<string, KeyEntry>; expl: Map<string, string> } {
  const keys = new Map<string, KeyEntry>();
  const expl = new Map<string, string>();
  const byIndex = new Map(secs.map(s => [s.index, s] as const));
  let ksec: number | null = null, solMode = false, ordinal = 0, lastExpl: string | null = null;
  const firstOf = (pred: (s: Sec) => boolean): number | null => secs.find(pred)?.index ?? null;
  const put = (secIdx: number | null, n: number, e: KeyEntry) => {
    const si = secIdx ?? (e.kind === "tf" ? firstOf(s => s.type === "TRUE_FALSE_CLUSTER") : e.kind === "letters" ? firstOf(s => s.type === "MC" || s.type === "MC_MULTI") : firstOf(s => s.type === "SHORT_ANSWER"));
    if (si === null) { warn(`?-${n}`, "orphan_key", `Có đáp án cho câu ${n} nhưng đề không có phần nào đúng loại.`); return; }
    const k = `s${si}-${n}`;
    if (keys.has(k)) warn(k, "duplicate_key", `Bảng đáp án ghi hai lần cho câu ${n} (phần ${si}); lấy lần đầu.`);
    else keys.set(k, e);
  };
  const valueEntry = (secIdx: number | null, raw: string): KeyEntry | null => {
    const v = raw.trim();
    if (!v) return null;
    const type = secIdx !== null ? byIndex.get(secIdx)?.type : undefined;
    if (type === "SHORT_ANSWER") { const d = v.replace(/[−–]/g, "-").replace(/[.\s]+$/, ""); return { kind: "text", val: normShort(d), display: d }; }
    const ls = lettersIn(v);
    if (type === "MC" || type === "MC_MULTI" || (type === undefined && ls.length)) return ls.length ? { kind: "letters", val: canonLetters(ls) } : { kind: "letters", val: "!" + v };
    if (type === undefined) { const d = v.replace(/[−–]/g, "-").replace(/[.\s]+$/, ""); return { kind: "text", val: normShort(d), display: d }; }
    return null;
  };

  for (const { item } of items) {
    if (item.kind === "p") {
      const t = flat(item.para.text);
      if (!t) continue;
      const sm = SECTION_RE.exec(t.normalize("NFC"));
      if (sm) { ordinal++; ksec = sectionNumber(sm[1]) || ordinal; solMode = false; lastExpl = null; continue; }
      if (/^(?:Lời giải chi tiết|Lời giải|Hướng dẫn giải)\s*[:：]?\s*$/iu.test(t)) { solMode = true; lastExpl = null; continue; }
      const qm = /^Câu\s*(\d+)\s*[.:)]\s*(.*)$/iu.exec(t);
      if (solMode) {
        if (qm) {
          const rest = qm[2].trim();
          const k = `s${ksec ?? 0}-${Number(qm[1])}`;
          if (rest && !PLACEHOLDER_SOLUTION_RE.test(t)) { expl.set(k, rest); lastExpl = k; } else lastExpl = null;
        } else if (lastExpl) expl.set(lastExpl, `${expl.get(lastExpl)}\n${t}`);
        continue;
      }
      if (qm) {
        const n = Number(qm[1]);
        const e = valueEntry(ksec, qm[2]);
        if (e) put(ksec, n, e);
        continue;
      }
      const pairs = parseAnswerKeyText(t);
      for (const [num, letter] of Object.entries(pairs)) { const e = valueEntry(ksec, letter); if (e) put(ksec, Number(num), e); }
      continue;
    }
    // Bảng
    const rows = item.cells.map(r => r.map(c => c.trim()));
    // Dạng ngang: hàng "Câu | 1 | 2 …" rồi hàng "Chọn | D | A …" (có thể lặp nhiều cặp).
    let handled = false;
    for (let r = 0; r + 1 < rows.length; r++) {
      if (/^Câu$/iu.test(rows[r][0] ?? "") && rows[r].slice(1).some(c => /^\d+$/.test(c)) && /^(Chọn|Đáp án|ĐA|Key|Kết quả)/iu.test(rows[r + 1][0] ?? "")) {
        handled = true;
        rows[r].slice(1).forEach((c, i) => { if (/^\d+$/.test(c)) { const e = valueEntry(ksec, rows[r + 1][i + 1] ?? ""); if (e) put(ksec, Number(c), e); } });
        r++;
      }
    }
    if (handled) continue;
    // Dạng Đ/S: hàng tiêu đề "Câu 1 | Câu 2", các hàng sau "a) Đ | a) Đ".
    const head = rows[0] ?? [];
    if (head.length && head.every(c => /^Câu\s*\d+$/iu.test(c))) {
      const nums = head.map(c => Number(/\d+/.exec(c)![0]));
      const vecs: string[][] = nums.map(() => []);
      const seen: Record<string, boolean>[] = nums.map(() => ({}));
      for (const row of rows.slice(1)) row.forEach((c, i) => {
        const m = /^([a-d])\s*\)\s*(\S.*)$/iu.exec(c);
        const w = m ? tfWord(m[2]) : null;
        if (m && w && i < nums.length) { seen[i][m[1].toLowerCase()] = true; vecs[i][SUB_SEQ.indexOf(m[1].toLowerCase() as (typeof SUB_SEQ)[number])] = w; }
      });
      nums.forEach((n, i) => { if (SUB_SEQ.every(k => seen[i][k])) put(ksec ?? firstOf(s => s.type === "TRUE_FALSE_CLUSTER"), n, { kind: "tf", val: vecs[i].join("") }); });
      continue;
    }
    // Dạng dọc: mỗi hàng "Câu N | giá trị" hoặc "N | giá trị".
    for (const row of rows) {
      const m = /^(?:Câu\s*)?(\d+)$/iu.exec(row[0] ?? "");
      if (m && row.length >= 2) { const e = valueEntry(ksec, row[1]); if (e) put(ksec, Number(m[1]), e); }
    }
  }
  return { keys, expl };
}

/** "1-A, 2.B, 3:C" / "Câu 4. A|B" → { 1: "A", 2: "B", 3: "C", 4: "AB" } — cho đáp án gõ chữ thuần (PDF/ảnh qua AI). Chữ cái in hoa, nhiều đáp án gộp liền. */
export function parseAnswerKeyText(text: string): Record<number | string, string> {
  const out: Record<number | string, string> = {};
  const re = /(?:Câu\s*)?(\d+)\s*[-.:)=]\s*([A-Ha-h](?:\s*[,|;]\s*[A-Ha-h])*)(?![\p{L}\p{N}])/giu;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (!(n in out)) out[n] = [...m[2].toUpperCase().matchAll(/[A-H]/g)].map(x => x[0]).join("");
  }
  return out;
}

// ── Hàm chính ───────────────────────────────────────────────────────────────────────────────
export function parseAzotaBlocks(blocks: DocBlock[]): AzotaParse {
  const errors: AzotaParse["errors"] = [];
  const warnings: AzotaParse["warnings"] = [];
  const warn = (question: string, code: string, message: string) => { warnings.push({ question, code, message }); };
  const empty = (fatal: string | null): AzotaParse => ({ questions: [], errors, warnings, stats: { total: 0, byType: {}, withAnswer: 0, withImage: 0, withFormulaUnread: 0 }, fatal });
  if (!Array.isArray(blocks) || blocks.length === 0) return empty("Tệp Word trống — chưa thấy chữ nào.");

  const toItem = (b: DocBlock): Item => {
    if (b.kind === "p") return { kind: "p", para: paraFrom(b.runs) };
    const cells = b.rows.map(row => row.map(c => flat(c.paragraphs.map(r => paraFrom(r).text).join(" "))));
    return { kind: "t", cells, lines: cells.filter(r => r.some(Boolean)).map(r => r.join(" | ")) };
  };

  const secs: Sec[] = [];
  const qbs: QB[] = [];
  const keyItems: { item: Item; block: number }[] = [];
  let cur: QB | null = null, curSec: Sec | null = null, inKey = false, ordinal = 0;

  for (let bi = 0; bi < blocks.length; bi++) {
    const item = toItem(blocks[bi]);
    if (inKey) { keyItems.push({ item, block: bi }); continue; }
    if (item.kind === "t") { if (cur) cur.items.push(item); continue; }
    const p = item.para;
    const t = flat(p.text).normalize("NFC");
    if (END_RE.test(t) && t.toUpperCase().includes("HẾT")) { inKey = true; cur = null; continue; }
    const sm = SECTION_RE.exec(t);
    if (sm) {
      ordinal++;
      const type = typeOfSection(t);
      curSec = { index: sectionNumber(sm[1]) || ordinal, label: sectionLabelOf(t), type: type ?? "MC", known: type !== null };
      if (!type) warn("", "section_type_unknown", `${curSec.label}: không đoán được loại câu từ tiêu đề; tạm coi là "Một đáp án".`);
      secs.push(curSec); cur = null;
      continue;
    }
    const qm = QUESTION_RE.exec(p.text);
    if (qm) {
      // Hình đứng TRƯỚC chữ "Câu N." trong cùng đoạn (chỉ cách bởi khoảng trắng) là của câu trước.
      const labelStart = p.text.search(/\S/);
      const lead = p.imgs.filter(i => i.at <= labelStart);
      if (cur && lead.length) cur.items.push({ kind: "p", para: { text: "", u: [], imgs: lead.map(i => ({ ...i, at: 0 })) } });
      if (!curSec) {
        curSec = { index: 1, label: "", type: "MC", known: false };
        secs.push(curSec);
        warn("", "no_section", `Chưa thấy mốc "PHẦN I. …" trước câu đầu; tạm coi các câu là "Một đáp án".`);
      }
      cur = { number: Number(qm[1]), sec: curSec, items: [{ kind: "p", para: sliceP(p, qm[0].length) }], block: bi };
      qbs.push(cur);
      continue;
    }
    if (cur) cur.items.push(item);
  }

  // Dựng từng câu.
  const state = { tfOrderSeen: false };
  const drafts: Draft[] = [];
  const usedKeys = new Set<string>();
  for (const qb of qbs) {
    const d = buildDraft(qb, errors, state);
    if (!d) continue;
    let k = d.q.key, n = 2;
    while (usedKeys.has(k)) { k = `${d.q.key}#${n++}`; }
    if (k !== d.q.key) { warn(k, "duplicate_number", `Câu ${d.q.number} xuất hiện hai lần trong ${d.q.sectionLabel || `phần ${d.q.sectionIndex}`}; bảng đáp án chỉ khớp với câu đầu.`); d.q.key = k; }
    usedKeys.add(k);
    drafts.push(d);
  }

  // Bảng đáp án.
  const { keys, expl } = parseKeyArea(keyItems, secs, warn);
  const consumed = new Set<string>();
  for (const d of drafts) {
    const base = d.q.key.replace(/#\d+$/, "");
    const k = keys.get(base);
    if (k && d.q.key === base) {
      consumed.add(base);
      const t = d.q.type;
      const ok = (k.kind === "letters" && (t === "MC" || t === "MC_MULTI")) || (k.kind === "tf" && t === "TRUE_FALSE_CLUSTER") || (k.kind === "text" && t === "SHORT_ANSWER");
      if (ok) {
        let bad = k.val.startsWith("!");
        if (k.kind === "letters" && !bad) {
          const ls = [...k.val];
          bad = ls.some(l => !d.optionLetters.includes(l)) || (t === "MC" && ls.length !== 1) || (t === "MC_MULTI" && ls.length === d.optionLetters.length);
        }
        d.srcs.push({ src: "bang-het", val: k.val, bad, display: k.display });
      } else warn(base, "key_type_mismatch", `Câu ${d.q.number} (${d.q.sectionLabel || `phần ${d.q.sectionIndex}`}): bảng đáp án có dạng khác loại câu; bỏ qua.`);
    }
    const e = expl.get(base);
    if (e && !d.q.explanation && d.q.key === base) d.q.explanation = e.slice(0, NOTE_MAX);
  }
  for (const k of keys.keys()) if (!consumed.has(k)) warn(k, "orphan_key", `Bảng đáp án có khoá "${k}" nhưng đề không có câu tương ứng.`);
  if (state.tfOrderSeen) warn("", "tf_order_ignored", "Tiền tố [n, MỨC] ở ý Đúng-Sai: KiN chỉ lấy MỨC; số n (thứ tự đảo ý) chưa hỗ trợ nên bị bỏ.");

  // Chốt đáp án.
  for (const d of drafts) {
    const q = d.q;
    const label = `Câu ${q.number} (${q.sectionLabel || `phần ${q.sectionIndex}`})`;
    if (d.extraImages > 0) warn(q.key, "extra_images", `${label}: có ${d.extraImages + 1} hình, KiN chỉ giữ 1 hình/câu (hình đầu); thêm hình còn lại bằng tay.`);
    if (d.unreadableImage) warn(q.key, "image_unreadable", `${label}: có hình định dạng WMF/EMF hoặc quá giới hạn — KiN chưa hiển thị được, cần chèn lại hình.`);
    if (q.flags.includes("formula_unread")) warn(q.key, "formula_unread", `${label}: có công thức MathType chưa đọc được (đã gắn nhãn ${FORMULA_PLACEHOLDER}). Sửa tay trước khi phát hành.`);
    if (q.type === "ESSAY") continue;
    const srcs = [...d.srcs].sort((a, b) => SRC_ORDER.indexOf(a.src) - SRC_ORDER.indexOf(b.src));
    if (srcs.length === 0) { q.flags.push("answer_missing"); warn(q.key, "answer_missing", `${label}: chưa có đáp án (không thấy gạch chân, dấu *, bảng đáp án hay "Chọn X" trong lời giải).`); continue; }
    const vals = new Set(srcs.map(s => (s.bad ? "!bad" : s.val)));
    if (vals.size > 1 || vals.has("!bad")) {
      q.flags.push("answer_conflict");
      warn(q.key, "answer_conflict", `${label}: các nguồn đáp án (${srcs.map(s => s.src).join(", ")}) không khớp nhau — KiN không chọn đáp án nào, cô chọn lại.`);
      if (q.type === "SHORT_ANSWER") q.options = [];
      continue;
    }
    const first = srcs[0];
    q.answerSource = first.src;
    if (q.type === "MC" || q.type === "MC_MULTI") {
      const set = new Set([...first.val]);
      q.options.forEach((o, i) => { o.isCorrect = set.has(d.optionLetters[i]); });
    } else if (q.type === "TRUE_FALSE_CLUSTER") {
      q.options.forEach((o, i) => { o.isCorrect = first.val[i] === "Đ"; });
    } else if (q.type === "SHORT_ANSWER") {
      const disp = (srcs.find(s => s.display)?.display ?? first.val).slice(0, OPTION_MAX);
      q.options = [{ text: disp, isCorrect: true }];
    }
  }

  const questions = drafts.map(d => d.q);
  if (questions.length > AZOTA_MAX_QUESTIONS) return { ...empty(`Tệp có ${questions.length} câu, quá giới hạn ${AZOTA_MAX_QUESTIONS} câu một lần. Cô tách thành nhiều tệp.`), errors, warnings };
  if (questions.length === 0) return empty('Không thấy câu nào theo mẫu Azota (mỗi câu mở đầu bằng "Câu 1." hoặc "Câu 1:").');

  const byType: Record<string, number> = {};
  for (const q of questions) byType[q.type] = (byType[q.type] ?? 0) + 1;
  return {
    questions, errors, warnings,
    stats: {
      total: questions.length, byType,
      withAnswer: questions.filter(q => q.type !== "ESSAY" && q.answerSource !== "khong-co" && !q.flags.includes("answer_conflict")).length,
      withImage: questions.filter(q => q.imageIndex !== undefined || q.imageUrl).length,
      withFormulaUnread: questions.filter(q => q.flags.includes("formula_unread")).length,
    },
    fatal: null,
  };
}

// ── Sang dạng lưu ───────────────────────────────────────────────────────────────────────────
/** QuizQuestionInput (cùng kiểu `import-save`) + `difficulty`/`categoryId` tuỳ chọn cho `luu-nhieu`. Điểm đặt 1; chia lại sau bằng distributePoints. */
export type AzotaQuizInput = QuizQuestionInput & { difficulty?: Level; categoryId?: string };

export function toQuizInput(q: AzotaQuestion, overrides: { difficulty?: Level; categoryId?: string } = {}): AzotaQuizInput {
  const difficulty = overrides.difficulty ?? q.difficulty ?? undefined;
  return {
    type: q.type,
    text: q.text,
    points: 1,
    imageUrl: q.imageUrl ?? null,
    explanation: q.explanation ? q.explanation.slice(0, NOTE_MAX) : null,
    sectionLabel: q.sectionLabel || null,
    options: q.type === "ESSAY" ? [] : q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel ?? null })),
    ...(difficulty ? { difficulty } : {}),
    ...(overrides.categoryId ? { categoryId: overrides.categoryId } : {}),
  };
}
