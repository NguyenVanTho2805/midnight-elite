// BU-08 mục 4.4-5 — tài khoản hệ thống của khách (`khach@he-thong.kin.invalid`) không lọt danh sách / số đếm học sinh.
// Gieo bằng prisma (không cần model BU-05). CHƯA CHẠY ĐƯỢC ở máy dựng (cần Next dev + Postgres thử) — COO chạy tuần tự.
// Ca phá cố ý: bỏ NOT_SYSTEM_ACCOUNT khỏi GET /api/admin/students (cả list lẫn count) → mọi ca đỏ.
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkSuper, wipe, check, section, done } from "./h";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const hs1 = await mkUser({ name: "Học sinh Một" }), hs2 = await mkUser({ name: "Học sinh Hai" });
  const mk = async (email: string) => prisma.user.create({ data: { name: "Khách ẩn danh", email, password: await bcrypt.hash("x", 4), role: "student", banned: true, emailVerified: true } });
  await mk("khach@he-thong.kin.invalid");
  await mk("KHACH2@HE-THONG.KIN.INVALID");
  const lookalike = await prisma.user.create({ data: { name: "Học sinh giống đuôi", email: "x@he-thong.kin.invalid.vn", password: await bcrypt.hash("x", 4), role: "student", emailVerified: true } });

  section("GET /api/admin/students");
  const r = await api("GET", "/api/admin/students", { as: SA });
  const emails = (Array.isArray(r.json) ? r.json : r.json.data as any[]).map(s => String(s.email ?? "").toLowerCase());
  check("200; không có tài khoản hệ thống (cả chữ hoa); còn học sinh thật và email 'giống đuôi' nhưng khác tên miền", r.status === 200 && !emails.some(e => e.endsWith("@he-thong.kin.invalid")) && emails.includes(hs1.email.toLowerCase()) && emails.includes(hs2.email.toLowerCase()) && emails.includes(lookalike.email.toLowerCase()), emails);
  const p = await api("GET", "/api/admin/students?page=1&limit=1", { as: SA });
  check("phân trang: `total` không đếm tài khoản hệ thống (hs1 + hs2 + giống đuôi = 3, không 5)", p.status === 200 && p.json.total === 3, p.json?.total);
  const hn = await api("GET", "/api/admin/hom-nay", { as: SA });
  check("Hôm nay: stats.students = 3 (hs1, hs2, giống đuôi), không đếm 2 tài khoản hệ thống", hn.json.stats.students === 3, hn.json.stats);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
