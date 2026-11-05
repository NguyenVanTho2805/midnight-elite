// BU-03-MATHTYPE — test THUẦN (không DB, không mạng, không DATABASE_URL): CFB + MTEF v5 → LaTeX, và đường docx end-to-end. Chạy: npx tsx tools/local-e2e/mathtype.ts
// Gồm: t-cfb-basic · t-mtef-golden (39 công thức có TeX Input từ mẫu thật, lưu gọn ở mathtype-golden.json) · mẫu thật 299/299 (bỏ qua nếu thiếu tệp) · t-mtef-synth ·
// t-mtef-fail · t-mtef-limits (+ fuzz) · t-docx-mathtype (docx tổng hợp) · docx thật De_Toan12_GK1_Azota.docx (bỏ qua nếu thiếu).
// Mẫu thật: thư mục MATHTYPE_SAMPLES hoặc ~/Downloads. Ca có chữ "(chưa kiểm bằng mẫu thật)" là cấu trúc viết theo tài liệu MTEF, test bằng byte TỰ DỰNG — KHÔNG phải bằng chứng đúng với MathType thật.
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - cfb.ts bỏ tập đã thăm trong chain() → ca 'FAT vòng' treo/đỏ; bỏ kiểm `n >= totalSectors` → ca 'sector vượt tệp' đỏ; bỏ kiểm DIFAT vòng → ca 'DIFAT vòng' đỏ;
//   - mtef.ts bỏ `depth > maxDepth` → ca 'lồng 10^4' tràn ngăn xếp (RangeError → vẫn limit nhờ bắt) hoặc đỏ; bỏ kiểm top-level (1 LINE + 1 END) → ca 'byte dư' đỏ;
//   - mtefLatex.ts bỏ `double_script` → ca 'hai mũ liền' đỏ; bỏ kiểm số ô ngoặc → ca 'ngoặc sai số ô' đỏ; cho tf lạ rơi vào default trả '' → ca 'typeface 23' đỏ;
//   - azotaDocxRead.ts bỏ regex `embeddings/oleObject\d+\.bin` → ca '.exe / đích ngoài embeddings' đỏ; bỏ giới hạn MAX_OLE_BYTES → ca '.bin 65 KB' đỏ.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import katex from "katex";
import { readCfbStream } from "@/lib/mathtype/cfb";
import { MATHTYPE_LIMITS, MATHTYPE_STRUCTURES, decodeEquationStream, decodeMathTypeOle, mtefTexInputForTest, type MathTypeDecode } from "@/lib/mathtype/mtef";
import { DOCX_MAX_ENTRIES, DocxError, readDocx } from "@/lib/azotaDocxRead";
import { parseAzotaBlocks } from "@/lib/azotaDocx";
import { FORMULA_PLACEHOLDER } from "@/lib/ommlLatex";
import { normTex } from "./mathtype-texnorm";
import { buildCfb, chr, chr8, emptyLine, equationStream, frac, greek, headRaw, line, matrix, mtef, num, oleOf, oleRaw, paren, pile, sqrt, sub, sup, sym, text, tmpl, vars, type Bytes } from "./mathtype-fixtures";

let pass = 0, failN = 0;
const check = (name: string, cond: unknown, extra?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { failN++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); }
};
const section = (t: string) => console.log(`\n▸ ${t}`);
const never = (fn: () => unknown) => { try { fn(); return true; } catch { return false; } };

const lx = (d: MathTypeDecode) => (d.ok ? d.latex : `FAIL:${d.reason}`);
const dec = (content: Bytes, extra: Bytes = []) => decodeMathTypeOle(oleOf(content, extra));
const L = (content: Bytes) => lx(dec(content));
const renders = (latex: string) => { try { katex.renderToString(latex, { throwOnError: true, strict: "error" }); return true; } catch { return false; } };
const norm = (s: string) => s.replace(/\\text\{([^}]*)\}|\\mathrm\{([^}]*)\}/g, "$1$2").replace(/\\ |~|\\,/g, "").replace(/[\s{}]/g, "");
const UNV = "unverified_structure";

