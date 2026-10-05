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

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`[build] VERCEL_ENV=${env} → bỏ qua prisma db push (chỉ production được ghi schema).`);
  process.exit(0);
}

const r = spawnSync("npx", ["prisma", "db", "push"], { stdio: "inherit" });
process.exit(r.status ?? 0);
