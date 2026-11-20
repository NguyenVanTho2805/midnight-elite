// LOI-03 — phần có DB của "Lớp của tôi" (thư viện lớp) và phiếu "Hôm nay có lớp". Phần thuần: src/lib/studentLop.ts.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-03.md mục 3.2.
//
// Kiểm quyền nằm TRONG `where`: chỉ Enrollment của CHÍNH em với status "active" (đã nghỉ "suspended" / chờ phụ huynh "pending_consent" ⇒ không hiện)
// + Lesson.status = "published" (ĐÓNG KHI LẠ). KHÔNG lọc Course.status (Q2 đã chốt: lớp riêng ẩn khỏi danh mục vẫn có học sinh học).
// Chỉ `select` cột cần: không đọc giá, bg thô ra ngoài, link học liệu của bài cho thư viện, câu hỏi/đáp án/bài nộp.
import { prisma } from "@/lib/prisma";
import { PUBLISHED_ONLY } from "@/lib/lessonStatus";
import { coverImageOf } from "@/lib/tutorClassRoutes";
import {
  orderedLessonIds, lopProgress, hocTiep, lopTrangThai, giaSuLabel, chiaHomNay, vnWindow, vnDayTitle, docLinks, azotaLinks,
  lessonHref, baiTapHrefOf, HOM_NAY_DAYS, HOM_NAY_MAX_TODAY, HOM_NAY_MAX_UPCOMING,
  type ThuVienRow, type HomNayResp, type HomNayItem, type HomNayUpcomingItem, type TreeSection,
} from "@/lib/studentLop";

const ACTIVE = "active";

/** Thư viện lớp của học sinh: mỗi lớp đang học (active) một dòng, x/y/% và bài "Học tiếp" tính sẵn. Ba truy vấn, không N+1. */
export async function loadThuVienLop(userId: string): Promise<ThuVienRow[]> {
  const enrolls = await prisma.enrollment.findMany({
    where: { userId, status: ACTIVE },
    orderBy: [{ createdAt: "asc" }, { courseId: "asc" }],
    select: { course: { select: { id: true, name: true, category: true, instructor: true, bg: true } } },
  });
  if (enrolls.length === 0) return [];
  const courseIds = enrolls.map(e => e.course.id);

  // MỘT truy vấn cây cho mọi lớp. Chỉ bài Đã đăng ở mức DB; orderedLessonIds lọc lại lần nữa (ĐÓNG KHI LẠ).
  // Thứ tự `order` như /api/courses/[id]; thêm `id` để hoà thứ tự không đổi giữa hai lần gọi.
  const sections = await prisma.section.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      courseId: true,
      chapters: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          isImplicit: true,
          lessons: { where: PUBLISHED_ONLY, orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, title: true, status: true } },
        },
      },
    },
  });

  const treeByCourse = new Map<string, TreeSection[]>();
  const titleOf = new Map<string, string>();
  for (const s of sections) {
    const arr = treeByCourse.get(s.courseId) ?? [];
    arr.push({ id: s.id, chapters: s.chapters });
    treeByCourse.set(s.courseId, arr);
    for (const ch of s.chapters) for (const l of ch.lessons) titleOf.set(l.id, l.title);
  }
  const idsByCourse = new Map<string, string[]>();
  for (const cid of courseIds) idsByCourse.set(cid, orderedLessonIds(treeByCourse.get(cid) ?? []));
  const allIds = [...idsByCourse.values()].flat();

  // MỘT truy vấn tiến độ của chính em, chỉ trên các bài Đã đăng của các lớp này.
  const progress = allIds.length === 0 ? [] : await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: allIds } },
    select: { lessonId: true, completed: true, watchedSeconds: true },
  });
  const completed = new Set<string>();
  const watching = new Set<string>();
  for (const p of progress) {
    if (p.completed) completed.add(p.lessonId);
    else if (p.watchedSeconds > 0) watching.add(p.lessonId);
  }

  return enrolls.map(({ course }) => {
    const ids = idsByCourse.get(course.id) ?? [];
    const prog = lopProgress(ids, completed);
    // Học sinh đang học (active) ⇒ mọi bài mở khoá (như /api/courses/[id]) ⇒ không truyền `locked`.
    const ht = hocTiep(ids, completed, watching);
    return {
      id: course.id,
      name: course.name,
      category: course.category,
      giaSu: giaSuLabel(course.instructor),
      cover: coverImageOf(course.bg),
      done: prog.done,
      total: prog.total,
      pct: prog.pct,
      trangThai: lopTrangThai(prog),
      hocTiep: ht.lessonId && ht.reason !== "trong" ? { lessonId: ht.lessonId, title: titleOf.get(ht.lessonId) ?? "", reason: ht.reason } : null,
    };
  });
}

/** Phiếu "Hôm nay có lớp": bài Đã đăng có scheduledAt từ 00:00 VN hôm nay tới hết ngày (hôm nay + 7), của các lớp em đang học. Mốc giờ do máy chủ quyết. */
export async function loadHomNay(userId: string, now: Date): Promise<HomNayResp> {
  const { from, until } = vnWindow(now, HOM_NAY_DAYS);
  const rows = await prisma.lesson.findMany({
    where: {
      status: "published",
      scheduledAt: { gte: from, lt: until },
      chapter: { section: { course: { enrollments: { some: { userId, status: ACTIVE } } } } },
    },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      documents: true,
      azotaUrl: true,
      _count: { select: { assignments: true } },
      chapter: { select: { section: { select: { course: { select: { id: true, name: true } } } } } },
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: 60,
  });

  const split = chiaHomNay(rows.map(r => ({ ...r, lessonId: r.id })), now, HOM_NAY_DAYS);

  const base = (r: (typeof split.today)[number]): HomNayUpcomingItem => ({
    lessonId: r.id,
    courseId: r.chapter.section.course.id,
    courseName: r.chapter.section.course.name,
    lessonTitle: r.title,
    scheduledAt: (r.scheduledAt as Date).toISOString(),
    dateKey: r.dateKey,
    dayTitle: vnDayTitle(r.dateKey, split.todayKey),
    time: r.time,
    past: r.past,
    href: lessonHref(r.id),
    baiTapHref: r._count.assignments > 0 ? baiTapHrefOf(r.id) : null,
  });

  const today: HomNayItem[] = split.today.slice(0, HOM_NAY_MAX_TODAY).map(r => ({ ...base(r), docs: docLinks(r.documents), azota: azotaLinks(r.azotaUrl) }));
  const upcoming: HomNayUpcomingItem[] = split.upcoming.slice(0, HOM_NAY_MAX_UPCOMING).map(base);
  return { now: now.toISOString(), todayKey: split.todayKey, today, upcoming };
}
