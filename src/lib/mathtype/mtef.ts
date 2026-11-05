// BU-03-MATHTYPE — giải MathType (OLE "Equation Native", MTEF v5) → LaTeX. THUẦN (chỉ cần katex để KIỂM kết quả), không DB, không mạng, KHÔNG BAO GIỜ ném ra ngoài.
// Luật cốt lõi: CẢ CÔNG THỨC HOẶC KHÔNG GÌ CẢ. Gặp record / selector / typeface / mã ký tự / tuỳ chọn lạ → thất bại cả công thức, không bỏ ký tự, không đoán.
// LaTeX ra phải qua katex.renderToString({throwOnError:true, strict:"error"}) mới coi là ok.
// Cây → LaTeX nằm ở mtefLatex.ts. MTEF v3 không hỗ trợ (mẫu thật 0/299) → `mtef_version`.
import katex from "katex";
import { readCfbStream } from "./cfb";
import { MtefFail, emitLatex, type MNode } from "./mtefLatex";

export type MathTypeFailReason =
  | "not_cfb" | "corrupt" | "no_equation_stream" | "bad_header" | "mtef_version"
  | "limit" | `unsupported_record:${number}` | `unsupported_template:${number}.${number}`
  | `unsupported_char:${number}:${string}` | "embell" | "double_script" | "katex_invalid" | "empty";
export type MathTypeDecode = { ok: true; latex: string; warnings: string[] } | { ok: false; reason: MathTypeFailReason };

export const MATHTYPE_LIMITS = { maxBin: 64 * 1024, maxStream: 32 * 1024, maxRecords: 2000, maxDepth: 40, maxLatex: 5000, maxFormulaMs: 50, maxFileMs: 3000, maxFormulas: 1000 };

const fail = (r: MathTypeFailReason): never => { throw new MtefFail(r); };

export interface ParsedMtef { top: MNode[]; futures: { tag: number; raw: Buffer }[]; sawSize: boolean }

