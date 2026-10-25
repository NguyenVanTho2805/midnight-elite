// Bài kiểm tra xếp lớp từ vựng kiểu "Có/Không" (yes/no test) với từ giả để trừ phần khai quá tay. Thuần.
// Mỗi nhóm lấy mẫu ngẫu nhiên; nhóm nào biết ≥ 85% (sau khi hiệu chỉnh) thì coi cả nhóm là đã biết.

export interface PlacementBand { key: string; label: string; list: "ngsl" | "nawl"; from: number; to: number }
export const PLACEMENT_BANDS: PlacementBand[] = [
  { key: "n1", label: "NGSL 1–500", list: "ngsl", from: 1, to: 500 },
  { key: "n2", label: "NGSL 501–1000", list: "ngsl", from: 501, to: 1000 },
  { key: "n3", label: "NGSL 1001–1500", list: "ngsl", from: 1001, to: 1500 },
  { key: "n4", label: "NGSL 1501–2000", list: "ngsl", from: 1501, to: 2000 },
  { key: "n5", label: "NGSL 2001–2801", list: "ngsl", from: 2001, to: 2801 },
  { key: "a1", label: "NAWL (học thuật)", list: "nawl", from: 1, to: 959 },
];
export const SAMPLE_PER_BAND = 16;
export const MASTERED_THRESHOLD = 0.85;

/** Lấy mẫu có hạt giống để test tái lập được. */
export function seededSample<T>(arr: T[], n: number, seed: number): T[] {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, n);
}

export interface PlacementAnswer { lemma: string; band: string | "fake"; known: boolean }
export interface BandResult { key: string; asked: number; yes: number; adjusted: number; mastered: boolean }

/**
 * Hiệu chỉnh "đoán bừa" kiểu signal detection đơn giản: h = tỉ lệ nói biết ở từ thật, f = tỉ lệ nói biết ở từ giả,
 * tỉ lệ thật ≈ (h − f) / (1 − f). f = 1 → không tin được kết quả nào (trả 0).
 */
export function scorePlacement(answers: PlacementAnswer[]): { bands: BandResult[]; falseAlarm: number; estimatedKnown: number } {
  const fakes = answers.filter(a => a.band === "fake");
  const f = fakes.length ? fakes.filter(a => a.known).length / fakes.length : 0;
  const bands: BandResult[] = PLACEMENT_BANDS.map(b => {
    const asked = answers.filter(a => a.band === b.key);
    const yes = asked.filter(a => a.known).length;
    const h = asked.length ? yes / asked.length : 0;
    const adjusted = f >= 1 ? 0 : Math.max(0, (h - f) / (1 - f));
    return { key: b.key, asked: asked.length, yes, adjusted, mastered: asked.length > 0 && adjusted >= MASTERED_THRESHOLD };
  });
  const estimatedKnown = Math.round(PLACEMENT_BANDS.reduce((sum, b, i) => sum + (b.to - b.from + 1) * bands[i].adjusted, 0));
  return { bands, falseAlarm: f, estimatedKnown };
}
