// SCL-D (Q3) — phần thuần src/lib/imagePdf.ts: gộp ảnh JPEG thành MỘT PDF không thư viện.
// Kiểm cấu trúc: đầu %PDF-, bảng xref trỏ ĐÚNG vị trí từng "n 0 obj", startxref trỏ đúng "xref", /Count = số ảnh, số trang /Type /Page, byte JPEG nằm nguyên trong luồng, kết thúc %%EOF;
// kích thước thu nhỏ (cạnh dài ≤ 2000, không phóng to); PHÁ CỐ Ý: không ảnh, ảnh không phải JPEG (PNG), kích thước 0, quá 30 ảnh ⇒ ném lỗi.
// Chạy: npx tsx tools/local-e2e/t-image-pdf-lib.ts (không cần máy chủ).
import { buildJpegPdf, fitWithin, MAX_IMAGE_PAGES, type JpegPage } from "@/lib/imagePdf";
import { check, section, done } from "./h";

const latin1 = (b: Uint8Array) => Array.from(b, c => String.fromCharCode(c)).join("");
// JPEG giả nhưng đúng dấu đầu/cuối (buildJpegPdf không giải mã ảnh, chỉ nhúng nguyên byte).
const fakeJpeg = (seed: number, len = 64) => { const a = new Uint8Array(len); a.set([0xff, 0xd8, 0xff, 0xe0]); for (let i = 4; i < len - 2; i++) a[i] = (i * seed) & 0xff; a[len - 2] = 0xff; a[len - 1] = 0xd9; return a; };

/** Đọc PDF như trình đọc thật: startxref → bảng xref → mỗi mục phải trỏ vào "<n> 0 obj". */
function inspect(pdf: Uint8Array) {
  const s = latin1(pdf);
  const sx = /startxref\n(\d+)\n%%EOF\n$/.exec(s);
  const xrefAt = sx ? Number(sx[1]) : -1;
  const xrefOk = xrefAt >= 0 && s.startsWith("xref\n", xrefAt);
  const head = xrefOk ? /^xref\n0 (\d+)\n/.exec(s.slice(xrefAt)) : null;
  const n = head ? Number(head[1]) : 0;
  const rows = xrefOk ? s.slice(xrefAt + head![0].length).split("\n").slice(0, n) : [];
  const offsetsOk = rows.length === n && rows[0] === "0000000000 65535 f " && rows.slice(1).every((r, i) => {
    const m = /^(\d{10}) 00000 n $/.exec(r);
    return !!m && s.startsWith(`${i + 1} 0 obj\n`, Number(m[1]));
  });
  const size = /\/Size (\d+)/.exec(s);
  return {
    s, xrefOk, offsetsOk, objCount: n,
    sizeOk: !!size && Number(size[1]) === n,
    count: Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(s)?.[1] ?? -1),
    pages: (s.match(/\/Type \/Page /g) ?? []).length,
    images: (s.match(/\/Subtype \/Image/g) ?? []).length,
  };
}

section("Ba ảnh ⇒ một PDF ba trang, xref đúng");
const pages: JpegPage[] = [{ jpeg: fakeJpeg(3), width: 2000, height: 1500 }, { jpeg: fakeJpeg(5, 80), width: 1125, height: 2000 }, { jpeg: fakeJpeg(7), width: 800, height: 800 }];
const pdf = buildJpegPdf(pages);
const r = inspect(pdf);
check("bắt đầu bằng %PDF-1.4 và dòng nhị phân", r.s.startsWith("%PDF-1.4\n%") && pdf[10] > 127);
check("kết thúc bằng %%EOF, startxref trỏ đúng chữ 'xref'", r.s.endsWith("%%EOF\n") && r.xrefOk);
check("mỗi mục xref trỏ đúng vị trí byte của đối tượng", r.offsetsOk, r.s.slice(-400));
check("số đối tượng = 2 + 3 × số ảnh, /Size khớp bảng xref", r.objCount === 1 + 2 + 3 * pages.length && r.sizeOk, r.objCount);
check("/Count = 3 và đúng 3 trang /Type /Page, 3 ảnh", r.count === 3 && r.pages === 3 && r.images === 3, r);
check("ảnh nhúng bằng /DCTDecode, /Length đúng số byte JPEG", (r.s.match(/\/DCTDecode \/Length 64 /g) ?? []).length === 2 && r.s.includes("/DCTDecode /Length 80 "));
check("byte JPEG nằm NGUYÊN trong tệp (không giải mã / nén lại)", pages.every(p => r.s.includes(latin1(p.jpeg))));
check("trang rộng A4 (595.28pt), cao theo tỉ lệ ảnh", r.s.includes("/MediaBox [0 0 595.28 446.46]") && r.s.includes("/MediaBox [0 0 595.28 1058.28]") && r.s.includes("/MediaBox [0 0 595.28 595.28]"));
const one = inspect(buildJpegPdf([pages[0]]));
check("một ảnh ⇒ /Count 1, xref vẫn đúng", one.count === 1 && one.pages === 1 && one.offsetsOk && one.xrefOk);

section("Thu nhỏ ảnh: cạnh dài ≤ 2000, không phóng to");
const a = fitWithin(4032, 3024), b = fitWithin(3024, 4032), c = fitWithin(800, 600);
check("4032×3024 ⇒ 2000×1500", a.width === 2000 && a.height === 1500, a);
check("3024×4032 (ảnh dọc) ⇒ 1500×2000", b.width === 1500 && b.height === 2000, b);
check("800×600 giữ nguyên", c.width === 800 && c.height === 600, c);
check("cạnh dài 1600 khi nén thêm nấc", Math.max(...Object.values(fitWithin(4000, 3000, 1600))) === 1600);

section("PHÁ CỐ Ý — dữ liệu xấu bị từ chối");
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
check("không có ảnh ⇒ lỗi", throws(() => buildJpegPdf([])));
check("byte PNG giả làm JPEG ⇒ lỗi", throws(() => buildJpegPdf([{ jpeg: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), width: 10, height: 10 }])));
check("kích thước 0 hoặc lẻ ⇒ lỗi", throws(() => buildJpegPdf([{ jpeg: fakeJpeg(1), width: 0, height: 10 }])) && throws(() => buildJpegPdf([{ jpeg: fakeJpeg(1), width: 10.5, height: 10 }])));
check(`quá ${MAX_IMAGE_PAGES} ảnh ⇒ lỗi`, throws(() => buildJpegPdf(Array.from({ length: MAX_IMAGE_PAGES + 1 }, () => pages[2]))));

done();
