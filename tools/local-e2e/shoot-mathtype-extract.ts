// Công cụ chụp (không phải test): trích công thức MathType từ các tệp ~/Downloads, giải LaTeX + vẽ SVG dự phòng, chọn ~40 công thức đa dạng → JSON.
// Chạy: npx tsx tools/local-e2e/shoot-mathtype-extract.ts <thư-mục-ra>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { decodeMathTypeOle } from "@/lib/mathtype/mtef";
import { wmfToSvg } from "@/lib/mathtype/wmfSvg";

const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const walk = (d: string, dep = 0): string[] => { if (dep > 4) return []; let es: fs.Dirent[]; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } return es.flatMap(e => e.name.startsWith(".") || e.name === "node_modules" ? [] : e.isDirectory() ? walk(path.join(d, e.name), dep + 1) : /\.docx$/i.test(e.name) && !e.name.startsWith("~$") ? [path.join(d, e.name)] : []); };
const FILES0 = ["B. TU LUAN - CH.docx", "C. TRAC NGHIEM - CH.docx", "D. DUNG SAI - CH.docx", "E. TRA LOI NGAN - CH.docx", "F. BAI TAP NANG CAO - CH.docx", "De_Toan12_GK1_Azota.docx"];
const FILES = process.env.ALL ? (process.env.ROOTS ?? "Downloads").split(",").flatMap(r => walk(path.join(os.homedir(), r))).filter(f => fs.statSync(f).size < 30e6) : FILES0.map(n => path.join(os.homedir(), "Downloads", n));
type F = { file: string; idx: number; ole: string; wmf: string; ok: boolean; latex: string; unverified: boolean; reason: string; svg: string | null; svgReason: string };
const all: F[] = [];
(async () => {
  for (const name of FILES) {
    const p = name; if (!fs.existsSync(p)) continue; let z0: JSZip; try { z0 = await JSZip.loadAsync(fs.readFileSync(p)); } catch { continue; } if (!Object.keys(z0.files).some(n => /embeddings\/oleObject/.test(n))) continue;
    const z = z0;
    if (!z.file("word/document.xml") || !z.file("word/_rels/document.xml.rels")) continue;
    const doc = await z.file("word/document.xml")!.async("string");
    const rels = await z.file("word/_rels/document.xml.rels")!.async("string");
    const rmap: Record<string, string> = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = /Id="([^"]+)"/.exec(m[0])?.[1], t = /Target="([^"]+)"/.exec(m[0])?.[1]; if (id && t) rmap[id] = t; }
    let i = 0;
    for (const m of doc.matchAll(/<w:object\b[\s\S]*?<\/w:object>/g)) {
      const im = /<v:imagedata\b[^>]*r:id="([^"]+)"/.exec(m[0])?.[1], ol = /<o:OLEObject\b[^>]*r:id="([^"]+)"/.exec(m[0])?.[1];
      if (!im || !ol || !rmap[im] || !rmap[ol]) continue;
      const oleBuf = await z.file("word/" + rmap[ol])?.async("nodebuffer"); const wmfBuf = await z.file("word/" + rmap[im])?.async("nodebuffer");
      if (!oleBuf || !wmfBuf) continue;
      const d = decodeMathTypeOle(oleBuf);
      const w = /\.wmf$/i.test(rmap[im]) ? wmfToSvg(wmfBuf) : null;
      const unv = d.ok && (d.warnings.includes("unverified_structure") || ((d as any).unverified?.length ?? 0) > 0);
      all.push({ file: path.basename(name), idx: i++, ole: rmap[ol], wmf: rmap[im], ok: d.ok, latex: d.ok ? d.latex : ((d as any).guess ?? ""), unverified: !!unv, reason: d.ok ? "" : String((d as any).reason), svg: w && w.ok ? w.svg : null, svgReason: w && !w.ok ? w.reason : (w ? "" : "not_wmf") });
    }
  }
  if (process.env.SETS) { const t: Record<string, number> = {}; for (const f of all) { if (!f.svg || !f.ok) continue; const a = (f.latex.match(/mathbb\{(\w)\}/g) ?? []).join(""); const b = (f.svg.match(/[ℝℤℕℚℂ]/g) ?? []).join(""); if (a || b) { const k = a + " | " + b; t[k] = (t[k] ?? 0) + 1; } } console.log(t); return; }
  const dedup = new Map<string, F>(); for (const f of all) if (f.ok && f.svg && f.latex.length < 150 && !dedup.has(f.latex)) dedup.set(f.latex, f);
  const pool = [...dedup.values()];
  const cats: [string, RegExp][] = [
    ["tích phân", /\\int/], ["tổng", /\\sum/], ["giới hạn", /\\lim/], ["hệ phương trình", /\\left\\\{\s*\\begin\{array\}/], ["hoặc (ngoặc vuông)", /\\left\[\\begin\{array\}/],
    ["cung/gạch ngang", /curvearrowright|\\overline/], ["vectơ", /\\overrightarrow|\\vec\{|\\overset\{\\(to|rightarrow)/], ["ma trận", /matrix|\\begin\{array\}\{[lcr]{3,}\}/], ["căn", /\\sqrt/], ["phân số", /\\frac/], ["mũ/chỉ số", /\^|_/], ["ngoặc", /\\left/], ["log/lượng giác", /\\log|\\ln|\\sin|\\cos|\\tan/], ["khác", /./],
  ];
  const quota: Record<string, number> = { "tích phân": 5, "tổng": 3, "giới hạn": 3, "hệ phương trình": 4, "hoặc (ngoặc vuông)": 2, "cung/gạch ngang": 3, "vectơ": 5, "ma trận": 2, "căn": 3, "phân số": 3, "mũ/chỉ số": 2, "ngoặc": 2, "log/lượng giác": 2, "khác": 1 };
  const picked: (F & { cat: string })[] = []; const used = new Set<string>();
  for (const [cat, re] of cats) { let n = 0; for (const f of pool) { if (n >= quota[cat]) break; if (used.has(f.latex) || !re.test(f.latex)) continue; used.add(f.latex); picked.push({ ...f, cat }); n++; } }
  fs.writeFileSync(path.join(out, "all-latex.txt"), pool.map(f => f.file + "\t" + f.latex).join("\n"));
  fs.writeFileSync(path.join(out, "picked.json"), JSON.stringify(picked, null, 1));
  const cnt: Record<string, number> = {}; for (const c of cats) cnt[c[0]] = pool.filter(f => c[1].test(f.latex)).length;
  console.log(JSON.stringify({ totalObj: all.length, decodedOk: all.filter(f => f.ok).length, unverified: all.filter(f => f.unverified).length, withSvg: all.filter(f => f.svg).length, svgFail: all.filter(f => !f.svg).map(f => f.svgReason).slice(0, 5), pool: pool.length, poolByCat: cnt, picked: picked.length, byFile: Object.fromEntries([...new Set(all.map(f => f.file))].map(n => [n, all.filter(f => f.file === n).length])) }, null, 1));
  picked.forEach((f, i) => console.log(i + 1, f.cat, f.unverified ? "[unv]" : "", f.latex));
})();
