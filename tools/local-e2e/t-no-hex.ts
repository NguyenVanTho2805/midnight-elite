// Quét TĨNH mọi mã màu hex viết cứng trong mã nguồn giao diện (đợt đổi màu 2, 13/10): màu phải đi qua token --kin-*.
// Ngoại lệ có LÝ DO ghi rõ bên dưới; mỗi ngoại lệ phải còn khớp ít nhất một chỗ (tránh danh sách ngoại lệ cũ rích).
// Cũng kiểm: mọi lớp Tailwind kiểu text-gray-500 / border-blue-400 đang dùng đều đã được trỏ về token trong globals.css (@theme inline).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check, section, done } from "./h";

const ROOT = join(process.cwd(), "src");
const EXT = /\.(tsx|ts|css)$/;
const files: string[] = [];
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (EXT.test(n)) files.push(p); } };
walk(ROOT);
const rel = (p: string) => relative(process.cwd(), p).replaceAll("\\", "/");

// Mã hex 3/4/6/8 chữ số không nằm sau chữ/số/&/ (loại neo URL, thực thể HTML, mã băm trong chuỗi)
const HEX = /(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g;

const ALLOW: { file: RegExp; why: string }[] = [
  { file: /^src\/app\/kin-(tokens|site)\.css$/, why: "nơi ĐỊNH NGHĨA token KiN (kin-tokens.css sinh từ Figma, không sửa tay)" },
  { file: /^src\/generated\//, why: "mã sinh tự động (Prisma)" },
  { file: /^src\/lib\/email\.ts$/, why: "thư HTML: ứng dụng thư bỏ qua biến CSS nên bắt buộc màu viết cứng" },
  { file: /^src\/lib\/(courseData|honorData)\.ts$/, why: "DỮ LIỆU mẫu: màu nền khoá học / bảng vinh danh" },
  { file: /^src\/components\/kin\/KinLogo\.tsx$/, why: "màu logo thương hiệu (Figma: giữ 4 màu gốc, không đổi theo chủ đề)" },
  { file: /^src\/app\/\(guest\)\/bang-xep-hang\/page\.tsx$/, why: "bảng màu avatar phân loại + màu huy chương đồng (nội dung, không phải kiểu dáng)" },
  { file: /^src\/app\/\(guest\)\/cong-dong\/page\.tsx$/, why: "bảng màu avatar phân loại" },
  { file: /^src\/components\/community\/ThreadDetailShared\.tsx$/, why: "bảng màu avatar phân loại" },
  { file: /^src\/app\/\(guest\)\/khoa-hoc\/page\.tsx$/, why: "màu nhãn khoá học (Course.tagColor lưu trong DB) — giá trị mặc định khi chưa chọn" },
  { file: /^src\/app\/\(admin\)\/admin\/khoa-hoc\/(page|\[id\]\/page)\.tsx$/, why: "bộ chọn màu nhãn khoá học: các màu này được LƯU vào DB (Course.tagColor)" },
];

section("Mã hex viết cứng");
const hits: { f: string; line: number; text: string }[] = [];
for (const p of files) {
  const f = rel(p);
  readFileSync(p, "utf8").split("\n").forEach((l, i) => { if (l.match(HEX)) hits.push({ f, line: i + 1, text: l.trim().slice(0, 120) }); });
}
const bad = hits.filter(h => !ALLOW.some(a => a.file.test(h.f)));
check(`không còn mã hex ngoài danh sách ngoại lệ (quét ${files.length} file .ts/.tsx/.css)`, bad.length === 0, bad.slice(0, 8));
for (const a of ALLOW) check(`ngoại lệ còn dùng thật: ${a.file.source.slice(0, 70)} — ${a.why.slice(0, 50)}`, hits.some(h => a.file.test(h.f)));
check("globals.css không còn mã hex nào", !hits.some(h => h.f === "src/app/globals.css"));

section("Lớp màu Tailwind (text-gray-500, border-blue-400…) đã trỏ về token");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const defined = new Set([...css.matchAll(/--color-([a-z]+-\d{2,3}):\s*([^;]+);/g)].map(m => m[1]));
const FAM = "gray|slate|zinc|neutral|stone|red|green|blue|amber|yellow|orange|emerald|sky|purple|indigo|violet|pink|rose|teal|cyan|lime|fuchsia";
const USE = new RegExp(`\\b(?:text|bg|border|border-[tblrxy]|ring|from|to|via|divide|placeholder|fill|stroke|outline|accent|decoration)-((?:${FAM})-\\d{2,3})\\b`, "g");
const used = new Map<string, string>();
for (const p of files.filter(p => p.endsWith(".tsx"))) for (const m of readFileSync(p, "utf8").matchAll(USE)) if (!used.has(m[1])) used.set(m[1], rel(p));
const missing = [...used].filter(([k]) => !defined.has(k));
check(`${used.size} cặp màu-bậc Tailwind đang dùng đều đã có trong @theme của globals.css`, missing.length === 0, missing.slice(0, 8));
const themeInline = css.slice(css.indexOf("@theme inline"));
check("bảng màu Tailwind nằm trong @theme inline (phân giải tại phần tử → tôn trọng vùng sáng cố định)", defined.size >= 60 && themeInline.includes("--color-gray-500: var(--kin-chu-mo)"));
const notKin = [...css.matchAll(/--color-([a-z]+-\d{2,3}):\s*([^;]+);/g)].filter(m => !/var\(--kin-|color-mix\(in srgb, var\(--kin-/.test(m[2]));
check("mọi bậc màu Tailwind đã khai đều trỏ về token KiN (không còn giá trị riêng)", notKin.length === 0, notKin.map(m => m[1]));

section("Tên biến cũ còn dùng → đã có bí danh");
const legacy = ["canvas", "surface", "hairline", "hairline-strong", "ink", "ink-deep", "steel", "stone", "brand-navy", "tint-sky", "tint-rose", "tint-peach", "tint-mint", "tint-yellow", "tint-yellow-bold", "tint-lavender", "tint-cream", "shadow-neu-raised", "shadow-neu-flat", "shadow-neu-pressed", "shadow-neu-card", "color-primary", "color-text", "background", "foreground"];
const site = readFileSync(join(ROOT, "app/kin-site.css"), "utf8");
const usedLegacy = legacy.filter(v => files.some(p => !/kin-site\.css$/.test(p) && readFileSync(p, "utf8").includes(`var(--${v})`)));
const noAlias = usedLegacy.filter(v => !new RegExp(`--${v}:\\s*var\\(--kin-`).test(site));
check(`${usedLegacy.length} biến cũ đang được dùng đều có bí danh trỏ token KiN trong kin-site.css`, noAlias.length === 0, noAlias);

done();
