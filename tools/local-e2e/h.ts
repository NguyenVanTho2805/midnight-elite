// Helper test cục bộ (gitignored). Chạy: source scratchpad/env.sh && npx tsx scratchpad/t-*.ts
import { encrypt } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const BASE = process.env.BASE ?? "http://localhost:3100";
let counter = 0;
const stamp = Date.now().toString(36);

export type TUser = { id: string; role: "student" | "admin"; adminRole?: "admin_super" | "admin_content" | "teacher"; email: string; name: string };

export async function mkUser(o: {
  name?: string; role?: "student" | "admin"; adminRole?: TUser["adminRole"];
  tutorVerified?: boolean; emailVerified?: boolean;
} = {}): Promise<TUser> {
  counter++;
  const role = o.role ?? "student";
  const email = `u${counter}-${stamp}@test.local`;
  const u = await prisma.user.create({
    data: {
      name: o.name ?? `User ${counter}`, email,
      password: await bcrypt.hash("Passw0rd!", 4),
      role, adminRole: o.adminRole ?? null,
      emailVerified: o.emailVerified ?? true,
      tutorVerified: o.tutorVerified ?? false,
    },
  });
  return { id: u.id, role, adminRole: o.adminRole, email, name: u.name };
}
export const mkTutor = (name = "Gia sư") => mkUser({ name, role: "admin", adminRole: "teacher", tutorVerified: true });
export const mkSuper = (name = "Admin") => mkUser({ name, role: "admin", adminRole: "admin_super" });

let courseSeq = 0;
export async function mkCourse(ownerId: string | null, o: { name?: string; capacity?: number | null; classStatus?: string } = {}) {
  courseSeq++;
  const id = `lop-${stamp}-${courseSeq}`;
  return prisma.course.create({
    data: {
      id, adminId: Number(Date.now() % 1_000_000_000) + courseSeq, name: o.name ?? `Lớp ${courseSeq}`, adminName: o.name ?? `Lớp ${courseSeq}`,
      shortTitle: o.name ?? `Lớp ${courseSeq}`, category: "toan", instructor: "GV", teacherAvatar: "", openDate: "2026-09-01",
      types: [], bg: "#fff", price: 0, createdAt: new Date().toISOString(), ownerId,
      capacity: o.capacity ?? null, classStatus: o.classStatus ?? "open",
    },
  });
}

/**
 * ĐX-00: một phiên điểm danh kèm một bản ghi cho MỖI trạng thái trong `statuses` (mỗi bản ghi một học sinh mới).
 * Mặc định ["present"] = buổi ĐÃ DẠY theo src/lib/taughtSessions.ts; `[]` = phiên rỗng; ["excused"] = chỉ có phép (không tính).
 * Dùng thay cho `prisma.attendanceSession.create` ở những test kiểm số "buổi đã dạy", vì phiên trần không còn được đếm.
 */
export async function mkAttendanceSession(courseId: string, createdBy: string, date: Date, statuses: string[] = ["present"]) {
  const s = await prisma.attendanceSession.create({ data: { courseId, date, createdBy } });
  for (const status of statuses) {
    const stu = await mkUser({ name: "Học sinh điểm danh" });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: stu.id, status } });
  }
  return s;
}

export async function cookieFor(u: TUser) {
  return `midnight_session=${await encrypt({ userId: u.id, role: u.role, adminRole: u.adminRole })}`;
}

export async function api(method: string, path: string, o: { as?: TUser; body?: unknown; headers?: Record<string, string>; raw?: BodyInit } = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.as) headers["cookie"] = await cookieFor(o.as);
  let body: BodyInit | undefined = o.raw;
  if (o.body !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(o.body); }
  const res = await fetch(BASE + path, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* html/csv */ }
  return { status: res.status, json, text, headers: res.headers };
}

export async function wipe() {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`select tablename::text as tablename from pg_tables where schemaname='public'`);
  const names = rows.map(r => `"${r.tablename}"`).join(",");
  if (names) await prisma.$executeRawUnsafe(`truncate table ${names} restart identity cascade`);
}

let pass = 0, fail = 0;
export function check(name: string, cond: unknown, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); }
}
// Chờ tới khi điều kiện đúng (tối đa ms) — dùng cho kiểm tra DOM sau thao tác bất đồng bộ.
export async function eventually(name: string, fn: () => Promise<unknown> | unknown, ms = 10000) {
  const end = Date.now() + ms; let last: unknown;
  while (Date.now() < end) {
    try { last = await fn(); if (last) { check(name, true); return; } } catch (e) { last = String(e); }
    await new Promise(r => setTimeout(r, 200));
  }
  check(name, false, last);
}
export function section(t: string) { console.log(`\n▸ ${t}`); }
export async function done() {
  console.log(`\n${pass} pass / ${fail} fail`);
  await prisma.$disconnect?.();
  process.exit(fail ? 1 : 0);
}
