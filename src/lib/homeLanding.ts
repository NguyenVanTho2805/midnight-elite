// BU-HS-LANDING — phần THUẦN (không prisma, không next, không react) của bốn khối dữ liệu thật trên trang chủ công khai: Gia sư, Lớp theo kỳ thi,
// Thi thử miễn phí, Tin tức. Đặc tả: docs/kin/phong-ban/dac-ta/BU-HS-LANDING.md mục 2.4, 2.5, 7.
// Phần chạm DB (loadHomeLanding + bốn bộ tải) nằm ở src/lib/homeLandingServer.ts. Test thuần: tools/local-e2e/t-home-landing-lib.ts.
//
// Nguyên tắc:
//  • Dữ liệu THẬT, không bịa số/tên/lời. Khối không có dữ liệu → mảng rỗng (giao diện không vẽ khối).
//  • Chỉ chép trường cần ra HTML tĩnh (mục 2.5): không email/SĐT/trường/ngày sinh gia sư, không sĩ số/link nhóm của lớp, không đáp án/lời giải/mật khẩu của đề.
//  • Tiền chỉ để HIỂN THỊ (PublicCard.price); không tính, không ghi.
//  • Mốc giờ do máy chủ truyền vào (`now`); trình duyệt không tính mốc nào. Giờ Việt Nam là +07:00 cố định (VN_OFFSET_MS), không phụ thuộc TZ tiến trình.
import { catalogChips, hasSeat, type Chip, type PublicCard } from "@/lib/courseCatalogPublic";
import { computeExamStatus, VN_OFFSET_MS } from "@/lib/examData";
import type { ArticleCard } from "@/lib/articlesPublic";
import { toListItem, type SearchableTutor, type TutorListItem } from "@/lib/tutorSearch";
import { sortTutors } from "@/lib/tutorActivity";

// ─── Hằng ────────────────────────────────────────────────────────────────────────────────────────────────────
export const HOME_LANDING_LIMITS = { tutors: 4, tutorsMin: 2, courses: 6, exams: 6, articles: 3, excerpt: 140, avatarChars: 24_000 } as const;

/** Cùng giá trị với `Footer.tsx` (test khoá hai bên bằng nhau). Không có ô nhập nào: chỉ liên kết gọi/nhắn. */
export const HOME_CONTACT = {
  phoneHref: "tel:0384409051",
  phoneText: "0384 409 051",
  zaloHref: "https://zalo.me/0384409051",
  hours: "09:00 – 21:30 hằng ngày",
} as const;

/** Trần độ dài chữ đưa vào HTML tĩnh (chống dữ liệu quản trị lỡ nhập quá dài). */
const BIO_MAX = 240;
const TITLE_MAX = 200;
const SHORT_MAX = 60;

// ─── Kiểu ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface LandingExam {
  id: string;
  /** Mã đề (vd "HSA.03"); giao diện lấy tiền tố trước dấu chấm. */
  code: string;
  title: string;
  category: string;
  /** "dd/mm/yyyy" (đã chuẩn hoá, có thể rỗng nếu đề không ghi ngày). */
  date: string;
  /** "HH:mm" (có thể rỗng). */
  time: string;
  duration: string;
  /** Số hàng ExamQuestion thật (không dùng cột `Exam.questions` lưu tay). */
  questionCount: number;
  /** Tính lúc dựng trang theo giờ máy chủ; có thể trễ tới 1 giờ (trang tĩnh). `upcoming` thì thẻ KHÔNG là liên kết. */
  state: "open" | "upcoming";
  startsAtMs: number;
}
export interface LandingArticle {
  slug: string;
  title: string;
  excerpt: string;
  categoryLabel: string;
  /** "dd/mm/yyyy" giờ Việt Nam. */
  dateText: string;
  coverImage: string | null;
}
export interface HomeLanding {
  tutors: TutorListItem[];
  courses: PublicCard[];
  courseChips: Chip[];
  exams: LandingExam[];
  articles: LandingArticle[];
}

/** Mọi mảng rỗng. Bất biến (đóng băng) để không ai vô tình sửa bản dùng chung. */
export const EMPTY_LANDING: HomeLanding = Object.freeze({
  tutors: Object.freeze([]) as unknown as TutorListItem[],
  courses: Object.freeze([]) as unknown as PublicCard[],
  courseChips: Object.freeze([]) as unknown as Chip[],
  exams: Object.freeze([]) as unknown as LandingExam[],
  articles: Object.freeze([]) as unknown as LandingArticle[],
}) as HomeLanding;

