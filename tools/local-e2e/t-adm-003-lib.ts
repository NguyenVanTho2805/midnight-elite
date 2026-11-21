// ADM-003 — cron (từ SCL F1: english-voa đã xoá cùng Tiếng Anh; kiểm bằng remind-exam) hiện trên "Triển khai và hạn mức" + trang mẫu _template ra khỏi src. THUẦN: không DB, không máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-adm-003-lib.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CRON_JOBS, cronSettingKey, cronView } from "@/lib/adminOps";
import { check, section, done } from "./h";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const NOW = new Date("2026-10-24T05:00:00Z");
const vercel = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] };

section("CRON_JOBS ↔ vercel.json");
const voa = CRON_JOBS.find(j => j.key === "remind-exam");
check("1. CRON_JOBS có remind-exam đúng path/lịch/dung sai; không còn english-voa (SCL F1)", !!voa && voa.path === "/api/cron/remind-exam" && voa.schedule === "Mỗi ngày 07:00 giờ VN" && voa.maxGapHours === 36 && !CRON_JOBS.some(j => j.key === "english-voa"));
const vPaths = vercel.crons.map(c => c.path).sort().join();
const jPaths = CRON_JOBS.map(j => j.path).sort().join();
check("2. vercel.json và CRON_JOBS khớp hai chiều (không thừa, không thiếu)", vPaths === jPaths, `${vPaths} ≠ ${jPaths}`);
for (const c of vercel.crons) {
  const m = /^(\d+) (\d+) \* \* \*$/.exec(c.schedule);
  const job = CRON_JOBS.find(j => j.path === c.path);
  const want = m ? `Mỗi ngày ${String((Number(m[2]) + 7) % 24).padStart(2, "0")}:${m[1].padStart(2, "0")} giờ VN` : "(lịch lạ)";
  check(`3. lịch VN đổi đúng từ UTC: ${c.path}`, !!job && job.schedule === want, `${job?.schedule} ≠ ${want}`);
}

section("Ba chỗ một tên");
for (const j of CRON_JOBS) {
  const f = `src/app/api/cron/${j.key}/route.ts`;
  const ok = existsSync(join(process.cwd(), f));
  const src = ok ? read(f) : "";
  check(`4. ${j.key}: có route, import và gọi recordCronRun("${j.key}")`, ok && src.includes(`recordCronRun("${j.key}")`) && src.includes('import { recordCronRun } from "@/lib/adminOpsServer"'));
}
check("5. SCL F1: route english-voa đã xoá", !existsSync(join(process.cwd(), "src/app/api/cron/english-voa")));
check("6. khoá SettingKV riêng từng job và đúng tên", new Set(CRON_JOBS.map(j => cronSettingKey(j.key))).size === CRON_JOBS.length && cronSettingKey("remind-exam") === "cron.remind-exam.lastCall");
if (voa) {
  check("7a. cronView null → Chưa ghi nhận", cronView(voa, null, NOW).status === "Chưa ghi nhận");
  check("7b. 5 giờ trước → Đúng lịch", cronView(voa, new Date(NOW.getTime() - 5 * 3_600_000).toISOString(), NOW).status === "Đúng lịch");
  check("7c. 37 giờ trước → Chậm so với lịch", cronView(voa, new Date(NOW.getTime() - 37 * 3_600_000).toISOString(), NOW).status === "Chậm so với lịch");
}

section("Trang mẫu _template ra khỏi src");
const moved = "docs/kin/thiet-ke/mau-trang-admin.tsx.txt";
check("8. _template không còn trong src; bản mẫu nằm ở docs và mở đầu '// ĐÃ CŨ'", !existsSync(join(process.cwd(), "src/app/(admin)/admin/_template")) && existsSync(join(process.cwd(), moved)) && read(moved).startsWith("// ĐÃ CŨ"));
check("9. t-links và t-admin-queue-lib không còn ngoại lệ _template", !read("tools/local-e2e/t-links.ts").includes("_template") && !read("tools/local-e2e/t-admin-queue-lib.ts").includes("_template"));
const priv = readdirSync(join(process.cwd(), "src/app/(admin)/admin")).filter(n => n.startsWith("_"));
check("10. không có thư mục '_' nào trong cây admin", priv.length === 0, priv.join());

done();
