// BU-03-MATHTYPE spike (chỉ đọc, không ghi): thống kê công thức MathType (OLE "Equation Native", MTEF v5) trong .docx hoặc thư mục đã giải nén.
// Chạy: node tools/mathtype-spike.mjs <tệp.docx|thư-mục-giải-nén> [...]   (cần jszip nếu truyền .docx). Đây là tài liệu tham khảo cho src/lib/mathtype/*, KHÔNG phải mã sản phẩm.
import fs from "fs"; import path from "path";
function readCfb(buf) { // header 512B → DIFAT → FAT → directory → (mini)stream
  if (buf.readUInt32BE(0) !== 0xd0cf11e0) throw new Error("not cfb");
  const ss = 1 << buf.readUInt16LE(30), mss = 1 << buf.readUInt16LE(32), cutoff = buf.readUInt32LE(56), END = 0xfffffffa;
  const sec = n => { const o = 512 + n * ss; if (o + ss > buf.length) throw new Error("sector oob"); return buf.subarray(o, o + ss); };
  const dif = []; for (let i = 0; i < 109; i++) { const v = buf.readUInt32LE(76 + 4 * i); if (v < END) dif.push(v); }
  let d = buf.readUInt32LE(68); for (let i = 0; i < buf.readUInt32LE(72) && d < END; i++) { const s = sec(d); for (let j = 0; j < ss / 4 - 1; j++) { const v = s.readUInt32LE(4 * j); if (v < END) dif.push(v); } d = s.readUInt32LE(ss - 4); }
  const fat = []; for (const f of dif.slice(0, buf.readUInt32LE(44))) { const s = sec(f); for (let j = 0; j < ss / 4; j++) fat.push(s.readUInt32LE(4 * j)); }
  const chain = (c, t) => { const o = []; while (c < END) { o.push(c); c = t[c]; if (o.length > 1e5 || c === undefined) throw new Error("bad chain"); } return o; };
  const big = c => Buffer.concat(chain(c, fat).map(sec)), dir = big(buf.readUInt32LE(48)), ents = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) { const nl = dir.readUInt16LE(o + 64); if (nl) ents.push({ name: dir.subarray(o, o + nl - 2).toString("utf16le"), type: dir[o + 66], start: dir.readUInt32LE(o + 116), size: Number(dir.readBigUInt64LE(o + 120)) }); }
  const root = ents.find(e => e.type === 5), mini = root ? big(root.start).subarray(0, root.size) : Buffer.alloc(0), mf = [];
  if (buf.readUInt32LE(64)) { const m = big(buf.readUInt32LE(60)); for (let j = 0; j < m.length / 4; j++) mf.push(m.readUInt32LE(4 * j)); }
  const e = ents.find(x => x.type === 2 && x.name === "Equation Native"); if (!e) return null;
  return (e.size < cutoff ? Buffer.concat(chain(e.start, mf).map(n => mini.subarray(n * mss, (n + 1) * mss))) : big(e.start)).subarray(0, e.size);
}
function parseMtef(s) { // bỏ 28B EQNOLEFILEHDR; trả { tags, tmpl, chars, tex, consumed, len }
  const b = s.subarray(28); let p = 0; const rd = () => { if (p >= b.length) throw new Error("eof"); return b[p++]; }, u16 = () => rd() | (rd() << 8);
  const uint = () => { const v = rd(); return v < 255 ? v : u16(); }, str = () => { while (rd()); };
  if (rd() !== 5) throw new Error("MTEF != 5"); rd(); rd(); rd(); rd(); str(); rd();
  const st = { tags: {}, tmpl: {}, chars: {}, tex: [], embell: {} };
  const nudge = o => { if (o & 8 && rd() === 128 && rd() === 128) { u16(); u16(); } }, ruler = () => { const n = rd(); for (let i = 0; i < n; i++) { rd(); uint(); } };
  const dims = () => { const n = rd(); let have = false, cur = 0; const nib = () => { if (!have) { cur = rd(); have = true; return cur >> 4; } have = false; return cur & 15; }; for (let i = 0; i < n; i++) { nib(); while (nib() !== 15); } };
  const list = d => { if (d > 60) throw new Error("deep"); while (rec(d)); };
  function rec(d) { const t = rd(); st.tags[t] = (st.tags[t] || 0) + 1;
    switch (t) { case 0: return false;
      case 1: { const o = rd(); nudge(o); if (o & 4) uint(); if (o & 2) { rd(); ruler(); } if (!(o & 1)) list(d + 1); return true; }
      case 2: { const o = rd(); nudge(o); const tf = rd() - 128; let mt = -1; if (!(o & 0x20)) mt = u16(); if (o & 4) rd(); if (o & 0x10) u16();
        const k = `tf${tf} U+${mt.toString(16)}`; st.chars[k] = (st.chars[k] || 0) + 1; if (o & 1) while (rec(d)); return true; }
      case 3: { const o = rd(); nudge(o); const sel = rd(); let v = rd(); if (v & 128) v = (v & 127) | (rd() << 8); rd(); const k = `sel${sel} var${v}`; st.tmpl[k] = (st.tmpl[k] || 0) + 1; list(d + 1); return true; }
      case 4: { const o = rd(); nudge(o); rd(); rd(); if (o & 2) { rd(); ruler(); } list(d + 1); return true; }
      case 5: { const o = rd(); nudge(o); rd(); rd(); rd(); const r = rd(), c = rd(); for (let i = 0; i < Math.ceil((r + 1) / 4) + Math.ceil((c + 1) / 4); i++) rd(); list(d + 1); return true; }
      case 6: { const o = rd(); nudge(o); const k = rd(); st.embell[k] = (st.embell[k] || 0) + 1; return true; }
      case 7: ruler(); return true; case 8: uint(); rd(); return true;
      case 9: { const l = rd(); if (l === 101) u16(); else if (l === 100) { rd(); u16(); } else rd(); return true; }
      case 10: case 11: case 12: case 13: case 14: return true; case 15: uint(); return true;
      case 16: { const o = rd(); for (let i = 0; i < (o & 1 ? 8 : 6); i++) rd(); if (o & 4) str(); return true; }
      case 17: uint(); str(); return true; case 18: rd(); dims(); dims(); { const n = rd(); for (let i = 0; i < n; i++) if (uint()) rd(); } return true; case 19: str(); return true;
      default: if (t >= 100) { const n = uint(); st.tex.push(b.subarray(p, p + n).toString("latin1").split("\0")[1] ?? ""); p += n; return true; } throw new Error("tag " + t + " @" + (p - 1)); } }
  while (p < b.length) rec(0); return { ...st, consumed: p, len: b.length };
}
async function* bins(arg) { // sinh { name, buf } cho mọi word/embeddings/*.bin
  if (/\.docx$/i.test(arg)) { const JSZip = (await import("jszip")).default; const z = await JSZip.loadAsync(fs.readFileSync(arg)); for (const n of Object.keys(z.files).filter(n => /^word\/embeddings\/.*\.bin$/.test(n))) yield { name: n, buf: await z.files[n].async("nodebuffer") }; }
  else { const d = path.join(arg, "word/embeddings"); for (const f of fs.existsSync(d) ? fs.readdirSync(d) : []) yield { name: f, buf: fs.readFileSync(path.join(d, f)) }; } }
const add = (a, b) => { for (const k in b) a[k] = (a[k] || 0) + b[k]; };
for (const arg of process.argv.slice(2)) { const tot = { tags: {}, tmpl: {}, chars: {}, embell: {} }; let n = 0, ok = 0, tex = 0, min = 1e9, max = 0; const bad = [];
  for await (const { name, buf } of bins(arg)) { n++; try { const s = readCfb(buf); if (!s) throw new Error("no Equation Native"); const r = parseMtef(s); if (r.consumed !== r.len) throw new Error("dư byte"); ok++; tex += r.tex.length; min = Math.min(min, s.length); max = Math.max(max, s.length); for (const k of ["tags", "tmpl", "chars", "embell"]) add(tot[k], r[k]); } catch (e) { bad.push(name + ": " + e.message); } }
  console.log(JSON.stringify({ file: arg, bins: n, decodedClean: ok, withTexInput: tex, bytesMin: min, bytesMax: max, fail: bad.slice(0, 5), ...tot }, null, 1)); }
