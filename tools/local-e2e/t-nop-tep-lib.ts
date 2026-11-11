// BU-HS-NOP-TEP — kiểm phần THUẦN (không DB, không mạng, không máy chủ): cấu hình, đuôi/MIME/dung lượng, làm sạch tên, đọc nội dung docx/pdf (có ca phá cố ý),
// hạn 60 ngày, câu where của cron khớp hàm thuần, dạng JSON trả ra API, bảng quyền xem/tải, quét tĩnh mã các route.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-nop-tep-lib.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import {
  NOP_TEP_MAX_BYTES, NOP_TEP_MAX_FILES, NOP_TEP_PENDING_TTL_HOURS, NOP_TEP_RETENTION_DAYS, canViewNopTepFile, describeNopTepFile, isNopTepAbandoned, isNopTepExpired, isNopTepId, isNopTepRemovedLeftover,
  nopTepAbandonedWhere, nopTepConfig, nopTepExpiredWhere, nopTepExpiresAt, nopTepExt, nopTepRemovedLeftoverWhere, nopTepResultMessage, nopTepSafeName, nopTepStoredName, validateNopTepRequest,
  type NopTepViewCtx,
} from "@/lib/nopTep";
import { inspectDocx, inspectNopTepContent, inspectPdf } from "@/lib/nopTepInspect";
import { EXE_BYTES, HTML_BYTES, JPEG_BYTES, PNG_BYTES, buildZip, plainZip, validDocx, validPdf, validXlsx } from "./nop-tep-fx";
import { check, section, done } from "./h";

const MiB = 1024 * 1024;
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

