// Chấm chép chính tả từng câu: so từng từ bằng dãy con chung dài nhất (LCS), bỏ qua hoa/thường và dấu câu.
// Thuần, chạy ở trình duyệt để tô đỏ ngay khi bấm "Kiểm tra".

export interface DictationWord {
  text: string;
  /** ok = gõ đúng; missing = có trong câu nhưng không gõ; wrong = gõ sai chính tả (đứng ở vị trí từ đó). */
  status: "ok" | "missing" | "wrong";
  typed?: string;
}
export interface DictationResult {
  words: DictationWord[];
  /** Từ gõ thừa (không có trong câu). */
  extra: string[];
  correct: number;
  total: number;
  /** 0–100 */
  score: number;
}

const norm = (w: string) => w.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9']/g, "");
const NUM: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
const same = (a: string, b: string) => a === b || NUM[a] === b || NUM[b] === a;

export function splitWords(s: string): string[] {
  return s.split(/\s+/).map(w => w.trim()).filter(w => norm(w).length > 0);
}

/** Khoảng cách Levenshtein (để phân biệt "gõ sai chính tả" với "bỏ sót"). */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function checkDictation(expected: string, typed: string): DictationResult {
  const exp = splitWords(expected), got = splitWords(typed);
  const E = exp.map(norm), G = got.map(norm);
  const n = E.length, m = G.length;
  const L = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = same(E[i], G[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);

  const words: DictationWord[] = [];
  const extra: string[] = [];
  let i = 0, j = 0;
  // Từ gõ thừa nằm giữa hai từ khớp: nếu giống chính tả một từ bị thiếu ở cùng khoảng thì coi là "gõ sai" từ đó.
  const pendingMissing: number[] = [];
  const pendingExtra: number[] = [];
  const flush = () => {
    for (const ei of pendingMissing) {
      const k = pendingExtra.findIndex(gi => editDistance(E[ei], G[gi]) <= Math.max(1, Math.floor(E[ei].length / 3)));
      if (k >= 0) { words[ei] = { text: exp[ei], status: "wrong", typed: got[pendingExtra[k]] }; pendingExtra.splice(k, 1); }
      else words[ei] = { text: exp[ei], status: "missing" };
    }
    for (const gi of pendingExtra) extra.push(got[gi]);
    pendingMissing.length = 0; pendingExtra.length = 0;
  };
  while (i < n || j < m) {
    if (i < n && j < m && same(E[i], G[j])) { flush(); words[i] = { text: exp[i], status: "ok" }; i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { pendingExtra.push(j); j++; }
    else { pendingMissing.push(i); i++; }
  }
  flush();
  const correct = words.filter(w => w.status === "ok").length;
  return { words, extra, correct, total: n, score: n ? Math.round((correct / n) * 100) : 100 };
}