/** Giải cây MTEF v5 từ phần sau 28 byte EQNOLEFILEHDR. Ném MtefFail. */
export function parseMtef(b: Buffer): ParsedMtef {
  let p = 0, nrec = 0, sawSize = false;
  const rd = (): number => { if (p >= b.length) return fail("corrupt"); return b[p++]; };
  const u16 = (): number => { const lo = rd(); return lo | (rd() << 8); };
  const uint = (): number => { const v = rd(); return v < 255 ? v : u16(); };
  const sint = (): number => { const v = rd(); return v < 255 ? v - 128 : u16() - 32768; };
  const str = (): string => { let o = ""; for (let i = 0; ; i++) { if (i > 256) fail("corrupt"); const c = rd(); if (!c) return o; o += String.fromCharCode(c); } };
  const skip = (n: number) => { if (n < 0 || p + n > b.length) fail("corrupt"); p += n; };

  if (rd() !== 5) fail("mtef_version");
  rd(); rd(); rd(); rd(); str(); rd(); // platform, product, productVersion, productSubversion, appKey, equationOptions
  const futures: { tag: number; raw: Buffer }[] = [];
  const nudge = (o: number) => { if (o & 8) { const a = rd(), c = rd(); if (a === 128 && c === 128) { u16(); u16(); } } };
  const ruler = () => { const n = rd(); for (let i = 0; i < n; i++) { rd(); sint(); } };
  const lineRuler = () => { if (rd() !== 7) fail("corrupt"); ruler(); };
  /** Mảng kích thước/khoảng cách của EQN_PREFS: n phần tử, mỗi phần tử là dãy nibble kết thúc bằng 15 (đơn vị + chữ số). */
  const dimArr = () => {
    const n = rd(); let have = false, cur = 0;
    const nib = () => { if (!have) { cur = rd(); have = true; return cur >> 4; } have = false; return cur & 15; };
    for (let i = 0; i < n; i++) { nib(); for (let g = 0; ; g++) { if (g > 64) fail("corrupt"); if (nib() === 15) break; } }
  };

  type R = MNode | "END" | null;
  function objs(depth: number): MNode[] {
    if (depth > MATHTYPE_LIMITS.maxDepth) fail("limit");
    const list: MNode[] = [];
    for (;;) { const r = rec(depth); if (r === "END") return list; if (r) list.push(r); }
  }
  function rec(depth: number): R {
    if (++nrec > MATHTYPE_LIMITS.maxRecords) fail("limit");
    const t = rd();
    switch (t) {
      case 0: return "END";
      case 1: {
        const o = rd(); nudge(o);
        if (o & 4) sint();
        if (o & 2) lineRuler();
        if (o & 1) return { t: "LINE", empty: true, k: [] };
        return { t: "LINE", empty: false, k: objs(depth + 1) };
      }
      case 2: {
        const o = rd(); nudge(o);
        const tf = rd() - 128;
        const c: Extract<MNode, { t: "CHAR" }> = { t: "CHAR", o, tf, emb: [] };
        if (!(o & 0x20)) c.mt = u16();
        if (o & 4) c.c8 = rd();
        if (o & 0x10) c.c16 = u16();
        if (o & 1) for (;;) { const e = rec(depth + 1); if (e === "END") break; if (e === null || typeof e === "string" || e.t !== "EMBELL") return fail("corrupt"); c.emb.push(e.code); }
        return c;
      }
      case 3: {
        const o = rd(); nudge(o);
        const sel = rd(); let v = rd(); if (v & 0x80) v = (v & 0x7f) | (rd() << 8);
        const to = rd();
        return { t: "TMPL", sel, v, to, k: objs(depth + 1) };
      }
      case 4: {
        const o = rd(); nudge(o);
        const ha = rd(), va = rd();
        if (o & 2) lineRuler();
        return { t: "PILE", ha, va, k: objs(depth + 1) };
      }
      case 5: {
        const o = rd(); nudge(o);
        const va = rd(), hj = rd(), vj = rd(), rows = rd(), cols = rd();
        const rp: number[] = [], cp: number[] = [];
        for (let i = 0, n = Math.ceil((rows + 1) * 2 / 8); i < n; i++) rp.push(rd());
        for (let i = 0, n = Math.ceil((cols + 1) * 2 / 8); i < n; i++) cp.push(rd());
        return { t: "MATRIX", va, hj, vj, rows, cols, rp, cp, k: objs(depth + 1) };
      }
      case 6: { const o = rd(); nudge(o); return { t: "EMBELL", code: rd() }; }
      case 7: ruler(); return null;
      case 8: uint(); rd(); return null; // FONT_STYLE_DEF — chưa có mẫu thật
      case 9: { sawSize = true; const l = rd(); if (l === 101) u16(); else if (l === 100) { rd(); u16(); } else rd(); return null; }
      case 10: case 11: case 12: case 13: case 14: return null; // FULL, SUB, SUB2, SYM, SUBSYM
      case 15: uint(); return null; // COLOR
      case 16: { const o = rd(); const n = o & 1 ? 4 : 3; for (let i = 0; i < n * 2; i++) rd(); if (o & 4) str(); return null; } // COLOR_DEF
      case 17: uint(); str(); return null; // FONT_DEF
      case 18: { rd(); dimArr(); dimArr(); const n = rd(); for (let i = 0; i < n; i++) { const f = uint(); if (f) rd(); } return null; } // EQN_PREFS
      case 19: str(); return null; // ENCODING_DEF
      default:
        if (t >= 100) { const n = uint(); const raw = b.subarray(p, p + n); skip(n); futures.push({ tag: t, raw }); return null; }
        return fail(`unsupported_record:${t}`);
    }
  }

  const top: MNode[] = [];
  // Gốc: các record khai báo (font, kích thước, FUTURE…) + ĐÚNG MỘT LINE + đúng một END đóng toàn bộ (mẫu thật 299/299 có END này); byte dư/đối tượng thứ hai → corrupt.
  let topEnd = 0;
  while (p < b.length) {
    const r = rec(0);
    if (r === "END") { if (top.length !== 1 || ++topEnd > 1) fail("corrupt"); continue; }
    if (r) { if (top.length > 0 || topEnd > 0) fail("corrupt"); top.push(r); }
  }
  return { top, futures, sawSize };
}

