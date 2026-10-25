// src/lib/cronAuth.ts (19/10/2026) — /api/cron/* đóng khi thiếu CRON_SECRET, không mở cửa như trước.
// Không DB, không mạng: chạy `npx tsx tools/local-e2e/t-cron-auth-lib.ts` từ gốc kho mã.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkCronAuth, CRON_SECRET_MIN_LENGTH } from "@/lib/cronAuth";
import { check, section, done } from "./h";

const S = "abcdefghijklmnop-cron";

(async () => {
section("Thiếu / quá ngắn CRON_SECRET → từ chối mọi lời gọi (503), kể cả header đúng dạng");
check("không có env, không header", (() => { const r = checkCronAuth(undefined, null); return !r.ok && r.status === 503; })());
check("không có env, header 'Bearer undefined'", (() => { const r = checkCronAuth(undefined, "Bearer undefined"); return !r.ok && r.status === 503; })());
check("env rỗng, header 'Bearer '", (() => { const r = checkCronAuth("", "Bearer "); return !r.ok && r.status === 503; })());
const short = "x".repeat(CRON_SECRET_MIN_LENGTH - 1);
check("env ngắn hơn tối thiểu, header khớp", (() => { const r = checkCronAuth(short, `Bearer ${short}`); return !r.ok && r.status === 503; })());

section("Có CRON_SECRET → chỉ đúng 'Bearer <khoá>' mới qua");
check("đúng khoá → ok", checkCronAuth(S, `Bearer ${S}`).ok);
check("không header → 401", (() => { const r = checkCronAuth(S, null); return !r.ok && r.status === 401; })());
check("sai khoá cùng độ dài → 401", (() => { const r = checkCronAuth(S, `Bearer ${S.slice(0, -1)}X`); return !r.ok && r.status === 401; })());
check("khoá trần không có 'Bearer ' → 401", (() => { const r = checkCronAuth(S, S); return !r.ok && r.status === 401; })());
check("khoá dài hơn (tiền tố đúng) → 401", (() => { const r = checkCronAuth(S, `Bearer ${S}x`); return !r.ok && r.status === 401; })());

section("Mọi route /api/cron/* đều đi qua checkCronAuth, không còn kiểu `if (secret)`");
const dir = join(process.cwd(), "src/app/api/cron");
for (const name of readdirSync(dir)) {
  const src = readFileSync(join(dir, name, "route.ts"), "utf8");
  check(`${name}: gọi checkCronAuth`, src.includes("checkCronAuth(process.env.CRON_SECRET"));
  check(`${name}: không còn nhánh bỏ qua kiểm khi thiếu env`, !/if\s*\(\s*secret\s*\)/.test(src));
}

await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
