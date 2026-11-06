// Công cụ chụp (không phải test): chạy đường nhập Word (readDocx + parseAzotaBlocks) trên MỘT tệp .docx thật, rồi ghi JSON từng công thức theo thứ tự trong tệp:
// mã câu · trạng thái (latex/ảnh/nhãn/omml) · LaTeX KiN giải · SVG WMF · TeX Input Language gốc (nếu có) · cấu trúc.
// Chạy: npx tsx tools/local-e2e/shoot-mathtype-real.ts <tệp.docx> <ra.json>      (đầu ra KHÔNG đưa vào git)
import fs from "node:fs";
import JSZip from "jszip";
import { readDocx } from "@/lib/azotaDocxRead";
import { parseAzotaBlocks, type DocBlock, type DocRun } from "@/lib/azotaDocx";
import { decodeMathTypeOle, mtefTexInputForTest } from "@/lib/mathtype/mtef";
import { wmfToSvg } from "@/lib/mathtype/wmfSvg";

const [file, out] = process.argv.slice(2);
const STRUCT: [string, RegExp][] = [["tích phân", /\\int/], ["giới hạn", /\\lim/], ["tổng", /\\sum/], ["vectơ", /overrightarrow|\\vec\{|overset\{\\(to|rightarrow)/], ["ma trận", /matrix|array\}\{[lcr]{3,}\}/], ["hệ/ngoặc nhọn", /\\left\\\{/], ["căn", /\\sqrt/], ["phân số", /\\frac/], ["log/ln", /\\log|\\ln/], ["lượng giác", /\\sin|\\cos|\\tan|\\cot/], ["mũ", /\^/], ["chỉ số dưới", /_/], ["|trị tuyệt đối|", /\\left\||\\mid/], ["≤≥≠", /leq|geq|ne\b|neq|\\le\b|\\ge\b/], ["∞", /infty/], ["tập số", /mathbb/], ["hợp/giao", /cup|cap|subset|in\b/]];
(async () => {
  const buf = fs.readFileSync(file);
  const read = await readDocx(buf);
  const parsed = parseAzotaBlocks(read.blocks);
  // Công thức theo thứ tự tệp + mã câu gần nhất
  const runsF: { q: string; run: DocRun }[] = [];
  let cur = "(đầu tệp)", inSol = false;
  const para = (runs: DocRun[]) => {
    const t = runs.map(r => r.formula ? "" : r.text).join("");
    if (/^\s*LỜI GIẢI CHI TIẾT/i.test(t)) inSol = true;
    const m = /^\s*(Câu|Bài)\s*(\d+)/i.exec(t); if (m) cur = `${m[1]} ${m[2]}`;
    const m2 = /^\s*(PHẦN\s+[IVX]+)/i.exec(t); if (m2 && !m) cur = m2[1];
    for (const r of runs) if (r.formula) runsF.push({ q: (inSol ? "LG·" : "") + cur, run: r });
  };
  for (const b of read.blocks as DocBlock[]) {
    if (b.kind === "p") para(b.runs); else for (const row of b.rows) for (const c of row) for (const p of c.paragraphs) para(p);
  }
  // Đối tượng thô trong document.xml (đúng thứ tự)
  const z = await JSZip.loadAsync(buf);
  const doc = await z.file("word/document.xml")!.async("string");
  const rels = await z.file("word/_rels/document.xml.rels")!.async("string");
  const rmap: Record<string, string> = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = /Id="([^"]+)"/.exec(m[0])?.[1], t = /Target="([^"]+)"/.exec(m[0])?.[1]; if (id && t) rmap[id] = t; }
  const raw: { tex: string | null; svg: string | null; ok: boolean; latex: string }[] = [];
  for (const m of doc.matchAll(/<w:object\b[\s\S]*?<\/w:object>/g)) {
    if (!/ProgID="(Equation|MathType)/i.test(m[0])) continue;
    const im = /<v:imagedata\b[^>]*r:id="([^"]+)"/.exec(m[0])?.[1], ol = /<o:OLEObject\b[^>]*r:id="([^"]+)"/.exec(m[0])?.[1];
    const ob = ol && rmap[ol] ? await z.file("word/" + rmap[ol])?.async("nodebuffer") : undefined;
    const wb = im && rmap[im] && /\.wmf$/i.test(rmap[im]) ? await z.file("word/" + rmap[im])?.async("nodebuffer") : undefined;
    const d = ob ? decodeMathTypeOle(ob) : null;
    const w = wb ? wmfToSvg(wb) : null;
    raw.push({ tex: ob ? mtefTexInputForTest(ob) : null, svg: w && w.ok ? w.svg : null, ok: !!d?.ok, latex: d ? (d.ok ? d.latex : ((d as any).guess ?? "")) : "" });
  }
  const oleRuns = runsF.filter(x => x.run.formula === "ole");
  const aligned = oleRuns.length === raw.length;
  let k = 0;
  const items = runsF.map((x, i) => {
    const r = x.run; const isOle = r.formula === "ole"; const rw = isOle ? raw[k++] : undefined;
    const status = r.formula === "omml" ? "omml" : r.latex !== undefined ? "latex" : r.formulaImage ? "anh" : "nhan";
    const latex = r.latex ?? "";
    return { i, q: x.q, status, latex, guess: r.latexUnverified ?? (rw && !r.latex ? rw.latex : ""), fail: r.mathtypeFail ?? "", svg: rw?.svg ?? null, tex: rw?.tex ?? null, omml: r.formula === "omml" ? r.text : null, structs: STRUCT.filter(s => s[1].test(latex)).map(s => s[0]) };
  });
  const cnt = (f: (x: any) => boolean) => items.filter(f).length;
  const struct: Record<string, number> = {}; for (const it of items) for (const s of it.structs) struct[s] = (struct[s] ?? 0) + 1;
  const summary = {
    file: file.split("/").pop(), questions: parsed.questions.length, byType: parsed.stats.byType, withAnswer: parsed.stats.withAnswer, fatal: parsed.fatal, errors: parsed.errors.length,
    flags: parsed.questions.reduce((a: Record<string, number>, q) => { for (const f of q.flags) a[f] = (a[f] ?? 0) + 1; return a; }, {}),
    formulas: items.length, latex: cnt(x => x.status === "latex"), anh: cnt(x => x.status === "anh"), nhan: cnt(x => x.status === "nhan"), omml: cnt(x => x.status === "omml"),
    withTexOriginal: cnt(x => !!x.tex), unverifiedGuess: cnt(x => x.status === "anh" && !!x.guess), aligned, oleRuns: oleRuns.length, rawObjects: raw.length, formulaStats: read.formulaStats, failByReason: items.reduce((a: Record<string, number>, x) => { if (x.fail) a[x.fail] = (a[x.fail] ?? 0) + 1; return a; }, {}), struct,
    noAnswer: parsed.questions.filter(q => !q.options.some(o => o.isCorrect)).map(q => q.number),
  };
  fs.writeFileSync(out, JSON.stringify({ summary, items, questions: parsed.questions.map(q => ({ number: q.number, type: q.type, text: q.text, explanation: q.explanation, options: q.options, flags: q.flags, answerSource: q.answerSource })) }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})();
