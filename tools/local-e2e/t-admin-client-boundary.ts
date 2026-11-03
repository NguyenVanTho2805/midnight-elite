// BU-08 mục 8.1 — quét nguồn: tệp "use client" dưới src/components/admin/** và src/app/(admin)/** không kéo mã máy chủ vào gói trình duyệt.
//  1) không nhập (giá trị) @/lib/prisma, @/generated/*, @prisma/client, mô-đun *Server;
//  2) `import type` được phép với MỌI mô-đun (bị xoá khi biên dịch) — adm-test nới so với đặc tả (ghi "chỉ import type từ adminOps"):
//     adminOps.ts là THUẦN (không DB), nên nhập giá trị từ đó được, MIỄN LÀ bao đóng nhập khẩu (@/lib/*) của nó không chạm prisma/*Server (kiểm đệ quy ở ca 3).
// Ca phá cố ý: thêm `import { prisma } from "@/lib/prisma"` vào src/components/admin/HangCho.tsx → đỏ; thêm `import "./adminOpsServer"` vào adminOps.ts → ca 3 đỏ.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check, section, done } from "./h";

const files: string[] = [];
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) files.push(p); } };
walk(join(process.cwd(), "src/components/admin")); walk(join(process.cwd(), "src/app/(admin)"));
const rel = (p: string) => relative(process.cwd(), p).replaceAll("\\", "/");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SERVER = /^(@\/lib\/prisma|@\/generated\/.*|@prisma\/client|@\/lib\/(?:[A-Za-z0-9_]+\/)*[A-Za-z0-9_]*Server|\.{1,2}\/(?:[A-Za-z0-9_.]+\/)*[A-Za-z0-9_]*Server)$/;

/** Nhập khẩu GIÁ TRỊ (bỏ `import type` và mục `type X` đơn lẻ nếu toàn bộ là type). */
function valueImports(src: string): string[] {
  const out: string[] = [];
  for (const m of strip(src).matchAll(/^\s*(?:import|export)\s+(type\s+)?([^;'"]*?)\s*(?:from\s+)?["']([^"']+)["']/gm)) {
    if (m[1]) continue;
    const inner = m[2].replace(/[{}*]|\bas\s+\w+/g, " ").split(",").map(s => s.trim()).filter(Boolean);
    if (inner.length && inner.every(s => /^type\s/.test(s))) continue;
    out.push(m[3]);
  }
  for (const m of strip(src).matchAll(/\b(?:require|import)\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  return out;
}
const resolveLib = (spec: string, from: string): string | null => {
  const base = spec.startsWith("@/") ? join(process.cwd(), "src", spec.slice(2)) : spec.startsWith(".") ? join(from, "..", spec) : null;
  if (!base) return null;
  for (const c of [base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")]) if (existsSync(c)) return c;
  return null;
};

const clients = files.filter(f => /^\s*["']use client["']/m.test(readFileSync(f, "utf8").split("\n").slice(0, 12).join("\n")));
section(`Ranh giới client (${clients.length} tệp "use client")`);
check("có tệp client để kiểm (quét không rỗng)", clients.length >= 10, clients.length);
const offenders: string[] = [];
for (const f of clients) for (const spec of valueImports(readFileSync(f, "utf8"))) if (SERVER.test(spec)) offenders.push(`${rel(f)} → ${spec}`);
check("không tệp client nào nhập GIÁ TRỊ từ prisma / generated / @prisma/client / *Server", offenders.length === 0, offenders);

section("Bao đóng nhập khẩu giá trị của tệp client (đệ quy qua @/ và ./) không chạm mã máy chủ");
const bad: string[] = [];
for (const f of clients) {
  const seen = new Set<string>(); const stack: { p: string; path: string[] }[] = [{ p: f, path: [rel(f)] }];
  while (stack.length) {
    const { p, path } = stack.pop()!;
    if (seen.has(p)) continue; seen.add(p);
    for (const spec of valueImports(readFileSync(p, "utf8"))) {
      if (SERVER.test(spec)) { bad.push(path.concat(spec).join(" → ")); continue; }
      const r = resolveLib(spec, p);
      if (r && !seen.has(r) && !/\/generated\//.test(r)) stack.push({ p: r, path: path.concat(rel(r)) });
    }
  }
}
check("không đường nhập giá trị nào từ tệp client tới prisma/*Server", bad.length === 0, bad.slice(0, 8));
const ops = readFileSync(join(process.cwd(), "src/lib/adminOps.ts"), "utf8");
check("adminOps.ts thuần: không nhập prisma/*Server", !valueImports(ops).some(s => SERVER.test(s)));
done();
