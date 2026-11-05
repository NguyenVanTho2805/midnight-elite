// BU-03-MATHTYPE — ảnh xem trước WMF (Windows Metafile) của công thức MathType → SVG THUẦN. Không dependency, không DB, không mạng, KHÔNG BAO GIỜ ném ra ngoài.
// Mục đích: công thức mà bộ giải MTEF không chắc/không giải được vẫn HIỂN THỊ ĐÚNG (như trong Word) bằng ảnh, thay vì nhãn ⟦công thức⟧.
// Luật: chỉ hiểu các record mà MathType thật sự dùng (~17 loại). Gặp record LẠ CÓ TÁC DỤNG VẼ, font lạ, ký tự không ánh xạ được, mảnh ngoặc to ghép không khớp → THẤT BẠI cả ảnh (không đoán).
// Chữ vẽ bằng <text> theo từng ký tự (x là danh sách) nên khoảng cách đúng như WMF dù font máy khác. Font Symbol/Euclid Symbol/MT Extra đổi sang Unicode.
// Ngoặc ( ) [ ] { } và tích phân to ghép từ mảnh font Symbol (⎛⎜⎝…) được VẼ LẠI bằng đường (path) để co giãn đúng và không phụ thuộc font.
// Font hiển thị là font MÁY CỦA NGƯỜI XEM (Times New Roman → Times → serif): hình dạng chữ có thể khác nhẹ Word, vị trí/kích thước thì theo WMF.
import { FORMULA_SVG_MAX, validateFormulaSvg } from "./formulaImg";
export { FORMULA_IMG_RE, FORMULA_IMG_PLACEHOLDER, FORMULA_SVG_MAX, makeFormulaImgToken, validateFormulaSvg, sanitizeFormulaImgTokens, svgFromFormulaImgB64, visibleLength, clipVisible } from "./formulaImg";

export const WMF_LIMITS = { maxBytes: 256 * 1024, maxRecords: 5000, maxObjects: 256, maxTexts: 400 } as const;
export type WmfSvgResult =
  | { ok: true; svg: string; widthPt: number; heightPt: number; /** khoảng từ đường cơ sở của dòng chính tới đáy ảnh (pt) — dùng làm vertical-align âm khi chèn nội dòng */ depthPt: number; notes: string[] }
  | { ok: false; reason: string };

class WmfFail extends Error { constructor(public reason: string) { super(reason); } }
const fail = (r: string): never => { throw new WmfFail(r); };

