// Chấm câu trả lời bài tập ngữ pháp / đọc hiểu. Thuần.
// Quy ước đáp án (giống answer key của Grammar in Use): mỗi phần tử của `answers` là một đáp án đúng trọn vẹn;
// trong một đáp án, "/" ngăn các cách viết tương đương ("isn't / is not"), "(…)" là phần có cũng được không có cũng được.

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s*([,.!?;:])\s*/g, "$1 ")
    .replace(/[.!?;:,]+\s*$/, "")
    .trim();
}

const CONTRACTIONS: [RegExp, string][] = [
  [/\bisn't\b/g, "is not"], [/\baren't\b/g, "are not"], [/\bwasn't\b/g, "was not"], [/\bweren't\b/g, "were not"],
  [/\bdon't\b/g, "do not"], [/\bdoesn't\b/g, "does not"], [/\bdidn't\b/g, "did not"], [/\bhaven't\b/g, "have not"],
  [/\bhasn't\b/g, "has not"], [/\bhadn't\b/g, "had not"], [/\bwon't\b/g, "will not"], [/\bwouldn't\b/g, "would not"],
  [/\bcan't\b/g, "cannot"], [/\bcan not\b/g, "cannot"], [/\bcouldn't\b/g, "could not"], [/\bshouldn't\b/g, "should not"],
  [/\bmustn't\b/g, "must not"], [/\bi'm\b/g, "i am"], [/\b(you|we|they)'re\b/g, "$1 are"], [/\b(he|she|it|that|there|what)'s\b/g, "$1 is"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"], [/\b(i|you|we|they|he|she|it)'ll\b/g, "$1 will"], [/\b(i|you|we|they|he|she|it)'d\b/g, "$1 would"],
];
/** Mở rộng dạng viết tắt để "isn't" = "is not". ('s/'d mơ hồ nên chỉ áp cho đại từ.) */
export function expandContractions(s: string): string {
  let out = s;
  for (const [re, rep] of CONTRACTIONS) out = out.replace(re, rep);
  return out;
}

/** Sinh mọi biến thể của một đáp án có "(…)" tuỳ chọn. Giới hạn 64 biến thể. */
function optionalVariants(ans: string): string[] {
  const m = ans.match(/\(([^()]*)\)/);
  if (!m) return [ans];
  const before = ans.slice(0, m.index!), after = ans.slice(m.index! + m[0].length);
  const withIt = optionalVariants(before + m[1] + after);
  const without = optionalVariants(before + after);
  return [...withIt, ...without].slice(0, 64);
}

export function acceptedForms(answers: string[]): Set<string> {
  const out = new Set<string>();
  for (const a of answers) {
    for (const alt of a.split(/\s+\/\s+|\s*\/\s*(?=[A-Za-z'])/)) {
      for (const v of optionalVariants(alt)) {
        const n = normalizeAnswer(v);
        if (!n) continue;
        out.add(n);
        out.add(expandContractions(n));
      }
    }
  }
  return out;
}

export function gradeAnswer(answers: string[], input: string): boolean {
  const n = normalizeAnswer(input);
  if (!n) return false;
  const accepted = acceptedForms(answers);
  return accepted.has(n) || accepted.has(expandContractions(n));
}
