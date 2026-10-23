// Học phí (HP-14..HP-32) — bằng chứng schema CHỈ THÊM: so schema nhánh này với schema lúc bắt đầu (commit gốc e4fb4df) bằng `prisma migrate diff`
// rồi kiểm SQL sinh ra: chỉ CREATE TABLE / CREATE INDEX / ADD COLUMN; không DROP, không đổi kiểu, không NOT NULL thiếu mặc định,
// không UNIQUE mới trên bảng đã có. Không cần DB (so hai tệp schema). Chạy từ gốc kho mã.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, section, done } from "./h";

const BASE_COMMIT = "e4fb4df";
(async () => {
  const dir = mkdtempSync(join(tmpdir(), "schema-"));
  const baseFile = join(dir, "base.prisma");
  writeFileSync(baseFile, execFileSync("git", ["show", `${BASE_COMMIT}:prisma/schema.prisma`], { encoding: "utf8" }));
  const sql = execFileSync("npx", ["prisma", "migrate", "diff", "--from-schema", baseFile, "--to-schema", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
  const stmts = sql.split(/;\s*\n/).map(s => s.replace(/--.*$/gm, "").trim()).filter(Boolean);

  section(`Schema so với ${BASE_COMMIT}: ${stmts.length} câu lệnh`);
  check("có thay đổi (không rỗng)", stmts.length > 0);
  check("không DROP bất cứ thứ gì", !stmts.some(s => /\bDROP\b/i.test(s)), stmts.filter(s => /DROP/i.test(s)));
  check("không đổi kiểu cột (ALTER COLUMN … TYPE) / không SET NOT NULL / không RENAME", !stmts.some(s => /ALTER COLUMN|RENAME|SET NOT NULL|SET DATA TYPE/i.test(s)));
  check("mọi câu là CREATE TABLE / CREATE INDEX / ALTER TABLE … ADD COLUMN", stmts.every(s => /^(CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE .* ADD COLUMN|ALTER TABLE .* ADD CONSTRAINT .* FOREIGN KEY)/is.test(s)), stmts.filter(s => !/^(CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE .* ADD COLUMN|ALTER TABLE .* ADD CONSTRAINT .* FOREIGN KEY)/is.test(s)));
  const addCols = stmts.filter(s => /ADD COLUMN/i.test(s));
  check("mọi cột thêm vào bảng cũ đều cho phép null hoặc có mặc định", addCols.every(s => !/NOT NULL/i.test(s) || /DEFAULT/i.test(s)), addCols);
  check("không UNIQUE INDEX mới trên bảng ĐÃ CÓ dữ liệu", !stmts.some(s => /CREATE UNIQUE INDEX/i.test(s) && !/ON "(course_fee_rates|course_student_rates|fee_charges|student_discounts)"/.test(s)), stmts.filter(s => /UNIQUE/i.test(s)));
  const created = stmts.filter(s => /^CREATE TABLE/i.test(s)).map(s => /CREATE TABLE "(\w+)"/.exec(s)![1]).sort();
  check("bảng mới đúng danh sách dự kiến", created.join() === ["course_fee_rates", "course_student_rates", "fee_charges", "payment_reversals", "student_discounts"].join(), created);
  check("cột thêm vào bảng cũ chỉ gồm bank_transactions.method và courses.feeMode", addCols.map(s => /ALTER TABLE "(\w+)" ADD COLUMN\s+"(\w+)"/.exec(s)!.slice(1).join(".")).sort().join() === "bank_transactions.method,courses.feeMode");
  await done();
})();