// ── Ánh xạ glyph → Unicode: CHỈ mã có BẰNG CHỨNG từ kho mẫu thật ─────────────────────────────────────
// Đo bằng tools/local-e2e/mathtype-glyphs.ts trên ~372.000 cặp (ảnh WMF, OLE) khác nhau: đếm glyph (font, mã byte) trong ExtTextOut của WMF và đếm ký tự Unicode
// (mtcode) do chính MathType ghi trong MTEF của cùng công thức. Một mã được giữ khi >= 5 luồng khớp số lần VÀ tỉ lệ >= 98% (cùng ngưỡng với mtefLatex.meetsVerifiedThreshold).
// Mỗi mục: [ký tự, số luồng khớp, số luồng có glyph]. Mã không có bằng chứng ĐỦ thì KHÔNG có trong bảng → ảnh thất bại có chủ đích (không đoán).
// Bản trước dùng bảng "Adobe Symbol" và ghi chú "đã đối chiếu" nhưng sai ở: MT Extra a1/a2 (ℤ/ℝ bị đảo — đo: a1 = ℝ 2833/2834, a2 = ℤ 2141/2141), Symbol 0x6a/0x66 (φ/ϕ bị đảo),
// font chữ Times New Roman với charset Hy Lạp (0xC4 = Δ chứ không phải Ä...), Symbol 0xBE (không khớp 249/249 luồng), đ trong VNI (MathType tự ghi ñ), cung ⌢ và mũ rộng b6.
type Ev = readonly [char: string, matched: number, total: number];
/** Symbol và Euclid Symbol (cùng bảng mã; số liệu gộp hai font). Chữ Hy Lạp theo mtcode của MathType. */
const SYMBOL_EVIDENCE: Record<number, Ev> = {
  0x22: ["∀", 2059, 2061], 0x24: ["∃", 42, 42], 0x2a: ["∗", 98, 98], 0x2d: ["−", 78419, 78436], 0x44: ["Δ", 4742, 4745], 0x4e: ["Ν", 11, 11], 0x52: ["Ρ", 15, 15], 0x57: ["Ω", 969, 969], 0x5a: ["Ζ", 15, 15],
  0x5e: ["⊥", 8582, 8584], 0x61: ["α", 6213, 6213], 0x62: ["β", 824, 824], 0x64: ["δ", 25, 25], 0x66: ["\u03d5", 8, 8], 0x67: ["γ", 125, 125], 0x6a: ["\u03c6", 488, 488], 0x6c: ["λ", 26, 26], 0x6d: ["μ", 28, 28],
  0x6f: ["ο", 8, 8], 0x70: ["π", 10916, 10919], 0x71: ["θ", 224, 224], 0x72: ["ρ", 8, 8], 0x73: ["σ", 44, 44], 0x77: ["ω", 107, 107],
  0xa2: ["′", 20866, 21167], 0xa3: ["≤", 3989, 3989], 0xa5: ["∞", 5655, 5655], 0xab: ["↔", 12, 12], 0xae: ["→", 5820, 5822], 0xb0: ["°", 4701, 4702], 0xb1: ["±", 886, 886], 0xb3: ["≥", 2940, 2941],
  0xb4: ["×", 324, 324], 0xb7: ["•", 101, 101], 0xb9: ["≠", 2527, 2528], 0xba: ["≡", 321, 321], 0xbb: ["≈", 4136, 4136], 0xbc: ["…", 867, 867], 0xc5: ["⊕", 83, 83], 0xc6: ["∅", 115, 115],
  0xc7: ["∩", 3876, 3880], 0xc8: ["∪", 1119, 1120], 0xc9: ["⊃", 52, 52], 0xcb: ["⊄", 106, 106], 0xcc: ["⊂", 1784, 1784], 0xce: ["∈", 10265, 10269], 0xcf: ["∉", 205, 205], 0xd0: ["∠", 17, 17],
  0xd7: ["⋅", 4091, 4091], 0xd9: ["∧", 8, 8], 0xda: ["∨", 77, 77], 0xdb: ["⇔", 15046, 15051], 0xde: ["⇒", 19222, 19223], 0xe5: ["∑", 66, 66], 0xf2: ["∫", 5524, 5525],
};
/** Mã Symbol trùng ASCII (dấu câu/ngoặc/chữ số): đồng nhất theo thiết kế font; không đo được bằng đếm ký tự vì ngoặc và dấu cũng do mẫu (template) sinh ra. */
const SYMBOL_ASCII = new Set([0x20, 0x21, 0x23, 0x25, 0x26, 0x28, 0x29, 0x2b, 0x2c, 0x2e, 0x2f, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x5b, 0x5d, 0x5f, 0x7b, 0x7c, 0x7d]);
function symbolChar(c: number): string | null {
  if (c >= 0x30 && c <= 0x39) return String.fromCharCode(c);
  if (SYMBOL_ASCII.has(c)) return String.fromCharCode(c);
  const e = SYMBOL_EVIDENCE[c];
  return e ? e[0] : null;
}
/** MT Extra (và Euclid Extra, cùng bảng mã): chữ số tập hợp ℝ ℤ ℚ ℕ và ∘. Bản trước đảo ℝ/ℤ. */
const MTEXTRA_EVIDENCE: Record<number, Ev> = { 0xa1: ["ℝ", 2833, 2834], 0xa2: ["ℤ", 2141, 2141], 0xa4: ["ℚ", 13, 13], 0xa5: ["ℕ", 916, 916], 0x6f: ["∘", 506, 506] };
const EUCLID_EXTRA_EVIDENCE: Record<number, Ev> = { 0xa1: ["ℝ", 202, 203], 0xa2: ["ℤ", 191, 192], 0xa5: ["ℕ", 55, 55], 0x6f: ["∘", 31, 31] };
/** Euclid Math One: chỉ các mã đạt ngưỡng. 0xD0 là ↷ (curvearrowright), KHÔNG phải cung ⌢ như bản trước dựng. */
const EUCLID_MATH_ONE_EVIDENCE: Record<number, Ev> = { 0x81: ["\\", 9, 9], 0x82: ["∖", 5, 5], 0xd0: ["↷", 7, 7] };
const MTEXTRA: Record<number, string> = Object.fromEntries(Object.entries(MTEXTRA_EVIDENCE).map(([k, v]) => [k, v[0]]));
const EUCLID_EXTRA: Record<number, string> = Object.fromEntries(Object.entries(EUCLID_EXTRA_EVIDENCE).map(([k, v]) => [k, v[0]]));
const EUCLID_MATH_ONE: Record<number, string> = Object.fromEntries(Object.entries(EUCLID_MATH_ONE_EVIDENCE).map(([k, v]) => [k, v[0]]));
/** Mũ rộng (accent hat) của MT Extra: chỉ 0xB7 đạt ngưỡng (3774/3780). 0xB6 chỉ 21/31 và cung ⌢ chỉ 3 luồng → không vẽ đoán. */
const ACCENT_HAT_EVIDENCE: Record<string, Ev> = { "mt extra|b7": ["\u0302", 3774, 3780] };
/**
 * Chữ có byte >= 0x80 chỉ nhận cho Times New Roman với charset ANSI (lfCharSet = 0): các font cùng tên với charset Hy Lạp (161), Đông Âu (238), Thổ (162)… dùng bảng mã khác
 * (vd. 0xC4 = Δ, 0xF0 = π trong cp1253 — bản trước vẽ thành Ä, ð). Các mã dưới đây có >= 5 luồng khớp, 0 lệch.
 */