// ─── Chữ & ngày ──────────────────────────────────────────────────────────────────────────────────────────────
const squash = (s: string) => s.normalize("NFC").replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠⁦-⁩﻿]/g, " ").replace(/\s+/g, " ").trim();
const COMBINING = /^\p{M}$/u;

/**
 * Cắt về tối đa `max` ký tự Unicode (đếm theo điểm mã sau khi chuẩn NFC, KHÔNG theo đơn vị UTF-16), kể cả dấu "…" thêm vào.
 * Không cắt ngay trước dấu kết hợp (không để dấu mồ côi), gỡ khoảng trắng/dấu câu cuối trước khi thêm "…". Ngắn hơn hạn → trả nguyên (đã gộp khoảng trắng).
 */
export function clipText(s: string, max: number): string {
  const text = squash(typeof s === "string" ? s : "");
  const limit = Math.max(0, Math.trunc(Number.isFinite(max) ? max : 0));
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  if (limit === 0) return "";
  let cut = limit - 1; // chừa chỗ cho "…"
  while (cut > 0 && COMBINING.test(chars[cut])) cut--;
  const head = chars.slice(0, cut).join("").replace(/[\s,.;:!?\-–—]+$/u, "");
  return `${head}…`;
}

/** dd/mm/yyyy theo giờ Việt Nam (+07:00 cố định). Ngày không hợp lệ → "". */
export function viDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
}

/**
 * Chạy `fn`; ném lỗi (kể cả ném đồng bộ) → ghi `console.error` rồi trả `fallback`. Mỗi bộ tải trang chủ bọc riêng một lần:
 * một bộ hỏng chỉ làm khối của nó biến mất, không kéo cả trang.
 */
