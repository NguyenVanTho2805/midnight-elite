// Chạy lần lượt mọi nhóm (mỗi nhóm seed lại DB giả trước), in bảng: tên test · đạt/đỏ · dòng lỗi.
// npm run test:ui  (cần máy chủ dev đang chạy — xem đầu tests-ui/lib.mjs)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thuMuc = path.dirname(fileURLToPath(import.meta.url));
const NHOM = ["chu-lop", "gv-toan", "gv-anh", "khach", "do-dac", "dang-nhap", "tai-khoan", "hoc-sinh"];
const chon = process.argv.slice(2);
const kq = path.join(os.tmpdir(), `bca-tests-ui-${process.pid}.jsonl`);
fs.rmSync(kq, { force: true });
for (const n of NHOM.filter((x) => !chon.length || chon.includes(x))) {
  console.log(`\n── ${n} ──`);
  spawnSync(process.execPath, [path.join(thuMuc, `${n}.mjs`)], { stdio: "inherit", env: { ...process.env, BCA_UI_KET_QUA: kq } });
}
const ds = fs.existsSync(kq) ? fs.readFileSync(kq, "utf8").trim().split("\n").filter(Boolean).map((x) => JSON.parse(x)) : [];
fs.rmSync(kq, { force: true });
console.log("\n| # | Nhóm | Tên test | Kết quả | Dòng lỗi |\n|---|---|---|---|---|");
ds.forEach((x, i) => console.log(`| ${i + 1} | ${x.nhom} | ${x.ten} | ${x.dat ? "đạt" : "ĐỎ"} | ${x.loi.replace(/\|/g, "\\|")} |`));
const dat = ds.filter((x) => x.dat).length;
console.log(`\nTổng: ${dat}/${ds.length} đạt, ${ds.length - dat} đỏ`);
process.exitCode = ds.length && dat === ds.length ? 0 : 1;
