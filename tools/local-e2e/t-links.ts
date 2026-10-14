// Mọi nút / liên kết / lời gọi API phải có đích thật — kiểm tra tĩnh trên mã nguồn (không cần máy chủ).
//   1. Mọi địa chỉ nội bộ ("/…") trong mã khớp một trang thật của ứng dụng (đã bỏ nhóm (route-group), [tham số] khớp một đoạn bất kỳ).
//   2. Mọi lời gọi fetch/apiFetch/callApi tới /api/… khớp một route và route đó CÓ phương thức đang gọi (không gọi POST vào route chỉ có GET).
//   3. File route.ts chỉ xuất tên mà Next cho phép (GET/POST/…/dynamic/revalidate…): xuất tên khác làm `next build` thất bại mà `tsc` không báo.
//   4. Liên kết có tham số (?tab=, ?course=, ?redirect=) được trang đích thật sự đọc.
// Phát hiện đợt 14/10: /ban-do có 4 liên kết sai (/student/student/…, /student/cai-dat/chu-de); mọi trang /lop-cua-toi dùng ?next= trong khi
// trang đăng nhập chỉ đọc ?redirect= (đăng nhập xong không quay lại đúng trang).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";

const ROOT = process.cwd();
const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(ROOT, d))) { const p = join(d, n); if (statSync(join(ROOT, p)).isDirectory()) { if (n !== "generated") walk(p, out); } else out.push(p); } return out; };
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const isParam = (s: string) => /^\[.+\]$/.test(s);
const isCatchAll = (s: string) => /^\[\[?\.\.\./.test(s);
const matchRoute = (table: string[][], link: string[]) => table.some(pat => {
  const k = pat.findIndex(isCatchAll);
  if (k >= 0) return link.length >= k && pat.slice(0, k).every((s, i) => isParam(s) || s === link[i] || link[i] === "*");
  return pat.length === link.length && pat.every((s, i) => isParam(s) || s === link[i] || link[i] === "*");
});

(async () => {
  const appFiles = walk("src/app");
  const pages = appFiles.filter(p => /\/page\.(tsx|ts)$/.test(p)).map(p => p.replace(/^src\/app\//, "").replace(/\/page\.\w+$/, "").split("/").filter(Boolean).filter(s => !/^\(.*\)$/.test(s) && !s.startsWith("@") && !s.startsWith("_")));
  const routeFiles = appFiles.filter(p => /\/route\.(ts|tsx)$/.test(p));
  const files = walk("src").filter(p => /\.tsx?$/.test(p));

  section("1. Địa chỉ trang trong mã khớp trang thật");
  check(`có trang để đối chiếu (${pages.length})`, pages.length > 60);
  const STR = /(["'`])(\/[A-Za-z0-9\-_/${}.?=&#:%,\[\]+*]*)\1/g;
  const norm = (p: string) => p.split("#")[0].split("?")[0].replace(/\$\{[^}]*\}/g, "*").replace(/\/+$/, "").split("/").filter(Boolean);
  // Tiền tố / bản mẫu không phải liên kết: middleware (so sánh tiền tố), StudentShell (`also` = tiền tố module), thư mục _template (không định tuyến).
  const IGNORE = new Set(["src/middleware.ts", "src/app/(admin)/admin/_template/page.tsx"]);
  const IGNORE_PATH = new Set(["/student/bai-giang"]);
  const badPages: string[] = [];
  let nLinks = 0;
  for (const f of files) {
    if (IGNORE.has(f)) continue;
    read(f).split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const m of ln.matchAll(STR)) {
        const p = m[2];
        if (p === "/" || /^\/(g|i|gi)$/.test(p) || /^\/\*/.test(p) || /\.(png|jpe?g|svg|webp|ico|css|js|json|pdf|csv|woff2?|mp4)$/.test(p.split("?")[0]) || p.startsWith("/api/") || IGNORE_PATH.has(p)) continue;
        const segs = norm(p);
        if (segs.length === 0) continue;
        nLinks++;
        if (!matchRoute(pages, segs)) badPages.push(`${f}:${i + 1} ${p}`);
      }
    });
  }
  check(`${nLinks} địa chỉ nội bộ đều có trang đích`, badPages.length === 0, badPages);

  section("2. Lời gọi API: có route và đúng phương thức");
  const ALLOWED = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "dynamic", "revalidate", "runtime", "maxDuration", "preferredRegion", "fetchCache", "dynamicParams", "generateStaticParams", "config"]);
  const badExport: string[] = [];
  const methodsOf: Record<string, Set<string>> = {};
  for (const f of routeFiles) {
    const s = read(f);
    const names = [...s.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var)\s+(\w+)/gm)].map(m => m[1]).concat([...s.matchAll(/^export\s*\{([^}]+)\}/gm)].flatMap(m => m[1].split(",").map(x => x.trim().split(/\s+as\s+/).pop()!)));
    for (const n of names) if (!ALLOWED.has(n)) badExport.push(`${f}: export "${n}"`);
    const url = "/" + f.replace(/^src\/app\//, "").replace(/\/route\.\w+$/, "").split("/").filter(x => !/^\(.*\)$/.test(x)).join("/");
    methodsOf[url] = new Set(names.filter(n => /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(n)));
  }
  const toRe = (u: string) => new RegExp("^" + u.split("/").map(seg => /^\[\.\.\..*\]$/.test(seg) ? ".+" : /^\[.*\]$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|\\]/g, "\\$&")).join("/") + "$");
  const pats = Object.keys(methodsOf).map(u => ({ u, re: toRe(u), dyn: (u.match(/\[/g) ?? []).length })).sort((a, b) => a.dyn - b.dyn); // route tĩnh ưu tiên hơn [id]
  const bad: string[] = [];
  let nCalls = 0;
  for (const f of files) {
    if (f.startsWith("src/app/api/") || f === "src/middleware.ts" || f === "src/app/(admin)/admin/_template/page.tsx") continue;
    const text = read(f);
    for (const m of text.matchAll(/\b(fetch|apiFetch|callApi)\s*(?:<[^()]*>)?\(\s*(?:`(\/api\/(?:[^`$]|\$\{(?:[^{}]|\{[^{}]*\})*\})*)`|"(\/api\/[^"]*)"|'(\/api\/[^']*)')([^)]*)/g)) {
      const line = text.slice(0, m.index).split("\n").length;
      const raw = m[2] ?? m[3] ?? m[4];
      // `${…}` ngay sau một dấu "/" là một đoạn đường dẫn; còn lại (vd `/api/x${qs ? "?"+qs : ""}`) là phần truy vấn.
      const path = raw.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, "\u0001").replace(/\/\u0001/g, "/X").replace(/\u0001/g, "").split("?")[0];
      const methodExpr = /method:\s*([^,}]+)/.exec(m[5])?.[1] ?? '"GET"';
      const verbs = [...methodExpr.matchAll(/"(\w+)"/g)].map(x => x[1].toUpperCase()); // vế điều kiện ?: có thể có hai phương thức
      nCalls++;
      const hit = pats.find(p => p.re.test(path));
      if (!hit) { bad.push(`${f}:${line} ${raw} → không có route`); continue; }
      for (const v of verbs) if (!methodsOf[hit.u].has(v)) bad.push(`${f}:${line} ${v} ${raw} → route ${hit.u} chỉ có ${[...methodsOf[hit.u]].join(",")}`);
    }
  }
  check(`${nCalls} lời gọi API đều có route và đúng phương thức`, bad.length === 0, bad);
  check(`${routeFiles.length} file route.ts chỉ xuất tên hợp lệ (nếu không next build hỏng)`, badExport.length === 0, badExport);

  section("3. Liên kết có tham số: trang đích có đọc");
  const has = (f: string, re: RegExp) => re.test(read(f));
  check("/dang-nhap đọc ?redirect= (mọi nơi chuyển về đăng nhập dùng redirect=, không còn next=)", has("src/app/(guest)/dang-nhap/page.tsx", /searchParams\.get\("redirect"\)/) && files.every(f => !/dang-nhap\?next=/.test(read(f)) || f.startsWith("tools")));
  check("/lop-cua-toi/hoc-phi đọc ?tab= (đối soát)", has("src/app/lop-cua-toi/(tutor)/hoc-phi/page.tsx", /tab\?: string/));
  check("/admin/khoa-hoc/[id] đọc ?tab= (lich-hoc)", has("src/app/(admin)/admin/khoa-hoc/[id]/page.tsx", /searchParams\.get\("tab"\)/));
  check("/student/hoc-tap đọc ?course=", has("src/app/(student)/student/hoc-tap/page.tsx", /searchParams\.get\("course"\)/));
  check("/cong-dong đọc ?tab= (hoi-dap-qa)", has("src/app/(guest)/cong-dong/page.tsx", /searchParams\.get\("tab"\)/));
  check("Cài đặt gia sư có mốc #module cho liên kết 'Thêm module'", has("src/app/lop-cua-toi/(tutor)/cai-dat/CaiDatClient.tsx", /id="module"/));
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
