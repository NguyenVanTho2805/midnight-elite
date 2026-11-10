// BU-HS-LANDING — phần CHẠM DB của bốn khối dữ liệu thật trên trang chủ công khai (Gia sư, Lớp, Thi thử, Tin tức).
// Đặc tả: docs/kin/phong-ban/dac-ta/BU-HS-LANDING.md mục 2.4, 2.5. Phần thuần (chọn/sắp/cắt): src/lib/homeLanding.ts.
//
// Trang chủ là trang TĨNH (revalidate = 3600): không đọc cookie/header/phiên ở đây, kết quả giống nhau cho mọi người xem.
// Mỗi bộ tải bọc lỗi RIÊNG (`safeBlock`): lỗi hoặc rỗng → khối rỗng (giao diện không vẽ khối), không bao giờ ném ra ngoài.
// Mọi `select` liệt kê TỪNG cột (mục 2.5): không đáp án/lời giải/mật khẩu/azotaUrl/ownerId/participants của đề; không email/SĐT/ngày sinh của gia sư; không sĩ số/link nhóm của lớp.
import { prisma } from "@/lib/prisma";
import { loadPublicCatalog } from "@/lib/courseCatalogPublicServer";
import { loadSearchableTutors } from "@/lib/tutorSearchServer";
import { listPublicArticles } from "@/lib/articlesPublic";
import { isListedToStudent } from "@/lib/examVariantRoute";
import {
  EMPTY_LANDING, HOME_LANDING_LIMITS, pickHomeCourses, pickHomeExams, pickHomeTutors, safeBlock, toLandingArticle,
  type ExamRowLike, type HomeLanding, type LandingArticle, type LandingExam,
} from "@/lib/homeLanding";
import type { TutorListItem } from "@/lib/tutorSearch";
import type { Chip, PublicCard } from "@/lib/courseCatalogPublic";

/** Gia sư: cùng luật hiện của /giang-vien (đã duyệt, không khoá, không ẩn hồ sơ). Dưới 2 người → []. */
export async function loadHomeTutors(): Promise<TutorListItem[]> {
  return pickHomeTutors(await loadSearchableTutors(prisma));
}

/** Lớp: chỉ lớp còn chỗ (không đầy/đóng/tạm ngừng); `status:false` đã bị bộ tải danh mục loại. Không sĩ số, không link nhóm. */
export async function loadHomeCourses(): Promise<{ courses: PublicCard[]; chips: Chip[] }> {
  const { cards, categories } = await loadPublicCatalog();
  return pickHomeCourses(cards, HOME_LANDING_LIMITS.courses, categories);
}

/**
 * Thi thử: chỉ đề CHUNG (không gắn lớp), miễn phí (giá null/0), đang mở công khai, đã phát hành, bản đang dùng, không phải mã đề con, có ≥1 câu hỏi.
 * Chặt hơn /thi-thu ở `courseId:null` và `active:true` (mục 2.4). `questionCount` là đếm hàng ExamQuestion, không dùng cột `Exam.questions` lưu tay.
 */
export async function loadHomeExams(now: Date): Promise<LandingExam[]> {
  const rows = await prisma.exam.findMany({
    where: {
      active: true, activeGuest: true, isDraft: false, supersededById: null, variantOfId: null, courseId: null,
      OR: [{ price: null }, { price: 0 }],
      examQuestions: { some: {} },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true, code: true, title: true, category: true, date: true, time: true, duration: true,
      courseId: true, variantOfId: true,
      owner: { select: { adminRole: true } },
      _count: { select: { examQuestions: true } },
    },
  });
  // Đề do gia sư tạo mà không gắn lớp = "giao theo link": không liệt kê (cùng luật BU-04 với danh sách học sinh).
  const listed: ExamRowLike[] = rows
    .filter(e => isListedToStudent(e, e.owner?.adminRole, null))
    .map(e => ({ id: e.id, code: e.code, title: e.title, category: e.category, date: e.date, time: e.time, duration: e.duration, questionCount: e._count.examQuestions }));
  return pickHomeExams(listed, now, HOME_LANDING_LIMITS.exams);
}

/** Tin: 3 bài mới nhất (ghim trước), luật sẵn của `publicArticleWhere` — đã đăng và (không có giờ hẹn hoặc giờ hẹn đã tới theo `now`). */
export async function loadHomeArticles(now: Date): Promise<LandingArticle[]> {
  const cards = await listPublicArticles({ limit: HOME_LANDING_LIMITS.articles, sort: "moi", now });
  return cards.map(toLandingArticle);
}

/**
 * Cả bốn khối, song song. KHÔNG ném lỗi: bộ nào hỏng thì khối đó rỗng. `now` là giờ máy chủ (mặc định lúc dựng trang).
 * Không rỗng-cả-bốn thì trả đúng những gì có; rỗng cả bốn thì trả giá trị bằng `EMPTY_LANDING`.
 */
export async function loadHomeLanding(now: Date = new Date()): Promise<HomeLanding> {
  const [tutors, catalog, exams, articles] = await Promise.all([
    safeBlock(loadHomeTutors, EMPTY_LANDING.tutors, "tutors"),
    safeBlock(loadHomeCourses, { courses: EMPTY_LANDING.courses, chips: EMPTY_LANDING.courseChips }, "courses"),
    safeBlock(() => loadHomeExams(now), EMPTY_LANDING.exams, "exams"),
    safeBlock(() => loadHomeArticles(now), EMPTY_LANDING.articles, "articles"),
  ]);
  return { tutors, courses: catalog.courses, courseChips: catalog.chips, exams, articles };
}
