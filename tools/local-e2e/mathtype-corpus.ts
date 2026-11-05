// BU-03-MATHTYPE — thống kê KHO MẪU THẬT (công cụ kiểm, không phải test bắt buộc; không ghi gì ra đĩa, không in nội dung đề).
// Chạy: npx tsx tools/local-e2e/mathtype-corpus.ts [thư-mục ...]   (mặc định ~/Downloads ~/Documents ~/Desktop; đệ quy, mọi .docx có word/embeddings/oleObject*.bin)
// In: số tệp, số công thức (cả trùng), số luồng khác nhau, tỉ lệ giải, tỉ lệ khớp "TeX Input Language" (FUTURE 102, do chính MathType ghi) sau chuẩn hoá,
//     và với MỖI cấu trúc trong MATHTYPE_STRUCTURES: số luồng dùng nó / số luồng có TeX gốc / số khớp. Dùng bảng này để quyết `verified` + `evidence`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { decodeMathTypeOle, mtefTexInputForTest, MATHTYPE_STRUCTURES } from "@/lib/mathtype/mtef";
import { normTex } from "./mathtype-texnorm";

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

(async () => {
  const seen = new Map<string, { structs: string[]; ok: boolean; reason: string; tex: string | null; same: boolean }>();
  let nFiles = 0, nFilesOle = 0, nOle = 0, nOk = 0;
  const perFile: Record<string, number> = {};
  for (const f of files) {
    let z: JSZip; try { if (fs.statSync(f).size > 200e6) continue; z = await JSZip.loadAsync(fs.readFileSync(f)); } catch { continue; }
    nFiles++;
    const names = Object.keys(z.files).filter(n => /^word\/embeddings\/oleObject\d+\.bin$/.test(n));
    if (!names.length) continue;
    nFilesOle++; perFile[path.basename(f)] = names.length;
    for (const n of names) {
      const buf = await z.files[n].async("nodebuffer");
      nOle++;
      const id = crypto.createHash("sha1").update(buf).digest("hex");
      let r = seen.get(id);
      if (!r) {
        const d = decodeMathTypeOle(buf);
        const tex = mtefTexInputForTest(buf);
        r = d.ok
          ? { structs: d.structures, ok: true, reason: "", tex, same: tex !== null && normTex(d.latex) === normTex(tex) }
          : { structs: [], ok: false, reason: d.reason, tex, same: false };
        seen.set(id, r);
      }
      if (r.ok) nOk++;
    }
  }
  const uniq = [...seen.values()];
  const okU = uniq.filter(x => x.ok), withTex = uniq.filter(x => x.tex !== null);
  const decTex = withTex.filter(x => x.ok);
  console.log(`tệp .docx: ${nFiles} (có công thức: ${nFilesOle}) · công thức (cả trùng): ${nOle}, giải được ${nOk} (${(100 * nOk / Math.max(1, nOle)).toFixed(2)}%)`);
  console.log(`luồng khác nhau: ${uniq.length}, giải được ${okU.length} (${(100 * okU.length / Math.max(1, uniq.length)).toFixed(2)}%)`);
  console.log(`có TeX gốc: ${withTex.length}; trong đó giải được ${decTex.length}; KHỚP TeX gốc sau chuẩn hoá: ${decTex.filter(x => x.same).length} (${(100 * decTex.filter(x => x.same).length / Math.max(1, decTex.length)).toFixed(2)}% trên số giải được)`);
  const why: Record<string, number> = {};
  for (const x of uniq) if (!x.ok) why[x.reason] = (why[x.reason] ?? 0) + 1;
  console.log("thất bại theo lý do:", Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 25).map(e => e.join(":")).join("  "));
  console.log("\ncấu trúc".padEnd(22), "luồng".padStart(8), "có TeX".padStart(8), "khớp".padStart(8), "  verified?");
  for (const id of Object.keys(MATHTYPE_STRUCTURES)) {
    const u = uniq.filter(x => x.structs.includes(id)), t = u.filter(x => x.tex !== null), m = t.filter(x => x.same);
    console.log(id.padEnd(22), String(u.length).padStart(8), String(t.length).padStart(8), String(m.length).padStart(8), "  " + (MATHTYPE_STRUCTURES[id].verified ? "ĐÃ KIỂM" : "chưa"));
  }
})();
