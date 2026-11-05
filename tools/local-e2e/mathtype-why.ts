// BU-03-MATHTYPE — công cụ ĐIỀU TRA lệch: với một id ("sym:b0", "acc:f3", "interval"...), in các luồng KHÔNG khớp TeX gốc kèm LaTeX của KiN và TeX gốc (đã chuẩn hoá),
// cắt quanh chỗ khác đầu tiên. Chỉ in ra màn hình để người kiểm đọc, KHÔNG ghi đĩa, KHÔNG đưa vào báo cáo/commit (nội dung đề của gia sư).
// Chạy: npx tsx tools/local-e2e/mathtype-why.ts <id> [số-ca=12] [thư-mục ...]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { decodeMathTypeOle, mtefTexInputForTest } from "@/lib/mathtype/mtef";
import { normTex } from "./mathtype-texnorm";

const [id, nArg, ...dirs] = process.argv.slice(2);
const want = Number(nArg ?? 12) || 12;
const roots = dirs.length ? dirs : ["Downloads", "Documents", "Desktop"].map(d => path.join(os.homedir(), d));
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
(async () => {
  const seen = new Set<string>(); let shown = 0, tot = 0, bad = 0;
  const kinds = new Map<string, number>();
  for (const f of files) {
    if (shown >= want && kinds.size > 40) break;
    let z: JSZip; try { if (fs.statSync(f).size > 200e6) continue; z = await JSZip.loadAsync(fs.readFileSync(f)); } catch { continue; }
    for (const n of Object.keys(z.files).filter(n => /^word\/embeddings\/oleObject\d+\.bin$/.test(n))) {
      const buf = await z.files[n].async("nodebuffer");
      const h = crypto.createHash("sha1").update(buf).digest("hex");
      if (seen.has(h)) continue; seen.add(h);
      const d = decodeMathTypeOle(buf); if (!d.ok) continue;
      const inSym = id.includes(":") && id.match(/^(sym|acc):/) ? (d.symbols ?? []).includes(id) : (d.structures.includes(id));
      if (!inSym) continue;
      const tex = mtefTexInputForTest(buf); if (tex === null) continue;
      tot++;
      const a = normTex(d.latex), b = normTex(tex);
      if (a === b) continue;
      bad++;
      let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
      const k = `${a.slice(Math.max(0, i - 0), i + 6)} ⇄ ${b.slice(Math.max(0, i - 0), i + 6)}`;
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
      if (shown < want) { shown++; console.log(`#${shown} @${i}/${a.length}\n  KiN: …${a.slice(Math.max(0, i - 25), i + 40)}\n  TeX: …${b.slice(Math.max(0, i - 25), i + 40)}`); }
    }
  }
  console.log(`\n${id}: có TeX ${tot}, lệch ${bad}. Điểm khác đầu tiên (KiN ⇄ TeX) theo số lần:`);
  for (const [k, c] of [...kinds.entries()].sort((x, y) => y[1] - x[1]).slice(0, 25)) console.log(String(c).padStart(5), k);
})();
