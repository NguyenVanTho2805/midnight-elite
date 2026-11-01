// BU-06 — phần CHẠM DB của tìm gia sư. Dùng chung cho GET /api/tutors và GET /api/tutors/suggest để hai nơi không lệch nhau.
// Phần thuần (lọc, sắp, trang, facet, gợi ý) nằm ở src/lib/tutorSearch.ts.
//
// Điều kiện hiện gia sư (A7): role=admin, adminRole=teacher, tutorVerified=true, banned=false, profileLockedAt=null, và không ẨN hồ sơ (NC2-022).
// Mọi điều kiện SQL là so sánh bằng trên cột không-null hoặc `null` tường minh. KHÔNG có điều kiện phủ định nào xuống SQL (bẫy `NOT (col = x)` loại NULL):
// lọc "ẩn hồ sơ"/khu vực/giá làm trong bộ nhớ.
import type { prisma as PrismaClient } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { taughtSessionWhere } from "@/lib/taughtSessions";
import { recentTaughtSessionWhere } from "@/lib/tutorActivity";
import { publicArea } from "@/lib/tutorArea";
import { isProfileHidden } from "@/lib/tutorVisibility";
import { readPreferences } from "@/lib/userPreferences";
import type { SearchableTutor, TutorListItem } from "@/lib/tutorSearch";

type Db = typeof PrismaClient;

export type TutorBase = Omit<SearchableTutor, "classCount" | "studentCount" | "sessionsTaught" | "recentlyActive" | "rating">;
export type TutorAggregate = Pick<TutorListItem, "classCount" | "studentCount" | "sessionsTaught" | "recentlyActive" | "rating">;
const EMPTY_AGG: TutorAggregate = { classCount: 0, studentCount: 0, sessionsTaught: 0, recentlyActive: false, rating: { avg: null, total: 0 } };

/** Gia sư hiển thị công khai (chưa có số liệu): đã duyệt, không khoá, không ẩn; kèm khu vực công khai (`publicArea`). */
export async function loadVisibleTutors(db: Db): Promise<TutorBase[]> {
  const rows = await db.user.findMany({
    where: { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, profileLockedAt: null },
    select: { id: true, name: true, avatarBase64: true, bio: true, subjects: true, tutorVerified: true, tutorVerifiedAt: true, city: true, preferences: true },
  });
  const out: TutorBase[] = [];
  for (const t of rows) {
    const prefs = readPreferences(t.preferences);
    if (isProfileHidden(prefs)) continue;
    out.push({
      id: t.id, name: t.name, avatarBase64: t.avatarBase64, bio: t.bio, subjects: t.subjects ?? [], tutorVerified: t.tutorVerified,
      area: publicArea(t.city, prefs.teaching), verifiedAtMs: t.tutorVerifiedAt ? t.tutorVerifiedAt.getTime() : null,
    });
  }
  return out;
}

/**
 * Số liệu tự động cho các gia sư `ids`: chỉ lớp `status:true` (cùng công thức với /api/tutors/[id] — sửa lệch A5).
 * Cố định 6 truy vấn, không N+1. Gia sư không có lớp → số 0.
 */
export async function loadTutorAggregates(db: Db, ids: string[]): Promise<Map<string, TutorAggregate>> {
  const result = new Map<string, TutorAggregate>();
  if (ids.length === 0) return result;

  const courses = await db.course.findMany({ where: { ownerId: { in: ids }, status: true }, select: { id: true, ownerId: true } });
  const owner = new Map<string, string>();
  for (const c of courses) if (c.ownerId) owner.set(c.id, c.ownerId);
  const courseIds = [...owner.keys()];

  const [enrollRows, reviewRows, taughtRows, recentRows] = courseIds.length === 0 ? [[], [], [], []] as const : await Promise.all([
    db.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: ENROLLMENT_STATUS.ACTIVE }, _count: { _all: true } }),
    db.courseReview.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: "approved" }, _avg: { rating: true }, _count: { _all: true } }),
    db.attendanceSession.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, ...taughtSessionWhere() }, _count: { _all: true } }),
    db.attendanceSession.findMany({ where: { courseId: { in: courseIds }, ...recentTaughtSessionWhere() }, select: { courseId: true }, distinct: ["courseId"] }),
  ]);

  const get = (id: string): TutorAggregate => {
    let a = result.get(id);
    if (!a) { a = { ...EMPTY_AGG, rating: { avg: null, total: 0 } }; result.set(id, a); }
    return a;
  };
  for (const id of ids) get(id);
  for (const o of owner.values()) get(o).classCount++;
  for (const r of enrollRows) { const o = owner.get(r.courseId); if (o) get(o).studentCount += r._count._all; }
  for (const r of taughtRows) { const o = owner.get(r.courseId); if (o) get(o).sessionsTaught += r._count._all; }
  for (const r of recentRows) { const o = owner.get(r.courseId); if (o) get(o).recentlyActive = true; }
  // Điểm trung bình theo gia sư, có trọng số theo số đánh giá (giữ tương thích; giao diện mới không hiện).
  const sum = new Map<string, number>();
  for (const r of reviewRows) {
    const o = owner.get(r.courseId);
    if (!o || r._avg.rating == null) continue;
    sum.set(o, (sum.get(o) ?? 0) + r._avg.rating * r._count._all);
    get(o).rating.total += r._count._all;
  }
  for (const [o, s] of sum) { const a = get(o); a.rating.avg = a.rating.total > 0 ? s / a.rating.total : null; }
  return result;
}

/** Gia sư hiển thị + số liệu, sẵn cho `searchTutors`/`buildSuggestions`. */
export async function loadSearchableTutors(db: Db): Promise<SearchableTutor[]> {
  const base = await loadVisibleTutors(db);
  const agg = await loadTutorAggregates(db, base.map(t => t.id));
  return base.map(t => ({ ...t, ...(agg.get(t.id) ?? EMPTY_AGG) }));
}
