// Từ điển tần suất + tách lemma cho phần Tiếng Anh. Chỉ dùng phía máy chủ (dữ liệu ~380 KB).
// Dữ liệu: NGSL 1.01 / NAWL (CC BY-SA 4.0) — xem data/NGUON-DU-LIEU.md.
import wordlistsRaw from "./data/wordlists.json";
import freqRaw from "./data/freq-25k.json";

export type WordList = "ngsl" | "sup" | "nawl";
export interface ListEntry { lemma: string; list: WordList; listRank: number | null; freqRank: number | null }

const WORDLISTS: ListEntry[] = (wordlistsRaw as [string, WordList, number | null, number | null][])
  .map(([lemma, list, listRank, freqRank]) => ({ lemma, list, listRank, freqRank }));
const LIST_BY_LEMMA = new Map(WORDLISTS.map(e => [e.lemma, e]));
const FREQ_RANK = new Map((freqRaw as string[]).map((l, i) => [l, i + 1]));

export function allListEntries(): ListEntry[] { return WORDLISTS; }
export function listEntry(lemma: string): ListEntry | undefined { return LIST_BY_LEMMA.get(lemma); }
/** Thứ hạng tần suất chung (1 = phổ biến nhất), undefined nếu ngoài 25.000 từ đầu. */
export function freqRank(lemma: string): number | undefined { return FREQ_RANK.get(lemma) ?? LIST_BY_LEMMA.get(lemma)?.freqRank ?? undefined; }
export function isKnownLemma(w: string): boolean { return FREQ_RANK.has(w) || LIST_BY_LEMMA.has(w); }

// Động từ / danh từ bất quy tắc thường gặp → lemma. Không cần đầy đủ: phần còn lại đi qua luật hậu tố + từ điển.
const IRREGULAR: Record<string, string> = {};
const IRR_GROUPS: [string, string[]][] = [
  ["be", ["am", "is", "are", "was", "were", "been", "being", "'m", "'re"]], ["have", ["has", "had", "having", "'ve"]],
  ["do", ["does", "did", "done", "doing"]], ["go", ["goes", "went", "gone", "going"]], ["say", ["said", "says"]],
  ["make", ["made"]], ["get", ["got", "gotten"]], ["know", ["knew", "known"]], ["think", ["thought"]], ["take", ["took", "taken"]],
  ["see", ["saw", "seen"]], ["come", ["came"]], ["give", ["gave", "given"]], ["find", ["found"]], ["tell", ["told"]],
  ["become", ["became"]], ["leave", ["left"]], ["feel", ["felt"]], ["bring", ["brought"]], ["begin", ["began", "begun"]],
  ["keep", ["kept"]], ["hold", ["held"]], ["write", ["wrote", "written"]], ["stand", ["stood"]], ["hear", ["heard"]],
  ["mean", ["meant"]], ["meet", ["met"]], ["run", ["ran"]], ["pay", ["paid"]], ["sit", ["sat"]], ["speak", ["spoke", "spoken"]],
  ["lie", ["lay", "lain", "lying"]], ["lead", ["led"]], ["read", []], ["grow", ["grew", "grown"]], ["lose", ["lost"]],
  ["fall", ["fell", "fallen"]], ["send", ["sent"]], ["build", ["built"]], ["understand", ["understood"]], ["draw", ["drew", "drawn"]],
  ["break", ["broke", "broken"]], ["spend", ["spent"]], ["rise", ["rose", "risen"]], ["drive", ["drove", "driven"]],
  ["buy", ["bought"]], ["wear", ["wore", "worn"]], ["choose", ["chose", "chosen"]], ["seek", ["sought"]], ["throw", ["threw", "thrown"]],
  ["catch", ["caught"]], ["deal", ["dealt"]], ["win", ["won"]], ["forget", ["forgot", "forgotten"]], ["sell", ["sold"]],
  ["fight", ["fought"]], ["teach", ["taught"]], ["eat", ["ate", "eaten"]], ["sing", ["sang", "sung"]], ["drink", ["drank", "drunk"]],
  ["fly", ["flew", "flown", "flies"]], ["hide", ["hid", "hidden"]], ["ride", ["rode", "ridden"]], ["shake", ["shook", "shaken"]],
  ["steal", ["stole", "stolen"]], ["swim", ["swam", "swum"]], ["wake", ["woke", "woken"]], ["feed", ["fed"]], ["flee", ["fled"]],
  ["hang", ["hung"]], ["shoot", ["shot"]], ["sleep", ["slept"]], ["slide", ["slid"]], ["stick", ["stuck"]], ["strike", ["struck"]],
  ["swing", ["swung"]], ["bind", ["bound"]], ["bear", ["bore", "born", "borne"]], ["beat", ["beaten"]], ["bend", ["bent"]],
  ["bite", ["bit", "bitten"]], ["blow", ["blew", "blown"]], ["dig", ["dug"]], ["forgive", ["forgave", "forgiven"]],
  ["freeze", ["froze", "frozen"]], ["light", ["lit"]], ["mistake", ["mistook", "mistaken"]], ["prove", ["proven"]],
  ["seek", ["sought"]], ["shine", ["shone"]], ["show", ["shown"]], ["sink", ["sank", "sunk"]], ["spin", ["spun"]],
  ["spring", ["sprang", "sprung"]], ["swear", ["swore", "sworn"]], ["tear", ["tore", "torn"]], ["undertake", ["undertook", "undertaken"]],
  ["withdraw", ["withdrew", "withdrawn"]], ["arise", ["arose", "arisen"]], ["overcome", ["overcame"]], ["forbid", ["forbade", "forbidden"]],
  ["man", ["men"]], ["woman", ["women"]], ["child", ["children"]], ["person", ["people"]], ["foot", ["feet"]], ["tooth", ["teeth"]],
  ["mouse", ["mice"]], ["life", ["lives"]], ["wife", ["wives"]], ["knife", ["knives"]], ["leaf", ["leaves"]], ["half", ["halves"]],
  ["phenomenon", ["phenomena"]], ["criterion", ["criteria"]], ["analysis", ["analyses"]], ["crisis", ["crises"]],
  ["thesis", ["theses"]], ["hypothesis", ["hypotheses"]], ["datum", []], ["good", ["better", "best"]], ["bad", ["worse", "worst"]],
  ["far", ["further", "farther", "furthest", "farthest"]], ["will", ["would", "'ll"]], ["can", ["could"]], ["shall", ["should"]],
  ["may", ["might"]], ["i", ["me", "my", "mine", "myself"]], ["we", ["us", "our", "ours", "ourselves"]],
  ["he", ["him", "his", "himself"]], ["she", ["her", "hers", "herself"]], ["they", ["them", "their", "theirs", "themselves"]],
  ["you", ["your", "yours", "yourself", "yourselves"]], ["it", ["its", "itself"]], ["a", ["an"]],
];
for (const [base, forms] of IRR_GROUPS) for (const f of forms) IRREGULAR[f] = base;

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function candidates(w: string): string[] {
  const out: string[] = [];
  const push = (s: string) => { if (s.length >= 2 && !out.includes(s)) out.push(s); };
  if (w.endsWith("ies") && w.length > 4) push(w.slice(0, -3) + "y");
  if (w.endsWith("ied") && w.length > 4) push(w.slice(0, -3) + "y");
  if (w.endsWith("ier") || w.endsWith("iest")) push(w.replace(/i(er|est)$/, "y"));
  if (w.endsWith("es")) { push(w.slice(0, -2)); push(w.slice(0, -1)); }
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) push(w.slice(0, -1));
  for (const suf of ["ed", "ing", "er", "est"]) {
    if (!w.endsWith(suf) || w.length <= suf.length + 1) continue;
    const stem = w.slice(0, -suf.length);
    push(stem);
    push(stem + "e");
    const a = stem.at(-1), b = stem.at(-2);
    if (a && a === b && !VOWELS.has(a)) push(stem.slice(0, -1)); // stopped → stop, running → run
  }
  if (w.endsWith("ly") && w.length > 4) { push(w.slice(0, -2)); if (w.endsWith("ily")) push(w.slice(0, -3) + "y"); }
  return out;
}

