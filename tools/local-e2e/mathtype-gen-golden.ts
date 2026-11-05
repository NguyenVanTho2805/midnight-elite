// Sinh bộ vàng BU-03-MATHTYPE: trích từ .docx mẫu thật CHỈ các công thức có "TeX Input Language" (record FUTURE 102) → {hex, tex}.
// hex = luồng "Equation Native" (228–653 B), không phải cả tệp .bin; không có tên tệp/đoạn văn đề. Chạy 1 lần khi cần sinh lại:
//   npx tsx tools/local-e2e/mathtype-gen-golden.ts [thư-mục-chứa-docx=~/Downloads]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { readCfbStream } from "@/lib/mathtype/cfb";
import { mtefTexInputForTest } from "@/lib/mathtype/mtef";

const dir = process.argv[2] ?? path.join(os.homedir(), "Downloads");
const FILES = ["De_Toan12_GK1_Azota.docx", "D. DUNG SAI - CH.docx", "F. BAI TAP NANG CAO - CH.docx"];
(async () => {
  const out: { hex: string; tex: string }[] = [];
  for (const f of FILES) {
    const p = path.join(dir, f); if (!fs.existsSync(p)) { console.log("thiếu", f); continue; }
    const z = await JSZip.loadAsync(fs.readFileSync(p));
    const names = Object.keys(z.files).filter(n => /^word\/embeddings\/oleObject\d+\.bin$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    for (const n of names) {
      const buf = await z.files[n].async("nodebuffer");
      const tex = mtefTexInputForTest(buf); if (!tex) continue;
      const s = readCfbStream(buf, "Equation Native"); if (!s.ok) continue;
      out.push({ hex: s.data.toString("hex"), tex });
    }
  }
  fs.writeFileSync(path.join(__dirname, "mathtype-golden.json"), JSON.stringify(out));
  console.log("đã ghi", out.length, "công thức");
})();
