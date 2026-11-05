// Chặn tái phát lỗi "tệp trình duyệt kéo Prisma vào bundle" (06/11): RoomGate.tsx ("use client") import hằng từ @/lib/enrollment, mà enrollment.ts có
// `await import("@/lib/prisma")` ⇒ Turbopack gói Prisma cho trình duyệt ⇒ /student/thi-thu/[examId] trả 500 (không tsc nào bắt được).
// Bài THUẦN (đọc mã nguồn, không cần máy chủ): từ mỗi tệp có chỉ thị "use client" dưới src/, đi theo mọi import (tĩnh, export...from, import() động; bỏ `import type`)
// qua alias @/ và đường tương đối; tệp nào chạm tới phía máy chủ → ĐỎ, kèm chuỗi import để biết sửa chỗ nào.
// Phía máy chủ = prisma.ts, enrollment.ts, attemptAccess.ts, *Server.ts, hoặc tệp import @/lib/prisma | server-only | next/headers | @prisma/client | node:fs… (trừ node:crypto/path/url/util/buffer, đã đa điền).
// Hằng dùng chung cho trình duyệt phải nằm ở tệp thuần (vd src/lib/enrollmentMessages.ts, không import gì).
// CA PHÁ CỐ Ý: (1) RoomGate.tsx đổi import về "@/lib/enrollment" → đỏ "src/components/**/RoomGate.tsx". (2) thêm `import "@/lib/prisma"` vào enrollmentMessages.ts → đỏ cả bài thật lẫn ca "tệp thuần".
// (3) các ca tổng hợp bên dưới (đồ thị giả) phải đỏ/xanh đúng — nếu bộ quét hỏng (luôn xanh) ca tổng hợp báo.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { check, section } from "./h";

type Files = Map<string, string>; // đường dẫn tương đối gốc repo ("src/...") → nội dung

const SERVER_FILES = /^src\/lib\/(prisma|enrollment|attemptAccess)\.ts$|Server\.tsx?$/;
// node:crypto/path/url/util/buffer được Turbopack đa điền cho trình duyệt (đang có sẵn ở tuitionInvoice/parentPortal/examPassword, trang vẫn chạy) → không đỏ; mọi node:* khác (fs, child_process…) đỏ.
const SERVER_IMPORTS = /^(@\/lib\/prisma|server-only|next\/headers|@prisma\/client|@\/generated\/.*|node:(?!(crypto|path|url|util|buffer)$).*)$/;
const IMPORT_RE = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?([^'"`;]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

export function isClientFile(src: string): boolean {
  const head = src.replace(/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "");
  return /^["']use client["']/.test(head);
}

/** Danh sách đặc tả import của một tệp (bỏ import type thuần). */
export function importsOf(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[5]) { out.push(m[5]); continue; }
    if (m[2]) continue; // import type / export type
    const clause = m[3] ?? "";
    if (/^\s*\{[^}]*\}\s+from\s+$/.test(clause) && !/(^|[{,\s])(?!type\s)\w/.test(clause.replace(/\bfrom\s*$/, "").replace(/[{}]/g, " ").split(",").map(s => s.trim()).filter(s => !/^type\s/.test(s)).join(","))) continue; // chỉ toàn `type X`
    out.push(m[4]);
  }
  return out;
}

function resolve(from: string, spec: string, files: Files): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = join(dirname(from), spec).replaceAll("\\", "/");
  else return null;
  for (const c of [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"]) if (files.has(c)) return c;
  return null;
}

/** Trả về các chuỗi import từ tệp "use client" tới tệp phía máy chủ. */
export function findClientServerLeaks(files: Files): string[][] {
  const leaks: string[][] = [];
  const serverSelf = (f: string) => SERVER_FILES.test(f) || importsOf(files.get(f) ?? "").some(s => SERVER_IMPORTS.test(s));
  for (const [root, src] of files) {
    if (!isClientFile(src)) continue;
    const seen = new Set<string>([root]);
    const stack: string[][] = [[root]];
    while (stack.length) {
      const chain = stack.pop()!;
      const cur = chain[chain.length - 1];
      for (const spec of importsOf(files.get(cur) ?? "")) {
        if (SERVER_IMPORTS.test(spec)) { leaks.push([...chain, spec]); continue; }
        const next = resolve(cur, spec, files);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        if (serverSelf(next)) { leaks.push([...chain, next]); continue; }
        stack.push([...chain, next]);
      }
    }
  }
  return leaks;
}

function loadRepo(): Files {
  const files: Files = new Map();
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== "generated") walk(p); } else if (/\.(ts|tsx)$/.test(n)) files.set(relative(process.cwd(), p).replaceAll("\\", "/"), readFileSync(p, "utf8")); } };
  walk(join(process.cwd(), "src"));
  return files;
}

