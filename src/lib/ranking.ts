// AS-195 (06/10/2026) — xếp hạng trong môn với tie-break đúng.
//
// Spec Thanh (dua-bang-tinh-len-web.md mục 3): "hoà cả ba tiêu chí (điểm
// xếp hạng, điểm TB, BTVN) thì hiện đồng hạng, không phá hoà bằng tên
// (GD-07)".
//
// Thứ tự so: score desc → avg desc → homework desc. Nếu bằng cả 3 → cùng
// rank. Hai em cùng rank 1 → em thứ 3 vẫn rank 3 (standard competition
// ranking, không dense ranking).

export interface Rankable {
  userId:   string;
  score:    number; // điểm xếp hạng (có trọng số)
  avg:      number; // điểm trung bình
  homework: number; // điểm BTVN
}

export interface RankedRow extends Rankable {
  rank: number;
  tied: boolean; // true nếu em này cùng rank với ≥1 em khác
}

export function rankWithTies(input: Rankable[]): RankedRow[] {
  // Sort ổn định theo 3 tiêu chí giảm dần.
  const sorted = [...input].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.avg   !== b.avg)   return b.avg - a.avg;
    return b.homework - a.homework;
  });

  // Gán rank. Em cùng key với em trước → cùng rank; khác → rank = index + 1.
  const result: RankedRow[] = [];
  let currentRank = 0;
  let lastKey = "";
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const key = `${r.score}|${r.avg}|${r.homework}`;
    if (key !== lastKey) {
      currentRank = i + 1;
      lastKey = key;
    }
    result.push({ ...r, rank: currentRank, tied: false });
  }

  // Đánh dấu tied: duyệt lại, em cùng rank với ≥1 em khác thì tied=true.
  const rankCount: Record<number, number> = {};
  for (const r of result) rankCount[r.rank] = (rankCount[r.rank] ?? 0) + 1;
  for (const r of result) if (rankCount[r.rank] > 1) r.tied = true;

  return result;
}
