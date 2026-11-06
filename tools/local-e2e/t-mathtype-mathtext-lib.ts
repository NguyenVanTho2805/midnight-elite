// BU-03-MATHTYPE — PHÍA HIỂN THỊ tự kiểm token ảnh công thức: MathText không render nguyên dữ liệu cũ/đường lưu lọt.
// THUẦN: không DB, không mạng. Chạy: npx tsx tools/local-e2e/t-mathtype-mathtext-lib.ts
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - MathText.tsx bỏ svgFromFormulaImgB64 (chỉ kiểm tiền tố PHN2Zy như bản cũ) → ca 'token SVG độc' đỏ (script lọt vào <img>);
//   - MathText.tsx quay về regex {1,12000} → ca 'token lỏng 5 MB / b64 > 8192' đỏ (base64 lòi ra chữ);
//   - MathText.tsx bỏ trần FORMULA_MAX_TOKENS_PER_FIELD → ca 'quá 20 token' đỏ.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MathText, renderMathText } from "@/components/MathText";
import { makeFormulaImgToken, FORMULA_MAX_TOKENS_PER_FIELD, FORMULA_IMG_RE, formulaImgRegex } from "@/lib/mathtype/formulaImg";
import { IMG_TOKEN_RE } from "@/components/tutor/de-thi/deThiClient";
import { check, section, done } from "./h";

const okSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">a</tspan></text></svg>';
const TOK = makeFormulaImgToken(okSvg)!;
const forge = (svg: string) => `{{ctimg:${Buffer.from(svg).toString("base64")}}}`;
const LABEL = "[công thức (ảnh lỗi)]";
const imgs = (h: string) => (h.match(/<img /g) ?? []).length;

(async () => {
  section("Token hợp lệ vẫn hiện thành <img> data URI");
  {
    const h = renderMathText(`x ${TOK} y`);
    check("1 <img src=data:image/svg+xml;base64,…>", imgs(h) === 1 && h.includes('src="data:image/svg+xml;base64,'), h.slice(0, 120));
    check("nền ảnh dùng token --kin-nen-anh-cong-thuc", h.includes("var(--kin-nen-anh-cong-thuc"));
  }

  section("Token độc / hỏng → nhãn, KHÔNG có <img> mang nội dung độc");
  {
    const evil = [
      okSvg.replace("<text", "<script>alert(1)</script><text"),
      okSvg.replace("<svg ", '<svg onload="alert(1)" '),
      okSvg.replace("<text", '<a href="https://evil"><text').replace("</text>", "</text></a>"),
      okSvg.replace("<text", "<foreignObject><div/></foreignObject><text"),
      okSvg.replace("<text", "<style>*{background:url(x)}</style><text"),
    ].map(forge);
    for (const [i, t] of evil.entries()) {
      const h = renderMathText(`a ${t} b`);
      check(`SVG độc #${i + 1} → nhãn, không <img>`, imgs(h) === 0 && h.includes(LABEL), h.slice(0, 160));
    }
    const prefixOnly = `{{ctimg:${Buffer.from("<svg><b>không hợp lệ</b></svg>").toString("base64")}}}`; // qua tiền tố PHN2Zy của bản cũ nhưng không qua danh sách trắng
    check("chỉ đúng tiền tố '<svg' nhưng sai danh sách trắng → nhãn", imgs(renderMathText(prefixOnly)) === 0 && renderMathText(prefixOnly).includes(LABEL));
    for (const [name, t] of [["javascript:", "{{ctimg:javascript:alert(1)}}"], ["data: thô", "{{ctimg:data:image/svg+xml;base64,PHN2Zz4=}}"], ["base64 sai độ dài", "{{ctimg:PHN2Zz}}"], ["rỗng", "{{ctimg:}}"]] as const) {
      const h = renderMathText(`a ${t} b`);
      check(`${name} → nhãn, không <img>, không lòi chuỗi token`, imgs(h) === 0 && h.includes(LABEL) && !h.includes("ctimg"), h.slice(0, 160));
    }
  }

  section("Token lỏng / quá dài");
  {
    const loose = "{{ctimg:" + "A".repeat(5 * 1024 * 1024) + "}}";
    const h = renderMathText(`đầu ${loose} cuối`);
    check("token lỏng 5 MB → nhãn, đầu ra ngắn, không lòi base64", imgs(h) === 0 && h.includes(LABEL) && h.length < 500, h.length);
    const big = forge(okSvg.replace("</svg>", `<text y="9">${"z".repeat(7000)}</text></svg>`)); // SVG > 6 KB → b64 > 8192
    const h2 = renderMathText(big);
    check("b64 > 8192 (SVG vượt trần 6 KB) → nhãn", imgs(h2) === 0 && h2.includes(LABEL), h2.length);
  }

  section("Trần số token mỗi trường");
  {
    const h = renderMathText(Array(FORMULA_MAX_TOKENS_PER_FIELD + 5).fill(TOK).join(" "));
    check(`${FORMULA_MAX_TOKENS_PER_FIELD + 5} token → ${FORMULA_MAX_TOKENS_PER_FIELD} <img> + 5 nhãn`, imgs(h) === FORMULA_MAX_TOKENS_PER_FIELD && (h.match(/\[công thức \(ảnh lỗi\)\]/g) ?? []).length === 5, [imgs(h)]);
  }

  section("Qua component thật (renderToStaticMarkup) + escape chữ thường");
  {
    const h = renderToStaticMarkup(createElement(MathText, { text: `<b>x</b> ${forge(okSvg.replace("<text", "<script>x</script><text"))} ${TOK}` }));
    check("HTML trong chữ vẫn bị escape; token độc → nhãn; token tốt → <img>", h.includes("&lt;b&gt;") && !h.includes("<script") && imgs(h) === 1 && h.includes(LABEL), h.slice(0, 200));
  }

  section("MỘT nguồn regex token");
  {
    check("deThiClient.IMG_TOKEN_RE chính là FORMULA_IMG_RE", IMG_TOKEN_RE === FORMULA_IMG_RE);
    check("trần b64 trong regex = 8192", FORMULA_IMG_RE.source.includes("{1,8192}") && formulaImgRegex().flags === "g");
    check("token b64 8193 ký tự không khớp regex chặt", !formulaImgRegex().test(`{{ctimg:${"A".repeat(8193)}}}`) && formulaImgRegex().test(`{{ctimg:${"A".repeat(8192)}}}`));
  }

  await done();
})();
