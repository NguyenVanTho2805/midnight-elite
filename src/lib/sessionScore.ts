// BU-11 — điểm 0 đến 10 và % hoàn thành BTVN của từng em ở từng buổi. Hàm THUẦN. Test: tools/local-e2e/t-session-score-lib.ts.
// Chỉ gia sư của lớp và phụ huynh của ĐÚNG em đó thấy; học sinh không thấy. Chỉ ghi khi hồ sơ của em có đồng ý phạm vi "scores".
export const SCORE_MAX = 10;
export const PCT_MAX = 100;
export const SCORE_ROWS_MAX = 500;

export interface ScoreRowIn { userId: string; score: number | null; homeworkPct: number | null }
export interface ScoreParse { rows: ScoreRowIn[]; errors: string[] }

/** Điểm: 0..10, bước 0,25 (7,5 / 8,25 đều được). null/rỗng = để trống. */
export function parseScore(v: unknown): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > SCORE_MAX || Math.round(n * 4) !== n * 4) return { ok: false };
  return { ok: true, value: n };
}
/** % hoàn thành BTVN: số nguyên 0..100. */
export function parsePct(v: unknown): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace("%", "").trim()) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > PCT_MAX) return { ok: false };
  return { ok: true, value: n };
}

export function parseScoreRows(raw: unknown): ScoreParse {
  const rows: ScoreRowIn[] = [], errors: string[] = [], seen = new Set<string>();
  if (!Array.isArray(raw)) return { rows, errors: ["Thiếu danh sách điểm"] };
  if (raw.length > SCORE_ROWS_MAX) return { rows, errors: [`Mỗi lần tối đa ${SCORE_ROWS_MAX} em`] };
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.userId !== "string" || !o.userId) continue;
    if (seen.has(o.userId)) { errors.push("Một em xuất hiện hai lần"); continue; }
    seen.add(o.userId);
    const s = parseScore(o.score), p = parsePct(o.homeworkPct);
    if (!s.ok) { errors.push(`Điểm phải từ 0 đến ${SCORE_MAX}, bước 0,25`); continue; }
    if (!p.ok) { errors.push(`Phần trăm BTVN phải là số nguyên từ 0 đến ${PCT_MAX}`); continue; }
    rows.push({ userId: o.userId, score: s.value, homeworkPct: p.value });
  }
  return { rows, errors };
}

/** Chip % hoàn thành: luôn có CHỮ đi kèm màu. */
export function pctChip(pct: number): { text: string; tone: "xong" | "cho" | "loi" } {
  return { text: `Hoàn thành BTVN ${pct}%`, tone: pct >= 80 ? "xong" : pct >= 50 ? "cho" : "loi" };
}
/** "7,5" kiểu Việt Nam. */
export const scoreText = (n: number): string => String(n).replace(".", ",");