/** Lemma của một từ (đã chữ thường hoá). Không chắc thì trả lại chính từ đó. */
export function lemmatize(word: string): string {
  let w = word.toLowerCase().replace(/[’`]/g, "'");
  if (w.endsWith("'s") || w.endsWith("s'")) w = w.replace(/'s?$/, "");
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (LIST_BY_LEMMA.has(w)) return w;
  const cands = candidates(w);
  // Ưu tiên lemma nằm trong NGSL/NAWL, rồi tới lemma có trong bảng tần suất (hạng nhỏ hơn thắng).
  const inList = cands.find(c => LIST_BY_LEMMA.has(c));
  if (inList) return inList;
  if (FREQ_RANK.has(w)) return w;
  let best: string | undefined; let bestRank = Infinity;
  for (const c of cands) { const r = FREQ_RANK.get(c); if (r !== undefined && r < bestRank) { best = c; bestRank = r; } }
  return best ?? w;
}

/** Nhóm độ khó theo thứ hạng tần suất: 1 = 1–1000, 2 = 1001–2000, … ; 9 = ngoài 8000 hoặc không có trong bảng. */
export function bandOf(lemma: string): number {
  const r = freqRank(lemma);
  if (!r) return 9;
  return Math.min(9, Math.ceil(r / 1000));
}

// Từ giả (không phải tiếng Anh) để phát hiện "khai biết quá tay" trong bài kiểm tra xếp lớp — kỹ thuật của bài yes/no test.
export const PSEUDOWORDS = [
  "brantle", "contrivate", "plorid", "sporlate", "mondage", "galpish", "trebulous", "flinder", "dostrate", "chalmy",
];