/** CHỈ DÙNG TRONG TEST: lấy "TeX Input Language" (record FUTURE 102) nếu có. Không dùng làm nguồn ở sản xuất. */
export function mtefTexInputForTest(ole: Buffer): string | null {
  try {
    const s = readCfbStream(ole, "Equation Native", MATHTYPE_LIMITS.maxStream);
    if (!s.ok) return null;
    const parsed = parseMtef(s.data.subarray(28));
    const f = parsed.futures.find(x => x.tag === 102);
    return f ? (f.raw.toString("latin1").split("\0")[1] ?? "") : null;
  } catch { return null; }
}

/** Giải một luồng "Equation Native" (đã gồm 28 byte EQNOLEFILEHDR). */
export function decodeEquationStream(s: Buffer): MathTypeDecode {
  try {
    if (s.length < 28 + 6) return { ok: false, reason: "bad_header" };
    if (s.readUInt16LE(0) !== 28 || s.readUInt32LE(2) !== 0x00020000 || s.readUInt32LE(8) !== s.length - 28) return { ok: false, reason: "bad_header" };
    const parsed = parseMtef(s.subarray(28));
    const warnings: string[] = [];
    if (parsed.futures.some(f => f.tag === 102)) warnings.push("has_tex_input");
    if (parsed.sawSize) warnings.push("size_changed");
    if (parsed.top.length !== 1 || parsed.top[0].t !== "LINE") return { ok: false, reason: "corrupt" };
    const e = emitLatex(parsed.top[0]);
    for (const w of e.warnings) if (!warnings.includes(w)) warnings.push(w);
    // bỏ khoảng trắng đầu/cuối; `\ ` (dấu cách thoát) ở CUỐI vô nghĩa và nếu cắt dở sẽ thành `\` treo → bỏ cả cặp.
    const latex = e.latex.replace(/^\s+/, "").replace(/(?:\\ |\s)+$/, "");
    if (!latex) return { ok: false, reason: "empty" };
    if (latex.length > MATHTYPE_LIMITS.maxLatex) return { ok: false, reason: "limit" };
    try { katex.renderToString(latex, { throwOnError: true, strict: "error", displayMode: false }); }
    catch { return { ok: false, reason: "katex_invalid" }; }
    return { ok: true, latex, warnings };
  } catch (e) {
    if (e instanceof MtefFail) return { ok: false, reason: e.reason };
    if (e instanceof RangeError) return { ok: false, reason: "limit" };
    return { ok: false, reason: "corrupt" };
  }
}

/** Điểm vào: nhận nguyên tệp `oleObjectN.bin` (CFB). Không bao giờ ném. */
export function decodeMathTypeOle(buf: Buffer): MathTypeDecode {
  try {
    if (!Buffer.isBuffer(buf)) return { ok: false, reason: "corrupt" };
    if (buf.length > MATHTYPE_LIMITS.maxBin) return { ok: false, reason: "limit" };
    const s = readCfbStream(buf, "Equation Native", MATHTYPE_LIMITS.maxStream);
    if (!s.ok) return { ok: false, reason: s.reason === "stream_missing" ? "no_equation_stream" : s.reason };
    return decodeEquationStream(s.data);
  } catch { return { ok: false, reason: "corrupt" }; }
}

/** Nhóm lý do để đếm/ghi nhật ký (bỏ phần số kèm theo). */
export function mathTypeReasonGroup(r: MathTypeFailReason): string { return r.split(":")[0]; }
