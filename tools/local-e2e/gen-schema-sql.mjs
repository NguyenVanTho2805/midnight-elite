// Sinh DDL (SQL tạo toàn bộ bảng) từ prisma/schema.prisma bằng engine schema BẢN WASM — dùng khi máy chặn tải engine nhị phân của Prisma (binaries.prisma.sh → 403),
// tức `prisma db push` / `prisma migrate diff` không chạy được. Engine WASM chạy bằng Node thuần, chỉ cần kết nối tới một Postgres (không đụng dữ liệu).
//
// Chạy (trong một thư mục tạm, KHÔNG thêm vào package.json của dự án):
//   mkdir /tmp/se && cd /tmp/se && npm init -y && npm i @prisma/schema-engine-wasm@<đúng phiên bản trong node_modules/prisma/package.json> @prisma/adapter-pg@7.8.0 @prisma/driver-adapter-utils@7.8.0 pg
//   cp <repo>/tools/local-e2e/gen-schema-sql.mjs . && node gen-schema-sql.mjs <repo>/prisma/schema.prisma postgresql://postgres:<mk>@localhost:5432/kin_test schema.sql
// rồi: sed 's/vector(768)/text/g' schema.sql | psql ...   (pgvector thường không có ở máy test; cột embedding chỉ dùng cho "giống nghĩa", xem README).
// Phiên bản schema-engine-wasm của Prisma 7.8.0: 7.8.0-6.3c6e192761c0362d496ed980de936e2f3cebcd3a.
// Ghi chú kỹ thuật đã gặp: SchemaEngine.new nhận FACTORY đã bọc bằng bindMigrationAwareSqlAdapterFactory (không phải adapter đã connect()).
import fs from "node:fs";
import { SchemaEngine } from "@prisma/schema-engine-wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { bindMigrationAwareSqlAdapterFactory } from "@prisma/driver-adapter-utils";

const [schemaPath, url, out] = process.argv.slice(2);
if (!schemaPath || !url || !out) { console.error("Dùng: node gen-schema-sql.mjs <schema.prisma> <postgres-url> <out.sql>"); process.exit(2); }
const schema = fs.readFileSync(schemaPath, "utf8");
const adapter = bindMigrationAwareSqlAdapterFactory(new PrismaPg({ connectionString: url }));
const eng = await SchemaEngine.new({ datamodels: [["schema.prisma", schema]] }, () => {}, adapter);
const res = await eng.diff({ from: { tag: "empty" }, to: { tag: "schemaDatamodel", files: [{ path: "schema.prisma", content: schema }] }, script: true, exitCode: null, filters: { externalTables: [], externalEnums: [] } });
fs.writeFileSync(out, res.stdout ?? "");
console.log(`đã ghi ${out} (${String(res.stdout ?? "").length} byte)`);
process.exit(0);
