// BU-08 mục 4.4 — phần có I/O của các loại hàng chờ tùy nhánh chưa gộp. Chạy được trên `main` khi chưa có model/cột:
// `externalSupport()` dò theo bản sinh Prisma; chưa có thì mọi hàm ở đây trả rỗng/0 và KHÔNG chạm tới model không tồn tại.
// Truy vấn đi qua kiểu hẹp (cùng mẫu api/admin/topups/route.ts) và mọi hàng thô qua hàm kiểm dạng trước khi dựng dòng.
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { JOIN_SLOW_DAYS, type GuestRep, type JoinRep } from "@/lib/adminQueue";
import { detectExternal, toGuestRep, toJoinRep, isJoinGroupRow, type ExternalSupport } from "@/lib/adminQueueExternal";

type LooseDelegate = {
  findMany(a: unknown): Promise<unknown[]>;
  count(a: unknown): Promise<number>;
  groupBy(a: unknown): Promise<unknown[]>;
};
const delegate = (name: string) => (prisma as unknown as Record<string, LooseDelegate>)[name];

let cached: ExternalSupport | null = null;
/** Dò theo định nghĩa trong bản sinh (không try/catch lúc truy vấn). */
export function externalSupport(): ExternalSupport {
  return (cached ??= detectExternal(Prisma.ModelName as Record<string, string>, Prisma.ThreadScalarFieldEnum as Record<string, string>));
}

/** `User.deletedAt` (ẩn học sinh) là của ADM-001/#92. Có cột thì lọc, chưa có thì không lọc — không cần sửa lại mã khi #92 gộp. */
export function userNotHiddenWhere(): Record<string, unknown> {
  return Object.prototype.hasOwnProperty.call(Prisma.UserScalarFieldEnum, "deletedAt") ? { deletedAt: null } : {};
}

const guestWhere = { status: "pending", guestName: { not: null }, deletedAt: null };

export async function countGuestQuestions(): Promise<number | null> {
  if (!externalSupport().guestQuestions) return null;
  return delegate("thread").count({ where: guestWhere });
}
export async function loadGuestQuestions(take: number, afterAt: Date | null): Promise<GuestRep[]> {
  if (!externalSupport().guestQuestions) return [];
  const rows = await delegate("thread").findMany({
    where: { ...guestWhere, ...(afterAt ? { createdAt: { gte: afterAt } } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take,
  });
  return rows.map(toGuestRep).filter((r): r is GuestRep => r !== null);
}

const pendingJoin = { status: "pending" };
async function joinGroups(): Promise<unknown[]> {
  return delegate("classJoinRequest").groupBy({ by: ["courseId"], where: pendingJoin, _count: { _all: true }, _min: { createdAt: true } });
}
/** Số LỚP đang có yêu cầu chờ (mỗi lớp một dòng). */
export async function countJoinCourses(): Promise<number | null> {
  if (!externalSupport().joinRequests) return null;
  return (await joinGroups()).filter(isJoinGroupRow).length;
}
export async function loadJoinCourses(): Promise<JoinRep[]> {
  if (!externalSupport().joinRequests) return [];
  const groups = (await joinGroups()).filter(isJoinGroupRow);
  if (groups.length === 0) return [];
  const courses = await prisma.course.findMany({ where: { id: { in: groups.map(g => g.courseId) } }, select: { id: true, name: true, owner: { select: { name: true } } } });
  const by = new Map(courses.map(c => [c.id, { name: c.name, ownerName: c.owner?.name ?? null }]));
  return groups.map(g => toJoinRep(g, by)).filter((r): r is JoinRep => r !== null);
}
/** Số lớp có yêu cầu chờ từ JOIN_SLOW_DAYS ngày trở lên (cho "Hôm nay"). */
export async function countSlowJoinCourses(now: Date): Promise<number | null> {
  if (!externalSupport().joinRequests) return null;
  const cut = now.getTime() - JOIN_SLOW_DAYS * 86_400_000;
  return (await joinGroups()).filter(isJoinGroupRow).filter(g => new Date(g._min.createdAt).getTime() <= cut).length;
}