const TNR_ANSI_EVIDENCE: Record<number, Ev> = {
  0x92: ["’", 39, 39], 0x95: ["•", 18, 18], 0x96: ["–", 150, 150], 0xa0: ["\u00a0", 3026, 3028], 0xd0: ["Ð", 20, 20], 0xe0: ["à", 131, 131], 0xe1: ["á", 16, 16], 0xe2: ["â", 9, 9], 0xea: ["ê", 20, 20],
  0xec: ["ì", 45, 45], 0xed: ["í", 10, 10], 0xef: ["ï", 5, 5], 0xf3: ["ó", 41, 41], 0xf4: ["ô", 10, 10], 0xf9: ["ù", 6, 6], 0xfa: ["ú", 18, 18],
};
const LATIN_FACES = new Set(["times new roman", "arial", "calibri", "cambria", "cambria math", "courier new", "tahoma", "verdana", "georgia", "segoe ui"]);

/** Mảnh ngoặc to của Symbol: mã → [họ, vị trí, bên]. */
type Frag = { fam: "paren" | "bracket" | "brace" | "int"; pos: "top" | "ex" | "mid" | "bot"; side: "L" | "R" | "?" };
const FRAG: Record<number, Frag> = {
  0xe6: { fam: "paren", pos: "top", side: "L" }, 0xe7: { fam: "paren", pos: "ex", side: "L" }, 0xe8: { fam: "paren", pos: "bot", side: "L" },
  0xf6: { fam: "paren", pos: "top", side: "R" }, 0xf7: { fam: "paren", pos: "ex", side: "R" }, 0xf8: { fam: "paren", pos: "bot", side: "R" },
  0xe9: { fam: "bracket", pos: "top", side: "L" }, 0xea: { fam: "bracket", pos: "ex", side: "L" }, 0xeb: { fam: "bracket", pos: "bot", side: "L" },
  0xf9: { fam: "bracket", pos: "top", side: "R" }, 0xfa: { fam: "bracket", pos: "ex", side: "R" }, 0xfb: { fam: "bracket", pos: "bot", side: "R" },
  0xec: { fam: "brace", pos: "top", side: "L" }, 0xed: { fam: "brace", pos: "mid", side: "L" }, 0xee: { fam: "brace", pos: "bot", side: "L" },
  0xfc: { fam: "brace", pos: "top", side: "R" }, 0xfd: { fam: "brace", pos: "mid", side: "R" }, 0xfe: { fam: "brace", pos: "bot", side: "R" },
  0xef: { fam: "brace", pos: "ex", side: "?" },
  0xf3: { fam: "int", pos: "top", side: "?" }, 0xf4: { fam: "int", pos: "ex", side: "?" }, 0xf5: { fam: "int", pos: "bot", side: "?" },
};

// ── Font ────────────────────────────────────────────────────────────────────────────────────────
interface FontObj { kind: "font"; size: number; italic: boolean; bold: boolean; underline: boolean; strike: boolean; face: string; charset: number; map: "text" | "symbol" | "mtextra" }
interface PenObj { kind: "pen"; none: boolean; width: number; color: string }
interface BrushObj { kind: "brush"; none: boolean; color: string }
type Obj = FontObj | PenObj | BrushObj | { kind: "other" };

const hex2 = (n: number): string => (n < 16 ? "0" : "") + n.toString(16);
/** COLORREF 00BBGGRR (byte thấp = R). Byte cao là cờ (MathType ghi 0x02 = palette-RGB) — bỏ qua. */
const colorOf = (r: number, g: number, b: number): string => hex2(r) + hex2(g) + hex2(b);
const attrFill = (c: string): string => (c === "000000" ? "" : ` fill="#${c}"`);
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FAMILY_ROOT = "Times New Roman,Times,Cambria Math,STIX Two Math,serif";

interface TextOp { xs: number[]; y: number; text: string; size: number; italic: boolean; bold: boolean; under: boolean; strike: boolean; color: string; face: string }
interface FragOp { code: number; f: Frag; x: number; y: number; size: number; color: string }
/** Mũ/cung kéo giãn theo bề rộng chữ bên dưới (MT Extra b6/b7 = widehat, Euclid Extra bc = cung ⌢). Font kéo giãn glyph bằng lfWidth nên KHÔNG đọc được bề rộng từ WMF: lấy theo chữ nằm ngay dưới (ước lượng, ghi `accent_estimated`). */
interface AccOp { acc: "hat" | "arc"; x: number; y: number; size: number; color: string }
// Bề rộng ký tự Times New Roman (đơn vị 1/1000 em) — dùng CHỈ để ước lượng độ rộng của chữ nằm dưới mũ/cung (đã khớp dx của mẫu: u=500, O=722).
const TW: Record<string, number> = { A: 611, B: 611, C: 667, D: 722, E: 611, F: 611, G: 722, H: 722, I: 333, J: 444, K: 667, L: 556, M: 833, N: 667, O: 722, P: 611, Q: 722, R: 611, S: 500, T: 556, U: 722, V: 611, W: 833, X: 611, Y: 556, Z: 556, a: 500, b: 500, c: 444, d: 500, e: 444, f: 278, g: 500, h: 500, i: 278, j: 278, k: 444, l: 278, m: 722, n: 500, o: 500, p: 500, q: 500, r: 389, s: 389, t: 278, u: 500, v: 444, w: 667, x: 444, y: 444, z: 389 };

