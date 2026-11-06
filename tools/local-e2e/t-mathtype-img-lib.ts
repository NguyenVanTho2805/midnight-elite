// BU-03-MATHTYPE — ĐƯỜNG DỰ PHÒNG BẰNG ẢNH: ảnh xem trước WMF → SVG (wmfSvg.ts) → token `{{ctimg:…}}` (formulaImg.ts) → readDocx/parseAzotaBlocks.
// THUẦN: không DB, không mạng, không DATABASE_URL. Chạy: npx tsx tools/local-e2e/t-mathtype-img-lib.ts
// Mẫu thật: thư mục MATHTYPE_SAMPLES hoặc ~/Downloads (thiếu tệp → bỏ qua phần mẫu thật, KHÔNG đỏ).
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - wmfSvg.ts bỏ `words < 3 || p + sz > buf.length` → ca 'WMF cắt cụt' / 'record size 0' / 'record khổng lồ' đỏ (treo hoặc đọc ngoài biên);
//   - wmfSvg.ts bỏ `++nrec > maxRecords` → ca '10^5 record' đỏ (chậm / không thất bại); bỏ `default: return fail(record:…)` → ca 'record vẽ lạ (Ellipse)' đỏ;
//   - wmfSvg.ts bỏ kiểm `frag_orphan`/`frag_unclosed` → ca 'mảnh ngoặc mồ côi' đỏ;
//   - formulaImg.ts bỏ regex cấm `<script|onload|href…` hoặc bảng thẻ/thuộc tính cho phép → các ca 'token độc' đỏ; bỏ `visibleLength` trong quizQuestion.ts → ca 'token dài không bị từ chối' đỏ;
//   - formulaImg.ts clipVisible cắt giữa token → ca 'không cắt giữa token' đỏ;
//   - azotaDocxRead.ts bỏ đường `previewToken` → ca 'tắt bộ giải → 22 câu vẫn đọc được bằng ảnh' đỏ; cho ảnh lỗi trả token rỗng thay vì nhãn → ca 'ảnh cũng hỏng → nhãn + chặn' đỏ.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { wmfToSvg, WMF_LIMITS, WMF_MAPS_FOR_TOOL } from "@/lib/mathtype/wmfSvg";
import { FORMULA_IMG_RE, FORMULA_SVG_MAX, FORMULA_B64_MAX, FORMULA_MAX_TOKENS_PER_FIELD, FORMULA_MAX_BYTES_PER_FIELD, formulaFieldError, plainPreview, clipVisible, makeFormulaImgToken, sanitizeFormulaImgTokens, svgFromFormulaImgB64, validateFormulaSvg, visibleLength } from "@/lib/mathtype/formulaImg";
import { readDocx } from "@/lib/azotaDocxRead";
import { parseAzotaBlocks } from "@/lib/azotaDocx";
import { FORMULA_PLACEHOLDER } from "@/lib/ommlLatex";
import { validateQuizQuestion, validateForDraft, coerceQuestionInput, LIMITS, type QuizQuestionInput } from "@/lib/quizQuestion";

let pass = 0, failN = 0;
const check = (name: string, cond: unknown, extra?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { failN++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
};
const section = (t: string) => console.log(`\n▸ ${t}`);

// ── dựng WMF tự chế ─────────────────────────────────────────────────────────────────────────────
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; };
const i16 = (n: number) => { const b = Buffer.alloc(2); b.writeInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const rec = (fn: number, ...params: Buffer[]) => { const body = Buffer.concat(params); const pad = body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0); const bb = Buffer.concat([body, pad]); return Buffer.concat([u32((6 + bb.length) / 2), u16(fn), bb]); };
const cstr = (s: string) => { const b = Buffer.from(s + "\0", "latin1"); return b.length % 2 ? Buffer.concat([b, Buffer.alloc(1)]) : b; };
const R = {
  bkMode: () => rec(0x102, u16(1), u16(0)), textAlign: () => rec(0x12e, u16(0x19), u16(0)), textColor: (r = 0, g = 0, b = 0) => rec(0x209, Buffer.from([r, g, b, 2])),
  org: (x: number, y: number) => rec(0x20b, i16(y), i16(x)), ext: (w: number, h: number) => rec(0x20c, i16(h), i16(w)), moveTo: (x: number, y: number) => rec(0x214, i16(y), i16(x)), lineTo: (x: number, y: number) => rec(0x213, i16(y), i16(x)),
  font: (h: number, face = "Times New Roman", italic = false) => rec(0x2fb, i16(h), i16(0), i16(0), i16(0), i16(400), Buffer.from([italic ? 1 : 0, 0, 0, 0, 0, 0, 0, 0]), cstr(face)),
  fontCs: (h: number, face: string, charset: number) => rec(0x2fb, i16(h), i16(0), i16(0), i16(0), i16(400), Buffer.from([0, 0, 0, charset, 0, 0, 0, 0]), cstr(face)),
  pen: (w = 16) => rec(0x2fa, u16(0), i16(w), i16(0), Buffer.from([0, 0, 0, 2])), select: (i: number) => rec(0x12d, u16(i)), del: (i: number) => rec(0x1f0, u16(i)),
  text: (s: string, dx: number[]) => rec(0xa32, i16(0), i16(0), u16(s.length), u16(0), cstr(s), ...dx.map(i16)),
  poly: (pts: [number, number][]) => rec(0x324, i16(pts.length), ...pts.flatMap(([x, y]) => [i16(x), i16(y)])),
  escape: () => rec(0x626, u16(15), u16(4), Buffer.from("Math")),
};
function wmf(recs: Buffer[], o: { w?: number; h?: number; eof?: boolean; placeable?: boolean } = {}): Buffer {
  const w = o.w ?? 2000, h = o.h ?? 1000;
  const body = Buffer.concat([...recs, ...(o.eof === false ? [] : [rec(0)])]);
  const std = Buffer.concat([u16(1), u16(9), u16(0x300), u32((18 + body.length) / 2), u16(2), u32(20), u16(0)]);
  const head = o.placeable === false ? Buffer.alloc(0) : Buffer.concat([u32(0x9ac6cdd7), u16(0), i16(0), i16(0), i16(w), i16(h), u16(2304), u32(0), u16(0)]);
  return Buffer.concat([head, std, body]);
}
const GOOD = wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.textColor(), R.moveTo(100, 600), R.font(-400), R.select(0), R.text("x=1", [200, 200, 200])]);