export async function safeBlock<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[home-landing] ${label}`, e);
    return fallback;
  }
}

// ─── Gia sư ──────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * `all` = gia sư đã qua luật hiện công khai (duyệt, không khoá, không ẩn hồ sơ — do bộ tải lo) kèm số liệu.
 * Sắp "active" (đang hoạt động → nhiều buổi đã dạy → đánh giá → tên), lấy 4. DƯỚI 2 người → [] (không dựng lưới 1 thẻ).
 * Ảnh base64 dài hơn `avatarChars` → null (chữ cái đầu). Chỉ ra đúng khoá của TutorListItem (qua `toListItem`).
 */
export function pickHomeTutors(all: readonly SearchableTutor[]): TutorListItem[] {
  const L = HOME_LANDING_LIMITS;
  const top = sortTutors(all ?? [], "active").slice(0, L.tutors);
  if (top.length < L.tutorsMin) return [];
  return top.map(t => {
    const item = toListItem(t);
    const avatar = typeof item.avatarBase64 === "string" && item.avatarBase64.length > 0 && item.avatarBase64.length <= L.avatarChars ? item.avatarBase64 : null;
    return { ...item, avatarBase64: avatar, bio: item.bio ? clipText(item.bio, BIO_MAX) || null : null };
  });
}

// ─── Lớp theo kỳ thi ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * Chỉ lớp còn nhận người (`hasSeat`: không đầy/đóng/tạm ngừng). Lấy 1 thẻ đầu của MỖI kỳ thi (theo thứ tự `categories`; thiếu thì theo lần xuất hiện đầu
 * trong `cards`, vốn đã sắp `sortOrder`), rồi bù theo thứ tự `cards` đến đủ `max`. Chip = các kỳ thi còn lớp có chỗ. Không đổi mảng đầu vào.
 * Ảnh gia sư của lớp quá dài → "" (thẻ trang chủ không dùng ảnh).
 */
export function pickHomeCourses(cards: readonly PublicCard[], max: number = HOME_LANDING_LIMITS.courses, categories: readonly string[] = []): { courses: PublicCard[]; chips: Chip[] } {
  const open = (cards ?? []).filter(c => hasSeat(c.seat));
  if (open.length === 0) return { courses: [], chips: [] };
  const cap = Math.max(0, Math.trunc(Number.isFinite(max) ? max : 0));
  const ordered: string[] = [];
  for (const n of [...categories, ...open.map(c => c.category)]) if (!ordered.includes(n)) ordered.push(n);

  const picked: PublicCard[] = [];
  const used = new Set<PublicCard>();
  for (const cat of ordered) {
    if (picked.length >= cap) break;
    const first = open.find(c => c.category === cat);
    if (first) { picked.push(first); used.add(first); }
  }
  for (const c of open) {
    if (picked.length >= cap) break;
    if (!used.has(c)) { picked.push(c); used.add(c); }
  }
  const courses = picked.map(c => ({ ...c, teacherAvatar: c.teacherAvatar.length <= HOME_LANDING_LIMITS.avatarChars ? c.teacherAvatar : "" }));
  return { courses, chips: catalogChips(ordered, open, "") };
}

// ─── Thi thử ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Dòng đề tối thiểu (bộ tải đã lọc quyền, đã đếm câu hỏi thật). KHÔNG có khoá nào khác — không đáp án, không mật khẩu. */
export interface ExamRowLike { id: string; code: string; title: string; category: string; date: string; time: string; duration: string; questionCount: number }

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * "dd/mm/yyyy" + "HH:mm" (giờ Việt Nam) → { date, time chuẩn hoá, mốc } hoặc null nếu đọc không ra.
 * Rỗng cả hai là hợp lệ (quy ước cũ của `examStartInstant`: ngày rỗng → 01/01/2000, giờ rỗng → 00:00; ra chữ rỗng, không hiện "01/01/2000").
 * Chuỗi KHÁC rỗng mà sai khuôn, hoặc ngày/giờ không có thật (31/02, 25:00) → null (bỏ đề, không đoán).
 */
function parseExamWhen(dateRaw: unknown, timeRaw: unknown): { date: string; time: string } | null {
  const date = typeof dateRaw === "string" ? dateRaw.trim() : "";
  const time = typeof timeRaw === "string" ? timeRaw.trim() : "";
  let outDate = "", outTime = "";
  if (date) {
    const m = DATE_RE.exec(date);
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (mo < 1 || mo > 12 || d < 1 || probe.getUTCDate() !== d || probe.getUTCMonth() !== mo - 1) return null;
    outDate = `${p2(d)}/${p2(mo)}/${y}`;
  }
  if (time) {
    const m = TIME_RE.exec(time);
    if (!m) return null;
    const [h, mi] = [Number(m[1]), Number(m[2])];
    if (h > 23 || mi > 59) return null;
    outTime = `${p2(h)}:${p2(mi)}`;
  }
  return { date: outDate, time: outTime };
}

/**
 * Sắp theo MỐC THỜI GIAN thật (giờ Việt Nam), mới nhất trước — KHÔNG theo chuỗi "dd/mm/yyyy". Hoà → mã đề → id (thứ tự toàn phần).
 * `state` = open nếu đã tới giờ mở (so với `now` của máy chủ), ngược lại upcoming. Ngày/giờ rác → bỏ đề. Lấy tối đa `max`.
 */
export function pickHomeExams(rows: readonly ExamRowLike[], now: Date, max: number = HOME_LANDING_LIMITS.exams): LandingExam[] {
  const cap = Math.max(0, Math.trunc(Number.isFinite(max) ? max : 0));
  const out: LandingExam[] = [];
  for (const r of rows ?? []) {
    const when = parseExamWhen(r.date, r.time);
    if (!when) continue;
    const status = computeExamStatus(when.date, when.time, true, now);
    const [dd, mm, yy] = (when.date || "01/01/2000").split("/").map(Number);
    const [hh, mi] = (when.time || "00:00").split(":").map(Number);
    const startsAtMs = Date.UTC(yy, mm - 1, dd, hh, mi) - VN_OFFSET_MS;
    out.push({
      id: String(r.id),
      code: clipText(String(r.code ?? ""), SHORT_MAX),
      title: clipText(String(r.title ?? ""), TITLE_MAX),
      category: clipText(String(r.category ?? ""), SHORT_MAX),
      date: when.date,
      time: when.time,
      duration: clipText(String(r.duration ?? ""), SHORT_MAX),
      questionCount: Number.isFinite(r.questionCount) && r.questionCount > 0 ? Math.trunc(r.questionCount) : 0,
      state: status === "available" ? "open" : "upcoming",
      startsAtMs,
    });
  }
  out.sort((a, b) => b.startsAtMs - a.startsAtMs || a.code.localeCompare(b.code, "vi") || a.id.localeCompare(b.id));
  return out.slice(0, cap);
}

// ─── Tin tức ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Chỉ chép trường cần ra thẻ (không tác giả, không lượt xem, không nội dung). Ngày = giờ đăng, bài cũ không có giờ đăng → ngày tạo. */
export function toLandingArticle(a: ArticleCard): LandingArticle {
  const when = a.publishedAt ?? a.createdAt;
  return {
    slug: a.slug,
    title: clipText(a.title, TITLE_MAX),
    excerpt: clipText(a.excerpt ?? "", HOME_LANDING_LIMITS.excerpt),
    categoryLabel: a.categoryLabel,
    dateText: viDate(when),
    coverImage: typeof a.coverImage === "string" && a.coverImage.trim() !== "" ? a.coverImage : null,
  };
}
