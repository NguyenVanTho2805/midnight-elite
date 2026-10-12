// Giữ tên sản phẩm là KiN: không còn chữ "Midnight Elite" ở phần hiển thị (khoá kỹ thuật được phép: tên cookie, khoá chuyên mục tin, tên miền).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "generated" || n === "node_modules" || n === ".next") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|css|html)$/.test(n)) out.push(p);
  }
  return out;
}
section("Tên sản phẩm");
const files = walk("src");
const hits: string[] = [];
for (const f of files) readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/midnight elite|Midnight Elite/i.test(l)) hits.push(`${f}:${i + 1}`); });
check("không còn chữ 'Midnight Elite' trong src", hits.length === 0, hits.slice(0, 5));
const marks: string[] = [];
for (const f of files) readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/>\s*ME\s*<|^\s*ME\s*$/.test(l)) marks.push(`${f}:${i + 1}`); });
check("không còn logo chữ 'ME'", marks.length === 0, marks.slice(0, 5));
const layout = readFileSync("src/app/layout.tsx", "utf8");
check("tiêu đề và Open Graph của trang gốc dùng KiN", /title:\s*"KiN —/.test(layout) && /openGraph:[\s\S]*title:\s*"KiN"/.test(layout));
const email = readFileSync("src/lib/email.ts", "utf8");
check("email gửi đi: tên người gửi và chủ đề là KiN", /const FROM\s*=\s*`KiN </.test(email) && /subject: "Xác thực email — KiN"/.test(email));
check("khoá kỹ thuật giữ nguyên để không đăng xuất mọi người / không phải di chuyển dữ liệu: cookie midnight_session, chuyên mục tin 'tin-midnight'", readFileSync("src/lib/session.ts", "utf8").includes("midnight_session") && readFileSync("src/app/(admin)/admin/tin-tuc/page.tsx", "utf8").includes('value: "tin-midnight", label: "Tin KiN"'));
done();
