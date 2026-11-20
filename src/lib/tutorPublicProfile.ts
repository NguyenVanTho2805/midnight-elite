// LOI-05 (mục 3.1 docs/kin/phong-ban/dac-ta/LOI-05.md) — phần ĐỌC hồ sơ gia sư công khai, tách khỏi GET /api/tutors/[id].
// Route gọi hàm này rồi trả JSON; trang máy chủ /mentor/[id] gọi THẲNG hàm này (không tự fetch lại API theo tên miền nữa).
// Vì vậy JSON của route giữ NGUYÊN từng trường như trước khi tách (kể cả `rating` ở stats và từng lớp — giao diện mới không vẽ).
//
// Luật hiển thị (không đổi):
//  • `null` khi id rỗng / > 64 ký tự / có NUL; không phải gia sư đã duyệt; bị cấm; bị khoá (PH-212); hồ sơ ẩn (NC2-022)
//    — ngoại lệ DUY NHẤT: chính chủ xem trước (`preview && viewerId === id`).
//  • Không email, không số điện thoại: Zalo chỉ khi gia sư BẬT "Hiện số Zalo" (PH-215); Messenger do gia sư tự nhập.
//  • Khu vực/giá TỰ KHAI qua `publicArea` (chỉ quận + tỉnh/thành; giá chỉ khi gia sư tự bật).
//  • `Course.price` chỉ dùng để suy `isFree`/`joinPolicy`, KHÔNG bao giờ trả ra. Không có tên học sinh — chỉ số đếm.
//  • Số buổi đã dạy theo sổ lớp do gia sư ghi (taughtSessionWhere), không phải bằng chứng đã xác minh.
// Lỗi DB vẫn ném (route trả 500, trang hiện khối lỗi tạm thời).
import type { PrismaClient } from "@/generated/prisma/client";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { readPreferences } from "@/lib/userPreferences";
import { isProfileHidden } from "@/lib/tutorVisibility";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { taughtSessionWhere } from "@/lib/taughtSessions";
import { recentTaughtSessionWhere } from "@/lib/tutorActivity";
import { publicArea, type PublicArea } from "@/lib/tutorArea";
import { loadFeeRateCourseIds } from "@/lib/enrollServer";
import { effectivePolicy, isFreeClass, type JoinPolicy } from "@/lib/joinRequest";
import { coverForPublic, introVideoView, type IntroVideoView } from "@/lib/tutorSearchMedia";

export interface TutorPublicRating { avg: number | null; total: number }

export interface TutorPublicClass {
  id: string;
  name: string;
  shortTitle: string;
  category: string;
  bg: string;
  strip: string;
  classStatus: string;
  capacity: number | null;
  activeCount: number;
  seatsLeft: number | null;
  joinPolicy: JoinPolicy;
  isFree: boolean;
  /** Giữ cho tương thích JSON cũ; giao diện KHÔNG vẽ (không sao/điểm). */
  rating: TutorPublicRating;
}

/** Đúng hình JSON mà GET /api/tutors/[id] trả (Date đã là chuỗi ISO, như sau JSON.stringify). */
export interface TutorPublicProfile {
  /** Chỉ có thể true khi chính chủ xem trước; người ngoài không bao giờ nhận được hồ sơ ẩn. */
  profileHidden: boolean;
  tutor: {
    id: string;
    name: string;
    avatarBase64: string | null;
    bio: string | null;
    subjects: string[];
    tutorVerified: boolean;
    tutorVerifiedAt: string | null;
    zalo: string | null;
    messenger: string | null;
    area: PublicArea | null;
    coverUrl: string | null;
    introVideo: IntroVideoView | null;
  };
  stats: {
    classCount: number;
    studentCount: number;
    sessionsTaught: number;
    recentlyActive: boolean;
    /** Giữ cho tương thích JSON cũ; giao diện KHÔNG vẽ. */
    rating: TutorPublicRating;
  };
  classes: TutorPublicClass[];
}

/** Tập khoá ở từng tầng của JSON (test bắt trường lỡ thêm / lỡ mất). */
export const TUTOR_PUBLIC_PROFILE_KEYS = {
  top: ["profileHidden", "tutor", "stats", "classes"],
  tutor: ["id", "name", "avatarBase64", "bio", "subjects", "tutorVerified", "tutorVerifiedAt", "zalo", "messenger", "area", "coverUrl", "introVideo"],
  stats: ["classCount", "studentCount", "sessionsTaught", "recentlyActive", "rating"],
  classes: ["id", "name", "shortTitle", "category", "bg", "strip", "classStatus", "capacity", "activeCount", "seatsLeft", "joinPolicy", "isFree", "rating"],
} as const;

/** id rác (NUL làm Postgres báo lỗi ⇒ 500, hoặc quá dài) không thể là id thật. */
export const isPlausibleTutorId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 64 && !id.includes("\u0000");

