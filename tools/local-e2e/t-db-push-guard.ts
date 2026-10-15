// scripts/db-push-guard.mjs + scripts/db-push-on-production.mjs (15/10/2026, sau khi build production của PR #54 đỏ vì `@unique` trên cột mới users.phoneE164).
// Không DB, không mạng: phần thuần kiểm bằng đúng đoạn log Prisma đã in trên Vercel; phần script kiểm bằng một `npx` GIẢ (đặt đầu PATH) để biết
// script gọi prisma mấy lần, với cờ nào, và thoát mã nào.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { check, section, done } from "./h";

const root = process.cwd(); // chạy từ thư mục gốc kho mã (xem README)

(async () => {
const guard = await import(pathToFileURL(join(root, "scripts/db-push-guard.mjs")).href) as {
  onlyUniqueConstraintAdditions: (o: string) => boolean;
  dataLossWarnings: (o: string) => string[];
};

// Nguyên văn log Vercel 15/10/2026 (deployment dpl_22sUfzepKv1f96NLU7ftK8nap5tL).
const UNIQ = "• A unique constraint covering the columns `[phoneE164]` on the table `users` will be added. If there are existing duplicate values, this will fail.";
const DROP = "• You are about to drop the column `legacy` on the `users` table, which still contains 3 non-null values.";
const TYPE = "• You are about to alter the column `score` on the `exam_attempts` table, which contains 12 non-null values. The data in that column will be cast from `Float` to `Int`.";
const HEAD = "⚠️  There might be data loss when applying the changes:";
const TAIL = "Error: Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --accept-data-loss";
const log = (...bullets: string[]) => `Datasource "db": PostgreSQL database "neondb"\n\n${HEAD}\n\n${bullets.map(b => "  " + b).join("\n\n")}\n\n${TAIL}\n`;
const { onlyUniqueConstraintAdditions: ok, dataLossWarnings } = guard;

section("Phần thuần: chỉ chấp nhận khi MỌI cảnh báo là 'thêm ràng buộc duy nhất'");
check("log thật của PR #54 (một cảnh báo unique) → chấp nhận", ok(log(UNIQ)));
check("hai ràng buộc unique → chấp nhận", ok(log(UNIQ, UNIQ.replace("phoneE164", "zaloId").replace("users", "profiles"))));
check("unique nhiều cột `[a], [b]` → chấp nhận", ok(log("• A unique constraint covering the columns `[courseId,userId]` on the table `enrollments` will be added. If there are existing duplicate values, this will fail.")));
check("có cả xoá cột → TỪ CHỐI", !ok(log(UNIQ, DROP)));
check("chỉ xoá cột → TỪ CHỐI", !ok(log(DROP)));
check("đổi kiểu cột → TỪ CHỐI", !ok(log(TYPE)));
check("xoá cột đứng TRƯỚC unique → vẫn TỪ CHỐI (không chỉ nhìn dòng đầu)", !ok(log(DROP, UNIQ)));
check("xoá bảng ('drop the `x` table') → TỪ CHỐI", !ok(log("• You are about to drop the `sales_leads` table, which is not empty (42 rows).")));
check("không có tiêu đề cảnh báo (lỗi khác, vd. không nối được DB) → TỪ CHỐI", !ok("Error: P1001: Can't reach database server at `x`"));
check("có tiêu đề nhưng không đòi --accept-data-loss → TỪ CHỐI", !ok(`${HEAD}\n\n  ${UNIQ}\n`));
check("rỗng / undefined → TỪ CHỐI", !ok("") && !ok(undefined as unknown as string));
check("có tiêu đề 'cannot be executed' (bước không chạy được) → TỪ CHỐI dù có unique", !ok(`⚠️  We found changes that cannot be executed:\n\n  • Added the required column \`x\` to the \`users\` table without a default value.\n\n${log(UNIQ)}`));
check("tiêu đề có nhưng không đọc được dòng cảnh báo nào (đổi ký hiệu đầu dòng) → TỪ CHỐI", !ok(`${HEAD}\n\n  - A unique constraint covering the columns \`[a]\` on the table \`t\` will be added.\n\n${TAIL}`));
check("mã màu ANSI trong log không làm hỏng việc nhận dạng", ok(log(UNIQ).replace(HEAD, `\u001b[33m${HEAD}\u001b[0m`).replace(UNIQ, `\u001b[1m${UNIQ}\u001b[0m`)));
check("đọc đúng danh sách cảnh báo", JSON.stringify(dataLossWarnings(log(UNIQ, DROP))) === JSON.stringify([UNIQ.slice(2), DROP.slice(2)]), dataLossWarnings(log(UNIQ, DROP)));
check("kết thúc ở dòng 'Error:' — dòng gạch đầu sau đó không bị tính", JSON.stringify(dataLossWarnings(`${log(UNIQ)}\n• dòng rác sau lỗi`)) === JSON.stringify([UNIQ.slice(2)]));

section("Script thật với `npx` giả");
const bin = mkdtempSync(join(tmpdir(), "fake-npx-"));
const logFile = join(bin, "calls.log");
const fake = `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$*" in *--accept-data-loss*) FLAG=1;; *) FLAG=0;; esac
case "$FAKE_MODE" in
  ok) echo "Your database is now in sync with your Prisma schema."; exit 0;;
  unique|drop|mixed)
    if [ "$FLAG" = "1" ]; then echo "Your database is now in sync with your Prisma schema."; exit 0; fi
    printf '%s\\n\\n' '${HEAD}'
    if [ "$FAKE_MODE" != "drop" ]; then printf '  %s\\n\\n' '${UNIQ}'; fi
    if [ "$FAKE_MODE" != "unique" ]; then printf '  %s\\n\\n' '${DROP}'; fi
    echo '${TAIL}' >&2; exit 1;;
  down) echo "Error: P1001: Can't reach database server" >&2; exit 1;;
esac
exit 99
`;
writeFileSync(join(bin, "npx"), fake); chmodSync(join(bin, "npx"), 0o755);

function run(mode: string, env: Record<string, string> = {}) {
  writeFileSync(logFile, "");
  const r = spawnSync(process.execPath, [join(root, "scripts/db-push-on-production.mjs")], {
    cwd: root, encoding: "utf8",
    env: { PATH: `${bin}:${process.env.PATH}`, FAKE_LOG: logFile, FAKE_MODE: mode, VERCEL_ENV: "production", ...env } as unknown as NodeJS.ProcessEnv,
  });
  const calls = existsSync(logFile) ? readFileSync(logFile, "utf8").split("\n").filter(Boolean) : [];
  return { status: r.status, out: `${r.stdout}${r.stderr}`, calls };
}

const a = run("ok");
check("không có cảnh báo: gọi prisma 1 lần, không cờ, thoát 0", a.status === 0 && a.calls.length === 1 && !a.calls[0].includes("--accept-data-loss"), a);

const u = run("unique");
check("chỉ cảnh báo unique: gọi 2 lần — lần 1 không cờ, lần 2 có --accept-data-loss — thoát 0", u.status === 0 && u.calls.length === 2 && !u.calls[0].includes("--accept-data-loss") && u.calls[1].includes("--accept-data-loss"), u);
check("…và nói rõ lý do trong log build", u.out.includes("thêm ràng buộc duy nhất"), u.out.slice(0, 300));
check("…in lại nguyên văn cảnh báo của Prisma (để đọc được trong log Vercel)", u.out.includes("A unique constraint covering the columns"), u.out.slice(0, 300));

const d = run("drop");
check("cảnh báo xoá cột: gọi prisma ĐÚNG 1 lần (không thử lại với cờ), thoát 1", d.status === 1 && d.calls.length === 1 && !d.calls[0].includes("--accept-data-loss"), d);

const m = run("mixed");
check("unique + xoá cột: KHÔNG tự chấp nhận (1 lần gọi, thoát 1)", m.status === 1 && m.calls.length === 1, m);

const x = run("down");
check("lỗi khác (không nối được DB): không thử lại, thoát 1", x.status === 1 && x.calls.length === 1, x);

const f = run("drop", { PRISMA_ACCEPT_DATA_LOSS: "1" });
check("PRISMA_ACCEPT_DATA_LOSS=1 vẫn hoạt động như cũ: 1 lần gọi có cờ, thoát 0", f.status === 0 && f.calls.length === 1 && f.calls[0].includes("--accept-data-loss"), f);

const z = run("drop", { PRISMA_ACCEPT_DATA_LOSS: "0" });
check("PRISMA_ACCEPT_DATA_LOSS=0 như không đặt: xoá cột vẫn bị từ chối", z.status === 1 && z.calls.length === 1, z);

const p = run("unique", { VERCEL_ENV: "preview" });
check("bản xem trước (preview, không có DB riêng): bỏ qua hẳn, không gọi prisma, thoát 0", p.status === 0 && p.calls.length === 0, p);

const po = run("unique", { VERCEL_ENV: "preview", PREVIEW_OWN_DB: "1" });
check("preview có DB riêng: vẫn áp quy tắc unique (2 lần gọi, thoát 0)", po.status === 0 && po.calls.length === 2, po);

const pd = run("drop", { VERCEL_ENV: "preview", PREVIEW_OWN_DB: "1", PRISMA_ACCEPT_DATA_LOSS: "1" });
check("preview có DB riêng: PRISMA_ACCEPT_DATA_LOSS bị bỏ qua — xoá cột vẫn từ chối", pd.status === 1 && pd.calls.length === 1 && !pd.calls[0].includes("--accept-data-loss"), pd);

await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
