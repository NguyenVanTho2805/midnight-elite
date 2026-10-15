// Sinh DDL Postgres từ prisma/schema.prisma qua DMMF (không cần schema-engine — máy này bị chặn tải engine).
// Chỉ dùng cho DB THỬ cục bộ. Unsupported("vector(768)") → domain "vector" trên text (không có pgvector ở máy test).
// Cần @prisma/internals cùng phiên bản Prisma (cài ngoài repo, không thêm vào package.json):
//   npm i --prefix /tmp/prisma-internals @prisma/internals@7.8.0
// Dùng: node ddl.mjs <schema.prisma> /tmp/prisma-internals/node_modules > schema.sql
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { getDMMF } = createRequire(path.join(process.argv[3], "noop.js"))("@prisma/internals");
const schemaPath = process.argv[2];
const datamodel = readFileSync(schemaPath, "utf8");
const dmmf = await getDMMF({ datamodel });
const dm = dmmf.datamodel;

const q = s => `"${s}"`;
const enumDb = new Map(dm.enums.map(e => [e.name, e.dbName ?? e.name]));
const modelByName = new Map(dm.models.map(m => [m.name, m]));
const tableOf = m => m.dbName ?? m.name;
const colOf = f => f.dbName ?? f.name;

function sqlType(f) {
  if (f.kind === "enum") return q(enumDb.get(f.type)) + (f.isList ? "[]" : "");
  const native = f.nativeType?.[0];
  let t;
  switch (f.type) {
    case "String": t = native === "VarChar" && f.nativeType[1]?.length ? `varchar(${f.nativeType[1][0]})` : "text"; break;
    case "Int": t = "integer"; break;
    case "BigInt": t = "bigint"; break;
    case "Float": t = "double precision"; break;
    case "Decimal": t = "decimal(65,30)"; break;
    case "Boolean": t = "boolean"; break;
    case "DateTime": t = native === "Date" ? "date" : "timestamp(3)"; break;
    case "Json": t = "jsonb"; break;
    case "Bytes": t = "bytea"; break;
    default: throw new Error(`Kiểu lạ ${f.type} ở ${f.name}`);
  }
  return t + (f.isList ? "[]" : "");
}

function sqlLiteral(v, f) {
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'` + (f.kind === "enum" ? `::${q(enumDb.get(f.type))}` : "");
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function defaultSql(f) {
  const d = f.default;
  if (d === undefined) return null;
  if (Array.isArray(d)) return d.length ? `ARRAY[${d.map(x => sqlLiteral(x, f)).join(",")}]::${sqlType(f)}` : `'{}'`;
  if (d && typeof d === "object") {
    if (d.name === "now") return "CURRENT_TIMESTAMP";
    if (d.name === "dbgenerated") return d.args?.[0] ?? null;
    return null; // cuid / uuid / autoincrement xử lý riêng
  }
  return sqlLiteral(d, f);
}

const out = [];
out.push(`DO $$ BEGIN CREATE DOMAIN vector AS text; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
for (const e of dm.enums) out.push(`CREATE TYPE ${q(e.dbName ?? e.name)} AS ENUM (${e.values.map(v => `'${v.dbName ?? v.name}'`).join(", ")});`);

const fks = [];
const joins = new Map();
for (const m of dm.models) {
  const cols = [];
  for (const f of m.fields) {
    if (f.kind === "object") {
      if (f.relationFromFields?.length) {
        const target = modelByName.get(f.type);
        const onDelete = { Cascade: "CASCADE", SetNull: "SET NULL", Restrict: "RESTRICT", NoAction: "NO ACTION", SetDefault: "SET DEFAULT" }[f.relationOnDelete]
          ?? (f.isRequired ? "RESTRICT" : "SET NULL");
        const fromCols = f.relationFromFields.map(n => q(colOf(m.fields.find(x => x.name === n))));
        const toCols = f.relationToFields.map(n => q(colOf(target.fields.find(x => x.name === n))));
        fks.push(`ALTER TABLE ${q(tableOf(m))} ADD FOREIGN KEY (${fromCols.join(", ")}) REFERENCES ${q(tableOf(target))} (${toCols.join(", ")}) ON DELETE ${onDelete} ON UPDATE CASCADE;`);
      } else if (f.isList) {
        // quan hệ nhiều-nhiều ngầm: cả hai phía đều là danh sách, không phía nào giữ khoá
        const other = modelByName.get(f.type).fields.find(x => x.relationName === f.relationName && x !== f);
        if (other?.isList && !other.relationFromFields?.length) {
          const [a, b] = [m.name, f.type].sort();
          joins.set(f.relationName, { a, b });
        }
      }
      continue;
    }
    let type = sqlType(f);
    const def = f.default && typeof f.default === "object" && !Array.isArray(f.default) ? f.default.name : null;
    if (def === "autoincrement") type = f.type === "BigInt" ? "bigserial" : "serial";
    let c = `${q(colOf(f))} ${type}`;
    if (f.isRequired && !f.isList) c += " NOT NULL";
    const ds = defaultSql(f);
    if (ds) c += ` DEFAULT ${ds}`;
    cols.push(c);
  }
  // cột Unsupported không có trong DMMF — thêm tay
  if (/^\s*embedding\s+Unsupported/m.test(datamodel.split(`model ${m.name} {`)[1]?.split("\n}")[0] ?? "")) cols.push(`"embedding" vector`);
  const idFields = m.primaryKey?.fields?.length ? m.primaryKey.fields : m.fields.filter(f => f.isId).map(f => f.name);
  if (idFields.length) cols.push(`PRIMARY KEY (${idFields.map(n => q(colOf(m.fields.find(x => x.name === n)))).join(", ")})`);
  for (const f of m.fields) if (f.isUnique) cols.push(`UNIQUE (${q(colOf(f))})`);
  for (const u of m.uniqueFields ?? []) cols.push(`UNIQUE (${u.map(n => q(colOf(m.fields.find(x => x.name === n)))).join(", ")})`);
  out.push(`CREATE TABLE ${q(tableOf(m))} (\n  ${cols.join(",\n  ")}\n);`);
}
for (const [name, { a, b }] of joins) {
  const ta = modelByName.get(a), tb = modelByName.get(b);
  const ida = ta.fields.find(f => f.isId), idb = tb.fields.find(f => f.isId);
  out.push(`CREATE TABLE ${q("_" + name)} ("A" ${sqlType(ida)} NOT NULL REFERENCES ${q(tableOf(ta))} ON DELETE CASCADE, "B" ${sqlType(idb)} NOT NULL REFERENCES ${q(tableOf(tb))} ON DELETE CASCADE, UNIQUE ("A","B"));`);
}
out.push(...fks);
console.log(out.join("\n"));