export function wmfToSvg(input: Uint8Array): WmfSvgResult {
  try { return convert(input); }
  catch (e) { return { ok: false, reason: e instanceof WmfFail ? e.reason : "internal" }; }
}

function convert(buf: Uint8Array): WmfSvgResult {
  if (!(buf instanceof Uint8Array)) return fail("not_bytes");
  if (buf.length < 40) return fail("too_short");
  if (buf.length > WMF_LIMITS.maxBytes) return fail("too_big");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => dv.getUint16(o, true), i16 = (o: number) => dv.getInt16(o, true), u32 = (o: number) => dv.getUint32(o, true);
  const notes: string[] = [];

  let p = 0, inch = 0, bb = [0, 0, 0, 0];
  if (u32(0) === 0x9ac6cdd7) { bb = [i16(6), i16(8), i16(10), i16(12)]; inch = u16(14); p = 22; }
  if (p + 18 > buf.length) return fail("too_short");
  const hType = u16(p), hSize = u16(p + 2);
  if ((hType !== 1 && hType !== 2) || hSize !== 9) return fail("bad_header");
  p += hSize * 2;

  let orgX = 0, orgY = 0, extX = 0, extY = 0, haveOrg = false, haveExt = false;
  let cx = 0, cy = 0, align = 0, textColor = "000000", bkMode = 1;
  const objs: (Obj | null)[] = [];
  let selFont: FontObj | null = null;
  let selPen: PenObj = { kind: "pen", none: false, width: 1, color: "000000" };
  let selBrush: BrushObj = { kind: "brush", none: false, color: "ffffff" };
  const ops: (string | TextOp | FragOp | AccOp)[] = [];
  let path = "", pathPen: PenObj | null = null, pathEnd: [number, number] | null = null;
  let nrec = 0, ntext = 0;
  const baseCount = new Map<number, number>();
  let drewAnything = false;

  const flushPath = () => {
    if (path && pathPen) {
      const w = Math.max(pathPen.width, 8);
      ops.push(`<path d="${path}" fill="none" stroke="#${pathPen.color}" stroke-width="${w}" stroke-linejoin="round"/>`);
    }
    path = ""; pathPen = null; pathEnd = null;
  };
  const alloc = (o: Obj) => {
    const i = objs.indexOf(null);
    if (i < 0) { if (objs.length >= WMF_LIMITS.maxObjects) fail("too_many_objects"); objs.push(o); } else objs[i] = o;
  };
  const getObj = (i: number): Obj => { const o = objs[i]; if (!o) return fail("bad_object"); return o; };

  let ended = false;
  while (p + 6 <= buf.length) {
    if (++nrec > WMF_LIMITS.maxRecords) return fail("too_many_records");
    const words = u32(p), fn = u16(p + 4), sz = words * 2;
    if (words < 3 || p + sz > buf.length) return fail("bad_record_size");
    const a = p + 6; // tham số
    const rec = sz - 6;
    const need = (n: number) => { if (rec < n) fail("short_record"); };
    switch (fn) {
      case 0x0000: ended = true; break; // EOF
      case 0x0626: break; // Escape (chú thích MathType) — không vẽ
      case 0x0102: need(2); bkMode = u16(a); break; // SetBkMode
      case 0x0201: need(4); if (bkMode === 2 && colorOf(buf[a], buf[a + 1], buf[a + 2]) !== "ffffff") return fail("opaque_bkcolor"); break; // SetBkColor
      case 0x0209: need(4); textColor = colorOf(buf[a], buf[a + 1], buf[a + 2]); break; // SetTextColor
      case 0x012e: need(2); align = u16(a); break; // SetTextAlign
      case 0x0103: need(2); break; // SetMapMode (toạ độ logic giữ nguyên; viewBox lấy từ WindowOrg/Ext)
      case 0x0106: case 0x0107: break; // SetPolyFillMode, SetStretchBltMode
      case 0x0104: need(2); if (u16(a) !== 13) return fail("rop2"); break; // SetROP2 phải là COPYPEN
      case 0x020b: need(4); orgY = i16(a); orgX = i16(a + 2); haveOrg = true; break; // SetWindowOrg (y, x)
      case 0x020c: need(4); extY = i16(a); extX = i16(a + 2); haveExt = true; break; // SetWindowExt (y, x)
      case 0x0214: need(4); cy = i16(a); cx = i16(a + 2); break; // MoveTo
      case 0x0213: { // LineTo
        need(4);
        const ny = i16(a), nx = i16(a + 2);
        if (selPen.none) { cx = nx; cy = ny; break; }
        if (pathPen && (pathPen.color !== selPen.color || pathPen.width !== selPen.width)) flushPath();
        if (!pathPen) pathPen = selPen;
        if (pathEnd && pathEnd[0] === cx && pathEnd[1] === cy) path += `L${nx} ${ny}`; else path += `M${cx} ${cy}L${nx} ${ny}`;
        pathEnd = [nx, ny]; cx = nx; cy = ny; drewAnything = true;
        break;
      }
      case 0x02fb: { // CreateFontIndirect
        need(18 + 2);
        const h = i16(a), esc_ = i16(a + 4), ori = i16(a + 6), wt = i16(a + 8);
        const italic = buf[a + 10] !== 0, under = buf[a + 11] !== 0, strike = buf[a + 12] !== 0;
        let face = ""; for (let i = a + 18; i < p + sz && buf[i]; i++) { if (face.length > 40) return fail("bad_font"); face += String.fromCharCode(buf[i]); }
        if (esc_ !== 0 || ori !== 0) return fail("rotated_font");
        const low = face.toLowerCase();
        const map: FontObj["map"] = low === "symbol" || low === "euclid symbol" ? "symbol" : low === "mt extra" || low === "euclid extra" || low === "euclid math one" ? "mtextra" : "text";
        // Chiều cao âm = chiều cao ký tự (em). Dương = ô chữ gồm cả khoảng cách dòng → em xấp xỉ 0,87.
        const size = h < 0 ? -h : Math.round(h * 0.87);
        alloc({ kind: "font", size, italic, bold: wt >= 600, underline: under, strike, charset: buf[a + 13], face: /^[A-Za-z0-9 _-]{1,40}$/.test(face) ? face : "serif", map });
        break;
      }
      case 0x02fa: { // CreatePenIndirect: style u16, width (x,y) 2×int16, colorref
        need(10);
        const style = u16(a) & 0xf;
        if (style > 5) return fail("pen_style");
        alloc({ kind: "pen", none: style === 5, width: Math.abs(i16(a + 2)), color: colorOf(buf[a + 6], buf[a + 7], buf[a + 8]) });
        break;
      }
      case 0x02fc: { // CreateBrushIndirect: style u16, colorref, hatch u16
        need(8);
        const style = u16(a);
        if (style !== 0 && style !== 1) return fail("brush_style");
        alloc({ kind: "brush", none: style === 1, color: colorOf(buf[a + 2], buf[a + 3], buf[a + 4]) });
        break;
      }
      case 0x012d: { // SelectObject
        need(2);
        flushPath();
        const o = getObj(u16(a));
        if (o.kind === "font") selFont = o; else if (o.kind === "pen") selPen = o; else if (o.kind === "brush") selBrush = o;
        break;
      }
      case 0x01f0: { need(2); const i = u16(a); if (!objs[i]) return fail("bad_object"); objs[i] = null; break; } // DeleteObject
      case 0x0324: case 0x0325: { // Polygon / Polyline
        need(2);
        const n = i16(a);
        if (n < 2 || n > 64 || rec < 2 + n * 4) return fail("bad_poly");
        flushPath();
        let d = "";
        for (let i = 0; i < n; i++) d += `${i ? "L" : "M"}${i16(a + 2 + i * 4)} ${i16(a + 4 + i * 4)}`;
        if (fn === 0x0324) {
          const fill = selBrush.none ? "none" : `#${selBrush.color}`;
          const stroke = selPen.none ? ` stroke="none"` : ` stroke="#${selPen.color}" stroke-width="${Math.max(selPen.width, 8)}" stroke-linejoin="round"`;
          ops.push(`<path d="${d}Z" fill="${fill}"${stroke}/>`);
        } else if (!selPen.none) ops.push(`<path d="${d}" fill="none" stroke="#${selPen.color}" stroke-width="${Math.max(selPen.width, 8)}" stroke-linejoin="round"/>`);
        drewAnything = true;
        break;
      }
      case 0x0a32: case 0x0521: { // ExtTextOut / TextOut
        if (++ntext > WMF_LIMITS.maxTexts) return fail("too_many_texts");
        flushPath();
        if (!selFont) return fail("no_font");
        let y: number, x: number, n: number, so: number, dxo = -1;
        if (fn === 0x0a32) {
          need(8);
          y = i16(a); x = i16(a + 2); n = u16(a + 4); const op = u16(a + 6);
          if (op & ~0x0004) return fail("exttextout_options"); // chỉ chấp nhận CLIPPED (hình chữ nhật bị bỏ qua); OPAQUE/PDY/… → thất bại
          so = a + 8 + (op & 4 ? 8 : 0);
          if (n > 400 || so + n + (n & 1) > p + sz) return fail("bad_text");
          const after = so + n + (n & 1);
          if (p + sz - after >= n * 2) dxo = after; else return fail("no_dx");
        } else {
          need(2);
          n = u16(a); so = a + 2;
          const after = so + n + (n & 1);
          if (n > 400 || after + 4 > p + sz) return fail("bad_text");
          y = i16(after); x = i16(after + 2);
          return fail("textout_no_dx"); // TextOut không có dx → bề rộng không xác định; MathType không dùng
        }
        if (n === 0) break;
        const xs: number[] = []; let acc = 0;
        for (let i = 0; i < n; i++) { xs.push(acc); const d = i16(dxo + i * 2); if (d < 0 || d > 20000) return fail("bad_dx"); acc += d; }
        if (align & 1) { x = cx; y = cy; }
        const hz = align & 6;
        if (hz === 2) x -= acc; else if (hz === 6) x -= Math.round(acc / 2); else if (hz !== 0) return fail("text_align");
        const vt = align & 24;
        if (vt === 0) y += Math.round(selFont.size * 0.8); else if (vt === 8) y -= Math.round(selFont.size * 0.2); else if (vt !== 24) return fail("text_align");
        let s = "";
        for (let i = 0; i < n; i++) {
          const c = buf[so + i];
          const px = x + xs[i];
          if (selFont.map === "symbol" && FRAG[c]) {
            ops.push({ code: c, f: FRAG[c], x: px, y, size: selFont.size, color: textColor });
            s += "\u0000"; // chỗ trống: mảnh ngoặc do đường vẽ đảm nhiệm
            drewAnything = true;
            continue;
          }
          const faceLow = selFont.face.toLowerCase();
          if (faceLow === "mt extra" && c === 0xb7) { // mũ rộng ^ (accent hat) — mã duy nhất đạt ngưỡng bằng chứng (ACCENT_HAT_EVIDENCE)
            ops.push({ acc: "hat", x: px, y, size: selFont.size, color: textColor });
            s += "\u0000"; drewAnything = true;
            if (!notes.includes("accent_estimated")) notes.push("accent_estimated");
            continue;
          }
          let ch: string | null;
          if (selFont.map === "symbol") ch = symbolChar(c);
          else if (selFont.map === "mtextra") ch = (faceLow === "euclid extra" ? EUCLID_EXTRA : faceLow === "euclid math one" ? EUCLID_MATH_ONE : MTEXTRA)[c] ?? null;
          else if (c >= 0x20 && c < 0x7f) ch = String.fromCharCode(c);
          else if (faceLow === "times new roman" && selFont.charset === 0) ch = TNR_ANSI_EVIDENCE[c]?.[0] ?? null; // byte >= 0x80: chỉ mã có bằng chứng, chỉ charset ANSI
          else ch = null; // font khác / charset khác / font mã hoá riêng (VNI…): mã >= 0x80 không có bằng chứng → thất bại, không đoán
          if (ch === null) return fail(`char:${selFont.face}:${c.toString(16)}`);
          s += ch === String.fromCharCode(32) ? String.fromCharCode(0xa0) : ch; // khoảng trắng thường → NBSP để không bị gộp và lệch chỉ số ký tự
        }
        // tách ký tự trống (mảnh) khỏi chữ thường: giữ vị trí từng ký tự
        const chars = [...s];
        let segStart = -1;
        const emit = (from: number, to: number) => {
          const sub = chars.slice(from, to).join("");
          if (!sub.replace(/[\u00a0\s]/g, "")) return;
          ops.push({ xs: xs.slice(from, to).map(v => x + v), y, text: sub, size: selFont!.size, italic: selFont!.italic, bold: selFont!.bold, under: selFont!.underline, strike: selFont!.strike, color: textColor, face: selFont!.face });
          baseCount.set(y, (baseCount.get(y) ?? 0) + (to - from));
          drewAnything = true;
        };
        if (chars.length !== n) return fail("char_count");
        for (let i = 0; i <= n; i++) {
          const gap = i === n || chars[i] === "\u0000";
          if (!gap && segStart < 0) segStart = i;
          if (gap && segStart >= 0) { emit(segStart, i); segStart = -1; }
        }
        if (align & 1) { cx = x + acc; cy = y; if (vt === 0) cy -= Math.round(selFont.size * 0.8); else if (vt === 8) cy += Math.round(selFont.size * 0.2); }
        break;
      }
      default:
        // Record lạ. Các record chỉ đổi trạng thái không vẽ mà MathType không dùng cũng bị từ chối: thà bỏ ảnh còn hơn đoán sai.
        return fail(`record:${fn.toString(16)}`);
    }
    p += sz;
    if (ended) break;
  }
  flushPath();
  if (!ended) return fail("no_eof");
  if (!drewAnything) return fail("empty");
  if (!haveExt || extX <= 0 || extY <= 0) { if (bb[2] - bb[0] > 0 && bb[3] - bb[1] > 0) { extX = bb[2] - bb[0]; extY = bb[3] - bb[1]; } else return fail("no_extent"); }
  if (!haveOrg) { orgX = bb[0]; orgY = bb[1]; }
  if (extX > 30000 || extY > 30000) return fail("extent");

  // ── mảnh ngoặc to → đường vẽ ──
  const frags = ops.filter((o): o is FragOp => typeof o !== "string" && "code" in o);
  const shapes = frags.length ? buildFragShapes(frags, orgY, orgY + extY) : [];
  for (const a of ops.filter((o): o is AccOp => typeof o !== "string" && "acc" in o)) shapes.push(accentShape(a, ops.filter((o): o is TextOp => typeof o !== "string" && "xs" in o)));

  // ── lắp SVG ──
  const pad = Math.round(Math.max(extX, extY) * 0.02);
  const vx = orgX - pad, vy = orgY - pad, vw = extX + 2 * pad, vh = extY + 2 * pad;
  // Cỡ thật (pt): ưu tiên khung placeable (đơn vị 1/inch); khung và toạ độ logic có thể khác đơn vị (vd. khung 119×41 @96dpi, toạ độ 2848×992).
  const bbW = bb[2] - bb[0], bbH = bb[3] - bb[1];
  const havePlace = inch > 0 && bbW > 0 && bbH > 0;
  const ptX = havePlace ? (bbW / inch * 72) / extX : inch > 0 ? 72 / inch : 0.75, ptY = havePlace ? (bbH / inch * 72) / extY : ptX;
  const widthPt = round1(vw * ptX), heightPt = round1(vh * ptY);
  if (!(widthPt > 0.5 && heightPt > 0.5 && widthPt < 2000 && heightPt < 2000)) return fail("size");
  let baseY = orgY + extY; let best = 0;
  for (const [y, c] of baseCount) if (c > best || (c === best && y > baseY)) { best = c; baseY = y; }
  const depthPt = round1(Math.max(0, vy + vh - baseY) * ptY);

  let body = "";
  for (const o of ops) {
    if (typeof o === "string") { body += o; continue; }
    if ("code" in o || "acc" in o) continue;
    // Mỗi ký tự một <tspan x=…>: đặt vị trí từng ký tự theo WMF, chạy đúng cả ở trình vẽ không hiểu danh sách x trên <text>.
    let attrs = ` y="${Math.round(o.y)}" font-size="${Math.round(o.size)}"`;
    if (o.face !== "Times New Roman" && o.face !== "Symbol" && o.face !== "Euclid Symbol" && o.face !== "MT Extra" && o.face !== "VNI-Times") attrs += ` font-family="${o.face},serif"`;
    if (o.italic) attrs += ` font-style="italic"`;
    if (o.bold) attrs += ` font-weight="bold"`;
    if (o.under || o.strike) attrs += ` text-decoration="${o.under ? "underline" : ""}${o.under && o.strike ? " " : ""}${o.strike ? "line-through" : ""}"`;
    const cs = [...o.text];
    let inner = "";
    for (let i = 0; i < cs.length; i++) inner += `<tspan x="${Math.round(o.xs[i])}">${esc(cs[i])}</tspan>`;
    body += `<text${attrs}${attrFill(o.color)}>${inner}</text>`;
  }
  for (const s of shapes) body += s;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPt}pt" height="${heightPt}pt" viewBox="${vx} ${vy} ${vw} ${vh}" font-family="${FAMILY_ROOT}" data-depth="${depthPt}">${body}</svg>`;
  if (new TextEncoder().encode(svg).length > FORMULA_SVG_MAX) return fail("svg_too_big");
  if (!validateFormulaSvg(svg)) return fail("svg_invalid");
  return { ok: true, svg, widthPt, heightPt, depthPt, notes };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// ── Dựng lại ngoặc / tích phân to từ mảnh Symbol ─────────────────────────────────────────────────