(async () => {
  const t0 = Date.now();
  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("t-cfb-basic) CFB: mini-stream, FAT-stream, tệp hỏng");
  {
    const small = Buffer.from("xin chào mini-stream ".repeat(10));
    const big = Buffer.alloc(9000); for (let i = 0; i < big.length; i++) big[i] = (i * 7) & 255;
    const f = buildCfb([{ name: "Small", data: small }, { name: "Equation Native", data: Buffer.from("abc") }, { name: "Big", data: big }]);
    const r1 = readCfbStream(f, "Small"), r2 = readCfbStream(f, "Big"), r3 = readCfbStream(f, "Equation Native");
    check("luồng nhỏ (< 4096) đọc qua mini-stream đúng từng byte", r1.ok && r1.data.equals(small));
    check("luồng lớn (9000 B) đọc qua FAT đúng từng byte", r2.ok && r2.data.equals(big));
    check("luồng tên 'Equation Native' cạnh luồng khác", r3.ok && r3.data.toString() === "abc");
    const f4 = buildCfb([{ name: "Small", data: small }, { name: "Big", data: big }], { sector4096: true });
    const a = readCfbStream(f4, "Small"), c = readCfbStream(f4, "Big");
    check("CFB sector 4096 (v4): cả mini-stream lẫn FAT", a.ok && a.data.equals(small) && c.ok && c.data.equals(big));
    check("không có luồng → stream_missing", readCfbStream(f, "Nope").ok === false && (readCfbStream(f, "Nope") as { reason: string }).reason === "stream_missing");
    const bad = Buffer.from(f); bad[0] = 0;
    check("PHÁ: chữ ký sai → not_cfb", (readCfbStream(bad, "Small") as { reason: string }).reason === "not_cfb");
    check("PHÁ: header cụt / rỗng / không phải Buffer → not_cfb, không ném", (readCfbStream(f.subarray(0, 100), "Small") as { reason: string }).reason === "not_cfb" && (readCfbStream(Buffer.alloc(0), "x") as { reason: string }).reason === "not_cfb" && never(() => readCfbStream(null as unknown as Buffer, "x")));
    check("PHÁ: cắt cụt sau header (mất thư mục/FAT) → corrupt", (readCfbStream(f.subarray(0, 512), "Small") as { reason: string }).reason === "corrupt");
    // FAT vòng: chuỗi sector của luồng Big trỏ về chính nó
    const loop = Buffer.from(f);
    const fatOff = 512 + 0 * 512; // FAT ở sector 0
    const bigStart = loop.readUInt32LE(0) === 0 ? 0 : 0; void bigStart;
    for (let i = 0; i < 128; i++) { const v = loop.readUInt32LE(fatOff + 4 * i); if (v !== 0xffffffff && v !== 0xfffffffd && v !== 0xfffffffe) loop.writeUInt32LE(i, fatOff + 4 * i); } // mọi mục trỏ về chính nó
    check("PHÁ: FAT vòng (mỗi sector trỏ về chính nó) → corrupt, không treo", never(() => readCfbStream(loop, "Big")) && ["corrupt", "limit"].includes((readCfbStream(loop, "Big") as { reason: string }).reason));
    const oob = Buffer.from(f); oob.writeUInt32LE(99999, 48); // thư mục ở sector không tồn tại
    check("PHÁ: sector vượt tệp (dirStart) → corrupt", (readCfbStream(oob, "Small") as { reason: string }).reason === "corrupt");
    const idx = (f.length - 512) / 512; // sector mới nối thêm: sector DIFAT có mục "kế tiếp" trỏ về chính nó
    const dif = Buffer.concat([f, Buffer.alloc(512)]); dif.writeUInt32LE(idx, 68); dif.writeUInt32LE(3, 72); dif.writeUInt32LE(idx, f.length + 508);
    check("PHÁ: DIFAT vòng (sector DIFAT trỏ về chính nó) → corrupt, không treo", never(() => readCfbStream(dif, "Small")) && (readCfbStream(dif, "Small") as { reason: string }).reason === "corrupt");
    const huge = Buffer.from(f); huge.writeUInt32LE(0xfffffff0, 44); // nFat khổng lồ
    check("PHÁ: nFat khai khổng lồ → corrupt, không cấp phát vô hạn", (readCfbStream(huge, "Small") as { reason: string }).reason === "corrupt");
    const sz = Buffer.from(f); { const dirOff = 512 + sz.readUInt32LE(48) * 512; sz.writeBigUInt64LE(0xffffffffffn, dirOff + 128 + 120); }
    check("PHÁ: kích thước luồng khai khổng lồ → limit", (readCfbStream(sz, "Small") as { reason: string }).reason === "limit");
    const ss = Buffer.from(f); ss.writeUInt16LE(30, 30);
    check("PHÁ: sector size lạ (2^30) → corrupt", (readCfbStream(ss, "Small") as { reason: string }).reason === "corrupt");
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("t-mtef-golden) 39 công thức mẫu thật có 'TeX Input Language' (hex luồng + tex) — LaTeX phải khớp sau chuẩn hoá");
  if (fs.existsSync(path.join(__dirname, "mathtype-golden.json"))) { // tệp trích từ đề thật của gia sư: KHÔNG vào git (sinh bằng mathtype-gen-golden.ts)
    const gold: { hex: string; tex: string }[] = JSON.parse(fs.readFileSync(path.join(__dirname, "mathtype-golden.json"), "utf8"));
    check("có đủ 39 công thức vàng", gold.length === 39, gold.length);
    let okN = 0, same = 0, viaCfb = 0; const diffs: unknown[] = [];
    for (const g of gold) {
      const stream = Buffer.from(g.hex, "hex");
      const d = decodeEquationStream(stream);
      if (d.ok) { okN++; if (norm(d.latex) === norm(g.tex)) same++; else diffs.push([g.tex, d.latex]); }
      const viaOle = decodeMathTypeOle(buildCfb([{ name: "Equation Native", data: stream }]));
      if (viaOle.ok && d.ok && viaOle.latex === d.latex) viaCfb++;
    }
    check("39/39 giải được", okN === 39, okN);
    check("39/39 LaTeX khớp TeX Input (bỏ { } \\ ~ \\, khoảng trắng; \\text/\\mathrm → chữ)", same === 39, diffs.slice(0, 3));
    check("39/39 giải được cả khi bọc lại trong CFB mini-stream (đường decodeMathTypeOle)", viaCfb === 39, viaCfb);
    const first = decodeEquationStream(Buffer.from(gold[0].hex, "hex"));
    check("ok:true luôn kèm warnings là mảng, có 'has_tex_input'", first.ok && first.warnings.includes("has_tex_input"));
    check("TeX Input chỉ dùng ở test: mtefTexInputForTest đọc được, decode KHÔNG dùng nó", mtefTexInputForTest(buildCfb([{ name: "Equation Native", data: Buffer.from(gold[0].hex, "hex") }])) === gold[0].tex);
    check("mẫu thật KHÔNG sinh cờ unverified_structure (6 loại template đã kiểm)", gold.every(g => { const d = decodeEquationStream(Buffer.from(g.hex, "hex")); return d.ok && !d.warnings.includes(UNV); }));
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("Mẫu thật: 299 công thức trong 3 tệp Word (chạy nếu có tệp)");
  const dirS = process.env.MATHTYPE_SAMPLES ?? path.join(os.homedir(), "Downloads");
  const SAMPLES = ["De_Toan12_GK1_Azota.docx", "D. DUNG SAI - CH.docx", "F. BAI TAP NANG CAO - CH.docx"];
  let real299 = { total: 0, ok: 0 };
  if (!SAMPLES.every(f => fs.existsSync(path.join(dirS, f)))) console.log(`  (SKIP) thiếu tệp mẫu trong ${dirS}`);
  else {
    const reasons: Record<string, number> = {}; let total = 0, ok = 0, unv = 0, slow = 0;
    for (const f of SAMPLES) {
      const z = await JSZip.loadAsync(fs.readFileSync(path.join(dirS, f)));
      for (const n of Object.keys(z.files).filter(x => /^word\/embeddings\/oleObject\d+\.bin$/.test(x))) {
        const buf = await z.files[n].async("nodebuffer");
        total++; const t1 = Date.now(); const d = decodeMathTypeOle(buf); if (Date.now() - t1 > MATHTYPE_LIMITS.maxFormulaMs) slow++;
        if (d.ok) { ok++; if (!renders(d.latex)) reasons["katex"] = (reasons["katex"] ?? 0) + 1; if (d.warnings.includes(UNV)) unv++; } else reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
      }
    }
    real299 = { total, ok };
    console.log(`  → giải được ${ok}/${total}`);
    check("299/299 công thức của 3 tệp mẫu giải được và KaTeX render được", total === 299 && ok === 299, { total, ok, reasons });
    check("không công thức nào cần cờ unverified_structure; mỗi công thức < 50 ms", unv === 0 && slow === 0, { unv, slow });
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("t-mtef-synth) Cấu trúc ĐÃ KIỂM bằng mẫu thật — byte tự dựng");
  check("y=f(x): biến, '=', ngoặc tròn", L([vars("y"), sym(0x3d), vars("f"), paren(vars("x"))].flat()) === "y=f\\left(x\\right)");
  check("(-1;0). : ngoặc + dấu trừ U+2212 + chấm", L([paren([sym(0x2212), num("1"), chr(1, 0x3b), num("0")].flat()), chr(1, 0x2e)].flat()) === "\\left(-1;0\\right).");
  check("[-1;5] ngoặc vuông", L(tmpl(3, 3, line([sym(0x2212), num("1"), chr(1, 0x3b), num("5")].flat()), chr(22, 0x5b), chr(22, 0x5d))) === "\\left[-1;5\\right]");
  check("căn bậc 2: \\sqrt{4x-x^{2}}", L(sqrt([num("4"), vars("x"), sym(0x2212), vars("x"), sup(num("2"))].flat())) === "\\sqrt{4x-x^{2}}");
  check("phân số lồng", L(frac(num("1"), frac(num("2"), num("3")))) === "\\frac{1}{\\frac{2}{3}}");
  check("chỉ số dưới tên chữ: y_{CT}", L([vars("y"), sub(vars("CT"))].flat()) === "y_{CT}");
  check("A_{CT} với chữ thường tf1 → \\text", L([vars("A"), sub(text(1, "CT"))].flat()) === "A_{\\text{CT}}");
  check("x² và sub rồi sup: x_{1}^{2}", L([vars("x"), sup(num("2"))].flat()) === "x^{2}" && L([vars("x"), sub(num("1")), sup(num("2"))].flat()) === "x_{1}^{2}");
  check("mũ đứng đầu LINE (chưa có cơ sở) → {}^{2}", L(sup(num("2"))) === "{}^{2}");
  check("PHÁ: hai mũ liền nhau → double_script (không để KaTeX báo lỗi mơ hồ)", L([vars("x"), sup(num("2")), sup(num("3"))].flat()) === "FAIL:double_script");
  check("PHÁ: hai chỉ số dưới liền nhau → double_script", L([vars("x"), sub(num("2")), sub(num("3"))].flat()) === "FAIL:double_script");
  check("hàm tf2 có cờ đầu hàm: A=\\sin A", L([vars("A"), sym(0x3d), text(2, "sin"), vars("A")].flat()) === "A=\\sin A");
  check("'cos' gõ bằng tf1 vẫn ra \\cos; hai hàm liền nhau tách theo cờ đầu hàm", L([text(1, "cos"), text(2, "sin"), vars("x")].flat()) === "\\cos \\sin x");
  check("tf1 không phải hàm → \\text{cm}; tf2 → \\mathrm{}", L([num("5"), text(1, "cm"), sup(num("2"))].flat()) === "5\\text{cm}^{2}" && L(text(2, "abc")) === "\\mathrm{abc}");
  check("Hy Lạp: \\frac{\\pi}{2}; α trong tf4", L([frac(greek(0x3c0), num("2"))].flat()) === "\\frac{\\pi }{2}" && L(greek(0x3b1)) === "\\alpha");
  check("số thập phân kiểu Việt 2,5 → 2{,}5 (không tách khoảng); dấu phẩy giữa chữ khác giữ nguyên", L([num("2"), chr(8, 0x2c), num("5")].flat()) === "2{,}5" && L([vars("x"), chr(1, 0x2c), vars("y")].flat()) === "x,y");
  check("125° : \\circ nằm trong mũ, không bọc thêm ^{}", L([num("125"), sup(sym(0xb0))].flat()) === "125^{\\circ }");
  check("ℝ, ∈, ≤: x\\in\\mathbb{R}, 5\\leq x", L([vars("x"), sym(0x2208), chr(11, 0x211d)].flat()) === "x\\in \\mathbb{R}" && L([num("5"), sym(0x2264), vars("x")].flat()) === "5\\leq x");
  check("f'(t): U+2032 trong tf6 → \\prime", L([vars("f"), sym(0x2032), paren(vars("t"))].flat()) === "f\\prime \\left(t\\right)");
  check("khoảng trắng tf24 EF02 → \\,", L([num("1"), chr(24, 0xef02), num("2")].flat()) === "1\\,2");
  check("ký tự 8-bit không mtcode (opt 0x20) typeface 1: Latin-1", L([chr8(1, 0x41)].flat()) === "A");
  check("RECORD trang trí (SIZE/FULL/COLOR/FONT_DEF/ENCODING_DEF/EQN_PREFS) được bỏ qua, kèm cảnh báo size_changed", (() => {
    const extra: Bytes = [9, 0, 0xc, 10, 11, 12, 13, 14, 15, 5, 16, 0, 1, 0, 2, 0, 3, 0, 17, 1, ...Buffer.from("Times\0"), 19, ...Buffer.from("enc\0"), 18, 0, 0, 0, 0];
    const d = dec(vars("x"), extra); return d.ok && d.latex === "x" && d.warnings.includes("size_changed");
  })());
  check("ngoặc sel 1,3 var 3 KHÔNG sinh cờ unverified", (() => { const d = dec(paren(vars("x"))); return d.ok && !d.warnings.includes(UNV); })());
  const qs = L(vars("x"));
  check("kết quả luôn qua katex.renderToString throwOnError", qs === "x" && renders(qs));

  section("Mẫu thật RỘNG: mọi .docx trong thư mục mẫu (không đệ quy; bỏ qua nếu không có) — tỉ lệ giải, KaTeX, chuẩn TeX gốc");
  {
    const files = fs.existsSync(dirS) ? fs.readdirSync(dirS).filter(f => /\.docx$/i.test(f) && !f.startsWith("~$")) : [];
    let total = 0, ok = 0, katexBad = 0, withTex = 0, sameTex = 0, threw = 0, unvFormulas = 0; const seenIds = new Set<string>(); const reasons: Record<string, number> = {};
    for (const f of files) {
      let z: JSZip; try { z = await JSZip.loadAsync(fs.readFileSync(path.join(dirS, f))); } catch { continue; }
      for (const n of Object.keys(z.files).filter(x => /^word\/embeddings\/oleObject\d+\.bin$/.test(x))) {
        const buf = await z.files[n].async("nodebuffer"); total++;
        let d: MathTypeDecode; try { d = decodeMathTypeOle(buf); } catch { threw++; continue; }
        const key = buf.length + ":" + buf.subarray(0, 64).toString("hex"); const first = !seenIds.has(key); seenIds.add(key);
        if (d.ok) {
          ok++; if (d.warnings.includes(UNV)) unvFormulas++;
          if (!renders(d.latex)) katexBad++;
          if (first) { const tx = mtefTexInputForTest(buf); if (tx !== null) { withTex++; if (normTex(d.latex) === normTex(tx)) sameTex++; } }
        } else reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
      }
    }
    if (!total) console.log(`  (SKIP) không có .docx chứa công thức trong ${dirS}`);
    else {
      console.log(`  → ${files.length} tệp .docx, ${total} công thức, giải được ${ok} (${(100 * ok / total).toFixed(2)}%), cần cờ unverified: ${unvFormulas}; có TeX gốc: ${withTex}, khớp ${sameTex} (${(100 * sameTex / Math.max(1, withTex)).toFixed(2)}%)`);
      console.log(`  → thất bại theo lý do: ${Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e.join(":")).join("  ")}`);
      check("không công thức nào làm decode ném lỗi", threw === 0, { threw });
      check("MỌI kết quả ok:true đều render được bằng KaTeX strict", katexBad === 0, { katexBad });
      check("tỉ lệ giải ≥ 95% trên toàn kho mẫu", ok / total >= 0.95, { ok, total });
      check("tỉ lệ khớp TeX gốc ≥ 98% (trên luồng khác nhau có TeX gốc, đã giải được)", withTex === 0 || sameTex / withTex >= 0.98, { withTex, sameTex });
    }
  }

  section("t-mtef-synth2) Cấu trúc CÓ BẰNG CHỨNG từ kho mẫu thật (bố cục ô/bit biến thể lấy từ dữ liệu thật; byte tự dựng) — không được gắn cờ");
  const L1 = line, X = vars("x");
  /** Cấu trúc ĐÃ KIỂM: kết quả đúng, KHÔNG cờ unverified_structure, và liệt kê đúng trong `structures`. */
  const V = (name: string, content: Bytes, want: string, struct: string) => {
    const d = dec(content);
    check(`${name} → ${want}`, d.ok && d.latex === want && !d.warnings.includes(UNV) && d.unverified.length === 0 && d.structures.includes(struct) && renders(d.latex), lx(d));
  };
  /** Cấu trúc CHƯA có bằng chứng: vẫn ra LaTeX nhưng PHẢI kèm cờ + nằm trong `unverified`. */
  const U = (name: string, content: Bytes, want: string, id: string) => {
    const d = dec(content);
    check(`${name} → ${want} (CHƯA có bằng chứng, có cờ)`, d.ok && d.latex === want && d.warnings.includes(UNV) && d.unverified.includes(id), lx(d));
  };
  V("tích phân ∫_0^1 (bit 0x10 dưới, 0x20 trên; ô: thân, DƯỚI, TRÊN, ký hiệu)", [tmpl(15, 0x31, L1(X), L1(num("0")), L1(num("1")), sym(0x222b)), vars("dx")].flat(), "\\int_{0}^{1} xdx", "integral");
  V("tích phân không cận", tmpl(15, 1, L1(X), emptyLine(), emptyLine(), sym(0x222b)), "\\int x", "integral");
  V("tích phân chỉ cận dưới", tmpl(15, 0x11, L1(X), L1(num("0")), emptyLine(), sym(0x222b)), "\\int_{0} x", "integral");
  V("tổng ∑_{i=1}^{n} (\\nolimits: cận cạnh ký hiệu)", tmpl(16, 0x31, L1(vars("i")), L1([vars("i"), sym(0x3d), num("1")].flat()), L1(vars("n")), sym(0x2211)), "\\sum\\nolimits_{i=1}^{n} i", "sum");
  V("tích ∏ chỉ cận dưới", tmpl(17, 0x11, L1(vars("a")), L1(vars("k")), emptyLine(), sym(0x220f)), "\\prod\\nolimits_{k} a", "sum");
  V("giới hạn lim_{x→0} (biến thể 0x10 = có cận dưới)", tmpl(23, 0x10, L1(text(2, "lim")), L1([X, sym(0x2192), num("0")].flat()), emptyLine()), "\\lim\\limits_{x\\to 0}", "limit");
  V("chữ trên mũi tên (T23 biến thể 0x20)", tmpl(23, 0x20, L1(sym(0x2192)), emptyLine(), L1(text(1, "xt"))), "\\overset{\\text{xt}}{\\to }", "limit_over");
  V("mũi tên phản ứng chỉ chữ trên (T14, ký tự mũi tên ở typeface 22)", tmpl(14, 4, L1(text(1, "xt")), emptyLine(), chr(22, 0x2192)), "\\xrightarrow{\\text{xt}}", "arrow_labeled");
  V("mũi tên phản ứng có chữ trên và dưới", tmpl(14, 12, L1(text(1, "xt")), L1(text(1, "yd")), chr(22, 0x2192)), "\\xrightarrow[\\text{yd}]{\\text{xt}}", "arrow_labeled");
  V("dấu ngoặc ngang dưới \\underbrace{ab}_{n}", tmpl(24, 0, L1(vars("ab")), L1(vars("n")), chr(22, 0xfe38)), "\\underbrace{ab}_{n}", "hbrace");
  V("căn bậc n: \\sqrt[3]{x}", tmpl(10, 1, L1(X), L1(num("3"))), "\\sqrt[3]{x}", "root_n");
  V("ma trận hj 0 = căn trái (ll)", matrix(2, 2, 0, [L1(num("1")), L1(num("0")), L1(num("0")), L1(num("1"))]), "\\begin{array}{ll}1&0\\\\0&1\\end{array}", "matrix");
  V("ma trận hj 1 = căn giữa (cc)", matrix(2, 2, 1, [L1(num("1")), L1(num("0")), L1(num("0")), L1(num("1"))]), "\\begin{array}{cc}1&0\\\\0&1\\end{array}", "matrix");
  V("ma trận hj 2 = căn phải (7/7 luồng có TeX gốc khớp)", matrix(1, 2, 2, [L1(num("1")), L1(num("2"))]), "\\begin{array}{rr}1&2\\end{array}", "matrix_right");
  V("hệ phương trình: ngoặc nhọn TRÁI + PILE căn trái", tmpl(2, 1, L1(pile(1, L1([X, sym(0x2b), vars("y"), sym(0x3d), num("1")].flat()), L1([X, sym(0x2212), vars("y"), sym(0x3d), num("2")].flat()))), chr(22, 0x7b)), "\\left\\{\\begin{array}{l}x+y=1\\\\x-y=2\\end{array}\\right.", "pile");
  V("EMBELL vectơ (11)", chr(3, 0x76, { emb: [11] }), "\\vec{v}", "embell:vec");
  V("EMBELL gạch trên (17) và chấm (2)", [chr(3, 0x78, { emb: [17] }), chr(3, 0x79, { emb: [2] })].flat(), "\\bar{x}\\dot{y}", "embell:bar");
  V("EMBELL phẩy (5): f'(t)", [chr(3, 0x66, { emb: [5] }), paren(vars("t"))].flat(), "f^{\\prime}\\left(t\\right)", "embell:prime");
  V("vectơ \\overrightarrow{AB} (T31 biến thể 2, 20d7)", tmpl(31, 2, L1(vars("AB")), chr(22, 0x20d7)), "\\overrightarrow{AB}", "vec_arrow");
  V("mũ ^ rộng một chữ (T33, 302)", tmpl(33, 0, L1(vars("A")), chr(22, 0x302)), "\\hat{A}", "hat");
  V("gạch trên \\overline{AB}", tmpl(13, 0, L1(vars("AB"))), "\\overline{AB}", "overline");
  V("SUBSUP một template (T29)", [X, tmpl(29, 0, L1(num("1")), L1(num("2")))].flat(), "x_{1}^{2}", "script_subsup");
  V("ký tự 8 mã đã kiểm: ∀ ∖ (tf11)/\\ tf1 → \\backslash", chr(1, 0x5c), "\\backslash", "char:symbol");
  check("structures/unverified luôn là mảng, không trùng, không rỗng khi ok", (() => { const d = dec([tmpl(11, 0, L1(num("1")), L1(num("2"))), sup(num("2"))].flat()); return d.ok && Array.isArray(d.structures) && Array.isArray(d.unverified) && d.structures.includes("frac") && new Set(d.structures).size === d.structures.length; })());
  check("mọi id trong structures/unverified đều có mục trong MATHTYPE_STRUCTURES (hoặc là 'char:<mã>')", (() => { const d = dec([chr(6, 0x2207), tmpl(34, 0, L1(vars("AB")), chr(22, 0x2322))].flat()); return d.ok && [...d.structures, ...d.unverified].every(i => i in MATHTYPE_STRUCTURES || /^char:[0-9a-f]+$/.test(i)); })());

  section("t-mtef-unverified) Cấu trúc CHƯA có bằng chứng thật (≤ vài mẫu / không có TeX gốc) — ra LaTeX nhưng PHẢI kèm cờ unverified_structure");
  U("tích phân kép ∬", tmpl(15, 2, L1(X), emptyLine(), emptyLine(), sym(0x222c)), "\\iint x", "integral_multi");
  U("tích phân đường ∮", tmpl(15, 1, L1(X), emptyLine(), emptyLine(), sym(0x222e)), "\\oint x", "integral_multi");
  U("∑ cận nằm trên/dưới (bit 0x40) → \\limits", tmpl(16, 0x71, L1(vars("i")), L1(num("1")), L1(vars("n")), sym(0x2211)), "\\sum\\limits_{1}^{n} i", "sum_limits_style");
  U("toán tử T21 (∫ không thân)", tmpl(21, 0x31, emptyLine(), L1(num("0")), L1(num("1")), L1(sym(0x222b))), "\\int_{0}^{1}", "integral_op");
  U("toán tử T22 (∑ không thân)", tmpl(22, 0x31, emptyLine(), L1(num("0")), L1(num("1")), L1(sym(0x2211))), "\\sum\\nolimits_{0}^{1}", "sum_op");
  U("PILE căn giữa", pile(2, L1(vars("a")), L1(vars("b"))), "\\begin{array}{c}a\\\\b\\end{array}", "pile_align");
  U("PILE căn phải", pile(3, L1(vars("a")), L1(vars("b"))), "\\begin{array}{r}a\\\\b\\end{array}", "pile_align");
  
  U("ngoặc nhọn góc ⟨x⟩", tmpl(0, 3, L1(X), chr(22, 0x2329), chr(22, 0x232a)), "\\left\\langle x\\right\\rangle", "fence:other");
  U("vectơ \\overleftarrow (T31.1)", tmpl(31, 1, L1(vars("CD")), chr(22, 0x20d6)), "\\overleftarrow{CD}", "vec_other");
  U("ngã rộng (T32)", tmpl(32, 0, L1(vars("AB")), chr(22, 0x303)), "\\widetilde{AB}", "tilde_wide");
  U("cung ⌢ (T34)", tmpl(34, 0, L1(vars("AB")), chr(22, 0x2322)), "\\overset{\\frown}{AB}", "arc");
  U("gạch dưới (T12)", tmpl(12, 0, L1(vars("C"))), "\\underline{C}", "underline");
  U("typeface 7 (in đậm vectơ)", chr(7, 0x76), "\\mathbf{v}", "char:vector_font");
  U("chữ có dấu đã thấy 1–2 lần (á) trong tf1", chr(1, 0xe1), "\\text{á}", "char:e1");
  V("chữ có dấu đã kiểm (à) trong tf1", chr(1, 0xe0), "\\text{à}", "char:accented");
  U("ký hiệu ∇ (không có TeX gốc)", sym(0x2207), "\\nabla", "char:2207");
  U("ký hiệu ∂ (không có TeX gốc)", sym(0x2202), "\\partial", "char:2202");
  U("ký hiệu ⇌ ← (không có TeX gốc)", [sym(0x21cc), sym(0x2190)].flat(), "\\rightleftharpoons \\leftarrow", "char:21cc");
  U("dấu gạch ngang – (U+2013) trong tf1", chr(1, 0x2013), "\\text{–}", "char:2013");
  check("unverified chỉ chứa phần CHƯA kiểm, không lẫn phần đã kiểm", (() => { const d = dec([frac(vars("a"), vars("b")), sym(0x2207)].flat()); return d.ok && d.unverified.length === 1 && d.unverified[0] === "char:2207" && d.structures.includes("frac"); })());

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("t-mtef-fail) Gặp gì lạ → thất bại CẢ công thức (không bao giờ trả LaTeX từng phần)");
  const F = (name: string, content: Bytes, reason: string, extra: Bytes = []) => { const r = lx(dec(content, extra)); check(name, r === `FAIL:${reason}`, r); };
  F("selector 8 (ngoặc mở) → unsupported_template:8.0", tmpl(8, 0, line(vars("x"))), "unsupported_template:8.0");
  F("selector 9 (khoảng) → unsupported_template:9.0", tmpl(9, 0, line(vars("x"))), "unsupported_template:9.0");
  F("selector 26 chia dài / 30 Dirac / 35 / 36 / 37 chưa hỗ trợ", tmpl(26, 0, line(vars("x"))), "unsupported_template:26.0");
  F("  … Dirac 30", tmpl(30, 0, line(vars("x"))), "unsupported_template:30.0");
  F("  … khung 37", tmpl(37, 0, line(vars("x"))), "unsupported_template:37.0");
  F("selector lạ 99", tmpl(99, 0, line(vars("x"))), "unsupported_template:99.0");
  F("phân số biến thể 1 (phân số nhỏ) → thất bại", tmpl(11, 1, line(num("1")), line(num("2"))), "unsupported_template:11.1");
  F("căn bậc 2 mà ô chỉ số không rỗng → thất bại", tmpl(10, 0, line(vars("x")), line(num("3"))), "unsupported_template:10.0");
  F("ngoặc biến thể 4 (var không hợp lệ)", tmpl(1, 4, line(vars("x")), chr(22, 0x28)), "unsupported_template:1.4");
  F("ngoặc tròn var 3 nhưng chỉ 2 ô (sai số ô)", tmpl(1, 3, line(vars("x")), chr(22, 0x28)), "unsupported_template:1.3");
  F("chỉ số trên biến thể 1 (đứng trước) → thất bại", tmpl(28, 1, emptyLine(), line(num("2"))), "unsupported_template:28.1");
  F("PILE căn lạ (halign 4) → thất bại", pile(4, line(vars("x"))), "unsupported_record:4");
  F("MATRIX có đường kẻ giữa ô → thất bại", matrix(1, 1, 2, [line(num("1"))], 0x55), "unsupported_record:5");
  F("MATRIX sai số ô (khai 2x2 chỉ có 3 ô) → corrupt", matrix(2, 2, 2, [line(num("1")), line(num("2")), line(num("3"))]), "corrupt");
  F("EMBELL mã chưa hỗ trợ (10) → embell", chr(3, 0x78, { emb: [10] }), "embell");
  F("EMBELL phẩy + phẩy → double_script", chr(3, 0x78, { emb: [5, 6] }), "double_script");
  F("tích phân sai số ô (3 ô, không biết cận nào) → thất bại", tmpl(15, 1, line(vars("x")), line(num("1")), sym(0x222b)), "unsupported_template:15.1");
  F("tích phân ký tự toán tử không phải ∫ → thất bại", tmpl(15, 1, line(vars("x")), sym(0x2211)), "unsupported_template:15.1");
  F("tổng ký tự lạ ở sel 21 → thất bại", tmpl(21, 3, line(vars("a")), line(vars("n")), line(num("0")), sym(0x2264)), "unsupported_template:21.3");
  F("giới hạn tên hàm không thuộc {lim,max,min,sup,inf}", tmpl(23, 0, line(text(2, "sin")), line(num("0"))), "unsupported_template:23.0");
  F("mũi tên ký tự lạ (↑) → thất bại", tmpl(14, 4, line(text(1, "t")), sym(0x2191)), "unsupported_template:14.4");
  F("vectơ hướng lạ (biến thể 8) → thất bại", tmpl(31, 8, line(vars("a")), chr(22, 0x20d7)), "unsupported_template:31.8");
  F("typeface 23 (marker) → unsupported_char", chr(23, 0x41), "unsupported_char:23:41");
  F("typeface 9 (user) → unsupported_char", chr(9, 0x41), "unsupported_char:9:41");
  F("typeface 22 (expand) ngoài ô ngoặc → unsupported_char", chr(22, 0x28), "unsupported_char:22:28");
  F("tf6 mã lạ (U+2603 ☃) → unsupported_char:6:2603", chr(6, 0x2603), "unsupported_char:6:2603");
  F("tf8 chữ cái → unsupported_char", chr(8, 0x41), "unsupported_char:8:41");
  F("tf1 chữ Việt (ư) → thất bại (0 mẫu thật, không đoán)", chr(1, 0x1b0), "unsupported_char:1:1b0");
  F("chữ Việt ạ/ế trong một cụm chữ → thất bại cả công thức", [chr(1, 0x6d), chr(1, 0x1ea1)].flat(), "unsupported_char:1:1ea1");
  F("tf11 ký tự lạ (ꙮ) → unsupported_char", chr(11, 0xa66e), "unsupported_char:11:a66e");
  F("tf1 '^' → thất bại (không đoán)", chr(1, 0x5e), "unsupported_char:1:5e");
  F("mã 8-bit không mtcode ở typeface symbol → thất bại", chr8(6, 0x41), "unsupported_char:6:41");
  F("Hy Lạp tf4 ký tự không phải Hy Lạp → thất bại", chr(4, 0x41), "unsupported_char:4:41");
  check("tag lạ 50 → unsupported_record:50", lx(decodeMathTypeOle(oleRaw([...headRaw(), 50, 0]))) === "FAIL:unsupported_record:50");
  check("tag lạ 20 (ngay trên ENCODING_DEF) → unsupported_record:20", lx(decodeMathTypeOle(oleRaw([...headRaw(), 20, 0]))) === "FAIL:unsupported_record:20");
  check("SIZE nhánh 101 thiếu byte → corrupt", lx(decodeMathTypeOle(oleRaw([...headRaw(), 9, 101, 1]))) === "FAIL:corrupt");
  check("thiếu END của LINE (cắt cụt) → corrupt", lx(decodeMathTypeOle(oleRaw([...headRaw(), 1, 0, ...chr(3, 0x78)]))) === "FAIL:corrupt");
  check("byte dư sau LINE (END thừa thứ hai) → corrupt", lx(decodeMathTypeOle(oleRaw([...headRaw(), ...line(chr(3, 0x78)), 0, 0]))) === "FAIL:corrupt");
  check("hai LINE ở gốc → corrupt", lx(decodeMathTypeOle(oleRaw([...headRaw(), ...line(chr(3, 0x78)), ...line(chr(3, 0x79))]))) === "FAIL:corrupt");
  check("gốc không phải LINE (CHAR trần) → corrupt", lx(decodeMathTypeOle(oleRaw([...headRaw(), ...chr(3, 0x78)]))) === "FAIL:corrupt");
  check("PHÁ: ô rỗng toàn bộ → empty", lx(dec([])) === "FAIL:empty");
  check("MTEF v3 / phiên bản lạ → mtef_version", lx(decodeMathTypeOle(oleRaw([3, 1, 0, 0, 0, 0, 0]))) === "FAIL:mtef_version");
  check("EQNOLEFILEHDR sai (cbHdr ≠ 28) → bad_header", (() => { const s = equationStream(mtef(vars("x"))); s.writeUInt16LE(30, 0); return lx(decodeMathTypeOle(buildCfb([{ name: "Equation Native", data: s }]))) === "FAIL:bad_header"; })());
  check("EQNOLEFILEHDR cbObject lệch → bad_header", (() => { const s = equationStream(mtef(vars("x"))); s.writeUInt32LE(5, 8); return lx(decodeMathTypeOle(buildCfb([{ name: "Equation Native", data: s }]))) === "FAIL:bad_header"; })());
  check("CFB không có luồng Equation Native → no_equation_stream", lx(decodeMathTypeOle(buildCfb([{ name: "Other", data: Buffer.from("x") }]))) === "FAIL:no_equation_stream");
  check("không phải CFB → not_cfb", lx(decodeMathTypeOle(Buffer.from("hello world, not an ole file"))) === "FAIL:not_cfb");
  check("lưới an toàn KaTeX: LaTeX không render được → katex_invalid (mô phỏng bằng thay renderToString)", (() => {
    const orig = katex.renderToString;
    try { (katex as { renderToString: unknown }).renderToString = () => { throw new Error("giả lập"); }; return lx(dec(vars("x"))) === "FAIL:katex_invalid"; }
    finally { (katex as { renderToString: unknown }).renderToString = orig; }
  })());

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("t-mtef-limits) Giới hạn kích thước/độ sâu/số record/độ dài + fuzz");
  {
    const nest = (n: number): Bytes => { let x: Bytes = vars("x"); for (let i = 0; i < n; i++) x = tmpl(11, 0, line(x), line(num("1"))); return x; }; // mỗi tầng = TMPL + LINE (2 mức độ sâu)
    const d20 = lx(dec(nest(19))), d21 = lx(dec(nest(21)));
    check("độ sâu vừa trần (19 tầng phân số = 39 mức) → ok; vượt (21 tầng) → limit", d20.startsWith("\\frac") && d21 === "FAIL:limit", [d20.slice(0, 20), d21]);
    const t1 = Date.now();
    const deepBytes: Bytes = []; const N = 10000; for (let i = 0; i < N; i++) deepBytes.push(1, 0, 3, 0, 11, 0, 0); deepBytes.push(...num("1")); for (let i = 0; i < N; i++) deepBytes.push(0, 0, 0, 0);
    check("PHÁ: lồng 10^4 tầng → limit nhanh, không tràn ngăn xếp", lx(decodeMathTypeOle(oleRaw([...headRaw(), ...deepBytes]))) === "FAIL:limit" && Date.now() - t1 < 2000);
    const many: Bytes = []; for (let i = 0; i < 2001; i++) many.push(...chr(3, 0x78));
    check("2001 record → limit", lx(dec(many)) === "FAIL:limit");
    const few: Bytes = []; for (let i = 0; i < 1500; i++) few.push(...chr(3, 0x78));
    check("1500 record vẫn ok (dưới trần 2000)", dec(few).ok);
    const longLatex: Bytes = []; for (let i = 0; i < 900; i++) longLatex.push(...greek(0x3b1));
    check("LaTeX > 5000 ký tự → limit", lx(dec(longLatex)) === "FAIL:limit");
    const tooBig = Buffer.alloc(MATHTYPE_LIMITS.maxBin + 1); oleOf(vars("x")).copy(tooBig);
    check(".bin 64 KB + 1 → limit (không đọc)", lx(decodeMathTypeOle(tooBig)) === "FAIL:limit");
    const streamBig = buildCfb([{ name: "Equation Native", data: Buffer.alloc(MATHTYPE_LIMITS.maxStream + 10, 1) }]);
    check("luồng Equation Native > 32 KB → limit", streamBig.length <= MATHTYPE_LIMITS.maxBin ? lx(decodeMathTypeOle(streamBig)) === "FAIL:limit" : true);
    const t2 = Date.now();
    const fake50 = Buffer.alloc(50 * 1024 * 1024, 0xd0);
    const r50 = decodeMathTypeOle(fake50);
    const fake50cfb = Buffer.alloc(50 * 1024 * 1024); oleOf(vars("x")).copy(fake50cfb);
    check("PHÁ: .bin giả 50 MB (đầy 0xD0 / đầu CFB hợp lệ) → limit tức thì", !r50.ok && lx(r50) === "FAIL:limit" && lx(decodeMathTypeOle(fake50cfb)) === "FAIL:limit" && Date.now() - t2 < 1000);
    check("PHÁ: byte ngẫu nhiên 3000 B / mảng rỗng → không ném, ok:false", (() => { const r = Buffer.alloc(3000); for (let i = 0; i < r.length; i++) r[i] = (i * 2654435761) >>> 24; return never(() => decodeMathTypeOle(r)) && !decodeMathTypeOle(r).ok && !decodeMathTypeOle(Buffer.alloc(0)).ok; })());
    const good = oleOf([frac(vars("a"), sqrt(vars("b"))), sup(num("2"))].flat());
    let cut = 0, cutThrow = 0;
    for (let n = 0; n < good.length; n += 7) { cut++; if (!never(() => decodeMathTypeOle(good.subarray(0, n)))) cutThrow++; }
    check(`PHÁ: bin cắt cụt ở ${cut} độ dài khác nhau → không bao giờ ném, mọi trường hợp ok:false`, cutThrow === 0 && Array.from({ length: cut }, (_, i) => i * 7).every(n => !decodeMathTypeOle(good.subarray(0, n)).ok));
    const streamOnly = equationStream(mtef([frac(vars("a"), sqrt(vars("b"))), sup(num("2")), paren(greek(0x3c0)), text(2, "sin")].flat()));
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
    let threw = 0, oks = 0, oks_render = 0, fails = 0;
    for (let i = 0; i < 2000; i++) {
      const b = Buffer.from(streamOnly);
      const flips = 1 + (rnd() % 3);
      for (let k = 0; k < flips; k++) b[rnd() % b.length] = rnd() & 255;
      let r: MathTypeDecode | null = null;
      try { r = decodeEquationStream(b); } catch { threw++; }
      if (r?.ok) { oks++; if (renders(r.latex)) oks_render++; } else fails++;
    }
    check(`fuzz 2000 lần lật byte: không lần nào ném (ok=${oks}, thất bại=${fails})`, threw === 0);
    check("fuzz: mọi kết quả ok:true đều render được bằng KaTeX", oks === oks_render);
    let threwCfb = 0;
    for (let i = 0; i < 1500; i++) { const b = Buffer.from(good); b[rnd() % b.length] = rnd() & 255; if (!never(() => decodeMathTypeOle(b))) threwCfb++; }
    check("fuzz 1500 lần lật byte trên CẢ CFB: không lần nào ném", threwCfb === 0);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("t-docx-mathtype) readDocx + parseAzotaBlocks với .docx tổng hợp");
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
  const RT_OLE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject";
  const relOle = (id: string, target: string, type = RT_OLE) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
  const OLEO = (rid: string, prog = "Equation.DSMT4") => `<w:r><w:object><v:shape><v:imagedata r:id="rIdNone"/></v:shape><o:OLEObject Type="Embed" ProgID="${prog}" ShapeID="x" r:id="${rid}"/></w:object></w:r>`;
  const Rt = (t: string, u = false) => `<w:r>${u ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ""}<w:t xml:space="preserve">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r>`;
  const Pp = (...x: string[]) => `<w:p>${x.join("")}</w:p>`;
  async function mkDocx(body: string, o: { files?: Record<string, Buffer | string>; rels?: string; rawDoc?: string; names?: number } = {}): Promise<Buffer> {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    zip.file("word/document.xml", o.rawDoc ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
    zip.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + (o.rels ?? "") + "</Relationships>");
    for (const [k, v] of Object.entries(o.files ?? {})) zip.file(k, v);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
  const rejects = async (buf: Buffer) => { try { await readDocx(buf); return null; } catch (e) { return e instanceof DocxError ? e.code : String(e); } };
  const goodBin = oleOf([frac(num("1"), num("2"))].flat());
  const unsupBin = oleOf(tmpl(8, 0, line(vars("x"))));
  const SEC = Pp(Rt("PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn."));
  {
    const files: Record<string, Buffer> = { "word/embeddings/oleObject1.bin": goodBin, "word/embeddings/oleObject2.bin": unsupBin, "word/embeddings/oleObject3.bin": Buffer.from("không phải CFB, hỏng hoàn toàn") };
    const rels = relOle("rId1", "embeddings/oleObject1.bin") + relOle("rId2", "embeddings/oleObject2.bin") + relOle("rId3", "embeddings/oleObject3.bin");
    const body = SEC + Pp(Rt("Câu 1. Tính "), OLEO("rId1"), Rt(" ?")) + Pp(Rt("A. "), OLEO("rId1")) + Pp(Rt("B. "), OLEO("rId2")) + Pp(Rt("C. "), OLEO("rId3")) + Pp(Rt("D. d", true))
      + Pp(Rt("Câu 2. Tính "), OLEO("rId1")) + Pp(Rt("A. a")) + Pp(Rt("B. b", true)) + Pp(Rt("C. c")) + Pp(Rt("D. d"));
    const read = await readDocx(await mkDocx(body, { files, rels }));
    const runs = read.blocks.flatMap(b => (b.kind === "p" ? b.runs : [])).filter(r => r.formula === "ole");
    check("run của công thức giải được: text '$\\frac{1}{2}$', formula 'ole', latex '\\frac{1}{2}'", runs[0]?.text === "$\\frac{1}{2}$" && runs[0].formula === "ole" && runs[0].latex === "\\frac{1}{2}", runs[0]);
    check("công thức không giải được (selector 8) → nhãn ⟦công thức⟧, không latex, mathtypeFail nhóm", runs[2]?.text === FORMULA_PLACEHOLDER && !runs[2].latex && runs[2].mathtypeFail === "unsupported_template", runs[2]);
    check("PHÁ: .bin hỏng (không phải CFB) → nhãn, tệp vẫn đọc được", runs[3]?.text === FORMULA_PLACEHOLDER && runs[3].mathtypeFail === "not_cfb", runs[3]);
    const st = read.formulaStats;
    check("formulaStats: total 5, decoded 3, failed 2, byReason gom nhóm (không kèm số)", st.total === 5 && st.decoded === 3 && st.failed === 2 && st.byReason.unsupported_template === 1 && st.byReason.not_cfb === 1 && st.timedOut === false, st);
    const p = parseAzotaBlocks(read.blocks);
    const q1 = p.questions.find(q => q.number === 1), q2 = p.questions.find(q => q.number === 2);
    check("t-flags: câu 2 chỉ có công thức giải được → KHÔNG cờ formula_unread, chữ đề có $…$", !!q2 && !q2.flags.includes("formula_unread") && q2.text.includes("$\\frac{1}{2}$"), q2);
    check("t-flags: câu 1 còn nhãn (phương án B, C) → formula_unread + cảnh báo (chặn phát hành như cũ)", !!q1 && q1.flags.includes("formula_unread") && p.warnings.some(w => w.code === "formula_unread" && w.question === q1.key), q1?.flags);
    check("t-flags: câu 1 phương án A giữ $\\frac{1}{2}$, B/C giữ nhãn", q1?.options[0].text === "$\\frac{1}{2}$" && q1.options[1].text === FORMULA_PLACEHOLDER && q1.options[2].text === FORMULA_PLACEHOLDER, q1?.options);
    check("stats.withFormulaUnread = 1 (chỉ câu 1)", p.stats.withFormulaUnread === 1, p.stats);
  }
  {
    // PHÁ: .bin quá 64 KB chỉ làm công thức đó giữ nhãn
    const huge = Buffer.concat([goodBin, Buffer.alloc(MATHTYPE_LIMITS.maxBin + 1000)]);
    const files = { "word/embeddings/oleObject1.bin": huge, "word/embeddings/oleObject2.bin": goodBin };
    const rels = relOle("rId1", "embeddings/oleObject1.bin") + relOle("rId2", "embeddings/oleObject2.bin");
    const read = await readDocx(await mkDocx(Pp(Rt("x ")) + Pp(OLEO("rId1"), OLEO("rId2")), { files, rels }));
    const runs = read.blocks.flatMap(b => (b.kind === "p" ? b.runs : [])).filter(r => r.formula === "ole");
    check("PHÁ: .bin 64 KB+ → riêng công thức đó giữ nhãn (limit), công thức khác vẫn giải", runs[0].text === FORMULA_PLACEHOLDER && runs[0].mathtypeFail === "limit" && runs[1].text === "$\\frac{1}{2}$", runs);
  }
  {
    // PHÁ: đích không hợp lệ bị bỏ qua
    const rels = relOle("rId1", "../../evil.bin") + relOle("rId2", "embeddings/payload.exe") + relOle("rId3", "customXml/item1.xml") + relOle("rId4", "embeddings/oleObject1.bin", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image") + relOle("rId5", "/word/embeddings/oleObject9.bin") + relOle("rId6", "embeddings/oleObject1.bin.exe");
    const files = { "word/embeddings/oleObject1.bin": goodBin, "word/embeddings/payload.exe": goodBin, "customXml/item1.xml": goodBin, "word/embeddings/oleObject9.bin": goodBin, "word/embeddings/oleObject1.bin.exe": goodBin };
    const read = await readDocx(await mkDocx(Pp(OLEO("rId1"), OLEO("rId2"), OLEO("rId3"), OLEO("rId4"), OLEO("rId6"), OLEO("rId5")), { files, rels }));
    const runs = read.blocks.flatMap(b => (b.kind === "p" ? b.runs : [])).filter(r => r.formula === "ole");
    // rId5 (/word/embeddings/oleObject9.bin) là tuyệt đối nhưng trỏ đúng thư mục → được chấp nhận như đích hợp lệ sau khi bỏ '/word/'; các cái còn lại phải bị bỏ.
    check("PHÁ: '..', '.exe', ngoài embeddings/, Type không phải oleObject, đuôi giả → đều giữ nhãn", runs.slice(0, 5).every(r => r.text === FORMULA_PLACEHOLDER && r.mathtypeFail === "no_ole"), runs.map(r => r.mathtypeFail));
    check("đích tuyệt đối '/word/embeddings/oleObjectN.bin' hợp lệ vẫn giải", runs[5]?.text === "$\\frac{1}{2}$", runs[5]);
  }
  {
    // ProgID khác (không phải Equation/MathType) không đi vào bộ giải
    const files = { "word/embeddings/oleObject1.bin": goodBin }; const rels = relOle("rId1", "embeddings/oleObject1.bin");
    const read = await readDocx(await mkDocx(Pp(OLEO("rId1", "Excel.Sheet.12")), { files, rels }));
    check("OLE khác (Excel) không bị coi là công thức; formulaStats.total = 0", read.formulaStats.total === 0 && read.blocks.flatMap(b => (b.kind === "p" ? b.runs : [])).every(r => !r.formula));
  }
  {
    const files: Record<string, string> = {}; for (let i = 0; i < DOCX_MAX_ENTRIES + 1; i++) files[`word/x${i}.txt`] = "a";
    check(`> ${DOCX_MAX_ENTRIES} mục nén → TOO_LARGE; đúng ${DOCX_MAX_ENTRIES - 4}+ mục vẫn đọc được`, (await rejects(await mkDocx("", { files }))) === "TOO_LARGE" && await (async () => { const f2: Record<string, string> = {}; for (let i = 0; i < DOCX_MAX_ENTRIES - 10; i++) f2[`word/x${i}.txt`] = "a"; return (await rejects(await mkDocx(Pp(Rt("x")), { files: f2 }))) === null; })());
    check("DOCTYPE vẫn bị chặn (document.xml)", (await rejects(await mkDocx("", { rawDoc: `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><w:document ${NS}><w:body/></w:document>` }))) === "NOT_DOCX");
    check("PHÁ: zip bomb — hai .bin khai 20 MB mỗi cái (> 30 MB tổng) → TOO_LARGE", await (async () => {
      const f3 = { "word/embeddings/oleObject1.bin": Buffer.alloc(20 * 1024 * 1024), "word/embeddings/oleObject2.bin": Buffer.alloc(20 * 1024 * 1024) };
      const buf = await mkDocx(Pp(Rt("x")), { files: f3, rels: relOle("rId1", "embeddings/oleObject1.bin") + relOle("rId2", "embeddings/oleObject2.bin") });
      return buf.length < 400_000 && (await rejects(buf)) === "TOO_LARGE";
    })());
    check("PHÁ: một .bin giải nén 20 MB (dưới 30 MB) → chỉ công thức đó giữ nhãn, giải nén dừng ở 64 KB", await (async () => {
      const buf = await mkDocx(Pp(OLEO("rId1")), { files: { "word/embeddings/oleObject1.bin": Buffer.alloc(20 * 1024 * 1024) }, rels: relOle("rId1", "embeddings/oleObject1.bin") });
      const r = await readDocx(buf); const run = r.blocks.flatMap(b => (b.kind === "p" ? b.runs : []))[0];
      return run.text === FORMULA_PLACEHOLDER && run.mathtypeFail === "limit";
    })());
    check(`quá ${MATHTYPE_LIMITS.maxFormulas} công thức trong tệp → phần dư giữ nhãn (limit), không treo`, await (async () => {
      const n = MATHTYPE_LIMITS.maxFormulas + 5, t3 = Date.now();
      const r = await readDocx(await mkDocx(Pp(...Array.from({ length: n }, () => OLEO("rId1"))), { files: { "word/embeddings/oleObject1.bin": goodBin }, rels: relOle("rId1", "embeddings/oleObject1.bin") }));
      return r.formulaStats.total === n && r.formulaStats.decoded === MATHTYPE_LIMITS.maxFormulas && r.formulaStats.byReason.limit === 5 && Date.now() - t3 < 3000;
    })());
    check("tệp không có công thức: formulaStats toàn 0 (tương thích ngược)", await (async () => { const r = await readDocx(await mkDocx(Pp(Rt("x")))); return r.formulaStats.total === 0 && r.formulaStats.failed === 0; })());
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("Docx thật De_Toan12_GK1_Azota.docx (nếu có): readDocx + parseAzotaBlocks end-to-end");
  {
    const f = path.join(dirS, "De_Toan12_GK1_Azota.docx");
    if (!fs.existsSync(f)) console.log("  (SKIP) không có tệp");
    else {
      const t4 = Date.now();
      const read = await readDocx(fs.readFileSync(f));
      const p = parseAzotaBlocks(read.blocks);
      const st = read.formulaStats;
      console.log(`  → công thức ${st.decoded}/${st.total}; ${p.stats.total} câu; chặn (formula_unread) ${p.stats.withFormulaUnread}; ${Date.now() - t4} ms`);
      check("107/107 công thức MathType đọc được (formulaStats), 0 thất bại", st.total === 107 && st.decoded === 107 && st.failed === 0 && !st.timedOut, st);
      check("22 câu (12 TN + 4 Đ/S + 6 trả lời ngắn), đủ 22 đáp án, KHÔNG câu nào còn nhãn ⟦công thức⟧", p.stats.total === 22 && p.stats.withAnswer === 22 && p.stats.withFormulaUnread === 0 && !JSON.stringify(p.questions).includes(FORMULA_PLACEHOLDER), p.stats);
      const allLatex = p.questions.flatMap(q => [q.text, ...q.options.map(o => o.text)]).join("\u0001").match(/\$[^$]+\$/g) ?? [];
      check("mọi đoạn $…$ trong đề đều render được bằng KaTeX", allLatex.length > 50 && allLatex.every(s => renders(s.slice(1, -1))), allLatex.length);
      check("không có cảnh báo formula_unread", !p.warnings.some(w => w.code === "formula_unread"));
      check("phản hồi < 3 giây", Date.now() - t4 < 3000, Date.now() - t4);
    }
  }

  console.log(`\n${pass} pass / ${failN} fail  (${Date.now() - t0} ms)` + (real299.total ? `  · mẫu thật ${real299.ok}/${real299.total}` : ""));
  process.exit(failN ? 1 : 0);
})();