section("nopTepConfig: bật/tắt theo biến môi trường");
const CL = { CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" };
const c1 = nopTepConfig({ NODE_ENV: "production", ...CL });
check("production đủ 3 biến ⇒ cloudinary, bật, 60 ngày, 3 tệp, <10 MiB, docx+pdf", c1.enabled && c1.driver === "cloudinary" && c1.reason === null && c1.retentionDays === 60 && c1.maxFiles === 3 && c1.maxBytes === 10 * MiB && c1.exts.join() === "docx,pdf", c1);
for (const miss of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
  const e: Record<string, string> = { NODE_ENV: "production", ...CL }; delete e[miss];
  const c = nopTepConfig(e);
  check(`production thiếu ${miss} ⇒ TẮT + reason tiếng Việt, driver none`, !c.enabled && c.driver === "none" && /chưa bật/.test(c.reason ?? ""), c);
}
const cPub = nopTepConfig({ NODE_ENV: "production", NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "c", NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "p" });
check("production chỉ có NEXT_PUBLIC_CLOUDINARY_* (preset không ký) ⇒ TẮT, không rơi về đường công khai", !cPub.enabled && cPub.driver === "none", cPub);
check("máy dev không biến ⇒ local, bật", (() => { const c = nopTepConfig({ NODE_ENV: "development" }); return c.enabled && c.driver === "local"; })());
check("dev có đủ khoá ⇒ dùng cloudinary", nopTepConfig({ NODE_ENV: "development", ...CL }).driver === "cloudinary");
check("KIN_NOP_TEP=0 ⇒ tắt dù đủ khoá (công tắc khẩn cấp)", !nopTepConfig({ NODE_ENV: "production", KIN_NOP_TEP: "0", ...CL }).enabled && !nopTepConfig({ KIN_NOP_TEP: "off" }).enabled);

section("validateNopTepRequest: đuôi, loại bị chặn, MIME, dung lượng");
const v = (name: unknown, size: unknown = 1000, type?: unknown) => validateNopTepRequest({ name, size, type });
check(".docx và .pdf ok; .DOCX ok", [v("a.docx"), v("b.pdf", 5, "application/pdf"), v("C.DOCX"), v("d.PdF")].every(r => r.ok), [v("a.docx"), v("C.DOCX")]);
check("kết quả ok mang đuôi chuẩn hoá", (() => { const r = v("C.DOCX"); return r.ok && r.ext === "docx"; })());
const code = (r: ReturnType<typeof v>) => (r.ok ? "ok" : r.code);
check("a.docx.exe ⇒ chặn (đuôi cuối là exe)", code(v("a.docx.exe")) === "blocked_exec");
check("ảnh png/jpg/jpeg/heic/svg/gif/webp ⇒ blocked_image", ["a.png", "a.jpg", "a.JPEG", "a.heic", "a.svg", "a.gif", "a.webp"].every(n => code(v(n)) === "blocked_image"));
check("video mp4/mov/webm ⇒ blocked_video", ["a.mp4", "a.mov", "a.webm"].every(n => code(v(n)) === "blocked_video"));
check("macro docm/dotm/xlsm/pptm ⇒ blocked_macro_ext", ["a.docm", "a.dotm", "a.xlsm", "a.pptm"].every(n => code(v(n)) === "blocked_macro_ext"));
check("thực thi/mã lệnh exe/bat/js/sh/ps1/jar ⇒ blocked_exec", ["a.exe", "a.bat", "a.js", "a.sh", "a.ps1", "a.jar", "a.html"].every(n => code(v(n)) === "blocked_exec"));
check("zip/rar/7z/gz/tar ⇒ blocked_archive (nén nhiều tệp không nhận)", ["a.zip", "a.rar", "a.7z", "a.gz", "a.tar"].every(n => code(v(n)) === "blocked_archive"));
check(".doc ⇒ bad_ext và gợi ý lưu lại thành .docx", (() => { const r = v("a.doc"); return !r.ok && r.code === "bad_ext" && /\.docx/.test(r.error); })());
check("không đuôi / .txt / đuôi lạ / đuôi có ký tự điều khiển ⇒ bad_ext", ["a", "a.txt", "a.xyz", "a.docx\u0000", "a.docx\u202e"].every(n => code(v(n)) === "bad_ext"), ["a", "a.txt", "a.xyz", "a.docx\u0000", "a.docx\u202e"].map(n => code(v(n))));
check("tên không phải chuỗi (null/số/undefined) ⇒ bad_ext, không ném lỗi", [null, 5, undefined, {}].every(n => code(v(n)) === "bad_ext"));
check("MIME khai image/png với đuôi .docx ⇒ bad_mime; text/html ⇒ bad_mime; docx với MIME pdf ⇒ bad_mime", code(v("a.docx", 100, "image/png")) === "bad_mime" && code(v("a.docx", 100, "text/html")) === "bad_mime" && code(v("a.docx", 100, "application/pdf")) === "bad_mime");
check("MIME trống / application/octet-stream / MIME đúng có tham số ⇒ không báo (nội dung thật quyết)", code(v("a.docx", 100, "")) === "ok" && code(v("a.docx", 100, "application/octet-stream")) === "ok" && code(v("a.pdf", 100, "application/pdf; charset=binary")) === "ok" && code(v("a.docx", 100, undefined)) === "ok");
check("kích thước 0 ⇒ empty", code(v("a.docx", 0)) === "empty");
check("10 MiB − 1 ⇒ nhận", code(v("a.docx", 10 * MiB - 1)) === "ok");
check("10 MiB ⇒ từ chối (dưới 10 MB)", code(v("a.docx", 10 * MiB)) === "too_big");
check("10 MiB + 1 ⇒ từ chối", code(v("a.docx", 10 * MiB + 1)) === "too_big");
check("NaN / âm / Infinity / chuỗi / null ⇒ từ chối", [NaN, -1, Infinity, "5", null].every(s => !v("a.docx", s).ok), [NaN, -1, Infinity, "5", null].map(s => code(v("a.docx", s))));
check("NOP_TEP_MAX_BYTES là đúng 10 MiB; hạn 60 ngày; 3 tệp; tải dở 24 giờ", NOP_TEP_MAX_BYTES === 10 * MiB && NOP_TEP_RETENTION_DAYS === 60 && NOP_TEP_MAX_FILES === 3 && NOP_TEP_PENDING_TTL_HOURS === 24);
check("thông điệp lỗi KHÔNG lặp lại tên tệp", ["Nguyen Van A - Toan.png", "Nguyen Van A.exe", "Nguyen Van A.doc", "Nguyen Van A.zip"].every(n => { const r = v(n); return !r.ok && !r.error.includes("Nguyen") && !r.error.includes("Toan"); }));

section("Tên tệp: làm sạch (nopTepSafeName / nopTepExt / nopTepStoredName)");
const names: [string, unknown][] = [
  ["../../etc/passwd.docx", "../../etc/passwd.docx"], ["C:\\x\\y.docx", "C:\\x\\y.docx"], ["bidi", "a\u202Efdp.docx"], ["400 ký tự", "x".repeat(400) + ".docx"],
  ["rỗng", ""], ["chỉ dấu chấm", "..."], ["một dấu chấm", "."], ["điều khiển", "a\u0000b\n\t.docx"], ["emoji", "😀 bài.docx"], ["%2f", "..%2fx.docx"], ["NUL giữa", "ab\u0000.pdf"], ["null", null],
  ["tiếng Việt", "Bài làm Toán - Nguyễn Văn Á.docx"], ["bắt đầu bằng chấm", ".bashrc.docx"], ["400 ký tự Việt", "ệ".repeat(400) + ".pdf"],
];
for (const [label, n] of names) {
  const s = nopTepSafeName(n);
  check(`"${label}" ⇒ không có / hay \\, không bắt đầu bằng ., ≤120 ký tự, không rỗng`, !s.includes("/") && !s.includes("\\") && !s.startsWith(".") && s.length >= 1 && Array.from(s).length <= 120 && !/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(s), s);
}
check("../../etc/passwd.docx ⇒ passwd.docx; C:\\x\\y.docx ⇒ y.docx", nopTepSafeName("../../etc/passwd.docx") === "passwd.docx" && nopTepSafeName("C:\\x\\y.docx") === "y.docx");
check("ký tự đổi chiều U+202E bị bỏ (afdp.docx), không còn ký tự điều khiển hướng", nopTepSafeName("a\u202Efdp.docx") === "afdp.docx");
check("tên 400 ký tự: CẮT PHẦN TÊN, GIỮ ĐUÔI (.docx), đúng 120", (() => { const s = nopTepSafeName("x".repeat(400) + ".docx"); return s.endsWith(".docx") && s.length === 120; })() && nopTepSafeName("ệ".repeat(400) + ".pdf").endsWith(".pdf"));
check("rỗng / chỉ dấu chấm / null ⇒ 'tep'", nopTepSafeName("") === "tep" && nopTepSafeName("...") === "tep" && nopTepSafeName(null) === "tep" && nopTepSafeName(".") === "tep");
check("tiếng Việt có dấu giữ nguyên (NFC)", nopTepSafeName("Bài làm Toán - Nguyễn Văn Á.docx") === "Bài làm Toán - Nguyễn Văn Á.docx" && nopTepSafeName("Ba\u0300i.docx") === "Bài.docx");
check("emoji ⇒ '_' (một ký tự mỗi emoji)", nopTepSafeName("😀.docx") === "_.docx");
check("nopTepExt: lấy đuôi cuối, thường hoá, rỗng khi không hợp lệ", nopTepExt("a.docx.exe") === "exe" && nopTepExt("A.PDF") === "pdf" && nopTepExt("a") === "" && nopTepExt("a.docx ") === "docx" && nopTepExt("a.d\u0000ocx") === "" && nopTepExt(null) === "");
check("nopTepStoredName luôn kết thúc bằng .ext do bảng quyết", nopTepStoredName("abc", "pdf") === "abc.pdf" && nopTepStoredName("abc.docx", "docx") === "abc.docx" && nopTepStoredName("a.exe", "pdf") === "a.pdf" && nopTepExt(nopTepStoredName("..", "docx")) === "docx");

section("inspectDocx: tệp dựng tay (mảng byte) và CA PHÁ CỐ Ý");
const ok = (r: { ok: boolean }) => r.ok;
const codeOf = (r: ReturnType<typeof inspectDocx>) => (r.ok ? "ok" : r.code);
check("docx hợp lệ ([Content_Types].xml + word/document.xml) ⇒ ok", ok(inspectDocx(validDocx())));
check("docx hợp lệ có ảnh nhúng word/media/ ⇒ vẫn ok (chỉ cảnh báo bằng chữ, Q3)", ok(inspectDocx(validDocx({ extra: [{ name: "word/media/image1.png", data: PNG_BYTES }] }))));
check("docx lưu nguyên (method 0) vẫn đọc được", ok(inspectDocx(buildZip([{ name: "[Content_Types].xml", data: "<Types/>", method: 0 }, { name: "word/document.xml", data: "<d/>", method: 0 }]))));
check("xlsx đổi tên .docx ⇒ TỪ CHỐI (thiếu word/document.xml)", codeOf(inspectDocx(validXlsx())) === "bad_content");
check("zip thường đổi tên .docx ⇒ từ chối", codeOf(inspectDocx(plainZip())) === "bad_content");
check("docx có word/vbaProject.bin ⇒ từ chối (macro)", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/vbaProject.bin", data: "MZ" }] }))) === "blocked_macro");
check("mọi tên *vbaProject* (hoa thường) ⇒ từ chối", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/VBAproject.BIN", data: "x" }] }))) === "blocked_macro" && codeOf(inspectDocx(validDocx({ extra: [{ name: "x/y/vbaProject.zz", data: "x" }] }))) === "blocked_macro");
check("[Content_Types].xml có macroEnabled ⇒ từ chối", codeOf(inspectDocx(validDocx({ mainType: "application/vnd.ms-word.document.macroEnabled.main+xml" }))) === "blocked_macro");
check("có word/embeddings/ ⇒ từ chối", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/embeddings/oleObject1.bin", data: "x" }] }))) === "blocked_macro");
check("có word/activeX/ ⇒ từ chối", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/activeX/activeX1.xml", data: "x" }] }))) === "blocked_macro");
check("tên mục ../evil.xml / /abs / ổ đĩa / a\\..\\b (zip-slip) ⇒ từ chối", ["../evil.xml", "/etc/x", "C:\\x.xml", "a\\..\\b.xml", "word/../../x.xml"].every(n => codeOf(inspectDocx(validDocx({ extra: [{ name: n, data: "x" }] }))) === "bad_content"));
check("tên mục có ký tự điều khiển ⇒ từ chối", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/a\u0001b.xml", data: "x" }] }))) === "bad_content");
check("mục bị MÃ HOÁ (cờ bit 0) ⇒ từ chối", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/secret.xml", data: "x", flags: 1 }] }))) === "bad_content");
check("tên mục trùng nhau ⇒ từ chối", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/document.xml", data: "y" }] }))) === "bad_content");
// zip bomb: khai 1 GiB giải nén, tỉ số 10 000 ⇒ từ chối bằng thư mục trung tâm, KHÔNG giải nén (dữ liệu mục là rác nên nếu có giải nén sẽ ra bad_content chứ không phải bomb).
check("zip bomb (khai 1 GiB giải nén, nén 100 KB, tỉ số ~10 000) ⇒ 'bomb', không giải nén", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/big.xml", data: "x", declUncomp: 1024 * MiB, declComp: 100_000 }] }))) === "bomb");
check("mục 60 MiB khai (> 50 MiB/mục) ⇒ bomb", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/big.xml", data: "x", declUncomp: 60 * MiB, declComp: 60 * MiB }] }))) === "bomb");
check("ba mục 40 MiB khai (tổng 120 MiB > 100 MiB) ⇒ bomb", codeOf(inspectDocx(validDocx({ extra: [1, 2, 3].map(i => ({ name: `word/p${i}.xml`, data: "x", declUncomp: 40 * MiB, declComp: 40 * MiB })) }))) === "bomb");
check("mục 1 MiB khai nén còn 100 byte (tỉ số 10 485 > 200) ⇒ bomb", codeOf(inspectDocx(validDocx({ extra: [{ name: "word/z.xml", data: "x", declUncomp: MiB, declComp: 100 }] }))) === "bomb");
check("mục nhỏ nén tốt (3 KB → 15 byte, tỉ số 200+) KHÔNG bị coi là bomb (không phạt oan XML Word lặp)", ok(inspectDocx(validDocx({ extra: [{ name: "word/lap.xml", data: "a".repeat(3000) }] }))));
check("5.000 mục ⇒ từ chối (quá 2.000 mục), không ném lỗi", codeOf(inspectDocx(buildZip(Array.from({ length: 5000 }, (_, i) => ({ name: `word/f${i}.xml`, data: "", method: 0 as const }))))) === "bomb");
check("[Content_Types].xml thật là bomb deflate (10 MiB số 0, khai trung thực) ⇒ từ chối", !ok(inspectDocx(buildZip([{ name: "[Content_Types].xml", data: Buffer.alloc(10 * MiB) }, { name: "word/document.xml", data: "<d/>" }]))));
check("[Content_Types].xml KHAI nhỏ nhưng giải nén ra 10 MiB (nói dối) ⇒ từ chối, không ném lỗi, không nạp 10 MiB", (() => {
  const real = deflateRawSync(Buffer.alloc(10 * MiB));
  const z = buildZip([{ name: "[Content_Types].xml", data: Buffer.alloc(100), declComp: real.length, declUncomp: 100 }, { name: "word/document.xml", data: "<d/>" }]);
  // thay dữ liệu mục đầu bằng luồng deflate thật 10 MiB (kích thước nén khai khớp)
  const lh = 30 + Buffer.byteLength("[Content_Types].xml"); const oldComp = deflateRawSync(Buffer.alloc(100)).length;
  const patched = Buffer.concat([z.subarray(0, lh), real, z.subarray(lh + oldComp)]);
  let threw = false, r: ReturnType<typeof inspectDocx> | null = null;
  try { r = inspectDocx(new Uint8Array(patched)); } catch { threw = true; }
  return !threw && !!r && !r.ok;
})());
const good = validDocx();
check("EOCD cụt (cắt 10 byte cuối) ⇒ từ chối, không ném lỗi", (() => { try { return !ok(inspectDocx(new Uint8Array(good.subarray(0, good.length - 10)))); } catch { return false; } })());
check("chỉ có chữ ký PK\\x03\\x04 rồi rác ⇒ từ chối", !ok(inspectDocx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]))));
check("thư mục trung tâm trỏ ra ngoài tệp ⇒ từ chối, không ném lỗi", (() => { const b = Buffer.from(good); b.writeUInt32LE(0x7fffffff, b.length - 22 + 16); try { return !ok(inspectDocx(new Uint8Array(b))); } catch { return false; } })());
check("ảnh PNG / JPEG / exe / HTML đổi đuôi .docx ⇒ từ chối", [PNG_BYTES, JPEG_BYTES, EXE_BYTES, HTML_BYTES].every(b => !ok(inspectDocx(new Uint8Array(b)))));
check("rỗng ⇒ từ chối; mảng ngắn 3 byte ⇒ từ chối", !ok(inspectDocx(new Uint8Array(0))) && !ok(inspectDocx(new Uint8Array([0x50, 0x4b, 0x03]))));
check("EOCD có comment dài (hợp lệ) vẫn đọc được", ok(inspectDocx(buildZip([{ name: "[Content_Types].xml", data: "<Types/>" }, { name: "word/document.xml", data: "<d/>" }], { eocdComment: 500 }))));
check("tệp lớn gần 10 MiB hợp lệ (đệm) vẫn ok", ok(inspectDocx(validDocx({ padTo: 10 * MiB - 1 }))));

section("inspectPdf: ca phá cố ý");
const pcode = (b: Buffer | Uint8Array) => { const r = inspectPdf(new Uint8Array(b)); return r.ok ? "ok" : r.code; };
check("%PDF-1.7 + %%EOF ⇒ ok; %PDF-2.0 ⇒ ok", pcode(validPdf()) === "ok" && pcode(Buffer.from("%PDF-2.0\nx\n%%EOF")) === "ok");
check("ảnh PNG / JPEG / MZ (exe) / PK (zip) / HTML đổi đuôi .pdf ⇒ từ chối", [PNG_BYTES, JPEG_BYTES, EXE_BYTES, plainZip(), HTML_BYTES].every(b => pcode(b) === "bad_content"));
check("có /JavaScript, /JS, /Launch, /Encrypt, /EmbeddedFile ⇒ từ chối", ["/JavaScript", "/JS (app.alert(1))", "/Launch", "/Encrypt 5 0 R", "/EmbeddedFile"].every(t => pcode(validPdf({ body: `<< /S ${t} >>` })) === "blocked_macro"), ["/JavaScript", "/JS (x)", "/Launch"].map(t => pcode(validPdf({ body: `<< /S ${t} >>` }))));
check("tên giấu bằng #xx (/J#61vaScript, /En#63rypt) ⇒ vẫn từ chối", pcode(validPdf({ body: "<< /S /J#61vaScript >>" })) === "blocked_macro" && pcode(validPdf({ body: "/En#63rypt 1 0 R" })) === "blocked_macro");
check("/JSON, /JavaScriptX, /Type /Page… (tên khác) KHÔNG bị phạt oan", pcode(validPdf({ body: "<< /Type /Page /JSON 1 /Lang (vi) /JSX 2 >>" })) === "ok");
check("thiếu %%EOF ⇒ từ chối; %%EOF nằm ngoài 2 KiB cuối ⇒ từ chối", pcode(Buffer.from("%PDF-1.7\nabc")) === "bad_content" && pcode(Buffer.from("%PDF-1.7\n%%EOF\n" + "a".repeat(3000))) === "bad_content");
check("rỗng / quá ngắn ⇒ từ chối; %PDF-3 / %PDF-1 (thiếu dấu chấm) ⇒ từ chối", pcode(Buffer.alloc(0)) === "bad_content" && pcode(Buffer.from("%PDF-")) === "bad_content" && pcode(Buffer.from("%PDF-3.0\n%%EOF")) === "bad_content");
check("PDF gần 10 MiB hợp lệ quét xong (không ném lỗi, < 3 giây)", (() => { const t = Date.now(); const r = pcode(validPdf({ padTo: 10 * MiB - 1 })); return r === "ok" && Date.now() - t < 3000; })());
check("inspectNopTepContent chọn đúng bộ kiểm theo đuôi; đuôi lạ ⇒ từ chối", inspectNopTepContent(validDocx(), "docx").ok && inspectNopTepContent(validPdf(), "pdf").ok && !inspectNopTepContent(validPdf(), "docx").ok && !inspectNopTepContent(validDocx(), "pdf").ok && !inspectNopTepContent(validPdf(), "exe").ok);

section("Hạn 60 ngày");
const T = new Date("2026-11-09T13:41:00.000Z");
const DAY = 86_400_000;
const exp = nopTepExpiresAt(T);
check("nopTepExpiresAt = đúng 60 × 24 giờ", exp.getTime() - T.getTime() === 60 * 24 * 3600_000 && exp.toISOString() === "2027-01-08T13:41:00.000Z", exp.toISOString());
const row = (deletedAt: Date | null = null) => ({ deletedAt, expiresAt: exp });
check("59 ngày ⇒ chưa hết hạn", !isNopTepExpired(row(), new Date(T.getTime() + 59 * DAY)));
check("59,9 ngày ⇒ chưa", !isNopTepExpired(row(), new Date(T.getTime() + 59.9 * DAY)));
check("ĐÚNG 60 ngày ⇒ chưa (so sánh nghiêm ngặt)", !isNopTepExpired(row(), new Date(T.getTime() + 60 * DAY)));
check("60 ngày + 1 ms ⇒ hết hạn", isNopTepExpired(row(), new Date(T.getTime() + 60 * DAY + 1)));
check("60,1 ngày ⇒ hết hạn", isNopTepExpired(row(), new Date(T.getTime() + 60.1 * DAY)));
check("đã xoá khỏi kho (deletedAt) ⇒ KHÔNG BAO GIỜ coi là hết hạn nữa", !isNopTepExpired(row(new Date()), new Date(T.getTime() + 999 * DAY)));

section("Câu where của cron ↔ hàm thuần (một nguồn sự thật)");
// Bộ đánh giá nhỏ cho đúng các toán tử mà câu where dùng: bằng, null, {lt}, {not}.
const evalWhere = (w: Record<string, unknown>, r: Record<string, unknown>): boolean => Object.entries(w).every(([k, c]) => {
  const x = r[k];
  if (c === null) return x === null;
  if (c && typeof c === "object" && !(c instanceof Date)) {
    const o = c as { lt?: Date; not?: unknown };
    if (o.lt !== undefined) return x instanceof Date && x.getTime() < o.lt.getTime();
    if (o.not !== undefined) return x !== o.not;
    return false;
  }
  return x === c;
});
const NOW = new Date("2027-01-20T00:00:00.000Z");
const mk = (id: string, o: { status: string; createdAt?: Date; expiresAt?: Date; deletedAt?: Date | null; submissionId?: string | null }) => ({ id, status: o.status, createdAt: o.createdAt ?? T, expiresAt: o.expiresAt ?? nopTepExpiresAt(o.createdAt ?? T), deletedAt: o.deletedAt ?? null, submissionId: o.submissionId === undefined ? "s1" : o.submissionId });
const hr = 3600_000;
const rows = [
  mk("ready-59", { status: "ready", createdAt: new Date(NOW.getTime() - 59 * DAY) }), mk("ready-60-exact", { status: "ready", createdAt: new Date(NOW.getTime() - 60 * DAY) }),
  mk("ready-60.1", { status: "ready", createdAt: new Date(NOW.getTime() - 60.1 * DAY) }), mk("ready-61", { status: "ready", createdAt: new Date(NOW.getTime() - 61 * DAY) }),
  mk("done", { status: "expired", createdAt: new Date(NOW.getTime() - 70 * DAY), deletedAt: new Date(NOW.getTime() - DAY) }),
  mk("expired-no-delete", { status: "expired", createdAt: new Date(NOW.getTime() - 70 * DAY) }),
  mk("pending-25h", { status: "pending", createdAt: new Date(NOW.getTime() - 25 * hr), submissionId: null }), mk("pending-1h", { status: "pending", createdAt: new Date(NOW.getTime() - hr), submissionId: null }),
  mk("pending-25h-attached", { status: "pending", createdAt: new Date(NOW.getTime() - 25 * hr), submissionId: "s9" }),
  mk("removed-left", { status: "removed", createdAt: new Date(NOW.getTime() - 3 * DAY) }), mk("removed-done", { status: "removed", createdAt: new Date(NOW.getTime() - 3 * DAY), deletedAt: new Date(NOW.getTime() - DAY) }),
  mk("removed-and-old", { status: "removed", createdAt: new Date(NOW.getTime() - 80 * DAY) }),
];
const pick = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).map(r => r.id).sort().join();
check("tập 'hết hạn': câu where ≡ isNopTepExpired (trừ status đã expired mà chưa deletedAt là hàng lạ)", pick(r => evalWhere(nopTepExpiredWhere(NOW), r)) === pick(r => isNopTepExpired(r, NOW) && r.status !== "expired"), pick(r => evalWhere(nopTepExpiredWhere(NOW), r)));
check("hết hạn đúng: 60.1, 61, removed-and-old (60 ngày đúng KHÔNG; 59 KHÔNG)", pick(r => evalWhere(nopTepExpiredWhere(NOW), r)) === ["ready-60.1", "ready-61", "removed-and-old"].sort().join(), pick(r => evalWhere(nopTepExpiredWhere(NOW), r)));
check("tập 'tải dở': câu where ≡ isNopTepAbandoned; chỉ pending-25h (1 giờ KHÔNG; đã gắn bài nộp KHÔNG)", pick(r => evalWhere(nopTepAbandonedWhere(NOW), r)) === pick(r => isNopTepAbandoned(r, NOW)) && pick(r => evalWhere(nopTepAbandonedWhere(NOW), r)) === "pending-25h", pick(r => evalWhere(nopTepAbandonedWhere(NOW), r)));
check("tập 'bỏ đi nhưng kho còn': câu where ≡ isNopTepRemovedLeftover; removed-left + removed-and-old (removed-done KHÔNG)", pick(r => evalWhere(nopTepRemovedLeftoverWhere(), r)) === pick(r => isNopTepRemovedLeftover(r)) && pick(r => evalWhere(nopTepRemovedLeftoverWhere(), r)) === ["removed-and-old", "removed-left"].join(), pick(r => evalWhere(nopTepRemovedLeftoverWhere(), r)));
check("không tập nào chạm hàng đã xoá (done) hay hàng còn hạn (ready-59, pending-1h, removed-done)", ["done", "ready-59", "ready-60-exact", "pending-1h", "removed-done"].every(id => ![nopTepExpiredWhere(NOW), nopTepAbandonedWhere(NOW), nopTepRemovedLeftoverWhere()].some(w => evalWhere(w, rows.find(r => r.id === id)!))));

section("describeNopTepFile: dạng trả ra API");
const secretRow = {
  id: "cmfile00001", kind: "student", originalName: "Nguyen Van An - Toan.docx", ext: "docx", sizeBytes: 12345, status: "ready", createdAt: T, expiresAt: exp, deletedAt: null, submissionId: "sub1",
  // các trường KHÔNG được lộ (hàng đầy đủ từ DB):
  storageKey: "kin-nop-bai/lop-1/asg-1/cmfile00001.docx", driver: "cloudinary", sha256: "deadbeef".repeat(8), ownerUserId: "u-owner", studentUserId: "u-stu", courseId: "lop-1",
};
const d1 = describeNopTepFile(secretRow, { namesVisible: true, now: NOW });
const dump = JSON.stringify(d1);
check("JSON không chứa storageKey|driver|sha256|ownerUserId|studentUserId|courseId|cloudinary|kin-nop-bai", !/storageKey|driver|sha256|ownerUserId|studentUserId|courseId|cloudinary|kin-nop-bai|deadbeef|u-owner|u-stu|lop-1/.test(dump), dump);
check("đúng các trường: id, kind, name, ext, sizeBytes, status, createdAt, expiresAt, expired, submitted, href", Object.keys(d1).sort().join() === "createdAt,expired,expiresAt,ext,href,id,kind,name,sizeBytes,status,submitted", Object.keys(d1));
check("href là đường riêng tư /api/media/nop-bai/<id>, không phải URL ngoài", d1.href === "/api/media/nop-bai/cmfile00001" && d1.name === "Nguyen Van An - Toan.docx" && d1.submitted === true);
const d2 = describeNopTepFile(secretRow, { namesVisible: false, index: 2, now: NOW });
check("namesVisible=false ⇒ tên chung 'Bài nộp 2.docx', không tên thật", d2.name === "Bài nộp 2.docx" && !JSON.stringify(d2).includes("Nguyen"));
check("bản nháp: submitted=false; quá hạn: expired=true; đã xoá kho: expired=false nhưng status expired ⇒ true", !describeNopTepFile({ ...secretRow, submissionId: null }, { namesVisible: true, now: NOW }).submitted && describeNopTepFile({ ...secretRow, createdAt: new Date(NOW.getTime() - 61 * DAY), expiresAt: nopTepExpiresAt(new Date(NOW.getTime() - 61 * DAY)) }, { namesVisible: true, now: NOW }).expired && describeNopTepFile({ ...secretRow, status: "expired", deletedAt: NOW }, { namesVisible: true, now: NOW }).expired);
check("trạng thái lạ không lọt ra API (rơi về removed)", describeNopTepFile({ ...secretRow, status: "weird" }, { namesVisible: true, now: NOW }).status === "removed");

section("canViewNopTepFile: bảng quyền 3.3");
const base = (o: Partial<NopTepViewCtx> & { file?: Partial<NopTepViewCtx["file"]> } = {}): NopTepViewCtx => ({
  now: NOW, viewer: { userId: "stu", role: "student" }, enrollment: "active", grader: false, linkedParent: false,
  ...o,
  file: { kind: "student", status: "ready", submissionId: "sub1", studentUserId: "stu", ownerUserId: "stu", deletedAt: null, expiresAt: new Date(NOW.getTime() + DAY), ...(o.file ?? {}) },
});
const dec = (c: NopTepViewCtx) => { const r = canViewNopTepFile(c); return r.ok ? `ok:${r.as}` : `${r.status}`; };
check("khách ⇒ 401", dec(base({ viewer: null })) === "401");
check("học sinh chủ, còn ghi danh ⇒ ok", dec(base()) === "ok:student");
check("học sinh chủ tải được bản NHÁP của mình (chưa nộp)", dec(base({ file: { submissionId: null } })) === "ok:student");
check("học sinh KHÁC (kể cả cùng lớp, đang ghi danh) ⇒ 404 (không lộ tồn tại)", dec(base({ viewer: { userId: "other", role: "student" } })) === "404");
check("học sinh chủ đã nghỉ lớp / chờ phụ huynh / chưa ghi danh ⇒ 403", ["suspended", "pending_consent", null].every(e => dec(base({ enrollment: e })) === "403"));
check("phụ huynh đã liên kết ⇒ 403 (mặc định chờ chủ)", dec(base({ viewer: { userId: "par", role: "student" }, linkedParent: true })) === "403");
check("tệp gia sư trả: học sinh chủ xem được khi đã đính kèm; CHƯA đính kèm ⇒ 404", dec(base({ file: { kind: "tutor_return", ownerUserId: "tut" } })) === "ok:student" && dec(base({ file: { kind: "tutor_return", ownerUserId: "tut", submissionId: null } })) === "404");
const tut = { userId: "tut", role: "admin" as const };
check("chủ lớp / đồng giảng hiệu lực / bộ môn trong nhóm / quản trị (qua cổng chấm) xem tệp ĐÃ NỘP ⇒ ok", dec(base({ viewer: tut, grader: true })) === "ok:grader");
check("gia sư lớp khác / đồng giảng chưa chấp nhận-bị gỡ / bộ môn ngoài nhóm (cổng chấm từ chối) ⇒ 403", dec(base({ viewer: tut, grader: false })) === "403");
check("tệp NHÁP chưa nộp: gia sư KHÔNG thấy (404), kể cả chủ lớp; chỉ người tải thấy", dec(base({ viewer: tut, grader: true, file: { submissionId: null } })) === "404" && dec(base({ viewer: tut, grader: true, file: { submissionId: null, kind: "tutor_return", ownerUserId: "tut" } })) === "ok:grader");
check("gia sư lớp khác thấy 403 TRƯỚC khi biết tệp là nháp (không lộ tồn tại qua 404)", dec(base({ viewer: tut, grader: false, file: { submissionId: null } })) === "403");
check("hết hạn: người CÓ quyền ⇒ 410 (kể cả khi cron chưa chạy: deletedAt null, expiresAt qua)", dec(base({ file: { expiresAt: new Date(NOW.getTime() - 1000) } })) === "410" && dec(base({ viewer: tut, grader: true, file: { expiresAt: new Date(NOW.getTime() - 1000) } })) === "410");
check("hết hạn: người KHÔNG quyền không phân biệt được (404/403 như bảng)", dec(base({ viewer: { userId: "other", role: "student" }, file: { expiresAt: new Date(NOW.getTime() - 1000) } })) === "404" && dec(base({ viewer: tut, grader: false, file: { expiresAt: new Date(NOW.getTime() - 1000) } })) === "403");
check("status expired ⇒ 410 cho người có quyền; removed/pending ⇒ 404", dec(base({ file: { status: "expired", deletedAt: NOW } })) === "410" && dec(base({ file: { status: "removed" } })) === "404" && dec(base({ file: { status: "pending" } })) === "404");
check("đúng mốc expiresAt (bằng now) chưa hết hạn ⇒ ok", dec(base({ file: { expiresAt: NOW } })) === "ok:student");
check("mặc định TỪ CHỐI: vai lạ / không có gì ⇒ không bao giờ ok", dec(base({ viewer: { userId: "x", role: "admin" }, grader: false })) !== "ok:grader" && dec(base({ viewer: { userId: "x", role: "student" } })) !== "ok:student");

section("isNopTepId / ?nop= / quét tĩnh mã");
check("isNopTepId: cuid ok; NUL, ../, quá ngắn/dài, không phải chuỗi ⇒ không", isNopTepId("cmabcdefgh12345") && !isNopTepId("a\u0000bcdefghi") && !isNopTepId("../../etc/passwd") && !isNopTepId("abc") && !isNopTepId("x".repeat(61)) && !isNopTepId(5) && !isNopTepId("abc%2fdefghi"));
check("?nop=ok → chữ; mã lạ → null (không in ra chữ người dùng)", nopTepResultMessage("ok") === "Đã nộp bài." && nopTepResultMessage("<script>") === null && !!nopTepResultMessage("loi-tat") && nopTepResultMessage(null) === null);
const walk = (d: string, out: string[] = []): string[] => { for (const n of readdirSync(join(root, d))) { const p = `${d}/${n}`; if (statSync(join(root, p)).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(n)) out.push(p); } return out; };
const routeFiles = [...walk("src/app/api/media/nop-bai"), "src/app/api/student/nop-bai/[assignmentId]/nop/route.ts", "src/app/api/cron/het-han-tep-nop-bai/route.ts"];
const libFiles = ["src/lib/nopTep.ts", "src/lib/nopTepInspect.ts", "src/lib/nopTepServer.ts", "src/lib/nopTepExpiryServer.ts"];
check(`tìm thấy ≥ 8 tệp route nop-bai / nop / cron`, routeFiles.length >= 9, routeFiles.length);
check("route + lib KHÔNG chứa NEXT_PUBLIC_CLOUDINARY, upload_preset, secure_url (không rơi về đường công khai)", [...routeFiles, ...libFiles].every(f => !/NEXT_PUBLIC_CLOUDINARY|upload_preset|secure_url/.test(read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))), [...routeFiles, ...libFiles].filter(f => /NEXT_PUBLIC_CLOUDINARY|upload_preset|secure_url/.test(read(f).replace(/\/\/.*$/gm, ""))));
const authFirst = routeFiles.filter(f => !f.includes("cron")).map(f => {
  const s = read(f);
  const iAuth = [s.indexOf("requireSession("), s.indexOf("getSession("), s.indexOf("studentGate("), s.indexOf("graderGate(")].filter(i => i >= 0).sort((a, b) => a - b)[0] ?? -1;
  const iDb = s.indexOf("prisma.");
  return { f, ok: iAuth >= 0 && (iDb < 0 || iAuth < iDb) };
});
check("mọi route nop-bai gọi requireSession/getSession (hoặc cổng) TRƯỚC khi chạm DB", authFirst.every(x => x.ok), authFirst.filter(x => !x.ok).map(x => x.f));
const cron = read("src/app/api/cron/het-han-tep-nop-bai/route.ts");
check("cron: checkCronAuth đứng đầu, rồi recordCronRun (không bọc try), mặc định khô: chỉ xoá khi ?xoa=1", cron.indexOf("checkCronAuth(") < cron.indexOf('recordCronRun("het-han-tep-nop-bai")') && !/try\s*\{\s*$/.test(cron.slice(0, cron.indexOf("recordCronRun(")).trimEnd().split("\n").pop() ?? "") && /get\("xoa"\) !== "1"/.test(cron));
check("vercel.json: cron het-han-tep-nop-bai KHÔNG có ?xoa=1 (chạy khô khi phát hành); lịch 30 18 * * *", (() => { const j = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] }; const c = j.crons.find(x => x.path.startsWith("/api/cron/het-han-tep-nop-bai")); return !!c && c.path === "/api/cron/het-han-tep-nop-bai" && c.schedule === "30 18 * * *"; })());
check("nopTep.ts không import node:* và không đọc process (chạy được ở trình duyệt)", !/from "node:|require\(|process\./.test(read("src/lib/nopTep.ts").replace(/\/\/.*$/gm, "")));
check("KHÔNG có mock/giả lưu trữ trong src/ (bộ giả chỉ ở tools/local-e2e)", [...routeFiles, ...libFiles].every(f => !/\bmock\b|\bfake\b|FakeStore/i.test(read(f).replace(/\/\/.*$/gm, ""))));
check("không log tên tệp: console.* trong route/lib không có originalName/name/fileName", [...routeFiles, ...libFiles].every(f => !/console\.(log|error|warn|info)\([^)]*(originalName|fileName|body\.name)/.test(read(f))));
check("không có deleteMany trên submissionFile (cron không xoá hàng loạt)", [...routeFiles, ...libFiles].every(f => !/submissionFile\.deleteMany/.test(read(f))));

done();