// Số đo theo hình dạng mảnh trong font Symbol (đơn vị = em): mảnh cao từ 0,926 trên đường cơ sở tới 0,293 dưới nó.
const ASC = 0.926, DESC = 0.293;
function buildFragShapes(frags: FragOp[], yMin: number, yMax: number): string[] {
  const used = new Set<FragOp>();
  const sorted = [...frags].sort((a, b) => a.x - b.x || a.y - b.y);
  const out: string[] = [];
  for (const top of sorted) {
    if (used.has(top) || top.f.pos !== "top") continue;
    const stack: FragOp[] = [top]; used.add(top);
    let last = top, closed = false, midSeen = false;
    for (;;) {
      const next = sorted.filter(f => !used.has(f) && Math.abs(f.x - top.x) <= 4 && f.y > last.y && f.f.fam === top.f.fam && (f.f.side === top.f.side || f.f.side === "?" || top.f.side === "?")).sort((p, q) => p.y - q.y)[0];
      if (!next) break;
      if (next.f.pos === "top") break;
      if (next.f.pos === "mid") { if (top.f.fam !== "brace" || midSeen) fail("frag_mid"); midSeen = true; }
      used.add(next); stack.push(next); last = next;
      if (next.f.pos === "bot") { closed = true; break; }
    }
    if (!closed) fail("frag_unclosed");
    if (top.f.fam === "brace" && !midSeen) fail("frag_brace_nomid");
    out.push(shapeFor(stack, yMin, yMax));
  }
  if (frags.some(f => !used.has(f))) fail("frag_orphan");
  return out;
}

