// BU-08 mục 1.9/8.1 — quét nguồn: tài liệu bài học và tệp đính kèm bài tập KHÔNG còn đường tải lên không ký.
// Đỏ: uploadToCloudinary/uploadMany với thư mục lessons/documents hoặc assignments/files trong (admin) và lop-cua-toi; <input type="file"> trong DocumentsEditor.
// CẢNH BÁO có tên (không đỏ): mọi nơi còn lại gọi uploadToCloudinary/uploadMany (ngoài phạm vi BU-08).
// Ca phá cố ý: thêm lại uploadToCloudinary(f,"lessons/documents") vào khoa-hoc/[id]/page.tsx → đỏ.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check, section, done } from "./h";

const files: string[] = [];
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) files.push(p); } };
walk(join(process.cwd(), "src"));
const rel = (p: string) => relative(process.cwd(), p).replaceAll("\\", "/");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const scope = files.filter(f => /^src\/app\/(\(admin\)|lop-cua-toi)\//.test(rel(f)) || /^src\/components\/(admin|tutor)\//.test(rel(f)));
const CALL = /\b(uploadToCloudinary|uploadMany)\s*\(\s*[^)]*?["'`]((?:lessons\/documents|assignments\/files)[^"'`]*)["'`]/;

section("Đường tải không ký đã đóng");
const bad = scope.filter(f => CALL.test(strip(readFileSync(f, "utf8")))).map(rel);
check("không còn uploadToCloudinary/uploadMany với lessons/documents hoặc assignments/files trong (admin), lop-cua-toi, components/admin|tutor", bad.length === 0, bad);
const anyFolder = files.filter(f => /["'`](lessons\/documents|assignments\/files)["'`]/.test(strip(readFileSync(f, "utf8")))).map(rel);
check("không tệp nguồn nào còn nhắc thư mục lessons/documents hoặc assignments/files", anyFolder.length === 0, anyFolder);

const kh = readFileSync(join(process.cwd(), "src/app/(admin)/admin/khoa-hoc/[id]/page.tsx"), "utf8");
const i = kh.indexOf("function DocumentsEditor");
const body = i < 0 ? "" : kh.slice(i, kh.indexOf("\nfunction ", i + 10) > 0 ? kh.indexOf("\nfunction ", i + 10) : undefined);
check("DocumentsEditor tồn tại và KHÔNG có <input type=\"file\">", i >= 0 && body.length > 100 && !/type=["']file["']/.test(body));
check("DocumentsEditor có hướng dẫn dán liên kết", /liên kết|link|dán/i.test(body));

section("Cảnh báo (không đỏ): nơi còn tải lên Cloudinary không ký — ngoài phạm vi BU-08");
const left = files.filter(f => /\b(uploadToCloudinary|uploadMany)\s*\(/.test(strip(readFileSync(f, "utf8"))) && !/^src\/lib\/cloudinary\.ts$/.test(rel(f))).map(rel);
for (const f of left) console.log(`  ⚠ CÒN: ${f}`);
console.log(`  ⚠ ${left.length} nơi còn gọi tải lên (đã biết, mục 1.9 liệt kê 5 nơi)`);
done();
