// Tách câu, tách từ, tính độ phủ từ vựng — thuần, chạy được cả máy chủ lẫn trình duyệt.
// Lemma do nơi gọi truyền vào (máy chủ dùng lexicon.lemmatize) để file này không kéo theo từ điển 380 KB.

export interface Token {
  /** Chữ gốc đúng như trong bài (giữ hoa/thường). */
  text: string;
  /** true = một từ tiếng Anh (chữ cái, có thể có ' hoặc - ở giữa). */
  isWord: boolean;
  lower: string;
  lemma: string;
  /** Viết hoa không ở đầu câu → coi là tên riêng, không tính vào độ phủ. */
  proper: boolean;
  /** Chỉ số câu chứa token. */
  sentence: number;
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*/y;

/** Chia đoạn văn thành câu. Giữ nguyên dấu câu cuối. Không tách ở "Mr." "Dr." "e.g." "U.S.". */
export function splitSentences(text: string): string[] {
  const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|No)\.)$/;
  const out: string[] = [];
  const paras = text.replace(/\r/g, "").split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
  for (const p of paras) {
    let start = 0;
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (ch !== "." && ch !== "!" && ch !== "?") continue;
      // gom dấu đóng ngoặc / nháy ngay sau
      let j = i + 1;
      while (j < p.length && /["'”’)\]]/.test(p[j])) j++;
      if (j < p.length && !/\s/.test(p[j])) continue; // 3.5, U.S.A
      const piece = p.slice(start, j).trim();
      if (ch === "." && ABBR.test(piece)) continue;
      const next = p.slice(j).trimStart();
      if (next && /^[a-z]/.test(next)) continue; // chữ thường sau dấu chấm → chưa hết câu
      if (piece) out.push(piece);
      start = j;
      i = j - 1;
    }
    const rest = p.slice(start).trim();
    if (rest) out.push(rest);
  }
  return out;
}

export function tokenize(text: string, lemmatize: (w: string) => string = w => w.toLowerCase()): Token[] {
  const tokens: Token[] = [];
  const sentences = splitSentences(text);
  sentences.forEach((s, si) => {
    let i = 0;
    let firstWord = true;
    while (i < s.length) {
      WORD_RE.lastIndex = i;
      const m = WORD_RE.exec(s);
      if (m && m.index === i) {
        const t = m[0];
        const lower = t.toLowerCase().replace(/’/g, "'");
        const proper = !firstWord && /^[A-Z]/.test(t) && t !== "I" && !/^I['’]/.test(t);
        tokens.push({ text: t, isWord: true, lower, lemma: lemmatize(lower), proper, sentence: si });
        firstWord = false;
        i += t.length;
      } else {
        // gom mọi ký tự không phải chữ thành một token
        let j = i + 1;
        while (j < s.length) { WORD_RE.lastIndex = j; const mm = WORD_RE.exec(s); if (mm && mm.index === j) break; j++; }
        tokens.push({ text: s.slice(i, j), isWord: false, lower: "", lemma: "", proper: false, sentence: si });
        i = j;
      }
    }
    if (si < sentences.length - 1) tokens.push({ text: " ", isWord: false, lower: "", lemma: "", proper: false, sentence: si });
  });
  return tokens;
}

export interface Coverage {
  /** Số từ được tính (bỏ tên riêng). */
  counted: number;
  known: number;
  /** 0–1 */
  ratio: number;
  /** Các lemma chưa biết, theo thứ tự xuất hiện, không lặp. */
  unknown: string[];
}

/** Độ phủ = tỉ lệ từ trong bài thuộc tập lemma người học đã biết. Tên riêng và từ 1 chữ cái (trừ a/I) không tính. */
export function coverage(tokens: Token[], known: Set<string>): Coverage {
  let counted = 0, k = 0;
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!t.isWord || t.proper) continue;
    if (t.lower.length === 1 && t.lower !== "a" && t.lower !== "i") continue;
    counted++;
    if (known.has(t.lemma)) k++;
    else if (!seen.has(t.lemma)) { seen.add(t.lemma); unknown.push(t.lemma); }
  }
  return { counted, known: k, ratio: counted ? k / counted : 1, unknown };
}

/** Phân loại bài theo độ phủ: ≥98% đọc nhẹ, 95–98% đọc học, <95% quá khó (để sau hoặc nhờ AI viết lại dễ hơn). */
export function coverageLevel(ratio: number): "nhe" | "hoc" | "kho" {
  if (ratio >= 0.98) return "nhe";
  if (ratio >= 0.95) return "hoc";
  return "kho";
}

export function countWords(text: string): number {
  return (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? []).length;
}
