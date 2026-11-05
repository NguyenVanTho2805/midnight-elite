// BU-03-MATHTYPE — ĐỐI CHIẾU glyph WMF ↔ LaTeX trên KHO MẪU THẬT (công cụ kiểm; không ghi đĩa, không in nội dung đề).
// Với mỗi công thức có cả OLE (MTEF) lẫn ảnh WMF xem trước trong cùng .docx: đếm glyph (font, mã byte) trong các lệnh ExtTextOut của WMF, và đếm ký tự Unicode
// (mtcode — mã Unicode do chính MathType ghi trong MTEF, độc lập với bộ giải LaTeX và với WMF) trong cùng công thức. Với mỗi (font, mã) trong bảng ánh xạ của wmfSvg.ts:
//   khớp  = số lần ký tự được ánh xạ tới xuất hiện trong MTEF BẰNG đúng số lần glyph xuất hiện trong WMF (luồng có glyph này);
//   suy ngược = ký tự Unicode khớp số lần ở nhiều luồng nhất, chuẩn hoá theo tỉ lệ xuất hiện ở luồng KHÔNG có glyph (tránh ký tự quá phổ biến như '=').
// Một ánh xạ chỉ được giữ khi >= 5 luồng khớp và tỉ lệ >= 98% (cùng ngưỡng meetsVerifiedThreshold).
// Chạy: npx tsx tools/local-e2e/mathtype-glyphs.ts [thư-mục ...]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { readCfbStream } from "@/lib/mathtype/cfb";
import { parseMtef } from "@/lib/mathtype/mtef";
import { WMF_MAPS_FOR_TOOL } from "@/lib/mathtype/wmfSvg";

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["Downloads", "Documents", "Desktop"].map(d => path.join(os.homedir(), d));
const files: string[] = [];
const walk = (d: string, depth = 0) => {
  if (depth > 8) return;
  let es: fs.Dirent[]; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else if (/\.docx$/i.test(e.name) && !e.name.startsWith("~$")) files.push(p);
  }
};
roots.forEach(r => walk(r));

/** Đếm glyph (font thường, mã byte) trong ExtTextOut của một WMF. Quét tối thiểu, bỏ qua mọi record khác. */
function wmfGlyphs(buf: Buffer): Map<string, number> | null {
  try {
    const u16 = (o: number) => buf.readUInt16LE(o), u32 = (o: number) => buf.readUInt32LE(o);
    let p = 0; if (u32(0) === 0x9ac6cdd7) p = 22;
    p += u16(p + 2) * 2;
    const objs: (string | null)[] = []; let cur = ""; const out = new Map<string, number>();
    while (p + 6 <= buf.length) {
      const words = u32(p), fn = u16(p + 4), sz = words * 2; if (words < 3 || p + sz > buf.length) return null;
      const a = p + 6;
      if (fn === 0x02fb) { let face = ""; for (let i = a + 18; i < p + sz && buf[i]; i++) face += String.fromCharCode(buf[i]); const f2 = face.toLowerCase() + "#" + buf[a + 13]; const i = objs.indexOf(null); if (i < 0) objs.push(f2); else objs[i] = f2; }
      else if (fn === 0x02fa || fn === 0x02fc) { const i = objs.indexOf(null); if (i < 0) objs.push("#"); else objs[i] = "#"; }
      else if (fn === 0x012d) { const o = objs[u16(a)]; if (o && o !== "#") cur = o; }
      else if (fn === 0x01f0) objs[u16(a)] = null;
      else if (fn === 0x0a32) { const n = u16(a + 4), op = u16(a + 6), so = a + 8 + (op & 4 ? 8 : 0); for (let i = 0; i < n; i++) { const [fc, cs] = cur.split("#"); const c8 = buf[so + i]; const k = `${/^(symbol|euclid symbol|mt extra|euclid extra|euclid math one)$/.test(fc) || c8 < 0x80 ? fc : fc + "#" + cs}|${c8.toString(16)}`; out.set(k, (out.get(k) ?? 0) + 1); } }
      if (fn === 0) break;
      p += sz;
    }
    return out;
  } catch { return null; }
}