function shapeFor(st: FragOp[], yMin: number, yMax: number): string {
  const top = st[0], bot = st[st.length - 1], s = top.size;
  const x = top.x;
  const yT = Math.max(yMin, Math.round(top.y - ASC * s)), yB = Math.min(yMax, Math.round(bot.y + DESC * s));
  if (yB - yT < s * 0.8) fail("frag_short");
  const sw = Math.max(8, Math.round(s * 0.055));
  const stroke = ` fill="none" stroke="#${top.color}" stroke-width="${sw}" stroke-linecap="butt"`;
  const R = top.f.side === "R";
  const r = (n: number) => Math.round(n);
  switch (top.f.fam) {
    case "paren": {
      const xe = R ? x + 0.05 * s : x + 0.34 * s, apex = R ? x + 0.30 * s : x + 0.09 * s;
      const xc = 2 * apex - xe;
      return `<path d="M${r(xe)} ${yT}Q${r(xc)} ${r((yT + yB) / 2)} ${r(xe)} ${yB}"${stroke}/>`;
    }
    case "bracket": {
      const xe = R ? x + 0.05 * s : x + 0.33 * s, xv = R ? x + 0.25 * s : x + 0.13 * s;
      return `<path d="M${r(xe)} ${yT + r(sw / 2)}H${r(xv)}V${yB - r(sw / 2)}H${r(xe)}"${stroke}/>`;
    }
    case "brace": {
      const mid = st.find(f => f.f.pos === "mid")!;
      const yM = r(mid.y - (ASC - DESC) / 2 * s);
      const xe = R ? x + 0.05 * s : x + 0.34 * s, xs = x + 0.20 * s, tip = R ? x + 0.34 * s : x + 0.05 * s;
      const q = 0.20 * s;
      return `<path d="M${r(xe)} ${yT}Q${r(xs)} ${yT} ${r(xs)} ${r(yT + q)}V${r(yM - q)}Q${r(xs)} ${yM} ${r(tip)} ${yM}Q${r(xs)} ${yM} ${r(xs)} ${r(yM + q)}V${r(yB - q)}Q${r(xs)} ${yB} ${r(xe)} ${yB}"${stroke}/>`;
    }
    default: { // tích phân ⌠⎮⌡
      const xv = x + 0.30 * s, h = 0.14 * s;
      return `<path d="M${r(xv + h * 1.6)} ${yT + r(sw)}Q${r(xv + h * 0.6)} ${yT} ${r(xv)} ${r(yT + h * 2)}V${r(yB - h * 2)}Q${r(xv)} ${yB} ${r(xv - h * 1.6)} ${yB - r(sw)}"${stroke}/>`;
    }
  }
}