(async () => {
  const t0 = Date.now();
  // ═════════════════════════════════════════════════════════════════════════════════════
  section("wmfSvg) WMF tối thiểu → SVG hợp lệ, đúng kích thước/vị trí");
  {
    const r = wmfToSvg(GOOD);
    check("WMF tự dựng 'x=1' → ok", r.ok, r);
    if (r.ok) {
      check("SVG qua validateFormulaSvg và nhỏ hơn trần", validateFormulaSvg(r.svg) && r.svg.length < FORMULA_SVG_MAX, r.svg.length);
      check("mỗi ký tự một <tspan x=…> đúng vị trí WMF (100, 300, 500)", /<tspan x="100">x<\/tspan><tspan x="300">=<\/tspan><tspan x="500">1<\/tspan>/.test(r.svg), r.svg);
      check("cỡ chữ lấy từ chiều cao font (400), baseline y=600", /y="600" font-size="400"/.test(r.svg), r.svg);
      check("viewBox bao toàn khung 2000×1000 (+đệm), kích thước pt = 2000/2304*72 = 62,5 (+đệm)", /viewBox="-\d+ -\d+ 20\d\d 10\d\d"/.test(r.svg) && r.widthPt > 62 && r.widthPt < 70, [r.svg.slice(0, 200), r.widthPt]);
      check("depthPt (dưới đường cơ sở) dương và nhỏ hơn chiều cao", r.depthPt > 0 && r.depthPt < r.heightPt, [r.depthPt, r.heightPt]);
      const col = wmfToSvg(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.textColor(255, 0, 0), R.moveTo(100, 600), R.font(-400), R.select(0), R.text("a", [200])]));
      check("màu từ SetTextColor → fill=\"#ff0000\"", col.ok && col.svg.includes('fill="#ff0000"'), col);
      const txt = (face: string, bytes: string, cs?: number) => wmfToSvg(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.textColor(), R.moveTo(100, 600), cs === undefined ? R.font(-400, face) : R.fontCs(-400, face, cs), R.select(0), R.text(bytes, [...bytes].map(() => 200))]));
      const sym = txt("Symbol", "pa\xb3\xa5");
      check("font Symbol → Unicode (π α ≥ ∞)", sym.ok && ["π", "α", "≥", "∞"].every(c => sym.svg.includes(`>${c}<`)), sym);
      // ── Đối chiếu kho mẫu thật (tools/local-e2e/mathtype-glyphs.ts, ~372.000 cặp WMF/OLE; chỉ ghi SỐ ĐẾM, không nội dung đề) ──
      const xe = txt("MT Extra", "\xa1\xa2\xa4\xa5");
      check("MT Extra: a1 → ℝ (2833/2834 luồng), a2 → ℤ (2141/2141), a4 → ℚ, a5 → ℕ — SỬA bản cũ đảo ℤ/ℝ", xe.ok && xe.svg.includes(">ℝℤℚℕ<") || (xe.ok && ["ℝ", "ℤ", "ℚ", "ℕ"].every(c => xe.svg.includes(c)) && xe.svg.indexOf("ℝ") < xe.svg.indexOf("ℤ")), xe);
      const eu = txt("Euclid Extra", "\xa1\xa2");
      check("Euclid Extra cùng bảng: a1 → ℝ (202/203), a2 → ℤ (191/192)", eu.ok && eu.svg.indexOf("ℝ") > 0 && eu.svg.indexOf("ℝ") < eu.svg.indexOf("ℤ"), eu);
      const phi = txt("Symbol", "fj");
      check("Symbol 0x66 → ϕ (U+03D5, 8/8) và 0x6a → φ (U+03C6, 488/488) — SỬA bản cũ đảo hai chữ phi", phi.ok && phi.svg.indexOf("\u03d5") > 0 && phi.svg.indexOf("\u03d5") < phi.svg.indexOf("\u03c6"), phi);
      check("TNR charset ANSI: 0xE0 → à (131/131), 0xF3 → ó (41/41), 0xA0 → NBSP", (() => { const r = txt("Times New Roman", "\xe0\xf3", 0); return r.ok && r.svg.includes("à") && r.svg.includes("ó"); })());
      const why = (r: ReturnType<typeof wmfToSvg>) => (r.ok ? "OK" : r.reason);
      check("PHÁ: TNR charset Hy Lạp (161) byte 0xC4 → thất bại (bản cũ vẽ Ä; MathType ghi Δ)", why(txt("Times New Roman", "\xc4", 161)) === "char:Times New Roman:c4");
      check("PHÁ: TNR charset Đông Âu (238) byte 0xF0 → thất bại (bản cũ vẽ ð; thật là π/đ tuỳ bảng mã)", why(txt("Times New Roman", "\xf0", 238)) === "char:Times New Roman:f0");
      check("PHÁ: TNR ANSI byte không có bằng chứng (0xE3 ã chỉ 1 luồng, 0xB0 ° 6/7, 0x88 ˆ 0/6) → thất bại", ["\xe3", "\xb0", "\x88"].every(b => why(txt("Times New Roman", b, 0)).startsWith("char:")));
      check("PHÁ: font Latin khác (Arial) byte ≥ 0x80 → thất bại (không có bằng chứng ngoài Times New Roman)", why(txt("Arial", "\xe0", 0)).startsWith("char:") && why(txt("Cambria Math", "\xb4", 0)).startsWith("char:"));
      check("PHÁ: Symbol 0xD6 (√ — không có ca khớp), 0xBE (0/249 luồng), 0x40 ≅ (3 ca), 0xA4 ⁄ (3 ca) → thất bại", ["\xd6", "\xbe", "@", "\xa4"].every(b => why(txt("Symbol", b)).startsWith("char:")));
      check("PHÁ: MT Extra 0xB6 (mũ rộng 21/31 = 68%) và Euclid Extra 0xBC (cung ⌢ chỉ 3 luồng) → thất bại, không vẽ đoán", why(txt("MT Extra", "\xb6")).startsWith("char:") && why(txt("Euclid Extra", "\xbc")).startsWith("char:"));
      check("PHÁ: VNI-Times 0xF1 (bản cũ đoán đ; MathType tự ghi ñ — 0/29 luồng) → thất bại", why(txt("VNI-Times", "\xf1", 0)).startsWith("char:"));
      check("Euclid Math One 0xD0 → ↷ (7/7), KHÔNG còn vẽ cung ⌢", (() => { const r = txt("Euclid Math One", "\xd0"); return r.ok && r.svg.includes("↷") && !r.svg.includes("<path"); })());
      check("MT Extra 0xB7 (mũ rộng 3774/3780) vẫn vẽ được (đặt trên chữ A)", (() => { const r = wmfToSvg(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.textColor(), R.moveTo(100, 600), R.font(-400), R.font(-400, "MT Extra"), R.select(0), R.text("A", [300]), R.moveTo(100, 300), R.select(1), R.text("\xb7", [300])])); return r.ok && /<path /.test(r.svg); })());
      const ev = WMF_MAPS_FOR_TOOL;
      const allEv = [...Object.values(ev.SYMBOL_EVIDENCE), ...Object.values(ev.MTEXTRA_EVIDENCE), ...Object.values(ev.EUCLID_EXTRA_EVIDENCE), ...Object.values(ev.EUCLID_MATH_ONE_EVIDENCE), ...Object.values(ev.ACCENT_HAT_EVIDENCE), ...Object.values(ev.TNR_ANSI_EVIDENCE)];
      check(`mọi ánh xạ glyph còn lại (${allEv.length}) có >= 5 luồng khớp và tỉ lệ >= 98% theo số liệu ghi kèm`, allEv.every(([, m, t]) => m >= 5 && m / t >= 0.98), allEv.filter(([, m, t]) => !(m >= 5 && m / t >= 0.98)));
      check("bảng đang dùng khớp bảng bằng chứng (ℝ ở a1, ℤ ở a2 cho cả MT Extra lẫn Euclid Extra)", ev.MTEXTRA[0xa1] === "ℝ" && ev.MTEXTRA[0xa2] === "ℤ" && ev.EUCLID_EXTRA[0xa1] === "ℝ" && ev.EUCLID_EXTRA[0xa2] === "ℤ");
      const lines = wmfToSvg(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.pen(16), R.select(0), R.moveTo(100, 500), R.lineTo(900, 500), R.lineTo(900, 700)]));
      check("MoveTo/LineTo → một <path> M…L…L…, bề dày nét 16", lines.ok && /<path d="M100 500L900 500L900 700"[^>]*stroke-width="16"/.test(lines.svg), lines);
      const poly = wmfToSvg(wmf([R.bkMode(), R.org(0, 0), R.ext(2000, 1000), R.pen(16), R.select(0), R.poly([[100, 100], [300, 100], [200, 300]])]));
      check("Polygon → <path …Z>", poly.ok && /<path d="M100 100L300 100L200 300Z"/.test(poly.svg), poly);
    }
    const bigParen = wmfToSvg(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1200), R.textColor(), R.font(-500, "Symbol"), R.select(0), R.moveTo(100, 400), R.text("\xe6", [300]), R.moveTo(100, 700), R.text("\xe7", [300]), R.moveTo(100, 1000), R.text("\xe8", [300]), R.moveTo(900, 400), R.text("\xf6", [300]), R.moveTo(900, 1000), R.text("\xf8", [300])]));
    check("ngoặc to ghép từ mảnh ⎛⎜⎝ + ⎞⎠ → VẼ bằng path (không còn chữ mảnh), 2 path", bigParen.ok && (bigParen.svg.match(/<path /g) ?? []).length === 2 && !bigParen.svg.includes("⎛"), bigParen);
    const orphan = wmfToSvg(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1200), R.textColor(), R.font(-500, "Symbol"), R.select(0), R.moveTo(100, 400), R.text("\xe6", [300])]));
    check("PHÁ: mảnh ngoặc mồ côi (chỉ có đầu, thiếu đáy) → thất bại, không vẽ đoán", !orphan.ok && /^frag_/.test((orphan as { reason: string }).reason), orphan);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════
  section("wmfSvg) PHÁ: tệp hỏng/độc không bao giờ ném, không treo, không vẽ đoán");
  {
    const never = (fn: () => unknown) => { try { fn(); return true; } catch { return false; } };
    const reason = (b: Buffer | Uint8Array) => { const r = wmfToSvg(b); return r.ok ? "OK" : r.reason; };
    check("rỗng / 3 byte / 39 byte → thất bại", reason(Buffer.alloc(0)) === "too_short" && reason(Buffer.from([1, 2, 3])) === "too_short" && reason(Buffer.alloc(39)) === "too_short");
    check("PHÁ: cắt cụt giữa record → thất bại (bad_record_size), không ném", reason(GOOD.subarray(0, GOOD.length - 9)) !== "OK" && never(() => wmfToSvg(GOOD.subarray(0, GOOD.length - 9))));
    check("PHÁ: cắt cụt MỌI độ dài 0..len → không lần nào ném", (() => { for (let i = 0; i < GOOD.length; i++) if (!never(() => wmfToSvg(GOOD.subarray(0, i)))) return false; return true; })());
    const cut = GOOD.subarray(0, GOOD.length - 6); // mất bản ghi EOF
    check("thiếu EOF → thất bại (no_eof)", reason(cut) === "no_eof", reason(cut));
    const sz0 = Buffer.from(GOOD); sz0.writeUInt32LE(0, 40);
    check("PHÁ: record size = 0 → thất bại, KHÔNG lặp vô hạn", reason(sz0) === "bad_record_size", reason(sz0));
    const huge = Buffer.from(GOOD); huge.writeUInt32LE(0x7fffffff, 40);
    check("PHÁ: record size khổng lồ (2^31 từ) → thất bại", reason(huge) === "bad_record_size", reason(huge));
    const huge2 = Buffer.from(GOOD); huge2.writeUInt32LE(0xffffffff, 40);
    check("PHÁ: record size 0xFFFFFFFF → thất bại", reason(huge2) === "bad_record_size", reason(huge2));
    const many = wmf(Array.from({ length: 100_000 }, () => R.bkMode()), {});
    const t1 = Date.now(); const rm = reason(many);
    check("PHÁ: 10^5 record → thất bại nhanh (too_big do > trần byte, hoặc too_many_records)", ["too_big", "too_many_records"].includes(rm) && Date.now() - t1 < 500, [rm, Date.now() - t1]);
    const manyS = wmf(Array.from({ length: WMF_LIMITS.maxRecords + 5 }, () => rec(0x102, u16(1))), {});
    check("PHÁ: vượt số record cho phép (nhưng dưới trần byte) → too_many_records", manyS.length < WMF_LIMITS.maxBytes && reason(manyS) === "too_many_records", [manyS.length, reason(manyS)]);
    const ell = wmf([R.bkMode(), R.org(0, 0), R.ext(2000, 1000), rec(0x418, i16(10), i16(10), i16(5), i16(5))]);
    check("PHÁ: record vẽ lạ (Ellipse 0x418) → thất bại, KHÔNG bỏ qua rồi đoán", reason(ell) === "record:418", reason(ell));
    check("PHÁ: record lạ không vẽ (SaveDC 0x1E) cũng thất bại — chỉ nhận 17 loại đã kiểm", reason(wmf([R.bkMode(), R.org(0, 0), R.ext(2000, 1000), rec(0x1e), R.moveTo(100, 600), R.font(-400), R.select(0), R.text("x", [200])])) === "record:1e");
    check("PHÁ: chữ nằm ngoài danh sách ký tự (Times 0x81 = ô trống cp1252) → thất bại", reason(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.moveTo(100, 600), R.font(-400), R.select(0), R.text("\x81", [200])])).startsWith("char:"));
    check("PHÁ: font mã hoá riêng VNI byte lạ → thất bại (không đoán chữ tiếng Việt)", reason(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.moveTo(100, 600), R.font(-400, "VNI-Times"), R.select(0), R.text("\xe4", [200])])).startsWith("char:VNI"));
    check("PHÁ: chữ xoay (escapement ≠ 0) → thất bại", reason(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.moveTo(100, 600), rec(0x2fb, i16(-400), i16(0), i16(900), i16(0), i16(400), Buffer.alloc(8), cstr("Times New Roman")), R.select(0), R.text("x", [200])])) === "rotated_font");
    check("PHÁ: ExtTextOut thiếu mảng dx (không biết bề rộng) → thất bại", reason(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.moveTo(100, 600), R.font(-400), R.select(0), rec(0xa32, i16(0), i16(0), u16(2), u16(0), cstr("ab").subarray(0, 2))])) === "no_dx");
    check("PHÁ: dx âm → thất bại", reason(wmf([R.bkMode(), R.textAlign(), R.org(0, 0), R.ext(2000, 1000), R.moveTo(100, 600), R.font(-400), R.select(0), R.text("ab", [-5, 200])])) === "bad_dx");
    check("PHÁ: chọn đối tượng chưa tạo → thất bại", reason(wmf([R.bkMode(), R.select(7)])) === "bad_object");
    check("PHÁ: khung rỗng/âm (ext 0) và không có placeable → thất bại", reason(wmf([R.bkMode(), R.textAlign(), R.moveTo(1, 1), R.font(-400), R.select(0), R.text("a", [200])], { placeable: false })) === "no_extent");
    check("PHÁ: không vẽ gì (chỉ đặt trạng thái) → thất bại 'empty', không ra ảnh trắng", reason(wmf([R.bkMode(), R.org(0, 0), R.ext(2000, 1000)])) === "empty");
    check("PHÁ: toạ độ cực lớn (ext 30001+) → thất bại", reason(wmf([R.bkMode(), R.org(0, 0), rec(0x20c, i16(1000), i16(32000)), R.moveTo(1, 1), R.font(-400), R.select(0), R.text("a", [200])])) === "extent");
    // fuzz: lật byte ngẫu nhiên trên WMF thật dựng + mẫu thật
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    let threw = 0, oks = 0, bad = 0;
    for (let i = 0; i < 4000; i++) {
      const b = Buffer.from(GOOD); for (let k = 0; k < 1 + (rnd() % 4); k++) b[rnd() % b.length] = rnd() & 255;
      try { const r = wmfToSvg(b); if (r.ok) { oks++; if (!validateFormulaSvg(r.svg)) bad++; } } catch { threw++; }
    }
    check(`fuzz 4000 lần lật byte: không lần nào ném; mọi kết quả ok đều là SVG hợp lệ (ok=${oks})`, threw === 0 && bad === 0, { threw, bad });
    let threw2 = 0;
    for (let i = 0; i < 1500; i++) { const b = Buffer.alloc(40 + (rnd() % 400)); for (let k = 0; k < b.length; k++) b[k] = rnd() & 255; if (!never(() => wmfToSvg(b))) threw2++; }
    check("fuzz 1500 chuỗi byte ngẫu nhiên hoàn toàn: không lần nào ném", threw2 === 0);
    const withMagic = Buffer.alloc(300); withMagic.writeUInt32LE(0x9ac6cdd7, 0); withMagic.writeUInt16LE(1, 22); withMagic.writeUInt16LE(9, 24);
    check("header đúng magic nhưng ruột rác → thất bại, không ném", never(() => wmfToSvg(withMagic)) && !wmfToSvg(withMagic).ok);
    check("đầu vào không phải Uint8Array (chuỗi/null) → thất bại, không ném", never(() => wmfToSvg("abc" as never)) && never(() => wmfToSvg(null as never)));
  }

  // ═════════════════════════════════════════════════════════════════════════════════════
  section("formulaImg) token ảnh: sinh, kiểm, làm sạch (token độc → nhãn)");
  {
    const okSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">a</tspan></text></svg>';
    const tok = makeFormulaImgToken(okSvg);
    check("SVG hợp lệ → token {{ctimg:base64}} khớp FORMULA_IMG_RE", !!tok && new RegExp(FORMULA_IMG_RE.source).test(tok) && /^\{\{ctimg:[A-Za-z0-9+/=]+\}\}$/.test(tok!), tok);
    check("token giải ngược ra đúng SVG ban đầu (khứ hồi)", (() => { const m = new RegExp(FORMULA_IMG_RE.source).exec(tok!); return !!m && svgFromFormulaImgB64(m[1]) === okSvg; })());
    check("chữ Unicode trong SVG (π, ℝ) khứ hồi đúng", (() => { const s = okSvg.replace(">a<", ">π ℝ<"); const t = makeFormulaImgToken(s)!; return svgFromFormulaImgB64(new RegExp(FORMULA_IMG_RE.source).exec(t)![1]) === s; })());
    const bads: [string, string][] = [
      ["<script>", okSvg.replace("<text", "<script>alert(1)</script><text")],
      ["onload", okSvg.replace("<svg ", '<svg onload="alert(1)" ')],
      ["onclick trên thẻ con", okSvg.replace("<text ", '<text onclick="x()" ')],
      ["href ngoài", okSvg.replace("<text", '<a href="https://evil"><text').replace("</text>", "</text></a>")],
      ["xlink:href", okSvg.replace("<text ", '<text xlink:href="javascript:alert(1)" ')],
      ["<foreignObject>", okSvg.replace("<text", "<foreignObject><div/></foreignObject><text")],
      ["<style> / CSS", okSvg.replace("<text", "<style>*{background:url(x)}</style><text")],
      ["url(…) trong thuộc tính", okSvg.replace('font-size="4"', 'fill="url(#a)"')],
      ["<image> ngoài", okSvg.replace("<text", '<image href="x"/><text')],
      ["thực thể lạ &xxe;", okSvg.replace(">a<", ">&xxe;<")],
      ["<!DOCTYPE>", '<!DOCTYPE svg [<!ENTITY a "b">]>' + okSvg],
      ["CDATA", okSvg.replace(">a<", "><![CDATA[x]]><")],
      ["không bắt đầu bằng <svg", " " + okSvg],
      ["không kết thúc bằng </svg>", okSvg + " "],
      ["thuộc tính lạ (style)", okSvg.replace("<text ", '<text style="x" ')],
      ["xmlns lạ", okSvg.replace("http://www.w3.org/2000/svg", "http://evil/")],
      ["hai thẻ gốc svg", okSvg.replace("</svg>", "<svg></svg></svg>")],
      ["thẻ không đóng", okSvg.replace("</text>", "")],
      ["quá cỡ", okSvg.replace(">a<", ">" + "a".repeat(FORMULA_SVG_MAX) + "<")],
      ["javascript:", okSvg.replace('font-size="4"', 'font-family="javascript:x"')],
      ["chữ có '>' thô", okSvg.replace(">a<", ">a>b<")],
    ];
    for (const [name, svg] of bads) check(`validateFormulaSvg TỪ CHỐI: ${name}`, !validateFormulaSvg(svg) && makeFormulaImgToken(svg) === null);
    // token độc đi qua đường lưu: tự tay đóng gói base64 (kẻ gian không cần makeFormulaImgToken)
    const forge = (svg: string) => `{{ctimg:${Buffer.from(svg).toString("base64")}}}`;
    for (const [name, svg] of bads.slice(0, 9)) {
      const out = sanitizeFormulaImgTokens(`Tính ${forge(svg)} rồi so`);
      check(`sanitize: token độc (${name}) → nhãn ⟦công thức⟧, chữ xung quanh còn`, out === `Tính ${FORMULA_PLACEHOLDER} rồi so`, out.slice(0, 80));
    }
    check("sanitize: base64 hỏng / ký tự lạ / rỗng → nhãn", sanitizeFormulaImgTokens("a {{ctimg:!!!}} b {{ctimg:}} c {{ctimg:PHN2Zw}} d") === `a ${FORMULA_PLACEHOLDER} b ${FORMULA_PLACEHOLDER} c ${FORMULA_PLACEHOLDER} d`);
    check("sanitize: token hợp lệ giữ NGUYÊN từng byte; chữ không token trả nguyên", sanitizeFormulaImgTokens(`a ${tok} b`) === `a ${tok} b` && sanitizeFormulaImgTokens("không có gì $x$") === "không có gì $x$");
    check("sanitize: token lồng token — mọi token còn lại trong kết quả đều là SVG hợp lệ", (() => { const o = sanitizeFormulaImgTokens(`{{ctimg:${tok}}}x{{ctimg:${forge(bads[0][1])}}}`); const m = o.match(/\{\{ctimg:[A-Za-z0-9+/=]+\}\}/g) ?? []; return m.length === 1 && m.every(t => svgFromFormulaImgB64(/\{\{ctimg:(.+)\}\}/.exec(t)![1]) !== null); })());
    // độ dài hiển thị & cắt
    const tokens = Array.from({ length: 5 }, () => tok!);
    const longText = "ab" + tokens.join("c");
    check("visibleLength: mỗi token đếm 1 ký tự", visibleLength(longText) === 2 + 5 + 4 && longText.length > 1000, [visibleLength(longText), longText.length]);
    const cutAt = (n: number) => clipVisible(longText, n);
    check("clipVisible: không bao giờ cắt giữa token (mọi n từ 0..15)", (() => { for (let n = 0; n <= 15; n++) { const c = cutAt(n); const opens = (c.match(/\{\{ctimg:/g) ?? []).length, whole = (c.match(/\{\{ctimg:[A-Za-z0-9+/=]+\}\}/g) ?? []).length; if (opens !== whole || visibleLength(c) > n) return false; } return true; })());
    check("clipVisible: chữ thường vẫn cắt đúng; không đổi khi chưa vượt", clipVisible("abcdef", 3) === "abc" && clipVisible("abc", 10) === "abc");
    // quizQuestion: token dài không bị từ chối vì độ dài
    const big = (n: number) => Array.from({ length: n }, () => tok!).join(" ");
    const q = (text: string, opt: string): QuizQuestionInput => ({ type: "MC", text, points: 1, imageUrl: null, explanation: null, options: [{ text: opt, isCorrect: true }, { text: "b", isCorrect: false }] } as QuizQuestionInput);
    check(`quizQuestion: đáp án có 12 token (${big(12).length} ký tự thô > ${LIMITS.option}) KHÔNG bị từ chối vì độ dài`, big(12).length > LIMITS.option && validateQuizQuestion(q("Câu?", big(12))) === null, validateQuizQuestion(q("Câu?", big(12))));
    check("quizQuestion: chữ thường vượt giới hạn VẪN bị từ chối (không nới cho chữ)", validateQuizQuestion(q("Câu?", "x".repeat(LIMITS.option + 1)))?.includes("tối đa") === true);
    check("quizQuestion: đề có 400 token vẫn bị từ chối khi vượt LIMITS.text tính theo ký tự hiển thị (token đếm 1)", validateQuizQuestion(q(big(400) + "y".repeat(LIMITS.text), "a")) !== null);
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  section("formulaImg) PHÁ giới hạn: token lỏng khổng lồ, nhồi hàng nghìn token, token sai danh sách trắng — mọi đường qua coerceQuestionInput");
  {
    const okSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">a</tspan></text></svg>';
    const tok = makeFormulaImgToken(okSvg)!;
    const forge = (svg: string) => `{{ctimg:${Buffer.from(svg).toString("base64")}}}`;
    const loose5 = "{{ctimg:" + "A".repeat(5 * 1024 * 1024) + "}}";
    check("visibleLength: token LỎNG 5 MB đếm đủ độ dài thật (trước đây đếm 1 ký tự)", visibleLength(loose5) === loose5.length);
    const justOver = "{{ctimg:" + "A".repeat(FORMULA_B64_MAX + 1) + "}}";
    check(`visibleLength: base64 dài ${FORMULA_B64_MAX + 1} (vượt trần ${FORMULA_B64_MAX}) đếm đủ độ dài; đúng trần vẫn đếm 1`, visibleLength(justOver) === justOver.length && visibleLength("{{ctimg:" + "A".repeat(FORMULA_B64_MAX) + "}}") === 1);
    check("visibleLength: token có ký tự ngoài danh sách base64 (khoảng trắng, !) đếm đủ độ dài", visibleLength("{{ctimg:A B}}") === 13 && visibleLength("{{ctimg:A!B}}") === 13);
    check("clipVisible: token lỏng khổng lồ bị cắt như chữ thường (không giữ nguyên 5 MB)", clipVisible(loose5, 100).length === 100);
    const t0 = Date.now();
    const s5 = sanitizeFormulaImgTokens("a " + loose5 + " b");
    check(`sanitize: token lỏng 5 MB → đúng một nhãn, chữ xung quanh còn, nhanh (${Date.now() - t0} ms < 1500)`, s5 === `a ${FORMULA_PLACEHOLDER} b` && Date.now() - t0 < 1500);
    const many = Array.from({ length: 10_000 }, () => tok).join("");
    const t1 = Date.now();
    const sMany = sanitizeFormulaImgTokens(many);
    const kept = (sMany.match(new RegExp(FORMULA_IMG_RE.source, "g")) ?? []).length;
    check(`sanitize: 10.000 token hợp lệ → chỉ giữ ${FORMULA_MAX_TOKENS_PER_FIELD}, phần dư thành nhãn (${Date.now() - t1} ms)`, kept === FORMULA_MAX_TOKENS_PER_FIELD && (sMany.match(/⟦công thức⟧/g) ?? []).length === 10_000 - FORMULA_MAX_TOKENS_PER_FIELD && Date.now() - t1 < 1500);
    check(`sanitize: đúng ${FORMULA_MAX_TOKENS_PER_FIELD} token giữ nguyên; ${FORMULA_MAX_TOKENS_PER_FIELD + 1} → token cuối thành nhãn`, sanitizeFormulaImgTokens(tok.repeat(FORMULA_MAX_TOKENS_PER_FIELD)) === tok.repeat(FORMULA_MAX_TOKENS_PER_FIELD) && sanitizeFormulaImgTokens(tok.repeat(FORMULA_MAX_TOKENS_PER_FIELD + 1)) === tok.repeat(FORMULA_MAX_TOKENS_PER_FIELD) + FORMULA_PLACEHOLDER);
    check("sanitize: 10.000 mở '{{ctimg:' không đóng → tuyến tính, không treo, giữ nguyên chữ", (() => { const x = "{{ctimg:".repeat(10_000); const t = Date.now(); const o = sanitizeFormulaImgTokens(x); return o === x && Date.now() - t < 1500; })());
    check("formulaFieldError: > 20 token → lỗi tiếng Việt; ≤ 20 → null; chữ không token → null", formulaFieldError(tok.repeat(21), "Nội dung")?.includes("quá nhiều ảnh công thức") === true && formulaFieldError(tok.repeat(20), "Nội dung") === null && formulaFieldError("x".repeat(500_000), "Nội dung") === null);
    check(`formulaFieldError: cỡ thật > ${FORMULA_MAX_BYTES_PER_FIELD / 1024} KB (20 token + chữ) → từ chối`, formulaFieldError("{{ctimg:" + "A".repeat(FORMULA_B64_MAX) + "}}" .repeat(1) + "y".repeat(FORMULA_MAX_BYTES_PER_FIELD), "Nội dung")?.includes("quá nặng") === true);
    check("plainPreview: token → '[ảnh công thức]', không lòi base64, không cắt giữa token", (() => { const t = "ab " + tok + " cd"; const o = plainPreview(t, 8); return !o.includes("ctimg") && !o.includes("PHN2Zy") && plainPreview(loose5, 30).length <= 31; })());

    // coerceQuestionInput = cổng DUY NHẤT: mọi trường chữ đều được làm sạch
    const evil = forge(okSvg.replace("<svg ", '<svg onload="alert(1)" '));
    const raw = { type: "MC", text: `Câu ${evil} ${loose5}`, points: 1, explanation: `giải ${evil}`, hint: `gợi ý ${evil}`, sectionLabel: `phần ${evil}`, options: [{ text: `A ${evil}`, isCorrect: true }, { text: `B ${loose5}`, isCorrect: false }] };
    const c = coerceQuestionInput(raw);
    const flat = "error" in c ? "" : JSON.stringify(c);
    check("coerceQuestionInput: token sai danh sách trắng + token lỏng 5 MB ở text/explanation/hint/sectionLabel/options → toàn nhãn, không còn 'ctimg'", !("error" in c) && !flat.includes("ctimg") && flat.length < 2000 && c.text.includes(FORMULA_PLACEHOLDER) && c.options.every(o => o.text.includes(FORMULA_PLACEHOLDER)), flat.slice(0, 200));
    const cEssay = coerceQuestionInput({ type: "ESSAY", text: "Tự luận", points: 4, studentGuide: evil, graderGuide: evil, rubric: [{ name: "Ý 1", requirement: "yêu cầu", points: 4 }], options: [] });
    check("coerceQuestionInput: studentGuide/graderGuide cũng được làm sạch (rubric ≤ 100/300 ký tự nên không thể chứa token hợp lệ)", !("error" in cEssay) && !JSON.stringify(cEssay).includes("ctimg"), JSON.stringify(cEssay).slice(0, 200));
    const cUrl = coerceQuestionInput({ type: "MC", text: "q", points: 1, imageUrl: `https://x.test/${tok}`, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] });
    check("coerceQuestionInput: imageUrl chứa { } (token) bị bỏ", !("error" in cUrl) && cUrl.imageUrl === null);
    // validate: nhồi token hợp lệ qua đường KHÔNG sanitize trước (ví dụ gọi thẳng validate) vẫn bị chặn
    const stuffed: QuizQuestionInput = { type: "MC", text: "Câu " + tok.repeat(21), points: 1, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] } as QuizQuestionInput;
    check("validateQuizQuestion / validateForDraft: > 20 token ở nội dung → từ chối bằng tiếng Việt", /ảnh công thức/.test(validateQuizQuestion(stuffed) ?? "") && /ảnh công thức/.test(validateForDraft(stuffed) ?? ""));
    const stuffedOpt: QuizQuestionInput = { ...stuffed, text: "Câu", options: [{ text: tok.repeat(21), isCorrect: true }, { text: "b", isCorrect: false }] } as QuizQuestionInput;
    check("validateQuizQuestion: 21 token ở MỘT đáp án → từ chối", /ảnh công thức/.test(validateQuizQuestion(stuffedOpt) ?? ""));
    const bigLoose: QuizQuestionInput = { ...stuffed, text: loose5, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] } as QuizQuestionInput;
    check("validateQuizQuestion: nội dung chỉ là token lỏng 5 MB → vượt giới hạn ký tự (không còn lọt)", validateQuizQuestion(bigLoose)?.includes("quá dài") === true && validateForDraft(bigLoose)?.includes("quá dài") === true);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════
  section("readDocx) đường dự phòng bằng docx tự dựng: bộ giải hỏng → ảnh WMF; ảnh cũng hỏng → nhãn + chặn");
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
  const RT_OLE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject", RT_IMG = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
  const rel = (id: string, target: string, type: string) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
  const OBJ = (olerid: string, imgrid: string) => `<w:r><w:object><v:shape><v:imagedata r:id="${imgrid}"/></v:shape><o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="x" r:id="${olerid}"/></w:object></w:r>`;
  const Rt = (t: string, u = false) => `<w:r>${u ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
  const Pp = (...x: string[]) => `<w:p>${x.join("")}</w:p>`;
  async function mkDocx(body: string, files: Record<string, Buffer | string>, rels: string): Promise<Buffer> {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
    zip.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + "</Relationships>");
    for (const [k, v] of Object.entries(files)) zip.file(k, v);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
  {
    const SEC = Pp(Rt("PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn."));
    const body = SEC + Pp(Rt("Câu 1. Tính "), OBJ("rId1", "rId2"), Rt(" bằng")) + Pp(Rt("A. "), OBJ("rId1", "rId2")) + Pp(Rt("B. 2")) + Pp(Rt("C. 3")) + Pp(Rt("D. 4", true))
      + Pp(Rt("Câu 2. Rút gọn "), OBJ("rId3", "rId4")) + Pp(Rt("A. a")) + Pp(Rt("B. b", true)) + Pp(Rt("C. c")) + Pp(Rt("D. d"));
    const rels = rel("rId1", "embeddings/oleObject1.bin", RT_OLE) + rel("rId2", "media/image1.wmf", RT_IMG) + rel("rId3", "embeddings/oleObject2.bin", RT_OLE) + rel("rId4", "media/image2.wmf", RT_IMG);
    const files = { "word/embeddings/oleObject1.bin": Buffer.from("không phải CFB"), "word/media/image1.wmf": GOOD, "word/embeddings/oleObject2.bin": Buffer.from("không phải CFB"), "word/media/image2.wmf": Buffer.from("WMF hỏng hoàn toàn, dài hơn bốn mươi byte để qua kiểm too_short") };
    const read = await readDocx(await mkDocx(body, files, rels));
    const runs = read.blocks.flatMap(b => (b.kind === "p" ? b.runs : [])).filter(r => r.formula === "ole");
    check("bộ giải hỏng + WMF tốt → run là token ảnh {{ctimg:…}}, formulaImage, KHÔNG nhãn", runs[0]?.formulaImage === true && new RegExp(FORMULA_IMG_RE.source).test(runs[0].text) && !runs[0].text.includes(FORMULA_PLACEHOLDER), runs[0]?.text.slice(0, 40));
    check("mathtypeFail giữ lý do giải (not_cfb) để đếm/ghi nhật ký", runs[0]?.mathtypeFail === "not_cfb");
    check("bộ giải hỏng + WMF hỏng → nhãn ⟦công thức⟧ (như cũ), không formulaImage", runs[2]?.text === FORMULA_PLACEHOLDER && !runs[2].formulaImage, runs[2]);
    const st = read.formulaStats;
    check("formulaStats.image = 2 (cùng một .bin dùng hai lần → 2 lần dùng), imageFailByReason ghi nhóm lý do ảnh hỏng", st.total === 3 && st.image === 2 && Object.keys(st.imageFailByReason).length === 1, st);
    const p = parseAzotaBlocks(read.blocks);
    const q1 = p.questions.find(q => q.number === 1)!, q2 = p.questions.find(q => q.number === 2)!;
    check("câu 1 (ảnh): cờ formula_image, KHÔNG formula_unread, cảnh báo formula_image", q1.flags.includes("formula_image") && !q1.flags.includes("formula_unread") && p.warnings.some(w => w.code === "formula_image" && w.question === q1.key), q1.flags);
    check("câu 1: token ảnh nằm ở chữ đề và ở phương án A, nguyên vẹn", /\{\{ctimg:[A-Za-z0-9+/=]+\}\}/.test(q1.text) && /^\{\{ctimg:[A-Za-z0-9+/=]+\}\}$/.test(q1.options[0].text), [q1.text.slice(0, 60), q1.options[0].text.slice(0, 40)]);
    check("câu 2 (ảnh hỏng): formula_unread (chặn phát hành), không formula_image", q2.flags.includes("formula_unread") && !q2.flags.includes("formula_image"), q2.flags);
    check("stats.withFormulaImage = 1, withFormulaUnread = 1", p.stats.withFormulaImage === 1 && p.stats.withFormulaUnread === 1, p.stats);
    check("câu 1 không có latexUnverified (bộ giải không đoán được gì)", q1.latexUnverified === undefined);
    // LaTeX đoán chưa kiểm đi kèm ảnh: dựng .bin giải được nhưng unverified → cần mathtype-fixtures; kiểm ở phần mẫu thật bên dưới.
  }

  // ═════════════════════════════════════════════════════════════════════════════════════
  section("Mẫu thật: 5 tệp Word (bỏ qua nếu thiếu)");
  const dirS = process.env.MATHTYPE_SAMPLES ?? path.join(os.homedir(), "Downloads");
  const SAMPLES: [string, number][] = [["De_Toan12_GK1_Azota.docx", 102], ["D. DUNG SAI - CH.docx", 106], ["F. BAI TAP NANG CAO - CH.docx", 81]];
  const EXTRA = ["B. TU LUAN - CH.docx", "C. TRAC NGHIEM - CH.docx"];
  const have = (f: string) => fs.existsSync(path.join(dirS, f));
  if (!SAMPLES.every(([f]) => have(f))) console.log(`  (SKIP) thiếu tệp mẫu trong ${dirS}`);
  else {
    let total = 0, drawn = 0, maxLen = 0, sum = 0; const failedWhy: Record<string, number> = {};
    for (const [f, nWmf] of SAMPLES) {
      const z = await JSZip.loadAsync(fs.readFileSync(path.join(dirS, f)));
      const names = Object.keys(z.files).filter(n => /^word\/media\/[^/]+\.wmf$/i.test(n));
      let ok = 0;
      for (const n of names) {
        total++;
        const r = wmfToSvg(await z.files[n].async("nodebuffer"));
        if (r.ok) { ok++; drawn++; const len = Buffer.byteLength(r.svg); maxLen = Math.max(maxLen, len); sum += len; if (!validateFormulaSvg(r.svg) || !makeFormulaImgToken(r.svg)) failedWhy["svg_invalid"] = (failedWhy["svg_invalid"] ?? 0) + 1; }
        else failedWhy[r.reason] = (failedWhy[r.reason] ?? 0) + 1;
      }
      check(`${f}: ${names.length} ảnh WMF (kỳ vọng ${nWmf}), vẽ được ${ok}/${names.length}`, names.length === nWmf && ok === names.length, failedWhy);
    }
    check(`3 tệp Toán: vẽ được ${drawn}/${total} ảnh xem trước (299 công thức dùng 289 ảnh)`, drawn === total && total === 289, failedWhy);
    check(`mỗi SVG ≤ ${FORMULA_SVG_MAX} byte (lớn nhất ${maxLen}, trung bình ${Math.round(sum / drawn)})`, maxLen <= FORMULA_SVG_MAX);
    console.log(`  → vẽ được ${drawn}/${total}; SVG lớn nhất ${maxLen} B, trung bình ${Math.round(sum / Math.max(1, drawn))} B`);
    for (const f of EXTRA.filter(have)) {
      const z = await JSZip.loadAsync(fs.readFileSync(path.join(dirS, f)));
      const names = Object.keys(z.files).filter(n => /^word\/media\/[^/]+\.wmf$/i.test(n));
      let ok = 0; const why: Record<string, number> = {};
      for (const n of names) { const r = wmfToSvg(await z.files[n].async("nodebuffer")); if (r.ok) ok++; else why[r.reason] = (why[r.reason] ?? 0) + 1; }
      console.log(`  → (thông tin) ${f}: vẽ được ${ok}/${names.length}; thất bại theo lý do: ${JSON.stringify(why)}`);
      // Các mã bị CỐ Ý từ chối sau đợt đối chiếu kho mẫu (không đủ bằng chứng): ảnh chứa chúng thất bại thay vì vẽ đoán.
      const DELIBERATE = new Set(["char:Times New Roman:f0", "char:MT Extra:b6", "char:VNI-Times:f1", "char:Euclid Extra:bc"]);
      check(`${f}: vẽ được ${ok}/${names.length} ảnh; mọi ảnh thất bại đều do mã CỐ Ý từ chối (thiếu bằng chứng), tối đa 6`, names.length - ok <= 6 && Object.keys(why).every(k => DELIBERATE.has(k)), why);
    }

    section("Mẫu thật: TẮT BỘ GIẢI (phá mọi .bin) → 22 câu vẫn đọc được, mọi công thức hiện bằng ảnh");
    {
      const good = fs.readFileSync(path.join(dirS, "De_Toan12_GK1_Azota.docx"));
      const zip = await JSZip.loadAsync(good);
      const bins = Object.keys(zip.files).filter(n => /^word\/embeddings\/oleObject\d+\.bin$/.test(n));
      for (const n of bins) zip.file(n, Buffer.from("TAT-BO-GIAI-" + n));
      const off = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const read = await readDocx(off);
      const p = parseAzotaBlocks(read.blocks);
      check("đọc được 22 câu (12 MC · 4 Đ/S · 6 trả lời ngắn)", p.questions.length === 22 && p.stats.byType.MC === 12 && p.stats.byType.TRUE_FALSE_CLUSTER === 4 && p.stats.byType.SHORT_ANSWER === 6, p.stats);
      check("107/107 công thức hiện bằng ảnh, 0 nhãn ⟦công thức⟧, 0 formula_unread", read.formulaStats.total === 107 && read.formulaStats.image === 107 && p.stats.withFormulaUnread === 0, [read.formulaStats.image, p.stats]);
      check("câu nào có công thức đều mang cờ formula_image; stats.withFormulaImage ≥ 20", p.stats.withFormulaImage! >= 20 && p.questions.filter(q => /\{\{ctimg:/.test(q.text + q.options.map(o => o.text).join(""))).every(q => q.flags.includes("formula_image")), p.stats);
      const allTok = p.questions.flatMap(q => [q.text, q.explanation, ...q.options.map(o => o.text)]).flatMap(t => t.match(/\{\{ctimg:[A-Za-z0-9+/=]+\}\}/g) ?? []);
      check(`mọi token (${allTok.length}) giải ngược thành SVG hợp lệ ≤ ${FORMULA_SVG_MAX} byte`, allTok.length > 100 && allTok.every(t => { const s = svgFromFormulaImgB64(/\{\{ctimg:(.+)\}\}/.exec(t)![1]); return !!s && Buffer.byteLength(s) <= FORMULA_SVG_MAX; }));
      check("mọi câu còn đáp án đúng như khi bộ giải bật (22/22)", p.stats.withAnswer === 22, p.stats);
      check("sanitize không làm đổi token thật nào (giữ nguyên từng byte)", allTok.every(t => sanitizeFormulaImgTokens(t) === t));
      // không nhãn trong chữ đề
      check("không câu nào còn ⟦công thức⟧", !p.questions.some(q => q.text.includes(FORMULA_PLACEHOLDER) || q.options.some(o => o.text.includes(FORMULA_PLACEHOLDER))));

      // ảnh cũng hỏng: phá cả .bin lẫn .wmf → nhãn + chặn như cũ
      const zip2 = await JSZip.loadAsync(off);
      for (const n of Object.keys(zip2.files).filter(n => /^word\/media\/.*\.wmf$/i.test(n))) zip2.file(n, Buffer.from("WMF-HONG-" + n + " ".repeat(60)));
      const off2 = await zip2.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const read2 = await readDocx(off2); const p2 = parseAzotaBlocks(read2.blocks);
      check("PHÁ: .bin VÀ .wmf đều hỏng → 107 nhãn, 0 ảnh, các câu có công thức mang formula_unread (chặn phát hành)", read2.formulaStats.image === 0 && p2.stats.withFormulaUnread! >= 20 && !p2.questions.some(q => q.flags.includes("formula_image")), [read2.formulaStats, p2.stats]);
      // cờ không bị gắn nhầm khi bộ giải còn bật
      const read3 = await readDocx(good); const p3 = parseAzotaBlocks(read3.blocks);
      check("ĐỐI CHỨNG: bộ giải bật → 0 ảnh, 0 formula_image (đường dự phòng không xen vào khi bộ giải chắc)", read3.formulaStats.image === 0 && p3.stats.withFormulaImage === 0 && p3.stats.withFormulaUnread === 0, [read3.formulaStats, p3.stats]);
    }

    if (have("C. TRAC NGHIEM - CH.docx") || have("B. TU LUAN - CH.docx")) {
      section("Mẫu thật: công thức bộ giải ĐOÁN nhưng chưa kiểm (unverified) → ảnh + LaTeX đoán đối chiếu");
      for (const f of EXTRA.filter(have)) {
        const read = await readDocx(fs.readFileSync(path.join(dirS, f)));
        const p = parseAzotaBlocks(read.blocks);
        const fs_ = read.formulaStats;
        console.log(`  → ${f}: công thức ${fs_.total}; ảnh ${fs_.image}; unverified ${fs_.unverified}; không giải được ${fs_.failed}; ảnh hỏng ${JSON.stringify(fs_.imageFailByReason)}; câu có ảnh ${p.stats.withFormulaImage}; câu còn nhãn ${p.stats.withFormulaUnread}`);
        const withGuess = p.questions.filter(q => q.latexUnverified && q.latexUnverified.length > 0);
        check(`${f}: câu có ảnh + LaTeX đoán: mỗi imgToken nằm đúng trong text/phương án và latex không rỗng`, withGuess.every(q => q.latexUnverified!.every(g => g.latex.length > 0 && [q.text, q.explanation, ...q.options.map(o => o.text)].some(t => t.includes(g.imgToken)))), withGuess.length);
        if (p.questions.length > 0) check(`${f}: đọc đủ câu, không lỗi nghiêm trọng khi có token ảnh`, p.fatal === null && p.errors.length === 0, [p.fatal, p.errors.slice(0, 2)]);
      }
    }
  }

  console.log(`\n${pass} pass / ${failN} fail  (${Date.now() - t0} ms)`);
  process.exit(failN ? 1 : 0);
})();
