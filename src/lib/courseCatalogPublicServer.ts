// CAT-01 — đọc danh mục khoá học công khai cho trang máy chủ /khoa-hoc. Chỉ `select` trường cần: KHÔNG lấy link nhóm Zalo / link học online / tên nội bộ / chủ lớp.
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { orderCategoryNames, toPublicCard, type PublicCard } from "@/lib/courseCatalogPublic";

export async function loadPublicCatalog(): Promise<{ cards: PublicCard[]; categories: string[] }> {
  const [courses, catRows, counts] = await Promise.all([
    prisma.course.findMany({
      where: { status: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, name: true, category: true, instructor: true, teacherAvatar: true, lessons: true, hours: true,
        price: true, originalPrice: true, tag: true, tagColor: true, capacity: true, classStatus: true,
      },
    }),
    prisma.courseCategory.findMany({ select: { name: true, sortOrder: true } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { status: ENROLLMENT_STATUS.ACTIVE }, _count: { _all: true } }),
  ]);
  const enrolledOf = new Map(counts.map(g => [g.courseId, g._count._all]));
  const cards = courses.map(c => toPublicCard(c, enrolledOf.get(c.id) ?? 0));
  return { cards, categories: orderCategoryNames(catRows, cards.map(c => c.category)) };
}
