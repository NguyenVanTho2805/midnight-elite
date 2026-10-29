// Tìm trong kho tài liệu (NC2-046). THUẦN: không DB, không React. Test: tools/local-e2e/t-library-search-lib.ts.
//
// Gõ "chien tranh lanh" phải ra "Chiến tranh lạnh": so khớp KHÔNG phân biệt hoa thường và dấu tiếng Việt (đ = d). Mọi từ khoá phải xuất hiện (VÀ), ở bất kỳ trường nào;
// điểm cao hơn khi trùng ở tiêu đề, khi trùng đầu từ, và khi cả cụm khớp liền nhau.

/** Bỏ dấu, hạ chữ thường, mọi thứ không phải chữ / số thành một dấu cách. */
export function fold(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/\u0110/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const QUERY_MIN = 2;
export const QUERY_MAX = 100;
export const MAX_TOKENS = 8;

/** Từ khoá đã chuẩn hoá, bỏ trùng; từ 1 chữ cái bị bỏ (quá mơ hồ) trừ chữ số. Truy vấn ngắn hơn QUERY_MIN ký tự hoặc không còn từ nào → []. */
export function queryTokens(q: unknown): string[] {
  if (typeof q !== "string") return [];
  const f = fold(q.slice(0, QUERY_MAX * 2));
  if (f.replace(/ /g, "").length < QUERY_MIN) return [];
  const out: string[] = [];
  for (const t of f.split(" ")) if (t && (t.length > 1 || /\d/.test(t)) && !out.includes(t)) out.push(t);
  return out.slice(0, MAX_TOKENS);
}

export interface Field { text: string; weight: number }

/** 0 = không khớp. Mọi từ khoá phải có mặt trong ít nhất một trường. Đầu từ ×2; cả cụm liền nhau trong một trường +3×trọng số. */
export function scoreFields(tokens: string[], fields: Field[]): number {
  if (tokens.length === 0) return 0;
  const f = fields.map(x => ({ t: " " + fold(x.text) + " ", w: x.weight }));
  let total = 0;
  for (const tok of tokens) {
    let best = 0;
    for (const { t, w } of f) {
      if (t.includes(" " + tok)) best = Math.max(best, w * 2);
      else if (t.includes(tok)) best = Math.max(best, w);
    }
    if (best === 0) return 0;
    total += best;
  }
  if (tokens.length > 1) {
    const phrase = " " + tokens.join(" ");
    for (const { t, w } of f) if (t.includes(phrase)) { total += w * 3; break; }
  }
  return total;
}

/** Lọc + xếp theo điểm giảm dần (cùng điểm giữ thứ tự gốc), tối đa `limit`. */
export function searchRank<T>(items: readonly T[], query: unknown, fieldsOf: (item: T) => Field[], limit = 50): { item: T; score: number }[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const hits: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => { const score = scoreFields(tokens, fieldsOf(item)); if (score > 0) hits.push({ item, score, i }); });
  hits.sort((a, b) => b.score - a.score || a.i - b.i);
  return hits.slice(0, limit).map(({ item, score }) => ({ item, score }));
}