/** Đếm ký tự Unicode (mtcode; hoặc mã 8 bit của typeface chữ 1,2,3,8 khi không có mtcode) trong cây MTEF. */
function mtefChars(ole: Buffer): Map<string, number> | null {
  try {
    const s = readCfbStream(ole, "Equation Native", 32 * 1024); if (!s.ok) return null;
    const parsed = parseMtef(s.data.subarray(28));
    const out = new Map<string, number>();
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { for (const x of n) walk(x); return; }
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.t === "CHAR") {
        const tf = o.tf as number, mt = o.mt as number | undefined, c8 = o.c8 as number | undefined;
        const code = mt !== undefined ? mt : (c8 !== undefined && [1, 2, 3, 8].includes(tf) ? c8 : undefined);
        if (code !== undefined) { const c = String.fromCodePoint(code); out.set(c, (out.get(c) ?? 0) + 1); }
        // Dấu phẩy trên (embellishment 5/6) vẽ bằng glyph ′ ″ nhưng không phải ký tự riêng trong MTEF: tính vào ký tự tương ứng.
        for (const e of (o.emb as number[] | undefined) ?? []) { const c = e === 5 ? "\u2032" : e === 6 ? "\u2033" : null; if (c) out.set(c, (out.get(c) ?? 0) + 1); }
      }
      for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
    };
    walk(parsed.top);
    return out;
  } catch { return null; }
}