export async function loadPublicTutorProfile(
  db: PrismaClient,
  id: string,
  opts: { viewerId?: string | null; preview?: boolean } = {},
): Promise<TutorPublicProfile | null> {
  if (!isPlausibleTutorId(id)) return null;

  const t = await db.user.findFirst({
    where: {
      id,
      role: "admin",
      adminRole: "teacher",
      tutorVerified: true,
      banned: false,
      profileLockedAt: null, // PH-212: hồ sơ bị khoá thì như không tồn tại với người ngoài
    },
    select: {
      id: true, name: true, avatarBase64: true, bio: true, subjects: true,
      tutorVerified: true, tutorVerifiedAt: true, phone: true, preferences: true, city: true,
      coverUrl: true, introVideoUrl: true, // BU-06: tự khai; chỉ trả bản đã kiểm / dẫn xuất (xem dưới)
    },
  });
  if (!t) return null;

  // NC2-022: ẩn → như không tồn tại, trừ khi chính chủ xem trước (Hồ sơ gia sư vẫn cho xem và ghi "đang ẩn").
  const profileHidden = isProfileHidden(readPreferences(t.preferences));
  if (profileHidden && !(opts.preview === true && !!opts.viewerId && opts.viewerId === id)) return null;

  const courses = await db.course.findMany({
    where: { ownerId: id, status: true },
    select: {
      id: true, name: true, shortTitle: true, category: true, bg: true, strip: true,
      classStatus: true, capacity: true,
      // BU-06: chỉ để suy `joinPolicy`/`isFree`; `price` KHÔNG bao giờ được trả ra.
      joinPolicy: true, price: true, tag: true,
    },
    orderBy: { sortOrder: "asc" },
  });
  const courseIds = courses.map(c => c.id);

  const [enrollCounts, reviewAggs, sessionsTaught, recentSession, feeRated] = await Promise.all([
    courseIds.length === 0 ? [] : db.enrollment.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds }, status: ENROLLMENT_STATUS.ACTIVE },
      _count: { _all: true },
    }),
    courseIds.length === 0 ? [] : db.courseReview.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds }, status: "approved" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    // PH-207 + ĐX-00: buổi ĐÃ DẠY theo sổ lớp (ngày ≤ hôm nay giờ VN, ít nhất 1 em có mặt/muộn). Gia sư tự ghi.
    courseIds.length === 0 ? 0 : db.attendanceSession.count({ where: { courseId: { in: courseIds }, ...taughtSessionWhere() } }),
    // ĐX-05: có ít nhất 1 buổi đã dạy trong 30 ngày qua.
    courseIds.length === 0 ? null : db.attendanceSession.findFirst({ where: { courseId: { in: courseIds }, ...recentTaughtSessionWhere() }, select: { id: true } }),
    // BU-06: lớp đã nhập đơn giá thì không còn là "Miễn phí" (cùng luật với POST /api/courses/[id]/join).
    loadFeeRateCourseIds(courseIds, db),
  ]);

  const activeByCourse = new Map(enrollCounts.map(r => [r.courseId, r._count._all]));
  const reviewByCourse = new Map(reviewAggs.map(r => [r.courseId, { avg: r._avg.rating, total: r._count._all }]));

  const classes: TutorPublicClass[] = courses.map(c => {
    const activeCount = activeByCourse.get(c.id) ?? 0;
    const r = reviewByCourse.get(c.id);
    const isFree = isFreeClass({ price: c.price, tag: c.tag, hasFeeRate: feeRated.has(c.id) });
    // "open" mà không miễn phí → "invite_only", giống join/route.ts: giao diện không hứa điều máy chủ sẽ từ chối.
    let joinPolicy: JoinPolicy = effectivePolicy(c.joinPolicy);
    if (joinPolicy === "open" && !isFree) joinPolicy = "invite_only";
    return {
      id: c.id,
      name: c.name,
      shortTitle: c.shortTitle,
      category: c.category,
      bg: c.bg,
      strip: c.strip,
      classStatus: c.classStatus,
      capacity: c.capacity,
      activeCount,
      seatsLeft: c.capacity === null ? null : Math.max(0, c.capacity - activeCount),
      joinPolicy,
      isFree,
      rating: r ? { avg: r.avg, total: r.total } : { avg: null, total: 0 },
    };
  });

  // Điểm tổng hợp theo gia sư (có trọng số) — cùng công thức route danh sách. Giữ cho tương thích; không vẽ.
  let ratingSum = 0, ratingCount = 0;
  for (const r of reviewAggs) {
    if (r._avg.rating == null) continue;
    ratingSum += r._avg.rating * r._count._all;
    ratingCount += r._count._all;
  }
  const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : null;
  const studentCount = classes.reduce((s, c) => s + c.activeCount, 0);

  return {
    profileHidden,
    tutor: {
      id: t.id,
      name: t.name,
      avatarBase64: t.avatarBase64,
      bio: t.bio,
      subjects: t.subjects,
      tutorVerified: t.tutorVerified,
      // Chuỗi ISO — đúng như JSON.stringify(Date) của route cũ, để trang gọi thẳng và route trả cùng một hình.
      tutorVerifiedAt: t.tutorVerifiedAt ? t.tutorVerifiedAt.toISOString() : null,
      // PH-215: số Zalo chỉ lộ khi gia sư BẬT "Hiện số Zalo trên hồ sơ".
      zalo: readPreferences(t.preferences).connections?.showZalo ? normalizeZaloPhone(t.phone) : null,
      // PH-215: trang Messenger do gia sư chủ động nhập.
      messenger: readPreferences(t.preferences).connections?.messenger ?? null,
      // ĐX-06: null khi gia sư chưa lưu mục này (không lộ users.city cũ).
      area: publicArea(t.city, readPreferences(t.preferences).teaching),
      // BU-06: ảnh bìa chỉ khi qua kiểm; video dẫn xuất lại từ mã YouTube, không trả chuỗi thô.
      coverUrl: coverForPublic(t.coverUrl),
      introVideo: introVideoView(t.introVideoUrl),
    },
    stats: {
      classCount: classes.length,
      studentCount,
      sessionsTaught,
      recentlyActive: recentSession !== null,
      rating: { avg: ratingAvg, total: ratingCount },
    },
    classes,
  };
}
