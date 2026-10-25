// Chia chữ đã trích từ PDF sách thành unit + tìm phần đáp án. Thuần (test được không cần AI).
// Sách "Grammar in Use" và "Improve your Skills" đều in "Unit N" ở đầu trang, đáp án nằm cuối sách ("Key to Exercises" / "Answer key").

export interface PageText { pageNo: number; text: string }
export interface UnitSpan { order: number; unitNo: string | null; label: string; pageStart: number; pageEnd: number }

const HEAD_CHARS = 260;
const UNIT_RE = /(?:^|\n|\s)Unit\s+(\d{1,3})\b/i;
const UNIT_RE_G = /(?:^|\n|\s)Unit\s+(\d{1,3})\b/gi;
const KEY_RE = /\b(key to exercises|answer key|key to additional exercises|answers to exercises|key to study guide)\b/i;

export function findKeyStart(pages: PageText[]): number | null {
  const minPage = Math.max(5, Math.floor(pages.length * 0.5)); // phần đáp án luôn ở nửa sau sách
  for (const p of pages) {
    if (p.pageNo < minPage) continue;
    if (KEY_RE.test(p.text.slice(0, 400))) return p.pageNo;
  }
  return null;
}

export function splitUnits(pages: PageText[], opts: { fallbackPagesPerUnit?: number } = {}): { units: UnitSpan[]; keyStart: number | null } {
  const keyStart = findKeyStart(pages);
  const body = pages.filter(p => keyStart === null || p.pageNo < keyStart).sort((a, b) => a.pageNo - b.pageNo);
  const tagged: { pageNo: number; unit: number | null }[] = body.map(p => {
    const head = p.text.slice(0, HEAD_CHARS);
    const all = p.text.match(UNIT_RE_G) ?? [];
    if (all.length >= 4) return { pageNo: p.pageNo, unit: null }; // trang mục lục / study guide
    const m = head.match(UNIT_RE);
    return { pageNo: p.pageNo, unit: m ? Number(m[1]) : null };
  });

  const units: UnitSpan[] = [];
  let last = 0;
  for (const t of tagged) {
    if (t.unit === null) {
      // trang không có tiêu đề unit ngay sau một unit (trang phải của cặp trang) → thuộc unit đang mở
      const cur = units.at(-1);
      if (cur && t.pageNo === cur.pageEnd + 1 && t.pageNo - cur.pageStart < 4) cur.pageEnd = t.pageNo;
      continue;
    }
    const cur = units.at(-1);
    if (cur && cur.unitNo === String(t.unit) && t.pageNo <= cur.pageEnd + 1) { cur.pageEnd = t.pageNo; continue; }
    if (t.unit <= last) continue; // số unit phải tăng dần (bỏ trích dẫn "xem Unit 12" trong bài)
    last = t.unit;
    units.push({ order: units.length + 1, unitNo: String(t.unit), label: `Unit ${t.unit}`, pageStart: t.pageNo, pageEnd: t.pageNo });
  }

  if (units.length >= 3) return { units, keyStart };

  // Không nhận ra cấu trúc unit → chia đều theo số trang để vẫn học được.
  const per = opts.fallbackPagesPerUnit ?? 4;
  const fallback: UnitSpan[] = [];
  for (let i = 0; i < body.length; i += per) {
    const slice = body.slice(i, i + per);
    if (!slice.length) break;
    const a = slice[0].pageNo, b = slice.at(-1)!.pageNo;
    fallback.push({ order: fallback.length + 1, unitNo: null, label: `Phần ${fallback.length + 1} (trang ${a}–${b})`, pageStart: a, pageEnd: b });
  }
  return { units: fallback, keyStart };
}

/** Đoạn đáp án của một unit trong phần "Key" (từ "Unit N" tới "Unit N+1"). null nếu không tìm thấy. */
export function keySegment(pages: PageText[], keyStart: number | null, unitNo: string | null): string | null {
  if (keyStart === null || !unitNo) return null;
  const text = pages.filter(p => p.pageNo >= keyStart).sort((a, b) => a.pageNo - b.pageNo).map(p => p.text).join("\n");
  const n = Number(unitNo);
  const start = text.search(new RegExp(`(?:^|\\n|\\s)Unit\\s+${n}\\b`, "i"));
  if (start < 0) return null;
  const rest = text.slice(start + 5);
  const endRel = rest.search(new RegExp(`(?:^|\\n|\\s)Unit\\s+${n + 1}\\b`, "i"));
  const seg = text.slice(start, endRel < 0 ? Math.min(text.length, start + 4000) : start + 5 + endRel).trim();
  return seg.length > 10 ? seg.slice(0, 6000) : null;
}

export interface Chunk { pageNo: number; text: string }

/** Cắt chữ từng trang thành đoạn ~maxChars ký tự theo ranh giới dòng/câu, giữ số trang để trích dẫn. */
export function chunkPages(pages: PageText[], maxChars = 1100): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) {
    const clean = p.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (clean.length < 40) continue;
    const parts = clean.split(/(?<=[.!?])\s+|\n{2,}/);
    let buf = "";
    for (const part of parts) {
      if ((buf + " " + part).length > maxChars && buf.length > 200) { out.push({ pageNo: p.pageNo, text: buf.trim() }); buf = ""; }
      buf += (buf ? " " : "") + part;
    }
    if (buf.trim().length >= 40) out.push({ pageNo: p.pageNo, text: buf.trim() });
  }
  return out;
}
