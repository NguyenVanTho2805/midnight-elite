// ĐX-01 (NC1-010/011) — "Buổi đã qua giờ, chưa điểm danh xong" cho Hộp việc của gia sư. Thuần (không Prisma) để test;
// truy vấn nằm ở unmarkedServer.ts.
//
// Vì sao có: điểm danh nuôi Sổ của con ("Toán 7/8"), chuyên cần trong báo cáo tháng và buổi bù. Tiền KHÔNG phụ thuộc điểm danh
// (quyet-dinh-giao-dien-va-hoc-phi.md mục 4) nên đây không phải việc khẩn; chỉ là gợi ý để sổ không thủng.
//
// Một buổi là "chưa điểm danh xong" khi: không bị huỷ · lớp đang mở · bắt đầu SAU lúc tạo khung giờ · đã qua giờ kết thúc
// cộng UNMARKED_GRACE_MIN · và còn ít nhất một học sinh cần điểm danh mà chưa có bản ghi.
//
// KHÔNG dùng "đã có phiên điểm danh" làm tiêu chí: `markExcused` (absenceServer.ts) tự tạo phiên khi phụ huynh báo nghỉ trước,
// nên phiên tồn tại chưa nghĩa là gia sư đã điểm danh. Tiêu chí là từng em có bản ghi hay chưa.
//
// Một em KHÔNG bị tính là thiếu nếu: ghi danh sau khi buổi kết thúc · đã có báo nghỉ cho buổi đó (bất kể trạng thái — "tính phí"
// không sinh bản ghi điểm danh, "chờ xử lý" đã có việc riêng "báo nghỉ sát giờ").
import { UNMARKED_GRACE_MIN } from "@/lib/classSessions";

export interface UnmarkedOccurrence {
  scheduleId: string;
  courseId: string;
  courseName: string;
  /** Lớp đang nhận / dạy (classStatus = "open"). Lớp đã đóng hoặc tạm ngừng không nhắc. */
  courseOpen: boolean;
  /** Ngày HIỆU LỰC (buổi dời thì là ngày mới) — nơi bản ghi điểm danh được ghi. */
  dateKey: string;
  /** Ngày GỐC theo lịch tuần — khoá của báo nghỉ. */
  originalDateKey: string;
  startAt: Date;
  endAt: Date;
  status: "scheduled" | "cancelled" | "moved";
  /** Lúc tạo khung giờ: buổi bắt đầu trước mốc này không bị đòi (không đòi lịch sử trước khi có lịch). */
  ruleCreatedAt: Date;
}
export interface UnmarkedStudent { id: string; name: string; enrolledAt: Date }
export interface UnmarkedInput {
  now: Date;
  occurrences: readonly UnmarkedOccurrence[];
  /** Chỉ các em đang học (active) của từng lớp. */
  studentsByCourse: ReadonlyMap<string, readonly UnmarkedStudent[]>;
  /** Các em đã có bản ghi điểm danh, khoá bằng recordKey(). */
  recorded: ReadonlySet<string>;
  /** Các em đã có báo nghỉ cho buổi, khoá bằng absenceKey(). */
  handled: ReadonlySet<string>;
}
export interface UnmarkedSession {
  scheduleId: string;
  courseId: string;
  courseName: string;
  dateKey: string;
  startAt: Date;
  /** Số em cần điểm danh nhưng chưa có bản ghi / tổng số em cần điểm danh ở buổi này. */
  missing: number;
  total: number;
  /** Vài tên đầu, để dòng việc nói cụ thể. */
  missingNames: string[];
}

export const recordKey = (courseId: string, dateKey: string, studentId: string) => `${courseId}|${dateKey}|${studentId}`;
export const absenceKey = (scheduleId: string, originalDateKey: string, studentId: string) => `${scheduleId}|${originalDateKey}|${studentId}`;

export const UNMARKED_NAMES_SHOWN = 3;

/** Các buổi chưa điểm danh xong, sắp CŨ NHẤT trước (việc để lâu nhất lên đầu). */
export function findUnmarkedSessions(i: UnmarkedInput): UnmarkedSession[] {
  const nowMs = i.now.getTime();
  const seen = new Set<string>();
  const out: UnmarkedSession[] = [];
  const sorted = [...i.occurrences].sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.scheduleId.localeCompare(b.scheduleId));

  for (const o of sorted) {
    if (o.status === "cancelled" || !o.courseOpen) continue;
    if (o.startAt.getTime() < o.ruleCreatedAt.getTime()) continue; // lịch sử trước khi có khung giờ
    if (o.endAt.getTime() + UNMARKED_GRACE_MIN * 60_000 > nowMs) continue; // chưa tới hạn
    // Hai khung giờ cùng lớp cùng ngày dùng chung MỘT phiên điểm danh (ngày) → chỉ nhắc một lần.
    const dedupe = `${o.courseId}|${o.dateKey}`;
    if (seen.has(dedupe)) continue;

    // Em ghi danh sau khi buổi kết thúc thì không thuộc buổi này.
    const roster = (i.studentsByCourse.get(o.courseId) ?? []).filter(s => s.enrolledAt.getTime() <= o.endAt.getTime());
    const needed = roster.filter(s => !i.handled.has(absenceKey(o.scheduleId, o.originalDateKey, s.id)));
    if (needed.length === 0) continue;
    const missing = needed.filter(s => !i.recorded.has(recordKey(o.courseId, o.dateKey, s.id)));
    if (missing.length === 0) continue;

    seen.add(dedupe);
    out.push({
      scheduleId: o.scheduleId, courseId: o.courseId, courseName: o.courseName, dateKey: o.dateKey, startAt: o.startAt,
      missing: missing.length, total: needed.length,
      missingNames: missing.map(s => s.name).sort((a, b) => a.localeCompare(b, "vi")).slice(0, UNMARKED_NAMES_SHOWN),
    });
  }
  return out;
}

/** Đích của dòng việc: trang điểm danh của lớp, mở sẵn đúng ngày. Chỉ nhận ngày YYYY-MM-DD hợp lệ. */
export function unmarkedHref(courseId: string, dateKey: string): string {
  return `/admin/khoa-hoc/${courseId}/diem-danh?date=${dateKey}`;
}