/** Mũ/cung phủ chữ ngay dưới: chữ có đường cơ sở thấp hơn accent (y lớn hơn) và bắt đầu gần x của accent. */
function accentShape(a: AccOp, texts: TextOp[]): string {
  let best: TextOp | null = null, bestD = Infinity;
  for (const t of texts) {
    const ref = Math.max(a.size, t.size);
    if (t.y <= a.y || t.y - a.y > ref * 1.2) continue;
    const d = Math.abs(t.xs[0] - a.x);
    if (d < ref * 0.6 && d < bestD) { best = t; bestD = d; }
  }
  if (!best) return fail("accent_no_base");
  const cs = [...best.text];
  // Chữ bị phủ = dãy ký tự liền nhau từ đầu chuỗi tới chỗ hở đầu tiên (MathType gộp nhiều đoạn rời cùng một dòng vào một chuỗi, ngăn bằng khoảng dx lớn).
  const wOf = (ch: string) => (TW[ch] ?? 500) * best!.size / 1000;
  let k = 0;
  while (k < cs.length - 1 && best.xs[k + 1] - best.xs[k] <= wOf(cs[k]) * 1.35 + 0.1 * best.size) k++;
  const x0 = Math.min(a.x, best.xs[0]), x1 = best.xs[k] + wOf(cs[k]);
  if (!(x1 - x0 > a.size * 0.3)) return fail("accent_width");
  const top = best.y - 0.68 * best.size - 0.06 * a.size; // trên đỉnh chữ hoa một chút
  const sw = Math.max(8, Math.round(a.size * 0.04)), r = Math.round;
  const xm = (x0 + x1) / 2;
  const d = a.acc === "hat" ? `M${r(x0)} ${r(top)}L${r(xm)} ${r(top - 0.2 * a.size)}L${r(x1)} ${r(top)}` : `M${r(x0)} ${r(top)}Q${r(xm)} ${r(top - 0.42 * a.size)} ${r(x1)} ${r(top)}`;
  return `<path d="${d}" fill="none" stroke="#${a.color}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
}

/** CHỈ DÙNG TRONG CÔNG CỤ KIỂM / TEST (tools/local-e2e/mathtype-glyphs.ts, t-mathtype-img-lib.ts): các bảng ánh xạ glyph và số liệu bằng chứng. */
export const WMF_MAPS_FOR_TOOL = {
  symbolChar, MTEXTRA, EUCLID_EXTRA, SYMBOL_EVIDENCE, MTEXTRA_EVIDENCE, EUCLID_EXTRA_EVIDENCE, EUCLID_MATH_ONE_EVIDENCE, ACCENT_HAT_EVIDENCE, TNR_ANSI_EVIDENCE,
  /** Ký tự mà `convert` ánh xạ cho (font chữ thường, mã ≥ 0x80), hoặc null nếu bị từ chối. Chỉ Times New Roman charset ANSI. */
  textFaceChar: (face: string, c: number): string | null => (face.toLowerCase() === "times new roman" ? TNR_ANSI_EVIDENCE[c]?.[0] ?? null : null),
};