(async () => {
  section("Bộ quét: ca tổng hợp (phải đỏ/xanh đúng)");
  const mk = (o: Record<string, string>): Files => new Map(Object.entries(o));
  const bad = findClientServerLeaks(mk({
    "src/components/A.tsx": `"use client";\nimport { M } from "@/lib/enrollment";\nexport const A = M;`,
    "src/lib/enrollment.ts": `export const M = 1;\nexport async function f(){ const { prisma } = await import("@/lib/prisma"); }`,
    "src/lib/prisma.ts": `export const prisma = 1;`,
  }));
  check("client → enrollment.ts (có import() động prisma) bị bắt", bad.length >= 1 && bad[0].includes("src/lib/enrollment.ts"), bad);
  const deep = findClientServerLeaks(mk({
    "src/components/B.tsx": `'use client'\nimport { x } from "./util";`,
    "src/components/util.ts": `export { y as x } from "@/lib/mid";`,
    "src/lib/mid.ts": `import { s } from "@/lib/thingServer";\nexport const y = s;`,
    "src/lib/thingServer.ts": `export const s = 1;`,
  }));
  check("đi sâu nhiều tầng (relative → alias → *Server.ts) bị bắt", deep.length === 1 && deep[0].length === 4, deep);
  const direct = findClientServerLeaks(mk({ "src/components/C.tsx": `"use client";\nimport { prisma } from "@/lib/prisma";`, "src/lib/prisma.ts": `export const prisma = 1;` }));
  check("client import thẳng @/lib/prisma bị bắt", direct.length === 1, direct);
  const clean = findClientServerLeaks(mk({
    "src/components/D.tsx": `"use client";\nimport type { T } from "@/lib/enrollment";\nimport { MSG } from "@/lib/enrollmentMessages";\nexport const D = MSG;`,
    "src/lib/enrollment.ts": `import("@/lib/prisma");`,
    "src/lib/enrollmentMessages.ts": `export const MSG = "x";`,
  }));
  check("import type và tệp thuần KHÔNG bị bắt", clean.length === 0, clean);
  const typesOnly = findClientServerLeaks(mk({
    "src/components/E.tsx": `"use client";\nimport { type A, type B } from "@/lib/enrollment";`,
    "src/lib/enrollment.ts": `import("@/lib/prisma");`,
  }));
  check("import { type A, type B } (chỉ kiểu) KHÔNG bị bắt", typesOnly.length === 0, typesOnly);
  const serverOnly = findClientServerLeaks(mk({ "src/app/page.tsx": `// ghi chú\n"use client";\nimport { x } from "@/lib/z";`, "src/lib/z.ts": `import "server-only";\nexport const x = 1;` }));
  check("chỉ thị 'use client' sau dòng chú thích vẫn nhận; server-only bị bắt", serverOnly.length === 1, serverOnly);
  const notClient = findClientServerLeaks(mk({ "src/app/api/r/route.ts": `import { prisma } from "@/lib/prisma";`, "src/lib/prisma.ts": `export const prisma = 1;` }));
  const nodeFs = findClientServerLeaks(mk({ "src/components/F.tsx": `"use client";\nimport { x } from "@/lib/f";`, "src/lib/f.ts": `import { readFileSync } from "node:fs";\nexport const x = readFileSync;` }));
  const nodeCrypto = findClientServerLeaks(mk({ "src/components/G.tsx": `"use client";\nimport { x } from "@/lib/g";`, "src/lib/g.ts": `import { createHash } from "node:crypto";\nexport const x = createHash;` }));
  check("node:fs bị bắt, node:crypto (đa điền) thì không", nodeFs.length === 1 && nodeCrypto.length === 0, { nodeFs, nodeCrypto });
  check("tệp máy chủ (không 'use client') import prisma là bình thường", notClient.length === 0, notClient);

  section("Mã nguồn thật: không tệp 'use client' nào kéo phía máy chủ vào bundle trình duyệt");
  const files = loadRepo();
  const clientCount = [...files.values()].filter(isClientFile).length;
  check(`quét được tệp 'use client' (${clientCount})`, clientCount > 50, clientCount);
  const leaks = findClientServerLeaks(files);
  check("không có đường import nào từ 'use client' tới prisma/enrollment.ts/*Server.ts", leaks.length === 0, leaks.slice(0, 5).map(c => c.join(" → ")));
  if (leaks.length) for (const c of leaks) console.log("    ✗ " + c.join(" → "));

  section("Tệp thuần enrollmentMessages.ts");
  const msgPath = "src/lib/enrollmentMessages.ts";
  check("tồn tại", existsSync(msgPath));
  check("không import gì (kể cả import động)", !/\bimport\b[\s\S]*?["']|\brequire\(/.test((files.get(msgPath) ?? "").replace(/\/\/[^\n]*/g, "")), importsOf(files.get(msgPath) ?? ""));
  check("RoomGate.tsx lấy thông điệp từ tệp thuần", /from "@\/lib\/enrollmentMessages"/.test(files.get("src/components/student/exam-room/RoomGate.tsx") ?? ""));
  const { done } = await import("./h");
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
