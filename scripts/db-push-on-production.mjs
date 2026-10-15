// Chỉ chạy `prisma db push` khi deploy TARGET production.
//
// Lý do (BE-079/081 chốt 06/10/2026): preview và production dùng chung DB
// Neon, nên trước đây mỗi preview build đẩy schema của nhánh đó thẳng lên DB
// production — mở PR cũ sau một PR schema mới sẽ xoá cột PR mới vừa thêm.
// Chuyển sang: chỉ production chạy `db push`; preview chỉ `next build`, đọc
// được DB production ở runtime nhưng không được sửa schema của nó.
//
// Cách Vercel đặt biến môi trường: VERCEL_ENV="production"|"preview"|
// "development". Ngoài Vercel (local, CI khác) → coi là production (giữ hành
// vi cũ cho `npm run build` chạy từ máy dev).

import { spawnSync } from "node:child_process";
import { onlyUniqueConstraintAdditions } from "./db-push-guard.mjs";

// Ngoại lệ duy nhất: bản xem trước có CƠ SỞ DỮ LIỆU RIÊNG (13/10/2026). Khi đã tạo một nhánh Neon riêng cho Preview và đặt
// DATABASE_URL (chỉ phạm vi Preview) trỏ vào đó, đặt thêm PREVIEW_OWN_DB=1 (cũng chỉ phạm vi Preview) thì preview build mới
// `prisma db push` — vào nhánh riêng đó, không phải DB production. KHÔNG BAO GIỜ đặt PREVIEW_OWN_DB=1 khi DATABASE_URL của preview
// còn là DB production. Lưới an toàn: ở preview luôn bỏ qua PRISMA_ACCEPT_DATA_LOSS, nên lỡ trỏ nhầm thì lệnh sẽ từ chối
// mọi thay đổi làm mất dữ liệu (xoá cột/bảng) thay vì thực hiện.
const env = process.env.VERCEL_ENV;
const previewOwnDb = env === "preview" && process.env.PREVIEW_OWN_DB === "1";
if (env && env !== "production" && !previewOwnDb) {
  console.log(`[build] VERCEL_ENV=${env} → bỏ qua prisma db push (chỉ production được ghi schema).`);
  process.exit(0);
}
if (previewOwnDb) console.log("[build] preview có DB riêng (PREVIEW_OWN_DB=1) → chạy prisma db push vào DB đó (không cho phép mất dữ liệu).");

// `prisma db push` mặc định từ chối khi có cột/bảng bị drop để không mất
// dữ liệu bất ngờ. Khi chủ ý xoá (như đã chốt với Sales Bot — xoá hẳn 2
// bảng sales_leads/sales_messages), set env `PRISMA_ACCEPT_DATA_LOSS=1`
// trên Vercel production. Flag này nguy hiểm — sau khi lần drop đã xong,
// nên gỡ env để các lần sau an toàn (lỡ xoá cột là mất dữ liệu luôn).
const args = ["prisma", "db", "push"];
if (!previewOwnDb && process.env.PRISMA_ACCEPT_DATA_LOSS === "1") {
  console.log("[build] ⚠ PRISMA_ACCEPT_DATA_LOSS=1 → cho phép drop cột/bảng.");
  args.push("--accept-data-loss");
}

// Chạy và in lại đúng những gì Prisma in (cần đọc kết quả để biết vì sao nó từ chối).
function push(argv) {
  const res = spawnSync("npx", argv, { encoding: "utf8" });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res;
}

let r = push(args);

// Ngoại lệ hẹp (15/10/2026, PR #54): thêm `@unique` vào cột mới làm Prisma từ chối với cảnh báo "mất dữ liệu" dù KHÔNG mất gì (trùng giá trị thì
// chính lệnh ALTER TABLE tự thất bại). Chỉ khi MỌI cảnh báo đều thuộc loại đó mới chạy lại với --accept-data-loss; một cảnh báo khác (xoá
// cột/bảng, đổi kiểu...) thì vẫn từ chối như cũ và vẫn phải đặt PRISMA_ACCEPT_DATA_LOSS=1 bằng tay. Xem scripts/db-push-guard.mjs.
if (r.status !== 0 && !args.includes("--accept-data-loss") && onlyUniqueConstraintAdditions(`${r.stdout ?? ""}\n${r.stderr ?? ""}`)) {
  console.log("[build] Chỉ có cảnh báo 'thêm ràng buộc duy nhất' (không xoá/sửa dữ liệu nào) → chạy lại với --accept-data-loss.");
  r = push([...args, "--accept-data-loss"]);
}
process.exit(r.status ?? 0);