(async () => {
  const seen = new Set<string>();
  type Row = { glyphs: Map<string, number>; chars: Map<string, number> };
  const rows: Row[] = [];
  for (const f of files) {
    let z: JSZip; try { if (fs.statSync(f).size > 200e6) continue; z = await JSZip.loadAsync(fs.readFileSync(f)); } catch { continue; }
    const relsF = z.file("word/_rels/document.xml.rels"), docF = z.file("word/document.xml"); if (!relsF || !docF) continue;
    const rels = new Map<string, string>();
    for (const m of (await relsF.async("string")).matchAll(/<Relationship\b[^>]*>/g)) { const id = /\bId="([^"]+)"/.exec(m[0])?.[1], t = /\bTarget="([^"]+)"/.exec(m[0])?.[1]; if (id && t) rels.set(id, t); }
    const doc = await docF.async("string");
    for (const ob of doc.matchAll(/<w:object\b[\s\S]*?<\/w:object>/g)) {
      const img = /<v:imagedata\b[^>]*r:id="([^"]+)"/.exec(ob[0])?.[1], ole = /<o:OLEObject\b[^>]*r:id="([^"]+)"/.exec(ob[0])?.[1];
      const it = img && rels.get(img), ot = ole && rels.get(ole); if (!it || !ot || !/\.wmf$/i.test(it) || !/oleObject\d+\.bin$/.test(ot)) continue;
      const wf = z.file("word/" + it), of = z.file("word/" + ot); if (!wf || !of) continue;
      const wb = await wf.async("nodebuffer"), obuf = await of.async("nodebuffer");
      const id = crypto.createHash("sha1").update(obuf).update(wb).digest("hex"); if (seen.has(id)) continue; seen.add(id);
      const g = wmfGlyphs(wb), c = mtefChars(obuf); if (!g || !c) continue;
      rows.push({ glyphs: g, chars: c });
    }
  }
  console.log(`cặp (WMF, OLE) khác nhau đọc được cả hai: ${rows.length}`);
  const { symbolChar, MTEXTRA, EUCLID_EXTRA, textFaceChar } = WMF_MAPS_FOR_TOOL;
  const keys = new Map<string, number>(); for (const r of rows) for (const k of r.glyphs.keys()) keys.set(k, (keys.get(k) ?? 0) + 1);
  const mappedOf = (face: string, code: number): string | null => {
    if (face === "symbol" || face === "euclid symbol") return symbolChar(code);
    if (face === "mt extra") return MTEXTRA[code] ?? null;
    if (face === "euclid extra" && code === 0xbc) return "\u2322"; // cung ⌢ (đã bỏ khỏi wmfSvg vì chỉ 3 luồng; giữ ở đây để đo)
    if (face === "euclid extra" || face === "euclid math one") return face === "euclid math one" ? (WMF_MAPS_FOR_TOOL.EUCLID_MATH_ONE_EVIDENCE[code]?.[0] ?? null) : (EUCLID_EXTRA[code] ?? null);
    if (face === "mt extra" && (code === 0xb6 || code === 0xb7)) return "\u0302"; // dấu mũ rộng (accent hat): ký tự MTEF là U+0302 (b6 không còn được dùng: chỉ đo để chứng minh)
    return textFaceChar(face, code);
  };
  const allChars = new Set<string>(); for (const r of rows) for (const c of r.chars.keys()) allChars.add(c);
  console.log("(font|mã)".padEnd(26), "ánh xạ".padEnd(8), "luồng".padStart(7), "khớp".padStart(7), "lệch".padStart(7), "  suy ngược tốt nhất (khớp/luồng)");
  const lines: string[] = [];
  const jsonOut: unknown[] = [];
  for (const [k, nStreams] of [...keys.entries()].sort()) {
    const [faceCs, h] = k.split("|"), code = parseInt(h, 16); const [face, cs] = faceCs.split("#");
    if (cs !== undefined && cs !== "0" && cs !== "1") { if (process.env.GLYPH_JSON) jsonOut.push({ k, nStreams, mapped: null, agree: 0, dis: 0, identity: false, best: "", bestAg: 0, withG: 0, cs }); continue; } // charset ≠ ANSI/DEFAULT: mã byte không phải Latin-1
    const isText = !(face === "symbol" || face === "euclid symbol" || face === "mt extra" || face === "euclid extra" || face === "euclid math one");
    if (code < 0x20 || (isText && code < 0x80)) continue; // chữ/số/dấu ASCII của font chữ: đồng nhất, không cần đo
    const withG = rows.filter(r => r.glyphs.has(k)); const without = rows.filter(r => !r.glyphs.has(k));
    const sample = without.length > 4000 ? without.filter((_, i) => i % Math.ceil(without.length / 4000) === 0) : without;
    const mapped = mappedOf(face, code);
    let agree = 0, dis = 0;
    if (mapped) for (const r of withG) ((r.chars.get(mapped) ?? 0) === r.glyphs.get(k)! ? agree++ : dis++);
    let best = "", bestScore = -1, bestAg = 0;
    for (const c of allChars) {
      let ag = 0; for (const r of withG) if ((r.chars.get(c) ?? 0) === r.glyphs.get(k)!) ag++;
      if (ag === 0) continue;
      let pres = 0; for (const r of sample) if (r.chars.has(c)) pres++;
      const score = (ag / withG.length) * (1 - pres / Math.max(1, sample.length));
      if (score > bestScore) { bestScore = score; best = c; bestAg = ag; }
    }
    const identity = !!mapped && mapped.length === 1 && mapped.charCodeAt(0) === code && code >= 0x20 && code < 0x7f && !isText; // ASCII đồng nhất trong font Symbol: không đo được bằng đếm ký tự (ngoặc/dấu do mẫu sinh)
    if (process.env.GLYPH_JSON) jsonOut.push({ k, nStreams, mapped, agree, dis, identity, best, bestAg, withG: withG.length });
    const verdict = identity ? "  (đồng nhất ASCII)" : !mapped ? "" : agree >= 5 && agree / Math.max(1, agree + dis) >= 0.98 ? "  OK" : "  ✗ KHÔNG ĐỦ BẰNG CHỨNG";
    lines.push(`${k.padEnd(24)} ${(mapped ? mapped + " U+" + mapped.codePointAt(0)!.toString(16) : "—").padEnd(14)}${String(nStreams).padStart(7)} ${String(agree).padStart(7)} ${String(dis).padStart(7)}   ${best ? best + " U+" + best.codePointAt(0)!.toString(16) : "—"} (${bestAg}/${withG.length})${mapped && best && best !== mapped && withG.length >= 5 ? "   ← KHÁC ánh xạ" : ""}${verdict}`);
  }
  console.log(lines.join("\n"));
  if (process.env.GLYPH_JSON) fs.writeFileSync(process.env.GLYPH_JSON, JSON.stringify(jsonOut));
})();
