// HP-31 — bằng chứng schema CHỈ THÊM cho gói buổi: bỏ hai model mới (SessionPackage, SessionPackageUse) và dòng quan hệ ngược ở Course khỏi schema hiện tại để dựng
// "schema trước HP-31", rồi `prisma migrate diff` sang schema hiện tại: chỉ được CREATE TABLE / CREATE INDEX / khoá ngoại của CHÍNH hai bảng mới. Không cần DB.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, section, done } from "./h";

(async () => {
  const cur = readFileSync("prisma/schema.prisma", "utf8");
  const strip = (src: string, model: string) => src.replace(new RegExp(`(?:^//[^\\n]*\\n)*model ${model} \\{[\\s\\S]*?\\n\\}\\n`, "m"), "");
  let base = strip(strip(cur, "SessionPackageUse"), "SessionPackage");
  base = base.replace(/^[ \t]*sessionPackages[ \t]+SessionPackage\[\][^\n]*\n/m, "");
  check("dựng được schema 'trước HP-31' (không còn model/quan hệ của gói)", !/model SessionPackage/.test(base) && !/sessionPackages/.test(base) && /model SessionPackage \{/.test(cur));
  const dir = mkdtempSync(join(tmpdir(), "sp-schema-"));
  const baseFile = join(dir, "base.prisma");
  writeFileSync(baseFile, base);
  const sql = execFileSync("npx", ["prisma", "migrate", "diff", "--from-schema", baseFile, "--to-schema", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
  const stmts = sql.split(/;\s*\n/).map(s => s.replace(/--.*$/gm, "").trim()).filter(Boolean);

  section(`Schema HP-31 so với trước đó: ${stmts.length} câu lệnh`);
  check("có thay đổi", stmts.length > 0);
  check("không DROP / đổi kiểu / RENAME / SET NOT NULL", !stmts.some(s => /\bDROP\b|ALTER COLUMN|RENAME|SET NOT NULL|SET DATA TYPE/i.test(s)));
  check("mọi câu là CREATE TABLE / CREATE INDEX / ADD CONSTRAINT khoá ngoại", stmts.every(s => /^(CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE .* ADD CONSTRAINT .* FOREIGN KEY)/is.test(s)), stmts.filter(s => !/^(CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE .* ADD CONSTRAINT .* FOREIGN KEY)/is.test(s)));
  const tables = stmts.filter(s => /^CREATE TABLE/i.test(s)).map(s => /CREATE TABLE "([^"]+)"/.exec(s)![1]).sort();
  check("chỉ đúng hai bảng MỚI", tables.join() === "session_package_uses,session_packages", tables);
  check("mọi câu chạm đúng hai bảng mới (không động bảng cũ nào, kể cả cột)", stmts.every(s => /session_packages|session_package_uses/.test(s.split("\n")[0]) || /"session_packages?"|"session_package_uses"/.test(s)));
  check("UNIQUE chỉ nằm trên bảng MỚI (recordId của sổ trừ buổi)", stmts.filter(s => /CREATE UNIQUE INDEX/i.test(s)).every(s => /ON "session_package_uses"/.test(s)));
  check("không câu ALTER TABLE nào trên bảng cũ (kể cả courses)", !stmts.some(s => /^ALTER TABLE "(?!session_package)/i.test(s)));
  await done();
})();
